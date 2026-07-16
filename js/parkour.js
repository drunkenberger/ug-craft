// Parkour: carreras de obstáculos sobre el vacío con checkpoints, estrellas,
// salto-pads y récord. Hay VARIOS CIRCUITOS (variants del mapa): cada uno se
// construye con su propia función y se cachea por separado.

const PARKOUR_CFG = {
  VOID_Y: 12,   // por debajo de esta altura cuentas como caído al vacío
  COIN_R: 1.2,  // radio para recoger una estrella
  CP_R: 2.0,    // radio para activar un checkpoint
};

// Contexto de construcción compartido por todos los circuitos.
function parkourCtx() {
  const blocks = new Map(); // "x,y,z" -> id (0 = recortar hueco)
  const coins = [];
  const pads = [];
  const checkpoints = [];
  const put = (x, y, z, id) => blocks.set(`${x},${y},${z}`, id);
  const fill = (x0, x1, y0, y1, z0, z1, id) => {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) put(x, y, z, id);
  };
  // Banderín de checkpoint: alfombra de hojas 3×3 + poste de tronco con corazón.
  const flag = (cx, y, cz) => {
    fill(cx - 1, cx + 1, y, y, cz - 1, cz + 1, 6);
    fill(cx + 2, cx + 2, y, y + 3, cz, cz, 5);
    put(cx + 2, y + 4, cz, 12);
    checkpoints.push({ x: cx + 0.5, y: y + 1.1, z: cz + 0.5 });
  };
  // Salto-pad: bloque de oro que lanza hacia arriba.
  const pad = (x, y, z, imp) => {
    put(x, y, z, 8);
    pads.push({ x, y, z, imp });
  };
  // Plaza de salida (piedra con esquinas de arena), común a todos.
  const startPlaza = () => {
    fill(4, 12, 20, 20, 4, 10, 3);
    for (const [x, z] of [[4, 4], [12, 4], [4, 10], [12, 10]]) put(x, 20, z, 4);
  };
  // Cima dorada con arco de meta y corazón.
  const summit = (y, z0, z1) => {
    fill(5, 11, y, y, z0, z1, 8);
    fill(5, 5, y + 1, y + 4, z0 + 4, z0 + 4, 8);
    fill(11, 11, y + 1, y + 4, z0 + 4, z0 + 4, 8);
    fill(5, 11, y + 5, y + 5, z0 + 4, z0 + 4, 8);
    put(8, y + 6, z0 + 4, 12);
    return { zMin: z0 - 1, yMin: y - 1 };
  };
  return { blocks, coins, pads, checkpoints, put, fill, flag, pad, startPlaza, summit };
}

