import { ITEMS, RECIPES, SMELTING, ITEM, itemDef } from './catalog.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));

export class ItemStack {
  constructor(id, count = 1, data = {}) {
    if (!ITEMS.has(id)) throw new Error(`Unknown item ${id}`);
    const def = itemDef(id);
    this.id = id;
    this.count = clamp(Math.floor(count), 0, def.maxStack || 64);
    this.data = structuredCloneSafe(data);
    if ((def.kind === 'tool' || def.kind === 'armor') && this.data.durability == null && Number.isFinite(def.durability)) {
      this.data.durability = def.durability;
    }
  }
  clone() { return new ItemStack(this.id, this.count, this.data); }
  canMerge(other) { return Boolean(other && other.id === this.id && JSON.stringify(other.data) === JSON.stringify(this.data)); }
  serialize() { return { id: this.id, count: this.count, data: structuredCloneSafe(this.data) }; }
  static from(raw) {
    if (!raw || !ITEMS.has(Number(raw.id))) return null;
    try { return new ItemStack(Number(raw.id), Number(raw.count) || 1, raw.data || {}); } catch { return null; }
  }
}

export class InventoryV1 {
  constructor(size = 36) {
    this.size = size;
    this.slots = Array.from({ length: size }, () => null);
    this.hotbar = Array.from({ length: 9 }, (_, i) => i);
    this.selected = 0;
    this.armor = { head: null, chest: null, legs: null, feet: null };
    this.offhand = null;
  }
  selectedStack() { return this.slots[this.hotbar[this.selected]] || null; }
  selectedDef() { return itemDef(this.selectedStack()?.id); }
  setSelected(index) { this.selected = clamp(Math.floor(index), 0, 8); }
  count(id) { return this.slots.reduce((n, s) => n + (s?.id === id ? s.count : 0), 0); }
  has(id, count = 1) { return this.count(id) >= count; }
  findSlot(id) { return this.slots.findIndex((s) => s?.id === id); }
  add(id, count = 1, data = {}) {
    if (!ITEMS.has(id) || count <= 0) return false;
    const def = itemDef(id);
    let remaining = Math.floor(count);
    const probe = new ItemStack(id, 1, data);
    if ((def.maxStack || 64) > 1) {
      for (const stack of this.slots) {
        if (!stack || !stack.canMerge(probe)) continue;
        const space = def.maxStack - stack.count;
        const moved = Math.min(space, remaining);
        stack.count += moved; remaining -= moved;
        if (!remaining) return true;
      }
    }
    for (let i = 0; i < this.slots.length && remaining; i++) {
      if (this.slots[i]) continue;
      const moved = Math.min(def.maxStack || 64, remaining);
      this.slots[i] = new ItemStack(id, moved, data);
      remaining -= moved;
    }
    return remaining === 0;
  }
  remove(id, count = 1) {
    let remaining = Math.floor(count);
    if (remaining <= 0 || !this.has(id, remaining)) return false;
    for (let i = this.slots.length - 1; i >= 0 && remaining; i--) {
      const stack = this.slots[i];
      if (!stack || stack.id !== id) continue;
      const moved = Math.min(stack.count, remaining);
      stack.count -= moved; remaining -= moved;
      if (stack.count <= 0) this.slots[i] = null;
    }
    return remaining === 0;
  }
  consumeSelected(count = 1) {
    const slot = this.hotbar[this.selected];
    const stack = this.slots[slot];
    if (!stack || stack.count < count) return false;
    stack.count -= count;
    if (stack.count <= 0) this.slots[slot] = null;
    return true;
  }
  damageSelected(amount = 1) {
    const stack = this.selectedStack();
    const def = itemDef(stack?.id);
    if (!stack || !def || !Number.isFinite(def.durability)) return false;
    stack.data.durability = (stack.data.durability ?? def.durability) - amount;
    if (stack.data.durability <= 0) {
      this.slots[this.hotbar[this.selected]] = null;
      return 'broken';
    }
    return true;
  }
  equipFromSlot(index) {
    const stack = this.slots[index];
    const def = itemDef(stack?.id);
    if (!stack || def?.kind !== 'armor') return false;
    const old = this.armor[def.slot];
    this.armor[def.slot] = stack;
    this.slots[index] = old;
    return true;
  }
  armorPoints() {
    return Object.values(this.armor).reduce((n, s) => n + (itemDef(s?.id)?.defense || 0), 0);
  }
  armorToughness() {
    return Object.values(this.armor).reduce((n, s) => n + (itemDef(s?.id)?.toughness || 0), 0);
  }
  applyArmorDamage(amount = 1) {
    for (const slot of Object.keys(this.armor)) {
      const stack = this.armor[slot];
      const def = itemDef(stack?.id);
      if (!stack || !Number.isFinite(def?.durability)) continue;
      stack.data.durability = (stack.data.durability ?? def.durability) - amount;
      if (stack.data.durability <= 0) this.armor[slot] = null;
    }
  }
  serialize() {
    return {
      size: this.size,
      slots: this.slots.map((s) => s?.serialize() || null),
      hotbar: [...this.hotbar], selected: this.selected,
      armor: Object.fromEntries(Object.entries(this.armor).map(([k, s]) => [k, s?.serialize() || null])),
      offhand: this.offhand?.serialize() || null
    };
  }
  load(raw) {
    if (!raw || !Array.isArray(raw.slots)) return false;
    this.slots = Array.from({ length: this.size }, (_, i) => ItemStack.from(raw.slots[i]));
    if (Array.isArray(raw.hotbar) && raw.hotbar.length === 9) this.hotbar = raw.hotbar.map((x) => clamp(Math.floor(x), 0, this.size - 1));
    this.selected = clamp(Math.floor(raw.selected), 0, 8);
    for (const key of Object.keys(this.armor)) this.armor[key] = ItemStack.from(raw.armor?.[key]);
    this.offhand = ItemStack.from(raw.offhand);
    return true;
  }
}

