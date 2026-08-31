import { useState, useRef, useEffect } from "react";
import {
  useLocalParticipant,
  useTrackToggle,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { DeviceSettingsMenu, DeviceSettingsToggle } from "./DeviceSettingsMenu";
import { EmojiPicker } from "./EmojiPicker";
import { useFullscreen } from "../hooks/useFullscreen";
import { useIsMobile } from "../hooks/useIsMobile";

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
  onSendReaction: (emoji: string) => void;
  onLeave: () => void;
  /** Mobile uniquement — contrôle l'affichage/masquage auto de la barre. */
  controlsVisible?: boolean;
}

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
    <span className={`material-symbols-rounded ${filled ? "icon-filled" : ""} ${className}`}>
      {name}
    </span>
  );
}

function SwirlIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={i}
          x="10.9"
          y="2"
          width="2.2"
          height="7.6"
          rx="1.1"
          fill="currentColor"
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}

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

export function MeetControls(props: MeetControlsProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileControls {...props} /> : <DesktopControls {...props} />;
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE — 4 boutons, apparition/disparition sur tap écran
   ═══════════════════════════════════════════════════════════════ */
function MobileControls({
  roomId,
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
  onSendReaction,
  onLeave,
  controlsVisible = true,
}: MeetControlsProps) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();
  const micToggle = useTrackToggle({ source: Track.Source.Microphone });
  const cameraToggle = useTrackToggle({ source: Track.Source.Camera });
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [showSheet, setShowSheet] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  // Quand la barre se cache (inactivité), on referme aussi les popups ouverts.
  useEffect(() => {
    if (!controlsVisible) {
      setShowSheet(false);
      setShowEmojiPicker(false);
    }
  }, [controlsVisible]);

  const joinUrl = `${window.location.origin}/room/${roomId}`;
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const hasNotification = unreadChatCount > 0 || pendingLobbyCount > 0;

  async function handleFlipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    try {
      await localParticipant.setCameraEnabled(true, { facingMode: next });
    } catch {
      setFacingMode(facingMode);
    }
  }

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
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 flex h-24 items-center justify-center gap-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 transition-transform duration-300 ease-out ${
          controlsVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Micro */}
        <button
          type="button"
          onClick={() => micToggle.toggle()}
          className={`pointer-events-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white transition-all ${
            !isMicrophoneEnabled ? "bg-[#ea4335] hover:bg-[#d33426]" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <Icon name={isMicrophoneEnabled ? "mic" : "mic_off"} filled={isMicrophoneEnabled} className="text-[22px]" />
        </button>

        {/* Caméra + retournement */}
        <div className="pointer-events-auto relative flex-shrink-0">
          <button
            type="button"
            onClick={() => cameraToggle.toggle()}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition-all ${
              !isCameraEnabled ? "bg-[#ea4335] hover:bg-[#d33426]" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Icon name={isCameraEnabled ? "videocam" : "videocam_off"} filled={isCameraEnabled} className="text-[22px]" />
          </button>
          {isCameraEnabled && (
            <button
              type="button"
              onClick={handleFlipCamera}
              aria-label="Changer de caméra"
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#1a1a1a] text-white ring-1 ring-white/20 transition-colors hover:bg-black"
            >
              <Icon name="flip_camera_ios" className="text-[13px]" />
            </button>
          )}
        </div>

        {/* Réactions — le picker ne se ferme que via ce bouton */}
        <div className="pointer-events-auto relative flex-shrink-0">
          {showEmojiPicker && (
            <EmojiPicker
              isHandRaised={isHandRaised}
              onToggleHand={onToggleHand}
              onSendReaction={onSendReaction}
              className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2"
            />
          )}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              showEmojiPicker || isHandRaised
                ? "bg-yellow-500 text-black hover:bg-yellow-400"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Icon name="mood" filled={showEmojiPicker || isHandRaised} className="text-[22px]" />
            {raisedHandsCount > 0 && !isHandRaised && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500 px-1 text-[9px] font-bold text-black">
                {raisedHandsCount}
              </span>
            )}
          </button>
        </div>

        {/* Bouton "plus d'options" */}
        <button
          type="button"
          onClick={() => setShowSheet(true)}
          aria-label="Plus d'options"
          className="pointer-events-auto relative ml-3 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285f4] to-[#1a5fd6] text-white shadow-[0_4px_20px_rgba(66,133,244,0.55)] transition-transform duration-200 ease-fluid hover:scale-105 active:scale-95"
        >
          <SwirlIcon className="h-7 w-7" />
          {hasNotification && (
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[#ea4335] ring-2 ring-[#0b0b0b]" />
          )}
        </button>
      </div>

      {showSheet && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl bg-[#1a1a1a] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl ring-1 ring-white/10">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
            <div className="max-h-[70vh] overflow-y-auto px-3">
              <SheetItem
                icon="chat"
                filled={isChatOpen}
                label="Chat"
                badge={unreadChatCount > 0 ? unreadChatCount : undefined}
                onClick={() => {
                  onToggleChat();
                  setShowSheet(false);
                }}
              />
              <SheetItem
                icon="group"
                filled={isParticipantsOpen}
                label="Participants"
                badge={participantCount}
                dot={pendingLobbyCount > 0}
                onClick={() => {
                  onToggleParticipants();
                  setShowSheet(false);
                }}
              />
              <SheetItem
                icon="edit_note"
                filled={isWhiteboardOpen}
                label="Tableau blanc"
                onClick={() => {
                  onToggleWhiteboard();
                  setShowSheet(false);
                }}
              />
              <SheetItem
                icon={isFullscreen ? "fullscreen_exit" : "fullscreen"}
                label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
                onClick={() => {
                  toggleFullscreen();
                  setShowSheet(false);
                }}
              />

              <div className="my-2 border-t border-white/10" />

              <div className="px-2 py-2">
                <p className="mb-2 text-xs text-white/50">Lien de la réunion</p>
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <span className="flex-1 truncate font-mono text-xs text-white/70">{joinUrl}</span>
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

              <div className="my-2 border-t border-white/10" />

              <button
                type="button"
                onClick={onLeave}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ea4335] px-3 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#d33426]"
              >
                <Icon name="call_end" filled className="text-[20px]" />
                Quitter l'appel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SheetItem({
  icon,
  filled,
  label,
  badge,
  dot,
  onClick,
}: {
  icon: string;
  filled?: boolean;
  label: string;
  badge?: number;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-sm text-white transition-colors hover:bg-white/5"
    >
      <Icon name={icon} filled={filled} className="text-[22px]" />
      <span>{label}</span>
      {badge !== undefined && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] font-medium text-white/70">
          {badge}
        </span>
      )}
      {dot && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-yellow-500" />}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP — le picker ne se ferme plus au clic sur un emoji
   ═══════════════════════════════════════════════════════════════ */
function DesktopControls({
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
  onSendReaction,
  onLeave,
}: MeetControlsProps) {
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();

  const micToggle = useTrackToggle({ source: Track.Source.Microphone });
  const cameraToggle = useTrackToggle({ source: Track.Source.Camera });
  const screenShareToggle = useTrackToggle({ source: Track.Source.ScreenShare });
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const [openDeviceMenu, setOpenDeviceMenu] = useState<"none" | "mic" | "camera">("none");
  const [showMore, setShowMore] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const elapsed = useElapsed(meetingStartTime);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex h-20 items-center justify-between bg-gradient-to-t from-black/80 via-black/50 to-transparent px-6">
      {openDeviceMenu !== "none" && <DeviceSettingsMenu onClose={() => setOpenDeviceMenu("none")} />}

      <div className="pointer-events-auto flex w-32 items-center gap-2">
        <span className="text-sm font-medium text-white/70 tabular-nums">{elapsed}</span>
        {raisedHandsCount > 0 && (
          <span className="flex h-5 items-center gap-1 rounded-full bg-yellow-500/20 px-2 text-[10px] font-bold text-yellow-400">
            <Icon name="back_hand" className="text-[11px]" />
            {raisedHandsCount}
          </span>
        )}
      </div>

      <div className="pointer-events-auto flex flex-1 items-center justify-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => micToggle.toggle()}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition-all ${
              !isMicrophoneEnabled ? "bg-[#ea4335] hover:bg-[#d33426]" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Icon name={isMicrophoneEnabled ? "mic" : "mic_off"} filled={isMicrophoneEnabled} className="text-[22px]" />
          </button>
          <div className="absolute -right-1 -top-1">
            <DeviceSettingsToggle
              isOpen={openDeviceMenu === "mic"}
              onToggle={() => setOpenDeviceMenu((c) => (c === "mic" ? "none" : "mic"))}
            />
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => cameraToggle.toggle()}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition-all ${
              !isCameraEnabled ? "bg-[#ea4335] hover:bg-[#d33426]" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Icon name={isCameraEnabled ? "videocam" : "videocam_off"} filled={isCameraEnabled} className="text-[22px]" />
          </button>
          <div className="absolute -right-1 -top-1">
            <DeviceSettingsToggle
              isOpen={openDeviceMenu === "camera"}
              onToggle={() => setOpenDeviceMenu((c) => (c === "camera" ? "none" : "camera"))}
            />
          </div>
        </div>

        <div className="relative">
          {showEmojiPicker && (
            <EmojiPicker
              isHandRaised={isHandRaised}
              onToggleHand={onToggleHand}
              onSendReaction={onSendReaction}
              className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2"
            />
          )}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              showEmojiPicker || isHandRaised
                ? "bg-yellow-500 text-black hover:bg-yellow-400"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Icon name="mood" filled={showEmojiPicker || isHandRaised} className="text-[22px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ea4335] text-white transition-all hover:bg-[#d33426]"
        >
          <Icon name="call_end" filled className="text-[22px]" />
        </button>
      </div>

      <div className="pointer-events-auto flex w-32 items-center justify-end gap-2">
        <button
          type="button"
          onClick={onToggleChat}
          className={`relative flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${
            isChatOpen ? "bg-[#8ab4f8] text-black" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <Icon name="chat" filled={isChatOpen} className="text-[20px]" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ea4335] px-1 text-[9px] font-medium text-white">
              {unreadChatCount}
            </span>
          )}
        </button>

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${
              showMore ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Icon name="more_vert" className="text-[22px]" />
          </button>

          {showMore && (
            <div className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl bg-[#1a1a1a] p-2 shadow-2xl ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => {
                  screenShareToggle.toggle();
                  setShowMore(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white transition-colors hover:bg-white/5 ${
                  isScreenShareEnabled ? "bg-white/5" : ""
                }`}
              >
                <Icon
                  name={isScreenShareEnabled ? "stop_screen_share" : "present_to_all"}
                  filled={isScreenShareEnabled}
                  className="text-[20px]"
                />
                <span>{isScreenShareEnabled ? "Arrêter le partage" : "Partager l'écran"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleParticipants();
                  setShowMore(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white transition-colors hover:bg-white/5 ${
                  isParticipantsOpen ? "bg-white/5" : ""
                }`}
              >
                <Icon name="group" filled={isParticipantsOpen} className="text-[20px]" />
                <span>Participants</span>
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] font-medium text-white/70">
                  {participantCount}
                </span>
                {pendingLobbyCount > 0 && <span className="absolute right-5 h-2 w-2 rounded-full bg-yellow-500" />}
              </button>

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

              <div className="px-3 py-2">
                <p className="mb-2 text-xs text-white/50">Lien de la réunion</p>
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <span className="flex-1 truncate font-mono text-xs text-white/70">{joinUrl}</span>
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