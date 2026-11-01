# Game design

The plan for the whole game, as decided with the owner (2026-10-23/24). This is the
source of truth for *what* we are building; `CLAUDE.md` covers *how*. When a
decision changes, change it here.

**Name:** none yet.

## Premise

A first-person fantasy/medieval adventure. An evil **Lava King** has taken over the
world and rules it with an iron hand. You are **a prince of your own clan**, given the
quest to kill him and free the world. You travel through five worlds, beat the bosses
who serve him, and finally face him.

Focus: **a big story with a ton of side quests**, NPC quests, and exploring for
secrets. Travel between worlds is driven by quests and story, not a world map.

Single-player. **Co-op maybe later.**

## Look and sound

**As realistic as possible.** Photo-scanned CC0 textures and HDRI skies (Poly Haven),
realistic models wherever free ones exist. The 77 low-poly Quaternius props from the
first version get replaced over time; the intro castle is upgraded *after* the
wasteland. Accepted trade-off: characters and creatures are the hardest part to make
realistic with free assets and code alone, and will lag behind the world.

Each area has its own sky/mood: orange dust haze in the desert, darker over the burned
ruins, white and cold in the snowy south. **Day/night cycle**: the sun goes down, it
gets dark, and lamps and windows light up.

**Sound:** mostly calm (ambience), with **fight music in fights, different per world**.

## Camera and controls

First-person by default (you see your clan's hands, claws or metal arms holding
weapons). **F5** toggles third-person so you can see your character.

## Difficulty

**Easy, Normal, Hard, Permadeath**, and **Exploring** (you cannot die).

## The story

**The Lava King** is **a figure of lava, wearing a white cape and a power mask.**
He was a lava creature who found an old mask, an **ancient artifact**, put it on, and
became the Lava King. He started **the great dragon war**. When the dragons lost, he
captured them, both **real dragons and dragon-people**, and **locked them away in
the dragon prison in World 2**. That is why there are no living dragons in World 1. (In World 3
the dragons are still free.) Now he rules everything, **but he cannot enter the safe
cities. Why is a mystery**; finding out is part of the story.

**The fight:** the more damaged he gets, the harder the fight gets. At the very end,
in fear and anger, **he destroys his own castle**.

**The ending:** when he falls, the world heals, **but not for long**. Everyone left
over starts a **huge final war**: lava creatures, bandits, his generals, enemies from
every world. **Your allies fight with you.** Survive it and beat them, and the world
finally has peace.

## The clans

You pick one at the start, in the castle. The clan changes **stats, abilities,
special weapons, and story/quests** (some quests, NPC reactions and dialogue answers
depend on it). **You cannot switch clan**; play another prince in another save slot.

| Clan | Who they are | Notes |
|------|--------------|-------|
| **Brutes** | Big, strong people | Close combat with their special swords; ride **mammoths** |
| **Cyborgs** | Part machine | Tech weapons, e.g. a **plasma cannon** |
| **Dragons** | Dragon-people (dragonkin), not riders | Fire, and can become a dragon |
| **Apex** | Dinosaur-people | |

**Base stats** (1–5, set by the owner 2026-10-24):

| Clan | Health | Strength | Armour | Damage | Speed | Intelligence |
|------|:-:|:-:|:-:|:-:|:-:|:-:|
| **Brutes** | 4 | 5 | 3 | 4 | 2 | 1 |
| **Cyborgs** | 3 | 4 | 4 | 3 | 1 | 3 |
| **Dragons** | 3 | 3 | 2 | 4 | 4 | 3 |
| **Apex** | 4 | 3 | 2 | 3 | 5 | 2 |

- **Speed** is how fast you run *and* how much (how long) you can run. **Walking is
  the same for everyone.** Cyborgs are 1: the mech parts are really heavy.
- **Intelligence** affects **lockpicking** (how easy a lock is), **crafting**, and
  **some weapons**.

**Abilities: every clan gets them a different way.**

| Clan | How they get abilities |
|------|------------------------|
| **Brutes** | **Train** them: abilities grow stronger with use, and **brute trainers** teach new ones. Other clans have to buy theirs. Brutes are also stronger. |
| **Cyborgs** | **Many electronic abilities**, bought or found. **Hack electronic locks for free.** |
| **Dragons** | Born with **fire breath** and **turning into a dragon**. How long you can stay a dragon depends on how rested you are; not rested enough and you cannot transform. |
| **Apex** | **Find** them in **eggs**, **fossils and bones**, and by **beating beasts**. |

