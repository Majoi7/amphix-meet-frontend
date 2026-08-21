import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Video } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiClientError } from "../lib/authApi";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await register({ email, password, name, role });
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setError("Cette adresse email est déjà utilisée.");
      } else {
        setError("Impossible de créer le compte. Réessaie.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-meet-bg px-4 py-10">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-meet-blue">
            <Video size={24} className="text-meet-bg" />
          </div>
          <h1 className="text-2xl font-medium text-meet-text-primary">Amphix Meet</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm text-meet-text-secondary">
              Nom complet
            </label>
            <input
              id="name"
              type="text"
              required
              autoFocus
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-meet-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-meet-text-secondary">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
            />
            <p className="mt-1 text-xs text-meet-text-disabled">8 caractères minimum</p>
          </div>

          <div>
            <span className="mb-1.5 block text-sm text-meet-text-secondary">Je suis…</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole("STUDENT")}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  role === "STUDENT"
                    ? "border-meet-blue bg-meet-blue/10 text-meet-blue"
                    : "border-meet-border text-meet-text-secondary hover:bg-meet-bg-secondary"
                }`}
              >
                Étudiant
              </button>
              <button
                type="button"
                onClick={() => setRole("TEACHER")}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  role === "TEACHER"
                    ? "border-meet-blue bg-meet-blue/10 text-meet-blue"
                    : "border-meet-border text-meet-text-secondary hover:bg-meet-bg-secondary"
                }`}
              >
                Enseignant
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-meet-blue px-6 py-3 text-sm font-medium text-meet-bg transition-colors hover:bg-meet-blue-hover disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Créer mon compte
          </button>

          {error && (
            <p role="alert" className="text-center text-sm text-meet-yellow">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-meet-text-secondary">
          Déjà un compte ?{" "}
          <Link to="/login" className="text-meet-blue hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}