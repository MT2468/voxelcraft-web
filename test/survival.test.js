import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM, RECIPES, Inventory, SurvivalState, miningProfile, blockDrop } from '../src/survival.js';

const recipe = (id) => RECIPES.find((entry) => entry.id === id);

test('inventory add/remove and serialization preserve counts and hotbar', () => {
  const inventory = new Inventory();
  inventory.add(ITEM.LOG, 3);
  inventory.add(ITEM.RAW_PORK, 2);
  inventory.setHotbarSlot(0, ITEM.RAW_PORK);
  inventory.setSelected(0);
  assert.equal(inventory.count(ITEM.LOG), 3);
  assert.equal(inventory.remove(ITEM.LOG, 2), true);
  assert.equal(inventory.count(ITEM.LOG), 1);

  const restored = new Inventory();
  assert.equal(restored.load(inventory.serialize()), true);
  assert.equal(restored.count(ITEM.LOG), 1);
  assert.equal(restored.count(ITEM.RAW_PORK), 2);
  assert.equal(restored.selectedId(), ITEM.RAW_PORK);
});

test('crafting progression can make planks, sticks and a wooden pickaxe', () => {
  const inventory = new Inventory();
  inventory.add(ITEM.LOG, 2);
  assert.equal(inventory.craft(recipe('planks')), true);
  assert.equal(inventory.count(ITEM.PLANKS), 4);
  assert.equal(inventory.craft(recipe('sticks')), true);
  assert.equal(inventory.count(ITEM.STICK), 4);
  inventory.add(ITEM.PLANKS, 3);
  assert.equal(inventory.craft(recipe('wood-pickaxe')), true);
  assert.equal(inventory.count(ITEM.WOOD_PICKAXE), 1);
});

test('tool tiers control stone and ore harvest eligibility', () => {
  const stone = { material: 'stone', requiredTier: 1 };
  const diamondOre = { material: 'stone', requiredTier: 3 };
  assert.equal(miningProfile(stone, ITEM.LOG).harvest, false);
  assert.equal(miningProfile(stone, ITEM.WOOD_PICKAXE).harvest, true);
  assert.equal(miningProfile(diamondOre, ITEM.STONE_PICKAXE).harvest, false);
  assert.equal(miningProfile(diamondOre, ITEM.IRON_PICKAXE).harvest, true);
  assert.deepEqual(blockDrop(ITEM.COAL_ORE, ITEM.WOOD_PICKAXE, () => 0.5), [ITEM.COAL, 1]);
  assert.equal(blockDrop(ITEM.DIAMOND_ORE, ITEM.STONE_PICKAXE, () => 0.5), null);
  assert.deepEqual(blockDrop(ITEM.DIAMOND_ORE, ITEM.IRON_PICKAXE, () => 0.5), [ITEM.DIAMOND, 1]);
});

test('tool durability consumes and eventually breaks a selected tool', () => {
  const inventory = new Inventory();
  inventory.add(ITEM.WOOD_PICKAXE, 1);
  inventory.setHotbarSlot(0, ITEM.WOOD_PICKAXE);
  inventory.setSelected(0);
  for (let i = 0; i < 59; i++) assert.equal(inventory.damageSelectedTool(1), true);
  assert.equal(inventory.has(ITEM.WOOD_PICKAXE), true);
  assert.equal(inventory.damageSelectedTool(1), 'broken');
  assert.equal(inventory.has(ITEM.WOOD_PICKAXE), false);
});

test('survival hunger, eating, damage and regeneration stay clamped', () => {
  const state = new SurvivalState();
  state.addExhaustion(24);
  assert.ok(state.hunger < 20 || state.saturation < 5);
  state.hunger = 10;
  assert.equal(state.eat({ kind: 'food', hunger: 4, saturation: 2 }), true);
  assert.equal(state.hunger, 14);
  state.takeDamage(5);
  assert.equal(state.health, 15);
  state.hunger = 20;
  state.saturation = 5;
  state.update(4.1);
  assert.equal(state.health, 16);
});

test('death is persistent internally but emits only one respawn signal', () => {
  const state = new SurvivalState();
  state.takeDamage(999);
  assert.equal(state.health, 0);
  assert.equal(state.isDead, true);
  assert.equal(state.dead, true);
  assert.equal(state.dead, false);
  assert.equal(state.takeDamage(1), false);
  state.reset();
  assert.equal(state.isDead, false);
  assert.equal(state.health, 20);
});
