// "Feel it again": after painting, the strokes come back one at a time, in the order they were
// painted, and the person holds ▲ where the dream felt lighter and ▼ where it felt heavier, ▶
// where it felt more stirred and ◀ where it felt calmer. The remote becomes a dial in two
// dimensions, the way emotion research measures feeling as it happens (the affect rating dial;
// FEELTRACE), and what comes back is their feeling at every stroke: the feeling line. Two
// dimensions tell fear (heavy, stirred) from grief (heavy, still).
//
// Pure: the replay's timing, the dial, and the feeling per stroke. main.js draws it, and
// engine/personal/arc.mjs reads it.

// When each stroke comes back: in painting order, each for about as long as it took, the whole
// replay squeezed or stretched to about `total` seconds, after a short lead-in. A painting of many
// strokes gets shorter moments, so it never drags (40 strokes come back in under 20 seconds).
export function replayPlan(strokes, { total = 14, min = 0.6, max = 2.6, gap = 0.12, lead = 1.4, tail = 0.6 } = {}) {
  const n = Math.max(1, strokes.length);
  min = Math.min(min, Math.max(0.3, total / n));
  gap = Math.min(gap, 2.4 / n);
  const ms = strokes.map((s) => Math.max(200, s.ms || 1000));
  const sum = ms.reduce((a, x) => a + x, 0) / 1000;
  const k = sum ? (total - gap * Math.max(0, strokes.length - 1)) / sum : 1;
  let t = lead;
  const at = strokes.map((s, i) => {
    const d = Math.max(min, Math.min(max, (ms[i] / 1000) * k));
    const span = { n: s.n, i, t0: t, t1: t + d };
    t += d + gap;
    return span;
  });
  return { at, lead, end: (at.length ? at[at.length - 1].t1 : lead) + tail };
}

// which stroke is coming back at time t (or the last one that did), and how far along it
export function replayAt(plan, t) {
  let cur = null;
  for (const a of plan.at) { if (t >= a.t0) cur = a; else break; }
  if (!cur) return { i: -1, f: 0 };
  return { i: cur.i, f: Math.max(0, Math.min(1, (t - cur.t0) / (cur.t1 - cur.t0))) };
}

const clamp = (x) => Math.max(-1, Math.min(1, x));

// The dial: holding ▲ raises it (lighter), ▼ lowers it (heavier); ▶ stirs it, ◀ calms it; each at
// `rate` a second. Let go, and it stays.
export function createDial({ rate = 1.1 } = {}) {
  return {
    v: 0,
    a: 0,
    moved: false,
    step(dt, dir = 0, side = 0) {
      if (dir) { this.moved = true; this.v = clamp(this.v + dir * rate * dt); }
      if (side) { this.moved = true; this.a = clamp(this.a + side * rate * dt); }
      return this.v;
    },
  };
}

// The samples taken during the replay, and what they come to.
export function createFeeling(plan) {
  const samples = []; // [t, v, a]
  const r2 = (x) => Math.round(x * 100) / 100;
  // the mean while each stroke came back (and the pause after it), over time, not over frames:
  // the dial between two samples is taken as moving straight from one to the next, so a held
  // button counts for as long as it was held however few frames saw it (a slow TV, a stall). A
  // stroke that no two samples span takes the nearest sample. k: 1 for lighter-heavier, 2 for
  // calm-stirred
  const perStroke = (k) => plan.at.map((a, i) => {
    const until = plan.at[i + 1] ? plan.at[i + 1].t0 : plan.end;
    let area = 0, span = 0;
    for (let j = 1; j < samples.length; j++) {
      const [ta, ...va] = samples[j - 1], [tb, ...vb] = samples[j];
      const lo = Math.max(ta, a.t0), hi = Math.min(tb, until);
      if (hi <= lo || tb <= ta) continue;
      const at = (t) => va[k - 1] + ((vb[k - 1] - va[k - 1]) * (t - ta)) / (tb - ta);
      area += ((at(lo) + at(hi)) / 2) * (hi - lo);
      span += hi - lo;
    }
    if (span > 0) return r2(area / span) || 0;
    let best = null, d = Infinity;
    for (const x of samples) if (Math.abs(x[0] - a.t0) < d) { d = Math.abs(x[0] - a.t0); best = x[k]; }
    return best ?? 0;
  });
  return {
    samples,
    add(t, v, a = 0) { if (t >= plan.lead) samples.push([t, Math.round(v * 1000) / 1000, Math.round(a * 1000) / 1000]); },
    byStroke: () => perStroke(1),
    arousal: () => perStroke(2),
    // the line itself, evenly spaced, at most `n` points (to draw it small, and to send); k as above
    line(n = 120, k = 1) {
      if (!samples.length) return [];
      const t0 = plan.lead, t1 = Math.max(t0 + 0.001, samples[samples.length - 1][0]);
      const out = [];
      let j = 0;
      for (let i = 0; i < n; i++) {
        const t = t0 + ((t1 - t0) * i) / (n - 1);
        while (j < samples.length - 1 && samples[j + 1][0] <= t) j++;
        out.push(r2(samples[j][k]));
      }
      return out;
    },
  };
}
