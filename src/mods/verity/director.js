import { VERITY_PHASES } from './state.js';
import { corruptPatch, placeVerityMark, distanceToShrine } from './structures.js';
import { VITEM } from './content.js';
import { DEFAULT_VERITY_CONFIG } from './config.js';

export class HorrorDirector{
  constructor(state,{random=Math.random,onEvent=()=>{},config=DEFAULT_VERITY_CONFIG}={}){this.state=state;this.random=random;this.onEvent=onEvent;this.config={...DEFAULT_VERITY_CONFIG,...config};this.clock=0;}
  setConfig(config){this.config={...DEFAULT_VERITY_CONFIG,...config};}
  tick(dt,ctx){if(!this.state.box.opened||this.state.ending)return null;this.clock+=dt;const d=this.state.director;d.nextEventIn-=dt;if(d.nextEventIn>0)return null;const candidates=EVENTS.filter((e)=>this.eligible(e,ctx));if(!candidates.length){d.nextEventIn=20;return null;}const weighted=[];for(const e of candidates)for(let i=0;i<Math.max(1,Math.round(e.weight*this.config.intensity));i++)weighted.push(e);const event=weighted[Math.floor(this.random()*weighted.length)];this.fire(event,ctx);d.lastEventAt=Date.now();d.nextEventIn=this.nextDelay();d.eventCounts[event.id]=(d.eventCounts[event.id]||0)+1;d.recent.push(event.id);if(d.recent.length>6)d.recent.shift();return event.id;}
  eligible(e,ctx){const s=this.state,d=s.director;if(s.phase<e.min||s.phase>(e.max??99))return false;if((d.eventCounts[e.id]||0)>=(e.maxCount??999))return false;if(d.recent.includes(e.id))return false;if(e.worldChange&&this.config.worldCorruption===false)return false;if(e.darkness&&this.config.extremeDarkness===false)return false;if(e.test&&!e.test(ctx,s))return false;return true;}
  fire(event,ctx){const s=this.state,api=ctx.api;switch(event.id){
    case'gift':if(!s.flags.lanternGifted){api.inventory.add(VITEM.VERITY_SHARD,1);s.flags.lanternGifted=true;}break;
    case'east_hint':s.flags.eastHinted=true;s.apply('investigate',1);break;
    case'mark':if(this.config.worldCorruption)placeVerityMark(api.world,Math.floor(ctx.position.x+randOffset(this.random,8,18)),Math.floor(ctx.position.z+randOffset(this.random,8,18)));break;
    case'corruption':if(this.config.worldCorruption)corruptPatch(api.world,Math.floor(ctx.position.x+randOffset(this.random,10,24)),Math.floor(ctx.position.z+randOffset(this.random,10,24)),{radius:2+Math.floor(this.random()*3*this.config.intensity),intensity:(.22+.2*this.random())*this.config.intensity});break;
    case'vanish':s.verity.visible=false;setTimeout(()=>{if(!s.ending){s.verity.visible=true;s.verity.x=ctx.position.x-3;s.verity.z=ctx.position.z-3;}},3500+this.random()*3500);break;
    case'glimpse':s.demon.visible=true;setTimeout(()=>{if(s.phase<VERITY_PHASES.DEMON)s.demon.visible=false;},1300+this.random()*1600);break;
    case'night_lock':if(api.world.dimension==='overworld')api.world.time=.78;break;
    case'blackout':s.flags.firstBlackout=true;break;
    case'whisper':s.flags.firstWhisper=true;break;
    case'shrine_call':if(distanceToShrine(s,ctx.position)<24)s.apply('investigate',2);break;
  }this.onEvent(event,ctx);s.memory.remember('event',event.id,Math.max(1,event.min),{phase:s.phase});}
  nextDelay(){const p=this.state.phase,base=p<=VERITY_PHASES.FRIEND?55:p===VERITY_PHASES.ATTACHED?42:p===VERITY_PHASES.UNCANNY?31:p===VERITY_PHASES.STALKING?22:16;return base*(.72+this.random()*.65)/Math.max(.4,this.config.eventFrequency);}
}

const EVENTS=[
  {id:'gift',min:VERITY_PHASES.FRIEND,max:VERITY_PHASES.ATTACHED,weight:2,maxCount:1},
  {id:'soft_chime',min:VERITY_PHASES.FRIEND,max:VERITY_PHASES.ATTACHED,weight:3},
  {id:'east_hint',min:VERITY_PHASES.ATTACHED,max:VERITY_PHASES.UNCANNY,weight:2,maxCount:1},
  {id:'vanish',min:VERITY_PHASES.ATTACHED,max:VERITY_PHASES.STALKING,weight:2},
  {id:'whisper',min:VERITY_PHASES.UNCANNY,weight:4},
  {id:'blackout',min:VERITY_PHASES.UNCANNY,weight:3,darkness:true},
  {id:'mark',min:VERITY_PHASES.UNCANNY,weight:2,maxCount:8,worldChange:true},
  {id:'wrong_step',min:VERITY_PHASES.UNCANNY,weight:3},
  {id:'fake_chat',min:VERITY_PHASES.UNCANNY,weight:2},
  {id:'glimpse',min:VERITY_PHASES.STALKING,weight:5},
  {id:'corruption',min:VERITY_PHASES.STALKING,weight:3,maxCount:12,worldChange:true},
  {id:'night_lock',min:VERITY_PHASES.STALKING,max:VERITY_PHASES.STALKING,weight:2,maxCount:3,darkness:true,test:(ctx)=>ctx.api.world.dimension==='overworld'},
  {id:'shriek',min:VERITY_PHASES.STALKING,weight:2},
  {id:'shrine_call',min:VERITY_PHASES.STALKING,weight:2,test:(ctx,s)=>s.eastVillage.generated},
  {id:'demon_breath',min:VERITY_PHASES.DEMON,weight:5},
  {id:'blackout',min:VERITY_PHASES.DEMON,weight:5,darkness:true},
  {id:'corruption',min:VERITY_PHASES.DEMON,weight:4,maxCount:20,worldChange:true}
];
function randOffset(random,min,max){const n=min+random()*(max-min);return(random()<.5?-1:1)*n;}
