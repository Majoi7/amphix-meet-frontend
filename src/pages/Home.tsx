import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Video } from "lucide-react";
import { createRoom } from "../lib/api";

export function Home() {
  const navigate = useNavigate();
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-meet-bg px-4">
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
  );
}
