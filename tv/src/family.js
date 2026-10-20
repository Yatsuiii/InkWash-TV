// Who paints on this TV. A family shares one TV, and each painter keeps a dream world of their own:
// their nights, their things, what their tellings taught, how they usually paint and mark the
// dial. Each painter chooses a seal, the red stamp a painter signs a painting with, and says who
// the guide is talking to: a grown-up, or a child (the guide then speaks simply and gently, and
// adds nothing frightening). Typing a name with a remote is a chore, so the seal is the name.
//
// Kept in localStorage, beside the worlds. The first painter keeps the storage a single-painter
// TV already used ('inkwash.world', and paintings by night number), so a world painted before
// there were painters opens as theirs, untouched. The demo family (demo-family.js) is kept apart,
// under its own names, and never saved as the TV's family. Pure, apart from the storage it is given.

const KEY = 'inkwash.family';
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };

// Pictograms on a 100 x 100 grid, cut into the seal: white on cinnabar.
const S = 'fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';
export const SEALS = [
  { id: 'moon', name: 'Moon', svg: '<path fill="currentColor" d="M60 14a37 37 0 1 0 0 72a29 29 0 1 1 0-72z"/>' },
  { id: 'mountain', name: 'Mountain', svg: `<path ${S} d="M10 80 L38 30 L54 56 L66 40 L90 80 Z"/>` },
  { id: 'wave', name: 'Wave', svg: `<path ${S} d="M12 44 q12-16 25 0 t25 0 t25 0 M12 66 q12-16 25 0 t25 0 t25 0"/>` },
  { id: 'star', name: 'Star', svg: '<path fill="currentColor" d="M50 10 L61 38 L91 39 L67 57 L76 87 L50 70 L24 87 L33 57 L9 39 L39 38 Z"/>' },
  { id: 'bird', name: 'Bird', svg: `<path ${S} d="M10 46 Q24 30 38 40 Q46 46 50 58 Q54 46 62 40 Q76 30 90 46"/>` },
  { id: 'leaf', name: 'Leaf', svg: `<path ${S} d="M22 80 C22 42 46 20 82 18 C82 54 60 80 22 80 Z M22 80 L60 40"/>` },
  { id: 'fish', name: 'Fish', svg: `<path ${S} d="M14 50 C30 28 58 28 72 50 C58 72 30 72 14 50 Z M72 50 L90 34 L90 66 Z"/><circle cx="34" cy="46" r="4.5" fill="currentColor"/>` },
  { id: 'sun', name: 'Sun', svg: `<circle cx="50" cy="50" r="17" fill="currentColor"/><path ${S} d="M50 12v10M50 78v10M12 50h10M78 50h10M23 23l7 7M70 70l7 7M77 23l-7 7M30 70l-7 7"/>` },
];
export const sealOf = (id) => SEALS.find((s) => s.id === id) || SEALS[0];
export const sealSvg = (id, size = 96) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${sealOf(id).svg}</svg>`;

const clean = (p) => p && typeof p === 'object' && typeof p.id === 'string' && /^[a-z0-9]{1,16}$/.test(p.id) && SEALS.some((s) => s.id === p.seal)
  ? { id: p.id, seal: p.seal, young: p.young === true, first: p.first === true, added: Number(p.added) || 0 }
  : null;

// The painters on this TV, and who painted last. A TV that has a world from before there were
// painters gets its first painter, for that world.
export function loadFamily(storage = store()) {
  let raw = null;
  try { raw = storage && JSON.parse(storage.getItem(KEY) || 'null'); } catch { raw = null; }
  // (one painter to an id and to a seal: two with one id would share a world)
  const painters = [];
  for (const p of (raw && Array.isArray(raw.painters) ? raw.painters : []).map(clean)) {
    if (p && painters.length < SEALS.length && !painters.some((q) => q.id === p.id || q.seal === p.seal)) painters.push(p);
  }
  let had = false;
  try { had = !!(storage && storage.getItem('inkwash.world')); } catch { had = false; }
  if (!painters.length && had) painters.push({ id: 'p1', seal: 'moon', young: false, first: true, added: 0 });
  const last = raw && painters.some((p) => p.id === raw.last) ? raw.last : painters[0] ? painters[0].id : null;
  return { painters, last };
}

export function saveFamily(family, storage = store()) {
  try { storage.setItem(KEY, JSON.stringify({ painters: family.painters, last: family.last })); return true; } catch { return false; }
}

// The seals not yet taken, in order
export const freeSeals = (family) => SEALS.filter((s) => !family.painters.some((p) => p.seal === s.id));

// A new painter, with the seal they chose: the first on a TV keeps the storage a single painter
// used. Null when the seal is taken, or there are no seals left.
export function addPainter(family, { seal, young = false, now = Date.now() } = {}) {
  if (!freeSeals(family).some((s) => s.id === seal)) return null;
  let k = family.painters.length + 1;
  while (family.painters.some((p) => p.id === `p${k}`)) k++;
  const p = { id: `p${k}`, seal, young: young === true, first: !family.painters.length && !family.demo, added: now, ...(family.demo ? { demo: true } : {}) };
  family.painters.push(p);
  family.last = p.id;
  return p;
}

export function choose(family, id) {
  if (family.painters.some((p) => p.id === id)) family.last = id;
  return family.painters.find((p) => p.id === family.last) || null;
}

// Where a painter's world and paintings are kept
export const worldKey = (p) => (p && p.demo ? `inkwash.demo.world.${p.id}` : !p || p.first ? 'inkwash.world' : `inkwash.world.${p.id}`);
export const paintingsKey = (p) => (p && p.demo ? `demo-${p.id}` : !p || p.first ? '' : p.id);

// The demo family, from what demo-family.js kept: its painters, apart from the TV's own
export const demoFamily = (data) => ({ demo: true, painters: data.painters.map((p) => ({ id: p.id, seal: p.seal, young: !!p.young, first: false, added: 0, demo: true })), last: data.painters[0].id });

// How a painter is shown: "Moon", "Moon, 3 nights", for the picker
export function describe(p, nights = 0) {
  const name = sealOf(p.seal).name;
  return { name, about: [nights ? `${nights} ${nights === 1 ? 'chapter' : 'chapters'}` : 'new', p.young ? 'a child' : null].filter(Boolean).join(' · ') };
}
