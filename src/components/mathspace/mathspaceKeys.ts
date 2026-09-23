/**
 * Garde des raccourcis clavier.
 *
 * Un raccourci global écoute la fenêtre entière : il reçoit donc aussi les
 * frappes destinées à un CHAMP DE SAISIE. Sans cette garde, écrire un nom
 * d'objet se terminerait par la suppression de cet objet — « Retour arrière »
 * effaçant un caractère ET l'objet, ce qui est le pire des deux mondes.
 *
 * `isContentEditable` est testé en plus des balises : un champ riche n'est pas
 * forcément un `<input>`.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}
