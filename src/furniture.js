import * as THREE from 'three';

// Furniture and clutter for house interiors (interiors.js), built through the
// building kit (builder.js) so it merges into a few draw calls. Shapes aim to
// read as real at arm's length: turned legs, bevelled tops, a bed with a frame,
// mattress, blanket and pillow; jugs, plates, bowls, books, candles, sacks.
//
// Every function takes the kit `b`, a position on the floor (x, y, z) and a yaw
// (the piece's front faces local +z), and returns nothing — except `hingedDoor`,
// which returns a door you can open and close.

const at = (x, z, yaw, lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];

// A table: a thick top with a lip, four turned legs, stretchers between them.
export function table(b, x, y, z, yaw, w = 1.6, d = 0.85, rand = Math.random) {
  b.box('timber', x, y + 0.72, z, w, 0.06, d, { yaw });
  b.box('timber', x, y + 0.66, z, w - 0.12, 0.06, d - 0.12, { yaw });        // the apron under the top
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [lx, lz] = at(x, z, yaw, sx * (w / 2 - 0.1), sz * (d / 2 - 0.1));
    b.cylinder('timber', lx, y, lz, 0.035, 0.66, { rBottom: 0.028, sides: 8 });
    b.cylinder('timber', lx, y + 0.3, lz, 0.045, 0.06, { sides: 8 });          // a turned bead
  }
  const [s1x, s1z] = at(x, z, yaw, 0, -(d / 2 - 0.1)), [s2x, s2z] = at(x, z, yaw, 0, d / 2 - 0.1);
  b.box('timber', s1x, y + 0.15, s1z, w - 0.2, 0.04, 0.04, { yaw });
  b.box('timber', s2x, y + 0.15, s2z, w - 0.2, 0.04, 0.04, { yaw });
  b.turnedCollider(x, z, w, d, yaw, y + 0.78);
  // What is on it: plates, a jug, a bowl, a loaf, a candle.
  const top = y + 0.75;
  for (let i = 0; i < 2 + Math.floor(rand() * 2); i++) {
    const [px, pz] = at(x, z, yaw, (i - 1) * 0.45, (i % 2 ? 0.2 : -0.2));
    b.cylinder('pewter', px, top, pz, 0.12, 0.015, { rBottom: 0.09, sides: 16 });
  }
  const [jx, jz] = at(x, z, yaw, w / 2 - 0.3, 0);
  jug(b, jx, top, jz);
  const [bx, bz] = at(x, z, yaw, -w / 2 + 0.35, 0.05);
  b.cylinder('pottery', bx, top, bz, 0.11, 0.07, { rBottom: 0.06, sides: 14 });
  if (rand() < 0.6) {
    const [lx, lz] = at(x, z, yaw, 0.1, -0.05);
    b.cylinder('bread', lx, top + 0.05, lz, 0.07, 0.24, { roll: Math.PI / 2, yaw: yaw + 0.4, sides: 10 });
  }
  const [cx, cz] = at(x, z, yaw, -0.15, 0.25);
  return candle(b, cx, top, cz);
}

// A jug: a belly, a neck, a lip.
export function jug(b, x, y, z, key = 'pottery') {
  b.cylinder(key, x, y, z, 0.08, 0.14, { rBottom: 0.06, sides: 14 });
  b.cylinder(key, x, y + 0.14, z, 0.05, 0.08, { rBottom: 0.08, sides: 14 });
  b.cylinder(key, x, y + 0.22, z, 0.055, 0.02, { sides: 14 });
}

// A candle in a pewter dish; returns where its flame is (for a light).
export function candle(b, x, y, z) {
  b.cylinder('pewter', x, y, z, 0.06, 0.01, { sides: 12 });
  b.cylinder('wax', x, y + 0.01, z, 0.018, 0.14, { sides: 8 });
  return new THREE.Vector3(x, y + 0.19, z);
}

