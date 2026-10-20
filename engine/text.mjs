// Words, the way the engine reads them: tokens with their places in the text (a possessive "'s"
// is noted and dropped, so "Alaed's" is Alaed), terms for search, and BM25.

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

// [{ w, lower, start, end, poss }]: `w` as written, without a possessive ending.
export function tokenize(text) {
  const out = [];
  for (const m of String(text).matchAll(WORD)) {
    let w = m[0], poss = false;
    if (/['’]s$/i.test(w)) { w = w.slice(0, -2); poss = true; } else if (/s['’]$/.test(w)) { w = w.slice(0, -1); poss = true; }
    out.push({ w, lower: w.toLowerCase(), start: m.index, end: m.index + m[0].length, poss });
  }
  return out;
}

export const STOP = new Set(('a an the and or but if then than so as of in on at to from by with without for into onto upon over under about after before when while where who whom whose which what that this these those is are was were be been being am has have had do does did not no nor can could will would shall should may might must it its he him his she her hers herself himself they them their we us our you your i me my one there here also only just very too more most less some any all each every own same such up down out off again once ever never always still yet now like through').split(' '));

export function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  return w;
}

export function terms(text) {
  const out = [];
  for (const t of tokenize(text)) if (t.lower.length >= 2 && !STOP.has(t.lower)) out.push(stem(t.lower));
  return out;
}

// BM25 over [{ id, text }]. `search(query, limit)` -> [{ id, score }], best first.
export function bm25(docs, { k1 = 1.2, b = 0.75 } = {}) {
  const postings = new Map();
  const lens = new Float64Array(docs.length);
  docs.forEach((d, i) => {
    const ts = terms(d.text);
    lens[i] = ts.length;
    const tf = new Map();
    for (const t of ts) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, n] of tf) { let p = postings.get(t); if (!p) postings.set(t, (p = [])); p.push(i, n); }
  });
  const N = docs.length, avg = lens.reduce((a, x) => a + x, 0) / Math.max(1, N);
  return {
    search(query, limit = Infinity, skip = null) {
      const scores = new Map();
      for (const t of new Set(terms(query))) {
        if (skip && skip.has(t)) continue;
        const p = postings.get(t);
        if (!p) continue;
        const df = p.length / 2;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        for (let j = 0; j < p.length; j += 2) {
          const i = p[j], tf = p[j + 1];
          scores.set(i, (scores.get(i) || 0) + idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * lens[i]) / avg))));
        }
      }
      const out = [...scores].sort((x, y) => y[1] - x[1]);
      return (limit < out.length ? out.slice(0, limit) : out).map(([i, s]) => ({ id: docs[i].id, score: s }));
    },
  };
}
