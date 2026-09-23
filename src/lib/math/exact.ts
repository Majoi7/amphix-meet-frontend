import type { MathNode } from "./ast";
import { MathError } from "./errors";

/**
 * Arithmétique EXACTE sur les rationnels.
 *
 * Ce module ne « devine » jamais une forme exacte. Il répond soit une
 * valeur exacte véritable, soit `null` — et l'interface affiche alors
 * clairement qu'aucune forme exacte n'est disponible. C'est la différence
 * entre « Exact : 3/4 » (vrai) et « Exact : √2 » (qu'un moteur flottant
 * est incapable de produire sans un moteur symbolique complet).
 *
 * Ce qui est réellement exact ici :
 *   +  -  ×  ÷  ^(entier)  !         sur des rationnels
 *   sqrt d'un carré parfait (y compris une fraction de carrés parfaits)
 *   abs, sign, floor, ceil, round, trunc
 *
 * Ce qui ne l'est pas — et est donc annoncé comme tel :
 *   pi, e, tau, x, et toute fonction transcendante (sin, ln, exp, …).
 */

export interface Rational {
  /** Numérateur, porteur du signe. */
  n: bigint;
  /** Dénominateur, toujours strictement positif. */
  d: bigint;
}

/** Au-delà, la forme exacte n'apporte plus rien à l'écran : on préfère
 *  annoncer « non disponible » plutôt que d'afficher 400 chiffres. */
const MAX_DIGITS = 400;
const MAX_EXPONENT = 512;

