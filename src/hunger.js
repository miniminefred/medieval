import { hud } from './hud.js';

// Hunger and the effects food (and the lack of it) have on you (docs/DESIGN.md).
//
// Full to empty in about 15 real minutes awake — two meals a game day. Running
// and healing burn it faster; a night's sleep costs only a little. Food fills it
// and can give an effect for a while:
//   Well fed    health comes back twice as fast
//   Energised   stamina lasts half as long again
//   Warmed      (stew) both, a little
// At empty you are **Starving**: no running, 10 kg less carrying, no health
// coming back, and your blows land softer — until you eat.

const EMPTY_SECONDS = 15 * 60;
const SLEEP_COST = 0.12;          // a whole night's sleep

export const EFFECTS = {
  wellfed: { name: 'Well fed', good: true },
  energised: { name: 'Energised', good: true },
  starving: { name: 'Starving', good: false },
  poisoned: { name: 'Poisoned', good: false },
};

let food = 0.85;                   // 0 empty .. 1 full
const timers = {};                 // effect key -> seconds left (Infinity for states)

function refresh() {
  hud.hunger(food);
  hud.effects(Object.keys(timers).filter((k) => timers[k] > 0).map((k) => EFFECTS[k]));
}

export const hunger = {
  get food() { return food; },
  get starving() { return food <= 0; },
  has(effect) { return (timers[effect] ?? 0) > 0; },

  // Each frame: what you are doing burns it faster.
  update(dt, { running = false, healing = false } = {}) {
    const rate = (1 + (running ? 1.2 : 0) + (healing ? 0.8 : 0)) / EMPTY_SECONDS;
    const was = food;
    food = Math.max(0, food - rate * dt);
    for (const k of Object.keys(timers)) if (timers[k] !== Infinity) timers[k] = Math.max(0, timers[k] - dt);
    if (food <= 0 && !timers.starving) { timers.starving = Infinity; hud.toast('You are starving. Eat something.'); }
    if (was > 0.25 && food <= 0.25) hud.toast('You are getting hungry.');
    refresh();
  },

  // Sleeping through the night costs little.
  slept() { food = Math.max(0, food - SLEEP_COST); refresh(); },

  // Eat or drink: fill up, maybe gain an effect for `seconds`.
  eat(amount, effect = null, seconds = 0) {
    food = Math.min(1, food + amount);
    if (food > 0) delete timers.starving;
    if (effect) timers[effect] = Math.max(timers[effect] ?? 0, seconds);
    refresh();
  },

  // Poison shows as an effect too (combat.js sets and clears it).
  setPoisoned(on) { if (on) timers.poisoned = Infinity; else delete timers.poisoned; refresh(); },

  // Multipliers the rest of the game asks for.
  get regen() { return this.starving ? 0 : this.has('wellfed') ? 2 : 1; },
  get damage() { return this.starving ? 0.7 : 1; },
  get stamina() { return this.has('energised') ? 1.5 : 1; },
  get capacityPenalty() { return this.starving ? 10 : 0; },
};
