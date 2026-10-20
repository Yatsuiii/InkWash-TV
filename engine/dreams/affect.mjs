// How a stroke felt, read from how it was painted and what was said: a model each person teaches
// by marking the dial.
//
// "Feel it again" asks them how each part of the dream felt, stroke by stroke, on two dimensions
// (heavier or lighter; calmer or more stirred). Every stroke they mark is a lesson: this is how I
// painted it, this is what I said as I painted it, and this is how it felt. The model learns, for
// each person, how their brush and their words carry their feelings: whether a long wait before a
// stroke means it was heavier for them, whether they press harder when stirred, whether their
// lines rise when it lifts, how far their words can be taken at their word. Then it can read a
// painting they did not mark, and say how sure it is.
//
// What it reads of a stroke (FEATURES): its brush, against their own hand (gesture.mjs): pace,
// pressure, how much the pressure shook, the wait before it, the brush held still, a wavering line,
// whether it rose or fell, how high on the sheet, how large, how dark the ink, whether it was
// painted, washed out and painted again; and the feeling in what they said on their phone as they
// painted it (personal/feelings.mjs readWords: "not afraid" is not afraid). Each stroke is read on
// its own, then evened out with the one before, as a feeling carries from one stroke to the next.
// (Reading each from the mark before it, as the dial does, learns to copy the mark before, which a
// blind reading never has: tried, and worse.)
//
// For each dimension, Bayesian linear regression with a Gaussian prior: the prior is where
// everyone starts, a guess from what lines are known to express (rising lines lighter, falling
// heavier; quick, wavering, pressed lines more stirred: Lundholm, 1921; Poffenberger & Barrows,
// 1924) and from words meaning what they say, weak enough for a few nights of their marks to
// overturn. How far their marks stray from the fit is estimated from their marks too, so a person
// whose brush says little moves the model less. Exact, small and quick: a few dozen marked
// strokes are all one person gives, too few for anything larger.
//
// Every night they mark, it first reads the painting blind, and how close it came is kept
// (`scoreReading`): whether it is learning them is measured, not assumed.
import { handZ, cover } from './gesture.mjs';
import { readWords } from '../personal/feelings.mjs';

export const BRUSH = ['pace', 'press', 'shaky', 'wait', 'held', 'wiggle', 'rise', 'high', 'size', 'dark', 'redrawn'];
export const SAID = ['said_weight', 'said_stir'];
export const FEATURES = [...BRUSH, ...SAID];
export const TERMS = ['bias', ...FEATURES];
export const DIMS = ['weight', 'stir']; // the dial: heavier -1 .. lighter 1; calm -1 .. stirred 1

// where everyone starts (sd: how far a person's own marks can move it)
export const AFFECT_PRIOR = {
  mean: {
    weight: { bias: 0, pace: 0.03, press: -0.08, shaky: -0.05, wait: -0.08, held: -0.12, wiggle: -0.06, rise: 0.15, high: 0.08, size: 0, dark: -0.06, redrawn: -0.1, said_weight: 0.5, said_stir: 0 },
    stir: { bias: 0, pace: 0.12, press: 0.1, shaky: 0.08, wait: 0.05, held: -0.03, wiggle: 0.12, rise: 0.04, high: 0, size: 0.05, dark: 0.03, redrawn: 0.08, said_weight: 0, said_stir: 0.5 },
  },
  // how far a person can move each: a whole night's level barely, from a few nights; their words most
  sd: { bias: 0.1, brush: 0.2, said: 0.3 },
  noise: 0.5, // how far one marked stroke strays from what its painting says, until their marks say
};
const sdOf = (prior, k) => (k === 'bias' ? prior.sd.bias : SAID.includes(k) ? prior.sd.said : prior.sd.brush);

const clamp = (x, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : 0));
const r2 = (x) => Math.round(x * 100) / 100;
// how dark each ink is: the dream inks between, indigo nearer black, gold nearer water
const INK = { dense: 1, light: 0, water: -1, indigo: 0.5, cinnabar: 0.2, gold: -0.5 };

