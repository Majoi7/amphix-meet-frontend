import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Calculator, Delete, X } from "lucide-react";
import { evaluateConstant, type Evaluation } from "../../lib/math";

/**
 * Mini-calculatrice du tableau blanc.
 *
 * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT : addition, soustraction, multiplication,
 * division, modulo, puissance et racine carrée — plus les parenthèses et les
 * décimales. Rien d'autre n'est proposé sur le clavier, et l'infobulle le dit.
 * Le moteur sait faire davantage (`sin`, `ln`, `pi`…) : c'est le CLAVIER qui
 * est restreint, pas la saisie, qui reste un champ de texte ordinaire.
 *
 * L'ÉVALUATION EST CELLE DU MOTEUR (`evaluateConstant`), pas une seconde
 * implémentation. Elle est écrite sans `eval()` ni `new Function()`, elle rend
 * la forme exacte quand elle existe vraiment, et elle traduit déjà toute
 * division par zéro en phrase française plutôt qu'en `Infinity`.
 *
 * ELLE N'ÉCRIT RIEN SUR LE TABLEAU. Elle ne reçoit ni la couleur, ni l'auteur,
 * ni de rappel de tracé : elle ne PEUT donc toucher ni au dessin, ni à la
 * synchronisation, ni à l'historique, ni à la sauvegarde. C'est une décision,
 * pas un oubli — ce lot ne devait pas élargir la surface de régression.
 */

interface KeyDef {
  /** Ce qui est écrit sur la touche. */
  label: string;
  /** Ce qui est réellement inséré (par défaut : `label`). */
  insert?: string;
  /** Caractères laissés APRÈS le curseur (fermetures automatiques). */
  caretBack?: number;
  /** Nom accessible — aucune touche n'est une icône nue. */
  aria: string;
  tone?: "digit" | "op" | "util";
  action?: "clear" | "backspace" | "submit";
  /** Occupe deux colonnes — réservé à « = », qui conclut la saisie. */
  wide?: boolean;
}

/**
 * La disposition suit celle d'une calculatrice de poche, pas celle du clavier
 * mathématique de l'espace mathématique : ici, tout doit tenir sous le pouce.
 *
 * La touche affiche un glyphe lisible (« × », « ÷ », « − », « √ ») mais insère
 * la forme que le moteur comprend réellement — la même règle que le clavier de
 * l'espace mathématique. « √ » insère `sqrt()` et laisse le curseur ENTRE les
 * parenthèses : l'opérande est ainsi délimité explicitement, et « √9+1 » ne
 * peut pas être pris pour « √10 ».
 */
const ROWS: KeyDef[][] = [
  [
    { label: "C", aria: "Tout effacer", tone: "util", action: "clear" },
    { label: "⌫", aria: "Effacer le dernier caractère", tone: "util", action: "backspace" },
    { label: "(", aria: "Parenthèse ouvrante" },
    { label: ")", aria: "Parenthèse fermante" },
  ],
  [
    { label: "7", aria: "7" },
    { label: "8", aria: "8" },
    { label: "9", aria: "9" },
    { label: "÷", insert: "/", aria: "Diviser", tone: "op" },
  ],
  [
    { label: "4", aria: "4" },
    { label: "5", aria: "5" },
    { label: "6", aria: "6" },
    { label: "×", insert: "*", aria: "Multiplier", tone: "op" },
  ],
  [
    { label: "1", aria: "1" },
    { label: "2", aria: "2" },
    { label: "3", aria: "3" },
    { label: "−", insert: "-", aria: "Soustraire", tone: "op" },
  ],
  [
    { label: "0", aria: "0" },
    { label: ",", aria: "Virgule décimale" },
    { label: "^", aria: "Puissance", tone: "op" },
    { label: "+", aria: "Ajouter", tone: "op" },
  ],
  [
    { label: "√", insert: "sqrt()", caretBack: 1, aria: "Racine carrée", tone: "op" },
    { label: "%", aria: "Modulo", tone: "op" },
    { label: "=", aria: "Calculer", tone: "op", action: "submit", wide: true },
  ],
];

/** Habillage d'une touche. Une seule échelle de gris, et le bleu pour valider. */
function keyClass(key: KeyDef): string {
  if (key.action === "submit") return "bg-meet-blue text-meet-bg hover:bg-meet-blue-hover";
  if (key.tone === "op") return "bg-meet-control/70 text-meet-text-primary hover:bg-meet-control";
  if (key.tone === "util") {
    return "bg-meet-control/40 text-meet-text-secondary hover:bg-meet-control/70";
  }
  return "text-meet-text-primary hover:bg-meet-control";
}

