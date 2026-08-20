import { useState } from "react";
import {
  Maximize,
  Mic,
  MicOff,
  Minimize,
  MessageSquare,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import {
  useLocalParticipant,
  useTrackToggle,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { DeviceSettingsMenu, DeviceSettingsToggle } from "./DeviceSettingsMenu";
import { useFullscreen } from "../hooks/useFullscreen";

interface MeetControlsProps {
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  unreadChatCount: number;
  participantCount: number;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeave: () => void;
}

/**
 * Barre de contrôles façon Meet : TROIS zones bien séparées, comme sur la
 * vraie interface —
 *  - gauche : l'heure (desktop uniquement)
 *  - CENTRE : uniquement les vrais contrôles d'appel (micro, caméra,
 *    partage d'écran, quitter) — rien d'autre ne s'y mélange
 *  - droite : icônes secondaires isolées (participants, chat, plein écran),
 *    plus petites, à l'écart du cluster central — comme chat/apps/lock sur
 *    Meet
 */
export function MeetControls({
  isChatOpen,
  isParticipantsOpen,
  unreadChatCount,
  participantCount,
  onToggleChat,
  onToggleParticipants,
  onLeave,
}: MeetControlsProps) {
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  const micToggle = useTrackToggle({ source: Track.Source.Microphone });
  const cameraToggle = useTrackToggle({ source: Track.Source.Camera });
  const screenShareToggle = useTrackToggle({ source: Track.Source.ScreenShare });
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const [openDeviceMenu, setOpenDeviceMenu] = useState<"none" | "mic" | "camera">(
    "none"
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-between bg-transparent px-3 sm:h-20 sm:px-6">
      {openDeviceMenu !== "none" && (
        <DeviceSettingsMenu onClose={() => setOpenDeviceMenu("none")} />
      )}

      {/* Zone gauche — heure */}
      <div className="pointer-events-none hidden w-28 text-xs text-meet-text-secondary sm:block">
        {formatTime(new Date())}
      </div>

      {/* Zone centrale — UNIQUEMENT les contrôles d'appel, comme sur Meet */}
      <div className="pointer-events-auto flex flex-1 items-center justify-center gap-2 sm:gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => micToggle.toggle()}
            aria-pressed={!isMicrophoneEnabled}
            aria-label={isMicrophoneEnabled ? "Couper le micro" : "Activer le micro"}
            className={`control-btn ${!isMicrophoneEnabled ? "control-btn-active" : ""}`}
          >
            {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <div className="absolute -right-1 -top-1">
            <DeviceSettingsToggle
              isOpen={openDeviceMenu === "mic"}
              onToggle={() =>
                setOpenDeviceMenu((current) => (current === "mic" ? "none" : "mic"))
              }
            />
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => cameraToggle.toggle()}
            aria-pressed={!isCameraEnabled}
            aria-label={isCameraEnabled ? "Couper la caméra" : "Activer la caméra"}
            className={`control-btn ${!isCameraEnabled ? "control-btn-active" : ""}`}
          >
            {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <div className="absolute -right-1 -top-1">
            <DeviceSettingsToggle
              isOpen={openDeviceMenu === "camera"}
              onToggle={() =>
                setOpenDeviceMenu((current) => (current === "camera" ? "none" : "camera"))
              }
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => screenShareToggle.toggle()}
          aria-pressed={isScreenShareEnabled}
          aria-label={
            isScreenShareEnabled ? "Arrêter le partage d'écran" : "Partager l'écran"
          }
          className={`control-btn ${isScreenShareEnabled ? "bg-meet-blue text-meet-bg hover:bg-meet-blue-hover" : ""}`}
        >
          {isScreenShareEnabled ? <MonitorX size={20} /> : <MonitorUp size={20} />}
        </button>

        <button
          type="button"
          onClick={onLeave}
          aria-label="Quitter la réunion"
          className="control-btn control-btn-danger ml-1 w-auto flex-shrink-0 gap-2 rounded-full px-5 sm:ml-2 sm:px-6"
        >
          <PhoneOff size={20} />
        </button>
      </div>

      {/* Zone droite — icônes secondaires isolées, à l'écart du cluster central */}
      <div className="pointer-events-auto flex w-28 flex-shrink-0 items-center justify-end gap-1.5 sm:w-40 sm:gap-2">
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          className="hidden h-10 w-10 items-center justify-center rounded-full text-meet-text-secondary transition-colors hover:bg-meet-control hover:text-meet-text-primary sm:flex"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>

        <button
          type="button"
          onClick={onToggleParticipants}
          aria-pressed={isParticipantsOpen}
          aria-label="Afficher les participants"
          className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            isParticipantsOpen
              ? "bg-meet-blue text-meet-bg"
              : "text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
          }`}
        >
          <Users size={18} />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-meet-bg px-1 text-[9px] font-medium text-meet-text-primary ring-1 ring-meet-border">
            {participantCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleChat}
          aria-pressed={isChatOpen}
          aria-label="Afficher le chat"
          className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            isChatOpen
              ? "bg-meet-blue text-meet-bg"
              : "text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
          }`}
        >
          <MessageSquare size={18} />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-meet-red px-1 text-[9px] font-medium text-white">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}