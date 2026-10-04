const fs=require('node:fs'),vm=require('node:vm');
const ctx={THREE:require('../lib/three.min.js'),console};vm.createContext(ctx);
for(const f of ['config','noise','textures','world','expedition-world','maps','physics','player','creature','mobs','animals','survival','inventory','items','i18n','adventure-effects','travel','expedition','adventure'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx);
vm.runInContext(`
function check(ok,message){if(!ok)throw Error(message);}
function game(generator=generateFlat){
 const scene=new THREE.Scene(),mat=new THREE.MeshLambertMaterial(),w=new World(scene,mat,generator,{});
 w.ensureChunkData(0,0);
 const g={scene,world:w,map:{canBuild:true},mapKey:'survival',spawn:{x:8,z:8},net:false,avatars:new Map(),cameraMode:'pov',controls:{keys:new Set(),yaw:0,getMoveVector(){return {x:0,z:0};}},inventory:new Inventory('counted'),ui:{toast(){},setHint(){}},save(){},refreshHotbar(){},selectedId(){return this.selected;},worldRules:normalizeWorldRules()};
 g.player=new Player(w,{fallDamage:false},()=>{},()=>g.expedition.onDeath());g.player.pos.set(8.5,4.02,8.5);
 g.animals=new AnimalManager(scene,w,()=>[{id:'local',pos:g.player.pos}],()=>{});g.npcs=[];
 g.hittableCreatures=()=>[...g.animals.animals,...g.npcs];scanWorldExtras(g);
 g.adventure=new Adventure(g);g.expedition=new Expedition(g);g.adventure.soundEnabled=false;
 g.cleanup=()=>{g.expedition.dispose();g.adventure.dispose();g.animals.clear();for(const c of g.npcs)c.die();w.dispose();mat.dispose();};return g;
}
const g=game(),e=g.expedition,w=g.world;
g.inventory.add(127,1);g.inventory.add(126,1);
const horse=g.animals.spawnPet(8.5,4,9,'horse','Rayo');
check(e.travel.mount(horse)&&e.travel.mode==='horse','cannot mount owned horse');
check(g.player.height===2.6&&g.player.rules.moveScale>1,'mount physics not changed');
e.petCommand(horse,'wait');check(!e.travel.mode&&horse.waiting,'waiting horse still ridden');
e.petCommand(horse,'collar',{color:'blue'});check(horse.collarColor==='blue','collar not changed');
horse.health=2;g.inventory.add(117,1);check(e.petCommand(horse,'feed')&&horse.health===4&&g.inventory.count(117)===0,'feeding incorrect');
const savedPets=serializePets(g);check(savedPets[0][5].waiting&&savedPets[0][5].color==='blue','pet preferences not saved');
const stranger=g.animals.spawnPet(8,4,9,'horse','Otro','peer');check(!e.travel.mount(stranger),'mounted another player horse');
// Sailing floats on water, keeps the reusable boat, and restores normal physics.
for(let x=11;x<=15;x++)for(let z=11;z<=15;z++)for(let y=4;y<=6;y++)w.setBlock(x,y,z,17);
g.player.pos.set(13.5,5,13.5);check(e.travel.sail(),'cannot board on water');
const previousY=g.player.pos.y;g.player.update(.05,g.controls);check(g.player.pos.y>previousY,'boat did not float');
e.travel.dismount();check(!g.player.rules.boating&&g.player.halfW===CFG.PLAYER_HALF_W&&g.inventory.count(126)===1,'boat lost or physics not reset');
// Each orientation changes the upper step; two slabs produce a full plank.
check(blockBoxes(49)[1][2]===.5&&blockBoxes(63)[1][3]===.5&&blockBoxes(64)[1][5]===.5&&blockBoxes(65)[1][0]===.5,'stair rotation shapes incorrect');
w.setBlock(6,4,6,48);g.player.pos.set(8.5,4,8.5);g.selected=48;g.inventory.add(48,1);
adventureRightClick(g,null,{inside:{x:6,y:4,z:6},outside:{x:6,y:5,z:6}});
check(w.getBlock(6,4,6)===7&&g.inventory.count(48)===0,'slabs did not combine');
// Professions enforce presence, affordability, and one-time mission rewards.
g.npcs.push(new Villager(g.scene,9,4,8,'smith'));g.inventory.add(111,4);
check(e.profession('smith',true),'smith quest failed');check(!e.profession('smith',true)&&g.inventory.count(115)===1,'smith quest duplicated');
check(!e.profession('farmer'),'remote farmer trade allowed');
// Death and respawn preserve every item and quantity, including repeat deaths.
g.player.pos.set(8.5,4.02,8.5);e.lastSafe=g.player.pos.clone();
const inventoryBefore=JSON.stringify(g.inventory.serialize());
let deathSave=null;g.save=()=>{deathSave={health:g.player.health,items:g.inventory.serialize()};};
for(let i=0;i<2;i++) {
 g.player.damage(100,true);
 check(g.player.dead&&JSON.stringify(g.inventory.serialize())===inventoryBefore&&!e.data.backpacks.length,'death lost inventory or created a duplicate backpack');
 check(deathSave.health===0&&JSON.stringify(deathSave.items)===inventoryBefore,'death did not save retained inventory');
 g.player.respawn({x:2,y:4,z:2});
 check(JSON.stringify(g.inventory.serialize())===inventoryBefore,'respawn lost inventory');
}
// Old backpacks remain recoverable once, without duplicating current inventory.
e.data.backpacks.push({pos:{x:8.5,y:4.02,z:8.5},items:[[8,3]]});
check(!e.recover(0),'old backpack recovered remotely');
const goldBefore=g.inventory.count(8);g.player.pos.copy(e.lastSafe);
check(e.recover(0)&&g.inventory.count(8)===goldBefore+3&&!e.recover(0),'old backpack lost or duplicated');
// Migrate every old backpack into current inventory exactly once, including tools.
e.data.backpacks=[{pos:{x:100,y:30,z:100},items:[[3,458],[100,2],[116,2]]},{pos:{x:2,y:4,z:3},items:[[3,6],[53,2]]}];
const stone=g.inventory.count(3),picks=g.inventory.count(100),swords=g.inventory.count(116);
check(e.recoverLegacyInventory(),'old inventories were not restored');
check(g.inventory.count(3)===stone+464&&g.inventory.count(100)===picks+2&&g.inventory.count(116)===swords+2,'migration changed quantities');
const migrated=JSON.stringify(g.inventory.serialize());
check(!e.recoverLegacyInventory()&&JSON.stringify(g.inventory.serialize())===migrated,'migration duplicated items');
e.restore(JSON.parse(JSON.stringify(e.serialize())));
check(!e.recoverLegacyInventory(),'saved migration replayed');
const health=g.player.health;g.respawnPoint={x:4.5,y:4,z:4.5};check(e.home()&&g.player.health===health&&!bodyCollides(w,g.player),'home teleport unsafe or healed');
// Album records distinct observations and serializes with the adventure.
g.player.onGround=true;g.player.pos.set(8.5,4.02,8.5);e.update(.6);e.update(.6);
check(e.data.animals.includes('horse')&&new Set(e.data.materials).size===e.data.materials.length,'album discovery incorrect');
check(g.adventure.serialize().journey.jobs.includes('smith'),'expedition not persisted');
g.cleanup();
// Generated sites, riddles, shared block progress and castle reward.
const quest=game(generateTerrain),qe=quest.expedition,qw=quest.world;
for(const site of EXPEDITION_SITES){const p=runePosition(qw,site);qw.ensureChunkData(Math.floor(p.x/CFG.CHUNK),Math.floor(p.z/CFG.CHUNK));if(site.rune)check(qw.getBlock(p.x,p.y,p.z)===site.rune,'missing generated rune '+site.key);}
for(let i=0;i<3;i++){
 const site=EXPEDITION_SITES[i],p=runePosition(qw,site);quest.player.pos.set(p.x+1,p.y,p.z);
 quest.adventure.book={show(){this.shown=true;},dispose(){}};quest.selected=128;
 check(adventureRightClick(quest,null,{inside:p})&&quest.adventure.book.page==='riddle'&&quest.adventure.book.shown&&qe.puzzle.id===site.rune,'rune did not open dedicated riddle with armor selected');
 check(!qe.answer((RUNE_RIDDLES[i].correct+1)%3)&&qw.getBlock(p.x,p.y,p.z)===site.rune,'wrong answer solved rune');
 check(qe.answer(RUNE_RIDDLES[i].correct)&&qw.getBlock(p.x,p.y,p.z)===58,'correct answer failed');
}
const castle=EXPEDITION_SITES[3],floor=siteFloor(qw,castle);check(qw.getBlock(128,floor+1,50)===0,'castle gate did not open');
const chest={inside:{x:128,y:floor+2,z:33}};qe.interact(chest);qe.interact(chest);check(quest.inventory.count(61)===1&&quest.inventory.count(113)===3,'castle reward duplicated');
const cave=EXPEDITION_SITES[0],cy=siteFloor(qw,cave);qw.ensureChunkData(5,0);qe.interact({inside:{x:83,y:cy+1,z:5}});qe.interact({inside:{x:83,y:cy+1,z:5}});check(quest.inventory.count(8)===2,'cave cache reward duplicated');
const restored=new World(new THREE.Scene(),new THREE.MeshLambertMaterial(),generateTerrain,{...qw.edits});const pos=runePosition(restored,EXPEDITION_SITES[0]);restored.ensureChunkData(5,0);check(restored.getBlock(pos.x,pos.y,pos.z)===58,'rune progress lost on world reload');
restored.dispose();quest.cleanup();
`,ctx);
console.log('Expedition behavior tests passed');
