import * as THREE from 'three';

// The fishing rod the player carries, parented to the camera so it rides along
// with the view. Everything here lives in camera space: a sway rig hangs off the
// camera, a "hand" group inside it holds the rod by its grip at bottom-right,
// and the cast line + bobber are siblings in the same space (no world physics —
// the line is a parabola between two points we already know).
//
// Held geometry sits ~0.5 m from the eye, i.e. inside every wall in the world, so
// the whole viewmodel draws with depth testing off on CLONED materials (the world
// shares the prototype's materials — mutating them would flatten props too) and a
// high renderOrder, which keeps it on top instead of poking through masonry.

const ROD_KEYS = ['fishing_rod', 'fishing_rod_b', 'fishing_rod_c'];

// --- resting pose (camera space, metres; the camera looks down -Z) -----------
const VIEW_SCALE = 0.17;                                // 2 m rod -> 0.34 m of prop
const GRIP = 0.30;                                      // metres up the unscaled rod where the hand closes
const HAND_POS = new THREE.Vector3(0.30, -0.30, -0.46); // grip: low and well out to the right
const HAND_ROT = new THREE.Euler(-0.30, 0.34, 0.62);    // tip forward, up, and across to screen centre
const RENDER_ORDER = 2000;

// --- motion -----------------------------------------------------------------
const RUN_SPEED = 7.0;      // player.js sprint speed — bob is full strength here
const BOB_AMP = 0.026;
const SWAY_GAIN = 0.016;    // metres of lag per rad/s of turn
const SWAY_MAX = 0.075;
const SWAY_EASE = 9;        // how fast the rig chases its offset target
const LAND_IMPULSE = 1.1;   // dip spring kick on touchdown
const DIP_STIFF = 190;
const DIP_DAMP = 15;

// --- cast timeline ----------------------------------------------------------
// Per phase: rod pitch delta (+ = tip back over the shoulder), hand push along
// the view axis (+ = drawn back toward the eye), line slack, and the easing rate
// used to chase them — the whip is deliberately an order faster than the rewind.
const CAST_POSE = {
  idle:   { pitch: 0.00,  push: 0.00,  slack: 0.02, ease: 8 },
  rewind: { pitch: 0.50,  push: 0.08,  slack: 0.02, ease: 11 },
  whip:   { pitch: -0.60, push: -0.12, slack: 0.04, ease: 30 },
  fly:    { pitch: -0.15, push: -0.02, slack: 0.04, ease: 9 },
  hang:   { pitch: -0.05, push: 0.00,  slack: 0.18, ease: 4 },
  reel:   { pitch: 0.12,  push: 0.02,  slack: 0.03, ease: 6 },
};
const CAST_TIME = { rewind: 0.30, whip: 0.16, fly: 0.55, hang: 3.2, reel: 1.0 };
const CAST_NEXT = { rewind: 'whip', whip: 'fly', fly: 'hang', hang: 'reel', reel: 'idle' };

const BOBBER_REST = new THREE.Vector3(0.06, -0.80, -3.0);
const BOBBER_R = 0.035;
const ARC_HEIGHT = 0.30;
const LINE_SEGMENTS = 16;

