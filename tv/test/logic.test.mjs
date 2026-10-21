import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buttonOf, createRemote } from '../src/remote.js';
import { createBrush, step, press, spoke, load, summarize, sitting, INKS, TUNING } from '../src/brush.js';

// ---------------------------------------------------------------- the remote

test('every key in Vega WebView’s table maps to a button, by name or by code', () => {
  const byName = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', GoBack: 'back', MediaPlayPause: 'playpause', MediaRewind: 'rewind', MediaFastForward: 'fastforward' };
  for (const [key, b] of Object.entries(byName)) assert.equal(buttonOf({ key }), b, key);
  const byCode = { 38: 'up', 40: 'down', 37: 'left', 39: 'right', 13: 'select', 27: 'back', 179: 'playpause', 227: 'rewind', 228: 'fastforward' };
  for (const [code, b] of Object.entries(byCode)) assert.equal(buttonOf({ key: 'Unidentified', keyCode: Number(code) }), b, code);
  assert.equal(buttonOf({ key: 'x', keyCode: 88 }), null);
});

test('a hold with one keydown lasts until its keyup, however long', () => {
  const r = createRemote();
  assert.equal(r.down('up', 0), true);
  assert.deepEqual([...r.held(5000)], ['up']);
  r.up('up');
  assert.deepEqual([...r.held(5001)], []);
  assert.deepEqual(r.takePresses(), ['up']);
});

test('a hold as repeated keydowns counts once as a press and lets go when the repeats stop', () => {
  const r = createRemote({ repeatGap: 260 });
  for (let t = 0; t <= 1000; t += 40) r.down('right', t);
  assert.deepEqual(r.takePresses(), ['right']);
  assert.deepEqual([...r.held(1100)], ['right']);
  assert.deepEqual([...r.held(1300)], [], 'no keyup came, but the repeats stopped');
});

test('with two arrows held, the brush follows the one pressed last', () => {
  const r = createRemote();
  r.down('up', 0); r.down('left', 10);
  assert.equal(r.arrow(20), 'left');
  r.up('left');
  assert.equal(r.arrow(30), 'up');
});

// ---------------------------------------------------------------- the brush

// Runs the brush for `seconds` with `held` buttons held, and returns every mark and event.
function run(b, held, seconds, arrow = null) {
  const segs = [], events = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
    const r = step(b, { held: new Set(held), arrow }, 1 / 60);
    segs.push(...r.segs);
    if (r.event) events.push(r.event);
  }
  return { segs, events };
}
// how wide the marks of one frame spread across the line
const spread = (b) => {
  const { segs } = run(b, [], 1 / 60);
  if (!segs.length) return 0;
  const n = { x: -Math.sin(b.heading), y: Math.cos(b.heading) };
  const across = segs.map((s) => (s.x1 - b.x) * n.x + (s.y1 - b.y) * n.y);
  return Math.max(...across) - Math.min(...across) + 2 * Math.max(...segs.map((s) => s.r));
};

test('lifted, an arrow moves the brush like a cursor, faster the longer it is held, and leaves no ink', () => {
  const b = createBrush({ x: 400, y: 500 });
  const { segs } = run(b, ['right'], 0.25, 'right');
  const first = b.x - 400;
  run(b, ['right'], 0.25, 'right');
  const second = b.x - 400 - first;
  assert.ok(first > 40 && second > first, `${first} then ${second}`);
  assert.equal(segs.length, 0);
  assert.equal(b.strokes.length, 0);
  assert.equal(b.y, 500);
});

test('OK lands the brush moving, with a blunt, full-width start, then it flows forward by itself', () => {
  const b = createBrush({ x: 200, y: 500, heading: 0 });
  assert.equal(press(b, 'select'), 'down');
  assert.equal(b.down, true);
  const first = run(b, [], 1 / 60).segs;
  assert.ok(first.some((s) => s.r > 3), 'the pressed tuft lands as one solid head');
  run(b, [], 0.1);
  assert.ok(b.x > 202, `it lands moving: ${b.x}`);
  const { segs } = run(b, [], 1);
  assert.ok(Math.abs(b.pressure - TUNING.pressure.normal) < 0.1, `settles near ${TUNING.pressure.normal}: ${b.pressure}`);
  assert.ok(b.x > 300, `flowed to ${b.x}`);
  assert.ok(Math.abs(b.y - 500) < 6, `nearly straight, as a hand draws it: ${b.y}`);
  assert.ok(segs.length > 400, `${segs.length} bristle marks`);
  assert.ok(b.strokes[0].points.length > 20, 'the stroke is kept for the guide');
});

test('left and right steer the flowing line into a smooth curve', () => {
  const b = createBrush({ x: 400, y: 500, heading: 0 });
  press(b, 'select');
  run(b, [], 0.3);
  run(b, ['right'], 0.8);
  assert.ok(b.heading > 1.3 && b.heading < 2.1, `turned to ${b.heading}`);
  assert.ok(b.y > 520, 'curved downward on screen');
  const pts = b.strokes[0].points;
  const turns = pts.slice(2).map((q, i) => {
    const a = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    const c = Math.atan2(q.y - pts[i + 1].y, q.x - pts[i + 1].x);
    return Math.abs(Math.atan2(Math.sin(c - a), Math.cos(c - a)));
  });
  assert.ok(Math.max(...turns) < 0.25, `no corner sharper than ${Math.max(...turns)}`);
});

test('▼ presses harder: the line swells and slows, and held, it stops and the ink spreads', () => {
  const b = createBrush({ x: 200, y: 500, heading: 0 });
  press(b, 'select');
  run(b, [], 0.6);
  const normal = spread(b);
  const v0 = b.speed;
  run(b, ['down'], 0.2);
  assert.ok(b.speed < v0 * 0.7, `slowing: ${v0} -> ${b.speed}`);
  const pressed = spread(b);
  assert.ok(pressed > normal * 1.4, `width ${normal} -> ${pressed}`);
  const { segs, events } = run(b, ['down'], 1.8);
  assert.equal(b.speed, 0);
  assert.ok(events.includes('pool'));
  const still = segs.slice(-16);
  assert.ok(still.every((s) => Math.hypot(s.x1 - s.x0, s.y1 - s.y0) < 0.2), 'stopped: the marks stay put');
  assert.ok(still.reduce((a, s) => a + s.wat, 0) > 1, 'and keep giving water to the paper');
  assert.ok(b.strokes[0].points.some((q) => q.pool > 0.5), 'the pool is kept for the guide');
});

test('▲ eases off to the tip: fewer bristles touch, the line is fine and quick', () => {
  const b = createBrush({ x: 200, y: 500, heading: 0 });
  press(b, 'select');
  run(b, [], 0.6);
  const normal = spread(b);
  const touchingNormal = run(b, [], 1 / 60).segs.length;
  run(b, ['up'], 0.6);
  const light = spread(b);
  const touchingLight = run(b, ['up'], 1 / 60).segs.length;
  assert.ok(light < normal * 0.55, `width ${normal} -> ${light}`);
  assert.ok(touchingLight < touchingNormal, `${touchingNormal} -> ${touchingLight} bristles`);
  assert.ok(b.speed > TUNING.cruise + 80, `speed ${b.speed}`);
});

test('OK lifts it off over a moment: the line goes on a little and tapers to a point', () => {
  const b = createBrush({ x: 200, y: 500, heading: 0 });
  press(b, 'select');
  run(b, [], 0.8);
  const x0 = b.x;
  assert.equal(press(b, 'select'), 'lift');
  const counts = [];
  let ended = false;
  for (let i = 0; i < 40 && !ended; i++) {
    const r = step(b, { held: new Set() }, 1 / 60);
    counts.push(r.segs.length);
    ended = r.event === 'end';
  }
  assert.ok(ended, 'it lifted off');
  assert.equal(b.down, false);
  assert.ok(b.x > x0 + 15, `carried on ${b.x - x0} units as it lifted`);
  assert.ok(counts[0] >= 10 && counts.at(-2) <= 3, `bristles touching: ${counts.join(' ')}`);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] <= counts[i - 1] + 1, `fewer and fewer: ${counts.join(' ')}`);
  assert.equal(b.strokes[0].done, true);
});

test('a long stroke runs dry, bristle by bristle, into streaks; the next stroke is dipped fresh', () => {
  const b = createBrush({ x: 20, y: 500, heading: 0 });
  press(b, 'select');
  const windows = [];
  for (let i = 0; i < 16; i++) windows.push(run(b, [], 0.5));
  const early = windows[0].segs.concat(windows[1].segs);
  const events = windows.flatMap((w) => w.events);
  const streaky = windows.map((w) => w.segs.filter((s) => s.cover < 0.7).length / Math.max(1, w.segs.length));
  const avgCover = early.reduce((a, s) => a + s.cover, 0) / early.length;
  assert.ok(avgCover > 0.95, `a fresh load covers the paper: ${avgCover}`);
  assert.ok(streaky.some((f) => f > 0.1 && f < 0.9), `some bristles run dry before others: ${streaky.map((f) => f.toFixed(2)).join(' ')}`);
  assert.ok(streaky.at(-1) > 0.9 || windows.at(-1).segs.length === 0, 'and in the end all of them');
  assert.ok(load(b) < 0.15, `load ${load(b)}`);
  assert.ok(events.includes('dry'));
  const pig = (arr) => arr.reduce((a, s) => a + s.pig, 0) / arr.length;
  const late = windows.find((w, i) => streaky[i] > 0.5).segs;
  assert.ok(pig(late) < pig(early), 'and paler as it dries');
  press(b, 'select'); run(b, [], 0.5);
  press(b, 'select');
  assert.ok(load(b) > 0.9, `dipped again: ${load(b)}`);
});

test('quick strokes break up sooner than slow ones: flying white', () => {
  const quick = createBrush({ x: 20, y: 300, heading: 0 }), slow = createBrush({ x: 20, y: 600, heading: 0 });
  press(quick, 'select'); press(slow, 'select');
  run(quick, ['up'], 2.5); run(slow, [], 2.5);
  const avg = (b, held) => { const { segs } = run(b, held, 0.5); return segs.reduce((a, s) => a + s.cover, 0) / segs.length; };
  const q = avg(quick, ['up']), s = avg(slow, []);
  assert.ok(q < s * 0.75, `cover: quick ${q}, steady ${s}`);
});

test('« » choose the ink for the next stroke: dense, light, clear water, or a dream ink', () => {
  const b = createBrush({ x: 200, y: 400 });
  assert.equal(INKS[b.ink].id, 'dense');
  assert.equal(press(b, 'fastforward'), 'ink');
  assert.equal(INKS[b.ink].id, 'light');
  press(b, 'select');
  const light = run(b, [], 0.5).segs;
  press(b, 'select'); run(b, [], 0.5);
  press(b, 'fastforward');
  press(b, 'select');
  const water = run(b, [], 0.5).segs;
  press(b, 'select'); run(b, [], 0.5);
  press(b, 'fastforward');
  assert.equal(INKS[b.ink].id, 'indigo', 'after water, the dream inks');
  press(b, 'select');
  const indigo = run(b, [], 0.5).segs;
  press(b, 'select'); run(b, [], 0.5);
  assert.ok(indigo.length && indigo.every((s) => s.ch === 1 && s.pig > 0.3), 'indigo marks are dark, on their own pigment channel');
  assert.ok(light.every((s) => !s.ch) && water.every((s) => !s.ch), 'black ink and water are on the black channel');
  press(b, 'fastforward'); assert.equal(INKS[b.ink].id, 'gold');
  press(b, 'fastforward'); assert.equal(INKS[b.ink].id, 'cinnabar');
  press(b, 'fastforward');
  assert.equal(INKS[b.ink].id, 'dense', 'wraps around');
  press(b, 'rewind');
  assert.equal(INKS[b.ink].id, 'cinnabar');
  press(b, 'rewind'); press(b, 'rewind'); press(b, 'rewind');
  assert.equal(INKS[b.ink].id, 'water');
  assert.ok(water.every((s) => s.pig === 0) && water.some((s) => s.wat > 0.3), 'water wets without darkening');
  assert.ok(light.every((s) => s.pig <= 0.31) && light.some((s) => s.pig > 0.15));
  assert.deepEqual(b.strokes.map((s) => INKS[s.ink].id), ['light', 'water', 'indigo']);
});

test('back washes out the last stroke, even one being painted; with nothing left it asks to leave', () => {
  const b = createBrush({ x: 200, y: 300 });
  press(b, 'select'); run(b, [], 0.5); press(b, 'select'); run(b, [], 0.5);
  press(b, 'select'); run(b, [], 0.5);
  assert.equal(press(b, 'back'), 'undo', 'lifts and washes out the stroke being painted');
  assert.equal(b.down, false);
  assert.equal(b.strokes.length, 1);
  assert.equal(press(b, 'back'), 'undo');
  assert.equal(b.strokes.length, 0);
  assert.equal(press(b, 'back'), 'exit');
});

test('a tap of OK twice leaves no speck, and play/pause asks for the telling only once there is ink', () => {
  const b = createBrush();
  assert.equal(press(b, 'playpause'), 'empty');
  press(b, 'select'); press(b, 'select'); press(b, 'playpause');
  assert.equal(b.strokes.length, 0);
  press(b, 'select'); run(b, [], 0.5);
  assert.equal(press(b, 'playpause'), 'tell');
  assert.equal(b.down, false, 'asking for the telling lifts the brush');
});

test('the brush stays on the paper', () => {
  const b = createBrush({ x: 1500, y: 500, heading: 0 });
  press(b, 'select');
  const { events } = run(b, ['up'], 3);
  assert.ok(b.x <= 1600 - TUNING.margin);
  assert.equal(events.filter((e) => e === 'edge').length, 1, 'said once, not every frame');
});

test('the same brush paints the same marks', () => {
  const a = createBrush({ x: 300, y: 300 }), b = createBrush({ x: 300, y: 300 });
  press(a, 'select'); press(b, 'select');
  assert.deepEqual(run(a, ['right'], 0.7).segs, run(b, ['right'], 0.7).segs);
});

test('the strokes summed up for the guide: where each went, its ink, how it was painted', () => {
  const b = createBrush({ x: 200, y: 500, heading: 0 });
  press(b, 'select'); run(b, [], 1.5); run(b, ['down'], 1.5); press(b, 'select'); run(b, [], 0.5);
  press(b, 'fastforward');
  b.x = 800; b.y = 200; b.heading = Math.PI / 2;
  press(b, 'select'); run(b, ['up'], 1); press(b, 'select'); run(b, [], 0.5);
  const [one, two] = summarize(b);
  assert.equal(one.ink, 'dense');
  assert.deepEqual(one.from, [200, 500]);
  assert.ok(one.to[0] > 380 && one.length > 180, JSON.stringify(one));
  assert.equal(one.pools.length >= 1, true, 'the pool is noted');
  assert.ok(one.pressure > two.pressure);
  assert.equal(two.ink, 'light');
  assert.ok(two.box[3] - two.box[1] > 150 && two.box[2] - two.box[0] < 10, JSON.stringify(two.box));
  assert.ok(one.pvar > 0.05 && one.pvar > two.pvar, `pressed down part way: its pressure shook more (${one.pvar} vs ${two.pvar})`);
  // a wavering line, steered left then right, against a steady arc
  const w = createBrush({ x: 200, y: 500, heading: 0 });
  press(w, 'select'); run(w, [], 0.5);
  for (let k = 0; k < 6; k++) run(w, [k % 2 ? 'left' : 'right'], 0.25, k % 2 ? 'left' : 'right');
  press(w, 'select'); run(w, [], 0.5);
  w.x = 800; w.y = 300;
  press(w, 'select'); run(w, ['left'], 2.5, 'left'); press(w, 'select'); run(w, [], 0.5);
  const [wave, arc] = summarize(w);
  assert.ok(wave.wiggle >= 4 && arc.wiggle === 0, `wavered ${wave.wiggle}, the arc ${arc.wiggle}`);
});

test('how it was painted: how long each stroke took, the wait before it, the time held still, the wash-outs', () => {
  const b = createBrush({ x: 200, y: 500, heading: 0 });
  run(b, [], 2); // two seconds before the first touch
  press(b, 'select'); run(b, [], 1); run(b, ['down'], 2); press(b, 'select'); run(b, [], 0.5);
  run(b, [], 4); // a long wait
  b.x = 800; b.y = 300;
  press(b, 'select'); run(b, [], 0.6); press(b, 'select'); run(b, [], 0.5);
  press(b, 'rewind');
  const [one, two] = summarize(b);
  assert.ok(Math.abs(one.gap - 2) < 0.2, `waited about 2 s before the first stroke: ${one.gap}`);
  assert.ok(one.ms > 3000 && one.ms < 3800, `the first stroke took about 3.2 s: ${one.ms}`);
  assert.ok(one.still > 0.5, `pressed until it stopped, then held still: ${one.still}`);
  assert.ok(two.gap > 3.8, `then a long wait: ${two.gap}`);
  assert.equal(two.still, 0);
  press(b, 'back');
  assert.deepEqual(sitting(b).washes, 1);
  // a wait spent talking on the phone is not hesitating: it counts from when they last spoke
  run(b, [], 4); spoke(b); run(b, [], 1);
  b.x = 400; b.y = 300;
  press(b, 'select'); run(b, [], 0.6); press(b, 'select'); run(b, [], 0.5);
  const talked = summarize(b).at(-1);
  assert.ok(talked.gap > 0.8 && talked.gap < 1.3, `about a second since they spoke: ${talked.gap}`);
  assert.equal(sitting(b).inks, 1);
  assert.ok(sitting(b).seconds > 10);
});

// ---------------------------------------------------------------- feel it again

import { replayPlan, replayAt, createDial, createFeeling } from '../src/feel.js';
import { readLine } from '../src/engine/personal/arc.mjs';
import { createGuide } from '../src/guide.js';

const three = [{ n: 1, ms: 3000 }, { n: 2, ms: 6000 }, { n: 3, ms: 3000 }];

test('the painting comes back in order, each stroke about as long as it took, in about 14 seconds', () => {
  const p = replayPlan(three, { lead: 2 });
  assert.deepEqual(p.at.map((a) => a.n), [1, 2, 3]);
  assert.ok(p.at[0].t0 === 2 && p.at[1].t0 > p.at[0].t1 && p.at[2].t0 > p.at[1].t1);
  const ten = replayPlan(Array.from({ length: 10 }, (_, i) => ({ n: i + 1, ms: i === 4 ? 8000 : 2000 })), { lead: 2 });
  const d = ten.at.map((a) => a.t1 - a.t0);
  assert.ok(d[4] > d[0] * 2, 'a long stroke comes back for longer');
  assert.ok(d.every((x) => x >= 0.6 && x <= 2.6));
  assert.ok(Math.abs(ten.end - 2 - 0.6 - 14) < 2, `about 14 seconds: ${ten.end}`);
  const many = replayPlan(Array.from({ length: 40 }, (_, i) => ({ n: i + 1, ms: 4000 })), { lead: 2 });
  assert.ok(many.end < 22, `many strokes: each a moment, and never a crawl: ${many.end}`);
  assert.ok(many.at.every((a) => a.t1 - a.t0 >= 0.3));
  assert.deepEqual(replayAt(p, 1), { i: -1, f: 0 });
  const mid = replayAt(p, (p.at[1].t0 + p.at[1].t1) / 2);
  assert.equal(mid.i, 1);
  assert.ok(Math.abs(mid.f - 0.5) < 1e-9);
});

test('the dial: ▲ raises it, ▼ lowers it, let go and it stays, never past the ends', () => {
  const d = createDial({ rate: 1 });
  d.step(0.5, 0);
  assert.equal(d.v, 0);
  assert.equal(d.moved, false);
  d.step(0.5, 1);
  assert.ok(Math.abs(d.v - 0.5) < 1e-9);
  d.step(2, 0);
  assert.ok(Math.abs(d.v - 0.5) < 1e-9, 'it stays where it was left');
  d.step(5, -1);
  assert.equal(d.v, -1);
  assert.equal(d.moved, true);
});

// play a replay through: what the person holds, second by second
function marked(plan, holding) {
  const dial = createDial(), feeling = createFeeling(plan);
  for (let t = 0; t <= plan.end; t += 1 / 30) {
    dial.step(1 / 30, holding(t));
    feeling.add(t, dial.v);
  }
  return feeling;
}

test('the feeling at each stroke: even, then heavier as the second came back, then lighter', () => {
  const p = replayPlan(three, { lead: 2 });
  const f = marked(p, (t) => (t > p.at[1].t0 && t < p.at[1].t0 + 0.7 ? -1 : t > p.at[2].t0 && t < p.at[2].t0 + 1.2 ? 1 : 0));
  const by = f.byStroke();
  assert.equal(by[0], 0);
  assert.ok(by[1] < -0.4, `heavier at the second: ${by[1]}`);
  assert.ok(by[2] > by[1] + 0.4, `lighter again at the third: ${by[2]}`);
  const line = f.line(50);
  assert.equal(line.length, 50);
  assert.ok(Math.min(...line) < -0.6);
  const read = readLine({ byStroke: by, strokes: three.map((s, i) => ({ ...s, box: [i * 100, 0, i * 100 + 50, 50], length: 100 })) });
  assert.equal(read.moved, true);
  assert.ok([2, 3].includes(read.turn.n));
  const still = marked(p, () => 0);
  assert.deepEqual(still.byStroke(), [0, 0, 0]);
  // the same hold, seen by a TV that stalls: a second with no frames while the button is down
  // counts for its time, not for the frames that happened to be drawn
  const smooth = createFeeling(p), stalled = createFeeling(p);
  const held = (t) => (t >= p.at[1].t0 + 0.2 && t < p.at[1].t0 + 1.4 ? -1 : 0);
  const dial = (f, gap) => { const d = createDial(); let t = p.lead; while (t < p.end) { const dt = gap(t); d.step(dt, held(t)); t += dt; f.add(t, d.v); } };
  dial(smooth, () => 1 / 60);
  dial(stalled, (t) => (t >= p.at[1].t0 + 0.3 && t < p.at[1].t0 + 0.32 ? 0.9 : 1 / 60));
  assert.ok(Math.abs(smooth.byStroke()[1] - stalled.byStroke()[1]) < 0.08, `${smooth.byStroke()[1]} vs ${stalled.byStroke()[1]}`);
});

