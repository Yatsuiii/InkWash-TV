// The Devpost gallery: the TV page itself, with the demo family and the real storyteller and Set
// Designer (through Claude Code, `claude -p`, on the subscription it is signed in with). The opening;
// Star's world in the place its story gives it; last time's story; the walk; the book; and a new
// drawing, asked about and told by the storyteller, woken, stepped inside, and home. The shots go to
// test-shots/gallery/, and the cards made from them (the screen as it is, a caption under it, 3:2)
// to docs/gallery/. No picture is made real here: run `node scripts/demo.mjs --real` first for that.
//
//   node scripts/gallery.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TV = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const { serve } = await import(`${TV}/scripts/serve.mjs`);
const { createHandler } = await import(`${TV}/server/lambda.mjs`);
const { createClaudeCli } = await import(`${TV}/server/claude-cli.mjs`);
const { memoryCommons } = await import(`${TV}/server/commons-store.mjs`);
const { memorySessions } = await import(`${TV}/server/phone.mjs`);
const { chromium } = createRequire(import.meta.url)(`${execSync('npm root -g').toString().trim()}/playwright`);

const OUT = join(TV, 'test-shots', 'gallery'), CARD_DIR = join(TV, 'docs', 'gallery');
mkdirSync(OUT, { recursive: true }); mkdirSync(CARD_DIR, { recursive: true });
const PORT = 5471, GUIDE = 5472;
const server = await serve(PORT);
const handler = createHandler({ claude: createClaudeCli({ atMost: 2 }), speak: async () => null, paint: null, commons: memoryCommons(), sessions: memorySessions() });
const guide = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    const r = await handler({ rawPath: new URL(req.url, 'http://x').pathname, headers: req.headers, body, requestContext: { http: { method: req.method } } });
    res.writeHead(r.statusCode, r.headers);
    res.end(r.body);
  });
});
await new Promise((ok) => guide.listen(GUIDE, ok));

