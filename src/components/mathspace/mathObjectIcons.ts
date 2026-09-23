import {
  Circle,
  CircleDot,
  Crosshair,
  Hash,
  LineChart,
  Minus,
  MoveUpRight,
  type LucideIcon,
} from "lucide-react";
import type { MathObjectKind } from "../../lib/math/construction";

/**
 * Un GLYPHE par genre d'objet — la seule table de correspondance.
 *
 * Elle vit dans son propre module parce que DEUX endroits en ont besoin : la
 * liste des objets, qui doit montrer d'un coup d'œil ce qu'est chaque ligne, et
 * la barre d'outils, qui propose d'en créer. Les recopier ferait diverger les
 * deux au premier genre ajouté — le crayon de la barre ne dessinerait alors
 * plus la même chose que la ligne correspondante dans la liste.
 *
 * Le type est `Record<MathObjectKind, …>` et non une table partielle : ajouter
 * un genre au modèle sans lui donner de glyphe ne compile pas. C'est
 * exactement ce qu'on veut — un genre muet est un genre qu'on oublie.
 *
 * Les icônes viennent de `lucide-react`, déjà utilisé partout dans
 * l'application : C4 n'introduit aucune bibliothèque d'icônes.
 */
export const OBJECT_ICONS: Readonly<Record<MathObjectKind, LucideIcon>> = {
  function: LineChart,
  point: CircleDot,
  segment: Minus,
  line: MoveUpRight,
  circle: Circle,
  intersection: Crosshair,
  number: Hash,
};
