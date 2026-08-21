export const ITEM = Object.freeze({
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  COBBLE: 7,
  PLANKS: 8,
  SNOW: 9,
  COAL_ORE: 10,
  IRON_ORE: 11,
  GOLD_ORE: 12,
  DIAMOND_ORE: 13,
  BEDROCK: 14,
  WATER: 15,
  STICK: 101,
  WOOD_PICKAXE: 102,
  STONE_PICKAXE: 103,
  IRON_PICKAXE: 104,
  WOOD_SWORD: 105,
  STONE_SWORD: 106,
  RAW_PORK: 107,
  APPLE: 108,
  COAL: 109,
  IRON_INGOT: 110,
  GOLD_INGOT: 111,
  DIAMOND: 112
});

export const ITEM_DEFS = new Map([
  [ITEM.GRASS, { name: 'Grama', kind: 'block', block: ITEM.GRASS }],
  [ITEM.DIRT, { name: 'Terra', kind: 'block', block: ITEM.DIRT }],
  [ITEM.STONE, { name: 'Pedra', kind: 'block', block: ITEM.STONE }],
  [ITEM.SAND, { name: 'Areia', kind: 'block', block: ITEM.SAND }],
  [ITEM.LOG, { name: 'Madeira', kind: 'block', block: ITEM.LOG }],
  [ITEM.LEAVES, { name: 'Folhas', kind: 'block', block: ITEM.LEAVES }],
  [ITEM.COBBLE, { name: 'Pedregulho', kind: 'block', block: ITEM.COBBLE }],
  [ITEM.PLANKS, { name: 'Tábuas', kind: 'block', block: ITEM.PLANKS }],
  [ITEM.SNOW, { name: 'Neve', kind: 'block', block: ITEM.SNOW }],
  [ITEM.COAL_ORE, { name: 'Minério de carvão', kind: 'block', block: ITEM.COAL_ORE }],
  [ITEM.IRON_ORE, { name: 'Minério de ferro', kind: 'block', block: ITEM.IRON_ORE }],
  [ITEM.GOLD_ORE, { name: 'Minério de ouro', kind: 'block', block: ITEM.GOLD_ORE }],
  [ITEM.DIAMOND_ORE, { name: 'Minério de diamante', kind: 'block', block: ITEM.DIAMOND_ORE }],
  [ITEM.STICK, { name: 'Graveto', kind: 'material' }],
  [ITEM.WOOD_PICKAXE, { name: 'Picareta de madeira', kind: 'tool', tool: 'pickaxe', tier: 1, speed: 2.1, damage: 2, durability: 60 }],
  [ITEM.STONE_PICKAXE, { name: 'Picareta de pedra', kind: 'tool', tool: 'pickaxe', tier: 2, speed: 3.1, damage: 3, durability: 132 }],
  [ITEM.IRON_PICKAXE, { name: 'Picareta de ferro', kind: 'tool', tool: 'pickaxe', tier: 3, speed: 4.4, damage: 4, durability: 251 }],
  [ITEM.WOOD_SWORD, { name: 'Espada de madeira', kind: 'tool', tool: 'sword', tier: 1, speed: 1, damage: 4, durability: 60 }],
  [ITEM.STONE_SWORD, { name: 'Espada de pedra', kind: 'tool', tool: 'sword', tier: 2, speed: 1, damage: 5, durability: 132 }],
  [ITEM.RAW_PORK, { name: 'Carne de porco crua', kind: 'food', hunger: 3, saturation: 1.8 }],
  [ITEM.APPLE, { name: 'Maçã', kind: 'food', hunger: 4, saturation: 2.4 }],
  [ITEM.COAL, { name: 'Carvão', kind: 'material' }],
  [ITEM.IRON_INGOT, { name: 'Barra de ferro', kind: 'material' }],
  [ITEM.GOLD_INGOT, { name: 'Barra de ouro', kind: 'material' }],
  [ITEM.DIAMOND, { name: 'Diamante', kind: 'material' }]
]);

