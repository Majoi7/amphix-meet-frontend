import { useEffect, useState } from "react";
import { ConnectionState } from "livekit-client";
import { useConnectionState } from "@livekit/components-react";
import { Loader2, WifiOff } from "lucide-react";

/**
 * Bannière discrète en haut de l'écran quand la connexion se dégrade ou se
 * rétablit. LiveKit gère la reconnexion automatique en interne — ce
 * composant se contente de rendre cet état visible pour l'utilisateur,
 * pour qu'il ne pense pas que l'appli est cassée.
 */
export function ConnectionBanner() {
  const state = useConnectionState();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  useEffect(() => {
    if (state === ConnectionState.Reconnecting || state === ConnectionState.Disconnected) {
      setWasDisconnected(true);
    } else if (state === ConnectionState.Connected && wasDisconnected) {
      setShowReconnected(true);
      setWasDisconnected(false);
      const timeout = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [state, wasDisconnected]);

  if (state === ConnectionState.Reconnecting) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-meet-yellow px-4 py-2 text-sm font-medium text-meet-bg animate-fade-in"
      >
        <Loader2 size={16} className="animate-spin" />
        Reconnexion en cours… vos flux audio/vidéo peuvent être coupés momentanément.
      </div>
    );
  }

  if (state === ConnectionState.Disconnected) {
    return (
      <div
        role="alert"
        className="flex items-center justify-center gap-2 bg-meet-red px-4 py-2 text-sm font-medium text-white animate-fade-in"
      >
        <WifiOff size={16} />
        Connexion perdue. Nouvelle tentative en cours…
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-meet-green px-4 py-2 text-sm font-medium text-white animate-fade-in"
      >
        Connexion rétablie.
      </div>
    );
  }

  return null;
}
