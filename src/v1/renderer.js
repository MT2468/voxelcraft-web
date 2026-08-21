import * as THREE from 'three';
import { BLOCK, BLOCKS, blockDef, isLiquid, isOpaque } from './catalog.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from './world.js';
import { createTextureAtlas } from './texture-atlas.js';

const FACES=[
  {d:[1,0,0],shade:.84,c:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]},
  {d:[-1,0,0],shade:.72,c:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]},
  {d:[0,1,0],shade:1,c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]},
  {d:[0,-1,0],shade:.56,c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},
  {d:[0,0,1],shade:.91,c:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]]},
  {d:[0,0,-1],shade:.78,c:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]}
];
const q=(cx,cz)=>`${cx},${cz}`;

export class WorldRendererV1{
  constructor(scene,world,{renderRadius=3}={}){this.scene=scene;this.world=world;this.renderRadius=renderRadius;this.meshes=new Map();this.atlas=createTextureAtlas(THREE,BLOCKS);this.solidMaterial=new THREE.MeshLambertMaterial({map:this.atlas.texture,vertexColors:true,alphaTest:.18});this.liquidMaterial=new THREE.MeshLambertMaterial({map:this.atlas.texture,vertexColors:true,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide});this.rebuildBudget=1;this.generationBudget=1;this.targetCenter='';this.pending=[];}
  dispose(){for(const pair of this.meshes.values())for(const mesh of Object.values(pair))if(mesh){this.scene.remove(mesh);mesh.geometry.dispose();}this.solidMaterial.dispose();this.liquidMaterial.dispose();this.atlas.texture.dispose();this.meshes.clear();this.pending=[];}
  update(centerX,centerZ){
    const ccx=Math.floor(centerX/16),ccz=Math.floor(centerZ/16),centerKey=q(ccx,ccz);
    if(this.targetCenter!==centerKey){this.targetCenter=centerKey;this.pending=[];for(let dx=-this.renderRadius;dx<=this.renderRadius;dx++)for(let dz=-this.renderRadius;dz<=this.renderRadius;dz++)this.pending.push({cx:ccx+dx,cz:ccz+dz,d:Math.max(Math.abs(dx),Math.abs(dz)),m:Math.abs(dx)+Math.abs(dz)});this.pending.sort((a,b)=>a.d-b.d||a.m-b.m);}
    let generated=0;while(this.pending.length&&generated<this.generationBudget){const next=this.pending.shift(),key=q(next.cx,next.cz);if(!this.world.chunks.has(key)){this.world.ensureChunk(next.cx,next.cz);generated++;}}
    if(!this.world.chunks.has(centerKey))this.world.ensureChunk(ccx,ccz);
    this.world.unloadFar(ccx,ccz,this.renderRadius+2);
    for(const[key,pair]of this.meshes)if(!this.world.chunks.has(key)){for(const mesh of Object.values(pair))if(mesh){this.scene.remove(mesh);mesh.geometry.dispose();}this.meshes.delete(key);}
    const dirty=[...this.world.chunks.values()].filter((c)=>c.dirty&&Math.abs(c.cx-ccx)<=this.renderRadius&&Math.abs(c.cz-ccz)<=this.renderRadius).sort((a,b)=>(Math.max(Math.abs(a.cx-ccx),Math.abs(a.cz-ccz))-Math.max(Math.abs(b.cx-ccx),Math.abs(b.cz-ccz)))||((Math.abs(a.cx-ccx)+Math.abs(a.cz-ccz))-(Math.abs(b.cx-ccx)+Math.abs(b.cz-ccz))));
    for(let i=0;i<Math.min(this.rebuildBudget,dirty.length);i++)this.rebuildChunk(dirty[i]);
  }
  rebuildChunk(chunk){const key=q(chunk.cx,chunk.cz),old=this.meshes.get(key);if(old)for(const mesh of Object.values(old))if(mesh){this.scene.remove(mesh);mesh.geometry.dispose();}
    const solidData=geometryForChunk(this.world,chunk,this.atlas,false),liquidData=geometryForChunk(this.world,chunk,this.atlas,true),pair={solid:null,liquid:null};
    if(solidData){pair.solid=new THREE.Mesh(solidData,this.solidMaterial);pair.solid.frustumCulled=true;pair.solid.userData.chunk={cx:chunk.cx,cz:chunk.cz};this.scene.add(pair.solid);}
    if(liquidData){pair.liquid=new THREE.Mesh(liquidData,this.liquidMaterial);pair.liquid.renderOrder=2;pair.liquid.userData.chunk={cx:chunk.cx,cz:chunk.cz};this.scene.add(pair.liquid);}
    this.meshes.set(key,pair);chunk.dirty=false;
  }
  raycastObjects(){const out=[];for(const p of this.meshes.values()){if(p.solid)out.push(p.solid);if(p.liquid)out.push(p.liquid);}return out;}
}

