import { addPoints } from '../shell/score.js';
import { playPop, playSuccess, playWrong } from '../shell/audio.js';
import { spawnStarFloat, shake, pulseWin, pointerClient } from '../shared/feedback.js';

export const countTap = {
  id: 'count-tap',
  title: 'Count Tap',
  icon: '🔢',

  start(container) {
    let locked = false;
    let tapped = 0;
    let target = 1;
    const root = document.createElement('div');
    root.className = 'playfield';
    container.appendChild(root);

    const nextRound = () => {
      locked = false;
      tapped = 0;
      target = 1 + Math.floor(Math.random() * 3); // 1–3
      const orbCount = target + (Math.random() < 0.4 ? 1 : 0);
      const orbs = Math.max(orbCount, target);

      root.innerHTML = `
        <p class="prompt">Tap this many</p>
        <div class="prompt-visual">
          <div class="dots-row" data-dots>
            ${Array.from({ length: target }, () => '<span class="dot"></span>').join('')}
          </div>
        </div>
        <div class="count-orbs" data-orbs></div>
      `;

      const orbsEl = root.querySelector('[data-orbs]');
      for (let i = 0; i < orbs; i++) {
        const orb = document.createElement('button');
        orb.type = 'button';
        orb.className = 'count-orb';
        orb.setAttribute('aria-label', 'Orb');
        orb.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (locked || orb.classList.contains('tapped')) return;
          const { x, y } = pointerClient(e);
          orb.classList.add('tapped');
          tapped += 1;
          playPop();
          spawnStarFloat(x, y);

          if (tapped === target) {
            locked = true;
            // disable remaining
            orbsEl.querySelectorAll('.count-orb:not(.tapped)').forEach((o) => {
              o.style.pointerEvents = 'none';
              o.style.opacity = '0.25';
            });
            playSuccess();
            addPoints(1);
            pulseWin(root.querySelector('[data-dots]'));
            setTimeout(nextRound, 750);
          } else if (tapped > target) {
            locked = true;
            playWrong();
            shake(root);
            setTimeout(nextRound, 600);
          }
        });
        orbsEl.appendChild(orb);
      }
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
