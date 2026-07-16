// HUD, menú de mapas y pantallas (pausa, muerte, victoria).
class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.menu = document.getElementById('menu');
    this.mapGrid = document.getElementById('map-grid');
    this.overlay = document.getElementById('overlay');
    this.death = document.getElementById('death');
    this.winEl = document.getElementById('win');
    this.hearts = document.getElementById('hearts');
    this.hotbar = document.getElementById('hotbar');
    this.info = document.getElementById('info');
    this.flash = document.getElementById('damage-flash');
    applyI18n();
  }

  // ---- Menú de mapas ----
  buildMenu(onSelect) {
    // Splash aleatorio junto al título.
    const splashes = [
      '¡Hola Eugenio! 👋', '¡Hecho con amor por papá y mamá! ❤️',
      '¿Ya encontraste los corazones? 💗', '¡Cuidado con los zombis! 🧟',
      '¡GOOOL! ⚽', '¡100% bloques!', '¡Craftea una espada! ⚔️',
      '¡Salta! ¡Salta! 🏃', '¡Eres un campeón! 🏆', '¡Trivia sorpresa! 🎓',
      '¡Los esqueletos tienen mala puntería!', '¡Las arañas saltan! 🕷️',
    ];
    document.getElementById('splash').textContent =
      splashes[Math.floor(Math.random() * splashes.length)];

    // Indicador de modo red: solo conecta cuando se abre por el link http.
    document.getElementById('menu-net').textContent =
      NET.available ? t('menuNetOn') : t('menuNetOff');
    document.getElementById('menu-net').className = NET.available ? 'net-on' : 'net-off';

    this.mapGrid.replaceChildren();
    for (const [key, map] of Object.entries(MAPS)) {
      const card = document.createElement('div');
      card.className = 'map-card';
      card.style.borderColor = map.color;
      card.style.setProperty('--map-color', map.color);

      const icon = document.createElement('div');
      icon.className = 'map-icon';
      icon.textContent = map.icon;

      const name = document.createElement('h2');
      name.textContent = t('map_' + key);

      const desc = document.createElement('p');
      desc.textContent = t('mapDesc_' + key);

      card.append(icon, name, desc);

      if (map.save) {
        const n = Storage.listSlots(key).length;
        if (n > 0) {
          const tag = document.createElement('span');
          tag.className = 'map-tag';
          tag.textContent = `💾 ${n} ${n === 1 ? t('oneSave') : t('manySaves')}`;
          card.append(tag);
        }
      }
      const saved = Storage.load(key);
      if (saved && saved.best !== undefined) {
        const best = document.createElement('span');
        best.className = 'map-tag';
        const m = Math.floor(saved.best / 60);
        best.textContent = `${t('bestTime')}: ${m}:${(saved.best % 60).toFixed(1).padStart(4, '0')}`;
        card.append(best);
      }

      card.addEventListener('click', () => onSelect(key));
      this.mapGrid.append(card);
    }
  }

  showMenu(show) {
    this.menu.classList.toggle('hidden', !show);
    document.getElementById('slots').classList.add('hidden');
    if (show) {
      this.hud.classList.add('hidden');
      this.overlay.classList.add('hidden');
      this.death.classList.add('hidden');
      this.winEl.classList.add('hidden');
    }
  }

  // Selector de circuitos/variantes de un mapa (récord por circuito).
  showVariants(mapKey, onPick) {
    const el = document.getElementById('slots');
    const list = document.getElementById('slots-list');
    document.getElementById('slots-title').textContent = t('map_' + mapKey);
    el.classList.remove('hidden');
    document.getElementById('slotsBackBtn').onclick = () => el.classList.add('hidden');

    list.replaceChildren();
    MAPS[mapKey].variants.forEach((v, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn slot-btn';
      const saved = Storage.load(`${mapKey}#v${i + 1}`);
      let best = '';
      if (saved && saved.best !== undefined) {
        const m = Math.floor(saved.best / 60);
        best = ` · 🏆 ${m}:${(saved.best % 60).toFixed(1).padStart(4, '0')}`;
      }
      btn.textContent = `${v.icon || '🏁'} ${t(v.key)}${best}`;
      btn.addEventListener('click', () => { el.classList.add('hidden'); onPick(i + 1); });
      list.append(btn);
    });
  }

  // Selector de partidas guardadas de un mapa: retomar, borrar o empezar nueva.
  showSlots(mapKey, onPick) {
    const el = document.getElementById('slots');
    const list = document.getElementById('slots-list');
    document.getElementById('slots-title').textContent = t('map_' + mapKey);
    el.classList.remove('hidden');
    document.getElementById('slotsBackBtn').onclick = () => el.classList.add('hidden');

    const render = () => {
      list.replaceChildren();
      for (const { slot, updated } of Storage.listSlots(mapKey)) {
        const row = document.createElement('div');
        row.className = 'slot-row';

        const main = document.createElement('button');
        main.className = 'btn slot-btn';
        const when = updated
          ? new Date(updated).toLocaleDateString() + ' ' +
            new Date(updated).toLocaleTimeString().slice(0, 5)
          : '';
        main.textContent = `🗺 ${t('gameSlot')} ${slot}${when ? ' · ' + when : ''}`;
        main.addEventListener('click', () => { el.classList.add('hidden'); onPick(slot); });

        const del = document.createElement('button');
        del.className = 'btn secondary slot-del';
        del.textContent = '🗑';
        del.title = t('deleteSave');
        del.addEventListener('click', () => {
          if (confirm(t('confirmDelete'))) { Storage.clearSlot(mapKey, slot); render(); }
        });

        row.append(main, del);
        list.append(row);
      }
      const free = Storage.freeSlot(mapKey);
      if (free) {
        const nuevo = document.createElement('button');
        nuevo.className = 'btn slot-btn slot-new';
        nuevo.textContent = `➕ ${t('newGame')}`;
        nuevo.addEventListener('click', () => { el.classList.add('hidden'); onPick(free); });
        list.append(nuevo);
      } else {
        const full = document.createElement('p');
        full.className = 'slots-full';
        full.textContent = t('slotsFull');
        list.append(full);
      }
    };
    render();
  }

  // ---- HUD ----
  // entries: [{id, count}] — count Infinity = sin número (modo libre).
  buildHotbar(atlasCanvas, entries, selectedIdx = 0) {
    this.hotbar.replaceChildren();
    entries.forEach(({ id, count }, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === selectedIdx ? ' selected' : '');
      slot.title = nameOf(id);

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;

      const icon = document.createElement('canvas');
      icon.width = 16;
      icon.height = 16;
      const ctx = icon.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const tile = iconTileOf(id);
      ctx.drawImage(
        atlasCanvas,
        (tile % ATLAS.COLS) * ATLAS.TILE, Math.floor(tile / ATLAS.COLS) * ATLAS.TILE,
        ATLAS.TILE, ATLAS.TILE, 0, 0, 16, 16
      );
      slot.append(num, icon);

      if (Number.isFinite(count) && count > 1) {
        const badge = document.createElement('span');
        badge.className = 'count';
        badge.textContent = count > 99 ? '99+' : count;
        slot.append(badge);
      }
      this.hotbar.append(slot);
    });
  }

  toast(text, ms = 2200) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('on'), ms);
  }

  setSelectedSlot(i) {
    this.hotbar.querySelectorAll('.slot').forEach((s, j) => {
      s.classList.toggle('selected', j === i);
    });
  }

  renderHealth(health, show = true) {
    if (!show) { this.hearts.replaceChildren(); return; }
    const spans = [];
    for (let i = 0; i < CFG.MAX_HEALTH; i++) {
      const span = document.createElement('span');
      span.className = i < health ? 'full' : 'empty';
      span.textContent = '❤';
      spans.push(span);
    }
    this.hearts.replaceChildren(...spans);
  }

  // Barra de hambre (null = ocultar, solo supervivencia).
  renderHunger(hunger) {
    const el = document.getElementById('hunger');
    if (hunger === null || hunger === undefined) { el.replaceChildren(); return; }
    const spans = [];
    for (let i = 0; i < CFG.MAX_HUNGER; i++) {
      const span = document.createElement('span');
      span.className = i < hunger ? 'full' : 'empty';
      span.textContent = '🍗';
      spans.push(span);
    }
    el.replaceChildren(...spans);
  }

  setInfo(text) {
    this.info.textContent = text || '';
  }

  // Pista persistente (letreros): se queda mientras estés cerca.
  setHint(text) {
    const el = document.getElementById('hint');
    if (el.textContent !== (text || '')) el.textContent = text || '';
  }

  setNetStatus(players) {
    const el = document.getElementById('netstatus');
    el.textContent = players ? `🌐 ${players}` : '';
    el.title = players ? `${players} jugador(es) en línea` : '';
  }

  damageFlash() {
    this.flash.classList.add('on');
    setTimeout(() => this.flash.classList.remove('on'), 120);
  }

  showPlaying(playing) {
    this.hud.classList.toggle('hidden', !playing);
    this.overlay.classList.toggle('hidden', playing);
  }

  showDeath(show) {
    this.death.classList.toggle('hidden', !show);
    if (show) this.overlay.classList.add('hidden');
  }

  hideEndScreens() {
    this.death.classList.add('hidden');
    this.winEl.classList.add('hidden');
  }

  showWin(timeText, isRecord) {
    document.getElementById('win-time').textContent =
      `${t('yourTime')}: ${timeText}` + (isRecord ? ` — ${t('newRecord')}` : '');
    this.winEl.classList.remove('hidden');
    this.overlay.classList.add('hidden');
  }
}
