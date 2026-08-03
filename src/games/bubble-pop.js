import { setupCanvas } from '../shared/canvas.js';
import { spawnStarFloat, pointerClient } from '../shared/feedback.js';
import { playPop } from '../shell/audio.js';
import { addPoints } from '../shell/score.js';

const COLORS = ['#7a9e8a', '#d4896a', '#8a9eb0', '#c4a35a'];

function makeBubble(w, h) {
  const r = 28 + Math.random() * 36;
  return {
    x: r + Math.random() * (w - r * 2),
    y: h + r + Math.random() * 80,
    r,
    vy: -(0.6 + Math.random() * 1.1),
    vx: (Math.random() - 0.5) * 0.6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    wobble: Math.random() * Math.PI * 2,
    alive: true,
  };
}

export const bubblePop = {
  id: 'bubble-pop',
  title: 'Bubble Pop',
  icon: '🫧',

  start(container, api) {
    const surface = setupCanvas(container);
    const bubbles = [];
    let raf = 0;
    let spawnTimer = 0;
    let running = true;

    function spawn() {
      if (bubbles.filter((b) => b.alive).length < 8) {
        bubbles.push(makeBubble(surface.width, surface.height));
      }
    }

    for (let i = 0; i < 4; i++) spawn();

    function hitTest(x, y) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (!b.alive) continue;
        const dx = x - b.x;
        const dy = y - b.y;
        if (dx * dx + dy * dy <= b.r * b.r) return b;
      }
      return null;
    }

    function onPointer(e) {
      e.preventDefault();
      const { x: cx, y: cy } = pointerClient(e);
      const p = surface.canvasPoint(cx, cy);
      const hit = hitTest(p.x, p.y);
      if (!hit) return;
      hit.alive = false;
      playPop();
      addPoints(1);
      spawnStarFloat(cx, cy);
      api?.onScore?.();
    }

    surface.canvas.addEventListener('pointerdown', onPointer);

    function frame(t) {
      if (!running) return;
      const { ctx, width, height } = surface;
      ctx.clearRect(0, 0, width, height);

      // soft sky dots
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 12; i++) {
        const sx = ((i * 97) % width);
        const sy = ((i * 53 + t * 0.01) % height);
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t - spawnTimer > 900) {
        spawn();
        spawnTimer = t;
      }

      for (const b of bubbles) {
        if (!b.alive) continue;
        b.wobble += 0.03;
        b.x += b.vx + Math.sin(b.wobble) * 0.4;
        b.y += b.vy;

        if (b.y + b.r < -20) {
          b.alive = false;
          continue;
        }

        const g = ctx.createRadialGradient(
          b.x - b.r * 0.3,
          b.y - b.r * 0.35,
          b.r * 0.1,
          b.x,
          b.y,
          b.r,
        );
        g.addColorStop(0, 'rgba(255,255,255,0.75)');
        g.addColorStop(0.45, b.color);
        g.addColorStop(1, 'rgba(61,74,66,0.15)');
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // cleanup dead
      for (let i = bubbles.length - 1; i >= 0; i--) {
        if (!bubbles[i].alive) bubbles.splice(i, 1);
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    this._stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      surface.canvas.removeEventListener('pointerdown', onPointer);
      surface.destroy();
    };
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};
