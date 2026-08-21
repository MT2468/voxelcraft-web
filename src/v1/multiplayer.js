export const PROTOCOL_VERSION=1;

export class MultiplayerClient {
  constructor({onState=null,onBlock=null,onChat=null,onEvent=null}={}){this.socket=null;this.url=null;this.connected=false;this.playerId=null;this.room=null;this.players=new Map();this.snapshots=new Map();this.onState=onState;this.onBlock=onBlock;this.onChat=onChat;this.onEvent=onEvent;this.seq=0;this.lastSnapshot=0;this.ping=0;this.pendingPings=new Map();}
  connect(url,room='default',name='Player'){return new Promise((resolve,reject)=>{this.disconnect();this.url=url;let ws;try{ws=new WebSocket(url);}catch(e){reject(e);return;}this.socket=ws;const timeout=setTimeout(()=>{try{ws.close();}catch{}reject(new Error('Connection timeout'));},8000);ws.addEventListener('open',()=>{this.sendRaw({t:'hello',v:PROTOCOL_VERSION,room,name:String(name).slice(0,24)});});ws.addEventListener('message',(e)=>this.handleMessage(e.data,resolve,clearTimeout.bind(null,timeout)));ws.addEventListener('close',()=>{clearTimeout(timeout);this.connected=false;this.onEvent?.({type:'disconnect'});});ws.addEventListener('error',()=>{clearTimeout(timeout);if(!this.connected)reject(new Error('WebSocket connection failed'));});});}
  disconnect(){if(this.socket){try{this.socket.close();}catch{}}this.socket=null;this.connected=false;this.players.clear();this.snapshots.clear();}
  handleMessage(raw,resolve,clear){let msg;try{msg=JSON.parse(raw);}catch{return;}switch(msg.t){case'welcome':this.connected=true;this.playerId=msg.id;this.room=msg.room;this.lastSnapshot=performance.now();clear?.();resolve?.(msg);this.onEvent?.({type:'connect',...msg});break;case'snapshot':this.acceptSnapshot(msg);break;case'block':this.onBlock?.(msg);break;case'chat':this.onChat?.(msg);break;case'event':this.onEvent?.(msg);break;case'pong':{const sent=this.pendingPings.get(msg.n);if(sent){this.ping=performance.now()-sent;this.pendingPings.delete(msg.n);}break;}case'error':this.onEvent?.({type:'error',message:msg.message});break;}}
  acceptSnapshot(msg){const now=performance.now(),seen=new Set();for(const p of msg.players||[]){seen.add(p.id);const old=this.players.get(p.id)||p;this.snapshots.set(p.id,{from:{...old},to:{...p},at:now,duration:Math.max(50,now-this.lastSnapshot)});this.players.set(p.id,{...p});}for(const id of [...this.players.keys()])if(!seen.has(id)){this.players.delete(id);this.snapshots.delete(id);}this.lastSnapshot=now;this.onState?.(msg);}
  interpolatedPlayers(now=performance.now()){const out=[];for(const[id,target]of this.players){if(id===this.playerId)continue;const s=this.snapshots.get(id);if(!s){out.push(target);continue;}const a=Math.max(0,Math.min(1,(now-s.at)/s.duration));out.push({...target,x:lerp(s.from.x,s.to.x,a),y:lerp(s.from.y,s.to.y,a),z:lerp(s.from.z,s.to.z,a),yaw:angleLerp(s.from.yaw||0,s.to.yaw||0,a)});}return out;}
  sendInput(input){if(!this.connected)return false;return this.sendRaw({t:'input',n:++this.seq,input});}
  sendBlock(x,y,z,id){return this.sendRaw({t:'block',n:++this.seq,x:Math.floor(x),y:Math.floor(y),z:Math.floor(z),id:Math.floor(id)});}
  sendChat(text){return this.sendRaw({t:'chat',text:String(text).slice(0,256)});}
  requestAction(action,data={}){return this.sendRaw({t:'action',n:++this.seq,action,data});}
  pingServer(){if(!this.connected)return;const n=++this.seq;this.pendingPings.set(n,performance.now());this.sendRaw({t:'ping',n});}
  sendRaw(obj){if(!this.socket||this.socket.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify(obj));return true;}
}

export class LocalPresence {
  constructor(channel='voxelcraft-local'){this.channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel(channel):null;this.id=cryptoRandomId();this.peers=new Map();this.onPeer=null;this.channel?.addEventListener('message',(e)=>{const m=e.data;if(!m||m.id===this.id)return;if(m.t==='presence'){this.peers.set(m.id,{...m,seen:Date.now()});this.onPeer?.(m);}});}
  broadcast(state){this.channel?.postMessage({t:'presence',id:this.id,...state});}
  cleanup(){const now=Date.now();for(const[id,p]of this.peers)if(now-p.seen>5000)this.peers.delete(id);}
  close(){this.channel?.close();}
}

function lerp(a,b,t){return(Number(a)||0)+((Number(b)||0)-(Number(a)||0))*t;}
function angleLerp(a,b,t){let d=((b-a+Math.PI)%(Math.PI*2))-Math.PI;return a+d*t;}
function cryptoRandomId(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();return Math.random().toString(36).slice(2)+Date.now().toString(36);}
