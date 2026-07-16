# EugeCraft

Clon de Minecraft en el navegador (Three.js r128, sin build ni dependencias externas).

## Comandos

- **Jugar solo**: doble clic en `index.html` (no requiere servidor ni internet).
- **Multijugador**: doble clic en `servidor.command` (o `node server.js`); cada jugador abre `http://<ip-o-nombre-tailscale>:8940`. El multijugador se activa solo cuando el juego se sirve por http (Supervivencia y Creativo).
- **Desarrollo/pruebas**: `python3 -m http.server 8931` y abrir `http://localhost:8931` (ojo: por ser http activa el modo red).
- No hay build, lint ni tests automatizados; se verifica jugando.

## Arquitectura

Scripts globales cargados en orden desde `index.html` (sin módulos ES, para que funcione con `file://`):

- `js/config.js` — constantes y definición de bloques (`CFG`, `BLOCKS`, `HOTBAR`). Flags de bloque: `solid:false` (sin colisión: agua, plantas), `cross` (se dibuja como planos cruzados), `liquid`, `needTier` (nivel de pico para minarlo).
- `js/i18n.js` — traducciones es/en; idioma fijo en `LANG`.
- `js/noise.js` — ruido Perlin con semilla (`CFG.SEED` → mundo reproducible).
- `js/textures.js` — atlas de texturas pixel-art generado en canvas.
- `js/storage.js` — guardado de partidas en localStorage (`eugecraft.<mapa>`).
- `js/items.js` — items no-bloque (ids 100+: armas, palos, comida, minerales), recetas (`RECIPES`) y drops. Picos con `pickTier` 1-3 (madera/piedra/hierro).
- `js/survival.js` — sistemas de supervivencia/creativo: antorchas (set `game.torches` + pool de 6 PointLights repartidas a las más cercanas) y retoños que crecen en árbol (`game.saplings`); ambos se reconstruyen desde `world.edits` al cargar (`scanWorldExtras`) y se mantienen con `trackBlockChange`.
- `js/inventory.js` — inventario `counted` (supervivencia) o `free` (infinito).
- `js/minimap.js` — minimapa tipo radar (mapas con `minimap:true`, hoy solo supervivencia): terreno top-down que gira con la cámara, flecha del jugador, norte y otros jugadores como puntos (al borde si están lejos).
- `js/creature.js` — base de zombis (`js/mobs.js`) y animales (`js/animals.js`: cerdo, vaca, gallina, perro). Los perros se adoptan con clic derecho + hueso (`setTamed`): siguen a su dueño (`owner` = 'local' o peer id, resuelto contra `combatTargets`), no despawnean y persisten en `saved.pets`; en red el invitado manda `tame` al anfitrión y el flag `tm` del sync pone el collar en los títeres.
- `js/character.js` — personaje personalizable: apariencia en localStorage (`eugecraft.character`, `Character.appearance()`) y clase `Humanoid` (pelo por estilo, cara, brazos/piernas articulados con `swingLegs`, `build(app)` para cambiarla en vivo). La usan avatares remotos, rival y avatar de fútbol. Se sincroniza en red con el mensaje `skin` (se envía en `welcome` y `peer-join`). Mapas con `thirdPerson` permiten alternar vista FIFA con V; con `ownAvatar` además se dibuja tu personaje (supervivencia; la cámara se acerca si un bloque se interpone).
- `js/charcreator.js` — panel "Mi personaje" del menú: vista previa 3D animada + opciones de piel/pelo/peinado/camiseta/pantalón (`CHARACTER_CHOICES`).
- `js/sky.js` — cielo decorativo (lo crea `DayNight`): discos de sol/luna, estrellas nocturnas y nubes a la deriva que siguen al jugador; todo con `fog:false` porque la niebla del mundo es corta.
- `js/crafting.js` — menú de crafteo (tecla C o clic derecho en mesa; armas requieren mesa cerca). El horno reutiliza esta UI con `FURNACE_RECIPES` (clic derecho en horno).
- `js/chest.js` — interfaz de cofres; el contenido vive en `game.chests` ("x,y,z" → [[id,n]]) y se persiste con la partida.
- `js/eggs.js` — easter eggs: trivia P1 (rotan y reciclan) + mensajes personales (bloque corazón id 12, mitad en superficie + hitos únicos); cada mensaje se muestra una sola vez (estado en `eugecraft.eggs`). Son personales para Eugenio: no traducir ni reciclar.
- `js/picker.js` — selector de inventario (tecla 9): flechas/WASD/Enter o mouse.
- Guardado por slots: mapas con `save:true` usan `eugecraft.<mapa>#<slot>` (máx 3, ver `Storage.listSlots`); los récords de minijuegos siguen en `eugecraft.<mapa>`.
- `js/soccer.js` — mapa de fútbol: cancha generada, balón con física simple y rival IA (`SoccerBot`); hooks `onClick`/`onStop` del mapa.
- `js/treasure.js` — caza del tesoro: zonas (desierto/bosque/montaña), túneles con rampa, caminos de madera, letreros con pistas (`TREASURE_SIGNS`, bloque 13, hook `onSign`) y 5 tesoros fijos (`TREASURE_SPOTS`).
- `js/race.js` — carreras tipo kart: pista elíptica, pads de turbo, 3 vueltas por checkpoints, kart propio + rival por waypoints. `map.driving` activa `Player.updateKart` y `controls.steerMode` (A/D giran, mouse solo cámara).
- `js/maze.js` — laberinto 🌀: rejilla de celdas 3×3 con muros de piedra de 3 de alto, generado por semilla según la variante (`game.slot`, recursive backtracker + ~14% de muros tumbados → varias rutas con ciclos), meta de oro central, 3 estrellas en callejones y torres-faro doradas (`MazeState`).
- `js/parkour.js` — parkour: 3 circuitos elegibles (`variants` del mapa; constructor por circuito con contexto compartido): C1 «Clásico», C2 «El Castillo», C3 «La Mina». Checkpoints con respawn, estrellas (mallas que giran), salto-pads (impulso ≈ √(2·g·altura)) y récord por circuito (`ParkourState`). Regla de diseño del usuario: NADA de plataformas flotantes sueltas — estructuras conectadas (rampas, murallas, túneles).
- `server.js` + `servidor.command` — servidor multijugador (Node sin deps): estáticos + WebSocket artesanal, salas por mapa, anfitrión = primer jugador (simula mobs y sube sus ediciones). `js/net.js` cliente, `js/netplay.js` avatares/títeres. Los mobs usan `targetsFn` multi-objetivo. Cofres NO se sincronizan (locales por jugador).
- `js/physics.js` — colisiones AABB contra la rejilla, compartidas por jugador y mobs.
- `js/world.js` — chunks 16×64×16, tres mallas por chunk (sólidos, cruzados con alphaTest, agua translúcida); `isSolid` ignora bloques con `solid:false`; el generador de terreno lo aporta cada mapa. Raycast de romper/poner usa `raycastTargets()` (sólidos + plantas, sin agua).
- `js/maps.js` — mapas/minijuegos (`MAPS`): survival, creative, parkour, treasure. Cada mapa define generador, reglas (zombis, daño, construcción, `hunger`) y hooks (`update`, `onBreak`, `onVoidFall`). El terreno de supervivencia (`survivalHeightAt`) añade océanos/montañas, biomas por temperatura, cuevas (`caveAt`) y minerales por profundidad (`oreAt`); el tesoro sigue usando `terrainHeightAt` sin relieve extra (sus coordenadas son fijas).
- `js/game.js` — clase `Game`: una partida en un mapa (escena, mundo, jugador, autosave cada 5 s).
- `js/main.js` — menú de mapas y ciclo de vida de partidas.
- `js/player.js`, `js/controls.js`, `js/mobs.js`, `js/daynight.js`, `js/ui.js`.

Guardado: supervivencia y creativo persisten ediciones de bloques + posición + hora (y en supervivencia: hambre, día y punto de respawn de la cama); parkour y tesoro solo guardan el mejor tiempo. En la consola del navegador existe `window.GAME_CTX` (`game`, `startGame(key)`, `backToMenu()`) para depurar, p. ej. `GAME_CTX.game.daynight.time = 0.75` fuerza la noche.
