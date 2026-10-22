// Each thing of their world, made real on its own (server/illustrator.mjs `thing`): what they
// painted of it, its strokes alone in ink on white, is sent to be painted as the Illustrator said
// it looks, in the look of their world's place, alone on plain white. Here, the part of the paper
// it is painted over and the size it is painted at (`regionOf`), its strokes drawn for that
// (`conditionOf`), and the white cut away so that it can stand in their world (`cutAway`), unless
// the image model has cut it out already (Gemini can't) (`solidOf` says how much of it is left).
// Then it stands there in place of their strokes, the same size and in the same place (night.js,
// inside.js).

// paper units are 1600 by 1000; a thing is painted at 320 to 768 pixels a side, in sixteens, and at
// most 4 to 1 (the sizes Nova Canvas took; Gemini paints the nearest shape it has)
const MIN = 320, MOST = 640, RATIO = 4;
const sixteen = (v) => Math.max(16, Math.round(v / 16) * 16);

// The part of the paper a thing is painted over: its box with a margin all round, made no thinner
// than 4 to 1, centred on it; and the picture's size, its longer side `most` pixels and neither less
// than 320. `kpx`: pixels a paper unit.
export function regionOf(box, { most = MOST } = {}) {
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const margin = 0.14 * Math.max(x1 - x0, y1 - y0) + 30;
  let w = x1 - x0 + 2 * margin, h = y1 - y0 + 2 * margin;
  if (w > RATIO * h) h = w / RATIO;
  if (h > RATIO * w) w = h / RATIO;
  const kpx = most / Math.max(w, h);
  // neither side under 320 pixels: the region grows on that side
  if (w * kpx < MIN) w = MIN / kpx;
  if (h * kpx < MIN) h = MIN / kpx;
  const width = sixteen(w * kpx), height = sixteen(h * kpx);
  w = width / kpx; h = height / kpx;
  return { region: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], width, height, kpx };
}

// Its strokes alone, in black on white, over its region at the picture's size: what the image model
// holds to the edges of. `parts`: strokes with their `path` (paper units) and how hard they pressed.
export function conditionOf(parts, R, doc = globalThis.document) {
  const c = doc.createElement('canvas');
  c.width = R.width; c.height = R.height;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#111111'; g.lineCap = 'round'; g.lineJoin = 'round';
  const [rx, ry] = R.region, k = R.kpx;
  for (const p of parts) {
    const path = p.path || [];
    if (!path.length) continue;
    g.lineWidth = Math.max(3, (10 + 26 * (p.pressure ?? 0.5)) * k);
    g.beginPath();
    path.forEach(([x, y], i) => (i ? g.lineTo((x - rx) * k, (y - ry) * k) : g.moveTo((x - rx) * k, (y - ry) * k)));
    if (path.length === 1) g.lineTo((path[0][0] - rx) * k + 0.1, (path[0][1] - ry) * k);
    g.stroke();
  }
  return c;
}

// The white it was painted on, cut away: every pixel near white that the edge of the picture reaches
// without crossing the thing becomes clear (white inside it, a window or an eye, stays), and the
// pixels along its edge are eased into the clear, without the white fringe. `img`: { data (RGBA),
// width, height }, changed in place and returned; with how much of it is the thing (`kept`, 0 to 1).
export function cutAway(img, { white = 226, grey = 34, edge = 170 } = {}) {
  const { data: d, width: W, height: H } = img, n = W * H;
  const paper = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], lo = Math.min(r, g, b); return lo >= white && Math.max(r, g, b) - lo <= grey; };
  const gone = new Uint8Array(n), queue = new Int32Array(n);
  let head = 0, tail = 0;
  const reach = (i) => { if (!gone[i] && paper(i)) { gone[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < W; x++) { reach(x); reach((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { reach(y * W); reach(y * W + W - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % W, y = (i / W) | 0;
    if (x > 0) reach(i - 1);
    if (x < W - 1) reach(i + 1);
    if (y > 0) reach(i - W);
    if (y < H - 1) reach(i + W);
  }
  let kept = 0;
  for (let i = 0; i < n; i++) {
    if (gone[i]) { d[i * 4 + 3] = 0; continue; }
    kept++;
    const x = i % W, y = (i / W) | 0;
    const near = (x > 0 && gone[i - 1]) || (x < W - 1 && gone[i + 1]) || (y > 0 && gone[i - W]) || (y < H - 1 && gone[i + W]);
    if (!near) continue;
    // along the edge, as clear as it is light, and its colour as it would be without the white behind
    const lo = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    if (lo <= edge) continue;
    const a = Math.max(0.15, (255 - lo) / (255 - edge));
    for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.max(0, Math.min(255, Math.round((d[i * 4 + c] - 255 * (1 - a)) / a)));
    d[i * 4 + 3] = Math.round(255 * a);
  }
  img.kept = kept / n;
  return img;
}

// what a thing's picture is made from, so it is made again only when that changes: its strokes, how
// it looks, the look of their world's place, and how they said it looks, if they have (last, so
// that a picture made before any was said keeps its sign)
export const signOfThing = ({ strokes = [], look = null, place = null, rule = null }) => JSON.stringify([strokes.map((s) => [s.n, Math.round((s.box || [])[0] || 0), Math.round((s.box || [])[1] || 0)]), look || '', place || '', ...(rule ? [rule] : [])]);

// how much of a picture is the thing, by how clear it is: what the image model cut out (`img`: {
// data (RGBA), width, height }), 0 to 1
export function solidOf(img, { clear = 16 } = {}) {
  const d = img.data, n = img.width * img.height;
  let kept = 0;
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] > clear) kept++;
  return n ? kept / n : 0;
}
