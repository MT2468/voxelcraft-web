import { BLOCK, DIMENSIONS, blockDef, isSolid, itemDef } from './catalog.js';
import { ABLOCK, registerAdvancedContent } from './advanced-content.js';

registerAdvancedContent();

const DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const key3 = (x,y,z) => `${x},${y},${z}`;
const FLUX_BLOCKS = new Set([
  BLOCK.FLUX_WIRE, BLOCK.FLUX_LAMP, BLOCK.LEVER, BLOCK.PISTON,
  ABLOCK.REPEATER, ABLOCK.OBSERVER, ABLOCK.COMPARATOR,
  ABLOCK.DISPENSER, ABLOCK.POWERED_RAIL, ABLOCK.STICKY_PISTON
]);
const PASSIVE_CONDUCTORS = new Set([
  BLOCK.FLUX_WIRE, BLOCK.FLUX_LAMP, BLOCK.LEVER, BLOCK.PISTON,
  ABLOCK.DISPENSER, ABLOCK.POWERED_RAIL, ABLOCK.STICKY_PISTON
]);

export class GameRules {
  constructor(){
    this.values={
      keepInventory:false, doDaylightCycle:true, doWeatherCycle:true,
      doMobSpawning:true, doFireTick:true, doCropTick:true,
      mobGriefing:true, naturalRegeneration:true, showCoordinates:false
    };
  }
  get(name){ return this.values[name]; }
  set(name,value){ if(!(name in this.values)) return false; this.values[name]=Boolean(value); return true; }
  serialize(){ return {...this.values}; }
  load(raw){ for(const name of Object.keys(this.values)) if(typeof raw?.[name]==='boolean') this.values[name]=raw[name]; }
}

export class FluxSystem {
  constructor(world){
    this.world=world;
    this.dirty=true;
    this.powered=new Set();
    this.lastUpdate=0;
    this.clock=0;
    this.hopperTimer=0;
    this.observerPulses=new Map();
    this.repeaterPending=new Map();
    this.dispenserLatched=new Set();
    this.unsubscribe=world.onChange((event)=>this.onWorldChange(event));
  }

  dispose(){ this.unsubscribe?.(); }

  onWorldChange(event){
    if(event.type!=='block') return;
    this.dirty=true;
    for(const [dx,dy,dz] of DIRS){
      const x=event.x+dx, y=event.y+dy, z=event.z+dz;
      if(this.world.getBlock(x,y,z)!==ABLOCK.OBSERVER) continue;
      const key=key3(x,y,z);
      this.observerPulses.set(key,this.clock+0.22);
      const state=this.world.getState(x,y,z)||{};
      this.world.setState(x,y,z,{...state,pulse:true});
    }
  }

  toggleLever(x,y,z){
    if(this.world.getBlock(x,y,z)!==BLOCK.LEVER) return false;
    const state=this.world.getState(x,y,z)||{};
    this.world.setState(x,y,z,{...state,on:!state.on});
    this.dirty=true;
    return !state.on;
  }

  isPowered(x,y,z){ return this.powered.has(key3(x,y,z)); }

  tick(dt){
    this.clock+=dt;
    this.lastUpdate+=dt;
    this.hopperTimer+=dt;

    if(this.hopperTimer>=0.5){
      this.hopperTimer=0;
      this.tickHoppers();
    }

    for(const [key,until] of this.observerPulses){
      if(until>this.clock) continue;
      this.observerPulses.delete(key);
      const [x,y,z]=key.split(',').map(Number);
      const state=this.world.getState(x,y,z)||{};
      this.world.setState(x,y,z,{...state,pulse:false});
      this.dirty=true;
    }

    if(!this.dirty && this.lastUpdate<0.1) return;
    this.lastUpdate=0;
    this.dirty=false;

    const old=this.powered;
    const preliminary=this.propagate(this.collectSources(false));
    this.updateRepeaters(preliminary);
    this.powered=this.propagate(this.collectSources(true));
    this.applyPoweredStates(old);
  }

