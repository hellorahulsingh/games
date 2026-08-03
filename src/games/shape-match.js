import { addPoints } from '../shell/score.js';
import { playSuccess, playWrong } from '../shell/audio.js';
import { spawnStarFloat, shake, pulseWin, pointerClient } from '../shared/feedback.js';

const SHAPES = [
  { id: 'circle', label: 'Circle', svg: '<svg viewBox="0 0 64 64" width="56" height="56"><circle cx="32" cy="32" r="22" fill="#7a9e8a"/></svg>' },
  { id: 'square', label: 'Square', svg: '<svg viewBox="0 0 64 64" width="56" height="56"><rect x="12" y="12" width="40" height="40" rx="6" fill="#d4896a"/></svg>' },
  { id: 'triangle', label: 'Triangle', svg: '<svg viewBox="0 0 64 64" width="56" height="56"><polygon points="32,10 54,52 10,52" fill="#8a9eb0"/></svg>' },
  { id: 'star', label: 'Star', svg: '<svg viewBox="0 0 64 64" width="56" height="56"><polygon points="32,8 38,24 56,24 42,36 47,52 32,42 17,52 22,36 8,24 26,24" fill="#c4a35a"/></svg>' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const shapeMatch = {
  id: 'shape-match',
  title: 'Shape Match',
  icon: '🔷',

  start(container) {
    let locked = false;
    const root = document.createElement('div');
    root.className = 'playfield';
    container.appendChild(root);

    const nextRound = () => {
      locked = false;
      const target = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const distractors = shuffle(SHAPES.filter((s) => s.id !== target.id)).slice(0, 2);
      const options = shuffle([target, ...distractors]);

      root.innerHTML = `
        <p class="prompt">Find this shape</p>
        <div class="prompt-visual" data-target>${target.svg}</div>
        <div class="options-row" data-options></div>
      `;

      const row = root.querySelector('[data-options]');
      options.forEach((shape) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'big-tap';
        btn.innerHTML = shape.svg;
        btn.setAttribute('aria-label', shape.label);
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (locked) return;
          const { x, y } = pointerClient(e);
          if (shape.id === target.id) {
            locked = true;
            btn.classList.add('correct');
            playSuccess();
            addPoints(1);
            spawnStarFloat(x, y);
            pulseWin(root.querySelector('[data-target]'));
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

    this._stop = () => {
      root.remove();
    };
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};
