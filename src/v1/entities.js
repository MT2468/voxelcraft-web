import { ITEM } from './catalog.js';
import { LootTable } from './systems.js';
import { seedRandom } from './world.js';

export const ENTITY_DEFS = Object.freeze({
  pig:{name:'Porco',kind:'passive',health:10,speed:1.2,damage:0,loot:new LootTable([{id:ITEM.RAW_PORK,min:1,max:3},{id:ITEM.LEATHER,chance:0.08}])},
  cow:{name:'Vaca',kind:'passive',health:10,speed:1.05,damage:0,loot:new LootTable([{id:ITEM.RAW_BEEF,min:1,max:3},{id:ITEM.LEATHER,min:0,max:2}])},
  chicken:{name:'Galinha',kind:'passive',health:4,speed:1.1,damage:0,loot:new LootTable([{id:ITEM.RAW_CHICKEN,min:1,max:1},{id:ITEM.SEEDS,chance:0.25}])},
  sheep:{name:'Ovelha',kind:'passive',health:8,speed:1.05,damage:0,loot:new LootTable([{id:ITEM.WOOL,min:1,max:2}])},
  wolf:{name:'Lobo',kind:'neutral',health:16,speed:1.8,damage:4,loot:new LootTable([])},
  zombie:{name:'Zumbi',kind:'hostile',health:20,speed:1.35,damage:3,loot:new LootTable([{id:ITEM.IRON_INGOT,chance:0.025},{id:ITEM.STICK,chance:0.15}])},
  skeleton:{name:'Esqueleto',kind:'ranged',health:20,speed:1.25,damage:4,loot:new LootTable([{id:ITEM.ARROW,min:0,max:2},{id:ITEM.BOW,chance:0.04}])},
  creeper:{name:'Rastejante',kind:'explosive',health:20,speed:1.15,damage:0,loot:new LootTable([{id:ITEM.COAL,min:1,max:2}])},
  slime:{name:'Slime',kind:'hostile',health:12,speed:1.0,damage:2,loot:new LootTable([{id:ITEM.FLUX_DUST,chance:0.5,min:1,max:2}])},
  emberling:{name:'Emberling',kind:'hostile',health:24,speed:1.45,damage:5,loot:new LootTable([{id:ITEM.EMBER_CRYSTAL,chance:0.35,min:1,max:2}])},
  voidling:{name:'Voidling',kind:'ranged',health:26,speed:1.4,damage:5,loot:new LootTable([{id:ITEM.ENDER_SHARD,chance:0.45,min:1,max:2}])},
  void_titan:{name:'Titã do Vazio',kind:'boss',health:240,speed:1.2,damage:10,loot:new LootTable([{id:ITEM.VOID_EYE,min:1,max:1},{id:ITEM.DIAMOND,min:4,max:8}])}
});

let NEXT_ENTITY_ID=1;
export class Entity {
  constructor(type,x,y,z){const def=ENTITY_DEFS[type];if(!def)throw new Error(`Unknown entity ${type}`);this.id=NEXT_ENTITY_ID++;this.type=type;this.kind=def.kind;this.x=x;this.y=y;this.z=z;this.vx=0;this.vy=0;this.vz=0;this.health=def.health;this.maxHealth=def.health;this.dead=false;this.age=0;this.state='idle';this.target=null;this.path=[];this.pathTimer=0;this.attackTimer=0;this.wanderTimer=0;this.hurtTimer=0;this.fuse=0;this.love=0;this.owner=null;this.data={};}
  distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}
  serialize(){return{id:this.id,type:this.type,x:this.x,y:this.y,z:this.z,vx:this.vx,vy:this.vy,vz:this.vz,health:this.health,age:this.age,state:this.state,love:this.love,owner:this.owner,data:this.data};}
  static from(raw){if(!raw||!ENTITY_DEFS[raw.type])return null;const e=new Entity(raw.type,Number(raw.x)||0,Number(raw.y)||0,Number(raw.z)||0);e.id=Number(raw.id)||e.id;NEXT_ENTITY_ID=Math.max(NEXT_ENTITY_ID,e.id+1);e.vx=Number(raw.vx)||0;e.vy=Number(raw.vy)||0;e.vz=Number(raw.vz)||0;e.health=Math.max(0,Math.min(e.maxHealth,Number(raw.health)||e.maxHealth));e.age=Math.max(0,Number(raw.age)||0);e.state=String(raw.state||'idle');e.love=Math.max(0,Number(raw.love)||0);e.owner=raw.owner??null;e.data=raw.data&&typeof raw.data==='object'?{...raw.data}:{};return e;}
}