// A chair with a slatted back.
export function chair(b, x, y, z, yaw) {
  b.box('timber', x, y + 0.42, z, 0.46, 0.05, 0.44, { yaw });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [lx, lz] = at(x, z, yaw, sx * 0.19, sz * 0.18);
    b.cylinder('timber', lx, y, lz, 0.022, sz < 0 ? 0.95 : 0.42, { sides: 6 });  // back legs run up into the back
  }
  for (const hy of [0.62, 0.78, 0.92]) {
    const [rx, rz] = at(x, z, yaw, 0, -0.18);
    b.box('timber', rx, y + hy, rz, 0.4, 0.05, 0.03, { yaw });
  }
}

// A bed: frame and posts, mattress, a turned-back blanket, pillow, a chest at its foot.
export function bed(b, x, y, z, yaw, w = 1.0, len = 2.0) {
  const [hx, hz] = at(x, z, yaw, 0, -len / 2), [fx, fz] = at(x, z, yaw, 0, len / 2);
  b.box('timber', x, y + 0.18, z, w, 0.14, len, { yaw });                      // the frame
  b.box('timber', hx, y, hz, w + 0.08, 1.0, 0.07, { yaw });                    // headboard
  b.box('timber', fx, y, fz, w + 0.08, 0.55, 0.07, { yaw });                   // footboard
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [px, pz] = at(x, z, yaw, sx * (w / 2 + 0.02), sz * (len / 2));
    b.cylinder('timber', px, y, pz, 0.04, sz < 0 ? 1.1 : 0.65, { sides: 8 });
  }
  b.box('sheet', x, y + 0.32, z, w - 0.06, 0.16, len - 0.1, { yaw });         // mattress
  const [kx, kz] = at(x, z, yaw, 0, 0.22);
  b.box('blanket', kx, y + 0.45, kz, w + 0.02, 0.05, len * 0.62, { yaw });     // blanket, turned back
  const [tx, tz] = at(x, z, yaw, 0, -0.12);
  b.box('blanket', tx, y + 0.47, tz, w + 0.02, 0.07, 0.14, { yaw });           // its fold
  const [px, pz] = at(x, z, yaw, 0, -len / 2 + 0.3);
  b.box('sheet', px, y + 0.48, pz, w * 0.7, 0.12, 0.32, { yaw });              // pillow
  b.turnedCollider(x, z, w + 0.1, len, yaw, y + 0.5);
}

// A rug on the floor.
export function rug(b, x, y, z, yaw, w = 2.2, d = 1.4) {
  b.box('rug', x, y, z, w, 0.012, d, { yaw });
  b.box('blanket', x, y, z, w - 0.25, 0.014, d - 0.25, { yaw });               // the border inside it
}

// Shelves against a wall, with jugs, bowls and books on them.
export function shelves(b, x, y, z, yaw, w = 1.4, rand = Math.random) {
  for (const sh of [0.9, 1.35, 1.8]) {
    b.box('timber', x, y + sh, z, w, 0.04, 0.3, { yaw });
    let lx = -w / 2 + 0.12;
    while (lx < w / 2 - 0.12) {
      const [px, pz] = at(x, z, yaw, lx, 0);
      const r = rand();
      if (r < 0.35) { jug(b, px, y + sh + 0.02, pz, rand() < 0.5 ? 'pottery' : 'pewter'); lx += 0.22; }
      else if (r < 0.7) {
        const n = 3 + Math.floor(rand() * 4);
        for (let i = 0; i < n; i++) {
          const [bx, bz] = at(x, z, yaw, lx + i * 0.045, 0);
          const key = ['bookred', 'bookgreen', 'bookblue'][Math.floor(rand() * 3)];
          b.box(key, bx, y + sh + 0.02, bz, 0.04, 0.2 + rand() * 0.06, 0.16, { yaw });
        }
        lx += n * 0.045 + 0.08;
      } else { b.cylinder('pottery', px, y + sh + 0.02, pz, 0.09, 0.06, { rBottom: 0.05, sides: 12 }); lx += 0.22; }
    }
  }
  for (const sx of [-1, 1]) {
    const [px, pz] = at(x, z, yaw, sx * (w / 2), 0);
    b.box('timber', px, y + 0.85, pz, 0.04, 1.0, 0.3, { yaw });
  }
}

