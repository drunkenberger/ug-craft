// Mundo de voxels: datos por chunk, mallas y ediciones persistibles.
// La generación del terreno la aporta cada mapa (parámetro `generator`).
const FACES = [
  { dir: [-1, 0, 0], corners: [ { pos: [0,1,0], uv: [0,1] }, { pos: [0,0,0], uv: [0,0] }, { pos: [0,1,1], uv: [1,1] }, { pos: [0,0,1], uv: [1,0] } ] },
  { dir: [ 1, 0, 0], corners: [ { pos: [1,1,1], uv: [0,1] }, { pos: [1,0,1], uv: [0,0] }, { pos: [1,1,0], uv: [1,1] }, { pos: [1,0,0], uv: [1,0] } ] },
  { dir: [ 0,-1, 0], corners: [ { pos: [1,0,1], uv: [1,0] }, { pos: [0,0,1], uv: [0,0] }, { pos: [1,0,0], uv: [1,1] }, { pos: [0,0,0], uv: [0,1] } ] },
  { dir: [ 0, 1, 0], corners: [ { pos: [0,1,1], uv: [1,1] }, { pos: [1,1,1], uv: [0,1] }, { pos: [0,1,0], uv: [1,0] }, { pos: [1,1,0], uv: [0,0] } ] },
  { dir: [ 0, 0,-1], corners: [ { pos: [1,0,0], uv: [0,0] }, { pos: [0,0,0], uv: [1,0] }, { pos: [1,1,0], uv: [0,1] }, { pos: [0,1,0], uv: [1,1] } ] },
  { dir: [ 0, 0, 1], corners: [ { pos: [0,0,1], uv: [0,0] }, { pos: [1,0,1], uv: [1,0] }, { pos: [0,1,1], uv: [0,1] }, { pos: [1,1,1], uv: [1,1] } ] },
];

// ¿El bloque tapa por completo la cara vecina? (agua y plantas no)
function blockOpaque(id) {
  if (!id) return false;
  const def = BLOCKS[id];
  return !(def && def.solid === false);
}

class World {
  // materials: material único (compatibilidad) o { opaque, cross, water }.
  constructor(scene, materials, generator, edits) {
    this.scene = scene;
    this.materials = materials.opaque
      ? materials
      : { opaque: materials, cross: materials, water: materials };
    this.generator = generator;       // (world, cx, cz, data) => void
    this.edits = edits || {};         // "x,y,z" -> id (bloques cambiados por el jugador)
    this.dirty = false;               // hay cambios sin guardar
    this.chunks = new Map();
    this.meshes = new Map();          // sólidos (raycast y colisión visual)
    this.crossMeshes = new Map();     // plantas/antorchas (raycast, sin colisión)
    this.waterMeshes = new Map();     // agua (solo visual)
    this.noise = new Noise2D(CFG.SEED);
    this.buildQueue = [];
  }

  key(cx, cz) { return `${cx},${cz}`; }

