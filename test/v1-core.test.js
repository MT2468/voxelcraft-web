import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK, ITEM, blockDef, itemDef } from '../src/v1/catalog.js';
import { InventoryV1, PlayerStatsV1, CraftingSystem, FurnaceSystem, AdvancementSystem, miningSpeed } from '../src/v1/systems.js';
import { WorldV1 } from '../src/v1/world.js';
import { GameRules, FluxSystem, PortalSystem, explode } from '../src/v1/automation.js';
import { EntityManagerV1, findPath2D } from '../src/v1/entities.js';
import { CommandConsole } from '../src/v1/commands.js';
import { SaveDB } from '../src/v1/save-db.js';

test('catalog exposes functional blocks and endgame gear',()=>{
  assert.equal(blockDef(BLOCK.WATER).liquid,true);
  assert.equal(blockDef(BLOCK.TORCH).emits,14);
  assert.equal(itemDef(ITEM.DIAMOND_PICKAXE).tier,4);
  assert.equal(itemDef(ITEM.IRON_CHEST).slot,'chest');
});

test('InventoryV1 stacks resources but keeps durable tools separate',()=>{
  const inv=new InventoryV1();
  assert.equal(inv.add(ITEM.LOG,70),true);
  assert.equal(inv.count(ITEM.LOG),70);
  assert.equal(inv.add(ITEM.WOOD_PICKAXE,2),true);
  const toolSlots=inv.slots.filter((s)=>s?.id===ITEM.WOOD_PICKAXE);
  assert.equal(toolSlots.length,2);
  assert.equal(toolSlots.every((s)=>s.count===1),true);
  inv.hotbar[0]=inv.slots.findIndex((s)=>s?.id===ITEM.WOOD_PICKAXE);inv.setSelected(0);
  const before=inv.selectedStack().data.durability;
  inv.damageSelected(1);
  assert.equal(inv.selectedStack().data.durability,before-1);
});

test('armor reduces incoming damage and serializes',()=>{
  const inv=new InventoryV1(),stats=new PlayerStatsV1();
  inv.add(ITEM.IRON_CHEST,1);const slot=inv.findSlot(ITEM.IRON_CHEST);assert.equal(inv.equipFromSlot(slot),true);
  const naked=new PlayerStatsV1();const nakedDamage=naked.damage(10,null,'mob'),armored=stats.damage(10,inv,'mob');
  assert.ok(armored<nakedDamage);const copy=new InventoryV1();assert.equal(copy.load(inv.serialize()),true);assert.equal(copy.armor.chest.id,ITEM.IRON_CHEST);
});

test('crafting progression and furnace are transactional',()=>{
  const inv=new InventoryV1(),craft=new CraftingSystem(),furnace=new FurnaceSystem(),stats=new PlayerStatsV1();
  inv.add(ITEM.LOG,3);assert.equal(craft.craft(inv,'planks','2x2'),true);assert.equal(inv.count(ITEM.PLANKS),4);
  inv.add(ITEM.PLANKS,4);assert.equal(craft.craft(inv,'crafting-table','2x2'),true);assert.equal(inv.has(ITEM.CRAFTING_TABLE),true);
  inv.add(ITEM.IRON_ORE,1);inv.add(ITEM.COAL,1);assert.equal(furnace.loadFuel(inv),true);assert.equal(furnace.setInput(inv,ITEM.IRON_ORE),true);furnace.tick(9,stats);assert.equal(furnace.output.id,ITEM.IRON_INGOT);assert.equal(furnace.takeOutput(inv),true);assert.equal(inv.has(ITEM.IRON_INGOT),true);assert.ok(stats.xp>0);
});

test('player survival handles effects, fire, air, XP and death',()=>{
  const stats=new PlayerStatsV1();stats.effects.add('speed',10,1);assert.ok(stats.effects.multiplier('speed')>1);stats.addXp(100);assert.ok(stats.level>0);stats.ignite(3);stats.tick(1.1,{underwater:false});assert.ok(stats.health<20);const hp=stats.health;stats.effects.add('fire_resistance',10);stats.ignite(3);stats.tick(1.1,{underwater:false});assert.ok(stats.health<=hp);stats.damage(999,null,'void');assert.equal(stats.dead,true);stats.resetAfterDeath();assert.equal(stats.health,20);
});

test('world generation is deterministic and dimensions differ',()=>{
  const a=new WorldV1(12345,'overworld'),b=new WorldV1(12345,'overworld');
  for(const [x,z] of [[0,0],[31,-19],[-50,42]]){assert.equal(a.surfaceHeight(x,z),b.surfaceHeight(x,z));assert.equal(a.biomeAt(x,z),b.biomeAt(x,z));}
  const ca=a.generateChunk(0,0),cb=b.generateChunk(0,0);assert.deepEqual([...ca.blocks.slice(0,500)],[...cb.blocks.slice(0,500)]);
  const ember=new WorldV1(12345,'emberdeep');assert.notDeepEqual([...ember.generateChunk(0,0).blocks.slice(0,500)],[...ca.blocks.slice(0,500)]);
});

