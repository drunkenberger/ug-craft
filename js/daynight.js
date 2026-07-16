// Ciclo de día y noche: sol, luz ambiente, color de cielo y niebla.
class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.25; // arranca por la mañana

    this.sun = new THREE.DirectionalLight(0xffffff, 0.9);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.add(this.ambient);

    this.dayColor = new THREE.Color(0x87ceeb);
    this.duskColor = new THREE.Color(0xf5904a);
    this.nightColor = new THREE.Color(0x0b1030);
    this.skyColor = new THREE.Color();
    this.warmSun = new THREE.Color(0xffb45a);
    this.whiteSun = new THREE.Color(0xffffff);
    this.nightAmbient = new THREE.Color(0xaab4e0);

    scene.fog = new THREE.Fog(0x87ceeb, 24, CFG.RENDER_DIST * CFG.CHUNK - 4);
    this.sky = new Sky(scene);
  }

  // Altura del sol en [-1, 1].
  sunHeight() {
    return Math.sin(this.time * Math.PI * 2);
  }

  isNight() {
    return this.sunHeight() < -0.08;
  }

  update(dt, playerPos) {
    this.time = (this.time + dt / CFG.DAY_CYCLE_SECONDS) % 1;
    const h = this.sunHeight();
    const angle = this.time * Math.PI * 2;

    this.sun.position.set(
      playerPos.x + Math.cos(angle) * 60,
      Math.sin(angle) * 80,
      playerPos.z + 20
    );
    this.sun.target.position.copy(playerPos);

    this.sun.intensity = Math.max(0, h) * 0.9;
    this.ambient.intensity = 0.22 + Math.max(0, h) * 0.4;
    // Sol cálido al amanecer/atardecer; ambiente azulado de noche.
    this.sun.color.copy(this.warmSun).lerp(this.whiteSun, Math.min(1, Math.max(0, h * 2.5)));
    this.ambient.color.copy(this.whiteSun).lerp(this.nightAmbient, Math.min(1, Math.max(0, -h * 4)));

    // Mezcla de colores de cielo: noche -> atardecer -> día.
    if (h > 0.25) this.skyColor.copy(this.dayColor);
    else if (h > 0) this.skyColor.copy(this.duskColor).lerp(this.dayColor, h / 0.25);
    else if (h > -0.25) this.skyColor.copy(this.nightColor).lerp(this.duskColor, (h + 0.25) / 0.25);
    else this.skyColor.copy(this.nightColor);

    this.scene.background = this.skyColor;
    this.scene.fog.color.copy(this.skyColor);
    this.sky.update(dt, playerPos, angle, h);
  }
}
