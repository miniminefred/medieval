import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The construction kit for realistic buildings (the cyborg city, the castle).
//
// Everything is boxes and a few custom shapes whose UVs are in *metres*; each
// material's textures repeat once per real-world size of the photo they came
// from, so a stone, a plank or a roof tile is the right size on every surface,
// however big the box.
//
// Pieces are merged into one mesh per material *per chunk* (CHUNK m square), so a
// city of hundreds of houses is a few hundred draw calls, and whole chunks can be
// frustum-culled — or skipped outright when the haze has swallowed them
// (`updateVisibility`).

const BASE = (import.meta.env?.BASE_URL ?? '/') + 'textures/';
const CHUNK = 100;

// Small things (window glass, timber framing, plates) vanish into the haze long
// before the buildings do; beyond this they are not drawn at all.
const DETAIL = new Set(['glass', 'timber', 'steel', 'rust', 'gunmetal']);
const DETAIL_DIST = 160;

// key -> metres one copy of the photo covers (from Poly Haven's dimensions), and
// for metals how metallic to let the ARM map go: fully metallic steel can only
// reflect its surroundings, and under a hazy desert sky that reads as black.
// Entries with `color` instead are plain untextured materials.
const SURFACES = {
  citywall: { size: 2.5 },
  // Riveted panels, 2 m photo. Photographed fairly dark, so lifted a little to
  // read as weathered steel in desert sun.
  steel: { size: 2.0, metal: 0.4, gain: 1.6 },
  tin: { size: 2.7, metal: 0.2, gain: 0.75 },  // corrugated iron roofs; more metal and the sky glare reads as snow
  rust: { size: 1.0, metal: 0.5 },
  plaster: { size: 2.23, tint: 0xe2d6c2 },    // lime plaster, aged and dusty, not paint-white
  timber: { size: 1.8 },
  housestone: { size: 1.52 },
  rooftiles: { size: 2.0 },           // 4 m photo; halved so tiles are not twice life-size
  cobble: { size: 1.0 },
  // Market awnings. The weave is only 0.27 m in the photo; at 0.5 m it still
  // reads as cloth from across the square.
  linen: { size: 0.5 },
  caban: { size: 0.5 },
  hessian: { size: 0.5 },
  meadow: { size: 2.0 },              // leafy grass round the castle
  castlestone: { size: 2.0 },         // the castle's old, weathered walls
  mossystone: { size: 2.0 },          // moss at the foot of them
  dirtroad: { size: 3.0 },            // the castle village's trodden roads
  soil: { size: 2.0 },                // its ploughed field
  mud: { size: 1.3 },                 // the pond's shore
  // The apex city: pelts over frames of giant bones. `tex` borrows another
  // surface's photos (bone is ivory-tinted plaster; burned hide is charred hide).
  hide: { size: 1.0, tint: 0xb59a7c },
  hideburnt: { size: 1.0, tex: 'hide', tint: 0x3a2e26 },
  bone: { size: 1.5, tex: 'plaster', tint: 0xefe4cc },
  // House clutter (furniture.js): pottery, pewter, wax, books, rugs and blankets.
  pottery: { size: 0.6, tex: 'plaster', tint: 0xa8643c },
  rug: { size: 0.6, tex: 'linen', tint: 0x8c3328 },
  blanket: { size: 0.5, tex: 'linen', tint: 0x6a2f3c },
  sheet: { size: 0.5, tex: 'linen', tint: 0xe6dccb },
  pewter: { color: 0x8a8d90, roughness: 0.4, metalness: 0.7 },
  wax: { color: 0xece2c6, roughness: 0.6, metalness: 0 },
  bookred: { color: 0x6e2219, roughness: 0.8, metalness: 0 },
  bookgreen: { color: 0x284a2c, roughness: 0.8, metalness: 0 },
  bookblue: { color: 0x22344f, roughness: 0.8, metalness: 0 },
  bread: { color: 0xb07a3c, roughness: 0.9, metalness: 0 },
  // Old window glass: dark, a little green, reflecting the sky.
  glass: { color: 0x1d2522, roughness: 0.08, metalness: 0.0, envMapIntensity: 1.6 },
  // Machined cyborg parts: blades, barrels, limbs.
  gunmetal: { color: 0x34383c, roughness: 0.32, metalness: 0.9 },
  // The cyan glow of cyborg power cells and screens.
  glow: { color: 0x0b1418, roughness: 0.3, metalness: 0, emissive: 0x3fd8ff, emissiveIntensity: 3.5 },
};

