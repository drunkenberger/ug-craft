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
  if (isAdventureZone(cx * CFG.CHUNK, cz * CFG.CHUNK)) {
    generateAdventureTerrain(world,cx,cz,data); return;
  }
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
  generateVillage(world, cx, cz, data);
  generateExpeditionSites(world,cx,cz,data);
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
  if (isAdventureZone(cx * CFG.CHUNK, cz * CFG.CHUNK)) {
    generateAdventureTerrain(world,cx,cz,data); return;
  }
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
    inventory: 'free', thirdPerson:true, ownAvatar:true,
    hotbar: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 46, 48, 49, 50, 51, 52, 53, 54, 61, 126, 127, 119, 120, 121, 122, 123, 124, 125, 100, 101, 102, 118],
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

// Aldeas deterministas: cada parcela se dibuja dentro de su chunk, sin depender
// del orden de carga. Las ediciones del jugador se aplican después.
function generateVillage(world, cx, cz, data) {
  const centerX = Math.floor((cx * CFG.CHUNK + 56) / 192) * 192 + 40;
  const centerZ = Math.floor((cz * CFG.CHUNK + 56) / 192) * 192 + 40;
  const floor = Math.max(CFG.SEA_LEVEL + 2, survivalHeightAt(world, centerX, centerZ));
  const houses = [[-10,-10],[4,-10],[-10,4],[4,4]];
  for (let x = 0; x < CFG.CHUNK; x++) for (let z = 0; z < CFG.CHUNK; z++) {
    const dx = cx * CFG.CHUNK + x - centerX, dz = cz * CFG.CHUNK + z - centerZ;
    const distance = Math.max(Math.abs(dx), Math.abs(dz));
    const put = (y,id) => { if (y > 0 && y < CFG.HEIGHT) data[world.blockIndex(x,y,z)] = id; };
    if (distance > 15) {
      // Escalones de acceso cuando la plaza queda elevada sobre el terreno.
      if (distance <= 27 && (Math.abs(dx) <= 1 || Math.abs(dz) <= 1)) {
        const h = survivalHeightAt(world, cx * CFG.CHUNK + x, cz * CFG.CHUNK + z);
        const step = floor - (distance - 15);
        if (step >= h) {
          for (let y = h; y <= step; y++) put(y, y === step ? 36 : 2);
          for (let y = step+1; y <= step+3; y++) put(y,0);
        }
      }
      continue;
    }
    for (let y = 1; y < CFG.HEIGHT; y++) put(y,y < floor ? 2 : y === floor ? 1 : 0);
    if (Math.abs(dx) <= 1 || Math.abs(dz) <= 1) put(floor,36);
    // Plaza con fuente de agua y borde de cuarzo.
    if (Math.abs(dx) <= 3 && Math.abs(dz) <= 3) {
      put(floor,35);
      if (Math.abs(dx) === 3 || Math.abs(dz) === 3) put(floor+1,35);
      else put(floor,17);
      if (Math.abs(dx) <= 1 || Math.abs(dz) <= 1) put(floor+1,0);
    }
    if (dz===12 && Math.abs(dx)<=1) {
      for(let h=1;h<=4;h++) put(floor+h,Math.abs(dx)===1||h===4 ? 34 : 50);
    }
    for (const [hx,hz] of houses) {
      const a=dx-hx,b=dz-hz;
      if (a < 0 || a > 6 || b < 0 || b > 6) continue;
      put(floor,7);
      const wall=a===0 || a===6 || b===0 || b===6;
      for (let h=1;h<=3;h++) {
        let id=wall ? ((a===0 || a===6) && (b===0 || b===6) ? 5 : 7) : 0;
        if (b===6 && a===3 && h<=2) id=0;
        if (h===2 && ((a===3 && b===0) || (b===3 && (a===0 || a===6)))) id=31;
        put(floor+h,id);
      }
      put(floor+4,32);
      if (a>=1 && a<=5 && b>=1 && b<=5) put(floor+5,36);
      if (a===1 && b===1) put(floor+1,23);
      if (a===5 && b===1) put(floor+1,11);
      if (a===1 && b===4) put(floor+1,9);
      if (a===5 && b===4) put(floor+1,29);
    }
  }
}

