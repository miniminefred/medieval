import * as THREE from 'three';
import { CITY } from '../terrain.js';
import { POND } from './streets.js';
import { mulberry32 } from '../../noise.js';

// The fish pond at the city's east edge (docs/DESIGN.md): a grassy green with a
// round pond, a low stone kerb, reeds, lily pads and a little jetty to fish
// from. It is shallow — you can wade in — so it needs no walls round it.
// `waterAt(x, z)` tells the fishing rod where there is water (main.js).

export function buildPond(b, group) {
  const rand = mulberry32(5150);
  const { x, z, r } = POND;
  const y = CITY.y;

  b.disc('meadow', x, y - 0.05, z, r + 5, 0.1);                       // the green
  // The kerb: a ring of stones.
  const n = Math.round(r * 2.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = (2 * Math.PI * (r + 0.25)) / n + 0.08;
    b.box('housestone', x + Math.cos(a) * (r + 0.25), y - 0.1, z + Math.sin(a) * (r + 0.25), len, 0.4, 0.55, { yaw: -a + Math.PI / 2 });
  }
  b.disc('mud', x, y - 0.06, z, r + 0.05, 0.08);                       // the bottom, seen through the water

  // A jetty out over the water, on the west side, facing the town.
  const jx = x - r - 0.3, jl = 6;
  for (let i = 0; i < 10; i++) b.box('timber', jx + 0.3 + i * (jl / 10), y + 0.28, z, jl / 10 - 0.04, 0.08, 1.6);
  for (const sz of [-0.75, 0.75]) for (let i = 1; i <= 3; i++) b.cylinder('timber', jx + i * 2, y - 0.3, z + sz, 0.08, 0.7, { sides: 8 });
  b.collider(jx, jx + jl, z - 0.8, z + 0.8, y + 0.36);

  // Reeds in clumps at the water's edge.
  for (let k = 0; k < 14; k++) {
    const a = rand() * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.25) continue;   // not round the jetty
    const cr = r - 0.4 - rand() * 1.2;
    for (let j = 0; j < 9; j++) {
      const ox = (rand() - 0.5) * 1.1, oz = (rand() - 0.5) * 1.1;
      b.cylinder('reed', x + Math.cos(a) * cr + ox, y, z + Math.sin(a) * cr + oz, 0.015, 0.9 + rand() * 0.8, { rBottom: 0.025, sides: 5, roll: (rand() - 0.5) * 0.25 });
    }
  }

  // The water, and lily pads on it.
  const water = new THREE.Mesh(new THREE.CircleGeometry(r + 0.05, 64),
    new THREE.MeshStandardMaterial({ color: 0x1f3b40, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.86, envMapIntensity: 1.4 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y + 0.18, z);
  water.receiveShadow = true;
  group.add(water);
  const pad = new THREE.MeshStandardMaterial({ color: 0x3f6a2c, roughness: 0.6 });
  for (let k = 0; k < 22; k++) {
    const a = rand() * Math.PI * 2, d = r * (0.35 + rand() * 0.55);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.18 + rand() * 0.15, 12, 0.3, Math.PI * 2 - 0.5), pad);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rand() * 6.28;
    m.position.set(x + Math.cos(a) * d, y + 0.19, z + Math.sin(a) * d);
    group.add(m);
  }

  return {
    waterAt: (px, pz) => Math.hypot(px - x, pz - z) < r,
    waterY: y + 0.18,
  };
}
