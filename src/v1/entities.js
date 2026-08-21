import { ITEM } from './catalog.js';
import { LootTable } from './systems.js';
import { seedRandom } from './world.js';

export const ENTITY_DEFS = Object.freeze({
  pig:{name:'Porco',kind:'passive',health:10,speed:1.2,damage:0,loot:new LootTable([{id:ITEM.RAW_PORK,min:1,max:3},{id:ITEM.LEATHER,chance:0.08}])},
  cow:{name:'Vaca',kind:'passive',health:10,speed:1.05,damage:0,loot:new LootTable([{id:ITEM.RAW_BEEF,min:1,max:3},{id:ITEM.LEATHER,min:0,max:2}])},
  chicken:{name:'Galinha',kind:'passive',health:4,speed:1.1,damage:0,loot:new LootTable([{id:ITEM.RAW_CHICKEN,min:1,max:1},{id:ITEM.SEEDS,chance:0.25}])},
  sheep:{name:'Ovelha',kind:'passive',health:8,speed:1.05,damage:0,loot:new LootTable([{id:ITEM.WOOL,min:1,max:2}])},
  rabbit:{name:'Coelho',kind:'passive',health:6,speed:1.8,damage:0,loot:new LootTable([{id:ITEM.LEATHER,chance:0.18,min:1,max:1}])},
  fish:{name:'Peixe',kind:'aquatic',health:4,speed:1.2,damage:0,loot:new LootTable([{id:ITEM.FISH,min:1,max:1}])},
  wolf:{name:'Lobo',kind:'neutral',health:16,speed:1.8,damage:4,loot:new LootTable([])},
  villager:{name:'Aldeão',kind:'npc',health:20,speed:1.05,damage:0,loot:new LootTable([])},
  zombie:{name:'Zumbi',kind:'hostile',health:20,speed:1.35,damage:3,loot:new LootTable([{id:ITEM.IRON_INGOT,chance:0.025},{id:ITEM.STICK,chance:0.15}])},
  skeleton:{name:'Esqueleto',kind:'ranged',health:20,speed:1.25,damage:4,loot:new LootTable([{id:ITEM.ARROW,min:0,max:2},{id:ITEM.BOW,chance:0.04}])},
  spider:{name:'Aranha',kind:'hostile',health:16,speed:1.75,damage:3,loot:new LootTable([{id:ITEM.STRING,min:0,max:2}])},
  creeper:{name:'Rastejante',kind:'explosive',health:20,speed:1.15,damage:0,loot:new LootTable([{id:ITEM.COAL,min:1,max:2}])},
  slime:{name:'Slime',kind:'hostile',health:12,speed:1.0,damage:2,loot:new LootTable([{id:ITEM.FLUX_DUST,chance:0.5,min:1,max:2}])},
  emberling:{name:'Emberling',kind:'hostile',health:24,speed:1.45,damage:5,loot:new LootTable([{id:ITEM.EMBER_CRYSTAL,chance:0.35,min:1,max:2}])},
  voidling:{name:'Voidling',kind:'ranged',health:26,speed:1.4,damage:5,loot:new LootTable([{id:ITEM.ENDER_SHARD,chance:0.45,min:1,max:2}])},
  void_titan:{name:'Titã do Vazio',kind:'boss',health:240,speed:1.2,damage:10,loot:new LootTable([{id:ITEM.VOID_EYE,min:1,max:1},{id:ITEM.DIAMOND,min:4,max:8}])}
});

const PROFESSIONS=['fazendeiro','ferreiro','caçador','engenheiro','cartógrafo'];
let NEXT_ENTITY_ID=1;

