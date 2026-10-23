import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createWastelandTerrain, biomeAt, stormAt, edgeAt, HALF, SPAWN, WALK_LIMIT, MOUNTAIN_NEAREST } from './terrain.js';
import { createTerrainMaterial } from './terrain-material.js';
import { createSandstorm } from './sandstorm.js';
import { createSky } from '../sky.js';
import { createPortal } from '../portal.js';

// World 1 — the Wasteland. See docs/DESIGN.md.
//
// The mood (fog, sky, sunlight, blowing dust) is not one setting but a blend that
// follows the player: warm dust haze over the desert, a grey-brown gloom and ash
// over burned land, cold white light and snow in the south, and at the rim a
// sandstorm so thick you can barely see (a blizzard in the snowy south) — with
// the mountains behind it.

const HDRI = (import.meta.env?.BASE_URL ?? '/') + 'hdri/desert_noon.hdr';
const SUN_DIR = new THREE.Vector3(0.45, 0.72, 0.38).normalize();

// One mood per kind of place. fog = FogExp2 density; dust = sandstorm intensity.
const MOODS = {
  desert: { horizon: 0xd9bb94, zenith: 0x3a78c9, fog: 0.00085, sun: 3.2, sunColor: 0xfff0d8, env: 0.55, dust: 0.08, dustColor: 0xc89a62 },
  burned: { horizon: 0x8d8178, zenith: 0x5f646b, fog: 0.0019, sun: 1.7, sunColor: 0xffd2a8, env: 0.35, dust: 0.3, dustColor: 0x77706a },
  snow: { horizon: 0xdfe5ec, zenith: 0x8ea6bf, fog: 0.0024, sun: 2.0, sunColor: 0xeef3ff, env: 0.6, dust: 0.35, dustColor: 0xf4f7fa },
  blizzard: { horizon: 0xd6dde5, zenith: 0xb9c3cd, fog: 0.04, sun: 0.9, sunColor: 0xf2f6ff, env: 0.45, dust: 1.0, dustColor: 0xffffff },
  storm: { horizon: 0xa9773f, zenith: 0x8b5d32, fog: 0.04, sun: 0.7, sunColor: 0xffc98a, env: 0.25, dust: 1.0, dustColor: 0xb98448 },
};

// Mood as plain numbers so it can be blended.
function moodVec(m) {
  const h = new THREE.Color(m.horizon), z = new THREE.Color(m.zenith);
  const s = new THREE.Color(m.sunColor), d = new THREE.Color(m.dustColor);
  return [h.r, h.g, h.b, z.r, z.g, z.b, m.fog, m.sun, s.r, s.g, s.b, m.env, m.dust, d.r, d.g, d.b];
}
const MOOD_VECS = Object.fromEntries(Object.entries(MOODS).map(([k, m]) => [k, moodVec(m)]));

