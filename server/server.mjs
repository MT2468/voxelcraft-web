import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT)||8787;
const HOST=process.env.HOST||'0.0.0.0';
const TICK_RATE=20;
const SNAPSHOT_RATE=10;
const MAX_ROOM_PLAYERS=16;
const MAX_PAYLOAD=32*1024;
const SESSION_TTL=30_000;
const ALLOW_CHEATS=process.env.ALLOW_CHEATS==='1';
const rooms=new Map();

class Room {
  constructor(id){
    this.id=id;
    this.players=new Map();
    this.blocks=new Map();
    this.chat=[];
    this.sessions=new Map();
    this.createdAt=Date.now();
    this.lastActive=Date.now();
    this.seed=Math.floor(Math.random()*2_000_000_000)+1;
  }

  add(client,name,resumeToken=null){
    this.cleanupSessions();
    let player=null,token=null;
    if(resumeToken&&this.sessions.has(resumeToken)){
      const saved=this.sessions.get(resumeToken);
      this.sessions.delete(resumeToken);
      player={...saved.player,lastInput:Date.now()};
      token=resumeToken;
    }
    if(!player){
      token=crypto.randomUUID();
      player={
        id:crypto.randomUUID(),name:sanitizeName(name),x:0.5,y:40,z:0.5,
        yaw:0,pitch:0,vx:0,vy:0,vz:0,health:20,hunger:20,
        gameMode:'survival',lastInput:Date.now(),seq:0,resumeToken:token
      };
    }
    player.name=sanitizeName(name||player.name);
    player.resumeToken=token;
    const entry={
      client,player,input:{},lastSeq:{input:0,block:0,action:0},
      rates:new Map(),lastAttack:0
    };
    this.players.set(player.id,entry);
    this.lastActive=Date.now();
    return player;
  }

  remove(id){
    const entry=this.players.get(id);
    if(!entry)return;
    this.players.delete(id);
    this.sessions.set(entry.player.resumeToken,{player:{...entry.player},expires:Date.now()+SESSION_TTL});
    this.lastActive=Date.now();
  }

  cleanupSessions(){
    const now=Date.now();
    for(const[token,session]of this.sessions)if(session.expires<=now)this.sessions.delete(token);
  }

  broadcast(message,except=null){
    const text=JSON.stringify(message);
    for(const[id,entry]of this.players){
      if(id===except||entry.client.readyState!==1)continue;
      entry.client.send(text);
    }
  }

  blockKey(x,y,z){return`${x},${y},${z}`;}

  consumeRate(entry,key,limit,windowMs=1000){
    const now=Date.now();
    let state=entry.rates.get(key);
    if(!state||now-state.start>=windowMs){state={start:now,count:0};entry.rates.set(key,state);}
    state.count++;
    return state.count<=limit;
  }

  acceptSeq(entry,key,value){
    const seq=Number(value);
    if(!Number.isSafeInteger(seq)||seq<=entry.lastSeq[key])return false;
    entry.lastSeq[key]=seq;
    return true;
  }

  setBlock(actor,msg){
    const entry=this.players.get(actor);
    if(!entry||!this.consumeRate(entry,'block',20)||!this.acceptSeq(entry,'block',msg.n))return false;
    const x=Number(msg.x),y=Number(msg.y),z=Number(msg.z),id=Number(msg.id);
    if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z)||!Number.isInteger(id))return false;
    if(y<0||y>=96||Math.abs(x)>30_000_000||Math.abs(z)>30_000_000||id<0||id>255)return false;
    const player=entry.player;
    if(Math.hypot(player.x-(x+0.5),player.y-(y+0.5),player.z-(z+0.5))>8&&player.gameMode!=='creative')return false;
    this.blocks.set(this.blockKey(x,y,z),id);
    if(this.blocks.size>100_000)this.blocks.delete(this.blocks.keys().next().value);
    this.broadcast({t:'block',n:msg.n,x,y,z,id,by:actor});
    this.lastActive=Date.now();
    return true;
  }

  tick(dt){
    for(const entry of this.players.values()){
      const player=entry.player,input=entry.input||{},now=Date.now();
      if(now-player.lastInput>3000){player.vx=player.vz=0;continue;}
      const speed=player.gameMode==='creative'?8:(input.sprint?6.3:4.3);
      let mx=clamp(Number(input.mx)||0,-1,1),mz=clamp(Number(input.mz)||0,-1,1);
      const length=Math.hypot(mx,mz);
      if(length>1){mx/=length;mz/=length;}
      player.vx=mx*speed;player.vz=mz*speed;
      player.x=clamp(player.x+player.vx*dt,-30_000_000,30_000_000);
      player.z=clamp(player.z+player.vz*dt,-30_000_000,30_000_000);
      if(player.gameMode==='creative'){
        player.vy=clamp(Number(input.my)||0,-1,1)*speed;
        player.y=clamp(player.y+player.vy*dt,0,95);
      }else{
        player.vy=Math.max(-34,player.vy-20.5*dt);
        player.y+=player.vy*dt;
        if(player.y<1){player.y=40;player.vy=0;player.health=Math.max(1,player.health-4);}
        if(player.y>95){player.y=95;player.vy=Math.min(0,player.vy);}
      }
      player.yaw=finiteAngle(input.yaw,player.yaw);
      player.pitch=clamp(Number(input.pitch)||player.pitch,-1.55,1.55);
    }
  }

  snapshot(){
    return{t:'snapshot',time:Date.now(),seed:this.seed,players:[...this.players.values()].map(({player,lastSeq})=>({...player,ack:lastSeq.input,resumeToken:undefined}))};
  }
}

