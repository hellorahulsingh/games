export const SIZE = 15;
export const FINISH = 56;
export const HOME_START = 51;

export const PATH = [
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

export const PLAYERS = [
  {
    id: 0,
    hue: 'red',
    start: 0,
    yard: [[10, 1], [10, 4], [13, 1], [13, 4]],
    home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    done: [[8, 6], [8, 7], [7, 6], [6, 6]],
  },
  {
    id: 1,
    hue: 'yellow',
    start: 26,
    yard: [[1, 10], [1, 13], [4, 10], [4, 13]],
    home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    done: [[6, 8], [7, 8], [8, 8], [6, 7]],
  },
];

export const SAFE = new Set(['13,6', '6,1', '1,8', '8,13', '8,2', '2,6', '6,12', '12,8']);

export const SAFE_COLOR = {
  '13,6': 'red',
  '6,1': 'green',
  '1,8': 'yellow',
  '8,13': 'blue',
  '8,2': 'star',
  '2,6': 'star',
  '6,12': 'star',
  '12,8': 'star',
};

export function key(r, c) {
  return `${r},${c}`;
}

export function cellFor(player, tokenIndex, pos) {
  const p = PLAYERS[player];
  if (pos < 0) return p.yard[tokenIndex];
  if (pos >= FINISH) return p.done[tokenIndex];
  if (pos >= HOME_START) return p.home[pos - HOME_START];
  return PATH[(p.start + pos) % 52];
}

export function isSafeCell(r, c) {
  return SAFE.has(key(r, c));
}

export function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export const CARD_IDS = ['swap', 'gift', 'shield', 'reroll', 'plus'];

export const CARDS = {
  swap: {
    id: 'swap',
    icon: '🔄',
    label: 'Swap',
    blurb: 'They roll the dice for you this turn. You roll for them next time.',
  },
  gift: {
    id: 'gift',
    icon: '🎁',
    label: 'Give',
    blurb: 'Rolled a number you cannot use? Send that number to the other player.',
  },
  shield: {
    id: 'shield',
    icon: '🛡️',
    label: 'Shield',
    blurb: 'The next time a piece would eat yours, yours stays put.',
  },
  reroll: {
    id: 'reroll',
    icon: '🎲',
    label: 'Again',
    blurb: 'Do not like this roll? Throw it away and roll again.',
  },
  plus: {
    id: 'plus',
    icon: '+1',
    label: '+1',
    blurb: 'Add 1 to your dice before you move. A 6 can become 7.',
  },
};

function shuffled(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function dealHand() {
  return shuffled(CARD_IDS).slice(0, 2);
}

export function freshTokens() {
  return [0, 1].flatMap((p) =>
    [0, 1, 2, 3].map((i) => ({ player: p, index: i, pos: -1 })),
  );
}

function emptyCards() {
  return [[], []];
}

export function freshState() {
  return {
    turn: 0,
    dice: 0,
    lastDice: [0, 0],
    phase: 'roll',
    sixStreak: 0,
    sixBefore: 0,
    tokens: freshTokens(),
    winner: null,
    cards: [dealHand(), dealHand()],
    roller: 0,
    swapBack: false,
    shield: [false, false],
  };
}

export function snapshotState(state) {
  const turn = state.turn;
  const cards = Array.isArray(state.cards)
    ? [ [...(state.cards[0] || [])], [...(state.cards[1] || [])] ]
    : emptyCards();
  const shield = Array.isArray(state.shield)
    ? [Boolean(state.shield[0]), Boolean(state.shield[1])]
    : [false, false];
  return {
    turn,
    dice: state.dice,
    lastDice: [...(state.lastDice || [0, 0])],
    phase: state.phase,
    sixStreak: state.sixStreak || 0,
    sixBefore: state.sixBefore || 0,
    tokens: state.tokens.map((t) => ({ player: t.player, index: t.index, pos: t.pos })),
    winner: state.winner ?? null,
    cards,
    roller: state.roller === 0 || state.roller === 1 ? state.roller : turn,
    swapBack: Boolean(state.swapBack),
    shield,
  };
}

function destCell(player, dest) {
  return cellFor(player, 0, dest < 0 ? -1 : dest);
}

function tokenAtCell(tokens, r, c) {
  return tokens.filter((t) => {
    const [tr, tc] = cellFor(t.player, t.index, t.pos);
    return tr === r && tc === c;
  });
}

function countByPlayer(here) {
  const counts = [0, 0];
  for (const t of here) {
    if (t.player === 0 || t.player === 1) counts[t.player] += 1;
  }
  return counts;
}

export function isDoubleSafe(tokens, r, c) {
  const counts = countByPlayer(tokenAtCell(tokens, r, c));
  return counts[0] >= 2 || counts[1] >= 2;
}

export function isProtectedCell(tokens, r, c) {
  return isSafeCell(r, c) || isDoubleSafe(tokens, r, c);
}

export function captureTarget(tokens, player, dest) {
  if (dest < 0 || dest >= HOME_START) return null;
  const [r, c] = destCell(player, dest);
  if (isProtectedCell(tokens, r, c)) return null;
  const here = tokenAtCell(tokens, r, c);
  if (here.length > 1) return null;
  const others = here.filter((t) => t.player !== player);
  if (others.length === 1) return { player: others[0].player, index: others[0].index };
  return null;
}

function blocked(tokens, player, dest) {
  if (dest < 0 || dest >= HOME_START) return false;
  const [r, c] = destCell(player, dest);
  if (isSafeCell(r, c)) return false;
  if (isDoubleSafe(tokens, r, c)) return true;
  const others = tokenAtCell(tokens, r, c).filter((t) => t.player !== player);
  return others.length >= 2;
}

function movesForValue(state, player, value) {
  return legalMoves(state.tokens, player, value, state.shield);
}

export function legalMoves(tokens, player, value, shield = [false, false]) {
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
    if (blocked(tokens, player, dest)) continue;
    const threat = captureTarget(tokens, player, dest);
    const capture = threat && !shield[threat.player] ? threat : null;
    moves.push({
      tokenIndex: t.index,
      dest,
      capture,
    });
  }
  return moves;
}

export function hasCard(state, player, card) {
  return Boolean(state.cards?.[player]?.includes(card));
}

export function canHoldDead(state, player = state.turn) {
  return hasCard(state, player, 'gift') || hasCard(state, player, 'reroll') || hasCard(state, player, 'plus');
}

function takeCard(state, player, card) {
  const hand = state.cards[player];
  if (!hand) return false;
  const i = hand.indexOf(card);
  if (i < 0) return false;
  hand.splice(i, 1);
  return true;
}

export function cardIsPlayable(state, player, card) {
  if (player !== state.turn) return false;
  if (!hasCard(state, player, card)) return false;
  const roller = state.roller === 0 || state.roller === 1 ? state.roller : state.turn;
  if (card === 'swap') {
    return state.phase === 'roll' && roller === state.turn;
  }
  if (card === 'shield') {
    return state.phase === 'roll';
  }
  if (card === 'gift') {
    return state.phase === 'dead';
  }
  if (card === 'reroll' || card === 'plus') {
    return state.phase === 'move' || state.phase === 'dead';
  }
  return false;
}

export function advanceTurn(state) {
  state.turn = state.turn === 0 ? 1 : 0;
  state.dice = 0;
  state.sixStreak = 0;
  state.sixBefore = 0;
  state.phase = 'roll';
  state.winner = null;
  if (state.swapBack) {
    state.roller = state.turn === 0 ? 1 : 0;
    state.swapBack = false;
  } else {
    state.roller = state.turn;
  }
  return state;
}

function finishDeadOrSkip(next, value) {
  if (canHoldDead(next, next.turn)) {
    next.phase = 'dead';
    return { state: next, skip: 'none', rolledBy: next.turn, value };
  }
  const rolledBy = next.turn;
  advanceTurn(next);
  return { state: next, skip: 'none', rolledBy, value };
}

export function applyRoll(state, value) {
  const next = snapshotState(state);
  next.sixBefore = next.sixStreak;
  next.dice = value;
  next.lastDice[next.turn] = value;

  let skip = null;
  if (value === 6) {
    next.sixStreak += 1;
    if (next.sixStreak >= 3) {
      next.sixStreak = 0;
      skip = 'sixes';
    }
  } else {
    next.sixStreak = 0;
  }

  if (skip === 'sixes') {
    const rolledBy = next.turn;
    advanceTurn(next);
    return { state: next, skip, rolledBy, value };
  }

  if (!movesForValue(next, next.turn, value).length) {
    return finishDeadOrSkip(next, value);
  }

  next.phase = 'move';
  return { state: next, skip: null, rolledBy: next.turn, value };
}

function consumeShieldIfNeeded(next, dest) {
  const threat = captureTarget(next.tokens, next.turn, dest);
  if (threat && next.shield[threat.player]) {
    next.shield[threat.player] = false;
  }
}

export function applyMove(state, tokenIndex) {
  const next = snapshotState(state);
  const token = next.tokens.find((t) => t.player === next.turn && t.index === tokenIndex);
  if (!token) return null;
  const from = token.pos;
  const move = movesForValue(next, next.turn, next.dice).find((m) => m.tokenIndex === tokenIndex);
  if (!move) return null;

  consumeShieldIfNeeded(next, move.dest);
  token.pos = move.dest;
  if (move.capture) {
    const cap = next.tokens.find(
      (t) => t.player === move.capture.player && t.index === move.capture.index,
    );
    if (cap) cap.pos = -1;
  }

  const won = next.tokens.filter((t) => t.player === next.turn && t.pos >= FINISH).length === 4;
  if (won) {
    next.phase = 'won';
    next.winner = next.turn;
    return { state: next, move, from, won: true };
  }

  if (next.dice === 6 || move.capture || move.dest >= FINISH) {
    next.phase = 'roll';
    next.dice = 0;
  } else {
    advanceTurn(next);
  }
  return { state: next, move, from, won: false };
}

function applyGift(next) {
  const opp = next.turn === 0 ? 1 : 0;
  const value = next.dice;
  next.swapBack = false;
  next.turn = opp;
  next.roller = opp;
  next.lastDice[opp] = value;
  if (!movesForValue(next, opp, value).length) {
    advanceTurn(next);
    return next;
  }
  next.phase = 'move';
  return next;
}

function applyReroll(next) {
  next.sixStreak = next.sixBefore || 0;
  next.dice = 0;
  next.phase = 'roll';
  return next;
}

function applyPlus(next) {
  next.dice += 1;
  next.lastDice[next.turn] = next.dice;
  if (movesForValue(next, next.turn, next.dice).length) {
    next.phase = 'move';
    return next;
  }
  if (canHoldDead(next, next.turn)) {
    next.phase = 'dead';
    return next;
  }
  advanceTurn(next);
  return next;
}

export function applyCard(state, player, card) {
  if (!cardIsPlayable(state, player, card)) return null;
  const next = snapshotState(state);
  if (!takeCard(next, player, card)) return null;

  if (card === 'swap') {
    next.roller = next.turn === 0 ? 1 : 0;
    next.swapBack = true;
    return next;
  }
  if (card === 'shield') {
    next.shield[player] = true;
    return next;
  }
  if (card === 'gift') return applyGift(next);
  if (card === 'reroll') return applyReroll(next);
  if (card === 'plus') return applyPlus(next);
  return null;
}

export function passDead(state, player) {
  if (state.phase !== 'dead' || player !== state.turn) return null;
  const next = snapshotState(state);
  advanceTurn(next);
  return next;
}
