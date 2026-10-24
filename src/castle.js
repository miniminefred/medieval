import * as THREE from 'three';
import { createLighting } from './scene.js';
import { buildWorld } from './world.js';
import { buildVillage } from './village.js';
import { createGrass } from './grass.js';
import { createPortal } from './portal.js';
import { createClanStands } from './clan-stands.js';
import { currentClan, onClanChosen } from './clans.js';

// The intro realm: the castle, its village and the grass around them — where the
// game starts and where you choose your clan, at the four banners across the
// courtyard. The portal in the courtyard to World 1 stays dark until you have.
//
// A realm is built once into its own group and then attached/detached as the
// player travels: `enter` puts it in the scene and sets the sky/fog/exposure it
// wants, `exit` takes it out again. See main.js.

const SKY = 0xa8b6c4;   // pale overcast, the same colour as the fog

export function createCastleRealm(library) {
  const group = new THREE.Group();
  group.name = 'castle';
  createLighting(group);

  const world = buildWorld(group, library);
  const village = buildVillage(group, library);

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
  ]);

  const colliders = world.colliders.concat(village.colliders, portal.colliders, stands.colliders);

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
    // Out on the grass facing the gatehouse; back from a trip, in front of the portal.
    spawn: { x: 0, z: 36, yaw: 0 },
    arrival: { x: 10, z: -9, yaw: Math.PI },

    enter({ scene, renderer, camera, player }) {
      scene.add(group);
      scene.background = new THREE.Color(SKY);
      scene.fog = new THREE.Fog(SKY, 40, 220);
      scene.environment = null;
      renderer.toneMapping = THREE.NoToneMapping;
      camera.far = 600;
      camera.updateProjectionMatrix();
      player.setWorld({ colliders });
    },

    exit({ scene }) {
      scene.remove(group);
    },

    update(dt, { player, camera }) {
      stands.update(dt, camera, player.isLocked);
      grass.update(dt, player.object.position);
      village.update(dt);
      portal.update(dt);
    },
  };
}
