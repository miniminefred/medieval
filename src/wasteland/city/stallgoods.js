import { mulberry32 } from '../../noise.js';

// What lies on the market's counters and shelves (market.js). Each function gets
// the stall's own placing helpers — `put` (a box), `cyl` (a cylinder), in the
// stall's local space — plus where the counter top and back shelves are, and
// lays out goods shaped to read as the real thing: swords with guards and grips,
// axes, shields, helmets, potion bottles, gadgets with lit screens, mechanical
// arms, engines and wheels. `fill` dresses round the stall: crates, baskets,
// lanterns hanging from the awning.
//
// The function names matter: market.js records each stall's wares by name, and
// shops.js keys the stall's shop on it.

const rand = mulberry32(7171);
const between = (a, b) => a + rand() * (b - a);

// ------------------------------------------------------------- the things

function sword(put, cyl, lx, ly, lz, len = 0.9, lean = 0) {
  put('pewter', lx, ly + 0.2, lz, 0.05, len * 0.72, 0.012, { roll: lean });       // blade
  put('pewter', lx, ly + 0.2 + len * 0.72, lz, 0.03, 0.06, 0.012, { roll: lean }); // tip
  put('rust', lx, ly + 0.17, lz, 0.2, 0.03, 0.04, { roll: lean });                 // crossguard
  cyl('timber', lx, ly + 0.03, lz, 0.017, 0.14, { sides: 8 });                     // grip
  cyl('rust', lx, ly, lz, 0.026, 0.03, { sides: 8 });                              // pommel
}

function axe(put, cyl, lx, ly, lz) {
  cyl('timber', lx, ly, lz, 0.02, 0.75, { sides: 8 });
  put('pewter', lx + 0.07, ly + 0.62, lz, 0.14, 0.14, 0.02);
  put('pewter', lx + 0.16, ly + 0.62, lz, 0.04, 0.2, 0.015);                       // the flared edge
}

function shield(put, cyl, lx, ly, lz) {
  cyl('timber', lx, ly, lz, 0.32, 0.04, { pitch: Math.PI / 2, sides: 20 });
  cyl('rust', lx, ly, lz + 0.03, 0.08, 0.04, { pitch: Math.PI / 2, sides: 12 });  // the boss
  cyl('rust', lx, ly, lz, 0.325, 0.02, { pitch: Math.PI / 2, sides: 20 });         // the rim
}

function helmet(put, cyl, lx, ly, lz) {
  cyl('steel', lx, ly, lz, 0.05, 0.16, { rBottom: 0.13, sides: 14 });
  cyl('steel', lx, ly, lz, 0.14, 0.02, { sides: 14 });
  put('steel', lx, ly - 0.06, lz + 0.11, 0.03, 0.12, 0.02);                        // nose guard
}

function bottle(put, cyl, lx, ly, lz, liquid) {
  cyl('glass', lx, ly, lz, 0.045, 0.13, { sides: 10 });
  cyl(liquid, lx, ly + 0.005, lz, 0.038, 0.09, { sides: 10 });
  cyl('glass', lx, ly + 0.13, lz, 0.016, 0.05, { sides: 8 });
  cyl('timber', lx, ly + 0.18, lz, 0.018, 0.02, { sides: 8 });                     // cork
}

function gadget(put, cyl, lx, ly, lz) {
  const w = between(0.2, 0.34), h = between(0.1, 0.22);
  put(rand() < 0.5 ? 'steel' : 'gunmetal', lx, ly, lz, w, h, 0.18);
  put('glow', lx, ly + h * 0.35, lz + 0.092, w * 0.6, h * 0.4, 0.01);               // the screen
  for (const bx of [-w / 3, 0, w / 3]) cyl('rust', lx + bx, ly + h * 0.12, lz + 0.095, 0.012, 0.01, { pitch: Math.PI / 2, sides: 8 });
  if (rand() < 0.5) cyl('gunmetal', lx + w / 2 - 0.03, ly + h, lz, 0.006, 0.18, { sides: 5 }); // aerial
}

function drone(put, cyl, lx, ly, lz) {
  cyl('gunmetal', lx, ly + 0.05, lz, 0.09, 0.05, { sides: 14 });
  cyl('glow', lx, ly + 0.03, lz, 0.03, 0.02, { sides: 10 });
  for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    put('gunmetal', lx + ax * 0.08, ly + 0.08, lz + az * 0.08, 0.13, 0.015, 0.02, { yaw: Math.atan2(az, ax) });
    cyl('steel', lx + ax * 0.15, ly + 0.09, lz + az * 0.15, 0.06, 0.006, { sides: 14 });
  }
}

function mechArm(put, cyl, lx, ly, lz) {
  cyl('steel', lx - 0.25, ly + 0.06, lz, 0.06, 0.32, { roll: Math.PI / 2, sides: 12 });  // upper arm
  cyl('gunmetal', lx - 0.06, ly + 0.06, lz, 0.075, 0.08, { roll: Math.PI / 2, sides: 12 }); // elbow
  cyl('steel', lx + 0.14, ly + 0.06, lz, 0.05, 0.3, { roll: Math.PI / 2, sides: 12 });   // forearm
  cyl('glow', lx - 0.06, ly + 0.06, lz + 0.075, 0.03, 0.01, { pitch: Math.PI / 2, sides: 10 });
  for (let f = 0; f < 4; f++) put('gunmetal', lx + 0.35, ly + 0.03 + f * 0.022, lz, 0.1, 0.015, 0.02);  // fingers
}

