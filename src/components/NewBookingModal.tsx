import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { createBooking } from "../lib/bookingApi";

interface NewBookingModalProps {
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Formulaire de réservation d'une séance. La durée n'est pas modifiable
 * (fixée à 3h, cohérent avec la règle métier appliquée partout ailleurs
 * — voir MIN_SESSION_SECONDS côté backend) : on l'affiche en lecture
 * seule plutôt que de laisser croire que c'est configurable.
 */
export function NewBookingModal({ onClose, onCreated }: NewBookingModalProps) {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await createBooking({
        otherPartyEmail: email.trim(),
        subject: subject.trim(),
        startsAt: new Date(startsAt).toISOString(),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la réservation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Empêche de choisir une date/heure dans le passé dans le sélecteur.
  const minDateTime = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm animate-slide-up rounded-2xl bg-meet-bg-secondary p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-meet-text-primary">Réserver une séance</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded p-1 text-meet-text-secondary hover:bg-meet-control"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs text-meet-text-secondary">
              Email de l'élève ou du prof
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              className="w-full rounded-lg border border-meet-border bg-meet-bg px-3 py-2 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
            />
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-xs text-meet-text-secondary">
              Matière
            </label>
            <input
              id="subject"
              type="text"
              required
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="ex. Mathématiques"
              className="w-full rounded-lg border border-meet-border bg-meet-bg px-3 py-2 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
            />
          </div>

          <div>
            <label htmlFor="startsAt" className="mb-1 block text-xs text-meet-text-secondary">
              Date et heure
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              required
              min={minDateTime}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-lg border border-meet-border bg-meet-bg px-3 py-2 text-sm text-meet-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
            />
            <p className="mt-1 text-xs text-meet-text-disabled">Durée : 3 heures</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-meet-blue px-6 py-2.5 text-sm font-medium text-meet-bg transition-colors hover:bg-meet-blue-hover disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Envoyer la demande
          </button>

          {error && (
            <p role="alert" className="text-center text-sm text-meet-yellow">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
