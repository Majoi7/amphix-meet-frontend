import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LiveKitRoom,
  useParticipants,
  useChat,
  StartAudio,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Hand } from "lucide-react";
import { joinMeeting, getLobbyStatus, endMeeting as endMeetingApi } from "../lib/meetingApi";
import { PreJoin } from "./PreJoin";
import { WaitingForApproval } from "../components/WaitingForApproval";
import { VideoGrid } from "../components/VideoGrid";
import { Whiteboard } from "../components/Whiteboard";
import { MeetControls } from "../components/MeetControls";
import { ParticipantsPanel } from "../components/ParticipantsPanel";
import { ChatPanel } from "../components/ChatPanel";
import { ChatNotification } from "../components/ChatNotification";
import { ToastProvider } from "../components/ToastProvider";
import { useParticipantNotifications } from "../hooks/useParticipantNotifications";
import { useLobbyRequests } from "../hooks/useLobbyRequests";
import { useHandRaise } from "../hooks/useHandRaise";
import { useHandRaiseSound } from "../hooks/useHandRaiseSound";
import type { DevicePreferences } from "../types";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { useReactions } from "../hooks/useReactions";
import { ReactionOverlay } from "../components/ReactionOverlay";
import { useIsMobile } from "../hooks/useIsMobile";
type PanelState = "none" | "chat" | "participants";
const LOBBY_POLL_INTERVAL_MS = 3000;

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
        if (result.waiting) {
          setWaitingLobbyId(result.lobbyRequestId);
        } else {
          setConnection({
            token: result.token,
            livekitUrl: result.livekitUrl,
            micEnabled: prefs.micEnabled,
            cameraEnabled: prefs.cameraEnabled,
            isHost: result.role === "HOST",
            endsAt: result.endsAt,
          });
        }
      } catch {
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

  function handleLeave() {
    localStorage.removeItem(`amphix-chat-${roomId}`);
    setConnection(null);
    if (hadErrorRef.current) {
      hadErrorRef.current = false;
      return;
    }
    navigate("/");
  }

  /** Hôte uniquement — coupe réellement la réunion pour tout le monde
   * côté serveur (LiveKit + DB), même si les 3h ne sont pas atteintes.
   * On quitte localement dans tous les cas, même si l'appel échoue :
   * le disconnect LiveKit (onDisconnected → handleLeave) prendra le
   * relais si la room a bien été fermée côté serveur. */
  async function handleEndMeeting() {
    if (!roomId) return;
    try {
      await endMeetingApi(roomId);
    } catch (err) {
      console.error("[RoomPage] Erreur lors de la fermeture de la réunion:", err);
    } finally {
      handleLeave();
    }
  }

  function handleRoomError(err: Error) {
    console.error("[LiveKitRoom] Erreur de connexion:", err);
    hadErrorRef.current = true;
    setConnection(null);
    setError(
      "La connexion à la réunion a été interrompue de façon inattendue. Réessaie de rejoindre."
    );
  }

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
      onDisconnected={handleLeave}
      onError={handleRoomError}
      className="h-screen overflow-hidden"
      data-lk-theme="default"
    >
      <MeetingLayout
        roomId={roomId}
        isHost={connection.isHost}
        onLeave={handleLeave}
        onEndMeeting={handleEndMeeting}
      />
      <RoomAudioRenderer />
      <StartAudio label="Cliquer pour activer le son" />
    </LiveKitRoom>
  );
}

interface MeetingLayoutProps {
  roomId: string;
  isHost: boolean;
  onLeave: () => void;
  onEndMeeting: () => void;
}

function MeetingLayout({ roomId, isHost, onLeave, onEndMeeting }: MeetingLayoutProps) {
  return (
    <ToastProvider>
      <MeetingLayoutInner
        roomId={roomId}
        isHost={isHost}
        onLeave={onLeave}
        onEndMeeting={onEndMeeting}
      />
    </ToastProvider>
  );
}

function MeetingLayoutInner({ roomId, isHost, onLeave, onEndMeeting }: MeetingLayoutProps) {
  const [panel, setPanel] = useState<PanelState>("none");
  const [lastReadCount, setLastReadCount] = useState(0);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [meetingStartTime] = useState(() => Date.now());
  const [controlsVisible, setControlsVisible] = useState(true);
  const handleScreenTap = () => {
  setControlsVisible(prev => !prev);
};
  const participants = useParticipants();
  const { chatMessages } = useChat();
  const { requests: lobbyRequests, refresh: refreshLobby } = useLobbyRequests(roomId, isHost);

// Dans ton composant :
  const { raisedHands, isHandRaised, toggleHand } = useHandRaise();
  const playHandSound = useHandRaiseSound();
  const { reactions, sendReaction } = useReactions();
  const isMobile = useIsMobile();

  const handleToggleHand = () => {
    toggleHand();
    playHandSound();
  };

  useParticipantNotifications();

  const unreadChatCount =
    panel === "chat" ? 0 : Math.max(0, chatMessages.length - lastReadCount);

  function togglePanel(next: PanelState) {
    setPanel((current) => {
      const nextPanel = current === next ? "none" : next;
      if (nextPanel === "chat") setLastReadCount(chatMessages.length);
      return nextPanel;
    });
  }


  return (
    <div className="flex h-full flex-col overflow-hidden bg-meet-bg">
      {/* PLUS DE HEADER — la vidéo commence tout en haut */}
       {/* Bannière de connexion (reconnexion, perdue, rétablie) */}
      <ConnectionBanner />

<div className={`flex min-h-0 flex-1 overflow-hidden ${isMobile ? "" : "pb-16 sm:pb-20"}`}>
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
            <VideoGrid />
          )}
        </main>

               {panel === "participants" && !isMobile && (
          <aside className="hidden h-full w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-meet-bg md:block">
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
          <aside className="hidden h-full w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-meet-bg md:block">
            <ChatPanel roomId={roomId} onClose={() => setPanel("none")} />
          </aside>
        )}
      </div>

      {/* Sur mobile, chat/participants s'ouvrent en plein écran plutôt qu'en sidebar */}
      {isMobile && panel !== "none" && (
        <div className="fixed inset-0 z-40 bg-meet-bg">
          {panel === "participants" && (
            <ParticipantsPanel
              onClose={() => setPanel("none")}
              roomId={roomId}
              isHost={isHost}
              lobbyRequests={lobbyRequests}
              onLobbyRespond={refreshLobby}
            />
          )}
          {panel === "chat" && <ChatPanel roomId={roomId} onClose={() => setPanel("none")} />}
        </div>
      )}

      <ReactionOverlay reactions={reactions} />

      {/* Indicateur mains levées */}
           {raisedHands.size > 0 && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 animate-[slide-up_0.2s_ease-out]">
          <div className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur-md shadow-lg">
            <Hand size={14} className="text-yellow-400 flex-shrink-0" />
            <span className="font-medium">
              {Array.from(raisedHands.values()).join(", ")}
            </span>
            <span className="text-white/60">
              {raisedHands.size === 1 ? "a levé la main" : "ont levé la main"}
            </span>
          </div>
        </div>
      )}

      {/* Notifications chat flottantes */}
      <ChatNotification />

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
        onLeave={onLeave}
        onEndMeeting={onEndMeeting}
        controlsVisible={controlsVisible}

      />
    </div>
  );
}