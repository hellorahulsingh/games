export async function createLudoRoom() {
  const res = await fetch('/api/ludo/rooms', { method: 'POST' });
  if (!res.ok) {
    const err = new Error('create-failed');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function connectLudoRoom({ code, role, onMessage, onClose }) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/api/ludo/rooms/${code}?role=${encodeURIComponent(role)}`;
  const ws = new WebSocket(url);
  let closed = false;

  ws.addEventListener('message', (event) => {
    try {
      onMessage?.(JSON.parse(event.data));
    } catch {
      // ignore malformed payloads
    }
  });

  const finish = (event) => {
    if (closed) return;
    closed = true;
    onClose?.(event);
  };

  ws.addEventListener('close', (event) => finish(event));
  ws.addEventListener('error', () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) return;
    finish({ code: 1006, reason: 'error' });
  });

  return {
    send(msg) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      closed = true;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
  };
}
