// Their world at night. Ink is how a world is painted; at night it wakes up: the paper goes dark,
// and every stroke they painted lights up where they painted it, its own brush marks turned to
// light (the taper of each stroke, its pools, its dry streaks), in the colour of its ink: the black
// as moonlight, the pale ink fainter, a wash as a breath of mist, gold as lamplight, cinnabar as
// fire, indigo deep blue. Still water below holds it all upside down. Nothing is generated: every
// light is their own ink.
//
// - `nightPainting`: one painting at night, where they painted it: what a told painting wakes up
//   into (when no picture is made of it), and how the TV at rest shows it;
// - `createNightWorld`: their whole world at night, the home they come back to: each thing they
//   painted standing where it first came, in its own light, moving the way its shape moves
//   (cutout.js motionOf), reflected in the water, and the things that came on the same night joined
//   by a path of light.
//
// Cheap on a TV: the light is made on the GPU (glow.js), and a whole world of it is one canvas,
// redrawn each frame from a few dozen quads. The layout is pure, and tested in Node.
import { motionOf, poseOf } from './cutout.js';
import { getGlow, createPace } from './glow.js';
import { STAGE, PX } from './stage.js';
import { worldOf, boundsOf, view, right, walk, glide, standBefore, HOME, PACE } from './walk.js';
import { checkScene, drawSceneAround, materialOf, reflectOf, toneOf } from './scene.js';

// each ink's light: its bright core and its glow
export const LIGHTS = {
  moon: { core: [240, 246, 255], glow: [110, 160, 255] },
  gold: { core: [255, 240, 200], glow: [255, 165, 55] },
  indigo: { core: [200, 210, 255], glow: [80, 90, 255] },
  cinnabar: { core: [255, 212, 196], glow: [255, 78, 48] },
};
// a stroke's ink, as brush.js names it, to its light
export const LIGHT_OF_INK = { dense: 'moon', light: 'moon', water: 'moon', gold: 'gold', indigo: 'indigo', cinnabar: 'cinnabar' };

// The world's stage (stage.js): the horizon, and the eye above the water
export { STAGE, PX } from './stage.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rgb = (c, a = 1) => `rgba(${c.map((v) => Math.round(v)).join(',')},${a})`;
function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296); }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const boxOf = (ss) => ss.reduce((u, s) => [Math.min(u[0], s.box[0]), Math.min(u[1], s.box[1]), Math.max(u[2], s.box[2]), Math.max(u[3], s.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);

// ---------------------------------------------------------------- pure

// Which light a pixel of ink gives: from how much light it lets through, in each colour (0 to 1, as
// the ink layer has it: 1 where there is no ink). Null where there is next to none.
export function lightAt(t) {
  const amount = 1 - (t[0] + t[1] + t[2]) / 3;
  if (amount < 0.035) return null;
  const spread = Math.max(...t) - Math.min(...t);
  // the black and the greys: moonlight, as strong as the ink was dark (a pool of ink a soft glow,
  // not a white hole)
  if (spread < 0.12) return { light: 'moon', a: clamp(0.88 * Math.pow(amount * 1.2, 0.9), 0, 0.88) };
  // the dream inks, by the colour they show on the paper: indigo looks blue, cinnabar red, gold
  // yellow (it takes the blue away)
  const [r, g, b] = t;
  const light = b > r && b > g ? 'indigo' : r > g * 1.35 && r > b * 1.35 ? 'cinnabar' : 'gold';
  return { light, a: clamp(amount * 1.8, 0, 1) };
}

// Where the water begins in a painting at night: just below the lowest of its strokes (not a wash),
// so what they painted stands at the water's edge. Paper units (1000 tall).
export function horizonOf(strokes) {
  const low = strokes.filter((s) => s && s.box && s.ink !== 'water').reduce((m, s) => Math.max(m, s.box[3]), 0);
  return Math.round(clamp(low ? low + 22 : 700, 600, 940));
}

// The world laid out at night: each thing where it first came on the map (cards.js mapOf), across
// the stage (`u`, 0 left to 1 right) and from near to far (`v`, 0 near to 1 far), spread to fill it
// however small the world; on the water at `foot`, `k` its nearness (1 is near), and painted high
// on its page, `rise`n into the air. Things whose light would cover each other on the screen are
// moved apart along the water. `nodes`: [{ id, x, y }] in map units (1600 x 1000); by id,
// `heights`: how high up its page it was painted (0 the bottom, 1 the top); `sizes`: how wide and
// tall it was painted (paper units).
export function placeWorld(nodes, { heights = {}, sizes = {}, S = STAGE } = {}) {
  if (!nodes.length) return [];
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const placed = nodes.map((n) => {
    const u = x1 > x0 ? 0.12 + (0.76 * (n.x - x0)) / (x1 - x0) : 0.5;
    const v = y1 > y0 ? 0.08 + 0.72 * (1 - (n.y - y0) / (y1 - y0)) : 0.3;
    const z = 900 + v * 1800, k = S.eye.f / z;
    const up = clamp(heights[n.id] ?? 0, 0, 1);
    return {
      id: n.id, u, v, k, x: S.W / 2 + (u - 0.5) * 2000 * k, y: S.horizon + S.eye.h * k,
      w: ((sizes[n.id] || [200])[0] || 200) * PX * k, h: ((sizes[n.id] || [0, 200])[1] || 200) * PX * k,
      // the sky's things well up in it: the moon, the stars, a dragon in flight
      rise: Math.max(0, up - 0.42) * 1300 * k,
    };
  });
  // apart: two things whose light would cover each other on the screen are pushed away from each
  // other along the water, a little at a time, and kept on the stage
  const top = (p) => p.y - p.rise - p.h, bottom = (p) => p.y - p.rise;
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (const a of placed) for (const b of placed) {
      if (a === b || a.x > b.x || (a.x === b.x && a.id > b.id)) continue;
      if (Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b)) < -12) continue;
      const need = (a.w + b.w) / 2 + 28, gap = b.x - a.x;
      if (gap >= need) continue;
      const push = (need - gap) / 2 + 1;
      a.x -= push; b.x += push; moved = true;
    }
    for (const p of placed) p.x = clamp(p.x, S.W * 0.06 + p.w / 2, S.W * 0.94 - p.w / 2);
    if (!moved) break;
  }
  return placed.map((p) => ({
    id: p.id, u: Math.round(p.u * 1000) / 1000, v: Math.round(p.v * 1000) / 1000, k: Math.round(p.k * 1000) / 1000,
    foot: [Math.round(p.x), Math.round(p.y)], rise: Math.round(p.rise),
  })).sort((a, b) => a.foot[1] - b.foot[1]);
}

// ---------------------------------------------------------------- drawn

// a thing's name, glowing, as a picture
export function tagOf(text) {
  const font = 'italic 500 30px Alegreya, Georgia, serif', m = canvasOf(1, 1).getContext('2d');
  m.font = font;
  const c = canvasOf(Math.ceil(m.measureText(text).width) + 60, 64), g = c.getContext('2d');
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff3e0';
  g.shadowColor = 'rgba(255, 170, 110, 0.9)'; g.shadowBlur = 16;
  g.fillText(text, c.width / 2, c.height / 2);
  g.shadowBlur = 0;
  g.fillText(text, c.width / 2, c.height / 2);
  return c;
}
// a pool of light on the water, as stepping inside sees it, from near the water
export function poolOf() {
  const c = canvasOf(128, 32), g = c.getContext('2d'), r = g.createRadialGradient(64, 16, 0, 64, 16, 64);
  r.addColorStop(0, 'rgba(150, 175, 255, 0.34)'); r.addColorStop(0.7, 'rgba(110, 140, 255, 0)');
  g.setTransform(1, 0, 0, 0.25, 0, 12); g.fillStyle = r; g.fillRect(0, -64, 128, 192);
  return c;
}
// a firefly
export function dotOf() {
  const c = canvasOf(48, 48), g = c.getContext('2d'), r = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  r.addColorStop(0, 'rgba(255, 241, 194, 1)'); r.addColorStop(0.15, 'rgba(255, 241, 194, 0.95)'); r.addColorStop(0.3, 'rgba(255, 190, 90, 0.5)'); r.addColorStop(1, 'rgba(255, 190, 90, 0)');
  g.fillStyle = r; g.fillRect(0, 0, 48, 48);
  return c;
}

