import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createWastelandTerrain, biomeAt, stormAt, edgeAt, HALF, SPAWN, WALK_LIMIT, MOUNTAIN_NEAREST } from './terrain.js';
import { createTerrainMaterial } from './terrain-material.js';
import { createSandstorm } from './sandstorm.js';
import { createSky } from '../sky.js';
import { createPortal } from '../portal.js';
import { buildCity } from './city/index.js';
import { buildRoads } from './road.js';
import { buildCamps } from './camps.js';
import { buildFarmville } from './farmville.js';
import { buildCityFolk, buildFarmFolk } from './townsfolk.js';
import { buildApexCity } from './apex.js';
import { createChest } from '../chest.js';
import { doorInteractable } from '../doorways.js';
import { clock } from '../clock.js';
import { setNight } from '../builder.js';
import { createLamps } from '../lamps.js';
import { CITY } from './terrain.js';
import { MARKET, MAIN } from './city/streets.js';
import { WALL } from './city/wall.js';
import { PLACES } from './places.js';
import { CLANS, currentClan } from '../clans.js';

// World 1 — the Wasteland. See docs/DESIGN.md.
//
// The mood (fog, sky, sunlight, blowing dust) is not one setting but a blend that
// follows the player: warm dust haze over the desert, a grey-brown gloom and ash
// over burned land, cold white light and snow in the south, and at the rim a
// sandstorm so thick you can barely see (a blizzard in the snowy south) — with
// the mountains behind it.

