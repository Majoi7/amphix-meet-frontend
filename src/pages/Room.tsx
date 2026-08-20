import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LiveKitRoom,
  useParticipants,
  useChat,
  StartAudio,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { fetchToken } from "../lib/api";
import { PreJoin } from "./PreJoin";
import { RoomHeader } from "../components/RoomHeader";
import { VideoGrid } from "../components/VideoGrid";
import { MeetControls } from "../components/MeetControls";
import { ParticipantsPanel } from "../components/ParticipantsPanel";
import { ChatPanel } from "../components/ChatPanel";
import { ToastProvider } from "../components/ToastProvider";
import { useParticipantNotifications } from "../hooks/useParticipantNotifications";
import type { DevicePreferences } from "../types";

type PanelState = "none" | "chat" | "participants";

interface ConnectionInfo {
  token: string;
  livekitUrl: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
}

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hadErrorRef = useRef(false);

  const handleJoin = useCallback(
    async (prefs: DevicePreferences) => {
      if (!roomId) return;
      setIsJoining(true);
      setError(null);
      try {
        const { token, livekitUrl } = await fetchToken(roomId, prefs.participantName);
        setConnection({
          token,
          livekitUrl,
          micEnabled: prefs.micEnabled,
          cameraEnabled: prefs.cameraEnabled,
        });
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

  function handleLeave() {
    setConnection(null);
    if (hadErrorRef.current) {
      hadErrorRef.current = false;
      return;
    }
    navigate("/");
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
      <MeetingLayout roomId={roomId} onLeave={handleLeave} />
      <StartAudio label="Cliquer pour activer le son" />
    </LiveKitRoom>
  );
}

interface MeetingLayoutProps {
  roomId: string;
  onLeave: () => void;
}

function MeetingLayout({ roomId, onLeave }: MeetingLayoutProps) {
  return (
    <ToastProvider>
      <MeetingLayoutInner roomId={roomId} onLeave={onLeave} />
    </ToastProvider>
  );
}

function MeetingLayoutInner({ roomId, onLeave }: MeetingLayoutProps) {
  const [panel, setPanel] = useState<PanelState>("none");
  const [lastReadCount, setLastReadCount] = useState(0);
  const participants = useParticipants();
  const { chatMessages } = useChat();

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
      {/* Header + bannière : hauteur fixe, jamais compressée */}
      <div className="shrink-0">
        <RoomHeader roomId={roomId} />
      </div>

      {/* Zone centrale : flex-1 prend le reste, min-h-0 bloque le débordement,
          pb-16/pb-20 réserve l'espace des MeetControls (fixed) */}
      <div className="flex min-h-0 flex-1 overflow-hidden pb-16 sm:pb-20">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <VideoGrid />
        </main>

        {panel === "participants" && (
          <aside className="hidden h-full w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-meet-bg md:block">
            <ParticipantsPanel onClose={() => setPanel("none")} />
          </aside>
        )}
        {panel === "chat" && (
          <aside className="hidden h-full w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-meet-bg md:block">
            <ChatPanel onClose={() => setPanel("none")} />
          </aside>
        )}
      </div>

      {/* Barre flottante fixed — ne sort pas du flux visuellement mais
          le padding-bottom ci-dessus garantit que le contenu ne passe jamais derrière */}
      <MeetControls
        isChatOpen={panel === "chat"}
        isParticipantsOpen={panel === "participants"}
        unreadChatCount={unreadChatCount}
        participantCount={participants.length}
        onToggleChat={() => togglePanel("chat")}
        onToggleParticipants={() => togglePanel("participants")}
        onLeave={onLeave}
      />
    </div>
  );
}