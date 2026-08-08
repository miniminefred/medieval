# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Alfred — Medieval

Browser-based 3D **first-person medieval game** built with **Three.js**, bundled by **Vite**.
It is *not* a shooter — no guns, no crosshair-and-trigger loop. The starting point is a
walled courtyard you can walk around in; where it goes from there is open.

The code is split into small ES modules under `src/` — **never let a single file grow
without bound**; when a module gets large or mixes concerns, split it.

## The one hard rule: AI-only development

This project is developed entirely by Claude writing code — **no visual/scene editor**
(no Unity, no Godot editor, no Blender-in-the-loop). Build tooling, bundlers, package
managers, and CLIs are all fair game; a GUI world-builder is not. Everything is expressed
in code so an AI can author and reason about all of it.

## Why Three.js + Vite

Same reasoning as the sibling `fpsgame` project: Three.js is code-first with no editor
required and has by far the largest ecosystem / documentation corpus of any web 3D engine —
the most reliable target for an AI writing everything by hand. Vite gives us real modules,
npm dependencies, HMR, and a production build with zero config friction.

## Launching a session

Desktop shortcut **Create Medieval** runs `..\launch-medieval.ps1`, a thin wrapper over
`C:\Users\alfred\projects\launch-claude.ps1 -Game medieval`. That script opens a
**Windows Terminal** tab hosting **PowerShell 7**, forces UTF-8 in and out so Claude's TUI
(box drawing, spinners) renders correctly, `cd`s here, runs `npm install` if `node_modules`
is missing, then starts `claude`. `-NoExit` keeps the shell in this directory after Claude
exits, ready for `npm` / `git`.

The whole launcher chain is PowerShell — no `.bat`/cmd launchers. The launcher lives in the
parent directory, so it is outside this repo and not version-controlled here.

## Rules for every session

### 1. Commit every change immediately
After **every** file edit — no exceptions — stage and commit before moving on:
```bash
git add -A
git commit -m "<short description of what changed>"
```
One logical change = one commit. Never batch multiple changes into one commit, and never
leave changes uncommitted at the end of a session. This is the rollback safety net.

### 2. Start the dev server on session start
Check if already running; start if not:
```powershell
npm run dev
```
Vite serves the game at **http://localhost:8091** (8080 is the blobgame, 8090 the fpsgame,
so all three coexist) and opens the browser automatically. HMR reloads on every save — no
manual refresh needed.

First time on a fresh clone: `npm install`.

### 3. Test after every change
Verify in the browser before considering the task done. `npm run build` must also stay
green (it catches import mistakes HMR can hide).

## Project layout

```
index.html        Thin entry shell (loading + overlay markup + <script src="/src/main.js">)
vite.config.js    Dev/preview server pinned to port 8091
src/
  main.js         Bootstrap: loads models, wires modules, runs the render loop
  scene.js        Renderer, scene, camera, daylight, resize handling
  world.js        The castle: ground, curtain wall, towers, keep, courtyard props
  village.js      Everything outside the walls: roads, village, farm, pasture, pond, woods
  grass.js        Instanced wind-blown grass field + the procedural ground material
  models.js       ModelLibrary: loads the prop GLBs and normalises them
  model-table.js  Per-model real-world size / orientation / collision settings
  viewmodel.js    The fishing rod held in first person (bob, sway, casting)
  input.js        Keyboard state + pointer-lock overlay wiring
  player.js       Player class: PointerLockControls + movement + jump + AABB collision
  style.css       All UI/overlay/crosshair styling
tools/
  poly.mjs           Poly Pizza scraper (search / info / download one model)
  fetch-props.mjs    The model shopping list — downloads them + writes manifest & credits
  measure-models.mjs Prints each GLB's raw bounding box (input for model-table.js)
public/models/medieval/
  *.glb              70 CC0 low-poly props by Quaternius
  manifest.json      key -> title/author/licence/source
  CREDITS.md         attribution table
```

## Tech stack

