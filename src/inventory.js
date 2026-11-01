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
  bread: { name: 'Stale bread', kind: 'food', weight: 0.3, value: 1, heal: 8, food: 0.25 },
  stew: { name: 'Bowl of stew', kind: 'food', weight: 0.6, value: 3, heal: 20, food: 0.5, effect: 'wellfed', seconds: 180 },
  water: { name: 'Flask of water', kind: 'food', weight: 0.8, value: 1, heal: 4, stamina: true, food: 0.05, effect: 'energised', seconds: 90 },
  apple: { name: 'Apple', kind: 'food', weight: 0.2, value: 1, heal: 3, food: 0.1 },
  cheese: { name: 'Wedge of cheese', kind: 'food', weight: 0.4, value: 3, heal: 6, food: 0.3 },
  meat: { name: 'Roast meat', kind: 'food', weight: 0.5, value: 5, heal: 15, food: 0.45, effect: 'wellfed', seconds: 240 },
  fish: { name: 'Smoked fish', kind: 'food', weight: 0.4, value: 4, heal: 10, food: 0.35 },
  pie: { name: 'Meat pie', kind: 'food', weight: 0.6, value: 6, heal: 18, food: 0.6, effect: 'wellfed', seconds: 300 },
  juice: { name: 'Berry juice', kind: 'food', weight: 0.6, value: 3, heal: 4, food: 0.1, stamina: true, effect: 'energised', seconds: 150 },
  potion: { name: 'Healing potion', kind: 'potion', weight: 0.3, value: 15, heal: 60 },
  antidote: { name: 'Antidote', kind: 'potion', weight: 0.2, value: 10, cure: true },
  // Weapons and tools.
  dagger: { name: 'Dagger', kind: 'weapon', weight: 0.6, value: 18, weapon: 'dagger' },
  knives: { name: 'Throwing knives (a throw of 3)', kind: 'weapon', weight: 0.3, value: 4, weapon: 'knives' },
  rod: { name: 'Old fishing rod', kind: 'tool', weight: 1.2, value: 6, weapon: 'rod' },
  lantern: { name: 'Lantern', kind: 'tool', weight: 1.0, value: 10, light: 'lantern' },
  rope: { name: 'Rope', kind: 'tool', weight: 1.5, value: 3 },
  hackkit: { name: 'Hacking gadget', kind: 'gadget', weight: 0.4, value: 45 },
  // More tools (some do things now — the torch and lantern light the dark —
  // the rest are for jobs and crafting still to come).
  torch: { name: 'Torch', kind: 'tool', weight: 0.6, value: 2, light: 'torch' },
  pickaxe: { name: 'Pickaxe', kind: 'tool', weight: 2.5, value: 12 },
  woodaxe: { name: 'Woodcutter\'s axe', kind: 'tool', weight: 2.2, value: 11 },
  shovel: { name: 'Shovel', kind: 'tool', weight: 2.0, value: 8 },
  hammer: { name: 'Hammer', kind: 'tool', weight: 1.0, value: 6 },
  lockpicks: { name: 'Lockpicks', kind: 'tool', weight: 0.1, value: 9 },
  bedroll: { name: 'Bedroll', kind: 'tool', weight: 2.5, value: 10 },
  // Gadgets: cyborg technology.
  grapple: { name: 'Grappling hook', kind: 'gadget', weight: 1.4, value: 35 },
  scanner: { name: 'Scanner', kind: 'gadget', weight: 0.5, value: 40 },
  drone: { name: 'Little drone', kind: 'gadget', weight: 1.1, value: 70 },
  nightlens: { name: 'Night-vision lens', kind: 'gadget', weight: 0.1, value: 50 },
  compass: { name: 'Compass', kind: 'gadget', weight: 0.2, value: 12 },
  // More materials.
  iron: { name: 'Iron ingot', kind: 'material', weight: 1.8, value: 8 },
  leather: { name: 'Leather', kind: 'material', weight: 0.8, value: 6 },
  cloth: { name: 'Bolt of cloth', kind: 'material', weight: 0.7, value: 5 },
  bone: { name: 'Bone', kind: 'material', weight: 0.6, value: 2 },
  stone: { name: 'Cut stone', kind: 'material', weight: 3.5, value: 2 },
  glass: { name: 'Glass pane', kind: 'material', weight: 1.0, value: 7 },
  oil: { name: 'Lamp oil', kind: 'material', weight: 0.9, value: 4 },
  crystal: { name: 'Glow crystal', kind: 'valuable', weight: 0.3, value: 30 },
  // Clothes and armour: wear one per slot; armour soaks part of every blow.
  hood: { name: 'Travelling hood', kind: 'armour', weight: 0.5, value: 6, slot: 'head', armour: 1 },
  helmet: { name: 'Iron helmet', kind: 'armour', weight: 2.0, value: 25, slot: 'head', armour: 3 },
  jerkin: { name: 'Leather armour', kind: 'armour', weight: 4.0, value: 30, slot: 'body', armour: 4 },
  breastplate: { name: 'Steel breastplate', kind: 'armour', weight: 8.0, value: 70, slot: 'body', armour: 8 },
  gloves: { name: 'Leather gloves', kind: 'armour', weight: 0.4, value: 8, slot: 'hands', armour: 1 },
  boots: { name: 'Sturdy boots', kind: 'armour', weight: 1.2, value: 12, slot: 'feet', armour: 2 },
};
for (const it of Object.values(ITEMS)) it.price ??= Math.max(2, Math.round(it.value * 2));

const state = { gold: 25, items: {}, capacity: 30 };
let capacityPenalty = null;
const worn = {};                   // slot -> item key   // every prince starts with a small purse

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
  get capacity() { return state.capacity - (capacityPenalty?.() ?? 0); },
  get overloaded() { return weight() > this.capacity; },
  // Something that lowers what you can carry (hunger.js), asked each time.
  setCapacityPenalty(fn) { capacityPenalty = fn; },

  count(key) { return state.items[key] ?? 0; },

  // Armour: wear (or take off) an item; one per slot. Worn items stay in the
  // pack (and still weigh); selling one takes it off.
  get worn() { return { ...worn }; },
  isWorn(key) { return worn[ITEMS[key]?.slot] === key; },
  toggleWear(key) {
    const it = ITEMS[key];
    if (!it?.slot || !state.items[key]) return false;
    if (worn[it.slot] === key) delete worn[it.slot]; else worn[it.slot] = key;
    changed();
    return true;
  },
  get armour() { return Object.values(worn).reduce((a, k) => a + (ITEMS[k]?.armour ?? 0), 0); },

  // Carrying capacity from the clan's strength (1–5): 20–40 kg.
  setStrength(s) { state.capacity = 15 + s * 5; changed(); },

  onChange(fn) { listeners.add(fn); },

  addGold(n) {
    state.gold = Math.max(0, state.gold + n);
    changed();
  },

  addItem(key, n = 1) {
    state.items[key] = Math.max(0, (state.items[key] ?? 0) + n);
    if (state.items[key] === 0) {
      delete state.items[key];
      for (const s of Object.keys(worn)) if (worn[s] === key) delete worn[s];
    }
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
  buyOne(key, price = ITEMS[key]?.price) {
    const it = ITEMS[key];
    if (!it || state.gold < price) return false;
    state.gold -= price;
    this.addItem(key, 1);
    return true;
  },

  refresh: changed,
};
