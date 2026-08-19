import '../styles/ludo.css';
import { addPoints } from '../shell/score.js';
import { playPop, playSuccess, playSoft, playWrong } from '../shell/audio.js';
import { spawnStarFloat, pulseWin, pointerClient } from '../shared/feedback.js';

const SIZE = 15;
const FINISH = 56;
const HOME_START = 51;
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const PATH = [
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
];

const PLAYERS = [
  {
    id: 0,
    name: 'Coral',
    start: 0,
    color: '#d4896a',
    yard: [[10, 1], [10, 4], [13, 1], [13, 4]],
    home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    done: [[8, 6], [8, 7], [7, 6], [6, 6]],
  },
  {
    id: 1,
    name: 'Sage',
    start: 26,
    color: '#7a9e8a',
    yard: [[1, 10], [1, 13], [4, 10], [4, 13]],
    home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    done: [[6, 8], [7, 8], [8, 8], [6, 7]],
  },
];

const SAFE = new Set(['13,6', '6,1', '1,8', '8,13']);

function key(r, c) {
  return `${r},${c}`;
}

function pathSet() {
  const s = new Set();
  for (const [r, c] of PATH) s.add(key(r, c));
  return s;
}

const ON_PATH = pathSet();

function cellFor(player, tokenIndex, pos) {
  const p = PLAYERS[player];
  if (pos < 0) return p.yard[tokenIndex];
  if (pos >= FINISH) return p.done[tokenIndex];
  if (pos >= HOME_START) return p.home[pos - HOME_START];
  return PATH[(p.start + pos) % 52];
}

function isSafeCell(r, c) {
  return SAFE.has(key(r, c));
}

