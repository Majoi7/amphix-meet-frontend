import { useEffect, useRef, useState } from "react";

interface UseMediaPreviewResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  micEnabled: boolean;
  cameraEnabled: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  error: string | null;
}

/**
 * Gère l'aperçu caméra/micro sur l'écran de pre-join, avant d'entrer dans la
 * salle LiveKit. On utilise directement getUserMedia ici — LiveKit ne prend
 * le relais qu'une fois qu'on rejoint la salle (dans Room.tsx).
 */
export function useMediaPreview(): UseMediaPreviewResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            "Impossible d'accéder à la caméra ou au micro. Vérifie les permissions de ton navigateur."
          );
          setCameraEnabled(false);
          setMicEnabled(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function toggleMic() {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicEnabled(audioTrack.enabled);
    }
  }

  function toggleCamera() {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraEnabled(videoTrack.enabled);
    }
  }

  return { videoRef, micEnabled, cameraEnabled, toggleMic, toggleCamera, error };
}
