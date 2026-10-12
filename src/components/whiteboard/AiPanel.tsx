import { useState, type KeyboardEvent } from "react";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { evaluateConstant, type Evaluation } from "../../lib/math";
import { askQuestion, explainFormula } from "../../lib/aiApi";
import { ApiClientError } from "../../lib/httpClient";

/**
 * Panneau de l'assistant pédagogique.
 *
 * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT, et c'est le même choix que la
 * calculatrice : ce composant ne reçoit QUE `onClose`. Ni les traits, ni la
 * couleur, ni l'auteur, ni un rappel de tracé. Il ne PEUT donc rien écrire sur
 * le tableau — ni dessin, ni synchronisation, ni historique, ni sauvegarde.
 * C'est une décision, pas un oubli : c'est ce qui garantit que ce lot
 * n'élargit pas la surface de régression du tableau blanc.
 *
 * DEUX MODES, DEUX RESPONSABLES
 *
 * « Question » envoie la question au modèle et affiche sa réponse.
 *
 * « Formule » fait l'inverse, et c'est le point important : le calcul est
 * confié au MOTEUR (`evaluateConstant`), qui est exact, déterministe, et
 * écrit sans `eval()`. Le modèle ne reçoit ensuite que ce résultat DÉJÀ
 * CALCULÉ, avec pour seule mission de l'expliquer — il ne recalcule rien. Le
 * nombre affiché à l'écran est donc celui du moteur, jamais celui du modèle.
 * Si le moteur refuse l'expression (faute de syntaxe, « x », division par
 * zéro), AUCUN appel n'est fait : il n'y a rien à expliquer.
 */

type Mode = "question" | "formula";

