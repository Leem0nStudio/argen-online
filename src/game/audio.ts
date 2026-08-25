// ============================================================
// Procedural Audio Engine — Web Audio API
// Generates all sounds procedurally, no asset files needed
// ============================================================

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let currentMusicOsc: OscillatorNode[] = [];
let musicPlaying = false;
let musicTimeout: ReturnType<typeof setTimeout> | null = null;

const ctxRef = () => {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);
  }
  return ctx;
};

// ---- Utility ----
function noise(duration: number, volume = 0.3): AudioBuffer {
  const c = ctxRef();
  const len = c.sampleRate * duration;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * volume;
  return buf;
}

function playBuffer(buf: AudioBuffer, dest: AudioNode, detune = 0) {
  const c = ctxRef();
  const src = c.createBufferSource();
  src.buffer = buf;
  if (detune) src.detune.value = detune;
  src.connect(dest);
  src.start();
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", vol = 0.2) {
  const c = ctxRef();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(sfxGain!);
  osc.start();
  osc.stop(c.currentTime + duration);
}

// ---- Sound Effects ----

export function playFootstep() {
  const c = ctxRef();
  const buf = noise(0.06, 0.15);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400 + Math.random() * 200;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain!);
  src.start();
}

export function playHit() {
  const c = ctxRef();
  // Punchy hit sound
  tone(200 + Math.random() * 100, 0.12, "square", 0.25);
  tone(80, 0.15, "sine", 0.3);
  // Noise burst
  const buf = noise(0.08, 0.4);
  playBuffer(buf, sfxGain!);
}

export function playCrit() {
  tone(600, 0.08, "sawtooth", 0.3);
  tone(300, 0.15, "square", 0.2);
  const buf = noise(0.1, 0.5);
  playBuffer(buf, sfxGain!);
  setTimeout(() => tone(800, 0.12, "sine", 0.15), 50);
}

export function playDeath() {
  tone(400, 0.3, "sawtooth", 0.2);
  tone(200, 0.5, "sawtooth", 0.15);
  setTimeout(() => tone(100, 0.6, "sine", 0.2), 200);
  const buf = noise(0.5, 0.3);
  playBuffer(buf, sfxGain!);
}

export function playLevelUp() {
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((f, i) => {
    setTimeout(() => tone(f, 0.3, "sine", 0.2), i * 100);
  });
}

export function playPickup() {
  tone(880, 0.1, "sine", 0.15);
  setTimeout(() => tone(1320, 0.15, "sine", 0.12), 80);
}

export function playEquip() {
  tone(440, 0.08, "square", 0.1);
  tone(660, 0.12, "square", 0.08);
}

export function playUsePotion() {
  // Bubbling sound
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      tone(300 + Math.random() * 400, 0.08, "sine", 0.1);
    }, i * 60);
  }
}

export function playBuy() {
  tone(1200, 0.05, "sine", 0.15);
  setTimeout(() => tone(1600, 0.08, "sine", 0.1), 50);
  setTimeout(() => tone(2000, 0.1, "sine", 0.08), 100);
}

export function playSell() {
  tone(2000, 0.05, "sine", 0.12);
  setTimeout(() => tone(1200, 0.08, "sine", 0.1), 50);
}

export function playChat() {
  tone(800, 0.06, "sine", 0.08);
  setTimeout(() => tone(1000, 0.06, "sine", 0.06), 40);
}

export function playZoneChange() {
  tone(440, 0.2, "sine", 0.1);
  tone(660, 0.3, "sine", 0.08);
}

export function playError() {
  tone(200, 0.15, "square", 0.12);
  setTimeout(() => tone(150, 0.2, "square", 0.1), 100);
}

// ---- Ambient Sounds ----

let ambientInterval: ReturnType<typeof setInterval> | null = null;

