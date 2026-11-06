import { inventory, ITEMS } from './inventory.js';
import { hud } from './hud.js';
import { dealsOf, priceAt, basePrice, discountsAt, termsOf, spentAt, recordSpend, haggleState, moodOf, LINES, talk } from './shops.js';
import { describe } from './item-info.js';
import { THEMES, keeperSVG } from './shop-themes.js';

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

function pct(f) { return `${Math.round(f * 100)}%`; }

// The line under the shop's name: every discount (or penalty) you have here.
function termsLine(shop) {
  const D = discountsAt(shop), T = termsOf(shop), out = [];
  if (D.clan) out.push(`clan price −${pct(D.clan)}`);
  if (D.friend) out.push(`a regular here −${pct(D.friend)}`);
  else out.push(`spend ${T.friendAt - spentAt(shop)} more gold here to be a regular (−${pct(T.friend)})`);
  if (D.haggle) out.push(`haggled −${pct(D.haggle)} today`);
  if (D.penalty) out.push(`<span class="over">annoyed the keeper: +${pct(D.penalty)} today</span>`);
  out.push(`buy 3 or more: −${pct(D.bulk)} each`);
  return out.join(' &nbsp;·&nbsp; ');
}

// Haggling: pick what to say; the keeper answers.
const REPLIES = {
  ok: ['Hmph. For you, then.', 'Fine, fine. You drive a hard bargain.', 'Ha! I like you. Have it cheaper.'],
  no: ['Out of the question. And now it costs a little more.', 'Are you trying to rob me? Prices just went up.', 'Cheek! See if I give you a good price today.'],
};
let talkReply = null;
function renderTalk(shop) {
  const box = $('trade').querySelector('.info');
  const st = haggleState(shop);
  const mood = moodOf(shop);
  const face = mood > 0.66 ? 'cheerful' : mood > 0.33 ? 'busy' : 'in a sour mood';
  if (st.done) {
    box.innerHTML = `<h4>Talking with the keeper</h4><p><i>${talkReply ?? 'You have already haggled here today.'}</i></p>
      <div class="choice"><button class="no">Back to the goods</button></div>`;
  } else {
    box.innerHTML = `<h4>Talking with the keeper</h4><p>The keeper looks ${face} today. What do you say?</p>
      <div class="lines">${Object.entries(LINES).map(([k, L]) => `<button class="line" data-line="${k}">“${L.text}”</button>`).join('')}</div>
      <p class="hint">Cleverer princes haggle better. Fail, and prices go up for the day. One try a day.</p>
      <div class="choice"><button class="no">Never mind</button></div>`;
    box.querySelectorAll('.line').forEach((b) => b.onclick = () => {
      const r = talk(shop, b.dataset.line);
      const pool = r.ok ? REPLIES.ok : REPLIES.no;
      talkReply = `“${pool[Math.floor(Math.random() * pool.length)]}” ${r.ok ? `(−${pct(r.off)} today)` : `(+${pct(r.penalty)} today)`}`;
      renderTrade();
    });
  }
  box.querySelector('.no').onclick = () => { talkReply = null; picked = null; renderTrade(); };
}

function renderTrade() {
  const el = $('trade');
  const shop = currentShop;
  const r = shop.rate ?? 1;
  el.querySelector('.title').textContent = shop.name + (r < 0.97 ? ' — cheaper than the market' : r > 1.03 ? ' — dearer than the market' : '');
  el.querySelector('.terms').innerHTML = termsLine(shop);
  // The shop's own look: colours, the keeper's picture.
  const th = THEMES[shop.theme] ?? THEMES.market, page = el.querySelector('.page');
  page.style.setProperty('--shop-paper', th.paper);
  page.style.setProperty('--shop-ink', th.ink);
  page.style.setProperty('--shop-accent', th.accent);
  page.classList.add('themed');
  el.querySelector('.keeper').innerHTML = keeperSVG(shop.theme);
  const deals = dealsOf(shop);
  const dealOn = (k) => deals.find((d) => d.item === k);
  el.querySelector('.sells').innerHTML = shop.sells.map((k) => {
    const d = dealOn(k), now = priceAt(shop, k), base = basePrice(shop, k);
    return row(k, 0, d ? `<span class="sale">−${pct(d.off)}</span> <s>${base}</s> ${now} gold` : now !== base ? `<s>${base}</s> ${now} gold` : `${now} gold`);
  }).join('');
  const mine = inventory.items;
  el.querySelector('.buys').innerHTML = mine.length
    ? mine.map(([k, n]) => row(k, n, `${ITEMS[k].value} gold`)).join('')
    : '<div class="empty">Nothing to sell.</div>';
  el.querySelector('.gold').textContent = `${inventory.gold} gold`;
  el.querySelector('.weight').textContent = `${inventory.weight.toFixed(1)} / ${inventory.capacity} kg`;
  el.querySelector('.talkbtn').onclick = () => { picked = { side: 'talk' }; renderTrade(); };
  // The picked item: what it does, what it costs, and the choice.
  if (picked?.side === 'sell' && !inventory.count(picked.key)) picked = null;
  const info = el.querySelector('.info');
  if (picked?.side === 'talk') renderTalk(shop);
  else if (picked) {
    const k = picked.key, it = ITEMS[k], buying = picked.side === 'buy';
    const one = priceAt(shop, k), bulk = priceAt(shop, k, 3);
    const d = dealOn(k);
    const cost = buying
      ? `${basePrice(shop, k) !== one ? `<s>${basePrice(shop, k)}</s> ` : ''}${one} gold each${d ? ' — one of today’s deals' : ''}; ${bulk} gold each for 3 or more`
      : `They pay ${it.value} gold`;
    const btn = (n) => {
      const each = priceAt(shop, k, n), total = each * n, can = inventory.gold >= total;
      return `<button class="yes" data-n="${n}" ${can ? '' : 'disabled'}>Buy ${n} — ${total} gold</button>`;
    };
    info.innerHTML = `<h4>${it.name}</h4>${describe(k).map((l) => `<p>${l}</p>`).join('')}
      <p class="cost">${buying ? 'Costs ' : ''}${cost}</p>
      <div class="choice">${buying ? btn(1) + btn(3) + btn(5) : '<button class="yes" data-n="1">Sell one</button>'}
      <button class="no">${buying ? 'No thanks' : 'Keep it'}</button></div>`;
    info.querySelectorAll('.yes').forEach((b) => b.onclick = () => {
      const n = +b.dataset.n;
      if (buying) {
        const each = priceAt(shop, k, n);
        let got = 0;
        for (let i = 0; i < n; i++) if (inventory.buyOne(k, each)) got++;
        if (got) recordSpend(shop, each * got);
        if (got < n) hud.toast('You cannot afford that.');
      } else inventory.sellOne(k);
      renderTrade();
    });
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
    talkReply = null;
    open('trade');
    renderTrade();
  },
};
