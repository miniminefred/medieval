import { allQuests, activeQuest } from './quests.js';
import { inventory, ITEMS } from './inventory.js';
import { PLACES, ROADS, CAMPS } from './wasteland/places.js';
import { CITY } from './wasteland/terrain.js';

// Tab: one screen with the quest journal on the left and the map of World 1 on
// the right (docs/DESIGN.md). Opening it releases the mouse so it can be read in
// peace; closing it (Tab or Esc) asks for the mouse back.

const HALF = 1500;

export function createJournal(controls) {
  const el = document.getElementById('journal');
  const map = document.getElementById('journal-map');
  const list = document.getElementById('journal-quests');
  const bag = document.getElementById('journal-bag');
  let open = false;
  let playerPos = { x: 0, z: 0 };
  let realmName = 'castle';

  function drawMap() {
    const g = map.getContext('2d');
    const S = map.width;
    const px = (x) => ((x + HALF) / (2 * HALF)) * S;
    g.clearRect(0, 0, S, S);
    // Land: desert, the snow line, the storm rim.
    g.fillStyle = '#c9ad84'; g.fillRect(0, 0, S, S);
    const grad = g.createLinearGradient(0, px(530), 0, px(760));
    grad.addColorStop(0, '#c9ad84'); grad.addColorStop(1, '#e9eef2');
    g.fillStyle = grad; g.fillRect(0, px(530), S, S);
    g.strokeStyle = 'rgba(120, 80, 40, 0.5)'; g.lineWidth = S * 0.05;
    g.strokeRect(px(-1130), px(-1130), px(1130) - px(-1130), px(1130) - px(-1130));
    // Roads.
    g.strokeStyle = '#7a6142'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (const road of ROADS) {
      g.beginPath();
      road.forEach((p, i) => (i ? g.lineTo(px(p.x), px(p.z)) : g.moveTo(px(p.x), px(p.z))));
      g.stroke();
    }
    // The cyborg city.
    g.fillStyle = '#6f6a62'; g.strokeStyle = '#3b3833'; g.lineWidth = 2;
    g.fillRect(px(CITY.minX), px(CITY.minZ), px(CITY.maxX) - px(CITY.minX), px(CITY.maxZ) - px(CITY.minZ));
    g.strokeRect(px(CITY.minX), px(CITY.minZ), px(CITY.maxX) - px(CITY.minX), px(CITY.maxZ) - px(CITY.minZ));
    // Places and camps.
    const label = (x, z, text, color = '#2a1f14') => {
      g.fillStyle = color; g.font = `bold ${Math.round(S / 46)}px Georgia`; g.textAlign = 'center';
      g.fillText(text, px(x), px(z));
    };
    label(640, 395, 'Cyborg city', '#1d1b18');
    label(PLACES.farmville.x, PLACES.farmville.z - 18, 'Farmville');
    label(PLACES.bruteCity.x, PLACES.bruteCity.z - 22, 'Brute city');
    label(PLACES.apexCity.x, PLACES.apexCity.z + 34, 'Apex city (ruins)');
    label(PLACES.dragonCity.x, PLACES.dragonCity.z - 22, 'Dragon city (ruins)');
    label(PLACES.portalW2.x, PLACES.portalW2.z + 40, 'Portal to World 2');
    g.fillStyle = '#8a1d14';
    for (const c of CAMPS) { g.beginPath(); g.arc(px(c.x), px(c.z), c.big ? 6 : 4, 0, Math.PI * 2); g.fill(); }
    // The quest goal.
    const q = activeQuest();
    if (q?.goal?.realm === 'wasteland') {
      g.strokeStyle = '#2b8ad8'; g.lineWidth = 3;
      g.beginPath(); g.arc(px(q.goal.x), px(q.goal.z), 11, 0, Math.PI * 2); g.stroke();
    }
    // You.
    if (realmName === 'wasteland') {
      g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.arc(px(playerPos.x), px(playerPos.z), 5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  function render() {
    const quests = allQuests();
    list.innerHTML = quests.length
      ? quests.slice().reverse().map((q) => `
          <div class="quest ${q.done ? 'done' : ''}">
            <div class="title">${q.title}${q.done ? ' — done' : ''}</div>
            <div class="text">${q.text}</div>
          </div>`).join('')
      : '<div class="quest"><div class="text">No quests yet. Find the orb\'s light.</div></div>';
    const items = inventory.items;
    bag.innerHTML = `<div class="gold">${inventory.gold} gold</div>` +
      (items.length ? items.map(([k, n]) => `<div>${ITEMS[k].name}${n > 1 ? ` ×${n}` : ''}</div>`).join('') : '<div class="empty">Nothing else.</div>');
    drawMap();
  }

  function setOpen(on) {
    open = on;
    el.classList.toggle('visible', on);
    if (on) { render(); controls.unlock(); }
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      if (open) { setOpen(false); controls.lock(); } else setOpen(true);
    }
  });
  controls.addEventListener('lock', () => { if (open) setOpen(false); });

  return {
    get open() { return open; },
    update(name, pos) { realmName = name; playerPos = pos; },
    refresh() { if (open) render(); },
  };
}
