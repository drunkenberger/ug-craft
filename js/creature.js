// Base común de zombis y animales: cuerpo físico, modelo por cajas y daño.
class Creature {
  static nextNetId = 1;

  constructor(scene, x, y, z, halfW, height, health) {
    this.scene = scene;
    this.netId = Creature.nextNetId++; // identificador para multijugador
    this.netType = 'creature';
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.halfW = halfW;
    this.height = height;
    this.health = health;
    this.onGround = false;
    this.hitWall = false;
    this.dead = false;
    this.flashTimer = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.materials = [];
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  mat(color) {
    const m = new THREE.MeshLambertMaterial({ color });
    this.materials.push(m);
    return m;
  }

  box(w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  setEmissive(hex) {
    this.materials.forEach((m) => m.emissive.setHex(hex));
  }

  physics(dt, world) {
    this.vel.y += CFG.GRAVITY * dt;
    moveBody(world, this, dt);
    this.group.position.copy(this.pos);
  }

  updateFlash(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.setEmissive(0x000000);
    }
  }

  hurt(n, knockDir, by) {
    if (this.dead) return;
    this.health -= n;
    if (by !== undefined) this.lastHitBy = by; // quién lo golpeó (multijugador)
    this.flashTimer = 0.3;
    this.setEmissive(0xaa0000);
    if (knockDir) {
      this.vel.x += knockDir.x * 6;
      this.vel.z += knockDir.z * 6;
      this.vel.y = 4;
    }
    this.onHurt && this.onHurt();
    if (this.health <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.onDie && this.onDie();
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.materials.forEach((m) => m.dispose());
  }

  // Objetivo (jugador) vivo más cercano en horizontal.
  nearestTarget(targets) {
    let best = null, bestD = Infinity;
    for (const tg of targets) {
      if (tg.dead) continue;
      const d = Math.hypot(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z);
      if (d < bestD) { bestD = d; best = tg; }
    }
    return best ? { target: best, dist: bestD } : null;
  }

  // Mallas golpeables (para raycast de ataques).
  collectMeshes(out) {
    this.group.traverse((o) => {
      if (o.isMesh) { o.userData.creature = this; out.push(o); }
    });
  }
}
