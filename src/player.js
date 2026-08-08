import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { setupPointerLock } from './input.js';

const EYE = 1.7;           // eye height above the player's feet (units)
const WALK_SPEED = 4.2;    // a person in boots, not a sprinter
const RUN_SPEED = 7.0;
const ACCEL = 12;          // how fast walk velocity chases the input
const GRAVITY = 24;
const JUMP_SPEED = 7.6;
const RADIUS = 0.4;        // horizontal collision radius
const STEP_EPS = 0.35;     // surfaces within this of the feet are stood on, not walls
                           // — a normal step up, and what lets you walk onto the dock

// First-person walker: pointer-lock camera + WASD + jump, with AABB collision
// against the world's boxes (walls block you, low steps can be jumped onto).
export class Player {
  constructor(camera, domElement, keys, colliders = []) {
    this.keys = keys;
    this.colliders = colliders;
    this.velocityY = 0;
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
  }

  setColliders(colliders) {
    this.colliders = colliders;
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

      const speed = this.keys.sprint ? RUN_SPEED : WALK_SPEED;
      if (this._wish.lengthSq() > 0) this._wish.normalize().multiplyScalar(speed);

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
    if (pos.y - EYE <= groundY && this.velocityY <= 0) {
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
    if (dx !== 0) {
      for (const b of this.colliders) {
        if (b.top <= feetY + STEP_EPS) continue;
        if (this._overlapsXZ(pos, b)) {
          pos.x = dx > 0 ? b.minX - RADIUS : b.maxX + RADIUS;
          this._vel.x = 0;
        }
      }
    }

    pos.z += dz;
    if (dz !== 0) {
      for (const b of this.colliders) {
        if (b.top <= feetY + STEP_EPS) continue;
        if (this._overlapsXZ(pos, b)) {
          pos.z = dz > 0 ? b.minZ - RADIUS : b.maxZ + RADIUS;
          this._vel.z = 0;
        }
      }
    }
  }

  _overlapsXZ(pos, b) {
    return pos.x > b.minX - RADIUS && pos.x < b.maxX + RADIUS &&
           pos.z > b.minZ - RADIUS && pos.z < b.maxZ + RADIUS;
  }

  // Highest surface directly beneath the player (0 = ground).
  _supportHeight(pos) {
    const feetY = pos.y - EYE;
    let groundY = 0;
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
