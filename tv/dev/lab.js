// The ink lab: paints a scripted picture with the real brush and the real ink, in simulated time,
// for tuning the ink by eye. Open /dev/lab.html?scene=<name>. `window.__lab.done` turns true when
// the picture is finished and dry.
import { createBrush, step, press, INKS } from '../src/brush.js';
import { createInkGL } from '../src/inkgl.js';

const params = new URLSearchParams(location.search);
let simT = 0;
const tuning = params.get('tuning') ? JSON.parse(params.get('tuning')) : {};
const ink = createInkGL(document.querySelector('#ink'), { clock: () => simT, tuning, lazy: true });
const brush = createBrush({ x: 800, y: 500 });
const DT = 1 / 60;
const info = document.querySelector('#info');

function frame(held = []) {
  const r = step(brush, { held: new Set(held) }, DT);
  if (r.segs.length) ink.marks(r.segs);
  if (r.event === 'end') ink.end();
  ink.frame(DT);
  simT += DT;
  return r;
}
const deg = (d) => (d * Math.PI) / 180;
const S = {
  at(x, y, heading = 0) { brush.x = x; brush.y = y; brush.heading = brush.trail = deg(heading); },
  ink(id) { brush.ink = INKS.findIndex((k) => k.id === id); },
  down() { press(brush, 'select'); ink.begin(); },
  go(seconds, held = []) { for (let t = 0; t < seconds - 1e-9; t += DT) frame(held); },
  lift() { press(brush, 'select'); for (let i = 0; i < 60 && brush.phase !== 'lifted'; i++) frame(); },
  wait(seconds) { S.go(seconds); },
};

