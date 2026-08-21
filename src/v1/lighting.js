import { blockDef, isOpaque } from './catalog.js';

const key=(x,y,z)=>`${x},${y},${z}`;
const DIRS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

export class LightEngine{
  constructor(world,{radius=18}={}){this.world=world;this.radius=radius;this.blockLight=new Map();this.dirtyRegions=[];this.lastCenter=null;this.unsubscribe=world.onChange?.((e)=>{if(e.type==='block')this.markDirty(e.x,e.y,e.z);});}
  dispose(){this.unsubscribe?.();this.blockLight.clear();this.dirtyRegions=[];}
  markDirty(x,y,z){this.dirtyRegions.push({x:Math.floor(x),y:Math.floor(y),z:Math.floor(z),r:16});if(this.dirtyRegions.length>32)this.dirtyRegions.splice(0,this.dirtyRegions.length-32);}
  updateAround(x,y,z,budget=1){const cx=Math.floor(x),cy=Math.floor(y),cz=Math.floor(z),center=`${Math.floor(cx/16)},${Math.floor(cz/16)}`;if(center!==this.lastCenter){this.lastCenter=center;this.dirtyRegions.push({x:cx,y:cy,z:cz,r:this.radius});}for(let i=0;i<budget&&this.dirtyRegions.length;i++)this.rebuildRegion(this.dirtyRegions.shift());}
  rebuildRegion(region){const {x:cx,y:cy,z:cz,r}=region,minX=cx-r,maxX=cx+r,minY=Math.max(0,cy-r),maxY=Math.min(95,cy+r),minZ=cz-r,maxZ=cz+r;
    for(const k of [...this.blockLight.keys()]){const[x,y,z]=k.split(',').map(Number);if(x>=minX&&x<=maxX&&y>=minY&&y<=maxY&&z>=minZ&&z<=maxZ)this.blockLight.delete(k);}
    const queue=[];
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)for(let y=minY;y<=maxY;y++){const emits=blockDef(this.world.getBlock(x,y,z))?.emits||0;if(emits>0){this.blockLight.set(key(x,y,z),Math.min(15,emits));queue.push([x,y,z,Math.min(15,emits)]);}}
    let guard=0;while(queue.length&&guard++<100000){const[x,y,z,level]=queue.shift();if(level<=1)continue;for(const[dx,dy,dz]of DIRS){const nx=x+dx,ny=y+dy,nz=z+dz;if(nx<minX||nx>maxX||ny<minY||ny>maxY||nz<minZ||nz>maxZ)continue;if(isOpaque(this.world.getBlock(nx,ny,nz))&&!(blockDef(this.world.getBlock(nx,ny,nz))?.emits>0))continue;const next=level-1,k=key(nx,ny,nz);if((this.blockLight.get(k)||0)>=next)continue;this.blockLight.set(k,next);queue.push([nx,ny,nz,next]);}}
  }
  blockAt(x,y,z){return this.blockLight.get(key(Math.floor(x),Math.floor(y),Math.floor(z)))||0;}
  skyAt(x,y,z){return this.world.skyLightAt(Math.floor(x),Math.floor(y),Math.floor(z));}
  combinedAt(x,y,z){return Math.max(this.skyAt(x,y,z),this.blockAt(x,y,z));}
}
