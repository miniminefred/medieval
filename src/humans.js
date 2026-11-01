import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

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
      lib[kind] = { scene: g.scene, clips, scale: HEIGHT / (box.max.y - box.min.y), floor: box.min.y };
      res();
    }, undefined, () => res());     // a missing model just leaves that kind out
  })));
  return ready;
}

export function hasHumans(kind) { return !!lib[kind]; }

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
  body.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;           // skinned bounds lie once animated
      o.material = Array.isArray(o.material) ? o.material.map((mm) => cyborgMaterial(mm, u)) : cyborgMaterial(o.material, u);
    }
  });

  // Cyborg extras: a red eye on the metal half of the face, a core on the chest.
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), glow(0xff2a1a));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), glow(0x48d8ff));
  core.rotation.x = Math.PI / 2;
  eye.visible = core.visible = false;
  bones.Head?.add(eye);
  bones.Chest?.add(core);
  // Bone space is in the model's own units: undo the clone's scale for the extras.
  const inv = 1 / L.scale;
  eye.scale.setScalar(inv); core.scale.setScalar(inv);
  core.position.set(0, 0.12 * inv, 0.16 * inv);

  const mixer = new THREE.AnimationMixer(body);
  const actions = {};
  for (const [name, clip] of Object.entries(L.clips)) actions[name] = mixer.clipAction(clip);
  if (actions.Death) { actions.Death.setLoop(THREE.LoopOnce, 1); actions.Death.clampWhenFinished = true; }
  let current = null;

  return {
    object: root,
    kind,
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
    update(dt) { mixer.update(dt); },
  };
}
