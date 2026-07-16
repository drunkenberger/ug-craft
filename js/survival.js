// Sistemas de supervivencia/creativo: antorchas con luz y retoños que crecen.
// Ambos viven en las ediciones del mundo, así que persisten con la partida.

function saplingEntry(x, y, z) {
  return { x, y, z, t: 15 + Math.random() * 20 }; // segundos hasta crecer
}

// Al cargar una partida: reconstruir antorchas y retoños desde las ediciones.
function scanWorldExtras(game) {
  game.torches = new Set();
  game.saplings = [];
  for (const [k, id] of Object.entries(game.world.edits)) {
    const [x, y, z] = k.split(',').map(Number);
    if (id === 19) game.torches.add(k);
    if (id === 22) game.saplings.push(saplingEntry(x, y, z));
  }
}

// Registrar cambios de bloque que nos importan (propios o llegados por red).
function trackBlockChange(game, x, y, z, id) {
  const k = `${x},${y},${z}`;
  if (id === 19) game.torches.add(k);
  else game.torches.delete(k);
  game.saplings = game.saplings.filter((s) => s.x !== x || s.y !== y || s.z !== z);
  if (id === 22) game.saplings.push(saplingEntry(x, y, z));
}

// Pool de luces: se reparten entre las antorchas más cercanas al jugador.
function initTorchLights(game) {
  game.torchLights = [];
  for (let i = 0; i < 6; i++) {
    const light = new THREE.PointLight(0xffb347, 0, 9);
    game.scene.add(light);
    game.torchLights.push(light);
  }
  game.torchTimer = 0;
}

function updateTorchLights(game, dt) {
  game.torchTimer -= dt;
  if (game.torchTimer > 0) return;
  game.torchTimer = 0.4;
  const p = game.player.pos;
  const near = [];
  for (const k of game.torches) {
    const [x, y, z] = k.split(',').map(Number);
    const d = Math.hypot(x + 0.5 - p.x, y - p.y, z + 0.5 - p.z);
    if (d < 26) near.push({ x, y, z, d });
  }
  near.sort((a, b) => a.d - b.d);
  game.torchLights.forEach((light, i) => {
    const tch = near[i];
    if (tch) {
      light.position.set(tch.x + 0.5, tch.y + 0.7, tch.z + 0.5);
      light.intensity = 1.1;
    } else {
      light.intensity = 0;
    }
  });
}

function updateSaplings(game, dt) {
  if (!game.saplings.length) return;
  for (const s of game.saplings) {
    s.t -= dt;
    if (s.t <= 0 && game.world.getBlock(s.x, s.y, s.z) === 22) {
      growTreeAt(game, s.x, s.y, s.z);
    }
  }
  game.saplings = game.saplings.filter((s) => s.t > 0);
}

// Convierte un retoño en árbol usando ediciones (persiste y se sincroniza).
function growTreeAt(game, x, y, z) {
  const w = game.world;
  const put = (bx, by, bz, id) => {
    if (by <= 0 || by >= CFG.HEIGHT) return;
    const cur = w.getBlock(bx, by, bz);
    if (cur !== 0 && cur !== 22 && cur !== 21 && cur !== 20) return; // no aplastar nada sólido
    w.setBlock(bx, by, bz, id);
    if (game.net) NET.send({ t: 'block', x: bx, y: by, z: bz, id });
  };
  const trunkH = 4;
  for (let i = 0; i < trunkH; i++) put(x, y + i, z, 5);
  const top = y + trunkH;
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy >= 0 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy < 0) continue;
        put(x + dx, top + dy, z + dz, 6);
      }
    }
  }
}
