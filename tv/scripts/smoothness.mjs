// How smooth the TV is, screen by screen, with the CPU slowed to about a Fire TV Stick's: from
// painting a night and hearing it told to their world at night, walking through it, stepping
// inside, last time’s story and their book. The TV is driven as scripts/painted-nights.mjs drives
// it (a scripted storyteller: no model is called).
//
//   node scripts/smoothness.mjs [slowdown=6]     a table per screen; test-shots/smooth/results.json
//   SMOOTH_PAINT=0 node scripts/smoothness.mjs   the same, with no thing coming to life
//
// Per screen:
// - how busy the page's own thread is: the share of the time it is working, and on what (script,
//   style, layout, and the rest: painting, the GPU's commands, collecting garbage), from Chrome's
//   own counters, read twice a second. What a TV stick runs out of first.
// - the frames: the gap between two frames is how long the picture stood still. 16.7 ms is smooth
//   at 60 frames a second, 33 ms at 30; over 50 ms the eye sees a stutter. This machine's GPU is
//   emulated in software, where a full-screen frame takes about 50 ms, so frames a second here
//   say more about the emulator than about a TV.
// - long tasks, and the scripts that ran in the long frames (Long Animation Frames): what kept a
//   frame waiting, by function.
//
// Each frame is put down to the screen it was on, sampled four times a second.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openTV, R, UP, DOWN, wavy } from './painted-nights.mjs';

const OUT = fileURLToPath(new URL('../test-shots/smooth/', import.meta.url));
const RATE = Number(process.argv[2]) || 6;

// two nights for one grown-up: the second carried on, with what happens next painted
const NIGHTS = [
  {
    title: 'The Harbour',
    strokes: [
      { at: [80, 820], heading: R, ms: 6000, ink: 'indigo', steer: wavy(6000, 800, 240) },
      { at: [400, 900], heading: UP, ms: 2600, ink: 'dense' },
      { at: [600, 900], heading: UP, ms: 2600 },
      { at: [360, 560], heading: R, ms: 2400 },
      { at: [1200, 640], heading: R, ms: 150, press: 1400, ink: 'dense' },
      { at: [1300, 200], heading: R, ms: 2400, ink: 'gold', steer: [['ArrowRight', 150, 2400]] },
    ],
    words: [{ after: 2, text: 'a harbour at night with the boats tied up' }],
    marks: { 0: ['ArrowUp'], 4: ['ArrowDown', 'ArrowRight'] },
    guide: {
      asks: [{ question: 'What was this, by the water?', choices: ['a boat', 'a rock', 'a dog'], answer: 'a boat', strokes: [5] }],
      lines: [
        { text: 'A harbour at night, the boats tied up and still.', strokes: [1, 2, 3, 4] },
        { text: 'One boat, pressed down hard into the dark water.', strokes: [5] },
        { text: 'Above it all, the moon went round in gold.', strokes: [6] },
      ],
      react: { 1: 'no' },
      again: [{ text: 'One boat, tied up apart from the others, pressed down into the dark water.', strokes: [5] }],
      remember: { things: [{ name: 'the harbour', kind: 'place', strokes: [1, 2, 3, 4] }, { name: 'the boat', kind: 'thing', strokes: [5] }, { name: 'the gold moon', kind: 'thing', strokes: [6] }] },
    },
  },
  {
    title: 'The Boat Leaves',
    strokes: [
      { at: [80, 830], heading: R, ms: 6000, ink: 'indigo', steer: wavy(6000, 800, 240) },
      { at: [1210, 640], heading: R, ms: 150, press: 1400, ink: 'dense' },
      { at: [300, 300], heading: DOWN, ms: 2000, ink: 'light' },
    ],
    words: [{ after: 2, text: 'the boat came untied and drifted out' }],
    marks: { 1: ['ArrowDown'] },
    guide: {
      sameAs: 'the boat', at: 2, asks: [],
      lines: [
        { text: 'The boat came untied and drifted out across the harbour.', strokes: [1, 2] },
        { text: 'Rain came down pale over the water.', strokes: [3] },
      ],
      remember: { things: [{ ref: 'the boat', strokes: [2] }, { ref: 'the harbour', strokes: [1] }, { name: 'the rain', kind: 'thing', strokes: [3] }] },
    },
    ending: {
      strokes: [{ at: [1000, 600], heading: R, ms: 150, press: 700, ink: 'gold' }],
      marks: { 0: ['ArrowUp'] },
      guide: {
        asks: [{ question: 'What happened next?', choices: ['a light came on', 'it sank', 'I swam to it'], answer: 'a light came on' }],
        lines: [
          { text: 'The boat came untied and drifted out across the harbour.', strokes: [1, 2] },
          { text: 'Rain came down pale over the water.', strokes: [3] },
          { text: 'Then a light came on, gold, on the boat.', strokes: [4] },
        ],
        remember: { things: [{ ref: 'the boat', strokes: [4], why: 'a light came on' }] },
      },
    },
  },
].map((n) => ({ dream: n.title, ...n }));

