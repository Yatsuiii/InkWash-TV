// Copied from inkwash/engine/personal/select.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// Choosing among candidate tellings: the one most tied to this person.
// - grounded: each line is about a part of the painting that has marks in it;
// - coverage: the marks are told, not just a few of them;
// - fit: the telling's mood is near how the dream felt (or, failing that, near the marks' mood);
// - new to the crowd: its images aren't the ones everyone's tellings use (commons.mjs);
// - new to them: it doesn't retell their own recent dreams (history.mjs).
import { fit } from './feelings.mjs';
import { tellingMotifs } from './motifs.mjs';

export const SELECT = { grounded: 0.3, coverage: 0.15, fit: 0.2, crowd: 0.2, self: 0.15 };

const area = (b) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const meet = (a, b) => area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);

export function scoreTelling(t, { strokes = [], aim = null, commons = null, history = null, weights = SELECT } = {}) {
  const lines = (t && t.lines) || [];
  const boxes = lines.map((l) => l.box).filter(Boolean);
  const S = strokes.filter((s) => s.box && s.length > 0);
  const grounded = lines.length ? lines.filter((l) => l.box && S.some((s) => meet(l.box, s.box) >= 0.2 * Math.max(1, Math.min(area(l.box), area(s.box))))).length / lines.length : 0;
  const total = S.reduce((a, s) => a + s.length, 0);
  const coverage = total ? S.filter((s) => boxes.some((b) => meet(b, s.box) > 0)).reduce((a, s) => a + s.length, 0) / total : 0;
  const ms = tellingMotifs(t || {});
  const parts = {
    grounded, coverage,
    fit: fit([t?.title, ...lines.map((l) => l.text)].join(' '), aim),
    crowd: commons ? commons.novelty(ms) : 0.5,
    self: history ? 1 - history.repeats(ms) : 1,
  };
  const ok = lines.length >= 3 && lines.length <= 6;
  const score = Object.entries(weights).reduce((a, [k, w]) => a + w * parts[k], 0) - (ok ? 0 : 0.5);
  return { score, parts, motifs: [...ms] };
}

// The best candidate, and every candidate's score (for the record).
export function choose(candidates, ctx) {
  const scored = candidates.filter(Boolean).map((c) => ({ ...c, ...scoreTelling(c.telling, ctx) }));
  scored.sort((a, b) => b.score - a.score);
  return { best: scored[0] || null, all: scored };
}