// ---------------------------------------------------------------- scenes
const scenes = {
  // one drop of water and ink, and how it spreads
  drop() {
    ink.begin();
    const drop = { x0: 400, y0: 400, x1: 400, y1: 400, d0: 0, r: 4, pig: 1, cover: 1, wat: 4, body: 0, seed: 0.5 };
    for (let i = 0; i < 10; i++) { ink.marks([drop]); ink.frame(DT); simT += DT; }
    ink.end();
    const ring = () => [0, 4, 8, 12, 16, 24, 32, 48].map((d) => ink.peek(400 + d, 400)[0]);
    window.__lab.cuts = [];
    for (let i = 0; i <= 8; i++) { window.__lab.cuts.push([`t=${(i * 0.25).toFixed(2)}`, ring()]); S.wait(0.25); }
    window.__lab.paper = [0, 4, 8, 12, 16, 24, 32, 48].map((d) => ink.peekPaper(400 + d, 400));
  },
  // one steady stroke, and a cross-section of the wet layer as it spreads and dries
  one() {
    S.ink('dense');
    S.at(200, 300, 0); S.down(); S.go(2); S.lift();
    const cut = () => [-24, -16, -10, -6, -3, 0, 3, 6, 10, 16, 24].map((d) => ink.peek(400, 300 + d));
    window.__lab.cuts = [['t=0', cut()]];
    for (const t of [0.5, 1, 2, 4, 8]) { S.wait(t - (window.__lab.lastT || 0)); window.__lab.lastT = t; window.__lab.cuts.push([`t=${t}`, cut()]); }
    S.at(200, 500, 0); S.down(); S.go(0.25); S.go(3, ['down']); S.lift();
    window.__lab.pool = [0, 10, 20, 30, 45, 60, 80].map((d) => ink.peek(200 + d + 40, 500));
    S.wait(1);
    window.__lab.pool1 = [0, 10, 20, 30, 45, 60, 80].map((d) => ink.peek(200 + d + 40, 500));
  },
  // one of each: a steady line, pressed, eased off, a long one running dry, a pool, wet-on-wet
  samples() {
    S.ink('dense');
    S.at(80, 90, 0); S.down(); S.go(2.4); S.lift();
    S.at(80, 200, 0); S.down(); S.go(0.5); S.go(0.9, ['down']); S.go(1.2); S.lift();
    S.at(80, 300, 0); S.down(); S.go(0.2); S.go(2.4, ['up']); S.lift();
    S.at(80, 420, 0); S.down(); S.go(8); S.lift();
    S.at(250, 560, 0); S.down(); S.go(0.25); S.go(3, ['down']); S.lift();
    S.ink('light');
    S.at(480, 560, 0); S.down(); S.go(0.25); S.go(2.2, ['down']); S.lift();
    S.ink('water');
    S.at(80, 760, 0); S.down(); S.go(0.3, ['down']); S.go(2.6); S.lift();
    S.ink('light');
    S.at(140, 740, 30); S.down(); S.go(1.5, ['right']); S.lift();
    S.ink('dense');
    S.at(300, 800, -30); S.down(); S.go(0.6); S.lift();
    S.at(800, 600, 0); S.down(); S.go(0.3); S.go(2.62, ['right']); S.lift();
    S.wait(10);
  },
  // a small picture: distant hills, mist, bamboo, a moon and two birds
  bamboo() {
    // far hills, light ink, pressed broad
    S.ink('light');
    S.at(30, 700, -18); S.down(); S.go(0.4, ['down']); S.go(0.7); S.go(0.5, ['right']); S.go(0.9); S.go(0.4, ['left']); S.go(1.1, ['down']); S.go(1.0); S.go(0.5, ['right']); S.go(1.2); S.lift();
    S.at(520, 760, -25); S.down(); S.go(0.3, ['down']); S.go(1.4); S.go(0.6, ['right']); S.go(1.4); S.go(0.4, ['left']); S.go(1.6); S.lift();
    // mist: clear water along the foot of the hills, touched with light ink
    S.ink('water');
    S.at(40, 820, 0); S.down(); S.go(0.2, ['down']); S.go(4.2); S.lift();
    S.ink('light');
    S.at(160, 812, 0); S.down(); S.go(0.2); S.lift();
    S.at(420, 826, 0); S.down(); S.go(0.25); S.lift();
    S.wait(2);
    // the moon
    S.at(330, 220, 0); S.down(); S.go(2.62, ['right']); S.lift();
    // bamboo: four segments up, with knots
    S.ink('dense');
    let x = 1180, y = 990;
    for (let i = 0; i < 5; i++) {
      S.at(x, y, -88 - i * 1.5); S.down(); S.go(0.12, ['down']); S.go(0.85); S.go(0.3, ['down']); S.lift();
      y = brush.y - 14; x = brush.x;
    }
    // leaves: pressed in, then eased off to a point
    const leaf = (lx, ly, h, turn) => { S.at(lx, ly, h); S.down(); S.go(0.12, ['up']); S.go(0.25, turn ? [turn, 'down'] : ['down']); S.go(0.3, turn ? [turn] : []); S.lift(); };
    leaf(1186, 610, -150, 'left'); leaf(1190, 600, -120, null); leaf(1192, 615, -30, 'right');
    leaf(1188, 420, 160, 'right'); leaf(1190, 410, 200, 'left'); leaf(1196, 400, -40, null);
    leaf(1200, 300, -70, 'left'); leaf(1205, 290, -10, 'right');
    // two birds
    const bird = (bx, by) => { S.at(bx, by, -30); S.down(); S.go(0.1, ['right']); S.lift(); S.at(brush.x, brush.y, 20); S.down(); S.go(0.12, ['up']); S.lift(); };
    bird(620, 300); bird(700, 270);
    // a dry, quick line of ground
    S.at(820, 960, -3); S.down(); S.go(0.2); S.go(2.6, ['up']); S.lift();
    S.wait(10);
  },
};

const name = params.get('scene') || 'samples';
const t0 = performance.now();
window.__lab = { done: false };
scenes[name]();
ink.redraw();
Object.assign(window.__lab, { done: true, ms: Math.round(performance.now() - t0), stats: ink.stats, kind: ink.kind });
info.textContent = `${name} · ${window.__lab.ms} ms · ${ink.stats.steps} wet steps`;
