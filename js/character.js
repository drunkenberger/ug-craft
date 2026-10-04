// Personaje personalizable: apariencia guardada + modelo humanoide detallado.
const CHARACTER_CHOICES = {
  skin: [0xf2c79b, 0xd8a06a, 0xb07a4a, 0x7c5233],
  hair: [0x2b1c10, 0x5a3820, 0xd8b25a, 0x1b1b1b, 0xb0451f],
  style: ['clasico', 'largo', 'gorra', 'rapado'],
  shirt: [0x2a5ac0, 0xc03030, 0x2f9e44, 0xd08a2a, 0x8a2ac0, 0x2ac0a0, 0xe64980, 0xf4c430],
  pants: [0x27408b, 0x333333, 0x6b4a2a, 0xf0f0f0, 0x3a5f3a],
};

const Character = {
  KEY: 'eugecraft.character',
  DEFAULT: { skin: 0xd8a06a, hair: 0x2b1c10, style: 'clasico', shirt: 0x2a5ac0, pants: 0x27408b },

  appearance() {
    try {
      return { ...this.DEFAULT, ...(JSON.parse(localStorage.getItem(this.KEY)) || {}) };
    } catch (e) {
      return { ...this.DEFAULT };
    }
  },

  save(app) {
    try { localStorage.setItem(this.KEY, JSON.stringify(app)); } catch (e) { /* lleno */ }
  },
};

// Humanoide con pelo, cara, brazos y piernas articulados (pivote en hombro/cadera).
class Humanoid extends Creature {
  constructor(scene, x, y, z, app) {
    super(scene, x, y, z, 0.3, 1.8, Infinity);
    this.build(app || Character.appearance());
  }

  // (Re)construye el modelo; permite cambiar la apariencia en vivo.
  build(app) {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    this.materials.forEach((m) => m.dispose());
    this.materials = [];
    this.app = app;

    const skin = this.mat(app.skin);
    const shirt = this.mat(app.shirt);
    const pants = this.mat(app.pants);
    const hair = this.mat(app.hair);
    const shoe = this.mat(0x2a2a2a);
    const part = (parent, w, h, d, m, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    // Piernas: pivote en la cadera, con zapato que acompaña el paso.
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    for (const [leg, sx] of [[this.legL, -0.13], [this.legR, 0.13]]) {
      leg.position.set(sx, 0.78, 0);
      part(leg, 0.2, 0.66, 0.2, pants, 0, -0.36, 0);
      part(leg, 0.22, 0.12, 0.26, shoe, 0, -0.72, 0.02);
      this.group.add(leg);
    }

    // Torso con camiseta.
    part(this.group, 0.5, 0.64, 0.26, shirt, 0, 1.1, 0);

    // Brazos: pivote en el hombro, manga corta + piel.
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    for (const [arm, sx] of [[this.armL, -0.33], [this.armR, 0.33]]) {
      arm.position.set(sx, 1.36, 0);
      part(arm, 0.16, 0.22, 0.18, shirt, 0, -0.07, 0);
      part(arm, 0.14, 0.4, 0.14, skin, 0, -0.37, 0);
      this.group.add(arm);
    }

    // Cabeza con ojos, boca y peinado.
    const head = part(this.group, 0.42, 0.42, 0.42, skin, 0, 1.63, 0);
    this.head = head;
    const white = this.mat(0xffffff);
    const dark = this.mat(0x1a1a1a);
    for (const ex of [-0.1, 0.1]) {
      part(head, 0.1, 0.07, 0.02, white, ex, 0.05, 0.21);
      part(head, 0.05, 0.05, 0.02, dark, ex + 0.015, 0.045, 0.22);
    }
    part(head, 0.13, 0.03, 0.02, dark, 0, -0.09, 0.21); // boca

    if (app.style === 'clasico') {
      part(head, 0.46, 0.1, 0.46, hair, 0, 0.25, 0);
      part(head, 0.46, 0.26, 0.06, hair, 0, 0.1, -0.2);
    } else if (app.style === 'largo') {
      part(head, 0.46, 0.1, 0.46, hair, 0, 0.25, 0);
      part(head, 0.46, 0.52, 0.08, hair, 0, -0.02, -0.21);
      part(head, 0.06, 0.4, 0.44, hair, -0.21, 0.03, -0.02);
      part(head, 0.06, 0.4, 0.44, hair, 0.21, 0.03, -0.02);
    } else if (app.style === 'gorra') {
      part(head, 0.46, 0.12, 0.46, hair, 0, 0.25, 0);
      part(head, 0.4, 0.04, 0.2, hair, 0, 0.21, 0.3); // visera
    } else {
      part(head, 0.43, 0.04, 0.43, hair, 0, 0.23, 0); // rapado
    }
    if(app.armor)this.addArmor(app.armor);
    this.setSitting(!!this.sitting);
  }

  addArmor(equipment) {
    const piece=(parent,w,h,d,material,x,y,z)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
      mesh.position.set(x,y,z);mesh.name='armor';parent.add(mesh);
    };
    for(const [slot,id] of Object.entries(normalizeArmor(equipment))) {
      const mat=this.mat(ARMOR_TIERS[ITEMS[id].tier].color);
      if(slot==='helmet') {
        piece(this.head,.54,.12,.62,mat,0,.32,.03);
        piece(this.head,.07,.38,.53,mat,-.25,.09,0);
        piece(this.head,.07,.38,.53,mat,.25,.09,0);
        piece(this.head,.5,.4,.07,mat,0,.08,-.26);
      }
      if(slot==='chestplate') {
        piece(this.group,.55,.65,.32,mat,0,1.1,0);
        for(const arm of [this.armL,this.armR])piece(arm,.22,.28,.24,mat,0,-.06,0);
      }
      if(slot==='leggings')for(const leg of [this.legL,this.legR])piece(leg,.235,.55,.24,mat,0,-.28,0);
      if(slot==='boots')for(const leg of [this.legL,this.legR])piece(leg,.245,.23,.31,mat,0,-.665,.025);
    }
  }

  // Caminar: piernas y brazos se balancean en oposición.
  swingLegs(phase) {
    if (this.sitting) return; // sentado: la pose la fija setSitting
    const swing = Math.sin(phase) * 0.6;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
  }

  // Pose sentado: muslos hacia adelante (rodilla en escuadra) y brazos en reposo.
  setSitting(on) {
    this.sitting = on;
    const thigh = on ? -1.5 : 0;
    this.legL.rotation.x = thigh;
    this.legR.rotation.x = thigh;
    this.armL.rotation.x = on ? -0.2 : 0;
    this.armR.rotation.x = on ? -0.2 : 0;
  }
}
