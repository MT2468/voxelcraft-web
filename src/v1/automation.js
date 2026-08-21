import { BLOCK, BLOCKS, DIMENSIONS, blockDef, isSolid } from './catalog.js';

const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const k3=(x,y,z)=>`${x},${y},${z}`;

export class GameRules {
  constructor(){this.values={keepInventory:false,doDaylightCycle:true,doWeatherCycle:true,doMobSpawning:true,doFireTick:true,doCropTick:true,mobGriefing:true,naturalRegeneration:true,showCoordinates:false};}
  get(name){return this.values[name];}
  set(name,value){if(!(name in this.values))return false;this.values[name]=Boolean(value);return true;}
  serialize(){return{...this.values};}
  load(raw){for(const k of Object.keys(this.values))if(typeof raw?.[k]==='boolean')this.values[k]=raw[k];}
}

export class FluxSystem {
  constructor(world){this.world=world;this.dirty=true;this.powered=new Set();this.lastUpdate=0;this.unsubscribe=world.onChange((e)=>{if(e.type==='block'&&[BLOCK.FLUX_WIRE,BLOCK.FLUX_LAMP,BLOCK.LEVER,BLOCK.PISTON].includes(e.id))this.dirty=true;});}
  dispose(){this.unsubscribe?.();}
  toggleLever(x,y,z){if(this.world.getBlock(x,y,z)!==BLOCK.LEVER)return false;const state=this.world.getState(x,y,z)||{};this.world.setState(x,y,z,{...state,on:!state.on});this.dirty=true;return !state.on;}
  isPowered(x,y,z){return this.powered.has(k3(x,y,z));}
  tick(dt){this.lastUpdate+=dt;if(!this.dirty&&this.lastUpdate<0.15)return;this.lastUpdate=0;this.dirty=false;const old=this.powered;this.powered=new Set();const queue=[];
    for(const chunk of this.world.chunks.values()){
      const sx=chunk.cx*16,sz=chunk.cz*16;for(let lx=0;lx<16;lx++)for(let lz=0;lz<16;lz++)for(let y=0;y<96;y++)if(chunk.get(lx,y,lz)===BLOCK.LEVER&&this.world.getState(sx+lx,y,sz+lz)?.on)queue.push([sx+lx,y,sz+lz,15]);
    }
    const seen=new Map();let steps=0;while(queue.length&&steps++<4096){const[x,y,z,p]=queue.shift(),key=k3(x,y,z);if((seen.get(key)||-1)>=p)continue;seen.set(key,p);this.powered.add(key);if(p<=1)continue;for(const[dx,dy,dz]of dirs){const nx=x+dx,ny=y+dy,nz=z+dz,id=this.world.getBlock(nx,ny,nz);if(id===BLOCK.FLUX_WIRE||id===BLOCK.FLUX_LAMP||id===BLOCK.PISTON||id===BLOCK.LEVER)queue.push([nx,ny,nz,p-1]);}}
    for(const key of new Set([...old,...this.powered])){const[x,y,z]=key.split(',').map(Number),id=this.world.getBlock(x,y,z),powered=this.powered.has(key);if(id===BLOCK.FLUX_LAMP){const state=this.world.getState(x,y,z)||{};if(Boolean(state.powered)!==powered){this.world.setState(x,y,z,{...state,powered});this.world.markNeighborsDirty(x,z);}}
      if(id===BLOCK.PISTON)this.updatePiston(x,y,z,powered);
    }
  }
  updatePiston(x,y,z,powered){const state=this.world.getState(x,y,z)||{facing:[1,0,0],extended:false};if(Boolean(state.extended)===powered)return;const [dx,dy,dz]=Array.isArray(state.facing)?state.facing:[1,0,0];if(powered){const tx=x+dx,ty=y+dy,tz=z+dz,front=this.world.getBlock(tx,ty,tz),beyond=this.world.getBlock(tx+dx,ty+dy,tz+dz);if(front!==BLOCK.AIR&&!isSolid(beyond))this.world.setBlock(tx+dx,ty+dy,tz+dz,front);if(front!==BLOCK.AIR)this.world.setBlock(tx,ty,tz,BLOCK.AIR);this.world.setState(x,y,z,{...state,extended:true});}else this.world.setState(x,y,z,{...state,extended:false});}
  serialize(){return{};}
}