// Scratch — update() must not allocate.
const _v = new THREE.Vector3();
const _tip = new THREE.Vector3();
const _down = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class Viewmodel {
  constructor(camera, library) {
    this.camera = camera;

    this.rig = new THREE.Group();          // sway / bob / dip offsets only
    camera.add(this.rig);

    this.hand = new THREE.Group();         // resting pose + cast animation
    this.hand.position.copy(HAND_POS);
    this.hand.rotation.copy(HAND_ROT);
    this.hand.scale.setScalar(VIEW_SCALE);
    this.rig.add(this.hand);

    const key = ROD_KEYS.find((k) => library?.has(k));
    this.rod = key ? library.create(key) : null;
    if (this.rod) {
      this.rod.position.y = -GRIP;         // seat the grip on the hand's origin
      this.hand.add(this.rod);
      asViewmodel(this.rod);
    } else {
      console.warn('[viewmodel] no fishing rod model loaded — hands stay empty');
    }

    // Anchor at the rod tip; the line is drawn from wherever this ends up.
    const rodHeight = key ? library.size(key).y : 2;
    this.tipAnchor = new THREE.Object3D();
    this.tipAnchor.position.y = rodHeight - GRIP - 0.02;
    this.hand.add(this.tipAnchor);

    this.bobber = makeBobber();
    this.bobber.visible = false;
    this.rig.add(this.bobber);

    this.line = makeLine();
    this.line.visible = false;
    this.rig.add(this.line);

    this.phase = 'idle';
    this.phaseT = 0;
    this.castPitch = 0;
    this.castPush = 0;
    this.slack = CAST_POSE.idle.slack;
    this.castFrom = new THREE.Vector3();   // tip position the bobber flew from

    this.time = 0;
    this.bobPhase = 0;
    this.grounded = true;
    this.dip = 0;
    this.dipVel = 0;
    this.sway = new THREE.Vector3();       // eased positional offset
    this.tilt = new THREE.Vector3();       // eased rotational offset
    _euler.setFromQuaternion(camera.quaternion, 'YXZ');
    this.lastYaw = _euler.y;
    this.lastPitch = _euler.x;
  }

  get isCasting() {
    return this.phase !== 'idle';
  }

  // Start a cast. Called mid-cast it does nothing; called while the bobber is
  // sitting out there it reels in early, so clicking twice is "cast, then reel".
  cast() {
    if (this.phase === 'idle') this._setPhase('rewind');
    else if (this.phase === 'hang') this._setPhase('reel');
  }

  update(dt, { speed = 0, grounded = true, locked = true } = {}) {
    if (!this.rig) return;
    this.time += dt;

    // Unlocked: abandon the cast and let every offset settle to neutral.
    if (!locked && this.phase !== 'idle' && this.phase !== 'reel') this._setPhase('reel');

    this._pose(dt, speed, grounded, locked);
    this._animateCast(dt);

    // The line is built from the posed tip, so flush this frame's matrices first.
    this.rig.updateMatrixWorld(true);
    this._updateLine();
  }

  // Breathing, walk bob, turn lag and the landing dip, all eased into the rig.
  _pose(dt, speed, grounded, locked) {
    const active = locked ? 1 : 0;
    const moving = Math.min(speed / RUN_SPEED, 1) * active;

    // Turn lag: the rod trails the view, so offset opposite to the turn rate.
    _euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    const dYaw = wrapPi(_euler.y - this.lastYaw);
    const dPitch = _euler.x - this.lastPitch;
    this.lastYaw = _euler.y;
    this.lastPitch = _euler.x;
    const inv = 1 / Math.max(dt, 1e-4);
    const yawRate = clamp(dYaw * inv, -8, 8) * active;
    const pitchRate = clamp(dPitch * inv, -8, 8) * active;

    // Walk bob: a flattened figure-eight whose rate and size follow the speed.
    this.bobPhase += dt * (5 + 7 * moving);
    const bobX = Math.sin(this.bobPhase) * BOB_AMP * moving;
    const bobY = Math.sin(this.bobPhase * 2) * BOB_AMP * 0.6 * moving;

    // Idle breathing, mostly drowned out once you start walking.
    const calm = (1 - 0.7 * moving) * active;
    const breathX = Math.sin(this.time * 0.9) * 0.004 * calm;
    const breathY = Math.sin(this.time * 1.4) * 0.006 * calm;

    // Landing dip: a damped spring kicked whenever the feet find the ground.
    if (grounded && !this.grounded) this.dipVel -= LAND_IMPULSE;
    this.grounded = grounded;
    this.dipVel += (-DIP_STIFF * this.dip - DIP_DAMP * this.dipVel) * dt;
    this.dip += this.dipVel * dt;

    const k = 1 - Math.exp(-SWAY_EASE * dt);
    this.sway.x += (clamp(yawRate * SWAY_GAIN, -SWAY_MAX, SWAY_MAX) + bobX + breathX - this.sway.x) * k;
    this.sway.y += (clamp(-pitchRate * SWAY_GAIN, -SWAY_MAX, SWAY_MAX) + bobY + breathY + this.dip - this.sway.y) * k;
    this.tilt.z += (clamp(-yawRate * 0.02, -0.10, 0.10) + Math.sin(this.time * 1.1) * 0.01 * calm - this.tilt.z) * k;
    this.tilt.x += (clamp(pitchRate * 0.012, -0.08, 0.08) - this.tilt.x) * k;

    this.rig.position.set(this.sway.x, this.sway.y, 0);
    this.rig.rotation.set(this.tilt.x, 0, this.tilt.z);
  }

  // Rod pose per cast phase, plus where the bobber is on its arc.
  _animateCast(dt) {
    if (this.phase !== 'idle') {
      this.phaseT += dt;
      if (this.phaseT >= CAST_TIME[this.phase]) this._setPhase(CAST_NEXT[this.phase]);
    }

    const pose = CAST_POSE[this.phase];
    const k = 1 - Math.exp(-pose.ease * dt);
    this.castPitch += (pose.pitch - this.castPitch) * k;
    this.castPush += (pose.push - this.castPush) * k;
    this.slack += (pose.slack - this.slack) * (1 - Math.exp(-4 * dt));

    this.hand.rotation.x = HAND_ROT.x + this.castPitch;
    this.hand.position.z = HAND_POS.z + this.castPush;
    this.hand.position.y = HAND_POS.y - this.castPush * 0.4;

    const t = this.phaseT / (CAST_TIME[this.phase] ?? 1);
    if (this.phase === 'fly') {
      // Out and down to the water, lifting over a shallow arc on the way.
      this.bobber.position.copy(this.castFrom).lerp(BOBBER_REST, easeOut(t));
      this.bobber.position.y += Math.sin(Math.PI * t) * ARC_HEIGHT;
    } else if (this.phase === 'hang') {
      this.bobber.position.copy(BOBBER_REST);
      this.bobber.position.y += Math.sin(this.time * 2.2) * 0.02;
      this.bobber.position.x += Math.sin(this.time * 1.3) * 0.012;
    } else if (this.phase === 'reel') {
      // Winding in accelerates as the slack disappears.
      this.tipInRig(_v);
      this.bobber.position.copy(BOBBER_REST).lerp(_v, t * t);
    } else {
      this.tipInRig(this.bobber.position);   // parked at the tip, hidden
    }

    const out = this.phase === 'fly' || this.phase === 'hang' || this.phase === 'reel';
    this.bobber.visible = out;
    this.line.visible = out;
  }

  // Line from tip to bobber, sagging along true "down" so it reads as gravity
  // even when you tilt your head.
  _updateLine() {
    if (!this.line.visible) return;
    this.tipInRig(_tip);
    this.rig.getWorldQuaternion(_q).invert();
    _down.set(0, -1, 0).applyQuaternion(_q);

    const sag = this.slack * Math.min(1, _tip.distanceTo(this.bobber.position) / 2);
    const arr = this.line.geometry.attributes.position.array;
    for (let i = 0; i <= LINE_SEGMENTS; i++) {
      const t = i / LINE_SEGMENTS;
      _v.copy(_tip).lerp(this.bobber.position, t).addScaledVector(_down, sag * 4 * t * (1 - t));
      arr[i * 3] = _v.x;
      arr[i * 3 + 1] = _v.y;
      arr[i * 3 + 2] = _v.z;
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }

  // Rod tip in rig space, where the line and bobber live.
  tipInRig(target) {
    this.tipAnchor.getWorldPosition(target);
    return this.rig.worldToLocal(target);
  }

  _setPhase(phase) {
    this.phase = phase;
    this.phaseT = 0;
    if (phase === 'fly') this.castFrom.copy(this.tipInRig(_v));
  }
}

// Clone materials (the world shares the prototype's) and turn the clones into
// always-on-top viewmodel materials. Shadows off — a rod welded to your face
// casting a shadow across the courtyard looks like a bug.
function asViewmodel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(overlayMaterial) : overlayMaterial(o.material);
    o.renderOrder = RENDER_ORDER;
    o.castShadow = false;
    o.receiveShadow = false;
    o.frustumCulled = false;
  });
}

function overlayMaterial(material) {
  const m = material.clone();
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  return m;
}

function makeBobber() {
  const group = new THREE.Group();
  const red = overlayMaterial(new THREE.MeshStandardMaterial({ color: 0xc8412f, roughness: 0.5 }));
  const white = overlayMaterial(new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.6 }));
  const top = new THREE.Mesh(new THREE.SphereGeometry(BOBBER_R, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), red);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(BOBBER_R, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
  for (const mesh of [top, bottom]) {
    mesh.renderOrder = RENDER_ORDER;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

function makeLine() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((LINE_SEGMENTS + 1) * 3), 3));
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: 0xeceadf, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, fog: false,
  }));
  line.renderOrder = RENDER_ORDER + 1;
  line.frustumCulled = false;
  return line;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const easeOut = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;
const wrapPi = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
