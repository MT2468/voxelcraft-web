import { chromium } from 'playwright';
import fs from 'node:fs/promises';

await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
      hasWebGL: Boolean(canvas?.getContext('webgl2') || canvas?.getContext('webgl'))
    };
  });

  if (!state.title.includes('VoxelCraft')) throw new Error(`Unexpected title: ${state.title}`);
  if (!state.canvasWidth || !state.canvasHeight) throw new Error('WebGL canvas has zero dimensions');
  if (!state.menuVisible) throw new Error('Initial menu is not visible');
  if (state.hotbarSlots !== 9) throw new Error(`Expected 9 hotbar slots, got ${state.hotbarSlots}`);
  if (!state.hasSurvivalHud) throw new Error('Survival HUD was not created');
  if (!state.hasWebGL) throw new Error('No WebGL context available');

  await page.screenshot({ path: 'artifacts/menu.png', fullPage: true });
  const before = state.status;
  await page.click('#newWorldButton');
  await page.waitForFunction((oldStatus) => {
    const text = document.querySelector('#status')?.textContent || '';
    return text !== oldStatus && /Novo mundo|seed/i.test(text);
  }, before, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/new-world.png', fullPage: true });

  if (failedRequests.length) {
    const critical = failedRequests.filter((entry) => /three|game-v4|survival|mobs|noise|audio/i.test(entry));
    if (critical.length) errors.push(...critical.map((entry) => `request: ${entry}`));
  }
  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);

  console.log(JSON.stringify({ ok: true, ...state, failedRequests: failedRequests.length }, null, 2));
} finally {
  await browser.close();
}