// a pool of light, round, to lie on the water; and the light pooled round what the eye has gone to
// (soft, with no edge: their world is light, not a map with a marker on it)
export function roundPoolOf() {
  const c = canvasOf(96, 96), g = c.getContext('2d'), r = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  r.addColorStop(0, 'rgba(150, 175, 255, 0.3)'); r.addColorStop(0.7, 'rgba(110, 140, 255, 0)');
  g.fillStyle = r; g.fillRect(0, 0, 96, 96);
  return c;
}
export function ringOf() {
  const c = canvasOf(160, 160), g = c.getContext('2d'), r = g.createRadialGradient(80, 80, 0, 80, 80, 78);
  r.addColorStop(0, 'rgba(255, 246, 228, 0.42)'); r.addColorStop(0.5, 'rgba(236, 240, 255, 0.16)'); r.addColorStop(1, 'rgba(236, 240, 255, 0)');
  g.fillStyle = r; g.fillRect(0, 0, 160, 160);
  return c;
}


// Strokes drawn as ink on white from the paths the brush took, where there is no ink to light (a
// stroke kept without its picture): `px` pixels a paper unit, with a margin of 20 units. Returns
// the canvas and the box it covers (paper units).
export function inkOfPaths(strokes, { px = 0.5 } = {}) {
  const ss = strokes.filter((s) => s && s.box && s.path && s.path.length);
  if (!ss.length) return null;
  const box = boxOf(ss), ink = canvasOf((box[2] - box[0] + 40) * px, (box[3] - box[1] + 40) * px), g = ink.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, ink.width, ink.height);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const tone = { dense: '#1c1e24', light: '#8a8f99', water: '#d8dbe0', gold: '#b88a2a', indigo: '#2f3f8f', cinnabar: '#b23a2a' };
  for (const s of ss) {
    g.strokeStyle = tone[s.ink] || tone.dense; g.lineWidth = Math.max(1.5, 14 * px);
    g.beginPath();
    s.path.forEach(([x, y], i) => { const X = (x - box[0] + 20) * px, Y = (y - box[1] + 20) * px; if (!i) g.moveTo(X, Y); else g.lineTo(X, Y); });
    if (s.path.length === 1) g.lineTo((s.path[0][0] - box[0] + 20) * px + 0.5, (s.path[0][1] - box[1] + 20) * px);
    g.stroke();
  }
  return { canvas: ink, box: [box[0] - 20, box[1] - 20, box[2] + 20, box[3] + 20] };
}

// a ridge of hills along the horizon: a few octaves of smooth waves
function ridge(g, W, y0, height, color, rnd) {
  const ph = [rnd() * 9, rnd() * 9, rnd() * 9];
  g.fillStyle = color; g.beginPath(); g.moveTo(0, y0);
  for (let x = 0; x <= W; x += 6) { const u = x / W; g.lineTo(x, y0 - height * (0.55 + 0.3 * Math.sin(u * 4.3 + ph[0]) + 0.12 * Math.sin(u * 11 + ph[1]) + 0.05 * Math.sin(u * 37 + ph[2]))); }
  g.lineTo(W, y0); g.closePath(); g.fill();
}

// The night: a sky with stars and a far glow, hills in the dark, and still water from the horizon
// down. `mood.v`, lighter (+1) to heavier (-1), warms the far glow or deepens it.
export function drawNight(g, { W, H, horizon, seed = 5, mood = null }) {
  const rnd = rand(seed), v = clamp((mood && mood.v) || 0, -1, 1);
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#02030a'); sky.addColorStop(0.55, '#0a0f2c'); sky.addColorStop(1, v > 0.3 ? '#3a2f5e' : '#232a5c');
  g.fillStyle = sky; g.fillRect(0, 0, W, horizon);
  const wash = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgb(c, a)); gr.addColorStop(1, rgb(c, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  wash(W * (0.55 + rnd() * 0.3), horizon + 40, W * 0.38, v > 0.3 ? [255, 170, 110] : [255, 140, 110], 0.14 + Math.max(0, v) * 0.14);
  wash(W * (0.1 + rnd() * 0.3), H * 0.11, W * 0.33, [90, 70, 200], 0.16);
  wash(W * (0.7 + rnd() * 0.2), H * 0.05, W * 0.27, [40, 150, 170], 0.1 - Math.min(0, v) * 0.05);
  for (let k = 0, n = Math.round((W * H) / 4900); k < n; k++) {
    const x = rnd() * W, y = Math.pow(rnd(), 1.4) * horizon * 0.95, r = rnd() < 0.06 ? 1.8 : rnd() < 0.3 ? 1.1 : 0.7;
    g.fillStyle = `rgba(255,248,235,${((0.2 + rnd() * 0.7) * (1 - (y / horizon) * 0.7)).toFixed(3)})`;
    g.beginPath(); g.arc(x, y, r * Math.max(0.6, W / 1920), 0, Math.PI * 2); g.fill();
  }
  ridge(g, W, horizon, H * 0.065, 'rgba(32,38,82,0.85)', rnd);
  ridge(g, W, horizon, H * 0.035, 'rgba(14,17,42,0.95)', rnd);
  const ground = g.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, '#141a40'); ground.addColorStop(0.3, '#080b1e'); ground.addColorStop(1, '#010206');
  g.fillStyle = ground; g.fillRect(0, horizon, W, H - horizon);
  const shine = g.createLinearGradient(0, horizon, 0, horizon + H * 0.13);
  shine.addColorStop(0, 'rgba(120,130,220,0.35)'); shine.addColorStop(1, 'rgba(120,130,220,0)');
  g.fillStyle = shine; g.fillRect(0, horizon, W, H * 0.13);
}

