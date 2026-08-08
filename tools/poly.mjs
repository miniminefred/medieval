#!/usr/bin/env node
// Poly Pizza asset fetcher.
//
// poly.pizza hosts the CC0 / CC-BY low-poly packs (Quaternius & friends) that
// this project uses for props. There is no public download API without a key,
// but every page is server-rendered, so we scrape:
//
//   search page  /search/<term>   -> card list of { id, title, author }
//   model page   /m/<id>          -> embedded JSON with ResourceID + Licence
//   asset        https://static.poly.pizza/<ResourceID>.glb
//
// Usage:
//   node tools/poly.mjs search "hay bale"          list candidates
//   node tools/poly.mjs info <id>                  one model's metadata
//   node tools/poly.mjs get <id> <outfile.glb>     download + print credit line
//
// Downloads land in public/models/medieval/ and are credited in that folder's
// CREDITS.md — keep both in sync when adding models.

import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const UA = { headers: { 'user-agent': 'Mozilla/5.0 (medieval-game asset fetch)' } };

async function html(url) {
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

// Cards render as: <a href="/m/ID"><div class="MuiCardMedia-root" title="TITLE"
// ... followed by the uploader link <a ... href="/u/AUTHOR">AUTHOR</a>.
export async function search(term, page = 1) {
  const url = page > 1
    ? `https://poly.pizza/search/${encodeURIComponent(term)}?page=${page}`
    : `https://poly.pizza/search/${encodeURIComponent(term)}`;
  const doc = await html(url);
  const out = [];
  const card = /<a href="\/m\/([A-Za-z0-9_-]+)"><div class="MuiCardMedia-root" title="([^"]*)"/g;
  for (let m; (m = card.exec(doc));) {
    const tail = doc.slice(m.index, m.index + 2000);
    const author = /href="\/u\/([^"]+)"/.exec(tail);
    out.push({
      id: m[1],
      title: decodeEntities(m[2]),
      author: author ? decodeEntities(decodeURIComponent(author[1])) : '?',
    });
  }
  return out;
}

export async function info(id) {
  const doc = await html(`https://poly.pizza/m/${id}`);
  const pick = (key) => {
    const m = new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`).exec(doc);
    return m ? JSON.parse(`"${m[1]}"`) : null;
  };
  const resource = pick('ResourceID');
  if (!resource) throw new Error(`no ResourceID on /m/${id} — page layout changed?`);
  return {
    id,
    title: pick('Title') ?? decodeEntities(/<title>([^<]*)</.exec(doc)?.[1] ?? id),
    author: /"Creator":\{"Username":"([^"]+)"/.exec(doc)?.[1] ?? '?',
    licence: pick('Licence') ?? 'unknown',
    url: `https://static.poly.pizza/${resource}.glb`,
    source: `https://poly.pizza/m/${id}`,
  };
}

export async function get(id, outPath) {
  const meta = await info(id);
  const res = await fetch(meta.url, UA);
  if (!res.ok) throw new Error(`${res.status} downloading ${meta.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 4).toString('ascii') !== 'glTF') {
    throw new Error(`${meta.url} is not a binary glTF (got ${buf.subarray(0, 16).toString('hex')})`);
  }
  await writeFile(outPath, buf);
  return { ...meta, bytes: buf.length, file: outPath };
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// ------------------------------------------------------------------------ cli
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'search') {
    for (const r of await search(a, Number(b) || 1)) {
      console.log(`${r.id}\t${r.title}\t${r.author}`);
    }
  } else if (cmd === 'info') {
    console.log(JSON.stringify(await info(a), null, 2));
  } else if (cmd === 'get') {
    const r = await get(a, b);
    console.log(`${r.file}\t${r.bytes}B\t${r.title} by ${r.author} (${r.licence})\t${r.source}`);
  } else {
    console.error('usage: poly.mjs search <term> [page] | info <id> | get <id> <out.glb>');
    process.exit(1);
  }
}
