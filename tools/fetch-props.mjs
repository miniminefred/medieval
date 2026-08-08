#!/usr/bin/env node
// Downloads the medieval prop set from Poly Pizza into public/models/medieval/
// and writes manifest.json + CREDITS.md next to the files.
//
//   node tools/fetch-props.mjs          download anything missing
//   node tools/fetch-props.mjs --force  re-download everything
//
// WANTED is the single source of truth for what ships: `key` is the name the
// game refers to the model by, `id` the poly.pizza model id. Add a line here,
// re-run, and the manifest/credits regenerate.
//
// REJECTED below records assets that were downloaded, looked at in the dev gallery
// (/dev-models.html) and thrown out. Keeping the ids stops anyone re-shopping the
// same wrong model — the titles are all perfectly plausible.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from './poly.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'medieval');

const WANTED = [
  // ---------------------------------------------------------- buildings
  ['house_a',        'BH2XHWUNmF'],  // Fantasy House
  ['house_b',        'he3p42mUTH'],  // Fantasy House
  ['house_c',        'dcPho4SUA3'],  // Fantasy House
  ['house_d',        'RSwoYSLblu'],  // House
  ['house_e',        'oJJIRwv6Bo'],  // House
  ['inn',            'x3ZcGn3jr4'],  // Fantasy Inn
  ['sawmill',        'alxTTFjKDM'],  // Fantasy Sawmill
  ['stable',         'qhNQSOGGbi'],  // Fantasy Stable
  ['blacksmith',     'bV52eTG1Aj'],  // Blacksmith
  ['windmill',       'WUbU1Nct2W'],  // Windmill
  ['watchtower',     'f2J0aSLVi4'],  // Watch Tower
  ['barn_timber',    'TvXpjtD2nk'],  // Storage shed — timber barn, replaces `barn`
  ['barracks',       'wTDbVozPAj'],  // Fantasy Barracks
  ['guard_tower',    'sbaM8I229r'],  // Guard Tower — timber watchtower
  ['village_market', '0TsHLxX6CB'],  // Village Market — produce stalls
  ['hut',            '4MJWbyd6vw'],  // Hut
  ['storage_hut',    'BsTn4bKSGb'],  // Storage Hut
  ['market_stall',   'DGIM5HGISb'],  // Market Stand
  ['market_stalls',  'fmHUuX9AS3'],  // Market Stalls Compact
  ['tent',           '5Q7qIrfDxA'],  // Tent

  // ------------------------------------------------------------ animals
  ['horse',          'F8HAAcLeBL'],
  ['horse_white',    'bEdE4rmZy9'],
  ['donkey',         'qmX6nhnvp7'],
  ['cow',            '5XSc2Fka3F'],
  ['bull',           'a8PIIYwF7r'],
  ['sheep',          'C39AUXUUes'],
  ['pig',            'TNvG3QUFlp'],
  ['chicken',        'ineV9pU5VL'],

  // -------------------------------------------------------------- farm
  ['hay',            'Yu8TOERkpw'],
  ['wheat',          'lPspzfC8Pu'],
  ['crops',          'Ro6K0Yg7mx'],
  ['pumpkin',        'bvLvqnU1jX'],
  ['scythe',         'yE9TKCewO8'],
  ['trough',         'xL4YlaHjS2'],  // Large Pot Filled

  // ------------------------------------------------------------- props
  ['barrel',         'ONdghDBByN'],
  ['crate',          '3VGWnZPXmG'],
  ['chest',          'O72u4Drp8k'],
  ['bucket',         '83obI9bNun'],
  ['sacks',          'gzvyAQ797z'],
  ['cauldron',       'QaWJOPa6Gt'],
  ['bench',          'jLxjFxFRpw'],
  ['ladder',         'h2xOIRr1OP'],
  ['well',           'QlqncKYxXb'],
  ['fence',          'e02PFKKhbr'],
  ['fence_b',        'U7g0Wxpt63'],
  ['sign',           'Kg1kxfrItG'],
  ['signpost',       'lGC5MHYT85'],  // Sign — two-arm wooden finger-post, replaces `town_sign`
  ['palisade',       '8C9NBoi9cA'],  // Wooden Wall — palisade section
  ['anvil',          'bY1pp3kAAb'],  // Workbench Anvil (Kenney, CC0)
  ['torch',          'pNsfJzhXiD'],
  ['banner',         'svYG8KZxjq'],
  ['bonfire',        'k1e0cOzi8A'],
  ['campfire',       'Azj9hJwwwG'],  // Bonfire — logs in a stone ring
  ['cart',           'NBDHe8J7f9'],  // Broken Cart
  ['handcart',       'l7bDe7ak6j'],  // Cart — awninged market handcart
  ['logs',           'fei4I7FfrJ'],
  ['wood_log',       'L4E32Wee6C'],
  ['stump',          'nFvEbUX6LE'],
  ['dock',           'XViKoBh2UN'],
  ['bridge',         'j4KsIuJYnq'],  // Small Bridge

  // ------------------------------------------------------------ nature
  ['tree_a',         '2paAm1ja4w'],
  ['tree_b',         '9nvGuZlbpE'],
  ['tree_c',         'qZtx0AHhcy'],
  ['tree_autumn',    '2lRubrT6Na'],
  ['pine_a',         'igSu0cPoBz'],
  ['pine_b',         'Zt62gceKXZ'],
  ['pine_c',         '79gmlLnweB'],
  ['bush_a',         'EoTERLq3z2'],
  ['bush_b',         'BVYSNurXMV'],
  ['bush_flowers',   '1X06RgvSr6'],
  ['bush_berries',   'TSbIxkDtxF'],
  ['grass_tuft',     'iw6l7gqcdQ'],
  ['rock_small',     'RtLRqYjfMs'],
  ['rock_medium',    's1OJ3bBzqc'],
  ['rock_large',     '54jZKTAt5p'],

  // ------------------------------------------------------------ in-hand
  ['fishing_pole',   'skqPvEIpve'],  // bare wooden pole, no reel — the one we hold
  ['fishing_rod',    '0YAR0Lg58p'],  // wooden blank but a modern reel; fallback only
];