const loader = new THREE.TextureLoader();
const cache = new Map();

// Breaks up the visible repeat of a tiled photo: the colour is blended with a
// mirrored, shifted second sample of itself in irregular world-space patches
// (mirrored, not rotated — stone courses and planks must stay level), and the
// whole surface is lightened and darkened in big slow blotches, the way no real
// wall is one even tone. Colour only — the normal map tiles unseen.
function detile(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vCityW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vCityW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vCityW;
        float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float cityNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(cityHash(i), cityHash(i + vec2(1, 0)), f.x),
                     mix(cityHash(i + vec2(0, 1)), cityHash(i + vec2(1, 1)), f.x), f.y);
        }`)
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          // Along a wall x+z changes, up it y does: one 2D coordinate for any face.
          vec2 wp = vec2(vCityW.x + vCityW.z, vCityW.y + vCityW.z * 0.31);
          vec2 uvB = vec2(-vMapUv.x, vMapUv.y) * 0.93 + vec2(0.43, 0.17);
          float pick = smoothstep(0.4, 0.6, cityNoise(wp * 0.33));
          vec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(map, uvB), pick);
          diffuseColor *= sampledDiffuseColor;
          diffuseColor.rgb *= mix(0.8, 1.15, cityNoise(wp * 0.035 + 7.0));
        #endif`);
  };
}