// A sack of grain or flour, slumped.
export function sack(b, x, y, z, rand = Math.random) {
  const h = 0.5 + rand() * 0.2;
  b.cylinder('hessian', x, y, z, 0.18, h, { rBottom: 0.24, sides: 12 });
  b.cylinder('hessian', x, y + h, z, 0.06, 0.08, { rBottom: 0.16, sides: 10 });
}

// Tools hung on a wall: a saw, a scythe-ish blade, a coil of rope.
export function hungTools(b, x, y, z, yaw) {
  const [rx, rz] = at(x, z, yaw, 0, 0);
  b.box('timber', rx, y + 1.6, rz, 1.2, 0.08, 0.05, { yaw });                  // the rail
  const [a, c] = at(x, z, yaw, -0.35, 0.04);
  b.box('timber', a, y + 0.95, c, 0.05, 0.65, 0.03, { yaw });
  b.box('pewter', a, y + 0.85, c, 0.18, 0.25, 0.01, { yaw });                  // a saw blade
  const [d, e] = at(x, z, yaw, 0.1, 0.04);
  b.box('timber', d, y + 0.8, e, 0.04, 0.8, 0.03, { yaw, roll: 0.15 });       // a rake handle
  const [f, g] = at(x, z, yaw, 0.42, 0.06);
  b.cylinder('hessian', f, y + 1.35, g, 0.13, 0.06, { pitch: Math.PI / 2, yaw, sides: 14 }); // rope coil
}

// A door on a hinge. Returns { leaf, toggle(), open } and keeps its collider
// (pushed onto b.colliders) in step: shut, it blocks the doorway; open, it is
// swung out of the way. `hingeX/Z` is the hinge, the door spans `w` along +x
// (turned by yaw) when shut, and swings by `swing` radians.
export function hingedDoor(b, parent, hingeX, y, hingeZ, yaw, w = 1.0, h = 2.1, swing = -Math.PI / 2) {
  const mat = b.material('timber');
  const pivot = new THREE.Group();
  pivot.position.set(hingeX, y, hingeZ);
  pivot.rotation.y = yaw;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), mat);
  leaf.position.set(w / 2, h / 2, 0);
  leaf.castShadow = leaf.receiveShadow = true;
  pivot.add(leaf);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), b.material('pewter'));
  knob.position.set(w - 0.12, 1.0, 0.05);
  pivot.add(knob);
  parent.add(pivot);

  const [cx, cz] = [hingeX + (w / 2) * Math.cos(yaw), hingeZ - (w / 2) * Math.sin(yaw)];
  const shut = { minX: cx - Math.max(0.06, Math.abs(Math.cos(yaw)) * w / 2), maxX: cx + Math.max(0.06, Math.abs(Math.cos(yaw)) * w / 2),
    minZ: cz - Math.max(0.06, Math.abs(Math.sin(yaw)) * w / 2), maxZ: cz + Math.max(0.06, Math.abs(Math.sin(yaw)) * w / 2), top: y + h };
  const collider = { ...shut };
  b.colliders.push(collider);

  let open = false, angle = 0;
  return {
    pos: new THREE.Vector3(cx, y + 1.1, cz),
    get open() { return open; },
    toggle() {
      open = !open;
      // Open: no wall (the leaf stands against the jamb, out of the way).
      collider.top = open ? -10 : shut.top;
    },
    update(dt) {
      const goal = open ? swing : 0;
      angle += (goal - angle) * Math.min(1, dt * 6);
      pivot.rotation.y = yaw + angle;
    },
  };
}
