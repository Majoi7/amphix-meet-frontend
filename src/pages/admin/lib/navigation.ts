import {
  History,
  KeyRound,
  LayoutDashboard,
  Settings,
  Sigma,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Chemin réel, enregistré dans `App.tsx`. */
  to: string;
  label: string;
  /** Phrase affichée sous le titre de la page. */
  description: string;
  Icon: LucideIcon;
  /** Correspondance exacte du chemin (pour la route d'index). */
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Structure de la navigation.
 *
 * CHAQUE ENTRÉE CORRESPOND À UNE PAGE QUI EXISTE VRAIMENT. Aucune route
 * n'est déclarée ici sans son composant, et aucun composant n'est créé pour
 * « remplir » le menu.
 *
 * Deux écarts par rapport à la structure demandée, assumés :
 *
 *  - « Participants » n'a pas de page dédiée. Les participants d'une réunion
 *    ne sont exposés par aucune API en dehors de la salle elle-même
 *    (LiveKit) : une page « Participants » ne pourrait afficher que des
 *    colonnes vides. Les personnes réellement connues — vous, et les
 *    participants de vos séances — sont réunies dans « Utilisateurs ».
 *  - « Historique » existe bien comme page, parce que la donnée existe :
 *    `GET /meetings/mine` renvoie les réunions terminées et annulées.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Vue d'ensemble",
    items: [
      {
        to: "/dashboard",
        label: "Tableau de bord",
        description: "Indicateurs et activité de votre espace Amphix.",
        Icon: LayoutDashboard,
        end: true,
      },
    ],
  },
  {
    label: "Réunions",
    items: [
      {
        to: "/dashboard/meetings",
        label: "Réunions",
        description: "Toutes vos réunions : hôte, statut, durée et code.",
        Icon: Video,
      },
      {
        to: "/dashboard/history",
        label: "Historique",
        description: "Réunions terminées ou annulées, et séances passées.",
        Icon: History,
      },
    ],
  },
  {
    label: "Personnes",
    items: [
      {
        to: "/dashboard/users",
        label: "Utilisateurs",
        description: "Votre compte et les personnes de vos séances.",
        Icon: Users,
      },
    ],
  },
  {
    label: "Applications",
    items: [
      {
        to: "/dashboard/applications",
        label: "Applications & API",
        description: "Accès programmatiques à Amphix Meet.",
        Icon: KeyRound,
      },
    ],
  },
  {
    label: "Outils",
    items: [
      {
        to: "/dashboard/mathspace",
        label: "Espace mathématique",
        description:
          "Calculs exacts, fonctions tracées et équations — sans serveur, sans table dédiée.",
        Icon: Sigma,
      },
    ],
  },
  {
    label: "Système",
    items: [
      {
        to: "/dashboard/settings",
        label: "Paramètres",
        description: "Apparence de l'espace d'administration et compte.",
        Icon: Settings,
      },
    ],
  },
];

/** Toutes les entrées, à plat — pratique pour retrouver un titre de page. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/**
 * Entrée de navigation correspondant à un chemin.
 *
 * Le tri par longueur décroissante garantit que `/dashboard/meetings` gagne
 * sur `/dashboard` : sans cela, toutes les sous-pages porteraient le titre
 * « Tableau de bord ».
 */
export function findNavItem(pathname: string): NavItem | null {
  const candidates = [...ALL_NAV_ITEMS].sort((a, b) => b.to.length - a.to.length);
  return (
    candidates.find(
      (item) => pathname === item.to || (!item.end && pathname.startsWith(`${item.to}/`))
    ) ?? null
  );
}
