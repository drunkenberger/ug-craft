// En vista FIFA el ataque debe salir de los ojos del jugador, no de la cámara trasera.
const fs=require('node:fs'),vm=require('node:vm');
const ctx={THREE:require('../lib/three.min.js'),console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/game-combat.js','utf8'),ctx);
vm.runInContext(`
function check(ok,m){if(!ok)throw Error(m);}
const g=Object.assign({},GameCombat,{raycaster:new THREE.Raycaster(),cameraMode:'third',
  camera:new THREE.PerspectiveCamera(),controls:{yaw:0,pitch:0},
  player:{eyePosition:()=>new THREE.Vector3(0,1.6,0)}});
// Cámara FIFA: detrás (+z) y arriba, mirando al jugador.
g.camera.position.set(0,4,4.5);g.camera.lookAt(0,1.3,0);g.camera.updateMatrixWorld();
const zombi=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());
zombi.position.set(0,1.6,-3);zombi.updateMatrixWorld();
check(g.aimRay().intersectObject(zombi).length>0,'FIFA: no apunta al frente del jugador');
g.controls.yaw=Math.PI/2; // mira hacia -x
check(g.aimRay().intersectObject(zombi).length===0,'FIFA: ignora la orientación');
g.cameraMode='pov';g.controls.yaw=0;g.camera.position.set(0,1.6,0);g.camera.lookAt(0,1.6,-1);g.camera.updateMatrixWorld();
check(g.aimRay().intersectObject(zombi).length>0,'POV roto');
`,ctx);
console.log('fifa-ataque ok');
