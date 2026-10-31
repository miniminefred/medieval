// Who sells what (docs/DESIGN.md). Market stalls sell the cyborgs' technology;
// tradespeople sell from their own places — the blacksmith at the forge, a
// general store, the librarian, the carpenter. Any trader buys anything you carry.

export const SHOPS = {
  // The market's stalls, by what is laid out on their counters (market.js).
  weapons: { name: 'Weapon stall', sells: ['dagger', 'knives', 'potion'] },
  bodyParts: { name: 'Body-parts stall', sells: ['cell', 'wire', 'gears', 'antidote'] },
  gadgets: { name: 'Gadget stall', sells: ['lantern', 'hackkit', 'cell', 'rope'] },
  vehicleParts: { name: 'Vehicle-parts stall', sells: ['gears', 'scrap', 'cell', 'wire'] },
  // Tradespeople at their places.
  blacksmith: { name: 'The blacksmith', sells: ['dagger', 'knives', 'scrap'] },
  general: { name: 'General store', sells: ['bread', 'stew', 'water', 'rope', 'rod', 'planks', 'antidote'] },
  librarian: { name: 'The librarian', sells: ['potion', 'antidote', 'lantern', 'coin'] },
  carpenter: { name: 'The carpenter', sells: ['planks', 'rope', 'rod'] },
};
