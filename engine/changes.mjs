// What a chapter changed. A model reads the chapter and says what it changed in the world: a
// lasting fact it establishes ("the bridge is gone"), a fact it ends ("she trusts him"). The engine
// checks each against the world, and what passes is kept, each change with a log entry that can
// undo it. Nobody approves each one: keeping a story's canon up to date by hand is the chore this
// takes away, so the log is there to read, and undoing a change is one step.
//
// - The model sees the chapter and the facts it brings in, as they stand when it begins (secrets
//   too, labelled, so it doesn't offer one back as new).
// - A new fact needs a subject (someone or something in the chapter, or new and named in it), one
//   plain sentence, and the chapter's own words that show it. It's true from the chapter on. One
//   the canon already has in its words is not new, unless the same answer ends the old one.
// - An ended fact needs a fact the model was shown, true in this chapter, and the chapter's words
//   that show it no longer is. It holds through the chapter (it was true when the chapter began)
//   and not after. A dated event, a death, a fact whose end the author set, and a secret before
//   its reveal don't end this way: those are the author's.
// - Who learned what: a fact that says who knows it (`knownBy`) can gain someone in the chapter,
//   from the chapter on, with the chapter's words that show them learn it. Someone who already
//   knows it, or whom the author has learn it in another chapter, doesn't learn it this way.
// - What a kept change reaches: later passages that relied on what ended, or that a new fact may
//   contradict (impact.mjs).
//
//   const { system, prompt, keys, text } = changesPrompt(engine, 5);
//   const checked = checkChanges(engine, 5, answer, { keys, text });  // { new, ended, learned, dropped }
//   const { data, log } = applyChanges(data, checked, { chapter: 5 });
//   undoChange(data, log[0]);                                          // { ok, data } or { ok: false, why }
import { tokenize, stem, STOP } from './text.mjs';
import { validAt, knowsAt } from './time.mjs';

export const CHANGES_TEMPLATE = 'changes-v1';
export const NEW_KINDS = ['character', 'place', 'faction', 'thing'];
const MAX = 8;

const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// a quote is found in the chapter whatever its case, quote marks and punctuation
const flat = (s) => String(s ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}']+/gu, ' ').trim();
const NEG = /\b(not|no|never|cannot|nobody|nothing|none|without)\b|n't\b/i;

// a reference as the model may write it: "F3", "[F3]", "f3"
export const refOf = (x) => String((x && x.ref) ?? '').trim().toUpperCase().replace(/^\[|\]$/g, '');

export function chapterPassages(W, chapter) {
  return [...W.passage.values()].filter((p) => p.chapter === chapter).sort((a, b) => (a.scene ?? 0) - (b.scene ?? 0));
}

// The prompt: the facts the chapter brings in, numbered, then the chapter. The model may end only
// those numbers.
export function changesPrompt(engine, chapter, { budget = 2500 } = {}) {
  const W = engine.world;
  const ps = chapterPassages(W, chapter);
  const ws = engine.workingSet({ type: 'changes', chapter }, { budget });
  const keys = new Map(ws.facts.map((fid, i) => [`F${i + 1}`, fid]));
  const canon = ws.facts.map((fid, i) => `[F${i + 1}] ${ws.lines[i]}`).join('\n');
  const text = ps.map((p) => p.text).join('\n\n');
  // who learns what, only where the canon says who knows
  const tracked = ws.facts.some((fid) => Array.isArray(W.fact.get(fid).knownBy));
  const system = 'You read a chapter of a novel and say what it changes in the story\'s world, for the author\'s canon. The canon is the author\'s; you only report. '
    + 'Report only what the chapter shows happening or becoming true: not what someone says, fears, guesses or lies about, and not memories or dreams. '
    + 'Lasting changes only: where someone stands in a scene is not one.';
  const prompt = `CANON, as it stands when chapter ${chapter} begins (each line says when it holds, if not always)\n${canon || '(none)'}\n\n`
    + `CHAPTER ${chapter}\n"""\n${text}\n"""\n\n`
    + 'Reply with only JSON: {"new": [{"about": "who or what it is about: a name from the canon, or a new name from the chapter", "kind": "character, place, faction or thing (only for someone or something new)", "fact": "one plain sentence, true from this chapter on", "quote": "the chapter\'s exact words that show it"}], '
    + '"ended": [{"ref": "F3", "quote": "the chapter\'s exact words that show it is no longer true", "why": "one short sentence"}]'
    + (tracked ? ', "learned": [{"who": "someone in the chapter", "ref": "F5", "quote": "the chapter\'s exact words that show them learn it"}]}. A fact the canon says only some people know is "learned" when the chapter shows someone else find it out. ' : '}. ')
    + `At most ${MAX} of each. Use "ref" only from the canon above. What the canon already says, secrets included, is not new. Empty lists are a good answer when nothing changed.`;
  return { system, prompt, keys, ws, text, passages: ps.map((p) => p.id) };
}

