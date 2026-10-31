import * as THREE from 'three';

// A sky dome: zenith colour overhead fading to a horizon colour, plus the sun.
//
// The horizon colour is meant to be *the fog colour* — distant ground fades into
// fog, and the sky at the horizon is the same tint, so far terrain dissolves into
// the sky instead of ending against it. Callers drive horizon/zenith/sun every
// frame (the wasteland blends them by area), and the dome follows the camera so
// it is always infinitely far away.

// The sky's colour in direction d, minus the sun disc. Shared with the terrain's
// fog (terrain-material.js), so land fading into the distance fades into exactly
// the sky behind it — a fogged peak leaves no silhouette against the sky.
export const SKY_GLSL = /* glsl */`
  uniform vec3 uZenith, uHorizon, uSunDir, uSunColor;
  uniform float uSunStrength, uHaze;
  vec3 skyColor(vec3 d) {
    float h = max(d.y, 0.0);
    // Haze pushes the horizon band up the sky.
    float t = pow(h, mix(0.6, 2.5, uHaze));
    vec3 col = mix(uHorizon, uZenith, t);
    float s = max(dot(d, normalize(uSunDir)), 0.0);
    float glow = pow(s, 12.0) * 0.35 + pow(s, 400.0) * 0.6;
    return col + uSunColor * glow * mix(1.0, 0.5, uHaze) * uSunStrength;
  }`;

export function createSky({ radius = 4000 } = {}) {
  const uniforms = {
    uZenith: { value: new THREE.Color(0x6f9ccf) },
    uHorizon: { value: new THREE.Color(0xd8b48a) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
    uSunColor: { value: new THREE.Color(0xfff1dc) },
    uSunStrength: { value: 1 },
    uHaze: { value: 0 },  // 0 clear .. 1 a wall of dust that swallows the sun
    uNight: { value: 0 },  // 0 day .. 1 full night: how many stars show
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;   // pinned to the far plane
      }`,
    fragmentShader: /* glsl */`
      ${SKY_GLSL}
      uniform float uNight;
      varying vec3 vDir;
      float starHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        float disc = smoothstep(0.9995, 0.99975, s) * (1.0 - uHaze);
        col += uSunColor * disc * 6.0 * uSunStrength;

        // Stars: a fixed scatter on a fine grid of directions, twinkle-free,
        // fading in with the night and out toward the hazy horizon. Only the dome
        // gets them — the terrain's fog uses skyColor() and must not sparkle.
        vec3 cell = floor(d * 380.0);
        float star = step(0.9975, starHash(cell)) * smoothstep(0.02, 0.25, d.y) * (1.0 - uHaze);
        col += vec3(0.9, 0.93, 1.0) * star * uNight * (0.6 + 0.8 * starHash(cell + 7.0));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  function update(camera) {
    mesh.position.copy(camera.position);
  }

  return { mesh, uniforms, update };
}
