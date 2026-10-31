import * as THREE from 'three';

// The old sword, held in first person (docs/DESIGN.md: every prince starts with
// one). Built from a few boxes — a worn, nicked blade, an iron crossguard, a
// leather grip and a pommel — parented to the camera, drawn on top of the world
// like the fishing rod (depthTest off, high renderOrder).
//
// swing() plays one slash: a quick wind-up to the right shoulder, a fast cut
// across and down to the left, and a recovery. `hitMoment` is true for exactly
// one frame, mid-cut — that is when combat.js looks for what the blade struck.

const REST_POS = new THREE.Vector3(0.34, -0.36, -0.62);
const REST_ROT = new THREE.Euler(-0.85, 0.15, -0.4);   // tip leaning forward, away from the eye
const RENDER_ORDER = 2100;

// Keyframes of a swing: time (s), hand position offset, rotation.
const SWING = [
  { t: 0.00, p: [0, 0, 0], r: [0, 0, 0] },
  { t: 0.14, p: [0.12, 0.16, 0.06], r: [0.9, -0.3, -0.7] },      // wound up over the right shoulder
  { t: 0.26, p: [-0.28, -0.12, -0.16], r: [-0.9, 0.6, 1.4] },    // the cut, across and down
  { t: 0.50, p: [0, 0, 0], r: [0, 0, 0] },
];
const HIT_AT = 0.2;

export function createSword(camera) {
  const rig = new THREE.Group();
  const hand = new THREE.Group();
  rig.add(hand);
  camera.add(rig);

  const mat = (o) => new THREE.MeshStandardMaterial({ depthTest: false, depthWrite: false, ...o });
  const steel = mat({ color: 0x9a9da1, roughness: 0.42, metalness: 0.85 });
  const dark = mat({ color: 0x55585c, roughness: 0.6, metalness: 0.7 });
  const iron = mat({ color: 0x4a3b30, roughness: 0.55, metalness: 0.6 });
  const leather = mat({ color: 0x3b2a1e, roughness: 0.9, metalness: 0 });
  const add = (geo, m, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.renderOrder = RENDER_ORDER;
    hand.add(mesh);
    return mesh;
  };
  // Blade along +Y from the guard, tapering to a point; a darker fuller down it.
  add(new THREE.BoxGeometry(0.05, 0.62, 0.01), steel, 0, 0.36, 0);
  add(new THREE.ConeGeometry(0.035, 0.1, 4), steel, 0, 0.72, 0).scale.set(1, 1, 0.3);
  add(new THREE.BoxGeometry(0.012, 0.55, 0.012), dark, 0, 0.34, 0);
  add(new THREE.BoxGeometry(0.21, 0.03, 0.04), iron, 0, 0.04, 0);                     // crossguard
  add(new THREE.CylinderGeometry(0.017, 0.019, 0.15, 8), leather, 0, -0.04, 0);       // grip
  add(new THREE.SphereGeometry(0.026, 10, 8), iron, 0, -0.125, 0);                     // pommel
  // Nicks along the edge: small dark notches, it is an old blade.
  for (const y of [0.22, 0.41, 0.55]) add(new THREE.BoxGeometry(0.012, 0.018, 0.013), dark, 0.024, y, 0);

  hand.scale.setScalar(0.85);
  hand.position.copy(REST_POS);
  hand.rotation.copy(REST_ROT);

  let t = -1;          // time into the current swing, -1 when not swinging
  let hit = false;
  let bobT = 0;
  const _p = new THREE.Vector3(), _e = new THREE.Euler();

  function sample(time) {
    let i = 0;
    while (i < SWING.length - 2 && time > SWING[i + 1].t) i++;
    const a = SWING[i], b = SWING[i + 1];
    const k = Math.min(1, Math.max(0, (time - a.t) / (b.t - a.t)));
    const e = k * k * (3 - 2 * k);
    _p.set(a.p[0] + (b.p[0] - a.p[0]) * e, a.p[1] + (b.p[1] - a.p[1]) * e, a.p[2] + (b.p[2] - a.p[2]) * e);
    _e.set(a.r[0] + (b.r[0] - a.r[0]) * e, a.r[1] + (b.r[1] - a.r[1]) * e, a.r[2] + (b.r[2] - a.r[2]) * e);
  }

  return {
    object: rig,
    get swinging() { return t >= 0; },
    get hitMoment() { return hit; },
    set visible(v) { rig.visible = v; },
    get visible() { return rig.visible; },
    swing() {
      if (t >= 0) return false;
      t = 0;
      return true;
    },
    update(dt, { speed = 0 } = {}) {
      hit = false;
      if (t >= 0) {
        const before = t;
        t += dt;
        if (before < HIT_AT && t >= HIT_AT) hit = true;
        if (t >= SWING[SWING.length - 1].t) t = -1;
      }
      sample(Math.max(0, t));
      bobT += dt * (2 + speed * 1.4);
      const bob = Math.sin(bobT * 2) * 0.008 * Math.min(1, speed / 4);
      hand.position.set(REST_POS.x + _p.x, REST_POS.y + _p.y + bob, REST_POS.z + _p.z);
      hand.rotation.set(REST_ROT.x + _e.x, REST_ROT.y + _e.y, REST_ROT.z + _e.z);
    },
  };
}