  collectSources(includeRepeaters){
    const sources=[];
    for(const chunk of this.world.chunks.values()){
      const startX=chunk.cx*16, startZ=chunk.cz*16;
      for(let lx=0;lx<16;lx++) for(let lz=0;lz<16;lz++) for(let y=0;y<96;y++){
        const id=chunk.get(lx,y,lz);
        if(!FLUX_BLOCKS.has(id)) continue;
        const x=startX+lx, z=startZ+lz, key=key3(x,y,z);
        const state=this.world.getState(x,y,z)||{};
        if(id===BLOCK.LEVER && state.on) sources.push([x,y,z,15]);
        else if(id===ABLOCK.OBSERVER && this.observerPulses.has(key)) sources.push([x,y,z,15]);
        else if(id===ABLOCK.COMPARATOR){
          const signal=this.comparatorSignal(x,y,z,state);
          if(signal>0) sources.push([x,y,z,signal]);
        } else if(includeRepeaters && id===ABLOCK.REPEATER && state.on){
          sources.push([x,y,z,15]);
        }
      }
    }
    return sources;
  }

  propagate(sources){
    const powered=new Set();
    const queue=[...sources];
    const seen=new Map();
    let steps=0;
    while(queue.length && steps++<8192){
      const [x,y,z,power]=queue.shift();
      const key=key3(x,y,z);
      if((seen.get(key)??-1)>=power) continue;
      seen.set(key,power);
      powered.add(key);
      if(power<=1) continue;
      for(const [dx,dy,dz] of DIRS){
        const nx=x+dx, ny=y+dy, nz=z+dz;
        if(PASSIVE_CONDUCTORS.has(this.world.getBlock(nx,ny,nz))) queue.push([nx,ny,nz,power-1]);
      }
    }
    return powered;
  }

  updateRepeaters(preliminary){
    for(const chunk of this.world.chunks.values()){
      const startX=chunk.cx*16, startZ=chunk.cz*16;
      for(let lx=0;lx<16;lx++) for(let lz=0;lz<16;lz++) for(let y=0;y<96;y++){
        if(chunk.get(lx,y,lz)!==ABLOCK.REPEATER) continue;
        const x=startX+lx, z=startZ+lz, key=key3(x,y,z);
        const state=this.world.getState(x,y,z)||{facing:[1,0,0],delay:0.2,on:false};
        const [dx,dy,dz]=normalFacing(state.facing);
        const desired=preliminary.has(key3(x-dx,y-dy,z-dz));
        const pending=this.repeaterPending.get(key);
        if(desired===Boolean(state.on)){
          this.repeaterPending.delete(key);
          continue;
        }
        if(!pending || pending.desired!==desired){
          this.repeaterPending.set(key,{desired,due:this.clock+Math.max(0.05,Math.min(0.8,Number(state.delay)||0.2))});
          continue;
        }
        if(pending.due<=this.clock){
          this.world.setState(x,y,z,{...state,on:desired});
          this.repeaterPending.delete(key);
          this.dirty=true;
        }
      }
    }
  }

  comparatorSignal(x,y,z,state){
    const [dx,dy,dz]=normalFacing(state.facing);
    const entity=this.world.blockEntities.get(key3(x-dx,y-dy,z-dz));
    const slots=containerSlots(entity);
    if(!slots?.length) return 0;
    let fullness=0;
    for(const stack of slots){
      if(!stack?.id || stack.count<=0) continue;
      fullness+=Math.min(1,stack.count/(itemDef(stack.id)?.maxStack||64));
    }
    return fullness<=0 ? 0 : Math.max(1,Math.round(fullness/slots.length*15));
  }