export class Entity {
  constructor(type,x,y,z){
    const def=ENTITY_DEFS[type];
    if(!def) throw new Error(`Unknown entity ${type}`);
    this.id=NEXT_ENTITY_ID++;
    this.type=type;
    this.kind=def.kind;
    this.x=x; this.y=y; this.z=z;
    this.vx=0; this.vy=0; this.vz=0;
    this.health=def.health; this.maxHealth=def.health;
    this.dead=false; this.age=0; this.state='idle'; this.target=null;
    this.path=[]; this.pathTimer=0; this.attackTimer=0; this.wanderTimer=0;
    this.hurtTimer=0; this.fuse=0; this.love=0; this.owner=null; this.data={};
  }
  distanceTo(point){ return Math.hypot(this.x-point.x,this.y-point.y,this.z-point.z); }
  serialize(){
    return {id:this.id,type:this.type,x:this.x,y:this.y,z:this.z,vx:this.vx,vy:this.vy,vz:this.vz,health:this.health,age:this.age,state:this.state,love:this.love,owner:this.owner,data:this.data};
  }
  static from(raw){
    if(!raw||!ENTITY_DEFS[raw.type]) return null;
    const entity=new Entity(raw.type,Number(raw.x)||0,Number(raw.y)||0,Number(raw.z)||0);
    entity.id=Number(raw.id)||entity.id;
    NEXT_ENTITY_ID=Math.max(NEXT_ENTITY_ID,entity.id+1);
    entity.vx=Number(raw.vx)||0; entity.vy=Number(raw.vy)||0; entity.vz=Number(raw.vz)||0;
    entity.health=Math.max(0,Math.min(entity.maxHealth,Number(raw.health)||entity.maxHealth));
    entity.age=Math.max(0,Number(raw.age)||0);
    entity.state=String(raw.state||'idle'); entity.love=Math.max(0,Number(raw.love)||0);
    entity.owner=raw.owner??null; entity.data=raw.data&&typeof raw.data==='object'?{...raw.data}:{};
    return entity;
  }
}

export class Projectile {
  constructor(type,x,y,z,vx,vy,vz,owner=null,damage=4){
    this.id=NEXT_ENTITY_ID++; this.type=type; this.x=x; this.y=y; this.z=z;
    this.vx=vx; this.vy=vy; this.vz=vz; this.owner=owner; this.damage=damage;
    this.age=0; this.dead=false;
  }
}

export class EntityManagerV1 {
  constructor(world,{seed=1,onDamagePlayer=null,onDrop=null,onExplode=null}={}){
    this.world=world; this.random=seedRandom(seed^0xabc123);
    this.entities=[]; this.projectiles=[]; this.spawnTimer=0; this.npcTimer=0;
    this.onDamagePlayer=onDamagePlayer; this.onDrop=onDrop; this.onExplode=onExplode;
    this.maxEntities=48; this.pathCache=new Map(); this.flags={bossDefeated:false};
  }

  spawn(type,x,y,z,data=null){
    if(!ENTITY_DEFS[type]) return null;
    const entity=new Entity(type,x,y,z);
    if(data&&typeof data==='object') entity.data={...entity.data,...data};
    if(type==='villager') this.initializeVillager(entity);
    this.entities.push(entity);
    return entity;
  }

  initializeVillager(entity){
    if(!entity.data.profession) entity.data.profession=PROFESSIONS[Math.floor(this.random()*PROFESSIONS.length)];
    if(!entity.data.home) entity.data.home={x:entity.x,z:entity.z};
    if(!entity.data.work) entity.data.work={x:entity.data.home.x+(this.random()-.5)*5,z:entity.data.home.z+(this.random()-.5)*5};
    entity.data.reputation=Number(entity.data.reputation)||0;
  }

  spawnBoss(x,y,z){ if(this.entities.some((e)=>e.type==='void_titan'&&!e.dead)) return null; return this.spawn('void_titan',x,y,z); }
  summon(type,x,y,z){ return this.spawn(type,x,y,z); }
  removeDead(){ this.entities=this.entities.filter((e)=>!e.dead); this.projectiles=this.projectiles.filter((p)=>!p.dead); }

  tick(dt,player,{daylight=1,difficulty='normal',doMobSpawning=true}={}){
    this.spawnTimer-=dt; this.npcTimer-=dt;
    if(doMobSpawning&&difficulty!=='peaceful'&&this.spawnTimer<=0){
      this.spawnTimer=1.8+this.random()*1.8;
      this.tryNaturalSpawn(player,daylight,difficulty);
    }
    if(this.world.dimension==='overworld'&&this.npcTimer<=0){
      this.npcTimer=4;
      this.ensureTradingPostResidents(player);
    }
    for(const entity of this.entities){
      if(entity.dead) continue;
      entity.age+=dt; entity.attackTimer=Math.max(0,entity.attackTimer-dt);
      entity.hurtTimer=Math.max(0,entity.hurtTimer-dt); entity.pathTimer-=dt;
      entity.wanderTimer-=dt; entity.love=Math.max(0,entity.love-dt);
      this.tickEntity(entity,dt,player,daylight);
    }
    this.tickProjectiles(dt,player);
    this.tickBreeding(dt);
    this.removeDead();
  }

