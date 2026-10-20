// Copied from inkwash/engine/dreams/gesture.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// How they painted it, read against how they usually paint. A photo of the painting shows the
// marks; only the brush knows how they were made: the wait before a stroke, how hard it was
// pressed, where the brush was held until the ink pooled, what was painted, washed out and painted
// again, where they went back over a mark. What stands out is what stands out for this person:
// each night adds to a running picture of their hand (`learnHand`), and a stroke is judged against
// it. Until there is enough of it, against the rest of tonight.
//
// Pure. Strokes are the brush's summaries: { n, ink, box, length, pressure, pools, ms, gap, still }
// (gap: seconds waited before the stroke; still: seconds the brush was held still on the paper).
// Washed: [{ before, box }], what was painted and washed out before the stroke numbered `before`.

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const r1 = (x) => Math.round(x * 10) / 10;
const pad = (b, p = 15) => [b[0] - p, b[1] - p, b[2] + p, b[3] + p];
const area = (b) => Math.max(1, (b[2] - b[0]) * (b[3] - b[1]));
// how much of the smaller of two boxes the other covers, 0 to 1 (boxes padded, so thin strokes meet)
export function cover(a, b) {
  const A = pad(a), B = pad(b);
  const w = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), h = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
  return w > 0 && h > 0 ? (w * h) / Math.min(area(A), area(B)) : 0;
}

// what is measured of each stroke, on scales where "unusual" is symmetric
const MEASURES = {
  wait: (s, i) => (i > 0 && Number.isFinite(s.gap) ? Math.log(0.5 + Math.max(0, s.gap)) : null), // the first wait is getting started
  speed: (s) => (s.length > 0 && s.ms > 0 ? Math.log(1 + s.length / Math.max(0.2, s.ms / 1000)) : null),
  pressure: (s) => (Number.isFinite(s.pressure) ? s.pressure : null),
  still: (s) => (Number.isFinite(s.still) ? Math.log(0.5 + Math.max(0, s.still)) : null),
};
const stat = () => ({ n: 0, mean: 0, m2: 0 });
function add(st, x) { st.n += 1; const d = x - st.mean; st.mean += d / st.n; st.m2 += d * (x - st.mean); }
const sd = (st) => (st.n >= 2 ? Math.sqrt(st.m2 / (st.n - 1)) : 0);

export const emptyHand = () => ({ nights: 0, strokes: 0, ...Object.fromEntries(Object.keys(MEASURES).map((k) => [k, stat()])) });

// Their hand, with tonight's strokes in it.
export function learnHand(hand, strokes = []) {
  const h = JSON.parse(JSON.stringify(hand && hand.wait ? hand : emptyHand()));
  strokes.forEach((s, i) => {
    for (const [k, f] of Object.entries(MEASURES)) { const x = f(s, i); if (x != null && Number.isFinite(x)) add(h[k], x); }
  });
  h.strokes += strokes.length;
  h.nights += strokes.length ? 1 : 0;
  return h;
}

// What they did usually, in plain units, for the words a reading uses
const typicalWait = (st) => Math.exp(st.mean) - 0.5;

// How far a stroke is from usual, in standard deviations: against their hand when it holds enough
// strokes, else against the rest of tonight (leaving the stroke out), else null.
function zOf(k, x, i, xs, hand) {
  const h = hand && hand[k];
  if (h && h.n >= 8 && sd(h) > 1e-6) return { z: (x - h.mean) / sd(h), against: 'usual' };
  const rest = xs.filter((y, j) => j !== i && y != null);
  if (rest.length < 3) return null;
  const m = rest.reduce((a, y) => a + y, 0) / rest.length;
  const s = Math.sqrt(rest.reduce((a, y) => a + (y - m) ** 2, 0) / (rest.length - 1));
  return s > 1e-6 ? { z: (x - m) / s, against: 'tonight' } : null;
}

// Each stroke against usual, measure by measure ({ wait, speed, pressure, still }, in standard
// deviations, within ±3): against their hand when it holds enough, else the rest of tonight, else 0.
export function handZ(strokes = [], hand = null) {
  const xs = Object.fromEntries(Object.entries(MEASURES).map(([k, f]) => [k, strokes.map((s, i) => { const x = f(s, i); return x != null && Number.isFinite(x) ? x : null; })]));
  return strokes.map((s, i) => Object.fromEntries(Object.keys(MEASURES).map((k) => {
    const x = xs[k][i];
    const z = x == null ? null : zOf(k, x, i, xs[k], hand);
    return [k, z ? Math.max(-3, Math.min(3, z.z)) : 0];
  })));
}

// Words that show a line noticed a gesture: used to tell whether a line carries how they painted.
export const GESTURE_CUES = {
  hesitated: /\b(wait\w*|paus\w*|hesitat\w*|a long time|long while|held back|before you (began|painted|touched|could)|took a long)\b/i,
  held: /\b(held|hold\w*|stay\w*|linger\w*|pool\w*|spread\w*|soak\w*|kept still|would not move|did not move|stood still|stopped)\b/i,
  pressed: /\b(press\w*|hard|harder|heavy|heavily|deep|deeper|dark|darker|bore down|weigh\w*|push\w*)\b/i,
  light: /\b(light|lightly|barely|faint\w*|thin|graz\w*|touch\w*|whisper of)\b/i,
  slow: /\b(slow\w*|careful\w*|took (its|your) time|unhurried|inch by inch)\b/i,
  quick: /\b(quick\w*|fast|rush\w*|flick\w*|swift\w*|sudden\w*|hurr\w*|dart\w*)\b/i,
  redrawn: /\b(again|twice|second time|wash\w*|took (it )?back|start\w* over|redid|redo|tried)\b/i,
  returned: /\b(back|return\w*|same place|over it|again|twice)\b/i,
};

