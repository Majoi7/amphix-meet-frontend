import type { MathNode } from "./ast";
import { MathError, messageOf } from "./errors";
import {
  add,
  divide,
  evaluateExact,
  formatRational,
  fromDecimal,
  isInteger,
  multiply,
  negate,
  toNumber,
  ZERO,
  type Rational,
} from "./exact";
import { parseSide } from "./parser";

/**
 * Résolution d'équations à une inconnue.
 *
 * Ce solveur est RÉEL, et volontairement borné : il résout exactement les
 * équations du premier et du second degré à coefficients rationnels.
 *
 *   2x + 4 = 10          →  x = 3
 *   x² - 5x + 6 = 0      →  x = 2  ou  x = 3
 *   x² = 2               →  x = −√2  ou  x = √2
 *
 * Tout ce qu'il ne sait pas faire est ANNONCÉ comme non pris en charge,
 * avec la raison — jamais approximé en silence :
 *   - degré supérieur à 2
 *   - x sous une fonction (sin(x) = 0.5, ln(x) = 1)
 *   - x au dénominateur (1/x = 2)
 *   - coefficients irrationnels (π·x = 1, √2·x = 1)
 *
 * Principe : chaque membre est converti en POLYNÔME de degré ≤ 2 à
 * coefficients rationnels exacts. Une fonction appliquée à une CONSTANTE
 * reste une constante exacte (√4 = 2) ; appliquée à x, elle sort du
 * domaine du solveur.
 */

type Polynomial = Rational[];

const MAX_DEGREE = 2;
const MAX_POWER = 4;

function isZero(value: Rational): boolean {
  return value.n === 0n;
}

function isNegative(value: Rational): boolean {
  return value.n < 0n;
}

/** Retire les coefficients de tête nuls : `length - 1` devient le degré. */
function trim(polynomial: Polynomial): Polynomial {
  const result = polynomial.slice();
  while (result.length > 0 && isZero(result[result.length - 1])) result.pop();
  return result;
}

function degreeOf(polynomial: Polynomial): number {
  return polynomial.length - 1;
}

function addPolynomials(a: Polynomial, b: Polynomial): Polynomial {
  const length = Math.max(a.length, b.length);
  const result: Polynomial = [];
  for (let i = 0; i < length; i++) {
    result.push(add(a[i] ?? ZERO, b[i] ?? ZERO));
  }
  return trim(result);
}

function scalePolynomial(polynomial: Polynomial, factor: Rational): Polynomial {
  return trim(polynomial.map((coefficient) => multiply(coefficient, factor)));
}

function negatePolynomial(polynomial: Polynomial): Polynomial {
  return trim(polynomial.map(negate));
}

function multiplyPolynomials(a: Polynomial, b: Polynomial): Polynomial | null {
  if (a.length === 0 || b.length === 0) return [];
  if (degreeOf(a) + degreeOf(b) > MAX_DEGREE) return null;
  const result: Polynomial = new Array(a.length + b.length - 1).fill(ZERO);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] = add(result[i + j], multiply(a[i], b[j]));
    }
  }
  return trim(result);
}

function powerPolynomial(base: Polynomial, exponent: number): Polynomial | null {
  if (exponent > MAX_POWER) return null;
  let result: Polynomial = [fromDecimal("1")];
  for (let i = 0; i < exponent; i++) {
    const next = multiplyPolynomials(result, base);
    if (next === null) return null;
    result = next;
  }
  return result;
}

/** Convertit un membre d'équation en polynôme. `null` = hors du domaine. */
function toPolynomial(node: MathNode): Polynomial | null {
  switch (node.kind) {
    case "number":
      return [fromDecimal(node.text)];

    case "variable":
      return [ZERO, fromDecimal("1")];

    case "constant":
      // π, e, tau : irrationnels, donc jamais un coefficient exact.
      return null;

    case "unary": {
      const operand = toPolynomial(node.operand);
      if (operand === null) return null;
      return node.operator === "-" ? negatePolynomial(operand) : operand;
    }

    case "factorial": {
      const operand = toPolynomial(node.operand);
      if (operand === null || degreeOf(operand) !== 0) return null;
      const value = evaluateExact(node);
      return value === null ? null : [value];
    }

    case "call": {
      // `sqrt(x)` sort du domaine ; `sqrt(4)` est une constante exacte.
      const argument = toPolynomial(node.argument);
      if (argument === null || degreeOf(argument) !== 0) return null;
      const value = evaluateExact(node);
      return value === null ? null : [value];
    }

    case "binary": {
      const left = toPolynomial(node.left);
      if (left === null) return null;

      if (node.operator === "^") {
        const exponent = toPolynomial(node.right);
        if (exponent === null || degreeOf(exponent) !== 0) return null;
        if (!isInteger(exponent[0]) || isNegative(exponent[0])) return null;
        return powerPolynomial(left, Number(exponent[0].n));
      }

      const right = toPolynomial(node.right);
      if (right === null) return null;

      if (node.operator === "+") return addPolynomials(left, right);
      if (node.operator === "-") return addPolynomials(left, negatePolynomial(right));
      if (node.operator === "*") return multiplyPolynomials(left, right);

      // Division : uniquement par une constante non nulle.
      if (degreeOf(right) !== 0) return null;
      if (isZero(right[0])) {
        throw new MathError("DIVISION_BY_ZERO", "Division par zéro impossible.");
      }
      return scalePolynomial(left, divide(fromDecimal("1"), right[0]));
    }
  }
}

export interface EquationSolution {
  /** Forme exacte affichable : « 3 », « -4/5 », « (-5 + √17) / 2 ». */
  exact: string;
  /** Forme rationnelle quand elle existe, sinon `null` (racine irrationnelle). */
  rational: Rational | null;
  approximate: number;
}