export const RECIPES = Object.freeze([
  { id: 'planks', name: '4 Tábuas', inputs: [[ITEM.LOG, 1]], output: [ITEM.PLANKS, 4] },
  { id: 'sticks', name: '4 Gravetos', inputs: [[ITEM.PLANKS, 2]], output: [ITEM.STICK, 4] },
  { id: 'wood-pickaxe', name: 'Picareta de madeira', inputs: [[ITEM.PLANKS, 3], [ITEM.STICK, 2]], output: [ITEM.WOOD_PICKAXE, 1] },
  { id: 'stone-pickaxe', name: 'Picareta de pedra', inputs: [[ITEM.COBBLE, 3], [ITEM.STICK, 2]], output: [ITEM.STONE_PICKAXE, 1] },
  { id: 'wood-sword', name: 'Espada de madeira', inputs: [[ITEM.PLANKS, 2], [ITEM.STICK, 1]], output: [ITEM.WOOD_SWORD, 1] },
  { id: 'stone-sword', name: 'Espada de pedra', inputs: [[ITEM.COBBLE, 2], [ITEM.STICK, 1]], output: [ITEM.STONE_SWORD, 1] },
  { id: 'iron-ingot', name: 'Barra de ferro', inputs: [[ITEM.IRON_ORE, 1], [ITEM.COAL, 1]], output: [ITEM.IRON_INGOT, 1], station: 'furnace' },
  { id: 'gold-ingot', name: 'Barra de ouro', inputs: [[ITEM.GOLD_ORE, 1], [ITEM.COAL, 1]], output: [ITEM.GOLD_INGOT, 1], station: 'furnace' },
  { id: 'iron-pickaxe', name: 'Picareta de ferro', inputs: [[ITEM.IRON_INGOT, 3], [ITEM.STICK, 2]], output: [ITEM.IRON_PICKAXE, 1] }
]);

export class Inventory {
  constructor() {
    this.counts = new Map();
    this.durability = new Map();
    this.hotbar = [ITEM.LOG, ITEM.PLANKS, ITEM.COBBLE, ITEM.DIRT, ITEM.SAND, ITEM.WOOD_PICKAXE, ITEM.STONE_PICKAXE, ITEM.WOOD_SWORD, ITEM.RAW_PORK];
    this.selected = 0;
  }

  count(id) {
    return this.counts.get(id) || 0;
  }

  has(id, amount = 1) {
    return this.count(id) >= amount;
  }

  add(id, amount = 1) {
    if (!ITEM_DEFS.has(id) || !Number.isFinite(amount) || amount <= 0) return false;
    const previous = this.count(id);
    this.counts.set(id, previous + Math.floor(amount));
    const def = ITEM_DEFS.get(id);
    if (def.kind === 'tool' && previous === 0) this.durability.set(id, def.durability);
    return true;
  }

  remove(id, amount = 1) {
    const current = this.count(id);
    if (current < amount || amount <= 0) return false;
    const next = current - Math.floor(amount);
    if (next > 0) this.counts.set(id, next);
    else {
      this.counts.delete(id);
      this.durability.delete(id);
    }
    return true;
  }

  selectedId() {
    return this.hotbar[this.selected] ?? null;
  }

  selectedDef() {
    return ITEM_DEFS.get(this.selectedId()) || null;
  }

  setSelected(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.hotbar.length) return false;
    this.selected = index;
    return true;
  }

  setHotbarSlot(index, id) {
    if (!Number.isInteger(index) || index < 0 || index >= 9 || !ITEM_DEFS.has(id)) return false;
    this.hotbar[index] = id;
    return true;
  }

  canCraft(recipe) {
    return recipe.inputs.every(([id, amount]) => this.has(id, amount));
  }

  craft(recipe) {
    if (!recipe || !this.canCraft(recipe)) return false;
    for (const [id, amount] of recipe.inputs) this.remove(id, amount);
    this.add(recipe.output[0], recipe.output[1]);
    return true;
  }

  damageSelectedTool(amount = 1) {
    const id = this.selectedId();
    const def = ITEM_DEFS.get(id);
    if (!def || def.kind !== 'tool' || !this.has(id)) return false;
    const next = (this.durability.get(id) ?? def.durability) - amount;
    if (next <= 0) {
      this.remove(id, 1);
      if (this.has(id)) this.durability.set(id, def.durability);
      return 'broken';
    }
    this.durability.set(id, next);
    return true;
  }

  serialize() {
    return {
      counts: [...this.counts.entries()],
      durability: [...this.durability.entries()],
      hotbar: [...this.hotbar],
      selected: this.selected
    };
  }

  load(data) {
    if (!data || !Array.isArray(data.counts)) return false;
    this.counts.clear();
    this.durability.clear();
    for (const pair of data.counts) {
      if (!Array.isArray(pair) || pair.length !== 2) continue;
      const [id, count] = pair.map(Number);
      if (!ITEM_DEFS.has(id) || !Number.isFinite(count) || count <= 0) continue;
      this.counts.set(id, Math.floor(count));
    }
    if (Array.isArray(data.durability)) {
      for (const pair of data.durability) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [id, value] = pair.map(Number);
        if (ITEM_DEFS.get(id)?.kind === 'tool' && Number.isFinite(value) && value > 0) this.durability.set(id, value);
      }
    }
    if (Array.isArray(data.hotbar) && data.hotbar.length === 9 && data.hotbar.every((id) => ITEM_DEFS.has(Number(id)))) {
      this.hotbar = data.hotbar.map(Number);
    }
    this.selected = Math.max(0, Math.min(8, Number(data.selected) || 0));
    return true;
  }
}

