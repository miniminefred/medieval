import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityMaterial } from './builder.js';

// A crowd: every townsperson in a place drawn with a couple of dozen
// InstancedMeshes, one per body part — a few draw calls for hundreds of people.
// Plain folk are hooded figures (docs/DESIGN.md: realistic faces are the hardest
// thing to make, and a hood hides that). Cyborgs show their machine parts, in
// mixed cartoon colours, by how much of them is machine (`cyborg` level):
//   0  none — a hooded person
//   1  a metal arm, and a red eye glowing inside the hood
//   2  no hood: a metal head with a visor and red eye, a shoulder plate, and a
//      chest plate with a glowing core
//   3  nearly all machine: a metal body, both arms, both shoulders
//
// A person is a plain object the caller moves each frame — pos, yaw, `bob`
// (walk/work bounce), `lean` (bowing forward) and `toolSwing` — and update()
// writes the matrices. Behaviour lives with whoever made the crowd (townsfolk.js).

const MAX = 700;

// The figure, feet at y = 0, facing +z, built once; one geometry per part.
function figureParts() {
  const at = (geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
    geo.scale(sx, sy, sz);
    if (rx) geo.rotateX(rx);
    if (rz) geo.rotateZ(rz);
    geo.translate(x, y, z);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    return geo.index ? geo.toNonIndexed() : geo;
  };
  const merge = (...g) => mergeGeometries(g);
  const arm = (side, r0, r1) => at(new THREE.CylinderGeometry(r0, r1, 0.62, 10), side * 0.32, 1.05, 0.06, 1, 1, 1, -0.15);
  return {
    // Cloth.
    body: merge(
      at(new THREE.CylinderGeometry(0.2, 0.42, 1.35, 14), 0, 0.675, 0),
      at(new THREE.SphereGeometry(0.3, 14, 10), 0, 1.35, 0, 1.3, 0.7, 1),
      arm(-1, 0.07, 0.09), arm(1, 0.07, 0.09)),
    hood: merge(
      at(new THREE.SphereGeometry(0.2, 14, 12), 0, 1.6, -0.02),
      at(new THREE.ConeGeometry(0.15, 0.3, 12), 0, 1.78, -0.07, 1, 1, 1, -0.35)),
    dark: at(new THREE.SphereGeometry(0.135, 12, 10), 0, 1.58, 0.085),
    helmet: at(new THREE.SphereGeometry(0.215, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.66, -0.01),
    // Machine: chunky and rounded, cartoon-style.
    head: merge(
      at(new THREE.SphereGeometry(0.2, 18, 14), 0, 1.6, 0, 1, 1.08, 1),
      at(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), 0.2, 1.6, 0, 1, 1, 1, 0, Math.PI / 2),
      at(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), -0.2, 1.6, 0, 1, 1, 1, 0, Math.PI / 2)),
    visor: at(new THREE.BoxGeometry(0.3, 0.075, 0.06), 0, 1.62, 0.175),
    eye: at(new THREE.SphereGeometry(0.038, 10, 8), 0.07, 1.62, 0.2),
    armR: merge(arm(1, 0.1, 0.11), at(new THREE.SphereGeometry(0.11, 10, 8), 0.34, 0.74, 0.11)),
    armL: merge(arm(-1, 0.1, 0.11), at(new THREE.SphereGeometry(0.11, 10, 8), -0.34, 0.74, 0.11)),
    shoulderR: at(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0.31, 1.33, 0.01),
    shoulderL: at(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), -0.31, 1.33, 0.01),
    plate: at(new THREE.BoxGeometry(0.4, 0.32, 0.1), 0, 1.2, 0.2),
    core: at(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 16), 0, 1.22, 0.26, 1, 1, 1, Math.PI / 2),
    torso: at(new THREE.CylinderGeometry(0.22, 0.45, 1.3, 16), 0, 0.65, 0),
  };
}

