import * as THREE from 'three';

// House doors as things to use. Realms list a door's interactable among their
// own; what opening one *does* — fading into the house — belongs to main.js,
// which registers it here, so the realms need not know about travelling.
//
// About one door in seven is locked (decided by the house's own seed, so the
// same door is always locked). Lockpicking comes later (docs/DESIGN.md).

let handler = () => {};

export function onDoorOpened(fn) {
  handler = fn;
}

export function isLocked(door) {
  return door.seed % 7 === 0;
}

export function doorInteractable(door) {
  return {
    pos: new THREE.Vector3(door.x, door.y + 1.3, door.z),
    reach: 2.4,
    label: isLocked(door) ? 'try the door' : 'open the door',
    use() { handler(door); },
  };
}
