import { useState } from "react";
import {
  Check,
  Mic,
  MicOff,
  UserX,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import {
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
} from "@livekit/components-react";
import {
  muteParticipant,
  removeParticipant,
  approveLobbyRequest,
  rejectLobbyRequest,
  type LobbyRequestItem,
} from "../lib/meetingApi";
import { getAvatarColor } from "../lib/avatarColor";
import { useToast } from "./ToastProvider";

interface ParticipantsPanelProps {
  onClose: () => void;
  roomId: string;
  isHost: boolean;
  lobbyRequests: LobbyRequestItem[];
  onLobbyRespond: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   Composant principal
   ═══════════════════════════════════════════════════════════════ */
export function ParticipantsPanel({
  onClose,
  roomId,
  isHost,
  lobbyRequests,
  onLobbyRespond,
}: ParticipantsPanelProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { pushToast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function handleMute(userId: string, name: string) {
    setPendingAction(userId);
    try {
      await muteParticipant(roomId, userId);
      pushToast(`Micro de ${name} coupé.`);
    } catch {
      pushToast("Impossible de couper ce micro.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemove(userId: string, name: string) {
    setPendingAction(userId);
    try {
      await removeParticipant(roomId, userId);
      pushToast(`${name} a été retiré de la réunion.`);
    } catch {
      pushToast("Impossible de retirer ce participant.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleApproveLobby(requestId: string, name: string) {
    setPendingAction(requestId);
    try {
      await approveLobbyRequest(requestId);
      pushToast(`${name} a été accepté.`);
      onLobbyRespond();
    } catch {
      pushToast("Impossible d'accepter cette demande.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRejectLobby(requestId: string, name: string) {
    setPendingAction(requestId);
    try {
      await rejectLobbyRequest(requestId);
      pushToast(`${name} a été refusé.`);
      onLobbyRespond();
    } catch {
      pushToast("Impossible de refuser cette demande.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <aside className="fixed inset-x-0 top-0 bottom-16 z-40 flex h-auto w-full flex-col bg-[#0f0f0f] sm:static sm:bottom-auto sm:z-auto sm:h-full sm:w-80">
      {/* Header */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/5 px-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-white">Participants</h2>
          <span className="flex h-5 items-center rounded-full bg-white/10 px-2 text-[11px] font-medium text-white/60">
            {participants.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-thin">
        {/* ═════ Salle d'attente ═════ */}
        {isHost && lobbyRequests.length > 0 && (
          <div className="m-3 overflow-hidden rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03]">
            <div className="flex items-center gap-2 px-3.5 py-2.5">
              <span className="text-xs font-semibold text-yellow-500">
                Salle d'attente
              </span>
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-bold text-black">
                {lobbyRequests.length}
              </span>
            </div>
            <div className="divide-y divide-yellow-500/5">
              {lobbyRequests.map((request) => (
                <LobbyRequestRow
                  key={request.id}
                  request={request}
                  isPending={pendingAction === request.id}
                  onApprove={() => handleApproveLobby(request.id, request.name)}
                  onReject={() => handleRejectLobby(request.id, request.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ═════ Liste participants ═════ */}
        <ul className="space-y-0.5 p-2">
          {participants.map((participant) => (
            <ParticipantRow
              key={participant.identity}
              participant={participant}
              isLocal={participant.identity === localParticipant?.identity}
              canModerate={
                isHost && participant.identity !== localParticipant?.identity
              }
              isPending={pendingAction === participant.identity}
              onMute={(id, name) => handleMute(id, name)}
              onRemove={(id, name) => handleRemove(id, name)}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sous-composants
   ═══════════════════════════════════════════════════════════════ */

function LobbyRequestRow({
  request,
  isPending,
  onApprove,
  onReject,
}: {
  request: LobbyRequestItem;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const initials = request.name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
        style={{ backgroundColor: getAvatarColor(request.userId) }}
      >
        {initials}
      </div>
      <span className="flex-1 truncate text-sm font-medium text-white/90">
        {request.name}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onApprove}
          disabled={isPending}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/15 text-green-400 transition-colors hover:bg-green-500 hover:text-white disabled:opacity-40"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={isPending}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function ParticipantRow({
  participant,
  isLocal,
  canModerate,
  isPending,
  onMute,
  onRemove,
}: {
  participant: any;
  isLocal: boolean;
  canModerate: boolean;
  isPending: boolean;
  onMute: (id: string, name: string) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const displayName = participant.name || participant.identity;
  const initials = displayName.trim().slice(0, 1).toUpperCase() || "?";
  const color = getAvatarColor(participant.identity);

  return (
    <li className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-black transition-shadow ${
            isSpeaking
              ? "ring-2 ring-green-400 ring-offset-2 ring-offset-[#0f0f0f]"
              : ""
          }`}
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        {isSpeaking && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0f0f0f] bg-green-500" />
        )}
      </div>

      {/* Infos */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-white">
            {displayName}
          </span>
          {isLocal && (
            <span className="rounded-full bg-white/10 px-1.5 py-0 text-[10px] font-medium text-white/50">
              Vous
            </span>
          )}
        </div>
        {isSpeaking && (
          <span className="text-[11px] font-medium text-green-400">
            En train de parler…
          </span>
        )}
      </div>

      {/* États + Actions */}
      <div className="flex items-center gap-0.5">
        {/* Micro */}
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            !participant.isMicrophoneEnabled
              ? "bg-red-500/10 text-red-400"
              : "text-white/25"
          }`}
        >
          {participant.isMicrophoneEnabled ? (
            <Mic size={13} />
          ) : (
            <MicOff size={13} />
          )}
        </div>

        {/* Caméra */}
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            !participant.isCameraEnabled
              ? "text-white/15"
              : "text-white/25"
          }`}
        >
          {participant.isCameraEnabled ? (
            <Video size={13} />
          ) : (
            <VideoOff size={13} />
          )}
        </div>

        {/* Actions modération */}
        {canModerate && (
          <div className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {participant.isMicrophoneEnabled && (
              <button
                type="button"
                onClick={() => onMute(participant.identity, displayName)}
                disabled={isPending}
                title="Couper le micro"
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                <MicOff size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(participant.identity, displayName)}
              disabled={isPending}
              title="Retirer"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30"
            >
              <UserX size={13} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}