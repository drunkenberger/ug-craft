// Extracted Game methods for game-combat.
const GameCombat = {
  centerRay() {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    return this.raycaster;
  },

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
  },

  targetCreature() {
    const meshes = [];
    if (this.mobs) this.mobs.collectMeshes(meshes);
    if (this.animals) this.animals.collectMeshes(meshes);
    if (this.puppets) this.puppets.collectMeshes(meshes);
    const hits = this.centerRay().intersectObjects(meshes);
    return hits.length ? hits[0].object.userData.creature : null;
  },

  hittableCreatures() {
    const list = [];
    if (this.mobs) list.push(...this.mobs.zombies);
    if (this.animals) list.push(...this.animals.animals);
    if (this.puppets) for (const p of this.puppets.puppets.values()) list.push(p.creature);
    return list;
  },

  tameDog(creature) {
    if (this.net && !NET.isHost) {
      NET.send({ t: 'tame', mob: creature.netId });
    } else {
      creature.setTamed('local');
    }
    this.ui.toast(t('dogAdopted'), 4000);
    this.milestone('primerPerro');
  },

  damageCreature(creature, dmg, dir) {
    if (this.net && !NET.isHost) {
      NET.send({ t: 'hit', mob: creature.netId, dmg, kx: dir.x, kz: dir.z });
    } else {
      creature.hurt(dmg, dir, 'local');
    }
  },

  meleeDamage() {
    const def = ITEMS[this.selectedId()];
    return def && def.kind === 'weapon' ? def.damage : 1;
  },

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
  },

  spawnBolt(from, dir, hostile, remote = false) {
    const mesh = new THREE.Mesh(this.boltGeo, hostile ? this.hostileBoltMat : this.boltMat);
    mesh.position.copy(from);
    mesh.lookAt(from.clone().add(dir));
    this.scene.add(mesh);
    this.bolts.push({ mesh, vel: dir.clone().multiplyScalar(hostile ? 18 : 26), life: 3, hostile, remote });
  },

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
  },

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
  },

  pickTier() {
    const def = ITEMS[this.selectedId()];
    return def && def.pickTier ? def.pickTier : 0;
  }
};