  tryNaturalSpawn(player,daylight,difficulty){
    if(this.entities.length>=this.maxEntities) return;
    const dimension=this.world.dimension;
    let pool;
    if(dimension==='emberdeep') pool=['emberling','slime'];
    else if(dimension==='voidlands') pool=['voidling'];
    else if(daylight<0.38) pool=['zombie','skeleton','spider','creeper','slime'];
    else pool=['pig','cow','chicken','sheep','rabbit','wolf'];
    const angle=this.random()*Math.PI*2, radius=14+this.random()*22;
    const x=Math.floor(player.x+Math.cos(angle)*radius)+0.5, z=Math.floor(player.z+Math.sin(angle)*radius)+0.5;
    const biome=this.world.biomeAt(x,z);
    if(dimension==='overworld'&&['ocean','deep_ocean'].includes(biome)&&this.random()<0.7){
      const y=20+this.random()*4;
      if(this.world.getBlock(Math.floor(x),Math.floor(y),Math.floor(z))!==0) this.spawn('fish',x,y,z);
      return;
    }
    const y=this.world.surfaceY(x,z);
    if(!this.world.isWalkable(x,y,z)) return;
    this.spawn(pool[Math.floor(this.random()*pool.length)],x,y,z);
  }

  ensureTradingPostResidents(player){
    const huts=[];
    for(const raw of this.world.generatedStructures||[]){
      const [kind,coords]=String(raw).split(':');
      if(kind!=='hut') continue;
      const [x,z]=String(coords||'').split(',').map(Number);
      if(!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(player.x-x,player.z-z)>72) continue;
      huts.push({x,z});
    }
    for(const hut of huts){
      const residents=this.entities.filter((e)=>e.type==='villager'&&e.data.home&&Math.hypot(e.data.home.x-hut.x,e.data.home.z-hut.z)<8&&!e.dead);
      while(residents.length<2&&this.entities.length<this.maxEntities){
        const x=hut.x+(this.random()-.5)*3, z=hut.z+(this.random()-.5)*3, y=this.world.surfaceY(x,z);
        const villager=this.spawn('villager',x,y,z,{home:{x:hut.x,z:hut.z}});
        if(!villager) break;
        residents.push(villager);
      }
    }
  }

  tickEntity(entity,dt,player,daylight){
    const def=ENTITY_DEFS[entity.type], distance=entity.distanceTo(player);
    if(distance>72&&def.kind!=='boss'&&def.kind!=='npc'){ entity.dead=true; return; }
    if(def.kind==='npc'){ this.tickVillager(entity,dt,player); return; }
    if(def.kind==='aquatic'){ this.tickAquatic(entity,dt); return; }
    if(def.kind==='passive'){
      if(distance<3.2){ entity.state='flee'; this.moveDirection(entity,-(player.x-entity.x),-(player.z-entity.z),def.speed*1.5,dt); }
      else this.wander(entity,def.speed,dt);
      return;
    }
    if(def.kind==='neutral'&&!entity.data.angry){
      if(distance<2.4) this.moveDirection(entity,-(player.x-entity.x),-(player.z-entity.z),def.speed,dt);
      else this.wander(entity,def.speed,dt);
      return;
    }
    if(def.kind==='ranged'){
      if(distance<14){
        entity.state='attack';
        if(distance<6) this.moveDirection(entity,-(player.x-entity.x),-(player.z-entity.z),def.speed,dt);
        else if(distance>10) this.moveToward(entity,player,def.speed,dt);
        if(entity.attackTimer<=0){ entity.attackTimer=1.6; this.shootAt(entity,player,def.damage); }
      } else this.wander(entity,def.speed,dt);
      return;
    }
    if(def.kind==='explosive'){
      if(distance<6){
        entity.state='fuse'; this.moveToward(entity,player,def.speed,dt);
        if(distance<2.5) entity.fuse+=dt; else entity.fuse=Math.max(0,entity.fuse-dt*0.5);
        if(entity.fuse>=1.6){ entity.dead=true; this.onExplode?.(entity.x,entity.y,entity.z,3.5); }
      } else { entity.fuse=0; this.wander(entity,def.speed,dt); }
      return;
    }
    if(def.kind==='boss'){ this.tickBoss(entity,dt,player); return; }
    if(distance<16){
      entity.state='chase'; this.moveToward(entity,player,def.speed,dt);
      if(distance<1.55&&entity.attackTimer<=0){ entity.attackTimer=0.9; this.onDamagePlayer?.(def.damage,entity.type); }
    } else this.wander(entity,def.speed,dt);
  }

