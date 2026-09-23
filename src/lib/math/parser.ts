import type {
  BinaryOperator,
  MathConstantName,
  MathFunctionName,
  MathNode,
  UnaryOperator,
} from "./ast";
import { MathError } from "./errors";
import { tokenize, type Token } from "./tokenizer";

/**
 * Parseur descendant récursif — sans `eval()` ni `new Function()`.
 *
 * Grammaire (du plus lâche au plus serré) :
 *
 *   expression  := somme
 *   somme       := produit (('+' | '-') produit)*
 *   produit     := unaire (('*' | '/' | IMPLICITE) unaire)*
 *   unaire      := ('-' | '+') unaire | puissance
 *   puissance   := suffixe ('^' unaire)?          // right-associatif
 *   suffixe     := primaire '!'*
 *   primaire    := nombre | identifiant | '(' somme ')'
 *
 * Deux ajouts par rapport à l'ancien moteur, tous deux réels :
 *  - la MULTIPLICATION IMPLICITE : `2x`, `2(x+1)`, `x(x+1)`, `2pi`, `3sin(x)`.
 *    Elle a la précédence de `*`, donc `2x^2` vaut `2*(x^2)`.
 *  - la FACTORIELLE postfixée : `5!`.
 */

const CONSTANTS: Record<string, MathConstantName> = {
  pi: "pi",
  e: "e",
  tau: "tau",
};

const FUNCTIONS: Record<string, MathFunctionName> = {
  sin: "sin",
  cos: "cos",
  tan: "tan",
  asin: "asin",
  acos: "acos",
  atan: "atan",
  sinh: "sinh",
  cosh: "cosh",
  tanh: "tanh",
  sqrt: "sqrt",
  cbrt: "cbrt",
  abs: "abs",
  exp: "exp",
  ln: "ln",
  log: "log",
  log10: "log10",
  log2: "log2",
  floor: "floor",
  ceil: "ceil",
  round: "round",
  trunc: "trunc",
  sign: "sign",
};

/** Noms connus mais volontairement non implémentés : le message le dit,
 *  plutôt que de laisser croire à une faute de frappe. */
const KNOWN_UNSUPPORTED = new Set(["cot", "sec", "csc", "min", "max", "gcd", "lcm", "mod"]);

export function functionNames(): MathFunctionName[] {
  return Object.values(FUNCTIONS);
}

export function constantNames(): MathConstantName[] {
  return Object.values(CONSTANTS);
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.position];
  }

  private next(): Token {
    return this.tokens[this.position++];
  }

  parse(): MathNode {
    if (this.peek().type === "end") {
      throw new MathError("EMPTY", "Saisis une expression pour commencer.");
    }
    const node = this.parseSum();
    const token = this.peek();
    if (token.type !== "end") {
      throw new MathError("SYNTAX", `Expression invalide près de « ${token.raw} ».`);
    }
    return node;
  }

  private parseSum(): MathNode {
    let left = this.parseProduct();
    for (;;) {
      const token = this.peek();
      if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
        this.next();
        const right = this.parseProduct();
        left = { kind: "binary", operator: token.value as BinaryOperator, left, right };
        continue;
      }
      return left;
    }
  }

  private parseProduct(): MathNode {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (token.type === "operator" && (token.value === "*" || token.value === "/")) {
        this.next();
        const right = this.parseUnary();
        left = { kind: "binary", operator: token.value as BinaryOperator, left, right };
        continue;
      }
      // Multiplication implicite : un opérande peut commencer sans opérateur.
      if (this.startsPrimary(token)) {
        const right = this.parseUnary();
        left = { kind: "binary", operator: "*", left, right };
        continue;
      }
      return left;
    }
  }

  /** Un jeton peut-il débuter un opérande ? */
  private startsPrimary(token: Token): boolean {
    return (
      token.type === "number" || token.type === "identifier" || token.type === "lparen"
    );
  }

  private parseUnary(): MathNode {
    const token = this.peek();
    if (token.type === "operator" && (token.value === "-" || token.value === "+")) {
      this.next();
      const operand = this.parseUnary();
      return { kind: "unary", operator: token.value as UnaryOperator, operand };
    }
    return this.parsePower();
  }

  private parsePower(): MathNode {
    const base = this.parsePostfix();
    const token = this.peek();
    if (token.type === "operator" && token.value === "^") {
      this.next();
      // Right-associatif, et accepte un exposant unaire (`2^-1`).
      const exponent = this.parseUnary();
      return { kind: "binary", operator: "^", left: base, right: exponent };
    }
    return base;
  }

  private parsePostfix(): MathNode {
    let node = this.parsePrimary();
    for (;;) {
      const token = this.peek();
      if (token.type === "operator" && token.value === "!") {
        this.next();
        node = { kind: "factorial", operand: node };
        continue;
      }
      return node;
    }
  }

  private parsePrimary(): MathNode {
    const token = this.peek();

    if (token.type === "number") {
      this.next();
      return { kind: "number", value: Number(token.value), text: token.value };
    }

    if (token.type === "lparen") {
      this.next();
      const inner = this.parseSum();
      const closing = this.peek();
      if (closing.type !== "rparen") {
        throw new MathError("MISSING_PAREN", "Parenthèse fermante manquante.");
      }
      this.next();
      return inner;
    }

    if (token.type === "identifier") {
      this.next();
      const name = token.value;

      if (name === "x") return { kind: "variable" };

      if (name in CONSTANTS) return { kind: "constant", name: CONSTANTS[name] };

      if (name in FUNCTIONS) {
        const opening = this.peek();
        if (opening.type !== "lparen") {
          throw new MathError(
            "MISSING_PAREN",
            `« ${token.raw} » est une fonction : écris « ${token.raw}(…) ».`
          );
        }
        this.next();
        const argument = this.parseSum();
        const closing = this.peek();
        if (closing.type !== "rparen") {
          throw new MathError("MISSING_PAREN", "Parenthèse fermante manquante.");
        }
        this.next();
        return { kind: "call", name: FUNCTIONS[name], argument };
      }

      if (KNOWN_UNSUPPORTED.has(name)) {
        throw new MathError("UNSUPPORTED", `Fonction non prise en charge : « ${token.raw} ».`);
      }

      throw new MathError(
        "UNKNOWN_NAME",
        `Nom inconnu : « ${token.raw} ». La seule variable disponible est « x ».`
      );
    }

    if (token.type === "rparen") {
      throw new MathError("SYNTAX", "Parenthèse fermante sans parenthèse ouvrante.");
    }

    throw new MathError("SYNTAX", `Expression invalide près de « ${token.raw} ».`);
  }
}

/** Analyse une expression et renvoie son arbre. Lève une `MathError` sinon. */
export function parse(source: string): MathNode {
  if (source.trim() === "") {
    throw new MathError("EMPTY", "Saisis une expression pour commencer.");
  }
  return new Parser(tokenize(source)).parse();
}

/** Analyse un membre d'équation. Même grammaire, message adapté au contexte. */
export function parseSide(source: string, label: string): MathNode {
  try {
    return parse(source);
  } catch (error) {
    if (error instanceof MathError && error.code === "EMPTY") {
      throw new MathError("EMPTY", `Le membre ${label} de l'équation est vide.`);
    }
    throw error;
  }
}
