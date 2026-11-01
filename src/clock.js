import * as THREE from 'three';

// The time of day (docs/DESIGN.md): day — 06:00 to 20:00 — passes in 20 real
// minutes, night — 20:00 to 06:00 — in 10, unless you sleep through it. Every
// realm reads `light()` each frame to place the sun or moon and to know how much
// daylight there is; the HUD shows the hour on the bar above the minimap.

const DAY_START = 6, DAY_END = 20;
const DAY_SECONDS = 20 * 60, NIGHT_SECONDS = 10 * 60;

let hour = 8.5;   // a fresh morning
let day = 1;      // counts up each midnight (and each night slept through)

const _sun = new THREE.Vector3();
const _moon = new THREE.Vector3();

export const clock = {
  get hour() { return hour; },
  get day() { return day; },
  set hour(h) { hour = ((h % 24) + 24) % 24; },

  get isNight() { return hour < DAY_START || hour >= DAY_END; },

  tick(dt) {
    const rate = this.isNight ? (24 - DAY_END + DAY_START) / NIGHT_SECONDS : (DAY_END - DAY_START) / DAY_SECONDS;
    const before = hour;
    this.hour = hour + dt * rate;
    if (hour < before) day++;
  },

  // Sleep until morning.
  wakeAtDawn() { if (hour > DAY_START) day++; hour = DAY_START + 0.25; },

  // "14:30"
  label() {
    const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  // Where the sun and moon are and how much light they give.
  //   sunDir / moonDir  unit vectors toward them (the sun rises in the east, +X)
  //   day      0 at night .. 1 in full daylight, smooth through dawn and dusk
  //   warmth   0..1, highest at sunrise and sunset (reddens the light)
  light() {
    // The sun turns once a day: highest at 13:00, below the horizon from 20:00 to
    // 06:00. The orbit is tilted toward the south, as at mid latitudes.
    const a = ((hour - DAY_START) / (DAY_END - DAY_START)) * Math.PI;   // 0 at dawn, π at dusk
    _sun.set(Math.cos(a), Math.sin(a) * 0.9, 0.35).normalize();
    const elev = _sun.y;
    const day = THREE.MathUtils.smoothstep(elev, -0.08, 0.25);
    const warmth = Math.max(0, 1 - Math.abs(elev - 0.06) / 0.22) * (day > 0.02 ? 1 : 0);
    // The moon is opposite the sun, a little off to one side.
    _moon.set(-_sun.x, Math.max(0.25, -_sun.y), -0.4).normalize();
    return { sunDir: _sun, moonDir: _moon, day, warmth };
  },
};
