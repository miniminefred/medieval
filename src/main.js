import { Timer, Vector3, Mesh, SphereGeometry, MeshStandardMaterial } from 'three';
import { createRenderer, createScene, createCamera, handleResize } from './scene.js';
import { createInput } from './input.js';
import { ModelLibrary } from './models.js';
import { createCastleRealm } from './castle.js';
import { onClanChosen, runMultiplier, staminaSeconds } from './clans.js';
import { Player } from './player.js';
import { Viewmodel } from './viewmodel.js';
import { hud } from './hud.js';
import { inventory } from './inventory.js';
import { createInteraction } from './interact.js';
import { createOrb } from './orb.js';
import { createStory } from './story.js';
import { checkQuests, onQuestsChanged, allQuests } from './quests.js';
import { createJournal } from './journal.js';
import { createMinimap } from './minimap.js';
import { explored } from './explored.js';
import { clock } from './clock.js';
import { onDoorOpened, isLocked } from './doorways.js';
import { createInterior } from './interiors.js';
import { createSword } from './sword.js';
import { createCombat } from './combat.js';
import { CLANS, currentClan } from './clans.js';
import { trade } from './trade.js';
import { ITEMS } from './inventory.js';
import { createKnives } from './knives.js';

const renderer = createRenderer();
const scene = createScene();
const camera = createCamera();
handleResize(renderer, camera);

// The prop GLBs have to be in memory before anything can be placed, so the whole
// bootstrap is async and the loading screen stays up until the world is standing.
const library = await new ModelLibrary().load();

const keys = createInput();
const player = new Player(camera, renderer.domElement, keys);
scene.add(camera);

const ctx = { scene, renderer, camera, player };
onClanChosen((id) => {
  player.runMul = runMultiplier(id);
  player.staminaMax = player.stamina = staminaSeconds(id);
});

// ---------------------------------------------------------------- realms
// Each world is a realm (castle.js, wasteland/): built once on first visit, then
// attached and detached as the player walks through portals, so a realm nobody
// has visited yet costs nothing.
//
// Every prince starts at the castle and chooses a clan at the courtyard banners
// (docs/DESIGN.md); the portal there then opens onto World 1.
const START = 'castle';
const realms = {};
const builders = {
  castle: async () => createCastleRealm(library, renderer),
  wasteland: async () => (await import('./wasteland/index.js')).createWastelandRealm(renderer),
};

realms[START] = await builders[START]();
let realm = realms[START];
realm.enter(ctx);
player.teleport(realm.spawn.x, realm.spawn.z, realm.spawn.yaw);

// The orb follows the prince from realm to realm, and tells the story.
const orb = createOrb();
orb.attach(scene);
const story = createStory({ orb, castle: realms.castle });
story.arrived(realm.name, () => 0);

const journal = createJournal(player.controls);
const minimap = createMinimap();
// When a quest is finished, let the story react to it.
const done = new Set();
onQuestsChanged(() => {
  journal.refresh();
  for (const q of allQuests()) {
    if (q.done && !done.has(q.id)) { done.add(q.id); story.questDone(q.id); }
  }
});

const fade = document.getElementById('fade');
let travelling = false;

// Fade to black, swap the current realm for another, put the player at `at`
// (default: the new realm's arrival point), fade back in. `make` builds the
// realm if it is not built yet.
async function goTo(make, at) {
  travelling = true;
  fade.classList.add('on');
  await new Promise((r) => setTimeout(r, 450));
  // Give the fade a frame to paint before a slow realm build blocks the thread.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const next = await make();
  realm.exit(ctx);
  realm = next;
  realm.enter(ctx);
  const a = at ?? realm.arrival;
  player.teleport(a.x, a.z, a.yaw);
  orb.attach(scene);
  story.arrived(realm.name, realm.terrain?.heightAt ?? (() => 0));
  fade.classList.remove('on');
  travelling = false;
}

