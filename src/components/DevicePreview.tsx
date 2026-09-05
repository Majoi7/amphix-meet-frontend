import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useMediaPreview } from "../hooks/useMediaDevices";
import { getAvatarColor } from "../lib/avatarColor";

interface DevicePreviewProps {
  displayName: string;
  avatarUrl?: string;                 // ← ajouté
  identity?: string;                  // ← nouveau

  onDeviceStateChange: (state: { micEnabled: boolean; cameraEnabled: boolean }) => void;
}

/**
 * Aperçu caméra/micro affiché avant de rejoindre la réunion. Donne
 * immédiatement une impression de produit professionnel — l'utilisateur
 * voit à quoi il ressemblera avant d'entrer dans la salle.
 */
export function DevicePreview({ displayName, avatarUrl, identity, onDeviceStateChange }: DevicePreviewProps) {
  const { videoRef, micEnabled, cameraEnabled, toggleMic, toggleCamera, error } =
    useMediaPreview();

  function handleToggleMic() {
    toggleMic();
    onDeviceStateChange({ micEnabled: !micEnabled, cameraEnabled });
  }

  function handleToggleCamera() {
    toggleCamera();
    onDeviceStateChange({ micEnabled, cameraEnabled: !cameraEnabled });
  }

  const initials = displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className="w-full max-w-xl">
        <div className="relative aspect-video w-full overflow-hidden rounded-tile bg-meet-tile shadow-lg">
        {cameraEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-medium text-meet-bg"
                style={{ backgroundColor: getAvatarColor(identity ?? displayName) }}
              >
                {initials}
              </div>
            )}
        
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
          <button
            type="button"
            onClick={handleToggleMic}
            aria-pressed={!micEnabled}
            aria-label={micEnabled ? "Couper le micro" : "Activer le micro"}
            className={`control-btn ${!micEnabled ? "control-btn-active" : ""}`}
          >
            {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            type="button"
            onClick={handleToggleCamera}
            aria-pressed={!cameraEnabled}
            aria-label={cameraEnabled ? "Couper la caméra" : "Activer la caméra"}
            className={`control-btn ${!cameraEnabled ? "control-btn-active" : ""}`}
          >
            {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-meet-yellow">
          {error}
        </p>
      )}
    </div>
  );
}
