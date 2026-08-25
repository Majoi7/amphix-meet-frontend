import { useState, useRef, useEffect } from "react";
import {
  useLocalParticipant,
  useTrackToggle,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { DeviceSettingsMenu, DeviceSettingsToggle } from "./DeviceSettingsMenu";
import { useFullscreen } from "../hooks/useFullscreen";

interface MeetControlsProps {
  roomId: string;
  meetingStartTime: number;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isWhiteboardOpen: boolean;
  isHandRaised: boolean;
  raisedHandsCount: number;
  unreadChatCount: number;
  participantCount: number;
  pendingLobbyCount: number;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleWhiteboard: () => void;
  onToggleHand: () => void;
  onLeave: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   Icône Material Symbols Rounded
   ═══════════════════════════════════════════════════════════════ */
function Icon({
  name,
  filled = false,
  className = "",
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-rounded ${filled ? "icon-filled" : ""} ${className}`}
    >
      {name}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Hook temps écoulé
   ═══════════════════════════════════════════════════════════════ */
function useElapsed(start: number) {
  const [elapsed, setElapsed] = useState("00:00");
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
          : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [start]);
  return elapsed;
}

export function MeetControls({
  roomId,
  meetingStartTime,
  isChatOpen,
  isParticipantsOpen,
  isWhiteboardOpen,
  isHandRaised,
  raisedHandsCount,
  unreadChatCount,
  participantCount,
  pendingLobbyCount,
  onToggleChat,
  onToggleParticipants,
  onToggleWhiteboard,
  onToggleHand,
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
  const [showMore, setShowMore] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const elapsed = useElapsed(meetingStartTime);

  /* Fermer le menu "⋯" au clic extérieur */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    }
    if (showMore) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMore]);

  const joinUrl = `${window.location.origin}/room/${roomId}`;
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: "Rejoins ma réunion Amphix Meet",
        text: `Rejoins-moi sur Amphix Meet : ${roomId}`,
        url: joinUrl,
      });
      setShowMore(false);
    } catch {
      // ignore
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex h-[72px] items-center justify-between bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 sm:h-20 sm:px-6">
      {openDeviceMenu !== "none" && (
        <DeviceSettingsMenu onClose={() => setOpenDeviceMenu("none")} />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          GAUCHE — Temps + badge mains levées
          ═══════════════════════════════════════════════════════════════ */}
      <div className="pointer-events-auto flex w-20 items-center gap-2 sm:w-32">
        <span className="text-xs font-medium text-white/70 tabular-nums sm:text-sm">
          {elapsed}
        </span>
        {raisedHandsCount > 0 && (
          <span className="flex h-5 items-center gap-1 rounded-full bg-yellow-500/20 px-2 text-[10px] font-bold text-yellow-400">
            <Icon name="back_hand" className="text-[11px]" />
            {raisedHandsCount}
          </span>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CENTRE — Contrôles principaux (touch-friendly)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="pointer-events-auto flex flex-1 items-center justify-center gap-2 sm:gap-3">
        {/* Micro */}
        <div className="relative">
          <button
            type="button"
            onClick={() => micToggle.toggle()}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-all sm:h-12 sm:w-12 ${
              !isMicrophoneEnabled
                ? "bg-[#ea4335] hover:bg-[#d33426]"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Icon
              name={isMicrophoneEnabled ? "mic" : "mic_off"}
              filled={isMicrophoneEnabled}
              className="text-[20px] sm:text-[22px]"
            />
          </button>
          <div className="absolute -right-1 -top-1">
            <DeviceSettingsToggle
              isOpen={openDeviceMenu === "mic"}
              onToggle={() =>
                setOpenDeviceMenu((c) => (c === "mic" ? "none" : "mic"))
              }
            />
          </div>
        </div>

        {/* Caméra */}
        <div className="relative">
          <button
            type="button"
            onClick={() => cameraToggle.toggle()}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-all sm:h-12 sm:w-12 ${
              !isCameraEnabled
                ? "bg-[#ea4335] hover:bg-[#d33426]"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Icon
              name={isCameraEnabled ? "videocam" : "videocam_off"}
              filled={isCameraEnabled}
              className="text-[20px] sm:text-[22px]"
            />
          </button>
          <div className="absolute -right-1 -top-1">
            <DeviceSettingsToggle
              isOpen={openDeviceMenu === "camera"}
              onToggle={() =>
                setOpenDeviceMenu((c) => (c === "camera" ? "none" : "camera"))
              }
            />
          </div>
        </div>

        {/* Partage d'écran */}
        <button
          type="button"
          onClick={() => screenShareToggle.toggle()}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-all sm:h-12 sm:w-12 ${
            isScreenShareEnabled
              ? "bg-[#8ab4f8] text-black hover:bg-[#aecbfa]"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <Icon
            name={isScreenShareEnabled ? "stop_screen_share" : "present_to_all"}
            filled={isScreenShareEnabled}
            className="text-[20px] sm:text-[22px]"
          />
        </button>

        {/* Main levée */}
        <button
          type="button"
          onClick={onToggleHand}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-all sm:h-12 sm:w-12 ${
            isHandRaised
              ? "bg-yellow-500 text-black hover:bg-yellow-400"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <Icon name="back_hand" filled={isHandRaised} className="text-[20px] sm:text-[22px]" />
        </button>

        {/* Quitter (toujours visible, bien visible) */}
        <button
          type="button"
          onClick={onLeave}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ea4335] text-white transition-all hover:bg-[#d33426] sm:h-12 sm:w-12"
        >
          <Icon name="call_end" filled className="text-[20px] sm:text-[22px]" />
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          DROITE — Participants, Chat, ⋯ (plus d'options)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="pointer-events-auto flex w-auto items-center justify-end gap-1.5 sm:w-40 sm:gap-2">
        {/* Participants */}
        <button
          type="button"
          onClick={onToggleParticipants}
          className={`relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors sm:h-11 sm:w-11 ${
            isParticipantsOpen
              ? "bg-[#8ab4f8] text-black"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <Icon name="group" filled={isParticipantsOpen} className="text-[18px] sm:text-[20px]" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1a1a1a] px-1 text-[9px] font-medium text-white ring-1 ring-white/20">
            {participantCount}
          </span>
          {pendingLobbyCount > 0 && (
            <span className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-yellow-500 ring-1 ring-black" />
          )}
        </button>

        {/* Chat */}
        <button
          type="button"
          onClick={onToggleChat}
          className={`relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors sm:h-11 sm:w-11 ${
            isChatOpen
              ? "bg-[#8ab4f8] text-black"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <Icon name="chat" filled={isChatOpen} className="text-[18px] sm:text-[20px]" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ea4335] px-1 text-[9px] font-medium text-white">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* ⋯ Plus d'options (whiteboard, plein écran, inviter) */}
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors sm:h-11 sm:w-11 ${
              showMore
                ? "bg-white/20"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Icon name="more_vert" className="text-[20px] sm:text-[22px]" />
          </button>

          {showMore && (
            <div className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl bg-[#1a1a1a] p-3 shadow-2xl ring-1 ring-white/10">
              {/* Whiteboard */}
              <button
                type="button"
                onClick={() => {
                  onToggleWhiteboard();
                  setShowMore(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white transition-colors hover:bg-white/5 ${
                  isWhiteboardOpen ? "bg-white/5" : ""
                }`}
              >
                <Icon name="edit_note" filled={isWhiteboardOpen} className="text-[20px]" />
                <span>Tableau blanc</span>
              </button>

              {/* Plein écran */}
              <button
                type="button"
                onClick={() => {
                  toggleFullscreen();
                  setShowMore(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white transition-colors hover:bg-white/5"
              >
                <Icon name={isFullscreen ? "fullscreen_exit" : "fullscreen"} className="text-[20px]" />
                <span>{isFullscreen ? "Quitter le plein écran" : "Plein écran"}</span>
              </button>

              <div className="my-2 border-t border-white/10" />

              {/* Inviter */}
              <div className="px-3 py-2">
                <p className="mb-2 text-xs text-white/50">Lien de la réunion</p>
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <span className="flex-1 truncate font-mono text-xs text-white/70">
                    {joinUrl}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#8ab4f8] px-3 py-2 text-xs font-medium text-black transition-colors hover:bg-[#aecbfa]"
                  >
                    <Icon name={justCopied ? "check" : "content_copy"} className="text-[14px]" />
                    {justCopied ? "Copié !" : "Copier"}
                  </button>
                  {canShare && (
                    <button
                      type="button"
                      onClick={handleShare}
                      className="flex items-center justify-center rounded-full border border-white/10 px-3 py-2 text-white/60 transition-colors hover:bg-white/5"
                    >
                      <Icon name="share" className="text-[14px]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}