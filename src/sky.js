import * as THREE from 'three';

// A sky dome: zenith colour overhead fading to a horizon colour, plus the sun.
//
// The horizon colour is meant to be *the fog colour* — distant ground fades into
// fog, and the sky at the horizon is the same tint, so far terrain dissolves into
// the sky instead of ending against it. Callers drive horizon/zenith/sun every
// frame (the wasteland blends them by area), and the dome follows the camera so
// it is always infinitely far away.

export function createSky({ radius = 4000 } = {}) {
  const uniforms = {
    uZenith: { value: new THREE.Color(0x6f9ccf) },
    uHorizon: { value: new THREE.Color(0xd8b48a) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
    uSunColor: { value: new THREE.Color(0xfff1dc) },
    uSunStrength: { value: 1 },
    uHaze: { value: 0 },  // 0 clear .. 1 a wall of dust that swallows the sun
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
      uniform vec3 uZenith, uHorizon, uSunDir, uSunColor;
      uniform float uSunStrength, uHaze;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        // Haze pushes the horizon band up the sky.
        float t = pow(h, mix(0.6, 2.5, uHaze));
        vec3 col = mix(uHorizon, uZenith, t);

        float s = max(dot(d, normalize(uSunDir)), 0.0);
        float disc = smoothstep(0.9995, 0.99975, s) * (1.0 - uHaze);
        float glow = pow(s, 12.0) * 0.35 + pow(s, 400.0) * 0.6;
        col += uSunColor * (disc * 6.0 + glow * mix(1.0, 0.5, uHaze)) * uSunStrength;

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
