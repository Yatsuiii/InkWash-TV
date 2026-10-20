// Copied from inkwash/engine/dreams/world.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// A person's dream world: what their dreams have held, night after night. It is kept on their TV,
// and only the slice a night needs ever leaves it.
//
// It runs on the engine:
// - nights are chapters;
// - the people, places, things, creatures and presences in their dreams are entities, with the
//   names they were called by;
// - what happened is canon facts with story time: true from the night it happened, until the
//   night it stopped being true. A fact that leaves something unresolved is a thread, open until
//   a later night closes it;
// - each telling is a passage, with the facts it relied on.
// So the engine's own machinery picks what matters for tonight (`slice`): who is in play, the
// facts about them and between them, what is still true, what tonight's words share.
//
// Around that, what only this person can say:
// - how each thing felt to them, every time it came: their own marks, in two dimensions (heavier
//   or lighter, calm or stirred), and why (their answer at the turn);
// - whether they took the telling's reading of it: "that's it" or "not quite" (`react`). A thing
//   they turned down isn't kept, and its reading isn't offered again;
// - what they said, in their own words, which counts more than anything the model proposed.
// The world is recognised in a new painting (`recognize`): from their words, by name, and from
// their marks, a mark shaped and placed like one a thing came as before.
//
// And it learns them: every line they answer teaches their taste (taste.mjs), every night's
// strokes add to the picture of how they paint (gesture.mjs), which tonight is read against, and
// every stroke they mark on the dial teaches how their brush and words carry their feelings
// (affect.mjs), so a painting they don't mark can still be read.
//
// A night can also keep what they painted next (`newEnding`): after the dream is told, they may
// paint more of it, or a different ending, and the night keeps both. When they come back on a later
// day, the TV offers the last night's story again, the way a series opens with what happened last
// time (`recap`), and keeps each time it is heard (`recapped`).
//
// A world holds its last KEEP nights; what came in older ones stays (the things, how each felt,
// what happened), and the nights themselves are kept apart by the TV, with every other night, and
// read there by the guide's tools (tools.mjs). Where room is short, the TV lets more of them go from
// the world once they are kept apart (`trimNights`).
import { createEngine } from '../index.mjs';
import { tokenize, STOP } from '../text.mjs';
import { shapeKind } from '../personal/arc.mjs';
import { feltOver, describe } from './emotion.mjs';
import { preferences } from './learn.mjs';
import { readHand, learnHand, emptyHand } from './gesture.mjs';
import { traitsOf, fitTaste, tasteNotes } from './taste.mjs';
import { strokeFeatures, fitAffect, readFeelings, lessonsOf, scoreReading, affectNotes } from './affect.mjs';
import { FEELINGS } from '../personal/feelings.mjs';
import { checkScene } from './scene.mjs';
import { planForget, applyForget } from './forget.mjs';

