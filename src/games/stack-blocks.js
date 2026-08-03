import { addPoints } from '../shell/score.js';
import { playPop, playSuccess } from '../shell/audio.js';
import { spawnStarFloat, pulseWin, pointerClient } from '../shared/feedback.js';

const BLOCK_COLORS = ['#7a9e8a', '#d4896a', '#8a9eb0', '#c4a35a'];

export const stackBlocks = {
  id: 'stack-blocks',
  title: 'Stack Blocks',
  icon: '🧱',

  start(container) {
    const root = document.createElement('div');
    root.className = 'playfield stack-playfield';
    container.appendChild(root);

    let height = 0;
    const max = 5;

    const render = () => {
      root.innerHTML = `
        <p class="prompt">${height >= max ? 'Yay! Tall tower!' : 'Tap to stack'}</p>
        <div class="stack-area" data-stack></div>
        <button type="button" class="stack-btn" data-add aria-label="Add block">＋</button>
      `;

      const stack = root.querySelector('[data-stack]');
      for (let i = 0; i < height; i++) {
        const block = document.createElement('div');
        block.className = 'stack-block';
        block.style.background = BLOCK_COLORS[i % BLOCK_COLORS.length];
        block.style.animationDelay = `${i * 0.04}s`;
        stack.appendChild(block);
      }

      const btn = root.querySelector('[data-add]');
      if (height >= max) {
        btn.textContent = 'Again';
        pulseWin(stack);
      }

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const { x, y } = pointerClient(e);
        if (height >= max) {
          height = 0;
          playPop();
          render();
          return;
        }
        height += 1;
        playPop();
        addPoints(1);
        spawnStarFloat(x, y);
        if (height >= max) playSuccess();
        render();
      });
    };

    render();
    this._stop = () => root.remove();
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};