// — Circuito 1 «Clásico»: puente, slalom, torre, pasillo, laberinto, subida —
function buildParkourC1(c) {
  const { put, fill, flag, pad, coins, startPlaza } = c;
  startPlaza();

  for (const [z0, z1] of [[11, 15], [18, 22], [25, 28], [31, 35]]) {
    fill(8, 8, 20, 20, z0, z1, 7); // puente angosto con huecos
  }
  for (const z of [16.5, 23.5, 29.5]) coins.push({ x: 8.5, y: 22.2, z });
  flag(8, 20, 37);

  fill(4, 12, 20, 20, 39, 57, 3); // slalom entre muros
  for (const [x0, x1, z] of [[4, 10, 42], [6, 12, 46], [4, 10, 50], [6, 12, 54]]) {
    fill(x0, x1, 21, 23, z, z, 7);
    fill(x0, x1, 24, 24, z, z, 6);
  }
  coins.push({ x: 5.0, y: 21.9, z: 46.5 });
  coins.push({ x: 11.5, y: 21.9, z: 54.5 });
  flag(8, 20, 59);

  fill(2, 14, 20, 20, 61, 77, 3); // torre: escalera o salto-pad
  fill(5, 11, 21, 27, 66, 72, 3);
  for (let i = 0; i < 7; i++) fill(12, 12, 21, 21 + i, 65 + i, 65 + i, 3);
  pad(8, 20, 63, 22);
  coins.push({ x: 8.5, y: 29.2, z: 68.5 });
  flag(8, 27, 70);

  fill(5, 11, 27, 27, 73, 95, 7); // pasillo alto con huecos
  for (let z = 73; z <= 95; z++) { put(5, 28, z, 6); put(11, 28, z, 6); }
  for (const [z0, z1] of [[78, 79], [84, 85], [90, 91]]) {
    fill(5, 11, 27, 28, z0, z1, 0);
  }
  for (const z of [78.5, 84.5, 90.5]) coins.push({ x: 8.5, y: 29.9, z });
  flag(8, 27, 97);

  fill(7, 9, 27, 27, 99, 99, 7); // mini-laberinto de arena
  fill(1, 15, 27, 27, 100, 114, 4);
  fill(1, 1, 28, 29, 100, 114, 7);
  fill(15, 15, 28, 29, 100, 114, 7);
  fill(1, 15, 28, 29, 100, 100, 7);
  fill(7, 9, 28, 29, 100, 100, 0);
  fill(1, 15, 28, 29, 114, 114, 7);
  fill(7, 9, 28, 29, 114, 114, 0);
  fill(1, 11, 28, 29, 103, 103, 7);
  fill(5, 15, 28, 29, 106, 106, 7);
  fill(1, 11, 28, 29, 109, 109, 7);
  fill(5, 15, 28, 29, 112, 112, 7);
  fill(8, 8, 28, 29, 104, 104, 7);
  fill(8, 8, 28, 29, 110, 110, 7);
  coins.push({ x: 2.5, y: 28.9, z: 101.5 });
  coins.push({ x: 13.5, y: 28.9, z: 113.5 });
  flag(8, 27, 116);

  fill(7, 9, 27, 27, 118, 120, 3); // subida final con salto-pads
  pad(8, 27, 119, 14);
  fill(7, 9, 30, 30, 122, 124, 3);
  pad(8, 30, 123, 14);
  fill(7, 9, 33, 33, 126, 128, 3);
  pad(8, 33, 127, 14);
  coins.push({ x: 8.5, y: 32.5, z: 121.5 });
  coins.push({ x: 8.5, y: 35.5, z: 125.5 });
  coins.push({ x: 8.5, y: 38.5, z: 129.5 });
  const goal = c.summit(36, 130, 137);
  return { spawn: { x: 8.5, y: 21.1, z: 7.5 }, goal };
}

