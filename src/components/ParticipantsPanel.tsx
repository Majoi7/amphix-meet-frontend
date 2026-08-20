import { Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { useParticipants, useLocalParticipant } from "@livekit/components-react";

interface ParticipantsPanelProps {
  onClose: () => void;
}

/**
 * Panneau latéral listant tous les participants présents dans la salle,
 * avec l'état de leur micro et caméra en un coup d'œil.
 */
export function ParticipantsPanel({ onClose }: ParticipantsPanelProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  return (
    <aside className="fixed inset-x-0 top-0 bottom-16 z-40 flex h-auto w-full flex-col border-l border-meet-border bg-meet-bg-secondary sm:static sm:bottom-auto sm:z-auto sm:h-full sm:w-80">      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-meet-border px-4">
        <h2 className="text-sm font-medium">Participants ({participants.length})</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le panneau des participants"
          className="rounded p-1.5 text-meet-text-secondary hover:bg-meet-control"
        >
          <X size={18} />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {participants.map((participant) => {
          const isLocal = participant.identity === localParticipant.identity;
          const displayName = participant.name || participant.identity;
          const initials = displayName.trim().slice(0, 1).toUpperCase() || "?";

          return (
            <li
              key={participant.identity}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-meet-control"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-meet-blue text-sm font-medium text-meet-bg">
                {initials}
              </div>
              <span className="flex-1 truncate text-sm">
                {displayName}
                {isLocal && <span className="text-meet-text-secondary"> (vous)</span>}
              </span>
              <span className="flex items-center gap-1.5 text-meet-text-secondary">
                {participant.isMicrophoneEnabled ? (
                  <Mic size={16} />
                ) : (
                  <MicOff size={16} className="text-meet-red" />
                )}
                {participant.isCameraEnabled ? (
                  <Video size={16} />
                ) : (
                  <VideoOff size={16} className="opacity-50" />
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
