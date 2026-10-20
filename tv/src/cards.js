// The things of their world, as cards to collect, and as a map.
//
// A card is a thing of their dreams (a rocket, the moon castle, a dragon friend): its picture is
// cut from the painting where it first came, as they painted it; with its name, the night it first
// came and how many nights it has come since, whether it came in what they painted next, how it
// felt to them, in their dial's words, and how it looks in their own words, if they have said.
//
// The map of their world lays the things out where they first painted them, places bigger than things,
// pushed apart until none overlap; things that came on the same night are joined by a path.
//
// Both come from the world kept on the TV (world.js); nothing here leaves it. Pure.
import { wordsFor } from './journal.js';

const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null);
const centre = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

// `world`: a world's JSON (world.toJSON()). The cards in the order the things first came.
export function cardsOf(world, { young = false } = {}) {
  const W = wordsFor(young);
  return (world.entities || []).filter((e) => e.status !== 'rejected').map((e) => {
    const all = [...(e.appearances || []).map((a) => ({ ...a, next: false })), ...(e.endings || []).map((a) => ({ ...a, next: true }))]
      .filter((a) => Number.isFinite(a.night)).sort((a, b) => a.night - b.night);
    if (!all.length) return null;
    const first = all.find((a) => a.mark && a.mark.box) || all[0];
    const felt = all.filter((a) => Number.isFinite(a.v));
    const v = mean(felt.map((a) => a.v)), a = mean(felt.map((x) => x.a ?? 0));
    // what is true of it, the latest kept: what they chose for it first, then what was told
    const true_ = (world.facts || []).filter((f) => f.entity === e.id && f.to == null && !f.thread);
    const lore = [...true_].reverse().find((f) => f.source === 'chosen') || true_[true_.length - 1] || null;
    return {
      id: e.id, name: e.name, kind: e.kind || 'thing', look: e.look || null, rule: e.rule || null,
      first: first.night, strokes: first.strokes || [], box: first.mark && first.mark.box ? first.mark.box.slice(0, 4) : null, shape: first.mark ? first.mark.kind : null,
      nights: new Set(all.map((x) => x.night)).size, last: all[all.length - 1].night,
      // every night it came, with the strokes it was, for its portrait
      came: all.map((x) => ({ night: x.night, strokes: x.strokes || [] })),
      next: all.some((x) => x.next), bornNext: all[0].next,
      felt: v == null || W.felt(v, a || 0) === 'even' ? null : W.felt(v, a || 0),
      lore: lore ? lore.text : null, loreChosen: !!lore && lore.source === 'chosen',
      own: e.status === 'confirmed',
      // where it came from, as the TV recorded it (never as the model said): they named it, they
      // kept the storyteller's reading of it with that's it, or it is the storyteller's reading
      origin: all.some((x) => x.source === 'said') ? 'named' : e.status === 'confirmed' ? 'kept' : 'thought',
    };
  }).filter(Boolean).sort((x, y) => x.first - y.first || x.id.localeCompare(y.id, 'en', { numeric: true }));
}

// What a card says under its name: "First came on night 2. Came 3 nights." / "Painted in what
// happened next, on night 2."
export function cardLine(c) {
  const first = c.bornNext ? `Drawn in what happened next, in chapter ${c.first}.` : `First came in chapter ${c.first}.`;
  return c.nights > 1 ? `${first} ${c.nights === 2 ? 'Came back once' : `In ${c.nights} chapters`}.` : first;
}

// Where a thing came from, said on its card
export const cardOrigin = (c) => ({ named: 'You named it.', kept: 'You kept it.', thought: 'The storyteller thought so.' }[c.origin] || '');

// How big a thing is on the map, by what it is: a place is somewhere to be, bigger than a thing
const SIZE = { place: 150, creature: 125, person: 115, thing: 110, feeling: 100 };

// The map. `world`: a world's JSON. Returns `nodes` [{ id, name, kind, x, y, r, nights, first }]
// on a W x H sheet, and `paths` [{ a, b, nights }] between things that came on the same night.
export function mapOf(world, { W = 1600, H = 1000, margin = 60, gap = 30, rounds = 240 } = {}) {
  const cards = cardsOf(world);
  const nodes = cards.map((c) => {
    // where it first came, as its card shows it
    const [x, y] = c.box ? centre(c.box) : [W / 2, H / 2];
    const r = Math.round((SIZE[c.kind] || SIZE.thing) * (1 + 0.1 * Math.min(4, c.nights - 1)));
    return { id: c.id, name: c.name, kind: c.kind, x, y, r, nights: c.nights, first: c.first };
  });
  // pushed apart until none overlap, and kept on the sheet
  const keep = (n) => { n.x = Math.min(W - margin - n.r, Math.max(margin + n.r, n.x)); n.y = Math.min(H - margin - n.r * 0.8, Math.max(margin + n.r * 0.8, n.y)); };
  nodes.forEach(keep);
  for (let k = 0; k < rounds; k++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const want = a.r + b.r + gap;
        let d = Math.hypot(dx, dy);
        if (d >= want) continue;
        if (d < 1e-3) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const push = (want - d) / 2 + 0.5;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
        keep(a); keep(b);
        moved = true;
      }
    }
    if (!moved) break;
  }
  nodes.forEach((n) => { n.x = Math.round(n.x); n.y = Math.round(n.y); });
  // the paths: things that came on the same night
  const ids = new Set(nodes.map((n) => n.id));
  const together = new Map();
  for (const night of world.nights || []) {
    const cast = [...new Set([...(night.cast || []), ...(world.entities || []).filter((e) => (e.endings || []).some((x) => x.night === night.n)).map((e) => e.id)])].filter((id) => ids.has(id));
    for (let i = 0; i < cast.length; i++) {
      for (let j = i + 1; j < cast.length; j++) {
        const [a, b] = [cast[i], cast[j]].sort();
        const k = `${a}|${b}`;
        if (!together.has(k)) together.set(k, { a, b, nights: [] });
        together.get(k).nights.push(night.n);
      }
    }
  }
  return { W, H, nodes, paths: [...together.values()] };
}

// Which thing of their world an answer names, if one does: "Up to the moon castle" names the moon
// castle, not the moon (the longest name it says wins). By a thing's name or another name it goes
// by, whole words only; never by a word as plain as "friend", which names no one in particular.
// `things`: [{ name, aliases }]. Returns the thing, or null.
const PLAIN = new Set(['friend', 'friends', 'someone', 'something', 'thing', 'things', 'place', 'home', 'house', 'person', 'people', 'man', 'woman', 'girl', 'boy', 'one', 'new']);
const bare = (s) => String(s || '').toLowerCase().replace(/[’']s\b/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/^(the|a|an|my) /, '');
export function namedIn(text, things) {
  const said = ` ${bare(text)} `;
  let best = null, most = 0;
  for (const t of things || []) {
    const keys = [bare(t.name), ...(t.aliases || []).map(bare).filter((k) => !PLAIN.has(k))].filter((k) => k.length >= 3);
    for (const k of keys) if (said.includes(` ${k} `) && k.length > most) { best = t; most = k.length; }
  }
  return best;
}