export class Projectile {
  constructor(type,x,y,z,vx,vy,vz,owner=null,damage=4){this.id=NEXT_ENTITY_ID++;this.type=type;this.x=x;this.y=y;this.z=z;this.vx=vx;this.vy=vy;this.vz=vz;this.owner=owner;this.damage=damage;this.age=0;this.dead=false;}
}

export class EntityManagerV1 {
  constructor(world,{seed=1,onDamagePlayer=null,onDrop=null,onExplode=null}={}){this.world=world;this.random=seedRandom(seed^0xabc123);this.entities=[];this.projectiles=[];this.spawnTimer=0;this.onDamagePlayer=onDamagePlayer;this.onDrop=onDrop;this.onExplode=onExplode;this.maxEntities=40;this.pathCache=new Map();this.flags={bossDefeated:false};}
  spawn(type,x,y,z){if(!ENTITY_DEFS[type])return null;const e=new Entity(type,x,y,z);this.entities.push(e);return e;}
  spawnBoss(x,y,z){if(this.entities.some((e)=>e.type==='void_titan'&&!e.dead))return null;return this.spawn('void_titan',x,y,z);}
  summon(type,x,y,z){return this.spawn(type,x,y,z);}
  removeDead(){this.entities=this.entities.filter((e)=>!e.dead);this.projectiles=this.projectiles.filter((p)=>!p.dead);}
  tick(dt,player,{daylight=1,difficulty='normal',doMobSpawning=true}={}){
    this.spawnTimer-=dt;if(doMobSpawning&&difficulty!=='peaceful'&&this.spawnTimer<=0){this.spawnTimer=1.8+this.random()*1.8;this.tryNaturalSpawn(player,daylight,difficulty);}
    for(const e of this.entities){if(e.dead)continue;e.age+=dt;e.attackTimer=Math.max(0,e.attackTimer-dt);e.hurtTimer=Math.max(0,e.hurtTimer-dt);e.pathTimer-=dt;e.wanderTimer-=dt;e.love=Math.max(0,e.love-dt);this.tickEntity(e,dt,player,daylight);}
    this.tickProjectiles(dt,player);this.tickBreeding();this.removeDead();
  }
  tryNaturalSpawn(player,daylight,difficulty){if(this.entities.length>=this.maxEntities)return;const dimension=this.world.dimension;let pool;
    if(dimension==='emberdeep')pool=['emberling','slime'];else if(dimension==='voidlands')pool=['voidling'];else if(daylight<0.38)pool=['zombie','skeleton','creeper','slime'];else pool=['pig','cow','chicken','sheep','wolf'];
    const type=pool[Math.floor(this.random()*pool.length)],angle=this.random()*Math.PI*2,radius=14+this.random()*22,x=Math.floor(player.x+Math.cos(angle)*radius)+0.5,z=Math.floor(player.z+Math.sin(angle)*radius)+0.5,y=this.world.surfaceY(x,z);if(!this.world.isWalkable(x,y,z))return;this.spawn(type,x,y,z);
  }
  tickEntity(e,dt,player,daylight){const def=ENTITY_DEFS[e.type],dist=e.distanceTo(player);if(dist>64&&def.kind!=='boss'){e.dead=true;return;}
    if(def.kind==='passive'){if(dist<3.2){e.state='flee';this.moveDirection(e,-(player.x-e.x),-(player.z-e.z),def.speed*1.5,dt);}else this.wander(e,def.speed,dt);return;}
    if(def.kind==='neutral'&&!e.data.angry){if(dist<2.4)this.moveDirection(e,-(player.x-e.x),-(player.z-e.z),def.speed,dt);else this.wander(e,def.speed,dt);return;}
    if(def.kind==='ranged'){if(dist<14){e.state='attack';if(dist<6)this.moveDirection(e,-(player.x-e.x),-(player.z-e.z),def.speed,dt);else if(dist>10)this.moveToward(e,player,def.speed,dt);if(e.attackTimer<=0){e.attackTimer=1.6;this.shootAt(e,player,def.damage);}}else this.wander(e,def.speed,dt);return;}
    if(def.kind==='explosive'){if(dist<6){e.state='fuse';this.moveToward(e,player,def.speed,dt);if(dist<2.5)e.fuse+=dt;else e.fuse=Math.max(0,e.fuse-dt*0.5);if(e.fuse>=1.6){e.dead=true;this.onExplode?.(e.x,e.y,e.z,3.5);}}else{e.fuse=0;this.wander(e,def.speed,dt);}return;}
    if(def.kind==='boss'){this.tickBoss(e,dt,player);return;}
    if(dist<16){e.state='chase';this.moveToward(e,player,def.speed,dt);if(dist<1.55&&e.attackTimer<=0){e.attackTimer=0.9;this.onDamagePlayer?.(def.damage,e.type);}}else this.wander(e,def.speed,dt);
  }
  tickBoss(e,dt,player){const def=ENTITY_DEFS[e.type],dist=e.distanceTo(player),phase=e.health/e.maxHealth>0.66?1:e.health/e.maxHealth>0.33?2:3;e.data.phase=phase;if(dist>5)this.moveToward(e,player,def.speed+(phase-1)*0.25,dt);if(e.attackTimer<=0){e.attackTimer=Math.max(0.55,1.7-phase*0.25);if(dist<3.2)this.onDamagePlayer?.(def.damage+phase*2,e.type);else{for(let i=0;i<phase;i++)this.shootAt(e,{x:player.x+(this.random()-.5)*3,y:player.y,z:player.z+(this.random()-.5)*3},6+phase);}}}
  moveToward(e,target,speed,dt){if(e.pathTimer<=0){e.pathTimer=0.7+this.random()*0.4;e.path=findPath2D(this.world,e,target,12,120)||[];}if(e.path.length){const node=e.path[0],dx=node.x-e.x,dz=node.z-e.z;if(Math.hypot(dx,dz)<0.45)e.path.shift();else this.moveDirection(e,dx,dz,speed,dt);}else this.moveDirection(e,target.x-e.x,target.z-e.z,speed,dt);}
  moveDirection(e,dx,dz,speed,dt){const len=Math.hypot(dx,dz);if(len<0.001)return;dx/=len;dz/=len;const nx=e.x+dx*speed*dt,nz=e.z+dz*speed*dt,ny=this.world.surfaceY(nx,nz);if(Math.abs(ny-e.y)<=1.1&&this.world.isWalkable(nx,ny,nz)){e.x=nx;e.z=nz;e.y+=(ny-e.y)*Math.min(1,dt*10);e.vx=dx*speed;e.vz=dz*speed;}else e.wanderTimer=0;}
  wander(e,speed,dt){if(e.wanderTimer<=0){e.wanderTimer=1+this.random()*3.5;const a=this.random()*Math.PI*2;e.data.wdx=Math.cos(a);e.data.wdz=Math.sin(a);if(this.random()<0.22){e.data.wdx=0;e.data.wdz=0;}}this.moveDirection(e,e.data.wdx||0,e.data.wdz||0,speed*0.65,dt);}
  shootAt(e,target,damage){const dx=target.x-e.x,dy=(target.y+1)- (e.y+1.2),dz=target.z-e.z,len=Math.hypot(dx,dz)||1,speed=9;this.projectiles.push(new Projectile('arrow',e.x,e.y+1.25,e.z,dx/len*speed,dy/len*speed,dz/len*speed,e.id,damage));}
  tickProjectiles(dt,player){for(const p of this.projectiles){if(p.dead)continue;p.age+=dt;if(p.age>10){p.dead=true;continue;}p.vy-=9.8*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(this.world.getBlock(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z))!==0){p.dead=true;continue;}if(Math.hypot(p.x-player.x,p.y-player.y-0.9,p.z-player.z)<0.75){p.dead=true;this.onDamagePlayer?.(p.damage,'projectile');}}
  }
  attack(e,damage,source=null){if(!e||e.dead||damage<=0)return null;e.health-=damage;e.hurtTimer=0.25;if(source){const dx=e.x-source.x,dz=e.z-source.z,len=Math.hypot(dx,dz)||1;e.x+=dx/len*0.45;e.z+=dz/len*0.45;}if(e.health>0){if(e.kind==='neutral')e.data.angry=true;return{killed:false};}e.dead=true;const drops=ENTITY_DEFS[e.type].loot.roll({type:e.type},this.random);for(const[id,count]of drops)this.onDrop?.(id,count,e.x,e.y,e.z);if(e.type==='void_titan')this.flags.bossDefeated=true;return{killed:true,drops};}
  feed(e,itemId){if(!e||e.dead||!['pig','cow','chicken','sheep','wolf'].includes(e.type))return false;const accepted=e.type==='chicken'?itemId===ITEM.SEEDS:[ITEM.WHEAT,ITEM.RAW_PORK].includes(itemId);if(!accepted)return false;e.love=30;if(e.type==='wolf'&&itemId===ITEM.RAW_PORK)e.owner='player';return true;}
  tickBreeding(){for(let i=0;i<this.entities.length;i++){const a=this.entities[i];if(a.love<=0)continue;for(let j=i+1;j<this.entities.length;j++){const b=this.entities[j];if(b.type!==a.type||b.love<=0||Math.hypot(a.x-b.x,a.z-b.z)>2)continue;a.love=b.love=0;const baby=this.spawn(a.type,(a.x+b.x)/2,a.y,(a.z+b.z)/2);baby.data.baby=true;baby.data.grow=120;break;}}for(const e of this.entities)if(e.data.baby){e.data.grow-=0.05;if(e.data.grow<=0)e.data.baby=false;}}
  serialize(){return{entities:this.entities.filter((e)=>!e.dead).map((e)=>e.serialize()),flags:{...this.flags}};}
  load(raw){this.entities=[];for(const data of Array.isArray(raw?.entities)?raw.entities:[]){const e=Entity.from(data);if(e)this.entities.push(e);}this.flags={bossDefeated:Boolean(raw?.flags?.bossDefeated)};}
}

