// Zombis: aparecen de noche, persiguen al jugador y se queman de día.
class Zombie extends Creature {
  constructor(scene, x, y, z) {
    super(scene, x, y, z, 0.3, 1.9, 3);
    this.netType = 'zombie';
    this.attackCooldown = 0;
    this.burnTimer = 0;
    this.buildModel();
  }

  buildModel() {
    const skin = this.mat(0x4a9e4a);
    const shirt = this.mat(0x2a6ea0);
    const pants = this.mat(0x3a3a6e);

    this.legL = this.box(0.22, 0.75, 0.22, pants, -0.14, 0.375, 0);
    this.legR = this.box(0.22, 0.75, 0.22, pants, 0.14, 0.375, 0);
    this.box(0.55, 0.7, 0.3, shirt, 0, 1.1, 0); // torso
    this.armL = this.box(0.18, 0.6, 0.18, skin, -0.38, 1.3, 0.25);
    this.armR = this.box(0.18, 0.6, 0.18, skin, 0.38, 1.3, 0.25);
    const head = this.box(0.45, 0.45, 0.45, skin, 0, 1.7, 0);

    const eye = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), eye);
    eyeL.position.set(-0.1, 0.05, 0.23);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    head.add(eyeL, eyeR);
    this.armL.rotation.x = -Math.PI / 2.2;
    this.armR.rotation.x = -Math.PI / 2.2;
  }

  update(dt, world, targets, isNight) {
    if (this.dead) return;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.updateFlash(dt);

    // De día se queman.
    if (!isNight) {
      this.setEmissive(0xcc4400);
      this.burnTimer += dt;
      if (this.burnTimer > 0.5) { this.hurt(1); this.burnTimer = 0; }
    }

    const near = this.nearestTarget(targets);
    if (near && near.dist < 24 && near.dist > 0.3) {
      const { target, dist } = near;
      const speed = 1.9;
      this.vel.x = ((target.pos.x - this.pos.x) / dist) * speed;
      this.vel.z = ((target.pos.z - this.pos.z) / dist) * speed;
      this.group.rotation.y = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
      this.walkPhase += dt * 8;
      if (this.attackCooldown === 0 && dist < 1.3 &&
          Math.abs(target.pos.y - this.pos.y) < 2) {
        target.damage(1);
        this.attackCooldown = 1.2;
      }
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
    }

    if (this.hitWall && this.onGround) this.vel.y = CFG.JUMP_SPEED * 0.9;
    this.physics(dt, world);

    const swing = Math.sin(this.walkPhase) * 0.6;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;

    if (this.pos.y < -30) this.die();
  }
}

// Esqueleto: mantiene distancia y dispara flechas.
class Skeleton extends Creature {
  constructor(scene, x, y, z, onShoot) {
    super(scene, x, y, z, 0.3, 1.9, 3);
    this.netType = 'skeleton';
    this.onShoot = onShoot;
    this.shootTimer = 1.5;
    this.burnTimer = 0;
    this.buildModel();
  }

  buildModel() {
    const bone = this.mat(0xd8d8d0);
    const dark = this.mat(0x8a8a82);
    this.legL = this.box(0.14, 0.75, 0.14, bone, -0.12, 0.375, 0);
    this.legR = this.box(0.14, 0.75, 0.14, bone, 0.12, 0.375, 0);
    this.box(0.45, 0.65, 0.22, dark, 0, 1.1, 0); // costillas
    this.box(0.14, 0.55, 0.14, bone, -0.3, 1.3, 0);
    this.box(0.14, 0.55, 0.14, bone, 0.3, 1.3, 0.2);
    const head = this.box(0.42, 0.42, 0.42, bone, 0, 1.65, 0);
    const eye = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const ex of [-0.1, 0.1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.02), eye);
      e.position.set(ex, 0.04, 0.22);
      head.add(e);
    }
    // Arco de madera en la mano.
    const bow = this.mat(0x7a5a30);
    this.box(0.06, 0.7, 0.06, bow, 0.38, 1.3, 0.45);
  }

  update(dt, world, targets, isNight) {
    if (this.dead) return;
    this.updateFlash(dt);
    this.shootTimer -= dt;

    if (!isNight) {
      this.setEmissive(0xcc4400);
      this.burnTimer += dt;
      if (this.burnTimer > 0.5) { this.hurt(1); this.burnTimer = 0; }
    }

    const near = this.nearestTarget(targets);
    if (near && near.dist < 24) {
      const { target, dist } = near;
      const tx = target.pos.x - this.pos.x, tz = target.pos.z - this.pos.z;
      this.group.rotation.y = Math.atan2(tx, tz);
      // Mantener distancia: acercarse de lejos, alejarse de cerca.
      let dir = 0;
      if (dist > 12) dir = 1;
      else if (dist < 6) dir = -1;
      this.vel.x = (tx / dist) * 1.7 * dir;
      this.vel.z = (tz / dist) * 1.7 * dir;
      if (dir !== 0) this.walkPhase += dt * 7;

      if (this.shootTimer <= 0 && dist < 16) {
        this.shootTimer = 2.2;
        const from = this.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
        const aimAt = new THREE.Vector3(target.pos.x, target.pos.y + 1.1, target.pos.z);
        const aim = aimAt.sub(from).normalize();
        this.onShoot(from, aim);
      }
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
    }

    if (this.hitWall && this.onGround) this.vel.y = CFG.JUMP_SPEED * 0.9;
    this.physics(dt, world);

    const swing = Math.sin(this.walkPhase) * 0.5;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    if (this.pos.y < -30) this.die();
  }
}

