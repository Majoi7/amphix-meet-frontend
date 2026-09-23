import { useState } from "react";
import { AlertTriangle, ArrowDown, Check, Copy, Info } from "lucide-react";
import type { Evaluation } from "../../lib/math";

/**
 * Affichage d'un résultat.
 *
 * LA RÈGLE QUI GOUVERNE CE FICHIER : on n'invente jamais un résultat exact.
 * Le moteur rend une forme exacte quand il en a réellement une (rationnels,
 * racines de carrés parfaits) et `null` sinon. Dans ce cas, l'écran écrit
 * « Non disponible » — il ne remplit pas la case avec une décimale que
 * l'utilisateur prendrait pour la valeur exacte.
 *
 * L'expression et le résultat sont volontairement SÉPARÉS : la question en
 * haut, la réponse en bas, un chevron entre les deux.
 */
export function MathResult({
  expression,
  result,
}: {
  expression: string;
  result: Evaluation | null;
}) {
  const [copied, setCopied] = useState(false);

  if (result === null) {
    return (
      <div className="app-result px-4 py-6 text-center">
        <p className="text-[13px]" style={{ color: "var(--app-text-muted)" }}>
          Saisis une expression, puis appuie sur <span className="app-mono">Entrée</span> ou
          sur la touche <span className="app-mono">=</span>.
        </p>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--app-text-subtle)" }}>
          Exemples : <span className="app-mono">2+3*4</span>,{" "}
          <span className="app-mono">sqrt(2)</span>, <span className="app-mono">1/3</span>,{" "}
          <span className="app-mono">2^10</span>
        </p>
      </div>
    );
  }

  // « Saisis une expression » n'est pas une erreur : c'est une invitation.
  if (result.status === "error" && result.code === "EMPTY") {
    return (
      <div className="app-result flex items-start gap-2.5 px-4 py-4">
        <Info size={16} aria-hidden="true" style={{ color: "var(--app-text-subtle)" }} />
        <p className="text-[13px]" style={{ color: "var(--app-text-muted)" }}>
          {result.message}
        </p>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="app-error" role="alert">
        <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">{result.message}</p>
          <p className="mt-0.5 text-[11.5px] opacity-80">
            L&apos;expression n&apos;a pas été calculée : aucun résultat approximatif
            n&apos;est affiché à sa place.
          </p>
        </div>
      </div>
    );
  }

  // `success` est une `const` rétrécie : la narrowing tient donc aussi à
  // l'intérieur de `copyResult`, ce qu'une variable réassignable ne
  // garantirait pas.
  const success = result;
  const exact = success.exact;
  const hasExact = exact !== null;
  const headline = exact ?? success.approximate;
  // L'approximation n'est montrée que si elle apprend quelque chose.
  const approximationIsRedundant = hasExact && exact === success.approximate;

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(headline);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers refusé par le navigateur — rien de grave */
    }
  }

  return (
    <div className="app-result overflow-hidden">
      <div className="px-4 py-3">
        <p className="app-label">Expression</p>
        <p className="app-mono mt-1 text-[15px] leading-relaxed" style={{ color: "var(--app-text)" }}>
          {success.source || expression}
        </p>
      </div>

      <div className="app-arrow" aria-hidden="true">
        <ArrowDown size={13} />
        Résultat
      </div>

      <div
        className="flex items-start justify-between gap-3 px-4 pb-3"
        style={{ borderTop: "1px solid var(--app-border)" }}
      >
        <div className="min-w-0 pt-3">
          <p className="app-result-exact app-mono">{headline}</p>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--app-text-subtle)" }}>
            {hasExact ? "Valeur exacte" : "Valeur approchée — aucune forme exacte disponible"}
          </p>
        </div>
        <button
          type="button"
          onClick={copyResult}
          className="app-icon-btn mt-3 shrink-0"
          aria-label={copied ? "Résultat copié" : "Copier le résultat"}
          title={copied ? "Copié" : "Copier le résultat"}
        >
          {copied ? (
            <Check size={15} aria-hidden="true" style={{ color: "var(--app-green)" }} />
          ) : (
            <Copy size={15} aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="app-result-row">
        <span className="app-result-label">Exact</span>
        <span className="app-result-value app-mono">
          {hasExact ? exact : "Non disponible"}
        </span>
      </div>

      {!approximationIsRedundant && (
        <div className="app-result-row">
          <span className="app-result-label">
            {hasExact ? "Approximation" : "Approché"}
          </span>
          <span className="app-result-value app-mono">{success.approximate}</span>
        </div>
      )}

      {!hasExact && (
        <p
          className="px-4 pb-3 pt-1 text-[11.5px] leading-snug"
          style={{ color: "var(--app-text-subtle)" }}
        >
          Le moteur fournit la forme exacte pour les rationnels ( + − × ÷ ^ ) et pour
          les racines de carrés parfaits. Pour les autres nombres — π, e, √2 — seule
          l&apos;approximation existe, et elle est annoncée comme telle.
        </p>
      )}
    </div>
  );
}
