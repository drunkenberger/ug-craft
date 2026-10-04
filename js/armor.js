// Equipo personal: se conserva al reaparecer y se guarda con la aventura.
class Armor {
  constructor(game,saved) {this.game=game;this.restore(saved);}
  restore(saved) {this.slots=normalizeArmor(saved);}
  serialize() {return {...this.slots};}
  protection() {return Object.values(this.slots).reduce((sum,id)=>sum+ITEMS[id].protection,0);}
  appearance() {return {...Character.appearance(),armor:this.serialize()};}
  equip(id) {
    const g=this.game,item=ITEMS[id];
    if(g.player.dead||!g.map.canBuild||item?.kind!=='armor'||this.slots[item.slot]===id||!g.inventory.remove(id,1))return false;
    const old=this.slots[item.slot];this.slots[item.slot]=id;
    if(old)g.inventory.add(old,1);
    this.changed();return true;
  }
  unequip(slot) {
    if(this.game.player.dead||!this.slots[slot])return false;
    const id=this.slots[slot];delete this.slots[slot];this.game.inventory.add(id,1);this.changed();return true;
  }
  changed() {
    const g=this.game;
    if(g.ownAvatar)g.ownAvatar.build(this.appearance());
    if(g.net)NET.send({t:'skin',app:this.appearance()});
    g.save();
  }
}
function renderArmorTab(book,section) {
  const g=book.game,a=g.armor;
  book.node('h2',t('tab_armor'),section);
  book.node('p',t('armorHint'),section);
  book.node('strong',t('armorProtection')+' '+Math.round(a.protection()*100)+'%',section);
  for(const slot of ARMOR_SLOTS) {
    const details=book.node('details',null,section);details.open=true;
    book.node('summary',t('armor_'+slot)+' · '+(a.slots[slot]?nameOf(a.slots[slot]):t('armorEmpty')),details);
    if(a.slots[slot])book.button(t('armorRemove'),()=>{a.unequip(slot);book.render();},details);
    for(const [id,item] of Object.entries(ITEMS).filter(([,item])=>item.kind==='armor'&&item.slot===slot)) {
      const recipe=RECIPES.find(r=>r.out.id===Number(id));
      book.node('p',nameOf(Number(id))+' · '+recipe.cost.map(([material,n])=>nameOf(material)+' ×'+n).join(', '),details);
      const button=book.button(t('armorEquip')+' '+nameOf(Number(id)),()=>{a.equip(Number(id));book.render();},details);
      button.disabled=a.slots[slot]===Number(id)||g.inventory.count(Number(id))<1;
    }
  }
}
