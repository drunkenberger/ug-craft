// Guardado de partidas en localStorage (una entrada por mapa).
const Storage = {
  key(mapKey) { return 'eugecraft.' + mapKey; },

  load(mapKey) {
    try {
      return JSON.parse(localStorage.getItem(this.key(mapKey)));
    } catch (e) {
      return null;
    }
  },

  save(mapKey, data) {
    try {
      localStorage.setItem(this.key(mapKey), JSON.stringify(data));
      return true;
    } catch (e) {
      return false; // localStorage lleno o bloqueado
    }
  },

  clear(mapKey) {
    localStorage.removeItem(this.key(mapKey));
  },

  hasSave(mapKey) {
    return localStorage.getItem(this.key(mapKey)) !== null;
  },

  // ---- Partidas múltiples (slots) para mapas con guardado de mundo ----
  MAX_SLOTS: 3,

  slotKey(mapKey, slot) { return `eugecraft.${mapKey}#${slot}`; },

  loadSlot(mapKey, slot) {
    try {
      return JSON.parse(localStorage.getItem(this.slotKey(mapKey, slot)));
    } catch (e) {
      return null;
    }
  },

  saveSlot(mapKey, slot, data) {
    try {
      localStorage.setItem(this.slotKey(mapKey, slot), JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },

  clearSlot(mapKey, slot) {
    localStorage.removeItem(this.slotKey(mapKey, slot));
  },

  listSlots(mapKey) {
    const slots = [];
    for (let s = 1; s <= this.MAX_SLOTS; s++) {
      const data = this.loadSlot(mapKey, s);
      if (data) slots.push({ slot: s, updated: data.updated || 0 });
    }
    return slots;
  },

  freeSlot(mapKey) {
    for (let s = 1; s <= this.MAX_SLOTS; s++) {
      if (!this.loadSlot(mapKey, s)) return s;
    }
    return null;
  },

  // ---- Identidad del jugador (para el estado guardado en partidas compartidas) ----
  playerName() {
    return Auth.user();
  },

  // Migra el guardado antiguo de un solo mundo al slot 1.
  migrate() {
    for (const mapKey of ['survival', 'creative']) {
      const old = this.load(mapKey);
      if (old && old.edits && !this.loadSlot(mapKey, 1)) {
        old.updated = old.updated || 0;
        this.saveSlot(mapKey, 1, old);
        this.clear(mapKey);
      }
    }
  },
};
