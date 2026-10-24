import * as THREE from 'three';
import { cityMaterial } from './builder.js';
import { inventory, ITEMS } from './inventory.js';
import { hud } from './hud.js';

// A wooden chest bound in iron, with a lid that swings open when you loot it.
// Contents are gold plus items (docs/DESIGN.md). Chests sit in bandit camps, out
// in the desert, in ruins and in the castle; once opened they stay open.

export function createChest(parent, renderer, { x, y = 0, z, yaw = 0, gold = 10, items = {}, half = false }) {
  const wood = cityMaterial('timber', renderer);
  const iron = cityMaterial('rust', renderer);
  const group = new THREE.Group();
  group.position.set(x, y - (half ? 0.28 : 0), z);   // half-buried in sand
  group.rotation.y = yaw;

  const box = (w, h, d, mat, px, py, pz, into = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    into.add(m);
    return m;
  };
  box(0.9, 0.5, 0.55, wood, 0, 0.25, 0);                      // body
  for (const bx of [-0.3, 0.3]) box(0.06, 0.52, 0.57, iron, bx, 0.25, 0);   // bands

  // The lid hinges along the back edge.
  const lid = new THREE.Group();
  lid.position.set(0, 0.5, -0.275);
  group.add(lid);
  box(0.92, 0.16, 0.57, wood, 0, 0.08, 0.275, lid);
  for (const bx of [-0.3, 0.3]) box(0.06, 0.18, 0.59, iron, bx, 0.08, 0.275, lid);
  box(0.12, 0.14, 0.04, iron, 0, -0.02, 0.57, lid);           // the hasp

  parent.add(group);

  let opening = 0;
  const chest = {
    pos: new THREE.Vector3(x, y + 0.5, z),
    reach: 2.8,
    label: 'open the chest',
    done: false,
    collider: { minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, top: y + 0.55 },
    use() {
      chest.done = true;
      opening = 0.0001;
      const found = [];
      if (gold > 0) { inventory.addGold(gold); found.push(`${gold} gold`); }
      for (const [key, n] of Object.entries(items)) {
        inventory.addItem(key, n);
        found.push(n > 1 ? `${ITEMS[key].name} ×${n}` : ITEMS[key].name);
      }
      hud.toast(found.length ? `Found: ${found.join(', ')}` : 'The chest is empty.');
    },
    update(dt) {
      if (opening > 0 && opening < 1) {
        opening = Math.min(1, opening + dt * 2.5);
        lid.rotation.x = -1.9 * (1 - (1 - opening) ** 3);
      }
    },
  };
  return chest;
}
