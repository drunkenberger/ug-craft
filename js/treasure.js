// Caza del tesoro: mapa aventura con zonas, caminos, túneles y letreros.
// Zonas: pradera (centro), desierto (este, x>26), bosque (oeste, x<-10),
// montaña (norte, z<-10) con túnel principal y un ramal.

// Los 5 tesoros tienen ubicación diseñada (los letreros dicen la verdad).
const TREASURE_SPOTS = [
  { x: 38, z: 8 },              // desierto, al final del camino (enterrado)
  { x: -24, z: 6 },             // bosque, entre los árboles (enterrado)
  { x: 16, z: 8 },              // escondido bajo el propio camino
  { x: 18, y: 25, z: -30 },     // ramal del túnel (a la vista)
  { x: 8, y: 25, z: -43 },      // fondo del túnel (a la vista)
];

const TREASURE_SIGNS = [
  { x: 10, z: 6, key: 'signStart' },
  { x: 24, z: 6, key: 'signDesert' },
  { x: -10, z: 6, key: 'signForest' },
  { x: 10, z: -8, key: 'signMountain' },
  { x: 10, z: -30, key: 'signTunnel', tunnel: true },
];

function treasureHeight(world, wx, wz) {
  let h = terrainHeightAt(world, wx, wz);
  if (wz < -10) h += Math.min(16, (-10 - wz) * 0.8);   // montaña hacia el norte
  if (wx > 26) h = 22 + Math.round((h - 22) * 0.25);   // desierto plano y bajo
  return Math.max(4, Math.min(CFG.HEIGHT - 6, Math.floor(h)));
}

function inTreasureTunnel(wx, wy, wz) {
  if (wy < 25 || wy > 27) return false;
  const main = Math.abs(wx - 8) <= 1 && wz <= -18 && wz >= -44;
  const branch = Math.abs(wz + 30) <= 1 && wx >= 7 && wx <= 19;
  return main || branch;
}

// Rampa de entrada al túnel: baja suave (1 bloque cada 2 de avance) desde
// nivel de superficie (z=-6, piso 30) hasta el piso del túnel (z=-18, piso 24).
function tunnelRampFloor(wz) { return 24 + Math.floor((wz + 18) / 2); }

function inTunnelEntrance(wx, wy, wz) {
  if (Math.abs(wx - 8) > 1 || wz > -6 || wz < -18) return false;
  const floorY = tunnelRampFloor(wz);
  return wy > floorY && wy <= floorY + 14; // hueco abierto hacia el cielo
}

function onTreasurePath(wx, wz) {
  return (wz === 8 && wx >= -28 && wx <= 40) ||  // este-oeste (desierto/bosque)
         (wx === 8 && wz >= -9 && wz <= 7);       // norte (montaña/túnel)
}

function generateTreasureWorld(game, world, cx, cz, data) {
  for (let x = 0; x < CFG.CHUNK; x++) {
    for (let z = 0; z < CFG.CHUNK; z++) {
      const wx = cx * CFG.CHUNK + x;
      const wz = cz * CFG.CHUNK + z;
      const h = treasureHeight(world, wx, wz);
      const desert = wx > 26;
      const sandy = desert || h < 25;
      for (let y = 0; y <= h; y++) {
        if (inTreasureTunnel(wx, y, wz) || inTunnelEntrance(wx, y, wz)) continue; // excavar
        let id = 3;
        if (y === h) id = sandy ? 4 : 1;
        else if (y >= h - 3) id = sandy ? 4 : 2;
        if (y === 0) id = 3;
        data[world.blockIndex(x, y, z)] = id;
      }
      // Camino de madera sobre la superficie.
      if (onTreasurePath(wx, wz) && !inTreasureTunnel(wx, h, wz) &&
          !inTunnelEntrance(wx, h, wz)) {
        data[world.blockIndex(x, h, z)] = 7;
      }
      // Bosque denso al oeste; árboles normales en la pradera; ninguno en desierto.
      const treeChance = wx < -10 ? 0.035 : 0.008;
      if (!sandy && !onTreasurePath(wx, wz) && x >= 2 && x <= 13 && z >= 2 && z <= 13 &&
          hash2D(wx, wz, CFG.SEED) < treeChance) {
        plantTree(world, data, x, h + 1, z);
      }
    }
  }

  const x0 = cx * CFG.CHUNK, z0 = cz * CFG.CHUNK;
  const inChunk = (wx, wz) => wx >= x0 && wx < x0 + CFG.CHUNK && wz >= z0 && wz < z0 + CFG.CHUNK;

  // Letreros con pistas.
  for (const s of TREASURE_SIGNS) {
    if (!inChunk(s.x, s.z)) continue;
    const y = s.tunnel ? 25 : treasureHeight(world, s.x, s.z) + 1;
    data[world.blockIndex(s.x - x0, y, s.z - z0)] = 13;
  }

  // Tesoros de oro.
  for (const t of TREASURE_SPOTS) {
    if (!inChunk(t.x, t.z)) continue;
    const y = t.y !== undefined ? t.y : treasureHeight(world, t.x, t.z) - 2;
    if (world.edits[`${t.x},${y},${t.z}`] === 0) continue; // ya lo sacaron
    data[world.blockIndex(t.x - x0, y, t.z - z0)] = 8;
    if (!game.state.treasures.some((e) => e.x === t.x && e.y === y && e.z === t.z)) {
      game.state.treasures.push({ x: t.x, y, z: t.z });
    }
  }

  maybePlaceHeart(world, cx, cz, data, (wx, wz) => treasureHeight(world, wx, wz));
}

function treasureUpdate(game, dt) {
  if (game.state.won) return;
  game.state.elapsed += dt;
  const p = game.player.pos;

  // Pista visible todo el tiempo que estés cerca de un letrero.
  let signHint = '';
  for (const s of TREASURE_SIGNS) {
    if (Math.hypot(s.x + 0.5 - p.x, s.z + 0.5 - p.z) < 6.5) {
      signHint = '🪧 ' + t(s.key);
      break;
    }
  }
  game.ui.setHint(signHint);

  let nearest = null;
  for (const tr of game.state.treasures) {
    const d = Math.hypot(tr.x - p.x, tr.y - p.y, tr.z - p.z);
    if (nearest === null || d < nearest) nearest = d;
  }
  const cerca = nearest !== null ? ` · ${t('nearest')}: ${Math.round(nearest)}m` : '';
  const m = Math.floor(game.state.elapsed / 60);
  const secs = (game.state.elapsed % 60).toFixed(1).padStart(4, '0');
  game.ui.setInfo(`💰 ${game.state.found}/${MAPS.treasure.goalCount}${cerca} · ⏱ ${m}:${secs}`);
}
