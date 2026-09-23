import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MonitorPlay, Sigma } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { MathWorkspace } from "../components/mathspace/MathWorkspace";

/**
 * Espace mathématique rattaché à une réunion — route `/room/:roomId/math`.
 *
 * CE QUI A CHANGÉ, ET POURQUOI
 *
 * La version précédente appelait `useLocalParticipant()` pour publier le
 * canvas en partage d'écran. Or cette route est rendue EN DEHORS de la salle
 * LiveKit : `useLocalParticipant` résout la salle via `useEnsureRoom()`, qui
 * LÈVE « No room provided, make sure you are inside a Room context or pass
 * the room explicitly ». La page ne s'affichait donc pas du tout.
 *
 * Le partage d'écran depuis cette page est donc ANNONCÉ COMME INDISPONIBLE
 * plutôt que simulé. Le rétablir demanderait de rendre cette page à
 * l'intérieur du `<LiveKitRoom>` de la salle — c'est-à-dire de modifier
 * `pages/Room.tsx`, ce qui est explicitement hors périmètre. Le bouton de
 * partage de la réunion, lui, n'est pas touché et fonctionne comme avant.
 *
 * Le reste de la page est le même espace de travail que celui de
 * l'administration : un seul composant, deux points d'entrée.
 */
export function MathSpace() {
  const { roomId } = useParams<{ roomId: string }>();
  const { resolved } = useTheme();

  const backToRoom = roomId ? `/room/${roomId}` : "/";

  return (
    <div
      data-theme={resolved}
      className="app-theme app-shell flex min-h-full flex-col"
    >
      <header
        className="sticky top-0 z-10 shrink-0 border-b backdrop-blur"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to={backToRoom}
            className="app-btn app-btn-secondary shrink-0"
            aria-label="Retour à la réunion"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Retour à la réunion
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Sigma
              size={18}
              aria-hidden="true"
              className="shrink-0"
              style={{ color: "var(--app-accent-strong)" }}
            />
            <div className="min-w-0">
              <h1
                className="truncate text-[15px] font-semibold leading-tight"
                style={{ color: "var(--app-text)" }}
              >
                Espace mathématique
              </h1>
              <p
                className="hidden truncate text-[11.5px] leading-tight sm:block"
                style={{ color: "var(--app-text-subtle)" }}
              >
                Calculs exacts, fonctions tracées, équations — sans quitter la réunion.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <ThemeSwitcher compact />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-5 sm:px-6">
        <div
          className="mb-4 flex items-start gap-2.5 rounded-[11px] px-3.5 py-3 text-[12.5px]"
          style={{
            backgroundColor: "var(--app-surface-2)",
            color: "var(--app-text-muted)",
          }}
        >
          <MonitorPlay
            size={15}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            style={{ color: "var(--app-text-subtle)" }}
          />
          <p>
            Cette page est faite pour être ouverte dans un <strong>second onglet</strong>,
            à côté de la réunion : le bouton <span className="app-mono">Σ</span> de l&apos;en-tête
            de réunion l&apos;ouvre ainsi. Le partage d&apos;écran n&apos;y est pas disponible —
            elle vit hors de la salle, aucun canvas ne peut y être publié. Pour montrer vos
            courbes aux autres, revenez à la réunion et utilisez le partage d&apos;écran
            habituel : il fonctionne comme avant.{" "}
            <strong>Attention :</strong> suivre « Retour à la réunion » depuis ce second
            onglet vous fera rejoindre la réunion une seconde fois, et vous apparaîtrez
            alors en double dans la liste des participants.
          </p>
        </div>

        <MathWorkspace />
      </main>
    </div>
  );
}
