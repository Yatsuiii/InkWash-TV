// Does the taste model learn a person? Simulated dreamers, each with a hidden taste: how much each
// trait of a line (taste.mjs) makes them keep it. People differ: each dreamer's taste is the
// population's, moved a little on every trait, and a lot on a couple (one loves being told what
// they felt; one can't stand their own words read back). Every night the guide offers five lines,
// each with an alternative; a chooser picks one of each pair; the dreamer answers each line they
// hear, "that's it" or "not quite", by their hidden taste, with chance in it. The choosers:
// - at random: no harness;
// - by the prior: what most people are guessed to want, the same for everyone, never learning;
// - learned: the taste learned from this dreamer's answers so far (its best estimate: drawing a
//   taste at random from what is known, Thompson sampling, did worse here, because the lines
//   themselves vary enough to keep teaching it);
// - the best possible: the dreamer's own hidden taste, which no chooser can know.
// No model is called. The lines are only their traits, drawn as a guide's lines might fall, so this
// measures the learning, not the writing.
//
//   node inkwash/engine/dreams/sim.mjs [dreamers] [nights]
//   node inkwash/engine/dreams/sim.mjs feelings [painters] [nights] [share of strokes with words]
import { TRAITS, PRIOR, fitTaste, keepChance } from './taste.mjs';

