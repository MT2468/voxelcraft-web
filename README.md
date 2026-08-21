# VoxelCraft Web

VoxelCraft Web is an original browser-based voxel sandbox inspired by the building and exploration loop of Minecraft. It is implemented from scratch with Three.js and browser APIs and does **not** ship Mojang/Microsoft game code, textures, sounds, models, or other proprietary assets.

## Current playable systems

- Procedural seeded 64×64 voxel world split into 16×16 render chunks
- Plains, desert and snow terrain variation
- Procedural trees and moving block clouds
- First-person mouse look with pointer lock
- WASD movement, sprint, jump, gravity and voxel collision
- Block targeting outline with six-block reach
- Left-click block breaking and right-click block placement
- Eight-slot hotbar plus scroll-wheel / number-key selection
- Inventory panel (`E`)
- Day/night lighting, sky and fog changes
- Local browser save with world seed, edits and player position
- Automatic save every 20 seconds and on pause/exit
- Responsive HUD and reduced-motion UI handling
- Chunk-only mesh rebuilding after block edits

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look |
| W A S D | Move |
| Space | Jump |
| Shift | Sprint |
| Left click | Break targeted block |
| Right click | Place selected block |
| 1–8 | Select hotbar slot |
| Mouse wheel | Cycle hotbar |
| E | Open block inventory |
| Esc | Pause / release mouse |

## Run

Serve the repository with any static HTTP server and open `index.html`. The page imports Three.js 0.185.1 from jsDelivr using an import map, so no build step is required.

Examples:

```bash
python -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080`.

## Architecture

- `index.html` — WebGL canvas, import map, menu and HUD
- `style.css` — responsive UI and hotbar/inventory presentation
- `src/game.js` — procedural world data, chunk meshing, controls, collisions, block editing, save system and render loop
- `.github/workflows/ci.yml` — syntax and required-file checks

The voxel renderer generates only exposed cube faces instead of one complete cube mesh per block. Chunks are rebuilt locally after edits to avoid rebuilding the whole world for a single block change.

## Scope

This repository is a serious Minecraft-like browser prototype, not a literal feature-for-feature reconstruction of modern Minecraft. A literal full clone would additionally require a much larger set of systems such as networking, mobs, combat, crafting recipes, furnaces, redstone-like simulation, fluids, structures, dimensions, audio, world streaming, persistence services and extensive content.
