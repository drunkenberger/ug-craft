// Items no-bloque (herramientas, armas, comida) y recetas de crafteo.
// Los bloques usan ids 1-99; los items 100+.
const ITEMS = {
  100: { key: 'pickaxe',     tile: 12, kind: 'weapon', damage: 2, pickTier: 1 },
  101: { key: 'sword',       tile: 13, kind: 'weapon', damage: 3 },
  102: { key: 'crossbow',    tile: 14, kind: 'crossbow', damage: 2 },
  103: { key: 'stick',       tile: 15, kind: 'material' },
  104: { key: 'porkchop',    tile: 16, kind: 'food', heal: 3 },
  105: { key: 'beef',        tile: 17, kind: 'food', heal: 4 },
  106: { key: 'chickenmeat', tile: 18, kind: 'food', heal: 2 },
  107: { key: 'rawpork',     tile: 19, kind: 'food', heal: 1 },
  108: { key: 'rawbeef',     tile: 20, kind: 'food', heal: 1 },
  109: { key: 'rawchicken',  tile: 21, kind: 'food', heal: 1 },
  110: { key: 'arrow',       tile: 22, kind: 'material' },
  111: { key: 'coal',         tile: 41, kind: 'material' },
  112: { key: 'iron',         tile: 42, kind: 'material' },
  113: { key: 'diamond',      tile: 43, kind: 'material' },
  114: { key: 'stonepickaxe', tile: 44, kind: 'weapon', damage: 2, pickTier: 2 },
  115: { key: 'ironpickaxe',  tile: 45, kind: 'weapon', damage: 3, pickTier: 3 },
  116: { key: 'ironsword',    tile: 46, kind: 'weapon', damage: 5 },
  117: { key: 'apple',        tile: 47, kind: 'food', heal: 2 },
  118: { key: 'bone',         tile: 48, kind: 'material' },
};

function isBlockId(id) { return id < 100; }
function defOf(id) { return isBlockId(id) ? BLOCKS[id] : ITEMS[id]; }
function iconTileOf(id) {
  const def = defOf(id);
  return isBlockId(id) ? def.side : def.tile;
}
function nameOf(id) {
  const def = defOf(id);
  return t((isBlockId(id) ? 'block_' : 'item_') + def.key);
}

// Recetas: out = {id, n}; cost = [[id, n], ...]; table = requiere mesa cerca.
const RECIPES = [
  { out: { id: 7,   n: 4 }, cost: [[5, 1]],           table: false }, // tronco → tablones
  { out: { id: 103, n: 4 }, cost: [[7, 2]],           table: false }, // tablones → palos
  { out: { id: 9,   n: 1 }, cost: [[7, 4]],           table: false }, // tablones → mesa
  { out: { id: 100, n: 1 }, cost: [[7, 3], [103, 2]], table: true },  // pico
  { out: { id: 101, n: 1 }, cost: [[7, 2], [103, 1]], table: true },  // espada
  { out: { id: 102, n: 1 }, cost: [[103, 3], [3, 2]], table: true },  // ballesta
  { out: { id: 110, n: 4 }, cost: [[103, 1], [3, 1]], table: false }, // flechas
  { out: { id: 10,  n: 1 }, cost: [[3, 8]],           table: true },  // horno
  { out: { id: 11,  n: 1 }, cost: [[7, 8]],           table: true },  // cofre
  { out: { id: 19,  n: 4 }, cost: [[111, 1], [103, 1]], table: false }, // antorchas
  { out: { id: 110, n: 2 }, cost: [[118, 1]],           table: false }, // hueso → flechas
  { out: { id: 23,  n: 1 }, cost: [[7, 6]],             table: true },  // cama
  { out: { id: 114, n: 1 }, cost: [[3, 3], [103, 2]],   table: true },  // pico de piedra
  { out: { id: 115, n: 1 }, cost: [[112, 3], [103, 2]], table: true },  // pico de hierro
  { out: { id: 116, n: 1 }, cost: [[112, 2], [103, 1]], table: true },  // espada de hierro
];

// Recetas del horno (clic derecho sobre un horno): carne cruda + leña.
const FURNACE_RECIPES = [
  { out: { id: 104, n: 1 }, cost: [[107, 1], [7, 1]], table: false },
  { out: { id: 105, n: 1 }, cost: [[108, 1], [7, 1]], table: false },
  { out: { id: 106, n: 1 }, cost: [[109, 1], [7, 1]], table: false },
];

// Qué suelta un bloque al romperse (0 = nada).
function dropOf(blockId) {
  if (blockId === 6) return 0;  // hojas (a veces sueltan manzana/retoño, ver game.js)
  if (blockId === 12) return 0; // corazón: el regalo es el mensaje
  if (blockId === 13) return 0; // letrero: mejor dejarlo en su lugar
  if (blockId === 1) return 2;  // pasto → tierra
  if (blockId === 14) return 111; // carbón
  if (blockId === 15) return 112; // hierro
  if (blockId === 16) return 113; // diamante
  if (blockId === 17) return 0;   // agua
  if (blockId === 21) return 0;   // hierba alta
  return blockId;
}
