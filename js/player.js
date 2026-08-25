// Jugador: movimiento, salto, vida y daño; las reglas varían según el mapa.
class Player {
  constructor(world, rules, onDamage, onDeath) {
    this.world = world;
    this.rules = rules; // { fallDamage, onVoidFall }
    this.onDamage = onDamage;
    this.onDeath = onDeath;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.halfW = CFG.PLAYER_HALF_W;
    this.height = CFG.PLAYER_HEIGHT;
    this.onGround = false;
    this.hitWall = false;
    this.health = CFG.MAX_HEALTH;
    this.hunger = CFG.MAX_HUNGER;
    this.hungerTimer = 0;
    this.starveTimer = 0;
    this.invulnTimer = 0;
    this.regenTimer = 0;
    this.inWater = false;
    this.dead = false;
    this.stunTimer = 0; // derribado por una barrida (fútbol)
  }

  // spawn: {x, z, y?} — si no trae y, se usa la superficie del terreno.
  respawn(spawn) {
    const y = spawn.y !== undefined
      ? spawn.y
      : this.world.findSurface(Math.floor(spawn.x), Math.floor(spawn.z)) + 0.5;
    this.pos.set(spawn.x, y, spawn.z);
    this.vel.set(0, 0, 0);
    this.health = CFG.MAX_HEALTH;
    this.hunger = CFG.MAX_HUNGER;
    this.hungerTimer = 0;
    this.starveTimer = 0;
    this.dead = false;
    this.sitting = false;
  }

  eyePosition() {
    return new THREE.Vector3(this.pos.x, this.pos.y + CFG.EYE_HEIGHT, this.pos.z);
  }

  update(dt, controls) {
    if (this.dead) return;

    // Sentado en una silla: sin movimiento ni física, pero el hambre sigue.
    if (this.sitting) {
      this.vel.set(0, 0, 0);
      this.updateVitals(dt);
      return;
    }

    // Derribado por una barrida: sin control un momento, con inercia y gravedad.
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.vel.x *= 0.86;
      this.vel.z *= 0.86;
      this.vel.y = Math.max(this.vel.y + CFG.GRAVITY * dt, -50);
      moveBody(this.world, this, dt);
      this.updateVitals(dt);
      return;
    }

    // ¿Está nadando? (agua a la altura de los pies o del pecho)
    const bx = Math.floor(this.pos.x), bz = Math.floor(this.pos.z);
    this.inWater =
      this.world.getBlock(bx, Math.floor(this.pos.y + 0.3), bz) === 17 ||
      this.world.getBlock(bx, Math.floor(this.pos.y + 1.2), bz) === 17;

    if (this.rules.driving) {
      // Modo kart: W/S aceleran y frenan, A/D giran el volante.
      this.updateKart(dt, controls);
    } else {
      const move = controls.getMoveVector();
      const sin = Math.sin(controls.yaw), cos = Math.cos(controls.yaw);
      const speed = CFG.PLAYER_SPEED * (this.inWater ? 0.55 : 1);
      this.vel.x = (move.x * cos + move.z * sin) * speed;
      this.vel.z = (move.z * cos - move.x * sin) * speed;
    }

    // Impulso externo (p. ej. barrida en fútbol).
    if (this.boost && this.boost.t > 0) {
      this.vel.x += this.boost.x;
      this.vel.z += this.boost.z;
      this.boost.t -= dt;
    }

    if (!this.rules.driving && controls.keys.has('Space')) {
      if (this.inWater) this.vel.y = 3.4; // nadar hacia arriba
      else if (this.onGround) this.vel.y = CFG.JUMP_SPEED;
    }
    this.vel.y += CFG.GRAVITY * (this.inWater ? 0.3 : 1) * dt;
    this.vel.y = Math.max(this.vel.y, this.inWater ? -3 : -50);

    const prevVy = this.vel.y;
    moveBody(this.world, this, dt);

    if (this.rules.fallDamage && this.onGround && prevVy < -13 && !this.inWater) {
      this.damage(1 + Math.floor((-prevVy - 13) / 4));
    }
    if (this.pos.y < -20) {
      if (this.rules.onVoidFall) this.rules.onVoidFall();
      else this.damage(100, true);
    }

    this.updateVitals(dt);
  }

  // Temporizadores de invulnerabilidad, hambre y regeneración (siguen sentado).
  updateVitals(dt) {
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    // Hambre (solo supervivencia): baja despacio; sin comida no hay regeneración
    // y con la barra vacía se pierde vida (nunca por debajo de 3 corazones).
    if (this.rules.hunger) {
      this.hungerTimer += dt;
      if (this.hungerTimer > 35) {
        this.hungerTimer = 0;
        if (this.hunger > 0) { this.hunger--; this.onDamage(); }
      }
      if (this.hunger <= 0) {
        this.starveTimer += dt;
        if (this.starveTimer > 8) {
          this.starveTimer = 0;
          if (this.health > 3) this.damage(1);
        }
      }
    }

    this.regenTimer += dt;
    if (this.regenTimer > 8 && this.health < CFG.MAX_HEALTH &&
        (!this.rules.hunger || this.hunger >= 7)) {
      this.health++;
      this.regenTimer = 0;
      this.onDamage();
    }
  }

  // Física de kart: velocidad con aceleración/fricción y giro con A/D.
  updateKart(dt, controls) {
    this.kartSpeed = this.kartSpeed || 0;
    const k = controls.keys;
    const fwd = k.has('KeyW') || k.has('ArrowUp');
    const back = k.has('KeyS') || k.has('ArrowDown');
    const left = (k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0;
    const right = (k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0;
    const max = this.kartMax || 9;

    if (fwd) this.kartSpeed += 13 * dt;
    else if (back) this.kartSpeed -= 11 * dt;
    else this.kartSpeed *= Math.max(0, 1 - 1.6 * dt);
    // Frenado suave al exceder el límite de la superficie (pasto, fin del turbo).
    if (this.kartSpeed > max) this.kartSpeed = Math.max(max, this.kartSpeed - 16 * dt);
    this.kartSpeed = Math.max(-4, this.kartSpeed);

    const steer = left - right;
    controls.yaw += steer * 2.4 * dt *
      Math.min(1, Math.abs(this.kartSpeed) / 3) * Math.sign(this.kartSpeed || 1);

    this.vel.x = -Math.sin(controls.yaw) * this.kartSpeed;
    this.vel.z = -Math.cos(controls.yaw) * this.kartSpeed;
  }

  damage(n, ignoreInvuln = false) {
    if (this.dead || (this.invulnTimer > 0 && !ignoreInvuln)) return;
    this.health = Math.max(0, this.health - n);
    this.invulnTimer = 0.6;
    this.regenTimer = 0;
    this.onDamage(true);
    if (this.health <= 0) {
      this.dead = true;
      this.onDeath();
    }
  }

  // ¿El bloque (x,y,z) chocaría con el jugador? (para no ponerse bloques encima)
  wouldCollide(x, y, z) {
    return bodyIntersectsBlock(this, x, y, z);
  }
}
