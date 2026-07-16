// Cofres: interfaz para pasar objetos entre el inventario y un cofre colocado.
class ChestUI {
  constructor() {
    this.el = document.getElementById('chest');
    this.left = document.getElementById('chest-left');
    this.right = document.getElementById('chest-right');
    this.open = false;
    this.onClose = null;
    document.getElementById('chestCloseBtn').addEventListener('click', () => this.close());
  }

  makeIcon(atlasCanvas, id) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    c.style.width = c.style.height = '26px';
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tile = iconTileOf(id);
    ctx.drawImage(
      atlasCanvas,
      (tile % ATLAS.COLS) * ATLAS.TILE, Math.floor(tile / ATLAS.COLS) * ATLAS.TILE,
      ATLAS.TILE, ATLAS.TILE, 0, 0, 16, 16
    );
    c.className = 'pix';
    return c;
  }

  renderList(container, atlasCanvas, items, onPick) {
    container.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'chest-empty';
      empty.textContent = t('chestEmpty');
      container.append(empty);
      return;
    }
    for (const [id, count] of items) {
      const row = document.createElement('div');
      row.className = 'chest-item';
      row.append(this.makeIcon(atlasCanvas, id));
      const label = document.createElement('span');
      label.textContent = `${nameOf(id)} ×${count}`;
      row.append(label);
      row.addEventListener('click', () => onPick(id, count));
      container.append(row);
    }
  }

  // contents: [[id, n], ...] (se muta); inventory: Inventory del jugador.
  show(atlasCanvas, contents, inventory) {
    this.open = true;
    this.el.classList.remove('hidden');

    const render = () => {
      this.renderList(this.left, atlasCanvas, contents, (id, count) => {
        // Sacar del cofre → inventario.
        const i = contents.findIndex((e) => e[0] === id);
        contents.splice(i, 1);
        inventory.add(id, count);
        render();
      });
      const invItems = inventory.entries.map((e) => [e.id, e.count]);
      this.renderList(this.right, atlasCanvas, invItems, (id, count) => {
        // Guardar en el cofre.
        if (!inventory.remove(id, count)) return;
        const e = contents.find((e) => e[0] === id);
        if (e) e[1] += count;
        else contents.push([id, count]);
        render();
      });
    };
    render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    if (this.onClose) this.onClose();
  }
}
