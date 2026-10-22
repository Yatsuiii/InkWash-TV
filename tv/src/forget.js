// Forgetting on this TV (engine/dreams/forget.mjs): the world forgets a thing and everything that
// grew from it, and then so does everything the TV keeps beside the world: the chapters it keeps
// apart, each chapter the thing came in (its marks painted out of the drawing, and any picture made
// real of that chapter let go, since it was painted from them, with what was made from that picture:
// the clip it came alive in, its panorama and the world built from it), and the thing's own picture.
// Nothing about it is sent anywhere.
import { scrubNight } from './engine/dreams/forget.mjs';
import { PLACE, COMPOSED } from './paintings.js';

// `archive`: the chapters kept apart (paintings.js createNights); `pics`: the drawings and pictures
// (createPaintings), with the thing's own picture at `pictureKey(id)`; `erase(image, strokes)`: a
// drawing with those strokes painted out (a canvas job the page does). The world's own answer
// (world.forget): { record, plan, replay }, or null.
export async function forgetHere(world, id, { archive = null, pics = null, erase = null, pictureKey = null, at = Date.now() } = {}) {
  const r = world.forget(id, { at });
  if (!r || r.replay) return r;
  const { plan } = r;
  if (archive) {
    const all = await archive.all().catch(() => []);
    if (all.length) await archive.putMany(all.map((N) => scrubNight(N, plan))).catch(() => {});
  }
  if (pics) {
    for (const n of plan.chapters) {
      const p = await pics.get(n).catch(() => null);
      if (!p) continue;
      const marks = plan.marks[n] || [];
      const gone = (p.strokes || []).filter((s) => marks.includes(s.n));
      const image = gone.length && erase && p.image ? await erase(p.image, gone).catch(() => p.image) : p.image;
      // the picture made real goes, and what was made from it: its clip, its panorama, its world
      const { real: _real, alive: _alive, wide: _wide, world: _world, ...rest } = p;
      await pics.put(n, { ...rest, image, strokes: (p.strokes || []).filter((s) => !marks.includes(s.n)) });
    }
    const k = pictureKey ? pictureKey(id) : null;
    if (k != null && pics.drop) await pics.drop(k).catch(() => {});
    // the place, painted from words that named it
    if (plan.place && pics.drop) await pics.drop(PLACE).catch(() => {});
    // and their world painted as one, which had it in it
    if (pics.drop) await pics.drop(COMPOSED).catch(() => {});
  }
  return r;
}

// What forgetting would take, said to them before they choose: "the door, with 2 lines of its
// stories, what was true of it and its picture". `picture`: whether it has one.
export function forgetSays(plan, { picture = false, young = false } = {}) {
  const c = plan.counts, name = plan.name;
  if (young) return `Take ${name} out of your world? Everything else stays.`;
  const parts = [
    ...(c.lines ? [`${c.lines === 1 ? 'a line' : `${c.lines} lines`} of its stories`] : []),
    ...(c.facts ? ['what was true of it'] : []),
    ...(c.titles ? [c.titles === 1 ? 'a chapter’s name' : 'chapter names'] : []),
    ...(c.words ? ['what you said of it'] : []),
    ...(picture ? ['its picture'] : []),
  ];
  const listed = parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Forget ${name}? It goes from your world${listed ? `, with ${listed}` : ''}. Everything else stays as it is.`;
}