export class MinecartSystem {
  constructor(world){this.world=world;this.carts=[];this.nextId=1;}
  spawn(x,y,z){if(this.world.getBlock(x,Math.floor(y),z)!==BLOCK.RAIL&&this.world.getBlock(x,Math.floor(y)-1,z)!==BLOCK.RAIL)return null;const cart={id:this.nextId++,x:Number(x),y:Number(y),z:Number(z),vx:0,vz:0,speed:0,passenger:null};this.carts.push(cart);return cart;}
  push(cart,dx,dz,strength=4){if(!cart)return;const len=Math.hypot(dx,dz)||1;cart.vx=dx/len*strength;cart.vz=dz/len*strength;cart.speed=strength;}
  tick(dt){for(const cart of this.carts){const y=Math.floor(cart.y-0.2),cx=Math.floor(cart.x),cz=Math.floor(cart.z);const onRail=this.world.getBlock(cx,y,cz)===BLOCK.RAIL||this.world.getBlock(cx,y+1,cz)===BLOCK.RAIL;if(!onRail){cart.speed=Math.max(0,cart.speed-dt*4);cart.vx*=0.96;cart.vz*=0.96;continue;}const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>this.world.getBlock(cx+dx,y,cz+dz)===BLOCK.RAIL||this.world.getBlock(cx+dx,y+1,cz+dz)===BLOCK.RAIL);if(neighbors.length){const[dx,dz]=neighbors.sort((a,b)=>b[0]*cart.vx+b[1]*cart.vz-(a[0]*cart.vx+a[1]*cart.vz))[0];const mag=Math.max(1.4,Math.hypot(cart.vx,cart.vz));cart.vx=dx*mag;cart.vz=dz*mag;}cart.x+=cart.vx*dt;cart.z+=cart.vz*dt;cart.vx*=Math.pow(0.985,dt*60);cart.vz*=Math.pow(0.985,dt*60);cart.y=this.world.surfaceY(cart.x,cart.z)-0.2;}}
  serialize(){return this.carts.map((c)=>({id:c.id,x:c.x,y:c.y,z:c.z,vx:c.vx,vz:c.vz}));}
  load(raw){this.carts=[];for(const c of Array.isArray(raw)?raw:[])if([c.x,c.y,c.z].every(Number.isFinite)){this.carts.push({id:Number(c.id)||this.nextId++,x:c.x,y:c.y,z:c.z,vx:Number(c.vx)||0,vz:Number(c.vz)||0,speed:Math.hypot(c.vx||0,c.vz||0),passenger:null});this.nextId=Math.max(this.nextId,(Number(c.id)||0)+1);}}
}

export class PortalSystem {
  constructor(world){this.world=world;this.cooldown=0;this.links=new Map();}
  tick(dt){this.cooldown=Math.max(0,this.cooldown-dt);}
  targetDimension(current){return current==='overworld'?'emberdeep':current==='emberdeep'?'overworld':'overworld';}
  createPortal(x,y,z,target=null){for(let dx=-1;dx<=1;dx++)for(let dy=0;dy<=2;dy++)if(this.world.getBlock(x+dx,y+dy,z)===BLOCK.AIR)this.world.setBlock(x+dx,y+dy,z,BLOCK.PORTAL,{state:{target:target||this.targetDimension(this.world.dimension)}});return true;}
  canTravel(x,y,z){return this.cooldown<=0&&this.world.getBlock(Math.floor(x),Math.floor(y),Math.floor(z))===BLOCK.PORTAL;}
  travel(playerPosition){if(!this.canTravel(playerPosition.x,playerPosition.y,playerPosition.z))return null;const state=this.world.getState(Math.floor(playerPosition.x),Math.floor(playerPosition.y),Math.floor(playerPosition.z))||{};const target=DIMENSIONS[state.target]?state.target:this.targetDimension(this.world.dimension);this.cooldown=3;return target;}
  serialize(){return{links:[...this.links]};}
  load(raw){this.links=new Map(Array.isArray(raw?.links)?raw.links:[]);}
}

export function explode(world,x,y,z,power=4,{dropChance=0.3,random=Math.random}={}){
  const destroyed=[];const radius=Math.ceil(power*2);const candidates=[];
  for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)for(let dz=-radius;dz<=radius;dz++){
    const dist=Math.sqrt(dx*dx+dy*dy+dz*dz);if(dist>radius)continue;const bx=Math.floor(x+dx),by=Math.floor(y+dy),bz=Math.floor(z+dz),id=world.getBlock(bx,by,bz);if(id===BLOCK.AIR||id===BLOCK.BEDROCK||id===BLOCK.PORTAL)continue;const resistance=blockDef(id)?.resistance??1;const strength=power*2-dist-resistance*0.35+(random()-0.5)*1.2;if(strength>0)candidates.push([bx,by,bz,id,dist]);
  }
  candidates.sort((a,b)=>a[4]-b[4]);for(const[bx,by,bz,id]of candidates){world.setBlock(bx,by,bz,BLOCK.AIR);destroyed.push({x:bx,y:by,z:bz,id,drop:random()<dropChance});}
  world.emit({type:'explosion',x,y,z,power,destroyed});return destroyed;
}

export function igniteTnt(world,x,y,z,delay=2.5,onExplode=null){if(world.getBlock(x,y,z)!==BLOCK.TNT)return false;world.setBlock(x,y,z,BLOCK.AIR);setTimeout(()=>{const result=explode(world,x+0.5,y+0.5,z+0.5,4);onExplode?.(result);},Math.max(0,delay)*1000);return true;}

export function findPortalFrame(world,x,y,z){
  for(const axis of ['x','z']){let ok=true;for(let i=-2;i<=2;i++){const bx=axis==='x'?x+i:x,bz=axis==='z'?z+i:z;if(world.getBlock(bx,y,bz)!==BLOCK.OBSIDIAN||world.getBlock(bx,y+4,bz)!==BLOCK.OBSIDIAN)ok=false;}for(let j=0;j<=4;j++){const ax=axis==='x'?x-2:x,az=axis==='z'?z-2:z,bx=axis==='x'?x+2:x,bz=axis==='z'?z+2:z;if(world.getBlock(ax,y+j,az)!==BLOCK.OBSIDIAN||world.getBlock(bx,y+j,bz)!==BLOCK.OBSIDIAN)ok=false;}if(ok)return axis;}return null;
}