const wss=new WebSocketServer({port:PORT,host:HOST,perMessageDeflate:false,maxPayload:MAX_PAYLOAD});

wss.on('connection',(ws)=>{
  let room=null,playerId=null,welcomed=false;
  ws.isAlive=true;
  ws.on('pong',()=>{ws.isAlive=true;});

  ws.on('message',(raw)=>{
    if(raw.length>MAX_PAYLOAD)return ws.close(1009,'payload_too_large');
    let msg;
    try{msg=JSON.parse(raw.toString());}catch{return send(ws,{t:'error',message:'invalid_json'});}
    if(!msg||typeof msg!=='object')return;

    if(!welcomed){
      if(msg.t!=='hello'||msg.v!==1)return ws.close(1002,'protocol');
      const roomId=sanitizeRoom(msg.room);
      room=rooms.get(roomId)||new Room(roomId);rooms.set(roomId,room);
      if(room.players.size>=MAX_ROOM_PLAYERS)return ws.close(1013,'room_full');
      const player=room.add(ws,msg.name,sanitizeToken(msg.resume));
      playerId=player.id;welcomed=true;
      send(ws,{t:'welcome',v:1,id:player.id,room:room.id,seed:room.seed,resume:player.resumeToken,blocks:[...room.blocks]});
      room.broadcast({t:'event',event:'join',id:player.id,name:player.name},player.id);
      return;
    }

    const entry=room?.players.get(playerId);
    if(!entry)return;
    switch(msg.t){
      case'input':{
        if(!room.consumeRate(entry,'input',70)||!room.acceptSeq(entry,'input',msg.n))return;
        entry.player.seq=msg.n;entry.player.lastInput=Date.now();entry.input=normalizeInput(msg.input);
        break;
      }
      case'block':
        if(!room.setBlock(playerId,msg))send(ws,{t:'error',message:'block_rejected'});
        break;
      case'chat':{
        if(!room.consumeRate(entry,'chat',5))return send(ws,{t:'error',message:'rate_limited_chat'});
        const text=sanitizeChat(msg.text);if(!text)return;
        const chat={t:'chat',id:playerId,name:entry.player.name,text,time:Date.now()};
        room.chat.push(chat);if(room.chat.length>100)room.chat.shift();room.broadcast(chat);break;
      }
      case'ping':send(ws,{t:'pong',n:msg.n});break;
      case'action':{
        if(!room.consumeRate(entry,'action',10)||!room.acceptSeq(entry,'action',msg.n))return;
        handleAction(room,entry,msg);break;
      }
      default:send(ws,{t:'error',message:'unknown_message'});break;
    }
  });

  ws.on('close',()=>{
    if(!room||!playerId)return;
    const name=room.players.get(playerId)?.player?.name;
    room.remove(playerId);
    room.broadcast({t:'event',event:'leave',id:playerId,name});
  });
});

function handleAction(room,entry,msg){
  const player=entry.player;
  switch(msg.action){
    case'respawn':player.x=0.5;player.y=40;player.z=0.5;player.vx=player.vy=player.vz=0;player.health=20;player.hunger=20;break;
    case'gamemode':if(ALLOW_CHEATS&&['survival','creative','adventure'].includes(msg.data?.mode))player.gameMode=msg.data.mode;break;
    case'damage':{
      const now=Date.now();if(now-entry.lastAttack<250)return;entry.lastAttack=now;
      const target=room.players.get(msg.data?.target);if(!target||target===entry)return;
      const distance=Math.hypot(target.player.x-player.x,target.player.y-player.y,target.player.z-player.z);if(distance>4.5)return;
      target.player.health=Math.max(0,target.player.health-clamp(Number(msg.data?.amount)||1,0,6));
      if(target.player.health<=0){target.player.x=0.5;target.player.y=40;target.player.z=0.5;target.player.health=20;room.broadcast({t:'event',event:'death',id:target.player.id,by:player.id});}
      break;
    }
    default:break;
  }
}

setInterval(()=>{for(const room of rooms.values())room.tick(1/TICK_RATE);},1000/TICK_RATE);
setInterval(()=>{for(const room of rooms.values())room.broadcast(room.snapshot());},1000/SNAPSHOT_RATE);
setInterval(()=>{
  const now=Date.now();
  for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}
  for(const[id,room]of rooms){room.cleanupSessions();if(room.players.size===0&&room.sessions.size===0&&now-room.lastActive>120_000)rooms.delete(id);}
},15_000);

console.log(`VoxelCraft authoritative server listening on ws://${HOST}:${PORT}`);

function send(ws,obj){if(ws.readyState===1)ws.send(JSON.stringify(obj));}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function finiteAngle(value,fallback=0){const n=Number(value);return Number.isFinite(n)?clamp(n,-Math.PI*8,Math.PI*8):fallback;}
function sanitizeName(value){return String(value||'Player').replace(/[^\p{L}\p{N}_ -]/gu,'').trim().slice(0,24)||'Player';}
function sanitizeRoom(value){return String(value||'default').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,32)||'default';}
function sanitizeChat(value){return String(value||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,256);}
function sanitizeToken(value){const token=String(value||'');return/^[0-9a-f-]{36}$/i.test(token)?token:null;}
function normalizeInput(input){return{mx:clamp(Number(input?.mx)||0,-1,1),mz:clamp(Number(input?.mz)||0,-1,1),my:clamp(Number(input?.my)||0,-1,1),yaw:finiteAngle(input?.yaw),pitch:clamp(Number(input?.pitch)||0,-1.55,1.55),sprint:Boolean(input?.sprint),jump:Boolean(input?.jump)};}