export function createWastelandRealm(renderer) {
  const group = new THREE.Group();
  group.name = 'wasteland';

  const sky = createSky();
  sky.uniforms.uSunDir.value.copy(SUN_DIR);
  group.add(sky.mesh);

  // ------------------------------------------------------------------ land
  const terrain = createWastelandTerrain();
  const ground = new THREE.Mesh(terrain.geometry, createTerrainMaterial(renderer, terrain.splat, HALF, sky.uniforms));
  ground.receiveShadow = true;
  group.add(ground);

  // ----------------------------------------------------------------- light
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -70;
  cam.right = cam.top = 70;
  cam.near = 1;
  cam.far = 500;
  group.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd4ee, 0x8a6a48, 0.35);
  group.add(hemi);

  // Real sky light from a photographed HDRI, for reflections and soft fill. It
  // streams in after the realm is built; `active` is the context while entered.
  let active = null;
  let envMap = null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  new HDRLoader().load(HDRI, (hdr) => {
    envMap = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
    if (active) active.scene.environment = envMap;
  });


  const dust = createSandstorm();
  group.add(dust.object);

  // --------------------------------------------------------------- portal
  // Back to the castle, standing just north of where you arrive.
  const portalZ = SPAWN.z - 5;
  const portal = createPortal({
    x: SPAWN.x, z: portalZ, baseY: terrain.heightAt(SPAWN.x, portalZ),
    yaw: 0, color: 0x6fb6ff, target: 'castle',
  });
  group.add(portal.object);

  const fog = new THREE.FogExp2(MOODS.desert.horizon, MOODS.desert.fog);
  const mood = MOOD_VECS.desert.slice();
  const target = new Array(mood.length).fill(0);

  function blendTarget(x, z) {
    const b = biomeAt(x, z);
    const storm = stormAt(x, z);
    const calm = 1 - storm;
    const w = {
      desert: (b.sand + b.dry) * calm, burned: b.burned * calm, snow: b.snow * calm,
      // Out at the rim it is a sandstorm — except in the snowy south, a blizzard.
      storm: storm * (1 - b.snow), blizzard: storm * b.snow,
    };
    target.fill(0);
    for (const [k, wk] of Object.entries(w)) {
      if (wk <= 0) continue;
      const v = MOOD_VECS[k];
      for (let i = 0; i < v.length; i++) target[i] += v[i] * wk;
    }
    return storm;
  }

  function applyMood(scene) {
    const [hr, hg, hb, zr, zg, zb, density, sunI, sr, sg, sb, env, dustI, dr, dg, db] = mood;
    fog.color.setRGB(hr, hg, hb);
    // The mountains must never be seen from inside the map: however close the
    // player walks to the rim, the haze thickens so the nearest possible mountain
    // foot is past the point where FogExp2 has swallowed everything (~1.9/density).
    // In the middle that leaves ~1 km of view; by the storm it is the storm.
    const p = active?.player.object.position;
    const toMountain = p ? MOUNTAIN_NEAREST - edgeAt(p.x, p.z) : MOUNTAIN_NEAREST;
    fog.density = Math.max(density, 1.9 / Math.max(toMountain, 45));
    sky.uniforms.uHorizon.value.setRGB(hr, hg, hb);
    sky.uniforms.uZenith.value.setRGB(zr, zg, zb);
    sky.uniforms.uSunColor.value.setRGB(sr, sg, sb);
    sky.uniforms.uHaze.value = Math.min(1, fog.density / 0.03);
    sun.color.setRGB(sr, sg, sb);
    sun.intensity = sunI;
    hemi.color.setRGB(zr, zg, zb);
    scene.environmentIntensity = env;
    dust.uniforms.uColor.value.setRGB(dr, dg, db);
    return dustI;
  }

  return {
    name: 'wasteland',
    group,
    terrain,
    portals: [portal],
    spawn: { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI },   // facing south, away from the portal
    arrival: { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI },

    enter(ctx) {
      const { scene, renderer, camera, player } = ctx;
      active = ctx;
      scene.add(group);
      scene.background = null;     // the sky dome draws the sky
      scene.fog = fog;
      scene.environment = envMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.85;
      camera.far = 6000;
      camera.updateProjectionMatrix();
      player.setWorld({
        colliders: portal.colliders,
        groundAt: terrain.heightAt,
        canStand: (x, z) => edgeAt(x, z) < WALK_LIMIT,
      });
      // Arrive already in the right weather instead of fading into it.
      const p = player.object.position;
      blendTarget(p.x, p.z);
      mood.splice(0, mood.length, ...target);
    },

    exit({ scene }) {
      active = null;
      scene.remove(group);
    },

    update(dt, { scene, renderer, camera, player }) {
      const p = player.object.position;
      blendTarget(p.x, p.z);
      const k = 1 - Math.exp(-dt * 1.2);
      for (let i = 0; i < mood.length; i++) mood[i] += (target[i] - mood[i]) * k;
      const dustI = applyMood(scene);

      // Keep the shadow map centred on the player; the sun is effectively infinite.
      sun.target.position.copy(p);
      sun.position.copy(p).addScaledVector(SUN_DIR, 250);

      sky.update(camera);
      dust.update(dt, camera, dustI, renderer);
      portal.update(dt);
    },
  };
}
