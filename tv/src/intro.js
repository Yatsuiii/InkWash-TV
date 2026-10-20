// The opening: what Inkwash is, in about twenty seconds, before the seals. A child's drawing from
// the demo family draws itself as light, stroke by stroke, where it was painted; the storyteller
// tells it back, a line at a time; and it wakes up as their world, chapter after chapter. Any
// button skips it. It is the demo family's own kept nights (demo-family.js), so nothing is called
// and nothing is made up for it.
//
// `nights`: [{ title, strokes, lines }] in order, strokes as kept (each { ink, path: [[x, y]...]
// in paper units }); `world(i)`: a promise of night i as it is in their world (an image URL), or
// null; `speak(text)`: says a line aloud where the TV can; `done()`: when it ends or is skipped.

// paper units to the stage: the sheet drawn back (1280 by 800), so the words under it are clear
const PX = 0.8, AT = { x: 320, y: 34 };
// each ink as light, the way the TV draws it in their world: [core, glow]
const LIGHT = {
  dense: ['rgba(255, 248, 234, 0.96)', 'rgba(190, 205, 255, 0.16)'],
  light: ['rgba(240, 232, 214, 0.62)', 'rgba(170, 190, 255, 0.10)'],
  water: ['rgba(200, 220, 240, 0.4)', 'rgba(150, 180, 255, 0.08)'],
  indigo: ['rgba(140, 168, 255, 0.95)', 'rgba(110, 140, 255, 0.22)'],
  gold: ['rgba(255, 214, 128, 0.97)', 'rgba(255, 190, 90, 0.22)'],
  cinnabar: ['rgba(255, 128, 98, 0.95)', 'rgba(255, 96, 70, 0.22)'],
};
// the beats, in seconds from the start
const T = { mark: 0.4, markOut: 2.6, draw: 2.8, drawFor: 5.2, tell: 8.6, line: 2.1, world: 15.2, chapter: 2.2, end: 22.0, out: 25.5 };

export const SAID = {
  draw: 'Draw what’s in your head, with your remote.',
  tell: 'A storyteller tells it back, from what you drew.',
  world: 'And it becomes a world that remembers, chapter after chapter.',
  end: 'Draw your world. Hear it told. Live in it.',
};

// A path with its corners rounded (Chaikin's cutting, twice), as a brush rounds them: the kept
// path is the brush's samples, which drawn straight from one to the next show their joins. Its
// ends stay where they were.
export function rounded(pts, times = 2) {
  let p = pts;
  for (let k = 0; k < times && p.length > 2; k++) {
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, y0] = p[i], [x1, y1] = p[i + 1];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}
// how long a stroke is on the stage, below which it is a dab: ink pressed and held, drawn broad
export const DAB = 60;

// The strokes of a night laid end to end, with how far along each one starts: drawn at an even
// speed, the whole night takes `seconds`. Pure, for the tests.
export function drawPlan(strokes, seconds) {
  const parts = [];
  let total = 0;
  for (const s of strokes || []) {
    const pts = rounded((s.path || []).map(([x, y]) => [AT.x + x * PX, AT.y + y * PX]));
    if (!pts.length) continue;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    // a dot (the brush pressed and held where it was) is drawn as if it were a short stroke, so
    // it takes a moment; a dab, broad
    const dot = len < 12, dab = !dot && len < DAB;
    parts.push({ ink: LIGHT[s.ink] ? s.ink : 'dense', pts, len: dot ? 40 : len, dot, dab, from: total });
    total += (dot ? 40 : len) + 60; // a little pause between strokes, as a hand lifts
  }
  const speed = total ? total / seconds : 1;
  return { parts, total, speed };
}

