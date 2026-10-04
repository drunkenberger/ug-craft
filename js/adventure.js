// Progreso personal, granjas, portales y construcción asistida.
const ADVENTURE_QUESTS = [
  {key:'wood', title:'questWood', cost:[[5,8]], reward:[[119,6],[120,3]]},
  {key:'farm', title:'questFarm', cost:[[121,6]], reward:[[8,2],[122,3]]},
  {key:'pet', title:'questPet', test:g=>g.adventure.data.adopted, reward:[[124,1],[125,1]]},
  {key:'portal', title:'questPortal', test:g=>g.adventure.data.visited, reward:[[53,8],[113,2]]},
];
const DEFAULT_WORLD_RULES = {peaceful:false, terrainDamage:true};
function normalizeWorldRules(r={}) {
  r=r||{};
  return {peaceful:r.peaceful===true,terrainDamage:r.terrainDamage!==false};
}
function serializePets(game) {
  return game.hittableCreatures().filter(c=>c.tamed && !c.dead &&
    c.owner===(game.net && !NET.isHost ? NET.id : 'local'))
    .map(c=>[c.pos.x,c.pos.y,c.pos.z,c.species,c.petName || '',petState(c)]);
}
function restorePets(game,entries,owner='local') {
  if(!game.animals || !Array.isArray(entries)) return;
  // Reintentar la restauración nunca duplica los animales del mismo dueño.
  if(game.animals.animals.some(c=>c.tamed && c.owner===owner && !c.dead)) return;
  for(const pet of entries.slice(0,12)) {
    if(!Array.isArray(pet) || !pet.slice(0,3).every(Number.isFinite)) continue;
    game.animals.spawnPet(pet[0],pet[1],pet[2],pet[3],pet[4],owner,pet[5]);
  }
}
function changeAdventureBlock(game,x,y,z,id) {
  game.world.ensureChunkData(Math.floor(x/CFG.CHUNK),Math.floor(z/CFG.CHUNK));
  game.world.setBlock(x,y,z,id); trackBlockChange(game,x,y,z,id);
  if(game.net) NET.send({t:'block',x,y,z,id});
}
class Adventure {
  constructor(game,saved={}) {
    this.game=game;
    this.restore(saved);
    this.cropClock=0; this.cropTimers=new Map();
    this.soundEnabled=saved.soundEnabled!==false; this.effectsEnabled=saved.effectsEnabled!==false;
    this.fx=new AdventureEffects(game);
  }
  restore(saved={}) {
    this.soundEnabled=saved.soundEnabled!==false;this.effectsEnabled=saved.effectsEnabled!==false;
    this.data={done:Array.isArray(saved.done) ? saved.done.filter(k=>ADVENTURE_QUESTS.some(q=>q.key===k)) : [],
      adopted:!!saved.adopted,visited:!!saved.visited,
      returnPos:saved.returnPos && ['x','y','z'].every(k=>Number.isFinite(saved.returnPos[k])) ? saved.returnPos : null};
  }
  serialize() {return {...this.data,armor:this.game.armor?.serialize(),journey:this.game.expedition?.serialize(),soundEnabled:this.soundEnabled,effectsEnabled:this.effectsEnabled};}
  adopt(creature) {
    const g=this.game,food={dog:118,cat:109,horse:117}[creature?.species];
    if(!food||creature.dead||creature.tamed||g.player.dead||creature.pos.distanceTo(g.player.pos)>6)return false;
    if(serializePets(g).length>=12){g.ui.toast(t('petLimit'));return false;}
    if(!g.inventory.remove(food,1))return false;
    g.tameDog(creature);this.data.adopted=true;g.save();return true;
  }
  currentQuest() {return ADVENTURE_QUESTS.find(q=>!this.data.done.includes(q.key));}
  canComplete(q) {
    const g=this.game;
    return !!q && !this.data.done.includes(q.key) && (q.cost ? g.inventory.canAfford(q.cost) : q.test(g));
  }
  completeQuest() {
    const g=this.game,q=this.currentQuest();
    const villager=g.hittableCreatures().some(c=>c.netType==='villager' && !c.dead && c.pos.distanceTo(g.player.pos)<6);
    if(!villager || !this.canComplete(q)) return false;
    if(q.cost) g.inventory.pay(q.cost);
    this.data.done.push(q.key); for(const [id,n] of q.reward) g.inventory.add(id,n);
    this.fx.tone('reward'); g.ui.toast(t('questThanks'),5000);g.save();return true;
  }
  update(dt) {
    this.fx.update(dt);
    this.game.expedition?.update(dt);
    if(this.game.net && !NET.isHost) return;
    this.cropClock+=dt;if(this.cropClock<1) return;
    const elapsed=this.cropClock;this.cropClock=0;
    const w=this.game.world;
    for(const [k,id] of Object.entries(w.edits)) {
      if(id!==42 && id!==44) continue;
      const [x,y,z]=k.split(',').map(Number);
      if(!w.chunks.has(w.key(Math.floor(x/CFG.CHUNK),Math.floor(z/CFG.CHUNK)))) continue;
      if(w.getBlock(x,y-1,z)!==41) { changeAdventureBlock(this.game,x,y,z,0);this.cropTimers.delete(k);continue; }
      // Necesitan cielo libre y agua en las cuatro casillas alrededor.
      let sky=true,water=false;
      for(let h=y+1;h<CFG.HEIGHT;h++) if(w.isSolid(x,h,z)) {sky=false;break;}
      for(let a=-4;a<=4;a++) for(let b=-4;b<=4;b++) if(w.getBlock(x+a,y-1,z+b)===17) water=true;
      if(!sky || !water) continue;
      const age=(this.cropTimers.get(k)||0)+elapsed;
      if(age>=45) {changeAdventureBlock(this.game,x,y,z,id+1);this.cropTimers.delete(k);}
      else this.cropTimers.set(k,age);
    }
    for(const k of this.cropTimers.keys()) if(![42,44].includes(w.edits[k])) this.cropTimers.delete(k);
  }
  portal() {
    if(this.game.player.dead||!this.game.map.canBuild)return false;
    this.book.page='worlds';this.book.show();return true;
  }
  travelWorld(key) {
    const g=this.game,p=g.player,r=REALMS.find(r=>r.key===key);
    if(p.dead||!g.map.canBuild||(!r&&key!=='home'))return false;
    const inside=isAdventureZone(p.pos.x,p.pos.z);
    if(!r&&!inside)return false;
    g.expedition?.travel.dismount();
    const destination=r?{x:r.center+.5,y:r.floor+1.02,z:r.center+3.5}:
      (this.data.returnPos||g.respawnPoint||g.spawn);
    g.world.update(destination.x,destination.z);
    const safe=safeTravelPosition(g.world,destination);
    if(!safe){g.ui.toast(t('worldBlocked'));return false;}
    if(r&&!inside)this.data.returnPos={x:p.pos.x,y:p.pos.y,z:p.pos.z};
    p.pos.copy(safe);p.vel.set(0,0,0);p.sitting=false;p.onGround=false;
    if(r){this.data.visited=true;if(g.expedition&&!g.expedition.data.places.includes(r.key))g.expedition.data.places.push(r.key);}
    this.callPets();this.fx.tone('portal');g.ui.toast(t(r?'place_'+r.key:'portalBack'),6000);g.save();return true;
  }
  callPets() {
    const g=this.game;
    if(g.net && !NET.isHost) NET.send({t:'petaction',action:'call'});
    else this.petAction({action:'call'},'local');
    this.fx.tone('whistle');
  }
  petAction(msg,owner) {
    const g=this.game;
    if(!g.animals) return;
    const target=owner==='local' ? g.player : g.avatars.get(owner);
    if(!target) return;
    for(const pet of g.animals.animals) {
      if(!pet.tamed || pet.owner!==owner || pet.dead) continue;
      if(pet.netId===msg.mob) {
        if(msg.action==='rename')pet.setPetName(msg.name);
        if(msg.action==='wait'){pet.waiting=!pet.waiting;pet.rider=null;}
        if(msg.action==='collar'&&COLLAR_COLORS[msg.color])pet.setCollar(msg.color);
        if(msg.action==='stroke')pet.loveTimer=4;
        if(msg.action==='feed')pet.health=Math.min(pet.def.health,pet.health+2);
        if(msg.action==='mount'&&pet.species==='horse'&&pet.pos.distanceTo(target.pos)<6){pet.rider=owner;pet.waiting=false;}
        if(msg.action==='dismount')pet.rider=null;
      }
      if(msg.action==='call') {
        pet.waiting=false;
        const desired=target.pos.clone().add(new THREE.Vector3(1.5,.2,1.5));
        const safe=typeof safeTravelPosition==='function'?safeTravelPosition(g.world,desired):desired;
        if(!safe)continue;
        pet.pos.copy(safe);
        pet.vel.set(0,0,0);pet.group.position.copy(pet.pos);
      }
    }
  }
  renamePet(pet,name) {
    const g=this.game;
    if(g.net && !NET.isHost) NET.send({t:'petaction',action:'rename',mob:pet.netId,name});
    else this.petAction({action:'rename',mob:pet.netId,name},'local');
    pet.setPetName(name);g.save();
  }
  setRules(rules) {
    const g=this.game;if(g.net && !NET.isHost) return;
    g.worldRules=normalizeWorldRules(rules);
    if(g.net) NET.send({t:'rules',rules:g.worldRules});
    g.save();
  }
  housePlan(spot) {
    const g=this.game,w=g.world;
    const x=spot.x-2,y=spot.y,z=spot.z-2;
    if(y<1 || y+5>=CFG.HEIGHT) return {error:'blueprintSpace'};
    const edits=[];
    // Validar todo antes de gastar el plano o cambiar un bloque.
    for(let a=0;a<5;a++) for(let b=0;b<5;b++) {
      w.ensureChunkData(Math.floor((x+a)/CFG.CHUNK),Math.floor((z+b)/CFG.CHUNK));
      if(!blockOpaque(w.getBlock(x+a,y-1,z+b))) {return {error:'blueprintFlat'};}
      for(let h=0;h<=4;h++) {
        const id=w.getBlock(x+a,y+h,z+b);
        if(id && ![20,21].includes(id)) {return {error:'blueprintSpace'};}
        if(g.player.wouldCollide(x+a,y+h,z+b) || g.hittableCreatures().some(c=>!c.dead&&bodyIntersectsBlock(c,x+a,y+h,z+b)) || [...g.avatars.values()].some(av=>bodyIntersectsBlock({pos:av.pos,halfW:.3,height:1.8},x+a,y+h,z+b))) {
          return {error:'blueprintSpace'};
        }
        const wall=a===0||a===4||b===0||b===4;
        let block=h===0 ? 7 : h===4 ? 32 : wall ? 7 : 0;
        if(b===4 && a===2 && (h===1||h===2)) block=46;
        if(h===2 && ((b===0 && a===2)||(a===0 && b===2)||(a===4 && b===2))) block=31;
        if(block) edits.push([x+a,y+h,z+b,block]);
      }
    }
    return {edits};
  }
  buildHouse(spot) {
    const g=this.game,w=g.world,plan=this.housePlan(spot);
    if(plan.error){g.ui.toast(t(plan.error));return false;}
    if(!g.inventory.remove(125,1))return false;
    const edits=plan.edits;
    w.batchEdit(()=>{for(const e of edits) changeAdventureBlock(g,...e);});
    this.fx.tone('place');g.ui.toast(t('houseBuilt'));return true;
  }
  dispose() {this.fx.dispose(); if(this.book) this.book.dispose();}
}

