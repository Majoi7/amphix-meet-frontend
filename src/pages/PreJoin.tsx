import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Video } from "lucide-react";
import { DevicePreview } from "../components/DevicePreview";
import { useAuth } from "../context/AuthContext";
import type { DevicePreferences } from "../types";

interface PreJoinProps {
  onJoin: (prefs: DevicePreferences) => Promise<void>;
  isJoining: boolean;
  error: string | null;
}

/**
 * Écran affiché avant d'entrer dans la réunion : aperçu caméra/micro, puis
 * bouton "Rejoindre". Phase 2 — le nom vient maintenant du compte
 * authentifié (plus de saisie manuelle, tout le monde est connecté).
 */
export function PreJoin({ onJoin, isJoining, error }: PreJoinProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deviceState, setDeviceState] = useState({ micEnabled: true, cameraEnabled: true });

  if (!roomId) {
    navigate("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onJoin(deviceState);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-meet-bg px-4 py-10 lg:flex-row lg:gap-16">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-meet-blue/15 blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-meet-green/10 blur-[120px]" />
      </div>

      <div className="animate-scale-in">
        <DevicePreview
          displayName={user?.name ?? ""}
          onDeviceStateChange={setDeviceState}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm animate-slide-up rounded-2xl border border-meet-border/60 bg-meet-bg-secondary/40 p-6 shadow-panel backdrop-blur-sm"
      >
        <div className="mb-6 flex items-center gap-2">
          <Video size={20} className="text-meet-blue-soft" />
          <span className="text-sm text-meet-text-secondary">
            Prêt à rejoindre{" "}
            <span className="rounded-md bg-meet-bg-secondary px-1.5 py-0.5 font-mono text-meet-text-primary">
              {roomId}
            </span>{" "}
            ?
          </span>
        </div>

        <p className="mb-4 text-sm text-meet-text-secondary">
          Connecté en tant que{" "}
          <span className="font-medium text-meet-text-primary">{user?.name}</span>
        </p>

        <button
          type="submit"
          disabled={isJoining}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-meet-green to-meet-blue bg-[length:200%_100%] bg-left px-6 py-3 text-sm font-medium text-white shadow-glow-green transition-all duration-300 ease-fluid hover:scale-[1.02] hover:bg-right active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
        >
          {isJoining && <Loader2 size={18} className="animate-spin" />}
          Rejoindre
        </button>

        {error && (
          <p role="alert" className="mt-4 animate-slide-down text-center text-sm text-meet-yellow">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}