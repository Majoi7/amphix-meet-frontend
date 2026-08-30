/**
 * Parseur/évaluateur d'expressions à une variable (x), sans jamais
 * utiliser eval() ou new Function() — parsing manuel récursif descendant.
 * Supporte : + - * / ^, parenthèses, fonctions (sin, cos, tan, sqrt, abs,
 * log [base 10], ln [népérien], exp), constantes (pi, e).
 *
 * Limitation connue : pas de multiplication implicite — "2x" doit
 * s'écrire "2*x". Indiqué dans le placeholder du champ côté UI.
 */

type TokenType = "number" | "identifier" | "operator" | "lparen" | "rparen" | "end";
interface Token {
  type: TokenType;
  value: string;
}

const FUNCTIONS: Record<string, (a: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ type: "number", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
      tokens.push({ type: "identifier", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^".includes(c)) {
      tokens.push({ type: "operator", value: c });
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ type: "lparen", value: c });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen", value: c });
      i++;
      continue;
    }
    throw new Error(`Caractère inattendu : "${c}"`);
  }
  tokens.push({ type: "end", value: "" });
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }

  parseExpression(): (x: number) => number {
    const node = this.parseAddSub();
    if (this.peek().type !== "end") {
      throw new Error(`Expression invalide près de "${this.peek().value}"`);
    }
    return node;
  }

  private parseAddSub(): (x: number) => number {
    let left = this.parseMulDiv();
    while (
      this.peek().type === "operator" &&
      (this.peek().value === "+" || this.peek().value === "-")
    ) {
      const op = this.next().value;
      const right = this.parseMulDiv();
      const prevLeft = left;
      left = op === "+" ? (x) => prevLeft(x) + right(x) : (x) => prevLeft(x) - right(x);
    }
    return left;
  }

  private parseMulDiv(): (x: number) => number {
    let left = this.parsePower();
    while (
      this.peek().type === "operator" &&
      (this.peek().value === "*" || this.peek().value === "/")
    ) {
      const op = this.next().value;
      const right = this.parsePower();
      const prevLeft = left;
      left = op === "*" ? (x) => prevLeft(x) * right(x) : (x) => prevLeft(x) / right(x);
    }
    return left;
  }

  private parsePower(): (x: number) => number {
    const base = this.parseUnary();
    if (this.peek().type === "operator" && this.peek().value === "^") {
      this.next();
      const exponent = this.parsePower(); // right-associatif
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  }

  private parseUnary(): (x: number) => number {
    if (this.peek().type === "operator" && this.peek().value === "-") {
      this.next();
      const operand = this.parseUnary();
      return (x) => -operand(x);
    }
    if (this.peek().type === "operator" && this.peek().value === "+") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): (x: number) => number {
    const token = this.peek();

    if (token.type === "number") {
      this.next();
      const value = parseFloat(token.value);
      return () => value;
    }

    if (token.type === "lparen") {
      this.next();
      const inner = this.parseAddSub();
      if (this.peek().type !== "rparen") throw new Error("Parenthèse fermante manquante.");
      this.next();
      return inner;
    }

    if (token.type === "identifier") {
      this.next();
      const name = token.value.toLowerCase();

      if (name === "x") return (x) => x;
      if (name in CONSTANTS) {
        const value = CONSTANTS[name];
        return () => value;
      }
      if (name in FUNCTIONS) {
        if (this.peek().type !== "lparen") throw new Error(`"${name}" attend une parenthèse.`);
        this.next();
        const arg = this.parseAddSub();
        if (this.peek().type !== "rparen") throw new Error("Parenthèse fermante manquante.");
        this.next();
        const fn = FUNCTIONS[name];
        return (x) => fn(arg(x));
      }
      throw new Error(`Fonction ou variable inconnue : "${token.value}"`);
    }

    throw new Error(`Expression invalide près de "${token.value}"`);
  }
}

/** Compile une expression en x (ex: "2*x^2 - 3*x + 1") en fonction évaluable. */
export function compileExpression(expr: string): (x: number) => number {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens);
  return parser.parseExpression();
}
