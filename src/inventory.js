import { hud } from './hud.js';

// What the prince carries: gold, and items found in chests and camps that the
// market traders in the cyborg city will buy (docs/DESIGN.md). Weight limits and
// credits come later; for now an item is a name, a sale price and a count.

export const ITEMS = {
  scrap: { name: 'Scrap metal', value: 3 },
  gears: { name: 'Old gears', value: 5 },
  wire: { name: 'Copper wire', value: 4 },
  cell: { name: 'Power cell', value: 12 },
  dagger: { name: "Bandit's dagger", value: 8 },
  coin: { name: 'Ancient coin', value: 15 },
  gem: { name: 'Rough gemstone', value: 22 },
  bread: { name: 'Stale bread', value: 1 },
};

const state = { gold: 25, items: {} };   // every prince starts with a small purse

function changed() {
  hud.gold(state.gold);
}

export const inventory = {
  get gold() { return state.gold; },
  get items() { return Object.entries(state.items).filter(([, n]) => n > 0); },

  addGold(n) {
    state.gold += n;
    changed();
  },

  addItem(key, n = 1) {
    state.items[key] = (state.items[key] ?? 0) + n;
    changed();
  },

  // Sell everything to a trader; returns what it earned.
  sellAll() {
    let earned = 0;
    for (const [key, n] of Object.entries(state.items)) {
      earned += (ITEMS[key]?.value ?? 0) * n;
    }
    state.items = {};
    state.gold += earned;
    changed();
    return earned;
  },

  refresh: changed,
};
