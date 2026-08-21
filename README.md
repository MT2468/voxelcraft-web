# VoxelCraft Web

VoxelCraft Web is an original browser-based voxel survival sandbox inspired by the building, mining and exploration loop of Minecraft. It is implemented from scratch with Three.js and browser APIs and does **not** ship Mojang/Microsoft game code, textures, sounds, models, or other proprietary assets.

## Current playable systems

- Deterministic streamed world made from 16×16 chunks instead of a fixed 64×64 map
- Runtime chunk loading/unloading around the player, with persistent player edits across unloads
- 48-block vertical world with oceans at sea level
- Plains, forest, desert and snow biomes
- Deterministic caves and coal, iron, gold and diamond ore distribution by depth
- Cross-chunk procedural trees, moving block clouds and occasional generated huts
- Separate transparent water mesh plus swimming movement
- First-person mouse look with pointer lock
- WASD movement, sprint, jump, gravity, voxel collision, fall damage and death/respawn
- Optional free flight with `F` for exploration/testing; Space rises and Ctrl descends
- Sprint/swim FOV feedback
- Block targeting outline with six-block reach
- Hold-to-mine hardness with tool speed and harvest tiers
- Wood, stone and iron pickaxes; wood and stone swords; per-tool durability
- Correct basic drops for stone and ores, including coal and diamond drops by tool tier
- Counted inventory and configurable nine-slot hotbar
- Crafting for planks, sticks, tools and swords
- Lightweight smelting progression for iron/gold after collecting enough cobblestone to unlock it
- Health, hunger, saturation, exhaustion, starvation and health regeneration
- Apples and raw pork as food
- Block placement consumes inventory instead of creating infinite blocks
- Passive blocky pigs with pork drops
- Hostile blocky zombies that spawn mainly at night, chase and damage the player
- First-person melee combat, knockback and mob drops
- Break particles and procedural WebAudio for mining, placing, footsteps, jumping and landing
- Day/night lighting, sky and fog changes
- `F3` debug overlay with FPS, coordinates, chunk, seed and movement mode
- Save v4 with seed, time, player position/rotation, chunk edits, inventory, survival state and mobs
- Migration of v3 world edits into the v4 save format
- Automatic save every 20 seconds and on pause/exit
- Responsive survival HUD with hearts, hunger, item counts and tool durability

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look |
| W A S D | Move |
| Space | Jump / swim up / rise while flying |
| Ctrl | Descend while flying |
| Shift | Sprint / faster flight |
| Hold left click | Mine targeted block; attacks a mob when one is closer |
| Right click | Place selected block or eat selected food |
| 1–9 | Select hotbar slot |
| Mouse wheel | Cycle hotbar |
| E | Open inventory and crafting |
| F | Toggle free flight |
| F3 | Toggle debug overlay |
| Esc | Pause / release mouse |

## Verification

The project has three automated gates on pull requests:

1. JavaScript syntax and required-file integration checks.
2. Node unit tests for procedural noise, inventory, crafting, harvest tiers, drops, durability and survival state.
3. A real Chromium/Playwright WebGL smoke test that serves the repository over HTTP, loads the generated world, checks the canvas/HUD/save state, enters gameplay and captures screenshots.

Run the Node checks locally with Node 24+:

```bash
npm run check
npm test
```

## Run locally

Serve the repository with any static HTTP server. Three.js is imported from jsDelivr using an import map, so there is no application bundling step.

```bash
python -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080`.

## Architecture

- `index.html` — canvas, import map, menu, HUD and v4 entry point
- `style.css` / `style-plus.css` / `style-v4.css` — layered responsive UI styles
- `src/game-v4.js` — streamed chunk runtime, world generation, rendering, player controller, water, mining, combat, save integration and game loop
- `src/survival.js` — items, counted inventory, recipes, tool tiers/durability, drops, health and hunger state
- `src/mobs.js` — pig/zombie models, spawning, movement AI, attacks, raycast combat and mob persistence
- `src/noise.js` — deterministic 2D/3D value noise and FBM helpers
- `src/audio.js` — asset-free procedural WebAudio effects
- `src/game-plus.js` and `src/game.js` — preserved earlier runtimes for regression/reference
- `test/noise.test.js` and `test/survival.test.js` — unit tests
- `test/browser-smoke.mjs` — real browser/WebGL smoke test
- `.github/workflows/` — CI and Chromium gates

Voxel geometry emits only exposed block faces. Only nearby chunks keep rendered meshes; farther chunks are discarded and regenerated deterministically when revisited, while explicit block edits remain in the save data.

## Scope

VoxelCraft v4 is a substantial single-player voxel survival game, but it is still **not a literal feature-for-feature reimplementation of modern Minecraft**. Systems still outside the current scope include true block-light propagation and torches, a physical furnace/crafting-table GUI, armor/enchanting, farming, additional mobs and AI, advanced fluid simulation, redstone-like circuits, Nether/End-style dimensions, multiplayer/server authority, villages/large structures, achievements and the enormous content surface accumulated by Minecraft over many years.
