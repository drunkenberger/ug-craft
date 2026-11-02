// Cliente de red: disponible solo cuando el juego se sirve por http (server.js).
const NET = {
  available: location.protocol.startsWith('http'),
  ws: null,
  id: null,
  isHost: false,
  peers: new Set(),
  handlers: null,
  room: null,
  player: null,
  retryTimer: null,
  outbox: new Map(), // bloques puestos/rotos sin conexión: se reenvían al reconectar

  join(roomName, handlers, player) {
    this.room = roomName;
    this.handlers = handlers;
    this.player = player || null;
    this.connect();
  },

  connect() {
    this.peers = new Set();
    this.isHost = false;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.ws = new WebSocket(`${proto}//${location.host}`);
    socket.onopen = () => {if(this.ws===socket&&this.handlers)this.send({ t: 'join', room: this.room, player: this.player, token: typeof Auth !== 'undefined' ? Auth.token() : '' });};
    socket.onmessage = (e) => {
      if(this.ws!==socket||!this.handlers)return;
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg.t === 'welcome') {
        this.id = msg.id;
        this.isHost = msg.host;
        this.peers = new Set(msg.peers);
      } else if (msg.t === 'peer-join') {
        this.peers.add(msg.id);
      } else if (msg.t === 'peer-leave') {
        this.peers.delete(msg.id);
      } else if (msg.t === 'host') {
        this.isHost = msg.id === this.id;
      }
      const fn = this.handlers && this.handlers[msg.t];
      if (fn) fn(msg);
    };
    // Si la conexión se cae (o nunca abre), reintentar mientras siga la partida.
    socket.onclose = () => {
      if(this.ws!==socket||!this.handlers)return;
      if (this.handlers && this.handlers.closed) this.handlers.closed();
      if (this.handlers) {
        this.retryTimer = setTimeout(() => this.connect(), 2000);
      }
    };
  },

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    } else if (obj.t === 'block' && this.handlers) {
      this.outbox.set(`${obj.x},${obj.y},${obj.z}`, obj);
    }
  },

  /** Ediciones hechas sin conexión, como { "x,y,z": id }. */
  pendingEdits() {
    const out = {};
    for (const [k, m] of this.outbox) out[k] = m.id;
    return out;
  },

  /** Reenvía al servidor las ediciones que quedaron en cola. */
  flushOutbox() {
    for (const m of this.outbox.values()) this.send(m);
    this.outbox.clear();
  },

  leave() {
    this.handlers = null;
    this.outbox.clear();
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.ws = null;
    this.id = null;
    this.isHost = false;
    this.peers = new Set();
    this.room = null;
    this.player = null;
  },

  active() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  },
};
