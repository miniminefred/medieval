import { CITY } from '../terrain.js';

// The cyborg city's curtain wall: thick medieval stone, reinforced by the
// cyborgs with steel — buttress plates up the outer face, a steel band under the
// battlements, plated tower crowns. One gate, in the west wall, facing the middle
// of the map where travellers arrive.

export const WALL = {
  thick: 4,
  high: 13,
  towerSize: 10,
  towerHigh: 19,
  towerEvery: 90,
  gateZ: (CITY.minZ + CITY.maxZ) / 2,
  gateWidth: 10,
  gateHigh: 9,
};

export function buildWall(b) {
  const y = CITY.y;
  const T = WALL.thick, H = WALL.high;
  const { minX, maxX, minZ, maxZ } = CITY;

  // Each side as a run from a to b along one axis, with the outward direction.
  const sides = [
    { axis: 'x', fixed: minZ + T / 2, from: minX, to: maxX, out: -1 },   // north
    { axis: 'x', fixed: maxZ - T / 2, from: minX, to: maxX, out: 1 },    // south
    { axis: 'z', fixed: minX + T / 2, from: minZ, to: maxZ, out: -1 },   // west (gate)
    { axis: 'z', fixed: maxX - T / 2, from: minZ, to: maxZ, out: 1 },    // east
  ];

  const g0 = WALL.gateZ - WALL.gateWidth / 2;
  const g1 = WALL.gateZ + WALL.gateWidth / 2;

  // Places a box given along-wall position `a`, across offset `c` (positive =
  // outward), and sizes along/across.
  function onSide(s, mat, a, c, y0, len, h, depth, opts = {}) {
    const across = s.fixed + c * s.out;
    if (s.axis === 'x') b.box(mat, a, y0, across, len, h, depth, opts);
    else b.box(mat, across, y0, a, depth, h, len, opts);
  }

  for (const s of sides) {
    const isGate = s.axis === 'z' && s.out === -1;
    // Stretches of wall, split around the gate opening.
    const runs = isGate ? [[s.from, g0], [g1, s.to]] : [[s.from, s.to]];

    for (const [r0, r1] of runs) {
      const len = r1 - r0, mid = (r0 + r1) / 2;
      // Body, and a battered (thicker) foot that buries the join with the ground.
      onSide(s, 'citywall', mid, 0, y - 0.5, len, H + 0.5, T, { collide: true });
      onSide(s, 'citywall', mid, 0.5, y - 0.5, len, 2.6, T + 1);
      // Steel band just under the battlements, proud of the outer face.
      onSide(s, 'steel', mid, T / 2 + 0.05, y + H - 1.4, len, 0.9, 0.25);
      // Walkway parapet on the inner edge (low) and merlons on the outer edge.
      onSide(s, 'citywall', mid, -T / 2 + 0.3, y + H, len, 1.0, 0.6);
      for (let a = r0 + 1.2; a < r1 - 1; a += 3.2) {
        onSide(s, 'citywall', a + 0.8, T / 2 - 0.35, y + H, 1.6, 1.7, 0.7);
      }
      // Steel buttress plates up the outer face, every 15 m; every third rusted.
      let n = 0;
      for (let a = r0 + 7.5; a < r1 - 4; a += 15, n++) {
        const mat = n % 3 === 2 ? 'rust' : 'steel';
        onSide(s, mat, a, T / 2 + 0.25, y + 2.0, 1.5, H - 3.8, 0.5);   // stands on the battered foot
      }
    }

    // Towers: corners and evenly between, never on the gate (the gatehouse has
    // its own pair).
    const span = s.to - s.from;
    const count = Math.max(1, Math.round(span / WALL.towerEvery));
    for (let i = 0; i <= count; i++) {
      const a = s.from + (span * i) / count + (i === 0 ? WALL.towerSize / 2 : i === count ? -WALL.towerSize / 2 : 0);
      if (isGate && Math.abs(a - WALL.gateZ) < WALL.gateWidth / 2 + WALL.towerSize * 1.6) continue;
      if (i === 0 && s.axis === 'z') continue;            // corners already built by
      if (i === count && s.axis === 'z') continue;        // the north and south sides
      tower(onSide, s, a, y);
    }
  }

  gatehouse(b, y, g0, g1);
}

