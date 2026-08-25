// Punto de entrada: menú de mapas y ciclo de vida de las partidas.
(function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.classList.add('game');
  document.body.prepend(renderer.domElement);

  const { texture, canvas: atlasCanvas } = createAtlas();
  const material = new THREE.MeshLambertMaterial({ map: texture });
  // Materiales extra: plantas/antorchas (recorte) y agua (translúcida).
  const materials = {
    opaque: material,
    cross: new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide }),
    water: new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  };

  const ui = new UI();
  const controls = new Controls(renderer.domElement);
  const crafting = new CraftingUI();
  const chestUI = new ChestUI();
  const eggUI = new EggUI();
  const picker = new PickerUI();
  const charCreator = new CharacterCreator();
  document.getElementById('charBtn').addEventListener('click', () => charCreator.show());
  const ctx = { renderer, ui, controls, atlasCanvas, material, materials, crafting, chestUI, eggUI, picker };

  let game = null;
  Storage.migrate(); // guardados antiguos → slot 1
  const menuBg = new MenuBackground(renderer, materials);

  function startGame(mapKey, slot = 1, gameId = null) {
    if (game) game.stop();
    game = new Game(mapKey, ctx, slot, gameId);
    ui.showMenu(false);
    ui.hideEndScreens();
    ui.showPlaying(false); // overlay "haz clic para jugar"
  }

  // Antes de una partida compartida, asegurar un nombre (identidad para el estado guardado).
  function startServerGame(mapKey, gameId) {
    if (!Storage.playerName()) {
      const name = prompt(t('askPlayerName'));
      if (!name || !name.trim()) return; // sin nombre no arrancamos la compartida
      Storage.setPlayerName(name);
    }
    startGame(mapKey, 1, gameId);
  }

  // Mapas con guardado: elegir partida; con variantes: elegir circuito.
  function selectMap(mapKey) {
    if (MAPS[mapKey].save) {
      ui.showSlots(mapKey, (slot) => startGame(mapKey, slot), (id) => startServerGame(mapKey, id));
    } else if (MAPS[mapKey].variants) {
      ui.showVariants(mapKey, (slot) => startGame(mapKey, slot));
    } else {
      startGame(mapKey);
    }
  }

  function backToMenu() {
    if (game) {
      game.stop();
      game = null;
    }
    document.exitPointerLock();
    ui.buildMenu(selectMap);
    ui.showMenu(true);
  }

  ui.buildMenu(selectMap);
  ui.showMenu(true);

  document.getElementById('overlay').addEventListener('click', () => controls.lock());
  document.getElementById('menuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    backToMenu();
  });
  document.getElementById('winMenuBtn').addEventListener('click', backToMenu);
  document.getElementById('winAgainBtn').addEventListener('click', () => {
    if (game) startGame(game.mapKey, game.slot);
  });
  document.getElementById('respawnBtn').addEventListener('click', () => {
    if (!game) return;
    game.respawnPlayer();
    ui.showDeath(false);
    ui.showPlaying(false);
    controls.lock();
  });

  controls.onLockChange = (locked) => {
    if (game && !game.player.dead && !game.state.won &&
        !crafting.open && !chestUI.open && !eggUI.open && !picker.open) {
      ui.showPlaying(locked);
    }
  };

  // Esc cierra los menús abiertos (y vuelve a capturar el mouse).
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (crafting.open) crafting.close();
    if (chestUI.open) chestUI.close();
    if (eggUI.open) eggUI.close();
    if (picker.open) picker.close();
    if (charCreator.open) charCreator.close();
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (game) game.resize();
    menuBg.resize();
  });

  // Guardar al cerrar u ocultar la pestaña.
  window.addEventListener('pagehide', () => { if (game) game.save(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game) game.save();
  });

  // Handle de depuración (consola del navegador).
  window.GAME_CTX = {
    get game() { return game; },
    startGame, backToMenu, controls, ui,
  };

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (game) game.update(dt);
    else menuBg.render(dt); // panorama girando detrás del menú
  }
  animate();
})();
