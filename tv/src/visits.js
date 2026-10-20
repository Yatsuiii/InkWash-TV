// Worlds that meet. A family shares one TV, and each painter keeps a world of their own; a thing of
// one painter's world can go to visit another's. Its painter sends it (only they can: it is theirs),
// and either of them can send it home. While it visits it stands in the world it visits, with a
// card that says where it is from, and the storyteller there may bring it into the story; it stays
// in its own world too, its card saying where it has gone.
//
// A visit keeps no copy of the thing: its name, what is true of it, its strokes and its picture are
// read from its own world each time, so a thing forgotten there is gone from every visit with it.
// A thing whose name would frighten a child never visits a child's world, and what a child's
// storyteller hears of a visitor is held to the same: nothing frightening.
//
// Kept beside the family (the demo family's apart, like everything else of it). Pure, apart from
// the storage it is given.
import { frightIn } from './engine/dreams/gentle.mjs';

const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export const visitsKey = (family) => (family && family.demo ? 'inkwash.demo.visits' : 'inkwash.visits');
// the most things visiting one world at once
export const VISITORS_AT_ONCE = 3;

const ID = /^[a-z0-9]{1,16}$/, THING = /^e\d{1,6}$/;
const clean = (v) => (v && typeof v === 'object' && THING.test(v.thing) && ID.test(v.from) && ID.test(v.to) && v.from !== v.to
  ? { thing: v.thing, from: v.from, to: v.to, at: Number(v.at) || 0 } : null);

export function loadVisits(key, storage = store()) {
  let raw = null;
  try { raw = storage && JSON.parse(storage.getItem(key) || 'null'); } catch { raw = null; }
  return (Array.isArray(raw) ? raw : []).map(clean).filter(Boolean);
}
export function saveVisits(visits, key, storage = store()) {
  try { storage.setItem(key, JSON.stringify(visits)); return true; } catch { return false; }
}

export const visitOf = (visits, from, thing) => visits.find((v) => v.from === from && v.thing === thing) || null;
export const visitorsIn = (visits, to) => visits.filter((v) => v.to === to).sort((a, b) => a.at - b.at);

// Whether a thing of one world may visit another: `thing` { name, status }, `host` the painter it
// would visit, `names` the names of the things already in the world it would visit (a world never
// holds two things of one name: whose moon would it be?). { ok, why }
const nameOf = (n) => String(n || '').toLowerCase().replace(/^\s*(the|a|an|my)\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function canVisit(thing, host, visits = [], from = null, { names = [] } = {}) {
  if (!thing || !host || thing.status === 'rejected') return { ok: false, why: 'gone' };
  if (host.young && frightIn(String(thing.name || '')).length) return { ok: false, why: 'frightening' };
  if (names.some((n) => nameOf(n) === nameOf(thing.name))) return { ok: false, why: 'same name' };
  const there = visitorsIn(visits, host.id).filter((v) => !(v.from === from && v.thing === thing.id));
  if (there.length >= VISITORS_AT_ONCE) return { ok: false, why: 'full' };
  return { ok: true, why: null };
}

// Send a thing to visit `to`: a thing visits one world at a time, so it leaves any other first.
export function send(visits, { thing, from, to, now = Date.now() }) {
  const v = clean({ thing, from, to, at: now });
  if (!v) return visits;
  return [...visits.filter((x) => !(x.from === from && x.thing === thing)), v];
}
export const sendHome = (visits, { thing, from }) => visits.filter((x) => !(x.from === from && x.thing === thing));

// Visits whose painters are still on this TV and whose thing is still in its world. `alive(from,
// thing)` says whether that world still has it.
export const prune = (visits, { painters, alive }) => visits.filter((v) => {
  const ids = new Set(painters.map((p) => p.id));
  return ids.has(v.from) && ids.has(v.to) && alive(v.from, v.thing);
});

// What the storyteller in the world it visits hears of it: its name, whose world it is from, and
// what is true of it there (for a child, only what is gentle). `card` is cardsOf's for it in its
// own world; `facts`, what is true of it there, the latest last.
export function visitorBrief(card, { from, facts = [], young = false }) {
  const told = [...new Set([card.lore, ...facts.map((f) => f.text)].filter(Boolean))]
    .filter((t) => !young || !frightIn(t).length).slice(-3);
  return { name: card.name, from: `${from}’s world`, ...(told.length ? { true_of_it: told } : {}) };
}

// Where a visitor stands in the world it visits: as near where it stood in its own world as it can
// be, clear of everything already there, on the sheet. `map` is mapOf's for the world it visits;
// `card` the visitor's card (its box where it first came, in its own world); `r` how big it is.
export function placeVisitor(map, card, { r = 110, W = 1600, H = 1000, margin = 60, gap = 30 } = {}) {
  const want = card.box ? [(card.box[0] + card.box[2]) / 2, (card.box[1] + card.box[3]) / 2] : [W / 2, H / 2];
  const fits = ([x, y]) => x >= margin + r && x <= W - margin - r && y >= margin + r * 0.8 && y <= H - margin - r * 0.8
    && map.nodes.every((n) => Math.hypot(n.x - x, n.y - y) >= n.r + r + gap);
  const onSheet = ([x, y]) => [Math.min(W - margin - r, Math.max(margin + r, x)), Math.min(H - margin - r * 0.8, Math.max(margin + r * 0.8, y))];
  // rings out from where it would stand, nearest first
  for (let d = 0; d <= Math.max(W, H); d += 40) {
    const steps = d ? Math.max(8, Math.round((2 * Math.PI * d) / 60)) : 1;
    for (let k = 0; k < steps; k++) {
      const p = onSheet([want[0] + d * Math.cos((2 * Math.PI * k) / steps), want[1] + d * Math.sin((2 * Math.PI * k) / steps)]);
      if (fits(p)) return { x: Math.round(p[0]), y: Math.round(p[1]), r };
    }
  }
  // a full world: where it would stand, over what is there
  const [x, y] = onSheet(want);
  return { x: Math.round(x), y: Math.round(y), r };
}
