// Física compartida por jugador y mobs: AABB contra la rejilla de bloques.
// body: { pos (pies, centro), vel, halfW, height, onGround, hitWall }
const PHYS_EPS = 0.001;

function moveBody(world, body, dt) {
  body.onGround = false;
  body.hitWall = false;
  for (const axis of ['y', 'x', 'z']) {
    body.pos[axis] += body.vel[axis] * dt;
    resolveAxis(world, body, axis);
  }
}

function resolveAxis(world, body, axis) {
  const minX = body.pos.x - body.halfW;
  const maxX = body.pos.x + body.halfW;
  const minY = body.pos.y;
  const maxY = body.pos.y + body.height;
  const minZ = body.pos.z - body.halfW;
  const maxZ = body.pos.z + body.halfW;

  let stepTop = minY;
  let limit = null; // constraint más restrictivo en este eje
  for (let x = Math.floor(minX); x < maxX; x++) {
    for (let y = Math.floor(minY); y < maxY; y++) {
      for (let z = Math.floor(minZ); z < maxZ; z++) {
        if (!world.isSolid(x, y, z)) continue;
        for (const box of blockBoxes(world.getBlock(x,y,z))) {
          const lo=[x+box[0],y+box[1],z+box[2]], hi=[x+box[3],y+box[4],z+box[5]];
          if (!(maxX>lo[0] && minX<hi[0] && maxY>lo[1] && minY<hi[1] && maxZ>lo[2] && minZ<hi[2])) continue;
          const i={x:0,y:1,z:2}[axis]; stepTop=Math.max(stepTop,hi[1]);
          if (body.vel[axis]<0) limit=limit===null ? hi[i] : Math.max(limit,hi[i]);
          else if (body.vel[axis]>0) limit=limit===null ? lo[i] : Math.min(limit,lo[i]);
        }
      }
    }
  }
  if (limit === null) return;

  // Auto-escalón: si choca de lado estando en el suelo y el desnivel es de
  // 1 bloque con espacio libre arriba, sube solo sin necesidad de saltar.
  if (axis !== 'y' && body.onGround && stepTop-body.pos.y <= 1.01) {
    const oldY = body.pos.y;
    body.pos.y = stepTop + PHYS_EPS;
    if (!bodyCollides(world, body)) return; // subió el escalón
    body.pos.y = oldY;
  }

  if (body.vel[axis] < 0) {
    body.pos[axis] = limit + (axis === 'y' ? 0 : body.halfW) + PHYS_EPS;
    if (axis === 'y') body.onGround = true;
    else body.hitWall = true;
  } else if (body.vel[axis] > 0) {
    const extent = axis === 'y' ? body.height : body.halfW;
    body.pos[axis] = limit - extent - PHYS_EPS;
    if (axis !== 'y') body.hitWall = true;
  }
  body.vel[axis] = 0;
}

// ¿El AABB del cuerpo choca con algún bloque sólido en su posición actual?
function bodyCollides(world, body) {
  const minX = body.pos.x - body.halfW;
  const maxX = body.pos.x + body.halfW;
  const minY = body.pos.y;
  const maxY = body.pos.y + body.height;
  const minZ = body.pos.z - body.halfW;
  const maxZ = body.pos.z + body.halfW;
  for (let x = Math.floor(minX); x < maxX; x++) {
    for (let y = Math.floor(minY); y < maxY; y++) {
      for (let z = Math.floor(minZ); z < maxZ; z++) {
        if (!world.isSolid(x,y,z)) continue;
        for (const b of blockBoxes(world.getBlock(x,y,z))) {
          if (maxX>x+b[0] && minX<x+b[3] && maxY>y+b[1] && minY<y+b[4] && maxZ>z+b[2] && minZ<z+b[5]) return true;
        }
      }
    }
  }
  return false;
}

// AABB del cuerpo intersecta con el bloque (x,y,z)?
function bodyIntersectsBlock(body, x, y, z) {
  return (
    body.pos.x + body.halfW > x && body.pos.x - body.halfW < x + 1 &&
    body.pos.y + body.height > y && body.pos.y < y + 1 &&
    body.pos.z + body.halfW > z && body.pos.z - body.halfW < z + 1
  );
}
