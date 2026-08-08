import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_DIR, MODELS } from './model-table.js';

// Loads the prop GLBs once, normalises each into a reusable prototype, and hands
// out clones. Normalisation (see model-table.js for the knobs) leaves every model
// upright, centred on X/Z, with its base at y = 0 and its stated real-world size —
// so placement code only ever deals in metres and never in per-model fudge factors.

const _box = new THREE.Box3();

export class ModelLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.entries = new Map();   // key -> { proto, size: Vector3 }
  }

  // Loads the given keys (default: everything in the table) in parallel.
  // A model that fails to load is skipped with a console warning rather than
  // taking the whole scene down — the village just misses that prop.
  async load(keys = Object.keys(MODELS)) {
    await Promise.all(keys.map(async (key) => {
      if (this.entries.has(key)) return;
      const spec = MODELS[key];
      if (!spec) throw new Error(`unknown model "${key}" — add it to model-table.js`);
      try {
        const gltf = await this.loader.loadAsync(`${MODEL_DIR}${spec.file ?? `${key}.glb`}`);
        this.entries.set(key, normalize(gltf.scene, spec));
      } catch (err) {
        console.warn(`[models] failed to load ${key}:`, err.message ?? err);
      }
    }));
    return this;
  }

  has(key) {
    return this.entries.has(key);
  }

  // Normalised world-space size of a loaded model, in metres.
  size(key) {
    const e = this.entries.get(key);
    return e ? e.size.clone() : new THREE.Vector3();
  }

  // A fresh instance, ready to position. Geometry and materials are shared with
  // the prototype, so clones are cheap.
  create(key) {
    const e = this.entries.get(key);
    if (!e) return null;
    return e.proto.clone(true);
  }

  // Instance placed on the ground at (x, z), turned `yaw` radians and optionally
  // scaled by `scale` around its base. Returns { object, collider } where the
  // collider is null unless the model is marked solid in the table.
  place(key, x, z, { yaw = 0, scale = 1, y = 0 } = {}) {
    const object = this.create(key);
    if (!object) return { object: null, collider: null };

    object.position.set(x, y, z);
    object.rotation.y = yaw;
    if (scale !== 1) object.scale.multiplyScalar(scale);

    const spec = MODELS[key];
    let collider = null;
    if (spec.solid) {
      // Footprint of the yawed box, tightened by `shrink` — trees especially want
      // a trunk-sized collider, not a canopy-sized one.
      const s = this.size(key).multiplyScalar(scale);
      const c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
      const halfW = (s.x * c + s.z * sn) / 2 * (spec.shrink ?? 1);
      const halfD = (s.x * sn + s.z * c) / 2 * (spec.shrink ?? 1);
      collider = { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD, top: y + s.y * scale };
    }
    return { object, collider };
  }
}

// Rotate → uniform-scale to the target dimension → seat on the origin.
function normalize(scene, spec) {
  const proto = new THREE.Group();
  scene.rotation.y = spec.yaw ?? 0;
  proto.add(scene);

  proto.updateMatrixWorld(true);
  _box.setFromObject(scene);
  const raw = _box.getSize(new THREE.Vector3());
  const measured = spec.fit === 'length' ? Math.max(raw.x, raw.z) : raw.y;
  const factor = measured > 1e-6 ? spec.size / measured : 1;
  scene.scale.setScalar(factor);

  proto.updateMatrixWorld(true);
  _box.setFromObject(scene);
  scene.position.x -= (_box.min.x + _box.max.x) / 2;
  scene.position.z -= (_box.min.z + _box.max.z) / 2;
  scene.position.y -= _box.min.y;

  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // Quaternius packs ship double-sided foliage cards; keeping them double-sided
    // matters for leaves but costs shadow quality on solid geometry, so leave the
    // material's own setting alone and only make sure shadows are on.
  });

  proto.updateMatrixWorld(true);
  return { proto, size: raw.multiplyScalar(factor) };
}
