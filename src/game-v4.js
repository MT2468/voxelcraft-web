import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { SeededNoise } from './noise.js';
import { unlockAudio, playBreak, playPlace, playStep, playJump, playLand, playToggleFly } from './audio.js';
import { ITEM, ITEM_DEFS, RECIPES, Inventory, SurvivalState, miningProfile, blockDrop } from './survival.js';
import { MobSystem } from './mobs.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
const menu = $('#menu');
const inventoryPanel = $('#inventory');
const playButton = $('#playButton');
const newWorldButton = $('#newWorldButton');
const saveButton = $('#saveButton');
const closeInventoryButton = $('#closeInventory');
const hud = $('#hud');
const hotbar = $('#hotbar');
const inventoryGrid = $('#inventoryGrid');
const stats = $('#stats');
const status = $('#status');
const toast = $('#toast');

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 48;
const SEA_LEVEL = 10;
const RENDER_RADIUS = 3;
const BUFFER_RADIUS = RENDER_RADIUS + 1;
const REACH = 6;
const ATTACK_REACH = 4.2;
const SAVE_KEY = 'voxelcraft-web-save-v4';
const LEGACY_SAVE_KEY = 'voxelcraft-web-save-v3';
const AUTOSAVE_MS = 20_000;

const BLOCKS = [
  null,
  { id: 1, name: 'Grama', color: 0x6da943, side: 0x80613f, hardness: 0.36, material: 'sand', solid: true },
  { id: 2, name: 'Terra', color: 0x855f3b, hardness: 0.42, material: 'sand', solid: true },
  { id: 3, name: 'Pedra', color: 0x858585, hardness: 1.05, material: 'stone', solid: true, requiredTier: 1 },
  { id: 4, name: 'Areia', color: 0xd8c685, hardness: 0.32, material: 'sand', solid: true },
  { id: 5, name: 'Madeira', color: 0x8c633b, top: 0xb38a59, hardness: 0.72, material: 'wood', solid: true },
  { id: 6, name: 'Folhas', color: 0x3d8439, hardness: 0.18, material: 'leaves', solid: true },
  { id: 7, name: 'Pedregulho', color: 0x6e6e6e, hardness: 1.2, material: 'stone', solid: true, requiredTier: 1 },
  { id: 8, name: 'Tábuas', color: 0xb28754, hardness: 0.62, material: 'wood', solid: true },
  { id: 9, name: 'Neve', color: 0xe8f2f2, side: 0xc7d4d4, hardness: 0.22, material: 'snow', solid: true },
  { id: 10, name: 'Minério de carvão', color: 0x4c4c4c, hardness: 1.32, material: 'stone', solid: true, requiredTier: 1 },
  { id: 11, name: 'Minério de ferro', color: 0xb59b82, hardness: 1.46, material: 'stone', solid: true, requiredTier: 2 },
  { id: 12, name: 'Minério de ouro', color: 0xe1b632, hardness: 1.58, material: 'stone', solid: true, requiredTier: 3 },
  { id: 13, name: 'Minério de diamante', color: 0x55d4d6, hardness: 1.78, material: 'stone', solid: true, requiredTier: 3 },
  { id: 14, name: 'Rocha-base', color: 0x272727, hardness: Infinity, material: 'stone', solid: true },
  { id: 15, name: 'Água', color: 0x3f82d6, hardness: Infinity, material: 'water', solid: false, liquid: true }
];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7eb5e6);
scene.fog = new THREE.Fog(0x7eb5e6, 36, CHUNK_SIZE * (RENDER_RADIUS + 1.5));
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 220);
const controls = new PointerLockControls(camera, renderer.domElement);

const hemi = new THREE.HemisphereLight(0xbfe2ff, 0x4b432f, 1.4);
const sun = new THREE.DirectionalLight(0xfff0c7, 2.2);
sun.position.set(20, 40, 10);
scene.add(hemi, sun);

const solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const waterMaterial = new THREE.MeshLambertMaterial({ color: 0x4d90e6, transparent: true, opacity: 0.62, depthWrite: false });

const chunks = new Map();
const edits = new Map();
let seed = 1;
let noise = new SeededNoise(seed);
let worldTime = 0.28;
let daylightLevel = 1;
let ready = false;
let inventoryOpen = false;
let debugVisible = true;
let flying = false;
let currentChunkX = Infinity;
let currentChunkZ = Infinity;

let inventory = new Inventory();
const survival = new SurvivalState();

const PLAYER = {
  feet: new THREE.Vector3(0.5, 20, 0.5),
  velocity: new THREE.Vector3(),
  halfWidth: 0.3,
  height: 1.8,
  eyeHeight: 1.62,
  onGround: false,
  wasGrounded: false,
  stepDistance: 0,
  fallDistance: 0
};

const keys = new Set();
let jumpQueued = false;
let attackCooldown = 0;

const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const rayDirection = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();
let currentTarget = null;

const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
  new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.9 })
);
outline.visible = false;
outline.renderOrder = 5;
scene.add(outline);

const skyDay = new THREE.Color(0x7eb5e6);
const skyDusk = new THREE.Color(0xa76b69);
const skyNight = new THREE.Color(0x09111f);
const skyCurrent = new THREE.Color();

const clouds = new THREE.Group();
scene.add(clouds);
const particleGroup = new THREE.Group();
const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const particles = [];
scene.add(particleGroup);

const miningBar = document.createElement('div');
miningBar.id = 'miningBar';
miningBar.innerHTML = '<span></span>';
hud.appendChild(miningBar);
const miningFill = miningBar.firstElementChild;

const modeBadge = document.createElement('div');
modeBadge.id = 'modeBadge';
modeBadge.textContent = 'SOBREVIVÊNCIA';
hud.appendChild(modeBadge);

const survivalHud = document.createElement('div');
survivalHud.id = 'survivalHud';
hud.appendChild(survivalHud);

const damageFlash = document.createElement('div');
damageFlash.id = 'damageFlash';
document.body.appendChild(damageFlash);

let mining = false;
let miningKey = '';
let miningProgress = 0;

