import { ITEM, itemDef } from './catalog.js';
import { AITEM } from './advanced-content.js';
import { TradeSystem, FishingSystem, BrewingSystem, ExplorationMap, PlayerStatistics, nearTradingPost, nearestGeneratedStructure, BREWS } from './content-systems.js';

const waitForApi=()=>new Promise((resolve)=>{
  if(window.VoxelCraftV1)return resolve(window.VoxelCraftV1);
  const timer=setInterval(()=>{if(window.VoxelCraftV1){clearInterval(timer);resolve(window.VoxelCraftV1);}},50);
  setTimeout(()=>{clearInterval(timer);resolve(null);},90_000);
});

const api=await waitForApi();
if(api){
  const trade=new TradeSystem(),fishing=new FishingSystem(),brewing=new BrewingSystem(),map=new ExplorationMap(),statistics=new PlayerStatistics();
  const root=document.createElement('section');
  root.id='fieldGuide';root.className='field-guide';
  root.innerHTML='<header><strong>Guia de Campo</strong><button id="fieldGuideClose">×</button></header><nav><button data-tab="map">Mapa</button><button data-tab="trade">Comércio</button><button data-tab="fish">Pesca</button><button data-tab="brew">Alquimia</button><button data-tab="stats">Estatísticas</button></nav><div id="fieldGuideBody"></div>';
  document.body.appendChild(root);
  const button=document.createElement('button');button.id='fieldGuideButton';button.className='field-guide-button';button.textContent='G · Guia';document.body.appendChild(button);
  const body=root.querySelector('#fieldGuideBody');let tab='map',last=performance.now(),saveTimer=0,lastState=api.state();

  button.addEventListener('click',toggle);
  root.querySelector('#fieldGuideClose').addEventListener('click',()=>root.classList.remove('visible'));
  root.querySelectorAll('[data-tab]').forEach((b)=>b.addEventListener('click',()=>{tab=b.dataset.tab;render();}));
  addEventListener('keydown',(e)=>{if(e.code==='KeyG'&&!e.repeat&&!isTyping()){e.preventDefault();toggle();}});
  restore();
  const off=api.world.onChange?.((event)=>{if(event.type==='block'){if(event.id===0)statistics.add('blocksMined');else statistics.add('blocksPlaced');}});
  const timer=setInterval(tick,100);
  window.addEventListener('beforeunload',()=>{persist();clearInterval(timer);off?.();});
  api.addons={trade,fishing,brewing,map,statistics,openGuide:()=>{root.classList.add('visible');render();},closeGuide:()=>root.classList.remove('visible')};

  function tick(){
    const now=performance.now(),dt=Math.min(1,(now-last)/1000);last=now;
    const state=api.state();statistics.tick(dt);map.visit(api.world,state.player[0],state.player[2]);
    const distance=Math.hypot(state.player[0]-lastState.player[0],state.player[2]-lastState.player[2]);statistics.add('distanceWalked',distance);
    if(state.dimension!==lastState.dimension)statistics.visitDimension(state.dimension);
    lastState=state;
    const fishEvent=fishing.tick(dt);
    if(fishEvent?.type==='bite')notify('🎣 Algo mordeu! Abra o Guia e recolha.');
    if(fishEvent?.type==='escaped')notify('O peixe escapou.');
    const brewed=brewing.tick(dt,api.inventory);
    if(brewed){notify(`⚗ ${brewed.name} pronta!`);render();}
    saveTimer+=dt;if(saveTimer>10){saveTimer=0;persist();}
    if(root.classList.contains('visible')&&tab==='map')renderMapLive();
  }

  function toggle(){root.classList.toggle('visible');if(root.classList.contains('visible'))render();}
  function render(){body.innerHTML='';if(tab==='map')renderMap();else if(tab==='trade')renderTrade();else if(tab==='fish')renderFishing();else if(tab==='brew')renderBrewing();else renderStats();}

  function renderMap(){const wrap=document.createElement('div');wrap.innerHTML='<p>Mapa baseado nos chunks que você realmente visitou.</p><canvas id="explorationMap" width="420" height="300"></canvas><div id="mapInfo"></div>';body.appendChild(wrap);renderMapLive();}
  function renderMapLive(){
    const canvas=root.querySelector('#explorationMap');if(!canvas)return;
    const ctx=canvas.getContext('2d'),dimension=api.world.dimension,bounds=map.bounds(dimension);
    ctx.fillStyle='#0b1016';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(!bounds){ctx.fillStyle='#fff';ctx.fillText('Explore para revelar o mapa',20,30);return;}
    const sx=canvas.width/Math.max(1,bounds.maxX-bounds.minX+1),sz=canvas.height/Math.max(1,bounds.maxZ-bounds.minZ+1);
    for(const p of map.discovered.values()){if(p.dimension!==dimension)continue;ctx.fillStyle=biomeColor(p.biome);ctx.fillRect((p.cx-bounds.minX)*sx,(p.cz-bounds.minZ)*sz,Math.ceil(sx)+1,Math.ceil(sz)+1);}
    const state=api.state(),pcx=Math.floor(state.player[0]/16),pcz=Math.floor(state.player[2]/16);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc((pcx-bounds.minX+.5)*sx,(pcz-bounds.minZ+.5)*sz,4,0,Math.PI*2);ctx.fill();
    const nearest=nearestGeneratedStructure(api.world,{x:state.player[0],z:state.player[2]},null,2048),info=root.querySelector('#mapInfo');
    if(info)info.textContent=`${dimension} · ${map.discovered.size} chunks descobertos${nearest?` · estrutura mais próxima: ${nearest.type}, ${nearest.distance.toFixed(0)} blocos`:''}`;
  }

  function nearbyVillager(){const [x,y,z]=api.state().player;return api.entities?.nearbyVillager?.({x,y,z},8)||null;}
  function renderTrade(){
    const state=api.state(),villager=nearbyVillager(),nearPost=nearTradingPost(api.world,{x:state.player[0],z:state.player[2]},14),near=Boolean(villager)||nearPost;
    body.innerHTML=`<p>${villager?`Aldeão ${escapeHtml(villager.data?.profession||'comerciante')} pronto para negociar.`:nearPost?'Você está perto de um posto de comércio.':'Encontre uma cabana ou aproxime-se de um aldeão para negociar.'}</p><p>Reputação: ${trade.reputation} · trocas: ${trade.completed}</p>`;
    for(const t of trade.available(api.inventory)){
      const b=document.createElement('button');b.className='guide-action';b.disabled=!near||!t.can;
      b.innerHTML=`<strong>${escapeHtml(t.name)}</strong><small>${t.cost.map(([id,n])=>`${n} ${itemDef(id)?.name}`).join(' + ')} → ${t.out[1]} ${itemDef(t.out[0])?.name}</small>`;
      b.onclick=()=>{if(trade.trade(api.inventory,t.id,api.stats)){statistics.add('trades');if(villager)villager.data.reputation=(villager.data.reputation||0)+1;notify('Troca concluída.');render();}};
      body.appendChild(b);
    }
  }

  function renderFishing(){
    const hasRod=api.inventory.has(AITEM.FISHING_ROD,1);
    body.innerHTML=`<p>Pesca: ${fishing.catches}/${fishing.casts} capturas.</p>${hasRod?'':'<p>Você precisa fabricar uma vara de pesca.</p>'}`;
    const b=document.createElement('button');b.className='guide-action';b.disabled=!hasRod;
    if(!fishing.active){b.textContent='🎣 Lançar linha';b.onclick=()=>{const [x,y,z]=api.state().player,r=fishing.cast(api.world,{x,y,z});notify(r.message);render();};}
    else if(fishing.biteWindow>0){b.textContent='⚡ Recolher agora!';b.onclick=()=>{const r=fishing.reel(api.inventory,api.stats);if(r.ok){statistics.add('fishCaught');damageRod();}notify(r.message);render();};}
    else{b.textContent='Linha na água… recolher cedo';b.onclick=()=>{const r=fishing.reel(api.inventory,api.stats);damageRod();notify(r.message);render();};}
    body.appendChild(b);
  }

  function damageRod(){
    const index=api.inventory.slots.findIndex((stack)=>stack?.id===AITEM.FISHING_ROD);
    if(index<0)return;
    const stack=api.inventory.slots[index],max=itemDef(stack.id)?.durability||64;
    stack.data.durability=(stack.data.durability??max)-1;
    if(stack.data.durability<=0)api.inventory.slots[index]=null;
  }

  function renderBrewing(){
    body.innerHTML=`<p>${brewing.active?`Preparando ${brewing.active.name}: ${brewing.progress.toFixed(1)}/${brewing.active.time}s`:'Escolha uma mistura.'}</p>`;
    for(const r of BREWS){
      const b=document.createElement('button');b.className='guide-action';b.disabled=Boolean(brewing.active)||!r.cost.every(([id,n])=>api.inventory.has(id,n));
      b.innerHTML=`<strong>${escapeHtml(r.name)}</strong><small>${r.cost.map(([id,n])=>`${n} ${itemDef(id)?.name}`).join(' + ')}</small>`;
      b.onclick=()=>{if(brewing.start(api.inventory,r.id)){notify('Alquimia iniciada.');render();}};
      body.appendChild(b);
    }
  }

  function renderStats(){body.innerHTML='<h3>Estatísticas do mundo</h3>';for(const[k,v]of Object.entries(statistics.values)){const p=document.createElement('p');p.textContent=`${label(k)}: ${k==='playSeconds'?formatTime(v):Math.floor(v)}`;body.appendChild(p);}body.insertAdjacentHTML('beforeend',`<p>Reputação comercial: ${trade.reputation}</p><p>Chunks mapeados: ${map.discovered.size}</p>`);}
  function persist(){try{const id=api.state().worldId||'default';localStorage.setItem(`voxelcraft-v1-addons:${id}`,JSON.stringify({trade:trade.serialize(),fishing:fishing.serialize(),brewing:brewing.serialize(),map:map.serialize(),statistics:statistics.serialize()}));}catch{}}
  function restore(){try{const id=api.state().worldId||'default',raw=JSON.parse(localStorage.getItem(`voxelcraft-v1-addons:${id}`)||'null');if(raw){trade.load(raw.trade);fishing.load(raw.fishing);brewing.load(raw.brewing);map.load(raw.map);statistics.load(raw.statistics);}}catch{}}
  function notify(text){const toast=document.querySelector('#toast');if(toast){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800);}}
}

function isTyping(){const t=document.activeElement?.tagName;return t==='INPUT'||t==='TEXTAREA'||t==='SELECT';}
function biomeColor(b){return({plains:'#6ca64a',forest:'#356c36',desert:'#cbb66e',savanna:'#a4a153',swamp:'#526d4d',taiga:'#52735b',tundra:'#dce7e5',mountains:'#777b7e',beach:'#d8c47b',ocean:'#376da4',deep_ocean:'#214c7d',cherry:'#d2859c'}[b]||'#666');}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function label(k){return({blocksMined:'Blocos minerados',blocksPlaced:'Blocos colocados',mobsKilled:'Mobs derrotados',deaths:'Mortes',distanceWalked:'Distância',itemsCrafted:'Itens criados',fishCaught:'Peixes',trades:'Trocas',dimensionsVisited:'Dimensões',playSeconds:'Tempo jogado'}[k]||k);}
function formatTime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60);return`${h}h ${m}m ${sec}s`;}