function tower(onSide, s, a, y) {
  const S = WALL.towerSize, H = WALL.towerHigh;
  const c = 1.2;   // towers stand a little proud of the wall's outer face
  onSide(s, 'citywall', a, c, y - 0.5, S, H + 0.5, S, { collide: true });
  onSide(s, 'citywall', a, c, y - 0.5, S + 1.2, 3, S + 1.2);
  // Steel crown and corner plates.
  onSide(s, 'steel', a, c, y + H - 1.6, S + 0.5, 1.1, S + 0.5);
  for (const k of [-1, 1]) {
    onSide(s, 'steel', a + k * (S / 2 - 0.3), c + S / 2 + 0.1, y - 0.3, 1.0, H - 2, 0.4);
  }
  // Merlons round the top.
  for (let i = 0; i < 4; i++) {
    const off = -S / 2 + 1 + i * ((S - 2) / 3);
    onSide(s, 'citywall', a + off, c + S / 2 - 0.4, y + H, 1.4, 1.6, 0.8);
    onSide(s, 'citywall', a + off, c - S / 2 + 0.4, y + H, 1.4, 1.6, 0.8);
    onSide(s, 'citywall', a - S / 2 + 0.4, c + off, y + H, 0.8, 1.6, 1.4);
    onSide(s, 'citywall', a + S / 2 - 0.4, c + off, y + H, 0.8, 1.6, 1.4);
  }
}

// Two big towers either side of the opening, a stone bridge over it, and the
// gates themselves swung open against the inside of the towers.
function gatehouse(b, y, g0, g1) {
  const x = CITY.minX + WALL.thick / 2;
  const S = 12, H = 23, Wg = WALL.gateWidth;
  for (const [zc, k] of [[g0 - S / 2, -1], [g1 + S / 2, 1]]) {
    b.box('citywall', x - 1.5, y - 0.5, zc, S + 3, H + 0.5, S, { collide: true });
    b.box('citywall', x - 1.5, y - 0.5, zc, S + 4.2, 3, S + 1.2);
    b.box('steel', x - 1.5, y + H - 1.8, zc, S + 3.5, 1.2, S + 0.5);
    // Steel plating up the face that looks out over the approach.
    b.box('steel', x - 1.5 - (S + 3) / 2 - 0.15, y - 0.3, zc, 0.4, H - 3, S - 2);
    for (let i = 0; i < 4; i++) {
      const off = -S / 2 + 1.2 + i * ((S - 2.4) / 3);
      b.box('citywall', x - 1.5 - (S + 3) / 2 + 0.4, y + H, zc + off, 0.8, 1.7, 1.4);
      b.box('citywall', x - 1.5 + (S + 3) / 2 - 0.4, y + H, zc + off, 0.8, 1.7, 1.4);
    }
    // The gate leaf, open: swung inward to lie along the passage wall.
    const leafZ = k < 0 ? g0 + 0.35 : g1 - 0.35;
    b.box('timber', x + WALL.thick / 2 + Wg / 4 + 0.6, y, leafZ, Wg / 2, WALL.gateHigh - 0.4, 0.5, { collide: true });
    for (const hy of [1.2, 4.0, 6.8]) {   // iron straps across the planks
      b.box('rust', x + WALL.thick / 2 + Wg / 4 + 0.6, y + hy, leafZ, Wg / 2 + 0.05, 0.35, 0.62);
    }
  }
  // The stone over the opening, and its steel lintel.
  const over = H - WALL.gateHigh;
  b.box('citywall', x - 1.5, y + WALL.gateHigh, (g0 + g1) / 2, S + 3, over, Wg);
  b.box('steel', x - 1.5 - (S + 3) / 2 - 0.1, y + WALL.gateHigh - 0.2, (g0 + g1) / 2, 0.5, 1.0, Wg + 1);
  // The passage floor is paved, out across the approach and in to the city.
  b.box('cobble', x + 2, y - 0.25, (g0 + g1) / 2, 36, 0.3, Wg);
}
