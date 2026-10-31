import { CITY } from '../terrain.js';
import { WALL } from './wall.js';
import { mulberry32 } from '../../noise.js';

// The street plan. Medieval towns are not grids, but their streets do mostly run
// straight between gates and squares — so: a wide main street from the west gate
// to the market, a lane all the way round inside the wall, and cross streets at
// uneven spacings. Whatever is left between them is a block of houses.
//
// Everything is axis-aligned, which keeps every house a clean AABB to collide with.

const rand = mulberry32(2207);

// Inside face of the wall, and the lane that runs along it.
const IN = {
  minX: CITY.minX + WALL.thick, maxX: CITY.maxX - WALL.thick,
  minZ: CITY.minZ + WALL.thick, maxZ: CITY.maxZ - WALL.thick,
};
const LANE = 7;

export const MAIN = { z: WALL.gateZ, width: 12 };

// The market: a round square on the main street, a short walk in from the gate
// (docs/DESIGN.md), where a cross street meets it. The town hall tower stands in
// the middle and ten stalls ring it. Houses that would stand on it are left out
// (houses.js asks `inMarket`); the blocks themselves are kept.
const MARKET_X = 430;
export const MARKET = { x: MARKET_X, z: MAIN.z, r: 19 };

// True if a rectangle comes within `pad` metres of the market's circle.
export function inMarket(minX, maxX, minZ, maxZ, pad = 1.5) {
  const dx = Math.max(minX - MARKET.x, 0, MARKET.x - maxX);
  const dz = Math.max(minZ - MARKET.z, 0, MARKET.z - maxZ);
  return Math.hypot(dx, dz) < MARKET.r + pad;
}

// Cross streets: [centre, width]. Spacings vary so no two blocks are alike.
function lines(from, to, step, jitter, width, keep = []) {
  const out = [];
  for (let v = from + step; v < to - step * 0.6; v += step * (0.8 + rand() * 0.45)) {
    out.push([v + (rand() - 0.5) * jitter, width + (rand() < 0.3 ? 2 : 0)]);
  }
  return out.concat(keep).sort((a, b) => a[0] - b[0]);
}

const xs = lines(IN.minX + LANE, IN.maxX - LANE, 58, 8, 6, [[MARKET_X, 10]])
  .filter(([v], i, a) => i === 0 || v - a[i - 1][0] > 30);
const zs = lines(IN.minZ + LANE, IN.maxZ - LANE, 52, 6, 6, [[MAIN.z, MAIN.width]])
  .filter(([v], i, a) => i === 0 || Math.abs(v - MAIN.z) > 25 || v === MAIN.z)
  .filter(([v], i, a) => i === 0 || v - a[i - 1][0] > 28);

// Every street as a rectangle (for paving and for keeping houses off it).
export const STREETS = [];
const xEdges = [[IN.minX, IN.minX + LANE]];
for (const [x, w] of xs) xEdges.push([x - w / 2, x + w / 2]);
xEdges.push([IN.maxX - LANE, IN.maxX]);
const zEdges = [[IN.minZ, IN.minZ + LANE]];
for (const [z, w] of zs) zEdges.push([z - w / 2, z + w / 2]);
zEdges.push([IN.maxZ - LANE, IN.maxZ]);

for (const [x0, x1] of xEdges) STREETS.push({ minX: x0, maxX: x1, minZ: IN.minZ, maxZ: IN.maxZ, dir: 'ns' });
for (const [z0, z1] of zEdges) STREETS.push({ minX: IN.minX, maxX: IN.maxX, minZ: z0, maxZ: z1, dir: 'ew' });

// The blocks between streets.
export const BLOCKS = [];
for (let i = 0; i + 1 < xEdges.length; i++) {
  for (let j = 0; j + 1 < zEdges.length; j++) {
    const b = { minX: xEdges[i][1], maxX: xEdges[i + 1][0], minZ: zEdges[j][1], maxZ: zEdges[j + 1][0] };
    if (b.maxX - b.minX > 12 && b.maxZ - b.minZ > 12) BLOCKS.push(b);
  }
}

// Paving. North–south streets sit a hair higher than east–west ones so their
// crossings never z-fight; the market's disc sits above both.
export function buildStreets(b) {
  const y = CITY.y;
  for (const s of STREETS) {
    const top = s.dir === 'ns' ? 0.07 : 0.05;
    b.box('cobble', (s.minX + s.maxX) / 2, y - 0.3, (s.minZ + s.maxZ) / 2,
      s.maxX - s.minX, 0.3 + top, s.maxZ - s.minZ);
  }
  // The round market, paved a hair above the streets that run into it.
  b.disc('cobble', MARKET.x, y - 0.3, MARKET.z, MARKET.r, 0.39);
}
