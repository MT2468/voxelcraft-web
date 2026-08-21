export const BLOCK = Object.freeze({
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  COBBLE: 7, PLANKS: 8, SNOW: 9, COAL_ORE: 10, IRON_ORE: 11, GOLD_ORE: 12,
  DIAMOND_ORE: 13, BEDROCK: 14, WATER: 15, LAVA: 16, TORCH: 17, GLASS: 18,
  CRAFTING_TABLE: 19, FURNACE: 20, CHEST: 21, FARMLAND: 22, CROP: 23,
  FLUX_WIRE: 24, FLUX_LAMP: 25, LEVER: 26, PISTON: 27, RAIL: 28, PORTAL: 29,
  BRICKS: 30, WOOL: 31, OBSIDIAN: 32, CACTUS: 33, CLAY: 34, BOOKSHELF: 35,
  BED: 36, ICE: 37, GRAVEL: 38, BASALT: 39, EMBERSTONE: 40, VOIDSTONE: 41,
  GLOWSTONE: 42, FLOWER: 43, SAPLING: 44, TNT: 45
});

export const ITEM = Object.freeze({
  ...BLOCK,
  STICK: 101,
  WOOD_PICKAXE: 102, STONE_PICKAXE: 103, IRON_PICKAXE: 104,
  WOOD_SWORD: 105, STONE_SWORD: 106, RAW_PORK: 107, APPLE: 108, COAL: 109,
  IRON_INGOT: 110, GOLD_INGOT: 111, DIAMOND: 112, DIAMOND_PICKAXE: 113,
  IRON_SWORD: 114, DIAMOND_SWORD: 115, COOKED_PORK: 116, RAW_BEEF: 117,
  COOKED_BEEF: 118, RAW_CHICKEN: 119, COOKED_CHICKEN: 120, WHEAT: 121,
  SEEDS: 122, BREAD: 123, BUCKET: 124, WATER_BUCKET: 125, LAVA_BUCKET: 126,
  BOW: 127, ARROW: 128, SHIELD: 129, LEATHER: 130, STRING: 131,
  LEATHER_HELMET: 140, LEATHER_CHEST: 141, LEATHER_LEGS: 142, LEATHER_BOOTS: 143,
  IRON_HELMET: 144, IRON_CHEST: 145, IRON_LEGS: 146, IRON_BOOTS: 147,
  DIAMOND_HELMET: 148, DIAMOND_CHEST: 149, DIAMOND_LEGS: 150, DIAMOND_BOOTS: 151,
  ENDER_SHARD: 160, EMBER_CRYSTAL: 161, VOID_EYE: 162, XP_BOTTLE: 163,
  POTION_HEAL: 170, POTION_SPEED: 171, POTION_FIRE: 172, FLUX_DUST: 180,
  MINECART: 181, FLINT_STEEL: 182, FISH: 183, COOKED_FISH: 184
});

const block = (id, name, color, extra = {}) => ({
  id, name, color, top: color, side: color, hardness: 0.5, resistance: 1,
  solid: true, opaque: true, replaceable: false, transparent: false, liquid: false,
  emits: 0, tool: null, tier: 0, gravity: false, randomTick: false, ...extra
});