// Downloaded, inspected, thrown out. Do not re-add without looking at it first.
const REJECTED = [
  ['town_sign',     'VSZubp0ru3', 'modern steel highway gantry with a green motorway sign'],
  ['barn',          'vSqQNA7ez6', 'red gambrel American farm barn — every Quaternius barn is'],
  ['fishing_rod_b', 'aOabqWh68m', 'red composite blank with a baitcaster reel'],
  ['fishing_rod_c', 'lDlWQjn9Zg', 'black graphite blank with a spinning reel'],
];
void REJECTED;

const force = process.argv.includes('--force');
await mkdir(OUT, { recursive: true });

const manifest = [];
const failed = [];

for (const [key, id] of WANTED) {
  const file = `${key}.glb`;
  const path = join(OUT, file);
  if (!force && await exists(path)) {
    console.log(`skip  ${file}`);
    continue;
  }
  try {
    const r = await get(id, path);
    manifest.push({ key, file, title: r.title, author: r.author, licence: r.licence, source: r.source, bytes: r.bytes });
    console.log(`ok    ${file}\t${(r.bytes / 1024).toFixed(0)}kB\t${r.title} — ${r.author}`);
  } catch (e) {
    failed.push({ key, id, error: e.message });
    console.error(`FAIL  ${file}\t${e.message}`);
  }
}

// Always rewritten, even when nothing was downloaded — that is how the manifest and
// credits stay honest after a model is dropped from WANTED and deleted from disk.
{
  const wanted = new Set(WANTED.map(([key]) => key));
  const existing = await readJson(join(OUT, 'manifest.json'));
  const merged = new Map(existing.filter((e) => wanted.has(e.key)).map((e) => [e.key, e]));
  for (const e of manifest) merged.set(e.key, e);
  const list = [...merged.values()].sort((a, b) => a.key.localeCompare(b.key));
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(list, null, 1) + '\n');
  await writeFile(join(OUT, 'CREDITS.md'), credits(list));
  console.log(`\nwrote manifest.json + CREDITS.md (${list.length} models)`);
}
if (failed.length) {
  console.error(`\n${failed.length} failed:`, failed);
  process.exitCode = 1;
}

function credits(list) {
  const rows = list.map((e) =>
    `| \`${e.key}\` | ${e.title} | ${e.author} | ${e.licence} | ${e.source} |`).join('\n');
  const authors = [...new Set(list.map((e) => e.author))].sort();
  return `# Model credits — medieval prop set\n\n` +
    `All models downloaded from [Poly Pizza](https://poly.pizza) with \`node tools/fetch-props.mjs\`.\n` +
    `Authors: ${authors.join(', ')} — thank you!\n\n` +
    `| Key | Model | Author | Licence | Source |\n|---|---|---|---|---|\n${rows}\n`;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function readJson(p) {
  try { return JSON.parse(await (await import('node:fs/promises')).readFile(p, 'utf8')); } catch { return []; }
}
