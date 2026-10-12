import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { addRecentColor, loadRecentColors, normalizeHex, sameColor, saveRecentColors } from "../../lib/whiteboardColors";

interface ColorPaletteProps {
  /** La couleur active — celle des traits À VENIR. */
  color: string;
  /** La grille de base, fournie par `Whiteboard` : une seule source de vérité. */
  baseColors: readonly string[];
  onChange: (hex: string) => void;
}

/**
 * Le choix de couleur de la barre d'outils.
 *
 * ELLE NE TOUCHE JAMAIS AUX TRAITS DÉJÀ DESSINÉS, et ce n'est pas une
 * précaution d'écriture : la couleur est portée par chaque `WhiteboardStroke`
 * (`stroke.color`), et l'état `color` de `Whiteboard` n'est lu qu'au moment de
 * CRÉER un trait. Changer la couleur ici ne peut donc, par construction,
 * affecter que les traits suivants. Il n'existe volontairement aucune action
 * « recolorer la sélection », qui aurait eu le défaut inverse.
 *
 * La grille de base est rendue dans le flux de la barre, à l'identique de ce
 * qu'elle était avant extraction — `<ColorPalette>` remplace le `COLORS.map`
 * d'origine. Le panneau, lui, se positionne par rapport à la BARRE D'OUTILS
 * (qui est `relative`) et non par rapport au bouton : ancré au bouton, il
 * débordait à gauche ou à droite selon la ligne sur laquelle la barre se
 * replie en mobile.
 */
