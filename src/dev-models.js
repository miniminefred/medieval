// Dev-only model gallery: lays every entry of the model table out on a metre grid
// next to a 1.8 m human reference and a +Z arrow, so scale / orientation / theme
// problems are obvious at a glance. Not part of the game — served at
// http://localhost:8091/dev-models.html
//
// Console API (handy for scripted screenshots):
//   gal.row(i)          jump the camera to row i
//   gal.focus('barrel') frame a single model by key
//   gal.report()        dump measured sizes for every loaded key

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { ModelLibrary } from './models.js';
import { MODELS, MODEL_KEYS } from './model-table.js';

const PER_ROW = 5;
const HUMAN_H = 1.8;

// ------------------------------------------------------------------ scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb3c2);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xdfefff, 0x6b6152, 2.0));
const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
sun.position.set(-30, 60, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.far = 300;
scene.add(sun, sun.target);

// ------------------------------------------------------------------ helpers
const MAT = {
  human: new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.9 }),
  humanHead: new THREE.MeshStandardMaterial({ color: 0x6f7880, roughness: 0.9 }),
  poleA: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 }),
  poleB: new THREE.MeshStandardMaterial({ color: 0xd02a2a, roughness: 0.8 }),
  arrow: new THREE.MeshStandardMaterial({ color: 0xd02a2a, roughness: 0.7 }),
  pad: new THREE.MeshStandardMaterial({ color: 0xb9c3a4, roughness: 1 }),
};

// A blocky 1.8 m person: 1.5 m body + 0.3 m head, so the silhouette reads as
// human-ish without pretending to be a character model.
function humanRef() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.5, 0.25), MAT.human);
  body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), MAT.humanHead);
  head.position.y = 1.65;
  g.add(body, head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Candy-striped pole, one band per metre, tall enough to read the model against.
function metrePole(metres) {
  const g = new THREE.Group();
  for (let i = 0; i < metres; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 10),
      i % 2 ? MAT.poleB : MAT.poleA,
    );
    seg.position.y = i + 0.5;
    seg.castShadow = true;
    g.add(seg);
  }
  return g;
}

// Flat arrow lying on the pad, pointing +Z.
function zArrow() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 1.1), MAT.arrow);
  shaft.position.set(0, 0.02, 0.55);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), MAT.arrow);
  head.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  head.position.set(0, 0.02, 1.4);
  g.add(shaft, head);
  return g;
}

// ------------------------------------------------------------------ build
const labelBox = document.getElementById('labels');
const rowsBox = document.getElementById('rows');
const rowInfo = document.getElementById('rowinfo');

const cells = [];   // { key, x, z, cell, size, row }
const riggedKeys = [];  // models containing a SkinnedMesh — these break under plain clone()
const rows = [];    // { index, minX, maxX, z, span, height, keys }

const lib = new ModelLibrary();

(async function main() {
  await lib.load();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0x7f8f6a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Rows of PER_ROW models. Each row is spaced (and its cells are spaced) by the
  // largest model in it, so a row of pines does not crush a row of buckets.
  let z = 0;
  for (let r = 0; r * PER_ROW < MODEL_KEYS.length; r++) {
    const keys = MODEL_KEYS.slice(r * PER_ROW, r * PER_ROW + PER_ROW);
    const sizes = keys.map((k) => lib.size(k));
    const wide = Math.max(2, ...sizes.map((s) => Math.max(s.x, s.z)));
    const tall = Math.max(2, ...sizes.map((s) => s.y));
    const pitch = wide + 4.5;
    if (r > 0) z += wide / 2 + 5;

    const xs = keys.map((_, i) => (i - (PER_ROW - 1) / 2) * pitch);
    keys.forEach((key, i) => addCell(key, xs[i], z, r));

    // Row label banner on the ground at the left end.
    rows.push({
      index: r, z, height: tall, keys,
      minX: xs[0] - pitch / 2, maxX: xs[xs.length - 1] + pitch / 2,
      span: pitch * PER_ROW,
    });
    z += wide / 2 + 5;
  }

  // Metre grid over the whole layout, drawn last so it sits on the ground.
  const grid = new THREE.GridHelper(400, 400, 0x000000, 0x445544);
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  grid.position.set(0, 0.005, z / 2);
  scene.add(grid);

  buildRowButtons();
  row(0);
  addEventListener('keydown', (e) => {
    if (e.key === ']') row(current + 1);
    if (e.key === '[') row(current - 1);
  });
  renderer.setAnimationLoop(tick);
  window.gal = { row, flat, focus, report, view, showAll: () => showOnly(null), rows, cells, riggedKeys, camera, controls };
  console.log(`[gallery] ${cells.length} cells in ${rows.length} rows — try gal.report()`);
  console.log('[gallery] rigged (SkinnedMesh) models:', riggedKeys.join(', ') || 'none');
})();