export function startAmbient(zone: string) {
  stopAmbient();
  ambientInterval = setInterval(() => {
    if (!ctx || ctx.state !== "running") return;
    if (zone === "city") {
      // Occasional bird chirp
      if (Math.random() < 0.3) {
        tone(1200 + Math.random() * 800, 0.08, "sine", 0.04);
        setTimeout(() => tone(1400 + Math.random() * 600, 0.06, "sine", 0.03), 100);
      }
    } else if (zone === "wilderness") {
      // Wind gusts
      if (Math.random() < 0.2) {
        const c = ctxRef();
        const buf = noise(0.5, 0.05);
        const src = c.createBufferSource();
        src.buffer = buf;
        const filter = c.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 200 + Math.random() * 100;
        filter.Q.value = 2;
        const gain = c.createGain();
        gain.gain.setValueAtTime(0, c.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.2);
        gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain!);
        src.start();
      }
    } else if (zone === "dungeon") {
      // Water drip + echo
      if (Math.random() < 0.15) {
        const c = ctxRef();
        const buf = noise(0.03, 0.2);
        const src = c.createBufferSource();
        src.buffer = buf;
        const filter = c.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 2000;
        filter.Q.value = 8;
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.1, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain!);
        src.start();
      }
      // Occasional torch crackle
      if (Math.random() < 0.25) {
        tone(100 + Math.random() * 50, 0.02, "sawtooth", 0.02);
      }
    }
  }, 800);
}

export function stopAmbient() {
  if (ambientInterval) { clearInterval(ambientInterval); ambientInterval = null; }
}

// ---- Background Music (Procedural) ----

const SCALES: Record<string, number[]> = {
  city: [261, 293, 329, 349, 392, 440, 493], // C major
  wilderness: [261, 293, 311, 349, 392, 415, 466], // C minor-ish
  dungeon: [220, 233, 261, 277, 311, 329, 370], // Dark minor
};

function playMusicLoop() {
  if (!musicPlaying) return;
  const c = ctxRef();
  const zone = (currentZoneForMusic as keyof typeof SCALES) || "city";
  const scale = SCALES[zone] || SCALES.city;

  const now = c.currentTime;
  const baseNote = scale[0];

  // Pad drone
  const pad1 = c.createOscillator();
  pad1.type = "sine";
  pad1.frequency.value = baseNote * 0.5;
  const padGain = c.createGain();
  padGain.gain.setValueAtTime(0, now);
  padGain.gain.linearRampToValueAtTime(0.04, now + 2);
  padGain.gain.linearRampToValueAtTime(0, now + 8);
  pad1.connect(padGain);
  padGain.connect(musicGain!);
  pad1.start(now);
  pad1.stop(now + 8);

  const pad2 = c.createOscillator();
  pad2.type = "sine";
  pad2.frequency.value = scale[4] * 0.5;
  const pad2Gain = c.createGain();
  pad2Gain.gain.setValueAtTime(0, now);
  pad2Gain.gain.linearRampToValueAtTime(0.03, now + 3);
  pad2Gain.gain.linearRampToValueAtTime(0, now + 8);
  pad2.connect(pad2Gain);
  pad2Gain.connect(musicGain!);
  pad2.start(now);
  pad2.stop(now + 8);

  // Melody notes
  const melodyLen = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < melodyLen; i++) {
    const note = scale[Math.floor(Math.random() * scale.length)];
    const t = now + 1 + i * (0.8 + Math.random() * 0.6);
    const dur = 0.4 + Math.random() * 0.3;

    const osc = c.createOscillator();
    osc.type = zone === "dungeon" ? "triangle" : "sine";
    osc.frequency.value = note * (Math.random() < 0.3 ? 2 : 1);

    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(g);
    g.connect(musicGain!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  musicTimeout = setTimeout(playMusicLoop, 7000 + Math.random() * 2000);
}

let currentZoneForMusic = "city";

export function startMusic(zone: string) {
  ctxRef();
  if (ctx && ctx.state === "suspended") ctx.resume();
  currentZoneForMusic = zone;
  if (!musicPlaying) {
    musicPlaying = true;
    playMusicLoop();
  }
}

export function stopMusic() {
  musicPlaying = false;
  if (musicTimeout) { clearTimeout(musicTimeout); musicTimeout = null; }
}

export function resumeAudio() {
  if (ctx && ctx.state === "suspended") ctx.resume();
}

export function setMasterVolume(v: number) {
  ctxRef();
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}