function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export const ludo = {
  id: 'ludo',
  title: 'Ludo',
  icon: '🎲',

  start(container) {
    const root = document.createElement('div');
    root.className = 'ludo-root';
    container.appendChild(root);

    const timers = [];
    let alive = true;
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        if (!alive) return;
        fn();
      }, ms);
      timers.push(id);
      return id;
    };

    let vsComputer = false;
    let turn = 0;
    let dice = 0;
    let phase = 'mode';
    let sixStreak = 0;
    let movable = [];
    let tokens = [];
    let rolling = false;

    function resetTokens() {
      tokens = [0, 1].flatMap((p) =>
        [0, 1, 2, 3].map((i) => ({ player: p, index: i, pos: -1 })),
      );
    }

    function tokenAtCell(r, c) {
      return tokens.filter((t) => {
        const [tr, tc] = cellFor(t.player, t.index, t.pos);
        return tr === r && tc === c;
      });
    }

    function destCell(player, dest) {
      return cellFor(player, 0, dest < 0 ? -1 : dest);
    }

    function captureTarget(player, dest) {
      if (dest < 0 || dest >= HOME_START) return null;
      const [r, c] = destCell(player, dest);
      if (isSafeCell(r, c)) return null;
      const others = tokenAtCell(r, c).filter((t) => t.player !== player);
      if (others.length === 1) return others[0];
      return null;
    }

    function blocked(player, dest) {
      if (dest < 0 || dest >= HOME_START) return false;
      const [r, c] = destCell(player, dest);
      if (isSafeCell(r, c)) return false;
      const others = tokenAtCell(r, c).filter((t) => t.player !== player);
      return others.length >= 2;
    }

    function legalMoves(player, value) {
      const moves = [];
      for (const t of tokens.filter((x) => x.player === player)) {
        if (t.pos >= FINISH) continue;
        let dest;
        if (t.pos < 0) {
          if (value !== 6) continue;
          dest = 0;
        } else {
          dest = t.pos + value;
          if (dest > FINISH) continue;
        }
        if (blocked(player, dest)) continue;
        moves.push({
          token: t,
          dest,
          capture: captureTarget(player, dest),
        });
      }
      return moves;
    }

    function isComputerTurn() {
      return vsComputer && turn === 1;
    }

    function statusText() {
      if (phase === 'won') {
        const winner = PLAYERS[turn];
        if (vsComputer) return turn === 0 ? 'You win!' : 'Computer wins!';
        return `${winner.name} wins!`;
      }
      const who = vsComputer
        ? turn === 0
          ? 'Your turn'
          : 'Computer'
        : `${PLAYERS[turn].name}'s turn`;
      if (phase === 'roll') return `${who} — tap the dice`;
      if (phase === 'move') return `${who} — tap a glowing piece`;
      if (phase === 'wait') return `${who}…`;
      return who;
    }

    function playerLabel(p) {
      if (!vsComputer) return PLAYERS[p].name;
      return p === 0 ? 'You' : 'Computer';
    }

    function homeCount(p) {
      return tokens.filter((t) => t.player === p && t.pos >= FINISH).length;
    }

    function render() {
      if (phase === 'mode') {
        root.innerHTML = `
          <div class="ludo-mode">
            <p class="prompt">Play Ludo</p>
            <p class="ludo-sub">2 players · Coral vs Sage</p>
            <button type="button" class="ludo-mode-btn" data-mode="pvp">2 Players</button>
            <button type="button" class="ludo-mode-btn" data-mode="cpu">Vs Computer</button>
          </div>
        `;
        root.querySelector('[data-mode="pvp"]').addEventListener('click', () => begin(false));
        root.querySelector('[data-mode="cpu"]').addEventListener('click', () => begin(true));
        return;
      }

      root.innerHTML = `
        <div class="ludo-bar">
          <span class="ludo-who" data-turn="${turn}">${statusText()}</span>
          <span class="ludo-homes">
            <span class="ludo-home-pip coral">${homeCount(0)}/4</span>
            <span class="ludo-home-pip sage">${homeCount(1)}/4</span>
          </span>
        </div>
        <div class="ludo-board" data-board></div>
        <div class="ludo-panel">
          <button type="button" class="ludo-dice" data-dice ${phase !== 'roll' || rolling || isComputerTurn() ? 'disabled' : ''}>
            ${dice ? DICE_FACES[dice - 1] : '🎲'}
          </button>
          ${phase === 'won' ? '<button type="button" class="ludo-again" data-again>Play again</button>' : ''}
        </div>
      `;

      paintBoard(root.querySelector('[data-board]'));

      const diceBtn = root.querySelector('[data-dice]');
      if (diceBtn && phase === 'roll' && !isComputerTurn()) {
        diceBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          startRoll();
        });
      }
      root.querySelector('[data-again]')?.addEventListener('click', () => {
        phase = 'mode';
        render();
      });
    }

    function paintBoard(board) {
      board.innerHTML = '';
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const cell = document.createElement('div');
          cell.className = `ludo-cell ${cellClass(r, c)}`;
          cell.dataset.r = String(r);
          cell.dataset.c = String(c);
          if (SAFE.has(key(r, c))) {
            const star = document.createElement('span');
            star.className = 'ludo-safe';
            star.textContent = '★';
            cell.appendChild(star);
          }
          board.appendChild(cell);
        }
      }

      const groups = new Map();
      for (const t of tokens) {
        const [r, c] = cellFor(t.player, t.index, t.pos);
        const k = key(r, c);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
      }

      for (const [, group] of groups) {
        group.forEach((t, i) => {
          const [r, c] = cellFor(t.player, t.index, t.pos);
          const cell = board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
          if (!cell) return;
          const piece = document.createElement('button');
          piece.type = 'button';
          piece.className = `ludo-piece p${t.player}`;
          piece.style.setProperty('--dx', `${(i % 2) * 22 - (group.length > 1 ? 11 : 0)}%`);
          piece.style.setProperty('--dy', `${Math.floor(i / 2) * 22 - (group.length > 2 ? 11 : 0)}%`);
          const canMove = movable.some((m) => m.token === t);
          if (canMove) piece.classList.add('can-move');
          piece.setAttribute('aria-label', `${PLAYERS[t.player].name} piece`);
          if (canMove && phase === 'move' && !isComputerTurn()) {
            piece.addEventListener('pointerdown', (e) => {
              e.preventDefault();
              const { x, y } = pointerClient(e);
              applyMove(movable.find((m) => m.token === t), x, y);
            });
          }
          cell.appendChild(piece);
        });
      }
    }

    function cellClass(r, c) {
      if (r >= 9 && r <= 14 && c <= 5) return 'yard coral';
      if (r <= 5 && c >= 9) return 'yard sage';
      if (r <= 5 && c <= 5) return 'yard muted';
      if (r >= 9 && c >= 9) return 'yard muted';
      if (c === 7 && r >= 9 && r <= 13) return 'home coral';
      if (c === 7 && r >= 1 && r <= 5) return 'home sage';
      if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return 'center';
      if (ON_PATH.has(key(r, c))) return 'path';
      if (c === 7 && (r === 0 || r === 14)) return 'path';
      if (r === 7 && (c === 0 || c === 14)) return 'path';
      return 'empty';
    }

    function begin(cpu) {
      vsComputer = cpu;
      turn = 0;
      dice = 0;
      sixStreak = 0;
      movable = [];
      rolling = false;
      resetTokens();
      phase = 'roll';
      playSoft();
      render();
    }

    function startRoll() {
      if (phase !== 'roll' || rolling) return;
      rolling = true;
      playPop();
      let n = 0;
      const tick = () => {
        dice = rollDie();
        const btn = root.querySelector('[data-dice]');
        if (btn) btn.textContent = DICE_FACES[dice - 1];
        n += 1;
        if (n < 8) later(tick, 70);
        else later(() => finishRoll(dice), 80);
      };
      tick();
    }

    function finishRoll(value) {
      rolling = false;
      dice = value;
      if (value === 6) {
        sixStreak += 1;
        if (sixStreak >= 3) {
          sixStreak = 0;
          movable = [];
          phase = 'wait';
          render();
          playWrong();
          later(() => nextTurn(), 700);
          return;
        }
      } else {
        sixStreak = 0;
      }

      movable = legalMoves(turn, value);
      if (!movable.length) {
        phase = 'wait';
        render();
        later(() => nextTurn(), 750);
        return;
      }

      phase = 'move';
      render();

      if (movable.length === 1 && (!isComputerTurn() || vsComputer)) {
        later(() => {
          if (phase !== 'move' || movable.length !== 1) return;
          applyMove(movable[0]);
        }, isComputerTurn() ? 500 : 350);
        return;
      }

      if (isComputerTurn()) {
        later(() => {
          const move = pickComputerMove(movable);
          applyMove(move);
        }, 550);
      }
    }

    function pickComputerMove(moves) {
      let best = moves[0];
      let bestScore = -Infinity;
      for (const m of moves) {
        let s = m.dest;
        if (m.capture) s += 80;
        if (m.dest >= FINISH) s += 70;
        if (m.token.pos < 0) s += 40;
        if (m.dest >= HOME_START) s += 25;
        if (s > bestScore) {
          bestScore = s;
          best = m;
        }
      }
      return best;
    }

    function applyMove(move, x, y) {
      if (phase !== 'move' || !move) return;
      phase = 'wait';
      const { token, dest, capture } = move;
      token.pos = dest;
      movable = [];

      if (capture) {
        capture.pos = -1;
        addPoints(1);
        playWrong();
      }

      if (dest >= FINISH) {
        addPoints(2);
        playSuccess();
        if (typeof x === 'number') spawnStarFloat(x, y);
      } else {
        playSoft();
      }

      const won = tokens.filter((t) => t.player === turn && t.pos >= FINISH).length === 4;
      if (won) {
        phase = 'won';
        addPoints(5);
        playSuccess();
        render();
        pulseWin(root.querySelector('.ludo-board'));
        return;
      }

      render();
      later(() => {
        if (dice === 6) {
          phase = 'roll';
          render();
          if (isComputerTurn()) later(startRoll, 500);
        } else {
          nextTurn();
        }
      }, 400);
    }

    function nextTurn() {
      turn = turn === 0 ? 1 : 0;
      dice = 0;
      sixStreak = 0;
      movable = [];
      phase = 'roll';
      render();
      if (isComputerTurn()) later(startRoll, 650);
    }

    render();

    this._stop = () => {
      alive = false;
      timers.forEach((id) => clearTimeout(id));
      timers.length = 0;
      root.remove();
    };
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};
