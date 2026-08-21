import { BLOCK, ITEM, BLOCKS, ITEMS } from './catalog.js';
import { CraftingSystem } from './systems.js';

export const ABLOCK = Object.freeze({
  REPEATER:46, OBSERVER:47, COMPARATOR:48, HOPPER:49, DISPENSER:50,
  POWERED_RAIL:51, STICKY_PISTON:52,
  GRANITE:53, DIORITE:54, SLATE:55, MARBLE:56, LIMESTONE:57,
  POLISHED_GRANITE:58, POLISHED_DIORITE:59, POLISHED_SLATE:60, POLISHED_MARBLE:61,
  SANDSTONE:62, RED_SANDSTONE:63, DARK_BRICKS:64, MOSSY_STONE_BRICKS:65, CHISELED_STONE:66,
  QUARTZ_BLOCK:67, METAL_BLOCK:68, COPPER_BLOCK:69,
  PINE_PLANKS:70, BIRCH_PLANKS:71, CHERRY_PLANKS:72, DARK_PLANKS:73,
  PINE_LOG:74, BIRCH_LOG:75, CHERRY_LOG:76, DARK_LOG:77,
  PINE_LEAVES:78, BIRCH_LEAVES:79, CHERRY_LEAVES:80,
  GLASS_RED:81, GLASS_ORANGE:82, GLASS_YELLOW:83, GLASS_GREEN:84,
  GLASS_BLUE:85, GLASS_PURPLE:86, GLASS_WHITE:87, GLASS_BLACK:88,
  WOOL_RED:89, WOOL_ORANGE:90, WOOL_YELLOW:91, WOOL_GREEN:92,
  WOOL_BLUE:93, WOOL_PURPLE:94, WOOL_WHITE:95, WOOL_BLACK:96,
  BOOKSHELF:97, LANTERN:98, HAY_BALE:99
});

export const AITEM = Object.freeze({BOAT:185,FISHING_ROD:186});

const block=(id,name,color,extra={})=>({
  id,name,color,top:color,side:color,hardness:.7,resistance:1,solid:true,opaque:true,
  replaceable:false,transparent:false,liquid:false,emits:0,tool:'pickaxe',tier:1,
  gravity:false,randomTick:false,...extra
});