// — Circuito 2 «El Castillo»: patio, murallas, torre y puente almenado —
function buildParkourC2(c) {
  const { put, fill, flag, pad, coins, startPlaza } = c;
  startPlaza();

  // Camino y puerta del castillo (dos torres con arco).
  fill(6, 10, 20, 20, 11, 15, 3);
  fill(5, 5, 21, 24, 16, 17, 3);
  fill(11, 11, 21, 24, 16, 17, 3);
  fill(5, 11, 25, 25, 16, 17, 3);

  // Patio con slalom de columnas (se esquiva caminando, no saltando).
  fill(4, 12, 20, 20, 16, 37, 3);
  for (const [x0, z0] of [[6, 20], [10, 24], [6, 28], [10, 32]]) {
    fill(x0, x0 + 1, 21, 23, z0, z0 + 1, 7);
  }
  coins.push({ x: 8.5, y: 21.9, z: 22.5 });
  coins.push({ x: 8.5, y: 21.9, z: 30.5 });
  flag(8, 20, 39);

  // Rampa de escalones a lo alto de la muralla.
  fill(4, 12, 20, 20, 41, 43, 3);
  for (let i = 0; i < 5; i++) fill(7, 9, 21 + i, 21 + i, 44 + i, 44 + i, 3);

  // Muralla: caminar por lo alto con almenas y dos huecos-trampa.
  fill(7, 9, 25, 25, 49, 67, 3);
  for (let z = 49; z <= 67; z += 2) { put(6, 26, z, 3); put(10, 26, z, 3); } // almenas
  fill(7, 9, 25, 25, 54, 55, 0); // hueco 1
  fill(7, 9, 25, 25, 61, 62, 0); // hueco 2
  coins.push({ x: 8.5, y: 27.4, z: 54.5 });
  coins.push({ x: 8.5, y: 27.4, z: 61.5 });
  flag(8, 25, 69);

  // Torre maciza con dos rampas exteriores (subes rodeándola).
  fill(10, 11, 25, 25, 69, 71, 3);             // conector del banderín a la rampa
  fill(6, 10, 26, 33, 72, 76, 3);              // núcleo
  for (let i = 0; i < 4; i++) fill(11, 11, 26 + i, 26 + i, 72 + i, 72 + i, 3); // rampa este
  fill(10, 11, 29, 29, 76, 77, 3);             // esquina amplia 2×2
  fill(10, 11, 30, 31, 78, 78, 3);             // tope: no pasarse de largo
  for (let i = 0; i < 4; i++) fill(9 - i, 9 - i, 30 + i, 30 + i, 77, 77, 3); // rampa norte
  fill(5, 5, 34, 35, 77, 77, 3);               // tope al final de la rampa
  fill(6, 10, 34, 34, 72, 76, 3);              // azotea
  coins.push({ x: 11.5, y: 30.9, z: 74.5 });
  flag(8, 34, 74);

  // Puente almenado con huecos hacia la sala del tesoro.
  fill(6, 10, 34, 34, 78, 94, 7);
  for (let z = 78; z <= 94; z += 2) { put(5, 35, z, 6); put(11, 35, z, 6); }
  fill(6, 10, 34, 34, 83, 84, 0);
  fill(6, 10, 34, 34, 89, 90, 0);
  coins.push({ x: 8.5, y: 36.4, z: 83.5 });
  coins.push({ x: 8.5, y: 36.4, z: 89.5 });
  flag(8, 34, 96);

  // Chimenea final: salto-pad (+6) hasta la cima dorada del castillo.
  fill(7, 9, 34, 34, 98, 100, 3);
  pad(8, 34, 99, 19);
  coins.push({ x: 8.5, y: 39.5, z: 101.5 });
  const goal = c.summit(40, 103, 110);
  return { spawn: { x: 8.5, y: 21.1, z: 7.5 }, goal };
}

