import { CITY } from '../terrain.js';
import { MARKET } from './streets.js';
import { mulberry32 } from '../../noise.js';

// The round market (docs/DESIGN.md): ten stalls in a ring round the town hall
// tower, facing it across an aisle, with gaps where the streets come in. The
// stalls sell the cyborgs' technology — weapons, body parts, gadgets, vehicle
// modules, and scrap — each one staffed by its trader (city/index.js).

const rand = mulberry32(3301);
const between = (a, b) => a + rand() * (b - a);
const pick = (a) => a[Math.floor(rand() * a.length)];

// Where a trader can stand: every stall's counter, behind it (filled in as built).
export const COUNTERS = [];

const STALL_W = 4.6;
const STALL_D = 3.0;
const AISLE = 6.5;

// One stall. (x, z) is the centre of its footprint; it faces local +z, turned by
// yaw. `goods` dresses the counter and shelves.
function stall(b, x, z, yaw, cloth, goods) {
  const y = CITY.y + 0.09;           // the square's paving
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const put = (key, lx, ly, lz, w, h, d, o = {}) =>
    b.box(key, x + lx * c + lz * s, y + ly, z - lx * s + lz * c, w, h, d, { yaw, ...o });
  const cyl = (key, lx, ly, lz, r, h, o = {}) =>
    b.cylinder(key, x + lx * c + lz * s, y + ly, z - lx * s + lz * c, r, h, { yaw, ...o });
  const W = STALL_W, D = STALL_D;

  // Frame: front posts lower than the back ones so the awning sheds rain (and sand).
  for (const lx of [-W / 2 + 0.1, W / 2 - 0.1]) {
    put('timber', lx, 0, D / 2 - 0.1, 0.12, 2.6, 0.12);
    put('timber', lx, 0, -D / 2 + 0.1, 0.12, 3.05, 0.12);
  }
  // The awning, sloping down to the front and out over the counter.
  const drop = 0.45;
  put(cloth, 0, 2.62 + drop / 2, 0.35, W + 0.4, 0.04, D + 0.9, { pitch: Math.atan2(drop, D) });
  // Counter along the front, solid to walk into.
  const cz = D / 2 - 0.45;
  put('timber', 0, 0, cz, W - 0.4, 0.92, 0.75);
  put('timber', 0, 0.92, cz, W - 0.2, 0.06, 0.9);
  b.collider(...footprint(x, z, yaw, W - 0.2, 0.9, cz), y + 0.98);
  // Back wall and two shelves on it.
  put('timber', 0, 0, -D / 2 + 0.05, W - 0.2, 2.3, 0.06);
  for (const sy of [1.25, 1.9]) put('timber', 0, sy, -D / 2 + 0.3, W - 0.4, 0.05, 0.45);
  // A sign board hung under the front of the awning, with a lit strip on tech stalls.
  put('timber', 0, 2.05, D / 2 + 0.2, 1.8, 0.38, 0.05);
  if (cloth !== 'hessian') put('glow', 0, 1.98, D / 2 + 0.23, 1.6, 0.05, 0.03);

  goods({ put, cyl, top: 0.98, cz, back: -D / 2 + 0.3 });

  // Behind the counter (local z = 0.05), facing out over it.
  COUNTERS.push({ x: x + 0.05 * s, z: z + 0.05 * c, yaw, front: { x: x + (D / 2 + 0.6) * s, z: z + (D / 2 + 0.6) * c } });
}

// AABB of a rectangle w × d offset `lz` forward from (x, z), turned by any yaw.
function footprint(x, z, yaw, w, d, lz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const cx = x + lz * s, cz = z + lz * c;
  const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2;
  return [cx - hw, cx + hw, cz - hd, cz + hd];
}

// ------------------------------------------------------------------- goods

