/**
 * Ré-export historique — le sélecteur de thème n'est plus propre à
 * l'administration.
 *
 * Le composant vit maintenant dans `src/components/ThemeSwitcher.tsx`, avec
 * le fournisseur de thème partagé : il n'existe qu'une préférence, donc
 * qu'un sélecteur. Ce fichier n'est PAS supprimé — il ré-exporte le même
 * nom, donc `AdminLayout.tsx`, `Header.tsx` et `Settings.tsx` continuent de
 * fonctionner sans modification.
 *
 * Un seul changement visible : le nom accessible du groupe devient « Thème
 * de l'interface ». Il annonçait « Thème de l'espace d'administration »,
 * ce qui n'est plus exact puisque le réglage est désormais commun à
 * l'administration et à l'espace mathématique.
 */

export { ThemeSwitcher } from "../../../components/ThemeSwitcher";
