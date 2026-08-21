import test from 'node:test';
import assert from 'node:assert/strict';
import { VerityBehavior } from '../src/mods/verity/behavior.js';

test('weak-PC profile lowers pathfinding work without disabling AI',()=>{
  const previous=globalThis.VoxelCraftPerformance;
  try{
    globalThis.VoxelCraftPerformance={current:{mode:'low',scale:.8}};const low=new VerityBehavior({},{}).performance();
    globalThis.VoxelCraftPerformance={current:{mode:'quality',scale:1.5}};const high=new VerityBehavior({},{}).performance();
    assert.ok(low.friendNodes<high.friendNodes);assert.ok(low.demonNodes<high.demonNodes);assert.ok(low.friendDelay>high.friendDelay);assert.ok(low.demonDelay>high.demonDelay);assert.ok(low.friendNodes>=60&&low.demonNodes>=100,'low mode must keep real pathfinding active');
  }finally{if(previous===undefined)delete globalThis.VoxelCraftPerformance;else globalThis.VoxelCraftPerformance=previous;}
});
