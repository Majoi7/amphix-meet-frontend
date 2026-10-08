import { useCallback, useMemo, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTracks, useLocalParticipant } from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { ParticipantTile } from "./ParticipantTile";
import { useIsMobile } from "../hooks/useIsMobile";
import { useElementSize } from "../hooks/useElementSize";
import { useGlobalPin } from "../hooks/useGlobalPin";
import { authorizedRequest } from "../lib/httpClient";
import { computeLayout, pinMatchesTile, rectToStyle } from "../lib/layoutEngine";
import type {
  LayoutPin,
  LayoutRect,
  LayoutSlot,
  LayoutTile,
} from "../lib/layoutEngine";

function sourceOf(track: TrackReferenceOrPlaceholder): "camera" | "screenshare" {
  return track.source === Track.Source.ScreenShare ? "screenshare" : "camera";
}

/**
 * Clé d'identité d'une tuile — celle qui décide si deux pistes sont la MÊME
 * tuile ou deux tuiles distinctes.
 *
 * Le cas qui oblige à ne pas s'arrêter à `(identité, source)` : le TABLEAU
 * BLANC. `Whiteboard.tsx` publie sa piste sous `Track.Source.ScreenShare`
 * avec `name: 'whiteboard'` — c'est un vrai partage d'écran du point de vue
 * de LiveKit, et c'est voulu : c'est ce qui lui permet d'être diffusé comme
 * n'importe quel partage.
 *
 * La conséquence, si la clé restait `identité-source` : un participant qui
 * ouvre le tableau blanc PUIS partage son écran publie DEUX pistes de même
 * source. La déduplication n'en gardait qu'une — l'autre disparaissait de
 * l'affichage sans aucun signe, alors qu'elle était bien publiée et bien
 * reçue.
 *
 * Le nom de piste est donc ajouté à la clé POUR LES PARTAGES D'ÉCRAN
 * uniquement. Pas pour les caméras : un changement de caméra change le nom
 * de piste, ce qui changerait la clé React, remonterait la tuile et
 * couperait la vidéo le temps du remontage. Un partage d'écran, lui, ne
 * change pas de nom de piste en cours de diffusion — et s'il s'arrête puis
 * repart, la nouvelle piste remplace l'ancienne, qui n'est plus rendue.
 */
function tileKeyOf(track: TrackReferenceOrPlaceholder): string {
  const base = `${track.participant.identity}-${track.source}`;
  if (track.source !== Track.Source.ScreenShare) return base;
  return `${base}-${track.publication?.trackName ?? ""}`;
}

/**
 * Affiche la réunion.
 *
 * Ce composant ne décide plus de la disposition : il collecte l'état
 * (tuiles, épingles, espace mesuré), le confie au moteur de layout, et
 * applique le résultat. Toute la logique de priorité et de géométrie vit
 * dans `lib/layoutEngine.ts`.
 *
 * Priorité appliquée par le moteur :
 *   GLOBAL PIN > LOCAL PIN > SCREEN SHARE > ACTIVE SPEAKER > AUTO LAYOUT
 */
