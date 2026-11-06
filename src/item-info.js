import { ITEMS } from './inventory.js';
import { EFFECTS } from './hunger.js';
import { weaponLines } from './weapons.js';

// What an item does, in words — shown when you click it in a shop before you
// decide to buy it (trade.js). Built from the item's own numbers (food, heal,
// armour, effects…), plus a line about the ones whose use is not in numbers.

const ABOUT = {
  scrap: 'Old metal. The cyborgs pay for it; one day you can build with it.',
  gears: 'Salvaged gears, wanted for machines and repairs.',
  wire: 'Copper wire for gadgets and repairs.',
  planks: 'Sawn timber, for building and mending.',
  cell: 'A cyborg power cell. Gadgets and machines run on them.',
  coin: 'A coin from before the war. Worth a fair bit to collectors.',
  gem: 'An uncut stone. Worth good gold.',
  knives: 'Click to throw three at once. Each throw uses one set.',
  rod: 'Hold it and click to cast into water (the pond in the cyborg city); click again when a fish bites.',
  lantern: 'Lights the dark around you. Use it to light it or put it out.',
  torch: 'A burning torch: cheap light for dark nights.',
  rope: 'Strong rope. For climbing and tying, later.',
  hackkit: 'Opens cyborg locks and machines (hacking comes later).',
  pickaxe: 'For mining stone and ore (a job still to come).',
  woodaxe: 'For felling trees (a job still to come).',
  shovel: 'For digging (a job still to come).',
  hammer: 'For building and smithing (jobs still to come).',
  lockpicks: 'For picking locked doors (lockpicking comes later).',
  bedroll: 'Sleep out in the wild (camping comes later).',
  grapple: 'Hook and line, to pull yourself up walls (coming later).',
  scanner: 'Shows what is hidden nearby (coming later).',
  drone: 'A little flying drone that scouts ahead (coming later).',
  nightlens: 'See in the dark (coming later).',
  compass: 'Always knows which way is north.',
  iron: 'An iron bar for the smith.',
  leather: 'Tanned hide for armour and clothes.',
  cloth: 'A bolt of woven cloth for the tailor.',
  bone: 'Big bones. The apex build with them.',
  stone: 'A cut building stone.',
  glass: 'A pane of glass.',
  oil: 'Fuel for lanterns and machines.',
  crystal: 'A crystal that glows faintly. Rare and valuable.',
  firebomb: 'Hold it and click to throw. Bursts into flame: a hard blow to everyone within 4 m.',
  poisonflask: 'Hold it and click to throw. A green cloud for 7 s that hurts whoever stands in it.',
  smokebomb: 'Hold it and click to throw. A thick cloud: bandits nearby lose you and go home.',
  socket: 'Fitted behind the ear (use it once). Lets anyone who is not a cyborg use modules. Holds two.',
  translate: 'A module for the socket: understand other clans’ speech and read old writing.',
  nighteye: 'A module for the socket: see in the dark.',
  mapmod: 'A module for the socket: you explore twice as far around you, so the map fills faster.',
};

// What each effect does, in a sentence.
const EFFECT_TEXT = {
  wellfed: 'You heal twice as fast',
  energised: 'Your stamina lasts half as long again',
  strength: 'You hit 30% harder',
  swift: 'You run 25% faster',
  ironskin: 'Your skin turns hard as iron: +4 armour',
  endurance: 'Running costs half the stamina',
  nightsight: 'You see in the dark',
  shadow: 'Bandits notice you only when you are very close',
};

const SLOT = { head: 'head', body: 'body', hands: 'hands', feet: 'feet' };

export function describe(key) {
  const it = ITEMS[key];
  const lines = [];
  if (it.food) lines.push(`Fills ${Math.round(it.food * 100)}% of your hunger.`);
  if (it.heal) lines.push(`Heals ${it.heal} health.`);
  if (it.stamina) lines.push('Refills your stamina.');
  if (it.cure) lines.push('Cures poison.');
  if (it.effect) lines.push(`${EFFECT_TEXT[it.effect] ?? EFFECTS[it.effect]?.name ?? it.effect} for ${Math.round(it.seconds / 60 * 10) / 10} minutes.`);
  if (it.slot) lines.push(`Worn on the ${SLOT[it.slot]}: armour ${it.armour} (soaks ${it.armour * 5}% of every blow).`);
  if (it.weapon) lines.push(...weaponLines(it.weapon));
  if (ABOUT[key]) lines.push(ABOUT[key]);
  lines.push(`Weighs ${it.weight} kg. Sells back for ${it.value} gold.`);
  return lines;
}