  tickVillager(entity,dt,player){
    this.initializeVillager(entity);
    const threat=this.nearestThreat(entity,9);
    if(threat){
      entity.state='flee';
      this.moveDirection(entity,entity.x-threat.x,entity.z-threat.z,ENTITY_DEFS.villager.speed*1.55,dt);
      return;
    }
    if(entity.distanceTo(player)<2.5){ entity.state='trade'; entity.vx=entity.vz=0; return; }
    const time=this.world.time%1;
    const home=entity.data.home, work=entity.data.work;
    let destination=null;
    if(time>=0.22&&time<0.58){ entity.state='work'; destination=work; }
    else if(time>=0.65||time<0.08){ entity.state='home'; destination=home; }
    if(destination&&Math.hypot(entity.x-destination.x,entity.z-destination.z)>1.7){
      const y=this.world.surfaceY(destination.x,destination.z);
      this.moveToward(entity,{x:destination.x,y,z:destination.z},ENTITY_DEFS.villager.speed,dt);
      return;
    }
    if(Math.hypot(entity.x-home.x,entity.z-home.z)>11){
      const y=this.world.surfaceY(home.x,home.z);
      this.moveToward(entity,{x:home.x,y,z:home.z},ENTITY_DEFS.villager.speed,dt);
      return;
    }
    entity.state='social';
    this.wander(entity,ENTITY_DEFS.villager.speed*0.7,dt);
  }

  nearestThreat(entity,radius){
    let best=null,bestDistance=radius;
    for(const other of this.entities){
      if(other.dead||other===entity||!['hostile','ranged','explosive','boss'].includes(ENTITY_DEFS[other.type]?.kind)) continue;
      const distance=Math.hypot(entity.x-other.x,entity.z-other.z);
      if(distance<bestDistance){ best=other; bestDistance=distance; }
    }
    return best;
  }

  tickAquatic(entity,dt){
    const def=ENTITY_DEFS[entity.type];
    if(this.world.getBlock(Math.floor(entity.x),Math.floor(entity.y),Math.floor(entity.z))===0){
      entity.health-=dt*2;
      if(entity.health<=0){ entity.dead=true; return; }
    }
    if(entity.wanderTimer<=0){
      entity.wanderTimer=1+this.random()*3;
      const angle=this.random()*Math.PI*2;
      entity.data.wdx=Math.cos(angle); entity.data.wdz=Math.sin(angle);
      entity.data.wdy=(this.random()-.5)*0.5;
    }
    const nx=entity.x+(entity.data.wdx||0)*def.speed*dt;
    const ny=entity.y+(entity.data.wdy||0)*def.speed*dt;
    const nz=entity.z+(entity.data.wdz||0)*def.speed*dt;
    const id=this.world.getBlock(Math.floor(nx),Math.floor(ny),Math.floor(nz));
    if(id!==0){ entity.x=nx; entity.y=ny; entity.z=nz; }
    else entity.wanderTimer=0;
  }

  tickBoss(entity,dt,player){
    const def=ENTITY_DEFS[entity.type], distance=entity.distanceTo(player);
    const phase=entity.health/entity.maxHealth>0.66?1:entity.health/entity.maxHealth>0.33?2:3;
    entity.data.phase=phase;
    if(distance>5) this.moveToward(entity,player,def.speed+(phase-1)*0.25,dt);
    if(entity.attackTimer<=0){
      entity.attackTimer=Math.max(0.55,1.7-phase*0.25);
      if(distance<3.2) this.onDamagePlayer?.(def.damage+phase*2,entity.type);
      else for(let i=0;i<phase;i++) this.shootAt(entity,{x:player.x+(this.random()-.5)*3,y:player.y,z:player.z+(this.random()-.5)*3},6+phase);
    }
  }

