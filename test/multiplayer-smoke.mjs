import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const port=8791;
const server=spawn(process.execPath,['server/server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let serverOutput='';server.stdout.on('data',(data)=>serverOutput+=data);server.stderr.on('data',(data)=>serverOutput+=data);

try{
  await waitForServer(server,4000);
  await waitForPort(port,3000);
  const alice=await connect('Alice','ci-room');
  const bob=await connect('Bob','ci-room');
  if(alice.welcome.room!=='ci-room'||bob.welcome.room!=='ci-room')throw new Error('Room handshake failed');
  if(!alice.welcome.resume)throw new Error('Resume token missing');

  const chatPromise=waitMessage(bob.ws,(m)=>m.t==='chat'&&m.text==='hello-ci',3000);
  alice.ws.send(JSON.stringify({t:'chat',text:'hello-ci'}));
  const chat=await chatPromise;if(chat.name!=='Alice')throw new Error('Chat identity mismatch');

  const snapshotPromise=waitMessage(alice.ws,(m)=>m.t==='snapshot'&&Array.isArray(m.players)&&m.players.length>=2,3000);
  alice.ws.send(JSON.stringify({t:'input',n:1,input:{mx:1,mz:0,my:0,yaw:0,pitch:0,sprint:false,jump:false}}));
  const snapshot=await snapshotPromise;if(snapshot.players.length<2)throw new Error('Snapshot missing players');

  const blockPromise=waitMessage(bob.ws,(m)=>m.t==='block'&&m.x===1&&m.y===40&&m.z===0,3000);
  alice.ws.send(JSON.stringify({t:'block',n:2,x:1,y:40,z:0,id:5}));
  const block=await blockPromise;if(block.id!==5)throw new Error('Block replication failed');

  const replayError=waitMessage(alice.ws,(m)=>m.t==='error'&&m.message==='block_rejected',3000);
  alice.ws.send(JSON.stringify({t:'block',n:2,x:2,y:40,z:0,id:5}));
  await replayError;

  const farError=waitMessage(alice.ws,(m)=>m.t==='error'&&m.message==='block_rejected',3000);
  alice.ws.send(JSON.stringify({t:'block',n:3,x:999,y:40,z:999,id:5}));
  await farError;

  const pongPromise=waitMessage(alice.ws,(m)=>m.t==='pong'&&m.n===99,3000);
  alice.ws.send(JSON.stringify({t:'ping',n:99}));await pongPromise;

  const originalId=alice.welcome.id,resume=alice.welcome.resume;
  await closeSocket(alice.ws);
  const resumed=await connect('Alice','ci-room',resume);
  if(resumed.welcome.id!==originalId)throw new Error('Session resume did not preserve identity');

  const rateError=waitMessage(resumed.ws,(m)=>m.t==='error'&&m.message==='rate_limited_chat',3000);
  for(let i=0;i<8;i++)resumed.ws.send(JSON.stringify({t:'chat',text:`spam-${i}`}));
  await rateError;

  const oversized=await rawSocket();
  const closePromise=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('oversized payload was not closed')),3000);oversized.once('close',(code)=>{clearTimeout(timeout);resolve(code);});});
  oversized.send(JSON.stringify({t:'hello',v:1,room:'ci-room',name:'Huge',padding:'x'.repeat(40_000)}));
  const closeCode=await closePromise;if(closeCode!==1009)throw new Error(`Expected close 1009, got ${closeCode}`);

  resumed.ws.close();bob.ws.close();
  console.log(JSON.stringify({ok:true,room:'ci-room',players:snapshot.players.length,chat:chat.text,block:[block.x,block.y,block.z,block.id],resumedId:originalId,rateLimit:true,payloadCap:true},null,2));
}finally{server.kill('SIGTERM');}

async function connect(name,room,resume=null){
  let lastError;
  for(let attempt=0;attempt<12;attempt++){
    try{return await connectOnce(name,room,resume);}catch(error){lastError=error;if(!['ECONNREFUSED','ECONNRESET'].includes(error?.code)&&!/connect|socket|closed/i.test(error?.message||''))throw error;await delay(75+attempt*25);}
  }
  throw lastError||new Error(`Unable to connect ${name}`);
}
function connectOnce(name,room,resume=null){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}`),timeout=setTimeout(()=>{try{ws.terminate();}catch{}reject(new Error(`connect timeout ${name}`));},3000);let settled=false;ws.on('open',()=>ws.send(JSON.stringify({t:'hello',v:1,room,name,resume})));ws.on('message',(raw)=>{let message;try{message=JSON.parse(raw)}catch{return}if(message.t==='welcome'&&!settled){settled=true;clearTimeout(timeout);resolve({ws,welcome:message});}});ws.on('error',(error)=>{if(!settled){settled=true;clearTimeout(timeout);reject(error);}});ws.on('close',()=>{if(!settled){settled=true;clearTimeout(timeout);reject(new Error(`socket closed before welcome ${name}`));}});});}
function rawSocket(){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}`);ws.once('open',()=>resolve(ws));ws.once('error',reject);});}
function closeSocket(ws){return new Promise((resolve)=>{if(ws.readyState===WebSocket.CLOSED)return resolve();ws.once('close',resolve);ws.close();setTimeout(resolve,800);});}
function waitMessage(ws,predicate,timeoutMs){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{ws.off('message',handler);reject(new Error('message timeout'));},timeoutMs);function handler(raw){let message;try{message=JSON.parse(raw)}catch{return}if(!predicate(message))return;clearTimeout(timeout);ws.off('message',handler);resolve(message);}ws.on('message',handler);});}
function waitForServer(proc,timeoutMs){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(`server start timeout: ${serverOutput}`)),timeoutMs);function data(chunk){if(String(chunk).includes('listening')){clearTimeout(timeout);proc.stdout.off('data',data);resolve();}}proc.stdout.on('data',data);proc.once('exit',(code)=>{clearTimeout(timeout);reject(new Error(`server exited ${code}: ${serverOutput}`));});});}
async function waitForPort(targetPort,timeoutMs){const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){try{const ws=await new Promise((resolve,reject)=>{const socket=new WebSocket(`ws://127.0.0.1:${targetPort}`);const timer=setTimeout(()=>{try{socket.terminate();}catch{}reject(new Error('port probe timeout'));},250);socket.once('open',()=>{clearTimeout(timer);resolve(socket);});socket.once('error',(error)=>{clearTimeout(timer);reject(error);});});ws.close();return;}catch{await delay(50);}}throw new Error(`Server port ${targetPort} did not become reachable: ${serverOutput}`);}
const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
