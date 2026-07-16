// Definición de mapas/minijuegos (estilo Roblox: cada mapa es una experiencia).

// ---- Generadores de terreno ----
function terrainHeightAt(world, wx, wz) {
  const n = world.noise.fbm(wx * 0.012, wz * 0.012, 4);
  return Math.max(2, Math.min(CFG.HEIGHT - 10, Math.floor(28 + n * 15)));
}

function plantTree(world, data, x, y, z) {
  const trunkH = 4 + Math.floor(hash2D(x, z, CFG.SEED + 7) * 2);
  for (let i = 0; i < trunkH && y + i < CFG.HEIGHT; i++) {
    data[world.blockIndex(x, y + i, z)] = 5;
  }
  const top = y + trunkH;
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy >= 0 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const ty = top + dy;
        if (ty >= CFG.HEIGHT || (dx === 0 && dz === 0 && dy < 0)) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && hash2D(x + dx, z + dz, ty) < 0.5) continue;
        const idx = world.blockIndex(x + dx, ty, z + dz);
        if (data[idx] === 0) data[idx] = 6;
      }
    }
  }
}

// Relieve extra solo de supervivencia: hunde océanos y levanta montañas
// (el mapa del tesoro sigue usando terrainHeightAt sin cambios).
function survivalHeightAt(world, wx, wz) {
  let h = terrainHeightAt(world, wx, wz);
  const relief = world.noise.fbm(wx * 0.006 - 777.7, wz * 0.006 + 777.7, 2);
  if (relief < -0.08) h -= Math.min(1, (-0.08 - relief) / 0.28) * 16;
  else if (relief > 0.22) h += Math.min(1, (relief - 0.22) / 0.35) * 12;
  return Math.max(2, Math.min(CFG.HEIGHT - 10, Math.floor(h)));
}

// Temperatura del bioma: <-0.28 nevado, >0.18 bosque denso, resto pradera.
function biomeTempAt(world, wx, wz) {
  return world.noise.fbm(wx * 0.005 + 341.7, wz * 0.005 - 127.3, 2);
}

// Cuevas tipo túnel: cerca del cero de dos ruidos combinados.
function caveAt(world, wx, y, wz) {
  const n1 = world.noise.noise(wx * 0.09, wz * 0.09 + y * 0.16);
  const n2 = world.noise.noise(wx * 0.09 + 71.3, y * 0.16 - wz * 0.09);
  return n1 * n1 + n2 * n2 < 0.01;
}

// Mineral según profundidad (0 = piedra normal). Determinista por coordenada.
function oreAt(wx, y, wz) {
  const r = hash2D(wx * 3 + y * 131, wz * 7 - y * 17, CFG.SEED + 99);
  if (y <= 11 && r < 0.004) return 16; // diamante
  if (y <= 16 && r < 0.008) return 8;  // oro
  if (y <= 26 && r < 0.016) return 15; // hierro
  if (r < 0.028) return 14;            // carbón
  return 0;
}

function generateTerrain(world, cx, cz, data) {
  for (let x = 0; x < CFG.CHUNK; x++) {
    for (let z = 0; z < CFG.CHUNK; z++) {
      const wx = cx * CFG.CHUNK + x;
      const wz = cz * CFG.CHUNK + z;
      const h = survivalHeightAt(world, wx, wz);
      const temp = biomeTempAt(world, wx, wz);
      const beach = h <= CFG.SEA_LEVEL + 2;
      const snowy = !beach && (temp < -0.28 || h > 40);
      const rocky = !beach && !snowy && h > 37;
      const forest = !beach && temp > 0.18;

      for (let y = 0; y <= h; y++) {
        let id = 3;
        if (y === h) id = beach ? 4 : snowy ? 18 : rocky ? 3 : 1;
        else if (y >= h - 3) id = beach ? 4 : 2;
        else if (y > 2 && y < h - 4 && caveAt(world, wx, y, wz)) id = 0;
        else if (y > 0) { const ore = oreAt(wx, y, wz); if (ore) id = ore; }
        if (y === 0) id = 3;
        data[world.blockIndex(x, y, z)] = id;
      }
      // Mar: llenar de agua hasta el nivel del mar.
      for (let y = h + 1; y <= CFG.SEA_LEVEL; y++) {
        data[world.blockIndex(x, y, z)] = 17;
      }

      if (h <= CFG.SEA_LEVEL || beach || rocky) continue;
      const treeP = snowy ? 0.004 : forest ? 0.035 : 0.008;
      if (x >= 2 && x <= 13 && z >= 2 && z <= 13 && hash2D(wx, wz, CFG.SEED) < treeP) {
        plantTree(world, data, x, h + 1, z);
      } else if (!snowy) {
        // Flores y hierba alta en la pradera y el bosque.
        const d = hash2D(wx, wz, CFG.SEED + 31);
        if (d < 0.02) data[world.blockIndex(x, h + 1, z)] = 20;
        else if (d < 0.07) data[world.blockIndex(x, h + 1, z)] = 21;
      }
    }
  }
  maybePlaceHeart(world, cx, cz, data, (wx, wz) => survivalHeightAt(world, wx, wz));
}

