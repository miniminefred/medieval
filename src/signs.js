import * as THREE from 'three';

// Painted signs, drawn on a canvas: a wooden board with lettering (a stall's
// name), and a chalkboard on an easel whose words can change (the day's deal).

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function woodBoard(g, w, h) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#6b4a2a'); grad.addColorStop(1, '#4a3019');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.18; g.strokeStyle = '#2a1a0c';
  for (let y = 6; y < h; y += 9) { g.beginPath(); g.moveTo(0, y + Math.sin(y) * 2); g.bezierCurveTo(w / 3, y + 3, w * 2 / 3, y - 3, w, y); g.stroke(); }
  g.globalAlpha = 1;
  g.strokeStyle = '#2a1a0c'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
}

// A board with `text` painted on it, `width` metres wide. Returns a mesh facing +z.
export function paintedSign(text, width = 1.8, height = 0.4, color = '#e8d6a8') {
  const c = canvas(512, Math.round(512 * height / width));
  const g = c.getContext('2d');
  woodBoard(g, c.width, c.height);
  g.fillStyle = color;
  g.font = `bold ${Math.round(c.height * 0.48)}px Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4;
  g.fillText(text.toUpperCase(), c.width / 2, c.height / 2 + 2, c.width - 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.05), [
    new THREE.MeshStandardMaterial({ color: 0x4a3019 }), new THREE.MeshStandardMaterial({ color: 0x4a3019 }),
    new THREE.MeshStandardMaterial({ color: 0x4a3019 }), new THREE.MeshStandardMaterial({ color: 0x4a3019 }),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }),
  ]);
  m.castShadow = true;
  return m;
}

// A chalkboard on an easel; `write(lines)` chalks new words on it.
export function chalkboard() {
  const c = canvas(256, 320);
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.9 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.03), [wood, wood, wood, wood,
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), wood]);
  board.position.y = 0.85;
  board.rotation.x = -0.18;
  group.add(board);
  for (const [x, z, r] of [[-0.24, 0.05, 0.15], [0.24, 0.05, 0.15], [0, -0.25, -0.45]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 6), wood);
    leg.position.set(x, 0.58, z);
    leg.rotation.x = r;
    group.add(leg);
  }
  return {
    object: group,
    write(lines) {
      g.fillStyle = '#1e2a22'; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 14; g.strokeRect(0, 0, c.width, c.height);
      g.fillStyle = '#ece8dc'; g.textAlign = 'center';
      lines.forEach((l, i) => {
        g.font = `${i === 0 ? 'bold 38' : '28'}px "Comic Sans MS", Georgia, serif`;
        g.fillText(l, c.width / 2, 70 + i * 52, c.width - 30);
      });
      t.needsUpdate = true;
    },
  };
}
