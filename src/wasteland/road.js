import * as THREE from 'three';
import { ROADS, ROAD_WIDTH } from './places.js';
import { cityMaterial } from '../builder.js';

// The road's surface: a strip laid along each road's samples, following the
// (already levelled) ground. Cobbled where places.js says it is paved, a dirt
// track elsewhere. A short skirt down each edge hides the hairline gap a strip
// floating a few centimetres over the terrain would otherwise show.

const LIFT = 0.1;     // above the ground, clear of its triangles
const SKIRT = 0.35;

function strip(points, heightAt) {
  const pos = [], uv = [], idx = [];
  let along = 0;
  const half = ROAD_WIDTH / 2;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len; tz /= len;
    const nx = -tz, nz = tx;
    if (i > 0) along += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    const lx = p.x + nx * half, lz = p.z + nz * half;
    const rx = p.x - nx * half, rz = p.z - nz * half;
    const ly = heightAt(lx, lz) + LIFT, ry = heightAt(rx, rz) + LIFT;
    // Four vertices per sample: left skirt foot, left edge, right edge, right foot.
    pos.push(lx, ly - SKIRT, lz, lx, ly, lz, rx, ry, rz, rx, ry - SKIRT, rz);
    uv.push(-SKIRT, along, 0, along, ROAD_WIDTH, along, ROAD_WIDTH + SKIRT, along);
    if (i > 0) {
      const o = (i - 1) * 4, n = i * 4;
      for (let k = 0; k < 3; k++) {
        idx.push(o + k, n + k, o + k + 1, o + k + 1, n + k, n + k + 1);   // wound to face up/out
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildRoads(group, renderer, heightAt) {
  for (const road of ROADS) {
    // Split each road into runs of the same surface, overlapping by one sample so
    // the runs meet without a gap.
    let start = 0;
    for (let i = 1; i <= road.length; i++) {
      if (i === road.length || road[i].paved !== road[start].paved) {
        const run = road.slice(start, Math.min(road.length, i + 1));
        if (run.length > 1) {
          const mesh = new THREE.Mesh(strip(run, heightAt), cityMaterial(road[start].paved ? 'cobble' : 'dirtroad', renderer));
          mesh.receiveShadow = true;
          group.add(mesh);
        }
        start = i;
      }
    }
  }
}
