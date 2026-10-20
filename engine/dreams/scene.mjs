// Where a world stands: its scene, written for it when its story starts, from the story itself.
// No world has a set background. A model reads what the world is (what was painted, said and
// told) and writes the place: the sky or the roof over it and its light, what stands far off, the
// ground, what drifts in the air, and how the things painted into it stand there. The TV draws
// whatever it is given out of those parts, so each world's place is its own: a lamplit library
// that goes on for ever, a drowned city's lake at first light, a sky sea over a floor of cloud, a
// railway station in the snow as bright as a toy.
//
// `checkScene` keeps only what the TV can draw: colours as #rrggbb, amounts 0 to 1, each kind one
// the TV knows. A scene that can't be drawn is null, and the world keeps the one it had.
// `sceneBrief`: what the model is given to write it from.
export const SHAPES = ['hills', 'mountains', 'dunes', 'waves', 'trees', 'towers', 'roofs', 'shelves', 'arches', 'cliffs', 'clouds', 'pillars'];
export const GROUND_KINDS = ['water', 'grass', 'snow', 'boards', 'stone', 'sand', 'clouds', 'tiles'];
export const AIR_KINDS = ['none', 'fireflies', 'motes', 'snow', 'rain', 'petals', 'bubbles', 'embers', 'leaves'];
export const LIGHT_KINDS = ['sun', 'moon', 'lamps', 'none'];
// how their things stand there: as their own ink (scenes written before say 'toy'), or as light
export const STYLES = ['ink', 'light'];

const HEX = /^#[0-9a-f]{6}$/;
const colour = (v, d = null) => { const s = String(v || '').trim().toLowerCase(); return HEX.test(s) ? s : d; };
const amount = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d; };
const one = (v, list, d) => (list.includes(v) ? v : d);
const words = (v, most) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, most);

// how light a colour is, 0 to 1
export function lightness(hex) {
  const c = colour(hex, '#000000'), n = parseInt(c.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function checkScene(raw) {
  const s = raw && typeof raw === 'object' ? raw : null;
  if (!s) return null;
  const sky = s.sky && typeof s.sky === 'object' ? s.sky : {};
  const top = colour(sky.top), bottom = colour(sky.bottom);
  const g = s.ground && typeof s.ground === 'object' ? s.ground : {};
  const gFar = colour(g.far), gNear = colour(g.near);
  // a sky and a ground, at the least
  if (!top || !bottom || !gFar || !gNear) return null;
  const light = s.light && typeof s.light === 'object' ? s.light : {};
  const air = s.air && typeof s.air === 'object' ? s.air : {};
  const haze = s.haze && typeof s.haze === 'object' ? s.haze : {};
  const things = s.things && typeof s.things === 'object' ? s.things : {};
  const roof = s.roof === true;
  const far = (Array.isArray(s.far) ? s.far : []).slice(0, 3).map((f) => (f && typeof f === 'object' && SHAPES.includes(f.shape) && colour(f.color) ? {
    shape: f.shape, color: colour(f.color), height: Math.max(0.03, Math.min(0.45, Number(f.height) || 0.12)),
    ...(colour(f.top) ? { top: colour(f.top) } : {}), ...(colour(f.windows) ? { windows: colour(f.windows) } : {}),
  } : null)).filter(Boolean);
  const colours = (Array.isArray(things.colors) ? things.colors : []).map((c) => colour(c)).filter(Boolean).slice(0, 7);
  return {
    place: words(s.place, 200),
    // how it looks, as an art director would say it (an image model paints the place in it)
    look: words(s.look, 160),
    // three other looks it could have, for them to choose from (what they say comes first)
    looks: (Array.isArray(s.looks) ? s.looks : []).map((l) => words(l, 120)).filter((l, i, all) => l && l !== words(s.look, 160) && all.indexOf(l) === i).slice(0, 3),
    roof,
    sky: {
      top, middle: colour(sky.middle, top), bottom,
      stars: roof ? 0 : amount(sky.stars), clouds: roof ? 0 : amount(sky.clouds),
      cloud: colour(sky.cloud, '#ffffff'), cloudShade: colour(sky.cloudShade, '#c8d4e8'),
    },
    light: {
      kind: one(light.kind, LIGHT_KINDS, 'none'), x: amount(light.x, 0.7), y: amount(light.y, 0.25),
      color: colour(light.color, '#fff4dc'), glow: amount(light.glow, 0.5),
    },
    far,
    ground: { kind: one(g.kind, GROUND_KINDS, 'grass'), far: gFar, near: gNear, shine: amount(g.shine, g.kind === 'water' ? 0.3 : 0), shadow: colour(g.shadow, '#1c2436') },
    haze: { color: colour(haze.color, bottom), amount: amount(haze.amount, 0.3) },
    air: { kind: one(air.kind, AIR_KINDS, 'none'), color: colour(air.color, '#ffffff'), amount: amount(air.amount, 0.5) },
    things: {
      style: one(things.style === 'toy' ? 'ink' : things.style, STYLES, 'ink'),
      colors: colours.length ? colours : ['#ff6a4d', '#ffbf3a', '#43a6ff', '#8a63f2', '#21bfae'],
      gloss: amount(things.gloss, 0.5), outline: amount(things.outline, 0.25),
    },
  };
}

// light words over it, or dark ones: from how light its sky is where the words sit
export const toneOf = (scene) => (scene && lightness(scene.sky.top) * 0.6 + lightness(scene.sky.middle) * 0.4 > 0.18 ? 'day' : 'night');

// What the model writes the scene from: the world as far as it has gone (its name, its nights'
// titles and story, the things in it and what is known of them), never more than it needs
export function sceneBrief(S, { young = false } = {}) {
  const nights = (S.nights || []).slice(-6).map((n) => ({
    n: n.n, title: n.title || null, story: (n.lines || n.told || []).map((l) => (typeof l === 'string' ? l : l && l.text)).filter(Boolean).slice(0, 8),
    // what they said themselves, on their phone, as they painted: it may say how their world looks
    ...(Array.isArray(n.said) && n.said.length ? { said: n.said.slice(0, 6) } : {}),
  }));
  const things = (S.entities || []).filter((e) => e.status !== 'gone').slice(0, 24).map((e) => ({ name: e.name, kind: e.kind || null, look: e.look || null, facts: (S.facts || []).filter((f) => f.entity === e.id).slice(0, 3).map((f) => f.text) }));
  return { world: S.name || null, young: !!young, nights, things };
}
