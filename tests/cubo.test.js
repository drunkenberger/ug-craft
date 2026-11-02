// Cubo: recoger agua, soltarla, cambio de ítem en la barra, receta y riego de cultivos.
const fs=require('node:fs'),vm=require('node:vm');
const ctx={THREE:require('../lib/three.min.js'),console,localStorage:{getItem(){return null;}},document:undefined};vm.createContext(ctx);
for(const f of ['config','noise','textures','world','expedition-world','maps','physics','player','creature','character','inventory','items','armor','i18n','mobs','golem','animals','netplay','expedition','adventure-effects','adventure','survival','game-combat','bucket'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx);
vm.runInContext(`
function check(ok,m){if(!ok)throw Error(m);}
const scene=new THREE.Scene(),w=new World(scene,new THREE.MeshLambertMaterial(),generateFlat,{});
for(let cx=-1;cx<=1;cx++)for(let cz=-1;cz<=1;cz++)w.ensureChunkData(cx,cz);
const Y=Math.ceil(w.findSurface(8,8));
// Estanque de agua de 5x5 hundido en el suelo, frente al jugador (mira hacia -z).
for(let x=6;x<=10;x++)for(let z=-6;z<=-2;z++){w.setBlock(x,Y-1,z,17);}
w.buildMesh(0,-1);w.buildMesh(0,0);scene.updateMatrixWorld(true);
const toasts=[];let selected=141;
const g=Object.assign({},GameCombat,{world:w,cameraMode:'third',controls:{yaw:0,pitch:-0.5},raycaster:new THREE.Raycaster(),
  player:{eyePosition:()=>new THREE.Vector3(8.5,Y+1.6,-0.5)},net:false,
  inventory:new Inventory('counted'),ui:{toast:m=>toasts.push(m)},selectedId:()=>selected,
  adventure:{fx:{tone(){}},cropTimers:new Map()},tntFuses:new Map(),torches:new Set(),saplings:[]});
g.inventory.add(141,1);g.inventory.add(7,4);

// 1. Receta: 3 hierros en mesa.
check(RECIPES.some(r=>r.out.id===141&&r.cost.length===1&&r.cost[0][0]===112&&r.cost[0][1]===3&&r.table),'falta la receta del cubo');
check(nameOf(141)==='Cubo'&&nameOf(142)==='Cubo con agua'&&ICON_ART[110].length===8&&ICON_ART[111].length===8,'ítem sin nombre o icono');

// 2. Apuntando al estanque, el cubo recoge un bloque de agua y se vuelve cubo con agua en el mismo lugar.
const slot=g.inventory.entries.findIndex(e=>e.id===141);
const antes=[...Array(25)].map((_,i)=>w.getBlock(6+i%5,Y-1,-6+Math.floor(i/5))).filter(b=>b===17).length;
check(antes===25,'estanque mal construido');
check(useBucket(g,null),'clic sin manejar');scene.updateMatrixWorld(true);
const despues=[...Array(25)].map((_,i)=>w.getBlock(6+i%5,Y-1,-6+Math.floor(i/5))).filter(b=>b===17).length;
check(despues===24,'no quitó agua del estanque: '+despues+' '+toasts.join('|'));
check(g.inventory.entries[slot].id===142&&g.inventory.count(141)===0&&g.inventory.count(142)===1,'no cambió el cubo en su lugar');

// 3. Con el cubo lleno suelta agua junto al bloque apuntado y vuelve a quedar vacío.
selected=142;
useBucket(g,{inside:{x:3,y:Y-1,z:3},outside:{x:3,y:Y,z:3}});
check(w.getBlock(3,Y,3)===17&&g.inventory.entries[slot].id===141,'no soltó el agua');
// ...pero no sobre un bloque ocupado.
g.inventory.add(142,1);selected=142;
useBucket(g,{inside:{x:3,y:Y-1,z:3},outside:{x:3,y:Y-1,z:3}});
check(toasts.includes(t('bucketNoSpace')),'soltó agua sobre un bloque ocupado');

// 4. Sin agua a la vista avisa y no cambia nada.
selected=141;g.controls.pitch=0.5;const n=g.inventory.count(141);toasts.length=0;
useBucket(g,null);
check(toasts.includes(t('bucketNoWater'))&&g.inventory.count(141)===n,'recogió sin agua');

// 5. El agua soltada riega: sin agua a su nivel el cultivo no crece; con ella, sí.
w.setBlock(12,Y-1,8,41);w.setBlock(12,Y,8,42);
const adv=Object.create(Adventure.prototype);
Object.assign(adv,{game:g,cropClock:0,cropTimers:new Map(),fx:{update(){}}});
g.map={canBuild:true};g.player.dead=false;g.avatars=new Map();
adv.update(46);check(w.getBlock(12,Y,8)===42,'creció sin agua');
w.setBlock(15,Y-1,8,0);selected=142;g.inventory.add(142,1);
useBucket(g,{inside:{x:15,y:Y-1,z:9},outside:{x:15,y:Y-1,z:8}});
check(w.getBlock(15,Y-1,8)===17,'no soltó el agua junto al cultivo');
adv.update(46);check(w.getBlock(12,Y,8)===43,'el cultivo no creció con el agua del cubo');
`,ctx);
console.log('cubo ok');
