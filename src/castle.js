import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { buildWorld } from './world.js';
import { buildVillage } from './village.js';
import { createGrass } from './grass.js';
import { createPortal } from './portal.js';
import { createClanStands } from './clan-stands.js';
import { currentClan, onClanChosen } from './clans.js';
import { createChest } from './chest.js';

// The intro realm: the castle, its village and the grass around them — where the
// game starts and where you choose your clan, at the four banners across the
// courtyard. The portal in the courtyard to World 1 stays dark until you have.
//
// A realm is built once into its own group and then attached/detached as the
// player travels: `enter` puts it in the scene and sets the sky/fog/exposure it
// wants, `exit` takes it out again. See main.js.

const BASE = import.meta.env?.BASE_URL ?? '/';

// A photographed partly-cloudy sky (Poly Haven): the JPG is what you see, the
// small HDR is what lights the scene. The sunlight comes from where the sun is in
// that photo, so shadows fall the way the sky says they should.
const SKY_JPG = BASE + 'hdri/castle_day.jpg';
const SKY_HDR = BASE + 'hdri/castle_day.hdr';
const SUN_DIR = new THREE.Vector3(0.55, 0.75, 0.35).normalize();
const HAZE = 0xc4cfdc;   // the photo's pale horizon; distant meadow fades into it

export function createCastleRealm(library, renderer) {
  const group = new THREE.Group();
  group.name = 'castle';

  // ----------------------------------------------------------------- light
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  sun.shadow.radius = 3;
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -60;
  cam.right = cam.top = 60;
  cam.near = 1;
  cam.far = 300;
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0xb8cde6, 0x5d6b3a, 0.35));   // sky above, meadow below

  const background = new THREE.TextureLoader().load(SKY_JPG);
  background.mapping = THREE.EquirectangularReflectionMapping;
  background.colorSpace = THREE.SRGBColorSpace;
  let envMap = null;
  let active = null;
  new HDRLoader().load(SKY_HDR, (hdr) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
    if (active) active.environment = envMap;
  });
  const fog = new THREE.FogExp2(HAZE, 0.0055);

  const world = buildWorld(group, library, renderer);
  const village = buildVillage(group, library, renderer);

  // Out in the courtyard's north-east corner, beside the keep, facing the gate.
  const portal = createPortal({
    x: 10, z: -12, yaw: 0, color: 0xff8a3a, target: 'wasteland', active: currentClan() !== null,
  });
  group.add(portal.object);
  onClanChosen(() => portal.setActive(true));

  // The clan banners: a row across the yard between the gate and the keep,
  // facing the gate, leaving the walk up the middle clear.
  const stands = createClanStands(group, [
    { x: -12, z: 15, yaw: 0 }, { x: -6.5, z: 15, yaw: 0 },
    { x: 6.5, z: 15, yaw: 0 }, { x: 12, z: 15, yaw: 0 },
  ], renderer);

  // A starter chest by the keep: a little bread and a few coins for the road.
  const chests = [createChest(group, renderer, { x: 9.5, z: 7.5, yaw: -0.4, gold: 10, items: { bread: 2 } })];

  const colliders = world.colliders.concat(village.colliders, portal.colliders, stands.colliders,
    chests.map((c) => c.collider));

  // Blades follow the player and skip anywhere the village says is built on —
  // roads, the plaza, footprints, the courtyard and the pond. Seeded at the
  // spawn point so the field is already there on the first frame.
  const grass = createGrass(group, {
    radius: 60,
    density: 34,
    exclude: village.isOccupied,
    origin: new THREE.Vector3(0, 0, 36),
  });

  return {
    name: 'castle',
    group,
    world,
    village,
    grass,
    portals: [portal],
    stands,
    interactables: chests,
    // Out on the grass facing the gatehouse; back from a trip, in front of the portal.
    spawn: { x: 0, z: 36, yaw: 0 },
    arrival: { x: 10, z: -9, yaw: Math.PI },

    enter({ scene, renderer, camera, player }) {
      active = scene;
      scene.add(group);
      scene.background = background;
      scene.backgroundIntensity = 1;
      scene.fog = fog;
      scene.environment = envMap;
      scene.environmentIntensity = 0.8;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      camera.far = 1200;
      camera.updateProjectionMatrix();
      player.setWorld({ colliders });
    },

    exit({ scene }) {
      active = null;
      scene.remove(group);
    },

    update(dt, { player, camera }) {
      // Keep the shadow map centred on the player; the sun is effectively infinite.
      const p = player.object.position;
      sun.target.position.copy(p);
      sun.position.copy(p).addScaledVector(SUN_DIR, 150);
      stands.update(dt, camera, player.isLocked);
      grass.update(dt, player.object.position);
      village.update(dt);
      for (const c of chests) c.update(dt);
      portal.update(dt);
    },
  };
}
