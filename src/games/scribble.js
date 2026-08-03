import { setupCanvas } from '../shared/canvas.js';
import { pointerClient } from '../shared/feedback.js';
import { playSoft, playSuccess } from '../shell/audio.js';
import { addPoints } from '../shell/score.js';

const PALETTE = ['#7a9e8a', '#d4896a', '#8a9eb0', '#c4a35a', '#3d4a42'];

export const scribble = {
  id: 'scribble',
  title: 'Scribble',
  icon: '✏️',

  start(container) {
    const root = document.createElement('div');
    root.className = 'scribble-root';
    container.appendChild(root);

    const toolbar = document.createElement('div');
    toolbar.className = 'scribble-toolbar';
    root.appendChild(toolbar);

    let color = PALETTE[0];
    let strokeCount = 0;
    let awarded = 0;

    PALETTE.forEach((hex) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'scribble-swatch';
      sw.style.background = hex;
      if (hex === color) sw.classList.add('active');
      sw.setAttribute('aria-label', 'Color');
      sw.addEventListener('click', () => {
        color = hex;
        toolbar.querySelectorAll('.scribble-swatch').forEach((el) => el.classList.remove('active'));
        sw.classList.add('active');
        playSoft();
      });
      toolbar.appendChild(sw);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'scribble-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      const { ctx, width, height } = surface;
      ctx.clearRect(0, 0, width, height);
      playSoft();
    });
    toolbar.appendChild(clearBtn);

    const canvasHost = document.createElement('div');
    canvasHost.className = 'scribble-canvas-host';
    root.appendChild(canvasHost);

    const surface = setupCanvas(canvasHost);
    surface.wrap.style.background = '#f4f7f4';

    let drawing = false;
    let last = null;

    function point(e) {
      const { x, y } = pointerClient(e);
      return surface.canvasPoint(x, y);
    }

    function startDraw(e) {
      e.preventDefault();
      drawing = true;
      last = point(e);
      playSoft();
    }

    function moveDraw(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = point(e);
      const { ctx } = surface;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(10, Math.min(18, surface.width * 0.025));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    }

    function endDraw(e) {
      if (!drawing) return;
      e.preventDefault();
      drawing = false;
      last = null;
      strokeCount += 1;
      if (strokeCount >= 3 && awarded < Math.floor(strokeCount / 3)) {
        awarded = Math.floor(strokeCount / 3);
        addPoints(1);
        playSuccess();
      }
    }

    surface.canvas.addEventListener('pointerdown', startDraw);
    surface.canvas.addEventListener('pointermove', moveDraw);
    surface.canvas.addEventListener('pointerup', endDraw);
    surface.canvas.addEventListener('pointercancel', endDraw);
    surface.canvas.addEventListener('pointerleave', endDraw);

    this._stop = () => {
      surface.canvas.removeEventListener('pointerdown', startDraw);
      surface.canvas.removeEventListener('pointermove', moveDraw);
      surface.canvas.removeEventListener('pointerup', endDraw);
      surface.canvas.removeEventListener('pointercancel', endDraw);
      surface.canvas.removeEventListener('pointerleave', endDraw);
      surface.destroy();
      root.remove();
    };
  },

  stop() {
    this._stop?.();
    this._stop = null;
  },
};
