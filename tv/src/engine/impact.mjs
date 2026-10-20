// Copied from inkwash/engine/impact.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// Change impact: what an edit to the canon reaches.
//
// - Facts that depend on it: other facts about the same people and things together (a role in the
//   group someone is a member of; the tax a group levies where it holds the town), and, when story
//   time moves, the neighbouring terms (if a reign ends sooner, the next must start sooner).
// - Passages: those the ledger says relied on it or on a dependent; those that bring its subject
//   in the way only it allows (by title, for a ruler); those that recall it in its words (an
//   event). When the edit moves story time, only passages on the wrong side of the new bound.
// - A new death: the dead person's terms that run past it, and every later passage they are in.
//
// Each item has a score and a reason. `sure` items are offered; the rest are kept for a model or
// the author to look at if they ask.
//
// edit: { fact, after?, from?, to? } | { add: { entity, text, from?, to? } }
import { tokenize, stem, STOP } from './text.mjs';
import { DEATH, DEATH_PASSIVE } from './lexicon.mjs';

// Tuned on the eval's dev worlds, never on its held-out ones.
export const IMPACT = {
  sure: 3, // the score an item needs to be offered
  ledger: 10, // a passage the ledger says relied on the fact
  ledgerDependent: 6, // ...or on a fact that depends on it
  title: 8, // a passage naming the fact's holder by title, while it holds
  recall: 1.5, // per distinctive word a passage shares with the fact, about its subject
  presence: 10, // a death: a later passage the person is in
  subject: 0, // a passage that is merely about the subject
  dependent: 5, // per entity a fact shares with the edited one (two or more)
  neighbour: 10, // the next or previous term, when a term's bounds move
  pastDeath: 10, // a term of the dead that runs past the death
};

const looksLikeDeath = (text) => {
  const w = tokenize(text).map((t) => t.lower);
  return w.some((x) => DEATH.has(x)) || w.some((x, i) => DEATH_PASSIVE.has(x) && (w[i - 1] === 'was' || w[i - 1] === 'were'));
};

// distinctive words: not names, not stop words
function contentStems(W, text) {
  const tokens = tokenize(text);
  const inName = new Set();
  for (const m of W.names.find(tokens)) for (let i = m.from; i < m.to; i++) inName.add(i);
  const out = new Set();
  tokens.forEach((t, i) => { if (!inName.has(i) && t.lower.length > 2 && !STOP.has(t.lower)) out.add(stem(t.lower)); });
  return out;
}

