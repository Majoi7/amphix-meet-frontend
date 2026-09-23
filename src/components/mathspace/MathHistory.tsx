import { useState } from "react";
import { Calculator, FunctionSquare, RotateCcw, Trash2 } from "lucide-react";
import type { MathHistoryEntry } from "./useMathHistory";

/**
 * Historique : consulter, réutiliser, supprimer.
 *
 * Chaque ligne est un bouton « Réutiliser » ET un bouton « Supprimer »
 * distincts — jamais l'un dans l'autre. Un bouton imbriqué dans un bouton
 * est invalide en HTML, et surtout impossible à atteindre au clavier.
 *
 * « Tout effacer » demande confirmation EN DEUX TEMPS, dans la page : une
 * boîte de dialogue native interromprait la navigation au clavier, et une
 * suppression définitive ne doit pas tenir à un clic mal placé.
 */

const TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
});

function formatWhen(at: number): string {
  const date = new Date(at);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay ? TIME_FORMAT.format(date) : `${DAY_FORMAT.format(date)} ${TIME_FORMAT.format(date)}`;
}

export function MathHistory({
  entries,
  onReuse,
  onRemove,
  onClear,
}: {
  entries: MathHistoryEntry[];
  onReuse: (entry: MathHistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="app-card flex min-h-0 flex-col" aria-labelledby="math-history-title">
      <header className="app-card-head">
        <div className="min-w-0">
          <h2 id="math-history-title" className="app-card-title">
            Historique
          </h2>
          <p className="app-card-desc">
            {entries.length === 0
              ? "Vos calculs récents apparaîtront ici, conservés dans ce navigateur."
              : `${entries.length} opération${entries.length > 1 ? "s" : ""} — conservée${
                  entries.length > 1 ? "s" : ""
                } dans ce navigateur.`}
          </p>
        </div>

        {entries.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5">
            {confirming ? (
              <>
                <button
                  type="button"
                  className="app-btn app-btn-ghost"
                  onClick={() => setConfirming(false)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-secondary"
                  onClick={() => {
                    onClear();
                    setConfirming(false);
                  }}
                >
                  Confirmer
                </button>
              </>
            ) : (
              <button
                type="button"
                className="app-btn app-btn-ghost"
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={14} aria-hidden="true" />
                Tout effacer
              </button>
            )}
          </div>
        )}
      </header>

      {/* Même raison que dans la liste des objets : deux plafonds écrits en
          `lg:` — un point de rupture de FENÊTRE — se trompaient dès que
          l'espace mathématique n'occupait pas la fenêtre. Dans l'admin, à
          900 px de fenêtre, la colonne latérale est étroite et haute : le
          plafond de 360 px s'appliquait alors qu'il n'avait plus de raison,
          et empilait un défilement dans un autre. Le défilement est celui de
          la colonne, qui l'a déjà. */}
      <div className="min-h-0 flex-1 p-2">
        {entries.length === 0 ? (
          <p
            className="px-3 py-6 text-center text-[12.5px]"
            style={{ color: "var(--app-text-subtle)" }}
          >
            Aucun calcul enregistré.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="app-history-item min-w-0 flex-1"
                  onClick={() => onReuse(entry)}
                  aria-label={`Réutiliser : ${entry.source}`}
                  title="Reprendre cette opération"
                >
                  <span className="flex items-center gap-2">
                    {entry.kind === "equation" ? (
                      <FunctionSquare
                        size={13}
                        aria-hidden="true"
                        style={{ color: "var(--app-text-subtle)" }}
                      />
                    ) : (
                      <Calculator
                        size={13}
                        aria-hidden="true"
                        style={{ color: "var(--app-text-subtle)" }}
                      />
                    )}
                    <span className="app-mono app-history-source min-w-0 flex-1 truncate">
                      {entry.source}
                    </span>
                    <span
                      className="shrink-0 text-[10.5px] tabular-nums"
                      style={{ color: "var(--app-text-subtle)" }}
                    >
                      {formatWhen(entry.at)}
                    </span>
                  </span>
                  <span className="app-mono app-history-result block truncate">
                    {entry.summary}
                  </span>
                </button>
                <button
                  type="button"
                  className="app-icon-btn shrink-0"
                  onClick={() => onRemove(entry.id)}
                  aria-label={`Supprimer l'opération ${entry.source}`}
                  title="Supprimer cette ligne"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entries.length > 0 && (
        <p
          className="flex items-center gap-1.5 px-4 py-2.5 text-[11px]"
          style={{ color: "var(--app-text-subtle)", borderTop: "1px solid var(--app-border)" }}
        >
          <RotateCcw size={12} aria-hidden="true" />
          Stocké uniquement dans ce navigateur — rien n&apos;est envoyé au serveur.
        </p>
      )}
    </section>
  );
}
