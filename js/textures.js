// Genera el atlas de texturas pixel-art en un canvas (sin archivos de imagen).
const ATLAS = { TILE: 16, COLS: 16 };

function shade([r, g, b], d) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + d)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function paintNoise(ctx, x0, y0, rng, base, vary) {
  for (let y = 0; y < ATLAS.TILE; y++) {
    for (let x = 0; x < ATLAS.TILE; x++) {
      ctx.fillStyle = shade(base, (rng() - 0.5) * vary);
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}

// Mineral: base de piedra con vetas de color.
function paintOre(ctx, x0, y0, rng, color) {
  paintNoise(ctx, x0, y0, rng, [125, 125, 125], 26);
  for (let i = 0; i < 7; i++) {
    const x = 1 + Math.floor(rng() * 13);
    const y = 1 + Math.floor(rng() * 13);
    ctx.fillStyle = shade(color, (rng() - 0.5) * 30);
    ctx.fillRect(x0 + x, y0 + y, 2, 2);
  }
}

const TILE_PAINTERS = {
  0: (ctx, x0, y0, rng) => paintNoise(ctx, x0, y0, rng, [106, 170, 64], 36), // pasto arriba
  1: (ctx, x0, y0, rng) => { // pasto lado: tierra con franja verde
    paintNoise(ctx, x0, y0, rng, [134, 96, 67], 30);
    for (let x = 0; x < ATLAS.TILE; x++) {
      const depth = 2 + Math.floor(rng() * 3);
      for (let y = 0; y < depth; y++) {
        ctx.fillStyle = shade([106, 170, 64], (rng() - 0.5) * 36);
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  },
  2: (ctx, x0, y0, rng) => paintNoise(ctx, x0, y0, rng, [134, 96, 67], 32),   // tierra
  3: (ctx, x0, y0, rng) => paintNoise(ctx, x0, y0, rng, [125, 125, 125], 26), // piedra
  4: (ctx, x0, y0, rng) => paintNoise(ctx, x0, y0, rng, [219, 207, 163], 16), // arena
  5: (ctx, x0, y0, rng) => { // tronco lado: vetas verticales
    for (let x = 0; x < ATLAS.TILE; x++) {
      const dark = x % 4 === 0 ? -25 : 0;
      for (let y = 0; y < ATLAS.TILE; y++) {
        ctx.fillStyle = shade([102, 81, 49], dark + (rng() - 0.5) * 20);
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  },
  6: (ctx, x0, y0, rng) => { // tronco arriba: anillos
    paintNoise(ctx, x0, y0, rng, [155, 125, 78], 14);
    ctx.fillStyle = shade([102, 81, 49], 0);
    const c = ATLAS.TILE / 2;
    for (let r = 2; r <= 7; r += 2) {
      ctx.strokeStyle = shade([102, 81, 49], (rng() - 0.5) * 20);
      ctx.strokeRect(x0 + c - r, y0 + c - r, r * 2, r * 2);
    }
  },
  7: (ctx, x0, y0, rng) => { // hojas
    for (let y = 0; y < ATLAS.TILE; y++) {
      for (let x = 0; x < ATLAS.TILE; x++) {
        const base = rng() < 0.12 ? [30, 70, 20] : [60, 124, 38];
        ctx.fillStyle = shade(base, (rng() - 0.5) * 40);
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  },
  8: (ctx, x0, y0, rng) => { // tablones: líneas horizontales
    for (let y = 0; y < ATLAS.TILE; y++) {
      const dark = y % 4 === 3 ? -35 : 0;
      for (let x = 0; x < ATLAS.TILE; x++) {
        ctx.fillStyle = shade([168, 136, 82], dark + (rng() - 0.5) * 16);
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  },
  9: (ctx, x0, y0, rng) => { // oro: dorado con destellos
    paintNoise(ctx, x0, y0, rng, [235, 190, 52], 30);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rng() * (ATLAS.TILE - 1));
      const y = Math.floor(rng() * (ATLAS.TILE - 1));
      ctx.fillStyle = 'rgb(255,250,200)';
      ctx.fillRect(x0 + x, y0 + y, 2, 1);
      ctx.fillRect(x0 + x, y0 + y, 1, 2);
    }
  },
  10: (ctx, x0, y0, rng) => { // mesa de crafteo: tapa con rejilla
    TILE_PAINTERS[8](ctx, x0, y0, rng);
    ctx.fillStyle = 'rgb(90,66,40)';
    ctx.fillRect(x0, y0, 16, 2); ctx.fillRect(x0, y0 + 14, 16, 2);
    ctx.fillRect(x0, y0, 2, 16); ctx.fillRect(x0 + 14, y0, 2, 16);
    ctx.fillRect(x0 + 7, y0, 2, 16); ctx.fillRect(x0, y0 + 7, 16, 2);
  },
  11: (ctx, x0, y0, rng) => { // mesa de crafteo: lado con herramientas
    TILE_PAINTERS[8](ctx, x0, y0, rng);
    ctx.fillStyle = 'rgb(90,66,40)';
    ctx.fillRect(x0 + 3, y0 + 3, 4, 5);
    ctx.fillRect(x0 + 9, y0 + 3, 4, 5);
    ctx.fillStyle = 'rgb(200,200,205)';
    ctx.fillRect(x0 + 4, y0 + 4, 2, 3);
    ctx.fillRect(x0 + 10, y0 + 4, 2, 3);
  },
  23: (ctx, x0, y0, rng) => { // horno: lado con boca de fuego
    paintNoise(ctx, x0, y0, rng, [105, 105, 105], 22);
    ctx.fillStyle = 'rgb(25,25,25)';
    ctx.fillRect(x0 + 4, y0 + 7, 8, 7);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgb(255,140,20)' : 'rgb(255,220,60)';
      ctx.fillRect(x0 + 5 + Math.floor(rng() * 6), y0 + 10 + Math.floor(rng() * 3), 1, 1);
    }
  },
  24: (ctx, x0, y0, rng) => { // horno: tapa de piedra oscura
    paintNoise(ctx, x0, y0, rng, [88, 88, 88], 18);
  },
  25: (ctx, x0, y0, rng) => { // cofre: lado con cerradura
    paintNoise(ctx, x0, y0, rng, [155, 110, 55], 18);
    ctx.fillStyle = 'rgb(95,65,30)';
    ctx.fillRect(x0, y0, 16, 1); ctx.fillRect(x0, y0 + 15, 16, 1);
    ctx.fillRect(x0, y0, 1, 16); ctx.fillRect(x0 + 15, y0, 1, 16);
    ctx.fillRect(x0, y0 + 6, 16, 2);
    ctx.fillStyle = 'rgb(200,200,205)';
    ctx.fillRect(x0 + 7, y0 + 5, 2, 4);
  },
  26: (ctx, x0, y0, rng) => { // cofre: tapa
    paintNoise(ctx, x0, y0, rng, [155, 110, 55], 18);
    ctx.fillStyle = 'rgb(95,65,30)';
    ctx.fillRect(x0, y0, 16, 2); ctx.fillRect(x0, y0 + 14, 16, 2);
    ctx.fillRect(x0, y0, 2, 16); ctx.fillRect(x0 + 14, y0, 2, 16);
  },
  28: (ctx, x0, y0, rng) => { // letrero: tabla clara con "texto" y poste
    paintNoise(ctx, x0, y0, rng, [122, 88, 50], 16);
    ctx.fillStyle = 'rgb(214,185,140)';
    ctx.fillRect(x0 + 1, y0 + 2, 14, 8);
    ctx.fillStyle = 'rgb(95,65,30)';
    for (const ly of [4, 6, 8]) ctx.fillRect(x0 + 3, y0 + ly, 10 - (ly === 8 ? 4 : 0), 1);
  },
  29: (ctx, x0, y0, rng) => paintOre(ctx, x0, y0, rng, [38, 38, 42]),    // carbón
  30: (ctx, x0, y0, rng) => paintOre(ctx, x0, y0, rng, [216, 167, 124]), // hierro
  31: (ctx, x0, y0, rng) => paintOre(ctx, x0, y0, rng, [92, 219, 213]),  // diamante
  32: (ctx, x0, y0, rng) => { // agua
    paintNoise(ctx, x0, y0, rng, [52, 110, 200], 26);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgb(120,170,235)';
      ctx.fillRect(x0 + Math.floor(rng() * 12), y0 + Math.floor(rng() * 15), 3, 1);
    }
  },
  33: (ctx, x0, y0, rng) => paintNoise(ctx, x0, y0, rng, [240, 246, 250], 10), // nieve
  34: (ctx, x0, y0, rng) => { // antorcha (fondo transparente)
    ctx.clearRect(x0, y0, ATLAS.TILE, ATLAS.TILE);
    for (let y = 6; y < 16; y++) {
      ctx.fillStyle = shade([122, 88, 50], (rng() - 0.5) * 20);
      ctx.fillRect(x0 + 7, y0 + y, 2, 1);
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgb(255,150,30)' : 'rgb(255,225,80)';
      ctx.fillRect(x0 + 6 + Math.floor(rng() * 4), y0 + 2 + Math.floor(rng() * 4), 1, 1);
    }
    ctx.fillStyle = 'rgb(255,240,150)';
    ctx.fillRect(x0 + 7, y0 + 3, 2, 2);
  },
  35: (ctx, x0, y0, rng) => { // flor (fondo transparente)
    ctx.clearRect(x0, y0, ATLAS.TILE, ATLAS.TILE);
    ctx.fillStyle = 'rgb(60,140,50)';
    ctx.fillRect(x0 + 7, y0 + 8, 2, 8);
    ctx.fillRect(x0 + 9, y0 + 10, 2, 1); // hojita
    ctx.fillStyle = 'rgb(220,50,60)';
    ctx.fillRect(x0 + 5, y0 + 3, 6, 4);
    ctx.fillRect(x0 + 6, y0 + 2, 4, 6);
    ctx.fillStyle = 'rgb(255,220,80)';
    ctx.fillRect(x0 + 7, y0 + 4, 2, 2);
  },
  36: (ctx, x0, y0, rng) => { // hierba alta (fondo transparente)
    ctx.clearRect(x0, y0, ATLAS.TILE, ATLAS.TILE);
    for (const bx of [2, 4, 6, 8, 10, 12, 14]) {
      const hgt = 6 + Math.floor(rng() * 7);
      for (let y = 0; y < hgt; y++) {
        ctx.fillStyle = shade([88, 150, 55], (rng() - 0.5) * 40);
        ctx.fillRect(x0 + bx + (y > hgt - 3 ? Math.floor(rng() * 2) : 0), y0 + 15 - y, 1, 1);
      }
    }
  },
  37: (ctx, x0, y0, rng) => { // retoño (fondo transparente)
    ctx.clearRect(x0, y0, ATLAS.TILE, ATLAS.TILE);
    ctx.fillStyle = 'rgb(102,81,49)';
    ctx.fillRect(x0 + 7, y0 + 10, 2, 6);
    for (let y = 3; y < 11; y++) {
      for (let x = 4; x < 12; x++) {
        if (rng() < 0.55) {
          ctx.fillStyle = shade([60, 124, 38], (rng() - 0.5) * 40);
          ctx.fillRect(x0 + x, y0 + y, 1, 1);
        }
      }
    }
  },
  38: (ctx, x0, y0, rng) => { // cama: tapa (almohada + cobija)
    paintNoise(ctx, x0, y0, rng, [178, 40, 45], 18);
    ctx.fillStyle = 'rgb(240,240,245)';
    ctx.fillRect(x0 + 1, y0 + 1, 14, 4);
    ctx.fillStyle = 'rgb(120,25,30)';
    ctx.fillRect(x0, y0 + 6, 16, 1);
  },
  39: (ctx, x0, y0, rng) => { // cama: lado (madera + franja roja)
    TILE_PAINTERS[8](ctx, x0, y0, rng);
    ctx.fillStyle = 'rgb(178,40,45)';
    ctx.fillRect(x0, y0, 16, 5);
    ctx.fillStyle = 'rgb(240,240,245)';
    ctx.fillRect(x0, y0, 4, 5);
  },
  49: (ctx, x0, y0, rng) => { // mesa de comedor: tapa con mantel
    TILE_PAINTERS[8](ctx, x0, y0, rng);
    ctx.fillStyle = 'rgb(235,235,240)';
    ctx.fillRect(x0 + 3, y0 + 3, 10, 10);
    ctx.fillStyle = 'rgb(200,60,60)';
    ctx.fillRect(x0 + 3, y0 + 3, 10, 1); ctx.fillRect(x0 + 3, y0 + 12, 10, 1);
    ctx.fillRect(x0 + 3, y0 + 3, 1, 10); ctx.fillRect(x0 + 12, y0 + 3, 1, 10);
  },
  50: (ctx, x0, y0, rng) => { // mesa de comedor: lado (tapa + patas)
    paintNoise(ctx, x0, y0, rng, [120, 92, 58], 12); // sombra bajo la mesa
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < ATLAS.TILE; x++) {
        ctx.fillStyle = shade([168, 136, 82], (rng() - 0.5) * 16);
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
    ctx.fillStyle = 'rgb(90,66,40)';
    ctx.fillRect(x0 + 1, y0 + 4, 3, 12);
    ctx.fillRect(x0 + 12, y0 + 4, 3, 12);
  },
  51: (ctx, x0, y0, rng) => { // silla: respaldo con barrotes y patas
    paintNoise(ctx, x0, y0, rng, [140, 108, 66], 12);
    ctx.fillStyle = 'rgb(90,66,40)';
    ctx.fillRect(x0, y0, 16, 2); // borde superior del respaldo
    for (const bx of [2, 7, 12]) ctx.fillRect(x0 + bx, y0 + 2, 2, 6);
    ctx.fillRect(x0, y0 + 8, 16, 2); // asiento
    ctx.fillRect(x0 + 1, y0 + 10, 3, 6);
    ctx.fillRect(x0 + 12, y0 + 10, 3, 6);
  },
  52: (ctx, x0, y0, rng) => { // estantería: filas de libros de colores
    TILE_PAINTERS[8](ctx, x0, y0, rng);
    const colors = [[200, 60, 60], [60, 120, 200], [70, 160, 70], [220, 180, 60], [150, 80, 180]];
    for (const ry of [2, 9]) {
      ctx.fillStyle = 'rgb(60,44,26)';
      ctx.fillRect(x0 + 1, y0 + ry - 1, 14, 7);
      let bx = 2;
      while (bx < 14) {
        const w = 2 + Math.floor(rng() * 2);
        ctx.fillStyle = shade(colors[Math.floor(rng() * colors.length)], (rng() - 0.5) * 30);
        ctx.fillRect(x0 + bx, y0 + ry, Math.min(w, 14 - bx), 5);
        bx += w + (rng() < 0.3 ? 1 : 0);
      }
    }
  },
  53: (ctx, x0, y0, rng) => { // alfombra: roja con cenefa dorada
    paintNoise(ctx, x0, y0, rng, [172, 48, 52], 20);
    ctx.fillStyle = 'rgb(220,180,80)';
    ctx.fillRect(x0 + 1, y0 + 1, 14, 1); ctx.fillRect(x0 + 1, y0 + 14, 14, 1);
    ctx.fillRect(x0 + 1, y0 + 1, 1, 14); ctx.fillRect(x0 + 14, y0 + 1, 1, 14);
    ctx.fillRect(x0 + 7, y0 + 7, 2, 2); // rombo central
    ctx.fillRect(x0 + 6, y0 + 8, 4, 1); ctx.fillRect(x0 + 8, y0 + 6, 1, 4);
  },
  27: (ctx, x0, y0, rng) => { // bloque corazón (easter egg)
    paintNoise(ctx, x0, y0, rng, [225, 130, 160], 20);
    // corazón blanco pixelado al centro
    const hx = x0 + 4, hy = y0 + 4;
    ctx.fillStyle = 'rgb(255,245,248)';
    ctx.fillRect(hx + 1, hy, 2, 2); ctx.fillRect(hx + 5, hy, 2, 2);
    ctx.fillRect(hx, hy + 2, 8, 2);
    ctx.fillRect(hx + 1, hy + 4, 6, 1);
    ctx.fillRect(hx + 2, hy + 5, 4, 1);
    ctx.fillRect(hx + 3, hy + 6, 2, 1);
  },
};

// ---- Iconos de items (arte 8x8 escalado x2, con transparencia) ----
const ICON_PALETTE = {
  G: 'rgb(150,150,155)', // metal gris
  B: 'rgb(122,88,50)',   // madera
  W: 'rgb(226,228,235)', // acero claro
  P: 'rgb(210,130,90)',  // chuleta cocida
  R: 'rgb(140,70,45)',   // bistec cocido
  T: 'rgb(228,185,130)', // pollo dorado
  O: 'rgb(245,240,225)', // hueso
  p: 'rgb(245,170,180)', // cerdo crudo
  r: 'rgb(205,60,60)',   // res cruda
  c: 'rgb(240,215,185)', // pollo crudo
  K: 'rgb(45,45,50)',    // carbón
  I: 'rgb(222,224,230)', // hierro
  D: 'rgb(110,230,225)', // diamante
  A: 'rgb(220,50,50)',   // manzana
  L: 'rgb(70,160,60)',   // hoja verde
};

const ICON_ART = {
  12: [ // pico
    '.GGGGG..',
    'G.....G.',
    'G..B..G.',
    '...B....',
    '..B.....',
    '..B.....',
    '.B......',
    '.B......',
  ],
  13: [ // espada
    '......WW',
    '.....WW.',
    '....WW..',
    '...WW...',
    'B..W....',
    '.BW.....',
    '.BB.....',
    'B..B....',
  ],
  14: [ // ballesta
    'W......W',
    '.W....W.',
    '..WWWW..',
    '...BB...',
    '...BB...',
    '...BB...',
    '...BB...',
    '....B...',
  ],
  15: [ // palo
    '......B.',
    '.....B..',
    '....B...',
    '...B....',
    '..B.....',
    '.B......',
    'B.......',
    '........',
  ],
  16: [ // chuleta
    '........',
    '..PPP...',
    '.PPPPP..',
    '.PPPPPO.',
    '..PPP.O.',
    '....O.O.',
    '...O.O..',
    '........',
  ],
  17: [ // bistec
    '........',
    '..RRR...',
    '.RRRRR..',
    '.RRRRRR.',
    '..RRRR..',
    '...RR...',
    '........',
    '........',
  ],
  18: [ // pollo asado
    '........',
    '..TTT...',
    '.TTTTT..',
    '.TTTTTO.',
    '..TTT.O.',
    '....O.OO',
    '...O.O..',
    '........',
  ],
  19: [ // carne de cerdo cruda
    '........',
    '..ppp...',
    '.ppppp..',
    '.pppppO.',
    '..ppp.O.',
    '....O.O.',
    '...O.O..',
    '........',
  ],
  20: [ // carne de res cruda
    '........',
    '..rrr...',
    '.rrrrr..',
    '.rrrrrr.',
    '..rrrr..',
    '...rr...',
    '........',
    '........',
  ],
  21: [ // pollo crudo
    '........',
    '..ccc...',
    '.ccccc..',
    '.cccccO.',
    '..ccc.O.',
    '....O.OO',
    '...O.O..',
    '........',
  ],
  22: [ // flecha
    '......WW',
    '.....WWW',
    '....BW..',
    '...B....',
    '..B.....',
    '.B......',
    'OB......',
    'O.......',
  ],
  41: [ // carbón
    '........',
    '..KKK...',
    '.KKKKK..',
    '.KKKKKK.',
    '.KKKKKK.',
    '..KKKK..',
    '...KK...',
    '........',
  ],
  42: [ // lingote de hierro
    '........',
    '........',
    '...IIII.',
    '..IIIIII',
    '.IIWIII.',
    'IIIIII..',
    '........',
    '........',
  ],
  43: [ // diamante
    '........',
    '..DDDD..',
    '.DWDDDD.',
    '.DDDDDD.',
    '..DDDD..',
    '...DD...',
    '........',
    '........',
  ],
  47: [ // manzana
    '....B...',
    '...BL...',
    '..AAAA..',
    '.AAAAAA.',
    '.AWAAAA.',
    '.AAAAAA.',
    '..AAAA..',
    '........',
  ],
  48: [ // hueso
    'OO......',
    'OOO.....',
    '.OOO....',
    '..OOO...',
    '...OOO..',
    '....OOOO',
    '.....OOO',
    '......OO',
  ],
};

// Iconos que reusan el arte de otro cambiando colores (picos y espada mejores).
const ICON_RECOLOR = {
  44: { from: 12, map: { G: 'rgb(128,128,132)' } }, // pico de piedra
  45: { from: 12, map: { G: 'rgb(224,226,232)' } }, // pico de hierro
  46: { from: 13, map: { W: 'rgb(150,200,240)' } }, // espada de hierro
};

function paintIcon(ctx, tileIdx, rows, overrides = {}) {
  const x0 = (tileIdx % ATLAS.COLS) * ATLAS.TILE;
  const y0 = Math.floor(tileIdx / ATLAS.COLS) * ATLAS.TILE;
  ctx.clearRect(x0, y0, ATLAS.TILE, ATLAS.TILE);
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch === '.') return;
      ctx.fillStyle = overrides[ch] || ICON_PALETTE[ch];
      ctx.fillRect(x0 + rx * 2, y0 + ry * 2, 2, 2);
    });
  });
}

function paintIconTiles(ctx) {
  for (const [idx, rows] of Object.entries(ICON_ART)) {
    paintIcon(ctx, Number(idx), rows);
  }
  for (const [idx, spec] of Object.entries(ICON_RECOLOR)) {
    paintIcon(ctx, Number(idx), ICON_ART[spec.from], spec.map);
  }
}

// Devuelve { texture, canvas } con todas las texturas dibujadas.
function createAtlas() {
  const size = ATLAS.TILE * ATLAS.COLS;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0f';
  ctx.fillRect(0, 0, size, size);

  for (const [idx, painter] of Object.entries(TILE_PAINTERS)) {
    const i = Number(idx);
    const x0 = (i % ATLAS.COLS) * ATLAS.TILE;
    const y0 = Math.floor(i / ATLAS.COLS) * ATLAS.TILE;
    painter(ctx, x0, y0, mulberry32(CFG.SEED + i));
  }
  paintIconTiles(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return { texture, canvas };
}
