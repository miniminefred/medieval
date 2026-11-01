import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Real people (docs/DESIGN.md): rigged, animated CC0 models by Quaternius —
// townsman, townswoman, hooded traveller, farmer — all on one shared 62-bone
// skeleton with the same animations (Idle, Walk, Run, Sword_Slash, Interact,
// HitRecieve, Death…).
//
// `makeHuman(kind)` clones one with its own skeleton, mixer and materials, so
// each can be dressed on its own. Every material carries the **cyborg shader**:
// with `cyborg` on, everything turns to (cartoon-coloured) metal except one arm,
// one leg and half the face — chosen per person — and a red eye glows on the
// metal half, a core on the chest. With it off, a plain human.

const BASE = (import.meta.env?.BASE_URL ?? '/') + 'models/medieval/';
const KINDS = { man: 'person_man', woman: 'person_woman', hooded: 'person_hooded', farmer: 'person_farmer' };
const HEIGHT = 1.78;

// Bone indices in the shared skeleton (the skin's joint order).
const BONES = {
  head: 7, neck: 6,
  armL: [8, 30], armR: [31, 53],        // shoulder .. last finger bone, each side
  legL: [54, 55, 58, 59], legR: [56, 57, 60, 61],
};

const lib = {};
let ready = null;

export function loadHumans() {
  ready ??= Promise.all(Object.entries(KINDS).map(([kind, file]) => new Promise((res) => {
    new GLTFLoader().load(BASE + file + '.glb', (g) => {
      const clips = {};
      for (const c of g.animations) clips[c.name.replace(/.*\|/, '')] = c;
      // Height and feet, measured once in the bind pose.
      const box = new THREE.Box3().setFromObject(g.scene, true);
      mergeParts(g.scene);          // after measuring: the merged mesh has no world matrix yet
      g.scene.updateMatrixWorld(true);
      lib[kind] = { scene: g.scene, clips, scale: HEIGHT / (box.max.y - box.min.y), floor: box.min.y };
      res();
    }, undefined, () => res());     // a missing model just leaves that kind out
  })));
  return ready;
}

export function hasHumans(kind) { return !!lib[kind]; }

// A model arrives as 12–17 skinned parts, one per flat colour — 12–17 draw calls
// a person (and as many again for shadows). They share one skeleton and bind
// pose and have no textures, so each part's colour goes into its vertices and
// they merge into a single skinned mesh: one draw call a person.
function mergeParts(scene) {
  scene.updateMatrixWorld(true);
  const all = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) all.push(o); });
  // Only parts in the same space as the body merge (a backpack can sit in its
  // own scaled node); anything else stays a separate part.
  const key = (o) => o.matrixWorld.elements.map((v) => v.toFixed(4)).join();
  const counts = new Map();
  for (const o of all) counts.set(key(o), (counts.get(key(o)) ?? 0) + 1);
  const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const parts = all.filter((o) => key(o) === main);
  if (parts.length < 2) return;
  const geos = parts.map((o) => {
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    const c = o.material.color ?? new THREE.Color(1, 1, 1);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const first = parts[0];
  const merged = new THREE.SkinnedMesh(mergeGeometries(geos),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }));
  merged.name = 'body';
  merged.bind(first.skeleton, first.bindMatrix);
  first.parent.add(merged);
  merged.position.copy(first.position); merged.quaternion.copy(first.quaternion); merged.scale.copy(first.scale);
  for (const o of parts) o.parent.remove(o);
}

// ------------------------------------------------------------- the cyborg shader

