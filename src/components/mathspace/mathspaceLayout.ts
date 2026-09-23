import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";

/**
 * Disposition de l'espace mathématique : à trois colonnes, ou empilée.
 *
 * POURQUOI UNE MESURE, ET NON UN POINT DE RUPTURE DE FENÊTRE
 *
 * L'espace de travail est monté à DEUX endroits — la page autonome et
 * l'administration — et l'administration garde une barre latérale de 248 px
 * dès `lg`. Une fenêtre de 1024 px n'y laisse donc que 1024 − 248 − 32 = 744 px
 * à l'espace mathématique. Un point de rupture calculé sur `window.innerWidth`
 * — `lg:`, ou `matchMedia` — répondrait « grand écran » et tenterait trois
 * colonnes dans 744 px, dont 404 px de minima : le graphe tomberait à 340 px.
 *
 * C'est la largeur RÉELLEMENT disponible qu'il faut interroger. React ne sait
 * pas la lire au rendu ; un `ResizeObserver` sur le conteneur, si.
 */

/**
 * Largeur du conteneur sous laquelle la disposition s'empile, et largeur
 * au-dessus de laquelle elle reprend ses colonnes.
 *
 * Les deux seuils sont DISTINCTS, et l'écart est une HYSTÉRÉSIS. Sans elle,
 * l'apparition ou la disparition d'une barre de défilement — une quinzaine de
 * pixels — ferait basculer la disposition, ce qui changerait la hauteur de la
 * page, ce qui ferait réapparaître la barre : un battement sans fin. Avec
 * elle, il faut franchir 80 px pour revenir en arrière.
 *
 * Les valeurs viennent d'une arithmétique, pas d'un goût. Trois colonnes
 * coûtent 176 + 196 + 2 × 16 = 404 px de minima (voir `mathspace.css` et la
 * grille de `MathWorkspace`). À 720 px, le graphe en garde 316 : c'est le
 * dessous duquel il cesse d'être une zone de travail. Contrôle du cas qui a
 * motivé la mesure : 744 px dans l'administration restent au-dessus du seuil,
 * les trois colonnes y tiennent donc.
 */
const COMPACT_BELOW = 720;
const EXPAND_ABOVE = 800;

/**
 * Faux par défaut, et c'est un CHOIX, non un oubli.
 *
 * Un consommateur monté hors de l'espace de travail — un test, une histoire,
 * un futur aperçu — doit fonctionner, pas lever. La disposition large est le
 * repli naturel : elle n'invente rien, elle est simplement plus généreuse.
 */
const MathSpaceLayoutContext = createContext(false);

/** La disposition courante, lue par les composants qui doivent s'y adapter. */
export function useMathSpaceLayout(): boolean {
  return useContext(MathSpaceLayoutContext);
}

export { MathSpaceLayoutContext };

/**
 * Suit la largeur d'un conteneur et dit si la disposition doit s'empiler.
 *
 * CE QUI EST CONSERVÉ, ET CE QUI NE L'EST PAS
 *
 * Seul le BOOLÉEN entre dans l'état. Conserver la largeur ferait re-rendre
 * tout l'espace de travail à chaque image d'un redimensionnement — soit le
 * graphe, la liste, les panneaux et l'historique — alors que rien ne change à
 * l'écran tant qu'aucun seuil n'est franchi. Ici, `setCompact` qui ne change
 * rien ne coûte rien : React abandonne le rendu lorsque l'état est identique.
 * Le `ResizeObserver` peut donc se déclencher à chaque pixel sans conséquence.
 *
 * `useLayoutEffect` ET NON `useEffect`
 *
 * La correction doit précéder la première peinture. Après peinture, un
 * téléphone afficherait une image de disposition à trois colonnes écrasées
 * dans 360 px avant de basculer — un saut visible à chaque chargement.
 *
 * L'EFFET NE DÉPEND D'AUCUNE VALEUR MOUVANTE
 *
 * La référence est stable : l'observateur est posé une fois et retiré au
 * démontage. Il n'y a donc jamais deux observateurs en vie, quel que soit le
 * nombre de montages et démontages — ce que le mode strict de React exerce
 * d'ailleurs dès le développement.
 */
export function useCompactLayout<T extends HTMLElement>(
  ref: RefObject<T | null>
): boolean {
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    function apply(width: number) {
      setCompact((previous) =>
        previous ? width < EXPAND_ABOVE : width < COMPACT_BELOW
      );
    }

    // Valeur immédiate, avant la première notification de l'observateur :
    // sans elle, le premier rendu après peinture partirait du repli large.
    //
    // `clientWidth` et non `getBoundingClientRect().width` : l'observateur
    // rapporte une `contentRect`, qui EXCLUT la barre de défilement. La boîte
    // englobante l'inclut, et l'écart vaut une quinzaine de pixels — exactement
    // l'ordre de grandeur que l'hystérésis existe pour absorber. Les deux
    // mesures doivent donc compter la même chose.
    apply(element.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // `contentRect` ignore les marges et les bordures : c'est la largeur
      // réellement offerte au contenu, celle qui décide.
      apply(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return compact;
}
