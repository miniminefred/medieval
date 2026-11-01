// Who sells what (docs/DESIGN.md). Market stalls sell the cyborgs' technology;
// tradespeople sell from their own places — the blacksmith at the forge, a
// general store, the librarian, the carpenter. Any trader buys anything you carry.

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
