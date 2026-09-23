/**
 * Mise en forme des nombres.
 *
 * Règle unique : on n'affiche JAMAIS seize chiffres significatifs quand
 * douze suffisent. `0.30000000000000004` est une vérité de l'IEEE 754, pas
 * une réponse lisible pour un élève.
 */

const SIGNIFICANT_DIGITS = 12;

export function formatApproximate(value: number): string {
  if (Number.isNaN(value)) return "indéfini";
  if (value === Infinity) return "+∞";
  if (value === -Infinity) return "−∞";
  if (Object.is(value, -0)) return "0";

  if (Number.isInteger(value) && Math.abs(value) < 1e15) {
    return value.toString();
  }

  const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS));
  // `toPrecision` peut produire une notation exponentielle : on la garde,
  // elle est plus lisible que 0.000000000001.
  return rounded.toString();
}

/** Nombre lisible pour un tableau de valeurs, avec largeur stable. */
export function formatTableValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const formatted = formatApproximate(value);
  return formatted.length > 14 ? Number(value.toPrecision(6)).toString() : formatted;
}

export function formatInteger(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toString() : "—";
}
