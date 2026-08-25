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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-meet-bg px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-meet-blue/20 blur-[130px]" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-meet-green/10 blur-[110px]" />
      </div>

      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-meet-blue to-meet-pink shadow-glow transition-transform duration-300 ease-fluid hover:rotate-6 hover:scale-105">
            <Video size={24} className="text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-white to-meet-text-secondary bg-clip-text text-2xl font-medium text-transparent">
            Amphix Meet
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-meet-border/60 bg-meet-bg-secondary/40 p-6 shadow-panel backdrop-blur-sm sm:p-7"
        >
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
              className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary transition-all duration-200 ease-fluid focus:outline-none focus-visible:border-meet-blue focus-visible:shadow-glow focus-visible:ring-2 focus-visible:ring-meet-blue/40"
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
              className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary transition-all duration-200 ease-fluid focus:outline-none focus-visible:border-meet-blue focus-visible:shadow-glow focus-visible:ring-2 focus-visible:ring-meet-blue/40"
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
              className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary transition-all duration-200 ease-fluid focus:outline-none focus-visible:border-meet-blue focus-visible:shadow-glow focus-visible:ring-2 focus-visible:ring-meet-blue/40"
            />
            <p className="mt-1 text-xs text-meet-text-disabled">8 caractères minimum</p>
          </div>

          <div>
            <span className="mb-1.5 block text-sm text-meet-text-secondary">Je suis…</span>
            <div className="flex gap-2 rounded-lg border border-meet-border bg-meet-bg-secondary p-1">
              <button
                type="button"
                onClick={() => setRole("STUDENT")}
                className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-fluid ${
                  role === "STUDENT"
                    ? "bg-gradient-to-r from-meet-blue to-meet-pink text-white shadow-glow"
                    : "text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
                }`}
              >
                Étudiant
              </button>
              <button
                type="button"
                onClick={() => setRole("TEACHER")}
                className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-fluid ${
                  role === "TEACHER"
                    ? "bg-gradient-to-r from-meet-blue to-meet-pink text-white shadow-glow"
                    : "text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
                }`}
              >
                Enseignant
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-meet-blue to-meet-pink bg-[length:200%_100%] bg-left px-6 py-3 text-sm font-medium text-white shadow-glow transition-all duration-300 ease-fluid hover:scale-[1.02] hover:bg-right active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Créer mon compte
          </button>

          {error && (
            <p role="alert" className="animate-slide-down text-center text-sm text-meet-yellow">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-meet-text-secondary">
          Déjà un compte ?{" "}
          <Link
            to="/login"
            className="font-medium text-meet-blue-soft transition-colors duration-200 hover:text-meet-blue hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}