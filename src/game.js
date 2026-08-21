import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const canvas = document.querySelector('#game');
const menu = document.querySelector('#menu');
const inventoryPanel = document.querySelector('#inventory');
const playButton = document.querySelector('#playButton');
const newWorldButton = document.querySelector('#newWorldButton');
const saveButton = document.querySelector('#saveButton');
const closeInventoryButton = document.querySelector('#closeInventory');
const hud = document.querySelector('#hud');
const hotbar = document.querySelector('#hotbar');
const inventoryGrid = document.querySelector('#inventoryGrid');
const stats = document.querySelector('#stats');
const status = document.querySelector('#status');
const toast = document.querySelector('#toast');

const CHUNK_SIZE = 16;
const WORLD_RADIUS = 2;
const WORLD_MIN = -WORLD_RADIUS * CHUNK_SIZE;
const WORLD_MAX = WORLD_RADIUS * CHUNK_SIZE - 1;
const MAX_BUILD_Y = 31;
const REACH = 6;
const SAVE_KEY = 'voxelcraft-web-save-v2';

const BLOCKS = [
  null,
  { id: 1, name: 'Grama', color: 0x6da943, side: 0x80613f },
  { id: 2, name: 'Terra', color: 0x855f3b },
  { id: 3, name: 'Pedra', color: 0x858585 },
  { id: 4, name: 'Areia', color: 0xd8c685 },
  { id: 5, name: 'Madeira', color: 0x8c633b, top: 0xb38a59 },
  { id: 6, name: 'Folhas', color: 0x3d8439 },
  { id: 7, name: 'Pedregulho', color: 0x6e6e6e },
  { id: 8, name: 'Tábuas', color: 0xb28754 },
  { id: 9, name: 'Neve', color: 0xe8f2f2, side: 0xc7d4d4 }
];
const HOTBAR_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
let selectedSlot = 0;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7eb5e6);
scene.fog = new THREE.Fog(0x7eb5e6, 28, 72);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 160);
const controls = new PointerLockControls(camera, renderer.domElement);

const hemi = new THREE.HemisphereLight(0xbfe2ff, 0x4b432f, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0c7, 2.2);
sun.position.set(20, 40, 10);
scene.add(sun);

const worldMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const world = new Map();
const chunkMeshes = new Map();
const edits = new Map();
let seed = 1;
let worldTime = 0.28;
let inventoryOpen = false;
let ready = false;

const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const rayDirection = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();
let currentTarget = null;

const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
  new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.82 })
);
outline.visible = false;
outline.renderOrder = 5;
scene.add(outline);

const PLAYER = {
  feet: new THREE.Vector3(0.5, 20, 0.5),
  velocity: new THREE.Vector3(),
  halfWidth: 0.3,
  height: 1.8,
  eyeHeight: 1.62,
  onGround: false
};
const keys = new Set();
let jumpQueued = false;

const skyDay = new THREE.Color(0x7eb5e6);
const skyDusk = new THREE.Color(0xa76b69);
const skyNight = new THREE.Color(0x09111f);
const skyCurrent = new THREE.Color();

const clouds = new THREE.Group();
scene.add(clouds);

function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function inBounds(x, y, z) {
  return x >= WORLD_MIN && x <= WORLD_MAX && z >= WORLD_MIN && z <= WORLD_MAX && y >= 0 && y <= MAX_BUILD_Y;
}

function getBlock(x, y, z) {
  if (!inBounds(x, y, z)) return 0;
  return world.get(keyOf(x, y, z)) || 0;
}

function setRawBlock(x, y, z, id) {
  const key = keyOf(x, y, z);
  if (id) world.set(key, id);
  else world.delete(key);
}

function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

function hash2(x, z, salt = 0) {
  let n = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed + salt, 1442695041)) | 0;
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, z, scale, salt = 0) {
  const fx = x * scale;
  const fz = z * scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = smoothstep(fx - x0);
  const tz = smoothstep(fz - z0);
  const a = hash2(x0, z0, salt);
  const b = hash2(x0 + 1, z0, salt);
  const c = hash2(x0, z0 + 1, salt);
  const d = hash2(x0 + 1, z0 + 1, salt);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), tz);
}

function terrainHeight(x, z) {
  const broad = valueNoise(x, z, 0.04, 11);
  const detail = valueNoise(x, z, 0.11, 37);
  const ridge = Math.abs(valueNoise(x, z, 0.022, 71) - 0.5) * 2;
  return Math.max(3, Math.min(20, Math.floor(5 + broad * 9 + detail * 3 + ridge * 2)));
}

