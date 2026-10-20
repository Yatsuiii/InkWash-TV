// Ink in plain 2D, for a screen without WebGL2: the same calls as inkgl.js, a plainer look. No
// wet layer: each bristle mark is a soft line, a pool a soft blot, and dry marks break up along
// the grain. The dream inks (a mark's `ch`) are their own colours. Undo redraws every stroke but
// the last.

const UNITS = { W: 1600, H: 1000 };
const PAPER = '#f4eee0';
// black ink, indigo, gold, cinnabar
const PIGMENT = [[26, 28, 34], [47, 74, 134], [214, 158, 46], [194, 55, 42]];

function rgba(a, ch = 0) { const [r, g, b] = PIGMENT[ch] || PIGMENT[0]; return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`; }
// a stable pseudo-random number from a position, so a redraw breaks the same streaks
function hash(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }

export function createInk2D(canvas) {
  const g = canvas.getContext('2d');
  const k = canvas.width / UNITS.W;
  let strokes = [];
  let open = null;

  function paper() {
    g.globalAlpha = 1;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  function draw(s) {
    g.lineCap = 'round';
    if (s.pool) {
      const r = s.r * k;
      const grad = g.createRadialGradient(s.x1 * k, s.y1 * k, 0, s.x1 * k, s.y1 * k, r);
      // colour held still leaves a soft blot of itself; black ink, a pale wash
      const k = s.ch ? 0.75 : 0.06;
      grad.addColorStop(0, rgba(s.pig * k, s.ch));
      grad.addColorStop(0.8, rgba(s.pig * k * 0.66, s.ch));
      grad.addColorStop(1, rgba(0, s.ch));
      g.fillStyle = grad;
      g.beginPath(); g.arc(s.x1 * k, s.y1 * k, r, 0, Math.PI * 2); g.fill();
      return;
    }
    if (s.pig <= 0) return;
    // a dry bristle skips: draw only some of its short pieces
    if (s.cover < 0.95 && hash(Math.round(s.x1), Math.round(s.y1 + s.seed * 50)) > s.cover) return;
    g.strokeStyle = rgba(s.pig * (s.body ?? 0.8) * 0.9 + s.pig * 0.1, s.ch);
    g.lineWidth = Math.max(0.8, 2 * s.r * k);
    g.beginPath(); g.moveTo(s.x0 * k, s.y0 * k); g.lineTo(s.x1 * k, s.y1 * k); g.stroke();
  }
  paper();

  return {
    kind: '2d',
    get wet() { return false; },
    stats: { steps: 0, frames: 0, ms: 0 },
    begin() { open = []; strokes.push(open); },
    marks(segs) {
      if (!open) this.begin();
      for (const s of segs) { open.push(s); draw(s); }
    },
    end() { open = null; },
    undo() {
      open = null;
      if (!strokes.length) return false;
      strokes.pop();
      paper();
      strokes.forEach((st) => st.forEach(draw));
      return true;
    },
    clear() { strokes = []; open = null; paper(); },
    frame() {},
    redraw() {},
    // the painting, the paper alone, and the ink alone as the share of the light it lets through (inkgl.js)
    layers() {
      const sheet = () => { const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; return c; };
      const paperOnly = sheet(), pg = paperOnly.getContext('2d');
      pg.fillStyle = PAPER; pg.fillRect(0, 0, paperOnly.width, paperOnly.height);
      // the painting over the paper it was painted on: dividing out the paper leaves the ink
      const inkOnly = sheet(), ig = inkOnly.getContext('2d');
      ig.drawImage(canvas, 0, 0);
      ig.globalCompositeOperation = 'color-dodge';
      ig.fillStyle = '#0b111f'; // 1 - the paper's colour
      ig.fillRect(0, 0, inkOnly.width, inkOnly.height);
      const painting = sheet();
      painting.getContext('2d').drawImage(canvas, 0, 0);
      return { painting, paper: paperOnly, ink: inkOnly };
    },
    colorAt() { return null; },
    snapshot(width = 768, quality = 0.82) {
      const c = document.createElement('canvas');
      c.width = width; c.height = Math.round((width * canvas.height) / canvas.width);
      c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', quality);
    },
  };
}