export class SurvivalState {
  constructor() {
    this.health = 20;
    this.hunger = 20;
    this.saturation = 5;
    this.exhaustion = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.dead = false;
  }

  reset() {
    this.health = 20;
    this.hunger = 20;
    this.saturation = 5;
    this.exhaustion = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.dead = false;
  }

  addExhaustion(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.exhaustion += amount;
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
  }

  takeDamage(amount) {
    if (this.dead || !Number.isFinite(amount) || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
    return true;
  }

  heal(amount) {
    if (this.dead || !Number.isFinite(amount) || amount <= 0) return false;
    this.health = Math.min(20, this.health + amount);
    return true;
  }

  eat(def) {
    if (!def || def.kind !== 'food' || this.hunger >= 20 || this.dead) return false;
    this.hunger = Math.min(20, this.hunger + (def.hunger || 0));
    this.saturation = Math.min(this.hunger, this.saturation + (def.saturation || 0));
    return true;
  }

  update(dt) {
    if (this.dead) return;
    if (this.hunger >= 18 && this.health < 20) {
      this.regenTimer += dt;
      if (this.regenTimer >= 4) {
        this.regenTimer = 0;
        this.heal(1);
        this.addExhaustion(3);
      }
    } else {
      this.regenTimer = 0;
    }

    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) {
        this.starveTimer = 0;
        this.takeDamage(1);
      }
    } else {
      this.starveTimer = 0;
    }
  }

  serialize() {
    return {
      health: this.health,
      hunger: this.hunger,
      saturation: this.saturation,
      exhaustion: this.exhaustion
    };
  }

  load(data) {
    if (!data) return false;
    this.health = clampNumber(data.health, 1, 20, 20);
    this.hunger = clampNumber(data.hunger, 0, 20, 20);
    this.saturation = clampNumber(data.saturation, 0, 20, 5);
    this.exhaustion = clampNumber(data.exhaustion, 0, 4, 0);
    this.dead = false;
    return true;
  }
}

export function miningProfile(block, selectedId) {
  const tool = ITEM_DEFS.get(selectedId);
  const requiredTier = block.requiredTier || 0;
  let speed = 1;
  let harvest = requiredTier === 0;
  if (tool?.tool === 'pickaxe') {
    speed = tool.speed || 1;
    harvest = (tool.tier || 0) >= requiredTier;
  } else if (block.material === 'wood' && tool?.tool === 'sword') {
    speed = 1.35;
  }
  return { speed, harvest, tool };
}

export function blockDrop(blockId, selectedId, random = Math.random) {
  const tool = ITEM_DEFS.get(selectedId);
  switch (blockId) {
    case ITEM.GRASS: return [ITEM.DIRT, 1];
    case ITEM.STONE: return tool?.tool === 'pickaxe' ? [ITEM.COBBLE, 1] : null;
    case ITEM.COAL_ORE: return tool?.tool === 'pickaxe' && tool.tier >= 1 ? [ITEM.COAL, 1] : null;
    case ITEM.IRON_ORE: return tool?.tool === 'pickaxe' && tool.tier >= 2 ? [ITEM.IRON_ORE, 1] : null;
    case ITEM.GOLD_ORE: return tool?.tool === 'pickaxe' && tool.tier >= 3 ? [ITEM.GOLD_ORE, 1] : null;
    case ITEM.DIAMOND_ORE: return tool?.tool === 'pickaxe' && tool.tier >= 3 ? [ITEM.DIAMOND, 1] : null;
    case ITEM.LEAVES: return random() < 0.08 ? [ITEM.APPLE, 1] : null;
    case ITEM.BEDROCK:
    case ITEM.WATER:
      return null;
    default:
      return ITEM_DEFS.get(blockId)?.kind === 'block' ? [blockId, 1] : null;
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
