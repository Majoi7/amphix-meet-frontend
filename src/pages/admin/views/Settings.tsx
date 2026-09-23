import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, LogOut, UserCog, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useDashboardTheme } from "../context/DashboardThemeContext";
import { ROLE_LABEL } from "../lib/derive";
import { Card } from "../components/Card";
import { Notice } from "../components/Notice";
import { ThemeSwitcher } from "../components/ThemeSwitcher";

const AVAILABLE_DATA = [
  "Votre compte : nom, adresse e-mail, rôle, vérification de l'adresse (GET /auth/me).",
  "Vos réunions : titre, code, hôte, statut, dates de création, de début et de fin (GET /meetings/mine).",
  "Vos séances : sujet, interlocuteurs, dates, durée, statut (GET /bookings/mine).",
];

const MISSING_DATA = [
  "L'annuaire des comptes de la plateforme — aucun point d'entrée.",
  "Le nombre de participants d'une réunion — non exposé hors de la salle.",
  "Les statistiques globales et séries historiques — aucun point d'entrée.",
  "Le journal d'activité de la plateforme — aucune table d'événements.",
  "Les applications et clés API — aucun modèle de données.",
  "La date d'inscription et la dernière connexion — absentes du modèle User (pas de lastLoginAt).",
];

/**
 * Paramètres.
 *
 * Rien d'inventé ici non plus : les seuls réglages proposés sont ceux qui
 * agissent vraiment — le thème de l'administration, l'accès au profil, la
 * déconnexion. Les interrupteurs décoratifs sont volontairement absents.
 */
export function SettingsView() {
  const { user, logout } = useAuth();
  const { preference } = useDashboardTheme();
  const [isLoggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Apparence ---------- */}
      <Card
        title="Apparence"
        description="Thème de l'espace d'administration uniquement."
      >
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
          <div className="sm:w-[320px]">
            <ThemeSwitcher />
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--dash-text-muted)" }}>
            {preference === "system"
              ? "Le thème suit le réglage clair/sombre de votre système et change sans rechargement."
              : `Thème « ${preference === "light" ? "Clair" : "Sombre"} » appliqué en permanence.`}{" "}
            Le choix est enregistré dans le navigateur et conservé après rafraîchissement.
            Il ne modifie pas le thème de la salle de réunion, qui reste sombre.
          </p>
        </div>
      </Card>

      {/* ---------- Compte ---------- */}
      {user && (
        <Card
          title="Compte"
          description="Les informations de votre profil."
          action={
            <Link to="/profile" className="dash-btn dash-btn-secondary">
              <UserCog size={15} aria-hidden="true" />
              Ouvrir mon profil
            </Link>
          }
        >
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-3">
            <div>
              <dt className="text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
                Nom
              </dt>
              <dd className="text-[13px] font-medium" style={{ color: "var(--dash-text)" }}>
                {user.name}
              </dd>
            </div>
            <div>
              <dt className="text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
                Adresse e-mail
              </dt>
              <dd className="truncate text-[13px]" style={{ color: "var(--dash-text)" }}>
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
                Rôle
              </dt>
              <dd className="text-[13px] font-medium" style={{ color: "var(--dash-text)" }}>
                {ROLE_LABEL[user.role]}
              </dd>
            </div>
          </dl>
          <div className="px-4 pb-4">
            <p className="text-[11.5px]" style={{ color: "var(--dash-text-subtle)" }}>
              Le nom et l'image de profil se modifient depuis la page de profil, avec la
              fonction déjà existante.
            </p>
          </div>
        </Card>
      )}

      {/* ---------- Données ---------- */}
      <Card
        title="Données accessibles"
        description="Ce que l'administration peut afficher, et ce qu'elle ne peut pas."
      >
        <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--dash-green)" }}>
              Disponible
            </p>
            <ul className="space-y-2">
              {AVAILABLE_DATA.map((line) => (
                <li key={line} className="flex gap-2">
                  <Check
                    size={14}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--dash-green)" }}
                  />
                  <span className="text-[12px] leading-relaxed" style={{ color: "var(--dash-text-muted)" }}>
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--dash-text-muted)" }}>
              Non disponible
            </p>
            <ul className="space-y-2">
              {MISSING_DATA.map((line) => (
                <li key={line} className="flex gap-2">
                  <X
                    size={14}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--dash-text-subtle)" }}
                  />
                  <span className="text-[12px] leading-relaxed" style={{ color: "var(--dash-text-muted)" }}>
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* ---------- Session ---------- */}
      <Card title="Session" description="Fermer la session sur cet appareil.">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--dash-text-muted)" }}>
            La déconnexion révoque le jeton de rafraîchissement côté serveur, comme depuis
            l'espace personnel.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="dash-btn"
            style={{ backgroundColor: "var(--dash-red-soft)", color: "var(--dash-red)" }}
          >
            <LogOut size={15} aria-hidden="true" />
            {isLoggingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </Card>

      <Notice title="Thème et stockage">
        La préférence de thème est enregistrée sous la clé <code>amphix.theme</code> dans le
        stockage local du navigateur, et elle est PARTAGÉE avec l&apos;espace mathématique :
        basculer ici bascule là-bas. Une préférence enregistrée sous l&apos;ancienne clé{" "}
        <code>amphix.dashboard.theme</code> reste lue, donc rien n&apos;est perdu. Si le
        stockage est indisponible, l&apos;interface reste utilisable : le thème s&apos;applique
        pour la session, sans être conservé.
      </Notice>
    </div>
  );
}
