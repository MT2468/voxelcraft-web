import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { SeededNoise } from './noise.js';
import {
  unlockAudio,
  playBreak,
  playPlace,
  playStep,
  playJump,
  playLand,
  playToggleFly
} from './audio.js';

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
const WORLD_RADIUS = 2;
const WORLD_MIN = -WORLD_RADIUS * CHUNK_SIZE;
const WORLD_MAX = WORLD_RADIUS * CHUNK_SIZE - 1;
const MAX_BUILD_Y = 31;
const REACH = 6;
const SAVE_KEY = 'voxelcraft-web-save-v3';
const AUTOSAVE_MS = 20_000;

const BLOCKS = [
  null,
  { id: 1, name: 'Grama', color: 0x6da943, side: 0x80613f, hardness: 0.36, material: 'sand' },
  { id: 2, name: 'Terra', color: 0x855f3b, hardness: 0.42, material: 'sand' },
  { id: 3, name: 'Pedra', color: 0x858585, hardness: 1.05, material: 'stone' },
  { id: 4, name: 'Areia', color: 0xd8c685, hardness: 0.32, material: 'sand' },
  { id: 5, name: 'Madeira', color: 0x8c633b, top: 0xb38a59, hardness: 0.72, material: 'wood' },
  { id: 6, name: 'Folhas', color: 0x3d8439, hardness: 0.18, material: 'leaves' },
  { id: 7, name: 'Pedregulho', color: 0x6e6e6e, hardness: 1.2, material: 'stone' },
  { id: 8, name: 'Tábuas', color: 0xb28754, hardness: 0.62, material: 'wood' },
  { id: 9, name: 'Neve', color: 0xe8f2f2, side: 0xc7d4d4, hardness: 0.22, material: 'snow' },
  { id: 10, name: 'Carvão', color: 0x4c4c4c, hardness: 1.32, material: 'stone' },
  { id: 11, name: 'Ferro', color: 0xb59b82, hardness: 1.46, material: 'stone' },
  { id: 12, name: 'Ouro', color: 0xe1b632, hardness: 1.58, material: 'stone' },
  { id: 13, name: 'Diamante', color: 0x55d4d6, hardness: 1.78, material: 'stone' },
  { id: 14, name: 'Rocha-base', color: 0x272727, hardness: Infinity, material: 'stone' }
];
const HOTBAR_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7eb5e6);
scene.fog = new THREE.Fog(0x7eb5e6, 30, 76);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 170);
const controls = new PointerLockControls(camera, renderer.domElement);

const hemi = new THREE.HemisphereLight(0xbfe2ff, 0x4b432f, 1.4);
const sun = new THREE.DirectionalLight(0xfff0c7, 2.2);
sun.position.set(20, 40, 10);
scene.add(hemi, sun);

const worldMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const world = new Map();
const edits = new Map();
const chunkMeshes = new Map();
let noise = new SeededNoise(1);
let seed = 1;
let worldTime = 0.28;
let selectedSlot = 0;
let ready = false;
let inventoryOpen = false;
let debugVisible = true;
let flying = false;

const PLAYER = {
  feet: new THREE.Vector3(0.5, 20, 0.5),
  velocity: new THREE.Vector3(),
  halfWidth: 0.3,
  height: 1.8,
  eyeHeight: 1.62,
  onGround: false,
  wasGrounded: false,
  stepDistance: 0
};

const keys = new Set();
let jumpQueued = false;

const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const rayDirection = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();
let currentTarget = null;

const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
  new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.88 })
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

function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

function inBounds(x, y, z) {
  return x >= WORLD_MIN && x <= WORLD_MAX && z >= WORLD_MIN && z <= WORLD_MAX && y >= 0 && y <= MAX_BUILD_Y;
}

function getBlock(x, y, z) {
  if (!inBounds(x, y, z)) return 0;
  return world.get(keyOf(x, y, z)) || 0;
}

function setRawBlock(x, y, z, id) {
  if (!inBounds(x, y, z)) return;
  const key = keyOf(x, y, z);
  if (id) world.set(key, id);
  else world.delete(key);
}

