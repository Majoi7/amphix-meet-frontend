/**
 * Arbre syntaxique d'une expression mathématique.
 *
 * Le parseur produit cet arbre — il n'évalue rien. C'est ce qui permet
 * d'évaluer DEUX FOIS la même expression : une fois en flottant
 * (`numeric.ts`, pour l'approximation et le tracé) et une fois en
 * rationnels exacts (`exact.ts`, pour la forme exacte). Un évaluateur
 * unique renvoyant un `number` rendrait la seconde passe impossible.
 */

export type BinaryOperator = "+" | "-" | "*" | "/" | "^";
export type UnaryOperator = "+" | "-";

export type MathFunctionName =
  | "sin"
  | "cos"
  | "tan"
  | "asin"
  | "acos"
  | "atan"
  | "sinh"
  | "cosh"
  | "tanh"
  | "sqrt"
  | "cbrt"
  | "abs"
  | "exp"
  | "ln"
  | "log"
  | "log10"
  | "log2"
  | "floor"
  | "ceil"
  | "round"
  | "trunc"
  | "sign";

export type MathConstantName = "pi" | "e" | "tau";

export type MathNode =
  /** `text` conserve la forme écrite (« 0.75 ») : c'est elle, et non le
   *  flottant, qui donne la valeur exacte en rationnel. */
  | { kind: "number"; value: number; text: string }
  | { kind: "constant"; name: MathConstantName }
  | { kind: "variable" }
  | { kind: "unary"; operator: UnaryOperator; operand: MathNode }
  | { kind: "binary"; operator: BinaryOperator; left: MathNode; right: MathNode }
  | { kind: "call"; name: MathFunctionName; argument: MathNode }
  | { kind: "factorial"; operand: MathNode };

/** `x` apparaît-il dans l'arbre ? Sert à refuser « x+1 » là où l'on attend
 *  une valeur constante, au lieu de l'évaluer silencieusement en x = 0. */
export function usesVariable(node: MathNode): boolean {
  switch (node.kind) {
    case "variable":
      return true;
    case "number":
    case "constant":
      return false;
    case "unary":
      return usesVariable(node.operand);
    case "binary":
      return usesVariable(node.left) || usesVariable(node.right);
    case "call":
      return usesVariable(node.argument);
    case "factorial":
      return usesVariable(node.operand);
  }
}