export function findPath2D(world,start,target,radius=12,maxNodes=160){const sx=Math.floor(start.x),sz=Math.floor(start.z),tx=Math.floor(target.x),tz=Math.floor(target.z);if(Math.hypot(tx-sx,tz-sz)>radius*2)return null;const open=[{x:sx,z:sz,g:0,f:heur(sx,sz,tx,tz)}],came=new Map(),gScore=new Map([[`${sx},${sz}`,0]]),closed=new Set();let nodes=0;while(open.length&&nodes++<maxNodes){open.sort((a,b)=>a.f-b.f);const cur=open.shift(),ck=`${cur.x},${cur.z}`;if(closed.has(ck))continue;closed.add(ck);if(cur.x===tx&&cur.z===tz)return reconstruct(came,cur.x,cur.z).slice(1);const cy=world.surfaceY(cur.x+0.5,cur.z+0.5);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=cur.x+dx,nz=cur.z+dz;if(Math.abs(nx-sx)>radius||Math.abs(nz-sz)>radius)continue;const ny=world.surfaceY(nx+0.5,nz+0.5);if(Math.abs(ny-cy)>1.1||!world.isWalkable(nx+0.5,ny,nz+0.5))continue;const nk=`${nx},${nz}`,ng=cur.g+1+(Math.abs(ny-cy)*0.25);if(ng>=(gScore.get(nk)??Infinity))continue;came.set(nk,ck);gScore.set(nk,ng);open.push({x:nx,z:nz,g:ng,f:ng+heur(nx,nz,tx,tz)});}}
  return null;}
function reconstruct(came,x,z){const path=[{x:x+0.5,z:z+0.5}],start=[x,z];let key=`${x},${z}`,guard=0;while(came.has(key)&&guard++<256){key=came.get(key);const[a,b]=key.split(',').map(Number);path.push({x:a+0.5,z:b+0.5});}return path.reverse();}
function heur(x,z,tx,tz){return Math.abs(tx-x)+Math.abs(tz-z);}
