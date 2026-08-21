import { SeededNoise } from '../noise.js';
import { BLOCK, BLOCKS, BIOMES, DIMENSIONS, blockDef, isOpaque, isLiquid, isSolid } from './catalog.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;
export const DEFAULT_RENDER_RADIUS = 3;
const VOLUME = CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE;
const FACE_DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

const key3 = (x,y,z) => `${x},${y},${z}`;
const key2 = (x,z) => `${x},${z}`;
const chunkKey = (cx,cz) => `${cx},${cz}`;
const floorDiv = (v,d) => Math.floor(v/d);
const mod = (v,d) => ((v%d)+d)%d;
const idx = (lx,y,lz) => y*CHUNK_SIZE*CHUNK_SIZE + lz*CHUNK_SIZE + lx;
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

export class ChunkV1 {
  constructor(cx,cz,blocks=null){this.cx=cx;this.cz=cz;this.blocks=blocks||new Uint8Array(VOLUME);this.dirty=true;this.mesh=null;this.liquidMesh=null;this.lastTouched=performanceNow();}
  get(lx,y,lz){if(y<0||y>=WORLD_HEIGHT)return BLOCK.AIR;return this.blocks[idx(lx,y,lz)]||BLOCK.AIR;}
  set(lx,y,lz,id){if(y<0||y>=WORLD_HEIGHT)return false;this.blocks[idx(lx,y,lz)]=id;this.dirty=true;this.lastTouched=performanceNow();return true;}
}

export class WeatherSystem {
  constructor(random=Math.random){this.random=random;this.type='clear';this.timer=180+random()*240;this.intensity=0;this.target=0;}
  tick(dt,dimension='overworld'){
    if(dimension!=='overworld'){this.type='clear';this.target=0;this.intensity=Math.max(0,this.intensity-dt);return;}
    this.timer-=dt;
    if(this.timer<=0){
      const r=this.random();this.type=r<0.62?'clear':r<0.88?'rain':'storm';
      this.target=this.type==='clear'?0:this.type==='rain'?0.65:1;
      this.timer=this.type==='clear'?180+this.random()*300:70+this.random()*180;
    }
    this.intensity += (this.target-this.intensity)*Math.min(1,dt*0.45);
  }
  serialize(){return{type:this.type,timer:this.timer,intensity:this.intensity,target:this.target};}
  load(raw){if(!raw)return;this.type=['clear','rain','storm'].includes(raw.type)?raw.type:'clear';this.timer=Math.max(1,Number(raw.timer)||120);this.intensity=clamp(Number(raw.intensity)||0,0,1);this.target=clamp(Number(raw.target)||0,0,1);}
}

