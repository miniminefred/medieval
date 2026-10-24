// The four clans (docs/DESIGN.md) and which one the player belongs to.
//
// Chosen once, at the clan banners in the castle courtyard, and final at once.
// `stats` are the classic split from the design; only `speed` acts on anything
// yet (the player's walk and run), the rest wait for combat. `home` is where a
// prince of the clan arrives in World 1.

export const CLANS = {
  brutes: {
    name: 'Brutes',
    colour: '#7a1f17',
    accent: '#e9d7b0',
    blurb: 'Big and strong. Close combat with their special swords, and they ride mammoths. ' +
      'Brutes train their abilities; every other clan has to buy theirs.',
    stats: { health: 5, strength: 5, armour: 3, damage: 3, speed: 2 },
    home: { x: -650, z: 290, yaw: -Math.PI / 2 },   // the brute city, west; facing east
  },
  cyborgs: {
    name: 'Cyborgs',
    colour: '#1f3346',
    accent: '#5fe3ff',
    blurb: 'Part machine. Tech weapons like the plasma cannon, many electronic abilities, ' +
      'and they hack electronic locks with no gadget at all.',
    stats: { health: 3, strength: 3, armour: 5, damage: 3, speed: 3 },
    home: { x: 235, z: 290, yaw: -Math.PI / 2 },    // outside the cyborg city's gate
  },
  dragons: {
    name: 'Dragons',
    colour: '#1d2a1d',
    accent: '#ff8a2a',
    blurb: 'Dragon-people. Born with fire breath, and they can become a dragon for as long ' +
      'as they are rested. Their city has fallen; their kin are imprisoned.',
    stats: { health: 3, strength: 3, armour: 3, damage: 5, speed: 3 },
    home: { x: 640, z: -260, yaw: Math.PI },        // the fallen dragon city, north
  },
  apex: {
    name: 'Apex',
    colour: '#2c3a24',
    accent: '#d8cfa4',
    blurb: 'Dinosaur-people, the fastest of the clans. They find their abilities in eggs, ' +
      'fossils and bones, and by beating beasts. Their city is rising from ruins.',
    stats: { health: 3, strength: 3, armour: 2, damage: 3, speed: 5 },
    home: { x: -100, z: 400, yaw: 0 },              // the apex city, toward the snow
  },
};

// Walk/run speed multiplier per point of the speed stat (3 = everyday pace).
export function speedMultiplier(clanId) {
  const s = CLANS[clanId]?.stats.speed ?? 3;
  return 1 + (s - 3) * 0.08;
}

let current = null;
const listeners = new Set();

export function currentClan() {
  return current;
}

export function chooseClan(id) {
  if (current || !CLANS[id]) return false;   // final at once
  current = id;
  for (const fn of listeners) fn(id);
  return true;
}

export function onClanChosen(fn) {
  listeners.add(fn);
}
