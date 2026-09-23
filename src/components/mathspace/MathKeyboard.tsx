import { Delete, Equal } from "lucide-react";

/**
 * Clavier mathématique.
 *
 * TROIS RÈGLES, TOUTES NÉCESSAIRES
 *
 * 1. `onMouseDown` est neutralisé sur chaque touche. Sans cela, le clic
 *    déplacerait le focus du champ vers le bouton, la position du curseur
 *    serait perdue, et le clavier physique cesserait de fonctionner après
 *    le premier clic. Le champ garde donc le focus en permanence.
 * 2. La touche affiche un glyphe lisible (« × », « ÷ », « √ ») mais insère
 *    la forme que le moteur comprend réellement (« * », « / », « sqrt() »).
 *    L'affichage et la saisie restent ainsi synchronisés : ce que montre le
 *    champ est exactement ce qui sera évalué.
 * 3. Tout ce qui n'est pas dans le moteur n'est pas sur ce clavier. Il n'y a
 *    ni cot, ni sec, ni matrice, ni dérivée — les proposer serait mentir sur
 *    ce que l'application sait faire.
 */

type KeyAction = "insert" | "backspace" | "clear" | "submit";

interface KeyDef {
  /** Ce qui est écrit sur la touche. */
  label: string;
  /** Ce qui est réellement inséré dans le champ (par défaut : `label`). */
  insert?: string;
  /** Caractères ajoutés APRÈS le curseur (fermetures automatiques). */
  caretBack?: number;
  /** Nom accessible — obligatoire, aucune touche n'est une icône nue. */
  aria: string;
  tone?: "digit" | "op" | "util";
  action?: KeyAction;
}

const ROWS: KeyDef[][] = [
  [
    { label: "C", aria: "Effacer tout", tone: "util", action: "clear" },
    { label: "⌫", aria: "Effacer le dernier caractère", tone: "util", action: "backspace" },
    { label: "(", aria: "Parenthèse ouvrante" },
    { label: ")", aria: "Parenthèse fermante" },
    { label: "÷", insert: "/", aria: "Diviser", tone: "op" },
  ],
  [
    { label: "7", aria: "7" },
    { label: "8", aria: "8" },
    { label: "9", aria: "9" },
    { label: "^", aria: "Puissance", tone: "op" },
    { label: "×", insert: "*", aria: "Multiplier", tone: "op" },
  ],
  [
    { label: "4", aria: "4" },
    { label: "5", aria: "5" },
    { label: "6", aria: "6" },
    { label: "√", insert: "sqrt()", caretBack: 1, aria: "Racine carrée", tone: "op" },
    { label: "−", insert: "-", aria: "Soustraire", tone: "op" },
  ],
  [
    { label: "1", aria: "1" },
    { label: "2", aria: "2" },
    { label: "3", aria: "3" },
    { label: "x", aria: "Variable x", tone: "op" },
    { label: "+", aria: "Ajouter", tone: "op" },
  ],
  [
    { label: "0", aria: "0" },
    { label: ",", aria: "Virgule décimale" },
    { label: "π", insert: "pi", aria: "Constante pi", tone: "op" },
    { label: "e", aria: "Constante e", tone: "op" },
    { label: "=", aria: "Calculer", tone: "op", action: "submit" },
  ],
];

/**
 * Fonctions et opérateurs complémentaires. Chaque entrée insère un appel
 * COMPLET (`sin()`) et laisse le curseur entre les parenthèses.
 */
const CHIPS: KeyDef[] = [
  { label: "sin", insert: "sin()", caretBack: 1, aria: "Sinus" },
  { label: "cos", insert: "cos()", caretBack: 1, aria: "Cosinus" },
  { label: "tan", insert: "tan()", caretBack: 1, aria: "Tangente" },
  { label: "ln", insert: "ln()", caretBack: 1, aria: "Logarithme népérien" },
  { label: "log", insert: "log()", caretBack: 1, aria: "Logarithme décimal" },
  { label: "exp", insert: "exp()", caretBack: 1, aria: "Exponentielle" },
  { label: "abs", insert: "abs()", caretBack: 1, aria: "Valeur absolue" },
  { label: "∛", insert: "cbrt()", caretBack: 1, aria: "Racine cubique" },
  { label: "x²", insert: "^2", aria: "Élever au carré" },
  { label: "n!", insert: "!", aria: "Factorielle" },
];

export function MathKeyboard({
  onInsert,
  onBackspace,
  onClear,
  onSubmit,
}: {
  /** Insère du texte à la position du curseur du champ actif. */
  onInsert: (text: string, caretBack?: number) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  function run(key: KeyDef) {
    switch (key.action) {
      case "clear":
        onClear();
        return;
      case "backspace":
        onBackspace();
        return;
      case "submit":
        onSubmit();
        return;
      default:
        onInsert(key.insert ?? key.label, key.caretBack ?? 0);
    }
  }

  // Le clic ne doit JAMAIS prendre le focus : voir règle 1 en tête de fichier.
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Clavier mathématique">
      <div className="grid grid-cols-5 gap-1.5">
        {ROWS.flat().map((key) => (
          <button
            key={`${key.aria}-${key.label}`}
            type="button"
            onMouseDown={keepFocus}
            onClick={() => run(key)}
            aria-label={key.aria}
            title={key.aria}
            className={`app-key ${key.tone === "op" ? "app-key-op" : ""} ${
              key.tone === "util" ? "app-key-util" : ""
            }`}
          >
            {key.action === "backspace" ? (
              <Delete size={16} aria-hidden="true" />
            ) : key.action === "submit" ? (
              <Equal size={16} aria-hidden="true" />
            ) : (
              key.label
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip.aria}
            type="button"
            onMouseDown={keepFocus}
            onClick={() => run(chip)}
            aria-label={chip.aria}
            title={chip.aria}
            className="app-chip app-mono"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Petit rappel des raccourcis physiques, à côté du clavier. */
export function MathKeyboardHints() {
  return (
    <p
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
      style={{ color: "var(--app-text-subtle)" }}
    >
      <span className="inline-flex items-center gap-1.5">
        <kbd className="app-kbd">Entrée</kbd> calculer
      </span>
      <span className="inline-flex items-center gap-1.5">
        <kbd className="app-kbd">Échap</kbd> effacer
      </span>
      <span>
        La multiplication peut s&apos;omettre : <span className="app-mono">2x</span>,{" "}
        <span className="app-mono">3(x+1)</span>
      </span>
    </p>
  );
}
