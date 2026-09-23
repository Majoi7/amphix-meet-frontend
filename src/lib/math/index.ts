import type { MathNode } from "./ast";
import { usesVariable } from "./ast";
import { MathError, messageOf, type MathErrorCode } from "./errors";
import { evaluateExact, formatRational, fromNumber, type Rational } from "./exact";
import { formatApproximate } from "./format";
import { evaluateNumeric, evaluateStrict } from "./numeric";
import { parse } from "./parser";

/**
 * API publique du moteur mathématique.
 *
 * Trois points d'entrée, trois usages :
 *   - `compileExpression` — pour le tracé (compatibilité `cartesian.ts`).
 *     Ne lève que sur une faute de syntaxe, et propage `Infinity`/`NaN`
 *     comme le fait IEEE, ce dont le découpage en segments a besoin.
 *   - `evaluateConstant`  — pour la calculatrice. Valeur constante exigée.
 *   - `evaluateAt`        — pour le tableau de valeurs d'une fonction.
 *
 * Aucun de ces points d'entrée n'expose `NaN` ou `Infinity` à l'écran :
 * tout passe par `status: "error"` avec une phrase française.
 */

export interface EvaluationSuccess {
  status: "ok";
  source: string;
  /** Forme exacte affichable (« 3/4 », « 5 »), ou `null` si elle n'existe pas. */
  exact: string | null;
  exactRational: Rational | null;
  approximate: string;
  approximateValue: number;
}

export interface EvaluationFailure {
  status: "error";
  code: MathErrorCode;
  message: string;
}

export type Evaluation = EvaluationSuccess | EvaluationFailure;

function failure(error: unknown): EvaluationFailure {
  return {
    status: "error",
    code: error instanceof MathError ? error.code : "SYNTAX",
    message: messageOf(error),
  };
}

/** Compile une expression en fonction de x. Compatible avec `cartesian.ts`. */
export function compileExpression(source: string): (x: number) => number {
  const node = parse(source);
  return (x: number) => evaluateNumeric(node, x, false);
}

export type CompiledFunction =
  | { status: "ok"; source: string; evaluate: (x: number) => number }
  | EvaluationFailure;

/**
 * Compile une expression en fonction de x SANS LEVER : une faute de syntaxe
 * devient une valeur de retour, pas une exception.
 *
 * C'est la forme qu'utilisent le tracé et le tableau de valeurs : ils
 * affichent « Expression invalide » à côté du champ fautif, au lieu de
 * laisser une exception interrompre le rendu de toute la page.
 *
 * Évaluation NON stricte, volontairement : `Infinity` et `NaN` doivent
 * remonter tels quels pour que le tracé coupe une courbe au niveau d'une
 * asymptote (`1/x`) plutôt que de relier ses deux branches.
 */
export function compileFunction(source: string): CompiledFunction {
  try {
    const node = parse(source);
    return {
      status: "ok",
      source,
      evaluate: (x: number) => evaluateNumeric(node, x, false),
    };
  } catch (error) {
    return failure(error);
  }
}

function buildSuccess(
  source: string,
  node: MathNode,
  x: number,
  xExact: Rational | null
): Evaluation {
  const approximateValue = evaluateStrict(node, x);
  const exactValue = evaluateExact(node, xExact);
  return {
    status: "ok",
    source,
    exact: exactValue === null ? null : formatRational(exactValue),
    exactRational: exactValue,
    approximate: formatApproximate(approximateValue),
    approximateValue,
  };
}

/** Évalue une expression SANS variable. « x » est refusé, pas évalué en 0. */
export function evaluateConstant(source: string): Evaluation {
  try {
    const node = parse(source);
    if (usesVariable(node)) {
      return {
        status: "error",
        code: "UNSUPPORTED",
        message:
          "Cette expression contient « x ». Utilise l'onglet Fonctions pour lui donner une valeur.",
      };
    }
    return buildSuccess(source, node, 0, null);
  } catch (error) {
    return failure(error);
  }
}

/** Évalue une expression en x = valeur. */
export function evaluateAt(source: string, x: number): Evaluation {
  try {
    const node = parse(source);
    return buildSuccess(source, node, x, fromNumber(x));
  } catch (error) {
    return failure(error);
  }
}

export { parse, usesVariable };
export type { MathNode };