// What stands out in how tonight was painted: [{ stroke, kind, detail, strength }], strongest
// first, and what stands out of the whole sitting. `against` says what it was compared with.
export function readHand(strokes = [], { washed = [], hand = null } = {}) {
  const xs = Object.fromEntries(Object.entries(MEASURES).map(([k, f]) => [k, strokes.map((s, i) => { const x = f(s, i); return x != null && Number.isFinite(x) ? x : null; })]));
  const personal = !!(hand && hand.strokes >= 10);
  const out = [];
  const note = (s, kind, strength, detail) => out.push({ stroke: s.n, kind, strength: Math.round(clamp01(strength) * 100) / 100, detail });
  const waits = strokes.map((s, i) => (i > 0 ? Number(s.gap) || 0 : 0));
  const longest = Math.max(0, ...waits);

  strokes.forEach((s, i) => {
    // the wait before it
    const wait = i > 0 ? Number(s.gap) || 0 : 0;
    if (wait >= 2) {
      const z = xs.wait[i] != null ? zOf('wait', xs.wait[i], i, xs.wait, hand) : null;
      const fewStrokes = strokes.length < 4 && wait >= 4;
      if ((z && z.z >= 1.3) || (!z && fewStrokes)) {
        const vs = z && z.against === 'usual' ? `, longer than you usually wait (about ${r1(Math.max(0, typicalWait(hand.wait)))} s)` : wait === longest ? ', the longest wait tonight' : '';
        note(s, 'hesitated', z ? (z.z - 0.8) / 2.2 : 0.5, `You waited ${r1(wait)} s before this stroke${vs}.`);
      }
    }
    // held still until the ink pooled
    const still = Number(s.still) || 0, pools = (s.pools || []).length;
    if (still >= 1 || (pools && still >= 0.5)) {
      note(s, 'held', 0.25 + still / 4 + (pools ? 0.15 : 0), `You held the brush still here for ${r1(still)} s${pools ? ', and the ink pooled and spread' : ''}.`);
    }
    // pressure
    if (Number.isFinite(s.pressure)) {
      const z = zOf('pressure', s.pressure, i, xs.pressure, hand);
      if (s.pressure >= 0.75 && ((z && z.z >= 1) || s.pressure >= 0.9)) {
        note(s, 'pressed', 0.4 + (z ? Math.min(0.4, z.z / 5) : 0.2), `You pressed hard on this stroke${z && z.against === 'usual' ? ', harder than you usually do' : ''}.`);
      } else if (s.pressure <= 0.25 && s.ink !== 'water') {
        note(s, 'light', 0.35 + (z && z.z <= -1 ? 0.2 : 0), 'You barely touched the paper with this stroke.');
      }
    }
    // pace
    if (xs.speed[i] != null && s.length >= 120) {
      const z = zOf('speed', xs.speed[i], i, xs.speed, hand);
      const usual = z && z.against === 'usual';
      if (z && z.z <= -1.3) note(s, 'slow', (-z.z - 0.8) / 2.5, `You drew this stroke slowly${usual ? ', slower than you usually paint' : ', slower than the rest tonight'}.`);
      else if (z && z.z >= 1.3) note(s, 'quick', (z.z - 0.8) / 3, `A quick stroke${usual ? ', quicker than you usually paint' : ', quicker than the rest tonight'}.`);
    }
    // painted, washed out, painted again
    const tries = washed.filter((w) => w && w.before === s.n && Array.isArray(w.box) && cover(w.box, s.box) >= 0.3).length;
    if (tries) note(s, 'redrawn', 0.9 + 0.05 * Math.min(2, tries - 1), `You painted this, washed it out, and painted it again${tries > 1 ? ` (${tries} times)` : ''}.`);
    // back over an earlier mark
    if (i > 0 && s.length >= 60) {
      const j = strokes.slice(0, i).findIndex((t) => cover(t.box, s.box) >= 0.6);
      if (j >= 0) note(s, 'returned', 0.45, `You went back over stroke ${strokes[j].n} here.`);
    }
  });

  // the whole sitting
  const overall = [];
  const away = washed.filter((w) => w && !strokes.some((s) => s.n === w.before && cover(w.box, s.box) >= 0.3)).length;
  if (washed.length >= 2) overall.push(`You washed out ${washed.length} strokes tonight${away ? `, ${away} of them for good` : ''}.`);
  const inks = strokes.map((s) => s.ink);
  const DARK = { dense: 2, light: 1, water: 0 };
  if (inks.length >= 3 && DARK[inks[0]] === 2 && inks.slice(-2).every((k) => DARK[k] < 2)) overall.push('The last strokes were in lighter ink than the first.');
  if (inks.length >= 3 && DARK[inks[0]] < 2 && inks.slice(-2).every((k) => DARK[k] === 2)) overall.push('You began in light ink and ended in dense ink.');

  // at most three readings a stroke, eight in all
  const per = new Map();
  const notable = out.sort((a, b) => b.strength - a.strength).filter((x) => { const k = per.get(x.stroke) || 0; per.set(x.stroke, k + 1); return k < 3; }).slice(0, 8);
  return { notable, overall, against: personal ? 'how you usually paint' : 'the rest of tonight' };
}
