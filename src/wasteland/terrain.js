import * as THREE from 'three';
import { createNoise, smoothstep } from '../noise.js';

// The shape of World 1: a 3 km square of wasteland. Desert sand and cracked dry
// earth in the middle, burned patches scattered through it, snowy hills across the
// south (+Z is the bottom of the map), then — all the way round — a band of
// sandstorm and a wall of tall mountains nobody gets over.
//
// Everything is a pure function of (x, z) off one seed. The mesh is built from a
// height grid, and heightAt() interpolates *that grid* the same way the GPU draws
// its triangles, so feet always land exactly on the drawn ground.

export const HALF = 1500;              // the map spans -HALF..HALF on X and Z
const GRID = 640;                      // cells per side (~4.7 m each)
const SPLAT = 768;                     // ground-type texture resolution

export const STORM_START = 1060;       // sandstorm starts thickening here...
export const STORM_FULL = 1190;        // ...and is at its worst from here on
const MOUNTAIN_START = 1230;           // mountains rise from here to the rim
const FOOT_WANDER = 90;                // ...give or take this much
export const MOUNTAIN_NEAREST = MOUNTAIN_START - FOOT_WANDER;
export const WALK_LIMIT = 1320;        // a hard stop well up the mountain foot

export const SPAWN = { x: 0, z: 0 };

// The cyborg city (docs/DESIGN.md): east, just north of the snow line. The land
// inside is levelled to one height, and blends back to the wild over FLATTEN m.
// The east wall stops well short of the storm band, so the city stays in the open.
export const CITY = { minX: 280, maxX: 1000, minZ: 60, maxZ: 520, y: 1.0 };
const FLATTEN = 45;

// 1 inside the city rectangle, falling smoothly to 0 FLATTEN metres outside it.
export function cityMask(x, z) {
  const dx = Math.max(CITY.minX - x, 0, x - CITY.maxX);
  const dz = Math.max(CITY.minZ - z, 0, z - CITY.maxZ);
  return 1 - smoothstep(0, FLATTEN, Math.hypot(dx, dz));
}

const noise = createNoise(1066);
const { fbm, ridged } = noise;

// Distance from the centre on a rounded square (superellipse), so the edge of the
// world follows the map's square shape without sharp corners.
export function edgeAt(x, z) {
  const ax = Math.abs(x) / HALF, az = Math.abs(z) / HALF;
  return Math.pow(ax ** 8 + az ** 8, 1 / 8) * HALF;
}

// 0 inside the map, rising to 1 in the thick of the sandstorm.
export function stormAt(x, z) {
  return smoothstep(STORM_START, STORM_FULL, edgeAt(x, z));
}

// How much of each ground type is at (x, z). The four always sum to 1.
export function biomeAt(x, z) {
  // No snow drifts inside the city: the snow line is just south of its wall.
  const snow = smoothstep(560, 760, z + fbm(x / 380, z / 380, 3) * 140) * (1 - cityMask(x, z));
  const burnRaw = smoothstep(0.12, 0.3, fbm(x / 520 + 31, z / 520 - 17, 4));
  const sandRaw = smoothstep(-0.05, 0.2, fbm(x / 650 - 71, z / 650 + 43, 3));
  const rest = (1 - snow) * (1 - burnRaw);
  return { sand: rest * sandRaw, dry: rest * (1 - sandRaw), burned: burnRaw * (1 - snow), snow };
}

