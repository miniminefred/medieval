import * as THREE from 'three';
import { cityMaterial } from '../builder.js';

// Bandits, for now: hooded, cloaked figures (docs/DESIGN.md). Realistic people
// are the hardest thing to make in code, and a deep hood with nothing but shadow
// inside hides that well. They sit by the fire, stand guard, or walk the edge of
// their camp — and do not react to the player yet (no fighting).

let mats = null;
function materials(renderer) {
  if (mats) return mats;
  const hess = cityMaterial('hessian', renderer);
  mats = {
    cloak: new THREE.MeshStandardMaterial({ map: hess.map, normalMap: hess.normalMap, color: 0x5c4b3b, roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0a0907, roughness: 1 }),
    wood: cityMaterial('timber', renderer),
    iron: new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.35, metalness: 0.85 }),
  };
  return mats;
}

// One figure, feet at the group's origin, facing +z. `pose`: 'stand' | 'sit'.
function figure(renderer, pose, rng) {
  const m = materials(renderer);
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const sit = pose === 'sit';
  const body = sit ? 0.85 : 1.35;
  const base = sit ? 0.42 : 0;           // sitting on a log
  const tall = 0.92 + rng() * 0.16;

  // Cloak, shoulders, hood with the dark inside, and a hood peak.
  add(new THREE.CylinderGeometry(0.2, sit ? 0.5 : 0.44, body, 14), m.cloak, 0, base + body / 2, 0);
  add(new THREE.SphereGeometry(0.3, 14, 10), m.cloak, 0, base + body, 0).scale.set(1.35, 0.7, 1.0);
  add(new THREE.SphereGeometry(0.2, 14, 12), m.cloak, 0, base + body + 0.24, -0.02);
  add(new THREE.ConeGeometry(0.15, 0.3, 12), m.cloak, 0, base + body + 0.42, -0.07).rotation.x = -0.35;
  add(new THREE.SphereGeometry(0.135, 12, 10), m.dark, 0, base + body + 0.22, 0.085);
  // Arms in the cloak's sleeves.
  for (const s of [-1, 1]) {
    const arm = add(new THREE.CylinderGeometry(0.07, 0.09, 0.62, 8), m.cloak, s * 0.33, base + body - 0.3, 0.06);
    arm.rotation.x = sit ? -0.9 : -0.15;
  }
  // Guards carry a spear.
  if (!sit && rng() < 0.7) {
    add(new THREE.CylinderGeometry(0.025, 0.03, 2.1, 6), m.wood, 0.36, 1.05, 0.12);
    add(new THREE.ConeGeometry(0.05, 0.22, 6), m.iron, 0.36, 2.2, 0.12);
  }
  g.scale.setScalar(tall);
  return g;
}

// A bandit: a figure plus how it behaves. `heightAt` keeps walkers on the ground.
export function createBandit(parent, renderer, rng, { x, z, yaw = 0, pose = 'stand', patrol = null, heightAt }) {
  const g = figure(renderer, pose, rng);
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = yaw;
  parent.add(g);

  let t = rng() * 100;
  const breathe = 0.6 + rng() * 0.3;
  return {
    object: g,
    // Standing and sitting bandits are solid; walkers are not (no pushing yet).
    collider: patrol ? null : { minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, top: g.position.y + 1.9 },
    update(dt) {
      t += dt;
      if (patrol) {
        // Walk a slow circle round the camp, bobbing with each step.
        const a = patrol.phase + (t * patrol.speed) / patrol.r;
        const px = patrol.cx + Math.cos(a) * patrol.r, pz = patrol.cz + Math.sin(a) * patrol.r;
        g.position.set(px, heightAt(px, pz) + Math.abs(Math.sin(t * 4.2)) * 0.04, pz);
        g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));     // facing along the circle
      } else {
        g.scale.y = g.scale.x * (1 + Math.sin(t * breathe * 2) * 0.008);
      }
    },
  };
}
