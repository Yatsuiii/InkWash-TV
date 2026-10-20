// Copied from inkwash/engine/personal/commons.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// What everyone else's tellings reach for: how often each image appears, across all tellings, so
// a new telling can be steered away from the ones everybody gets.
//
// Private by construction:
// - no text and no person is kept, only counts;
// - an image is kept as a salted hash until enough tellings have used it (`k`), so a rare image
//   (a grandmother's name, a private place) is never kept in a form anyone can read;
// - only images used in a large share of tellings are ever said back, and only as something to
//   avoid, never as a suggestion.
import crypto from 'node:crypto';

// The key an image is kept under: a salted hash, so it can't be read back by guessing words
// without the salt.
export const imageKey = (salt, m) => crypto.createHmac('sha256', salt).update(m).digest('hex').slice(0, 20);

export function createCommons({ salt = 'inkwash-commons', k = 10, minTellings = 20, minShare = 0.08 } = {}, saved = null) {
  const counts = new Map(saved?.counts || []); // hash -> tellings using it
  const names = new Map(saved?.names || []); // hash -> the image, once it is common enough to read
  let tellings = saved?.tellings || 0;
  const h = (m) => imageKey(salt, m);
  const count = (m) => counts.get(h(m)) || 0;
  return {
    add(motifs) {
      tellings++;
      for (const m of new Set(motifs)) {
        const key = h(m), n = (counts.get(key) || 0) + 1;
        counts.set(key, n);
        if (n >= k) names.set(key, m);
      }
    },
    tellings: () => tellings,
    share: (m) => (tellings ? count(m) / tellings : 0),
    // the images most tellings use, once there are enough tellings to say so
    cliches(n = 8) {
      if (tellings < minTellings) return [];
      return [...names].map(([key, m]) => [m, counts.get(key) / tellings]).filter(([, s]) => s >= minShare).sort((a, b) => b[1] - a[1]).slice(0, n).map(([m]) => m);
    },
    // how unusual a telling's images are, 0 (what everyone gets) to 1 (never seen)
    novelty(motifs) {
      const ms = [...new Set(motifs)];
      if (!ms.length || tellings < minTellings) return 0.5;
      const top = Math.log(tellings + 2);
      return ms.reduce((a, m) => a + Math.log((tellings + 2) / (count(m) + 1)) / top, 0) / ms.length;
    },
    toJSON: () => ({ tellings, counts: [...counts], names: [...names] }),
  };
}