  moveToward(entity,target,speed,dt){
    if(entity.pathTimer<=0){
      entity.pathTimer=0.7+this.random()*0.4;
      entity.path=findPath2D(this.world,entity,target,12,120)||[];
    }
    if(entity.path.length){
      const node=entity.path[0], dx=node.x-entity.x, dz=node.z-entity.z;
      if(Math.hypot(dx,dz)<0.45) entity.path.shift();
      else this.moveDirection(entity,dx,dz,speed,dt);
    } else this.moveDirection(entity,target.x-entity.x,target.z-entity.z,speed,dt);
  }

  moveDirection(entity,dx,dz,speed,dt){
    const length=Math.hypot(dx,dz);
    if(length<0.001) return;
    dx/=length; dz/=length;
    const nx=entity.x+dx*speed*dt, nz=entity.z+dz*speed*dt, ny=this.world.surfaceY(nx,nz);
    if(Math.abs(ny-entity.y)<=1.1&&this.world.isWalkable(nx,ny,nz)){
      entity.x=nx; entity.z=nz; entity.y+=(ny-entity.y)*Math.min(1,dt*10);
      entity.vx=dx*speed; entity.vz=dz*speed;
    } else entity.wanderTimer=0;
  }

  wander(entity,speed,dt){
    if(entity.wanderTimer<=0){
      entity.wanderTimer=1+this.random()*3.5;
      const angle=this.random()*Math.PI*2;
      entity.data.wdx=Math.cos(angle); entity.data.wdz=Math.sin(angle);
      if(this.random()<0.22){ entity.data.wdx=0; entity.data.wdz=0; }
    }
    this.moveDirection(entity,entity.data.wdx||0,entity.data.wdz||0,speed*0.65,dt);
  }

  shootAt(entity,target,damage){
    const dx=target.x-entity.x, dy=(target.y+1)-(entity.y+1.2), dz=target.z-entity.z;
    const length=Math.hypot(dx,dz)||1, speed=9;
    this.projectiles.push(new Projectile('arrow',entity.x,entity.y+1.25,entity.z,dx/length*speed,dy/length*speed,dz/length*speed,entity.id,damage));
  }

  tickProjectiles(dt,player){
    for(const projectile of this.projectiles){
      if(projectile.dead) continue;
      projectile.age+=dt;
      if(projectile.age>10){ projectile.dead=true; continue; }
      projectile.vy-=9.8*dt;
      projectile.x+=projectile.vx*dt; projectile.y+=projectile.vy*dt; projectile.z+=projectile.vz*dt;
      if(this.world.getBlock(Math.floor(projectile.x),Math.floor(projectile.y),Math.floor(projectile.z))!==0){ projectile.dead=true; continue; }
      if(Math.hypot(projectile.x-player.x,projectile.y-player.y-0.9,projectile.z-player.z)<0.75){
        projectile.dead=true; this.onDamagePlayer?.(projectile.damage,'projectile');
      }
    }
  }

  attack(entity,damage,source=null){
    if(!entity||entity.dead||damage<=0) return null;
    entity.health-=damage; entity.hurtTimer=0.25;
    if(source){
      const dx=entity.x-source.x,dz=entity.z-source.z,length=Math.hypot(dx,dz)||1;
      entity.x+=dx/length*0.45; entity.z+=dz/length*0.45;
    }
    if(entity.health>0){
      if(entity.kind==='neutral') entity.data.angry=true;
      return {killed:false};
    }
    entity.dead=true;
    const drops=ENTITY_DEFS[entity.type].loot.roll({type:entity.type},this.random);
    for(const [id,count] of drops) this.onDrop?.(id,count,entity.x,entity.y,entity.z);
    if(entity.type==='void_titan') this.flags.bossDefeated=true;
    return {killed:true,drops};
  }

