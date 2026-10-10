// Golem de hierro: defiende a su dueño (o a la aldea) de zombis, esqueletos, arañas y creepers.
const HOSTILE_MOBS = ['zombie', 'skeleton', 'spider', 'creeper'];
const GOLEM_MAX_PER_PLAYER = 3;

class IronGolem extends Creature {
  // owner: 'local' o id de peer (golem fabricado); null = guardián de aldea.
  constructor(scene, x, y, z, owner = null) {
    super(scene, x, y, z, 0.5, 2.8, 20);
    this.netType = 'irongolem';
    this.species = 'irongolem'; // así lo guarda serializePets junto a las mascotas
    this.owner = owner;
    this.home = this.pos.clone();
    this.attackCooldown = 0;
    this.armSwing = 0;
    this.wanderTimer = 0;
    this.moveDir = null;
    this.buildModel();
  }

  buildModel() {
    const iron = this.mat(0xc9ccd2), dark = this.mat(0x9aa0a8), vine = this.mat(0x5a8a3a);
    const eye = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    this.legL = this.box(0.4, 1.0, 0.4, dark, -0.28, 0.5, 0);
    this.legR = this.box(0.4, 1.0, 0.4, dark, 0.28, 0.5, 0);
    this.box(0.8, 0.5, 0.5, dark, 0, 1.2, 0);
    this.box(1.4, 1.0, 0.8, iron, 0, 1.9, 0);
    this.box(0.5, 0.35, 0.05, vine, 0.2, 1.8, 0.42);
    const head = this.box(0.5, 0.5, 0.5, iron, 0, 2.6, 0);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.16), dark);
    nose.position.set(0, -0.05, 0.3);
    head.add(nose);
    for (const ex of [-0.12, 0.12]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), eye);
      e.position.set(ex, 0.08, 0.26);
      head.add(e);
    }
    this.arms = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.95, 2.35, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, 0.4), dark);
      arm.position.y = -0.65;
      pivot.add(arm);
      this.group.add(pivot);
      return pivot;
    });
  }

  // Quien lo fabricó no puede dañarlo por accidente.
  hurt(n, knockDir, by) {
    if (by !== undefined && this.owner && by === this.owner) return;
    super.hurt(n, knockDir && { x: knockDir.x * 0.2, z: knockDir.z * 0.2 }, by);
  }

  nearestFoe(mobs) {
    let best = null, bestD = 16;
    for (const m of mobs) {
      if (m.dead || !HOSTILE_MOBS.includes(m.netType) || Math.abs(m.pos.y - this.pos.y) > 4) continue;
      const d = Math.hypot(m.pos.x - this.pos.x, m.pos.z - this.pos.z);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best ? { foe: best, dist: bestD } : null;
  }

  // Decide hacia dónde caminar: dueño lejos > enemigo > seguir al dueño > patrullar.
  steer(dt, targets, mobs) {
    const owner = this.owner && targets.find((tg) => tg.id === this.owner && !tg.dead);
    const ownerDist = owner ? Math.hypot(owner.pos.x - this.pos.x, owner.pos.z - this.pos.z) : 0;
    if (owner && ownerDist > 30) {
      this.pos.set(owner.pos.x + 1, owner.pos.y + 0.5, owner.pos.z + 1);
      this.vel.set(0, 0, 0);
      return null;
    }
    const near = !(owner && ownerDist > 20) && this.nearestFoe(mobs);
    if (near) {
      const { foe, dist } = near, dx = foe.pos.x - this.pos.x, dz = foe.pos.z - this.pos.z;
      if (dist < 2.4 && this.attackCooldown === 0) {
        const k = dist || 1;
        foe.hurt(7, { x: dx / k, z: dz / k }, this.owner === null ? undefined : this.owner);
        this.attackCooldown = 1;
        this.armSwing = 0.4;
      }
      return dist > 1.6 ? { x: dx / (dist || 1), z: dz / (dist || 1), speed: 3 } : { x: 0, z: 0, speed: 0, face: Math.atan2(dx, dz) };
    }
    if (owner) {
      if (ownerDist <= 5) return null;
      return { x: (owner.pos.x - this.pos.x) / ownerDist, z: (owner.pos.z - this.pos.z) / ownerDist, speed: ownerDist > 12 ? 4 : 2.4 };
    }
    return this.patrol(dt);
  }

  patrol(dt) {
    this.wanderTimer -= dt;
    const homeD = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z);
    if (homeD > 8) {
      return { x: (this.home.x - this.pos.x) / homeD, z: (this.home.z - this.pos.z) / homeD, speed: 1.2 };
    }
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 3 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2;
      this.moveDir = Math.random() < 0.5 ? { x: Math.cos(a), z: Math.sin(a), speed: 0.7 } : null;
    }
    return this.moveDir;
  }

  update(dt, world, targets, isNight, mobs = []) {
    if (this.dead) return;
    this.updateFlash(dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.armSwing = Math.max(0, this.armSwing - dt);
    const go = this.steer(dt, targets, mobs);
    if (go && go.speed) {
      this.vel.x = go.x * go.speed;
      this.vel.z = go.z * go.speed;
      this.group.rotation.y = Math.atan2(go.x, go.z);
      this.walkPhase += dt * go.speed * 3;
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
      if (go && go.face !== undefined) this.group.rotation.y = go.face;
    }
    if (this.hitWall && this.onGround) this.vel.y = CFG.JUMP_SPEED * 0.9;
    this.physics(dt, world);
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    const raise = this.armSwing > 0 ? -Math.PI * 0.8 * Math.sin((this.armSwing / 0.4) * Math.PI) : 0;
    this.arms[0].rotation.x = raise || -swing * 0.4;
    this.arms[1].rotation.x = raise || swing * 0.4;
    if (this.pos.y < -30) { this.onDie = null; this.die(); }
  }
}

// Fabrica un golem donde apunta el jugador (el anfitrión lo crea; un invitado se lo pide).
function placeGolem(g, target) {
  if (!g.mobs) { g.ui.toast(t('golemNeedsMobs')); return true; }
  if (!target) return true;
  const { x, y, z } = target.outside;
  if ([0, 1, 2].some((dy) => g.world.isSolid(x, y + dy, z))) { g.ui.toast(t('golemNoSpace')); return true; }
  const me = g.net && !NET.isHost ? NET.id : 'local';
  const owned = g.hittableCreatures().filter((c) => c.netType === 'irongolem' && !c.dead && c.owner === me);
  if (owned.length >= GOLEM_MAX_PER_PLAYER) { g.ui.toast(t('golemLimit')); return true; }
  if (!g.inventory.isFree() && !g.inventory.remove(g.selectedId(), 1)) return true;
  if (g.net && !NET.isHost) NET.send({ t: 'golem', x, y, z });
  else g.mobs.spawnGolem(x + 0.5, y, z + 0.5, 'local');
  g.ui.toast(t('golemPlaced'));
  return true;
}