// a seeded random (mulberry32), so a run can be repeated
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (rand) => { let u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// how often each trait turns up in a guide's line: a guess
const RATES = { own_words: 0.4, their_thing: 0.35, earlier_night: 0.15, how_painted: 0.2, their_answer: 0.2, explains: 0.12, names_feeling: 0.2, stock_image: 0.2, long: 0.25, question: 0.05, senses: 0.3 };

// A dreamer's hidden taste over [bias, ...TRAITS]: the prior, moved by `spread` on every trait,
// and `strong` traits turned hard one way or the other.
export function dreamer(rand, { spread = 0.6, strong = 2, strength = 2.5 } = {}) {
  const w = ['bias', ...TRAITS].map((k) => (PRIOR.mean[k] ?? 0) + spread * normal(rand));
  for (let s = 0; s < strong; s++) {
    const i = 1 + Math.floor(rand() * TRAITS.length);
    w[i] = (rand() < 0.5 ? -1 : 1) * strength;
  }
  return w;
}
const line = (rand) => TRAITS.map((k) => (rand() < RATES[k] ? 1 : 0));
const trueKeep = (w, x) => sigmoid([1, ...x].reduce((a, xi, i) => a + xi * w[i], 0));

// One run: per night, for each chooser, the share of lines heard that were kept, and the share of
// pairs where it chose the line the dreamer was likelier to keep.
export function simulate({ dreamers = 200, nights = 10, lines = 5, seed = 7 } = {}) {
  const rand = seeded(seed);
  const choosers = ['random', 'prior', 'learned', 'best'];
  const sum = Object.fromEntries(choosers.map((c) => [c, Array.from({ length: nights }, () => ({ kept: 0, right: 0, n: 0 }))]));
  const prior = fitTaste([]);
  for (let d = 0; d < dreamers; d++) {
    const w = dreamer(rand);
    // each chooser hears this dreamer's answers to its own choices
    const rows = Object.fromEntries(choosers.map((c) => [c, []]));
    for (let night = 0; night < nights; night++) {
      const pairs = Array.from({ length: lines }, () => [line(rand), line(rand)]);
      const reacts = pairs.map(() => [rand(), rand()]); // the same chance for every chooser
      for (const c of choosers) {
        const taste = c === 'learned' ? fitTaste(rows.learned) : c === 'prior' ? prior : null;
        pairs.forEach(([a, b], k) => {
          const pick = c === 'random' ? (reacts[k][1] < 0.5 ? 0 : 1)
            : c === 'best' ? (trueKeep(w, a) >= trueKeep(w, b) ? 0 : 1)
              : (keepChance(taste, a) >= keepChance(taste, b) ? 0 : 1);
          const x = pick ? b : a, other = pick ? a : b;
          const y = reacts[k][0] < trueKeep(w, x) ? 1 : 0;
          rows[c].push({ x, y });
          const s = sum[c][night];
          s.kept += y; s.right += trueKeep(w, x) >= trueKeep(w, other) ? 1 : 0; s.n += 1;
        });
      }
    }
  }
  const r2 = (x) => Math.round(x * 1000) / 1000;
  return Object.fromEntries(choosers.map((c) => [c, sum[c].map((s) => ({ kept: r2(s.kept / s.n), right: r2(s.right / s.n) }))]));
}

// ---------------------------------------------------------------- reading feelings from the brush

// Does the brush model (affect.mjs) learn how a painter's brush carries their feelings? Simulated
// painters, each with a hidden hand: how much each feature of a stroke moves with how the stroke
// felt (most people's, moved on every feature, and for some turned around on a couple). Every
// night a dream with a turn in it: feelings that drift, then change at one stroke, painted stroke
// by stroke through their hand with noise (and, for some strokes, said on the phone in words
// that carry the feeling, loosely), and marked on the dial with a little noise. Each night
// the model reads the painting blind, is scored against the marks, then learns from them. Readers:
// - flat: says nothing (every stroke even);
// - the prior: what lines are guessed to express for everyone, never learning;
// - learned: the prior, taught by this painter's own marks so far;
// - knowing their hand: the best a linear reading can do, knowing the painter's hidden hand and
//   the noise in it (no reader can know this).
import { BRUSH, fitAffect, readFeelings, lessonsOf, scoreReading } from './affect.mjs';
const SAID_NOISE = [0.35, 0.45]; // how loosely words carry weight and stir

// how each feature moves with a stroke's feeling, for most people: [with weight, with stir]
const HAND = {
  pace: [0.1, 0.8], press: [-0.5, 0.6], shaky: [-0.2, 0.4], wait: [-0.6, 0.2], held: [-0.6, -0.1], wiggle: [-0.2, 0.6],
  rise: [0.5, 0.1], high: [0.3, 0], size: [0, 0.3], dark: [-0.4, 0.2], redrawn: [-0.8, 0.3],
};
export function painter(rand, { spread = 0.6, flips = 2, flipChance = 0.25 } = {}) {
  const h = Object.fromEntries(BRUSH.map((k) => [k, HAND[k].map((b) => b * (1 + spread * normal(rand)))]));
  if (rand() < flipChance) for (let f = 0; f < flips; f++) { const k = BRUSH[Math.floor(rand() * BRUSH.length)]; h[k] = h[k].map((b) => -b); }
  return h;
}
const clamp1 = (x) => Math.max(-1, Math.min(1, x));
function dream(rand) {
  const n = 6 + Math.floor(rand() * 7), turn = 2 + Math.floor(rand() * (n - 3));
  let w = 0.2 * normal(rand), s = 0.2 * normal(rand);
  const dw = (rand() < 0.5 ? -1 : 1) * (0.5 + 0.5 * rand()), ds = (rand() < 0.6 ? 1 : -1) * (0.3 + 0.5 * rand());
  return Array.from({ length: n }, (_, k) => {
    w = clamp1(w + 0.12 * normal(rand) + (k === turn ? dw : 0));
    s = clamp1(s + 0.12 * normal(rand) + (k === turn ? ds : 0));
    return { w, s };
  });
}
const paint = (rand, hand, f, talk) => {
  const brush = BRUSH.map((k) => {
    const x = hand[k][0] * f.w + hand[k][1] * f.s + 0.8 * normal(rand);
    if (k === 'redrawn') return rand() < 1 / (1 + Math.exp(-(-2 + 1.5 * (hand[k][0] * f.w + hand[k][1] * f.s)))) ? 1 : 0;
    if (k === 'shaky' || k === 'held' || k === 'wiggle') return Math.max(0, Math.min(2, 0.5 + x / 2));
    return Math.max(-2, Math.min(2, x));
  });
  const said = rand() < talk ? [clamp1(f.w + SAID_NOISE[0] * normal(rand)), clamp1(f.s + SAID_NOISE[1] * normal(rand))] : [0, 0];
  return [...brush, ...said];
};

// The best linear reading, knowing the hand: the posterior mean of the two feelings given a stroke's
// features (feelings about 0.45 either way; feature noise 0.8), evened out as readFeelings does.
function knowing(hand, X) {
  const B = BRUSH.map((k) => hand[k]);
  const ne = 0.8 * 0.8, nf = 0.45 * 0.45;
  const a = [[1 / nf, 0], [0, 1 / nf]];
  B.forEach(([bw, bs], j) => { if (BRUSH[j] === 'redrawn') return; a[0][0] += (bw * bw) / ne; a[0][1] += (bw * bs) / ne; a[1][0] += (bw * bs) / ne; a[1][1] += (bs * bs) / ne; });
  let w = null, s = null;
  return X.map((x) => {
    const g = [0, 0], A = a.map((row) => row.slice());
    B.forEach(([bw, bs], j) => { if (BRUSH[j] === 'redrawn') return; const v = BRUSH[j] === 'shaky' || BRUSH[j] === 'held' || BRUSH[j] === 'wiggle' ? (x[j] - 0.5) * 2 : x[j]; g[0] += (bw * v) / ne; g[1] += (bs * v) / ne; });
    // what was said, when anything was: two more looks at the feeling
    const said = x.slice(BRUSH.length);
    if (said[0] || said[1]) { g[0] += said[0] / SAID_NOISE[0] ** 2; g[1] += said[1] / SAID_NOISE[1] ** 2; A[0][0] += 1 / SAID_NOISE[0] ** 2; A[1][1] += 1 / SAID_NOISE[1] ** 2; }
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const inv = [[A[1][1] / det, -A[0][1] / det], [-A[1][0] / det, A[0][0] / det]];
    const fw = clamp1(inv[0][0] * g[0] + inv[0][1] * g[1]), fs = clamp1(inv[1][0] * g[0] + inv[1][1] * g[1]);
    w = w == null ? fw : 0.65 * fw + 0.35 * w;
    s = s == null ? fs : 0.65 * fs + 0.35 * s;
    return { weight: w, stir: s };
  });
}

// per night, for each reader: the mean error on each dimension, skill against flat, and how often
// it found the stroke where their feeling changed most
export function simulateFeelings({ painters = 200, nights = 8, seed = 5, talk = 0 } = {}) {
  const rand = seeded(seed);
  const readers = ['flat', 'prior', 'learned', 'best'];
  const sum = Object.fromEntries(readers.map((r) => [r, Array.from({ length: nights }, () => ({ weight: 0, stir: 0, flatW: 0, flatS: 0, turn: 0, n: 0 }))]));
  const prior = fitAffect([]);
  for (let p = 0; p < painters; p++) {
    const hand = painter(rand);
    let rows = [];
    for (let night = 0; night < nights; night++) {
      const felt = dream(rand);
      const X = felt.map((f) => paint(rand, hand, f, talk));
      const marked = { weight: felt.map((f) => clamp1(f.w + 0.1 * normal(rand))), stir: felt.map((f) => clamp1(f.s + 0.1 * normal(rand))) };
      for (const r of readers) {
        const read = r === 'flat' ? X.map(() => ({ weight: 0, stir: 0 })) : r === 'best' ? knowing(hand, X) : readFeelings(r === 'prior' ? prior : fitAffect(rows), X);
        const sc = scoreReading(read, marked), s = sum[r][night];
        s.weight += sc.weight.error; s.stir += sc.stir.error; s.flatW += sc.weight.flat; s.flatS += sc.stir.flat; s.turn += sc.turn ? 1 : 0; s.n += 1;
      }
      rows = rows.concat(lessonsOf(X, marked, night));
    }
  }
  const r2 = (x) => Math.round(x * 1000) / 1000;
  return Object.fromEntries(readers.map((r) => [r, sum[r].map((s) => ({ weightError: r2(s.weight / s.n), stirError: r2(s.stir / s.n), weightSkill: r2(1 - s.weight / s.flatW), stirSkill: r2(1 - s.stir / s.flatS), turnFound: r2(s.turn / s.n) }))]));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === 'feelings') {
    const painters = Number(process.argv[3]) || 300, nights = Number(process.argv[4]) || 8, talk = Number(process.argv[5]) || 0;
    const r = simulateFeelings({ painters, nights, talk });
    const f = (x) => x.toFixed(2).padStart(6);
    console.log(`${painters} simulated painters, ${nights} nights, a dream with a turn each night, read blind before it is marked; ${Math.round(talk * 100)}% of strokes with words said\n`);
    console.log('error, heavier-lighter (1 is the whole range)   night ' + Array.from({ length: nights }, (_, i) => String(i + 1).padStart(6)).join(''));
    for (const c of ['flat', 'prior', 'learned', 'best']) console.log(`  ${c.padEnd(46)}${r[c].map((x) => f(x.weightError)).join('')}`);
    console.log('error, calm-stirred');
    for (const c of ['flat', 'prior', 'learned', 'best']) console.log(`  ${c.padEnd(46)}${r[c].map((x) => f(x.stirError)).join('')}`);
    console.log('found the stroke where it turned (within one)');
    for (const c of ['flat', 'prior', 'learned', 'best']) console.log(`  ${c.padEnd(46)}${r[c].map((x) => f(x.turnFound)).join('')}`);
    process.exit(0);
  }
  const dreamers = Number(process.argv[2]) || 400, nights = Number(process.argv[3]) || 10;
  const r = simulate({ dreamers, nights });
  const pct = (x) => `${Math.round(x * 100)}%`.padStart(5);
  console.log(`${dreamers} simulated dreamers, ${nights} nights, 5 lines a night, each with an alternative\n`);
  console.log('lines kept     night ' + Array.from({ length: nights }, (_, i) => String(i + 1).padStart(5)).join(''));
  for (const c of ['random', 'prior', 'learned', 'best']) console.log(`  ${c.padEnd(19)}${r[c].map((x) => pct(x.kept)).join('')}`);
  console.log('\nchose the line they would rather keep');
  for (const c of ['random', 'prior', 'learned', 'best']) console.log(`  ${c.padEnd(19)}${r[c].map((x) => pct(x.right)).join('')}`);
}
