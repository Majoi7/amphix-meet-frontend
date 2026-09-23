import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
} from "react";

/**
 * Champ de saisie mathématique.
 *
 * Deux claviers coexistent, et ils ne se gênent pas :
 *   - le CLAVIER PHYSIQUE écrit normalement (flèches, sélection, collage,
 *     raccourcis système) — rien n'est intercepté sauf Entrée et Échap ;
 *   - le CLAVIER MATHÉMATIQUE à l'écran insère du texte À LA POSITION DU
 *     CURSEUR, ce qu'un simple `value + touche` ne saurait pas faire.
 *
 * L'insertion passe par une référence impérative (`MathInputHandle`), pas
 * par une remontée d'état : le clavier à l'écran ne connaît donc ni la
 * valeur ni le curseur, et le champ reste le seul maître de son contenu.
 */

export interface MathInputHandle {
  /**
   * Insère du texte à la position du curseur (ou à la fin).
   * `caretBack` replace le curseur en arrière dans le texte inséré — c'est
   * ce qui permet à « √ » d'écrire `sqrt()` et de laisser le curseur ENTRE
   * les parenthèses, là où l'utilisateur doit taper son nombre.
   */
  insert: (text: string, caretBack?: number) => void;
  /** Efface le caractère précédent, ou la sélection. */
  backspace: () => void;
  /** Vide le champ. */
  clear: () => void;
  focus: () => void;
}

interface MathInputProps {
  /** Identifiant du champ : sert au `<label>` et au repérage par le parent. */
  fieldId: string;
  value: string;
  onChange: (next: string) => void;
  /** Déclenché par Entrée. */
  onSubmit: () => void;
  label: string;
  placeholder?: string;
  /** Message d'erreur en cours, pour `aria-invalid` et l'annonce. */
  errorMessage?: string | null;
  /** Texte d'aide associé au champ (`aria-describedby`). */
  hintId?: string;
  size?: "md" | "sm";
  autoFocus?: boolean;
  /** Prévient le parent que ce champ a le focus (cible du clavier). */
  onFieldFocus?: () => void;
}

export const MathInput = forwardRef<MathInputHandle, MathInputProps>(
  function MathInput(
    {
      fieldId,
      value,
      onChange,
      onSubmit,
      label,
      placeholder,
      errorMessage = null,
      hintId,
      size = "md",
      autoFocus = false,
      onFieldFocus,
    },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    // Position du curseur à rétablir APRÈS que React a réécrit la valeur :
    // la placer avant serait effacé par le rendu.
    const pendingCaret = useRef<number | null>(null);

    useEffect(() => {
      const element = inputRef.current;
      if (!element || pendingCaret.current === null) return;
      const caret = pendingCaret.current;
      pendingCaret.current = null;
      element.setSelectionRange(caret, caret);
    }, [value]);

    /** Bornes de la sélection. Champ non focalisé : on écrit à la fin. */
    function selection(): [number, number] {
      const element = inputRef.current;
      if (!element) return [value.length, value.length];
      if (document.activeElement !== element) return [value.length, value.length];
      const start = element.selectionStart ?? value.length;
      const end = element.selectionEnd ?? start;
      return [start, end];
    }

    useImperativeHandle(
      ref,
      () => ({
        insert(text: string, caretBack = 0) {
          const element = inputRef.current;
          if (!element) {
            onChange(value + text);
            return;
          }
          const [start, end] = selection();
          const next = value.slice(0, start) + text + value.slice(end);
          if (next === value) {
            element.focus();
            return;
          }
          pendingCaret.current = start + text.length - caretBack;
          onChange(next);
          element.focus();
        },

        backspace() {
          const element = inputRef.current;
          if (!element) {
            onChange(value.slice(0, -1));
            return;
          }
          let [start, end] = selection();
          if (start === end) {
            if (start === 0) {
              element.focus();
              return;
            }
            start -= 1;
          }
          pendingCaret.current = start;
          onChange(value.slice(0, start) + value.slice(end));
          element.focus();
        },

        clear() {
          pendingCaret.current = 0;
          onChange("");
          inputRef.current?.focus();
        },

        focus() {
          inputRef.current?.focus();
        },
      }),
      [value, onChange]
    );

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Échap vide le champ ; s'il est déjà vide, il rend la main.
        if (value !== "") {
          pendingCaret.current = 0;
          onChange("");
        } else {
          inputRef.current?.blur();
        }
      }
    }

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="app-label">
          {label}
        </label>
        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          className={`app-input app-mono ${size === "sm" ? "app-input-sm" : ""}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFieldFocus}
          placeholder={placeholder}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={hintId}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
        />
      </div>
    );
  }
);
