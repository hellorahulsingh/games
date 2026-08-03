import { getScore, resetSession, subscribe } from './score.js';
import { toggleFullscreen, isFullscreen, onFullscreenChange } from './fullscreen.js';
import { isMuted, toggleMute } from './audio.js';

export function createHud(root, { title, onBack }) {
  resetSession();
  const { session } = getScore();

  root.innerHTML = `
    <div class="game-view">
      <header class="game-hud">
        <div class="game-hud-left">
          <button class="hud-btn" type="button" data-back>← Back</button>
        </div>
        <div class="hud-session" data-session>
          <span class="star">★</span>
          <strong>${session}</strong>
        </div>
        <div class="game-hud-right">
          <button class="hud-btn icon-only" type="button" data-mute title="Sound">
            ${isMuted() ? '🔇' : '🔊'}
          </button>
          <button class="hud-btn icon-only" type="button" data-fs title="Fullscreen">
            ${isFullscreen() ? '⤓' : '⛶'}
          </button>
        </div>
      </header>
      <div class="game-stage" data-stage aria-label="${title}"></div>
    </div>
  `;

  const sessionEl = root.querySelector('[data-session] strong');
  const stage = root.querySelector('[data-stage]');
  const muteBtn = root.querySelector('[data-mute]');
  const fsBtn = root.querySelector('[data-fs]');

  const unsubScore = subscribe(({ session: s }) => {
    if (sessionEl) sessionEl.textContent = String(s);
  });

  const unsubFs = onFullscreenChange((on) => {
    if (fsBtn) fsBtn.textContent = on ? '⤓' : '⛶';
  });

  root.querySelector('[data-back]').addEventListener('click', onBack);
  muteBtn.addEventListener('click', () => {
    muteBtn.textContent = toggleMute() ? '🔇' : '🔊';
  });
  fsBtn.addEventListener('click', () => toggleFullscreen());

  return {
    stage,
    destroy() {
      unsubScore();
      unsubFs();
      root.innerHTML = '';
    },
  };
}
