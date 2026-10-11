import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Video } from "lucide-react";
import { DevicePreview } from "../components/DevicePreview";
import { useAuth } from "../context/AuthContext";
import { resolveAvatar } from "../lib/avatarColor";
import { useDashboardTheme } from "./admin/context/DashboardThemeContext";
import type { DevicePreferences } from "../types";
import "../styles/theme.css";
import "./prejoin.css";

interface PreJoinProps {
  onJoin: (prefs: DevicePreferences) => Promise<void>;
  isJoining: boolean;
  error: string | null;
}

export function PreJoin({ onJoin, isJoining, error }: PreJoinProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resolved } = useDashboardTheme();
  const [deviceState, setDeviceState] = useState({ micEnabled: true, cameraEnabled: true });

  if (!roomId) {
    navigate("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onJoin(deviceState);
  }

  // Même règle et même clé de couleur (`user.id`) que dans la réunion :
  // la personne garde la même couleur avant et après l'entrée.
  const avatar = resolveAvatar({
    identity: user?.id ?? "",
    name: user?.name,
    imageUrl: user?.avatarUrl,
  });

  return (
    <div className="app-theme pj-root" data-theme={resolved}>
      <div className="pj-glow" aria-hidden="true" />

      <div className="pj-preview">
        <DevicePreview
          displayName={user?.name ?? ""}
          avatarUrl={user?.avatarUrl ?? undefined}
          identity={user?.id ?? ""}
          onDeviceStateChange={setDeviceState}
        />
      </div>

      <form onSubmit={handleSubmit} className="pj-card">
        <div className="pj-head">
          <span className="pj-ico">
            <Video size={20} aria-hidden="true" />
          </span>
          <p className="pj-ask">
            Prêt à rejoindre <span className="pj-code">{roomId}</span> ?
          </p>
        </div>

        <div className="pj-user">
          {avatar.photoUrl ? (
            <img
              src={avatar.photoUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="pj-avatar"
            />
          ) : (
            <span className="pj-avatar pj-avatar-fb" style={{ backgroundColor: avatar.color }}>
              {avatar.initials}
            </span>
          )}
          <p className="pj-user-text">
            Connecté en tant que <strong>{user?.name}</strong>
          </p>
        </div>

        <button type="submit" disabled={isJoining} className="pj-join">
          {isJoining && <Loader2 size={18} className="pj-spin" />}
          Rejoindre
        </button>

        {error && (
          <p role="alert" className="pj-error">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}