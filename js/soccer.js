// Mapa de fútbol: cancha amurallada, balón con física y un rival con IA.
// El jugador ataca la portería de +x; el rival la de -x. Primero a 3 goles.
const SOCCER = { L: 15, W: 10, GOAL_HALF: 2, FLOOR_TOP: 4, WIN: 3 };

function generateSoccerField(world, cx, cz, data) {
  generateFlat(world, cx, cz, data);
  for (let x = 0; x < CFG.CHUNK; x++) {
    for (let z = 0; z < CFG.CHUNK; z++) {
      const wx = cx * CFG.CHUNK + x;
      const wz = cz * CFG.CHUNK + z;
      const ax = Math.abs(wx), az = Math.abs(wz);

      // Línea central de arena sobre el césped.
      if (wx === 0 && az < SOCCER.W) data[world.blockIndex(x, 3, z)] = 4;

      // Paredes perimetrales (con hueco de portería en los extremos x).
      const onWall = (ax === SOCCER.L && az <= SOCCER.W) ||
                     (az === SOCCER.W && ax <= SOCCER.L);
      if (onWall) {
        const isGoalEnd = ax === SOCCER.L;
        const mouth = isGoalEnd && az <= SOCCER.GOAL_HALF;
        const mat = isGoalEnd && az === SOCCER.GOAL_HALF + 1 ? 8 : 7; // postes dorados
        for (let y = 4; y <= 5; y++) {
          if (!mouth) data[world.blockIndex(x, y, z)] = mat;
        }
        if (isGoalEnd && az <= SOCCER.GOAL_HALF + 1) {
          data[world.blockIndex(x, 6, z)] = 8; // travesaño
        }
      }
      // Red detrás de cada portería.
      if (ax === SOCCER.L + 2 && az <= SOCCER.GOAL_HALF + 1) {
        for (let y = 4; y <= 5; y++) data[world.blockIndex(x, y, z)] = 7;
      }
    }
  }
}

// Humanoide futbolista: uniforme (camiseta del equipo, shorts blancos).
// ownLook: usa la piel/pelo del personaje creado por el jugador.
class SoccerHumanoid extends Humanoid {
  constructor(scene, x, y, z, shirtColor, ownLook = false) {
    const app = ownLook ? Character.appearance() : { ...Character.DEFAULT };
    app.shirt = shirtColor;
    app.pants = 0xf0f0f0;
    super(scene, x, y, z, app);
  }
}

// Rival: persigue el balón y lo patea hacia tu portería.
class SoccerBot extends SoccerHumanoid {
  constructor(scene, x, y, z) {
    super(scene, x, y, z, 0xc03030);
    this.stunTimer = 0;
  }

  updateSoccer(dt, world, ball, state) {
    // Derribado por una barrida: tirado en el suelo un momento.
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.group.rotation.x = this.stunTimer > 0 ? -Math.PI / 2.3 : 0;
      this.vel.x *= 0.9;
      this.vel.z *= 0.9;
      this.physics(dt, world);
      return;
    }
    this.group.rotation.x = 0;

    const toBall = new THREE.Vector3().subVectors(ball.pos, this.pos);
    const dist = Math.hypot(toBall.x, toBall.z);
    if (dist > 0.9) {
      this.vel.x = (toBall.x / dist) * 3.7;
      this.vel.z = (toBall.z / dist) * 3.7;
      this.group.rotation.y = Math.atan2(toBall.x, toBall.z);
      this.walkPhase += dt * 9;
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
      if (state.botKickCd === 0) {
        // Patear hacia la portería del jugador (-x), apuntando al centro.
        state.botKickCd = 1;
        const aim = new THREE.Vector3(-SOCCER.L - 1 - ball.pos.x, 0, -ball.pos.z).normalize();
        ball.vel.set(aim.x * 9.5, 3.2, aim.z * 9.5);
      }
    }
    if (this.hitWall && this.onGround) this.vel.y = CFG.JUMP_SPEED * 0.8;
    this.physics(dt, world);
    this.swingLegs(this.walkPhase);
  }
}