**Where you start:** everyone starts at the castle and picks a clan. A **dragon
prince** then **wakes up hurt in the fallen dragon city** (World 1, in ruins) and must
walk to **Farmville** or another city. An **apex prince** can start in the apex city,
which is being rebuilt.

## Combat

Melee (swords, axes), magic/spells, bows, and **special weapons** you find or earn
(special swords, the cyborg plasma cannon). The plasma cannon is a deliberate
exception to "no guns": it belongs to the cyborg clan, not a general shooter loop.

## Systems

- **Rest and tiredness (everyone):** being tired makes you slower and weaker.
  - **Long rest:** an inn room (costs coins) or a camp anywhere in the wild.
  - **Short rest:** anywhere, restores a bit of health and energy, but only **2–3
    short rests per long rest**.
- **Death:** you respawn and **drop your loot**, and have to go back for it.
- **Saving:** **when you rest**, and **anywhere from the menu**.
- **Inventory:** a **weight limit**. Too heavy and you slow down.
- **Crafting:** **at workbenches** (forge, workbench, tech table), from junk, scrap
  and materials.
- **Money:** **gold coins** in most places, **credits** in tech shops. Earned from
  **quests, selling items and looting**.
- **Quests:** a **quest journal** and a **map with markers**.
- **Dialogue:** **choose your answers**; choices change things.
- **Reputation is per city.** Each town remembers you separately. Getting caught
  breaking in lowers it.
- **Houses and locks:** **almost every house can be entered**, plus shops and inns.
  Some doors are blocked by crates, and some are locked (like hotel rooms). **Pin
  locks** are lockpicked; **electronic locks** are hacked (cyborgs for free, other
  clans need a **hacking gadget** from the market).
- **Vehicles:** hover-bikes and buggies (World 1), **boats** (only sold in World 2),
  **airships** (only sold in World 3). Brutes ride **mammoths**. The market sells
  **modules for vehicles and gear**.

### Decided 2026-10-24 (first playable systems)

- **Stamina:** running drains it; your clan's speed stat sets how fast you run and
  how long. **When it runs out you can't run and must walk** until it has refilled
  a bit. The stamina bar shows **only while running** (under the crosshair), then
  fades.
- **Gold:** every prince starts with **a small purse of 25 gold**. More comes from
  **quest rewards, bandit camps, chests and selling**.
- **Chests** give **gold and items**. They are **in bandit camps, hidden in the
  desert, in ruins, in the castle, and in houses** (stealing).
- **Selling:** to the **market traders** in the cyborg city.
- **Bandits:** **5–6 camps spread around World 1**. For now the camps have
  bandits standing guard, walking and sitting by fires, but **no fighting and they
  don't chase you yet**; you can take their loot. Bandits are **hooded, cloaked
  figures** for now.
- **The Y road is mixed:** paved near the cities, a dirt track in between.
- **The orb** is a **crystal sphere with swirling light inside**, with **no name**.
  It talks in **text at the bottom of the screen without pausing** the game.
- **The first quest** comes from the orb: go to your clan's city. **Reaching it
  completes the quest and pays 25 gold.**
- **Tab** opens one menu with the **quest journal and the map**. A **minimap**
  sits in a corner of the screen.

### Decided 2026-10-30

- **The orb appears only when needed:** when it speaks or shows the way, then it
  fades out. Its light beam over the goal stays.
- **People** in the cyborg city and Farmville: walking the streets, shopping at the
  market, standing and chatting, guards (at the gate and on patrol), and people
  doing jobs.
- **The market is a short walk in** from the cyborg city's gate (about 100 m).

### Decided 2026-10-31

- **Day/night:** day lasts 20 real minutes, night 10, unless you sleep through it.
  **Nights are really dark.** A time bar with a moving sun/moon sits just above the
  minimap.
- **Houses you can enter:** furniture, upstairs, chests to loot, and **furniture you
  can use** (doors, beds, chairs…). **Sleeping in a bed skips to morning** (a long
  rest). No lockpicking yet.
- **Basic combat:** you start with an **old sword**; **click to swing**; a **health
  bar**. Bandits **attack, scream for the others, and chase you.** Scorpions fight
  too: small, in flocks, poisonous, one hit kills them.
