import { useRef, useState } from "react";
import { Calculator, Keyboard } from "lucide-react";
import type { Evaluation } from "../../lib/math";
import { MathInput, type MathInputHandle } from "./MathInput";
import { MathKeyboard, MathKeyboardHints } from "./MathKeyboard";
import { MathResult } from "./MathResult";

/**
 * Onglet Calculatrice.
 *
 * L'ordre est toujours le même, et c'est volontaire : on saisit, on valide,
 * on lit le résultat. Le clavier mathématique reste SOUS le résultat — il
 * ne pousse jamais la réponse hors de l'écran, et il peut être replié par
 * ceux qui n'en ont pas besoin.
 */
export function MathCalculator({
  expression,
  onExpressionChange,
  result,
  onCalculate,
}: {
  expression: string;
  onExpressionChange: (next: string) => void;
  result: Evaluation | null;
  onCalculate: () => void;
}) {
  const inputRef = useRef<MathInputHandle>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(true);

  const errorMessage = result?.status === "error" ? result.message : null;

  return (
    <section className="app-card" aria-labelledby="math-calc-title">
      <header className="app-card-head">
        <div className="min-w-0">
          <h2 id="math-calc-title" className="app-card-title">
            <span className="inline-flex items-center gap-2">
              <Calculator size={15} aria-hidden="true" />
              Calculatrice
            </span>
          </h2>
          <p className="app-card-desc">
            Opérations, parenthèses, puissances, racines, fonctions usuelles — avec la
            forme exacte quand elle existe.
          </p>
        </div>
        <button
          type="button"
          className="app-btn app-btn-ghost shrink-0"
          onClick={() => setKeyboardOpen((open) => !open)}
          aria-expanded={keyboardOpen}
          aria-controls="math-calc-keyboard"
        >
          <Keyboard size={14} aria-hidden="true" />
          {keyboardOpen ? "Masquer le clavier" : "Afficher le clavier"}
        </button>
      </header>

      <div className="app-card-body flex flex-col gap-4">
        <MathInput
          ref={inputRef}
          fieldId="math-calc-expression"
          label="Expression"
          value={expression}
          onChange={onExpressionChange}
          onSubmit={onCalculate}
          errorMessage={errorMessage}
          placeholder="2+3*4"
          autoFocus
        />

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="app-btn app-btn-primary" onClick={onCalculate}>
            Calculer
          </button>
          <MathKeyboardHints />
        </div>

        <MathResult expression={expression} result={result} />

        {keyboardOpen && (
          <div id="math-calc-keyboard" className="flex flex-col gap-2">
            <MathKeyboard
              onInsert={(text, caretBack) => inputRef.current?.insert(text, caretBack)}
              onBackspace={() => inputRef.current?.backspace()}
              onClear={() => inputRef.current?.clear()}
              onSubmit={onCalculate}
            />
          </div>
        )}
      </div>
    </section>
  );
}
