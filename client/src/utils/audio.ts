type SoundName = "dice_roll" | "dice_place" | "dice_reroll" | "counter_fire" | "counter_hit" | "shield_place" | "victory" | "defeat";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function osc(type: OscillatorType, freq: number, start: number, dur: number, gain: number, dest: AudioNode) {
  const o = getCtx().createOscillator();
  const g = getCtx().createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur);
}

function playDiceReroll() {
  const c = getCtx();
  const t = c.currentTime;
  for (let i = 0; i < 6; i++) {
    const st = t + i * 0.03;
    osc("triangle", 500 + Math.random() * 600, st, 0.05, 0.2, c.destination);
  }
  osc("sine", 800, t + 0.18, 0.08, 0.15, c.destination);
}

function playDiceRoll() {
  const c = getCtx();
  const master = c.createGain();
  master.gain.setValueAtTime(0.25, c.currentTime);
  master.connect(c.destination);

  for (let i = 0; i < 4; i++) {
    const t = c.currentTime + i * 0.04;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(300 + Math.random() * 400, t);
    o.frequency.exponentialRampToValueAtTime(150 + Math.random() * 200, t + 0.06);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.06);
  }
}

function playDicePlace() {
  const c = getCtx();
  const t = c.currentTime;
  osc("square", 1000, t, 0.02, 0.1, c.destination);
  osc("sine", 600, t + 0.008, 0.015, 0.06, c.destination);
}

function playCounterFire() {
  const c = getCtx();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(400, t);
  o.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.2);
}

function playCounterHit() {
  const c = getCtx();
  const t = c.currentTime;
  osc("sine", 120, t, 0.12, 0.2, c.destination);
  osc("sine", 80, t + 0.02, 0.1, 0.12, c.destination);
}

function playShieldPlace() {
  const c = getCtx();
  const t = c.currentTime;
  osc("sine", 800, t, 0.15, 0.2, c.destination);
  osc("sine", 1200, t + 0.05, 0.15, 0.15, c.destination);
  osc("sine", 1600, t + 0.1, 0.12, 0.1, c.destination);
}

function playVictory() {
  const c = getCtx();
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => {
    osc("sine", freq, t + i * 0.15, 0.3, 0.2, c.destination);
  });
}

function playDefeat() {
  const c = getCtx();
  const t = c.currentTime;
  [400, 350, 300, 250].forEach((freq, i) => {
    osc("sine", freq, t + i * 0.2, 0.35, 0.2, c.destination);
  });
}

export function playSound(name: SoundName) {
  if (_muted) return;
  try {
    switch (name) {
      case "dice_roll": playDiceRoll(); break;
      case "dice_place": playDicePlace(); break;
      case "dice_reroll": playDiceReroll(); break;
      case "counter_fire": playCounterFire(); break;
      case "counter_hit": playCounterHit(); break;
      case "shield_place": playShieldPlace(); break;
      case "victory": playVictory(); break;
      case "defeat": playDefeat(); break;
    }
  } catch {
    // AudioContext not available or blocked — silently ignore
  }
}

let _muted = false;

export function isMuted(): boolean {
  return _muted;
}

export function setMuted(m: boolean) {
  _muted = m;
}

export function toggleMute(): boolean {
  _muted = !_muted;
  return _muted;
}

let _bgmOn = false;
let _bgmVolume = 0.05;
let _bgmAudio: HTMLAudioElement | null = null;

function _ensureBgmAudio() {
  if (!_bgmAudio) {
    _bgmAudio = new Audio("/bgm.mp3");
    _bgmAudio.loop = true;
    _bgmAudio.volume = _bgmVolume;
  }
  return _bgmAudio;
}

let _bgmStarted = false;

export function startBGM() {
  if (_bgmOn) return;
  _bgmOn = true;
  const audio = _ensureBgmAudio();
  audio.volume = _bgmVolume;
  if (!_bgmStarted) {
    audio.currentTime = 0;
    _bgmStarted = true;
  }
  audio.play().catch(() => {
    _bgmOn = false;
    const handler = () => {
      audio.play().then(() => { _bgmOn = true; }).catch(() => {});
      document.removeEventListener("click", handler);
    };
    document.addEventListener("click", handler);
  });
}

export function stopBGM() {
  if (_bgmAudio) {
    _bgmAudio.pause();
  }
  _bgmOn = false;
}

export function isBGMOn(): boolean { return _bgmOn; }

export function setBGMVolume(v: number) {
  _bgmVolume = v;
  if (_bgmAudio) _bgmAudio.volume = v;
}

export function getBGMVolume(): number { return _bgmVolume; }

export function toggleBGM(): boolean {
  if (_bgmOn) {
    stopBGM();
  } else {
    startBGM();
  }
  return _bgmOn;
}