// Una región lejana de la misma partida permite viajar sin perder inventario,
// ediciones ni sincronización. Los portales dan acceso al Bosque Luminoso.
const REALMS = [
  {key:'glowingForest',start:4000,center:4104,floor:28,top:38,rock:39},
  {key:'desert',start:6144,center:6248,floor:32,top:4,rock:36},
  {key:'snow',start:8192,center:8296,floor:32,top:18,rock:3},
  {key:'volcano',start:10240,center:10344,floor:32,top:39,rock:34},
];
function realmAt(x,z) {return REALMS.find(r=>x>=r.start&&x<r.start+512&&z>=r.start&&z<r.start+512);}
function isAdventureZone(x,z) {return !!realmAt(x,z);}
function generateGlowingTerrain(world,cx,cz,data) {
  const put=(x,y,z,id)=> { if(y>=0 && y<CFG.HEIGHT) data[world.blockIndex(x,y,z)]=id; };
  for(let x=0;x<CFG.CHUNK;x++) for(let z=0;z<CFG.CHUNK;z++) {
    const wx=cx*CFG.CHUNK+x,wz=cz*CFG.CHUNK+z;
    const h=26+Math.floor(world.noise.fbm(wx*.03,wz*.03,2)*3);
    for(let y=0;y<=h;y++) put(x,y,z,y===h ? 38 : y>h-3 ? 39 : 3);
    if(hash2D(wx,wz,554)<.025) put(x,h+1,z,53);
  }
  // Hongos centrados por chunk: copas dentro de sus límites, sin cortes.
  const x=8,z=8,wx=cx*CFG.CHUNK+x,wz=cz*CFG.CHUNK+z;
  const h=26+Math.floor(world.noise.fbm(wx*.03,wz*.03,2)*3);
  if(hash2D(cx,cz,901)<.65 && !(cx===256 && cz===256)) {
    for(let y=h+1;y<=h+6;y++) put(x,y,z,52);
    for(let dx=-3;dx<=3;dx++) for(let dz=-3;dz<=3;dz++) {
      if(Math.abs(dx)+Math.abs(dz)>5) continue;
      put(x+dx,h+6,z+dz,51);
      if(Math.abs(dx)<3 && Math.abs(dz)<3) put(x+dx,h+7,z+dz,51);
    }
  }
  // Campamento y portal de regreso sobre plataforma despejada.
  for(let x=0;x<CFG.CHUNK;x++) for(let z=0;z<CFG.CHUNK;z++) {
    const a=cx*CFG.CHUNK+x-4104,b=cz*CFG.CHUNK+z-4104;
    if(Math.abs(a)>8 || Math.abs(b)>8) continue;
    for(let y=1;y<CFG.HEIGHT;y++) put(x,y,z,y<28 ? 39 : y===28 ? 35 : 0);
    if(b===0 && Math.abs(a)<=1) {
      for(let h=29;h<=32;h++) put(x,h,z,Math.abs(a)===1||h===32 ? 34 : 50);
    }
    if(Math.abs(a)===6 && Math.abs(b)===6) {
      for(let y=29;y<=32;y++) put(x,y,z,34);
      put(x,33,z,53);
    }
    if(a===5 && b===2) put(x,29,z,11);
    if(a===-5 && b===2) put(x,29,z,9);
  }
}

// Mundos deterministas en regiones separadas del mismo guardado compartido.
function generateAdventureTerrain(world,cx,cz,data) {
  const r=realmAt(cx*CFG.CHUNK,cz*CFG.CHUNK);
  if(!r||r.key==='glowingForest'){generateGlowingTerrain(world,cx,cz,data);return;}
  const put=(x,y,z,id)=>{if(x>=0&&x<CFG.CHUNK&&z>=0&&z<CFG.CHUNK&&y>=0&&y<CFG.HEIGHT)data[world.blockIndex(x,y,z)]=id;};
  const height=(x,z)=>30+Math.floor(world.noise.fbm(x*.025,z*.025,3)*(r.key==='snow'?10:5));
  for(let x=0;x<CFG.CHUNK;x++)for(let z=0;z<CFG.CHUNK;z++) {
    const wx=cx*CFG.CHUNK+x,wz=cz*CFG.CHUNK+z,h=height(wx,wz);
    for(let y=0;y<=h;y++) {
      let id=y===h?r.top:r.rock;
      const ore=hash2D(wx+y*13,wz,772);
      if(y>3&&y<h-3&&ore<.018)id=ore<.003?16:ore<.009?15:14;
      put(x,y,z,id);
    }
    if(r.key==='volcano'&&hash2D(wx,wz,810)<.035)put(x,h+1,z,53);
  }
  // Monumentos enteros por chunk: pirámides, abetos nevados y agujas volcánicas.
  const h=height(cx*CFG.CHUNK+8,cz*CFG.CHUNK+8);
  if(hash2D(cx,cz,921)<.3) {
    if(r.key==='desert') {
      for(let dx=-5;dx<=5;dx++)for(let dz=-5;dz<=5;dz++)for(let y=0;y<=5-Math.max(Math.abs(dx),Math.abs(dz));y++)put(8+dx,h+1+y,8+dz,35);
      put(8,h+7,8,8);
    } else if(r.key==='snow') {
      for(let y=1;y<=7;y++)put(8,h+y,8,5);
      for(let y=3;y<=7;y++) {
        const radius=Math.max(1,Math.floor((8-y)/2));
        for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)if(dx||dz)put(8+dx,h+y,8+dz,y%2?18:6);
      }
    } else {
      for(let y=1;y<=10;y++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)if(Math.abs(dx)+Math.abs(dz)<(y<7?3:2))put(8+dx,h+y,8+dz,y===10?53:34);
    }
  }
  // Campamento seguro, portal visible y mesa; las ediciones se aplican después.
  for(let x=0;x<CFG.CHUNK;x++)for(let z=0;z<CFG.CHUNK;z++) {
    const a=cx*CFG.CHUNK+x-r.center,b=cz*CFG.CHUNK+z-r.center;
    if(Math.abs(a)>8||Math.abs(b)>8)continue;
    for(let y=1;y<CFG.HEIGHT;y++)put(x,y,z,y<r.floor?r.rock:y===r.floor?35:0);
    if(b===0&&Math.abs(a)<=1)for(let y=1;y<=4;y++)put(x,r.floor+y,z,Math.abs(a)===1||y===4?34:50);
    if(Math.abs(a)===6&&Math.abs(b)===6)put(x,r.floor+1,z,53);
    if(a===-4&&b===2)put(x,r.floor+1,z,9);
    if(a===4&&b===2)put(x,r.floor+1,z,11);
  }
}
