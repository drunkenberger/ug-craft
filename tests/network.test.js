const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sockets=[];
class Socket {
  static OPEN=1;
  constructor(){this.readyState=1;this.sent=[];sockets.push(this);}
  send(data){this.sent.push(JSON.parse(data));}
  close(){}
}
const context={location:{protocol:'http:',host:'localhost:8940'},WebSocket:Socket,setTimeout,clearTimeout};vm.createContext(context);
vm.runInContext(fs.readFileSync('js/net.js','utf8')+';globalThis.net=NET;',context);
const net=context.net;let welcomes=0;
net.join('old',{},'one');const old=sockets[0];net.leave();
net.join('survival#same-id',{welcome(){welcomes++;}},'two');const current=sockets[1];
old.onopen();old.onmessage({data:JSON.stringify({t:'welcome',id:99,host:true,peers:[9]})});
assert.equal(net.id,null);assert.equal(current.sent.length,0);assert.equal(welcomes,0);
current.onopen();assert.equal(current.sent[0].room,'survival#same-id');
current.onmessage({data:JSON.stringify({t:'welcome',id:2,host:false,peers:[1]})});
assert.equal(net.id,2);assert.equal(welcomes,1);assert.deepEqual([...net.peers],[1]);net.leave();
console.log('Network session isolation tests passed');
