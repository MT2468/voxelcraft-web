# VoxelCraft QA

## Automated gates

- [ ] `src/game.js` parses with `node --check`
- [ ] Required static files exist and are non-empty
- [ ] HTML imports the game module
- [ ] HTML import map pins Three.js 0.185.1
- [ ] Pointer lock, chunk rebuild and local save systems are present

## Runtime playtest checklist

- [ ] Main menu renders over the WebGL scene
- [ ] Clicking **Entrar no mundo** acquires pointer lock
- [ ] Mouse look works without camera roll
- [ ] WASD movement respects camera yaw
- [ ] Sprint is faster than walk
- [ ] Gravity lands the player on voxel surfaces
- [ ] Space jumps only while grounded
- [ ] Player cannot move through solid blocks
- [ ] Crosshair block targeting matches visible face
- [ ] Left click removes the targeted block
- [ ] Right click adds the selected block on the adjacent face
- [ ] Placement cannot trap a block inside the player collider
- [ ] 1–8 and mouse wheel change the hotbar selection
- [ ] E opens the block inventory
- [ ] Esc pauses and releases pointer lock
- [ ] Chunk boundaries do not leave holes after edits
- [ ] Save/load preserves seed, player position and block edits
- [ ] New world generates a different seed
- [ ] Day/night lighting changes over time
- [ ] Resize keeps correct camera aspect ratio
- [ ] FPS remains playable across the generated 64×64 world

## Known scope boundaries

This build intentionally does not yet implement multiplayer, hostile/passive mobs, combat, hunger, crafting recipes, furnaces, redstone-like logic, fluids, caves, structures, dimensions or infinite streamed terrain.
