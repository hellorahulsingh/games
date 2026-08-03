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

export function playPop() {
  tone(520, 0.1, 'triangle', 0.07);
  setTimeout(() => tone(780, 0.08, 'sine', 0.05), 40);
}

export function playSuccess() {
  tone(440, 0.1, 'sine', 0.07);
  setTimeout(() => tone(554, 0.1, 'sine', 0.07), 80);
  setTimeout(() => tone(659, 0.14, 'sine', 0.08), 160);
}

export function playSoft() {
  tone(360, 0.09, 'sine', 0.05);
}

export function playWrong() {
  tone(220, 0.12, 'triangle', 0.05);
}
