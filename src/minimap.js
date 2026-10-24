import { ROADS, CAMPS } from './wasteland/places.js';
import { CITY } from './wasteland/terrain.js';
import { activeQuest } from './quests.js';
import { explored } from './explored.js';

// The round minimap in the top-right corner: 160 m across, turned so the way you
// face is always up. Roads, the cyborg city and camps show only where you have
// explored (explored.js); the quest goal always shows, pinned to the rim when it
// is out of range. In the castle it just shows the arrow and a
// marker toward the portal.

const RANGE = 80;   // metres from the centre to the rim

export function createMinimap() {
  const c = document.getElementById('minimap');
  const g = c.getContext('2d');
  const S = c.width, R = S / 2;

  return {
    update(realmName, pos, heading, extraGoal) {
      g.save();
      g.clearRect(0, 0, S, S);
      g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.clip();
      g.fillStyle = realmName === 'wasteland' ? 'rgba(170, 140, 100, 0.85)' : 'rgba(70, 95, 55, 0.85)';
      g.fillRect(0, 0, S, S);

      // World → map: relative to the player, rotated so `heading` points up.
      const scale = R / RANGE;
      const cos = Math.cos(heading), sin = Math.sin(heading);
      const to = (x, z) => {
        const dx = x - pos.x, dz = z - pos.z;
        // Rotate so the facing direction (sin h, -cos h) lands straight up.
        return [R + (dx * cos + dz * sin) * scale, R + (-dx * sin + dz * cos) * scale];
      };

      if (realmName === 'wasteland') {
        g.strokeStyle = 'rgba(90, 70, 45, 0.9)'; g.lineWidth = 6 * scale + 1; g.lineCap = 'round';
        for (const road of ROADS) {
          g.beginPath();
          let pen = false;
          for (const p of road) {
            if (Math.abs(p.x - pos.x) > RANGE * 1.5 || Math.abs(p.z - pos.z) > RANGE * 1.5) { pen = false; continue; }
            const [mx, my] = to(p.x, p.z);
            pen ? g.lineTo(mx, my) : g.moveTo(mx, my);
            pen = true;
          }
          g.stroke();
        }
        g.fillStyle = 'rgba(80, 76, 70, 0.9)';
        g.beginPath();
        [[CITY.minX, CITY.minZ], [CITY.maxX, CITY.minZ], [CITY.maxX, CITY.maxZ], [CITY.minX, CITY.maxZ]]
          .forEach(([x, z], i) => { const [mx, my] = to(x, z); i ? g.lineTo(mx, my) : g.moveTo(mx, my); });
        g.fill();
        g.fillStyle = '#8a1d14';
        for (const camp of CAMPS) {
          if (!explored.has(camp.x, camp.z)) continue;
          const [mx, my] = to(camp.x, camp.z);
          g.beginPath(); g.arc(mx, my, camp.big ? 5 : 3.5, 0, Math.PI * 2); g.fill();
        }

        // Fog over everything not yet explored, in the same rotated frame.
        g.save();
        g.setTransform(cos * scale, -sin * scale, sin * scale, cos * scale,
          R - (cos * pos.x + sin * pos.z) * scale, R - (-sin * pos.x + cos * pos.z) * scale);
        g.imageSmoothingEnabled = true;
        g.drawImage(explored.fogImage(), -explored.HALF, -explored.HALF, explored.HALF * 2, explored.HALF * 2);
        g.restore();
      }

      // The goal: the active quest's (in this realm) or one the realm supplies.
      const q = activeQuest();
      const goal = q?.goal?.realm === realmName ? q.goal : extraGoal;
      if (goal) {
        let [mx, my] = to(goal.x, goal.z);
        const dx = mx - R, dy = my - R, d = Math.hypot(dx, dy);
        if (d > R - 9) { mx = R + (dx / d) * (R - 9); my = R + (dy / d) * (R - 9); }
        g.fillStyle = '#6fc3ff'; g.strokeStyle = '#082035'; g.lineWidth = 2;
        g.beginPath(); g.arc(mx, my, 5.5, 0, Math.PI * 2); g.fill(); g.stroke();
      }

      // You: an arrow, always pointing up.
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(R, R - 8); g.lineTo(R + 6, R + 6); g.lineTo(R, R + 3); g.lineTo(R - 6, R + 6); g.closePath();
      g.fill(); g.stroke();
      g.restore();

      // North tick on the rim.
      const [nx, ny] = [R - Math.sin(heading) * (R - 10), R - Math.cos(heading) * (R - 10)];
      g.fillStyle = '#e8dcc0'; g.font = 'bold 13px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('N', nx, ny);
    },
  };
}
