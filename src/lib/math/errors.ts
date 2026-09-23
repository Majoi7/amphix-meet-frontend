/**
 * Erreurs mathématiques typées.
 *
 * Toutes les erreurs montrées à l'utilisateur passent par ici : jamais un
 * `NaN` affiché tel quel, jamais un message JavaScript brut. Le `code`
 * permet à l'interface de choisir une présentation, le `message` est la
 * phrase française réellement lue.
 */
export type MathErrorCode =
  | "EMPTY"
  | "SYNTAX"
  | "UNKNOWN_NAME"
  | "MISSING_PAREN"
  | "DIVISION_BY_ZERO"
  | "OUT_OF_DOMAIN"
  | "UNSUPPORTED";

export class MathError extends Error {
  readonly code: MathErrorCode;

  constructor(code: MathErrorCode, message: string) {
    super(message);
    this.name = "MathError";
    this.code = code;
  }
}

/** Message lisible pour n'importe quoi — y compris ce qui n'est pas une Error. */
export function messageOf(error: unknown): string {
  if (error instanceof MathError) return error.message;
  if (error instanceof Error) return error.message;
  return "Expression invalide.";
}
