import { useCallback } from "react";

export function useHandRaiseSound() {
  return useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      // Create a more complex sound: a chord (Do-Mi-Sol) with a bit of harmonics
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(ctx.destination);

      // Set oscillators to sine wave for clarity
      osc1.type = "sine";
      osc2.type = "sine";
      osc3.type = "sine";

      // Frequencies for a major chord (C4-E4-G4)
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C4
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E4
      osc3.frequency.setValueAtTime(783.99, ctx.currentTime); // G4

      // Increase gain for louder sound (0.3 is louder than 0.2, but not distorted)
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      // Quick attack and decay for a percussive feel
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc1.start();
      osc2.start();
      osc3.start();
      osc1.stop(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.3);
      osc3.stop(ctx.currentTime + 0.3);
    } catch {
      // silent fail
    }
  }, []);
}