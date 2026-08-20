import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Video } from "lucide-react";
import { DevicePreview } from "../components/DevicePreview";
import type { DevicePreferences } from "../types";

interface PreJoinProps {
  onJoin: (prefs: DevicePreferences) => Promise<void>;
  isJoining: boolean;
  error: string | null;
}

/**
 * Écran affiché avant d'entrer dans la réunion : nom, aperçu caméra/micro,
 * puis bouton "Rejoindre". Sépare volontairement le choix du nom et des
 * appareils de la logique de connexion à LiveKit (dans Room.tsx).
 */
export function PreJoin({ onJoin, isJoining, error }: PreJoinProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [deviceState, setDeviceState] = useState({ micEnabled: true, cameraEnabled: true });

  if (!roomId) {
    navigate("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onJoin({ participantName: trimmed, ...deviceState });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-meet-bg px-4 py-10 lg:flex-row lg:gap-16">
      <DevicePreview displayName={name} onDeviceStateChange={setDeviceState} />

      <form onSubmit={handleSubmit} className="w-full max-w-sm animate-slide-up">
        <div className="mb-6 flex items-center gap-2">
          <Video size={20} className="text-meet-blue" />
          <span className="text-sm text-meet-text-secondary">
            Prêt à rejoindre <span className="font-mono text-meet-text-primary">{roomId}</span> ?
          </span>
        </div>

        <label htmlFor="participant-name" className="mb-1.5 block text-sm text-meet-text-secondary">
          Votre nom
        </label>
        <input
          id="participant-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. Jehovaly"
          maxLength={50}
          autoFocus
          className="mb-4 w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
        />

        <button
          type="submit"
          disabled={!name.trim() || isJoining}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-meet-green px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-meet-green-hover disabled:opacity-50"
        >
          {isJoining && <Loader2 size={18} className="animate-spin" />}
          Rejoindre
        </button>

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-meet-yellow">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
