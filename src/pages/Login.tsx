import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-6">
      {/* Desktop Background */}
      <div
        className="absolute inset-0 -z-20 hidden md:block"
        style={{
          backgroundImage: "url('/img1.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Mobile Background */}
      <div
        className="absolute inset-0 -z-20 md:hidden"
        style={{
          backgroundImage: "url('/img2.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Warm yellow overlay */}
      <div className="absolute inset-0 -z-10 bg-[#E89B00]/20" />

      {/* Soft dark gradient for readability */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/5 via-black/10 to-black/30" />

      <div className="w-full max-w-[340px] sm:max-w-[360px]">
        {/* Logo */}
        <div className="mb-4 flex flex-col items-center sm:mb-5">
          <div
            className="
              mb-3 flex h-11 w-11 items-center justify-center
              rounded-[16px]
              border border-white/70
              bg-gradient-to-br from-[#FFD83D] to-[#F5A900]
              shadow-[0_10px_28px_rgba(120,70,0,0.30)]
            "
          >
            <img
              src="/favicon.svg"
              alt="Amphix Meet"
              className="h-6 w-6 object-contain"
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-lg sm:text-2xl">
            Amphix Meet
          </h1>

          <p className="mt-0.5 text-xs font-medium text-white/90 drop-shadow sm:text-sm">
            Connectez-vous à vos réunions
          </p>
        </div>

        {/* Login Panel */}
        <form
          onSubmit={handleSubmit}
          className="
            relative overflow-hidden
            rounded-[22px]
            border border-white/70
            bg-[#FFF8E7]/90
            p-5
            shadow-[0_20px_60px_rgba(92,55,0,0.35)]
            backdrop-blur-2xl
            sm:p-6
          "
        >
          {/* Decorative glow */}
          <div
            className="
              pointer-events-none absolute -right-16 -top-16
              h-28 w-28 rounded-full
              bg-[#FFD43B]/30 blur-3xl
            "
          />

          <div
            className="
              pointer-events-none absolute -bottom-16 -left-16
              h-28 w-28 rounded-full
              bg-[#F5A900]/20 blur-3xl
            "
          />

          <div className="relative space-y-3 sm:space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-semibold text-[#3A2A16] sm:text-sm"
              >
                Adresse email
              </label>

              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="
                  w-full rounded-[12px]
                  border border-gray-200
                  bg-white/80
                  px-4 py-2.5
                  text-sm text-[#2B2115]
                  placeholder:text-[#A89570]
                  shadow-[0_2px_8px_rgba(120,80,0,0.05)]
                  outline-none
                  transition-all duration-200
                  focus:border-[#F2B600]
                  focus:bg-white
                  focus:ring-4
                  focus:ring-[#FFC928]/20
                "
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-semibold text-[#3A2A16] sm:text-sm"
              >
                Mot de passe
              </label>

              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="
                  w-full rounded-[12px]
                  border border-gray-200
                  bg-white/80
                  px-4 py-2.5
                  text-sm text-[#2B2115]
                  placeholder:text-[#A89570]
                  shadow-[0_2px_8px_rgba(120,80,0,0.05)]
                  outline-none
                  transition-all duration-200
                  focus:border-[#F2B600]
                  focus:bg-white
                  focus:ring-4
                  focus:ring-[#FFC928]/20
                "
              />
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="
                flex w-full items-center justify-center gap-2
                rounded-[12px]
                bg-gradient-to-r from-[#FFC928] to-[#F5A900]
                px-6 py-2.5
                text-sm font-bold text-[#2B2115]
                shadow-[0_6px_16px_rgba(220,145,0,0.30)]
                transition-all duration-200
                hover:-translate-y-[1px]
                hover:from-[#FFD43B]
                hover:to-[#FFB300]
                hover:shadow-[0_10px_22px_rgba(220,145,0,0.40)]
                active:translate-y-0
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {isSubmitting && (
                <Loader2 size={16} className="animate-spin" />
              )}

              {isSubmitting ? "Connexion..." : "Se connecter"}
            </button>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="
                  rounded-xl
                  border border-red-200
                  bg-red-50
                  px-4 py-2.5
                  text-center
                  text-xs font-medium text-red-600
                  sm:text-sm
                "
              >
                {error}
              </div>
            )}
          </div>

          {/* Bottom separator */}
          <div className="relative my-4 flex items-center gap-3 sm:my-5">
            <div className="h-px flex-1 bg-[#E6D3A5]" />
            <span className="text-[10px] font-medium text-[#9A8259] sm:text-xs">
              OU
            </span>
            <div className="h-px flex-1 bg-[#E6D3A5]" />
          </div>

          {/* Register */}
          <p className="relative text-center text-xs text-[#765D35] sm:text-sm">
            Pas encore de compte ?{" "}
            <Link
              to="/register"
              className="
                font-bold text-[#C27D00]
                underline underline-offset-4
                transition-colors
                hover:text-[#8F5D00]
              "
            >
              Créer un compte
            </Link>
          </p>
        </form>

       
      </div>
    </div>
  );
}