export const BLOCKS = new Map([
  [BLOCK.GRASS, block(BLOCK.GRASS, 'Grama', 0x69a946, { side: 0x7d603c, hardness: 0.35 })],
  [BLOCK.DIRT, block(BLOCK.DIRT, 'Terra', 0x805a38, { hardness: 0.4 })],
  [BLOCK.STONE, block(BLOCK.STONE, 'Pedra', 0x858585, { hardness: 1.15, tool: 'pickaxe', tier: 1 })],
  [BLOCK.SAND, block(BLOCK.SAND, 'Areia', 0xdacb8b, { hardness: 0.28, gravity: true })],
  [BLOCK.LOG, block(BLOCK.LOG, 'Madeira', 0x8b633b, { top: 0xb28a58, hardness: 0.7, tool: 'axe' })],
  [BLOCK.LEAVES, block(BLOCK.LEAVES, 'Folhas', 0x3e8538, { hardness: 0.18, transparent: true, opaque: false, randomTick: true })],
  [BLOCK.COBBLE, block(BLOCK.COBBLE, 'Pedregulho', 0x707070, { hardness: 1.25, tool: 'pickaxe', tier: 1 })],
  [BLOCK.PLANKS, block(BLOCK.PLANKS, 'Tábuas', 0xb28755, { hardness: 0.62, tool: 'axe' })],
  [BLOCK.SNOW, block(BLOCK.SNOW, 'Neve', 0xeef6f7, { side: 0xc9d7d8, hardness: 0.2 })],
  [BLOCK.COAL_ORE, block(BLOCK.COAL_ORE, 'Minério de carvão', 0x4c4c4c, { hardness: 1.35, tool: 'pickaxe', tier: 1 })],
  [BLOCK.IRON_ORE, block(BLOCK.IRON_ORE, 'Minério de ferro', 0xb49b84, { hardness: 1.45, tool: 'pickaxe', tier: 2 })],
  [BLOCK.GOLD_ORE, block(BLOCK.GOLD_ORE, 'Minério de ouro', 0xe0b632, { hardness: 1.55, tool: 'pickaxe', tier: 3 })],
  [BLOCK.DIAMOND_ORE, block(BLOCK.DIAMOND_ORE, 'Minério de diamante', 0x55d4d6, { hardness: 1.75, tool: 'pickaxe', tier: 3 })],
  [BLOCK.BEDROCK, block(BLOCK.BEDROCK, 'Rocha-base', 0x272727, { hardness: Infinity, resistance: Infinity })],
  [BLOCK.WATER, block(BLOCK.WATER, 'Água', 0x4084d8, { solid: false, opaque: false, transparent: true, liquid: true, replaceable: true, hardness: Infinity })],
  [BLOCK.LAVA, block(BLOCK.LAVA, 'Lava', 0xef6d16, { solid: false, opaque: false, transparent: true, liquid: true, replaceable: true, emits: 14, hardness: Infinity })],
  [BLOCK.TORCH, block(BLOCK.TORCH, 'Tocha', 0xf3bd4b, { solid: false, opaque: false, transparent: true, replaceable: true, emits: 14, hardness: 0.05 })],
  [BLOCK.GLASS, block(BLOCK.GLASS, 'Vidro', 0xb6dddf, { opaque: false, transparent: true, hardness: 0.3 })],
  [BLOCK.CRAFTING_TABLE, block(BLOCK.CRAFTING_TABLE, 'Bancada', 0x9b673e, { hardness: 0.8, tool: 'axe' })],
  [BLOCK.FURNACE, block(BLOCK.FURNACE, 'Fornalha', 0x686868, { hardness: 1.3, tool: 'pickaxe', tier: 1 })],
  [BLOCK.CHEST, block(BLOCK.CHEST, 'Baú', 0xa5723a, { hardness: 0.75, tool: 'axe' })],
  [BLOCK.FARMLAND, block(BLOCK.FARMLAND, 'Terra arada', 0x6e4931, { hardness: 0.35, randomTick: true })],
  [BLOCK.CROP, block(BLOCK.CROP, 'Plantação', 0x7fb54a, { solid: false, opaque: false, transparent: true, replaceable: true, hardness: 0.08, randomTick: true })],
  [BLOCK.FLUX_WIRE, block(BLOCK.FLUX_WIRE, 'Fio de Flux', 0x9a2731, { solid: false, opaque: false, transparent: true, hardness: 0.1 })],
  [BLOCK.FLUX_LAMP, block(BLOCK.FLUX_LAMP, 'Lâmpada de Flux', 0x7c633f, { hardness: 0.45 })],
  [BLOCK.LEVER, block(BLOCK.LEVER, 'Alavanca', 0x8d785f, { solid: false, opaque: false, transparent: true, hardness: 0.1 })],
  [BLOCK.PISTON, block(BLOCK.PISTON, 'Pistão', 0x8f8b77, { hardness: 1, tool: 'pickaxe', tier: 1 })],
  [BLOCK.RAIL, block(BLOCK.RAIL, 'Trilho', 0x8e7753, { solid: false, opaque: false, transparent: true, hardness: 0.1 })],
  [BLOCK.PORTAL, block(BLOCK.PORTAL, 'Portal', 0x7138a6, { solid: false, opaque: false, transparent: true, emits: 9, hardness: Infinity })],
  [BLOCK.BRICKS, block(BLOCK.BRICKS, 'Tijolos', 0x9c5549, { hardness: 1.1, tool: 'pickaxe', tier: 1 })],
  [BLOCK.WOOL, block(BLOCK.WOOL, 'Lã', 0xe0ddd3, { hardness: 0.22 })],
  [BLOCK.OBSIDIAN, block(BLOCK.OBSIDIAN, 'Obsidiana', 0x2f2341, { hardness: 4, resistance: 12, tool: 'pickaxe', tier: 4 })],
  [BLOCK.CACTUS, block(BLOCK.CACTUS, 'Cacto', 0x418a45, { hardness: 0.25, randomTick: true })],
  [BLOCK.CLAY, block(BLOCK.CLAY, 'Argila', 0x9297a4, { hardness: 0.35 })],
  [BLOCK.BOOKSHELF, block(BLOCK.BOOKSHELF, 'Estante', 0x8f6539, { hardness: 0.75, tool: 'axe' })],
  [BLOCK.BED, block(BLOCK.BED, 'Cama', 0xc84c4c, { hardness: 0.25 })],
  [BLOCK.ICE, block(BLOCK.ICE, 'Gelo', 0x8fd3ec, { transparent: true, opaque: false, hardness: 0.25 })],
  [BLOCK.GRAVEL, block(BLOCK.GRAVEL, 'Cascalho', 0x7b7773, { hardness: 0.35, gravity: true })],
  [BLOCK.BASALT, block(BLOCK.BASALT, 'Basalto', 0x454248, { hardness: 1.4, tool: 'pickaxe', tier: 2 })],
  [BLOCK.EMBERSTONE, block(BLOCK.EMBERSTONE, 'Pedra-ember', 0x6c3227, { hardness: 1.2, tool: 'pickaxe', tier: 2 })],
  [BLOCK.VOIDSTONE, block(BLOCK.VOIDSTONE, 'Pedra do vazio', 0x6e6a88, { hardness: 1.6, tool: 'pickaxe', tier: 3 })],
  [BLOCK.GLOWSTONE, block(BLOCK.GLOWSTONE, 'Pedra luminosa', 0xe7b955, { hardness: 0.5, emits: 15 })],
  [BLOCK.FLOWER, block(BLOCK.FLOWER, 'Flor', 0xe35d75, { solid: false, opaque: false, transparent: true, replaceable: true, hardness: 0.02 })],
  [BLOCK.SAPLING, block(BLOCK.SAPLING, 'Muda', 0x4f913d, { solid: false, opaque: false, transparent: true, replaceable: true, hardness: 0.02, randomTick: true })],
  [BLOCK.TNT, block(BLOCK.TNT, 'Explosivo', 0xc94c3d, { hardness: 0.1, resistance: 0 })]
]);

