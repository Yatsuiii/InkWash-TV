// The remote as a brush, and the brush as a real one. Everything here is in paper units (the
// sheet is 1600 by 1000) and pure: no DOM. The page draws what step() returns, and the Node tests
// read the same numbers.
//
// A remote is held in one hand, and the thumb presses one button at a time. So:
// - Lifted, the arrows move the brush over the paper, faster the longer one is held.
// - OK touches it to the paper. It presses in, then flows forward on its own, and ◀ ▶ steer it.
//   ▼ presses harder: the line swells and slows, and held, the brush stops and the ink spreads
//   out from it into the paper. ▲ eases off to the very tip: a fine, quick line.
// - OK again lifts it, and the line tapers off as the brush leaves the paper.
// - The brush is a tuft of bristles, dipped fresh for every stroke. Ink flows out of each bristle
//   at its own pace, faster when pressed and when full. Slow, the ink pools into the paper; quick,
//   it's spread too thin to cover it, and the line breaks into streaks, the way a real brush does
//   ("flying white"). The longer the stroke, the drier it gets.
// - « » choose what the next stroke is dipped in: dense ink, light ink, clear water, or one of the
//   dream inks: indigo, gold, cinnabar.
// - Back washes out the last stroke. Play/pause asks for the dream to be told.

export const UNITS = { W: 1600, H: 1000 };

// What the brush can be dipped in. `pigment` is how dark a stroke is on dry paper; `water` is how
// much it wets the paper, and so how far it bleeds; `body` is how much of the ink stays where it
// lands (thick ink does; watery ink spreads and settles with the water).
// The dream inks come after: indigo, gold and cinnabar, each on its own pigment channel (`ch`,
// inkgl.js). Colour stays where it lands: it wets the paper, but it doesn't bleed. `color` is how
// it looks thick on the paper, for the dishes, the brush and the plain 2D ink.
export const INKS = [
  { id: 'dense', name: 'White', pigment: 1, water: 0.8, body: 0.82 },
  { id: 'light', name: 'Soft', pigment: 0.18, water: 1.1, body: 0.4 },
  { id: 'water', name: 'Water', pigment: 0, water: 1.3, body: 0 },
  { id: 'indigo', name: 'Blue', pigment: 0.92, water: 0.7, body: 0.95, ch: 1, color: '#2f4a86' },
  { id: 'gold', name: 'Gold', pigment: 0.95, water: 0.7, body: 0.95, ch: 2, color: '#d69e2e' },
  { id: 'cinnabar', name: 'Red', pigment: 0.92, water: 0.7, body: 0.95, ch: 3, color: '#c2372a' },
];
// the dream inks: colour, not black
export const COLOURED = new Set(INKS.filter((k) => k.ch).map((k) => k.id));

export const TUNING = {
  hoverSlow: 240, hoverFast: 720, hoverRamp: 0.8, // lifted: units/s, units/s, s
  cruise: 150, fast: 300, // units/s
  turn: 2.4, turnEase: 0.12, speedEase: 0.2, // rad/s, s, s
  pressure: { normal: 0.5, press: 1, light: 0.14 },
  pressEase: 0.1, // s
  entry: 0.12, tail: 0.2, // s: pressing in at the start, lifting off at the end
  width: 13, // the footprint's half-width at full pressure, in units
  bristles: 16, // clumps of bristles, each with its own ink
  pool: 380, // paper (in square units) one bristle's full load soaks, held still
  flow: 0.55, // share of its load a full bristle gives up per second, pressed firmly
  cover: 0.0016, // ink it takes to cover one unit of travel solidly
  margin: 6,
  spacing: 4, // units between the points kept for each stroke
};
const T = TUNING;
const ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (from, to, dt, tau) => from + (to - from) * Math.min(1, dt / tau);
const turnBy = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a)); // from a to b, the short way
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;

// Smooth 1D value noise, 0 to 1.
function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const h = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
  return h(i) + (h(i + 1) - h(i)) * u;
}