// Blades and guns: a rack of energy blades, a plasma cannon on the counter.
function weapons({ put, cyl, top, cz, back }) {
  for (let i = 0; i < 5; i++) {
    const lx = -1.6 + i * 0.8;
    put('gunmetal', lx, 1.3, back + 0.05, 0.07, 1.15, 0.03, { roll: between(-0.05, 0.05) });
    put('glow', lx, 1.3, back + 0.08, 0.02, 1.0, 0.01);          // the lit edge
  }
  if (rand() < 0.8) {   // plasma cannon: body, barrel, power cell
    put('steel', -0.6, top, cz, 0.5, 0.28, 0.3);
    cyl('gunmetal', 0.05, top + 0.16, cz, 0.09, 0.9, { roll: Math.PI / 2 });
    cyl('glow', -0.25, top + 0.16, cz, 0.11, 0.08, { roll: Math.PI / 2 });
  }
  put('gunmetal', 1.2, top, cz, 0.6, 0.12, 0.35);               // a crossbow-like stock
  put('timber', 1.2, top + 0.12, cz, 0.8, 0.05, 0.08);
}

// Metal arms, eye implants, armour plates.
function bodyParts({ put, cyl, top, cz, back }) {
  for (const lx of [-1.4, -0.4]) {   // two arms laid out: upper, forearm, glowing joints
    cyl('gunmetal', lx, top + 0.08, cz - 0.15, 0.07, 0.42, { pitch: Math.PI / 2 });
    cyl('gunmetal', lx, top + 0.07, cz + 0.28, 0.06, 0.4, { pitch: Math.PI / 2 });
    put('glow', lx, top + 0.02, cz + 0.06, 0.1, 0.1, 0.1);
    put('steel', lx, top, cz + 0.52, 0.16, 0.06, 0.14);           // the hand
  }
  for (let i = 0; i < 6; i++) put('glow', 0.4 + i * 0.22, top, cz, 0.07, 0.07, 0.07);   // eyes
  for (let i = 0; i < 3; i++) put('steel', -1 + i * 0.9, 1.3, back, 0.7, 0.5 - i * 0.08, 0.05); // plates
  for (let i = 0; i < 4; i++) cyl('gunmetal', -1.3 + i * 0.85, 1.95, back, 0.08, 0.3);
}

// Small boxes with lit screens, lanterns, coils of cable and hook.
function gadgets({ put, cyl, top, cz, back }) {
  for (let i = 0; i < 4; i++) {
    const lx = -1.5 + i * 0.95, h = between(0.12, 0.3);
    put(pick(['steel', 'gunmetal']), lx, top, cz, between(0.25, 0.45), h, 0.25);
    put('glow', lx, top + h * 0.3, cz + 0.13, 0.16, h * 0.4, 0.01);
  }
  for (let i = 0; i < 4; i++) cyl('glow', -1.4 + i * 0.9, 1.3, back, 0.07, 0.22, { sides: 8 });
  for (let i = 0; i < 3; i++) cyl('rust', -1 + i * 1.0, 1.95, back, 0.18, 0.1);
}

// Engines, thrusters, wheels: big things, partly on the ground in front.
function vehicleParts({ put, cyl, top, cz, back }) {
  put('steel', -1.0, top, cz, 0.9, 0.45, 0.55);                   // an engine block
  cyl('glow', -1.0, top + 0.45, cz, 0.12, 0.05);
  cyl('gunmetal', 0.6, top + 0.22, cz, 0.22, 0.75, { rTop: 0.14, roll: Math.PI / 2 }); // thruster
  cyl('glow', 0.98, top + 0.22, cz, 0.13, 0.03, { roll: Math.PI / 2 });
  for (const lx of [-1.3, -0.3, 0.7]) {                             // wheels on the shelf
    cyl('rust', lx, 1.3 + 0.32, back + 0.05, 0.32, 0.18, { pitch: Math.PI / 2 });
  }
}

// ----------------------------------------------------------- the town hall