function terrainHeight(x, z) {
  const broad = noise.fbm2(x, z, 0.025, 4, 11);
  const detail = noise.value2(x, z, 0.115, 37);
  const ridge = Math.abs(noise.value2(x, z, 0.018, 71) - 0.5) * 2;
  return Math.max(4, Math.min(21, Math.floor(5 + broad * 10 + detail * 3 + ridge * 2.2)));
}

function biomeAt(x, z) {
  const temperature = noise.value2(x + 700, z - 400, 0.012, 97);
  if (temperature > 0.7) return 'desert';
  if (temperature < 0.23) return 'snow';
  return 'plains';
}

function caveAt(x, y, z, surface) {
  if (y <= 1 || y >= surface - 3) return false;
  const primary = noise.value3(x, y, z, 0.09, 701);
  const tunnel = noise.value3(x + 200, y * 0.72, z - 140, 0.055, 703);
  const depthBias = THREE.MathUtils.clamp((surface - y) / 14, 0, 1);
  return primary > 0.68 - depthBias * 0.035 && tunnel > 0.49;
}

function oreFor(x, y, z) {
  const roll = noise.hash3(x, y, z, 1301);
  if (y <= 7 && roll > 0.988) return 13;
  if (y <= 11 && roll > 0.974) return 12;
  if (y <= 17 && roll > 0.946) return 11;
  if (y <= 21 && roll > 0.92) return 10;
  return 3;
}

function generateWorld({ autoSave = true } = {}) {
  ready = false;
  world.clear();
  edits.clear();
  disposeChunks();
  disposeClouds();
  noise = new SeededNoise(seed);
  status.textContent = `Gerando terreno, cavernas e minérios · seed ${seed}…`;

  for (let x = WORLD_MIN; x <= WORLD_MAX; x++) {
    for (let z = WORLD_MIN; z <= WORLD_MAX; z++) {
      const surface = terrainHeight(x, z);
      const biome = biomeAt(x, z);
      for (let y = 0; y <= surface; y++) {
        if (y === 0) {
          setRawBlock(x, y, z, 14);
          continue;
        }
        if (caveAt(x, y, z, surface)) continue;
        let id = 3;
        if (y === surface) id = biome === 'desert' ? 4 : biome === 'snow' ? 9 : 1;
        else if (y >= surface - 3) id = biome === 'desert' ? 4 : 2;
        else id = oreFor(x, y, z);
        setRawBlock(x, y, z, id);
      }
    }
  }

  generateTrees();
  rebuildAllChunks();
  createClouds();
  spawnPlayer();
  ready = true;
  status.textContent = `Mundo pronto · seed ${seed}`;
  if (autoSave) saveWorld(false);
}

function generateTrees() {
  for (let x = WORLD_MIN + 2; x <= WORLD_MAX - 2; x++) {
    for (let z = WORLD_MIN + 2; z <= WORLD_MAX - 2; z++) {
      if (biomeAt(x, z) !== 'plains') continue;
      if (noise.hash2(x, z, 123) < 0.987) continue;
      const y = terrainHeight(x, z) + 1;
      if (getBlock(x, y - 1, z) !== 1) continue;
      const trunk = 3 + Math.floor(noise.hash2(x, z, 321) * 2);
      for (let t = 0; t < trunk; t++) setRawBlock(x, y + t, z, 5);
      const canopyY = y + trunk - 1;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dy = -1; dy <= 2; dy++) {
            const distance = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - 1);
            if (distance > 4) continue;
            const bx = x + dx;
            const by = canopyY + dy;
            const bz = z + dz;
            if (inBounds(bx, by, bz) && !getBlock(bx, by, bz)) setRawBlock(bx, by, bz, 6);
          }
        }
      }
    }
  }
}

function disposeChunks() {
  for (const mesh of chunkMeshes.values()) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  chunkMeshes.clear();
}

function blockFaceColor(id, dirY) {
  const block = BLOCKS[id];
  if (dirY > 0 && block.top) return block.top;
  if (dirY === 0 && block.side) return block.side;
  return block.color;
}