function geometryForChunk(world,chunk,atlas,liquidPass){const pos=[],norm=[],uv=[],colors=[],ind=[];let base=0;const sx=chunk.cx*16,sz=chunk.cz*16,color=new THREE.Color();
  for(let lx=0;lx<16;lx++)for(let lz=0;lz<16;lz++)for(let y=0;y<WORLD_HEIGHT;y++){const id=chunk.get(lx,y,lz);if(!id||isLiquid(id)!==liquidPass)continue;const def=blockDef(id);if(!def)continue;const x=sx+lx,z=sz+lz;
    for(const face of FACES){const[dx,dy,dz]=face.d,nid=neighborId(world,chunk,lx,y,lz,dx,dy,dz);if(liquidPass){if(nid===id)continue;if(isLiquid(nid)&&nid!==id)continue;}else{if(nid&&isOpaque(nid))continue;if(nid===id&&!def.transparent)continue;}
      let light=1;if(world.dimension==='overworld'){const sky=fastSkyLight(world,chunk,lx+dx,y+dy,lz+dz,x+dx,z+dz)/15;light=.18+.82*sky;}else light=world.dimension==='emberdeep'?.42:.55;const emits=def.emits||0;if(emits)light=Math.max(light,.45+emits/30);color.setHex(def.color||0xffffff).multiplyScalar(face.shade*light);
      const[u0,v0,u1,v1]=atlas.uvRect(id),faceUv=[[u0,v0],[u0,v1],[u1,v1],[u1,v0]];
      for(let i=0;i<4;i++){const c=face.c[i];pos.push(x+c[0],y+c[1],z+c[2]);norm.push(dx,dy,dz);uv.push(...faceUv[i]);colors.push(color.r,color.g,color.b);}ind.push(base,base+1,base+2,base,base+2,base+3);base+=4;
    }
  }
  if(!pos.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(ind);g.computeBoundingSphere();return g;}
function neighborId(world,chunk,lx,y,lz,dx,dy,dz){const nx=lx+dx,ny=y+dy,nz=lz+dz;if(ny<0||ny>=WORLD_HEIGHT)return BLOCK.AIR;if(nx>=0&&nx<16&&nz>=0&&nz<16)return chunk.get(nx,ny,nz);const wcx=chunk.cx+(nx<0?-1:nx>=16?1:0),wcz=chunk.cz+(nz<0?-1:nz>=16?1:0),other=world.chunks.get(q(wcx,wcz));if(!other)return BLOCK.AIR;return other.get((nx+16)%16,ny,(nz+16)%16);}
function fastSkyLight(world,chunk,lx,y,lz,wx,wz){if(world.dimension!=='overworld')return world.dimension==='voidlands'?4:0;if(lx>=0&&lx<16&&lz>=0&&lz<16){for(let yy=y+1;yy<WORLD_HEIGHT;yy++)if(isOpaque(chunk.get(lx,yy,lz)))return 0;return 15;}return world.chunks.has(q(Math.floor(wx/16),Math.floor(wz/16)))?world.skyLightAt(wx,y,wz):15;}

const GEO={head:new THREE.BoxGeometry(.62,.62,.62),body:new THREE.BoxGeometry(.72,.88,.42),limb:new THREE.BoxGeometry(.23,.68,.23),quad:new THREE.BoxGeometry(.9,.58,.5),small:new THREE.BoxGeometry(.5,.45,.45),boss:new THREE.BoxGeometry(1.45,1.8,.8)};
export class EntityRendererV1{
  constructor(scene){this.scene=scene;this.views=new Map();this.projectileViews=new Map();}
  dispose(){for(const v of this.views.values()){this.scene.remove(v.group);disposeView(v);}this.views.clear();for(const m of this.projectileViews.values()){this.scene.remove(m);m.geometry.dispose();m.material.dispose();}this.projectileViews.clear();}
  update(manager,remotePlayers=[]){const alive=new Set();for(const e of manager.entities){alive.add(e.id);let v=this.views.get(e.id);if(!v){v=createEntityView(e);this.views.set(e.id,v);this.scene.add(v.group);}syncEntityView(v,e);}for(const[id,v]of this.views)if(!String(id).startsWith('remote:')&&!alive.has(id)){this.scene.remove(v.group);disposeView(v);this.views.delete(id);}
    const pa=new Set();for(const p of manager.projectiles){pa.add(p.id);let mesh=this.projectileViews.get(p.id);if(!mesh){mesh=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.55),new THREE.MeshLambertMaterial({color:0x6f573d}));this.projectileViews.set(p.id,mesh);this.scene.add(mesh);}mesh.position.set(p.x,p.y,p.z);mesh.lookAt(p.x+p.vx,p.y+p.vy,p.z+p.vz);}for(const[id,m]of this.projectileViews)if(!pa.has(id)){this.scene.remove(m);m.geometry.dispose();m.material.dispose();this.projectileViews.delete(id);}
    this.updateRemotes(remotePlayers);
  }
  updateRemotes(players){const seen=new Set();for(const p of players){const id=`remote:${p.id}`;seen.add(id);let v=this.views.get(id);if(!v){v=createRemoteView();this.views.set(id,v);this.scene.add(v.group);}v.group.position.set(p.x,p.y,p.z);v.group.rotation.y=p.yaw||0;}for(const[id,v]of this.views)if(String(id).startsWith('remote:')&&!seen.has(id)){this.scene.remove(v.group);disposeView(v);this.views.delete(id);}}
}