export class EffectSystem {
  constructor() { this.effects = new Map(); }
  add(id, duration, amplifier = 0) {
    if (!id || duration <= 0) return false;
    const prev = this.effects.get(id);
    if (!prev || amplifier >= prev.amplifier || duration > prev.duration) this.effects.set(id, { id, duration, amplifier });
    return true;
  }
  remove(id) { return this.effects.delete(id); }
  has(id) { return this.effects.has(id); }
  level(id) { return (this.effects.get(id)?.amplifier ?? -1) + 1; }
  tick(dt) {
    for (const [id, effect] of this.effects) {
      effect.duration -= dt;
      if (effect.duration <= 0) this.effects.delete(id);
    }
  }
  multiplier(stat) {
    if (stat === 'speed' && this.has('speed')) return 1 + this.level('speed') * 0.2;
    if (stat === 'damage' && this.has('strength')) return 1 + this.level('strength') * 0.25;
    if (stat === 'mining' && this.has('haste')) return 1 + this.level('haste') * 0.2;
    return 1;
  }
  serialize() { return [...this.effects.values()].map((x) => ({ ...x })); }
  load(raw) { this.effects.clear(); for (const e of Array.isArray(raw) ? raw : []) if (e?.id && e.duration > 0) this.add(e.id, e.duration, e.amplifier || 0); }
}

