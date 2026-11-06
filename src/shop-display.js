import { ITEMS } from './inventory.js';

// What a shop sells, on display (docs/DESIGN.md, 2026-11-06): a shelf unit
// against the wall behind the counter with one of each thing for sale — blades
// lying on the boards, helmets and breastplates, bottles, loaves, ingots, bolts
// of cloth, gadgets glowing — so you can see what the keeper has before asking.
// Built through the kit (b) in house-local coordinates, like shop-floors.js.

const MATERIAL_KEY = {
  iron: 'gunmetal', leather: 'hide', cloth: 'linen', planks: 'timber', glass: 'glass', stone: 'housestone',
  bone: 'bone', scrap: 'rust', gears: 'gunmetal', wire: 'pewter', oil: 'pottery', coin: 'brass', gem: 'potionred',
  crystal: 'glow', cell: 'glow',
};
const POTION_KEY = {
  potion: 'potionred', antidote: 'potiongreen', strengthpot: 'potionred', swiftpot: 'potionblue', ironskin: 'pewter',
  endurance: 'potiongreen', nightsight: 'potionblue', shadowpot: 'gunmetal',
};
const FOOD_KEY = { bread: 'bread', pie: 'bread', meat: 'meat', fish: 'fishscale', freshfish: 'fishscale', cheese: 'wax', apple: 'meat', stew: 'pottery', water: 'pottery', juice: 'potionred' };

// One item, standing (or lying) on a board at (x, y, z).
function token(b, key, x, y, z) {
  const it = ITEMS[key];
  if (!it) return;
  if (it.weapon && !['knives', 'rod'].includes(it.weapon)) {
    const long = { greatsword: 0.6, longsword: 0.5, rapier: 0.5, battleaxe: 0.5, warhammer: 0.5 }[key] ?? 0.36;
    b.box(it.weapon === 'baton' || it.weapon === 'plasma' ? 'gunmetal' : 'pewter', x, y + 0.01, z, long, 0.025, 0.05, { yaw: 0.15 });
    b.box('timber', x - long / 2 - 0.05, y + 0.01, z, 0.1, 0.03, 0.035, { yaw: 0.15 });
    if (['mace', 'warhammer', 'battleaxe', 'flail', 'club'].includes(key)) b.box('gunmetal', x + long / 2, y, z, 0.1, 0.09, 0.1);
    if (it.weapon === 'buzzsaw' || it.weapon === 'baton' || it.weapon === 'plasma') b.box('glow', x + long / 2, y + 0.02, z, 0.04, 0.04, 0.04);
  } else if (it.weapon === 'knives') {
    for (let i = 0; i < 3; i++) b.box('pewter', x - 0.08 + i * 0.08, y + 0.01, z, 0.025, 0.012, 0.22);
  } else if (it.slot === 'head') {
    b.cylinder(key === 'hood' ? 'linen' : 'rust', x, y, z, 0.11, 0.14, { rTop: 0.07, sides: 12 });
  } else if (it.slot === 'body') {
    b.box(key === 'jerkin' ? 'hide' : 'rust', x, y, z, 0.3, 0.34, 0.1);
  } else if (it.slot) {
    for (const e of [-1, 1]) b.box(key === 'boots' ? 'hide' : 'hide', x + e * 0.07, y, z, 0.08, key === 'boots' ? 0.14 : 0.04, 0.16);
  } else if (POTION_KEY[key] || it.kind === 'potion') {
    for (let i = 0; i < 3; i++) b.cylinder(POTION_KEY[key] ?? 'potionred', x - 0.1 + i * 0.1, y, z, 0.035, 0.13, { sides: 10 });
  } else if (it.bomb) {
    for (let i = 0; i < 2; i++) b.cylinder({ fire: 'potionred', poison: 'potiongreen', smoke: 'pewter' }[it.bomb], x - 0.06 + i * 0.12, y, z, 0.05, 0.1, { rTop: 0.025, sides: 10 });
  } else if (FOOD_KEY[key]) {
    b.cylinder(FOOD_KEY[key], x, y + 0.06, z, 0.06, 0.24, { roll: Math.PI / 2, sides: 10 });
  } else if (it.module || it.socket || it.kind === 'gadget') {
    b.box('gunmetal', x, y, z, 0.14, 0.06, 0.1);
    b.box('glow', x, y + 0.06, z, 0.06, 0.02, 0.06);
  } else if (MATERIAL_KEY[key] || it.kind === 'material' || it.kind === 'valuable') {
    b.box(MATERIAL_KEY[key] ?? 'timber', x, y, z, 0.2, 0.07, 0.12);
  } else {
    // Tools and the rest: a handle and a head.
    b.box('timber', x, y + 0.01, z, 0.36, 0.03, 0.03, { yaw: 0.2 });
    b.box('gunmetal', x + 0.18, y, z, 0.08, 0.08, 0.06, { yaw: 0.2 });
  }
}

// A shelf unit `width` wide against a wall at (x, z) facing +z (turned by yaw:
// only 0 is used), with one of each of `sells` on its three boards.
export function displayShelf(b, x, z, width, sells) {
  const boards = [0.55, 1.05, 1.55];
  for (const y of boards) b.box('timber', x, y - 0.04, z, width, 0.04, 0.38);
  for (const e of [-1, 1]) b.box('timber', x + e * (width / 2), 0, z, 0.05, 1.9, 0.38);
  b.box('timber', x, 1.9, z, width + 0.1, 0.05, 0.4);
  b.collider(x - width / 2, x + width / 2, z - 0.2, z + 0.2, 1.95);
  const per = Math.max(1, Math.floor(width / 0.42));
  sells.slice(0, per * boards.length).forEach((key, i) => {
    const row = Math.floor(i / per), col = i % per;
    token(b, key, x - width / 2 + (col + 0.5) * (width / per), boards[row], z + 0.02);
  });
}
