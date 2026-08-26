import '../styles/ludo.css';
import { addPoints } from '../shell/score.js';
import { playSuccess, playSoft, playWrong, playVictory, playMoveStep, playDiceTick, playDiceLand, playChomp } from '../shell/audio.js';
import { spawnStarFloat, spawnVictoryBurst, pulseWin, pointerClient } from '../shared/feedback.js';
import {
  SIZE,
  FINISH,
  HOME_START,
  PATH,
  PLAYERS,
  SAFE,
  SAFE_COLOR,
  key,
  cellFor,
  rollDie,
  freshTokens,
  freshState,
  legalMoves,
  applyRoll as resolveRoll,
  applyMove as resolveMove,
} from '../shared/ludo-engine.js';
import { ROOM_CODE_RE, normalizeRoomCode, joinUrl } from '../shared/ludo-room.js';
import { createLudoRoom, connectLudoRoom } from '../shared/ludo-net.js';
import { renderSVG } from 'uqr';

const DICE_PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const ON_PATH = new Set(PATH.map(([r, c]) => key(r, c)));

function diceHtml(value) {
  if (!value) {
    const hints = new Set([0, 2, 4, 6, 8]);
    const cells = Array.from({ length: 9 }, (_, i) =>
      `<span class="ludo-pip hint${hints.has(i) ? ' on' : ''}"></span>`,
    ).join('');
    return `<span class="ludo-dice-face idle"><span class="ludo-dice-grid">${cells}</span></span>`;
  }
  const on = new Set(DICE_PIPS[value] || []);
  const cells = Array.from({ length: 9 }, (_, i) =>
    `<span class="ludo-pip${on.has(i) ? ' on' : ''}"></span>`,
  ).join('');
  return `<span class="ludo-dice-face" data-value="${value}"><span class="ludo-dice-grid">${cells}</span></span>`;
}

function progressDots(player, count) {
  return Array.from({ length: 4 }, (_, i) =>
    `<span class="ludo-dot hue-${PLAYERS[player].hue}${i < count ? ' filled' : ''}"></span>`,
  ).join('');
}

function qrSvg(url) {
  return renderSVG(url, { border: 2, ecc: 'M' });
}