- **Dying:** you lose **a big part of your gold** and **some of your loot is
  dropped**. You wake where you last slept (or at your clan's home).
- **The fishing rod is bought** in the shop as an **old rod**; it is not carried
  from the start.
- **Trading and inventory:** **I** opens the inventory (items with weight). **Over
  the weight limit you walk slowly and cannot run.** Traders buy and sell **one item
  at a time**. For sale: food and potions, better weapons (**throwing knives** —
  thrown three at a time — and a **dagger** with a dash), gear and tools, and
  materials (scrap, planks).
- **The apex city is built first** of the clan cities. Before the war it was built
  of **bone and animal pelts**. The Lava King destroyed it; now there are **a few
  finished buildings, scaffolding everywhere, still messy**. There are **apex
  builders**, **guards**, and **wounded dinos healing** from the war. Scorpions live
  in the ruins; the bandits think the place is dead. **The camp and the finished
  buildings are safe.**
- **The cyborg market is a medium circle**, not a big square.
  **10 stalls** in a ring (wares as before), round **the tower hall**: the old
  glowing pillar becomes a tall round tower that is the **town hall**.
- **Trade with people at their places too**: the **blacksmith at the forge**, a
  **fisher / general store**, a **librarian**, a **carpenter**, etc.
- **Cyborg townsfolk vary**: some just a metal arm or eye, others nearly all metal.
  **Mixed, cartoon-like colours.**
- **Cyborg people look like cartoon-style cyborgs** (in the spirit of Cyborg from
  *Teen Titans Go!*, but not a copy): chunky metal head with a glowing red eye, a
  metal arm, shoulder plates and a glowing chest core.
- **The brute city, later:** mammoth pens, a training arena, stone and wood houses.

### Decided 2026-11-01

- **More realistic everywhere**, starting with the worst: **people**, and
  **interiors and stalls**.
- **People are real 3D human models** (rigged and animated), not hand-built figures.
  The owner will send **drawings of how they should look** later.
- **Cyborgs are mostly metal**, but keep **a human arm and a human leg**, and **half
  a human face** (the other half metal, with a glowing eye). Most of the cyborg
  city's people are cyborgs.
- **More to buy and sell:** gadgets, materials, tools, **clothes and armour**, and
  **food**, with a **hunger meter**.
- **Hunger:** two meals a day (full to empty in about 15 real minutes). **Food has
  effects** (better running, health regeneration…). **Starving** gives the
  *starving* effect: no running, less carrying capacity, and other debuffs. The
  meter sits **next to the health bar**.
  **What drains it:** sleeping drains hunger *less*; running and regenerating
  health drain it *more*.
- **Interiors:** clutter, real furniture shapes, better light, **doors that open**.
- **Market stalls:** real-looking goods, fuller stalls, signs, and maybe **small
  signs showing discounts and offers**.

## The worlds

0. **Intro: the castle.** You pick your clan here, at four clan banners in the
   courtyard (walk up, read, press E; final at once). The portal to World 1 stays
   dark until you have chosen, and each prince arrives at their clan's home.
   - **A special place that shows the world before the war**: green, peaceful, the
     clans together. A memory of better times.
   - **Old and weathered**: moss, cracks, a little damage. The village around it
     gets realistic houses too.
   - **A magical orb follows you.** It **talks to you** (tells the story, explains
     the clans), **points the way** to the banners, and **opens the portal** once
     you have chosen.
   - **You can go inside the keep: a throne room.**
1. **The Wasteland.** See below. **The portal to World 2** is at the top end of the
   Y road, on the north edge of the map.
2. **The Islands.** Ferries until you have a boat. **Freeing the dragons opens a
   portal to World 3.**
3. **The Skylands.** **An airship takes you on to World 4 and World 5.**
4. **The Lava World.**
5. **The Lava King's house.** The final boss.

*For now the game starts in World 1 (owner's request, 2026-10-23); the castle is
reached through the blue portal at the arrival point.*

Each world has **a boss who serves the Lava King**.

## World 1: The Wasteland

- **Big: ~3 km across.**
- **The edge:** first a band of **huge sandstorm** (you can barely see), then **tall
  mountains** you cannot cross. **The mountains are hidden** by distance haze; you
  never see them from inside the map, only once you are in the storm.
- Mostly **dry desert and dust**, and **ruined, burned land**.
- **The south is snow** (the "winterland"), with its own enemies, places and secrets.
  **Snow enemies:** ice bandits, yeti-like beasts, white scorpions.
- **Scorpions:** small like real ones, poisonous, live in flocks and nest in ruins
  and ruined camps.
- **Bandits:** several camps.
  - **Mid boss 1:** a **bandit captain**.
  - **Mid boss 2:** a weaker boss (weaker than the bandit leader) in a **big bandit
    camp**.
  - **Big boss:** a **huge brute warrior**, in **a castle a bit north of the brute
    city**.

### Places

| Place | Where | What |
|-------|-------|------|
| **Cyborg city** | East, just above the snow line | Safe quest town. **Built.** See below. |
| **Brute city** | West, across from the cyborg city | Clan city |
| **Apex city** | Between brute and cyborg cities, toward the south | **Destroyed and being rebuilt**; partly ruins |
| **Fallen dragon city** | A bit north of the cyborg city | In ruins. A **tunnel** leads to the dragon prison in World 2 (two-way, opened from World 2). |
| **Farmville** | At the fork of the Y road | Small farming village |
| **Bandit castle** | A bit north of the brute city | The big bandit boss |
| **Ruined camps** | Around the map | Scorpion nests |

**The road is an upside-down Y.** The stem runs north past the dragon city to the
**portal to World 2** at the top of the map. At **Farmville** it forks: one branch
to the **cyborg city**, one to the **brute city**, and both carry on into the
winterland in different directions.

### Map (owner's sketches, 2026-10-23/24)

North is up; the bottom (+Z, south) is snow.

```
_____________________________
|           [portal W2]     |
|               |           |
|  bandit       |    dragon |
|  castle       |    city   |
|               |  _________|
|  brute    Farmville      ||
|  city   /     ·    \ cyborg|
|        / apex city  \ city |
|---------------------------|   <- snow line
|  /    snow / winter    \  |
|___________________________|
```

- **Cyborg city:** x +280..+1000, z +60..+520 (the walkable area runs about ±1060 m).
- **Snow line:** about three quarters of the way down (z ≈ +530..+760 today).

### The cyborg city

- **Fills the whole box on the map** (~720 × 460 m): a real landmark.
- A **safe quest town**: walled, NPCs, quests.
- **Medieval houses, with some parts high-tech**: some roofs and walls plated in
  metal, and **machines** around the city.
- **Wall: stone + metal.** A thick medieval stone wall reinforced with steel plates.
- **One gate, facing west**, toward the middle of the map.
- Inside: **streets and houses**, a **market square selling technology** (weapons,
  cyborg body parts, gadgets and tools, junk and scrap, modules for vehicles and
  gear), **houses you can enter**, **NPCs walking around**, and **realistic lighting**
  (lamps and lights).

Build order: ~~ground + wall + gate~~ → ~~streets and houses~~ → ~~market~~ → machines →
lamps and lights (with the day/night cycle) → enterable houses → NPCs.

## World 2: The Islands

- A **desert (wasteland-like) apex island**.
- **Two lonely mountains with a bridge between them.** They are really **the horns of
  a gigantic dead creature**, a **world beast** older than all the clans. **The dragon
  prison is inside one of them.**
- Getting around: **ferries** until you buy a boat (boats are only sold here).
- **Freeing the dragons** (main quest) **opens the portal to World 3**, and the
  tunnel back to the fallen dragon city in World 1.
- **Boss:** decided later.

## World 3: The Skylands

- **Villages on big solid sky islands**, **free dragons**, **sky pirates**, and the
  **dragon cave** (where the free dragons live).

**Dragon places, one per world:** the **fallen dragon city** (ruins) is in World 1,
the **dragon prison** is in World 2, the **dragon cave** is in World 3.
- **Falling off:** you land on a dragon (**the dragon rescue service**). It costs
  money, and you arrive very tired and low on health.
- **Airships** are sold here. An airship takes you on to Worlds 4 and 5.
- **Boss:** an **air admiral**, commanding the Lava King's air fleet.

## World 4: The Lava World

- **Lava rivers and volcanoes**, **lava creatures** (the Lava King's own kind), **lava
  animals**, and **some villages**.
- **Falling into lava** hurts; **ice armour** protects you.
- **Boss:** a **fire titan**.

## World 5: The Lava King's house

- **A big white castle with a big garden**: a **fishing spot** and a **forest**.
- **Boss:** the Lava King himself.

## Build order

1. ~~Design doc~~ (this file)
2. World 1 wasteland: terrain, towns, ruins, snow south, bandit camps as scenery
   (no fighting yet), and the castle portal into it. *In progress: terrain and the
   cyborg city's wall, streets and houses are built.*
3. Combat (later, its own step)
4. Clan choice in the castle
5. …everything else
