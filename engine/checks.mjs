// Deterministic checks: contradictions that story time alone can catch, before any model reads
// the passage. Each flag names the fact it contradicts and the sentence that does.
//
// - dead-acts: someone acts after the chapter they died in. A sentence that remembers or
//   mourns them is not flagged (`MEMORY`), nor a passage the author marked as a flashback.
// - event-early: a passage recalls, in the event's own words, something that hasn't happened yet.
// - secret-early: before its reveal, a passage names both people in a secret and uses its words.
// - former-ruler: someone is called ruler of a place in a sentence, after their term there ended.
// - knows-early: someone speaks of or acts on a fact before they know it. A fact may say who knows
//   it (`knownBy`). A sentence led by someone not among them yet, with the fact's other people or
//   things and its words, is flagged; one that says they don't know ("had no idea") is not.
//
// What it can't catch is left to the model: a trait or a membership contradicted in other words
// ("swam out to the wreck" against "cannot swim") needs reading, not bookkeeping.
import { tokenize, stem, STOP } from './text.mjs';
import { MEMORY, RULE, TITLE } from './lexicon.mjs';
import { resolve } from './resolve.mjs';
import { holdersAt, knowsAt, validAt } from './time.mjs';

function sentences(text) {
  const out = [];
  const re = /[^.!?]+[.!?]*['"’”]?\s*/g;
  let m;
  while ((m = re.exec(text))) if (m[0].trim()) out.push({ text: m[0].trim(), start: m.index });
  return out;
}

// a sentence that says someone doesn't know: not them acting on it
const UNAWARE = /\b(?:did ?n['’]?t|did not|does ?n['’]?t|does not|never|nobody|no one)\s+(?:know|knew|guess|guessed|suspect|suspected|realize|realise|realized|realised|learn|learned|learnt|find out|found out)\b|\bno idea\b|\bunaware\b|\bwithout knowing\b/i;

const stemsOf = (W, text) => {
  const tokens = tokenize(text);
  const inName = new Set();
  for (const m of W.names.find(tokens)) for (let i = m.from; i < m.to; i++) inName.add(i);
  return new Set(tokens.filter((t, i) => !inName.has(i) && t.lower.length > 2 && !STOP.has(t.lower)).map((t) => stem(t.lower)));
};

export function check(W, passage, { flashback = false } = {}) {
  const ch = passage.chapter;
  const flags = [];
  if (flashback) return flags;
  const flag = (kind, fact, entity, sentence, why) => { if (!flags.some((f) => f.kind === kind && f.fact === fact)) flags.push({ kind, fact, entity, sentence, why }); };
  let context = passage.cast.slice();
  for (const s of sentences(passage.text)) {
    const R = resolve(W, s.text, { chapter: ch, cast: context });
    const words = tokenize(s.text).map((t) => t.lower);
    const remembers = words.some((w) => MEMORY.has(w));
    const stems = stemsOf(W, s.text);
    for (const [id, x] of R.ents) {
      if (!W.isPerson(id)) continue;
      const named = [...x.how].some((h) => ['name', 'alias', 'first', 'last'].includes(h));
      // dead-acts
      const d = W.deathOf.get(id);
      if (d && ch > d.at && named && !remembers) flag('dead-acts', d.fact, id, s.text, `${W.entity.get(id).name} died in chapter ${d.at}`);
      if (!named && !x.how.has('pronoun')) continue;
      // event-early: their dated events after this chapter, recalled in their words
      for (const fid of W.factsOf.get(id) || []) {
        const f = W.fact.get(fid);
        if (f.from == null || f.from <= ch || f.to != null || W.termFacts.has(fid) || (d && d.fact === fid)) continue;
        // the event's own words, and its place if it has one (the same deed elsewhere is another event)
        const shared = [...stemsOf(W, f.text)].filter((w) => stems.has(w)).length;
        const places = (W.refs.get(fid) || []).filter((e) => !W.isPerson(e));
        const placeShared = places.some((e) => R.ents.has(e));
        if (places.length ? placeShared && shared >= 1 : shared >= 2) flag('event-early', fid, id, s.text, `happens in chapter ${f.from}`);
      }
      // secret-early: both people named, and the secret's words
      for (const fid of W.factsOf.get(id) || []) {
        const f = W.fact.get(fid);
        if (f.secretUntil == null || ch >= f.secretUntil) continue;
        const other = (W.refs.get(fid) || []).find((e) => W.isPerson(e));
        if (other && R.ents.has(other) && [...stemsOf(W, f.text)].some((w) => stems.has(w))) flag('secret-early', fid, id, s.text, `secret until chapter ${f.secretUntil}`);
      }
      // former-ruler: called ruler of a place they no longer rule
      if (named && words.some((w) => RULE.has(w) || TITLE.has(w))) {
        for (const [obj] of R.ents) {
          const kind = W.entity.get(obj)?.kind;
          if (kind !== 'place') continue;
          const h = W.holders.get(obj);
          if (!h) continue;
          const theirs = h.rule.filter((t) => t.person === id);
          if (theirs.length && !holdersAt(W, obj, 'rule', ch).some((t) => t.person === id)) {
            const last = theirs[theirs.length - 1];
            flag('former-ruler', last.fact, id, s.text, last.to != null && ch >= last.to ? `their rule ended in chapter ${last.to}` : `their rule starts in chapter ${last.from}`);
          }
        }
      }
    }
    // knows-early: the sentence's first person, and the facts they don't know yet
    const lead = (R.persons || []).find((x) => W.isPerson(x.id));
    if (lead && W.tracked.length && !UNAWARE.test(s.text)) {
      for (const fid of W.tracked) {
        const f = W.fact.get(fid);
        if (knowsAt(f, lead.id, ch) || !validAt(f, ch)) continue;
        const others = [f.entity, ...(W.refs.get(fid) || [])].filter((e) => e !== lead.id);
        if (others.length && !others.some((e) => R.ents.has(e))) continue;
        const words = stemsOf(W, f.text);
        const shared = [...words].filter((w) => stems.has(w)).length;
        if (!shared || shared < Math.min(2, words.size)) continue;
        const later = f.knownBy.find((k) => k.who === lead.id);
        flag('knows-early', fid, lead.id, s.text, later ? `${W.entity.get(lead.id).name} learns this in chapter ${later.from}` : `${W.entity.get(lead.id).name} doesn't know this`);
      }
    }
    for (const id of R.ents.keys()) if (!context.includes(id) && W.isPerson(id)) context.push(id);
  }
  return flags;
}