// A small seeded generator, so a brush is the same brush every time it's made.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBristles(n, rand) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = clamp(-1 + (2 * (i + 0.5)) / n + (rand() - 0.5) * (1.1 / n), -1, 1); // across the tuft
    out.push({
      u,
      f: rand(), // where along the footprint it touches, from the trailing tip (0) to the front (1)
      touch: 0.03 + 0.5 * Math.pow(Math.abs(u), 1.4) * (0.75 + 0.5 * rand()), // pressure that brings it down
      cap: clamp(0.82 + 0.2 * rand() - 0.14 * Math.abs(u), 0.5, 1), // how much ink it holds
      thirst: 0.7 + 0.6 * rand(), // how readily it lets the ink go
      tone: 0.86 + 0.28 * rand(), // how dark its ink is, against the others: the strands in a stroke
      seed: r2(rand()),
      v: 0, x: 0, y: 0, on: false, dist: 0,
    });
  }
  return out;
}

// `bounds` is the part of the paper the brush may reach.
export function createBrush({ width = UNITS.W, height = UNITS.H, bounds = null, x, y, heading = 0, ink = 0, seed = 7 } = {}) {
  const box = bounds || { x0: 0, y0: 0, x1: width, y1: height };
  return {
    box, x: x ?? (box.x0 + box.x1) / 2, y: y ?? (box.y0 + box.y1) / 2,
    heading, trail: heading, turning: 0, speed: 0, hold: 0,
    phase: 'lifted', phaseT: 0, pressure: 0, ink, still: 0,
    bristles: makeBristles(T.bristles, rng(seed)),
    strokes: [], dryNoted: false, atEdge: false, strokeT: 0, soaked: 0, poolR: 0, liftFrom: 0, travel: 0, pressT: 0,
    // the painting's own time, for how it was painted: when each stroke began and ended, how long
    // the brush waited between strokes, how many were washed out
    clock: 0, lastEnd: null, washes: 0, inks: 0,
    get down() { return this.phase === 'entry' || this.phase === 'paint'; },
    get touching() { return this.phase !== 'lifted'; },
  };
}

// How much ink is left in the brush, 0 to 1.
export function load(b) {
  const caps = b.bristles.reduce((s, br) => s + br.cap, 0);
  return b.bristles.reduce((s, br) => s + br.v, 0) / caps;
}

// One frame. `input.arrow` is the arrow to follow while lifted; `input.held` is every button held
// now. Returns { segs, event }: the bristles' marks this frame, for the page to draw, and what
// happened: null, 'end' (a stroke finished lifting off), 'dry' (this stroke's brush has run dry),
// 'pool' (the brush has stopped and the ink is spreading) or 'edge'.
export function step(b, input = {}, dt = 0) {
  dt = Math.max(0, Math.min(dt, 0.05)); // after a stall, never leap more than one frame's worth
  b.clock += dt;
  const held = input.held || new Set();
  if (b.phase === 'lifted') { hover(b, input.arrow || null, dt); return { segs: [], event: null }; }
  return paint(b, held, dt);
}

// Slow, smooth wobble, the same for the same stroke: a sum of two waves with phases from the
// stroke's number.
function wander(b, k) {
  const n = b.strokes.length * 1.7 + k * 4.1;
  return 0.6 * Math.sin(2.3 * b.strokeT + n * 2.9) + 0.4 * Math.sin(5.9 * b.strokeT + n * 1.3);
}

function hover(b, arrow, dt) {
  if (!arrow) { b.hold = 0; b.speed = 0; return; }
  b.hold += dt;
  const v = T.hoverSlow + (T.hoverFast - T.hoverSlow) * Math.min(1, b.hold / T.hoverRamp);
  b.heading = b.trail = ANGLE[arrow];
  moveBy(b, Math.cos(b.heading) * v * dt, Math.sin(b.heading) * v * dt);
}

