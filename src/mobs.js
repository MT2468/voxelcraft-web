import * as THREE from 'three';
import { ITEM } from './survival.js';

const sharedGeometry = {
  head: new THREE.BoxGeometry(0.62, 0.62, 0.62),
  body: new THREE.BoxGeometry(0.72, 0.9, 0.42),
  skeletonBody: new THREE.BoxGeometry(0.48, 0.82, 0.3),
  limb: new THREE.BoxGeometry(0.23, 0.72, 0.23),
  animalBody: new THREE.BoxGeometry(0.95, 0.62, 0.52),
  animalHead: new THREE.BoxGeometry(0.55, 0.5, 0.5),
  snout: new THREE.BoxGeometry(0.25, 0.2, 0.3),
  chickenBody: new THREE.BoxGeometry(0.62, 0.58, 0.55),
  chickenHead: new THREE.BoxGeometry(0.42, 0.42, 0.42),
  beak: new THREE.BoxGeometry(0.22, 0.15, 0.28),
  wattle: new THREE.BoxGeometry(0.12, 0.18, 0.12),
  chickenLeg: new THREE.BoxGeometry(0.1, 0.36, 0.1)
};

const VALID_TYPES = new Set(['pig', 'cow', 'chicken', 'zombie', 'skeleton']);

export class MobSystem {
  constructor(scene, options) {
    this.scene = scene;
    this.surfaceY = options.surfaceY;
    this.isWalkable = options.isWalkable;
    this.worldTime = options.worldTime;
    this.onAttackPlayer = options.onAttackPlayer;
    this.onDrops = options.onDrops;
    this.random = options.random || Math.random;
    this.mobs = [];
    this.nextId = 1;
    this.spawnTimer = 0;
    this.maxMobs = 16;
    this.raycastTargets = [];
  }

  clear() {
    for (const mob of this.mobs) this.disposeMob(mob);
    this.mobs.length = 0;
    this.raycastTargets.length = 0;
  }

  update(dt, playerPosition, daylight) {
    if (typeof document !== 'undefined' && document.pointerLockElement == null) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.2;
      this.trySpawn(playerPosition, daylight);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      mob.hurtTimer = Math.max(0, mob.hurtTimer - dt);
      mob.attackTimer = Math.max(0, mob.attackTimer - dt);
      mob.wanderTimer -= dt;
      mob.life += dt;

      const dx = playerPosition.x - mob.group.position.x;
      const dz = playerPosition.z - mob.group.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance > 48) {
        this.removeMob(i);
        continue;
      }

      if (mob.hostile) {
        if (daylight > 0.76 && mob.life > 8 && distance > 12) {
          this.removeMob(i);
          continue;
        }
        if (mob.type === 'skeleton') this.updateSkeleton(mob, dx, dz, distance);
        else this.updateZombie(mob, dx, dz, distance);
      } else {
        this.updatePassive(mob, dx, dz, distance);
      }

