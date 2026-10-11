import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ApiClientError } from "../lib/authApi";
import "../styles/register.css";

function Fox() {
  return (
    <svg viewBox="70 170 1070 900" aria-hidden="true">
      <g fill="currentColor" style={{ color: "var(--ind)" }}>
        <path d="M82 650C150 590 380 560 457 718 400 690 360 690 358 700 362 760 345 780 330 770 300 760 260 745 250 748 245 800 215 840 215 872 230 950 310 1000 388 998 260 1030 180 960 160 830 150 720 140 690 82 660Z" />
        <path d="M370 380C372 350 420 352 480 365 540 378 590 400 620 416 650 398 690 385 714 378 750 290 820 200 870 184 920 200 970 330 978 420 1010 450 1040 490 1052 537L1118 548C1125 555 1110 575 1075 602L1112 610C1090 650 1040 700 982 738 1030 745 1055 780 1052 826 1100 860 1125 910 1120 950 1100 1020 1040 1050 980 1040 940 1030 910 1010 888 990L670 982C660 1010 600 1060 520 1050 470 1040 450 1000 460 940 470 890 510 850 540 836L485 830 512 790 450 795C470 760 490 730 500 712 490 650 495 620 497 622 420 550 372 430 370 380Z" />
      </g>
      <circle cx="652" cy="640" r="95" fill="#fff" />
      <circle cx="881" cy="551" r="95" fill="#fff" />
      <g fill="currentColor" style={{ color: "var(--ind)" }}>
        <circle cx="677" cy="625" r="43" />
        <circle cx="904" cy="538" r="43" />
      </g>
      <rect x="612" y="772" width="280" height="210" rx="42" fill="#fff" />
      <rect x="632" y="792" width="240" height="190" rx="26" style={{ fill: "var(--ind)" }} />
      <path
        d="M893 825L975 782Q1002 772 1002 800V885L950 925Q950 960 990 985Q985 1000 960 992L893 960Z"
        fill="#fff"
      />
    </svg>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Register() {
  /* ---------- Logique d'inscription (inchangée) ---------- */
  const { register } = useAuth();

  // Même correction que sur la connexion : `register.css` porte depuis
  // l'origine des sélecteurs `[data-theme="dark"]` qu'aucun attribut
  // n'atteignait. `resolved` les active, et les deux formulaires jumeaux
  // basculent enfin ensemble, sur la même préférence que le reste de
  // l'application.
  const { resolved } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameBad, setNameBad] = useState(false);
  const [emailBad, setEmailBad] = useState(false);
  const [pwdBad, setPwdBad] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwdRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Validate form
    const okName = name.trim().length > 0;
    const okEmail = EMAIL_RE.test(email.trim());
    const okPwd = password.length >= 8;

    setNameBad(!okName);
    setEmailBad(!okEmail);
    setPwdBad(!okPwd);

    if (!okName) return nameRef.current?.focus();
    if (!okEmail) return emailRef.current?.focus();
    if (!okPwd) return pwdRef.current?.focus();

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

  /* ---------- Rendu (même design que le login) ---------- */
  return (
    <div className="rg-root" data-theme={resolved}>
      <main className="rg-card">
        <Link className="rg-logo" to="/">
          <Fox />
          Amphix Meet
        </Link>

        <h1 className="rg-title">Créer un compte</h1>
        <p className="rg-new">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Nom */}
          <div className={`rg-field${nameBad ? " bad" : ""}`}>
            <svg
              className="rg-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
            </svg>
            <input
              ref={nameRef}
              id="name"
              className="rg-input"
              type="text"
              name="name"
              placeholder="Nom complet"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameBad(false);
              }}
            />
          </div>
          <div className="rg-msg">Entrez votre nom complet.</div>

          {/* E-mail */}
          <div className={`rg-field${emailBad ? " bad" : ""}`}>
            <svg
              className="rg-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="M3.5 7l8.5 6 8.5-6" />
            </svg>
            <input
              ref={emailRef}
              id="email"
              className="rg-input"
              type="email"
              name="email"
              placeholder="Adresse e-mail"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailBad(false);
              }}
            />
          </div>
          <div className="rg-msg">Entrez une adresse e-mail valide.</div>

          {/* Mot de passe */}
          <div className={`rg-field${pwdBad ? " bad" : ""}`}>
            <svg
              className="rg-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            >
              <rect x="4" y="10" width="16" height="10" rx="2.5" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              ref={pwdRef}
              id="password"
              className="rg-input"
              type={showPwd ? "text" : "password"}
              name="password"
              placeholder="Mot de passe"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPwdBad(false);
              }}
            />
            <button
              type="button"
              className={`rg-eye${showPwd ? " on" : ""}`}
              aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              onClick={() => setShowPwd((v) => !v)}
            >
              <svg
                className="show"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg
                className="off"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
            </button>
          </div>
          <div className="rg-msg">Le mot de passe doit contenir au moins 8 caractères.</div>

          {/* Choix du rôle */}
          <div className="rg-role">
            <span className="rg-role-label" id="role-label">
              Je suis…
            </span>
            <div className="rg-role-group" role="group" aria-labelledby="role-label">
              <button
                type="button"
                className={`rg-role-btn${role === "STUDENT" ? " active" : ""}`}
                aria-pressed={role === "STUDENT"}
                onClick={() => setRole("STUDENT")}
              >
                Étudiant
              </button>
              <button
                type="button"
                className={`rg-role-btn${role === "TEACHER" ? " active" : ""}`}
                aria-pressed={role === "TEACHER"}
                onClick={() => setRole("TEACHER")}
              >
                Enseignant
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`rg-submit${isSubmitting ? " load" : ""}`}
            disabled={isSubmitting}
          >
            <span className="rg-spin" />
            <span>{isSubmitting ? "Création du compte…" : "Créer mon compte"}</span>
          </button>

          {error && (
            <div role="alert" className="rg-alert">
              {error}
            </div>
          )}
        </form>

        <p className="rg-legal">
          En vous inscrivant, vous acceptez les <a href="#">Conditions d’utilisation</a> et la{" "}
          <a href="#">Politique de confidentialité</a> d’Amphix Meet.
        </p>
      </main>
    </div>
  );
}