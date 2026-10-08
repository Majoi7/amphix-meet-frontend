import { useEffect } from "react";

/**
 * Délai laissé à la transition de rotation pour se terminer avant la seconde
 * mesure. Assez long pour couvrir l'animation de la barre d'URL d'iOS, assez
 * court pour être invisible.
 */
const ORIENTATION_SETTLE_MS = 250;

/**
 * SOURCE DE VÉRITÉ UNIQUE de la hauteur de la surface de l'application.
 *
 * ── Pourquoi ce hook existe ────────────────────────────────────────────────
 *
 * `.app-viewport` déclarait `height: 100vh` puis `height: 100dvh`. Sur un
 * navigateur qui connaît `dvh`, tout va bien. Sur les autres — iOS < 15.4,
 * Chrome < 108 — la seconde déclaration est ignorée et c'est `100vh` qui
 * s'applique. Or `100vh` vaut la PLUS GRANDE hauteur possible, barre d'URL
 * masquée, et surtout il n'est PAS recalculé à la rotation.
 *
 * Conséquence en cascade, et c'est le bug constaté :
 *   1. la hauteur de `.app-viewport` ne change pas quand on tourne le
 *      téléphone ;
 *   2. le `<main>` qui contient la vidéo ne change donc pas de taille ;
 *   3. le `ResizeObserver` du moteur de layout n'a AUCUNE raison de se
 *      déclencher ;
 *   4. la surface de partage d'écran conserve les dimensions de l'ANCIENNE
 *      orientation.
 *
 * Le point 3 est le cœur du problème : `dvh` ne suffit pas, parce qu'il n'y a
 * rien à observer si la boîte n'a pas bougé. Il faut que la hauteur change
 * VRAIMENT, et pour cela qu'une source JS la pilote.
 *
 * ── Une seule source, pas des écouteurs partout ────────────────────────────
 *
 * Ce hook est monté une fois, au sommet de la page de réunion. Il écrit une
 * variable CSS sur `:root` ; tout le reste de l'application la consomme sans
 * rien savoir. Aucun composant n'ajoute d'écouteur de son côté.
 *
 * ── Pourquoi `visualViewport` ET `resize` ──────────────────────────────────
 *
 *  - `resize` couvre la rotation et le redimensionnement de fenêtre ;
 *  - `orientationchange` arrive AVANT que la nouvelle géométrie soit
 *    stabilisée sur iOS ; c'est le `resize` qui suit qui donne la bonne
 *    valeur — d'où une re-mesure différée, qui rattrape les cas où iOS
 *    publie une hauteur intermédiaire ;
 *  - `visualViewport` est le seul à voir le CLAVIER virtuel et la barre d'URL
 *    qui se rétracte. Il est ignoré pendant un pincement (`scale !== 1`) :
 *    sans cette garde, un zoom à deux doigts ferait s'effondrer la mise en
 *    page.
 *
 * Les écritures sont regroupées dans une frame d'animation : pendant une
 * rotation, les trois sources peuvent notifier plusieurs fois de suite, et
 * une seule écriture par frame suffit.
 */
export function useViewportSize(): void {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let settleTimeout = 0;

    function apply() {
      frame = 0;
      const viewport = window.visualViewport;
      // `visualViewport.height` est la hauteur RÉELLEMENT visible — celle qui
      // tient compte du clavier virtuel et de la barre d'URL rétractée. Hors
      // pincement (`scale === 1`) c'est la bonne valeur ; sinon on retombe sur
      // `window.innerHeight`, qui est toujours une valeur saine.
      const height =
        viewport && viewport.scale === 1 ? viewport.height : window.innerHeight;
      if (height > 0) {
        root.style.setProperty("--app-height", `${Math.round(height)}px`);
      }
    }

    function schedule() {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    }

    /**
     * Rotation : la géométrie définitive n'est pas encore connue quand
     * `orientationchange` est émis. Une seconde mesure, une fois la
     * transition terminée, garantit que le moteur de layout reçoit bien les
     * dimensions de la NOUVELLE orientation.
     */
    function handleOrientationChange() {
      schedule();
      window.clearTimeout(settleTimeout);
      settleTimeout = window.setTimeout(schedule, ORIENTATION_SETTLE_MS);
    }

    apply();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", handleOrientationChange);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimeout);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", handleOrientationChange);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      root.style.removeProperty("--app-height");
    };
  }, []);
}