test('without the guide service, a marked line is still told: plainly, along the line, with what they named', async () => {
  const guide = createGuide({ say: () => {}, ai: null, now: () => 0 });
  const strokes = [1, 2, 3, 4].map((n) => ({ n, box: [n * 200, 400, n * 200 + 120, 520], length: 150, ms: 2000, from: [n * 200, 400], to: [n * 200 + 120, 520], gap: 1, still: 0, pools: [] }));
  const told = await guide.tell({ strokes, feeling: { byStroke: [0, 0, -0.8, -0.6], moved: true }, pinned: { n: 3, said: 'a locked gate' } });
  assert.equal(told.told, false);
  assert.ok(told.lines.some((l) => l.text === 'Here it changed: a locked gate.'));
  assert.ok(told.lines.every((l) => Array.isArray(l.box) && l.strokes.length));
  assert.equal(told.shape, 'fall');
  assert.deepEqual(told.diff, {}, 'nothing proposed for their world but what they named, which the TV keeps itself');
  const unmarked = await guide.tell({ strokes, felt: 'sad' });
  assert.match(unmarked.lines[0].text, /Signed and sealed/);
  assert.equal(await guide.readings({ strokes, n: 3 }), null, 'no service, no readings: the TV reads the shape itself');
});

test('the dial in two dimensions: ◀ calms it, ▶ stirs it, and each stroke keeps both', () => {
  const d = createDial({ rate: 1 });
  d.step(0.5, 0, 1);
  assert.ok(Math.abs(d.a - 0.5) < 1e-9 && d.v === 0 && d.moved);
  d.step(3, -1, -1);
  assert.deepEqual([d.v, d.a], [-1, -1]);
  const p = replayPlan(three, { lead: 2 });
  const dial = createDial(), feeling = createFeeling(p);
  for (let t = 0; t <= p.end; t += 1 / 30) {
    // heavier and more and more stirred as the second stroke comes back; calm by the third
    const second = t > p.at[1].t0 && t < p.at[1].t0 + 0.8, third = t > p.at[2].t0 && t < p.at[2].t0 + 1.6;
    dial.step(1 / 30, second ? -1 : 0, second ? 1 : third ? -1 : 0);
    feeling.add(t, dial.v, dial.a);
  }
  const v = feeling.byStroke(), a = feeling.arousal();
  assert.ok(v[1] < -0.4 && a[1] > 0.4, `heavy and stirred at the second: ${v[1]}, ${a[1]}`);
  assert.ok(a[2] < a[1] - 0.5, `calmer at the third: ${a[2]}`);
  assert.equal(feeling.line(40, 2).length, 40);
  const read = readLine({ byStroke: v, arousal: a, strokes: three.map((s, i) => ({ ...s, box: [i * 100, 0, i * 100 + 50, 50], length: 100 })) });
  assert.equal(read.moved, true);
  assert.ok(read.stirs[1] > 0.4);
});

// ---------------------------------------------------------------- their dream world, on the TV

import { loadWorld, saveWorld, tonightOf, welcomeOf, keptOf } from '../src/world.js';
import { createPhone, qrSvg } from '../src/phone.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}
const NIGHT = [
  { n: 1, from: [100, 600], to: [1500, 610], box: [100, 590, 1500, 620], length: 1400, turn: 0.3, ms: 4000, pools: [] },
  { n: 2, from: [260, 100], to: [261, 101], box: [200, 100, 320, 220], length: 380, turn: 6.2, ms: 3000, pools: [] },
];

test('a world that can\'t be read opens empty, and what was kept is set aside, never written over', () => {
  const storage = memoryStorage();
  storage.setItem('inkwash.world', '{"kept":1,"nights":[{"n":1,"title":"Half wri');
  const w = loadWorld(storage);
  assert.equal(w.nights.length, 0);
  assert.equal(storage.getItem('inkwash.world.unread'), '{"kept":1,"nights":[{"n":1,"title":"Half wri');
  assert.ok(saveWorld(w, storage));
  loadWorld(storage);
  assert.equal(storage.getItem('inkwash.world.unread'), '{"kept":1,"nights":[{"n":1,"title":"Half wri', 'still there after the next save');
  // a world kept by an older TV, with a part in a shape it no longer keeps, opens with the rest
  storage.setItem('inkwash.world', JSON.stringify({ kept: 2, nights: [{ n: 1, title: 'One', lines: [{ text: 'You saw the ferry.', strokes: [1], reaction: 'yes' }, null] }], entities: 'x', facts: null }));
  const old = loadWorld(storage);
  assert.deepEqual([old.nights.length, old.nights[0].lines.length, old.entities.length], [1, 1, 0]);
});

test('their dream world is kept on the TV, night after night, and welcomes them back', () => {
  const storage = memoryStorage();
  const w = loadWorld(storage);
  assert.equal(welcomeOf(w), null, 'nothing to welcome back to on the first night');
  for (let k = 0; k < 2; k++) {
    const r = w.commit({
      telling: { title: `Night ${k + 1}`, lines: [{ text: 'The sea lay flat.', strokes: [1] }, { text: 'The clock had stopped.', strokes: [2] }] },
      strokes: NIGHT, feeling: { byStroke: [0, k ? -0.2 : -0.8], arousal: [0, 0.6] },
      pinned: { n: 2, said: 'the stopped clock', why: 'unreachable', ...(k ? { entity: w.entities.find((e) => e.name === 'the stopped clock').id } : {}) },
      diff: k ? {} : { facts: [{ about: 'the stopped clock', text: 'It had stopped at ten past four.', line: 1, open: true }] },
      reactions: ['yes', 'yes'],
    });
    assert.ok(saveWorld(w, storage));
    if (k) assert.equal(keptOf(r), 'Back again: the stopped clock.');
  }
  const again = loadWorld(storage);
  assert.equal(again.nights.length, 2);
  assert.equal(welcomeOf(again), 'Welcome back. This is chapter 3 of your world. The stopped clock has come twice, lighter the last time. There is more to find out about it.');
  const slice = tonightOf(again, { strokes: NIGHT.map((s) => ({ ...s, box: s.box.map((x) => x + 20) })), words: [{ n: 1, text: 'the sea again' }] });
  assert.equal(slice.night, 3);
  assert.equal(slice.manifest, undefined, 'only what the telling needs leaves the TV');
  const clock = slice.things.find((t) => t.name === 'the stopped clock');
  assert.equal(clock.n, 2, 'the mark like it tonight');
  assert.equal(keptOf({ kept: [], turnedDown: ['my brother'] }), 'Let go: my brother.');
  assert.equal(keptOf({ kept: ['the door (new)', 'a gold cloud (new)', 'the water (new)'], turnedDown: [] }), 'New in your world: the door, a gold cloud and the water.');
  assert.equal(keptOf({ kept: ['the ladder (new)', 'the stopped clock (3 chapters)', 'the path'], turnedDown: ['my brother'] }), 'New in your world: the ladder. Back again: the stopped clock. Kept too: the path. Let go: my brother.');
  const broken = { getItem: () => '{nope', setItem: () => { throw new Error('full'); } };
  assert.equal(loadWorld(broken).nights.length, 0, 'unreadable storage: a fresh world');
  assert.equal(saveWorld(again, broken), false);
});

test('the phone, from the TV: pair, show its address as a QR, collect what they say, pass on the guide\'s question', async () => {
  const calls = [];
  const ai = {
    endpoint: 'https://guide.example',
    pair: async () => ({ code: 'ABC234' }),
    heard: async (b) => { calls.push(b); return b.end ? { ended: true } : { words: b.since ? [] : [{ i: 1, text: 'the clock again ' }, { i: 2, text: '' }], next: 1, phone: true }; },
  };
  assert.equal(createPhone({ ai: null }), null);
  const phone = createPhone({ ai, every: 1 });
  assert.deepEqual(await phone.pair(), { code: 'ABC234', url: 'https://guide.example/phone?c=ABC234' });
  const got = [];
  phone.ask('What is the round mark?');
  phone.tick(10, (ws) => got.push(...ws));
  phone.tick(10.5, (ws) => got.push(...ws)); // too soon, and still busy
  await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(got, ['the clock again']);
  assert.deepEqual(calls[0], { code: 'ABC234', since: 0, ask: 'What is the round mark?' });
  assert.equal(phone.listening, true);
  phone.tick(11.2, (ws) => got.push(...ws));
  await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(calls[1], { code: 'ABC234', since: 1 }, 'what the TV has is acknowledged; the question is sent once');
  phone.end();
  assert.deepEqual(calls[2], { code: 'ABC234', end: true });
  const gone = createPhone({ ai: { ...ai, heard: async () => { throw new Error('guide service: 404'); } }, every: 1 });
  await gone.pair();
  gone.tick(5, () => {});
  await new Promise((ok) => setTimeout(ok, 0));
  gone.tick(7, () => assert.fail('a pairing that has ended is not polled'));
  // a poll that doesn't get through: the question goes again with the next, unless a newer one is asked
  let down = true;
  const sent = [];
  const blip = createPhone({ ai: { ...ai, heard: async (b) => { sent.push(b); if (down) throw new Error('guide service: timed out'); return { words: [], next: 0 }; } }, every: 1 });
  await blip.pair();
  blip.ask('Is it the ferry?');
  blip.tick(5, () => {});
  await new Promise((ok) => setTimeout(ok, 0));
  down = false;
  blip.tick(6.1, () => {});
  await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(sent.map((b) => b.ask), ['Is it the ferry?', 'Is it the ferry?']);
  down = true;
  blip.ask('Where does it go?');
  blip.tick(7.2, () => {});
  blip.ask('What is in the water?');
  await new Promise((ok) => setTimeout(ok, 0));
  down = false;
  blip.tick(8.3, () => {});
  await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(sent.slice(2).map((b) => b.ask), ['Where does it go?', 'What is in the water?'], 'a newer question is not written over');
  const svg = qrSvg('https://guide.example/phone?c=ABC234', { size: 200 });
  assert.match(svg, /^<svg viewBox="0 0 (\d+) \1" width="200" height="200"/);
  assert.ok((svg.match(/h1v1h-1z/g) || []).length > 200, 'a real code, module by module');
});

test('the guide welcomes them back, and its remarks go to the phone', async () => {
  const said = [], heard = [];
  let t = 0;
  const ai = { remark: async () => ({ say: 'Is that the stopped clock again?' }) };
  const g = createGuide({ say: (x) => said.push(x), ai, now: () => t, onRemark: (x) => heard.push(x), pace: { gap: 0, pauseForRemark: 0, remarkEvery: 0 } });
  g.event('start', 'Welcome back. This is chapter 3 of your world.');
  assert.equal(said[0], 'Welcome back. This is chapter 3 of your world. Draw something into your world: a place, someone who lives there, or something that happens. Press OK to start drawing.');
  for (const e of ['down', 'end', 'down', 'end']) g.event(e);
  t = 10;
  g.tick(() => ({ image: 'x', strokes: [], words: [], phone: true, known: [] }));
  await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(heard, ['Is that the stopped clock again?']);
});

test('a fresh sheet: the guide counts the strokes from none again, with nothing to look at until there are', async () => {
  let t = 0, looked = 0;
  const ai = { remark: async () => { looked++; return { say: 'A long shore.' }; } };
  const g = createGuide({ say: () => {}, ai, now: () => t, pace: { gap: 0, pauseForRemark: 0, remarkEvery: 0 } });
  const look = () => ({ image: 'x', strokes: [], words: [], phone: false, known: [] });
  for (const e of ['down', 'end', 'down', 'end']) g.event(e);
  g.event('clean');
  t = 10;
  g.tick(look);
  await new Promise((ok) => setTimeout(ok, 0));
  assert.equal(looked, 0, 'nothing on the paper to look at');
  for (const e of ['down', 'end', 'down', 'end']) g.event(e);
  t = 20;
  g.tick(look);
  await new Promise((ok) => setTimeout(ok, 0));
  assert.equal(looked, 1, 'two strokes on the fresh sheet');
});

// ---------------------------------------------------------------- the guide, as an agent

import { runGuide, stepOf, closingOf } from '../src/agent.js';
import { createTools, firstMessage, laterMessage, finalTelling, briefFor, keptStrokes } from '../src/harness.js';
import { memoryPaintings } from '../src/paintings.js';
import { standInAgent } from '../server/agent-standin.mjs';
import { createDreamWorld } from '../src/engine/dreams/world.mjs';

const PIC = 'data:image/jpeg;base64,QUJD';
const fakeRender = { over: async (url, strokes, o = {}) => `data:image/jpeg;base64,${Buffer.from(JSON.stringify({ url: url.slice(-4), lit: o.highlight || [], zoom: !!o.zoom })).toString('base64')}`, sketch: async (s, p, o) => `data:image/jpeg;base64,${Buffer.from(`upTo ${o.upTo}`).toString('base64')}` };
const NIGHT_STROKES = [
  { n: 1, ink: 'dense', from: [100, 600], to: [1500, 610], box: [100, 590, 1500, 620], length: 1400, turn: 0.3, pressure: 0.5, pools: [], ms: 4000, gap: 1, still: 0 },
  { n: 2, ink: 'dense', from: [1100, 700], to: [1040, 700], box: [1040, 660, 1110, 740], length: 90, turn: 0.4, pressure: 0.9, pools: [[1050, 700]], ms: 3000, gap: 2.5, still: 2.2 },
];
const tonightCtx = (over = {}) => ({
  strokes: NIGHT_STROKES, points: NIGHT_STROKES.map((s) => [{ x: s.from[0], y: s.from[1] }, { x: s.to[0], y: s.to[1] }]), snapshot: PIC,
  feeling: { byStroke: [0, -0.7], arousal: [0, 0.6] }, felt: null, turn: { n: 2, delta: -0.7, stir: 0.6, size: 0.8 },
  words: [{ n: 2, text: 'a boat waiting at the pier' }], washed: [{ before: 2, box: [1000, 650, 1120, 750] }], said: ['A shore?'], session: { washes: 1, inks: 0, seconds: 95 }, date: Date.UTC(2026, 9, 6, 21, 30),
  ...over,
});
// the TV's screen, scripted: answers and reactions as given
const screen = ({ answer = 'Yes, the same', reactions = (n) => Array(n).fill('yes') } = {}) => {
  const asked = [], told = [], working = [];
  return { asked, told, working, ui: { ask: async (q) => { asked.push(q); return { answer, by: answer ? 'choice' : 'skipped' }; }, tell: async (t) => { told.push(t); return { reactions: reactions(t.lines.length, told.length), words: [] }; }, working: (step) => working.push(step) } };
};

test('the guide\'s first turn: the painting twice, and every part of tonight under its heading, as data', () => {
  const w = createDreamWorld();
  const ctx = tonightCtx();
  const content = firstMessage(ctx, { numbered: 'data:image/jpeg;base64,TlVN', brief: briefFor(w, ctx) });
  assert.deepEqual(content.slice(0, 2).map((b) => [b.type, b.source.data]), [['image', 'QUJD'], ['image', 'TlVN']]);
  const text = content[2].text;
  for (const h of ['TONIGHT', 'STROKES', 'WASHED OUT', 'FEELING', 'TURN', 'THEIR WORDS', 'THE GUIDE SAID', 'HOW THEY PAINTED IT', 'WHAT THEY KEEP', 'THEIR WORLD']) {
    const m = new RegExp(`^${h}\\b[^\\n]*\\n(.+)$`, 'm').exec(text);
    assert.ok(m, h);
    assert.doesNotThrow(() => JSON.parse(m[1]), h);
  }
  assert.match(text, /"weight":-0\.7,"stir":0\.6/);
  assert.match(text, /\{"stroke":2,"weight_change":-0\.7,"stir_change":0\.6\}/);
  assert.match(text, /"night":1,"date":"2026-10-06"/);
  assert.match(text, /Tell it\.$/);
  // what only their brush knows, read against the rest of tonight on a first night
  const painted = JSON.parse(/^HOW THEY PAINTED IT\b[^\n]*\n(.+)$/m.exec(text)[1]);
  assert.match(/^HOW THEY PAINTED IT[^\n]*/m.exec(text)[0], /against the rest of tonight/);
  assert.deepEqual(painted.notable.filter((g) => g.stroke === 2).map((g) => g.kind), ['held', 'redrawn', 'pressed']);
  assert.equal(painted.notable[1].detail, 'You painted this, washed it out, and painted it again.');
  assert.deepEqual(painted.feeling, { learned_from_strokes: 0, nights_read: 0, last_reading: null, what_it_has_meant: [] }, 'what the feeling model has learned of them: nothing yet');
  assert.deepEqual(JSON.parse(/^WHAT THEY KEEP\b[^\n]*\n(.+)$/m.exec(text)[1]), { lines_answered: 0, kept: 0, learned: [] });
  assert.ok(Array.isArray(JSON.parse(/^FEELING\b[^\n]*\n(.+)$/m.exec(text)[1])), 'what they marked, and only that');
  // when they did not mark it: their one word, and how the model their marks taught reads each stroke, as a guess
  const unmarked = tonightCtx({ feeling: null, felt: 'sad' });
  const t2 = firstMessage(unmarked, { numbered: 'data:image/jpeg;base64,TlVN', brief: briefFor(w, unmarked) })[2].text;
  assert.match(/^FEELING[^\n]*/m.exec(t2)[0], /a guess, with how sure/);
  const felt = JSON.parse(/^FEELING\b[^\n]*\n(.+)$/m.exec(t2)[1]);
  assert.equal(felt.word, 'sad');
  assert.deepEqual([felt.read_from_brush.strokes.length, felt.read_from_brush.learned_from_strokes, felt.read_from_brush.level_from], [2, 0, 'their word']);
  assert.ok(felt.read_from_brush.strokes.every((s) => s.weight < 0), 'about their word: sad');
  assert.ok(!/read_from_brush/.test(/^THEIR WORLD\b[^\n]*\n(.+)$/m.exec(t2)[1]));
  assert.ok(!/how_they_painted/.test(/^THEIR WORLD\b[^\n]*\n(.+)$/m.exec(text)[1]), 'said once, under its own heading');
});

test('earlier chapters in the first turn: the last two as told, older ones as fenced recaps where they bear on tonight, and what it cost kept out of the conversation', () => {
  const w = createDreamWorld();
  ['the lighthouse', 'the gull', 'the ferry', 'the reef', 'the tide clock', 'the shell', 'the net'].forEach((name, i) => w.commit({
    telling: { title: `Chapter ${i + 1}`, lines: [{ text: `You came to ${name}.`, strokes: [1] }, { text: 'The water was still.', strokes: [2] }] },
    strokes: NIGHT_STROKES, words: [{ n: 1, text: name }], reactions: ['yes', null],
    diff: { entities: [{ new: name, kind: 'thing', lines: [0], strokes: [1] }] },
  }));
  const ctx = tonightCtx({ words: [{ n: 2, text: 'the lighthouse again, its lamp out' }] });
  const brief = briefFor(w, ctx);
  const text = firstMessage(ctx, { numbered: 'data:image/jpeg;base64,TlVN', brief })[2].text;
  const section = (h) => { const m = new RegExp(`^${h}\\b[^\\n]*\\n(.+)$`, 'm').exec(text); return m && JSON.parse(m[1]); };
  assert.deepEqual(section('THE LAST CHAPTERS').map((c) => [c.night, c.told[0]]), [[6, 'You came to the shell.'], [7, 'You came to the net.']]);
  assert.equal(section('EARLIER CHAPTERS')[0].chapters, 'chapters 1 to 4', 'the oldest that bears on tonight first: they named the lighthouse');
  assert.ok(section('EARLIER CHAPTERS').every((c) => !/^chapters? [67]\b/.test(c.chapters)), 'nothing from the last chapters twice');
  assert.match(/^EARLIER CHAPTERS[^\n]*/m.exec(text)[0], /for reference only, never lines to tell/);
  assert.match(section('EARLIER CHAPTERS')[0].recap, /^Chapter 1, Chapter 1: the lighthouse\. You came to the lighthouse\./);
  const world = section('THEIR WORLD');
  assert.ok(!('recent' in world) && !('recaps' in world) && !('memory' in world), 'said once, under their own headings; what it cost stays on the TV');
  assert.ok(brief.memory.recaps[0].because.includes('the lighthouse'));
  assert.ok(brief.memory.tokens <= brief.memory.budget);
  // a first night: no earlier chapters at all
  const none = firstMessage(tonightCtx(), { numbered: 'data:image/jpeg;base64,TlVN', brief: briefFor(createDreamWorld(), tonightCtx()) })[2].text;
  assert.ok(!/^THE LAST CHAPTERS|^EARLIER CHAPTERS/m.test(none));
});

