import * as THREE from 'three';
import * as Furn from './furniture.js';
import { createBandit } from './wasteland/bandits.js';
import { trade } from './trade.js';
import { SHOPS } from './shops.js';
import { displayShelf } from './shop-display.js';

// The ground floor of a special building (docs/DESIGN.md, 2026-11-02): its
// trade's things, a counter, and the keeper behind it, who trades with you.
// Laid out in house-local coordinates like the rest of interiors.js: the front
// door is in the +z wall at x = doorX, the fireplace on the back wall (-z) at
// fx, and with an upstairs the stairs climb the left (-x) wall from the front.
//
// The smithy's fireplace is its forge, the bakery has a domed oven; everyone
// else keeps the fire for warmth.

// Which shop each building's keeper keeps (shops.js).
export const SHOP_OF = {
  smithy: 'blacksmith', tavern: 'tavern', bakery: 'baker', library: 'librarian', carpenter: 'carpenter',
  fishmonger: 'fishmonger', butcher: 'butcher', apothecary: 'apothecary', tailor: 'tailor',
};

export function shopFloor(kind, { b, group, renderer, rand, hx, hz, floors, fx, things, addCandle, sitAt }) {
  const between = (a, c) => a + rand() * (c - a);
  const stairs = floors > 1;                 // the left front of the room is taken
  const left = -hx + (stairs ? 1.35 : 0.3);  // the counter's left end
  const shop = SHOPS[SHOP_OF[kind]];

  // The keeper behind a counter, and "press E" to trade.
  const keeper = (x, z, yaw, cx, cz) => {
    createBandit(group, renderer, rand, { x, z, yaw, heightAt: () => 0, trader: true });
    things.push({
      pos: new THREE.Vector3(cx, 1.2, cz), reach: 2.6, label: `trade with ${shop.name.toLowerCase()}`,
      use() { trade.openShop(shop); },
    });
  };
  // A counter along x from x0 to x1 at z, or (alongZ) along z at x.
  const counter = (x0, x1, z, alongZ = false) => {
    const len = x1 - x0, mid = (x0 + x1) / 2;
    if (alongZ) {
      b.box('timber', z, 0, mid, 0.6, 0.95, len, { collide: true });
      b.box('timber', z, 0.95, mid, 0.72, 0.06, len + 0.06);
    } else {
      b.box('timber', mid, 0, z, len, 0.95, 0.6, { collide: true });
      b.box('timber', mid, 0.95, z, len + 0.06, 0.06, 0.72);
    }
    return 1.01;                             // the counter top
  };
  const backZ = -hz + 1.75;                  // a counter across the back of the room
  const keepX = Math.max(left + 0.8, Math.min(fx + 1.4, hx - 1.8));
  const standard = () => {
    const top = counter(left, hx - 1.1, backZ);
    keeper(keepX, -hz + 1.05, 0, keepX, backZ + 0.3);
    // What is for sale, on a shelf against the back wall behind the counter:
    // beside the fireplace on whichever side has room (not where the keeper stands).
    const fireL = fx - 1.05, fireR = fx + 1.05;
    const leftRoom = fireL - (-hx + 0.25);
    const rightFrom = Math.max(fireR, keepX + 0.5), rightRoom = hx - 0.25 - rightFrom;
    if (Math.max(leftRoom, rightRoom) >= 0.9) {
      const useLeft = leftRoom >= rightRoom;
      const wdt = Math.min(2.2, useLeft ? leftRoom : rightRoom);
      const x = useLeft ? fireL - wdt / 2 : rightFrom + wdt / 2;
      displayShelf(b, x, -hz + 0.22, wdt, shop.sells);
    }
    return top;
  };
  const leaning = (key, x, z, h, yaw, tilt = 0.12) => b.box(key, x, 0, z, 0.06, h, 0.06, { yaw, roll: tilt });
  const barrel = (x, z) => b.cylinder('timber', x, 0, z, 0.33, 0.85, { rTop: 0.29, collide: true });

  switch (kind) {
    case 'smithy': {
      const top = standard();
      // The anvil on its stump, the quench tub, the bellows by the forge.
      b.cylinder('timber', hx - 1.0, 0, -0.2, 0.3, 0.5, { collide: true });
      b.box('gunmetal', hx - 1.0, 0.5, -0.2, 0.75, 0.28, 0.28);
      b.box('gunmetal', hx - 1.0, 0.78, -0.2, 0.9, 0.08, 0.32);
      b.cylinder('timber', hx - 0.5, 0, 1.2, 0.4, 0.6, { collide: true });
      b.disc('gunmetal', hx - 0.5, 0.56, 1.2, 0.36, 0.02, 20);
      b.box('hide', fx + 1.15, 0.7, -hz + 0.5, 0.5, 0.25, 0.7);           // the bellows
      // Blades on the counter and on a rack on the right wall.
      for (let i = 0; i < 3; i++) b.box('pewter', left + 0.5 + i * 0.5, top, backZ, 0.06, 0.02, 0.62, { yaw: 0.2 });
      for (let i = 0; i < 5; i++) leaning('pewter', hx - 0.12, -1.5 + i * 0.45, 1.1, Math.PI / 2, 0.06);
      b.box('timber', hx - 0.1, 1.15, -0.6, 0.08, 0.08, 2.4);
      Furn.hungTools(b, hx - 0.05, 0, 1.6, -Math.PI / 2);
      return { forge: true };
    }
    case 'tavern': {
      // The bar along the right wall, barrels on their sides behind it.
      const bx = hx - 1.5;
      counter(-hz + 0.6, hz - 2.2, bx, true);
      keeper(hx - 0.6, 0, -Math.PI / 2, bx - 0.3, 0);
      for (let i = 0; i < 3; i++) b.cylinder('timber', hx - 0.4, 0.42, -hz + 0.8 + i * 0.8, 0.33, 0.7, { roll: Math.PI / 2, yaw: Math.PI / 2, rTop: 0.33 });
      for (let i = 0; i < 4; i++) Furn.jug(b, bx, 1.01, -1.2 + i * 0.6, 'pewter');
      // Tables and chairs filling the room.
      const spots = [[-0.6, -0.9], [-0.6, 1.3], [0.9, -2.2]].slice(0, hx > 4 ? 3 : 2);
      for (const [tx, tz] of spots) {
        const x = Math.max(left + 0.9, Math.min(tx, bx - 1.6)), z = Math.max(-hz + 1.2, Math.min(tz, hz - 1.6));
        addCandle(Furn.table(b, x, 0, z, 0, 1.3, 0.8, rand));
        for (const [cx, cz, yaw] of [[-0.95, 0, -Math.PI / 2], [0.95, 0, Math.PI / 2]]) {
          Furn.chair(b, x + cx, 0, z + cz, yaw + Math.PI);
          sitAt(x + cx, 0, z + cz, yaw + Math.PI);
        }
      }
      return { inn: true };
    }
    case 'bakery': {
      const top = standard();
      // A domed bread oven against the right wall.
      const ox = hx - 0.95, oz = -0.3;
      b.cylinder('housestone', ox, 0, oz, 0.85, 0.9, { sides: 18, collide: true });
      for (let i = 0; i < 4; i++) b.cylinder('housestone', ox, 0.9 + i * 0.18, oz, 0.82 - i * 0.18, 0.18, { rBottom: 0.85 - i * 0.18, sides: 18 });
      b.box('rust', ox - 0.6, 0.6, oz, 0.3, 0.5, 0.5);                       // its mouth
      // Loaves on the counter and on shelves; sacks of flour.
      for (let i = 0; i < 6; i++) b.cylinder('bread', left + 0.35 + i * 0.32, top + 0.06, backZ + (i % 2 ? 0.1 : -0.12), 0.07, 0.24, { roll: Math.PI / 2, yaw: 0.3, sides: 10 });
      Furn.shelves(b, hx - 0.2, 0, 1.6, -Math.PI / 2, 1.4, () => 0.99);
      for (const sh of [0.92, 1.37, 1.82]) for (let i = 0; i < 4; i++) b.cylinder('bread', hx - 0.2, sh + 0.06, 1.1 + i * 0.32, 0.07, 0.22, { roll: Math.PI / 2, sides: 10 });
      for (let i = 0; i < 3; i++) Furn.sack(b, left + 0.3 + i * 0.5, 0, -hz + 0.4, rand);
      return {};
    }
    case 'library': {
      const top = standard();
      // Books everywhere: tall shelves on every free wall.
      for (let i = 0; i < 3; i++) {
        Furn.shelves(b, hx - 0.17, 0, -1.6 + i * 1.5, -Math.PI / 2, 1.4, rand);
        Furn.shelves(b, hx - 0.17, 1.2, -1.6 + i * 1.5, -Math.PI / 2, 1.4, rand);
      }
      if (!stairs) for (let i = 0; i < 2; i++) Furn.shelves(b, -hx + 0.17, 0, -0.6 + i * 1.5, Math.PI / 2, 1.4, rand);
      const rx = (left + hx - 1.2) / 2;
      addCandle(Furn.table(b, rx, 0, 1.0, 0, 1.4, 0.8, () => 0.9));
      for (const [cx, yaw] of [[-0.95, -Math.PI / 2], [0.95, Math.PI / 2]]) { Furn.chair(b, rx + cx, 0, 1.0, yaw + Math.PI); sitAt(rx + cx, 0, 1.0, yaw + Math.PI); }
      for (let i = 0; i < 4; i++) b.box(['bookred', 'bookgreen', 'bookblue'][i % 3], left + 0.4 + i * 0.25, top, backZ, 0.18, 0.05 + i * 0.01, 0.24);
      return {};
    }
    case 'carpenter': {
      standard();
      // A workbench, planks stacked against the wall, a sawhorse, shavings.
      const wx = (left + hx) / 2 - 0.4;
      Furn.table(b, wx, 0, 1.0, 0, 2.0, 0.8, () => 0.99);
      for (let i = 0; i < 6; i++) leaning('timber', hx - 0.15 - (i % 2) * 0.06, -1.8 + i * 0.5, 2.5, Math.PI / 2, 0.18);
      for (let i = 0; i < 5; i++) b.box('timber', hx - 0.8, i * 0.06, 2.0, 0.25, 0.05, 2.2);
      b.box('timber', wx + 1.5, 0.55, -0.6, 1.0, 0.1, 0.12);
      for (const sx of [-0.4, 0.4]) b.box('timber', wx + 1.5 + sx, 0, -0.6, 0.06, 0.55, 0.5);
      Furn.hungTools(b, hx - 0.05, 0, -0.4, -Math.PI / 2);
      return {};
    }
    case 'fishmonger': {
      const top = standard();
      // Fish laid out on the counter, barrels of salt fish, nets and rods.
      for (let i = 0; i < 7; i++) b.cylinder('fishscale', left + 0.3 + i * 0.28, top + 0.05, backZ, 0.05, 0.36, { rTop: 0.02, roll: Math.PI / 2, yaw: (i % 2) * 0.4, sides: 8 });
      barrel(hx - 0.6, 0.4); barrel(hx - 0.6, 1.2);
      b.box('hessian', hx - 0.06, 0.9, -1.0, 0.03, 1.6, 2.2);                 // a net hung on the wall
      for (let i = 0; i < 3; i++) leaning('timber', hx - 0.2, -2.0 + i * 0.25 - 0.5, 2.6, Math.PI / 2, 0.15);
      return {};
    }
    case 'butcher': {
      const top = standard();
      // Joints hung from a rail, a chopping block with a cleaver.
      b.box('timber', 0, 2.3, -hz + 0.5, hx * 1.4, 0.08, 0.08);
      for (let i = 0; i < 6; i++) b.cylinder('meat', -hx * 0.6 + i * hx * 0.25, 1.55 + (i % 2) * 0.1, -hz + 0.5, 0.13, 0.6, { rTop: 0.07, sides: 10 });
      b.cylinder('timber', hx - 1.0, 0, 0.8, 0.38, 0.85, { collide: true });
      b.box('pewter', hx - 1.0, 0.86, 0.75, 0.25, 0.02, 0.12, { yaw: 0.5 });
      for (let i = 0; i < 4; i++) b.cylinder('meat', left + 0.4 + i * 0.4, top, backZ, 0.1, 0.12, { sides: 10 });
      return {};
    }
    case 'apothecary': {
      const top = standard();
      // Shelves of potions, bunches of herbs drying, a mortar on the counter.
      for (let i = 0; i < 2; i++) {
        Furn.shelves(b, hx - 0.17, 0, -1.0 + i * 1.6, -Math.PI / 2, 1.4, () => 0.99);
        for (const sh of [0.92, 1.37, 1.82]) for (let j = 0; j < 5; j++) {
          b.cylinder(['potionred', 'potiongreen', 'potionblue'][(i + j) % 3], hx - 0.17, sh, -1.6 + i * 1.6 + j * 0.26, 0.05, 0.16 + (j % 2) * 0.05, { sides: 10 });
        }
      }
      b.box('timber', 0, 2.4, 0, hx * 1.2, 0.05, 0.05);
      for (let i = 0; i < 7; i++) b.cylinder('reed', -hx * 0.5 + i * hx * 0.18, 2.0, 0, 0.06, 0.4, { rTop: 0.02, sides: 6 });
      b.cylinder('pottery', left + 0.5, top, backZ, 0.12, 0.12, { rBottom: 0.08, sides: 14 });
      for (let i = 0; i < 4; i++) b.cylinder(['potionred', 'potiongreen', 'potionblue'][i % 3], left + 0.9 + i * 0.25, top, backZ + 0.1, 0.045, 0.15, { sides: 10 });
      return {};
    }
    case 'tailor': {
      standard();
      // Bolts of cloth on a rack, a dressmaker's dummy, a small loom.
      const keys = ['linen', 'caban', 'blanket', 'rug', 'sheet', 'hessian'];
      for (let i = 0; i < 6; i++) b.cylinder(keys[i], hx - 0.35, 0.3 + (i % 3) * 0.4, -1.4 + Math.floor(i / 3) * 1.3, 0.16, 1.1, { pitch: Math.PI / 2, sides: 12 });
      const dx = (left + hx) / 2;
      b.cylinder('timber', dx, 0, 1.0, 0.04, 1.1, { sides: 8 });
      b.cylinder('linen', dx, 1.1, 1.0, 0.17, 0.5, { rTop: 0.22, sides: 14 });
      b.cylinder('linen', dx, 1.6, 1.0, 0.12, 0.08, { rBottom: 0.22, sides: 14 });
      for (const sx of [-0.5, 0.5]) b.box('timber', dx + 1.6 + sx, 0, -0.4, 0.08, 1.3, 0.8);
      b.box('timber', dx + 1.6, 1.2, -0.4, 1.1, 0.08, 0.08);
      for (let i = 0; i < 8; i++) b.box('linen', dx + 1.15 + i * 0.12, 0.4, -0.4, 0.02, 0.8, 0.02);
      return {};
    }
  }
  return {};
}
