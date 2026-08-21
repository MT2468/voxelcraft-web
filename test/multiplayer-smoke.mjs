import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const port=8791;
const server=spawn(process.execPath,['server/server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let serverOutput='';server.stdout.on('data',(d)=>serverOutput+=d);server.stderr.on('data',(d)=>serverOutput+=d);
try{
  await waitForServer(server,4000);
  const a=await connect('Alice','ci-room'),b=await connect('Bob','ci-room');
  if(a.welcome.room!=='ci-room'||b.welcome.room!=='ci-room')throw new Error('Room handshake failed');
  const chatPromise=waitMessage(b.ws,(m)=>m.t==='chat'&&m.text==='hello-ci',3000);a.ws.send(JSON.stringify({t:'chat',text:'hello-ci'}));const chat=await chatPromise;if(chat.name!=='Alice')throw new Error('Chat identity mismatch');
  const snapPromise=waitMessage(a.ws,(m)=>m.t==='snapshot'&&Array.isArray(m.players)&&m.players.length>=2,3000);a.ws.send(JSON.stringify({t:'input',n:1,input:{mx:1,mz:0,my:0,yaw:0,pitch:0,sprint:false,jump:false}}));const snapshot=await snapPromise;if(snapshot.players.length<2)throw new Error('Snapshot missing players');
  const blockPromise=waitMessage(b.ws,(m)=>m.t==='block'&&m.x===1&&m.y===40&&m.z===0,3000);a.ws.send(JSON.stringify({t:'block',n:2,x:1,y:40,z:0,id:5}));const block=await blockPromise;if(block.id!==5)throw new Error('Block replication failed');
  const pongPromise=waitMessage(a.ws,(m)=>m.t==='pong'&&m.n===99,3000);a.ws.send(JSON.stringify({t:'ping',n:99}));await pongPromise;
  a.ws.close();b.ws.close();
  console.log(JSON.stringify({ok:true,room:'ci-room',players:snapshot.players.length,chat:chat.text,block:[block.x,block.y,block.z,block.id]},null,2));
}finally{server.kill('SIGTERM');}

function connect(name,room){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}`);const timeout=setTimeout(()=>reject(new Error(`connect timeout ${name}`)),3000);ws.on('open',()=>ws.send(JSON.stringify({t:'hello',v:1,room,name})));ws.on('message',(raw)=>{let m;try{m=JSON.parse(raw)}catch{return}if(m.t==='welcome'){clearTimeout(timeout);resolve({ws,welcome:m});}});ws.on('error',reject);});}
function waitMessage(ws,predicate,timeoutMs){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{ws.off('message',handler);reject(new Error('message timeout'));},timeoutMs);function handler(raw){let m;try{m=JSON.parse(raw)}catch{return}if(!predicate(m))return;clearTimeout(timeout);ws.off('message',handler);resolve(m);}ws.on('message',handler);});}
function waitForServer(proc,timeoutMs){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(`server start timeout: ${serverOutput}`)),timeoutMs);function data(d){if(String(d).includes('listening')){clearTimeout(timeout);proc.stdout.off('data',data);resolve();}}proc.stdout.on('data',data);proc.once('exit',(code)=>{clearTimeout(timeout);reject(new Error(`server exited ${code}: ${serverOutput}`));});});}
