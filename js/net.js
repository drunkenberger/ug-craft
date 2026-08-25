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
    this.ws = new WebSocket(`${proto}//${location.host}`);
    this.ws.onopen = () => this.send({ t: 'join', room: this.room, player: this.player });
    this.ws.onmessage = (e) => {
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
    this.ws.onclose = () => {
      if (this.handlers && this.handlers.closed) this.handlers.closed();
      if (this.handlers) {
        this.retryTimer = setTimeout(() => this.connect(), 2000);
      }
    };
  },

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  },

  leave() {
    this.handlers = null;
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