  applyPoweredStates(old){
    const changed=new Set([...old,...this.powered]);
    for(const key of changed){
      const [x,y,z]=key.split(',').map(Number);
      const id=this.world.getBlock(x,y,z);
      const powered=this.powered.has(key);
      const state=this.world.getState(x,y,z)||{};
      if(id===BLOCK.FLUX_LAMP){
        if(Boolean(state.powered)!==powered){
          this.world.setState(x,y,z,{...state,powered});
          this.world.markNeighborsDirty(x,z);
        }
      } else if(id===BLOCK.PISTON) this.updatePiston(x,y,z,powered,false);
      else if(id===ABLOCK.STICKY_PISTON) this.updatePiston(x,y,z,powered,true);
      else if(id===ABLOCK.POWERED_RAIL){
        if(Boolean(state.powered)!==powered) this.world.setState(x,y,z,{...state,powered});
      } else if(id===ABLOCK.DISPENSER){
        const latched=this.dispenserLatched.has(key);
        if(powered && !latched){ this.dispenserLatched.add(key); this.dispense(x,y,z,state); }
        else if(!powered && latched) this.dispenserLatched.delete(key);
      }
    }
  }

  updatePiston(x,y,z,powered,sticky=false){
    const state=this.world.getState(x,y,z)||{facing:[1,0,0],extended:false};
    if(Boolean(state.extended)===powered) return;
    const [dx,dy,dz]=normalFacing(state.facing);
    if(powered){
      const tx=x+dx, ty=y+dy, tz=z+dz;
      const front=this.world.getBlock(tx,ty,tz);
      const beyond=this.world.getBlock(tx+dx,ty+dy,tz+dz);
      if(front!==BLOCK.AIR && !isSolid(beyond)) this.world.setBlock(tx+dx,ty+dy,tz+dz,front);
      if(front!==BLOCK.AIR) this.world.setBlock(tx,ty,tz,BLOCK.AIR);
      this.world.setState(x,y,z,{...state,extended:true,sticky});
      return;
    }
    if(sticky){
      const sx=x+dx*2, sy=y+dy*2, sz=z+dz*2;
      const pull=this.world.getBlock(sx,sy,sz);
      const front=this.world.getBlock(x+dx,y+dy,z+dz);
      if(pull!==BLOCK.AIR && front===BLOCK.AIR && pull!==BLOCK.BEDROCK){
        this.world.setBlock(x+dx,y+dy,z+dz,pull);
        this.world.setBlock(sx,sy,sz,BLOCK.AIR);
      }
    }
    this.world.setState(x,y,z,{...state,extended:false,sticky});
  }

  tickHoppers(){
    for(const chunk of this.world.chunks.values()){
      const startX=chunk.cx*16, startZ=chunk.cz*16;
      for(let lx=0;lx<16;lx++) for(let lz=0;lz<16;lz++) for(let y=0;y<96;y++){
        if(chunk.get(lx,y,lz)!==ABLOCK.HOPPER) continue;
        const x=startX+lx, z=startZ+lz;
        const state=this.world.getState(x,y,z)||{facing:[0,-1,0]};
        const [dx,dy,dz]=normalFacing(state.facing,[0,-1,0]);
        const self=ensureContainer(this.world,key3(x,y,z),5);
        const above=this.world.blockEntities.get(key3(x,y+1,z));
        const target=this.world.blockEntities.get(key3(x+dx,y+dy,z+dz));
        if(above) transferOne(above,self);
        if(target) transferOne(self,target);
      }
    }
  }

  dispense(x,y,z,state){
    const entity=ensureContainer(this.world,key3(x,y,z),9);
    const slots=containerSlots(entity);
    if(!slots) return;
    const index=slots.findIndex((stack)=>stack?.id&&stack.count>0);
    if(index<0) return;
    const stack=slots[index];
    const item={id:stack.id,count:1,data:stack.data?{...stack.data}:{}};
    stack.count--;
    if(stack.count<=0) slots[index]=null;
    const [dx,dy,dz]=normalFacing(state.facing);
    this.world.emit({type:'dispense',x:x+dx*0.8,y:y+dy*0.8,z:z+dz*0.8,dx,dy,dz,item});
  }

  serialize(){ return {observerPulses:[...this.observerPulses],repeaterPending:[...this.repeaterPending]}; }
}

