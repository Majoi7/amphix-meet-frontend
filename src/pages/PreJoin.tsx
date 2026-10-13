import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AmphixLogo } from "../components/AmphixLogo";
import { DevicePreview } from "../components/DevicePreview";
import { useAuth } from "../context/AuthContext";
import { resolveAvatar } from "../lib/avatarColor";
import type { DevicePreferences } from "../types";
import "../styles/theme.css";
import "./prejoin.css";

interface PreJoinProps {
  onJoin: (prefs: DevicePreferences) => Promise<void>;
  isJoining: boolean;
  error: string | null;
}

/**
 * Écran de pré-jonction — en-tête, aperçu vidéo, panneau de participation.
 *
 * CE QUI N'A PAS CHANGÉ, ET QUI COMPTE
 *
 * Les trois props sont les mêmes, `handleSubmit` appelle `onJoin` avec les
 * mêmes `DevicePreferences`, et `DevicePreview` reçoit exactement les mêmes
 * valeurs. Le parcours vers la salle — `Room.tsx` → `joinMeeting` → LiveKit ou
 * salle d'attente — est donc intact : cette page n'a rien appris de nouveau à
 * faire, elle est seulement disposée autrement.
 *
 * CE QUE CET ÉCRAN NE FERA PAS
 *
 * Ni sélection de périphériques, ni compteur de participants, ni statut de
 * visibilité, ni aide par IA. Aucune de ces informations n'est disponible
 * avant la connexion — `joinMeeting` n'est appelé qu'au clic, et il est la
 * seule source du jeton. Les afficher supposerait de les inventer. Le brief
 * est explicite sur ce point, et c'est aussi la règle d'honnêteté appliquée
 * partout ailleurs dans l'application.
 *
 * PAS D'ATTRIBUT `data-theme` — décision assumée
 *
 * La racine ne porte plus que `app-theme`. C'est ce qui rend le fond blanc
 * STRUCTUREL : sans cet attribut, `.app-theme[data-theme="dark"]` de
 * `theme.css` ne peut pas s'appliquer, donc les jetons `--app-*` gardent leurs
 * valeurs claires même si l'application est en thème sombre. Une surcharge
 * `.pj-root { --app-bg: … }` aurait perdu la bataille de spécificité contre un
 * sélecteur (0,2,0). Conséquence : cette page n'est plus thématisée, et
 * `useDashboardTheme` n'y est plus lu.
 */
export function PreJoin({ onJoin, isJoining, error }: PreJoinProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deviceState, setDeviceState] = useState({ micEnabled: true, cameraEnabled: true });

  if (!roomId) {
    navigate("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onJoin(deviceState);
  }

  // Même règle et même clé de couleur (`user.id`) que dans la réunion :
  // la personne garde la même couleur avant et après l'entrée.
  const avatar = resolveAvatar({
    identity: user?.id ?? "",
    name: user?.name,
    imageUrl: user?.avatarUrl,
  });

  return (
    <div className="app-theme pj-root">
      <header className="pj-header">
        <div className="pj-header-in">
          <span className="pj-brand">
            <AmphixLogo />
            <span className="pj-brand-name">Amphix Meet</span>
          </span>

          {/* Le compte, en LECTURE SEULE : c'est un `<span>`, pas un lien.
              Sur l'accueil, la même pastille mène au profil ; ici, elle ferait
              quitter une pré-jonction en cours, et l'utilisateur devrait
              revenir en arrière pour rejoindre. Afficher sans naviguer est le
              seul comportement qui ne piège personne. */}
          {user && (
            <span className="pj-account">
              {avatar.photoUrl ? (
                <img
                  src={avatar.photoUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="pj-avatar"
                />
              ) : (
                <span
                  className="pj-avatar pj-avatar-fb"
                  style={{ backgroundColor: avatar.color }}
                >
                  {avatar.initials}
                </span>
              )}
              <span className="pj-account-name">{user.name}</span>
            </span>
          )}
        </div>
      </header>

      <main className="pj-main">
        <div className="pj-preview">
          <DevicePreview
            displayName={user?.name ?? ""}
            avatarUrl={user?.avatarUrl ?? undefined}
            identity={user?.id ?? ""}
            onDeviceStateChange={setDeviceState}
          />
        </div>

        {/* `aria-labelledby` fait du titre le nom accessible du formulaire :
            un lecteur d'écran annonce « Prêt à participer ? » plutôt que
            « formulaire ». `aria-busy` signale la connexion en cours pendant
            que le bouton passe à l'état désactivé. */}
        <form
          onSubmit={handleSubmit}
          aria-labelledby="pj-title"
          aria-busy={isJoining}
          className="pj-panel"
        >
          <h1 id="pj-title" className="pj-title">
            Prêt à participer&nbsp;?
          </h1>

          <p className="pj-sub">
            Réunion <span className="pj-code">{roomId}</span>
          </p>

          {error && (
            <p role="alert" className="pj-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={isJoining} className="pj-join">
            {isJoining && <Loader2 size={18} className="pj-spin" />}
            Participer à la réunion
          </button>
        </form>
      </main>
    </div>
  );
}