// words outside the names, as checks.mjs reads them
function stemsOf(W, text) {
  const tokens = tokenize(text);
  const inName = new Set();
  for (const m of W.names.find(tokens)) for (let i = m.from; i < m.to; i++) inName.add(i);
  return new Set(tokens.filter((t, i) => !inName.has(i) && t.lower.length > 2 && !STOP.has(t.lower)).map((t) => stem(t.lower)));
}
// the same fact in other words: most of the shorter one's words, and saying it the same way round
function sameFact(W, a, b) {
  if (NEG.test(a) !== NEG.test(b)) return false;
  const A = stemsOf(W, a), B = stemsOf(W, b);
  if (!A.size || !B.size) return flat(a) === flat(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / Math.min(A.size, B.size) >= 0.75;
}

// The one entity a name means: the whole of `about` is its name or an alias; of several, the one
// in the chapter. { id } | { ambiguous: [ids] } | null
function entityFor(W, about, inChapter) {
  const { tokens, mentions } = W.names.findText(about);
  const start = tokens.length > 1 && tokens[0].lower === 'the' ? 1 : 0;
  const m = mentions.find((x) => x.from === start && x.to === tokens.length);
  if (!m) return null;
  const here = m.ids.filter((id) => inChapter.has(id));
  const ids = here.length ? here : m.ids;
  return ids.length === 1 ? { id: ids[0] } : { ambiguous: ids };
}

// What of the model's answer the world allows. { new, ended, dropped: [{ kind, item, why }] }
export function checkChanges(engine, chapter, answer, { keys, text }) {
  const W = engine.world;
  const d = answer && typeof answer === 'object' ? answer : {};
  const page = flat(text);
  // the chapter's words: every part of the quote (an ellipsis may join two), two words or more
  const shows = (q) => {
    const parts = String(q ?? '').split(/\.{3}|…/).map(flat).filter(Boolean);
    return parts.length > 0 && parts.join(' ').split(' ').length >= 2 && parts.every((x) => page.includes(x));
  };
  const inChapter = new Set();
  for (const p of chapterPassages(W, chapter)) {
    for (const id of W.passRefs.get(p.id)?.keys() || []) inChapter.add(id);
    for (const id of p.cast || []) inChapter.add(id);
  }
  const dropped = [];
  const drop = (kind, item, why) => { dropped.push({ kind, item, why }); };
  const ended = [];
  for (const x of Array.isArray(d.ended) ? d.ended.slice(0, MAX) : []) {
    if (!x || typeof x !== 'object') continue;
    const ref = refOf(x).slice(0, 12);
    const fid = keys.get(ref);
    const item = { ref, quote: clean(x.quote, 300) };
    if (!fid) { drop('ended', item, 'cites a fact it wasn\'t shown'); continue; }
    const f = W.fact.get(fid);
    item.fact = fid;
    if (ended.some((y) => y.fact === fid)) continue;
    if (!validAt(f, chapter)) drop('ended', item, `not true in chapter ${chapter}`);
    else if (f.to != null) drop('ended', item, `the canon already ends it in chapter ${f.to}`);
    else if (W.deathOf.get(f.entity)?.fact === fid) drop('ended', item, 'a death');
    else if (f.from != null && !W.termFacts.has(fid)) drop('ended', item, `it happened in chapter ${f.from}, and stays happened`);
    else if (f.secretUntil != null && chapter < f.secretUntil) drop('ended', item, `a secret until chapter ${f.secretUntil}: the author's to change`);
    else if (!shows(x.quote)) drop('ended', item, 'the chapter doesn\'t say so in those words');
    else ended.push({ fact: fid, quote: item.quote, why: clean(x.why, 160) });
  }
  const learned = [];
  for (const x of Array.isArray(d.learned) ? d.learned.slice(0, MAX) : []) {
    if (!x || typeof x !== 'object') continue;
    const ref = refOf(x).slice(0, 12), fid = keys.get(ref);
    const item = { ref, who: clean(x.who, 80), quote: clean(x.quote, 300) };
    if (!fid) { drop('learned', item, 'cites a fact it wasn\'t shown'); continue; }
    const f = W.fact.get(fid);
    item.fact = fid;
    const hit = item.who ? entityFor(W, item.who, inChapter) : null;
    const who = hit && hit.id && W.isPerson(hit.id) ? hit.id : null;
    const name = who && W.entity.get(who).name;
    const planned = who && Array.isArray(f.knownBy) && f.knownBy.find((k) => k.who === who);
    const why = !Array.isArray(f.knownBy) ? 'the canon doesn\'t say who knows it, so anyone may'
      : hit && hit.ambiguous ? `"${item.who}" could be ${hit.ambiguous.map((id) => W.entity.get(id).name).join(' or ')}`
      : !who ? `"${item.who}" isn't someone in the canon`
      : !inChapter.has(who) ? `${name} isn't in chapter ${chapter}`
      : knowsAt(f, who, chapter) ? `${name} already knows it`
      : planned ? `the canon has ${name} learn it in chapter ${planned.from}`
      : !validAt(f, chapter) ? `not true in chapter ${chapter}`
      : !shows(x.quote) ? 'the chapter doesn\'t say so in those words' : null;
    if (why) drop('learned', item, why);
    else if (!learned.some((y) => y.fact === fid && y.who === who)) learned.push({ fact: fid, who, quote: item.quote });
  }
  const ending = new Set(ended.map((x) => x.fact));
  const fresh = [];
  for (const x of Array.isArray(d.new) ? d.new.slice(0, MAX) : []) {
    if (!x || typeof x !== 'object') continue;
    const fact = clean(x.fact, 300), about = clean(x.about, 80);
    const item = { about, fact, quote: clean(x.quote, 300) };
    if (!fact || !about) { drop('new', item, 'no fact, or no one it is about'); continue; }
    const hit = entityFor(W, about, inChapter);
    let subject;
    if (hit && hit.ambiguous) { drop('new', item, `"${about}" could be ${hit.ambiguous.map((id) => W.entity.get(id).name).join(' or ')}`); continue; }
    if (hit) {
      if (!inChapter.has(hit.id)) { drop('new', item, `${W.entity.get(hit.id).name} isn't in chapter ${chapter}`); continue; }
      subject = { id: hit.id };
    } else {
      // someone or something new: named in the chapter, and a short name
      const name = about.replace(/^(a|an)\s+/i, '');
      if (name.split(' ').length > 5 || name.length > 40 || !page.includes(flat(name.replace(/^the\s+/i, '')))) { drop('new', item, `"${about}" isn't named in the chapter`); continue; }
      subject = { new: name, kind: NEW_KINDS.includes(x.kind) ? x.kind : 'thing' };
    }
    if (!shows(x.quote)) { drop('new', item, 'the chapter doesn\'t say so in those words'); continue; }
    if (subject.id) {
      const same = (W.factsOf.get(subject.id) || []).map((fid) => W.fact.get(fid))
        .find((f) => !ending.has(f.id) && (f.to == null || f.to > chapter) && sameFact(W, f.text, fact));
      if (same) { drop('new', item, same.from != null && same.from > chapter ? `the canon has it from chapter ${same.from}` : 'the canon already says so'); continue; }
    }
    const key = subject.id || subject.new.toLowerCase();
    if (fresh.some((y) => (y.about.id || y.about.new.toLowerCase()) === key && sameFact(W, y.text, fact))) continue;
    fresh.push({ about: subject, name: subject.id ? W.entity.get(subject.id).name : subject.new, text: fact, quote: item.quote });
  }
  return { new: fresh, ended, learned, dropped };
}

// What kept changes reach: for each, the later passages written against the world before it.
export function changeReach(engine, checked, chapter) {
  const W = engine.world;
  const later = (ids) => ids.filter((pid) => W.passage.get(pid).chapter > chapter);
  const out = [];
  for (const x of checked.ended) out.push({ kind: 'ended', fact: x.fact, passages: later(engine.impact({ fact: x.fact, to: chapter + 1 }).passages) });
  for (const x of checked.new) if (x.about.id) out.push({ kind: 'new', text: x.text, passages: later(engine.impact({ add: { entity: x.about.id, text: x.text, from: chapter } }).passages) });
  return out.filter((x) => x.passages.length);
}

// Keeping them: the world's data with the changes in, and the log. New ids are fresh in the world
// (`newId(prefix)` to choose them).
export function applyChanges(data, checked, { chapter, at = 0, newId = null } = {}) {
  const taken = new Set([...data.facts.map((f) => f.id), ...data.entities.map((e) => e.id)]);
  const mint = (p) => {
    let id = newId ? newId(p) : null;
    for (let i = 1; !id || taken.has(id); i++) id = `${p}${chapter}-${i}`;
    taken.add(id);
    return id;
  };
  const facts = data.facts.map((f) => ({ ...f })), entities = data.entities.slice();
  const made = new Map(); // a new name -> its id
  const log = [];
  for (const x of checked.new) {
    let entity = x.about.id, madeEntity = false;
    if (!entity) {
      const key = x.about.new.toLowerCase();
      entity = made.get(key);
      if (!entity) {
        entity = mint('e');
        made.set(key, entity);
        entities.push({ id: entity, kind: x.about.kind, name: x.about.new, aliases: [] });
        madeEntity = true;
      }
    }
    const id = mint('f');
    facts.push({ id, entity, text: x.text, from: chapter, to: null, secretUntil: null });
    log.push({ id: `change-${id}`, kind: 'new', chapter, fact: id, entity, ...(madeEntity ? { madeEntity } : {}), text: x.text, quote: x.quote, at });
  }
  for (const x of checked.ended) {
    const f = facts.find((g) => g.id === x.fact);
    if (!f) continue;
    const to = chapter + 1;
    log.push({ id: `change-${f.id}-ends-${chapter}`, kind: 'ended', chapter, fact: f.id, entity: f.entity, was: f.to ?? null, to, text: f.text, quote: x.quote, why: x.why, at });
    f.to = to;
  }
  for (const x of checked.learned || []) {
    const f = facts.find((g) => g.id === x.fact);
    if (!f || !Array.isArray(f.knownBy) || f.knownBy.some((k) => k.who === x.who)) continue;
    f.knownBy = [...f.knownBy, { who: x.who, from: chapter }];
    log.push({ id: `change-${f.id}-${x.who}-learns-${chapter}`, kind: 'learned', chapter, fact: f.id, entity: f.entity, who: x.who, text: f.text, quote: x.quote, at });
  }
  return { data: { ...data, entities, facts }, log };
}

// Undoing one: refused if the fact was changed since (its words, its subject, its bounds), so an
// undo never takes back the author's own edit.
export function undoChange(data, entry) {
  const f = data.facts.find((g) => g.id === entry.fact);
  if (entry.kind === 'learned') {
    if (!f) return { ok: false, why: 'the fact is gone' };
    const k = (f.knownBy || []).find((x) => x.who === entry.who);
    if (!k) return { ok: true, data, already: true };
    if (k.from !== entry.chapter) return { ok: false, why: 'when they learn it was changed after it was kept' };
    return { ok: true, data: { ...data, facts: data.facts.map((g) => (g.id === f.id ? { ...g, knownBy: g.knownBy.filter((x) => x.who !== entry.who) } : g)) } };
  }
  if (entry.kind === 'new') {
    if (!f) return { ok: true, data, already: true };
    if (f.text !== entry.text || f.entity !== entry.entity || f.from !== entry.chapter) return { ok: false, why: 'it was changed after it was kept; change it in the canon instead' };
    const facts = data.facts.filter((g) => g.id !== f.id);
    const entities = entry.madeEntity && !facts.some((g) => g.entity === entry.entity) ? data.entities.filter((e) => e.id !== entry.entity) : data.entities;
    return { ok: true, data: { ...data, facts, entities } };
  }
  if (!f) return { ok: false, why: 'the fact is gone' };
  if ((f.to ?? null) === entry.was) return { ok: true, data, already: true };
  if ((f.to ?? null) !== entry.to) return { ok: false, why: 'its end was changed after it was kept' };
  return { ok: true, data: { ...data, facts: data.facts.map((g) => (g.id === f.id ? { ...g, to: entry.was } : g)) } };
}
