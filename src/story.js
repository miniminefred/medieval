import * as THREE from 'three';
import { CLANS, onClanChosen, currentClan } from './clans.js';
import { giveQuest, activeQuest } from './quests.js';

// The opening of the story, told by the orb (docs/DESIGN.md): it greets the
// prince at the castle, tells of the Lava King, points to the clan banners, opens
// the portal once a clan is chosen, and gives the first quest — reach your clan's
// city (25 gold). Lines are spoken in order, each after the last has had time.

// Where a prince of each clan is sent first in World 1.
const FIRST_GOAL = {
  brutes: { x: -650, z: 290, r: 40, name: 'the brute city' },
  cyborgs: { x: 300, z: 290, r: 30, name: 'the cyborg city' },
  dragons: { x: 0, z: 175, r: 45, name: 'Farmville' },          // hurt, to the nearest village
  apex: { x: -100, z: 400, r: 45, name: 'the ruins of the apex city' },
};

export function createStory({ orb, castle }) {
  const queue = [];
  let wait = 2.0;          // a moment's quiet before the orb first speaks

  function speak(...lines) { queue.push(...lines); }

  speak(
    'Welcome back, young prince. I am the orb — I have watched over your line for a long time.',
    'This castle remembers the world before the war. Green fields. The clans at one table.',
    'Then the Lava King put on the old mask, and the world burned. Now he rules it with an iron hand.',
    'You were born to end that. But first: whose prince are you? Choose your clan at the banners in the courtyard.',
  );

  // Point at the banners until a clan is chosen.
  orb.point(new THREE.Vector3(0, 0, 15));

  onClanChosen((id) => {
    const clan = CLANS[id];
    const goal = FIRST_GOAL[id];
    speak(
      `A prince of the ${clan.name}. Then I will open the way.`,
      id === 'dragons'
        ? 'Step through the portal. I am sorry, prince — the dragon city has fallen, and you will wake among its ruins. Make for Farmville.'
        : `Step through the portal. Go to ${goal.name}, and let your people see their prince.`,
    );
    castle.portal.setActive(true);
    orb.point(castle.portal.object.position);
    giveQuest({
      id: 'first-steps',
      title: `Return to ${goal.name}`,
      text: `The orb has opened the portal in the castle courtyard. Go through it into the Wasteland, and travel to ${goal.name}.`,
      goal: { realm: 'wasteland', x: goal.x, z: goal.z, r: goal.r },
      reward: 25,
    });
  });

  return {
    // Called when the player arrives in a realm.
    arrived(realmName, heightAt) {
      const q = activeQuest();
      if (realmName === 'wasteland' && q?.id === 'first-steps') {
        speak('The Wasteland. Follow the road, and follow my light.');
        orb.point(new THREE.Vector3(q.goal.x, 0, q.goal.z), heightAt(q.goal.x, q.goal.z));
      }
      if (realmName === 'castle' && !currentClan()) orb.point(new THREE.Vector3(0, 0, 15));
    },
    questDone(id) {
      if (id === 'first-steps') {
        speak('You are home. Rest a while, prince — your road is long, and the Lava King does not sleep.');
        orb.point(null);
      }
    },
    update(dt) {
      wait -= dt;
      if (wait <= 0 && queue.length) {
        const line = queue.shift();
        const seconds = Math.max(4, line.length / 13);
        orb.say(line, seconds);
        wait = seconds + 0.6;
      }
    },
  };
}
