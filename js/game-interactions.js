// Extracted Game methods for game-interactions.
const GameInteractions = {
  sleep(pos) {
    this.respawnPoint = { x: pos.x + 0.5, y: pos.y + 1.2, z: pos.z + 0.5 };
    if (this.map.dayNight && this.daynight.isNight()) {
      this.daynight.time = 0.25; // amanecer
      if (this.net) NET.send({ t: 'time', v: 0.25 });
      this.ui.toast(t('bedSleep'));
    } else {
      this.ui.toast(t('bedSpawn'));
    }
  },

  sit(pos) {
    // El asiento (rodilla) queda a ras de la cara superior del bloque silla.
    this.player.pos.set(pos.x + 0.5, pos.y + 1 - 0.78, pos.z + 0.5);
    this.player.vel.set(0, 0, 0);
    this.player.sitting = true;
    // En mapas con vista FIFA, cambiar a tercera persona para verse sentado.
    if (this.map.thirdPerson && this.cameraMode !== 'third') {
      this.sitPrevView = 'pov';
      this.cameraMode = 'third';
    }
    this.ui.toast(t('sitDown'));
  },

  standUp() {
    if (!this.player.sitting) return;
    this.player.sitting = false;
    if (this.ownAvatar) this.ownAvatar.setSitting(false);
    if (this.sitPrevView === 'pov') this.cameraMode = 'pov';
    this.sitPrevView = null;
    this.ui.toast(t('standUp'));
  },

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
  },

  openPicker() {
    if (!this.map.canBuild || !this.inventory.entries.length ||
        this.player.dead || this.state.won) return;
    document.exitPointerLock();
    this.picker.onClose = this.relockOnClose();
    this.picker.show(
      this.atlasCanvas, this.inventory.entries, this.controls.selectedSlot,
      (i) => this.controls.selectSlot(i)
    );
  },

  relockOnClose() {
    return () => {
      if (this.player.dead) return;
      if (this.queuedEgg) { this.queuedEgg = false; this.showEgg(); return; }
      this.ui.showPlaying(false); // overlay visible hasta que el pointer lock engancha
      this.controls.lock();
    };
  },

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
  },

  milestone(flag) {
    if (!Eggs.once(flag)) return;
    if (this.crafting.open || this.chestUI.open) this.queuedEgg = true;
    else this.showEgg();
  },

  craftAction() {
    return (recipe) => {
      if (!this.inventory.canAfford(recipe.cost)) return;
      this.inventory.pay(recipe.cost);
      this.inventory.add(recipe.out.id, recipe.out.n);
      this.ui.toast(`${nameOf(recipe.out.id)} ✔`);
      if ([100, 101, 102, 114, 115, 116].includes(recipe.out.id)) this.milestone('primerArma');
    };
  },

  openCrafting() {
    if (!this.map.crafting || this.player.dead || this.state.won) return;
    document.exitPointerLock();
    this.crafting.onClose = this.relockOnClose();
    this.crafting.show(this.atlasCanvas, this.inventory, this.nearTable(), this.craftAction());
  },

  openFurnace() {
    if (!this.map.crafting || this.player.dead || this.state.won) return;
    document.exitPointerLock();
    this.crafting.onClose = this.relockOnClose();
    this.crafting.show(
      this.atlasCanvas, this.inventory, true, this.craftAction(),
      FURNACE_RECIPES, 'furnaceTitle'
    );
  },

  openChest(x, y, z) {
    if (this.inventory.isFree() || this.player.dead || this.state.won) return;
    const key = `${x},${y},${z}`;
    if (!this.chests[key]) this.chests[key] = [];
    document.exitPointerLock();
    this.chestUI.onClose = this.relockOnClose();
    this.chestUI.show(this.atlasCanvas, this.chests[key], this.inventory);
  },

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
      if (this.player.sitting) { this.standUp(); return; }
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
        if (targetId === 25) {
          if (this.player.sitting) this.standUp(); else this.sit(target.inside);
          return;
        }
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
};
