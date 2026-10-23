# Game design

The plan for the whole game, as decided with the owner (2026-10-23). This is the
source of truth for *what* we are building; `CLAUDE.md` covers *how*. When a
decision changes, change it here.

## Premise

A first-person fantasy/medieval adventure. An evil **Lava King** has taken over the
world and strikes it down. You join a clan, travel through five worlds, beat the
bosses who serve him, and free the world from him.

Focus: **a big story with a ton of side quests**, NPC quests, and exploring for
secrets. Travel between worlds is driven by quests and story, not a world map.

## Camera

First-person by default (you see your clan's hands, claws or metal arms holding
weapons), with **a key to toggle third-person** so you can see your character.

## The clans

You pick one at the start. The clan changes **stats, a special ability, special
weapons, and story/quests** (some quests and NPC reactions depend on it).

| Clan | Who they are | Notes |
|------|--------------|-------|
| **Brutes** | Big, strong people | Close combat with their special swords; ride **mammoths** |
| **Cyborgs** | Part machine | Tech weapons, e.g. a **plasma cannon** |
| **Dragons** | Dragon-people (dragonkin), not riders | Scales, fire |
| **Apex** | Dinosaur-people | |

Stats/abilities per clan are not decided yet. Ideas so far: brutes tough, dragons
fire breath/glide, apex fast/charge, cyborgs armour/dash.

## Combat

Melee (swords, axes), magic/spells, bows, and **special weapons** you find or earn
(special swords, the cyborg plasma cannon). The plasma cannon is a deliberate
exception to "no guns": it belongs to the cyborg clan, not a general shooter loop.

## Structure

0. **Intro — the castle.** The current castle + village. You pick your clan here,
   then step through **a portal in the castle** into World 1.
1. **The Wasteland** — see below.
2. **The Islands** — a big world of islands surrounded by water.
3. **The Skylands** — cities in the sky, and airships.
4. **The Lava World** — volcanoes and everything that goes with them.
5. **The Lava King's house** — the final boss.

Each world has **a boss who serves the Lava King**.

## World 1 — The Wasteland

- **Big: ~3 km across.**
- Mostly **dry desert/dust** and **ruined, burned land**.
- **The bottom (south) of the map is snowy**, with its own enemies, places and
  secrets, and a **snow city**.
- **Cities:** walled survivor towns (safe to be in, and the quest hubs), clan cities,
  and ruined ghost cities (dangerous, loot and secrets).
- **Bandit camps**, several of them, each with a **bandit boss**.
- **Scorpions:** small like real ones, poisonous, live in flocks and nest in old
  ruins.

## Build order

1. ~~Design doc~~ (this file)
2. World 1 wasteland: terrain, towns, ruins, snow south, bandit camps as scenery
   (no fighting yet), and the castle portal into it
3. Combat (later, its own step)
4. Clan choice in the castle
5. …everything else
