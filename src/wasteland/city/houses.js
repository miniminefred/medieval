import { CITY } from '../terrain.js';
import { BLOCKS, MAIN, inMarket } from './streets.js';
import { mulberry32 } from '../../noise.js';

// Medieval town houses, with the cyborgs' hand on some of them.
//
// A house is a stone ground floor, plastered upper floors that jut out over the
// street (the jetty), a timber frame of posts, floor beams and braces, framed
// glass windows (some shuttered), a door, a chimney and a steep roof — clay
// tiles, or on the cyborg-touched houses corrugated iron, with steel plates
// riveted over wall panels and pipes running into the street.
//
// Houses stand shoulder to shoulder round the edge of each block, fronts to the
// street, with yards behind.

const rand = mulberry32(1415);
const pick = (a) => a[Math.floor(rand() * a.length)];
const between = (a, b) => a + rand() * (b - a);

const G = 3.2;     // ground floor height
const F = 2.9;     // upper floor height
const JET = 0.35;  // how far the upper floors overhang front and back

// One house. (x, z) is the centre of its ground-floor footprint, w along the
// street, d back from it; `yaw` turns its front (local +z) toward the street.
//
// Exported for other towns (the castle village): `y` is the ground it stands
// on, `tech` the share of houses the cyborgs have touched, and `rng` the caller's
// own seeded random — so one town's houses never shift because another town
// happened to be built first.
export function buildHouse(b, x, z, w, d, yaw, floors, { y = CITY.y, tech: techShare = 0.3, rng = rand } = {}) {
  // Shadow the module helpers with ones on the caller's random stream.
  const rand = rng;
  const between = (a, c) => a + rng() * (c - a);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // A box in house-local coordinates.
  const put = (key, lx, ly, lz, bw, bh, bd, roll = 0) =>
    b.box(key, x + lx * c + lz * s, y + ly, z - lx * s + lz * c, bw, bh, bd, { yaw, roll });

  const tech = rand() < techShare;     // touched by the cyborgs
  const upper = floors - 1;
  const top = G + F * upper;
  const D = d + 2 * JET;               // upper-floor depth
  const front = D / 2;

  // ------------------------------------------------------------ the shell
  put('housestone', 0, -0.4, 0, w, G + 0.4, d);
  if (upper > 0) put('plaster', 0, G, 0, w, F * upper, D);

  // ------------------------------------------------- facades (front, back)
  // Upper floors are split into bays between posts; each bay is a window, a
  // braced panel, or (on a tech house) a riveted steel plate.
  const bays = Math.max(1, Math.round((w - 0.4) / 2.4));
  const bay = (w - 0.3) / bays;
  for (const side of [1, -1]) {
    const fz = side * (front + 0.05);
    for (let k = 0; k < upper; k++) {
      const fy = G + F * k;
      put('timber', 0, fy, fz, w, 0.24, 0.14);                        // floor beam
      for (let i = 0; i <= bays; i++) {
        put('timber', -w / 2 + 0.15 + i * bay, fy, fz, 0.22, F, 0.12); // posts
      }
      for (let i = 0; i < bays; i++) {
        const bx = -w / 2 + 0.15 + (i + 0.5) * bay;
        const r = rand();
        if (tech && r < 0.18) {
          put('steel', bx, fy + 0.3, fz + side * 0.03, bay - 0.3, F - 0.5, 0.06);
        } else if (r < 0.68) {
          put('timber', bx, fy + 0.75, fz, 1.1, 1.45, 0.1);            // frame
          put('glass', bx, fy + 0.85, fz + side * 0.03, 0.88, 1.25, 0.08);
          if (rand() < 0.3) {                                          // open shutters
            put('timber', bx - 0.8, fy + 0.85, fz + side * 0.03, 0.45, 1.25, 0.06);
            put('timber', bx + 0.8, fy + 0.85, fz + side * 0.03, 0.45, 1.25, 0.06);
          }
        } else {
          // A diagonal brace across the bay.
          // Tilt from upright by the bay's own diagonal.
          const ang = Math.atan2(bay - 0.3, F - 0.3) * (rand() < 0.5 ? 1 : -1);
          const len = Math.hypot(F - 0.3, bay - 0.3);
          put('timber', bx, fy + F / 2 - len / 2, fz, 0.16, len, 0.1, ang);
        }
      }
    }
    if (upper > 0) put('timber', 0, top - 0.24, fz, w, 0.24, 0.14);   // wall plate

    // Ground floor: the door, and windows either side.
    const gz = side * (d / 2 + 0.04);
    const doorBay = Math.floor(rand() * bays);
    for (let i = 0; i < bays; i++) {
      const bx = -w / 2 + 0.15 + (i + 0.5) * bay;
      if (side === 1 && i === doorBay) {
        put('timber', bx, 0, gz, 1.15, 2.25, 0.12);
        put('housestone', bx, 2.25, gz, 1.6, 0.32, 0.2);              // stone lintel
        // Remember the door, so it can be opened and the house walked into
        // (interiors.js builds the inside from these numbers).
        b.doors.push({
          x: x + bx * c + (gz + 0.2) * s, y, z: z - bx * s + (gz + 0.2) * c, yaw,
          w, d, floors, doorX: bx, tech, seed: Math.floor(rand() * 1e9),
        });
        if (tech && rand() < 0.6) {                                   // a machine box by the door
          put('steel', bx + 1.2, 0, gz + 0.25, 0.6, 0.9, 0.45);
          put('rust', bx + 1.2, 0.9, gz + 0.1, 0.12, top - 0.9, 0.12);  // its pipe up the wall
        }
      } else if (rand() < 0.75) {
        put('timber', bx, 1.0, gz, 1.0, 1.2, 0.08);
        put('glass', bx, 1.08, gz + side * 0.03, 0.8, 1.04, 0.07);
      }
    }
  }

  // ------------------------------------------------------------------ roof
  const roofKey = tech && rand() < 0.7 ? 'tin' : 'rooftiles';
  const wallKey = upper > 0 ? 'plaster' : 'housestone';
  const ridgeAlong = rand() < 0.55;    // ridge along the street, or gable to it
  let rh;
  if (ridgeAlong) {
    rh = D * between(0.42, 0.58);
    b.roof(roofKey, wallKey, x, y + top, z, w, D, rh, { yaw });
  } else {
    rh = w * between(0.5, 0.65);
    b.roof(roofKey, wallKey, x, y + top, z, D, w, rh, { yaw: yaw + Math.PI / 2 });
  }

  // Chimney through the back slope.
  if (rand() < 0.7) {
    put('housestone', between(-w / 4, w / 4), top, -D / 4, 0.85, rh + 0.9, 0.85);
  }
  // A thin mast on a few tech roofs.
  if (tech && rand() < 0.35) {
    put('steel', between(-w / 3, w / 3), top + rh * 0.6, 0, 0.1, 4.5, 0.1);
  }

  // Solid to walk into; too tall to climb.
  const swap = Math.abs(s) > 0.5;
  const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
  b.collider(x - hw, x + hw, z - hd, z + hd, y + top + rh);
}

