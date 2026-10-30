import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityMaterial } from './builder.js';

// A crowd: every townsperson in a place drawn with a handful of InstancedMeshes
// (cloak, hood shadow, cyborg eye, guard helmet, and one per tool) — a few draw
// calls for hundreds of people. Like the bandits they are hooded figures for now
// (docs/DESIGN.md: characters are the hardest part to make realistic); their
// cloth colour, a cyborg's glowing eye or a guard's steel cap tell them apart.
//
// A person is a plain object the caller moves each frame — pos, yaw, `bob`
// (walk/work bounce), `lean` (bowing forward) and `toolSwing` — and update()
// writes the matrices. Behaviour lives with whoever made the crowd (townsfolk.js).

const MAX = 700;

// The figure, feet at y = 0, facing +z, built once and merged per material.
function figureParts() {
  const cloak = [], dark = [], eye = [], helmet = [];
  const at = (geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => {
    geo.scale(sx, sy, sz);
    if (rx) geo.rotateX(rx);
    geo.translate(x, y, z);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    return geo.index ? geo.toNonIndexed() : geo;
  };
  cloak.push(at(new THREE.CylinderGeometry(0.2, 0.42, 1.35, 14), 0, 0.675, 0));
  cloak.push(at(new THREE.SphereGeometry(0.3, 14, 10), 0, 1.35, 0, 1.3, 0.7, 1));
  cloak.push(at(new THREE.SphereGeometry(0.2, 14, 12), 0, 1.6, -0.02));
  cloak.push(at(new THREE.ConeGeometry(0.15, 0.3, 12), 0, 1.78, -0.07, 1, 1, 1, -0.35));
  for (const s of [-1, 1]) cloak.push(at(new THREE.CylinderGeometry(0.07, 0.09, 0.62, 8), s * 0.32, 1.05, 0.06, 1, 1, 1, -0.15));
  dark.push(at(new THREE.SphereGeometry(0.135, 12, 10), 0, 1.58, 0.085));
  eye.push(at(new THREE.SphereGeometry(0.028, 8, 6), 0.05, 1.6, 0.2));
  helmet.push(at(new THREE.SphereGeometry(0.215, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.66, -0.01));
  return { cloak: mergeGeometries(cloak), dark: mergeGeometries(dark), eye: mergeGeometries(eye), helmet: mergeGeometries(helmet) };
}

// Tools, in the right hand's space (hand at the origin, pointing +z forward).
function toolGeometry(kind) {
  const parts = [];
  const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g.toNonIndexed()); };
  const cyl = (r, h, x, y, z) => { const g = new THREE.CylinderGeometry(r, r, h, 6); g.translate(x, y, z); parts.push(g.toNonIndexed()); };
  if (kind === 'spear') { cyl(0.025, 2.1, 0, 0.3, 0); box(0.06, 0.22, 0.02, 0, 1.43, 0); }
  if (kind === 'hammer') { cyl(0.025, 0.45, 0, 0.1, 0); box(0.16, 0.08, 0.08, 0, 0.32, 0); }
  // The hand is 0.8 m up, so a head at -0.72 just brushes the ground.
  if (kind === 'broom') { cyl(0.02, 1.4, 0, 0.0, 0.1); box(0.3, 0.16, 0.06, 0, -0.72, 0.1); }
  if (kind === 'hoe') { cyl(0.022, 1.5, 0, 0.05, 0.05); box(0.18, 0.04, 0.12, 0, -0.72, 0.1); }
  if (kind === 'crate') { box(0.5, 0.4, 0.4, 0, 0.72, -0.15); }   // up on the right shoulder
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return mergeGeometries(parts);
}

const TOOLS = ['spear', 'hammer', 'broom', 'hoe', 'crate'];

export function createCrowd(parent, renderer) {
  const parts = figureParts();
  const hess = cityMaterial('linen', renderer);
  const cloakMat = new THREE.MeshStandardMaterial({ map: hess.map, normalMap: hess.normalMap, roughness: 1 });
  const mesh = (geo, mat) => {
    const m = new THREE.InstancedMesh(geo, mat, MAX);
    m.count = 0;
    m.castShadow = true;
    m.frustumCulled = false;      // instances spread over a whole town; the bounds lie
    parent.add(m);
    return m;
  };
  const cloak = mesh(parts.cloak, cloakMat);
  cloak.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  const dark = mesh(parts.dark, new THREE.MeshStandardMaterial({ color: 0x0a0907, roughness: 1 }));
  const eye = mesh(parts.eye, new THREE.MeshStandardMaterial({ color: 0x062028, emissive: 0x3fd8ff, emissiveIntensity: 4 }));
  const helmet = mesh(parts.helmet, cityMaterial('steel', renderer));
  const wood = cityMaterial('timber', renderer);
  const tools = Object.fromEntries(TOOLS.map((k) => [k, mesh(toolGeometry(k), k === 'spear' || k === 'hammer'
    ? new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.7, metalness: 0.3 }) : wood)]));

  const people = [];
  const _m = new THREE.Matrix4(), _t = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const hand = new THREE.Matrix4();
  const _c = new THREE.Color();

  return {
    people,
    // Add a person; returns the object to move about.
    add({ x, y, z, yaw = 0, color = 0x6b5a48, eye: glow = false, helmet: cap = false, tool = null, height = 1 }) {
      if (people.length >= MAX) return null;
      const p = { pos: new THREE.Vector3(x, y, z), yaw, bob: 0, lean: 0, toolSwing: 0, glow, cap, tool, height };
      cloak.instanceColor.setXYZ(people.length, ...(_c.set(color).toArray()));
      people.push(p);
      return p;
    },
    // Write every person's matrices. Call after moving them.
    update() {
      const n = people.length;
      cloak.count = dark.count = eye.count = helmet.count = n;
      for (const k of TOOLS) tools[k].count = n;
      for (let i = 0; i < n; i++) {
        const p = people[i];
        _q.setFromEuler(_e.set(p.lean, p.yaw, 0, 'YXZ'));
        _m.compose(_p.set(p.pos.x, p.pos.y + p.bob, p.pos.z), _q, _s.set(p.height, p.height, p.height));
        cloak.setMatrixAt(i, _m);
        dark.setMatrixAt(i, _m);
        eye.setMatrixAt(i, p.glow ? _m : zero);
        helmet.setMatrixAt(i, p.cap ? _m : zero);
        // The tool hangs from the right hand, swung about the hand by toolSwing.
        hand.makeRotationX(-p.toolSwing).setPosition(0.34, 0.8, 0.2);
        _t.multiplyMatrices(_m, hand);
        for (const k of TOOLS) tools[k].setMatrixAt(i, p.tool === k ? _t : zero);
      }
      for (const m of [cloak, dark, eye, helmet, ...Object.values(tools)]) m.instanceMatrix.needsUpdate = true;
      cloak.instanceColor.needsUpdate = true;
    },
    setVisible(v) {
      for (const m of [cloak, dark, eye, helmet, ...Object.values(tools)]) m.visible = v;
    },
  };
}
