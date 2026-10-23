// Seeded 2D gradient (Perlin) noise and fractal sums of it. Everything procedural
// about the land is built from these, so one seed gives the same world every load.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createNoise(seed = 1) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  // Eight unit-ish gradient directions.
  const GX = [1, -1, 1, -1, 1.414, -1.414, 0, 0];
  const GZ = [1, 1, -1, -1, 0, 0, 1.414, -1.414];

  function grad(h, x, z) {
    const i = h & 7;
    return GX[i] * x + GZ[i] * z;
  }

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  // Roughly in [-1, 1].
  function noise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const X = xi & 255, Z = zi & 255;
    const u = fade(xf), v = fade(zf);
    const aa = perm[perm[X] + Z], ab = perm[perm[X] + Z + 1];
    const ba = perm[perm[X + 1] + Z], bb = perm[perm[X + 1] + Z + 1];
    const x1 = grad(aa, xf, zf) + u * (grad(ba, xf - 1, zf) - grad(aa, xf, zf));
    const x2 = grad(ab, xf, zf - 1) + u * (grad(bb, xf - 1, zf - 1) - grad(ab, xf, zf - 1));
    return (x1 + v * (x2 - x1)) * 0.75;
  }

  // Fractal sum, normalised back to roughly [-1, 1].
  function fbm(x, z, octaves = 4) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x * freq + o * 17.3, z * freq - o * 9.1) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }

  // Sharp crests instead of round hills — mountain ridgelines. In [0, 1].
  function ridged(x, z, octaves = 5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(noise(x * freq + o * 31.7, z * freq + o * 5.3));
      sum += n * n * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return sum / norm;
  }

  return { noise, fbm, ridged };
}
