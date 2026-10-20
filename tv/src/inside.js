// Step inside. Once a dream is told, the painting can open into a world to walk into: the paper
// tips back and becomes the still water of a night, the sky and its stars come up all round, and
// each thing they painted stands up from where they painted it, its own ink in its own light, the
// way a pop-up book opens, with a pool of its light on the water and its reflection below. Higher
// up the page stands further away, and what was painted near the top is up in the air (the moon,
// the stars, a bird, a dragon in flight); washes and long flat strokes (water, a shore, a horizon)
// stay painted on the water, lit. The remote walks: ◀ ▶ turn, ▲ ▼ step in and out; OK goes to each
// thing with a name in turn, with the line the telling gave it; Back folds it all back into the
// painting. The world turns on its middle, like a pop-up book turned round on a table, so it is
// always in view.
//
// Made from what the TV already has: the painting's own ink (inkgl.js layers, or a kept night's
// picture divided by its paper), and the things tonight kept, with their strokes. Nothing is sent
// anywhere and nothing is generated: everything standing there is what they painted.
//
// Cheap on a TV: each thing's light is made once on the GPU, through the shape of its strokes'
// reach (glow.js), and each frame is one canvas, a few dozen quads, each corner put where the eye
// sees it (seen, onScreen). The layout and the walk are pure, and tested in Node.
import { motionOf, poseOf, reachOf, maskOf } from './cutout.js';
import { drawNight, placeSky, posed, tagOf, poolOf, dotOf } from './night.js';
import { checkScene, materialOf, reflectOf, sunOf } from './scene.js';
import { getGlow, createPace } from './glow.js';