function cyborgMaterial(src, u) {
  const m = src.clone();
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uHumanBones[62];
        uniform float uFaceSide;
        varying float vMetal;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        vMetal = 0.0;
        #ifdef USE_SKINNING
        // How human this vertex is: its bones' human-ness, weighted.
        float human = 0.0;
        human += skinWeight.x * uHumanBones[int(skinIndex.x)];
        human += skinWeight.y * uHumanBones[int(skinIndex.y)];
        human += skinWeight.z * uHumanBones[int(skinIndex.z)];
        human += skinWeight.w * uHumanBones[int(skinIndex.w)];
        // The head is human on one side of the face only.
        float headW = (skinIndex.x == ${BONES.head}.0 ? skinWeight.x : 0.0) + (skinIndex.y == ${BONES.head}.0 ? skinWeight.y : 0.0);
        human = mix(human, step(0.0, position.x * uFaceSide), headW);
        vMetal = 1.0 - clamp(human, 0.0, 1.0);
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uCyborg;
        uniform vec3 uMetal;
        varying float vMetal;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float metalHere = step(0.5, vMetal) * uCyborg;
        diffuseColor.rgb = mix(diffuseColor.rgb, uMetal, metalHere);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.3, metalHere);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.6, metalHere);`);
  };
  m.customProgramCacheKey = () => 'cyborg';
  return m;
}

const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

// One person: { object, setCyborg(opts|null), play(name), update(dt), bone(name) }.
export function makeHuman(kind) {
  const L = lib[kind];
  if (!L) return null;
  const root = new THREE.Group();
  const body = SkeletonUtils.clone(L.scene);
  body.scale.setScalar(L.scale);
  body.position.y = -L.floor * L.scale;
  root.add(body);

  const u = {
    uCyborg: { value: 0 },
    uMetal: { value: new THREE.Color(0x8f969e) },
    uFaceSide: { value: 1 },
    uHumanBones: { value: new Array(62).fill(1) },
  };
  const bones = {};
  const meshes = [];
  body.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;           // skinned bounds lie once animated
      meshes.push(o);
      o.material = Array.isArray(o.material) ? o.material.map((mm) => cyborgMaterial(mm, u)) : cyborgMaterial(o.material, u);
    }
  });

  // Cyborg extras: a red eye on the metal half of the face, a core on the chest.
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), glow(0xff2a1a));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), glow(0x48d8ff));
  core.rotation.x = Math.PI / 2;
  eye.visible = core.visible = false;
  bones.Head?.add(eye);
  bones.Chest?.add(core);
  // Bones carry the model's own scale (and the exporter's): measure how big one
  // metre is in a bone's space, so the extras come out life-size.
  root.updateMatrixWorld(true);
  const inv = bones.Head ? 1 / bones.Head.getWorldScale(new THREE.Vector3()).x : 1 / L.scale;
  eye.scale.setScalar(inv); core.scale.setScalar(inv);
  core.position.set(0, 0.12 * inv, 0.16 * inv);

  const mixer = new THREE.AnimationMixer(body);
  const actions = {};
  for (const [name, clip] of Object.entries(L.clips)) actions[name] = mixer.clipAction(clip);
  if (actions.Death) { actions.Death.setLoop(THREE.LoopOnce, 1); actions.Death.clampWhenFinished = true; }
  let current = null;
  let shadowOn = true;

  return {
    object: root,
    kind,
    // Metres to a bone's local units (for things held in the hand).
    boneScale: inv,
    bone: (name) => bones[name],
    // opts: { metal, core, arm: 'L'|'R', leg: 'L'|'R', face: ±1 } or null for a plain human.
    setCyborg(opts) {
      u.uCyborg.value = opts ? 1 : 0;
      eye.visible = core.visible = !!opts;
      if (!opts) return;
      u.uMetal.value.set(opts.metal);
      core.material.color.set(opts.core);
      const hb = u.uHumanBones.value;
      hb.fill(0);
      const [a0, a1] = opts.arm === 'L' ? BONES.armL : BONES.armR;
      for (let i = a0; i <= a1; i++) hb[i] = 1;
      for (const i of (opts.leg === 'L' ? BONES.legL : BONES.legR)) hb[i] = 1;
      hb[BONES.head] = 0;               // the head is decided per side in the shader
      u.uFaceSide.value = opts.face;
      // The eye sits on the metal side of the face.
      eye.position.set(-opts.face * 0.05 * inv, 0.12 * inv, 0.13 * inv);
    },
    // Cross-fade to an animation (by name), if it is not already playing.
    play(name, fade = 0.25) {
      const next = actions[name] ?? actions.Idle;
      if (!next || next === current) return;
      next.reset().play();
      if (current) next.crossFadeFrom(current, fade, false);
      current = next;
    },
    get playing() { return current; },
    // How much of this person to draw at `dist` metres: nothing beyond 150 m
    // (frustum culling is off for skinned meshes, so far ones would all draw),
    // and shadows only close up — shadows double every draw call.
    setDetail(dist) {
      const show = dist < 150, shadow = dist < 25;
      root.visible = show;
      if (shadow !== shadowOn) { shadowOn = shadow; for (const m of meshes) m.castShadow = shadow; }
    },
    update(dt) { mixer.update(dt); },
  };
}
