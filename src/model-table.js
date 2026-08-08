// What each downloaded GLB should become in world space.
//
// The raw models arrive at wildly different scales (see `node tools/measure-models.mjs`),
// so every entry states the ONE real-world dimension we care about and the loader
// scales uniformly to hit it:
//
//   fit: 'height'  -> the model's Y extent becomes `size` metres
//   fit: 'length'  -> its larger horizontal extent becomes `size` metres
//
// `yaw` (radians) is applied before measuring, so a model that faces the wrong way
// can be turned without touching the placement code. After normalisation every
// model is centred on X/Z with its base at y = 0.
//
// `solid` marks props the player collides with; `shrink` tightens that AABB so you
// can brush past a tree's outer leaves. Files live in public/models/medieval/ and
// are credited in that folder's CREDITS.md.
//
// `reject: true` marks an asset that does NOT belong in a medieval village — it is
// still listed so the audit is not lost, but placement code must not use it until a
// replacement is sourced. Run the dev gallery (/dev-models.html) to re-check.

export const MODEL_DIR = '/models/medieval/';

export const MODELS = {
  // ------------------------------------------------------------- buildings
  house_a:       { fit: 'height', size: 6.5, solid: true, shrink: 0.9 },
  house_b:       { fit: 'height', size: 5.0, solid: true, shrink: 0.9 },
  house_c:       { fit: 'height', size: 7.0, solid: true, shrink: 0.9 },
  house_d:       { fit: 'height', size: 5.5, solid: true, shrink: 0.9 },
  house_e:       { fit: 'height', size: 4.8, solid: true, shrink: 0.9 },
  inn:           { fit: 'height', size: 8.5, solid: true, shrink: 0.9 },
  sawmill:       { fit: 'height', size: 6.0, solid: true, shrink: 0.9 },
  stable:        { fit: 'height', size: 5.0, solid: true, shrink: 0.9 },
  blacksmith:    { fit: 'height', size: 6.0, solid: true, shrink: 0.9 },
  windmill:      { fit: 'height', size: 12.0, solid: true, shrink: 0.55 },
  watchtower:    { fit: 'height', size: 9.0, solid: true, shrink: 0.8 },
  // REJECT: red gambrel-roof American farm barn — white X-braced doors, corrugated
  // metal roof. 19th/20th-century North America, nothing to do with a medieval village.
  barn:          { fit: 'height', size: 7.5, solid: true, shrink: 0.9, reject: true },
  hut:           { fit: 'height', size: 3.8, solid: true, shrink: 0.9 },
  storage_hut:   { fit: 'height', size: 4.2, solid: true, shrink: 0.9 },
  market_stall:  { fit: 'height', size: 2.8, solid: true, shrink: 0.7 },
  market_stalls: { fit: 'length', size: 8.0, solid: true, shrink: 0.6 },
  // 8.2 m of that footprint is guy ropes and stakes, so the collider is pulled well
  // in — otherwise you bounce off thin air a couple of metres from the canvas.
  tent:          { fit: 'height', size: 3.4, solid: true, shrink: 0.45 },

  // --------------------------------------------------------------- animals
  horse:         { fit: 'length', size: 2.4, solid: true, shrink: 0.8 },
  horse_white:   { fit: 'length', size: 2.2, solid: true, shrink: 0.8 },
  donkey:        { fit: 'length', size: 1.6, solid: true, shrink: 0.8 },
  cow:           { fit: 'length', size: 2.3, solid: true, shrink: 0.8 },
  bull:          { fit: 'length', size: 2.5, solid: true, shrink: 0.8 },
  sheep:         { fit: 'length', size: 1.2, solid: true, shrink: 0.8 },
  pig:           { fit: 'length', size: 1.4, solid: true, shrink: 0.8 },
  chicken:       { fit: 'length', size: 0.4, solid: false },

  // ------------------------------------------------------------------ farm
  hay:           { fit: 'height', size: 1.4, solid: true, shrink: 0.9 },
  wheat:         { fit: 'height', size: 1.2, solid: false },
  crops:         { fit: 'length', size: 2.6, solid: false },
  pumpkin:       { fit: 'height', size: 0.45, solid: false },
  scythe:        { fit: 'height', size: 1.8, solid: false },
  trough:        { fit: 'length', size: 1.1, solid: true, shrink: 0.9 },

  // ----------------------------------------------------------------- props
  barrel:        { fit: 'height', size: 0.95, solid: true, shrink: 0.85 },
  crate:         { fit: 'height', size: 0.8, solid: true, shrink: 0.95 },
  chest:         { fit: 'height', size: 0.7, solid: true, shrink: 0.95 },
  bucket:        { fit: 'height', size: 0.35, solid: false },
  sacks:         { fit: 'height', size: 0.5, solid: false },
  cauldron:      { fit: 'height', size: 0.8, solid: true, shrink: 0.9 },
  bench:         { fit: 'height', size: 0.9, solid: true, shrink: 0.9 },
  ladder:        { fit: 'height', size: 3.6, solid: false },
  well:          { fit: 'height', size: 2.4, solid: true, shrink: 0.75 },
  fence:         { fit: 'height', size: 1.1, solid: true, shrink: 1.0 },
  fence_b:       { fit: 'height', size: 1.1, solid: true, shrink: 1.0 },
  sign:          { fit: 'height', size: 1.7, solid: false },
  // REJECT: modern steel highway gantry — box truss on a cross-braced post carrying a
  // green motorway sign panel. Confirmed in the gallery; not a medieval town sign.
  town_sign:     { fit: 'height', size: 3.2, solid: true, shrink: 0.4, reject: true },
  // Was 2.2 m — a hand torch standing taller than the 1.8 m human reference. 1.6 m
  // reads as a torch planted in the ground with its head at head height.
  torch:         { fit: 'height', size: 1.6, solid: false },
  banner:        { fit: 'height', size: 3.6, solid: false },
  bonfire:       { fit: 'height', size: 1.3, solid: true, shrink: 0.8 },
  // Fitted by length, not height: this cart's shafts stick up, so fitting its height
  // to 2 m gave a 4.8 m-wide monster. 2.6 m long puts the bed at about waist height.
  cart:          { fit: 'length', size: 2.6, solid: true, shrink: 0.85 },
  logs:          { fit: 'height', size: 0.5, solid: true, shrink: 0.9 },
  wood_log:      { fit: 'height', size: 0.6, solid: true, shrink: 0.9 },
  stump:         { fit: 'height', size: 0.7, solid: true, shrink: 0.9 },
  // Solid so you can walk out over the water to fish. village.js sinks the pieces
  // until only the deck shows, which also keeps the collider's top a step high.
  dock:          { fit: 'length', size: 2.6, solid: true, shrink: 1.0 },
  bridge:        { fit: 'height', size: 2.2, solid: false },

  // ---------------------------------------------------------------- nature
  tree_a:        { fit: 'height', size: 6.5, solid: true, shrink: 0.28 },
  tree_b:        { fit: 'height', size: 8.0, solid: true, shrink: 0.22 },
  tree_c:        { fit: 'height', size: 9.5, solid: true, shrink: 0.22 },
  tree_autumn:   { fit: 'height', size: 7.0, solid: true, shrink: 0.26 },
  pine_a:        { fit: 'height', size: 12.0, solid: true, shrink: 0.2 },
  pine_b:        { fit: 'height', size: 10.0, solid: true, shrink: 0.2 },
  pine_c:        { fit: 'height', size: 14.0, solid: true, shrink: 0.18 },
  bush_a:        { fit: 'height', size: 1.2, solid: false },
  bush_b:        { fit: 'height', size: 1.4, solid: false },
  bush_flowers:  { fit: 'length', size: 3.0, solid: false },
  grass_tuft:    { fit: 'height', size: 0.55, solid: false },
  rock_small:    { fit: 'height', size: 0.6, solid: false },
  rock_medium:   { fit: 'height', size: 1.6, solid: true, shrink: 0.8 },
  rock_large:    { fit: 'height', size: 2.4, solid: true, shrink: 0.8 },

  // --------------------------------------------------------------- in-hand
  // Held viewmodels are re-scaled by the viewmodel code; 2 m is the real length
  // of the rod so the world-space version (leaning on a wall) also looks right.
  // All three are modern angling rods (reel + line guides up the blank). This one has
  // a wooden blank so it survives a glance in first person; the other two do not.
  fishing_rod:   { fit: 'height', size: 2.0, solid: false },
  // REJECT: red/orange composite blank with a brown baitcaster reel and EVA grip.
  fishing_rod_b: { fit: 'height', size: 2.0, solid: false, reject: true },
  // REJECT: black graphite blank with a black spinning reel — reads as a carbon rod.
  fishing_rod_c: { fit: 'height', size: 2.0, solid: false, reject: true },
};

export const MODEL_KEYS = Object.keys(MODELS);
