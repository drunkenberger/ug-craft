// Servidor multijugador de EugeCraft (sin dependencias).
// Sirve los archivos del juego por HTTP y sincroniza jugadores por WebSocket.
// Uso: node server.js  → abrir http://<ip-tailscale>:8940 en cada máquina.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const auth = require('./auth');

const PORT = Number(process.env.PORT) || 8940;
const ROOT = __dirname;

// ---- Persistencia de partidas compartidas ----
// Los mapas de PERSIST_MAPS guardan cada partida en worlds/<mapa>__<id>.json, así
// se pueden empezar en una máquina y seguir en otra sin perder mundo ni estado.
// La sala se llama "<mapa>#<id>"; el mundo (edits) es compartido y el estado de
// cada jugador (posición, inventario, vida, hambre) se guarda por nombre.
const WORLDS_DIR = path.join(process.env.EUGECRAFT_DATA_DIR || ROOT, 'worlds');
const PERSIST_MAPS = new Set(['survival', 'creative']);
try { fs.mkdirSync(WORLDS_DIR, { recursive: true }); } catch (e) { /* ya existe */ }

function baseMap(name) { return String(name).split('#')[0]; }
function partId(name) { const i = String(name).indexOf('#'); return i < 0 ? null : name.slice(i + 1); }
function isPersistent(name) { return partId(name) && PERSIST_MAPS.has(baseMap(name)); }
function safe(s) { return String(s).replace(/[^a-z0-9_-]/gi, ''); }
function worldFile(map, id) { return path.join(WORLDS_DIR, `${safe(map)}__${safe(id)}.json`); }

function loadRoomFromDisk(name) {
  try {
    const d = JSON.parse(fs.readFileSync(worldFile(baseMap(name), partId(name)), 'utf8'));
    return {
      name: d.name || '', edits: d.edits || {}, time: d.time ?? null, rules:d.rules || {},
      players: d.players || {}, updated: d.updated || 0,
    };
  } catch (e) {
    return null; // partida sin guardar todavía
  }
}

const saveTimers = new Map(); // sala → timeout (escritura agrupada)

function scheduleSave(name) {
  if (!isPersistent(name) || saveTimers.has(name)) return;
  saveTimers.set(name, setTimeout(() => { saveTimers.delete(name); flushRoom(name); }, 3000));
}

function flushRoom(name) {
  const r = rooms.get(name);
  if (!r || !isPersistent(name)) return;
  try {
    fs.writeFileSync(worldFile(baseMap(name), partId(name)), JSON.stringify({
      name: r.name || '', edits: r.edits, time: r.time, rules:r.rules || {}, players: r.players || {}, updated: Date.now(),
    }));
  } catch (e) {
    console.log(`[!] No se pudo guardar la partida "${name}": ${e.message}`);
  }
}

// Lista las partidas guardadas de un mapa (para el menú).
function listGames(map) {
  const out = [];
  let files = [];
  try { files = fs.readdirSync(WORLDS_DIR); } catch (e) { return out; }
  const prefix = safe(map) + '__';
  for (const f of files) {
    if (!f.startsWith(prefix) || !f.endsWith('.json')) continue;
    const id = f.slice(prefix.length, -5);
    try {
      const d = JSON.parse(fs.readFileSync(path.join(WORLDS_DIR, f), 'utf8'));
      out.push({ id, name: d.name || '', updated: d.updated || 0 });
    } catch (e) { /* archivo corrupto: omitir */ }
  }
  out.sort((a, b) => b.updated - a.updated);
  return out;
}

// Crea una partida nueva (opcionalmente sembrada con un mundo local subido).
function createGame(map, name, edits, time, players, rules={}) {
  const id = Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
  const roomName = `${map}#${id}`;
  rooms.set(roomName, {
    clients: new Map(), hostId: null,
    name: name || '', edits: edits || {}, time: time ?? null, players: players || {},
    rules: {peaceful:rules.peaceful===true,terrainDamage:rules.terrainDamage!==false},
  });
  flushRoom(roomName);
  return { id, name: name || '' };
}

