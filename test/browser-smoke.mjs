import { chromium } from 'playwright';
import fs from 'node:fs/promises';

await fs.mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1366,height:768},acceptDownloads:true});
const errors=[],failedRequests=[];
page.on('pageerror',(e)=>errors.push(`pageerror: ${e.message}`));
page.on('console',(m)=>{if(m.type()==='error')errors.push(`console: ${m.text()}`);});
page.on('requestfailed',(r)=>failedRequests.push(`${r.url()} :: ${r.failure()?.errorText||'failed'}`));

try{
  const response=await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:30_000});
  if(!response?.ok())throw new Error(`HTTP ${response?.status()} loading game`);
  await page.waitForFunction(()=>Boolean(window.VoxelCraftV1?.state?.().ready),{timeout:60_000});
  await page.waitForFunction(()=>/seed/i.test(document.querySelector('#status')?.textContent||''),{timeout:20_000});

  const initial=await page.evaluate(()=>({
    title:document.title,
    state:window.VoxelCraftV1.state(),
    canvas:[document.querySelector('#game')?.width||0,document.querySelector('#game')?.height||0],
    webgl:Boolean(document.querySelector('#game')?.getContext('webgl2')||document.querySelector('#game')?.getContext('webgl')),
    menu:document.querySelector('#menu')?.classList.contains('visible'),
    hotbar:document.querySelector('#hotbar')?.children.length||0,
    hasWorldSelect:Boolean(document.querySelector('#worldSelect')),
    hasSeed:Boolean(document.querySelector('#seedInput')),
    hasSettings:Boolean(document.querySelector('#settingsPanel')),
    hasMultiplayer:Boolean(document.querySelector('#multiplayerPanel')),
    hasChat:Boolean(document.querySelector('#chatInput')),
    hasSurvival:Boolean(document.querySelector('#survivalHud')),
    hasBoss:Boolean(document.querySelector('#bossBar'))
  }));
  if(!initial.title.includes('VoxelCraft V1'))throw new Error(`Unexpected title ${initial.title}`);
  if(!initial.webgl||!initial.canvas[0]||!initial.canvas[1])throw new Error('WebGL canvas unavailable');
  if(!initial.menu||initial.hotbar!==9)throw new Error(`Initial shell invalid: ${JSON.stringify(initial)}`);
  for(const key of['hasWorldSelect','hasSeed','hasSettings','hasMultiplayer','hasChat','hasSurvival','hasBoss'])if(!initial[key])throw new Error(`Missing V1 UI ${key}`);
  await page.screenshot({path:'artifacts/v1-menu.png',fullPage:true});

  await page.fill('#worldName','CI V1 World');await page.fill('#seedInput','424242');await page.selectOption('#gameModeSelect','survival');await page.selectOption('#difficultySelect','normal');await page.click('#newWorldButton');
  await page.waitForFunction(()=>/424242/.test(document.querySelector('#status')?.textContent||''),{timeout:30_000});
  const created=await page.evaluate(()=>window.VoxelCraftV1.state());
  if(created.dimension!=='overworld')throw new Error('New world did not start in overworld');

  const commandState=await page.evaluate(()=>{
    const api=window.VoxelCraftV1;
    const give=api.command('/give log 8');
    const set=api.command('/setblock 2 40 2 torch');
    return{give,set,count:api.inventory.count(5),block:api.world.getBlock(2,40,2)};
  });
  if(!commandState.give.ok||!commandState.set.ok||commandState.count<8||commandState.block!==17)throw new Error(`V1 commands failed: ${JSON.stringify(commandState)}`);

  await page.click('#settingsButton');
  await page.waitForFunction(()=>document.querySelector('#settingsPanel')?.classList.contains('visible'));
  const settingState=await page.evaluate(()=>({fov:Boolean(document.querySelector('#setFov')),render:Boolean(document.querySelector('#setRender')),volume:Boolean(document.querySelector('#setVolume'))}));
  if(!settingState.fov||!settingState.render||!settingState.volume)throw new Error(`Settings incomplete ${JSON.stringify(settingState)}`);
  await page.click('#settingsButton');

  await page.evaluate(()=>window.VoxelCraftV1.save());
  const downloadPromise=page.waitForEvent('download',{timeout:10_000});await page.click('#exportButton');const download=await downloadPromise;await download.saveAs('artifacts/v1-export.json');
  const exported=JSON.parse(await fs.readFile('artifacts/v1-export.json','utf8'));
  if(exported.format!=='voxelcraft-v1'||exported.payload?.world?.seed!==424242)throw new Error('V1 export invalid');

  await page.click('#playButton');
  await page.waitForFunction(()=>!document.querySelector('#menu')?.classList.contains('visible')&&!document.querySelector('#hud')?.classList.contains('hidden'),{timeout:10_000});
  await page.waitForTimeout(900);
  const gameplay=await page.evaluate(()=>({
    pointerLocked:document.pointerLockElement?.id==='game',
    hearts:document.querySelector('#survivalHud .hearts')?.textContent||'',
    hunger:document.querySelector('#survivalHud .hunger')?.textContent||'',
    xp:document.querySelector('#xpHud')?.textContent||'',
    stats:document.querySelector('#stats')?.textContent||'',
    state:window.VoxelCraftV1.state()
  }));
  if(gameplay.hearts.length<10||gameplay.hunger.length<10||!/Lv/.test(gameplay.xp)||!/XYZ/.test(gameplay.stats))throw new Error(`Gameplay HUD invalid ${JSON.stringify(gameplay)}`);
  await page.screenshot({path:'artifacts/v1-gameplay.png',fullPage:true});

  if(gameplay.pointerLocked){
    await page.keyboard.press('KeyE');await page.waitForFunction(()=>document.querySelector('#inventory')?.classList.contains('visible'),{timeout:6_000});
    const inv=await page.evaluate(()=>({sections:document.querySelectorAll('.inventory-section').length,recipes:document.querySelectorAll('.recipe').length,visible:document.querySelector('#inventory')?.classList.contains('visible')}));
    if(!inv.visible||inv.sections<3||inv.recipes<4)throw new Error(`Inventory V1 invalid ${JSON.stringify(inv)}`);
    await page.screenshot({path:'artifacts/v1-inventory.png',fullPage:true});
  }

  const dimensionTest=await page.evaluate(()=>{const api=window.VoxelCraftV1;api.changeDimension('emberdeep');const a=api.state();api.changeDimension('voidlands');const b=api.state();api.changeDimension('overworld');return{a,b,c:api.state()};});
  if(dimensionTest.a.dimension!=='emberdeep'||dimensionTest.b.dimension!=='voidlands'||dimensionTest.c.dimension!=='overworld')throw new Error(`Dimension switching failed ${JSON.stringify(dimensionTest)}`);

  if(failedRequests.length){const critical=failedRequests.filter((x)=>/three|game-v1|v1\/|audio|noise/i.test(x));if(critical.length)errors.push(...critical.map((x)=>`request: ${x}`));}
  if(errors.length)throw new Error(`Browser errors:\n${errors.join('\n')}`);
  console.log(JSON.stringify({ok:true,initial,created,gameplay,dimensionTest,exportedWorld:exported.payload.meta?.name,failedRequests:failedRequests.length},null,2));
}finally{await browser.close();}