// Lay a row of houses along one side of a block. `from`..`to` runs along the
// street; `place(a, w, d)` positions a house of width w at along-street a.
function row(from, to, maxDepth, place) {
  let a = from;
  while (to - a > 5) {
    let w = between(7, 11.5);
    if (to - a - w < 6) w = to - a;               // stretch the last to the corner
    const d = between(8, Math.max(8.5, maxDepth));
    place(a + w / 2, w, Math.min(d, maxDepth));
    a += w;
    if (rand() < 0.08) a += 3;                    // a passage through to the yards
  }
}

export function buildHouses(b) {
  // A city house, unless it would stand on the round market.
  const cityHouse = (x, z, w, d, yaw, floors) => {
    const swap = Math.abs(Math.sin(yaw)) > 0.5;
    const hw = (swap ? d : w) / 2 + JET, hd = (swap ? w : d) / 2 + JET;
    if (inMarket(x - hw, x + hw, z - hd, z + hd)) return false;
    buildHouse(b, x, z, w, d, yaw, floors);
    return true;
  };
  let count = 0;
  for (const k of BLOCKS) {
    const bw = k.maxX - k.minX, bd = k.maxZ - k.minZ;
    const nearMain = Math.min(Math.abs(k.minZ - MAIN.z), Math.abs(k.maxZ - MAIN.z)) < MAIN.width;
    const floors = () => 2 + (rand() < 0.55 ? 1 : 0) + (nearMain && rand() < 0.6 ? 1 : 0);

    // North and south rows run the full width; east and west rows fill the gap
    // between them.
    const depthNS = Math.min(11, bd / 2 - 0.5);
    let usedN = 0, usedS = 0;
    row(k.minX, k.maxX, depthNS, (a, w, d) => {
      if (cityHouse(a, k.minZ + d / 2, w, d, Math.PI, floors())) { usedN = Math.max(usedN, d); count++; }
    });
    row(k.minX, k.maxX, depthNS, (a, w, d) => {
      if (cityHouse(a, k.maxZ - d / 2, w, d, 0, floors())) { usedS = Math.max(usedS, d); count++; }
    });
    const z0 = k.minZ + usedN + JET + 0.6, z1 = k.maxZ - usedS - JET - 0.6;
    if (z1 - z0 > 7) {
      const depthEW = Math.min(11, bw / 2 - 0.5);
      row(z0, z1, depthEW, (a, w, d) => {
        if (cityHouse(k.minX + d / 2, a, w, d, -Math.PI / 2, floors())) count++;
      });
      row(z0, z1, depthEW, (a, w, d) => {
        if (cityHouse(k.maxX - d / 2, a, w, d, Math.PI / 2, floors())) count++;
      });
    }
  }
  return count;
}