// Araña: rápida, salta sobre el jugador.
class Spider extends Creature {
  constructor(scene, x, y, z) {
    super(scene, x, y, z, 0.45, 0.6, 2);
    this.netType = 'spider';
    this.attackCooldown = 0;
    this.leapCooldown = 0;
    this.burnTimer = 0;
    this.buildModel();
  }

  buildModel() {
    const body = this.mat(0x2a2a2a);
    const dark = this.mat(0x1a1a1a);
    this.box(0.7, 0.4, 0.9, body, 0, 0.35, -0.1);      // abdomen
    const head = this.box(0.45, 0.35, 0.4, dark, 0, 0.35, 0.5);
    const eye = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    for (const ex of [-0.12, 0.12]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.02), eye);
      e.position.set(ex, 0.05, 0.21);
      head.add(e);
    }
    this.legs = [];
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const leg = this.box(0.5, 0.07, 0.07, dark, side * 0.55, 0.3, -0.35 + i * 0.35);
        leg.rotation.z = side * 0.5;
        this.legs.push(leg);
      }
    }
  }

  update(dt, world, targets, isNight) {
    if (this.dead) return;
    this.updateFlash(dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.leapCooldown = Math.max(0, this.leapCooldown - dt);

    if (!isNight) {
      this.setEmissive(0xcc4400);
      this.burnTimer += dt;
      if (this.burnTimer > 0.5) { this.hurt(1); this.burnTimer = 0; }
    }

    const near = this.nearestTarget(targets);
    if (near && near.dist < 22 && near.dist > 0.3) {
      const { target, dist } = near;
      const tx = target.pos.x - this.pos.x, tz = target.pos.z - this.pos.z;
      this.group.rotation.y = Math.atan2(tx, tz);
      this.vel.x = (tx / dist) * 2.8;
      this.vel.z = (tz / dist) * 2.8;
      this.walkPhase += dt * 14;
      // Salto de ataque.
      if (dist < 3.5 && this.onGround && this.leapCooldown === 0) {
        this.vel.y = 6.5;
        this.vel.x = (tx / dist) * 5;
        this.vel.z = (tz / dist) * 5;
        this.leapCooldown = 1.6;
      }
      if (this.attackCooldown === 0 && dist < 1.4 &&
          Math.abs(target.pos.y - this.pos.y) < 2) {
        target.damage(1);
        this.attackCooldown = 1.1;
      }
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
    }

    if (this.hitWall && this.onGround) this.vel.y = CFG.JUMP_SPEED * 0.8;
    this.physics(dt, world);

    this.legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(this.walkPhase + i) * 0.4;
    });

    if (this.pos.y < -30) this.die();
  }
}

// Qué suelta cada enemigo al morir a manos de un jugador: [itemId, cantidad].
const MOB_DROPS = { zombie: [118, 1], skeleton: [110, 2], spider: [111, 1] };

class MobManager {
  // targetsFn: () => lista de jugadores atacables (local y remotos).
  constructor(scene, world, targetsFn, onShoot, onDrop) {
    this.scene = scene;
    this.world = world;
    this.targetsFn = targetsFn;
    this.onShoot = onShoot; // (origen, dirección) => flecha hostil
    this.onDrop = onDrop;   // (itemId, n, killer) => botín para quien lo mató
    this.zombies = []; // todos los enemigos (nombre histórico)
    this.spawnTimer = 0;
  }

  // maxMobs: tope de la noche (sube con los días sobrevividos).
  update(dt, isNight, maxMobs = CFG.MAX_ZOMBIES) {
    const targets = this.targetsFn();
    this.spawnTimer -= dt;
    if (isNight && this.spawnTimer <= 0 && this.zombies.length < maxMobs && targets.length) {
      this.trySpawn(targets);
      this.spawnTimer = 6;
    }
    for (const z of this.zombies) z.update(dt, this.world, targets, isNight);
    this.zombies = this.zombies.filter((z) => !z.dead);
  }

  trySpawn(targets) {
    const center = targets[Math.floor(Math.random() * targets.length)].pos;
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 12;
    const x = center.x + Math.cos(angle) * dist;
    const z = center.z + Math.sin(angle) * dist;
    const y = this.world.findSurface(Math.floor(x), Math.floor(z));
    if (y <= 0 || y >= CFG.HEIGHT - 2) return;
    if (this.world.getBlock(Math.floor(x), y, Math.floor(z)) === 17) return; // no en el agua
    const roll = Math.random();
    let mob;
    if (roll < 0.5) mob = new Zombie(this.scene, x, y + 0.1, z);
    else if (roll < 0.75) mob = new Skeleton(this.scene, x, y + 0.1, z, this.onShoot);
    else mob = new Spider(this.scene, x, y + 0.1, z);
    mob.onDie = () => {
      // Solo hay botín si lo mató un jugador (no al quemarse de día).
      if (mob.lastHitBy === undefined || !this.onDrop) return;
      const drop = MOB_DROPS[mob.netType];
      if (drop) this.onDrop(drop[0], drop[1], mob.lastHitBy);
    };
    this.zombies.push(mob);
  }

  collectMeshes(out) {
    for (const z of this.zombies) z.collectMeshes(out);
  }

  clear() {
    for (const z of this.zombies) { z.onDie = null; z.die(); }
    this.zombies = [];
  }
}