test('what it remembered: the chapters it was given, the recaps and why, and what it looked up, kept with the chapter, on its page, and gone with what is forgotten', async () => {
  const { bookOf, rememberedSays } = await import('../src/book.js');
  const w = createDreamWorld();
  ['the lighthouse', 'the gull', 'the ferry', 'the reef', 'the tide clock', 'the shell', 'the net'].forEach((name, i) => w.commit({
    telling: { title: `The ${['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'][i]} Tide`, lines: [{ text: `You came to ${name}.`, strokes: [1] }, { text: 'The water was still.', strokes: [2] }] },
    strokes: NIGHT_STROKES, words: [{ n: 1, text: name }], reactions: ['yes', null],
    diff: { entities: [{ new: name, kind: 'thing', lines: [0], strokes: [1] }] },
  }));
  const ctx = tonightCtx({ words: [{ n: 2, text: 'the lighthouse again, its lamp out' }] });
  const t = createTools(ctx, { world: w, paintings: memoryPaintings(), render: fakeRender, ui: screen().ui });
  t.briefed(briefFor(w, ctx));
  const light = w.entities.find((e) => e.name === 'the lighthouse');
  await t.recall({ query: 'the lighthouse lamp' });
  await t.thing({ id: light.id });
  await t.night({ night: 1 });
  await t.tell({ title: 'The Lamp', lines: [{ text: 'The lighthouse stood dark over the pier, its lamp out.', strokes: [2] }, { text: 'A boat waiting at the pier.', strokes: [1] }] });
  await t.remember({ things: [{ id: light.id, strokes: [2] }] });
  const kept = w.toJSON().nights.at(-1).remembered;
  assert.deepEqual([kept.recent, kept.recaps[0].chapters, kept.looked_up, kept.read, kept.nights], [[6, 7], 'chapters 1 to 4', ['the lighthouse lamp'], ['the lighthouse'], [1]]);
  assert.ok(kept.recaps[0].because.includes('the lighthouse') && kept.tokens > 0);
  const page = bookOf(w).nights.at(-1);
  assert.match(page.remembered, /^What the storyteller remembered: chapters 6 and 7 as they were told; a recap of chapters 1 to 4, for [^;]*the lighthouse[^;]*;( a recap of [^;]*;)* it looked for “the lighthouse lamp”; it read about the lighthouse and chapter 1\.$/);
  assert.equal(bookOf(w).nights[0].remembered, null, 'a chapter kept before had nothing to remember');
  assert.match(rememberedSays({ recent: [3], recaps: [], looked_up: [], read: [], nights: [] }, { young: true }), /^The storyteller remembered: chapter 3 as it was told\.$/);
  // forgotten: gone from what it remembered too
  w.forget(light.id);
  const after = w.toJSON().nights.at(-1).remembered;
  assert.ok(!JSON.stringify(after).includes('lighthouse'), JSON.stringify(after));
});

test('drawn into their world: the guide is shown it as light, as they see it; the painting kept stays the painting', async () => {
  const w = createDreamWorld();
  const LIT = 'data:image/jpeg;base64,TElU';
  const ctx = tonightCtx({ lit: true, seen: LIT, asSeen: async (url) => `data:image/jpeg;base64,${Buffer.from(`light of ${url.slice(-4)}`).toString('base64')}` });
  const content = firstMessage(ctx, { numbered: 'data:image/jpeg;base64,TlVN', brief: briefFor(w, ctx) });
  assert.deepEqual(content.slice(0, 2).map((b) => b.source.data), ['TElU', 'TlVN']);
  assert.match(content[2].text, /^Tonight's painting is above as they see it, drawn into their world as light on the night/);
  const paintings = memoryPaintings();
  await paintings.put(1, { image: 'data:image/jpeg;base64,T0xE', strokes: keptStrokes(NIGHT_STROKES, [[{ x: 100, y: 600 }], [{ x: 1100, y: 700 }]]) });
  const t = createTools(ctx, { world: w, paintings, render: fakeRender, ui: screen().ui });
  const url = (r) => JSON.parse(Buffer.from(r.image.split(',')[1], 'base64')).url;
  assert.equal(url(await t.look({})), 'TElU', 'tonight, as light');
  assert.equal(url(await t.look({ night: 1 })), Buffer.from('light of T0xE').toString('base64').slice(-4), 'an earlier night, as light too');
  const broken = createTools({ ...ctx, asSeen: async () => { throw new Error('no'); } }, { world: w, paintings, render: fakeRender, ui: screen().ui });
  assert.equal(url(await broken.look({ night: 1 })), 'T0xE', 'as kept, if it can\'t be made light');
  assert.match(firstMessage(tonightCtx(), { numbered: PIC, brief: briefFor(w, tonightCtx()) })[2].text, /^Tonight's painting is above: as it is/, 'on paper, as before');
});

test('the tools: what the guide sees, reads and recalls, and what it can\'t do', async () => {
  const w = createDreamWorld();
  const paintings = memoryPaintings();
  await paintings.put(1, { image: 'data:image/jpeg;base64,T0xE', strokes: keptStrokes(NIGHT_STROKES, [[{ x: 100, y: 600 }], [{ x: 1100, y: 700 }]]) });
  const { ui } = screen();
  const t = createTools(tonightCtx(), { world: w, paintings, render: fakeRender, ui });
  const close = await t.look({ strokes: [2, 9], zoom: true });
  assert.deepEqual(JSON.parse(Buffer.from(close.image.split(',')[1], 'base64')), { url: 'QUJD', lit: [2], zoom: true }, 'only tonight\'s strokes lit');
  assert.match(close.text, /marks 2 lit, close up/);
  assert.match((await t.look({ night: 1, strokes: [2], zoom: true })).text, /Night 1's painting, marks 2 lit/);
  await assert.rejects(t.look({ night: 4 }), /no painting kept for night 4/);
  assert.match((await t.look({ after: 1 })).text, /up to mark 1/);
  await assert.rejects(t.look({ after: 7 }), /no mark 7/);
  const [d] = await t.strokes({ strokes: [2] });
  assert.deepEqual([d.seconds, d.wait, d.still, d.pools, d.they_said, d.felt, d.washed_out_before_it], [3, 2.5, 2.2, 1, ['a boat waiting at the pier'], { weight: -0.7, stir: 0.6 }, [[1000, 650, 1120, 750]]]);
  assert.deepEqual(d.stands_out, ['You held the brush still here for 2.2 s, and the ink pooled and spread.', 'You painted this, washed it out, and painted it again.', 'You pressed hard on this stroke.']);
  assert.deepEqual((await t.strokes({ night: 1, strokes: [2] }))[0].box, [1040, 660, 1110, 740]);
  await assert.rejects(t.strokes({ strokes: [] }), /by number/);
  await assert.rejects(t.thing({ id: 'e9' }), /no e9/);
  await assert.rejects(t.night({ night: 3 }), /no night 3/);
  await assert.rejects(t.recall({ query: '  ' }), /what to look for/);
  await assert.rejects(t.ask({ question: 'What was it?', choices: [] }), /two to four answers/);
  await assert.rejects(t.tell({ title: 'T', lines: [{ text: 'One line only.', strokes: [1] }] }), /two to seven lines/);
});

test('telling and remembering: what they said of each line, a line told again in place, the night kept as they confirmed it', async () => {
  const w = createDreamWorld();
  const paintings = memoryPaintings();
  const sc = screen({ answer: 'the night ferry', reactions: (n, k) => (k === 1 ? ['yes', 'no'] : ['yes']) });
  const t = createTools(tonightCtx(), { world: w, paintings, render: fakeRender, ui: sc.ui });
  assert.deepEqual(await t.ask({ question: 'What was waiting there?', choices: ['the night ferry', 'a gate'], strokes: [2] }), { answer: 'the night ferry', by: 'choice' });
  // a telling that leaves out what they said is sent back, not told
  await assert.rejects(t.tell({ title: 'The Pier', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'The ferry left without you.', strokes: [2] }] }), /^Error: Sent back, not told\. They said "a boat waiting at the pier" as they painted, and no line uses their words\./);
  assert.equal(sc.told.length, 0);
  const first = await t.tell({ title: 'The Pier', lines: [{ text: 'A long *flat* sea.', strokes: [1] }, { text: 'A boat waiting at the pier; the ferry left without you.', strokes: [2, 8] }] });
  assert.deepEqual(first.reactions, [{ line: 1, said: 'yes' }, { line: 2, said: 'no' }]);
  assert.deepEqual(sc.told[0].lines, [{ text: 'A long flat sea.', strokes: [1] }, { text: 'A boat waiting at the pier; the ferry left without you.', strokes: [2] }], 'cleaned; only tonight\'s strokes');
  assert.deepEqual(t.checks.map((c) => [c.ok, c.blocking]), [[false, ['words_unused']], [true, []]]);
  await t.tell({ title: 'The Pier', lines: [{ text: 'The night ferry waited, lights off, for you.', strokes: [2] }] });
  assert.equal(sc.told[1].again, true);
  assert.deepEqual(finalTelling(t.tellings).lines.map((l) => [l.text, l.reaction]), [['A long flat sea.', 'yes'], ['The night ferry waited, lights off, for you.', 'yes']], 'told again in place of what was not quite');
  const kept = await t.remember({ things: [{ name: 'the night ferry', kind: 'thing', aliases: ['ferry'], strokes: [2], why: 'it left without me' }], facts: [{ about: 'the night ferry', text: 'It waited at the end of the pier.', open: true }], notes: ['Plain words land.'] });
  assert.deepEqual(kept, { night: 1, kept: ['the night ferry (new)'], let_go: [] });
  const ferry = w.entities.find((e) => e.name === 'the night ferry');
  assert.deepEqual([ferry.appearances[0].strokes, ferry.appearances[0].v, ferry.appearances[0].whyText, ferry.status], [[2], -0.7, 'it left without me', 'confirmed']);
  assert.deepEqual(w.nights[0].asked, [{ question: 'What was waiting there?', answer: 'the night ferry' }]);
  assert.equal((await paintings.get(1)).image, PIC, 'the painting kept with the night');
  assert.ok((await paintings.get(1)).strokes[1].path.length >= 1);
});

test('told to them, as "you": their words come with how the story says them, a line in "I" is sent back once and then said to them, and what is kept is kept as "you"', async () => {
  const w = createDreamWorld();
  const ctx = tonightCtx({ words: [{ n: 2, text: 'I found my boat at the pier' }] });
  const text = firstMessage(ctx, { numbered: 'data:image/jpeg;base64,TlVN', brief: briefFor(w, ctx) })[2].text;
  assert.deepEqual(JSON.parse(/^THEIR WORDS\b[^\n]*\n(.+)$/m.exec(text)[1]), [{ n: 2, text: 'I found my boat at the pier', as_you: 'You found your boat at the pier' }]);
  const sc = screen({ answer: 'my old boat' });
  const t = createTools(ctx, { world: w, paintings: memoryPaintings(), render: fakeRender, ui: sc.ui });
  assert.deepEqual(await t.ask({ question: 'What was this?', choices: ['a boat', 'a gate'], strokes: [2] }), { answer: 'my old boat', by: 'choice', as_you: 'your old boat' });
  const lines = [{ text: 'A long flat sea.', strokes: [1] }, { text: 'I found my boat at the pier, my old boat.', strokes: [2] }];
  await assert.rejects(t.tell({ title: 'The Pier', lines }), /Sent back, not told\. Line 2 tells it as "I", as if you were them\./);
  const r = await t.tell({ title: 'The Pier', lines });
  assert.deepEqual(sc.told[0].lines.map((l) => l.text), ['A long flat sea.', 'You found your boat at the pier, your old boat.'], 'said to them, as you');
  assert.deepEqual(r.told_as_you, [{ line: 2, told: 'You found your boat at the pier, your old boat.' }]);
  assert.deepEqual(t.checks.map((c) => [c.blocking, c.as_you || null]), [[['first_person'], null], [['first_person'], [2]]]);
  await t.remember({ things: [{ name: 'the old boat', kind: 'thing', strokes: [2], note: 'My grandfather built it.' }], facts: [{ about: 'the old boat', text: 'We sail it when the tide is in.', open: false }] });
  const S = w.toJSON();
  assert.deepEqual(S.facts.map((f) => f.text), ['You sail it when the tide is in.']);
  assert.equal(S.entities.find((e) => e.name === 'the old boat').appearances[0].note, 'Your grandfather built it.');
  assert.deepEqual(S.nights[0].lines.map((l) => l.text), ['A long flat sea.', 'You found your boat at the pier, your old boat.']);
});

test('not quite, and the other way to say it is heard at once: only an other way that holds is offered, and what they said of it is kept', async () => {
  const w = createDreamWorld();
  const seen = [];
  const ui = { ask: async () => ({ answer: null, by: 'skipped' }), tell: async (t) => { seen.push(t); return { reactions: ['yes', 'yes'], swapped: [0, 1], words: [] }; } };
  const t = createTools(tonightCtx(), { world: w, paintings: memoryPaintings(), render: fakeRender, ui });
  const r = await t.tell({ title: 'The Pier', lines: [
    { text: 'A boat waiting at the pier.', alt: 'The boat was waiting at the pier, its lamp lit.', strokes: [2] },
    { text: 'A long flat sea, and the boat beyond it.', alt: 'It meant you were alone.', strokes: [1] },
  ] });
  assert.deepEqual(seen[0].lines.map((l) => l.other || null), ['The boat was waiting at the pier, its lamp lit.', null], 'an other way that explains is never offered');
  assert.deepEqual(r.heard_the_other, [{ line: 1, told: 'The boat was waiting at the pier, its lamp lit.', said: 'yes' }], 'a line with no other way offered is not swapped, whatever the screen says');
  assert.deepEqual(t.tellings[0].lines.map((l) => l.text), ['The boat was waiting at the pier, its lamp lit.', 'A long flat sea, and the boat beyond it.']);
  await t.remember({ things: [] });
  assert.deepEqual(w.nights[0].lines.map((l) => [l.text, l.reaction]), [['The boat was waiting at the pier, its lamp lit.', 'yes'], ['A long flat sea, and the boat beyond it.', 'yes']], 'the night keeps what they heard and kept');
});

test('how a thing looks in their own words, on its card; let go, it is gone from it', async () => {
  const { cardsOf } = await import('../src/cards.js');
  const w = createDreamWorld();
  w.commit({ telling: { title: 'x', lines: [{ text: 'A fox on the sand.', strokes: [1] }] }, strokes: NIGHT_STROKES, reactions: ['yes'], diff: { entities: [{ new: 'the fox', kind: 'creature', lines: [1] }], facts: [], resolved: [] } });
  const fox = w.toJSON().entities.find((e) => e.name === 'the fox');
  assert.ok(fox, JSON.stringify(w.toJSON().entities));
  assert.equal(cardsOf(w.toJSON())[0].rule, null);
  w.ruled(fox.id, 'The fox has a white tip on its tail.');
  assert.equal(cardsOf(w.toJSON())[0].rule, 'The fox has a white tip on its tail');
  w.ruled(fox.id, '');
  assert.equal(cardsOf(w.toJSON())[0].rule, null);
});

test('a line or its alternative: what can\'t be told never is, and their taste, learned night by night, chooses the rest', async () => {
  // explaining is never told: its alternative is
  const fresh = createDreamWorld();
  const sc = screen();
  const t = createTools(tonightCtx(), { world: fresh, paintings: memoryPaintings(), render: fakeRender, ui: sc.ui });
  const r = await t.tell({ title: 'The Pier', lines: [{ text: 'It meant you missed someone.', alt: 'A boat waiting at the pier.', strokes: [2] }, { text: 'The sea lay flat.', strokes: [1] }] });
  assert.deepEqual(sc.told[0].lines.map((l) => l.text), ['A boat waiting at the pier.', 'The sea lay flat.']);
  assert.deepEqual(r.told_the_alt, [{ line: 1, told: 'A boat waiting at the pier.' }], 'the guide hears which it was');
  // someone who, three nights running, kept the line that named what they felt
  const feels = createDreamWorld();
  for (let k = 0; k < 3; k++) feels.commit({ telling: { title: 'x', lines: [{ text: 'You were afraid of the water.', strokes: [1] }, { text: 'The pier was long.', strokes: [2] }] }, strokes: NIGHT_STROKES, reactions: ['yes', 'no'] });
  const pair = { title: 'The Pier', lines: [{ text: 'A boat waited at the pier.', alt: 'A boat waited at the pier, and you were afraid.', strokes: [2] }, { text: 'The sea lay flat.', strokes: [1] }] };
  const told = async (world) => { const s = screen(); const r = await createTools(tonightCtx(), { world, paintings: memoryPaintings(), render: fakeRender, ui: s.ui }).tell(pair); return [s.told[0].lines[0].text, r]; };
  const [mostPeople] = await told(createDreamWorld());
  const [theirs, rt] = await told(feels);
  assert.equal(mostPeople, 'A boat waited at the pier.');
  assert.equal(theirs, 'A boat waited at the pier, and you were afraid.');
  assert.ok(rt.to_mind.some((m) => /names a feeling/.test(m)), 'still said, for the guide to weigh');
});

test('the feeling model in the guide\'s first turn: what their marks have taught, how far they usually move the dial, and a reading when they don\'t mark', () => {
  const w = createDreamWorld();
  for (let k = 0; k < 5; k++) w.commit({ telling: { title: 'x', lines: [{ text: 'The tide drew back.', strokes: [1] }] }, strokes: NIGHT_STROKES, feeling: { byStroke: [0, -0.4], arousal: [0, 0.3] }, reactions: [null] });
  const ctx = tonightCtx();
  const text = firstMessage(ctx, { numbered: PIC, brief: briefFor(w, ctx) })[2].text;
  assert.match(/^FEELING[^\n]*/m.exec(text)[0], /for them an ordinary mark is about 0\.2 either way in weight and 0\.15 in stir/);
  const painted = JSON.parse(/^HOW THEY PAINTED IT\b[^\n]*\n(.+)$/m.exec(text)[1]);
  assert.deepEqual([painted.feeling.learned_from_strokes, painted.feeling.nights_read], [10, 5]);
  // skipped tonight: read from their brush by what those five nights taught
  const skipped = tonightCtx({ feeling: null, felt: null });
  const felt = JSON.parse(/^FEELING\b[^\n]*\n(.+)$/m.exec(firstMessage(skipped, { numbered: PIC, brief: briefFor(w, skipped) })[2].text)[1]);
  assert.deepEqual([felt.word, felt.read_from_brush.learned_from_strokes, felt.read_from_brush.level_from], [null, 10, 'their brush']);
  assert.ok(felt.read_from_brush.strokes[1].weight < felt.read_from_brush.strokes[0].weight, 'the stroke that was always heavier reads heavier');
});

test('the loop: bounded, every call answered, reminded once to tell and to remember, stopped when they leave', async () => {
  const turns = [];
  const script = (steps) => ({ agent: async ({ messages }) => { turns.push(messages.length); return steps.shift() || { content: [{ type: 'text', text: 'Until next time.' }], stop_reason: 'end_turn' }; } });
  const call = (name, input = {}, id = name) => ({ type: 'tool_use', id: `t_${id}`, name, input });
  const ran = [];
  const tools = {
    look: async () => { ran.push('look'); return { image: PIC, text: 'seen' }; },
    ask: async () => { ran.push('ask'); return { answer: 'x' }; },
    tell: async () => { ran.push('tell'); return { reactions: [] }; },
    remember: async () => { ran.push('remember'); return { kept: ['x (new)'] }; },
    strokes: async () => { throw new Error('no such stroke'); },
  };
  const r = await runGuide({
    ai: script([
      { content: [call('look'), call('strokes', {}, 's')], stop_reason: 'tool_use' },
      { content: [call('remember', {}, 'r0')], stop_reason: 'tool_use' },
      { content: [call('ask', {}, 'a1'), call('ask', {}, 'a2'), call('ask', {}, 'a3')], stop_reason: 'tool_use' },
      { content: [{ type: 'text', text: 'Hmm.' }], stop_reason: 'end_turn' },
      { content: [call('tell')], stop_reason: 'tool_use' },
      { content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn' },
      { content: [call('remember', {}, 'r1')], stop_reason: 'tool_use' },
    ]),
    first: [{ type: 'text', text: 'Tell it.' }], tools,
  });
  assert.deepEqual(ran, ['look', 'ask', 'ask', 'tell', 'remember']);
  assert.equal(r.told, true);
  assert.deepEqual(r.kept, { kept: ['x (new)'] });
  assert.equal(r.goodnight, 'Until next time.');
  const results = r.messages.filter((m) => m.role === 'user' && Array.isArray(m.content)).flatMap((m) => m.content).filter((b) => b.type === 'tool_result');
  const by = (id) => results.find((b) => b.tool_use_id === id);
  assert.equal(by('t_look').content[0].type, 'image', 'a picture goes back as a picture');
  assert.match(by('t_s').content, /no such stroke/);
  assert.equal(by('t_s').is_error, true);
  assert.match(by('t_r0').content, /Tell it first/);
  assert.match(by('t_a3').content, /asked enough/);
  assert.ok(r.messages.some((m) => m.content === 'Tell it now, with tell.'));
  assert.ok(r.messages.some((m) => m.content === 'Now keep what this painting added, with remember.'));
  // they leave before it is told: the loop stops between turns
  let rounds = 0;
  const gone = await runGuide({ ai: { agent: async () => { rounds++; return { content: [call('look', {}, `l${rounds}`)], stop_reason: 'tool_use' }; } }, first: 'x', tools, stop: () => rounds >= 2 });
  assert.equal(rounds, 2);
  assert.equal(gone.told, false);
  // a refusal ends it, for the plain telling to take over
  await assert.rejects(runGuide({ ai: { agent: async () => ({ content: [{ type: 'text', text: '' }], stop_reason: 'refusal' }) }, first: 'x', tools }), /would not tell/);
  // only the guide's own tools: what else the TV keeps on them is never the guide's to call
  let briefed = 0;
  const own = { ...tools, briefed: () => { briefed++; }, tellings: [] };
  const odd = await runGuide({ ai: script([{ content: [call('briefed', { memory: {} }, 'b'), call('tellings', {}, 'tl'), call('constructor', {}, 'c'), call('tell', {}, 't2')], stop_reason: 'tool_use' }, { content: [call('remember', {}, 'r2')], stop_reason: 'tool_use' }]), first: 'x', tools: own });
  const oddResults = odd.messages.filter((m) => m.role === 'user' && Array.isArray(m.content)).flatMap((m) => m.content);
  assert.equal(briefed, 0);
  assert.deepEqual(['t_b', 't_tl', 't_c'].map((id) => oddResults.find((b) => b.tool_use_id === id).content), ['There is no briefed tool.', 'There is no tellings tool.', 'There is no constructor tool.']);
  assert.equal(odd.told, true);
  assert.equal(stepOf([call('look', { night: 2 })]), "Looking at chapter 2's painting");
  assert.equal(stepOf([call('strokes', { strokes: [4] })]), 'Reading how you painted mark 4');
});

test('a head start: the guide\'s first turn goes while they mark it; the next waits for what they marked, and carries it once, after the results', async () => {
  const sent = [];
  const call = (name, input = {}, id = name) => ({ type: 'tool_use', id: `t_${id}`, name, input });
  const steps = [
    { content: [call('look'), call('recall', { query: 'the pier' })], stop_reason: 'tool_use' },
    { content: [call('tell')], stop_reason: 'tool_use' },
    { content: [call('remember')], stop_reason: 'tool_use' },
    { content: [{ type: 'text', text: 'Until next time.' }], stop_reason: 'end_turn' },
  ];
  const tools = { look: async () => ({ image: PIC, text: 'seen' }), recall: async () => ({ things: [] }), tell: async () => ({ reactions: [] }), remember: async () => ({ kept: [] }) };
  let give;
  const later = new Promise((r) => { give = r; });
  const run = runGuide({ ai: { agent: async ({ messages }) => { sent.push(structuredClone(messages)); return steps.shift(); } }, first: 'x', tools, later });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sent.length, 1, 'the first turn went at once; the second waits for what they marked');
  give('They have marked it now.\nFEELING (marked)\n[]');
  const r = await run;
  assert.equal(r.told, true);
  assert.equal(r.early, 1, 'one turn asked for before they had marked it');
  assert.deepEqual(sent[1].at(-1).content.map((b) => b.type), ['tool_result', 'tool_result', 'text'], 'after the results it answers');
  assert.match(sent[1].at(-1).content[2].text, /^They have marked it now/);
  const carried = sent.at(-1).flatMap((m) => (Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }])).filter((b) => b.type === 'text' && /marked it now/.test(b.text));
  assert.equal(carried.length, 1, 'carried once');
  // no head start: nothing waits, nothing is carried
  const plain = await runGuide({ ai: { agent: async () => ({ content: [call('tell', {}, 'p1')], stop_reason: 'tool_use' }) }, first: 'x', tools, limits: { rounds: 2 } });
  assert.equal(plain.early, 0);
});

