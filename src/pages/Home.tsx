import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Loader2, Video } from "lucide-react";
import { createRoom } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRoom() {
    setIsCreating(true);
    setError(null);
    try {
      const { roomId } = await createRoom();
      navigate(`/room/${roomId}`);
    } catch {
      setError("Impossible de créer la réunion. Vérifie que le serveur est démarré.");
      setIsCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/room/${code}`);
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-meet-bg px-4">
      {/* Bandeau utilisateur — minimal pour l'instant, deviendra le vrai
          dashboard en Phase 4 */}
      <div className="flex items-center justify-end gap-3 py-4">
        {user && (
          <span className="text-sm text-meet-text-secondary">
            Bonjour, <span className="text-meet-text-primary">{user.name}</span>
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Se déconnecter"
          className="flex items-center gap-1.5 rounded-full border border-meet-border px-3 py-1.5 text-xs text-meet-text-secondary transition-colors hover:bg-meet-bg-secondary hover:text-meet-text-primary"
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-meet-blue">
              <Video size={24} className="text-meet-bg" />
            </div>
            <h1 className="text-2xl font-medium text-meet-text-primary">Amphix Meet</h1>
          </div>

          <p className="mb-8 text-center text-meet-text-secondary">
            Des visioconférences simples et sécurisées, pour tous vos échanges.
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-meet-blue px-6 py-3 text-sm font-medium text-meet-bg transition-colors hover:bg-meet-blue-hover disabled:opacity-60"
            >
              {isCreating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Video size={18} />
              )}
              Nouvelle réunion
            </button>

            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Entrer un code de réunion"
                className="flex-1 rounded-full border border-meet-border bg-meet-bg-secondary px-5 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="rounded-full border border-meet-border px-5 py-3 text-sm font-medium text-meet-text-primary transition-colors hover:bg-meet-bg-secondary disabled:opacity-40"
              >
                Rejoindre
              </button>
            </form>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-center text-sm text-meet-yellow">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}