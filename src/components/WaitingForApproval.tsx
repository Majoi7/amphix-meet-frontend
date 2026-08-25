import { Loader2 } from "lucide-react";

/**
 * Affiché à la place du pre-join/de la salle quand la réunion a une salle
 * d'attente activée et que l'hôte n'a pas encore répondu. Room.tsx poll
 * getLobbyStatus() en arrière-plan et bascule automatiquement vers la
 * réunion dès l'approbation — rien à faire ici, juste informer.
 */
export function WaitingForApproval() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-meet-bg px-4 text-center">
      <Loader2 size={32} className="animate-spin text-meet-blue" />
      <p className="text-lg font-medium text-meet-text-primary">En attente de validation…</p>
      <p className="max-w-sm text-sm text-meet-text-secondary">
        L'hôte doit accepter ta demande avant que tu puisses rejoindre la réunion. Cette page se
        mettra à jour automatiquement.
      </p>
    </div>
  );
}