function paint(b, held, dt) {
  b.phaseT += dt;
  let event = null;
  const P = T.pressure;
  // how hard the brush is pressed, and how fast it goes
  let pTarget, vTarget;
  const pressing = held.has('down'), easing = held.has('up');
  if (b.phase === 'tail') {
    pTarget = 0;
    vTarget = b.speed * 1.02; // a lift is a little flick: it doesn't slow
  } else {
    pTarget = pressing ? P.press : easing ? P.light : P.normal;
    // pressed, it slows; held on, it stops, and the ink pools
    b.pressT = pressing ? b.pressT + dt : 0;
    vTarget = pressing ? (b.pressT < 0.45 ? T.cruise * 0.4 : 0) : easing ? T.fast : T.cruise;
    if (b.phase === 'entry') {
      const k = b.phaseT / T.entry;
      pTarget = Math.max(pTarget, P.normal * 1.18 * (1 - 0.15 * k)); // press in: a little heavier at the start
      if (!pressing) vTarget = T.cruise * (0.45 + 0.55 * k); // it lands moving, the way a hand does
      if (k >= 1) { b.phase = 'paint'; b.phaseT = 0; }
    }
  }
  const tau = b.phase === 'entry' ? 0.04 : T.pressEase;
  // a hand is never quite still: the pressure breathes a little along the stroke
  if (b.phase !== 'tail') {
    pTarget *= 1 + 0.16 * wander(b, 0);
    b.pressure = clamp(ease(b.pressure, pTarget, dt, tau), 0, 1);
  } else {
    // lifting: the pressure runs out evenly, and the line ends cleanly
    if (b.phaseT <= dt) b.liftFrom = b.pressure;
    b.pressure = b.liftFrom * Math.pow(Math.max(0, 1 - b.phaseT / T.tail), 1.4);
  }
  b.speed = ease(b.speed, vTarget, dt, pressing ? 0.25 : T.speedEase);
  if (pressing && b.pressT >= 0.45 && b.speed < 12) b.speed = 0;
  // steering, smoothed so a turn is a curve
  const turnTarget = b.phase === 'tail' ? b.turning : held.has('left') ? -T.turn : held.has('right') ? T.turn : 0;
  b.turning = ease(b.turning, turnTarget, dt, T.turnEase);
  b.heading += (b.turning + 0.035 * wander(b, 1)) * dt;
  b.strokeT += dt;
  // the trailing tip follows the heading a moment behind, so a turn bends the tuft
  b.trail += turnBy(b.trail, b.heading) * Math.min(1, dt / 0.1);

  const moved = moveBy(b, Math.cos(b.heading) * b.speed * dt, Math.sin(b.heading) * b.speed * dt);
  b.travel += moved;
  const blocked = b.speed > 1 && moved < b.speed * dt * 0.2;
  if (blocked) { b.speed = 0; if (!b.atEdge) event = 'edge'; }
  b.atEdge = blocked || (b.atEdge && b.speed < 1);
  // pooling is deliberate: the brush pressed down and held there (or pushed against the edge)
  b.still = b.speed < 1 && (pressing || b.atEdge) ? b.still + dt : 0;
  if (b.still > 0.25 && b.still - dt <= 0.25 && b.phase !== 'tail') event = event || 'pool';

  const segs = bristleMarks(b, dt);
  record(b, dt);
  if (!b.dryNoted && load(b) < 0.15) { b.dryNoted = true; event = event || 'dry'; }
  if (b.phase === 'tail' && b.phaseT >= T.tail) {
    b.phase = 'lifted'; b.phaseT = 0; b.pressure = 0; b.speed = 0; b.turning = 0;
    for (const br of b.bristles) br.on = false;
    const s = b.strokes[b.strokes.length - 1];
    if (s) { s.done = true; s.t1 = b.clock; b.lastEnd = b.clock; }
    event = 'end';
  }
  return { segs, event };
}

