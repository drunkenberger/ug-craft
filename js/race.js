// Carreras estilo Mario Kart: pista ondulada, turbos, 3 vueltas,
// 2 rivales de la máquina y carrera sincronizada en multijugador.
const RACE = {
  A: 45, B: 28,        // radios base de la elipse (x, z)
  HALF_W: 4.2,         // medio ancho de la pista
  CURB: 5.4,           // hasta dónde llegan los bordillos
  FLOOR_TOP: 4,        // los karts ruedan sobre y=4
  LAPS: 3,
  ROAD_MAX: 12, GRASS_MAX: 4, TURBO_MAX: 18,
  LASER_CD: 1.4, FREEZE: 1.0,
};

// Radio de la pista: elipse con dos ondulaciones sobrepuestas → curvas en S
// que van a la izquierda y a la derecha, no solo en un sentido.
function raceRadius(theta) {
  const re = (RACE.A * RACE.B) /
    Math.hypot(RACE.B * Math.cos(theta), RACE.A * Math.sin(theta));
  return re * (1 + 0.16 * Math.cos(3 * theta + 0.5) + 0.09 * Math.sin(5 * theta - 1.2));
}

function racePointAt(theta) {
  const r = raceRadius(theta);
  return { x: Math.cos(theta) * r, z: Math.sin(theta) * r };
}

// Pads de turbo y puntos de control (ángulos del recorrido, antihorario).
const RACE_PADS = [0.9, 2.2, 3.6, 5.0].map((a) => {
  const p = racePointAt(a);
  return { x: Math.round(p.x), z: Math.round(p.z) };
});
const RACE_CHECKPOINTS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(racePointAt);

function generateRaceTrack(world, cx, cz, data) {
  generateFlat(world, cx, cz, data);
  const R0 = raceRadius(0);
  for (let x = 0; x < CFG.CHUNK; x++) {
    for (let z = 0; z < CFG.CHUNK; z++) {
      const wx = cx * CFG.CHUNK + x;
      const wz = cz * CFG.CHUNK + z;
      const rho = Math.hypot(wx, wz);
      if (rho < 4) continue;
      const diff = Math.abs(rho - raceRadius(Math.atan2(wz, wx)));

      if (diff < RACE.HALF_W) {
        let id = 3; // asfalto de piedra
        if (wx > 0 && (wz === 0 || wz === 1)) id = (wx + wz) % 2 ? 7 : 4; // meta a cuadros
        for (const p of RACE_PADS) {
          if (Math.hypot(wx - p.x, wz - p.z) < 1.5) id = 8; // turbo
        }
        data[world.blockIndex(x, 3, z)] = id;
      } else if (diff < RACE.CURB) {
        // Bordillos a rayas (arena/tablones).
        data[world.blockIndex(x, 3, z)] = (wx + wz) % 2 ? 4 : 7;
      }

      // Arco de meta: postes y travesaño dorado sobre la línea de salida.
      if (wz === 0 && (Math.abs(wx - Math.round(R0 - 5)) === 0 || Math.abs(wx - Math.round(R0 + 5)) === 0)) {
        for (let y = 4; y <= 7; y++) data[world.blockIndex(x, y, z)] = 7;
      }
      if (wz === 0 && wx >= Math.round(R0 - 5) && wx <= Math.round(R0 + 5)) {
        data[world.blockIndex(x, 8, z)] = 8;
      }
    }
  }
}

// Kart de bloques (chasis, ruedas y piloto). El frente apunta a +z local.
function buildKart(scene, color) {
  const group = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const add = (w, h, d, m, x, y, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    group.add(b);
    return b;
  };
  const body = mat(color), dark = mat(0x222222), skin = mat(0xd8a06a);
  add(1.0, 0.35, 1.7, body, 0, 0.45, 0);           // chasis
  add(0.7, 0.25, 0.5, body, 0, 0.72, 0.5);         // frente
  for (const [wx, wz] of [[-0.55, 0.6], [0.55, 0.6], [-0.55, -0.6], [0.55, -0.6]]) {
    add(0.22, 0.45, 0.45, dark, wx, 0.28, wz);     // ruedas
  }
  const head = add(0.4, 0.4, 0.4, skin, 0, 1.05, -0.25); // piloto
  const eye = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const ex of [-0.09, 0.09]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), eye);
    e.position.set(ex, 0.05, 0.21);
    head.add(e);
  }
  scene.add(group);
  return group;
}

