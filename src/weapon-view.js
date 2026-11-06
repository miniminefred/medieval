import * as THREE from 'three';
import { WEAPONS } from './weapons.js';

// The weapon in your hand, in first person (docs/DESIGN.md). Each weapon in
// weapons.js is built from a few primitives by its `look` — blades of any
// length and curve, a club, a flanged mace, a war hammer, a battle axe, a flail
// on its chain, a shock baton, a buzz-saw, a plasma pistol — parented to the
// camera and drawn on top of the world like the fishing rod (depthTest off,
// high renderOrder). Built once per weapon and kept.
//
// swing() plays the weapon's own move: a slash across, an overhead chop, a
// straight thrust, or a pistol's recoil. `hitMoment` is true for exactly one
// frame at the strike — that is when combat.js looks for what was hit.

const REST_POS = new THREE.Vector3(0.34, -0.36, -0.62);
const REST_ROT = new THREE.Euler(-0.85, 0.15, -0.4);   // tip leaning forward, away from the eye
const RENDER_ORDER = 2100;

// Keyframes of each move: time (s at speed 1), hand offset, rotation offset.
const MOVES = {
  slash: { hit: 0.2, keys: [
    { t: 0.00, p: [0, 0, 0], r: [0, 0, 0] },
    { t: 0.14, p: [0.12, 0.16, 0.06], r: [0.9, -0.3, -0.7] },       // wound up over the right shoulder
    { t: 0.26, p: [-0.28, -0.12, -0.16], r: [-0.9, 0.6, 1.4] },     // the cut, across and down
    { t: 0.50, p: [0, 0, 0], r: [0, 0, 0] },
  ] },
  chop: { hit: 0.32, keys: [
    { t: 0.00, p: [0, 0, 0], r: [0, 0, 0] },
    { t: 0.22, p: [-0.06, 0.3, 0.12], r: [1.35, 0, 0.3] },          // raised high
    { t: 0.36, p: [-0.1, -0.22, -0.22], r: [-1.0, 0.05, 0.35] },    // brought down hard
    { t: 0.70, p: [0, 0, 0], r: [0, 0, 0] },
  ] },
  thrust: { hit: 0.18, keys: [
    { t: 0.00, p: [0, 0, 0], r: [0, 0, 0] },
    { t: 0.10, p: [0.02, -0.02, 0.12], r: [-0.55, 0, 0.35] },       // drawn back, point forward
    { t: 0.20, p: [-0.14, 0.08, -0.38], r: [-0.7, -0.12, 0.4] },    // straight out
    { t: 0.42, p: [0, 0, 0], r: [0, 0, 0] },
  ] },
  shoot: { hit: 0.02, keys: [
    { t: 0.00, p: [0, 0, 0], r: [0, 0, 0] },
    { t: 0.05, p: [0, 0.03, 0.09], r: [0.35, 0, 0] },              // the kick
    { t: 0.30, p: [0, 0, 0], r: [0, 0, 0] },
  ] },
};

function material(o) {
  return new THREE.MeshStandardMaterial({ depthTest: false, depthWrite: false, ...o });
}
const M = {
  steel: material({ color: 0x9a9da1, roughness: 0.42, metalness: 0.85 }),
  bright: material({ color: 0xc4c8cc, roughness: 0.3, metalness: 0.9 }),
  dark: material({ color: 0x55585c, roughness: 0.6, metalness: 0.7 }),
  iron: material({ color: 0x4a3b30, roughness: 0.55, metalness: 0.6 }),
  brass: material({ color: 0x9a7a3a, roughness: 0.4, metalness: 0.85 }),
  leather: material({ color: 0x3b2a1e, roughness: 0.9, metalness: 0 }),
  wood: material({ color: 0x6b4a2c, roughness: 0.85, metalness: 0 }),
  black: material({ color: 0x1c1f22, roughness: 0.45, metalness: 0.6 }),
  glow: material({ color: 0x9ff4ff, emissive: 0x3fd8ff, emissiveIntensity: 2.5, roughness: 0.3 }),
};

