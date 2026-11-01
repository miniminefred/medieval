import * as THREE from 'three';
import { hud } from './hud.js';
import { CLANS } from './clans.js';
import { hunger } from './hunger.js';

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
  let poisonT = 0, poisonDps = 0;
  let weapon = 'sword';

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

    get weapon() { return weapon; },
    setWeapon(w) { weapon = w; sword.setKind(w); },

    swing() {
      if (dead || player.seat) return;
      if (!sword.swing()) return;
      // The dagger lunges: a short dash forward with the stab.
      if (weapon === 'dagger') player.dash(6);
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

    // Poison: `dps` damage a second for `seconds` (a scorpion's sting). A fresh
    // sting tops the poison up rather than stacking it.
    poison(seconds, dps) {
      poisonT = Math.max(poisonT, seconds);
      poisonDps = Math.max(poisonDps, dps);
      hud.poisoned(true);
      hunger.setPoisoned(true);
    },

    heal(n) { health = Math.min(maxHealth, health + n); refresh(); },
    cure() { poisonT = 0; poisonDps = 0; hud.poisoned(false); hunger.setPoisoned(false); },
    get healing() { return !dead && sinceHurt > REGEN_DELAY && health < maxHealth; },

    // After dying: back on your feet with some health.
    revive(fraction = 0.6) {
      dead = false;
      health = Math.round(maxHealth * fraction);
      sinceHurt = 99;
      refresh();
    },

    update(dt) {
      sinceHurt += dt;
      if (poisonT > 0 && !dead) {
        poisonT -= dt;
        health = Math.max(0, health - poisonDps * dt);
        sinceHurt = 0;
        refresh();
        if (poisonT <= 0) { poisonDps = 0; hud.poisoned(false); hunger.setPoisoned(false); }
        if (health <= 0) { dead = true; poisonT = 0; hud.poisoned(false); deathHandler(); }
      }
      if (!dead && sinceHurt > REGEN_DELAY && health < maxHealth) {
        health = Math.min(maxHealth, health + REGEN_RATE * hunger.regen * dt);
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
          e.hit(Math.round((weapon === 'dagger' ? damage * 0.7 : damage) * hunger.damage), p);
        }
      }
    },
  };
}