export function AiPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("question");
  const [input, setInput] = useState("");
  // Le résultat du MOTEUR, distinct de la réponse du modèle. Deux cadres,
  // deux responsabilités : on ne les mélange jamais à l'écran.
  const [engine, setEngine] = useState<Evaluation | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    // Changer d'onglet abandonne la demande précédente : garder une réponse
    // à côté d'un champ qui ne l'a pas produite serait un mensonge.
    setInput("");
    setEngine(null);
    setAnswer(null);
    setError(null);
  }

  function reset() {
    setInput("");
    setEngine(null);
    setAnswer(null);
    setError(null);
  }

  async function submit() {
    if (busy) return;
    const text = input.trim();
    if (text === "") return;

    setBusy(true);
    setError(null);
    setAnswer(null);

    try {
      if (mode === "question") {
        setEngine(null);
        const reply = await askQuestion(text);
        setAnswer(reply.answer);
        return;
      }

      // Le moteur D'ABORD. C'est lui qui fait autorité sur le nombre.
      const computed = evaluateConstant(text);
      setEngine(computed);
      if (computed.status === "error") return; // rien à expliquer, et rien à envoyer

      const reply = await explainFormula({
        expression: computed.source,
        exact: computed.exact,
        approximate: computed.approximate,
      });
      setAnswer(reply.answer);
    } catch (caught) {
      // Le serveur envoie déjà une phrase française précise (quota atteint,
      // assistant désactivé, service injoignable). On la préfère à un texte
      // générique inventé ici.
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "L'assistant est injoignable. Réessaie dans un instant."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Entrée valide la formule (champ d'une ligne) ; pour la question, qui
    // peut tenir sur plusieurs lignes, il faut Ctrl+Entrée.
    if (event.key === "Enter" && (mode === "formula" || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
      return;
    }
    // Échap vide la saisie ; si elle est déjà vide, il referme le panneau.
    // Même règle que la calculatrice — on ne perd pas un texte par accident.
    if (event.key === "Escape") {
      event.preventDefault();
      if (input === "" && answer === null && error === null && engine === null) onClose();
      else reset();
    }
  }

  const canSubmit = !busy && input.trim() !== "";

  return (
    <div
      role="dialog"
      aria-label="Assistant pédagogique"
      aria-busy={busy}
      className="absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-xl bg-meet-bg-secondary shadow-2xl ring-1 ring-meet-border"
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-meet-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-meet-text-primary">
          <Sparkles size={16} aria-hidden="true" className="text-meet-blue" />
          Assistant
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'assistant"
          className="rounded p-1 text-meet-text-secondary hover:bg-meet-control"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-shrink-0 gap-1 px-3 pt-2" role="group" aria-label="Type de demande">
        {(["question", "formula"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => switchMode(value)}
            aria-pressed={mode === value}
            className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
              mode === value
                ? "bg-meet-control text-meet-text-primary"
                : "text-meet-text-secondary hover:bg-meet-control/60"
            }`}
          >
            {value === "question" ? "Question" : "Formule"}
          </button>
        ))}
      </div>

      <div className="flex-shrink-0 px-3 py-2">
        <label htmlFor="wb-ai-input" className="mb-1 block text-xs text-meet-text-secondary">
          {mode === "question" ? "Ta question" : "Expression à expliquer"}
        </label>

        {mode === "question" ? (
          <textarea
            id="wb-ai-input"
            rows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pourquoi la somme des angles d'un triangle vaut-elle 180° ?"
            aria-describedby="wb-ai-hint"
            className="w-full resize-none rounded-lg border border-meet-border bg-meet-bg px-3 py-2 text-sm leading-snug text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
          />
        ) : (
          <input
            id="wb-ai-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="(3+5)*2"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby="wb-ai-hint"
            className="w-full rounded-lg border border-meet-border bg-meet-bg px-3 py-2 font-mono text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
          />
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={!canSubmit}
            className="rounded-lg bg-meet-blue px-3 py-1.5 text-xs font-medium text-meet-bg transition-colors hover:bg-meet-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "…" : mode === "question" ? "Demander" : "Expliquer"}
          </button>
          {(answer !== null || engine !== null || error !== null) && !busy && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-meet-text-secondary hover:text-meet-text-primary"
            >
              Effacer
            </button>
          )}
        </div>

        <p id="wb-ai-hint" className="mt-2 text-[10px] leading-snug text-meet-text-disabled">
          {mode === "question"
            ? "Ctrl+Entrée pour envoyer. Ta question part telle quelle au fournisseur d'IA."
            : "Le calcul est fait par le moteur de l'application, pas par l'IA : « x » et « = » ne sont pas acceptés ici."}
        </p>
      </div>

      {(busy || answer !== null || engine !== null || error !== null) && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-meet-border px-3 py-2">
          {busy && (
            <p className="text-xs text-meet-text-secondary" role="status">
              L&apos;assistant rédige…
            </p>
          )}

          {error !== null && (
            <div className="flex items-start gap-2 rounded-lg bg-meet-bg px-2.5 py-2" role="alert">
              <AlertTriangle
                size={14}
                aria-hidden="true"
                className="mt-0.5 flex-shrink-0 text-meet-yellow"
              />
              <p className="text-[11px] leading-snug text-meet-text-primary">{error}</p>
            </div>
          )}

          {engine !== null && !busy && (
            <div className="mb-2">
              <EngineResult evaluation={engine} />
            </div>
          )}

          {answer !== null && (
            <div aria-live="polite">
              <p className="mb-1 text-[10px] leading-snug text-meet-text-disabled">
                {mode === "question"
                  ? "Réponse de l'assistant"
                  : "Explication de l'assistant — le résultat ci-dessus vient du moteur"}
              </p>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-meet-text-primary">
                {answer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mention permanente, jamais repliée : une réponse d'IA affichée dans
          un contexte scolaire sans réserve contredirait la règle d'honnêteté
          que le moteur de calcul applique partout ailleurs. */}
      <p className="flex-shrink-0 border-t border-meet-border px-3 py-2 text-[10px] leading-snug text-meet-text-disabled">
        Réponses générées automatiquement. Elles peuvent se tromper : vérifie-les.
      </p>
    </div>
  );
}

/**
 * Le résultat du MOTEUR, dans son propre cadre.
 *
 * Même règle d'honnêteté que `MiniCalculator` et `MathResult` : on n'invente
 * jamais une forme exacte. Le moteur rend `null` quand il n'en a pas, et
 * l'écran écrit alors « aucune forme exacte » au lieu de faire passer
 * l'approximation pour la valeur.
 */
function EngineResult({ evaluation }: { evaluation: Evaluation }) {
  if (evaluation.status === "error") {
    return (
      <p className="rounded-lg bg-meet-bg px-2.5 py-2 text-[11px] font-medium leading-snug text-meet-yellow">
        {evaluation.message}
      </p>
    );
  }

  const hasExact = evaluation.exact !== null;

  return (
    <div className="rounded-lg bg-meet-bg px-2.5 py-2">
      <p className="break-all font-mono text-[11px] leading-snug text-meet-text-secondary">
        {evaluation.source}
      </p>
      <p className="mt-0.5 break-all font-mono text-base leading-snug text-meet-text-primary">
        {evaluation.exact ?? evaluation.approximate}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-meet-text-disabled">
        {hasExact
          ? "Valeur exacte, calculée par le moteur"
          : "Valeur approchée — le moteur n'a pas de forme exacte ici"}
      </p>
    </div>
  );
}
