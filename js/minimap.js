// Minimapa tipo radar (esquina superior izquierda, mapas con minimap:true):
// terreno visto desde arriba que gira con la cámara, tú siempre al centro
// y los demás jugadores como puntos de color (pegados al borde si están lejos).
const MINIMAP = {
  SIZE: 148,    // lado del canvas en px
  RANGE: 36,    // radio visible en bloques
  REDRAW: 0.35, // segundos entre redibujados del terreno
};

// Color aproximado de cada bloque visto desde arriba.
const MINIMAP_COLORS = {
  1: '#5faa46', 2: '#7a5230', 3: '#8a8a8a', 4: '#e6d8a2', 5: '#6b4a2a',
  6: '#3d7a33', 7: '#b08a50', 8: '#f5c542', 9: '#a3763f', 10: '#6f6f6f',
  11: '#9a7030', 12: '#e05a8a', 13: '#c0a060', 14: '#5a5a5a', 15: '#c4a486',
  16: '#7fd8d8', 17: '#3d6fd0', 18: '#eef4fb', 19: '#ffb84d', 20: '#d8e060',
  21: '#79b356', 22: '#8fce70', 23: '#c04040',
};

class Minimap {
  constructor(game) {
    this.game = game;
    this.timer = MINIMAP.REDRAW; // dibujar ya en el primer frame
    const blocks = MINIMAP.RANGE * 2 + 1;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap';
    this.canvas.width = MINIMAP.SIZE;
    this.canvas.height = MINIMAP.SIZE;
    document.getElementById('hud').appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Terreno con norte arriba (1 px por bloque); se rota al dibujar.
    this.terrain = document.createElement('canvas');
    this.terrain.width = blocks;
    this.terrain.height = blocks;
    this.tctx = this.terrain.getContext('2d');
    this.image = this.tctx.createImageData(blocks, blocks);
  }

  // Color de la columna (wx, wz): primer bloque desde arriba, sombreado por altura.
  columnColor(wx, wz) {
    const w = this.game.world;
    for (let y = CFG.HEIGHT - 1; y >= 0; y--) {
      const id = w.getBlock(wx, y, wz);
      if (!id) continue;
      const hex = MINIMAP_COLORS[id] || '#666666';
      const shade = 0.55 + 0.5 * (y / 44); // más alto = más claro
      return [
        Math.min(255, parseInt(hex.slice(1, 3), 16) * shade),
        Math.min(255, parseInt(hex.slice(3, 5), 16) * shade),
        Math.min(255, parseInt(hex.slice(5, 7), 16) * shade),
      ];
    }
    return null; // chunk sin cargar
  }

  redrawTerrain() {
    const p = this.game.player.pos;
    const cx = Math.floor(p.x), cz = Math.floor(p.z);
    const R = MINIMAP.RANGE, blocks = R * 2 + 1;
    const d = this.image.data;
    for (let gz = 0; gz < blocks; gz++) {
      for (let gx = 0; gx < blocks; gx++) {
        const rgb = this.columnColor(cx + gx - R, cz + gz - R);
        const i = (gz * blocks + gx) * 4;
        if (rgb) {
          d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
        } else {
          d[i] = 10; d[i + 1] = 14; d[i + 2] = 10; d[i + 3] = 255;
        }
      }
    }
    this.tctx.putImageData(this.image, 0, 0);
  }

  // Punto de otro jugador; si queda fuera del radar, se pega al borde.
  drawBlip(dx, dz, yaw, half, color) {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    let x = dx * cos - dz * sin; // mundo → pantalla (la cámara mira "arriba")
    let y = dx * sin + dz * cos;
    const scale = half / MINIMAP.RANGE;
    x *= scale; y *= scale;
    const dist = Math.hypot(x, y), max = half - 7;
    if (dist > max) { x = (x / dist) * max; y = (y / dist) * max; }
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(half + x, half + y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= MINIMAP.REDRAW) {
      this.timer = 0;
      this.redrawTerrain();
    }

    const g = this.game, ctx = this.ctx;
    const S = MINIMAP.SIZE, half = S / 2;
    const yaw = g.controls.yaw;
    ctx.clearRect(0, 0, S, S);

    // Terreno rotado para que "arriba" sea hacia donde miras, recortado en círculo.
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0a0e0a';
    ctx.fillRect(0, 0, S, S);
    ctx.translate(half, half);
    ctx.rotate(yaw);
    const px = this.game.player.pos;
    const scale = S / (MINIMAP.RANGE * 2 + 1);
    ctx.scale(scale, scale);
    // Corrección sub-bloque para que el mapa no "salte" al caminar.
    ctx.translate(-(MINIMAP.RANGE + 0.5) - (px.x - Math.floor(px.x) - 0.5),
                  -(MINIMAP.RANGE + 0.5) - (px.z - Math.floor(px.z) - 0.5));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, 0, 0);
    ctx.restore();

    // Otros jugadores (color de su avatar) sobre el terreno.
    for (const [id, av] of g.avatars) {
      const c = '#' + AVATAR_COLORS[id % AVATAR_COLORS.length].toString(16).padStart(6, '0');
      this.drawBlip(av.pos.x - px.x, av.pos.z - px.z, yaw, half, c);
    }

    // Tú: flecha blanca al centro apuntando hacia arriba.
    ctx.save();
    ctx.translate(half, half);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.restore();

    // Aro y marca del norte (gira con la cámara).
    ctx.beginPath();
    ctx.arc(half, half, half - 3, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
    // El norte del mundo es -z: en pantalla queda en (sin yaw, -cos yaw).
    ctx.fillStyle = '#ff5555';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N',
      half + Math.sin(yaw) * (half - 12),
      half - Math.cos(yaw) * (half - 12));
  }

  dispose() {
    this.canvas.remove();
  }
}
