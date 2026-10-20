// Copied from inkwash/engine/names.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// Finding who and what a text names.
//
// Full names match in any case ("salt reach" is Salt Reach). Aliases, first names and surnames
// match only as written, capitalized: "the Hand" may be a faction, "his left hand" is not. The
// longest name wins ("Salt Reach" over "Salt"), and a name can stand for several entities (two
// people called Mara, a family's surname, "the Order"): the mention keeps them all and says how it
// matched, so the resolver can decide, and say it was unsure.
import { tokenize } from './text.mjs';

const stripThe = (tokens) => (tokens.length > 1 && tokens[0].lower === 'the' ? tokens.slice(1) : tokens);

export function createNameIndex(entities) {
  const ci = new Map(); // lower-case key -> [{ id, form }]
  const cs = new Map(); // key as written -> [{ id, form }]
  const firstCi = new Set(), firstCs = new Set(); // the words a name can start with
  let maxLen = 1;
  const add = (map, key, id, form) => {
    (map === ci ? firstCi : firstCs).add(key.split(' ')[0]);
    const a = map.get(key) || [];
    if (!a.some((x) => x.id === id)) a.push({ id, form });
    map.set(key, a);
  };
  for (const e of entities) {
    const name = stripThe(tokenize(e.name));
    if (!name.length) continue;
    maxLen = Math.max(maxLen, name.length);
    add(ci, name.map((t) => t.lower).join(' '), e.id, 'name');
    for (const a of e.aliases || []) {
      const t = stripThe(tokenize(a));
      if (!t.length || (t.length === 1 && t[0].w.length < 3)) continue;
      maxLen = Math.max(maxLen, t.length);
      add(cs, t.map((x) => x.w).join(' '), e.id, 'alias');
    }
    if (e.kind === 'character' && name.length > 1) {
      add(cs, name[0].w, e.id, 'first');
      add(cs, name[name.length - 1].w, e.id, 'last');
    }
  }

  // Mentions in order: { from, to (token indexes, end exclusive), ids, form, poss }.
  function find(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length;) {
      if (!firstCi.has(tokens[i].lower) && !firstCs.has(tokens[i].w)) { i++; continue; }
      let hit = null;
      for (let n = Math.min(maxLen, tokens.length - i); n >= 1 && !hit; n--) {
        const span = tokens.slice(i, i + n);
        // a possessive can only end a name
        if (span.slice(0, -1).some((t) => t.poss)) continue;
        const a = ci.get(span.map((t) => t.lower).join(' ')) || cs.get(span.map((t) => t.w).join(' '));
        if (a) hit = { from: i, to: i + n, ids: a.map((x) => x.id), form: a.length === 1 ? a[0].form : a.map((x) => x.form).sort()[0], forms: a, poss: span[n - 1].poss };
      }
      if (hit) { out.push(hit); i = hit.to; } else i++;
    }
    return out;
  }
  return { find, findText: (text) => { const tokens = tokenize(text); return { tokens, mentions: find(tokens) }; } };
}
