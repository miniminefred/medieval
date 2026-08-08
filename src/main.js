import { Timer } from 'three';
import { createRenderer, createScene, createCamera, createLighting, handleResize } from './scene.js';
import { createInput } from './input.js';
import { ModelLibrary } from './models.js';
import { buildWorld } from './world.js';
import { buildVillage } from './village.js';
import { createGrass } from './grass.js';
import { Player } from './player.js';
import { Viewmodel } from './viewmodel.js';

const renderer = createRenderer();
const scene = createScene();
const camera = createCamera();
createLighting(scene);
handleResize(renderer, camera);

// The prop GLBs have to be in memory before anything can be placed, so the whole
// bootstrap is async and the loading screen stays up until the world is standing.
const library = await new ModelLibrary().load();

const world = buildWorld(scene, library);
const village = buildVillage(scene, library);
const colliders = world.colliders.concat(village.colliders);

// Blades follow the player and skip anywhere the village says is built on —
// roads, the plaza, footprints, the courtyard and the pond.
const grass = createGrass(scene, { radius: 60, density: 34, exclude: village.isOccupied });

const keys = createInput();
const player = new Player(camera, renderer.domElement, keys, colliders);
scene.add(camera);

// The rod rides on the camera. The first click grabs pointer lock (input.js), so
// only clicks that arrive while already locked are casts.
const viewmodel = new Viewmodel(camera, library);
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0 && player.isLocked) viewmodel.cast();
});

document.getElementById('loading')?.classList.add('hidden');

// Dev-only handle so the world can be flown around and inspected from the console
// (there is no scene editor by design — this is how we look at what we built).
if (import.meta.env.DEV) {
  window.__medieval = { renderer, scene, camera, library, world, village, grass, viewmodel, player };
}

const timer = new Timer();

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05); // clamp so a lag spike can't tunnel

  player.update(dt, camera);
  grass.update(dt, player.object.position);
  village.update(dt);
  viewmodel.update(dt, { speed: player.speed, grounded: player.grounded, locked: player.isLocked });
  renderer.render(scene, camera);
}
animate();