function buildChunkGeometry(cx, cz) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let vertexBase = 0;
  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;
  const color = new THREE.Color();

  for (let x = startX; x < startX + CHUNK_SIZE; x++) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
      for (let y = 0; y <= MAX_BUILD_Y; y++) {
        const id = getBlock(x, y, z);
        if (!id) continue;
        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          if (getBlock(x + dx, y + dy, z + dz)) continue;
          color.setHex(blockFaceColor(id, dy)).multiplyScalar(face.shade);
          for (const corner of face.corners) {
            positions.push(x + corner[0], y + corner[1], z + corner[2]);
            normals.push(dx, dy, dz);
            colors.push(color.r, color.g, color.b);
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
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  if (positions.length) geometry.computeBoundingSphere();
  return geometry;
}

function rebuildChunk(cx, cz) {
  if (cx < -WORLD_RADIUS || cx >= WORLD_RADIUS || cz < -WORLD_RADIUS || cz >= WORLD_RADIUS) return;
  const key = chunkKey(cx, cz);
  const old = chunkMeshes.get(key);
  if (old) {
    scene.remove(old);
    old.geometry.dispose();
    chunkMeshes.delete(key);
  }
  const mesh = new THREE.Mesh(buildChunkGeometry(cx, cz), worldMaterial);
  mesh.userData.chunk = { cx, cz };
  scene.add(mesh);
  chunkMeshes.set(key, mesh);
}

function rebuildAllChunks() {
  for (let cx = -WORLD_RADIUS; cx < WORLD_RADIUS; cx++) {
    for (let cz = -WORLD_RADIUS; cz < WORLD_RADIUS; cz++) rebuildChunk(cx, cz);
  }
}

function rebuildAround(x, z) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  rebuildChunk(cx, cz);
  if (localX === 0) rebuildChunk(cx - 1, cz);
  if (localX === CHUNK_SIZE - 1) rebuildChunk(cx + 1, cz);
  if (localZ === 0) rebuildChunk(cx, cz - 1);
  if (localZ === CHUNK_SIZE - 1) rebuildChunk(cx, cz + 1);
}

function setBlock(x, y, z, id, trackEdit = true) {
  if (!inBounds(x, y, z)) return false;
  setRawBlock(x, y, z, id);
  if (trackEdit) edits.set(keyOf(x, y, z), id);
  rebuildAround(x, z);
  return true;
}

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
  for (let i = 0; i < 16; i++) {
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
    cloud.position.set(
      WORLD_MIN + noise.hash2(i, 4, 907) * (WORLD_MAX - WORLD_MIN),
      23 + noise.hash2(i, 5, 908) * 4,
      WORLD_MIN + noise.hash2(i, 6, 909) * (WORLD_MAX - WORLD_MIN)
    );
    cloud.userData.speed = 0.3 + noise.hash2(i, 7, 910) * 0.2;
    clouds.add(cloud);
  }
}

function spawnPlayer() {
  const x = 0;
  const z = 0;
  const y = terrainHeight(x, z) + 2;
  PLAYER.feet.set(x + 0.5, y, z + 0.5);
  PLAYER.velocity.set(0, 0, 0);
  PLAYER.onGround = false;
  camera.position.set(PLAYER.feet.x, PLAYER.feet.y + PLAYER.eyeHeight, PLAYER.feet.z);
  camera.rotation.set(0, 0, 0);
}

