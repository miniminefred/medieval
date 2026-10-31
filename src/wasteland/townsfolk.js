import * as THREE from 'three';
import { createCrowd, METALS, CORES } from '../people.js';
import { mulberry32 } from '../noise.js';
import { CITY } from './terrain.js';
import { STREETS, MARKET, MAIN } from './city/streets.js';
import { COUNTERS } from './city/market.js';
import { WALL } from './city/wall.js';
import { PLACES } from './places.js';
import { trade } from '../trade.js';
import { SHOPS } from '../shops.js';

// The people of the cyborg city and Farmville (docs/DESIGN.md): walking the
// streets, shopping at the market, standing and chatting, guards at the gate and
// on the walls, and people at work — porters, sweepers, smiths, farmers. Drawn as
// one instanced crowd per place (people.js); each person has a little `think`.
//
// Nobody reacts to the player yet, and walkers are not solid (no shoving).
// Only the crowd near the player is animated; a far-off town stands still.

const rng = mulberry32(9001);
const between = (a, b) => a + rng() * (b - a);
const pick = (a) => a[Math.floor(rng() * a.length)];

const CLOTH = [0x6b5a48, 0x5a4a3a, 0x7a6a52, 0x4d4a44, 0x6d4e3a, 0x55606a, 0x3f4f5f, 0x7d6b5d, 0x5e5243, 0x806a4a];
const GUARD = 0x3b3f44;
const WALK = 1.35;

function face(p, tx, tz) { p.yaw = Math.atan2(tx - p.pos.x, tz - p.pos.z); }

// Step `p` toward (tx, tz) at `speed`; true once there. Walking bobs.
function stepTo(p, tx, tz, speed, dt, t) {
  const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return true;
  const s = Math.min(d, speed * dt);
  p.pos.x += (dx / d) * s;
  p.pos.z += (dz / d) * s;
  // Turn smoothly rather than snapping.
  const want = Math.atan2(dx, dz);
  let dy = want - p.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  p.yaw += dy * Math.min(1, dt * 8);
  p.bob = Math.abs(Math.sin(t * 6.5)) * 0.045;
  return false;
}

// ----------------------------------------------------------------- the city

function streetGraph() {
  const ns = STREETS.filter((s) => s.dir === 'ns').map((s) => ({ c: (s.minX + s.maxX) / 2, w: s.maxX - s.minX }));
  const ew = STREETS.filter((s) => s.dir === 'ew').map((s) => ({ c: (s.minZ + s.maxZ) / 2, w: s.maxZ - s.minZ }));
  // The town hall stands in the middle of the round market, where the main
  // street and a cross street meet, so walkers never cross the market: any
  // stretch of street that passes within it is not walkable (shoppers have it).
  const near = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((MARKET.x - x0) * dx + (MARKET.z - z0) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x0 + dx * t - MARKET.x, z0 + dz * t - MARKET.z) < MARKET.r + 2;
  };
  const okH = (i, j) => !near(ns[i].c, ew[j].c, ns[i + 1].c, ew[j].c);   // (i,j) → (i+1,j)
  const okV = (i, j) => !near(ns[i].c, ew[j].c, ns[i].c, ew[j + 1].c);   // (i,j) → (i,j+1)
  function neighbours(i, j) {
    const out = [];
    if (i > 0 && okH(i - 1, j)) out.push([i - 1, j]);
    if (i < ns.length - 1 && okH(i, j)) out.push([i + 1, j]);
    if (j > 0 && okV(i, j - 1)) out.push([i, j - 1]);
    if (j < ew.length - 1 && okV(i, j)) out.push([i, j + 1]);
    return out;
  }
  return { ns, ew, neighbours };
}

