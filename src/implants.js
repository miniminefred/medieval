import { hud } from './hud.js';
import { inventory, ITEMS } from './inventory.js';
import { currentClan } from './clans.js';

// Cyborg parts (docs/DESIGN.md, 2026-11-06). Modules — "inserters" — go into a
// neural socket: cyborgs are born with one; anyone else buys one and has it
// fitted (once, and it is expensive). A socket holds two modules at a time.
//
//   translate   reads other clans' speech and old writing (where the story uses it)
//   nighteye    see in the dark
//   mapmod      the map shows more: you explore twice as far round you
//
// A module in the socket is out of your pack; take it out to carry it again.

const SLOTS = 2;
let fitted = false;                  // a socket fitted (non-cyborgs)
const inSocket = new Set();

export const implants = {
  get socket() { return fitted || currentClan() === 'cyborgs'; },
  has(module) { return inSocket.has(module); },
  get modules() { return [...inSocket]; },

  // Using a socket item: have it fitted.
  fitSocket() {
    if (this.socket) { hud.toast(currentClan() === 'cyborgs' ? 'You were born with a socket.' : 'You already have a socket.'); return false; }
    inventory.addItem('socket', -1);
    fitted = true;
    hud.toast('The socket is fitted, behind your ear. Modules can go in now.');
    return true;
  },

  // Using a module item: put it in, or (if it is in) take it out.
  toggle(key) {
    const mod = ITEMS[key].module;
    if (inSocket.has(mod)) {
      inSocket.delete(mod);
      inventory.addItem(key);
      hud.toast(`You take out the ${ITEMS[key].name.toLowerCase()}.`);
      return true;
    }
    if (!this.socket) { hud.toast('You need a neural socket for that. (Cyborgs are born with one.)'); return false; }
    if (inSocket.size >= SLOTS) { hud.toast(`Your socket holds ${SLOTS} modules. Take one out first.`); return false; }
    inventory.addItem(key, -1);
    inSocket.add(mod);
    hud.toast(`The ${ITEMS[key].name.toLowerCase()} clicks into place.`);
    return true;
  },
};