function adventureRightClick(g,creature,target) {
  const selected=g.selectedId(),item=ITEMS[selected];
  if(target&&g.world.getBlock(target.inside.x,target.inside.y,target.inside.z)===50){g.adventure.portal();return true;}
  if(target&&[55,56,57].includes(g.world.getBlock(target.inside.x,target.inside.y,target.inside.z)))return g.expedition.interact(target);
  if(item?.kind==='armor'){g.armor.equip(selected);return true;}
  if(creature?.netType==='villager') {g.adventure.book.page='village';g.adventure.book.show();return true;}
  if(creature?.tamed) {
    if(item?.kind==='saddle' && creature.species==='horse')g.expedition.travel.mount(creature);
    else {g.adventure.book.page='pets';g.adventure.book.show();}
    return true;
  }
  if(item?.kind==='boat'){g.expedition.travel.sail();return true;}
  if(g.expedition?.interact(target))return true;
  if(creature && ['dog','cat','horse'].includes(creature.species)) {
    const food={dog:118,cat:109,horse:117}[creature.species];
    if(Number(selected)===food&&g.adventure.adopt(creature))return true;
    g.adventure.adoptionTarget=creature;g.adventure.book.page='adopt';g.adventure.book.show();
    return true;
  }
  if(item?.kind==='whistle') {g.adventure.callPets();return true;}
  if(!target)return false;
  const {x,y,z}=target.inside,id=g.world.getBlock(x,y,z);
  if(id===50) {g.adventure.portal();return true;}
  if(id===46 || id===47) {
    const cells=[[x,y,z]];
    for(const dy of [-1,1]) if(g.world.getBlock(x,y+dy,z)===id)cells.push([x,y+dy,z]);
    if(id===47 && cells.some(([a,b,c])=>g.player.wouldCollide(a,b,c) || [...g.avatars.values()].some(av=>bodyIntersectsBlock({pos:av.pos,halfW:.3,height:1.8},a,b,c)))) {
      g.ui.toast(t('doorBlocked'));return true;
    }
    g.world.batchEdit(()=>{for(const [a,b,c] of cells)changeAdventureBlock(g,a,b,c,id===46?47:46);});
    g.adventure.fx.tone('wood');return true;
  }
  if(id===43 || id===45) {
    changeAdventureBlock(g,x,y,z,0);
    g.inventory.add(id===43?121:120,id===43?2:3);
    if(id===43)g.inventory.add(119,2);
    g.adventure.fx.tone('reward');return true;
  }
  if(id===42 || id===44) {g.ui.toast(t('cropWait'),5000);return true;}
  if(item?.kind==='hoe') {
    if((id===1||id===2) && !g.world.isSolid(x,y+1,z))changeAdventureBlock(g,x,y,z,41);
    return true;
  }
  if(item?.kind==='seed') {
    if(id!==41){g.ui.toast(t('needFarmland'));return true;}
    if(y+1>=CFG.HEIGHT || g.world.getBlock(x,y+1,z)!==0)return true;
    if(g.inventory.remove(selected,1))changeAdventureBlock(g,x,y+1,z,item.crop);
    return true;
  }
  if(item?.kind==='blueprint') {g.adventure.buildHouse(target.outside);return true;}
  if(selected===48 && id===48 && target.outside.y>y) {
    if(!g.player.wouldCollide(x,y,z)&&![...g.avatars.values()].some(av=>bodyIntersectsBlock({pos:av.pos,halfW:.3,height:1.8},x,y,z))&&g.inventory.remove(48,1))changeAdventureBlock(g,x,y,z,7);
    return true;
  }
  if(selected===46) {
    const p=target.outside;
    if(p.y<1 || p.y+1>=CFG.HEIGHT)return true;
    if([0,1].some(d=>g.world.getBlock(p.x,p.y+d,p.z)!==0 || g.player.wouldCollide(p.x,p.y+d,p.z))) {
      g.ui.toast(t('doorBlocked'));return true;
    }
    if(g.inventory.remove(46,1))g.world.batchEdit(()=>{for(const d of [0,1])changeAdventureBlock(g,p.x,p.y+d,p.z,46);});
    return true;
  }
  return false;
}
function adventureBreak(g,x,y,z,id) {
  if(id===46||id===47) {
    const cells=[[x,y,z]];
    for(const d of [-1,1])if([46,47].includes(g.world.getBlock(x,y+d,z)))cells.push([x,y+d,z]);
    g.world.batchEdit(()=>{for(const p of cells)changeAdventureBlock(g,...p,0);});
    g.inventory.add(46,1);return true;
  }
  if(id===41 && [42,43,44,45].includes(g.world.getBlock(x,y+1,z))) {
    const crop=g.world.getBlock(x,y+1,z);
    changeAdventureBlock(g,x,y+1,z,0);g.inventory.add(crop<=43?119:120,1);
  }
  return false;
}
