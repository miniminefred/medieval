import { hud } from './hud.js';

// What the prince carries (docs/DESIGN.md): gold, and items, each with a weight.
// Over the weight limit you walk slowly and cannot run; the limit grows with the
// clan's strength. Traders buy and sell one item at a time (trade.js).
//
// An item: name, kind (for the shops and the inventory screen), weight in kg,
// `value` (what a trader pays you) and `price` (what a trader asks — about twice
// the value). Food heals when eaten; potions heal more; tools and weapons do
// something when used (inventory screen).

export const ITEMS = {
  // Loot and materials.
  scrap: { name: 'Scrap metal', kind: 'material', weight: 1.5, value: 3 },
  gears: { name: 'Old gears', kind: 'material', weight: 0.8, value: 5 },
  wire: { name: 'Copper wire', kind: 'material', weight: 0.4, value: 4 },
  planks: { name: 'Planks', kind: 'material', weight: 4, value: 2 },
  cell: { name: 'Power cell', kind: 'material', weight: 0.6, value: 12 },
  coin: { name: 'Ancient coin', kind: 'valuable', weight: 0.05, value: 15 },
  gem: { name: 'Rough gemstone', kind: 'valuable', weight: 0.2, value: 22 },
  // Food and potions.
  bread: { name: 'Stale bread', kind: 'food', weight: 0.3, value: 1, heal: 8 },
  stew: { name: 'Bowl of stew', kind: 'food', weight: 0.6, value: 3, heal: 20 },
  water: { name: 'Flask of water', kind: 'food', weight: 0.8, value: 1, heal: 4, stamina: true },
  potion: { name: 'Healing potion', kind: 'potion', weight: 0.3, value: 15, heal: 60 },
  antidote: { name: 'Antidote', kind: 'potion', weight: 0.2, value: 10, cure: true },
  // Weapons and tools.
  dagger: { name: 'Dagger', kind: 'weapon', weight: 0.6, value: 18, weapon: 'dagger' },
  knives: { name: 'Throwing knives (a throw of 3)', kind: 'weapon', weight: 0.3, value: 4, weapon: 'knives' },
  rod: { name: 'Old fishing rod', kind: 'tool', weight: 1.2, value: 6, weapon: 'rod' },
  lantern: { name: 'Lantern', kind: 'tool', weight: 1.0, value: 10 },
  rope: { name: 'Rope', kind: 'tool', weight: 1.5, value: 3 },
  hackkit: { name: 'Hacking gadget', kind: 'tool', weight: 0.4, value: 45 },
};
for (const it of Object.values(ITEMS)) it.price ??= Math.max(2, Math.round(it.value * 2));

const state = { gold: 25, items: {}, capacity: 30 };   // every prince starts with a small purse

function weight() {
  let w = 0;
  for (const [k, n] of Object.entries(state.items)) w += (ITEMS[k]?.weight ?? 0) * n;
  return w;
}

const listeners = new Set();
function changed() {
  hud.gold(state.gold);
  for (const fn of listeners) fn();
}

export const inventory = {
  get gold() { return state.gold; },
  get items() { return Object.entries(state.items).filter(([, n]) => n > 0); },
  get weight() { return weight(); },
  get capacity() { return state.capacity; },
  get overloaded() { return weight() > state.capacity; },

  count(key) { return state.items[key] ?? 0; },

  // Carrying capacity from the clan's strength (1–5): 20–40 kg.
  setStrength(s) { state.capacity = 15 + s * 5; changed(); },

  onChange(fn) { listeners.add(fn); },

  addGold(n) {
    state.gold = Math.max(0, state.gold + n);
    changed();
  },

  addItem(key, n = 1) {
    state.items[key] = Math.max(0, (state.items[key] ?? 0) + n);
    if (state.items[key] === 0) delete state.items[key];
    changed();
  },

  // One item to a trader for its value. False if you have none.
  sellOne(key) {
    if (!state.items[key]) return false;
    this.addItem(key, -1);
    this.addGold(ITEMS[key].value);
    return true;
  },

  // One item from a trader for its price. False if you cannot afford it.
  buyOne(key) {
    const it = ITEMS[key];
    if (!it || state.gold < it.price) return false;
    state.gold -= it.price;
    this.addItem(key, 1);
    return true;
  },

  refresh: changed,
};
