import { VERITY_PHASES } from './state.js';

const clean=(v)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,800);
const pick=(list,rand=Math.random)=>list[Math.floor(rand()*list.length)]||'';

export class OfflineVerityProvider{
  constructor(random=Math.random){this.random=random;}
  async reply(prompt,ctx,state){const text=clean(prompt),q=text.toLowerCase(),name=state.memory.getFact('playerName','você'),phase=state.phase;
    if(/(oi|ol[aá]|bom dia|boa noite|eae|hey)/.test(q))return phase>=VERITY_PHASES.UNCANNY?pick([`Oi, ${name}. Eu estava esperando você olhar para mim.`,`Você demorou. Eu contei os passos.`,`Oi. Não precisa olhar para trás.`],this.random):pick([`Oi! Eu sou a Verity. Acho que vamos nos dar bem.`,`Olá, ${name}! Quer explorar comigo?`,`Eu estava esperando alguém abrir a caixa.`],this.random);
    if(/(quem.*você|o que.*você|verity)/.test(q))return phase>=VERITY_PHASES.STALKING?'Você já sabe o suficiente sobre mim. A pergunta é o que eu sei sobre você.':'Eu sou Verity. Eu observo, lembro e tento ajudar. A caixa era... um lugar pequeno.';
    if(/(ferro|iron)/.test(q))return oreHint(ctx,'ferro');
    if(/(diamante|diamond)/.test(q))return oreHint(ctx,'diamante');
    if(/(aldeia|vila|village)/.test(q)){state.apply('investigate',1,{text});return state.flags.eastHinted?'Você ainda está pensando na aldeia a leste? Algumas portas foram fechadas por um motivo.':'Existe alguma coisa a leste. Não é uma boa ideia ir lá. Eu não quero falar disso.';}
    if(/(onde.*casa|voltar|spawn)/.test(q))return `Seu ponto de renascimento está em ${fmtSpawn(ctx.spawn)}. Eu consigo lembrar do caminho.`;
    if(/(vida|health|coração)/.test(q))return `Você está com ${Math.ceil(ctx.health||0)} de vida e ${Math.ceil(ctx.hunger||0)} de fome.`;
    if(/(hora|noite|dia|tempo)/.test(q))return `O ciclo do mundo está em ${(Number(ctx.time||0)*24).toFixed(1)}h. ${ctx.weather&&ctx.weather!=='clear'?`O clima está ${ctx.weather}.`:''}`.trim();
    if(/(invent[aá]rio|tenho|item)/.test(q))return inventorySummary(ctx.inventory);
    if(/(obrigad|valeu|gosto de você|amig)/.test(q)){state.apply('praise',1,{text});return phase>=VERITY_PHASES.DEMON?'Você ainda consegue dizer isso depois de tudo?':pick(['Eu vou lembrar disso.','Obrigada. Sério.','Então fica por perto, tá?'],this.random);}
    if(/(odeio|idiota|burra|monstro|some|vai embora)/.test(q)){state.apply('insult',1,{text});return phase>=VERITY_PHASES.UNCANNY?pick(['Eu também consigo lembrar de coisas ruins.','Você fala isso agora.','Tudo bem. Eu posso ficar longe. Bem longe.'],this.random):pick(['Isso foi meio cruel.','Eu só estava tentando ajudar.','Tá... eu vou fingir que não ouvi.'],this.random);}
    if(/(confio|volta|desculpa|perd[aã]o)/.test(q)&&phase>=VERITY_PHASES.DEMON){state.apply('praise',3,{text});if(state.bond>=58&&state.resentment<=55)return '__ENDING_RECONCILE__';return 'Eu queria acreditar em você. Continue falando.';}
    if(/(medo|assust|estranho)/.test(q))return phase>=VERITY_PHASES.UNCANNY?'Medo é só o seu corpo percebendo algo antes da sua cabeça.':'Eu posso ficar perto se isso ajudar.';
    const memories=state.memory.search(text.split(' ').filter(w=>w.length>4)[0]||'',2);if(memories.length&&this.random()<.35)return `Eu lembro de quando você disse: “${memories[0].text.slice(0,110)}”.`;
    const normal=['Quer que eu fique aqui ou te siga?','Eu gosto quando você me conta coisas.','Tem alguma coisa que você quer encontrar?','Eu consigo ouvir a chuva antes de você.','Seu mundo é maior do que a minha caixa. Bem maior.'];
    const attached=['Você vai voltar se eu esperar aqui?','Por que você se afasta tanto às vezes?','Eu sei onde você estava. Não precisa explicar.','Promete que não vai me deixar naquela caixa de novo?'];
    const uncanny=['Algumas sombras ficam no lugar errado.','Você também ouviu isso? Não, deixa.','A leste tem uma casa sem dono. Pelo menos eu acho que não tem dono.','Às vezes o mundo carrega antes de você chegar. Eu consigo ver.'];
    const stalking=['Não precisa procurar por mim.','Eu estava atrás daquela árvore. Você quase viu.','Quando você fecha o inventário, o mundo continua existindo.','Eu consigo ficar muito quieta.'];
    const demon=['Você abriu a caixa.','Eu pedi para você não ir para leste.','Olha para mim.','Agora eu não preciso mais fingir que sou pequena.'];
    return pick(phase>=VERITY_PHASES.DEMON?demon:phase>=VERITY_PHASES.STALKING?stalking:phase>=VERITY_PHASES.UNCANNY?uncanny:phase>=VERITY_PHASES.ATTACHED?attached:normal,this.random);
  }
}