      this.moveMob(mob, dt);
      this.animateMob(mob, dt);
    }
  }

  updateZombie(mob, dx, dz, distance) {
    if (distance < 15) {
      mob.direction.set(dx, 0, dz).normalize();
      mob.speed = 1.78;
      if (distance < 1.3 && mob.attackTimer <= 0) {
        mob.attackTimer = 1.05;
        this.onAttackPlayer?.(2, 'zombie');
      }
    } else {
      this.updateWander(mob);
    }
  }

  updateSkeleton(mob, dx, dz, distance) {
    if (distance < 16) {
      if (distance < 4.5) mob.direction.set(-dx, 0, -dz).normalize();
      else if (distance > 8) mob.direction.set(dx, 0, dz).normalize();
      else mob.direction.set(-dz, 0, dx).normalize();
      mob.speed = 1.35;
      mob.group.rotation.y = Math.atan2(dx, dz);
      if (distance < 10 && mob.attackTimer <= 0) {
        mob.attackTimer = 1.65;
        this.onAttackPlayer?.(2, 'skeleton');
      }
    } else {
      this.updateWander(mob);
    }
  }

  updatePassive(mob, dx, dz, distance) {
    const scareDistance = mob.type === 'chicken' ? 2.8 : 3.5;
    if (distance < scareDistance) {
      mob.direction.set(-dx, 0, -dz).normalize();
      mob.speed = mob.type === 'chicken' ? 1.9 : 1.7;
    } else {
      this.updateWander(mob);
    }
  }

  trySpawn(player, daylight) {
    if (this.mobs.length >= this.maxMobs) return false;
    const hostileNight = daylight < 0.43;
    let type;
    if (hostileNight && this.random() < 0.76) {
      type = this.random() < 0.34 ? 'skeleton' : 'zombie';
    } else {
      const roll = this.random();
      type = roll < 0.42 ? 'pig' : roll < 0.77 ? 'cow' : 'chicken';
    }

    const angle = this.random() * Math.PI * 2;
    const radius = 12 + this.random() * 17;
    const x = Math.floor(player.x + Math.cos(angle) * radius) + 0.5;
    const z = Math.floor(player.z + Math.sin(angle) * radius) + 0.5;
    const y = this.surfaceY(x, z);
    if (!Number.isFinite(y) || y < 1 || !this.isWalkable(x, y, z)) return false;
    this.spawn(type, x, y, z);
    return true;
  }

  spawn(type, x, y, z) {
    let mob;
    if (type === 'zombie') mob = createZombie(this.nextId++);
    else if (type === 'skeleton') mob = createSkeleton(this.nextId++);
    else if (type === 'cow') mob = createCow(this.nextId++);
    else if (type === 'chicken') mob = createChicken(this.nextId++);
    else mob = createPig(this.nextId++);

    mob.group.position.set(x, y, z);
    mob.direction.set(Math.cos(this.random() * Math.PI * 2), 0, Math.sin(this.random() * Math.PI * 2));
    mob.wanderTimer = 0.5 + this.random() * 2;
    this.scene.add(mob.group);
    this.mobs.push(mob);
    this.refreshTargets();
    return mob;
  }

  updateWander(mob) {
    if (mob.wanderTimer > 0) return;
    mob.wanderTimer = 1.2 + this.random() * 3.8;
    const angle = this.random() * Math.PI * 2;
    if (this.random() < 0.3) {
      mob.direction.set(0, 0, 0);
      return;
    }
    mob.direction.set(Math.cos(angle), 0, Math.sin(angle));
    mob.speed = mob.hostile ? 1.05 : mob.type === 'chicken' ? 1 : 0.7 + this.random() * 0.45;
  }

  moveMob(mob, dt) {
    if (mob.direction.lengthSq() < 0.01) return;
    const current = mob.group.position;
    const nx = current.x + mob.direction.x * mob.speed * dt;
    const nz = current.z + mob.direction.z * mob.speed * dt;
    const ny = this.surfaceY(nx, nz);
    if (!Number.isFinite(ny) || Math.abs(ny - current.y) > 1.05 || !this.isWalkable(nx, ny, nz)) {
      mob.wanderTimer = 0;
      mob.direction.multiplyScalar(-1);
      return;
    }
    current.x = nx;
    current.z = nz;
    current.y = THREE.MathUtils.lerp(current.y, ny, Math.min(1, dt * 10));
    if (mob.type !== 'skeleton' || mob.attackTimer <= 0) mob.group.rotation.y = Math.atan2(mob.direction.x, mob.direction.z);
  }

  animateMob(mob, dt) {
    mob.walkPhase += dt * Math.max(0.3, mob.speed) * 8;
    const swing = Math.sin(mob.walkPhase) * 0.6;
    if (mob.legs?.length) {
      mob.legs[0].rotation.x = swing;
      mob.legs[1].rotation.x = -swing;
      if (mob.legs[2]) mob.legs[2].rotation.x = -swing;
      if (mob.legs[3]) mob.legs[3].rotation.x = swing;
    }
    if (mob.arms?.length) {
      if (mob.type === 'skeleton' && mob.attackTimer > 1.25) {
        mob.arms[0].rotation.x = -1.25;
        mob.arms[1].rotation.x = -1.1;
      } else {
        mob.arms[0].rotation.x = -swing * 0.75 - 0.25;
        mob.arms[1].rotation.x = swing * 0.75 - 0.25;
      }
    }
    const hurt = mob.hurtTimer > 0;
    for (const material of mob.materials) material.emissive?.setHex(hurt ? 0x5a0000 : 0x000000);
  }

  raycast(raycaster, origin, direction, reach = 4.2) {
    raycaster.far = reach;
    raycaster.set(origin, direction);
    const hits = raycaster.intersectObjects(this.raycastTargets, false);
    if (!hits.length) return null;
    const id = hits[0].object.userData.mobId;
    const mob = this.mobs.find((candidate) => candidate.id === id);
    return mob ? { mob, hit: hits[0] } : null;
  }

  attack(mob, damage, knockbackFrom = null) {
    if (!mob || mob.health <= 0 || !Number.isFinite(damage) || damage <= 0) return null;
    mob.health -= damage;
    mob.hurtTimer = 0.25;
    if (knockbackFrom) {
      const dx = mob.group.position.x - knockbackFrom.x;
      const dz = mob.group.position.z - knockbackFrom.z;
      const len = Math.hypot(dx, dz) || 1;
      mob.group.position.x += (dx / len) * 0.55;
      mob.group.position.z += (dz / len) * 0.55;
    }
    if (mob.health > 0) return { killed: false, mob };
    const index = this.mobs.indexOf(mob);
    const drops = this.dropsFor(mob.type);
    const position = mob.group.position.clone();
    if (index >= 0) this.removeMob(index);
    if (drops.length) this.onDrops?.(drops, position);
    return { killed: true, mob, drops };
  }

  dropsFor(type) {
    if (type === 'pig') return [{ id: ITEM.RAW_PORK, amount: 1 + Math.floor(this.random() * 3) }];
    if (type === 'cow') return [{ id: ITEM.RAW_BEEF, amount: 1 + Math.floor(this.random() * 3) }];
    if (type === 'chicken') return [{ id: ITEM.RAW_CHICKEN, amount: 1 }];
    if (type === 'skeleton') return [{ id: ITEM.BONE, amount: 1 + Math.floor(this.random() * 2) }];
    if (type === 'zombie') {
      const drops = [{ id: ITEM.ROTTEN_FLESH, amount: 1 + Math.floor(this.random() * 2) }];
      if (this.random() < 0.1) drops.push({ id: ITEM.IRON_INGOT, amount: 1 });
      return drops;
    }
    return [];
  }

  serialize() {
    return this.mobs.map((mob) => ({
      type: mob.type,
      x: mob.group.position.x,
      y: mob.group.position.y,
      z: mob.group.position.z,
      health: mob.health
    })).slice(0, this.maxMobs);
  }

  load(data) {
    if (!Array.isArray(data)) return;
    this.clear();
    for (const entry of data.slice(0, this.maxMobs)) {
      if (!entry || !VALID_TYPES.has(entry.type)) continue;
      if (![entry.x, entry.y, entry.z].every(Number.isFinite)) continue;
      const mob = this.spawn(entry.type, entry.x, entry.y, entry.z);
      mob.health = Math.max(1, Math.min(mob.maxHealth, Number(entry.health) || mob.maxHealth));
    }
  }

  removeMob(index) {
    const mob = this.mobs[index];
    if (!mob) return;
    this.disposeMob(mob);
    this.mobs.splice(index, 1);
    this.refreshTargets();
  }

  disposeMob(mob) {
    this.scene.remove(mob.group);
    for (const material of mob.materials) material.dispose();
  }

  refreshTargets() {
    this.raycastTargets = [];
    for (const mob of this.mobs) {
      mob.group.traverse((object) => {
        if (object.isMesh) this.raycastTargets.push(object);
      });
    }
  }
}