const FACES = [
  { dir: [1, 0, 0], shade: 0.83, corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { dir: [-1, 0, 0], shade: 0.72, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { dir: [0, -1, 0], shade: 0.55, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { dir: [0, 0, 1], shade: 0.9, corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { dir: [0, 0, -1], shade: 0.77, corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }
];

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();
const proposed = new THREE.Vector3();

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function floorDiv(value, divisor) {
  return Math.floor(value / divisor);
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function blockIndex(lx, y, lz) {
  return y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
}

function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

function inHeight(y) {
  return y >= 0 && y < WORLD_HEIGHT;
}

function isSolid(id) {
  return Boolean(id && BLOCKS[id]?.solid !== false);
}

function terrainHeight(x, z) {
  const continental = noise.fbm2(x, z, 0.011, 5, 9);
  const broad = noise.fbm2(x, z, 0.029, 4, 11);
  const detail = noise.value2(x, z, 0.11, 37);
  const ridge = Math.abs(noise.value2(x, z, 0.017, 71) - 0.5) * 2;
  const mountain = Math.max(0, noise.fbm2(x + 900, z - 500, 0.007, 4, 88) - 0.55) * 16;
  return Math.max(4, Math.min(WORLD_HEIGHT - 8, Math.floor(5 + continental * 6 + broad * 8 + detail * 2.5 + ridge * 2 + mountain)));
}

function biomeAt(x, z) {
  const temperature = noise.value2(x + 700, z - 400, 0.008, 97);
  const moisture = noise.value2(x - 380, z + 620, 0.009, 101);
  if (temperature > 0.69 && moisture < 0.58) return 'desert';
  if (temperature < 0.25) return 'snow';
  return moisture > 0.73 ? 'forest' : 'plains';
}

function caveAt(x, y, z, surface) {
  if (y <= 1 || y >= surface - 3) return false;
  const primary = noise.value3(x, y, z, 0.085, 701);
  const tunnel = noise.value3(x + 200, y * 0.7, z - 140, 0.052, 703);
  const depthBias = THREE.MathUtils.clamp((surface - y) / 18, 0, 1);
  return primary > 0.675 - depthBias * 0.045 && tunnel > 0.485;
}

function oreFor(x, y, z) {
  const roll = noise.hash3(x, y, z, 1301);
  if (y <= 8 && roll > 0.989) return ITEM.DIAMOND_ORE;
  if (y <= 13 && roll > 0.978) return ITEM.GOLD_ORE;
  if (y <= 24 && roll > 0.952) return ITEM.IRON_ORE;
  if (y <= 34 && roll > 0.925) return ITEM.COAL_ORE;
  return ITEM.STONE;
}

function generateChunkData(cx, cz) {
  const blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const x = startX + lx;
      const z = startZ + lz;
      const surface = terrainHeight(x, z);
      const biome = biomeAt(x, z);
      for (let y = 0; y <= surface; y++) {
        let id;
        if (y === 0) id = ITEM.BEDROCK;
        else if (caveAt(x, y, z, surface)) id = 0;
        else if (y === surface) {
          if (biome === 'desert') id = ITEM.SAND;
          else if (biome === 'snow') id = ITEM.SNOW;
          else id = ITEM.GRASS;
        } else if (y >= surface - 3) {
          id = biome === 'desert' ? ITEM.SAND : ITEM.DIRT;
        } else {
          id = oreFor(x, y, z);
        }
        if (id) blocks[blockIndex(lx, y, lz)] = id;
      }
      if (surface < SEA_LEVEL) {
        for (let y = surface + 1; y <= SEA_LEVEL; y++) blocks[blockIndex(lx, y, lz)] = ITEM.WATER;
      }
    }
  }

  generateTreesIntoChunk(cx, cz, blocks);
  generateStructuresIntoChunk(cx, cz, blocks);
  applyEditsToChunk(cx, cz, blocks);
  return { cx, cz, blocks, solidMesh: null, waterMesh: null };
}

function writeIntoChunk(blocks, cx, cz, x, y, z, id, onlyIfAir = false) {
  if (!inHeight(y)) return;
  const lx = x - cx * CHUNK_SIZE;
  const lz = z - cz * CHUNK_SIZE;
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
  const index = blockIndex(lx, y, lz);
  if (onlyIfAir && blocks[index] !== 0 && blocks[index] !== ITEM.WATER) return;
  blocks[index] = id;
}

function generateTreesIntoChunk(cx, cz, blocks) {
  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;
  for (let x = startX - 2; x < startX + CHUNK_SIZE + 2; x++) {
    for (let z = startZ - 2; z < startZ + CHUNK_SIZE + 2; z++) {
      const biome = biomeAt(x, z);
      if (!['plains', 'forest'].includes(biome)) continue;
      const threshold = biome === 'forest' ? 0.968 : 0.989;
      if (noise.hash2(x, z, 123) < threshold) continue;
      const y = terrainHeight(x, z) + 1;
      if (y <= SEA_LEVEL + 1) continue;
      const trunk = 3 + Math.floor(noise.hash2(x, z, 321) * 3);
      for (let t = 0; t < trunk; t++) writeIntoChunk(blocks, cx, cz, x, y + t, z, ITEM.LOG, true);
      const canopyY = y + trunk - 1;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dy = -1; dy <= 2; dy++) {
            const distance = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - 1);
            if (distance > 4) continue;
            writeIntoChunk(blocks, cx, cz, x + dx, canopyY + dy, z + dz, ITEM.LEAVES, true);
          }
        }
      }
    }
  }
}

function generateStructuresIntoChunk(cx, cz, blocks) {
  const minX = cx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;
  const maxX = minX + CHUNK_SIZE - 1;
  const maxZ = minZ + CHUNK_SIZE - 1;
  const region = 64;
  const minRx = floorDiv(minX - 8, region);
  const maxRx = floorDiv(maxX + 8, region);
  const minRz = floorDiv(minZ - 8, region);
  const maxRz = floorDiv(maxZ + 8, region);

  for (let rx = minRx; rx <= maxRx; rx++) {
    for (let rz = minRz; rz <= maxRz; rz++) {
      if (noise.hash2(rx, rz, 2401) < 0.73) continue;
      const ax = rx * region + 8 + Math.floor(noise.hash2(rx, rz, 2403) * 48);
      const az = rz * region + 8 + Math.floor(noise.hash2(rx, rz, 2405) * 48);
      if (!['plains', 'forest'].includes(biomeAt(ax, az))) continue;
      const baseY = terrainHeight(ax, az) + 1;
      if (baseY <= SEA_LEVEL + 1 || baseY + 5 >= WORLD_HEIGHT) continue;

      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          writeIntoChunk(blocks, cx, cz, ax + dx, baseY - 1, az + dz, ITEM.COBBLE, false);
          const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
          if (edge) {
            for (let dy = 0; dy <= 2; dy++) {
              const door = dz === 3 && dx === 0 && dy < 2;
              if (!door) writeIntoChunk(blocks, cx, cz, ax + dx, baseY + dy, az + dz, ITEM.PLANKS, false);
            }
          }
          if (Math.abs(dx) <= 3 && Math.abs(dz) <= 3) writeIntoChunk(blocks, cx, cz, ax + dx, baseY + 3, az + dz, ITEM.PLANKS, false);
        }
      }
    }
  }
}

