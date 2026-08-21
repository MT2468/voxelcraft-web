import { chromium } from 'playwright';
import fs from 'node:fs/promises';

await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const errors = [];
const failedRequests = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'failed'}`));

try {
  const response = await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  if (!response?.ok()) throw new Error(`HTTP ${response?.status()} loading game`);

  await page.waitForFunction(() => {
    const status = document.querySelector('#status')?.textContent || '';
    return /seed/i.test(status) && !/Preparando|Gerando/i.test(status);
  }, { timeout: 45_000 });

  const state = await page.evaluate(() => {
    const canvas = document.querySelector('#game');
    const menu = document.querySelector('#menu');
    const hotbar = document.querySelector('#hotbar');
    const survivalHud = document.querySelector('#survivalHud');
    return {
      title: document.title,
      status: document.querySelector('#status')?.textContent || '',
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      menuVisible: Boolean(menu?.classList.contains('visible')),
      hotbarSlots: hotbar?.children.length || 0,
      hasSurvivalHud: Boolean(survivalHud),
      hasWebGL: Boolean(canvas?.getContext('webgl2') || canvas?.getContext('webgl')),
      hasSeedInput: Boolean(document.querySelector('#seedInput')),
      hasExport: Boolean(document.querySelector('#exportSaveButton')),
      hasImport: Boolean(document.querySelector('#importSaveButton')),
      hasVolume: Boolean(document.querySelector('#volumeSlider')),
      muteLabel: document.querySelector('#muteButton')?.textContent || ''
    };
  });

  if (!state.title.includes('VoxelCraft')) throw new Error(`Unexpected title: ${state.title}`);
  if (!state.canvasWidth || !state.canvasHeight) throw new Error('WebGL canvas has zero dimensions');
  if (!state.menuVisible) throw new Error('Initial menu is not visible');
  if (state.hotbarSlots !== 9) throw new Error(`Expected 9 hotbar slots, got ${state.hotbarSlots}`);
  if (!state.hasSurvivalHud) throw new Error('Survival HUD was not created');
  if (!state.hasWebGL) throw new Error('No WebGL context available');
  if (!state.hasSeedInput || !state.hasExport || !state.hasImport || !state.hasVolume || !/Som:/.test(state.muteLabel)) {
    throw new Error(`World tools incomplete: ${JSON.stringify(state)}`);
  }

  await page.screenshot({ path: 'artifacts/menu.png', fullPage: true });
  const before = state.status;
  await page.click('#newWorldButton');
  await page.waitForFunction((oldStatus) => {
    const text = document.querySelector('#status')?.textContent || '';
    return text !== oldStatus && /Novo mundo|seed/i.test(text);
  }, before, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/new-world.png', fullPage: true });

  const oldMuteText = await page.locator('#muteButton').textContent();
  await page.click('#muteButton');
  const newMuteText = await page.locator('#muteButton').textContent();
  if (oldMuteText === newMuteText) throw new Error('Mute button did not toggle');
  await page.click('#muteButton');

  const downloadPromise = page.waitForEvent('download', { timeout: 8_000 });
  await page.click('#exportSaveButton');
  const download = await downloadPromise;
  if (!/^voxelcraft-seed-.*\.json$/i.test(download.suggestedFilename())) {
    throw new Error(`Unexpected backup filename: ${download.suggestedFilename()}`);
  }
  await download.saveAs('artifacts/exported-world.json');
  const exported = JSON.parse(await fs.readFile('artifacts/exported-world.json', 'utf8'));
  if (exported.version !== 4 || !Number.isInteger(exported.seed)) throw new Error('Exported backup is not a v4 world');

  await page.click('#playButton');
  await page.waitForFunction(() => {
    const menu = document.querySelector('#menu');
    const hud = document.querySelector('#hud');
    return !menu?.classList.contains('visible') && !hud?.classList.contains('hidden');
  }, { timeout: 8_000 });
  await page.waitForTimeout(500);

  const gameplayState = await page.evaluate(() => ({
    menuVisible: document.querySelector('#menu')?.classList.contains('visible') ?? true,
    hudHidden: document.querySelector('#hud')?.classList.contains('hidden') ?? true,
    hearts: document.querySelector('#survivalHud .hearts')?.textContent || '',
    hunger: document.querySelector('#survivalHud .hunger')?.textContent || '',
    stats: document.querySelector('#stats')?.textContent || '',
    pointerLocked: document.pointerLockElement?.id === 'game'
  }));
  if (gameplayState.menuVisible || gameplayState.hudHidden) throw new Error('Gameplay HUD did not activate');
  if (gameplayState.hearts.length < 10 || gameplayState.hunger.length < 10) throw new Error('Survival bars are incomplete');
  if (!/XYZ|FPS/.test(gameplayState.stats)) throw new Error(`Stats did not update: ${gameplayState.stats}`);
  await page.screenshot({ path: 'artifacts/gameplay.png', fullPage: true });

  if (gameplayState.pointerLocked) {
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => document.querySelector('#inventory')?.classList.contains('visible'), { timeout: 5_000 });
    const inventoryState = await page.evaluate(() => ({
      visible: document.querySelector('#inventory')?.classList.contains('visible') ?? false,
      recipes: document.querySelectorAll('.recipe').length,
      sections: document.querySelectorAll('.inventory-section').length
    }));
    if (!inventoryState.visible || inventoryState.recipes < 10 || inventoryState.sections < 2) {
      throw new Error(`Inventory/crafting failed: ${JSON.stringify(inventoryState)}`);
    }
    await page.screenshot({ path: 'artifacts/inventory.png', fullPage: true });
  }

  const saveState = await page.evaluate(() => {
    const raw = localStorage.getItem('voxelcraft-web-save-v4');
    if (!raw) return null;
    const save = JSON.parse(raw);
    return {
      version: save.version,
      seed: save.seed,
      hasInventory: Boolean(save.inventory),
      hasSurvival: Boolean(save.survival),
      hasEdits: Array.isArray(save.edits),
      hasMobs: Array.isArray(save.mobs)
    };
  });
  if (!saveState || saveState.version !== 4 || !saveState.hasInventory || !saveState.hasSurvival || !saveState.hasEdits || !saveState.hasMobs) {
    throw new Error(`Invalid v4 save: ${JSON.stringify(saveState)}`);
  }

  if (failedRequests.length) {
    const critical = failedRequests.filter((entry) => /three|game-v4|survival|mobs|noise|audio|menu-tools/i.test(entry));
    if (critical.length) errors.push(...critical.map((entry) => `request: ${entry}`));
  }
  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);

  console.log(JSON.stringify({ ok: true, ...state, gameplayState, saveState, exportedSeed: exported.seed, failedRequests: failedRequests.length }, null, 2));
} finally {
  await browser.close();
}
