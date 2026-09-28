import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LiveKitRoom,
  useParticipants,
  useChat,
  useLocalParticipant,
  StartAudio,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { joinMeeting, getLobbyStatus, endMeeting as endMeetingApi } from "../lib/meetingApi";
import { PreJoin } from "./PreJoin";
import { RoomHeader } from "../components/RoomHeader";
import { VideoGrid } from "../components/VideoGrid";
import { MeetControls } from "../components/MeetControls";
import { ParticipantsPanel } from "../components/ParticipantsPanel";
import { ChatPanel } from "../components/ChatPanel";
import { ToastProvider } from "../components/ToastProvider";
import { WaitingForApproval } from "../components/WaitingForApproval";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { Whiteboard } from "../components/Whiteboard";
import { ChatNotification } from "../components/ChatNotification";
import { HandRaiseNotification } from "../components/HandRaiseNotification";
import { ReactionOverlay } from "../components/ReactionOverlay";
import { Hand } from "lucide-react";
import {
  useParticipantNotifications,
  useLeaveAnnouncement,
} from "../hooks/useParticipantNotifications";
import { useLobbyRequests } from "../hooks/useLobbyRequests";
import { useHandRaise } from "../hooks/useHandRaise";
import { useReactions } from "../hooks/useReactions";
import { useIsMobile } from "../hooks/useIsMobile";
import { playSound, SOUND_HAND_RAISE, SOUND_SORTIE } from "../lib/sounds";
import type { DevicePreferences } from "../types";

const LOBBY_POLL_INTERVAL_MS = 3000;

/**
 * Plafond d'attente de l'annonce de départ.
 *
 * L'annonce part avant la fermeture de la connexion : c'est ce qui permet aux
 * autres participants de savoir que le départ est volontaire. On attend donc
 * sa remise au moteur LiveKit — mais jamais indéfiniment : si le réseau ne
 * répond pas, l'utilisateur doit pouvoir quitter la réunion quand même.
 */
const LEAVE_ANNOUNCE_TIMEOUT_MS = 400;

/**
 * Hauteur du header avant sa première mesure.
 *
 * Elle correspond à la classe `h-14` du header (3,5 rem = 56 px) : la valeur
 * affichée avant l'arrivée du `ResizeObserver` est donc déjà la bonne, et
 * aucun saut de mise en page n'est visible. La mesure réelle prend le relais
 * dès le premier rendu.
 */
const HEADER_FALLBACK_HEIGHT = 56;

/**
 * Hauteur de la barre de contrôle avant sa première mesure.
 *
 * Même principe que le header, avec une nuance : la barre n'a PAS la même
 * hauteur en mobile (`h-24`, 96 px) et en desktop (`h-20`, 80 px). Le repli
 * prend donc la PLUS GRANDE des deux, pour ne jamais être plus petit que la
 * barre réelle : une réserve trop grande se voit à peine le temps d'un rendu,
 * alors qu'une réserve trop petite laisserait la vidéo DERRIÈRE la barre —
 * exactement le défaut qu'on corrige. La hauteur mesurée remplace cette
 * valeur dès le premier rendu de la barre.
 */
const CONTROL_BAR_FALLBACK_HEIGHT = 96;

type PanelState = "none" | "chat" | "participants";