const item = (id, name, kind, extra = {}) => ({ id, name, kind, maxStack: kind === 'tool' || kind === 'armor' ? 1 : 64, ...extra });
export const ITEMS = new Map();
for (const [id, def] of BLOCKS) ITEMS.set(id, item(id, def.name, 'block', { block: id }));
[
  item(ITEM.STICK, 'Graveto', 'material'), item(ITEM.COAL, 'Carvão', 'material'),
  item(ITEM.IRON_INGOT, 'Barra de ferro', 'material'), item(ITEM.GOLD_INGOT, 'Barra de ouro', 'material'),
  item(ITEM.DIAMOND, 'Diamante', 'material'), item(ITEM.WHEAT, 'Trigo', 'material'), item(ITEM.SEEDS, 'Sementes', 'material'),
  item(ITEM.FLUX_DUST, 'Pó de Flux', 'material'), item(ITEM.ENDER_SHARD, 'Fragmento do vazio', 'material'),
  item(ITEM.EMBER_CRYSTAL, 'Cristal ember', 'material'), item(ITEM.VOID_EYE, 'Olho do vazio', 'material'),
  item(ITEM.LEATHER, 'Couro', 'material'), item(ITEM.STRING, 'Linha', 'material'), item(ITEM.ARROW, 'Flecha', 'ammo'),
  item(ITEM.WOOD_PICKAXE, 'Picareta de madeira', 'tool', { tool: 'pickaxe', tier: 1, speed: 2.1, damage: 2, durability: 60 }),
  item(ITEM.STONE_PICKAXE, 'Picareta de pedra', 'tool', { tool: 'pickaxe', tier: 2, speed: 3.1, damage: 3, durability: 132 }),
  item(ITEM.IRON_PICKAXE, 'Picareta de ferro', 'tool', { tool: 'pickaxe', tier: 3, speed: 4.4, damage: 4, durability: 251 }),
  item(ITEM.DIAMOND_PICKAXE, 'Picareta de diamante', 'tool', { tool: 'pickaxe', tier: 4, speed: 6, damage: 5, durability: 1561 }),
  item(ITEM.WOOD_SWORD, 'Espada de madeira', 'tool', { tool: 'sword', tier: 1, damage: 4, durability: 60 }),
  item(ITEM.STONE_SWORD, 'Espada de pedra', 'tool', { tool: 'sword', tier: 2, damage: 5, durability: 132 }),
  item(ITEM.IRON_SWORD, 'Espada de ferro', 'tool', { tool: 'sword', tier: 3, damage: 6, durability: 251 }),
  item(ITEM.DIAMOND_SWORD, 'Espada de diamante', 'tool', { tool: 'sword', tier: 4, damage: 7, durability: 1561 }),
  item(ITEM.BOW, 'Arco', 'tool', { tool: 'bow', damage: 5, durability: 384 }),
  item(ITEM.SHIELD, 'Escudo', 'tool', { tool: 'shield', durability: 336 }),
  item(ITEM.BUCKET, 'Balde', 'tool', { tool: 'bucket', durability: Infinity }),
  item(ITEM.WATER_BUCKET, 'Balde de água', 'tool', { tool: 'bucket', fluid: BLOCK.WATER, durability: Infinity }),
  item(ITEM.LAVA_BUCKET, 'Balde de lava', 'tool', { tool: 'bucket', fluid: BLOCK.LAVA, durability: Infinity }),
  item(ITEM.FLINT_STEEL, 'Pederneira', 'tool', { tool: 'igniter', durability: 64 }),
  item(ITEM.MINECART, 'Carrinho', 'vehicle'),
  item(ITEM.RAW_PORK, 'Carne de porco crua', 'food', { hunger: 3, saturation: 1.8 }),
  item(ITEM.COOKED_PORK, 'Carne de porco assada', 'food', { hunger: 8, saturation: 8 }),
  item(ITEM.RAW_BEEF, 'Carne bovina crua', 'food', { hunger: 3, saturation: 1.8 }),
  item(ITEM.COOKED_BEEF, 'Carne bovina assada', 'food', { hunger: 8, saturation: 9 }),
  item(ITEM.RAW_CHICKEN, 'Frango cru', 'food', { hunger: 2, saturation: 1 }),
  item(ITEM.COOKED_CHICKEN, 'Frango assado', 'food', { hunger: 6, saturation: 6 }),
  item(ITEM.APPLE, 'Maçã', 'food', { hunger: 4, saturation: 2.4 }),
  item(ITEM.BREAD, 'Pão', 'food', { hunger: 5, saturation: 6 }),
  item(ITEM.FISH, 'Peixe cru', 'food', { hunger: 2, saturation: 1 }),
  item(ITEM.COOKED_FISH, 'Peixe assado', 'food', { hunger: 5, saturation: 6 }),
  item(ITEM.POTION_HEAL, 'Poção de cura', 'potion', { effect: 'instant_health', amplifier: 1 }),
  item(ITEM.POTION_SPEED, 'Poção de velocidade', 'potion', { effect: 'speed', duration: 180 }),
  item(ITEM.POTION_FIRE, 'Poção de resistência ao fogo', 'potion', { effect: 'fire_resistance', duration: 180 }),
  item(ITEM.XP_BOTTLE, 'Frasco de experiência', 'utility', { xp: 7 })
].forEach((def) => ITEMS.set(def.id, def));

