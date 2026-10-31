// The on-screen layer, all in one place: the stamina bar, the gold count, the
// orb's words, the "press E" prompt and short news messages. Elements live in
// index.html under #hud (pointer-events: none, so nothing here can steal the
// click that grabs the mouse); this module only ever sets text and classes.

const $ = (id) => document.getElementById(id);

let toastTimer = 0;
let sayTimer = 0;
let staminaShownFor = 0;

export const hud = {
  // Stamina shows only while you run and while it refills after, then fades.
  stamina(frac, running, winded, dt) {
    const el = $('stamina');
    if (!el) return;
    if (running) staminaShownFor = 1.2;
    else if (frac < 1) staminaShownFor = Math.max(staminaShownFor, 0.4);
    else staminaShownFor = Math.max(0, staminaShownFor - dt);
    el.classList.toggle('visible', staminaShownFor > 0);
    el.classList.toggle('winded', winded);
    el.firstElementChild.style.width = `${(frac * 100).toFixed(1)}%`;
  },

  gold(amount) {
    const el = $('gold');
    if (el) el.textContent = `${amount} gold`;
  },

  // A line of news across the top of the screen.
  toast(text, seconds = 4.5) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), seconds * 1000);
  },

  // The orb's voice: subtitles along the bottom. The game keeps running.
  say(text, seconds) {
    const el = $('subtitle');
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(sayTimer);
    const t = seconds ?? Math.max(3.5, text.length / 14);
    sayTimer = setTimeout(() => el.classList.remove('visible'), t * 1000);
  },

  // The time bar: the hour as a mark along the bar, sun by day, moon by night.
  time(hour, label, night) {
    const bar = $('timebar');
    if (!bar) return;
    const mark = bar.querySelector('.mark');
    mark.style.left = `${((hour / 24) * 100).toFixed(2)}%`;
    mark.classList.toggle('moon', night);
    bar.querySelector('.label').textContent = label;
  },

  // "Press E to …" under the crosshair, or nothing.
  prompt(text) {
    const el = $('prompt');
    if (!el) return;
    if (text) el.innerHTML = text;
    el.classList.toggle('visible', !!text);
  },
};