export class MinecartSystem {
  constructor(world){ this.world=world; this.carts=[]; this.nextId=1; }

  spawn(x,y,z){
    const bx=Math.floor(x), by=Math.floor(y), bz=Math.floor(z);
    const at=this.world.getBlock(bx,by,bz), below=this.world.getBlock(bx,by-1,bz);
    if(![BLOCK.RAIL,ABLOCK.POWERED_RAIL].includes(at) && ![BLOCK.RAIL,ABLOCK.POWERED_RAIL].includes(below)) return null;
    const cart={id:this.nextId++,x:Number(x),y:Number(y),z:Number(z),vx:0,vz:0,speed:0,passenger:null};
    this.carts.push(cart);
    return cart;
  }

  push(cart,dx,dz,strength=4){
    if(!cart) return;
    const len=Math.hypot(dx,dz)||1;
    cart.vx=dx/len*strength;
    cart.vz=dz/len*strength;
    cart.speed=strength;
  }

  tick(dt){
    for(const cart of this.carts){
      const baseY=Math.floor(cart.y-0.2), cx=Math.floor(cart.x), cz=Math.floor(cart.z);
      const at=this.world.getBlock(cx,baseY,cz), above=this.world.getBlock(cx,baseY+1,cz);
      const railY=[BLOCK.RAIL,ABLOCK.POWERED_RAIL].includes(at)?baseY:baseY+1;
      const here=[BLOCK.RAIL,ABLOCK.POWERED_RAIL].includes(at)?at:above;
      if(![BLOCK.RAIL,ABLOCK.POWERED_RAIL].includes(here)){
        cart.speed=Math.max(0,cart.speed-dt*4);
        cart.vx*=0.96; cart.vz*=0.96;
        continue;
      }
      const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>
        [BLOCK.RAIL,ABLOCK.POWERED_RAIL].includes(this.world.getBlock(cx+dx,railY,cz+dz))
      );
      if(neighbors.length){
        const [dx,dz]=neighbors.sort((a,b)=>(b[0]*cart.vx+b[1]*cart.vz)-(a[0]*cart.vx+a[1]*cart.vz))[0];
        let magnitude=Math.max(1.4,Math.hypot(cart.vx,cart.vz));
        if(here===ABLOCK.POWERED_RAIL && this.world.getState(cx,railY,cz)?.powered) magnitude=Math.min(9,magnitude+dt*7);
        cart.vx=dx*magnitude; cart.vz=dz*magnitude;
      }
      cart.x+=cart.vx*dt; cart.z+=cart.vz*dt;
      cart.vx*=Math.pow(0.985,dt*60); cart.vz*=Math.pow(0.985,dt*60);
      cart.y=railY+0.45;
    }
  }

  serialize(){ return this.carts.map((c)=>({id:c.id,x:c.x,y:c.y,z:c.z,vx:c.vx,vz:c.vz})); }
  load(raw){
    this.carts=[];
    for(const c of Array.isArray(raw)?raw:[]){
      if(![c.x,c.y,c.z].every(Number.isFinite)) continue;
      this.carts.push({id:Number(c.id)||this.nextId++,x:c.x,y:c.y,z:c.z,vx:Number(c.vx)||0,vz:Number(c.vz)||0,speed:Math.hypot(c.vx||0,c.vz||0),passenger:null});
      this.nextId=Math.max(this.nextId,(Number(c.id)||0)+1);
    }
  }
}

export class BoatSystem {
  constructor(world){ this.world=world; this.boats=[]; this.nextId=1; }

  spawn(x,y,z){
    if(!isWaterAt(this.world,x,y,z) && !isWaterAt(this.world,x,y-1,z)) return null;
    const surface=waterSurface(this.world,x,y,z);
    const boat={id:this.nextId++,x,y:Number.isFinite(surface)?surface+0.28:y,z,yaw:0,vx:0,vz:0,passenger:null};
    this.boats.push(boat);
    return boat;
  }

