// Downloads the realistic CC0 textures and HDRI skies from Poly Haven
// (https://polyhaven.com) into public/, and writes public/textures/CREDITS.md.
//
//   node tools/polyhaven.mjs
//
// Poly Haven has a public JSON API: /files/<id> lists every map of an asset at
// every resolution. We take colour + OpenGL normal + ARM (AO/roughness/metal
// packed in R/G/B, which is exactly what three's aoMap/roughnessMap/metalnessMap
// read) for each texture, and one .hdr per sky. Existing files are skipped.

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', 'public');
const RES = '2k';

// key -> Poly Haven asset id. The key is what game code refers to.
const TEXTURES = [
  ['sand', 'aerial_beach_01'],    // wind-rippled dune sand
  ['dry', 'dry_ground_01'],       // cracked desert earth
  ['burned', 'burned_ground_01'], // burned ground and ash
  ['rock', 'rock_face'],          // cliffs and mountain faces
  ['snow', 'snow_02'],            // the snowy south
];

const HDRIS = [
  ['desert_noon', 'qwantani_noon_puresky'], // clear sky only, no ground in it
];

const MAPS = { Diffuse: 'diff', nor_gl: 'nor', arm: 'arm' };

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function download(url, file) {
  if (await exists(file)) return false;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return true;
}

const credits = [];

for (const [key, id] of TEXTURES) {
  const files = await getJson(`https://api.polyhaven.com/files/${id}`);
  const info = await getJson(`https://api.polyhaven.com/info/${id}`);
  for (const [map, suffix] of Object.entries(MAPS)) {
    const url = files[map]?.[RES]?.jpg?.url;
    if (!url) throw new Error(`${id} has no ${map} at ${RES}`);
    const got = await download(url, path.join(ROOT, 'textures', key, `${suffix}.jpg`));
    console.log(`${got ? 'downloaded' : 'have'} textures/${key}/${suffix}.jpg`);
  }
  credits.push([`textures/${key}`, info.name, Object.keys(info.authors).join(', '), id]);
}

for (const [key, id] of HDRIS) {
  const files = await getJson(`https://api.polyhaven.com/files/${id}`);
  const info = await getJson(`https://api.polyhaven.com/info/${id}`);
  const url = files.hdri['1k'].hdr.url; // lighting only, 1k is plenty
  const got = await download(url, path.join(ROOT, 'hdri', `${key}.hdr`));
  console.log(`${got ? 'downloaded' : 'have'} hdri/${key}.hdr`);
  credits.push([`hdri/${key}.hdr`, info.name, Object.keys(info.authors).join(', '), id]);
}

const table = [
  '# Poly Haven assets',
  '',
  'All CC0 (public domain) from [Poly Haven](https://polyhaven.com). Downloaded by',
  '`tools/polyhaven.mjs`.',
  '',
  '| File | Asset | Author | Source |',
  '|------|-------|--------|--------|',
  ...credits.map(([f, n, a, id]) => `| \`${f}\` | ${n} | ${a} | https://polyhaven.com/a/${id} |`),
  '',
].join('\n');
await writeFile(path.join(ROOT, 'textures', 'CREDITS.md'), table);
console.log('wrote textures/CREDITS.md');