test('a head start: a telling before how it felt has come goes back with it; a question waits for it; gone back to the paper, nothing is told', async () => {
  const call = (name, input = {}, id = name) => ({ type: 'tool_use', id: `t_${id}`, name, input });
  let give, marked = false;
  const later = new Promise((r) => { give = r; });
  const ran = [];
  const tools = {
    ask: async () => { ran.push(['ask', marked]); return { answer: 'the night ferry' }; },
    tell: async () => { ran.push(['tell', marked]); return { reactions: [] }; },
    remember: async () => ({ kept: [] }),
  };
  const steps = [
    { content: [call('ask'), call('tell')], stop_reason: 'tool_use' },
    { content: [call('tell', {}, 't2')], stop_reason: 'tool_use' },
    { content: [call('remember')], stop_reason: 'tool_use' },
  ];
  setTimeout(() => { marked = true; give('They have marked it now.'); }, 20);
  const r = await runGuide({ ai: { agent: async () => steps.shift() || { content: [{ type: 'text', text: 'Until next time.' }], stop_reason: 'end_turn' } }, first: 'x', tools, later });
  assert.deepEqual(ran, [['ask', true], ['tell', true]], 'asked once it had come; told only the second time');
  const results = r.messages.filter((m) => m.role === 'user' && Array.isArray(m.content)).flatMap((m) => m.content);
  const by = (id) => results.find((b) => b.tool_use_id === id);
  assert.match(by('t_tell').content, /has just come in \(below\): tell it with that/);
  assert.equal(by('t_tell').is_error, true);
  assert.equal(results.filter((b) => b.type === 'text' && /marked it now/.test(b.text)).length, 1, 'how it felt, after the first results');
  assert.equal(r.told, true);
  // they go back to the paper as the first turn tells: nothing is told, and the loop ends
  let rounds = 0;
  const gone = await runGuide({ ai: { agent: async () => { rounds++; return { content: [call('tell', {}, `g${rounds}`)], stop_reason: 'tool_use' }; } }, first: 'x', tools: { tell: async () => { throw new Error('never told'); } }, later: Promise.resolve(null) });
  assert.equal(rounds, 1);
  assert.equal(gone.told, false);
  assert.match(gone.messages.at(-1).content[0].content, /went back to the paper/);
});

test('a head start\'s two messages: the first without how it felt, the second with it, its turn, and what they said meanwhile; the stand-in remembers first, then looks where it turned', () => {
  const w = createDreamWorld();
  const ctx = tonightCtx({ feeling: null, turn: null });
  const t = firstMessage(ctx, { numbered: PIC, brief: briefFor(w, ctx), later: true })[2].text;
  assert.match(t, /^FEELING \(still coming: they are marking it now/m);
  assert.doesNotMatch(t, /^TURN\b/m, 'where it turned comes later');
  assert.match(t, /Ask and tell once how it felt has come\.$/);
  const since = ctx.words.length;
  Object.assign(ctx, { feeling: { byStroke: [0, -0.7], arousal: [0, 0.6] }, turn: { n: 2, delta: -0.7, stir: 0.6, size: 0.8 }, words: [...ctx.words, { n: 1, text: 'the low shore' }] });
  const m = laterMessage(ctx, { brief: briefFor(w, ctx), since });
  const sec = (text, name) => JSON.parse(new RegExp(`^${name}\\b[^\\n]*\\n(.+)$`, 'm').exec(text)[1]);
  assert.deepEqual(sec(m, 'FEELING'), [{ n: 1, weight: 0, stir: 0 }, { n: 2, weight: -0.7, stir: 0.6 }]);
  assert.equal(sec(m, 'TURN').stroke, 2);
  assert.deepEqual(sec(m, 'THEIR WORDS'), [{ n: 1, text: 'the low shore' }], 'only what was said while it came back');
  assert.match(m, /Tell it\.$/);
  // their one word instead: the guess read from the brush, with it
  const word = laterMessage({ ...ctx, feeling: null, felt: 'calm', turn: null }, { brief: briefFor(w, { ...ctx, feeling: null, felt: 'calm' }) });
  assert.equal(sec(word, 'FEELING').word, 'calm');
  // the stand-in, as the dev server and the browser test have it
  const first = firstMessage(tonightCtx({ feeling: null, turn: null }), { numbered: PIC, brief: briefFor(w, tonightCtx({ feeling: null, turn: null })), later: true });
  const t1 = standInAgent({ messages: [{ role: 'user', content: first }] });
  assert.equal(t1.content.at(-1).name, 'recall', 'while they mark it, it remembers their world');
  const id = t1.content.at(-1).id;
  const t2 = standInAgent({ messages: [{ role: 'user', content: first }, { role: 'assistant', content: t1.content }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: '{}' }, { type: 'text', text: m }] }] });
  assert.equal(t2.content.at(-1).name, 'look');
  assert.deepEqual(t2.content.at(-1).input.strokes, [2], 'then looks closer where it turned');
});

test('a head start, for a child: what they marked darker, come after the tools were made, still holds a telling gentle', async () => {
  const sc = screen({ answer: 'a boat' });
  const ctx = tonightCtx({ words: [], young: true, feeling: null, turn: null });
  const t = createTools(ctx, { world: createDreamWorld(), paintings: memoryPaintings(), render: fakeRender, ui: sc.ui });
  // how it felt comes in after (stroke 2 marked darker)
  Object.assign(ctx, { feeling: { byStroke: [0, -0.7], arousal: [0, 0.6] }, turn: { n: 2, delta: -0.7, stir: 0.6, size: 0.8 } });
  await t.ask({ question: 'What was this?', choices: ['a boat', 'a cloud'], strokes: [2] });
  await assert.rejects(t.tell({ title: 'The Boat', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'A boat came, bigger and bigger.', strokes: [2] }] }), /makes what they marked darker "bigger"/);
  assert.equal(sc.told.length, 0);
});

test('two nights with the stand-in guide on the real tools: the second recognises, shows the first night\'s mark, and carries it on', async () => {
  const w = createDreamWorld();
  const paintings = memoryPaintings();
  const ai = { agent: async ({ messages }) => standInAgent({ model: 'm', messages }) };
  // night one: it asks what the mark was, tells, remembers
  const sc1 = screen({ answer: 'the night ferry' });
  const c1 = tonightCtx({ words: [] });
  const t1 = createTools(c1, { world: w, paintings, render: fakeRender, ui: sc1.ui });
  const r1 = await runGuide({ ai, first: firstMessage(c1, { numbered: PIC, brief: briefFor(w, c1) }), tools: t1 });
  assert.deepEqual(r1.kept.kept, ['the night ferry (new)']);
  assert.equal(sc1.asked[0].question, 'What was this, in your dream?');
  // night two: a mark like it, in the same place
  const night2 = NIGHT_STROKES.map((s) => ({ ...s, box: s.box.map((x) => x + 15), from: s.from.map((x) => x + 15), to: s.to.map((x) => x + 15) }));
  const sc2 = screen({ answer: 'Yes, the same' });
  const c2 = tonightCtx({ strokes: night2, words: [] });
  const brief = briefFor(w, c2);
  assert.equal(brief.hints[0].name, 'the night ferry');
  const t2 = createTools(c2, { world: w, paintings, render: fakeRender, ui: sc2.ui });
  const r2 = await runGuide({ ai, first: firstMessage(c2, { numbered: PIC, brief }), tools: t2 });
  assert.equal(sc2.asked[0].question, 'Is this the night ferry again?');
  assert.equal(sc2.asked[0].beside.night, 1, 'the first night\'s mark shown beside tonight\'s');
  assert.match(sc2.told[0].lines.find((l) => l.strokes.includes(2)).text, /the night ferry came back/);
  assert.deepEqual(r2.kept.kept, ['the night ferry (a second chapter)']);
  assert.equal(w.summary().recurring[0].nights, 2);
  assert.equal(r2.goodnight, 'Until next time.');
});

test('what they said came again is never lost: a remember that can\'t place a thing, or leaves out what they said came again, is sent back once; then what can be is kept, with it', async () => {
  const w = createDreamWorld();
  const paintings = memoryPaintings();
  const t1 = createTools(tonightCtx({ words: [] }), { world: w, paintings, render: fakeRender, ui: screen({ answer: 'the night ferry' }).ui });
  await t1.ask({ question: 'What was waiting there?', choices: ['the night ferry', 'a gate'], strokes: [2] });
  await t1.tell({ title: 'The Pier', lines: [{ text: 'The night ferry waited at the pier.', strokes: [2] }, { text: 'A long flat sea, and the night ferry on it.', strokes: [1] }] });
  await t1.remember({ things: [{ name: 'the night ferry', kind: 'thing', strokes: [2] }] });
  const ferry = w.entities[0].id;
  // night two: asked whether a mark is the ferry, shown beside the first night's, they say yes
  const ask2 = () => ({ question: 'Is this the night ferry again?', choices: ['Yes, the same', 'No, something else'], strokes: [2], show: { night: 1, strokes: [2] } });
  const lines2 = { title: 'The Pier Again', lines: [{ text: 'The night ferry came back to the pier.', strokes: [2] }, { text: 'The sea lay flat under the night ferry.', strokes: [1] }] };
  const t2 = createTools(tonightCtx({ words: [] }), { world: w, paintings, render: fakeRender, ui: screen({ answer: 'Yes, the same' }).ui });
  await t2.ask(ask2());
  await t2.tell(lines2);
  await assert.rejects(t2.remember({ things: [{ strokes: [2], why: 'it came back' }, { id: 'e9', strokes: [1] }] }),
    /^Error: Nothing is kept yet\. Thing 1 has neither an id nor a name\. There is no e9 in their world \(thing 2\)\. They said "Yes, the same" when you asked "Is this the night ferry again\?": the night ferry \(e1\) came again tonight, and nothing here keeps it\. Keep a thing from an earlier night by its id/);
  assert.equal(w.nights.length, 1, 'nothing kept yet');
  // the same again: what can be is kept, and what they said came again with it
  const kept = await t2.remember({ things: [{ strokes: [2] }] });
  assert.deepEqual(kept.kept, ['the night ferry (a second chapter)']);
  assert.deepEqual([w.nights.length, w.entities.length, w.entities[0].appearances.map((a) => a.strokes)], [2, 1, [[2], [2]]]);
  // given by its name, it is the same thing: nothing sent back
  const t3 = createTools(tonightCtx({ words: [] }), { world: w, paintings, render: fakeRender, ui: screen({ answer: 'Yes, the same' }).ui });
  await t3.ask(ask2());
  await t3.tell(lines2);
  assert.deepEqual((await t3.remember({ things: [{ name: 'The night ferry', kind: 'thing', strokes: [2] }] })).kept, ['the night ferry (a third chapter)']);
  assert.deepEqual([w.entities.length, w.entities[0].id], [1, ferry]);
  // a no is not a yes
  const t4 = createTools(tonightCtx({ words: [] }), { world: w, paintings, render: fakeRender, ui: screen({ answer: 'No, something else' }).ui });
  await t4.ask(ask2());
  await t4.tell({ title: 'A Boat', lines: [{ text: 'Something else waited at the pier: a small boat.', strokes: [2] }, { text: 'The sea lay flat.', strokes: [1] }] });
  assert.deepEqual((await t4.remember({ things: [{ name: 'the small boat', kind: 'thing', strokes: [2] }] })).kept, ['the small boat (new)']);
  // the marks shown beside, given as one number, or not as numbers at all: asked all the same
  await paintings.put(1, { image: 'data:image/jpeg;base64,AAAA', strokes: NIGHT_STROKES });
  const shown = [];
  const t5 = createTools(tonightCtx({ words: [] }), { world: w, paintings, render: fakeRender, ui: { ask: async (q) => { shown.push(q.beside); return { answer: 'Yes, the same' }; }, tell: async () => ({ reactions: [], words: [] }) } });
  for (const strokes of [2, '2', ['2', 'x', null], { n: 2 }, undefined]) await t5.ask({ ...ask2(), show: { night: 1, strokes } });
  assert.deepEqual(shown.map((b) => JSON.parse(Buffer.from(b.image.split(',')[1], 'base64')).lit), [[2], [2], [2], [], []]);
});

import { createGovernor } from '../src/quality.js';

test('on a slow TV the ink takes fewer wet steps, gives them back when it can, and ignores stalls', () => {
  const run = (g, fps, seconds, wet = true) => { const out = []; for (let t = 0; t < seconds; t += 1 / fps) { const q = g.frame(1 / fps, wet); if (q != null) out.push(q); } return out; };
  // a TV that keeps up never changes
  const quick = createGovernor();
  assert.deepEqual(run(quick, 60, 20), []);
  assert.equal(quick.level, 0);
  // one that can't: down a level after a moment of slow frames, then the next, and no further
  const slow = createGovernor();
  run(slow, 60, 2, false);
  assert.deepEqual(run(slow, 24, 2.5), [0.66]);
  assert.deepEqual(run(slow, 24, 10), [0.44]);
  assert.equal(slow.scale, 0.44);
  // quick again: after a while it tries the better level; slow there too, it waits longer next time
  assert.deepEqual(run(slow, 60, 11), []);
  assert.deepEqual(run(slow, 60, 2), [0.66]);
  assert.deepEqual(run(slow, 24, 3), [0.44]);
  assert.deepEqual(run(slow, 60, 13), []);
  assert.deepEqual(run(slow, 60, 12), [0.66]);
  // a TV that shows 25 frames a second, wet or dry, is not a slow one
  const pal = createGovernor();
  run(pal, 25, 3, false);
  assert.deepEqual(run(pal, 25, 20), []);
  // a stall, or nonsense, says nothing
  const stall = createGovernor();
  for (const dt of [2, 0.9, -1, 0, NaN, undefined]) assert.equal(stall.frame(dt), null);
  assert.equal(stall.level, 0);
});

import { loadFamily, saveFamily, addPainter, choose, freeSeals, worldKey, paintingsKey, describe, sealSvg, SEALS } from '../src/family.js';

test('a family shares the TV: each painter a seal and a dream world of their own, the first keeping a world from before', () => {
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), keys: () => [...m.keys()] }; };
  // a new TV: no one yet
  const tv = store();
  const fam = loadFamily(tv);
  assert.deepEqual(fam, { painters: [], last: null });
  const moon = addPainter(fam, { seal: 'moon', now: 1 });
  assert.deepEqual(moon, { id: 'p1', seal: 'moon', young: false, first: true, added: 1 });
  assert.equal(worldKey(moon), 'inkwash.world', 'the first painter keeps the storage a single painter used');
  assert.equal(paintingsKey(moon), '');
  assert.equal(addPainter(fam, { seal: 'moon' }), null, 'a seal is one painter\'s');
  const star = addPainter(fam, { seal: 'star', young: true, now: 2 });
  assert.deepEqual([star.id, star.young, star.first, worldKey(star), paintingsKey(star)], ['p2', true, false, 'inkwash.world.p2', 'p2']);
  assert.equal(fam.last, 'p2');
  assert.deepEqual(freeSeals(fam).map((s) => s.id), SEALS.map((s) => s.id).filter((id) => id !== 'moon' && id !== 'star'));
  assert.equal(choose(fam, 'p1').seal, 'moon');
  assert.equal(choose(fam, 'nobody').seal, 'moon', 'an unknown painter changes nothing');
  saveFamily(fam, tv);
  assert.deepEqual(loadFamily(tv), { painters: [moon, star], last: 'p1' });
  // their worlds are kept apart
  const a = loadWorld(tv, worldKey(moon)), b = loadWorld(tv, worldKey(star));
  a.commit({ telling: { title: 'Shore', lines: [{ text: 'The pier.', strokes: [1] }] }, strokes: [{ n: 1, box: [0, 0, 10, 10] }], reactions: ['yes'], diff: { entities: [{ new: 'the pier', kind: 'place', lines: [1] }] } });
  saveWorld(a, tv, worldKey(moon)); saveWorld(b, tv, worldKey(star));
  assert.deepEqual([loadWorld(tv, worldKey(moon)).nights.length, loadWorld(tv, worldKey(star)).nights.length], [1, 0]);
  assert.equal(welcomeOf(loadWorld(tv, worldKey(star)), { name: 'Star' }), 'Hello, Star.');
  assert.match(welcomeOf(loadWorld(tv, worldKey(moon)), { name: 'Moon' }), /^Welcome back, Moon\. This is chapter 2 of your world\./);
  assert.deepEqual([describe(moon, 1), describe(star, 0)], [{ name: 'Moon', about: '1 chapter' }, { name: 'Star', about: 'new · a child' }]);
  // a TV with a world from before there were painters: it is the first painter's, untouched
  const old = store();
  old.setItem('inkwash.world', tv.getItem('inkwash.world'));
  const before = old.getItem('inkwash.world');
  const fam2 = loadFamily(old);
  assert.deepEqual(fam2.painters.map((p) => [p.id, p.seal, p.first]), [['p1', 'moon', true]]);
  assert.equal(loadWorld(old, worldKey(fam2.painters[0])).nights.length, 1);
  assert.equal(old.getItem('inkwash.world'), before);
  // what was stored wrongly is left out
  const odd = store();
  odd.setItem('inkwash.family', JSON.stringify({ painters: [{ id: 'p1', seal: 'moon' }, { id: '../x', seal: 'star' }, { id: 'p3', seal: 'dragon' }, null], last: 'p9' }));
  assert.deepEqual(loadFamily(odd).painters.map((p) => p.id), ['p1']);
  assert.equal(loadFamily(odd).last, 'p1');
  odd.setItem('inkwash.family', JSON.stringify({ painters: [{ id: 'p1', seal: 'moon' }, { id: 'p1', seal: 'star' }, { id: 'p2', seal: 'moon' }, { id: 'p3', seal: 'star' }], last: 'p3' }));
  assert.deepEqual(loadFamily(odd).painters.map((p) => [p.id, p.seal]), [['p1', 'moon'], ['p3', 'star']], 'one painter to an id and to a seal');
  odd.setItem('inkwash.family', '{not json');
  assert.deepEqual(loadFamily(odd), { painters: [], last: null });
  // every seal draws
  for (const s of SEALS) assert.match(sealSvg(s.id), /^<svg viewBox="0 0 100 100"[^>]*>.+<\/svg>$/);
});

