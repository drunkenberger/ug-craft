// Constantes globales del juego.
const CFG = {
  SEED: 20260714,
  CHUNK: 16,          // ancho/largo de un chunk en bloques
  HEIGHT: 64,         // altura máxima del mundo
  RENDER_DIST: 3,     // radio de chunks visibles
  GRAVITY: -26,
  JUMP_SPEED: 8.6,
  PLAYER_SPEED: 4.8,
  PLAYER_HALF_W: 0.3,
  PLAYER_HEIGHT: 1.8,
  EYE_HEIGHT: 1.62,
  REACH: 6,           // distancia para romper/poner bloques
  MAX_HEALTH: 10,
  MAX_HUNGER: 10,     // barra de hambre (solo supervivencia)
  SEA_LEVEL: 21,      // altura del agua en supervivencia
  DAY_CYCLE_SECONDS: 300, // duración de un día completo
  MAX_ZOMBIES: 5, // tope de enemigos nocturnos (zombis, esqueletos, arañas)
};

// Definición de bloques: índices de tile en el atlas por cara.
const BLOCKS = {
  1: { key: 'grass',  top: 0, bottom: 2, side: 1 },
  2: { key: 'dirt',   top: 2, bottom: 2, side: 2 },
  3: { key: 'stone',  top: 3, bottom: 3, side: 3 },
  4: { key: 'sand',   top: 4, bottom: 4, side: 4 },
  5: { key: 'wood',   top: 6, bottom: 6, side: 5 },
  6: { key: 'leaves', top: 7, bottom: 7, side: 7 },
  7: { key: 'planks', top: 8, bottom: 8, side: 8 },
  8: { key: 'gold',   top: 9, bottom: 9, side: 9, needTier: 2 },
  9:  { key: 'table',   top: 10, bottom: 8,  side: 11 },
  10: { key: 'furnace', top: 24, bottom: 24, side: 23 },
  11: { key: 'chest',   top: 26, bottom: 26, side: 25 },
  12: { key: 'heart',   top: 27, bottom: 27, side: 27 },
  13: { key: 'sign',    top: 28, bottom: 28, side: 28 },
  // Minerales: needTier = nivel de pico requerido (1 madera, 2 piedra, 3 hierro).
  14: { key: 'coalore',    top: 29, bottom: 29, side: 29, needTier: 1 },
  15: { key: 'ironore',    top: 30, bottom: 30, side: 30, needTier: 2 },
  16: { key: 'diamondore', top: 31, bottom: 31, side: 31, needTier: 3 },
  // solid:false = no colisiona; cross = se dibuja como dos planos cruzados.
  17: { key: 'water',     top: 32, bottom: 32, side: 32, solid: false, liquid: true },
  18: { key: 'snow',      top: 33, bottom: 33, side: 33 },
  19: { key: 'torch',     top: 34, bottom: 34, side: 34, solid: false, cross: true, light: true },
  20: { key: 'flower',    top: 35, bottom: 35, side: 35, solid: false, cross: true },
  21: { key: 'tallgrass', top: 36, bottom: 36, side: 36, solid: false, cross: true },
  22: { key: 'sapling',   top: 37, bottom: 37, side: 37, solid: false, cross: true },
  23: { key: 'bed',       top: 38, bottom: 8,  side: 39 },
};

// Bloques disponibles en la barra rápida por defecto (teclas 1-7).
const HOTBAR = [1, 2, 3, 4, 5, 6, 7];