function applyEditsToChunk(cx, cz, blocks) {
  const prefix = `${cx},${cz}:`;
  for (const [key, id] of edits) {
    if (!key.startsWith(prefix)) continue;
    const local = key.slice(prefix.length).split(',').map(Number);
    if (local.length !== 3) continue;
    const [lx, y, lz] = local;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || !inHeight(y)) continue;
    blocks[blockIndex(lx, y, lz)] = id;
  }
}

function editKeyFor(x, y, z) {
  const cx = floorDiv(x, CHUNK_SIZE);
  const cz = floorDiv(z, CHUNK_SIZE);
  return `${cx},${cz}:${mod(x, CHUNK_SIZE)},${y},${mod(z, CHUNK_SIZE)}`;
}

function ensureChunkData(cx, cz) {
  const key = chunkKey(cx, cz);
  let chunk = chunks.get(key);
  if (!chunk) {
    chunk = generateChunkData(cx, cz);
    chunks.set(key, chunk);
  }
  return chunk;
}

function getBlock(x, y, z) {
  if (!inHeight(y)) return y < 0 ? ITEM.BEDROCK : 0;
  const cx = floorDiv(x, CHUNK_SIZE);
  const cz = floorDiv(z, CHUNK_SIZE);
  const chunk = chunks.get(chunkKey(cx, cz));
  if (!chunk) return 0;
  return chunk.blocks[blockIndex(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE))] || 0;
}

function getBlockEnsured(x, y, z) {
  if (!inHeight(y)) return y < 0 ? ITEM.BEDROCK : 0;
  const cx = floorDiv(x, CHUNK_SIZE);
  const cz = floorDiv(z, CHUNK_SIZE);
  const chunk = ensureChunkData(cx, cz);
  return chunk.blocks[blockIndex(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE))] || 0;
}

function setBlock(x, y, z, id, trackEdit = true) {
  if (!inHeight(y) || !Number.isInteger(id) || id < 0 || id >= BLOCKS.length) return false;
  const cx = floorDiv(x, CHUNK_SIZE);
  const cz = floorDiv(z, CHUNK_SIZE);
  const chunk = ensureChunkData(cx, cz);
  chunk.blocks[blockIndex(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE))] = id;
  if (trackEdit) edits.set(editKeyFor(x, y, z), id);
  rebuildChunk(cx, cz);
  if (mod(x, CHUNK_SIZE) === 0) rebuildChunk(cx - 1, cz);
  if (mod(x, CHUNK_SIZE) === CHUNK_SIZE - 1) rebuildChunk(cx + 1, cz);
  if (mod(z, CHUNK_SIZE) === 0) rebuildChunk(cx, cz - 1);
  if (mod(z, CHUNK_SIZE) === CHUNK_SIZE - 1) rebuildChunk(cx, cz + 1);
  return true;
}

function blockFaceColor(id, dirY) {
  const block = BLOCKS[id];
  if (dirY > 0 && block.top) return block.top;
  if (dirY === 0 && block.side) return block.side;
  return block.color;
}

function buildGeometry(cx, cz, waterOnly = false) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let vertexBase = 0;
  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;
  const color = new THREE.Color();
  const chunk = ensureChunkData(cx, cz);

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const id = chunk.blocks[blockIndex(lx, y, lz)];
        if (!id) continue;
        const isWater = id === ITEM.WATER;
        if (waterOnly !== isWater) continue;
        const x = startX + lx;
        const z = startZ + lz;
        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          const neighbor = getBlock(x + dx, y + dy, z + dz);
          const visible = isWater ? neighbor === 0 : !isSolid(neighbor);
          if (!visible) continue;
          if (!isWater) color.setHex(blockFaceColor(id, dy)).multiplyScalar(face.shade);
          for (const corner of face.corners) {
            positions.push(x + corner[0], y + corner[1], z + corner[2]);
            normals.push(dx, dy, dz);
            if (!isWater) colors.push(color.r, color.g, color.b);
          }
          indices.push(vertexBase, vertexBase + 1, vertexBase + 2, vertexBase, vertexBase + 2, vertexBase + 3);
          vertexBase += 4;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (!waterOnly) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  if (positions.length) geometry.computeBoundingSphere();
  return geometry;
}

function disposeChunkMeshes(chunk) {
  if (chunk.solidMesh) {
    scene.remove(chunk.solidMesh);
    chunk.solidMesh.geometry.dispose();
    chunk.solidMesh = null;
  }
  if (chunk.waterMesh) {
    scene.remove(chunk.waterMesh);
    chunk.waterMesh.geometry.dispose();
    chunk.waterMesh = null;
  }
}

function rebuildChunk(cx, cz) {
  const chunk = chunks.get(chunkKey(cx, cz));
  if (!chunk) return;
  const dx = Math.abs(cx - currentChunkX);
  const dz = Math.abs(cz - currentChunkZ);
  if (dx > RENDER_RADIUS || dz > RENDER_RADIUS) return;
  disposeChunkMeshes(chunk);
  const solidGeometry = buildGeometry(cx, cz, false);
  const waterGeometry = buildGeometry(cx, cz, true);
  if (solidGeometry.getAttribute('position')?.count) {
    chunk.solidMesh = new THREE.Mesh(solidGeometry, solidMaterial);
    chunk.solidMesh.userData.chunk = { cx, cz };
    scene.add(chunk.solidMesh);
  } else {
    solidGeometry.dispose();
  }
  if (waterGeometry.getAttribute('position')?.count) {
    chunk.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    chunk.waterMesh.userData.chunk = { cx, cz };
    chunk.waterMesh.renderOrder = 1;
    scene.add(chunk.waterMesh);
  } else {
    waterGeometry.dispose();
  }
}

function clearChunks() {
  for (const chunk of chunks.values()) disposeChunkMeshes(chunk);
  chunks.clear();
  currentChunkX = Infinity;
  currentChunkZ = Infinity;
}

