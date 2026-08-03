import { addPoints } from '../shell/score.js';
import { playSuccess, playWrong } from '../shell/audio.js';
import { spawnStarFloat, shake, pulseWin, pointerClient } from '../shared/feedback.js';

const ITEMS = ['⭐', '🌙', '☀️', '🍀', '🎈', '🧸', '🍎', '🦋'];

export const bigOrSmall = {
  id: 'big-or-small',
  title: 'Big or Small',
  icon: '🔍',

  start(container) {
    let locked = false;
    const root = document.createElement('div');
    root.className = 'playfield';
    container.appendChild(root);

    const nextRound = () => {
      locked = false;
      const wantBig = Math.random() < 0.5;
      const face = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      const leftIsBig = Math.random() < 0.5;

      root.innerHTML = `
        <p class="prompt">${wantBig ? 'Tap the big one' : 'Tap the small one'}</p>
        <div class="options-row size-row" data-options></div>
      `;

      const row = root.querySelector('[data-options]');
      [
        { big: leftIsBig },
        { big: !leftIsBig },
      ].forEach(({ big }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `size-tap ${big ? 'is-big' : 'is-small'}`;
        btn.textContent = face;
        btn.setAttribute('aria-label', big ? 'Big' : 'Small');
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (locked) return;
          const { x, y } = pointerClient(e);
          const correct = wantBig ? big : !big;
          if (correct) {
            locked = true;
            btn.classList.add('correct');
            playSuccess();
            addPoints(1);
            spawnStarFloat(x, y);
            pulseWin(root.querySelector('.prompt'));
            setTimeout(nextRound, 650);
          } else {
            btn.classList.add('wrong');
            playWrong();
            shake(btn);
            setTimeout(() => btn.classList.remove('wrong'), 400);
          }
        });
        row.appendChild(btn);
      });
    };

    nextRound();
    this._stop = () => root.remove();
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};
