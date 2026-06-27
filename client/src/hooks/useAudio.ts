import { useState, useCallback, useEffect } from "react";
import { playSound, toggleMute } from "../utils/audio.js";

export function useAudio() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const handler = () => {
      // init AudioContext on first user interaction
      playSound("dice_roll");
    };
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, []);

  const trigger = useCallback((name: Parameters<typeof playSound>[0]) => {
    playSound(name);
  }, []);

  const toggle = useCallback(() => {
    const m = toggleMute();
    setMuted(m);
  }, []);

  return { muted, toggle, trigger };
}
