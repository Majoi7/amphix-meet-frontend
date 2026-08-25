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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-meet-bg px-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-meet-blue/20 blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-meet-pink/10 blur-[110px]" />
      </div>

      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-10 flex items-center justify-center gap-3">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary transition-all duration-200 ease-fluid focus:outline-none focus-visible:border-meet-blue focus-visible:shadow-glow focus-visible:ring-2 focus-visible:ring-meet-blue/40"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-meet-blue to-meet-pink bg-[length:200%_100%] bg-left px-6 py-3 text-sm font-medium text-white shadow-glow transition-all duration-300 ease-fluid hover:scale-[1.02] hover:bg-right active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Se connecter
          </button>

          {error && (
            <p role="alert" className="animate-slide-down text-center text-sm text-meet-yellow">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-meet-text-secondary">
          Pas encore de compte ?{" "}
          <Link
            to="/register"
            className="font-medium text-meet-blue-soft transition-colors duration-200 hover:text-meet-blue hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}