// Downloads the realistic CC0 textures and HDRI skies from Poly Haven
// (https://polyhaven.com) into public/, and writes public/textures/CREDITS.md.
//
//   node tools/polyhaven.mjs
//
// Poly Haven has a public JSON API: /files/<id> lists every map of an asset at
// every resolution. Ground textures get colour + OpenGL normal only: the terrain
// shader blends five of them at once, and with ARM maps too it would need more
// than the 16 texture units WebGL guarantees.
// One .hdr per sky. Existing files are skipped.

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', 'public');

// [key, Poly Haven asset id, resolution, maps]. The key is what game code refers to.
const GROUND = { Diffuse: 'diff', nor_gl: 'nor' };
// Buildings use one material per surface, so they can afford the ARM map too
// (AO / roughness / metalness in R/G/B — exactly what three's aoMap,
// roughnessMap and metalnessMap read). 1k keeps the download sane; walls are
// seen up close but tile every couple of metres.
const BUILD = { Diffuse: 'diff', nor_gl: 'nor', arm: 'arm' };

const TEXTURES = [
  ['sand', 'aerial_beach_01', '2k', GROUND],    // wind-rippled dune sand
  ['dry', 'dry_ground_01', '2k', GROUND],       // cracked desert earth
  ['burned', 'burned_ground_01', '2k', GROUND], // burned ground and ash
  ['rock', 'rock_face', '2k', GROUND],          // cliffs and mountain faces
  ['snow', 'snow_02', '2k', GROUND],            // the snowy south

  // The cyborg city.
  ['citywall', 'castle_wall_slates', '1k', BUILD],     // the curtain wall
  ['steel', 'metal_plate', '1k', BUILD],               // plating on wall, roofs, machines
  ['rust', 'rusty_metal_02', '1k', BUILD],             // older, weathered plates
  ['plaster', 'plastered_wall_02', '1k', BUILD],       // house walls
  ['timber', 'weathered_brown_planks', '1k', BUILD],   // beams, doors, shutters
  ['housestone', 'rustic_stone_wall', '1k', BUILD],    // house plinths, ground floors
  ['rooftiles', 'clay_roof_tiles', '1k', BUILD],       // roofs
  ['cobble', 'cobblestone_floor_01', '1k', BUILD],     // streets and squares
];

const HDRIS = [
  ['desert_noon', 'qwantani_noon_puresky'], // clear sky only, no ground in it
];


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

for (const [key, id, RES, MAPS] of TEXTURES) {
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