class SoccerState {
  constructor(game) {
    this.game = game;
    this.scoreYou = 0;
    this.scoreBot = 0;
    this.kickCd = 0;
    this.botKickCd = 0;
    this.ball = { pos: new THREE.Vector3(0.5, 6, 0.5), vel: new THREE.Vector3(), r: 0.35 };
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    game.scene.add(this.ballMesh);
    this.bot = new SoccerBot(game.scene, 6.5, SOCCER.FLOOR_TOP + 0.1, 0.5);
    // Avatar del jugador (camiseta azul), visible solo en vista FIFA.
    this.avatar = new SoccerHumanoid(game.scene, -6.5, SOCCER.FLOOR_TOP + 0.1, 0.5, 0x2a5ac0, true);
    this.avatarPhase = 0;
    this.slideCd = 0;
    this.slideTimer = 0;
    this.netBall = null;   // posición sincronizada del balón (invitado)
    this.syncTimer = 0;
    this.teamsSet = false;
    game.ui.toast(t('soccerHint'), 4000);
  }

  // ¿Este cliente manda sobre balón, marcador y rival? (solo, anfitrión,
  // o sin conexión al servidor: así el partido no se congela nunca).
  isAuthority() { return !this.game.net || NET.isHost || !NET.active(); }
  hasRival() { return this.game.net && this.game.avatars.size > 0; }

  // En red: el anfitrión ataca +x; el invitado ataca -x y arranca enfrente.
  setupTeams() {
    if (!this.game.net || this.teamsSet || NET.id === null) return;
    this.teamsSet = true;
    if (!NET.isHost) {
      this.game.player.pos.set(6.5, SOCCER.FLOOR_TOP + 0.1, 0.5);
      this.game.controls.yaw = Math.PI / 2; // mirando hacia -x
    } else {
      this.game.controls.yaw = -Math.PI / 2; // mirando hacia +x
    }
  }

  // ---- Mensajes de red ----
  onNetBall(msg) {
    if (this.isAuthority()) return;
    if (!this.netBall) this.netBall = new THREE.Vector3();
    this.netBall.set(msg.x, msg.y, msg.z);
  }

  onNetKick(msg) { // el anfitrión aplica la patada del invitado
    if (!this.isAuthority()) return;
    const av = this.game.avatars.get(msg.from);
    if (!av) return;
    const b = this.ball;
    if (Math.hypot(b.pos.x - av.pos.x, b.pos.z - av.pos.z) > 3.2) return;
    b.vel.set(msg.dx * 13, Math.max(3, msg.dy * 12 + 4), msg.dz * 13);
  }

  onNetSlide(msg) { // barrida del invitado: disparo raso
    if (!this.isAuthority()) return;
    const av = this.game.avatars.get(msg.from);
    if (!av) return;
    const b = this.ball;
    if (Math.hypot(b.pos.x - av.pos.x, b.pos.z - av.pos.z) > 2.2) return;
    b.vel.set(msg.dx * 15, 1.5, msg.dz * 15);
  }

  onNetScore(msg) { // el invitado recibe el marcador (mapeado a su equipo)
    if (this.isAuthority()) return;
    const before = this.scoreYou + this.scoreBot;
    this.scoreYou = msg.g;
    this.scoreBot = msg.h;
    if (msg.event && this.scoreYou + this.scoreBot > before) {
      this.game.ui.toast(msg.event === 'guest' ? '⚽ ¡GOOOL! 🎉' : t('rivalGoal'));
    }
    if (msg.done) {
      if (msg.winner === 'guest') {
        this.game.win();
      } else {
        this.game.ui.toast(t('matchLost'));
        this.game.state.elapsed = 0;
      }
    }
  }

