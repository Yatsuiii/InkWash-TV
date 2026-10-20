// Forgetting: a thing taken out of their world, with everything that grew from it, and nothing else.
//
// The chain of custody for a world's memory (after Custody, github.com/Yatsuiii/custody): every line
// of a story knows the things it was about, every fact the line it came from and the thing it is
// about, and every thing the chapters and marks it came in. So a thing can be followed to what grew
// from it, and taken back exactly:
// - the thing itself, how it looked, and every chapter it came in;
// - its facts and threads, and any fact that names it;
// - every line of a story that was about it or names it, and any fact that came from such a line;
// - a chapter title that names it; their own words and answers that named it (they would only bring
//   it back); the Worldbuilder's questions about it; notes that name it; what the storyteller looked
//   up or was reminded of for a chapter, where it names it;
// - its marks in each chapter's drawing, unless another thing kept is drawn with the same mark.
// Everything else stays exactly as it was. Lines are left as empty places, not taken out, so what
// the other things in that chapter point at doesn't move.
//
// What is kept of a forgetting is that it happened, when, and how much went: never the name or any
// of the words, which would keep what they asked to be rid of. Forgetting a thing already forgotten
// takes nothing more and gives back the same record. Pure: `planForget` reads a world's state,
// `applyForget` changes it, `scrubNight` cleans a chapter kept apart, outside the world.

