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

## Look

**As realistic as possible.** Photo-scanned CC0 textures and HDRI skies (Poly Haven),
realistic models wherever free ones exist. The 77 low-poly Quaternius props from the
first version get replaced over time; the intro castle is upgraded *after* the
wasteland. Accepted trade-off: characters and creatures are the hardest part to make
realistic with free assets and code alone, and will lag behind the world.

Each area has its own sky/mood: orange dust haze in the desert, darker over the burned
ruins, white and cold in the snowy south. Place names: decided later.

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

**Abilities: every clan gets them a different way** (decided 2026-10-24):

| Clan | How they get abilities |
|------|------------------------|
| **Brutes** | **Train** their abilities (other clans have to buy them), and are **stronger** |
| **Cyborgs** | **Many electronic abilities**, bought or found |
| **Dragons** | Born with **fire breath** and **turning into a dragon** |
| **Apex** | **Find** their abilities out in the world |

- **Brute training:** abilities get stronger the more you use them, *and* brute
  trainers teach new ones.
- **Dragon form needs rest:** how long you can stay a dragon depends on how well
  rested you are. Not rested enough, and you cannot transform at all. (So there is
  tiredness and sleep in the game.)
- **Apex find abilities** in **eggs**, **fossils and bones**, and by **beating
  beasts**.
- **Rest and tiredness (everyone):** all clans get tired; being tired makes you
  slower and weaker. **Long rest:** sleep in an inn room (costs coins) or make camp
  anywhere in the wild. **Short rest:** anywhere, restores a bit of health and
  energy, but only **2–3 short rests per long rest**.
- **Base stats, classic split:** brutes most health and strength, cyborgs most
  armour, dragons most damage, apex fastest.

## Combat

Melee (swords, axes), magic/spells, bows, and **special weapons** you find or earn
(special swords, the cyborg plasma cannon). The plasma cannon is a deliberate
exception to "no guns": it belongs to the cyborg clan, not a general shooter loop.

## Structure

*For now the game starts in World 1 (owner's request, 2026-10-23); the castle is
reached through the blue portal at the arrival point.*

0. **Intro — the castle.** The current castle + village. You pick your clan here,
   then step through **a portal in the castle** into World 1.
1. **The Wasteland** — see below.
2. **The Islands** — a big world of islands surrounded by water.
3. **The Skylands** — cities in the sky, and airships.
4. **The Lava World** — volcanoes and everything that goes with them.
5. **The Lava King's house** — the final boss.

Each world has **a boss who serves the Lava King**.

### The Lava King

**A figure of lava, wearing a white cape and a power mask.**

**Who he was:** a lava creature who found an old mask and put it on, and became the
Lava King. **The mask is an ancient artifact.** He started **the great dragon war**;
when the dragons lost, he captured them and **locked them away in a cave in World 2**
(in World 3 the dragons are still free). Now he rules everything with an iron hand,
**but he cannot enter the safe cities**.

**The story:** you are **a prince of your own clan** (whichever you chose), given
the quest to kill him and free the world.

**The captured dragons are both real dragons and dragon-people.** That is why there
are no dragons in World 1. **Freeing them is main quest**, and it is **the way into
World 3**.

**Where you start:** everyone starts at the castle and picks their clan there.
A **dragon prince** then **wakes up hurt in the fallen dragon city**, in ruins, and
must make their way into World 1, to **Farmville** (a small farming village) or
another city.

**Clan cities:**
- **Cyborg city:** World 1, east (built).
- **Brute city:** World 1, **across from the cyborg city** (west side).
- **Apex city:** World 1, **between the brute city and the cyborg city, toward the
  south** (near the snow).
  **Destroyed and being rebuilt.**
- **Dragon city:** **not in World 1**. Fallen and in ruins. You reach it **from the
  dragon cave in World 2**, and a dragon prince starts there.
- **Farmville:** a small farming village in World 1.

**Why he cannot enter the safe cities is a mystery.** Nobody knows; finding out is
part of the story.

**The ending:** when he falls, the world heals, **but not for long**. All his
leftover enemies start a **huge war**. Survive it and beat them, and the world
finally has peace. **The more damaged he gets, the harder the fight
gets.** At the very end, in fear and anger, **he destroys his own castle**.

## World 1 — The Wasteland

- **Big: ~3 km across.**
- **The edge:** first a band of some metres of **huge sandstorm** (you can barely see),
  then **tall mountains** you cannot cross.
- **The mountains are hidden**: a distance haze means you never see them from inside the
  map. They only loom up once you are in the storm.
- Mostly **dry desert/dust** and **ruined, burned land**.
- **The bottom (south) of the map is snowy**, with its own enemies, places and
  secrets, and a **snow city**.
- **Cities:** walled survivor towns (safe to be in, and the quest hubs), clan cities,
  and ruined ghost cities (dangerous, loot and secrets).
- **Bandit camps**, several of them. **Bosses: 2 mid bosses, and one big boss in a
  castle.**
- **Scorpions:** small like real ones, poisonous, live in flocks and nest in old
  ruins.

### Map (owner's sketch, 2026-10-23)

North is up, the bottom (+Z, south) is snow.

```
_____________________________
|                           |
|         desert            |
|                           |
|                  _________|
|                 | cyborg  |
|                 |  city   |
|---------------------------|   <- snow line
|          snow             |
|___________________________|
```

- **Cyborg city:** east side, just north of the snow line. Roughly x +280..+1060,
  z +60..+530 of the walkable area (which runs about ±1060 m).
- **Snow line:** about three quarters of the way down (z ≈ +530..+760 today).

### The cyborg city

- **Fills the whole box on the map** (~800 × 500 m): a real landmark.
- A **safe quest town**: walled, NPCs, quests.
- **Medieval houses, with some parts high-tech**: some roofs and walls plated in
  metal, and **machines** about the city.
- **Wall: stone + metal.** A thick medieval stone wall reinforced with steel plates.
- **One gate, facing west**, toward the middle of the map where you arrive.
- Inside: **streets and houses**, a **market square where technology is for sale**,
  **houses you can enter**, **NPCs walking around**, and **realistic lighting**
  (lamps and lights).

Build order: ground + wall + gate → streets and houses → market → machines →
lamps and lights → enterable houses → NPCs.

Decided 2026-10-24:
- **The market sells:** weapons, cyborg body parts, gadgets and tools, junk and scrap,
  and **modules for vehicles and gear**. So the game has vehicles; details not
  decided yet.
- **Day/night cycle.** The sun goes down, it gets dark, and the city's lamps and
  windows light up.
- **Almost every house can be entered**, plus shops and an inn/tavern. Some doors
  are blocked by crates, and some are locked (like hotel rooms). Some locks can be
  **lockpicked**, and people may get angry if they catch you.
- **Vehicles:** hover-bikes and buggies, airships and boats. **Airships and boats are
  only sold in the worlds that need them** (boats in the Islands, airships in the
  Skylands).
  **Mammoths stay:** brutes ride them.
- **Locks:** some are pin locks (lockpick), some are electronic (hack). **Cyborgs hack
  for free; other clans need a hacking gadget** from the market.
- **Caught breaking in:** your reputation drops. **Reputation is per city**: each
  town remembers you separately.
- **Money:** both. Gold coins in most places, credits in tech shops. Earned from
  **quests, selling items and looting**.

## Build order

1. ~~Design doc~~ (this file)
2. World 1 wasteland: terrain, towns, ruins, snow south, bandit camps as scenery
   (no fighting yet), and the castle portal into it
3. Combat (later, its own step)
4. Clan choice in the castle
5. …everything else
