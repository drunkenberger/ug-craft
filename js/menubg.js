// Fondo del menú: un mundo voxel girando lentamente (panorama estilo Minecraft).
class MenuBackground {
  constructor(renderer, material) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 45, 95);

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(40, 80, 20);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 300
    );

    this.world = new World(
      this.scene, material,
      (w, cx, cz, data) => generateTerrain(w, cx, cz, data), {}
    );
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) this.world.ensureChunkData(cx, cz);
    }
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) this.world.buildMesh(cx, cz);
    }
    this.centerY = this.world.findSurface(8, 8);
    this.angle = 0;
  }

  render(dt) {
    this.angle += dt * 0.07;
    this.camera.position.set(
      8 + Math.cos(this.angle) * 26,
      this.centerY + 13,
      8 + Math.sin(this.angle) * 26
    );
    this.camera.lookAt(8, this.centerY + 1, 8);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
