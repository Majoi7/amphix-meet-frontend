import { useRef } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme, type ThemePreference } from "../context/ThemeContext";

interface ThemeOption {
  value: ThemePreference;
  label: string;
  Icon: LucideIcon;
}

const OPTIONS: ThemeOption[] = [
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
  { value: "system", label: "Système", Icon: Monitor },
];

/**
 * Sélecteur de thème — UN SEUL réglage pour toute l'interface.
 *
 * Groupe de boutons radio (et non trois boutons indépendants) : les lecteurs
 * d'écran annoncent alors « 1 sur 3 », et les flèches du clavier font le
 * tour des choix, comme dans un vrai groupe radio. Un seul arrêt de
 * tabulation — on entre dans le groupe, on choisit avec les flèches, on en
 * sort avec Tab.
 *
 * Le même composant sert dans l'espace d'administration et dans l'espace
 * mathématique : il n'y a qu'une préférence, donc qu'un sélecteur.
 */
export function ThemeSwitcher({
  compact = false,
  ariaLabel = "Thème de l'interface",
}: {
  compact?: boolean;
  ariaLabel?: string;
}) {
  const { preference, setPreference } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = OPTIONS.findIndex((option) => option.value === preference);

  function moveFocus(nextIndex: number) {
    const buttons =
      containerRef.current?.querySelectorAll<HTMLButtonElement>("[role='radio']");
    buttons?.[nextIndex]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const handled = [
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "Home",
      "End",
    ];
    if (!handled.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = activeIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (activeIndex + 1) % OPTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (activeIndex - 1 + OPTIONS.length) % OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = OPTIONS.length - 1;
    }

    if (nextIndex === activeIndex) return;
    setPreference(OPTIONS[nextIndex].value);
    moveFocus(nextIndex);
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`inline-flex items-center gap-0.5 rounded-[10px] p-0.5 ${
        compact ? "" : "w-full"
      }`}
      style={{ backgroundColor: "var(--app-surface-2)" }}
    >
      {OPTIONS.map((option) => {
        const isActive = option.value === preference;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => setPreference(option.value)}
            title={option.label}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium transition-colors ${
              compact ? "w-8" : "flex-1 px-2"
            }`}
            style={
              isActive
                ? {
                    backgroundColor: "var(--app-surface)",
                    color: "var(--app-text)",
                    boxShadow: "var(--app-shadow)",
                  }
                : { color: "var(--app-text-muted)" }
            }
          >
            <option.Icon size={14} aria-hidden="true" />
            {!compact && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
