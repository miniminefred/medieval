// Fog of war for World 1 (docs/DESIGN.md: "you must explore a place before it is
// on the map"). A 10 m grid over the 3 km map; walking uncovers everything within
// SIGHT of you. The minimap and the Tab map draw only uncovered ground, and a
// place's label only once you have been near enough to see it.
//
// The quest goal is the exception: the orb knows the way, so its marker always
// shows, even across unexplored ground. (Exploration is per game, not saved yet.)

const HALF = 1500;
const CELL = 10;
const N = (HALF * 2) / CELL;      // 300 × 300 cells
const SIGHT = 70;                 // metres you uncover around you

const seen = new Uint8Array(N * N);
let version = 0;                  // bumps whenever something new is uncovered
const fog = { canvas: Object.assign(document.createElement('canvas'), { width: N, height: N }), version: -1, color: '' };

const cellOf = (v) => Math.floor((v + HALF) / CELL);

export const explored = {
  get version() { return version; },

  // Uncover everything within SIGHT of (x, z).
  reveal(x, z) {
    const r = Math.ceil(SIGHT / CELL);
    const cx = cellOf(x), cz = cellOf(z);
    let changed = false;
    for (let j = cz - r; j <= cz + r; j++) {
      if (j < 0 || j >= N) continue;
      for (let i = cx - r; i <= cx + r; i++) {
        if (i < 0 || i >= N) continue;
        const k = j * N + i;
        if (seen[k]) continue;
        const dx = (i - cx) * CELL, dz = (j - cz) * CELL;
        if (dx * dx + dz * dz <= SIGHT * SIGHT) { seen[k] = 1; changed = true; }
      }
    }
    if (changed) version++;
  },

  has(x, z) {
    const i = cellOf(x), j = cellOf(z);
    return i >= 0 && j >= 0 && i < N && j < N && seen[j * N + i] === 1;
  },

  // The fog as an N×N image, one pixel per cell: opaque where unexplored, clear
  // where seen. Rebuilt only when something new has been uncovered. Maps draw it
  // over the world's square (-HALF..HALF), with smoothing on for soft edges.
  fogImage(color = 'rgb(24, 20, 16)') {
    if (fog.version === version && fog.color === color) return fog.canvas;
    const g = fog.canvas.getContext('2d');
    const img = g.createImageData(N, N);
    g.fillStyle = color; g.fillRect(0, 0, 1, 1);
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
    for (let k = 0; k < N * N; k++) {
      img.data[k * 4] = r; img.data[k * 4 + 1] = gr; img.data[k * 4 + 2] = b;
      img.data[k * 4 + 3] = seen[k] ? 0 : 255;
    }
    g.putImageData(img, 0, 0);
    fog.version = version;
    fog.color = color;
    return fog.canvas;
  },

  HALF,
};
