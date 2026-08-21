export const PROTOCOL_VERSION=1;
const ACTIVE_CLIENTS=new Set();

export class MultiplayerClient {
  constructor({onState=null,onBlock=null,onChat=null,onEvent=null,autoReconnect=true}={}){
    this.socket=null;this.url=null;this.connected=false;this.playerId=null;this.room=null;
    this.name='Player';this.resumeToken=null;this.players=new Map();this.snapshots=new Map();
    this.onState=onState;this.onBlock=onBlock;this.onChat=onChat;this.onEvent=onEvent;
    this.seq=0;this.lastSnapshot=0;this.ping=0;this.pendingPings=new Map();
    this.autoReconnect=autoReconnect;this.manualClose=false;this.reconnectAttempts=0;this.reconnectTimer=null;ACTIVE_CLIENTS.add(this);
  }
  connect(url,room='default',name='Player'){this.manualClose=false;this.url=url;this.room=room;this.name=String(name).slice(0,24)||'Player';clearTimeout(this.reconnectTimer);if(this.socket){try{this.socket.close();}catch{}}return this.openSocket(true);}
  openSocket(initial=false){return new Promise((resolve,reject)=>{let ws;try{ws=new WebSocket(this.url);}catch(error){reject(error);return;}this.socket=ws;let settled=false;const timeout=setTimeout(()=>{if(settled)return;settled=true;try{ws.close();}catch{}if(initial)reject(new Error('Connection timeout'));else this.scheduleReconnect();},8000);
    ws.addEventListener('open',()=>this.sendRaw({t:'hello',v:PROTOCOL_VERSION,room:this.room,name:this.name,resume:this.resumeToken}));
    ws.addEventListener('message',(event)=>this.handleMessage(event.data,(message)=>{if(settled)return;settled=true;clearTimeout(timeout);this.reconnectAttempts=0;resolve(message);}));
    ws.addEventListener('close',(event)=>{clearTimeout(timeout);const wasConnected=this.connected;this.connected=false;this.onEvent?.({type:'disconnect',code:event.code,reason:event.reason,wasConnected});if(!this.manualClose&&this.autoReconnect)this.scheduleReconnect();});
    ws.addEventListener('error',()=>{clearTimeout(timeout);if(initial&&!settled){settled=true;reject(new Error('WebSocket connection failed'));}});});}
  scheduleReconnect(){if(this.manualClose||!this.autoReconnect||!this.url||this.reconnectTimer)return;const attempt=this.reconnectAttempts++,delay=Math.min(10_000,500*Math.pow(2,Math.min(5,attempt)))+Math.random()*250;this.onEvent?.({type:'reconnecting',attempt:attempt+1,delay});this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.openSocket(false).catch(()=>this.scheduleReconnect());},delay);}
  disconnect(){this.manualClose=true;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;if(this.socket){try{this.socket.close(1000,'client_close');}catch{}}this.socket=null;this.connected=false;this.players.clear();this.snapshots.clear();this.pendingPings.clear();}
  destroy(){this.disconnect();ACTIVE_CLIENTS.delete(this);}
  handleMessage(raw,onWelcome=null){let message;try{message=JSON.parse(raw);}catch{return;}switch(message.t){
    case'welcome':this.connected=true;this.playerId=message.id;this.room=message.room;this.resumeToken=message.resume||this.resumeToken;this.lastSnapshot=performance.now();onWelcome?.(message);this.onEvent?.({type:'connect',...message});if(message.mods&&typeof window!=='undefined')for(const[ns,data]of Object.entries(message.mods))window.dispatchEvent(new CustomEvent('voxelcraft:mod-network',{detail:{ns,type:'state',data,stamp:Date.now(),by:'server'}}));break;
    case'snapshot':this.acceptSnapshot(message);break;case'block':this.onBlock?.(message);break;case'chat':this.onChat?.(message);break;case'event':this.onEvent?.(message);break;
    case'mod':if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('voxelcraft:mod-network',{detail:message}));break;
    case'pong':{const sent=this.pendingPings.get(message.n);if(sent){this.ping=performance.now()-sent;this.pendingPings.delete(message.n);}break;}case'error':this.onEvent?.({type:'error',message:message.message});break;default:break;}}
  acceptSnapshot(message){const now=performance.now(),seen=new Set();for(const player of message.players||[]){seen.add(player.id);const old=this.players.get(player.id)||player;this.snapshots.set(player.id,{from:{...old},to:{...player},at:now,duration:Math.max(50,now-this.lastSnapshot)});this.players.set(player.id,{...player});}for(const id of [...this.players.keys()])if(!seen.has(id)){this.players.delete(id);this.snapshots.delete(id);}this.lastSnapshot=now;this.onState?.(message);}
  interpolatedPlayers(now=performance.now()){const out=[];for(const[id,target]of this.players){if(id===this.playerId)continue;const snapshot=this.snapshots.get(id);if(!snapshot){out.push(target);continue;}const alpha=Math.max(0,Math.min(1,(now-snapshot.at)/snapshot.duration));out.push({...target,x:lerp(snapshot.from.x,snapshot.to.x,alpha),y:lerp(snapshot.from.y,snapshot.to.y,alpha),z:lerp(snapshot.from.z,snapshot.to.z,alpha),yaw:angleLerp(snapshot.from.yaw||0,snapshot.to.yaw||0,alpha)});}return out;}
  sendInput(input){if(!this.connected)return false;return this.sendRaw({t:'input',n:++this.seq,input});}
  sendBlock(x,y,z,id){if(!this.connected)return false;return this.sendRaw({t:'block',n:++this.seq,x:Math.floor(x),y:Math.floor(y),z:Math.floor(z),id:Math.floor(id)});}
  sendChat(text){if(!this.connected)return false;return this.sendRaw({t:'chat',text:String(text).slice(0,256)});}
  sendMod(ns,type,data={}){if(!this.connected)return false;return this.sendRaw({t:'mod',n:++this.seq,ns:String(ns).slice(0,32),type:String(type).slice(0,32),data});}
  requestAction(action,data={}){if(!this.connected)return false;return this.sendRaw({t:'action',n:++this.seq,action,data});}
  pingServer(){if(!this.connected)return false;const n=++this.seq;this.pendingPings.set(n,performance.now());for(const[key,sent]of this.pendingPings)if(performance.now()-sent>15_000)this.pendingPings.delete(key);return this.sendRaw({t:'ping',n});}
  sendRaw(object){if(!this.socket||this.socket.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify(object));return true;}
}

