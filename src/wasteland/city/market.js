import { CITY } from '../terrain.js';
import { MARKET, MAIN, STREETS } from './streets.js';
import { mulberry32 } from '../../noise.js';

// The market square, where the cyborgs sell their technology (docs/DESIGN.md).
//
// The main street and one cross street run through it and stay clear; they split
// the square into four quarters, each with its own trade:
//
//   north-west  weapons             north-east  vehicle modules and gear
//   south-west  cyborg body parts   south-east  gadgets, tools — and scrap
//
// Stalls stand in rows: one with its back to the edge of the square, then pairs
// back to back, with aisles between them to walk down and gaps every few stalls
// to cut through. A cyborg pillar marks the crossing in the middle.

const rand = mulberry32(3301);
const between = (a, b) => a + rand() * (b - a);
const pick = (a) => a[Math.floor(rand() * a.length)];

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
}

// AABB of a rectangle w × d offset `lz` forward from (x, z), at yaw 0/90/180/270.
function footprint(x, z, yaw, w, d, lz) {
  const c = Math.round(Math.cos(yaw)), s = Math.round(Math.sin(yaw));
  const cx = x + lz * s, cz = z + lz * c;
  const hw = (s ? d : w) / 2, hd = (s ? w : d) / 2;
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

// --------------------------------------------------------------- the square

function quarter(b, q, inward, trade) {
  // Rows from the outer edge toward the main street: in, out|in, out|in...
  const depth = q.maxZ - q.minZ;
  const sign = inward;                       // +1: rows face +z (south)
  const edge = inward > 0 ? q.minZ : q.maxZ;
  let t = 1.5;
  let facing = 1;                            // 1 = facing inward
  const rows = [];
  while (t + STALL_D <= depth - 3) {
    rows.push({ t: t + STALL_D / 2, facing });
    t += STALL_D + (facing === 1 ? AISLE : 0.5);
    facing = -facing;
  }
  // A row facing away from everything at the end would be a dead end; drop it.
  if (rows.length && rows[rows.length - 1].facing === -1) rows.pop();

  for (const r of rows) {
    const z = edge + sign * r.t;
    const yaw = (sign * r.facing > 0) ? 0 : Math.PI;
    let x = q.minX + 3;
    let n = 0;
    while (x + STALL_W <= q.maxX - 3) {
      const cloth = trade === scrapAndGadgets && rand() < 0.4 ? 'hessian' : pick(['linen', 'caban']);
      const goods = trade === scrapAndGadgets ? gadgets : trade;
      stall(b, x + STALL_W / 2, z, yaw, cloth, goods);
      x += STALL_W + 0.4;
      if (++n % 4 === 0) x += 3.5;           // a gap to cut through the row
    }
  }
  // Barrels and crates in the corners of the quarter.
  for (let i = 0; i < 6; i++) {
    const cx = rand() < 0.5 ? q.minX + between(0.8, 2.2) : q.maxX - between(0.8, 2.2);
    const cz = between(q.minZ + 1, q.maxZ - 1);
    if (rand() < 0.5) b.cylinder('timber', cx, CITY.y + 0.09, cz, 0.38, 0.95, { rTop: 0.33, collide: true });
    else b.box('timber', cx, CITY.y + 0.09, cz, 0.8, 0.8, 0.8, { yaw: between(0, 1.5), collide: true });
  }
  if (trade === scrapAndGadgets) scrapHeaps(b, q);
}

// The scrap quarter gets heaps of junk along its outer edge.
function scrapAndGadgets() {}
function scrapHeaps(b, q) {
  for (let h = 0; h < 4; h++) {
    const hx = between(q.minX + 4, q.maxX - 4), hz = q.maxZ - 1.2;
    for (let i = 0; i < 14; i++) {
      const key = pick(['rust', 'rust', 'steel', 'gunmetal']);
      const w = between(0.3, 1.2), hgt = between(0.1, 0.5), d = between(0.3, 1.0);
      b.box(key, hx + between(-1.4, 1.4), CITY.y + 0.09 + between(0, 0.5) * (1 - i / 14), hz + between(-0.8, 0.5),
        w, hgt, d, { yaw: between(0, 3.1), roll: between(-0.3, 0.3) });
    }
    b.cylinder('rust', hx + 1.6, CITY.y + 0.09 + 0.45, hz, 0.45, 0.25, { pitch: Math.PI / 2 }); // an old wheel
    b.collider(hx - 1.6, hx + 1.6, hz - 1, hz + 0.6, CITY.y + 0.7);
  }
}

// The pillar at the crossing: a stone plinth, a steel column ringed with light,
// and a glowing core on top — visible down both streets.
function pillar(b, x, z) {
  const y = CITY.y + 0.09;
  b.box('housestone', x, y, z, 5.5, 0.6, 5.5, { collide: true });
  b.box('housestone', x, y + 0.6, z, 3.6, 0.9, 3.6);
  b.cylinder('steel', x, y + 1.5, z, 0.85, 11, { sides: 8, rTop: 0.6 });
  for (const ry of [3.5, 6.5, 9.5]) b.cylinder('glow', x, y + ry, z, 0.95 - ry * 0.025, 0.14, { sides: 16 });
  b.cylinder('gunmetal', x, y + 12.5, z, 0.9, 0.5, { sides: 16 });
  b.cylinder('glow', x, y + 13.0, z, 0.55, 1.2, { sides: 16 });
  b.cylinder('gunmetal', x, y + 14.2, z, 0.95, 0.3, { sides: 16, rBottom: 0.7 });
}

export function buildMarket(b) {
  // The cross street that runs through the square.
  const cross = STREETS.find((s) => s.dir === 'ns' && s.maxX > MARKET.minX && s.minX < MARKET.maxX);
  const cx0 = cross ? cross.minX : (MARKET.minX + MARKET.maxX) / 2 - 3;
  const cx1 = cross ? cross.maxX : cx0 + 6;
  const mz0 = MAIN.z - MAIN.width / 2, mz1 = MAIN.z + MAIN.width / 2;
  const M = MARKET;

  // Quarters, kept a couple of metres off the streets through the middle.
  quarter(b, { minX: M.minX, maxX: cx0 - 2, minZ: M.minZ, maxZ: mz0 - 2 }, 1, weapons);
  quarter(b, { minX: cx1 + 2, maxX: M.maxX, minZ: M.minZ, maxZ: mz0 - 2 }, 1, vehicleParts);
  quarter(b, { minX: M.minX, maxX: cx0 - 2, minZ: mz1 + 2, maxZ: M.maxZ }, -1, bodyParts);
  quarter(b, { minX: cx1 + 2, maxX: M.maxX, minZ: mz1 + 2, maxZ: M.maxZ }, -1, scrapAndGadgets);

  pillar(b, (cx0 + cx1) / 2, MAIN.z);
}
