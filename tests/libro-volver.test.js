// Las páginas de adopción y acertijo del libro (J) ofrecen volver al libro principal.
const fs=require('node:fs'),vm=require('node:vm');
const ctx={THREE:require('../lib/three.min.js'),console,localStorage:{getItem(){return null;}},document:undefined};vm.createContext(ctx);
for(const f of ['config','items','i18n','expedition-ui'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx);
vm.runInContext(`
function check(ok,m){if(!ok)throw Error(m);}
function serializePets(){return [];}
function fakeBook(pet){
  const b={page:'adopt',buttons:[],renders:0,el:{scrollTop:5},
    game:{adventure:{adoptionTarget:pet},inventory:{count:()=>1,isFree:()=>false},player:{pos:new THREE.Vector3()}},
    node(){return{};},button(text,fn){const x={text,fn};b.buttons.push(x);return x;},render(){b.renders++;}};
  return b;
}
const pet={species:'dog',dead:false,tamed:false,pos:new THREE.Vector3()};
let b=fakeBook(pet);renderAdoption(b);
const back=b.buttons.find(x=>x.text===t('riddleBook'));
check(back,'adopción sin botón de volver');
back.fn();check(b.page==='journey'&&b.renders===1,'no vuelve al libro principal');
b=fakeBook({species:'fish'});renderAdoption(b);
check(b.buttons.some(x=>x.text===t('riddleBook')),'objetivo no adoptable sin botón de volver');
`,ctx);
console.log('libro-volver ok');
