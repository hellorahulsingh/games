import { addPoints } from '../shell/score.js';
import { playPop, playSuccess, playSoft, playVictory } from '../shell/audio.js';
import { spawnStarFloat, pulseWin, pointerClient } from '../shared/feedback.js';

const HOLES = 9;
const CHANCES = 20;
const PEEK_MS = 1500;
const WAIT_MIN = 2000;
const WAIT_MAX = 3000;

function randomWait() {
  return WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
}

export const catchRabbit = {
  id: 'catch-rabbit',
  title: 'Catch Rabbit',
  icon: '🐰',

  start(container) {
    const timers = new Set();
    let running = true;
    let chancesUsed = 0;
    let caught = 0;
    let activeIndex = -1;
    let lastIndex = -1;

    const root = document.createElement('div');
    root.className = 'playfield rabbit-playfield';
    container.appendChild(root);

    function later(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    }

    function clearTimers() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
    }

    function pickHole() {
      let i = Math.floor(Math.random() * HOLES);
      if (HOLES > 1) {
        while (i === lastIndex) i = Math.floor(Math.random() * HOLES);
      }
      return i;
    }

    function updateMeta() {
      const meta = root.querySelector('[data-meta]');
      if (!meta) return;
      const left = Math.max(0, CHANCES - chancesUsed);
      meta.textContent = `${caught} caught · ${left} left`;
    }

    function setHoleState(index, state) {
      root.querySelectorAll('[data-hole]').forEach((hole, i) => {
        hole.classList.toggle('peeking', i === index && state === 'peeking');
        hole.classList.toggle('hiding', i === index && state === 'hiding');
        hole.classList.toggle('caught', i === index && state === 'caught');
      });
    }

    function hideRabbit(reason) {
      if (activeIndex < 0) return;
      const index = activeIndex;
      activeIndex = -1;
      setHoleState(index, reason === 'caught' ? 'caught' : 'hiding');
      later(() => setHoleState(-1, ''), 280);
      chancesUsed += 1;
      updateMeta();
      if (chancesUsed >= CHANCES) {
        later(endRound, 450);
        return;
      }
      later(peek, randomWait());
    }

    function peek() {
      if (!running || chancesUsed >= CHANCES) return;
      const index = pickHole();
      lastIndex = index;
      activeIndex = index;
      setHoleState(index, 'peeking');
      later(() => {
        if (activeIndex !== index) return;
        playSoft();
        hideRabbit('miss');
      }, PEEK_MS);
    }

    function endRound() {
      if (!running) return;
      clearTimers();
      activeIndex = -1;
      setHoleState(-1, '');

      const prompt = root.querySelector('[data-prompt]');
      const meta = root.querySelector('[data-meta]');
      const field = root.querySelector('[data-field]');
      if (prompt) {
        prompt.textContent =
          caught >= 15 ? 'Super catcher!' : caught === 0 ? 'Almost!' : 'Nice catching!';
      }
      if (meta) meta.textContent = `You caught ${caught} of ${CHANCES}`;
      field?.classList.add('done');
      pulseWin(root);
      if (caught >= 10) playVictory();
      else playSuccess();

      if (!root.querySelector('[data-again]')) {
        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'rabbit-again';
        again.dataset.again = '1';
        again.textContent = 'Again';
        again.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          playPop();
          startRound();
        });
        root.appendChild(again);
      }
    }

    function onHole(index, e) {
      e.preventDefault();
      if (!running || index !== activeIndex) return;
      const { x, y } = pointerClient(e);
      playPop();
      addPoints(1);
      caught += 1;
      spawnStarFloat(x, y);
      if (caught % 5 === 0) playSuccess();
      hideRabbit('caught');
    }

    function startRound() {
      clearTimers();
      chancesUsed = 0;
      caught = 0;
      activeIndex = -1;
      lastIndex = -1;

      root.innerHTML = `
        <p class="prompt" data-prompt>Catch the rabbit!</p>
        <p class="rabbit-meta" data-meta>0 caught · ${CHANCES} left</p>
        <div class="rabbit-field" data-field></div>
      `;

      const field = root.querySelector('[data-field]');
      for (let i = 0; i < HOLES; i += 1) {
        const hole = document.createElement('button');
        hole.type = 'button';
        hole.className = 'rabbit-hole';
        hole.dataset.hole = String(i);
        hole.setAttribute('aria-label', `Hole ${i + 1}`);
        hole.innerHTML = `
          <span class="rabbit-well">
            <span class="rabbit-sprite" aria-hidden="true">🐰</span>
          </span>
        `;
        hole.addEventListener('pointerdown', (e) => onHole(i, e));
        field.appendChild(hole);
      }

      later(peek, 800);
    }

    startRound();

    this._stop = () => {
      running = false;
      clearTimers();
      root.remove();
    };
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};
