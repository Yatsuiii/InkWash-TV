// The same paid request is never paid twice. A TV on a poor connection asks again when an answer
// is slow to come; a picture, a world or a clip asked for twice is still one picture, world or clip.
// Each paid request is known by what was asked (its path and body, hashed): asked again while the
// first is still being made, it waits for that one; asked again within `ttl` of being answered, it
// is answered with the same. Only an answer that was made is kept (not one turned down, or none
// left today), at most `most` of them, the oldest let go first, and nothing past `ttl`. Kept in
// memory only, on the one running server (a warm Lambda): never written anywhere, and gone with it.
//
//   const once = createOnce();
//   const r = await once.run(path, body, () => handle(path, body, ...));   // { status, json }
import { createHash } from 'node:crypto';

export const ONCE = { ttl: 10 * 60 * 1000, most: 16, paths: ['/real', '/thing', '/backdrop', '/compose', '/wide', '/world', '/alive', '/scene'] };

// an answer worth keeping: made, not turned down, not one there was none of today
const made = (r) => r && r.status === 200 && r.json && typeof r.json === 'object' && !r.json.error && !r.json.off && !r.json.blocked && !r.json.today;

export function createOnce({ ttl = ONCE.ttl, most = ONCE.most, paths = ONCE.paths, now = () => Date.now() } = {}) {
  const want = new Set(paths);
  const kept = new Map(); // key -> { at, r } once answered, { p } while it is being made
  const keyOf = (path, body) => createHash('sha256').update(path).update('\u0000').update(JSON.stringify(body ?? null)).digest('hex');
  const forget = () => {
    for (const [k, v] of kept) if (v.r && now() - v.at > ttl) kept.delete(k);
    for (const [k, v] of kept) { if (kept.size <= most) break; if (v.r) kept.delete(k); }
  };
  let saved = 0;
  return {
    async run(path, body, make) {
      if (!want.has(path)) return make();
      const key = keyOf(path, body);
      forget();
      const had = kept.get(key);
      if (had && had.r) { saved++; return { ...had.r, json: { ...had.r.json, again: true } }; }
      if (had && had.p) { saved++; const r = await had.p; return made(r) ? { ...r, json: { ...r.json, again: true } } : r; }
      const p = Promise.resolve().then(make);
      kept.set(key, { p });
      try {
        const r = await p;
        if (made(r)) { kept.delete(key); kept.set(key, { at: now(), r }); } else kept.delete(key);
        return r;
      } catch (err) {
        kept.delete(key);
        throw err;
      }
    },
    // how many asked again were answered without paying again, and how many answers are kept
    get saved() { return saved; },
    get size() { return kept.size; },
  };
}
