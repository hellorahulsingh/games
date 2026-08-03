import { setupCanvas } from '../shared/canvas.js';
import { spawnStarFloat } from '../shared/feedback.js';
import { playPop, playSuccess, playWrong } from '../shell/audio.js';
import { addPoints } from '../shell/score.js';

const GROUND_COLOR = '#9bb59f';
const SKY_TOP = '#dfeadf';
const SKY_BOTTOM = '#c9d8cb';
const DINO_COLOR = '#5f8570';
const DINO_BELLY = '#a8c4b0';
const OBSTACLE_COLORS = ['#7a9e8a', '#d4896a', '#8a9eb0'];

export const dinoRun = {
  id: 'dino-run',
  title: 'Dino Jump',
  icon: '🦕',

  start(container) {
    const surface = setupCanvas(container);
    let raf = 0;
    let running = true;
    let grounded = true;
    let vy = 0;
    let jumpQueued = false;
    let invuln = 0;
    let scorePulse = 0;
    let spawnAt = 0;
    let elapsed = 0;

    const state = {
      dinoX: 0,
      dinoY: 0,
      dinoW: 56,
      dinoH: 48,
      groundY: 0,
      speed: 2.4,
      obstacles: [],
      clouds: [],
    };

    function layout() {
      const { width, height } = surface;
      state.groundY = Math.floor(height * 0.78);
      state.dinoX = Math.min(90, width * 0.18);
      state.dinoW = Math.max(48, Math.min(72, width * 0.12));
      state.dinoH = state.dinoW * 0.86;
      if (grounded) state.dinoY = state.groundY - state.dinoH;
      state.speed = Math.max(2.2, Math.min(3.4, width / 280));
    }

    function seedClouds() {
      const { width, height } = surface;
      state.clouds = Array.from({ length: 4 }, (_, i) => ({
        x: (width / 4) * i + Math.random() * 40,
        y: height * 0.12 + Math.random() * height * 0.22,
        w: 40 + Math.random() * 36,
        speed: 0.2 + Math.random() * 0.25,
      }));
    }

    function spawnObstacle() {
      const { width } = surface;
      const kind = Math.random() < 0.55 ? 'bush' : 'rock';
      const h = kind === 'bush' ? 36 + Math.random() * 18 : 28 + Math.random() * 16;
      const w = kind === 'bush' ? 28 + Math.random() * 14 : 34 + Math.random() * 18;
      state.obstacles.push({
        x: width + 20,
        y: state.groundY - h,
        w,
        h,
        kind,
        color: OBSTACLE_COLORS[Math.floor(Math.random() * OBSTACLE_COLORS.length)],
        scored: false,
      });
    }

    function jump() {
      if (!running) return;
      if (grounded && invuln <= 0) {
        grounded = false;
        vy = -11.5;
        playPop();
      } else {
        jumpQueued = true;
      }
    }

    function onPointer(e) {
      e.preventDefault();
      jump();
    }

    function onKey(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    }

    function hitTest(o) {
      // Generous toddler hitbox — shrink obstacle, pad dino lightly
      const pad = 8;
      const dx = state.dinoX + pad;
      const dy = state.dinoY + pad;
      const dw = state.dinoW - pad * 2;
      const dh = state.dinoH - pad * 2;
      const ox = o.x + 6;
      const oy = o.y + 4;
      const ow = o.w - 12;
      const oh = o.h - 8;
      return dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy;
    }

    function drawDino(ctx) {
      const { dinoX: x, dinoY: y, dinoW: w, dinoH: h } = state;
      const bob = grounded ? Math.sin(elapsed / 120) * 1.5 : 0;
      ctx.save();
      ctx.translate(x, y + bob);
      if (invuln > 0 && Math.floor(elapsed / 80) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      // body
      ctx.fillStyle = DINO_COLOR;
      roundRect(ctx, 4, h * 0.28, w * 0.72, h * 0.55, 10);
      ctx.fill();

      // belly
      ctx.fillStyle = DINO_BELLY;
      roundRect(ctx, 12, h * 0.4, w * 0.42, h * 0.32, 8);
      ctx.fill();

      // head
      ctx.fillStyle = DINO_COLOR;
      roundRect(ctx, w * 0.48, 2, w * 0.48, h * 0.42, 12);
      ctx.fill();

      // eye
      ctx.fillStyle = '#f4f7f4';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.2, Math.max(4, w * 0.07), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d4a42';
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.2, Math.max(2, w * 0.035), 0, Math.PI * 2);
      ctx.fill();

      // snout
      ctx.fillStyle = DINO_BELLY;
      roundRect(ctx, w * 0.78, h * 0.28, w * 0.22, h * 0.14, 6);
      ctx.fill();

      // legs
      ctx.fillStyle = DINO_COLOR;
      const stride = grounded ? Math.sin(elapsed / 90) : 0;
      roundRect(ctx, w * 0.18, h * 0.72, w * 0.16, h * 0.28 + stride * 3, 5);
      ctx.fill();
      roundRect(ctx, w * 0.42, h * 0.72, w * 0.16, h * 0.28 - stride * 3, 5);
      ctx.fill();

      // tiny arm
      roundRect(ctx, w * 0.55, h * 0.48, w * 0.18, h * 0.1, 4);
      ctx.fill();

      ctx.restore();
    }

    function drawObstacle(ctx, o) {
      ctx.fillStyle = o.color;
      if (o.kind === 'bush') {
        ctx.beginPath();
        ctx.ellipse(o.x + o.w * 0.5, o.y + o.h * 0.55, o.w * 0.55, o.h * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(o.x + o.w * 0.25, o.y + o.h * 0.45, o.w * 0.35, o.h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(o.x + o.w * 0.75, o.y + o.h * 0.5, o.w * 0.32, o.h * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        roundRect(ctx, o.x, o.y + o.h * 0.15, o.w, o.h * 0.85, 8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(o.x + 4, o.y + o.h * 0.2);
        ctx.lineTo(o.x + o.w * 0.5, o.y);
        ctx.lineTo(o.x + o.w - 4, o.y + o.h * 0.2);
        ctx.closePath();
        ctx.fill();
      }
    }

    function frame(t) {
      if (!running) return;
      const dt = Math.min(32, t - (frame.prev || t));
      frame.prev = t;
      elapsed += dt;

      layout();
      if (!state.clouds.length) seedClouds();

      const { ctx, width, height } = surface;

      // sky
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, SKY_TOP);
      grad.addColorStop(1, SKY_BOTTOM);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // clouds
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const c of state.clouds) {
        c.x -= c.speed * (dt / 16);
        if (c.x + c.w < -20) c.x = width + 20;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w * 0.5, c.w * 0.22, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x - c.w * 0.25, c.y + 4, c.w * 0.28, c.w * 0.16, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x + c.w * 0.28, c.y + 2, c.w * 0.3, c.w * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ground
      ctx.fillStyle = GROUND_COLOR;
      ctx.fillRect(0, state.groundY, width, height - state.groundY);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, state.groundY, width, 6);
      // ground dashes
      ctx.fillStyle = 'rgba(61,74,66,0.12)';
      const dashOffset = (elapsed * state.speed * 0.08) % 48;
      for (let x = -dashOffset; x < width; x += 48) {
        ctx.fillRect(x, state.groundY + 18, 22, 4);
      }

      // physics
      if (invuln > 0) invuln -= dt;

      if (!grounded) {
        vy += 0.55;
        state.dinoY += vy;
        if (state.dinoY >= state.groundY - state.dinoH) {
          state.dinoY = state.groundY - state.dinoH;
          grounded = true;
          vy = 0;
          if (jumpQueued) {
            jumpQueued = false;
            jump();
          }
        }
      } else {
        state.dinoY = state.groundY - state.dinoH;
      }

      // spawn
      spawnAt -= dt;
      if (spawnAt <= 0 && state.obstacles.length < 2) {
        spawnObstacle();
        spawnAt = 1600 + Math.random() * 1400;
      }

      // obstacles
      for (const o of state.obstacles) {
        o.x -= state.speed * (dt / 16) * 1.15;
        o.y = state.groundY - o.h;

        if (!o.scored && o.x + o.w < state.dinoX) {
          o.scored = true;
          addPoints(1);
          playSuccess();
          scorePulse = 12;
          spawnStarFloat(
            surface.wrap.getBoundingClientRect().left + state.dinoX + state.dinoW,
            surface.wrap.getBoundingClientRect().top + state.dinoY,
          );
        }

        if (invuln <= 0 && hitTest(o)) {
          playWrong();
          invuln = 1200;
          // soft bump — bounce dino up a little, clear nearby obstacle
          grounded = false;
          vy = -7;
          o.x = -999;
        }

        drawObstacle(ctx, o);
      }

      state.obstacles = state.obstacles.filter((o) => o.x > -80);

      if (scorePulse > 0) {
        scorePulse -= 1;
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#6a9b78';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      drawDino(ctx);

      // hint
      ctx.fillStyle = 'rgba(61,74,66,0.45)';
      ctx.font = `700 ${Math.max(14, Math.min(20, width * 0.04))}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Tap to jump!', width / 2, 28);

      raf = requestAnimationFrame(frame);
    }

    function onResize() {
      layout();
      if (grounded) state.dinoY = state.groundY - state.dinoH;
    }

    surface.canvas.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    layout();
    state.dinoY = state.groundY - state.dinoH;
    seedClouds();
    spawnAt = 900;
    raf = requestAnimationFrame(frame);

    this._stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      surface.canvas.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      surface.destroy();
    };
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
