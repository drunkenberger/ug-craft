// Servidor multijugador de EugeCraft (sin dependencias).
// Sirve los archivos del juego por HTTP y sincroniza jugadores por WebSocket.
// Uso: node server.js  → abrir http://<ip-tailscale>:8940 en cada máquina.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 8940;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---- HTTP: archivos estáticos ----
const server = http.createServer((req, res) => {
  let file = decodeURIComponent(req.url.split('?')[0]);
  if (file === '/') file = '/index.html';
  const full = path.join(ROOT, path.normalize(file));
  if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('No encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
      'Cache-Control': 'no-store', // siempre servir la versión más reciente del juego
    });
    res.end(data);
  });
});

// ---- WebSocket (RFC 6455, frames de texto) ----
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function wsEncode(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

// Decodifica todos los frames completos del buffer; devuelve [mensajes, resto].
function wsDecode(buf) {
  const messages = [];
  while (buf.length >= 2) {
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let off = 2;
    if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
    const maskLen = masked ? 4 : 0;
    if (buf.length < off + maskLen + len) break;
    const mask = masked ? buf.slice(off, off + 4) : null;
    const payload = buf.slice(off + maskLen, off + maskLen + len);
    if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    if (opcode === 0x8) messages.push(null);                    // close
    else if (opcode === 0x1) messages.push(payload.toString('utf8'));
    // opcode 0x9 (ping) → responder pong lo maneja el caller con 'ping' especial
    else if (opcode === 0x9) messages.push({ ping: payload });
    buf = buf.slice(off + maskLen + len);
  }
  return [messages, buf];
}

// ---- Salas ----
let nextId = 1;
const rooms = new Map(); // nombre → { clients: Map(id→socket), hostId, edits, time }

function room(name) {
  if (!rooms.has(name)) rooms.set(name, { clients: new Map(), hostId: null, edits: {}, time: null });
  return rooms.get(name);
}

function sendTo(sock, obj) {
  try { sock.write(wsEncode(JSON.stringify(obj))); } catch (e) { /* socket cerrado */ }
}

function broadcast(r, obj, exceptId) {
  for (const [id, sock] of r.clients) {
    if (id !== exceptId) sendTo(sock, obj);
  }
}

function handleMessage(sock, state, msg) {
  const r = state.room ? rooms.get(state.room) : null;

  if (msg.t === 'join') {
    state.room = String(msg.room || 'mundo');
    const rm = room(state.room);
    rm.clients.set(state.id, sock);
    if (rm.hostId === null) rm.hostId = state.id;
    sendTo(sock, {
      t: 'welcome', id: state.id, host: rm.hostId === state.id,
      peers: [...rm.clients.keys()].filter((i) => i !== state.id),
      edits: rm.edits, time: rm.time,
    });
    broadcast(rm, { t: 'peer-join', id: state.id }, state.id);
    console.log(`[+] Jugador ${state.id} entró a "${state.room}" (${rm.clients.size} en línea)`);
    return;
  }
  if (!r) return;

  switch (msg.t) {
    case 'edits': // el anfitrión sube su mundo guardado al crear la sala
      Object.assign(r.edits, msg.edits || {});
      break;
    case 'block':
      r.edits[`${msg.x},${msg.y},${msg.z}`] = msg.id;
      broadcast(r, msg, state.id);
      break;
    case 'time':
      r.time = msg.v;
      broadcast(r, msg, state.id);
      break;
    case 'pos':
    case 'skin':
    case 'mobs':
    case 'bolt':
    case 'ball':
    case 'score':
    case 'racestart':
    case 'racewin':
    case 'raceprog':
    case 'laser':
      msg.from = state.id;
      broadcast(r, msg, state.id);
      break;
    case 'freeze': { // láser congelante dirigido a un jugador
      const target = r.clients.get(msg.to);
      if (target) sendTo(target, msg);
      break;
    }
    case 'hit':    // golpe a un mob: solo lo procesa el anfitrión
    case 'tame':   // adopción de un perro: la aplica el anfitrión
    case 'kick':   // patada al balón (fútbol)
    case 'slide': { // barrida (fútbol)
      msg.from = state.id;
      const host = r.clients.get(r.hostId);
      if (host && r.hostId !== state.id) sendTo(host, msg);
      break;
    }
    case 'dmg':
    case 'drop': { // mensajes dirigidos a un jugador específico
      const target = r.clients.get(msg.to);
      if (target) sendTo(target, msg);
      break;
    }
  }
}

function handleDisconnect(state) {
  if (state.gone) return; // 'close' y 'error' pueden dispararse ambos
  state.gone = true;
  if (!state.room) return;
  const r = rooms.get(state.room);
  if (!r) return;
  r.clients.delete(state.id);
  broadcast(r, { t: 'peer-leave', id: state.id });
  console.log(`[-] Jugador ${state.id} salió de "${state.room}" (${r.clients.size} en línea)`);
  if (r.hostId === state.id) {
    r.hostId = r.clients.keys().next().value ?? null;
    if (r.hostId !== null) broadcast(r, { t: 'host', id: r.hostId });
  }
  if (r.clients.size === 0) rooms.delete(state.room); // el mundo vive en el guardado del anfitrión
}

// Latido: ping cada 5 s; si un cliente no responde en 15 s se purga
// (evita "fantasmas" que quedan como anfitrión cuando una máquina se
// desconecta sin avisar: tablet dormida, WiFi/Tailscale caído, etc.).
const sockets = new Set();
const PING = Buffer.from([0x89, 0x00]);
setInterval(() => {
  const now = Date.now();
  for (const entry of sockets) {
    const { sock, state } = entry;
    if (state.gone || now - state.lastSeen > 15000) {
      sockets.delete(entry);
      if (!state.gone) {
        console.log(`[!] Jugador ${state.id} sin respuesta, purgado`);
        handleDisconnect(state);
        sock.destroy();
      }
      continue;
    }
    try { sock.write(PING); } catch (e) { /* se purgará en el próximo ciclo */ }
  }
}, 5000);

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  sock.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${wsAccept(key)}\r\n\r\n`
  );
  const state = { id: nextId++, room: null, gone: false, lastSeen: Date.now() };
  sockets.add({ sock, state });
  let buffer = Buffer.alloc(0);

  sock.on('data', (chunk) => {
    state.lastSeen = Date.now();
    buffer = Buffer.concat([buffer, chunk]);
    const [messages, rest] = wsDecode(buffer);
    buffer = rest;
    for (const m of messages) {
      if (m === null) { sock.end(); return; }
      if (typeof m === 'object' && m.ping) { // pong
        const pong = Buffer.concat([Buffer.from([0x8a, m.ping.length]), m.ping]);
        sock.write(pong);
        continue;
      }
      try { handleMessage(sock, state, JSON.parse(m)); } catch (e) { /* mensaje inválido */ }
    }
  });
  sock.on('close', () => handleDisconnect(state));
  sock.on('error', () => handleDisconnect(state));
});

server.listen(PORT, () => {
  console.log('');
  console.log('⛏️  EugeCraft multijugador listo. Direcciones para entrar:');
  console.log(`   En esta máquina:  http://localhost:${PORT}`);
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) {
        const tag = a.address.startsWith('100.') ? '  ← usa esta desde Tailscale' : '';
        console.log(`   Desde otra máquina: http://${a.address}:${PORT}${tag}`);
      }
    }
  }
  console.log('');
  console.log('   Deja esta ventana abierta mientras juegan. Ctrl+C para apagar.');
});
