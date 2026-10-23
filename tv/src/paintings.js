// What the TV keeps in IndexedDB, which holds far more than the few megabytes of localStorage:
// - each night's painting, so the guide can look back at it: the picture (a JPEG, 768 wide, as the
//   guide saw it) and its strokes (`createPaintings`);
// - every night of their dream world (`createNights`). A world holds its last 120 nights in
//   localStorage (world.js); each night it tells is kept here too, as it is kept, so none is ever
//   forgotten, and the guide's tools read the older ones here;
// - a world that no longer fits in localStorage (`createWorlds`), until it does (world.js).
// In memory where there is no IndexedDB (and in the tests). `who` keeps each painter's apart
// (family.js): their nights are keyed "who:night"; the first painter's, by the night alone, as a
// single-painter TV kept them.

const DB = 'inkwash', VERSION = 2, STORES = ['paintings', 'nights', 'worlds'];
// Where a painter's world stands, painted (main.js placeOf): kept among their paintings as night 0,
// which no night is: { image, sign, at }
export const PLACE = 0;
// their world painted as one (compose.js), and their world's map painted (worldmap.js), each kept
// where no night is, nor any thing (a thing made real is kept as minus its number, e1 as -1):
// { image, sign, at }
export const COMPOSED = -0.5;
export const MAPPED = -0.25;

// one connection for all three, opened once
const opened = new WeakMap();
function openDb(idb) {
  if (!opened.has(idb)) {
    opened.set(idb, new Promise((ok, fail) => {
      const req = idb.open(DB, VERSION);
      req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); };
      req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); ok(req.result); };
      req.onerror = () => fail(req.error);
    }).catch((err) => { opened.delete(idb); throw err; }));
  }
  return opened.get(idb);
}
// a transaction on one store: `f` makes its requests and returns the one whose result is wanted;
// settled when the transaction is, so what was written is written
async function run(idb, store, mode, f) {
  const d = await openDb(idb);
  return new Promise((ok, fail) => {
    const tx = d.transaction(store, mode);
    const req = f(tx.objectStore(store));
    tx.oncomplete = () => ok(req ? req.result : undefined);
    tx.onerror = tx.onabort = () => fail(tx.error || (req && req.error));
  });
}
const keyOf = (who) => (k) => (who ? `${who}:${Number(k)}` : Number(k));
// all of one painter's keys: theirs by name, or the first painter's numbers
const allOf = (who) => (who ? IDBKeyRange.bound(`${who}:`, `${who}:￿`) : IDBKeyRange.bound(-Infinity, Infinity));

export function memoryPaintings() {
  const m = new Map();
  return { get: async (k) => m.get(Number(k)) || null, put: async (k, p) => { m.set(Number(k), p); }, drop: async (k) => { m.delete(Number(k)); }, size: () => m.size };
}

export function createPaintings(idb = globalThis.indexedDB, who = '') {
  if (!idb) return memoryPaintings();
  const key = keyOf(who);
  const fallback = memoryPaintings();
  return {
    async get(k) { try { return (await run(idb, 'paintings', 'readonly', (s) => s.get(key(k)))) || null; } catch { return fallback.get(k); } },
    async put(k, p) { try { await run(idb, 'paintings', 'readwrite', (s) => s.put(p, key(k))); } catch { await fallback.put(k, p); } },
    async drop(k) { try { await run(idb, 'paintings', 'readwrite', (s) => s.delete(key(k))); } catch { /* nothing kept there */ } await fallback.drop(k); },
  };
}

// Every night of a painter's dream world, as the world keeps it (world.toJSON().nights). A night
// put again replaces the one kept: the latest nights change as they are heard again or carried on.
// `putMany` fails if they could not be kept: a world lets a night go only once it is kept here.
export function memoryNights() {
  const m = new Map();
  return {
    get: async (n) => m.get(Number(n)) || null,
    putMany: async (nights) => { for (const x of nights || []) if (x && Number.isFinite(x.n)) m.set(x.n, JSON.parse(JSON.stringify(x))); },
    all: async () => [...m.values()].sort((a, b) => a.n - b.n),
    size: () => m.size,
  };
}

export function createNights(idb = globalThis.indexedDB, who = '') {
  if (!idb) return memoryNights();
  const key = keyOf(who);
  return {
    async get(n) { try { return (await run(idb, 'nights', 'readonly', (s) => s.get(key(n)))) || null; } catch { return null; } },
    async putMany(nights) {
      const ns = (nights || []).filter((x) => x && Number.isFinite(x.n));
      if (ns.length) await run(idb, 'nights', 'readwrite', (s) => { ns.forEach((x) => s.put(x, key(x.n))); return null; });
    },
    async all() { try { return ((await run(idb, 'nights', 'readonly', (s) => s.getAll(allOf(who)))) || []).sort((a, b) => a.n - b.n); } catch { return []; } },
  };
}

// The worlds that no longer fit in localStorage, by the key they would be kept under there
// (family.js worldKey): their JSON
export function memoryWorlds() {
  const m = new Map();
  return { all: async () => [...m.entries()], put: async (k, json) => { m.set(k, json); }, drop: async (k) => { m.delete(k); }, size: () => m.size };
}

export function createWorlds(idb = globalThis.indexedDB) {
  if (!idb) return memoryWorlds();
  return {
    async all() {
      const d = await openDb(idb);
      return new Promise((ok, fail) => {
        const tx = d.transaction('worlds', 'readonly'), s = tx.objectStore('worlds'), ks = s.getAllKeys(), vs = s.getAll();
        tx.oncomplete = () => ok(ks.result.map((k, i) => [k, vs.result[i]]));
        tx.onerror = tx.onabort = () => fail(tx.error);
      });
    },
    put: (k, json) => run(idb, 'worlds', 'readwrite', (s) => s.put(json, k)),
    drop: (k) => run(idb, 'worlds', 'readwrite', (s) => s.delete(k)),
  };
}
