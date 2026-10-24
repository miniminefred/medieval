import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { setupPointerLock } from './input.js';

const EYE = 1.7;           // eye height above the player's feet (units)
const WALK_SPEED = 4.2;    // a person in boots, not a sprinter
const RUN_SPEED = 7.0;
const STAMINA_REFILL = 8;  // seconds for an empty stamina bar to fill again
const RECOVER = 0.3;       // share of the bar back before a winded prince can run
const ACCEL = 12;          // how fast walk velocity chases the input
const GRAVITY = 24;
const JUMP_SPEED = 7.6;
const RADIUS = 0.4;        // horizontal collision radius
const STEP_EPS = 0.35;     // surfaces within this of the feet are stood on, not walls
                           // — a normal step up, and what lets you walk onto the dock
const MAX_SLOPE = 1.0;     // rise per metre (45°) beyond which terrain is a wall
const SNAP_DOWN = 0.6;     // walking downhill, stay glued to ground this far below

// First-person walker: pointer-lock camera + WASD + jump, with AABB collision
// against the world's boxes (walls block you, low steps can be jumped onto).
//
// The floor comes from `groundAt(x, z)` — flat 0 in the castle, the terrain
// height in the wasteland. Terrain steeper than MAX_SLOPE blocks like a wall,
// and `canStand(x, z)` (optional) is a hard edge of the world.
export class Player {
  constructor(camera, domElement, keys, colliders = []) {
    this.keys = keys;
    this.colliders = colliders;
    this.velocityY = 0;
    this.groundAt = () => 0;
    this.runMul = 1;              // from the clan's speed stat: apex run fastest
    this.staminaMax = 10;         // seconds of running on a full bar (clan's speed stat)
    this.stamina = this.staminaMax;
    this.winded = false;          // ran the bar dry: walk until it refills a bit
    this.running = false;
    this.canStand = () => true;
    this.canJump = true;
    this.grounded = true;

    this.controls = new PointerLockControls(camera, domElement);
    this.object = this.controls.object;
    // Out on the grass, facing the gatehouse (the camera looks down -Z).
    this.object.position.set(0, EYE, 36);

    setupPointerLock(this.controls, domElement);

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._vel = new THREE.Vector3();   // horizontal velocity, smoothed
    this._feet = new THREE.Vector3();
  }

  setColliders(colliders) {
    this.colliders = colliders;
  }

  // Swap to another world's floor and walls (realms call this on arrival).
  setWorld({ colliders = [], groundAt = () => 0, canStand = () => true }) {
    this.colliders = colliders;
    this.groundAt = groundAt;
    this.canStand = canStand;
  }

  // Put the feet at (x, z) on the ground, facing `yaw` (0 = looking down -Z).
  teleport(x, z, yaw = 0) {
    const pos = this.object.position;
    pos.set(x, this.groundAt(x, z) + EYE, z);
    this.object.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
    this._vel.set(0, 0, 0);
    this.velocityY = 0;
  }

  get feet() {
    return this._feet.set(this.object.position.x, this.object.position.y - EYE, this.object.position.z);
  }