export function buildCityFolk(group, renderer) {
  const crowd = createCrowd(group, renderer);
  const Y = CITY.y + 0.07;
  const G = streetGraph();
  const { ns, ew } = G;
  const thinkers = [];
  const shops = [];        // tradespeople you can talk to
  const cloth = () => pick(CLOTH);
  const shopkeeper = (p, shop) => shops.push({
    pos: p.pos, reach: 2.6, label: `trade with ${SHOPS[shop].name.toLowerCase()}`,
    use() { trade.openShop(SHOPS[shop]); },
  });
  // How much machine a city dweller is: it varies (docs/DESIGN.md). About half
  // are plain folk; the rest anything from a metal arm to nearly all metal.
  const cyborg = () => { const r = rng(); return r < 0.5 ? 0 : r < 0.68 ? 1 : r < 0.86 ? 2 : 3; };
  const machine = () => ({ cyborg: cyborg(), metal: pick(METALS), core: pick(CORES) });

  // A street walker: node to node, keeping to one side of the street.
  function walker(opts = {}) {
    let i, j;
    do { i = Math.floor(rng() * ns.length); j = Math.floor(rng() * ew.length); }
    while (Math.hypot(ns[i].c - MARKET.x, ew[j].c - MARKET.z) < MARKET.r + 2 || !G.neighbours(i, j).length);
    if (opts.lane) { i = rng() < 0.5 ? 0 : ns.length - 1; }
    const side = (rng() < 0.5 ? -1 : 1) * between(0.6, 1.6);
    const p = crowd.add({ x: ns[i].c, y: Y, z: ew[j].c, color: opts.color ?? cloth(), ...(opts.plain ? {} : machine()),
      helmet: opts.helmet, tool: opts.tool, height: between(0.94, 1.06) });
    let prev = null, tx = p.pos.x, tz = p.pos.z, wait = between(0, 4);
    const speed = (opts.speed ?? WALK) * between(0.85, 1.15);
    thinkers.push((dt, t) => {
      if (wait > 0) { wait -= dt; p.bob = 0; return; }
      if (stepTo(p, tx, tz, speed, dt, t)) {
        let next = G.neighbours(i, j);
        if (opts.lane) next = next.filter(([a, b]) => a === 0 || a === ns.length - 1 || b === 0 || b === ew.length - 1);
        const fwd = next.filter(([a, b]) => !prev || a !== prev[0] || b !== prev[1]);
        const [a, b] = pick(fwd.length ? fwd : next);
        prev = [i, j]; i = a; j = b;
        // Keep right: offset across the direction of travel.
        const dx = ns[i].c - p.pos.x, dz = ew[j].c - p.pos.z, d = Math.hypot(dx, dz) || 1;
        tx = ns[i].c + (-dz / d) * side; tz = ew[j].c + (dx / d) * side;
        if (rng() < 0.08) wait = between(1, 5);   // stop to look at something
      }
    });
  }

  // ------------------------------------------------------------ walkers
  for (let n = 0; n < 200; n++) walker();

  // The main street, from the gate to the market, is the busiest: strollers go up
  // and down it, turning back at random points short of the market's stalls.
  const gateIn = CITY.minX + WALL.thick + 8;
  const mainEnd = MARKET.x - MARKET.r + 2;
  for (let n = 0; n < 70; n++) {
    const side = (rng() < 0.5 ? -1 : 1) * between(0.8, MAIN.width / 2 - 1);
    const x = between(gateIn, mainEnd);
    const p = crowd.add({ x, y: Y, z: MAIN.z + side, color: cloth(), ...machine(), tool: rng() < 0.08 ? 'crate' : null, height: between(0.94, 1.06) });
    let tx = between(gateIn, mainEnd), wait = between(0, 3);
    const speed = WALK * between(0.8, 1.15);
    thinkers.push((dt, t) => {
      if (wait > 0) { wait -= dt; p.bob = 0; return; }
      if (stepTo(p, tx, MAIN.z + side, speed, dt, t)) {
        tx = between(gateIn, mainEnd);
        if (rng() < 0.3) wait = between(1, 4);
      }
    });
  }
  for (let n = 0; n < 12; n++) walker({ tool: 'crate', speed: 1.1 });          // porters
  for (let n = 0; n < 6; n++) walker({ lane: true, color: GUARD, plain: true, helmet: true, tool: 'spear', speed: 1.0 });

  // ------------------------------------------------------------ shoppers
  // They walk the aisle between the stalls and the town hall, round the ring,
  // stopping at a stall to look before moving on to another nearby.
  const AISLE = 8;
  const angleOf = (c) => Math.atan2(c.front.z - MARKET.z, c.front.x - MARKET.x);
  for (let n = 0; n < 24 && COUNTERS.length; n++) {
    let target = pick(COUNTERS);
    let ang = angleOf(target) + between(-0.3, 0.3);
    const r = AISLE + between(-0.8, 0.8);
    const p = crowd.add({ x: MARKET.x + Math.cos(ang) * r, y: CITY.y + 0.09, z: MARKET.z + Math.sin(ang) * r,
      color: cloth(), ...machine(), height: between(0.94, 1.06) });
    let wait = between(0, 6);
    thinkers.push((dt, t) => {
      const goal = angleOf(target);
      let da = Math.atan2(Math.sin(goal - ang), Math.cos(goal - ang));
      if (Math.abs(da) < 0.02) {
        if (wait > 0) { wait -= dt; p.bob = 0; face(p, target.x, target.z); return; }
        target = COUNTERS[(COUNTERS.indexOf(target) + pick([-2, -1, 1, 2]) + COUNTERS.length) % COUNTERS.length];
        wait = between(3, 10);
        return;
      }
      ang += Math.sign(da) * Math.min(Math.abs(da), (WALK * 0.8 * dt) / r);
      const nx = MARKET.x + Math.cos(ang) * r, nz = MARKET.z + Math.sin(ang) * r;
      p.yaw = Math.atan2(nx - p.pos.x, nz - p.pos.z);
      p.pos.x = nx; p.pos.z = nz;
      p.bob = Math.abs(Math.sin(t * 6.5)) * 0.045;
    });
  }

  // ------------------------------------------------------------ standing about
  // Spots on the street edges, out of the way of the walkers.
  const edgeSpot = () => {
    if (rng() < 0.5) {
      const s = pick(ns.slice(1, -1)), z = between(CITY.minZ + 20, CITY.maxZ - 20);
      return { x: s.c + (rng() < 0.5 ? -1 : 1) * (s.w / 2 - 1.0), z };
    }
    const s = pick(ew.slice(1, -1)), x = between(CITY.minX + 20, CITY.maxX - 20);
    return { x, z: s.c + (rng() < 0.5 ? -1 : 1) * (s.w / 2 - 1.0) };
  };

  // Little groups chatting, turned to each other, shifting their weight.
  for (let n = 0; n < 16; n++) {
    const { x, z } = edgeSpot();
    if (Math.hypot(x - MARKET.x, z - MARKET.z) < MARKET.r + 3) continue;
    const size = 2 + Math.floor(rng() * 3);
    for (let m = 0; m < size; m++) {
      const a = (m / size) * Math.PI * 2 + rng();
      const p = crowd.add({ x: x + Math.cos(a) * 0.75, y: Y, z: z + Math.sin(a) * 0.75, color: cloth(), ...machine(), height: between(0.94, 1.06) });
      face(p, x, z);
      const base = p.yaw, ph = rng() * 10;
      thinkers.push((dt, t) => {
        p.yaw = base + Math.sin(t * 0.7 + ph) * 0.18;
        p.bob = Math.max(0, Math.sin(t * 0.5 + ph)) * 0.012;
      });
    }
  }

  // Sweepers: a few metres back and forth, the broom going.
  for (let n = 0; n < 7; n++) {
    const { x, z } = edgeSpot();
    const p = crowd.add({ x, y: Y, z, color: cloth(), ...machine(), tool: 'broom' });
    const along = rng() < 0.5, ph = rng() * 10;
    thinkers.push((dt, t) => {
      const o = Math.sin(t * 0.25 + ph) * 3;
      p.pos.x = along ? x + o : x; p.pos.z = along ? z : z + o;
      p.yaw = (along ? Math.PI / 2 : 0) + (Math.cos(t * 0.25 + ph) < 0 ? Math.PI : 0);
      p.lean = 0.18;
      p.toolSwing = 0.35 + Math.sin(t * 3.2 + ph) * 0.35;
    });
  }

  // Smiths at their anvils, hammering.
  const iron = new THREE.MeshStandardMaterial({ color: 0x2e3033, roughness: 0.45, metalness: 0.85 });
  for (let n = 0; n < 6; n++) {
    const { x, z } = edgeSpot();
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.3), iron);
    anvil.position.set(x, Y + 0.275, z + 0.75);
    anvil.castShadow = true;
    group.add(anvil);
    const p = crowd.add({ x, y: Y, z, color: pick([0x4a3a2e, 0x3d3a36]), ...machine(), tool: 'hammer' });
    p.yaw = 0;
    shopkeeper(p, 'blacksmith');
    const ph = rng() * 10;
    thinkers.push((dt, t) => {
      const c = (t * 1.4 + ph) % 1;               // raise slowly, strike fast
      p.toolSwing = c < 0.75 ? (c / 0.75) * 1.6 : 1.6 * (1 - (c - 0.75) / 0.25);
      p.lean = 0.12 + p.toolSwing * 0.04;
    });
  }

  // The general store, the librarian and the carpenter, each by a street.
  for (const [shop, color, tool] of [['general', 0x7a5a3a, null], ['general', 0x6a5040, 'crate'],
    ['librarian', 0x3f4f5f, null], ['carpenter', 0x6d4e3a, 'hammer']]) {
    const { x, z } = edgeSpot();
    const p = crowd.add({ x, y: Y, z, color, ...machine(), tool });
    face(p, x + 1, z);
    shopkeeper(p, shop);
  }

  // Gate guards: two outside, two inside, looking down the road.
  const gx = CITY.minX + WALL.thick / 2, gz = WALL.gateZ;
  for (const [dx, dz, yaw] of [[-12, -5.5, -Math.PI / 2], [-12, 5.5, -Math.PI / 2], [6, -4, Math.PI / 2], [6, 4, Math.PI / 2]]) {
    const p = crowd.add({ x: gx + dx, y: Y, z: gz + dz, yaw, color: GUARD, helmet: true, tool: 'spear', height: 1.04 });
    const base = yaw, ph = rng() * 10;
    thinkers.push((dt, t) => { p.yaw = base + Math.sin(t * 0.15 + ph) * 0.35; });
  }

  const centre = new THREE.Vector3((CITY.minX + CITY.maxX) / 2, 0, (CITY.minZ + CITY.maxZ) / 2);
  return { ...crowdRunner(crowd, thinkers, centre, 600), shops };
}