function baseMob(id, type, group, materials, health, speed, extras = {}) {
  return {
    id,
    type,
    group,
    materials,
    health,
    maxHealth: health,
    direction: new THREE.Vector3(),
    wanderTimer: 0,
    attackTimer: 0,
    hurtTimer: 0,
    walkPhase: 0,
    speed,
    life: 0,
    hostile: false,
    arms: [],
    legs: [],
    ...extras
  };
}

function createZombie(id) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0x5d8e4f });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x3e7675 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x454f78 });
  const materials = [skin, shirt, pants];
  const head = part(sharedGeometry.head, skin, 0, 1.72, 0, id);
  const body = part(sharedGeometry.body, shirt, 0, 0.97, 0, id);
  const leftArm = part(sharedGeometry.limb, skin, -0.49, 1.05, -0.22, id);
  const rightArm = part(sharedGeometry.limb, skin, 0.49, 1.05, -0.22, id);
  const leftLeg = part(sharedGeometry.limb, pants, -0.2, 0.36, 0, id);
  const rightLeg = part(sharedGeometry.limb, pants, 0.2, 0.36, 0, id);
  leftArm.rotation.x = rightArm.rotation.x = -0.5;
  group.add(head, body, leftArm, rightArm, leftLeg, rightLeg);
  return baseMob(id, 'zombie', group, materials, 20, 1.1, { hostile: true, arms: [leftArm, rightArm], legs: [leftLeg, rightLeg] });
}

