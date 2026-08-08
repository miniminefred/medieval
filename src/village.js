import * as THREE from 'three';

// The settlement that grew up outside the castle gate: a dirt road running south
// from the gatehouse, a market plaza, a street of houses and workshops, a farm,
// a fenced pasture, a fishing pond with a dock, and woods closing the horizon.
//
// Everything is placed deterministically (seeded RNG) so the world is identical on
// every reload, and every placement goes through the same reservation grid, so
// nothing ever ends up inside anything else. `isOccupied` is what the grass system
// asks before it grows a blade — it answers for roads, floors, footprints and water.

// ---------------------------------------------------------------- geometry of the plan
// (world.js: castle walls on x,z = ±20, corner towers out to ±23, gate gap in the
//  south wall at z = +20, player spawns at (0, 1.7, 36) looking north.)

const CASTLE_KEEPOUT = 30;     // nothing of ours inside this square
const ROAD_HALF = 3.5;         // main road runs south from the gate along x = 0
const ROAD_END = 132;
const PLAZA = { minX: -16, maxX: 16, minZ: 22, maxZ: 42 };
const CROSS_Z = 62, CROSS_HALF = 3, CROSS_X = 48;   // east-west street
const LANE_Z = 28, LANE_HALF = 2;                   // market -> pond lane
const POND = { x: -40, z: 26, rx: 13, rz: 10.5 };
const PASTURE = { minX: 30, maxX: 58, minZ: 74, maxZ: 102 };
const FIELD = { minX: -56, maxX: -38, minZ: 72, maxZ: 90 };

// Quaternius GLBs come out of the glTF exporter facing +Z, so "turn to face a point"
// is a plain atan2. Flip this one constant if a future pack faces the other way.
const MODEL_FRONT = 0;