  blockIndex(x, y, z) { return (y * CFG.CHUNK + z) * CFG.CHUNK + x; }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CFG.CHUNK * CFG.CHUNK * CFG.HEIGHT);
    this.generator(this, cx, cz, data);
    // Aplicar ediciones guardadas que caen dentro de este chunk.
    const x0 = cx * CFG.CHUNK, z0 = cz * CFG.CHUNK;
    for (const [k, id] of Object.entries(this.edits)) {
      const [x, y, z] = k.split(',').map(Number);
      if (x >= x0 && x < x0 + CFG.CHUNK && z >= z0 && z < z0 + CFG.CHUNK && y >= 0 && y < CFG.HEIGHT) {
        data[this.blockIndex(x - x0, y, z - z0)] = id;
      }
    }
    this.chunks.set(this.key(cx, cz), data);
    return data;
  }

  ensureChunkData(cx, cz) {
    return this.chunks.get(this.key(cx, cz)) || this.generateChunk(cx, cz);
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CFG.HEIGHT) return 0;
    const cx = Math.floor(wx / CFG.CHUNK);
    const cz = Math.floor(wz / CFG.CHUNK);
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return 0;
    return data[this.blockIndex(wx - cx * CFG.CHUNK, wy, wz - cz * CFG.CHUNK)];
  }

  isSolid(wx, wy, wz) { return blockOpaque(this.getBlock(wx, wy, wz)); }

  // Objetivos para el rayo de romper/poner (sólidos + plantas, sin agua).
  raycastTargets() {
    return [...this.meshes.values(), ...this.crossMeshes.values()];
  }

  setBlock(wx, wy, wz, id, recordEdit = true) {
    if (wy <= 0 || wy >= CFG.HEIGHT) return;
    const cx = Math.floor(wx / CFG.CHUNK);
    const cz = Math.floor(wz / CFG.CHUNK);
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return;
    const x = wx - cx * CFG.CHUNK;
    const z = wz - cz * CFG.CHUNK;
    data[this.blockIndex(x, wy, z)] = id;
    if (recordEdit) {
      this.edits[`${wx},${wy},${wz}`] = id;
      this.dirty = true;
    }
    this.buildMesh(cx, cz);
    if (x === 0) this.buildMesh(cx - 1, cz);
    if (x === CFG.CHUNK - 1) this.buildMesh(cx + 1, cz);
    if (z === 0) this.buildMesh(cx, cz - 1);
    if (z === CFG.CHUNK - 1) this.buildMesh(cx, cz + 1);
  }

  findSurface(wx, wz) {
    this.ensureChunkData(Math.floor(wx / CFG.CHUNK), Math.floor(wz / CFG.CHUNK));
    for (let y = CFG.HEIGHT - 1; y >= 0; y--) {
      if (this.isSolid(wx, y, wz)) return y + 1;
    }
    return 30;
  }

  buildMesh(cx, cz) {
    const k = this.key(cx, cz);
    if (!this.chunks.has(k)) return;
    const x0 = cx * CFG.CHUNK, z0 = cz * CFG.CHUNK;
    const bufs = {
      opaque: { positions: [], normals: [], uvs: [], indices: [] },
      cross: { positions: [], normals: [], uvs: [], indices: [] },
      water: { positions: [], normals: [], uvs: [], indices: [] },
    };

    const tileUV = (buf, tile, uv) => {
      const tu = tile % ATLAS.COLS;
      const tv = Math.floor(tile / ATLAS.COLS);
      buf.uvs.push((tu + uv[0]) / ATLAS.COLS, 1 - (tv + 1 - uv[1]) / ATLAS.COLS);
    };

    for (let y = 0; y < CFG.HEIGHT; y++) {
      for (let z = 0; z < CFG.CHUNK; z++) {
        for (let x = 0; x < CFG.CHUNK; x++) {
          const id = this.getBlock(x0 + x, y, z0 + z);
          if (!id) continue;
          const def = BLOCKS[id];

          if (def.cross) {
            // Dos planos cruzados en diagonal (flores, antorchas...).
            const buf = bufs.cross;
            const quads = [
              [[0.15, 0.15], [0.85, 0.85]],
              [[0.85, 0.15], [0.15, 0.85]],
            ];
            for (const [[ax, az], [bx, bz]] of quads) {
              const base = buf.positions.length / 3;
              buf.positions.push(
                x + ax, y, z + az,   x + bx, y, z + bz,
                x + ax, y + 1, z + az,   x + bx, y + 1, z + bz
              );
              for (let i = 0; i < 4; i++) buf.normals.push(0, 1, 0);
              tileUV(buf, def.side, [0, 0]); tileUV(buf, def.side, [1, 0]);
              tileUV(buf, def.side, [0, 1]); tileUV(buf, def.side, [1, 1]);
              buf.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            }
            continue;
          }

          const isWater = !!def.liquid;
          const buf = isWater ? bufs.water : bufs.opaque;
          for (const face of FACES) {
            const [dx, dy, dz] = face.dir;
            const nId = this.getBlock(x0 + x + dx, y + dy, z0 + z + dz);
            // Agua: solo caras contra aire/plantas. Sólido: contra no-opacos.
            if (isWater ? (nId === id || blockOpaque(nId)) : blockOpaque(nId)) continue;
            const tile = dy === 1 ? def.top : dy === -1 ? def.bottom : def.side;
            const base = buf.positions.length / 3;
            for (const { pos, uv } of face.corners) {
              buf.positions.push(x + pos[0], y + pos[1], z + pos[2]);
              buf.normals.push(dx, dy, dz);
              tileUV(buf, tile, uv);
            }
            buf.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }

    const groups = [
      [this.meshes, bufs.opaque, this.materials.opaque],
      [this.crossMeshes, bufs.cross, this.materials.cross],
      [this.waterMeshes, bufs.water, this.materials.water],
    ];
    for (const [map, buf, material] of groups) {
      const old = map.get(k);
      if (old) {
        this.scene.remove(old);
        old.geometry.dispose();
        map.delete(k);
      }
      if (!buf.indices.length && map !== this.meshes) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
      geo.setIndex(buf.indices);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x0, 0, z0);
      mesh.userData.isChunk = true;
      this.scene.add(mesh);
      map.set(k, mesh);
    }
  }

  update(px, pz) {
    const pcx = Math.floor(px / CFG.CHUNK);
    const pcz = Math.floor(pz / CFG.CHUNK);
    const R = CFG.RENDER_DIST;

    for (let cx = pcx - R - 1; cx <= pcx + R + 1; cx++) {
      for (let cz = pcz - R - 1; cz <= pcz + R + 1; cz++) {
        this.ensureChunkData(cx, cz);
      }
    }
    for (let cx = pcx - R; cx <= pcx + R; cx++) {
      for (let cz = pcz - R; cz <= pcz + R; cz++) {
        const k = this.key(cx, cz);
        if (!this.meshes.has(k) && !this.buildQueue.includes(k)) {
          this.buildQueue.push(k);
        }
      }
    }
    let built = 0;
    while (this.buildQueue.length && built < 2) {
      const [cx, cz] = this.buildQueue.shift().split(',').map(Number);
      if (Math.abs(cx - pcx) > R || Math.abs(cz - pcz) > R) continue;
      this.buildMesh(cx, cz);
      built++;
    }
    for (const map of [this.meshes, this.crossMeshes, this.waterMeshes]) {
      for (const [k, mesh] of map) {
        const [cx, cz] = k.split(',').map(Number);
        if (Math.abs(cx - pcx) > R + 1 || Math.abs(cz - pcz) > R + 1) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          map.delete(k);
        }
      }
    }
  }

  dispose() {
    for (const map of [this.meshes, this.crossMeshes, this.waterMeshes]) {
      for (const mesh of map.values()) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
      map.clear();
    }
    this.chunks.clear();
    this.buildQueue.length = 0;
  }
}
