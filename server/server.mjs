import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT)||8787,HOST=process.env.HOST||'0.0.0.0',TICK_RATE=20,SNAPSHOT_RATE=10,MAX_ROOM_PLAYERS=16;
const rooms=new Map();

class Room{
  constructor(id){this.id=id;this.players=new Map();this.blocks=new Map();this.chat=[];this.createdAt=Date.now();this.seed=Math.floor(Math.random()*2_000_000_000)+1;}
  add(client,name){const id=crypto.randomUUID(),player={id,name:sanitizeName(name),x:0.5,y:40,z:0.5,yaw:0,pitch:0,vx:0,vy:0,vz:0,health:20,hunger:20,gameMode:'survival',lastInput:Date.now(),seq:0};this.players.set(id,{client,player,input:{}});return player;}
  remove(id){this.players.delete(id);}
  broadcast(message,except=null){const text=JSON.stringify(message);for(const[id,entry]of this.players)if(id!==except&&entry.client.readyState===1)entry.client.send(text);}
  blockKey(x,y,z){return`${x},${y},${z}`;}
  setBlock(actor,x,y,z,id){if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z)||!Number.isInteger(id)||y<0||y>=96||Math.abs(x)>30_000_000||Math.abs(z)>30_000_000||id<0||id>255)return false;const entry=this.players.get(actor);if(!entry)return false;const p=entry.player;if(Math.hypot(p.x-(x+.5),p.y-(y+.5),p.z-(z+.5))>8&&p.gameMode!=='creative')return false;this.blocks.set(this.blockKey(x,y,z),id);this.broadcast({t:'block',x,y,z,id,by:actor});return true;}
  tick(dt){for(const entry of this.players.values()){const p=entry.player,i=entry.input||{};const now=Date.now();if(now-p.lastInput>3000){p.vx=p.vz=0;continue;}const speed=p.gameMode==='creative'?8:(i.sprint?6.3:4.3),mx=clamp(Number(i.mx)||0,-1,1),mz=clamp(Number(i.mz)||0,-1,1),len=Math.hypot(mx,mz)||1;p.vx=mx/len*speed;p.vz=mz/len*speed;if(mx===0&&mz===0){p.vx=0;p.vz=0;}p.x+=p.vx*dt;p.z+=p.vz*dt;if(p.gameMode==='creative'){p.vy=clamp(Number(i.my)||0,-1,1)*speed;p.y+=p.vy*dt;}else{p.vy-=20.5*dt;p.y+=p.vy*dt;if(p.y<1){p.y=40;p.vy=0;p.health=Math.max(1,p.health-4);}}p.yaw=Number(i.yaw)||p.yaw;p.pitch=clamp(Number(i.pitch)||p.pitch,-1.55,1.55);}}
  snapshot(){return{t:'snapshot',time:Date.now(),seed:this.seed,players:[...this.players.values()].map((e)=>e.player)};}
}

const wss=new WebSocketServer({port:PORT,host:HOST,perMessageDeflate:false});
wss.on('connection',(ws)=>{let room=null,playerId=null,welcomed=false;ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);ws.on('message',(raw)=>{let msg;try{msg=JSON.parse(raw.toString())}catch{return send(ws,{t:'error',message:'invalid_json'});}if(!welcomed){if(msg.t!=='hello'||msg.v!==1)return ws.close(1002,'protocol');const roomId=sanitizeRoom(msg.room);room=rooms.get(roomId)||new Room(roomId);rooms.set(roomId,room);if(room.players.size>=MAX_ROOM_PLAYERS)return ws.close(1013,'room_full');const p=room.add(ws,msg.name);playerId=p.id;welcomed=true;send(ws,{t:'welcome',v:1,id:p.id,room:room.id,seed:room.seed,blocks:[...room.blocks]});room.broadcast({t:'event',event:'join',id:p.id,name:p.name},p.id);return;}
    const entry=room?.players.get(playerId);if(!entry)return;
    switch(msg.t){case'input':if(Number(msg.n)<=entry.player.seq)return;entry.player.seq=Number(msg.n)||entry.player.seq;entry.player.lastInput=Date.now();entry.input=normalizeInput(msg.input);break;case'block':room.setBlock(playerId,Number(msg.x),Number(msg.y),Number(msg.z),Number(msg.id));break;case'chat':{const text=sanitizeChat(msg.text);if(!text)return;const chat={t:'chat',id:playerId,name:entry.player.name,text,time:Date.now()};room.chat.push(chat);if(room.chat.length>100)room.chat.shift();room.broadcast(chat);break;}case'ping':send(ws,{t:'pong',n:msg.n});break;case'action':handleAction(room,entry,msg);break;}}
  );ws.on('close',()=>{if(room&&playerId){const name=room.players.get(playerId)?.player?.name;room.remove(playerId);room.broadcast({t:'event',event:'leave',id:playerId,name});if(room.players.size===0&&Date.now()-room.createdAt>60_000)rooms.delete(room.id);}});});

function handleAction(room,entry,msg){const p=entry.player;switch(msg.action){case'respawn':p.x=.5;p.y=40;p.z=.5;p.health=20;p.hunger=20;break;case'gamemode':if(['survival','creative','adventure'].includes(msg.data?.mode))p.gameMode=msg.data.mode;break;case'damage':{const target=room.players.get(msg.data?.target);if(!target)return;const dist=Math.hypot(target.player.x-p.x,target.player.y-p.y,target.player.z-p.z);if(dist>4.5)return;target.player.health=Math.max(0,target.player.health-clamp(Number(msg.data?.amount)||1,0,10));if(target.player.health<=0){target.player.x=.5;target.player.y=40;target.player.z=.5;target.player.health=20;room.broadcast({t:'event',event:'death',id:target.player.id,by:p.id});}break;}default:break;}}

setInterval(()=>{for(const room of rooms.values())room.tick(1/TICK_RATE);},1000/TICK_RATE);
setInterval(()=>{for(const room of rooms.values())room.broadcast(room.snapshot());},1000/SNAPSHOT_RATE);
setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},30_000);

console.log(`VoxelCraft authoritative server listening on ws://${HOST}:${PORT}`);

function send(ws,obj){if(ws.readyState===1)ws.send(JSON.stringify(obj));}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function sanitizeName(v){return String(v||'Player').replace(/[^\p{L}\p{N}_ -]/gu,'').trim().slice(0,24)||'Player';}
function sanitizeRoom(v){return String(v||'default').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,32)||'default';}
function sanitizeChat(v){return String(v||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,256);}
function normalizeInput(i){return{mx:clamp(Number(i?.mx)||0,-1,1),mz:clamp(Number(i?.mz)||0,-1,1),my:clamp(Number(i?.my)||0,-1,1),yaw:Number(i?.yaw)||0,pitch:clamp(Number(i?.pitch)||0,-1.55,1.55),sprint:Boolean(i?.sprint),jump:Boolean(i?.jump)};}