function engine(put, cyl, lx, ly, lz) {
  put('steel', lx, ly, lz, 0.6, 0.32, 0.4);
  for (let i = 0; i < 3; i++) cyl('gunmetal', lx - 0.18 + i * 0.18, ly + 0.32, lz, 0.06, 0.16, { sides: 10 }); // cylinders
  cyl('rust', lx + 0.34, ly + 0.15, lz, 0.05, 0.3, { roll: Math.PI / 2, sides: 10 });    // exhaust
  cyl('glow', lx - 0.31, ly + 0.16, lz, 0.05, 0.02, { roll: Math.PI / 2, sides: 12 });
}

function wheel(put, cyl, lx, ly, lz) {
  cyl('gunmetal', lx, ly, lz, 0.32, 0.14, { pitch: Math.PI / 2, sides: 22 });            // tyre
  cyl('steel', lx, ly, lz, 0.2, 0.15, { pitch: Math.PI / 2, sides: 16 });                // rim
  cyl('rust', lx, ly, lz, 0.06, 0.18, { pitch: Math.PI / 2, sides: 10 });                // hub
}

// ------------------------------------------------------------- the wares

export function weapons({ put, cyl, top, cz, back }) {
  // Swords and an axe stood upright in a rack on the back wall.
  for (let i = 0; i < 4; i++) sword(put, cyl, -1.5 + i * 0.5, 1.0, back - 0.05, 0.95);
  axe(put, cyl, 0.6, 1.0, back - 0.05);
  shield(put, cyl, 1.4, 1.45, back - 0.1);
  helmet(put, cyl, -1.4, 1.95, back);
  helmet(put, cyl, -0.9, 1.95, back);
  // On the counter: a sword laid flat, daggers, potions.
  sword(put, cyl, -0.9, top + 0.02, cz, 0.7, Math.PI / 2);
  for (let i = 0; i < 3; i++) sword(put, cyl, 0.0 + i * 0.25, top + 0.02, cz + 0.1, 0.35, Math.PI / 2);
  for (let i = 0; i < 4; i++) bottle(put, cyl, 0.95 + i * 0.12, top, cz, 'potionred');
}

export function bodyParts({ put, cyl, top, cz, back }) {
  mechArm(put, cyl, -0.9, top, cz);
  mechArm(put, cyl, 0.4, top, cz + 0.1);
  for (let i = 0; i < 6; i++) cyl('glow', -1.6 + i * 0.13, top + 0.03, cz - 0.15, 0.03, 0.03, { sides: 10 });  // eye lenses
  for (let i = 0; i < 3; i++) put('steel', -1.1 + i * 0.9, 1.35, back, 0.6, 0.45, 0.05);                       // armour plates
  for (let i = 0; i < 5; i++) bottle(put, cyl, -1.5 + i * 0.3, 1.95, back, i % 2 ? 'potiongreen' : 'potionblue');
}

export function gadgets({ put, cyl, top, cz, back }) {
  for (let i = 0; i < 4; i++) gadget(put, cyl, -1.5 + i * 0.85, top, cz);
  drone(put, cyl, 1.5, top, cz - 0.1);
  for (let i = 0; i < 5; i++) gadget(put, cyl, -1.6 + i * 0.75, 1.27, back);
  for (let i = 0; i < 4; i++) cyl('glow', -1.4 + i * 0.9, 1.92, back, 0.06, 0.2, { sides: 10 });               // lanterns
}

export function vehicleParts({ put, cyl, top, cz, back }) {
  engine(put, cyl, -0.8, top, cz);
  wheel(put, cyl, 0.7, top + 0.32, cz);
  for (const lx of [-1.3, -0.3, 0.7]) wheel(put, cyl, lx, 1.3 + 0.32, back + 0.05);
  for (let i = 0; i < 6; i++) cyl('rust', -1.6 + i * 0.6, 1.92, back, 0.04, 0.4, { roll: Math.PI / 2, sides: 8 }); // pipes
}

// Round the stall: crates stacked at its sides, a basket or two, lanterns hung
// from the awning's front edge.
export function fill({ put, cyl, W, D }) {
  for (const side of [-1, 1]) {
    const lx = side * (W / 2 + 0.45);
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) put('timber', lx, i * 0.5, between(-D / 3, D / 4), 0.6, 0.5, 0.6, { yaw: between(-0.2, 0.2) });
    if (rand() < 0.7) cyl('hessian', lx, 0, D / 2 - 0.1, 0.24, 0.45, { rBottom: 0.2, sides: 12 });
  }
  for (const lx of [-W / 2 + 0.6, W / 2 - 0.6]) {
    cyl('rust', lx, 2.25, D / 2 + 0.05, 0.006, 0.35, { sides: 4 });                     // the chain
    put('rust', lx, 2.05, D / 2 + 0.05, 0.16, 0.03, 0.16);
    cyl('glow', lx, 1.9, D / 2 + 0.05, 0.05, 0.15, { sides: 8 });
  }
}
