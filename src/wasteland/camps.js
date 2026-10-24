import * as THREE from 'three';
import { CityBuilder } from '../builder.js';
import { mulberry32 } from '../noise.js';
import { CAMPS } from './places.js';
import { createBandit } from './bandits.js';
import { createChest } from '../chest.js';

// The bandit camps of World 1 (places.js): cloth tents round a stone fire ring,
// crates and barrels, a weapon rack, a loot chest — and bandits sitting by the
// fire, standing guard and walking the edge. The big camp (the second mid boss's)
// also has a palisade of sharpened stakes. No fighting yet: the bandits ignore
// you, and their loot is there for the taking (docs/DESIGN.md).
//
// One shared orange light jumps to whichever campfire is nearest, so six fires
// cost one light.

const rng = mulberry32(6060);
const between = (a, b) => a + rng() * (b - a);

const LOOT = ['scrap', 'gears', 'wire', 'cell', 'dagger', 'coin', 'gem'];

function fireMesh() {
  // Two crossed flame cards and an ember glow, additive, flickered in update().
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff8a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const g = new THREE.Group();
  for (const r of [0, Math.PI / 2]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 10, 1, true), mat);
    m.rotation.y = r;
    m.position.y = 0.6;
    g.add(m);
  }
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  ember.scale.y = 0.35;
  ember.position.y = 0.12;
  g.add(ember);
  return g;
}