export const ludo = {
  id: 'ludo',
  title: 'Ludo',
  icon: '🎲',

  start(container, opts = {}) {
    const root = document.createElement('div');
    root.className = 'ludo-root';
    container.appendChild(root);

    const timers = [];
    let alive = true;
    let lastTapAt = 0;

    const later = (fn, ms) => {
      const id = setTimeout(() => {
        if (!alive) return;
        fn();
      }, ms);
      timers.push(id);
      return id;
    };

    let vsComputer = false;
    let vsFriend = false;
    let friendReady = false;
    let myPlayer = 0;
    let roomCode = '';
    let modeView = 'pick';
    let net = null;
    let netIgnore = false;
    let joinTries = 0;
    let pendingNet = null;
    let pendingLocal = null;
    let turn = 0;
    let dice = 0;
    let lastDice = [0, 0];
    let phase = 'mode';
    let sixStreak = 0;
    let movable = [];
    let tokens = [];
    let rolling = false;
    let animating = false;
    let hoppingToken = null;
    let hopRaf = 0;

    function resetTokens() {
      tokens = freshTokens();
    }

    function movesFor(player, value) {
      return legalMoves(tokens, player, value)
        .map((m) => ({
          token: tokens.find((t) => t.player === player && t.index === m.tokenIndex),
          dest: m.dest,
          capture: m.capture
            ? tokens.find((t) => t.player === m.capture.player && t.index === m.capture.index)
            : null,
        }))
        .filter((m) => m.token);
    }

    function gameSnapshot() {
      return {
        turn,
        dice,
        lastDice,
        phase,
        sixStreak,
        tokens,
        winner: phase === 'won' ? turn : null,
      };
    }

    function isComputerTurn() {
      return vsComputer && turn === 1;
    }

    function canControlTurn() {
      if (isComputerTurn()) return false;
      if (vsFriend && myPlayer !== turn) return false;
      return true;
    }

    function homeCount(p) {
      return tokens.filter((t) => t.player === p && t.pos >= FINISH).length;
    }

    function canRoll(player) {
      return (
        phase === 'roll' &&
        turn === player &&
        !rolling &&
        !animating &&
        !(isComputerTurn() && player === 1) &&
        !(vsFriend && myPlayer !== player)
      );
    }

    function diceValueFor(player) {
      if (rolling && turn === player) return 1 + Math.floor(Math.random() * 6);
      if (turn === player && dice) return dice;
      return lastDice[player];
    }

    function diceDisplay(player) {
      return diceHtml(diceValueFor(player));
    }

    function playerCorner(player) {
      const hue = PLAYERS[player].hue;
      const active = turn === player && phase !== 'mode' && phase !== 'won';
      const winner = phase === 'won' && turn === player;
      const canTap = canRoll(player);
      const mine = vsFriend && friendReady && myPlayer === player;
      return `
        <div class="ludo-corner hue-${hue}${active ? ' active' : ''}${winner ? ' winner' : ''}${mine ? ' mine' : ''}">
          <div class="ludo-progress">${progressDots(player, homeCount(player))}</div>
          <div class="ludo-dice-wrap">
            <span class="ludo-dice-wave" aria-hidden="true"></span>
            <span class="ludo-dice-wave" aria-hidden="true"></span>
            <span class="ludo-dice-wave" aria-hidden="true"></span>
            <button
              type="button"
              class="ludo-dice hue-${hue}${canTap ? ' can-roll' : ' is-idle'}${rolling && turn === player ? ' rolling' : ''}"
              data-dice="${player}"
              aria-label="Dice"
            >${diceDisplay(player)}</button>
          </div>
        </div>
      `;
    }

    function backToModes() {
      dropNet();
      vsFriend = false;
      friendReady = false;
      roomCode = '';
      modeView = 'pick';
      phase = 'mode';
      render();
    }

    function onTap(e) {
      if (animating) return;
      const now = Date.now();
      if (now - lastTapAt < 280) return;
      lastTapAt = now;

      const onlineBtn = e.target.closest('[data-online]');
      if (onlineBtn) {
        const action = onlineBtn.dataset.online;
        if (action === 'menu') {
          modeView = 'friend';
          playSoft();
          render();
          return;
        }
        if (action === 'host') {
          playSoft();
          hostRoom();
          return;
        }
        if (action === 'join') {
          modeView = 'join';
          playSoft();
          render();
        }
        return;
      }

      if (e.target.closest('[data-modes]')) {
        backToModes();
        playSoft();
        return;
      }

      if (e.target.closest('[data-share-code]') && roomCode) {
        shareRoom();
        return;
      }

      const diceBtn = e.target.closest('[data-dice]');
      if (diceBtn) {
        const player = Number(diceBtn.dataset.dice);
        if (canRoll(player)) startRoll();
        return;
      }

      const pieceBtn = e.target.closest('[data-piece]');
      if (pieceBtn) {
        const pid = Number(pieceBtn.dataset.player);
        const idx = Number(pieceBtn.dataset.index);
        const token = tokens.find((t) => t.player === pid && t.index === idx);
        const move = movable.find((m) => m.token === token);
        if (move && phase === 'move' && canControlTurn()) {
          requestMove(move, e);
        }
        return;
      }

      const cellBtn = e.target.closest('[data-cell-move]');
      if (cellBtn) {
        const pid = Number(cellBtn.dataset.player);
        const idx = Number(cellBtn.dataset.index);
        const token = tokens.find((t) => t.player === pid && t.index === idx);
        const move = movable.find((m) => m.token === token);
        if (move && phase === 'move' && canControlTurn()) {
          requestMove(move, e);
        }
        return;
      }

      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) {
        const mode = modeBtn.dataset.mode;
        if (mode === 'friend') {
          modeView = 'friend';
          playSoft();
          render();
          return;
        }
        begin(mode === 'cpu');
        return;
      }

      if (e.target.closest('[data-again]')) {
        if (vsFriend && friendReady) {
          net?.send({ type: 'again' });
          return;
        }
        phase = 'mode';
        modeView = 'pick';
        render();
      }
    }

    root.addEventListener('click', onTap);
    root.addEventListener('touchend', onTap, { passive: true });

    function requestMove(move, e) {
      if (vsFriend) {
        net?.send({ type: 'move', token: move.token.index });
        return;
      }
      const { x, y } = pointerClient(e);
      startLocalMove(move, x, y);
    }

    function victoryConfetti() {
      const colors = ['#e53935', '#f9a825', '#2e7d32', '#1565c0', '#ffeb3b', '#e91e63'];
      return Array.from({ length: 20 }, (_, i) => {
        const left = 4 + ((i * 37) % 92);
        const delay = (i * 0.09).toFixed(2);
        const color = colors[i % colors.length];
        return `<span class="ludo-confetti" style="--left:${left}%;--delay:${delay}s;--c:${color}"></span>`;
      }).join('');
    }

    function victoryOverlay() {
      const hue = PLAYERS[turn].hue;
      return `
        <div class="ludo-victory-overlay" aria-live="polite">
          <div class="ludo-victory-confetti">${victoryConfetti()}</div>
          <div class="ludo-victory-card hue-${hue}">
            <span class="ludo-victory-icon" aria-hidden="true">🏆</span>
            <span class="ludo-victory-stars" aria-hidden="true">★ ★ ★</span>
          </div>
        </div>
      `;
    }

    function celebrateWin(x, y) {
      phase = 'won';
      addPoints(5);
      playVictory();
      render();

      const board = root.querySelector('.ludo-board');
      const frame = root.querySelector('.ludo-board-frame');
      board?.classList.add('victory');
      frame?.classList.add('victory');

      const rect = board?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : (typeof x === 'number' ? x : window.innerWidth / 2);
      const cy = rect ? rect.top + rect.height / 2 : (typeof y === 'number' ? y : window.innerHeight / 2);

      spawnVictoryBurst(cx, cy);
      later(() => spawnVictoryBurst(cx, cy, 10), 350);
      later(() => spawnVictoryBurst(cx, cy, 8), 700);
      if (typeof x === 'number') spawnStarFloat(x, y);

      pulseWin(board);
    }

    function modeScreen() {
      if (modeView === 'friend') {
        return `
          <div class="ludo-mode ludo-mode-stack">
            <button type="button" class="ludo-mode-text" data-online="host">Generate code</button>
            <button type="button" class="ludo-mode-text" data-online="join">Enter code</button>
          </div>
        `;
      }
      if (modeView === 'host') {
        const url = joinUrl(roomCode);
        const tiles = roomCode.split('').map((ch) => `<span>${ch}</span>`).join('');
        return `
          <div class="ludo-online">
            <button type="button" class="ludo-code" data-share-code aria-label="Share code">${tiles}</button>
            <div class="ludo-qr" aria-hidden="true">${qrSvg(url)}</div>
            <span class="ludo-wait" aria-label="Waiting"></span>
          </div>
        `;
      }
      if (modeView === 'join') {
        return `
          <div class="ludo-online">
            <input
              class="ludo-code-input"
              data-join-code
              maxlength="4"
              autocapitalize="characters"
              autocomplete="off"
              spellcheck="false"
              inputmode="text"
              aria-label="Room code"
            >
          </div>
        `;
      }
      if (modeView === 'connecting') {
        return `
          <div class="ludo-online">
            <span class="ludo-wait" aria-label="Connecting"></span>
          </div>
        `;
      }
      if (modeView === 'error' || modeView === 'taken' || modeView === 'missing' || modeView === 'bye') {
        const icon = modeView === 'bye' ? '👋' : modeView === 'taken' ? '🚫' : '⚠️';
        return `
          <div class="ludo-online">
            <button type="button" class="ludo-mode-btn" data-modes aria-label="Back">${icon}</button>
          </div>
        `;
      }
      return `
        <div class="ludo-mode">
          <button type="button" class="ludo-mode-btn" data-mode="pvp" aria-label="Two players">👥</button>
          <button type="button" class="ludo-mode-btn" data-mode="cpu" aria-label="Vs computer">🖥️</button>
          <button type="button" class="ludo-mode-btn" data-mode="friend" aria-label="Play with a friend">🌐</button>
        </div>
      `;
    }

    function boardFlipped() {
      return vsFriend && myPlayer === 1;
    }

    function render() {
      if (phase === 'mode') {
        root.classList.remove('ludo-flipped');
        root.innerHTML = modeScreen();
        bindJoinInput();
        return;
      }

      const near = boardFlipped() ? 1 : 0;
      const far = boardFlipped() ? 0 : 1;
      root.classList.toggle('ludo-flipped', boardFlipped());
      root.innerHTML = `
        <div class="ludo-layout">
          <div class="ludo-board-frame">
            <div class="ludo-dice-slot tr">${playerCorner(far)}</div>
            <div class="ludo-board-wrap">
              <div class="ludo-board" data-board></div>
            </div>
            <div class="ludo-dice-slot bl">${playerCorner(near)}</div>
            ${phase === 'won' ? victoryOverlay() : ''}
            ${phase === 'won' ? '<button type="button" class="ludo-replay" data-again aria-label="Play again">↻</button>' : ''}
          </div>
        </div>
      `;

      paintBoard(root.querySelector('[data-board]'));
    }

    function bindJoinInput() {
      const input = root.querySelector('[data-join-code]');
      if (!input) return;
      input.value = roomCode;
      input.focus();
      input.addEventListener('input', () => {
        input.value = normalizeRoomCode(input.value);
        if (ROOM_CODE_RE.test(input.value)) {
          playSoft();
          joinRoom(input.value);
        }
      });
    }

    function updateDiceUI() {
      root.querySelectorAll('[data-dice]').forEach((btn) => {
        const player = Number(btn.dataset.dice);
        btn.innerHTML = diceDisplay(player);
        btn.classList.toggle('rolling', rolling && turn === player);
        btn.classList.toggle('can-roll', canRoll(player));
        btn.classList.toggle('is-idle', !canRoll(player));
      });
      root.querySelectorAll('.ludo-corner').forEach((el) => {
        const player = Number(el.querySelector('[data-dice]')?.dataset.dice);
        if (Number.isNaN(player)) return;
        el.classList.toggle('active', turn === player && phase !== 'won');
        el.classList.toggle('winner', phase === 'won' && turn === player);
      });
      PLAYERS.forEach((_, i) => {
        const el = root.querySelector(`[data-dice="${i}"]`)?.closest('.ludo-corner')?.querySelector('.ludo-progress');
        if (el) el.innerHTML = progressDots(i, homeCount(i));
      });
    }

    function paintBoard(board) {
      if (!board) return;
      const picking = phase === 'move' && canControlTurn() && movable.length > 0;
      board.classList.toggle('pick-phase', picking);
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

      for (const [cellKey, group] of groups) {
        const [r, c] = cellKey.split(',').map(Number);
        const cell = board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if (!cell) continue;

        const movableHere = group.filter((t) => movable.some((m) => m.token === t));
        if (picking && movableHere.length > 0) {
          cell.classList.add('has-movable');
        }
        if (
          movableHere.length === 1 &&
          phase === 'move' &&
          canControlTurn()
        ) {
          const t = movableHere[0];
          const hit = document.createElement('button');
          hit.type = 'button';
          hit.className = 'ludo-cell-hit';
          hit.dataset.cellMove = '1';
          hit.dataset.player = String(t.player);
          hit.dataset.index = String(t.index);
          hit.setAttribute('aria-label', 'Move piece');
          cell.appendChild(hit);
        }

        const stacked = group.length > 1;
        if (stacked) {
          cell.classList.add('has-stack');
          const same = group.every((t) => t.player === group[0].player);
          if (same || SAFE.has(cellKey)) cell.classList.add('safe-stack');
          group.sort((a, b) => {
            const aMove = movable.some((m) => m.token === a);
            const bMove = movable.some((m) => m.token === b);
            if (aMove !== bMove) return aMove ? 1 : -1;
            if (a.player === turn && b.player !== turn) return 1;
            if (b.player === turn && a.player !== turn) return -1;
            return a.player - b.player || a.index - b.index;
          });
        }

        group.forEach((t, i) => {
          const piece = document.createElement('button');
          piece.type = 'button';
          piece.className = `ludo-piece hue-${PLAYERS[t.player].hue}`;
          piece.dataset.piece = '1';
          piece.dataset.player = String(t.player);
          piece.dataset.index = String(t.index);
          const canMove = picking && movable.some((m) => m.token === t);
          if (stacked) {
            piece.classList.add('stacked');
            piece.style.setProperty('--dx', `${(i - (group.length - 1) / 2) * 12}%`);
            piece.style.setProperty('--dy', `${-i * 26}%`);
            piece.style.zIndex = String((canMove ? 10 : 4) + i);
          } else {
            piece.style.setProperty('--dx', '0');
            piece.style.setProperty('--dy', '0');
          }
          if (canMove) {
            piece.classList.add('can-move');
            piece.style.animationDelay = `${t.index * 0.14}s`;
          }
          if (phase === 'won' && t.player === turn) {
            piece.classList.add('winner-piece');
            piece.style.animationDelay = `${t.index * 0.18}s`;
          }
          if (hoppingToken === t) return;
          piece.setAttribute('aria-label', 'Piece');
          cell.appendChild(piece);
        });
      }
    }

    function yardPart(r, c, r0, c0) {
      const lr = r - r0;
      const lc = c - c0;
      if ((lr === 1 || lr === 4) && (lc === 1 || lc === 4)) return 'pad';
      if (lr === 0 || lr === 5 || lc === 0 || lc === 5) return 'frame';
      return 'nest';
    }

    function cellClass(r, c) {
      const k = key(r, c);
      const safeHue = SAFE_COLOR[k];
      if (safeHue) return `path safe ${safeHue}`;
      if (r >= 9 && r <= 14 && c <= 5) return `yard red ${yardPart(r, c, 9, 0)}`;
      if (r <= 5 && c >= 9) return `yard yellow ${yardPart(r, c, 0, 9)}`;
      if (r <= 5 && c <= 5) return `yard green ${yardPart(r, c, 0, 0)}`;
      if (r >= 9 && c >= 9) return `yard blue ${yardPart(r, c, 9, 9)}`;
      if (c === 7 && r >= 9 && r <= 13) return 'home red';
      if (c === 7 && r >= 1 && r <= 5) return 'home yellow';
      if (r === 7 && c >= 1 && c <= 5) return 'home green';
      if (r === 7 && c >= 9 && c <= 13) return 'home blue';
      if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return `center c-${r}-${c}`;
      if (ON_PATH.has(key(r, c))) return 'path';
      if (c === 7 && (r === 0 || r === 14)) return 'path';
      if (r === 7 && (c === 0 || c === 14)) return 'path';
      return 'empty';
    }

    function begin(cpu) {
      dropNet();
      vsFriend = false;
      friendReady = false;
      vsComputer = cpu;
      rolling = false;
      animating = false;
      hoppingToken = null;
      pendingNet = null;
      pendingLocal = null;
      resetTokens();
      playSoft();
      assignState(freshState());
    }

    function assignState(s) {
      turn = s.turn;
      dice = s.dice;
      lastDice = [...s.lastDice];
      phase = s.phase;
      sixStreak = s.sixStreak;
      for (const t of tokens) {
        const n = s.tokens.find((x) => x.player === t.player && x.index === t.index);
        if (n) t.pos = n.pos;
      }
      movable = phase === 'move' ? movesFor(turn, dice) : [];
      render();
      queueAutoMove();
      queueCpu();
    }

    function dropNet() {
      if (!net) return;
      netIgnore = true;
      net.close();
      net = null;
    }

    async function shareRoom() {
      const url = joinUrl(roomCode);
      playSoft();
      if (navigator.share) {
        try {
          await navigator.share({ url });
          return;
        } catch {
          // fall through to clipboard
        }
      }
      try {
        await navigator.clipboard.writeText(`${roomCode} ${url}`);
      } catch {
        // ignore
      }
    }

    function attachNet(code, role) {
      dropNet();
      netIgnore = false;
      net = connectLudoRoom({
        code,
        role,
        onMessage: onNetMessage,
        onClose: onNetClose,
      });
    }

    async function hostRoom() {
      vsFriend = true;
      friendReady = false;
      modeView = 'connecting';
      phase = 'mode';
      render();
      try {
        const { code } = await createLudoRoom();
        if (!alive) return;
        roomCode = code;
        attachNet(code, 'host');
      } catch {
        if (!alive) return;
        vsFriend = false;
        modeView = 'error';
        render();
      }
    }

    function joinRoom(code) {
      const normalized = normalizeRoomCode(code);
      if (!ROOM_CODE_RE.test(normalized)) return;
      vsFriend = true;
      friendReady = false;
      roomCode = normalized;
      joinTries = 0;
      modeView = 'connecting';
      phase = 'mode';
      render();
      attachNet(normalized, 'join');
    }

    function onNetClose(event) {
      if (netIgnore || !alive) {
        netIgnore = false;
        return;
      }
      net = null;
      if (event?.code === 4001 && roomCode && joinTries < 6) {
        joinTries += 1;
        later(() => {
          if (!alive || friendReady) return;
          attachNet(roomCode, 'join');
        }, 350);
        return;
      }
      vsFriend = false;
      friendReady = false;
      phase = 'mode';
      if (event?.code === 4000) modeView = 'taken';
      else if (event?.code === 4001) modeView = 'missing';
      else if (modeView === 'host' || modeView === 'connecting') modeView = 'error';
      else modeView = 'bye';
      render();
    }

    function onNetMessage(msg) {
      if (!alive) return;
      if (msg.type === 'waiting') {
        myPlayer = msg.player;
        roomCode = msg.code || roomCode;
        modeView = msg.player === 0 ? 'host' : 'connecting';
        phase = 'mode';
        render();
        return;
      }
      if (msg.type === 'start') {
        myPlayer = msg.player;
        roomCode = msg.code || roomCode;
        vsFriend = true;
        friendReady = true;
        rolling = false;
        animating = false;
        hoppingToken = null;
        pendingNet = null;
        pendingLocal = null;
        resetTokens();
        playSoft();
        assignState(msg.state);
        return;
      }
      if (msg.type === 'rolled') {
        onRolled(msg);
        return;
      }
      if (msg.type === 'moved') {
        onMoved(msg);
        return;
      }
      if (msg.type === 'restart') {
        rolling = false;
        animating = false;
        hoppingToken = null;
        pendingNet = null;
        pendingLocal = null;
        resetTokens();
        playSoft();
        assignState(msg.state);
        return;
      }
      if (msg.type === 'bye') {
        dropNet();
        vsFriend = false;
        friendReady = false;
        phase = 'mode';
        modeView = 'bye';
        render();
      }
    }

    function onRolled(msg) {
      const land = () => {
        rolling = false;
        dice = msg.value;
        lastDice[msg.player] = msg.value;
        playDiceLand(msg.value);
        if (msg.skip) {
          phase = 'wait';
          render();
          if (msg.skip === 'sixes') playWrong();
          later(() => assignState(msg.state), 750);
          return;
        }
        assignState(msg.state);
      };

      if (rolling) {
        later(land, 80);
        return;
      }

      turn = msg.player;
      rolling = true;
      phase = 'roll';
      updateDiceUI();
      let n = 0;
      const tick = () => {
        if (!alive) return;
        updateDiceUI();
        playDiceTick();
        n += 1;
        if (n < 6) later(tick, 70);
        else land();
      };
      tick();
    }

    function onMoved(msg) {
      if (animating) return;
      pendingNet = msg;
      const token = tokens.find((t) => t.player === msg.player && t.index === msg.tokenIndex);
      if (!token) {
        assignState(msg.state);
        return;
      }
      const capture = msg.capture
        ? tokens.find((t) => t.player === msg.capture.player && t.index === msg.capture.index)
        : null;
      applyMove({ token, dest: msg.dest, capture });
    }

    function startRoll() {
      if (phase !== 'roll' || rolling) return;
      rolling = true;
      playDiceTick();
      updateDiceUI();

      if (vsFriend) {
        net?.send({ type: 'roll' });
        const tick = () => {
          if (!alive || !rolling) return;
          updateDiceUI();
          playDiceTick();
          later(tick, 70);
        };
        later(tick, 70);
        return;
      }

      let n = 0;
      const tick = () => {
        dice = rollDie();
        updateDiceUI();
        playDiceTick();
        n += 1;
        if (n < 8) later(tick, 70);
        else later(() => finishRoll(dice), 80);
      };
      tick();
    }

    function startLocalMove(move, x, y) {
      const result = resolveMove(gameSnapshot(), move.token.index);
      if (!result) return;
      pendingLocal = result;
      const capture = result.move.capture
        ? tokens.find((t) => t.player === result.move.capture.player && t.index === result.move.capture.index)
        : null;
      applyMove({ token: move.token, dest: result.move.dest, capture }, x, y);
    }

    function queueCpu() {
      if (!vsComputer || rolling || animating || phase === 'won' || phase === 'mode') return;
      later(() => {
        if (!alive || !vsComputer || rolling || animating || phase === 'won') return;
        if (phase === 'roll' && turn === 1) {
          startRoll();
          return;
        }
        if (phase === 'move' && turn === 1 && movable.length) {
          const move = movable.length === 1 ? movable[0] : pickComputerMove(movable);
          startLocalMove(move);
        }
      }, 480);
    }

    function queueAutoMove() {
      if (phase !== 'move' || movable.length !== 1 || animating) return;
      if (isComputerTurn()) return;
      if (!canControlTurn()) return;
      const move = movable[0];
      later(() => {
        if (!alive || phase !== 'move' || movable.length !== 1 || animating) return;
        if (isComputerTurn() || !canControlTurn()) return;
        if (vsFriend) {
          net?.send({ type: 'move', token: move.token.index });
          return;
        }
        startLocalMove(move);
      }, 360);
    }

    function finishRoll(value) {
      rolling = false;
      playDiceLand(value);
      const result = resolveRoll(gameSnapshot(), value);
      if (result.skip) {
        dice = value;
        lastDice[result.rolledBy] = value;
        phase = 'wait';
        render();
        if (result.skip === 'sixes') playWrong();
        later(() => assignState(result.state), 750);
        return;
      }
      assignState(result.state);
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

    function moveSteps(from, to) {
      const steps = [];
      for (let p = from + 1; p <= to; p++) steps.push(p);
      return steps;
    }

    function getBoard() {
      return root.querySelector('[data-board]');
    }

    function completeMove(move, x, y, capture) {
      animating = false;
      hoppingToken = null;
      const { dest } = move;

      if (capture) {
        capture.pos = -1;
        addPoints(1);
      }

      if (dest >= FINISH) {
        addPoints(2);
        playSuccess();
        if (typeof x === 'number') spawnStarFloat(x, y);
      } else {
        playSoft();
      }

      const pending = pendingNet || pendingLocal;
      const won = pending
        ? Boolean(pending.won || pending.state?.phase === 'won')
        : tokens.filter((t) => t.player === turn && t.pos >= FINISH).length === 4;
      if (won) {
        if (pending?.state) {
          for (const t of tokens) {
            const n = pending.state.tokens.find((x) => x.player === t.player && x.index === t.index);
            if (n) t.pos = n.pos;
          }
          turn = pending.state.turn;
        }
        pendingNet = null;
        pendingLocal = null;
        celebrateWin(x, y);
        return;
      }

      if (pending?.state) {
        const next = pending.state;
        pendingNet = null;
        pendingLocal = null;
        render();
        later(() => assignState(next), 350);
        return;
      }

      render();
      later(() => {
        if (dice === 6 || capture || dest >= FINISH) {
          phase = 'roll';
          render();
          if (isComputerTurn()) later(startRoll, 500);
        } else {
          nextTurn();
        }
      }, 350);
    }

    function cellCenter(board, pos, token) {
      const [r, c] = cellFor(token.player, token.index, pos);
      const cell = board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      if (!cell) return null;
      return {
        x: cell.offsetLeft + cell.offsetWidth / 2,
        y: cell.offsetTop + cell.offsetHeight / 2,
        size: Math.min(cell.offsetWidth, cell.offsetHeight),
      };
    }

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
    }

    function hopTo(board, fly, fromPos, toPos, token, duration, chomp = false) {
      const a = cellCenter(board, fromPos, token);
      const b = cellCenter(board, toPos, token);
      if (!a || !b) return Promise.resolve();
      const size = a.size * 0.82;
      fly.style.width = `${size}px`;
      fly.style.height = `${size}px`;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const lift = chomp ? Math.min(18, 6 + dist * 0.18) : Math.min(32, 12 + dist * 0.32);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (chomp) fly.classList.add('eater');

      return new Promise((resolve) => {
        const start = performance.now();
        const tick = (now) => {
          if (!alive) {
            resolve();
            return;
          }
          const t = Math.min(1, (now - start) / duration);
          const e = easeInOutCubic(t);
          const x = a.x + (b.x - a.x) * e;
          const y = a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * lift;
          const s = 1 + Math.sin(Math.PI * e) * (chomp ? 0.1 : 0.14);
          const rot = chomp ? ` rotate(${angle}rad)` : '';
          fly.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) scale(${s})${rot}`;
          if (t < 1) {
            hopRaf = requestAnimationFrame(tick);
          } else {
            hopRaf = 0;
            fly.style.setProperty('--eat-rot', `${angle}rad`);
            resolve();
          }
        };
        hopRaf = requestAnimationFrame(tick);
      });
    }

    function gulpEat(board, fly, dest, token, capture) {
      const at = cellCenter(board, dest, token);
      const victim = board.querySelector(
        `[data-piece][data-player="${capture.player}"][data-index="${capture.index}"]`,
      );
      const size = at ? at.size * 0.82 : 28;
      const x = at ? at.x : 0;
      const y = at ? at.y : 0;
      const rot = fly.style.getPropertyValue('--eat-rot') || '0rad';

      fly.classList.add('eater', 'eating');
      victim?.classList.add('is-eaten');
      playChomp();

      if (at) {
        for (let i = 0; i < 7; i += 1) {
          const crumb = document.createElement('span');
          crumb.className = `ludo-crumb hue-${PLAYERS[capture.player].hue}`;
          crumb.style.left = `${x}px`;
          crumb.style.top = `${y}px`;
          crumb.style.setProperty('--dx', `${Math.cos((i / 7) * Math.PI * 2) * (18 + (i % 3) * 10)}px`);
          crumb.style.setProperty('--dy', `${Math.sin((i / 7) * Math.PI * 2) * (16 + (i % 2) * 8)}px`);
          crumb.style.animationDelay = `${i * 0.03}s`;
          board.appendChild(crumb);
          later(() => crumb.remove(), 700);
        }
      }

      return new Promise((resolve) => {
        const start = performance.now();
        const duration = 620;
        const tick = (now) => {
          if (!alive) {
            resolve();
            return;
          }
          const t = Math.min(1, (now - start) / duration);
          const bite = 1 + Math.sin(t * Math.PI * 6) * 0.1;
          const gulp = t > 0.45 ? 1 + (t - 0.45) * 0.25 : bite;
          fly.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${rot}) scale(${gulp})`;
          if (t < 1) {
            hopRaf = requestAnimationFrame(tick);
          } else {
            hopRaf = 0;
            resolve();
          }
        };
        hopRaf = requestAnimationFrame(tick);
      });
    }

    function applyMove(move, x, y) {
      if (vsFriend) {
        if (phase !== 'move' && phase !== 'wait') return;
      } else if (phase !== 'move') {
        return;
      }
      if (!move || animating) return;

      const { token, dest, capture } = move;
      const from = token.pos;
      const steps = moveSteps(from, dest);
      if (!steps.length) {
        if (pendingNet?.state) assignState(pendingNet.state);
        else if (pendingLocal?.state) assignState(pendingLocal.state);
        pendingNet = null;
        pendingLocal = null;
        return;
      }

      phase = 'wait';
      animating = true;
      movable = [];
      hoppingToken = token;

      const board = getBoard();
      paintBoard(board);
      if (!board) {
        token.pos = dest;
        completeMove(move, x, y, capture);
        return;
      }

      const fly = document.createElement('div');
      fly.className = `ludo-piece ludo-piece-fly hue-${PLAYERS[token.player].hue}`;
      board.appendChild(fly);

      const startAt = cellCenter(board, from, token);
      if (startAt) {
        const size = startAt.size * 0.82;
        fly.style.width = `${size}px`;
        fly.style.height = `${size}px`;
        fly.style.transform = `translate(${startAt.x - size / 2}px, ${startAt.y - size / 2}px)`;
      }

      const hopMs = steps.length > 4 ? 200 : 240;
      const last = steps[steps.length - 1];
      let prev = from;
      let chain = Promise.resolve();
      for (const pos of steps) {
        const nextPos = pos;
        const fromPos = prev;
        const chomp = Boolean(capture) && pos === last;
        chain = chain.then(() => {
          if (!alive) return;
          playMoveStep();
          return hopTo(board, fly, fromPos, nextPos, token, chomp ? hopMs + 80 : hopMs, chomp);
        });
        prev = nextPos;
      }

      chain
        .then(() => {
          if (!alive || !capture) return;
          return gulpEat(board, fly, dest, token, capture);
        })
        .then(() => {
          if (!alive) return;
          fly.remove();
          token.pos = dest;
          completeMove(move, x, y, capture);
        });
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

    const invited = normalizeRoomCode(opts.room);
    if (ROOM_CODE_RE.test(invited)) {
      joinRoom(invited);
    } else {
      render();
    }

    this._stop = () => {
      alive = false;
      if (hopRaf) cancelAnimationFrame(hopRaf);
      hopRaf = 0;
      dropNet();
      root.removeEventListener('click', onTap);
      root.removeEventListener('touchend', onTap);
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