  feed(entity,itemId){
    if(!entity||entity.dead||!['pig','cow','chicken','sheep','wolf','rabbit'].includes(entity.type)) return false;
    const accepted=entity.type==='chicken'||entity.type==='rabbit' ? itemId===ITEM.SEEDS : [ITEM.WHEAT,ITEM.RAW_PORK].includes(itemId);
    if(!accepted) return false;
    entity.love=30;
    if(entity.type==='wolf'&&itemId===ITEM.RAW_PORK) entity.owner='player';
    return true;
  }

  tickBreeding(dt){
    for(let i=0;i<this.entities.length;i++){
      const a=this.entities[i];
      if(a.love<=0||!['passive','neutral'].includes(a.kind)) continue;
      for(let j=i+1;j<this.entities.length;j++){
        const b=this.entities[j];
        if(b.type!==a.type||b.love<=0||Math.hypot(a.x-b.x,a.z-b.z)>2) continue;
        a.love=b.love=0;
        const baby=this.spawn(a.type,(a.x+b.x)/2,a.y,(a.z+b.z)/2);
        if(baby){ baby.data.baby=true; baby.data.grow=120; }
        break;
      }
    }
    for(const entity of this.entities){
      if(!entity.data.baby) continue;
      entity.data.grow-=dt;
      if(entity.data.grow<=0) entity.data.baby=false;
    }
  }

  nearbyVillager(point,radius=7){
    let best=null,bestDistance=radius;
    for(const entity of this.entities){
      if(entity.dead||entity.type!=='villager') continue;
      const distance=entity.distanceTo(point);
      if(distance<bestDistance){ best=entity; bestDistance=distance; }
    }
    return best;
  }

  serialize(){ return {entities:this.entities.filter((e)=>!e.dead).map((e)=>e.serialize()),flags:{...this.flags}}; }
  load(raw){
    this.entities=[];
    for(const data of Array.isArray(raw?.entities)?raw.entities:[]){
      const entity=Entity.from(data);
      if(entity){ if(entity.type==='villager') this.initializeVillager(entity); this.entities.push(entity); }
    }
    this.flags={bossDefeated:Boolean(raw?.flags?.bossDefeated)};
  }
}

export function findPath2D(world,start,target,radius=12,maxNodes=160){
  const sx=Math.floor(start.x),sz=Math.floor(start.z),tx=Math.floor(target.x),tz=Math.floor(target.z);
  if(Math.hypot(tx-sx,tz-sz)>radius*2) return null;
  const open=[{x:sx,z:sz,g:0,f:heuristic(sx,sz,tx,tz)}];
  const came=new Map(),gScore=new Map([[`${sx},${sz}`,0]]),closed=new Set();
  let nodes=0;
  while(open.length&&nodes++<maxNodes){
    open.sort((a,b)=>a.f-b.f);
    const current=open.shift(), currentKey=`${current.x},${current.z}`;
    if(closed.has(currentKey)) continue;
    closed.add(currentKey);
    if(current.x===tx&&current.z===tz) return reconstruct(came,current.x,current.z).slice(1);
    const currentY=world.surfaceY(current.x+0.5,current.z+0.5);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=current.x+dx,nz=current.z+dz;
      if(Math.abs(nx-sx)>radius||Math.abs(nz-sz)>radius) continue;
      const ny=world.surfaceY(nx+0.5,nz+0.5);
      if(Math.abs(ny-currentY)>1.05||!world.isWalkable(nx+0.5,ny,nz+0.5)) continue;
      const nextKey=`${nx},${nz}`, tentative=current.g+1+Math.abs(ny-currentY)*0.3;
      if(tentative>=(gScore.get(nextKey)??Infinity)) continue;
      came.set(nextKey,currentKey); gScore.set(nextKey,tentative);
      open.push({x:nx,z:nz,g:tentative,f:tentative+heuristic(nx,nz,tx,tz)});
    }
  }
  return null;
}

function reconstruct(came,x,z){
  const path=[{x:x+0.5,z:z+0.5}];
  let key=`${x},${z}`,guard=0;
  while(came.has(key)&&guard++<256){
    key=came.get(key);
    const [a,b]=key.split(',').map(Number);
    path.push({x:a+0.5,z:b+0.5});
  }
  return path.reverse();
}
function heuristic(x,z,tx,tz){ return Math.abs(tx-x)+Math.abs(tz-z); }