export function buildCamps(group, renderer, heightAt) {
  const b = new CityBuilder(renderer);
  const bandits = [];
  const chests = [];
  const fires = [];

  for (const camp of CAMPS) {
    const { x: cx, z: cz, big } = camp;
    const y = heightAt(cx, cz);

    // ------------------------------------------------------ the fire
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      b.box('housestone', cx + Math.cos(a) * 0.95, y - 0.05, cz + Math.sin(a) * 0.95, 0.42, 0.3, 0.32, { yaw: -a });
    }
    for (const a of [0.3, 1.9, 3.5]) {
      b.cylinder('timber', cx, y + 0.12, cz, 0.08, 1.3, { yaw: a, roll: Math.PI / 2 });
    }
    const fire = fireMesh();
    fire.position.set(cx, y, cz);
    group.add(fire);
    fires.push({ mesh: fire, pos: new THREE.Vector3(cx, y + 1, cz), t: rng() * 10 });

    // Logs to sit on, round the fire.
    const seats = big ? 4 : 3;
    for (let i = 0; i < seats; i++) {
      const a = (i / seats) * Math.PI * 2 + 0.4;
      b.cylinder('timber', cx + Math.cos(a) * 2.6, y + 0.2, cz + Math.sin(a) * 2.6, 0.22, 1.8, { yaw: -a, pitch: Math.PI / 2 });
    }

    // ------------------------------------------------------ tents
    const tents = big ? 7 : 4;
    for (let i = 0; i < tents; i++) {
      const a = (i / tents) * Math.PI * 2 + between(-0.2, 0.2);
      const r = big ? between(11, 15) : between(7, 9);
      const tx = cx + Math.cos(a) * r, tz = cz + Math.sin(a) * r;
      const ty = heightAt(tx, tz);
      const yaw = Math.atan2(cx - tx, cz - tz) + Math.PI / 2;   // ridge across, open end to the fire
      const cloth = 'hessian';   // patched sacking — bandits do not buy new canvas
      const len = between(3.2, 4.2), wid = between(2.4, 3);
      b.roof(cloth, cloth, tx, ty - 0.05, tz, len, wid, between(1.7, 2.1), { yaw, over: 0.05 });
      b.collider(tx - 1.6, tx + 1.6, tz - 1.6, tz + 1.6, ty + 1.9);
    }

    // ------------------------------------------------------ clutter
    for (let i = 0; i < (big ? 10 : 5); i++) {
      const a = between(0, Math.PI * 2), r = between(4, big ? 10 : 6.5);
      const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r, py = heightAt(px, pz);
      if (rng() < 0.5) b.cylinder('timber', px, py, pz, 0.36, 0.9, { rTop: 0.32, collide: true });
      else b.box('timber', px, py, pz, 0.8, 0.75, 0.8, { yaw: between(0, 1.5), collide: true });
    }
    // A rack of spears.
    const rx = cx + 4.5, rz = cz - 2;
    const ry = heightAt(rx, rz);
    b.box('timber', rx, ry + 1.1, rz, 2.2, 0.1, 0.1);
    for (const s of [-0.8, -0.3, 0.2, 0.7]) {
      // Tilted, so the builder takes y as the centre: lift it half the length.
      b.cylinder('timber', rx + s, ry + 1.05, rz, 0.03, 2.1, { roll: 0.12 });
    }

    // ------------------------------------------------------ palisade (big camp)
    if (big) {
      // Stakes shoulder to shoulder, a solid wall, with one gap for the way in.
      const r = 19, n = Math.round((Math.PI * 2 * r) / 0.3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (Math.abs(Math.sin((a - 0.6) / 2)) < 0.07) continue;      // the way in
        const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r, py = heightAt(px, pz);
        const h = between(2.4, 3.0);
        b.cylinder('timber', px, py - 0.3, pz, 0.15, h, { sides: 7 });
        b.cylinder('timber', px, py - 0.3 + h, pz, 0.15, 0.4, { sides: 7, rTop: 0.01 });
      }
      // One collider per short arc keeps the wall solid without hundreds of boxes.
      for (let i = 0; i < 48; i++) {
        const a = ((i + 0.5) / 48) * Math.PI * 2;
        if (Math.abs(Math.sin((a - 0.6) / 2)) < 0.1) continue;
        const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
        b.collider(px - 1.3, px + 1.3, pz - 1.3, pz + 1.3, heightAt(px, pz) + 2.4);
      }
    }

    // ------------------------------------------------------ loot
    const chx = cx - 3.2, chz = cz + 4.2;
    const items = {};
    for (let i = 0; i < (big ? 4 : 2); i++) {
      const k = LOOT[Math.floor(rng() * LOOT.length)];
      items[k] = (items[k] ?? 0) + 1 + Math.floor(rng() * 2);
    }
    chests.push(createChest(group, renderer, {
      x: chx, y: heightAt(chx, chz), z: chz, yaw: Math.atan2(cx - chx, cz - chz),
      gold: big ? 40 + Math.floor(rng() * 30) : 12 + Math.floor(rng() * 18), items,
    }));

    // ------------------------------------------------------ bandits
    for (let i = 0; i < seats - 1; i++) {        // by the fire, facing it
      const a = (i / seats) * Math.PI * 2 + 0.4;
      const px = cx + Math.cos(a) * 2.6, pz = cz + Math.sin(a) * 2.6;
      bandits.push(createBandit(group, renderer, rng, {
        x: px, z: pz, yaw: Math.atan2(cx - px, cz - pz), pose: 'sit', heightAt,
      }));
    }
    const guards = big ? 3 : 1;
    for (let i = 0; i < guards; i++) {           // standing guard, looking out
      const a = between(0, Math.PI * 2), r = big ? 16 : 10;
      const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
      bandits.push(createBandit(group, renderer, rng, {
        x: px, z: pz, yaw: Math.atan2(px - cx, pz - cz), heightAt,
      }));
    }
    for (let i = 0; i < (big ? 2 : 1); i++) {    // walking the edge
      bandits.push(createBandit(group, renderer, rng, {
        x: cx, z: cz, heightAt,
        patrol: { cx, cz, r: big ? 22 : 13, speed: 1.2, phase: between(0, Math.PI * 2) },
      }));
    }
  }

  b.finish(group);

  const light = new THREE.PointLight(0xff8a3a, 0, 22, 1.6);
  light.castShadow = false;
  group.add(light);

  return {
    colliders: b.colliders
      .concat(bandits.map((x) => x.collider).filter(Boolean))
      .concat(chests.map((c) => c.collider)),
    chests,
    update(dt, playerPos) {
      for (const bd of bandits) bd.update(dt);
      for (const c of chests) c.update(dt);
      let nearest = null, best = 80;
      for (const f of fires) {
        f.t += dt;
        const flick = 1 + Math.sin(f.t * 13) * 0.06 + Math.sin(f.t * 7.3) * 0.05;
        f.mesh.scale.set(1, flick, 1);
        const d = f.pos.distanceTo(playerPos);
        if (d < best) { best = d; nearest = f; }
      }
      if (nearest) {
        light.position.copy(nearest.pos);
        light.intensity = 9 * (1 + Math.sin(nearest.t * 11) * 0.12);
      } else {
        light.intensity = 0;
      }
    },
  };
}
