import { useState, useCallback, useEffect } from "react";
import {
  playSound,
  toggleMute,
  isBGMOn,
  toggleBGM,
  setBGMVolume,
  getBGMVolume,
  startBGM,
  stopBGM,
} from "../utils/audio.js";

export function useAudio() {
  const [muted, setMuted] = useState(false);
  const [bgmOn, setBgmOn] = useState(isBGMOn());
  const [bgmVolume, setBgmVolumeState] = useState(getBGMVolume());

  useEffect(() => {
    const handler = () => {
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

  const toggleBgm = useCallback(() => {
    const on = toggleBGM();
    setBgmOn(on);
  }, []);

  const changeBGMVolume = useCallback((v: number) => {
    setBGMVolume(v);
    setBgmVolumeState(v);
  }, []);

  const syncBGM = useCallback(() => {
    setBgmOn(isBGMOn());
  }, []);

  return {
    muted,
    toggle,
    trigger,
    bgmOn,
    toggleBgm,
    bgmVolume,
    changeBGMVolume,
    syncBGM,
    startBGM,
    stopBGM,
  };
}