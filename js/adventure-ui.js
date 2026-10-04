// Libro accesible con J: controles nativos, foco contenido y cierre con Escape.
class AdventureBook {
  constructor(game) {
    this.game=game;this.open=false;
    this.el=document.createElement('dialog');this.el.className='adventure-book';
    this.el.setAttribute('aria-labelledby','adventure-title');
    this.el.addEventListener('cancel',e=>{e.preventDefault();this.close();});
    this.el.addEventListener('keydown',e=>e.stopPropagation());
    document.body.append(this.el);
  }
  node(tag,text,parent=this.el) {const e=document.createElement(tag);if(text)e.textContent=text;parent.append(e);return e;}
  button(text,fn,parent=this.el) {const b=this.node('button',text,parent);b.type='button';b.className='btn';b.onclick=fn;return b;}
  show() {
    if(this.game.player.dead)return;
    if(this.open){this.render();this.el.scrollTop=0;return;}
    this.open=true;document.exitPointerLock();this.game.controls.keys.clear();this.render();this.el.showModal();this.el.scrollTop=0;
  }
  render() {
    const g=this.game,a=g.adventure;this.el.replaceChildren();
    const head=this.node('header');this.node('h1',t(this.page==='riddle'?'riddleTitle':this.page==='adopt'?'adoptTitle':'adventureTitle'),head).id='adventure-title';
    const close=this.button(t('backToGame'),()=>this.close(),head);close.classList.add('secondary');
    if(this.page==='adopt'){renderAdoption(this);return;}
    if(this.page==='riddle'){renderRiddle(this);return;}
    this.node('p',t('adventureIntro')).className='adventure-intro';
    expeditionNav(this);
    if(this.page!=='village'){renderExpeditionTab(this);return;}
    professionPanel(this);
    const section=this.node('section');this.node('h2',t('missionsTitle'),section);
    this.node('p',t('missionsHint'),section);
    const list=this.node('ol',null,section);
    for(const q of ADVENTURE_QUESTS) {
      const li=this.node('li',null,list),done=a.data.done.includes(q.key),active=a.currentQuest()===q;
      this.node('strong',(done?'✓ ':active?'→ ':'')+t(q.title),li);
      if(q.cost) this.node('p',q.cost.map(([id,n])=>`${nameOf(id)}: ${Math.min(g.inventory.count(id),n)}/${n}`).join(' · '),li);
      this.node('p',t('rewardLabel')+' '+q.reward.map(([id,n])=>`${nameOf(id)} ×${n}`).join(', '),li);
    }
    const near=g.hittableCreatures().some(c=>c.netType==='villager' && !c.dead && c.pos.distanceTo(g.player.pos)<6);
    const claim=this.button(t('deliverQuest'),()=>{if(a.completeQuest())this.render();},section);
    claim.disabled=!near || !a.canComplete(a.currentQuest());
    if(!near)this.node('p',t('findVillager'),section);
    const pets=this.node('section');this.node('h2',t('petsTitle'),pets);
    const owned=g.hittableCreatures().filter(c=>c.tamed && !c.dead && c.owner===(g.net&&!NET.isHost?NET.id:'local'));
    if(!owned.length)this.node('p',t('petsHint'),pets);
    for(const pet of owned) {
      const row=this.node('form',null,pets);row.className='pet-row';
      const label=this.node('label',t('pet_'+pet.species),row);
      const input=this.node('input',null,label);input.type='text';input.maxLength=20;input.value=pet.petName||'';input.placeholder=t('petName');
      const save=this.node('button',t('savePetName'),row);save.type='submit';save.className='btn secondary';
      row.onsubmit=e=>{e.preventDefault();a.renamePet(pet,input.value);save.textContent=t('savedPetName');};
    }
    const call=this.button(t('callPets'),()=>a.callPets(),pets);call.disabled=!owned.length;
    const settings=this.node('section');this.node('h2',t('playYourWay'),settings);
    const host=!g.net||NET.isHost;
    this.toggle(t('peacefulSetting'),g.worldRules.peaceful,v=>a.setRules({...g.worldRules,peaceful:v}),settings,!host);
    this.toggle(t('terrainSetting'),g.worldRules.terrainDamage,v=>a.setRules({...g.worldRules,terrainDamage:v}),settings,!host);
    if(!host)this.node('p',t('hostSettings'),settings);
    this.toggle(t('soundSetting'),a.soundEnabled,v=>{a.soundEnabled=v;},settings);
    this.toggle(t('effectsSetting'),a.effectsEnabled,v=>{a.effectsEnabled=v;},settings);
    const tips=this.node('section');this.node('h2',t('adventureTips'),tips);
    for(const key of ['farmInstructions','portalInstructions','buildInstructions'])this.node('p',t(key),tips);
  }
  toggle(text,checked,change,parent,disabled=false) {
    const label=this.node('label',null,parent);label.className='adventure-toggle';
    const input=this.node('input',null,label);input.type='checkbox';input.checked=checked;input.disabled=disabled;
    input.onchange=()=>change(input.checked);this.node('span',text,label);
  }
  close() {if(!this.open)return;this.open=false;this.el.close();this.game.controls.keys.clear();this.game.relockOnClose()();}
  dispose() {this.open=false;this.el.remove();}
}
