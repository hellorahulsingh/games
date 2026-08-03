const KEY = 'iti-games-score';

let total = Number(localStorage.getItem(KEY) || 0) || 0;
let session = 0;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn({ total, session });
}

export function getScore() {
  return { total, session };
}

export function addPoints(n = 1) {
  session += n;
  total += n;
  localStorage.setItem(KEY, String(total));
  notify();
  return { total, session };
}

export function resetSession() {
  session = 0;
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