  // Horizontal speed in m/s — the held viewmodel bobs in time with it.
  get speed() {
    return Math.hypot(this._vel.x, this._vel.z);
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  update(dt, camera) {
    const pos = this.object.position;

    if (this.controls.isLocked) {
      camera.getWorldDirection(this._forward);
      this._forward.y = 0;
      this._forward.normalize();
      this._right.crossVectors(this._forward, camera.up).normalize();

      this._wish.set(0, 0, 0);
      if (this.keys.forward) this._wish.add(this._forward);
      if (this.keys.back) this._wish.sub(this._forward);
      if (this.keys.right) this._wish.add(this._right);
      if (this.keys.left) this._wish.sub(this._right);

      // Everyone walks alike; the clan's speed stat only changes running — how
      // fast, and (through staminaMax) for how long. Spent stamina means walking
      // until it has refilled to RECOVER of the bar.
      const moving = this._wish.lengthSq() > 0;
      this.running = this.keys.sprint && moving && !this.winded;
      if (this.running) {
        this.stamina = Math.max(0, this.stamina - dt);
        if (this.stamina === 0) this.winded = true;
      } else {
        this.stamina = Math.min(this.staminaMax, this.stamina + dt * this.staminaMax / STAMINA_REFILL);
        if (this.winded && this.stamina >= this.staminaMax * RECOVER) this.winded = false;
      }
      const speed = this.running ? RUN_SPEED * this.runMul : WALK_SPEED;
      if (moving) this._wish.normalize().multiplyScalar(speed);

      // Ease into the target velocity so starting and stopping has some weight.
      const k = 1 - Math.exp(-ACCEL * dt);
      this._vel.x += (this._wish.x - this._vel.x) * k;
      this._vel.z += (this._wish.z - this._vel.z) * k;

      if (this.keys.jump && this.canJump) {
        this.velocityY = JUMP_SPEED;
        this.canJump = false;
      }
    } else {
      this._vel.multiplyScalar(Math.max(0, 1 - dt * 10));
    }

    this._moveHorizontal(pos, this._vel.x * dt, this._vel.z * dt);

    this.velocityY -= GRAVITY * dt;
    pos.y += this.velocityY * dt;

    const groundY = this._supportHeight(pos);
    // Walking down a slope would otherwise turn every step into a tiny fall.
    const stick = this.grounded && this.velocityY <= 0 && pos.y - EYE - groundY < SNAP_DOWN;
    if ((pos.y - EYE <= groundY || stick) && this.velocityY <= 0) {
      pos.y = groundY + EYE;
      this.velocityY = 0;
      this.canJump = true;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
  }

  // Move one axis at a time and push back out of any box that rises above the
  // feet, resolving opposite to the direction of travel.
  _moveHorizontal(pos, dx, dz) {
    const feetY = pos.y - EYE;

    pos.x += dx;
    if (dx !== 0 && this._terrainBlocks(pos, pos.x - dx, pos.z, feetY, Math.abs(dx))) {
      pos.x -= dx;
      this._vel.x = 0;
    } else if (dx !== 0) {
      for (const b of this.colliders) {
        if (b.top <= feetY + STEP_EPS) continue;
        if (this._overlapsXZ(pos, b)) {
          pos.x = dx > 0 ? b.minX - RADIUS : b.maxX + RADIUS;
          this._vel.x = 0;
        }
      }
    }

    pos.z += dz;
    if (dz !== 0 && this._terrainBlocks(pos, pos.x, pos.z - dz, feetY, Math.abs(dz))) {
      pos.z -= dz;
      this._vel.z = 0;
    } else if (dz !== 0) {
      for (const b of this.colliders) {
        if (b.top <= feetY + STEP_EPS) continue;
        if (this._overlapsXZ(pos, b)) {
          pos.z = dz > 0 ? b.minZ - RADIUS : b.maxZ + RADIUS;
          this._vel.z = 0;
        }
      }
    }
  }

  // True when the step from (fromX, fromZ) to pos climbs ground too steep to walk
  // up (and the feet are not already above it), or leaves the world.
  _terrainBlocks(pos, fromX, fromZ, feetY, dist) {
    if (!this.canStand(pos.x, pos.z)) return true;
    const h1 = this.groundAt(pos.x, pos.z);
    if (h1 <= feetY + 0.05) return false;
    return (h1 - this.groundAt(fromX, fromZ)) / dist > MAX_SLOPE;
  }

  _overlapsXZ(pos, b) {
    return pos.x > b.minX - RADIUS && pos.x < b.maxX + RADIUS &&
           pos.z > b.minZ - RADIUS && pos.z < b.maxZ + RADIUS;
  }

  // Highest surface directly beneath the player: the ground, or a box on it.
  _supportHeight(pos) {
    const feetY = pos.y - EYE;
    let groundY = this.groundAt(pos.x, pos.z);
    for (const b of this.colliders) {
      if (b.top > feetY + STEP_EPS) continue;
      if (pos.x > b.minX - RADIUS && pos.x < b.maxX + RADIUS &&
          pos.z > b.minZ - RADIUS && pos.z < b.maxZ + RADIUS) {
        if (b.top > groundY) groundY = b.top;
      }
    }
    return groundY;
  }
}
