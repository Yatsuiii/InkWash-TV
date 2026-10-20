// The Illustrator: once a painting is told, it makes it real. It is shown their painting, tonight's
// story (each line with where on the paper its part is), and the things of their world in it, with
// what is true of each and how each looks, where a look is kept. It writes the scene an image model
// paints over their strokes, holding to where they put everything (the guide service's
// illustrator.mjs), and how each thing in it looks. A thing's look is kept in their world the first
// time (world.mjs looked) and given back every night after, so the night ferry is the same ferry
// night after night.
//
// Here: what the Illustrator is shown (illustrateBrief), and what it may answer (checkIllustration).
// The model calls themselves are the guide service's. Pure.

import { frightIn } from './gentle.mjs';

export const ILLUSTRATE = { lines: 8, line: 240, title: 60, things: 6, facts: 3, look: 140, name: 60, scene: 12, sceneChars: 720, looks: 6 };
const PAPER = { W: 1600, H: 1000 };

const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const words = (s) => (String(s || '').match(/[\p{L}\p{N}']+/gu) || []).length;
const bare = (name) => clip(name, ILLUSTRATE.name).toLowerCase().replace(/^(the|a|an|my) /, '');

// Where a part of the painting is, in words an image model can follow: across in thirds, up and down
// in thirds, and how much of the paper it takes. `box`: [x0, y0, x1, y1] in paper units.
export function whereOn(box) {
  if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)) return null;
  const cx = (box[0] + box[2]) / 2 / PAPER.W, cy = (box[1] + box[3]) / 2 / PAPER.H;
  const across = cx < 1 / 3 ? 'left' : cx > 2 / 3 ? 'right' : '', down = cy < 1 / 3 ? 'top' : cy > 2 / 3 ? 'bottom' : '';
  const share = ((box[2] - box[0]) * (box[3] - box[1])) / (PAPER.W * PAPER.H);
  const size = share > 0.3 ? 'large' : share < 0.03 ? 'small' : null;
  return [[down, across].filter(Boolean).join(' ') || 'middle', size].filter(Boolean).join(', ');
}

// What the Illustrator is shown. `S`: a world's JSON; `telling`: tonight's { title, lines: [{ text,
// box }] }; `things`: the ids of the things of their world in it (the TV's world.recognize).
export function illustrateBrief(S, { title = '', lines = [], things = [] } = {}) {
  const facts = S.facts || [];
  const live = new Map((S.entities || []).filter((e) => e.status !== 'rejected').map((e) => [e.id, e]));
  return {
    title: clip(title, ILLUSTRATE.title),
    lines: (Array.isArray(lines) ? lines : []).slice(0, ILLUSTRATE.lines).map((l) => ({ text: clip(l && l.text, ILLUSTRATE.line), at: whereOn(l && l.box) })).filter((l) => l.text),
    things: [...new Set(things)].map((id) => live.get(id)).filter(Boolean).slice(0, ILLUSTRATE.things).map((e) => {
      const mine = facts.filter((f) => f.entity === e.id && f.to == null && !f.thread);
      // what they chose for it first, then the latest
      const known = [...mine.filter((f) => f.source === 'chosen'), ...mine.filter((f) => f.source !== 'chosen').reverse()].slice(0, ILLUSTRATE.facts).map((f) => f.text);
      // how it looks in their own words, if they said (world.mjs ruled): theirs, over any look kept
      return { id: e.id, name: e.name, kind: e.kind || 'thing', facts: known, look: e.look || null, ...(e.rule ? { rule: e.rule } : {}) };
    }),
  };
}

// What the Illustrator may answer, made safe to use: the scene, a paragraph long enough to paint
// from; for a child, nothing frightening they never brought (the story they were told, and what
// their world holds, is theirs). How each thing looks: a thing of their world by its id, or a new
// one by the name the story calls it; a thing with a look kept keeps it, whatever is answered, and
// every kept look comes back. A thing they said the look of in their own words carries their words
// (`rule`) whatever look it has, and is there even with none. Returns { ok, scene, looks: [{ id?,
// name, look (null for a thing with only their words), kept, rule? }] } or { ok: false, why }.
export function checkIllustration(reply, brief, { young = false } = {}) {
  const r = reply && typeof reply === 'object' ? reply : {};
  const scene = clip(r.scene, ILLUSTRATE.sceneChars);
  if (words(scene) < ILLUSTRATE.scene) return { ok: false, why: 'the scene must say what the picture shows, in a paragraph' };
  const things = brief.things || [];
  const ctx = { things: things.map((t) => ({ name: t.name, aliases: [] })), confirmed: [...(brief.lines || []).map((l) => l.text), ...things.flatMap((t) => [...t.facts, t.look || ''])] };
  // which word, so that when it is asked again it can paint it without it
  const fright = young ? frightIn(scene, ctx) : [];
  if (fright.length) return { ok: false, why: `the scene brings in something frightening ("${fright[0]}"), which they never brought: say it gently (a warm glow, not fire or flames)` };
  const story = (brief.lines || []).map((l) => l.text).join(' ').toLowerCase();
  const looks = [], seen = new Set();
  const add = (x) => { const key = x.id || bare(x.name); if (!seen.has(key)) { seen.add(key); looks.push(x); } };
  const theirs = (t) => (t.rule ? { rule: t.rule } : {});
  // the looks kept: theirs already
  for (const t of things) if (t.look) add({ id: t.id, name: t.name, look: t.look, kept: true, ...theirs(t) });
  for (const l of Array.isArray(r.looks) ? r.looks : []) {
    if (looks.length >= ILLUSTRATE.looks) break;
    const look = clip(l && l.look, ILLUSTRATE.look);
    if (words(look) < 2 || (young && frightIn(look, ctx).length)) continue;
    const ref = clip(l && (l.thing ?? l.id ?? l.name), ILLUSTRATE.name);
    const t = things.find((x) => x.id === ref) || things.find((x) => bare(x.name) === bare(ref));
    if (t) { add({ id: t.id, name: t.name, look, kept: false, ...theirs(t) }); continue; }
    // a new thing, by the name the story calls it
    const name = bare(ref);
    if (words(name) >= 1 && name.length >= 3 && story.includes(name)) add({ name: clip(ref, ILLUSTRATE.name), look, kept: false });
  }
  // their own words for a thing still without a look: there all the same
  for (const t of things) if (t.rule) add({ id: t.id, name: t.name, look: null, kept: false, rule: t.rule });
  return { ok: true, scene, looks };
}