function updateChunks(force = false) {
  const pcx = floorDiv(Math.floor(PLAYER.feet.x), CHUNK_SIZE);
  const pcz = floorDiv(Math.floor(PLAYER.feet.z), CHUNK_SIZE);
  if (!force && pcx === currentChunkX && pcz === currentChunkZ) return;
  currentChunkX = pcx;
  currentChunkZ = pcz;

  for (let cx = pcx - BUFFER_RADIUS; cx <= pcx + BUFFER_RADIUS; cx++) {
    for (let cz = pcz - BUFFER_RADIUS; cz <= pcz + BUFFER_RADIUS; cz++) ensureChunkData(cx, cz);
  }

  for (const [key, chunk] of [...chunks]) {
    const dx = Math.abs(chunk.cx - pcx);
    const dz = Math.abs(chunk.cz - pcz);
    if (dx > BUFFER_RADIUS + 1 || dz > BUFFER_RADIUS + 1) {
      disposeChunkMeshes(chunk);
      chunks.delete(key);
    }
  }

  for (let cx = pcx - RENDER_RADIUS; cx <= pcx + RENDER_RADIUS; cx++) {
    for (let cz = pcz - RENDER_RADIUS; cz <= pcz + RENDER_RADIUS; cz++) {
      const chunk = ensureChunkData(cx, cz);
      if (!chunk.solidMesh && !chunk.waterMesh) rebuildChunk(cx, cz);
    }
  }
}

function solidMeshes() {
  const meshes = [];
  for (const chunk of chunks.values()) if (chunk.solidMesh) meshes.push(chunk.solidMesh);
  return meshes;
}

function getSurfaceY(x, z) {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  ensureChunkData(floorDiv(bx, CHUNK_SIZE), floorDiv(bz, CHUNK_SIZE));
  for (let y = WORLD_HEIGHT - 2; y >= 1; y--) {
    const id = getBlock(bx, y, bz);
    if (isSolid(id)) return y + 1;
  }
  return 1;
}

function isMobWalkable(x, y, z) {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const by = Math.floor(y);
  const feet = getBlockEnsured(bx, by, bz);
  const head = getBlockEnsured(bx, by + 1, bz);
  const floor = getBlockEnsured(bx, by - 1, bz);
  return isSolid(floor) && !isSolid(feet) && !isSolid(head) && feet !== ITEM.WATER && head !== ITEM.WATER;
}

const mobs = new MobSystem(scene, {
  surfaceY: getSurfaceY,
  isWalkable: isMobWalkable,
  worldTime: () => worldTime,
  onAttackPlayer: (damage) => damagePlayer(damage, 'Um zumbi atacou você.'),
  onDrops: (drops) => {
    for (const drop of drops) inventory.add(drop.id, drop.amount);
    renderHotbar();
    renderInventory();
    showToast('Itens coletados do mob.');
  }
});

function disposeClouds() {
  for (const cloud of clouds.children) {
    for (const child of cloud.children) {
      child.geometry?.dispose();
      child.material?.dispose();
    }
  }
  clouds.clear();
}

function createClouds() {
  disposeClouds();
  for (let i = 0; i < 18; i++) {
    const cloud = new THREE.Group();
    const pieces = 2 + Math.floor(noise.hash2(i, 0, 901) * 4);
    for (let p = 0; p < pieces; p++) {
      const part = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: false })
      );
      part.scale.set(3 + noise.hash2(i, p, 902) * 6, 0.55 + noise.hash2(i, p, 903) * 0.6, 2 + noise.hash2(i, p, 904) * 4);
      part.position.set(p * 3.2, noise.hash2(i, p, 905) * 0.3, (noise.hash2(i, p, 906) - 0.5) * 2.5);
      cloud.add(part);
    }
    cloud.position.set((noise.hash2(i, 4, 907) - 0.5) * 130, 34 + noise.hash2(i, 5, 908) * 5, (noise.hash2(i, 6, 909) - 0.5) * 130);
    cloud.userData.speed = 0.3 + noise.hash2(i, 7, 910) * 0.25;
    clouds.add(cloud);
  }
}

function spawnPlayer() {
  ensureChunkData(0, 0);
  const x = 0.5;
  const z = 0.5;
  const y = getSurfaceY(x, z) + 0.01;
  PLAYER.feet.set(x, y, z);
  PLAYER.velocity.set(0, 0, 0);
  PLAYER.onGround = false;
  PLAYER.fallDistance = 0;
  camera.position.set(x, y + PLAYER.eyeHeight, z);
  camera.rotation.set(0, 0, 0);
  updateChunks(true);
}

function collidesAt(position) {
  const minX = Math.floor(position.x - PLAYER.halfWidth + 0.001);
  const maxX = Math.floor(position.x + PLAYER.halfWidth - 0.001);
  const minY = Math.floor(position.y + 0.001);
  const maxY = Math.floor(position.y + PLAYER.height - 0.001);
  const minZ = Math.floor(position.z - PLAYER.halfWidth + 0.001);
  const maxZ = Math.floor(position.z + PLAYER.halfWidth - 0.001);
  if (minY < 0) return true;
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (isSolid(getBlockEnsured(x, y, z))) return true;
      }
    }
  }
  return false;
}

function blockIntersectsPlayer(x, y, z) {
  const pMinX = PLAYER.feet.x - PLAYER.halfWidth;
  const pMaxX = PLAYER.feet.x + PLAYER.halfWidth;
  const pMinY = PLAYER.feet.y;
  const pMaxY = PLAYER.feet.y + PLAYER.height;
  const pMinZ = PLAYER.feet.z - PLAYER.halfWidth;
  const pMaxZ = PLAYER.feet.z + PLAYER.halfWidth;
  return x + 1 > pMinX && x < pMaxX && y + 1 > pMinY && y < pMaxY && z + 1 > pMinZ && z < pMaxZ;
}

function playerInWater() {
  const x = Math.floor(PLAYER.feet.x);
  const z = Math.floor(PLAYER.feet.z);
  const feetBlock = getBlockEnsured(x, Math.floor(PLAYER.feet.y + 0.25), z);
  const chestBlock = getBlockEnsured(x, Math.floor(PLAYER.feet.y + 1.15), z);
  return feetBlock === ITEM.WATER || chestBlock === ITEM.WATER;
}