export const KINDS = ['person', 'place', 'thing', 'creature', 'presence'];
// how many of its latest nights a world holds
export const KEEP = 120;
const ENGINE_KIND = { person: 'character', creature: 'character', presence: 'character', place: 'place', thing: 'thing' };
const clamp = (x) => Math.max(-1, Math.min(1, Number(x) || 0));
const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null);
const clean = (s, n) => String(s ?? '').replace(/[<>{}[\]"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const center = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
// how far two marks' shapes can be the same thing: a wave and a long line differ only in how far
// the brush swung, which a hand never repeats exactly
const kindFit = (a, b) => (a === b ? 1 : (a === 'wave' && b === 'long') || (a === 'long' && b === 'wave') ? 0.85 : 0);
const area = (b) => Math.max(1, (b[2] - b[0]) * (b[3] - b[1]));

// the word a thing goes by, short: "the stopped clock" is also "clock"
function headNoun(name) {
  const words = tokenize(name).map((t) => t.w).filter((w) => !STOP.has(w.toLowerCase()) && w.length >= 3);
  return words.length > 1 ? words[words.length - 1] : null;
}
const variants = (a) => [a, a.charAt(0).toUpperCase() + a.slice(1)];
// a name as it is matched: in lower case, without the, a, an or my
const bare = (s) => String(s ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().replace(/^(the|a|an|my) /, '');

// What the storyteller was given of earlier chapters for a night, and what it looked up, kept with
// the night so they can see it (the TV's book: "what it remembered"): the chapters it was told word
// for word, the recaps it was given and why, what it searched for, the things and chapters it read.
const ints = (xs, n) => (Array.isArray(xs) ? xs.map(Number).filter(Number.isInteger).slice(0, n) : []);
const texts = (xs, n, k) => (Array.isArray(xs) ? [...new Set(xs.map((x) => clean(x, k)).filter(Boolean))].slice(0, n) : []);
function keptMemory(m) {
  return {
    recent: ints(m.recent, 4),
    recaps: (Array.isArray(m.recaps) ? m.recaps : []).slice(0, 6).map((r) => ({ chapters: clean(r && r.chapters, 40), because: texts(r && r.because, 4, 60) })).filter((r) => r.chapters),
    looked_up: texts(m.looked_up, 6, 80), read: texts(m.read, 8, 60), nights: ints(m.nights, 8),
    tokens: Number.isFinite(m.tokens) ? Math.round(m.tokens) : null,
  };
}

// A world as it was kept, read back whatever became of it: each part in the shape the world keeps
// it in, what can't be read let go (a night with no number, a line or a thing that isn't one, a
// fact about a thing that isn't there), and the counters past every id there is. A world kept by an
// older TV, or cut short as it was written, still opens, with everything of it that can be read; a
// world kept whole is read back exactly as it was.
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const objs = (x) => (Array.isArray(x) ? x.filter(isObj) : []);
const nums = (x) => (Array.isArray(x) ? x.filter(Number.isFinite) : []);
const strs = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string') : []);
// a list kept as it is if it is already all it should be, so a whole world round-trips unchanged
const keepIf = (x, ok) => (Array.isArray(x) && x.every(ok) ? x : null);
function readLines(ls) {
  return objs(ls).map((l) => {
    const fine = typeof l.text === 'string' && Array.isArray(l.strokes) && l.strokes.every(Number.isFinite) && (l.entities === undefined || keepIf(l.entities, (v) => typeof v === 'string'));
    return fine ? l : { ...l, text: typeof l.text === 'string' ? l.text : '', strokes: nums(l.strokes), ...(l.entities !== undefined ? { entities: strs(l.entities) } : {}) };
  });
}
// What the TV hands the world, held to the shape it is read in: a word, a stroke, an answer or a
// wash that isn't one is let go; a line that isn't one stays in its place, empty, so the lines
// after it keep their numbers.
const asLines = (ls) => (Array.isArray(ls) ? ls : []).map((l) => (isObj(l) ? { ...l, text: typeof l.text === 'string' ? l.text : '', strokes: nums(l.strokes) } : { text: '', strokes: [] }));
const asWords = (ws) => objs(ws).filter((w) => typeof w.text === 'string');
const asStrokes = (ss) => objs(ss).filter((x) => Number.isFinite(x.n) && Array.isArray(x.box) && x.box.length === 4 && x.box.every(Number.isFinite));
const asList = (xs) => (Array.isArray(xs) ? xs : []);

export function readSaved(saved) {
  const s = isObj(saved) ? JSON.parse(JSON.stringify(saved)) : {};
  const out = { ...s };
  const seen = new Set();
  out.nights = objs(s.nights).filter((n) => Number.isInteger(n.n) && n.n >= 1 && !seen.has(n.n) && seen.add(n.n)).sort((a, b) => a.n - b.n).map((n) => {
    const N = { ...n, lines: readLines(n.lines) };
    for (const k of ['cast']) if (n[k] !== undefined) N[k] = keepIf(n[k], (v) => typeof v === 'string') || strs(n[k]);
    for (const k of ['said', 'asked', 'heard', 'line']) if (n[k] !== undefined && !Array.isArray(n[k])) delete N[k];
    if (n.ending !== undefined) {
      if (!isObj(n.ending)) delete N.ending;
      else N.ending = { ...n.ending, lines: readLines(n.ending.lines), strokes: keepIf(n.ending.strokes, Number.isFinite) || nums(n.ending.strokes) };
    }
    if (n.remembered !== undefined && !isObj(n.remembered)) delete N.remembered;
    return N;
  });
  const ids = new Set();
  out.entities = objs(s.entities).filter((e) => typeof e.id === 'string' && e.id && typeof e.name === 'string' && e.name.trim() && !ids.has(e.id) && ids.add(e.id)).map((e) => {
    const E = { ...e };
    for (const k of ['appearances', 'endings']) if (e[k] !== undefined) E[k] = keepIf(e[k], isObj) || objs(e[k]);
    if (e.aliases !== undefined) E.aliases = keepIf(e.aliases, (v) => typeof v === 'string') || strs(e.aliases);
    return E;
  });
  const fids = new Set();
  out.facts = objs(s.facts).filter((f) => typeof f.id === 'string' && ids.has(f.entity) && typeof f.text === 'string' && !fids.has(f.id) && fids.add(f.id));
  out.readings = isObj(s.readings) ? { ...s.readings, rejected: keepIf(s.readings.rejected, isObj) || objs(s.readings.rejected) } : { rejected: [] };
  // past every id there is, so a new thing or fact never takes one already used
  const most = (xs, re) => Math.max(0, ...xs.map((x) => Number((re.exec(x.id) || [])[1]) || 0));
  const seq = isObj(s.seq) ? s.seq : {};
  out.seq = { ...seq, e: Math.max(Number.isInteger(seq.e) ? seq.e : 0, most(out.entities, /^e(\d+)$/)), f: Math.max(Number.isInteger(seq.f) ? seq.f : 0, most(out.facts, /^f(\d+)$/)) };
  out.hand = isObj(s.hand) && isObj(s.hand.wait) ? s.hand : emptyHand();
  const row = (r) => isObj(r) && Array.isArray(r.x);
  out.taste = isObj(s.taste) ? { ...s.taste, rows: keepIf(s.taste.rows, row) || objs(s.taste.rows).filter(row) } : { rows: [] };
  out.affect = isObj(s.affect) ? { ...s.affect, rows: keepIf(s.affect.rows, row) || objs(s.affect.rows).filter(row), scores: keepIf(s.affect.scores, isObj) || objs(s.affect.scores) } : { rows: [], scores: [] };
  if (s.notes !== undefined) { if (Array.isArray(s.notes)) out.notes = keepIf(s.notes, (v) => typeof v === 'string') || strs(s.notes); else delete out.notes; }
  for (const k of ['wonders', 'forgotten']) if (s[k] !== undefined) { if (Array.isArray(s[k])) out[k] = keepIf(s[k], isObj) || objs(s[k]); else delete out[k]; }
  if (s.scene !== undefined && !isObj(s.scene)) delete out.scene;
  return out;
}

export function createDreamWorld(saved = null) {
  const S = {
    nights: [], entities: [], facts: [], readings: { rejected: [] }, seq: { e: 0, f: 0 },
    hand: emptyHand(), taste: { rows: [] }, affect: { rows: [], scores: [] },
    ...(saved ? readSaved(saved) : {}),
  };
  let engine = null; // built when asked, dropped on any change
  const ent = (id) => S.entities.find((e) => e.id === id);
  const live = () => S.entities.filter((e) => e.status !== 'rejected');
  // a thing of their world, by what the guide calls it: its id, or the name it is kept by
  const thingFor = (ref) => {
    if (typeof ref !== 'string' || !ref.trim()) return null;
    if (ent(ref)) return ref;
    const k = bare(ref);
    return (k && live().find((e) => bare(e.name) === k)?.id) || null;
  };

  function engineData() {
    const ok = new Set(live().map((e) => e.id));
    return {
      chapters: S.nights.map((n) => ({ ordinal: n.n })),
      entities: live().map((e) => ({ id: e.id, name: e.name, kind: ENGINE_KIND[e.kind] || 'thing', aliases: e.aliases || [] })),
      facts: S.facts.filter((f) => ok.has(f.entity)).map((f) => ({ id: f.id, entity: f.entity, text: f.text, from: f.from, ...(f.to != null ? { to: f.to } : {}) })),
      passages: S.nights.filter((n) => n.text).map((n) => ({ id: `night${n.n}`, chapter: n.n, text: n.text, cast: (n.cast || []).filter((id) => ok.has(id)), premises: [] })),
    };
  }
  const E = () => (engine ||= createEngine(engineData()));
  const tonight = () => (S.nights.length ? S.nights[S.nights.length - 1].n + 1 : 1);
  // the things of their dreams that are theirs: named by them, or kept when they heard them
  const theirThings = () => live().filter((e) => e.status === 'confirmed').map((e) => ({ id: e.id, name: e.name, aliases: e.aliases || [], first: e.first }));

  // How alike a mark is to the marks a thing came as before: the same shape, near the same place,
  // near the same size. 0 to 1.
  function markLike(stroke, e) {
    const kind = shapeKind(stroke);
    let best = 0;
    // as it came in their dreams, or in an ending they painted
    for (const ap of [...(e.appearances || []), ...(e.endings || [])]) {
      const fit = ap.mark ? kindFit(ap.mark.kind, kind) : 0;
      if (!fit) continue;
      const [x0, y0] = center(stroke.box), [x1, y1] = center(ap.mark.box);
      const near = Math.max(0, 1 - Math.hypot(x0 - x1, y0 - y1) / 600);
      const size = Math.min(area(stroke.box), area(ap.mark.box)) / Math.max(area(stroke.box), area(ap.mark.box));
      best = Math.max(best, fit * near * (0.6 + 0.4 * size));
    }
    return best;
  }

  const api = {
    get nights() { return S.nights; },
    get entities() { return S.entities; },
    get facts() { return S.facts; },
    tonight,
    thingFor,

    // What of their world is in tonight's painting: things named in their words (by name or what
    // they were called), and things whose marks look like tonight's. Best first.
    // `by` is the stronger evidence; `said` whether their words named it; `n` the mark most like it.
    recognize({ words = [], strokes = [] } = {}) {
      words = asList(words).filter((w) => typeof w === 'string');
      strokes = asStrokes(strokes);
      const out = new Map(), markScore = new Map();
      const add = (id, score, by, n = null) => {
        const e = ent(id);
        if (!e || e.status === 'rejected') return;
        const have = out.get(id) || { id, name: e.name, kind: e.kind, by, n: null, said: false, score: 0 };
        if (by === 'words') have.said = true;
        if (by === 'mark' && score > (markScore.get(id) || 0)) { have.n = n; markScore.set(id, score); }
        if (score > have.score) { have.by = by; have.score = Math.round(score * 100) / 100; }
        out.set(id, have);
      };
      if (words.length && live().length) {
        for (const [id, x] of E().resolve(words.join(' ')).ents) add(id, 1 + x.w, 'words');
      }
      for (const s of strokes) {
        if (!s || !s.box) continue;
        for (const e of live()) {
          const like = markLike(s, e);
          if (like >= 0.55) add(e.id, like * (1 + 0.3 * Math.log2(1 + (e.appearances || []).length)), 'mark', s.n);
        }
      }
      return [...out.values()].sort((a, b) => b.score - a.score);
    },

    // What a telling tonight is held to (ground.mjs) and learned from (taste.mjs): their words and
    // answers, the things of their dreams that are theirs, how they painted, read against how they
    // usually paint, and what they turned down. The same at telling and at keeping, so what is
    // learned is what was chosen on.
    //   asked: [{ question, answer }] tonight; turn: the stroke where their feeling turned
    context({ words = [], asked = [], strokes = [], washed = [], turn = null } = {}) {
      words = asWords(words); asked = objs(asked); strokes = asStrokes(strokes); washed = objs(washed);
      const hand = readHand(strokes, { washed, hand: S.hand });
      const q = asked.filter((a) => a && a.answer).map((a) => ({ question: String(a.question || ''), answer: String(a.answer) }));
      return {
        night: tonight(),
        words: words.filter((w) => w && w.text).map((w) => ({ n: w.n ?? null, text: String(w.text) })),
        answers: q.map((a) => a.answer),
        asked: q,
        things: theirThings(),
        notable: hand.notable,
        inks: Object.fromEntries(strokes.filter((s) => s && s.n != null && s.ink).map((s) => [s.n, s.ink])),
        hand,
        turn,
        turnedDown: [...S.readings.rejected.map((r) => r.text), ...S.entities.filter((e) => e.status === 'rejected').map((e) => e.name)].filter(Boolean).slice(-24),
        strokeCount: strokes.length,
      };
    },
    // How each stroke of tonight's painting probably felt, read from how it was painted and what
    // was said, by the model their marks on earlier nights have taught; for when they don't mark it.
    // `felt`, their one word for the whole dream, if they gave one, sets the night's level.
    readFeelings({ strokes = [], washed = [], words = [], felt = null } = {}) {
      strokes = asStrokes(strokes); washed = objs(washed); words = asWords(words);
      const X = strokeFeatures(strokes, { washed, hand: S.hand, words });
      const level = felt && FEELINGS[felt] ? { weight: FEELINGS[felt].v, stir: FEELINGS[felt].a } : null;
      const read = readFeelings(fitAffect(S.affect.rows), X, { level });
      return { strokes: strokes.map((s, i) => ({ n: s.n, ...read[i] })), learned_from: S.affect.rows.length, level: level ? 'their word' : 'their brush', last: S.affect.scores.at(-1) || null };
    },
    // what their marks have shown of how their brush carries feeling, and how well it has read them
    feelingModel() {
      const sc = S.affect.rows.length ? S.affect.scores : [];
      const rows = S.affect.rows, n = rows.length;
      // how far they usually move the dial: a quiet hand's small mark can be a strong one for them
      const usual = n >= 10 ? { weight: Math.round((rows.reduce((a, r) => a + Math.abs(r.y.weight), 0) / n) * 100) / 100, stir: Math.round((rows.reduce((a, r) => a + Math.abs(r.y.stir), 0) / n) * 100) / 100 } : null;
      return { learned_from: n, nights_read: sc.length, first: sc[0] || null, last: sc.at(-1) || null, usual, notes: affectNotes(fitAffect(rows), rows).map((x) => x.says) };
    },
    // their taste, as their answers so far show it; and those answers
    taste: () => fitTaste(S.taste.rows),
    tasteRows: () => S.taste.rows.slice(),
    hand: () => JSON.parse(JSON.stringify(S.hand)),

    // What a mark could be from their own world, for the question at the turn: at most two.
    known(stroke) {
      return live().map((e) => ({ id: e.id, name: e.name, kind: e.kind, score: markLike(stroke, e) * (1 + 0.3 * Math.log2(1 + (e.appearances || []).length)) }))
        .filter((x) => x.score >= 0.45).sort((a, b) => b.score - a.score).slice(0, 2);
    },

    // What tonight's telling needs from their world, compiled by the engine for a draft of tonight:
    // the facts about what's in play and between them, as they stand now; how each thing has felt
    // to them; the threads still open; their last few nights; what their reactions have taught.
    slice({ night = tonight(), cast = [], words = [], budget = 700 } = {}) {
      const castIds = cast.filter((id) => ent(id) && ent(id).status !== 'rejected');
      const ws = S.facts.length ? E().workingSet({ type: 'draft', chapter: night, cast: castIds, notes: words.join(' ') }, { budget }) : { facts: [], lines: [], manifest: { entities: [] } };
      const inPlay = new Set([...castIds, ...(ws.manifest.entities || []).filter((x) => x.w >= 0.5).map((x) => x.id)]);
      const things = [...inPlay].map(ent).filter(Boolean).map((e) => {
        const felt = feltOver(e.appearances);
        return { id: e.id, name: e.name, kind: e.kind, nights: (e.appearances || []).length, first: e.first, own: e.status === 'confirmed', felt: felt ? felt.says : null };
      });
      const open = S.facts.filter((f) => f.thread && f.to == null && f.from < night && ent(f.entity)?.status !== 'rejected')
        .sort((a, b) => Number(inPlay.has(b.entity)) - Number(inPlay.has(a.entity)) || b.from - a.from).slice(0, 4)
        .map((f) => ({ id: f.id, text: `${ent(f.entity).name}: ${f.text} (since night ${f.from})` }));
      const openIds = new Set(open.map((t) => t.id));
      return {
        night,
        things,
        // the engine's lines, in nights rather than chapters; the open threads are listed apart
        facts: (ws.facts || []).map((id, i) => [id, ws.lines[i]]).filter(([id]) => !openIds.has(id)).map(([, l]) => l.replace(/chapter (\d+)/g, 'night $1')),
        threads: open,
        recent: S.nights.slice(-3).map((n) => ({ night: n.n, title: n.title, shape: n.shape })),
        // how the last night was told, so tonight's telling finds words of its own
        lastTold: S.nights.length ? { night: S.nights[S.nights.length - 1].n, lines: S.nights[S.nights.length - 1].lines.filter((l) => l.reaction !== 'no' && !l.forgotten).map((l) => l.text) } : null,
        learned: preferences(S).notes,
        avoid: S.readings.rejected.slice(-12).map((r) => r.text),
        manifest: { entities: ws.manifest.entities || [], cut: ws.manifest.cut || null },
      };
    },

    // Take in a night: what the telling and their words added (`diff`, proposed by the guide
    // service and checked here), weighed by their reactions to each line, felt as they marked it.
    //   telling: { title, lines: [{ text, strokes, v, a }] }, shape
    //   feeling: { byStroke: [v], arousal: [a] } as they marked it
    //   pinned:  { n, said, why, entity } their answer at the turn (`entity` when they chose
    //            something from their world)
    //   words:   [{ n, text }] what they said, by phone
    //   answers: [{ question, answer }] what they answered when the guide asked (their words too)
    //   reactions: ['yes' | 'no' | null] for each line
    // A thing in the diff may name its own strokes (the marks it is), and say why it felt as it did
    // and what to remember of it, in the guide's words; the diff may carry notes on how they like
    // their dreams told, which replace the last.
    commit({ telling, shape = null, felt = null, feeling = null, pinned = null, words = [], answers = [], strokes = [], washed = [], diff = {}, reactions = [], remembered = null }) {
      words = asWords(words); answers = objs(answers); strokes = asStrokes(strokes); washed = objs(washed); reactions = asList(reactions);
      const night = tonight();
      const lines = asLines(telling && telling.lines);
      const said = (i) => reactions[i] ?? null;
      // what each answered line teaches of their taste, with the world as it was when it was told
      const tctx = api.context({ words, strokes, washed, asked: [...answers, ...(pinned && pinned.said ? [{ question: 'What was it?', answer: pinned.said }] : [])] });
      const lessons = lines.map((l, i) => (said(i) === 'yes' || said(i) === 'no' ? { x: traitsOf(l.text, l.strokes || [], tctx).x, y: said(i) === 'yes' ? 1 : 0, night } : null)).filter(Boolean);
      // what their marks teach of how their brush carries feeling: read blind first, and scored
      const marked = feeling && Array.isArray(feeling.byStroke) && feeling.byStroke.length === strokes.length && strokes.length
        && [...feeling.byStroke, ...(feeling.arousal || [])].some((x) => Math.abs(Number(x) || 0) > 0.05)
        ? { weight: feeling.byStroke.map((x) => clamp(x)), stir: strokes.map((_, i) => clamp((feeling.arousal || [])[i])) } : null;
      let feelLessons = [], feelScore = null;
      if (marked) {
        const X = strokeFeatures(strokes, { washed, hand: S.hand, words });
        feelScore = { night, learned_from: S.affect.rows.length, ...scoreReading(readFeelings(fitAffect(S.affect.rows), X), marked) };
        feelLessons = lessonsOf(X, marked, night);
      }
      const allNo = (ls) => ls.length > 0 && ls.every((i) => said(i) === 'no');
      const anyYes = (ls) => ls.some((i) => said(i) === 'yes');
      const strokesOf = (ls) => [...new Set(ls.flatMap((i) => (lines[i] && lines[i].strokes) || []))];
      const byN = new Map(strokes.map((s, i) => [s.n, i]));
      const feltAt = (ns) => {
        const idx = ns.map((n) => byN.get(n)).filter((i) => i != null);
        const v = feeling && feeling.byStroke ? mean(idx.map((i) => clamp(feeling.byStroke[i]))) : null;
        const a = feeling && feeling.arousal ? mean(idx.map((i) => clamp(feeling.arousal[i]))) : null;
        return { v: v ?? null, a: a ?? 0 };
      };
      const markOf = (ns) => { const s = strokes.find((x) => ns.includes(x.n)); return s ? { kind: shapeKind(s), box: s.box.slice(0, 4) } : null; };
      const D = checkDiff(diff, { lines: lines.length, ids: new Set(S.entities.map((e) => e.id)), open: new Set(S.facts.filter((f) => f.thread && f.to == null).map((f) => f.id)), strokes: new Set(strokes.map((s) => s.n)), thingFor });
      const kept = [], turnedDown = [];
      const names = new Map(); // a new thing's name -> its id

      // what they named at the turn is theirs, whatever the model made of it
      const isPinned = (x) => !!pinned && ((pinned.entity && x.id === pinned.entity)
        || (pinned.said && ((x.new && x.new.toLowerCase() === pinned.said.toLowerCase()) || (x.id && ent(x.id)?.name.toLowerCase() === pinned.said.toLowerCase()))));
      if (pinned && (pinned.said || pinned.entity) && !D.entities.some(isPinned)) {
        const known = (pinned.entity && ent(pinned.entity)) || live().find((e) => pinned.said && e.name.toLowerCase() === pinned.said.toLowerCase());
        const at = lines.findIndex((l) => (l.strokes || []).includes(pinned.n));
        if (known) D.entities.push({ id: known.id, lines: at >= 0 ? [at] : [] });
        else if (pinned.said) D.entities.push({ new: clean(pinned.said, 40), kind: 'thing', aliases: [], lines: at >= 0 ? [at] : [] });
      }
      const said_ = [...words.map((w) => String(w.text || '')), ...answers.map((x) => String((x && x.answer) || ''))].map((w) => w.toLowerCase()).filter(Boolean);
      const inWords = (name, aliases = []) => [name.toLowerCase().replace(/^(the|a|an|my) /, ''), ...aliases.map((a) => a.toLowerCase())].some((k) => k.length >= 3 && said_.some((w) => w.includes(k)));
      for (const x of D.entities) {
        // its marks: as the guide named them, or those of the lines it is in; and its lines, as
        // given, or those that name it, or else those that tell its marks
        const ns = x.strokes && x.strokes.length ? x.strokes : strokesOf(x.lines);
        const keys = (x.new ? [x.new, ...(x.aliases || []), headNoun(x.new)] : [ent(x.id).name, ...(ent(x.id).aliases || [])])
          .filter(Boolean).map((k) => k.toLowerCase().replace(/^(the|a|an|my) /, '')).filter((k) => k.length >= 3);
        const naming = lines.map((l, i) => (keys.some((k) => String(l.text || '').toLowerCase().includes(k)) ? i : -1)).filter((i) => i >= 0);
        const ls = x.lines.length ? x.lines : naming.length ? naming : lines.map((l, i) => ((l.strokes || []).some((n) => ns.includes(n)) ? i : -1)).filter((i) => i >= 0);
        x.lines = ls;
        const theirs = isPinned(x);
        const fromWords = x.new ? inWords(x.new, x.aliases) : inWords(ent(x.id).name, ent(x.id).aliases);
        const pinnedHere = pinned && (ns.includes(pinned.n) || theirs);
        const at = pinnedHere && pinned.n != null && !(x.strokes && x.strokes.length) ? [pinned.n] : ns;
        const appearance = {
          night, mark: markOf(at), strokes: at, ...feltAt(at), why: pinnedHere ? pinned.why || null : null,
          ...(x.why ? { whyText: x.why } : {}), ...(x.note ? { note: x.note } : {}), source: theirs || fromWords ? 'said' : 'told', lines: ls,
        };
        if (x.id) {
          const e = ent(x.id);
          if (allNo(ls) && !theirs && e.status === 'proposed') { e.status = 'rejected'; turnedDown.push(e.name); continue; }
          if (allNo(ls) && !theirs) { turnedDown.push(e.name); continue; }
          e.appearances.push(appearance);
          if (anyYes(ls) || theirs || fromWords) e.status = 'confirmed';
          kept.push(`${e.name} (${e.appearances.length === 2 ? 'a second chapter' : e.appearances.length === 3 ? 'a third chapter' : `${e.appearances.length} chapters`})`);
          names.set(e.name.toLowerCase(), e.id);
        } else {
          if (allNo(ls) && !theirs) {
            const m = markOf(ns);
            S.readings.rejected.push({ kind: m ? m.kind : null, text: x.new });
            turnedDown.push(x.new);
            continue;
          }
          const head = headNoun(x.new);
          const e = {
            id: `e${++S.seq.e}`, name: x.new, kind: x.kind, first: night,
            aliases: [...new Set([...(x.aliases || []), ...(head ? [head] : [])].flatMap(variants))].slice(0, 8),
            status: anyYes(ls) || theirs || fromWords ? 'confirmed' : 'proposed',
            appearances: [appearance],
          };
          S.entities.push(e);
          names.set(x.new.toLowerCase(), e.id);
          kept.push(`${e.name} (new)`);
        }
      }
      // facts: kept unless the line they came from was turned down
      for (const f of D.facts) {
        if (said(f.line) === 'no') continue;
        const id = ent(f.about) ? f.about : names.get(f.about.toLowerCase()) || live().find((e) => e.name.toLowerCase() === f.about.toLowerCase())?.id;
        if (!id || ent(id).status === 'rejected') continue;
        S.facts.push({ id: `f${++S.seq.f}`, entity: id, text: f.text, from: night, ...(Number.isInteger(f.line) ? { line: f.line } : {}), ...(f.open ? { thread: true } : {}), source: said(f.line) === 'yes' ? 'confirmed' : 'told' });
      }
      for (const r of D.resolved) {
        if (said(r.line) === 'no') continue;
        const f = S.facts.find((x) => x.id === r.fact);
        if (f && f.to == null) { f.to = night; kept.push(`${ent(f.entity)?.name}: ${f.text.replace(/\.$/, '')} — until now`); }
      }
      if (D.notes) S.notes = D.notes;
      // the night itself
      const cast = [...new Set(D.entities.map((x) => x.id || names.get((x.new || '').toLowerCase())).filter((id) => id && ent(id) && ent(id).status !== 'rejected'))];
      const entitiesOf = (i) => D.entities.filter((x) => x.lines.includes(i)).map((x) => x.id || names.get((x.new || '').toLowerCase())).filter(Boolean);
      S.nights.push({
        n: night, at: Date.now(), title: clean(telling && telling.title, 60), shape, felt,
        line: downsample(feeling, 24),
        said: words.map((w) => clean(w.text, 200)).filter(Boolean).slice(0, 20),
        pinned: pinned ? { n: pinned.n, said: pinned.said ? clean(pinned.said, 60) : null, why: pinned.why || null } : null,
        asked: answers.filter((x) => x && x.question).slice(0, 4).map((x) => ({ question: clean(x.question, 120), answer: x.answer ? clean(x.answer, 120) : null })),
        lines: lines.map((l, i) => ({ text: clean(l.text, 300), strokes: l.strokes || [], v: l.v ?? null, a: l.a ?? null, reaction: said(i), entities: entitiesOf(i) })),
        text: lines.filter((_, i) => said(i) !== 'no').map((l) => clean(l.text, 300)).join(' '),
        cast,
        ...(remembered ? { remembered: keptMemory(remembered) } : {}),
      });
      if (S.nights.length > KEEP) S.nights.splice(0, S.nights.length - KEEP);
      S.taste.rows.push(...lessons);
      if (S.taste.rows.length > 400) S.taste.rows.splice(0, S.taste.rows.length - 400);
      if (feelScore) {
        S.affect.rows.push(...feelLessons);
        if (S.affect.rows.length > 800) S.affect.rows.splice(0, S.affect.rows.length - 800);
        S.affect.scores.push(feelScore);
        if (S.affect.scores.length > 60) S.affect.scores.splice(0, S.affect.scores.length - 60);
      }
      S.hand = learnHand(S.hand, strokes);
      engine = null;
      return { night, kept, turnedDown, learned: lessons.length, ...(feelScore ? { read: feelScore } : {}) };
    },

    // What happens next, for a night already kept. After the dream was told, they painted more of
    // it, or a different ending: theirs to choose. The night keeps both, the dream as it came and
    // what they painted next (its `ending`). What that brings (a thing, a fact, a thread it closes)
    // is kept as of that night, weighed by their reactions to the lines that tell it, felt as they
    // marked it. A thing in it is kept apart from how things have come in their dreams, and its
    // marks are recognised in later paintings.
    //   night:    which night (the last kept, if left out)
    //   telling:  { title, lines: [{ text, strokes, v, a }] }, the dream told again with what came next
    //   strokes:  what they painted next, numbered on from the night's
    //   feeling:  { byStroke: [v], arousal: [a] } over those strokes, as they marked them
    //   words, answers, diff, reactions: as for commit
    newEnding({ night = null, telling, strokes = [], feeling = null, words = [], answers = [], diff = {}, reactions = [], remembered = null } = {}) {
      words = asWords(words); answers = objs(answers); strokes = asStrokes(strokes); reactions = asList(reactions);
      const N = night == null ? S.nights[S.nights.length - 1] : S.nights.find((x) => x.n === Number(night));
      if (!N || !strokes.length) return null;
      const n = N.n;
      const lines = asLines(telling && telling.lines);
      const said = (i) => reactions[i] ?? null;
      const mine = new Set(strokes.map((s) => s.n));
      // the lines that tell what they painted next: those about its strokes
      const endingLines = lines.map((l, i) => ((l.strokes || []).some((k) => mine.has(k)) ? i : -1)).filter((i) => i >= 0);
      const tctx = api.context({ words, strokes, asked: answers });
      const lessons = lines.map((l, i) => (said(i) === 'yes' || said(i) === 'no' ? { x: traitsOf(l.text, l.strokes || [], tctx).x, y: said(i) === 'yes' ? 1 : 0, night: n } : null)).filter(Boolean);
      const byN = new Map(strokes.map((s, i) => [s.n, i]));
      const feltAt = (ns) => {
        const idx = ns.map((k) => byN.get(k)).filter((i) => i != null);
        const v = feeling && feeling.byStroke ? mean(idx.map((i) => clamp(feeling.byStroke[i]))) : null;
        const a = feeling && feeling.arousal ? mean(idx.map((i) => clamp(feeling.arousal[i]))) : null;
        return { v: v ?? null, a: a ?? 0 };
      };
      const markOf = (ns) => { const s = strokes.find((x) => ns.includes(x.n)); return s && s.box ? { kind: shapeKind(s), box: s.box.slice(0, 4) } : null; };
      const D = checkDiff(diff, { lines: lines.length, ids: new Set(S.entities.map((e) => e.id)), open: new Set(S.facts.filter((f) => f.thread && f.to == null).map((f) => f.id)), strokes: mine, thingFor });
      const said_ = [...words.map((w) => String(w.text || '')), ...answers.map((x) => String((x && x.answer) || ''))].map((w) => w.toLowerCase()).filter(Boolean);
      const inWords = (name, aliases = []) => [name.toLowerCase().replace(/^(the|a|an|my) /, ''), ...aliases.map((a) => a.toLowerCase())].some((k) => k.length >= 3 && said_.some((w) => w.includes(k)));
      const kept = [], turnedDown = [], closed = [];
      const names = new Map();
      for (const x of D.entities) {
        const ns = x.strokes && x.strokes.length ? x.strokes : [...new Set(x.lines.flatMap((i) => (lines[i].strokes || []).filter((k) => mine.has(k))))];
        const ls = x.lines.length ? x.lines : endingLines.filter((i) => (lines[i].strokes || []).some((k) => ns.includes(k)));
        x.lines = ls;
        const allNo = ls.length > 0 && ls.every((i) => said(i) === 'no'), anyYes = ls.some((i) => said(i) === 'yes');
        const ending = { night: n, mark: markOf(ns), strokes: ns, ...feltAt(ns), ...(x.why ? { whyText: x.why } : {}), ...(x.note ? { note: x.note } : {}), lines: ls };
        if (x.id) {
          const e = ent(x.id);
          if (allNo) { turnedDown.push(e.name); continue; }
          (e.endings ||= []).push(ending);
          if (e.status === 'proposed' && (anyYes || inWords(e.name, e.aliases))) e.status = 'confirmed';
          kept.push(e.name);
          names.set(e.name.toLowerCase(), e.id);
        } else {
          if (allNo) { S.readings.rejected.push({ kind: ending.mark ? ending.mark.kind : null, text: x.new }); turnedDown.push(x.new); continue; }
          const head = headNoun(x.new);
          const e = {
            id: `e${++S.seq.e}`, name: x.new, kind: x.kind, first: n,
            aliases: [...new Set([...(x.aliases || []), ...(head ? [head] : [])].flatMap(variants))].slice(0, 8),
            status: anyYes || inWords(x.new, x.aliases) ? 'confirmed' : 'proposed',
            appearances: [], endings: [ending],
          };
          S.entities.push(e);
          names.set(x.new.toLowerCase(), e.id);
          kept.push(`${e.name} (new)`);
        }
      }
      for (const f of D.facts) {
        if (said(f.line) === 'no') continue;
        const id = ent(f.about) ? f.about : names.get(f.about.toLowerCase()) || live().find((e) => e.name.toLowerCase() === f.about.toLowerCase())?.id;
        if (!id || ent(id).status === 'rejected') continue;
        S.facts.push({ id: `f${++S.seq.f}`, entity: id, text: f.text, from: n, ending: true, ...(Number.isInteger(f.line) ? { line: f.line } : {}), ...(f.open ? { thread: true } : {}), source: said(f.line) === 'yes' ? 'confirmed' : 'told' });
      }
      // what it settles: a thread still open closes as of that night
      for (const r of D.resolved) {
        if (said(r.line) === 'no') continue;
        const f = S.facts.find((x) => x.id === r.fact);
        if (f && f.to == null) { f.to = n; f.closedBy = 'ending'; closed.push(`${ent(f.entity)?.name}: ${f.text.replace(/\.$/, '')}`); }
      }
      const entitiesOf = (i) => D.entities.filter((x) => x.lines.includes(i)).map((x) => x.id || names.get((x.new || '').toLowerCase())).filter(Boolean);
      const vs = strokes.map((_, i) => (feeling && feeling.byStroke ? clamp(feeling.byStroke[i]) : null)).filter((v) => v != null);
      const as = strokes.map((_, i) => (feeling && feeling.arousal ? clamp(feeling.arousal[i]) : null)).filter((a) => a != null);
      N.ending = {
        at: Date.now(), title: clean(telling && telling.title, 60), strokes: [...mine],
        felt: vs.length ? { v: Math.round(mean(vs) * 100) / 100, a: Math.round((mean(as) ?? 0) * 100) / 100 } : null,
        line: downsample(feeling, 12),
        said: words.map((w) => clean(w.text, 200)).filter(Boolean).slice(0, 10),
        asked: answers.filter((x) => x && x.question).slice(0, 4).map((x) => ({ question: clean(x.question, 120), answer: x.answer ? clean(x.answer, 120) : null })),
        lines: lines.map((l, i) => ({ text: clean(l.text, 300), strokes: l.strokes || [], v: l.v ?? null, a: l.a ?? null, reaction: said(i), entities: entitiesOf(i), ending: endingLines.includes(i) })),
        ...(remembered ? { remembered: keptMemory(remembered) } : {}),
      };
      // the night's passage carries the ending too, so it is found by its words
      N.text = [N.text, ...lines.filter((_, i) => endingLines.includes(i) && said(i) !== 'no').map((l) => clean(l.text, 300))].filter(Boolean).join(' ');
      N.cast = [...new Set([...(N.cast || []), ...[...names.values()].filter((id) => ent(id) && ent(id).status !== 'rejected')])];
      S.taste.rows.push(...lessons);
      if (S.taste.rows.length > 400) S.taste.rows.splice(0, S.taste.rows.length - 400);
      engine = null;
      return { night: n, next: true, kept, turnedDown, closed, learned: lessons.length };
    },

    // Previously in their world. When they come back on a later day, the TV offers the last night's
    // story again (`recap`), the way a series opens with what happened last time: as it was last
    // told, with what they painted next if they did, from what the night kept, without a model.
    // Each time it is heard is kept with the night (`recapped`), and so is a "not tonight", so it
    // isn't asked again that evening.
    //   recap: the latest night, unless it was painted, heard or put off in the last `rest` hours;
    //   else null. { night, title, lines: [{ text, strokes, next }] (as last told, without the
    //   lines they turned down; `next`: about what they painted next), next: its strokes, heard }
    recap({ now = Date.now(), rest = 12 } = {}) {
      const N = S.nights[S.nights.length - 1];
      if (!N) return null;
      const E = N.ending && (N.ending.lines || []).length ? N.ending : null;
      const last = Math.max(N.at || 0, E ? E.at || 0 : 0, N.passed || 0, ...(N.heard || []).map((r) => r.at || 0));
      if (now - last < rest * 3600000) return null;
      const lines = (E ? E.lines : N.lines || []).filter((l) => l.reaction !== 'no' && !l.forgotten).map((l) => ({ text: l.text, strokes: l.strokes || [], next: !!l.ending }));
      if (!lines.length) return null;
      return { night: N.n, title: (E && E.title) || N.title, lines, next: E ? E.strokes || [] : [], heard: (N.heard || []).length };
    },
    // `heard`: how many of its `of` lines they heard before it ended or they went back to the paper;
    // none is a "not tonight"
    recapped({ night, at = Date.now(), heard = 0, of = 0 } = {}) {
      const N = S.nights.find((x) => x.n === Number(night));
      if (!N) return null;
      if (heard > 0) (N.heard ||= []).push({ at, heard: Math.round(heard), of: Math.round(of) || Math.round(heard) });
      else N.passed = at;
      return { night: N.n, heard: (N.heard || []).length };
    },

    // A question about their world, asked by its Worldbuilder (wonder.mjs), and what they chose: kept
    // as true of that thing from tonight on, theirs (`source: 'chosen'`). Without a choice, only
    // that it was asked, so it isn't asked again. The fact kept, or null.
    wondered({ about, question, chose = null, at = Date.now() }) {
      const e = ent(about);
      if (!e || e.status === 'rejected') return null;
      const text = String(chose || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      S.wonders = [...(S.wonders || []), { at, about: e.id, question: String(question || '').replace(/\s+/g, ' ').trim().slice(0, 140), ...(text ? { chose: text } : {}) }].slice(-40);
      if (!text) return null;
      const f = { id: `f${++S.seq.f}`, entity: e.id, text, from: tonight(), source: 'chosen' };
      S.facts.push(f);
      engine = null;
      return f;
    },

    // How things in their world look, as their Illustrator first painted them (illustrate.mjs):
    // kept the first time and given back every night after, so a thing looks the same night after
    // night. `looks`: [{ id, look }], or [{ name, look }] for a thing kept tonight by that name or
    // one it is called by (the one there on `night`, if several are). A thing that has a look keeps
    // it. The looks kept.
    looked(looks = [], { night = null } = {}) {
      const kept = [];
      const bare = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/^(the|a|an|my) /, '');
      const named = (name) => {
        const k = bare(name);
        const hits = live().filter((e) => [e.name, ...(e.aliases || [])].some((a) => bare(a) === k));
        return hits.find((e) => (e.appearances || []).some((a) => a.night === night)) || hits[0] || null;
      };
      for (const l of Array.isArray(looks) ? looks : []) {
        const text = clean(l && l.look, 140);
        if (text.split(' ').length < 2) continue;
        const e = (l.id && ent(l.id)) || (l.name ? named(l.name) : null);
        if (!e || e.status === 'rejected' || e.look) continue;
        e.look = text;
        kept.push({ id: e.id, name: e.name, look: text });
      }
      return kept;
    },

    // How a thing looks, in their own words ("the fox has a white tip on its tail"): theirs, so it
    // holds over any look the Illustrator kept, in every picture of it from now on; empty words let
    // it go. Returns { id, name, rule } (rule null once let go), or null for no such thing.
    ruled(id, words) {
      const e = ent(id);
      if (!e || e.status === 'rejected') return null;
      const text = clean(words, 160).replace(/[.\s]+$/, '');
      if (text) e.rule = text;
      else delete e.rule;
      engine = null;
      return { id: e.id, name: e.name, rule: e.rule || null };
    },

    // For the TV's "your dream world" card: how many nights, what keeps coming back and how it has
    // felt, what is still unresolved.
    summary() {
      const recurring = live().filter((e) => (e.appearances || []).length >= 2)
        .sort((a, b) => b.appearances.length - a.appearances.length).slice(0, 4)
        .map((e) => { const f = feltOver(e.appearances); return { name: e.name, nights: e.appearances.length, felt: f ? describe(f.v, f.a) : null, trend: f ? f.trend : null }; });
      const open = S.facts.filter((f) => f.thread && f.to == null && ent(f.entity)?.status !== 'rejected').slice(-3).map((f) => `${ent(f.entity).name}: ${f.text}`);
      const last = S.nights[S.nights.length - 1];
      const learned = tasteNotes(fitTaste(S.taste.rows), S.taste.rows).map((n) => n.says);
      // nights: all there have been, those it holds and those let go
      return { nights: tonight() - 1, recurring, open, last: last ? { title: last.title, shape: last.shape, ...(last.ending ? { ending: true } : {}) } : null, endings: S.nights.filter((x) => x.ending).length, notes: S.notes || [], learned };
    },

    // Let its oldest nights go, holding the last `keep`: for when they are kept apart (the TV keeps
    // every night, and the guide's tools read them there) and room is short. The nights let go.
    trimNights(keep = KEEP) {
      const k = Math.max(1, Math.floor(Number(keep) || KEEP));
      const out = S.nights.length > k ? S.nights.splice(0, S.nights.length - k) : [];
      if (out.length) engine = null;
      return out;
    },

    // Where the world stands (scene.mjs): written for it when its story starts, and again if the
    // story moves on to somewhere else. A scene that can't be drawn is not kept. Returns the one kept.
    get scene() { return S.scene ? checkScene(S.scene) : null; },
    setScene(scene, { night = tonight() } = {}) {
      const ok = checkScene(scene);
      if (!ok) return this.scene;
      S.scene = { ...ok, night };
      return checkScene(S.scene);
    },

    // Forgetting (forget.mjs): what forgetting a thing would take, and taking it. A thing forgotten
    // already gives back the same record and takes nothing more. { record, plan, replay }, or null.
    forgetPlan: (id) => planForget(S, id),
    forget(id, { at = Date.now() } = {}) {
      const was = (S.forgotten || []).find((r) => r.id === `forget-${id}`);
      if (was && !ent(id)) return { record: was, plan: null, replay: true };
      const plan = planForget(S, id);
      if (!plan) return null;
      const record = applyForget(S, plan, { at });
      engine = null;
      return { record, plan, replay: false };
    },
    get forgotten() { return S.forgotten || []; },
    toJSON: () => JSON.parse(JSON.stringify(S)),
  };
  return api;
}

function downsample(feeling, n) {
  if (!feeling || !Array.isArray(feeling.byStroke) || !feeling.byStroke.length) return [];
  const v = feeling.byStroke, a = feeling.arousal || [];
  const k = Math.min(n, v.length);
  return Array.from({ length: k }, (_, i) => {
    const j = Math.floor((i * v.length) / k);
    return [Math.round(clamp(v[j]) * 100) / 100, Math.round(clamp(a[j] ?? 0) * 100) / 100];
  });
}

// What the guide service proposes a night adds, made safe to keep: only known ids or new things
// with a name and a kind; lines that exist; short plain text; only open threads resolved.
//   { entities: [{ id, lines } | { new, kind, aliases, lines }],
//     facts: [{ about (an id, or a new thing's name), text, line, open }],
//     resolved: [{ fact, line }] }
// `thingFor(ref)`, if given, finds a thing already in their world by an id or name: a thing given
// by its name, or an id that is its name, is that thing, not a second one.
export function checkDiff(diff, { lines = 0, ids = new Set(), open = new Set(), strokes = null, thingFor = null } = {}) {
  const d = diff && typeof diff === 'object' ? diff : {};
  const ln = (xs) => (Array.isArray(xs) ? [...new Set(xs.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < lines))] : []);
  // marks a thing is, when it says: only tonight's strokes
  const marks = (xs) => (strokes && Array.isArray(xs) ? [...new Set(xs.map(Number).filter((n) => strokes.has(n)))] : []);
  const extra = (x) => ({ ...(clean(x.why, 100) ? { why: clean(x.why, 100) } : {}), ...(clean(x.note, 140) ? { note: clean(x.note, 140) } : {}) });
  const entities = [];
  const seen = new Set();
  for (const x of Array.isArray(d.entities) ? d.entities.slice(0, 12) : []) {
    if (!x || typeof x !== 'object') continue;
    const id = typeof x.id === 'string' && ids.has(x.id) ? x.id
      : thingFor ? thingFor(typeof x.id === 'string' ? x.id : '') || (typeof x.new === 'string' ? thingFor(clean(x.new, 40)) : null) : null;
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
      entities.push({ id, lines: ln(x.lines), ...(x.strokes ? { strokes: marks(x.strokes) } : {}), ...extra(x) });
    } else if (typeof x.new === 'string' && clean(x.new, 40)) {
      const name = clean(x.new, 40), key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      entities.push({ new: name, kind: KINDS.includes(x.kind) ? x.kind : 'thing', aliases: (Array.isArray(x.aliases) ? x.aliases : []).map((a) => clean(a, 30)).filter((a) => a.length >= 3).slice(0, 4), lines: ln(x.lines), ...(x.strokes ? { strokes: marks(x.strokes) } : {}), ...extra(x) });
    }
  }
  const one = (i) => { const r = ln([i]); return r.length ? r[0] : null; };
  const facts = (Array.isArray(d.facts) ? d.facts.slice(0, 12) : []).filter((f) => f && typeof f.about === 'string' && clean(f.text, 140))
    .map((f) => ({ about: clean(f.about, 40), text: clean(f.text, 140), line: one(f.line), open: !!f.open }));
  const resolved = (Array.isArray(d.resolved) ? d.resolved.slice(0, 4) : []).filter((r) => r && open.has(r.fact)).map((r) => ({ fact: r.fact, line: one(r.line) }));
  const notes = Array.isArray(d.notes) ? d.notes.map((x) => clean(x, 140)).filter(Boolean).slice(0, 8) : null;
  return { entities, facts, resolved, ...(notes ? { notes } : {}) };
}
