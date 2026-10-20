// The working-set compiler: from an operation to the facts a model should see, best first, cut
// to a budget, with a manifest of why each fact is there and what was left out.
//
// user action -> who is in play (resolve) -> their facts, the facts that name them, whoever holds
// what is in play then -> facts that share words -> the ledger's sense of what matters -> story
// time -> a ranking -> a budget.
//
// Operations:
// - { type: 'check', passage }: everything the passage might rely on or contradict, including
//   facts that aren't true at its chapter (a former ruler acting as ruler is the error to catch).
// - { type: 'draft', chapter, cast, notes, pov? }: the cast and place as they stand at that chapter;
//   facts not true then go last. A secret is kept back until its reveal chapter: a model told a
//   secret and asked to keep it hints at it, so it sees only the author's hints for it (what a
//   scene may show before the reveal, a habit or a limit), and the check catches what slips.
//   With `pov` (someone in the story), the facts they don't know yet stay out too: a scene told
//   through their eyes can't know them.
// - { type: 'question', text, chapter, cast? }: as of that chapter.
// - { type: 'changes', chapter }: what the chapter's passages bring in, as it stands when the
//   chapter begins (changes.mjs: what a chapter may end). Secrets are in it: a model that reads
//   one isn't writing, and one it isn't shown it may offer back as new.
import { resolve } from './resolve.mjs';
import { validAt, holdersAt, knowsAt } from './time.mjs';

// Tuned on the eval's dev worlds (realism 2, M and L), never on its held-out ones.
export const WEIGHTS = {
  subject: 10, // a fact about someone in play
  mention: 4, // a fact naming them (divided by how many facts name them)
  link: 6, // a fact that ties two things in play together (its subject and something it names)
  law: 10, // a rule of a place in play
  holder: 8, // whoever holds a place or thing in play, in that chapter
  bm25: 3, // shares words with the text (scaled to the best match)
  ledger: 0.5, // the manuscript keeps relying on it (log of passages)
  stale: 12, // drafts and questions: not true in that chapter
  checkStale: 2, // checks: not true in that chapter (kept: it may be the contradiction)
  history: 3, // drafts: a dated event already past
  checkHistory: 0, // checks: a dated event, unless the text recalls it (words lift it back)
  now: 2, // a term that holds in that chapter
};

export const lineOf = (W, fid) => {
  const f = W.fact.get(fid);
  const when = [];
  if (f.from != null) when.push(`from chapter ${f.from}`);
  if (f.to != null) when.push(`until chapter ${f.to}`);
  if (f.secretUntil != null) when.push(`secret until chapter ${f.secretUntil}`);
  if (Array.isArray(f.knownBy)) {
    const who = f.knownBy.filter((k) => W.entity.has(k.who)).map((k) => W.entity.get(k.who).name + (k.from != null ? ` from chapter ${k.from}` : ''));
    when.push(who.length ? `known only to ${who.join(', ')}` : 'known to no one yet');
  }
  return `${W.entity.get(f.entity).name}: ${f.text}${when.length ? ` (${when.join(', ')})` : ''}`;
};
export const tokensOf = (s) => Math.ceil(String(s).length / 4) + 2;

// who a chapter's passages are about, as each was read when it was written: the most of each
function chapterRefs(W, chapter) {
  const out = new Map();
  for (const p of W.passage.values()) {
    if (p.chapter !== chapter) continue;
    for (const [id, x] of W.passRefs.get(p.id) || []) {
      const have = out.get(id);
      if (!have) out.set(id, { w: x.w, how: new Set(x.how) });
      else { have.w = Math.max(have.w, x.w); for (const h of x.how) have.how.add(h); }
    }
  }
  return out;
}

