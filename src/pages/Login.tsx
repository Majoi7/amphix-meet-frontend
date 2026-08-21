import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Video } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch {
      setError("Email ou mot de passe incorrect.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-meet-bg px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-10 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-meet-blue">
            <Video size={24} className="text-meet-bg" />
          </div>
          <h1 className="text-2xl font-medium text-meet-text-primary">Amphix Meet</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-meet-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-meet-blue px-6 py-3 text-sm font-medium text-meet-bg transition-colors hover:bg-meet-blue-hover disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Se connecter
          </button>

          {error && (
            <p role="alert" className="text-center text-sm text-meet-yellow">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-meet-text-secondary">
          Pas encore de compte ?{" "}
          <Link to="/register" className="text-meet-blue hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}