function collidesAt(position) {
  const minX = Math.floor(position.x - PLAYER.halfWidth + 0.001);
  const maxX = Math.floor(position.x + PLAYER.halfWidth - 0.001);
  const minY = Math.floor(position.y + 0.001);
  const maxY = Math.floor(position.y + PLAYER.height - 0.001);
  const minZ = Math.floor(position.z - PLAYER.halfWidth + 0.001);
  const maxZ = Math.floor(position.z + PLAYER.halfWidth - 0.001);

  if (minX < WORLD_MIN || maxX > WORLD_MAX || minZ < WORLD_MIN || maxZ > WORLD_MAX || minY < 0) return true;
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (getBlock(x, y, z)) return true;
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

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();
const proposed = new THREE.Vector3();

function updatePlayer(dt) {
  if (!controls.isLocked || !ready) return;
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

  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = flying ? (sprinting ? 12 : 7.5) : (sprinting ? 7.2 : 4.5);
  const accel = flying ? 12 : PLAYER.onGround ? 18 : 5.5;
  const blend = Math.min(1, accel * dt);
  PLAYER.velocity.x = THREE.MathUtils.lerp(PLAYER.velocity.x, wish.x * speed, blend);
  PLAYER.velocity.z = THREE.MathUtils.lerp(PLAYER.velocity.z, wish.z * speed, blend);

  if (flying) {
    const vertical = (keys.has('Space') ? 1 : 0) - (keys.has('ControlLeft') || keys.has('ControlRight') ? 1 : 0);
    PLAYER.velocity.y = THREE.MathUtils.lerp(PLAYER.velocity.y, vertical * speed, Math.min(1, 12 * dt));
    PLAYER.onGround = false;
  } else {
    if (jumpQueued && PLAYER.onGround) {
      PLAYER.velocity.y = 7.3;
      PLAYER.onGround = false;
      playJump();
    }
    PLAYER.velocity.y = Math.max(-30, PLAYER.velocity.y - 20.5 * dt);
  }
  jumpQueued = false;

  const travel = Math.max(Math.abs(PLAYER.velocity.x * dt), Math.abs(PLAYER.velocity.y * dt), Math.abs(PLAYER.velocity.z * dt));
  const steps = Math.max(1, Math.ceil(travel / 0.16));
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    if (!flying) PLAYER.onGround = false;
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
      if (!flying && PLAYER.velocity.y < 0) PLAYER.onGround = true;
      PLAYER.velocity.y = 0;
    }
  }

  if (!flying) {
    const groundProbe = PLAYER.feet.clone();
    groundProbe.y -= 0.035;
    if (collidesAt(groundProbe)) PLAYER.onGround = true;
    if (!PLAYER.wasGrounded && PLAYER.onGround) playLand();
  }

  if (!flying && PLAYER.onGround && wish.lengthSq() > 0.1) {
    PLAYER.stepDistance += Math.hypot(PLAYER.velocity.x, PLAYER.velocity.z) * dt;
    if (PLAYER.stepDistance >= 2.15) {
      PLAYER.stepDistance = 0;
      const floorId = getBlock(Math.floor(PLAYER.feet.x), Math.floor(PLAYER.feet.y - 0.08), Math.floor(PLAYER.feet.z));
      playStep(BLOCKS[floorId]?.material || 'stone');
    }
  } else if (wish.lengthSq() < 0.1) {
    PLAYER.stepDistance = Math.min(PLAYER.stepDistance, 1.2);
  }

  camera.position.set(PLAYER.feet.x, PLAYER.feet.y + PLAYER.eyeHeight, PLAYER.feet.z);
  const targetFov = sprinting && wish.lengthSq() > 0.1 ? 81 : 75;
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 8));
  camera.updateProjectionMatrix();
}

function targetBlock() {
  rayOrigin.copy(camera.position);
  camera.getWorldDirection(rayDirection);
  raycaster.set(rayOrigin, rayDirection);
  const hits = raycaster.intersectObjects([...chunkMeshes.values()], false);
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
  if (mining && miningKey && miningKey !== keyOf(x, y, z)) cancelMining();
}

function startMining() {
  if (!currentTarget) return;
  const [x, y, z] = currentTarget.remove;
  const id = getBlock(x, y, z);
  if (!id || !Number.isFinite(BLOCKS[id].hardness)) {
    if (id === 14) showToast('A rocha-base não pode ser quebrada.');
    return;
  }
  mining = true;
  miningKey = keyOf(x, y, z);
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
  if (!block || keyOf(x, y, z) !== miningKey || !Number.isFinite(block.hardness)) {
    cancelMining();
    return;
  }
  miningProgress += dt / block.hardness;
  miningFill.style.transform = `scaleX(${Math.min(1, miningProgress)})`;
  if (miningProgress >= 1) {
    setBlock(x, y, z, 0, true);
    spawnBreakParticles(x, y, z, block.color);
    playBreak(block.material);
    cancelMining();
    currentTarget = null;
  }
}

function placeBlock() {
  if (!currentTarget) return;
  const [x, y, z] = currentTarget.place;
  const id = HOTBAR_IDS[selectedSlot];
  if (!inBounds(x, y, z)) {
    showToast('Limite deste protótipo atingido.');
    return;
  }
  if (getBlock(x, y, z) || blockIntersectsPlayer(x, y, z)) {
    if (blockIntersectsPlayer(x, y, z)) showToast('Você está ocupando esse espaço.');
    return;
  }
  setBlock(x, y, z, id, true);
  playPlace(BLOCKS[id].material);
}

