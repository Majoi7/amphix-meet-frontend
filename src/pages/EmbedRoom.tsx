import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { setAccessToken } from "../lib/tokenStore";
import { RoomPage } from "./Room";

/**
 * Point d'entrée "lien magique" pour l'intégration Amphix :
 * /embed/room/:roomId?token=... Le token (access token JWT classique, avec
 * une durée de vie étendue jusqu'à la fin de la séance) est injecté
 * directement en mémoire, puis on réutilise RoomPage tel quel — aucun
 * écran de login, aucun compte Amphix Meet visible pour l'utilisateur.
 * Le token est retiré de l'URL tout de suite après lecture.
 */
export function EmbedRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "ready" | "error">("pending");

  useEffect(() => {
    if (status !== "pending") return;
    const token = searchParams.get("token");
    if (!token || !roomId) {
      setStatus("error");
      return;
    }
    setAccessToken(token);
    setStatus("ready");
    navigate(`/embed/room/${roomId}`, { replace: true });
  }, [status, roomId, searchParams, navigate]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-meet-bg px-4 text-center text-white">
        Ce lien de réunion est invalide ou incomplet.
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-meet-bg">
        <Loader2 size={28} className="animate-spin text-meet-blue" />
      </div>
    );
  }

  return <RoomPage />;
}