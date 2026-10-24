import * as THREE from 'three';
import { CLANS, chooseClan, currentClan } from './clans.js';
import { cityMaterial } from './builder.js';

// The clan banners in the castle courtyard, where every prince chooses a clan.
//
// Each stand is a tall pole with a crossbar, a banner painted with the clan's
// emblem, and a stone foot. Walk up to one and look at it: a panel tells you
// about the clan. E asks you to confirm; E again within a few seconds joins.
// The choice is final at once (docs/DESIGN.md) — after it, the stands go quiet.

const REACH = 3.2;           // how close you must stand
const CONFIRM_WINDOW = 4;    // seconds to press E a second time

// ------------------------------------------------------------- the banners

function drawEmblem(g, id, accent) {
  g.save();
  g.strokeStyle = accent;
  g.fillStyle = accent;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.translate(128, 200);
  if (id === 'brutes') {
    // Two crossed swords.
    for (const a of [-0.7, 0.7]) {
      g.save();
      g.rotate(a);
      g.lineWidth = 12;
      g.beginPath(); g.moveTo(0, -95); g.lineTo(0, 60); g.stroke();       // blade
      g.lineWidth = 14;
      g.beginPath(); g.moveTo(-30, 60); g.lineTo(30, 60); g.stroke();      // guard
      g.lineWidth = 10;
      g.beginPath(); g.moveTo(0, 60); g.lineTo(0, 92); g.stroke();         // grip
      g.beginPath(); g.arc(0, 98, 9, 0, Math.PI * 2); g.fill();          // pommel
      g.restore();
    }
  } else if (id === 'cyborgs') {
    // A gear with a glowing eye.
    g.lineWidth = 14;
    g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 10; i++) {
      g.save(); g.rotate((i / 10) * Math.PI * 2);
      g.fillRect(-10, -92, 20, 26);
      g.restore();
    }
    g.shadowColor = accent; g.shadowBlur = 30;
    g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.fill();
  } else if (id === 'dragons') {
    // A flame.
    g.beginPath();
    g.moveTo(0, 95);
    g.bezierCurveTo(-85, 70, -70, -10, -20, -40);
    g.bezierCurveTo(-30, -5, -5, 5, 0, -20);
    g.bezierCurveTo(5, -60, 30, -80, 10, -110);
    g.bezierCurveTo(70, -70, 90, 10, 50, 50);
    g.bezierCurveTo(70, 20, 60, -5, 55, -15);
    g.bezierCurveTo(95, 40, 60, 90, 0, 95);
    g.fill();
  } else if (id === 'apex') {
    // Three claw slashes.
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(-50 + i * 34, -90);
      g.quadraticCurveTo(-10 + i * 34, 0, 40 + i * 34, 90);
      g.lineTo(52 + i * 34, 80);
      g.quadraticCurveTo(10 + i * 34, 0, -38 + i * 34, -92);
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}

function bannerTexture(id, clan) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  // Swallowtail cloth: the notch at the bottom is cut out (alphaTest).
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 512); g.lineTo(128, 430); g.lineTo(0, 512);
  g.closePath();
  g.fillStyle = clan.colour;
  g.fill();
  // A woven look: faint horizontal and vertical threads.
  g.globalAlpha = 0.08;
  g.fillStyle = '#000';
  for (let y = 0; y < 512; y += 3) g.fillRect(0, y, 256, 1);
  g.fillStyle = '#fff';
  for (let x = 0; x < 256; x += 4) g.fillRect(x, 0, 1, 512);
  g.globalAlpha = 1;
  // Border and emblem.
  g.strokeStyle = clan.accent;
  g.lineWidth = 6;
  g.strokeRect(14, 14, 228, 330);
  drawEmblem(g, id, clan.accent);
  g.font = 'bold 34px Georgia, serif';
  g.textAlign = 'center';
  g.fillStyle = clan.accent;
  g.fillText(clan.name.toUpperCase(), 128, 390);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function buildStand(id, clan, x, z, yaw, renderer) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;

  // The same photo-scanned stone and timber as the castle around them.
  const wood = cityMaterial('timber', renderer);
  const stone = cityMaterial('mossystone', renderer);
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.7 });

  const add = (geo, mat, px, py, pz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(1.1, 0.5, 1.1), stone, 0, 0.25, -0.2);           // foot
  add(new THREE.CylinderGeometry(0.08, 0.1, 4.6, 10), wood, 0, 2.3, -0.2);    // pole
  add(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8), wood, 0, 4.25, -0.12)
    .rotation.z = Math.PI / 2;                                                 // crossbar
  add(new THREE.SphereGeometry(0.1, 10, 8), iron, 0, 4.66, -0.2);             // finial
  const banner = add(new THREE.PlaneGeometry(1.6, 3.2),
    new THREE.MeshStandardMaterial({ map: bannerTexture(id, clan), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.95 }),
    0, 4.2 - 1.6, -0.08);
  banner.castShadow = true;

  const collider = { minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, top: 0.5 };
  return { id, group, banner, collider, pos: new THREE.Vector3(x, 1.5, z) };
}

