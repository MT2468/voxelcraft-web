import test from 'node:test';
import assert from 'node:assert/strict';
import { observeMainScene, getMainScene } from '../src/v1/scene-hook.js';

test('scene observer captures one native scene without duplicate renderers',()=>{
  const calls=[];const renderer={count:0,render(scene,camera){this.count++;return `${scene.id}:${camera.id}`;}};const scene={id:'world'},camera={id:'player'};
  const offA=observeMainScene(renderer,(s,c)=>calls.push(['a',s.id,c.id]));const offB=observeMainScene(renderer,(s,c)=>calls.push(['b',s.id,c.id]));
  assert.equal(renderer.render(scene,camera),'world:player');assert.equal(renderer.count,1);assert.deepEqual(getMainScene(renderer),{scene,camera});assert.equal(calls.length,2);
  renderer.render(scene,camera);assert.equal(renderer.count,2);assert.equal(calls.length,2,'same scene/camera must not notify every frame');
  offA();renderer.render({id:'next'},camera);assert.equal(calls.filter(x=>x[0]==='a').length,1);assert.equal(calls.filter(x=>x[0]==='b').length,2);offB();assert.equal(renderer.render(scene,camera),'world:player');assert.equal(renderer.count,4);
});
