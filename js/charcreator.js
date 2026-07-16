// Creador de personaje: panel del menú con vista previa 3D y opciones de color.
class CharacterCreator {
  constructor() {
    this.el = document.getElementById('chardiv');
    this.optionsEl = document.getElementById('char-options');
    this.canvas = document.getElementById('char-preview');
    this.renderer = null;
    this.open = false;
    document.getElementById('charCloseBtn').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
  }

  show() {
    this.app = Character.appearance();
    this.buildOptions();
    this.initPreview();
    this.humanoid.build(this.app);
    this.el.classList.remove('hidden');
    this.open = true;
    this.angle = 0;
    this.lastT = performance.now();
    this.loop();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    Character.save(this.app);
  }

  // Escena de vista previa (se crea una vez y se reutiliza).
  initPreview() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(this.canvas.width, this.canvas.height, false);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.3, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x5faa46 })
    );
    floor.position.y = -0.15;
    this.scene.add(floor);
    this.camera = new THREE.PerspectiveCamera(45, this.canvas.width / this.canvas.height, 0.1, 20);
    this.camera.position.set(0, 1.5, 3.4);
    this.camera.lookAt(0, 0.9, 0);
    this.humanoid = new Humanoid(this.scene, 0, 0, 0, this.app);
    this.humanoid.group.position.set(0, 0, 0);
  }

  loop() {
    if (!this.open) return;
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = Math.min((now - this.lastT) / 1000, 0.05);
    this.lastT = now;
    this.angle += dt * 0.9;
    this.humanoid.group.rotation.y = Math.sin(this.angle) * 0.9;
    this.humanoid.swingLegs(this.angle * 4);
    this.renderer.render(this.scene, this.camera);
  }

  set(key, value) {
    this.app[key] = value;
    Character.save(this.app);
    this.humanoid.build(this.app);
    this.buildOptions();
  }

  buildOptions() {
    this.optionsEl.replaceChildren();
    const rows = [
      ['skin', 'charSkin'], ['hair', 'charHair'], ['style', 'charStyle'],
      ['shirt', 'charShirt'], ['pants', 'charPants'],
    ];
    for (const [key, label] of rows) {
      const row = document.createElement('div');
      row.className = 'char-row';
      const h = document.createElement('h3');
      h.textContent = t(label);
      row.append(h);
      for (const choice of CHARACTER_CHOICES[key]) {
        const btn = document.createElement('button');
        if (key === 'style') {
          btn.className = 'btn secondary style-btn' + (this.app[key] === choice ? ' selected' : '');
          btn.textContent = t('style_' + choice);
        } else {
          btn.className = 'swatch' + (this.app[key] === choice ? ' selected' : '');
          btn.style.background = '#' + choice.toString(16).padStart(6, '0');
        }
        btn.addEventListener('click', () => this.set(key, choice));
        row.append(btn);
      }
      this.optionsEl.append(row);
    }
  }
}
