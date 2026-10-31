import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Scorpions (docs/DESIGN.md): small like real ones, poisonous, in flocks, nesting
// in old ruins. Each nest is a mound with a flock round it. They skitter about
// the nest until you come near; then they run at you in darting zigzags and
// sting — a little damage, and poison that keeps hurting for a few seconds.
// One blow of a sword kills one. White ones live in the snow.
//
// Every scorpion in the world is one instance of one mesh: a body, eight legs,
// two pincers and a curled tail with its sting, merged and drawn in one call.

const SIGHT = 11;
const RUN = 5.0;
const HP = 10;

function scorpionGeometry() {
  const parts = [];
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz);
    geo.translate(x, y, z);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
    parts.push(geo.index ? geo.toNonIndexed() : geo);
  };
  // Body: head-chest and a segmented back, low to the ground, facing +z.
  add(new THREE.SphereGeometry(0.07, 10, 8).scale(1, 0.5, 1.2), 0, 0.07, 0.08);
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.065 - i * 0.004, 10, 8).scale(1.05, 0.5, 0.8), 0, 0.075, -0.02 - i * 0.055);
  // Legs: four a side, splayed out and down.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      add(new THREE.CylinderGeometry(0.008, 0.006, 0.13, 5), s * 0.09, 0.05, 0.06 - i * 0.05, 0, 0, s * 1.0);
    }
    // Pincers: an arm forward and a claw.
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.11, 5), s * 0.07, 0.07, 0.17, Math.PI / 2, 0, 0);
    add(new THREE.SphereGeometry(0.03, 8, 6).scale(0.8, 0.6, 1.4), s * 0.075, 0.07, 0.25);
  }
  // Tail: segments curling up and over the back, then the sting.
  let ty = 0.09, tz = -0.24, a = 0.3;
  for (let i = 0; i < 5; i++) {
    add(new THREE.SphereGeometry(0.026 - i * 0.002, 8, 6), 0, ty, tz);
    tz -= Math.cos(a) * 0.045; ty += Math.sin(a) * 0.045;
    a += 0.55;
  }
  add(new THREE.ConeGeometry(0.014, 0.06, 6), 0, ty, tz + 0.02, -2.4, 0, 0);
  return mergeGeometries(parts);
}

// nests: [{ x, z, count, snow }]
export function createScorpions(group, heightAt, nests, rng) {
  const total = nests.reduce((n, s) => n + s.count, 0);
  const mesh = new THREE.InstancedMesh(scorpionGeometry(),
    new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 }), total);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);

  const mounds = new THREE.MeshStandardMaterial({ color: 0x6d5a42, roughness: 1 });
  const all = [];
  const color = new THREE.Color();
  for (const nest of nests) {
    const ny = heightAt(nest.x, nest.z);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mounds);
    mound.scale.y = 0.45;
    mound.position.set(nest.x, ny - 0.05, nest.z);
    mound.receiveShadow = true;
    group.add(mound);
    for (let i = 0; i < nest.count; i++) {
      const a = rng() * Math.PI * 2, r = 1.5 + rng() * 3;
      const s = {
        pos: new THREE.Vector3(nest.x + Math.cos(a) * r, ny, nest.z + Math.sin(a) * r),
        alive: true, hp: HP, nest, yaw: rng() * 6.3, mode: 'idle',
        wander: 0, target: null, cool: rng(), zig: rng() * 10, flip: 0, scale: 0.9 + rng() * 0.6,
        hit(damage) {
          s.hp -= damage;
          if (s.hp <= 0) { s.alive = false; s.mode = 'dead'; }
          else s.mode = 'chase';
        },
      };
      color.set(nest.snow ? 0xe9eef2 : (rng() < 0.5 ? 0x2a1d14 : 0x4a3220));
      mesh.setColorAt(all.length, color);
      all.push(s);
    }
  }
  mesh.instanceColor.needsUpdate = true;

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const _p = new THREE.Vector3(), _s = new THREE.Vector3();
  let t = 0;

  return {
    all,
    arm(combat) { for (const s of all) combat.register(s); },
    update(dt, playerPos, combat, near) {
      if (!near) return;
      t += dt;
      all.forEach((s, i) => {
        if (s.mode === 'dead') {
          s.flip = Math.min(1, s.flip + dt * 4);
        } else {
          const dx = playerPos.x - s.pos.x, dz = playerPos.z - s.pos.z, d = Math.hypot(dx, dz);
          if (s.mode === 'idle') {
            // Skitter about the nest in short dashes.
            s.wander -= dt;
            if (s.wander <= 0) {
              const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 4;
              s.target = { x: s.nest.x + Math.cos(a) * r, z: s.nest.z + Math.sin(a) * r };
              s.wander = 1 + Math.random() * 3;
            }
            if (s.target) {
              const tx = s.target.x - s.pos.x, tz = s.target.z - s.pos.z, td = Math.hypot(tx, tz);
              if (td > 0.1) {
                const step = Math.min(td, 1.6 * dt);
                s.pos.x += (tx / td) * step; s.pos.z += (tz / td) * step;
                s.yaw = Math.atan2(tx, tz);
              }
            }
            if (d < SIGHT) s.mode = 'chase';
          } else if (s.mode === 'chase') {
            if (d > SIGHT * 2.5) { s.mode = 'idle'; }
            else if (d > 0.75) {
              // Dart at you, weaving.
              const side = Math.sin(t * 7 + s.zig) * 0.6;
              const nx = dx / d, nz = dz / d;
              const mx = nx - nz * side, mz = nz + nx * side, ml = Math.hypot(mx, mz);
              s.pos.x += (mx / ml) * RUN * dt; s.pos.z += (mz / ml) * RUN * dt;
              s.yaw = Math.atan2(dx, dz);
            } else {
              s.yaw = Math.atan2(dx, dz);
              s.cool -= dt;
              if (s.cool <= 0) {
                s.cool = 1.2;
                combat.hurt(3);
                combat.poison(4, 1.5);
              }
            }
          }
          s.pos.y = heightAt(s.pos.x, s.pos.z);
        }
        _q.setFromEuler(_e.set(0, s.yaw, Math.PI * s.flip, 'YXZ'));
        _m.compose(_p.set(s.pos.x, s.pos.y + 0.12 * s.flip, s.pos.z), _q, _s.setScalar(s.scale));
        mesh.setMatrixAt(i, _m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