// Mixed cartoon colours for a cyborg's metal and for their glowing core.
export const METALS = [0x6e86a6, 0xd9dde3, 0xc9a24a, 0x3fa39b, 0xb2463f, 0x6b5a9a, 0x8f969e];
export const CORES = [0x48d8ff, 0x5dff8a, 0xff5ad1, 0xffd04a];

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
  // Cartoon metal: smooth and glossy, its colour per person.
  const metalMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.55 });
  const mesh = (geo, mat, coloured = false) => {
    const m = new THREE.InstancedMesh(geo, mat, MAX);
    m.count = 0;
    m.castShadow = !mat.isMeshBasicMaterial;
    m.frustumCulled = false;      // instances spread over a whole town; the bounds lie
    if (coloured) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3).fill(1), 3);
    parent.add(m);
    return m;
  };
  // Lights are unlit (MeshBasic), so they glow at any hour.
  const M = {
    body: mesh(parts.body, cloakMat, true),
    hood: mesh(parts.hood, cloakMat, true),
    dark: mesh(parts.dark, new THREE.MeshStandardMaterial({ color: 0x0a0907, roughness: 1 })),
    helmet: mesh(parts.helmet, cityMaterial('steel', renderer)),
    head: mesh(parts.head, metalMat, true),
    visor: mesh(parts.visor, new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.2, metalness: 0.4 })),
    eye: mesh(parts.eye, new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false })),
    armR: mesh(parts.armR, metalMat, true),
    armL: mesh(parts.armL, metalMat, true),
    shoulderR: mesh(parts.shoulderR, metalMat, true),
    shoulderL: mesh(parts.shoulderL, metalMat, true),
    plate: mesh(parts.plate, metalMat, true),
    core: mesh(parts.core, new THREE.MeshBasicMaterial({ toneMapped: false }), true),
    torso: mesh(parts.torso, metalMat, true),
  };
  // Which parts a person of each machine level shows.
  const SHOW = {
    body: () => true,
    hood: (p) => p.cyborg < 2, dark: (p) => p.cyborg < 2, helmet: (p) => p.cap && p.cyborg < 2,
    head: (p) => p.cyborg >= 2, visor: (p) => p.cyborg >= 2, eye: (p) => p.cyborg >= 1,
    armR: (p) => p.cyborg >= 1, shoulderR: (p) => p.cyborg >= 2, plate: (p) => p.cyborg >= 2,
    core: (p) => p.cyborg >= 2, armL: (p) => p.cyborg >= 3, shoulderL: (p) => p.cyborg >= 3,
    torso: (p) => p.cyborg >= 3,
  };
  const METAL_PARTS = ['head', 'armR', 'armL', 'shoulderR', 'shoulderL', 'plate', 'torso'];
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
    // `cyborg`: 0–3, how much machine (see the top of this file); `metal` and
    // `core` colour it.
    add({ x, y, z, yaw = 0, color = 0x6b5a48, cyborg = 0, metal = METALS[0], core = CORES[0], helmet: cap = false, tool = null, height = 1 }) {
      if (people.length >= MAX) return null;
      const i = people.length;
      const p = { pos: new THREE.Vector3(x, y, z), yaw, bob: 0, lean: 0, toolSwing: 0, cyborg, cap, tool, height };
      _c.set(color);
      M.body.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
      M.hood.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
      _c.set(metal);
      for (const k of METAL_PARTS) M[k].instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
      _c.set(core);
      M.core.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
      people.push(p);
      return p;
    },
    // Write every person's matrices. Call after moving them.
    update() {
      const n = people.length;
      for (const m of Object.values(M)) m.count = n;
      for (const k of TOOLS) tools[k].count = n;
      for (let i = 0; i < n; i++) {
        const p = people[i];
        _q.setFromEuler(_e.set(p.lean, p.yaw, 0, 'YXZ'));
        _m.compose(_p.set(p.pos.x, p.pos.y + p.bob, p.pos.z), _q, _s.set(p.height, p.height, p.height));
        for (const k in M) M[k].setMatrixAt(i, SHOW[k](p) ? _m : zero);
        // The tool hangs from the right hand, swung about the hand by toolSwing.
        hand.makeRotationX(-p.toolSwing).setPosition(0.34, 0.8, 0.2);
        _t.multiplyMatrices(_m, hand);
        for (const k of TOOLS) tools[k].setMatrixAt(i, p.tool === k ? _t : zero);
      }
      for (const m of [...Object.values(M), ...Object.values(tools)]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    },
    setVisible(v) {
      for (const m of [...Object.values(M), ...Object.values(tools)]) m.visible = v;
    },
  };
}
