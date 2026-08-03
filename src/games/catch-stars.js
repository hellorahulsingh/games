import { setupCanvas } from '../shared/canvas.js';
import { spawnStarFloat, pointerClient } from '../shared/feedback.js';
import { playPop, playSuccess } from '../shell/audio.js';
import { addPoints } from '../shell/score.js';

const COLORS = ['#c4a35a', '#d4896a', '#7a9e8a', '#8a9eb0'];

function makeStar(w, h) {
  const r = 22 + Math.random() * 18;
  return {
    x: r + Math.random() * (w - r * 2),
    y: -r - Math.random() * 40,
    r,
    vy: 1.2 + Math.random() * 1.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    spin: Math.random() * Math.PI * 2,
    alive: true,
  };
}

function drawStar(ctx, x, y, r, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export const catchStars = {
  id: 'catch-stars',
  title: 'Catch Stars',
  icon: '✨',

  start(container) {
    const surface = setupCanvas(container);
    const stars = [];
    let raf = 0;
    let spawnTimer = 0;
    let running = true;
    let caught = 0;

    function spawn() {
      if (stars.filter((s) => s.alive).length < 6) {
        stars.push(makeStar(surface.width, surface.height));
      }
    }

    for (let i = 0; i < 3; i++) spawn();

    function hitTest(x, y) {
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        if (!s.alive) continue;
        const dx = x - s.x;
        const dy = y - s.y;
        if (dx * dx + dy * dy <= (s.r + 8) * (s.r + 8)) return s;
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
      caught += 1;
      playPop();
      addPoints(1);
      spawnStarFloat(cx, cy);
      if (caught % 5 === 0) playSuccess();
    }

    surface.canvas.addEventListener('pointerdown', onPointer);

    function frame(t) {
      if (!running) return;
      const { ctx, width, height } = surface;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.arc((i * 73) % width, (i * 41 + t * 0.008) % height, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t - spawnTimer > 700) {
        spawn();
        spawnTimer = t;
      }

      for (const s of stars) {
        if (!s.alive) continue;
        s.y += s.vy;
        s.spin += 0.03;
        if (s.y - s.r > height + 10) {
          s.alive = false;
          continue;
        }
        drawStar(ctx, s.x, s.y, s.r, s.spin, s.color);
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        if (!stars[i].alive) stars.splice(i, 1);
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
