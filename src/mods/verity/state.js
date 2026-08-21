export const VERITY_PHASES=Object.freeze({DORMANT:0,FRIEND:1,ATTACHED:2,UNCANNY:3,STALKING:4,DEMON:5,AFTERMATH:6});
export const VERITY_PHASE_NAMES=Object.freeze(['dormant','friend','attached','uncanny','stalking','demon','aftermath']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class VerityMemory{
  constructor(){this.entries=[];this.facts=new Map();this.maxEntries=180;}
  remember(kind,text,weight=1,meta={}){const entry={id:cryptoId(),kind:String(kind),text:String(text).slice(0,500),weight:clamp(Number(weight)||1,.1,10),meta:{...meta},at:Date.now()};this.entries.push(entry);if(this.entries.length>this.maxEntries)this.entries.splice(0,this.entries.length-this.maxEntries);return entry;}
  setFact(key,value){this.facts.set(String(key),value);}
  getFact(key,fallback=null){return this.facts.has(String(key))?this.facts.get(String(key)):fallback;}
  recent(limit=12,kind=null){const list=kind?this.entries.filter((e)=>e.kind===kind):this.entries;return list.slice(-Math.max(1,limit));}
  score(kind){return this.entries.filter((e)=>e.kind===kind).reduce((n,e)=>n+e.weight,0);}
  search(term,limit=8){const q=String(term||'').toLowerCase();if(!q)return[];return this.entries.filter((e)=>e.text.toLowerCase().includes(q)||Object.values(e.meta||{}).some((v)=>String(v).toLowerCase().includes(q))).slice(-limit).reverse();}
  serialize(){return{entries:this.entries,facts:[...this.facts]};}
  load(raw){this.entries=Array.isArray(raw?.entries)?raw.entries.slice(-this.maxEntries):[];this.facts=new Map(Array.isArray(raw?.facts)?raw.facts:[]);}
}

export class VerityState{
  constructor(seed=1){
    this.version=1;this.seed=Number(seed)||1;this.enabled=true;this.phase=VERITY_PHASES.DORMANT;this.exposure=0;this.bond=15;this.resentment=0;this.dependency=5;this.curiosity=10;this.fear=0;this.corruption=0;
    this.box={spawned:false,opened:false,x:0,y:0,z:0};
    this.verity={active:false,visible:true,x:0,y:0,z:0,vx:0,vy:0,vz:0,follow:true,lastSeenAt:0};
    this.demon={active:false,visible:false,x:0,y:0,z:0,health:160,maxHealth:160,repelled:0,lastAttackAt:0,frozenByGaze:false};
    this.eastVillage={generated:false,x:0,z:0,towerX:0,towerZ:0,shrineX:0,shrineZ:0,visited:false};
    this.director={lastEventAt:0,nextEventIn:45,eventCounts:{},recent:[]};
    this.flags={introSeen:false,lanternGifted:false,eastHinted:false,firstWhisper:false,firstBlackout:false,demonRevealed:false,finalChoice:false,networkBound:false};
    this.metrics={secondsTogether:0,secondsFar:0,conversations:0,questions:0,insults:0,praises:0,abandons:0,deathsWitnessed:0,blocksChangedNearVerity:0};
    this.ending=null;this.boundPlayer=null;this.lastWorldId=null;this.createdAt=Date.now();this.updatedAt=Date.now();this.memory=new VerityMemory();
  }
  phaseName(){return VERITY_PHASE_NAMES[this.phase]||'unknown';}
  apply(action,amount=1,meta={}){
    const n=Math.max(0,Number(amount)||0);switch(action){
      case'praise':this.bond+=3*n;this.resentment-=1*n;this.metrics.praises+=n;break;
      case'insult':this.resentment+=4*n;this.bond-=2*n;this.metrics.insults+=n;break;
      case'ask':this.curiosity+=.8*n;this.dependency+=.4*n;this.metrics.questions+=n;break;
      case'talk':this.bond+=.25*n;this.dependency+=.2*n;this.metrics.conversations+=n;break;
      case'abandon':this.resentment+=2.2*n;this.dependency+=1.5*n;this.metrics.abandons+=n;break;
      case'help':this.bond+=2*n;this.resentment-=.5*n;break;
      case'hit':this.resentment+=8*n;this.fear+=5*n;this.bond-=6*n;break;
      case'investigate':this.curiosity+=2*n;this.corruption+=1.2*n;break;
      case'die':this.fear+=4*n;this.dependency+=2*n;this.metrics.deathsWitnessed+=n;break;
      case'repel':this.fear+=3*n;this.resentment+=1*n;this.demon.repelled+=n;break;
    }
    this.bond=clamp(this.bond,0,100);this.resentment=clamp(this.resentment,0,100);this.dependency=clamp(this.dependency,0,100);this.curiosity=clamp(this.curiosity,0,100);this.fear=clamp(this.fear,0,100);this.corruption=clamp(this.corruption,0,100);this.updatedAt=Date.now();
    if(meta?.text)this.memory.remember(action,meta.text,Math.max(.5,n),meta);
  }
  tick(dt,{distance=0,near=true}={}){
    if(!this.box.opened||this.ending)return;
    const seconds=Math.max(0,Number(dt)||0);this.exposure+=seconds*(1+this.resentment*.0025+this.corruption*.002);
    if(near){this.metrics.secondsTogether+=seconds;this.bond=clamp(this.bond+seconds*.002,0,100);}else{this.metrics.secondsFar+=seconds;if(distance>35)this.dependency=clamp(this.dependency+seconds*.003,0,100);}
    this.corruption=clamp(this.corruption+seconds*(this.phase>=VERITY_PHASES.UNCANNY?.0025:.00035),0,100);
    this.updatedAt=Date.now();this.evaluatePhase();
  }
  evaluatePhase(){if(this.ending){this.phase=VERITY_PHASES.AFTERMATH;return this.phase;}const pressure=this.exposure+this.resentment*3+this.curiosity*1.2+this.corruption*2;let next=this.phase;if(this.phase===VERITY_PHASES.DORMANT&&this.box.opened)next=VERITY_PHASES.FRIEND;if(this.phase===VERITY_PHASES.FRIEND&&pressure>=360)next=VERITY_PHASES.ATTACHED;if(this.phase===VERITY_PHASES.ATTACHED&&pressure>=900)next=VERITY_PHASES.UNCANNY;if(this.phase===VERITY_PHASES.UNCANNY&&pressure>=1680)next=VERITY_PHASES.STALKING;if(this.phase===VERITY_PHASES.STALKING&&pressure>=2700)next=VERITY_PHASES.DEMON;if(next!==this.phase){const before=this.phase;this.phase=next;this.memory.remember('phase',`${VERITY_PHASE_NAMES[before]} -> ${VERITY_PHASE_NAMES[next]}`,4,{from:before,to:next});}return this.phase;}
  forcePhase(nameOrNumber){const value=typeof nameOrNumber==='number'?nameOrNumber:VERITY_PHASE_NAMES.indexOf(String(nameOrNumber).toLowerCase());if(value<0||value>VERITY_PHASES.AFTERMATH)return false;this.phase=value;if(value>=VERITY_PHASES.DEMON){this.demon.active=true;this.demon.visible=true;}return true;}
  finish(ending){if(this.ending)return false;this.ending=String(ending);this.phase=VERITY_PHASES.AFTERMATH;this.demon.active=false;this.demon.visible=false;this.memory.remember('ending',this.ending,10);return true;}
  serialize(){return{version:this.version,seed:this.seed,enabled:this.enabled,phase:this.phase,exposure:this.exposure,bond:this.bond,resentment:this.resentment,dependency:this.dependency,curiosity:this.curiosity,fear:this.fear,corruption:this.corruption,box:this.box,verity:this.verity,demon:this.demon,eastVillage:this.eastVillage,director:this.director,flags:this.flags,metrics:this.metrics,ending:this.ending,boundPlayer:this.boundPlayer,lastWorldId:this.lastWorldId,createdAt:this.createdAt,updatedAt:this.updatedAt,memory:this.memory.serialize()};}
  load(raw){if(!raw||typeof raw!=='object')return false;for(const key of['phase','exposure','bond','resentment','dependency','curiosity','fear','corruption','ending','boundPlayer','lastWorldId','createdAt','updatedAt'])if(raw[key]!=null)this[key]=raw[key];for(const key of['box','verity','demon','eastVillage','director','flags','metrics'])if(raw[key]&&typeof raw[key]==='object')this[key]={...this[key],...raw[key]};this.enabled=raw.enabled!==false;this.memory.load(raw.memory);this.evaluatePhase();return true;}
}
function cryptoId(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();return`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}
