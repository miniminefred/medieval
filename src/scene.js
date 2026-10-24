import * as THREE from 'three';

// Renderer, scene, camera and resize handling. Each realm brings its own lights.

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

export function handleResize(renderer, camera) {
  addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
