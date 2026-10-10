const fs=require('node:fs');
const vm=require('node:vm');
const context={THREE:require('../lib/three.min.js'),console};vm.createContext(context);
for(const file of ['config','noise','textures','world','expedition-world','maps','physics','creature','mobs','golem','animals','survival','inventory','items','i18n','adventure-effects','expedition','adventure'])
  vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),context);
vm.runInContext(`
function check(c,m){if(!c)throw Error(m);}
const scene=new THREE.Scene(),mat=new THREE.MeshLambertMaterial();
const w=new World(scene,mat,generateFlat,{});for(let x=-1;x<=2;x++)for(let z=-1;z<=2;z++)w.ensureChunkData(x,z);
const player={pos:new THREE.Vector3(20,4.1,20),vel:new THREE.Vector3(),halfW:.3,height:1.8,wouldCollide(x,y,z){return bodyIntersectsBlock(this,x,y,z);}};
const g={world:w,scene,player,net:false,map:{canBuild:true},avatars:new Map(),worldRules:normalizeWorldRules(),ui:{toast(){}},inventory:new Inventory('counted'),save(){},selectedId(){return this.selected;}};
g.animals=new AnimalManager(scene,w,()=>[{id:'local',pos:player.pos}],()=>{});
let npcs=[];g.hittableCreatures=()=>[...g.animals.animals,...npcs];scanWorldExtras(g);
g.adventure=new Adventure(g);g.adventure.soundEnabled=false;
// Crops cannot mature without water, or through a roof; harvesting gives resources once.
w.setBlock(8,3,8,41);w.setBlock(8,4,8,42);
g.adventure.update(60);check(w.getBlock(8,4,8)===42,'dry crop grew');
w.setBlock(9,3,8,17);w.setBlock(8,7,8,3);g.adventure.update(60);check(w.getBlock(8,4,8)===42,'covered crop grew');
w.setBlock(8,7,8,0);g.adventure.update(44);check(w.getBlock(8,4,8)===42,'crop grew early');
g.adventure.update(1);check(w.getBlock(8,4,8)===43,'watered crop did not grow');
const crop={inside:{x:8,y:4,z:8},outside:{x:8,y:5,z:8}};
adventureRightClick(g,null,crop);check(g.inventory.count(121)===2 && g.inventory.count(119)===2,'wrong harvest');
adventureRightClick(g,null,crop);check(g.inventory.count(121)===2,'duplicate harvest');
// Mission delivery requires villager proximity, spends resources, and never repeats rewards.
g.inventory.add(5,8);check(!g.adventure.completeQuest(),'remote quest allowed');
npcs=[new Villager(scene,20,4,21)];check(g.adventure.completeQuest(),'quest failed');
check(g.inventory.count(5)===0 && g.adventure.data.done.includes('wood'),'quest not committed');
check(!g.adventure.completeQuest(),'duplicate quest reward');
const progress=g.adventure.serialize();g.adventure.restore(progress);check(g.adventure.currentQuest().key==='farm','quest reload failed');
// Half blocks have matching physics, open doors allow passage.
w.setBlock(4,4,4,48);
const body={pos:new THREE.Vector3(4.5,4.6,4.5),halfW:.2,height:1,vel:new THREE.Vector3(0,-2,0),onGround:false};
check(!bodyCollides(w,body),'slab collides in empty upper half');moveBody(w,body,.1);
check(body.onGround && Math.abs(body.pos.y-4.501)<.01,'slab landing incorrect');
w.setBlock(5,4,5,49);body.pos.set(5.5,4.6,5.2);check(!bodyCollides(w,body),'lower stair collision wrong');
body.pos.z=5.8;check(bodyCollides(w,body),'upper stair has no collision');
w.setBlock(7,4,7,46);w.setBlock(7,5,7,46);
adventureRightClick(g,null,{inside:{x:7,y:4,z:7}});check(w.getBlock(7,5,7)===47,'upper door not opened');
body.pos.set(7.5,4.1,7.1);check(!bodyCollides(w,body),'open door blocks player');
player.pos.set(7.5,4,7.1);adventureRightClick(g,null,{inside:{x:7,y:4,z:7}});check(w.getBlock(7,4,7)===47,'closed door through player');
player.pos.set(20,4.1,20);adventureRightClick(g,null,{inside:{x:7,y:4,z:7}});check(w.getBlock(7,4,7)===46,'door did not close');
// Blueprint checks whole site before consuming anything.
g.inventory.add(125,1);w.setBlock(26,4,26,3);
check(!g.adventure.buildHouse({x:26,y:4,z:26}) && g.inventory.count(125)===1,'blocked blueprint consumed');
w.setBlock(26,4,26,0);check(g.adventure.buildHouse({x:26,y:4,z:26}),'clear blueprint failed');
check(g.inventory.count(125)===0 && w.getBlock(26,5,28)===46,'blueprint house incomplete');
// Adoption consumes exactly one bone and cannot charge twice or from far away.
const wild=new Animal(scene,'dog',20,4,20);g.animals.animals.push(wild);
g.tameDog=c=>c.setTamed('local');g.inventory.add(118,2);
check(g.adventure.adopt(wild)&&wild.tamed&&g.inventory.count(118)===1,'dog rejected bone');
check(!g.adventure.adopt(wild)&&g.inventory.count(118)===1,'second adoption consumed bone');
const far=new Animal(scene,'dog',100,4,100);check(!g.adventure.adopt(far)&&g.inventory.count(118)===1,'distant adoption consumed bone');far.die();
g.animals.clear();
// Pets restore old dog saves and new named species without duplication.
restorePets(g,[[20,4,20],[21,4,20,'cat','Luna']]);restorePets(g,[[20,4,20]]);
check(g.animals.animals.length===2,'duplicate pets');
const cat=g.animals.animals[1];g.adventure.renamePet(cat,'Michi');
const pets=serializePets(g);check(pets[1][3]==='cat' && pets[1][4]==='Michi','pet name not serialized');
g.adventure.petAction({action:'rename',mob:cat.netId,name:'wrong'},'stranger');check(cat.petName==='Michi','another owner renamed pet');
// Portal is reversible and leaves health/inventory untouched.
player.pos.set(20,4.1,20);player.health=6;const before=g.inventory.count(119);
g.adventure.book={show(){this.shown=true;},dispose(){}};
g.adventure.portal();check(g.adventure.book.page==='worlds'&&g.adventure.book.shown&&player.pos.x===20,'portal did not open menu without teleporting');
g.adventure.travelWorld('glowingForest');check(isAdventureZone(player.pos.x,player.pos.z),'chosen destination did not travel');
g.adventure.portal();check(isAdventureZone(player.pos.x,player.pos.z),'return portal skipped menu');
g.adventure.travelWorld('home');check(player.pos.x===20.5 && player.health===6 && g.inventory.count(119)===before,'portal lost state');
// Terrain protection consumes TNT without destroying adjacent blocks.
g.worldRules.terrainDamage=false;w.setBlock(2,4,2,40);w.setBlock(3,4,2,7);explodeTnt(g,2,4,2);
check(w.getBlock(2,4,2)===0 && w.getBlock(3,4,2)===7,'protected terrain destroyed');
const mgr=new MobManager(scene,w,()=>[{pos:player.pos,damage(){}}],()=>{},()=>{});
mgr.zombies.push(new Zombie(scene,20,4,20));mgr.update(.1,true,0);
check(mgr.zombies.every(c=>PEACEFUL_MOBS.includes(c.netType)),'peaceful mode kept enemies');
// Each visible block/item has both languages and painted textures.
for(const [id,def] of Object.entries(BLOCKS))check(I18N.es['block_'+def.key] && I18N.en['block_'+def.key] && TILE_PAINTERS[def.side],'missing block content '+id);
for(let id=119;id<=125;id++)check((id===121 || RECIPES.some(r=>r.out.id===id)) && MAPS.creative.hotbar.includes(id),'missing craft/creative item '+id);
mgr.clear();g.animals.clear();for(const c of npcs)c.die();g.adventure.dispose();w.dispose();mat.dispose();
`,context);
console.log('Adventure behavior tests passed');
