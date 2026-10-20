// A part of the painting cut out as its own picture: the strokes a line of the telling is about,
// which come alive as it is told (life.js); a thing of their world, for its card and its place on
// the map of their world; and each thing standing up out of the paper when they step inside it
// (inside.js).
//
// A painting is the paper times the ink: inkgl.js gives the two apart (layers()). So the ink of a
// stroke, lifted off and multiplied onto paper anywhere else, is that stroke; and where it was,
// the paper alone shows. For a painting kept as a picture (a JPEG of an earlier night), the ink is
// the picture divided by the paper it was painted on, which is the same sheet every night.
//
// What is cut is everything within reach of the strokes' paths, with a soft edge: a stroke's ink
// reaches past its path by the brush's width, and further where it bled or pooled.
//
// Paths and boxes are in paper units: the sheet is 1600 by 1000. The pure parts (reach, motion)
// are tested in Node; the rest draws on canvases.
import { shapeKind } from './engine/personal/arc.mjs';

export const UNITS = { W: 1600, H: 1000 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// How far past its path a stroke's ink reaches, in paper units: the brush's half-width, the
// ragged edge, and the halo of wet ink; light ink and water bleed further.
export const REACH = { dense: 30, light: 40, water: 40, indigo: 26, gold: 26, cinnabar: 26 };

// The box a cut covers, in paper units: every path, padded by its reach, and every pool by its
// size; within the sheet. `strokes`: [{ path: [[x, y]...], ink, pools: [[x, y]...] }].
export function reachOf(strokes, { pool = 70 } = {}) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    const r = REACH[s.ink] || REACH.dense;
    for (const [x, y] of s.path || []) { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); }
    for (const [x, y] of s.pools || []) { x0 = Math.min(x0, x - pool); y0 = Math.min(y0, y - pool); x1 = Math.max(x1, x + pool); y1 = Math.max(y1, y + pool); }
  }
  if (!(x1 > x0 && y1 > y0)) return null;
  return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(UNITS.W, Math.ceil(x1)), Math.min(UNITS.H, Math.ceil(y1))];
}

// How a part of the painting comes alive as it is told, by the shape of its main stroke (the
// longest): what stands tall rises; what is round glows; a winding line swims; a long one drifts;
// a dab twinkles; ink pooled where the brush was held breathes; a house settles.
export function motionOf(strokes) {
  const main = [...strokes].filter((s) => s && s.box).sort((a, b) => (b.length || 0) - (a.length || 0))[0];
  if (!main) return 'breathe';
  const kind = shapeKind({ ...main, length: main.length || 0 });
  if (kind === 'tall') return 'rise';
  if (kind === 'round') return 'glow';
  if (kind === 'wave' || (main.turn || 0) > 3.2) return 'swim';
  if (kind === 'dab') return (main.pools || []).length ? 'breathe' : 'twinkle';
  if (kind === 'house') return 'settle';
  if ((main.pools || []).length >= 2 && main.length < 160) return 'breathe';
  return 'drift';
}

// Where a moving part is at `t` seconds, `k` of the way in (0, still, to 1, fully alive): how far
// it has moved (sheet pixels), turned and leaned (degrees) and grown, and how bright its glow is.
// `size`: the part's width and height in sheet pixels, so a big part moves a little further.
export function poseOf(motion, t, k = 1, { size = [200, 200] } = {}) {
  const w = (period, phase = 0) => Math.sin((2 * Math.PI * t) / period + phase);
  const [bw, bh] = size;
  let dx = 0, dy = 0, rot = 0, skew = 0, scale = 1, glow = 0;
  switch (motion) {
    // up, and gently back down, with a little shiver
    case 'rise': dy = -clamp(bh * 0.06, 8, 22) * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 3.2)); dx = 1.2 * w(0.37); break;
    case 'glow': scale = 1 + 0.025 * w(3.4); glow = 0.62 + 0.3 * w(3.4); break;
    // a body that swims: it leans one way and the other, rising and falling as it goes
    case 'swim': skew = 4.5 * w(2.6); dy = clamp(bh * 0.05, 5, 12) * w(2.6, 0.9); rot = 1.2 * w(5.2); dx = 5 * w(5.2, 1.3); break;
    case 'drift': dx = clamp(bw * 0.02, 6, 16) * w(5.6); dy = 2 * w(3.7); break;
    case 'twinkle': scale = 1 + 0.12 * (0.5 + 0.5 * w(1.7)); rot = 5 * w(2.9); glow = 0.35 + 0.35 * w(1.7); break;
    case 'settle': scale = 1 + 0.014 * w(3.1); break;
    default: scale = 1 + 0.035 * w(3.2); break; // breathe
  }
  return { dx: dx * k, dy: dy * k, rot: rot * k, skew: skew * k, scale: 1 + (scale - 1) * k, glow: glow * k };
}