function spawnBreakParticles(x, y, z, color) {
  for (let i = 0; i < 10; i++) {
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(particleGeometry, material);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2.6,
      1.1 + Math.random() * 2.2,
      (Math.random() - 0.5) * 2.6
    );
    const particle = { mesh, velocity, life: 0.42 + Math.random() * 0.2 };
    particles.push(particle);
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
    const scale = Math.max(0.01, Math.min(1, particle.life / 0.18));
    particle.mesh.scale.setScalar(scale);
    if (particle.life <= 0) {
      particleGroup.remove(particle.mesh);
      particle.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

function renderHotbar() {
  hotbar.innerHTML = '';
  HOTBAR_IDS.forEach((id, index) => {
    const block = BLOCKS[id];
    const slot = document.createElement('div');
    slot.className = `slot${index === selectedSlot ? ' selected' : ''}`;
    const hex = `#${block.color.toString(16).padStart(6, '0')}`;
    slot.innerHTML = `<span class="num">${index + 1}</span><span class="swatch" style="background:${hex}"></span><span class="label">${block.name}</span>`;
    hotbar.appendChild(slot);
  });
}

function renderInventory() {
  inventoryGrid.innerHTML = '';
  HOTBAR_IDS.forEach((id, index) => {
    const block = BLOCKS[id];
    const item = document.createElement('button');
    item.className = 'inv-item';
    const hex = `#${block.color.toString(16).padStart(6, '0')}`;
    item.innerHTML = `<span class="swatch" style="background:${hex}"></span><strong>${block.name}</strong><small>Slot ${index + 1}</small>`;
    item.addEventListener('click', () => {
      selectedSlot = index;
      renderHotbar();
      closeInventory();
      setTimeout(() => controls.lock(), 60);
    });
    inventoryGrid.appendChild(item);
  });
}

function selectSlot(index) {
  if (index < 0 || index >= HOTBAR_IDS.length) return;
  selectedSlot = index;
  renderHotbar();
  showToast(BLOCKS[HOTBAR_IDS[index]].name);
}

function openInventory() {
  if (!controls.isLocked) return;
  inventoryOpen = true;
  controls.unlock();
  menu.classList.remove('visible');
  inventoryPanel.classList.add('visible');
}

function closeInventory() {
  inventoryOpen = false;
  inventoryPanel.classList.remove('visible');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1300);
}

function toggleFlight() {
  flying = !flying;
  PLAYER.velocity.y = 0;
  modeBadge.textContent = flying ? 'VOO CRIATIVO' : 'SOBREVIVÊNCIA';
  modeBadge.classList.toggle('creative', flying);
  playToggleFly(flying);
  showToast(flying ? 'Voo criativo: Espaço sobe · Ctrl desce' : 'Voo desativado');
}

function toggleDebug() {
  debugVisible = !debugVisible;
  stats.classList.toggle('debug-hidden', !debugVisible);
  showToast(debugVisible ? 'Debug visível' : 'Debug oculto');
}

function saveWorld(showMessage = true) {
  if (!ready) return false;
  const data = {
    version: 3,
    seed,
    time: worldTime,
    player: [PLAYER.feet.x, PLAYER.feet.y, PLAYER.feet.z],
    rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z],
    selectedSlot,
    flying,
    edits: [...edits.entries()]
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  if (showMessage) showToast('Mundo salvo no navegador.');
  return true;
}

function loadWorld() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 3 || !Number.isFinite(data.seed)) return false;
    seed = data.seed;
    worldTime = Number.isFinite(data.time) ? data.time : 0.28;
    generateWorld({ autoSave: false });
    edits.clear();
    if (Array.isArray(data.edits)) {
      for (const pair of data.edits) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [key, id] = pair;
        const [x, y, z] = String(key).split(',').map(Number);
        if (!inBounds(x, y, z) || !Number.isInteger(id) || id < 0 || id >= BLOCKS.length) continue;
        setRawBlock(x, y, z, id);
        edits.set(keyOf(x, y, z), id);
      }
      rebuildAllChunks();
    }
    if (Array.isArray(data.player) && data.player.length === 3 && data.player.every(Number.isFinite)) {
      PLAYER.feet.set(...data.player);
      if (collidesAt(PLAYER.feet)) spawnPlayer();
    }
    if (Array.isArray(data.rotation) && data.rotation.length === 3 && data.rotation.every(Number.isFinite)) {
      camera.rotation.set(...data.rotation);
    }
    selectedSlot = Math.max(0, Math.min(HOTBAR_IDS.length - 1, Number(data.selectedSlot) || 0));
    flying = Boolean(data.flying);
    modeBadge.textContent = flying ? 'VOO CRIATIVO' : 'SOBREVIVÊNCIA';
    modeBadge.classList.toggle('creative', flying);
    camera.position.set(PLAYER.feet.x, PLAYER.feet.y + PLAYER.eyeHeight, PLAYER.feet.z);
    renderHotbar();
    status.textContent = `Save carregado · seed ${seed}`;
    return true;
  } catch (error) {
    console.warn('Falha ao carregar save', error);
    return false;
  }
}

