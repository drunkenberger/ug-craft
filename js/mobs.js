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

class Creeper extends Creature {
  constructor(scene, x, y, z, onExplodeBlock) {
    super(scene, x, y, z, 0.34, 1.7, 4);
    this.netType = 'creeper';
    this.onExplodeBlock = onExplodeBlock;
    this.fuse = 0;
    this.buildModel();
  }

  buildModel() {
    const green = this.mat(0x4caa45);
    const dark = this.mat(0x1f5a24);
    this.legL = this.box(0.22, 0.55, 0.22, green, -0.16, 0.275, 0.16);
    this.legR = this.box(0.22, 0.55, 0.22, green, 0.16, 0.275, -0.16);
    this.box(0.48, 0.9, 0.36, green, 0, 0.95, 0);
    const head = this.box(0.58, 0.5, 0.5, green, 0, 1.55, 0);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.03), dark);
    eyeL.position.set(-0.13, 0.06, 0.26);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.03), dark);
    mouth.position.set(0, -0.12, 0.26);
    head.add(eyeL, eyeR, mouth);
  }

  update(dt, world, targets) {
    if (this.dead) return;
    this.updateFlash(dt);
    const near = this.nearestTarget(targets);
    if (near && near.dist < 22 && near.dist > 0.25) {
      const { target, dist } = near;
      const tx = target.pos.x - this.pos.x, tz = target.pos.z - this.pos.z;
      this.group.rotation.y = Math.atan2(tx, tz);
      const speed = dist < 3 ? 1.15 : 1.8;
      this.vel.x = (tx / dist) * speed;
      this.vel.z = (tz / dist) * speed;
      this.walkPhase += dt * 8;
      if (dist < 2.4 && Math.abs(target.pos.y - this.pos.y) < 2.2) {
        this.fuse += dt;
        this.setEmissive(Math.floor(this.fuse * 10) % 2 ? 0xffffff : 0x335533);
        if (this.fuse >= 1.6) this.explode(world, targets);
      } else {
        this.fuse = Math.max(0, this.fuse - dt * 0.7);
        if (this.fuse === 0 && this.flashTimer <= 0) this.setEmissive(0x000000);
      }
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
      this.fuse = Math.max(0, this.fuse - dt);
    }
    if (this.hitWall && this.onGround) this.vel.y = CFG.JUMP_SPEED * 0.8;
    this.physics(dt, world);
    const swing = Math.sin(this.walkPhase) * 0.45;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    if (this.pos.y < -30) this.die();
  }

  explode(world, targets) {
    if (this.dead) return;
    const center = this.pos.clone();
    const radius = 2.4;
    for (const target of targets) {
      const d = target.pos.distanceTo(center);
      if (d < radius + 1.2) target.damage(Math.max(1, Math.ceil(4 - d)));
    }
    const cx = Math.floor(center.x), cy = Math.floor(center.y), cz = Math.floor(center.z);
    if(this.allowTerrainDamage !== false) for (let x = cx - 2; x <= cx + 2; x++) {
      for (let y = cy - 1; y <= cy + 2; y++) {
        for (let z = cz - 2; z <= cz + 2; z++) {
          if (y <= 0 || y >= CFG.HEIGHT) continue;
          if (Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y, z + 0.5 - center.z) > radius) continue;
          const id = world.getBlock(x, y, z);
          if (!id || BLOCKS[id]?.unbreakable || id === 17 || id === 8 || id === 12 || id === 13) continue;
          world.setBlock(x, y, z, 0);
          if (this.onExplodeBlock) this.onExplodeBlock(x, y, z, 0);
        }
      }
    }
    this.die();
  }
}

// Mercader neutral: camina de día y de noche, con hocico, orejas y cinturón de oro.
class Piglin extends Zombie {
  buildModel() {
    const skin=this.mat(0xd49a87), cloth=this.mat(0x614735), gold=this.mat(0xe8b941);
    this.legL=this.box(.23,.7,.25,cloth,-.15,.35,0);
    this.legR=this.box(.23,.7,.25,cloth,.15,.35,0);
    this.box(.58,.7,.34,cloth,0,1.05,0);
    this.box(.6,.12,.36,gold,0,.85,0);
    this.box(.55,.5,.46,skin,0,1.65,0);
    this.box(.3,.18,.2,skin,0,1.55,.3);
    for (const side of [-1,1]) {
      this.box(.19,.24,.12,skin,side*.34,1.8,0);
      this.box(.08,.08,.03,cloth,side*.13,1.7,.24);
      this.box(.07,.14,.05,gold,side*.12,1.48,.4);
      this.box(.18,.6,.2,skin,side*.4,1.08,0);
    }
  }
  constructor(scene,x,y,z) {
    super(scene,x,y,z);
    this.netType='piglin'; this.home=this.pos.clone();
  }
  update(dt,world,targets) {
    if (this.dead) return;
    this.updateFlash(dt); this.walkPhase+=dt*2;
    const near=this.nearestTarget(targets);
    const back=this.pos.distanceTo(this.home)>6;
    let angle=back ? Math.atan2(this.home.x-this.pos.x,this.home.z-this.pos.z) : this.walkPhase*.15;
    const stop=near && near.dist<4;
    if (stop) angle=Math.atan2(near.target.pos.x-this.pos.x,near.target.pos.z-this.pos.z);
    this.group.rotation.y=angle;
    this.vel.x=stop ? 0 : Math.sin(angle)*.65;
    this.vel.z=stop ? 0 : Math.cos(angle)*.65;
    if (this.hitWall && this.onGround) this.vel.y=CFG.JUMP_SPEED*.8;
    this.physics(dt,world);
    this.legL.rotation.x=stop ? 0 : Math.sin(this.walkPhase)*.35;
    this.legR.rotation.x=-this.legL.rotation.x;
    if (this.pos.y < -30 || (near && near.dist>80)) this.die();
  }
}

