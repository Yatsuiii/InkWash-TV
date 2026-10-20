// How someone painted, read as the mood of the marks: heavy or light, slow or quick, lingering or
// passing, sparse or crowded, low or high, sure or hesitant. From the TV's stroke summary
// (brush.js summarize()), with timing when the brush has it.
//
// This reads the painting, not the person: "slow, heavy marks, mostly low" is said back to them as
// a description of their marks, and only ever suggests a feeling for them to accept or change.
// The mapping to the two axes is a stated guess, not a model trained on anyone.

const PAPER = { W: 1600, H: 1000 };
const COLOURS = new Set(['indigo', 'gold', 'cinnabar']);
const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);

export function readMarks(strokes, session = {}) {
  const S = (strokes || []).filter((s) => s && s.length > 0);
  if (!S.length) return null;
  const total = S.reduce((a, s) => a + s.length, 0);
  const byLen = (f) => S.reduce((a, s) => a + f(s) * s.length, 0) / total;
  const pressure = byLen((s) => s.pressure || 0);
  const dense = byLen((s) => (s.ink === 'dense' ? 1 : 0)), water = byLen((s) => (s.ink === 'water' ? 1 : 0));
  // the dream inks: indigo, gold, cinnabar
  const colour = byLen((s) => (COLOURS.has(s.ink) ? 1 : 0));
  const pools = S.reduce((a, s) => a + (s.pools ? s.pools.length : 0), 0);
  const turn = byLen((s) => (s.turn || 0) / Math.max(40, s.length) * 100); // radians per 100 units
  const lowness = byLen((s) => ((s.box[1] + s.box[3]) / 2) / PAPER.H);
  // how much of the paper the marks reach: the union of their boxes, on a coarse grid
  const G = 20, cells = new Set();
  for (const s of S) {
    const [x0, y0, x1, y1] = s.box;
    for (let gx = Math.floor((x0 / PAPER.W) * G); gx <= Math.min(G - 1, Math.floor((x1 / PAPER.W) * G)); gx++)
      for (let gy = Math.floor((y0 / PAPER.H) * G); gy <= Math.min(G - 1, Math.floor((y1 / PAPER.H) * G)); gy++) cells.add(gx * G + gy);
  }
  const coverage = cells.size / (G * G);
  const timed = S.filter((s) => s.ms > 0);
  const speed = timed.length ? timed.reduce((a, s) => a + s.length, 0) / (timed.reduce((a, s) => a + s.ms, 0) / 1000) : null;
  const still = timed.length ? mean(timed.map((s) => s.still || 0)) : null;
  const gaps = S.map((s) => s.gap).filter((g) => g != null);
  const pause = gaps.length ? mean(gaps) : null;
  const washes = session.washes || 0;

  const words = [];
  if (pressure > 0.62) words.push('heavy'); else if (pressure < 0.32) words.push('light');
  if (dense > 0.75) words.push('dark'); else if (dense < 0.3 && water < 0.5 && colour < 0.3) words.push('pale'); if (water > 0.3) words.push('wet');
  if (colour >= 0.4) words.push('colourful');
  if (speed != null) { if (speed < 110) words.push('slow'); else if (speed > 230) words.push('quick'); }
  if (pools >= 3 || (still != null && still > 1.2)) words.push('lingering');
  if (turn > 1.6) words.push('restless'); else if (turn < 0.5 && S.length >= 3) words.push('straight');
  if (coverage < 0.12) words.push('sparse'); else if (coverage > 0.45) words.push('crowded');
  if (lowness > 0.62) words.push('low'); else if (lowness < 0.38) words.push('high');
  if (washes >= 3 || (pause != null && pause > 6)) words.push('hesitant');
  else if (washes === 0 && S.length >= 4 && (pause == null || pause < 2.5)) words.push('sure');

  // a stated guess at the two axes: stirred by speed, turning and crowding; calmed by slowness,
  // lingering and space; a little darker for heavy, low, dense marks, a little lighter for high,
  // pale ones. Never sure: at most 0.5.
  const has = (w) => (words.includes(w) ? 1 : 0);
  const a = clamp(0.35 * (has('quick') - has('slow')) + 0.3 * has('restless') + 0.2 * has('crowded') - 0.25 * has('lingering') - 0.15 * has('sparse'));
  const v = clamp(0.2 * (has('high') + has('pale') + has('light')) - 0.2 * (has('heavy') + has('low') + has('dark')) - 0.15 * has('hesitant'));
  const cues = words.length;
  return {
    words,
    affect: { v, a, sure: Math.min(0.5, 0.1 * cues) },
    measures: { strokes: S.length, pressure: r2(pressure), dense: r2(dense), water: r2(water), colour: r2(colour), pools, turn: r2(turn), coverage: r2(coverage), lowness: r2(lowness), speed: speed == null ? null : Math.round(speed), still: still == null ? null : r2(still), pause: pause == null ? null : r2(pause), washes },
  };
}
const clamp = (x) => Math.max(-1, Math.min(1, x));
const r2 = (x) => Math.round(x * 100) / 100;

// The marks said back, for the person and for the model: "slow, heavy marks, mostly low".
export function describeMarks(m) {
  if (!m || !m.words.length) return null;
  const where = m.words.includes('low') ? 'mostly low down' : m.words.includes('high') ? 'mostly high up' : null;
  const how = m.words.filter((w) => !['low', 'high'].includes(w));
  return `${how.length ? `${how.join(', ')} marks` : 'marks'}${where ? `, ${where}` : ''}`;
}
