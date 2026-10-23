import * as THREE from 'three';
import { mulberry32 } from '../noise.js';

// Wind-blown dust as GPU points. Particles live in a box around the camera and
// wrap (mod) as the wind carries them, so the cloud is endless and stays put in
// the world rather than riding along with the player. `intensity` 0..1 runs from
// a faint drift of grit in the open desert to the wall of sand at the map's rim.

const COUNT = 7000;
const BOX = new THREE.Vector3(140, 46, 140);

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSandstorm() {
  const rand = mulberry32(77);
  const seeds = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    seeds[i * 3] = rand();
    seeds[i * 3 + 1] = Math.pow(rand(), 1.6);   // denser near the ground
    seeds[i * 3 + 2] = rand();
    // Mostly fine grit, some big rolling clouds.
    sizes[i] = rand() < 0.75 ? 0.15 + rand() * 0.35 : 4 + rand() * 9;
  }
  const geometry = new THREE.BufferGeometry();
  // Positions are computed in the shader; this attribute only feeds the seeds.
  geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const uniforms = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uBox: { value: BOX.clone() },
    uWind: { value: new THREE.Vector3(14, 0.6, 5) },
    uIntensity: { value: 0 },
    uColor: { value: new THREE.Color(0xc89a62) },
    uMap: { value: puffTexture() },
    uPixel: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime, uIntensity, uPixel;
      uniform vec3 uCam, uBox, uWind;
      attribute float size;
      varying float vAlpha;
      void main() {
        vec3 corner = uCam - uBox * 0.5;
        // Each particle also wanders a little on its own so the cloud churns.
        vec3 drift = uWind * (0.7 + position.z * 0.6) * uTime;
        drift.y += sin(uTime * 0.7 + position.x * 40.0) * 2.0;
        vec3 p = corner + mod(position * uBox + drift - corner, uBox);
        p.y = uCam.y - uBox.y * 0.35 + position.y * uBox.y;

        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        // GPUs clamp point size (often to 1024 px, sometimes far less), and a
        // clamped puff draws as a hard-edged disc — so puffs fade out as they
        // approach 200 px on screen instead of ever reaching the clamp.
        float px = size * uPixel / max(dist, 0.1);
        gl_PointSize = min(px, 220.0);

        // Fade at the edges of the box so nothing pops, and right at the lens.
        vec3 rel = abs(p - uCam) / (uBox * 0.5);
        float edge = 1.0 - smoothstep(0.7, 1.0, max(rel.x, rel.z));
        bool big = size > 2.0;
        float near = smoothstep(0.5, 3.0, dist) * (1.0 - smoothstep(140.0, 210.0, px));
        // Fine grit is visible in light wind; the big clouds only in a storm.
        float a = big ? uIntensity * uIntensity * 0.22 : (0.15 + uIntensity) * 0.5;
        vAlpha = a * edge * near;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float m = texture2D(uMap, gl_PointCoord).a;
        gl_FragColor = vec4(uColor, m * vAlpha);
        #include <colorspace_fragment>
      }`,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 10;

  return {
    object: points,
    uniforms,
    update(dt, camera, intensity, renderer) {
      uniforms.uTime.value += dt;
      uniforms.uCam.value.copy(camera.position);
      uniforms.uIntensity.value = intensity;
      // Point size in pixels for a 1 m puff at 1 m: half the viewport height
      // over tan(half fov).
      const h = renderer.domElement.height;
      uniforms.uPixel.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
  };
}
