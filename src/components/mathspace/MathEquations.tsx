import { useRef } from "react";
import { AlertTriangle, Equal, Info, Sigma } from "lucide-react";
import type { EquationResult } from "../../lib/math/solve";
import { formatApproximate } from "../../lib/math/format";
import { MathInput, type MathInputHandle } from "./MathInput";
import { MathKeyboard, MathKeyboardHints } from "./MathKeyboard";

/**
 * Onglet Équations.
 *
 * Le solveur est RÉEL mais BORNÉ : premier et second degré à coefficients
 * rationnels. Il le dit lui-même. Quand une équation sort de son domaine
 * (x sous un logarithme, x au dénominateur, degré 3…), l'écran affiche
 * « non pris en charge » avec la raison — il ne fabrique jamais une
 * solution approchée en la présentant comme la réponse.
 */

function SolutionLine({ index, solution }: { index: number; solution: { exact: string; approximate: number } }) {
  const approximate = formatApproximate(solution.approximate);
  const redundant = approximate === solution.exact;

  return (
    <li className="app-result-row items-center">
      <span className="app-result-label">
        {index === 0 ? "Solution" : `Solution ${index + 1}`}
      </span>
      <span className="app-result-value app-mono">
        x = <strong className="font-semibold">{solution.exact}</strong>
      </span>
      {!redundant && (
        <span
          className="app-mono text-[13px]"
          style={{ color: "var(--app-text-muted)" }}
        >
          ≈ {approximate}
        </span>
      )}
    </li>
  );
}

export function MathEquations({
  equation,
  onEquationChange,
  result,
  onSolve,
}: {
  equation: string;
  onEquationChange: (next: string) => void;
  result: EquationResult | null;
  onSolve: () => void;
}) {
  const inputRef = useRef<MathInputHandle>(null);

  const isError = result !== null && result.status === "unsupported";

  return (
    <section className="app-card" aria-labelledby="math-eq-title">
      <header className="app-card-head">
        <div className="min-w-0">
          <h2 id="math-eq-title" className="app-card-title">
            <span className="inline-flex items-center gap-2">
              <Equal size={15} aria-hidden="true" />
              Équations
            </span>
          </h2>
          <p className="app-card-desc">
            Résout les équations du premier et du second degré, à coefficients rationnels.
          </p>
        </div>
      </header>

      <div className="app-card-body flex flex-col gap-4">
        <MathInput
          ref={inputRef}
          fieldId="math-eq-input"
          label="Équation"
          value={equation}
          onChange={onEquationChange}
          onSubmit={onSolve}
          errorMessage={isError ? result.reason : null}
          placeholder="2x + 4 = 10"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="app-btn app-btn-primary" onClick={onSolve}>
            Résoudre
          </button>
          <p className="text-[11.5px]" style={{ color: "var(--app-text-subtle)" }}>
            Exemples : <span className="app-mono">2x + 4 = 10</span>,{" "}
            <span className="app-mono">x^2 - 5x + 6 = 0</span>,{" "}
            <span className="app-mono">x^2 = 2</span>
          </p>
        </div>

        {result !== null && (
          <div className="app-result overflow-hidden">
            <div className="px-4 py-3">
              <p className="app-label">Équation</p>
              <p
                className="app-mono mt-1 text-[15px]"
                style={{ color: "var(--app-text)" }}
              >
                {equation}
              </p>
            </div>

            {result.status === "solved" && (
              <>
                <div className="app-arrow" aria-hidden="true">
                  <Sigma size={13} />
                  {result.solutions.length > 1 ? "Solutions" : "Solution"}
                </div>
                <ul>
                  {result.solutions.map((solution, index) => (
                    <SolutionLine
                      key={`${solution.exact}-${index}`}
                      index={result.solutions.length > 1 ? index : 0}
                      solution={solution}
                    />
                  ))}
                </ul>
                {result.note && (
                  <p
                    className="px-4 pb-3 pt-1 text-[11.5px]"
                    style={{ color: "var(--app-text-subtle)" }}
                  >
                    {result.note}
                  </p>
                )}
              </>
            )}

            {result.status === "none" && (
              <p className="app-result-row text-[13.5px]">
                Cette équation n&apos;a aucune solution.
              </p>
            )}

            {result.status === "identity" && (
              <p className="app-result-row text-[13.5px]">
                Les deux membres sont identiques : tout nombre est solution.
              </p>
            )}

            {result.status === "unsupported" && (
              <div className="app-error m-3" role="alert">
                <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Équation non prise en charge</p>
                  <p className="mt-0.5 text-[12px] leading-snug opacity-90">
                    {result.reason}
                  </p>
                  <p className="mt-1 text-[11.5px] opacity-80">
                    Aucune solution n&apos;est affichée : en inventer une serait pire que
                    de ne rien afficher.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {result === null && (
          <div className="app-result px-4 py-4">
            <p className="flex items-start gap-2.5 text-[12.5px]" style={{ color: "var(--app-text-muted)" }}>
              <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                Le solveur traite le premier et le second degré à coefficients rationnels.
                Tout ce qui en sort est annoncé comme non pris en charge, avec la raison —
                jamais remplacé par une valeur approchée.
              </span>
            </p>
          </div>
        )}

        <MathKeyboard
          onInsert={(text, caretBack) => inputRef.current?.insert(text, caretBack)}
          onBackspace={() => inputRef.current?.backspace()}
          onClear={() => inputRef.current?.clear()}
          onSubmit={onSolve}
        />
        <MathKeyboardHints />
      </div>
    </section>
  );
}
