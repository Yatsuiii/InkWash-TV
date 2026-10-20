// Copied from inkwash/engine/dreams/tools.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// What the guide can ask of a person's dream world while it tells tonight's dream: its memory
// tools, run on the TV over the world kept there (world.mjs). Each returns small plain data, for a
// tool result. The guide decides what to look up; nothing here decides for it.
//
// - agentBrief: what the guide is told at the start: which night this is, the things that keep
//   coming (by id, with how each has felt and why), what is unresolved, how they like their dreams
//   told, what they turned down, what they painted next after a telling; which of tonight's marks
//   are shaped and placed like a mark a thing came as before: a hint of where to look, never a
//   conclusion; and earlier chapters (memoryOf): the last ones as told, older ones as recaps;
// - recall: their dream world searched, by name (the engine's name resolution) and by words
//   (BM25 over each night's telling, what they said and what they answered);
// - thingDetail: everything kept about one thing, night by night;
// - nightDetail: one earlier night.
//
// A world holds its last 120 nights (world.mjs); the TV keeps every night apart from it, and
// recall, thingDetail and nightDetail read those older nights too, when given them (`older`). The
// brief carries the threads that matter tonight, at most OPEN, and says how many more recall finds.
import { bm25, terms } from '../text.mjs';
import { feltOver, whySays } from './emotion.mjs';
import { tasteNotes } from './taste.mjs';

const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const day = (t) => (t ? new Date(t).toISOString().slice(0, 10) : null);

function thingSummary(e) {
  const f = feltOver(e.appearances || []);
  return {
    id: e.id, name: e.name, kind: e.kind, nights: (e.appearances || []).map((a) => a.night),
    felt: f ? { weight: r2(f.v), stir: r2(f.a), last: { weight: r2(f.last.v), stir: r2(f.last.a) }, trend: f.trend } : null,
    why: f ? f.whys : [], theirs: e.status === 'confirmed',
    // how it looks in the pictures of their world, once it has been made real
    ...(e.look ? { looks: e.look } : {}),
    ...((e.endings || []).length ? { in_new_endings: e.endings.map((a) => ({ night: a.night, weight: r2(a.v), stir: r2(a.a) })) } : {}),
  };
}
// what they painted next after a telling, in brief: what it changed, as they kept it
const endingBrief = (S, n) => {
  const name = (id) => S.entities.find((e) => e.id === id)?.name || id;
  const told = n.ending.lines.filter((l) => l.ending && l.reaction !== 'no' && !l.forgotten);
  return { night: n.n, title: n.title, new_ending: told.map((l) => l.text).slice(-3), things: [...new Set(told.flatMap((l) => (l.entities || []).map(name)))], felt: n.ending.felt };
};
const liveOf = (S) => S.entities.filter((e) => e.status !== 'rejected');
// every night there is to read: the world's own, and `older` nights kept apart from it (the world's
// own copy wins), in order
const nightsOf = (S, older = []) => {
  const have = new Set(S.nights.map((n) => n.n));
  return [...(Array.isArray(older) ? older : []).filter((n) => n && Number.isFinite(n.n) && !have.has(n.n)), ...S.nights].sort((a, b) => a.n - b.n);
};
// the most open threads the brief carries: those about what is in tonight's painting, then the latest
export const OPEN = 8;