  steer(boat,forward,turn,dt){
    if(!boat) return;
    boat.yaw+=turn*dt*1.8;
    const acceleration=5.5*forward;
    boat.vx+=Math.sin(boat.yaw)*acceleration*dt;
    boat.vz-=Math.cos(boat.yaw)*acceleration*dt;
  }

  tick(dt){
    for(const boat of this.boats){
      const water=isWaterAt(this.world,boat.x,boat.y,boat.z)||isWaterAt(this.world,boat.x,boat.y-1,boat.z);
      const drag=water ? 0.94 : 0.78;
      boat.x+=boat.vx*dt; boat.z+=boat.vz*dt;
      boat.vx*=Math.pow(drag,dt*60); boat.vz*=Math.pow(drag,dt*60);
      if(water){
        const surface=waterSurface(this.world,boat.x,boat.y,boat.z);
        if(Number.isFinite(surface)) boat.y+=(surface+0.28-boat.y)*Math.min(1,dt*8);
      }
    }
  }

  serialize(){ return this.boats.map((boat)=>({...boat,passenger:null})); }
  load(raw){
    this.boats=(Array.isArray(raw)?raw:[])
      .filter((boat)=>[boat.x,boat.y,boat.z].every(Number.isFinite))
      .map((boat)=>({...boat,id:Number(boat.id)||this.nextId++,passenger:null}));
    for(const boat of this.boats) this.nextId=Math.max(this.nextId,boat.id+1);
  }
}

export class PortalSystem {
  constructor(world){ this.world=world; this.cooldown=0; this.links=new Map(); }
  tick(dt){ this.cooldown=Math.max(0,this.cooldown-dt); }
  targetDimension(current){ return current==='overworld'?'emberdeep':current==='emberdeep'?'overworld':'overworld'; }
  createPortal(x,y,z,target=null){
    for(let dx=-1;dx<=1;dx++) for(let dy=0;dy<=2;dy++){
      if(this.world.getBlock(x+dx,y+dy,z)===BLOCK.AIR){
        this.world.setBlock(x+dx,y+dy,z,BLOCK.PORTAL,{state:{target:target||this.targetDimension(this.world.dimension)}});
      }
    }
    return true;
  }
  canTravel(x,y,z){ return this.cooldown<=0&&this.world.getBlock(Math.floor(x),Math.floor(y),Math.floor(z))===BLOCK.PORTAL; }
  travel(playerPosition){
    if(!this.canTravel(playerPosition.x,playerPosition.y,playerPosition.z)) return null;
    const state=this.world.getState(Math.floor(playerPosition.x),Math.floor(playerPosition.y),Math.floor(playerPosition.z))||{};
    const target=DIMENSIONS[state.target]?state.target:this.targetDimension(this.world.dimension);
    this.cooldown=3;
    return target;
  }
  serialize(){ return {links:[...this.links]}; }
  load(raw){ this.links=new Map(Array.isArray(raw?.links)?raw.links:[]); }
}

export function explode(world,x,y,z,power=4,{dropChance=0.3,random=Math.random}={}){
  const destroyed=[], radius=Math.ceil(power*2), candidates=[];
  for(let dx=-radius;dx<=radius;dx++) for(let dy=-radius;dy<=radius;dy++) for(let dz=-radius;dz<=radius;dz++){
    const distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(distance>radius) continue;
    const bx=Math.floor(x+dx), by=Math.floor(y+dy), bz=Math.floor(z+dz), id=world.getBlock(bx,by,bz);
    if(id===BLOCK.AIR||id===BLOCK.BEDROCK||id===BLOCK.PORTAL) continue;
    const resistance=blockDef(id)?.resistance??1;
    const strength=power*2-distance-resistance*0.35+(random()-0.5)*1.2;
    if(strength>0) candidates.push([bx,by,bz,id,distance]);
  }
  candidates.sort((a,b)=>a[4]-b[4]);
  for(const [bx,by,bz,id] of candidates){
    world.setBlock(bx,by,bz,BLOCK.AIR);
    destroyed.push({x:bx,y:by,z:bz,id,drop:random()<dropChance});
  }
  world.emit({type:'explosion',x,y,z,power,destroyed});
  return destroyed;
}