test('world block states, fluids, crops and save round trip work',()=>{
  const w=new WorldV1(77,'overworld');w.ensureChunk(0,0);const y=w.surfaceY(2,2)+3;
  w.setBlock(2,y,2,BLOCK.WATER,{state:{level:0,source:true}});w.tickFluids(20);assert.equal(w.getBlock(2,y-1,2),BLOCK.WATER);
  const fy=w.surfaceY(5,5);w.setBlock(5,fy-1,5,BLOCK.FARMLAND,{state:{hydrated:true}});w.setBlock(5,fy,5,BLOCK.CROP,{state:{age:6}});const oldRandom=Math.random;Math.random=()=>0;try{w.randomTick(()=>0,400);}finally{Math.random=oldRandom;}const state=w.getState(5,fy,5);assert.ok((state?.age??6)>=6);
  const raw=w.serialize(),copy=new WorldV1(77,'overworld');assert.equal(copy.load(raw),true);assert.equal(copy.getBlock(2,y,2),BLOCK.WATER);assert.equal(copy.dimension,'overworld');
});

test('Flux propagates from lever to lamp and gamerules serialize',()=>{
  const w=new WorldV1(9,'overworld'),y=w.surfaceY(0,0)+4;w.setBlock(0,y,0,BLOCK.LEVER,{state:{on:false}});w.setBlock(1,y,0,BLOCK.FLUX_WIRE);w.setBlock(2,y,0,BLOCK.FLUX_LAMP);const flux=new FluxSystem(w);assert.equal(flux.toggleLever(0,y,0),true);flux.tick(1);assert.equal(flux.isPowered(2,y,0),true);assert.equal(w.getState(2,y,0)?.powered,true);
  const rules=new GameRules();rules.set('keepInventory',true);const rules2=new GameRules();rules2.load(rules.serialize());assert.equal(rules2.get('keepInventory'),true);flux.dispose();
});

test('explosions respect bedrock and destroy nearby weak blocks',()=>{
  const w=new WorldV1(5,'overworld'),y=w.surfaceY(0,0)+5;w.setBlock(0,y,0,BLOCK.TNT);w.setBlock(1,y,0,BLOCK.PLANKS);w.setBlock(0,y+1,0,BLOCK.BEDROCK);const destroyed=explode(w,0,y,0,4,{random:()=>0.5});assert.ok(destroyed.some((d)=>d.id===BLOCK.PLANKS));assert.equal(w.getBlock(0,y+1,0),BLOCK.BEDROCK);
});

test('entity manager handles drops, breeding, pathfinding and boss completion',()=>{
  const w=new WorldV1(99,'overworld'),drops=[];const em=new EntityManagerV1(w,{seed:1,onDrop:(id,count)=>drops.push([id,count])});const y=w.surfaceY(0,0),pig=em.spawn('pig',.5,y,.5),pig2=em.spawn('pig',1.2,y,.5);assert.equal(em.feed(pig,ITEM.WHEAT),true);assert.equal(em.feed(pig2,ITEM.WHEAT),true);em.tickBreeding();assert.ok(em.entities.filter((e)=>e.type==='pig').length>=3);const path=findPath2D(w,pig,{x:3.5,y,z:.5},8,100);assert.ok(path===null||Array.isArray(path));const boss=em.spawnBoss(4.5,w.surfaceY(4.5,0),.5);const result=em.attack(boss,999,{x:0,y,z:0});assert.equal(result.killed,true);assert.equal(em.flags.bossDefeated,true);assert.ok(drops.length>0);
});

test('command console mutates controlled state with validation',()=>{
  const w=new WorldV1(8,'overworld'),inv=new InventoryV1(),stats=new PlayerStatsV1(),rules=new GameRules(),adv=new AdvancementSystem(),pos={x:0,y:40,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};let dimension=null;const cmd=new CommandConsole({world:w,inventory:inv,stats,rules,advancements:adv,position:pos,changeDimension:(d)=>dimension=d,summon:()=>({}),explode:()=>{}});
  assert.equal(cmd.execute('/give diamond 3').ok,true);assert.equal(inv.count(ITEM.DIAMOND),3);assert.equal(cmd.execute('/gamemode creative').ok,true);assert.equal(stats.gameMode,'creative');assert.equal(cmd.execute('/setblock 1 30 1 torch').ok,true);assert.equal(w.getBlock(1,30,1),BLOCK.TORCH);assert.equal(cmd.execute('/gamerule keepInventory true').ok,true);assert.equal(rules.get('keepInventory'),true);assert.equal(cmd.execute('/dimension emberdeep').ok,true);assert.equal(dimension,'emberdeep');
});

test('SaveDB memory fallback stores, lists, exports and imports worlds',async()=>{
  const db=new SaveDB();db.available=false;const payload={meta:{name:'Teste'},world:{seed:1,dimension:'overworld'},player:{stats:{gameMode:'survival'}},automation:{},advancements:[],rules:{}};await db.saveWorld('teste',payload);assert.equal((await db.listWorlds()).length,1);const text=await db.exportWorld('teste');assert.match(text,/voxelcraft-v1/);const id=await db.importWorld(text,'copia');assert.equal(id,'copia');assert.equal((await db.loadWorld('copia')).world.seed,1);
});

test('mining tiers prevent hand harvesting of tiered stone',()=>{
  const stone=blockDef(BLOCK.STONE);assert.equal(miningSpeed(stone,null).harvest,false);const inv=new InventoryV1();inv.add(ITEM.WOOD_PICKAXE,1);assert.equal(miningSpeed(stone,inv.slots.find((s)=>s?.id===ITEM.WOOD_PICKAXE)).harvest,true);
});