function abs(a: bigint): bigint {
  return a < 0n ? -a : a;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function make(n: bigint, d: bigint): Rational {
  if (d === 0n) throw new MathError("DIVISION_BY_ZERO", "Division par zéro impossible.");
  const sign = d < 0n ? -1n : 1n;
  const divisor = gcd(n, d);
  if (divisor === 0n) return { n: 0n, d: 1n };
  return { n: (n * sign) / divisor, d: (d * sign) / divisor };
}

function digits(value: bigint): number {
  const text = abs(value).toString();
  return text.length;
}

function tooLarge(value: Rational): boolean {
  return digits(value.n) > MAX_DIGITS || digits(value.d) > MAX_DIGITS;
}

export const ZERO: Rational = { n: 0n, d: 1n };
export const ONE: Rational = { n: 1n, d: 1n };

export function add(a: Rational, b: Rational): Rational {
  return make(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function subtract(a: Rational, b: Rational): Rational {
  return make(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function multiply(a: Rational, b: Rational): Rational {
  return make(a.n * b.n, a.d * b.d);
}

export function divide(a: Rational, b: Rational): Rational {
  if (b.n === 0n) throw new MathError("DIVISION_BY_ZERO", "Division par zéro impossible.");
  return make(a.n * b.d, a.d * b.n);
}

export function negate(a: Rational): Rational {
  return { n: -a.n, d: a.d };
}

export function isInteger(a: Rational): boolean {
  return a.d === 1n;
}

export function toNumber(a: Rational): number {
  return Number(a.n) / Number(a.d);
}

export function equals(a: Rational, b: Rational): boolean {
  return a.n === b.n && a.d === b.d;
}

/** « 3 », « -3/4 », « 12/5 ». */
export function formatRational(a: Rational): string {
  return a.d === 1n ? a.n.toString() : `${a.n.toString()}/${a.d.toString()}`;
}

/** « 0.75 » → 3/4. La forme écrite est la source, pas le flottant. */
export function fromDecimal(text: string): Rational {
  const [integerPart, decimalPart = ""] = text.split(".");
  const numerator = BigInt(`${integerPart || "0"}${decimalPart}`);
  const denominator = 10n ** BigInt(decimalPart.length);
  return make(numerator, denominator);
}

/**
 * Conversion d'un flottant en rationnel — UNIQUEMENT s'il s'écrit comme un
 * décimal fini. `1e-7` ou `1/3` arrondi ne sont pas des décimaux exacts :
 * on renvoie `null` plutôt que d'inventer une fraction.
 */
export function fromNumber(value: number): Rational | null {
  if (!Number.isFinite(value)) return null;
  const text = value.toString();
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(text)) return null;
  const negative = text.startsWith("-");
  const magnitude = fromDecimal(negative ? text.slice(1) : text);
  return negative ? negate(magnitude) : magnitude;
}

function integerPower(base: Rational, exponent: number): Rational | null {
  if (Math.abs(exponent) > MAX_EXPONENT) return null;
  const power = BigInt(Math.abs(exponent));
  const result = make(base.n ** power, base.d ** power);
  if (tooLarge(result)) return null;
  if (exponent < 0) {
    if (result.n === 0n) throw new MathError("DIVISION_BY_ZERO", "Division par zéro impossible.");
    return make(result.d, result.n);
  }
  return result;
}

function isqrt(value: bigint): bigint {
  if (value < 2n) return value;
  let current = value;
  let next = (value + 1n) / 2n;
  while (next < current) {
    current = next;
    next = (current + value / current) / 2n;
  }
  return current;
}

function perfectSquareRoot(value: bigint): bigint | null {
  if (value < 0n) return null;
  const root = isqrt(value);
  return root * root === value ? root : null;
}

function floorDivide(a: bigint, b: bigint): bigint {
  const quotient = a / b;
  const remainder = a % b;
  if (remainder !== 0n && remainder < 0n !== b < 0n) return quotient - 1n;
  return quotient;
}

function factorialOf(value: Rational): Rational | null {
  if (!isInteger(value) || value.n < 0n) return null;
  if (value.n > 200n) return null;
  let result = 1n;
  for (let i = 2n; i <= value.n; i++) result *= i;
  return make(result, 1n);
}

/**
 * Évalue l'arbre en rationnel exact.
 *
 * `null` = cette expression n'a pas de forme rationnelle exacte.
 * Lève une `MathError` uniquement pour une faute réelle (division par zéro).
 *
 * `x` fournit la valeur EXACTE de la variable, quand elle en a une. Sans
 * lui, toute expression contenant `x` renvoie `null`.
 */
export function evaluateExact(node: MathNode, x: Rational | null = null): Rational | null {
  switch (node.kind) {
    case "number":
      return fromDecimal(node.text);

    case "constant":
      return null;

    case "variable":
      return x;

    case "unary": {
      const operand = evaluateExact(node.operand, x);
      if (operand === null) return null;
      return node.operator === "-" ? negate(operand) : operand;
    }

    case "factorial": {
      const operand = evaluateExact(node.operand, x);
      return operand === null ? null : factorialOf(operand);
    }

    case "binary": {
      const left = evaluateExact(node.left, x);
      const right = evaluateExact(node.right, x);
      if (left === null || right === null) {
        // Une division par un zéro EXACT reste fautive, même si l'autre
        // opérande n'a pas de forme exacte : on veut « Division par zéro
        // impossible », pas « forme exacte non disponible ».
        if (node.operator === "/" && right !== null && right.n === 0n) {
          throw new MathError("DIVISION_BY_ZERO", "Division par zéro impossible.");
        }
        return null;
      }

      switch (node.operator) {
        case "+":
          return add(left, right);
        case "-":
          return subtract(left, right);
        case "*":
          return multiply(left, right);
        case "/":
          return divide(left, right);
        case "^": {
          if (!isInteger(right)) return null;
          return integerPower(left, Number(right.n));
        }
      }
    }

    case "call": {
      const argument = evaluateExact(node.argument, x);
      if (argument === null) return null;

      switch (node.name) {
        case "abs":
          return make(abs(argument.n), argument.d);

        case "sign":
          return make(argument.n === 0n ? 0n : argument.n > 0n ? 1n : -1n, 1n);

        case "floor":
          return make(floorDivide(argument.n, argument.d), 1n);

        case "ceil":
          return make(-floorDivide(-argument.n, argument.d), 1n);

        case "trunc":
          return make(argument.n / argument.d, 1n);

        case "round":
          // Arrondi au plus proche, demi vers le haut : floor(x + 1/2).
          return make(floorDivide(2n * argument.n + argument.d, 2n * argument.d), 1n);

        case "sqrt": {
          if (argument.n < 0n) return null;
          const rootNumerator = perfectSquareRoot(argument.n);
          const rootDenominator = perfectSquareRoot(argument.d);
          if (rootNumerator === null || rootDenominator === null) return null;
          return make(rootNumerator, rootDenominator);
        }

        default:
          // sin, cos, ln, exp, … : transcendant, donc sans forme rationnelle.
          return null;
      }
    }
  }
}
