export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

export function makeRoomCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += ROOM_ALPHABET[b % ROOM_ALPHABET.length];
  return code;
}

export function normalizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, '')
    .slice(0, 4);
}

export function joinUrl(code) {
  const path = `${location.pathname || '/'}`.replace(/\/$/, '') || '';
  return `${location.origin}${path}/#/ludo/${code}`;
}
