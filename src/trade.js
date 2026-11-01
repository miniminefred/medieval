import { inventory, ITEMS } from './inventory.js';
import { hud } from './hud.js';

// The two item screens (docs/DESIGN.md):
//   I       your inventory — every item with its weight; click to use, eat or
//           equip; the total against what you can carry.
//   trader  a trade window — what they sell on the left (click to buy one), what
//           you carry on the right (click to sell one).
// Both release the mouse while open; Esc, I, or the close button shuts them.

let controls = null;
let openPanel = null;          // 'inventory' | 'trade' | null
let currentShop = null;
let useHandler = () => false;  // main.js: what using an item does

const $ = (id) => document.getElementById(id);

function row(key, n, right) {
  const it = ITEMS[key];
  return `<button class="item" data-key="${key}">
    <span class="name">${it.name}${n > 1 ? ` <span class="n">×${n}</span>` : ''}</span>
    <span class="meta">${it.weight} kg</span>
    <span class="price">${right}</span></button>`;
}

// What clicking an item in the inventory does, as a word.
function action(k) {
  const it = ITEMS[k];
  if (it.slot) return inventory.isWorn(k) ? 'worn — take off' : 'wear';
  if (it.food || it.heal || it.cure) return 'eat / drink';
  if (it.weapon) return 'hold';
  if (it.light) return lightOn === k ? 'lit — put out' : 'light';
  return '';
}
let lightOn = null;
export function setLightShown(k) { lightOn = k; }

function renderInventory() {
  const el = $('inventory');
  const items = inventory.items;
  const w = inventory.weight;
  el.querySelector('.list').innerHTML = items.length
    ? items.map(([k, n]) => row(k, n, action(k))).join('')
    : '<div class="empty">You carry nothing but the old sword.</div>';
  el.querySelector('.gold').textContent = `${inventory.gold} gold`;
  el.querySelector('.weight').innerHTML = `${w.toFixed(1)} / ${inventory.capacity} kg${inventory.overloaded ? ' <span class="over">— too heavy: you cannot run</span>' : ''}` +
    (inventory.armour ? ` &nbsp;·&nbsp; armour ${inventory.armour}` : '');
  el.querySelectorAll('.item').forEach((b) => b.onclick = () => {
    if (useHandler(b.dataset.key)) renderInventory();
  });
}

function renderTrade() {
  const el = $('trade');
  const shop = currentShop;
  el.querySelector('.title').textContent = shop.name;
  el.querySelector('.sells').innerHTML = shop.sells.map((k) => row(k, 0, `${ITEMS[k].price} gold`)).join('');
  const mine = inventory.items;
  el.querySelector('.buys').innerHTML = mine.length
    ? mine.map(([k, n]) => row(k, n, `${ITEMS[k].value} gold`)).join('')
    : '<div class="empty">Nothing to sell.</div>';
  el.querySelector('.gold').textContent = `${inventory.gold} gold`;
  el.querySelector('.weight').textContent = `${inventory.weight.toFixed(1)} / ${inventory.capacity} kg`;
  el.querySelectorAll('.sells .item').forEach((b) => b.onclick = () => {
    if (!inventory.buyOne(b.dataset.key)) hud.toast('You cannot afford that.');
    renderTrade();
  });
  el.querySelectorAll('.buys .item').forEach((b) => b.onclick = () => {
    inventory.sellOne(b.dataset.key);
    renderTrade();
  });
}

function close() {
  if (!openPanel) return;
  $(openPanel).classList.remove('visible');
  openPanel = null;
  controls.lock();
}

function open(id) {
  if (openPanel) $(openPanel).classList.remove('visible');
  openPanel = id;
  $(id).classList.add('visible');
  controls.unlock();
}

export const trade = {
  init(c) {
    controls = c;
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyI') {
        if (openPanel === 'inventory') close();
        else if (!openPanel) { open('inventory'); renderInventory(); }
      }
      if (e.code === 'Escape') close();
    });
    for (const id of ['inventory', 'trade']) $(id).querySelector('.close').onclick = close;
    controls.addEventListener('lock', () => { if (openPanel) { $(openPanel).classList.remove('visible'); openPanel = null; } });
    inventory.onChange(() => { if (openPanel === 'inventory') renderInventory(); });
  },
  get open() { return openPanel !== null; },
  onUse(fn) { useHandler = fn; },
  // A shop: { name, sells: [item keys] }.
  openShop(shop) {
    currentShop = shop;
    open('trade');
    renderTrade();
  },
};
