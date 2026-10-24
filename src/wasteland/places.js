import * as THREE from 'three';

// Where things are in World 1 (the owner's map in docs/DESIGN.md), and the road.
//
// The road is an upside-down Y. The stem runs from the portal to World 2 at the
// top of the map, past the fallen dragon city, down past the arrival point to the
// fork at Farmville. There it splits: one branch to the cyborg city's gate, one
// to the brute city, and both carry on south into the winterland.
//
// Pure data and geometry maths — no meshes — so terrain.js can level the ground
// under the road before the land is even built.

export const PLACES = {
  arrival: { x: 0, z: 0 },
  farmville: { x: 0, z: 175 },              // at the fork
  cyborgGate: { x: 268, z: 290 },           // just outside the west gate
  bruteCity: { x: -650, z: 290 },
  apexCity: { x: -100, z: 400 },
  dragonCity: { x: 640, z: -260 },
  portalW2: { x: 640, z: -960 },            // the way to World 2, top of the map
};

// Bandit camps: five small ones spread over the desert and one big camp (the
// second mid boss's). Kept well off the road.
export const CAMPS = [
  { x: -430, z: -380, big: false },
  { x: 330, z: -560, big: false },
  { x: -860, z: -40, big: false },
  { x: -250, z: -830, big: false },
  { x: 900, z: -640, big: false },
  { x: -400, z: 60, big: true },
];

// Control points of each road; smoothed into curves below.
const ROUTES = [
  // The stem: portal → dragon city → past the arrival point → the fork.
  [[640, -960], [655, -700], [640, -420], [610, -270], [420, -200], [180, -110], [22, -30], [16, 60], [6, 150], [0, 175]],
  // East branch: fork → cyborg gate → south along the wall into the snow.
  [[0, 175], [90, 215], [190, 268], [268, 290], [240, 420], [250, 560], [300, 720], [330, 860]],
  // West branch: fork → brute city → south into the snow.
  [[0, 175], [-120, 215], [-300, 255], [-480, 280], [-650, 290], [-660, 450], [-640, 620], [-600, 800]],
];

// Paved within this far of a city; a dirt track in between (docs/DESIGN.md).
const PAVED = [
  { ...PLACES.cyborgGate, r: 170 },
  { ...PLACES.bruteCity, r: 170 },
  { ...PLACES.dragonCity, r: 150 },
  { ...PLACES.farmville, r: 60 },
];
export const ROAD_WIDTH = 6;

// Sample every road at ~3 m into polylines of { x, z, paved }.
export const ROADS = ROUTES.map((pts) => {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.ceil(curve.getLength() / 3);
  return curve.getSpacedPoints(n).map((p) => ({
    x: p.x, z: p.z,
    paved: PAVED.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r),
  }));
});

// ------------------------------------------------- distance to the nearest road
// A 40 m grid of which road segments pass through each cell, so asking "how far
// is the road" for half a million terrain vertices stays cheap.
const CELL = 40;
const grid = new Map();
for (let r = 0; r < ROADS.length; r++) {
  const pts = ROADS[r];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const minX = Math.floor((Math.min(a.x, b.x) - 20) / CELL), maxX = Math.floor((Math.max(a.x, b.x) + 20) / CELL);
    const minZ = Math.floor((Math.min(a.z, b.z) - 20) / CELL), maxZ = Math.floor((Math.max(a.z, b.z) + 20) / CELL);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const key = cx * 100003 + cz;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(a, b);
      }
    }
  }
}

// Distance from (x, z) to the nearest road centreline (Infinity if > ~20 m).
export function roadDistance(x, z) {
  const list = grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
  if (!list) return Infinity;
  let best = Infinity;
  for (let i = 0; i < list.length; i += 2) {
    const a = list[i], b = list[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (d < best) best = d;
  }
  return best;
}

// Level ground: Farmville and the bandit camps sit on flat patches.
export const FLATS = [
  { x: PLACES.farmville.x, z: PLACES.farmville.z, r: 70 },
  ...CAMPS.map((c) => ({ x: c.x, z: c.z, r: c.big ? 48 : 30 })),
];
