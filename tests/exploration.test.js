const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');
const context = { THREE, console };
vm.createContext(context);
for (const f of ['config','noise','textures','world','expedition-world','maps','physics','creature','mobs','survival','inventory','items','i18n']) {
  vm.runInContext(fs.readFileSync(`js/${f}.js`, 'utf8'), context);
}
vm.runInContext(`
function check(condition,message) { if (!condition) throw new Error(message); }
const scene = new THREE.Scene(), material = new THREE.MeshLambertMaterial({vertexColors:true});
const world = new World(scene,material,generateTerrain,{});
// Generar desde direcciones opuestas debe producir exactamente la misma aldea.
const reverse = new World(new THREE.Scene(),material,generateTerrain,{});
const coords = [[1,1],[1,2],[2,1],[2,2],[3,2],[2,3],[-10,-10]];
for (const [x,z] of coords) world.ensureChunkData(x,z);
for (const [x,z] of coords.slice().reverse()) reverse.ensureChunkData(x,z);
for (const [x,z] of coords) {
 const a=world.chunks.get(world.key(x,z)), b=reverse.chunks.get(reverse.key(x,z));
 check(a.every((id,i)=>id===b[i]),'village depends on chunk order');
}
const floor=Math.max(CFG.SEA_LEVEL+2,survivalHeightAt(world,40,40));
check(world.getBlock(33,floor+1,36)===0,'house doorway blocked');
check(world.getBlock(31,floor+1,31)===23,'missing village bed');
world.buildMesh(2,2);
const geo=world.meshes.get('2,2').geometry;
check(geo.attributes.color.count===geo.attributes.position.count,'invalid vertex colors');
check([...geo.attributes.color.array].every(v=>Number.isFinite(v) && v>=0 && v<=1),'invalid shading');
// Mechas, bordes de chunk, protección de cofres/obsidiana y persistencia.
const flat = new World(new THREE.Scene(),material,generateFlat,{});
for (let x=0;x<=1;x++) flat.ensureChunkData(x,0);
const game={world:flat,net:false,ui:{toast(){}},hittableCreatures:()=>[]};
scanWorldExtras(game);
flat.setBlock(15,4,8,33); flat.setBlock(16,4,8,33);
flat.setBlock(14,4,8,34); flat.setBlock(15,4,9,11);
lightTnt(game,{x:15,y:4,z:8});
updateTnt(game,3.9); check(flat.getBlock(15,4,8)===40,'fuse too short');
updateTnt(game,.2); check(flat.getBlock(15,4,8)===0,'TNT failed');
check(flat.getBlock(16,4,8)===40,'chain failed across chunk boundary');
check(flat.getBlock(14,4,8)===34 && flat.getBlock(15,4,9)===11,'protected blocks destroyed');
updateTnt(game,.7); check(flat.getBlock(16,4,8)===0,'chain did not explode');
check(flat.getBlock(15,0,8)===3,'bedrock destroyed');
flat.setBlock(8,4,8,40); scanWorldExtras(game);
check(game.tntFuses.has('8,4,8'),'saved fuse lost');
game.net=true; globalThis.NET={isHost:false};
updateTnt(game,5); check(flat.getBlock(8,4,8)===40,'guest simulated explosion');
game.net=false; updateTnt(game,5); check(flat.getBlock(8,4,8)===0,'restored fuse failed');
// Modelo y comportamiento neutral: no se quema de día ni ataca.
const piglin=new Piglin(scene,8,4,8);
let damage=0;
for(let i=0;i<20;i++) piglin.update(.05,flat,[{pos:new THREE.Vector3(9,4,8),damage(){damage++;}}],false);
check(piglin.health===3 && damage===0,'piglin not neutral');
piglin.die();
for(let id=33;id<=39;id++) {
 check(MAPS.creative.hotbar.includes(id),'missing creative material');
 check(RECIPES.some(r=>r.out.id===id),'missing survival recipe');
 check(I18N.es['block_'+BLOCKS[id].key] && I18N.en['block_'+BLOCKS[id].key],'missing translation');
 check(TILE_PAINTERS[BLOCKS[id].side],'missing texture');
}
world.dispose(); reverse.dispose(); flat.dispose(); material.dispose();
`, context);
console.log('Exploration behavior tests passed');
