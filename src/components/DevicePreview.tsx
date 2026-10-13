import { useState } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useMediaPreview } from "../hooks/useMediaDevices";
import { resolveAvatar } from "../lib/avatarColor";

interface DevicePreviewProps {
  displayName: string;
  avatarUrl?: string;                 // ← ajouté
  identity?: string;                  // ← nouveau

  onDeviceStateChange: (state: { micEnabled: boolean; cameraEnabled: boolean }) => void;
}

/**
 * Aperçu caméra/micro affiché avant de rejoindre la réunion. Donne
 * immédiatement une impression de produit professionnel — l'utilisateur
 * voit à quoi il ressemblera avant d'entrer dans la salle.
 *
 * AUCUNE LIGNE DE LOGIQUE N'A CHANGÉ : le flux, les deux bascules et la règle
 * d'avatar sont ceux d'avant. Ce sont les seuls éléments qui comptent
 * fonctionnellement — l'état transmis à `onDeviceStateChange` est celui qui
 * décide si l'on entre micro et caméra ouverts. Seul l'habillage a bougé.
 *
 * La largeur n'est PLUS contrainte ici (`w-full` au lieu de `max-w-xl`) : le
 * dimensionnement appartient désormais à la colonne qui l'accueille, dans
 * `prejoin.css`. Un composant qui porte sa propre largeur maximale ne peut pas
 * se poser dans une grille sans se battre contre elle.
 */
export function DevicePreview({ displayName, avatarUrl, identity, onDeviceStateChange }: DevicePreviewProps) {
  const { videoRef, micEnabled, cameraEnabled, toggleMic, toggleCamera, error } =
    useMediaPreview();

  function handleToggleMic() {
    toggleMic();
    onDeviceStateChange({ micEnabled: !micEnabled, cameraEnabled });
  }

  function handleToggleCamera() {
    toggleCamera();
    onDeviceStateChange({ micEnabled, cameraEnabled: !cameraEnabled });
  }

  // Même règle que dans la réunion, et surtout la MÊME clé de couleur.
  // L'ancien `identity ?? displayName` retombait sur `""` — `??` ne rattrape
  // pas la chaîne vide — donc la couleur était toujours la première de la
  // palette. `||` rétablit le repli voulu.
  const avatar = resolveAvatar({
    identity: identity || displayName,
    name: displayName,
    imageUrl: avatarUrl,
  });

  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null);
  const photoUrl =
    avatar.photoUrl && avatar.photoUrl !== brokenPhotoUrl ? avatar.photoUrl : null;

  return (
    <div className="w-full">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-meet-tile shadow-lg ring-1 ring-black/10">
        {cameraEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                onError={() => setBrokenPhotoUrl(photoUrl)}
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-medium text-meet-bg"
                style={{ backgroundColor: avatar.color }}
              >
                {avatar.initials}
              </div>
            )}
            <p className="text-xs font-medium text-meet-text-primary">
              La caméra est désactivée
            </p>
        
          </div>
        )}

        {/* Le nom est posé SUR l'image, pas à côté : il doit tenir aussi bien
            sur une vidéo claire que sur une vidéo sombre, et sur la tuile grise
            de la caméra coupée. Un fond translucide sombre est le seul
            traitement qui reste lisible dans les trois cas — un texte nu
            disparaîtrait sur un mur blanc. Il est masqué si le nom est vide,
            plutôt que de laisser une pastille sans contenu. */}
        {displayName && (
          <span className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {displayName}
          </span>
        )}

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
          <button
            type="button"
            onClick={handleToggleMic}
            aria-pressed={!micEnabled}
            aria-label={micEnabled ? "Couper le micro" : "Activer le micro"}
            className={`control-btn ${!micEnabled ? "control-btn-active" : ""}`}
          >
            {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            type="button"
            onClick={handleToggleCamera}
            aria-pressed={!cameraEnabled}
            aria-label={cameraEnabled ? "Couper la caméra" : "Activer la caméra"}
            className={`control-btn ${!cameraEnabled ? "control-btn-active" : ""}`}
          >
            {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </div>
      </div>

      {/* Cette erreur s'affiche dans la page de pré-jonction, pas dans la
          salle : elle prend donc le message d'erreur de cette page
          (`.pj-error` : bordure, fond teinté et rouge de texte de
          l'application) au lieu du `meet-yellow`, que la salle réserve au
          partage d'écran. Le rôle `alert` est conservé. */}
      {error && (
        <p role="alert" className="pj-error">
          {error}
        </p>
      )}
    </div>
  );
}