function disposeKart(scene, kart) {
  scene.remove(kart);
  kart.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

class RaceState {
  constructor(game) {
    this.game = game;
    this.lap = 1;
    this.nextCp = 1;
    this.turbo = 0;
    this.countdown = 3.9; // ¡3, 2, 1, YA!
    this.progTimer = 0;
    this.remoteKarts = new Map();  // peerId → { kart, last }
    this.remoteProg = new Map();   // peerId → progreso (para posiciones)
    this.rivalWonToast = false;

    // Polilínea de la pista (para los rivales de la máquina).
    this.points = [];
    const N = 96;
    for (let i = 0; i < N; i++) {
      const p = racePointAt((i / N) * Math.PI * 2);
      this.points.push(new THREE.Vector3(p.x, RACE.FLOOR_TOP, p.z));
    }
    this.perimeter = 0;
    for (let i = 0; i < N; i++) {
      this.perimeter += this.points[i].distanceTo(this.points[(i + 1) % N]);
    }

    this.kart = buildKart(game.scene, 0x2a5ac0); // el tuyo (azul)
    this.bots = [
      { kart: buildKart(game.scene, 0x2a9a4a), progress: -6, speed: 9.8, done: false, frozen: 0 },   // verde
      { kart: buildKart(game.scene, 0xc03030), progress: -12, speed: 11.0, done: false, frozen: 0 }, // rojo
    ];
    this.lasers = [];
    this.laserCd = 0;
    this.frozen = 0; // a mí me congelaron

    this.toStartLine();
    game.ui.toast(t('raceHint'), 5000);
    if (game.pendingRaceSync) {
      game.pendingRaceSync = false;
      this.syncStart();
    }
  }

  toStartLine() {
    const g = this.game;
    const R0 = raceRadius(0);
    // Carriles: el anfitrión por dentro, el invitado por fuera.
    const lane = g.net && !NET.isHost ? 2 : -1.5;
    g.player.pos.set(R0 + lane, RACE.FLOOR_TOP + 0.01, 2.5);
    g.player.kartSpeed = 0;
    g.player.vel.set(0, 0, 0);
    g.controls.yaw = Math.PI; // dirección de carrera (+z)
  }

  // Arranque sincronizado (multijugador): todos a la línea con cuenta regresiva.
  syncStart() {
    this.lap = 1;
    this.nextCp = 1;
    this.turbo = 0;
    this.countdown = 3.9;
    this.rivalWonToast = false;
    this.game.state.elapsed = 0;
    this.game.state.won = false;
    for (let i = 0; i < this.bots.length; i++) {
      this.bots[i].progress = -6 * (i + 1);
      this.bots[i].done = false;
    }
    this.toStartLine();
  }

  onRaceStart() { this.syncStart(); }

  // ---- Lásers congelantes ----
  shootLaser() {
    const g = this.game;
    if (this.laserCd > 0 || this.countdown > 0 || this.frozen > 0) return true;
    this.laserCd = RACE.LASER_CD;
    const yaw = g.controls.yaw;
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const from = g.player.pos.clone().add(new THREE.Vector3(dir.x * 1.4, 0.8, dir.z * 1.4));
    this.spawnLaser(from, dir, true);
    if (g.net) NET.send({ t: 'laser', x: from.x, y: from.y, z: from.z, dx: dir.x, dz: dir.z });
    return true;
  }

  spawnLaser(from, dir, mine) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 1.8),
      new THREE.MeshBasicMaterial({ color: 0x44eaff })
    );
    mesh.position.copy(from);
    mesh.lookAt(from.clone().add(dir));
    this.game.scene.add(mesh);
    this.lasers.push({ mesh, vel: dir.clone().multiplyScalar(42), life: 0.9, mine });
  }

  onNetLaser(msg) {
    this.spawnLaser(
      new THREE.Vector3(msg.x, msg.y, msg.z),
      new THREE.Vector3(msg.dx, 0, msg.dz), false
    );
  }

  onFreeze() {
    this.frozen = RACE.FREEZE;
    this.game.ui.toast(t('raceFrozen'));
  }

  setKartTint(kart, hex) {
    kart.traverse((o) => {
      if (o.material && o.material.emissive) o.material.emissive.setHex(hex);
    });
  }

  updateLasers(dt) {
    const g = this.game;
    for (const l of this.lasers) {
      l.life -= dt;
      l.mesh.position.addScaledVector(l.vel, dt);
      if (l.life <= 0) { l.dead = true; continue; }
      if (!l.mine) continue; // los lásers ajenos son solo visuales
      const p = l.mesh.position;
      // ¿Le di a un rival de la máquina?
      for (const bot of this.bots) {
        if (bot.frozen <= 0 && p.distanceTo(bot.kart.position) < 1.4) {
          bot.frozen = RACE.FREEZE;
          l.dead = true;
          g.ui.toast('❄️ ¡Congelado!');
        }
      }
      // ¿Le di al otro jugador?
      for (const [id, rk] of this.remoteKarts) {
        if (!l.dead && p.distanceTo(rk.kart.position) < 1.6) {
          NET.send({ t: 'freeze', to: id });
          l.dead = true;
          g.ui.toast('❄️ ¡Congelado!');
        }
      }
    }
    for (const l of this.lasers) {
      if (l.dead) {
        g.scene.remove(l.mesh);
        l.mesh.geometry.dispose();
        l.mesh.material.dispose();
      }
    }
    this.lasers = this.lasers.filter((l) => !l.dead);
  }

  onRaceWin() {
    this.game.ui.toast(t('raceRivalWon'), 6000);
  }

  onRaceProg(msg) {
    this.remoteProg.set(msg.from, (msg.lap - 1) * this.perimeter + msg.d);
  }

  pointAt(dist) {
    let d = ((dist % this.perimeter) + this.perimeter) % this.perimeter;
    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i];
      const b = this.points[(i + 1) % this.points.length];
      const seg = a.distanceTo(b);
      if (d <= seg) return a.clone().lerp(b, d / seg);
      d -= seg;
    }
    return this.points[0].clone();
  }

  // Progreso propio en metros (vueltas + ángulo recorrido).
  myProgress() {
    const p = this.game.player.pos;
    let theta = Math.atan2(p.z, p.x);
    if (theta < 0) theta += Math.PI * 2;
    return (this.lap - 1) * this.perimeter + (theta / (Math.PI * 2)) * this.perimeter;
  }

  update(dt) {
    const g = this.game, p = g.player;

    this.laserCd = Math.max(0, this.laserCd - dt);
    this.updateLasers(dt);

    // ¿Me congelaron? Kart azul detenido un momento.
    this.frozen = Math.max(0, this.frozen - dt);
    if (this.frozen > 0) p.kartSpeed = 0;
    this.setKartTint(this.kart, this.frozen > 0 ? 0x2299ff : 0x000000);

    // Cuenta regresiva: karts congelados.
    if (this.countdown > 0) {
      this.countdown -= dt;
      p.kartSpeed = 0;
      const n = Math.ceil(this.countdown - 0.9);
      g.ui.setInfo(n >= 1 ? `🏁 ¡${n}!` : '🏁 ¡YA!');
      if (this.countdown <= 0) g.ui.toast('🏁 ¡YA!');
    } else {
      g.state.elapsed += dt;
    }

    // Superficie: pista rápida, pasto lento, oro = turbo.
    const under = g.world.getBlock(Math.floor(p.pos.x), 3, Math.floor(p.pos.z));
    this.turbo = Math.max(0, this.turbo - dt);
    if (under === 8 && this.turbo <= 0.2 && this.countdown <= 0) {
      this.turbo = 1.6;
      p.kartSpeed = RACE.TURBO_MAX;
      g.ui.toast('🚀 ¡TURBO!');
    }
    p.kartMax = this.turbo > 0 ? RACE.TURBO_MAX
      : (under !== 0 && under !== 1 ? RACE.ROAD_MAX : RACE.GRASS_MAX);

    // Puntos de control y vueltas.
    if (this.countdown <= 0) {
      const cp = RACE_CHECKPOINTS[this.nextCp];
      if (Math.hypot(cp.x - p.pos.x, cp.z - p.pos.z) < 12) {
        if (this.nextCp === 0) {
          this.lap++;
          if (this.lap > RACE.LAPS) {
            if (g.net) NET.send({ t: 'racewin' });
            g.win();
            return;
          }
          g.ui.toast(`🏁 ${t('raceLap')} ${this.lap}/${RACE.LAPS}`);
        }
        this.nextCp = (this.nextCp + 1) % RACE_CHECKPOINTS.length;
      }
    }

    // Kart propio (visible en vista trasera).
    const third = g.cameraMode === 'third';
    this.kart.visible = third;
    if (third) {
      this.kart.position.copy(p.pos);
      this.kart.rotation.y = g.controls.yaw + Math.PI;
    }

    // Rivales de la máquina.
    for (const bot of this.bots) {
      bot.frozen = Math.max(0, bot.frozen - dt);
      this.setKartTint(bot.kart, bot.frozen > 0 ? 0x2299ff : 0x000000);
      if (this.countdown <= 0 && bot.frozen <= 0) bot.progress += dt * bot.speed;
      const bp = this.pointAt(bot.progress);
      const ahead = this.pointAt(bot.progress + 1.5);
      bot.kart.position.copy(bp);
      bot.kart.rotation.y = Math.atan2(ahead.x - bp.x, ahead.z - bp.z);
      if (!bot.done && bot.progress > this.perimeter * RACE.LAPS) {
        bot.done = true;
        if (!this.rivalWonToast) {
          this.rivalWonToast = true;
          g.ui.toast(t('raceBotWon'), 5000);
        }
      }
    }

    // Karts de los otros jugadores (en vez del avatar a pie).
    for (const [id, av] of g.avatars) {
      av.model.group.visible = false;
      let rk = this.remoteKarts.get(id);
      if (!rk) {
        rk = { kart: buildKart(g.scene, 0x8a2ac0), last: new THREE.Vector3() };
        this.remoteKarts.set(id, rk);
      }
      const gp = av.model.group.position;
      rk.kart.position.copy(gp);
      const dx = gp.x - rk.last.x, dz = gp.z - rk.last.z;
      if (Math.hypot(dx, dz) > 0.02) rk.kart.rotation.y = Math.atan2(dx, dz);
      rk.last.copy(gp);
    }
    for (const [id, rk] of this.remoteKarts) {
      if (!g.avatars.has(id)) {
        disposeKart(g.scene, rk.kart);
        this.remoteKarts.delete(id);
        this.remoteProg.delete(id);
      }
    }

    // Compartir mi progreso para las posiciones.
    if (g.net && NET.active()) {
      this.progTimer += dt;
      if (this.progTimer > 0.6) {
        this.progTimer = 0;
        const mine = this.myProgress();
        NET.send({ t: 'raceprog', lap: this.lap, d: mine - (this.lap - 1) * this.perimeter });
      }
    }

    // Posiciones en vivo: yo vs bots vs jugadores remotos.
    if (this.countdown <= 0) {
      const mine = this.myProgress();
      const others = [
        ...this.bots.map((b) => b.progress),
        ...this.remoteProg.values(),
      ];
      const place = 1 + others.filter((o) => o > mine).length;
      const total = others.length + 1;
      const m = Math.floor(g.state.elapsed / 60);
      const secs = (g.state.elapsed % 60).toFixed(1).padStart(4, '0');
      g.ui.setInfo(
        `🏁 ${t('raceLap')} ${this.lap}/${RACE.LAPS} · 🏆 ${place}º/${total}` +
        ` · ⏱ ${m}:${secs}` + (this.turbo > 0 ? ' · 🚀' : '')
      );
    }
  }

  dispose() {
    disposeKart(this.game.scene, this.kart);
    for (const b of this.bots) disposeKart(this.game.scene, b.kart);
    for (const rk of this.remoteKarts.values()) disposeKart(this.game.scene, rk.kart);
    this.remoteKarts.clear();
    for (const l of this.lasers) {
      this.game.scene.remove(l.mesh);
      l.mesh.geometry.dispose();
      l.mesh.material.dispose();
    }
    this.lasers = [];
  }
}
