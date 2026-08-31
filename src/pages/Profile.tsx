import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Check, Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAvatarColor } from "../lib/avatarColor";

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
    <div className="relative min-h-screen overflow-x-hidden bg-meet-bg px-4 pb-16 pt-6 sm:px-6">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-meet-blue/20 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-meet-pink/10 blur-[110px]" />
      </div>

      <div className="mx-auto w-full max-w-lg">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-meet-text-secondary transition-colors hover:text-meet-text-primary"
        >
          <ArrowLeft size={16} />
          Retour
        </Link>

        <div className="animate-slide-up rounded-2xl border border-meet-border/60 bg-meet-bg-secondary/40 p-6 shadow-panel backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-lg font-medium text-black"
                style={{ backgroundColor: getAvatarColor(user.id) }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto}
                aria-label="Changer la photo de profil"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-meet-blue text-white ring-2 ring-meet-bg-secondary transition-transform hover:scale-105 disabled:opacity-60"
              >
                {isProcessingPhoto ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Camera size={13} />
                )}
              </button>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-medium text-meet-text-primary">
                {user.name}
              </h1>
              <p className="text-sm text-meet-text-secondary">
                {ROLE_LABELS[user.role] ?? user.role} · {user.email}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm text-meet-text-secondary">
                Nom affiché
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary px-4 py-3 text-sm text-meet-text-primary transition-all duration-200 ease-fluid focus:outline-none focus-visible:border-meet-blue focus-visible:shadow-glow focus-visible:ring-2 focus-visible:ring-meet-blue/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-meet-text-secondary">Email</label>
              <div className="w-full rounded-lg border border-meet-border bg-meet-bg-secondary/50 px-4 py-3 text-sm text-meet-text-disabled">
                {user.email}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving || !name.trim() || isProcessingPhoto}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-meet-blue to-meet-pink bg-[length:200%_100%] bg-left px-6 py-3 text-sm font-medium text-white shadow-glow transition-all duration-300 ease-fluid hover:scale-[1.02] hover:bg-right active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
            >
              {isSaving && <Loader2 size={18} className="animate-spin" />}
              {saved && !isSaving && <Check size={18} />}
              {saved && !isSaving ? "Enregistré" : "Enregistrer"}
            </button>

            {error && (
              <p role="alert" className="animate-slide-down text-center text-sm text-meet-yellow">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}