import * as THREE from 'three';
import { CityBuilder } from './builder.js';
import { mulberry32 } from './noise.js';
import { createChest } from './chest.js';
import { inventory, ITEMS } from './inventory.js';
import { hud } from './hud.js';
import { clock } from './clock.js';
import * as Furn from './furniture.js';

// The inside of a house (docs/DESIGN.md: almost every house can be entered),
// built in place — inside the house's own hollow ground floor — the first time
// its door is opened (doorways.js). No fade, no other realm: the door swings
// open and you walk in. It is generated from the house's own numbers — its
// width, depth, floors, where its door is, and its seed — so a house is always
// the same inside, and no two are quite alike.
//
// Everything is laid out in house-local coordinates (front +z, door in the front
// wall) under a group placed and turned like the house; colliders and the
// things to use are moved into the world once at the end. Houses are square to
// the world grid, so a turned box is still a box.
//
// Ground floor: a fireplace on the back wall, a table and chairs, a cupboard,
// barrels. Upper floors: beds, a chest, a small table. Stairs climb along the
// side walls, alternating left and right floor by floor. Everything you can use
// is "press E": sit, light the fire, search the cupboard, open the chest,
// sleep (until morning). The ground-floor walls are the house's own (houses.js).

const G = 3.2, F = 2.9;      // floor heights, as outside (houses.js)
const WALL = 0.2;
const SLAB = 0.25;
const RISE = 0.27, TREAD = 0.3;
const LIFT = 0.03;           // the floorboards sit just above the ground outside

