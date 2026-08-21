import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldV1 } from '../src/v1/world.js';
import { BLOCK } from '../src/v1/catalog.js';
import { LightEngine } from '../src/v1/lighting.js';

test('torch light propagates with falloff and reacts to removal',()=>{const world=new WorldV1(101,'overworld');const y=world.surfaceY(0,0)+4;world.setBlock(0,y,0,BLOCK.TORCH);const light=new LightEngine(world);light.rebuildRegion({x:0,y,z:0,r:8});assert.equal(light.blockAt(0,y,0),14);assert.equal(light.blockAt(1,y,0),13);assert.ok(light.blockAt(4,y,0)>0);world.setBlock(0,y,0,BLOCK.AIR);light.rebuildRegion({x:0,y,z:0,r:8});assert.equal(light.blockAt(1,y,0),0);light.dispose();});

test('opaque blocks stop direct block-light flood through a sealed wall',()=>{const world=new WorldV1(102,'overworld');const y=world.surfaceY(0,0)+5;world.setBlock(0,y,0,BLOCK.TORCH);for(let yy=y-2;yy<=y+2;yy++)for(let z=-2;z<=2;z++)world.setBlock(1,yy,z,BLOCK.STONE);const light=new LightEngine(world);light.rebuildRegion({x:0,y,z:0,r:5});assert.equal(light.blockAt(1,y,0),0);assert.ok(light.blockAt(0,y,0)>light.blockAt(2,y,0));light.dispose();});
