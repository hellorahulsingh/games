export function spawnStarFloat(x, y) {
  const el = document.createElement('div');
  el.className = 'star-float';
  el.textContent = '★';
  el.style.left = `${x - 12}px`;
  el.style.top = `${y - 12}px`;
  el.style.color = 'var(--accent-2)';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

export function spawnVictoryBurst(cx, cy, count = 12) {
  const colors = ['#e53935', '#f9a825', '#2e7d32', '#1565c0', '#ffca28', '#ab47bc'];
  const glyphs = ['★', '✦', '✧'];

  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 50 + Math.random() * 90;
    const el = document.createElement('div');
    el.className = 'victory-burst-star';
    el.textContent = glyphs[i % glyphs.length];
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.setProperty('--vx', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--vy', `${Math.sin(angle) * dist}px`);
    el.style.color = colors[i % colors.length];
    el.style.animationDelay = `${i * 40}ms`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

export function pulseWin(el) {
  if (!el) return;
  el.classList.remove('win-pulse');
  void el.offsetWidth;
  el.classList.add('win-pulse');
}

export function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

export function pointerClient(e) {
  if (e.changedTouches && e.changedTouches[0]) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  if (e.touches && e.touches[0]) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}