const DECORATIVE_DEFS=[
  block(ABLOCK.GRANITE,'Granito',0x9a6657,{hardness:1.3}),
  block(ABLOCK.DIORITE,'Diorito',0xc9c7c2,{hardness:1.3}),
  block(ABLOCK.SLATE,'Ardósia',0x4d545b,{hardness:1.45}),
  block(ABLOCK.MARBLE,'Mármore',0xe4ded5,{hardness:1.35}),
  block(ABLOCK.LIMESTONE,'Calcário',0xb8b09b,{hardness:1.15}),
  block(ABLOCK.POLISHED_GRANITE,'Granito Polido',0xaa7564,{hardness:1.35}),
  block(ABLOCK.POLISHED_DIORITE,'Diorito Polido',0xd8d6d0,{hardness:1.35}),
  block(ABLOCK.POLISHED_SLATE,'Ardósia Polida',0x626a72,{hardness:1.5}),
  block(ABLOCK.POLISHED_MARBLE,'Mármore Polido',0xf0ebe3,{hardness:1.4}),
  block(ABLOCK.SANDSTONE,'Arenito',0xd2bd7b,{hardness:.8}),
  block(ABLOCK.RED_SANDSTONE,'Arenito Rubro',0xb96d42,{hardness:.8}),
  block(ABLOCK.DARK_BRICKS,'Tijolos Escuros',0x4e4445,{hardness:1.5}),
  block(ABLOCK.MOSSY_STONE_BRICKS,'Tijolos de Pedra Musgosos',0x68725c,{hardness:1.45}),
  block(ABLOCK.CHISELED_STONE,'Pedra Cinzelada',0x777777,{hardness:1.5}),
  block(ABLOCK.QUARTZ_BLOCK,'Bloco de Quartzo',0xe9e4da,{hardness:1.1}),
  block(ABLOCK.METAL_BLOCK,'Bloco de Ferro',0xbfc3c2,{hardness:2,tier:2}),
  block(ABLOCK.COPPER_BLOCK,'Bloco de Cobre',0xb86d4b,{hardness:1.7,tier:2}),
  block(ABLOCK.PINE_PLANKS,'Tábuas de Pinho',0x8d6a45,{tool:'axe',tier:0}),
  block(ABLOCK.BIRCH_PLANKS,'Tábuas de Bétula',0xd4c291,{tool:'axe',tier:0}),
  block(ABLOCK.CHERRY_PLANKS,'Tábuas de Cerejeira',0xb77a78,{tool:'axe',tier:0}),
  block(ABLOCK.DARK_PLANKS,'Tábuas Escuras',0x59402e,{tool:'axe',tier:0}),
  block(ABLOCK.PINE_LOG,'Tronco de Pinho',0x66513b,{tool:'axe',tier:0,top:0xa18158}),
  block(ABLOCK.BIRCH_LOG,'Tronco de Bétula',0xd6d0b8,{tool:'axe',tier:0,top:0xc2a879}),
  block(ABLOCK.CHERRY_LOG,'Tronco de Cerejeira',0x8f5e63,{tool:'axe',tier:0,top:0xc28b8e}),
  block(ABLOCK.DARK_LOG,'Tronco Escuro',0x3f332b,{tool:'axe',tier:0,top:0x705442}),
  block(ABLOCK.PINE_LEAVES,'Folhas de Pinho',0x335b3d,{tool:'shears',tier:0,opaque:false,transparent:true,hardness:.18}),
  block(ABLOCK.BIRCH_LEAVES,'Folhas de Bétula',0x6c9a4c,{tool:'shears',tier:0,opaque:false,transparent:true,hardness:.18}),
  block(ABLOCK.CHERRY_LEAVES,'Folhas de Cerejeira',0xd5849d,{tool:'shears',tier:0,opaque:false,transparent:true,hardness:.18}),
  ...[
    [ABLOCK.GLASS_RED,'Vidro Vermelho',0xb94b4b],[ABLOCK.GLASS_ORANGE,'Vidro Laranja',0xd98645],
    [ABLOCK.GLASS_YELLOW,'Vidro Amarelo',0xd6c84a],[ABLOCK.GLASS_GREEN,'Vidro Verde',0x4f9d5c],
    [ABLOCK.GLASS_BLUE,'Vidro Azul',0x4b78bc],[ABLOCK.GLASS_PURPLE,'Vidro Roxo',0x8056a6],
    [ABLOCK.GLASS_WHITE,'Vidro Branco',0xdce6e7],[ABLOCK.GLASS_BLACK,'Vidro Negro',0x30353b]
  ].map(([id,name,color])=>block(id,name,color,{tool:null,tier:0,opaque:false,transparent:true,hardness:.25,resistance:.3})),
  ...[
    [ABLOCK.WOOL_RED,'Lã Vermelha',0xa73d43],[ABLOCK.WOOL_ORANGE,'Lã Laranja',0xc86b34],
    [ABLOCK.WOOL_YELLOW,'Lã Amarela',0xc9b73f],[ABLOCK.WOOL_GREEN,'Lã Verde',0x4e833f],
    [ABLOCK.WOOL_BLUE,'Lã Azul',0x3f5f9e],[ABLOCK.WOOL_PURPLE,'Lã Roxa',0x74458f],
    [ABLOCK.WOOL_WHITE,'Lã Branca',0xdedbd2],[ABLOCK.WOOL_BLACK,'Lã Preta',0x29282c]
  ].map(([id,name,color])=>block(id,name,color,{tool:null,tier:0,hardness:.3,resistance:.2})),
  block(ABLOCK.BOOKSHELF,'Estante',0x8a5c38,{tool:'axe',tier:0,side:0xb78752}),
  block(ABLOCK.LANTERN,'Lanterna',0xd99938,{tool:'pickaxe',tier:1,opaque:false,transparent:true,solid:false,hardness:.3,emits:15}),
  block(ABLOCK.HAY_BALE,'Fardo de Feno',0xc4a83a,{tool:'axe',tier:0,hardness:.45})
];

