import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-2">
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

      <div className="w-full max-w-[340px]">
        {/* Logo */}
        <div className="mb-2 flex flex-col items-center">
          <div
            className="
              mb-2 flex h-10 w-10 items-center justify-center
              rounded-[14px]
              border border-white/70
              bg-gradient-to-br from-[#FFD83D] to-[#F5A900]
              shadow-[0_8px_24px_rgba(120,70,0,0.30)]
              transition-all duration-300
              hover:-translate-y-1
              hover:rotate-3
              hover:scale-105
            "
          >
            <img
              src="/favicon.svg"
              alt="Amphix Meet"
              className="h-5 w-5 object-contain"
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-lg">
            Amphix Meet
          </h1>
        </div>

        {/* Register Panel */}
        <form
          onSubmit={handleSubmit}
          className="
            relative overflow-hidden
            rounded-[20px]
            border border-white/70
            bg-[#FFF8E7]/90
            p-4
            shadow-[0_16px_48px_rgba(92,55,0,0.35)]
            backdrop-blur-2xl
          "
        >
          {/* Decorative glow - top right */}
          <div
            className="
              pointer-events-none absolute -right-12 -top-12
              h-24 w-24 rounded-full
              bg-[#FFD43B]/30
              blur-3xl
            "
          />

          {/* Decorative glow - bottom left */}
          <div
            className="
              pointer-events-none absolute -bottom-12 -left-12
              h-24 w-24 rounded-full
              bg-[#F5A900]/20
              blur-3xl
            "
          />

          {/* Header */}
          <div className="relative mb-3">
            <h2 className="text-base font-bold text-[#2B2115]">
              Créer un compte
            </h2>

            <p className="mt-0.5 text-xs text-[#765D35]">
              Quelques informations pour commencer.
            </p>
          </div>

          <div className="relative space-y-2.5">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-xs font-semibold text-[#3A2A16]"
              >
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
                placeholder="Votre nom complet"
                className="
                  w-full rounded-[10px]
                  border border-gray-300
                  bg-white
                  px-4 py-2
                  text-sm text-black
                  placeholder:text-gray-400
                  shadow-sm
                  outline-none
                  transition-all duration-200
                  focus:border-gray-400
                  focus:ring-4
                  focus:ring-gray-900/5
                "
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-semibold text-[#3A2A16]"
              >
                Adresse email
              </label>

              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="
                  w-full rounded-[10px]
                  border border-gray-300
                  bg-white
                  px-4 py-2
                  text-sm text-black
                  placeholder:text-gray-400
                  shadow-sm
                  outline-none
                  transition-all duration-200
                  focus:border-gray-400
                  focus:ring-4
                  focus:ring-gray-900/5
                "
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-semibold text-[#3A2A16]"
              >
                Mot de passe
              </label>

              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="
                  w-full rounded-[10px]
                  border border-gray-300
                  bg-white
                  px-4 py-2
                  text-sm text-black
                  placeholder:text-gray-400
                  shadow-sm
                  outline-none
                  transition-all duration-200
                  focus:border-gray-400
                  focus:ring-4
                  focus:ring-gray-900/5
                "
              />

              <p className="mt-0.5 text-[10px] text-[#9A8259]">
                8 caractères minimum
              </p>
            </div>

            {/* Role */}
            <div>
              <span className="mb-1 block text-xs font-semibold text-[#3A2A16]">
                Je suis…
              </span>

              <div
                className="
                  flex gap-1
                  rounded-[10px]
                  border border-gray-200
                  bg-[#F7EBCF]/70
                  p-1
                "
              >
                {/* Student */}
                <button
                  type="button"
                  onClick={() => setRole("STUDENT")}
                  className={`
                    flex-1 rounded-[8px]
                    px-3 py-1.5
                    text-xs font-semibold
                    transition-all duration-200
                    ${
                      role === "STUDENT"
                        ? `
                          bg-gradient-to-r
                          from-[#FFC928]
                          to-[#F5A900]
                          text-[#2B2115]
                          shadow-[0_4px_12px_rgba(220,145,0,0.25)]
                        `
                        : `
                          text-[#765D35]
                          hover:bg-white/70
                          hover:text-[#3A2A16]
                        `
                    }
                  `}
                >
                  Étudiant
                </button>

                {/* Teacher */}
                <button
                  type="button"
                  onClick={() => setRole("TEACHER")}
                  className={`
                    flex-1 rounded-[8px]
                    px-3 py-1.5
                    text-xs font-semibold
                    transition-all duration-200
                    ${
                      role === "TEACHER"
                        ? `
                          bg-gradient-to-r
                          from-[#FFC928]
                          to-[#F5A900]
                          text-[#2B2115]
                          shadow-[0_4px_12px_rgba(220,145,0,0.25)]
                        `
                        : `
                          text-[#765D35]
                          hover:bg-white/70
                          hover:text-[#3A2A16]
                        `
                    }
                  `}
                >
                  Enseignant
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="
                flex w-full items-center justify-center gap-2
                rounded-[10px]
                bg-gradient-to-r
                from-[#FFC928]
                to-[#F5A900]
                px-6 py-2
                text-sm font-bold
                text-[#2B2115]
                shadow-[0_4px_14px_rgba(220,145,0,0.30)]
                transition-all duration-200
                hover:-translate-y-[1px]
                hover:from-[#FFD43B]
                hover:to-[#FFB300]
                hover:shadow-[0_8px_18px_rgba(220,145,0,0.40)]
                active:translate-y-0
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {isSubmitting && (
                <Loader2 size={16} className="animate-spin" />
              )}

              {isSubmitting
                ? "Création du compte..."
                : "Créer mon compte"}
            </button>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="
                  rounded-lg
                  border border-red-200
                  bg-red-50
                  px-4 py-2
                  text-center
                  text-xs font-medium
                  text-red-600
                "
              >
                {error}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="relative my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E6D3A5]" />

            <span className="text-[10px] font-medium text-[#9A8259]">
              OU
            </span>

            <div className="h-px flex-1 bg-[#E6D3A5]" />
          </div>

          {/* Login Link */}
          <p className="relative text-center text-xs text-[#765D35]">
            Déjà un compte ?{" "}
            <Link
              to="/login"
              className="
                font-bold
                text-[#C27D00]
                underline underline-offset-4
                transition-colors
                hover:text-[#8F5D00]
              "
            >
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}