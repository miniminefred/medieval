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

// The market square, on the main street a short walk in from the gate (about
// 100 m, docs/DESIGN.md). This is where it
// is *asked* for; every block it touches is cleared, and MARKET is then widened to
// exactly the cleared ground (below), so the square runs right up to the houses.
const WANT = { minX: 380, maxX: 480, minZ: MAIN.z - 38, maxZ: MAIN.z + 38 };
export const MARKET = { ...WANT };

// Cross streets: [centre, width]. Spacings vary so no two blocks are alike.
function lines(from, to, step, jitter, width, keep = []) {
  const out = [];
  for (let v = from + step; v < to - step * 0.6; v += step * (0.8 + rand() * 0.45)) {
    out.push([v + (rand() - 0.5) * jitter, width + (rand() < 0.3 ? 2 : 0)]);
  }
  return out.concat(keep).sort((a, b) => a[0] - b[0]);
}

const xs = lines(IN.minX + LANE, IN.maxX - LANE, 58, 8, 6, [[(WANT.minX + WANT.maxX) / 2, 10]])
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

// The blocks between streets, minus the market.
export const BLOCKS = [];
for (let i = 0; i + 1 < xEdges.length; i++) {
  for (let j = 0; j + 1 < zEdges.length; j++) {
    const b = { minX: xEdges[i][1], maxX: xEdges[i + 1][0], minZ: zEdges[j][1], maxZ: zEdges[j + 1][0] };
    const inMarket = b.maxX > WANT.minX && b.minX < WANT.maxX && b.maxZ > WANT.minZ && b.minZ < WANT.maxZ;
    if (inMarket) {
      MARKET.minX = Math.min(MARKET.minX, b.minX); MARKET.maxX = Math.max(MARKET.maxX, b.maxX);
      MARKET.minZ = Math.min(MARKET.minZ, b.minZ); MARKET.maxZ = Math.max(MARKET.maxZ, b.maxZ);
    } else if (b.maxX - b.minX > 12 && b.maxZ - b.minZ > 12) {
      BLOCKS.push(b);
    }
  }
}

// Paving. North–south streets sit a hair higher than east–west ones so their
// crossings never z-fight; the market is paved over the lot.
export function buildStreets(b) {
  const y = CITY.y;
  for (const s of STREETS) {
    const top = s.dir === 'ns' ? 0.07 : 0.05;
    b.box('cobble', (s.minX + s.maxX) / 2, y - 0.3, (s.minZ + s.maxZ) / 2,
      s.maxX - s.minX, 0.3 + top, s.maxZ - s.minZ);
  }
  b.box('cobble', (MARKET.minX + MARKET.maxX) / 2, y - 0.3, (MARKET.minZ + MARKET.maxZ) / 2,
    MARKET.maxX - MARKET.minX, 0.39, MARKET.maxZ - MARKET.minZ);
}