function updatePlayer(dt) {
  if (!controls.isLocked || !ready || survival.dead) return;
  PLAYER.wasGrounded = PLAYER.onGround;
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
  forward.normalize();
  right.set(-forward.z, 0, forward.x);
  wish.set(0, 0, 0);
  if (keys.has('KeyW')) wish.add(forward);
  if (keys.has('KeyS')) wish.sub(forward);
  if (keys.has('KeyD')) wish.add(right);
  if (keys.has('KeyA')) wish.sub(right);
  if (wish.lengthSq() > 1) wish.normalize();

  const inWater = playerInWater();
  const wantsSprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const sprinting = wantsSprint && survival.hunger > 6 && !inWater;
  const speed = flying ? (wantsSprint ? 12 : 7.5) : inWater ? 2.5 : sprinting ? 7.2 : 4.5;
  const accel = flying ? 12 : inWater ? 7 : PLAYER.onGround ? 18 : 5.5;
  const blend = Math.min(1, accel * dt);
  PLAYER.velocity.x = THREE.MathUtils.lerp(PLAYER.velocity.x, wish.x * speed, blend);
  PLAYER.velocity.z = THREE.MathUtils.lerp(PLAYER.velocity.z, wish.z * speed, blend);

  if (flying) {
    const vertical = (keys.has('Space') ? 1 : 0) - (keys.has('ControlLeft') || keys.has('ControlRight') ? 1 : 0);
    PLAYER.velocity.y = THREE.MathUtils.lerp(PLAYER.velocity.y, vertical * speed, Math.min(1, 12 * dt));
    PLAYER.onGround = false;
    PLAYER.fallDistance = 0;
  } else if (inWater) {
    const vertical = keys.has('Space') ? 3.8 : -0.7;
    PLAYER.velocity.y = THREE.MathUtils.lerp(PLAYER.velocity.y, vertical, Math.min(1, 5 * dt));
    PLAYER.velocity.multiplyScalar(Math.pow(0.985, dt * 60));
    PLAYER.onGround = false;
    PLAYER.fallDistance = 0;
  } else {
    if (jumpQueued && PLAYER.onGround) {
      PLAYER.velocity.y = 7.3;
      PLAYER.onGround = false;
      PLAYER.fallDistance = 0;
      survival.addExhaustion(sprinting ? 0.8 : 0.2);
      playJump();
    }
    PLAYER.velocity.y = Math.max(-30, PLAYER.velocity.y - 20.5 * dt);
    if (PLAYER.velocity.y < 0 && !PLAYER.onGround) PLAYER.fallDistance += -PLAYER.velocity.y * dt;
  }
  jumpQueued = false;

  const travel = Math.max(Math.abs(PLAYER.velocity.x * dt), Math.abs(PLAYER.velocity.y * dt), Math.abs(PLAYER.velocity.z * dt));
  const steps = Math.max(1, Math.ceil(travel / 0.16));
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    if (!flying && !inWater) PLAYER.onGround = false;
    proposed.copy(PLAYER.feet);
    proposed.x += PLAYER.velocity.x * stepDt;
    if (!collidesAt(proposed)) PLAYER.feet.x = proposed.x;
    else PLAYER.velocity.x = 0;

    proposed.copy(PLAYER.feet);
    proposed.z += PLAYER.velocity.z * stepDt;
    if (!collidesAt(proposed)) PLAYER.feet.z = proposed.z;
    else PLAYER.velocity.z = 0;

    proposed.copy(PLAYER.feet);
    proposed.y += PLAYER.velocity.y * stepDt;
    if (!collidesAt(proposed)) {
      PLAYER.feet.y = proposed.y;
    } else {
      if (!flying && !inWater && PLAYER.velocity.y < 0) PLAYER.onGround = true;
      PLAYER.velocity.y = 0;
    }
  }

  if (!flying && !inWater) {
    const groundProbe = PLAYER.feet.clone();
    groundProbe.y -= 0.035;
    if (collidesAt(groundProbe)) PLAYER.onGround = true;
    if (!PLAYER.wasGrounded && PLAYER.onGround) {
      if (PLAYER.fallDistance > 3.4) damagePlayer(Math.floor(PLAYER.fallDistance - 3), 'Dano de queda.');
      PLAYER.fallDistance = 0;
      playLand();
    }
  }

  const horizontalSpeed = Math.hypot(PLAYER.velocity.x, PLAYER.velocity.z);
  if (!flying && PLAYER.onGround && wish.lengthSq() > 0.1) {
    PLAYER.stepDistance += horizontalSpeed * dt;
    survival.addExhaustion(dt * (sprinting ? 0.11 : 0.025));
    if (PLAYER.stepDistance >= 2.15) {
      PLAYER.stepDistance = 0;
      const floorId = getBlockEnsured(Math.floor(PLAYER.feet.x), Math.floor(PLAYER.feet.y - 0.08), Math.floor(PLAYER.feet.z));
      playStep(BLOCKS[floorId]?.material || 'stone');
    }
  }

  if (PLAYER.feet.y < -8) {
    survival.takeDamage(999);
    handleDeath('Você caiu no vazio.');
    return;
  }

  camera.position.set(PLAYER.feet.x, PLAYER.feet.y + PLAYER.eyeHeight, PLAYER.feet.z);
  const targetFov = sprinting && wish.lengthSq() > 0.1 ? 81 : inWater ? 72 : 75;
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 8));
  camera.updateProjectionMatrix();
  updateChunks();
}

function damagePlayer(amount, message = '') {
  if (!survival.takeDamage(amount)) return;
  damageFlash.classList.remove('hit');
  void damageFlash.offsetWidth;
  damageFlash.classList.add('hit');
  if (message) showToast(message);
  renderSurvivalHud();
  if (survival.dead) handleDeath('Você morreu.');
}

function handleDeath(message) {
  showToast(`${message} Reaparecendo…`);
  controls.unlock();
  setTimeout(() => {
    survival.reset();
    flying = false;
    modeBadge.textContent = 'SOBREVIVÊNCIA';
    modeBadge.classList.remove('creative');
    spawnPlayer();
    renderSurvivalHud();
    status.textContent = `Reapareceu · seed ${seed}`;
  }, 550);
}

function targetBlock() {
  rayOrigin.copy(camera.position);
  camera.getWorldDirection(rayDirection);
  raycaster.far = REACH;
  raycaster.set(rayOrigin, rayDirection);
  const hits = raycaster.intersectObjects(solidMeshes(), false);
  if (!hits.length) return null;
  const hit = hits[0];
  if (!hit.face) return null;
  const n = hit.face.normal;
  const removePoint = hit.point.clone().addScaledVector(n, -0.01);
  const placePoint = hit.point.clone().addScaledVector(n, 0.01);
  return {
    remove: [Math.floor(removePoint.x), Math.floor(removePoint.y), Math.floor(removePoint.z)],
    place: [Math.floor(placePoint.x), Math.floor(placePoint.y), Math.floor(placePoint.z)],
    distance: hit.distance
  };
}

function updateTarget() {
  if (!controls.isLocked) {
    outline.visible = false;
    currentTarget = null;
    cancelMining();
    return;
  }
  currentTarget = targetBlock();
  if (!currentTarget) {
    outline.visible = false;
    cancelMining();
    return;
  }
  const [x, y, z] = currentTarget.remove;
  outline.visible = true;
  outline.position.set(x + 0.5, y + 0.5, z + 0.5);
  if (mining && miningKey && miningKey !== blockKey(x, y, z)) cancelMining();
}

