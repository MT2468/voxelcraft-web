# VoxelCraft Web

VoxelCraft Web is an original browser-based voxel sandbox inspired by the building, mining and exploration loop of Minecraft. It is implemented from scratch with Three.js and browser APIs and does **not** ship Mojang/Microsoft game code, textures, sounds, models, or other proprietary assets.

## Current playable systems

- Procedural seeded 64×64 voxel world split into 16×16 render chunks
- Plains, desert and snow terrain variation
- Deterministic 3D-noise caves under the surface
- Underground coal, iron, gold and diamond ore distribution by depth
- Procedural trees and moving block clouds
- First-person mouse look with pointer lock
- WASD movement, sprint, jump, gravity and voxel collision
- World-edge collision so the player cannot walk out of the generated map
- Optional creative flight with `F`; Space rises and Ctrl descends
- Sprint FOV feedback
- Block targeting outline with six-block reach
- Hold-to-mine block hardness instead of instant destruction
- Break particles and procedural WebAudio mining, placing, footsteps, jump and landing effects
- Right-click block placement with player-overlap prevention
- Nine-slot hotbar plus scroll-wheel / number-key selection
- Inventory panel (`E`)
- Day/night lighting, sky and fog changes
- `F3` debug overlay with FPS, coordinates, chunk, seed and movement mode
- Local browser save with seed, time, player position/rotation, block edits, hotbar and flight state
- Automatic save every 20 seconds and on pause/exit
- Responsive HUD and reduced-motion UI handling
- Chunk-only mesh rebuilding after block edits
- Deterministic procedural-noise unit tests plus automated syntax/integration checks in GitHub Actions

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look |
| W A S D | Move |
| Space | Jump / rise while flying |
| Ctrl | Descend while flying |
| Shift | Sprint / faster flight |
| Hold left click | Mine targeted block according to hardness |
| Right click | Place selected block |
| 1–9 | Select hotbar slot |
| Mouse wheel | Cycle hotbar |
| E | Open block inventory |
| F | Toggle creative flight |
| F3 | Toggle debug overlay |
| Esc | Pause / release mouse |

## Run locally

Serve the repository with any static HTTP server and open `index.html`. The page imports Three.js 0.185.1 from jsDelivr using an import map, so there is no bundling step.

```bash
python -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080`.

## Verify

Node 24+ can run the same verification used by CI:

```bash
npm run check
npm test
```

## Architecture

- `index.html` — WebGL canvas, import map, menu and HUD; loads the enhanced runtime
- `style.css` — base responsive UI
- `style-plus.css` — mining progress, mode badge and nine-slot responsive additions
- `src/game-plus.js` — world generation, chunk meshing, caves/ores, player controller, mining, particles, save system and render loop
- `src/noise.js` — deterministic 2D/3D value noise and FBM helpers
- `src/audio.js` — asset-free procedural WebAudio effects
- `src/game.js` — preserved first playable runtime for reference
- `test/noise.test.js` — procedural generation unit tests
- `.github/workflows/ci.yml` and `ci-plus.yml` — syntax, unit and integration gates

The renderer emits only exposed voxel faces rather than creating a full cube mesh for every block. Chunks are rebuilt locally after edits, keeping block interaction substantially cheaper than rebuilding the whole world.

## Scope

This is now a substantial Minecraft-like browser game prototype, not a literal feature-for-feature reconstruction of modern Minecraft. A full equivalent would still require major systems such as streamed/infinite terrain, fluids, survival inventory counts, crafting/furnaces, mobs and combat, structures, redstone-like simulation, dimensions, multiplayer/server authority, achievements, settings/accessibility depth and a much larger content/audio/asset set.