test('a new ending: the story carried on with what they painted, only the new lines told, and the night keeping the story so far and what happened next together', async () => {
  const w = createDreamWorld();
  const paintings = memoryPaintings();
  const ai = { agent: async ({ messages }) => standInAgent({ model: 'm', messages }) };
  // the night, told and kept: it ended heavy where the boat waited
  const sc1 = screen({ answer: 'the night ferry', reactions: (n) => Array(n).fill(null) });
  const c1 = tonightCtx({ words: [] });
  const t1 = createTools(c1, { world: w, paintings, render: fakeRender, ui: sc1.ui });
  const r1 = await runGuide({ ai, first: firstMessage(c1, { numbered: PIC, brief: briefFor(w, c1) }), tools: t1 });
  assert.equal(r1.kept.night, 1);
  const told = finalTelling(t1.tellings);
  // then they painted a lantern over the water, and marked it lighter
  const lantern = { n: 3, ink: 'light', from: [700, 300], to: [720, 330], box: [690, 290, 730, 340], length: 60, turn: 1.1, pressure: 0.4, pools: [], ms: 1800, gap: 2, still: 0 };
  const strokes = [...NIGHT_STROKES, lantern];
  const c2 = tonightCtx({ strokes, points: strokes.map((s) => [{ x: s.from[0], y: s.from[1] }, { x: s.to[0], y: s.to[1] }]), words: [], snapshot: 'data:image/jpeg;base64,TkVX', feeling: { byStroke: [0, -0.7, 0.6], arousal: [0, 0.6, -0.4] }, turn: null, ending: { night: 1, strokes: [3], told } });
  const first = firstMessage(c2, { numbered: PIC, brief: briefFor(w, c2) });
  const text = first.find((b) => b.type === 'text').text;
  assert.match(text, /^WHAT HAPPENS NEXT \(this was told a moment ago and kept as night 1\. Then they painted what happens next: strokes 3/m);
  assert.match(text, /Carry it on, with what they painted next\.$/);
  assert.equal(JSON.parse(/^TONIGHT\n(.+)$/m.exec(text)[1]).night, 1, 'the same night');
  const sc2 = screen({ answer: 'a lantern', reactions: (n) => Array(n).fill('yes') });
  const t2 = createTools(c2, { world: w, paintings, render: fakeRender, ui: sc2.ui });
  const r2 = await runGuide({ ai, first, tools: t2 });
  assert.equal(sc2.asked[0].question, 'What happens next?');
  assert.deepEqual(sc2.asked[0].strokes, [3]);
  assert.equal(sc2.told[0].ending, true);
  assert.deepEqual(sc2.told[0].lines, [{ text: 'Then a lantern was there.', strokes: [3] }], 'only what happens next is told: the story carries on');
  assert.deepEqual(t2.checks.map((c) => c.ok), [true], 'what they kept tonight is theirs: no send-back');
  assert.deepEqual(r2.kept.kept, ['a lantern (new)']);
  assert.equal(r2.kept.next, true);
  assert.equal(keptOf({ kept: r2.kept.kept, turnedDown: r2.kept.let_go, next: r2.kept.next }), 'New in your world from what happened next: a lantern.');
  assert.match(r2.kept.settled[0], /^the night ferry: /, 'what the night left open, settled by the ending');
  // the night keeps both, and the painting with its new ending
  assert.equal(w.nights.length, 1);
  assert.deepEqual(w.nights[0].ending.strokes, [3]);
  assert.deepEqual(w.nights[0].ending.felt, { v: 0.6, a: -0.4 });
  const so = told.lines.filter((l) => l.reaction !== 'no');
  assert.deepEqual(w.nights[0].ending.lines.map((l) => [l.text, l.ending]), [...so.map((l) => [l.text, false]), ['Then a lantern was there.', true]], 'the story so far, then what happened next, as one story');
  assert.equal(w.entities.find((e) => e.name === 'a lantern').endings[0].v, 0.6);
  assert.equal((await paintings.get(1)).image, 'data:image/jpeg;base64,TkVX');
  assert.equal((await paintings.get(1)).strokes.length, 3);
  assert.deepEqual(w.summary().open, []);
  assert.equal(w.summary().endings, 1);
  // and a later night's guide is told of it
  assert.deepEqual(briefFor(w, tonightCtx()).new_endings.map((x) => [x.night, x.new_ending.at(-1), x.things]), [[1, 'Then a lantern was there.', ['a lantern']]]);
  assert.equal(welcomeOf(w, { name: 'Moon' }), 'Welcome back, Moon. This is chapter 2 of your world. Last time, you drew what happened next.');
});

import DEMO from '../src/demo-family.js';
import { demoFamily } from '../src/family.js';
import { putWorld } from '../src/world.js';

test('the demo family: two painters and their earlier nights as the TV kept them, apart from the TV\'s own family, the nights moved to the days before today', () => {
  const fam = demoFamily(DEMO);
  assert.deepEqual(fam.painters.map((p) => [p.seal, p.young, p.demo, worldKey(p), paintingsKey(p)]), [['moon', false, true, 'inkwash.demo.world.p1', 'demo-p1'], ['star', true, true, 'inkwash.demo.world.p2', 'demo-p2']]);
  const m = new Map(), store = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  const now = Date.UTC(2026, 9, 20, 20);
  for (const p of fam.painters) putWorld(DEMO.worlds[p.id], worldKey(p), { storage: store, now });
  assert.equal(store.getItem('inkwash.world'), null, 'the TV\'s own world untouched');
  const moon = loadWorld(store, 'inkwash.demo.world.p1'), star = loadWorld(store, 'inkwash.demo.world.p2');
  assert.deepEqual(moon.nights.map((n) => n.title), ['The Low Shore', 'The Lantern', 'The Ferry Leaves']);
  assert.deepEqual(moon.nights.map((n) => (now - n.at) / 86400000), [6, 4, 2]);
  const s = moon.summary();
  assert.deepEqual([s.recurring[0].name, s.recurring[0].nights, s.endings, s.open], ['the night ferry', 3, 1, []], 'the bridge settled what the ferry left open');
  assert.match(welcomeOf(moon, { name: 'Moon' }), /^Welcome back, Moon\. This is chapter 4 of your world\. Last time, you drew what happened next\. The night ferry has come 3 times/);
  assert.deepEqual(star.nights.map((n) => n.title), ['The Rocket', 'The Moon Castle', 'Flying with the Dragon']);
  assert.deepEqual(star.entities.filter((e) => (e.endings || []).length).map((e) => e.name), ['the dragon friend'], 'painted in what happened next');
  assert.deepEqual(star.summary().recurring.map((r) => r.name), ['the rocket', 'the moon', 'the moon castle']);
  assert.equal(welcomeOf(star, { name: 'Star' }), 'Welcome back, Star. This is chapter 4 of your world. The rocket has come twice.');
  // each night has its painting, with every stroke told in it, its new ending too
  for (const p of fam.painters) {
    for (const n of loadWorld(store, worldKey(p)).nights) {
      const pic = DEMO.paintings[p.id][n.n];
      assert.match(pic.image, /^data:image\/jpeg;base64,/);
      assert.ok(pic.strokes.length >= Math.max(...n.lines.flatMap((l) => l.strokes), ...(n.ending ? n.ending.strokes : [])));
    }
  }
  // and the night around what was told, there to stand up when they step inside: Star's dragon (its
  // body, two wings, its head and a gold eye), the flight, the castle below, the moon and the stars
  const flying = DEMO.paintings[fam.painters.find((p) => p.seal === 'star').id][3];
  assert.deepEqual(flying.strokes.map((x) => x.ink), ['dense', 'light', 'light', 'dense', 'gold', 'light', 'dense', 'cinnabar', 'cinnabar', 'dense', 'gold', 'gold', 'gold', 'gold', 'gold']);
  // a painter added in the demo is the demo's too
  assert.equal(worldKey(addPainter(fam, { seal: 'wave' })), 'inkwash.demo.world.p3');
});

import { journalOf } from '../src/journal.js';
import { createAloud } from '../src/aloud.js';

test('a dream journal for the grown-ups: who keeps coming back, how it felt each night, and what came from what they painted next, in a child\'s words for a child', () => {
  const star = createDreamWorld(DEMO.worlds.p2);
  const j = journalOf(star, { young: true });
  assert.deepEqual([j.nights, j.endings], [3, 1]);
  assert.deepEqual(j.things.map((t) => t.name), ['the moon castle', 'the dragon friend', 'the rocket', 'the moon']);
  const dragon = j.things.find((t) => t.name === 'the dragon friend');
  assert.deepEqual([dragon.dreams.map((d) => d.night), dragon.ended], [[3], 2]);
  assert.equal(dragon.says, 'First drawn in what happened next, in chapter 2. Came back once since, very bright and very wild.');
  assert.equal(j.things.find((t) => t.name === 'the rocket').says, 'Very bright and very wild the first time. Very bright the last time.');
  assert.equal(journalOf(star).things.find((t) => t.name === 'the rocket').says, 'Very light and very stirred the first time. Very light the last time.', 'a grown-up\'s words for a grown-up');
  assert.deepEqual(j.recent.map((n) => [n.n, n.title, !!n.ending]), [[3, 'Flying with the Dragon', false], [2, 'The Moon Castle', true], [1, 'The Rocket', false]]);
  assert.equal(j.recent[1].ending.said, 'Then a dragon flew out of the castle, and it was your friend.');
  // a thing that got heavier, and one lighter each time
  const s = [{ n: 1, from: [100, 600], to: [700, 600], box: [100, 590, 700, 610], length: 600, turn: 0.2, ms: 3000, pools: [] }];
  const gate = (vs) => {
    const w = createDreamWorld();
    for (const [i, v] of vs.entries()) w.commit({ telling: { title: `N${i}`, lines: [{ text: 'The gate.', strokes: [1] }] }, strokes: s, feeling: { byStroke: [v], arousal: [0] }, diff: { entities: [i ? { id: 'e1', lines: [0] } : { new: 'the gate', kind: 'thing', lines: [0] }] }, reactions: ['yes'] });
    return w;
  };
  assert.equal(journalOf(gate([-0.1, -0.7])).things[0].says, 'Neither light nor heavy the first time. Heavier the last time.', 'never "Even the first night"');
  assert.equal(journalOf(gate([0.1, -0.1]), { young: true }).things[0].says, 'Neither bright nor dark the first time and the last.');
  assert.equal(journalOf(gate([0.8, 0.7])).things[0].says, 'Very light the first time and the last.', 'the same feeling said once');
  assert.equal(journalOf(gate([-0.5, -0.1, 0.4]), { young: true }).things[0].says, 'Darker the first time. Brighter each time since.');
  assert.deepEqual(journalOf(createDreamWorld()), { nights: 0, endings: 0, things: [], recent: [] });
  // in a dream, then in what they painted next that night, then in a dream again: first in the dream
  const twice = gate([-0.5]);
  twice.newEnding({ night: 1, telling: { title: 'N0', lines: [{ text: 'The gate.', strokes: [1] }, { text: 'The gate opened.', strokes: [2] }] }, strokes: [{ ...s[0], n: 2 }], diff: { entities: [{ id: 'e1', lines: [1] }] }, reactions: ['yes', 'yes'] });
  twice.commit({ telling: { title: 'N1', lines: [{ text: 'The gate.', strokes: [1] }] }, strokes: s, feeling: { byStroke: [0.4], arousal: [0] }, diff: { entities: [{ id: 'e1', lines: [0] }] }, reactions: ['yes'] });
  assert.equal(journalOf(twice).things[0].says, 'Heavier the first time. Lighter the last time. It was in what you drew next, in chapter 1.', 'a grown-up reads their own');
  assert.match(journalOf(twice, { young: true }).things[0].says, /It was in what they drew next, in chapter 1\.$/, 'a child\'s, read by the grown-ups who look after them');
});

test('the journal, once last time\'s story has been heard again', () => {
  const star = createDreamWorld(DEMO.worlds.p2);
  star.recapped({ night: 3, heard: 3, of: 3 });
  star.recapped({ night: 3, heard: 2, of: 3 });
  star.recapped({ night: 3, heard: 0 });
  const j = journalOf(star);
  assert.deepEqual(j.recent.map((n) => [n.n, n.heard]), [[3, 2], [2, 0], [1, 0]], 'heard twice; a "not tonight" is not counted');
  assert.equal(j.note, undefined, 'nothing about their sleep, or their doctor');
});

import { bookOf, spreadsOf } from '../src/book.js';

test('a picture book of their world: a night to a spread, the first first, each story as it was last told, with what they painted next and how it felt', () => {
  const star = createDreamWorld(DEMO.worlds.p2);
  const b = bookOf(star, { young: true });
  assert.equal(b.total, 3);
  assert.deepEqual(b.nights.map((n) => [n.n, n.title, n.next]), [[1, 'The Rocket', false], [2, 'The Moon Castle', true], [3, 'Flying with the Dragon', false]]);
  // the second night told with what they painted next: its last line is what happened next
  assert.deepEqual(b.nights[1].lines.at(-1), { text: 'Then a dragon flew out of the castle, and it was your friend.', next: true });
  assert.deepEqual(b.nights[1].things, ['the rocket', 'the moon', 'the moon castle', 'the dragon friend']);
  // how each night felt, from the marks they made as it came back, in a child's words
  assert.deepEqual(b.nights.map((n) => n.felt), ['very bright and very wild', 'very bright', 'very bright and very wild']);
  // what keeps coming back, in a child's words, and how many nights each came
  assert.deepEqual(b.things.map((t) => [t.name, t.nights]), [['the moon castle', 2], ['the dragon friend', 2], ['the rocket', 2], ['the moon', 2]]);
  assert.equal(b.things[1].says, 'First drawn in what happened next, in chapter 2. Came back once since, very bright and very wild.');
  assert.deepEqual(spreadsOf(b).map((s) => (s.cover ? 'cover' : s.night.n)), ['cover', 1, 2, 3]);
  // a line they turned down is not in the book
  const s = [{ n: 1, from: [100, 600], to: [700, 600], box: [100, 590, 700, 610], length: 600, turn: 0.2, ms: 3000, pools: [] }];
  const w = createDreamWorld();
  w.commit({ telling: { title: 'The Gate', lines: [{ text: 'A gate in the hedge.', strokes: [1] }, { text: 'It was locked.', strokes: [1] }] }, strokes: s, diff: { entities: [{ new: 'the gate', kind: 'thing', lines: [0] }] }, reactions: ['yes', 'no'] });
  assert.deepEqual(bookOf(w).nights[0].lines, [{ text: 'A gate in the hedge.', next: false }]);
  // unmarked, it says nothing of how it felt; their own word for it, or their marks, it says
  assert.equal(bookOf(w).nights[0].felt, null);
  const told = { telling: { title: 'The Gate', lines: [{ text: 'A gate in the hedge.', strokes: [1] }] }, strokes: s, reactions: ['yes'] };
  const said = createDreamWorld(), marked = createDreamWorld();
  said.commit({ ...told, felt: 'longing' });
  marked.commit({ ...told, feeling: { byStroke: [-0.8], arousal: [0.75] } });
  assert.equal(bookOf(said).nights[0].felt, 'longing');
  assert.equal(bookOf(marked).nights[0].felt, 'very heavy and very stirred');
  // a world with nothing in it yet: only the title spread
  assert.deepEqual(spreadsOf(bookOf(createDreamWorld())), [{ cover: true }]);
});

test('read aloud for a child: each phrase fetched once and kept, cut off when they move on, the browser\'s voice without a service', async () => {
  const asked = [], played = [];
  let release;
  const audio = { src: '', play: async () => { played.push(audio.src.slice(-8)); }, pause: () => {} };
  const speak = ({ text }) => { asked.push(text); return text === 'slow' ? new Promise((ok) => { release = () => ok({ audio: 'U0xPVw==' }); }) : Promise.resolve({ audio: Buffer.from(text).toString('base64') }); };
  const a = createAloud({ speak, audio, synth: null });
  assert.equal(await a.say('a boat'), true);
  assert.equal(await a.say('a boat'), true);
  assert.deepEqual(asked, ['a boat'], 'fetched once, kept');
  const late = a.say('slow');
  assert.equal(await a.say('a cloud'), true, 'they moved on');
  release();
  assert.equal(await late, false, 'what they moved on from is not played when it arrives');
  assert.equal(played.length, 3);
  assert.equal(await a.say('   '), false);
  // no service: the browser's own voice
  const spoken = [];
  const b = createAloud({ speak: null, synth: { speak: (u) => spoken.push(u.text), cancel: () => {} }, Utterance: function U(t) { this.text = t; } });
  assert.equal(await b.say('What was this?'), true);
  assert.deepEqual(spoken, ['What was this?']);
  // neither: quiet
  assert.equal(await createAloud({ speak: null, synth: null }).say('hello'), false);
});

test('a child\'s telling, held gentle on the TV: something frightening they never brought, or what they marked darker made bigger, is sent back and never heard', async () => {
  const w = createDreamWorld();
  const sc = screen({ answer: 'a boat' });
  // stroke 2 they marked darker
  const t = createTools(tonightCtx({ words: [], young: true }), { world: w, paintings: memoryPaintings(), render: fakeRender, ui: sc.ui });
  await t.ask({ question: 'What was this?', choices: ['a boat', 'a cloud'], strokes: [2] });
  await assert.rejects(t.tell({ title: 'The Boat', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'A boat came, bigger and bigger, with claws.', strokes: [2] }] }), /^Error: Sent back, not told\. Line 2 brings in "claws", which they never brought\..* Line 2 makes what they marked darker "bigger"\./);
  assert.equal(sc.told.length, 0, 'never on the screen');
  await t.tell({ title: 'The Boat', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'A boat waited, small and still.', strokes: [2] }] });
  assert.equal(sc.told.length, 1);
  assert.deepEqual(t.checks.map((x) => [x.ok, x.blocking]), [[false, ['frightening', 'made_bigger']], [true, []]]);
  assert.deepEqual(sc.working, ['Finding gentler words'], 'the screen says what the guide is doing');
  // sent back once, and told again as badly: what a child must never hear is held back from it
  const sc2 = screen({ answer: 'a boat' });
  const t2 = createTools(tonightCtx({ words: [], young: true }), { world: createDreamWorld(), paintings: memoryPaintings(), render: fakeRender, ui: sc2.ui });
  await t2.ask({ question: 'What was this?', choices: ['a boat', 'a cloud'], strokes: [2] });
  const bad = { title: 'The Boat', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'A boat came closer, with claws.', strokes: [2] }, { text: 'Then a boat was there, small and still.', strokes: [2] }] };
  await assert.rejects(t2.tell(bad), /^Error: Sent back/);
  const r = await t2.tell(bad);
  assert.deepEqual(sc2.told[0].lines.map((l) => l.text), ['A long flat sea.', 'Then a boat was there, small and still.']);
  assert.deepEqual(r.held_back, [{ your_line: 2, why: 'it brought in something frightening they never brought' }]);
  assert.deepEqual(r.reactions.map((x) => [x.line, x.text]), [[1, 'A long flat sea.'], [2, 'Then a boat was there, small and still.']], 'numbered as told, with their text');
  assert.deepEqual(t2.checks.map((x) => [!!x.sent_back, x.held || []]), [[true, []], [false, ['frightening']]]);
  assert.deepEqual(finalTelling(t2.tellings).lines.map((l) => l.text), ['A long flat sea.', 'Then a boat was there, small and still.'], 'and only what was told is kept');
  // a grown-up's telling isn't held to a child's
  const g = createTools(tonightCtx({ words: [] }), { world: createDreamWorld(), paintings: memoryPaintings(), render: fakeRender, ui: screen({ answer: 'a boat' }).ui });
  await g.ask({ question: 'What was this?', choices: ['a boat'], strokes: [2] });
  await g.tell({ title: 'The Boat', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'A boat came, bigger and bigger, with claws.', strokes: [2] }] });
  assert.deepEqual(g.checks.map((x) => x.ok), [true]);
});