// each thing comes to life as it would with Nova Canvas: a picture of it on white, the size it is
// asked for (here its own strokes given back, a second or two later), cut out on the TV
const paint = async (body) => {
  const t = body.textToImageParams;
  if (!/on a plain pure white background/.test(t.text)) throw new Error('no picture but a thing’s, here');
  await new Promise((ok) => setTimeout(ok, 1500));
  return t.conditionImage;
};
// SMOOTH_PAINT=0: no pictures, to measure the same screens without things coming to life
const TV = await openTV({ out: OUT, port: 5197, guidePort: 5198, pictures: process.env.SMOOTH_PAINT === '0' ? null : paint });
const { page, tv } = TV;
// every frame, and what was on the screen; every long task
await page.addInitScript(() => {
  const F = window.__frames = { t: [], s: [] }, L = window.__long = [], A = window.__loaf = [];
  let scene = 'loading', next = 0;
  Object.defineProperty(window, '__scene', { get: () => scene });
  const sceneOf = () => {
    const T = window.__inktv;
    if (!T || !T.ready) return 'loading';
    if (document.querySelector('#atlas.walking')) return 'walking through their world';
    const m = T.mode;
    if (m === 'paint') return T.wet ? 'painting' : 'the paper, still';
    if (m === 'replay') return 'feel it again';
    if (m === 'tell') return document.querySelector('#kept') && !document.querySelector('#kept').hidden ? 'last time’s story' : 'the telling';
    if (m === 'guide' || m === 'ask') return 'the storyteller, working';
    if (m === 'offer') return document.querySelector('#collected .card') ? 'woken up, a card coming to life' : 'woken up, and what happens next';
    if (m === 'atlas') return T.atlas && T.atlas.making ? 'their world, things coming to life' : 'their world at night';
    if (m === 'inside') return 'stepping inside';
    if (m === 'who') return 'the seals';
    if (m === 'journal') return 'their book';
    return m || 'other';
  };
  const f = (t) => { if (t > next) { scene = sceneOf(); next = t + 250; } F.t.push(t); F.s.push(scene); requestAnimationFrame(f); };
  requestAnimationFrame(f);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) L.push([e.startTime, e.duration]); }).observe({ entryTypes: ['longtask'] }); } catch { /* none */ }
  // a frame that took over 50 ms: what ran in it, from where, and when it began to draw
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) A.push({ at: e.startTime, ms: e.duration, layout: e.styleAndLayoutStart, scripts: (e.scripts || []).map((x) => ({ fn: x.sourceFunctionName || x.invokerType || '?', file: String(x.sourceURL || '').split('/').pop().split('?')[0], ms: x.duration })) });
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { /* none */ }
});
const cdp = await page.context().newCDPSession(page);
const slow = (rate) => cdp.send('Emulation.setCPUThrottlingRate', { rate });
const collect = async () => ({ F: await tv(() => window.__frames), L: await tv(() => window.__long), A: await tv(() => window.__loaf) });

