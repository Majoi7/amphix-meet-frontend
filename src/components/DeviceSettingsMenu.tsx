import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, Mic, Speaker, Video } from "lucide-react";
import { useMediaDeviceSelect } from "@livekit/components-react";

interface DeviceSettingsMenuProps {
  onClose: () => void;
}

/**
 * Menu permettant de changer de caméra, micro ou haut-parleur en cours de
 * réunion. Le haut-parleur (audiooutput) n'est pas supporté par tous les
 * navigateurs (Safari notamment ne permet pas de changer la sortie audio
 * via l'API Web) — dans ce cas la liste est simplement vide, avec un
 * message explicite plutôt qu'un onglet cassé.
 */
export function DeviceSettingsMenu({ onClose }: DeviceSettingsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"camera" | "microphone" | "speaker">("camera");

  const cameraSelect = useMediaDeviceSelect({ kind: "videoinput" });
  const micSelect = useMediaDeviceSelect({ kind: "audioinput" });
  const speakerSelect = useMediaDeviceSelect({ kind: "audiooutput" });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const activeDevices =
    tab === "camera" ? cameraSelect : tab === "microphone" ? micSelect : speakerSelect;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-16 left-1/2 w-72 max-w-[90vw] -translate-x-1/2 animate-slide-up rounded-xl bg-meet-bg-secondary p-2 shadow-2xl ring-1 ring-meet-border"
    >
      <div className="mb-2 flex gap-1 border-b border-meet-border pb-2">
        <button
          type="button"
          onClick={() => setTab("camera")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
            tab === "camera"
              ? "bg-meet-control text-meet-text-primary"
              : "text-meet-text-secondary hover:bg-meet-control"
          }`}
        >
          <Video size={14} /> Caméra
        </button>
        <button
          type="button"
          onClick={() => setTab("microphone")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
            tab === "microphone"
              ? "bg-meet-control text-meet-text-primary"
              : "text-meet-text-secondary hover:bg-meet-control"
          }`}
        >
          <Mic size={14} /> Micro
        </button>
        <button
          type="button"
          onClick={() => setTab("speaker")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
            tab === "speaker"
              ? "bg-meet-control text-meet-text-primary"
              : "text-meet-text-secondary hover:bg-meet-control"
          }`}
        >
          <Speaker size={14} /> Sortie
        </button>
      </div>

      <ul className="max-h-48 overflow-y-auto">
        {activeDevices.devices.length === 0 && (
          <li className="px-3 py-2 text-xs text-meet-text-secondary">
            {tab === "speaker"
              ? "Ton navigateur ne permet pas de choisir la sortie audio."
              : "Aucun appareil détecté."}
          </li>
        )}
        {activeDevices.devices.map((device) => (
          <li key={device.deviceId}>
            <button
              type="button"
              onClick={() => activeDevices.setActiveMediaDevice(device.deviceId)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-meet-text-primary hover:bg-meet-control"
            >
              <span className="truncate">
                {device.label || `Appareil ${device.deviceId.slice(0, 6)}`}
              </span>
              {activeDevices.activeDeviceId === device.deviceId && (
                <Check size={16} className="flex-shrink-0 text-meet-blue" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Petit chevron affiché à côté des boutons micro/caméra pour ouvrir ce menu
 * — même pattern que Google Meet.
 */
export function DeviceSettingsToggle({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Choisir un appareil"
      aria-expanded={isOpen}
      className="flex h-5 w-5 items-center justify-center rounded-full bg-meet-bg text-meet-text-secondary ring-1 ring-meet-border hover:text-meet-text-primary"
    >
      <ChevronUp size={12} />
    </button>
  );
}
