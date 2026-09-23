import { KeyRound, Plus, ShieldAlert } from "lucide-react";
import { Card } from "../components/Card";
import { Notice } from "../components/Notice";
import { EmptyState } from "../components/EmptyState";

/**
 * Applications & API.
 *
 * Aucun modèle `ApiApplication` / `ApiKey` n'existe dans le schéma Prisma :
 * il n'y a donc ni application tierce, ni clé, ni préfixe public, ni date de
 * dernière utilisation à afficher. Cette page ne les simule pas.
 *
 * Ce qui existe réellement, en revanche, est montré : le point d'entrée
 * serveur-à-serveur `POST /api/v1/integrations/amphix/sessions`, protégé par
 * un secret partagé lu dans la variable d'environnement
 * `AMPHIX_INTEGRATION_SECRET`.
 *
 * RÈGLE ABSOLUE : aucune valeur de secret n'est affichée, ni en clair, ni
 * tronquée. Seul le NOM de l'en-tête attendu est indiqué.
 */
export function ApplicationsView() {
  return (
    <div className="flex flex-col gap-5">
      <Notice tone="warning" title="Aucune gestion de clés API dans cette version">
        Le schéma de base de données ne comporte ni table d'applications, ni table de clés.
        Créer, révoquer ou lister des clés demanderait une évolution du modèle de données et
        de l'API : cette étape n'y touche pas. L'interface ci-dessous est en place, sans
        données simulées derrière.
      </Notice>

      {/* ---------- Accès réellement existant ---------- */}
      <Card
        title="Accès serveur à serveur"
        description="Le seul accès programmatique actuellement déployé."
      >
        <div className="overflow-x-auto">
          <table className="dash-table">
            <caption className="sr-only">Accès programmatiques existants</caption>
            <thead>
              <tr>
                <th scope="col">Application</th>
                <th scope="col">Type</th>
                <th scope="col">Point d'entrée</th>
                <th scope="col">État</th>
                <th scope="col" title="Non exposé par l'API">
                  Créée le
                </th>
                <th scope="col" title="Non exposé par l'API">
                  Dernière utilisation
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "var(--dash-accent-soft)", color: "var(--dash-accent-strong)" }}
                      aria-hidden="true"
                    >
                      <KeyRound size={14} />
                    </span>
                    <span className="font-medium" style={{ color: "var(--dash-text)" }}>
                      Intégration Amphix
                    </span>
                  </div>
                </td>
                <td>
                  <span className="text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
                    Secret partagé (variable d'environnement)
                  </span>
                </td>
                <td>
                  <code
                    className="whitespace-nowrap text-[11.5px]"
                    style={{ color: "var(--dash-text-muted)" }}
                  >
                    POST /api/v1/integrations/amphix/sessions
                  </code>
                </td>
                <td>
                  <span className="dash-badge dash-badge-slate">
                    <span className="dash-dot" aria-hidden="true" />
                    Déployé
                  </span>
                </td>
                <td>
                  <span className="text-[12.5px]" style={{ color: "var(--dash-text-subtle)" }}>
                    —
                  </span>
                </td>
                <td>
                  <span className="text-[12.5px]" style={{ color: "var(--dash-text-subtle)" }}>
                    —
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4 pt-1">
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--dash-text-subtle)" }}>
            Cet accès n'est pas une clé par application : il s'authentifie avec l'en-tête{" "}
            <code>X-Amphix-Secret</code>, comparé à la variable d'environnement
            <code> AMPHIX_INTEGRATION_SECRET</code>. Il est donc actif ou inactif selon la
            configuration du serveur, ce que cette interface ne peut pas vérifier. Sa valeur
            n'est jamais affichée.
          </p>
        </div>
      </Card>

      {/* ---------- Applications tierces ---------- */}
      <Card
        title="Applications tierces"
        description="Création de clés API par application."
        action={
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Indisponible : aucun modèle d'application ni de clé n'existe côté serveur."
            className="dash-btn dash-btn-secondary"
          >
            <Plus size={15} aria-hidden="true" />
            Créer une application
          </button>
        }
      >
        <EmptyState
          icon={<ShieldAlert size={16} />}
          title="Aucune application enregistrée"
          description="Cette liste restera vide tant que le modèle de données ne comporte pas d'applications. Le bouton de création est volontairement inactif plutôt que factice."
        />
      </Card>

      <Notice title="Politique d'affichage des secrets">
        Une clé secrète ne sera jamais affichée, même partiellement, même à son créateur :
        seule une empreinte ou un préfixe public aurait sa place ici, et uniquement le jour
        où le modèle de données les fournira.
      </Notice>
    </div>
  );
}
