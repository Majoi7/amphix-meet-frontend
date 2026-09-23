import { useCallback, useMemo, useState } from "react";
import {
  addObject as addObjectTo,
  addObjects as addObjectsTo,
  createInitialConstruction,
  removeObject as removeObjectFrom,
  resolveObjectDependencies,
  selectObject as selectObjectIn,
  setObjectVisibility as setObjectVisibilityIn,
  setView as setViewIn,
  toggleObjectSelection as toggleObjectSelectionIn,
  updateObject as updateObjectIn,
  updateObjectStyle as updateObjectStyleIn,
  type MathConstruction,
  type MathObject,
  type MathObjectStyle,
  type MathView,
  type ResolvedConstruction,
} from "../../lib/math/construction";
import {
  resolveGeometry,
  type GeometryResolution,
} from "../../lib/math/geometry";

/**
 * Liaison React du modèle — la SEULE chose qui relie `MathConstruction` à
 * React.
 *
 * Le modèle lui-même (`lib/math/construction.ts`) reste pur et sans hooks :
 * c'est ce qui permet de le tester, de le sérialiser et de le raisonner sans
 * monter un composant.
 *
 * Les opérations sont exposées avec une identité STABLE (dépendances vides) :
 * elles n'utilisent que la forme fonctionnelle de `setState`, qui reçoit
 * toujours la construction courante. Les composants enfants peuvent donc les
 * mettre dans leurs dépendances sans se re-rendre à chaque fois.
 *
 * Aucune opération n'a d'effet de bord en dehors de `setState` : le mode
 * strict de React exécute les mises à jour deux fois en développement, et une
 * opération pure le supporte sans dommage.
 */
export interface MathConstructionApi {
  construction: MathConstruction;
  /** Objets ordonnés selon leurs dépendances — mémoïsé. */
  resolved: ResolvedConstruction;
  /**
   * Primitive géométrique de chaque objet, et ceux qui n'en ont pas.
   *
   * Calculée ici, et non dans le renderer : c'est ce qui permet au renderer de
   * ne rien calculer du tout. Elle découle des mêmes objets que `resolved`,
   * donc les deux ne peuvent pas diverger.
   */
  geometry: GeometryResolution;

  addObject: (object: MathObject) => void;
  /** Ajout ATOMIQUE de plusieurs objets — voir `addObjects`. */
  addObjects: (objects: readonly MathObject[]) => void;
  updateObject: (id: string, patch: Partial<Omit<MathObject, "id" | "kind">>) => void;
  updateObjectStyle: (id: string, patch: MathObjectStyle) => void;
  removeObject: (id: string) => void;
  setObjectVisibility: (id: string, visible: boolean) => void;
  selectObject: (id: string | null) => void;
  /** Sélectionne, ou relâche si l'objet était déjà sélectionné. */
  toggleObjectSelection: (id: string) => void;
  setView: (view: Partial<MathView>) => void;
}

export function useMathConstruction(): MathConstructionApi {
  const [construction, setConstruction] = useState<MathConstruction>(() =>
    createInitialConstruction()
  );

  const addObject = useCallback((object: MathObject) => {
    setConstruction((current) => addObjectTo(current, object));
  }, []);

  const addObjects = useCallback((objects: readonly MathObject[]) => {
    setConstruction((current) => addObjectsTo(current, objects));
  }, []);

  const updateObject = useCallback(
    (id: string, patch: Partial<Omit<MathObject, "id" | "kind">>) => {
      setConstruction((current) => updateObjectIn(current, id, patch));
    },
    []
  );

  const updateObjectStyle = useCallback((id: string, patch: MathObjectStyle) => {
    setConstruction((current) => updateObjectStyleIn(current, id, patch));
  }, []);

  const removeObject = useCallback((id: string) => {
    setConstruction((current) => removeObjectFrom(current, id));
  }, []);

  const setObjectVisibility = useCallback((id: string, visible: boolean) => {
    setConstruction((current) => setObjectVisibilityIn(current, id, visible));
  }, []);

  const selectObject = useCallback((id: string | null) => {
    setConstruction((current) => selectObjectIn(current, id));
  }, []);

  const toggleObjectSelection = useCallback((id: string) => {
    setConstruction((current) => toggleObjectSelectionIn(current, id));
  }, []);

  const setView = useCallback((view: Partial<MathView>) => {
    setConstruction((current) => setViewIn(current, view));
  }, []);

  // Les dépendances sont résolues ICI, une fois : le renderer et la liste
  // lisent le même ordre, et il n'est pas recalculé à chaque rendu d'un enfant.
  const resolved = useMemo(
    () => resolveObjectDependencies(construction.objects),
    [construction.objects]
  );

  // La géométrie se résout APRÈS les dépendances, et à partir d'elles : un
  // objet dont une dépendance manque n'a pas de primitive à calculer, et le
  // résolveur de dépendances l'a déjà bloqué. Les deux mémoïsations sont
  // chaînées, donc un seul changement d'objet les recalcule toutes les deux —
  // sans jamais les laisser désaccordées.
  const geometry = useMemo(
    () => resolveGeometry(resolved.ordered, resolved.blocked),
    [resolved]
  );

  return {
    construction,
    resolved,
    geometry,
    addObject,
    addObjects,
    updateObject,
    updateObjectStyle,
    removeObject,
    setObjectVisibility,
    selectObject,
    toggleObjectSelection,
    setView,
  };
}
