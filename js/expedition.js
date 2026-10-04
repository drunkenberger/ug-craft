const PROFESSIONS = {
  farmer:{trade:{cost:[[121,2]],out:[120,3]},mission:{cost:[[120,6]],reward:[[122,4],[119,6]]}},
  smith:{trade:{cost:[[112,2]],out:[110,8]},mission:{cost:[[111,4]],reward:[[115,1]]}},
  explorer:{trade:{cost:[[54,2]],out:[8,1]},mission:{cost:[[54,5]],reward:[[127,1],[126,1]]}},
};
const RUNE_RIDDLES=[
  {id:55,key:'riddleSun',answers:['riddleSunA','riddleSunB','riddleSunC'],correct:1},
  {id:56,key:'riddleMoon',answers:['riddleMoonA','riddleMoonB','riddleMoonC'],correct:2},
  {id:57,key:'riddleLeaf',answers:['riddleLeafA','riddleLeafB','riddleLeafC'],correct:0},
];
const COLLAR_COLORS={red:0xd02828,blue:0x3478c8,green:0x4c9843,purple:0x9561c1,gold:0xd7ac38};
function ownPet(game,pet){return pet?.tamed&&!pet.dead&&pet.owner===(game.net&&!NET.isHost?NET.id:'local');}
function safeTravelPosition(world,position) {
  if(!position || !Number.isFinite(position.x)||!Number.isFinite(position.z))return null;
  for(let radius=0;radius<=4;radius++)for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++) {
    if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
    const x=Math.floor(position.x)+dx,z=Math.floor(position.z)+dz;
    world.ensureChunkData(Math.floor(x/CFG.CHUNK),Math.floor(z/CFG.CHUNK));
    const preferred=Number.isFinite(position.y)?Math.max(1,Math.min(CFG.HEIGHT-3,Math.floor(position.y))):world.findSurface(x,z);
    const heights=[preferred];for(let y=CFG.HEIGHT-3;y>=1;y--)if(y!==preferred)heights.push(y);
    for(const y of heights) {
      const pos=new THREE.Vector3(x+.5,y+.02,z+.5);
      if(blockOpaque(world.getBlock(x,y-1,z))&&world.getBlock(x,y,z)!==17&&!bodyCollides(world,{pos,halfW:.3,height:1.8}))return pos;
    }
  }
  return null;
}
class Expedition {
  constructor(game,saved={}) {
    this.game=game;this.restore(saved);this.travel=new Travel(game);
    this.clock=0;this.rotation=0;this.puzzle=null;this.feedback='';this.markers=[];
    this.preview=new THREE.Mesh(new THREE.BoxGeometry(5,5,5),new THREE.MeshBasicMaterial({color:0x74d282,wireframe:true,transparent:true,opacity:.8}));
    this.preview.visible=false;game.scene.add(this.preview);
  }
  restore(saved={}) {
    const strings=value=>Array.isArray(value)?[...new Set(value.filter(v=>typeof v==='string'))]:[];
    this.data={jobs:strings(saved.jobs),places:strings(saved.places),animals:strings(saved.animals),materials:strings(saved.materials),caches:strings(saved.caches),castle:!!saved.castle,
      backpacks:Array.isArray(saved.backpacks)?saved.backpacks.filter(b=>b&&b.pos&&['x','y','z'].every(k=>Number.isFinite(b.pos[k]))&&Array.isArray(b.items)).map(b=>({pos:b.pos,items:b.items.filter(e=>Array.isArray(e)&&defOf(e[0])&&Number.isFinite(e[1])&&e[1]>0)})):[]};
  }
  serialize(){return this.data;}
  nearProfession(role) {return this.game.hittableCreatures().find(c=>c.netType==='villager'&&(c.profession||'farmer')===role&&!c.dead&&c.pos.distanceTo(this.game.player.pos)<6);}
  profession(role,mission=false) {
    const spec=PROFESSIONS[role],g=this.game;
    if(!spec||!this.nearProfession(role))return false;
    const deal=mission?spec.mission:spec.trade;
    if((mission&&this.data.jobs.includes(role))||!g.inventory.canAfford(deal.cost))return false;
    g.inventory.pay(deal.cost);
    if(mission){this.data.jobs.push(role);for(const [id,n] of deal.reward)g.inventory.add(id,n);}
    else g.inventory.add(...deal.out);
    g.adventure.fx.tone('reward');g.save();return true;
  }
  runeStates() {
    const w=this.game.world;
    this.runes=EXPEDITION_SITES.filter(s=>s.rune).map(s=>{const p=runePosition(w,s);w.ensureChunkData(Math.floor(p.x/CFG.CHUNK),Math.floor(p.z/CFG.CHUNK));return w.getBlock(p.x,p.y,p.z)===58;});
    return this.runes;
  }
  answer(index) {
    const g=this.game,p=this.puzzle;if(!p)return false;
    const r=RUNE_RIDDLES.find(r=>r.id===p.id);
    if(!r||g.player.pos.distanceTo(new THREE.Vector3(p.x,p.y,p.z))>6||g.world.getBlock(p.x,p.y,p.z)!==p.id)return false;
    if(index!==r.correct){this.feedback=t('riddleRetry');return false;}
    changeAdventureBlock(g,p.x,p.y,p.z,58);this.feedback=t('riddleSolved');this.puzzle=null;g.adventure.fx.tone('reward');this.openCastle();return true;
  }
  openCastle() {
    const g=this.game,states=this.runeStates();if(g.net&&!NET.isHost)return;
    if(!states.every(Boolean))return;
    const s=EXPEDITION_SITES[3],y=siteFloor(g.world,s);
    g.world.batchEdit(()=>{for(let x=s.x-1;x<=s.x+1;x++)for(let h=1;h<=4;h++) {
      g.world.ensureChunkData(Math.floor(x/CFG.CHUNK),Math.floor((s.z+10)/CFG.CHUNK));
      if(g.world.getBlock(x,y+h,s.z+10)===59)changeAdventureBlock(g,x,y+h,s.z+10,0);
    }});
  }
  interact(target) {
    const g=this.game,p=target?.inside;if(!p)return false;
    const id=g.world.getBlock(p.x,p.y,p.z);
    if([55,56,57].includes(id)) {
      this.puzzle={...p,id};this.feedback='';g.adventure.book.page='riddle';g.adventure.book.show();return true;
    }
    if(id===58){g.ui.toast(t('riddleSolved'));return true;}
    if(id===59){g.ui.toast(t('castleLocked'));return true;}
    if(id===60) {
      if(!this.runeStates().every(Boolean)){g.ui.toast(t('castleLocked'));return true;}
      if(!this.data.castle){this.data.castle=true;g.inventory.add(61,1);g.inventory.add(113,3);g.adventure.fx.tone('reward');g.save();}
      g.ui.toast(t('castleVictory'),8000);return true;
    }
    if(id===62) {
      const key=`${p.x},${p.y},${p.z}`;
      if(!this.data.caches.includes(key)){this.data.caches.push(key);g.inventory.add(8,2);g.inventory.add(112,4);g.save();g.adventure.fx.tone('reward');}
      g.ui.toast(t('cacheFound'));return true;
    }
    return false;
  }
  petCommand(pet,action,extra={}) {
    if(!ownPet(this.game,pet))return false;
    if(action==='wait'&&this.travel.pet===pet)this.travel.dismount();
    const g=this.game,msg={action,mob:pet.netId,...extra};
    if(action==='feed') {
      if(pet.health>=pet.def.health)return false;
      const food={dog:104,cat:109,horse:117}[pet.species];
      if(!g.inventory.remove(food,1))return false;
    }
    if(g.net&&!NET.isHost)NET.send({t:'petaction',...msg});
    else g.adventure.petAction(msg,'local');
    if(action==='stroke'){g.adventure.fx.emit(pet.pos.x,pet.pos.y+1,pet.pos.z,2,5);g.adventure.fx.tone('reward');}
    g.save();return true;
  }
  recoverLegacyInventory() {
    const g=this.game;
    if(!g.map.canBuild||g.inventory.isFree()||!this.data.backpacks.length)return false;
    // Las mochilas guardadas contienen objetos que ya se retiraron del inventario.
    // Vaciar la lista y devolverlos en un único estado evita duplicar al recargar.
    const bags=this.data.backpacks;this.data.backpacks=[];
    for(const bag of bags)for(const [id,n] of bag.items)g.inventory.add(id,n);
    return true;
  }
  onDeath() {
    // La muerte conserva inventario y equipo; guardar también si se desconectan
    // desde la pantalla de reaparición. Las mochilas antiguas siguen recuperables.
    const g=this.game;this.travel.dismount();
    if(g.map.canBuild)g.save();
  }
  recover(index) {
    const g=this.game,bag=this.data.backpacks[index];
    if(!bag||g.player.dead||g.player.pos.distanceTo(new THREE.Vector3(bag.pos.x,bag.pos.y,bag.pos.z))>5)return false;
    this.data.backpacks.splice(index,1);
    for(const [id,n] of bag.items)g.inventory.add(id,n);
    g.adventure.fx.tone('reward');g.save();return true;
  }
  home() {
    const g=this.game;if(g.player.dead)return false;
    const destination=g.respawnPoint||g.spawn;g.world.update(destination.x,destination.z);
    const pos=safeTravelPosition(g.world,destination);if(!pos){g.ui.toast(t('noSafeHome'));return false;}
    this.travel.dismount();g.player.pos.copy(pos);g.player.vel.set(0,0,0);g.adventure.callPets();g.save();g.ui.toast(t('homeArrived'));return true;
  }
  update(dt) {
    const g=this.game;this.travel.update();this.clock+=dt;if(this.clock<.5)return;this.clock=0;
    const p=g.player;
    if(typeof document!=='undefined'){const coords=document.getElementById('coordinates');if(coords)coords.textContent=`X ${Math.floor(p.pos.x)} · Y ${Math.floor(p.pos.y)} · Z ${Math.floor(p.pos.z)}`;}
    if(p.onGround&&!p.inWater&&p.pos.y>1)this.lastSafe=p.pos.clone();
    for(const e of g.inventory.entries)if(e.count>0&&!this.data.materials.includes(String(e.id)))this.data.materials.push(String(e.id));
    for(const c of g.hittableCreatures())if(!c.dead&&c.species&&c.pos.distanceTo(p.pos)<12&&!this.data.animals.includes(c.species))this.data.animals.push(c.species);
    if(g.mapKey!=='creative')for(const s of EXPEDITION_SITES)if(Math.hypot(p.pos.x-s.x,p.pos.z-s.z)<12 && (s.key!=='crystalCave'||p.pos.y<siteFloor(g.world,s)+7)&&!this.data.places.includes(s.key))this.data.places.push(s.key);
    const realm=realmAt(p.pos.x,p.pos.z);if(realm&&!this.data.places.includes(realm.key))this.data.places.push(realm.key);
    this.openCastle();this.updateMarkers();
  }
  updateMarkers() {
    const key=JSON.stringify(this.data.backpacks.map(b=>b.pos));if(key===this.markerKey)return;this.markerKey=key;
    for(const marker of this.markers){this.game.scene.remove(marker);marker.geometry.dispose();marker.material.dispose();}this.markers=[];
    for(const bag of this.data.backpacks){
      const m=new THREE.Mesh(new THREE.BoxGeometry(.65,.8,.4),new THREE.MeshLambertMaterial({color:0xe6ad42}));
      m.position.set(bag.pos.x,bag.pos.y+.4,bag.pos.z);this.game.scene.add(m);this.markers.push(m);
    }
  }
  updatePreview(active) {
    const g=this.game;
    this.preview.visible=false;
    if(!active||g.selectedId()!==125){if(this.previewHint){g.ui.setHint('');this.previewHint=false;}return;}
    const target=g.targetBlock();if(!target)return;
    const p=target.outside,plan=g.adventure.housePlan(p);
    this.preview.visible=true;this.preview.position.set(p.x+.5,p.y+2.5,p.z+.5);
    this.preview.material.color.setHex(plan.error?0xe57561:0x74d282);
    g.ui.setHint(t(plan.error||'previewReady'));this.previewHint=true;
  }
  dispose(){this.travel.dispose();this.game.scene.remove(this.preview);this.preview.geometry.dispose();this.preview.material.dispose();for(const m of this.markers){this.game.scene.remove(m);m.geometry.dispose();m.material.dispose();}this.game.ui.setHint('');}
}