export class PlayerStatsV1 {
  constructor() {
    this.health = 20; this.hunger = 20; this.saturation = 5; this.air = 20;
    this.exhaustion = 0; this.fire = 0; this.xp = 0; this.level = 0;
    this.spawn = { dimension: 'overworld', x: 0.5, y: 40, z: 0.5 };
    this.dead = false; this.gameMode = 'survival'; this.difficulty = 'normal';
    this.effects = new EffectSystem();
    this.regenTimer = 0; this.starveTimer = 0; this.drownTimer = 0; this.fireTimer = 0;
  }
  setGameMode(mode) { if (['survival','creative','adventure','hardcore'].includes(mode)) this.gameMode = mode; }
  isInvulnerable() { return this.gameMode === 'creative'; }
  addExhaustion(amount) {
    if (this.gameMode === 'creative') return;
    this.exhaustion += Math.max(0, amount || 0);
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
  }
  damage(amount, inventory = null, source = 'generic') {
    if (this.dead || this.isInvulnerable() || amount <= 0) return 0;
    if (source === 'fire' && this.effects.has('fire_resistance')) return 0;
    const armor = inventory?.armorPoints?.() || 0;
    const toughness = inventory?.armorToughness?.() || 0;
    const reduction = Math.min(0.8, armor * 0.035 + toughness * 0.01);
    const dealt = Math.max(0.25, amount * (1 - reduction));
    this.health = Math.max(0, this.health - dealt);
    inventory?.applyArmorDamage?.(Math.max(1, Math.floor(amount / 4)));
    if (this.health <= 0) this.dead = true;
    return dealt;
  }
  heal(amount) { if (this.dead) return false; this.health = Math.min(20, this.health + Math.max(0, amount)); return true; }
  eat(def) {
    if (!def || def.kind !== 'food' || this.hunger >= 20 || this.dead) return false;
    this.hunger = Math.min(20, this.hunger + (def.hunger || 0));
    this.saturation = Math.min(20, this.saturation + (def.saturation || 0));
    return true;
  }
  addXp(amount) {
    this.xp += Math.max(0, Number(amount) || 0);
    let need = this.xpForNext();
    while (this.xp >= need) { this.xp -= need; this.level++; need = this.xpForNext(); }
  }
  xpForNext() { return 7 + this.level * 2 + Math.floor(this.level * this.level * 0.08); }
  ignite(seconds) { if (!this.effects.has('fire_resistance')) this.fire = Math.max(this.fire, seconds); }
  resetAfterDeath() {
    this.health = 20; this.hunger = 20; this.saturation = 5; this.air = 20; this.fire = 0; this.dead = false;
    this.effects = new EffectSystem();
  }
  tick(dt, env = {}) {
    this.effects.tick(dt);
    if (this.dead || this.gameMode === 'creative') return;
    if (env.underwater) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) { this.drownTimer += dt; if (this.drownTimer >= 1) { this.drownTimer = 0; this.damage(2, env.inventory, 'drown'); } }
    } else { this.air = Math.min(20, this.air + dt * 4); this.drownTimer = 0; }
    if (this.fire > 0) {
      this.fire = Math.max(0, this.fire - dt); this.fireTimer += dt;
      if (this.fireTimer >= 1) { this.fireTimer = 0; this.damage(1, env.inventory, 'fire'); }
    }
    if (this.hunger >= 18 && this.health < 20) {
      this.regenTimer += dt;
      if (this.regenTimer >= 4) { this.regenTimer = 0; this.heal(1); this.addExhaustion(3); }
    } else this.regenTimer = 0;
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) {
        this.starveTimer = 0;
        const floor = this.difficulty === 'easy' ? 10 : this.difficulty === 'normal' ? 1 : 0;
        if (this.health > floor) this.damage(1, env.inventory, 'starvation');
      }
    } else this.starveTimer = 0;
  }
  serialize() {
    return { health:this.health,hunger:this.hunger,saturation:this.saturation,air:this.air,exhaustion:this.exhaustion,fire:this.fire,xp:this.xp,level:this.level,spawn:{...this.spawn},gameMode:this.gameMode,difficulty:this.difficulty,effects:this.effects.serialize() };
  }
  load(raw) {
    if (!raw) return false;
    this.health=clamp(raw.health,1,20);this.hunger=clamp(raw.hunger,0,20);this.saturation=clamp(raw.saturation,0,20);this.air=clamp(raw.air,0,20);
    this.exhaustion=clamp(raw.exhaustion,0,4);this.fire=Math.max(0,Number(raw.fire)||0);this.xp=Math.max(0,Number(raw.xp)||0);this.level=Math.max(0,Math.floor(raw.level)||0);
    if (raw.spawn) this.spawn={dimension:raw.spawn.dimension||'overworld',x:Number(raw.spawn.x)||0.5,y:Number(raw.spawn.y)||40,z:Number(raw.spawn.z)||0.5};
    this.setGameMode(raw.gameMode || 'survival'); if (['peaceful','easy','normal','hard'].includes(raw.difficulty)) this.difficulty=raw.difficulty;
    this.effects.load(raw.effects); this.dead=false; return true;
  }
}

export class CraftingSystem {
  constructor(recipes = RECIPES) { this.recipes = [...recipes]; }
  available(inventory, grid = '2x2') {
    return this.recipes.filter((r) => (r.grid === 'any' || r.grid === grid || grid === '3x3') && r.in.every(([id,n]) => inventory.has(id,n)));
  }
  craft(inventory, recipeId, grid = '2x2') {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe || !(recipe.grid === 'any' || recipe.grid === grid || grid === '3x3')) return false;
    if (!recipe.in.every(([id,n]) => inventory.has(id,n))) return false;
    const [outId,outCount] = recipe.out;
    const snapshot = inventory.serialize();
    for (const [id,n] of recipe.in) inventory.remove(id,n);
    if (!inventory.add(outId,outCount)) { inventory.load(snapshot); return false; }
    return true;
  }
}

