/**
 * Ré-export historique — le thème n'est plus propre à l'administration.
 *
 * Ce fichier existait quand l'espace d'administration avait son propre
 * réglage de thème. L'espace mathématique a besoin du MÊME réglage : deux
 * providers séparés auraient donné deux préférences qui divergent, et un
 * utilisateur qui bascule en sombre dans l'un serait resté en clair dans
 * l'autre.
 *
 * Le fournisseur vit maintenant dans `src/context/ThemeContext.tsx`. Ce
 * fichier n'est PAS supprimé — il ré-exporte les mêmes noms, donc
 * `AdminLayout.tsx` et `ThemeSwitcher.tsx` continuent de fonctionner sans
 * la moindre modification.
 *
 * Ce qui change, côté utilisateur : la préférence est lue d'abord dans
 * `amphix.theme`, puis dans l'ancienne clé `amphix.dashboard.theme` — un
 * choix « sombre » déjà enregistré reste donc respecté.
 */

export {
  ThemeProvider as DashboardThemeProvider,
  useTheme as useDashboardTheme,
  type ThemePreference as DashboardThemePreference,
  type ResolvedTheme as DashboardResolvedTheme,
} from "../../../context/ThemeContext";
