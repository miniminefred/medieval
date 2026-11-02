import { CITY } from '../terrain.js';
import { BLOCKS, MAIN, inMarket, POND } from './streets.js';
import { mulberry32 } from '../../noise.js';

// Medieval town houses, and how the cyborg city's differ (docs/DESIGN.md,
// 2026-11-02): old and new, rich and poor, mixed side by side.
//
// A house is a hollow ground floor (so its door opens into it, doorways.js),
// upper floors that may jut out over the street (the jetty), windows, a door,
// chimneys and a steep roof. Its **style** says what it is made of:
//   - rich: dressed stone or brick, limewashed upper floors, slate, tall
//     windows, stone quoins, balconies, dormers, porches, two chimneys;
//   - middling: rubble stone or brick, plaster in a few colours, clay tiles;
//   - poor: rubble, old brick or planks, no jetty, small windows, board roofs.
// **Old** houses are weathered — cracked plaster, crumbling brick, bare stone
// where the plaster fell, boarded windows — and most of them have been
// **repaired by the cyborgs**: steel plates over the holes, tin roofs, pipes and
// machine boxes. New houses are clean, with no metal at all.
//
// **Special buildings** (a smithy, a tavern, a bakery…) hang a sign by the door
// and get a shop window; their insides are their trade's (interiors.js).
//
// Houses stand shoulder to shoulder round the edge of each block, fronts to the
// street, with yards behind.

const rand = mulberry32(1415);
const between = (a, b) => a + rand() * (b - a);

const G = 3.2;     // ground floor height
const F = 2.9;     // upper floor height
const JET = 0.35;  // how far the upper floors overhang front and back

// The special buildings of the cyborg city, and the words on their signs.
export const SPECIALS = {
  smithy: 'Smithy', tavern: 'Tavern', bakery: 'Bakery', library: 'Library', carpenter: 'Carpenter',
  fishmonger: 'Fishmonger', butcher: 'Butcher', apothecary: 'Apothecary', tailor: 'Tailor',
};

// The plain town house other towns still use (until they get styles of their own).
const PLAIN = { age: 'mid', wealth: 'mid', ground: 'housestone', upper: 'plaster', roof: 'rooftiles', patched: false, jetty: true };

// A cyborg-city house's look, drawn from `rng`.
export function houseStyle(rng) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const a = rng(), r = rng();
  const age = a < 0.4 ? 'old' : a < 0.7 ? 'mid' : 'new';
  const wealth = r < 0.3 ? 'poor' : r < 0.78 ? 'mid' : 'rich';
  let ground = pick({ rich: ['ashlar', 'ashlar', 'brick'], mid: ['housestone', 'housestone', 'brick'], poor: ['housestone', 'oldbrick', 'siding'] }[wealth]);
  if (age === 'old' && ground === 'brick') ground = 'oldbrick';
  if (age === 'new' && ground === 'oldbrick') ground = 'brick';
  let upper = pick({
    rich: ['plasterwhite', 'plasterochre', 'plasterrose', ground === 'brick' ? 'brick' : 'plasterwhite'],
    mid: ['plaster', 'plasterochre', 'plasterrose', 'plastersage', 'plasterwhite', 'plaster'],
    poor: ['siding', 'oldplaster', 'plaster'],
  }[wealth]);
  if (age === 'old' && upper.startsWith('plaster') && rng() < 0.6) upper = 'oldplaster';
  if (age === 'new' && upper === 'oldplaster') upper = 'plaster';
  const roof = wealth === 'rich' ? 'slate' : wealth === 'poor' ? pick(['roofplanks', 'rooftiles']) : (rng() < 0.2 ? 'slate' : 'rooftiles');
  return { age, wealth, ground, upper, roof, patched: age === 'old' && rng() < 0.75, jetty: wealth !== 'poor' && rng() < 0.85 };
}

