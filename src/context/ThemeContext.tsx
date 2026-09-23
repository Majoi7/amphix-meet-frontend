import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Thème de l'application — UN SEUL système, partagé.
 *
 * L'espace d'administration et l'espace mathématique lisent la même
 * préférence : basculer en sombre dans l'un bascule l'autre, et le choix
 * survit au rafraîchissement. Il n'existe pas de second réglage parallèle.
 *
 * INDÉPENDANT DE LA SALLE DE RÉUNION. Le fournisseur ne touche ni
 * `documentElement`, ni le `body`, ni une classe globale : il ne produit
 * que l'attribut `data-theme` posé sur l'élément porteur (`.dash-root` ou
 * `.app-theme`), que `src/styles/theme.css` lit. La réunion n'utilise que
 * la palette Tailwind `meet-*`, sans clé `darkMode` : la bascule est donc
 * structurellement sans effet sur elle.
 */

/** Choix de l'utilisateur. « system » suit le système d'exploitation. */
export type ThemePreference = "light" | "dark" | "system";

/** Thème réellement appliqué, une fois « system » résolu. */
export type ResolvedTheme = "light" | "dark";

/** Clé courante. */
const STORAGE_KEY = "amphix.theme";

/**
 * Clé historique, écrite par l'espace d'administration avant que l'espace
 * mathématique ne partage ce thème. Elle est encore LUE : quelqu'un qui
 * avait choisi « sombre » ne doit pas se retrouver en clair après la mise à
 * jour. Elle n'est jamais supprimée — on n'efface pas un réglage utilisateur.
 */
const LEGACY_STORAGE_KEY = "amphix.dashboard.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

interface ThemeValue {
  /** Ce que l'utilisateur a choisi (peut valoir « system »). */
  preference: ThemePreference;
  /** Ce qui est effectivement affiché. */
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function parsePreference(raw: string | null): ThemePreference | null {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : null;
}

/** Lecture tolérante : un navigateur qui bloque le stockage ne doit pas
 *  empêcher l'application de s'afficher. */
function readStoredPreference(): ThemePreference {
  try {
    const current = parsePreference(window.localStorage.getItem(STORAGE_KEY));
    if (current) return current;
    const legacy = parsePreference(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacy) return legacy;
  } catch {
    /* stockage indisponible — on retombe sur la valeur par défaut */
  }
  return "light"; // CLAIR par défaut : c'est le thème de référence
}

function writeStoredPreference(value: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* écriture impossible — le thème reste appliqué pour la session */
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference()
  );
  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark());

  // « system » doit suivre le système EN DIRECT : quelqu'un qui bascule son
  // ordinateur en mode sombre à 20 h ne doit pas avoir à recharger la page.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    function handleChange(event: MediaQueryListEvent) {
      setSystemDark(event.matches);
    }
    media.addEventListener("change", handleChange);
    setSystemDark(media.matches);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeStoredPreference(next);
  }, []);

  const resolved: ResolvedTheme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  const value = useMemo<ThemeValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme doit être utilisé dans un <ThemeProvider>.");
  }
  return context;
}

/** Noms historiques, conservés pour ne pas casser les appelants existants. */
export type DashboardThemePreference = ThemePreference;
export type DashboardResolvedTheme = ResolvedTheme;
export const DashboardThemeProvider = ThemeProvider;
export const useDashboardTheme = useTheme;
