import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Check, Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getAvatarColor } from "../lib/avatarColor";
import "../styles/theme.css";
import "./profile.css";

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Élève",
  TEACHER: "Professeur",
  ADMIN: "Administrateur",
};

const MAX_SOURCE_SIZE_MB = 10;
const OUTPUT_SIZE_PX = 512;

/** Redimensionne + compresse l'image côté client avant stockage en base64. */
function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode_failed"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        canvas.width = OUTPUT_SIZE_PX;
        canvas.height = OUTPUT_SIZE_PX;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas_unsupported"));
        ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE_PX, OUTPUT_SIZE_PX);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function Profile() {
  const { user, updateProfile } = useAuth();

  // Le profil suivait la palette sombre de la salle de réunion alors qu'il
  // s'atteint depuis la navigation, comme l'accueil et les paramètres : il
  // était la dernière page à ne pas suivre le thème choisi. Il lit
  // désormais la même préférence, et la pose sur sa racine.
  const { resolved } = useTheme();

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handlePhotoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de reséléctionner le même fichier ensuite
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choisis un fichier image (JPEG, PNG…).");
      return;
    }
    if (file.size > MAX_SOURCE_SIZE_MB * 1024 * 1024) {
      setError(`Image trop lourde (max ${MAX_SOURCE_SIZE_MB} Mo).`);
      return;
    }
    setError(null);
    setIsProcessingPhoto(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch {
      setError("Impossible de traiter cette image. Essaie-en une autre.");
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ name: name.trim(), avatarUrl: avatarUrl || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Impossible de mettre à jour le profil. Réessaie.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app-theme pf-root" data-theme={resolved}>
      <div className="pf-glow" aria-hidden="true" />

      <div className="pf-wrap">
        <Link to="/" className="pf-back">
          <ArrowLeft size={16} />
          Retour
        </Link>

        <div className="pf-card animate-slide-up">
          <div className="pf-head">
            <div className="pf-avatar-wrap">
              <div
                className="pf-avatar pf-avatar-fb"
                style={{ backgroundColor: getAvatarColor(user.id) }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="pf-avatar-img" />
                ) : (
                  initials
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="pf-file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto}
                aria-label="Changer la photo de profil"
                className="pf-photo"
              >
                {isProcessingPhoto ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Camera size={13} />
                )}
              </button>
            </div>
            <div className="pf-id">
              <h1 className="pf-name">{user.name}</h1>
              <p className="pf-role">
                {ROLE_LABELS[user.role] ?? user.role} · {user.email}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="pf-form">
            <div className="pf-field">
              <label htmlFor="name" className="pf-label">
                Nom affiché
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pf-input"
              />
            </div>

            <div className="pf-field">
              <label className="pf-label">Email</label>
              <div className="pf-static">{user.email}</div>
            </div>

            <button
              type="submit"
              disabled={isSaving || !name.trim() || isProcessingPhoto}
              className="pf-submit"
            >
              {isSaving && <Loader2 size={18} className="animate-spin" />}
              {saved && !isSaving && <Check size={18} />}
              {saved && !isSaving ? "Enregistré" : "Enregistrer"}
            </button>

            {error && (
              <p role="alert" className="pf-error animate-slide-down">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}