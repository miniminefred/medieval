import * as THREE from 'three';
import { CityBuilder } from '../builder.js';
import { mulberry32 } from '../noise.js';
import { createCrowd, SKINS } from '../people.js';
import { createScorpions } from './scorpions.js';
import { PLACES } from './places.js';

// The apex city (docs/DESIGN.md): the dinosaur-people built in giant bones and
// animal pelts — great rib-vaulted halls, hide stretched over the ribs. The
// Lava King burned it. Now the apex are rebuilding: a few halls stand finished,
// there is scaffolding everywhere, and it is still a mess. Builders carry bones
// and planks, guards watch the palisade, and the wounded of the war lie healing
// by the healer's tent.
//
// The camp — inside the palisade — is safe. Round it lie the ruins: broken
// frames, scorched pelts, scattered bones, and scorpion nests. The bandits think
// the place is dead and leave it be.

const rng = mulberry32(4411);
const between = (a, b) => a + rng() * (b - a);
const pick = (a) => a[Math.floor(rng() * a.length)];

const CAMP_R = 34;           // the palisade
const RUIN_R = 88;           // how far the ruins spread

// A hall: rib arches of bone along its length (local z), hide stretched over
// them. `cover` 0..1 is how much of the hide is up; `broken` knocks ribs over;
// `burnt` chars what is left. `skull` puts a great skull over the entrance.
function hall(b, heightAt, x, z, yaw, { len = 12, span = 8, rise = 6, cover = 1, broken = 0, burnt = false, skull = false }) {
  const y = heightAt(x, z);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const ribs = Math.max(2, Math.round(len / 1.6));
  const SEG = 8;
  // Points round one arch, in the arch's own plane (local x, height).
  const arch = [];
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI;
    arch.push([Math.cos(a) * span / 2, Math.sin(a) * rise]);
  }
  const standing = [];
  for (let r = 0; r < ribs; r++) {
    const lz = -len / 2 + (r / (ribs - 1)) * len;
    if (rng() < broken) {
      // A fallen rib, lying half-buried.
      const [fx, fz] = at(between(-span / 3, span / 3), lz);
      b.box('bone', fx, y - 0.1, fz, 0.3, 0.3, rise * 0.9, { yaw: yaw + between(-0.6, 0.6) });
      standing.push(false);
      continue;
    }
    standing.push(true);
    for (let i = 0; i < SEG; i++) {
      const [ax, ay] = arch[i], [bx, by] = arch[i + 1];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, l = Math.hypot(bx - ax, by - ay);
      const [wx, wz] = at(mx, lz);
      b.box('bone', wx, y + my - 0.13, wz, l + 0.08, 0.26, 0.26, { yaw, roll: Math.atan2(by - ay, bx - ax) });
    }
  }
  // Hide between neighbouring standing ribs.
  for (let r = 0; r + 1 < ribs; r++) {
    if (!standing[r] || !standing[r + 1]) continue;
    const lz = -len / 2 + ((r + 0.5) / (ribs - 1)) * len, dz = len / (ribs - 1);
    for (let i = 0; i < SEG; i++) {
      if (rng() > cover) continue;
      const [ax, ay] = arch[i], [bx, by] = arch[i + 1];
      const mx = (ax + bx) / 2 * 1.02, my = (ay + by) / 2 * 1.02, l = Math.hypot(bx - ax, by - ay);
      const [wx, wz] = at(mx, lz);
      b.box(burnt && rng() < 0.7 ? 'hideburnt' : 'hide', wx, y + my - 0.03, wz, l + 0.1, 0.06, dz + 0.05, { yaw, roll: Math.atan2(by - ay, bx - ax) });
    }
  }
  // Solid where the hide is up (finished halls are walls; ruins you walk through).
  // Only where the hide comes down to the ground: a wall along each long side
  // and across the back. The front (+z end, under the skull) is the way in, and
  // the inside is room to walk about.
  if (cover > 0.8) {
    for (const side of [-1, 1]) {
      const [wx, wz] = at(side * (span / 2 - 0.5), 0);
      b.turnedCollider(wx, wz, 1.0, len, yaw, y + rise);
    }
    const [bx, bz] = at(0, -len / 2);
    b.turnedCollider(bx, bz, span, 1.0, yaw, y + rise);
  }
  if (skull) {
    const [kx, kz] = at(0, len / 2 + 0.6);
    b.cylinder('bone', kx, y + rise * 0.72 + 0.2, kz, 1.1, 1.2, { yaw, pitch: Math.PI / 2, sides: 18 });   // the skull, face out
    b.box('bone', kx, y + rise * 0.72 - 0.7, kz + 0.3 * c, 1.3, 0.5, 1.4, { yaw });            // jaw
    for (const sx of [-0.45, 0.45]) {
      const [ex, ez] = at(sx, len / 2 + 1.0);
      b.box('rust', ex, y + rise * 0.72 + 0.1, ez, 0.35, 0.3, 0.1, { yaw });                     // eye holes
      const [hx, hz] = at(sx * 2.2, len / 2 + 0.5);
      b.cylinder('bone', hx, y + rise * 0.72 + 0.4, hz, 0.22, 1.6, { rTop: 0.02, yaw, roll: -sx * 2.2 }); // horns
    }
  }
}