// Chrome's counters for the page's thread, twice a second, with the screen it was on (null: a page
// loading, where the counters may start again)
await cdp.send('Performance.enable');
const usage = [];
let polling = true;
const poller = (async () => {
  while (polling) {
    try {
      const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      const scene = await page.evaluate(() => window.__scene);
      usage.push({ at: m.Timestamp, task: m.TaskDuration, script: m.ScriptDuration, layout: m.LayoutDuration, style: m.RecalcStyleDuration, scene });
    } catch { usage.push(null); }
    await new Promise((ok) => setTimeout(ok, 500));
  }
})();

// Per screen, over each page the TV was on ({ F, L, A } a page: its frames, long tasks and long
// frames): the frames and how long the picture stood still between them; the long tasks; how busy
// the page's thread was (`usage`), and on what; and the scripts that ran longest in long frames.
const sceneAt = (F, at) => { const i = F.t.findIndex((t) => t >= at); return i >= 0 ? F.s[i] : F.s.at(-1); };
function report(pages, usage) {
  const by = new Map(), long = new Map(), busy = new Map(), loaf = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const { F, L, A } of pages) {
    for (let i = 1; i < F.t.length; i++) {
      const s = F.s[i], gap = F.t[i] - F.t[i - 1];
      if (s === 'loading' || gap > 5000) continue; // a page loading, or a tab in the background
      add(by, s, gap);
    }
    // a long task, or a long frame, is put down to the screen of the frame it ended before
    for (const [at, ms] of L) add(long, sceneAt(F, at + ms), ms);
    for (const e of A || []) add(loaf, sceneAt(F, e.at + e.ms), e);
  }
  for (let i = 1; i < usage.length; i++) {
    const a = usage[i - 1], b = usage[i];
    if (!a || !b || !b.scene || b.scene === 'loading') continue;
    const d = { secs: b.at - a.at, task: b.task - a.task, script: b.script - a.script, layout: b.layout - a.layout, style: b.style - a.style };
    if (!(d.secs > 0) || d.secs > 5 || Object.values(d).some((x) => x < 0)) continue;
    const u = busy.get(b.scene) || { secs: 0, task: 0, script: 0, layout: 0, style: 0 };
    for (const k of Object.keys(d)) u[k] += d[k];
    busy.set(b.scene, u);
  }
  const q = (xs, p) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))];
  const pc = (x, of) => Math.round((x / of) * 100);
  const rows = [...by.entries()].map(([scene, gaps]) => {
    const g = [...gaps].sort((x, y) => x - y), total = gaps.reduce((a, x) => a + x, 0);
    const jank = gaps.filter((x) => x > 50), lt = long.get(scene) || [], u = busy.get(scene);
    return {
      scene, seconds: Math.round(total / 100) / 10,
      busy: u ? pc(u.task, u.secs) : null, script: u ? pc(u.script, u.secs) : null, style: u ? pc(u.style, u.secs) : null, layout: u ? pc(u.layout, u.secs) : null,
      fps: Math.round((gaps.length / total) * 1000 * 10) / 10, median: Math.round(q(g, 0.5)), p95: Math.round(q(g, 0.95)), worst: Math.round(g.at(-1)),
      stood_still: pc(jank.reduce((a, x) => a + x, 0), total), long_tasks: lt.length, longest: lt.length ? Math.round(Math.max(...lt)) : 0,
    };
  }).sort((a, b) => (b.busy ?? 0) - (a.busy ?? 0));
  // in the long frames of each screen: the scripts that ran longest, and how long the frames spent
  // drawing once their scripts were done (style, layout, paint)
  const scripts = Object.fromEntries([...loaf.entries()].map(([scene, es]) => {
    const fn = new Map();
    for (const e of es) for (const x of e.scripts) fn.set(`${x.fn} ${x.file}`, (fn.get(`${x.fn} ${x.file}`) || 0) + x.ms);
    const drawing = es.reduce((a, e) => a + (e.layout > 0 ? e.at + e.ms - e.layout : 0), 0);
    return [scene, { frames: es.length, ms: Math.round(es.reduce((a, e) => a + e.ms, 0)), drawing: Math.round(drawing), top: [...fn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, ms]) => `${k}: ${Math.round(ms)} ms`) }];
  }));
  return { rows, scripts };
}

