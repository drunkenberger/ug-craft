// Golem de hierro: combate, dueño, guardado, red y colocación.
const fs=require('node:fs'),vm=require('node:vm');
const ctx={THREE:require('../lib/three.min.js'),console,localStorage:{getItem(){return null;}},document:undefined};vm.createContext(ctx);
for(const f of ['config','noise','textures','world','expedition-world','maps','physics','player','creature','character','inventory','items','armor','i18n','mobs','golem','animals','netplay','expedition','adventure-effects','adventure'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx);
vm.runInContext(`
function check(ok,message){if(!ok)throw Error(message);}
const scene=new THREE.Scene(),mat=new THREE.MeshLambertMaterial(),w=new World(scene,mat,generateFlat,{});
for(let cx=-3;cx<=3;cx++)for(let cz=-3;cz<=3;cz++)w.ensureChunkData(cx,cz);
const Y=4.02,player={id:'local',pos:new THREE.Vector3(8.5,Y,8.5),dead:false,damage(){}};
const drops=[];
const mobs=new MobManager(scene,w,()=>[player],()=>{},(id,n,k)=>drops.push([id,n,k]),()=>{});
const run=(s,max=3)=>{for(let i=0;i<s*20;i++)mobs.update(.05,false,max);};

// 1. Ataca a los hostiles cercanos y no a los pacíficos.
const golem=mobs.spawnGolem(10.5,Y,10.5,'local');
const zombie=new Zombie(scene,14.5,Y,10.5);zombie.burnTimer=-1e9;mobs.zombies.push(zombie);
const piglin=new Piglin(scene,6.5,Y,10.5);mobs.zombies.push(piglin);
run(8);
check(zombie.dead,'golem no mató al zombi');
check(!piglin.dead&&!golem.dead,'golem atacó a un pacífico o murió');
check(zombie.lastHitBy==='local','el botín no va al dueño');

// 2. El dueño no puede dañarlo; otros sí (con poco retroceso).
golem.hurt(5,{x:1,z:0},'local');check(golem.health===20,'el dueño dañó a su golem');
golem.hurt(5,{x:1,z:0},7);check(golem.health===15,'daño ajeno no aplicado');

// 3. Sigue al dueño y se teletransporta si queda muy lejos.
player.pos.set(8.5,Y,28.5);run(8);
check(Math.hypot(golem.pos.x-player.pos.x,golem.pos.z-player.pos.z)<14,'golem no siguió al dueño');
player.pos.set(8.5,Y,-30.5);run(.2);
check(Math.hypot(golem.pos.x-player.pos.x,golem.pos.z-player.pos.z)<4,'golem no se teletransportó');
player.pos.set(8.5,Y,8.5);golem.pos.set(8.5,Y,8.5);

// 4. Con la regla «sin enemigos» (maxMobs 0) el golem se queda.
run(1,0);check(!golem.dead&&mobs.zombies.includes(golem),'golem retirado como enemigo');

// 5. Guardián de aldea: patrulla cerca de su casa, no tiene dueño y suelta hierro si lo matan.
const guard=mobs.spawnGolem(8.5,Y,-8.5,null);run(30,0);
check(Math.hypot(guard.pos.x-8.5,guard.pos.z+8.5)<10,'guardián se alejó de su aldea');
guard.hurt(100,{x:0,z:1},'local');
check(guard.dead&&drops.some(d=>d[0]===112&&d[1]===3&&d[2]==='local'),'guardián no soltó hierro');

// 6. Guardado y restauración (junto a las mascotas), sin duplicar.
const animals=new AnimalManager(scene,w,()=>[player],()=>{});
const game={mobs,animals,net:false,hittableCreatures(){return [...mobs.zombies,...animals.animals];}};
golem.health=9;
const saved=serializePets(game).filter(e=>e[3]==='irongolem');
check(saved.length===1&&saved[0][5].health===9,'golem no se serializa');
const fresh=new MobManager(scene,w,()=>[player],()=>{},()=>{},()=>{});
const game2={mobs:fresh,animals:new AnimalManager(scene,w,()=>[player],()=>{}),hittableCreatures(){return [...fresh.zombies];}};
restorePets(game2,saved);restorePets(game2,saved);
const back=fresh.zombies.filter(c=>c.netType==='irongolem');
check(back.length===1&&back[0].owner==='local'&&back[0].health===9,'restauración incorrecta o duplicada');

// 7. Títere en un invitado.
const pm=new PuppetManager(scene);pm.apply([{k:77,ty:'irongolem',x:8,y:Y,z:8,ry:0,ow:5}]);
const pup=pm.findById(77);check(pup&&pup.netType==='irongolem'&&pup.owner===5,'títere de golem incorrecto');

// 8. Colocación: espacio, límite, consumo y mensaje de red.
const sent=[];globalThis.NET={isHost:true,id:9,send:m=>sent.push(m)};
const toasts=[];game.world=w;game.ui={toast:m=>toasts.push(m)};game.inventory=new Inventory('counted');game.inventory.add(140,5);game.selectedId=()=>140;
const place=(x)=>placeGolem(game,{outside:{x,y:Math.ceil(Y),z:20}});
const before=mobs.zombies.length;
place(3);check(mobs.zombies.length===before+1&&game.inventory.count(140)===4,'no colocó el golem');
w.setBlock(5,Math.ceil(Y)+2,20,32);place(5);check(game.inventory.count(140)===4,'colocó sin espacio');
place(6);place(7);place(2);
check(game.inventory.count(140)===3,'límite de 3 golems no respetado');
game.mobs=null;place(1);check(game.inventory.count(140)===3&&toasts.includes(t('golemNeedsMobs')),'permitido sin supervivencia');
game.mobs=mobs;game.net=true;NET.isHost=false;game.hittableCreatures=()=>[];
place(1);check(sent.some(m=>m.t==='golem'),'el invitado no avisó al anfitrión');

// 9. Datos: receta e icono.
check(RECIPES.some(r=>r.out.id===140&&r.cost[0][0]===112),'falta la receta');
check(nameOf(140)==='Golem de hierro'&&ITEMS[140].tile===109&&ICON_ART[109].length===8,'ítem sin nombre o icono');
`,ctx);
console.log('Iron golem tests passed');
