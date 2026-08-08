#!/usr/bin/env node
// Prints the raw world-space bounding box of every GLB in public/models/medieval/.
//
//   node tools/measure-models.mjs            table of key, size, centre
//   node tools/measure-models.mjs --json     same as JSON
//
// Parses the GLB container directly (no three.js): the JSON chunk gives the node
// hierarchy, and glTF requires POSITION accessors to carry min/max, so the box is
// the union of every mesh's 8 transformed accessor corners. Skinned meshes are
// measured in bind pose, which is what we want for placement anyway.

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'medieval');

export async function measure(path) {
  const gltf = parseGlbJson(await readFile(path));
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  for (const n of scene?.nodes ?? []) walk(gltf, n, identity(), box);
  if (!Number.isFinite(box.min[0])) return null;
  return {
    min: box.min.map(round),
    max: box.max.map(round),
    size: [0, 1, 2].map((i) => round(box.max[i] - box.min[i])),
  };
}

function walk(gltf, index, parent, box) {
  const node = gltf.nodes[index];
  const m = mul(parent, localMatrix(node));
  if (node.mesh !== undefined) {
    for (const prim of gltf.meshes[node.mesh].primitives) {
      const acc = gltf.accessors[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (let c = 0; c < 8; c++) {
        const p = [
          c & 1 ? acc.max[0] : acc.min[0],
          c & 2 ? acc.max[1] : acc.min[1],
          c & 4 ? acc.max[2] : acc.min[2],
        ];
        const w = apply(m, p);
        for (let i = 0; i < 3; i++) {
          if (w[i] < box.min[i]) box.min[i] = w[i];
          if (w[i] > box.max[i]) box.max[i] = w[i];
        }
      }
    }
  }
  for (const child of node.children ?? []) walk(gltf, child, m, box);
}

function parseGlbJson(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const length = buf.readUInt32LE(8);
  let offset = 12;
  while (offset < length) {
    const chunkLen = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) return JSON.parse(buf.toString('utf8', offset + 8, offset + 8 + chunkLen));
    offset += 8 + chunkLen;
  }
  throw new Error('no JSON chunk');
}

// --- column-major 4x4 helpers (glTF's matrix layout) ------------------------
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function localMatrix(node) {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const r = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
  return [
    r[0] * sx, r[1] * sx, r[2] * sx, 0,
    r[3] * sy, r[4] * sy, r[5] * sy, 0,
    r[6] * sz, r[7] * sz, r[8] * sz, 0,
    tx, ty, tz, 1,
  ];
}

function mul(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
const round = (n) => Math.round(n * 1000) / 1000;

// ------------------------------------------------------------------------ cli
if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.glb')).sort();
  const rows = [];
  for (const f of files) {
    try {
      const m = await measure(join(DIR, f));
      rows.push({ key: basename(f, '.glb'), ...m });
    } catch (e) {
      rows.push({ key: basename(f, '.glb'), error: e.message });
    }
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 1));
  } else {
    for (const r of rows) {
      console.log(r.error
        ? `${r.key.padEnd(16)} ERROR ${r.error}`
        : `${r.key.padEnd(16)} size ${r.size.map((n) => String(n).padStart(8)).join(' ')}   minY ${String(r.min[1]).padStart(8)}`);
    }
  }
}
