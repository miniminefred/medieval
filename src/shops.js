// Who sells what (docs/DESIGN.md). Market stalls sell the cyborgs' technology;
// tradespeople sell from their own places — the blacksmith at the forge, a
// general store, the librarian, the carpenter. Any trader buys anything you carry.

import { clock } from './clock.js';
import { ITEMS } from './inventory.js';

// Each shop has one deal a day: an item 20–35% off, picked from what it sells by
// the day's number, so it is the same deal all day and a new one tomorrow.
export function dealOf(shop) {
  if (!shop?.sells?.length) return null;
  let h = clock.day * 2654435761 + shop.name.length * 40503;
  for (const ch of shop.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  return { item: shop.sells[h % shop.sells.length], off: 0.2 + ((h >>> 8) % 4) * 0.05 };
}

// What a shop asks for an item today.
export function priceAt(shop, key) {
  const d = dealOf(shop);
  const p = ITEMS[key].price;
  return d && d.item === key ? Math.max(1, Math.round(p * (1 - d.off))) : p;
}

export const SHOPS = {
  // The market's stalls, by what is laid out on their counters (market.js).
  weapons: { name: 'Weapon stall', sells: ['dagger', 'knives', 'helmet', 'jerkin', 'breastplate', 'gloves', 'potion'] },
  bodyParts: { name: 'Body-parts stall', sells: ['cell', 'wire', 'gears', 'nightlens', 'scanner', 'antidote'] },
  gadgets: { name: 'Gadget stall', sells: ['lantern', 'hackkit', 'grapple', 'scanner', 'drone', 'nightlens', 'compass', 'cell'] },
  vehicleParts: { name: 'Vehicle-parts stall', sells: ['gears', 'scrap', 'cell', 'wire', 'oil', 'iron', 'glass'] },
  // Tradespeople at their places.
  blacksmith: { name: 'The blacksmith', sells: ['dagger', 'knives', 'helmet', 'breastplate', 'pickaxe', 'woodaxe', 'shovel', 'hammer', 'iron', 'lockpicks'] },
  general: { name: 'General store', sells: ['bread', 'stew', 'water', 'apple', 'cheese', 'meat', 'fish', 'pie', 'juice',
    'torch', 'rope', 'bedroll', 'rod', 'hood', 'boots', 'gloves', 'cloth', 'leather', 'oil', 'antidote'] },
  librarian: { name: 'The librarian', sells: ['potion', 'antidote', 'lantern', 'compass', 'crystal', 'coin', 'glass'] },
  carpenter: { name: 'The carpenter', sells: ['planks', 'rope', 'rod', 'hammer', 'woodaxe', 'stone', 'bone'] },
};