export function igniteTnt(world,x,y,z,delay=2.5,onExplode=null){
  if(world.getBlock(x,y,z)!==BLOCK.TNT) return false;
  world.setBlock(x,y,z,BLOCK.AIR);
  setTimeout(()=>{ const result=explode(world,x+0.5,y+0.5,z+0.5,4); onExplode?.(result); },Math.max(0,delay)*1000);
  return true;
}

export function findPortalFrame(world,x,y,z){
  for(const axis of ['x','z']){
    let ok=true;
    for(let i=-2;i<=2;i++){
      const bx=axis==='x'?x+i:x, bz=axis==='z'?z+i:z;
      if(world.getBlock(bx,y,bz)!==BLOCK.OBSIDIAN||world.getBlock(bx,y+4,bz)!==BLOCK.OBSIDIAN) ok=false;
    }
    for(let j=0;j<=4;j++){
      const ax=axis==='x'?x-2:x, az=axis==='z'?z-2:z;
      const bx=axis==='x'?x+2:x, bz=axis==='z'?z+2:z;
      if(world.getBlock(ax,y+j,az)!==BLOCK.OBSIDIAN||world.getBlock(bx,y+j,bz)!==BLOCK.OBSIDIAN) ok=false;
    }
    if(ok) return axis;
  }
  return null;
}

function normalFacing(value,fallback=[1,0,0]){
  if(!Array.isArray(value)||value.length!==3) return fallback;
  const vector=value.map(Number);
  if(vector.some((n)=>!Number.isFinite(n))) return fallback;
  const abs=vector.map(Math.abs), axis=abs.indexOf(Math.max(...abs)), out=[0,0,0];
  out[axis]=Math.sign(vector[axis])||1;
  return out;
}

function containerSlots(entity){
  if(Array.isArray(entity?.slots)) return entity.slots;
  if(Array.isArray(entity?.inventory?.slots)) return entity.inventory.slots;
  return null;
}

function ensureContainer(world,key,size){
  let entity=world.blockEntities.get(key);
  if(!entity){ entity={type:'container',slots:Array(size).fill(null)}; world.blockEntities.set(key,entity); }
  if(!containerSlots(entity)) entity.slots=Array(size).fill(null);
  return entity;
}

function transferOne(source,target){
  const from=containerSlots(source), to=containerSlots(target);
  if(!from||!to) return false;
  const sourceIndex=from.findIndex((stack)=>stack?.id&&stack.count>0);
  if(sourceIndex<0) return false;
  const sourceStack=from[sourceIndex], max=itemDef(sourceStack.id)?.maxStack||64;
  let targetIndex=to.findIndex((stack)=>stack?.id===sourceStack.id&&stack.count<max);
  if(targetIndex<0) targetIndex=to.findIndex((stack)=>!stack);
  if(targetIndex<0) return false;
  if(!to[targetIndex]) to[targetIndex]={id:sourceStack.id,count:0,data:sourceStack.data?{...sourceStack.data}:{}};
  to[targetIndex].count++;
  sourceStack.count--;
  if(sourceStack.count<=0) from[sourceIndex]=null;
  return true;
}

function isWaterAt(world,x,y,z){ return world.getBlock(Math.floor(x),Math.floor(y),Math.floor(z))===BLOCK.WATER; }
function waterSurface(world,x,y,z){
  const bx=Math.floor(x), bz=Math.floor(z);
  let yy=Math.max(0,Math.min(95,Math.floor(y)));
  if(world.getBlock(bx,yy,bz)!==BLOCK.WATER&&world.getBlock(bx,yy-1,bz)===BLOCK.WATER) yy--;
  if(world.getBlock(bx,yy,bz)!==BLOCK.WATER) return NaN;
  while(yy<95&&world.getBlock(bx,yy+1,bz)===BLOCK.WATER) yy++;
  return yy+1;
}
