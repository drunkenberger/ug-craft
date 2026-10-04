// Efectos pequeños y acotados, sin audio descargado ni temporizadores externos.
class AdventureEffects {
  constructor(game) {
    this.game=game;this.particles=[];this.clock=0;this.smokeClock=0;this.stepClock=0;
    this.geo=new THREE.BoxGeometry(.12,.12,.12);
    this.materials=[0xb8b4ba,0xffb64f,0xd8b5ff].map(color=>new THREE.MeshBasicMaterial({color,transparent:true}));
    this.audio=null;
    this.reducedMotion=typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  tone(kind) {
    if(!this.game.adventure?.soundEnabled || typeof window==='undefined') return;
    try {
      const Audio=window.AudioContext || window.webkitAudioContext;
      if(!Audio) return;
      if(!this.audio) this.audio=new Audio();
      if(this.audio.state==='suspended') this.audio.resume().catch(()=>{});
      const pitch={place:180,step:110,wood:170,whistle:900,reward:660,portal:260,boom:65};
      const osc=this.audio.createOscillator(),gain=this.audio.createGain(),now=this.audio.currentTime;
      osc.type=kind==='boom' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(pitch[kind]||220,now);
      osc.frequency.exponentialRampToValueAtTime(kind==='reward'?990:Math.max(35,(pitch[kind]||220)*.6),now+.15);
      gain.gain.setValueAtTime(kind==='step'||kind==='wood' ? .025 : .065,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.18);
      osc.connect(gain);gain.connect(this.audio.destination);osc.start();osc.stop(now+.2);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    } catch (_) { /* Audio no disponible: el juego sigue sin sonido. */ }
  }
  emit(x,y,z,kind=0,count=1) {
    if(this.reducedMotion || !this.game.adventure?.effectsEnabled) return;
    for(let i=0;i<count && this.particles.length<80;i++) {
      const mesh=new THREE.Mesh(this.geo,this.materials[kind]);mesh.position.set(x,y,z);this.game.scene.add(mesh);
      this.particles.push({mesh,life:.6+Math.random()*.5,v:new THREE.Vector3((Math.random()-.5)*2,1+Math.random()*2,(Math.random()-.5)*2)});
    }
  }
  burst(x,y,z) {this.emit(x+.5,y+.5,z+.5,1,22);this.tone('boom');}
  update(dt) {
    this.clock+=dt;this.smokeClock-=dt;this.stepClock-=dt;
    const g=this.game,p=g.player;
    for(const particle of this.particles) {
      particle.life-=dt;particle.mesh.position.addScaledVector(particle.v,dt);
      particle.mesh.scale.setScalar(Math.max(.1,particle.life));
      if(particle.life<=0) g.scene.remove(particle.mesh);
    }
    this.particles=this.particles.filter(p=>p.life>0);
    if(this.smokeClock<=0) {
      this.smokeClock=.2;
      for(const k of [...g.tntFuses.keys()].slice(0,8)) {
        const [x,y,z]=k.split(',').map(Number);
        if(Math.hypot(x-p.pos.x,z-p.pos.z)<30)this.emit(x+.5,y+1,z+.5);
      }
    }
    if(p.onGround && !p.sitting && Math.hypot(p.vel.x,p.vel.z)>1 && this.stepClock<=0) {
      this.stepClock=.38;
      const id=g.world.getBlock(Math.floor(p.pos.x),Math.floor(p.pos.y-.1),Math.floor(p.pos.z));
      this.tone([5,7,48].includes(id)?'wood':'step');
    }
    if(!this.reducedMotion && g.world.materials.water.transparent)
      g.world.materials.water.opacity=this.game.adventure.effectsEnabled ? .68+Math.sin(this.clock*1.5)*.035 : .7;
  }
  dispose() {
    for(const p of this.particles)this.game.scene.remove(p.mesh);
    this.particles=[];this.geo.dispose();for(const m of this.materials)m.dispose();
    if(this.audio)this.audio.close().catch(()=>{});
    if(this.game.world.materials.water.transparent)this.game.world.materials.water.opacity=.7;
  }
}
