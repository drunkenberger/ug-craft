// Inventario: 'counted' (supervivencia: se gasta) o 'free' (infinito).
class Inventory {
  constructor(mode, fixedIds) {
    this.mode = mode;
    // Solo el modo libre arranca con lista fija; el contado empieza vacío.
    this.entries = mode === 'free'
      ? (fixedIds || []).map((id) => ({ id, count: Infinity }))
      : [];
    this.onChange = null;
  }

  isFree() { return this.mode === 'free'; }

  count(id) {
    if (this.isFree()) return Infinity; // en modo libre todo es infinito
    const e = this.entries.find((e) => e.id === id);
    return e ? e.count : 0;
  }

  add(id, n = 1) {
    if (!id) return;
    if (this.isFree()) {
      // Craftear en creativo "desbloquea" el item en la barra (infinito).
      if (!this.entries.some((e) => e.id === id)) {
        this.entries.push({ id, count: Infinity });
        if (this.onChange) this.onChange();
      }
      return;
    }
    const e = this.entries.find((e) => e.id === id);
    if (e) e.count += n;
    else this.entries.push({ id, count: n });
    if (this.onChange) this.onChange();
  }

  remove(id, n = 1) {
    if (this.isFree()) return true;
    const i = this.entries.findIndex((e) => e.id === id);
    if (i === -1 || this.entries[i].count < n) return false;
    this.entries[i].count -= n;
    if (this.entries[i].count <= 0) this.entries.splice(i, 1);
    if (this.onChange) this.onChange();
    return true;
  }

  canAfford(cost) { return cost.every(([id, n]) => this.count(id) >= n); }

  pay(cost) { cost.forEach(([id, n]) => this.remove(id, n)); }

  serialize() {
    if (this.isFree()) return null;
    return this.entries.map((e) => [e.id, e.count]);
  }

  restore(data) {
    if (this.isFree() || !Array.isArray(data)) return;
    this.entries = data
      .filter((d) => Array.isArray(d) && defOf(d[0]))
      .map(([id, count]) => ({ id, count }));
  }
}
