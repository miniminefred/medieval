import * as THREE from 'three';

// Renderer, scene, camera, lights and resize handling.

// Pale overcast sky — the same colour is used for fog so the horizon dissolves
// into it instead of ending at a hard line.
const SKY = 0xa8b6c4;

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in three r185 (it falls back to PCFShadowMap
  // anyway), so ask for PCFShadowMap directly and soften via shadow.radius.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 40, 220);
  return scene;
}

export function createCamera() {
  return new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 600);
}

// Outdoor daylight: warm sun casting shadows, cool sky bounce filling them.
export function createLighting(scene) {
  const hemi = new THREE.HemisphereLight(SKY, 0x4a4436, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d4, 2.1);
  sun.position.set(45, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0006;

  // Shadow frustum sized to the keep and its courtyard.
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = 220;
  cam.left = -70;
  cam.right = 70;
  cam.top = 70;
  cam.bottom = -70;
  cam.updateProjectionMatrix();

  scene.add(sun);
  scene.add(sun.target);

  return { hemi, sun };
}

export function handleResize(renderer, camera) {
  addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
