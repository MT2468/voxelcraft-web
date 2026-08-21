# VoxelCraft V1

VoxelCraft is an original browser-based 3D voxel survival sandbox inspired by the broad building, mining, exploration and automation genre. It is written from scratch with Three.js and browser APIs. It does **not** ship Mojang/Microsoft code, textures, sounds, models or other proprietary Minecraft assets.

The active development runtime is `src/game-v1.js`. Earlier `game-v4.js`, `game-plus.js` and `game.js` files remain only as regression/reference history.

## V1 feature surface

### World and rendering

- Deterministic seed-based 16×16 streamed chunks with progressive ring loading/unloading.
- 96-block vertical simulation space.
- Climate-driven Overworld with plains, forest, desert, savanna, swamp, taiga, tundra, mountains, beaches, oceans, deep oceans and a rare pink grove.
- Caves, ravines/noise caverns, sea level, coal/iron/gold/diamond distributions, trees, cactus, flowers and generated huts/ruins/shrines.
- Two additional dimensions: **Emberdeep**, a lava cavern world, and **Voidlands**, a floating-island endgame world.
- Original procedural Canvas texture atlas with nearest-neighbor voxel rendering.
- Separate transparent liquid rendering.
- Cached skylight and propagated block-light values for torches and other emitters.
- Day/night cycle, stars, sun/moon lighting, rain, storms and snow precipitation in cold biomes.
- Progressive chunk meshing to avoid blocking the browser on initial load.

### Blocks and simulation

- Registry-driven blocks/items instead of a monolithic switch table.
- Block states for crops, farmland hydration, fluids, levers, lamps, pistons and portals.
- Water and lava flow queues, finite flow levels, falling fluids and water/lava obsidian interaction.
- Gravity blocks such as sand/gravel.
- Random ticks for crops, farmland, saplings and cactus growth.
- Functional crafting table, furnace, chest, bed, rails, TNT, portal blocks and Flux automation components.
- **Flux** circuit network: levers, wire, powered lamps and pistons.
- Explosions with resistance-based block destruction.
- Rails and simulated minecarts.

### Survival and progression

- `ItemStack` inventory with 36 slots, mapped nine-slot hotbar, per-stack durability, armor slots and offhand storage model.
- Survival/Creative/Adventure/Hardcore game modes and Peaceful/Easy/Normal/Hard difficulty model.
- Health, hunger, saturation, exhaustion, air, drowning, fire/lava, fall damage, regeneration and death/respawn.
- Wood/stone/iron/diamond mining progression and melee weapon tiers.
- Leather/iron/diamond armor with durability, defense and toughness.
- Bows/arrows, shield data, buckets and utility items.
- 2×2 and 3×3 crafting recipe systems.
- Real furnace state with fuel, timers, output and XP.
- XP levels, status effects, potions and lightweight enchanting on tools/armor.
- Farming with farmland hydration, seeds, crop growth, wheat and bread.
- Foods including meat, cooked food, apples and fish.
- Advancement chain from first resources through dimensions and the final boss.

### Entities, AI and combat

- Generalized entity manager instead of per-mob game-loop code.
- Passive animals: pigs, cows, chickens and sheep.
- Neutral/tamable wolf behavior model.
- Hostile zombies, skeletons, creepers and slimes.
- Dimension-specific Emberlings and Voidlings.
- Projectile simulation for ranged enemies.
- Limited A* ground pathfinding, wandering, fleeing, chasing, ranged spacing, explosive fuse behavior and reduced spawn rules by dimension/daylight.
- Feeding, breeding and basic taming state.
- Loot tables and first-person melee combat with knockback.
- Multi-phase **Void Titan** endgame boss and boss HUD.

### Exploration and long-session systems

- **Field Guide** opened with `G`.
- Persistent discovered-chunk map with biome coloring and generated-structure hints.
- Trading/economy layer at generated huts with reputation.
- Fishing loop with water proximity, bite window and loot.
- Brewing/alchemy progression for healing, speed and fire-resistance potions.
- Player statistics for exploration and activity tracking.

### Worlds, administration and multiplayer