async function travel(name) {
  await goTo(async () => (realms[name] ??= await builders[name]()));
}

// Houses: walking in builds the inside on the spot (interiors.js); leaving
// puts you back on the street, just outside the door, facing out.
onDoorOpened((door) => {
  if (travelling) return;
  if (isLocked(door)) { hud.toast('The door is locked.'); return; }
  const outside = realm;
  const step = { x: door.x + Math.sin(door.yaw) * 0.9, z: door.z + Math.cos(door.yaw) * 0.9, yaw: door.yaw + Math.PI };
  const inside = createInterior(door, renderer, {
    player,
    onLeave: () => goTo(async () => outside, step),
    onSleep: () => { lastRest = { make: async () => outside, at: step }; sleep(); },
  });
  goTo(async () => inside);
});

// A bed: sleep until morning — a long rest (docs/DESIGN.md).
async function sleep() {
  if (travelling) return;
  travelling = true;
  fade.classList.add('on');
  await new Promise((r) => setTimeout(r, 900));
  clock.wakeAtDawn();
  player.stamina = player.staminaMax;
  player.winded = false;
  await new Promise((r) => setTimeout(r, 600));
  fade.classList.remove('on');
  travelling = false;
  hud.toast(`You wake at ${clock.label()}, rested.`);
}

// Dev shortcut while the worlds are being built: F2 hops between them.
if (import.meta.env.DEV) {
  addEventListener('keydown', (e) => {
    if (e.code === 'F2' && !travelling) travel(realm.name === 'castle' ? 'wasteland' : 'castle');
  });
}

// In hand: the old sword (combat.js). The fishing rod is bought later, as the
// "old rod" (docs/DESIGN.md), so it starts put away. The first click grabs
// pointer lock (input.js); only clicks that arrive while locked swing.
const viewmodel = new Viewmodel(camera, library);
viewmodel.visible = false;
const sword = createSword(camera);
const combat = createCombat({ camera, player, sword });
ctx.combat = combat;
onClanChosen((id) => { combat.setClan(id); inventory.setStrength(CLANS[id].stats.strength); });
const knives = createKnives(scene);
trade.init(player.controls);

// What using an item from the inventory (I) does.
//   food and potions   eaten or drunk: health back (water: breath too), antidote cures poison
//   dagger             held instead of the old sword (use the sword again: the dagger again)
//   throwing knives    held; a click throws three
//   old fishing rod    held; a click casts
let holding = 'sword';
function hold(w) {
  holding = w;
  viewmodel.visible = w === 'rod';
  sword.visible = w === 'sword' || w === 'dagger';
  if (w === 'sword' || w === 'dagger') combat.setWeapon(w);
  hud.toast(w === 'sword' ? 'You draw the old sword.' : `You take up the ${ITEMS[{ dagger: 'dagger', knives: 'knives', rod: 'rod' }[w]].name.toLowerCase()}.`);
}
trade.onUse((key) => {
  const it = ITEMS[key];
  if (it.heal || it.cure || it.stamina) {
    inventory.addItem(key, -1);
    if (it.heal) combat.heal(it.heal);
    if (it.cure) combat.cure();
    if (it.stamina) { player.stamina = player.staminaMax; player.winded = false; }
    hud.toast(`You ${it.kind === 'food' ? 'eat' : 'drink'} the ${it.name.toLowerCase()}.`);
    return true;
  }
  if (it.weapon) { hold(holding === it.weapon ? 'sword' : it.weapon); return true; }
  hud.toast(`The ${it.name.toLowerCase()} is not something to use just now.`);
  return false;
});
inventory.onChange(() => {
  player.overloaded = inventory.overloaded;
  // Sold or used up what you were holding: back to the sword.
  if (holding !== 'sword' && !inventory.count(holding)) hold('sword');
});
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !player.isLocked) return;
  if (holding === 'rod') viewmodel.cast();
  else if (holding === 'knives') {
    if (inventory.count('knives') >= 1) { knives.throw3(camera, combat); inventory.addItem('knives', -1); }
  } else combat.swing();
});

