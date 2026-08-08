import * as THREE from 'three';

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

const MAT = {
  grass: new THREE.MeshStandardMaterial({ color: 0x5c7a3f, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8d8878, roughness: 0.9 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x6f6a5e, roughness: 0.95 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x5a3a2e, roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 }),
};

export function buildWorld(scene) {
  const colliders = [];
  const meshes = [];

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
  // Deterministic scatter of crates and barrels, stable across reloads.
  const props = [
    [-13, 12, 1.6, 1.6, 1.6],
    [-11.2, 13.4, 1.3, 1.3, 1.3],
    [-13.4, 10.2, 1.3, 2.6, 1.3],
    [12.5, 13, 1.8, 1.8, 1.8],
    [14.2, 11, 1.4, 1.4, 1.4],
    [12.8, 10.6, 1.4, 2.8, 1.4],
    [-15, -2, 2, 1, 2],
    [15, -4, 2, 1, 2],
  ];
  for (const [x, z, w, h, d] of props) addBox(x, z, w, h, d, MAT.wood);

  // A well at the centre of the yard.
  addBox(6, 8, 2.6, 1.1, 2.6, MAT.stone);

  return { colliders, meshes };
}
