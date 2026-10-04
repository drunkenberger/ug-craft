// Lugares fijos de la aventura cooperativa. Las runas resueltas son bloques
// persistentes: cualquier jugador puede aportar una llave a la misma partida.
const EXPEDITION_SITES = [
  {key:'crystalCave',x:80,z:8,rune:55},
  {key:'watchtower',x:88,z:72,rune:56},
  {key:'forestShrine',x:20,z:80,rune:57},
  {key:'castle',x:128,z:40},
];
function siteFloor(world,site) {
  const h=survivalHeightAt(world,site.x,site.z);
  return site.key==='crystalCave' ? Math.max(8,h-9) : Math.min(40,Math.max(CFG.SEA_LEVEL+2,h));
}
function runePosition(world,site) {return {x:site.x,y:siteFloor(world,site)+1,z:site.z};}
function generateExpeditionSites(world,cx,cz,data) {
  const put=(wx,y,wz,id)=>{
    const x=wx-cx*CFG.CHUNK,z=wz-cz*CFG.CHUNK;
    if(x>=0&&x<CFG.CHUNK&&z>=0&&z<CFG.CHUNK&&y>0&&y<CFG.HEIGHT)data[world.blockIndex(x,y,z)]=id;
  };
  for(const site of EXPEDITION_SITES) {
    const radius=site.key==='castle'?12:site.key==='crystalCave'?20:6;
    if(cx*CFG.CHUNK>site.x+radius || (cx+1)*CFG.CHUNK<=site.x-radius || cz*CFG.CHUNK>site.z+radius || (cz+1)*CFG.CHUNK<=site.z-radius)continue;
    const h=siteFloor(world,site);
    for(let x=cx*CFG.CHUNK;x<(cx+1)*CFG.CHUNK;x++)for(let z=cz*CFG.CHUNK;z<(cz+1)*CFG.CHUNK;z++) {
      const a=x-site.x,b=z-site.z;
      if(site.key==='crystalCave') {
        if(a*a+b*b<=64) {
          put(x,h,z,39);
          for(let y=h+1;y<=h+6;y++)put(x,y,z,0);
          if(a*a+b*b>42 && hash2D(x,z,743)<.28)put(x,h+1,z,54);
          if(Math.abs(a)===5 && b===0)put(x,h+2,z,53);
        }
        // Pasillo escalonado que abre hasta la superficie, accesible sin cavar.
        if(Math.abs(a)<=1 && b>=5 && b<=20) {
          const step=Math.min(survivalHeightAt(world,x,z),h+Math.max(0,b-7));
          for(let y=h;y<=step;y++)put(x,y,z,39);for(let y=step+1;y<CFG.HEIGHT;y++)put(x,y,z,0);
        }
        continue;
      }
      if(site.key==='castle') {
        if(Math.abs(a)>10||Math.abs(b)>10)continue;
        for(let y=1;y<h;y++)put(x,y,z,3);
        for(let y=h;y<h+14;y++)put(x,y,z,y===h?32:0);
        const wall=Math.abs(a)===10||Math.abs(b)===10;
        const tower=Math.abs(a)>=8&&Math.abs(b)>=8;
        if(wall||tower)for(let y=1;y<=(tower?11:6);y++)put(x,h+y,z,38);
        if(wall && (a+b)%2===0)put(x,h+7,z,32);
        if(b===10&&Math.abs(a)<=1)for(let y=1;y<=4;y++)put(x,h+y,z,59);
        if(b===-7&&Math.abs(a)<=2)put(x,h+1,z,35);
        if(Math.abs(a)===7&&Math.abs(b)===7)put(x,h+1,z,53);
        continue;
      }
      if(Math.abs(a)>5||Math.abs(b)>5)continue;
      for(let y=1;y<h;y++)put(x,y,z,2);
      for(let y=h;y<=h+9;y++)put(x,y,z,y===h?38:0);
      if(Math.abs(a)===4&&Math.abs(b)===4)for(let y=1;y<=5;y++)put(x,h+y,z,site.key==='watchtower'?32:5);
      if(site.key==='watchtower' && (Math.abs(a)===4||Math.abs(b)===4))put(x,h+6,z,32);
      if(site.key==='forestShrine' && Math.abs(a)<=4&&Math.abs(b)<=4)put(x,h+7,z,6);
    }
    if(site.rune)put(site.x,h+1,site.z,site.rune);
    if(site.key==='crystalCave')put(site.x+3,h+1,site.z-3,62);
    if(site.key==='castle')put(site.x,h+2,site.z-7,60);
  }
}
