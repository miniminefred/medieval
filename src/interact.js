import * as THREE from 'three';
import { hud } from './hud.js';

// "Press E" for things in the world: chests, traders… Each realm lists its
// interactables ({ pos, reach, label, use(), done }), and every frame the nearest
// one within reach that the player is looking toward gets the prompt. E uses it.
// (The clan banners in the castle have their own richer panel — clan-stands.js.)

const _look = new THREE.Vector3();
const _to = new THREE.Vector3();

export function createInteraction() {
  let focused = null;

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && focused && !focused.done) {
      focused.use();
      focused = null;
      hud.prompt(null);
    }
  });

  return {
    update(list, camera, locked) {
      let best = null;
      if (locked && list) {
        camera.getWorldDirection(_look);
        let bestScore = 0.6;
        for (const it of list) {
          if (it.done) continue;
          _to.subVectors(it.pos, camera.position);
          const d = _to.length();
          if (d > (it.reach ?? 2.6)) continue;
          const score = _to.normalize().dot(_look) - d * 0.02;
          if (score > bestScore) { bestScore = score; best = it; }
        }
      }
      if (best !== focused) {
        focused = best;
        hud.prompt(best ? `Press <kbd>E</kbd> to ${best.label}` : null);
      }
    },
  };
}
