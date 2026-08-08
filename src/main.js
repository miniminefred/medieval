import { Timer } from 'three';
import { createRenderer, createScene, createCamera, createLighting, handleResize } from './scene.js';
import { createInput } from './input.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';

const renderer = createRenderer();
const scene = createScene();
const camera = createCamera();
createLighting(scene);
handleResize(renderer, camera);

const { colliders } = buildWorld(scene);

const keys = createInput();
const player = new Player(camera, renderer.domElement, keys, colliders);
scene.add(camera);

const timer = new Timer();

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05); // clamp so a lag spike can't tunnel

  player.update(dt, camera);
  renderer.render(scene, camera);
}
animate();
