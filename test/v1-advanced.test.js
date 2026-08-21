import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK, ITEM } from '../src/v1/catalog.js';
import { WorldV1 } from '../src/v1/world.js';
import { FluxSystem, MinecartSystem } from '../src/v1/automation.js';
import { ABLOCK, AITEM, ADVANCED_RECIPES } from '../src/v1/advanced-content.js';
import { ChunkWorkerPool } from '../src/v1/worker-pool.js';

test('advanced content is registered and has recipes',()=>{
  const world=new WorldV1(123);
  assert.equal(world.setBlock(0,30,0,ABLOCK.REPEATER),true);
  assert.ok(ADVANCED_RECIPES.some((r)=>r.out[0]===ABLOCK.HOPPER));
  assert.ok(ADVANCED_RECIPES.some((r)=>r.out[0]===AITEM.BOAT));
});

test('repeater delays Flux and observer emits a pulse',()=>{
  const world=new WorldV1(4),flux=new FluxSystem(world),y=40;
  world.setBlock(0,y,0,BLOCK.LEVER,{state:{on:false}});
  world.setBlock(1,y,0,ABLOCK.REPEATER,{state:{facing:[1,0,0],delay:.12,on:false}});
  world.setBlock(2,y,0,BLOCK.FLUX_WIRE);
  flux.toggleLever(0,y,0);
  flux.tick(.05);
  assert.equal(world.getState(1,y,0)?.on,false);
  flux.tick(.15);flux.tick(.11);
  assert.equal(world.getState(1,y,0)?.on,true);
  assert.equal(flux.isPowered(2,y,0),true);

  world.setBlock(5,y,0,ABLOCK.OBSERVER);
  world.setBlock(6,y,0,BLOCK.STONE);
  flux.tick(.01);
  assert.equal(flux.isPowered(5,y,0),true);
  flux.tick(.3);flux.tick(.11);
  assert.equal(flux.isPowered(5,y,0),false);
  flux.dispose();
});

test('comparator reads containers and hopper transfers item stacks',()=>{
  const world=new WorldV1(5),flux=new FluxSystem(world),y=40;
  world.setBlock(0,y,0,ABLOCK.COMPARATOR,{state:{facing:[1,0,0]}});
  world.blockEntities.set('-1,40,0',{slots:[{id:ITEM.COAL,count:32,data:{}}]});
  flux.tick(.11);
  assert.equal(flux.isPowered(0,y,0),true);

  world.setBlock(3,y,0,ABLOCK.HOPPER,{state:{facing:[0,-1,0]}});
  world.blockEntities.set('3,41,0',{slots:[{id:ITEM.DIAMOND,count:2,data:{}}]});
  world.blockEntities.set('3,39,0',{slots:Array(5).fill(null)});
  flux.tick(.51);
  const target=world.blockEntities.get('3,39,0');
  assert.equal(target.slots[0]?.id,ITEM.DIAMOND);
  assert.equal(target.slots[0]?.count,1);
  flux.dispose();
});

test('dispenser fires once per rising edge',()=>{
  const world=new WorldV1(6),flux=new FluxSystem(world),y=40,events=[];
  world.onChange((e)=>{if(e.type==='dispense')events.push(e);});
  world.setBlock(0,y,0,BLOCK.LEVER,{state:{on:false}});
  world.setBlock(1,y,0,ABLOCK.DISPENSER,{state:{facing:[1,0,0]}});
  world.blockEntities.set('1,40,0',{slots:[{id:ITEM.ARROW,count:2,data:{}}]});
  flux.toggleLever(0,y,0);flux.tick(.11);
  assert.equal(events.length,1);
  flux.tick(.11);assert.equal(events.length,1);
  flux.toggleLever(0,y,0);flux.tick(.11);
  flux.toggleLever(0,y,0);flux.tick(.11);
  assert.equal(events.length,2);
  flux.dispose();
});

test('powered rail accelerates a minecart',()=>{
  const world=new WorldV1(7),flux=new FluxSystem(world),carts=new MinecartSystem(world),y=40;
  world.setBlock(0,y,0,BLOCK.LEVER,{state:{on:true}});
  world.setBlock(1,y,0,ABLOCK.POWERED_RAIL,{state:{powered:false}});
  world.setBlock(2,y,0,BLOCK.RAIL);
  flux.tick(.11);
  const cart=carts.spawn(1.5,y+.45,.5);assert.ok(cart);
  carts.push(cart,1,0,1.5);const before=Math.hypot(cart.vx,cart.vz);carts.tick(.5);
  assert.ok(Math.hypot(cart.vx,cart.vz)>before*.8);
  flux.dispose();
});

test('ChunkWorkerPool has a deterministic synchronous fallback in Node',async()=>{
  const world=new WorldV1(98765,'overworld'),pool=new ChunkWorkerPool(world,{size:2});
  assert.equal(pool.supported,false);
  const chunk=await pool.request(2,-1);
  assert.ok(chunk);
  assert.equal(world.chunks.get('2,-1'),chunk);
  const again=await pool.request(2,-1);
  assert.equal(again,chunk);
  pool.close();
});
