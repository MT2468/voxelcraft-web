import { BLOCKS, ITEMS, ITEM } from '../../v1/catalog.js';
import { CraftingSystem } from '../../v1/systems.js';

export const VBLOCK=Object.freeze({CORRUPTED_STONE:130,PALE_BRICKS:131,VERITY_SIGIL:132,OBSERVER_GLASS:133});
export const VITEM=Object.freeze({VERITY_SHARD:230,VERITY_LANTERN:231,VERITY_DISC:232,VERITY_NOTE:233});

const block=(id,name,color,extra={})=>({id,name,color,top:extra.top??color,side:extra.side??color,hardness:extra.hardness??1.2,resistance:extra.resistance??2,solid:extra.solid??true,opaque:extra.opaque??true,replaceable:false,transparent:extra.transparent??false,liquid:false,emits:extra.emits??0,tool:extra.tool??'pickaxe',tier:extra.tier??1,gravity:false,randomTick:false,...extra});

export const VERITY_RECIPES=Object.freeze([
  {id:'verity-lantern',grid:'3x3',in:[[ITEM.IRON_INGOT,4],[ITEM.COAL,1],[ITEM.FLUX_DUST,2],[VITEM.VERITY_SHARD,1]],out:[VITEM.VERITY_LANTERN,1]},
  {id:'pale-bricks',grid:'3x3',in:[[ITEM.STONE,4],[VITEM.VERITY_SHARD,1]],out:[VBLOCK.PALE_BRICKS,4]},
  {id:'observer-glass',grid:'3x3',in:[[VITEM.VERITY_SHARD,2],[ITEM.FLUX_DUST,2]],out:[VBLOCK.OBSERVER_GLASS,2]}
]);

let installed=false;
export function registerVerityContent(){if(installed)return;installed=true;
  const defs=[
    block(VBLOCK.CORRUPTED_STONE,'Pedra Corrompida',0x29262b,{hardness:2.4,resistance:5,tier:2}),
    block(VBLOCK.PALE_BRICKS,'Tijolos Pálidos',0xb7b19a,{hardness:1.7,resistance:4}),
    block(VBLOCK.VERITY_SIGIL,'Sigilo de Verity',0xf1c729,{hardness:.3,solid:false,opaque:false,transparent:true,emits:5}),
    block(VBLOCK.OBSERVER_GLASS,'Vidro Observador',0xc7d5ba,{hardness:.4,opaque:false,transparent:true})
  ];
  for(const def of defs){BLOCKS.set(def.id,def);ITEMS.set(def.id,{id:def.id,name:def.name,kind:'block',maxStack:64,block:def.id});}
  ITEMS.set(VITEM.VERITY_SHARD,{id:VITEM.VERITY_SHARD,name:'Fragmento Amarelo',kind:'material',maxStack:64});
  ITEMS.set(VITEM.VERITY_LANTERN,{id:VITEM.VERITY_LANTERN,name:'Lanterna de Verity',kind:'tool',tool:'verity_lantern',durability:180,maxStack:1});
  ITEMS.set(VITEM.VERITY_DISC,{id:VITEM.VERITY_DISC,name:'Disco: Frequência 17',kind:'material',maxStack:1});
  ITEMS.set(VITEM.VERITY_NOTE,{id:VITEM.VERITY_NOTE,name:'Página Rasgada',kind:'material',maxStack:16});
  patchCrafting();
}
function patchCrafting(){if(CraftingSystem.prototype.__verityInstalled)return;Object.defineProperty(CraftingSystem.prototype,'__verityInstalled',{value:true});const baseAvailable=CraftingSystem.prototype.available,baseCraft=CraftingSystem.prototype.craft;
  CraftingSystem.prototype.available=function(inv,grid='2x2'){const base=baseAvailable.call(this,inv,grid),seen=new Set(base.map(r=>r.id)),extra=VERITY_RECIPES.filter(r=>(grid==='3x3'||r.grid==='any'||r.grid===grid)&&r.in.every(([id,n])=>inv.has(id,n))&&!seen.has(r.id));return[...base,...extra];};
  CraftingSystem.prototype.craft=function(inv,id,grid='2x2'){const r=VERITY_RECIPES.find(x=>x.id===id);if(!r)return baseCraft.call(this,inv,id,grid);if(!(grid==='3x3'||r.grid==='any'||r.grid===grid)||!r.in.every(([item,n])=>inv.has(item,n)))return false;const snapshot=inv.serialize();for(const[item,n]of r.in)inv.remove(item,n);if(!inv.add(r.out[0],r.out[1])){inv.load(snapshot);return false;}return true;};
}
registerVerityContent();
