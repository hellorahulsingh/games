import { addPoints } from '../shell/score.js';
import { playSoft, playSuccess, playWrong } from '../shell/audio.js';
import { spawnStarFloat, pulseWin, pointerClient } from '../shared/feedback.js';

const FACES = ['⭐', '🌙', '☀️', '🍀', '🎈', '🧸'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const memoryPairs = {
  id: 'memory-pairs',
  title: 'Memory Pairs',
  icon: '🃏',

  start(container) {
    let first = null;
    let busy = false;
    let matched = 0;
    let pairCount = 3;
    const root = document.createElement('div');
    root.className = 'playfield';
    container.appendChild(root);

    const deal = () => {
      first = null;
      busy = false;
      matched = 0;
      pairCount = Math.random() < 0.4 ? 2 : 3;
      const faces = shuffle(FACES).slice(0, pairCount);
      const deck = shuffle([...faces, ...faces]);

      root.innerHTML = `
        <p class="prompt">Find the pairs</p>
        <div class="memory-grid" data-grid></div>
      `;

      const grid = root.querySelector('[data-grid]');
      if (pairCount === 2) {
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.maxWidth = '280px';
      }

      deck.forEach((face, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'memory-card';
        card.dataset.face = face;
        card.dataset.index = String(index);
        card.setAttribute('aria-label', 'Card');
        card.innerHTML = `
          <div class="memory-card-inner">
            <div class="memory-face memory-back">?</div>
            <div class="memory-face memory-front">${face}</div>
          </div>
        `;

        card.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (busy || card.classList.contains('flipped') || card.classList.contains('matched')) {
            return;
          }

          card.classList.add('flipped');
          playSoft();

          if (!first) {
            first = card;
            return;
          }

          busy = true;
          const a = first;
          const b = card;
          first = null;

          if (a.dataset.face === b.dataset.face) {
            a.classList.add('matched');
            b.classList.add('matched');
            matched += 1;
            const { x, y } = pointerClient(e);
            playSuccess();
            addPoints(1);
            spawnStarFloat(x, y);
            busy = false;
            if (matched >= pairCount) {
              pulseWin(grid);
              setTimeout(deal, 900);
            }
          } else {
            playWrong();
            setTimeout(() => {
              a.classList.remove('flipped');
              b.classList.remove('flipped');
              busy = false;
            }, 700);
          }
        });

        grid.appendChild(card);
      });
    };

    deal();

    this._stop = () => {
      root.remove();
    };
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};
