import * as THREE from 'three';
import { CityBuilder } from '../../builder.js';
import { buildWall } from './wall.js';
import { buildStreets } from './streets.js';
import { buildHouses } from './houses.js';
import { buildMarket } from './market.js';

// The cyborg city — a safe quest town in the east of World 1. See docs/DESIGN.md
// for what it is meant to become; each part lives in its own module here.

export function buildCity(renderer) {
  const group = new THREE.Group();
  group.name = 'cyborg-city';
  const b = new CityBuilder(renderer);

  buildWall(b);
  buildStreets(b);
  const houses = buildHouses(b);
  buildMarket(b);

  b.finish(group);
  return {
    group,
    colliders: b.colliders,
    houses,
    // Skip whole chunks the haze has already hidden.
    update(camera, viewDistance) {
      b.updateVisibility(camera.position, viewDistance);
    },
  };
}