const armor = (id, name, slot, defense, durability, toughness = 0) => item(id, name, 'armor', { slot, defense, durability, toughness });
[
  armor(ITEM.LEATHER_HELMET, 'Capuz de couro', 'head', 1, 55), armor(ITEM.LEATHER_CHEST, 'Túnica de couro', 'chest', 3, 80),
  armor(ITEM.LEATHER_LEGS, 'Calças de couro', 'legs', 2, 75), armor(ITEM.LEATHER_BOOTS, 'Botas de couro', 'feet', 1, 65),
  armor(ITEM.IRON_HELMET, 'Capacete de ferro', 'head', 2, 165), armor(ITEM.IRON_CHEST, 'Peitoral de ferro', 'chest', 6, 240),
  armor(ITEM.IRON_LEGS, 'Calças de ferro', 'legs', 5, 225), armor(ITEM.IRON_BOOTS, 'Botas de ferro', 'feet', 2, 195),
  armor(ITEM.DIAMOND_HELMET, 'Capacete de diamante', 'head', 3, 363, 2), armor(ITEM.DIAMOND_CHEST, 'Peitoral de diamante', 'chest', 8, 528, 2),
  armor(ITEM.DIAMOND_LEGS, 'Calças de diamante', 'legs', 6, 495, 2), armor(ITEM.DIAMOND_BOOTS, 'Botas de diamante', 'feet', 3, 429, 2)
].forEach((def) => ITEMS.set(def.id, def));

