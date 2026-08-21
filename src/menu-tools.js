import { ITEM } from './survival.js';
import { isMuted, toggleMuted, setMasterVolume } from './audio.js';

const SAVE_KEY = 'voxelcraft-web-save-v4';
const menu = document.querySelector('#menu');
const menuGrid = menu?.querySelector('.menu-grid');
const status = document.querySelector('#status');

if (menu && menuGrid) {
  const tools = document.createElement('section');
  tools.className = 'world-tools';
  tools.innerHTML = `
    <div class="seed-row">
      <input id="seedInput" inputmode="numeric" maxlength="10" placeholder="Seed do mundo" aria-label="Seed do mundo" />
      <button id="seedButton" type="button">Criar com seed</button>
    </div>
    <div class="world-tools-grid">
      <button id="exportSaveButton" type="button">Exportar mundo</button>
      <button id="importSaveButton" type="button">Importar mundo</button>
      <button id="fullscreenButton" type="button">Tela cheia</button>
      <button id="muteButton" type="button"></button>
    </div>
    <label class="volume-row">Volume <input id="volumeSlider" type="range" min="0" max="0.6" step="0.02" value="0.22" /></label>
    <input id="saveFileInput" type="file" accept="application/json,.json" hidden />
  `;
  menuGrid.after(tools);

  const seedInput = tools.querySelector('#seedInput');
  const seedButton = tools.querySelector('#seedButton');
  const exportButton = tools.querySelector('#exportSaveButton');
  const importButton = tools.querySelector('#importSaveButton');
  const fullscreenButton = tools.querySelector('#fullscreenButton');
  const muteButton = tools.querySelector('#muteButton');
  const volumeSlider = tools.querySelector('#volumeSlider');
  const fileInput = tools.querySelector('#saveFileInput');

  const savedVolume = Number(localStorage.getItem('voxelcraft-volume'));
  if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 0.6) {
    volumeSlider.value = String(savedVolume);
    setMasterVolume(savedVolume);
  }

  const updateMuteLabel = () => {
    muteButton.textContent = isMuted() ? 'Som: desligado' : 'Som: ligado';
  };
  updateMuteLabel();

  seedButton.addEventListener('click', () => {
    const seed = normalizeSeed(seedInput.value);
    if (seed == null) {
      flashStatus('Seed inválida. Use um número inteiro entre 1 e 2 bilhões.');
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(blankSave(seed)));
    localStorage.removeItem('voxelcraft-web-save-v3');
    location.reload();
  });

  seedInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') seedButton.click();
  });

  exportButton.addEventListener('click', () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      flashStatus('Ainda não existe um save v4 para exportar.');
      return;
    }
    try {
      const save = JSON.parse(raw);
      validateSave(save);
      const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `voxelcraft-seed-${save.seed}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flashStatus('Backup do mundo exportado.');
    } catch (error) {
      console.warn(error);
      flashStatus('O save atual está corrompido e não foi exportado.');
    }
  });

  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('Arquivo maior que 5 MB');
      const save = JSON.parse(await file.text());
      validateSave(save);
      const key = save.version === 4 ? SAVE_KEY : 'voxelcraft-web-save-v3';
      localStorage.setItem(key, JSON.stringify(save));
      if (save.version === 4) localStorage.removeItem('voxelcraft-web-save-v3');
      location.reload();
    } catch (error) {
      console.warn('Importação de save recusada', error);
      flashStatus('Arquivo recusado: não é um save VoxelCraft válido.');
      fileInput.value = '';
    }
  });

  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen indisponível', error);
      flashStatus('Tela cheia não está disponível neste navegador.');
    }
  });

  document.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia';
  });

  muteButton.addEventListener('click', () => {
    toggleMuted();
    updateMuteLabel();
  });

  volumeSlider.addEventListener('input', () => {
    const value = Number(volumeSlider.value);
    setMasterVolume(value);
    localStorage.setItem('voxelcraft-volume', String(value));
  });

  addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (event.code === 'KeyM' && !event.repeat) {
      toggleMuted();
      updateMuteLabel();
    }
  });
}

function blankSave(seed) {
  return {
    version: 4,
    seed,
    time: 0.28,
    player: [0.5, 20, 0.5],
    rotation: [0, 0, 0],
    flying: false,
    edits: [],
    inventory: {
      counts: [],
      durability: [],
      hotbar: [ITEM.LOG, ITEM.PLANKS, ITEM.COBBLE, ITEM.DIRT, ITEM.SAND, ITEM.WOOD_PICKAXE, ITEM.STONE_PICKAXE, ITEM.WOOD_SWORD, ITEM.RAW_PORK],
      selected: 0
    },
    survival: { health: 20, hunger: 20, saturation: 5, exhaustion: 0 },
    mobs: []
  };
}

function normalizeSeed(value) {
  const numeric = Number(String(value).trim());
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 2_000_000_000) return null;
  return numeric;
}

function validateSave(save) {
  if (!save || ![3, 4].includes(save.version)) throw new Error('Versão incompatível');
  if (!Number.isInteger(save.seed) || save.seed < 1 || save.seed > 2_000_000_000) throw new Error('Seed inválida');
  if (!Array.isArray(save.edits) || save.edits.length > 250_000) throw new Error('Lista de edições inválida');
  if (save.version === 4) {
    if (!save.inventory || !save.survival || !Array.isArray(save.mobs)) throw new Error('Estrutura v4 incompleta');
    if (!Array.isArray(save.player) || save.player.length !== 3 || !save.player.every(Number.isFinite)) throw new Error('Posição inválida');
  }
  return true;
}

function flashStatus(message) {
  if (!status) return;
  const previous = status.textContent;
  status.textContent = message;
  clearTimeout(flashStatus.timer);
  flashStatus.timer = setTimeout(() => {
    if (status.textContent === message) status.textContent = previous;
  }, 2600);
}
