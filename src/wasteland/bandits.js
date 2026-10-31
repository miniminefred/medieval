import * as THREE from 'three';
import { cityMaterial } from '../builder.js';

// Bandits: hooded, cloaked figures (docs/DESIGN.md — a deep hood with nothing
// but shadow inside hides how hard faces are to make). In camp they sit by the
// fire, stand guard, or walk the edge. When one spots you — or you strike one —
// it **shouts for the others**, and the whole camp comes at you: they chase,
// wind up and strike, and give up only when you have run well clear of their
// camp, walking back to their places. Struck down, they fall and leave a body
// you can search.

let mats = null;
function materials(renderer) {
  if (mats) return mats;
  const hess = cityMaterial('hessian', renderer);
  mats = {
    cloak: new THREE.MeshStandardMaterial({ map: hess.map, normalMap: hess.normalMap, color: 0x5c4b3b, roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0a0907, roughness: 1 }),
    wood: cityMaterial('timber', renderer),
    iron: new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.35, metalness: 0.85 }),
  };
  return mats;
}

let traderMat = null;
function traderCloak(renderer) {
  const linen = cityMaterial('linen', renderer);
  traderMat ??= new THREE.MeshStandardMaterial({ map: linen.map, normalMap: linen.normalMap, color: 0x7d97b8, roughness: 1 });
  return traderMat;
}

// One figure, feet at the group's origin, facing +z. `pose`: 'stand' | 'sit'.
function figure(renderer, pose, rng, trader = false, blade = false) {
  const m = trader ? { ...materials(renderer), cloak: traderCloak(renderer) } : materials(renderer);
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const sit = pose === 'sit';
  const body = sit ? 0.85 : 1.35;
  const base = sit ? 0.42 : 0;           // sitting on a log
  const tall = 0.92 + rng() * 0.16;

  // Cloak, shoulders, hood with the dark inside, and a hood peak.
  add(new THREE.CylinderGeometry(0.2, sit ? 0.5 : 0.44, body, 14), m.cloak, 0, base + body / 2, 0);
  add(new THREE.SphereGeometry(0.3, 14, 10), m.cloak, 0, base + body, 0).scale.set(1.35, 0.7, 1.0);
  add(new THREE.SphereGeometry(0.2, 14, 12), m.cloak, 0, base + body + 0.24, -0.02);
  add(new THREE.ConeGeometry(0.15, 0.3, 12), m.cloak, 0, base + body + 0.42, -0.07).rotation.x = -0.35;
  add(new THREE.SphereGeometry(0.135, 12, 10), m.dark, 0, base + body + 0.22, 0.085);
  // Arms in the cloak's sleeves.
  for (const s of [-1, 1]) {
    const arm = add(new THREE.CylinderGeometry(0.07, 0.09, 0.62, 8), m.cloak, s * 0.33, base + body - 0.3, 0.06);
    arm.rotation.x = sit ? -0.9 : -0.15;
  }
  // Fighting, they draw a short blade.
  if (blade) {
    add(new THREE.BoxGeometry(0.04, 0.55, 0.01), m.iron, 0.36, 1.0, 0.32).rotation.x = -0.9;
  } else if (!sit && rng() < 0.7) {                       // guards carry a spear
    add(new THREE.CylinderGeometry(0.025, 0.03, 2.1, 6), m.wood, 0.36, 1.05, 0.12);
    add(new THREE.ConeGeometry(0.05, 0.22, 6), m.iron, 0.36, 2.2, 0.12);
  }
  g.scale.setScalar(tall);
  return g;
}

const SIGHT = 22, SIGHT_SITTING = 11;
const CHASE_SPEED = 4.6;        // a little faster than you walk, slower than you run
const GIVE_UP = 110;            // metres from camp at which they stop chasing
const HP = 60;