test('a dream told with what they painted next always ends on it: a telling that slides back is sent back, then told without what slid back; one that never tells it ends in their words', async () => {
  const told = { title: 'The Low Shore', lines: [{ text: 'A long flat sea.', strokes: [1], reaction: 'yes' }, { text: 'The boat waited, out of reach.', strokes: [2], reaction: null }] };
  const lantern = { n: 3, ink: 'light', from: [700, 300], to: [720, 330], box: [690, 290, 730, 340], length: 60, turn: 1.1, pressure: 0.4, pools: [], ms: 1800, gap: 2, still: 0 };
  const strokes = [...NIGHT_STROKES, lantern];
  const ending = (words = []) => tonightCtx({ strokes, points: strokes.map((s) => [{ x: s.from[0], y: s.from[1] }, { x: s.to[0], y: s.to[1] }]), words, feeling: { byStroke: [0, -0.7, 0.6], arousal: [0, 0.6, -0.4] }, turn: null, ending: { night: 1, strokes: [3], told } });
  const sc = screen({ answer: 'a lantern' });
  const t = createTools(ending(), { world: createDreamWorld(), paintings: memoryPaintings(), render: fakeRender, ui: sc.ui });
  await t.ask({ question: 'What happens next?', choices: ['a lantern', 'a bridge'], strokes: [3] });
  // the story so far told again is told already: carried on, not retold
  const slides = { title: 'The Low Shore', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'Then a lantern was there.', strokes: [3] }, { text: 'The boat turned back to the shore.', strokes: [2] }] };
  await assert.rejects(t.tell(slides), /End with what they painted next/);
  assert.deepEqual(sc.working, ['Keeping to what you painted next']);
  const r = await t.tell(slides);
  assert.deepEqual(sc.told[0].lines.map((l) => l.text), ['Then a lantern was there.'], 'it carries on, and ends on the ending');
  assert.deepEqual(r.held_back, [{ your_line: 3, why: 'it went back to the story as it was, after what they painted next began' }]);
  assert.match(r.already_told, /^Your line 1 was the story so far, told already/);
  // never told at all: it ends in their own words for it, what they said as they painted it
  const sc2 = screen({ answer: null });
  const t2 = createTools(ending([{ n: 3, text: 'a lantern came on over the water' }]), { world: createDreamWorld(), paintings: memoryPaintings(), render: fakeRender, ui: sc2.ui });
  const none = { title: 'The Low Shore', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'The boat waited, out of reach.', strokes: [2] }] };
  await assert.rejects(t2.tell(none), /No line tells what they painted next \(stroke 3\)/);
  const r2 = await t2.tell(none);
  assert.deepEqual(sc2.told[0].lines, [{ text: 'Then a lantern came on over the water.', strokes: [3] }]);
  assert.match(r2.ended_with, /^No line told what they painted next, so it ended in their words: Then a lantern came on over the water\.$/);
  assert.deepEqual(t2.checks.map((x) => x.added || null), [null, 'Then a lantern came on over the water.']);
});

// ---------------------------------------------------------------- the new look: alive, filmed, collected

test('ink as light, the way it is drawn into their world: no ink is no light, black ink a warm near-white, a coloured ink its own colour, bright', async () => {
  const { lightOf } = await import('../src/cutout.js');
  const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
  // where nothing stops the light, nothing is drawn
  assert.equal(lightOf(1, 1, 1)[3], 0);
  // dense black ink: all the light, a near-white (a neutral black a warm one)
  const black = lightOf(0.02, 0.02, 0.03);
  assert.ok(black[3] > 0.99 && black.slice(0, 3).every((c) => c > 0.9), JSON.stringify(black));
  const neutral = lightOf(0.02, 0.02, 0.02);
  assert.ok(near(neutral[0], 1) && neutral[0] > neutral[1] && neutral[1] > neutral[2], JSON.stringify(neutral));
  // grey (light) ink: the same white, fainter
  const grey = lightOf(0.6, 0.6, 0.62);
  assert.ok(grey[3] > 0.3 && grey[3] < 0.6 && grey[0] > 0.9 && grey[2] > 0.9, JSON.stringify(grey));
  // gold lets red and green through: it glows gold, not a dull brown or its inverse blue
  const gold = lightOf(0.85, 0.6, 0.12);
  assert.ok(gold[0] > 0.95 && gold[1] > 0.6 && gold[2] < 0.3 && gold[3] > 0.9, JSON.stringify(gold));
  // indigo: blue
  const indigo = lightOf(0.13, 0.23, 0.52);
  assert.ok(indigo[2] > 0.95 && indigo[0] < 0.4 && indigo[2] > indigo[1] && indigo[1] > indigo[0], JSON.stringify(indigo));
});

test('the telling, alive: each part of the painting moves by its shape, eases in and settles back exactly', async () => {
  const { motionOf, poseOf, reachOf, turnOf } = await import('../src/cutout.js');
  const tall = { n: 1, box: [698, 396, 700, 850], from: [700, 850], to: [698, 396], length: 455, turn: 0.2, pools: [] };
  const round = { n: 2, box: [1172, 166, 1297, 292], from: [1240, 170], to: [1236, 168], length: 402, turn: 6.3, pools: [] };
  const winding = { n: 3, box: [613, 187, 1240, 330], from: [1240, 330], to: [613, 256], length: 808, turn: 7.5, pools: [] };
  const shore = { n: 4, box: [170, 597, 1012, 600], from: [170, 600], to: [1012, 597], length: 842, turn: 0.2, pools: [] };
  const dab = { n: 5, box: [400, 400, 420, 410], from: [400, 400], to: [420, 410], length: 22, turn: 0, pools: [] };
  assert.equal(motionOf([tall]), 'rise', 'a rocket rises');
  assert.equal(motionOf([round]), 'glow', 'a moon glows');
  assert.equal(motionOf([winding]), 'swim', 'a dragon swims');
  assert.equal(motionOf([shore]), 'drift', 'a shore drifts');
  assert.equal(motionOf([dab]), 'twinkle', 'a star twinkles');
  assert.equal(motionOf([{ ...dab, pools: [[410, 405]] }]), 'breathe', 'a pool of ink breathes');
  assert.equal(motionOf([shore, tall]), 'drift', 'a line of several strokes moves as its longest does');
  // still at k = 0, whatever the time: the painting as they painted it
  for (const m of ['rise', 'glow', 'swim', 'drift', 'twinkle', 'settle', 'breathe']) {
    for (const t of [0, 0.7, 2.3]) {
      const q = poseOf(m, t, 0, { size: [300, 200] });
      assert.deepEqual([q.dx, q.dy, q.rot, q.skew, q.scale, q.glow].map((v) => Math.abs(v) < 1e-9 ? 0 : v), [0, 0, 0, 0, 1, 0], `${m} at rest`);
    }
  }
  const up = Math.min(...Array.from({ length: 40 }, (_, i) => poseOf('rise', i * 0.1, 1, { size: [20, 450] }).dy));
  assert.ok(up < -15 && up >= -22.5, `a tall stroke rises, a little: ${up}`);
  assert.ok(Math.max(...Array.from({ length: 30 }, (_, i) => Math.abs(poseOf('swim', i * 0.1).skew))) > 3, 'a swimming part leans one way and the other');
  assert.ok(poseOf('glow', 1, 1).glow > 0, 'what glows, glows');
  // what is cut: everything within reach of the paths, kept on the sheet
  assert.deepEqual(reachOf([{ ink: 'dense', path: [[10, 500], [300, 520]] }]), [0, 470, 330, 550]);
  assert.deepEqual(reachOf([{ ink: 'gold', path: [[800, 500]] }, { ink: 'light', path: [[1590, 990]] }]), [774, 474, 1600, 1000]);
  assert.equal(reachOf([{ ink: 'dense', path: [] }]), null);
  assert.equal(turnOf([[0, 0], [10, 0], [20, 0]]), 0);
  assert.equal(turnOf([[0, 0], [10, 0], [10, 10], [0, 10]]), 3.1);
});

test('the camera: in on each line\'s part of the painting, above the telling\'s panel, the paper filling the frame', async () => {
  const { shotOf, wideShot, onStage, FRAME, SHEET } = await import('../src/camera.js');
  const wide = shotOf(null);
  assert.deepEqual(wide, wideShot());
  assert.equal(wide.s, 0.86);
  assert.ok(Math.abs(onStage(wide, [800, 0])[0] - 960) < 1, 'the whole painting, centred');
  for (const box of [[1210, 188, 1335, 314], [698, 396, 700, 850], [613, 187, 1240, 330], [130, 866, 1409, 880], [1380, 579, 1382, 880]]) {
    const shot = shotOf(box);
    assert.ok(shot.s >= 0.86 && shot.s <= 1.6, `zoom within bounds: ${shot.s}`);
    const [cx, cy] = onStage(shot, [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]);
    assert.ok(cx > FRAME[0] && cx < FRAME[2] && cy > FRAME[1] && cy < FRAME[3], `the part sits in the frame above the panel: ${box} at ${Math.round(cx)}, ${Math.round(cy)}`);
    const left = SHEET.x + shot.tx, top = SHEET.y + shot.ty, W = shot.s * SHEET.w;
    // close in, the paper fills the frame; drawn back, it floats in the middle of it
    if (W >= FRAME[2] - FRAME[0]) assert.ok(left <= FRAME[0] + 0.5 && left + W >= FRAME[2] - 0.5, 'no night inside the frame, left or right');
    else assert.ok(Math.abs(left + W / 2 - (FRAME[0] + FRAME[2]) / 2) < 1, 'drawn back, centred');
    assert.ok(top <= FRAME[1] + 0.5 && top + shot.s * SHEET.h >= FRAME[3] - 0.5, 'no night above or below');
  }
  assert.equal(shotOf([1210, 188, 1335, 314]).s, 1.6, 'a small moon: as close as it goes');
  assert.equal(shotOf([1210, 188, 1335, 314], { most: 1.3 }).s, 1.3, 'a kept painting is a smaller picture: less close');
});

test('their world as cards and a map: each thing where it first came, its picture from that night, joined to what came with it', async () => {
  const { cardsOf, cardLine, mapOf } = await import('../src/cards.js');
  const DEMO = (await import('../src/demo-family.js')).default;
  const star = DEMO.worlds.p2;
  const cards = cardsOf(star, { young: true });
  assert.deepEqual(cards.map((c) => c.name), ['the rocket', 'the moon', 'the moon castle', 'the dragon friend'], 'in the order they first came');
  const dragon = cards.find((c) => c.name === 'the dragon friend');
  assert.equal(dragon.first, 2);
  assert.equal(dragon.bornNext, true, 'the dragon friend was first painted in what happened next');
  assert.equal(cardLine(dragon), 'Drawn in what happened next, in chapter 2. Came back once.');
  assert.equal(cardLine(cards[0]), 'First came in chapter 1. Came back once.');
  const { cardOrigin } = await import('../src/cards.js');
  assert.ok(cards.every((c) => ['named', 'kept', 'thought'].includes(c.origin)), JSON.stringify(cards.map((c) => c.origin)));
  assert.equal(cardOrigin({ origin: 'named' }), 'You named it.');
  assert.equal(cardOrigin({ origin: 'thought' }), 'The storyteller thought so.');
  assert.ok(cards.every((c) => c.box && c.strokes.length), 'each has its marks, to cut its picture from');
  assert.ok(cards.every((c) => !/heav|light|stirred/.test(c.felt || '')), `a child's cards in a child's words: ${cards.map((c) => c.felt)}`);
  const map = mapOf(star);
  assert.equal(map.nodes.length, 4);
  for (const a of map.nodes) {
    assert.ok(a.x - a.r >= 0 && a.x + a.r <= map.W && a.y >= 0 && a.y <= map.H, `${a.name} on the sheet`);
    for (const b of map.nodes) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - 1, `${a.name} and ${b.name} apart`);
  }
  const moon = map.nodes.find((n) => n.name === 'the moon'), rocket = map.nodes.find((n) => n.name === 'the rocket');
  assert.ok(moon.x > rocket.x && moon.y < rocket.y, 'the moon up and to the right of the rocket, as Star painted them');
  assert.ok(moon.r > rocket.r, 'a place is drawn bigger than a thing');
  const rocketMoon = map.paths.find((p) => [p.a, p.b].sort().join() === [rocket.id, moon.id].sort().join());
  assert.deepEqual(rocketMoon.nights, [1, 2], 'the rocket and the moon came together on nights 1 and 2');
  assert.deepEqual(mapOf({ entities: [], nights: [] }).nodes, []);
});

// ---------------------------------------------------------------- a long memory, kept safe

import { keepWorld, loadApart, apartKeys, roomOf, roomSays, ROOM, FEW } from '../src/world.js';
import { memoryNights, memoryWorlds } from '../src/paintings.js';

// a localStorage that holds `quota` characters, keys and values together, as Chromium's does
function roomyStorage(quota = Infinity, from = null) {
  const m = new Map(from ? from.map : []);
  const used = () => [...m].reduce((a, [k, v]) => a + k.length + v.length, 0);
  return {
    map: m,
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      v = String(v);
      if (used() - (m.has(k) ? k.length + m.get(k).length : 0) + k.length + v.length > quota) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, v);
    },
    removeItem: (k) => { m.delete(k); },
  };
}
// a world of `nights` nights, each bringing something new
function worldOf(nights) {
  const w = createDreamWorld();
  for (let k = 1; k <= nights; k++) {
    w.commit({
      telling: { title: `Night ${k}`, lines: [{ text: `The lantern ${k} was lit on the water.`, strokes: [1] }, { text: 'The tide came in.', strokes: [2] }] },
      strokes: NIGHT, words: [{ n: 1, text: `lantern ${k}` }],
      diff: { entities: [{ new: `the lantern ${k}`, kind: 'thing', lines: [0], strokes: [1] }] }, reactions: ['yes', 'yes'],
    });
  }
  return w;
}

test('every night kept: the latest go with the paintings as they are kept, and a TV short of room moves the older ones there first', async () => {
  // room to spare: kept here, and its latest nights with the paintings too
  const roomy = roomyStorage(), archive = memoryNights();
  const w = worldOf(6);
  const r = await keepWorld(w, 'inkwash.world.p9', { storage: roomy, archive, few: 3 });
  assert.equal(r.kept, 'here');
  assert.ok(r.room.share > 0 && r.room.share < 0.1, JSON.stringify(r.room));
  assert.deepEqual((await archive.all()).map((n) => n.n), [4, 5, 6], 'the latest, which change as they are heard again');
  assert.equal(loadWorld(roomy, 'inkwash.world.p9').nights.length, 6, 'nothing let go while there is room');
  // nearly full: the world holds its last few nights, once the rest are kept apart; the count goes on
  const size = roomy.getItem('inkwash.world.p9').length;
  const near = await keepWorld(w, 'inkwash.world.p9', { storage: roomy, archive, few: 3, quota: size * 1.1 });
  assert.equal(near.kept, 'here');
  assert.deepEqual(w.nights.map((n) => n.n), [4, 5, 6]);
  assert.deepEqual((await archive.all()).map((n) => n.n), [1, 2, 3, 4, 5, 6], 'every night is kept apart before the world lets it go');
  const back = loadWorld(roomy, 'inkwash.world.p9');
  assert.deepEqual([back.nights.length, back.tonight(), back.summary().nights], [3, 7, 6]);
  assert.match(welcomeOf(back), /^Welcome back\. This is chapter 7 of your world\./);
  assert.ok(roomy.getItem('inkwash.world.p9').length < size, 'smaller where room is short');
  // a store that won't keep the nights apart: the world keeps them all
  const failing = { putMany: async () => { throw new Error('no room'); }, all: async () => [] };
  const w2 = worldOf(5);
  await keepWorld(w2, 'inkwash.world.p8', { storage: roomyStorage(), archive: failing, few: 2, quota: 1 });
  assert.equal(w2.nights.length, 5, 'no night is let go until it is kept apart');
});

test('a world too big for localStorage is kept in IndexedDB, read from there, and back once there is room; the later copy always wins', async () => {
  const key = 'inkwash.world.p7';
  const w = worldOf(2);
  // room for the world as it was, then not for what it grew
  const tight = roomyStorage(Infinity);
  assert.ok(saveWorld(w, tight, key));
  const worlds = memoryWorlds(), archive = memoryNights();
  const small = tight.getItem(key).length + key.length + 40;
  const full = roomyStorage(small, tight);
  w.commit({ telling: { title: 'Night 3', lines: [{ text: 'The lantern came back.', strokes: [1] }, { text: 'The tide came in.', strokes: [2] }] }, strokes: NIGHT, reactions: ['yes', 'yes'] });
  const r = await keepWorld(w, key, { storage: full, archive, worlds });
  assert.equal(r.kept, 'apart', 'kept in the larger store');
  assert.deepEqual(apartKeys(full), [key]);
  assert.equal(JSON.parse(full.getItem(key)).nights.length, 2, 'localStorage still has it as it was');
  assert.equal(loadWorld(full, key).nights.length, 3, 'and it is read from the larger store');
  assert.deepEqual(roomSays({ room: r.room, apart: apartKeys(full).length }), { alarm: false, text: 'The TV’s quick memory for worlds is full, so one world is kept in its larger store instead. Nothing is lost.' });
  // the TV is turned off and on: the copy in IndexedDB is the later one, so it is read
  const restarted = roomyStorage(small, full);
  assert.deepEqual(await loadApart(worlds, restarted), [key]);
  assert.equal(loadWorld(restarted, key).nights.length, 3);
  // room made: back in localStorage, and the copy kept apart let go
  const roomy = roomyStorage(Infinity, restarted);
  await loadApart(worlds, roomy);
  const back = loadWorld(roomy, key);
  assert.equal((await keepWorld(back, key, { storage: roomy, archive, worlds })).kept, 'here');
  assert.deepEqual(apartKeys(roomy), []);
  assert.equal(worlds.size(), 0);
  assert.equal(JSON.parse(roomy.getItem(key)).nights.length, 3);
  // a copy in IndexedDB older than the one in localStorage is let go when the TV starts
  await worlds.put(key, `{"kept":1,${JSON.stringify(worldOf(1).toJSON()).slice(1)}`);
  assert.deepEqual(await loadApart(worlds, roomyStorage(Infinity, roomy)), []);
  assert.equal(worlds.size(), 0);
});

test('when neither store will take a world, the TV says so, and what it says when it is only filling up', async () => {
  const key = 'inkwash.world.p6';
  const nowhere = { all: async () => [], put: async () => { throw new Error('the disk is full'); }, drop: async () => {} };
  const r = await keepWorld(worldOf(2), key, { storage: roomyStorage(10), archive: memoryNights(), worlds: nowhere });
  assert.equal(r.kept, null, 'not kept, and not said to be');
  assert.deepEqual(roomSays({ unkept: true }), { alarm: true, text: 'This TV is out of room, so the last drawing isn’t kept yet. Free up some space on the TV: Inkwash keeps trying while it is open.' });
  assert.deepEqual(roomSays({ disk: 0.91 }), { alarm: true, text: 'This TV is nearly out of room (91% full). Free up some space on it, so everything can be kept.' });
  assert.deepEqual(roomSays({ room: { share: 0.834 } }), { alarm: false, text: 'The TV’s quick memory for worlds is 83% full. As it fills, older chapters move to its larger store, so nothing is lost.' });
  assert.equal(roomSays({ room: { share: 0.5 }, disk: 0.4 }), null, 'room to spare: nothing said');
  assert.equal(roomSays({ apart: 2 }).text, 'The TV’s quick memory for worlds is full, so 2 worlds are kept in its larger store instead. Nothing is lost.');
  // how full localStorage is: keys and values, against about five million characters
  const s = roomyStorage();
  s.setItem('ab', 'x'.repeat(998));
  assert.deepEqual(roomOf(s, 1000), { used: 1000, quota: 1000, share: 1 });
  assert.equal(roomOf(s).quota, ROOM);
  assert.equal(roomOf(null), null);
  assert.equal(FEW, 30);
});

test('the guide reads the nights a world has let go where every night is kept: told back as they were', async () => {
  const w = createDreamWorld();
  for (const title of ['The Pier', 'The Lighthouse']) {
    w.commit({
      telling: { title, lines: [{ text: `${title === 'The Pier' ? 'A long pier' : 'A lighthouse'} at the end of the sea.`, strokes: [1] }, { text: 'Something waited.', strokes: [2] }] },
      strokes: NIGHT_STROKES, words: [{ n: 1, text: title.toLowerCase() }], reactions: ['yes', 'yes'],
    });
  }
  const archive = memoryNights();
  await archive.putMany(w.nights);
  w.trimNights(1);
  const t = createTools(tonightCtx(), { world: w, paintings: memoryPaintings(), archive, render: fakeRender, ui: screen().ui });
  const one = await t.night({ night: 1 });
  assert.deepEqual([one.title, one.telling[0].text], ['The Pier', 'A long pier at the end of the sea.']);
  assert.equal((await t.recall({ query: 'pier' })).nights[0].night, 1, 'found by its words');
  assert.equal((await t.night({ night: 2 })).title, 'The Lighthouse');
  const forgetful = createTools(tonightCtx(), { world: w, paintings: memoryPaintings(), render: fakeRender, ui: screen().ui });
  await assert.rejects(forgetful.night({ night: 1 }), /no night 1/, 'without them, the world alone');
});

// ---------------------------------------------------------------- stepping inside

