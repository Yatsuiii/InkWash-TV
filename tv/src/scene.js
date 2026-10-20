// A world's place, drawn: whatever scene its Set Designer wrote for it (engine/dreams/scene.mjs,
// server/scenery.mjs), out of a few kinds of part, so no world has a set background. The sky (or
// the roof) and its light, what stands far off, the ground and the haze are drawn here on a 2D
// canvas, going on round (its right edge meeting its left) so a walk can turn in it; the things
// painted into it are drawn on the GPU (glow.js), as `materialOf` says, and what drifts in the air
// by the walk (night.js).
import { checkScene, sceneTone, lightness } from './engine/dreams/index.mjs';

export { checkScene };
export const toneOf = (scene) => (scene ? sceneTone(scene) : 'night');

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296); }
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a = 1) => `rgba(${(typeof c === 'string' ? hex(c) : c).map((v) => Math.round(v)).join(',')},${a})`;
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`; };
const unit = (h) => hex(h).map((v) => v / 255);

// ---------------------------------------------------------------- the things in it

// How what they painted stands in it (glow.js `light`): null, as light (their ink glowing, as in
// the dark); or, in daylight, as their own ink (`keep`): the brushwork as they painted it, black,
// washes and coloured inks as they are, standing there with a little body (`relief`), lit a little
// from where the scene's light is, and with its shadow on the ground. Not re-coloured or rounded into
// tubes: a painted line stays a painted line. `n`: which thing (for the solid colours a material
// without `keep` is drawn in).
export function materialOf(scene, n = 0) {
  // what they drew is light in their world: it stands solid only in a place by day
  if (!scene || scene.things.style === 'light' || toneOf(scene) !== 'day') return null;
  return solidIn(scene, n);
}
// where the light in a place comes from (for shadows), whatever stands there
export const sunOf = (scene) => (scene ? solidIn(scene, 0).sun : null);
function solidIn(scene, n) {
  const L = scene.light, cs = scene.things.colors;
  const lit = L.kind === 'none' ? { x: 0.5, y: 0.2 } : L;
  // from where the light is, a little in front; a low sun lights from the side
  const dir = [clamp((lit.x - 0.5) * 1.8, -0.9, 0.9), clamp(-0.25 - (1 - lit.y) * 0.7, -0.95, -0.12), 0.62];
  const len = Math.hypot(...dir);
  return {
    toy: true, keep: true, relief: 0.22,
    base: unit(cs[((n % cs.length) + cs.length) % cs.length]),
    gold: unit('#ffc23a'), indigo: unit('#3f63ff'), cinnabar: unit('#ff4630'),
    sun: dir.map((v) => v / len), sunC: unit(L.kind === 'none' ? '#ffffff' : L.color),
    ambient: 0.9, gloss: 0.05, rim: 0, outline: 0,
    shadow: unit(scene.ground.shadow),
  };
}
export const reflectOf = (scene) => (scene ? scene.ground.shine : 0.3);

// A look as it is said to them: what it is, never what it isn't. The Set Designer is told what to
// keep away from ("never glossy"), and a look can carry that back; those parts aren't said.
export function lookSaid(look) {
  const parts = String(look || '').replace(/[.\s]+$/, '').split(/\s*[,;]\s*/).filter((p) => p && !/^(and |but )?(never|not|no|without|nothing)\b/i.test(p));
  return parts.join(', ');
}

// ---------------------------------------------------------------- drawing it

// Drawn as an ink-wash painting is, whatever the scene: its colours muted toward ink and paper (a
// scene asks for a meadow's green, and gets a green wash, not a cartoon's); its distances in layers
// of wash that fade into mist at their feet, the far ones paler; ridges with a brush's edge to them;
// mist lying in bands where a cartoon would stack round clouds; trees dabbed in; the ground washed,
// with a few dry-brush marks; and the grain of the paper over all of it.

// a colour as an ink painter would mix it: `k` of its saturation gone, and a little of the paper
// (light colours) or of the ink (dark ones) in it
function inked(h, k = 0.5) {
  const [r, g, b] = hex(h).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let hh = 0, sat = 0;
  if (mx !== mn) {
    const d = mx - mn; sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6;
  }
  sat *= 1 - k;
  const f = (t) => { t = (t + 1) % 1; const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const c = `#${[f(hh + 1 / 3), f(hh), f(hh - 1 / 3)].map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
  return mix(c, l > 0.55 ? '#efe8da' : '#20222a', 0.12);
}
// a ridge going on round: a sum of waves that each fit the width a whole number of times, 0 to 1
function ridgeOf(rnd, freqs) {
  const waves = freqs.map((f, i) => ({ f, a: 1 / (i + 1) ** 0.9, p: rnd() * Math.PI * 2 }));
  const sum = waves.reduce((t, w) => t + w.a, 0);
  return (u) => 0.5 + 0.5 * waves.reduce((t, w) => t + w.a * Math.sin(2 * Math.PI * w.f * u + w.p), 0) / sum;
}

