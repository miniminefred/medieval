import * as THREE from 'three';
import { hud } from './hud.js';

// The magical orb that guides every prince (docs/DESIGN.md): a floating crystal
// sphere with swirling light inside. It follows you, off your shoulder, lagging
// a little like something with weight; it talks in subtitles without stopping the
// game, points the way to whatever you should do next, and opens the castle's
// portal once you have chosen a clan.

const OFFSET = new THREE.Vector3(0.75, 0.15, -1.6);   // camera space: ahead, right, a touch high

export function createOrb() {
  const group = new THREE.Group();

  // The crystal: a clear, glassy shell…
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 40, 28),
    // Plain glass rather than true transmission: transmission renders the scene
    // a second time, and it hid the glowing core behind a grey film.
    new THREE.MeshPhysicalMaterial({
      color: 0xdff1ff, roughness: 0.04, metalness: 0, clearcoat: 1,
      transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 2,
    }),
  );
  shell.renderOrder = 1;
  group.add(shell);

  // …with light swirling inside it: shader bands that turn and drift.
  const uniforms = { uTime: { value: 0 } };
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 32, 24),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main() {
          vP = position;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 p = normalize(vP);
          float a = atan(p.z, p.x);
          float swirl = sin(a * 3.0 + p.y * 7.0 - uTime * 1.7) * 0.5 + 0.5;
          float swirl2 = sin(a * 5.0 - p.y * 4.0 + uTime * 1.1) * 0.5 + 0.5;
          float rim = pow(1.0 - abs(dot(vN, vV)), 2.0);
          vec3 c1 = vec3(0.45, 0.8, 1.0), c2 = vec3(0.85, 0.65, 1.0);
          vec3 col = mix(c1, c2, swirl2) * (0.6 + 1.8 * swirl * swirl2) + rim * vec3(0.6, 0.85, 1.0);
          gl_FragColor = vec4(col * 0.42, 1.0);   // additive: kept low so the swirl, not a white blob, shows
        }`,
    }),
  );
  core.renderOrder = 2;   // drawn after the glass, so the light shows through
  group.add(core);

  // It sheds a little light of its own.
  const light = new THREE.PointLight(0x9fd8ff, 1.4, 5, 2);
  group.add(light);

  // A thin marker in the sky above wherever the orb wants you to go.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 120, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x9fd8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  beam.visible = false;

  const target = new THREE.Vector3();
  const _goal = new THREE.Vector3();
  let t = 0;
  let pointAt = null;      // world position to point toward (or null)
  let parent = null;

  return {
    object: group,
    beam,
    // Re-parent into the current realm's scene (call on travel).
    attach(scene) {
      if (parent) { parent.remove(group); parent.remove(beam); }
      parent = scene;
      scene.add(group, beam);
    },
    say(text, seconds) {
      hud.say(text, seconds);
    },
    // Point the way: the beam stands over `pos` (a Vector3, or null for none).
    point(pos, groundY = 0) {
      pointAt = pos ? pos.clone() : null;
      beam.visible = !!pos;
      if (pos) beam.position.set(pos.x, groundY + 60, pos.z);
    },
    update(dt, camera) {
      t += dt;
      uniforms.uTime.value = t;
      // Off the shoulder in camera space, eased so it trails turns a little.
      _goal.copy(OFFSET).applyQuaternion(camera.quaternion).add(camera.position);
      _goal.y += Math.sin(t * 1.6) * 0.05;
      // When there is somewhere to go, drift a little that way to show it.
      if (pointAt) {
        const dx = pointAt.x - camera.position.x, dz = pointAt.z - camera.position.z;
        const d = Math.hypot(dx, dz) || 1;
        _goal.x += (dx / d) * 0.35;
        _goal.z += (dz / d) * 0.35;
      }
      const k = 1 - Math.exp(-dt * 6);
      if (target.lengthSq() === 0) target.copy(_goal);
      target.lerp(_goal, k);
      group.position.copy(target);
      core.rotation.y += dt * 0.6;
      light.intensity = 1.2 + Math.sin(t * 2.3) * 0.25;
      beam.material.opacity = 0.14 + Math.sin(t * 1.8) * 0.04;
    },
  };
}