test('step inside: what stands up from the paper and where, how far away, and the walk', async () => {
  const { stageOf, lies, onGround, seen, onScreen, aimAt, walk, cssCamera, LIMIT, SPACE } = await import('../src/inside.js');
  const strokes = [
    { n: 1, ink: 'dense', box: [100, 590, 1500, 620], length: 1400, turn: 0.3, from: [100, 600], to: [1500, 610], pools: [] }, // a horizon
    { n: 2, ink: 'dense', box: [600, 380, 620, 860], length: 480, turn: 0.2, from: [610, 860], to: [610, 380], pools: [] }, // a rocket, standing tall
    { n: 3, ink: 'gold', box: [1200, 120, 1330, 250], length: 400, turn: 6.2, from: [1330, 185], to: [1325, 180], pools: [] }, // a gold moon, high up
    { n: 4, ink: 'water', box: [300, 700, 700, 900], length: 600, turn: 2, from: [300, 800], to: [700, 800], pools: [] }, // a wash
    { n: 5, ink: 'dense', box: [1000, 650, 1020, 660], length: 20, turn: 0, from: [1000, 655], to: [1020, 655], pools: [] }, // a dab
  ];
  const things = [{ id: 'e1', name: 'the rocket', strokes: [2], line: 'The rocket went up.' }, { id: 'e2', name: 'the sea', strokes: [1, 4] }];
  const s = stageOf(strokes, { things, lines: [{ text: 'The moon was gold.', strokes: [3] }] });
  assert.deepEqual(s.pieces.map((p) => [p.id, p.name, p.line]), [['e1', 'the rocket', 'The rocket went up.'], ['s3', null, 'The moon was gold.']], 'what they kept first, by name, then what else stands out, with its line');
  assert.deepEqual(s.ground, [1, 4, 5], 'the horizon and the wash stay painted on the ground, and so does a dab');
  assert.ok(lies(strokes[0]) && lies(strokes[3]) && !lies(strokes[1]));
  assert.deepEqual(s.pieces[0].foot, [610, 860], 'a thing stands at its foot');
  assert.ok(s.pieces[1].far > 0.7 && s.pieces[0].far < 0.2, 'higher up the page stands further away');
  assert.ok(s.pieces[1].float > 100 && s.pieces[0].float === 0, 'and the moon, painted near the top, is up in the air; the rocket stands on the ground');
  assert.deepEqual(s.pieces.map((p) => p.motion), ['rise', 'glow'], 'alive as in the telling');
  assert.equal(stageOf(strokes, { most: 1 }).pieces.length, 1);
  // the ground tipped back: its near edge stays put; its far edge goes back and up
  const near = onGround([800, 1000]), far = onGround([800, 0]);
  assert.ok(Math.abs(near.x) + Math.abs(near.y) + Math.abs(near.z) < 1e-9);
  assert.ok(far.z < -950 && far.y < -200 && far.y > -210, JSON.stringify(far));
  // going to a thing: the world turns on its middle to bring it round to the front, and comes near
  const side = onGround([1400, 500]), cam = aimAt(side);
  assert.ok(Math.abs(cam.yaw + 90) < 0.01, `a quarter turn for a thing beside the middle: ${JSON.stringify(cam)}`);
  const there = seen(side, cam);
  assert.ok(Math.abs(there.x) < 1 && Math.abs(there.z + SPACE.eye + 220) < 1, JSON.stringify(there));
  assert.equal(aimAt(onGround([800, 900])).yaw, 0, 'one already at the front: no turn');
  assert.ok(Math.abs(seen(onGround([800, 900]), aimAt(onGround([800, 900]), { tall: 430 })).z + SPACE.eye) < 1, 'a thing 430 pixels tall is brought to the screen, where it stands 430 pixels tall');
  // a small thing, close up, is framed in the middle of the stage: the world rises to meet the eye
  const small = onGround([700, 800]), up = aimAt(small, { tall: 120 });
  const mid = onScreen(seen({ ...small, y: small.y - 60 }, up));
  assert.ok(up.lift < -200 && Math.abs(mid[0] - 960) < 1 && Math.abs(mid[1] - 640) < 1, JSON.stringify({ up, mid }));
  // the walk: held ▶ turns the world, ▲ comes nearer; round and round, never too near or too far
  let w = walk({ yaw: 0, d: 0, lift: -40 }, new Set(['right']), 1);
  assert.deepEqual(w, { yaw: 36, d: 0, lift: -40 });
  w = walk(w, new Set(['right', 'up']), 5);
  assert.deepEqual(w, { yaw: -144, d: LIMIT.in, lift: -40 }, 'past half a turn it comes round the other side');
  assert.deepEqual(walk(w, ['down', 'left'], 5), { yaw: 36, d: LIMIT.back, lift: -40 }, 'half a turn back the other way');
  assert.equal(cssCamera({ yaw: 12.345, d: 100, lift: -40 }), 'translate3d(0, -40.0px, 100.0px) rotateY(12.35deg)');
});

import { placeWorld, horizonOf, lightAt, STAGE, PX, popOf, hopOf, POP, HOP } from '../src/night.js';

test('their world at night: each thing where it first came, spread over the water, the sky’s things in the air, none on top of another; each ink its own light', () => {
  // Star's world: the rocket and the castle on the ground, the moon and the dragon painted high up
  const nodes = [
    { id: 'rocket', x: 450, y: 700 }, { id: 'castle', x: 1180, y: 680 },
    { id: 'moon', x: 1260, y: 300 }, { id: 'dragon', x: 900, y: 260 },
  ];
  const heights = { rocket: 0.38, castle: 0.36, moon: 0.75, dragon: 0.76 };
  const sizes = { rocket: [60, 460], castle: [330, 470], moon: [130, 130], dragon: [640, 190] };
  const placed = placeWorld(nodes, { heights, sizes });
  const at = Object.fromEntries(placed.map((p) => [p.id, p]));
  assert.deepEqual(placed.map((p) => p.id), ['dragon', 'moon', 'castle', 'rocket'], 'far ones first, so near ones stand in front');
  assert.ok(at.rocket.foot[0] < at.dragon.foot[0] && at.dragon.foot[0] < at.moon.foot[0], 'left to right as on the map');
  assert.ok(at.rocket.k > at.moon.k && at.rocket.foot[1] > at.moon.foot[1], 'nearer is bigger and lower on the screen');
  assert.ok(placed.every((p) => p.foot[1] > STAGE.horizon && p.foot[0] > 0 && p.foot[0] < STAGE.W), 'on the water, on the stage');
  assert.ok(at.moon.rise > 100 && at.dragon.rise > 100 && at.rocket.rise === 0 && at.castle.rise === 0, `the sky's things in the air: ${JSON.stringify(placed)}`);
  // nothing's light covers another's on the screen
  const rect = (p) => { const [w, h] = sizes[p.id].map((v) => v * PX * p.k); return [p.foot[0] - w / 2, p.foot[1] - p.rise - h, p.foot[0] + w / 2, p.foot[1] - p.rise]; };
  for (const a of placed) for (const b of placed) {
    if (a === b) continue;
    const [A, B] = [rect(a), rect(b)];
    const overlap = Math.min(A[2], B[2]) - Math.max(A[0], B[0]) > 0 && Math.min(A[3], B[3]) - Math.max(A[1], B[1]) > 12;
    assert.ok(!overlap, `${a.id} and ${b.id} apart: ${JSON.stringify([A, B])}`);
  }
  // one thing alone stands in the middle; nothing, nothing
  assert.equal(placeWorld([{ id: 'a', x: 300, y: 300 }])[0].foot[0], STAGE.W / 2);
  assert.deepEqual(placeWorld([]), []);
  // the water begins just below the lowest stroke, but not for a wash, and within the paper
  assert.equal(horizonOf([{ ink: 'dense', box: [100, 300, 400, 702] }, { ink: 'water', box: [0, 800, 1600, 990] }]), 724);
  assert.equal(horizonOf([{ ink: 'dense', box: [100, 100, 400, 200] }]), 600);
  assert.equal(horizonOf([]), 700);
  // which light each ink gives: black and grey are moonlight, as strong as they were dark; the dream inks their own
  assert.equal(lightAt([0.98, 0.98, 0.98]), null, 'bare paper: nothing');
  const black = lightAt([0.1, 0.1, 0.12]), grey = lightAt([0.6, 0.6, 0.62]);
  assert.ok(black.light === 'moon' && grey.light === 'moon' && black.a > grey.a);
  assert.equal(lightAt([0.82, 0.66, 0.28]).light, 'gold');
  assert.equal(lightAt([0.3, 0.36, 0.7]).light, 'indigo');
  assert.equal(lightAt([0.75, 0.26, 0.2]).light, 'cinnabar');
});

import { worldOf as spotsOf, view, walk, standBefore, glide, nightsOf, boundsOf, turn, HOME, PACE } from '../src/walk.js';

test('walking through their world: it starts on the home view, walks and turns, stands before a thing eye to eye, and knows what was told of it', () => {
  const nodes = [{ id: 'rocket', x: 450, y: 700 }, { id: 'castle', x: 1180, y: 680 }, { id: 'moon', x: 1260, y: 300 }, { id: 'dragon', x: 900, y: 260 }];
  const heights = { rocket: 0.38, castle: 0.36, moon: 0.75, dragon: 0.76 };
  const sizes = { rocket: [60, 460], castle: [330, 470], moon: [130, 130], dragon: [640, 190] };
  const placed = placeWorld(nodes, { heights, sizes });
  const spots = spotsOf(placed), at = Object.fromEntries(spots.map((s) => [s.id, s]));
  // from the water's edge, each thing is exactly where the home view shows it
  for (const p of placed) {
    const s = at[p.id], v = view(HOME, [s.x, 0, s.z]);
    assert.ok(Math.abs(v[0] - p.foot[0]) < 0.5 && Math.abs(v[1] - p.foot[1]) < 0.5, `${p.id} where the home view has it: ${JSON.stringify([v, p.foot])}`);
  }
  assert.ok(at.moon.rise > 100 && at.rocket.rise === 0, 'the sky’s things in the air');
  assert.equal(view(HOME, [0, 0, -100]), null, 'behind the eye: not seen');
  // ▲ walks on the way it looks; ▶ turns to the right, and then ▲ walks that way; never beyond the world
  const bounds = boundsOf(spots);
  const on = walk(HOME, ['up'], 1, { bounds });
  assert.ok(on.z > 500 && Math.abs(on.x) < 1e-9 && on.h === HOME.h, JSON.stringify(on));
  const turned = walk(HOME, new Set(['right']), 1);
  assert.ok(turned.yaw > 0.9 && turned.x === 0 && turned.z === 0);
  const off = walk(turned, ['up'], 1);
  assert.ok(off.x > 400 && off.z > 0, 'walking to the right');
  let far = HOME;
  for (let i = 0; i < 200; i++) far = walk(far, ['up'], 1, { bounds });
  assert.equal(far.z, bounds.z1, 'the world has an edge');
  assert.ok(Math.abs(turn(3 * Math.PI) - Math.PI) < 1e-9 && Math.abs(turn(-0.5) + 0.5) < 1e-9);
  // OK: it goes to stand before the castle, which then stands in the middle of the screen, about as tall as it should
  const tall = 470 * PX, to = standBefore(HOME, at.castle, tall, { bounds });
  const foot = view(to, [at.castle.x, 0, at.castle.z]), top = view(to, [at.castle.x, tall, at.castle.z]);
  assert.ok(Math.abs(foot[0] - STAGE.W / 2) < 0.5, 'straight ahead');
  assert.ok(Math.abs(foot[1] - top[1] - PACE.fill) < 1 && Math.abs((foot[1] + top[1]) / 2 - PACE.middle) < 1, `as tall as it should be, in the middle: ${JSON.stringify([foot, top])}`);
  assert.equal(to.lift, 0, 'on the water: looking straight ahead');
  // something long and low (a pier) fits across the screen; and nothing is brought nearer than its light is sharp
  const away = (e, sp) => Math.hypot(e.x - sp.x, e.z - sp.z);
  assert.ok(Math.abs(away(standBefore(HOME, at.castle, 40, { wide: 1500 }), at.castle) - (1000 * 1500) / PACE.wide) < 1, 'the pier fits');
  assert.ok(Math.abs(away(standBefore(HOME, at.castle, 40, { detail: 0.5 }), at.castle) - 1000 / (0.5 * PACE.sharp)) < 1, 'as near as it stays sharp');
  assert.ok(standBefore(HOME, at.castle, 40).h >= PACE.low, 'never down at the water');
  // and the moon, up in the air: the eye looks up to it from below, all of it in the sky, over the horizon
  const moon = standBefore(HOME, at.moon, 130 * PX);
  const m = view(moon, [at.moon.x, at.moon.rise + 65 * PX, at.moon.z]), low = view(moon, [at.moon.x, at.moon.rise, at.moon.z]);
  assert.ok(moon.lift > 0 && moon.lift <= PACE.look && Math.abs(m[1] - PACE.sky) < 1, JSON.stringify(moon));
  assert.ok(low[1] < STAGE.horizon + moon.lift, `in the sky, above the horizon: ${JSON.stringify([low, moon])}`);
  // walking on from there, the eye comes back down to the water and looks ahead again
  let down = moon;
  for (let i = 0; i < 60; i++) down = walk(down, ['up'], 0.1);
  assert.ok(Math.abs(down.h - HOME.h) < 2 && down.lift < 1, JSON.stringify(down));
  // the glide gets there, the short way round
  let g = { eye: { ...HOME, yaw: 3 }, there: false }, steps = 0;
  while (!g.there && steps++ < 400) g = glide(g.eye, { ...to, yaw: -3 }, 0.08);
  assert.ok(g.there && steps < 400 && g.eye.yaw === -3, `arrived: ${steps}`);
  // what was told of the rocket, night by night, in the demo family
  const told = nightsOf(DEMO.worlds.p2, 'e1');
  assert.ok(told.length >= 2 && told[0].night === 1 && told.every((n) => n.lines.length >= 1), JSON.stringify(told));
  assert.ok(/rocket/i.test(told[0].lines.join(' ')), 'the lines about it');
  assert.deepEqual(nightsOf(DEMO.worlds.p2, 'nobody'), []);
});

test('the storyteller\'s closing line never says goodnight: they may be painting at any time of day', () => {
  assert.equal(closingOf('Sleep well, little builder. Eight more soldiers are still waiting to wake up.'), 'Eight more soldiers are still waiting to wake up.');
  assert.equal(closingOf('Goodnight!'), null);
  assert.equal(closingOf('The walking city is still out there, walking.'), 'The walking city is still out there, walking.');
  assert.equal(closingOf('Sweet dreams, Moon'), null);
});

import { regionOf, cutAway, solidOf, signOfThing } from '../src/things.js';

test('a thing made real on its own: the part of the paper it is painted over, and its white cut away', () => {
  // a tall thing: its box with a margin, no thinner than 4 to 1, each side 320 to 640, in sixteens
  const R = regionOf([700, 200, 800, 700]);
  assert.equal(Math.max(R.width, R.height), 640);
  assert.ok(R.width >= 320 && R.width % 16 === 0 && R.height % 16 === 0, JSON.stringify(R));
  const [x0, y0, x1, y1] = R.region;
  assert.ok(x0 < 700 && x1 > 800 && y0 < 200 && y1 > 700, 'all of it, with room round it');
  assert.ok(Math.abs((x0 + x1) / 2 - 750) < 0.01 && Math.abs((y0 + y1) / 2 - 450) < 0.01, 'centred on it');
  assert.ok(Math.abs((x1 - x0) * R.kpx - R.width) < 0.01 && Math.abs((y1 - y0) * R.kpx - R.height) < 0.01, 'its pixels a paper unit');
  // a long thin one is made no thinner than 4 to 1; a dot, no smaller than 320 a side
  const line = regionOf([100, 500, 1500, 510]);
  assert.ok(line.width / line.height <= 4.05, JSON.stringify(line));
  const dot = regionOf([800, 500, 806, 506]);
  assert.ok(dot.width >= 320 && dot.height >= 320, JSON.stringify(dot));

  // a red ball on white, with a white window in it, and a light fringe round it
  const W = 40, H = 40, data = new Uint8ClampedArray(W * H * 4).fill(255);
  const set = (x, y, rgb) => { const i = (y * W + x) * 4; data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - 20, y - 20);
    if (r < 10) set(x, y, Math.hypot(x - 20, y - 20) < 2 ? [255, 255, 255] : [200, 30, 30]);
    else if (r < 11) set(x, y, [235, 200, 200]);
  }
  const img = cutAway({ data, width: W, height: H });
  const a = (x, y) => img.data[(y * W + x) * 4 + 3];
  assert.equal(a(0, 0), 0, 'the paper round it is clear');
  assert.equal(a(20, 14), 255, 'the ball is kept');
  assert.equal(a(20, 20), 255, 'the white window in it stays: the edge of the picture cannot reach it');
  assert.ok(img.kept > 0.2 && img.kept < 0.3, `how much of it is the thing: ${img.kept}`);
  const fringe = [...Array(W).keys()].map((x) => a(x, 20)).find((v) => v > 0 && v < 255);
  assert.ok(fringe != null, 'its light edge is eased into the clear');
  // painted with a place round it: nothing is cut away
  const full = cutAway({ data: new Uint8ClampedArray(16 * 4).fill(90).map((v, i) => (i % 4 === 3 ? 255 : v)), width: 4, height: 4 });
  assert.equal(full.kept, 1);

  // it is made again only when what it is made from changes
  const s = { strokes: [{ n: 3, box: [700, 200, 800, 700] }], look: 'A red lighthouse.', place: 'A bright 3D game.' };
  assert.equal(signOfThing(s), signOfThing({ ...s }));
  assert.notEqual(signOfThing(s), signOfThing({ ...s, look: 'A blue lighthouse.' }));
  assert.notEqual(signOfThing(s), signOfThing({ ...s, place: 'Moonlit ink.' }));
  assert.notEqual(signOfThing(s), signOfThing({ ...s, strokes: [{ n: 4, box: [700, 200, 800, 700] }] }));
  // and when they say how it looks; a picture made before they had said anything keeps its sign
  assert.notEqual(signOfThing(s), signOfThing({ ...s, rule: 'The lighthouse has a green door.' }));
  assert.equal(signOfThing({ ...s, rule: null }), JSON.stringify([[[3, 700, 200]], 'A red lighthouse.', 'A bright 3D game.']));
  assert.equal(JSON.parse(signOfThing({ ...s, rule: 'The lighthouse has a green door.' }))[3], 'The lighthouse has a green door.');

  // cut out by Nova Canvas: how much of it is left, by how clear it is
  const cut = new Uint8ClampedArray(10 * 10 * 4);
  for (let i = 0; i < 30; i++) cut[i * 4 + 3] = 255;
  for (let i = 30; i < 35; i++) cut[i * 4 + 3] = 10; // all but clear: a trace left round its edge
  assert.equal(solidOf({ data: cut, width: 10, height: 10 }), 0.3);
  assert.equal(solidOf({ data: new Uint8ClampedArray(4 * 4).fill(255), width: 2, height: 2 }), 1, 'nothing cut away');
});

test('come to life: a thing springs up from a third of its size, a little over, a little under, and settles as itself', () => {
  assert.ok(Math.abs(popOf(0) - 0.3) < 1e-9);
  assert.equal(popOf(1), 1);
  assert.equal(popOf(3), 1, 'and stays itself');
  const peak = popOf(POP.peak);
  assert.ok(peak > 1.12 && peak < 1.18, `a little over, at its peak: ${peak}`);
  for (let n = 0; n < 10; n++) { const u = (POP.peak * n) / 10; assert.ok(popOf(u + POP.peak / 10) > popOf(u), 'it grows all the way up'); }
  const under = Math.min(...Array.from({ length: 30 }, (_, n) => popOf(0.45 + n * 0.01)));
  assert.ok(under < 0.99 && under > 0.95, `a little under: ${under}`);
  assert.ok(Math.abs(popOf(0.85) - 1) < 0.01, 'and itself again');
});

test('greeted, a thing hops: it crouches first, stretches as it leaves the ground and comes down, is round at the top, and lands squashed', () => {
  assert.deepEqual(hopOf(0), { lift: 0, sx: 1, sy: 1 });
  assert.deepEqual(hopOf(1), { lift: 0, sx: 1, sy: 1 });
  const crouch = hopOf(HOP.takeoff / 2);
  assert.ok(crouch.lift === 0 && crouch.sy < 0.9 && crouch.sx > 1.06, `the wind-up, squashed down: ${JSON.stringify(crouch)}`);
  const off = hopOf(HOP.takeoff + 0.06);
  assert.ok(off.lift > 0 && off.sy > 1.08, `leaving the ground, stretched: ${JSON.stringify(off)}`);
  const top = hopOf((HOP.takeoff + HOP.land) / 2);
  assert.ok(top.lift > 0.99 && Math.abs(top.sy - 1) < 0.01, `round at the top: ${JSON.stringify(top)}`);
  const land = hopOf((HOP.land + 1) / 2);
  assert.ok(land.lift === 0 && land.sy < 0.87 && land.sx > 1.1, `landing, squashed: ${JSON.stringify(land)}`);
  for (let n = 1; n < 40; n++) { const h = hopOf(n / 40); assert.ok(h.lift >= 0 && h.lift <= 1 && h.sx > 0.9 && h.sy > 0.85, JSON.stringify(h)); }
});

test('a look is said as what it is, never what it is not', async () => {
  const { lookSaid } = await import('../src/scene.js');
  assert.equal(lookSaid('a misty ink-wash seascape at golden dawn, soft and painted, never glossy'), 'a misty ink-wash seascape at golden dawn, soft and painted');
  assert.equal(lookSaid('A warm lamplit oil painting; no cartoon, not 3D.'), 'A warm lamplit oil painting');
  assert.equal(lookSaid('A moonlit ink-wash night'), 'A moonlit ink-wash night');
  assert.equal(lookSaid(''), '');
});

test('a new thing called someone is someone, not the someone', async () => {
  const { named } = await import('../src/harness.js');
  assert.equal(named('the someone'), 'someone');
  assert.equal(named('A something'), 'something');
  assert.equal(named('the night ferry'), 'the night ferry');
  assert.equal(named('my brother'), 'my brother');
  assert.equal(named('the somewhere tree'), 'the somewhere tree');
});

