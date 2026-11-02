import { inventory, ITEMS } from './inventory.js';
import { hud } from './hud.js';
import { dealOf, priceAt, basePrice } from './shops.js';
import { describe } from './item-info.js';

// The two item screens (docs/DESIGN.md):
//   I       your inventory — every item with its weight; click to use, eat or
//           equip; the total against what you can carry.
//   trader  a trade window — what they sell on the left, what you carry on the
//           right. Clicking an item shows what it does and what it costs (or
//           what they pay); then you buy (or sell) it, or not.
// Both release the mouse while open; Esc, I, or the close button shuts them.

let controls = null;
let openPanel = null;          // 'inventory' | 'trade' | null
let currentShop = null;
let picked = null;             // { side: 'buy' | 'sell', key } — shown in the info box
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
  const r = shop.rate ?? 1;
  el.querySelector('.title').textContent = shop.name + (r < 0.97 ? ' — cheaper than the market' : r > 1.03 ? ' — dearer than the market' : '');
  const deal = dealOf(shop);
  el.querySelector('.sells').innerHTML = shop.sells.map((k) => row(k, 0, deal?.item === k
    ? `<span class="sale">−${Math.round(deal.off * 100)}%</span> <s>${basePrice(shop, k)}</s> ${priceAt(shop, k)} gold`
    : `${basePrice(shop, k)} gold`)).join('');
  const mine = inventory.items;
  el.querySelector('.buys').innerHTML = mine.length
    ? mine.map(([k, n]) => row(k, n, `${ITEMS[k].value} gold`)).join('')
    : '<div class="empty">Nothing to sell.</div>';
  el.querySelector('.gold').textContent = `${inventory.gold} gold`;
  el.querySelector('.weight').textContent = `${inventory.weight.toFixed(1)} / ${inventory.capacity} kg`;
  // The picked item: what it does, what it costs, and the choice.
  if (picked?.side === 'sell' && !inventory.count(picked.key)) picked = null;
  const info = el.querySelector('.info');
  if (picked) {
    const k = picked.key, it = ITEMS[k], buying = picked.side === 'buy';
    const cost = buying
      ? (deal?.item === k ? `<s>${basePrice(shop, k)}</s> ${priceAt(shop, k)} gold — today's deal` : `${priceAt(shop, k)} gold`)
      : `They pay ${it.value} gold`;
    const can = buying ? inventory.gold >= priceAt(shop, k) : true;
    info.innerHTML = `<h4>${it.name}</h4>${describe(k).map((l) => `<p>${l}</p>`).join('')}
      <p class="cost">${buying ? 'Costs ' : ''}${cost}</p>
      <div class="choice"><button class="yes" ${can ? '' : 'disabled'}>${buying ? (can ? 'Buy' : 'Not enough gold') : 'Sell one'}</button>
      <button class="no">${buying ? 'No thanks' : 'Keep it'}</button></div>`;
    info.querySelector('.yes').onclick = () => {
      if (buying) { if (!inventory.buyOne(k, priceAt(shop, k))) hud.toast('You cannot afford that.'); }
      else inventory.sellOne(k);
      renderTrade();
    };
    info.querySelector('.no').onclick = () => { picked = null; renderTrade(); };
    const list = buying ? '.sells' : '.buys';
    el.querySelector(`${list} .item[data-key="${k}"]`)?.classList.add('picked');
  } else info.innerHTML = '';
  el.querySelectorAll('.sells .item').forEach((b) => b.onclick = () => {
    picked = { side: 'buy', key: b.dataset.key };
    renderTrade();
  });
  el.querySelectorAll('.buys .item').forEach((b) => b.onclick = () => {
    picked = { side: 'sell', key: b.dataset.key };
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
    picked = null;
    open('trade');
    renderTrade();
  },
};