// Its sky and ground, W x H with the ground below `horizon`, going on round; and `up` pixels more
// of sky above, to look up into (the canvas H + up tall). `stage: false`: only that sky above.
// `bare`: its layout alone, for an image model to paint over (no grain, no marks, no stars).
export function drawSceneAround(g, { W, H, horizon, seed = 5, up = 0, stage = true, scene, bare = false }) {
  const raw = bare ? { ...scene, sky: { ...scene.sky, stars: 0 } } : scene, rnd = rand(seed);
  // the scene's colours, mixed as ink is
  const s = {
    ...raw,
    sky: { ...raw.sky, top: inked(raw.sky.top, 0.45), middle: inked(raw.sky.middle, 0.45), bottom: inked(raw.sky.bottom, 0.4), cloud: inked(raw.sky.cloud, 0.5), cloudShade: inked(raw.sky.cloudShade, 0.5) },
    light: { ...raw.light, color: inked(raw.light.color, 0.25) },
    far: raw.far.map((f) => ({ ...f, color: inked(f.color, 0.55), ...(f.top ? { top: inked(f.top, 0.5) } : {}), ...(f.windows ? { windows: inked(f.windows, 0.2) } : {}) })),
    ground: { ...raw.ground, far: inked(raw.ground.far, 0.55), near: inked(raw.ground.near, 0.55), shadow: inked(raw.ground.shadow, 0.5) },
    haze: { ...raw.haze, color: inked(raw.haze.color, 0.45) },
  };
  // what they drew glows here: what it stands against below the sky is kept deep enough for its
  // light to show (a pale ground under light is a white page again)
  if (!materialOf(raw)) {
    const deep = (h, max) => { let c = h; for (let i = 0; i < 10 && lightness(c) > max; i++) c = mix(c, '#141826', 0.22); return c; };
    Object.assign(s, {
      sky: { ...s.sky, bottom: deep(s.sky.bottom, 0.3) },
      far: s.far.map((f) => ({ ...f, color: deep(f.color, 0.24) })),
      ground: { ...s.ground, far: deep(s.ground.far, 0.2), near: deep(s.ground.near, 0.16) },
      haze: { ...s.haze, color: deep(s.haze.color, 0.24) },
    });
  }
  g.save();
  g.translate(0, up);
  // a wash of colour round a point, going on round; `sx`, `sy` stretch it (a band of mist is wide)
  const wash = (x, y, r, c, a, y0 = -up, y1 = stage ? H : 0, sx = 1, sy = 1) => {
    for (const dx of [-W, 0, W]) {
      const cx = x + dx, a0 = Math.max(0, cx - r * sx), a1 = Math.min(W, cx + r * sx), b0 = Math.max(y0, y - r * sy), b1 = Math.min(y1, y + r * sy);
      if (a1 <= a0 || b1 <= b0) continue;
      g.save(); g.beginPath(); g.rect(a0, b0, a1 - a0, b1 - b0); g.clip();
      g.translate(cx, y); g.scale(sx, sy);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.55, rgba(c, a * 0.45)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
  };
  const C = { W, H, horizon, up, stage, rnd, s, wash, g, bare };
  sky(C);
  if (stage) {
    s.far.forEach((f, i) => { far(C, f, i, s.far.length); haze(C, 0.4 * (1 - (i + 1) / (s.far.length + 1))); });
    haze(C, 1);
    ground(C);
    if (!bare) paper(C);
  }
  g.restore();
}

function sky({ g, W, H, horizon, up, stage, rnd, s, wash, bare }) {
  const { top, middle, bottom } = s.sky;
  if (up) { const gr = g.createLinearGradient(0, -up, 0, 0); gr.addColorStop(0, mix(top, '#000000', s.roof ? 0.3 : 0.12)); gr.addColorStop(1, top); g.fillStyle = gr; g.fillRect(0, -up, W, up); }
  if (stage) {
    const gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, top); gr.addColorStop(0.55, middle); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, W, horizon);
  }
  // the wash is never even: wide, faint blooms of it, a shade darker or lighter
  if (!bare) for (let k = 0; k < 12; k++) wash(rnd() * W, -up + rnd() * (horizon + up), W * (0.1 + rnd() * 0.18), rnd() < 0.5 ? mix(top, '#000000', 0.25) : mix(bottom, '#ffffff', 0.25), 0.07, -up, stage ? horizon : 0, 1.8, 0.7);
  // stars: as many as it has, small and soft
  if (s.sky.stars > 0) {
    const n = Math.round(((W * (horizon + up)) / 5200) * s.sky.stars);
    for (let k = 0; k < n; k++) {
      const x = rnd() * W, y = -up + Math.pow(rnd(), 1.4) * (horizon + up) * 0.88, r = rnd() < 0.05 ? 1.6 : rnd() < 0.3 ? 1 : 0.6;
      if (!stage && y > 0) continue;
      g.fillStyle = `rgba(250,244,228,${((0.15 + rnd() * 0.6) * (1 - Math.max(0, y) / horizon * 0.85)).toFixed(3)})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }
  // its light: a sun or a moon as a soft disc of wash, never a hard one; lamps glowing; or none
  const L = s.light;
  if (L.kind === 'sun' || L.kind === 'moon') {
    const x = W * L.x, y = Math.min(horizon - 8, horizon * L.y);
    if (stage || y < 0) {
      wash(x, y, W * (0.14 + 0.3 * L.glow), L.color, 0.22 + 0.25 * L.glow, -up, stage ? H : 0);
      const r = W * (L.kind === 'sun' ? 0.03 : 0.026);
      const d = g.createRadialGradient(x, y, 0, x, y, r * 1.25);
      d.addColorStop(0, rgba(mix(L.color, '#ffffff', 0.45), 0.95)); d.addColorStop(0.72, rgba(mix(L.color, '#ffffff', 0.3), 0.85)); d.addColorStop(1, rgba(L.color, 0));
      g.fillStyle = d; g.beginPath(); g.arc(x, y, r * 1.25, 0, Math.PI * 2); g.fill();
      if (L.kind === 'moon') { g.fillStyle = rgba(mix(L.color, '#000000', 0.25), 0.1); for (let k = 0; k < 6; k++) { const a = rnd() * Math.PI * 2, dd = Math.sqrt(rnd()) * r * 0.6; g.beginPath(); g.arc(x + Math.cos(a) * dd, y + Math.sin(a) * dd, r * (0.08 + rnd() * 0.14), 0, Math.PI * 2); g.fill(); } }
    }
  } else if (L.kind === 'lamps') {
    for (let k = 0; k < 9; k++) {
      const x = (k + 0.2 + rnd() * 0.6) * (W / 9), y = horizon * (0.15 + rnd() * 0.7);
      if (!stage && y > 0) continue;
      wash(x, y, W * (0.05 + 0.06 * L.glow), L.color, 0.26 + 0.2 * L.glow);
      wash(x, y, W * 0.007, mix(L.color, '#ffffff', 0.5), 0.9);
    }
  }
  // clouds: mist lying in long bands, a little lighter on top and a shade below, going on round
  const n = Math.round(9 * s.sky.clouds);
  for (let k = 0; k < n; k++) {
    const cx = rnd() * W, cy = -up * 0.6 + (0.1 + rnd() * 0.65) * (horizon + up * 0.6), w = W * (0.1 + rnd() * 0.16);
    if (!stage && cy > 0) continue;
    mist(wash, cx, cy, w, rnd, s.sky.cloud, s.sky.cloudShade, -up, stage ? horizon + 20 : 0);
  }
  // under a roof, the ceiling darkens up into itself
  if (s.roof && stage) {
    const v = g.createLinearGradient(0, 0, 0, horizon * 0.45);
    v.addColorStop(0, rgba('#000000', 0.45)); v.addColorStop(1, rgba('#000000', 0));
    g.fillStyle = v; g.fillRect(0, 0, W, horizon * 0.45);
  }
}

// a bank of mist: a few long soft strokes of wash, one over another
function mist(wash, cx, cy, w, rnd, lit, shade, y0, y1) {
  wash(cx + w * 0.1, cy + w * 0.05, w * 0.5, shade, 0.22, y0, y1, 2.4, 0.16);
  for (let i = 0; i < 3; i++) wash(cx + (rnd() - 0.5) * w * 0.8, cy - i * w * 0.025 + (rnd() - 0.5) * w * 0.03, w * (0.35 + rnd() * 0.25), lit, 0.3 + rnd() * 0.15, y0, y1, 2.6, 0.12);
}

function haze({ g, W, H, horizon, s }, k) {
  if (!k || !s.haze.amount) return;
  const h = H * (0.06 + 0.1 * s.haze.amount);
  const gr = g.createLinearGradient(0, horizon - h, 0, horizon);
  gr.addColorStop(0, rgba(s.haze.color, 0)); gr.addColorStop(1, rgba(s.haze.color, Math.min(0.85, (0.25 + s.haze.amount * 0.7) * k)));
  g.fillStyle = gr; g.fillRect(0, horizon - h, W, h);
}

// What stands far off: in layers of wash, the farther paler, each darker along its ridge and fading
// into mist at its foot, with a brush's edge on top; trees dabbed; buildings as dark shapes with their
// windows glowing
function far(C, f, i, n) {
  const { g, W, horizon, rnd, s } = C;
  // ranges stand taller than a flat shape would: a painted range is most of the picture's top
  const ranges = ['mountains', 'cliffs', 'hills', 'dunes'].includes(f.shape);
  const h = horizon * f.height * (ranges ? 1.8 : 1), base = horizon + 1;
  const along = (count, draw) => { for (let k = 0; k < count; k++) { const x = (k + rnd() * 0.8) * (W / count); for (const dx of [-W, 0, W]) draw(x + dx, k); } };
  const light = s.light.kind === 'none' ? 0.6 : s.light.x;
  // the nearer layers darker, as a painter lays them
  const col = mix(f.color, s.haze.color, 0.25 * (1 - (i + 1) / n));
  // a silhouette from its ridge: dark along the top and gone to mist at the foot, then the ridge
  // gone over again in a few dry strokes
  const silhouette = (at, { foot = 0.85, edge = 1, top = null }) => {
    const path = () => { g.beginPath(); g.moveTo(0, base); for (let x = 0; x <= W; x += 3) g.lineTo(x, at(x / W)); g.lineTo(W, base); g.closePath(); };
    const gr = g.createLinearGradient(0, base - h, 0, base);
    gr.addColorStop(0, rgba(col, 0.96)); gr.addColorStop(0.45, rgba(col, 0.82)); gr.addColorStop(foot, rgba(mix(col, s.haze.color, 0.6), 0.35)); gr.addColorStop(1, rgba(s.haze.color, 0.08));
    path(); g.fillStyle = gr; g.fill();
    if (C.bare) return;
    g.save(); path(); g.clip();
    // its texture: dry strokes running down from the ridge, as a painter models a mountain's face,
    // more of them on the side away from the light
    g.lineCap = 'round';
    for (let x = 0; x < W; x += 9) {
      const y = at(x / W), slope = at(Math.min(1, (x + 6) / W)) - y, away = (light > 0.5 ? slope > 0 : slope < 0);
      if (rnd() > (away ? 0.55 : 0.18)) continue;
      const len = (base - y) * (0.2 + rnd() * 0.45), lean = (rnd() - 0.5) * 0.5 + (slope > 0 ? 0.25 : -0.25);
      g.strokeStyle = rgba(mix(col, '#000000', 0.4), 0.06 + rnd() * 0.1); g.lineWidth = 1 + rnd() * 3;
      g.beginPath(); g.moveTo(x, y + 2); g.quadraticCurveTo(x + lean * len * 0.4, y + len * 0.5, x + lean * len, y + len); g.stroke();
    }
    // its tops left as the paper, as a painter leaves snow or light: a pale wash just under the ridge
    if (top) { const tg = g.createLinearGradient(0, base - h, 0, base - h * 0.45); tg.addColorStop(0, rgba(top, 0.35)); tg.addColorStop(1, rgba(top, 0)); g.fillStyle = tg; g.fillRect(0, base - h, W, h * 0.55); }
    g.restore();
    // the ridge, gone over with the brush: dark, broken, thicker and thinner
    g.strokeStyle = rgba(mix(col, '#000000', 0.45), 0.5 * edge); g.lineCap = 'round';
    for (let x = 0; x < W;) {
      const len = 30 + rnd() * 110, w = 0.8 + rnd() * 2.2;
      g.lineWidth = w; g.beginPath();
      for (let t = 0; t <= len && x + t <= W; t += 6) { const y = at((x + t) / W) + 0.5; if (t) g.lineTo(x + t, y); else g.moveTo(x + t, y); }
      g.stroke(); x += len + rnd() * 40;
    }
  };
  if (f.shape === 'mountains' || f.shape === 'cliffs' || f.shape === 'hills' || f.shape === 'dunes') {
    const R = ridgeOf(rnd, f.shape === 'mountains' ? [3, 5, 8, 13, 21, 34, 55] : f.shape === 'cliffs' ? [2, 4, 7, 19, 40] : f.shape === 'hills' ? [2, 3, 5, 9] : [1, 2, 3, 6]);
    const at = f.shape === 'mountains' ? (u) => base - h * (0.12 + 0.88 * Math.pow(R(u), 1.7))
      : f.shape === 'cliffs' ? (u) => base - h * (0.15 + 0.85 * clamp((R(u) - 0.32) * 2.6, 0, 1) ** 0.6)
      : f.shape === 'hills' ? (u) => base - h * (0.25 + 0.75 * R(u))
      : (u) => base - h * (0.2 + 0.8 * Math.pow(R(u), 1.2));
    silhouette(at, { top: f.top || null, edge: f.shape === 'dunes' ? 0.4 : 1 });
    return;
  }
  if (f.shape === 'waves') {
    // the sea far off: long, thin strokes of ink lying along it
    for (let k = 0; k < 70; k++) { const y = base - h * Math.pow(rnd(), 0.7), x = rnd() * W, l = 40 + rnd() * 160; g.strokeStyle = rgba(rnd() < 0.7 ? col : (f.top || '#ffffff'), 0.25 + rnd() * 0.35); g.lineWidth = 0.8 + rnd() * 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 1.5 - rnd() * 2, x + l, y); g.stroke(); }
    return;
  }
  if (f.shape === 'clouds') {
    along(9, (x) => mist(C.wash, x, base - h * 0.45, h * 2.4, rnd, f.top || mix(col, '#ffffff', 0.4), col, -C.up, horizon + 30));
    return;
  }
  if (f.shape === 'trees') {
    // dabbed in: each tree a few blots of ink round a trunk's thin line, pines in strokes across
    const pointed = rnd() < 0.5;
    along(Math.round(W / 30), (x) => {
      const th = h * (0.45 + rnd() * 0.55), a = 0.45 + rnd() * 0.4;
      g.strokeStyle = rgba(col, a * 0.8); g.lineWidth = Math.max(1, th * 0.04); g.beginPath(); g.moveTo(x, base); g.lineTo(x + (rnd() - 0.5) * th * 0.08, base - th * 0.85); g.stroke();
      g.fillStyle = rgba(col, a);
      if (pointed) {
        for (let r = 0; r < 6; r++) { const y = base - th * (0.25 + r * 0.12), w = th * 0.34 * (1 - r / 7); g.beginPath(); g.ellipse(x + (rnd() - 0.5) * 2, y, w * (0.8 + rnd() * 0.4), Math.max(1.2, th * 0.035), (rnd() - 0.5) * 0.2, 0, Math.PI * 2); g.fill(); }
      } else {
        for (let b = 0; b < 7; b++) { const ang = rnd() * Math.PI * 2, d = rnd() * th * 0.22; g.beginPath(); g.ellipse(x + Math.cos(ang) * d * 1.2, base - th * 0.68 + Math.sin(ang) * d, th * (0.1 + rnd() * 0.1), th * (0.07 + rnd() * 0.07), rnd() * Math.PI, 0, Math.PI * 2); g.fill(); }
      }
    });
    return;
  }
  if (f.shape === 'towers' || f.shape === 'roofs' || f.shape === 'pillars') {
    const count = f.shape === 'roofs' ? Math.round(W / 70) : f.shape === 'pillars' ? Math.round(W / 90) : Math.round(W / 120);
    along(count, (x) => {
      const bh = h * (f.shape === 'roofs' ? 0.35 + rnd() * 0.35 : 0.5 + rnd() * 0.5), bw = f.shape === 'pillars' ? h * 0.08 : f.shape === 'roofs' ? W / count * (0.7 + rnd() * 0.4) : h * (0.12 + rnd() * 0.12);
      const gr = g.createLinearGradient(0, base - bh, 0, base);
      gr.addColorStop(0, rgba(col, 0.95)); gr.addColorStop(0.7, rgba(col, 0.8)); gr.addColorStop(1, rgba(mix(col, s.haze.color, 0.6), 0.4));
      g.fillStyle = gr;
      g.fillRect(x - bw / 2, base - bh, bw, bh);
      g.beginPath();
      if (f.shape === 'roofs') { g.moveTo(x - bw * 0.6, base - bh + 2); g.quadraticCurveTo(x - bw * 0.2, base - bh - bw * 0.2, x, base - bh - bw * 0.4); g.quadraticCurveTo(x + bw * 0.2, base - bh - bw * 0.2, x + bw * 0.6, base - bh + 2); g.closePath(); }
      else if (f.shape === 'pillars') { g.rect(x - bw * 0.8, base - bh - bw * 0.35, bw * 1.6, bw * 0.35); }
      else if (rnd() < 0.5) { g.moveTo(x - bw / 2, base - bh); g.lineTo(x, base - bh - bw * 1.4); g.lineTo(x + bw / 2, base - bh); g.closePath(); }
      else g.arc(x, base - bh, bw / 2, Math.PI, 0);
      g.fillStyle = rgba(col, 0.95); g.fill();
      if (f.top) { g.fillStyle = rgba(f.top, 0.4); g.fillRect(light > 0.5 ? x + bw * 0.25 : x - bw / 2, base - bh, bw * 0.25, bh * 0.6); }
      if (f.windows && f.shape !== 'pillars') {
        const cols = Math.max(1, Math.round(bw / 9)), rows = Math.max(1, Math.round(bh / 14));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (rnd() < 0.35) {
          const wx = x - bw / 2 + (c + 0.5) * (bw / cols), wy = base - bh + (r + 0.5) * (bh / rows);
          C.wash(wx, wy, Math.max(4, bw / cols), f.windows, 0.35);
          g.fillStyle = rgba(f.windows, 0.85); g.fillRect(wx - 1, wy - 1.5, Math.max(1.5, bw / cols * 0.3), Math.max(2, bh / rows * 0.3));
        }
      }
    });
    return;
  }
  if (f.shape === 'shelves') {
    for (const [y0, hh, a] of [[base - h, h * 0.3, 0.7], [base - h * 0.62, h * 0.3, 0.85], [base - h * 0.3, h * 0.3, 1]]) {
      g.fillStyle = rgba(col, a); g.fillRect(0, y0, W, hh);
      for (let x = 0; x < W; x += 3 + rnd() * 7) {
        const bw = 2 + rnd() * 5, bh = hh * (0.55 + rnd() * 0.4);
        g.fillStyle = rgba(mix(col, rnd() < 0.5 ? '#6a3a2a' : '#a8905a', 0.25 + rnd() * 0.25), a);
        g.fillRect(x, y0 + hh - bh, bw, bh);
      }
      if (f.windows) { g.fillStyle = rgba(f.windows, 0.25 * a); g.fillRect(0, y0 + hh - 3, W, 3); }
    }
    return;
  }
  if (f.shape === 'arches') {
    const count = Math.round(W / 120), aw = W / count;
    g.save(); g.beginPath(); g.rect(0, base - h, W, h);
    for (let k = 0; k < count; k++) { const x = k * aw + aw / 2, r = aw * 0.32; g.moveTo(x - r, base); g.lineTo(x - r, base - h * 0.55); g.arc(x, base - h * 0.55, r, Math.PI, 0); g.lineTo(x + r, base); g.closePath(); }
    g.fillStyle = rgba(col, 0.92); g.fill('evenodd'); g.restore();
    if (f.top) { g.fillStyle = rgba(f.top, 0.6); g.fillRect(0, base - h, W, Math.max(2, h * 0.05)); }
  }
}

// Underfoot: washed in, its colours from far to near, with a few marks of its own; water left
// smooth, for the things it holds upside down
function ground({ g, W, H, horizon, rnd, s, wash, bare }) {
  const G = s.ground, depth = (y) => (y - horizon) / (H - horizon);
  const gr = g.createLinearGradient(0, horizon, 0, H);
  gr.addColorStop(0, G.far); gr.addColorStop(1, G.near);
  g.fillStyle = gr; g.fillRect(0, horizon, W, H - horizon);
  if (bare) return;
  const L = s.light, lit = L.kind === 'sun' || L.kind === 'moon';
  const dark = (a) => rgba(mix(G.near, '#000000', 0.55), a), pale = (a) => rgba(mix(G.far, '#ffffff', 0.45), a);
  // the wash is never even here either: wide, flat blooms of it
  for (let k = 0; k < 10; k++) { const y = horizon + Math.pow(rnd(), 0.8) * (H - horizon); wash(rnd() * W, y, W * (0.08 + rnd() * 0.14) * (0.5 + depth(y)), rnd() < 0.6 ? mix(G.near, '#000000', 0.3) : mix(G.far, '#ffffff', 0.3), 0.1, horizon, H, 3, 0.35); }
  // a stroke lying across it, thin far off and broad near
  const lie = (y, a, c) => { const d = depth(y), x = rnd() * W, l = 60 + d * 380 * (0.5 + rnd()); g.strokeStyle = c(a); g.lineWidth = 0.8 + d * 5 * rnd(); g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + (rnd() - 0.5) * 3, x + l, y + (rnd() - 0.5) * 2); g.stroke(); };
  if (G.kind === 'water') {
    const shine = g.createLinearGradient(0, horizon, 0, horizon + H * 0.14);
    shine.addColorStop(0, rgba(s.sky.bottom, 0.45)); shine.addColorStop(1, rgba(s.sky.bottom, 0));
    g.fillStyle = shine; g.fillRect(0, horizon, W, H * 0.14);
    // the light's path across it, in soft broken strokes
    if (lit) for (let k = 0; k < 110; k++) { const d = Math.pow(rnd(), 1.3), y = horizon + d * (H - horizon), x = W * L.x + (rnd() - 0.5) * (30 + d * 300); g.strokeStyle = rgba(L.color, 0.35 * (1 - d) + 0.06); g.lineWidth = 1 + d * 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + d * 40, y); g.stroke(); }
    for (let k = 0; k < 70; k++) lie(horizon + Math.pow(rnd(), 1.5) * (H - horizon), 0.05 + rnd() * 0.08, rnd() < 0.5 ? dark : pale);
    return;
  }
  if (G.kind === 'grass') {
    // grass, as a painter puts it in: a few tufts, quick upward flicks of the brush, more near
    for (let k = 0; k < 150; k++) {
      const y = horizon + Math.pow(rnd(), 0.7) * (H - horizon), d = depth(y), x = rnd() * W, h = 4 + d * 34 * (0.5 + rnd()), a = 0.12 + d * 0.3;
      g.strokeStyle = dark(a); g.lineCap = 'round';
      for (let b = 0; b < 3 + Math.floor(rnd() * 4); b++) { const bx = x + (rnd() - 0.5) * h * 0.6; g.lineWidth = 0.6 + d * 2.4 * rnd(); g.beginPath(); g.moveTo(bx, y); g.quadraticCurveTo(bx + (rnd() - 0.5) * h * 0.4, y - h * 0.55, bx + (rnd() - 0.5) * h * 0.7, y - h * (0.7 + rnd() * 0.3)); g.stroke(); }
    }
    for (let k = 0; k < 40; k++) lie(horizon + Math.pow(rnd(), 1.2) * (H - horizon), 0.06 + rnd() * 0.06, rnd() < 0.6 ? dark : pale);
  } else if (G.kind === 'snow') {
    for (let k = 0; k < 22; k++) { const y = horizon + Math.pow(rnd(), 0.9) * (H - horizon); wash(rnd() * W, y, W * (0.08 + rnd() * 0.16) * (0.4 + depth(y)), G.shadow, 0.2, horizon, H, 1, 0.18); }
    for (let k = 0; k < 30; k++) lie(horizon + rnd() * (H - horizon), 0.08, dark);
  } else if (G.kind === 'boards' || G.kind === 'tiles') {
    // rows that widen toward the eye, their joints staggered; tiles alternate
    let row = 0;
    for (let y = horizon + 4, d = 5; y < H; d *= 1.16, y += d, row++) {
      g.fillStyle = dark(0.16 + depth(y) * 0.2); g.fillRect(0, y, W, Math.max(1, d * 0.07));
      const n = G.kind === 'tiles' ? Math.max(6, Math.round(W / (d * 2.2))) : Math.max(3, Math.round(W / (d * 9)));
      for (let k = 0; k < n; k++) {
        const x = ((k + (row % 2) * 0.5) / n) * W;
        if (G.kind === 'tiles' && (k + row) % 2) { g.fillStyle = pale(0.1); g.fillRect(x, y, W / n, d); }
        g.fillStyle = dark(0.18); g.fillRect(x, y, Math.max(1, d * 0.05), d);
      }
    }
    if (s.light.kind === 'lamps') for (let k = 0; k < 5; k++) wash(rnd() * W, horizon + (0.2 + rnd() * 0.7) * (H - horizon), W * 0.16, s.light.color, 0.16);
  } else if (G.kind === 'stone') {
    for (let k = 0; k < 260; k++) { const y = horizon + Math.pow(rnd(), 0.85) * (H - horizon), d = depth(y), x = rnd() * W, r = 2 + d * 26 * (0.6 + rnd() * 0.6); g.strokeStyle = dark(0.12 + d * 0.15); g.lineWidth = 0.6 + d * 1.6; g.beginPath(); g.ellipse(x, y, r, r * 0.4, 0, rnd() * Math.PI, rnd() * Math.PI + Math.PI * (0.6 + rnd() * 0.6)); g.stroke(); }
  } else if (G.kind === 'sand') {
    for (let row = 0; row < 16; row++) { const y = horizon + Math.pow((row + 1) / 16, 1.5) * (H - horizon), ph = rnd() * 9; g.strokeStyle = dark(0.08 + depth(y) * 0.08); g.lineWidth = 0.8 + depth(y) * 2.5; g.beginPath(); for (let x = 0; x <= W; x += 8) { const yy = y + Math.sin((x / W) * Math.PI * 2 * 5 + ph) * (2 + depth(y) * 9); if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); }
  } else if (G.kind === 'clouds') {
    for (let row = 0; row < 7; row++) {
      const d = (row + 1) / 7, y = horizon + Math.pow(d, 1.6) * (H - horizon), w = W * (0.06 + d * 0.14);
      for (let x = -w; x < W + w; x += w * (1 + rnd() * 0.7)) mist(wash, x, y, w, rnd, G.near, G.shadow, horizon, H);
    }
  }
  // near, at the picture's edges by water or on grass: a few reeds in dark ink, so the ground has a
  // near and a far; never under a roof
  if (!s.roof && G.kind !== 'clouds') {
    const reeds = G.kind === 'water' || G.kind === 'grass';
    if (reeds) for (const side of [0, 1]) {
      const cx = side ? W * (0.86 + rnd() * 0.1) : W * (0.04 + rnd() * 0.1);
      if (reeds) {
        for (let b = 0; b < 14; b++) {
          const x = cx + (rnd() - 0.5) * W * 0.07, y = H + 4, hgt = (H - horizon) * (0.12 + rnd() * 0.26), bend = (rnd() - 0.5) * hgt * 0.5;
          g.strokeStyle = rgba(mix(G.near, '#000000', 0.7), 0.35 + rnd() * 0.35); g.lineWidth = 1.2 + rnd() * 2.6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + bend * 0.3, y - hgt * 0.6, x + bend, y - hgt); g.stroke();
        }
      }
    }
  }
  // the light falling on it
  if (lit) wash(W * L.x, horizon + (H - horizon) * 0.3, W * 0.4, L.color, 0.1 + 0.1 * L.glow, horizon, H, 1.6, 0.5);
  // where it meets the sky, softened
  const edge = g.createLinearGradient(0, horizon, 0, horizon + H * 0.05);
  edge.addColorStop(0, rgba(s.haze.color, 0.3 + 0.4 * s.haze.amount)); edge.addColorStop(1, rgba(s.haze.color, 0));
  g.fillStyle = edge; g.fillRect(0, horizon, W, H * 0.05);
}

// the paper it is painted on: its grain and fibres over all of it, and its edges a little darker
function paper({ g, W, H, rnd }) {
  for (let k = 0; k < 5200; k++) { const v = rnd() < 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${(0.025 + rnd() * 0.035).toFixed(3)})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
  g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 0.7;
  for (let k = 0; k < 140; k++) { const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, l = 8 + rnd() * 26; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const v = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.45, W / 2, H * 0.45, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,14,8,0.22)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}
