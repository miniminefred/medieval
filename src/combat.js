import * as THREE from 'three';
import { hud } from './hud.js';
import { CLANS } from './clans.js';

// Basic combat (docs/DESIGN.md): the prince's health, the old sword's swing, and
// the enemies the blade can find.
//
// Enemies register themselves (bandits, scorpions) as plain objects:
//   { pos: Vector3 (feet), alive: bool, hit(damage, fromPos) }
// A swing strikes every living enemy within reach in front of the player at the
// sword's hit moment. Health comes back slowly once nothing has hurt you for a
// while; at zero, `onDeath` is called (main.js decides what dying costs).

const REACH = 2.7;
const ARC = 0.45;            // cos of the half-angle in front that the blade covers
const REGEN_DELAY = 6;       // seconds unhurt before health returns
const REGEN_RATE = 2.5;      // per second

const _fwd = new THREE.Vector3(), _to = new THREE.Vector3();

export function createCombat({ camera, player, sword }) {
  const enemies = new Set();
  let maxHealth = 120, health = maxHealth, sinceHurt = 99, damage = 26;
  let deathHandler = () => {};
  let dead = false;

  function refresh() { hud.health(health / maxHealth); }
  refresh();

  return {
    enemies,
    get health() { return health; },
    get maxHealth() { return maxHealth; },
    get dead() { return dead; },

    // Health and sword damage from the clan's stats (1–5).
    setClan(id) {
      const s = CLANS[id]?.stats;
      if (!s) return;
      maxHealth = 60 + s.health * 20;
      damage = 14 + s.damage * 4;
      health = maxHealth;
      refresh();
    },

    register(e) { enemies.add(e); },
    unregister(e) { enemies.delete(e); },
    onDeath(fn) { deathHandler = fn; },

    swing() {
      if (dead || player.seat) return;
      sword.swing();
    },

    // Something hurts the player.
    hurt(n) {
      if (dead) return;
      health = Math.max(0, health - n);
      sinceHurt = 0;
      hud.hurt(Math.min(1, n / 20));
      refresh();
      if (health <= 0) {
        dead = true;
        deathHandler();
      }
    },

    // After dying: back on your feet with some health.
    revive(fraction = 0.6) {
      dead = false;
      health = Math.round(maxHealth * fraction);
      sinceHurt = 99;
      refresh();
    },

    update(dt) {
      sinceHurt += dt;
      if (!dead && sinceHurt > REGEN_DELAY && health < maxHealth) {
        health = Math.min(maxHealth, health + REGEN_RATE * dt);
        refresh();
      }
      if (sword.hitMoment) {
        camera.getWorldDirection(_fwd);
        _fwd.y = 0;
        _fwd.normalize();
        const p = player.object.position;
        for (const e of enemies) {
          if (!e.alive) continue;
          _to.set(e.pos.x - p.x, 0, e.pos.z - p.z);
          const d = _to.length();
          if (d > REACH) continue;
          if (d > 0.4 && _to.normalize().dot(_fwd) < ARC) continue;
          e.hit(damage, p);
        }
      }
    },
  };
}
