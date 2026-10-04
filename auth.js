// Usuarios y sesiones del servidor (sin dependencias).
// users.json: { "<id>": { name, salt, hash } } (scrypt). Las sesiones son tokens firmados con HMAC.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.EUGECRAFT_DATA_DIR || __dirname;
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, '.secret');
const TOKEN_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_MS = 60000;

const fails = new Map(); // id → { n, until }

function userId(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20); }

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) { return {}; }
}

function secret() {
  try { return fs.readFileSync(SECRET_FILE, 'utf8').trim(); } catch (e) { /* se crea abajo */ }
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
  return s;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

/** Crea o reemplaza un usuario en users.json. */
function setUser(name, password) {
  const id = userId(name);
  if (!id || !password) throw new Error('usuario o contraseña vacíos');
  const users = readUsers();
  const salt = crypto.randomBytes(16).toString('hex');
  users[id] = { name: String(name).trim().slice(0, 20), salt, hash: hashPassword(password, salt) };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 });
  return id;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Comprueba usuario y contraseña. Devuelve { token, id, name } o { error }. */
function login(user, password) {
  const id = userId(user);
  const f = fails.get(id);
  if (f && f.until > Date.now()) return { error: 'locked' };
  const u = readUsers()[id];
  const ok = u && crypto.timingSafeEqual(
    Buffer.from(hashPassword(password, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
  if (!ok) {
    const expired = f && f.until && f.until <= Date.now();
    const n = (f && !expired ? f.n : 0) + 1;
    fails.set(id, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    return { error: 'invalid' };
  }
  fails.delete(id);
  const exp = Date.now() + TOKEN_DAYS * 864e5;
  const payload = `${id}.${exp}`;
  return { token: `${payload}.${sign(payload)}`, id, name: u.name };
}

/** Valida un token; devuelve { id, name } o null. */
function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const good = sign(`${id}.${exp}`);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  if (Number(exp) < Date.now()) return null;
  const u = readUsers()[id];
  return u ? { id, name: u.name } : null;
}

/** Usuario de una petición HTTP (cabecera Authorization: Bearer). */
function fromRequest(req) {
  const h = req.headers.authorization || '';
  return verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
}

module.exports = { userId, setUser, login, verifyToken, fromRequest, readUsers };