// Where each bristle meets the paper, and the mark it leaves since the last frame. The footprint
// is a teardrop: round at the front, near the ferrule, and drawn to a point behind, where the tip
// trails. Pressed harder it grows wider and longer and the outer bristles come down too; eased
// off, only the few at the tip still touch.
//
// Each mark says how dark it is on dry paper (`pig`), how much of the paper under it the ink
// covers (`cover`: below 1, it breaks into dry-brush streaks), and how much water it gives the
// paper (`wat`, about 1 for a steady line; held still, it keeps giving, and the ink spreads).
function bristleMarks(b, dt) {
  const segs = [];
  const p = b.pressure;
  const W = T.width * Math.pow(p, 0.7);
  const ink = INKS[b.ink];
  const radius = (W / T.bristles) * 1.6 + 0.5;
  const steady = (0.85 * T.flow * 0.71) / (2 * radius * T.cruise); // water per unit area of a steady line
  // landing, the tuft spreads into one solid head; lifting, it drags drier at the very end
  const landing = b.phase === 'entry' ? 1 - clamp(b.phaseT / T.entry, 0, 1) : 0;
  const lifting = b.phase === 'tail' ? clamp(b.phaseT / T.tail, 0, 1) : 0;
  const L = (1.25 - 0.4 * landing) * W; // pressed straight down, the tuft is rounder
  // held still, the ink soaks out of the whole tuft into one spreading pool
  const pooling = b.still > 0.12 && b.phase !== 'tail';
  let soaked = 0;
  for (const br of b.bristles) {
    // the outer bristles waver a little along the way, so the edges aren't ruled
    const lat = (br.u + (noise1(br.seed * 53 + br.dist / 7) - 0.5) * 0.22 * Math.abs(br.u)) * W;
    const back = -L * (1 - Math.abs(br.u)) * (1 - 0.6 * landing);
    const front = W * 0.6 * Math.sqrt(Math.max(0, 1 - br.u * br.u));
    // the trailing tip unfolds behind the brush as it moves off; it can't reach back past where
    // the stroke began
    const along = Math.max(back + (front - back) * br.f, -b.travel * 0.9 - 0.5);
    const h = b.heading + turnBy(b.heading, b.trail) * clamp(-along / (L + 1e-6), 0, 1);
    const x = b.x + Math.cos(h) * along - Math.sin(h) * lat;
    const y = b.y + Math.sin(h) * along + Math.cos(h) * lat;
    const touching = p > br.touch && br.v > 0.002;
    if (touching) {
      const pc = clamp((p - br.touch) / (1 - br.touch), 0, 1); // how firmly this bristle presses
      const len = br.on ? Math.hypot(x - br.x, y - br.y) : 0;
      const give = Math.min(br.v, br.cap * T.flow * br.thirst * (0.45 + 0.55 * pc) * Math.pow(br.v / br.cap, 0.7) * dt);
      br.v -= give;
      // drawn as light (b.steady), the brush never runs dry: light doesn't thin into dry streaks
      if (b.steady && !pooling) br.v = Math.max(br.v, br.cap * 0.72);
      if (pooling) soaked += give;
      else {
        const touch = 0.75 + 0.25 * pc; // a light touch marks a narrower path
        const cover = (len > 0.05 ? clamp(give / (T.cover * len * touch), 0, 1) : 1) * (1 - 0.55 * lifting * lifting);
        const area = 2 * radius * len + Math.PI * radius * radius;
        segs.push({
          x0: br.on ? br.x : x, y0: br.on ? br.y : y, x1: x, y1: y,
          d0: r1(br.dist), // how far this bristle has travelled, so its dry streaks run along the stroke
          r: radius * touch,
          pig: Math.min(1, ink.pigment * br.tone * (0.55 + 0.45 * cover) * (0.75 + 0.25 * pc)),
          cover,
          wat: ((ink.water * give) / area / steady) * (1 + 0.3 * landing),
          body: ink.body,
          seed: br.seed,
          ch: ink.ch || 0,
        });
        br.dist += len;
      }
    }
    br.on = touching && !pooling; br.x = x; br.y = y;
  }
  const cx = b.x - Math.cos(b.heading) * L * 0.3, cy = b.y - Math.sin(b.heading) * L * 0.3;
  if (landing > 0 && p > 0.1) {
    // the head: the pressed tuft, as one solid mark
    const back = Math.min(L * 0.25, b.travel * 0.9);
    const tx = b.x - Math.cos(b.trail) * back, ty = b.y - Math.sin(b.trail) * back;
    segs.push({ x0: tx, y0: ty, x1: b.x + Math.cos(b.heading) * W * 0.15, y1: b.y + Math.sin(b.heading) * W * 0.15, d0: 0, r: W * 0.46, pig: ink.pigment * 0.95, cover: 1, wat: ink.water * 0.35, body: ink.body, seed: 0.37, ch: ink.ch || 0 });
  }
  if (pooling && soaked > 0) {
    // the pool grows with what has soaked out of the brush: wet ink, spreading, no crisp edge.
    // `d0` carries how big it was a frame ago, so the paper is wetted once, as the edge passes.
    b.soaked += soaked;
    const r = Math.sqrt((b.soaked * T.pool) / Math.PI) + W * 0.5;
    segs.push({ x0: cx, y0: cy, x1: cx, y1: cy, d0: b.poolR, r, pig: ink.pigment, cover: 1, wat: ink.water, body: 0, seed: r2((b.strokes.length * 0.137) % 1), pool: true, ch: ink.ch || 0 });
    b.poolR = r;
  } else if (!pooling) { b.soaked = 0; b.poolR = 0; }
  return segs;
}