// The night all round, to walk in: as drawNight, but it goes on round, its right edge meeting its
// left, so that the sky turns as the eye turns (a texture that repeats across); and `up` pixels more
// of the sky above it, starry, for looking up (the canvas is H + up tall). `stage: false` draws only
// that sky above (the night below it already drawn, the same seed): the same stars either way.
// Cheap enough for a TV: each wash of colour is filled only where it reaches, and the stars a few
// brightnesses at a time.
export function drawNightAround(g, { W, H, horizon, seed = 5, up = 0, stage = true }) {
  const rnd = rand(seed), top = -up, bottom = stage ? H : 0;
  g.save();
  g.translate(0, up);
  if (up) { g.fillStyle = '#02030a'; g.fillRect(0, -up, W, up); }
  if (stage) {
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#02030a'); sky.addColorStop(0.55, '#0a0f2c'); sky.addColorStop(1, '#232a5c');
    g.fillStyle = sky; g.fillRect(0, 0, W, horizon);
  }
  const wash = (x, y, r, c, a) => {
    for (const dx of [-W, 0, W]) {
      const cx = x + dx, x0 = Math.max(0, cx - r), x1 = Math.min(W, cx + r), y0 = Math.max(top, y - r), y1 = Math.min(bottom, y + r);
      if (x1 <= x0 || y1 <= y0) continue;
      const gr = g.createRadialGradient(cx, y, 0, cx, y, r); gr.addColorStop(0, rgb(c, a)); gr.addColorStop(1, rgb(c, 0));
      g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  };
  wash(W * (0.55 + rnd() * 0.3), horizon + 40, W * 0.38, [255, 140, 110], 0.14);
  wash(W * (0.1 + rnd() * 0.3), H * 0.11, W * 0.33, [90, 70, 200], 0.16);
  wash(W * (0.7 + rnd() * 0.2), H * 0.05, W * 0.27, [40, 150, 170], 0.1);
  // stars, gathered by how bright they are, each brightness drawn at once; one at the edge again
  // round the other side
  const stars = new Map();
  const star = (x, y, r, a, draw) => {
    if (!draw) return;
    const k = Math.round(a * 20) / 20;
    if (!stars.has(k)) stars.set(k, []);
    stars.get(k).push(x, y, r);
    if (x < r + 1) stars.get(k).push(x + W, y, r);
    if (x > W - r - 1) stars.get(k).push(x - W, y, r);
  };
  for (let k = 0, n = Math.round((W * H) / 4900); k < n; k++) {
    const x = rnd() * W, y = Math.pow(rnd(), 1.4) * horizon * 0.95, r = rnd() < 0.06 ? 1.8 : rnd() < 0.3 ? 1.1 : 0.7;
    star(x, y, r, (0.2 + rnd() * 0.7) * (1 - (y / horizon) * 0.7), stage);
  }
  // hills all round: waves that fit the width a whole number of times
  const hills = (height, color) => {
    const ph = [rnd() * 9, rnd() * 9, rnd() * 9], at = (u) => horizon - height * (0.55 + 0.3 * Math.sin(2 * Math.PI * 2 * u + ph[0]) + 0.12 * Math.sin(2 * Math.PI * 5 * u + ph[1]) + 0.05 * Math.sin(2 * Math.PI * 17 * u + ph[2]));
    if (!stage) return;
    g.fillStyle = color; g.beginPath(); g.moveTo(0, horizon);
    for (let x = 0; x < W; x += 6) g.lineTo(x, at(x / W));
    g.lineTo(W, at(1)); g.lineTo(W, horizon); g.closePath(); g.fill();
  };
  // the sky above, as starry as the top of the sky below it
  const above = () => {
    for (let k = 0, n = Math.round((W * up) / 1800); k < n; k++) {
      const x = rnd() * W, y = -3 - rnd() * (up - 6), r = rnd() < 0.06 ? 1.8 : rnd() < 0.3 ? 1.1 : 0.7;
      star(x, y, r, 0.2 + rnd() * 0.7, true);
    }
  };
  const shine = () => {
    const ground = g.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, '#141a40'); ground.addColorStop(0.3, '#080b1e'); ground.addColorStop(1, '#010206');
    g.fillStyle = ground; g.fillRect(0, horizon, W, H - horizon);
    const s = g.createLinearGradient(0, horizon, 0, horizon + H * 0.13);
    s.addColorStop(0, 'rgba(120,130,220,0.35)'); s.addColorStop(1, 'rgba(120,130,220,0)');
    g.fillStyle = s; g.fillRect(0, horizon, W, H * 0.13);
  };
  // stars first, then the hills and the water over them
  for (const [a, ps] of stars) {
    g.fillStyle = `rgba(255,248,235,${a.toFixed(2)})`;
    g.beginPath();
    for (let i = 0; i < ps.length; i += 3) { g.moveTo(ps[i] + ps[i + 2], ps[i + 1]); g.arc(ps[i], ps[i + 1], ps[i + 2], 0, Math.PI * 2); }
    g.fill();
  }
  stars.clear();
  hills(H * 0.065, 'rgba(32,38,82,0.85)');
  hills(H * 0.035, 'rgba(14,17,42,0.95)');
  if (stage) shine();
  above();
  for (const [a, ps] of stars) {
    g.fillStyle = `rgba(255,248,235,${a.toFixed(2)})`;
    g.beginPath();
    for (let i = 0; i < ps.length; i += 3) { g.moveTo(ps[i] + ps[i + 2], ps[i + 1]); g.arc(ps[i], ps[i + 1], ps[i + 2], 0, Math.PI * 2); }
    g.fill();
  }
  g.restore();
}

// One painting in its world's place, or, until its world has one, at night: made on the GPU. In its
// place (`scene`, scene.js; `backdrop`, the place painted, if it has been), what they painted
// stands there solid, as the things in their world do, with its shadow, and held in the ground as
// much as the ground shines; at night, its own ink is light, over the night and in the water
// below. Its ink: `ink` on white (any size, the paper's shape), or a `painting` and its `paper`
// (`key`, `paperKey`: to keep them uploaded); without either, the strokes' paths are drawn.
// `strokes` (paper units) also say where the ground begins. `lit`: its ink is light even in a place
// (as it was drawn into their world), not a solid thing. A canvas W x H, or null where there is no
// GPU to make it.
export function nightPainting({ ink = null, painting = null, paper = null, key = null, paperKey = null, strokes = [], W = 1280, H = 800, seed = 5, mood = null, scene = null, backdrop = null, lit = false } = {}) {
  const G = getGlow();
  if (!G) return null;
  const place = scene ? checkScene(scene) : null, material = lit ? null : materialOf(place, 0);
  const k = W / 1600, horizon = Math.round(horizonOf(strokes) * k);
  const sky = canvasOf(W, H);
  if (place) placeSky(sky.getContext('2d'), { W, H, horizon, seed, scene: place, backdrop });
  else drawNight(sky.getContext('2d'), { W, H, horizon, seed, mood });
  const src = ink || painting;
  let L, at;
  if (src) {
    const sw = src.naturalWidth || src.width, s = W / sw;
    L = G.light({ ink, painting, paper, key, paperKey, px: sw / 1600, material });
    at = [-L.pad * s, -L.pad * s, L.w * s, L.h * s];
  } else {
    const P = inkOfPaths(strokes, { px: k });
    if (!P) return sky;
    L = G.light({ ink: P.canvas, px: k, material });
    at = [P.box[0] * k - L.pad, P.box[1] * k - L.pad, L.w, L.h];
  }
  // a solid thing's shadow, thrown away from the light
  const drop = material ? [-material.sun[0] * 22 * k, -material.sun[1] * 22 * k] : [0, 0];
  const out = G.picture({ sky, L, at, horizon, seed, shine: place ? reflectOf(place) : 0.34, drop });
  G.freeLight(L);
  return out;
}

// A world's place behind a picture W x H, its ground below `horizon`: the place as it was painted
// (`backdrop`, painted over the TV's drawing of it at the stage's shape), laid so that its horizon
// meets this one, as large as it must be to fill the picture; or, until it is painted, drawn
export function placeSky(g, { W, H, horizon, seed = 5, scene, backdrop = null }) {
  if (!backdrop) return drawSceneAround(g, { W, H, horizon, seed, scene });
  const bw = backdrop.naturalWidth || backdrop.width, bh = backdrop.naturalHeight || backdrop.height, hb = bh * (STAGE.horizon / STAGE.H);
  const s = Math.max(W / bw, H / bh, horizon / hb, (H - horizon) / (bh - hb));
  g.drawImage(backdrop, (W - bw * s) / 2, horizon - hb * s, bw * s, bh * s);
}

// ---------------------------------------------------------------- their world, at night

