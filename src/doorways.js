import * as THREE from 'three';
import { cityMaterial } from './builder.js';
import { createInterior } from './interiors.js';
import { hud } from './hud.js';
import { clock } from './clock.js';

// House doors (docs/DESIGN.md: almost every house can be entered). A door is
// just a door: press E and it swings open where it stands, and you walk into
// the house — no fade, no other world. The house's ground floor is hollow
// (houses.js); the first time a door is opened its rooms are built in place
// inside (interiors.js) and stay built, so a searched cupboard stays searched.
//
// Until then every shut door in a town is one instanced box (one draw call for
// hundreds), with a collider in its doorway. A built house shows its rooms only
// while its door is open or you are inside — through a shut door and stone
// walls there is nothing to see, and a dozen furnished houses would cost
// hundreds of draw calls.
//
// Light: houses have none of their own. A few real lights (a room light, the
// fire, a candle) move to whichever house you are in — adding and removing
// lights would recompile every shader in the scene.
//
// About one door in seven is locked (decided by the house's own seed, so the
// same door is always locked). Lockpicking comes later (docs/DESIGN.md).

let sleepHandler = () => {};

// main.js: what sleeping in a bed does. Called with where to wake: { x, z, yaw }.
export function onSleep(fn) {
  sleepHandler = fn;
}

export function isLocked(door) {
  return door.seed % 7 === 0;
}

const LEAF_W = 1.15, LEAF_H = 2.25, LEAF_T = 0.06;
const SHOW = 60;                      // built rooms are drawn within this, if seen

// `doors`: the kit's door records; `colliders`: the realm's own list (doors and
// rooms add to it). update() is handed the player each frame.
export function createDoorways(doors, renderer, { colliders }) {
  let player = null;
  const seat = { sit: (s) => player?.sit(s) };
  const group = new THREE.Group();
  group.name = 'doorways';

  // ------------------------------------------------ shut doors, all at once
  const leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(LEAF_W, LEAF_H, LEAF_T), cityMaterial('timber', renderer), doors.length);
  leaves.castShadow = leaves.receiveShadow = true;
  group.add(leaves);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3();
  const leafAt = (door) => {
    // The leaf shuts in the doorway at the inner face of the front wall, as
    // interiors.js hangs the real one.
    const lx = door.doorX, lz = door.d / 2 - 0.2 + 0.02;
    const c = Math.cos(door.yaw), s = Math.sin(door.yaw);
    return new THREE.Vector3(door.cx + lx * c + lz * s, door.y + 0.03 + LEAF_H / 2, door.cz - lx * s + lz * c);
  };
  const showLeaf = (i, on) => {
    const d = doors[i];
    q.setFromAxisAngle(up, d.yaw);
    m.compose(on ? leafAt(d) : zero, q, on ? one : zero);
    leaves.setMatrixAt(i, m);
    leaves.instanceMatrix.needsUpdate = true;
  };

  const houses = doors.map((door, i) => {
    showLeaf(i, true);
    // Its doorway stays blocked until the house's own door takes over.
    const p = leafAt(door);
    const along = Math.abs(Math.cos(door.yaw)) > 0.5;
    const hw = along ? LEAF_W / 2 : 0.1, hd = along ? 0.1 : LEAF_W / 2;
    const shut = { minX: p.x - hw, maxX: p.x + hw, minZ: p.z - hd, maxZ: p.z + hd, top: door.y + LEAF_H + 0.03 };
    colliders.push(shut);
    return { door, i, shut, inside: null, shown: false };
  });
  leaves.computeBoundingSphere();

  function build(h) {
    const inside = createInterior(h.door, renderer, { player: seat, onSleep: (at) => sleepHandler(at) });
    h.inside = inside;
    group.add(inside.group);
    colliders.push(...inside.colliders);
    h.shut.top = -1e4;                 // the real door blocks the doorway now
    if (h.door.block) h.door.block.top = -1e4;   // and the rooms upstairs replace the solid block
    showLeaf(h.i, false);
  }

  // One "press E" per door, from outside or in.
  const doorThings = houses.map((h) => ({
    door: h.door,
    pos: new THREE.Vector3(h.door.x, h.door.y + 1.3, h.door.z),
    reach: 2.6,
    get label() {
      if (isLocked(h.door)) return 'try the door';
      return h.inside?.front.open ? 'close the door' : 'open the door';
    },
    use() {
      if (isLocked(h.door)) { hud.toast('The door is locked.'); return; }
      if (!h.inside) build(h);
      h.inside.front.toggle();
    },
  }));

  // ------------------------------------------------- the lights you carry in
  const room = new THREE.PointLight(0xffd8a8, 0, 14, 1.4);
  const fire = new THREE.PointLight(0xff9a4a, 0, 10, 1.6);
  const candle = new THREE.PointLight(0xffb25a, 0, 7, 1.6);
  group.add(room, fire, candle);

  let list = doorThings;
  let t = 0;
  return {
    group,
    get interactables() { return list; },

    update(dt, pl) {
      player = pl;
      const playerPos = pl.object.position;
      t += dt;
      let here = null;
      const things = [doorThings];
      for (const h of houses) {
        const inside = h.inside;
        if (!inside) continue;
        const dx = h.door.x - playerPos.x, dz = h.door.z - playerPos.z;
        const near = dx * dx + dz * dz < SHOW * SHOW;
        const isIn = near && inside.contains(playerPos);
        if (isIn) here = inside;
        const show = near && (isIn || inside.front.open || Math.abs(inside.front.angle) > 0.01);
        inside.group.visible = show;
        if (show || Math.abs(inside.front.angle) > 0.001) inside.update(dt);
        if (show && dx * dx + dz * dz < 30 * 30) things.push(inside.things);
      }
      list = things.length > 1 ? [].concat(...things) : doorThings;

      // The lights go where you are.
      if (here) {
        const { day } = clock.light();
        const L = here.lights;
        room.position.copy(L.room);
        room.intensity = 1.0 + 2 * day;
        fire.position.copy(L.fire);
        fire.intensity = L.burning ? 6 * (1 + Math.sin(t * 11) * 0.1) : 0;
        // The nearest candle (they are on different floors).
        let best = null, bd = Infinity;
        for (const c of L.candles) { const d = c.distanceToSquared(playerPos); if (d < bd) { bd = d; best = c; } }
        if (best) candle.position.copy(best);
        candle.intensity = best ? 2.4 : 0;
        // On an upper floor the room light follows you up.
        if (playerPos.y - here.door.y > 3) room.position.y = playerPos.y + 0.8;
      } else {
        room.intensity = fire.intensity = candle.intensity = 0;
      }
    },
  };
}