function startMining() {
  if (!currentTarget) return;
  const [x, y, z] = currentTarget.remove;
  const id = getBlock(x, y, z);
  const block = BLOCKS[id];
  if (!id || !block || !Number.isFinite(block.hardness)) {
    if (id === ITEM.BEDROCK) showToast('A rocha-base não pode ser quebrada.');
    return;
  }
  mining = true;
  miningKey = blockKey(x, y, z);
  miningProgress = 0;
  miningBar.classList.add('active');
}

function cancelMining() {
  mining = false;
  miningKey = '';
  miningProgress = 0;
  miningFill.style.transform = 'scaleX(0)';
  miningBar.classList.remove('active');
}

function updateMining(dt) {
  if (!mining || !controls.isLocked || !currentTarget) return;
  const [x, y, z] = currentTarget.remove;
  const id = getBlock(x, y, z);
  const block = BLOCKS[id];
  if (!block || blockKey(x, y, z) !== miningKey || !Number.isFinite(block.hardness)) {
    cancelMining();
    return;
  }
  const profile = miningProfile(block, inventory.selectedId());
  const seconds = Math.max(0.08, block.hardness / Math.max(0.2, profile.speed));
  miningProgress += dt / seconds;
  miningFill.style.transform = `scaleX(${Math.min(1, miningProgress)})`;
  if (miningProgress < 1) return;

  setBlock(x, y, z, 0, true);
  const drop = blockDrop(id, inventory.selectedId());
  if (drop && profile.harvest) inventory.add(drop[0], drop[1]);
  const selected = inventory.selectedDef();
  if (selected?.kind === 'tool') {
    const result = inventory.damageSelectedTool(1);
    if (result === 'broken') showToast(`${selected.name} quebrou.`);
  }
  spawnBreakParticles(x, y, z, block.color);
  playBreak(block.material);
  survival.addExhaustion(0.005);
  renderHotbar();
  renderInventory();
  cancelMining();
  currentTarget = null;
}

function attackMob() {
  if (attackCooldown > 0) return false;
  rayOrigin.copy(camera.position);
  camera.getWorldDirection(rayDirection);
  const result = mobs.raycast(raycaster, rayOrigin, rayDirection, ATTACK_REACH);
  if (!result) return false;
  if (currentTarget && currentTarget.distance < result.hit.distance) return false;
  const def = inventory.selectedDef();
  const damage = def?.tool === 'sword' ? def.damage : def?.kind === 'tool' ? Math.max(2, def.damage || 2) : 1;
  mobs.attack(result.mob, damage, PLAYER.feet);
  if (def?.kind === 'tool') {
    const broken = inventory.damageSelectedTool(1);
    if (broken === 'broken') showToast(`${def.name} quebrou.`);
  }
  survival.addExhaustion(0.1);
  attackCooldown = 0.46;
  renderHotbar();
  return true;
}

function useSelectedItem() {
  const id = inventory.selectedId();
  const def = ITEM_DEFS.get(id);
  if (!def || !inventory.has(id)) return false;
  if (def.kind === 'food') {
    if (!survival.eat(def)) {
      showToast(survival.hunger >= 20 ? 'Você não está com fome.' : 'Não pode comer agora.');
      return true;
    }
    inventory.remove(id, 1);
    renderSurvivalHud();
    renderHotbar();
    renderInventory();
    showToast(`Comeu ${def.name}.`);
    return true;
  }
  return false;
}

function placeBlock() {
  if (useSelectedItem()) return;
  if (!currentTarget) return;
  const id = inventory.selectedId();
  const def = ITEM_DEFS.get(id);
  if (!def || def.kind !== 'block' || !inventory.has(id)) {
    showToast(def?.kind === 'block' ? 'Você não tem esse bloco.' : 'Selecione um bloco para colocar.');
    return;
  }
  const [x, y, z] = currentTarget.place;
  if (!inHeight(y)) return;
  const existing = getBlockEnsured(x, y, z);
  if (existing && existing !== ITEM.WATER) return;
  if (blockIntersectsPlayer(x, y, z)) {
    showToast('Você está ocupando esse espaço.');
    return;
  }
  setBlock(x, y, z, def.block, true);
  inventory.remove(id, 1);
  playPlace(BLOCKS[def.block]?.material || 'stone');
  renderHotbar();
  renderInventory();
}