// The space, in stage pixels (the stage is 1920 x 1080): the eye `eye` pixels in front of the
// screen, level with `horizon`; the painting's bottom edge, where the ground hinges, at `hinge`;
// the ground tipped back `tilt` degrees; the sheet drawn `px` pixels a paper unit.
export const SPACE = { eye: 1100, horizon: 470, hinge: [960, 1002], tilt: 78, px: 0.98 };
// how close the eye comes and how far back it goes, how far the world rises and sinks (pixels)
export const LIMIT = { back: -620, in: 480, up: -520, down: 220 };
// as it opens, the eye draws back, so the whole world is in view
const OPEN_S = 2.6, CLOSE_S = 1.5, DRAW_BACK = -300;
// how long frames may run slower than film before the reflections go (seconds)
const SLOW_S = 2.5;
// what floats: painted above `from` of the way up the page, it rises `by` pixels for each whole page
export const FLOAT = { from: 0.55, by: 760 };
// how much of the world's turn each thing turns back toward the eye
const FACE = 0.75;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const boxOf = (ss) => ss.reduce((u, s) => [Math.min(u[0], s.box[0]), Math.min(u[1], s.box[1]), Math.max(u[2], s.box[2]), Math.max(u[3], s.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);

// What stays painted on the ground: a wash, or a long flat stroke that hardly turns (a shore, a
// horizon, a road). A long winding one (a dragon, a snake, the waves) stands up.
export const lies = (s) => s.ink === 'water' || ((s.box[2] - s.box[0]) > 260 && (s.box[2] - s.box[0]) > 4 * Math.max(1, s.box[3] - s.box[1]) && (s.turn || 0) < 3);

// What stands up, and where. `strokes`: tonight's, as the brush gives them (n, ink, box, length,
// turn, pools…). `things`: what tonight kept, [{ id, name, strokes: [n], line }], each standing as
// one piece, in the order given; then the longest of the other strokes, each alone (a dab of colour,
// a star, stands too), up to `most` pieces in all. A piece stands at the foot of its strokes, or
// `float`s that many pixels above it; `far`: 0 at the bottom of the page, 1 at the top. `ground`: the strokes left painted on the ground.
export function stageOf(strokes, { things = [], lines = [], most = 12 } = {}) {
  const byN = new Map(strokes.map((s) => [s.n, s]));
  const used = new Set(), pieces = [];
  for (const t of things) {
    if (pieces.length >= most) break;
    const ss = (t.strokes || []).map((n) => byN.get(n)).filter((s) => s && s.box && !used.has(s.n) && !lies(s));
    if (!ss.length) continue;
    ss.forEach((s) => used.add(s.n));
    pieces.push({ id: t.id, name: t.name || null, strokes: ss, line: t.line || null });
  }
  const colour = (s) => s.ink === 'gold' || s.ink === 'cinnabar' || s.ink === 'indigo';
  const rest = strokes.filter((s) => s.box && !used.has(s.n) && !lies(s) && ((s.length || 0) >= 45 || colour(s))).sort((a, b) => (b.length || 0) - (a.length || 0));
  for (const s of rest) {
    if (pieces.length >= most) break;
    used.add(s.n);
    const l = lines.find((x) => (x.strokes || []).includes(s.n));
    pieces.push({ id: `s${s.n}`, name: null, strokes: [s], line: l ? l.text : null });
  }
  for (const p of pieces) {
    p.box = boxOf(p.strokes);
    p.foot = [Math.round((p.box[0] + p.box[2]) / 2), p.box[3]];
    p.far = Math.round(clamp(1 - p.box[3] / 1000, 0, 1) * 1000) / 1000;
    // painted near the top of the page, it is up in the air, the further up the higher
    p.float = Math.round(Math.max(0, p.far - FLOAT.from) * FLOAT.by);
    p.motion = motionOf(p.strokes);
  }
  return { pieces, ground: strokes.filter((s) => !used.has(s.n)).map((s) => s.n) };
}

// Where a point of the painting (paper units) is once the ground is tipped back `tilt` degrees:
// stage pixels from the hinge, x to the right, y down, z toward the eye
export function onGround([x, y], { px = SPACE.px, tilt = SPACE.tilt } = {}) {
  const u = (x - 800) * px, v = (1000 - y) * px, a = (tilt * Math.PI) / 180;
  return { x: u, y: -v * Math.cos(a), z: -v * Math.sin(a) };
}

// The middle of the world, which it turns on: the middle of the ground
export const MIDDLE = onGround([800, 500]);

// Where a point is from the eye, once the world has turned `cam.yaw` degrees on its middle, come
// `cam.d` pixels nearer and risen `cam.lift` pixels (up is less)
export function seen(p, cam, S = SPACE) {
  const a = (cam.yaw * Math.PI) / 180, px = p.x - MIDDLE.x, pz = p.z - MIDDLE.z;
  const x = MIDDLE.x + px * Math.cos(a) + pz * Math.sin(a), z = MIDDLE.z - px * Math.sin(a) + pz * Math.cos(a) + cam.d;
  return { x, y: p.y + (S.hinge[1] - S.horizon) + (cam.lift || 0), z: z - S.eye };
}
// where a point seen from the eye lands on the stage
export const onScreen = (q, S = SPACE) => [S.hinge[0] + (q.x * S.eye) / -q.z, S.horizon + (q.y * S.eye) / -q.z];

// a turn the short way round, from -180 to 180 degrees
const round = (deg) => { const a = ((deg + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };
const within = (cam) => ({ yaw: round(cam.yaw), d: clamp(cam.d, LIMIT.back, LIMIT.in), lift: clamp(cam.lift || 0, LIMIT.up, LIMIT.down) });

// The turn that brings a thing standing at `p` round to the front of the world, straight ahead; how
// near to come, so that it is `near` pixels beyond the screen, or, given its height in pixels
// (`tall`), so that it stands about `fill` pixels tall; and how far the world rises so that its
// middle is at `at` down the stage (under what is said of it, above the buttons)
export function aimAt(p, { near = 220, tall = 0, fill = 430, at = 640, S = SPACE } = {}) {
  if (tall > 0) near = clamp((S.eye * tall) / fill - S.eye, -560, 320);
  const px = p.x - MIDDLE.x, pz = p.z - MIDDLE.z, r = Math.hypot(px, pz);
  const cam = within({ yaw: (Math.atan2(-px, pz) * 180) / Math.PI, d: -near - MIDDLE.z - r });
  // as far as it could come: the world rises for that
  const away = S.eye - (MIDDLE.z + r + cam.d), middle = p.y - tall / 2 + (S.hinge[1] - S.horizon);
  return within({ ...cam, lift: ((at - S.horizon) * away) / S.eye - middle });
}

// A moment of the walk: held ◀ ▶ turn the world (◀: its front goes left), ▲ ▼ come nearer and go
// back, `turn` degrees and `pace` pixels a second
export function walk(cam, held, dt, { turn = 36, pace = 420 } = {}) {
  const has = (b) => !!held && (held.has ? held.has(b) : held.includes(b));
  return within({
    yaw: cam.yaw + ((has('right') ? 1 : 0) - (has('left') ? 1 : 0)) * turn * dt,
    d: cam.d + ((has('up') ? 1 : 0) - (has('down') ? 1 : 0)) * pace * dt,
    lift: cam.lift || 0,
  });
}

// the world's transform, as CSS would write it: turned on its middle, then brought nearer and raised
export const cssCamera = (cam) => `translate3d(0, ${(cam.lift || 0).toFixed(1)}px, ${cam.d.toFixed(1)}px) rotateY(${cam.yaw.toFixed(2)}deg)`;

// ---------------------------------------------------------------- on the stage

// A seeded generator, so the same painting opens into the same world
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
// `host`: the element over the stage that the world opens in. `onClosed`: once it has folded back.
export function createInside(host, { onClosed = () => {} } = {}) {
  let st = null;
  const pace = createPace();
  const make = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // `layers`: the painting's `ink` on white (inkgl.js layers()), or a kept night's `painting` and
  // its `paper` (with `key`s, to keep them uploaded); `strokes`: tonight's, each with its `path`;
  // `things`, `lines`: as stageOf takes them. `scene`: their world's place (scene.js), and
  // `backdrop`, the place painted: inside it, what they painted stands solid, as at home, its
  // shadow on the ground; without one, the night, and their ink in light. `sprites`: a thing made
  // real on its own (things.js), by its id ({ canvas, region, box }), which stands there in place of
  // its strokes, as tall as they are tonight. False if there is nothing to open, or no GPU.
  function open({ layers, strokes, things = [], lines = [], scene = null, backdrop = null, sprites = {} }, now) {
    const G = getGlow();
    if (!G || !layers || !strokes.length) return false;
    clear();
    const S = SPACE, px = S.px, place = scene ? checkScene(scene) : null;
    const stage = stageOf(strokes, { things, lines });
    const src = layers.ink ? { ink: layers.ink, key: `inside:${now}` } : { painting: layers.painting, key: layers.key, paper: layers.paper, paperKey: layers.paperKey };
    const from = src.ink || src.painting, k = (from.naturalWidth || from.width) / 1600;
    // a part of the painting lit, through the shape of its strokes' reach: [the light, its quad in paper units]
    const lit = (ss, material = null) => {
      const box = reachOf(ss);
      if (!box) return null;
      const b = [Math.max(0, box[0]), Math.max(0, box[1]), Math.min(1600, box[2]), Math.min(1000, box[3])];
      const w = Math.max(1, Math.round((b[2] - b[0]) * k)), h = Math.max(1, Math.round((b[3] - b[1]) * k));
      const L = G.light({ ...src, rect: [b[0] * k, b[1] * k, w, h], mask: maskOf(ss, b, k, w, h, { steps: true }), px: k, material });
      const pad = L.pad / k;
      return { L, box: b, quad: [b[0] - pad, b[1] - pad, b[0] + w / k + pad, b[1] + h / k + pad] };
    };
    // its own picture, its kept strokes' reach set on tonight's: [the picture, its quad in paper units]
    const madeOf = (ss, it, material = null) => {
      const box = reachOf(ss.map((x) => ({ ...x, pools: [] }))), kb = it.box, R = it.region;
      if (!box || !kb || !R || kb[3] <= kb[1]) return null;
      const s = (box[3] - box[1]) / (kb[3] - kb[1]), cx = (box[0] + box[2]) / 2, kx = (kb[0] + kb[2]) / 2;
      const L = G.sprite(it.canvas, { px: (it.canvas.naturalWidth || it.canvas.width) / (R[2] - R[0]), shade: material ? material.shadow : undefined });
      return { L, box, quad: [cx + (R[0] - kx) * s, box[3] + (R[1] - kb[3]) * s, cx + (R[2] - kx) * s, box[3] + (R[3] - kb[3]) * s] };
    };
    const pieces = [];
    for (const [i, p] of stage.pieces.entries()) {
      const it = sprites[p.id], m = materialOf(place, i);
      let made = null;
      if (it) try { made = madeOf(p.strokes, it, m); } catch (err) { console.log(`inside, its picture: ${err.message}`); }
      made ||= lit(p.strokes, m);
      if (!made) continue;
      // it stands where its ink ends: a little below the path its brush took
      const footY = Math.min(made.box[3], p.box[3] + 12);
      const W = (made.box[2] - made.box[0]) * px, H = (footY - made.box[1]) * px;
      pieces.push({ ...p, ...made, footY, W, H, tag: p.name ? G.upload(tagOf(p.name)) : null, at: onGround([p.foot[0], footY]) });
    }
    // what stays painted on the ground (a shore, the water), lit where it lies
    const lying = strokes.filter((s) => stage.ground.includes(s.n) && s.box && s.path && s.path.length);
    const ground = lying.length ? lit(lying, materialOf(place, stage.pieces.length)) : null;
    if (src.ink) G.forget(src.key);
    // their world's place all round, or the night with its stars; a pool of light, a firefly
    const sky = canvasOf(1920, 1080), seed = strokes.length * 31 + 7;
    if (place) placeSky(sky.getContext('2d'), { W: 1920, H: 1080, horizon: S.horizon + 60, seed, scene: place, backdrop });
    else drawNight(sky.getContext('2d'), { W: 1920, H: 1080, horizon: S.horizon + 60, seed });
    // what drifts in the air, at every depth: what shows the space as you move through it (the
    // place's own, or fireflies in the night)
    const rand = rng(strokes.length * 7919 + Math.round(strokes[0].box[0])), motes = [];
    const many = place ? (place.air.kind === 'none' ? 0 : Math.round(26 * place.air.amount)) : 18;
    for (let i = 0; i < many; i++) {
      const z = -40 - rand() * 980, x = (rand() - 0.5) * 1700, y = (z / Math.tan((S.tilt * Math.PI) / 180)) - 60 - rand() * 520;
      motes.push({ x, y, z, d: 3 + rand() * 4, w: -rand() * 6 });
    }
    // and at the foot of the stage, under the buttons, the dark of the room
    const veil = make('div', 'veil'), caption = make('div', 'caption');
    caption.hidden = true;
    caption.innerHTML = '<p class="name"></p><p class="line"></p>';
    host.append(veil, caption);
    G.attach(host, { before: veil, scale: pace.scale });
    host.hidden = false;
    // OK goes to each thing in it that has a name or a line, not to every star; with none, to each piece
    const stops = pieces.filter((p) => p.name || p.line);
    st = {
      phase: 'opening', t0: now, last: now, cam: { yaw: 0, d: 0, lift: 0 }, target: null, tour: -1, tilt: 0, air: 0,
      pieces, stops: stops.length ? stops : pieces, ground, sky: G.upload(sky), pool: G.upload(poolOf()), dot: G.upload(dotOf()), motes,
      placed: !!place, reflect: reflectOf(place), sun: sunOf(place),
      veil, caption, leave: null, drawn: null,
    };
    frame(now, null);
    return true;
  }

  function showCaption(p) {
    const c = st.caption;
    c.querySelector('.name').textContent = p.name ? cap(p.name) : '';
    c.querySelector('.name').hidden = !p.name;
    c.querySelector('.line').textContent = p.line || '';
    c.querySelector('.line').hidden = !p.line;
    c.hidden = !p.name && !p.line;
  }

  // A button, while it is open: what it showed, if anything ({ name, line } of a thing gone to)
  function press(button, now) {
    if (!st || st.phase === 'closing') return null;
    if (button === 'back') { close(now); return null; }
    if (st.phase !== 'open') return null;
    if (button === 'select' || button === 'playpause') {
      if (!st.stops.length) return null;
      st.tour = (st.tour + 1) % st.stops.length;
      const p = st.stops[st.tour];
      st.target = aimAt(p.at, { tall: p.H + 2 * p.float });
      showCaption(p);
      return { name: p.name, line: p.line };
    }
    // a tap turns or steps a little; held, the walk goes on (frame)
    const nudge = { left: [-15, 0], right: [15, 0], up: [0, 150], down: [0, -150] }[button];
    if (nudge) {
      const from = st.target || st.cam;
      st.target = within({ yaw: from.yaw + nudge[0], d: from.d + nudge[1], lift: from.lift });
      st.caption.hidden = true;
    }
    return null;
  }

  function close(now) {
    if (!st || st.phase === 'closing') return;
    const k = st.phase === 'opening' ? smooth((now - st.t0) / OPEN_S) : 1;
    st.leave = { ...st.cam };
    st.phase = 'closing';
    // folding back from as far open as it got
    st.t0 = now - (1 - k) * CLOSE_S;
    st.caption.hidden = true;
  }

  function frame(now, held) {
    if (!st) return;
    const dt = Math.min(0.1, Math.max(0, now - st.last));
    st.last = now;
    let k = 1;
    if (st.phase === 'opening') { k = smooth((now - st.t0) / OPEN_S); if (k >= 1) st.phase = 'open'; }
    else if (st.phase === 'closing') {
      k = 1 - smooth((now - st.t0) / CLOSE_S);
      if (k <= 0) { release(); onClosed(); return; }
    }
    const walking = !!held && ['left', 'right', 'up', 'down'].some((b) => held.has(b));
    if (st.phase === 'open') {
      if (walking) { st.target = null; st.cam = walk(st.cam, held, dt); }
      else if (st.target) {
        const e = 1 - Math.exp(-dt * 3.2);
        const turn = round(st.target.yaw - st.cam.yaw);
        st.cam = { yaw: round(st.cam.yaw + turn * e), d: st.cam.d + (st.target.d - st.cam.d) * e, lift: st.cam.lift + (st.target.lift - st.cam.lift) * e };
        if (Math.abs(turn) < 0.05 && Math.abs(st.target.d - st.cam.d) < 0.5 && Math.abs(st.target.lift - st.cam.lift) < 0.5) st.target = null;
      }
    } else if (st.phase === 'opening') st.cam = { yaw: 0, d: DRAW_BACK * k, lift: 0 };
    else st.cam = { yaw: round(st.leave.yaw) * k, d: st.leave.d * k, lift: st.leave.lift * k };
    // standing still, it moves slowly: thirty frames a second are enough; walking, turning or
    // opening, every frame
    const still = st.phase === 'open' && !walking && !st.target;
    if (still && st.drawnAt != null && now - st.drawnAt < 1 / 31) { if (st.phase === 'open') pace.frame(dt); return; }
    st.drawnAt = now;
    draw(now, k, dt);
  }

  // The world as the eye sees it: the ground tips back, and what was painted on it stands up; as
  // the world turns, each thing turns most of the way back toward the eye, so it never shows its back
  function draw(now, k, dt) {
    const G = getGlow();
    if (!G) return;
    const S = SPACE, px = S.px, tilt = S.tilt * k, up = k, cam = st.cam;
    const face = (-FACE * cam.yaw * Math.PI) / 180, ca = Math.cos(face), sa = Math.sin(face);
    st.tilt = Math.round(tilt * 100) / 100;
    st.air = smooth((k - 0.1) / 0.7);
    G.attach(host, { before: st.veil, scale: st.phase === 'open' ? pace.frame(dt) : pace.scale });
    G.begin({ W: 1920, H: 1080 });
    // the night all round, coming up as it opens
    G.quad(st.sky, [[0, 0], [1920, 0], [0, 1080], [1920, 1080]], { alpha: st.air, opaque: st.air > 0.999 });
    const eye = (P) => { const q = seen(P, cam); return -q.z < 20 ? null : [...onScreen(q), -q.z / S.eye]; };
    const at = (ps) => { const r = ps.map(eye); return r.some((v) => !v) ? null : r; };
    const ground = (x, y) => onGround([x, y], { tilt });
    const flat = ([x0, y0, x1, y1]) => at([ground(x0, y0), ground(x1, y0), ground(x0, y1), ground(x1, y1)]);
    const drawn = { pieces: 0, reflections: 0, pools: 0, shadows: 0, tags: 0, hidden: 0, motes: 0, ground: 0 };
    const tags = [];
    if (st.ground) { const q = flat(st.ground.quad); if (q) { G.quad(st.ground.L, q, { over: !!st.ground.L.toy }); drawn.ground++; } }
    const t = now - st.t0, named = smooth((k - 0.75) / 0.25);
    // solid things are laid far to near, each over what is behind it; light just adds up
    const order = st.sun || st.pieces.some((p) => p.L.toy) ? [...st.pieces].sort((a, b) => a.footY - b.footY) : st.pieces;
    // a thing's own picture throws its shadow in the night too, from the moon's side
    const sun = st.sun || [0.4, -0.75, 0.52];
    for (const p of order) {
      const F = ground(p.foot[0], p.footY), lift = p.float * up, solid = !!p.L.toy;
      // a point of its own upright plane (stage pixels from its foot, y down), in the world
      const stand = ([lx, ly]) => ({ x: F.x + lx * ca, y: F.y + ly, z: F.z - lx * sa });
      const [x0, y0, x1, y1] = p.quad;
      // a solid thing throws its shadow on the ground behind it, away from the light (fainter the
      // higher it floats); what is light has a pool of it round its foot
      if (solid) {
        const reach = 0.45 * k, d = (p.footY - y0) * reach, sx = -sun[0] * d * 0.9, near = p.footY + (y1 - p.footY) * reach;
        const q = at([ground(x0 + sx, p.footY - d), ground(x1 + sx, p.footY - d), ground(x0, near), ground(x1, near)]);
        if (q) { G.quad(p.L.shadow, q, { alpha: 0.8 / (1 + p.float / 120), over: true }); drawn.shadows++; }
      } else if (!p.float) {
        const hw = (p.W * 0.45) / px, hh = 14 / px, q = flat([p.foot[0] - hw, p.footY - hh, p.foot[0] + hw, p.footY + hh]);
        if (q) { G.quad(st.pool, q); drawn.pools++; }
      }
      // itself, moving as its shape moves, about its foot; and the same upside down in the ground,
      // as much as the ground shines
      const lx0 = (x0 - p.foot[0]) * px, lx1 = (x1 - p.foot[0]) * px, ly0 = (y0 - p.footY) * px, ly1 = (y1 - p.footY) * px;
      const w = lx1 - lx0, h = ly1 - ly0, corners = posed((lx0 + lx1) / 2, (ly0 + ly1) / 2, w, h, poseOf(p.motion, t, k, { size: [p.W, p.H] }), [0, h / 2]);
      const mirror = st.reflect > 0 ? at(corners.map(([lx, ly]) => stand([lx, lift - ly]))) : null;
      if (mirror) { G.quad(p.L, mirror, { alpha: Math.min(0.6, 0.45 * (st.reflect / 0.3)), reflect: true, over: solid }); drawn.reflections++; }
      const thing = at(corners.map(([lx, ly]) => stand([lx, ly - lift])));
      if (thing) { G.quad(p.L, thing, { over: solid }); drawn.pieces++; }
      // its name over it, once it has opened
      if (p.tag && named > 0.01) {
        const cx = ((p.box[0] + p.box[2]) / 2 - p.foot[0]) * px, bottom = (p.box[1] - p.footY) * px - 8 - lift, tw = p.tag.w, th = p.tag.h;
        const q = at([[cx - tw / 2, bottom - th], [cx + tw / 2, bottom - th], [cx - tw / 2, bottom], [cx + tw / 2, bottom]].map(stand));
        if (q) tags.push({ p, q });
      }
    }
    // the names, over everything: where two would overlap as the world turns, the nearer one stays
    // (the one gone to, always) and the other fades until they are clear of each other
    const gone = st.tour >= 0 ? st.stops[st.tour] : null;
    const rect = (q) => [Math.min(...q.map((v) => v[0])) - 10, Math.min(...q.map((v) => v[1])) - 6, Math.max(...q.map((v) => v[0])) + 10, Math.max(...q.map((v) => v[1])) + 6];
    const kept = [];
    tags.sort((a, b) => (b.p === gone) - (a.p === gone) || a.q[0][2] - b.q[0][2]);
    for (const { p, q } of tags) {
      const r = rect(q), clear = !kept.some((o) => r[0] < o[2] && o[0] < r[2] && r[1] < o[3] && o[1] < r[3]);
      if (clear) kept.push(r); else drawn.hidden++;
      p.tagShown = Math.max(0, Math.min(1, (p.tagShown ?? 1) + (clear ? 1 : -1) * dt * 5));
      if (p.tagShown > 0.01) { G.quad(p.tag, q, { alpha: named * p.tagShown }); drawn.tags++; }
    }
    // fireflies, drifting up and down, brightening as they rise
    for (const m of st.motes) {
      const ph = (((now - m.w) / m.d) % 2 + 2) % 2, u = ph < 1 ? ph : 2 - ph, e = u * u * (3 - 2 * u);
      const q = eye({ x: m.x, y: m.y - 46 * e, z: m.z });
      if (!q) continue;
      const s = (S.eye / (q[2] * S.eye)) * 22;
      G.quad(st.dot, [[q[0] - s, q[1] - s], [q[0] + s, q[1] - s], [q[0] - s, q[1] + s], [q[0] + s, q[1] + s]], { alpha: (0.2 + 0.75 * e) * st.air });
      drawn.motes++;
    }
    G.end({ clear: [0, 0, 0, 0] });
    st.drawn = drawn;
  }

  // what it made on the GPU, let go
  function release() {
    const G = getGlow();
    if (st && G) {
      for (const p of st.pieces) { G.freeLight(p.L); G.free(p.tag); }
      if (st.ground) G.freeLight(st.ground.L);
      G.free(st.sky, st.pool, st.dot);
    }
    st = null;
  }
  function clear() {
    release();
    const G = getGlow();
    // the canvas is lent: it stays, hidden with the rest
    for (const el of [...host.children]) if (!G || el !== G.canvas) el.remove();
    host.hidden = true;
  }

  return {
    open, press, close, frame, clear,
    get phase() { return st ? st.phase : null; },
    // for the tests: what stands, how far away, where the walk is, and what the last frame drew
    get state() {
      return st && {
        phase: st.phase, placed: st.placed, cam: { yaw: Math.round(st.cam.yaw * 10) / 10, d: Math.round(st.cam.d), lift: Math.round(st.cam.lift) }, tilt: st.tilt, air: Math.round(st.air * 1000) / 1000,
        drawn: st.drawn, scale: pace.scale,
        pieces: st.pieces.map((p) => ({ name: p.name, far: p.far, float: p.float, motion: p.motion, strokes: p.strokes.map((s) => s.n), made: !!p.L.sprite })),
        tour: st.tour >= 0 ? { i: st.tour, of: st.stops.length, name: st.stops[st.tour].name, line: st.stops[st.tour].line } : null,
        caption: st.caption.hidden ? null : st.caption.textContent,
      };
    },
    // for the tests: the first thing's light at its corner, where there is no ink (none)
    probe() { const G = getGlow(); return st && G && st.pieces[0] ? G.read(st.pieces[0].L.all, 0, 0) : null; },
  };
}
