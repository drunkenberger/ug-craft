// Cielo decorativo: disco de sol y luna, estrellas de noche y nubes a la deriva.
// Todo con fog:false (la niebla del mundo es corta y los taparía).
class Sky {
  constructor(scene) {
    this.scene = scene;
    this.R = 150; // distancia de sol/luna/estrellas

    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(9, 20),
      new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false })
    );
    this.moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 20),
      new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false })
    );
    scene.add(this.sunDisc);
    scene.add(this.moonDisc);

    // Estrellas: puntos fijos sobre una cúpula que sigue al jugador.
    const starPos = [];
    for (let i = 0; i < 180; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = 0.15 + Math.random() * 0.85; // solo sobre el horizonte
      const r = Math.sqrt(1 - y * y);
      starPos.push(Math.cos(a) * r * 170, y * 170, Math.sin(a) * r * 170);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    scene.add(this.stars);

    // Nubes: cajas planas que derivan con el viento y envuelven al jugador.
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.7, fog: false,
    });
    this.clouds = [];
    for (let i = 0; i < 10; i++) {
      const cloud = new THREE.Group();
      const n = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(6 + Math.random() * 8, 1.4, 4 + Math.random() * 5),
          this.cloudMat
        );
        m.position.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 7);
        cloud.add(m);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 180, 47 + Math.random() * 10, (Math.random() - 0.5) * 180
      );
      scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  // angle: posición del sol en el ciclo; h: altura del sol [-1, 1].
  update(dt, playerPos, angle, h) {
    this.sunDisc.position.set(
      playerPos.x + Math.cos(angle) * this.R,
      Math.sin(angle) * this.R,
      playerPos.z + this.R * 0.22
    );
    this.moonDisc.position.set(
      playerPos.x - Math.cos(angle) * this.R,
      -Math.sin(angle) * this.R,
      playerPos.z - this.R * 0.22
    );
    this.sunDisc.lookAt(playerPos);
    this.moonDisc.lookAt(playerPos);
    this.sunDisc.visible = this.sunDisc.position.y > -12;
    this.moonDisc.visible = this.moonDisc.position.y > -12;

    this.stars.position.set(playerPos.x, 0, playerPos.z);
    this.stars.rotation.y += dt * 0.01;
    this.starMat.opacity = Math.min(0.9, Math.max(0, -h * 4));

    // Las nubes se oscurecen de noche (material sin luz: se tintan a mano).
    const bright = 0.3 + 0.7 * Math.max(0, h);
    this.cloudMat.color.setRGB(bright, bright, bright * 1.05);
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 1.1;
      if (cloud.position.x - playerPos.x > 100) cloud.position.x -= 200;
      if (cloud.position.x - playerPos.x < -100) cloud.position.x += 200;
      if (cloud.position.z - playerPos.z > 100) cloud.position.z -= 200;
      if (cloud.position.z - playerPos.z < -100) cloud.position.z += 200;
    }
  }

  dispose() {
    for (const obj of [this.sunDisc, this.moonDisc, this.stars, ...this.clouds]) {
      this.scene.remove(obj);
      obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    this.sunDisc.material.dispose();
    this.moonDisc.material.dispose();
    this.starMat.dispose();
    this.cloudMat.dispose();
  }
}
