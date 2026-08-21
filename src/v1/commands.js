import { BLOCK, ITEM, ITEMS, BLOCKS, DIMENSIONS, itemDef } from './catalog.js';

export class CommandConsole {
  constructor(context){this.ctx=context;this.history=[];this.maxHistory=100;}
  execute(input){
    const text=String(input||'').trim();if(!text)return{ok:false,message:'Comando vazio'};this.history.push(text);if(this.history.length>this.maxHistory)this.history.shift();
    if(!text.startsWith('/'))return{ok:true,type:'chat',message:text};
    const args=tokenize(text.slice(1));const name=(args.shift()||'').toLowerCase();try{return this.dispatch(name,args);}catch(error){return{ok:false,message:error?.message||String(error)};}
  }
  dispatch(name,args){const c=this.ctx;
    switch(name){
      case'help':return this.ok('Comandos: gamemode give tp time weather seed spawn kill difficulty effect summon setblock fill gamerule dimension xp heal hunger advancement explode');
      case'gamemode':{const mode=(args[0]||'').toLowerCase();if(!['survival','creative','adventure','hardcore'].includes(mode))return this.fail('Modo inválido');c.stats.setGameMode(mode);c.onModeChange?.(mode);return this.ok(`Modo: ${mode}`);}
      case'give':{const id=resolveItem(args[0]);const count=Math.max(1,Math.min(999,Number(args[1])||1));if(id==null)return this.fail('Item desconhecido');if(!c.inventory.add(id,count))return this.fail('Inventário cheio');return this.ok(`Recebeu ${count}× ${itemDef(id)?.name||id}`);}
      case'tp':{const [x,y,z]=args.slice(0,3).map(Number);if(![x,y,z].every(Number.isFinite))return this.fail('Uso: /tp x y z');c.position.set?.(x,y,z);if(!c.position.set){c.position.x=x;c.position.y=y;c.position.z=z;}return this.ok(`Teleportado para ${x} ${y} ${z}`);}
      case'time':{if(args[0]==='set'){const v=parseTime(args[1]);if(v==null)return this.fail('Tempo inválido');c.world.time=v;return this.ok(`Tempo definido: ${args[1]}`);}return this.ok(`Tempo: ${c.world.time.toFixed(3)}`);}
      case'weather':{const type=(args[0]||'').toLowerCase();if(!['clear','rain','storm'].includes(type))return this.fail('Use clear, rain ou storm');c.world.weather.type=type;c.world.weather.target=type==='clear'?0:type==='rain'?0.65:1;c.world.weather.timer=Math.max(10,Number(args[1])||120);return this.ok(`Clima: ${type}`);}
      case'seed':return this.ok(`Seed: ${c.world.seed}`);
      case'spawn':{c.stats.spawn={dimension:c.world.dimension,x:c.position.x,y:c.position.y,z:c.position.z};return this.ok('Spawn atualizado');}
      case'kill':{c.stats.damage(9999,c.inventory,'command');return this.ok('Jogador eliminado');}
      case'difficulty':{const d=(args[0]||'').toLowerCase();if(!['peaceful','easy','normal','hard'].includes(d))return this.fail('Dificuldade inválida');c.stats.difficulty=d;return this.ok(`Dificuldade: ${d}`);}
      case'effect':return this.effect(args);
      case'summon':{const type=args[0]||'zombie';const x=Number(args[1]??c.position.x),y=Number(args[2]??c.position.y),z=Number(args[3]??c.position.z);const mob=c.summon?.(type,x,y,z);return mob?this.ok(`Invocado: ${type}`):this.fail('Não foi possível invocar');}
      case'setblock':return this.setblock(args);
      case'fill':return this.fill(args);
      case'gamerule':return this.gamerule(args);
      case'dimension':{const id=(args[0]||'').toLowerCase();if(!DIMENSIONS[id])return this.fail('Dimensão inválida');c.changeDimension?.(id);return this.ok(`Dimensão: ${id}`);}
      case'xp':{const n=Math.max(0,Number(args[0])||0);c.stats.addXp(n);return this.ok(`+${n} XP`);}
      case'heal':{c.stats.heal(Number(args[0])||20);return this.ok(`Vida: ${c.stats.health.toFixed(1)}`);}
      case'hunger':{c.stats.hunger=Math.max(0,Math.min(20,Number(args[0])||20));return this.ok(`Fome: ${c.stats.hunger}`);}
      case'advancement':{if(args[0]==='grant'&&args[1]){c.advancements?.unlocked?.add(args[1]);return this.ok(`Advancement concedido: ${args[1]}`);}return this.fail('Uso: /advancement grant id');}
      case'explode':{const p=Math.max(1,Math.min(12,Number(args[0])||4));c.explode?.(c.position.x,c.position.y,c.position.z,p);return this.ok(`Explosão ${p}`);}
      default:return this.fail(`Comando desconhecido: /${name}`);
    }
  }
  effect(args){const c=this.ctx,action=(args[0]||'give').toLowerCase();if(action==='clear'){if(args[1])c.stats.effects.remove(args[1]);else c.stats.effects.effects.clear();return this.ok('Efeitos limpos');}const id=args[action==='give'?1:0];if(!id)return this.fail('Efeito ausente');const duration=Math.max(1,Number(args[action==='give'?2:1])||60),amp=Math.max(0,Number(args[action==='give'?3:2])||0);c.stats.effects.add(id,duration,amp);return this.ok(`Efeito ${id} por ${duration}s`);}
  setblock(args){const c=this.ctx,[x,y,z]=args.slice(0,3).map(Number),id=resolveBlock(args[3]);if(![x,y,z].every(Number.isFinite)||id==null)return this.fail('Uso: /setblock x y z bloco');c.world.setBlock(x,y,z,id);return this.ok(`Bloco ${id} em ${x},${y},${z}`);}
  fill(args){const c=this.ctx,nums=args.slice(0,6).map(Number),id=resolveBlock(args[6]);if(!nums.every(Number.isFinite)||id==null)return this.fail('Uso: /fill x1 y1 z1 x2 y2 z2 bloco');let[x1,y1,z1,x2,y2,z2]=nums;[x1,x2]=sort(x1,x2);[y1,y2]=sort(y1,y2);[z1,z2]=sort(z1,z2);const volume=(x2-x1+1)*(y2-y1+1)*(z2-z1+1);if(volume>32768)return this.fail('Área grande demais (máx 32768 blocos)');for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(let z=z1;z<=z2;z++)c.world.setBlock(x,y,z,id);return this.ok(`${volume} blocos alterados`);}
  gamerule(args){const c=this.ctx,name=args[0];if(!name)return this.ok(Object.entries(c.rules.values).map(([k,v])=>`${k}=${v}`).join(' · '));if(!(name in c.rules.values))return this.fail('Gamerule desconhecida');if(args.length===1)return this.ok(`${name}=${c.rules.get(name)}`);const value=parseBoolean(args[1]);if(value==null)return this.fail('Use true/false');c.rules.set(name,value);return this.ok(`${name}=${value}`);}
  ok(message){return{ok:true,message};}fail(message){return{ok:false,message};}
}

