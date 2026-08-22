const MUTE_KEY = 'iti-games-mute';

let muted = localStorage.getItem(MUTE_KEY) === '1';
let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

function tone(freq, duration = 0.12, type = 'sine', gain = 0.08) {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();

  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

function noiseBurst(duration = 0.06, gain = 0.045, filterFreq = 900) {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();

  const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    const fade = 1 - i / sampleCount;
    data[i] = (Math.random() * 2 - 1) * fade;
  }

  const source = audio.createBufferSource();
  source.buffer = buffer;

  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.9;

  const g = audio.createGain();
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);

  source.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);
  source.start();
  source.stop(audio.currentTime + duration);
}

export function playPop() {
  tone(520, 0.1, 'triangle', 0.07);
  setTimeout(() => tone(780, 0.08, 'sine', 0.05), 40);
}

export function playSuccess() {
  tone(440, 0.1, 'sine', 0.07);
  setTimeout(() => tone(554, 0.1, 'sine', 0.07), 80);
  setTimeout(() => tone(659, 0.14, 'sine', 0.08), 160);
}

export function playVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.18, 'sine', 0.09), i * 120);
  });
  setTimeout(() => tone(1319, 0.28, 'triangle', 0.07), 520);
}

export function playSoft() {
  tone(360, 0.09, 'sine', 0.05);
}

export function playWrong() {
  tone(220, 0.12, 'triangle', 0.05);
}

export function playMoveStep() {
  const pitch = 300 + Math.random() * 80;
  tone(pitch, 0.06, 'triangle', 0.042);
  setTimeout(() => tone(pitch * 1.35, 0.04, 'sine', 0.028), 22);
}

export function playDiceTick() {
  noiseBurst(0.1, 0.034, 620 + Math.random() * 380);
  tone(140 + Math.random() * 60, 0.08, 'square', 0.018);
}

export function playDiceLand(value = 6) {
  noiseBurst(0.14, 0.044, 460);
  tone(190 + value * 14, 0.16, 'triangle', 0.048);
  setTimeout(() => tone(280 + value * 10, 0.14, 'sine', 0.036), 80);
}
