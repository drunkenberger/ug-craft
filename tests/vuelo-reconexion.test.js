// Vuelo con doble Espacio y cola de ediciones sin conexión (reconexión sin perder lo hecho).
const fs=require('node:fs'),vm=require('node:vm');
const ctx={THREE:require('../lib/three.min.js'),console,localStorage:{getItem(){return null;}},document:{addEventListener(t,f){(this.h[t]=this.h[t]||[]).push(f);},h:{}},
  location:{protocol:'http:',host:'x'},performance};
vm.createContext(ctx);
for(const f of ['config','noise','textures','world','expedition-world','maps','physics','player','controls','net'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx);
vm.runInContext(`
function check(ok,m){if(!ok)throw Error(m);}
const scene=new THREE.Scene(),w=new World(scene,new THREE.MeshLambertMaterial(),generateFlat,{});
for(let cx=-2;cx<=2;cx++)for(let cz=-2;cz<=2;cz++)w.ensureChunkData(cx,cz);
const ctl={keys:new Set(),yaw:0,pitch:0,getMoveVector(){return{x:0,z:0};}};
const mk=(rules)=>{const p=new Player(w,rules,()=>{},()=>{});p.respawn({x:8.5,z:8.5});return p;};
const step=(p,s)=>{for(let i=0;i<s*60;i++)p.update(1/60,ctl);};

// Sin permiso (minijuegos) no vuela aunque se active.
let p=mk({});step(p,1);p.flying=true;ctl.keys.add('Space');step(p,.5);
check(!p.flying,'voló sin permiso');ctl.keys.clear();

// Con permiso: Espacio sube, sin Espacio se queda flotando, Mayús baja y al tocar suelo aterriza.
p=mk({canFly:true});step(p,1);const y0=p.pos.y;
p.flying=true;ctl.keys.add('Space');step(p,1);
check(p.pos.y>y0+5,'no sube volando');
ctl.keys.clear();const yAir=p.pos.y;step(p,1);
check(Math.abs(p.pos.y-yAir)<.01&&p.flying,'no se queda flotando');
ctl.keys.add('ShiftLeft');step(p,3);
check(p.onGround&&!p.flying,'no aterriza al tocar el suelo');ctl.keys.clear();

// Sin daño de caída desde el aire al volar.
p=mk({canFly:true,fallDamage:true});step(p,1);p.flying=true;ctl.keys.add('Space');step(p,2);ctl.keys.clear();
const hp=p.health;ctl.keys.add('ShiftLeft');step(p,4);check(p.health===hp,'daño al aterrizar volando');ctl.keys.clear();

// Doble Espacio (dentro de 300 ms) dispara el vuelo; una pulsación aislada no.
const c=new Controls({});let toggles=0;c.locked=true;c.onDoubleSpace=()=>toggles++;
const key=(code)=>document.h.keydown.forEach(f=>f({code,key:code,repeat:false,target:{},preventDefault(){}}));
let t0=1000;performance.now=()=>t0;
key('Space');check(toggles===0,'una pulsación activó el vuelo');
t0+=200;key('Space');check(toggles===1,'doble Espacio no activó el vuelo');
t0+=100;key('Space');check(toggles===1,'triple pulsación volvió a activar');
t0+=1000;key('Space');t0+=500;key('Space');check(toggles===1,'pulsaciones lentas activaron el vuelo');

// Cola sin conexión: se guarda, se deduplica y se reenvía.
const sent=[];NET.handlers={};NET.ws={readyState:3,send:m=>sent.push(JSON.parse(m))};
globalThis.WebSocket={OPEN:1};
NET.send({t:'block',x:1,y:2,z:3,id:5});NET.send({t:'block',x:1,y:2,z:3,id:0});NET.send({t:'block',x:4,y:5,z:6,id:9});NET.send({t:'pos',x:0});
check(JSON.stringify(NET.pendingEdits())===JSON.stringify({'1,2,3':0,'4,5,6':9}),'cola incorrecta '+JSON.stringify(NET.pendingEdits()));
check(sent.length===0,'envió sin conexión');
NET.ws.readyState=1;NET.flushOutbox();
check(sent.length===2&&sent[0].id===0&&NET.outbox.size===0,'no reenvió la cola');
`,ctx);
console.log('vuelo-reconexion ok');