// — Circuito 3 «La Mina»: túneles excavados, galería, rutas y elevador —
function buildParkourC3(c) {
  const { fill, flag, pad, coins, startPlaza } = c;
  startPlaza();

  // Entrada de la mina: bloque macizo con túnel descendente excavado.
  fill(6, 10, 20, 20, 11, 11, 3); // umbral
  fill(5, 11, 13, 24, 12, 25, 3); // roca maciza
  for (let i = 0; i < 6; i++) {
    // Cada tramo baja 1: piso en y=19-i, aire de 4 de alto para pasar.
    fill(7, 9, 20 - i, 23 - i, 12 + i * 2, 13 + i * 2, 0);
    fill(7, 9, 14, 19 - i, 12 + i * 2, 13 + i * 2, 3); // relleno bajo el piso
  }
  fill(7, 9, 15, 18, 24, 25, 0); // boca de salida del túnel hacia la galería
  coins.push({ x: 8.5, y: 17.5, z: 19.5 });

  // Galería con vigas de tronco y huecos-trampa en el piso.
  fill(5, 11, 14, 14, 26, 46, 4);   // piso de arena
  fill(5, 5, 15, 18, 26, 46, 3);    // paredes
  fill(11, 11, 15, 18, 26, 46, 3);
  for (let z = 28; z <= 44; z += 5) fill(5, 11, 18, 18, z, z, 5); // vigas
  fill(6, 10, 14, 14, 31, 32, 0);   // hueco 1 (al vacío → checkpoint)
  fill(6, 10, 14, 14, 38, 39, 0);   // hueco 2
  coins.push({ x: 8.5, y: 16.4, z: 31.5 });
  coins.push({ x: 8.5, y: 16.4, z: 38.5 });
  flag(8, 14, 48);

  // Cruce de rutas: 3 pasillos paralelos con puertas distintas — elige camino.
  fill(3, 13, 14, 14, 51, 65, 4);   // piso
  fill(3, 3, 15, 17, 51, 65, 3);    // muros exteriores
  fill(13, 13, 15, 17, 51, 65, 3);
  fill(3, 13, 15, 17, 51, 51, 3);   // pared de entrada…
  fill(7, 9, 15, 17, 51, 51, 0);    // …con puerta central
  fill(3, 13, 15, 17, 65, 65, 3);   // pared de salida…
  fill(7, 9, 15, 17, 65, 65, 0);    // …con puerta central
  fill(5, 5, 15, 17, 52, 64, 3);    // muro interior oeste
  fill(11, 11, 15, 17, 52, 64, 3);  // muro interior este
  fill(5, 5, 15, 17, 55, 56, 0);    // aberturas para cambiar de pasillo
  fill(11, 11, 15, 17, 59, 60, 0);
  coins.push({ x: 4, y: 16.4, z: 63.5 });  // premio en el pasillo oeste
  coins.push({ x: 12, y: 16.4, z: 53.5 }); // premio en el pasillo este
  flag(8, 14, 67);

  // Elevador minero: pozo vertical con salto-pad (+16) hasta la superficie.
  fill(6, 10, 14, 14, 69, 69, 4);   // tramo de piso hasta la puerta
  fill(5, 11, 14, 29, 70, 76, 3);   // torre maciza
  fill(7, 9, 15, 30, 72, 74, 0);    // pozo excavado
  fill(7, 9, 15, 18, 70, 71, 0);    // puerta de entrada al pozo
  fill(7, 9, 14, 14, 70, 71, 4);    // piso de la puerta
  pad(8, 14, 73, 30);
  fill(4, 12, 30, 30, 69, 77, 3);   // brocal de superficie
  fill(7, 9, 30, 30, 72, 74, 0);    // boca del pozo
  coins.push({ x: 8.5, y: 24, z: 73.5 }); // estrella a medio vuelo
  flag(8, 30, 79);

  // Pasarela de superficie con vigas y huecos hacia la meta.
  fill(6, 10, 30, 30, 81, 97, 7);
  for (let z = 83; z <= 95; z += 4) { fill(6, 6, 31, 33, z, z, 5); fill(10, 10, 31, 33, z, z, 5); }
  fill(6, 10, 30, 30, 86, 87, 0);
  fill(6, 10, 30, 30, 92, 93, 0);
  coins.push({ x: 8.5, y: 32.4, z: 86.5 });
  coins.push({ x: 8.5, y: 32.4, z: 92.5 });

  // Escalones finales a la cima dorada (todo conectado, sin saltos).
  for (let i = 0; i < 4; i++) fill(7, 9, 31 + i, 31 + i, 98 + i * 2, 99 + i * 2, 3);
  const goal = c.summit(34, 106, 113);
  return { spawn: { x: 8.5, y: 21.1, z: 7.5 }, goal };
}

const PARKOUR_BUILDERS = [buildParkourC1, buildParkourC2, buildParkourC3];
const PARKOUR_COURSES = new Map(); // variante → curso construido

function getParkourCourse(variant = 1) {
  const v = Math.min(Math.max(1, variant), PARKOUR_BUILDERS.length);
  if (!PARKOUR_COURSES.has(v)) {
    const ctx = parkourCtx();
    const { spawn, goal } = PARKOUR_BUILDERS[v - 1](ctx);
    PARKOUR_COURSES.set(v, {
      blocks: ctx.blocks, coins: ctx.coins, pads: ctx.pads,
      checkpoints: ctx.checkpoints, spawn, goal,
    });
  }
  return PARKOUR_COURSES.get(v);
}

// Generador por chunk: escribe solo los bloques del circuito que caen dentro.
function generateParkour(variant, world, cx, cz, data) {
  const x0 = cx * CFG.CHUNK, z0 = cz * CFG.CHUNK;
  for (const [k, id] of getParkourCourse(variant).blocks) {
    const [x, y, z] = k.split(',').map(Number);
    if (x >= x0 && x < x0 + CFG.CHUNK && z >= z0 && z < z0 + CFG.CHUNK) {
      data[world.blockIndex(x - x0, y, z - z0)] = id;
    }
  }
}