// Dying (docs/DESIGN.md): you lose a big part of your gold, and some of what you
// carry is dropped where you fell, in a pack you can go back for. You wake where
// you last slept — or, if you never have, at your clan's home.
let lastRest = null;          // { make, at } — where you wake
const drops = [];             // dropped packs: { realm, thing }
combat.onDeath(async () => {
  const lostGold = Math.ceil(inventory.gold * 0.6);
  inventory.addGold(-lostGold);
  const dropped = {};
  for (const [k, n] of inventory.items) {
    const d = Math.ceil(n / 3);
    if (d > 0) { dropped[k] = d; inventory.addItem(k, -d); }
  }
  const where = realm, at = player.object.position.clone();
  if (Object.keys(dropped).length) {
    const sack = new Mesh(new SphereGeometry(0.3, 12, 8), new MeshStandardMaterial({ color: 0x7a5f3e, roughness: 1 }));
    sack.scale.y = 0.75;
    sack.position.set(at.x, at.y - 1.5, at.z);
    where.group.add(sack);
    let taken = false;
    drops.push({ realm: where, thing: {
      pos: sack.position, reach: 2.2, label: 'pick up your pack',
      get done() { return taken; },
      use() {
        taken = true;
        where.group.remove(sack);
        for (const [k, n] of Object.entries(dropped)) inventory.addItem(k, n);
        hud.toast('You take back what you dropped.');
      },
    } });
  }
  hud.toast(`You fell. ${lostGold} gold is gone${Object.keys(dropped).length ? ', and you dropped part of your pack' : ''}.`, 6);
  await new Promise((r) => setTimeout(r, 1200));
  const clan = CLANS[currentClan()];
  const wake = lastRest ?? (clan
    ? { make: async () => (realms.wasteland ??= await builders.wasteland()), at: clan.home }
    : { make: async () => realms.castle, at: realms.castle.spawn });
  await goTo(wake.make, wake.at);
  combat.revive(0.6);
});

inventory.refresh();
document.getElementById('loading')?.classList.add('hidden');

// Dev-only handle so the world can be flown around and inspected from the console
// (there is no scene editor by design — this is how we look at what we built).
if (import.meta.env.DEV) {
  window.__medieval = { renderer, scene, camera, library, realms, viewmodel, player, travel, orb, inventory, clock, combat, sword, trade,
    get realm() { return realm; } };
}

const interaction = createInteraction();
const _dir = new Vector3();
const timer = new Timer();

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05); // clamp so a lag spike can't tunnel

  player.update(dt, camera);
  hud.stamina(player.stamina / player.staminaMax, player.running, player.winded, dt);
  clock.tick(dt);
  hud.time(clock.hour, clock.label(), clock.isNight);
  realm.update(dt, ctx);
  const here = drops.filter((d) => d.realm === realm && !d.thing.done).map((d) => d.thing);
  interaction.update(here.length ? realm.interactables.concat(here) : realm.interactables, camera, player.isLocked);
  combat.update(dt);
  knives.update(dt, player.groundAt);
  orb.update(dt, camera);
  story.update(dt);
  checkQuests(realm.name, player.object.position);
  if (realm.name === 'wasteland') explored.reveal(player.object.position.x, player.object.position.z);
  journal.update(realm.name, player.object.position);
  camera.getWorldDirection(_dir);
  minimap.update(realm.name, player.object.position, Math.atan2(_dir.x, -_dir.z),
    realm.name === 'castle' ? realm.portal.object.position : null);
  if (!travelling) {
    const portal = realm.portals.find((p) => p.isInside(player.feet));
    if (portal) travel(portal.target);
  }
  viewmodel.update(dt, { speed: player.speed, grounded: player.grounded, locked: player.isLocked });
  sword.update(dt, { speed: player.speed });
  renderer.render(scene, camera);
}
animate();
