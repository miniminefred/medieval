import { Timer } from 'three';
import { createRenderer, createScene, createCamera, createLighting, handleResize } from './scene.js';
import { createInput } from './input.js';
import { ModelLibrary } from './models.js';
import { buildWorld } from './world.js';
import { buildVillage } from './village.js';
import { Player } from './player.js';

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

const keys = createInput();
const player = new Player(camera, renderer.domElement, keys, colliders);
scene.add(camera);

document.getElementById('loading')?.classList.add('hidden');

// Dev-only handle so the world can be flown around and inspected from the console
// (there is no scene editor by design — this is how we look at what we built).
if (import.meta.env.DEV) {
  window.__medieval = { renderer, scene, camera, library, world, village, player };
}

const timer = new Timer();

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05); // clamp so a lag spike can't tunnel

  player.update(dt, camera);
  village.update(dt);
  renderer.render(scene, camera);
}
animate();