// The old glowing pillar, grown into the town hall: a round stone tower with a
// steel upper storey ringed in light, a glowing crown, and its door facing west,
// down the main street toward the gate. (Its inside comes with the houses.)
function townHall(b, x, z) {
  const y = CITY.y + 0.09;
  const R = 5.5;
  b.disc('housestone', x, y, z, R + 1.1, 0.5);
  b.cylinder('citywall', x, y + 0.5, z, R, 10, { sides: 32 });
  b.cylinder('steel', x, y + 10.5, z, R - 0.6, 9, { sides: 32 });
  for (const ry of [11.5, 14.5, 17.5]) b.cylinder('glow', x, y + ry, z, R - 0.45, 0.18, { sides: 32 });
  b.cylinder('gunmetal', x, y + 19.5, z, R, 0.6, { sides: 32 });
  b.cylinder('glow', x, y + 20.1, z, 2.4, 2.2, { sides: 24 });
  b.cylinder('tin', x, y + 22.3, z, R + 0.3, 5, { sides: 32, rTop: 0.15 });
  b.cylinder('gunmetal', x, y + 27.2, z, 0.08, 3, { sides: 6 });
  // The door, west, and tall windows round both storeys.
  const door = (a, y0, w, h, key) => b.box(key, x + Math.sin(a) * (R + 0.04), y + y0, z + Math.cos(a) * (R + 0.04), w, h, 0.2, { yaw: a });
  door(-Math.PI / 2, 0.5, 2.6, 4.2, 'housestone');
  b.box('timber', x - R - 0.16, y + 0.6, z, 0.12, 3.6, 2.0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    door(a, 3.8, 1.0, 2.4, 'housestone');
    b.box('glass', x + Math.sin(a) * (R + 0.16), y + 3.95, z + Math.cos(a) * (R + 0.16), 0.62, 2.0, 0.06, { yaw: a });
    b.box('glass', x + Math.sin(a) * (R - 0.45), y + 12.4, z + Math.cos(a) * (R - 0.45), 0.7, 1.8, 0.06, { yaw: a });
  }
  b.collider(x - R, x + R, z - R, z + R, y + 27);
}

// ------------------------------------------------------------- the ring

const WARES = [weapons, bodyParts, gadgets, vehicleParts, gadgets];

export function buildMarket(b) {
  const { x: mx, z: mz } = MARKET;
  const RING = 12.5;          // stall centres
  townHall(b, mx, mz);

  // Ten stalls in four arcs of 3, 2, 3, 2 between the streets coming in from
  // east, south, west and north, each stall turned to face the hall.
  let n = 0;
  [3, 2, 3, 2].forEach((count, arc) => {
    const mid = (arc * Math.PI) / 2 + Math.PI / 4;     // between two streets
    const step = 0.4;                                   // radians between stalls
    for (let k = 0; k < count; k++) {
      const a = mid + (k - (count - 1) / 2) * step;
      const x = mx + Math.cos(a) * RING, z = mz + Math.sin(a) * RING;
      const yaw = Math.atan2(mx - x, mz - z);
      const cloth = n % 5 === 4 ? 'hessian' : (n % 2 ? 'linen' : 'caban');
      stall(b, x, z, yaw, cloth, WARES[n % WARES.length]);
      n++;
    }
  });

  // A few barrels and crates round the edge.
  for (let i = 0; i < 8; i++) {
    const a = between(0, Math.PI * 2), r = between(15.5, 17.5);
    const cx = mx + Math.cos(a) * r, cz = mz + Math.sin(a) * r;
    if (Math.abs(Math.sin(2 * a)) < 0.25) continue;    // not in the street mouths
    if (rand() < 0.5) b.cylinder('timber', cx, CITY.y + 0.09, cz, 0.38, 0.95, { rTop: 0.33, collide: true });
    else b.box('timber', cx, CITY.y + 0.09, cz, 0.8, 0.8, 0.8, { yaw: between(0, 1.5), collide: true });
  }
}
