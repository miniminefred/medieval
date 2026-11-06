// Who sells what (docs/DESIGN.md). Market stalls sell the cyborgs' technology;
// tradespeople sell from their own places — the blacksmith at the forge, a
// general store, the librarian, the carpenter. Any trader buys anything you carry.
//
// Prices (docs/DESIGN.md, 2026-11-06). A shop's usual price is the market price
// times its `rate`. On top of that, and **how much varies from shop to shop**
// (each shop's `terms`, fixed by its name):
//   deals    two or three items a day, 20–35% off, new ones tomorrow
//   bulk     buying three or more at once
//   clan     the shops of your own clan's town
//   friend   once you have spent enough at a shop, you are a regular
//   haggle   talk the keeper down (talk()): your intelligence and the keeper's
//            mood today decide it; fail, and the price goes up for the day

import { clock } from './clock.js';
import { ITEMS } from './inventory.js';
import { CLANS, currentClan } from './clans.js';

function hash(text, salt = 0) {
  let h = (salt * 2654435761) >>> 0;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h ^ (h >>> 15)) >>> 0;
}
const frac = (h) => (h % 10007) / 10007;

// A shop's own terms: how generous it is with each kind of discount.
export function termsOf(shop) {
  return shop._terms ??= {
    bulk: 0.08 + frac(hash(shop.name, 1)) * 0.17,     // 8–25%
    clan: 0.08 + frac(hash(shop.name, 2)) * 0.14,     // 8–22%
    friend: 0.1 + frac(hash(shop.name, 3)) * 0.2,     // 10–30%
    friendAt: 40 + Math.round(frac(hash(shop.name, 4)) * 80),   // gold spent to be a regular
    haggle: 0.12 + frac(hash(shop.name, 5)) * 0.28,   // up to 12–40%
  };
}

// The day's deals: two or three items, each 20–35% off.
export function dealsOf(shop) {
  if (!shop?.sells?.length) return [];
  const n = Math.min(shop.sells.length, 2 + (hash(shop.name, clock.day * 7 + 1) % 2));
  const out = [];
  for (let i = 0; out.length < n && i < 12; i++) {
    const h = hash(shop.name, clock.day * 31 + i);
    const item = shop.sells[h % shop.sells.length];
    if (!out.some((d) => d.item === item)) out.push({ item, off: 0.2 + ((h >>> 8) % 4) * 0.05 });
  }
  return out;
}
export const dealOf = (shop) => dealsOf(shop)[0] ?? null;

// ---------------------------------------------------- regulars and haggling
const spent = {};            // shop name -> gold spent there
const talks = {};            // shop name -> { day, off, penalty, done }

export function recordSpend(shop, gold) { spent[shop.name] = (spent[shop.name] ?? 0) + gold; }
export function isFriend(shop) { return (spent[shop.name] ?? 0) >= termsOf(shop).friendAt; }
export function spentAt(shop) { return spent[shop.name] ?? 0; }

// Today's haggling with this keeper: { off, penalty, done }.
export function haggleState(shop) {
  const t = talks[shop.name];
  return t && t.day === clock.day ? t : { off: 0, penalty: 0, done: false };
}
// The keeper's mood today, 0 (sour) to 1 (sunny).
export function moodOf(shop) { return frac(hash(shop.name, clock.day * 13 + 5)); }

// What you can say, and what it risks.
export const LINES = {
  polite: { text: 'Could you do a little better on the price, please?', chance: 0.75, size: 0.45, risk: 0.1 },
  firm: { text: 'That is too much. I will pay less, or go elsewhere.', chance: 0.5, size: 0.75, risk: 0.15 },
  cheeky: { text: 'Half that, and I will tell everyone how fair you are.', chance: 0.28, size: 1.0, risk: 0.25 },
  flatter: { text: 'Finest goods in the city. Surely a friend gets a friend’s price?', chance: 0.55, size: 0.6, risk: 0.12, mood: true },
};

// Say a line to the keeper. Once a day per shop. Returns { ok, off | penalty }.
export function talk(shop, line) {
  const st = haggleState(shop);
  if (st.done) return null;
  const L = LINES[line], mood = moodOf(shop);
  const int = CLANS[currentClan()]?.stats.intelligence ?? 3;
  // Cleverness helps; a good mood helps (flattery depends on it most).
  let chance = L.chance + (int - 3) * 0.08 + (mood - 0.5) * (L.mood ? 0.6 : 0.3);
  chance = Math.max(0.05, Math.min(0.95, chance));
  const ok = Math.random() < chance;
  const res = { day: clock.day, done: true, off: 0, penalty: 0 };
  if (ok) res.off = termsOf(shop).haggle * L.size * (0.75 + mood * 0.25);
  else res.penalty = L.risk;
  talks[shop.name] = res;
  return { ok, off: res.off, penalty: res.penalty };
}

// ---------------------------------------------------------------- prices

// What a shop usually asks: the market's price times the shop's own `rate`.
// Tradespeople in their own places (docs/DESIGN.md) sell for less or more than
// the market — a smith's own blades come cheap, the tavern and the apothecary
// charge for the comfort and the craft. Market stalls have no rate: 1.
export function basePrice(shop, key) {
  return Math.max(1, Math.round(ITEMS[key].price * (shop?.rate ?? 1)));
}

// Every discount (and penalty) that applies to you here, as fractions.
export function discountsAt(shop) {
  const T = termsOf(shop), h = haggleState(shop);
  return {
    clan: shop.clan && shop.clan === currentClan() ? T.clan : 0,
    friend: isFriend(shop) ? T.friend : 0,
    haggle: h.off,
    penalty: h.penalty,
    bulk: T.bulk,
  };
}

// What a shop asks for one of an item today, buying `qty` at once.
export function priceAt(shop, key, qty = 1) {
  const d = dealsOf(shop).find((x) => x.item === key);
  const D = discountsAt(shop);
  let p = basePrice(shop, key) * (1 - (d?.off ?? 0));
  p *= (1 - D.clan) * (1 - D.friend) * (1 - D.haggle) * (1 + D.penalty);
  if (qty >= 3) p *= 1 - D.bulk;
  return Math.max(1, Math.round(p));
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

// Every shop but Farmville's is in the cyborg city: cyborg princes get the clan price there.
for (const [k, shop] of Object.entries(SHOPS)) if (k !== 'farmstore') shop.clan = 'cyborgs';
