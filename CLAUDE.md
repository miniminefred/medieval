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
index.html        Thin entry shell (overlay markup + <script src="/src/main.js">)
vite.config.js    Dev/preview server pinned to port 8091
src/
  main.js         Bootstrap: wires modules, runs the render loop
  scene.js        Renderer, scene, camera, daylight, resize handling
  world.js        Static world geometry (ground, curtain wall, towers, keep, props)
  input.js        Keyboard state + pointer-lock overlay wiring
  player.js       Player class: PointerLockControls + movement + jump + AABB collision
  style.css       All UI/overlay/crosshair styling
```

## Tech stack

- **Engine:** Three.js (npm `three`)
- **Bundler / dev server:** Vite (`npm run dev` / `npm run build` / `npm run preview`)
- **Rendering:** WebGL (`THREE.WebGLRenderer`, antialias + shadow maps)
- **Camera:** `PerspectiveCamera` driven by `PointerLockControls`
- **Input:** Pointer Lock API — click to grab the mouse, `Esc` to release
- **Physics:** hand-rolled (gravity + per-axis AABB resolution); no physics library
- **Assets:** none — geometry and materials are created procedurally in code

## Controls

| Key | Action |
|-----|--------|
| Mouse | Look around (when pointer is locked) |
| W A S D | Move (relative to look direction) |
| Shift | Run |
| Space | Jump |
| Esc | Release the mouse |
| Click | Grab the mouse (lock pointer) |

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
Everything visible is built procedurally: ground plane, courtyard floor, a curtain wall with
a gateway gap, four round corner towers, a central keep with steps, and scattered crates.
`buildWorld` returns the collider AABBs and meshes it created.