function biomeAt(x, z) {
  const temperature = valueNoise(x + 700, z - 400, 0.012, 97);
  if (temperature > 0.69) return 'desert';
  if (temperature < 0.24) return 'snow';
  return 'plains';
}

function generateWorld() {
  world.clear();
  edits.clear();
  disposeChunks();
  status.textContent = `Gerando mundo · seed ${seed}…`;

  for (let x = WORLD_MIN; x <= WORLD_MAX; x++) {
    for (let z = WORLD_MIN; z <= WORLD_MAX; z++) {
      const h = terrainHeight(x, z);
      const biome = biomeAt(x, z);
      for (let y = 0; y <= h; y++) {
        let id = 3;
        if (y === h) id = biome === 'desert' ? 4 : biome === 'snow' ? 9 : 1;
        else if (y >= h - 3) id = biome === 'desert' ? 4 : 2;
        setRawBlock(x, y, z, id);
      }
    }
  }

  for (let x = WORLD_MIN + 2; x <= WORLD_MAX - 2; x++) {
    for (let z = WORLD_MIN + 2; z <= WORLD_MAX - 2; z++) {
      if (biomeAt(x, z) !== 'plains') continue;
      if (hash2(x, z, 123) < 0.986) continue;
      const y = terrainHeight(x, z) + 1;
      if (getBlock(x, y - 1, z) !== 1) continue;
      const trunk = 3 + Math.floor(hash2(x, z, 321) * 2);
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
            if (!getBlock(bx, by, bz)) setRawBlock(bx, by, bz, 6);
          }
        }
      }
    }
  }

  rebuildAllChunks();
  createClouds();
  spawnPlayer();
  ready = true;
  status.textContent = `Mundo pronto · seed ${seed}`;
  saveWorld(false);
}

function disposeChunks() {
  for (const mesh of chunkMeshes.values()) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  chunkMeshes.clear();
}

const FACES = [
  { dir: [1, 0, 0], shade: 0.83, corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { dir: [-1, 0, 0], shade: 0.72, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { dir: [0, -1, 0], shade: 0.55, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { dir: [0, 0, 1], shade: 0.9, corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { dir: [0, 0, -1], shade: 0.77, corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }
];

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
  geometry.computeBoundingSphere();
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
  const geometry = buildChunkGeometry(cx, cz);
  const mesh = new THREE.Mesh(geometry, worldMaterial);
  mesh.userData.chunk = { cx, cz };
  mesh.receiveShadow = true;
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

function createClouds() {
  clouds.clear();
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: false });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 18; i++) {
    const cloud = new THREE.Group();
    const pieces = 2 + Math.floor(hash2(i, 0, 901) * 4);
    for (let p = 0; p < pieces; p++) {
      const part = new THREE.Mesh(geo, material);
      part.scale.set(3 + hash2(i, p, 902) * 6, 0.55 + hash2(i, p, 903) * 0.6, 2 + hash2(i, p, 904) * 4);
      part.position.set(p * 3.2, hash2(i, p, 905) * 0.3, (hash2(i, p, 906) - 0.5) * 2.5);
      cloud.add(part);
    }
    cloud.position.set(WORLD_MIN + hash2(i, 4, 907) * (WORLD_MAX - WORLD_MIN), 23 + hash2(i, 5, 908) * 4, WORLD_MIN + hash2(i, 6, 909) * (WORLD_MAX - WORLD_MIN));
    cloud.userData.speed = 0.3 + hash2(i, 7, 910) * 0.2;
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

  const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 7.2 : 4.5;
  const accel = PLAYER.onGround ? 18 : 5.5;
  const blend = Math.min(1, accel * dt);
  PLAYER.velocity.x = THREE.MathUtils.lerp(PLAYER.velocity.x, wish.x * speed, blend);
  PLAYER.velocity.z = THREE.MathUtils.lerp(PLAYER.velocity.z, wish.z * speed, blend);

  if (jumpQueued && PLAYER.onGround) {
    PLAYER.velocity.y = 7.3;
    PLAYER.onGround = false;
  }
  jumpQueued = false;
  PLAYER.velocity.y = Math.max(-30, PLAYER.velocity.y - 20.5 * dt);

  const travel = Math.max(Math.abs(PLAYER.velocity.x * dt), Math.abs(PLAYER.velocity.y * dt), Math.abs(PLAYER.velocity.z * dt));
  const steps = Math.max(1, Math.ceil(travel / 0.16));
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    PLAYER.onGround = false;
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
      if (PLAYER.velocity.y < 0) PLAYER.onGround = true;
      PLAYER.velocity.y = 0;
    }
  }

  const groundProbe = PLAYER.feet.clone();
  groundProbe.y -= 0.035;
  if (collidesAt(groundProbe)) PLAYER.onGround = true;

  if (PLAYER.feet.y < -8) {
    spawnPlayer();
    showToast('Você caiu do mundo e reapareceu.');
  }

  camera.position.set(PLAYER.feet.x, PLAYER.feet.y + PLAYER.eyeHeight, PLAYER.feet.z);
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
    return;
  }
  currentTarget = targetBlock();
  if (!currentTarget) {
    outline.visible = false;
    return;
  }
  const [x, y, z] = currentTarget.remove;
  outline.visible = true;
  outline.position.set(x + 0.5, y + 0.5, z + 0.5);
}

