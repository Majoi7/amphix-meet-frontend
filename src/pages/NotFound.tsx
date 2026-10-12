import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FoxMascot } from "../components/FoxMascot";
import "../styles/theme.css";
import "./notfound.css";

/**
 * Page 404.
 *
 * ELLE EST PUBLIQUE. Une personne déconnectée qui suit un lien mort doit voir
 * cette page, pas être renvoyée à l'écran de connexion : la route qui la monte
 * n'est donc pas enveloppée dans `RequireAuth` (voir `App.tsx`).
 *
 * Elle ne monte rien de LiveKit, n'appelle aucune API et ne crée aucune
 * donnée : c'est un écran, deux liens, et un renard.
 *
 * LE SECOND BOUTON DÉPEND DE LA SESSION, qui est encore en cours de
 * restauration au premier rendu (`status === "loading"`, le temps de l'appel
 * silencieux à `/auth/refresh`). Tant que le doute dure, il est rendu
 * DÉSACTIVÉ avec son indicateur — la même convention que `RequireAuth` —
 * plutôt que de pointer vers une destination peut-être fausse : envoyer un
 * utilisateur connecté vers `/login` serait au mieux une régression, au pire
 * une boucle. Une fois la session connue, il devient un lien vers
 * `/dashboard` ou vers `/login`.
 */
export function NotFound() {
  const { status } = useAuth();
  const { resolved } = useTheme();

  const isResolving = status === "loading";
  const spaceHref = status === "authenticated" ? "/dashboard" : "/login";

  return (
    <div className="app-theme nf-root" data-theme={resolved}>
      <div className="nf-glow" aria-hidden="true" />

      <FoxMascot />

      <p className="nf-code">404</p>
      <h1 className="nf-title">Oups, cette salle semble introuvable !</h1>
      <p className="nf-text">
        On dirait que tu t'es égaré. Cette page n'existe pas ou le lien que tu as suivi n'est plus
        disponible. Pas de panique, Amphix est là pour te remettre sur la bonne voie.
      </p>

      <div className="nf-actions">
        <Link to="/" className="nf-btn nf-btn-primary">
          <ArrowLeft size={18} aria-hidden="true" />
          Retour à l'accueil
        </Link>

        {isResolving ? (
          <button type="button" className="nf-btn nf-btn-secondary" disabled aria-busy="true">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Accéder à mon espace
          </button>
        ) : (
          <Link to={spaceHref} className="nf-btn nf-btn-secondary">
            Accéder à mon espace
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
