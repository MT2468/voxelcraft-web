let context = null;
let master = null;

function ensureAudio() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return context;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  context = new AudioCtx();
  master = context.createGain();
  master.gain.value = 0.22;
  master.connect(context.destination);
  return context;
}

function tone(frequency, duration, type = 'square', volume = 0.08, slide = 0) {
  const ctx = ensureAudio();
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseBurst(duration = 0.06, volume = 0.08, cutoff = 1200) {
  const ctx = ensureAudio();
  if (!ctx || !master) return;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(master);
  source.start();
}

export function unlockAudio() {
  ensureAudio();
}

export function setMasterVolume(value) {
  ensureAudio();
  if (master) master.gain.value = Math.max(0, Math.min(0.6, value));
}

export function playBreak(material = 'stone') {
  if (material === 'wood') {
    noiseBurst(0.07, 0.08, 700);
    tone(125, 0.06, 'triangle', 0.05, -30);
    return;
  }
  if (material === 'sand') {
    noiseBurst(0.09, 0.07, 420);
    return;
  }
  if (material === 'leaves') {
    noiseBurst(0.05, 0.045, 2200);
    tone(600, 0.035, 'sine', 0.025, 80);
    return;
  }
  noiseBurst(0.065, 0.09, 1050);
  tone(82, 0.055, 'square', 0.035, -22);
}

export function playPlace(material = 'stone') {
  const table = { wood: 155, sand: 210, leaves: 420, stone: 110, snow: 300 };
  tone(table[material] || 145, 0.045, 'square', 0.045, -18);
}

export function playStep(material = 'stone') {
  const table = { wood: 175, sand: 250, leaves: 360, stone: 120, snow: 310 };
  noiseBurst(0.028, 0.025, table[material] * 4);
  tone(table[material] || 130, 0.025, 'triangle', 0.018, -12);
}

export function playJump() {
  tone(180, 0.09, 'triangle', 0.04, 70);
}

export function playLand() {
  noiseBurst(0.05, 0.055, 550);
  tone(75, 0.05, 'triangle', 0.035, -20);
}

export function playToggleFly(enabled) {
  tone(enabled ? 330 : 260, 0.08, 'sine', 0.04, enabled ? 180 : -80);
}