export function VideoGrid({ roomId, isHost }: { roomId?: string; isHost?: boolean }) {
  const isMobile = useIsMobile();
  const { ref: stageRef, size } = useElementSize<HTMLDivElement>();
  const { isScreenShareEnabled } = useLocalParticipant();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const isHostFlag = isHost ?? false;
  // Les épingles locales sont mémorisées par IDENTITÉ, pas par référence
  // d'objet : LiveKit recrée les `TrackReference` au moindre changement
  // (orateur actif, publication de piste). Comparer les références ferait
  // perdre l'épingle sans aucun signe visible.
  //
  // Un TABLEAU plutôt qu'une épingle unique : le moteur sait déjà arbitrer
  // plusieurs épingles (il retient la première encore présente comme tuile
  // principale et range les autres en tête de bandeau). Les stocker toutes
  // évite qu'épingler une seconde tuile efface silencieusement la première.
  // La LISTE est locale à cet onglet, elle ne sort jamais d'ici.
  const [localPins, setLocalPins] = useState<LayoutPin[]>([]);
  const globalPinState = useGlobalPin(roomId ?? "");

  // Une seule tuile par piste distincte — on garde caméra ET partage d'écran
  // d'un même participant, et même deux partages d'écran distincts (voir
  // `tileKeyOf`).
  const deduplicatedTracks = useMemo(() => {
    const map = new Map<string, TrackReferenceOrPlaceholder>();
    tracks.forEach((track) => {
      if (!track) return;
      const key = tileKeyOf(track);
      if (!map.has(key)) map.set(key, track);
    });
    return Array.from(map.values());
  }, [tracks]);

  // Ordre d'arrivée stable : sert à départager sans jamais réordonner la
  // grille à chaque rendu (sinon les tuiles « sautent »).
  const arrivalOrderRef = useRef<Map<string, number>>(new Map());
  const arrivalCounterRef = useRef(0);

  const layoutTiles: LayoutTile[] = useMemo(() => {
    const order = arrivalOrderRef.current;
    return deduplicatedTracks.map((track) => {
      const id = tileKeyOf(track);
      if (!order.has(id)) {
        order.set(id, arrivalCounterRef.current);
        arrivalCounterRef.current += 1;
      }
      return {
        id,
        identity: track.participant.identity,
        source: sourceOf(track),
        isLocal: track.participant.isLocal,
        isSpeaking: track.participant.isSpeaking,
        hasVideo: !!(track.publication && !track.publication.isMuted),
        name: track.participant.name || track.participant.identity,
        arrivalIndex: order.get(id) ?? 0,
      };
    });
  }, [deduplicatedTracks]);

  const pins = useMemo(() => {
    const global: LayoutPin | null =
      globalPinState.participantId && globalPinState.trackSource
        ? {
            identity: globalPinState.participantId,
            source: globalPinState.trackSource === "Camera" ? "camera" : "screenshare",
          }
        : null;
    return { global, local: localPins };
  }, [globalPinState.participantId, globalPinState.trackSource, localPins]);

  // Le cœur : une fonction pure, recalculée seulement quand une entrée change.
  const layout = useMemo(
    () =>
      computeLayout({
        tiles: layoutTiles,
        viewport: size,
        pins,
        // Quand JE partage, ma caméra disparaît du rendu — elle reste
        // publiée dans LiveKit, on ne cache que l'affichage.
        localScreenShareActive: isScreenShareEnabled,
        gap: isMobile ? 6 : 10,
      }),
    [layoutTiles, size, pins, isScreenShareEnabled, isMobile]
  );

  /**
   * Fenêtre visible du bandeau secondaire, exprimée dans le repère de la
   * scène. Sert de conteneur de défilement : sans elle, les tuiles qui
   * dépassent la capacité visible étaient coupées par l'`overflow-hidden` de
   * la scène, donc invisibles ET inatteignables.
   *
   * Elle est désormais FOURNIE PAR LE MOTEUR (`stripRect`) au lieu d'être
   * déduite des bornes de la zone principale. La déduction supposait que le
   * bandeau ne dépasse jamais la tuile principale — vrai en mode « scène »,
   * faux en mode « focus », où le bandeau occupe toute la hauteur. Les tuiles
   * de la seconde rangée auraient alors été rognées.
   */
  const stripWindow = layout.stripRect;

  const trackById = useMemo(() => {
    const map = new Map<string, TrackReferenceOrPlaceholder>();
    deduplicatedTracks.forEach((track) => {
      map.set(tileKeyOf(track), track);
    });
    return map;
  }, [deduplicatedTracks]);

  const globalPinnedTrackObj = useMemo(() => {
    if (!pins.global) return null;
    return (
      deduplicatedTracks.find(
        (t) => t.participant.identity === pins.global!.identity && sourceOf(t) === pins.global!.source
      ) ?? null
    );
  }, [deduplicatedTracks, pins.global]);

  /* --- Actions ---------------------------------------------------- */

  const togglePin = useCallback((trackRef: TrackReferenceOrPlaceholder) => {
    const id = tileKeyOf(trackRef);
    const candidate: LayoutPin = {
      // La tuile visée est connue avec certitude ici : l'épingle porte donc son
      // `id`, et non le seul couple (identité, source) — indispensable quand un
      // participant publie à la fois le tableau blanc et un partage d'écran.
      id,
      identity: trackRef.participant.identity,
      source: sourceOf(trackRef),
    };
    setLocalPins((prev) =>
      // Épingler une tuile déjà épinglée la DÉSÉPINGLE. Les autres épingles
      // restent : c'est ce qui rend le multi-épinglage utilisable.
      prev.some((pin) => pin.id === id)
        ? prev.filter((pin) => pin.id !== id)
        : [...prev, candidate]
    );
  }, []);

  const requestGlobalPin = useCallback(
    async (trackRef: TrackReferenceOrPlaceholder | null) => {
      if (!roomId) return;
      try {
        if (trackRef) {
          await authorizedRequest(`/api/v1/meetings/${roomId}/global-pin`, {
            method: "POST",
            body: JSON.stringify({
              participantId: trackRef.participant.identity,
              trackSource: trackRef.source === Track.Source.Camera ? "Camera" : "ScreenShare",
            }),
          });
        } else {
          await authorizedRequest(`/api/v1/meetings/${roomId}/global-pin`, {
            method: "DELETE",
          });
        }
      } catch (err) {
        console.error("Failed to update global pin", err);
      }
    },
    [roomId]
  );

  /* --- Rendu ------------------------------------------------------ */

  // Épingler n'a de sens qu'à partir de deux tuiles.
  const canPin = layoutTiles.length > 1;

  const renderSlot = (
    slot: LayoutSlot,
    variant: "main" | "secondary" | "self",
    /** Repère de placement. Absent = repère de la scène. */
    origin?: LayoutRect
  ) => {
    const trackRef = trackById.get(slot.tile.id);
    if (!trackRef) return null;

    const isScreenShare = slot.tile.source === "screenshare";
    // Règle partagée avec le moteur : la tuile marquée « épinglée » est
    // exactement celle que le moteur a élue. Voir `pinMatchesTile`.
    const isPinnedLocally = pins.local.some((pin) => pinMatchesTile(pin, slot.tile));

    // Dans un conteneur de défilement, les tuiles se placent relativement à
    // la fenêtre du bandeau, pas à la scène.
    const rect: LayoutRect = origin
      ? {
          x: slot.rect.x - origin.x,
          y: slot.rect.y - origin.y,
          w: slot.rect.w,
          h: slot.rect.h,
        }
      : slot.rect;

    return (
      <div
        // Clé stable par tuile : quand une tuile passe de secondaire à
        // principale (épinglage, orateur actif), React DÉPLACE l'élément au
        // lieu de le remonter — la vidéo ne se coupe pas et la transition
        // de géométrie s'anime.
        key={slot.tile.id}
        style={rectToStyle(rect)}
        className={
          variant === "self"
            ? "animate-self-view-in absolute z-20"
            : "absolute transition-[left,top,width,height] duration-200 ease-out"
        }
      >
        <ParticipantTile
          trackRef={trackRef}
          isLocal={slot.tile.isLocal}
          isScreenShare={isScreenShare}
          isPinned={isPinnedLocally}
          globalPinnedTrack={globalPinnedTrackObj}
          onTogglePin={togglePin}
          onRequestGlobalPin={requestGlobalPin}
          isHost={isHostFlag}
          fill
          // Épinglage : DESKTOP UNIQUEMENT.
          //
          // Sur mobile, l'épingle est retirée — pas seulement son bouton : le
          // menu « Pour moi uniquement / Pour tous les participants » n'est
          // ouvrable que depuis ce bouton, donc ne plus l'afficher suffit à
          // supprimer toute action tactile d'épinglage. Le bouton est en
          // position absolue, il ne réservait de toute façon aucune place.
          //
          // `isMobile` vaut vrai aussi pour un téléphone en PAYSAGE depuis que
          // `useIsMobile` tient compte du tactile : auparavant, un 844 × 390
          // repassait au-dessus du seuil de 640 px et faisait réapparaître
          // l'épingle au moment même de la rotation.
          //
          // Le système d'épingle lui-même reste entier (`togglePin`,
          // `requestGlobalPin`, `useGlobalPin`) : il continue de fonctionner
          // sur desktop, et la vignette locale y reste épinglable comme
          // n'importe quelle autre.
          //
          // Une épingle GLOBALE posée depuis un poste desktop continue, elle,
          // de s'appliquer sur mobile : c'est une décision de réunion, pas une
          // préférence d'affichage local.
          showPinButton={canPin && !isMobile}
          radius={variant === "main" ? "2xl" : "xl"}
          className="h-full w-full"
        />
      </div>
    );
  };

  // Le défilement ne concerne QUE le bandeau secondaire. La scène conserve
  // son `overflow-hidden` : elle ne devient jamais scrollable.
  const stripScrollClass = layout.stripScrolls
    ? layout.strip === "row"
      ? "strip-scroll overflow-x-auto overflow-y-hidden"
      : "strip-scroll overflow-y-auto overflow-x-hidden"
    : "overflow-hidden";

  return (
    <div ref={stageRef} className="relative h-full w-full overflow-hidden">
      {layout.main && renderSlot(layout.main, "main")}

      {/* Bandeau secondaire. Ses bornes viennent du moteur ; il défile dans
          son propre axe dès que `stripScrolls` signale un débordement. */}
      {stripWindow ? (
        <div
          style={rectToStyle(stripWindow)}
          className={`absolute transition-[left,top,width,height] duration-200 ease-out overscroll-contain ${stripScrollClass}`}
        >
          {layout.secondary.map((slot) => renderSlot(slot, "secondary", stripWindow))}
        </div>
      ) : (
        layout.secondary.map((slot) => renderSlot(slot, "secondary"))
      )}

      {layout.selfView && renderSlot(layout.selfView, "self")}
    </div>
  );
}
