// What a person's own earlier tellings used: kept on their device (or in their account, if they
// choose), never in the commons. So a new telling doesn't repeat their last ones, and an image
// that keeps coming back in their dreams, or one they named themselves, can be returned to, on
// purpose.
import { jaccard } from './motifs.mjs';

export function createHistory(saved = [], { keep = 30 } = {}) {
  const list = (Array.isArray(saved) ? saved : []).filter((x) => x && Array.isArray(x.motifs)).slice(-keep);
  return {
    list,
    // how much a telling repeats their recent ones, 0 to 1
    repeats(motifs, last = 5) {
      const recent = new Set(list.slice(-last).flatMap((x) => x.motifs));
      return recent.size ? jaccard(motifs, recent) : 0;
    },
    lensesUsed: (last = 4) => new Set(list.slice(-last).map((x) => x.lens).filter(Boolean)),
    // images that keep coming back in their dreams: in two or more tellings
    symbols(n = 3) {
      const c = new Map();
      for (const x of list) for (const m of new Set(x.motifs)) c.set(m, (c.get(m) || 0) + 1);
      return [...c].filter(([, k]) => k >= 2).sort((a, b) => b[1] - a[1]).slice(0, n).map(([m]) => m);
    },
    recent: (last = 3) => [...new Set(list.slice(-last).flatMap((x) => x.motifs))],
    // what they named at the turn of their past dreams, most recent first, each once
    named: (last = 10) => [...new Set(list.slice(-last).reverse().map((x) => x.said).filter(Boolean))],
    add(entry) {
      list.push({ at: entry.at || null, feeling: entry.feeling || null, lens: entry.lens || null, shape: entry.shape || null, said: entry.said || null, motifs: [...entry.motifs] });
      while (list.length > keep) list.shift();
    },
    toJSON: () => list,
  };
}