function deleteGame(map, id) {
  const roomName = `${map}#${id}`;
  rooms.delete(roomName);
  try { fs.unlinkSync(worldFile(map, id)); return true; } catch (e) { return false; }
}
// Solo estos archivos se sirven por HTTP (nunca users.json, .secret, worlds/, server.js...).
const PUBLIC_DIRS = new Set(['js', 'css', 'lib']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

// ---- HTTP: API de partidas + archivos estáticos ----
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => {
      let d = {};
      try { d = JSON.parse(body || '{}'); } catch (e) { /* queda vacío */ }
      const r = auth.login(d.user, d.password);
      sendJSON(res, r.error ? (r.error === 'locked' ? 429 : 401) : 200, r);
    });
    return;
  }

  // API de partidas compartidas (solo mapas persistentes).
  if (url.pathname === '/api/games') {
    if (!auth.fromRequest(req)) { sendJSON(res, 401, { error: 'no autorizado' }); return; }
    const map = safe(url.searchParams.get('map') || '');
    if (!PERSIST_MAPS.has(map)) { sendJSON(res, 400, { error: 'mapa inválido' }); return; }

    if (req.method === 'GET') { sendJSON(res, 200, { games: listGames(map) }); return; }

    if (req.method === 'POST') { // crear (opcionalmente sembrada con un mundo local subido)
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 8e6) req.destroy(); });
      req.on('end', () => {
        let d = {};
        try { d = JSON.parse(body || '{}'); } catch (e) { sendJSON(res, 400, { error: 'json inválido' }); return; }
        const existing = listGames(map).length;
        const name = (d.name && String(d.name).slice(0, 40)) || `Partida ${existing + 1}`;
        sendJSON(res, 200, createGame(map, name, d.edits || {}, d.time ?? null, d.players || {}, d.rules || {}));
      });
      return;
    }

    if (req.method === 'DELETE') {
      const id = safe(url.searchParams.get('id') || '');
      sendJSON(res, 200, { ok: id ? deleteGame(map, id) : false });
      return;
    }
    sendJSON(res, 405, { error: 'método no permitido' });
    return;
  }

  let file = decodeURIComponent(url.pathname);
  if (file === '/') file = '/index.html';
  const full = path.join(ROOT, path.normalize(file));
  const rel = path.relative(ROOT, full).split(path.sep);
  if (rel[0].startsWith('..') || !(rel[0] === 'index.html' || PUBLIC_DIRS.has(rel[0]))) { res.writeHead(403); res.end(); return; }
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
  if (!rooms.has(name)) {
    const disk = isPersistent(name) ? loadRoomFromDisk(name) : null;
    rooms.set(name, {
      clients: new Map(), hostId: null,
      name: disk ? disk.name : '',
      edits: disk ? disk.edits : {},
      time: disk ? disk.time : null,
      rules: disk ? disk.rules || {} : {},
      players: disk ? disk.players : {},
    });
  }
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
    const user = auth.verifyToken(msg.token);
    if (!user) { sendTo(sock, { t: 'unauthorized' }); sock.end(); return; }
    state.room = String(msg.room || 'mundo');
    state.player = user.id; // identidad verificada para el estado guardado
    const rm = room(state.room);
    rm.clients.set(state.id, sock);
    if (rm.hostId === null) rm.hostId = state.id;
    sendTo(sock, {
      t: 'welcome', id: state.id, host: rm.hostId === state.id,
      peers: [...rm.clients.keys()].filter((i) => i !== state.id),
      edits: rm.edits, time: rm.time, rules:rm.rules || {},
      pstate: state.player ? (rm.players[state.player] || null) : null, // estado guardado de este jugador
    });
    broadcast(rm, { t: 'peer-join', id: state.id }, state.id);
    console.log(`[+] Jugador ${state.id} entró a "${state.room}" (${rm.clients.size} en línea)`);
    return;
  }
  if (!r) return;

  switch (msg.t) {
    case 'edits': // en minijuegos el anfitrión comparte su mundo; en partidas manda el servidor
      if (!isPersistent(state.room)) Object.assign(r.edits, msg.edits || {});
      break;
    case 'pstate': // estado personal del jugador (pos/inventario/vida/hambre) por partida
      if (isPersistent(state.room) && state.player) {
        r.players[state.player] = msg.state || {};
        scheduleSave(state.room);
      }
      break;
    case 'block':
      r.edits[`${msg.x},${msg.y},${msg.z}`] = msg.id;
      scheduleSave(state.room);
      broadcast(r, msg, state.id);
      break;
    case 'rules':
      if(r.hostId!==state.id) break;
      r.rules={peaceful:msg.rules?.peaceful===true,terrainDamage:msg.rules?.terrainDamage!==false};
      scheduleSave(state.room);broadcast(r,{t:'rules',rules:r.rules},state.id);break;
    case 'time':
      r.time = msg.v;
      scheduleSave(state.room);
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
    case 'petaction':
    case 'petrestore':
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
  if (r.clients.size === 0) {
    if (isPersistent(state.room)) { flushRoom(state.room); rooms.delete(state.room); } // queda en disco
    else rooms.delete(state.room);                                                     // minijuegos: se reinician
  }
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
  if (!Object.keys(auth.readUsers()).length) console.log('[!] No hay usuarios: ejecuta  node crear-usuarios.js  para poder entrar.');
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

// Al apagar, volcar los mundos compartidos pendientes a disco.
process.on('SIGINT', () => {
  for (const name of rooms.keys()) if (isPersistent(name)) flushRoom(name);
  process.exit(0);
});
