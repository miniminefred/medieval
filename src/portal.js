import * as THREE from 'three';

// A standing stone ring with a swirling sheet of light in it. Walk into the sheet
// and `isInside` turns true; main.js turns that into a trip to `target`.
//
// The ring faces +Z before `yaw` is applied, and is built standing on y = 0 of
// whatever `baseY` it is given, so it works on the castle's flat ground and on the
// wasteland's terrain alike.

const RADIUS = 1.7;

export function createPortal({ x, z, baseY = 0, yaw = 0, color = 0xff8a3a, target }) {
  const group = new THREE.Group();
  group.position.set(x, baseY, z);
  group.rotation.y = yaw;

  const stone = new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RADIUS, 0.28, 12, 40), stone);
  ring.position.y = RADIUS + 0.35;
  ring.castShadow = true;
  group.add(ring);

  // Two squat plinths it stands on.
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.9), stone);
    foot.position.set(side * (RADIUS - 0.2), 0.3, 0);
    foot.castShadow = true;
    group.add(foot);
  }
  // Sunk well into the ground so it never floats on a slope.
  const base = new THREE.Mesh(new THREE.BoxGeometry(RADIUS * 2 + 1.2, 1.4, 1.4), stone);
  base.position.y = -0.62;
  base.receiveShadow = true;
  group.add(base);

  const uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } };
  const sheet = new THREE.Mesh(
    new THREE.CircleGeometry(RADIUS - 0.12, 48),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          float swirl = sin(a * 5.0 + r * 9.0 - uTime * 3.0) * 0.5 + 0.5;
          float rings = sin(r * 22.0 - uTime * 4.0) * 0.5 + 0.5;
          float glow = (0.35 + 0.65 * swirl * rings) * smoothstep(1.0, 0.75, r);
          glow += smoothstep(0.7, 1.0, r) * smoothstep(1.0, 0.92, r) * 1.5;
          gl_FragColor = vec4(uColor * glow * 1.6, glow);
        }`,
    }),
  );
  sheet.position.y = RADIUS + 0.35;
  group.add(sheet);

  const light = new THREE.PointLight(color, 8, 12, 2);
  light.position.set(0, RADIUS + 0.35, 0.6);
  group.add(light);

  // The two plinths are solid; the opening between them is walk-through.
  const colliders = [-1, 1].map((side) => {
    const lx = side * (RADIUS - 0.2);
    const px = x + lx * Math.cos(yaw), pz = z - lx * Math.sin(yaw);
    return { minX: px - 0.45, maxX: px + 0.45, minZ: pz - 0.45, maxZ: pz + 0.45, top: baseY + 0.6 };
  });

  const center = new THREE.Vector3(x, baseY, z);
  const normal = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const _d = new THREE.Vector3();

  return {
    object: group,
    colliders,
    target,
    update(dt) {
      uniforms.uTime.value += dt;
      light.intensity = 7 + Math.sin(uniforms.uTime.value * 2.3) * 1.2;
    },
    // True once the player's feet are inside the ring's sheet of light.
    isInside(feet) {
      _d.subVectors(feet, center);
      const across = Math.abs(_d.dot(normal));
      _d.y = 0;
      const along = Math.sqrt(Math.max(_d.lengthSq() - across * across, 0));
      return across < 0.5 && along < RADIUS - 0.5 && feet.y < baseY + 2.5;
    },
  };
}