export function impact(W, edit, { weights = IMPACT, offerAll = false } = {}) {
  const facts = new Map(), passages = new Map();
  const bf = (id, s, why) => { const x = facts.get(id) || { s: 0, why: [] }; x.s += s; if (x.why.length < 3) x.why.push(why); facts.set(id, x); };
  const bp = (id, s, why) => { const x = passages.get(id) || { s: 0, why: [] }; x.s += s; if (x.why.length < 3) x.why.push(why); passages.set(id, x); };
  const chapterOf = (pid) => W.passage.get(pid).chapter;
  let subject, editText, inWindow = () => true;

  if (edit.add) {
    subject = edit.add.entity;
    editText = edit.add.text;
    if (W.isPerson(subject) && looksLikeDeath(editText)) {
      const d = edit.add.from ?? 1;
      for (const [obj, h] of W.holders) for (const kind of ['rule', 'possess']) for (const t of h[kind]) {
        if (t.person === subject && (t.to == null || t.to > d)) bf(t.fact, weights.pastDeath, `${kind === 'rule' ? 'rules' : 'has'} ${W.entity.get(obj).name} past the death`);
      }
      for (const pid of W.passagesOf.get(subject) || []) if (chapterOf(pid) >= d) bp(pid, weights.presence, `in it after the death (${[...W.passRefs.get(pid).get(subject).how].join('/')})`);
    } else {
      const words = contentStems(W, editText);
      for (const pid of W.passagesOf.get(subject) || []) {
        const shared = [...contentStems(W, W.passage.get(pid).text)].filter((x) => words.has(x)).length;
        bp(pid, weights.subject + weights.recall * shared, shared ? 'about its subject, in its words' : 'about its subject');
      }
    }
  } else {
    const f = W.fact.get(edit.fact);
    if (!f) throw new Error(`no fact ${edit.fact}`);
    subject = f.entity;
    editText = edit.after ?? f.text;
    const textChanged = edit.after != null && edit.after !== f.text;
    const fromChanged = edit.from !== undefined && edit.from !== f.from;
    const toChanged = edit.to !== undefined && edit.to !== f.to;
    const from0 = f.from ?? 1, to0 = f.to ?? Infinity;
    if (fromChanged && (edit.from ?? 1) > from0) inWindow = (ch) => ch >= from0 && ch < edit.from; // moved later: recalled too soon
    else if (toChanged && (edit.to ?? Infinity) < to0) inWindow = (ch) => ch >= edit.to && ch < to0; // ends sooner: relied on too long
    else if ((fromChanged || toChanged) && !textChanged) inWindow = () => false; // a longer span breaks nothing already written

    // facts that depend on it
    const E = new Set([f.entity, ...(W.refs.get(f.id) || [])]);
    const dependents = [];
    if (textChanged) {
      const seen = new Set();
      for (const e of E) for (const g of [...(W.factsOf.get(e) || []), ...(W.namedIn.get(e) || [])]) {
        if (g === f.id || seen.has(g)) continue;
        seen.add(g);
        const G = new Set([W.fact.get(g).entity, ...(W.refs.get(g) || [])]);
        const shared = [...E].filter((x) => G.has(x)).length;
        if (shared >= 2) { bf(g, weights.dependent * shared, `about the same ${shared} together`); dependents.push(g); }
      }
    }
    // the neighbouring terms, when a term's bounds move
    const term = W.termOf.get(f.id);
    if (term && (fromChanged || toChanged)) {
      for (const t of W.holders.get(term.obj)[term.kind]) {
        if (t.fact === f.id) continue;
        if (toChanged && f.to != null && t.from === f.to) bf(t.fact, weights.neighbour, 'the next term, which should start when this one ends');
        if (fromChanged && f.from != null && t.to === f.from) bf(t.fact, weights.neighbour, 'the previous term, which should end when this one starts');
      }
    }
    // passages
    for (const pid of W.ledger.get(f.id) || []) if (inWindow(chapterOf(pid))) bp(pid, weights.ledger, 'relies on it (ledger)');
    for (const g of dependents) for (const pid of W.ledger.get(g) || []) if (inWindow(chapterOf(pid))) bp(pid, weights.ledgerDependent, 'relies on a fact that depends on it (ledger)');
    const words = contentStems(W, f.text);
    for (const pid of W.passagesOf.get(subject) || []) {
      if (!inWindow(chapterOf(pid))) continue;
      const how = W.passRefs.get(pid).get(subject).how;
      if (term && term.kind === 'rule' && (how.has('title') || how.has('title?')) && (W.passRefs.get(pid).has(term.obj))) bp(pid, weights.title, 'names its holder by title');
      const shared = [...contentStems(W, W.passage.get(pid).text)].filter((x) => words.has(x)).length;
      if (shared >= 2) bp(pid, weights.recall * shared, 'about its subject, in its words');
      else bp(pid, weights.subject, 'about its subject');
    }
  }

  const rank = (m) => [...m].sort((a, b) => b[1].s - a[1].s).map(([id, x]) => ({ id, s: +x.s.toFixed(2), why: x.why }));
  const allFacts = rank(facts), allPassages = rank(passages);
  const sureF = allFacts.filter((x) => x.s >= weights.sure), sureP = allPassages.filter((x) => x.s >= weights.sure);
  return {
    facts: (offerAll ? allFacts : sureF).map((x) => x.id),
    passages: (offerAll ? allPassages : sureP).map((x) => x.id),
    manifest: { subject, facts: allFacts.slice(0, 40), passages: allPassages.slice(0, 40), offered: { facts: sureF.length, passages: sureP.length } },
  };
}