// How much a path turns, all told (radians): for a kept stroke, which keeps only its path
export function turnOf(path = []) {
  let turn = 0;
  for (let i = 2; i < path.length; i++) {
    const a = Math.atan2(path[i - 1][1] - path[i - 2][1], path[i - 1][0] - path[i - 2][0]);
    const b = Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]);
    turn += Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  }
  return Math.round(turn * 10) / 10;
}

// ---------------------------------------------------------------- on canvases

const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// The ink alone, from a picture of a painting and the paper it was painted on (the same size):
// the picture divided by the paper. 'color-dodge' with the paper's inverse divides.
export function inkOf(picture, paper) {
  const w = picture.naturalWidth || picture.width, h = picture.naturalHeight || picture.height;
  const inv = canvasOf(w, h), ig = inv.getContext('2d');
  ig.fillStyle = '#fff'; ig.fillRect(0, 0, w, h);
  ig.globalCompositeOperation = 'difference';
  ig.drawImage(paper, 0, 0, w, h);
  const out = canvasOf(w, h), g = out.getContext('2d');
  g.drawImage(picture, 0, 0, w, h);
  g.globalCompositeOperation = 'color-dodge';
  g.drawImage(inv, 0, 0);
  return out;
}

// The soft-edged shape of what is cut, drawn on a canvas of the cut's size: each path stroked as
// wide as its reach (grown by `grow` units), each pool a disc; blurred, unless `hard` (or in a few
// soft steps, `steps`, which is quicker than a blur).
export function maskOf(strokes, box, k, w, h, { grow = 0, hard = false, steps = false } = {}) {
  const m = canvasOf(w, h), g = m.getContext('2d');
  const draw = (gg, more) => {
    gg.strokeStyle = gg.fillStyle = '#fff'; gg.lineCap = 'round'; gg.lineJoin = 'round';
    for (const s of strokes) {
      const r = Math.max(2, (REACH[s.ink] || REACH.dense) + grow + more), pts = s.path || [];
      gg.lineWidth = 2 * r * k;
      gg.beginPath();
      pts.forEach(([x, y], i) => { const X = (x - box[0]) * k, Y = (y - box[1]) * k; if (!i) gg.moveTo(X, Y); else gg.lineTo(X, Y); });
      if (pts.length === 1) gg.lineTo((pts[0][0] - box[0]) * k + 0.1, (pts[0][1] - box[1]) * k);
      gg.stroke();
      for (const [x, y] of s.pools || []) { gg.beginPath(); gg.arc((x - box[0]) * k, (y - box[1]) * k, Math.max(2, 60 + grow + more) * k, 0, Math.PI * 2); gg.fill(); }
    }
  };
  if (hard) draw(g, 0);
  else if ('filter' in g && !steps) {
    const sharp = canvasOf(w, h);
    draw(sharp.getContext('2d'), -4);
    g.filter = `blur(${Math.max(2, 9 * k)}px)`;
    g.drawImage(sharp, 0, 0);
    g.filter = 'none';
  } else {
    // a soft edge in steps, where a canvas can't blur
    for (const [more, a] of [[6, 0.3], [2, 0.45], [-3, 1]]) { g.globalAlpha = a; draw(g, more); }
    g.globalAlpha = 1;
  }
  return m;
}

