import * as THREE from 'three';

// Throwing knives (docs/DESIGN.md): thrown three at a time, in a fan. Each one
// flies straight and fast, spinning, drops a little, and strikes the first
// enemy it passes close to — or sticks in the ground and is gone.

const SPEED = 26, GRAVITY = 6, LIFE = 1.4, HIT_R = 0.9, DAMAGE = 18;

export function createKnives(scene) {
  const geo = new THREE.BoxGeometry(0.03, 0.01, 0.26);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.35, metalness: 0.9 });
  const flying = [];
  const _fwd = new THREE.Vector3(), _right = new THREE.Vector3();

  return {
    // Throw a fan of three from the camera.
    throw3(camera, combat) {
      camera.getWorldDirection(_fwd);
      _right.crossVectors(_fwd, camera.up).normalize();
      for (const spread of [-0.09, 0, 0.09]) {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(camera.position).addScaledVector(_fwd, 0.6).addScaledVector(_right, 0.2).add({ x: 0, y: -0.2, z: 0 });
        scene.add(m);
        const v = _fwd.clone().addScaledVector(_right, spread).normalize().multiplyScalar(SPEED);
        flying.push({ m, v, t: 0, combat, from: camera.position.clone() });
      }
    },
    update(dt, groundAt) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const k = flying[i];
        k.t += dt;
        k.v.y -= GRAVITY * dt;
        k.m.position.addScaledVector(k.v, dt);
        k.m.lookAt(k.m.position.clone().add(k.v));
        k.m.rotateX(k.t * 30);
        let hit = null;
        for (const e of k.combat.enemies) {
          if (!e.alive) continue;
          const dx = e.pos.x - k.m.position.x, dz = e.pos.z - k.m.position.z, dy = e.pos.y + 1 - k.m.position.y;
          if (dx * dx + dz * dz < HIT_R * HIT_R && Math.abs(dy) < 1.4) { hit = e; break; }
        }
        if (hit) hit.hit(DAMAGE, k.from);
        if (hit || k.t > LIFE || k.m.position.y < groundAt(k.m.position.x, k.m.position.z)) {
          k.m.parent?.remove(k.m);
          flying.splice(i, 1);
        }
      }
    },
  };
}
