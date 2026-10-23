# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Alfred — Medieval

Browser-based 3D **first-person fantasy/medieval adventure** built with **Three.js**,
bundled by **Vite**. It is *not* a shooter — no crosshair-and-trigger loop (the cyborg
clan's plasma cannon is a deliberate exception). Five worlds, four clans, a Lava King to
beat: **the full game plan lives in `docs/DESIGN.md` — read it before adding features.**

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

**Every commit is `miniminefred` and nothing else** —
`miniminefred <315911906+miniminefred@users.noreply.github.com>`, which is set globally
in `~/.gitconfig` and again as this repo's local config. Never commit as `Oyvind
<oyvhvi@attensi.com>`, never as `Alfred Hvidsten <alfred@cathedral-networks.org>` (two
early commits here were his, and were rewritten), and never add a `Co-Authored-By:
Claude ...` trailer or a "Generated with Claude Code" line. This repo is **public**, so a
commit under the work address publishes it in permanent history: the whole history was
rewritten and force-pushed on 2026-08-11 to get it out again. See `~/.claude/CLAUDE.md`.

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

## Publishing — GitHub Pages

Public at **github.com/miniminefred/medieval**, live at
**https://miniminefred.github.io/medieval/**. `.github/workflows/deploy.yml` builds and
publishes on every push to `master`, plus manual dispatch. Three things in it are
load-bearing:

- **The Pages base path is passed on the command line, not set in `vite.config.js`** —
  `npm run build -- --base=/medieval/`. Pages serves from a subpath and Vite writes asset
  URLs at build time, so without it every script and every GLB resolves to `/assets/...`
  and 404s. Keeping it in the workflow is what lets `npm run dev` and `npm run preview` go
  on serving from `/` exactly as before — local development is untouched by any of this.
- **`pages: write` and `id-token: write`** are both required: `deploy-pages` authenticates
  to Pages with an OIDC token, so a job holding only `contents: read` builds fine and then
  fails on the last step.
- **The `github-pages` environment carries a deployment branch allowlist**, built from
  whatever the default branch was *when Pages was first enabled*. This repo is on `master`
  but Pages was enabled while the fresh empty repo still defaulted to `main`, so the very
  first deploy was rejected — a green build and a failed deploy, which is a confusing way
  to find out. `master` was added to the allowlist to fix it; rename the branch and it will
  need doing again.

**Any asset URL built from a string at runtime must ask for the base itself**, and this is
the trap that actually shipped. Vite rewrites the asset references it can *see* — a static
import, an `href`, a `url()` — and a prefix that a path is concatenated onto is none of
those. `src/model-table.js` held `MODEL_DIR = '/models/medieval/'`: root-absolute, perfect
on the dev server, and on Pages it asked `miniminefred.github.io` for files that live under
`/medieval/`. Every model 404ed, so the deployed village came up bare while local was
fine. It now reads `(import.meta.env?.BASE_URL ?? '/') + 'models/medieval/'`, the `?? '/'`
keeping it safe anywhere `import.meta.env` does not exist.

The failure is quiet — a model that will not load leaves the prop to its fallback rather
than throwing — so prefer *relative* asset paths, which resolve against the document and
pick the subpath up for free, and derive anything that must be absolute from `BASE_URL`.

One trap when running the build by hand in **Git Bash**: MSYS path conversion rewrites
`--base=/medieval/` into `--base=/Program Files/Git/medieval/`. It builds green and emits a
bundle whose asset paths cannot resolve. `MSYS_NO_PATHCONV=1` prevents it; PowerShell and
the Ubuntu runner do not have the problem.

## Project layout

```
index.html        Thin entry shell (loading + overlay markup + <script src="/src/main.js">)
vite.config.js    Dev/preview server pinned to port 8091
src/
  main.js         Bootstrap, realm switching (portals, fade, F2 dev hop), render loop
  scene.js        Renderer, scene, camera, castle daylight, resize handling
  castle.js       The castle realm: world + village + grass + portal to World 1
  portal.js       Standing stone portal with a light sheet; isInside(feet) triggers travel
  sky.js          Sky dome whose horizon colour is driven to match the fog
  noise.js        Seeded Perlin noise, fbm, ridged — the source of all procedural land
  wasteland/      World 1 realm (see docs/DESIGN.md)
    index.js        The realm: lights, HDRI, area moods, portal home
    terrain.js      3 km heightfield + ground-type weights (pure functions of x, z)
    terrain-material.js  Blends five Poly Haven textures by splat, slope and altitude
    sandstorm.js    Wind-blown dust/snow points; thick in the rim storm
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
  polyhaven.mjs      Downloads the realistic textures + HDRI from Poly Haven
  shot.mjs           Screenshots the running game via headless Chrome (needs npm run dev)
docs/DESIGN.md    The game plan: worlds, clans, the Lava King. Read before adding features.
dev-models.html   Dev-only model gallery (http://localhost:8091/dev-models.html)
public/models/medieval/
  *.glb              77 CC0 low-poly props, almost all by Quaternius
  manifest.json      key -> title/author/licence/source
  CREDITS.md         attribution table
public/textures/<key>/{diff,nor}.jpg  CC0 photo-scanned ground (sand, dry, burned, rock, snow)
public/hdri/*.hdr                     CC0 sky light
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

**Always look at a model before shipping it.** Open `/dev-models.html` — a grid of every
model beside a 1.8 m human reference, with its key, measured size and a +Z facing arrow.
Titles lie: a search for "town sign" returned a modern steel motorway gantry, and every
Quaternius "barn" is a red American gambrel barn. Four assets were thrown out this way;
`REJECTED` in `tools/fetch-props.mjs` records them so nobody re-shops the same mistake.

Raw models arrive at wildly inconsistent scales, so nothing is placed at its native size:
`model-table.js` states one real-world dimension per model (`fit: 'height' | 'length'`) and
`models.js` scales uniformly to hit it, then centres the model on X/Z and seats its base at
y = 0. Placement code therefore only ever deals in metres. **Never hard-code a per-model
scale fudge at a call site** — fix the table instead.

Two loader details that are easy to break and hard to spot:
- Clones go through `SkeletonUtils.clone()`, not `Object3D.clone()`. The animals are
  SkinnedMeshes, and a plain clone stays bound to the *prototype's* skeleton — every cow
  in the world silently draws back at the origin instead of in the field.
- Both `Box3.setFromObject` calls pass `precise = true`. The cheap path inflates the bounds
  of rotated child nodes, which made the cart claim a height it did not have and float
  0.76 m off the ground.

## Controls

| Key | Action |
|-----|--------|
| Mouse | Look around (when pointer is locked) |
| W A S D | Move (relative to look direction) |
| Shift | Run |
| Space | Jump |
| Esc | Release the mouse |
| Click | Grab the mouse (lock pointer); once locked, cast the fishing rod |
| F2 | Dev server only: hop between the castle and the wasteland |

## Key systems

### Pointer lock (`input.js` + `player.js`)
Clicking the canvas or overlay requests pointer lock; a centered overlay prompts for the
click and hides while locked. `Esc` (browser default) exits lock and re-shows the overlay.

### Movement (`player.js`)
WASD sets a wish-velocity in camera-local space each frame, projected onto the horizontal
plane so pitch doesn't affect walk speed, then eased toward with an exponential so starting
and stopping have weight. Movement resolves one axis at a time against the world's collider
AABBs: boxes taller than the feet (plus a small step epsilon) block, lower ones are stood
on. The floor is `groundAt(x, z)` (0 in the castle, terrain in the wasteland); terrain
steeper than 45° blocks like a wall, `canStand` is the hard world edge, and walking
downhill snaps to the ground rather than falling step by step. Space jumps only when grounded. `dt` is clamped to 50 ms to avoid tunneling on lag
spikes.

### Realms (`main.js`, `castle.js`, `wasteland/`)
Each world is a *realm*: built once on first visit into its own `THREE.Group`, then
attached and detached as the player travels. `enter(ctx)` adds the group and owns the
scene-wide settings it needs (background, fog, environment, tone mapping, camera far,
and the player's `setWorld({ colliders, groundAt, canStand })`); `exit` removes it.
Each realm lists `portals`; walking into one fades to black and calls `travel(target)`.
The game currently **starts in the wasteland** (`START` in `main.js`).

### Wasteland (`wasteland/`)
The land is a pure function of (x, z) from one noise seed: `biomeAt` gives sand / dry /
burned / snow weights (snow across the south, +Z), `shapeAt` stacks swells, wind-shaped
dunes, burned lumps, snowy hills and a varied mountain massif at the rim. The mesh is a
640² grid and `heightAt` interpolates **that grid's triangles**, not the analytic shape, so
feet match the drawn ground exactly. The ground shader sticks to `MeshStandardMaterial` via
`onBeforeCompile` (keeping lights, shadows, fog, HDRI) and only colour/normal/roughness
are replaced; each texture is sampled at two scales to hide tiling, rock is projected
from the side on steep faces. Only diffuse + normal maps are used: 5 surfaces × 3 maps
would blow the 16 texture units WebGL guarantees.

Mood follows the player: `MOODS` (desert, burned, snow, storm, blizzard) are blended by
the biome and storm weights under the player and eased toward each frame. Fog is
`FogExp2`, and **the mountains are never meant to be seen from inside the map** (owner's
call): the fog density has a floor of `1.9 / (distance to the nearest possible mountain
foot)`, so the closer you walk to the rim the thicker the haze, until the storm takes
over. The terrain fogs toward `skyColor(viewDir)` — the sky dome's own GLSL (`SKY_GLSL`
in `sky.js`) — not a flat colour, so a fogged peak leaves no silhouette. That fog colour
must be tone-mapped and sRGB-converted by hand: three applies fog *after* both, the sky
gets both, and skipping it left every peak as a dark ghost against the sky. Two traps found the hard way: a dust puff larger than the GPU's max point size
gets clipped into a hard disc, so puffs fade by *on-screen* size; and a two-stop CSS
vignette draws a visible ring over a flat storm sky — it is eased over many stops now.

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
