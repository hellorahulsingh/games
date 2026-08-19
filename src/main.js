import './styles/tokens.css';
import './styles/base.css';
import './styles/hub.css';
import './styles/game-shell.css';

import { renderHub } from './shell/hub.js';
import { createHud } from './shell/hud.js';
import { bubblePop } from './games/bubble-pop.js';
import { shapeMatch } from './games/shape-match.js';
import { findAnimal } from './games/find-animal.js';
import { countTap } from './games/count-tap.js';
import { memoryPairs } from './games/memory-pairs.js';
import { colorMatch } from './games/color-match.js';
import { bigOrSmall } from './games/big-or-small.js';
import { catchStars } from './games/catch-stars.js';
import { scribble } from './games/scribble.js';
import { stackBlocks } from './games/stack-blocks.js';
import { ludo } from './games/ludo.js';

const games = [
  bubblePop,
  shapeMatch,
  findAnimal,
  countTap,
  memoryPairs,
  colorMatch,
  bigOrSmall,
  catchStars,
  scribble,
  stackBlocks,
  ludo,
];
const byId = Object.fromEntries(games.map((g) => [g.id, g]));

const app = document.querySelector('#app');
let cleanup = null;
let activeGame = null;
let hud = null;

function clearView() {
  if (activeGame) {
    activeGame.stop();
    activeGame = null;
  }
  if (hud) {
    hud.destroy();
    hud = null;
  }
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  app.innerHTML = '';
}

function showHub() {
  clearView();
  cleanup = renderHub(app, games, (id) => {
    location.hash = `#/${id}`;
  });
}

function showGame(id) {
  const game = byId[id];
  if (!game) {
    location.hash = '#/';
    return;
  }

  clearView();
  hud = createHud(app, {
    title: game.title,
    onBack: () => {
      location.hash = '#/';
    },
  });
  activeGame = game;
  game.start(hud.stage, {});
}

function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash || hash === '/') {
    showHub();
  } else {
    showGame(hash);
  }
}

window.addEventListener('hashchange', route);
route();
