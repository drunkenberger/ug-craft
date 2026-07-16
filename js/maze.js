// Laberinto 🌀: rejilla de celdas de 3×3 bloques con muros de piedra de 3 de
// alto (no se pueden brincar). Se genera con semilla por variante (recursive
// backtracker) y luego se tumban ~14% de los muros internos para crear ciclos
// y varias rutas. Meta: la cámara central con piso de ORO. 3 estrellas
// escondidas en callejones sin salida. Anillo exterior de arena con torres
// doradas en las esquinas para orientarse.

const MAZE_CFG = {
  SIZES: { 1: 13, 2: 15, 3: 17 }, // celdas por lado según la variante
  STAR_R: 1.2,                    // radio para recoger una estrella
  RING: 3,                        // ancho del anillo exterior de arena
};

const MAZE_CACHE = {}; // variante → { blocks, stars, spawn, extra, n }

function getMazeLayout(variant) {
  if (MAZE_CACHE[variant]) return MAZE_CACHE[variant];
  const n = MAZE_CFG.SIZES[variant] || 13;
  const rnd = mulberry32(100 + variant * 31);
  const mid = Math.floor(n / 2), c = mid; // celda de entrada (sur) y meta (centro)

  // — Laberinto perfecto con recursive backtracker —
  // wallE[i][j]: muro entre (i,j) y (i+1,j) · wallS[i][j]: entre (i,j) y (i,j+1)
  const wallE = Array.from({ length: n - 1 }, () => Array(n).fill(true));
  const wallS = Array.from({ length: n }, () => Array(n - 1).fill(true));
  const seen = Array.from({ length: n }, () => Array(n).fill(false));
  const stack = [[mid, n - 1]];
  seen[mid][n - 1] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([di, dj]) => [i + di, j + dj])
      .filter(([ni, nj]) => ni >= 0 && ni < n && nj >= 0 && nj < n && !seen[ni][nj]);
    if (!opts.length) { stack.pop(); continue; }
    const [ni, nj] = opts[Math.floor(rnd() * opts.length)];
    if (ni !== i) wallE[Math.min(i, ni)][j] = false;
    else wallS[i][Math.min(j, nj)] = false;
    seen[ni][nj] = true;
    stack.push([ni, nj]);
  }

  // — Tumbar ~14% de los muros internos restantes → ciclos y rutas alternas —
  const rest = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n; j++) if (wallE[i][j]) rest.push(['E', i, j]);
  for (let i = 0; i < n; i++) for (let j = 0; j < n - 1; j++) if (wallS[i][j]) rest.push(['S', i, j]);
  const extra = Math.round(rest.length * 0.14);
  for (let k = 0; k < extra; k++) {
    const [tp, i, j] = rest.splice(Math.floor(rnd() * rest.length), 1)[0];
    if (tp === 'E') wallE[i][j] = false; else wallS[i][j] = false;
  }

  // — Estrellas: 3 callejones sin salida bien repartidos —
  const deg = (i, j) =>
    (i > 0 && !wallE[i - 1][j]) + (i < n - 1 && !wallE[i][j]) +
    (j > 0 && !wallS[i][j - 1]) + (j < n - 1 && !wallS[i][j]);
  let ends = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (deg(i, j) === 1 && !(i === c && j === c) && !(i === mid && j === n - 1)) ends.push([i, j]);
  }
  const picks = [ends.splice(Math.floor(rnd() * ends.length), 1)[0]];
  while (picks.length < 3 && ends.length) {
    let best = 0, bestD = -1; // el callejón más lejano a los ya elegidos
    ends.forEach(([i, j], k) => {
      const d = Math.min(...picks.map(([pi, pj]) => Math.hypot(i - pi, j - pj)));
      if (d > bestD) { bestD = d; best = k; }
    });
    picks.push(ends.splice(best, 1)[0]);
  }

  // — Construcción en bloques (centrado en el origen, piso y=3, muros y=4..6) —
  const T = n * 4 + 1, R = MAZE_CFG.RING, o = -Math.floor(T / 2);
  const blocks = new Map();
  const put = (x, y, z, id) => blocks.set(`${x},${y},${z}`, id);
  const wallCol = (gx, gz, id = 3) => { for (let y = 4; y <= 6; y++) put(o + gx, y, o + gz, id); };

  for (let gx = -R; gx < T + R; gx++) {
    for (let gz = -R; gz < T + R; gz++) {
      const inside = gx >= 0 && gx < T && gz >= 0 && gz < T;
      put(o + gx, 3, o + gz, inside ? 1 : 4); // pasto adentro, arena en el anillo
      if (gx === -R || gx === T + R - 1 || gz === -R || gz === T + R - 1) wallCol(gx, gz); // barda
    }
  }
  for (const [tx, tz] of [[-R, -R], [T + R - 1, -R], [-R, T + R - 1], [T + R - 1, T + R - 1]]) {
    for (let y = 4; y <= 12; y++) put(o + tx, y, o + tz, 8); // torres-faro de oro
  }
  for (let gi = 0; gi <= n; gi++) for (let gj = 0; gj <= n; gj++) wallCol(gi * 4, gj * 4); // postes
  for (let k = 0; k < T; k++) { wallCol(0, k); wallCol(n * 4, k); wallCol(k, 0); wallCol(k, n * 4); } // borde
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n; j++) {
    if (wallE[i][j]) for (let s = 1; s <= 3; s++) wallCol((i + 1) * 4, j * 4 + s);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n - 1; j++) {
    if (wallS[i][j]) for (let s = 1; s <= 3; s++) wallCol(i * 4 + s, (j + 1) * 4);
  }
  for (let s = 1; s <= 3; s++) for (let y = 4; y <= 6; y++) {
    blocks.delete(`${o + mid * 4 + s},${y},${o + n * 4}`); // abrir la entrada sur
  }
  for (const gx of [mid * 4, (mid + 1) * 4]) { // arco de entrada con travesaño dorado
    put(o + gx, 7, o + n * 4, 7); put(o + gx, 8, o + n * 4, 7);
  }
  for (let s = 0; s <= 4; s++) put(o + mid * 4 + s, 9, o + n * 4, 8);
  for (let s = 1; s <= 3; s++) for (let u = 1; u <= 3; u++) put(o + c * 4 + s, 3, o + c * 4 + u, 8); // meta
  for (const [gx, gz] of [[c * 4, c * 4], [(c + 1) * 4, c * 4], [c * 4, (c + 1) * 4], [(c + 1) * 4, (c + 1) * 4]]) {
    put(o + gx, 7, o + gz, 8); // marcadores dorados sobre los postes de la meta
  }

  const stars = picks.map(([i, j]) => ({ x: o + i * 4 + 2.5, y: 5.0, z: o + j * 4 + 2.5 }));
  MAZE_CACHE[variant] = {
    blocks, stars, extra, n,
    spawn: { x: o + mid * 4 + 2.5, y: 4.1, z: o + n * 4 + 1.5 },
  };
  return MAZE_CACHE[variant];
}

