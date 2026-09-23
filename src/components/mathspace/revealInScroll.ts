/**
 * Défilement horizontal : ramener un élément dans le champ visible.
 *
 * DEUX BARRES SONT CONCERNÉES — les onglets d'outils et la barre d'outils de
 * géométrie — et toutes deux défilent au lieu de se replier quand la place
 * manque. Le même calcul sert donc aux deux, et il est écrit une fois.
 *
 * POURQUOI PAS `scrollIntoView`
 *
 * `scrollIntoView` remet l'élément dans le champ de TOUS ses ancêtres qui
 * défilent, page comprise. Armer un outil depuis les raccourcis de l'accueil
 * aurait alors pu faire sauter la zone de travail verticalement, pour un
 * geste qui ne concernait que la barre. On n'agit donc que sur le défilement
 * du conteneur, jamais sur celui de la page.
 *
 * Le défilement est INSTANTANÉ, sans animation : une préférence système
 * « animations réduites » n'a pas à être interrogée pour un repositionnement,
 * et un glissement animé attirerait l'œil sur un détail de mise en page au
 * moment précis où l'utilisateur regarde le graphe.
 */

/** Marge laissée entre le bord de la barre et l'élément ramené dans le champ —
 *  sans elle, le bouton actif collerait au bord et son contour serait rogné. */
const MARGIN = 8;

export function revealHorizontally(
  container: HTMLElement | null,
  item: HTMLElement | null
): void {
  if (!container || !item) return;

  const containerBox = container.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();

  // Rien à faire si l'élément est déjà entièrement visible : c'est le cas
  // courant, et le test évite un `scrollBy` inutile à chaque rendu.
  if (itemBox.left < containerBox.left) {
    container.scrollBy({ left: itemBox.left - containerBox.left - MARGIN });
  } else if (itemBox.right > containerBox.right) {
    container.scrollBy({ left: itemBox.right - containerBox.right + MARGIN });
  }
}