// a box (w x h, its middle at cx, cy) moved as poseOf says, as CSS would move it: its corners,
// top left, top right, bottom left, bottom right
export function posed(cx, cy, w, h, q, origin = [0, 0]) {
  const r = (q.rot * Math.PI) / 180, sk = Math.tan((q.skew * Math.PI) / 180), c = Math.cos(r), s = Math.sin(r);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]].map(([x, y]) => {
    x = (x - origin[0]) * q.scale; y = (y - origin[1]) * q.scale;
    y += x * sk;
    return [cx + origin[0] + x * c - y * s + q.dx, cy + origin[1] + x * s + y * c + q.dy];
  });
}

// a thing's colour among a toy world's, the same each time it is shown
const turnOf = (id) => { let h = 7; for (const c of String(id)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0; return h; };

let world = null;
// `host`: an element the size of the stage. Returns what to give it (its things), which one is
// chosen, and a moment of time. Their names, and the ring round the one chosen, are the page's;
// the world and the things in it are drawn on the GPU, in one canvas (just its sky and ground
// without one). `scene` (scene.js): the place its Set Designer wrote for it; until it has one,
// the night on the lake.
// `backdrop`: the place painted (an image the stage's shape), laid over the drawing of it.
// how long a thing takes to spring up when it comes to life, and how it grows: from a third of its
// size to a little over, then back to itself
// A spring, as a function of time alone (so any frame can be drawn by itself): 0 to 1, by `zeta`
// (its damping ratio: 1 never overshoots, 0.4 to 0.6 is playful) and `f` (how fast, in Hz)
export function spring(t, zeta = 0.7, f = 2) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * f;
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}
// Coming to life, it springs up from a third of its size, playfully: a fifth over, a little under,
// and itself, in 0.8 s. `peak`: where in it it is biggest, where its sparks burst and its chime lands
const POP_SPRING = { zeta: 0.45, f: 2.2 };
export const POP = { s: 0.8, peak: Math.PI / (2 * Math.PI * POP_SPRING.f * Math.sqrt(1 - POP_SPRING.zeta ** 2)) / 0.8 };
const POP_S = POP.s;
export const popOf = (u) => (u >= 1 ? 1 : u <= 0 ? 0.3 : 0.3 + 0.7 * spring(u * POP_S, POP_SPRING.zeta, POP_SPRING.f));
// a thing's corners `at`, `u` of the way through springing up from its foot [fx, fy], wobbling as
// it settles
export function popped(at, [fx, fy], u) {
  if (!(u >= 0) || u >= 1) return at;
  const k = popOf(u), wob = 0.1 * Math.sin(u * Math.PI * 3) * (1 - u);
  return at.map(([cx, cy, ...r]) => [fx + (cx - fx) * k * (1 + wob), fy + (cy - fy) * k * (1 - wob), ...r]);
}

// sparks flying out from a thing as it comes to life (index.html .sparks), gone once they have
export function sparksEl({ at = 0, doc = globalThis.document } = {}) {
  const sparks = doc.createElement('span');
  sparks.className = 'sparks';
  sparks.style.setProperty('--at', `${at}s`);
  for (let n = 0; n < 12; n++) { const d = doc.createElement('i'); d.style.setProperty('--a', `${n * 30 + (n % 3) * 7}deg`); d.style.setProperty('--d', `${0.75 + (n % 4) * 0.12}`); sparks.append(d); }
  setTimeout(() => sparks.remove(), 1600 + at * 1000);
  return sparks;
}

// A hop, `u` of the way through (0 to 1): how high it is (0 on the ground, 1 at the top), and how it
// is stretched as it leaves the ground and squashed as it lands (its width and height, about its
// foot), as a cartoon hops
// As a cartoon hops: first it crouches (the wind-up: squashed down, wider, about three frames),
// then off it goes, stretched tall as it leaves the ground and again as it comes down, round at
// the top; it lands squashed, and is still. `takeoff` and `land`: where in the hop it leaves the
// ground and comes down (its sounds are struck there)
export const HOP = { s: 0.72, takeoff: 0.16, land: 0.8 };
const HOP_S = HOP.s;
// their world painted as one, fading in over the place (compose.js)
const COMPOSE_FADE = 1.5;
export function hopOf(u) {
  if (!(u > 0) || u >= 1) return { lift: 0, sx: 1, sy: 1 };
  const { takeoff, land } = HOP;
  if (u < takeoff) { const q = Math.sin(Math.PI * (u / takeoff)); return { lift: 0, sx: 1 + 0.09 * q, sy: 1 - 0.13 * q }; }
  if (u < land) {
    const a = (u - takeoff) / (land - takeoff), s = 0.12 * Math.abs(Math.cos(Math.PI * a)) * Math.min(1, a / 0.08);
    return { lift: Math.sin(Math.PI * a), sx: 1 - 0.5 * s, sy: 1 + s };
  }
  const q = Math.sin(Math.PI * ((u - land) / (1 - land)));
  return { lift: 0, sx: 1 + 0.12 * q, sy: 1 - 0.14 * q };
}
// how high a thing `h` stage pixels tall hops
export const hopHeight = (h) => Math.max(16, Math.min(56, h * 0.28));
// a thing's corners `at`, `u` of the way through a hop from its foot [fx, fy], `up` pixels high at the top
export function hopped(at, [fx, fy], u, up) {
  const { lift, sx, sy } = hopOf(u);
  return at.map(([cx, cy, ...r]) => [fx + (cx - fx) * sx, fy + (cy - fy) * sy - lift * up, ...r]);
}