// Scaffolding: poles and planks round a frame being raised.
function scaffold(b, heightAt, x, z, w, d, h) {
  const y = heightAt(x, z);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) {
    b.cylinder('timber', x + sx * w / 2, y, z + sz * d / 2, 0.07, h, { sides: 6 });
  }
  for (let ly = 1.8; ly < h; ly += 1.9) {
    b.box('timber', x, y + ly, z - d / 2, w + 0.3, 0.06, 0.6);
    b.box('timber', x, y + ly, z + d / 2, w + 0.3, 0.06, 0.6);
    b.box('timber', x - w / 2, y + ly + 0.9, z, 0.06, 0.06, d);                    // a cross brace
  }
}

export function buildApexCity(group, renderer, heightAt) {
  const b = new CityBuilder(renderer);
  const { x: cx, z: cz } = PLACES.apexCity;

  // ---------------------------------------------------------- the camp
  // Finished halls: the great hall with its skull, and two smaller.
  hall(b, heightAt, cx, cz - 6, 0, { len: 18, span: 11, rise: 8, skull: true });
  hall(b, heightAt, cx - 18, cz + 6, Math.PI / 2, { len: 10, span: 7, rise: 5 });
  hall(b, heightAt, cx + 18, cz + 8, -Math.PI / 2, { len: 10, span: 7, rise: 5 });
  // Going up: frames with half their hide, in scaffolding.
  hall(b, heightAt, cx - 14, cz - 20, 0.3, { len: 9, span: 7, rise: 5, cover: 0.35 });
  scaffold(b, heightAt, cx - 14, cz - 20, 8, 10, 5.5);
  hall(b, heightAt, cx + 16, cz - 16, -0.4, { len: 8, span: 6, rise: 4.5, cover: 0.15 });
  scaffold(b, heightAt, cx + 16, cz - 16, 7, 9, 5);
  // Piles of bones and planks for the builders.
  for (const [px, pz] of [[cx - 4, cz + 18], [cx + 8, cz + 20], [cx - 24, cz - 6]]) {
    const py = heightAt(px, pz);
    for (let i = 0; i < 7; i++) b.box('bone', px + between(-1, 1), py + i * 0.1, pz + between(-0.6, 0.6), 0.25, 0.25, between(2, 3.5), { yaw: between(-0.3, 0.3) });
    b.box('timber', px + 2.2, py, pz, 1.4, 0.6, 2.6, { collide: true });
  }
  // The healer's tent: a low pelt awning, where the wounded lie.
  const tx = cx + 6, tz = cz + 12;
  b.roof('hide', 'hide', tx, heightAt(tx, tz) + 1.8, tz, 7, 4, 1.4, { yaw: 0.2, over: 0.1 });
  for (const [ox, oz] of [[-3.3, -1.9], [3.3, -1.9], [-3.3, 1.9], [3.3, 1.9]]) b.cylinder('bone', tx + ox, heightAt(tx, tz), tz + oz, 0.1, 1.85);

  // The palisade: stakes of timber and bone, gate to the north.
  const n = Math.round((Math.PI * 2 * CAMP_R) / 0.34);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.09) continue;    // the gate, north
    const px = cx + Math.cos(a) * CAMP_R, pz = cz + Math.sin(a) * CAMP_R, py = heightAt(px, pz);
    const h = between(2.4, 3.1);
    const key = i % 9 === 0 ? 'bone' : 'timber';
    b.cylinder(key, px, py - 0.3, pz, 0.16, h, { sides: 7 });
    b.cylinder(key, px, py - 0.3 + h, pz, 0.16, 0.4, { sides: 7, rTop: 0.01 });
  }
  // Small boxes that hug the stakes (big ones stuck far into the camp).
  for (let i = 0; i < 200; i++) {
    const a = ((i + 0.5) / 200) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.09) continue;
    const px = cx + Math.cos(a) * CAMP_R, pz = cz + Math.sin(a) * CAMP_R;
    b.collider(px - 0.55, px + 0.55, pz - 0.55, pz + 0.55, heightAt(px, pz) + 2.4);
  }

  // ---------------------------------------------------------- the ruins
  const ruins = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + between(-0.15, 0.15);
    const r = between(CAMP_R + 14, RUIN_R);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (Math.abs(x - cx) < 10 && z < cz) continue;       // keep the track to the gate clear
    hall(b, heightAt, x, z, between(0, Math.PI), {
      len: between(7, 14), span: between(6, 9), rise: between(4, 6.5),
      cover: between(0.05, 0.3), broken: between(0.3, 0.6), burnt: true,
    });
    // Scattered bones about it.
    for (let k = 0; k < 6; k++) {
      const bx = x + between(-6, 6), bz = z + between(-6, 6);
      b.box('bone', bx, heightAt(bx, bz) - 0.05, bz, 0.2, 0.2, between(0.8, 2.4), { yaw: between(0, 3) });
    }
    ruins.push({ x, z });
  }

  b.finish(group);

  // ---------------------------------------------------------- scorpions
  const nests = ruins.filter((_, i) => i % 4 === 1).map((r) => ({ x: r.x + 3, z: r.z + 2, count: 6 + Math.floor(rng() * 4) }));
  const scorpions = createScorpions(group, heightAt, nests, rng);

  // ---------------------------------------------------------- the apex
  const crowd = createCrowd(group, renderer);
  const thinkers = [];
  const tunic = () => pick([0x6b5236, 0x7a6a4a, 0x5a4636, 0x8a6a3a, 0x4f4a3a]);
  const add = (o) => crowd.add({ apex: true, skin: pick(SKINS), color: tunic(), height: between(1.0, 1.12), ...o });
  const g = (x, z) => heightAt(x, z);

  // Builders: carry from the piles to the scaffolds and back.
  const piles = [[cx - 4, cz + 18], [cx + 8, cz + 20], [cx - 24, cz - 6]];
  const sites = [[cx - 14, cz - 14], [cx + 16, cz - 10], [cx - 12, cz - 26]];
  for (let i = 0; i < 10; i++) {
    const from = pick(piles), to = pick(sites);
    const p = add({ x: from[0], y: g(from[0], from[1]), z: from[1], tool: 'crate' });
    let leg = 0, ph = rng() * 10;
    thinkers.push((dt, t) => {
      const [tx2, tz2] = leg === 0 ? to : from;
      const dx = tx2 - p.pos.x, dz = tz2 - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { leg = 1 - leg; p.tool = leg === 0 ? 'crate' : null; return; }
      const step = Math.min(d, 1.3 * dt);
      p.pos.x += (dx / d) * step; p.pos.z += (dz / d) * step;
      p.pos.y = g(p.pos.x, p.pos.z);
      p.yaw = Math.atan2(dx, dz);
      p.bob = Math.abs(Math.sin(t * 6 + ph)) * 0.05;
    });
  }
  // Hammering at the scaffolds.
  for (const [sx, sz] of sites) {
    for (let k = 0; k < 2; k++) {
      const x = sx + between(-3, 3), z = sz + 5.5;
      const p = add({ x, y: g(x, z), z, yaw: Math.PI, tool: 'hammer' });
      const ph = rng() * 10;
      thinkers.push((dt, t) => {
        const c = (t * 1.3 + ph) % 1;
        p.toolSwing = c < 0.75 ? (c / 0.75) * 1.6 : 1.6 * (1 - (c - 0.75) / 0.25);
        p.lean = 0.1;
      });
    }
  }
  // Guards: at the gate and round the palisade's inside.
  for (const [x, z, yaw] of [[cx - 5, cz - CAMP_R + 3, Math.PI], [cx + 5, cz - CAMP_R + 3, Math.PI]]) {
    const p = add({ x, y: g(x, z), z, yaw, tool: 'spear', height: 1.15 });
    const ph = rng() * 10;
    thinkers.push((dt, t) => { p.yaw = yaw + Math.sin(t * 0.2 + ph) * 0.4; });
  }
  for (let k = 0; k < 4; k++) {
    const p = add({ x: cx, y: 0, z: cz, tool: 'spear', height: 1.12 });
    const ph = (k / 4) * Math.PI * 2, R = CAMP_R - 4;
    thinkers.push((dt, t) => {
      const a = ph + t * 0.035;
      p.pos.set(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R);
      p.pos.y = g(p.pos.x, p.pos.z);
      p.yaw = Math.atan2(-Math.sin(a), Math.cos(a));
      p.bob = Math.abs(Math.sin(t * 5.5 + k)) * 0.04;
    });
  }
  // The wounded, healing under the healer's tent: some lying, some sitting up.
  for (let k = 0; k < 6; k++) {
    const x = tx - 2.5 + (k % 3) * 2.5, z = tz - 0.9 + Math.floor(k / 3) * 1.8;
    const lying = k % 2 === 0;
    const p = add({ x, y: g(x, z) + (lying ? 0.22 : 0), z, yaw: lying ? 0.2 + Math.PI / 2 : 0.2, hurt: true });
    p.lean = lying ? -1.45 : 0.35;
    const ph = rng() * 10;
    thinkers.push((dt, t) => { p.bob = Math.sin(t * 0.8 + ph) * 0.01; });
  }
  // The healer, moving between them.
  {
    const p = add({ x: tx, y: g(tx, tz), z: tz, color: 0xd8d0bc });
    thinkers.push((dt, t) => {
      p.pos.x = tx + Math.sin(t * 0.25) * 3;
      p.pos.z = tz + Math.cos(t * 0.31) * 0.6;
      p.pos.y = g(p.pos.x, p.pos.z);
      p.yaw = Math.cos(t * 0.25) > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.lean = Math.max(0, Math.sin(t * 0.9)) * 0.4;
    });
  }
  crowd.update();

  let t = 0;
  return {
    colliders: b.colliders,
    doors: [],
    scorpions,
    update(dt, playerPos, combat) {
      const near = Math.hypot(playerPos.x - cx, playerPos.z - cz) < 400;
      crowd.setVisible(near);
      scorpions.update(dt, playerPos, combat, near);
      if (!near) return;
      t += dt;
      for (const think of thinkers) think(dt, t);
      crowd.update();
    },
  };
}
