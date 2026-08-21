import { WorldV1 } from './world.js';

let cached=null,cachedSeed=null,cachedDimension=null;
self.onmessage=(event)=>{
  const {id,seed,dimension,cx,cz}=event.data||{};
  try{
    if(!cached||cachedSeed!==seed||cachedDimension!==dimension){cached=new WorldV1(seed,dimension);cachedSeed=seed;cachedDimension=dimension;}
    const chunk=cached.generateChunk(cx,cz),buffer=chunk.blocks.buffer;
    self.postMessage({id,ok:true,seed,dimension,cx,cz,blocks:buffer,structures:[...cached.generatedStructures]},[buffer]);
  }catch(error){self.postMessage({id,ok:false,message:error?.message||String(error),seed,dimension,cx,cz});}
};
