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

  let limit = null; // constraint más restrictivo en este eje
  for (let x = Math.floor(minX); x < maxX; x++) {
    for (let y = Math.floor(minY); y < maxY; y++) {
      for (let z = Math.floor(minZ); z < maxZ; z++) {
        if (!world.isSolid(x, y, z)) continue;
        const b = { x, y, z }[axis];
        if (body.vel[axis] < 0) limit = limit === null ? b + 1 : Math.max(limit, b + 1);
        else if (body.vel[axis] > 0) limit = limit === null ? b : Math.min(limit, b);
      }
    }
  }
  if (limit === null) return;

  // Auto-escalón: si choca de lado estando en el suelo y el desnivel es de
  // 1 bloque con espacio libre arriba, sube solo sin necesidad de saltar.
  if (axis !== 'y' && body.onGround) {
    const oldY = body.pos.y;
    body.pos.y = Math.floor(body.pos.y) + 1 + PHYS_EPS;
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
        if (world.isSolid(x, y, z)) return true;
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
