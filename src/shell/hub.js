import { getScore, subscribe } from './score.js';
import { toggleFullscreen, isFullscreen, onFullscreenChange } from './fullscreen.js';
import { isMuted, toggleMute } from './audio.js';

export function renderHub(root, games, onSelect) {
  const { total } = getScore();

  root.innerHTML = `
    <div class="hub">
      <div class="hub-top">
        <div class="hub-brand">
          <h1>ITI Games</h1>
          <p>Easy play for little minds</p>
        </div>
        <div class="hub-controls">
          <div class="hub-score" data-hub-score>
            <span>★</span> <strong>${total}</strong>
          </div>
          <button class="icon-btn" type="button" data-mute title="Sound">
            ${isMuted() ? '🔇' : '🔊'}
          </button>
          <button class="icon-btn" type="button" data-fs title="Fullscreen">
            ${isFullscreen() ? '⤓' : '⛶'}
          </button>
        </div>
      </div>
      <div class="hub-grid">
        ${games
          .map(
            (g) => `
          <button class="game-card" type="button" data-game="${g.id}">
            <div class="game-card-icon">${g.icon}</div>
            <div class="game-card-title">${g.title}</div>
          </button>
        `,
          )
          .join('')}
      </div>
    </div>
  `;

  const scoreEl = root.querySelector('[data-hub-score] strong');
  const muteBtn = root.querySelector('[data-mute]');
  const fsBtn = root.querySelector('[data-fs]');

  const unsubScore = subscribe(({ total: t }) => {
    if (scoreEl) scoreEl.textContent = String(t);
  });

  const unsubFs = onFullscreenChange((on) => {
    if (fsBtn) fsBtn.textContent = on ? '⤓' : '⛶';
  });

  muteBtn.addEventListener('click', () => {
    muteBtn.textContent = toggleMute() ? '🔇' : '🔊';
  });

  fsBtn.addEventListener('click', () => toggleFullscreen());

  root.querySelectorAll('[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.game));
  });

  return () => {
    unsubScore();
    unsubFs();
  };
}