export const ADVANCED_RECIPES=Object.freeze([
  {id:'flux-repeater',grid:'3x3',in:[[ITEM.FLUX_DUST,2],[ITEM.TORCH,2],[ITEM.STONE,3]],out:[ABLOCK.REPEATER,1]},
  {id:'flux-observer',grid:'3x3',in:[[ITEM.COBBLE,6],[ITEM.FLUX_DUST,2],[ITEM.ENDER_SHARD,1]],out:[ABLOCK.OBSERVER,1]},
  {id:'flux-comparator',grid:'3x3',in:[[ITEM.FLUX_DUST,3],[ITEM.TORCH,2],[ITEM.STONE,3]],out:[ABLOCK.COMPARATOR,1]},
  {id:'hopper',grid:'3x3',in:[[ITEM.IRON_INGOT,5],[ITEM.CHEST,1]],out:[ABLOCK.HOPPER,1]},
  {id:'dispenser',grid:'3x3',in:[[ITEM.COBBLE,7],[ITEM.BOW,1],[ITEM.FLUX_DUST,1]],out:[ABLOCK.DISPENSER,1]},
  {id:'powered-rail',grid:'3x3',in:[[ITEM.IRON_INGOT,6],[ITEM.STICK,1],[ITEM.FLUX_DUST,1]],out:[ABLOCK.POWERED_RAIL,6]},
  {id:'sticky-piston',grid:'3x3',in:[[ITEM.PISTON,1],[ITEM.FLUX_DUST,2]],out:[ABLOCK.STICKY_PISTON,1]},
  {id:'boat',grid:'3x3',in:[[ITEM.PLANKS,5]],out:[AITEM.BOAT,1]},
  {id:'fishing-rod',grid:'3x3',in:[[ITEM.STICK,3],[ITEM.STRING,2]],out:[AITEM.FISHING_ROD,1]},
  {id:'sandstone',grid:'2x2',in:[[ITEM.SAND,4]],out:[ABLOCK.SANDSTONE,4]},
  {id:'polished-granite',grid:'2x2',in:[[ABLOCK.GRANITE,4]],out:[ABLOCK.POLISHED_GRANITE,4]},
  {id:'polished-diorite',grid:'2x2',in:[[ABLOCK.DIORITE,4]],out:[ABLOCK.POLISHED_DIORITE,4]},
  {id:'polished-slate',grid:'2x2',in:[[ABLOCK.SLATE,4]],out:[ABLOCK.POLISHED_SLATE,4]},
  {id:'polished-marble',grid:'2x2',in:[[ABLOCK.MARBLE,4]],out:[ABLOCK.POLISHED_MARBLE,4]},
  {id:'iron-block',grid:'3x3',in:[[ITEM.IRON_INGOT,9]],out:[ABLOCK.METAL_BLOCK,1]},
  {id:'hay-bale',grid:'3x3',in:[[ITEM.WHEAT,9]],out:[ABLOCK.HAY_BALE,1]},
  {id:'lantern',grid:'3x3',in:[[ITEM.IRON_INGOT,4],[ITEM.TORCH,1]],out:[ABLOCK.LANTERN,1]}
]);

let registered=false;
export function registerAdvancedContent(){
  if(registered)return;registered=true;
  const functional=[
    block(ABLOCK.REPEATER,'Repetidor de Flux',0x8d5f55,{solid:false,opaque:false,transparent:true,hardness:.15}),
    block(ABLOCK.OBSERVER,'Sensor de Mudança',0x6f777d,{hardness:.8}),
    block(ABLOCK.COMPARATOR,'Comparador de Flux',0x80615c,{solid:false,opaque:false,transparent:true,hardness:.15}),
    block(ABLOCK.HOPPER,'Funil',0x555b61,{hardness:1.1}),
    block(ABLOCK.DISPENSER,'Dispenser',0x777a7c,{hardness:1.2}),
    block(ABLOCK.POWERED_RAIL,'Trilho Energizado',0xc69335,{solid:false,opaque:false,transparent:true,hardness:.12}),
    block(ABLOCK.STICKY_PISTON,'Pistão Aderente',0x778d59,{hardness:1})
  ];
  for(const def of [...functional,...DECORATIVE_DEFS]){
    BLOCKS.set(def.id,def);
    ITEMS.set(def.id,{id:def.id,name:def.name,kind:'block',maxStack:64,block:def.id});
  }
  ITEMS.set(AITEM.BOAT,{id:AITEM.BOAT,name:'Barco',kind:'vehicle',vehicle:'boat',maxStack:1});
  ITEMS.set(AITEM.FISHING_ROD,{id:AITEM.FISHING_ROD,name:'Vara de pesca',kind:'tool',tool:'fishing_rod',durability:64,maxStack:1});
  installCraftingExtension();
}

function installCraftingExtension(){
  if(CraftingSystem.prototype.__voxelAdvancedInstalled)return;
  Object.defineProperty(CraftingSystem.prototype,'__voxelAdvancedInstalled',{value:true});
  const baseAvailable=CraftingSystem.prototype.available,baseCraft=CraftingSystem.prototype.craft;
  CraftingSystem.prototype.available=function(inventory,grid='2x2'){
    const existing=baseAvailable.call(this,inventory,grid),seen=new Set(existing.map((recipe)=>recipe.id));
    const extra=ADVANCED_RECIPES.filter((recipe)=>(recipe.grid==='any'||recipe.grid===grid||grid==='3x3')&&recipe.in.every(([id,count])=>inventory.has(id,count))&&!seen.has(recipe.id));
    return [...existing,...extra];
  };
  CraftingSystem.prototype.craft=function(inventory,recipeId,grid='2x2'){
    const advanced=ADVANCED_RECIPES.find((recipe)=>recipe.id===recipeId);
    if(!advanced)return baseCraft.call(this,inventory,recipeId,grid);
    if(!(advanced.grid==='any'||advanced.grid===grid||grid==='3x3')||!advanced.in.every(([id,count])=>inventory.has(id,count)))return false;
    const snapshot=inventory.serialize();
    for(const[id,count]of advanced.in)inventory.remove(id,count);
    if(!inventory.add(advanced.out[0],advanced.out[1])){inventory.load(snapshot);return false;}
    return true;
  };
}

registerAdvancedContent();
