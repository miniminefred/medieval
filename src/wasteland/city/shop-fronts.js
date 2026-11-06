// What stands outside each special building (docs/DESIGN.md, 2026-11-06: shops
// look different outside). All in house-local coordinates — the front wall's
// face is at z = d/2, the door at x = doorX — and kept to the side of the door,
// against the wall, so the doorway and most of the pavement stay clear.
//
//   put(key, lx, ly, lz, w, h, d, roll, pitch)   a box, as in houses.js
//   cyl(key, lx, ly, lz, r, h, opts)             a cylinder
//   block(lx, lz, w, d, h)                        something solid to bump into

export function shopFront(kind, { put, cyl, block, w, d, doorX }) {
  const f = d / 2;                                   // the front face
  const side = doorX > 0 ? -1 : 1;                   // the wider side of the door
  const sx = (o) => doorX + side * o;                // `o` metres from the door, along the wall
  const room = Math.max(1.5, side > 0 ? w / 2 - doorX - 0.9 : doorX + w / 2 - 0.9);
  const at = (o) => sx(Math.min(o, room));

  // A small awning over a spot on the wall.
  const awning = (o, width, key = 'linen') => {
    put(key, at(o), 2.35, f + 0.55, width, 0.04, 1.1, 0, 0.3);
    for (const e of [-1, 1]) put('timber', at(o) + e * (width / 2 - 0.05), 1.95, f + 0.4, 0.05, 0.6, 0.05, 0, -0.65);
  };
  const barrel = (o, z = 0.45) => { cyl('timber', at(o), 0, f + z, 0.33, 0.85, { rTop: 0.29 }); block(at(o), f + z, 0.66, 0.66, 0.85); };
  const bench = (o, z) => {
    put('timber', at(o), 0.42, f + z, 1.6, 0.06, 0.38);
    for (const e of [-1, 1]) put('timber', at(o) + e * 0.65, 0, f + z, 0.08, 0.42, 0.32);
    block(at(o), f + z, 1.6, 0.4, 0.45);
  };
  const table = (o, z, len = 1.4) => {
    put('timber', at(o), 0.78, f + z, len, 0.06, 0.7);
    for (const e of [-1, 1]) put('timber', at(o) + e * (len / 2 - 0.08), 0, f + z, 0.08, 0.78, 0.6);
    block(at(o), f + z, len, 0.7, 0.84);
    return 0.84;
  };

  switch (kind) {
    case 'tavern':
      // Benches and a table out front, barrels by the wall, a lantern by the door.
      bench(1.6, 1.6); table(1.6, 2.3, 1.6); bench(1.6, 3.0);
      barrel(3.3); barrel(3.3, 1.2);
      put('rust', doorX + side * 0.85, 2.35, f + 0.2, 0.2, 0.3, 0.2);
      for (let i = 0; i < 3; i++) cyl('pewter', at(1.2 + i * 0.4), 0.84, f + 2.3, 0.05, 0.14, { sides: 10 });
      break;
    case 'smithy':
      // The anvil out in the street on its stump, a quench tub, blades on a rack.
      cyl('timber', at(1.8), 0, f + 1.3, 0.32, 0.5); block(at(1.8), f + 1.3, 0.64, 0.64, 0.8);
      put('gunmetal', at(1.8), 0.5, f + 1.3, 0.75, 0.28, 0.28);
      put('gunmetal', at(1.8), 0.78, f + 1.3, 0.9, 0.08, 0.32);
      cyl('timber', at(2.9), 0, f + 0.55, 0.42, 0.6); block(at(2.9), f + 0.55, 0.84, 0.84, 0.6);
      put('timber', at(1.2), 1.4, f + 0.08, 1.4, 0.08, 0.08);
      for (let i = 0; i < 5; i++) put('pewter', at(0.75 + i * 0.22), 0.35, f + 0.12, 0.05, 1.05, 0.02, 0.08);
      break;
    case 'bakery':
      // A stall of loaves under a little awning.
      awning(1.7, 2.0, 'caban');
      table(1.7, 0.6, 1.8);
      for (let i = 0; i < 7; i++) cyl('bread', at(1.0 + i * 0.22), 0.88, f + 0.5 + (i % 2) * 0.15, 0.07, 0.22, { roll: Math.PI / 2, yaw: 0.3, sides: 10 });
      break;
    case 'library':
      // A cart of books for sale and a reading bench.
      put('timber', at(1.6), 0.55, f + 0.5, 1.3, 0.08, 0.6);
      for (const e of [-1, 1]) cyl('timber', at(1.6) + e * 0.55, 0.25, f + 0.85, 0.25, 0.06, { roll: Math.PI / 2, yaw: Math.PI / 2, sides: 14 });
      for (let i = 0; i < 9; i++) put(['bookred', 'bookgreen', 'bookblue'][i % 3], at(1.05 + i * 0.13), 0.63, f + 0.5, 0.06, 0.22 + (i % 3) * 0.02, 0.18);
      block(at(1.6), f + 0.5, 1.3, 0.6, 0.85);
      bench(3.0, 0.35);
      break;
    case 'carpenter':
      // Planks stacked against the wall, a sawhorse with a plank across it.
      for (let i = 0; i < 6; i++) put('timber', at(1.2 + i * 0.12), 0, f + 0.15, 0.06, 2.6, 0.22, 0.12);
      put('timber', at(2.6), 0.55, f + 1.0, 1.1, 0.1, 0.14);
      for (const e of [-1, 1]) put('timber', at(2.6) + e * 0.4, 0, f + 1.0, 0.06, 0.55, 0.5);
      put('timber', at(2.6), 0.66, f + 1.0, 2.0, 0.04, 0.25);
      block(at(2.6), f + 1.0, 2.0, 0.5, 0.7);
      break;
    case 'fishmonger':
      // Fish laid out on a table under an awning, barrels of salt fish.
      awning(1.7, 2.0, 'linen');
      table(1.7, 0.6, 1.8);
      for (let i = 0; i < 8; i++) cyl('fishscale', at(1.0 + i * 0.2), 0.89, f + 0.6, 0.05, 0.34, { rTop: 0.02, roll: Math.PI / 2, yaw: Math.PI / 2 + (i % 2) * 0.3, sides: 8 });
      barrel(3.2);
      break;
    case 'butcher':
      // Joints on hooks under an awning, a chopping block.
      awning(1.6, 1.8, 'hessian');
      put('timber', at(1.6), 2.15, f + 0.55, 1.6, 0.06, 0.06);
      for (let i = 0; i < 4; i++) cyl('meat', at(1.0 + i * 0.4), 1.45, f + 0.55, 0.12, 0.55, { rTop: 0.06, sides: 10 });
      cyl('timber', at(3.0), 0, f + 0.6, 0.38, 0.85); block(at(3.0), f + 0.6, 0.76, 0.76, 0.85);
      break;
    case 'apothecary':
      // Herb pots along the wall, bottles in the window ledge, a green lantern.
      for (let i = 0; i < 4; i++) {
        cyl('pottery', at(1.0 + i * 0.5), 0, f + 0.3, 0.18, 0.35, { rBottom: 0.13, sides: 12 });
        for (let j = 0; j < 5; j++) cyl('reed', at(1.0 + i * 0.5) + (j - 2) * 0.05, 0.35, f + 0.3, 0.012, 0.35, { sides: 4, roll: (j - 2) * 0.15 });
      }
      put('potiongreen', doorX + side * 0.85, 2.3, f + 0.2, 0.2, 0.3, 0.2);
      break;
    case 'tailor':
      // A dressed dummy by the door and bolts of cloth in a crate.
      cyl('timber', at(1.3), 0, f + 0.5, 0.04, 1.1, { sides: 8 });
      cyl('caban', at(1.3), 1.1, f + 0.5, 0.17, 0.5, { rTop: 0.22, sides: 14 });
      cyl('caban', at(1.3), 1.6, f + 0.5, 0.12, 0.08, { rBottom: 0.22, sides: 14 });
      put('timber', at(2.4), 0, f + 0.45, 0.9, 0.5, 0.6);
      block(at(2.4), f + 0.45, 0.9, 0.6, 0.5);
      for (let i = 0; i < 4; i++) cyl(['linen', 'blanket', 'rug', 'sheet'][i], at(2.1 + i * 0.2), 0.55, f + 0.45, 0.09, 0.8, { pitch: Math.PI / 2 - 0.3, sides: 10 });
      break;
  }
}
