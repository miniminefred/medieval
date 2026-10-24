import { CityBuilder } from '../builder.js';
import { mulberry32 } from '../noise.js';
import { buildHouse } from './city/houses.js';
import { PLACES } from './places.js';

// Farmville: a small farming village at the fork of the Y road (docs/DESIGN.md).
// A handful of plain half-timbered houses round the fork, facing the road, a
// well, and a ploughed field in the wedge between the two southern branches.
// It is also where a dragon prince makes for, hurt, from the fallen dragon city.

const rng = mulberry32(7777);

export function buildFarmville(group, renderer, heightAt) {
  const b = new CityBuilder(renderer);
  const { x: fx, z: fz } = PLACES.farmville;
  const y = (x, z) => heightAt(x, z);

  // [dx, dz, w, d, yaw] — fronts toward the road (local +z).
  const houses = [
    [-26, -28, 9, 8, Math.PI / 2],      // west of the stem, facing east
    [-27, -6, 8, 7.5, Math.PI / 2],
    [30, -32, 9.5, 8, -Math.PI / 2],    // east of the stem, facing west
    [31, -10, 8, 8, -Math.PI / 2],
    [-38, 22, 9, 8, -0.25],             // south of the west branch
    [44, 24, 8.5, 8, 0.4],              // south of the east branch
  ];
  for (const [dx, dz, w, d, yaw] of houses) {
    const x = fx + dx, z = fz + dz;
    buildHouse(b, x, z, w, d, yaw, rng() < 0.6 ? 2 : 1, { y: y(x, z), tech: 0, rng });
  }

  // The well on the green by the fork.
  const wx = fx - 12, wz = fz - 14;
  b.cylinder('housestone', wx, y(wx, wz) - 0.1, wz, 1.1, 0.9, { sides: 18, collide: true });
  for (const s of [-1, 1]) b.box('timber', wx + s * 0.95, y(wx, wz), wz, 0.14, 2.3, 0.14);
  b.box('timber', wx, y(wx, wz) + 2.2, wz, 2.2, 0.14, 0.14);
  b.roof('rooftiles', 'timber', wx, y(wx, wz) + 2.3, wz, 2.4, 1.6, 0.7, { over: 0.15 });

  // A ploughed field between the branches, with a low fence round it.
  const cx = fx, cz = fz + 31, fw = 34, fd = 14;
  b.box('soil', cx, y(cx, cz) - 0.25, cz, fw, 0.3, fd);
  for (const [px0, pz0, px1, pz1] of [
    [cx - fw / 2, cz - fd / 2, cx + fw / 2, cz - fd / 2], [cx - fw / 2, cz + fd / 2, cx + fw / 2, cz + fd / 2],
    [cx - fw / 2, cz - fd / 2, cx - fw / 2, cz + fd / 2], [cx + fw / 2, cz - fd / 2, cx + fw / 2, cz + fd / 2],
  ]) {
    const len = Math.hypot(px1 - px0, pz1 - pz0), n = Math.round(len / 2.4);
    for (let i = 0; i <= n; i++) {
      const px = px0 + ((px1 - px0) * i) / n, pz = pz0 + ((pz1 - pz0) * i) / n;
      b.box('timber', px, y(px, pz), pz, 0.12, 1.0, 0.12);
    }
    const along = px1 !== px0;
    for (const ry of [0.45, 0.85]) {
      b.box('timber', (px0 + px1) / 2, y((px0 + px1) / 2, (pz0 + pz1) / 2) + ry, (pz0 + pz1) / 2,
        along ? len : 0.07, 0.08, along ? 0.07 : len);
    }
  }

  b.finish(group);
  return { colliders: b.colliders };
}
