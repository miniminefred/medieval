import * as THREE from 'three';

// Real grass: a procedural ground texture plus a field of instanced grass blades
// that follows the player.
//
// The blades are one tiny tapered geometry drawn as a single InstancedMesh, so
// tens of thousands of them cost one draw call. Wind lives entirely in the vertex
// shader (injected with onBeforeCompile); the CPU only ever wraps blades that
// have fallen off the edge of the patch around to the far side, a few hundred
// per frame, which is what makes the field feel endless without the instance
// count ever growing.

const SEED = 0x5eed1eaf;

const MAX_BLADES = 130000;  // hard ceiling — one draw call, ~650k tris, still 60 fps
const CLUMP = 4;            // blades per tuft — clumps read far denser than a scatter
const CLUMP_SPREAD = 0.32;  // metres across a tuft
const RECYCLE_BUDGET = 1400; // tufts re-tested per frame — a full sweep of the
                             // field takes ~0.4 s, so walking out of the village
                             // fills the bare ground back in without a visible lag

const TAU = Math.PI * 2;

// Deterministic RNG so the field looks identical on every reload.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------- ground cover

// Value noise sampled from a wrapping grid, so the texture tiles seamlessly.
function noiseSampler(rng, n) {
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const at = (x, y) => g[(((y % n) + n) % n) * n + (((x % n) + n) % n)];
  return (u, v) => {
    const x = u * n, y = v * n;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

// Patchy grass-over-dirt: broad patches of colour, finer mottling, fine speckle.
function createGroundTexture(size = 512) {
  const rng = mulberry32(SEED ^ 0x9e3779b9);
  const patch = noiseSampler(rng, 8);
  const detail = noiseSampler(rng, 32);

  const DIRT = [0x6d, 0x5c, 0x3f];
  const DARK = [0x3d, 0x54, 0x27];
  const LIGHT = [0x77, 0x92, 0x48];

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const image = canvas.getContext('2d').createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const p = patch(u, v);
      const d = detail(u, v);

      // Below the threshold we are on bare earth, above it on grass.
      const from = p < 0.34 ? DIRT : DARK;
      const to = p < 0.34 ? DARK : LIGHT;
      const t = p < 0.34 ? p / 0.34 : (p - 0.34) / 0.66;
      const shade = 0.80 + 0.30 * d + (rng() - 0.5) * 0.14;

      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.max(0, Math.min(255, (from[c] + (to[c] - from[c]) * t) * shade));
      }
      data[i + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createGroundMaterial({ repeat = 120 } = {}) {
  const map = createGroundTexture();
  map.repeat.set(repeat, repeat);
  return new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
}

// --------------------------------------------------------------------- blades

// A flat tapered strip, 1 m tall and 1 m wide before instance scaling, with
// `segments` rows so the shader can bend it into a curve. Normals are biased
// towards straight up so blades drink the sky light instead of going black
// edge-on; the double-sided flip is removed in the fragment shader below.
function createBladeGeometry(segments = 3) {
  const positions = [];
  const normals = [];
  const indices = [];
  const n = new THREE.Vector3(0, 0.86, 0.51).normalize();

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const w = 0.5 * (1 - t * 0.85);   // taper towards the tip
    positions.push(-w, t, 0, w, t, 0);
    normals.push(n.x, n.y, n.z, n.x, n.y, n.z);
  }
  positions.push(0, 1, 0);            // tip
  normals.push(n.x, n.y, n.z);

  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  indices.push((segments - 1) * 2, (segments - 1) * 2 + 1, segments * 2);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function createBladeMaterial(uniforms) {
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,       // per-instance colour does the tinting
    side: THREE.DoubleSide,
    fog: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        const vec2 WIND_DIR = vec2( 0.82, 0.57 );`)
      // Bend after the instance matrix, so a gust pushes every blade the same
      // way in world space regardless of its yaw. The mesh sits at the origin,
      // so instance space is world space.
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 bladeBase = instanceMatrix[ 3 ].xyz;
          float bladeHeight = length( instanceMatrix[ 1 ].xyz );
          float t = clamp( transformed.y, 0.0, 1.0 );  // 0 at the root, 1 at the tip
          float gust = sin( bladeBase.x * 0.11 + bladeBase.z * 0.07 + uTime * 0.9 )
                     + 0.45 * sin( bladeBase.x * 0.43 - bladeBase.z * 0.37 + uTime * 2.4 );
          mvPosition.xz += WIND_DIR * ( 0.55 + 0.45 * gust ) * 0.34 * bladeHeight * t * t;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);

    // Light both faces the same way — otherwise half the blades face away from
    // the sun and read as black slivers.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
        vec3 normal = normalize( vNormal );
        vec3 nonPerturbedNormal = normal;`);
  };

  return material;
}

// -------------------------------------------------------------------- the field

export function createGrass(scene, {
  radius = 60,
  density = 12,
  exclude = () => false,
  origin = null,          // where the player starts — the first patch is laid there
} = {}) {
  // The field is a square patch of side 2*half that wraps around the player like
  // a torus. Spreading the blade budget over the full radius would leave grass
  // too thin to read as grass, so the patch shrinks to whatever the budget can
  // fill at the requested density; past its edge — still well inside the fog —
  // the textured ground takes over. The half-side is also kept under
  // radius/sqrt(2) so even a corner blade stays within `radius`.
  const half = Math.min(radius / Math.SQRT2, Math.sqrt(MAX_BLADES / (4 * density)));
  const span = half * 2;
  const clumps = Math.max(1, Math.round(span * span * density / CLUMP));
  const count = clumps * CLUMP;
  const rng = mulberry32(SEED);
  const uniforms = { uTime: { value: 0 } };

  const geometry = createBladeGeometry();
  const material = createBladeMaterial(uniforms);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;   // instances move with the player; the bounds lie
  scene.add(mesh);

  // Bookkeeping is per tuft, not per blade — a tuft's four blades live and die
  // together, which is what keeps them from drifting apart as they recycle.
  const centreX = new Float32Array(clumps);
  const centreZ = new Float32Array(clumps);
  const hidden = new Uint8Array(clumps);

  const dummy = new THREE.Object3D();
  const colour = new THREE.Color();
  const tint = new THREE.Color();
  const DEEP = new THREE.Color(0x3c5a22);
  const PALE = new THREE.Color(0x94ad55);
  const STRAW = new THREE.Color(0xb0a165);

  function blade(i, x, z, base) {
    const height = 0.26 + rng() * 0.34;
    const width = 0.03 + rng() * 0.028;
    dummy.position.set(x, 0, z);      // slight lean on x/z, random yaw on y
    dummy.rotation.set((rng() - 0.5) * 0.32, rng() * TAU, (rng() - 0.5) * 0.32);
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    colour.copy(base).multiplyScalar(0.85 + rng() * 0.3);
    mesh.setColorAt(i, colour);
  }

  function blank(i) {
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  // Plants one tuft around (cx, cz). Blades of a tuft share a base tint but not
  // their exact shade, so a clump still looks like many separate blades.
  function plantClump(c, cx, cz) {
    centreX[c] = cx;
    centreZ[c] = cz;
    hidden[c] = 0;

    if (rng() < 0.09) tint.copy(STRAW).lerp(PALE, rng() * 0.6);
    else tint.copy(DEEP).lerp(PALE, rng());

    for (let k = 0; k < CLUMP; k++) {
      const i = c * CLUMP + k;
      const x = cx + (rng() - 0.5) * CLUMP_SPREAD;
      const z = cz + (rng() - 0.5) * CLUMP_SPREAD;
      if (exclude(x, z)) blank(i);
      else blade(i, x, z, tint);
    }
  }

  function hideClump(c, cx, cz) {
    centreX[c] = cx;
    centreZ[c] = cz;
    hidden[c] = 1;
    for (let k = 0; k < CLUMP; k++) blank(c * CLUMP + k);
  }

  // Wrap a tuft that has fallen off one edge of the patch round to the opposite
  // edge, a whole span away. Because it is a straight modulo the scatter stays
  // exactly as uniform as it started, however far or however abruptly the player
  // moves — no thinning, no clustering at the rim.
  // Returns whether it actually touched any instance data, so a patch full of
  // tufts parked on excluded ground doesn't re-upload the buffers every frame.
  function recycle(c, px, pz) {
    const x = centreX[c] - span * Math.round((centreX[c] - px) / span);
    const z = centreZ[c] - span * Math.round((centreZ[c] - pz) / span);
    if (hidden[c] && x === centreX[c] && z === centreZ[c]) return false;
    if (exclude(x, z)) hideClump(c, x, z);   // retried once the wrap moves it
    else plantClump(c, x, z);
    return true;
  }

  // Initial patch, laid straight around where the player will be standing. Wrapping
  // it there afterwards would also work, but it takes a fraction of a second and the
  // player would watch the grass grow in around them on the first frames.
  const ox = origin ? origin.x : 0;
  const oz = origin ? origin.z : 0;
  for (let c = 0; c < clumps; c++) {
    const x = ox + (rng() * 2 - 1) * half;
    const z = oz + (rng() * 2 - 1) * half;
    if (exclude(x, z)) hideClump(c, x, z);
    else plantClump(c, x, z);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  let cursor = 0;

  return {
    mesh,

    // Call every frame with the player's world position.
    update(dt, playerPosition) {
      uniforms.uTime.value += dt;
      if (!playerPosition) return;

      const px = playerPosition.x;
      const pz = playerPosition.z;
      let moved = false;

      for (let n = 0; n < RECYCLE_BUDGET; n++) {
        const c = cursor;
        cursor = (cursor + 1) % clumps;
        if (hidden[c] || Math.abs(centreX[c] - px) > half || Math.abs(centreZ[c] - pz) > half) {
          moved = recycle(c, px, pz) || moved;
        }
      }

      if (moved) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },

    dispose() {
      scene.remove(mesh);
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
