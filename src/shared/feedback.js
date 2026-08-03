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
  if (e.touches && e.touches[0]) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}
