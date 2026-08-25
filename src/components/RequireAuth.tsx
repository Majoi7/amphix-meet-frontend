import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Enveloppe une route protégée. Pendant la vérification de session
 * (appel silencieux à /refresh au chargement de l'app), affiche un
 * loader plutôt que de flasher la page de login puis rediriger.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-meet-bg">
        <Loader2 size={28} className="animate-spin text-meet-blue" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