function spawnBreakParticles(x, y, z, color) {
  for (let i = 0; i < 10; i++) {
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(particleGeometry, material);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    const velocity = new THREE.Vector3((Math.random() - 0.5) * 2.6, 1.1 + Math.random() * 2.2, (Math.random() - 0.5) * 2.6);
    particles.push({ mesh, velocity, life: 0.42 + Math.random() * 0.2 });
    particleGroup.add(mesh);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    particle.velocity.y -= 7 * dt;
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.mesh.rotation.x += dt * 8;
    particle.mesh.rotation.y += dt * 6;
    particle.mesh.scale.setScalar(Math.max(0.01, Math.min(1, particle.life / 0.18)));
    if (particle.life <= 0) {
      particleGroup.remove(particle.mesh);
      particle.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

function itemIcon(id) {
  const def = ITEM_DEFS.get(id);
  if (!def) return '?';
  if (def.tool === 'pickaxe') return '⛏';
  if (def.tool === 'sword') return '⚔';
  if (def.kind === 'food') return id === ITEM.APPLE ? '🍎' : '🍖';
  if (def.kind === 'material') return id === ITEM.DIAMOND ? '◆' : '▪';
  return '';
}

function renderHotbar() {
  hotbar.innerHTML = '';
  inventory.hotbar.forEach((id, index) => {
    const def = ITEM_DEFS.get(id);
    const block = def?.kind === 'block' ? BLOCKS[def.block] : null;
    const slot = document.createElement('div');
    slot.className = `slot${index === inventory.selected ? ' selected' : ''}${inventory.count(id) <= 0 ? ' empty' : ''}`;
    const visual = block
      ? `<span class="swatch" style="background:#${block.color.toString(16).padStart(6, '0')}"></span>`
      : `<span class="item-icon">${itemIcon(id)}</span>`;
    const durability = def?.kind === 'tool' && inventory.has(id) ? `<span class="durability">${inventory.durability.get(id) ?? def.durability}</span>` : '';
    slot.innerHTML = `<span class="num">${index + 1}</span>${visual}<span class="label">${def?.name || 'Vazio'}</span><span class="count">${inventory.count(id) || ''}</span>${durability}`;
    hotbar.appendChild(slot);
  });
}

function renderInventory() {
  inventoryPanel.querySelector('h2').textContent = 'Inventário & Crafting';
  inventoryGrid.innerHTML = '';
  const itemsSection = document.createElement('section');
  itemsSection.className = 'inventory-section';
  itemsSection.innerHTML = '<h3>Itens</h3>';
  const itemList = document.createElement('div');
  itemList.className = 'item-list';
  const entries = [...inventory.counts.entries()].filter(([, count]) => count > 0).sort((a, b) => a[0] - b[0]);
  if (!entries.length) itemList.innerHTML = '<p class="empty-note">Inventário vazio. Quebre madeira para começar.</p>';
  for (const [id, count] of entries) {
    const def = ITEM_DEFS.get(id);
    if (!def) continue;
    const button = document.createElement('button');
    button.className = 'inv-item';
    const block = def.kind === 'block' ? BLOCKS[def.block] : null;
    button.innerHTML = `${block ? `<span class="swatch" style="background:#${block.color.toString(16).padStart(6, '0')}"></span>` : `<span class="item-icon">${itemIcon(id)}</span>`}<strong>${def.name}</strong><small>x${count}${def.kind === 'tool' ? ` · dur. ${inventory.durability.get(id) ?? def.durability}` : ''}</small>`;
    button.addEventListener('click', () => {
      inventory.setHotbarSlot(inventory.selected, id);
      renderHotbar();
      showToast(`${def.name} colocado no slot ${inventory.selected + 1}.`);
    });
    itemList.appendChild(button);
  }
  itemsSection.appendChild(itemList);
  inventoryGrid.appendChild(itemsSection);

  const crafting = document.createElement('section');
  crafting.className = 'inventory-section crafting-section';
  crafting.innerHTML = '<h3>Crafting</h3><p class="craft-note">Clique numa receita. Fundição fica disponível quando você carrega pelo menos 8 pedregulhos.</p>';
  const recipeList = document.createElement('div');
  recipeList.className = 'recipe-list';
  for (const recipe of RECIPES) {
    const furnaceAccess = recipe.station !== 'furnace' || inventory.has(ITEM.COBBLE, 8);
    const craftable = inventory.canCraft(recipe) && furnaceAccess;
    const button = document.createElement('button');
    button.className = 'recipe';
    button.disabled = !craftable;
    const needs = recipe.inputs.map(([id, amount]) => `${amount}× ${ITEM_DEFS.get(id)?.name || id}`).join(' + ');
    button.innerHTML = `<strong>${recipe.name}</strong><small>${needs}${recipe.station === 'furnace' ? ' · fundição' : ''}</small>`;
    button.addEventListener('click', () => {
      if (!inventory.craft(recipe)) return;
      renderHotbar();
      renderInventory();
      showToast(`Criado: ${recipe.name}.`);
    });
    recipeList.appendChild(button);
  }
  crafting.appendChild(recipeList);
  inventoryGrid.appendChild(crafting);
}

function renderSurvivalHud() {
  const hearts = '♥'.repeat(Math.max(0, Math.ceil(survival.health / 2))).padEnd(10, '♡');
  const hunger = '◆'.repeat(Math.max(0, Math.ceil(survival.hunger / 2))).padEnd(10, '◇');
  survivalHud.innerHTML = `<span class="hearts">${hearts}</span><span class="hunger">${hunger}</span>`;
}

function selectSlot(index) {
  if (!inventory.setSelected(index)) return;
  renderHotbar();
  const def = inventory.selectedDef();
  if (def) showToast(`${def.name}${inventory.count(inventory.selectedId()) ? ` ×${inventory.count(inventory.selectedId())}` : ' · vazio'}`);
}

function openInventory() {
  if (!controls.isLocked) return;
  inventoryOpen = true;
  controls.unlock();
  menu.classList.remove('visible');
  inventoryPanel.classList.add('visible');
  renderInventory();
}

function closeInventory() {
  inventoryOpen = false;
  inventoryPanel.classList.remove('visible');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1500);
}

function toggleFlight() {
  flying = !flying;
  PLAYER.velocity.y = 0;
  PLAYER.fallDistance = 0;
  modeBadge.textContent = flying ? 'VOO LIVRE' : 'SOBREVIVÊNCIA';
  modeBadge.classList.toggle('creative', flying);
  playToggleFly(flying);
  showToast(flying ? 'Voo livre: Espaço sobe · Ctrl desce' : 'Voo desativado');
}

function toggleDebug() {
  debugVisible = !debugVisible;
  stats.classList.toggle('debug-hidden', !debugVisible);
  showToast(debugVisible ? 'Debug visível' : 'Debug oculto');
}

function serializeEdits() {
  return [...edits.entries()];
}

function saveWorld(showMessage = true) {
  if (!ready) return false;
  const data = {
    version: 4,
    seed,
    time: worldTime,
    player: [PLAYER.feet.x, PLAYER.feet.y, PLAYER.feet.z],
    rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z],
    flying,
    edits: serializeEdits(),
    inventory: inventory.serialize(),
    survival: survival.serialize(),
    mobs: mobs.serialize()
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  if (showMessage) showToast('Mundo salvo no navegador.');
  return true;
}

function loadWorld() {
  const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (![3, 4].includes(data.version) || !Number.isFinite(data.seed)) return false;
    seed = data.seed;
    noise = new SeededNoise(seed);
    worldTime = Number.isFinite(data.time) ? data.time : 0.28;
    edits.clear();
    if (Array.isArray(data.edits)) {
      for (const pair of data.edits) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        if (data.version === 4 && typeof pair[0] === 'string' && pair[0].includes(':')) {
          const id = Number(pair[1]);
          if (Number.isInteger(id) && id >= 0 && id < BLOCKS.length) edits.set(pair[0], id);
        } else if (data.version === 3) {
          const [x, y, z] = String(pair[0]).split(',').map(Number);
          const id = Number(pair[1]);
          if ([x, y, z, id].every(Number.isFinite) && inHeight(y) && id >= 0 && id < BLOCKS.length) edits.set(editKeyFor(x, y, z), id);
        }
      }
    }

    clearChunks();
    ensureChunkData(0, 0);
    createClouds();
    if (data.version === 4) {
      inventory = new Inventory();
      inventory.load(data.inventory);
      survival.load(data.survival);
    } else {
      inventory = new Inventory();
      survival.reset();
    }

    if (Array.isArray(data.player) && data.player.length === 3 && data.player.every(Number.isFinite)) {
      PLAYER.feet.set(...data.player);
      updateChunks(true);
      if (collidesAt(PLAYER.feet)) spawnPlayer();
    } else {
      spawnPlayer();
    }
    if (Array.isArray(data.rotation) && data.rotation.length === 3 && data.rotation.every(Number.isFinite)) camera.rotation.set(...data.rotation);
    flying = Boolean(data.flying);
    modeBadge.textContent = flying ? 'VOO LIVRE' : 'SOBREVIVÊNCIA';
    modeBadge.classList.toggle('creative', flying);
    camera.position.set(PLAYER.feet.x, PLAYER.feet.y + PLAYER.eyeHeight, PLAYER.feet.z);
    if (data.version === 4) mobs.load(data.mobs);
    renderHotbar();
    renderInventory();
    renderSurvivalHud();
    status.textContent = `Save v${data.version} carregado · seed ${seed}`;
    ready = true;
    return true;
  } catch (error) {
    console.warn('Falha ao carregar save', error);
    return false;
  }
}

