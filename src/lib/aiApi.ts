import { authorizedRequest } from "./httpClient";

/**
 * Client de l'assistant IA.
 *
 * Même gabarit que `whiteboardApi.ts` : `authorizedRequest` attache l'access
 * token et gère le renouvellement silencieux. Rien à ajouter ici — et
 * surtout, AUCUNE clé d'API ne transite par ce module : le navigateur ne
 * connaît que notre propre backend, qui seul détient la clé du fournisseur.
 *
 * Les messages d'erreur viennent du serveur, en français (`ApiRequestError`).
 * L'appelant les affiche tels quels : ils sont plus précis que tout ce que
 * le client pourrait inventer, parce que lui seul connaît la cause.
 */

export interface AiStatus {
  /** `AI_ENABLED` côté serveur. */
  enabled: boolean;
  /** La clé du fournisseur est-elle renseignée ? */
  configured: boolean;
  model: string;
}

/** Réponse d'une demande pédagogique. */
export interface AiAnswer {
  answer: string;
  model: string;
}

/**
 * État de la passerelle. N'appelle PAS le fournisseur : cette route ne
 * consomme aucun quota, elle peut donc être appelée à l'ouverture du tableau
 * blanc pour décider s'il faut afficher le bouton de l'assistant.
 */
export function getAiStatus(): Promise<AiStatus> {
  return authorizedRequest<AiStatus>("/api/v1/ai/status", { method: "GET" });
}

/** Une question pédagogique, telle que l'élève la pose. */
export function askQuestion(question: string): Promise<AiAnswer> {
  return authorizedRequest<AiAnswer>("/api/v1/ai/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

/**
 * Demande l'explication d'un résultat DÉJÀ CALCULÉ par le moteur.
 *
 * Le résultat est transmis tel quel, et c'est le serveur qui le place dans le
 * prompt en le désignant comme faisant autorité. Le modèle n'a donc pas à
 * recalculer : il explique un fait, il ne le produit pas.
 */
export function explainFormula(context: {
  expression: string;
  exact: string | null;
  approximate: string;
}): Promise<AiAnswer> {
  return authorizedRequest<AiAnswer>("/api/v1/ai/explain", {
    method: "POST",
    body: JSON.stringify(context),
  });
}
