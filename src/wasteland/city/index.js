import * as THREE from 'three';
import { CityBuilder } from '../../builder.js';
import { buildWall } from './wall.js';
import { buildStreets } from './streets.js';
import { buildHouses } from './houses.js';
import { buildMarket, COUNTERS } from './market.js';
import { createBandit } from '../bandits.js';
import { trade } from '../../trade.js';
import { SHOPS } from '../../shops.js';
import { mulberry32 } from '../../noise.js';
import { CITY } from '../terrain.js';
import { clock } from '../../clock.js';

// The cyborg city — a safe quest town in the east of World 1. See docs/DESIGN.md
// for what it is meant to become; each part lives in its own module here.

export function buildCity(renderer) {
  const group = new THREE.Group();
  group.name = 'cyborg-city';
  const b = new CityBuilder(renderer);

  buildWall(b);
  buildStreets(b);
  const houses = buildHouses(b);
  const updateBoards = buildMarket(b, group);

  b.finish(group);

  // A trader behind every one of the market's counters. You can sell them what you
  // carry (docs/DESIGN.md). Hooded, like everyone for now, but in their own cloth.
  const rng = mulberry32(4242);
  const traders = COUNTERS.map((c) => {
    const t = createBandit(group, renderer, rng, { x: c.x, z: c.z, yaw: c.yaw, heightAt: () => CITY.y + 0.09, trader: true });
    return {
      update: (dt, ctx) => t.update(dt, ctx),
      pos: new THREE.Vector3(c.front.x, CITY.y + 1.5, c.front.z),
      reach: 2.2,
      label: 'trade',
      use() { trade.openShop(SHOPS[c.shop] ?? SHOPS.gadgets); },
    };
  });
  return {
    group,
    colliders: b.colliders,
    doors: b.doors,
    houses,
    traders,
    // Skip whole chunks the haze has already hidden.
    update(camera, viewDistance) {
      b.updateVisibility(camera.position, viewDistance);
      updateBoards(clock.day);
    },
  };
}
