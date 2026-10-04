// Login, tokens, API protegida, WebSocket autenticado y archivos privados (servidor real en otro puerto).
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eugecraft-auth-'));
process.env.EUGECRAFT_DATA_DIR = dir;
const auth = require('../auth');
auth.setUser('Andres', 'lobo-luna-42');
const PORT = 8950 + Math.floor(Math.random() * 40);
const base = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (user, password) => fetch(`${base}/api/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, password }),
});
const joinWs = (token) => new Promise((resolve) => {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const got = [];
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room: 'parkour', token }));
  ws.onmessage = (e) => got.push(JSON.parse(e.data).t);
  setTimeout(() => { ws.close(); resolve(got); }, 400);
});

(async () => {
  try {
    for (let i = 0; i < 30; i++) { try { await fetch(base); break; } catch (e) { await sleep(100); } }

    assert.equal((await fetch(`${base}/api/games?map=survival`)).status, 401);
    assert.equal((await post('andres', 'mal')).status, 401);
    const ok = await post('Andres', 'lobo-luna-42');
    assert.equal(ok.status, 200);
    const { token, id } = await ok.json();
    assert.equal(id, 'andres');

    const games = await fetch(`${base}/api/games?map=survival`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(games.status, 200);
    assert.equal((await fetch(`${base}/api/games?map=survival`, { headers: { Authorization: `Bearer ${token}x` } })).status, 401);

    assert.deepEqual(await joinWs('basura'), ['unauthorized']);
    assert.deepEqual(await joinWs(token), ['welcome']);

    for (const f of ['users.json', '.secret', 'server.js', 'auth.js', 'worlds/x.json', '../etc/passwd']) {
      assert.equal((await fetch(`${base}/${f}`)).status === 200, false, f);
    }
    assert.equal((await fetch(`${base}/js/auth.js`)).status, 200);

    for (let i = 0; i < 5; i++) await post('andres', 'mal');
    assert.equal((await post('andres', 'lobo-luna-42')).status, 429); // bloqueo tras 5 fallos
    console.log('Auth tests passed');
  } catch (e) {
    console.error(e); process.exitCode = 1;
  } finally {
    server.kill(); fs.rmSync(dir, { recursive: true, force: true });
  }
})();