// What the model reads of each stroke, in the order of FEATURES. `words`: [{ n, text }], what they
// said on their phone, with the stroke they were painting.
export function strokeFeatures(strokes = [], { washed = [], hand = null, words = [] } = {}) {
  const z = handZ(strokes, hand);
  return strokes.map((s, i) => {
    const len = Math.max(1, Number(s.length) || 0);
    const from = s.from || [0, 0], to = s.to || from;
    const box = Array.isArray(s.box) ? s.box : [0, 450, 100, 550];
    const area = Math.max(1, (box[2] - box[0]) * (box[3] - box[1]));
    const said = readWords(words.filter((w) => w && w.n === s.n).map((w) => w.text).join('. '));
    const f = {
      pace: z[i].speed,
      press: z[i].pressure,
      shaky: clamp((Number(s.pvar) || 0) / 0.15, 0, 2),
      wait: z[i].wait,
      held: ((s.pools || []).length ? 1 : 0) + clamp(z[i].still, 0, 2) / 2,
      wiggle: clamp((Number(s.wiggle) || 0) / (len / 100), 0, 2), // how often it wavered, per 100 of its length
      rise: len >= 40 ? clamp((from[1] - to[1]) / len) : 0, // the sheet's y runs down
      high: clamp(1 - (box[1] + box[3]) / 1000),
      size: clamp(Math.log(area / 20000) / 2, -1.5, 1.5),
      dark: INK[s.ink] ?? 0,
      redrawn: washed.some((w) => w && w.before === s.n && Array.isArray(w.box) && cover(w.box, box) >= 0.3) ? 1 : 0,
      said_weight: said ? clamp(said.v) : 0,
      said_stir: said ? clamp(said.a) : 0,
    };
    return FEATURES.map((k) => r2(f[k]));
  });
}

// ---------------------------------------------------------------- the model

// inverse of a small symmetric positive definite matrix (Gauss-Jordan)
function invert(A) {
  const n = A.length, M = A.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let k = 0; k < 2 * n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c || !M[r][c]) continue;
      const f = M[r][c];
      for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row) => row.slice(n));
}

// one dimension: rows [{ x: [1, ...features], y }]
function regress(rows, { mean: m0, sd }, noise) {
  const d = m0.length, s2 = noise * noise;
  const P = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? 1 / (sd[i] * sd[i]) : 0)));
  const b = m0.map((m, i) => m / (sd[i] * sd[i]));
  for (const { x, y } of rows) {
    for (let i = 0; i < d; i++) {
      if (!x[i]) continue;
      b[i] += (x[i] * y) / s2;
      for (let j = 0; j < d; j++) if (x[j]) P[i][j] += (x[i] * x[j]) / s2;
    }
  }
  const cov = invert(P);
  return { mean: cov.map((row) => row.reduce((a, c, j) => a + c * b[j], 0)), cov };
}

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const quad = (x, C) => x.reduce((s, xi, i) => s + xi * dot(C[i], x), 0);

// The model their marks so far make: rows [{ x: features, y: { weight, stir } }]. The brush is
// read against their usual hand, so a night painted slower or harder than usual says something of
// the whole night as well as of each stroke. Each dimension's noise is estimated from how far
// their marks stray from the fit, once there are enough of them (three to a term).
export function fitAffect(rows = [], prior = AFFECT_PRIOR) {
  const out = { n: rows.length };
  const p = { sd: TERMS.map((k) => sdOf(prior, k)) };
  for (const dim of DIMS) {
    p.mean = TERMS.map((k) => prior.mean[dim][k] ?? 0);
    const data = rows.map((r) => ({ x: [1, ...r.x], y: r.y[dim] }));
    let noise = prior.noise, fit = regress(data, p, noise);
    if (data.length >= 3 * TERMS.length) {
      const mse = data.reduce((a, r) => a + (r.y - dot(r.x, fit.mean)) ** 2, 0) / (data.length - TERMS.length);
      noise = clamp(Math.sqrt(mse), 0.2, 0.6);
      fit = regress(data, p, noise);
    }
    out[dim] = { ...fit, noise: r2(noise) };
  }
  return out;
}