export type EquationResult =
  | { status: "solved"; degree: number; solutions: EquationSolution[]; note?: string }
  | { status: "identity" }
  | { status: "none" }
  | { status: "unsupported"; reason: string }
  /** Saisie fautive : parenthèse manquante, « = » absent, division par zéro. */
  | { status: "error"; message: string };

function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** Met (c, b, a) au même dénominateur puis multiplie pour obtenir des entiers. */
function toIntegerCoefficients(values: Rational[]): bigint[] {
  let common = 1n;
  for (const value of values) {
    common = (common / gcdBig(common, value.d)) * value.d;
  }
  return values.map((value) => value.n * (common / value.d));
}

function integerSqrt(value: bigint): bigint | null {
  if (value < 0n) return null;
  if (value < 2n) return value;
  let current = value;
  let next = (value + 1n) / 2n;
  while (next < current) {
    current = next;
    next = (current + value / current) / 2n;
  }
  return current * current === value ? current : null;
}

function rationalSolution(value: Rational): EquationSolution {
  return { exact: formatRational(value), rational: value, approximate: toNumber(value) };
}

function solveLinear(b: Rational, a: Rational): EquationResult {
  return { status: "solved", degree: 1, solutions: [rationalSolution(divide(negate(b), a))] };
}

function solveQuadratic(c: Rational, b: Rational, a: Rational): EquationResult {
  const [C, B, A] = toIntegerCoefficients([c, b, a]);
  const discriminant = B * B - 4n * A * C;

  if (discriminant < 0n) {
    return { status: "none" };
  }

  const twoA = 2n * A;

  if (discriminant === 0n) {
    const root = divide(fromDecimal((-B).toString()), fromDecimal(twoA.toString()));
    return {
      status: "solved",
      degree: 2,
      solutions: [rationalSolution(root)],
      note: "Discriminant nul : une racine double.",
    };
  }

  const squareRoot = integerSqrt(discriminant);
  if (squareRoot !== null) {
    const first = divide(
      fromDecimal((-B + squareRoot).toString()),
      fromDecimal(twoA.toString())
    );
    const second = divide(
      fromDecimal((-B - squareRoot).toString()),
      fromDecimal(twoA.toString())
    );
    const solutions = [rationalSolution(first), rationalSolution(second)].sort(
      (left, right) => left.approximate - right.approximate
    );
    return { status: "solved", degree: 2, solutions };
  }

  // Discriminant non carré parfait : les racines sont irrationnelles.
  // On les donne sous forme EXACTE (radical non simplifié), jamais
  // remplacées par une décimale présentée comme exacte.
  const minusB = -B;
  const twoAAbs = twoA < 0n ? -twoA : twoA;
  const squareRootApprox = Math.sqrt(Number(discriminant));
  const centre = Number(minusB) / Number(twoA);
  const spread = squareRootApprox / Number(twoAAbs);

  const render = (sign: 1 | -1): string => {
    const numerator = `${minusB.toString()} ${sign === 1 ? "+" : "−"} √${discriminant.toString()}`;
    return twoA === 1n ? numerator : `(${numerator}) / ${twoA.toString()}`;
  };

  return {
    status: "solved",
    degree: 2,
    solutions: [
      { exact: render(-1), rational: null, approximate: centre - spread },
      { exact: render(1), rational: null, approximate: centre + spread },
    ],
    note: "Discriminant non carré parfait : racines irrationnelles, données sous forme exacte.",
  };
}

/** Découpe « membre gauche = membre droit ». */
export function splitEquation(source: string): [string, string] {
  const parts = source.split("=");
  if (parts.length === 1) {
    throw new MathError("SYNTAX", "Il manque le signe « = ». Écris par exemple « 2x + 4 = 10 ».");
  }
  if (parts.length > 2) {
    throw new MathError("SYNTAX", "Une seule égalité est acceptée à la fois.");
  }
  return [parts[0], parts[1]];
}

/**
 * Résout une équation. NE LÈVE JAMAIS : une saisie fautive devient
 * `{ status: "error" }`, comme `compileFunction` le fait pour le tracé.
 * L'appelant affiche donc toujours quelque chose d'utile.
 */
export function solveEquation(source: string): EquationResult {
  if (source.trim() === "") {
    return { status: "error", message: "Saisis une équation pour commencer." };
  }

  let left: Polynomial | null;
  let right: Polynomial | null;
  try {
    const [leftSource, rightSource] = splitEquation(source);
    left = toPolynomial(parseSide(leftSource, "gauche"));
    right = toPolynomial(parseSide(rightSource, "droit"));
  } catch (error) {
    // « = » absent, parenthèse manquante, division par zéro, nom inconnu…
    return { status: "error", message: messageOf(error) };
  }

  if (left === null || right === null) {
    return {
      status: "unsupported",
      reason:
        "Ce solveur traite les équations du premier et du second degré à coefficients rationnels. " +
        "L'inconnue ne doit pas se trouver sous une fonction (sin, ln, √…), au dénominateur, " +
        "ni dans un coefficient irrationnel (π, e).",
    };
  }

  const polynomial = addPolynomials(left, negatePolynomial(right));
  const degree = degreeOf(polynomial);

  if (degree < 0) return { status: "identity" };
  if (degree === 0) return { status: "none" };
  if (degree === 1) return solveLinear(polynomial[0], polynomial[1]);
  if (degree === 2) return solveQuadratic(polynomial[0], polynomial[1], polynomial[2]);

  return {
    status: "unsupported",
    reason: `Équation de degré ${degree} : ce solveur s'arrête au second degré.`,
  };
}
