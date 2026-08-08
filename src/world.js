import * as THREE from 'three';
import { createGroundMaterial } from './grass.js';

// Static world geometry: a walled courtyard with corner towers and a keep,
// standing in open grass. Everything is built procedurally in code.
//
// Returns collider AABBs (world space, resting on the ground) so the player can
// walk into them and jump onto the low ones, plus the meshes.

const GROUND_SIZE = 600;

const YARD = 20;        // courtyard half-extent — walls sit on ±YARD
const WALL_H = 6;
const WALL_T = 1.6;
const GATE_W = 6;       // gap in the south wall you walk in through
const YARD_FLOOR_Y = 0.02;   // props sit on the packed-earth floor, not the grass

const MAT = {
  // Procedural grass-and-bare-earth texture; the instanced blades in grass.js
  // stand on top of it and the two are tuned to the same green.
  grass: createGroundMaterial({ repeat: 150 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8d8878, roughness: 0.9 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x6f6a5e, roughness: 0.95 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x5a3a2e, roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 }),
};

export function buildWorld(scene, library = null) {
  const colliders = [];
  const meshes = [];

  // Drops a loaded prop model on the courtyard floor. No-ops when the library is
  // absent or the model failed to load, so the castle always stands regardless.
  function addProp(key, x, z, yaw = 0, scale = 1) {
    if (!library?.has(key)) return null;
    const { object, collider } = library.place(key, x, z, { yaw, scale, y: YARD_FLOOR_Y });
    if (!object) return null;
    scene.add(object);
    meshes.push(object);
    if (collider) colliders.push(collider);
    return object;
  }

  // Adds a box resting on the ground (bottom at y = base) and records its AABB.
  function addBox(x, z, w, h, d, material, base = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, base + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
    colliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      top: base + h,
    });
    return mesh;
  }

  // Round tower: cylinder mesh, square collider (close enough at this scale).
  function addTower(x, z, radius, height) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, height, 16), MAT.stone);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);

    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.25, radius * 1.6, 16), MAT.roof);
    cone.position.set(x, height + radius * 0.8, z);
    cone.castShadow = true;
    scene.add(cone);
    meshes.push(cone);

    const r = radius * 0.92;
    colliders.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, top: height });
  }

  // ----------------------------------------------------------------- ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), MAT.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  meshes.push(ground);

  // Packed-earth courtyard floor, a hair above the grass to avoid z-fighting.
  const yardFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(YARD * 2, YARD * 2),
    new THREE.MeshStandardMaterial({ color: 0x7a6b53, roughness: 1 })
  );
  yardFloor.rotation.x = -Math.PI / 2;
  yardFloor.position.y = 0.01;
  yardFloor.receiveShadow = true;
  scene.add(yardFloor);
  meshes.push(yardFloor);

  // ------------------------------------------------------------ curtain wall
  const span = YARD * 2;
  addBox(0, -YARD, span, WALL_H, WALL_T, MAT.stone);          // north
  addBox(-YARD, 0, WALL_T, WALL_H, span, MAT.stone);          // west
  addBox(YARD, 0, WALL_T, WALL_H, span, MAT.stone);           // east

  // South wall, split around the gate.
  const segment = (span - GATE_W) / 2;
  const offset = (GATE_W + segment) / 2;
  addBox(-offset, YARD, segment, WALL_H, WALL_T, MAT.stone);
  addBox(offset, YARD, segment, WALL_H, WALL_T, MAT.stone);
  // Lintel over the gateway — floats above head height, so no collider needed
  // beyond the two towers flanking it.
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(GATE_W + 2, 1.4, WALL_T + 0.4), MAT.darkStone);
  lintel.position.set(0, WALL_H - 0.7, YARD);
  lintel.castShadow = true;
  scene.add(lintel);
  meshes.push(lintel);

  // ---------------------------------------------------------------- towers
  for (const [tx, tz] of [[-YARD, -YARD], [YARD, -YARD], [-YARD, YARD], [YARD, YARD]]) {
    addTower(tx, tz, 3, WALL_H + 3);
  }

  // ------------------------------------------------------------------ keep
  addBox(0, -6, 13, 11, 11, MAT.darkStone);
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(10.5, 5, 4), MAT.roof);
  keepRoof.position.set(0, 13.5, -6);
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.castShadow = true;
  scene.add(keepRoof);
  meshes.push(keepRoof);

  // Stone steps up to the keep door — something to walk and jump up.
  for (let i = 0; i < 4; i++) {
    addBox(0, 1.6 + i * 1.2, 6, 0.5 + (3 - i) * 0.5, 1.2, MAT.stone);
  }

  // ------------------------------------------------------- courtyard clutter
  // Hand-placed so the yard reads as lived-in without blocking the walk from the
  // gateway to the keep steps (the corridor x ∈ [-4, 4] is deliberately clear).
  if (library) {
    // West wall: stores and firewood.
    addProp('barrel', -16.2, 12.4, 0.3);
    addProp('barrel', -15.1, 13.4, 1.1);
    addProp('barrel', -16.6, 10.8, 2.4);
    addProp('crate', -14.2, 12.0, 0.6);
    addProp('crate', -13.6, 13.1, 2.2);
    addProp('crate', -14.0, 12.6, 0.9);          // stacked-looking cluster
    addProp('sacks', -15.4, 8.9, 1.7);
    addProp('logs', -16.4, 6.4, 0.4);
    addProp('wood_log', -15.0, 4.8, 1.2);
    addProp('ladder', -17.6, 2.0, Math.PI / 2);
    addProp('cart', -13.4, -8.0, 1.9);

    // East wall: the working side — water, feed, a horse tied up.
    addProp('well', 15.0, 9.4);
    addProp('bucket', 13.6, 8.6, 0.8);
    addProp('trough', 15.6, -2.4, Math.PI / 2);
    addProp('horse_white', 13.4, -2.6, -Math.PI / 2);
    addProp('hay', 16.2, 4.2);
    addProp('hay', 15.0, 5.6);
    addProp('scythe', 17.0, 6.8, 0.5);
    addProp('crate', 14.8, 13.2, 0.2);
    addProp('barrel', 16.3, 12.2, 1.4);

    // Fire pit south of the keep steps, with somewhere to sit.
    addProp('bonfire', -8.0, 8.0);
    addProp('bench', -10.4, 8.2, Math.PI / 2);
    addProp('bench', -8.2, 10.6, 0);
    addProp('cauldron', -6.4, 7.0, 0.9);

    // Chickens loose in the yard — small, non-solid, pure atmosphere.
    for (const [cx, cz, cy] of [[-6.5, 14.5, 0.8], [-5.2, 15.4, 2.1], [9.2, 15.8, 3.4], [10.6, 14.6, 5.0]]) {
      addProp('chicken', cx, cz, cy);
    }

    // Torches along the inner wall, and banners flanking the keep door.
    for (const tz of [-14, -4, 6, 16]) {
      addProp('torch', -18.2, tz);
      addProp('torch', 18.2, tz);
    }
    addProp('banner', -4.6, 0.6);
    addProp('banner', 4.6, 0.6);
    addProp('chest', 5.4, 3.2, -0.6);
  } else {
    // Fallback so the courtyard is never bare if the models fail to load.
    for (const [x, z, w, h, d] of [
      [-13, 12, 1.6, 1.6, 1.6], [-11.2, 13.4, 1.3, 1.3, 1.3], [-13.4, 10.2, 1.3, 2.6, 1.3],
      [12.5, 13, 1.8, 1.8, 1.8], [14.2, 11, 1.4, 1.4, 1.4], [12.8, 10.6, 1.4, 2.8, 1.4],
    ]) addBox(x, z, w, h, d, MAT.wood);
    addBox(6, 8, 2.6, 1.1, 2.6, MAT.stone);
  }

  return { colliders, meshes };
}