export class FurnaceSystem {
  constructor() { this.input = null; this.fuel = 0; this.progress = 0; this.output = null; this.active = false; }
  loadFuel(inventory, amount = 1) {
    if (!inventory.has(ITEM.COAL, amount)) return false;
    inventory.remove(ITEM.COAL, amount); this.fuel += amount * 80; return true;
  }
  setInput(inventory, id) {
    if (!SMELTING.has(id) || !inventory.has(id,1) || this.input) return false;
    inventory.remove(id,1); this.input = id; this.progress = 0; return true;
  }
  tick(dt, playerStats = null) {
    if (!this.input || this.fuel <= 0) { this.active = false; return null; }
    const recipe = SMELTING.get(this.input); if (!recipe) return null;
    this.active = true; this.fuel = Math.max(0, this.fuel - dt); this.progress += dt;
    if (this.progress < recipe.time) return null;
    this.progress = 0; const out = recipe.out; this.input = null; this.output = new ItemStack(out,1); playerStats?.addXp(recipe.xp || 0); return out;
  }
  takeOutput(inventory) { if (!this.output) return false; const ok=inventory.add(this.output.id,this.output.count,this.output.data); if(ok)this.output=null; return ok; }
  serialize(){return{input:this.input,fuel:this.fuel,progress:this.progress,output:this.output?.serialize()||null}};
  load(raw){if(!raw)return;this.input=SMELTING.has(Number(raw.input))?Number(raw.input):null;this.fuel=Math.max(0,Number(raw.fuel)||0);this.progress=Math.max(0,Number(raw.progress)||0);this.output=ItemStack.from(raw.output);}
}

export const ADVANCEMENTS = Object.freeze([
  { id:'wood', title:'Primeiro Tronco', test:(s)=>s.items?.has(ITEM.LOG) },
  { id:'stone_age', title:'Idade da Pedra', requires:['wood'], test:(s)=>s.items?.has(ITEM.COBBLE) },
  { id:'iron', title:'Era do Ferro', requires:['stone_age'], test:(s)=>s.items?.has(ITEM.IRON_INGOT) },
  { id:'diamond', title:'Brilho Azul', requires:['iron'], test:(s)=>s.items?.has(ITEM.DIAMOND) },
  { id:'farmer', title:'Colheita', test:(s)=>s.items?.has(ITEM.WHEAT) },
  { id:'engineer', title:'Engenheiro de Flux', test:(s)=>s.items?.has(ITEM.FLUX_WIRE) },
  { id:'emberdeep', title:'Abaixo do Mundo', test:(s)=>s.dimension==='emberdeep' },
  { id:'voidlands', title:'Além do Vazio', requires:['emberdeep'], test:(s)=>s.dimension==='voidlands' },
  { id:'boss', title:'O Fim é um Começo', requires:['voidlands'], test:(s)=>Boolean(s.flags?.bossDefeated) }
]);

export class AdvancementSystem {
  constructor() { this.unlocked = new Set(); this.queue = []; }
  update(state) {
    for (const advancement of ADVANCEMENTS) {
      if (this.unlocked.has(advancement.id)) continue;
      if (advancement.requires?.some((x)=>!this.unlocked.has(x))) continue;
      if (advancement.test(state)) { this.unlocked.add(advancement.id); this.queue.push(advancement); }
    }
  }
  popNotifications(){return this.queue.splice(0);}
  serialize(){return[...this.unlocked];}
  load(raw){this.unlocked=new Set((Array.isArray(raw)?raw:[]).filter((id)=>ADVANCEMENTS.some((a)=>a.id===id)));this.queue=[];}
}

export class LootTable {
  constructor(entries = []) { this.entries = entries; }
  roll(context = {}, random = Math.random) {
    const out=[];
    for(const e of this.entries){
      const chance=typeof e.chance==='function'?e.chance(context):(e.chance??1);
      if(random()>chance)continue;
      const min=e.min??1,max=e.max??min,count=min+Math.floor(random()*(max-min+1));
      if(count>0)out.push([e.id,count]);
    }
    return out;
  }
}

export function miningSpeed(blockDef, stack, effects = null) {
  if (!blockDef || !Number.isFinite(blockDef.hardness)) return { speed:0, harvest:false };
  const tool = itemDef(stack?.id);
  let speed=1, harvest=!blockDef.tool;
  if (tool?.tool === blockDef.tool) { speed=tool.speed||1; harvest=(tool.tier||0)>=(blockDef.tier||0); }
  speed *= effects?.multiplier?.('mining') || 1;
  return { speed, harvest };
}

export function combatDamage(stack, effects = null) {
  const base = itemDef(stack?.id)?.damage || 1;
  return base * (effects?.multiplier?.('damage') || 1);
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}
