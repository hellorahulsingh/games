import { addPoints } from '../shell/score.js';
import { playSuccess, playWrong, playSoft } from '../shell/audio.js';
import { spawnStarFloat, shake, pointerClient } from '../shared/feedback.js';

const ANIMALS = ['🐰', '🐻', '🦊', '🐸', '🐥', '🐱'];

export const findAnimal = {
  id: 'find-animal',
  title: 'Find Animal',
  icon: '🐰',

  start(container) {
    let locked = false;
    const root = document.createElement('div');
    root.className = 'playfield';
    container.appendChild(root);

    const nextRound = () => {
      locked = false;
      const doorCount = Math.random() < 0.5 ? 2 : 3;
      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      const hideIndex = Math.floor(Math.random() * doorCount);

      root.innerHTML = `
        <p class="prompt">Where is the friend?</p>
        <div class="prompt-visual" style="font-size:2.5rem">${animal}</div>
        <div class="doors-row" data-doors></div>
      `;

      const row = root.querySelector('[data-doors]');
      for (let i = 0; i < doorCount; i++) {
        const door = document.createElement('button');
        door.type = 'button';
        door.className = 'door';
        door.setAttribute('aria-label', `Door ${i + 1}`);
        door.innerHTML = `
          <span class="door-animal">${i === hideIndex ? animal : ''}</span>
          <span class="door-face">?</span>
        `;
        door.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (locked) return;
          locked = true;
          const { x, y } = pointerClient(e);
          door.classList.add('open');
          playSoft();

          if (i === hideIndex) {
            playSuccess();
            addPoints(1);
            spawnStarFloat(x, y);
            setTimeout(nextRound, 900);
          } else {
            playWrong();
            shake(door);
            // reveal briefly then peek correct and reset
            setTimeout(() => {
              const doors = row.querySelectorAll('.door');
              doors[hideIndex].classList.add('open');
              setTimeout(nextRound, 900);
            }, 500);
          }
        });
        row.appendChild(door);
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