// What the guide is given of earlier chapters, the way a long story is kept in mind: the last
// `recent` chapters as they were told, word for word; and older ones a few at a time, in fixed
// blocks of `block` chapters, each said as a short recap, to them ("you"), from what each chapter
// kept: its title, the things in it, the line that names the most of them, what became true. Only
// a chapter out of the recent window is recapped, so nothing comes twice. The recaps are scored
// against tonight (the words they said, and the things tonight's marks are like: a thing in a
// block counts most), and the best `recaps` with anything to do with tonight are given, in the
// order they happened. No model writes them: they are what was kept, shortened. All of it is
// counted as a model would count it, about 3.5 characters a token, within `tokens`.
export const MEMORY = { recent: 2, block: 4, recaps: 3, chars: 420, tokens: 900 };
export const tokensOf = (s) => Math.ceil(String(s || '').length / 3.5);
const keptLines = (n) => (n.lines || []).filter((l) => l.reaction !== 'no' && !l.forgotten);
const endingLines = (n) => (n.ending ? n.ending.lines.filter((l) => l.ending && l.reaction !== 'no' && !l.forgotten) : []);
const cut = (s, n) => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1)).replace(/\s+\S*$/, '')}…`);

// one chapter, as a recap says it: "Chapter 3, The Low Shore: the night ferry, the pier. You found
// your boat at the pier."
function chapterRecap(S, n, room) {
  const name = (id) => S.entities.find((e) => e.id === id && e.status !== 'rejected')?.name;
  const things = [...new Set((n.cast || []).map(name).filter(Boolean))];
  const lines = [...keptLines(n), ...endingLines(n)];
  const named = (l) => things.filter((t) => String(l.text).toLowerCase().includes(t.toLowerCase().replace(/^(the|a|an|my) /, ''))).length;
  const best = lines.reduce((a, l) => (!a || named(l) > named(a) || (named(l) === named(a) && l.reaction === 'yes' && a.reaction !== 'yes') ? l : a), null);
  const facts = S.facts.filter((f) => f.from === n.n && f.to == null && !f.thread && things.length).map((f) => f.text).slice(0, 1);
  const head = `Chapter ${n.n}${n.title ? `, ${n.title}` : ''}${things.length ? `: ${things.slice(0, 3).join(', ')}` : ''}.`;
  return cut([head, best ? best.text : '', ...facts, n.ending ? 'Then you drew what happened next.' : ''].filter(Boolean).join(' '), room);
}

// Earlier chapters for tonight: { recent, recaps, memory }. `memory` is what was given and what was
// left out, and what each cost, kept with the night ("what it remembered"). `words`: tonight's;
// `tonight`: the ids of the things tonight's marks or words are like.
export function memoryOf(world, { words = [], tonight = new Set(), M = MEMORY } = {}) {
  if (!(tonight instanceof Set)) tonight = new Set(Array.isArray(tonight) ? tonight : []);
  words = (Array.isArray(words) ? words : []).filter((w) => w && typeof w.text === 'string');
  const S = world.toJSON();
  const nights = S.nights.filter((n) => keptLines(n).length || endingLines(n).length);
  const recentNights = nights.slice(-M.recent);
  const recent = recentNights.map((n) => ({ night: n.n, title: n.title || null, told: keptLines(n).map((l) => l.text), ...(n.ending ? { then: endingLines(n).map((l) => l.text) } : {}) }));
  const recentCost = recent.reduce((a, r) => a + tokensOf([...r.told, ...(r.then || [])].join(' ')), 0);
  const inRecent = new Set(recentNights.map((n) => n.n));
  const blocks = [];
  for (const n of nights) {
    if (inRecent.has(n.n)) continue;
    const k = Math.floor((n.n - 1) / M.block);
    if (!blocks.length || blocks.at(-1).k !== k) blocks.push({ k, nights: [] });
    blocks.at(-1).nights.push(n);
  }
  const docs = blocks.map((b) => ({
    id: b.k, from: b.nights[0].n, to: b.nights.at(-1).n,
    text: b.nights.map((n) => chapterRecap(S, n, Math.floor(M.chars / b.nights.length))).join(' '),
    cast: [...new Set(b.nights.flatMap((n) => n.cast || []))],
  }));
  const q = [...words.map((w) => (w && w.text) || ''), ...[...tonight].map((id) => S.entities.find((e) => e.id === id)?.name || '')].join(' ');
  const said = new Map(docs.length && q.trim() ? bm25(docs).search(q).map(({ id, score }) => [id, score]) : []);
  const like = (d) => d.cast.filter((id) => tonight.has(id));
  const scored = docs.map((d) => ({ ...d, score: r2((said.get(d.id) || 0) + 2 * like(d).length) }));
  const chosen = [], left = [];
  let spent = recentCost;
  for (const d of [...scored].sort((a, b) => b.score - a.score || b.to - a.to)) {
    if (d.score > 0 && chosen.length < M.recaps && spent + tokensOf(d.text) <= M.tokens) { chosen.push(d); spent += tokensOf(d.text); } else left.push(d);
  }
  const span = (d) => (d.from === d.to ? `chapter ${d.from}` : `chapters ${d.from} to ${d.to}`);
  const nameOf = (id) => S.entities.find((e) => e.id === id)?.name;
  chosen.sort((a, b) => a.from - b.from);
  return {
    recent,
    recaps: chosen.map((d) => ({ chapters: span(d), recap: d.text })),
    memory: {
      recent: recent.map((r) => r.night), recent_tokens: recentCost,
      recaps: chosen.map((d) => ({ chapters: span(d), score: d.score, tokens: tokensOf(d.text), because: like(d).map(nameOf).filter(Boolean) })),
      left_out: left.sort((a, b) => a.from - b.from).map((d) => ({ chapters: span(d), score: d.score })),
      tokens: spent, budget: M.tokens,
    },
  };
}

export function agentBrief(world, { strokes = [], words = [], washed = [] } = {}) {
  const real = (xs) => (Array.isArray(xs) ? xs.filter((x) => x && typeof x === 'object') : []);
  strokes = real(strokes).filter((s) => Array.isArray(s.box)); words = real(words).filter((w) => typeof w.text === 'string'); washed = real(washed);
  const S = world.toJSON();
  const ctx = world.context({ strokes, words, washed });
  const rows = world.tasteRows();
  const live = liveOf(S);
  const seen = world.recognize({ strokes, words: words.map((w) => w.text) });
  const tonight = new Set(seen.map((r) => r.id));
  // the things that keep coming, the most and latest first; and any tonight's marks or words are
  // like, however long ago it came
  const all = live.map(thingSummary).sort((a, b) => b.nights.length - a.nights.length || Math.max(0, ...b.nights) - Math.max(0, ...a.nights));
  const things = [...all.slice(0, 12), ...all.slice(12).filter((t) => tonight.has(t.id)).slice(0, 6)];
  // what is unresolved: about what is in tonight's painting (a mark like it, or named), then the latest
  const allOpen = S.facts.filter((f) => f.thread && f.to == null && live.some((e) => e.id === f.entity))
    .sort((a, b) => Number(tonight.has(b.entity)) - Number(tonight.has(a.entity)) || b.from - a.from);
  const open = allOpen.slice(0, OPEN).map((f) => ({ id: f.id, about: f.entity, text: f.text, since: f.from }));
  const hints = seen.filter((r) => r.n != null).map((r) => {
    const e = live.find((x) => x.id === r.id);
    // its last mark: in a dream, or in an ending they painted
    const ap = [...(e.appearances || []), ...(e.endings || []).map((a) => ({ ...a, ending: true }))].filter((a) => a.mark).sort((a, b) => a.night - b.night || Number(!!a.ending) - Number(!!b.ending)).at(-1);
    return { stroke: r.n, looks_like: r.id, name: r.name, came_before_as: ap ? { night: ap.night, strokes: ap.strokes || [], ...(ap.ending ? { in_a_new_ending: true } : {}) } : null };
  });
  // earlier chapters: the last ones as told, older ones recapped where they bear on tonight
  const mem = memoryOf(world, { words, tonight });
  return {
    night: world.tonight(), nights_before: world.tonight() - 1, things, open,
    ...(allOpen.length > open.length ? { more_open: `${allOpen.length - open.length} more unresolved from earlier nights, about other things: recall finds them by what they are about` } : {}),
    notes: S.notes || [], turned_down: (S.readings.rejected || []).slice(-12).map((x) => x.text), hints,
    // the endings they painted for dreams already told: the last three
    ...(S.nights.some((n) => n.ending) ? { new_endings: S.nights.filter((n) => n.ending).slice(-3).map((n) => endingBrief(S, n)) } : {}),
    // how tonight was painted, against how they usually paint (or the rest of tonight, at first)
    how_they_painted: { against: ctx.hand.against, notable: ctx.hand.notable.map(({ stroke, kind, detail }) => ({ stroke, kind, detail })), overall: ctx.hand.overall, feeling: brushFeeling(world) },
    // what their answers to earlier tellings show, line by line
    what_they_keep: { lines_answered: rows.length, kept: rows.filter((r) => r.y).length, learned: tasteNotes(world.taste(), rows).map((n) => n.says) },
    recent: mem.recent, recaps: mem.recaps, memory: mem.memory,
  };
}

// what their marks have taught of how their brush carries feeling, briefly
function brushFeeling(world) {
  const m = world.feelingModel();
  const last = m.last ? { night: m.last.night, weight_error: m.last.weight.error, stir_error: m.last.stir.error, found_the_turn: m.last.turn } : null;
  return { learned_from_strokes: m.learned_from, nights_read: m.nights_read, last_reading: last, ...(m.usual ? { usual_mark: m.usual } : {}), what_it_has_meant: m.notes };
}

export function recall(world, query, { limit = 5, older = [] } = {}) {
  if (!Array.isArray(older)) older = [];
  const S = world.toJSON();
  const all = nightsOf(S, older);
  const q = String(query || '').slice(0, 200);
  const live = liveOf(S);
  // by name, as the engine resolves names; then by the words of their names, reasons and facts
  const named = new Set(world.recognize({ words: [q] }).map((r) => r.id));
  const want = new Set(terms(q));
  const overlap = (text) => terms(text).filter((t) => want.has(t)).length;
  const found = live.map((e) => {
    const text = [e.name, ...(e.aliases || []), ...(e.appearances || []).flatMap((a) => [a.whyText, a.note]), ...S.facts.filter((f) => f.entity === e.id).map((f) => f.text)].filter(Boolean).join(' ');
    return { e, score: (named.has(e.id) ? 10 : 0) + overlap(text) };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  const things = found.map((x) => thingSummary(x.e));
  // what is still unresolved about what it found, or in the words looked for
  const score = new Map(found.map((x) => [x.e.id, x.score]));
  const open = S.facts.filter((f) => f.thread && f.to == null && live.some((e) => e.id === f.entity))
    .map((f) => ({ f, k: (score.get(f.entity) || 0) + overlap(f.text) })).filter((x) => x.k > 0)
    .sort((a, b) => b.k - a.k || b.f.from - a.f.from).slice(0, limit)
    .map(({ f }) => ({ id: f.id, about: f.entity, name: live.find((e) => e.id === f.entity).name, text: f.text, since: f.from }));
  const docs = all.map((n) => ({ id: n.n, text: [n.title, ...(n.lines || []).map((l) => l.text), ...(n.said || []), ...(n.asked || []).map((x) => x.answer || ''), ...(n.ending ? n.ending.lines.filter((l) => l.ending).map((l) => l.text) : [])].join(' ') }));
  const nights = docs.length ? bm25(docs).search(q, limit).map(({ id }) => {
    const n = all.find((x) => x.n === id);
    const hit = [...(n.said || []), ...(n.lines || []).map((l) => l.text), ...(n.ending ? n.ending.lines.filter((l) => l.ending).map((l) => l.text) : [])].map((t) => ({ t, k: overlap(t) })).sort((a, b) => b.k - a.k)[0];
    return { night: n.n, date: day(n.at), title: n.title, snippet: hit ? hit.t : null };
  }) : [];
  return { things, ...(open.length ? { open } : {}), nights };
}

export function thingDetail(world, id, { older = [] } = {}) {
  const S = world.toJSON();
  const all = nightsOf(S, older);
  const e = S.entities.find((x) => x.id === id);
  if (!e) return null;
  const mentions = (text) => [e.name.replace(/^(the|a|an|my) /i, ''), ...(e.aliases || [])].some((k) => k.length >= 3 && String(text).toLowerCase().includes(k.toLowerCase()));
  return {
    ...thingSummary(e), aliases: e.aliases || [], first: e.first, turned_down: e.status === 'rejected',
    appearances: (e.appearances || []).map((a) => {
      const n = all.find((x) => x.n === a.night) || { lines: [], said: [] };
      return {
        night: a.night, strokes: a.strokes || [], weight: r2(a.v), stir: r2(a.a), why: whySays(a.why) || a.whyText || null, note: a.note || null,
        they_said: (n.said || []).filter(mentions),
        told: (n.lines || []).filter((l) => (l.entities || []).includes(e.id)).map((l) => ({ text: l.text, reaction: l.reaction })),
      };
    }),
    ...((e.endings || []).length ? {
      in_new_endings: e.endings.map((a) => {
        const n = all.find((x) => x.n === a.night);
        return { night: a.night, strokes: a.strokes || [], weight: r2(a.v), stir: r2(a.a), note: a.note || null, told: n && n.ending ? n.ending.lines.filter((l) => (l.entities || []).includes(e.id)).map((l) => ({ text: l.text, reaction: l.reaction })) : [] };
      }),
    } : {}),
    facts: S.facts.filter((f) => f.entity === id).map((f) => ({ id: f.id, text: f.text, since: f.from, until: f.to ?? null, open: !!f.thread && f.to == null, ...(f.closedBy === 'ending' ? { closed_by_a_new_ending: true } : {}) })),
  };
}

export function nightDetail(world, k, { older = [] } = {}) {
  const S = world.toJSON();
  const n = nightsOf(S, older).find((x) => x.n === Number(k));
  if (!n) return null;
  const name = (id) => S.entities.find((e) => e.id === id)?.name || id;
  return {
    night: n.n, date: day(n.at), title: n.title, shape: n.shape || null,
    telling: (n.lines || []).filter((l) => !l.forgotten).map((l) => ({ text: l.text, strokes: l.strokes, reaction: l.reaction, things: (l.entities || []).map(name) })),
    they_said: n.said || [], asked: n.asked || [], turn: n.pinned || null,
    feeling: n.line || [], things: (n.cast || []).map((id) => ({ id, name: name(id) })),
    ...(n.ending ? { new_ending: { title: n.ending.title, strokes: n.ending.strokes, felt: n.ending.felt, told: n.ending.lines.filter((l) => !l.forgotten).map((l) => ({ text: l.text, strokes: l.strokes, reaction: l.reaction, new: !!l.ending, things: (l.entities || []).map(name) })) } } : {}),
    ...((n.heard || []).length ? { heard_again: n.heard.map((r) => day(r.at)) } : {}),
  };
}