test('the camera takes in whatever is joined to a line\'s part, whole', async () => {
  const { framedBox, shotOf, onStage, FRAME } = await import('../src/camera.js');
  // the arms, the neck and head drawn from their middle, the gold loop off to the side, the waves below
  const arms = [400, 520, 1000, 700], head = [690, 385, 775, 525], sun = [1120, 238, 1240, 362], waves = [380, 750, 1060, 795];
  assert.deepEqual(framedBox(arms, [arms, head, sun, waves]), [400, 385, 1000, 700], 'the head comes in with the arms; the sun and the water stay out');
  const s = shotOf(framedBox(arms, [arms, head, sun, waves]), { most: 1.45 });
  const top = onStage(s, [0, 385])[1];
  assert.ok(top >= FRAME[1] - 1, `the head's top is in the frame: ${top}`);
  assert.equal(framedBox(null, [arms]), null);
});

test('forgetting on the TV: the world, the chapters kept apart, the drawings and the thing\'s picture', async () => {
  const { forgetHere, forgetSays } = await import('../src/forget.js');
  const { createDreamWorld } = await import('../src/engine/dreams/world.mjs');
  const { memoryPaintings, memoryNights } = await import('../src/paintings.js');
  const S1 = [
    { n: 1, from: [100, 600], to: [1500, 610], box: [100, 590, 1500, 620], length: 1400, turn: 0.3, ms: 4000, pools: [] },
    { n: 2, from: [260, 100], to: [261, 101], box: [200, 100, 320, 220], length: 380, turn: 6.2, ms: 3000, pools: [] },
  ];
  const w = createDreamWorld();
  w.commit({
    telling: { title: 'The Door Over Water', lines: [{ text: 'A door stood over the water.', strokes: [2], v: 0, a: 0 }, { text: 'The water ran on below.', strokes: [1], v: 0, a: 0 }] },
    shape: 'flat', strokes: S1, words: [{ n: 2, text: 'a door' }],
    diff: { entities: [{ new: 'the door', kind: 'thing', lines: [0] }, { new: 'the water', kind: 'place', lines: [1] }], facts: [{ about: 'the door', text: 'Its handle waited for a hand.', line: 0 }] },
    reactions: ['yes', 'yes'],
  });
  const door = w.entities.find((e) => e.name === 'the door').id;
  const plan = w.forgetPlan(door);
  assert.equal(forgetSays(plan, { picture: true }), 'Forget the door? It goes from your world, with a line of its stories, what was true of it, a chapter’s name, what you said of it and its picture. Everything else stays as it is.');
  assert.equal(forgetSays(plan, { young: true }), 'Take the door out of your world? Everything else stays.');
  const archive = memoryNights(), pics = memoryPaintings();
  await archive.putMany(w.toJSON().nights);
  await pics.put(1, { image: 'drawing', real: 'a picture made of it', alive: 'the clip it came alive in', wide: 'its panorama', world: { id: 'w1', file: 'the world built from it' }, strokes: [{ n: 1, path: [[100, 600]] }, { n: 2, path: [[260, 100]] }] });
  await pics.put(-1, { image: 'the door, made real' });
  const erased = [];
  const r = await forgetHere(w, door, { archive, pics, pictureKey: (id) => -Number(id.slice(1)), erase: async (image, strokes) => { erased.push(strokes.map((s) => s.n)); return `${image} without its marks`; }, at: 5 });
  assert.equal(r.replay, false);
  assert.deepEqual(erased, [[2]], 'only the door\'s mark is painted out');
  const kept = await pics.get(1);
  assert.deepEqual(kept, { image: 'drawing without its marks', strokes: [{ n: 1, path: [[100, 600]] }] }, 'and the picture made of that chapter is let go, with its clip, its panorama and its world');
  assert.equal(await pics.get(-1), null, 'its own picture is gone');
  const apart = await archive.get(1);
  assert.ok(!JSON.stringify(apart).toLowerCase().includes('door'), JSON.stringify(apart));
  assert.ok(!JSON.stringify(w.toJSON()).toLowerCase().includes('door'));
  assert.equal(w.entities.length, 1);
  // again: nothing more happens
  const again = await forgetHere(w, door, { archive, pics, at: 9 });
  assert.equal(again.replay, true);
  assert.deepEqual(again.record, r.record);
});

// ---------------------------------------------------------------- the opening

import { drawPlan, rounded, DAB, SAID } from '../src/intro.js';

test('the opening draws a night at an even speed, with a pause as the hand lifts, a moment for each dot, and dabs broad', () => {
  const strokes = [{ ink: 'dense', path: [[0, 0], [100, 0]] }, { ink: 'gold', path: [[500, 500]] }, { ink: 'nonsense', path: [[0, 100], [0, 200], [50, 200]] }, { path: [] }, { ink: 'gold', path: [[600, 100], [640, 100]] }];
  const p = drawPlan(strokes, 4);
  assert.equal(p.parts.length, 4, 'a stroke with no path is left out');
  // paper units to the stage: 0.8 of a unit, from (320, 34)
  assert.deepEqual(p.parts[0].pts, [[320, 34], [400, 34]]);
  assert.equal(p.parts[0].len, 80);
  assert.equal(p.parts[0].dab, false);
  assert.equal(p.parts[1].dot, true);
  assert.equal(p.parts[1].len, 40, 'a dot takes as long as a short stroke');
  assert.equal(p.parts[1].from, 80 + 60);
  assert.equal(p.parts[2].ink, 'dense', 'an ink it does not know is drawn as black ink');
  assert.equal(p.parts[2].from, 80 + 60 + 40 + 60);
  // its corner rounded: a little shorter than the 80 + 40 of its two sides, from the same start to the same end
  const c = p.parts[2];
  assert.ok(c.len < 120 && c.len > 105, String(c.len));
  assert.deepEqual([c.pts[0], c.pts.at(-1)], [[320, 114], [360, 194]]);
  assert.equal(p.parts[3].dab, true, `a stroke shorter than ${DAB} on the stage is a dab`);
  assert.equal(p.parts[3].from, p.parts[2].from + c.len + 60);
  assert.equal(p.total, p.parts[3].from + 32 + 60);
  assert.equal(p.speed, p.total / 4, 'the whole night takes the time given');
  assert.deepEqual(drawPlan([], 4), { parts: [], total: 0, speed: 1 });
  assert.deepEqual(drawPlan(null, 4).parts, []);
  // rounding keeps a straight line straight and two points as they are
  assert.deepEqual(rounded([[0, 0], [10, 0]]), [[0, 0], [10, 0]]);
  assert.ok(rounded([[0, 0], [5, 0], [10, 0]]).every(([, y]) => y === 0));
});

test('the opening says what Inkwash is, and never who makes the story', () => {
  for (const s of Object.values(SAID)) assert.ok(!/claude|anthropic|\bai\b|model/i.test(s), s);
});

// ---------------------------------------------------------------- the pictures ledger (scripts/demo.mjs --real)

import { priceOf, ledgered } from '../scripts/ledger.mjs';

test('the pictures ledger counts each picture before it is asked for, and refuses one past the cap', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(`${tmpdir()}/ledger-`), file = `${dir}/l.json`;
  try {
    const big = { imageGenerationConfig: { width: 1280, height: 800, quality: 'standard', numberOfImages: 1 } };
    const small = { imageGenerationConfig: { width: 768, height: 512, quality: 'standard' } };
    assert.equal(priceOf(big), 0.06);
    assert.equal(priceOf(small), 0.04);
    assert.throws(() => priceOf({ imageGenerationConfig: { quality: 'premium' } }), /standard/);
    assert.throws(() => priceOf({ imageGenerationConfig: { numberOfImages: 2 } }), /one picture/);
    let asked = 0;
    const paint = ledgered(async () => { asked++; throw new Error('billed, then failed'); }, { file, cap: 0.1 });
    await assert.rejects(paint(big), /billed/);
    assert.equal(paint.spent(), 0.06, 'a picture that fails is still counted');
    await assert.rejects(paint(big), /cap is reached/);
    assert.equal(asked, 1, 'past the cap, nothing is asked for');
    // the cap holds across runs: a new ledger on the same file
    const again = ledgered(async () => 'picture', { file, cap: 0.1 });
    assert.equal(await again(small), 'picture');
    assert.equal(again.spent(), 0.1);
    await assert.rejects(again(small), /cap is reached/);
    // another image model, at its own price a picture
    const gem = ledgered(async () => 'picture', { file: `${dir}/g.json`, cap: 0.3, price: 0.15 });
    await gem(big); await gem(small);
    assert.equal(gem.spent(), 0.3);
    await assert.rejects(gem(small), /cap is reached/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- worlds that meet

import { visitsKey, loadVisits, saveVisits, visitOf, visitorsIn, canVisit, send as sendVisit, sendHome, prune as pruneVisits, visitorBrief, placeVisitor, VISITORS_AT_ONCE } from '../src/visits.js';

test('worlds that meet: a thing visits one world at a time, goes home, and is let go with its world or its painter', () => {
  const memory = new Map(), storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  assert.equal(visitsKey({ demo: true }), 'inkwash.demo.visits', 'the demo family\'s apart');
  assert.equal(visitsKey({}), 'inkwash.visits');
  let vs = sendVisit([], { thing: 'e1', from: 'p1', to: 'p2', now: 5 });
  vs = sendVisit(vs, { thing: 'e1', from: 'p1', to: 'p3', now: 6 });
  assert.deepEqual(vs, [{ thing: 'e1', from: 'p1', to: 'p3', at: 6 }], 'it left the first world to visit the second');
  assert.deepEqual(sendVisit(vs, { thing: 'e2', from: 'p1', to: 'p1' }), vs, 'never its own world');
  assert.deepEqual(sendVisit(vs, { thing: 'gate', from: 'p1', to: 'p2' }), vs, 'only a thing of a world');
  vs = sendVisit(vs, { thing: 'e4', from: 'p2', to: 'p3', now: 2 });
  assert.deepEqual(visitorsIn(vs, 'p3').map((v) => v.thing), ['e4', 'e1'], 'in the order they came');
  assert.equal(visitOf(vs, 'p1', 'e1').to, 'p3');
  assert.equal(visitOf(vs, 'p2', 'e1'), null, 'another world\'s e1 is another thing');
  assert.ok(saveVisits(vs, 'k', storage));
  assert.deepEqual(loadVisits('k', storage), vs);
  memory.set('bad', JSON.stringify([{ thing: 'e1', from: 'p1', to: 'p1' }, { thing: 'e2', from: 'P!', to: 'p2' }, 7, null]));
  assert.deepEqual(loadVisits('bad', storage), [], 'nothing kept that isn\'t a visit');
  assert.deepEqual(loadVisits('none', storage), []);
  assert.deepEqual(sendHome(vs, { thing: 'e1', from: 'p1' }).map((v) => v.thing), ['e4']);
  // forgotten in its own world, or its painter gone: let go
  const painters = [{ id: 'p1' }, { id: 'p3' }];
  assert.deepEqual(pruneVisits(vs, { painters, alive: () => true }).map((v) => v.thing), ['e1'], 'p2 is not on this TV');
  assert.deepEqual(pruneVisits(vs, { painters: [...painters, { id: 'p2' }], alive: (from, thing) => thing !== 'e1' }).map((v) => v.thing), ['e4'], 'e1 was forgotten');
});

test('worlds that meet: nothing frightening visits a child, a world has room for a few, and a child\'s storyteller hears only what is gentle', () => {
  const child = { id: 'p2', young: true }, grown = { id: 'p3', young: false };
  assert.deepEqual(canVisit({ id: 'e1', name: 'the night ferry' }, child), { ok: true, why: null });
  assert.deepEqual(canVisit({ id: 'e2', name: 'the shadow wolf' }, child), { ok: false, why: 'frightening' });
  assert.deepEqual(canVisit({ id: 'e2', name: 'the shadow wolf' }, grown), { ok: true, why: null }, 'a grown-up\'s world takes it');
  assert.equal(canVisit({ id: 'e3', name: 'x', status: 'rejected' }, grown).why, 'gone');
  assert.equal(canVisit({ id: 'e5', name: 'The Moon' }, grown, [], 'p1', { names: ['the moon', 'the rocket'] }).why, 'same name', 'a world never holds two things of one name');
  assert.ok(canVisit({ id: 'e5', name: 'the moon castle' }, grown, [], 'p1', { names: ['the moon'] }).ok);
  const full = Array.from({ length: VISITORS_AT_ONCE }, (_, i) => ({ thing: `e${i + 1}`, from: 'p1', to: 'p3', at: i }));
  assert.equal(canVisit({ id: 'e9', name: 'the lantern' }, grown, full, 'p1').why, 'full');
  assert.ok(canVisit({ id: 'e1', name: 'the lantern' }, grown, full, 'p1').ok, 'one already there may be sent again');
  const card = { name: 'the night ferry', lore: 'It waits at the end of the pier.' };
  const facts = [{ text: 'It carries the dead across.' }, { text: 'It has a lantern.' }];
  assert.deepEqual(visitorBrief(card, { from: 'Moon', facts, young: true }), { name: 'the night ferry', from: 'Moon’s world', true_of_it: ['It waits at the end of the pier.', 'It has a lantern.'] });
  assert.equal(visitorBrief(card, { from: 'Moon', facts }).true_of_it.length, 3, 'a grown-up hears what is true of it');
  assert.deepEqual(visitorBrief({ name: 'the moon castle' }, { from: 'Star' }), { name: 'the moon castle', from: 'Star’s world' });
});

test('worlds that meet: a visitor stands as near where it stood at home as it can, clear of everything there, on the sheet', () => {
  const map = { nodes: [{ x: 800, y: 500, r: 150 }, { x: 400, y: 300, r: 110 }] };
  const at = placeVisitor(map, { box: [760, 460, 840, 540] }, { r: 115 });
  for (const n of map.nodes) assert.ok(Math.hypot(n.x - at.x, n.y - at.y) >= n.r + 115 + 30, 'clear of each');
  assert.ok(at.x >= 175 && at.x <= 1425 && at.y >= 152 && at.y <= 848, 'on the sheet');
  assert.ok(Math.hypot(at.x - 800, at.y - 500) < 400, 'near where it stood');
  assert.deepEqual(placeVisitor({ nodes: [] }, { box: [100, 100, 140, 140] }, { r: 100 }), { x: 160, y: 140, r: 100 }, 'kept on the sheet');
});

test('worlds that meet, told: the storyteller hears what is visiting, a line naming it is theirs, and it stays its own world\'s', async () => {
  const visitors = [{ name: 'the night ferry', from: 'Moon’s world', true_of_it: ['It waits at the end of the pier.'] }];
  const ctx = tonightCtx({ visitors });
  const text = firstMessage(ctx, { numbered: PIC, brief: briefFor(createDreamWorld(), ctx) })[2].text;
  assert.deepEqual(JSON.parse(/^VISITING\b[^\n]*\n(.+)$/m.exec(text)[1]), visitors);
  assert.match(/^VISITING[^\n]*/m.exec(text)[0], /never remember it as a thing of theirs/);
  assert.ok(!/^VISITING/m.test(firstMessage(tonightCtx(), { numbered: PIC, brief: briefFor(createDreamWorld(), tonightCtx()) })[2].text), 'only when something is');
  const telling = { title: 'The Pier', lines: [{ text: 'A boat waiting at the pier.', strokes: [2] }, { text: 'The night ferry came to visit.', strokes: [1] }, { text: 'Someone sang far off.', strokes: [1] }] };
  const alone = createTools(tonightCtx(), { world: createDreamWorld(), paintings: memoryPaintings(), render: fakeRender, ui: screen().ui });
  await assert.rejects(alone.tell(telling), /could be anyone's/, 'with nothing visiting, the ferry is no one\'s');
  const w = createDreamWorld();
  const t = createTools(ctx, { world: w, paintings: memoryPaintings(), render: fakeRender, ui: screen().ui });
  await t.tell(telling);
  assert.deepEqual(t.checks.map((c) => c.ok), [true], 'named, it is theirs to see');
  const kept = await t.remember({ things: [{ name: 'The Night Ferry', kind: 'thing', strokes: [1] }, { name: 'the pier', kind: 'place', strokes: [2] }] });
  assert.deepEqual(kept.kept, ['the pier (new)']);
  assert.deepEqual(kept.visiting, ['the night ferry is visiting from Moon’s world: it stays theirs, so it is not kept here']);
  assert.deepEqual(w.entities.map((e) => e.name), ['the pier']);
});

import { namedIn } from '../src/cards.js';

test('picture choices: an answer names the thing of their world it says, the longest name winning, never by a word as plain as friend', () => {
  const things = [{ id: 'e2', name: 'the moon' }, { id: 'e3', name: 'the moon castle', aliases: ['castle'] }, { id: 'e4', name: 'the dragon friend', aliases: ['dragon', 'friend'] }, { id: 'e1', name: 'the rocket' }];
  const id = (t) => (namedIn(t, things) || {}).id || null;
  assert.equal(id('Up to the moon castle'), 'e3');
  assert.equal(id("The moon castle's door"), 'e3');
  assert.equal(id('Up to the moon'), 'e2');
  assert.equal(id('To the dragon'), 'e4');
  assert.equal(id('The dragon friend'), 'e4');
  assert.equal(id('A friend'), null, 'friend names no one in particular');
  assert.equal(id('Someone waiting for the rocket'), 'e1');
  assert.equal(id('A balloon'), null);
  assert.equal(id('Moonlight'), null, 'whole words only');
  assert.equal(namedIn('the castle', [{ name: 'the moon castle', aliases: ['castle'] }]).name, 'the moon castle');
});

import { stepFor, STEP, TURN, REACH } from '../src/steps.js';

test('walking inside a world built from their picture: a press a step or a turn, never far from where it was taken', () => {
  const start = { x: 0, z: 0, yaw: 0 };
  assert.deepEqual(stepFor(start, 'up'), { x: 0, z: -STEP, yaw: 0 }, 'forward is ahead, into the picture');
  assert.deepEqual(stepFor(start, 'down'), { x: 0, z: STEP, yaw: 0 });
  assert.equal(stepFor(start, 'left').yaw, TURN);
  assert.equal(stepFor(start, 'right').yaw, -TURN);
  assert.equal(stepFor(start, 'select'), null, 'OK does nothing here');
  // turned left a quarter, forward goes left
  const turned = stepFor({ x: 0, z: 0, yaw: Math.PI / 2 }, 'up');
  assert.ok(Math.abs(turned.x + STEP) < 1e-9 && Math.abs(turned.z) < 1e-9, JSON.stringify(turned));
  // held on: no further than REACH from where it was taken
  let at = start;
  for (let k = 0; k < 40; k++) at = stepFor(at, 'up');
  assert.ok(Math.abs(Math.hypot(at.x, at.z) - REACH) < 1e-9, JSON.stringify(at));
});

import { SHEET as PANORAMA, nextLook, LOOK_NAMES, versionLabel, isVersionLabel, panStep, panOffset, PAN } from '../src/wide.js';
import { WIDE } from '../server/wide.mjs';
import { LOOKS } from '../server/illustrator.mjs';

test('all around it, and painted again: the sheet the server takes, the next look not yet tried, and a panorama looked across', () => {
  // the TV's sheet is the one the story server checks for, the picture in its middle
  assert.deepEqual([PANORAMA.W, PANORAMA.H], [WIDE.width, WIDE.height]);
  assert.equal(PANORAMA.picture.x * 2 + PANORAMA.picture.w, PANORAMA.W, 'the picture in the middle');
  // painted again: the next look, a look not yet tried first, round again when all have been; every one the Illustrator knows
  assert.equal(nextLook('real'), 'painting');
  assert.equal(nextLook('painting', false, ['real', 'painting']), 'storybook');
  assert.equal(nextLook('film', false, ['real', 'painting', 'storybook', 'film']), 'real', 'round again');
  assert.equal(nextLook('real', false, ['real', 'painting']), 'storybook', 'one not yet tried');
  assert.equal(nextLook('film', true), 'storybook', "a child's from a warm film");
  assert.equal(nextLook('nonsense'), 'painting');
  for (const l of ['real', 'painting', 'storybook', 'film']) assert.ok(LOOKS[l] && LOOK_NAMES[l], l);
  assert.equal(versionLabel(0, 3), 'Picture 1 of 3');
  assert.ok(isVersionLabel('Picture 2 of 2') && !isVersionLabel('Paint it again') && !isVersionLabel(undefined));
  // looked across: an arrow held looks that way; let go, it drifts on, and turns back at the ends
  let p = { x: 0.5, v: 1 };
  p = panStep(p, { dt: 1, dir: 1 });
  assert.ok(Math.abs(p.x - (0.5 + PAN.speed * 0.25)) < 1e-9 && p.v === 1, 'a long frame looks only so far');
  p = panStep({ x: 0.99, v: 1 }, { dt: 0.25, dir: 1 });
  assert.equal(p.x, 1);
  p = panStep({ x: 0.999, v: 1 }, { dt: 0.25 });
  assert.deepEqual(p, { x: 1, v: -1 }, 'turns back at the end');
  p = panStep({ x: 0.5, v: 1 }, { dt: 0.25, dir: -1 });
  assert.ok(p.x < 0.5 && p.v === -1, 'and drifts on the way it was looked');
  assert.deepEqual(panStep({ x: 0.3, v: -1 }, { dt: NaN }), { x: 0.3, v: -1 });
  // where it sits: its left end at the screen's left, its right end at the screen's right
  assert.equal(panOffset(0), -0);
  assert.equal(Math.round(panOffset(1)), -Math.round((2560 / 800) * 1080 - 1920));
  assert.equal(panOffset(1, { W: 1280, H: 800 }), (1920 - 1728) / 2, 'a picture no wider than the screen stays in the middle');
});
