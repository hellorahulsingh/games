import { addPoints } from '../shell/score.js';
import { playSuccess, playWrong } from '../shell/audio.js';
import { spawnStarFloat, shake, pulseWin, pointerClient } from '../shared/feedback.js';

const COLORS = [
  { id: 'sage', label: 'Green', hex: '#7a9e8a' },
  { id: 'coral', label: 'Coral', hex: '#d4896a' },
  { id: 'blue', label: 'Blue', hex: '#8a9eb0' },
  { id: 'gold', label: 'Gold', hex: '#c4a35a' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const colorMatch = {
  id: 'color-match',
  title: 'Color Match',
  icon: '🎨',

  start(container) {
    let locked = false;
    const root = document.createElement('div');
    root.className = 'playfield';
    container.appendChild(root);

    const nextRound = () => {
      locked = false;
      const target = COLORS[Math.floor(Math.random() * COLORS.length)];
      const options = shuffle([
        target,
        ...shuffle(COLORS.filter((c) => c.id !== target.id)).slice(0, 2),
      ]);

      root.innerHTML = `
        <p class="prompt">Find this color</p>
        <div class="prompt-visual">
          <div class="color-swatch" style="background:${target.hex}" aria-hidden="true"></div>
        </div>
        <div class="options-row" data-options></div>
      `;

      const row = root.querySelector('[data-options]');
      options.forEach((color) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'big-tap color-option';
        btn.style.background = color.hex;
        btn.setAttribute('aria-label', color.label);
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (locked) return;
          const { x, y } = pointerClient(e);
          if (color.id === target.id) {
            locked = true;
            btn.classList.add('correct');
            playSuccess();
            addPoints(1);
            spawnStarFloat(x, y);
            pulseWin(root.querySelector('.color-swatch'));
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
