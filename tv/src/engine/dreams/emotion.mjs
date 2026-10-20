// Copied from inkwash/engine/dreams/emotion.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// Feeling in two dimensions, as the person marks it while their painting comes back: how heavy or
// light (valence, -1 to 1, ▲ ▼) and how calm or stirred (arousal, -1 to 1, ◀ ▶). These are the
// two axes of Russell's circumplex, and the two FEELTRACE records. One axis can't tell fear from
// grief (both are heavier); two can: heavy and stirred is fear, heavy and still is grief.
//
// And why it felt that way: their answer at the turn, one of a few appraisals (it came closer, it
// was gone, I couldn't reach it...). Appraisal is what tells a feeling's meaning apart, so it is
// kept with the thing it was about.

// the nearest of these names a point: [name, valence, arousal]
export const AFFECTS = [
  ['glad', 0.8, 0.5], ['excited', 0.5, 0.85], ['warm', 0.85, 0.05], ['peaceful', 0.65, -0.6], ['still', 0.2, -0.85],
  ['numb', -0.25, -0.85], ['sad', -0.75, -0.45], ['lonely', -0.6, -0.1], ['afraid', -0.65, 0.65], ['tense', -0.3, 0.85],
  ['strange', 0.05, 0.5], ['quiet', 0, -0.4], ['even', 0, 0],
];

export function affectName(v, a = 0) {
  let best = 'even', d = Infinity;
  for (const [name, x, y] of AFFECTS) {
    const e = Math.hypot(x - v, y - a);
    if (e < d) { d = e; best = name; }
  }
  return best;
}

export const weightWord = (v) => (v >= 0.6 ? 'very light' : v >= 0.2 ? 'lighter' : v > -0.2 ? 'even' : v > -0.6 ? 'heavier' : 'very heavy');
export const stirWord = (a) => (a >= 0.6 ? 'very stirred' : a >= 0.2 ? 'stirred' : a > -0.2 ? null : a > -0.6 ? 'calm' : 'very still');

// "very heavy and stirred (afraid)": for the writer, never for the telling
export function describe(v, a = 0) {
  const parts = [weightWord(v), stirWord(a)].filter(Boolean);
  const name = affectName(v, a);
  return `${parts.join(' and ')}${name !== 'even' && !parts.includes(name) ? ` (${name})` : ''}`;
}

// Why it felt that way, as they say it with the remote.
export const WHY = [
  { id: 'closer', says: 'it came closer' },
  { id: 'gone', says: 'it was gone' },
  { id: 'unreachable', says: "I couldn't reach it" },
  { id: 'waiting', says: 'it was waiting for me' },
  { id: 'wrong', says: 'something about it was wrong' },
  { id: 'free', says: 'it let me go' },
];
export const whySays = (id) => WHY.find((w) => w.id === id)?.says || null;

const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

// How something has felt to them over the nights it came: on the whole, the last time, and which
// way it has been moving. `appearances`: [{ night, v, a, why, whyText }].
export function feltOver(appearances = []) {
  const ap = appearances.filter((x) => Number.isFinite(x.v));
  if (!ap.length) return null;
  const v = mean(ap.map((x) => x.v)), a = mean(ap.map((x) => x.a ?? 0));
  const last = ap[ap.length - 1];
  let trend = null;
  if (ap.length >= 2) {
    const before = mean(ap.slice(0, -1).map((x) => x.v));
    if (last.v - before >= 0.3) trend = 'lighter';
    else if (before - last.v >= 0.3) trend = 'heavier';
  }
  const whys = [...new Set(ap.flatMap((x) => [whySays(x.why), x.whyText]).filter(Boolean))];
  const says = [
    `${describe(v, a)}${ap.length > 1 ? `, ${times(ap.length)}` : ''}`,
    trend ? `${trend} the last time` : null,
    whys.length ? `because ${whys.join('; ')}` : null,
  ].filter(Boolean).join('; ');
  return { n: ap.length, v, a, last: { v: last.v, a: last.a ?? 0 }, trend, whys, says };
}