const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const t0 = Date.now();
const now = () => Math.round((Date.now() - t0) / 100) / 10;
const marks = { strokes: [], shots: {}, said: [], asked: [], told: [], look: null, place: null };
const log = (...a) => console.log(`[${now()}s]`, ...a);
try {
  const page = ctx.pages()[0] || (await ctx.newPage());
  const tv = (fn, arg) => page.evaluate(fn, arg);
  const settle = () => tv(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  const MEDIA = { MediaFastForward: 228, MediaRewind: 227, MediaPlayPause: 179 };
  const key = async (k) => {
    if (MEDIA[k]) await tv(([name, keyCode]) => { dispatchEvent(new KeyboardEvent('keydown', { key: name, keyCode, bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { key: name, keyCode, bubbles: true })); }, [k, MEDIA[k]]);
    else await page.keyboard.press(k);
    await settle();
  };
  const wait = (ms) => page.waitForTimeout(ms);
  const until = (fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
  const shot = async (name) => { await page.screenshot({ path: join(OUT, `${name}.png`) }); marks.shots[name] = now(); log('shot', name); };
  const onTile = () => tv(() => (document.querySelector('#who .tile.on .name') || {}).textContent);

  const INK = ['dense', 'light', 'water', 'indigo', 'gold', 'cinnabar'];
  async function ink(want) {
    for (let i = 0; i < 6; i++) {
      const at = INK.indexOf(await tv(() => window.__inktv.brush.ink));
      if (INK[at] === want) return;
      await key(INK.indexOf(want) > at ? 'MediaFastForward' : 'MediaRewind');
      await wait(150);
    }
  }
  // a stroke along a line, steered back onto it as it goes (◀ ▶), lifted at its end
  async function follow(s) {
    const P = s.path, segs = [];
    let total = 0;
    for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); segs.push({ a: P[i - 1], b: P[i], from: total, len: d }); total += d; }
    const at = (u) => { const want = u * total; const sg = segs.find((x) => want <= x.from + x.len) || segs[segs.length - 1]; const t = sg.len ? (want - sg.from) / sg.len : 0; return [sg.a[0] + (sg.b[0] - sg.a[0]) * t, sg.a[1] + (sg.b[1] - sg.a[1]) * t]; };
    await tv(([x, y, h]) => window.__inktv.place(x, y, h), [P[0][0], P[0][1], Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0])]);
    await key('Enter');
    let prog = 0, shotTaken = false;
    const keysNow = new Set();
    const set = async (k, on) => { if (on && !keysNow.has(k)) { keysNow.add(k); await page.keyboard.down(k); } else if (!on && keysNow.has(k)) { keysNow.delete(k); await page.keyboard.up(k); } };
    const begun = Date.now();
    while (Date.now() - begun < 20000) {
      const b = await tv(() => { const x = window.__inktv.brush; return [x.x, x.y, x.heading]; });
      let best = prog, bd = Infinity;
      for (let u = prog; u <= Math.min(1, prog + 0.15); u += 0.005) { const q = at(u), d = Math.hypot(q[0] - b[0], q[1] - b[1]); if (d < bd) { bd = d; best = u; } }
      prog = best;
      if (s.shot && !shotTaken && prog >= (s.shotAt || 0.5)) { shotTaken = true; await shot(s.shot); }
      if (prog >= 0.985 || (prog > 0.9 && Math.hypot(P[P.length - 1][0] - b[0], P[P.length - 1][1] - b[1]) < 10)) break;
      const look = at(Math.min(1, prog + (s.look || 30) / total));
      const diff = Math.atan2(Math.sin(Math.atan2(look[1] - b[1], look[0] - b[0]) - b[2]), Math.cos(Math.atan2(look[1] - b[1], look[0] - b[0]) - b[2]));
      await set('ArrowRight', diff > 0.14); await set('ArrowLeft', diff < -0.14);
    }
    for (const k of [...keysNow]) await set(k, false);
    await key('Enter');
    await until(() => !window.__inktv.brush.touching, null, 8000);
  }

  const actions = () => tv(() => window.__inktv.atlas.actions);
  const onAction = () => tv(() => window.__inktv.atlas.actions[window.__inktv.atlas.k]);
  // to an action of their world: shown, or behind More…
  async function goAction(re) {
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < 10; k++) { if (re.test(await onAction())) { await key('Enter'); return true; } await key('ArrowDown'); }
      // behind More…
      for (let k = 0; k < 10 && (await onAction()) !== 'More…'; k++) await key('ArrowDown');
      if ((await onAction()) === 'More…') await key('Enter');
    }
    throw new Error(`no action ${re}: ${JSON.stringify(await actions())}`);
  }
  const home = () => until(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas && !window.__inktv.walk, null, 120000);

  // the opening, drawn as light, and its end card
  {
    const o = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await o.goto(`http://localhost:${PORT}/?intro`);
    await o.waitForFunction(() => window.__inktv && window.__inktv.opening && window.__inktv.opening.t > 7.6, null, { timeout: 120000 });
    await o.screenshot({ path: join(OUT, 'g00-opening.png') });
    await o.waitForFunction(() => window.__inktv.opening && window.__inktv.opening.t > 23.4, null, { timeout: 60000 });
    await o.screenshot({ path: join(OUT, 'g00-opening-end.png') });
    await o.close();
    log('shot', 'the opening');
  }
  await page.goto(`http://localhost:${PORT}/?guide=http://localhost:${GUIDE}&demo&idle=999&quiet=0`);
  await until(() => window.__inktv && window.__inktv.ready, null, 120000);
  await until(() => window.__inktv.mode === 'who');
  await wait(1500);
  await shot('g01-seals');
  // worlds that meet: Moon sends the night ferry to visit Star's world
  await key('Enter');
  await home();
  // Moon's place, written as it opens: kept as it is when it asks how it should look
  for (const t0 = Date.now(); Date.now() - t0 < 240000;) {
    const A = await tv(() => ({ all: window.__inktv.atlas.all, asking: window.__inktv.placeAsking, scene: !!window.__inktv.placeScene }));
    if (A.all.includes('Keep it as it is')) { await wait(1500); await key('Escape'); await wait(2000); continue; }
    if (A.scene && !A.asking && A.all.some((a) => /^Send the night ferry to Star/.test(a))) break;
    await wait(1000);
  }
  await goAction(/^Send the night ferry to Star/);
  await until(() => /is visiting Star’s world/.test(window.__inktv.atlas.about || ''), null, 20000);
  log('sent', await tv(() => window.__inktv.atlas.where));
  await key('Escape');
  await until(() => window.__inktv.mode === 'who');
  await wait(800);
  // Star, a child
  await key('ArrowRight');
  await key('Enter');
  await home();
  // its place, written by the Set Designer from its story, then how it should look: the first look offered
  await until(() => (window.__inktv.atlas.actions || []).includes('Keep it as it is'), null, 240000).catch(() => log('no look question'));
  if ((await actions()).includes('Keep it as it is')) {
    marks.look = await tv(() => window.__inktv.placeLook);
    log('look', JSON.stringify(marks.look));
    await wait(2500);
    await shot('g02-how-should-it-look');
    await key('ArrowDown');
    log('chose', await onAction());
    await key('Enter');
    await until(() => !window.__inktv.atlas.actions.includes('Keep it as it is') && !window.__inktv.atlas.actions.some((a) => /…$/.test(a) && a !== 'More…'), null, 240000).catch(() => log('look: still waiting'));
  }
  await wait(8000);
  marks.place = await tv(() => window.__inktv.placeScene);
  await shot('g03-star-world');
  // the night ferry, visiting from Moon's world
  for (let k = 0; k < 8 && (await tv(() => window.__inktv.atlas.card)) !== 'The night ferry'; k++) { await key('ArrowLeft'); await wait(400); }
  await wait(2500);
  await shot('g03b-visiting');
  log('visiting', await tv(() => window.__inktv.atlas.where));
  await key('ArrowRight');
  await wait(1000);
  // last time's story, opening like a series
  await goAction(/^Hear last time/);
  await wait(2600);
  await shot('g04-previously');
  await until(() => window.__inktv.tell && window.__inktv.tell.i >= 0, null, 30000);
  await wait(3200);
  await shot('g05-previously-told');
  for (let k = 0; k < 12 && (await tv(() => window.__inktv.mode)) === 'tell'; k++) { await key('Enter'); await wait(1500); }
  if ((await tv(() => window.__inktv.mode)) === 'offer') await key('Escape');
  await home();
  await wait(2000);
  // walked through
  await goAction(/^Walk through/);
  await until(() => window.__inktv.walk, null, 20000);
  await wait(3500);
  await shot('g06-walk');
  await key('Enter');
  await wait(300);
  await until(() => window.__inktv.walk && !window.__inktv.walk.moving, null, 20000);
  await wait(1500);
  await shot('g07-walk-to-a-thing');
  await key('Escape');
  await until(() => !window.__inktv.walk, null, 20000);
  await home();
  await wait(1500);
  // their book
  await goAction(/^Read your book/);
  await until(() => window.__inktv.mode === 'journal', null, 20000);
  await wait(2500);
  await shot('g08-book');
  await key('ArrowRight');
  await wait(2500);
  await shot('g09-book-chapter');
  await key('Escape');
  await home();
  await wait(1500);
  // a new drawing: a red balloon on a string, and a little gold star beside it
  await goAction(/^Draw something new/);
  await until(() => window.__inktv.mode === 'paint' && window.__inktv.brush, null, 20000);
  await wait(1500);
  const ring = (cx, cy, r, from, to, step = 0.12) => { const n = Math.max(2, Math.ceil(Math.abs(to - from) / step)); return Array.from({ length: n + 1 }, (_, i) => { const a = from + ((to - from) * i) / n; return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]; }); };
  const STROKES = [
    { ink: 'cinnabar', path: ring(560, 330, 85, Math.PI / 2, Math.PI / 2 + 2 * Math.PI * 0.97) },
    { ink: 'light', path: [[560, 418], [540, 520], [575, 620], [550, 720]] },
    { ink: 'gold', path: [[360, 200], [372, 200]], shot: 'g10-drawing', shotAt: 0.5 },
  ];
  for (const [i, s] of STROKES.entries()) {
    await until(() => !window.__inktv.wet, null, 30000).catch(() => {});
    await wait(150);
    if (s.ink) await ink(s.ink);
    await follow(s);
    await wait(600);
    log('stroke', i + 1);
  }
  await until(() => !window.__inktv.wet, null, 30000).catch(() => {});
  await wait(4000);
  await shot('g11-drawn');
  // ▶‖ tell my story
  await key('MediaPlayPause');
  await until(() => window.__inktv.mode === 'replay', null, 10000);
  await wait(2500);
  await key('Enter');
  await until(() => window.__inktv.mode === 'feel', null, 10000);
  await wait(1200);
  await key('Enter');
  let told = 0;
  for (;;) {
    await until(() => ['ask', 'tell', 'offer', 'atlas'].includes(window.__inktv.mode) && !(window.__inktv.mode !== 'ask' && window.__inktv.mode !== 'tell' && window.__inktv.guide.running), null, 300000);
    const mode = await tv(() => window.__inktv.mode);
    if (mode === 'ask') {
      const q = await tv(() => ({ question: document.querySelector('#feel .ask').textContent, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent) }));
      await wait(3000);
      q.pictured = await tv(() => window.__inktv.pictured);
      marks.asked.push(q); log('asked', JSON.stringify(q));
      // the first question, or the first whose answers carry a picture of a thing of their world
      if (!marks.shots['g12-asked'] || (q.pictured.length && !marks.askedPictured)) { await shot('g12-asked'); if (q.pictured.length) marks.askedPictured = true; }
      await key('Enter');
      await until((t) => window.__inktv.mode !== 'ask' || document.querySelector('#feel .ask').textContent !== t, q.question, 60000);
      continue;
    }
    if (mode !== 'tell') break;
    await until(() => window.__inktv.tell && window.__inktv.tell.i >= 0, null, 60000);
    const title = await tv(() => window.__inktv.tell.title);
    const lines = [];
    for (;;) {
      const t = await tv(() => window.__inktv.tell && { i: window.__inktv.tell.i, text: window.__inktv.tell.text, title: window.__inktv.tell.title });
      if (!t || t.title !== title) break;
      lines[t.i] = t.text;
      await wait(3600);
      await shot(`g13-told-${told + 1}-${t.i + 1}`);
      await key('ArrowUp');
      await wait(400);
      await key('Enter');
      await until(([i, ti]) => !window.__inktv.tell || window.__inktv.tell.title !== ti || window.__inktv.tell.i !== i, [t.i, title], 20000);
    }
    marks.told.push({ title, lines: lines.filter(Boolean) }); log('told', title, JSON.stringify(lines));
    told++;
  }
  await wait(5500);
  await shot('g14-woken');
  if ((await tv(() => window.__inktv.mode)) === 'offer') {
    for (let k = 0; k < 4; k++) { const c = await tv(() => window.__inktv.offer && window.__inktv.offer.choice); if (/Step inside/.test(c || '')) break; await key('ArrowRight'); }
    if (/Step inside/.test((await tv(() => window.__inktv.offer && window.__inktv.offer.choice)) || '')) {
      await key('Enter');
      await until(() => window.__inktv.mode === 'inside', null, 30000).catch(() => {});
      await wait(5000);
      await shot('g15-step-inside');
      await key('Enter');
      await wait(3000);
      await shot('g16-inside-a-thing');
      await key('Escape');
      await until(() => window.__inktv.mode === 'offer', null, 20000).catch(() => {});
      await wait(1000);
    }
    for (let k = 0; k < 4; k++) { const c = await tv(() => window.__inktv.offer && window.__inktv.offer.choice); if (/end/.test(c || '')) break; await key('ArrowRight'); }
    await key('Enter');
  }
  await home().catch(() => {});
  await wait(9000);
  await shot('g17-home-after');
} catch (err) {
  console.log('stopped:', err.message);
  marks.error = err.message;
} finally {
  await ctx.close();
  server.close();
  guide.close();
}
writeFileSync(join(OUT, 'marks.json'), JSON.stringify(marks, null, 2));
console.log(JSON.stringify({ look: marks.look, place: marks.place && marks.place.place, asked: marks.asked, told: marks.told, error: marks.error || null }, null, 1));

