// Copied from inkwash/engine/personal/feelings.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// How a dream felt: the words a person can pick, where each sits (pleasant to unpleasant, calm to
// stirred: the two axes of Russell's circumplex), and how a story with that feeling should move.
//
// The person's own word always wins. The marks (marks.mjs) only suggest one, and only nudge how
// strongly it is told. Nothing here is a judgement of the person: it is the feeling of the dream,
// which they chose.

export const FEELINGS = {
  peaceful: { v: 0.7, a: -0.6, arc: 'Let it settle: things come to rest, nothing is chased, and it ends in stillness.' },
  joyful: { v: 0.8, a: 0.6, arc: 'Let it rise: something is found, met or set free, and it ends bright and open.' },
  strange: { v: 0.0, a: 0.4, arc: 'Let it turn: something ordinary becomes uncanny, the dream accepts it, and it ends on a quiet question.' },
  longing: { v: -0.2, a: -0.1, arc: 'Let it reach: something or someone stays just out of reach, and it ends tender and unresolved.' },
  uneasy: { v: -0.5, a: 0.5, arc: 'Let it tighten, then loosen: something is not right, a way through appears, and it never ends in fright.' },
  sad: { v: -0.7, a: -0.5, arc: 'Let it let go: a loss is held gently, not fixed, and it ends with a small comfort.' },
};
export const FEELING_WORDS = Object.keys(FEELINGS);

// The feeling nearest a point, for when only the marks speak.
export function nearestFeeling({ v, a }) {
  let best = null, d = Infinity;
  for (const [k, f] of Object.entries(FEELINGS)) {
    const e = Math.hypot(f.v - v, f.a - a);
    if (e < d) { d = e; best = k; }
  }
  return best;
}

// What to aim for: the person's word if they gave one; else what the marks suggest, held loosely.
export function target(felt, marks) {
  if (felt && FEELINGS[felt]) return { feeling: felt, v: FEELINGS[felt].v, a: FEELINGS[felt].a, source: 'said', sure: 1 };
  if (marks && marks.affect) return { feeling: nearestFeeling(marks.affect), ...marks.affect, source: 'marks', sure: marks.affect.sure };
  return { feeling: null, v: 0, a: 0, source: 'none', sure: 0 };
}

// A few hundred words of feeling, placed roughly on the same two axes, to read a telling's mood.
// Rough by design: it breaks ties between candidates, it does not judge a story.
const LEX = {
  // pleasant, calm
  still: [0.4, -0.7], quiet: [0.4, -0.6], rest: [0.6, -0.6], resting: [0.6, -0.6], soft: [0.5, -0.4], softly: [0.5, -0.4], gentle: [0.6, -0.4], gently: [0.6, -0.4],
  warm: [0.7, -0.1], warmth: [0.7, -0.1], safe: [0.7, -0.4], home: [0.6, -0.2], sleep: [0.4, -0.8], asleep: [0.4, -0.8], slow: [0.2, -0.6], slowly: [0.2, -0.6],
  calm: [0.6, -0.7], settle: [0.4, -0.5], settled: [0.4, -0.5], held: [0.5, -0.3], kind: [0.7, -0.1], tender: [0.6, -0.3], peace: [0.7, -0.6],
  // pleasant, stirred
  bright: [0.7, 0.4], laugh: [0.8, 0.5], laughed: [0.8, 0.5], laughing: [0.8, 0.5], dance: [0.7, 0.6], danced: [0.7, 0.6], fly: [0.6, 0.6], flew: [0.6, 0.6],
  flying: [0.6, 0.6], open: [0.5, 0.2], opened: [0.5, 0.2], found: [0.6, 0.3], gift: [0.7, 0.3], sing: [0.7, 0.4], sang: [0.7, 0.4], gold: [0.6, 0.3],
  free: [0.7, 0.4], joy: [0.9, 0.6], glad: [0.8, 0.3], welcome: [0.7, 0.2], celebrate: [0.8, 0.6], run: [0.3, 0.6], ran: [0.3, 0.6], light: [0.5, 0.1],
  // unpleasant, stirred
  dark: [-0.4, 0.2], cold: [-0.4, 0.1], afraid: [-0.7, 0.7], fear: [-0.7, 0.7], follow: [-0.3, 0.5], following: [-0.3, 0.5], wrong: [-0.6, 0.4],
  lost: [-0.5, 0.2], shut: [-0.3, 0.2], locked: [-0.4, 0.3], sharp: [-0.4, 0.5], storm: [-0.4, 0.7], shake: [-0.4, 0.6], shook: [-0.4, 0.6],
  hurry: [-0.2, 0.7], hurried: [-0.2, 0.7], scream: [-0.8, 0.9], trapped: [-0.7, 0.6], strange: [-0.1, 0.4], stranger: [-0.2, 0.4],
  // unpleasant, calm
  alone: [-0.5, -0.3], empty: [-0.5, -0.4], gone: [-0.5, -0.3], left: [-0.3, -0.2], missing: [-0.5, -0.1], grey: [-0.3, -0.5], gray: [-0.3, -0.5],
  tired: [-0.4, -0.7], heavy: [-0.4, -0.3], mist: [-0.1, -0.4], fog: [-0.2, -0.4], far: [-0.2, -0.2], distant: [-0.2, -0.2], last: [-0.3, -0.1],
  goodbye: [-0.5, -0.2], wait: [-0.2, -0.3], waited: [-0.2, -0.3], waiting: [-0.2, -0.3], ache: [-0.6, -0.1], tears: [-0.7, 0.1], wept: [-0.7, 0.1],
  grave: [-0.6, -0.4], silence: [-0.1, -0.6], silent: [-0.1, -0.6], never: [-0.3, 0.0], remember: [0.0, -0.2], remembered: [0.0, -0.2],
};

// The mood of a text: the mean of the feeling words it uses, or null if it uses none.
export function readText(text) {
  const words = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
  let v = 0, a = 0, n = 0;
  for (const w of words) { const x = LEX[w]; if (x) { v += x[0]; a += x[1]; n++; } }
  return n ? { v: v / n, a: a / n, n } : null;
}

// The feeling in someone's own words, with "not", "no" and "never" turning a word around: "not
// afraid" is not afraid. The mean of the feeling words, or null if there are none.
const NOT = new Set(['not', 'no', 'never', 'nothing', 'nobody', 'without', 'wasnt', 'wasn', 'isnt', 'isn', 'didnt', 'didn', 'dont', 'don', 'couldnt', 'couldn', 'wont', 'cant']);
export function readWords(text) {
  const words = String(text || '').toLowerCase().replace(/[’']/g, '').match(/[a-z]+/g) || [];
  let v = 0, a = 0, n = 0;
  words.forEach((w, i) => {
    const x = LEX[w];
    if (!x) return;
    const turned = NOT.has(words[i - 1]) || NOT.has(words[i - 2]);
    v += turned ? -x[0] * 0.6 : x[0];
    a += turned ? x[1] * 0.3 : x[1];
    n++;
  });
  return n ? { v: v / n, a: a / n, n } : null;
}

// How close a text's mood is to the target, 0 (opposite corner) to 1 (the same point).
export function fit(text, aim) {
  const r = readText(text);
  if (!r || !aim || aim.source === 'none') return 0.5;
  return 1 - Math.hypot(r.v - aim.v, r.a - aim.a) / (2 * Math.SQRT2);
}
