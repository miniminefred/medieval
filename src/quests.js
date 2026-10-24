import { hud } from './hud.js';
import { inventory } from './inventory.js';

// Quests: a small state machine per quest, the journal behind Tab, and which
// spot on which world the current objective points at (the orb's beam and the
// map markers read it). The story beats themselves are spoken by the orb.

const quests = [];       // in the order they were given
let onChange = () => {};

export function giveQuest(q) {
  if (quests.some((x) => x.id === q.id)) return;
  quests.push({ ...q, done: false });
  hud.toast(`New quest: ${q.title}`);
  onChange();
}

export function completeQuest(id) {
  const q = quests.find((x) => x.id === id);
  if (!q || q.done) return;
  q.done = true;
  if (q.reward) inventory.addGold(q.reward);
  hud.toast(`Quest complete: ${q.title}${q.reward ? ` — ${q.reward} gold` : ''}`);
  onChange();
}

export function activeQuest() {
  return quests.find((q) => !q.done) ?? null;
}

export function allQuests() {
  return quests;
}

export function onQuestsChanged(fn) {
  onChange = fn;
}

// Each frame: the active quest's objective may be reached.
export function checkQuests(realmName, pos) {
  const q = activeQuest();
  if (!q?.goal) return;
  const g = q.goal;
  if (g.realm === realmName && Math.hypot(pos.x - g.x, pos.z - g.z) < g.r) completeQuest(q.id);
}
