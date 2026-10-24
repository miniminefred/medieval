import { CityBuilder } from './builder.js';
import { mulberry32 } from './noise.js';

// The castle: a walled courtyard with round corner towers, a gatehouse in the
// south wall and a keep, standing in a meadow. Built in code from photo-scanned
// materials (builder.js) — weathered stone with moss creeping up its feet, roof
// tiles, timber and cobbles, all at their real-world size. It is old: a few
// battlements have crumbled away (docs/DESIGN.md).
//
// Returns collider AABBs (world space, resting on the ground) so the player can
// walk into them and jump onto the low ones, plus the meshes.

const GROUND_SIZE = 600;

const YARD = 20;        // courtyard half-extent — walls sit on ±YARD
const WALL_H = 7.5;
const WALL_T = 2;
const GATE_W = 6;       // gap in the south wall you walk in through
const YARD_FLOOR_Y = 0.02;   // props sit on the cobbled floor, not the grass

const TOWER_R = 3.4;
const TOWER_H = 12;

const rand = mulberry32(1199);
const crumbled = () => rand() < 0.12;   // a merlon that fell long ago

export function buildWorld(scene, library = null, renderer) {
  const colliders = [];
  const meshes = [];
  const b = new CityBuilder(renderer);

  // Drops a loaded prop model on the courtyard floor. No-ops when the library is
  // absent or the model failed to load, so the castle always stands regardless.
  function addProp(key, x, z, yaw = 0, scale = 1) {
    if (!library?.has(key)) return null;
    const { object, collider } = library.place(key, x, z, { yaw, scale, y: YARD_FLOOR_Y });
    if (!object) return null;
    scene.add(object);
    meshes.push(object);
    if (collider) colliders.push(collider);
    return object;
  }

  // ----------------------------------------------------------------- ground
  // Meadow all round (its top is y = 0, the player's floor), cobbles inside.
  b.box('meadow', 0, -0.3, 0, GROUND_SIZE, 0.3, GROUND_SIZE);
  b.box('cobble', 0, -0.28, 0, YARD * 2, 0.3, YARD * 2);

  // ------------------------------------------------------------ curtain wall
  // A run of wall centred on (x, z), `len` long along X (alongX) or along Z,
  // with its battlements on the outer side `out` (+1 / -1 across the wall).
  function wallRun(x, z, len, alongX, out) {
    const box = (key, across, y0, w, h, d, o) => alongX
      ? b.box(key, x, y0, z + across * out, w, h, d, o)
      : b.box(key, x + across * out, y0, z, d, h, w, o);
    box('castlestone', 0, -0.5, len, WALL_H + 0.5, WALL_T, { collide: true });
    box('mossystone', 0.3, -0.5, len, 1.8, WALL_T + 0.8);                 // battered foot
    box('castlestone', 0, WALL_H - 0.45, len, 0.45, WALL_T + 0.35);       // a projecting course
    box('castlestone', -WALL_T / 2 + 0.25, WALL_H, len, 0.9, 0.5);        // inner parapet
    for (let a = -len / 2 + 0.9; a < len / 2 - 0.6; a += 2.6) {           // merlons
      if (crumbled()) continue;
      if (alongX) b.box('castlestone', x + a + 0.65, WALL_H, z + (WALL_T / 2 - 0.3) * out, 1.3, 1.6, 0.6);
      else b.box('castlestone', x + (WALL_T / 2 - 0.3) * out, WALL_H, z + a + 0.65, 0.6, 1.6, 1.3);
    }
  }

  wallRun(0, -YARD, YARD * 2, true, -1);       // north
  wallRun(-YARD, 0, YARD * 2, false, -1);      // west
  wallRun(YARD, 0, YARD * 2, false, 1);        // east
  const seg = YARD - GATE_W / 2;               // south, either side of the gate
  wallRun(-(GATE_W / 2 + seg / 2), YARD, seg, true, 1);
  wallRun(GATE_W / 2 + seg / 2, YARD, seg, true, 1);

  // ------------------------------------------------------------- the towers
  function roundTower(x, z, r, h) {
    b.cylinder('castlestone', x, -0.5, z, r, h + 0.5, { sides: 28, collide: true });
    b.cylinder('mossystone', x, -0.5, z, r + 0.5, 2.2, { sides: 28, rTop: r + 0.1 });  // foot
    b.cylinder('castlestone', x, h - 0.7, z, r + 0.35, 0.7, { sides: 28 });           // corbels
    b.cylinder('rooftiles', x, h, z, r + 0.6, r * 1.9, { sides: 28, rTop: 0.05 });    // cone roof
    b.cylinder('rust', x, h + r * 1.9 - 0.1, z, 0.06, 1.4, { sides: 6 });             // finial
    // Arrow slits all round, two storeys of them.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      for (const sy of [3.5, 7.5]) {
        b.box('housestone', x + Math.sin(a) * (r - 0.05), sy, z + Math.cos(a) * (r - 0.05), 0.55, 1.7, 0.2, { yaw: a });
        b.box('glass', x + Math.sin(a) * (r + 0.07), sy + 0.15, z + Math.cos(a) * (r + 0.07), 0.18, 1.4, 0.06, { yaw: a });
      }
    }
  }
  for (const [tx, tz] of [[-YARD, -YARD], [YARD, -YARD], [-YARD, YARD], [YARD, YARD]]) {
    roundTower(tx, tz, TOWER_R, TOWER_H);
  }

  // ------------------------------------------------------------ the gatehouse
  // Two square towers either side of the opening, stone bridged over it, and
  // the gates swung open against the passage walls.
  for (const side of [-1, 1]) {
    const gx = side * (GATE_W / 2 + 2.4);
    b.box('castlestone', gx, -0.5, YARD, 4.8, 10.5, 5, { collide: true });
    b.box('mossystone', gx, -0.5, YARD, 5.4, 2, 5.6);
    b.box('castlestone', gx, 9.6, YARD, 5.2, 0.5, 5.4);
    for (const mx of [-1.7, 0, 1.7]) if (!crumbled()) b.box('castlestone', gx + mx, 10, YARD + 2.3, 1.1, 1.5, 0.6);
    b.box('housestone', gx, 5.5, YARD + 2.5, 0.6, 1.6, 0.2);            // a window over the road
    b.box('glass', gx, 5.65, YARD + 2.62, 0.25, 1.3, 0.06);
    b.box('timber', side * (GATE_W / 2 - 0.3), 0, YARD - 1.2, 0.2, 4.2, 2.8, { collide: true }); // open gate leaf
    for (const hy of [0.8, 3.2]) b.box('rust', side * (GATE_W / 2 - 0.42), hy, YARD - 1.2, 0.05, 0.16, 2.8);
  }
  b.box('castlestone', 0, 4.8, YARD, GATE_W + 0.2, 5.2, 5);              // over the opening
  b.box('cobble', 0, -0.27, YARD + 0.5, GATE_W + 0.4, 0.3, 6);           // the passage floor
  b.box('housestone', 0, 4.4, YARD + 2.45, GATE_W + 0.6, 0.5, 0.3);      // lintel
  for (const mx of [-2, 0, 2]) b.box('castlestone', mx, 10, YARD + 2.3, 1.1, 1.5, 0.6);

  // ------------------------------------------------------------------- keep
  const KX = 0, KZ = -6, KW = 13, KD = 11, KH = 13;
  const front = KZ + KD / 2;
  b.box('castlestone', KX, -0.5, KZ, KW, KH + 0.5, KD, { collide: true });
  b.box('mossystone', KX, -0.5, KZ, KW + 0.8, 1.9, KD + 0.8);           // plinth
  for (const sy of [5, 9.4]) b.box('housestone', KX, sy, KZ, KW + 0.3, 0.3, KD + 0.3); // string courses
  b.box('castlestone', KX, KH - 0.6, KZ, KW + 0.8, 0.7, KD + 0.8);      // corbelled parapet
  for (let a = -KW / 2 + 0.6; a <= KW / 2 - 0.5; a += 2.2) {
    if (!crumbled()) b.box('castlestone', KX + a, KH + 0.1, KZ - KD / 2 - 0.1, 1.2, 1.5, 0.6);
    if (!crumbled()) b.box('castlestone', KX + a, KH + 0.1, front + 0.1, 1.2, 1.5, 0.6);
  }
  for (let a = -KD / 2 + 0.6; a <= KD / 2 - 0.5; a += 2.2) {
    if (!crumbled()) b.box('castlestone', KX - KW / 2 - 0.1, KH + 0.1, KZ + a, 0.6, 1.5, 1.2);
    if (!crumbled()) b.box('castlestone', KX + KW / 2 + 0.1, KH + 0.1, KZ + a, 0.6, 1.5, 1.2);
  }
  b.roof('rooftiles', 'castlestone', KX, KH + 0.1, KZ, KW - 1.6, KD - 1.6, 4.6, { over: 0.1 });
  // Corner turrets, corbelled out from the top of the walls.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tx = KX + sx * KW / 2, tz = KZ + sz * KD / 2;
      b.cylinder('castlestone', tx, 8.5, tz, 1.1, 1.0, { sides: 16, rTop: 1.5 });
      b.cylinder('castlestone', tx, 9.5, tz, 1.5, KH - 9.5 + 2.2, { sides: 16 });
      b.cylinder('rooftiles', tx, KH + 2.2, tz, 1.85, 3.6, { sides: 16, rTop: 0.04 });
    }
  }
  // The door at the head of the steps, and tall windows on every face.
  b.box('housestone', KX, 1.9, front + 0.08, 3.2, 4.2, 0.3);             // door surround
  b.box('timber', KX, 2.0, front + 0.24, 2.2, 3.5, 0.12);
  for (const hy of [2.6, 4.4]) b.box('rust', KX, hy, front + 0.31, 2.25, 0.16, 0.05);  // iron straps
  for (const wy of [6.2, 10.3]) {
    for (let i = 0; i < 4; i++) {
      const lx = -4.5 + i * 3;
      if (wy < 7 && Math.abs(lx) < 2) continue;                          // not over the door
      for (const [fz, gz] of [[front + 0.06, front + 0.17], [KZ - KD / 2 - 0.06, KZ - KD / 2 - 0.17]]) {
        b.box('housestone', KX + lx, wy - 0.15, fz, 1.0, 2.1, 0.2);
        b.box('glass', KX + lx, wy, gz, 0.62, 1.7, 0.06);
      }
    }
    for (let i = 0; i < 3; i++) {
      const lz = -3 + i * 3;
      for (const sx of [-1, 1]) {
        b.box('housestone', KX + sx * (KW / 2 + 0.06), wy - 0.15, KZ + lz, 0.2, 2.1, 1.0);
        b.box('glass', KX + sx * (KW / 2 + 0.17), wy, KZ + lz, 0.06, 1.7, 0.62);
      }
    }
  }

  // Stone steps up to the keep door — something to walk and jump up.
  for (let i = 0; i < 4; i++) {
    b.box('housestone', 0, 0, 1.6 + i * 1.2, 6, 0.5 + (3 - i) * 0.5, 1.2, { collide: true });
  }

  // ------------------------------------------------------- courtyard clutter
  // Hand-placed so the yard reads as lived-in without blocking the walk from the
  // gateway to the keep steps (the corridor x ∈ [-4, 4] is deliberately clear).
  if (library) {
    // West wall: stores and firewood.
    addProp('barrel', -16.2, 12.4, 0.3);
    addProp('barrel', -15.1, 13.4, 1.1);
    addProp('barrel', -16.6, 10.8, 2.4);
    addProp('crate', -14.2, 12.0, 0.6);
    addProp('crate', -13.6, 13.1, 2.2);
    addProp('crate', -14.0, 12.6, 0.9);          // stacked-looking cluster
    addProp('sacks', -15.4, 8.9, 1.7);
    addProp('logs', -16.4, 6.4, 0.4);
    addProp('wood_log', -15.0, 4.8, 1.2);
    addProp('ladder', -17.6, 2.0, Math.PI / 2);
    addProp('cart', -13.4, -8.0, 1.9);

    // East wall: the working side — water, feed, a horse tied up.
    addProp('well', 15.0, 9.4);
    addProp('bucket', 13.6, 8.6, 0.8);
    addProp('trough', 15.6, -2.4, Math.PI / 2);
    addProp('horse_white', 13.4, -2.6, -Math.PI / 2);
    addProp('hay', 16.2, 4.2);
    addProp('hay', 15.0, 5.6);
    addProp('scythe', 17.0, 6.8, 0.5);
    addProp('crate', 14.8, 13.2, 0.2);
    addProp('barrel', 16.3, 12.2, 1.4);

    // Fire pit south of the keep steps, with somewhere to sit.
    addProp('bonfire', -8.0, 8.0);
    addProp('bench', -10.4, 8.2, Math.PI / 2);
    addProp('bench', -8.2, 10.6, 0);
    addProp('cauldron', -6.4, 7.0, 0.9);

    // Chickens loose in the yard — small, non-solid, pure atmosphere.
    // (Kept clear of the clan banners, which stand in a row across the yard at z = 15.)
    for (const [cx, cz, cy] of [[11.0, 2.0, 0.8], [12.2, 0.6, 2.1], [-11.5, -2.0, 3.4], [-10.4, -3.6, 5.0]]) {
      addProp('chicken', cx, cz, cy);
    }

    // Torches along the inner wall, and banners flanking the keep door.
    for (const tz of [-14, -4, 6, 16]) {
      addProp('torch', -18.2, tz);
      addProp('torch', 18.2, tz);
    }
    addProp('banner', -4.6, 0.6);
    addProp('banner', 4.6, 0.6);
    addProp('chest', 5.4, 3.2, -0.6);
  } else {
    // Fallback so the courtyard is never bare if the models fail to load.
    for (const [x, z, w, h, d] of [
      [-13, 12, 1.6, 1.6, 1.6], [-11.2, 13.4, 1.3, 1.3, 1.3], [-13.4, 10.2, 1.3, 2.6, 1.3],
      [12.5, 13, 1.8, 1.8, 1.8], [14.2, 11, 1.4, 1.4, 1.4], [12.8, 10.6, 1.4, 2.8, 1.4],
    ]) b.box('timber', x, 0, z, w, h, d, { collide: true });
  }

  b.finish(scene);
  return { colliders: colliders.concat(b.colliders), meshes };
}