- **Engine:** Three.js (npm `three`)
- **Bundler / dev server:** Vite (`npm run dev` / `npm run build` / `npm run preview`)
- **Rendering:** WebGL (`THREE.WebGLRenderer`, antialias + shadow maps)
- **Camera:** `PerspectiveCamera` driven by `PointerLockControls`
- **Input:** Pointer Lock API — click to grab the mouse, `Esc` to release
- **Physics:** hand-rolled (gravity + per-axis AABB resolution); no physics library
- **Assets:** CC0 low-poly GLBs from [Poly Pizza](https://poly.pizza) (all Quaternius), plus
  procedural geometry for the castle, ground and grass

## Assets — where props come from

The same source as the sibling `fpsgame`: **Poly Pizza**, which hosts Quaternius' CC0
low-poly packs. There is no public download API without a key, so `tools/poly.mjs` scrapes
the server-rendered pages (`/search/<term>` for candidates, `/m/<id>` for the embedded JSON
with the asset's `ResourceID`, then `https://static.poly.pizza/<ResourceID>.glb`).

Adding a prop is three steps, all in code:

1. `node tools/poly.mjs search "hay bale"` — find a candidate, note its id.
2. Add `['hay', '<id>']` to `WANTED` in `tools/fetch-props.mjs`, then run it. It downloads
   into `public/models/medieval/` and regenerates `manifest.json` + `CREDITS.md`.
3. Add an entry to `MODELS` in `src/model-table.js` saying how big the thing is in the real
   world. `node tools/measure-models.mjs` prints the raw box to base that on.

Raw models arrive at wildly inconsistent scales, so nothing is placed at its native size:
`model-table.js` states one real-world dimension per model (`fit: 'height' | 'length'`) and
`models.js` scales uniformly to hit it, then centres the model on X/Z and seats its base at
y = 0. Placement code therefore only ever deals in metres. **Never hard-code a per-model
scale fudge at a call site** — fix the table instead.

## Controls

| Key | Action |
|-----|--------|
| Mouse | Look around (when pointer is locked) |
| W A S D | Move (relative to look direction) |
| Shift | Run |
| Space | Jump |
| Esc | Release the mouse |
| Click | Grab the mouse (lock pointer); once locked, cast the fishing rod |

## Key systems

### Pointer lock (`input.js` + `player.js`)
Clicking the canvas or overlay requests pointer lock; a centered overlay prompts for the
click and hides while locked. `Esc` (browser default) exits lock and re-shows the overlay.

### Movement (`player.js`)
WASD sets a wish-velocity in camera-local space each frame, projected onto the horizontal
plane so pitch doesn't affect walk speed, then eased toward with an exponential so starting
and stopping have weight. Movement resolves one axis at a time against the world's collider
AABBs: boxes taller than the feet (plus a small step epsilon) block, lower ones are stood
on. Space jumps only when grounded. `dt` is clamped to 50 ms to avoid tunneling on lag
spikes.

### World (`world.js`)
The castle is still pure procedural geometry: ground plane, courtyard floor, a curtain wall
with a gateway gap, four round corner towers and a central keep with steps. Its clutter —
barrels, hay, a horse, torches, banners — comes from the model library. `buildWorld(scene,
library)` returns the collider AABBs and meshes it created, and falls back to plain boxes
if no library is passed.

### Village (`village.js`)
`buildVillage(scene, library)` places everything outside the walls from one seeded RNG, so
the settlement is identical on every reload. A `ZoneGrid` (uniform 8 m spatial hash of
rectangles) does double duty: during the build it answers "is this spot taken" for overlap
rejection, and afterwards it backs `isOccupied(x, z)`, which is what the grass asks before
growing a blade. Returns `{ colliders, meshes, isOccupied, update }`.

### Grass (`grass.js`)
`createGroundMaterial()` bakes a seamless canvas noise texture for the ground plane;
`createGrass()` scatters 130k instanced blades in tufts of four across a square patch that
**wraps around the player like a torus** — a blade that falls off one edge reappears a full
span away, which keeps the scatter uniform however far the player jumps, instead of piling
up at the rim. Recycling is budgeted per frame so there is no hitch. Wind is entirely in the
vertex shader (two travelling sine waves via `onBeforeCompile`), bending each blade in
proportion to height so the base stays planted. Blades never grow where `exclude(x, z)`
returns true. The patch is seeded at the spawn point so it is already there on frame one.

### Held fishing rod (`viewmodel.js`)
The rod is parented to the camera, gripped low-right, and everything about it lives in
camera space. It draws with `depthTest: false` on **cloned** materials and a high
`renderOrder` so it never pokes through masonry — cloning matters because the world's own
copies of the same GLB share the prototype's materials. Idle breathing, speed-scaled walk
bob, a turn-lag sway and a landing dip all ease toward targets rather than snapping.
`cast()` runs a rewind → whip → fly → hang → reel timeline; the line is a parabola sampled
between the rod tip and the bobber, not simulated.
