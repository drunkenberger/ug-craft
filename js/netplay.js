// Piezas visuales del multijugador: avatares de otros jugadores y
// "títeres" de mobs (los simula el anfitrión, los demás solo los dibujan).
const AVATAR_COLORS = [0x2a5ac0, 0xd08a2a, 0x8a2ac0, 0x2ac0a0];

class RemoteAvatar {
  constructor(scene, peerId) {
    this.model = new Humanoid(scene, 0, -50, 0, {
      ...Character.DEFAULT,
      shirt: AVATAR_COLORS[peerId % AVATAR_COLORS.length],
    });
    this.pos = new THREE.Vector3(0, -50, 0); // posición real reportada
    this.yaw = 0;
    this.phase = 0;
    this.lastPos = new THREE.Vector3();
  }

  // Apariencia personalizada del otro jugador (llega por red al conectarse).
  setAppearance(app) {
    if (app) this.model.build({ ...Character.DEFAULT, ...app });
  }

  setTarget(x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
  }

  update(dt) {
    const g = this.model.group;
    g.position.lerp(this.pos, Math.min(1, dt * 12));
    g.rotation.y = this.yaw + Math.PI;
    const speed = g.position.distanceTo(this.lastPos) / Math.max(dt, 0.001);
    this.lastPos.copy(g.position);
    if (speed > 0.8) {
      this.phase += dt * 10;
      this.model.swingLegs(this.phase);
    } else {
      this.model.swingLegs(0);
    }
  }

  dispose() { this.model.die(); }
}

class PuppetManager {
  constructor(scene) {
    this.scene = scene;
    this.puppets = new Map(); // netId → { creature, target }
  }

  apply(list) {
    const seen = new Set();
    for (const e of list) {
      seen.add(e.k);
      let p = this.puppets.get(e.k);
      if (!p) {
        p = { creature: this.create(e), target: new THREE.Vector3(e.x, e.y, e.z), ry: e.ry };
        this.puppets.set(e.k, p);
      }
      p.target.set(e.x, e.y, e.z);
      p.ry = e.ry;
      // Perro adoptado en el anfitrión: el títere muestra el collar (y la cola).
      if (e.tm && !p.creature.tamed && p.creature.setTamed) p.creature.setTamed(null);
    }
    for (const [k, p] of this.puppets) {
      if (!seen.has(k)) { p.creature.die(); this.puppets.delete(k); }
    }
  }

  create(e) {
    let c;
    if (e.ty === 'zombie') c = new Zombie(this.scene, e.x, e.y, e.z);
    else if (e.ty === 'skeleton') c = new Skeleton(this.scene, e.x, e.y, e.z, () => {});
    else if (e.ty === 'spider') c = new Spider(this.scene, e.x, e.y, e.z);
    else c = new Animal(this.scene, e.ty, e.x, e.y, e.z);
    c.netId = e.k; // usar el id del anfitrión para reportar golpes
    return c;
  }

  update(dt) {
    for (const p of this.puppets.values()) {
      p.creature.group.position.lerp(p.target, Math.min(1, dt * 12));
      p.creature.pos.copy(p.creature.group.position);
      p.creature.group.rotation.y = p.ry;
      if (p.creature.tail) { // cola del perro también en los títeres
        p.creature.wagT += dt;
        p.creature.tail.rotation.y = Math.sin(p.creature.wagT * (p.creature.tamed ? 9 : 3)) * 0.4;
      }
    }
  }

  collectMeshes(out) {
    for (const p of this.puppets.values()) p.creature.collectMeshes(out);
  }

  findById(netId) {
    const p = this.puppets.get(netId);
    return p ? p.creature : null;
  }

  clear() {
    for (const p of this.puppets.values()) p.creature.die();
    this.puppets.clear();
  }
}