// ----------------------------------------------------------------- Farmville

export function buildFarmFolk(group, renderer, heightAt) {
  const crowd = createCrowd(group, renderer);
  const { x: fx, z: fz } = PLACES.farmville;
  const thinkers = [];
  const cloth = () => pick([0x7a6a52, 0x6b5a48, 0x8a7458, 0x5a4a3a, 0x6d6040]);

  // Farmers hoeing the field: bend, chop, straighten, shuffle along the row.
  for (let n = 0; n < 6; n++) {
    const x0 = fx - 15 + n * 6, z = fz + 31 + between(-5, 5);
    const p = crowd.add({ x: x0, y: heightAt(x0, z), z, yaw: Math.PI / 2, color: cloth(), tool: 'hoe' });
    const ph = rng() * 10;
    thinkers.push((dt, t) => {
      const c = (t * 0.8 + ph) % 1;
      p.toolSwing = c < 0.6 ? (c / 0.6) * 1.1 : 1.1 * (1 - (c - 0.6) / 0.4);
      p.lean = 0.25 + (1.1 - p.toolSwing) * 0.15;
      p.pos.x = x0 + ((t * 0.08 + ph) % 6);
      p.pos.y = heightAt(p.pos.x, z);
    });
  }

  // Two by the well, talking.
  for (const a of [0, Math.PI]) {
    const x = fx - 12 + Math.cos(a) * 1.9, z = fz - 14 + Math.sin(a) * 1.9;
    const p = crowd.add({ x, y: heightAt(x, z), z, color: cloth() });
    face(p, fx - 12, fz - 14);
    const base = p.yaw, ph = rng() * 10;
    thinkers.push((dt, t) => { p.yaw = base + Math.sin(t * 0.6 + ph) * 0.2; });
  }

  // Villagers walking a loop between the houses, one carrying a crate.
  // (Clear of the well at (-12, -14) and of the house fronts at about ±22.)
  const loop = [[-18, -36], [-18, 8], [18, 8], [18, -36]];
  for (let n = 0; n < 4; n++) {
    let k = n % loop.length;
    const [sx, sz] = loop[k];
    const p = crowd.add({ x: fx + sx, y: heightAt(fx + sx, fz + sz), z: fz + sz, color: cloth(), tool: n === 0 ? 'crate' : null });
    thinkers.push((dt, t) => {
      const [lx, lz] = loop[(k + 1) % loop.length];
      if (stepTo(p, fx + lx, fz + lz, 1.1, dt, t + n)) k = (k + 1) % loop.length;
      p.pos.y = heightAt(p.pos.x, p.pos.z);
    });
  }

  // Farmville's general store keeper, by the well.
  const keeper = crowd.add({ x: fx - 9, y: heightAt(fx - 9, fz - 14), z: fz - 14, color: 0x7a5a3a });
  face(keeper, fx - 12, fz - 14);
  const shops = [{ pos: keeper.pos, reach: 2.6, label: 'trade with the general store', use() { trade.openShop(SHOPS.general); } }];
  return { ...crowdRunner(crowd, thinkers, new THREE.Vector3(fx, 0, fz), 350), shops };
}

// Runs a crowd only while the player is near enough to see it.
function crowdRunner(crowd, thinkers, centre, range) {
  let t = 0;
  crowd.update();
  return {
    update(dt, playerPos) {
      const near = Math.hypot(playerPos.x - centre.x, playerPos.z - centre.z) < range;
      crowd.setVisible(near);
      if (!near) return;
      t += dt;
      for (const think of thinkers) think(dt, t);
      crowd.update();
    },
  };
}