export class WorldV1 {
  constructor(seed=1,dimension='overworld'){
    this.seed=Math.max(1,Math.floor(Number(seed)||1));this.dimension=DIMENSIONS[dimension]?dimension:'overworld';
    this.noise=new SeededNoise(this.seed + dimensionSalt(this.dimension));
    this.chunks=new Map();this.edits=new Map();this.states=new Map();this.blockEntities=new Map();
    this.fluidQueue=[];this.gravityQueue=[];this.randomTickAccumulator=0;this.fluidAccumulator=0;this.time=0.28;
    this.weather=new WeatherSystem(seedRandom(this.seed^0x9e3779b9));this.listeners=new Set();
    this.spawn={x:0.5,y:40,z:0.5};this.generatedStructures=new Set();
  }
  onChange(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(event){for(const fn of this.listeners)try{fn(event);}catch(e){console.warn('world listener',e);}}
  setDimension(id){
    if(!DIMENSIONS[id]||id===this.dimension)return false;
    this.dimension=id;this.noise=new SeededNoise(this.seed+dimensionSalt(id));this.clearLoaded();this.emit({type:'dimension',dimension:id});return true;
  }
  clearLoaded(){for(const chunk of this.chunks.values()){chunk.mesh?.geometry?.dispose?.();chunk.liquidMesh?.geometry?.dispose?.();}this.chunks.clear();}
  ensureChunk(cx,cz){const key=chunkKey(cx,cz);let c=this.chunks.get(key);if(!c){c=this.generateChunk(cx,cz);this.chunks.set(key,c);}c.lastTouched=performanceNow();return c;}
  unloadFar(centerCx,centerCz,radius=DEFAULT_RENDER_RADIUS+2){for(const [key,c] of this.chunks){if(Math.abs(c.cx-centerCx)>radius||Math.abs(c.cz-centerCz)>radius)this.chunks.delete(key);}}
  ensureAround(x,z,radius=DEFAULT_RENDER_RADIUS){const cx=floorDiv(x,CHUNK_SIZE),cz=floorDiv(z,CHUNK_SIZE);for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)this.ensureChunk(cx+dx,cz+dz);this.unloadFar(cx,cz,radius+2);}
  getBlock(x,y,z){
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<0||y>=WORLD_HEIGHT)return BLOCK.AIR;
    const edit=this.edits.get(key3(x,y,z));if(edit!=null)return edit;
    const c=this.ensureChunk(floorDiv(x,CHUNK_SIZE),floorDiv(z,CHUNK_SIZE));return c.get(mod(x,CHUNK_SIZE),y,mod(z,CHUNK_SIZE));
  }
  getState(x,y,z){return this.states.get(key3(Math.floor(x),Math.floor(y),Math.floor(z)))||null;}
  setState(x,y,z,state){const k=key3(Math.floor(x),Math.floor(y),Math.floor(z));if(state==null)this.states.delete(k);else this.states.set(k,{...state});}
  setBlock(x,y,z,id,{track=true,state=null,schedule=true}={}){
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<0||y>=WORLD_HEIGHT||!BLOCKS.has(id)&&id!==BLOCK.AIR)return false;
    const c=this.ensureChunk(floorDiv(x,CHUNK_SIZE),floorDiv(z,CHUNK_SIZE));c.set(mod(x,CHUNK_SIZE),y,mod(z,CHUNK_SIZE),id);
    const k=key3(x,y,z);if(track)this.edits.set(k,id);if(state)this.states.set(k,{...state});else if(id===BLOCK.AIR)this.states.delete(k);
    if(schedule){if(isLiquid(id))this.scheduleFluid(x,y,z);if(blockDef(id)?.gravity)this.gravityQueue.push([x,y,z]);for(const [dx,dy,dz] of FACE_DIRS){const n=this.getBlock(x+dx,y+dy,z+dz);if(isLiquid(n))this.scheduleFluid(x+dx,y+dy,z+dz);if(blockDef(n)?.gravity)this.gravityQueue.push([x+dx,y+dy,z+dz]);}}
    this.markNeighborsDirty(x,z);this.emit({type:'block',x,y,z,id});return true;
  }
  markNeighborsDirty(x,z){const cx=floorDiv(x,CHUNK_SIZE),cz=floorDiv(z,CHUNK_SIZE),lx=mod(x,CHUNK_SIZE),lz=mod(z,CHUNK_SIZE);this.ensureChunk(cx,cz).dirty=true;if(lx===0)this.ensureChunk(cx-1,cz).dirty=true;if(lx===15)this.ensureChunk(cx+1,cz).dirty=true;if(lz===0)this.ensureChunk(cx,cz-1).dirty=true;if(lz===15)this.ensureChunk(cx,cz+1).dirty=true;}
  generateChunk(cx,cz){
    const c=new ChunkV1(cx,cz);const startX=cx*CHUNK_SIZE,startZ=cz*CHUNK_SIZE;
    for(let lx=0;lx<CHUNK_SIZE;lx++)for(let lz=0;lz<CHUNK_SIZE;lz++){
      const x=startX+lx,z=startZ+lz;
      if(this.dimension==='overworld')this.generateOverworldColumn(c,lx,lz,x,z);
      else if(this.dimension==='emberdeep')this.generateEmberColumn(c,lx,lz,x,z);
      else this.generateVoidColumn(c,lx,lz,x,z);
    }
    if(this.dimension==='overworld'){this.decorateChunk(c);this.structurePass(c);}else if(this.dimension==='emberdeep')this.decorateEmber(c);else this.decorateVoid(c);
    this.applyEdits(c);return c;
  }
  climateAt(x,z){
    const temperature=this.noise.fbm2(x+700,z-400,0.0045,4,97),moisture=this.noise.fbm2(x-380,z+620,0.005,4,101),continental=this.noise.fbm2(x,z,0.0022,5,19),erosion=this.noise.fbm2(x+1300,z-800,0.0032,4,29);
    return{temperature,moisture,continental,erosion};
  }
  biomeAt(x,z){
    if(this.dimension==='emberdeep')return'emberdeep';if(this.dimension==='voidlands')return'voidlands';
    const c=this.climateAt(x,z),h=this.surfaceHeight(x,z);
    if(h<=15)return'deep_ocean';if(h<=21)return'ocean';if(h<=24)return'beach';if(h>=58)return'mountains';
    if(c.temperature<0.2)return'tundra';if(c.temperature<0.34)return'taiga';if(c.temperature>0.73&&c.moisture<0.44)return'desert';if(c.temperature>0.68&&c.moisture<0.64)return'savanna';if(c.moisture>0.8)return'swamp';if(c.moisture>0.63)return'forest';if(c.temperature>0.47&&c.temperature<0.62&&c.moisture>0.52&&this.noise.value2(x,z,0.0015,881)>0.76)return'cherry';return'plains';
  }
  surfaceHeight(x,z){
    if(this.dimension==='emberdeep')return 72;if(this.dimension==='voidlands')return this.voidSurface(x,z);
    const c=this.climateAt(x,z),macro=this.noise.fbm2(x,z,0.006,5,9),detail=this.noise.fbm2(x,z,0.022,3,11),ridge=Math.abs(this.noise.value2(x,z,0.012,71)-0.5)*2;
    const oceanBias=(c.continental-0.5)*24,mountain=Math.max(0,this.noise.fbm2(x+900,z-500,0.0035,4,88)-0.56)*65;
    return clamp(Math.floor(25+oceanBias+macro*12+detail*5+ridge*3+mountain),5,WORLD_HEIGHT-8);
  }
  caveAt(x,y,z,surface){if(y<=2||y>=surface-3)return false;const a=this.noise.value3(x,y,z,0.075,701),b=this.noise.value3(x+200,y*0.72,z-140,0.045,703),large=this.noise.value3(x-500,y*0.5,z+310,0.026,711);return(a>0.67&&b>0.48)||large>0.76;}
  oreAt(x,y,z){const r=this.noise.hash3(x,y,z,1301);if(y<=18&&r>0.989)return BLOCK.DIAMOND_ORE;if(y<=30&&r>0.976)return BLOCK.GOLD_ORE;if(y<=52&&r>0.949)return BLOCK.IRON_ORE;if(y<=70&&r>0.92)return BLOCK.COAL_ORE;return BLOCK.STONE;}
  generateOverworldColumn(c,lx,lz,x,z){
    const surface=this.surfaceHeight(x,z),biome=this.biomeAt(x,z),b=BIOMES[biome]||BIOMES.plains,sea=DIMENSIONS.overworld.sea;
    for(let y=0;y<=surface;y++){
      let id=BLOCK.STONE;if(y===0)id=BLOCK.BEDROCK;else if(this.caveAt(x,y,z,surface))id=BLOCK.AIR;else if(y===surface)id=b.top;else if(y>=surface-4)id=b.filler;else id=this.oreAt(x,y,z);
      if(id)c.set(lx,y,lz,id);
    }
    if(surface<sea)for(let y=surface+1;y<=sea;y++)c.set(lx,y,lz,biome==='tundra'&&y===sea?BLOCK.ICE:BLOCK.WATER);
    if(surface<sea-6&&this.noise.hash2(x,z,231)>0.992)c.set(lx,surface+1,lz,BLOCK.CLAY);
  }
  generateEmberColumn(c,lx,lz,x,z){
    const floor=7+Math.floor(this.noise.fbm2(x,z,0.018,3,41)*14),ceiling=76-Math.floor(this.noise.fbm2(x+200,z-90,0.015,3,43)*10);
    for(let y=0;y<WORLD_HEIGHT;y++){
      let id=BLOCK.AIR;if(y===0||y===WORLD_HEIGHT-1)id=BLOCK.BEDROCK;else if(y<=floor||y>=ceiling)id=this.noise.hash3(x,y,z,55)>0.8?BLOCK.BASALT:BLOCK.EMBERSTONE;else if(this.noise.value3(x,y,z,0.055,77)>0.72)id=BLOCK.EMBERSTONE;
      if(id)c.set(lx,y,lz,id);
    }
    for(let y=1;y<=DIMENSIONS.emberdeep.sea;y++)if(c.get(lx,y,lz)===BLOCK.AIR)c.set(lx,y,lz,BLOCK.LAVA);
  }
  voidSurface(x,z){const island=this.noise.fbm2(x,z,0.012,4,89),radial=Math.max(0,1-Math.hypot(x,z)/180);return 35+Math.floor((island-0.46)*24+radial*8);}
  generateVoidColumn(c,lx,lz,x,z){
    const island=this.noise.fbm2(x,z,0.012,4,89),detail=this.noise.value3(x,40,z,0.035,93);if(island<0.48&&Math.hypot(x,z)>48)return;
    const top=this.voidSurface(x,z),thickness=3+Math.floor(detail*6);for(let y=Math.max(2,top-thickness);y<=top;y++)c.set(lx,y,lz,BLOCK.VOIDSTONE);
  }
  decorateChunk(c){
    const startX=c.cx*CHUNK_SIZE,startZ=c.cz*CHUNK_SIZE;
    for(let x=startX-3;x<startX+CHUNK_SIZE+3;x++)for(let z=startZ-3;z<startZ+CHUNK_SIZE+3;z++){
      const biome=this.biomeAt(x,z),b=BIOMES[biome]||BIOMES.plains,y=this.surfaceHeight(x,z)+1;if(y<=DIMENSIONS.overworld.sea+1)continue;
      const r=this.noise.hash2(x,z,333);
      if(b.trees&&r>1-b.trees)this.writeTree(c,x,y,z,biome==='cherry');
      else if(b.flowers&&r< b.flowers)this.writeLocal(c,x,y,z,BLOCK.FLOWER,true);
      else if(b.cactus&&r>1-b.cactus)this.writeCactus(c,x,y,z);
    }
  }
  writeTree(c,x,y,z,cherry=false){const h=4+Math.floor(this.noise.hash2(x,z,321)*3);for(let i=0;i<h;i++)this.writeLocal(c,x,y+i,z,BLOCK.LOG,true);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=-1;dy<=2;dy++){if(Math.abs(dx)+Math.abs(dz)+Math.max(0,dy)>4)continue;this.writeLocal(c,x+dx,y+h-1+dy,z+dz,BLOCK.LEAVES,true);}}
  writeCactus(c,x,y,z){const h=2+Math.floor(this.noise.hash2(x,z,921)*2);for(let i=0;i<h;i++)this.writeLocal(c,x,y+i,z,BLOCK.CACTUS,true);}
  writeLocal(c,x,y,z,id,onlyAir=false){if(y<0||y>=WORLD_HEIGHT)return false;const lx=x-c.cx*CHUNK_SIZE,lz=z-c.cz*CHUNK_SIZE;if(lx<0||lx>=16||lz<0||lz>=16)return false;if(onlyAir&&c.get(lx,y,lz)!==BLOCK.AIR&&c.get(lx,y,lz)!==BLOCK.WATER)return false;c.set(lx,y,lz,id);return true;}
  structurePass(c){
    const regionX=floorDiv(c.cx,8),regionZ=floorDiv(c.cz,8),r=this.noise.hash2(regionX,regionZ,1701);if(r<0.82)return;
    const sx=regionX*8*16+Math.floor(this.noise.hash2(regionX,regionZ,1702)*100)+14,sz=regionZ*8*16+Math.floor(this.noise.hash2(regionX,regionZ,1703)*100)+14;
    const biome=this.biomeAt(sx,sz);if(['ocean','deep_ocean','mountains'].includes(biome))return;
    const type=r>0.965?'shrine':r>0.91?'ruin':'hut';this.writeStructureToChunk(c,sx,this.surfaceHeight(sx,sz)+1,sz,type);
  }
  writeStructureToChunk(c,sx,sy,sz,type){
    const id=`${type}:${sx},${sz}`;this.generatedStructures.add(id);
    if(type==='hut'){
      for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){this.writeLocal(c,sx+dx,sy-1,sz+dz,BLOCK.COBBLE,false);for(let dy=0;dy<=3;dy++){const wall=Math.abs(dx)===3||Math.abs(dz)===3;if(wall)this.writeLocal(c,sx+dx,sy+dy,sz+dz,dy===0?BLOCK.LOG:BLOCK.PLANKS,true);}this.writeLocal(c,sx+dx,sy+4,sz+dz,BLOCK.PLANKS,true);}this.writeLocal(c,sx,sy,sz+3,BLOCK.AIR,false);this.writeLocal(c,sx,sy+1,sz+3,BLOCK.AIR,false);this.writeLocal(c,sx,sy,sz,BLOCK.CRAFTING_TABLE,true);this.writeLocal(c,sx+1,sy,sz,BLOCK.CHEST,true);
    } else if(type==='ruin'){
      for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++)if(this.noise.hash2(sx+dx,sz+dz,1811)>0.5)this.writeLocal(c,sx+dx,sy,sz+dz,BLOCK.BRICKS,true);
    } else {
      for(let dy=0;dy<5;dy++){this.writeLocal(c,sx-2,sy+dy,sz,BLOCK.OBSIDIAN,true);this.writeLocal(c,sx+2,sy+dy,sz,BLOCK.OBSIDIAN,true);}for(let dx=-2;dx<=2;dx++){this.writeLocal(c,sx+dx,sy,sz,BLOCK.OBSIDIAN,true);this.writeLocal(c,sx+dx,sy+4,sz,BLOCK.OBSIDIAN,true);}this.writeLocal(c,sx,sy+1,sz-1,BLOCK.CHEST,true);
    }
  }
  decorateEmber(c){const sx=c.cx*16,sz=c.cz*16;for(let x=sx;x<sx+16;x++)for(let z=sz;z<sz+16;z++)for(let y=12;y<74;y++)if(c.get(mod(x,16),y,mod(z,16))===BLOCK.AIR&&c.get(mod(x,16),y+1,mod(z,16))===BLOCK.EMBERSTONE&&this.noise.hash3(x,y,z,2001)>0.997)c.set(mod(x,16),y,mod(z,16),BLOCK.GLOWSTONE);}
  decorateVoid(c){const sx=c.cx*16,sz=c.cz*16;for(let x=sx;x<sx+16;x++)for(let z=sz;z<sz+16;z++){const y=this.voidSurface(x,z)+1;if(this.noise.hash2(x,z,2101)>0.997)this.writeLocal(c,x,y,z,BLOCK.GLOWSTONE,true);}}
  applyEdits(c){const sx=c.cx*16,sz=c.cz*16;for(const [k,id] of this.edits){const [x,y,z]=k.split(',').map(Number);if(x>=sx&&x<sx+16&&z>=sz&&z<sz+16&&y>=0&&y<WORLD_HEIGHT)c.set(x-sx,y,z-sz,id);}}
  scheduleFluid(x,y,z){const k=key3(x,y,z);if(!this.fluidQueue.some((p)=>p[3]===k))this.fluidQueue.push([x,y,z,k]);}
  tickFluids(maxSteps=48){
    let steps=0;while(this.fluidQueue.length&&steps++<maxSteps){const [x,y,z]=this.fluidQueue.shift(),id=this.getBlock(x,y,z);if(!isLiquid(id))continue;const state=this.getState(x,y,z)||{level:0,source:true};const below=this.getBlock(x,y-1,z);
      if(id===BLOCK.WATER&&below===BLOCK.LAVA||id===BLOCK.LAVA&&below===BLOCK.WATER){this.setBlock(x,y-1,z,BLOCK.OBSIDIAN,{state:null});continue;}
      if(y>1&&(below===BLOCK.AIR||blockDef(below)?.replaceable)){this.flowInto(x,y-1,z,id,Math.min(7,(state.level||0)+1));continue;}
      const maxLevel=id===BLOCK.WATER?7:4;if((state.level||0)>=maxLevel)continue;
      const dirs=[[1,0],[-1,0],[0,1],[0,-1]];for(const [dx,dz] of dirs){const n=this.getBlock(x+dx,y,z+dz);if((id===BLOCK.WATER&&n===BLOCK.LAVA)||(id===BLOCK.LAVA&&n===BLOCK.WATER)){this.setBlock(x+dx,y,z+dz,BLOCK.OBSIDIAN);continue;}if(n===BLOCK.AIR||blockDef(n)?.replaceable)this.flowInto(x+dx,y,z+dz,id,(state.level||0)+1);}
    }
  }
  flowInto(x,y,z,id,level){const existing=this.getBlock(x,y,z),state=this.getState(x,y,z);if(existing===id&&(state?.level??99)<=level)return;this.setBlock(x,y,z,id,{state:{level,source:false}});}
  tickGravity(maxSteps=32){let steps=0;while(this.gravityQueue.length&&steps++<maxSteps){const[x,y,z]=this.gravityQueue.shift(),id=this.getBlock(x,y,z);if(!blockDef(id)?.gravity||y<=1)continue;const below=this.getBlock(x,y-1,z);if(below===BLOCK.AIR||isLiquid(below)){this.setBlock(x,y-1,z,id);this.setBlock(x,y,z,BLOCK.AIR);this.gravityQueue.push([x,y-1,z]);}}}
  randomTick(random=Math.random,count=80){
    const chunks=[...this.chunks.values()];if(!chunks.length)return;
    for(let i=0;i<count;i++){const c=chunks[Math.floor(random()*chunks.length)],x=c.cx*16+Math.floor(random()*16),z=c.cz*16+Math.floor(random()*16),y=Math.floor(random()*WORLD_HEIGHT),id=this.getBlock(x,y,z),def=blockDef(id);if(!def?.randomTick)continue;
      if(id===BLOCK.CROP){const s=this.getState(x,y,z)||{age:0};if(this.getBlock(x,y-1,z)===BLOCK.FARMLAND&&s.age<7&&random()<0.38)this.setState(x,y,z,{...s,age:s.age+1});}
      else if(id===BLOCK.SAPLING&&random()<0.08){this.setBlock(x,y,z,BLOCK.AIR);this.growTreeAt(x,y,z);}
      else if(id===BLOCK.CACTUS&&random()<0.07&&this.getBlock(x,y+1,z)===BLOCK.AIR)this.setBlock(x,y+1,z,BLOCK.CACTUS);
      else if(id===BLOCK.FARMLAND){const hydrated=this.findNearbyFluid(x,y,z,BLOCK.WATER,4);this.setState(x,y,z,{hydrated});if(!hydrated&&random()<0.05)this.setBlock(x,y,z,BLOCK.DIRT);}
    }
  }
  growTreeAt(x,y,z){for(let i=0;i<5;i++)this.setBlock(x,y+i,z,BLOCK.LOG);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=3;dy<=6;dy++)if(Math.abs(dx)+Math.abs(dz)+(dy===6?2:0)<=5&&this.getBlock(x+dx,y+dy,z+dz)===BLOCK.AIR)this.setBlock(x+dx,y+dy,z+dz,BLOCK.LEAVES);}
  findNearbyFluid(x,y,z,id,radius){for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)if(this.getBlock(x+dx,y,z+dz)===id||this.getBlock(x+dx,y-1,z+dz)===id)return true;return false;}
  skyLightAt(x,y,z){if(this.dimension!=='overworld')return this.dimension==='voidlands'?4:0;for(let yy=y+1;yy<WORLD_HEIGHT;yy++)if(isOpaque(this.getBlock(x,yy,z)))return 0;return 15;}
  blockLightAt(x,y,z,radius=8){let best=blockDef(this.getBlock(x,y,z))?.emits||0;if(best>=15)return best;for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)for(let dz=-radius;dz<=radius;dz++){const d=Math.abs(dx)+Math.abs(dy)+Math.abs(dz);if(d>radius||d>=best&&best>0)continue;const emits=blockDef(this.getBlock(x+dx,y+dy,z+dz))?.emits||0;if(emits)best=Math.max(best,emits-d);}return clamp(best,0,15);}
  lightAt(x,y,z){return Math.max(this.blockLightAt(x,y,z),this.skyLightAt(x,y,z));}
  surfaceY(x,z){for(let y=WORLD_HEIGHT-2;y>=1;y--){const id=this.getBlock(x,y,z);if(isSolid(id))return y+1;}return 1;}
  isWalkable(x,y,z){const fx=Math.floor(x),fy=Math.floor(y),fz=Math.floor(z);return isSolid(this.getBlock(fx,fy-1,fz))&&!isSolid(this.getBlock(fx,fy,fz))&&!isSolid(this.getBlock(fx,fy+1,fz));}
  tick(dt){
    const dim=DIMENSIONS[this.dimension];if(Number.isFinite(dim.dayLength))this.time=(this.time+dt/dim.dayLength)%1;
    this.weather.tick(dt,this.dimension);this.fluidAccumulator+=dt;this.randomTickAccumulator+=dt;
    if(this.fluidAccumulator>=0.18){this.fluidAccumulator=0;this.tickFluids();this.tickGravity();}
    if(this.randomTickAccumulator>=0.5){this.randomTickAccumulator=0;this.randomTick();}
  }
  serialize(){return{version:1,seed:this.seed,dimension:this.dimension,time:this.time,edits:[...this.edits],states:[...this.states],blockEntities:[...this.blockEntities],weather:this.weather.serialize(),structures:[...this.generatedStructures]};}
  load(raw){if(!raw||Number(raw.seed)!==this.seed)return false;if(DIMENSIONS[raw.dimension])this.dimension=raw.dimension;this.noise=new SeededNoise(this.seed+dimensionSalt(this.dimension));this.time=Number.isFinite(raw.time)?raw.time:0.28;this.edits=new Map(Array.isArray(raw.edits)?raw.edits:[]);this.states=new Map(Array.isArray(raw.states)?raw.states:[]);this.blockEntities=new Map(Array.isArray(raw.blockEntities)?raw.blockEntities:[]);this.generatedStructures=new Set(Array.isArray(raw.structures)?raw.structures:[]);this.weather.load(raw.weather);this.clearLoaded();return true;}
}

export function dimensionSalt(id){return id==='emberdeep'?0x1f2e3d4c:id==='voidlands'?0x5a6b7c8d:0;}
export function seedRandom(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
function performanceNow(){return globalThis.performance?.now?.()??Date.now();}
