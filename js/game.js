// Una partida en un mapa concreto: escena, mundo, jugador, inventario y reglas.
class Game {
  constructor(mapKey, ctx, slot = 1) {
    this.mapKey = mapKey;
    this.map = MAPS[mapKey];
    this.slot = slot;
    this.ui = ctx.ui;
    this.controls = ctx.controls;
    this.renderer = ctx.renderer;
    this.atlasCanvas = ctx.atlasCanvas;
    this.crafting = ctx.crafting;
    this.chestUI = ctx.chestUI;
    this.eggUI = ctx.eggUI;
    this.picker = ctx.picker;
    this.queuedEgg = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 400
    );

    this.state = { elapsed: 0, won: false, treasures: [], found: 0, day: 1 };
    this.saveTimer = 0;
    this.shootCooldown = 0;
    this.bolts = [];
    this.cameraMode = this.map.defaultView || 'pov';

    // Mapas con mundo guardable usan slots; los demás solo guardan récords
    // (por circuito/variante cuando el mapa define `variants`).
    this.scoreKey = this.map.variants ? `${mapKey}#v${slot}` : mapKey;
    const saved = this.map.save ? Storage.loadSlot(mapKey, slot) : Storage.load(this.scoreKey);
    this.savedMeta = saved || {};

    this.inventory = new Inventory(this.map.inventory, this.map.hotbar || HOTBAR);
    if (this.map.save && saved) this.inventory.restore(saved.inventory);
    this.inventory.onChange = () => this.refreshHotbar();

    this.world = new World(
      this.scene, ctx.materials || ctx.material,
      (w, cx, cz, data) => this.map.generate(this, w, cx, cz, data),
      this.map.save && saved ? saved.edits || {} : {}
    );
    scanWorldExtras(this); // antorchas y retoños guardados
    if (this.map.canBuild) initTorchLights(this);

    this.daynight = new DayNight(this.scene);
    this.daynight.time = this.map.dayNight
      ? (saved && saved.time !== undefined ? saved.time : 0.25)
      : 0.28;

    this.controls.steerMode = !!this.map.driving;
    this.player = new Player(
      this.world,
      {
        fallDamage: this.map.fallDamage,
        driving: !!this.map.driving,
        hunger: !!this.map.hunger,
        onVoidFall: this.map.onVoidFall ? () => this.map.onVoidFall(this) : null,
      },
      (hurt) => { this.renderHearts(); if (hurt) this.ui.damageFlash(); },
      () => { this.ui.showDeath(true); document.exitPointerLock(); }
    );

    this.spawn = typeof this.map.spawn === 'function' ? this.map.spawn(this) : this.map.spawn;
    this.world.update(this.spawn.x, this.spawn.z);
    if (this.map.save && saved && saved.player) {
      this.player.respawn(saved.player);
      this.player.health = saved.player.health !== undefined ? saved.player.health : CFG.MAX_HEALTH;
      this.player.hunger = saved.player.hunger !== undefined ? saved.player.hunger : CFG.MAX_HUNGER;
    } else {
      this.player.respawn(this.spawn);
    }
    this.state.day = (this.map.save && saved && saved.day) || 1;
    this.respawnPoint = (this.map.save && saved && saved.respawn) || null;

    this.chests = (this.map.save && saved && saved.chests) ? saved.chests : {};
    this.savedPets = (this.map.save && saved && saved.pets) || [];

    // Multijugador: activo si el juego se sirve por http (server.js) y el mapa lo permite.
    this.net = NET.available && !!this.map.multiplayer;
    this.avatars = new Map(); // peerId → RemoteAvatar
    this.puppets = null;      // mobs dibujados (cuando no somos anfitrión)
    this.netTimers = { pos: 0, mobs: 0, time: 0 };

    this.mobs = null;
    this.animals = null;
    if (!this.net) this.createManagers();
    else this.setupNet();

    this.minimap = this.map.minimap ? new Minimap(this) : null;

    // Avatar propio en vista FIFA (mapas con ownAvatar; fútbol usa el suyo).
    this.ownAvatar = null;
    this.ownAvatarPhase = 0;
    this.lastOwnPos = new THREE.Vector3();

