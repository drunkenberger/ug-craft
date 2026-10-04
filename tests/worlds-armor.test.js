const fs=require('node:fs'),vm=require('node:vm');
const ctx={THREE:require('../lib/three.min.js'),console,localStorage:{getItem(){return null;}}};vm.createContext(ctx);
for(const f of ['config','noise','textures','world','expedition-world','maps','physics','player','creature','character','inventory','items','armor','i18n','expedition','adventure-effects','adventure'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx);
vm.runInContext(`
function check(ok,message){if(!ok)throw Error(message);}
const scene=new THREE.Scene(),mat=new THREE.MeshLambertMaterial(),w=new World(scene,mat,generateFlat,{});
w.ensureChunkData(0,0);
const g={scene,world:w,map:{canBuild:true},net:false,inventory:new Inventory('counted'),save(){},ui:{toast(){}},hittableCreatures(){return [];}};
g.player=new Player(w,{},()=>{},()=>{});g.player.pos.set(8.5,4.02,8.5);
g.armor=new Armor(g);g.player.rules.armorProtection=()=>g.armor.protection();
check(!g.armor.equip(128),'equipped nonexistent item');
g.inventory.add(128,1);check(g.armor.equip(128)&&!g.inventory.count(128),'equipment not removed from inventory');
check(!g.armor.equip(128),'equipped twice');g.inventory.add(136,1);g.armor.equip(136);
check(g.inventory.count(128)===1&&g.armor.slots.helmet===136,'swap lost old helmet');
check(g.armor.unequip('helmet')&&!g.armor.unequip('helmet')&&g.inventory.count(136)===1,'removal duplicated');
for(let id=136;id<=139;id++){if(id!==136)g.inventory.add(id,1);g.armor.equip(id);}
check(Math.abs(g.armor.protection()-.72)<.001,'full diamond reduction incorrect');
g.player.health=10;g.player.damage(4);check(Math.abs(g.player.health-8.88)<.001,'armor damage incorrect');
g.player.invulnTimer=0;g.player.damage(1,false,'hunger');check(Math.abs(g.player.health-7.88)<.001,'armor blocks hunger');
g.player.damage(100,true);check(g.player.dead&&g.armor.slots.helmet===136,'death lost armor or void became survivable');
g.player.respawn({x:8.5,y:4.02,z:8.5});
const saved=g.armor.serialize();const restored=new Armor(g,JSON.parse(JSON.stringify(saved)));check(restored.slots.boots===139,'armor save lost');
check(Object.keys(normalizeArmor({helmet:139,boots:999,chestplate:'137'})).length===1,'invalid slot accepted');
const avatar=new Humanoid(scene,0,0,0,g.armor.appearance());let pieces=0;avatar.group.traverse(o=>{if(o.name==='armor')pieces++;});check(pieces===11,'armor meshes missing');
avatar.setSitting(true);avatar.build(g.armor.appearance());check(avatar.legL.rotation.x===-1.5,'rebuild lost riding pose');avatar.die();
g.adventure=new Adventure(g);g.adventure.callPets=()=>{};g.adventure.soundEnabled=false;
check(g.adventure.serialize().armor.helmet===136,'armor missing from personal save');
const before=g.inventory.serialize();
for(const realm of REALMS) {
 check(g.adventure.travelWorld(realm.key),'travel failed '+realm.key);
 check(realmAt(g.player.pos.x,g.player.pos.z)===realm&&!bodyCollides(w,g.player),'unsafe arrival '+realm.key);
 check(w.getBlock(realm.center,realm.floor+1,realm.center)===50,'return portal missing '+realm.key);
 const x=realm.center+2,y=realm.floor+1,z=realm.center+3;w.setBlock(x,y,z,32);
 check(g.adventure.travelWorld('home')&&g.player.pos.x===8.5,'return failed');
 check(g.adventure.travelWorld(realm.key)&&w.getBlock(x,y,z)===32,'travel lost building');g.adventure.travelWorld('home');
 const c=Math.floor((realm.center+32)/CFG.CHUNK),a=new Uint8Array(CFG.CHUNK*CFG.CHUNK*CFG.HEIGHT),b=new Uint8Array(a.length);
 generateAdventureTerrain(w,c,c,a);generateAdventureTerrain(w,c,c,b);check(a.every((v,i)=>v===b[i]),'nondeterministic realm');
}
check(JSON.stringify(before)===JSON.stringify(g.inventory.serialize()),'travel changed inventory');
check(!g.adventure.travelWorld('invalid'),'unknown world accepted');
// Walking through the portal never chooses a destination on the player's behalf.
g.player.pos.set(8.5,4.02,8.5);w.setBlock(8,4,8,50);w.setBlock(8,5,8,50);
g.adventure.fx.update=()=>{};g.adventure.update(.1);g.adventure.update(3);
check(!isAdventureZone(g.player.pos.x,g.player.pos.z),'walking into portal teleported');
let opened=0;g.adventure.book={show(){opened++;},dispose(){}};
g.adventure.portal();check(opened===1&&g.adventure.book.page==='worlds'&&!isAdventureZone(g.player.pos.x,g.player.pos.z),'portal skipped world menu');
for(let id=128;id<=139;id++)check(RECIPES.some(r=>r.out.id===id)&&TILE_PAINTERS[ITEMS[id].tile]&&I18N.es['item_'+ITEMS[id].key]&&I18N.en['item_'+ITEMS[id].key],'missing armor recipe/icon/name');
g.adventure.dispose();w.dispose();mat.dispose();
`,ctx);
console.log('World travel and armor tests passed');