const HDRI = (import.meta.env?.BASE_URL ?? '/') + 'hdri/desert_noon.hdr';
// Afternoon sun in the south-west, so the city gate (which faces west, toward
// where travellers arrive) is lit as you approach it.
const SUN_DIR = new THREE.Vector3(-0.5, 0.68, 0.42).normalize();

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

  // Sky fill above, and the bright sand bouncing warm light up into every shadow.
  const hemi = new THREE.HemisphereLight(0xbfd4ee, 0xcaa77c, 0.9);
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

  // ----------------------------------------------------------------- road
  buildRoads(group, renderer, terrain.heightAt);

  // ----------------------------------------------------------------- city
  const city = buildCity(renderer);
  group.add(city.group);
  let armed = false;

  // ------------------------------------------------- Farmville and the camps
  const farmville = buildFarmville(group, renderer, terrain.heightAt);
  const camps = buildCamps(group, renderer, terrain.heightAt);
  const cityFolk = buildCityFolk(group, renderer);

  // Street lamps: down both sides of the main street from the gate to the market,
  // round the market, and about Farmville's green.
  const lampSpots = [];
  const cy = CITY.y + 0.07;
  for (let x = CITY.minX + WALL.thick + 10; x < MARKET.x - MARKET.r - 3; x += 22) {
    lampSpots.push({ x, y: cy, z: MAIN.z - MAIN.width / 2 + 0.6 }, { x: x + 11, y: cy, z: MAIN.z + MAIN.width / 2 - 0.6 });
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    lampSpots.push({ x: MARKET.x + Math.cos(a) * 17.5, y: CITY.y + 0.09, z: MARKET.z + Math.sin(a) * 17.5 });
  }
  const fv = PLACES.farmville;
  for (const [dx, dz] of [[-9, -18], [9, -18], [-9, 4], [9, 4], [-20, 14], [24, 16]]) {
    const x = fv.x + dx, z = fv.z + dz;
    lampSpots.push({ x, y: terrain.heightAt(x, z), z });
  }
  const lamps = createLamps(group, renderer, lampSpots);
  const farmFolk = buildFarmFolk(group, renderer, terrain.heightAt);
  const apex = buildApexCity(group, renderer, terrain.heightAt);

  // Chests half-buried out in the open desert, for whoever goes looking.
  const desertChests = [
    [-180, -150, 18, { coin: 1 }], [520, 80, 9, { scrap: 2, wire: 1 }], [-720, 520, 14, { gears: 2 }],
    [120, -520, 25, { gem: 1 }], [-560, -620, 11, { cell: 1 }], [760, -120, 16, { coin: 1, scrap: 1 }],
  ].map(([x, z, gold, items]) => createChest(group, renderer, {
    x, z, y: terrain.heightAt(x, z), yaw: x * 0.01, gold, items, half: true,
  }));

  const colliders = portal.colliders.concat(city.colliders, farmville.colliders, camps.colliders, lamps.colliders, apex.colliders,
    desertChests.map((c) => c.collider));

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

  // The time of day on top of the area's mood (clock.js): the sky and fog darken
  // to a deep night blue, warm at dawn and dusk; by night a dim moon does the
  // sun's job, and the nights are really dark (docs/DESIGN.md). Returns the
  // amount of daylight, 0..1.
  const NIGHT_HORIZON = new THREE.Color(0x0a0f1c), NIGHT_ZENITH = new THREE.Color(0x020409);
  const DUSK = new THREE.Color(0xff8a4a), MOON = new THREE.Color(0x8ea4d6);
  const lightDir = new THREE.Vector3(0, 1, 0);
  function applyTime(scene) {
    const { sunDir, moonDir, day, warmth } = clock.light();
    const night = 1 - day;
    const h = sky.uniforms.uHorizon.value, z = sky.uniforms.uZenith.value;
    h.lerp(DUSK, warmth * 0.45 * (1 - fog.density / 0.04)).lerp(NIGHT_HORIZON, night);
    z.lerp(NIGHT_ZENITH, night);
    fog.color.copy(h);
    sky.uniforms.uSunDir.value.copy(sunDir);
    sky.uniforms.uSunStrength.value = day;
    sky.uniforms.uNight.value = night;
    lightDir.copy(day > 0.02 ? sunDir : moonDir);
    sun.intensity = sun.intensity * day + 0.12 * night;
    sun.color.lerp(DUSK, warmth * 0.5).lerp(MOON, night);
    hemi.intensity = 0.9 * (0.03 + 0.97 * day);
    hemi.color.lerp(NIGHT_ZENITH, night);
    scene.environmentIntensity *= 0.03 + 0.97 * day;
    dust.uniforms.uColor.value.multiplyScalar(0.1 + 0.9 * day);
    setNight(night);
    return day;
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

  const staticThings = camps.chests.concat(desertChests, city.traders,
    city.doors.concat(farmville.doors).map(doorInteractable));

  return {
    name: 'wasteland',
    group,
    terrain,
    portals: [portal],
    // Fallen bandits join the list as they fall, so it is read fresh each time.
    get interactables() { return staticThings.concat(camps.bodies); },
    spawn: { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI },   // facing south, away from the portal
    // Each clan's prince arrives at their clan's home (clans.js); without a clan
    // (the F2 dev hop), at the map's centre.
    get arrival() {
      return CLANS[currentClan()]?.home ?? { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI };
    },

    enter(ctx) {
      if (!armed && ctx.combat) { camps.arm(ctx.combat); apex.scorpions.arm(ctx.combat); armed = true; }
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
        colliders,
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

    update(dt, ctx) {
      const { scene, renderer, camera, player } = ctx;
      const p = player.object.position;
      blendTarget(p.x, p.z);
      const k = 1 - Math.exp(-dt * 1.2);
      for (let i = 0; i < mood.length; i++) mood[i] += (target[i] - mood[i]) * k;
      const dustI = applyMood(scene) * (0.15 + 0.85 * applyTime(scene));

      // Keep the shadow map centred on the player; the sun (or moon) is
      // effectively infinite.
      sun.target.position.copy(p);
      sun.position.copy(p).addScaledVector(lightDir, 250);

      camps.update(dt, p, { playerPos: p, playerHere: true, combat: ctx.combat });
      for (const t of city.traders) t.update(dt);
      cityFolk.update(dt, p);
      lamps.update(dt, p);
      farmFolk.update(dt, p);
      apex.update(dt, p, ctx.combat);
      for (const c of desertChests) c.update(dt);

      // FogExp2 has swallowed everything by ~2.2 / density.
      city.update(camera, 2.2 / fog.density);
      sky.update(camera);
      dust.update(dt, camera, dustI, renderer);
      portal.update(dt);
    },
  };
}