export function compile(W, op, { weights = WEIGHTS, budget = null } = {}) {
  let text, chapter, cast, mode;
  if (op.type === 'check') {
    const p = W.passage.get(op.passage);
    ({ text, chapter, cast } = p); mode = 'check';
  } else if (op.type === 'draft') {
    text = op.notes || ''; chapter = op.chapter; cast = op.cast || []; mode = 'draft';
  } else if (op.type === 'changes') {
    const ps = [...W.passage.values()].filter((p) => p.chapter === op.chapter);
    text = ps.map((p) => p.text).join('\n\n'); chapter = op.chapter; cast = [...new Set(ps.flatMap((p) => p.cast || []))]; mode = 'question';
  } else {
    text = op.text || ''; chapter = op.chapter ?? null; cast = op.cast || []; mode = 'question';
  }
  // a passage was read when it was written; anything else is read now
  const R = op.type === 'check' && W.passRefs.has(op.passage) ? { ents: new Map(W.passRefs.get(op.passage)), unsure: [] }
    : op.type === 'changes' ? { ents: chapterRefs(W, op.chapter), unsure: [] }
    : resolve(W, text, { chapter, cast });
  // a passage's notes, when the studio has them: the author's words for the scene count nearly as
  // much as the passage's; the chapter's (where a place named once is the setting) count less
  if (op.type === 'check') {
    const p = W.passage.get(op.passage);
    for (const [extra, scale] of [[p.notes, 0.8], [p.chapterNotes, 0.5]]) {
      if (!extra) continue;
      for (const [id, x] of resolve(W, extra, { chapter, cast }).ents) {
        const w = x.w * scale, have = R.ents.get(id);
        if (!have) R.ents.set(id, { w, how: new Set(['notes']) });
        else if (have.w < w) R.ents.set(id, { w, how: new Set([...have.how, 'notes']) });
      }
    }
    if (p.notes) text = `${text}\n${p.notes}`;
  }

  const score = new Map(), why = new Map(), withheld = [], unknown = [];
  const bump = (fid, s, reason) => {
    score.set(fid, (score.get(fid) || 0) + s);
    if (reason) { const a = why.get(fid); if (!a) why.set(fid, [reason]); else if (a.length < 4) a.push(reason); }
  };
  for (const [id, { w, how }] of R.ents) {
    const e = W.entity.get(id);
    if (!e) continue;
    const by = [...how].join('/');
    for (const fid of W.factsOf.get(id) || []) bump(fid, weights.subject * w, `about ${e.name} (${by})`);
    const named = W.namedIn.get(id) || [];
    const fan = Math.log2(2 + named.length);
    for (const fid of named) {
      const subj = W.entity.get(W.fact.get(fid).entity);
      let s = (weights.mention * w) / fan;
      if (subj.kind === 'rule' && e.kind === 'place') s += weights.law * w;
      bump(fid, s, `names ${e.name}`);
    }
    if (chapter != null && e.kind !== 'character' && e.kind !== 'rule') {
      for (const kind of ['rule', 'possess']) for (const t of holdersAt(W, id, kind, chapter)) {
        bump(t.fact, weights.holder * w, `${kind === 'rule' ? 'rules' : 'has'} ${e.name} in chapter ${chapter}`);
      }
    }
  }
  // facts that tie two things in play together: "Aloveirr Paick is a member of the Iron
  // Brotherhood", when the passage has her brother and the Brotherhood in it
  for (const [fid, s0] of score) {
    const subj = R.ents.get(W.fact.get(fid).entity);
    if (!subj) continue;
    let link = 0;
    for (const id of W.refs.get(fid) || []) { const o = R.ents.get(id); if (o) link += Math.min(subj.w, o.w); }
    if (link) bump(fid, weights.link * link, 'ties things in play together');
  }
  const hits = W.factIndex.search(text, 300);
  const best = hits.length ? hits[0].score : 1;
  for (const h of hits) bump(h.id, (weights.bm25 * h.score) / best, score.has(h.id) ? null : 'shares words');
  for (const fid of score.keys()) { const n = W.reliance.get(fid); if (n) bump(fid, weights.ledger * Math.log2(1 + n)); }
  if (chapter != null) for (const fid of [...score.keys()]) {
    const f = W.fact.get(fid);
    const valid = validAt(f, chapter);
    if (mode === 'check') {
      if (!valid) bump(fid, -weights.checkStale);
      if (f.from != null && f.to == null && !W.termFacts.has(fid)) bump(fid, -weights.checkHistory);
      continue;
    }
    if (mode === 'draft' && f.secretUntil != null && chapter < f.secretUntil) { withheld.push(fid); score.delete(fid); why.delete(fid); continue; }
    if (mode === 'draft' && op.pov && !knowsAt(f, op.pov, chapter)) { unknown.push(fid); score.delete(fid); why.delete(fid); continue; }
    if (!valid) { bump(fid, -weights.stale, `not true in chapter ${chapter}`); continue; }
    if (W.termFacts.has(fid)) bump(fid, weights.now);
    else if (mode === 'draft' && f.from != null && f.to == null) bump(fid, -weights.history);
  }

  const ranked = [...score].sort((a, b) => b[1] - a[1] || W.fact.get(a[0]).text.length - W.fact.get(b[0]).text.length).map(([id]) => id);
  const hintsOf = (fid) => (W.fact.get(fid).hints || []).map((h) => String(h).trim()).filter(Boolean);
  const hints = withheld.flatMap((fid) => hintsOf(fid).map((h) => `${W.entity.get(W.fact.get(fid).entity).name}: ${h}`));
  const manifest = {
    op: op.type, chapter,
    entities: [...R.ents].map(([id, x]) => ({ id, name: W.entity.get(id)?.name, how: [...x.how], w: +x.w.toFixed(2) })).sort((a, b) => b.w - a.w),
    unsure: R.unsure || [],
  };
  if (unknown.length) manifest.pov = { who: op.pov, keptBack: unknown };
  if (withheld.length) manifest.withheld = withheld.map((fid) => ({ id: fid, until: W.fact.get(fid).secretUntil, hints: hintsOf(fid).length }));
  if (budget == null) return { facts: ranked, hints, manifest, why };
  // the author's hints come first: they are what the scene was asked to show
  const keptHints = [];
  let used = 0;
  for (const h of hints) {
    const t = tokensOf(h);
    if (used + t > budget) break;
    keptHints.push(h); used += t;
  }
  const kept = [];
  for (const fid of ranked) {
    const t = tokensOf(lineOf(W, fid));
    if (used + t > budget) break;
    kept.push(fid); used += t;
  }
  manifest.cut = { kept: kept.length, dropped: ranked.length - kept.length, tokens: used, budget, nextDropped: ranked.slice(kept.length, kept.length + 5).map((fid) => ({ id: fid, why: why.get(fid) || [] })) };
  if (hints.length) Object.assign(manifest.cut, { hintsKept: keptHints.length, hintsDropped: hints.length - keptHints.length });
  return { facts: kept, lines: kept.map((fid) => lineOf(W, fid)), hints: keptHints, manifest, why };
}
