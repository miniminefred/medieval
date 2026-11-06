// Every weapon you can hold, and how it fights (docs/DESIGN.md, 2026-11-06):
// each really fights differently.
//
//   dmg      times your clan's base damage per hit
//   speed    how fast the swing plays (1 = the old sword)
//   reach    metres
//   arc      cos of the half-angle in front that a swing covers: lower is wider
//   style    slash (across) | chop (overhead) | thrust (straight out) | shoot
//   stamina  what a swing costs: only the heavy weapons cost any. Without
//            enough, the swing comes slow and weak.
//   stun     seconds a struck enemy stands dazed (blunt weapons, the shock baton)
//   lunge    a dash forward with the stab (the dagger)
//   tech     cyborg technology: free for cyborgs; everyone else burns a power
//            cell every `cellEvery` uses (docs/DESIGN.md: others need parts)
//   look     how it is built in your hand (weapon-view.js)
//
// The items themselves (name, weight, value) are in inventory.js, keyed the same
// with `weapon: key`.

export const WEAPONS = {
  sword: { dmg: 1.0, speed: 1.0, reach: 2.7, arc: 0.45, style: 'slash', look: { type: 'blade', len: 0.62, w: 0.05, guard: 0.21, nicks: true } },
  dagger: { dmg: 0.7, speed: 1.7, reach: 2.1, arc: 0.5, style: 'thrust', lunge: 6, look: { type: 'blade', len: 0.32, w: 0.04, guard: 0.12, scale: 0.75 } },
  shortsword: { dmg: 0.9, speed: 1.35, reach: 2.4, arc: 0.45, style: 'slash', look: { type: 'blade', len: 0.46, w: 0.05, guard: 0.17 } },
  longsword: { dmg: 1.3, speed: 0.9, reach: 3.0, arc: 0.4, style: 'slash', look: { type: 'blade', len: 0.86, w: 0.055, guard: 0.27, grip: 0.24 } },
  sabre: { dmg: 1.1, speed: 1.2, reach: 2.8, arc: 0.3, style: 'slash', look: { type: 'blade', len: 0.7, w: 0.045, guard: 0.14, curve: 0.22, knuckle: true } },
  rapier: { dmg: 0.85, speed: 1.7, reach: 3.2, arc: 0.75, style: 'thrust', look: { type: 'blade', len: 0.82, w: 0.018, guard: 0.16, cup: true } },
  greatsword: { dmg: 2.0, speed: 0.6, reach: 3.4, arc: 0.25, style: 'chop', stamina: 2.2, look: { type: 'blade', len: 1.1, w: 0.075, guard: 0.34, grip: 0.32, scale: 0.8 } },
  club: { dmg: 0.95, speed: 1.05, reach: 2.4, arc: 0.4, style: 'chop', stun: 0.4, look: { type: 'club' } },
  mace: { dmg: 1.35, speed: 0.9, reach: 2.5, arc: 0.4, style: 'chop', stun: 0.7, look: { type: 'mace' } },
  warhammer: { dmg: 1.85, speed: 0.65, reach: 2.7, arc: 0.4, style: 'chop', stamina: 2.0, stun: 1.2, look: { type: 'hammer' } },
  battleaxe: { dmg: 1.7, speed: 0.75, reach: 2.9, arc: 0.3, style: 'chop', stamina: 1.8, look: { type: 'axe' } },
  flail: { dmg: 1.5, speed: 0.8, reach: 3.0, arc: 0.2, style: 'slash', stun: 0.5, look: { type: 'flail' } },
  baton: { dmg: 0.9, speed: 1.3, reach: 2.4, arc: 0.45, style: 'slash', stun: 1.6, tech: true, cellEvery: 15, look: { type: 'baton' } },
  buzzsaw: { dmg: 1.45, speed: 1.1, reach: 2.5, arc: 0.4, style: 'slash', tech: true, cellEvery: 12, look: { type: 'saw' } },
  plasma: { dmg: 2.2, speed: 1.0, reach: 60, arc: 1, style: 'shoot', tech: true, cellEvery: 4, look: { type: 'pistol' } },
};

// Words for the item description (item-info.js).
export function weaponLines(key) {
  const w = WEAPONS[key];
  if (!w) return [];
  const pace = w.speed >= 1.5 ? 'very quick' : w.speed >= 1.15 ? 'quick' : w.speed >= 0.95 ? 'steady' : w.speed >= 0.75 ? 'slow' : 'very slow';
  const out = [];
  if (w.style === 'shoot') out.push(`Shoots a bolt of plasma: ${Math.round(w.dmg * 100)}% damage, at range.`);
  else {
    out.push(`Damage ${Math.round(w.dmg * 100)}%, ${pace} swings, reach ${w.reach} m${w.arc <= 0.3 ? ', a wide sweep' : w.arc >= 0.7 ? ', a narrow point' : ''}.`);
    out.push({ slash: 'Cuts across.', chop: 'Comes down from overhead.', thrust: 'Stabs straight out.' }[w.style]);
  }
  if (w.stamina) out.push('Heavy: every swing costs stamina.');
  if (w.stun) out.push(`Dazes what it hits for ${w.stun} s.`);
  if (w.lunge) out.push('Lunges you forward with the stab.');
  if (w.tech) out.push(`Cyborg tech: cyborgs use it freely; anyone else uses up a power cell every ${w.cellEvery} ${w.style === 'shoot' ? 'shots' : 'blows'}.`);
  return out;
}