function addCell(key, x, z, rowIndex) {
  const spec = MODELS[key];
  const cell = new THREE.Group();
  cell.position.set(x, 0, z);
  scene.add(cell);

  const size = lib.size(key);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(Math.max(1.6, Math.max(size.x, size.z) * 0.75 + 1.4), 40), MAT.pad);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.01;
  pad.receiveShadow = true;
  cell.add(pad);

  // The animals are rigged: Object3D.clone() (what ModelLibrary.create uses) leaves
  // the copy's SkinnedMeshes bound to the prototype's skeleton, so they vanish from
  // wherever you put them. SkeletonUtils.clone rebinds, which is what the gallery
  // needs to be able to look at them at all. (The game has the same bug — see report.)
  const entry = lib.entries.get(key);
  const obj = entry ? skeletonClone(entry.proto) : null;
  if (obj) cell.add(obj);
  const rigged = !!obj && (() => { let r = false; obj.traverse((o) => { if (o.isSkinnedMesh) r = true; }); return r; })();

  const off = Math.max(1.0, size.x / 2 + 0.7);
  const h = humanRef();
  h.position.x = -off;
  cell.add(h);

  const pole = metrePole(Math.max(2, Math.ceil(size.y) + 1));
  pole.position.set(off, 0, 0);
  cell.add(pole);

  const arrow = zArrow();
  arrow.position.z = Math.max(size.z / 2 + 0.4, 1.0);
  cell.add(arrow);

  const label = document.createElement('div');
  label.className = 'lbl';
  const y = spec.yaw ? ` yaw=${(spec.yaw / Math.PI).toFixed(2)}π` : '';
  const flag = spec.reject ? ' ⛔' : '';
  if (spec.reject) label.classList.add('bad');
  label.innerHTML = `<b>${key}${flag}${rigged ? ' ⚙' : ''}</b><span>${obj ? '' : 'FAILED TO LOAD — '}` +
    `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m` +
    ` · fit ${spec.fit} ${spec.size}${y}</span>`;
  labelBox.appendChild(label);
  if (rigged) riggedKeys.push(key);

  // Anchor sits on the camera side of the pad so labels never hide behind the model.
  cells.push({ key, x, z, cell, size, row: rowIndex, label, anchor: new THREE.Vector3(x, 0, z + Math.max(size.z / 2, 1.2) + 2.2) });
}

function buildRowButtons() {
  rowsBox.innerHTML = '';
  rows.forEach((r) => {
    const b = document.createElement('button');
    b.textContent = `${r.index}: ${r.keys[0]}…`;
    b.onclick = () => row(r.index);
    rowsBox.appendChild(b);
  });
}

// ------------------------------------------------------------------ camera
let current = 0;
let focused = null;   // when set, only this cell's label is drawn
function row(i, deg = 8) {
  current = Math.max(0, Math.min(rows.length - 1, i));
  const r = rows[current];
  // Default is from the +Z side and slightly above: a model that faces +Z faces us.
  // `deg` swings the whole row round (180 = view from behind) to settle facing.
  const dist = Math.max(r.span * 0.78, r.height * 2.6);
  const target = new THREE.Vector3(0, Math.min(r.height * 0.45, 6), r.z);
  const a = (deg * Math.PI) / 180;
  camera.fov = 50;
  controls.target.copy(target);
  camera.position.set(Math.sin(a) * dist * 0.86, dist * 0.3 + 2, r.z + Math.cos(a) * dist * 0.86);
  camera.updateProjectionMatrix();
  controls.update();
  focused = null;
  showOnly(current);
  sun.target.position.set(0, 0, r.z);
  rowInfo.textContent = `row ${current} / ${rows.length - 1} — ${r.keys.join(', ')}`;
}