export const BIOMES = Object.freeze({
  plains: { name: 'Planícies', top: BLOCK.GRASS, filler: BLOCK.DIRT, trees: 0.012, flowers: 0.018 },
  forest: { name: 'Floresta', top: BLOCK.GRASS, filler: BLOCK.DIRT, trees: 0.055, flowers: 0.009 },
  desert: { name: 'Deserto', top: BLOCK.SAND, filler: BLOCK.SAND, trees: 0, cactus: 0.018 },
  savanna: { name: 'Savana', top: BLOCK.GRASS, filler: BLOCK.DIRT, trees: 0.018 },
  swamp: { name: 'Pântano', top: BLOCK.GRASS, filler: BLOCK.DIRT, trees: 0.035, waterBias: 2 },
  taiga: { name: 'Taiga', top: BLOCK.GRASS, filler: BLOCK.DIRT, trees: 0.045 },
  tundra: { name: 'Tundra', top: BLOCK.SNOW, filler: BLOCK.DIRT, trees: 0.006 },
  mountains: { name: 'Montanhas', top: BLOCK.STONE, filler: BLOCK.STONE, trees: 0.005, heightBias: 10 },
  beach: { name: 'Praia', top: BLOCK.SAND, filler: BLOCK.SAND, trees: 0 },
  ocean: { name: 'Oceano', top: BLOCK.GRAVEL, filler: BLOCK.STONE, trees: 0, waterBias: 5 },
  deep_ocean: { name: 'Oceano profundo', top: BLOCK.CLAY, filler: BLOCK.STONE, trees: 0, waterBias: 10 },
  cherry: { name: 'Bosque rosado', top: BLOCK.GRASS, filler: BLOCK.DIRT, trees: 0.04, flowers: 0.04 }
});