- IndexedDB-backed world database rather than one giant localStorage save.
- World list, names, deterministic text/numeric seeds, metadata, autosave and independent player/world state.
- JSON world export/import and v4 save migration.
- Command console/chat with `/gamemode`, `/give`, `/tp`, `/time`, `/weather`, `/seed`, `/spawn`, `/kill`, `/difficulty`, `/effect`, `/summon`, `/setblock`, `/fill`, `/gamerule`, `/dimension`, `/xp`, `/heal`, `/hunger`, `/advancement` and `/explode`.
- Gamerules for inventory retention, daylight/weather, spawning, fire/crops, regeneration and related simulation controls.
- WebSocket multiplayer client protocol with room join, chat, block replication, input messages, snapshots, ping and interpolation.
- Optional authoritative Node/WebSocket server in `server/server.mjs`, including rooms, input validation, snapshots, block-reach validation, chat and basic player-vs-player damage authority.
- BroadcastChannel local-presence fallback for same-browser contexts.

### UI, settings and audio

- DOM-based menu/HUD over WebGL, keeping simulation state outside the renderer.
- World selector/creator, game mode/difficulty, import/export, settings and multiplayer panels.
- Hearts, hunger, armor, air, XP, mode/weather badges, hotbar, tool durability, debug stats and boss bar.
- Inventory/crafting/furnace/chest/enchanting/Creative catalog UI.
- Chat/command input and death screen.
- FOV, render distance, resolution scale and volume controls.
- Responsive layouts and reduced-motion CSS handling.
- Procedural WebAudio for block interaction/movement, avoiding proprietary sound assets.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look |
| W A S D | Move |
| Space | Jump / swim / creative rise |
| Ctrl | Creative descend |
| Shift | Sprint / faster flight |
| Hold left click | Mine or attack a targeted entity |
| Right click | Place/use/eat/drink/interact |
| 1–9 / wheel | Select hotbar |
| E | Inventory/crafting |
| G | Field Guide/map/trading/fishing/alchemy |
| T | Chat |
| `/` | Command input |
| F | Toggle flight in Creative |
| F3 | Debug overlay |
| Esc | Pause/release pointer lock |

## Run locally

Three.js is loaded from jsDelivr through an import map. Serve the repository rather than opening `index.html` as a `file://` URL.

```bash
python -m http.server 8080
# open http://localhost:8080
```

For the optional authoritative multiplayer server:

```bash
npm install
npm run server
# default ws://localhost:8787
```

## Verification

Node 24+:

```bash
npm run check
npm test
```

Pull requests are gated by:

1. syntax checks across legacy and V1 browser/server modules;
2. Node unit tests for world generation, inventories, survival, crafting, furnace, armor, effects, fluids, farming, lighting, Flux, explosions, entities, AI/pathfinding, bosses, commands, saves, trading, fishing, brewing, maps and statistics;
3. a real Chromium + Playwright WebGL smoke test that serves the repository over HTTP, boots the V1 runtime, creates a fixed-seed world, exercises commands/settings/world export, enters gameplay, inspects survival HUD/inventory, switches dimensions and captures screenshots.

## V1 architecture

```text
src/game-v1.js              integration/runtime loop
src/v1/catalog.js           block/item/biome/recipe/dimension registries
src/v1/world.js             chunks, worldgen, fluids, block states, weather, random ticks
src/v1/lighting.js          cached sky/block lighting propagation
src/v1/systems.js           ItemStack, inventory, survival, XP/effects, crafting/furnace
src/v1/entities.js          entity simulation, AI, projectiles, breeding, boss
src/v1/automation.js        Flux, pistons, rails, minecarts, portals, explosions, gamerules
src/v1/renderer.js          textured chunk/entity/weather rendering
src/v1/texture-atlas.js     original procedural voxel texture atlas
src/v1/save-db.js           IndexedDB worlds, backups and migrations
src/v1/commands.js          commands/admin layer
src/v1/multiplayer.js       browser multiplayer protocol/interpolation
src/v1/content-systems.js   trading, fishing, brewing, exploration map, statistics
src/v1/addons.js            Field Guide integration UI
server/server.mjs           optional authoritative multiplayer server
```

The architecture deliberately separates serializable simulation state from Three.js scene objects. That is necessary for saves, testing, world switching and server authority.

## Scope note

This V1 branch implements a very broad, playable **Minecraft-like system surface**, but it is not and should not be described as a literal feature-for-feature copy of the modern commercial Minecraft releases. Minecraft has accumulated an enormous catalog of individual blocks, mobs, structures, edge cases, networking behavior and content over many years. VoxelCraft instead targets the complete gameplay *categories*: world generation, mining/building, survival progression, farming, automation, exploration, dimensions, boss progression, Creative/admin tools, persistence and multiplayer foundations, using original assets and code.
