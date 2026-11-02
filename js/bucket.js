// Cubo: recoge una fuente de agua y la suelta donde apuntas (para regar cultivos lejos de lagos).
const BUCKET_EMPTY = 141, BUCKET_WATER = 142, WATER_BLOCK = 17, BUCKET_REACH = 6;

// Bloque de agua al que apunta el jugador (si no hay un sólido delante).
function targetWater(g) {
  const ray = g.aimRay();
  const hit = ray.intersectObjects([...g.world.waterMeshes.values()])[0];
  if (!hit || hit.distance > BUCKET_REACH) return null;
  const solid = ray.intersectObjects(g.world.raycastTargets())[0];
  if (solid && solid.distance < hit.distance) return null;
  const n = hit.face.normal, p = hit.point;
  const pos = { x: Math.floor(p.x - n.x * 0.01), y: Math.floor(p.y - n.y * 0.01), z: Math.floor(p.z - n.z * 0.01) };
  return g.world.getBlock(pos.x, pos.y, pos.z) === WATER_BLOCK ? pos : null;
}

// Cambia un cubo por otro conservando su lugar en la barra.
function swapBucket(inv, from, to) {
  if (inv.isFree()) return;
  const e = inv.entries.find((x) => x.id === from);
  if (e && e.count === 1 && !inv.entries.some((x) => x.id === to)) {
    e.id = to;
    if (inv.onChange) inv.onChange();
  } else if (inv.remove(from, 1)) inv.add(to, 1);
}

// Clic derecho con un cubo en la mano. `target` = bloque sólido apuntado (o null).
function useBucket(g, target) {
  if (g.selectedId() === BUCKET_EMPTY) {
    const water = targetWater(g);
    if (!water) { g.ui.toast(t('bucketNoWater')); return true; }
    changeAdventureBlock(g, water.x, water.y, water.z, 0);
    swapBucket(g.inventory, BUCKET_EMPTY, BUCKET_WATER);
    g.adventure.fx.tone('place');
    g.ui.toast(t('bucketFilled'));
    return true;
  }
  if (!target) return true;
  const { x, y, z } = target.outside;
  if (g.world.getBlock(x, y, z) !== 0) { g.ui.toast(t('bucketNoSpace')); return true; }
  changeAdventureBlock(g, x, y, z, WATER_BLOCK);
  swapBucket(g.inventory, BUCKET_WATER, BUCKET_EMPTY);
  g.adventure.fx.tone('place');
  return true;
}