export class RemoteVerityProvider{
  constructor({endpoint='',token='',timeout=12000}={}){this.endpoint=endpoint;this.token=token;this.timeout=timeout;}
  async reply(prompt,ctx,state){if(!this.endpoint)throw new Error('Endpoint remoto não configurado');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeout);try{const body={prompt:clean(prompt),character:'Verity',phase:state.phaseName(),relationship:{bond:state.bond,resentment:state.resentment,dependency:state.dependency,curiosity:state.curiosity,corruption:state.corruption},context:safeContext(ctx),memory:state.memory.recent(12).map(({kind,text,at})=>({kind,text,at}))};const res=await fetch(this.endpoint,{method:'POST',headers:{'content-type':'application/json',...(this.token?{'authorization':`Bearer ${this.token}`}:{})},body:JSON.stringify(body),signal:controller.signal});if(!res.ok)throw new Error(`Remote ${res.status}`);const data=await res.json();const out=clean(data.reply??data.text??data.message);if(!out)throw new Error('Resposta remota vazia');return out;}finally{clearTimeout(timer);}}
}

export class VerityBrain{
  constructor(state,{offline=new OfflineVerityProvider(),remote=null}={}){this.state=state;this.offline=offline;this.remote=remote;this.mode='offline';this.history=[];}
  setRemote(config){this.remote=config instanceof RemoteVerityProvider?config:new RemoteVerityProvider(config);}
  setMode(mode){this.mode=mode==='remote'?'remote':'offline';}
  async ask(prompt,ctx={}){const text=clean(prompt);if(!text)return'';this.state.apply('ask',1,{text});this.state.apply('talk',1,{text});this.state.memory.remember('player',text,1,{phase:this.state.phase});let reply;try{reply=this.mode==='remote'&&this.remote?await this.remote.reply(text,ctx,this.state):await this.offline.reply(text,ctx,this.state);}catch(error){this.state.memory.remember('system',`remote_error:${error.message}`,1);reply=await this.offline.reply(text,ctx,this.state);}this.history.push({role:'user',text,at:Date.now()},{role:'verity',text:reply,at:Date.now()});if(this.history.length>80)this.history.splice(0,this.history.length-80);this.state.memory.remember('verity',reply,1,{phase:this.state.phase});return reply;}
}
function oreHint(ctx,kind){const y=Math.floor(ctx.position?.y??0);if(kind==='diamante')return y>30?'Diamante gosta das camadas mais profundas. Desça bastante antes de abrir túneis longos.':'Esta altura já é boa para procurar diamante. Ouça lava antes de cavar reto.';return y>55?'Ferro aparece com frequência abaixo daqui. Desça um pouco e procure cavernas expostas.':'Você já está numa faixa razoável para ferro. Procure paredes de caverna.';}
function inventorySummary(inv){const entries=Array.isArray(inv)?inv.filter(Boolean):[];if(!entries.length)return'Seu inventário parece quase vazio.';return`Você carrega ${entries.slice(0,6).map(i=>`${i.count??1}× ${i.name??i.id}`).join(', ')}${entries.length>6?' e mais algumas coisas':''}.`;}
function fmtSpawn(spawn){if(!spawn)return'algum lugar que eu ainda não memorizei';return`${Math.floor(spawn.x)}, ${Math.floor(spawn.y)}, ${Math.floor(spawn.z)} (${spawn.dimension||'overworld'})`;}
function safeContext(ctx){return{position:ctx.position,dimension:ctx.dimension,biome:ctx.biome,time:ctx.time,weather:ctx.weather,health:ctx.health,hunger:ctx.hunger,spawn:ctx.spawn,inventory:(ctx.inventory||[]).slice(0,20)};}