// A bandit: a figure plus how it behaves. `heightAt` keeps it on the ground.
// `trader: true` dresses the same figure in a merchant's blue and leaves off the
// spear (and it never fights). `camp` makes it a fighter (camps.js).
export function createBandit(parent, renderer, rng, { x, z, yaw = 0, pose = 'stand', patrol = null, heightAt, trader = false, camp = null }) {
  let g = figure(renderer, pose, trader ? () => 0.99 : rng, trader);
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = yaw;
  parent.add(g);

  let t = rng() * 100;
  const breathe = 0.6 + rng() * 0.3;
  const home = { x, z, yaw };
  let sitting = pose === 'sit';
  let mode = 'calm';            // calm | alerted | chase | attack | return | dead
  let wait = 0, wind = 0, cool = 0, fall = 0, hp = HP;

  const self = {
    object: g,
    pos: g.position,
    alive: true,
    // Bandits are not solid: once they move, a fixed box would be in the wrong place.
    collider: null,
    // Alerted by a shout (or a blow): after a beat, up and at you.
    alert(delay = 0) {
      if (mode === 'calm' || mode === 'return') { mode = 'alerted'; wait = delay; }
    },
    hit(damage, from) {
      if (!self.alive) return;
      hp -= damage;
      // Knocked back a step, away from the blow.
      const dx = g.position.x - from.x, dz = g.position.z - from.z, d = Math.hypot(dx, dz) || 1;
      g.position.x += (dx / d) * 0.6; g.position.z += (dz / d) * 0.6;
      wind = 0; cool = Math.max(cool, 0.5);
      if (mode === 'calm' || mode === 'return') camp?.alert(g.position);
      if (hp <= 0) {
        self.alive = false;
        mode = 'dead';
        camp?.died(self);
      }
    },
    update(dt, ctx) {
      t += dt;
      const p = ctx?.playerPos;
      const here = ctx?.playerHere;
      const dx = p ? p.x - g.position.x : 0, dz = p ? p.z - g.position.z : 0;
      const dist = Math.hypot(dx, dz);

      if (mode === 'dead') {
        // Topple over backward and lie still.
        fall = Math.min(1, fall + dt * 2.2);
        g.rotation.x = -Math.PI / 2 * (1 - (1 - fall) ** 3);
        g.position.y = heightAt(g.position.x, g.position.z) + 0.25 * fall;
        return;
      }

      if (mode === 'calm') {
        if (patrol) {
          // Walk a slow circle round the camp, bobbing with each step.
          const a = patrol.phase + (t * patrol.speed) / patrol.r;
          const px = patrol.cx + Math.cos(a) * patrol.r, pz = patrol.cz + Math.sin(a) * patrol.r;
          g.position.set(px, heightAt(px, pz) + Math.abs(Math.sin(t * 4.2)) * 0.04, pz);
          g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));     // facing along the circle
        } else {
          g.scale.y = g.scale.x * (1 + Math.sin(t * breathe * 2) * 0.008);
        }
        if (camp && here && dist < (sitting ? SIGHT_SITTING : SIGHT)) camp.alert(g.position);
        return;
      }

      if (mode === 'alerted') {
        if (p) g.rotation.y = Math.atan2(dx, dz);
        wait -= dt;
        if (wait > 0) return;
        if (sitting) {
          // Up off the log, blade out.
          const keepPos = g.position.clone(), keepRot = g.rotation.y;
          parent.remove(g);
          g = figure(renderer, 'stand', rng, false, true);
          g.position.copy(keepPos);
          g.position.y = heightAt(keepPos.x, keepPos.z);
          g.rotation.y = keepRot;
          parent.add(g);
          self.object = g;
          self.pos = g.position;
          sitting = false;
        }
        mode = 'chase';
        return;
      }

      // Too far from camp, or you are gone: walk back home.
      const fromCamp = camp ? Math.hypot(g.position.x - camp.x, g.position.z - camp.z) : 0;
      if ((mode === 'chase' || mode === 'attack') && (!here || fromCamp > GIVE_UP)) mode = 'return';

      if (mode === 'return') {
        g.rotation.x = 0;
        const hx = home.x - g.position.x, hz = home.z - g.position.z, hd = Math.hypot(hx, hz);
        if (hd < 0.3) { mode = 'calm'; g.rotation.y = home.yaw; return; }
        const step = Math.min(hd, 2.0 * dt);
        g.position.x += (hx / hd) * step; g.position.z += (hz / hd) * step;
        g.position.y = heightAt(g.position.x, g.position.z) + Math.abs(Math.sin(t * 5)) * 0.04;
        g.rotation.y = Math.atan2(hx, hz);
        return;
      }

      g.rotation.y = Math.atan2(dx, dz);
      cool = Math.max(0, cool - dt);
      if (mode === 'chase') {
        if (dist > 1.5) {
          const step = Math.min(dist - 1.4, CHASE_SPEED * dt);
          g.position.x += (dx / dist) * step; g.position.z += (dz / dist) * step;
          // Keep a little apart from the others, so they come at you from round about.
          for (const o of camp?.members ?? []) {
            if (o === self || !o.alive) continue;
            const ox = g.position.x - o.pos.x, oz = g.position.z - o.pos.z, od = Math.hypot(ox, oz);
            if (od > 0 && od < 1.0) { g.position.x += (ox / od) * (1.0 - od) * 0.5; g.position.z += (oz / od) * (1.0 - od) * 0.5; }
          }
          g.position.y = heightAt(g.position.x, g.position.z) + Math.abs(Math.sin(t * 9)) * 0.06;
          g.rotation.x = -0.12;                   // leaning into the run
        } else if (cool === 0) {
          mode = 'attack'; wind = 0;
        }
        return;
      }

      if (mode === 'attack') {
        // Wind up (rear back), then strike — if you are still in reach.
        wind += dt;
        g.rotation.x = wind < 0.45 ? 0.25 * (wind / 0.45) : -0.35;
        if (wind >= 0.45 && wind - dt < 0.45 && dist < 2.3) ctx.combat.hurt(8 + Math.floor(rng() * 6));
        if (wind > 0.7) { mode = 'chase'; cool = 0.9; g.rotation.x = 0; }
      }
    },
  };
  return self;
}
