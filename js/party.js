// Compartir la identidad exacta de la partida, no solamente su número visible.
function sharedGameLink(game) {
  if(!game.gameId||!game.net)return null;
  const url=new URL(location.href);url.search='';url.hash='';
  url.searchParams.set('map',game.mapKey);url.searchParams.set('game',game.gameId);
  return url.href;
}
function joinCompanion(game,id) {
  const peer=game.avatars.get(id);
  if(!game.net||!NET.active()||!peer||peer.pos.y<0||game.player.dead)return false;
  game.expedition.travel.dismount();
  const p=game.player.pos,previous={x:p.x,y:p.y,z:p.z};
  const destination={x:peer.pos.x+2,y:peer.pos.y,z:peer.pos.z};
  game.world.update(destination.x,destination.z);
  const safe=safeTravelPosition(game.world,destination);
  if(!safe){game.ui.toast(t('noSafeHome'));return false;}
  if(!isAdventureZone(p.x,p.z)&&isAdventureZone(safe.x,safe.z))game.adventure.data.returnPos=previous;
  p.copy(safe);game.player.vel.set(0,0,0);game.player.sitting=false;
  game.adventure.callPets();game.save();return true;
}
function renderPartyTab(book,section) {
  const g=book.game;
  book.node('h2',t('tab_party'),section);
  book.node('p',g.net?`${t('partyServer')} ${location.host} · ${g.gameId||g.mapKey}`:t('partyLocal'),section);
  if(!g.net)return;
  book.node('p',NET.active()?`${t('partyOnline')} ${g.avatars.size+1}`:t('partyDisconnected'),section);
  const link=sharedGameLink(g);
  if(link) {
    book.node('p',t('partyInviteHint'),section);
    const label=book.node('label',t('partyLink'),section),input=book.node('input',null,label);
    input.value=link;input.readOnly=true;input.style.width='100%';input.style.boxSizing='border-box';input.onclick=()=>input.select();
  }
  if(!g.avatars.size)book.node('p',t('partyAlone'),section);
  for(const [id,peer] of g.avatars) {
    const distance=Math.round(peer.pos.distanceTo(g.player.pos));
    book.node('p',`${t('partyCompanion')} ${id} · ${distance} ${t('partyBlocks')}`,section);
    const button=book.button(t('partyMeet'),()=>{if(joinCompanion(g,id))book.close();},section);
    button.disabled=!NET.active()||peer.pos.y<0;
  }
  book.button(t('partyRefresh'),()=>book.render(),section);
}