function createSkeleton(id) {
  const group = new THREE.Group();
  const bone = new THREE.MeshLambertMaterial({ color: 0xd6d4c8 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x74756f });
  const materials = [bone, dark];
  const head = part(sharedGeometry.head, bone, 0, 1.72, 0, id);
  const body = part(sharedGeometry.skeletonBody, dark, 0, 1.0, 0, id);
  const leftArm = part(sharedGeometry.limb, bone, -0.4, 1.08, 0, id);
  const rightArm = part(sharedGeometry.limb, bone, 0.4, 1.08, 0, id);
  const leftLeg = part(sharedGeometry.limb, bone, -0.16, 0.36, 0, id);
  const rightLeg = part(sharedGeometry.limb, bone, 0.16, 0.36, 0, id);
  group.add(head, body, leftArm, rightArm, leftLeg, rightLeg);
  return baseMob(id, 'skeleton', group, materials, 16, 1.05, { hostile: true, arms: [leftArm, rightArm], legs: [leftLeg, rightLeg] });
}

function createPig(id) {
  const group = new THREE.Group();
  const pink = new THREE.MeshLambertMaterial({ color: 0xd9868c });
  const snoutMat = new THREE.MeshLambertMaterial({ color: 0xc46e79 });
  const materials = [pink, snoutMat];
  const body = part(sharedGeometry.animalBody, pink, 0, 0.64, 0, id);
  const head = part(sharedGeometry.animalHead, pink, 0, 0.76, 0.49, id);
  const snout = part(sharedGeometry.snout, snoutMat, 0, 0.7, 0.77, id);
  const legs = animalLegs(pink, id);
  group.add(body, head, snout, ...legs);
  return baseMob(id, 'pig', group, materials, 10, 0.8, { legs });
}

function createCow(id) {
  const group = new THREE.Group();
  const brown = new THREE.MeshLambertMaterial({ color: 0x6a4730 });
  const cream = new THREE.MeshLambertMaterial({ color: 0xd9c4a0 });
  const materials = [brown, cream];
  const body = part(sharedGeometry.animalBody, brown, 0, 0.68, 0, id);
  body.scale.set(1.08, 1.05, 1.05);
  const head = part(sharedGeometry.animalHead, brown, 0, 0.84, 0.51, id);
  const muzzle = part(sharedGeometry.snout, cream, 0, 0.76, 0.79, id);
  const legs = animalLegs(brown, id);
  group.add(body, head, muzzle, ...legs);
  return baseMob(id, 'cow', group, materials, 14, 0.72, { legs });
}

function createChicken(id) {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf1eee1 });
  const yellow = new THREE.MeshLambertMaterial({ color: 0xe8bb48 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc63838 });
  const materials = [white, yellow, red];
  const body = part(sharedGeometry.chickenBody, white, 0, 0.55, 0, id);
  const head = part(sharedGeometry.chickenHead, white, 0, 0.95, 0.24, id);
  const beak = part(sharedGeometry.beak, yellow, 0, 0.94, 0.55, id);
  const wattle = part(sharedGeometry.wattle, red, 0, 0.78, 0.49, id);
  const leftLeg = part(sharedGeometry.chickenLeg, yellow, -0.15, 0.2, 0, id);
  const rightLeg = part(sharedGeometry.chickenLeg, yellow, 0.15, 0.2, 0, id);
  group.add(body, head, beak, wattle, leftLeg, rightLeg);
  return baseMob(id, 'chicken', group, materials, 6, 1, { legs: [leftLeg, rightLeg] });
}

function animalLegs(material, id) {
  return [
    part(sharedGeometry.limb, material, -0.32, 0.25, 0.2, id),
    part(sharedGeometry.limb, material, 0.32, 0.25, 0.2, id),
    part(sharedGeometry.limb, material, -0.32, 0.25, -0.2, id),
    part(sharedGeometry.limb, material, 0.32, 0.25, -0.2, id)
  ];
}

function part(geometry, material, x, y, z, mobId) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.userData.mobId = mobId;
  return mesh;
}