export function ColorPalette({ color, baseColors, onChange }: ColorPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(color);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(() => loadRecentColors());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // La couleur active est-elle hors de la grille de base ? Elle est alors
  // portée par le bouton-personnalisé, qui prend l'anneau de sélection.
  const isCustom = !baseColors.some((base) => sameColor(base, color));

  // La dernière couleur active, relue au moment de la fermeture. Un effet
  // n'est pas seulement pratique ici, il est nécessaire : fermer le panneau
  // démonte le champ de saisie AVANT que le navigateur n'émette `blur`
  // (l'état est vidé à la fin de l'événement `pointerdown`, la prise de focus
  // vient après). Sans cette référence, une teinte choisie dans le sélecteur
  // natif puis abandonnée par un clic extérieur ne serait jamais retenue.
  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  // La rangée n'est écrite qu'une fois l'état engagé, et jamais depuis un
  // updater : sous StrictMode, React exécute ces derniers deux fois.
  useEffect(() => {
    saveRecentColors(recent);
  }, [recent]);

  /**
   * Retient une teinte dans les récentes.
   *
   * Les couleurs de la GRILLE DE BASE en sont exclues : elles sont déjà à un
   * clic, et les y répéter remplirait la rangée de doublons au détriment des
   * teintes personnalisées, qui sont la seule raison d'être de cette rangée.
   *
   * La forme fonctionnelle est indispensable : cette fonction est appelée
   * depuis les écouteurs de fermeture, posés par un effet qui ne se réexécute
   * pas quand `recent` change — une lecture directe de l'état y serait périmée
   * et écraserait les teintes retenues entre-temps.
   */
  function remember(hex: string) {
    const normalized = normalizeHex(hex);
    if (!normalized) return;
    if (baseColors.some((base) => sameColor(base, normalized))) return;
    setRecent((previous) => addRecentColor(previous, normalized));
  }

  // Fermeture au clic extérieur et à Échap — seulement quand le panneau est
  // ouvert, pour ne pas laisser deux écouteurs globaux en permanence.
  //
  // Le clic d'ouverture ne peut pas refermer le panneau dans la foulée : les
  // écouteurs sont posés par un effet, donc APRÈS que cet événement a fini de
  // se propager.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      remember(colorRef.current);
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      remember(colorRef.current);
      setIsOpen(false);
      // Le bouton reprend le focus : au clavier, la fermeture ne doit pas
      // laisser l'utilisateur nulle part.
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // `remember` est volontairement absent des dépendances : il n'est pas
    // mémorisé, et l'ajouter ferait reposer les écouteurs à chaque rendu sans
    // rien apporter — sa lecture de `recent` passe par un updater.
  }, [isOpen]);

  /** Applique une couleur, la retient, et referme le panneau. */
  function select(hex: string) {
    onChange(hex);
    setHexDraft(hex);
    setError(null);
    remember(hex);
    setIsOpen(false);
  }

  function toggle() {
    // Le brouillon est recalé sur la couleur active à chaque ouverture : une
    // saisie abandonnée la fois précédente ne doit pas ressurgir.
    if (!isOpen) {
      setHexDraft(color);
      setError(null);
    }
    setIsOpen(!isOpen);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const hex = normalizeHex(hexDraft);
    if (!hex) {
      setError("Format attendu : #8ab4f8, ou #abc en abrégé.");
      return;
    }
    select(hex);
  }

  return (
    <>
      {baseColors.map((base) => (
        <button
          key={base}
          type="button"
          onClick={() => select(base)}
          aria-label={`Couleur ${base}`}
          className={`h-6 w-6 flex-shrink-0 rounded-full ring-2 transition-transform ${
            sameColor(color, base) ? "scale-110 ring-meet-text-primary" : "ring-transparent"
          }`}
          style={{ backgroundColor: base }}
        />
      ))}

      {/* Le bouton-personnalisé : une roue chromatique tant qu'aucune teinte
          hors grille n'est active, puis la teinte elle-même. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label="Couleur personnalisée"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Couleur personnalisée"
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ring-2 transition-transform ${
          isCustom || isOpen ? "scale-110 ring-meet-text-primary" : "ring-transparent"
        }`}
        style={{
          background: isCustom
            ? color
            : "conic-gradient(#ea4335, #fbbc04, #34a853, #8ab4f8, #c58af9, #ea4335)",
        }}
      >
        {!isCustom && (
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/45 text-white">
            <Plus size={9} />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Couleur personnalisée"
          className="absolute left-3 top-full z-30 mt-2 w-[min(17rem,calc(100vw-1.5rem))] rounded-xl bg-meet-bg-secondary p-3 shadow-2xl ring-1 ring-meet-border"
        >
          <label
            htmlFor="wb-custom-color"
            className="mb-1.5 block text-xs text-meet-text-secondary"
          >
            Couleur personnalisée
          </label>

          <div className="mb-3 flex items-center gap-2">
            <input
              id="wb-custom-color"
              type="color"
              value={color}
              // Aperçu EN DIRECT pendant le glissement : on applique sans
              // refermer, sinon le panneau disparaîtrait au premier
              // déplacement du curseur.
              onChange={(event) => onChange(event.target.value)}
              // Les récentes ne retiennent que la teinte FINALE, au relâchement.
              // Retenir chaque étape les remplirait de couleurs intermédiaires.
              onBlur={(event) => remember(event.target.value)}
              className="h-9 w-14 flex-shrink-0 cursor-pointer rounded-lg border border-meet-border bg-meet-bg p-1"
            />
            <span className="font-mono text-xs uppercase text-meet-text-secondary">{color}</span>
          </div>

          <form onSubmit={handleSubmit} className="mb-3">
            <label htmlFor="wb-hex" className="mb-1 block text-xs text-meet-text-secondary">
              Code HEX
            </label>
            <div className="flex gap-2">
              <input
                id="wb-hex"
                type="text"
                value={hexDraft}
                onChange={(event) => {
                  setHexDraft(event.target.value);
                  setError(null);
                }}
                placeholder="#8ab4f8"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={error !== null}
                aria-describedby="wb-hex-hint"
                className="min-w-0 flex-1 rounded-lg border border-meet-border bg-meet-bg px-3 py-2 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
              />
              <button
                type="submit"
                className="flex-shrink-0 rounded-lg bg-meet-blue px-3 py-2 text-xs font-medium text-meet-bg transition-colors hover:bg-meet-blue-hover"
              >
                Appliquer
              </button>
            </div>
            <p
              id="wb-hex-hint"
              className={`mt-1 text-[10px] ${
                error ? "text-meet-yellow" : "text-meet-text-disabled"
              }`}
            >
              {error ?? "Trois ou six chiffres hexadécimaux, avec ou sans #."}
            </p>
          </form>

          {recent.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-meet-text-secondary">Récentes</p>
              <div className="flex flex-wrap gap-2">
                {recent.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => select(hex)}
                    aria-label={`Couleur récente ${hex}`}
                    className={`h-6 w-6 flex-shrink-0 rounded-full ring-2 transition-transform ${
                      sameColor(color, hex) ? "scale-110 ring-meet-text-primary" : "ring-transparent"
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