export function createIntro(root, { nights, world = async () => null, speak = () => {}, done = () => {} }) {
  const canvas = root.querySelector('canvas'), g = canvas.getContext('2d');
  const frames = [...root.querySelectorAll('.world')];
  const mark = root.querySelector('.mark'), cap = root.querySelector('.cap'), line = root.querySelector('.line'), chapter = root.querySelector('.chapter'), skip = root.querySelector('.skip');
  const first = nights[0];
  const plan = drawPlan(first.strokes, T.drawFor);
  const told = (first.lines || []).slice(0, 3);
  // the worlds are made once it is drawn, one after another, while the story is told: making one
  // holds a slow TV still for a moment, which the drawing would show and the told words don't
  const made = [];
  const make = (i) => (made[i] ||= Promise.resolve().then(() => (ended ? null : world(i))).catch(() => null));
  const prepare = () => nights.reduce((p, n, i) => p.then(() => new Promise((ok) => setTimeout(ok, 40))).then(() => make(i)), Promise.resolve());
  let start = null, raf = 0, ended = false, drawnTo = 0, shownLine = -1, shownWorld = -1, said = new Set(), prepared = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.globalCompositeOperation = 'lighter';

  const show = (el, on) => el.classList.toggle('on', !!on);
  const caption = (key) => {
    if (cap.dataset.key === key) return;
    cap.dataset.key = key;
    show(cap, false);
    setTimeout(() => { if (ended) return; cap.textContent = SAID[key]; show(cap, true); }, 420);
  };
  // the night drawn up to `d` (stage pixels along all its strokes), adding only what is new
  function drawTo(d) {
    for (const p of plan.parts) {
      const a = Math.max(drawnTo, p.from), b = Math.min(d, p.from + p.len);
      if (b <= a) continue;
      const [core, glow] = LIGHT[p.ink];
      if (p.dot) {
        const [x, y] = p.pts[0], r = 6 + 12 * ((b - p.from) / p.len);
        for (const [w, c] of [[r * 2.4, glow], [r, core]]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, w, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      // the part of this stroke from a to b, as one path, drawn as a glow and then its bright core
      const seg = [];
      let run = p.from;
      for (let i = 1; i < p.pts.length; i++) {
        const [x0, y0] = p.pts[i - 1], [x1, y1] = p.pts[i];
        const l = Math.hypot(x1 - x0, y1 - y0), s0 = run, s1 = run + l;
        run = s1;
        if (s1 < a || s0 > b || !l) continue;
        const t0 = Math.max(0, (a - s0) / l), t1 = Math.min(1, (b - s0) / l);
        if (!seg.length) seg.push([x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0]);
        seg.push([x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1]);
      }
      if (seg.length < 2) continue;
      for (const [w, c] of p.dab ? [[46, glow], [28, glow], [16, core]] : [[30, glow], [16, glow], [8, core]]) {
        g.strokeStyle = c; g.lineWidth = w;
        g.beginPath(); g.moveTo(seg[0][0], seg[0][1]);
        for (const [x, y] of seg.slice(1)) g.lineTo(x, y);
        g.stroke();
      }
    }
    drawnTo = Math.max(drawnTo, d);
  }
  async function toWorld(i) {
    const url = await make(i);
    if (ended || !url) return;
    const f = frames[i % 2], other = frames[1 - (i % 2)];
    f.querySelector('img').src = url;
    await f.querySelector('img').decode().catch(() => {});
    if (ended) return;
    other.classList.remove('top'); f.classList.add('top');
    show(f, true);
    // the drawing, made light, gives way to its world
    if (i === 0) canvas.classList.add('gone');
    setTimeout(() => { if (!ended && f.classList.contains('top')) show(other, false); }, 1600);
    chapter.innerHTML = '';
    const k = document.createElement('span'); k.className = 'kicker'; k.textContent = `Chapter ${i + 1}`;
    const t = document.createElement('span'); t.className = 'title'; t.textContent = nights[i].title;
    chapter.append(k, t);
    show(chapter, true);
  }
  function frame(now) {
    if (ended) return;
    if (start == null) start = now;
    const t = (now - start) / 1000;
    show(mark, t >= T.mark && t < T.markOut);
    if (t >= T.draw) {
      if (t < T.tell) caption('draw');
      drawTo((t - T.draw) * plan.speed);
    }
    if (t >= T.tell && !prepared) { prepared = true; prepare(); }
    if (t >= T.tell && t < T.world) {
      caption('tell');
      const i = Math.min(told.length - 1, Math.floor((t - T.tell) / T.line));
      if (i !== shownLine && told[i]) {
        shownLine = i;
        show(line, false);
        setTimeout(() => { if (ended) return; line.textContent = told[i].text; show(line, true); }, 260);
        if (!said.has(i)) { said.add(i); speak(told[i].text); }
      }
    }
    if (t >= T.world && t < T.end) {
      if (shownLine !== -2) { shownLine = -2; show(line, false); }
      caption('world');
      const i = Math.min(nights.length - 1, Math.floor((t - T.world) / T.chapter));
      if (i !== shownWorld) { shownWorld = i; toWorld(i); }
    }
    if (t >= T.end) {
      caption('end');
      show(chapter, false);
      show(mark, true);
      root.classList.add('ending');
      show(skip, true);
    }
    if (t >= T.out) return finish();
    raf = requestAnimationFrame(frame);
  }
  function finish() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    root.classList.add('leaving');
    setTimeout(() => {
      root.hidden = true;
      root.classList.remove('leaving', 'ending');
      [mark, cap, line, chapter, skip, ...frames].forEach((el) => el.classList.remove('on', 'top'));
      canvas.classList.remove('gone');
      done();
    }, 700);
  }
  root.hidden = false;
  show(skip, true);
  setTimeout(() => { if (!ended && start != null) show(skip, false); }, 2400);
  raf = requestAnimationFrame(frame);
  return { skip: finish, get t() { return start == null ? 0 : (performance.now() - start) / 1000; }, get ended() { return ended; } };
}
