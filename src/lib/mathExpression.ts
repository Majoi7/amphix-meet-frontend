import { compileExpression as compile } from "./math";

/**
 * Point d'entrée historique du moteur d'expressions.
 *
 * Le parseur vit désormais dans `src/lib/math/` (tokenizer, parser, numeric,
 * exact, solve), mais cette fonction garde exactement le même contrat pour
 * ses appelants — `cartesian.ts`, et à travers lui `MathPanel.tsx` :
 * `(x: number) => number`, ne lève que sur une faute de syntaxe, et propage
 * `Infinity`/`NaN` (ce dont `sampleFunction` a besoin pour couper une
 * courbe au niveau d'une asymptote au lieu de relier ses deux branches).
 *
 * Ce que le moteur sait faire aujourd'hui (tout ceci était déjà vrai, sauf
 * les deux derniers points) :
 *   + - * / ^   parenthèses   unaire + et -   factorielle !
 *   sin cos tan asin acos atan sinh cosh tanh
 *   sqrt cbrt abs exp ln log(10) log10 log2
 *   floor ceil round trunc sign
 *   constantes : pi, e, tau      variable : x
 *
 * Ajouts par rapport à la version précédente :
 *   - la MULTIPLICATION IMPLICITE (« 2x », « 2(x+1) », « 2pi ») ;
 *   - la virgule décimale (« 1,5 ») ;
 *   - un nombre mal formé (« 2.3.4 ») est REFUSÉ au lieu d'être tronqué en
 *     silence par `parseFloat`, ce qui produisait un résultat faux.
 *
 * La forme exacte (rationnels) n'est PAS exposée ici : ce module ne rend
 * que des flottants. Voir `src/lib/math/index.ts` pour `evaluateConstant`
 * et `evaluateAt`, qui renvoient en plus la forme exacte.
 */
export function compileExpression(expr: string): (x: number) => number {
  return compile(expr);
}