const MAT = {
  dirt: new THREE.MeshStandardMaterial({ color: 0x6d5b42, roughness: 1 }),
  plaza: new THREE.MeshStandardMaterial({ color: 0x7a6b53, roughness: 1 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x4e3d2b, roughness: 1 }),
  mud: new THREE.MeshStandardMaterial({ color: 0x6a5f45, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({
    color: 0x2c5c6b, roughness: 0.12, metalness: 0.4,
    transparent: true, opacity: 0.86,
  }),
  sheen: new THREE.MeshBasicMaterial({
    color: 0x9fd8e8, transparent: true, opacity: 0.08, depthWrite: false,
  }),
};

// --------------------------------------------------------------------------- helpers

// mulberry32 — tiny, fast, and reproducible; the whole village hangs off one seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform grid of rectangles. Used twice: once for "is this spot taken" during the
// build, once for the grass system's per-blade occupancy query — which is why the
// test path allocates nothing.
const CELL = 8;
class ZoneGrid {
  constructor() { this.cells = new Map(); }

  static key(i, j) { return (i + 512) * 1024 + (j + 512); }

  add(zone) {
    const i0 = Math.floor(zone.minX / CELL), i1 = Math.floor(zone.maxX / CELL);
    const j0 = Math.floor(zone.minZ / CELL), j1 = Math.floor(zone.maxZ / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = ZoneGrid.key(i, j);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(zone);
      }
    }
  }

  contains(x, z) {
    const list = this.cells.get(ZoneGrid.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    for (let n = 0; n < list.length; n++) {
      const r = list[n];
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      if (r.rx) {                                   // ellipse zones (the pond)
        const dx = (x - r.cx) / r.rx, dz = (z - r.cz) / r.rz;
        if (dx * dx + dz * dz > 1) continue;
      }
      return true;
    }
    return false;
  }

  overlaps(minX, maxX, minZ, maxZ) {
    const i0 = Math.floor(minX / CELL), i1 = Math.floor(maxX / CELL);
    const j0 = Math.floor(minZ / CELL), j1 = Math.floor(maxZ / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = this.cells.get(ZoneGrid.key(i, j));
        if (!list) continue;
        for (let n = 0; n < list.length; n++) {
          const r = list[n];
          if (minX < r.maxX && maxX > r.minX && minZ < r.maxZ && maxZ > r.minZ) return true;
        }
      }
    }
    return false;
  }
}

function rect(minX, maxX, minZ, maxZ) { return { minX, maxX, minZ, maxZ }; }

// Yaw that turns a model's front toward (tx, tz).
function faceToward(x, z, tx, tz) { return Math.atan2(tx - x, tz - z) + MODEL_FRONT; }

// ============================================================================ build

export function buildVillage(scene, library) {
  const rng = mulberry32(0xb1a2c3d4);
  const colliders = [];
  const meshes = [];
  const blockers = new ZoneGrid();   // build-time "don't put anything here"
  const occupied = new ZoneGrid();   // runtime "no grass here"
  const lib = library;

  const rand = (a, b) => a + rng() * (b - a);
  const pick = (arr) => arr[(rng() * arr.length) | 0];

  function block(minX, maxX, minZ, maxZ) { blockers.add(rect(minX, maxX, minZ, maxZ)); }
  function occupy(zone) { occupied.add(zone); blockers.add(zone); }

  // Places a model, records its collider and footprint. `pad` widens the reserved
  // footprint so neighbours keep their distance. Returns the object or null.
  function put(key, x, z, { yaw = 0, scale = 1, y = 0, pad = 0.6, reserve = true, noGrass = false } = {}) {
    if (!lib || !lib.has(key)) return null;
    const { object, collider } = lib.place(key, x, z, { yaw, scale, y });
    if (!object) return null;                       // model failed to load — just skip it
    scene.add(object);
    meshes.push(object);
    if (collider) colliders.push(collider);

    if (reserve) {
      const s = lib.size(key);
      const c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
      const hw = (s.x * c + s.z * sn) / 2 * scale + pad;
      const hd = (s.x * sn + s.z * c) / 2 * scale + pad;
      const r = rect(x - hw, x + hw, z - hd, z + hd);
      blockers.add(r);
      if (noGrass) occupied.add(r);
    }
    return object;
  }

  // Free-space test for scattered props.
  function free(x, z, half) {
    return !blockers.overlaps(x - half, x + half, z - half, z + half);
  }

  // Scatters `count` props from `keys` inside a rect (or a custom sampler), retrying
  // a bounded number of times per prop and giving up quietly rather than looping.
  function scatter(keys, count, sample, { half = 1.2, scaleMin = 0.9, scaleMax = 1.1, pad = 0.3 } = {}) {
    let placed = 0;
    for (let i = 0; i < count * 8 && placed < count; i++) {
      const p = sample();
      if (!p || !free(p.x, p.z, half)) continue;
      if (put(pick(keys), p.x, p.z, { yaw: rng() * Math.PI * 2, scale: rand(scaleMin, scaleMax), pad })) placed++;
    }
    return placed;
  }

  const inRect = (r, m = 0) => () => ({ x: rand(r.minX + m, r.maxX - m), z: rand(r.minZ + m, r.maxZ - m) });

  // A flat coloured slab just above the ground. The courtyard floor is at y = 0.01,
  // so ours live at 0.02+ to stay out of its z-fighting range.
  function slab(cx, cz, w, d, material, y = 0.02) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cz);
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  }

  // ------------------------------------------------------------------ reservations
  // The castle and its approach are off limits before anything else is placed.
  block(-CASTLE_KEEPOUT, CASTLE_KEEPOUT, -CASTLE_KEEPOUT, CASTLE_KEEPOUT);
  occupy(rect(-24, 24, -24, 24));                                   // courtyard
  block(-ROAD_HALF - 1.2, ROAD_HALF + 1.2, 20, ROAD_END);           // keep the road clear

  // ------------------------------------------------------------------------- roads
  slab(0, (22 + ROAD_END) / 2, ROAD_HALF * 2, ROAD_END - 22, MAT.dirt);
  occupied.add(rect(-ROAD_HALF, ROAD_HALF, 22, ROAD_END));

  slab(0, CROSS_Z, CROSS_X * 2, CROSS_HALF * 2, MAT.dirt);
  occupy(rect(-CROSS_X, CROSS_X, CROSS_Z - CROSS_HALF, CROSS_Z + CROSS_HALF));

  slab(-17, LANE_Z, 24, LANE_HALF * 2, MAT.dirt);                   // lane to the pond
  occupy(rect(-29, -5, LANE_Z - LANE_HALF, LANE_Z + LANE_HALF));

  slab((PLAZA.minX + PLAZA.maxX) / 2, (PLAZA.minZ + PLAZA.maxZ) / 2,
       PLAZA.maxX - PLAZA.minX, PLAZA.maxZ - PLAZA.minZ, MAT.plaza);
  occupied.add(PLAZA);

  // ------------------------------------------------------------------------ market
  // Spread around the plaza but never across the gate's sightline (|x| < 4.5).
  put('market_stalls', -11, 28.5, { yaw: faceToward(-11, 28.5, 0, 28.5) });
  put('market_stalls', 11.5, 38.5, { yaw: faceToward(11.5, 38.5, 0, 38.5) });
  put('market_stall', -12.5, 35, { yaw: faceToward(-12.5, 35, 0, 35) });
  put('market_stall', -12, 39.5, { yaw: faceToward(-12, 39.5, 0, 39.5) });
  put('market_stall', 12, 27, { yaw: faceToward(12, 27, 0, 27) });
  put('market_stall', 12.5, 32.5, { yaw: faceToward(12.5, 32.5, 0, 32.5) });
  put('tent', -15.5, 24.5, { yaw: 2.4 });
  put('tent', 15, 24.5, { yaw: -2.4 });

  put('well', 7.5, 44.5, { pad: 1 });
  put('town_sign', 5.5, 23.5, { yaw: faceToward(5.5, 23.5, 0, 34) });
  put('bonfire', -7.5, 45, { pad: 1.2 });
  put('cauldron', -9.4, 43.6);
  for (const [bx, bz] of [[-5.6, 46.6], [-9.6, 47], [-5.4, 43.2]]) {
    put('bench', bx, bz, { yaw: faceToward(bx, bz, -7.5, 45) });
  }
  put('cart', -15, 31.5, { yaw: 1.1 });
  put('cart', 14.5, 43.5, { yaw: -0.7 });
  put('chest', 13.8, 36, { yaw: 0.4 });

  // Torches and banners line the road out of the gate — they frame the opening view
  // instead of blocking it.
  for (const z of [23, 31, 39, 47]) {
    put('torch', -4.6, z, { pad: 0.2 });
    put('torch', 4.6, z, { pad: 0.2 });
  }
  put('banner', -5.2, 21.6, { pad: 0.2 });   // leaning on the gatehouse face, not in it
  put('banner', 5.2, 21.6, { pad: 0.2 });

  const marketClutter = ['barrel', 'crate', 'sacks', 'bucket'];
  scatter(marketClutter, 22, () => {
    const side = rng() < 0.5 ? -1 : 1;
    return { x: side * rand(5.5, 15.5), z: rand(23, 41) };
  }, { half: 0.7, pad: 0.15 });

  // ------------------------------------------------------------------ village street
  // Two rows facing each other across the road, plus a few off the cross street.
  const street = [
    ['blacksmith', -14.5, 52], ['house_a', -13, 62], ['house_c', -14.5, 72],
    ['storage_hut', -11.5, 81], ['house_d', -13.5, 89], ['hut', -11.5, 97],
    ['house_b', -13.5, 105], ['sawmill', -16, 116],
    ['inn', 15.5, 51], ['house_b', 13, 61], ['house_e', 12, 69],
    ['house_a', 13.5, 78], ['stable', 14.5, 88], ['house_d', 13, 97],
    ['hut', 11.5, 105], ['storage_hut', 12.5, 113],
  ];
  for (const [key, x, z] of street) {
    put(key, x, z, { yaw: faceToward(x, z, 0, z) + rand(-0.05, 0.05), pad: 1.4, noGrass: true });
  }

  // Buildings turned toward the cross street rather than the main road.
  const crossStreet = [
    ['house_e', -26, 55, 0], ['house_c', -29, 70, Math.PI],
    ['house_a', 27, 55, 0], ['hut', 30, 70, Math.PI],
  ];
  for (const [key, x, z, yaw] of crossStreet) {
    put(key, x, z, { yaw: yaw + rand(-0.06, 0.06), pad: 1.4, noGrass: true });
  }

  put('watchtower', -24, 122, { yaw: faceToward(-24, 122, 0, 118), pad: 1.5, noGrass: true });
  put('sign', 4.6, 60, { yaw: faceToward(4.6, 60, 0, 60) });

  // Yard clutter against the houses, and a woodpile by the sawmill.
  scatter(['barrel', 'crate', 'sacks', 'bucket', 'logs', 'wood_log', 'bench', 'ladder'], 38, () => {
    const side = rng() < 0.5 ? -1 : 1;
    return { x: side * rand(6.5, 20), z: rand(46, 118) };
  }, { half: 0.8, pad: 0.2 });
  scatter(['logs', 'wood_log', 'stump'], 12, inRect(rect(-24, -12, 108, 124)), { half: 0.9 });
  put('fence_b', -19, 108, { yaw: 0 });
  put('fence_b', -17, 108, { yaw: 0 });

  // ------------------------------------------------------------------------- fences
  // Fence panels are laid end to end. Which way the panel is long depends on the
  // GLB, so ask the library instead of guessing.
  const fenceSize = lib ? lib.size('fence') : new THREE.Vector3();
  const panel = Math.max(1.4, Math.max(fenceSize.x, fenceSize.z));
  const panelAlongX = fenceSize.x >= fenceSize.z;

  function fenceRun(x0, z0, x1, z1, gap = null) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.round(len / panel));
    const dir = Math.atan2(dx, dz);
    const yaw = dir + (panelAlongX ? Math.PI / 2 : 0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      if (gap && t > gap[0] && t < gap[1]) continue;   // gateway
      put('fence', x0 + dx * t, z0 + dz * t, { yaw, pad: 0.05 });
    }
  }

  function fenceRect(r, gapSide) {
    fenceRun(r.minX, r.minZ, r.maxX, r.minZ, gapSide === 'n' ? [0.4, 0.6] : null);
    fenceRun(r.maxX, r.minZ, r.maxX, r.maxZ, gapSide === 'e' ? [0.4, 0.6] : null);
    fenceRun(r.maxX, r.maxZ, r.minX, r.maxZ, gapSide === 's' ? [0.4, 0.6] : null);
    fenceRun(r.minX, r.maxZ, r.minX, r.minZ, gapSide === 'w' ? [0.4, 0.6] : null);
  }

  // --------------------------------------------------------------------------- farm
  // West of the street: a windmill on the rise, a barn, and one properly fenced field.
  put('windmill', -58, 58, { yaw: faceToward(-58, 58, 0, 58), pad: 2, noGrass: true });
  put('barn', -42, 100, { yaw: faceToward(-42, 100, -20, 100), pad: 2, noGrass: true });

  slab((FIELD.minX + FIELD.maxX) / 2, (FIELD.minZ + FIELD.maxZ) / 2,
       FIELD.maxX - FIELD.minX, FIELD.maxZ - FIELD.minZ, MAT.soil);
  occupy(FIELD);
  fenceRect(FIELD, 'e');

  // Crop rows, turned so the long axis of the crop clump runs north-south — that
  // reads as tilled furrows rather than a scatter.
  const cropSize = lib ? lib.size('crops') : new THREE.Vector3();
  const cropYaw = cropSize.x >= cropSize.z ? Math.PI / 2 : 0;
  for (let x = FIELD.minX + 2.6; x <= FIELD.maxX - 2.6; x += 3.0) {
    for (let z = FIELD.minZ + 2.4; z <= FIELD.maxZ - 2.4; z += 2.8) {
      put(rng() < 0.3 ? 'wheat' : 'crops', x, z, { yaw: cropYaw, scale: rand(0.9, 1.1), reserve: false });
    }
  }

  put('scythe', FIELD.maxX + 2, FIELD.minZ + 3, { yaw: 0.9 });
  put('hay', -46, 94, { pad: 0.4 });
  put('hay', -48.5, 95.5, { pad: 0.4 });
  put('hay', -47, 97.5, { scale: 0.9, pad: 0.4 });
  put('cart', -37, 94, { yaw: 2.2 });
  scatter(['pumpkin'], 14, inRect(rect(-34, -24, 92, 104)), { half: 0.5, scaleMin: 0.85, scaleMax: 1.25, pad: 0.2 });
  scatter(['sacks', 'bucket', 'barrel'], 8, inRect(rect(-46, -34, 96, 106)), { half: 0.7 });
  put('donkey', -36, 88, { yaw: 1.4 });

  // ------------------------------------------------------------------------ pasture
  fenceRect(PASTURE, 'w');
  const inPasture = inRect(PASTURE, 3);
  const herd = [
    ['horse', 1], ['horse', 1], ['horse_white', 1], ['cow', 3], ['bull', 1],
    ['sheep', 6], ['pig', 3], ['chicken', 5],
  ];
  for (const [key, n] of herd) {
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const p = inPasture();
        if (!free(p.x, p.z, 1.6)) continue;
        if (put(key, p.x, p.z, { yaw: rng() * Math.PI * 2, pad: 0.8 })) break;
      }
    }
  }
  put('trough', PASTURE.minX + 4, PASTURE.minZ + 4, { yaw: Math.PI / 2 });
  put('trough', PASTURE.maxX - 5, PASTURE.maxZ - 6, { yaw: Math.PI / 2 });
  put('hay', PASTURE.minX + 3, PASTURE.maxZ - 4);
  put('sign', PASTURE.minX - 1.5, (PASTURE.minZ + PASTURE.maxZ) / 2, { yaw: -Math.PI / 2 });
  scatter(['grass_tuft', 'bush_a'], 16, inPasture, { half: 1.2, scaleMin: 0.8, scaleMax: 1.4 });

  // --------------------------------------------------------------------------- pond
  // A fishing spot a short walk west of the market — the player starts with a rod.
  occupy({ ...rect(POND.x - POND.rx, POND.x + POND.rx, POND.z - POND.rz, POND.z + POND.rz),
           cx: POND.x, cz: POND.z, rx: POND.rx, rz: POND.rz });
  block(POND.x - POND.rx - 2, POND.x + POND.rx + 2, POND.z - POND.rz - 2, POND.z + POND.rz + 2);

  const shore = new THREE.Mesh(new THREE.CircleGeometry(1, 40), MAT.mud);
  shore.rotation.x = -Math.PI / 2;
  shore.scale.set(POND.rx + 2.2, POND.rz + 2.2, 1);
  shore.position.set(POND.x, 0.03, POND.z);
  shore.receiveShadow = true;
  scene.add(shore);
  meshes.push(shore);

  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), MAT.water);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(POND.rx, POND.rz, 1);
  water.position.set(POND.x, 0.06, POND.z);
  scene.add(water);
  meshes.push(water);

  // A second, slowly turning disc of pale highlight is enough to sell moving water
  // without a shader or a normal map.
  const sheen = new THREE.Mesh(new THREE.CircleGeometry(1, 24), MAT.sheen);
  sheen.rotation.x = -Math.PI / 2;
  sheen.scale.set(POND.rx * 0.82, POND.rz * 0.82, 1);
  sheen.position.set(POND.x, 0.075, POND.z);
  scene.add(sheen);
  meshes.push(sheen);

  // Dock: repeated planks marching west from the east shore, out over the water.
  const dockSize = lib ? lib.size('dock') : new THREE.Vector3();
  const dockLen = Math.max(1.5, Math.max(dockSize.x, dockSize.z));
  const dockYaw = dockSize.x >= dockSize.z ? 0 : Math.PI / 2;   // long axis along X
  // Sunk so the deck sits one step above the ground: the pieces are ~1 m tall
  // pier blocks, and only the top ~0.3 m should show above the water.
  const DOCK_Y = 0.31 - (lib ? lib.size('dock').y : 1);
  for (let i = 0; i < 5; i++) {
    put('dock', POND.x + POND.rx + 1 - i * dockLen, POND.z, { yaw: dockYaw, y: DOCK_Y, reserve: false });
  }
  // Dock-foot clutter sits north of the lane so it neither blocks the walk in nor
  // crowds the castle's south-west tower.
  put('barrel', -26.5, 31.5);
  put('crate', -24.5, 33);
  put('bench', -28, 33.5, { yaw: faceToward(-28, 33.5, POND.x, POND.z) });
  put('sign', -23.5, 34.5, { yaw: faceToward(-23.5, 34.5, POND.x, POND.z) });

  // Reeds and rocks around the shoreline, skipping the arc the dock and lane use.
  for (let i = 0; i < 44; i++) {
    const a = rng() * Math.PI * 2;
    if (Math.abs(Math.cos(a)) > 0.86 && Math.cos(a) > 0) continue;   // east: dock side
    const k = rand(0.94, 1.14);
    const x = POND.x + Math.cos(a) * POND.rx * k;
    const z = POND.z + Math.sin(a) * POND.rz * k;
    const key = rng() < 0.55 ? 'grass_tuft' : (rng() < 0.6 ? 'bush_a' : 'rock_small');
    put(key, x, z, { yaw: rng() * Math.PI * 2, scale: key === 'grass_tuft' ? rand(1.6, 2.8) : rand(0.8, 1.3), reserve: false });
  }
  scatter(['rock_medium', 'bush_b', 'bush_flowers', 'tree_a'], 10,
    inRect(rect(POND.x - 20, POND.x + 18, POND.z - 18, POND.z + 16)), { half: 2 });

  // -------------------------------------------------------------------------- woods
  // Thickening with distance so the world doesn't just stop at an empty plane.
  const broadleaf = ['tree_a', 'tree_b', 'tree_c', 'tree_autumn'];
  const conifer = ['pine_a', 'pine_b', 'pine_c'];
  let trees = 0;
  for (let i = 0; i < 900 && trees < 140; i++) {
    const a = rng() * Math.PI * 2;
    const r = 56 + Math.sqrt(rng()) * 84;
    if (rng() > (r - 46) / 92) continue;                 // denser the further out
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!free(x, z, 2.6)) continue;
    // Pines take the north and the far ring; broadleaf stays near the village.
    const keys = (z < -20 || r > 105) ? conifer : broadleaf;
    if (put(pick(keys), x, z, { yaw: rng() * Math.PI * 2, scale: rand(0.85, 1.2), pad: 1.2 })) trees++;
  }

  // A few clumps closer in, so the treeline doesn't start abruptly.
  scatter([...broadleaf, 'tree_a'], 20, () => {
    const a = rng() * Math.PI * 2, r = rand(34, 58);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }, { half: 2.6, scaleMin: 0.8, scaleMax: 1.1, pad: 1 });

  // Undergrowth and ground litter everywhere the buildings aren't.
  scatter(['rock_small', 'rock_medium', 'rock_large', 'stump', 'wood_log', 'bush_a', 'bush_b', 'bush_flowers'], 58,
    () => {
      const a = rng() * Math.PI * 2, r = rand(30, 130);
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    }, { half: 1.6, scaleMin: 0.8, scaleMax: 1.25, pad: 0.5 });

  // ------------------------------------------------------------------------- update
  // One flickering light at the bonfire, one drifting shimmer on the pond.
  const fire = new THREE.PointLight(0xffa347, 14, 22, 2);
  fire.position.set(-7.5, 1.6, 45);
  scene.add(fire);
  meshes.push(fire);

  let t = 0;
  function update(dt) {
    t += dt;
    sheen.rotation.z = t * 0.06;
    MAT.sheen.opacity = 0.06 + 0.045 * Math.sin(t * 0.8);
    MAT.water.roughness = 0.12 + 0.03 * Math.sin(t * 0.5 + 1.7);
    fire.intensity = 13 + 3 * Math.sin(t * 11.3) + 2 * Math.sin(t * 4.1);
  }

  function isOccupied(x, z) { return occupied.contains(x, z); }

  return { colliders, meshes, isOccupied, update };
}
