// Un jinete remoto siempre se ve montado en un caballo, aunque el anfitrión no lo haya movido.
const fs=require('node:fs'),vm=require('node:vm');
const ctx={THREE:require('../lib/three.min.js'),console,localStorage:{getItem(){return null;}},document:undefined};vm.createContext(ctx);
for(const f of ['config','noise','textures','world','expedition-world','maps','physics','player','creature','character','inventory','items','armor','i18n','mobs','golem','animals','travel','netplay','expedition','adventure-effects','adventure','game-lifecycle'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx);
vm.runInContext(`
function check(ok,m){if(!ok)throw Error(m);}
globalThis.NET={isHost:true,id:9};
const scene=new THREE.Scene();
const av=new RemoteAvatar(scene,1);
av.setTarget(10,5,10,0,0,0);av.setVehicle('horse');
for(let i=0;i<30;i++)av.update(.05);
check(av.horse&&av.horse.group.visible,'no se dibuja el caballo del jinete');
check(Math.abs(av.horse.group.position.x-10)<.5&&Math.abs(av.horse.group.position.y-5)<.3,'caballo lejos del jinete');
av.setVehicle(null);av.update(.05);
check(!av.horse.group.visible,'caballo visible sin jinete');

// El caballo real del anfitrión se oculta mientras alguien lo monta (el jinete dibuja el suyo).
av.setVehicle('horse');
const real=new Animal(scene,'horse',0,5,0);real.rider=7;
const game=Object.assign({},GameLifecycle,{avatars:new Map([[7,av]]),net:true,animals:{animals:[real]},puppets:null,expedition:{travel:{mode:null}}});
game.hideRiddenHorses();check(!real.group.visible,'caballo real no se oculta');
real.rider=null;game.hideRiddenHorses();check(real.group.visible,'caballo libre oculto');
real.rider='local';game.hideRiddenHorses();check(real.group.visible,'caballo del anfitrión oculto');
`,ctx);
console.log('caballo-red ok');
