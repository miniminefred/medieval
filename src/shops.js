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

// What a shop usually asks: the market's price times the shop's own `rate`.
// Tradespeople in their own places (docs/DESIGN.md) sell for less or more than
// the market — a smith's own blades come cheap, the tavern and the apothecary
// charge for the comfort and the craft. Market stalls have no rate: 1.
export function basePrice(shop, key) {
  return Math.max(1, Math.round(ITEMS[key].price * (shop?.rate ?? 1)));
}

// What a shop asks for an item today.
export function priceAt(shop, key) {
  const d = dealOf(shop);
  const p = basePrice(shop, key);
  return d && d.item === key ? Math.max(1, Math.round(p * (1 - d.off))) : p;
}

export const SHOPS = {
  // The market's stalls, by what is laid out on their counters (market.js).
  // Weapons are sold spread out (docs/DESIGN.md): the market stall has the
  // fencing blades and the flail, the smith the swords and the mace, the gadget
  // stall the cyborg tech, Farmville the club and the axe. The greatsword and the
  // war hammer come only from bandits, for now.
  weapons: { name: 'Weapon stall', sells: ['sabre', 'rapier', 'flail', 'firebomb', 'dagger', 'knives', 'helmet', 'jerkin', 'breastplate', 'gloves', 'potion'] },
  bodyParts: { name: 'Body-parts stall', sells: ['socket', 'translate', 'nighteye', 'mapmod', 'cell', 'wire', 'gears', 'nightlens', 'scanner', 'antidote'] },
  gadgets: { name: 'Gadget stall', sells: ['baton', 'buzzsaw', 'plasma', 'lantern', 'hackkit', 'grapple', 'scanner', 'drone', 'nightlens', 'compass', 'cell'] },
  vehicleParts: { name: 'Vehicle-parts stall', sells: ['gears', 'scrap', 'cell', 'wire', 'oil', 'iron', 'glass'] },
  // Tradespeople at their places (the special buildings, houses.js), each with
  // its own `rate` against market prices.
  blacksmith: { name: 'The blacksmith', rate: 0.85, sells: ['shortsword', 'longsword', 'mace', 'dagger', 'knives', 'helmet', 'breastplate', 'pickaxe', 'woodaxe', 'shovel', 'hammer', 'iron', 'lockpicks'] },
  general: { name: 'General store', rate: 1.1, sells: ['bread', 'stew', 'water', 'apple', 'cheese', 'meat', 'fish', 'pie', 'juice',
    'torch', 'rope', 'bedroll', 'rod', 'hood', 'boots', 'gloves', 'cloth', 'leather', 'oil', 'antidote'] },
  librarian: { name: 'The librarian', rate: 1.2, sells: ['potion', 'antidote', 'lantern', 'compass', 'crystal', 'coin', 'glass'] },
  carpenter: { name: 'The carpenter', rate: 0.85, sells: ['planks', 'rope', 'rod', 'hammer', 'woodaxe', 'stone', 'bone'] },
  // Farmville's store: farm food, tools, and what farmers fight with.
  farmstore: { name: 'Farmville store', rate: 0.95, sells: ['bread', 'apple', 'cheese', 'water', 'meat', 'club', 'battleaxe', 'woodaxe', 'shovel', 'rope', 'torch', 'boots'] },
  baker: { name: 'The bakery', rate: 0.75, sells: ['bread', 'pie', 'cheese', 'apple'] },
  tavern: { name: 'The tavern', rate: 1.3, sells: ['stew', 'pie', 'meat', 'bread', 'cheese', 'juice', 'water'] },
  fishmonger: { name: 'The fishmonger', rate: 0.8, sells: ['fish', 'rod', 'rope', 'oil'] },
  butcher: { name: 'The butcher', rate: 0.85, sells: ['meat', 'leather', 'bone'] },
  apothecary: { name: 'The apothecary', rate: 1.25, sells: ['strengthpot', 'swiftpot', 'ironskin', 'endurance', 'nightsight', 'shadowpot', 'firebomb', 'poisonflask', 'smokebomb', 'potion', 'antidote', 'crystal', 'glass'] },
  tailor: { name: 'The tailor', rate: 1.15, sells: ['hood', 'gloves', 'boots', 'jerkin', 'cloth', 'leather', 'bedroll'] },
};