interface ConnectionInfo {
  token: string;
  livekitUrl: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  isHost: boolean;
  endsAt: string | null;
}

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingLobbyId, setWaitingLobbyId] = useState<string | null>(null);
  const hadErrorRef = useRef(false);
  const pendingPrefsRef = useRef<DevicePreferences | null>(null);

  const handleJoin = useCallback(
    async (prefs: DevicePreferences) => {
      if (!roomId) return;
      setIsJoining(true);
      setError(null);
      pendingPrefsRef.current = prefs;
      try {
        const result = await joinMeeting(roomId);
        if (!result.waiting) {
          setConnection({
            token: result.token,
            livekitUrl: result.livekitUrl,
            micEnabled: prefs.micEnabled,
            cameraEnabled: prefs.cameraEnabled,
            isHost: result.role === "HOST",
            endsAt: result.endsAt,
          });
        } else {
          setWaitingLobbyId(result.lobbyRequestId);
        }
      } catch (err) {
        setError(
          "Impossible de rejoindre la réunion. Vérifie ta connexion et réessaie."
        );
      } finally {
        setIsJoining(false);
      }
    },
    [roomId]
  );

  useEffect(() => {
    if (!waitingLobbyId) return;
    let cancelled = false;

    const interval = setInterval(async () => {
      try {
        const status = await getLobbyStatus(waitingLobbyId);
        if (cancelled) return;

        if (status.status === "APPROVED") {
          clearInterval(interval);
          setWaitingLobbyId(null);
          const prefs = pendingPrefsRef.current;
          setConnection({
            token: status.token,
            livekitUrl: status.livekitUrl,
            micEnabled: prefs?.micEnabled ?? true,
            cameraEnabled: prefs?.cameraEnabled ?? true,
            isHost: status.role === "HOST",
            endsAt: status.endsAt,
          });
        } else if (status.status === "REJECTED") {
          clearInterval(interval);
          setWaitingLobbyId(null);
          setError("L'hôte a refusé ta demande de rejoindre la réunion.");
        }
      } catch {
        // erreur réseau ponctuelle
      }
    }, LOBBY_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [waitingLobbyId]);

  /**
   * Ces trois callbacks sont MÉMOÏSÉS, et ce n'est pas cosmétique.
   *
   * `LiveKitRoom` recâble sa connexion dans un effet dont `onError` fait
   * partie des dépendances (`room-Bfb4OWAI.mjs:3933-3940`, tableau
   * `[connect, token, connectOptions, room, onError, serverUrl, …]`). Une
   * fonction redéclarée à chaque rendu change d'identité à chaque rendu :
   * l'effet se relance, `room.connect()` repart, et comme chaque échec
   * WebSocket déclenche un `GET /rtc/v1/validate` (`livekit-client.esm.mjs`
   * `handleConnectionError`) sans aucun backoff — la raison `WebSocket` est
   * absente de la liste `:31847` qui alimente `BackOffStrategy` — le client
   * finit par se faire refuser en 429.
   *
   * `handleRoomError` appelle `setError`, donc elle provoquait elle-même le
   * rendu suivant : le cycle s'entretenait tout seul.
   *
   * Toutes les dépendances réellement lues sont déclarées ; aucune closure
   * périmée n'est introduite.
   */

  /**
   * Sortie de la salle — sans son.
   *
   * Le son de sortie et l'annonce aux autres participants appartiennent au
   * DÉPART VOLONTAIRE, qui est décidé dans `MeetingLayout` : c'est là que se
   * trouvent les boutons « Quitter » et « Terminer ». Ici, on ne fait que
   * libérer la salle, ce qui couvre aussi les sorties subies — erreur,
   * connexion perdue, salle fermée côté serveur — pour lesquelles aucun son
   * ne doit être joué, ni chez nous ni chez les autres.
   */
  const exitRoom = useCallback(() => {
    localStorage.removeItem(`amphix-chat-${roomId}`);

    if (!hadErrorRef.current) {
      setConnection(null);
    }

    if (hadErrorRef.current) {
      hadErrorRef.current = false;
      return;
    }

    navigate("/");
  }, [roomId, navigate]);

  /** Déconnexion SUBIE (erreur, salle fermée côté serveur) : aucun son. */
  const handleDisconnected = useCallback(() => {
    exitRoom();
  }, [exitRoom]);

  const handleRoomError = useCallback((err: Error) => {
    console.error("[LiveKitRoom] Erreur de connexion:", err);
    console.error("[LiveKitRoom] Erreur message:", err.message);
    console.error("[LiveKitRoom] Erreur stack:", err.stack);
    // Try to extract LiveKit specific info if available
    if (err instanceof Object && 'code' in err) {
      console.error("[LiveKitRoom] Erreur code:", (err as any).code);
    }
    if (err instanceof Object && 'reason' in err) {
      console.error("[LiveKitRoom] Erreur reason:", (err as any).reason);
    }
    hadErrorRef.current = true;
    setError(
      "La connexion à la réunion a été interrompue de façon inattendue. Réessaie de rejoindre."
    );
  }, []);

  if (!roomId) {
    navigate("/");
    return null;
  }

  if (waitingLobbyId) {
    return <WaitingForApproval />;
  }

  if (!connection) {
    return <PreJoin onJoin={handleJoin} isJoining={isJoining} error={error} />;
  }

  return (
    <LiveKitRoom
      serverUrl={connection.livekitUrl}
      token={connection.token}
      audio={connection.micEnabled}
      video={connection.cameraEnabled}
      connect
      onDisconnected={handleDisconnected}
      onError={handleRoomError}
      className="app-viewport overflow-hidden"
      data-lk-theme="default"
    >
      <ConnectionBanner />
      <ToastProvider>
        <MeetingLayout
          roomId={roomId}
          isHost={connection.isHost}
          endsAt={connection.endsAt}
          onExitRoom={exitRoom}
        />
      </ToastProvider>
      <RoomAudioRenderer />
      <StartAudio label="Cliquer pour activer le son" />
    </LiveKitRoom>
  );
}

interface MeetingLayoutProps {
  roomId: string;
  isHost: boolean;
  endsAt: string | null;
  /** Libère la salle (navigation, nettoyage) — ne joue aucun son. */
  onExitRoom: () => void;
}

function MeetingLayout({ roomId, isHost, endsAt, onExitRoom }: MeetingLayoutProps) {
  const [panel, setPanel] = useState<PanelState>("none");
  // « Plus d'options » (menu desktop, feuille mobile) est piloté d'ICI, à
  // côté de `panel` : deux états voisins, dans le même composant, ne peuvent
  // pas diverger. Laissé dans MeetControls, il formait un second système
  // d'état que rien ne reliait au panneau ouvert.
  const [moreOpen, setMoreOpen] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [meetingStartTime] = useState(() => Date.now());
  const [controlsVisible, setControlsVisible] = useState(true);
  /**
   * Hauteur RÉELLE du header, mesurée par `RoomHeader` (ResizeObserver).
   *
   * Les panneaux latéraux et la zone vidéo s'appuient dessus au lieu de
   * répéter une constante : c'est la seule façon de garantir que le panneau
   * Participants s'ouvre SOUS le header, et pas dessous par coïncidence.
   */
  const [headerHeight, setHeaderHeight] = useState(HEADER_FALLBACK_HEIGHT);
  const handleHeaderHeight = useCallback((height: number) => {
    setHeaderHeight(height);
  }, []);
  /**
   * Hauteur RÉELLE de la barre de contrôle, mesurée par `MeetControls`.
   *
   * La barre est en `position: fixed` : elle ne prend aucune place dans le
   * flux, et la zone vidéo s'étend donc sous elle. Réserver sa hauteur est la
   * seule façon de garantir que le bas de la grille reste VISIBLE et
   * cliquable. Une valeur mesurée plutôt qu'une marge fixe : le jour où la
   * barre change de hauteur, la réserve suit toute seule.
   */
  const [controlBarHeight, setControlBarHeight] = useState(
    CONTROL_BAR_FALLBACK_HEIGHT
  );
  const handleControlBarHeight = useCallback((height: number) => {
    setControlBarHeight(height);
  }, []);
  const [handRaiseNotifications, setHandRaiseNotifications] = useState<Array<{id: string; name: string}>>([]);
  const lastHandRaiseTimeRef = useRef<Map<string, number>>(new Map());
  const lastSoundPlayRef = useRef<Map<string, number>>(new Map());
  const handleScreenTap = () => {
    setControlsVisible(prev => !prev);
  };
  const participants = useParticipants();
  const { chatMessages } = useChat();
  const { requests: lobbyRequests, refresh: refreshLobby } = useLobbyRequests(roomId, isHost);
  // Participant local lu directement depuis LiveKit : le state miroir
  // intermédiaire provoquait un rendu supplémentaire à chaque changement.
  const { localParticipant } = useLocalParticipant();

  // Dans ton composant :
  const handleHandRaise = useCallback((payload: { identity: string; name: string; raised: boolean }) => {
    // Callback when a hand raise event is received (only for raised hands)
    if (!payload.raised) return;

    const now = Date.now();
    const lastTime = lastHandRaiseTimeRef.current.get(payload.identity) ?? 0;
    // Prevent spam: only allow one notification per identity every 2 seconds
    if (now - lastTime < 2000) {
      return;
    }
    lastHandRaiseTimeRef.current = new Map(lastHandRaiseTimeRef.current).set(payload.identity, now);

    // Play sound for others, not self with deduplication
    if (payload.identity !== localParticipant?.identity) {
      // Check if we've already played sound for this identity recently (to prevent duplicates from same event)
      const lastSoundTime = lastSoundPlayRef.current.get(payload.identity) ?? 0;
      if (now - lastSoundTime > 100) { // Only play if at least 100ms since last sound for this identity
        lastSoundPlayRef.current.set(payload.identity, now);
        // Même module que les sons d'arrivée/départ : une seule politique
        // d'échec pour tous les sons de la réunion.
        playSound(SOUND_HAND_RAISE);
      }
    }

    // Add notification
    setHandRaiseNotifications(prev => [
      ...prev,
      { id: Math.random().toString(36), name: payload.name || payload.identity }
    ]);
  }, [localParticipant]);

  // Les sons d'arrivée et de départ sont joués par `useParticipantNotifications`,
  // qui possède déjà la seule référence fiable de la composition de la
  // réunion. Un second écouteur ici produisait un doublon sur chaque arrivée.

  const { raisedHands, isHandRaised, toggleHand } = useHandRaise(handleHandRaise);
  const { reactions, sendReaction } = useReactions();
  const isMobile = useIsMobile();

  const handleToggleHand = () => {
    toggleHand();
  };

  useParticipantNotifications();

  /**
   * Annonce de départ volontaire, émise par CE participant.
   *
   * Elle doit partir AVANT la fermeture de la connexion : une fois la salle
   * quittée, le message ne passerait plus. C'est ce qui distingue un vrai
   * départ d'une simple disparition — onglet fermé, connexion perdue — pour
   * lesquelles aucun son de sortie ne doit être joué.
   */
  const announceLeave = useLeaveAnnouncement();

  /**
   * Son de sortie — LOCAL, et joué une seule fois.
   *
   * `sortie.mp3` est joué par celui qui part, chez lui ; les autres
   * participants le jouent à la réception de l'annonce (voir
   * `useParticipantNotifications`). Personne ne l'entend donc deux fois. Le
   * verrou couvre en plus le cas où LiveKit rappelle `onDisconnected` derrière
   * un départ volontaire.
   */
  const leaveSoundPlayedRef = useRef(false);
  const playLeaveSoundOnce = useCallback(() => {
    if (leaveSoundPlayedRef.current) return;
    leaveSoundPlayedRef.current = true;
    playSound(SOUND_SORTIE);
  }, []);

  /** Séquence commune : son local, annonce aux autres, puis sortie. */
  const leaveAndAnnounce = useCallback(async () => {
    playLeaveSoundOnce();
    await Promise.race([
      announceLeave(),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, LEAVE_ANNOUNCE_TIMEOUT_MS);
      }),
    ]);
  }, [announceLeave, playLeaveSoundOnce]);

  /** Départ VOLONTAIRE (bouton « Quitter ») : on entend le son de sortie. */
  const handleLeave = useCallback(async () => {
    if (leaveSoundPlayedRef.current) return; // sortie déjà en cours
    await leaveAndAnnounce();
    onExitRoom();
  }, [leaveAndAnnounce, onExitRoom]);

  /**
   * Fin de réunion pour tout le monde : même séquence, puis fermeture côté
   * serveur. Le son et l'annonce partent AVANT l'appel réseau, pour ne pas
   * être coupés avec la page.
   */
  const handleEndMeeting = useCallback(async () => {
    await leaveAndAnnounce();
    try {
      await endMeetingApi(roomId);
    } catch (err) {
      console.error("[RoomPage] Erreur lors de la fermeture de la réunion:", err);
    } finally {
      onExitRoom();
    }
  }, [leaveAndAnnounce, roomId, onExitRoom]);

  const unreadChatCount =
    panel === "chat" ? 0 : Math.max(0, chatMessages.length - lastReadCount);

  function togglePanel(next: PanelState) {
    // Un panneau latéral et le menu « Plus d'options » ne peuvent pas être
    // ouverts en même temps : le menu recouvrirait le panneau, et le panneau
    // recouvrirait le menu. L'exclusion est posée ICI, en un seul endroit,
    // pour les deux sens.
    setMoreOpen(false);
    setPanel((current) => {
      const nextPanel = current === next ? "none" : next;
      if (nextPanel === "chat") setLastReadCount(chatMessages.length);
      return nextPanel;
    });
  }

  function toggleMore() {
    setMoreOpen((current) => {
      if (!current) setPanel("none");
      return !current;
    });
  }

  // Remove notification after it's done animating (handled by the component itself calling onRemove)
  const removeNotification = useCallback((id: string) => {
    setHandRaiseNotifications(prev => prev.filter(n => n.id !== id));
  }, []); // Only depends on stable setHandRaiseNotifications setter

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-meet-bg">
      {/* La bannière de connexion est rendue une seule fois, dans `RoomPage` :
          la dupliquer ici superposait deux bannières `fixed` identiques. */}

      {/* Chrome de réunion flottant, posé par-dessus la vidéo */}
      <RoomHeader
        roomId={roomId}
        endsAt={endsAt}
        participantCount={participants.length}
        onOpenParticipants={() => togglePanel("participants")}
        isParticipantsOpen={panel === "participants"}
        onHeightChange={handleHeaderHeight}
      />

      {/* Le `paddingTop` mesure la hauteur réelle du header : la zone vidéo ET
          les panneaux latéraux commencent donc exactement sous lui. Auparavant
          seul `<main>` compensait (`pt-14`) — les panneaux, eux, démarraient à
          y=0 et leur barre de titre se mélangeait avec le header.

          Le `paddingBottom` mesure la hauteur réelle de la barre de contrôle :
          la zone mesurée par le moteur de layout correspond ainsi exactement à
          l'espace réellement visible. Il remplace un `pb-16 sm:pb-20` qui était
          à la fois fixe — donc faux dès que la barre changeait de taille — et
          ABSENT en mobile (`isMobile ? ""`), où la grille passait donc sous la
          barre. */}
      <div
        className="flex min-h-0 flex-1 overflow-hidden"
        style={{ paddingTop: headerHeight, paddingBottom: controlBarHeight }}
      >
        <main
          className="relative min-w-0 flex-1 overflow-hidden"
          onClick={!isWhiteboardOpen ? handleScreenTap : undefined}
        >
 {isWhiteboardOpen ? (
            <Whiteboard
              roomId={roomId}
              isHost={isHost}
              onClose={() => setIsWhiteboardOpen(false)}
            />
          ) : (
            <VideoGrid roomId={roomId} isHost={isHost} />
          )}
        </main>

        {panel === "participants" && !isMobile && (
          <aside className="h-full w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-meet-bg">
            <ParticipantsPanel
              onClose={() => setPanel("none")}
              roomId={roomId}
              isHost={isHost}
              lobbyRequests={lobbyRequests}
              onLobbyRespond={refreshLobby}
            />
          </aside>
        )}
        {panel === "chat" && !isMobile && (
          <aside className="h-full w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-meet-bg">
            <ChatPanel roomId={roomId} onClose={() => setPanel("none")} />
          </aside>
        )}
      </div>

      {/* Sur mobile, chat/participants s'ouvrent en plein écran plutôt qu'en
          sidebar.

          Cette enveloppe est le SEUL endroit qui positionne les deux panneaux
          mobiles : elle borne la surface entre le bas du header et le haut de
          la barre de contrôle, tous deux MESURÉS. Les panneaux se contentent
          ensuite de la remplir (`h-full`), au lieu de se positionner chacun de
          leur côté — deux systèmes de placement pour la même surface finissent
          toujours par diverger.

          `bottom: controlBarHeight` est ce qui rend le champ de saisie du chat
          accessible : la barre mobile mesure 96 px, alors que le panneau
          s'arrêtait auparavant à `bottom-16` (64 px) et disparaissait donc
          DERRIÈRE elle sur 32 px. */}
      {isMobile && panel !== "none" && (
        <div
          className="fixed inset-x-0 z-40 bg-meet-bg"
          style={{ top: headerHeight, bottom: controlBarHeight }}
        >
          {panel === "participants" && (
            <ParticipantsPanel
              onClose={() => setPanel("none")}
              roomId={roomId}
              isHost={isHost}
              lobbyRequests={lobbyRequests}
              onLobbyRespond={refreshLobby}
            />
          )}
          {panel === "chat" && (
            <ChatPanel roomId={roomId} onClose={() => setPanel("none")} />
          )}
        </div>
      )}

      <ReactionOverlay reactions={reactions} />

      {/* Indicateur mains levées — placé SOUS le chrome de réunion (h-14)
          pour ne jamais recouvrir le compteur, l'horloge ou le bouton
          d'invitation. La pastille est bornée à la largeur de l'écran et la
          liste des noms se tronque : avec dix mains levées, elle débordait
          horizontalement sur mobile. */}
      {raisedHands.size > 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-16 z-20 flex justify-end animate-[slide-up_0.2s_ease-out]">
          <div className="flex min-w-0 max-w-full items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs text-white shadow-lg backdrop-blur-md ring-1 ring-white/10">
            <Hand size={14} className="flex-shrink-0 text-yellow-400" />
            <span className="truncate font-medium">
              {Array.from(raisedHands.values()).join(", ")}
            </span>
            <span className="flex-shrink-0 whitespace-nowrap text-white/60">
              {raisedHands.size === 1 ? "a levé la main" : "ont levé la main"}
            </span>
          </div>
        </div>
      )}

      {/* Notifications chat flottantes */}
      <ChatNotification />

      {/* Hand raise notifications (turtle) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse space-y-3">
        {handRaiseNotifications.map((notification) => (
          <HandRaiseNotification
            key={notification.id}
            id={notification.id}
            name={notification.name}
            onRemove={removeNotification}
          />
        ))}
      </div>

      <MeetControls
        roomId={roomId}
        meetingStartTime={meetingStartTime}
        isChatOpen={panel === "chat"}
        isParticipantsOpen={panel === "participants"}
        isWhiteboardOpen={isWhiteboardOpen}
        isHandRaised={isHandRaised}
        raisedHandsCount={raisedHands.size}
        unreadChatCount={unreadChatCount}
        participantCount={participants.length}
        pendingLobbyCount={lobbyRequests.length}
        isHost={isHost}
        onToggleChat={() => togglePanel("chat")}
        onToggleParticipants={() => togglePanel("participants")}
        onToggleWhiteboard={() => setIsWhiteboardOpen((v) => !v)}
        onToggleHand={handleToggleHand}
        onSendReaction={sendReaction}
        onLeave={handleLeave}
        onEndMeeting={handleEndMeeting}
        isMoreOpen={moreOpen}
        onToggleMore={toggleMore}
        controlsVisible={controlsVisible}
        onBarHeightChange={handleControlBarHeight}
      />
    </div>
  );
}