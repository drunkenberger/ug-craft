// Sistemas de supervivencia/creativo: antorchas con luz y retoños que crecen.
// Ambos viven en las ediciones del mundo, así que persisten con la partida.

function saplingEntry(x, y, z) {
  return { x, y, z, t: 15 + Math.random() * 20 }; // segundos hasta crecer
}

// Al cargar una partida: reconstruir antorchas y retoños desde las ediciones.
function scanWorldExtras(game) {
  game.torches = new Set();
  game.saplings = [];
  game.tntFuses = new Map();
  for (const [k, id] of Object.entries(game.world.edits)) {
    const [x, y, z] = k.split(',').map(Number);
    if (BLOCKS[id] && BLOCKS[id].light) game.torches.add(k);
    if (id === 40) game.tntFuses.set(k, 4);
    if (id === 22) game.saplings.push(saplingEntry(x, y, z));
  }
}

// Registrar cambios de bloque que nos importan (propios o llegados por red).
function trackBlockChange(game, x, y, z, id) {
  const k = `${x},${y},${z}`;
  game.adventure?.cropTimers.delete(k);
  if (id === 0 && game.tntFuses.has(k)) game.adventure?.fx.burst(x,y,z);
  if (id === 40) game.tntFuses.set(k, 4);
  else game.tntFuses.delete(k);
  if (BLOCKS[id] && BLOCKS[id].light) game.torches.add(k);
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
  const lights = new Set(game.torches);
  // Incluir faroles de aldeas generadas, que no son ediciones del jugador.
  for (let x=Math.floor(p.x)-8;x<=Math.floor(p.x)+8;x++)
    for (let z=Math.floor(p.z)-8;z<=Math.floor(p.z)+8;z++)
      for (let y=Math.max(1,Math.floor(p.y)-4);y<=Math.min(CFG.HEIGHT-1,Math.floor(p.y)+4);y++) {
        const def=BLOCKS[game.world.getBlock(x,y,z)];
        if (def && def.light) lights.add(`${x},${y},${z}`);
      }
  for (const k of lights) {
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

// La TNT encendida es un bloque persistible; solo el anfitrión simula la mecha.
function lightTnt(game, pos) {
  const {x,y,z}=pos;
  if (game.world.getBlock(x,y,z)!==33) return;
  changeExplosiveBlock(game,x,y,z,40);
  game.ui.toast(t('tntLit'),4000);
}
function changeExplosiveBlock(game,x,y,z,id) {
  game.world.setBlock(x,y,z,id);
  trackBlockChange(game,x,y,z,id);
  if (game.net) NET.send({t:'block',x,y,z,id});
}
function updateTnt(game,dt) {
  if (game.net && !NET.isHost) return;
  // Copia: las explosiones en cadena quedan para la siguiente actualización.
  for (const [key,time] of [...game.tntFuses]) {
    const [x,y,z]=key.split(',').map(Number);
    game.world.ensureChunkData(Math.floor(x/CFG.CHUNK),Math.floor(z/CFG.CHUNK));
    if (game.world.getBlock(x,y,z)!==40) { game.tntFuses.delete(key); continue; }
    if (time>dt) { game.tntFuses.set(key,time-dt); continue; }
    game.tntFuses.delete(key);
    explodeTnt(game,x,y,z);
  }
}
function explodeTnt(game,x,y,z) {
  game.adventure?.fx.burst(x,y,z);
  const w=game.world;
  w.batchEdit(() => {
    changeExplosiveBlock(game,x,y,z,0);
    if(game.worldRules?.terrainDamage !== false) for (let dx=-3;dx<=3;dx++) for (let dy=-3;dy<=3;dy++) for (let dz=-3;dz<=3;dz++) {
      if (dx*dx+dy*dy+dz*dz>9 || y+dy<=0 || y+dy>=CFG.HEIGHT) continue;
      const bx=x+dx,by=y+dy,bz=z+dz;
      w.ensureChunkData(Math.floor(bx/CFG.CHUNK),Math.floor(bz/CFG.CHUNK));
      const id=w.getBlock(bx,by,bz);
      // Conservar cofres, regalos, agua y obsidiana.
      if (!id || BLOCKS[id]?.unbreakable || [11,12,13,17,34,40].includes(id)) continue;
      changeExplosiveBlock(game,bx,by,bz,id===33 ? 40 : 0);
      if (id===33) game.tntFuses.set(`${bx},${by},${bz}`, .6);
    }
  });
  // El cráter se sincroniza por bloques; daño a criaturas simulado por el host.
  for (const c of game.hittableCreatures()) {
    if (!c.dead && Math.hypot(c.pos.x-x-.5,c.pos.y-y,c.pos.z-z-.5)<4) c.hurt(4);
  }
}
