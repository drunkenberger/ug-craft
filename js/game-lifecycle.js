// Extracted Game methods for game-lifecycle.
const GameLifecycle = {
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
    if (this.player.sitting !== this.ownAvatar.sitting) {
      this.ownAvatar.setSitting(this.player.sitting);
    }
    if (this.player.sitting) { this.lastOwnPos.copy(this.player.pos); return; }
    const speed = this.player.pos.distanceTo(this.lastOwnPos) / Math.max(dt, 0.001);
    this.lastOwnPos.copy(this.player.pos);
    if (speed > 0.8) {
      this.ownAvatarPhase += dt * 10;
      this.ownAvatar.swingLegs(this.ownAvatarPhase);
    } else {
      this.ownAvatar.swingLegs(0);
    }
  },

  respawnPlayer() {
    if (this.sitPrevView === 'pov') this.cameraMode = 'pov';
    this.sitPrevView = null;
    if (this.ownAvatar) this.ownAvatar.setSitting(false);
    if (this.mobs) this.mobs.clear();
    this.player.respawn(this.respawnPoint || this.spawn);
    this.renderHearts();
  },

  update(dt) {
    this.world.update(this.player.pos.x, this.player.pos.z);
    const active = this.controls.locked && !this.player.dead && !this.state.won;

    // Sentado: cualquier tecla de movimiento levanta al jugador.
    if (this.player.sitting && active) {
      const k = this.controls.keys;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
           'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((c) => k.has(c))) {
        this.standUp();
      }
    }

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
  },

  save() {
    if (!this.map.save) return;
    // Partida compartida: mundo y estado viven en el servidor, no en localStorage.
    if (this.gameId) { this.savePlayerState(); return; }
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
  },

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
  },

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  },

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
};