export function MiniCalculator({ onClose }: { onClose: () => void }) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<Evaluation | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  // Position du curseur à rétablir APRÈS que React a réécrit la valeur : la
  // poser avant serait effacée par le rendu. Même technique que `MathInput`,
  // qui résout déjà ce problème dans l'espace mathématique.
  const pendingCaret = useRef<number | null>(null);

  useEffect(() => {
    const element = inputRef.current;
    if (!element || pendingCaret.current === null) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    element.setSelectionRange(caret, caret);
  }, [expression]);

  function update(next: string) {
    setExpression(next);
    // Un résultat affiché à côté d'une expression modifiée est un mensonge :
    // il décrit une saisie qui n'existe plus.
    setResult(null);
  }

  /** Bornes de la sélection. Champ non focalisé : on écrit à la fin. */
  function selection(): [number, number] {
    const element = inputRef.current;
    if (!element) return [expression.length, expression.length];
    if (document.activeElement !== element) return [expression.length, expression.length];
    const start = element.selectionStart ?? expression.length;
    const end = element.selectionEnd ?? start;
    return [start, end];
  }

  function insert(text: string, caretBack = 0) {
    const [start, end] = selection();
    pendingCaret.current = start + text.length - caretBack;
    update(expression.slice(0, start) + text + expression.slice(end));
    inputRef.current?.focus();
  }

  function backspace() {
    let [start, end] = selection();
    if (start === end) {
      if (start === 0) {
        inputRef.current?.focus();
        return;
      }
      start -= 1;
    }
    pendingCaret.current = start;
    update(expression.slice(0, start) + expression.slice(end));
    inputRef.current?.focus();
  }

  function clear() {
    pendingCaret.current = 0;
    update("");
    inputRef.current?.focus();
  }

  function calculate() {
    // `evaluateConstant` ne lève jamais : une saisie vide, une parenthèse
    // manquante ou une division par zéro reviennent en `status: "error"` avec
    // une phrase française. Il n'y a donc rien à intercepter ici.
    setResult(evaluateConstant(expression));
  }

  function run(key: KeyDef) {
    if (key.action === "clear") return clear();
    if (key.action === "backspace") return backspace();
    if (key.action === "submit") return calculate();
    insert(key.insert ?? key.label, key.caretBack ?? 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      calculate();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      // Échap vide la saisie ; si elle est déjà vide, il referme le panneau.
      if (expression !== "") clear();
      else onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Calculatrice"
      className="absolute left-3 top-14 z-10 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl bg-meet-bg-secondary p-3 shadow-2xl ring-1 ring-meet-border"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-meet-text-primary">
          <Calculator size={16} aria-hidden="true" /> Calculatrice
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la calculatrice"
          className="rounded p-1 text-meet-text-secondary hover:bg-meet-control"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <label htmlFor="wb-calc-input" className="mb-1 block text-xs text-meet-text-secondary">
        Expression
      </label>
      <input
        ref={inputRef}
        id="wb-calc-input"
        type="text"
        value={expression}
        onChange={(event) => update(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="2+3*4"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
        aria-invalid={result?.status === "error" ? true : undefined}
        aria-describedby="wb-calc-hint"
        className="mb-2 w-full rounded-lg border border-meet-border bg-meet-bg px-3 py-2 font-mono text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
      />

      {/* Une seule région vive : c'est elle qui annonce le résultat ou l'erreur
          au lecteur d'écran, une fois, sans doublon. */}
      <div aria-live="polite" className="mb-2">
        <ResultLine result={result} />
      </div>

      <p id="wb-calc-hint" className="mb-2 text-[10px] leading-snug text-meet-text-disabled">
        Opérations : + − × ÷ % ^ √. Parenthèses et décimaux acceptés, avec la virgule ou le
        point. « % » est le reste de la division euclidienne.
      </p>

      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Clavier de la calculatrice">
        {ROWS.flat().map((key) => (
          <button
            key={`${key.aria}-${key.label}`}
            type="button"
            // Le clic ne doit PAS prendre le focus : sinon la position du
            // curseur serait perdue et l'insertion se ferait à l'aveugle.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(key)}
            aria-label={key.aria}
            title={key.aria}
            className={`flex h-9 items-center justify-center rounded-lg text-sm transition-colors ${
              key.wide ? "col-span-2" : ""
            } ${keyClass(key)}`}
          >
            {key.action === "backspace" ? <Delete size={15} aria-hidden="true" /> : key.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * La ligne de résultat.
 *
 * Même règle que `MathResult` : on n'invente JAMAIS une forme exacte. Le
 * moteur rend `null` quand il n'en a pas, et l'écran écrit alors « aucune forme
 * exacte disponible » au lieu de faire passer l'approximation pour la valeur.
 */
function ResultLine({ result }: { result: Evaluation | null }) {
  if (result === null) {
    return (
      <p className="text-[11px] leading-snug text-meet-text-disabled">
        Saisis une expression, puis appuie sur Entrée ou sur « = ».
      </p>
    );
  }

  // « Saisis une expression » n'est pas une erreur : c'est une invitation.
  if (result.status === "error" && result.code === "EMPTY") {
    return (
      <p className="text-[11px] leading-snug text-meet-text-secondary">{result.message}</p>
    );
  }

  if (result.status === "error") {
    return (
      <p className="text-[11px] font-medium leading-snug text-meet-yellow">{result.message}</p>
    );
  }

  const hasExact = result.exact !== null;
  const headline = result.exact ?? result.approximate;
  // L'approximation n'est montrée que si elle apprend quelque chose.
  const showApproximation = hasExact && result.exact !== result.approximate;

  return (
    <div className="rounded-lg bg-meet-bg px-3 py-2">
      <p className="break-all font-mono text-base leading-snug text-meet-text-primary">
        {headline}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-meet-text-secondary">
        {hasExact
          ? showApproximation
            ? `Valeur exacte — approché : ${result.approximate}`
            : "Valeur exacte"
          : "Valeur approchée — aucune forme exacte disponible"}
      </p>
    </div>
  );
}