// A painting read blind: how each stroke felt, each read on its own, then evened out with the
// stroke before (`carry`: how much carries over); and how sure, 0 to 1: how much of the doubt
// everyone starts with their marks have taken away, for strokes like these. `level`, from the one
// word they gave for the whole dream, sets where the night sits; the strokes still move about it.
export function readFeelings(model, X, { carry = 0.35, level = null, prior = AFFECT_PRIOR } = {}) {
  if (!X.length) return [];
  const sd0 = TERMS.map((k) => sdOf(prior, k));
  const raw = X.map((x) => {
    const row = [1, ...x];
    const at = Object.fromEntries(DIMS.map((dim) => [dim, dot(row, model[dim].mean)]));
    const sd = DIMS.map((dim) => Math.sqrt(Math.max(0, quad(row, model[dim].cov))));
    const sdPrior = Math.sqrt(row.reduce((a, xi, i) => a + xi * xi * sd0[i] * sd0[i], 0));
    return { ...at, sure: clamp(1 - (sd[0] + sd[1]) / 2 / sdPrior, 0, 1) };
  });
  // the one word for the night moves the whole reading to it, keeping its shape
  if (level) {
    for (const dim of DIMS) {
      if (!Number.isFinite(level[dim])) continue;
      const m = raw.reduce((a, r) => a + r[dim], 0) / raw.length;
      for (const r of raw) r[dim] += level[dim] - m;
    }
  }
  let w = null, s = null;
  return raw.map((r) => {
    w = w == null ? clamp(r.weight) : (1 - carry) * clamp(r.weight) + carry * w;
    s = s == null ? clamp(r.stir) : (1 - carry) * clamp(r.stir) + carry * s;
    return { weight: r2(w), stir: r2(s), sure: r2(r.sure) };
  });
}

// The rows a marked painting teaches.
export const lessonsOf = (X, marked, night = null) => X.map((x, k) => ({
  x, y: { weight: clamp(marked.weight[k]), stir: clamp(marked.stir[k]) }, ...(night != null ? { night } : {}),
}));

// How close a blind reading came to what they marked: the mean error on each dimension, the same
// for a reading that says nothing (a flat line), how much better than that it did (skill: 1 is
// exact, 0 no better than flat, below 0 worse), the correlation, and whether it found the stroke
// where their feeling changed most (within one).
export function scoreReading(read, marked) {
  const n = Math.min(read.length, marked.weight.length);
  const out = { strokes: n };
  for (const dim of DIMS) {
    const p = read.slice(0, n).map((r) => r[dim]), m = marked[dim].slice(0, n).map((x) => clamp(x));
    const err = p.reduce((a, x, i) => a + Math.abs(x - m[i]), 0) / Math.max(1, n);
    const flat = m.reduce((a, x) => a + Math.abs(x), 0) / Math.max(1, n);
    const mp = p.reduce((a, x) => a + x, 0) / Math.max(1, n), mm = m.reduce((a, x) => a + x, 0) / Math.max(1, n);
    const cov = p.reduce((a, x, i) => a + (x - mp) * (m[i] - mm), 0);
    const vp = p.reduce((a, x) => a + (x - mp) ** 2, 0), vm = m.reduce((a, x) => a + (x - mm) ** 2, 0);
    out[dim] = { error: r2(err), flat: r2(flat), skill: flat > 0.02 ? r2(1 - err / flat) : null, r: vp > 1e-9 && vm > 1e-9 ? r2(cov / Math.sqrt(vp * vm)) : null };
  }
  const turnAt = (w, s) => { let best = 0, at = 0; for (let k = 0; k < n; k++) { const d = Math.hypot(w[k] - (k ? w[k - 1] : 0), s[k] - (k ? s[k - 1] : 0)); if (d > best) { best = d; at = k; } } return at; };
  out.turn = Math.abs(turnAt(read.map((r) => r.weight), read.map((r) => r.stir)) - turnAt(marked.weight, marked.stir)) <= 1;
  return out;
}

// What their marks show of how their brush carries their feelings, plainly: only what the model is
// sure of (its mean two standard deviations from nothing), and only on what they have taught it.
const SAY = {
  pace: 'a quick stroke', press: 'pressing hard', shaky: 'a shaky pressure', wait: 'a long wait before a stroke', held: 'holding the brush still',
  wiggle: 'a wavering line', rise: 'a rising line', high: 'painting high on the sheet', size: 'a large mark', dark: 'dense ink', redrawn: 'painting a mark again',
};
const FEELS = { weight: ['lighter', 'heavier'], stir: ['more stirred', 'calmer'] };
export function affectNotes(model, rows = []) {
  if (!rows.length) return [];
  const out = [];
  for (const dim of DIMS) {
    BRUSH.forEach((k, j) => {
      const m = model[dim].mean[j + 1], sd = Math.sqrt(model[dim].cov[j + 1][j + 1]);
      if (Math.abs(m) < 2 * sd || Math.abs(m) < 0.08) return;
      const used = rows.filter((r) => Math.abs(r.x[j]) >= 0.5).length;
      if (used < 3) return;
      out.push({ dim, feature: k, says: `For them, ${SAY[k]} has gone with feeling ${FEELS[dim][m > 0 ? 0 : 1]}.`, sure: Math.abs(m) / sd });
    });
  }
  return out.sort((a, b) => b.sure - a.sure).slice(0, 5);
}