  // Barrida (clic derecho): embiste, dispara el balón raso y derriba al rival.
  slide() {
    const g = this.game;
    if (this.slideCd > 0) return true;
    this.slideCd = 2;
    this.slideTimer = 0.45;
    const yaw = g.controls.yaw;
    this.slideDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    g.player.boost = { x: this.slideDir.x * 7, z: this.slideDir.z * 7, t: 0.45 };
    if (!this.isAuthority()) {
      NET.send({ t: 'slide', dx: this.slideDir.x, dz: this.slideDir.z });
    }
    return true;
  }

  resetBall() {
    this.ball.pos.set(0.5, 6, 0.5);
    this.ball.vel.set(0, 0, 0);
    this.bot.pos.set(6.5, SOCCER.FLOOR_TOP + 0.1, 0.5);
    this.bot.vel.set(0, 0, 0);
  }

  // Patada del jugador (clic izquierdo cerca del balón).
  kick() {
    const g = this.game, b = this.ball;
    if (this.kickCd > 0) return true;
    const dist = Math.hypot(b.pos.x - g.player.pos.x, b.pos.z - g.player.pos.z);
    if (dist > 2.4) return true;
    this.kickCd = 0.35;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion);
    if (this.isAuthority()) {
      b.vel.set(dir.x * 13, Math.max(3, dir.y * 12 + 4), dir.z * 13);
    } else {
      NET.send({ t: 'kick', dx: dir.x, dy: dir.y, dz: dir.z });
    }
    return true;
  }

  update(dt) {
    const g = this.game, b = this.ball;
    this.setupTeams();
    this.kickCd = Math.max(0, this.kickCd - dt);
    this.botKickCd = Math.max(0, this.botKickCd - dt);
    this.slideCd = Math.max(0, this.slideCd - dt);

    const authority = this.isAuthority();
    const rival = this.hasRival(); // hay otro jugador: el robot descansa
    this.bot.group.visible = !rival;

    // Efectos de la barrida mientras dura.
    if (this.slideTimer > 0) {
      this.slideTimer -= dt;
      const pl = g.player.pos;
      if (authority && Math.hypot(b.pos.x - pl.x, b.pos.z - pl.z) < 1.4) {
        // Disparo raso y fuerte.
        b.vel.set(this.slideDir.x * 15, 1.5, this.slideDir.z * 15);
      }
      if (authority && !rival) {
        const toBot = Math.hypot(this.bot.pos.x - pl.x, this.bot.pos.z - pl.z);
        if (toBot < 1.4 && this.bot.stunTimer <= 0) {
          this.bot.stunTimer = 1.6;
          this.bot.vel.x = this.slideDir.x * 6;
          this.bot.vel.z = this.slideDir.z * 6;
          this.bot.vel.y = 4;
          g.ui.toast('💥 ¡Barrida!');
        }
      }
    }

    if (authority) {
      // Física del balón: gravedad, rebote en suelo y paredes, fricción.
      b.vel.y -= 18 * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y - b.r < SOCCER.FLOOR_TOP) {
        b.pos.y = SOCCER.FLOOR_TOP + b.r;
        b.vel.y = Math.abs(b.vel.y) > 2 ? -b.vel.y * 0.5 : 0;
        const fr = Math.max(0, 1 - 1.4 * dt);
        b.vel.x *= fr;
        b.vel.z *= fr;
      }
      for (const axis of ['x', 'z']) {
        const dir = Math.sign(b.vel[axis]);
        if (!dir) continue;
        const probe = b.pos.clone();
        probe[axis] += dir * b.r;
        if (g.world.isSolid(Math.floor(probe.x), Math.floor(probe.y), Math.floor(probe.z))) {
          b.vel[axis] *= -0.65;
          b.pos[axis] += b.vel[axis] * dt * 2;
        }
      }

      // Conducir el balón al caminar: jugador local y jugadores remotos.
      const pushers = [g.player.pos, ...[...g.avatars.values()].map((a) => a.pos)];
      for (const pp of pushers) {
        const dxz = Math.hypot(b.pos.x - pp.x, b.pos.z - pp.z);
        if (dxz < 0.9 && b.pos.y < pp.y + 1.6) {
          const push = new THREE.Vector3(b.pos.x - pp.x, 0, b.pos.z - pp.z).normalize();
          b.vel.x = push.x * 6;
          b.vel.z = push.z * 6;
          b.vel.y = Math.max(b.vel.y, 1.5);
        }
      }

      if (!rival) this.bot.updateSoccer(dt, g.world, b, this);

      // Goles.
      const inMouth = Math.abs(b.pos.z) < SOCCER.GOAL_HALF + 0.5 && b.pos.y < 6.5;
      if (b.pos.x > SOCCER.L - 0.3 && inMouth) this.goal(true);
      else if (b.pos.x < -SOCCER.L + 0.3 && inMouth) this.goal(false);
      if (Math.abs(b.pos.x) > SOCCER.L + 4 || Math.abs(b.pos.z) > SOCCER.W + 4) this.resetBall();

      // Enviar el balón a los invitados.
      if (g.net && NET.active()) {
        this.syncTimer += dt;
        if (this.syncTimer > 0.08) {
          this.syncTimer = 0;
          NET.send({ t: 'ball', x: b.pos.x, y: b.pos.y, z: b.pos.z });
        }
      }
    } else if (this.netBall) {
      // Invitado: interpolar hacia el balón del anfitrión.
      b.pos.lerp(this.netBall, Math.min(1, dt * 14));
    }

    this.ballMesh.position.copy(b.pos);
    this.ballMesh.rotation.x += b.vel.length() * dt * 1.5;

    // Avatar del jugador en vista FIFA.
    const pl = g.player;
    const third = g.cameraMode === 'third';
    this.avatar.group.visible = third;
    if (third) {
      this.avatar.group.position.copy(pl.pos);
      this.avatar.group.rotation.y = g.controls.yaw + Math.PI;
      // Barrida: se inclina hacia atrás; si no, camina.
      this.avatar.group.rotation.x = this.slideTimer > 0 ? -0.9 : 0;
      const speed = Math.hypot(pl.vel.x, pl.vel.z);
      this.avatarPhase += dt * speed * 2.2;
      this.avatar.swingLegs(speed > 0.5 ? this.avatarPhase : 0);
    }

    g.ui.setInfo(`⚽ ${t('scoreYou')} ${this.scoreYou} - ${this.scoreBot} ${t('scoreRival')} · ${t('firstTo')} ${SOCCER.WIN}`);
  }

  // hostSide: gol en la portería +x (equipo del anfitrión / jugador local).
  goal(hostSide) {
    const g = this.game;
    if (hostSide) this.scoreYou++;
    else this.scoreBot++;
    const done = this.scoreYou >= SOCCER.WIN || this.scoreBot >= SOCCER.WIN;
    const winner = done ? (this.scoreYou >= SOCCER.WIN ? 'host' : 'guest') : null;
    if (g.net) {
      NET.send({
        t: 'score', h: this.scoreYou, g: this.scoreBot,
        event: hostSide ? 'host' : 'guest', done, winner,
      });
    }
    g.ui.toast(hostSide ? '⚽ ¡GOOOL! 🎉' : t('rivalGoal'));
    this.resetBall();
    if (!done) return;
    if (this.scoreYou >= SOCCER.WIN) {
      g.win();
    } else {
      g.ui.toast(t('matchLost'));
      g.state.elapsed = 0;
    }
    // Revancha: marcador a cero (también para los invitados).
    this.scoreYou = 0;
    this.scoreBot = 0;
    if (g.net) NET.send({ t: 'score', h: 0, g: 0, event: null, done: false, winner: null });
  }

  dispose() {
    this.game.scene.remove(this.ballMesh);
    this.ballMesh.geometry.dispose();
    this.ballMesh.material.dispose();
    this.bot.die();
    this.avatar.die();
  }
}