function createEntityView(e){const group=new THREE.Group(),colors=entityColors(e.type),mats=colors.map((c)=>new THREE.MeshLambertMaterial({color:c})),parts=[];if(['pig','cow','sheep','wolf','chicken'].includes(e.type)){const body=part(GEO.quad,mats[0],0,.65,0),head=part(GEO.small,mats[1]||mats[0],0,.78,.48);group.add(body,head);parts.push(body,head);for(const[x,z]of[[-.3,.2],[.3,.2],[-.3,-.2],[.3,-.2]]){const leg=part(GEO.limb,mats[0],x,.25,z);group.add(leg);parts.push(leg);}}
  else if(e.type==='void_titan'){const body=part(GEO.boss,mats[0],0,1.2,0),head=part(new THREE.BoxGeometry(1.05,1.05,1.05),mats[1]||mats[0],0,2.55,0);group.add(body,head);parts.push(body,head);for(const x of[-.85,.85]){const arm=part(new THREE.BoxGeometry(.38,1.7,.38),mats[0],x,1.25,0);group.add(arm);parts.push(arm);}}
  else{const head=part(GEO.head,mats[0],0,1.72,0),body=part(GEO.body,mats[1]||mats[0],0,1,0);group.add(head,body);parts.push(head,body);for(const x of[-.2,.2]){const leg=part(GEO.limb,mats[2]||mats[0],x,.36,0);group.add(leg);parts.push(leg);}for(const x of[-.49,.49]){const arm=part(GEO.limb,mats[0],x,1.08,-.05);group.add(arm);parts.push(arm);}}
  return{group,mats,parts,phase:Math.random()*6};}
