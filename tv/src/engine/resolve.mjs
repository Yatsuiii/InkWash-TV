// Copied from inkwash/engine/resolve.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// Who a text is about, and how it names them.
//
// - Names, aliases, first names and surnames, through the name index. An ambiguous name prefers
//   whoever is in the scene; otherwise it counts for each candidate, weakly, and the resolver says
//   it was unsure.
// - Pronouns, by salience: the latest person of that pronoun named before it (or the only one in
//   the scene).
// - Relations: "Alaed's brother", "her sister": the owner's kin of the right sex, from facts that
//   say so first, then from a shared surname.
// - Titles: "the lord of Salt Reach": whoever rules the place in that chapter, by story time.
//   A title word from the lexicon counts fully; any other "the <noun> of <place>" counts weakly,
//   since it may be a gate or a hall.
// Returns `ents`: entity -> { w (0..1), how (Set of how it was named) }, `unsure`, and `persons`:
// the people named or referred to, in the order they come ({ at: token, id }).
import { tokenize, STOP } from './text.mjs';
import { KIN, SIBLING_WORDS, PRONOUNS, POSSESSIVE_PRONOUNS, TITLE } from './lexicon.mjs';
import { holdersAt } from './time.mjs';

export function kinOf(W, owner, word) {
  const m = W.kin.get(owner);
  if (!m) return [];
  const g = KIN[word];
  let c = [...m].filter(([id]) => !g || W.entity.get(id)?.pronoun === g);
  const stated = c.filter(([, r]) => r.stated);
  if (stated.length) c = stated;
  if (SIBLING_WORDS.has(word)) {
    const sib = c.filter(([, r]) => [...r.words].some((w) => SIBLING_WORDS.has(w)));
    if (sib.length) c = sib;
  }
  return c.map(([id]) => id);
}

export function resolve(W, text, { chapter = null, cast = [] } = {}) {
  const tokens = tokenize(text);
  const mentions = W.names.find(tokens);
  const ents = new Map(), unsure = [];
  const add = (id, w, how) => {
    const e = ents.get(id);
    if (e) { e.w = Math.max(e.w, w); e.how.add(how); } else ents.set(id, { w, how: new Set([how]) });
  };
  const castSet = new Set(cast);
  for (const id of cast) add(id, 1, 'cast');

  const persons = []; // { at, id, gender }: the people named so far, for pronouns
  const mentionAt = new Map();
  for (const m of mentions) {
    for (let i = m.from; i < m.to; i++) mentionAt.set(i, m);
    let ids = m.ids;
    if (ids.length > 1) {
      const inScene = ids.filter((id) => castSet.has(id));
      if (inScene.length) ids = inScene;
      else unsure.push({ kind: 'name', at: m.from, ids });
    }
    m.resolved = ids;
    const w = ids.length === 1 ? 1 : (m.form === 'last' ? 0.3 : 0.6) / ids.length;
    for (const id of ids) add(id, w, ids.length === 1 ? m.form : 'ambiguous');
    if (ids.length === 1 && W.isPerson(ids[0])) persons.push({ at: m.from, id: ids[0], gender: W.entity.get(ids[0]).pronoun });
  }
  const latest = (i, gender) => {
    for (let k = persons.length - 1; k >= 0; k--) if (persons[k].at < i && (!gender || persons[k].gender === gender)) return persons[k].id;
    const c = cast.filter((id) => W.entity.get(id)?.pronoun === gender);
    return c.length === 1 ? c[0] : null;
  };
  const note = (i, id) => { const g = W.entity.get(id)?.pronoun; if (g) persons.push({ at: i, id, gender: g }); persons.sort((a, b) => a.at - b.at); };

  for (let i = 0; i < tokens.length; i++) {
    if (mentionAt.has(i)) continue;
    const t = tokens[i];
    // a relation: "Alaed's brother", "her sister"
    if (Object.prototype.hasOwnProperty.call(KIN, t.lower)) {
      const prev = i > 0 ? tokens[i - 1] : null;
      let owner = null;
      if (prev && mentionAt.has(i - 1)) {
        const m = mentionAt.get(i - 1);
        if (m.poss && m.resolved.length === 1 && W.isPerson(m.resolved[0])) owner = m.resolved[0];
      } else if (prev && POSSESSIVE_PRONOUNS.has(prev.lower)) owner = latest(i - 1, PRONOUNS[prev.lower]);
      if (owner) {
        const cands = kinOf(W, owner, t.lower);
        for (const id of cands) add(id, cands.length === 1 ? 0.95 : 0.7 / cands.length, 'relation');
        if (cands.length === 1) note(i, cands[0]);
        if (!cands.length) unsure.push({ kind: 'relation', at: i, owner, word: t.lower });
      }
      continue;
    }
    // a title: "the lord of Salt Reach"
    if (t.lower === 'of' && i >= 2 && tokens[i - 2].lower === 'the' && /^\p{Ll}/u.test(tokens[i - 1].w) && !STOP.has(tokens[i - 1].lower) && mentionAt.has(i + 1)) {
      const m = mentionAt.get(i + 1);
      const noun = tokens[i - 1].lower;
      if (m.from === i + 1 && m.resolved.length === 1 && !noun.endsWith('s')) {
        const obj = m.resolved[0], kind = W.entity.get(obj)?.kind;
        if ((kind === 'place' || kind === 'faction') && chapter != null) {
          const who = holdersAt(W, obj, 'rule', chapter).map((x) => x.person);
          const strong = TITLE.has(noun);
          for (const id of who) add(id, (strong ? 0.95 : 0.4) / who.length, strong ? 'title' : 'title?');
          if (who.length === 1 && strong) note(i, who[0]);
          if (!who.length && strong) unsure.push({ kind: 'title', at: i, obj, noun });
        }
      }
      continue;
    }
    // a pronoun
    if (Object.prototype.hasOwnProperty.call(PRONOUNS, t.lower)) {
      const id = latest(i, PRONOUNS[t.lower]);
      if (id) { add(id, 0.9, 'pronoun'); note(i, id); }
    }
  }
  return { ents, mentions, unsure, persons: persons.map(({ at, id }) => ({ at, id })) };
}
