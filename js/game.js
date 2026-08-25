// Una partida en un mapa concreto: escena, mundo, jugador, inventario y reglas.
class Game {
  constructor(mapKey, ctx, slot = 1, gameId = null) {
    this.mapKey = mapKey;
    this.map = MAPS[mapKey];
    this.slot = slot;
    this.gameId = gameId; // partida compartida del servidor (mundo y estado por jugador)
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
    // En partida compartida no cargamos nada local: el mundo y el estado los manda el servidor.
    const saved = this.map.save
      ? (gameId ? null : Storage.loadSlot(mapKey, slot))
      : Storage.load(this.scoreKey);
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
    // Los mapas con guardado solo van a red como partida compartida (gameId);
    // sus partidas locales quedan privadas de la máquina. Minijuegos: red directa.
    this.net = NET.available && !!this.map.multiplayer && (!this.map.save || !!this.gameId);
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
      }, (itemId, n, killer) => this.grantDrop(itemId, n, killer),
      (x, y, z, id) => {
        if (this.net) NET.send({ t: 'block', x, y, z, id });
        trackBlockChange(this, x, y, z, id);
      });
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
    const room = this.gameId ? `${this.mapKey}#${this.gameId}` : this.mapKey;
    NET.join(room, {
      welcome: (msg) => {
        if (msg.time !== null && msg.time !== undefined && this.map.dayNight) {
          this.daynight.time = msg.time;
        }
        // En partidas compartidas el servidor es la fuente de verdad del mundo.
        const serverHasWorld = msg.edits && Object.keys(msg.edits).length > 0;
        if (this.gameId && serverHasWorld) this.adoptServerWorld(msg.edits);
        else this.applyNetEdits(msg.edits || {});
        // Estado personal guardado (posición, inventario, vida, hambre) de esta partida.
        if (this.gameId && msg.pstate) this.restorePlayerState(msg.pstate);
        for (const id of msg.peers) this.addAvatar(id);
        NET.send({ t: 'skin', app: Character.appearance() });
        if (NET.isHost) {
          if (!this.mobs) this.createManagers(); // (puede ser una reconexión)
          if (this.puppets) { this.puppets.clear(); this.puppets = null; }
          // Solo sembramos nuestro mundo si el servidor aún no tiene uno.
          if (!serverHasWorld && Object.keys(this.world.edits).length) {
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
        if (av) av.setTarget(msg.x, msg.y, msg.z, msg.yaw, msg.sit, msg.down);
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
      tackled: (msg) => { if (this.state.soccer) this.state.soccer.onTackled(msg); },
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
    }, this.gameId ? Storage.playerName() : null);
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

  // Restaura el estado personal guardado en el servidor (partida compartida).
  restorePlayerState(s) {
    if (s.pos && s.pos.x !== undefined) this.player.respawn(s.pos);
    if (s.health !== undefined) this.player.health = s.health;
    if (s.hunger !== undefined) this.player.hunger = s.hunger;
    if (s.day) this.state.day = s.day;
    if (s.inventory) { this.inventory.restore(s.inventory); this.refreshHotbar(); }
    this.renderHearts();
    if (this.map.hunger) this.ui.setInfo(`☀️ ${t('dayLabel')} ${this.state.day}`);
  }

  // Envía el estado personal al servidor (se guarda por nombre de jugador).
  savePlayerState() {
    if (!this.net || !NET.active()) return;
    NET.send({ t: 'pstate', state: {
      pos: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z },
      health: this.player.health,
      hunger: this.player.hunger,
      day: this.state.day,
      inventory: this.inventory.serialize(),
    } });
  }

  // Reemplaza el mundo local por el compartido del servidor y lo reconstruye.
  adoptServerWorld(edits) {
    for (const map of [this.world.meshes, this.world.crossMeshes, this.world.waterMeshes]) {
      for (const mesh of map.values()) { this.scene.remove(mesh); mesh.geometry.dispose(); }
      map.clear();
    }
    this.world.chunks.clear();
    this.world.buildQueue.length = 0;
    this.world.edits = { ...edits };
    const p = this.player.pos;
    this.world.update(p.x, p.z);
    scanWorldExtras(this);
    if (this.map.canBuild) initTorchLights(this);
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
      NET.send({ t: 'pos', x: p.x, y: p.y, z: p.z, yaw: this.controls.yaw, sit: this.player.sitting ? 1 : 0, down: this.player.stunTimer > 0 ? 1 : 0 });
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






  // Lista de criaturas golpeables (reales si somos anfitrión, títeres si no).


  // Adoptar un perro (directo si lo simulamos; por red si es un títere del anfitrión).


  // Aplica daño a una criatura (directo si somos anfitrión, por red si no).


  // ---- Acciones ----




  // remote: flecha de otro jugador; solo visual (el daño lo decide quien dispara).






  // Nivel de pico en la mano: 0 mano, 1 madera, 2 piedra, 3 hierro.


  // Dormir / fijar punto de reaparición en una cama.


  // Sentarse en una silla (clic derecho): fija al jugador sobre el asiento,
  // congela el movimiento y muestra la pose sentada en vista FIFA.










  // ---- Easter eggs: trivia + mensaje/dato curioso + premio de materiales ----














  // Tu personaje visible en vista FIFA (camina cuando te mueves).




  // ---- Bucle ----









}

Object.assign(Game.prototype, GameCombat, GameInteractions, GameLifecycle);