    this.refreshHotbar();
    this.renderHearts();
    this.ui.setInfo(this.map.hunger ? `☀️ ${t('dayLabel')} ${this.state.day}` : '');
    document.getElementById('hotbar').classList.toggle('hidden', !this.map.canBuild);

    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)),
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.boltGeo = new THREE.BoxGeometry(0.07, 0.07, 0.45);
    this.boltMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
    this.hostileBoltMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = CFG.REACH;

    this.bindControls();
  }

  renderHearts() {
    this.ui.renderHealth(this.player.health, this.map.zombies || this.map.fallDamage);
    this.ui.renderHunger(this.map.hunger ? this.player.hunger : null);
  }

  // ---- Multijugador ----
  combatTargets() {
    const list = [];
    if (!this.player.dead) {
      list.push({ id: 'local', pos: this.player.pos, dead: false, damage: (n) => this.player.damage(n) });
    }
    for (const [id, av] of this.avatars) {
      list.push({ id, pos: av.pos, dead: false, damage: (n) => NET.send({ t: 'dmg', to: id, n }) });
    }
    return list;
  }

  // Botín de mobs/animales: directo al que lo mató (por red si es remoto).
  grantDrop(itemId, n, killer) {
    if (this.net && killer !== undefined && killer !== 'local') {
      NET.send({ t: 'drop', to: killer, food: itemId, n });
      return;
    }
    this.inventory.add(itemId, n);
    if (!this.inventory.isFree()) this.ui.toast(`${t('gotFood')} ${nameOf(itemId)}${n > 1 ? ' ×' + n : ''}!`);
  }

  createManagers() {
    const targetsFn = () => this.combatTargets();
    if (this.map.zombies && !this.mobs) {
      this.mobs = new MobManager(this.scene, this.world, targetsFn, (from, dir) => {
        this.spawnBolt(from, dir, true);
        if (this.net) NET.send({ t: 'bolt', x: from.x, y: from.y, z: from.z, dx: dir.x, dy: dir.y, dz: dir.z, hostile: true });
      }, (itemId, n, killer) => this.grantDrop(itemId, n, killer));
    }
    if (this.map.animals && !this.animals) {
      this.animals = new AnimalManager(this.scene, this.world, targetsFn,
        (foodId, species, killer) => { if (foodId) this.grantDrop(foodId, 1, killer); });
      // Perros adoptados de la partida guardada.
      for (const [x, y, z] of this.savedPets || []) this.animals.spawnPet(x, y, z);
      this.savedPets = null;
    }
  }

  setupNet() {
    NET.join(this.mapKey, {
      welcome: (msg) => {
        if (msg.time !== null && msg.time !== undefined && this.map.dayNight) {
          this.daynight.time = msg.time;
        }
        this.applyNetEdits(msg.edits || {});
        for (const id of msg.peers) this.addAvatar(id);
        NET.send({ t: 'skin', app: Character.appearance() });
        if (NET.isHost) {
          if (!this.mobs) this.createManagers(); // (puede ser una reconexión)
          if (this.puppets) { this.puppets.clear(); this.puppets = null; }
          if (Object.keys(this.world.edits).length) {
            NET.send({ t: 'edits', edits: this.world.edits });
          }
        } else if (!this.puppets) {
          this.puppets = new PuppetManager(this.scene);
        }
        this.ui.setNetStatus(this.avatars.size + 1);
      },
      'peer-join': (msg) => {
        this.addAvatar(msg.id);
        NET.send({ t: 'skin', app: Character.appearance() }); // que el nuevo nos vea bien
        this.ui.toast(t('netJoined'));
        this.ui.setNetStatus(this.avatars.size + 1);
        // El anfitrión comparte su mundo, hora y marcador con el que llega.
        if (NET.isHost) {
          NET.send({ t: 'edits', edits: this.world.edits });
          if (this.map.dayNight) NET.send({ t: 'time', v: this.daynight.time });
          if (this.state.soccer) {
            const s = this.state.soccer;
            NET.send({ t: 'score', h: s.scoreYou, g: s.scoreBot, event: null, done: false, winner: null });
          }
          // Carrera: llegó un rival → arranque sincronizado para todos.
          if (this.state.race) {
            NET.send({ t: 'racestart' });
            this.state.race.onRaceStart();
          }
        }
      },
      'peer-leave': (msg) => {
        const av = this.avatars.get(msg.id);
        if (av) { av.dispose(); this.avatars.delete(msg.id); }
        this.ui.toast(t('netLeft'));
        this.ui.setNetStatus(this.avatars.size + 1);
      },
      host: () => {
        // Nos tocó ser el nuevo anfitrión: simular los mobs desde ahora.
        if (NET.isHost && !this.mobs) {
          if (this.puppets) { this.puppets.clear(); this.puppets = null; }
          this.createManagers();
        }
      },
      pos: (msg) => {
        const av = this.avatars.get(msg.from);
        if (av) av.setTarget(msg.x, msg.y, msg.z, msg.yaw);
      },
      skin: (msg) => {
        const av = this.avatars.get(msg.from);
        if (av) av.setAppearance(msg.app);
      },
      block: (msg) => {
        this.world.setBlock(msg.x, msg.y, msg.z, msg.id);
        trackBlockChange(this, msg.x, msg.y, msg.z, msg.id);
      },
      time: (msg) => { if (this.map.dayNight) this.daynight.time = msg.v; },
      mobs: (msg) => { if (this.puppets) this.puppets.apply(msg.list); },
      hit: (msg) => {
        const c = this.findCreature(msg.mob);
        if (c) c.hurt(msg.dmg, new THREE.Vector3(msg.kx, 0, msg.kz), msg.from);
      },
      tame: (msg) => { // un invitado adoptó un perro: el anfitrión lo hace suyo
        const c = this.findCreature(msg.mob);
        if (c && c.species === 'dog' && !c.tamed) c.setTamed(msg.from);
      },
      dmg: (msg) => this.player.damage(msg.n),
      drop: (msg) => {
        const n = msg.n || 1;
        this.inventory.add(msg.food, n);
        this.ui.toast(`${t('gotFood')} ${nameOf(msg.food)}${n > 1 ? ' ×' + n : ''}!`);
      },
      bolt: (msg) => this.spawnBolt(
        new THREE.Vector3(msg.x, msg.y, msg.z),
        new THREE.Vector3(msg.dx, msg.dy, msg.dz), msg.hostile, true
      ),
      // Fútbol en red: balón/marcador del anfitrión, patadas de invitados.
      ball: (msg) => { if (this.state.soccer) this.state.soccer.onNetBall(msg); },
      score: (msg) => { if (this.state.soccer) this.state.soccer.onNetScore(msg); },
      kick: (msg) => { if (this.state.soccer) this.state.soccer.onNetKick(msg); },
      slide: (msg) => { if (this.state.soccer) this.state.soccer.onNetSlide(msg); },
      // Carreras en red: arranque sincronizado, ganador y posiciones.
      racestart: () => {
        if (this.state.race) this.state.race.onRaceStart();
        else this.pendingRaceSync = true;
      },
      racewin: () => { if (this.state.race) this.state.race.onRaceWin(); },
      raceprog: (msg) => { if (this.state.race) this.state.race.onRaceProg(msg); },
      laser: (msg) => { if (this.state.race) this.state.race.onNetLaser(msg); },
      freeze: () => { if (this.state.race) this.state.race.onFreeze(); },
      closed: () => {
        this.ui.toast(t('netLost'), 10000);
        this.ui.setNetStatus(null);
      },
    });
  }

  addAvatar(id) {
    if (this.avatars.has(id)) return;
    this.avatars.set(id, new RemoteAvatar(this.scene, id));
  }

  findCreature(netId) {
    if (this.mobs) {
      const z = this.mobs.zombies.find((c) => c.netId === netId);
      if (z) return z;
    }
    if (this.animals) {
      const a = this.animals.animals.find((c) => c.netId === netId);
      if (a) return a;
    }
    return null;
  }

  // Aplica muchas ediciones de golpe reconstruyendo cada chunk una sola vez.
  applyNetEdits(edits) {
    const dirty = new Set();
    for (const [k, id] of Object.entries(edits)) {
      this.world.edits[k] = id;
      const [x, y, z] = k.split(',').map(Number);
      const cx = Math.floor(x / CFG.CHUNK);
      const cz = Math.floor(z / CFG.CHUNK);
      const data = this.world.chunks.get(this.world.key(cx, cz));
      if (data && y >= 0 && y < CFG.HEIGHT) {
        data[this.world.blockIndex(x - cx * CFG.CHUNK, y, z - cz * CFG.CHUNK)] = id;
        dirty.add(this.world.key(cx, cz));
      }
    }
    for (const k of dirty) {
      const [cx, cz] = k.split(',').map(Number);
      this.world.buildMesh(cx, cz);
    }
  }

  netTick(dt) {
    if (!this.net || !NET.active()) return;
    this.netTimers.pos += dt;
    if (this.netTimers.pos > 0.12) {
      this.netTimers.pos = 0;
      const p = this.player.pos;
      NET.send({ t: 'pos', x: p.x, y: p.y, z: p.z, yaw: this.controls.yaw });
    }
    if (NET.isHost) {
      this.netTimers.mobs += dt;
      if (this.netTimers.mobs > 0.15) {
        this.netTimers.mobs = 0;
        const list = [];
        if (this.mobs) for (const c of this.mobs.zombies) {
          list.push({ k: c.netId, ty: c.netType, x: c.pos.x, y: c.pos.y, z: c.pos.z, ry: c.group.rotation.y });
        }
        if (this.animals) for (const c of this.animals.animals) {
          list.push({ k: c.netId, ty: c.netType, x: c.pos.x, y: c.pos.y, z: c.pos.z, ry: c.group.rotation.y, tm: c.tamed ? 1 : 0 });
        }
        NET.send({ t: 'mobs', list });
      }
      this.netTimers.time += dt;
      if (this.netTimers.time > 4 && this.map.dayNight) {
        this.netTimers.time = 0;
        NET.send({ t: 'time', v: this.daynight.time });
      }
    }
  }

  refreshHotbar() {
    this.controls.hotbar = this.inventory.entries.map((e) => e.id);
    if (this.controls.selectedSlot >= this.inventory.entries.length) {
      this.controls.selectedSlot = Math.max(0, this.inventory.entries.length - 1);
    }
    this.ui.buildHotbar(this.atlasCanvas, this.inventory.entries, this.controls.selectedSlot);
  }

  selectedId() {
    const e = this.inventory.entries[this.controls.selectedSlot];
    return e ? e.id : null; // null = mano
  }

  // ---- Rayos y objetivos ----
  centerRay() {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    return this.raycaster;
  }

  targetBlock() {
    const hits = this.centerRay().intersectObjects(this.world.raycastTargets());
    if (!hits.length) return null;
    const n = hits[0].face.normal;
    const p = hits[0].point;
    const inside = {
      x: Math.floor(p.x - n.x * 0.01),
      y: Math.floor(p.y - n.y * 0.01),
      z: Math.floor(p.z - n.z * 0.01),
    };
    return { inside, outside: { x: inside.x + n.x, y: inside.y + n.y, z: inside.z + n.z } };
  }

  targetCreature() {
    const meshes = [];
    if (this.mobs) this.mobs.collectMeshes(meshes);
    if (this.animals) this.animals.collectMeshes(meshes);
    if (this.puppets) this.puppets.collectMeshes(meshes);
    const hits = this.centerRay().intersectObjects(meshes);
    return hits.length ? hits[0].object.userData.creature : null;
  }

  // Lista de criaturas golpeables (reales si somos anfitrión, títeres si no).
  hittableCreatures() {
    const list = [];
    if (this.mobs) list.push(...this.mobs.zombies);
    if (this.animals) list.push(...this.animals.animals);
    if (this.puppets) for (const p of this.puppets.puppets.values()) list.push(p.creature);
    return list;
  }

  // Adoptar un perro (directo si lo simulamos; por red si es un títere del anfitrión).
  tameDog(creature) {
    if (this.net && !NET.isHost) {
      NET.send({ t: 'tame', mob: creature.netId });
    } else {
      creature.setTamed('local');
    }
    this.ui.toast(t('dogAdopted'), 4000);
    this.milestone('primerPerro');
  }

  // Aplica daño a una criatura (directo si somos anfitrión, por red si no).
  damageCreature(creature, dmg, dir) {
    if (this.net && !NET.isHost) {
      NET.send({ t: 'hit', mob: creature.netId, dmg, kx: dir.x, kz: dir.z });
    } else {
      creature.hurt(dmg, dir, 'local');
    }
  }

  // ---- Acciones ----
  meleeDamage() {
    const def = ITEMS[this.selectedId()];
    return def && def.kind === 'weapon' ? def.damage : 1;
  }

  shootBolt() {
    if (this.shootCooldown > 0) return;
    // En supervivencia la ballesta gasta flechas.
    if (!this.inventory.isFree() && !this.inventory.remove(110, 1)) {
      this.ui.toast(t('noArrows'));
      this.shootCooldown = 0.5;
      return;
    }
    this.shootCooldown = 1;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const from = this.player.eyePosition();
    this.spawnBolt(from, dir, false);
    if (this.net) {
      NET.send({ t: 'bolt', x: from.x, y: from.y, z: from.z, dx: dir.x, dy: dir.y, dz: dir.z, hostile: false });
    }
  }

  // remote: flecha de otro jugador; solo visual (el daño lo decide quien dispara).
  spawnBolt(from, dir, hostile, remote = false) {
    const mesh = new THREE.Mesh(this.boltGeo, hostile ? this.hostileBoltMat : this.boltMat);
    mesh.position.copy(from);
    mesh.lookAt(from.clone().add(dir));
    this.scene.add(mesh);
    this.bolts.push({ mesh, vel: dir.clone().multiplyScalar(hostile ? 18 : 26), life: 3, hostile, remote });
  }

  updateBolts(dt) {
    for (const b of this.bolts) {
      b.life -= dt;
      b.vel.y -= (b.hostile ? 3 : 9) * dt; // las flechas enemigas caen menos (mejor puntería)
      b.mesh.position.addScaledVector(b.vel, dt);
      const p = b.mesh.position;
      if (b.life <= 0 || this.world.isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
        b.dead = true;
        continue;
      }
      if (b.hostile) {
        // Flecha de esqueleto: cada cliente evalúa solo contra SU jugador.
        const pl = this.player;
        if (!pl.dead &&
            Math.hypot(p.x - pl.pos.x, p.y - (pl.pos.y + pl.height / 2), p.z - pl.pos.z) < 0.8) {
          pl.damage(1);
          b.dead = true;
        }
        continue;
      }
      if (b.remote) continue; // flecha ajena: solo visual
      for (const c of this.hittableCreatures()) {
        if (c.dead) continue;
        const dx = p.x - c.pos.x, dy = p.y - (c.pos.y + c.height / 2), dz = p.z - c.pos.z;
        if (Math.hypot(dx, dy, dz) < 0.5 + c.halfW) {
          const dir = b.vel.clone().setY(0).normalize();
          this.damageCreature(c, ITEMS[102].damage, dir);
          b.dead = true;
          break;
        }
      }
    }
    for (const b of this.bolts) {
      if (b.dead) this.scene.remove(b.mesh);
    }
    this.bolts = this.bolts.filter((b) => !b.dead);
  }

  eat(id) {
    const def = ITEMS[id];
    const p = this.player;
    if (this.map.hunger) {
      // Con hambre: la comida llena la barra (y cura un poquito).
      if (p.hunger >= CFG.MAX_HUNGER && p.health >= CFG.MAX_HEALTH) return;
      if (!this.inventory.remove(id, 1)) return;
      p.hunger = Math.min(CFG.MAX_HUNGER, p.hunger + def.heal);
      p.health = Math.min(CFG.MAX_HEALTH, p.health + 1);
    } else {
      if (p.health >= CFG.MAX_HEALTH) return;
      if (!this.inventory.remove(id, 1)) return;
      p.health = Math.min(CFG.MAX_HEALTH, p.health + def.heal);
    }
    this.renderHearts();
  }

  // Nivel de pico en la mano: 0 mano, 1 madera, 2 piedra, 3 hierro.
  pickTier() {
    const def = ITEMS[this.selectedId()];
    return def && def.pickTier ? def.pickTier : 0;
  }

  // Dormir / fijar punto de reaparición en una cama.
  sleep(pos) {
    this.respawnPoint = { x: pos.x + 0.5, y: pos.y + 1.2, z: pos.z + 0.5 };
    if (this.map.dayNight && this.daynight.isNight()) {
      this.daynight.time = 0.25; // amanecer
      if (this.net) NET.send({ t: 'time', v: 0.25 });
      this.ui.toast(t('bedSleep'));
    } else {
      this.ui.toast(t('bedSpawn'));
    }
  }

  nearTable() {
    const p = this.player.pos;
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    for (let x = px - 6; x <= px + 6; x++) {
      for (let y = Math.max(1, py - 4); y <= py + 4; y++) {
        for (let z = pz - 6; z <= pz + 6; z++) {
          if (this.world.getBlock(x, y, z) === 9) return true;
        }
      }
    }
    return false;
  }

  openPicker() {
    if (!this.map.canBuild || !this.inventory.entries.length ||
        this.player.dead || this.state.won) return;
    document.exitPointerLock();
    this.picker.onClose = this.relockOnClose();
    this.picker.show(
      this.atlasCanvas, this.inventory.entries, this.controls.selectedSlot,
      (i) => this.controls.selectSlot(i)
    );
  }

  relockOnClose() {
    return () => {
      if (this.player.dead) return;
      if (this.queuedEgg) { this.queuedEgg = false; this.showEgg(); return; }
      this.ui.showPlaying(false); // overlay visible hasta que el pointer lock engancha
      this.controls.lock();
    };
  }

  // ---- Easter eggs: trivia + mensaje/dato curioso + premio de materiales ----
  showEgg() {
    const msg = Eggs.reward();
    const trivia = Eggs.nextTrivia();
    let prize = null;
    if (!this.inventory.isFree()) {
      const [id, n] = EGG_PRIZES[Math.floor(Math.random() * EGG_PRIZES.length)];
      prize = {
        text: `${nameOf(id)} ×${n}`,
        grant: () => { this.inventory.add(id, n); },
      };
    }
    document.exitPointerLock();
    this.eggUI.onClose = this.relockOnClose();
    this.eggUI.start(trivia, msg, prize);
  }

  milestone(flag) {
    if (!Eggs.once(flag)) return;
    if (this.crafting.open || this.chestUI.open) this.queuedEgg = true;
    else this.showEgg();
  }

  craftAction() {
    return (recipe) => {
      if (!this.inventory.canAfford(recipe.cost)) return;
      this.inventory.pay(recipe.cost);
      this.inventory.add(recipe.out.id, recipe.out.n);
      this.ui.toast(`${nameOf(recipe.out.id)} ✔`);
      if ([100, 101, 102, 114, 115, 116].includes(recipe.out.id)) this.milestone('primerArma');
    };
  }

  openCrafting() {
    if (!this.map.crafting || this.player.dead || this.state.won) return;
    document.exitPointerLock();
    this.crafting.onClose = this.relockOnClose();
    this.crafting.show(this.atlasCanvas, this.inventory, this.nearTable(), this.craftAction());
  }

  openFurnace() {
    if (!this.map.crafting || this.player.dead || this.state.won) return;
    document.exitPointerLock();
    this.crafting.onClose = this.relockOnClose();
    this.crafting.show(
      this.atlasCanvas, this.inventory, true, this.craftAction(),
      FURNACE_RECIPES, 'furnaceTitle'
    );
  }

  openChest(x, y, z) {
    if (this.inventory.isFree() || this.player.dead || this.state.won) return;
    const key = `${x},${y},${z}`;
    if (!this.chests[key]) this.chests[key] = [];
    document.exitPointerLock();
    this.chestUI.onClose = this.relockOnClose();
    this.chestUI.show(this.atlasCanvas, this.chests[key], this.inventory);
  }

  bindControls() {
    this.controls.onLeftClick = () => {
      if (this.player.dead || this.state.won) return;
      if (this.map.onClick && this.map.onClick(this)) return;

      // Ballesta: dispara en vez de golpear.
      const sel = ITEMS[this.selectedId()];
      if (sel && sel.kind === 'crossbow') { this.shootBolt(); return; }

      const creature = this.targetCreature();
      if (creature) {
        const dir = new THREE.Vector3()
          .subVectors(creature.pos, this.player.pos).setY(0).normalize();
        this.damageCreature(creature, this.meleeDamage(), dir);
        return;
      }
      if (!this.map.canBuild) return;
      const target = this.targetBlock();
      if (target && target.inside.y > 0) {
        const { x, y, z } = target.inside;
        const id = this.world.getBlock(x, y, z);
        const def = BLOCKS[id];
        // Minerales duros: exigen nivel de pico (solo en supervivencia).
        if (!this.inventory.isFree() && def && def.needTier && this.pickTier() < def.needTier) {
          this.ui.toast(t('needPick'));
          return;
        }
        this.world.setBlock(x, y, z, 0);
        if (this.net) NET.send({ t: 'block', x, y, z, id: 0 });
        trackBlockChange(this, x, y, z, 0);
        if (!this.inventory.isFree()) {
          if (id === 6) {
            // Hojas: a veces sueltan manzana o retoño.
            const r = Math.random();
            if (r < 0.12) { this.inventory.add(117, 1); this.ui.toast(`${t('gotFood')} ${nameOf(117)}!`); }
            else if (r < 0.3) this.inventory.add(22, 1);
          } else {
            this.inventory.add(dropOf(id), 1);
          }
        }
        if (id === 12) this.showEgg(); // bloque corazón encontrado
        // Al romper un cofre, su contenido pasa al inventario.
        if (id === 11) {
          const key = `${x},${y},${z}`;
          for (const [itemId, n] of this.chests[key] || []) this.inventory.add(itemId, n);
          delete this.chests[key];
        }
        if (this.map.onBreak) this.map.onBreak(this, x, y, z, id);
      }
    };

    this.controls.onRightClick = () => {
      if (this.player.dead || this.state.won) return;
      if (this.map.onRightClick && this.map.onRightClick(this)) return;

      // Perro salvaje en la mira: se adopta con un hueso.
      const creature = this.targetCreature();
      if (creature && creature.species === 'dog' && !creature.tamed) {
        if (this.selectedId() === 118 && this.inventory.remove(118, 1)) {
          this.tameDog(creature);
        } else {
          this.ui.toast(t('dogNeedBone'));
        }
        return;
      }

      const target = this.targetBlock();
      // Clic derecho sobre mesa / horno / cofre / cama: usar el bloque.
      if (target) {
        const targetId = this.world.getBlock(target.inside.x, target.inside.y, target.inside.z);
        if (this.map.crafting && targetId === 9) { this.openCrafting(); return; }
        if (this.map.crafting && targetId === 10) { this.openFurnace(); return; }
        if (targetId === 13 && this.map.onSign) { this.map.onSign(this, target.inside); return; }
        if (targetId === 23) { this.sleep(target.inside); return; }
        if (!this.inventory.isFree() && targetId === 11) {
          this.openChest(target.inside.x, target.inside.y, target.inside.z);
          return;
        }
      }

      const id = this.selectedId();
      const def = id !== null ? ITEMS[id] : null;
      if (def && def.kind === 'food') { this.eat(id); return; }

      if (!this.map.canBuild || id === null || !isBlockId(id)) return;
      if (!target) return;
      // Apuntar a una planta la reemplaza; si no, se construye en la cara.
      const targetDef = BLOCKS[this.world.getBlock(target.inside.x, target.inside.y, target.inside.z)];
      const spot = targetDef && targetDef.cross ? target.inside : target.outside;
      const { x, y, z } = spot;
      if (y < 1 || y >= CFG.HEIGHT) return;
      const curDef = BLOCKS[this.world.getBlock(x, y, z)];
      if (this.world.getBlock(x, y, z) !== 0 && !(curDef && curDef.solid === false)) return;
      const placedDef = BLOCKS[id];
      if (placedDef.solid !== false && this.player.wouldCollide(x, y, z)) return;
      if (this.inventory.count(id) < 1) return;
      this.world.setBlock(x, y, z, id);
      if (this.net) NET.send({ t: 'block', x, y, z, id });
      trackBlockChange(this, x, y, z, id);
      this.inventory.remove(id, 1);
    };

    this.controls.onSlotChange = () => this.refreshHotbar();
    this.controls.onOpenCraft = () => this.openCrafting();
    this.controls.onOpenPicker = () => this.openPicker();
    // En modo kart, Espacio/Enter disparan lo mismo que el clic (láser).
    this.controls.onFireKey = this.map.driving && this.map.onClick
      ? () => this.map.onClick(this)
      : null;
    this.controls.onToggleView = () => {
      if (!this.map.thirdPerson) return;
      this.cameraMode = this.cameraMode === 'pov' ? 'third' : 'pov';
      this.ui.toast(this.cameraMode === 'third' ? t('viewFifa') : t('viewPov'));
    };
  }

  // Tu personaje visible en vista FIFA (camina cuando te mueves).
  updateOwnAvatar(dt) {
    const show = this.cameraMode === 'third' && this.map.ownAvatar && !this.player.dead;
    if (!show) {
      if (this.ownAvatar) this.ownAvatar.group.visible = false;
      return;
    }
    if (!this.ownAvatar) {
      this.ownAvatar = new Humanoid(this.scene, 0, 0, 0, Character.appearance());
      this.lastOwnPos.copy(this.player.pos);
    }
    const g = this.ownAvatar.group;
    g.visible = true;
    g.position.copy(this.player.pos);
    g.rotation.y = this.controls.yaw + Math.PI;
    const speed = this.player.pos.distanceTo(this.lastOwnPos) / Math.max(dt, 0.001);
    this.lastOwnPos.copy(this.player.pos);
    if (speed > 0.8) {
      this.ownAvatarPhase += dt * 10;
      this.ownAvatar.swingLegs(this.ownAvatarPhase);
    } else {
      this.ownAvatar.swingLegs(0);
    }
  }

  respawnPlayer() {
    if (this.mobs) this.mobs.clear();
    this.player.respawn(this.respawnPoint || this.spawn);
    this.renderHearts();
  }

  // ---- Bucle ----
  update(dt) {
    this.world.update(this.player.pos.x, this.player.pos.z);
    const active = this.controls.locked && !this.player.dead && !this.state.won;

    if (active) {
      this.player.update(dt, this.controls);
      if (this.map.update) this.map.update(this, dt);
      this.shootCooldown = Math.max(0, this.shootCooldown - dt);
      this.daynight.update(this.map.dayNight ? dt : 0, this.player.pos);
      // Sobrevivir la primera noche: amanecer estando vivo.
      if (this.map.dayNight) {
        const night = this.daynight.isNight();
        if (this.wasNight && !night) {
          this.milestone('primerAmanecer');
          this.state.day++;
          if (this.map.hunger) {
            this.ui.setInfo(`☀️ ${t('dayLabel')} ${this.state.day}`);
            this.ui.toast(`☀️ ${t('dayLabel')} ${this.state.day}`);
          }
        }
        this.wasNight = night;
      }
      // La dificultad sube con los días: cada amanecer permite un mob más.
      const mobCap = this.map.hunger ? Math.min(2 + this.state.day, 10) : CFG.MAX_ZOMBIES;
      if (this.mobs) this.mobs.update(dt, this.daynight.isNight(), mobCap);
      if (this.animals) this.animals.update(dt, this.daynight.isNight());
      if (this.map.canBuild) updateSaplings(this, dt);
      this.updateBolts(dt);
    } else {
      this.daynight.update(0, this.player.pos);
    }

    if (this.torchLights) updateTorchLights(this, dt);

    // Multijugador: avatares, títeres de mobs y sincronización.
    for (const av of this.avatars.values()) av.update(dt);
    if (this.puppets) this.puppets.update(dt);
    this.netTick(dt);
    if (this.minimap) this.minimap.update(dt);

    this.updateOwnAvatar(dt);
    if (this.cameraMode === 'third') {
      // Cámara tipo FIFA: detrás y arriba del jugador, mirándolo.
      const yaw = this.controls.yaw;
      const pos = this.player.pos.clone();
      pos.x += Math.sin(yaw) * 4.5;
      pos.z += Math.cos(yaw) * 4.5;
      pos.y += Math.max(1.2, 3.2 - this.controls.pitch * 3);
      // Acercar la cámara si un bloque se interpone (montañas, cuevas, muros).
      const eye = this.player.eyePosition();
      const dir = pos.clone().sub(eye);
      const len = dir.length();
      dir.normalize();
      let dist = len;
      for (let s = 0.4; s <= len; s += 0.25) {
        const p = eye.clone().addScaledVector(dir, s);
        if (this.world.isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
          dist = Math.max(0.4, s - 0.4);
          break;
        }
      }
      this.camera.position.copy(eye).addScaledVector(dir, dist);
      this.camera.lookAt(
        this.player.pos.x, this.player.pos.y + 1.3, this.player.pos.z
      );
    } else {
      this.camera.position.copy(this.player.eyePosition());
      this.camera.rotation.set(0, 0, 0);
      this.camera.rotateY(this.controls.yaw);
      this.camera.rotateX(this.controls.pitch);
    }

    this.highlight.visible = false;
    if (active && this.map.canBuild) {
      const target = this.targetBlock();
      if (target) {
        this.highlight.position.set(
          target.inside.x + 0.5, target.inside.y + 0.5, target.inside.z + 0.5
        );
        this.highlight.visible = true;
      }
    }

    // Guardado automático cada 5 s.
    this.saveTimer += dt;
    if (this.saveTimer > 5) {
      this.saveTimer = 0;
      this.save();
    }

    this.renderer.render(this.scene, this.camera);
  }

  save() {
    if (!this.map.save) return;
    Storage.saveSlot(this.mapKey, this.slot, {
      edits: this.world.edits,
      player: {
        x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z,
        health: this.player.health,
        hunger: this.player.hunger,
      },
      time: this.daynight.time,
      day: this.state.day,
      respawn: this.respawnPoint,
      inventory: this.inventory.serialize(),
      chests: this.chests,
      // Perros adoptados por este jugador (si somos invitados, conservar los guardados).
      pets: this.animals
        ? this.animals.animals
            .filter((a) => a.tamed && a.owner === 'local' && !a.dead)
            .map((a) => [a.pos.x, a.pos.y, a.pos.z])
        : this.savedPets || [],
      updated: Date.now(),
    });
    this.world.dirty = false;
  }

  win() {
    this.state.won = true;
    const secs = Math.round(this.state.elapsed * 10) / 10;
    const prev = this.savedMeta.best;
    const isRecord = prev === undefined || secs < prev;
    if (isRecord) {
      this.savedMeta.best = secs;
      Storage.save(this.scoreKey, { best: secs });
    }
    const m = Math.floor(secs / 60);
    this.ui.showWin(`${m}:${(secs % 60).toFixed(1).padStart(4, '0')}`, isRecord);
    document.exitPointerLock();
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  stop() {
    this.save();
    this.daynight.sky.dispose();
    if (this.ownAvatar) this.ownAvatar.die();
    if (this.minimap) this.minimap.dispose();
    if (this.map.onStop) this.map.onStop(this);
    if (this.net) NET.leave();
    for (const av of this.avatars.values()) av.dispose();
    this.avatars.clear();
    if (this.puppets) this.puppets.clear();
    this.ui.setNetStatus(null);
    // Cerrar modales sin reenganchar el pointer lock.
    this.crafting.onClose = null;
    this.chestUI.onClose = null;
    this.eggUI.onClose = null;
    this.picker.onClose = null;
    this.crafting.close();
    this.chestUI.close();
    this.eggUI.close();
    this.picker.close();
    if (this.mobs) this.mobs.clear();
    if (this.animals) this.animals.clear();
    if (this.torchLights) {
      for (const light of this.torchLights) this.scene.remove(light);
      this.torchLights = null;
    }
    for (const b of this.bolts) this.scene.remove(b.mesh);
    this.bolts = [];
    this.world.dispose();
    this.highlight.geometry.dispose();
    this.highlight.material.dispose();
    this.boltGeo.dispose();
    this.boltMat.dispose();
    this.hostileBoltMat.dispose();
    this.controls.onLeftClick = null;
    this.controls.onRightClick = null;
    this.controls.onSlotChange = null;
    this.controls.onOpenCraft = null;
    this.controls.onFireKey = null;
  }
}