// Easter egg: bloques corazón. La mitad a la vista sobre la superficie,
// la otra mitad enterrados poco profundo (se encuentran cavando).
function maybePlaceHeart(world, cx, cz, data, heightFn) {
  if (hash2D(cx * 13, cz * 7, CFG.SEED + 777) >= 0.1) return;
  const rx = 2 + Math.floor(hash2D(cx, cz, 21) * 12);
  const rz = 2 + Math.floor(hash2D(cx, cz, 22) * 12);
  const h = heightFn(cx * CFG.CHUNK + rx, cz * CFG.CHUNK + rz);
  const surface = hash2D(cx, cz, 24) < 0.5;
  const y = surface ? h + 1 : h - 2 - Math.floor(hash2D(cx, cz, 23) * 4);
  if (y > 1 && y < CFG.HEIGHT - 1) data[world.blockIndex(rx, y, rz)] = 12;
}

function generateFlat(world, cx, cz, data) {
  for (let x = 0; x < CFG.CHUNK; x++) {
    for (let z = 0; z < CFG.CHUNK; z++) {
      data[world.blockIndex(x, 0, z)] = 3;
      data[world.blockIndex(x, 1, z)] = 2;
      data[world.blockIndex(x, 2, z)] = 2;
      data[world.blockIndex(x, 3, z)] = 1;
    }
  }
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

// ---- Mapas disponibles ----
const MAPS = {
  survival: {
    icon: '🧟', color: '#3a8a3a',
    save: true, zombies: true, animals: true, dayNight: true, hunger: true,
    fallDamage: true, canBuild: true, crafting: true, multiplayer: true,
    minimap: true, thirdPerson: true, ownAvatar: true, // V alterna vista FIFA
    inventory: 'counted', // se junta rompiendo bloques y se gasta al construir
    generate: (game, w, cx, cz, data) => generateTerrain(w, cx, cz, data),
    spawn: { x: 8.5, z: 8.5 },
  },

  creative: {
    icon: '🏗️', color: '#3a6ea0',
    save: true, zombies: false, animals: true, dayNight: false,
    fallDamage: false, canBuild: true, crafting: true, multiplayer: true,
    inventory: 'free',
    hotbar: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 100, 101, 102, 118],
    generate: (game, w, cx, cz, data) => generateFlat(w, cx, cz, data),
    spawn: { x: 8.5, z: 8.5 },
  },

  soccer: {
    icon: '⚽', color: '#2a9a4a',
    save: false, zombies: false, animals: false, dayNight: false,
    fallDamage: false, canBuild: false, crafting: false, multiplayer: true,
    inventory: 'free', hotbar: [],
    thirdPerson: true, defaultView: 'third', // vista FIFA por defecto, V alterna
    generate: (game, w, cx, cz, data) => generateSoccerField(w, cx, cz, data),
    spawn: { x: -6.5, z: 0.5 },
    onClick: (game) => {
      if (!game.state.soccer) return false;
      return game.state.soccer.kick();
    },
    onRightClick: (game) => {
      if (!game.state.soccer) return false;
      return game.state.soccer.slide();
    },
    update: (game, dt) => {
      if (game.state.won) return;
      if (!game.state.soccer) game.state.soccer = new SoccerState(game);
      game.state.elapsed += dt;
      game.state.soccer.update(dt);
    },
    onStop: (game) => {
      if (game.state.soccer) game.state.soccer.dispose();
    },
  },

  race: {
    icon: '🏎️', color: '#c04a4a',
    save: false, zombies: false, animals: false, dayNight: false,
    fallDamage: false, canBuild: false, crafting: false, multiplayer: true,
    inventory: 'free', hotbar: [],
    driving: true, thirdPerson: true, defaultView: 'third',
    generate: (game, w, cx, cz, data) => generateRaceTrack(w, cx, cz, data),
    spawn: () => ({ x: raceRadius(0) + 0.5, z: 2.5 }),
    onClick: (game) => {
      if (!game.state.race) return false;
      return game.state.race.shootLaser(); // clic = láser congelante
    },
    update: (game, dt) => {
      if (game.state.won) return;
      if (!game.state.race) game.state.race = new RaceState(game);
      game.state.race.update(dt); // el cronómetro corre tras la cuenta regresiva
    },
    onStop: (game) => {
      if (game.state.race) game.state.race.dispose();
    },
  },

  parkour: {
    // Recorridos de obstáculos (js/parkour.js): 3 circuitos elegibles con
    // checkpoints, estrellas, salto-pads y récord por circuito.
    icon: '🏃', color: '#a05a2a',
    save: false, zombies: false, animals: false, dayNight: false,
    fallDamage: false, canBuild: false, crafting: false,
    inventory: 'free', hotbar: [],
    variants: [
      { key: 'parkourC1', icon: '🏃' },
      { key: 'parkourC2', icon: '🌋' },
      { key: 'parkourC3', icon: '☁️' },
    ],
    generate: (game, w, cx, cz, data) => generateParkour(game.slot || 1, w, cx, cz, data),
    spawn: (game) => getParkourCourse(game.slot || 1).spawn,
    onVoidFall: (game) => parkourVoidFall(game),
    update: (game, dt) => parkourUpdate(game, dt),
    onStop: (game) => {
      if (game.state.parkour) game.state.parkour.dispose();
    },
  },

  maze: {
    // Laberinto (js/maze.js): muros de 3 de alto, varias rutas con ciclos,
    // 3 estrellas en callejones y meta de oro en el centro. Variante = semilla.
    icon: '🌀', color: '#7a4ac0',
    save: false, zombies: false, animals: false, dayNight: false,
    fallDamage: false, canBuild: false, crafting: false,
    inventory: 'free', hotbar: [],
    variants: [
      { key: 'mazeV1', icon: '🌀' },
      { key: 'mazeV2', icon: '🌪️' },
      { key: 'mazeV3', icon: '🌌' },
    ],
    generate: (game, w, cx, cz, data) => generateMaze(game.slot || 1, w, cx, cz, data),
    spawn: (game) => getMazeLayout(game.slot || 1).spawn,
    update: (game, dt) => mazeUpdate(game, dt),
    onStop: (game) => {
      if (game.state.maze) game.state.maze.dispose();
    },
  },

  treasure: {
    icon: '💰', color: '#b08a2a',
    save: false, zombies: false, animals: false, dayNight: false,
    fallDamage: true, canBuild: true, crafting: false,
    inventory: 'free', hotbar: [1, 2, 3, 4, 5, 6, 7],
    generate: (game, w, cx, cz, data) => generateTreasureWorld(game, w, cx, cz, data),
    spawn: { x: 8.5, z: 8.5 },
    goalCount: 5,
    onBreak: (game, x, y, z, id) => {
      if (id !== 8) return;
      game.state.found++;
      game.state.treasures = game.state.treasures.filter(
        (t) => !(t.x === x && t.y === y && t.z === z)
      );
      if (game.state.found >= MAPS.treasure.goalCount) game.win();
    },
    onSign: (game, pos) => {
      // Clic derecho en un letrero: repetir su pista (dura bastante).
      let best = null, bestD = Infinity;
      for (const s of TREASURE_SIGNS) {
        const d = Math.hypot(s.x - pos.x, s.z - pos.z);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (best) game.ui.toast('🪧 ' + t(best.key), 10000);
    },
    update: (game, dt) => treasureUpdate(game, dt),
    onStop: (game) => game.ui.setHint(''),
  },
};