// The stroke as the guide reads it: where it went, how hard it was pressed, where the ink pooled.
function record(b, dt) {
  const s = b.strokes[b.strokes.length - 1];
  if (!s || b.pressure < 0.04) return;
  const last = s.points[s.points.length - 1];
  if (!last || Math.hypot(last.x - b.x, last.y - b.y) >= T.spacing) s.points.push({ x: r1(b.x), y: r1(b.y), p: r2(b.pressure) });
  else if (b.still > 0.25) last.pool = r2((last.pool || 0) + dt);
  if (b.still > 0.25) s.still = (s.still || 0) + dt;
}

function moveBy(b, dx, dy) {
  const x = clamp(b.x + dx, b.box.x0 + T.margin, b.box.x1 - T.margin);
  const y = clamp(b.y + dy, b.box.y0 + T.margin, b.box.y1 - T.margin);
  const d = Math.hypot(x - b.x, y - b.y);
  b.x = x; b.y = y;
  return d;
}

// A discrete press. Returns what it did: 'down', 'lift', 'ink', 'undo', 'exit', 'tell', 'empty'
// or null.
export function press(b, button) {
  switch (button) {
    case 'select':
      if (b.phase === 'entry' || b.phase === 'paint') return lift(b);
      return setDown(b);
    case 'fastforward': return chooseInk(b, 1);
    case 'rewind': return chooseInk(b, -1);
    case 'back': {
      if (b.touching) endNow(b);
      if (!b.strokes.length) return 'exit';
      b.strokes.pop();
      b.washes++;
      return 'undo';
    }
    case 'playpause':
      if (b.touching) endNow(b);
      return b.strokes.length ? 'tell' : 'empty';
    default: return null;
  }
}

// They said something on their phone: the wait before the next stroke is counted from now, since
// talking is not hesitating. While a stroke is being painted, nothing changes.
export function spoke(b) {
  if (!b.touching && b.lastEnd != null) b.lastEnd = Math.max(b.lastEnd, b.clock);
}