// ---------------------------------------------------------------- the stands

export function createClanStands(scene, places, renderer) {
  const stands = Object.entries(CLANS).map(([id, clan], i) =>
    buildStand(id, clan, places[i].x, places[i].z, places[i].yaw, renderer));
  for (const s of stands) scene.add(s.group);

  const panel = document.getElementById('clan-panel');
  const toast = document.getElementById('toast');
  let focused = null;
  let armedAt = -Infinity;     // when E was first pressed on `focused`
  let clock = 0;
  let wind = 0;

  function show(stand) {
    if (!panel) return;
    if (!stand) { panel.classList.remove('visible'); return; }
    const clan = CLANS[stand.id];
    const armed = clock - armedAt < CONFIRM_WINDOW;
    const st = clan.stats;
    const bar = (n) => '■'.repeat(n) + '□'.repeat(5 - n);
    panel.innerHTML = `
      <div class="name" style="color:${clan.accent}">${clan.name}</div>
      <p>${clan.blurb}</p>
      <div class="stats">
        <span>Health ${bar(st.health)}</span><span>Strength ${bar(st.strength)}</span>
        <span>Armour ${bar(st.armour)}</span><span>Damage ${bar(st.damage)}</span>
        <span>Speed ${bar(st.speed)}</span>
      </div>
      <div class="hint">${armed
        ? `This is final. Press <kbd>E</kbd> again to become a prince of the ${clan.name}.`
        : `Press <kbd>E</kbd> to join the ${clan.name}`}</div>`;
    panel.classList.add('visible');
  }

  function message(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 5000);
  }

  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || !focused || currentClan()) return;
    if (clock - armedAt < CONFIRM_WINDOW) {
      const clan = CLANS[focused.id];
      if (chooseClan(focused.id)) {
        message(`You are a prince of the ${clan.name}. The portal is open.`);
        focused = null;
        show(null);
      }
    } else {
      armedAt = clock;
      show(focused);
    }
  });

  const _look = new THREE.Vector3();
  const _to = new THREE.Vector3();

  return {
    colliders: stands.map((s) => s.collider),
    update(dt, camera, locked) {
      clock += dt;
      wind += dt;
      // Banners stir a little in the wind.
      stands.forEach((s, i) => {
        s.banner.rotation.x = Math.sin(wind * 1.3 + i) * 0.04;
        s.banner.rotation.y = Math.sin(wind * 0.9 + i * 2) * 0.05;
      });

      // Which stand, if any, the player is standing at and looking toward.
      let best = null;
      if (locked && !currentClan()) {
        camera.getWorldDirection(_look);
        let bestScore = 0.55;
        for (const s of stands) {
          _to.subVectors(s.pos, camera.position);
          const d = Math.hypot(_to.x, _to.z);
          if (d > REACH) continue;
          const score = _to.normalize().dot(_look);
          if (score > bestScore) { bestScore = score; best = s; }
        }
      }
      if (best !== focused) {
        focused = best;
        armedAt = -Infinity;
        show(focused);
      } else if (focused && armedAt > -Infinity && clock - armedAt >= CONFIRM_WINDOW) {
        armedAt = -Infinity;     // the confirm window ran out
        show(focused);
      }
    },
  };
}
