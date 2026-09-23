import { MathError } from "./errors";

/**
 * Découpage en jetons.
 *
 * Différences assumées avec l'ancien tokenizer (`lib/mathExpression.ts`) :
 *  - un nombre mal formé (« 2.3.4 », « . ») est REFUSÉ au lieu d'être
 *    tronqué en silence par `parseFloat` — c'était un résultat faux sans
 *    aucun signal ;
 *  - la virgule est acceptée comme séparateur décimal (« 1,5 »), parce que
 *    c'est ce qu'un utilisateur francophone tape.
 */
export type TokenType =
  | "number"
  | "identifier"
  | "operator"
  | "lparen"
  | "rparen"
  | "end";

export interface Token {
  type: TokenType;
  /** Valeur normalisée : la virgule décimale y est déjà devenue un point. */
  value: string;
  /** Forme réellement écrite, pour les messages d'erreur. */
  raw: string;
  /** Position du premier caractère — utile pour situer une erreur. */
  start: number;
}

const OPERATORS = "+-*/^!";

/**
 * Écritures typographiques d'un opérateur, ramenées à leur forme ASCII.
 *
 * Un utilisateur qui colle « 3 × 4 » — ou qui tape « − » (U+2212, le moins
 * typographique, celui des claviers de téléphone) — doit obtenir un
 * résultat, pas « Caractère inattendu ». Le clavier de MathSpace insère la
 * forme ASCII, donc ces alias ne servent qu'à l'entrée extérieure
 * (collage, clavier physique en configuration typographique).
 */
const OPERATOR_ALIASES: Record<string, string> = {
  "×": "*",
  "·": "*",
  "∗": "*",
  "÷": "/",
  "∕": "/",
  "−": "-",
  "–": "-",
};

const NUMBER_PATTERN = /^(\d+(\.\d+)?|\.\d+)$/;

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isLetter(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (isDigit(c) || c === "." || c === ",") {
      const start = i;
      let text = "";
      let hasSeparator = false;

      while (i < input.length) {
        const ch = input[i];
        if (isDigit(ch)) {
          text += ch;
          i++;
          continue;
        }
        if (ch === "." || ch === ",") {
          if (hasSeparator) {
            throw new MathError(
              "SYNTAX",
              `Nombre mal formé : « ${input.slice(start, i + 1)} ». Un seul séparateur décimal est autorisé.`
            );
          }
          hasSeparator = true;
          text += ".";
          i++;
          continue;
        }
        break;
      }

      if (!NUMBER_PATTERN.test(text)) {
        throw new MathError("SYNTAX", `Nombre mal formé : « ${input.slice(start, i)} ».`);
      }

      tokens.push({ type: "number", value: text, raw: input.slice(start, i), start });
      continue;
    }

    if (isLetter(c)) {
      const start = i;
      while (i < input.length && isLetter(input[i])) i++;
      const raw = input.slice(start, i);
      tokens.push({ type: "identifier", value: raw.toLowerCase(), raw, start });
      continue;
    }

    const operator = OPERATORS.includes(c) ? c : OPERATOR_ALIASES[c];
    if (operator !== undefined) {
      // `raw` garde le caractère réellement écrit : un message d'erreur doit
      // citer ce que l'utilisateur a sous les yeux, pas notre forme interne.
      tokens.push({ type: "operator", value: operator, raw: c, start: i });
      i++;
      continue;
    }

    if (c === "(") {
      tokens.push({ type: "lparen", value: c, raw: c, start: i });
      i++;
      continue;
    }

    if (c === ")") {
      tokens.push({ type: "rparen", value: c, raw: c, start: i });
      i++;
      continue;
    }

    if (c === "=") {
      throw new MathError(
        "SYNTAX",
        "Un seul membre à la fois : « = » n'est accepté que dans l'onglet Équations."
      );
    }

    throw new MathError("SYNTAX", `Caractère inattendu : « ${c} ».`);
  }

  tokens.push({ type: "end", value: "", raw: "", start: input.length });
  return tokens;
}