// Build a weapon's meshes under a fresh group; the grip is at the origin and the
// business end points up +Y, like the old sword.
function build(look) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.renderOrder = RENDER_ORDER;
    g.add(mesh);
    return mesh;
  };
  const grip = (len = 0.15, m = M.leather) => {
    add(new THREE.CylinderGeometry(0.017, 0.019, len, 8), m, 0, -len / 2 + 0.035, 0);
    add(new THREE.SphereGeometry(0.026, 10, 8), M.iron, 0, -len + 0.02, 0);          // pommel
  };
  const shaft = (len, r = 0.02, m = M.wood) => add(new THREE.CylinderGeometry(r, r * 1.1, len, 8), m, 0, len / 2 - 0.12, 0);

  switch (look.type) {
    case 'blade': {
      const { len, w, guard, curve = 0 } = look;
      if (curve) {
        // A curved blade: segments, each turned a little more and set a little further back.
        const n = 6, seg = len / n;
        for (let i = 0; i < n; i++) {
          const k = (i + 0.5) / n, off = curve * k * k * 0.5;
          add(new THREE.BoxGeometry(w * (1 - k * 0.35), seg * 1.04, 0.01), M.steel, off, 0.06 + seg * (i + 0.5), 0, 0, 0, -curve * k * 0.9);
        }
      } else {
        add(new THREE.BoxGeometry(w, len, 0.01), M.steel, 0, 0.05 + len / 2, 0);
        add(new THREE.ConeGeometry(w * 0.7, Math.max(0.06, w * 2), 4), M.steel, 0, 0.05 + len + Math.max(0.03, w), 0).scale.set(1, 1, 0.3);
        if (w > 0.03) add(new THREE.BoxGeometry(w * 0.24, len * 0.88, 0.012), M.dark, 0, 0.05 + len * 0.47, 0);   // fuller
      }
      add(new THREE.BoxGeometry(guard, 0.03, 0.04), look.cup ? M.brass : M.iron, 0, 0.04, 0);
      if (look.cup) add(new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.brass, 0, 0.02, 0, Math.PI, 0, 0);
      if (look.knuckle) add(new THREE.TorusGeometry(0.06, 0.006, 6, 12, Math.PI), M.brass, 0.02, -0.03, 0, 0, 0, -Math.PI / 2);
      if (look.nicks) for (const y of [0.22, 0.41, 0.55]) add(new THREE.BoxGeometry(0.012, 0.018, 0.013), M.dark, 0.024, y, 0);
      grip(look.grip ?? 0.15);
      break;
    }
    case 'club':
      add(new THREE.CylinderGeometry(0.055, 0.025, 0.62, 9), M.wood, 0, 0.22, 0);
      for (const y of [0.32, 0.44]) add(new THREE.BoxGeometry(0.02, 0.03, 0.02), M.iron, 0.05, y, 0);    // nails
      add(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 8), M.leather, 0, -0.04, 0);
      break;
    case 'mace':
      shaft(0.58, 0.016, M.dark);
      add(new THREE.SphereGeometry(0.06, 12, 10), M.steel, 0, 0.47, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.BoxGeometry(0.012, 0.13, 0.05), M.steel, Math.cos(a) * 0.055, 0.47, Math.sin(a) * 0.055, 0, -a, 0);
      }
      grip(0.13);
      break;
    case 'hammer':
      shaft(0.82, 0.018);
      add(new THREE.BoxGeometry(0.22, 0.09, 0.09), M.dark, 0.03, 0.66, 0);
      add(new THREE.ConeGeometry(0.03, 0.12, 4), M.dark, -0.13, 0.66, 0, 0, 0, Math.PI / 2);    // the spike behind
      add(new THREE.BoxGeometry(0.03, 0.1, 0.1), M.steel, 0.15, 0.66, 0);                       // the striking face
      grip(0.16);
      break;
    case 'axe': {
      shaft(0.9, 0.019);
      // A half-moon blade, its flat to the side (seen edge-on from behind).
      const blade = add(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 20, 1, false, 0, Math.PI), M.steel, 0.04, 0.66, 0, 0, 0, Math.PI / 2);
      blade.scale.set(1, 1, 1.2);
      add(new THREE.BoxGeometry(0.06, 0.07, 0.04), M.dark, 0.0, 0.66, 0);
      grip(0.16);
      break;
    }
    case 'flail': {
      add(new THREE.CylinderGeometry(0.02, 0.022, 0.4, 8), M.wood, 0, 0.1, 0);
      for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(0.018, 0.005, 5, 10), M.dark, 0.012 * i, 0.32 + i * 0.035, 0, 0, i % 2 ? Math.PI / 2 : 0, 0);
      add(new THREE.SphereGeometry(0.055, 12, 10), M.dark, 0.07, 0.52, 0);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        add(new THREE.ConeGeometry(0.012, 0.05, 5), M.steel, 0.07 + Math.cos(a) * 0.06, 0.52 + Math.sin(a) * 0.06, 0, 0, 0, a - Math.PI / 2);
      }
      add(new THREE.CylinderGeometry(0.024, 0.024, 0.12, 8), M.leather, 0, -0.05, 0);
      break;
    }
    case 'baton':
      add(new THREE.CylinderGeometry(0.022, 0.025, 0.52, 10), M.black, 0, 0.2, 0);
      for (const y of [0.3, 0.38]) add(new THREE.TorusGeometry(0.026, 0.004, 6, 14), M.glow, 0, y, 0, Math.PI / 2, 0, 0);
      add(new THREE.SphereGeometry(0.03, 10, 8), M.glow, 0, 0.47, 0);
      add(new THREE.CylinderGeometry(0.026, 0.026, 0.13, 8), M.leather, 0, -0.05, 0);
      break;
    case 'saw': {
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 8), M.black, 0, 0.0, 0);
      add(new THREE.BoxGeometry(0.07, 0.12, 0.06), M.dark, 0, 0.2, 0);                          // the motor
      // The disc stands on edge, in line with the swing.
      const disc = add(new THREE.CylinderGeometry(0.15, 0.15, 0.006, 28), M.bright, 0, 0.36, 0.0, 0, 0, Math.PI / 2);
      disc.userData.spin = true;
      add(new THREE.TorusGeometry(0.15, 0.006, 4, 28), M.glow, 0, 0.36, 0, 0, Math.PI / 2, 0);
      break;
    }
    case 'pistol':
      // Held as a pistol is: grip down, barrel pointing ahead (-z).
      add(new THREE.BoxGeometry(0.04, 0.13, 0.06), M.black, 0, -0.06, 0.03, -0.3, 0, 0);       // the grip
      add(new THREE.BoxGeometry(0.05, 0.07, 0.22), M.dark, 0, 0.03, -0.06);                    // the body
      add(new THREE.CylinderGeometry(0.018, 0.022, 0.14, 10), M.black, 0, 0.035, -0.23, Math.PI / 2, 0, 0);   // barrel
      for (const z of [-0.02, -0.07, -0.12]) add(new THREE.TorusGeometry(0.036, 0.006, 6, 14), M.glow, 0, 0.03, z);
      add(new THREE.SphereGeometry(0.016, 8, 6), M.glow, 0, 0.035, -0.31);
      break;
  }
  if (look.scale) g.scale.setScalar(look.scale);
  return g;
}