export class LocalPresence {
  constructor(channel='voxelcraft-local'){this.channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel(channel):null;this.id=cryptoRandomId();this.peers=new Map();this.onPeer=null;this.channel?.addEventListener('message',(event)=>{const message=event.data;if(!message||message.id===this.id)return;if(message.t==='presence'){this.peers.set(message.id,{...message,seen:Date.now()});this.onPeer?.(message);}});}
  broadcast(state){this.channel?.postMessage({t:'presence',id:this.id,...state});}
  cleanup(){const now=Date.now();for(const[id,peer]of this.peers)if(now-peer.seen>5000)this.peers.delete(id);}
  close(){this.channel?.close();}
}

if(typeof window!=='undefined')window.addEventListener('voxelcraft:mod-send',(event)=>{const m=event.detail;if(!m?.ns||!m?.type)return;for(const client of ACTIVE_CLIENTS)if(client.connected)client.sendMod(m.ns,m.type,m.data||{});});
function lerp(a,b,t){return(Number(a)||0)+((Number(b)||0)-(Number(a)||0))*t;}
function angleLerp(a,b,t){let delta=((b-a+Math.PI)%(Math.PI*2))-Math.PI;return a+delta*t;}
function cryptoRandomId(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();return Math.random().toString(36).slice(2)+Date.now().toString(36);}
