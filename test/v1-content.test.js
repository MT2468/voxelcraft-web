import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM } from '../src/v1/catalog.js';
import { InventoryV1, PlayerStatsV1 } from '../src/v1/systems.js';
import { WorldV1 } from '../src/v1/world.js';
import { TradeSystem, FishingSystem, BrewingSystem, ExplorationMap, PlayerStatistics } from '../src/v1/content-systems.js';

test('trading consumes costs and grants rewards with reputation',()=>{const inv=new InventoryV1(),stats=new PlayerStatsV1(),trade=new TradeSystem();inv.add(ITEM.COAL,12);assert.equal(trade.trade(inv,'coal_for_iron',stats),true);assert.equal(inv.count(ITEM.COAL),0);assert.equal(inv.count(ITEM.IRON_INGOT),2);assert.ok(trade.reputation>0);assert.ok(stats.xp>0);});

test('fishing requires nearby water and rewards loot on bite',()=>{const world=new WorldV1(33,'overworld'),inv=new InventoryV1(),stats=new PlayerStatsV1(),fish=new FishingSystem(()=>0);const x=.5,z=.5,y=world.surfaceY(x,z);world.setBlock(1,Math.floor(y),0,15,{state:{level:0,source:true}});assert.equal(fish.cast(world,{x,y,z}).ok,true);fish.timer=0;assert.equal(fish.tick(.1).type,'bite');const result=fish.reel(inv,stats);assert.equal(result.ok,true);assert.equal(inv.has(ITEM.FISH),true);assert.equal(fish.catches,1);});

test('brewing consumes ingredients and creates potion after timer',()=>{const inv=new InventoryV1(),brew=new BrewingSystem();inv.add(ITEM.APPLE,2);inv.add(ITEM.GOLD_INGOT,1);assert.equal(brew.start(inv,'heal'),true);const done=brew.tick(6,inv);assert.equal(done.out,ITEM.POTION_HEAL);assert.equal(inv.has(ITEM.POTION_HEAL),true);});

test('exploration map records per-dimension chunks and survives serialization',()=>{const world=new WorldV1(7,'overworld'),map=new ExplorationMap();map.visit(world,0,0);map.visit(world,33,0);assert.equal(map.discovered.size,2);const copy=new ExplorationMap();copy.load(map.serialize());assert.equal(copy.discovered.size,2);assert.ok(copy.bounds('overworld').maxX>=2);});

test('player statistics count and persist gameplay metrics',()=>{const s=new PlayerStatistics();s.add('blocksMined',5);s.add('trades',2);s.visitDimension('emberdeep');s.tick(12.5);const copy=new PlayerStatistics();copy.load(s.serialize());assert.equal(copy.values.blocksMined,5);assert.equal(copy.values.trades,2);assert.equal(copy.values.dimensionsVisited,2);assert.equal(copy.values.playSeconds,12.5);});
