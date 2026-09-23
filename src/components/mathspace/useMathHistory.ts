import { useCallback, useState } from "react";

/**
 * Historique des calculs — conservé dans le NAVIGATEUR, pas sur le serveur.
 *
 * Aucune table, aucune requête, aucun schéma : `localStorage` suffit pour ce
 * que l'historique doit faire (se souvenir de ce qu'on vient de calculer,
 * dans cette session et les suivantes). L'espace mathématique reste donc
 * autonome, et fonctionne même si le serveur ne répond pas.
 *
 * La lecture est TOLÉRANTE : une entrée illisible est ignorée plutôt que de
 * faire échouer l'affichage. Un `localStorage` plein ou bloqué ne casse rien.
 */

export type MathHistoryKind = "calcul" | "equation";

export interface MathHistoryEntry {
  id: string;
  kind: MathHistoryKind;
  /** Ce que l'utilisateur a saisi. */
  source: string;
  /** Le résultat DÉJÀ mis en forme — on ne réévalue jamais une entrée ancienne. */
  summary: string;
  /** Horodatage, en millisecondes depuis l'époque. */
  at: number;
}

const STORAGE_KEY = "amphix.mathspace.history";
const MAX_ENTRIES = 40;

function isEntry(value: unknown): value is MathHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<MathHistoryEntry>;
  return (
    typeof entry.id === "string" &&
    (entry.kind === "calcul" || entry.kind === "equation") &&
    typeof entry.source === "string" &&
    typeof entry.summary === "string" &&
    typeof entry.at === "number"
  );
}

function read(): MathHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function write(entries: MathHistoryEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota dépassé ou stockage bloqué : l'historique de session suffit */
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface MathHistoryApi {
  entries: MathHistoryEntry[];
  record: (kind: MathHistoryKind, source: string, summary: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export function useMathHistory(): MathHistoryApi {
  const [entries, setEntries] = useState<MathHistoryEntry[]>(read);

  const record = useCallback(
    (kind: MathHistoryKind, source: string, summary: string) => {
      const trimmed = source.trim();
      if (trimmed === "" || summary === "") return;

      // Appuyer deux fois sur Entrée ne doit pas créer deux lignes identiques.
      const head = entries[0];
      if (
        head &&
        head.kind === kind &&
        head.source === trimmed &&
        head.summary === summary
      ) {
        return;
      }

      const next = [
        { id: makeId(), kind, source: trimmed, summary, at: Date.now() },
        ...entries,
      ].slice(0, MAX_ENTRIES);

      setEntries(next);
      write(next);
    },
    [entries]
  );

  const remove = useCallback(
    (id: string) => {
      const next = entries.filter((entry) => entry.id !== id);
      setEntries(next);
      write(next);
    },
    [entries]
  );

  const clear = useCallback(() => {
    setEntries([]);
    write([]);
  }, []);

  return { entries, record, remove, clear };
}
