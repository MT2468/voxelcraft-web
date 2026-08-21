const DB_NAME='voxelcraft-worlds';
const DB_VERSION=2;
const STORES=['worlds','chunks','players','settings','addons'];

export class SaveDB {
  constructor(){this.db=null;this.memory=new Map();this.available=typeof indexedDB!=='undefined';}
  async open(){if(this.db||!this.available)return this;this.db=await new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const name of STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return this;}
  async put(store,key,value){await this.open();if(!STORES.includes(store))throw new Error(`Unknown save store: ${store}`);if(!this.db){this.memory.set(`${store}:${key}`,structuredCloneSafe(value));return true;}return txPromise(this.db,store,'readwrite',(s)=>s.put(value,key));}
  async get(store,key){await this.open();if(!STORES.includes(store))throw new Error(`Unknown save store: ${store}`);if(!this.db)return structuredCloneSafe(this.memory.get(`${store}:${key}`));return txPromise(this.db,store,'readonly',(s)=>s.get(key));}
  async delete(store,key){await this.open();if(!STORES.includes(store))throw new Error(`Unknown save store: ${store}`);if(!this.db){this.memory.delete(`${store}:${key}`);return true;}return txPromise(this.db,store,'readwrite',(s)=>s.delete(key));}
  async keys(store){await this.open();if(!STORES.includes(store))throw new Error(`Unknown save store: ${store}`);if(!this.db)return[...this.memory.keys()].filter((k)=>k.startsWith(`${store}:`)).map((k)=>k.slice(store.length+1));return txPromise(this.db,store,'readonly',(s)=>s.getAllKeys());}
  async saveWorld(worldId,payload){const now=Date.now(),meta={id:worldId,name:payload.meta?.name||worldId,seed:payload.world?.seed,dimension:payload.world?.dimension||'overworld',gameMode:payload.player?.stats?.gameMode||'survival',updatedAt:now,createdAt:payload.meta?.createdAt||now,version:2};await this.put('worlds',worldId,{meta,world:payload.world,automation:payload.automation,advancements:payload.advancements,rules:payload.rules});await this.put('players',worldId,payload.player);if(payload.addons!==undefined)await this.put('addons',worldId,payload.addons);return meta;}
  async loadWorld(worldId){const root=await this.get('worlds',worldId);if(!root)return null;const[player,addons]=await Promise.all([this.get('players',worldId),this.get('addons',worldId)]);return{...root,player,addons};}
  async saveAddons(worldId,payload){await this.put('addons',worldId,{version:1,updatedAt:Date.now(),payload:structuredCloneSafe(payload)});return true;}
  async loadAddons(worldId){const raw=await this.get('addons',worldId);return raw?.payload??raw??null;}
  async listWorlds(){const keys=await this.keys('worlds'),out=[];for(const key of keys){const root=await this.get('worlds',key);if(root?.meta)out.push(root.meta);}return out.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));}
  async deleteWorld(worldId){await Promise.all([this.delete('worlds',worldId),this.delete('players',worldId),this.delete('addons',worldId)]);const chunkKeys=await this.keys('chunks');for(const key of chunkKeys)if(String(key).startsWith(`${worldId}:`))await this.delete('chunks',key);}
  async exportWorld(worldId){const payload=await this.loadWorld(worldId);if(!payload)throw new Error('World not found');return JSON.stringify({format:'voxelcraft-v1',exportedAt:new Date().toISOString(),payload},null,2);}
  async importWorld(text,preferredId=null){const parsed=JSON.parse(text);if(parsed?.format!=='voxelcraft-v1'||!parsed.payload?.world)throw new Error('Invalid VoxelCraft V1 backup');const base=preferredId||slug(parsed.payload.meta?.name||'imported-world'),id=await this.uniqueId(base);await this.saveWorld(id,parsed.payload);if(parsed.payload.addons!==undefined)await this.saveAddons(id,parsed.payload.addons?.payload??parsed.payload.addons);return id;}
  async uniqueId(base){const safe=slug(base)||'world',existing=new Set(await this.keys('worlds'));if(!existing.has(safe))return safe;let i=2;while(existing.has(`${safe}-${i}`))i++;return`${safe}-${i}`;}
  async migrateLegacy(){
    if(typeof localStorage==='undefined')return null;const raw=localStorage.getItem('voxelcraft-web-save-v4');if(!raw)return null;
    try{const legacy=JSON.parse(raw),id=await this.uniqueId('legacy-v4');const payload={meta:{name:'Mundo migrado da v4'},world:{version:1,seed:legacy.seed||1,dimension:'overworld',time:legacy.time||0.28,edits:Array.isArray(legacy.edits)?legacy.edits:[],states:[],blockEntities:[],weather:{type:'clear',timer:180,intensity:0,target:0},structures:[]},player:{position:legacy.player||[0.5,40,0.5],rotation:legacy.rotation||[0,0,0],inventory:legacy.inventory||null,stats:legacy.survival||null},advancements:[],automation:{},rules:{}};await this.saveWorld(id,payload);return id;}catch{return null;}
  }
}

export class AutosaveController {
  constructor(saveFn,intervalMs=20000){this.saveFn=saveFn;this.intervalMs=intervalMs;this.timer=0;this.pending=false;this.lastSave=0;}
  tick(dt){this.timer+=dt*1000;if(this.timer>=this.intervalMs){this.timer=0;this.request();}}
  async request(){if(this.pending)return false;this.pending=true;try{await this.saveFn();this.lastSave=Date.now();return true;}finally{this.pending=false;}}
}

function txPromise(db,store,mode,operation){return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),s=tx.objectStore(store),req=operation(s);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.onabort=()=>reject(tx.error);});}
function structuredCloneSafe(value){if(value==null)return value;if(typeof structuredClone==='function')return structuredClone(value);return JSON.parse(JSON.stringify(value));}
function slug(text){return String(text||'world').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);}