function breakBlock() {
  if (!currentTarget) return;
  const [x, y, z] = currentTarget.remove;
  if (y <= 0) {
    showToast('A camada mais profunda não pode ser quebrada.');
    return;
  }
  if (getBlock(x, y, z)) setBlock(x, y, z, 0, true);
}

function placeBlock() {
  if (!currentTarget) return;
  const [x, y, z] = currentTarget.place;
  const id = HOTBAR_IDS[selectedSlot];
  if (!inBounds(x, y, z)) {
    showToast('Limite deste protótipo atingido.');
    return;
  }
  if (getBlock(x, y, z)) return;
  if (blockIntersectsPlayer(x, y, z)) {
    showToast('Você está ocupando esse espaço.');
    return;
  }
  setBlock(x, y, z, id, true);
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

function saveWorld(showMessage = true) {
  if (!ready && showMessage) return;
  const data = {
    version: 2,
    seed,
    time: worldTime,
    player: [PLAYER.feet.x, PLAYER.feet.y, PLAYER.feet.z],
    yaw: camera.rotation.y,
    selectedSlot,
    edits: [...edits.entries()]
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  if (showMessage) showToast('Mundo salvo no navegador.');
}

function loadWorld() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 2 || !Number.isFinite(data.seed)) return false;
    seed = data.seed;
    worldTime = Number.isFinite(data.time) ? data.time : 0.28;
    generateWorld();
    edits.clear();
    if (Array.isArray(data.edits)) {
      for (const pair of data.edits) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [key, id] = pair;
        const [x, y, z] = key.split(',').map(Number);
        if (!inBounds(x, y, z)) continue;
        setRawBlock(x, y, z, id);
        edits.set(key, id);
      }
      rebuildAllChunks();
    }
    if (Array.isArray(data.player) && data.player.length === 3) {
      PLAYER.feet.set(...data.player);
      if (collidesAt(PLAYER.feet)) spawnPlayer();
    }
    selectedSlot = Math.max(0, Math.min(HOTBAR_IDS.length - 1, data.selectedSlot || 0));
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
  localStorage.removeItem(SAVE_KEY);
  generateWorld();
  renderHotbar();
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
  if (fpsTime >= 0.5) {
    stats.textContent = `FPS: ${Math.round(frames / fpsTime)} · X ${PLAYER.feet.x.toFixed(1)} Y ${PLAYER.feet.y.toFixed(1)} Z ${PLAYER.feet.z.toFixed(1)}`;
    frames = 0;
    fpsTime = 0;
  }
}

let last = performance.now();
function animate(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  updatePlayer(dt);
  updateTarget();
  updateSky(dt);
  updateStats(dt);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

controls.addEventListener('lock', () => {
  closeInventory();
  menu.classList.remove('visible');
  hud.classList.remove('hidden');
  hud.setAttribute('aria-hidden', 'false');
});

controls.addEventListener('unlock', () => {
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
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) jumpQueued = true;
  }
  keys.add(event.code);
});

addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('mousedown', (event) => {
  if (!controls.isLocked) return;
  event.preventDefault();
  if (event.button === 0) breakBlock();
  if (event.button === 2) placeBlock();
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
setInterval(() => saveWorld(false), 20_000);

renderHotbar();
renderInventory();
if (!loadWorld()) {
  seed = randomSeed();
  generateWorld();
}
