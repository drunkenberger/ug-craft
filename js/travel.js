// Monturas reutilizables: el jugador conserva su silla/barco en el inventario.
function createBoatModel(scene) {
  const group=new THREE.Group(),material=new THREE.MeshLambertMaterial({color:0x986239});
  for(const [w,h,d,x,y,z] of [[1.3,.18,1.9,0,.26,0],[.12,.4,1.9,-.64,.3,0],[.12,.4,1.9,.64,.3,0],[1.3,.4,.12,0,.3,-.9],[1.3,.4,.12,0,.3,.9],[1.15,.1,.3,0,.4,0]]) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);group.add(m);
  }
  scene.add(group);group.visible=false;
  return {group,dispose(){scene.remove(group);group.traverse(o=>o.geometry?.dispose());material.dispose();}};
}
class Travel {
  constructor(game){this.game=game;this.mode=null;this.pet=null;this.boat=createBoatModel(game.scene);}
  mount(pet) {
    const g=this.game,p=g.player;
    const owner=g.net&&!NET.isHost?NET.id:'local';
    if(pet.species!=='horse'||!pet.tamed||pet.owner!==owner||pet.dead||pet.pos.distanceTo(p.pos)>5)return false;
    if(g.inventory.count(127)<1){g.ui.toast(t('needSaddle'));return false;}
    if(bodyCollides(g.world,{pos:p.pos,halfW:.45,height:2.6})){g.ui.toast(t('mountSpace'));return false;}
    this.dismount();this.mode='horse';this.pet=pet;
    g.expedition.petCommand(pet,'mount');pet.rider=owner;pet.waiting=false;
    this.start();return true;
  }
  sail() {
    const g=this.game,p=g.player;
    if(this.mode==='boat'){this.dismount();return true;}
    if(g.inventory.count(126)<1)return false;
    const x=Math.floor(p.pos.x),z=Math.floor(p.pos.z),y=Math.floor(p.pos.y);
    if(![y-1,y,y+1].some(h=>g.world.getBlock(x,h,z)===17)){g.ui.toast(t('boatWater'));return false;}
    this.dismount();this.mode='boat';this.start();return true;
  }
  start(){this.previousView=this.game.cameraMode;this.game.cameraMode='third';this.applyRules();this.game.ui.toast(t('travelControls'),5000);}
  applyRules() {
    const p=this.game.player;
    p.rules.moveScale=this.mode==='horse'?1.8:this.mode==='boat'?2.1:1;
    p.rules.jumpScale=this.mode==='horse'?1.2:1;p.rules.boating=this.mode==='boat';p.rules.eyeLift=this.mode==='horse'?.75:0;
    p.halfW=this.mode==='boat'?.62:this.mode==='horse'?.45:CFG.PLAYER_HALF_W;
    p.height=this.mode==='horse'?2.6:CFG.PLAYER_HEIGHT;
  }
  dismount() {
    if(this.pet){this.game.expedition.petCommand(this.pet,'dismount');this.pet.rider=null;}
    this.pet=null;this.mode=null;this.applyRules();this.boat.group.visible=false;
    if(this.previousView)this.game.cameraMode=this.previousView;
    this.previousView=null;
  }
  update() {
    if(this.mode==='horse' && (!this.pet||this.pet.dead||this.game.inventory.count(127)<1))this.dismount();
    if(this.mode==='boat'&&this.game.inventory.count(126)<1)this.dismount();
    const p=this.game.player;
    if(this.mode==='horse' && (!this.game.net||NET.isHost)) {
      this.pet.pos.copy(p.pos);this.pet.group.position.copy(p.pos);this.pet.group.rotation.y=this.game.controls.yaw+Math.PI;
    }
    this.boat.group.visible=this.mode==='boat';this.boat.group.position.copy(p.pos);this.boat.group.rotation.y=this.game.controls.yaw;
  }
  dispose(){this.dismount();this.boat.dispose();}
}