const bareName = (s) => String(s ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().replace(/^(the|a|an|my) /, '');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What a thing is said by, to find it in words: its name and the names it is called by, three
// letters or more ("me" is found by what it was, never by the word)
export function keysOf(e) {
  return [...new Set([e.name, ...(e.aliases || [])].map(bareName).filter((k) => k.length >= 3))];
}
const namer = (keys) => {
  const res = keys.map((k) => new RegExp(`(^|[^a-z])${escape(k)}([^a-z]|$)`, 'i'));
  return (text) => res.some((re) => re.test(String(text || '')));
};

// What forgetting `id` would take, from the world's state `S` (as `toJSON` gives it). Null if there
// is no such thing.
export function planForget(S, id) {
  const e = (S.entities || []).find((x) => x.id === id);
  if (!e) return null;
  const keys = keysOf(e), names = namer(keys);
  // its marks, chapter by chapter, but not a mark another thing kept is drawn with too
  const mine = new Map(), others = new Map();
  for (const x of S.entities || []) {
    const into = x.id === id ? mine : others;
    for (const ap of [...(x.appearances || []), ...(x.endings || [])]) {
      if (!into.has(ap.night)) into.set(ap.night, new Set());
      for (const n of ap.strokes || []) into.get(ap.night).add(n);
    }
  }
  const marks = {};
  for (const [night, ns] of mine) {
    const kept = [...ns].filter((n) => !(others.get(night) || new Set()).has(n)).sort((a, b) => a - b);
    if (kept.length) marks[night] = kept;
  }
  // the chapters it came in: their drawings and any picture made of them are its too
  const plan = { id, keys, marks, chapters: [...mine.keys()].sort((a, b) => a - b) };
  // the chapters it holds, as they would be after
  const nights = (S.nights || []).map((N) => ({ n: N.n, ...linesGone(N, plan, names) }));
  // a fact goes with the line it came from: its own chapter's, or its ending's
  const goneLine = new Set(nights.flatMap((g) => [...g.lines.map((i) => `${g.n}:${i}`), ...g.endLines.map((i) => `${g.n}:e${i}`)]));
  const fromLine = (f) => f.line != null && goneLine.has(`${f.from}:${f.ending ? 'e' : ''}${f.line}`);
  const facts = (S.facts || []).filter((f) => f.entity === id || names(f.text) || fromLine(f)).map((f) => f.id);
  const wonders = (S.wonders || []).map((w, i) => (w.about === id || names(w.question) || names(w.chose) ? i : -1)).filter((i) => i >= 0);
  const notes = (S.notes || []).map((t, i) => (names(t) ? i : -1)).filter((i) => i >= 0);
  // where their world stands, if its words name it: those words, and the place painted from them
  const sc = S.scene || null, place = !!sc && (names(sc.place) || names(sc.look) || (sc.looks || []).some((l) => names(l)));
  const count = (k) => nights.reduce((a, g) => a + g[k].length, 0), lines = count('lines') + count('endLines');
  return {
    ...plan, name: e.name, facts, wonders, notes, place, nights: nights.filter((g) => g.lines.length || g.endLines.length || g.title || g.said.length || g.asked.length || marks[g.n]),
    counts: {
      chapters: Object.keys(marks).length || (e.appearances || []).length,
      facts: facts.length, lines, titles: nights.filter((g) => g.title).length,
      words: count('said') + count('asked'), marks: Object.values(marks).reduce((a, ns) => a + ns.length, 0),
    },
    // and what stays
    stays: {
      things: (S.entities || []).filter((x) => x.id !== id && x.status !== 'rejected').length,
      facts: (S.facts || []).length - facts.length,
      lines: (S.nights || []).reduce((a, N) => a + linesOf(N).filter((l) => !l.forgotten).length, 0) - lines,
    },
  };
}

const linesOf = (N) => [...(N.lines || []), ...((N.ending && N.ending.lines) || [])];

// what of one chapter goes: its lines and its ending's (by where each is in its own list), its
// title, their words and answers
function linesGone(N, plan, names = namer(plan.keys)) {
  const about = (l) => !l.forgotten && (((l.entities || []).includes(plan.id)) || names(l.text));
  const which = (ls) => (ls || []).map((l, i) => (about(l) ? i : -1)).filter((i) => i >= 0);
  return {
    lines: which(N.lines), endLines: which(N.ending && N.ending.lines),
    title: names(N.title) || !!(N.ending && names(N.ending.title)),
    said: [...(N.said || []), ...((N.ending && N.ending.said) || [])].filter((t) => names(t)),
    asked: [...(N.asked || []), ...((N.ending && N.ending.asked) || [])].filter((a) => names(a.answer) || names(a.question)),
  };
}

// A chapter as it is after forgetting: in the world, or kept apart by the TV. Returns a new chapter.
export function scrubNight(N, plan) {
  const names = namer(plan.keys), out = JSON.parse(JSON.stringify(N));
  const empty = (l) => ({ text: '', strokes: [], v: null, a: null, reaction: l.reaction ?? null, entities: [], forgotten: true, ...(l.ending ? { ending: true } : {}) });
  const clean = (l) => (!l.forgotten && ((l.entities || []).includes(plan.id) || names(l.text)) ? empty(l) : { ...l, entities: (l.entities || []).filter((x) => x !== plan.id) });
  out.lines = (out.lines || []).map(clean);
  if (names(out.title)) out.title = `Chapter ${out.n}`;
  out.said = (out.said || []).filter((t) => !names(t));
  out.asked = (out.asked || []).filter((a) => !names(a.answer) && !names(a.question));
  out.cast = (out.cast || []).filter((x) => x !== plan.id);
  if (out.pinned && (names(out.pinned.said) || names(out.pinned.why))) out.pinned = { n: out.pinned.n, said: null, why: null };
  if (out.ending) {
    out.ending.lines = (out.ending.lines || []).map(clean);
    if (names(out.ending.title)) out.ending.title = `Chapter ${out.n}, and what happened next`;
    out.ending.said = (out.ending.said || []).filter((t) => !names(t));
    out.ending.asked = (out.ending.asked || []).filter((a) => !names(a.answer) && !names(a.question));
  }
  // what the storyteller remembered for the chapter, less what named it
  const unname = (m) => ({ ...m, recaps: (m.recaps || []).map((r) => ({ ...r, because: (r.because || []).filter((t) => !names(t)) })), looked_up: (m.looked_up || []).filter((t) => !names(t)), read: (m.read || []).filter((t) => !names(t)) });
  if (out.remembered) out.remembered = unname(out.remembered);
  if (out.ending && out.ending.remembered) out.ending.remembered = unname(out.ending.remembered);
  // what is told of it from now on: the lines kept that are left
  out.text = [...out.lines, ...((out.ending && out.ending.lines) || [])].filter((l) => !l.forgotten && l.reaction !== 'no' && l.text).map((l) => l.text).join(' ');
  const marks = plan.marks[out.n];
  if (marks && marks.length) out.forgot = [...new Set([...(out.forgot || []), ...marks])].sort((a, b) => a - b);
  return out;
}

// Forget it: the world's state changed in place, and the record of it. `at`: when.
export function applyForget(S, plan, { at = Date.now() } = {}) {
  const record = {
    id: `forget-${plan.id}`, at,
    removed: { things: 1, facts: plan.facts.length, lines: plan.counts.lines, titles: plan.counts.titles, words: plan.counts.words, marks: plan.counts.marks },
  };
  const gone = new Set(plan.facts);
  // where each chapter's lines went (its own, and its ending's): the other things keep pointing at
  // the same places, less those
  S.nights = (S.nights || []).map((N) => scrubNight(N, plan));
  const at_ = (ls) => new Set((ls || []).map((l, i) => (l.forgotten ? i : -1)).filter((i) => i >= 0));
  const own = new Map(S.nights.map((N) => [N.n, at_(N.lines)])), ends = new Map(S.nights.map((N) => [N.n, at_(N.ending && N.ending.lines)]));
  const names = namer(plan.keys);
  // and anything another thing kept says of it, in its why or its note
  const less = (ap, where) => {
    const out = { ...ap, lines: (ap.lines || []).filter((i) => !(where.get(ap.night) || new Set()).has(i)) };
    if (names(out.whyText)) delete out.whyText;
    if (names(out.note)) delete out.note;
    return out;
  };
  S.entities = (S.entities || []).filter((x) => x.id !== plan.id).map((x) => ({
    ...x,
    appearances: (x.appearances || []).map((ap) => less(ap, own)),
    ...(x.endings ? { endings: x.endings.map((ap) => less(ap, ends)) } : {}),
  }));
  S.facts = (S.facts || []).filter((f) => !gone.has(f.id));
  S.wonders = (S.wonders || []).filter((_, i) => !plan.wonders.includes(i));
  if (S.notes) S.notes = S.notes.filter((_, i) => !plan.notes.includes(i));
  if (S.readings && S.readings.rejected) S.readings.rejected = S.readings.rejected.filter((r) => !names(r.text));
  if (plan.place && S.scene) {
    S.scene = { ...S.scene, place: names(S.scene.place) ? '' : S.scene.place, look: names(S.scene.look) ? '' : S.scene.look, looks: (S.scene.looks || []).filter((l) => !names(l)) };
  }
  S.forgotten = [...(S.forgotten || []), record];
  return record;
}