const F = join(TV, 'fonts');
const CARDS = [
  ['01-the-opening', join(OUT, 'g00-opening.png'), 'The first time it opens', 'A child’s drawing draws itself as light, is told back, and wakes up as their world.'],
  ['02-their-world', join(OUT, 'g03-star-world.png'), 'Your world is home', 'Star’s world, in the place its story gave it. Everything drawn in it stands where it first came.'],
  ['03-asked', join(OUT, 'g12-asked.png'), 'Draw with the remote', marks.askedPictured ? 'Answers to choose, no typing; what’s already in Star’s world has its picture.' : 'A new drawing. The storyteller asks what it is, with answers to choose: no typing.'],
  ['04-told', join(OUT, 'g13-told-1-4.png'), 'Hear it told', 'It tells the drawing back as a story, a line at a time, read aloud.'],
  ['05-woken', join(OUT, 'g14-woken.png'), 'It wakes up in its world', 'As the story ends, what’s new comes into Star’s world, and the story can go on.'],
  ['06-previously', join(OUT, 'g05-previously-told.png'), 'Previously in Star’s world', 'Every chapter is kept. Come back another day and it opens like a series.'],
  ['07-walk', join(OUT, 'g07-walk-to-a-thing.png'), 'Walk through your world', 'OK goes to each thing in turn; ▶‖ hears the stories it came in.'],
  ['08-book', join(OUT, 'g09-book-chapter.png'), 'A book of your world', 'Each chapter’s drawing beside its story, paged with the remote.'],
  ['09-worlds-meet', join(OUT, 'g03b-visiting.png'), 'Worlds that meet', 'Moon’s night ferry, visiting Star’s world, to be in Star’s stories. It stays Moon’s.'],
];
const css = `@font-face{font-family:Alegreya;src:url(file://${F}/alegreya-latin.woff2)}@font-face{font-family:Alegreya;font-style:italic;src:url(file://${F}/alegreya-italic-latin.woff2)}@font-face{font-family:'Alegreya Sans';font-weight:700;src:url(file://${F}/alegreya-sans-700-latin.woff2)}
html,body{margin:0;background:#080a17}.card{width:1920px;height:1280px;position:relative;overflow:hidden;background:#080a17}
.card img{display:block;width:1920px;height:1080px}.band{position:absolute;left:0;right:0;top:1080px;height:200px;display:flex;flex-direction:column;justify-content:center;padding:0 88px;box-sizing:border-box;background:linear-gradient(#0d1024,#080a17);border-top:1px solid rgba(231,184,120,.22)}
.k{font:700 22px/1 'Alegreya Sans',sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#e7b878;margin:0 0 16px}.t{font:italic 400 46px/1.25 Alegreya,serif;color:#f6ecd8;margin:0}
.mark{position:absolute;right:88px;top:1080px;height:200px;display:flex;align-items:center;gap:14px;font:italic 400 30px Alegreya,serif;color:rgba(246,236,216,.6)}.mark i{display:block;width:16px;height:16px;background:#b23a2a;border-radius:3px}`;
async function cards() {
const p = await browser.newPage({ viewport: { width: 1920, height: 1280 } });
// the told line that is shown: the last of the first telling
const last = (marks.told[0] && marks.told[0].lines.length) || 4;
CARDS[3][1] = join(OUT, `g13-told-1-${last}.png`);
for (const [name, img, kicker, text] of CARDS) {
  const html = `<!doctype html><meta charset=utf-8><style>${css}</style><div class=card><img src="file://${img}"><div class=band><p class=k>${kicker}</p><p class=t>${text}</p></div><div class=mark><i></i>Inkwash</div></div>`;
  const f = join(OUT, `${name}.html`);
  writeFileSync(f, html);
  await p.goto(`file://${f}`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(CARD_DIR, `${name}.jpg`), type: 'jpeg', quality: 92 });
  console.log(name);
}
// the thumbnail: the opening's end card, cropped to 3:2
const t = join(OUT, '00-thumbnail.html');
writeFileSync(t, `<!doctype html><style>html,body{margin:0}div{width:1920px;height:1280px;background:#080a17 url(file://${join(OUT, 'g00-opening-end.png')}) center/cover no-repeat}</style><div></div>`);
await p.goto(`file://${t}`, { waitUntil: 'load' });
await p.screenshot({ path: join(CARD_DIR, '00-thumbnail.jpg'), type: 'jpeg', quality: 92 });
await p.close();
}

// the cards, once every shot is taken
if (!marks.error) await cards();
await browser.close();
if (marks.error) process.exit(1);
