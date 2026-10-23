// Screenshots of the running game, taken through the installed Chrome — how we
// look at what we built without a scene editor. Needs `npm run dev` running.
//
//   node tools/shot.mjs <realm>,<x>,<z>,<yawDeg>,<pitchDeg>,<out.png> [more...]
//   node tools/shot.mjs wasteland,0,0,180,-5,shots/spawn.png castle,0,36,0,0,shots/gate.png
//
// yaw 0 looks north (-Z), 180 south (+Z). Prints any page errors it sees.
// SHOT_EVAL="<js>" runs in the page (with `m` = window.__medieval) before each
// shot — e.g. to hide one object and see whether an artifact goes with it.

import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const specs = process.argv.slice(2).map((a) => a.split(','));
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--window-size=1280,720'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
page.on('console', (m) => { if (m.type() !== 'debug') console.log(`console.${m.type()}:`, m.text()); });

await page.goto('http://localhost:8091/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__medieval, { timeout: 60000 });

for (const [realm, x, z, yaw, pitch, out] of specs) {
  const info = await page.evaluate(async (realm, x, z, yaw, pitch, extra) => {
    const m = window.__medieval;
    if (m.realm.name !== realm) await m.travel(realm);
    m.player.teleport(x, z, 0);
    const Euler = m.camera.rotation.constructor;
    m.camera.quaternion.setFromEuler(new Euler(pitch * Math.PI / 180, yaw * Math.PI / 180, 0, 'YXZ'));
    document.getElementById('overlay').classList.add('hidden');
    await new Promise((r) => setTimeout(r, 2500));   // textures, HDRI, mood settle
    if (extra) new Function('m', extra)(m);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const p = m.player.object.position;
    return { realm: m.realm.name, pos: [p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1)] };
  }, realm, +x, +z, +yaw, +pitch, process.env.SHOT_EVAL ?? '');
  await mkdir(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(out, info);
}
await browser.close();
