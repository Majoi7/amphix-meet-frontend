import { MathWorkspace } from "../../../components/mathspace/MathWorkspace";

/**
 * Espace mathématique, dans l'espace d'administration.
 *
 * La vue ne porte NI titre NI description : l'en-tête de l'administration
 * les affiche déjà, à partir de l'entrée de navigation. Les répéter ici
 * donnerait deux fois le même titre à l'écran.
 *
 * Aucune donnée du tableau de bord n'est chargée par cette page : le moteur
 * mathématique tourne entièrement dans le navigateur, et l'historique vit
 * dans `localStorage`. Cet onglet fonctionne donc même si le serveur ne
 * répond pas, et n'ajoute aucune requête aux autres pages.
 */
export function MathSpaceView() {
  return <MathWorkspace />;
}
