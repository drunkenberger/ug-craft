function expeditionNav(book) {
  book.page=book.page||'journey';
  const nav=book.node('nav');nav.className='adventure-nav';nav.setAttribute('aria-label',t('bookSections'));
  for(const page of ['journey','party','worlds','armor','village','pets','album']) {
    const button=book.button(t('tab_'+page),()=>{book.page=page;book.render();book.el.querySelector('[aria-current="page"]')?.focus();},nav);
    if(book.page===page)button.setAttribute('aria-current','page');
  }
}
function professionPanel(book) {
  const g=book.game,e=g.expedition,section=book.node('section');book.node('h2',t('professionsTitle'),section);
  for(const [role,definition] of Object.entries(PROFESSIONS)) {
    const details=book.node('details',null,section);details.open=!!e.nearProfession(role);
    book.node('summary',t('profession_'+role),details);
    book.node('p',t('job_'+role),details);
    const costs=cost=>cost.map(([id,n])=>`${nameOf(id)} ×${n}`).join(', ');
    book.node('p',costs(definition.trade.cost)+' → '+nameOf(definition.trade.out[0])+' ×'+definition.trade.out[1],details);
    const trade=book.button(t('tradeProfession'),()=>{e.profession(role);book.render();},details);
    trade.disabled=!e.nearProfession(role)||!g.inventory.canAfford(definition.trade.cost);
    const mission=book.button(e.data.jobs.includes(role)?t('jobDone'):t('deliverProfession'),()=>{e.profession(role,true);book.render();},details);
    mission.disabled=!e.nearProfession(role)||e.data.jobs.includes(role)||!g.inventory.canAfford(definition.mission.cost);
    book.node('p',t('rewardLabel')+' '+costs(definition.mission.reward),details);
  }
}
function renderExpeditionTab(book) {
  const g=book.game,e=g.expedition,section=book.node('section');
  if(book.page==='party')renderPartyTab(book,section);
  if(book.page==='armor')renderArmorTab(book,section);
  if(book.page==='worlds') {
    const current=realmAt(g.player.pos.x,g.player.pos.z);
    book.node('h2',t('tab_worlds'),section);book.node('p',t('worldsHint'),section);
    book.node('strong',t('worldCurrent')+' '+t(current?'place_'+current.key:'worldHome'),section);
    if(current)book.button(t('worldReturn'),()=>{if(g.adventure.travelWorld('home'))book.close();},section);
    for(const realm of REALMS) {
      const details=book.node('details',null,section);details.open=true;
      book.node('summary',t('place_'+realm.key),details);book.node('p',t('world_'+realm.key),details);
      const button=book.button(t('worldVisit')+' '+t('place_'+realm.key),()=>{if(g.adventure.travelWorld(realm.key))book.close();},details);
      button.disabled=current===realm;
    }
  }
  if(book.page==='journey') {
    if(e.puzzle&&g.world.getBlock(e.puzzle.x,e.puzzle.y,e.puzzle.z)===58){e.puzzle=null;e.feedback=t('riddleSolved');}
    book.node('h2',t('familyAdventure'),section);book.node('p',t(g.mapKey==='creative'?'creativeJourney':'castleStory'),section);
    if(e.puzzle) {
      const r=RUNE_RIDDLES.find(r=>r.id===e.puzzle.id);
      book.node('h3',t(r.key),section);
      for(let i=0;i<r.answers.length;i++)book.button(t(r.answers[i]),()=>{e.answer(i);book.render();},section);
    }
    if(e.feedback)book.node('p',e.feedback,section).setAttribute('role','status');
    const states=e.runeStates();
    const route=book.node('ol',null,section);
    EXPEDITION_SITES.forEach((site,i)=>book.node('li',`${i<3?(states[i]?'✓ ':'○ '):'♜ '}${t('place_'+site.key)} · X ${site.x}, Z ${site.z}`,route));
    book.node('p',t(states.every(Boolean)?'castleOpen':'castleCoop'),section);
    if(e.data.castle)book.node('strong',t('castleVictory'),section);
    const rescue=book.node('section');book.node('h2',t('rescueTitle'),rescue);
    book.button(t('returnHome'),()=>{if(e.home())book.close();},rescue);
    if(!e.data.backpacks.length)book.node('p',t('noBackpack'),rescue);
    e.data.backpacks.forEach((bag,i)=>{
      book.node('p',`${t('backpackLabel')} ${i+1} · X ${Math.floor(bag.pos.x)}, Y ${Math.floor(bag.pos.y)}, Z ${Math.floor(bag.pos.z)}`,rescue);
      const recover=book.button(t('recoverBackpack'),()=>{e.recover(i);book.render();},rescue);
      recover.disabled=g.player.pos.distanceTo(new THREE.Vector3(bag.pos.x,bag.pos.y,bag.pos.z))>5;
    });
    const help=book.node('section');book.node('h2',t('newControls'),help);
    for(const key of ['ridingHelp','boatHelp','previewHelp'])book.node('p',t(key),help);
    if(e.travel.mode)book.button(t('dismount'),()=>{e.travel.dismount();book.render();},help);
  }
  if(book.page==='pets') {
    book.node('h2',t('petsTitle'),section);book.node('p',t('petsHint'),section);
    const pets=g.hittableCreatures().filter(p=>ownPet(g,p));
    if(!pets.length)book.node('p',t('noCompanion'),section);
    for(const pet of pets) {
      const details=book.node('details',null,section);details.open=true;
      book.node('summary',pet.petName||t('pet_'+pet.species),details);
      const form=book.node('form',null,details);form.className='pet-row';
      const label=book.node('label',t('petName'),form),input=book.node('input',null,label);
      input.maxLength=20;input.value=pet.petName||'';
      const save=book.node('button',t('savePetName'),form);save.className='btn secondary';save.type='submit';
      form.onsubmit=event=>{event.preventDefault();g.adventure.renamePet(pet,input.value);save.textContent=t('savedPetName');};
      book.node('p',`${t('healthLabel')} ${pet.health}/${pet.def.health}`,details);
      const collarLabel=book.node('label',t('collarLabel'),details),select=book.node('select',null,collarLabel);
      for(const key of Object.keys(COLLAR_COLORS)){const option=book.node('option',t('collar_'+key),select);option.value=key;}
      select.value=pet.collarColor||'red';select.onchange=()=>e.petCommand(pet,'collar',{color:select.value});
      book.button(t('strokePet'),()=>e.petCommand(pet,'stroke'),details);
      book.button(t(pet.waiting?'followPet':'sitPet'),()=>{e.petCommand(pet,'wait');if(g.net&&!NET.isHost)pet.waiting=!pet.waiting;book.render();},details);
      const food={dog:104,cat:109,horse:117}[pet.species];
      const feed=book.button(t('feedPet')+' · '+nameOf(food),()=>{if(e.petCommand(pet,'feed')&&g.net&&!NET.isHost)pet.health=Math.min(pet.def.health,pet.health+2);book.render();},details);
      feed.disabled=pet.health>=pet.def.health||g.inventory.count(food)<1;
      if(pet.species==='horse') {
        const ride=book.button(t('rideHorse'),()=>{if(e.travel.mount(pet))book.close();},details);
        ride.disabled=g.inventory.count(127)<1||pet.pos.distanceTo(g.player.pos)>5;
      }
    }
    const call=book.button(t('callPets'),()=>g.adventure.callPets(),section);call.disabled=!pets.length;
  }
  if(book.page==='album') {
    book.node('h2',t('albumTitle'),section);book.node('p',t('albumHint'),section);
    const medals=[['medalCollector',e.data.materials.length>=12],['medalFriend',e.data.animals.length>=3],['medalExplorer',e.data.places.length>=3],['medalCastle',e.data.castle]];
    const list=book.node('ul',null,section);for(const [key,done] of medals)book.node('li',(done?'🏅 ':'○ ')+t(key),list);
    for(const [key,entries] of [['albumPlaces',e.data.places.map(p=>t('place_'+p))],['albumAnimals',e.data.animals.map(p=>t('pet_'+p))],['albumMaterials',e.data.materials.filter(id=>defOf(Number(id))).map(id=>nameOf(Number(id)))]]) {
      const details=book.node('details',null,section);details.open=key==='albumPlaces';book.node('summary',t(key)+' · '+entries.length,details);
      book.node('p',entries.length?entries.join(' · '):t('albumEmpty'),details);
    }
  }
}

