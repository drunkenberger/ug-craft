// Items no-bloque (herramientas, armas, comida) y recetas de crafteo.
// Los bloques usan ids 1-99; los items 100+.
const ITEMS = {
  126: {key:'boat',tile:95,kind:'boat'},
  127: {key:'saddle',tile:96,kind:'saddle'},
  140: {key:'irongolem',tile:109,kind:'golem'},
  119: { key: 'seeds', tile: 79, kind: 'seed', crop: 42 },
  120: { key: 'carrot', tile: 80, kind: 'seed', crop: 44 },
  121: { key: 'wheat', tile: 81, kind: 'material' },
  122: { key: 'bread', tile: 82, kind: 'food', heal: 4 },
  123: { key: 'hoe', tile: 83, kind: 'hoe' },
  124: { key: 'whistle', tile: 84, kind: 'whistle' },
  125: { key: 'blueprint', tile: 85, kind: 'blueprint' },
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
  {out:{id:126,n:1},cost:[[7,5]],table:true},
  {out:{id:127,n:1},cost:[[7,3],[112,2]],table:true},
  {out:{id:140,n:1},cost:[[112,6]],table:true},
  { out: { id: 123, n: 1 }, cost: [[7,2],[103,2]], table: true },
  { out: { id: 119, n: 2 }, cost: [[20,1]], table: false },
  { out: { id: 120, n: 1 }, cost: [[119,3]], table: false },
  { out: { id: 122, n: 1 }, cost: [[121,3]], table: true },
  { out: { id: 124, n: 1 }, cost: [[112,1]], table: true },
  { out: { id: 125, n: 1 }, cost: [[7,24],[32,20]], table: true },
  { out: { id: 46, n: 2 }, cost: [[7,4]], table: true },
  { out: { id: 48, n: 6 }, cost: [[7,3]], table: true },
  { out: { id: 49, n: 4 }, cost: [[32,3]], table: true },
  { out: { id: 50, n: 1 }, cost: [[34,4],[35,4],[8,1]], table: true },
  { out: { id: 53, n: 2 }, cost: [[35,2],[111,1]], table: true },
  { out: { id: 33, n: 1 }, cost: [[4, 4], [111, 3]], table: true },
  { out: { id: 34, n: 2 }, cost: [[3, 4], [111, 2]], table: true },
  { out: { id: 35, n: 4 }, cost: [[4, 4], [3, 1]], table: true },
  { out: { id: 36, n: 4 }, cost: [[2, 4], [4, 1]], table: true },
  { out: { id: 37, n: 4 }, cost: [[112, 1], [3, 4]], table: true },
  { out: { id: 38, n: 4 }, cost: [[32, 4], [6, 1]], table: true },
  { out: { id: 39, n: 4 }, cost: [[3, 4], [111, 1]], table: true },
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
  // Muebles para la casa.
  { out: { id: 24, n: 1 }, cost: [[7, 4], [103, 2]],  table: true },  // mesa de comedor
  { out: { id: 25, n: 2 }, cost: [[7, 2], [103, 2]],  table: true },  // sillas
  { out: { id: 26, n: 1 }, cost: [[7, 6]],            table: true },  // estantería
  { out: { id: 27, n: 3 }, cost: [[20, 2]],           table: false }, // alfombras (flores tejidas)
  { out: { id: 28, n: 1 }, cost: [[7, 2], [20, 1]],   table: true },  // cuadro
  { out: { id: 29, n: 1 }, cost: [[111, 1], [103, 1]], table: true }, // farol
  { out: { id: 30, n: 2 }, cost: [[3, 1], [4, 1]],    table: true },  // floreros
  { out: { id: 31, n: 4 }, cost: [[4, 2]],            table: true },  // vidrio
  { out: { id: 32, n: 4 }, cost: [[3, 4]],            table: true },  // ladrillos de piedra
];

// Recetas del horno (clic derecho sobre un horno): carne cruda + leña.
const FURNACE_RECIPES = [
  { out: { id: 104, n: 1 }, cost: [[107, 1], [7, 1]], table: false },
  { out: { id: 105, n: 1 }, cost: [[108, 1], [7, 1]], table: false },
  { out: { id: 106, n: 1 }, cost: [[109, 1], [7, 1]], table: false },
];

// Qué suelta un bloque al romperse (0 = nada).
function dropOf(blockId) {
  if([63,64,65].includes(blockId))return 49;
  if (blockId === 47) return 46;
  if (blockId === 42 || blockId === 43) return 119;
  if (blockId === 44 || blockId === 45) return 120;
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

// Cuatro piezas por material; equiparlas las retira del inventario contado.
const ARMOR_SLOTS = ['helmet','chestplate','leggings','boots'];
const ARMOR_TIERS = [
  {key:'iron',material:112,color:0xc5d2dc,protection:.12},
  {key:'gold',material:8,color:0xf0bf42,protection:.08},
  {key:'diamond',material:113,color:0x42dccc,protection:.18},
];
for(let tier=0;tier<ARMOR_TIERS.length;tier++) for(let slot=0;slot<4;slot++) {
  const id=128+tier*4+slot,metal=ARMOR_TIERS[tier];
  ITEMS[id]={key:metal.key+'_'+ARMOR_SLOTS[slot],tile:97+tier*4+slot,kind:'armor',slot:ARMOR_SLOTS[slot],tier,protection:metal.protection};
  RECIPES.push({out:{id,n:1},cost:[[metal.material,[5,8,7,4][slot]]],table:true});
}
function normalizeArmor(saved={}) {
  const result={};
  for(const slot of ARMOR_SLOTS)if(ITEMS[saved?.[slot]]?.kind==='armor'&&ITEMS[saved[slot]].slot===slot)result[slot]=Number(saved[slot]);
  return result;
}
