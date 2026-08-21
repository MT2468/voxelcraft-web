const HUBS=new WeakMap();

export function observeMainScene(renderer,listener){
  if(!renderer||typeof renderer.render!=='function'||typeof listener!=='function')return()=>{};
  let hub=HUBS.get(renderer);
  if(!hub){
    const original=renderer.render.bind(renderer);
    hub={renderer,original,scene:null,camera:null,listeners:new Set(),proxy:null};
    hub.proxy=function(scene,camera){
      if(scene!==hub.scene||camera!==hub.camera){
        hub.scene=scene;hub.camera=camera;
        for(const fn of hub.listeners){try{fn(scene,camera);}catch(error){console.warn('scene observer failed',error);}}
      }
      return original(scene,camera);
    };
    renderer.render=hub.proxy;
    HUBS.set(renderer,hub);
  }
  hub.listeners.add(listener);
  if(hub.scene&&hub.camera)queueMicrotask(()=>{if(hub.listeners.has(listener))listener(hub.scene,hub.camera);});
  return()=>{
    const current=HUBS.get(renderer);if(!current)return;
    current.listeners.delete(listener);
    if(current.listeners.size===0&&renderer.render===current.proxy){renderer.render=current.original;HUBS.delete(renderer);}
  };
}

export function getMainScene(renderer){const hub=HUBS.get(renderer);return hub?{scene:hub.scene,camera:hub.camera}:null;}