function syncEntityView(v,e){v.group.position.set(e.x,e.y,e.z);if(e.vx||e.vz)v.group.rotation.y=Math.atan2(e.vx,e.vz);v.phase+=.12*Math.hypot(e.vx,e.vz);const s=e.data?.baby?.65:1;v.group.scale.setScalar(e.type==='void_titan'?1.15:s);for(const m of v.mats){m.emissive?.setHex(e.hurtTimer>0?0x5a0000:0);}}
function createRemoteView(){const group=new THREE.Group(),skin=new THREE.MeshLambertMaterial({color:0xd0a078}),shirt=new THREE.MeshLambertMaterial({color:0x4a72b8}),pants=new THREE.MeshLambertMaterial({color:0x33384e}),mats=[skin,shirt,pants];group.add(part(GEO.head,skin,0,1.72,0),part(GEO.body,shirt,0,1,0),part(GEO.limb,pants,-.2,.36,0),part(GEO.limb,pants,.2,.36,0));return{group,mats,parts:[...group.children]};}
function part(g,m,x,y,z){const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);return mesh;}
function disposeView(v){for(const m of v.mats)m.dispose();}
function entityColors(type){const map={pig:[0xd9868c,0xc46e79],cow:[0x6c4933,0xd8c7a2],chicken:[0xf0eee3,0xd85f35],sheep:[0xe8e6dc,0x9b8f83],wolf:[0x8f918d,0xc1c1ba],zombie:[0x5d8e4f,0x3e7675,0x454f78],skeleton:[0xd8d6c8,0xb9b7aa,0x88867c],creeper:[0x55a74c,0x427f3c],slime:[0x62b871,0x79d188],emberling:[0xd65d27,0x5e2920],voidling:[0x58477a,0x8c70b6],void_titan:[0x342354,0x9f75df]};return map[type]||[0x999999,0x777777,0x555555];}

export class WeatherRendererV1{
  constructor(scene,count=700){this.scene=scene;this.count=count;this.positions=new Float32Array(count*3);this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.material=new THREE.PointsMaterial({color:0xbfd8ff,size:.055,transparent:true,opacity:0,depthWrite:false});this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;scene.add(this.points);this.seeded=false;}
  dispose(){this.scene.remove(this.points);this.geometry.dispose();this.material.dispose();}
  reseed(camera){for(let i=0;i<this.count;i++){this.positions[i*3]=camera.position.x+(Math.random()-.5)*34;this.positions[i*3+1]=camera.position.y+Math.random()*22-5;this.positions[i*3+2]=camera.position.z+(Math.random()-.5)*34;}this.geometry.attributes.position.needsUpdate=true;this.seeded=true;}
  update(dt,camera,weather,biome='plains'){if(!this.seeded)this.reseed(camera);this.material.opacity=weather.intensity*.72;this.material.color.setHex(biome==='tundra'?0xffffff:0xaad1ff);if(weather.intensity<.02){this.points.visible=false;return;}this.points.visible=true;const snow=biome==='tundra';for(let i=0;i<this.count;i++){const j=i*3;this.positions[j+1]-=dt*(snow?2.5:14);this.positions[j]+=snow?Math.sin((i+performance.now()*.001))*dt*.25:0;if(this.positions[j+1]<camera.position.y-7){this.positions[j]=camera.position.x+(Math.random()-.5)*34;this.positions[j+1]=camera.position.y+15+Math.random()*8;this.positions[j+2]=camera.position.z+(Math.random()-.5)*34;}}this.geometry.attributes.position.needsUpdate=true;}
}