export function createInterior(door, renderer, { onSleep, player }) {
  const rand = mulberry32(door.seed);
  const between = (a, b) => a + rand() * (b - a);
  const group = new THREE.Group();
  group.name = 'interior';
  group.position.set(door.cx, door.y + LIFT, door.cz);
  group.rotation.y = door.yaw;
  group.updateMatrixWorld(true);
  const M = group.matrixWorld.clone();
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M);
  const b = new CityBuilder(renderer);
  const things = [];          // interactables
  const updaters = [];

  const W = door.w - 2 * WALL, D = door.d - 2 * WALL;
  const floors = door.floors;
  const base = (k) => (k === 0 ? 0 : G + F * (k - 1));
  const height = (k) => (k === 0 ? G : F);
  const top = base(floors - 1) + height(floors - 1);
  const hx = W / 2, hz = D / 2;

  // ------------------------------------------------------------ shell
  b.box('timber', 0, -0.2, 0, W, 0.2, D);                                          // floorboards
  b.collider(-hx, hx, -hz, hz, 0);
  for (let k = 0; k < floors; k++) {
    const y = base(k), h = height(k);
    // The ground floor's walls are the house's own; upper floors get theirs here
    // (outside, they are one solid block).
    // A shade thinner than the gap, so their outsides never meet the house's
    // own outer faces (which would flicker).
    if (k > 0) {
      const t = WALL - 0.03, ww = W + 2 * t;
      b.box('plaster', 0, y, -hz - WALL / 2, ww, h, WALL, { collide: true });                // back
      b.box('plaster', -hx - t / 2, y, 0, t, h, D, { collide: true });                       // left
      b.box('plaster', hx + t / 2, y, 0, t, h, D, { collide: true });                        // right
      b.box('plaster', 0, y, hz + WALL / 2, ww, h, WALL, { collide: true });                 // front
      // They stand on this floor: the doorway below must stay walkable.
      for (const c of b.colliders.slice(-4)) c.bottom = y;
    }
    // Beams under each ceiling.
    for (let bx = -hx + 0.8; bx < hx; bx += 1.6) b.box('timber', bx, y + h - SLAB - 0.18, 0, 0.16, 0.18, D);
  }
  b.box('plaster', 0, top - 0.05, 0, W, 0.1, D);                                                // ceiling

  // Windows: panes on the side and back walls, lit by the sky outside.
  const sky = new THREE.MeshBasicMaterial({ color: 0xbfd6f0 });
  const panes = new THREE.Group();
  const pane = (x, y, z, yaw) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), sky);
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    panes.add(m);
    b.box('timber', x, y - 0.6, z, Math.abs(Math.sin(yaw)) > 0.5 ? 0.12 : 1.0, 0.1, Math.abs(Math.sin(yaw)) > 0.5 ? 1.0 : 0.12);
  };
  for (let k = 0; k < floors; k++) {
    const y = base(k) + 1.55;
    pane(0, y, -hz + 0.01, 0);
    if (D > 6) { pane(-hx + 0.01, y, 0, Math.PI / 2); pane(hx - 0.01, y, -D / 4, -Math.PI / 2); }
  }
  group.add(panes);

  // --------------------------------------------------------- floors and stairs
  // Stairs up from floor k-1 to floor k run front-to-back along the left wall
  // for odd k and the right wall for even k; floor k's slab leaves a hole above.
  const STAIR_W = 1.1;
  for (let k = 1; k < floors; k++) {
    const y0 = base(k - 1), y1 = base(k), n = Math.ceil((y1 - y0) / RISE);
    const rise = (y1 - y0) / n;
    const side = k % 2 ? -1 : 1;
    const sx = side * (hx - STAIR_W / 2);
    const z0 = hz - 1.2;                        // first step, near the front
    const z1 = z0 - n * TREAD;                  // the far end, at the top
    for (let i = 0; i < n; i++) {
      const z = z0 - (i + 0.5) * TREAD;
      const h = rise * (i + 1);
      b.box('timber', sx, y0, z, STAIR_W, h, TREAD, { collide: true });
    }
    // The slab of floor k, with the stairwell cut out of it.
    const yS = y1 - SLAB;
    const holeX0 = side < 0 ? -hx : hx - STAIR_W, holeX1 = holeX0 + STAIR_W;
    const slab = (x0, x1, za, zb) => {
      if (x1 - x0 < 0.05 || zb - za < 0.05) return;
      b.box('timber', (x0 + x1) / 2, yS, (za + zb) / 2, x1 - x0, SLAB, zb - za);
      b.collider(x0, x1, za, zb, y1, yS);
    };
    slab(side < 0 ? holeX1 : -hx, side < 0 ? hx : holeX0, -hz, hz);       // all but the stairwell column
    slab(holeX0, holeX1, -hz, z1);                                          // beyond the top step
    slab(holeX0, holeX1, z0 + 0.2, hz);                                     // in front of it
    // A rail along the open side of the stairwell, on the floor above.
    const railX = side < 0 ? holeX1 + 0.04 : holeX0 - 0.04;
    b.box('timber', railX, y1, (z0 + z1) / 2 + 0.1, 0.08, 0.95, z0 - z1 + 0.2);
    b.collider(railX - 0.06, railX + 0.06, z1, z0 + 0.2, y1 + 0.95, y1);
  }

  // A spot on floor k, clear of the stairs (which hug a side wall near the front).
  const stairSide = (k) => (k === 0 ? (floors > 1 ? -1 : 0) : 0);

  // ----------------------------------------------------------- ground floor
  // Fireplace on the back wall.
  const pantry = W > 7;
  const px = hx - 2.4;                         // the pantry's inner wall
  const pz = -hz + Math.min(3.2, D * 0.55);    // and its front wall
  const fx = Math.min(between(-hx / 3, hx / 3), pantry ? px - 1.25 : hx);
  b.box('housestone', fx, 0, -hz + 0.35, 1.9, 1.3, 0.7, { collide: true });
  b.box('housestone', fx, 1.3, -hz + 0.25, 1.3, G - 1.3, 0.5);                     // chimney breast
  b.box('rust', fx, 0.02, -hz + 0.5, 1.0, 0.9, 0.4);                                // the dark hearth
  const fire = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const r of [0, Math.PI / 2]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 8, 1, true), flameMat);
    f.rotation.y = r; f.position.y = 0.42;
    fire.add(f);
  }
  fire.position.set(fx, 0.05, -hz + 0.62);
  group.add(fire);
  // No lights of its own: a house lends doorways.js where its lights would be,
  // and the few real lights there are move to whichever house you are in.
  const firePos = toWorld(fx, 0.8, -hz + 1.2);
  let burning = rand() < 0.6;
  const hearth = {
    pos: new THREE.Vector3(fx, 0.8, -hz + 1.0), reach: 2.6,
    get label() { return burning ? 'put out the fire' : 'light the fire'; },
    use() { burning = !burning; },
  };
  things.push(hearth);
  let tf = 0;
  updaters.push((dt) => {
    tf += dt;
    fire.visible = burning;
    fire.scale.y = 1 + Math.sin(tf * 13) * 0.08;
  });

  const candles = [];         // where the candle flames are, in the world
  const addCandle = (pos) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 6), flameMat);
    flame.position.copy(pos).add({ x: 0, y: -0.02, z: 0 });
    group.add(flame);
    candles.push(pos.clone().applyMatrix4(M));
  };
  const sitAt = (x, y, z, yaw) => things.push({
    pos: new THREE.Vector3(x, y + 0.6, z), reach: 1.8, label: 'sit down',
    use() {
      const p = toWorld(x, y + 0.45, z);
      player.sit({ x: p.x, y: p.y, z: p.z, yaw: yaw + Math.PI + door.yaw });
    },
  });

  // Table, chairs and a rug in the middle.
  const tx = stairSide(0) < 0 ? 0.5 : 0, tz = between(-0.2, 0.5);
  Furn.rug(b, tx, 0, tz, 0, 2.6, 1.9);
  addCandle(Furn.table(b, tx, 0, tz, 0, 1.6, 0.85, rand));
  const chairs = [[-1.15, 0, -Math.PI / 2], [1.15, 0, Math.PI / 2], [0, -0.85, Math.PI], [0, 0.85, 0]];
  for (const [cx, cz, yaw] of chairs.slice(0, 2 + Math.floor(rand() * 3))) {
    Furn.chair(b, tx + cx, 0, tz + cz, yaw + Math.PI);      // backs away from the table
    sitAt(tx + cx, 0, tz + cz, yaw + Math.PI);
  }

  // A cupboard to search once — in the pantry if there is one.
  let searched = false;
  const cupboard = (x, z, yaw) => {
    b.box('timber', x, 0, z, 1.1, 1.9, 0.55, { yaw });
    b.box('timber', x, 1.9, z, 1.2, 0.06, 0.62, { yaw });
    b.turnedCollider(x, z, 1.1, 0.55, yaw, 1.9);
    things.push({
      pos: new THREE.Vector3(x + Math.sin(yaw) * 0.4, 1.1, z + Math.cos(yaw) * 0.4), reach: 2.2,
      get label() { return searched ? 'the cupboard is bare' : 'search the cupboard'; },
      get done() { return searched; },
      use() {
        searched = true;
        const pool = ['bread', 'bread', 'apple', 'cheese', 'scrap', 'wire', 'coin', 'cloth', 'oil'];
        if (rand() < 0.3) { hud.toast('Nothing but dust and an old spoon.'); return; }
        const k = pool[Math.floor(rand() * pool.length)];
        inventory.addItem(k);
        hud.toast(`Found: ${ITEMS[k].name}`);
      },
    });
  };

  let pantryDoor = null;
  if (pantry) {
    // The pantry: a little room in the back corner, behind a door that opens.
    const T = 0.14;
    b.box('plaster', px, 0, (-hz + pz) / 2, T, G, pz + hz, { collide: true });            // its side wall
    const gap0 = px + 0.35, gap1 = gap0 + 1.0;
    b.box('plaster', (px + gap0) / 2, 0, pz, gap0 - px, G, T, { collide: true });          // front wall, left of the door
    b.box('plaster', (gap1 + hx) / 2, 0, pz, hx - gap1, G, T, { collide: true });          // right of it
    b.box('plaster', (gap0 + gap1) / 2, 2.15, pz, 1.0, G - 2.15, T);                       // over it
    pantryDoor = Furn.hingedDoor(b, group, gap0, 0, pz, 0, 1.0, 2.15, -Math.PI / 2);
    things.push({
      pos: pantryDoor.pos, reach: 2.2,
      get label() { return pantryDoor.open ? 'close the door' : 'open the door'; },
      use() { pantryDoor.toggle(); },
    });
    updaters.push((dt) => pantryDoor.update(dt));
    Furn.shelves(b, (px + hx) / 2, 0, -hz + 0.2, 0, Math.min(2.0, hx - px - 0.3), rand);
    for (let i = 0; i < 3; i++) Furn.sack(b, px + 0.4 + i * 0.5, 0, pz - 0.5, rand);
    b.cylinder('timber', hx - 0.45, 0, pz - 0.55, 0.33, 0.85, { rTop: 0.29, collide: true });
    cupboard(hx - 0.32, (-hz + pz) / 2 + 0.3, -Math.PI / 2);
  } else {
    cupboard(hx - 0.32, between(-hz + 1.2, -0.5), -Math.PI / 2);
  }

  // Barrels by the front, tools on the wall at the back.
  // In the front corner away from the door — never in the doorway, nor at the
  // foot of the stairs (the left front corner, when there is an upstairs).
  const barrelSide = door.doorX > 0 ? -1 : 1;
  if (!(barrelSide < 0 && floors > 1)) {
    for (let i = 0; i < 2; i++) {
      const bx = barrelSide * (hx - 0.5 - i * 0.75);
      if (Math.abs(bx - door.doorX) > 1.2) b.cylinder('timber', bx, 0, hz - 0.6, 0.33, 0.85, { rTop: 0.29, collide: true });
    }
  }
  if (floors === 1 || stairSide(0) >= 0) Furn.hungTools(b, -hx + 0.05, 0, -0.5, Math.PI / 2);
  else Furn.hungTools(b, (fx - hx) / 2 - 0.3, 0, -hz + 0.04, 0);

  // ------------------------------------------------------------ upper floors
  for (let k = 1; k < floors; k++) {
    const y = base(k);
    const away = k % 2 ? 1 : -1;      // the side without this floor's stairwell
    // A bed (or two) against the back wall.
    const beds = W > 7 ? 2 : 1;
    for (let i = 0; i < beds; i++) {
      const bx = away * (hx - 0.75 - i * 1.5), bz = -hz + 1.08;
      Furn.bed(b, bx, y, bz, 0);
      things.push({ pos: new THREE.Vector3(bx, y + 0.7, bz), reach: 2.2, label: 'sleep until morning', use() { onSleep(rest); } });
    }
    Furn.rug(b, away * (hx - 1.6), y, -hz + 2.6, 0, 2.0, 1.2);
    // A chest at the foot of the first bed.
    const chx = away * (hx - 0.75), chz = -hz + 2.75;
    const chest = createChest(group, renderer, {
      x: chx, y, z: chz, yaw: 0, gold: 3 + Math.floor(rand() * 12),
      items: rand() < 0.4 ? { [['coin', 'gem', 'cell', 'dagger', 'crystal'][Math.floor(rand() * 5)]]: 1 } : {},
    });
    things.push(chest);
    updaters.push((dt) => chest.update(dt));
    b.colliders.push(chest.collider);
    // A little table and chair by the window, with a candle; shelves on the wall.
    const sx = -away * 0.4, sz = -hz + 0.55;
    b.box('timber', sx, y + 0.7, sz, 0.8, 0.05, 0.5);
    b.cylinder('timber', sx, y, sz, 0.04, 0.7, { sides: 8 });
    b.cylinder('timber', sx, y, sz, 0.22, 0.03, { sides: 12 });
    addCandle(Furn.candle(b, sx + 0.2, y + 0.725, sz));
    Furn.chair(b, sx, y, sz + 0.6, 0);
    sitAt(sx, y, sz + 0.6, 0);
    Furn.shelves(b, away * (hx - 0.17), y, 0.6, away > 0 ? -Math.PI / 2 : Math.PI / 2, 1.4, rand);
  }

  // ---------------------------------------------------------------- the door
  // The house's front door itself, in the doorway of the front wall; it swings
  // in. Used from outside or in through doorways.js.
  const front = Furn.hingedDoor(b, group, door.doorX - 0.58, 0, hz + 0.02, 0, 1.15, 2.25, Math.PI / 2);
  updaters.push((dt) => front.update(dt));
  // Where you wake after sleeping here (or after dying, having slept here):
  // just inside the door, facing in.
  const restAt = toWorld(door.doorX, 0, hz - 1.0);
  const rest = { x: restAt.x, z: restAt.z, yaw: door.yaw + Math.PI };

  b.finish(group);

  // Into the world: what you can use, and what you bump into.
  for (const t of things) t.pos.applyMatrix4(M);
  const colliders = b.colliders;
  const yOff = door.y + LIFT;
  const corner = new THREE.Vector3();
  for (const c of colliders) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [cx, cz] of [[c.minX, c.minZ], [c.maxX, c.minZ], [c.minX, c.maxZ], [c.maxX, c.maxZ]]) {
      corner.set(cx, 0, cz).applyMatrix4(M);
      x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x);
      z0 = Math.min(z0, corner.z); z1 = Math.max(z1, corner.z);
    }
    c.minX = x0; c.maxX = x1; c.minZ = z0; c.maxZ = z1;
    c.top += yOff;
    if (c.bottom !== undefined) c.bottom += yOff;
  }

  // --------------------------------------------------------------- light
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe8c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let k = 0; k < floors; k++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 3.4), beamMat);
    beam.position.set(0, base(k) + 0.9, -hz + 1.55);
    beam.rotation.x = -0.45;
    group.add(beam);
  }

  const inv = M.clone().invert();
  const local = new THREE.Vector3();

  return {
    group,
    door,
    front,                    // the front door: { open, toggle(), angle }
    things,                   // what you can use inside
    colliders,                // already in world space
    rest,
    // Where the lights belong, in the world (doorways.js lends the real ones).
    lights: { room: toWorld(0, G - 0.6, 0), fire: firePos, candles, get burning() { return burning; } },
    // Is this world point inside the house?
    contains(p) {
      local.copy(p).applyMatrix4(inv);
      return Math.abs(local.x) < hx + WALL && Math.abs(local.z) < hz + WALL && local.y > -1 && local.y < top + 1;
    },
    update(dt) {
      const { day } = clock.light();
      // Daylight through the windows, or the dark of night.
      sky.color.setRGB(0.05 + 0.7 * day, 0.06 + 0.78 * day, 0.1 + 0.85 * day);
      beamMat.opacity = 0.07 * day;
      for (const u of updaters) u(dt);
    },
  };
}
