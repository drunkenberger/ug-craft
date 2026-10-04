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
  // Muebles para la casa (se craftean con mesa cerca).
  24: { key: 'diningtable', top: 49, bottom: 8,  side: 50 },
  25: { key: 'chair',       top: 8,  bottom: 8,  side: 51 },
  26: { key: 'bookshelf',   top: 8,  bottom: 8,  side: 52 },
  27: { key: 'carpet',      top: 53, bottom: 53, side: 53 },
  28: { key: 'painting',    top: 8,  bottom: 8,  side: 54, solid: false },
  29: { key: 'lantern',     top: 55, bottom: 55, side: 55, light: true },
  30: { key: 'vase',        top: 56, bottom: 56, side: 57, solid: false },
  31: { key: 'glass',       top: 58, bottom: 58, side: 58, solid: false },
  33: { key: 'tnt', top: 61, bottom: 61, side: 60 },
  34: { key: 'obsidian', top: 62, bottom: 62, side: 62, needTier: 3 },
  35: { key: 'quartz', top: 63, bottom: 63, side: 63 },
  36: { key: 'terracotta', top: 64, bottom: 64, side: 64 },
  37: { key: 'copper', top: 65, bottom: 65, side: 65 },
  38: { key: 'mossbrick', top: 66, bottom: 66, side: 66 },
  39: { key: 'basalt', top: 67, bottom: 67, side: 67 },
  41: { key: 'farmland', top: 69, bottom: 2, side: 2 },
  42: { key: 'wheatSprout', top: 70, bottom: 70, side: 70, solid: false, cross: true },
  43: { key: 'wheatCrop', top: 71, bottom: 71, side: 71, solid: false, cross: true },
  44: { key: 'carrotSprout', top: 72, bottom: 72, side: 72, solid: false, cross: true },
  45: { key: 'carrotCrop', top: 73, bottom: 73, side: 73, solid: false, cross: true },
  46: { key: 'door', top: 8, bottom: 8, side: 74, shape: 'door' },
  47: { key: 'openDoor', top: 8, bottom: 8, side: 74, solid: false, shape: 'openDoor' },
  48: { key: 'slab', top: 8, bottom: 8, side: 8, shape: 'slab' },
  49: { key: 'stairs', top: 59, bottom: 32, side: 59, shape: 'stairs' },
  50: { key: 'portal', top: 75, bottom: 75, side: 75, solid: false, cross: true, light: true },
  51: { key: 'mushroomCap', top: 76, bottom: 63, side: 76 },
  52: { key: 'mushroomStem', top: 63, bottom: 63, side: 77 },
  54: { key:'crystal', top:86,bottom:86,side:86,light:true,needTier:1 },
  55: { key:'runeSun', top:87,bottom:87,side:87,light:true,unbreakable:true },
  56: { key:'runeMoon', top:88,bottom:88,side:88,light:true,unbreakable:true },
  57: { key:'runeLeaf', top:89,bottom:89,side:89,light:true,unbreakable:true },
  58: { key:'runeSolved', top:90,bottom:90,side:90,light:true,unbreakable:true },
  59: { key:'castleGate', top:91,bottom:91,side:91,unbreakable:true },
  60: { key:'royalChest', top:92,bottom:92,side:92,unbreakable:true },
  61: { key:'trophy', top:93,bottom:93,side:93,light:true },
  62: { key:'caveCache', top:94,bottom:94,side:94,unbreakable:true },
  63: { key:'stairs', top:59,bottom:59,side:59,shape:'stairs',rotation:1 },
  64: { key:'stairs', top:59,bottom:59,side:59,shape:'stairs',rotation:2 },
  65: { key:'stairs', top:59,bottom:59,side:59,shape:'stairs',rotation:3 },
  53: { key: 'glowstone', top: 78, bottom: 78, side: 78, light: true },
  40: { key: 'litTnt', top: 61, bottom: 61, side: 68, light: true },
  32: { key: 'brick',       top: 59, bottom: 59, side: 59 },
};

// Bloques disponibles en la barra rápida por defecto (teclas 1-7).
const HOTBAR = [1, 2, 3, 4, 5, 6, 7];

// Cajas locales compartidas por dibujo y colisiones: [minX,minY,minZ,maxX,maxY,maxZ].
function blockBoxes(id) {
  const shape = BLOCKS[id] && BLOCKS[id].shape;
  if (shape === 'slab') return [[0,0,0,1,.5,1]];
  if (shape === 'stairs') {
    const upper=[[0,.5,.5,1,1,1],[0,.5,0,.5,1,1],[0,.5,0,1,1,.5],[.5,.5,0,1,1,1]][BLOCKS[id].rotation||0];
    return [[0,0,0,1,.5,1],upper];
  }
  if (shape === 'door') return [[0,0,0,1,1,.16]];
  if (shape === 'openDoor') return [[0,0,0,.16,1,1]];
  return [[0,0,0,1,1,1]];
}
