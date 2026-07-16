// Selector de inventario (tecla 9): rejilla navegable con flechas/WASD o mouse.
class PickerUI {
  constructor() {
    this.el = document.getElementById('picker');
    this.grid = document.getElementById('picker-grid');
    this.open = false;
    this.onClose = null;
    this.cols = 5;
    document.getElementById('pickerCloseBtn').addEventListener('click', () => this.close());

    document.addEventListener('keydown', (e) => {
      if (!this.open) return;
      const n = this.items.length;
      if (!n) return;
      let moved = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.cursor -= 1;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.cursor += 1;
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.cursor -= this.cols;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.cursor += this.cols;
      else moved = false;
      if (moved) {
        e.preventDefault();
        this.cursor = ((this.cursor % n) + n) % n;
        this.render();
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.pick(this.cursor);
      }
    });
  }

  show(atlasCanvas, entries, selectedIdx, onPick) {
    this.atlasCanvas = atlasCanvas;
    this.items = entries;
    this.cursor = Math.min(Math.max(0, selectedIdx), Math.max(0, entries.length - 1));
    this.onPick = onPick;
    this.open = true;
    this.el.classList.remove('hidden');
    this.render();
  }

  pick(i) {
    if (this.onPick) this.onPick(i);
    this.close();
  }

  render() {
    this.grid.replaceChildren();
    this.items.forEach(({ id, count }, i) => {
      const cell = document.createElement('div');
      cell.className = 'picker-cell' + (i === this.cursor ? ' cursor' : '');
      cell.title = nameOf(id);

      const icon = document.createElement('canvas');
      icon.width = 16;
      icon.height = 16;
      const ctx = icon.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const tile = iconTileOf(id);
      ctx.drawImage(
        this.atlasCanvas,
        (tile % ATLAS.COLS) * ATLAS.TILE, Math.floor(tile / ATLAS.COLS) * ATLAS.TILE,
        ATLAS.TILE, ATLAS.TILE, 0, 0, 16, 16
      );
      icon.className = 'pix';

      const label = document.createElement('span');
      label.className = 'picker-name';
      label.textContent = nameOf(id) + (Number.isFinite(count) && count > 1 ? ` ×${count}` : '');

      cell.append(icon, label);
      cell.addEventListener('click', () => this.pick(i));
      cell.addEventListener('mouseenter', () => {
        if (this.cursor !== i) { this.cursor = i; this.render(); }
      });
      this.grid.append(cell);
    });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    if (this.onClose) this.onClose();
  }
}
