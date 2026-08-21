import * as THREE from 'three';

const sharedGeometry = {
  head: new THREE.BoxGeometry(0.62, 0.62, 0.62),
  body: new THREE.BoxGeometry(0.72, 0.9, 0.42),
  limb: new THREE.BoxGeometry(0.23, 0.72, 0.23),
  pigBody: new THREE.BoxGeometry(0.95, 0.62, 0.52),
  pigHead: new THREE.BoxGeometry(0.55, 0.5, 0.5),
  snout: new THREE.BoxGeometry(0.25, 0.2, 0.3)
};

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
    this.attackCooldown = 0;
    this.maxMobs = 12;
    this.raycastTargets = [];
  }

  clear() {
    for (const mob of this.mobs) this.scene.remove(mob.group);
    this.mobs.length = 0;
    this.raycastTargets.length = 0;
  }

  update(dt, playerPosition, daylight) {
    this.spawnTimer -= dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
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

      if (distance > 42) {
        this.removeMob(i);
        continue;
      }

      if (mob.type === 'zombie') {
        if (daylight > 0.72 && mob.life > 8 && distance > 12) {
          this.removeMob(i);
          continue;
        }
        if (distance < 14) {
          mob.direction.set(dx, 0, dz).normalize();
          mob.speed = 1.75;
          if (distance < 1.28 && mob.attackTimer <= 0) {
            mob.attackTimer = 1.05;
            this.onAttackPlayer?.(2, 'zombie');
          }
        } else {
          this.updateWander(mob);
        }
      } else {
        if (distance < 3.5) {
          mob.direction.set(-dx, 0, -dz).normalize();
          mob.speed = 1.75;
        } else {
          this.updateWander(mob);
        }
      }

      this.moveMob(mob, dt);
      this.animateMob(mob, dt);
    }
  }

  trySpawn(player, daylight) {
    if (this.mobs.length >= this.maxMobs) return false;
    const hostile = daylight < 0.42;
    const type = hostile && this.random() < 0.7 ? 'zombie' : 'pig';
    const angle = this.random() * Math.PI * 2;
    const radius = 12 + this.random() * 15;
    const x = Math.floor(player.x + Math.cos(angle) * radius) + 0.5;
    const z = Math.floor(player.z + Math.sin(angle) * radius) + 0.5;
    const y = this.surfaceY(x, z);
    if (!Number.isFinite(y) || y < 1 || !this.isWalkable(x, y, z)) return false;
    this.spawn(type, x, y, z);
    return true;
  }

  spawn(type, x, y, z) {
    const mob = type === 'zombie' ? createZombie(this.nextId++) : createPig(this.nextId++);
    mob.group.position.set(x, y, z);
    mob.direction.set(Math.cos(this.random() * Math.PI * 2), 0, Math.sin(this.random() * Math.PI * 2));
    mob.wanderTimer = 0.5 + this.random() * 2;
    mob.speed = type === 'zombie' ? 1.15 : 0.85;
    this.scene.add(mob.group);
    this.mobs.push(mob);
    this.refreshTargets();
    return mob;
  }

  updateWander(mob) {
    if (mob.wanderTimer > 0) return;
    mob.wanderTimer = 1.2 + this.random() * 3.5;
    const angle = this.random() * Math.PI * 2;
    if (this.random() < 0.3) {
      mob.direction.set(0, 0, 0);
      return;
    }
    mob.direction.set(Math.cos(angle), 0, Math.sin(angle));
    mob.speed = mob.type === 'zombie' ? 1.1 : 0.75 + this.random() * 0.45;
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
    mob.group.rotation.y = Math.atan2(mob.direction.x, mob.direction.z);
  }

  animateMob(mob, dt) {
    mob.walkPhase += dt * mob.speed * 8;
    const swing = Math.sin(mob.walkPhase) * 0.6;
    if (mob.legs?.length) {
      mob.legs[0].rotation.x = swing;
      mob.legs[1].rotation.x = -swing;
      if (mob.legs[2]) mob.legs[2].rotation.x = -swing;
      if (mob.legs[3]) mob.legs[3].rotation.x = swing;
    }
    if (mob.arms?.length) {
      mob.arms[0].rotation.x = -swing * 0.75 - 0.25;
      mob.arms[1].rotation.x = swing * 0.75 - 0.25;
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
    const drops = mob.type === 'pig'
      ? [{ id: 107, amount: 1 + Math.floor(this.random() * 3) }]
      : this.random() < 0.18 ? [{ id: 101, amount: 1 }] : [];
    const position = mob.group.position.clone();
    if (index >= 0) this.removeMob(index);
    if (drops.length) this.onDrops?.(drops, position);
    return { killed: true, mob, drops };
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
      if (!entry || !['pig', 'zombie'].includes(entry.type)) continue;
      if (![entry.x, entry.y, entry.z].every(Number.isFinite)) continue;
      const mob = this.spawn(entry.type, entry.x, entry.y, entry.z);
      mob.health = Math.max(1, Math.min(mob.maxHealth, Number(entry.health) || mob.maxHealth));
    }
  }

  removeMob(index) {
    const mob = this.mobs[index];
    if (!mob) return;
    this.scene.remove(mob.group);
    this.mobs.splice(index, 1);
    this.refreshTargets();
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
  return {
    id,
    type: 'zombie',
    group,
    materials,
    health: 20,
    maxHealth: 20,
    direction: new THREE.Vector3(),
    wanderTimer: 0,
    attackTimer: 0,
    hurtTimer: 0,
    walkPhase: 0,
    speed: 1.1,
    life: 0,
    arms: [leftArm, rightArm],
    legs: [leftLeg, rightLeg]
  };
}

function createPig(id) {
  const group = new THREE.Group();
  const pink = new THREE.MeshLambertMaterial({ color: 0xd9868c });
  const snoutMat = new THREE.MeshLambertMaterial({ color: 0xc46e79 });
  const materials = [pink, snoutMat];
  const body = part(sharedGeometry.pigBody, pink, 0, 0.64, 0, id);
  const head = part(sharedGeometry.pigHead, pink, 0, 0.76, 0.49, id);
  const snout = part(sharedGeometry.snout, snoutMat, 0, 0.7, 0.77, id);
  const legs = [
    part(sharedGeometry.limb, pink, -0.32, 0.25, 0.2, id),
    part(sharedGeometry.limb, pink, 0.32, 0.25, 0.2, id),
    part(sharedGeometry.limb, pink, -0.32, 0.25, -0.2, id),
    part(sharedGeometry.limb, pink, 0.32, 0.25, -0.2, id)
  ];
  group.add(body, head, snout, ...legs);
  return {
    id,
    type: 'pig',
    group,
    materials,
    health: 10,
    maxHealth: 10,
    direction: new THREE.Vector3(),
    wanderTimer: 0,
    attackTimer: 0,
    hurtTimer: 0,
    walkPhase: 0,
    speed: 0.8,
    life: 0,
    arms: [],
    legs
  };
}

function part(geometry, material, x, y, z, mobId) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.userData.mobId = mobId;
  return mesh;
}
