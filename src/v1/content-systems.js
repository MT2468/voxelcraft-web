import { BLOCK, ITEM, itemDef } from './catalog.js';

export const TRADES=Object.freeze([
  {id:'coal_for_iron',name:'Ferreiro: carvão → ferro',cost:[[ITEM.COAL,12]],out:[ITEM.IRON_INGOT,2],xp:2},
  {id:'wheat_for_emeraldless',name:'Fazendeiro: trigo → comida',cost:[[ITEM.WHEAT,14]],out:[ITEM.BREAD,5],xp:1},
  {id:'leather_for_arrows',name:'Caçador: couro → flechas',cost:[[ITEM.LEATHER,3]],out:[ITEM.ARROW,18],xp:1},
  {id:'gold_for_flux',name:'Engenheiro: ouro → Flux',cost:[[ITEM.GOLD_INGOT,2]],out:[ITEM.FLUX_DUST,5],xp:3},
  {id:'diamond_for_eye',name:'Cartógrafo do Vazio',cost:[[ITEM.DIAMOND,4],[ITEM.ENDER_SHARD,2]],out:[ITEM.VOID_EYE,1],xp:6}
]);

export class TradeSystem{
  constructor(){this.reputation=0;this.completed=0;}
  available(inventory){return TRADES.map((t)=>({...t,can:t.cost.every(([id,n])=>inventory.has(id,n))}));}
  trade(inventory,id,stats=null){const t=TRADES.find((x)=>x.id===id);if(!t||!t.cost.every(([item,n])=>inventory.has(item,n)))return false;const snapshot=inventory.serialize();for(const[item,n]of t.cost)inventory.remove(item,n);if(!inventory.add(t.out[0],t.out[1])){inventory.load(snapshot);return false;}this.completed++;this.reputation=Math.min(100,this.reputation+1+Math.floor((t.xp||0)/2));stats?.addXp?.(t.xp||0);return true;}
  discount(){return Math.min(.25,this.reputation*.0025);}
  serialize(){return{reputation:this.reputation,completed:this.completed};}
  load(raw){this.reputation=Math.max(0,Number(raw?.reputation)||0);this.completed=Math.max(0,Number(raw?.completed)||0);}
}

export class FishingSystem{
  constructor(random=Math.random){this.random=random;this.active=false;this.timer=0;this.biteWindow=0;this.casts=0;this.catches=0;}
  cast(world,position){if(this.active)return{ok:false,message:'Linha já lançada'};if(!nearWater(world,position,5))return{ok:false,message:'Chegue perto da água'};this.active=true;this.timer=2+this.random()*7;this.biteWindow=0;this.casts++;return{ok:true,message:'Linha lançada…'};}
  tick(dt){if(!this.active)return null;if(this.biteWindow>0){this.biteWindow-=dt;if(this.biteWindow<=0){this.active=false;return{type:'escaped'};}return null;}this.timer-=dt;if(this.timer<=0){this.biteWindow=1.4;return{type:'bite'};}return null;}
  reel(inventory,stats=null){if(!this.active)return{ok:false,message:'Nenhuma linha lançada'};if(this.biteWindow<=0){this.active=false;return{ok:false,message:'Recolheu cedo demais'};}const r=this.random();let loot;if(r<.72)loot=[ITEM.FISH,1];else if(r<.86)loot=[ITEM.STRING,1];else if(r<.95)loot=[ITEM.COAL,1];else loot=[ITEM.DIAMOND,1];this.active=false;this.biteWindow=0;this.catches++;inventory.add(...loot);stats?.addXp?.(1+r*3);return{ok:true,loot,message:`Pescou ${itemDef(loot[0])?.name||loot[0]}!`};}
  serialize(){return{casts:this.casts,catches:this.catches};}
  load(raw){this.casts=Math.max(0,Number(raw?.casts)||0);this.catches=Math.max(0,Number(raw?.catches)||0);this.active=false;}
}