// The analytic height. Only used to build the grid; gameplay asks heightAt().
function shapeAt(x, z) {
  const b = biomeAt(x, z);

  // Long low swells everywhere, with a little surface wobble on top.
  let h = fbm(x / 700, z / 700, 4) * 14 + fbm(x / 160, z / 160, 3) * 2.5;

  // Dunes: parallel ridges, wind-swept so the gentle side is long and the slip
  // face short, bent by noise so they never line up like a ploughed field.
  const ang = 0.6 + fbm(x / 1500, z / 1500, 2) * 0.5;
  const u = (x * Math.cos(ang) + z * Math.sin(ang)) / 55 + fbm(x / 240, z / 240, 3) * 2.2;
  const s = u - Math.floor(u);
  let a = s < 0.72 ? s / 0.72 : (1 - s) / 0.28;
  a = a * a * (3 - 2 * a);
  h += b.sand * a * 7 * (0.6 + 0.4 * fbm(x / 300 + 5, z / 300, 2));

  // Burned land is broken and lumpy.
  h += b.burned * ridged(x / 120, z / 120, 3) * 5;

  // The snowy south climbs into real hills.
  h += b.snow * (ridged(x / 350, z / 350, 4) * 45 + fbm(x / 90, z / 90, 3) * 4);

  // Level ground around the arrival point so the portal stands on something flat.
  const r = Math.hypot(x - SPAWN.x, z - SPAWN.z);
  h *= smoothstep(30, 110, r);

  // The city sits on levelled ground.
  const c = cityMask(x, z);
  h += (CITY.y - h) * c;

  // The mountain wall at the rim. The foot wanders in and out by up to ~90 m and
  // the range swells and sags along its length, so it reads as a real massif with
  // peaks and passes rather than one even wall of spikes.
  const foot = MOUNTAIN_START + fbm(x / 330 + 9, z / 330 - 4, 3) * FOOT_WANDER;
  const m = smoothstep(foot, HALF - 20, edgeAt(x, z));
  const massif = 0.35 + 1.1 * smoothstep(-0.5, 0.6, fbm(x / 520 - 13, z / 520 + 27, 3));
  h += m * m * massif * (160 + ridged(x / 240, z / 240, 6) * 300);

  return h;
}

export function createWastelandTerrain() {
  const n = GRID + 1;
  const cell = (HALF * 2) / GRID;
  const heights = new Float32Array(n * n);

  const positions = new Float32Array(n * n * 3);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x = ix * cell - HALF, z = iz * cell - HALF;
      const h = shapeAt(x, z);
      const i = iz * n + ix;
      heights[i] = h;
      positions[i * 3] = x;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = z;
    }
  }

  // Two triangles per cell, a-b-d and b-c-d, both wound to face up.
  const index = new Uint32Array(GRID * GRID * 6);
  let k = 0;
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const a = iz * n + ix, b = (iz + 1) * n + ix, c = (iz + 1) * n + ix + 1, d = iz * n + ix + 1;
      index[k++] = a; index[k++] = b; index[k++] = d;
      index[k++] = b; index[k++] = c; index[k++] = d;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  // Ground-type weights baked once into RGBA = sand, dry, burned, snow. The shader
  // adds rock on its own wherever the slope is steep.
  const splatData = new Uint8Array(SPLAT * SPLAT * 4);
  for (let j = 0; j < SPLAT; j++) {
    for (let i = 0; i < SPLAT; i++) {
      const x = ((i + 0.5) / SPLAT) * HALF * 2 - HALF;
      const z = ((j + 0.5) / SPLAT) * HALF * 2 - HALF;
      const b = biomeAt(x, z);
      const o = (j * SPLAT + i) * 4;
      splatData[o] = b.sand * 255;
      splatData[o + 1] = b.dry * 255;
      splatData[o + 2] = b.burned * 255;
      splatData[o + 3] = b.snow * 255;
    }
  }
  const splat = new THREE.DataTexture(splatData, SPLAT, SPLAT, THREE.RGBAFormat);
  splat.magFilter = THREE.LinearFilter;
  splat.minFilter = THREE.LinearFilter;
  splat.needsUpdate = true;

  // Height of the drawn surface at (x, z): the same triangle the GPU rasterises.
  function heightAt(x, z) {
    const fx = Math.min(Math.max((x + HALF) / cell, 0), GRID - 1e-6);
    const fz = Math.min(Math.max((z + HALF) / cell, 0), GRID - 1e-6);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const ha = heights[iz * n + ix];
    const hb = heights[(iz + 1) * n + ix];
    const hc = heights[(iz + 1) * n + ix + 1];
    const hd = heights[iz * n + ix + 1];
    if (tx + tz <= 1) return ha + (hd - ha) * tx + (hb - ha) * tz;
    return hc + (hb - hc) * (1 - tx) + (hd - hc) * (1 - tz);
  }

  return { geometry, splat, heightAt };
}