function tex(path, srgb, repeat, aniso) {
  const t = loader.load(BASE + path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Night: about half of all windows light up, warm, as people light their lamps.
// `setNight(k)` (0 day .. 1 night) drives every window at once; which windows
// are lit is a hash of where each one is, so it never flickers or changes.
export function setNight(k) {
  const glass = cache.get('glass');
  if (glass) glass.emissiveIntensity = k * 1.6;
}

function litWindows(material) {
  material.emissive.set(0xffa04a);
  material.emissiveIntensity = 0;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWinW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWinW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWinW;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 wc = floor(vWinW * vec3(0.8, 0.45, 0.8));
        totalEmissiveRadiance *= step(0.48, fract(sin(dot(wc, vec3(12.9898, 78.233, 37.719))) * 43758.5453));`);
  };
}

// One shared material per surface key.
export function cityMaterial(key, renderer) {
  if (cache.has(key)) return cache.get(key);
  const s = SURFACES[key];
  let m;
  if (s.color !== undefined) {
    m = new THREE.MeshStandardMaterial({
      color: s.color, roughness: s.roughness, metalness: s.metalness, envMapIntensity: s.envMapIntensity ?? 1,
      emissive: s.emissive ?? 0x000000, emissiveIntensity: s.emissiveIntensity ?? 1,
    });
    if (key === 'glass') litWindows(m);
  } else {
    const r = 1 / s.size;
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const dir = s.tex ?? key;
    const arm = tex(`${dir}/arm.jpg`, false, r, aniso);
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(s.tint ?? 0xffffff).multiplyScalar(s.gain ?? 1),
      map: tex(`${dir}/diff.jpg`, true, r, aniso),
      normalMap: tex(`${dir}/nor.jpg`, false, r, aniso),
      aoMap: arm,
      roughnessMap: arm,
      metalnessMap: arm,
      roughness: 1,
      metalness: s.metal ?? 1,   // scaled by the ARM blue channel: only real metal is metal
    });
    detile(m);
  }
  cache.set(key, m);
  return m;
}

// Box UVs rescaled from 0..1 per face to metres. BoxGeometry's faces come in the
// order +x, -x, +y, -y, +z, -z, four vertices each.
function metricBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * spans[f][0], uv.getY(i) * spans[f][1]);
    }
  }
  return g;
}

// A cylinder standing on its axis, UVs in metres: u round the circumference, v up
// the side. (The caps keep a stretched 0..1 mapping; they are small.)
function metricCylinder(rTop, rBottom, h, sides) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, sides);
  const uv = g.attributes.uv;
  const around = Math.PI * (rTop + rBottom);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around, uv.getY(i) * h);
  return g;
}

// A gable roof: a triangular prism, ridge along X, `w` long, `d` deep, `h` tall,
// with `over` metres of eave overhang all round. Sits on y = 0.
function gableRoof(w, d, h, over) {
  const W = w / 2 + over, D = d / 2 + over;
  const slope = Math.hypot(D, h);
  const p = [];
  const uv = [];
  const quad = (a, b, c, e, ua, ub, uc, ue) => {
    p.push(...a, ...b, ...c, ...a, ...c, ...e);
    uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ue);
  };
  // South slope (+z) and north slope (-z); u along the ridge, v down the slope.
  quad([-W, 0, D], [W, 0, D], [W, h, 0], [-W, h, 0], [0, 0], [2 * W, 0], [2 * W, slope], [0, slope]);
  quad([W, 0, -D], [-W, 0, -D], [-W, h, 0], [W, h, 0], [0, 0], [2 * W, 0], [2 * W, slope], [0, slope]);
  // Undersides of the eaves, so the roof is not paper-thin from below.
  quad([-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D], [0, 0], [2 * W, 0], [2 * W, 2 * D], [0, 2 * D]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// The triangular wall under each end of a gable roof (in the wall's material).
function gableEnd(d, h, t) {
  const D = d / 2;
  const shape = new THREE.Shape([new THREE.Vector2(-D, 0), new THREE.Vector2(D, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  g.rotateY(Math.PI / 2);   // the triangle now spans Z, thickness along X
  // Extrude UVs are already in shape units — metres.
  return g;
}

export class CityBuilder {
  constructor(renderer) {
    this.renderer = renderer;
    this.parts = new Map();     // `${chunk}|${material}` -> { chunk, key, geometries[] }
    this.colliders = [];
    this.doors = [];            // front doors of houses built with this kit
    this.chunks = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
  }

  // `long`: the piece is too big to belong to one chunk (a 700 m wall run), so
  // it goes in a chunk that is never culled.
  _add(key, geometry, x, y, z, yaw, roll = 0, long = false, pitch = 0) {
    const chunk = long ? 'always' : `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    const id = `${chunk}|${key}`;
    if (!this.parts.has(id)) this.parts.set(id, { chunk, key, geometries: [] });
    this._q.setFromEuler(this._e.set(pitch, yaw, roll, 'YXZ'));
    this._m.compose(this._p.set(x, y, z), this._q, this._s);
    geometry.applyMatrix4(this._m);
    // Shift UVs by world position so neighbouring boxes do not repeat in step.
    const uv = geometry.attributes.uv;
    const du = (x * 0.37 + z * 0.61) % 7, dv = (z * 0.29 + y) % 5;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
    this.parts.get(id).geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
  }

  // A box standing on y0 (its bottom), centred on (x, z), turned by yaw, tilted
  // by `roll` about its own depth axis (a diagonal brace) or by `pitch` about
  // its width axis (an awning sloping forward).
  // collide: also record an AABB (only for yaw 0 / 90°, which is all walls need).
  box(key, x, y0, z, w, h, d, { yaw = 0, roll = 0, pitch = 0, collide = false } = {}) {
    this._add(key, metricBox(w, h, d), x, y0 + h / 2, z, yaw, roll, Math.max(w, d) > CHUNK / 2, pitch);
    if (collide) {
      const swap = Math.abs(Math.sin(yaw)) > 0.5;
      const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
      this.collider(x - hw, x + hw, z - hd, z + hd, y0 + h);
    }
  }

  // A cylinder standing on y0, radius r (or rTop/rBottom for a taper). With
  // `roll` = π/2 it lies on its side along the local X axis (a barrel on its flank,
  // a pipe) — y0 is then the bottom of its *centre*, so pass the height of the axis.
  cylinder(key, x, y0, z, r, h, { rTop = r, rBottom = r, sides = 14, yaw = 0, roll = 0, pitch = 0, collide = false } = {}) {
    const lying = roll !== 0 || pitch !== 0;
    this._add(key, metricCylinder(rTop, rBottom, h, sides), x, lying ? y0 : y0 + h / 2, z, yaw, roll, false, pitch);
    if (collide) this.collider(x - r, x + r, z - r, z + r, y0 + (lying ? r : h));
  }

  // A flat round slab (a paved square, a plinth top) of radius r and thickness h,
  // standing on y0, with UVs in metres so the texture is life-size across it.
  disc(key, x, y0, z, r, h = 0.2, sides = 64) {
    const g = new THREE.CylinderGeometry(r, r, h, sides);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));   // top-down
    this._add(key, g, x, y0 + h / 2, z, 0, 0, r > CHUNK / 4);
  }

  // A gable roof on top of walls w × d whose tops are at y0; ridge along the
  // walls' local X. Adds the two gable-end triangles in `wallKey`.
  roof(roofKey, wallKey, x, y0, z, w, d, h, { yaw = 0, over = 0.45 } = {}) {
    this._add(roofKey, gableRoof(w, d, h, over), x, y0, z, yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const side of [-1, 1]) {
      const lx = side * (w / 2 - 0.1);
      this._add(wallKey, gableEnd(d, h * 0.98, 0.2), x + lx * c, y0, z - lx * s, yaw);
    }
  }

  // A solid box from the ground (or from `bottom`, for things you can pass under)
  // up to `top`.
  // The shared material for a surface key (for meshes built outside the kit).
  material(key) {
    return cityMaterial(key, this.renderer);
  }

  // A turned rectangle (w along its own x, d along its own z, centred on x, z)
  // as a row of small square boxes along its length. One axis-aligned box round a
  // long thing at an angle would be a big invisible square (the market counters
  // were 3.7 m squares that walled off the aisle).
  turnedCollider(x, z, w, d, yaw, top) {
    const long = Math.max(w, d), short = Math.min(w, d);
    const n = Math.max(1, Math.ceil(long / short));
    const ax = w >= d ? Math.cos(yaw) : Math.sin(yaw), az = w >= d ? -Math.sin(yaw) : Math.cos(yaw);
    const half = short / 2;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const px = x + ax * t * long, pz = z + az * t * long;
      this.collider(px - half, px + half, pz - half, pz + half, top);
    }
  }

  // A round thing (a tower) as a ring of boxes that hug its curve.
  roundCollider(x, z, r, top, pieces = 16) {
    const s = (Math.PI * r) / pieces;   // half the arc each box covers, roughly
    for (let i = 0; i < pieces; i++) {
      const a = (i / pieces) * Math.PI * 2;
      const px = x + Math.cos(a) * (r - s / 2), pz = z + Math.sin(a) * (r - s / 2);
      this.collider(px - s / 2, px + s / 2, pz - s / 2, pz + s / 2, top);
    }
    // And the middle, so nothing slips between the ring's boxes into it.
    const c = r * 0.7;
    this.collider(x - c, x + c, z - c, z + c, top);
  }

  collider(minX, maxX, minZ, maxZ, top, bottom) {
    this.colliders.push(bottom === undefined ? { minX, maxX, minZ, maxZ, top } : { minX, maxX, minZ, maxZ, top, bottom });
  }

  // Merge everything into one mesh per material per chunk, under `group`.
  finish(group) {
    const byChunk = new Map();
    for (const { chunk, key, geometries } of this.parts.values()) {
      const merged = mergeGeometries(geometries.map((g) => {
        // Every piece needs the same attribute set to merge.
        if (!g.attributes.normal) g.computeVertexNormals();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        return g;
      }));
      geometries.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, cityMaterial(key, this.renderer));
      mesh.userData.detail = DETAIL.has(key) && chunk !== 'always';
      mesh.castShadow = key !== 'glass';
      mesh.receiveShadow = true;
      if (!byChunk.has(chunk)) {
        const node = new THREE.Group();
        node.name = `chunk ${chunk}`;
        group.add(node);
        let center = null;
        if (chunk !== 'always') {
          const [cx, cz] = chunk.split(',').map(Number);
          center = new THREE.Vector3((cx + 0.5) * CHUNK, 0, (cz + 0.5) * CHUNK);
        }
        byChunk.set(chunk, { node, center });
      }
      byChunk.get(chunk).node.add(mesh);
    }
    this.chunks.push(...byChunk.values());
    this.parts.clear();
  }

  // Hide chunks entirely farther than `maxDist` (plus the chunk's own reach)
  // from the camera — the haze has already swallowed them.
  updateVisibility(cameraPos, maxDist) {
    const reach = maxDist + CHUNK * 0.75;
    for (const c of this.chunks) {
      if (!c.center) continue;
      const dx = c.center.x - cameraPos.x, dz = c.center.z - cameraPos.z;
      const d2 = dx * dx + dz * dz;
      c.node.visible = d2 < reach * reach;
      const near = Math.sqrt(d2) < DETAIL_DIST + CHUNK * 0.75;
      for (const mesh of c.node.children) if (mesh.userData.detail) mesh.visible = near;
    }
  }
}