// Cut the strokes out. `layers`: the whole sheet as `painting`, the `paper` alone and the `ink`
// alone (canvases or images, the same size). `strokes`: [{ path, ink, pools }], in paper units.
// Returns the box cut (paper units), `k` (the layers' pixels per paper unit), and two canvases of
// the box's size: `ink`, the strokes' ink, white where nothing was cut (to be multiplied onto
// what is under it); and `still`, what stays where they were: the painting with that ink taken
// out (the paper alone at their heart). Laid one on the other, unmoved, they are the painting.
export function cutOut(layers, strokes, { box = reachOf(strokes) } = {}) {
  if (!box) return null;
  const k = (layers.ink.naturalWidth || layers.ink.width) / UNITS.W;
  const sx = box[0] * k, sy = box[1] * k, w = Math.max(1, Math.round((box[2] - box[0]) * k)), h = Math.max(1, Math.round((box[3] - box[1]) * k));
  const crop = (src, mask) => {
    const c = canvasOf(w, h), g = c.getContext('2d');
    g.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    if (mask) { g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0); }
    return c;
  };
  // the ink that moves: 1 - m (1 - ink), for the soft mask m
  const inkCut = canvasOf(w, h), ig = inkCut.getContext('2d');
  ig.fillStyle = '#fff'; ig.fillRect(0, 0, w, h);
  ig.drawImage(crop(layers.ink, maskOf(strokes, box, k, w, h)), 0, 0);
  // what stays: the painting divided by the ink that moves ('color-dodge' by its inverse divides)
  const inv = canvasOf(w, h), vg = inv.getContext('2d');
  vg.fillStyle = '#fff'; vg.fillRect(0, 0, w, h);
  vg.globalCompositeOperation = 'difference';
  vg.drawImage(inkCut, 0, 0);
  const still = crop(layers.painting), sg = still.getContext('2d');
  sg.globalCompositeOperation = 'color-dodge';
  sg.drawImage(inv, 0, 0);
  // at the strokes' heart, where the ink was darkest and the division least exact: the paper itself
  sg.globalCompositeOperation = 'source-over';
  sg.drawImage(crop(layers.paper, maskOf(strokes, box, k, w, h, { grow: -16, hard: true })), 0, 0);
  return { box, k, ink: inkCut, still };
}