export function createNightWorld(host, { seed = 5, S = STAGE, scene = null, backdrop = null } = {}) {
  if (world) world.clear();
  const G = getGlow(), pace = createPace();
  const place = scene ? checkScene(scene) : null, night = !place, reflect = reflectOf(place);
  const make = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
  host.innerHTML = '';
  // the world all round (as the walk sees it, which starts on this very picture)
  const sky = canvasOf(S.W, S.H);
  if (night) drawNightAround(sky.getContext('2d'), { W: S.W, H: S.H, horizon: S.horizon, seed });
  else drawSceneAround(sky.getContext('2d'), { W: S.W, H: S.H, horizon: S.horizon, seed, scene: place });
  // the place painted, over the drawing: its right edge brought round to meet its left (its left
  // edge mirrored in, fading up to it), for the walk, which goes on round
  let painted = false;
  function paintSky(img) {
    const g = sky.getContext('2d');
    g.drawImage(img, 0, 0, S.W, S.H);
    const band = Math.round(S.W * 0.12), strip = canvasOf(band, S.H), sg = strip.getContext('2d');
    sg.translate(band, 0); sg.scale(-1, 1); sg.drawImage(sky, 0, 0, band, S.H, 0, 0, band, S.H);
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'destination-in';
    const fade = sg.createLinearGradient(0, 0, band, 0); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    sg.fillStyle = fade; sg.fillRect(0, 0, band, S.H);
    g.drawImage(strip, S.W - band, 0);
    painted = true;
  }
  if (backdrop && place) paintSky(backdrop);
  // the night and the paths of light, one picture
  const back = make('canvas', 'sky'); back.width = S.W; back.height = S.H;
  const layer = make('div', 'things');
  if (!G) host.append(back);
  host.append(layer);
  const things = new Map(), makingNow = new Set(), hops = new Map();
  let chosen = null, born = null, last = null, drawnAt = null, links = [], backT = null, walker = null, backWas = null;
  // their world painted as one (compose.js), over the place, and the things made real in it no longer
  // laid on top: faded in over `COMPOSE_FADE` seconds from `composedAt`
  let composedT = null, composedAt = null;

  // the paths of light between the things that came on the same night, over the night: drawn again
  // only when where they run changes (the night is the size of the stage, and copying and sending
  // it to the GPU takes a TV stick a while); with none, the night alone, as it is
  function drawBack() {
    const paths = links.map((l) => [things.get(l.a), things.get(l.b)]).filter(([a, b]) => a && b);
    const was = JSON.stringify(paths.map(([a, b]) => [a.foot, b.foot, a.p.k, b.p.k]));
    if (was === backWas) return;
    backWas = was;
    if (G && !paths.length) { G.free(backT); backT = G.upload(sky); return; }
    // at night, home is their world itself: nothing laid over the water between things (on a walk,
    // a few glints there); by day a path of pebbles
    if (toneOf(place) === 'night') { if (G) { G.free(backT); backT = G.upload(sky); } else back.getContext('2d').drawImage(sky, 0, 0); return; }
    const g = back.getContext('2d');
    g.drawImage(sky, 0, 0);
    for (const [a, b] of paths) {
      for (let i = 1, n = 48; i < n; i++) {
        const t = i / n, x = a.foot[0] + (b.foot[0] - a.foot[0]) * t, y = a.foot[1] + (b.foot[1] - a.foot[1]) * t + Math.sin(t * Math.PI) * 16;
        const k = a.p.k + (b.p.k - a.p.k) * t;
        g.fillStyle = `rgba(255,250,236,${(0.45 + 0.4 * k).toFixed(3)})`;
        g.beginPath(); g.arc(x, y, 1.1 + 2 * k, 0, Math.PI * 2); g.fill();
      }
    }
    if (G) { G.free(backT); backT = G.upload(back); }
  }
  // its light, at the size it stands at (`want` stage pixels a paper unit), and how many stage
  // pixels a pixel of it is
  function lightOf(t, want) {
    const material = materialOf(place, turnOf(t.id));
    // made real on its own (things.js): its picture, over the part of the paper its region is, its
    // foot where its strokes' foot is
    if (t.sprite) {
      const { canvas, region } = t.sprite, kpx = (canvas.naturalWidth || canvas.width) / (region[2] - region[0]), box = t.box || boxOf(t.strokes);
      return { L: G.sprite(canvas, { pad: Math.max(0, region[3] - box[3]) * kpx, px: kpx, shade: material ? material.shadow : undefined }), s: want / kpx };
    }
    if (t.painting) {
      const [x0, y0, x1, y1] = t.box;
      return { L: G.light({ painting: t.painting, paper: t.paper, key: t.key, paperKey: t.paperKey, rect: [x0 * t.k, y0 * t.k, (x1 - x0) * t.k, (y1 - y0) * t.k], mask: t.mask, px: t.k, material }), s: want / t.k };
    }
    if (t.ink) return { L: G.light({ ink: t.ink, px: t.px || 0.5, material }), s: want / (t.px || 0.5) };
    const P = inkOfPaths(t.strokes, { px: want });
    return P && { L: G.light({ ink: P.canvas, px: want, material }), s: 1 };
  }

  // The things, all at once or as they come: [{ id, name, node, box, ... }], `node` { x, y } where
  // it is on the map, `box` (paper units) what its light is made from: a part of a `painting`
  // (with its `paper`, `k` pixels a paper unit, `mask` over the part), or `ink` on white (`px`
  // pixels a paper unit), or its `strokes`' paths. `links`: [{ a, b }] by id, the things that came
  // on the same night.
  function set(list, opts = {}) {
    if (opts.links) links = opts.links;
    const ok = list.filter((t) => t && t.node && (t.painting || t.ink || (t.strokes && t.strokes.some((s) => s.path && s.path.length))));
    const boxes = Object.fromEntries(ok.map((t) => [t.id, t.box || boxOf(t.strokes)]));
    const heights = Object.fromEntries(ok.map((t) => [t.id, 1 - (boxes[t.id][1] + boxes[t.id][3]) / 2 / 1000]));
    const sizes = Object.fromEntries(ok.map((t) => [t.id, [boxes[t.id][2] - boxes[t.id][0], boxes[t.id][3] - boxes[t.id][1]]]));
    const placed = placeWorld(ok.map((t) => ({ id: t.id, x: t.node.x, y: t.node.y })), { heights, sizes, S });
    for (const [id, th] of things) if (!ok.some((t) => t.id === id)) { th.el.remove(); if (G) G.freeLight(th.L); things.delete(id); }
    for (const p of placed) {
      const t = ok.find((x) => x.id === p.id);
      const key = t.sprite ? `made:${t.sprite.sign}` : t.painting ? `p:${t.key}:${t.box.join(',')}` : t.ink ? `ink:${t.ink.width}x${t.ink.height}` : `paths:${t.strokes.length}`;
      let th = things.get(t.id);
      if (!th || th.key !== key || th.p.k !== p.k) {
        // come to life as they look: its ink until now, its own picture from now (it pops up)
        const came = !!(th && t.sprite && !th.key.startsWith('made:'));
        if (th) { th.el.remove(); if (G) G.freeLight(th.L); }
        const want = PX * p.k; // stage pixels a paper unit: nearer, bigger
        const made = G ? lightOf(t, want) : null;
        // without a GPU, its size from its box alone
        const W = made ? made.L.w * made.s : (boxes[t.id][2] - boxes[t.id][0]) * want;
        const H = made ? made.L.h * made.s : (boxes[t.id][3] - boxes[t.id][1]) * want;
        const pad = made ? made.L.pad * made.s : 0;
        const el = make('div', 'thing'), label = make('p', 'label');
        // standing on the water: its light's foot at the foot of its place, or risen into the air
        const water = H - pad + p.rise;
        el.style.left = `${p.foot[0] - W / 2}px`;
        el.style.top = `${p.foot[1] - water}px`;
        el.style.width = `${W}px`; el.style.height = `${H}px`;
        el.style.setProperty('--water', `${water}px`);
        el.style.setProperty('--ring', `${Math.round(190 * p.k + 50)}px`);
        label.textContent = t.name ? t.name.charAt(0).toUpperCase() + t.name.slice(1) : '';
        // its name under it: on the water, or under it in the air
        label.style.top = `${H - pad + 18 + 18 * p.k}px`;
        el.append(label);
        layer.append(el);
        th = { id: t.id, name: t.name || null, el, label, key, L: made && made.L, box: [p.foot[0] - W / 2, p.foot[1] - water, W, H], pad, motion: motionOf(t.strokes && t.strokes.length ? t.strokes : [{ box: boxes[t.id], length: 200 }]), size: [W, H], phase: (things.size * 1.7) % 6, a: 0.74, came, making: makingNow.has(t.id) };
        el.classList.toggle('making', th.making);
        // a burst of sparks round it, flying out as it pops up
        if (came) { el.append(sparksEl({ at: POP.s * POP.peak })); el.classList.add('came'); }
        things.set(t.id, th);
      }
      Object.assign(th, { foot: p.foot, p });
      th.el.style.zIndex = String(Math.round(p.foot[1]));
    }
    // a name that would be under what is laid over the world (its choices, `opts.keepOut`: [x0, y0,
    // x1, y1] on the stage) goes over its thing instead
    const keepOut = opts.keepOut || null;
    // labels that would sit on each other step down
    const placedLabels = [];
    for (const th of [...things.values()].sort((a, b) => a.foot[1] - b.foot[1])) {
      const r = th.label.offsetWidth || 160, at = th.foot[1] - th.p.rise;
      const top = th.labelTop ?? parseFloat(th.label.style.top || 0), below = th.box[1] + top;
      th.labelTop = top;
      if (keepOut && th.foot[0] + r / 2 > keepOut[0] && th.foot[0] - r / 2 < keepOut[2] && below + 34 > keepOut[1] && below < keepOut[3]) {
        // just over its ink: its light has as much glow over it as under its foot
        th.label.style.top = `${Math.max(0, th.pad) - 40}px`;
        th.label.style.transform = 'translate(-50%, 0)';
        continue;
      }
      th.label.style.top = `${top}px`;
      let dy = 0;
      while (placedLabels.some((q) => Math.abs(q.x - th.foot[0]) < (q.w + r) / 2 + 14 && Math.abs(q.y - (at + dy)) < 32)) dy += 32;
      th.label.style.transform = `translate(-50%, ${dy}px)`;
      placedLabels.push({ x: th.foot[0], y: at + dy, w: r });
    }
    drawBack();
    drawnAt = null;
    if (chosen) choose(chosen);
  }
  // the one chosen: brighter, its name lit, a ring of light on the water round it
  function choose(id) {
    chosen = id;
    for (const th of things.values()) th.el.classList.toggle('on', th.id === id);
  }
  // A moment: each thing moves the way its shape moves, the chosen one more, and the water holds
  // each upside down about where it stands
  function frame(now, held = null) {
    if (!G || !backT) return;
    if (born == null) born = now;
    const step = last == null ? 0 : Math.min(0.1, now - last);
    const scale = pace.frame(step);
    last = now;
    if (walker) return walkFrame(now, held, step, scale);
    // the night moves slowly: thirty frames a second are enough, and half the work of sixty
    if (drawnAt != null && now - drawnAt < 1 / 31) return;
    const dt = drawnAt == null ? 0 : Math.min(0.1, now - drawnAt);
    drawnAt = now;
    G.attach(host, { before: layer, scale });
    G.begin({ W: S.W, H: S.H });
    G.quad(backT, [[0, 0], [S.W, 0], [0, S.H], [S.W, S.H]], { opaque: true });
    // their world painted as one, coming in over the place and what was laid on it
    let one = 0;
    if (composedT) {
      if (composedAt == null) composedAt = now;
      one = clamp((now - composedAt) / COMPOSE_FADE, 0, 1);
      G.quad(composedT, [[0, 0], [S.W, 0], [0, S.H], [S.W, S.H]], { alpha: one, over: true });
    }
    // solid things are laid far to near, each over what is behind it; light just adds up
    const list = [...things.values()].filter((th) => th.L);
    if (!night || list.some((th) => th.L.toy)) list.sort((a, b) => a.foot[1] - b.foot[1]);
    for (const th of list) {
      // in the painting as one, a thing made real is in the picture itself: what was laid on goes
      const inIt = one > 0 && th.key.startsWith('made:');
      if (inIt && one >= 1) continue;
      const on = th.id === chosen, solid = !!th.L.toy;
      th.a += ((on || solid ? 1 : 0.74) - th.a) * (1 - Math.exp(-dt / 0.25));
      const q = poseOf(th.motion, now - born + th.phase, on ? 1 : 0.55, { size: th.size });
      const [x, y, w, h] = th.box;
      let at = posed(x + w / 2, y + h / 2, w, h, q);
      // just come to life: it springs up from its foot, overshoots, and settles
      if (th.came === true) th.came = now;
      if (typeof th.came === 'number' && now - th.came < POP_S) at = popped(at, [th.foot[0], y + h - th.pad], (now - th.came) / POP_S);
      // greeted: it hops, stretched as it leaves the ground and squashed as it lands
      if (th.hop === true) th.hop = now;
      if (typeof th.hop === 'number' && now - th.hop < HOP_S) at = hopped(at, [th.foot[0], y + h - th.pad], (now - th.hop) / HOP_S, hopHeight(h - th.pad));
      if (solid && !inIt) shadowOf(th, at);
      if (reflect > 0 && !inIt && mirrored(th) > 0) G.quad(th.L, at.map(([cx, cy]) => [cx, 2 * th.foot[1] - cy]), { alpha: th.a * reflect * mirrored(th), soft: true, over: solid });
      // still being made: its ink breathes, waiting
      const a = (th.making ? th.a * (0.7 + 0.3 * Math.sin(now * 4.2 + th.phase)) : th.a) * (inIt ? 1 - one : 1);
      G.quad(th.L, at, { alpha: a, over: solid });
    }
    G.end({ clear: [0, 0, 0, 1] });
  }
  // How much of a thing shows in the water under it: all of what stands up or floats, none of what
  // lies along the water (a wave, a shore, a path), which would only be drawn twice, one under the other
  function mirrored(th) {
    if (th.p.rise > 5) return 1;
    const w = Math.max(1, th.size[0] - 2 * th.pad), h = Math.max(0, th.size[1] - 2 * th.pad);
    return clamp((h / w - 0.25) / 0.2, 0, 1);
  }
  // A solid thing's shadow on the ground at its foot, thrown away from the sun: its own shape,
  // blurred, laid flat behind it (fainter the higher it stands in the air)
  function shadowOf(th, at) {
    const m = materialOf(place, 0), sun = m ? m.sun : [0.4, -0.75, 0.52], [fx, fy] = th.foot, [, , w, h] = th.box, pad = th.pad;
    const foot = (h - pad) / h, reach = 0.32, sx = -sun[0] * h * foot * reach * 1.3;
    const lean = (at[2][0] + at[3][0]) / 2 - fx;
    const x0 = fx - w / 2 + lean, x1 = fx + w / 2 + lean, top = fy - foot * h * reach, bottom = fy + (1 - foot) * h * reach;
    G.quad(th.L.shadow, [[x0 + sx, top], [x1 + sx, top], [x0, bottom], [x1, bottom]], { alpha: 0.8 / (1 + th.p.rise / 120), over: true });
  }
  // ---------------------------------------------------------------- walking through it (walk.js)

  // how much more sky there is above the stage's, to look up into
  const UP = PACE.look + 20;

  // The eye leaves the water's edge and walks in, from just where the home view sees the world:
  // the same picture at first. `onHome`: once it has walked back to the water's edge.
  function walkStart({ onHome = () => {} } = {}) {
    if (!G || !backT || walker) return false;
    const lit = [...things.values()].filter((th) => th.L);
    if (!lit.length) return false;
    const spots = new Map(worldOf(lit.map((th) => th.p)).map((s) => [s.id, s]));
    // the night all round as home has it, and the sky above it, to look up into
    const around = canvasOf(S.W, S.H + UP), ag = around.getContext('2d');
    ag.drawImage(sky, 0, UP);
    if (night) drawNightAround(ag, { W: S.W, H: S.H, horizon: S.horizon, seed, up: UP, stage: false });
    else drawSceneAround(ag, { W: S.W, H: S.H, horizon: S.horizon, seed, up: UP, stage: false, scene: place });
    // the painted place's top, faded into the drawn sky above it
    if (painted) {
      const fade = ag.createLinearGradient(0, UP, 0, UP + 90); fade.addColorStop(0, place.sky.top); fade.addColorStop(1, 'rgba(0,0,0,0)');
      ag.fillStyle = fade; ag.fillRect(0, UP, S.W, 90);
    }
    const bounds = boundsOf([...spots.values()]), rnd = rand(seed * 7 + 3);
    // what drifts among the things: fireflies over the water, motes in the sun, snow; or nothing
    const air = place ? place.air : { kind: 'fireflies', amount: 0.5 };
    const many = Math.round(({ fireflies: 84, motes: 120, snow: 180, rain: 0, petals: 90, bubbles: 70, embers: 90, leaves: 70, none: 0 }[air.kind] || 0) * air.amount);
    const motes = Array.from({ length: many }, () => ({ x: bounds.x0 + rnd() * (bounds.x1 - bounds.x0), z: Math.max(160, bounds.z0 + rnd() * (bounds.z1 - bounds.z0)), y: 40 + rnd() * 360, d: 3 + rnd() * 4, w: rnd() * 6 }));
    walker = {
      eye: { ...HOME }, target: null, home: false, onHome, bounds, spots, tour: -1, drawnAt: null, drawn: null, motes, air,
      // OK goes to each thing in turn, the nearest first
      order: [...spots.values()].sort((a, b) => a.z - b.z || a.x - b.x).map((s) => s.id),
      sky: G.upload(around, { repeat: true }), ring: G.upload(ringOf()), pool: G.upload(roundPoolOf()), dot: G.upload(dotOf()),
      // their names, as the page's own text over the night, so they stay sharp however the night is drawn
      namesEl: make('div', 'names'), names: new Map(),
    };
    host.append(walker.namesEl);
    for (const th of lit.filter((x) => x.name)) {
      const el = make('p', 'name');
      el.textContent = th.name.charAt(0).toUpperCase() + th.name.slice(1);
      walker.namesEl.append(el);
      walker.names.set(th.id, { el, w: el.offsetWidth, h: el.offsetHeight, a: 0, on: false, t: '', o: '' });
    }
    host.classList.add('walking');
    return true;
  }
  // A thing's light in the world: how wide and tall it is, its margin, and its ink's height
  // (world units), how wide its ink is, and how many pixels of its light there are to a world unit
  const sizeOf = (th) => {
    const k = th.p.k;
    return { w: th.size[0] / k, h: th.size[1] / k, pad: th.pad / k, tall: Math.max(20, (th.size[1] - 2 * th.pad) / k), wide: Math.max(20, (th.size[0] - 2 * th.pad) / k), detail: th.L ? (th.L.w / th.size[0]) * k : 0 };
  };
  // A button on the walk: OK goes to the next thing in turn ({ id } of it); Back walks home; a tap
  // of an arrow turns or steps a little (held, the walk goes on: frame)
  function walkPress(button) {
    const w = walker;
    if (!w || w.home) return null;
    if (button === 'select') {
      if (!w.order.length) return null;
      w.tour = (w.tour + 1) % w.order.length;
      const id = w.order[w.tour], th = things.get(id), spot = w.spots.get(id);
      const z = sizeOf(th);
      w.target = standBefore(w.eye, spot, z.tall, { wide: z.wide, detail: z.detail, bounds: w.bounds });
      w.drawnAt = null;
      return { id };
    }
    if (button === 'back') { w.home = true; w.tour = -1; w.target = { ...HOME }; return null; }
    const from = w.target || w.eye, nudge = { left: [-0.26, 0], right: [0.26, 0], up: [0, 220], down: [0, -220] }[button];
    if (nudge) w.target = walk({ ...from, yaw: from.yaw + nudge[0] }, nudge[1] > 0 ? ['up'] : nudge[1] < 0 ? ['down'] : [], Math.abs(nudge[1]) / 560, { bounds: w.bounds });
    return null;
  }
  function walkEnd() {
    const w = walker;
    if (!w) return;
    walker = null;
    if (G) G.free(w.sky, w.ring, w.pool, w.dot);
    w.namesEl.remove();
    host.classList.remove('walking');
    drawnAt = null;
  }
  function walkFrame(now, held, step, scale) {
    const w = walker;
    const moving = !w.home && !!held && ['left', 'right', 'up', 'down'].some((b) => held.has(b));
    if (moving) { w.target = null; w.eye = walk(w.eye, held, step, { bounds: w.bounds }); }
    else if (w.target) {
      const g = glide(w.eye, w.target, 1 - Math.exp(-step * 2.6));
      w.eye = g.eye;
      if (g.there) {
        w.target = null;
        if (w.home) { const done = w.onHome; walkEnd(); done(); return; }
      }
    }
    // standing still, the night moves slowly: thirty frames a second; walking, every frame
    if (!moving && !w.target && w.drawnAt != null && now - w.drawnAt < 1 / 31) return;
    const dt = w.drawnAt == null ? 0 : Math.min(0.1, now - w.drawnAt);
    w.drawnAt = now;
    const eye = w.eye, f = S.eye.f, [rx, rz] = right(eye), at = w.tour >= 0 ? w.order[w.tour] : null, L = eye.lift || 0;
    const seen = (x, y, z) => { const v = view(eye, [x, y, z], S); return v && [v[0], v[1], v[2] / f]; };
    const all = (ps) => (ps.every(Boolean) ? ps : null);
    // a square on the water, its middle at x, z: what lies on it
    const flat = (x, z, r) => all([seen(x - r, 0, z + r), seen(x + r, 0, z + r), seen(x - r, 0, z - r), seen(x + r, 0, z - r)]);
    // a little light facing the eye, `r` world units across but never more than `most` pixels; and how far ahead it is
    const spark = (x, y, z, r, most) => { const v = seen(x, y, z); if (!v) return null; const s = Math.min(most, r / v[2]); return [[[v[0] - s, v[1] - s, 1], [v[0] + s, v[1] - s, 1], [v[0] - s, v[1] + s, 1], [v[0] + s, v[1] + s, 1]], v[2] * f]; };
    const drawn = { things: 0, reflections: 0, pools: 0, tags: 0, ring: 0, sparks: 0 };
    G.attach(host, { before: layer, scale });
    G.begin({ W: S.W, H: S.H });
    // the night all round, turning as the eye turns (three times round in a whole turn, about as fast
    // as what is far away goes by), and moving down the screen as the eye looks up
    const u = (eye.yaw * 3) / (2 * Math.PI);
    G.quad(w.sky, [[0, L - UP], [S.W, L - UP], [0, L + S.H], [S.W, L + S.H]], { opaque: true, uv: [u, 0, u + 1, 1] });
    // each thing facing the eye, moving as its shape moves, and upside down in the water; solid
    // things far to near, each over what is behind it, its shadow on the ground under it first (or,
    // at night, a pool of light round its foot)
    const placed = [];
    for (const th of things.values()) {
      const spot = w.spots.get(th.id);
      if (!spot || !th.L) continue;
      const on = th.id === at, { w: tw, h: thh, pad } = sizeOf(th), v = seen(spot.x, spot.rise, spot.z);
      placed.push({ th, spot, tw, thh, pad, on, far: v ? v[2] : -1 });
    }
    placed.sort((a, b) => b.far - a.far);
    for (const { th, spot, tw, thh, pad, on } of placed) {
      th.a += ((on || at == null ? 1 : 0.8) - th.a) * (1 - Math.exp(-dt / 0.25));
      const solid = !!th.L.toy;
      if (spot.rise <= 5) {
        const q = flat(spot.x, spot.z, tw * 0.5);
        if (q) { if (solid) G.quad(th.L.shadow, q, { alpha: 0.7, over: true }); else G.quad(w.pool, q); drawn.pools++; }
      }
      const q = poseOf(th.motion, now - born + th.phase, on ? 1 : 0.55, { size: th.size });
      const local = posed(0, 0, tw, thh, { ...q, dx: q.dx / th.p.k, dy: q.dy / th.p.k });
      const middle = spot.rise - pad + thh / 2;
      const points = local.map(([lx, ly]) => [spot.x + rx * lx, middle - ly, spot.z + rz * lx]);
      const it = all(points.map((pt) => seen(...pt))), mirror = all(points.map(([x, y, z]) => seen(x, -y, z)));
      if (mirror && reflect > 0 && mirrored(th) > 0) { G.quad(th.L, mirror, { alpha: th.a * reflect * mirrored(th), soft: true, over: solid }); drawn.reflections++; }
      if (it) { G.quad(th.L, it, { alpha: th.a, over: solid }); drawn.things++; }
    }
    // their names under them, as at home: on the water under what stands on it, under what is up in
    // the air; the one gone to brighter; a name that would cover a nearer one's fades
    const shown = [], named = placed.map((p) => ({ ...p, n: w.names.get(p.th.id), v: seen(p.spot.x, p.spot.rise, p.spot.z) })).filter((p) => p.n)
      .sort((a, b) => (a.v ? a.v[2] : 1e9) - (b.v ? b.v[2] : 1e9));
    for (const { n, on, v } of named) {
      if (n.on !== on) { n.on = on; n.el.classList.toggle('on', on); n.w = n.el.offsetWidth; n.h = n.el.offsetHeight; }
      let want = 0, t = n.t;
      if (v) {
        const x0 = Math.round(v[0] - n.w / 2), y0 = Math.round(v[1] + 14), box = [x0, y0, x0 + n.w, y0 + n.h];
        const covered = shown.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3]);
        want = (covered ? 0.08 : 1) * (on ? 1 : 0.8) * clamp((3800 - v[2] * f) / 2000, 0.35, 1);
        if (!covered && x0 < S.W && box[2] > 0 && y0 < S.H) shown.push(box);
        t = `translate3d(${x0}px, ${y0}px, 0)`;
      }
      n.a += (want - n.a) * (1 - Math.exp(-dt / 0.2));
      const o = n.a < 0.02 ? '0' : n.a.toFixed(2);
      if (n.t !== t) { n.el.style.transform = t; n.t = t; }
      if (n.o !== o) { n.el.style.opacity = o; n.o = o; }
      if (o !== '0') drawn.tags++;
    }
    const goneTo = at && placed.find((x) => x.th.id === at);
    if (goneTo && goneTo.spot.rise <= 5) {
      // small enough to be seen whole from where the eye stands
      const { spot, tw } = goneTo, q = flat(spot.x, spot.z, Math.min(Math.max(60, tw * 0.5), 0.3 * Math.hypot(spot.x - eye.x, spot.z - eye.z)));
      if (q) { G.quad(w.ring, q); drawn.ring++; }
    }
    // the paths of light on the water between things that came on the same night, and fireflies
    for (const l of links) {
      const a = w.spots.get(l.a), b = w.spots.get(l.b);
      if (!a || !b) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1, bend = 0.06 * d;
      // a few glints caught on the water, not a dotted route
      for (let i = 1, n = 16; i < n; i++) {
        const t = (i + 0.35 * Math.sin(i * 12.9898)) / n, s = Math.sin(t * Math.PI) * bend;
        const q = spark(a.x + dx * t - (dz / d) * s, 0, a.z + dz * t + (dx / d) * s, 6, 9);
        if (q) { G.quad(w.dot, q[0], { alpha: 0.24 }); drawn.sparks++; }
      }
    }
    for (const m of w.motes) {
      const ph = (((now + m.w) / m.d) % 2 + 2) % 2, e0 = ph < 1 ? ph : 2 - ph, e = e0 * e0 * (3 - 2 * e0);
      // snow falls, over and over; the rest rise and fall a little where they are
      const air = w.air, falls = air.kind === 'snow' || air.kind === 'petals' || air.kind === 'leaves';
      const y = falls ? 420 - ((((now + m.w * 9) * 40) % 440) + 440) % 440 : m.y + 30 * e;
      const q = spark(m.x, y, m.z, air.kind === 'fireflies' ? 9 : 6, air.kind === 'fireflies' ? 16 : 9);
      // one right by the eye fades, not a blur across the screen
      if (q) { G.quad(w.dot, q[0], { alpha: (0.2 + 0.75 * e) * clamp((q[1] - 60) / 260, 0, 1) }); drawn.sparks++; }
    }
    G.end({ clear: [0, 0, 0, 1] });
    w.drawn = drawn;
  }

  function clear() {
    walkEnd();
    if (G) { for (const th of things.values()) G.freeLight(th.L); G.free(backT); if (composedT) G.free(composedT); }
    things.clear(); backT = null; composedT = null;
    host.innerHTML = '';
    if (world === api) world = null;
  }
  drawBack();
  // the place painted, when it comes: laid over the drawing, and the paths drawn over it again
  function setBackdrop(img) {
    if (!place || !img) return false;
    paintSky(img);
    backWas = null;
    drawBack();
    drawnAt = null;
    return true;
  }
  // The world as it is on screen, without the names over it, for it to be painted as one
  // (compose.js): a frame drawn now and copied before the page shows it, `W` x `H`; null without a
  // GPU, on a walk, or with the painting as one already over it
  function snapshot({ W = 1536, H = 864 } = {}) {
    if (!G || !backT || walker || composedT) return null;
    drawnAt = null;
    frame(last == null ? 0 : last + 1 / 30);
    const c = canvasOf(W, H);
    c.getContext('2d').drawImage(G.canvas, 0, 0, W, H);
    return c;
  }
  // their world painted as one, over the place (it fades in); null takes it away again
  function setComposed(img) {
    if (!G) return false;
    if (composedT) { G.free(composedT); composedT = null; }
    composedAt = null;
    drawnAt = null;
    if (!img) return true;
    const c = canvasOf(S.W, S.H);
    c.getContext('2d').drawImage(img, 0, 0, S.W, S.H);
    composedT = G.upload(c);
    return true;
  }
  // a thing greeted: it hops where it stands (the next frame starts it)
  function greet(id) {
    const th = things.get(id);
    if (!th) return false;
    th.hop = true;
    hops.set(id, (hops.get(id) || 0) + 1);
    drawnAt = null;
    return true;
  }
  // which things are being made real on their own just now: they shimmer until their picture comes
  function making(id, on) {
    if (on) makingNow.add(id); else makingNow.delete(id);
    const th = things.get(id);
    if (th) { th.making = !!on; th.el.classList.toggle('making', !!on); }
    drawnAt = null;
  }
  const api = {
    set, choose, frame, clear, walkStart, walkPress, walkEnd, setBackdrop, making, greet, snapshot, setComposed,
    get painted() { return painted; },
    get composed() { return !!composedT; },
    get walking() { return !!walker; },
    // whether it can be walked through: drawn on the GPU
    get canWalk() { return !!G; },
    // for the tests: what is in it, which is chosen, and the walk: where the eye is, what it has
    // gone to, whether it is walking home, and what the last frame drew
    get state() {
      return {
        things: [...things.values()].map((t) => ({ id: t.id, motion: t.motion, foot: t.foot, k: t.p.k, lit: !!t.L, made: t.key.startsWith('made:'), came: !!t.came, making: !!t.making, hops: hops.get(t.id) || 0 })), chosen, scale: pace.scale,
        walk: walker && { eye: { x: Math.round(walker.eye.x), z: Math.round(walker.eye.z), yaw: Math.round(walker.eye.yaw * 1000) / 1000, h: Math.round(walker.eye.h), lift: Math.round(walker.eye.lift || 0) }, at: walker.tour >= 0 ? walker.order[walker.tour] : null, home: walker.home, moving: !!walker.target, drawn: walker.drawn },
      };
    },
  };
  world = api;
  return api;
}
