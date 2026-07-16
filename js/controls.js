// Entrada: teclado, mouse con pointer lock y selección de hotbar.
class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.locked = false;
    this.selectedSlot = 0;
    this.hotbar = HOTBAR;
    this.onLeftClick = null;
    this.onRightClick = null;
    this.onSlotChange = null;
    this.onLockChange = null;

    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      const num = parseInt(e.key, 10);
      // 1-8 seleccionan directo; 9 abre el selector completo del inventario.
      if (num >= 1 && num <= 8 && num <= this.hotbar.length) this.selectSlot(num - 1);
      if (num === 9 && this.locked && this.onOpenPicker) this.onOpenPicker();
      if (e.code === 'KeyC' && this.locked && this.onOpenCraft) this.onOpenCraft();
      if (e.code === 'KeyV' && this.locked && this.onToggleView) this.onToggleView();
      // Disparo con teclado (kart): Espacio o Enter, útil si manejas con flechas.
      if ((e.code === 'Space' || e.code === 'Enter') && this.locked && this.onFireKey) {
        e.preventDefault();
        this.onFireKey();
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.steerMode = false; // en modo kart el mouse no gira (se gira con A/D)
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (!this.steerMode) this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0 && this.onLeftClick) this.onLeftClick();
      if (e.button === 2 && this.onRightClick) this.onRightClick();
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    this.wheelAcc = 0;
    document.addEventListener('wheel', (e) => {
      if (!this.locked || !this.hotbar.length) return;
      // Acumular el scroll: un cambio de slot por "clic" de rueda, no varios.
      if (Math.sign(e.deltaY) !== Math.sign(this.wheelAcc)) this.wheelAcc = 0;
      this.wheelAcc += e.deltaY;
      if (Math.abs(this.wheelAcc) < 80) return;
      const dir = this.wheelAcc > 0 ? 1 : -1;
      this.wheelAcc = 0;
      this.selectSlot((this.selectedSlot + dir + this.hotbar.length) % this.hotbar.length);
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    this.canvas.requestPointerLock();
  }

  setHotbar(hotbar) {
    this.hotbar = hotbar;
    this.selectedSlot = 0;
  }

  selectSlot(i) {
    this.selectedSlot = i;
    if (this.onSlotChange) this.onSlotChange(i);
  }

  selectedBlock() {
    return this.hotbar[this.selectedSlot];
  }

  // Vector de movimiento local (x: strafe, z: adelante/atrás).
  getMoveVector() {
    const v = { x: 0, z: 0 };
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) v.z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) v.z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) v.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) v.x += 1;
    const len = Math.hypot(v.x, v.z);
    if (len > 0) { v.x /= len; v.z /= len; }
    return v;
  }
}
