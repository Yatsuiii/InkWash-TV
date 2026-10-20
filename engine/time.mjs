// Story time: chapter ordinals. A fact is true from `from` (inclusive) until `to` (exclusive), and
// secret until `secretUntil`.

export const validAt = (f, ch) => (f.from == null || ch >= f.from) && (f.to == null || ch < f.to);
export const knownAt = (f, ch) => validAt(f, ch) && (f.secretUntil == null || ch >= f.secretUntil);
// Whether someone in the story knows a fact in chapter `ch`. Anyone may, unless the fact says who
// does (`knownBy: [{ who, from }]`), each from a chapter (`from` null: from the start).
export const knowsAt = (f, who, ch) => !Array.isArray(f.knownBy) || f.knownBy.some((k) => k.who === who && (k.from == null || ch == null || ch >= k.from));

// Who holds `obj` (rules it: 'rule'; has it: 'possess') in chapter `ch`.
export function holdersAt(W, obj, kind, ch) {
  const h = W.holders.get(obj);
  if (!h) return [];
  return h[kind].filter((t) => (t.from == null || ch >= t.from) && (t.to == null || ch < t.to));
}

export function aliveAt(W, person, ch) {
  const d = W.deathOf.get(person);
  return !d || ch < d.at;
}
