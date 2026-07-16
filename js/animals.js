// Animales pacíficos: deambulan, huyen al ser golpeados y dan comida al cazarlos.
const SPECIES = {
  pig: {
    health: 2, drop: 107, halfW: 0.35, height: 0.85, scale: 1,
    body: 0xe8a0a8, dark: 0xc87880,
  },
  cow: {
    health: 3, drop: 108, halfW: 0.4, height: 1.2, scale: 1.2,
    body: 0x6b4a35, dark: 0xf0ede8,
  },
  chicken: {
    health: 1, drop: 109, halfW: 0.22, height: 0.6, scale: 0.6,
    body: 0xf2f0ea, dark: 0xd8a02a,
  },
};

class Animal extends Creature {
  constructor(scene, species, x, y, z) {
    const def = SPECIES[species];
    super(scene, x, y, z, def.halfW, def.height, def.health);
    this.species = species;
    this.netType = species;
    this.def = def;
    this.wanderTimer = 0;
    this.fleeTimer = 0;
    this.moveDir = null;
    this.buildModel(def);
  }

  buildModel(def) {
    const s = def.scale;
    const body = this.mat(def.body);
    const dark = this.mat(def.dark);

    this.legs = [
      this.box(0.18 * s, 0.35 * s, 0.18 * s, body, -0.2 * s, 0.175 * s, 0.28 * s),
      this.box(0.18 * s, 0.35 * s, 0.18 * s, body, 0.2 * s, 0.175 * s, 0.28 * s),
      this.box(0.18 * s, 0.35 * s, 0.18 * s, body, -0.2 * s, 0.175 * s, -0.28 * s),
      this.box(0.18 * s, 0.35 * s, 0.18 * s, body, 0.2 * s, 0.175 * s, -0.28 * s),
    ];
    this.box(0.6 * s, 0.5 * s, 1.0 * s, body, 0, 0.6 * s, 0);           // cuerpo
    const head = this.box(0.42 * s, 0.42 * s, 0.35 * s, body, 0, 0.85 * s, 0.6 * s);
    // Detalle por especie: hocico / mancha / pico.
    const snout = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * s, 0.15 * s, 0.08 * s), dark
    );
    snout.position.set(0, -0.05 * s, 0.2 * s);
    head.add(snout);

    const eye = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const ex of [-0.11, 0.11]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.06 * s, 0.02), eye);
      e.position.set(ex * s, 0.08 * s, 0.18 * s);
      head.add(e);
    }
  }

  update(dt, world, targets) {
    if (this.dead) return;
    this.updateFlash(dt);
    this.wanderTimer -= dt;
    this.fleeTimer = Math.max(0, this.fleeTimer - dt);

    const near = this.nearestTarget(targets);
    if (this.fleeTimer > 0 && near) {
      // Huir del jugador más cercano.
      const d = near.dist || 1;
      this.moveDir = {
        x: (this.pos.x - near.target.pos.x) / d,
        z: (this.pos.z - near.target.pos.z) / d,
      };
      this.speed = 3.2;
    } else if (this.wanderTimer <= 0) {
      // Cambiar de plan: pasear o quedarse quieto.
      this.wanderTimer = 2 + Math.random() * 3;
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.moveDir = { x: Math.cos(a), z: Math.sin(a) };
        this.speed = 1.1;
      } else {
        this.moveDir = null;
      }
    }

    if (this.moveDir) {
      this.vel.x = this.moveDir.x * this.speed;
      this.vel.z = this.moveDir.z * this.speed;
      this.group.rotation.y = Math.atan2(this.moveDir.x, this.moveDir.z);
      this.walkPhase += dt * (this.fleeTimer > 0 ? 12 : 6);
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
    }

    if (this.hitWall && this.onGround) this.vel.y = CFG.JUMP_SPEED * 0.8;
    this.physics(dt, world);

    const swing = Math.sin(this.walkPhase) * 0.5;
    this.legs.forEach((leg, i) => { leg.rotation.x = i % 2 ? swing : -swing; });

    if (this.pos.y < -30) {
      this.onDie = null; // cayó del mundo: sin soltar comida
      this.die();
    }
  }

  onHurt() { this.fleeTimer = 3; }
}

class AnimalManager {
  // targetsFn: () => jugadores (para huir y como centro de spawns).
  constructor(scene, world, targetsFn, onDrop) {
    this.scene = scene;
    this.world = world;
    this.targetsFn = targetsFn;
    this.onDrop = onDrop; // (foodId, species, killer) => void
    this.animals = [];
    this.spawnTimer = 0;
  }

  update(dt, isNight) {
    const targets = this.targetsFn();
    this.spawnTimer -= dt;
    if (!isNight && this.spawnTimer <= 0 && this.animals.length < 6 && targets.length) {
      this.trySpawn(targets);
      this.spawnTimer = 4;
    }
    for (const a of this.animals) a.update(dt, this.world, targets);
    for (const a of this.animals) {
      // Despawn de animales que quedaron muy lejos de todos.
      const near = a.nearestTarget(targets);
      if (!a.dead && (!near || near.dist > 60)) {
        a.onDie = null; // despawn silencioso: sin soltar comida
        a.die();
      }
    }
    this.animals = this.animals.filter((a) => !a.dead);
  }

  trySpawn(targets) {
    const center = targets[Math.floor(Math.random() * targets.length)].pos;
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 14;
    const x = center.x + Math.cos(angle) * dist;
    const z = center.z + Math.sin(angle) * dist;
    const y = this.world.findSurface(Math.floor(x), Math.floor(z));
    const ground = this.world.getBlock(Math.floor(x), y - 1, Math.floor(z));
    if (y <= 0 || y >= CFG.HEIGHT - 2 || (ground !== 1 && ground !== 18)) return; // pasto o nieve
    const keys = Object.keys(SPECIES);
    const species = keys[Math.floor(Math.random() * keys.length)];
    const animal = new Animal(this.scene, species, x, y + 0.1, z);
    animal.onDie = () => this.onDrop(animal.def.drop, animal.species, animal.lastHitBy);
    this.animals.push(animal);
  }

  collectMeshes(out) {
    for (const a of this.animals) a.collectMeshes(out);
  }

  clear() {
    for (const a of this.animals) { a.onDie = null; a.die(); }
    this.animals = [];
  }
}
