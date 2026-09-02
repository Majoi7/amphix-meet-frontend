import { useState } from "react";
import { Track } from "livekit-client";
import {
  useTracks,
  useLocalParticipant,
} from "@livekit/components-react";
import { ParticipantTile } from "./ParticipantTile";
import { useIsMobile } from "../hooks/useIsMobile";

export function VideoGrid() {
  const isMobile = useIsMobile();
  const { localParticipant } = useLocalParticipant();
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShareTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);

  // Ordre STABLE — on ne trie plus par "qui parle en ce moment" : ça
  // faisait sauter les tuiles de position à chaque prise de parole.
  // Pour mettre quelqu'un en avant, on utilise désormais l'épingle
  // (bouton sur la tuile) plutôt qu'un tri automatique.
  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);

  function togglePin(identity: string) {
    setPinnedIdentity((current) => (current === identity ? null : identity));
  }

  // Si la personne épinglée quitte la réunion ou coupe sa caméra, on se
  // rabat proprement sur la grille plutôt que d'afficher un spotlight vide.
  const pinnedTrack = pinnedIdentity
    ? cameraTracks.find((t) => t.participant.identity === pinnedIdentity)
    : undefined;

  // ═════ Screen share garde son propre layout — prioritaire sur l'épingle ═════
  if (screenShareTrack) {
    return isMobile ? (
      <ScreenShareMobileLayout screenShareTrack={screenShareTrack} cameraTracks={cameraTracks} />
    ) : (
      <ScreenShareDesktopLayout screenShareTrack={screenShareTrack} cameraTracks={cameraTracks} />
    );
  }

  // ═════ Spotlight — quelqu'un est épinglé ═════
  if (pinnedTrack) {
    const others = cameraTracks.filter((t) => t.participant.identity !== pinnedIdentity);
    return isMobile ? (
      <PinnedMobileLayout pinnedTrack={pinnedTrack} others={others} onTogglePin={togglePin} />
    ) : (
      <PinnedDesktopLayout pinnedTrack={pinnedTrack} others={others} onTogglePin={togglePin} />
    );
  }

  const count = cameraTracks.length;
  const localIdentity = localParticipant?.identity;

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Comportement Google Meet
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    if (count === 1) {
      return (
        <div className="flex h-full w-full items-center justify-center p-3">
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-meet-tile">
            <ParticipantTile
              trackRef={cameraTracks[0]}
              isLocal={cameraTracks[0].participant.isLocal}
              className="h-full w-full"
            />
          </div>
        </div>
      );
    }

    if (count === 2) {
      const other =
        cameraTracks.find((t) => t.participant.identity !== localIdentity) || cameraTracks[0];
      const me = cameraTracks.find((t) => t.participant.identity === localIdentity);

      return (
        <div className="relative h-full w-full bg-black">
          <div className="h-full w-full">
            <ParticipantTile
              trackRef={other}
              isLocal={other.participant.isLocal}
              onTogglePin={() => togglePin(other.participant.identity)}
              className="h-full w-full"
            />
          </div>

          {me && (
            <div className="absolute bottom-20 right-3 z-10 h-32 w-24 overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:h-36 sm:w-28">
              <ParticipantTile trackRef={me} isLocal className="h-full w-full" />
            </div>
          )}
        </div>
      );
    }

    if (count <= 4) {
      return (
        <div className="flex h-full w-full flex-col gap-1.5 p-1.5">
          {cameraTracks.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="relative flex-1 overflow-hidden rounded-2xl bg-black"
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                onTogglePin={() => togglePin(trackRef.participant.identity)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      );
    }

    const [first, ...rest] = cameraTracks;

    return (
      <div className="flex h-full w-full flex-col gap-1.5 p-1.5">
        <div className="relative h-[55%] overflow-hidden rounded-2xl bg-black">
          <ParticipantTile
            trackRef={first}
            isLocal={first.participant.isLocal}
            onTogglePin={() => togglePin(first.participant.identity)}
            className="h-full w-full"
          />
        </div>

        <div className="flex h-[45%] gap-2 overflow-x-auto overflow-y-hidden pb-1 snap-x snap-mandatory">
          {rest.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="h-full flex-shrink-0 snap-start overflow-hidden rounded-xl bg-black"
              style={{ aspectRatio: "3/4" }}
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                onTogglePin={() => togglePin(trackRef.participant.identity)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP
     Disposition en lignes fixes (pas une grille CSS auto) : 2→1 ligne
     de 2, 3→1 ligne de 3, 4→2 lignes de 2, 5→3 haut/2 bas, 6→3/3.
     Au-delà de 6, on garde 5 vraies tuiles + un gros indicateur "+N"
     à la dernière position (toujours 3 haut / 3 bas au total).
     ═══════════════════════════════════════════════════════════════ */
  if (count === 1) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 sm:p-10">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] bg-meet-tile shadow-2xl aspect-video">
          <ParticipantTile
            trackRef={cameraTracks[0]}
            isLocal={cameraTracks[0].participant.isLocal}
            className="h-full w-full"
          />
        </div>
      </div>
    );
  }

  const { rows, tileSize, overflowCount } = getDesktopRows(count);
  let trackIndex = 0;

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="flex flex-col gap-1 sm:gap-1.5">
        {rows.map((rowLength, rowIdx) => (
          <div key={rowIdx} className="flex gap-1 sm:gap-1.5">
            {Array.from({ length: rowLength }).map((_, cellIdx) => {
              const isLastCell =
                rowIdx === rows.length - 1 && cellIdx === rowLength - 1;

              if (isLastCell && overflowCount > 0) {
                return (
                  <div
                    key="overflow"
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-meet-tile"
                    style={{ width: tileSize, height: tileSize }}
                  >
                    <span className="text-3xl font-semibold text-white sm:text-4xl">
                      +{overflowCount}
                    </span>
                  </div>
                );
              }

              const trackRef = cameraTracks[trackIndex];
              trackIndex += 1;
              return (
                <div
                  key={trackRef.participant.identity}
                  className="aspect-square overflow-hidden rounded-2xl"
                  style={{ width: tileSize, height: tileSize }}
                >
                  <ParticipantTile
                    trackRef={trackRef}
                    isLocal={trackRef.participant.isLocal}
                    className="h-full w-full"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Détermine la disposition en lignes fixes + la taille des tuiles selon
 * le nombre de participants. Contrairement à une grille CSS classique,
 * on contrôle explicitement combien de tuiles par ligne pour respecter
 * la règle métier (3/2/2+2/3+2/3+3) plutôt que de laisser le navigateur
 * décider. Au-delà de 6, les tuiles en trop sont remplacées par un seul
 * indicateur "+N" à la dernière position.
 */
function getDesktopRows(count: number): {
  rows: number[];
  tileSize: number;
  overflowCount: number;
} {
  const overflowCount = count > 6 ? count - 5 : 0;
  const visibleTotal = overflowCount > 0 ? 6 : count; // 5 vraies tuiles + 1 indicateur = 6

  const sizeByTotal: Record<number, number> = {
    2: 280,
    3: 240,
    4: 220,
    5: 200,
    6: 180,
  };
  const tileSize = sizeByTotal[visibleTotal] ?? 160;

  let rows: number[];
  switch (visibleTotal) {
    case 2:
      rows = [2];
      break;
    case 3:
      rows = [3];
      break;
    case 4:
      rows = [2, 2];
      break;
    case 5:
      rows = [3, 2];
      break;
    case 6:
      rows = [3, 3];
      break;
    default:
      rows = [visibleTotal];
  }

  return { rows, tileSize, overflowCount };
}

/* ═══════════════════════════════════════════════════════════════
   Layouts Screen Share
   ═══════════════════════════════════════════════════════════════ */

interface ScreenShareLayoutProps {
  screenShareTrack: ReturnType<typeof useTracks>[number];
  cameraTracks: ReturnType<typeof useTracks>;
}

function ScreenShareDesktopLayout({ screenShareTrack, cameraTracks }: ScreenShareLayoutProps) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
      <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-xl">
        <ParticipantTile trackRef={screenShareTrack} isScreenShare className="h-full w-full" />
      </div>

      {cameraTracks.length > 0 && (
        <div className="flex h-full w-28 flex-shrink-0 flex-col gap-2 overflow-y-auto sm:w-32">
          {cameraTracks.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="aspect-video w-full flex-shrink-0 overflow-hidden rounded-xl"
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenShareMobileLayout({ screenShareTrack, cameraTracks }: ScreenShareLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden p-2">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
        <ParticipantTile trackRef={screenShareTrack} isScreenShare className="h-full w-full" />
      </div>

      {cameraTracks.length > 0 && (
        <div className="flex h-16 flex-shrink-0 gap-2 overflow-x-auto">
          {cameraTracks.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="aspect-video h-full flex-shrink-0 overflow-hidden rounded-lg"
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Layouts Épingle (spotlight) — même structure que le partage d'écran,
   mais avec le participant épinglé en grand et un bouton pour
   désépingler directement sur sa tuile.
   ═══════════════════════════════════════════════════════════════ */

interface PinnedLayoutProps {
  pinnedTrack: ReturnType<typeof useTracks>[number];
  others: ReturnType<typeof useTracks>;
  onTogglePin: (identity: string) => void;
}

function PinnedDesktopLayout({ pinnedTrack, others, onTogglePin }: PinnedLayoutProps) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
      <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-xl">
        <ParticipantTile
          trackRef={pinnedTrack}
          isLocal={pinnedTrack.participant.isLocal}
          isPinned
          onTogglePin={() => onTogglePin(pinnedTrack.participant.identity)}
          className="h-full w-full"
        />
      </div>

      {others.length > 0 && (
        <div className="flex h-full w-28 flex-shrink-0 flex-col gap-2 overflow-y-auto sm:w-32">
          {others.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="aspect-video w-full flex-shrink-0 overflow-hidden rounded-xl"
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                onTogglePin={() => onTogglePin(trackRef.participant.identity)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PinnedMobileLayout({ pinnedTrack, others, onTogglePin }: PinnedLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden p-2">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
        <ParticipantTile
          trackRef={pinnedTrack}
          isLocal={pinnedTrack.participant.isLocal}
          isPinned
          onTogglePin={() => onTogglePin(pinnedTrack.participant.identity)}
          className="h-full w-full"
        />
      </div>

      {others.length > 0 && (
        <div className="flex h-16 flex-shrink-0 gap-2 overflow-x-auto">
          {others.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="aspect-video h-full flex-shrink-0 overflow-hidden rounded-lg"
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                onTogglePin={() => onTogglePin(trackRef.participant.identity)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}