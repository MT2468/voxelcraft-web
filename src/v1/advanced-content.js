import { BLOCK, ITEM, BLOCKS, ITEMS } from './catalog.js';

export const ABLOCK = Object.freeze({
  REPEATER: 46,
  OBSERVER: 47,
  COMPARATOR: 48,
  HOPPER: 49,
  DISPENSER: 50,
  POWERED_RAIL: 51,
  STICKY_PISTON: 52
});

export const AITEM = Object.freeze({
  BOAT: 185,
  FISHING_ROD: 186
});

const block = (id,name,color,extra={}) => ({
  id,name,color,top:color,side:color,hardness:.7,resistance:1,solid:true,opaque:true,
  replaceable:false,transparent:false,liquid:false,emits:0,tool:'pickaxe',tier:1,
  gravity:false,randomTick:false,...extra
});

export const ADVANCED_RECIPES = Object.freeze([
  {id:'flux-repeater',grid:'3x3',in:[[ITEM.FLUX_DUST,2],[ITEM.TORCH,2],[ITEM.STONE,3]],out:[ABLOCK.REPEATER,1]},
  {id:'flux-observer',grid:'3x3',in:[[ITEM.COBBLE,6],[ITEM.FLUX_DUST,2],[ITEM.ENDER_SHARD,1]],out:[ABLOCK.OBSERVER,1]},
  {id:'flux-comparator',grid:'3x3',in:[[ITEM.FLUX_DUST,3],[ITEM.TORCH,2],[ITEM.STONE,3]],out:[ABLOCK.COMPARATOR,1]},
  {id:'hopper',grid:'3x3',in:[[ITEM.IRON_INGOT,5],[ITEM.CHEST,1]],out:[ABLOCK.HOPPER,1]},
  {id:'dispenser',grid:'3x3',in:[[ITEM.COBBLE,7],[ITEM.BOW,1],[ITEM.FLUX_DUST,1]],out:[ABLOCK.DISPENSER,1]},
  {id:'powered-rail',grid:'3x3',in:[[ITEM.IRON_INGOT,6],[ITEM.STICK,1],[ITEM.FLUX_DUST,1]],out:[ABLOCK.POWERED_RAIL,6]},
  {id:'sticky-piston',grid:'3x3',in:[[ITEM.PISTON,1],[ITEM.FLUX_DUST,2]],out:[ABLOCK.STICKY_PISTON,1]},
  {id:'boat',grid:'3x3',in:[[ITEM.PLANKS,5]],out:[AITEM.BOAT,1]},
  {id:'fishing-rod',grid:'3x3',in:[[ITEM.STICK,3],[ITEM.STRING,2]],out:[AITEM.FISHING_ROD,1]}
]);

let registered=false;
export function registerAdvancedContent(){
  if(registered)return;registered=true;
  const defs=[
    block(ABLOCK.REPEATER,'Repetidor de Flux',0x8d5f55,{solid:false,opaque:false,transparent:true,hardness:.15}),
    block(ABLOCK.OBSERVER,'Sensor de Mudança',0x6f777d,{hardness:.8}),
    block(ABLOCK.COMPARATOR,'Comparador de Flux',0x80615c,{solid:false,opaque:false,transparent:true,hardness:.15}),
    block(ABLOCK.HOPPER,'Funil',0x555b61,{hardness:1.1}),
    block(ABLOCK.DISPENSER,'Dispenser',0x777a7c,{hardness:1.2}),
    block(ABLOCK.POWERED_RAIL,'Trilho Energizado',0xc69335,{solid:false,opaque:false,transparent:true,hardness:.12}),
    block(ABLOCK.STICKY_PISTON,'Pistão Aderente',0x778d59,{hardness:1})
  ];
  for(const def of defs){BLOCKS.set(def.id,def);ITEMS.set(def.id,{id:def.id,name:def.name,kind:'block',maxStack:64,block:def.id});}
  ITEMS.set(AITEM.BOAT,{id:AITEM.BOAT,name:'Barco',kind:'vehicle',vehicle:'boat',maxStack:1});
  ITEMS.set(AITEM.FISHING_ROD,{id:AITEM.FISHING_ROD,name:'Vara de pesca',kind:'tool',tool:'fishing_rod',durability:64,maxStack:1});
}

registerAdvancedContent();
