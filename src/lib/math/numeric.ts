import type { MathNode } from "./ast";
import { MathError } from "./errors";

/**
 * Évaluation en virgule flottante.
 *
 * DEUX MODES, et c'est volontaire :
 *
 *  - `strict: true`  — pour la calculatrice. Une division par zéro, une
 *    racine négative ou un logarithme de zéro lèvent une `MathError` avec
 *    une phrase lisible, au lieu de laisser filtrer `Infinity` ou `NaN`.
 *
 *  - `strict: false` — pour le TRACÉ. `cartesian.ts` a besoin des valeurs
 *    IEEE telles quelles : c'est `Infinity`/`NaN` qui lui permettent de
 *    couper une courbe en deux branches au lieu de relier artificiellement
 *    les deux côtés d'une asymptote. Lever une exception ici casserait le
 *    tracé de `1/x`, qui fonctionne aujourd'hui.
 */

const MAX_FACTORIAL = 170;

function factorial(n: number, strict: boolean): number {
  if (!Number.isInteger(n) || n < 0) {
    if (strict) {
      throw new MathError("OUT_OF_DOMAIN", "La factorielle attend un entier positif ou nul.");
    }
    return NaN;
  }
  if (n > MAX_FACTORIAL) {
    if (strict) {
      throw new MathError("OUT_OF_DOMAIN", `Factorielle trop grande (maximum ${MAX_FACTORIAL}!).`);
    }
    return Infinity;
  }
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function guardDomain(condition: boolean, message: string, strict: boolean): void {
  if (condition && strict) throw new MathError("OUT_OF_DOMAIN", message);
}

function applyFunction(name: string, argument: number, strict: boolean): number {
  switch (name) {
    case "sin":
      return Math.sin(argument);
    case "cos":
      return Math.cos(argument);
    case "tan":
      return Math.tan(argument);
    case "asin":
      guardDomain(argument < -1 || argument > 1, "asin attend une valeur entre -1 et 1.", strict);
      return Math.asin(argument);
    case "acos":
      guardDomain(argument < -1 || argument > 1, "acos attend une valeur entre -1 et 1.", strict);
      return Math.acos(argument);
    case "atan":
      return Math.atan(argument);
    case "sinh":
      return Math.sinh(argument);
    case "cosh":
      return Math.cosh(argument);
    case "tanh":
      return Math.tanh(argument);
    case "sqrt":
      guardDomain(argument < 0, "Racine carrée d'un nombre négatif : pas de solution réelle.", strict);
      return Math.sqrt(argument);
    case "cbrt":
      return Math.cbrt(argument);
    case "abs":
      return Math.abs(argument);
    case "exp":
      return Math.exp(argument);
    case "ln":
      guardDomain(argument <= 0, "Le logarithme népérien attend un nombre strictement positif.", strict);
      return Math.log(argument);
    case "log":
    case "log10":
      guardDomain(argument <= 0, "Le logarithme décimal attend un nombre strictement positif.", strict);
      return Math.log10(argument);
    case "log2":
      guardDomain(argument <= 0, "Le logarithme binaire attend un nombre strictement positif.", strict);
      return Math.log2(argument);
    case "floor":
      return Math.floor(argument);
    case "ceil":
      return Math.ceil(argument);
    case "round":
      return Math.round(argument);
    case "trunc":
      return Math.trunc(argument);
    case "sign":
      return Math.sign(argument);
    default:
      throw new MathError("UNSUPPORTED", `Fonction non prise en charge : « ${name} ».`);
  }
}

export function evaluateNumeric(node: MathNode, x: number, strict: boolean): number {
  switch (node.kind) {
    case "number":
      return node.value;

    case "constant":
      if (node.name === "pi") return Math.PI;
      if (node.name === "tau") return Math.PI * 2;
      return Math.E;

    case "variable":
      return x;

    case "unary": {
      const operand = evaluateNumeric(node.operand, x, strict);
      return node.operator === "-" ? -operand : operand;
    }

    case "factorial":
      return factorial(evaluateNumeric(node.operand, x, strict), strict);

    case "call":
      return applyFunction(node.name, evaluateNumeric(node.argument, x, strict), strict);

    case "binary": {
      const left = evaluateNumeric(node.left, x, strict);
      const right = evaluateNumeric(node.right, x, strict);

      if (node.operator === "+") return left + right;
      if (node.operator === "-") return left - right;
      if (node.operator === "*") return left * right;
      if (node.operator === "/") {
        if (right === 0 && strict) {
          throw new MathError("DIVISION_BY_ZERO", "Division par zéro impossible.");
        }
        return left / right;
      }

      const powered = Math.pow(left, right);
      if (strict && Number.isFinite(left) && Number.isFinite(right)) {
        if (Number.isNaN(powered)) {
          throw new MathError(
            "OUT_OF_DOMAIN",
            "Cette puissance n'a pas de valeur réelle (racine d'un nombre négatif)."
          );
        }
        if (!Number.isFinite(powered)) {
          throw new MathError("OUT_OF_DOMAIN", "Le résultat dépasse ce qui est calculable.");
        }
      }
      return powered;
    }
  }
}

/** Évaluation stricte : le résultat est un nombre exploitable, ou une erreur. */
export function evaluateStrict(node: MathNode, x: number): number {
  return evaluateNumeric(node, x, true);
}