// Hooks usados por la definición del mapa en maps.js.
function parkourUpdate(game, dt) {
  if (game.state.won) return;
  if (!game.state.parkour) game.state.parkour = new ParkourState(game);
  game.state.elapsed += dt;
  game.state.parkour.update(dt);
}

function parkourVoidFall(game) {
  if (game.state.parkour) game.state.parkour.respawn();
}

class ParkourState {
  constructor(game) {
    this.game = game;
    this.course = getParkourCourse(game.slot || 1);
    this.cp = -1;   // último checkpoint alcanzado (-1 = plaza de salida)
    this.stars = 0;
    this.t = 0;
    this.coins = this.course.coins.map((c) => {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32),
        new THREE.MeshBasicMaterial({ color: 0xffd24a })
      );
      mesh.position.set(c.x, c.y, c.z);
      game.scene.add(mesh);
      return { mesh, base: c.y, taken: false };
    });
    this.total = this.coins.length;
    game.ui.toast(t('parkourHint'), 6000);
  }

  // Reaparecer en el último checkpoint (o en la salida).
  respawn() {
    const p = this.cp >= 0 ? this.course.checkpoints[this.cp] : this.course.spawn;
    this.game.player.pos.set(p.x, p.y, p.z);
    this.game.player.vel.set(0, 0, 0);
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;

    // Estrellas: giran, flotan y se recogen por cercanía al torso.
    const tx = p.pos.x, ty = p.pos.y + 0.9, tz = p.pos.z;
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2.5;
      c.mesh.position.y = c.base + Math.sin(this.t * 2 + c.base) * 0.12;
      const d = Math.hypot(c.mesh.position.x - tx, c.mesh.position.y - ty, c.mesh.position.z - tz);
      if (d < PARKOUR_CFG.COIN_R) {
        c.taken = true;
        c.mesh.visible = false;
        this.stars++;
        g.ui.toast(`⭐ ${t('parkourStar')} ${this.stars}/${this.total}`);
      }
    }

    // Checkpoints: al alcanzar uno nuevo se vuelve tu punto de reaparición.
    const cps = this.course.checkpoints;
    for (let i = this.cp + 1; i < cps.length; i++) {
      const c = cps[i];
      if (Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < PARKOUR_CFG.CP_R &&
          Math.abs(c.y - p.pos.y) < 2) {
        this.cp = i;
        g.ui.toast(`🚩 ${t('parkourCheckpoint')} ${i + 1}/${cps.length}`);
      }
    }

    // Salto-pads: pisar un bloque dorado del piso te lanza hacia arriba.
    if (p.onGround) {
      const bx = Math.floor(p.pos.x), by = Math.floor(p.pos.y - 0.2), bz = Math.floor(p.pos.z);
      for (const pad of this.course.pads) {
        if (pad.x === bx && pad.y === by && pad.z === bz) {
          p.vel.y = pad.imp;
          g.ui.toast(t('parkourBoing'), 1200);
        }
      }
    }

    // Caída al vacío → de vuelta al último checkpoint.
    if (p.pos.y < PARKOUR_CFG.VOID_Y) {
      this.respawn();
      g.ui.toast(t('parkourFall'));
      return;
    }

    // Meta: pisar el oro de la cima.
    const under = g.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.2), Math.floor(p.pos.z));
    if (under === 8 && p.onGround &&
        p.pos.z > this.course.goal.zMin && p.pos.y > this.course.goal.yMin) {
      g.win();
      // Añadir las estrellas juntadas a la pantalla de victoria.
      document.getElementById('win-time').textContent += ` · ⭐ ${this.stars}/${this.total}`;
      return;
    }

    g.ui.setInfo(
      `⏱ ${fmtTime(g.state.elapsed)} · ⭐ ${this.stars}/${this.total}` +
      ` · 🚩 ${this.cp + 1}/${cps.length}`
    );
  }

  dispose() {
    for (const c of this.coins) {
      this.game.scene.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh.material.dispose();
    }
    this.coins = [];
  }
}
