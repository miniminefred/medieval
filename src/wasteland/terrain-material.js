import * as THREE from 'three';

// The ground shader: a MeshStandardMaterial (so it keeps real lighting, shadows,
// fog and the HDRI environment) whose colour, normal and roughness are replaced by
// a blend of five photo-scanned Poly Haven textures.
//
//   splat RGBA  -> sand, dry earth, burned ground, snow   (baked in terrain.js)
//   slope       -> rock, which takes over on anything steep
//   altitude    -> snow caps on the high mountains
//
// Each texture is sampled at its real-world size *and* again ~3.7x larger, mixed,
// which breaks up the visible repeat a single tiled photo would have across 3 km.
// Normals are blended in world space (UDN) and handed to three in view space.

const BASE = (import.meta.env?.BASE_URL ?? '/') + 'textures/';

// Metres one copy of the texture covers on the ground.
const SURFACES = [
  { key: 'sand', size: 10, rough: 0.95, tint: [1.32, 1.08, 0.80] }, // grey beach sand, warmed to desert
  { key: 'dry', size: 4, rough: 0.92, tint: [1.08, 1.0, 0.92] },
  { key: 'burned', size: 2, rough: 0.97, tint: [0.9, 0.86, 0.84] },
  { key: 'snow', size: 3, rough: 0.55, tint: [1.0, 1.0, 1.0] },
  { key: 'rock', size: 12, rough: 0.85, tint: [1.05, 0.95, 0.85] }, // sandstone-ish
];

export function createTerrainMaterial(renderer, splat, half) {
  const loader = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();

  function load(path, srgb) {
    const t = loader.load(BASE + path);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const uniforms = {
    tSplat: { value: splat },
    uHalf: { value: half },
  };
  for (const s of SURFACES) {
    uniforms[`t_${s.key}D`] = { value: load(`${s.key}/diff.jpg`, true) };
    uniforms[`t_${s.key}N`] = { value: load(`${s.key}/nor.jpg`, false) };
  }

  const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);`);

    const samplers = SURFACES.map((s) =>
      `uniform sampler2D t_${s.key}D; uniform sampler2D t_${s.key}N;`).join('\n');

    // One top-down sample per flat surface: colour, normal perturbation, weight.
    const flat = SURFACES.filter((s) => s.key !== 'rock').map((s, i) => `
      if (w[${i}] > 0.002) {
        col += w[${i}] * vec3(${s.tint.join(', ')}) * sampleD(t_${s.key}D, vWPos.xz, ${s.size.toFixed(1)});
        vec2 nn = sampleN(t_${s.key}N, vWPos.xz, ${s.size.toFixed(1)});
        bump += w[${i}] * vec3(nn.x, 0.0, nn.y);
        rough += w[${i}] * ${s.rough.toFixed(2)};
      }`).join('');

    const rock = SURFACES.find((s) => s.key === 'rock');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;
        uniform sampler2D tSplat;
        uniform float uHalf;
        ${samplers}

        // Two scales of the same photo, so the repeat never lines up.
        vec3 sampleD(sampler2D t, vec2 p, float size) {
          vec3 a = texture2D(t, p / size).rgb;
          vec3 b = texture2D(t, p / (size * 3.7) + vec2(0.37, 0.71)).rgb;
          return mix(a, b, 0.4);
        }
        // OpenGL normal map -> tangent-space XY perturbation (u along +X, v along +Z).
        vec2 sampleN(sampler2D t, vec2 p, float size) {
          vec2 a = texture2D(t, p / size).xy * 2.0 - 1.0;
          vec2 b = texture2D(t, p / (size * 3.7) + vec2(0.37, 0.71)).xy * 2.0 - 1.0;
          return mix(a, b, 0.4);
        }`)
      .replace('#include <map_fragment>', `
        vec3 gN = normalize(vWNrm);
        vec4 sp = texture2D(tSplat, vWPos.xz / (2.0 * uHalf) + 0.5);

        // Rock on anything steep; snow caps the high peaks where it can settle.
        float slope = 1.0 - gN.y;
        float rockW = smoothstep(0.22, 0.42, slope);
        float cap = smoothstep(190.0, 260.0, vWPos.y + slope * 60.0) * (1.0 - smoothstep(0.35, 0.6, slope));
        sp.a = max(sp.a, cap);
        sp /= max(sp.r + sp.g + sp.b + sp.a, 1e-3);
        float w[4];
        w[0] = sp.r * (1.0 - rockW); w[1] = sp.g * (1.0 - rockW);
        w[2] = sp.b * (1.0 - rockW); w[3] = sp.a * (1.0 - rockW);

        vec3 col = vec3(0.0);
        vec3 bump = vec3(0.0);
        float rough = 0.0;
        ${flat}

        if (rockW > 0.002) {
          // Cliffs are vertical, so a top-down projection would smear: project
          // the rock from the side instead, blended by which way the face points.
          vec3 an = abs(gN);
          float bx = an.x / max(an.x + an.z, 1e-3);
          float rs = ${rock.size.toFixed(1)};
          vec3 cX = sampleD(t_rockD, vWPos.zy, rs);
          vec3 cZ = sampleD(t_rockD, vWPos.xy, rs);
          vec2 nX = sampleN(t_rockN, vWPos.zy, rs);
          vec2 nZ = sampleN(t_rockN, vWPos.xy, rs);
          col += rockW * vec3(${rock.tint.join(', ')}) * mix(cZ, cX, bx);
          bump += rockW * mix(vec3(nZ.x, nZ.y, 0.0), vec3(0.0, nX.y, nX.x), bx);
          rough += rockW * ${rock.rough.toFixed(2)};
        }

        // Big slow light/dark patches, the way real ground is never one tone.
        float macro = texture2D(t_dryD, vWPos.xz / 900.0).g;
        col *= mix(0.86, 1.14, smoothstep(0.25, 0.6, macro));

        diffuseColor.rgb *= col;
        vec3 terrainN = normalize(gN + bump * 0.9);`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = rough;`)
      .replace('#include <normal_fragment_maps>', `
        normal = normalize((viewMatrix * vec4(terrainN, 0.0)).xyz);`);
  };

  return material;
}