export function createWeaponView(camera) {
  const rig = new THREE.Group();
  const hand = new THREE.Group();
  rig.add(hand);
  camera.add(rig);
  hand.scale.setScalar(0.85);

  const built = {};
  let kind = 'sword', current = null, move = MOVES.slash, speed = 1;
  let restRot = REST_ROT;
  // The rapier is held pointing ahead, not leaning; the pistol is built pointing
  // ahead already, so it is simply held level.
  const POINT = new THREE.Euler(-1.35, 0.08, -0.12);
  const LEVEL = new THREE.Euler(0.02, 0.06, 0);

  function setKind(k) {
    const w = WEAPONS[k] ?? WEAPONS.sword;
    kind = k;
    if (current) current.visible = false;
    current = built[k] ??= build(w.look);
    if (!current.parent) hand.add(current);
    current.visible = true;
    move = MOVES[w.style];
    speed = w.speed;
    restRot = w.style === 'shoot' ? LEVEL : k === 'rapier' ? POINT : REST_ROT;
  }
  setKind('sword');

  let t = -1;          // time into the current move, -1 when still
  let hit = false;
  let bobT = 0;
  let pace = 1;        // this swing's speed (slower when out of stamina)
  const _p = new THREE.Vector3(), _e = new THREE.Euler();

  function sample(time) {
    const K = move.keys;
    let i = 0;
    while (i < K.length - 2 && time > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1];
    const k = Math.min(1, Math.max(0, (time - a.t) / (b.t - a.t)));
    const e = k * k * (3 - 2 * k);
    _p.set(a.p[0] + (b.p[0] - a.p[0]) * e, a.p[1] + (b.p[1] - a.p[1]) * e, a.p[2] + (b.p[2] - a.p[2]) * e);
    _e.set(a.r[0] + (b.r[0] - a.r[0]) * e, a.r[1] + (b.r[1] - a.r[1]) * e, a.r[2] + (b.r[2] - a.r[2]) * e);
  }

  return {
    object: rig,
    setKind,
    get kind() { return kind; },
    get swinging() { return t >= 0; },
    get hitMoment() { return hit; },
    set visible(v) { rig.visible = v; },
    get visible() { return rig.visible; },
    // Start the weapon's move; `slow` < 1 when you are short of stamina.
    swing(slow = 1) {
      if (t >= 0) return false;
      t = 0;
      pace = slow;
      return true;
    },
    update(dt, { speed: walk = 0 } = {}) {
      hit = false;
      if (t >= 0) {
        const before = t;
        t += dt * speed * pace;
        if (before < move.hit && t >= move.hit) hit = true;
        if (t >= move.keys[move.keys.length - 1].t) t = -1;
      }
      sample(Math.max(0, t));
      bobT += dt * (2 + walk * 1.4);
      const bob = Math.sin(bobT * 2) * 0.008 * Math.min(1, walk / 4);
      hand.position.set(REST_POS.x + _p.x, REST_POS.y + _p.y + bob, REST_POS.z + _p.z);
      hand.rotation.set(restRot.x + _e.x, restRot.y + _e.y, restRot.z + _e.z);
      for (const m of current.children) if (m.userData.spin) m.rotation.y += dt * 40;
    },
  };
}