// La interacción con la runa presenta primero la pregunta y sus respuestas.
function renderRiddle(book) {
  const e=book.game.expedition,section=book.node('section');
  if(e.puzzle&&book.game.world.getBlock(e.puzzle.x,e.puzzle.y,e.puzzle.z)===58){e.puzzle=null;e.feedback=t('riddleSolved');}
  const r=e.puzzle&&RUNE_RIDDLES.find(r=>r.id===e.puzzle.id);
  if(r) {
    book.node('h2',t(r.key),section);
    for(let i=0;i<r.answers.length;i++)book.button(t(r.answers[i]),()=>{e.answer(i);book.render();},section);
  }
  if(e.feedback)book.node('p',e.feedback,section).setAttribute('role','status');
  book.button(t('riddleBook'),()=>{book.page='journey';book.render();book.el.scrollTop=0;},section);
}

function renderAdoption(book) {
  const g=book.game,pet=g.adventure.adoptionTarget,food={dog:118,cat:109,horse:117}[pet?.species];
  if(!food)return;
  const section=book.node('section');book.node('h2',t('pet_'+pet.species),section);
  book.node('p',t('adoptRequires')+' '+nameOf(food)+' ×1',section);
  book.node('p',t('adoptAvailable')+' '+(g.inventory.isFree()?'∞':g.inventory.count(food)),section);
  const button=book.button(t('adoptButton')+' '+t('pet_'+pet.species),()=>{
    if(g.adventure.adopt(pet)){book.page='pets';book.render();}else book.render();
  },section);
  button.disabled=pet.dead||pet.tamed||pet.pos.distanceTo(g.player.pos)>6||g.inventory.count(food)<1||serializePets(g).length>=12;
  book.node('p',t('adoptHint'),section);
}
