import * as THREE from 'three';
import { CityBuilder } from './builder.js';
import { clock } from './clock.js';

// Street lamps: an iron-bound wooden post with a lantern that glows at night
// (docs/DESIGN.md: the city's lamps light up after dark).
//
// Every lantern glows, but WebGL cannot afford a real light per lamp, so a small
// pool of point lights hops to the lamps nearest the player — near you the
// ground is truly lit, farther off you see the lanterns themselves shining.

const POOL = 8;
const POST = 3.4;

export function createLamps(group, renderer, spots) {
  const b = new CityBuilder(renderer);
  for (const { x, y, z } of spots) {
    b.box('housestone', x, y - 0.1, z, 0.55, 0.45, 0.55);
    b.cylinder('timber', x, y + 0.3, z, 0.08, POST, { sides: 8 });
    b.box('rust', x, y + POST + 0.25, z, 0.42, 0.06, 0.42);           // lantern roof
    b.box('rust', x, y + POST - 0.25, z, 0.36, 0.05, 0.36);           // lantern base
    b.collider(x - 0.3, x + 0.3, z - 0.3, z + 0.3, y + POST);
  }
  b.finish(group);

  // The lantern glass, all of them in one instanced mesh.
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a2116, emissive: 0xffb15a, emissiveIntensity: 0 });
  const lanterns = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), glass, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(({ x, y, z }, i) => lanterns.setMatrixAt(i, m.makeTranslation(x, y + POST, z)));
  lanterns.frustumCulled = false;
  group.add(lanterns);

  const lights = [];
  for (let i = 0; i < POOL; i++) {
    const l = new THREE.PointLight(0xffb15a, 0, 16, 1.8);
    group.add(l);
    lights.push(l);
  }
  const lit = spots.map(({ x, y, z }) => new THREE.Vector3(x, y + POST - 0.1, z));
  let t = 0, sinceSort = 1;
  let nearest = [];

  return {
    colliders: b.colliders,
    update(dt, playerPos) {
      t += dt;
      const night = 1 - clock.light().day;
      glass.emissiveIntensity = night * 3.2;
      // Re-pick the nearest lamps a few times a second, not every frame.
      sinceSort += dt;
      if (sinceSort > 0.4) {
        sinceSort = 0;
        nearest = lit.map((p, i) => [p.distanceToSquared(playerPos), i]).sort((a, c) => a[0] - c[0]).slice(0, POOL);
      }
      lights.forEach((l, k) => {
        const n = nearest[k];
        if (!n || night < 0.02) { l.intensity = 0; return; }
        l.position.copy(lit[n[1]]);
        l.intensity = night * 14 * (1 + Math.sin(t * 9 + k) * 0.03);
      });
    },
  };
}