// Near-orthographic elevation of a whole row: a long lens from far away so every
// cell is seen head-on, which is the only way to judge five models' facing at once.
function flat(i, deg = 0) {
  row(i, deg);
  const r = rows[current];
  const dist = Math.max(r.span * 0.78, r.height * 2.6) * 6;
  const a = (deg * Math.PI) / 180;
  camera.fov = 9;
  camera.position.set(Math.sin(a) * dist, r.height * 0.55 + dist * 0.06, r.z + Math.cos(a) * dist);
  camera.updateProjectionMatrix();
  controls.target.set(0, r.height * 0.45, r.z);
  controls.update();
}

function focus(key) {
  const c = cells.find((x) => x.key === key);
  if (!c) return console.warn('no such key', key);
  const d = Math.max(4, Math.max(c.size.x, c.size.y, c.size.z) * 2.4);
  controls.target.set(c.x, c.size.y * 0.45, c.z);
  camera.position.set(c.x + d * 0.28, c.size.y * 0.5 + d * 0.35, c.z + d);
  controls.update();
  focused = c;
  for (const x of cells) x.cell.visible = x === c;
  rowInfo.textContent = `focus: ${key} — ${c.size.x.toFixed(2)} × ${c.size.y.toFixed(2)} × ${c.size.z.toFixed(2)} m`;
}

// Rows sit one behind another, so viewing them all at once from a fixed angle just
// stacks props on top of each other. Only one row is drawn at a time; gal.showAll()
// brings the whole layout back for a bird's-eye look.
// Solo a model seen from a given compass bearing, where 0° is dead-on from +Z.
// Orbiting a known angle is the only reliable way to answer "which side is the front".
function view(key, deg = 0, elev = 0.28) {
  focus(key);
  const c = cells.find((x) => x.key === key);
  if (!c) return;
  const d = Math.max(4, Math.max(c.size.x, c.size.y, c.size.z) * 2.2);
  const a = (deg * Math.PI) / 180;
  camera.position.set(c.x + Math.sin(a) * d, c.size.y * 0.5 + d * elev, c.z + Math.cos(a) * d);
  controls.target.set(c.x, c.size.y * 0.45, c.z);
  controls.update();
  rowInfo.textContent = `${key} @ ${deg}° (0° = looking from +Z) — ` +
    `${c.size.x.toFixed(2)} × ${c.size.y.toFixed(2)} × ${c.size.z.toFixed(2)} m`;
}

function showOnly(rowIndex) {
  for (const c of cells) c.cell.visible = rowIndex == null || c.row === rowIndex;
}

function report() {
  return cells.map((c) => ({
    key: c.key,
    w: +c.size.x.toFixed(2), h: +c.size.y.toFixed(2), d: +c.size.z.toFixed(2),
    fit: MODELS[c.key].fit, size: MODELS[c.key].size, yaw: MODELS[c.key].yaw ?? 0,
  }));
}

// ------------------------------------------------------------------ loop
const _v = new THREE.Vector3();
function tick() {
  controls.update();
  renderer.render(scene, camera);

  // Project each cell's front-of-pad anchor to screen space for its HTML label.
  const halfW = innerWidth / 2, halfH = innerHeight / 2;
  for (const c of cells) {
    // Only the row (or single model) being inspected is labelled — otherwise the
    // far rows' labels pile up over the near ones and nothing is readable.
    if (focused ? c !== focused : c.row !== current) { c.label.style.display = 'none'; continue; }
    _v.copy(c.anchor).project(camera);
    const onScreen = _v.z < 1 && Math.abs(_v.x) < 1.35 && Math.abs(_v.y) < 1.35;
    c.label.style.display = onScreen ? 'block' : 'none';
    if (!onScreen) continue;
    c.label.style.left = `${(_v.x + 1) * halfW}px`;
    c.label.style.top = `${(-_v.y + 1) * halfH}px`;
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