export const BREWS=Object.freeze([
  {id:'heal',name:'Poção de cura',cost:[[ITEM.APPLE,2],[ITEM.GOLD_INGOT,1]],out:ITEM.POTION_HEAL,time:5},
  {id:'speed',name:'Poção de velocidade',cost:[[ITEM.WHEAT,2],[ITEM.FLUX_DUST,1]],out:ITEM.POTION_SPEED,time:6},
  {id:'fire',name:'Resistência ao fogo',cost:[[ITEM.EMBER_CRYSTAL,1],[ITEM.COAL,2]],out:ITEM.POTION_FIRE,time:7}
]);
export class BrewingSystem{
  constructor(){this.active=null;this.progress=0;this.completed=0;}
  start(inventory,id){if(this.active)return false;const recipe=BREWS.find((r)=>r.id===id);if(!recipe||!recipe.cost.every(([item,n])=>inventory.has(item,n)))return false;for(const[item,n]of recipe.cost)inventory.remove(item,n);this.active=recipe;this.progress=0;return true;}
  tick(dt,inventory){if(!this.active)return null;this.progress+=dt;if(this.progress<this.active.time)return null;const out=this.active.out,name=this.active.name;inventory.add(out,1);this.active=null;this.progress=0;this.completed++;return{out,name};}
  serialize(){return{active:this.active?.id||null,progress:this.progress,completed:this.completed};}
  load(raw){this.active=BREWS.find((r)=>r.id===raw?.active)||null;this.progress=Math.max(0,Number(raw?.progress)||0);this.completed=Math.max(0,Number(raw?.completed)||0);}
}

export class ExplorationMap{
  constructor(){this.discovered=new Map();this.structures=new Set();}
  visit(world,x,z){const cx=Math.floor(x/16),cz=Math.floor(z/16),key=`${world.dimension}:${cx},${cz}`;if(!this.discovered.has(key))this.discovered.set(key,{dimension:world.dimension,cx,cz,biome:world.biomeAt(x,z),height:world.surfaceHeight(x,z),seenAt:Date.now()});for(const id of world.generatedStructures||[])this.structures.add(`${world.dimension}:${id}`);return this.discovered.get(key);}
  bounds(dimension='overworld'){const list=[...this.discovered.values()].filter((p)=>p.dimension===dimension);if(!list.length)return null;return{minX:Math.min(...list.map((p)=>p.cx)),maxX:Math.max(...list.map((p)=>p.cx)),minZ:Math.min(...list.map((p)=>p.cz)),maxZ:Math.max(...list.map((p)=>p.cz))};}
  serialize(){return{discovered:[...this.discovered],structures:[...this.structures]};}
  load(raw){this.discovered=new Map(Array.isArray(raw?.discovered)?raw.discovered:[]);this.structures=new Set(Array.isArray(raw?.structures)?raw.structures:[]);}
}

export class PlayerStatistics{
  constructor(){this.values={blocksMined:0,blocksPlaced:0,mobsKilled:0,deaths:0,distanceWalked:0,itemsCrafted:0,fishCaught:0,trades:0,dimensionsVisited:1,playSeconds:0};this.dimensions=new Set(['overworld']);}
  add(key,n=1){if(key in this.values)this.values[key]+=Number(n)||0;}
  visitDimension(id){this.dimensions.add(id);this.values.dimensionsVisited=this.dimensions.size;}
  tick(dt){this.values.playSeconds+=dt;}
  serialize(){return{values:{...this.values},dimensions:[...this.dimensions]};}
  load(raw){for(const k of Object.keys(this.values))if(Number.isFinite(raw?.values?.[k]))this.values[k]=raw.values[k];this.dimensions=new Set(Array.isArray(raw?.dimensions)?raw.dimensions:['overworld']);}
}

export function nearestGeneratedStructure(world,position,type=null,maxDistance=1024){let best=null;for(const raw of world.generatedStructures||[]){const [kind,coords]=String(raw).split(':'),[x,z]=String(coords||'').split(',').map(Number);if(type&&kind!==type||![x,z].every(Number.isFinite))continue;const d=Math.hypot(position.x-x,position.z-z);if(d<=maxDistance&&(!best||d<best.distance))best={type:kind,x,z,distance:d};}return best;}
export function nearTradingPost(world,position,radius=10){return Boolean(nearestGeneratedStructure(world,position,'hut',radius));}
function nearWater(world,p,radius){for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)for(let dy=-2;dy<=1;dy++)if(world.getBlock(Math.floor(p.x+dx),Math.floor(p.y+dy),Math.floor(p.z+dz))===BLOCK.WATER)return true;return false;}