try {
  await TV.start();
  await slow(RATE);
  await TV.newPainter({ seal: 'Moon' });
  const nights = [];
  for (const [i, N] of NIGHTS.entries()) {
    if (i) await TV.wait(500);
    nights.push(await TV.night(N, i + 1));
  }
  // their world, walked through; their book, a page turned
  const home = await TV.visit({ prefix: '20', walk: true });
  await TV.seals();
  await TV.journal('Moon', '24-book.png');
  // the demo family's worlds, fuller: last time's story, and stepping inside it (a page of its own)
  const pages = [await collect()];
  await slow(1);
  await page.goto(`http://localhost:5197/?demo&guide=http://localhost:5198&pace=fast&idle=999&quiet=0`);
  await TV.until(() => window.__inktv && window.__inktv.ready && window.__inktv.mode === 'who', null, 120000);
  await slow(RATE);
  await TV.pick('Moon');
  await TV.until(() => window.__inktv.atlas.pictures >= window.__inktv.atlas.things.length, null, 120000).catch(() => {});
  await TV.wait(3000);
  await TV.act('Hear last time’s story');
  await TV.until(() => window.__inktv.previously, null, 20000).catch(() => {});
  await TV.wait(3000);
  await TV.key('Enter');
  await TV.until(() => window.__inktv.recap && window.__inktv.recap.i === 0, null, 20000);
  for (let k = 0; k < 8 && (await tv(() => !!window.__inktv.recap)); k++) { await TV.wait(2500); await TV.key('Enter'); }
  await TV.until(() => window.__inktv.mode === 'offer', null, 20000);
  await TV.key('Enter'); // step inside
  await TV.until(() => window.__inktv.inside && window.__inktv.inside.phase === 'open', null, 60000);
  await TV.key('Enter');
  await TV.wait(2500);
  await page.keyboard.down('ArrowRight'); await TV.wait(1500); await page.keyboard.up('ArrowRight');
  await TV.wait(1500);
  await TV.key('Escape');
  await TV.wait(2000);
  pages.push(await collect());
  polling = false;
  await poller;
  const { rows, scripts } = report(pages, usage);
  const alive = { home: await tv(() => window.__inktv.atlas && { made: window.__inktv.atlas.made, came: window.__inktv.atlas.came }).catch(() => null) };
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ rate: RATE, rows, scripts, alive, nights: nights.map((n) => ({ title: n.title, seconds: n.seconds })), walked: home.walked && home.walked.length, errors: TV.errors }, null, 2));
  console.log(`CPU slowed ${RATE}x. Per screen, busiest first: the share of the time the page's thread was working (busy), of it script, style and layout (%); frames a second, the gap between frames (median, 95th percentile, worst, ms), the share of the time the picture stood still in gaps over 50 ms, and long tasks (the longest, ms).`);
  console.table(rows);
  console.log('In the frames over 50 ms, the scripts that ran longest:');
  for (const [scene, x] of Object.entries(scripts)) console.log(`  ${scene}: ${x.frames} frames, ${x.ms} ms (${x.drawing} ms of it drawing)\n    ${x.top.join('\n    ')}`);
  console.log(`errors: ${JSON.stringify(TV.errors)}`);
} finally {
  polling = false;
  await TV.close();
}