export const RECIPES = Object.freeze([
  { id: 'planks', grid: 'any', in: [[ITEM.LOG, 1]], out: [ITEM.PLANKS, 4] },
  { id: 'sticks', grid: 'any', in: [[ITEM.PLANKS, 2]], out: [ITEM.STICK, 4] },
  { id: 'crafting-table', grid: '2x2', in: [[ITEM.PLANKS, 4]], out: [ITEM.CRAFTING_TABLE, 1] },
  { id: 'furnace', grid: '3x3', in: [[ITEM.COBBLE, 8]], out: [ITEM.FURNACE, 1] },
  { id: 'chest', grid: '3x3', in: [[ITEM.PLANKS, 8]], out: [ITEM.CHEST, 1] },
  { id: 'torch', grid: 'any', in: [[ITEM.COAL, 1], [ITEM.STICK, 1]], out: [ITEM.TORCH, 4] },
  { id: 'wood-pickaxe', grid: '3x3', in: [[ITEM.PLANKS, 3], [ITEM.STICK, 2]], out: [ITEM.WOOD_PICKAXE, 1] },
  { id: 'stone-pickaxe', grid: '3x3', in: [[ITEM.COBBLE, 3], [ITEM.STICK, 2]], out: [ITEM.STONE_PICKAXE, 1] },
  { id: 'iron-pickaxe', grid: '3x3', in: [[ITEM.IRON_INGOT, 3], [ITEM.STICK, 2]], out: [ITEM.IRON_PICKAXE, 1] },
  { id: 'diamond-pickaxe', grid: '3x3', in: [[ITEM.DIAMOND, 3], [ITEM.STICK, 2]], out: [ITEM.DIAMOND_PICKAXE, 1] },
  { id: 'wood-sword', grid: '2x2', in: [[ITEM.PLANKS, 2], [ITEM.STICK, 1]], out: [ITEM.WOOD_SWORD, 1] },
  { id: 'stone-sword', grid: '3x3', in: [[ITEM.COBBLE, 2], [ITEM.STICK, 1]], out: [ITEM.STONE_SWORD, 1] },
  { id: 'iron-sword', grid: '3x3', in: [[ITEM.IRON_INGOT, 2], [ITEM.STICK, 1]], out: [ITEM.IRON_SWORD, 1] },
  { id: 'diamond-sword', grid: '3x3', in: [[ITEM.DIAMOND, 2], [ITEM.STICK, 1]], out: [ITEM.DIAMOND_SWORD, 1] },
  { id: 'bread', grid: '3x3', in: [[ITEM.WHEAT, 3]], out: [ITEM.BREAD, 1] },
  { id: 'bow', grid: '3x3', in: [[ITEM.STICK, 3], [ITEM.STRING, 3]], out: [ITEM.BOW, 1] },
  { id: 'shield', grid: '3x3', in: [[ITEM.PLANKS, 6], [ITEM.IRON_INGOT, 1]], out: [ITEM.SHIELD, 1] },
  { id: 'flux-wire', grid: '3x3', in: [[ITEM.FLUX_DUST, 1], [ITEM.IRON_INGOT, 1]], out: [ITEM.FLUX_WIRE, 8] },
  { id: 'flux-lamp', grid: '3x3', in: [[ITEM.FLUX_DUST, 4], [ITEM.GLOWSTONE, 1]], out: [ITEM.FLUX_LAMP, 1] },
  { id: 'piston', grid: '3x3', in: [[ITEM.PLANKS, 3], [ITEM.COBBLE, 4], [ITEM.IRON_INGOT, 1], [ITEM.FLUX_DUST, 1]], out: [ITEM.PISTON, 1] },
  { id: 'tnt', grid: '3x3', in: [[ITEM.SAND, 4], [ITEM.COAL, 5]], out: [ITEM.TNT, 1] }
]);

export const SMELTING = new Map([
  [ITEM.IRON_ORE, { out: ITEM.IRON_INGOT, time: 8, xp: 0.7 }],
  [ITEM.GOLD_ORE, { out: ITEM.GOLD_INGOT, time: 8, xp: 1 }],
  [ITEM.RAW_PORK, { out: ITEM.COOKED_PORK, time: 6, xp: 0.35 }],
  [ITEM.RAW_BEEF, { out: ITEM.COOKED_BEEF, time: 6, xp: 0.35 }],
  [ITEM.RAW_CHICKEN, { out: ITEM.COOKED_CHICKEN, time: 6, xp: 0.35 }],
  [ITEM.FISH, { out: ITEM.COOKED_FISH, time: 6, xp: 0.35 }]
]);

export const DIMENSIONS = Object.freeze({
  overworld: { id: 'overworld', name: 'Overworld', sea: 22, gravity: 20.5, dayLength: 1200, sky: 0x7eb5e6 },
  emberdeep: { id: 'emberdeep', name: 'Emberdeep', sea: 14, gravity: 18, dayLength: Infinity, sky: 0x35120e },
  voidlands: { id: 'voidlands', name: 'Voidlands', sea: 0, gravity: 15, dayLength: Infinity, sky: 0x130f25 }
});

export function blockDef(id) { return BLOCKS.get(id) || null; }
export function itemDef(id) { return ITEMS.get(id) || null; }
export function isSolid(id) { return id !== BLOCK.AIR && Boolean(blockDef(id)?.solid); }
export function isOpaque(id) { return id !== BLOCK.AIR && Boolean(blockDef(id)?.opaque); }
export function isLiquid(id) { return Boolean(blockDef(id)?.liquid); }
