// Their dream world, kept on this TV: every night they tell, what came in it and how it felt to
// them, why, what is still unresolved, and what their reactions to the tellings have taught. It
// runs on the engine (engine/dreams/world.mjs). Only the slice a night needs leaves the TV, with
// the telling; the guide service keeps none of it.
//
// Where it is kept, so that no night of it is ever lost, silently or otherwise (`keepWorld`):
// - in localStorage, quick to read back but small: about five million characters for the whole
//   TV, every painter's world together (Chromium's limit; measured, 5,226,496);
// - every night it tells, in IndexedDB as well, with the paintings (paintings.js createNights),
//   where there is far more room: the world holds its last 120 nights, and the guide reads the older
//   ones there;
// - short of room in localStorage (NEAR full, or the world didn't fit), the world holds only its last
//   FEW nights, once the rest are kept in IndexedDB; if it still doesn't fit, the world itself is
//   kept in IndexedDB (createWorlds), and read from there, until it fits again;
// - and if neither will take it, the TV says so, and tries again the next time it keeps it.
import { createDreamWorld } from './engine/dreams/world.mjs';

const KEY = 'inkwash.world', SITTER = 'inkwash.sitter';
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export const ROOM = 5000000, NEAR = 0.8, FEW = 30;

// Each copy of a world carries when it was kept (`kept`, first), so that of two copies, in
// localStorage and in IndexedDB, the later one is read
const stamps = new Map();
const stampOf = (raw) => { const m = /^\{"kept":(\d+)/.exec(raw || ''); return m ? Number(m[1]) : 0; };
function serialize(world, key) {
  const kept = Math.max(Date.now(), (stamps.get(key) || 0) + 1);
  stamps.set(key, kept);
  const { kept: _, ...S } = world.toJSON();
  return JSON.stringify({ kept, ...S });
}
// The worlds kept in IndexedDB because they did not fit, as read when the TV started (loadApart):
// their JSON by key, a map for each localStorage
const aparts = new WeakMap(), none = {};
const apartOf = (storage) => { const k = storage || none; if (!aparts.has(k)) aparts.set(k, new Map()); return aparts.get(k); };
let apartStore = null;

// `key`: whose world (family.js keeps one a painter)
// A world that can't be read (cut short as it was written) opens empty, and what was kept is set
// aside under `<key>.unread`, never written over, so it can still be got back.
export function loadWorld(storage = store(), key = KEY) {
  let raw = null;
  try {
    raw = apartOf(storage).get(key) ?? (storage && storage.getItem(key));
    if (raw) stamps.set(key, Math.max(stamps.get(key) || 0, stampOf(raw)));
    return createDreamWorld(raw ? JSON.parse(raw) : null);
  } catch {
    try { if (raw && storage && storage.getItem(`${key}.unread`) == null) storage.setItem(`${key}.unread`, raw); } catch { /* no room: it stays where it was until the next save */ }
    return createDreamWorld();
  }
}

// Into localStorage, at once: false if it would not fit
export function saveWorld(world, storage = store(), key = KEY) {
  try { storage.setItem(key, serialize(world, key)); } catch { return false; }
  // it fits again: the copy kept apart is no longer needed
  if (apartOf(storage).delete(key) && apartStore) apartStore.drop(key).catch(() => {});
  return true;
}

// When the TV starts: the worlds kept in IndexedDB (`worlds`, paintings.js createWorlds) that are
// later than their copy in localStorage are read from there from now on; the rest are let go.
// The keys of those read from there.
export async function loadApart(worlds, storage = store()) {
  apartStore = worlds;
  const all = await worlds.all().catch(() => []);
  for (const [key, json] of all) {
    let here = null;
    try { here = storage && storage.getItem(key); } catch { here = null; }
    if (stampOf(json) > stampOf(here)) apartOf(storage).set(key, json);
    else worlds.drop(key).catch(() => {});
  }
  return [...apartOf(storage).keys()];
}
// the keys of the worlds read from IndexedDB, because they do not fit in localStorage
export const apartKeys = (storage = store()) => [...apartOf(storage).keys()];

// How full localStorage is: what is kept there (keys and values, in characters) against ROOM
export function roomOf(storage = store(), quota = ROOM) {
  if (!storage) return null;
  let used = 0;
  try {
    for (let i = 0; i < storage.length; i++) { const k = storage.key(i); used += k.length + (storage.getItem(k) || '').length; }
  } catch { return null; }
  return { used, quota, share: Math.round((used / quota) * 1000) / 1000 };
}

// Keep a world (see the top of this file): into localStorage at once, then the rest in turn, one
// keeping at a time for each world. `archive`: where every night is kept (createNights); `worlds`:
// where a world that doesn't fit is kept (createWorlds; the one loadApart was given, if left out).
// Resolves to where the world is kept, 'here' (localStorage), 'apart' (IndexedDB) or null (not
// yet: neither would take it), and how full localStorage is.
const keeping = new Map();
export function keepWorld(world, key = KEY, { storage = store(), archive = null, worlds = null, near = NEAR, few = FEW, quota = ROOM } = {}) {
  saveWorld(world, storage, key);
  const turn = (keeping.get(key) || Promise.resolve()).then(() => settle(world, key, { storage, archive, worlds: worlds || apartStore, near, few, quota }));
  keeping.set(key, turn.catch(() => {}));
  return turn;
}
async function settle(world, key, { storage, archive, worlds, near, few, quota }) {
  // the latest nights are kept apart as well, every time: they change as they are heard again or carried on
  if (archive) await archive.putMany(world.nights.slice(-3)).catch(() => {});
  let here = saveWorld(world, storage, key);
  const room = roomOf(storage, quota);
  if (archive && world.nights.length > few && (!here || (room && room.share >= near))) {
    // short of room: the world lets its older nights go, once they are kept apart
    const kept = await archive.putMany(world.nights.slice(0, -few)).then(() => true, () => false);
    if (kept) { world.trimNights(few); here = saveWorld(world, storage, key); }
  }
  if (here) return { kept: 'here', room: roomOf(storage, quota) };
  // still no room: the world is kept in IndexedDB, and read from there until it fits
  if (worlds) {
    const json = serialize(world, key);
    if (await worlds.put(key, json).then(() => true, () => false)) {
      apartOf(storage).set(key, json);
      return { kept: 'apart', room: roomOf(storage, quota) };
    }
  }
  return { kept: null, room: roomOf(storage, quota) };
}

// A world as it was kept (for the demo family), its nights moved to the days before `now`, one
// every `apart` days, the last of them `apart` days ago
export function putWorld(saved, key, { storage = store(), now = Date.now(), apart = 2 } = {}) {
  const w = JSON.parse(JSON.stringify(saved));
  (w.nights || []).forEach((n, i, all) => { n.at = now - (all.length - i) * apart * 86400000; if (n.ending) n.ending.at = n.at + 600000; });
  try { storage.setItem(key, JSON.stringify(w)); return true; } catch { return false; }
}

// What to tell the grown-ups on the seals when the TV is short of room, or null. `room`: roomOf();
// `disk`: how full the TV's larger store is (the browser's estimate, 0 to 1); `apart`: how many
// worlds are kept there because they no longer fit; `unkept`: whether a world couldn't be kept at
// all. `alarm`: something to do.
export function roomSays({ room = null, disk = null, apart = 0, unkept = false } = {}) {
  const pct = (x) => `${Math.min(100, Math.round(x * 100))}%`;
  if (unkept) return { alarm: true, text: 'This TV is out of room, so the last drawing isn’t kept yet. Free up some space on the TV: Inkwash keeps trying while it is open.' };
  if (disk != null && disk >= 0.85) return { alarm: true, text: `This TV is nearly out of room (${pct(disk)} full). Free up some space on it, so everything can be kept.` };
  if (apart) return { alarm: false, text: `The TV’s quick memory for worlds is full, so ${apart === 1 ? 'one world is' : `${apart} worlds are`} kept in its larger store instead. Nothing is lost.` };
  if (room && room.share >= NEAR) return { alarm: false, text: `The TV’s quick memory for worlds is ${pct(room.share)} full. As it fills, older chapters move to its larger store, so nothing is lost.` };
  return null;
}

// Tonight's slice: what of their world is in this painting (named in their words, or a mark shaped
// and placed like one a thing came as before), and what the telling needs of it. Each thing
// recognised carries the mark like it (`n`) and whether their words named it (`said`).
export function tonightOf(world, { strokes = [], words = [] } = {}) {
  const texts = words.map((w) => w.text);
  const cast = world.recognize({ strokes, words: texts });
  const { manifest, ...slice } = world.slice({ cast: cast.map((x) => x.id), words: texts });
  slice.things = slice.things.map((t) => { const r = cast.find((x) => x.id === t.id); return r ? { ...t, n: r.n, said: r.said } : t; });
  return slice;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const times = (n) => (n === 2 ? 'twice' : `${n} times`);

// What the storyteller says when they come back: which chapter this is, whether they painted what
// happened next last time, what keeps coming and how it has been feeling, what is still unresolved. On the
// first night, hello by name if it has one, else null.
export function welcomeOf(world, { name = null } = {}) {
  const s = world.summary();
  if (!s.nights) return name ? `Hello, ${name}.` : null;
  const out = [`Welcome back${name ? `, ${name}` : ''}. This is chapter ${s.nights + 1} of your world.`];
  // what they painted next, last time
  if (s.last && s.last.ending) out.push('Last time, you drew what happened next.');
  const r = s.recurring[0];
  // said so for any name, one thing or many (the hidden rooms have come twice)
  if (r) out.push(`${cap(r.name)} has come ${times(r.nights)}${r.trend ? `, ${r.trend} the last time` : ''}.`);
  const open = s.open.length ? s.open[s.open.length - 1].split(':')[0] : null;
  // said so for any name, singular or not, and for a child too
  if (open && (!r || open !== r.name)) out.push(`There is more to find out about ${open}.`);
  else if (open) out.push('There is more to find out about it.');
  return out.join(' ');
}

// What a chapter kept, said back plainly: "New in your world: the path and the lantern. Back again:
// the stopped clock. Let go: my brother." The engine marks each kept thing "(new)" or with how many
// chapters it has come in; that is said as which group it is in, never in brackets. What they
// drew next says so once: "New in your world from what happened next: the ladder."
const listed = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
export function keptOf(r) {
  if (!r) return null;
  const from = r.next ? ' from what happened next' : '', fresh = [], back = [], plain = [];
  for (const k of r.kept) {
    const m = /^(.*?) \((new|a second chapter|a third chapter|\d+ chapters)\)$/.exec(k);
    if (!m) plain.push(k); else if (m[2] === 'new') fresh.push(m[1]); else back.push(m[1]);
  }
  const parts = [];
  if (fresh.length) parts.push(`New in your world${from}: ${listed(fresh)}.`);
  if (back.length) parts.push(`Back again${fresh.length ? '' : from}: ${listed(back)}.`);
  if (plain.length) parts.push(`${fresh.length || back.length ? 'Kept too' : `Kept in your world${from}`}: ${listed(plain)}.`);
  if (r.turnedDown.length) parts.push(`Let go: ${listed(r.turnedDown)}.`);
  return parts.length ? parts.join(' ') : 'Kept in your world.';
}

// An anonymous id for this TV, made here and never sent anywhere but the guide (as part of a
// telling's seed), so that two people who paint alike still get different tellings.
export function sitter(storage = store()) {
  try {
    let s = storage.getItem(SITTER);
    if (!s) { s = Math.random().toString(36).slice(2, 12); storage.setItem(SITTER, s); }
    return s;
  } catch { return 'tv'; }
}
