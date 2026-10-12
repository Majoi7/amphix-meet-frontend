import { useEffect, useRef } from "react";
import { FoxSVG } from "../pages/LandingPage";

/**
 * Le renard d'Amphix, animé, pour la page 404.
 *
 * Le dessin n'est PAS redéfini ici : il vient de `FoxSVG` (`LandingPage.tsx`),
 * la marque du site, utilisée telle quelle. Ce composant ne s'occupe que du
 * mouvement, et rien d'autre.
 *
 * TROIS COUCHES, UNE TRANSFORMATION CHACUNE. C'est la contrainte qui structure
 * tout le composant : une seule propriété `transform` par élément, sinon les
 * mouvements s'écrasent entre eux.
 *
 *   1. `.nf-fox`      → suivi du curseur. Le `transform` est posé ici, en
 *                       JavaScript, parce qu'il change à chaque image.
 *   2. `.nf-fox-bob`  → flottement permanent (CSS).
 *   3. `.nf-fox-jump` → le saut, déclenché au clic (CSS, à la demande).
 *
 * Le regard (`look`) et la queue (`wag`) vivent plus bas encore, sur les
 * groupes `<g class="pu">` et `<g class="tail">` du SVG lui-même.
 *
 * LE RENARD NE CAPTURE RIEN. Il est en `pointer-events: none` et en
 * `aria-hidden` : il ne peut pas intercepter un clic destiné aux boutons, et
 * il n'est pas annoncé par un lecteur d'écran — c'est un décor, le sens est
 * porté par le texte de la page. La réaction au clic passe donc par un
 * écouteur sur la FENÊTRE, pas par une cible cliquable : on clique n'importe
 * où, le renard réagit.
 *
 * CE QU'IL NE FAIT PAS. Aucune dépendance, aucun appel réseau, aucun
 * intervalle permanent : la boucle d'animation s'arrête d'elle-même dès que
 * le renard a rejoint sa cible, et redémarre au mouvement suivant. Rien ne
 * tourne quand rien ne bouge.
 */

/** Déplacement maximal, en pixels CSS, depuis la position de repos. */
const MAX_X = 40;
const MAX_Y = 22;

/** Fraction de l'écart restant parcourue par image, à 60 Hz. */
const EASE = 0.14;

/** En deçà de ce restant, on colle à la cible et on rend la main. */
const SETTLE = 0.2;

export function FoxMascot() {
  const foxRef = useRef<HTMLSpanElement>(null);
  const jumpRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fox = foxRef.current;
    const jump = jumpRef.current;
    if (!fox) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    /**
     * Le suivi n'est pas « animé puis masqué » sous mouvement réduit : il
     * n'est jamais démarré. Et sans pointeur permanent — un téléphone, une
     * tablette —, il n'y a rien à suivre : le renard reste à sa place et
     * répond au toucher. Dans les deux cas, aucune boucle ne tourne.
     */
    const follow = !calm && fine;

    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let baseCx = 0;
    let baseCy = 0;
    let halfW = 1;
    let fullH = 1;
    let raf = 0;
    let running = false;
    let last = 0;

    const clamp = (value: number, max: number) =>
      value > max ? max : value < -max ? -max : value;

    /**
     * Centre du renard AU REPOS.
     *
     * On ne peut pas lire `getBoundingClientRect()` tel quel : le renard est
     * déplacé par `transform`, donc son rectangle se déplace avec lui, et la
     * cible se recalculerait à partir de la position courante — le renard
     * finirait par rejoindre le curseur au lieu de pencher vers lui. On retire
     * donc la translation en cours pour retrouver le point de repos.
     *
     * La mesure n'a lieu qu'au montage et sur `resize`/`scroll`, jamais dans
     * le gestionnaire de mouvement : pas de lecture de mise en page à chaque
     * déplacement du pointeur.
     */
    const measure = () => {
      const rect = fox.getBoundingClientRect();
      baseCx = rect.left + rect.width / 2 - x;
      baseCy = rect.top + rect.height / 2 - y;
      halfW = Math.max(1, window.innerWidth / 2);
      fullH = Math.max(1, window.innerHeight);
    };

    const step = (now: number) => {
      // Facteur indépendant de la fréquence d'affichage : la même allure sur
      // un écran 60 Hz et sur un 120 Hz.
      const dt = last ? Math.min(now - last, 48) : 16.67;
      last = now;
      const k = 1 - Math.pow(1 - EASE, dt / 16.67);

      x += (targetX - x) * k;
      y += (targetY - y) * k;

      if (Math.abs(targetX - x) < SETTLE && Math.abs(targetY - y) < SETTLE) {
        x = targetX;
        y = targetY;
        fox.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        running = false;
        last = 0;
        return;
      }

      fox.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      // L'écart au centre est ramené dans [-1, 1] sur toute la largeur de la
      // fenêtre (le renard est centré horizontalement), puis borné. Sur la
      // hauteur, on normalise par la fenêtre ENTIÈRE et non par sa moitié :
      // le renard est près du haut de la page, l'écart vers le bas est donc
      // toujours grand, et une normalisation plus serrée le collerait à sa
      // butée basse en permanence.
      targetX = clamp(((event.clientX - baseCx) / halfW) * MAX_X, MAX_X);
      targetY = clamp(((event.clientY - baseCy) / fullH) * MAX_Y, MAX_Y);
      start();
    };

    const onDown = () => {
      if (!jump) return;
      jump.classList.remove("is-hopping");
      // Relire une propriété de mise en page force le navigateur à prendre en
      // compte le retrait. Sans cela, deux clics rapprochés ne relanceraient
      // pas l'animation : le retrait et l'ajout tomberaient dans la même image.
      void jump.offsetWidth;
      jump.classList.add("is-hopping");
    };

    const onHopEnd = () => jump?.classList.remove("is-hopping");

    measure();
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    jump?.addEventListener("animationend", onHopEnd);
    if (follow) window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("pointerdown", onDown);
      jump?.removeEventListener("animationend", onHopEnd);
      if (follow) window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <span className="nf-fox" ref={foxRef} aria-hidden="true">
      <span className="nf-fox-bob">
        <span className="nf-fox-jump" ref={jumpRef}>
          <FoxSVG />
        </span>
      </span>
    </span>
  );
}
