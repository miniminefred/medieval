import * as THREE from 'three';
import { CityBuilder } from './builder.js';
import { buildWall } from './wall.js';

// The cyborg city — a safe quest town in the east of World 1. See docs/DESIGN.md
// for what it is meant to become; each part lives in its own module here.

export function buildCity(renderer) {
  const group = new THREE.Group();
  group.name = 'cyborg-city';
  const b = new CityBuilder(renderer);

  buildWall(b);

  b.finish(group);
  return { group, colliders: b.colliders };
}
