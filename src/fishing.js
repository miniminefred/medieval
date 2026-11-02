import * as THREE from 'three';
import { hud } from './hud.js';
import { inventory, ITEMS } from './inventory.js';

// Fishing (docs/DESIGN.md: the fisherman's pond at the cyborg city's edge).
// Hold the rod and click to cast. If the float lands in water — the realm says
// where with `waterAt(x, z)` — a fish bites after a few seconds; click while it
// is biting to reel it in. Reel in too early, or too late, and it is gone.

const REACH = 4;                 // how far out the float lands (about where the viewmodel draws it)
const BITE_WINDOW = 2.5;         // seconds to strike once a fish bites

export function createFishing(viewmodel) {
  let state = 'idle';            // idle | waiting | biting
  let timer = 0;
  const at = new THREE.Vector3();
  const dir = new THREE.Vector3();

  return {
    // A click with the rod in hand.
    click(camera, realm) {
      const before = viewmodel.phase;
      viewmodel.cast();
      if (before === 'idle') {
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        at.copy(camera.position).addScaledVector(dir, REACH);
        if (realm.waterAt?.(at.x, at.z)) { state = 'waiting'; timer = 3 + Math.random() * 7; }
        else state = 'idle';
        return;
      }
      // Reeling in.
      if (state === 'biting') {
        inventory.addItem('freshfish');
        hud.toast(`You caught a fish! (${ITEMS.freshfish.name})`);
      } else if (state === 'waiting') hud.toast('Nothing yet. Patience.');
      state = 'idle';
    },
    update(dt) {
      if (state === 'idle') return;
      if (viewmodel.phase === 'idle') { state = 'idle'; return; }   // put away, or reeled in
      timer -= dt;
      if (state === 'waiting' && timer <= 0) {
        state = 'biting'; timer = BITE_WINDOW;
        hud.toast('A fish bites! Click to reel it in.', BITE_WINDOW);
      } else if (state === 'biting' && timer <= 0) {
        state = 'waiting'; timer = 4 + Math.random() * 8;
        hud.toast('It got away.');
      }
    },
  };
}