// One house. (x, z) is the centre of its ground-floor footprint, w along the
// street, d back from it; `yaw` turns its front (local +z) toward the street.
//
// Exported for other towns (the castle village): `y` is the ground it stands
// on, `tech` > 0 gives it a cyborg-city style (otherwise the plain house), and
// `rng` the caller's own seeded random — so one town's houses never shift
// because another town happened to be built first. `kind` makes it a special
// building (SPECIALS).
export function buildHouse(b, x, z, w, d, yaw, floors, { y = CITY.y, tech: techShare = 0.3, rng = rand, style = null, kind = null } = {}) {
  // Shadow the module helpers with ones on the caller's random stream.
  const rand = rng;
  const between = (a, c) => a + rng() * (c - a);
  const st = style ?? (techShare > 0 ? houseStyle(rng) : PLAIN);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => x + lx * c + lz * s, wz = (lx, lz) => z - lx * s + lz * c;
  // A box in house-local coordinates.
  const put = (key, lx, ly, lz, bw, bh, bd, roll = 0, pitch = 0) =>
    b.box(key, wx(lx, lz), y + ly, wz(lx, lz), bw, bh, bd, { yaw, roll, pitch });

  const tech = st.patched;             // repaired by the cyborgs
  const old = st.age === 'old', rich = st.wealth === 'rich', poor = st.wealth === 'poor';
  const upper = floors - 1;
  const top = G + F * upper;
  const D = st.jetty ? d + 2 * JET : d;  // upper-floor depth
  const front = D / 2;
  const framed = st.upper.includes('plaster');   // timber-framed (brick and planks are not)
  const trim = st.ground === 'siding' ? 'timber' : st.ground === 'ashlar' ? 'ashlar' : 'housestone';
  let door = null;

  // ------------------------------------------------------------ the shell
  // The ground floor is hollow — four walls, the front one round the doorway —
  // so the door opens straight into the house (doorways.js puts the door in,
  // interiors.js the rooms, both built in place). Upper floors are a solid
  // block until the inside is built.
  const T = 0.2;                       // wall thickness (interiors.js WALL)
  const wall = (lx, lz, bw, bd, ly = -0.4, bh = G + 0.4) =>
    b.box(st.ground, wx(lx, lz), y + ly, wz(lx, lz), bw, bh, bd, { yaw, collide: true });
  wall(0, -d / 2 + T / 2, w, T);                                  // back
  wall(-w / 2 + T / 2, 0, T, d - 2 * T);                          // sides
  wall(w / 2 - T / 2, 0, T, d - 2 * T);
  if (upper > 0) put(st.upper, 0, G, 0, w, F * upper, D);

  // Rich houses: dressed-stone quoins up the front corners, a band at the first floor.
  if (rich && st.ground !== 'ashlar') {
    for (const sx of [-1, 1]) put('ashlar', sx * (w / 2 - 0.2), -0.4, d / 2 + 0.03, 0.42, G + 0.4, 0.07);
  }
  if (rich && upper > 0) put('ashlar', 0, G - 0.12, front + 0.04, w + 0.06, 0.2, 0.1);

  // ------------------------------------------------- facades (front, back)
  // Upper floors are split into bays; on a framed house each bay sits between
  // posts and is a window, a braced panel, or (repaired) a riveted steel plate.
  const bays = Math.max(1, Math.round((w - 0.4) / 2.4));
  const bay = (w - 0.3) / bays;
  // A window of this house's kind, centred at (bx, wy) on the face at fz.
  const win = (bx, wy, fz, side, ground = false) => {
    const [fw, fh, gw, gh] = rich ? [1.1, 1.75, 0.88, 1.55] : poor ? [0.85, 1.1, 0.65, 0.9] : ground ? [1.0, 1.2, 0.8, 1.04] : [1.1, 1.45, 0.88, 1.25];
    const lo = wy - fh / 2;
    if (old && !tech && rand() < 0.18) {                         // boarded up
      put('timber', bx, lo, fz + side * 0.02, fw, fh, 0.1);
      put('timber', bx, lo + fh / 2, fz + side * 0.07, fw * 1.1, 0.14, 0.05, 0.6);
      return;
    }
    put('timber', bx, lo, fz, fw, fh, 0.1);                       // frame
    put('glass', bx, lo + (fh - gh) / 2, fz + side * 0.03, gw, gh, 0.08);
    if (rich) put(trim, bx, lo - 0.08, fz + side * 0.05, fw + 0.2, 0.1, 0.12);   // a stone sill
    const shut = rand();
    if (shut < (poor ? 0.45 : 0.3)) {                             // open shutters
      put('timber', bx - fw * 0.73, lo + (fh - gh) / 2, fz + side * 0.03, fw * 0.41, gh, 0.06);
      put('timber', bx + fw * 0.73, lo + (fh - gh) / 2, fz + side * 0.03, fw * 0.41, gh, 0.06);
    }
  };
  const balconyBay = rich && upper > 0 && rand() < 0.55 ? Math.floor(bays / 2) : -1;
  for (const side of [1, -1]) {
    const fz = side * (front + 0.05);
    for (let k = 0; k < upper; k++) {
      const fy = G + F * k;
      if (framed) {
        put('timber', 0, fy, fz, w, 0.24, 0.14);                        // floor beam
        for (let i = 0; i <= bays; i++) put('timber', -w / 2 + 0.15 + i * bay, fy, fz, 0.22, F, 0.12); // posts
      } else if (st.upper === 'siding') {
        for (const sx of [-1, 1]) put('timber', sx * (w / 2 - 0.1), fy, fz, 0.2, F, 0.12);   // corner boards
      }
      for (let i = 0; i < bays; i++) {
        const bx = -w / 2 + 0.15 + (i + 0.5) * bay;
        const r = rand();
        if (side === 1 && k === 0 && i === balconyBay) {
          // A balcony: a glazed door onto a railed timber platform.
          put('timber', bx, fy + 0.1, fz, 1.0, 2.2, 0.1);
          put('glass', bx, fy + 0.25, fz + 0.03, 0.8, 1.9, 0.08);
          const bw = Math.min(bay - 0.2, 2.2), depth = 0.85;
          put('timber', bx, fy, fz + depth / 2, bw, 0.12, depth);
          for (let t = -bw / 2 + 0.05; t <= bw / 2 - 0.04; t += 0.22) put('timber', bx + t, fy + 0.12, fz + depth - 0.05, 0.05, 0.85, 0.05);
          for (const sx of [-1, 1]) put('timber', bx + sx * (bw / 2 - 0.03), fy + 0.12, fz + depth / 2, 0.05, 0.85, depth);
          put('timber', bx, fy + 0.95, fz + depth - 0.05, bw, 0.07, 0.09);
          for (const sx of [-1, 1]) put('timber', bx + sx * (bw / 2 - 0.15), fy - 0.55, fz + 0.3, 0.1, 0.6, 0.1, 0, 0.75);  // brackets
        } else if (tech && r < 0.25) {
          put('steel', bx, fy + 0.3, fz + side * 0.03, bay - 0.3, F - 0.5, 0.06);
        } else if (r < (poor ? 0.55 : 0.7)) {
          win(bx, fy + 1.45, fz, side);
        } else if (framed) {
          // A diagonal brace across the bay, tilted by the bay's own diagonal.
          const ang = Math.atan2(bay - 0.3, F - 0.3) * (rand() < 0.5 ? 1 : -1);
          const len = Math.hypot(F - 0.3, bay - 0.3);
          put('timber', bx, fy + F / 2 - len / 2, fz, 0.16, len, 0.1, ang);
        }
        // Old plaster falling away to the stone behind it.
        if (old && st.upper === 'oldplaster' && !tech && rand() < 0.2) {
          put('housestone', bx + between(-0.4, 0.4), fy + between(0.2, 1.6), fz - side * 0.02, between(0.5, 0.9), between(0.4, 0.8), 0.06);
        }
      }
    }
    if (upper > 0 && framed) put('timber', 0, top - 0.24, fz, w, 0.24, 0.14);   // wall plate

    // Ground floor: the door, and windows either side.
    const gz = side * (d / 2 + 0.04);
    const doorBay = Math.floor(rand() * bays);
    // A special building shows its trade in one wide window by the door.
    const shopBay = kind && bays > 1 ? (doorBay + 1) % bays : -1;
    for (let i = 0; i < bays; i++) {
      const bx = -w / 2 + 0.15 + (i + 0.5) * bay;
      if (side === 1 && i === doorBay) {
        put(trim, bx, 2.25, gz, 1.6, 0.32, 0.2);                     // lintel
        // The front wall, round a doorway 1.2 m wide.
        const half = 0.6, fz = d / 2 - T / 2;
        const lw = bx - half + w / 2 - T, rw = w / 2 - T - (bx + half);
        if (lw > 0.02) wall(-w / 2 + T + lw / 2, fz, lw, T);
        if (rw > 0.02) wall(w / 2 - T - rw / 2, fz, rw, T);
        wall(-w / 2 + T / 2, fz, T, T);                               // the corners
        wall(w / 2 - T / 2, fz, T, T);
        put(st.ground, bx, 2.25, fz, 2 * half, G - 2.25, T);          // over the door
        // A little roof over the door on some houses (always where there is no jetty to shelter it).
        if (!poor && (rich || !st.jetty || rand() < 0.3)) {
          put(st.roof === 'slate' ? 'slate' : 'rooftiles', bx, 2.62, d / 2 + 0.45, 1.9, 0.06, 0.95, 0, 0.35);
          for (const sx of [-1, 1]) put('timber', bx + sx * 0.85, 2.2, d / 2 + 0.25, 0.08, 0.5, 0.08, 0, -0.7);
        }
        // Remember the door, so it can be opened and the house walked into
        // (doorways.js, interiors.js build them from these numbers).
        door = {
          x: wx(bx, gz + 0.2), y, z: wz(bx, gz + 0.2), yaw,
          cx: x, cz: z, w, d, floors, doorX: bx, tech, seed: Math.floor(rand() * 1e9),
          wealth: st.wealth, age: st.age, kind,
        };
        b.doors.push(door);
        if (tech && rand() < 0.6) {                                   // a machine box by the door
          put('steel', bx + 1.2, 0, gz + 0.25, 0.6, 0.9, 0.45);
          put('rust', bx + 1.2, 0.9, gz + 0.1, 0.12, top - 0.9, 0.12);  // its pipe up the wall
        }
        // The sign, hung out from the wall beside the door, across the street's line.
        if (kind) {
          const sx = bx + (bx > 0 ? -1.15 : 1.15);
          put('timber', sx, 2.85, d / 2 + 0.5, 0.07, 0.07, 1.0);      // the arm
          put('timber', sx, 2.45, d / 2 + 0.06, 0.08, 0.5, 0.08, 0, 0.8);   // its strut
          b.signs.push({ text: SPECIALS[kind], x: wx(sx, d / 2 + 0.62), y: y + 2.5, z: wz(sx, d / 2 + 0.62), yaw: yaw + Math.PI / 2 });
        }
      } else if (side === 1 && i === shopBay) {
        put('timber', bx, 0.55, gz, Math.min(bay - 0.3, 2.0), 1.7, 0.1);
        put('glass', bx, 0.65, gz + 0.03, Math.min(bay - 0.3, 2.0) - 0.2, 1.5, 0.08);
        put(trim, bx, 0.45, gz + 0.06, Math.min(bay - 0.3, 2.0) + 0.1, 0.12, 0.3);
      } else if (rand() < (poor ? 0.6 : 0.75)) {
        win(bx, 1.6, gz, side, true);
      } else if (tech && rand() < 0.5) {
        put('rust', bx, 0.3, gz + side * 0.02, bay * 0.6, 1.6, 0.05);   // a patch over a hole
      }
    }
  }

  // ------------------------------------------------------------------ roof
  const roofKey = tech && rand() < 0.6 ? 'tin' : st.roof;
  const wallKey = upper > 0 ? st.upper : st.ground;
  const ridgeAlong = rand() < 0.55;    // ridge along the street, or gable to it
  let rh;
  if (ridgeAlong) {
    rh = D * between(0.42, 0.58);
    b.roof(roofKey, wallKey, x, y + top, z, w, D, rh, { yaw });
    // Dormers on the street side of a rich or middling roof.
    if (!poor && rand() < (rich ? 0.8 : 0.3) && w > 6) {
      const n = w > 9 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const dx = n === 1 ? 0 : (i ? 1 : -1) * w / 4;
        // From halfway up the slope out to just short of the eaves.
        const dd = D / 4 - 0.15, dzc = D / 4 + dd / 2, hb = rh / 2 + 0.15, fzd = D / 2 - 0.15;
        put(wallKey, dx, top, dzc, 1.3, hb, dd);
        put('timber', dx, top + hb - 1.05, fzd + 0.03, 0.95, 0.8, 0.08);
        put('glass', dx, top + hb - 0.98, fzd + 0.06, 0.75, 0.65, 0.06);
        b.roof(roofKey, wallKey, wx(dx, dzc + 0.05), y + top + hb, wz(dx, dzc + 0.05), dd + 0.1, 1.3, 0.5, { yaw: yaw + Math.PI / 2, over: 0.12 });
      }
    }
    // A repaired roof: tin sheets nailed over the worst of the tiles.
    if (tech && roofKey !== 'tin') {
      const pitch = Math.atan2(rh, D / 2);
      for (let i = 0; i < 1 + Math.floor(rand() * 2); i++) {
        const lx = between(-w / 3, w / 3), t = between(0.25, 0.7);
        put('tin', lx, top + rh * (1 - t) - 0.02 + 0.08, (D / 2) * t, between(1.2, 2.2), 0.04, between(1.2, 1.8), 0, pitch);
      }
    }
  } else {
    rh = w * between(0.5, 0.65);
    b.roof(roofKey, wallKey, x, y + top, z, D, w, rh, { yaw: yaw + Math.PI / 2 });
  }

  // Chimneys through the back slope: two on a rich house, none on many poor ones;
  // a repaired house may have a rusty flue instead.
  const chimneys = rich ? 2 : poor ? (rand() < 0.5 ? 1 : 0) : (rand() < 0.7 ? 1 : 0);
  for (let i = 0; i < chimneys; i++) {
    const cx = chimneys === 2 ? (i ? 1 : -1) * w / 3 : between(-w / 4, w / 4);
    if (tech && rand() < 0.4) b.cylinder('rust', wx(cx, -D / 4), y + top, wz(cx, -D / 4), 0.18, rh + 1.4, { sides: 10 });
    else put(rich ? (st.ground === 'brick' ? 'brick' : 'ashlar') : 'housestone', cx, top, -D / 4, 0.85, rh + 0.9, 0.85);
  }
  if (kind === 'smithy' || kind === 'bakery') put('housestone', w / 2 - 0.8, top, -D / 4, 1.1, rh + 1.6, 1.1);   // the forge or oven's flue
  // A thin mast on a few repaired roofs.
  if (tech && rand() < 0.3) {
    put('steel', between(-w / 3, w / 3), top + rh * 0.6, 0, 0.1, 4.5, 0.1);
  }

  // Above the ground floor the house is solid (too tall to climb anyway),
  // until its inside is built and the upper rooms take over (door.block).
  const swap = Math.abs(s) > 0.5;
  const hw = (swap ? D : w) / 2, hd = (swap ? w : D) / 2;
  b.collider(x - hw, x + hw, z - hd, z + hd, y + top + rh, y + G);
  door.block = b.colliders[b.colliders.length - 1];
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
  // First lay out every house, then choose which are special, then build.
  const plans = [];
  const cityHouse = (x, z, w, d, yaw, floors) => {
    const swap = Math.abs(Math.sin(yaw)) > 0.5;
    const hw = (swap ? d : w) / 2 + JET, hd = (swap ? w : d) / 2 + JET;
    if (inMarket(x - hw, x + hw, z - hd, z + hd)) return false;
    plans.push({ x, z, w, d, yaw, floors });
    return true;
  };
  for (const k of BLOCKS) {
    if (k === POND.block) continue;               // the pond's green
    const bw = k.maxX - k.minX, bd = k.maxZ - k.minZ;
    const nearMain = Math.min(Math.abs(k.minZ - MAIN.z), Math.abs(k.maxZ - MAIN.z)) < MAIN.width;
    const floors = () => 2 + (rand() < 0.55 ? 1 : 0) + (nearMain && rand() < 0.6 ? 1 : 0);

    // North and south rows run the full width; east and west rows fill the gap
    // between them.
    const depthNS = Math.min(11, bd / 2 - 0.5);
    let usedN = 0, usedS = 0;
    row(k.minX, k.maxX, depthNS, (a, w, d) => {
      if (cityHouse(a, k.minZ + d / 2, w, d, Math.PI, floors())) usedN = Math.max(usedN, d);
    });
    row(k.minX, k.maxX, depthNS, (a, w, d) => {
      if (cityHouse(a, k.maxZ - d / 2, w, d, 0, floors())) usedS = Math.max(usedS, d);
    });
    const z0 = k.minZ + usedN + JET + 0.6, z1 = k.maxZ - usedS - JET - 0.6;
    if (z1 - z0 > 7) {
      const depthEW = Math.min(11, bw / 2 - 0.5);
      row(z0, z1, depthEW, (a, w, d) => cityHouse(k.minX + d / 2, a, w, d, -Math.PI / 2, floors()));
      row(z0, z1, depthEW, (a, w, d) => cityHouse(k.maxX - d / 2, a, w, d, Math.PI / 2, floors()));
    }
  }

  // The special buildings, spread about town: each takes the house nearest its
  // spot (the fishmonger by the pond, the tavern and the smithy on the main
  // street near the gate, the rest wherever they fall). Never two in one house.
  const doorOf = (p) => [p.x + Math.sin(p.yaw) * p.d / 2, p.z + Math.cos(p.yaw) * p.d / 2];
  const spots = {
    tavern: [360, MAIN.z - 8], smithy: [330, MAIN.z + 8],
    fishmonger: [POND.x, POND.z],
    bakery: [470, MAIN.z + 40], butcher: [500, MAIN.z - 40], apothecary: [560, MAIN.z + 12],
    library: [620, MAIN.z - 70], carpenter: [700, MAIN.z + 90], tailor: [520, MAIN.z + 110],
  };
  for (const [kind, [sx, sz]] of Object.entries(spots)) {
    let best = null, bd = Infinity;
    for (const p of plans) {
      if (p.kind || p.w < 7.5) continue;
      const [dx, dz] = doorOf(p);
      const dd = Math.hypot(dx - sx, dz - sz);
      if (dd < bd) { bd = dd; best = p; }
    }
    if (best) best.kind = kind;
  }
  for (const p of plans) buildHouse(b, p.x, p.z, p.w, p.d, p.yaw, p.floors, { kind: p.kind });
  return plans.length;
}