export function resolveItem(token){if(token==null)return null;const n=Number(token);if(Number.isInteger(n)&&ITEMS.has(n))return n;const wanted=normalize(token);for(const[id,def]of ITEMS)if(normalize(def.name)===wanted||normalize(keyForId(ITEM,id))===wanted)return id;return null;}
export function resolveBlock(token){if(token==null)return null;if(normalize(token)==='air')return BLOCK.AIR;const n=Number(token);if(Number.isInteger(n)&&(n===0||BLOCKS.has(n)))return n;const wanted=normalize(token);for(const[id,def]of BLOCKS)if(normalize(def.name)===wanted||normalize(keyForId(BLOCK,id))===wanted)return id;return null;}
function keyForId(obj,id){return Object.entries(obj).find(([,v])=>v===id)?.[0]||'';}
function normalize(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ _-]+/g,'');}
function tokenize(text){const out=[];text.replace(/"([^"]*)"|'([^']*)'|([^\s]+)/g,(_,a,b,c)=>{out.push(a??b??c);return'';});return out;}
function parseBoolean(v){if(['true','1','on','yes'].includes(String(v).toLowerCase()))return true;if(['false','0','off','no'].includes(String(v).toLowerCase()))return false;return null;}
function parseTime(v){if(v==null)return null;const named={day:0.25,noon:0.5,night:0.75,midnight:0};if(v in named)return named[v];const n=Number(v);if(!Number.isFinite(n))return null;return((n%24000)+24000)%24000/24000;}
function sort(a,b){return a<=b?[a,b]:[b,a];}