function newWorld() {
  ready = false;
  seed = randomSeed();
  noise = new SeededNoise(seed);
  worldTime = 0.28;
  flying = false;
  edits.clear();
  inventory = new Inventory();
  survival.reset();
  mobs.clear();
  clearChunks();
  localStorage.removeItem(SAVE_KEY);
  createClouds();
  spawnPlayer();
  ready = true;
  renderHotbar();
  renderInventory();
  renderSurvivalHud();
  modeBadge.textContent = 'SOBREVIVÊNCIA';
  modeBadge.classList.remove('creative');
  status.textContent = `Novo mundo · seed ${seed}`;
  saveWorld(false);
  showToast('Novo mundo infinito criado. Procure madeira para começar.');
}

function updateSky(dt) {
  worldTime = (worldTime + dt / 300) % 1;
  const angle = worldTime * Math.PI * 2;
  const sunY = Math.sin(angle);
  const sunX = Math.cos(angle);
  sun.position.set(PLAYER.feet.x + sunX * 55, sunY * 55, PLAYER.feet.z + 22);
  daylightLevel = THREE.MathUtils.smoothstep(sunY, -0.12, 0.34);
  const twilight = 1 - Math.min(1, Math.abs(sunY) * 4.2);
  skyCurrent.copy(skyNight).lerp(skyDay, daylightLevel);
  if (twilight > 0 && daylightLevel > 0.1) skyCurrent.lerp(skyDusk, twilight * 0.32);
  scene.background.copy(skyCurrent);
  scene.fog.color.copy(skyCurrent);
  hemi.intensity = 0.18 + daylightLevel * 1.28;
  sun.intensity = Math.max(0, daylightLevel * 2.3);
  for (const cloud of clouds.children) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x < PLAYER.feet.x - 90) cloud.position.x += 180;
    if (cloud.position.x > PLAYER.feet.x + 90) cloud.position.x -= 180;
    if (cloud.position.z < PLAYER.feet.z - 90) cloud.position.z += 180;
    if (cloud.position.z > PLAYER.feet.z + 90) cloud.position.z -= 180;
  }
}

let frames = 0;
let fpsTime = 0;
function updateStats(dt) {
  frames++;
  fpsTime += dt;
  if (fpsTime < 0.5) return;
  const fps = Math.round(frames / fpsTime);
  stats.textContent = `FPS ${fps} · XYZ ${PLAYER.feet.x.toFixed(1)} / ${PLAYER.feet.y.toFixed(1)} / ${PLAYER.feet.z.toFixed(1)} · chunk ${currentChunkX},${currentChunkZ} · chunks ${chunks.size} · mobs ${mobs.mobs.length} · seed ${seed} · ${flying ? 'FLY' : playerInWater() ? 'SWIM' : 'WALK'}`;
  frames = 0;
  fpsTime = 0;
}

let last = performance.now();
function animate(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  attackCooldown = Math.max(0, attackCooldown - dt);
  updatePlayer(dt);
  updateTarget();
  updateMining(dt);
  updateParticles(dt);
  updateSky(dt);
  survival.update(dt);
  if (survival.dead) handleDeath('Você morreu de fome ou ferimentos.');
  mobs.update(dt, PLAYER.feet, daylightLevel);
  updateStats(dt);
  renderSurvivalHud();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

controls.addEventListener('lock', () => {
  unlockAudio();
  closeInventory();
  menu.classList.remove('visible');
  hud.classList.remove('hidden');
  hud.setAttribute('aria-hidden', 'false');
});

controls.addEventListener('unlock', () => {
  cancelMining();
  hud.classList.add('hidden');
  hud.setAttribute('aria-hidden', 'true');
  keys.clear();
  if (inventoryOpen) {
    menu.classList.remove('visible');
    inventoryPanel.classList.add('visible');
  } else {
    inventoryPanel.classList.remove('visible');
    menu.classList.add('visible');
    if (ready) status.textContent = `Pausado · seed ${seed}`;
  }
  saveWorld(false);
});

playButton.addEventListener('click', () => {
  inventoryOpen = false;
  if (!ready) return;
  unlockAudio();
  controls.lock();
});
newWorldButton.addEventListener('click', newWorld);
saveButton.addEventListener('click', () => saveWorld(true));
closeInventoryButton.addEventListener('click', () => {
  closeInventory();
  menu.classList.add('visible');
});

addEventListener('keydown', (event) => {
  if (event.code.startsWith('Digit')) {
    const index = Number(event.code.slice(5)) - 1;
    if (index >= 0 && index < 9) selectSlot(index);
  }
  if (event.code === 'KeyE' && controls.isLocked) {
    event.preventDefault();
    openInventory();
    return;
  }
  if (event.code === 'KeyF' && controls.isLocked && !event.repeat) {
    toggleFlight();
    return;
  }
  if (event.code === 'F3' && !event.repeat) {
    event.preventDefault();
    toggleDebug();
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) jumpQueued = true;
  }
  keys.add(event.code);
});

addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => {
  keys.clear();
  cancelMining();
});

renderer.domElement.addEventListener('mousedown', (event) => {
  if (!controls.isLocked) return;
  event.preventDefault();
  if (event.button === 0) {
    if (!attackMob()) startMining();
  }
  if (event.button === 2) placeBlock();
});
renderer.domElement.addEventListener('mouseup', (event) => {
  if (event.button === 0) cancelMining();
});
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

addEventListener('wheel', (event) => {
  if (!controls.isLocked) return;
  inventory.selected = (inventory.selected + (event.deltaY > 0 ? 1 : -1) + 9) % 9;
  renderHotbar();
}, { passive: true });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
});

addEventListener('beforeunload', () => saveWorld(false));
setInterval(() => saveWorld(false), AUTOSAVE_MS);

renderHotbar();
renderInventory();
renderSurvivalHud();
ready = false;
if (!loadWorld()) newWorld();
else ready = true;