// Generador por chunk: escribe solo los bloques del laberinto que caen dentro.
function generateMaze(variant, world, cx, cz, data) {
  const x0 = cx * CFG.CHUNK, z0 = cz * CFG.CHUNK;
  for (const [k, id] of getMazeLayout(variant).blocks) {
    const [x, y, z] = k.split(',').map(Number);
    if (x >= x0 && x < x0 + CFG.CHUNK && z >= z0 && z < z0 + CFG.CHUNK) {
      data[world.blockIndex(x - x0, y, z - z0)] = id;
    }
  }
}

// Hooks usados por la definición del mapa en maps.js.
function mazeUpdate(game, dt) {
  if (game.state.won) return;
  if (!game.state.maze) game.state.maze = new MazeState(game);
  game.state.elapsed += dt;
  game.state.maze.update(dt);
}

class MazeState {
  constructor(game) {
    this.game = game;
    this.layout = getMazeLayout(game.slot || 1);
    this.found = 0;
    this.t = 0;
    this.stars = this.layout.stars.map((s) => {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32),
        new THREE.MeshBasicMaterial({ color: 0xffd24a })
      );
      mesh.position.set(s.x, s.y, s.z);
      game.scene.add(mesh);
      return { mesh, base: s.y, taken: false };
    });
    this.total = this.stars.length;
    game.ui.toast(t('mazeHint'), 7000);
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;

    // Estrellas: giran, flotan y se recogen por cercanía al torso.
    const tx = p.pos.x, ty = p.pos.y + 0.9, tz = p.pos.z;
    for (const s of this.stars) {
      if (s.taken) continue;
      s.mesh.rotation.y += dt * 2.5;
      s.mesh.position.y = s.base + Math.sin(this.t * 2 + s.base) * 0.12;
      const d = Math.hypot(s.mesh.position.x - tx, s.mesh.position.y - ty, s.mesh.position.z - tz);
      if (d < MAZE_CFG.STAR_R) {
        s.taken = true;
        s.mesh.visible = false;
        this.found++;
        g.ui.toast(`⭐ ${t('mazeStar')} ${this.found}/${this.total}`);
      }
    }

    // Seguro: si algo sale mal y caes del mundo, de vuelta a la entrada.
    if (p.pos.y < 1) {
      p.pos.set(this.layout.spawn.x, this.layout.spawn.y, this.layout.spawn.z);
      p.vel.set(0, 0, 0);
    }

    // Meta: pararse sobre el piso de oro de la cámara central.
    const under = g.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.2), Math.floor(p.pos.z));
    if (under === 8 && p.onGround) {
      g.win();
      document.getElementById('win-time').textContent += ` · ⭐ ${this.found}/${this.total}`;
      return;
    }

    g.ui.setInfo(`⏱ ${fmtTime(g.state.elapsed)} · ⭐ ${this.found}/${this.total}`);
  }

  dispose() {
    for (const s of this.stars) {
      this.game.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    }
    this.stars = [];
  }
}
