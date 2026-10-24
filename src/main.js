import { Timer } from 'three';
import { createRenderer, createScene, createCamera, handleResize } from './scene.js';
import { createInput } from './input.js';
import { ModelLibrary } from './models.js';
import { createCastleRealm } from './castle.js';
import { onClanChosen, runMultiplier, staminaSeconds } from './clans.js';
import { Player } from './player.js';
import { Viewmodel } from './viewmodel.js';
import { hud } from './hud.js';
import { inventory } from './inventory.js';

const renderer = createRenderer();
const scene = createScene();
const camera = createCamera();
handleResize(renderer, camera);

// The prop GLBs have to be in memory before anything can be placed, so the whole
// bootstrap is async and the loading screen stays up until the world is standing.
const library = await new ModelLibrary().load();

const keys = createInput();
const player = new Player(camera, renderer.domElement, keys);
scene.add(camera);

const ctx = { scene, renderer, camera, player };
onClanChosen((id) => {
  player.runMul = runMultiplier(id);
  player.staminaMax = player.stamina = staminaSeconds(id);
});

// ---------------------------------------------------------------- realms
// Each world is a realm (castle.js, wasteland/): built once on first visit, then
// attached and detached as the player walks through portals, so a realm nobody
// has visited yet costs nothing.
//
// Every prince starts at the castle and chooses a clan at the courtyard banners
// (docs/DESIGN.md); the portal there then opens onto World 1.
const START = 'castle';
const realms = {};
const builders = {
  castle: async () => createCastleRealm(library, renderer),
  wasteland: async () => (await import('./wasteland/index.js')).createWastelandRealm(renderer),
};

realms[START] = await builders[START]();
let realm = realms[START];
realm.enter(ctx);
player.teleport(realm.spawn.x, realm.spawn.z, realm.spawn.yaw);

const fade = document.getElementById('fade');
let travelling = false;

async function travel(name) {
  travelling = true;
  fade.classList.add('on');
  await new Promise((r) => setTimeout(r, 450));
  // Give the fade a frame to paint before a slow realm build blocks the thread.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  realms[name] ??= await builders[name]();
  realm.exit(ctx);
  realm = realms[name];
  realm.enter(ctx);
  player.teleport(realm.arrival.x, realm.arrival.z, realm.arrival.yaw);
  fade.classList.remove('on');
  travelling = false;
}

// Dev shortcut while the worlds are being built: F2 hops between them.
if (import.meta.env.DEV) {
  addEventListener('keydown', (e) => {
    if (e.code === 'F2' && !travelling) travel(realm.name === 'castle' ? 'wasteland' : 'castle');
  });
}

// The rod rides on the camera. The first click grabs pointer lock (input.js), so
// only clicks that arrive while already locked are casts.
const viewmodel = new Viewmodel(camera, library);
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0 && player.isLocked) viewmodel.cast();
});

inventory.refresh();
document.getElementById('loading')?.classList.add('hidden');

// Dev-only handle so the world can be flown around and inspected from the console
// (there is no scene editor by design — this is how we look at what we built).
if (import.meta.env.DEV) {
  window.__medieval = { renderer, scene, camera, library, realms, viewmodel, player, travel,
    get realm() { return realm; } };
}

const timer = new Timer();

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05); // clamp so a lag spike can't tunnel

  player.update(dt, camera);
  hud.stamina(player.stamina / player.staminaMax, player.running, player.winded, dt);
  realm.update(dt, ctx);
  if (!travelling) {
    const portal = realm.portals.find((p) => p.isInside(player.feet));
    if (portal) travel(portal.target);
  }
  viewmodel.update(dt, { speed: player.speed, grounded: player.grounded, locked: player.isLocked });
  renderer.render(scene, camera);
}
animate();
