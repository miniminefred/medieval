import * as THREE from 'three';
import { CityBuilder } from './builder.js';
import { mulberry32 } from './noise.js';
import { createChest } from './chest.js';
import { inventory, ITEMS } from './inventory.js';
import { hud } from './hud.js';
import { clock } from './clock.js';

// The inside of a house, built when you walk in (docs/DESIGN.md: almost every
// house can be entered). It is generated from the house's own numbers — its
// width, depth, floors, where its door is, and its seed — so a house is always
// the same inside, and no two are quite alike. It stands at the origin of its
// own little realm; leaving puts you back on the street outside its door.
//
// Ground floor: a fireplace on the back wall, a table and chairs, a cupboard,
// barrels. Upper floors: beds, a chest, a small table. Stairs climb along the
// side walls, alternating left and right floor by floor. Everything you can use
// is "press E": sit, light the fire, search the cupboard, open the chest,
// sleep (until morning), and the door, to leave.

const G = 3.2, F = 2.9;      // floor heights, as outside (houses.js)
const WALL = 0.2;
const SLAB = 0.25;
const RISE = 0.27, TREAD = 0.3;

export function createInterior(door, renderer, { onLeave, onSleep, player }) {
  const rand = mulberry32(door.seed);
  const between = (a, b) => a + rand() * (b - a);
  const group = new THREE.Group();
  group.name = 'interior';
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
  b.box('timber', 0, -0.2, 0, W + 2 * WALL, 0.2, D + 2 * WALL);                   // floorboards
  const wallKey = (k) => (k === 0 ? 'housestone' : 'plaster');
  for (let k = 0; k < floors; k++) {
    const y = base(k), h = height(k);
    b.box(wallKey(k), 0, y, -hz - WALL / 2, W + 2 * WALL, h, WALL, { collide: true });         // back
    b.box(wallKey(k), -hx - WALL / 2, y, 0, WALL, h, D, { collide: true });                     // left
    b.box(wallKey(k), hx + WALL / 2, y, 0, WALL, h, D, { collide: true });                      // right
    if (k === 0) {
      // Front wall, round the door.
      const dx = door.doorX, half = 0.6;
      const lw = dx - half + hx, rw = hx - (dx + half);
      if (lw > 0.05) b.box('housestone', -hx + lw / 2, 0, hz + WALL / 2, lw, h, WALL, { collide: true });
      if (rw > 0.05) b.box('housestone', hx - rw / 2, 0, hz + WALL / 2, rw, h, WALL, { collide: true });
      b.box('housestone', dx, 2.25, hz + WALL / 2, 2 * half, h - 2.25, WALL);
      b.box('timber', dx, 0, hz + 0.02, 1.15, 2.25, 0.08);                                       // the door itself
      b.collider(dx - half, dx + half, hz - 0.05, hz + WALL, 2.3);
    } else {
      b.box('plaster', 0, y, hz + WALL / 2, W + 2 * WALL, h, WALL, { collide: true });
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
  const fx = between(-hx / 3, hx / 3);
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
  const fireLight = new THREE.PointLight(0xff9a4a, 0, 9, 1.6);
  fireLight.position.set(fx, 0.8, -hz + 1.2);
  group.add(fireLight);
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
    fireLight.intensity = burning ? 6 * (1 + Math.sin(tf * 11) * 0.1) : 0;
  });

  // Table and chairs in the middle.
  const tx = stairSide(0) < 0 ? 0.6 : 0, tz = between(-0.3, 0.6);
  b.box('timber', tx, 0.74, tz, 1.6, 0.06, 0.85);
  for (const [lx, lz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) b.box('timber', tx + lx, 0, tz + lz, 0.07, 0.74, 0.07);
  b.collider(tx - 0.8, tx + 0.8, tz - 0.43, tz + 0.43, 0.8);
  const chairs = [[-1.15, 0, Math.PI / 2], [1.15, 0, -Math.PI / 2], [0, -0.85, 0], [0, 0.85, Math.PI]];
  chairs.slice(0, 2 + Math.floor(rand() * 3)).forEach(([cx, cz, yaw]) => chair(tx + cx, 0, tz + cz, yaw));

  function chair(x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    b.box('timber', x, y + 0.42, z, 0.45, 0.05, 0.45, { yaw });
    for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
      b.box('timber', x + lx * c + lz * s, y, z - lx * s + lz * c, 0.05, 0.42, 0.05);
    }
    b.box('timber', x - 0.21 * s, y + 0.45, z - 0.21 * c, 0.45, 0.5, 0.05, { yaw });   // the back
    things.push({
      pos: new THREE.Vector3(x, y + 0.6, z), reach: 1.8, label: 'sit down',
      use() { player.sit({ x, y: y + 0.45, z, yaw: yaw + Math.PI }); },
    });
  }

  // A cupboard against the right wall, to search once.
  const cz = between(-hz + 1.2, -0.5);
  b.box('timber', hx - 0.3, 0, cz, 0.55, 1.9, 1.1, { collide: true });
  b.box('rust', hx - 0.57, 0.95, cz, 0.03, 0.08, 0.3);
  let searched = false;
  things.push({
    pos: new THREE.Vector3(hx - 0.6, 1.1, cz), reach: 2.2,
    get label() { return searched ? 'the cupboard is bare' : 'search the cupboard'; },
    get done() { return searched; },
    use() {
      searched = true;
      const pool = ['bread', 'bread', 'scrap', 'wire', 'coin'];
      if (rand() < 0.35) { hud.toast('Nothing but dust and an old spoon.'); return; }
      const k = pool[Math.floor(rand() * pool.length)];
      inventory.addItem(k);
      hud.toast(`Found: ${ITEMS[k].name}`);
    },
  });

  // Barrels in a corner.
  for (let i = 0; i < 2; i++) b.cylinder('timber', -hx + 0.5 + i * 0.75, 0, -hz + 0.5, 0.33, 0.85, { rTop: 0.29, collide: true });

  // ------------------------------------------------------------ upper floors
  for (let k = 1; k < floors; k++) {
    const y = base(k);
    const away = k % 2 ? 1 : -1;      // the side without this floor's stairwell
    // A bed (or two) against the back wall.
    const beds = W > 7 ? 2 : 1;
    for (let i = 0; i < beds; i++) bed(away * (hx - 0.8 - i * 1.6), y, -hz + 1.15);
    // A chest at the foot of the first bed.
    const chx = away * (hx - 0.8), chz = -hz + 2.65;
    const chest = createChest(group, renderer, {
      x: chx, y, z: chz, yaw: 0, gold: 3 + Math.floor(rand() * 12),
      items: rand() < 0.4 ? { [['coin', 'gem', 'cell', 'dagger'][Math.floor(rand() * 4)]]: 1 } : {},
    });
    things.push(chest);
    updaters.push((dt) => chest.update(dt));
    b.colliders.push(chest.collider);
    // A small table with a candle by the window.
    const sx = 0, sz = -hz + 0.6;
    b.box('timber', sx, y + 0.7, sz, 0.7, 0.05, 0.5);
    b.box('timber', sx, y, sz, 0.08, 0.7, 0.08);
    const candle = new THREE.PointLight(0xffb25a, 1.6, 6, 1.8);
    candle.position.set(sx, y + 1.0, sz);
    group.add(candle);
    b.box('plaster', sx, y + 0.75, sz, 0.06, 0.16, 0.06);
  }

  function bed(x, y, z) {
    b.box('timber', x, y, z, 1.0, 0.42, 2.0, { collide: true });
    b.box('linen', x, y + 0.42, z + 0.05, 0.92, 0.18, 1.85);
    b.box('linen', x, y + 0.6, z - 0.75, 0.6, 0.12, 0.35);                       // pillow
    b.box('timber', x, y, z - 1.0, 1.0, 0.95, 0.08);                              // headboard
    things.push({
      pos: new THREE.Vector3(x, y + 0.7, z), reach: 2.2,
      label: 'sleep until morning',
      use() { onSleep(); },
    });
  }

  // ---------------------------------------------------------------- the door
  things.push({
    pos: new THREE.Vector3(door.doorX, 1.2, hz), reach: 2.2, label: 'leave',
    use() { onLeave(); },
  });

  b.finish(group);

  // --------------------------------------------------------------- light
  const hemi = new THREE.HemisphereLight(0xfff0dc, 0x3a2c20, 0.4);
  group.add(hemi);
  const room = new THREE.PointLight(0xffd8a8, 0, 14, 1.4);
  room.position.set(0, G - 0.6, 0);
  group.add(room);

  return {
    name: 'interior',
    group,
    door,
    portals: [],
    interactables: things,
    spawn: { x: door.doorX, z: hz - 1.0, yaw: 0 },
    arrival: { x: door.doorX, z: hz - 1.0, yaw: 0 },     // facing in, away from the door

    enter({ scene, renderer: r, camera, player: pl }) {
      scene.add(group);
      scene.background = new THREE.Color(0x070605);
      scene.fog = null;
      scene.environment = null;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.1;
      camera.far = 300;
      camera.updateProjectionMatrix();
      pl.setWorld({ colliders: b.colliders });
    },

    exit({ scene }) {
      scene.remove(group);
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    },

    update(dt) {
      const { day } = clock.light();
      // Daylight through the windows, or the dark of night.
      sky.color.setRGB(0.05 + 0.7 * day, 0.06 + 0.78 * day, 0.1 + 0.85 * day);
      hemi.intensity = 0.12 + 0.5 * day;
      room.intensity = 1.5 + 4 * day;
      for (const u of updaters) u(dt);
    },
  };
}