function newWorld() {
  seed = randomSeed();
  worldTime = 0.28;
  flying = false;
  localStorage.removeItem(SAVE_KEY);
  generateWorld({ autoSave: true });
  renderHotbar();
  modeBadge.textContent = 'SOBREVIVÊNCIA';
  modeBadge.classList.remove('creative');
  showToast('Novo mundo criado.');
}

function updateSky(dt) {
  worldTime = (worldTime + dt / 240) % 1;
  const angle = worldTime * Math.PI * 2;
  const sunY = Math.sin(angle);
  const sunX = Math.cos(angle);
  sun.position.set(sunX * 45, sunY * 45, 18);
  const daylight = THREE.MathUtils.smoothstep(sunY, -0.12, 0.34);
  const twilight = 1 - Math.min(1, Math.abs(sunY) * 4.2);
  skyCurrent.copy(skyNight).lerp(skyDay, daylight);
  if (twilight > 0 && daylight > 0.1) skyCurrent.lerp(skyDusk, twilight * 0.32);
  scene.background.copy(skyCurrent);
  scene.fog.color.copy(skyCurrent);
  hemi.intensity = 0.18 + daylight * 1.28;
  sun.intensity = Math.max(0, daylight * 2.3);
  for (const cloud of clouds.children) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > WORLD_MAX + 18) cloud.position.x = WORLD_MIN - 18;
  }
}

let frames = 0;
let fpsTime = 0;
function updateStats(dt) {
  frames++;
  fpsTime += dt;
  if (fpsTime < 0.5) return;
  const fps = Math.round(frames / fpsTime);
  const chunkX = Math.floor(PLAYER.feet.x / CHUNK_SIZE);
  const chunkZ = Math.floor(PLAYER.feet.z / CHUNK_SIZE);
  stats.textContent = `FPS ${fps} · XYZ ${PLAYER.feet.x.toFixed(1)} / ${PLAYER.feet.y.toFixed(1)} / ${PLAYER.feet.z.toFixed(1)} · chunk ${chunkX},${chunkZ} · seed ${seed} · ${flying ? 'FLY' : 'WALK'}`;
  frames = 0;
  fpsTime = 0;
}

let last = performance.now();
function animate(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  updatePlayer(dt);
  updateTarget();
  updateMining(dt);
  updateParticles(dt);
  updateSky(dt);
  updateStats(dt);
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
    if (index >= 0 && index < HOTBAR_IDS.length) selectSlot(index);
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
  if (event.button === 0) startMining();
  if (event.button === 2) placeBlock();
});
renderer.domElement.addEventListener('mouseup', (event) => {
  if (event.button === 0) cancelMining();
});
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

addEventListener('wheel', (event) => {
  if (!controls.isLocked) return;
  selectedSlot = (selectedSlot + (event.deltaY > 0 ? 1 : -1) + HOTBAR_IDS.length) % HOTBAR_IDS.length;
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
if (!loadWorld()) {
  seed = randomSeed();
  generateWorld({ autoSave: true });
}
