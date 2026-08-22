const MUTE_KEY = 'iti-games-mute';
const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let muted = localStorage.getItem(MUTE_KEY) === '1';
let ctx = null;
let htmlUnlock = null;
let unlocking = null;

function preferPlaybackSession() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    // older WebKit
  }
}

function unlockHtmlElement() {
  if (!htmlUnlock) {
    htmlUnlock = new Audio(SILENCE_WAV);
    htmlUnlock.preload = 'auto';
    htmlUnlock.playsInline = true;
    htmlUnlock.setAttribute('playsinline', '');
    htmlUnlock.volume = 0.01;
  }
  const play = htmlUnlock.play();
  if (play && typeof play.catch === 'function') play.catch(() => {});
}

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    preferPlaybackSession();
    ctx = new AC();
  }
  return ctx;
}

function primeSilentBuffer(audio) {
  const buffer = audio.createBuffer(1, 1, audio.sampleRate);
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audio.destination);
  source.start(0);
}

export function unlockAudio() {
  preferPlaybackSession();
  unlockHtmlElement();
  const audio = getCtx();
  if (!audio) return Promise.resolve();
  if (audio.state === 'running') return Promise.resolve(audio);

  unlocking = audio
    .resume()
    .then(() => {
      if (audio.state === 'running') primeSilentBuffer(audio);
      return audio;
    })
    .catch(() => audio);
  return unlocking;
}

function armUnlockListeners() {
  const onGesture = () => {
    unlockAudio();
  };
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
  window.addEventListener('click', onGesture, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockAudio();
  });
}

armUnlockListeners();

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (!muted) unlockAudio();
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

function withAudio(fn) {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;

  const run = (ready) => {
    if (muted || !ready || ready.state !== 'running') return;
    try {
      fn(ready);
    } catch {
      // WebKit can throw if the context dropped mid-schedule
    }
  };

  if (audio.state === 'running') {
    run(audio);
    return;
  }

  unlockAudio().then(run);
}

function tone(freq, duration = 0.12, type = 'sine', gain = 0.08) {
  withAudio((audio) => {
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(Math.max(gain, 0.0001), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(duration, 0.02));
    osc.connect(g);
    g.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  });
}

function noiseBurst(duration = 0.06, gain = 0.045, filterFreq = 900) {
  withAudio((audio) => {
    const now = audio.currentTime;
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
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(0.9, now);

    const g = audio.createGain();
    g.gain.setValueAtTime(Math.max(gain, 0.0001), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(duration, 0.02));

    source.connect(filter);
    filter.connect(g);
    g.connect(audio.destination);
    source.start(now);
    source.stop(now + duration + 0.03);
  });
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

export function playChomp() {
  noiseBurst(0.08, 0.05, 420);
  tone(240, 0.07, 'square', 0.05);
  setTimeout(() => {
    noiseBurst(0.09, 0.055, 280);
    tone(160, 0.1, 'square', 0.055);
  }, 90);
  setTimeout(() => tone(90, 0.14, 'triangle', 0.05), 180);
}

export function playDiceLand(value = 6) {
  noiseBurst(0.14, 0.044, 460);
  tone(190 + value * 14, 0.16, 'triangle', 0.048);
  setTimeout(() => tone(280 + value * 10, 0.14, 'sine', 0.036), 80);
}
