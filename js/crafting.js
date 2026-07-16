// Menú de crafteo: lista de recetas con materiales y botón de craftear.
class CraftingUI {
  constructor() {
    this.el = document.getElementById('craft');
    this.list = document.getElementById('craft-list');
    this.hint = document.getElementById('craft-hint');
    this.open = false;
    this.onClose = null;
    document.getElementById('craftCloseBtn').addEventListener('click', () => this.close());
  }

  makeIcon(atlasCanvas, id, size = 32) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    c.style.width = c.style.height = size + 'px';
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

  show(atlasCanvas, inventory, nearTable, onCraft, recipes = RECIPES, titleKey = 'craftTitle') {
    this.open = true;
    this.el.classList.remove('hidden');
    document.querySelector('#craft h1').textContent = t(titleKey);
    this.hint.textContent = nearTable ? '' : t('needTable');
    this.list.replaceChildren();

    for (const recipe of recipes) {
      const row = document.createElement('div');
      row.className = 'recipe';

      const out = document.createElement('div');
      out.className = 'recipe-out';
      out.append(this.makeIcon(atlasCanvas, recipe.out.id));
      const outName = document.createElement('span');
      outName.textContent = `${nameOf(recipe.out.id)}${recipe.out.n > 1 ? ' ×' + recipe.out.n : ''}`;
      out.append(outName);

      const cost = document.createElement('div');
      cost.className = 'recipe-cost';
      for (const [id, n] of recipe.cost) {
        const item = document.createElement('span');
        item.className = 'cost-item' + (inventory.count(id) >= n ? '' : ' missing');
        item.append(this.makeIcon(atlasCanvas, id, 22));
        const txt = document.createElement('span');
        txt.textContent = `×${n}`;
        item.append(txt);
        cost.append(item);
      }
      if (recipe.table) {
        const tag = document.createElement('span');
        tag.className = 'cost-item' + (nearTable ? '' : ' missing');
        tag.textContent = '🛠️';
        tag.title = t('block_table');
        cost.append(tag);
      }

      const btn = document.createElement('button');
      btn.className = 'btn craft-btn';
      btn.textContent = t('craftBtn');
      const canCraft = inventory.canAfford(recipe.cost) && (!recipe.table || nearTable);
      btn.disabled = !canCraft;
      btn.addEventListener('click', () => {
        onCraft(recipe);
        this.show(atlasCanvas, inventory, nearTable, onCraft, recipes, titleKey); // refrescar
      });
      // Clic en una receta bloqueada: explicar exactamente qué falta.
      row.addEventListener('click', () => {
        if (canCraft) return;
        const missing = recipe.cost
          .filter(([id, n]) => inventory.count(id) < n)
          .map(([id, n]) => `${nameOf(id)} ×${n - inventory.count(id)}`);
        if (recipe.table && !nearTable) missing.push(t('block_table'));
        this.hint.textContent = `${t('missing')}: ${missing.join(', ')}`;
      });

      row.append(out, cost, btn);
      this.list.append(row);
    }
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    if (this.onClose) this.onClose();
  }
}