// Dip, and touch the paper: a new stroke.
function setDown(b) {
  if (b.phase === 'tail') endNow(b);
  b.phase = 'entry'; b.phaseT = 0; b.pressure = T.pressure.normal; b.speed = T.cruise * 0.4; b.turning = 0; b.still = 0; b.strokeT = 0; b.travel = 0;
  b.trail = b.heading; b.dryNoted = false;
  for (const br of b.bristles) { br.v = br.cap; br.on = false; br.dist = 0; }
  b.strokes.push({ ink: b.ink, points: [{ x: r1(b.x), y: r1(b.y), p: 0.05 }], done: false, t0: b.clock, gap: b.clock - (b.lastEnd ?? 0) });
  return 'down';
}

// Lift: the brush leaves the paper over a moment, and the line tapers off.
function lift(b) {
  b.phase = 'tail'; b.phaseT = 0;
  return 'lift';
}

// Off the paper at once, keeping the stroke (a tap of OK twice leaves no speck).
function endNow(b) {
  b.phase = 'lifted'; b.phaseT = 0; b.pressure = 0; b.speed = 0; b.turning = 0;
  for (const br of b.bristles) br.on = false;
  const s = b.strokes[b.strokes.length - 1];
  if (s && !s.done) {
    if (s.points.length < 2 && !s.points.some((pt) => pt.pool)) b.strokes.pop();
    else { s.done = true; s.t1 = b.clock; b.lastEnd = b.clock; }
  }
}

function chooseInk(b, d) {
  b.ink = (b.ink + d + INKS.length) % INKS.length;
  b.inks++;
  return 'ink';
}

// The strokes in a form the guide (and a model) can read: where each went, its ink, how it was
// painted. Coordinates in paper units, rounded.
export function summarize(b) {
  return b.strokes.map((s, i) => {
    const xs = s.points.map((q) => q.x), ys = s.points.map((q) => q.y);
    let length = 0, turn = 0, wiggle = 0, bend = 0;
    for (let k = 1; k < s.points.length; k++) {
      length += Math.hypot(s.points[k].x - s.points[k - 1].x, s.points[k].y - s.points[k - 1].y);
      if (k > 1) {
        const a = Math.atan2(s.points[k - 1].y - s.points[k - 2].y, s.points[k - 1].x - s.points[k - 2].x);
        const c = Math.atan2(s.points[k].y - s.points[k - 1].y, s.points[k].x - s.points[k - 1].x);
        const t = turnBy(a, c);
        turn += Math.abs(t);
        // a wavering line, not a curve: the way it bends turns over, left then right
        if (Math.abs(t) > 0.01) { if (bend && Math.sign(t) !== bend) wiggle++; bend = Math.sign(t); }
      }
    }
    const pressures = s.points.map((q) => q.p);
    const pm = pressures.reduce((a, c) => a + c, 0) / pressures.length;
    return {
      n: i + 1, ink: INKS[s.ink].id,
      from: [Math.round(xs[0]), Math.round(ys[0])], to: [Math.round(xs.at(-1)), Math.round(ys.at(-1))],
      box: [Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.max(...xs)), Math.round(Math.max(...ys))],
      length: Math.round(length), turn: r1(turn),
      pressure: r2(pm),
      // how much the pressure shook along it, and how often it wavered
      pvar: r2(Math.sqrt(pressures.reduce((a, c) => a + (c - pm) ** 2, 0) / pressures.length)), wiggle,
      pools: s.points.filter((q) => q.pool > 0.3).map((q) => [Math.round(q.x), Math.round(q.y)]),
      // how it was painted: how long the stroke took, how long the brush waited before it, and
      // how long it was held still on the paper
      ms: Math.round(((s.t1 ?? b.clock) - (s.t0 ?? b.clock)) * 1000), gap: r1(s.gap ?? 0), still: r2(s.still || 0),
    };
  });
}

// The whole sitting: how many strokes were washed out, how often the ink was changed, how long.
export function sitting(b) {
  return { washes: b.washes, inks: b.inks, seconds: r1(b.clock) };
}