// The ink alone, as a picture that can stand anywhere: each pixel's colour, and how much of the
// light it stops, so that laid on white paper it is the stroke again. The painting multiplies the
// ink onto the paper; this undoes that against white. `ink`: as cutOut() gives it, white where
// nothing was cut; clear there now. The faintest shades are taken for paper (`floor`, out of 255):
// a kept night's ink is a JPEG divided by the paper, and its noise would stand as a haze. Below
// the ink's lowest row, nothing is kept: a thing stands on where its ink ends.
export function inkAlone(ink, { floor = 14, foot = 24 } = {}) {
  const w = ink.width, h = ink.height, c = canvasOf(w, h), g = c.getContext('2d');
  g.drawImage(ink, 0, 0);
  const img = g.getImageData(0, 0, w, h), d = img.data, up = 255 / (255 - floor);
  let rows = 1;
  for (let i = 0; i < d.length; i += 4) {
    for (let j = i; j < i + 3; j++) d[j] = Math.min(255, d[j] * up);
    const lo = Math.min(d[i], d[i + 1], d[i + 2]), a = 255 - lo;
    if (a < 4) { d[i + 3] = 0; continue; }
    if (a >= foot) rows = Math.max(rows, Math.floor(i / 4 / w) + 1);
    // the colour that, this opaque over white, gives what was there
    d[i] = ((d[i] - lo) * 255) / a;
    d[i + 1] = ((d[i + 1] - lo) * 255) / a;
    d[i + 2] = ((d[i + 2] - lo) * 255) / a;
    d[i + 3] = a;
  }
  if (rows >= h) { g.putImageData(img, 0, 0); return c; }
  const out = canvasOf(w, rows);
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

// The ink as light, the way it is drawn into their world (inkgl.js, its light view): each pixel
// the colour the ink lets through, made bright (black ink a warm near-white), and as strong as the
// light the ink stops. `ink`: white where there is none, as cutOut() or inkOf() give it. The
// faintest shades are taken for none (`floor`, out of 255): a kept night's ink is a JPEG divided
// by the paper, and its noise would glow as a haze.
export function lightOf(r, g, b) {
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
  const chroma = clamp(((hi - lo) / (hi + 0.05)) * 1.25, 0, 1), m = Math.max(hi, 0.001);
  const mix = (warm, c) => warm + (c / m - warm) * chroma;
  return [mix(1, r), mix(0.98, g), mix(0.94, b), clamp((1 - lo) * 1.08, 0, 1)];
}
// `glow`: the soft light round it, in this picture's pixels (as inkgl.js draws it, 7 paper units)
export function inkAsLight(ink, { floor = 0, glow = 0 } = {}) {
  const w = ink.naturalWidth || ink.width, h = ink.naturalHeight || ink.height, c = canvasOf(w, h), g = c.getContext('2d');
  g.drawImage(ink, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), d = img.data, up = 255 / (255 - floor);
  for (let i = 0; i < d.length; i += 4) {
    const [r, gg, b, a] = lightOf(Math.min(255, d[i] * up) / 255, Math.min(255, d[i + 1] * up) / 255, Math.min(255, d[i + 2] * up) / 255);
    d[i] = r * 255; d[i + 1] = gg * 255; d[i + 2] = b * 255; d[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  if (!(glow > 0.5)) return c;
  const out = canvasOf(w, h), og = out.getContext('2d');
  og.shadowColor = 'rgba(255, 246, 228, 0.7)';
  og.shadowBlur = glow * 2.2;
  og.drawImage(c, 0, 0);
  return out;
}
// Strokes cut out as light, for a telling in their world: no paper to leave behind, so nothing
// stays (the light where they were is hidden while they move: inkgl.js setHoles).
export function cutLight(layers, strokes, { box = reachOf(strokes), floor = 0 } = {}) {
  const cut = cutOut(layers, strokes, { box });
  return cut && { box: cut.box, k: cut.k, ink: inkAsLight(cut.ink, { floor, glow: 7 * cut.k }), still: null, light: true };
}

// A shape's shadow: its silhouette, small, dark and soft. `of`: a canvas, clear where nothing is.
export function shadowOf(of, { scale = 1 / 3, blur = 3 } = {}) {
  const w = Math.max(1, Math.round(of.width * scale)), h = Math.max(1, Math.round(of.height * scale));
  const flat = canvasOf(w, h), fg = flat.getContext('2d');
  fg.drawImage(of, 0, 0, w, h);
  fg.globalCompositeOperation = 'source-in';
  fg.fillStyle = '#2e261c';
  fg.fillRect(0, 0, w, h);
  if (!('filter' in fg)) return flat;
  const soft = canvasOf(w, h), sg = soft.getContext('2d');
  sg.filter = `blur(${blur}px)`;
  sg.drawImage(flat, 0, 0);
  return soft;
}

// Each group of strokes lifted off the painting, its ink alone, to stand up by itself the way the
// pieces of a pop-up book do (inside.js); and the painting left behind without them, its ground.
// `groups`: [[stroke…]…], as cutOut takes them. Returns `ground`, a canvas the size of the layers;
// `k`, the layers' pixels per paper unit; and `cards`, one a group: { box (paper units), canvas
// (the box at the layers' scale: the ink, clear where there is none) }, or null for a group with
// nothing to cut.
export function liftOff(layers, groups) {
  const W = layers.ink.naturalWidth || layers.ink.width, H = layers.ink.naturalHeight || layers.ink.height, k = W / UNITS.W;
  // all the ink lifted off, over the whole sheet: white where nothing was
  const lifted = canvasOf(W, H), lg = lifted.getContext('2d');
  lg.fillStyle = '#fff'; lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = 'multiply';
  const cards = groups.map((strokes) => {
    const box = reachOf(strokes);
    if (!box) return null;
    const cut = cutOut(layers, strokes, { box });
    lg.drawImage(cut.ink, box[0] * k, box[1] * k);
    const alone = inkAlone(cut.ink);
    // the ink on white as well, as tall as what stands: what is lit at night (night.js)
    const ink = alone.height < cut.ink.height ? canvasOf(cut.ink.width, alone.height) : cut.ink;
    if (ink !== cut.ink) ink.getContext('2d').drawImage(cut.ink, 0, 0);
    return { box: [box[0], box[1], box[2], box[1] + alone.height / k], canvas: alone, ink };
  });
  // the ground: the painting divided by all that was lifted, and the paper itself at their hearts
  const inv = canvasOf(W, H), vg = inv.getContext('2d');
  vg.fillStyle = '#fff'; vg.fillRect(0, 0, W, H);
  vg.globalCompositeOperation = 'difference';
  vg.drawImage(lifted, 0, 0);
  const ground = canvasOf(W, H), gg = ground.getContext('2d');
  gg.drawImage(layers.painting, 0, 0, W, H);
  gg.globalCompositeOperation = 'color-dodge';
  gg.drawImage(inv, 0, 0);
  gg.globalCompositeOperation = 'source-over';
  groups.forEach((strokes, i) => {
    const c = cards[i];
    if (!c) return;
    const w = c.canvas.width, h = c.canvas.height;
    const core = canvasOf(w, h), cg = core.getContext('2d');
    cg.drawImage(layers.paper, c.box[0] * k, c.box[1] * k, w, h, 0, 0, w, h);
    cg.globalCompositeOperation = 'destination-in';
    cg.drawImage(maskOf(strokes, c.box, k, w, h, { grow: -16, hard: true }), 0, 0);
    gg.drawImage(core, c.box[0] * k, c.box[1] * k);
  });
  // and the ink left on the ground, on white, for the ground at night
  const groundInk = canvasOf(W, H), gi = groundInk.getContext('2d');
  gi.drawImage(layers.ink, 0, 0, W, H);
  gi.globalCompositeOperation = 'color-dodge';
  gi.drawImage(inv, 0, 0);
  return { ground, groundInk, k, cards };
}

// A stroke as a card or the map shows it: its ink alone, multiplied onto paper (a colour, or a
// picture of the paper, drawn to fill), fitted inside w x h. `cut`: from cutOut().
// A cut as light (cutLight), fitted into w x h, clear round it: for a card over their world at night
export function lightOnNight(cut, w, h, { pad = 0.1 } = {}) {
  const c = canvasOf(w, h), g = c.getContext('2d');
  const s = Math.min((w * (1 - 2 * pad)) / cut.ink.width, (h * (1 - 2 * pad)) / cut.ink.height);
  const dw = cut.ink.width * s, dh = cut.ink.height * s;
  g.drawImage(cut.ink, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}
export function inkOnPaper(cut, w, h, { paper = '#f4eee0', pad = 0.08 } = {}) {
  const c = canvasOf(w, h), g = c.getContext('2d');
  if (typeof paper === 'string') { g.fillStyle = paper; g.fillRect(0, 0, w, h); } else g.drawImage(paper, 0, 0, w, h);
  const s = Math.min((w * (1 - 2 * pad)) / cut.ink.width, (h * (1 - 2 * pad)) / cut.ink.height);
  const dw = cut.ink.width * s, dh = cut.ink.height * s;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(cut.ink, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}
