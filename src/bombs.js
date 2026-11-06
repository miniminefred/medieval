import * as THREE from 'three';

// Things you throw (docs/DESIGN.md, 2026-11-06): a fire bomb, a poison flask, a
// smoke bomb. Hold one and click: it arcs out, and where it lands —
//   fire     bursts into flame: a hard blow to everyone within 4 m
//   poison   leaves a green cloud for 7 s that hurts whoever stands in it
//   smoke    a thick grey cloud for 10 s; bandits within 16 m lose you and go home

const SPEED = 12, GRAVITY = 9.8;
const KIND = {
  fire: { color: 0xff7a22, r: 4, life: 1.2, glow: true },
  poison: { color: 0x6fbf3a, r: 3.5, life: 7 },
  smoke: { color: 0x9a9a96, r: 6, life: 10 },
};

export function createBombs(scene) {
  const flying = [], clouds = [];
  const flask = new THREE.SphereGeometry(0.08, 10, 8);
  const puff = new THREE.SphereGeometry(1, 16, 12);
  const _fwd = new THREE.Vector3();

  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function burst(kind, pos, combat) {
    const k = KIND[kind];
    const mat = new THREE.MeshBasicMaterial({ color: k.color, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: !k.glow });
    const group = new THREE.Group();
    // Many thin, overlapping puffs of different sizes: a soft cloud, not balls.
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(puff, mat);
      const a = i * 2.4, d = k.r * (0.15 + ((i * 37) % 10) / 15);
      m.position.set(Math.cos(a) * d, 0.4 + ((i * 53) % 7) * 0.25, Math.sin(a) * d);
      m.scale.setScalar(k.r * (0.22 + ((i * 29) % 9) / 30));
      group.add(m);
    }
    group.position.copy(pos);
    scene.add(group);
    clouds.push({ kind, k, group, mat, t: 0, tick: 0, combat });
    if (kind === 'fire') for (const e of combat.enemies) if (e.alive && flat(e.pos, pos) < k.r) e.hit(30, pos);
    if (kind === 'smoke') for (const e of combat.enemies) if (e.alive && flat(e.pos, pos) < 16) e.lose?.();
  }

  return {
    throw(kind, camera, combat) {
      camera.getWorldDirection(_fwd);
      const m = new THREE.Mesh(flask, new THREE.MeshStandardMaterial({ color: KIND[kind].color, roughness: 0.2 }));
      m.position.copy(camera.position).addScaledVector(_fwd, 0.6).add({ x: 0.15, y: -0.15, z: 0 });
      scene.add(m);
      const v = _fwd.clone().multiplyScalar(SPEED);
      v.y += 3.5;
      flying.push({ kind, m, v, combat, t: 0 });
    },
    update(dt, groundAt) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.t += dt;
        f.v.y -= GRAVITY * dt;
        f.m.position.addScaledVector(f.v, dt);
        // Bursts on whoever it strikes (measured to their middle, not their feet).
        const hitEnemy = [...f.combat.enemies].some((e) => e.alive && Math.hypot(e.pos.x - f.m.position.x, e.pos.z - f.m.position.z) < 0.9 && Math.abs(e.pos.y + 1 - f.m.position.y) < 1.1);
        const ground = groundAt(f.m.position.x, f.m.position.z);
        if (hitEnemy || f.m.position.y <= ground || f.t > 4) {
          const at = f.m.position.clone();
          at.y = Math.max(at.y, ground);
          scene.remove(f.m);
          flying.splice(i, 1);
          burst(f.kind, at, f.combat);
        }
      }
      for (let i = clouds.length - 1; i >= 0; i--) {
        const c = clouds[i];
        c.t += dt;
        const life = c.k.life;
        // Swell quickly, hang, then thin away.
        const fadeIn = Math.min(1, c.t / 0.25), fadeOut = Math.min(1, (life - c.t) / Math.min(2, life * 0.4));
        c.mat.opacity = Math.max(0, Math.min(fadeIn, fadeOut)) * (c.kind === 'fire' ? 0.5 : 0.22);
        c.group.scale.setScalar(0.6 + 0.4 * Math.min(1, c.t / 0.6));
        c.group.rotation.y += dt * 0.2;
        if (c.kind === 'poison') {
          c.tick += dt;
          if (c.tick >= 1) {
            c.tick -= 1;
            for (const e of c.combat.enemies) if (e.alive && flat(e.pos, c.group.position) < c.k.r) e.hit(8, c.group.position);
          }
        }
        if (c.t >= life) { scene.remove(c.group); c.mat.dispose(); clouds.splice(i, 1); }
      }
    },
  };
}
