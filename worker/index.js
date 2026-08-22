import {
  applyMove,
  applyRoll,
  freshState,
  rollDie,
} from '../src/shared/ludo-engine.js';
import { makeRoomCode, ROOM_CODE_RE } from '../src/shared/ludo-room.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function createRoom(env) {
  for (let i = 0; i < 12; i += 1) {
    const code = makeRoomCode();
    const stub = env.LUDO_ROOMS.get(env.LUDO_ROOMS.idFromName(code));
    const res = await stub.fetch(new Request(`https://ludo/claim?code=${code}`, { method: 'POST' }));
    if (res.ok) return json({ code });
  }
  return json({ error: 'busy' }, 503);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/ludo')) {
      if (url.pathname === '/api/ludo/rooms' && request.method === 'POST') {
        return createRoom(env);
      }

      const match = url.pathname.match(/^\/api\/ludo\/rooms\/([A-HJ-NP-Z2-9]{4})$/);
      if (match) {
        const code = match[1];
        if (!ROOM_CODE_RE.test(code)) return json({ error: 'bad-code' }, 400);
        const stub = env.LUDO_ROOMS.get(env.LUDO_ROOMS.idFromName(code));
        return stub.fetch(request);
      }

      return json({ error: 'not-found' }, 404);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};

export class LudoRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  occupied() {
    const seats = { 0: false, 1: false };
    for (const ws of this.ctx.getWebSockets()) {
      const player = ws.deserializeAttachment()?.player;
      if (player === 0 || player === 1) seats[player] = true;
    }
    return seats;
  }

  send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      // socket already closing
    }
  }

  broadcast(data, except = null) {
    const payload = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(payload);
      } catch {
        // ignore
      }
    }
  }

  sendTo(player, data) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.deserializeAttachment()?.player === player) this.send(ws, data);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname.endsWith('/claim')) {
      if (this.ctx.getWebSockets().length > 0) {
        return new Response('taken', { status: 409 });
      }
      await this.ctx.storage.deleteAll();
      const code = url.searchParams.get('code') || '';
      await this.ctx.storage.put('meta', { code, createdAt: Date.now() });
      return new Response('ok');
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const role = url.searchParams.get('role') === 'join' ? 'join' : 'host';
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);

    const meta = (await this.ctx.storage.get('meta')) || {};
    const code = meta.code || url.pathname.split('/').pop();
    const seats = this.occupied();
    let player = role === 'host' ? 0 : 1;
    if (seats[player]) {
      server.close(4000, 'taken');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (player === 1 && !seats[0] && !meta.code) {
      server.close(4001, 'missing');
      return new Response(null, { status: 101, webSocket: client });
    }

    server.serializeAttachment({ player });

    const both = this.occupied()[0] && this.occupied()[1];
    let game = await this.ctx.storage.get('game');
    if (both) {
      if (!game || game.phase === 'won') {
        game = freshState();
        await this.ctx.storage.put('game', game);
      }
      this.sendTo(0, { type: 'start', player: 0, code, state: game });
      this.sendTo(1, { type: 'start', player: 1, code, state: game });
    } else {
      this.send(server, { type: 'waiting', player, code });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const player = ws.deserializeAttachment()?.player;
    if (player !== 0 && player !== 1) return;

    let msg;
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      msg = JSON.parse(text);
    } catch {
      return;
    }

    const game = await this.ctx.storage.get('game');
    if (!game) return;

    if (msg.type === 'roll') {
      if (game.phase !== 'roll' || game.turn !== player) return;
      const value = rollDie();
      const result = applyRoll(game, value);
      await this.ctx.storage.put('game', result.state);
      this.broadcast({
        type: 'rolled',
        player: result.rolledBy,
        value: result.value,
        skip: result.skip,
        state: result.state,
      });
      return;
    }

    if (msg.type === 'move') {
      if (game.phase !== 'move' || game.turn !== player) return;
      const tokenIndex = Number(msg.token);
      const result = applyMove(game, tokenIndex);
      if (!result) return;
      await this.ctx.storage.put('game', result.state);
      this.broadcast({
        type: 'moved',
        player,
        tokenIndex,
        dest: result.move.dest,
        from: result.from,
        capture: result.move.capture,
        won: result.won,
        state: result.state,
      });
      return;
    }

    if (msg.type === 'again') {
      if (game.phase !== 'won') return;
      const next = freshState();
      await this.ctx.storage.put('game', next);
      this.broadcast({ type: 'restart', state: next });
    }
  }

  async webSocketClose(ws) {
    try {
      ws.close(1000, 'ok');
    } catch {
      // already closed
    }
    const others = this.ctx.getWebSockets().filter((socket) => socket !== ws);
    if (!others.length) {
      await this.ctx.storage.deleteAll();
      return;
    }
    this.broadcast({ type: 'bye' }, ws);
  }

  async webSocketError(ws) {
    try {
      ws.close(1011, 'error');
    } catch {
      // already closed
    }
  }
}