// Qué suelta cada enemigo al morir a manos de un jugador: [itemId, cantidad].
const MOB_DROPS = { zombie: [118, 1], skeleton: [110, 2], spider: [111, 1], creeper: [111, 2] };

class MobManager {
  // targetsFn: () => lista de jugadores atacables (local y remotos).
  constructor(scene, world, targetsFn, onShoot, onDrop, onBlockChange) {
    this.scene = scene;
    this.world = world;
    this.targetsFn = targetsFn;
    this.onBlockChange = onBlockChange;
    this.piglinTimer = 0;
    this.onShoot = onShoot; // (origen, dirección) => flecha hostil
    this.onDrop = onDrop;   // (itemId, n, killer) => botín para quien lo mató
    this.zombies = []; // todos los enemigos (nombre histórico)
    this.spawnTimer = 0;
  }

  // maxMobs: tope de la noche (sube con los días sobrevividos).
  update(dt, isNight, maxMobs = CFG.MAX_ZOMBIES) {
    const targets = this.targetsFn();
    this.piglinTimer -= dt;
    if (this.piglinTimer <= 0 && targets.length && this.zombies.filter(c => c.netType === 'piglin').length < 2*targets.length) {
      this.piglinTimer = 12;
      const p=(targets.find(t=>!this.zombies.some(c=>c.netType==='piglin' && c.pos.distanceTo(t.pos)<45)) || targets[Math.floor(Math.random()*targets.length)]).pos, x=Math.floor(p.x+12), z=Math.floor(p.z+8);
      const y=this.world.findSurface(x,z);
      if (y < CFG.HEIGHT-2 && this.world.getBlock(x,y,z)!==17)
        this.zombies.push(new Piglin(this.scene,x+.5,y,z+.5));
    }
    if (this.villageTimer === undefined) this.villageTimer=0;
    this.villageTimer-=dt;
    if(this.villageTimer<=0) {
      this.villageTimer=5;
      for(const target of targets) {
        if(isAdventureZone(target.pos.x,target.pos.z)) continue;
        const x=Math.round((target.pos.x-40)/192)*192+40,z=Math.round((target.pos.z-40)/192)*192+40;
        if(Math.hypot(target.pos.x-x,target.pos.z-z)>55) continue;
        const y=Math.max(CFG.SEA_LEVEL+2,survivalHeightAt(this.world,x,z))+1;
        for(const [role,dx,dz] of [['farmer',2,7],['smith',6,0],['explorer',-6,0]]) {
          if(!this.zombies.some(c=>c.netType==='villager'&&c.profession===role&&Math.hypot(c.home.x-x,c.home.z-z)<12))
            this.zombies.push(new Villager(this.scene,x+dx,y,z+dz,role));
        }
      }
    }
    this.spawnTimer -= dt;
    if (isNight && this.spawnTimer <= 0 && this.zombies.filter(c => !['piglin','villager'].includes(c.netType)).length < maxMobs && targets.length) {
      this.trySpawn(targets);
      this.spawnTimer = 6;
    }
    for (const z of this.zombies) {
      if(maxMobs===0 && !['piglin','villager'].includes(z.netType)) { z.onDie=null; z.die(); continue; }
      z.allowTerrainDamage=this.allowTerrainDamage !== false;
      z.update(dt, this.world, targets, isNight);
    }
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
    if (roll < 0.42) mob = new Zombie(this.scene, x, y + 0.1, z);
    else if (roll < 0.66) mob = new Skeleton(this.scene, x, y + 0.1, z, this.onShoot);
    else if (roll < 0.86) mob = new Spider(this.scene, x, y + 0.1, z);
    else mob = new Creeper(this.scene, x, y + 0.1, z, this.onBlockChange);
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

class Villager extends Piglin {
  constructor(scene,x,y,z,profession='farmer') {
    super(scene,x,y,z);this.netType='villager';this.profession=profession;
    this.materials[1].color.setHex(profession==='smith'?0x414851:profession==='explorer'?0x476f4b:0x6c5540);
    this.materials[2].color.setHex(profession==='smith'?0x8d9aa8:profession==='explorer'?0x6c9651:0xdbc16a);
  }
  buildModel() {
    const skin=this.mat(0xc59672),robe=this.mat(0x6c5540),hat=this.mat(0xdbc16a),dark=this.mat(0x2b3629);
    this.legL=this.box(.22,.55,.25,dark,-.13,.275,0);
    this.legR=this.box(.22,.55,.25,dark,.13,.275,0);
    this.box(.62,.85,.38,robe,0,.95,0);this.box(.5,.5,.46,skin,0,1.65,0);
    this.box(.16,.28,.22,skin,0,1.52,.3);this.box(.72,.1,.64,hat,0,1.92,0);
    this.box(.45,.16,.42,hat,0,2.02,0);this.box(.6,.18,.2,skin,0,1.18,.28);
    for(const side of [-1,1])this.box(.07,.07,.03,dark,side*.13,1.7,.24);
  }
}
