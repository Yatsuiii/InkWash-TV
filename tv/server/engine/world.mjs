// Copied from inkwash/engine/world.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// The world model: entities, canon facts with story time, the manuscript and its ledger, and
// what the engine works out once, when each is written, so that every later question is a lookup:
// - for each fact, the entities it names besides its subject (its references);
// - for each entity, the facts that name it;
// - family, from facts that name two people with a kin word, and from shared surnames;
// - who holds what over time: rulers of a place, carriers of a thing, as runs of terms;
// - deaths, with their chapter;
// - for each passage, who it is about and how it names them (by name, alias, pronoun, relation
//   or title), and the reverse: each entity's passages.
import { tokenize, bm25 } from './text.mjs';
import { createNameIndex } from './names.mjs';
import { KIN, RULE, POSSESS, DEATH, DEATH_PASSIVE } from './lexicon.mjs';
import { resolve } from './resolve.mjs';

const push = (map, k, v) => { const a = map.get(k); if (a) a.push(v); else map.set(k, [v]); };

export function buildWorld(data) {
  const W = {
    chapters: data.chapters || [],
    entity: new Map(data.entities.map((e) => [e.id, e])),
    fact: new Map(data.facts.map((f) => [f.id, f])),
    passage: new Map(data.passages.map((p) => [p.id, p])),
    names: createNameIndex(data.entities),
    factsOf: new Map(), // entity -> fact ids about it
    refs: new Map(), // fact -> [entity ids it names, besides its subject]
    namedIn: new Map(), // entity -> fact ids that name it
    kin: new Map(), // person -> Map(other -> { stated, words })
    holders: new Map(), // entity -> { rule: [term], possess: [term] }; term { person, fact, from, to }
    deathOf: new Map(), // person -> { fact, at }
    ledger: new Map(), // fact -> passage ids that report relying on it
    premisesOf: new Map(), // passage -> fact ids it reports relying on
    reliance: new Map(), // fact -> how many passages report relying on it
    shape: new Map(), // fact -> its words outside the names
    termFacts: new Set(), // facts that are a term of holding something
    termOf: new Map(), // fact -> { obj, kind }
    tracked: data.facts.filter((f) => Array.isArray(f.knownBy)).map((f) => f.id), // facts that say who knows them
  };
  const isPerson = (id) => { const e = W.entity.get(id); return e && e.kind === 'character'; };
  W.isPerson = isPerson;

  // ------------------------------------------------------------ facts, at write time
  for (const f of data.facts) {
    push(W.factsOf, f.entity, f.id);
    const tokens = tokenize(f.text);
    const mentions = W.names.find(tokens);
    const named = new Set();
    const inName = new Set();
    for (const m of mentions) {
      for (let i = m.from; i < m.to; i++) inName.add(i);
      // canon is written in full names, so a fact's mention is rarely ambiguous; keep all if so
      for (const id of m.ids) if (id !== f.entity) named.add(id);
    }
    W.refs.set(f.id, [...named]);
    for (const id of named) push(W.namedIn, id, f.id);
    const words = tokens.filter((t, i) => !inName.has(i)).map((t) => t.lower);
    W.shape.set(f.id, words.join(' '));
    const others = [...named];

    // family: a fact about a person, naming another, with a kin word
    if (isPerson(f.entity)) {
      const kinWords = words.filter((w) => w in KIN);
      if (kinWords.length) for (const y of others) if (isPerson(y)) linkKin(W, f.entity, y, kinWords, true);
    }
    // holding: a person ruling a place or group, or having a thing
    if (isPerson(f.entity) && others.length) {
      const objs = others.filter((id) => !isPerson(id));
      if (objs.length === 1) {
        const kind = W.entity.get(objs[0]).kind;
        if (words.some((w) => RULE.has(w)) && (kind === 'place' || kind === 'faction')) addTerm(W, objs[0], 'rule', f);
        else if (words.some((w) => POSSESS.has(w)) && kind === 'thing') addTerm(W, objs[0], 'possess', f);
      }
    }
    // a thing "carried by" a person: the fact is about the thing
    if (!isPerson(f.entity) && W.entity.get(f.entity)?.kind === 'thing' && others.length === 1 && isPerson(others[0]) && words.some((w) => POSSESS.has(w))) {
      addTerm(W, f.entity, 'possess', { ...f, entity: others[0] });
    }
    // a death
    if (isPerson(f.entity) && (words.some((w) => DEATH.has(w)) || words.some((w, i) => DEATH_PASSIVE.has(w) && (words[i - 1] === 'was' || words[i - 1] === 'were')))) {
      const at = f.from ?? 1;
      const prev = W.deathOf.get(f.entity);
      if (!prev || at < prev.at) W.deathOf.set(f.entity, { fact: f.id, at });
    }
  }
  // runs of terms, known by story time even where no word says what they are: facts that name
  // the same place or thing, by different people, where one ends as the next begins
  // (and written the same way, outside the names, so a dated event doesn't join a run of rulers)
  const byObject = new Map();
  for (const f of data.facts) {
    if (!isPerson(f.entity) || (f.to == null && f.from == null)) continue;
    const objs = (W.refs.get(f.id) || []).filter((id) => !isPerson(id));
    if (objs.length === 1) push(byObject, `${objs[0]}|${W.shape.get(f.id)}`, f);
  }
  for (const [key, fs] of byObject) {
    const obj = key.slice(0, key.indexOf('|'));
    const ends = new Set(fs.filter((f) => f.to != null).map((f) => f.to));
    const starts = new Set(fs.filter((f) => f.from != null).map((f) => f.from));
    const chained = fs.filter((f) => (f.to != null && starts.has(f.to)) || (f.from != null && ends.has(f.from)));
    if (new Set(chained.map((f) => f.entity)).size >= 2) {
      const kind = W.entity.get(obj).kind === 'thing' ? 'possess' : 'rule';
      for (const f of chained) addTerm(W, obj, kind, f);
    }
  }
  for (const h of W.holders.values()) for (const k of ['rule', 'possess']) h[k].sort((a, b) => (a.from ?? 0) - (b.from ?? 0));

  // family by surname, weaker than a fact that says so
  const bySurname = new Map();
  for (const e of data.entities) if (e.kind === 'character') { const t = tokenize(e.name); if (t.length > 1) push(bySurname, t[t.length - 1].w, e.id); }
  for (const ids of bySurname.values()) if (ids.length > 1 && ids.length <= 8) for (const a of ids) for (const b of ids) if (a !== b) linkKin(W, a, b, [], false);

  // ------------------------------------------------------------ the ledger
  for (const p of data.passages) for (const x of p.premises || []) {
    push(W.ledger, x.f, p.id);
    push(W.premisesOf, p.id, x.f);
    W.reliance.set(x.f, (W.reliance.get(x.f) || 0) + 1);
  }

  // ------------------------------------------------------------ passages, at write time
  W.passRefs = new Map(); // passage -> Map(entity -> { w, how: Set, at: [token] })
  W.passagesOf = new Map(); // entity -> passage ids
  for (const p of data.passages) {
    const R = resolve(W, p.text, { chapter: p.chapter, cast: p.cast });
    W.passRefs.set(p.id, R.ents);
    for (const id of R.ents.keys()) push(W.passagesOf, id, p.id);
  }

  // ------------------------------------------------------------ search
  W.factIndex = bm25(data.facts.map((f) => ({ id: f.id, text: f.text })));
  W.factIndexPos = new Map(data.facts.map((f, i) => [f.id, i]));
  return W;
}

function linkKin(W, a, b, words, stated) {
  for (const [x, y] of [[a, b], [b, a]]) {
    let m = W.kin.get(x);
    if (!m) W.kin.set(x, (m = new Map()));
    const r = m.get(y) || { stated: false, words: new Set() };
    r.stated = r.stated || stated;
    for (const w of words) r.words.add(w);
    m.set(y, r);
  }
}

function addTerm(W, obj, kind, f) {
  let h = W.holders.get(obj);
  if (!h) W.holders.set(obj, (h = { rule: [], possess: [] }));
  if (h[kind].some((t) => t.fact === f.id)) return;
  h[kind].push({ person: f.entity, fact: f.id, from: f.from ?? null, to: f.to ?? null });
  W.termFacts.add(f.id);
  W.termOf.set(f.id, { obj, kind });
}
