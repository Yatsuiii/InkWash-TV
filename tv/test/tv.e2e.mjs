// The TV page in Chromium at 1920 x 1080, driven only by remote keys: the arrows and Enter as a
// keyboard sends them, and the media keys and Back as Vega's WebView sends them (key names and
// key codes from its "Supported remote key events" table). The guide service runs on another
// port: its own code (server/lambda.mjs), with a stand-in for Claude, so what the TV sends is
// checked as the real service checks it. A phone opens the pairing page in a second tab. Two
// nights are painted: the second is welcomed back, and recognises the first. Then a child paints
// on the same TV, with a seal and a dream world of their own, and paints what happens next;
// and the demo family opens, apart from the TV's own. Screenshots go to test-shots/.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { serve } from '../scripts/serve.mjs';
import { createHandler } from '../server/lambda.mjs';
import { ARC_SYSTEM, READ_SYSTEM, READINGS_SYSTEM, EXTRACT_SYSTEM } from '../server/guide.mjs';
import { AGENT_SYSTEM } from '../server/agent.mjs';
import { standInAgent } from '../server/agent-standin.mjs';
import { WONDER_SYSTEM, standInWonder } from '../server/worldbuilder.mjs';
import { ILLUSTRATE_SYSTEM, standInIllustrator, standInPaint } from '../server/illustrator.mjs';
import { SCENE_SYSTEM, standInScene } from '../server/scenery.mjs';
import { memoryBudget } from '../server/budget.mjs';
import { standInReel } from '../server/reel.mjs';
import { standInMarble } from '../server/marble.mjs';
import { STANDIN_CLIP } from '../server/dev.mjs';
import { memoryCommons } from '../server/commons-store.mjs';
import { memorySessions } from '../server/phone.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
const shots = fileURLToPath(new URL('../test-shots/', import.meta.url));
mkdirSync(shots, { recursive: true });

const PORT = 5181, GUIDE = 5182;
const server = await serve(PORT);

// The guide service: its own handler, with a stand-in for Claude. The guide's agent is the scripted
// stand-in (server/agent-standin.mjs): it looks, recalls, asks, tells, tells again what was not
// quite, and remembers, through the TV's own tools. The remarks are fixed.
const asked = [];
let meant = [];
const SCENES = ['Someone walked the low shore at dusk.', 'Out on the water, something waited.', 'The tide drew the light away.', 'Then the shore was empty and still.'];
function standInClaude(params) {
  if (Array.isArray(params.system) && params.system[0].text === AGENT_SYSTEM) return standInAgent(params);
  if (String(params.system).startsWith(WONDER_SYSTEM)) return standInWonder(params);
  if (String(params.system).startsWith(ILLUSTRATE_SYSTEM)) return standInIllustrator(params);
  if (String(params.system).startsWith(SCENE_SYSTEM)) return standInScene(params);
  const text = typeof params.messages[0].content === 'string' ? params.messages[0].content : params.messages[0].content.find((c) => c.type === 'text').text;
  if (String(params.system).startsWith(READINGS_SYSTEM)) return { readings: ['a locked gate', 'the night ferry', 'someone waiting'] };
  if (String(params.system).startsWith(ARC_SYSTEM)) {
    const parts = [...text.matchAll(/^(\d+)\. (?:Marks? [^(]+|The whole painting) \(box [^)]*\): ([^.]+)\.(.*)$/gm)];
    meant = parts.map(([, , how]) => (/very heavy/.test(how) ? -2 : /heavier/.test(how) ? -1 : /very light/.test(how) ? 2 : /lighter/.test(how) ? 1 : 0));
    return {
      title: 'The Low Shore',
      lines: parts.map(([, k, , rest], i) => {
        const named = /They said this was ([^.]+?)(?:, from their earlier dreams)?\./.exec(rest), heard = /they said: "([^"]+)"/.exec(rest);
        const said = heard ? `${heard[1].charAt(0).toUpperCase()}${heard[1].slice(1)}` : null;
        if (named) return `${said ? `${said}: ` : 'Where they stopped, '}${named[1]}${/from their earlier dreams/.test(rest) ? ' came back' : ''}, and the sea came in.`;
        if (said) return `${said}, as you said.`;
        return SCENES[i % SCENES.length];
      }),
    };
  }
  if (params.system === READ_SYSTEM) return { weight: meant, stir: meant.map(() => 0) };
  if (params.system === EXTRACT_SYSTEM) {
    const pin = /At line (\d+), they said the mark there was ([^(.]+?)(?: \((e\d+)\))?\.$/m.exec(text);
    if (!pin) return { entities: [], facts: [], resolved: [], conflicts: [] };
    const [, line, name, id] = pin;
    return {
      entities: [id ? { id, lines: [Number(line)] } : { new: name.trim(), kind: 'thing', lines: [Number(line)] }],
      facts: id ? [] : [{ about: name.trim(), text: 'It waited at the end of the pier.', line: Number(line), open: true }],
      resolved: [], conflicts: [],
    };
  }
  return { say: 'Two marks, low and leaning. A shore, and something walking it?' };
}
// A thing as Nova Canvas gives it back with its background removed: a disc on clear, as a PNG
function cutOutPng(W = 64, H = 64) {
  const rows = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - W / 2, y - H / 2) < W * 0.35) rows.set([200, 60, 40, 255], y * (W * 4 + 1) + 1 + x * 4);
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, sum]); };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(W, 0); head.writeUInt32BE(H, 4); head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
const painted = [], varied = new Set();
// walk inside: a small valley under a starry sky, built on the second look
const marbleStandIn = standInMarble({ ready: 2 });
const sessions = memorySessions();
const handler = createHandler({
  claude: { messages: { async create(p) { const r = standInClaude(p); return r.content && r.stop_reason ? r : { content: [{ type: 'text', text: JSON.stringify(r) }] }; } } },
  speak: async () => null, commons: memoryCommons(), sessions,
  // Dream it real: a stand-in picture for every painting; a child's, turned down by the image
  // model's filter, so the painting wakes up at night instead. A thing made real on its own: its
  // own strokes on white, given back; its background removed, the same picture given back, so
  // that the TV cuts its white away. Made again from its picture (IMAGE_VARIATION): that picture,
  // given back, and its background removed as Nova Canvas would, a disc on clear
  paint: async (body) => {
    painted.push(body.taskType);
    if (body.taskType === 'BACKGROUND_REMOVAL') return varied.has(body.backgroundRemovalParams.image) ? cutOutPng() : body.backgroundRemovalParams.image;
    if (body.taskType === 'IMAGE_VARIATION') { const [was] = body.imageVariationParams.images; varied.add(was); return was; }
    // all around it: the panorama, as it comes back (a stand-in picture)
    if (body.taskType === 'OUTPAINTING') return standInPaint();
    if (/for a young child\.$/.test(body.textToImageParams.text)) throw new Error('This request has been blocked by our content filters.');
    if (/on a plain pure white background/.test(body.textToImageParams.text)) return body.textToImageParams.conditionImage;
    return standInPaint();
  },
  budget: memoryBudget({ perDay: 100 }),
  // it comes alive: a few seconds of moving light, made on the second look
  reel: standInReel({ clip: STANDIN_CLIP, ready: 2 }), clips: memoryBudget({ perDay: 10 }),
  marble: marbleStandIn, worlds: memoryBudget({ perDay: 10 }),
});
const guide = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    const path = new URL(req.url, 'http://x').pathname;
    if (req.method === 'POST') {
      const seen = JSON.parse(body || '{}');
      asked.push({ path, young: seen.young, lit: seen.lit, full: path === '/remark' ? seen.image : undefined, text: path === '/speak' ? seen.text : undefined, image: String(seen.image || '').slice(0, 23), strokes: (seen.strokes || []).length, n: seen.n, said: seen.said, felt: seen.felt, feeling: seen.feeling, pinned: seen.pinned, words: seen.words, world: seen.world, known: seen.known, phone: seen.phone, avoid: seen.avoid, seed: seen.seed, session: seen.session, ask: seen.ask, timed: (seen.strokes || []).every((x) => x.ms > 0), messages: seen.messages, brief: seen.brief, look: seen.look, scene: seen.scene, name: seen.name, width: seen.width, height: seen.height, place: seen.place, rule: seen.rule, reference: seen.reference ? String(seen.reference).slice(0, 23) : undefined, mask: seen.mask ? String(seen.mask).slice(0, 22) : undefined });
    }
    // a turn of the guide takes a moment, as a real one would; or, held, until the test lets it go
    // (only the request itself: a page opened from file:// asks first, every time, whether it may)
    if (path === '/agent') { await new Promise((ok) => setTimeout(ok, 500)); if (agentHeld && req.method === 'POST') await agentHeld; }
    const out = await handler({ rawPath: path, headers: req.headers, body, requestContext: { http: { method: req.method } } });
    res.writeHead(out.statusCode, out.headers);
    res.end(out.body);
  });
});
await new Promise((ok) => guide.listen(GUIDE, ok));
let agentHeld = null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const phonePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// the TV app must work without the internet: anything it asks for from outside is a failure
const outside = [];
page.on('request', (r) => { if (!/^(http:\/\/localhost:|blob:|data:|file:)/.test(r.url())) outside.push(r.url()); });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (process.env.E2E_LOG) console.log(`  page: ${m.text().slice(0, 300)}`); });

let n = 0, failed = 0;
async function check(name, fn) {
  n++;
  try { await fn(); console.log(`ok ${n} - ${name}`); }
  catch (e) {
    failed++;
    // where in this file it stopped, and what the TV was doing then
    const at = (e.stack || '').split('\n').find((l) => l.includes('tv.e2e.mjs')) || '';
    const state = await page.evaluate(() => { const t = window.__inktv || {}, a = t.atlas; return JSON.stringify({ mode: t.mode, atlas: a && { pictures: a.pictures, made: a.made, making: a.making, came: a.came } }); }).catch(() => '');
    console.log(`not ok ${n} - ${name}\n  ${e.message}\n  ${at.trim()}\n  ${state}`);
  }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const wait = (ms) => page.waitForTimeout(ms);
// hold on until something on this side is so
const until = async (f, ms = 8000) => { for (const t0 = Date.now(); !f(); await wait(50)) if (Date.now() - t0 > ms) throw new Error(`waited ${ms} ms for ${f}`); };
const tv = (fn, arg) => page.evaluate(fn, arg);
// the page handles keys in its next animation frame; wait for two
const settle = () => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
const pressKey = async (k) => { await page.keyboard.press(k); await settle(); };
const hold = async (k, ms) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await settle(); };
const shot = (name) => page.screenshot({ path: join(shots, name) });
// a key the way Vega's WebView sends it, by name or by code alone
const vegaKey = (key, keyCode) => page.evaluate(([key, keyCode]) => {
  dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true }));
  dispatchEvent(new KeyboardEvent('keyup', { key, keyCode, bubbles: true }));
}, [key, keyCode]).then(settle);
const brush = () => tv(() => window.__inktv.brush);
// hold on until the dial reaches weight `v` (and stir `a`), or say why it didn't: the replay may
// have ended first
async function dialTo(v, a) {
  await page.waitForFunction(([v, a]) => { const l = window.__inktv.line; return window.__inktv.mode !== 'replay' || !l || (l.v <= v && (a == null || l.a >= a)); }, [v, a], { timeout: 10000 });
  const at = await tv(() => ({ mode: window.__inktv.mode, line: window.__inktv.line && { v: window.__inktv.line.v, a: window.__inktv.line.a, t: window.__inktv.line.t, end: window.__inktv.line.end } }));
  assert(at.line && at.line.v <= v && (a == null || at.line.a >= a), `the dial stopped short of ${v}, ${a}: ${JSON.stringify(at)}`);
}
// paint one stroke: place the brush, touch down, let it flow, lift, wait for it to lift off
async function stroke(x, y, heading, ms) {
  await tv(([x, y, h]) => window.__inktv.place(x, y, h), [x, y, heading]);
  await pressKey('Enter');
  await wait(ms);
  await pressKey('Enter');
  await page.waitForFunction(() => !window.__inktv.brush.touching, null, { timeout: 5000 });
}
const inkAt = (x, y, r = 3) => tv(([x, y, r]) => window.__inktv.inkAt(x, y, r), [x, y, r]);
// their world's place: once it is written (as a world's first night ends), they are asked how it
// should look; here it is left as it is
async function placeSettled() {
  await page.waitForFunction(() => !window.__inktv.placeAsking, null, { timeout: 10000 });
  if (await tv(() => !!(window.__inktv.placeLook && !window.__inktv.placeLook.waiting))) await pressKey('Escape');
}
// in their world: what to do, by name (▲ ▼ to it, then OK)
async function inWorld(action) {
  await page.waitForFunction(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas, null, { timeout: 10000 });
  await placeSettled();
  // the first few on screen, the rest under More…
  for (let k = 0; k < 9; k++) {
    const on = await tv(() => window.__inktv.atlas.actions[window.__inktv.atlas.k]);
    if (on === action) break;
    if (on === 'More…' && !(await tv(() => window.__inktv.atlas.actions)).includes(action)) await pressKey('Enter');
    else await pressKey('ArrowDown');
  }
  const on = await tv(() => window.__inktv.atlas.actions[window.__inktv.atlas.k]);
  if (on !== action) throw new Error(`no "${action}" in ${JSON.stringify(await tv(() => window.__inktv.atlas.actions))}`);
  await pressKey('Enter');
}
// the guide's conversation, as the TV sent it: the first turn's sections, and the tool results
const agentTurns = () => asked.filter((a) => a.path === '/agent');
// how bright a picture is, 0 to 1 on average: ink on paper is nearly white, light on the night dark
const brightness = (url) => page.evaluate(async (u) => {
  const i = new Image(); i.src = u; await i.decode();
  const c = document.createElement('canvas'); c.width = 64; c.height = 40;
  const g = c.getContext('2d'); g.drawImage(i, 0, 0, 64, 40);
  const d = g.getImageData(0, 0, 64, 40).data; let s = 0;
  for (let k = 0; k < d.length; k += 4) s += (d[k] + d[k + 1] + d[k + 2]) / 3;
  return s / (d.length / 4) / 255;
}, url);
const section = (text, name) => JSON.parse(new RegExp(`^${name}\\b[^\\n]*\\n(.+)$`, 'm').exec(text)[1]);
const firstText = (m) => m[0].content.find((b) => b.type === 'text').text;
const results = (m) => m.filter((x) => x.role === 'user' && Array.isArray(x.content)).flatMap((x) => x.content).filter((b) => b.type === 'tool_result');
// a stroke pressed in until it stops and pools: touch down, hold ▼, lift
async function pooled(x, y, heading, during = async () => {}) {
  await tv(([x, y, h]) => window.__inktv.place(x, y, h), [x, y, heading]);
  await pressKey('Enter');
  await wait(300);
  await during();
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => window.__inktv.brush.pressure > 0.85, null, { timeout: 3000 });
  // held until the brush has been still a good while (by its own clock: slow frames count less), and
  // for 2.2 s at least
  const t0 = Date.now();
  await page.waitForFunction(() => { const s = window.__inktv.strokes; return s.length > 0 && s[s.length - 1].still >= 1.3; }, null, { timeout: 10000, polling: 100 });
  await wait(Math.max(0, 2200 - (Date.now() - t0)));
  await page.keyboard.up('ArrowDown');
  await pressKey('Enter');
  await page.waitForFunction(() => !window.__inktv.brush.touching, null, { timeout: 5000 });
}

try {
  // TV_URL tests the packaged single file instead, e.g. file:///…/dist/inkwash-tv.html
  const base = process.env.TV_URL || `http://localhost:${PORT}/`;
  await page.goto(`${base}?guide=http://localhost:${GUIDE}&pace=fast&quiet=0`);
  await page.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });

  await check('a new TV: the first painter chooses a seal, and who the guide is talking to', async () => {
    const w = await tv(() => ({ mode: window.__inktv.mode, who: window.__inktv.who, title: document.querySelector('#who h2').textContent, tiles: [...document.querySelectorAll('#who .tile .name')].map((t) => t.textContent), on: document.querySelector('#who .tile.on .name').textContent, pair: document.querySelector('#pair').hidden }));
    assert(w.mode === 'who' && w.who.step === 'seal' && w.title === 'Welcome. Choose your seal', JSON.stringify(w));
    assert(w.tiles.length === 8 && w.on === 'Moon' && w.pair, JSON.stringify(w));
    await shot('tv-0a-choose-your-seal.png');
    await pressKey('Enter');
    const f = await tv(() => ({ step: window.__inktv.who.step, title: document.querySelector('#who h2').textContent, chips: [...document.querySelectorAll('#who .chip')].map((c) => c.textContent), on: document.querySelector('#who .chip.on').textContent }));
    assert(f.step === 'for' && f.title === 'Who is the storyteller talking to?' && JSON.stringify(f.chips) === '["A grown-up","A child"]' && f.on === 'A grown-up', JSON.stringify(f));
    await pressKey('Enter');
    const p = await tv(() => ({ mode: window.__inktv.mode, who: window.__inktv.who, seal: document.querySelector('#painter .name').textContent, family: JSON.parse(localStorage.getItem('inkwash.family')), world: window.__inktv.atlas, dishes: getComputedStyle(document.querySelector('#dishes')).opacity }));
    assert(p.mode === 'atlas' && p.who.painter.name === 'Moon' && !p.who.painter.young && p.seal === 'Moon', JSON.stringify(p));
    assert(p.family.painters.length === 1 && p.family.painters[0].first === true, JSON.stringify(p.family));
    // their world, empty, opens first; the ink waits on the felt until there is painting to do
    assert(p.world.title === 'Moon’s world' && /^Hello, Moon\. Nothing in it yet\./.test(p.world.about) && JSON.stringify(p.world.actions) === '["Draw the first thing in it"]' && p.dishes === '0', JSON.stringify(p));
    await shot('tv-0b-an-empty-world.png');
    await inWorld('Draw the first thing in it');
    assert((await tv(() => window.__inktv.mode)) === 'paint', 'to the paper');
  });

  await check('a clean sheet of paper, the brush lifted, dense ink chosen, and the guide says how to begin', async () => {
    const s = await tv(() => ({ mode: window.__inktv.mode, ink: window.__inktv.ink, b: window.__inktv.brush, doc: document.title, dish: document.querySelector('#dishes li.on').dataset.ink, say: document.querySelector('#say .text').textContent, hints: document.querySelector('#hints').textContent }));
    assert(s.mode === 'paint' && s.b.down === false && s.b.strokes === 0, JSON.stringify(s));
    assert(s.ink === 'webgl2', `ink engine: ${s.ink}`);
    assert(s.doc === 'Inkwash: draw into your world', s.doc);
    assert(s.dish === 'dense' && s.b.ink === 'dense', s.dish);
    assert(/^Draw something into your world: a place, someone who lives there, or something that happens\. Press OK to start drawing/.test(s.say), s.say);
    // where they are tonight, always in view
    const steps = await tv(() => window.__inktv.steps);
    assert(JSON.stringify(steps) === '["now","","",""]', `the schedule: ${JSON.stringify(steps)}`);
    assert(!/Welcome back/.test(s.say), 'nothing to welcome back to on the first night');
    assert(/draw/.test(s.hints) && /tell my story/.test(s.hints), s.hints);
    await page.waitForFunction(() => window.__inktv.phone && window.__inktv.phone.code && !document.querySelector('#pair').hidden, null, { timeout: 5000 });
    const pair = await tv(() => ({ phone: window.__inktv.phone, qr: document.querySelector('#pair .qr').innerHTML, code: document.querySelector('#pair .code').textContent }));
    assert(/^[A-Z2-9]{6}$/.test(pair.phone.code) && pair.phone.url === `http://localhost:${GUIDE}/phone?c=${pair.phone.code}`, JSON.stringify(pair.phone));
    assert(/^<svg/.test(pair.qr) && pair.code.replace(/ /g, '') === pair.phone.code, 'the code, as a QR and in letters');
    const fonts = await tv(() => ['600 46px Alegreya', 'italic 42px Alegreya', '500 25px "Alegreya Sans"', '700 19px "Alegreya Sans"'].map((f) => document.fonts.check(f)));
    assert(fonts.every(Boolean), `bundled fonts not all loaded: ${fonts}`);
    assert((await inkAt(800, 500, 20)) < 0.08, 'the paper is clean');
    // the paper comes out of the night as the seals go
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#sheet')).opacity === '1', null, { timeout: 4000 });
    await shot('tv-1-ready.png');
  });

  await check('lifted, a held arrow moves the brush and leaves no ink', async () => {
    // let the page settle into drawing frames first: a hold during the first, slow frames (shaders
    // compiling in a software renderer) moves the brush only a frame's worth
    await page.evaluate(() => new Promise((ok) => { let n = 0; const f = () => (++n >= 20 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const before = await brush();
    // held until it has moved, not for a set time: a hold counts only on the frames that see it
    await page.keyboard.down('ArrowRight');
    const moved = await page.waitForFunction((x0) => window.__inktv.brush.x > x0 + 60, before.x, { timeout: 5000 }).then(() => true, () => false);
    await page.keyboard.up('ArrowRight');
    await settle();
    const after = await brush();
    assert(moved && after.x > before.x + 60, `${before.x} -> ${after.x}`);
    assert(after.strokes === 0, 'no ink while lifted');
  });

  await check('the phone opens the page the QR points to, and what they type there reaches the TV, kept with the stroke being painted', async () => {
    const { url } = await tv(() => window.__inktv.phone);
    await phonePage.goto(url);
    await phonePage.waitForFunction(() => /Connected to your TV/.test(document.querySelector('#status').textContent), null, { timeout: 8000 });
    await page.waitForFunction(() => window.__inktv.phone.listening, null, { timeout: 8000 });
    // the label follows on the next frame or so
    await page.waitForFunction(() => document.querySelector('#phone .label').textContent === 'Your phone is listening', null, { timeout: 3000 }).catch(() => {});
    const label = await tv(() => document.querySelector('#phone .label').textContent);
    assert(label === 'Your phone is listening', label);
    await phonePage.screenshot({ path: join(shots, 'phone-1-paired.png') });
  });

  await check('OK touches the brush down; it flows on by itself and leaves ink, and the paper beside it stays clean', async () => {
    await stroke(300, 650, 0, 1500);
    assert(await tv(() => document.querySelector('#pair').hidden), 'the pairing card is gone once they paint');
    const s = (await tv(() => window.__inktv.strokes))[0];
    assert(s && s.length > 120, JSON.stringify(s));
    const mid = Math.round((s.from[0] + s.to[0]) / 2);
    const on = await inkAt(mid, s.from[1], 2), off = await inkAt(mid, s.from[1] - 60, 3);
    assert(on > 0.5, `ink on the stroke: ${on}`);
    assert(off < 0.08, `paper beside it: ${off}`);
    await shot('tv-2-first-stroke.png');
  });

  await check('▼ pressed and held: the brush slows, stops, and the ink pools and spreads into the paper', async () => {
    // as they paint it, they tell the guide on the phone
    await pooled(1100, 700, Math.PI, async () => {
      await phonePage.fill('#text', 'a long pier, and a boat waiting at the end of it');
      await phonePage.click('#send');
    });
    const s = (await tv(() => window.__inktv.strokes))[1];
    assert(s.pools.length >= 1, `a pool is noted: ${JSON.stringify(s)}`);
    const [px, py] = s.pools[0];
    await wait(800);
    const centre = await inkAt(px, py, 3), out = await inkAt(px, py - 24, 3);
    assert(centre > 0.6 && out > 0.15, `the pool: centre ${centre}, 24 units out ${out}`);
    await page.waitForFunction(() => window.__inktv.words.length === 1, null, { timeout: 5000 });
    const w = await tv(() => ({ words: window.__inktv.words, heard: document.querySelector('#heard .text').textContent }));
    assert(w.words[0].n === 2 && w.words[0].text === 'a long pier, and a boat waiting at the end of it', JSON.stringify(w.words));
    assert(/a long pier/.test(w.heard), w.heard);
    await shot('tv-2b-heard-from-the-phone.png');
    const sent = await phonePage.evaluate(() => [...document.querySelectorAll('#sent li')].map((li) => li.textContent));
    assert(sent[0] === 'a long pier, and a boat waiting at the end of it', JSON.stringify(sent));
  });

  await check('fast-forward (as Vega sends it) dips into light ink: a paler stroke than dense', async () => {
    await vegaKey('MediaFastForward', 228);
    const dish = await tv(() => document.querySelector('#dishes li.on').dataset.ink);
    assert(dish === 'light', dish);
    await stroke(300, 850, 0, 1200);
    const all = await tv(() => window.__inktv.strokes);
    const s = all[2], first = all[0];
    assert(s.ink === 'light', JSON.stringify(s));
    const light = await inkAt(Math.round((s.from[0] + s.to[0]) / 2), s.from[1], 2);
    const dense = await inkAt(Math.round((first.from[0] + first.to[0]) / 2), first.from[1], 2);
    assert(light > 0.08 && light < dense * 0.75, `light ${light} against dense ${dense}`);
    await vegaKey('MediaRewind', 227);
    assert((await tv(() => window.__inktv.brush.ink)) === 'dense', 'rewind goes back to dense');
    await shot('tv-3-three-strokes.png');
  });

  await check('Back (as Vega sends it) washes out the last stroke, and only that one', async () => {
    const all = await tv(() => window.__inktv.strokes);
    const s = all[2], first = all[0];
    await vegaKey('GoBack', 27);
    await wait(200);
    assert((await brush()).strokes === 2, 'two strokes left');
    const gone = await inkAt(Math.round((s.from[0] + s.to[0]) / 2), s.from[1], 2);
    const kept = await inkAt(Math.round((first.from[0] + first.to[0]) / 2), first.from[1], 2);
    assert(gone < 0.08 && kept > 0.5, `washed out ${gone}, kept ${kept}`);
  });

  await check('after a pause, the guide looks at the painting and says something about it', async () => {
    await page.waitForFunction(() => /shore/.test(document.querySelector('#say .text').textContent), null, { timeout: 15000 });
    const r = asked.find((a) => a.path === '/remark');
    assert(r && r.image.startsWith('data:image/jpeg;base64,') && r.strokes === 2, JSON.stringify(r));
    assert(r.phone === true && r.words.length === 1 && r.words[0].n === 2, `the guide knows what they said: ${JSON.stringify(r.words)}`);
    // drawn into their world, it sees what they see: light on the night, not ink on paper
    const b = await brightness(r.full);
    assert(r.lit === true && b < 0.3, `the guide is shown it as light: lit ${r.lit}, brightness ${b.toFixed(2)}`);
    // and its question goes to the phone
    await phonePage.waitForFunction(() => /shore/.test(document.querySelector('#ask').textContent), null, { timeout: 8000 });
    await shot('tv-4-guide-remark.png');
  });

  await check('play/pause by key code alone brings the painting back, stroke by stroke, under a line to mark', async () => {
    // at half speed: the test reacts to what it sees more slowly than a person when the machine is busy
    await tv(() => window.__inktv.replayRate(0.5));
    await vegaKey('Unidentified', 179);
    await page.waitForFunction(() => window.__inktv.mode === 'replay', null, { timeout: 5000 });
    const r = await tv(() => ({ line: window.__inktv.line, hints: document.querySelector('#hints').textContent, stage: document.querySelector('#stage').className }));
    assert(/replaying/.test(r.stage), 'the sheet draws back to make room for the line');
    assert(/lighter · heavier/.test(r.hints) && /calmer · more stirred/.test(r.hints) && /skip/.test(r.hints), r.hints);
    assert(r.line && r.line.v === 0 && !r.line.pressed, JSON.stringify(r.line));
    await page.waitForFunction(() => window.__inktv.line && window.__inktv.line.shown === 0, null, { timeout: 5000 });
    await shot('tv-5a-feel-it-again.png');
  });

  await check('holding ▼ and ▶ as the second stroke comes back marks it heavier and stirred; the guide looks closer, then asks', async () => {
    // the second stroke comes back about eight seconds in, at half speed; a busy machine draws it later
    await page.waitForFunction(() => window.__inktv.line && window.__inktv.line.shown === 1, null, { timeout: 20000 });
    // held as it comes back until the dial is nearly at its ends, so its share of the line is
    // clearly marked. Until the page says so, not for a set time
    await page.keyboard.down('ArrowDown');
    await page.keyboard.down('ArrowRight');
    await dialTo(-0.45, 0.45);
    await shot('tv-5b-marking-the-line.png');
    await dialTo(-0.9, 0.9);
    // the night around the paper feels it: darker, and wilder
    const sky = await tv(() => window.__inktv.scene);
    assert(sky.dreaming && sky.sky && sky.mood.v < -0.3 && sky.mood.a > 0.3, `the sky, as marked: ${JSON.stringify(sky)}`);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('ArrowDown');
    await page.waitForFunction(() => /Looking closer at mark 2/.test(document.querySelector('#working .text').textContent) && !document.querySelector('#working').hidden, null, { timeout: 15000 });
    await shot('tv-5c-the-guide-looks.png');
    await page.waitForFunction(() => window.__inktv.mode === 'ask', null, { timeout: 20000 });
    const a = await tv(() => ({ ask: window.__inktv.ask, guide: window.__inktv.guide, q: document.querySelector('#feel .ask').textContent, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent), spot: document.querySelector('#spot').className, hints: document.querySelector('#hints').textContent }));
    assert(a.q === 'What was this, in your dream?' && a.ask.n === 2, JSON.stringify(a));
    assert(JSON.stringify(a.chips) === JSON.stringify(['a locked gate', 'the night ferry', 'someone waiting', 'Skip']), JSON.stringify(a.chips));
    assert(/on/.test(a.spot) && /answer/.test(a.hints) && /skip/.test(a.hints), JSON.stringify(a));
    // drawn into their world, the light itself dims round the mark it asks about
    const lit = await tv(() => window.__inktv.focused);
    assert(lit && lit[0] > 0.5 && lit[2] < 1, `the mark asked about is lit: ${JSON.stringify(lit)}`);
    // what the guide was given: the painting twice, and everything the TV knows, as data. A head
    // start: it began as the painting came back, before it was marked, and how it felt and where it
    // turned came next, after what its first turn found
    const [first, second, third] = agentTurns();
    const m = first.messages;
    assert(m.length === 1 && m[0].content.filter((b) => b.type === 'image').length === 2, 'the painting, as it is and numbered');
    const shown = m[0].content.filter((b) => b.type === 'image').map((b) => `data:${b.source.media_type};base64,${b.source.data}`);
    const lights = await Promise.all(shown.map(brightness));
    assert(first.lit === true && lights.every((x) => x < 0.3) && /as they see it, drawn into their world as light/.test(firstText(m)), `the storyteller is shown it as light: ${first.lit}, ${lights.map((x) => x.toFixed(2))}`);
    assert(/^FEELING \(still coming/m.test(firstText(m)) && !/^TURN\b/m.test(firstText(m)), 'its first turn went before it was marked');
    assert(second.messages[1].content.some((b) => b.type === 'tool_use' && b.name === 'recall'), 'meanwhile, it remembered their world');
    const later = second.messages[2].content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    assert(second.messages[2].content[0].type === 'tool_result' && /^They have marked it now/.test(later), 'how it felt, after what it found');
    const felt = section(later, 'FEELING');
    assert(felt[1].n === 2 && felt[1].weight < -0.3 && felt[1].stir > 0.3, JSON.stringify(felt));
    assert(section(later, 'TURN').stroke === 2, 'where it turned');
    assert(section(firstText(m), 'THEIR WORDS')[0].n === 2, 'their words, with the stroke');
    assert(section(firstText(m), 'THEIR WORLD').nights_before === 0);
    assert(section(firstText(m), 'WASHED OUT').length === 1, 'what was washed out, too');
    // what only the brush knows: the stroke held until it pooled; nothing learned yet of their taste
    const painted = section(firstText(m), 'HOW THEY PAINTED IT');
    assert(painted.notable.some((g) => g.stroke === 2 && g.kind === 'held'), JSON.stringify(painted));
    assert(section(firstText(m), 'WHAT THEY KEEP').lines_answered === 0);
    // then it looked closer where it turned: a real picture, drawn on the TV
    const look = results(third.messages).find((b) => Array.isArray(b.content));
    assert(look.content[0].type === 'image' && look.content[0].source.data.length > 4000 && /marks 2 lit, close up/.test(look.content[1].text), JSON.stringify(look).slice(0, 300));
    assert(a.guide.running && a.guide.step === 'Looking closer at mark 2', JSON.stringify(a.guide));
    await pressKey('ArrowRight');
    assert((await tv(() => window.__inktv.ask.choice)) === 'the night ferry');
    await wait(300);
    await shot('tv-5d-the-guide-asks.png');
  });

  let heardOther = null; // the other way to say a line, heard on "not quite", for night two to find kept
  await check('the guide tells the dream from their words and their answer, said on the phone; ▼ hears a line\'s other way at once, and ▲ says it rings true', async () => {
    // answered on the phone: their words come first among the answers, lit, and are taken
    await phonePage.fill('#text', 'the night ferry');
    await phonePage.click('#send');
    await page.waitForFunction(() => window.__inktv.ask && window.__inktv.ask.choice === '“the night ferry”', null, { timeout: 8000 });
    await page.waitForFunction(() => window.__inktv.tell && window.__inktv.tell.i === 0, null, { timeout: 15000 });
    const answered = results(agentTurns().at(-1).messages).find((b) => /"answer"/.test(b.content));
    assert(JSON.parse(answered.content).answer === 'the night ferry' && JSON.parse(answered.content).by === 'phone', JSON.stringify(answered));
    const t = await tv(() => ({ mode: window.__inktv.mode, tell: window.__inktv.tell, title: document.querySelector('#tell .title').textContent, seal: document.querySelector('#seal').textContent, spot: document.querySelector('#spot').className, line: document.querySelector('#tell .line').innerHTML, stage: document.querySelector('#stage').className, hints: document.querySelector('#hints').textContent }));
    assert(t.mode === 'tell' && t.tell.n === 2, JSON.stringify(t));
    assert(t.title === 'The Low Shore' && /low shore at dusk/.test(t.tell.text), JSON.stringify(t));
    assert(t.seal === 'The Low Shore' && /on/.test(t.spot) && !/replaying/.test(t.stage), JSON.stringify(t));
    assert(/<svg/.test(t.line) && /polyline/.test(t.line) && /<rect/.test(t.line), 'their line, small, with the part being told lit');
    assert(/that's it/.test(t.hints) && /not quite/.test(t.hints), t.hints);
    // told in the night: the camera in on the line's part of the painting, which comes alive
    await page.waitForFunction(() => window.__inktv.scene.alive, null, { timeout: 8000 });
    const sc = await tv(() => window.__inktv.scene);
    assert(sc.dreaming && sc.telling && sc.sky && sc.shot && sc.shot.s >= 0.86 && ['rise', 'glow', 'swim', 'drift', 'twinkle', 'settle', 'breathe'].includes(sc.alive.motion), JSON.stringify(sc));
    await pressKey('ArrowUp');
    assert((await tv(() => document.querySelector('#tell .react').textContent)) === 'That’s it');
    await wait(900);
    await shot('tv-5-telling.png');
    await pressKey('Enter');
    const second = await tv(() => window.__inktv.tell);
    assert(second.i === 1 && /the night ferry/.test(second.text) && /A long pier, and a boat waiting/.test(second.text), `their words, and what they named: ${JSON.stringify(second)}`);
    // not quite, and the storyteller's other way to say it is heard at once, in its place
    await pressKey('ArrowDown');
    const other = await tv(() => ({ tell: window.__inktv.tell, react: document.querySelector('#tell .react').textContent }));
    assert(other.tell.i === 1 && other.tell.text !== second.text && /the night ferry/.test(other.tell.text) && /A long pier, and a boat waiting/.test(other.tell.text) && other.react === '', JSON.stringify({ second, other }));
    heardOther = other.tell.text;
    await pressKey('ArrowUp');
    assert(JSON.stringify(await tv(() => window.__inktv.reactions)) === JSON.stringify(['yes', 'yes']));
  });

  let keptNight = null; // what the step below hands to the one after it
  await check('at the end, the storyteller keeps the night in their world, on the TV, with the painting, says what it kept, and asks what happens next', async () => {
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'offer' && !window.__inktv.guide.running, null, { timeout: 8000 });
    // what the night kept, as a card flying in: the night ferry, new in their world
    await page.waitForFunction(() => window.__inktv.collected.showing.length > 0, null, { timeout: 6000 });
    const col = await tv(() => window.__inktv.collected);
    assert(col.last.length === 1 && col.last[0].name === 'the night ferry' && col.last[0].fresh && col.showing[0] === 'The night ferry', JSON.stringify(col));
    // new in their world, it comes to life on its card: its ink shimmers while it is made from its
    // strokes, then its own picture springs out of it, and the badge says so
    await page.waitForFunction(() => window.__inktv.collected.last[0].alive === 'yes', null, { timeout: 15000 });
    const alive = await tv(() => ({ badge: document.querySelector('#collected .card .badge').textContent, pic: !!document.querySelector('#collected .card .alive-pic'), coming: !!document.querySelector('#collected .card .alive') }));
    assert(alive.badge === 'It came to life!' && alive.pic && !alive.coming, JSON.stringify(alive));
    const lifeAsked = asked.filter((a) => a.path === '/thing');
    assert(lifeAsked.length === 1 && lifeAsked[0].name === 'the night ferry' && !lifeAsked[0].young, JSON.stringify(lifeAsked));
    await wait(1000);
    await shot('tv-6b-a-card-for-the-ferry.png');
    const w = await tv(() => ({ world: window.__inktv.world, say: document.querySelector('#say .text').textContent, guide: window.__inktv.guide.last }));
    assert(w.world.nights === 1, JSON.stringify(w.world));
    assert(w.say === 'New in your world: the night ferry.', w.say);
    const offer = await tv(() => ({ ask: document.querySelector('#feel .ask').textContent, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent), offer: window.__inktv.offer, hints: document.querySelector('#hints').textContent }));
    assert(offer.ask === 'What happens next?' && JSON.stringify(offer.chips) === '["Draw what happens next","Step inside","Watch it come alive","Walk inside","See all around it","Paint it again","That’s the end"]' && offer.offer.i === 0 && /that’s the end/.test(offer.hints), JSON.stringify(offer));
    // made real: the Illustrator was asked once, as the story began, with their ink and the story;
    // told to the end, the ink bloomed into the picture
    const reals = asked.filter((a) => a.path === '/real');
    assert(reals.length === 1 && reals[0].image === 'data:image/jpeg;base64,' && reals[0].look === 'real' && !reals[0].young, JSON.stringify(reals.map((r) => ({ ...r, messages: undefined }))));
    assert(reals[0].brief.title === 'The Low Shore' && reals[0].brief.lines.length === 2 && reals[0].brief.lines.every((l) => l.text && l.at), JSON.stringify(reals[0].brief));
    await page.waitForFunction(() => window.__inktv.real.shown, null, { timeout: 8000 });
    assert((await tv(() => window.__inktv.real.src)) === 'data:image/png;base64,', 'the picture, over the ink');
    await wait(4800);
    await shot('tv-6a-what-happens-next.png');
    keptNight = { w, told: results(agentTurns().at(-2).messages).find((b) => /"reactions"/.test(b.content)) };
  });

  await check('it comes alive: chosen, it is asked for with the picture made real and its scene; while it is made the choice says so; made, it plays over the picture and is kept with the night', async () => {
    await pressKey('ArrowRight');
    await pressKey('ArrowRight');
    assert((await tv(() => window.__inktv.offer.choice)) === 'Watch it come alive', 'the third choice');
    // offered because this TV can play the kind of video the server said its clips are; one it
    // can't play is never offered
    const playable = await tv(() => ({ said: window.__inktv.real.alive, it: window.__inktv.canPlay(window.__inktv.real.alive), not: window.__inktv.canPlay('video/x-nothing-plays-this') }));
    assert(playable.said === 'video/webm' && playable.it && !playable.not, JSON.stringify(playable));
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.alive.status === 'making' && window.__inktv.offer.choice === 'Coming to life…', null, { timeout: 5000 });
    const made = asked.filter((a) => a.path === '/alive');
    assert(made.length === 1 && made[0].image === 'data:image/jpeg;base64,' && made[0].young === false && /ferry|shore|water/i.test(made[0].scene || ''), JSON.stringify(made));
    await page.waitForFunction(() => window.__inktv.alive.status === 'done' && window.__inktv.alive.shown && window.__inktv.alive.playing, null, { timeout: 30000 });
    assert((await tv(() => window.__inktv.offer.choice)) === 'Watch it again', 'and it can be watched again');
    const kept = await tv(() => window.__inktv.keptAlive(1));
    assert(kept && kept.type === 'video/webm' && kept.size > 10000, `kept with the night's painting: ${JSON.stringify(kept)}`);
    await wait(1500);
    await shot('tv-6c-it-comes-alive.png');
    await page.waitForFunction(() => window.__inktv.alive.time > 2, null, { timeout: 8000 });
    // back to the first choice
    await pressKey('ArrowLeft');
    await pressKey('ArrowLeft');
    assert((await tv(() => window.__inktv.offer.i)) === 0, 'the first choice');
  });

  await check('walk inside: chosen, the picture made real is built into a world (World Labs, standing in), the choice saying so meanwhile; built, its file is kept with the night, and they walk through it with the remote; Back is the picture again', async () => {
    for (let k = 0; k < 5 && (await tv(() => window.__inktv.offer.choice)) !== 'Walk inside'; k++) await pressKey('ArrowRight');
    assert((await tv(() => window.__inktv.offer.choice)) === 'Walk inside', JSON.stringify(await tv(() => window.__inktv.offer)));
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.realWalk.status === 'making' && window.__inktv.offer.choice === 'Building your world…', null, { timeout: 5000 });
    const sent = asked.filter((a) => a.path === '/world');
    assert(sent.length === 1 && sent[0].image === 'data:image/jpeg;base64,' && sent[0].young === false && /ferry|shore|water/i.test(sent[0].scene || ''), JSON.stringify(sent.map((x) => ({ image: x.image, young: x.young, scene: x.scene }))));
    await page.waitForFunction(() => window.__inktv.realWalk.status === 'done' && window.__inktv.offer.choice === 'Walk inside', null, { timeout: 30000 });
    const kept = await tv(() => window.__inktv.keptWorld(1));
    assert(kept && kept.type === 'ply' && kept.size > 100000, `kept with the night's painting: ${JSON.stringify(kept)}`);
    assert(marbleStandIn.asked.length === 1 && marbleStandIn.asked[0].model === 'marble-1.0-draft' && marbleStandIn.asked[0].permission.public === false, 'a quick world, private to the guide');
    assert(asked.filter((a) => a.path === '/world/file').length === 1, 'its file fetched once, through the guide');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'realwalk' && window.__inktv.realWalk.frames > 5, null, { timeout: 60000 });
    const hints = await tv(() => document.querySelector('#hints').textContent);
    assert(/walk/.test(hints) && /turn/.test(hints) && /back to your picture/.test(hints), hints);
    await wait(1000);
    await shot('tv-6d-walk-inside.png');
    for (let k = 0; k < 4; k++) await pressKey('ArrowUp');
    await pressKey('ArrowLeft');
    await wait(1500);
    const walked = await tv(() => window.__inktv.realWalk.at);
    assert(walked.z < -1.5 && walked.yaw > 0.2, `walked forward and turned: ${JSON.stringify(walked)}`);
    await pressKey('Escape');
    await page.waitForFunction(() => window.__inktv.mode === 'offer' && !window.__inktv.realWalk.open, null, { timeout: 5000 });
    assert((await tv(() => window.__inktv.offer.i)) === 0 && (await tv(() => window.__inktv.offer.choice)) === 'Draw what happens next', 'back at what happens next');
    assert(asked.filter((a) => a.path === '/world').length === 1, 'walking it again costs nothing');
  });

  // the picture painted again, not counted with each night's first
  const paintedAgain = new Set();
  await check('all around it, and painted again: the picture made real widened into a panorama they look across with ◀ ▶, kept with the night; painted again as a painting, and back to the first with OK', async () => {
    const choose = async (name) => {
      for (let k = 0; k < 9 && (await tv(() => window.__inktv.offer.choice)) !== name; k++) await pressKey('ArrowRight');
      assert((await tv(() => window.__inktv.offer.choice)) === name, `${name}: ${JSON.stringify(await tv(() => window.__inktv.offer))}`);
    };
    await choose('See all around it');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.wide.open && window.__inktv.wide.status === 'done', null, { timeout: 15000 });
    const wide = asked.filter((a) => a.path === '/wide');
    assert(wide.length === 1 && wide[0].image === 'data:image/jpeg;base64,' && wide[0].mask === 'data:image/png;base64,' && wide[0].young === false && /ferry|shore|water/i.test(wide[0].scene || ''), JSON.stringify(wide));
    const hints = await tv(() => document.querySelector('#hints').textContent);
    assert(/look around/.test(hints) && /back to your picture/.test(hints), hints);
    const x0 = await tv(() => window.__inktv.wide.x);
    await hold('ArrowRight', 900);
    const x1 = await tv(() => window.__inktv.wide.x);
    assert(x1 > x0 + 0.1, `looked to the right: ${x0} to ${x1}`);
    await shot('tv-6e-all-around-it.png');
    await pressKey('Escape');
    await page.waitForFunction(() => window.__inktv.mode === 'offer' && !window.__inktv.wide.shown, null, { timeout: 5000 });
    const kept = async (ok) => { for (const t0 = Date.now(); !ok(await tv(() => window.__inktv.keptPicture(1))); await wait(100)) if (Date.now() - t0 > 8000) throw new Error(`kept with the night: ${JSON.stringify(await tv(() => window.__inktv.keptPicture(1)))}`); };
    await kept((p) => p && p.wide === 'data:image/jpeg;base64,');
    // looked across again, for nothing
    await choose('See all around it');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.wide.open, null, { timeout: 5000 });
    await pressKey('Escape');
    assert(asked.filter((a) => a.path === '/wide').length === 1, 'seen again for free');
    // painted again: as a painting, a look not tried yet; shown as it comes, and kept
    const before = asked.filter((a) => a.path === '/real').length;
    await choose('Paint it again');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.versions && window.__inktv.versions.n === 2, null, { timeout: 15000 });
    const again = asked.filter((a) => a.path === '/real').slice(before);
    again.forEach((a) => paintedAgain.add(a));
    assert(again.length === 1 && again[0].look === 'painting' && again[0].image === 'data:image/jpeg;base64,', JSON.stringify(again.map((a) => a.look)));
    await page.waitForFunction(() => window.__inktv.real.shown, null, { timeout: 8000 });
    const v = await tv(() => ({ versions: window.__inktv.versions, choice: window.__inktv.offer.choice }));
    assert(v.versions.k === 1 && JSON.stringify(v.versions.looks) === '["real","painting"]' && v.choice === 'Picture 2 of 2', JSON.stringify(v));
    // OK on it: the first again, with its panorama, kept with the night
    await pressKey('Enter');
    assert(JSON.stringify(await tv(() => [window.__inktv.versions.k, window.__inktv.offer.choice])) === '[0,"Picture 1 of 2"]', 'back to the first');
    await kept((p) => p && p.wide && p.real > 0);
    // and back to the first choice, for what comes next
    for (let k = 0; k < 9 && (await tv(() => window.__inktv.offer.i)) !== 0; k++) await pressKey('ArrowRight');
    assert((await tv(() => window.__inktv.offer.choice)) === 'Draw what happens next');
  });

  await check('step inside: the painting opens into a world, each thing they painted standing up from the paper; OK goes to the night ferry and its line; ◀ ▶ turn the world round; Back folds it back', async () => {
    await pressKey('ArrowRight');
    assert((await tv(() => window.__inktv.offer.choice)) === 'Step inside', 'the second choice');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'inside' && window.__inktv.inside && window.__inktv.inside.phase === 'open', null, { timeout: 15000 });
    // drawn on the GPU, in one canvas; a thing stands as its own ink in light: none at its light's
    // corner, no card of paper
    const open = await tv(() => ({ inside: window.__inktv.inside, probe: window.__inktv.insideProbe, hints: document.querySelector('#hints').textContent, sheet: getComputedStyle(document.querySelector('#sheet')).opacity, canvas: document.querySelectorAll('#inside canvas.glow').length }));
    const names = open.inside.pieces.map((p) => p.name);
    assert(names[0] === 'the night ferry' && open.inside.pieces[0].strokes.includes(2) && open.inside.pieces[0].float === 0, `the ferry stands up on the ground, from its own stroke: ${JSON.stringify(open.inside.pieces)}`);
    assert(open.inside.pieces[0].made, 'come to life on its card, it stands there as its own picture');
    assert(open.inside.tilt === 78 && open.sheet === '0' && open.inside.air === 1 && open.inside.placed, `the ground tipped back, the flat sheet gone, their world's place all round: ${JSON.stringify(open)}`);
    const drawn = open.inside.drawn;
    // in the place written for their world as its story started (the stand-in Set Designer's
    // meadow): each thing stands there solid, its shadow on the grass, which holds no reflection
    assert(open.canvas === 1 && open.probe && open.probe[3] === 0 && drawn.pieces === open.inside.pieces.length && drawn.shadows === drawn.pieces && drawn.reflections === 0 && drawn.pools === 0 && drawn.tags >= 1 && drawn.motes > 0, `in their world's place, each thing solid, its shadow on the ground, no reflection in grass, what drifts in its air, its name: ${JSON.stringify(open)}`);
    assert(/turn it round/.test(open.hints) && /nearer · further/.test(open.hints) && /the next thing/.test(open.hints) && /back to what you drew/.test(open.hints), open.hints);
    await shot('tv-6c-step-inside.png');
    // OK: to the first thing, its name and the line the telling gave it
    await pressKey('Enter');
    await wait(1600);
    const at = await tv(() => window.__inktv.inside);
    assert(at.tour && at.tour.name === 'the night ferry' && at.caption && /The night ferry/.test(at.caption), JSON.stringify(at));
    await shot('tv-6d-the-night-ferry-inside.png');
    // a tap turns a little; held, it keeps turning
    const yaw0 = at.cam.yaw;
    await pressKey('ArrowLeft');
    await wait(900);
    await hold('ArrowLeft', 700);
    const turned = await tv(() => window.__inktv.inside.cam);
    assert(turned.yaw < yaw0 - 8, `turned: ${yaw0} -> ${JSON.stringify(turned)}`);
    // Back: it folds back into the painting, exactly as it was, and asks again what happens next
    await pressKey('Escape');
    await page.waitForFunction(() => window.__inktv.mode === 'offer', null, { timeout: 8000 });
    const back = await tv(() => ({ inside: window.__inktv.inside, offer: window.__inktv.offer, sheet: getComputedStyle(document.querySelector('#sheet')).opacity, host: document.querySelector('#inside').hidden }));
    assert(!back.inside && back.offer.i === 0 && back.sheet === '1', JSON.stringify(back));
    await page.waitForFunction(() => document.querySelector('#inside').hidden, null, { timeout: 2000 });
    const w = keptNight.w;
    // that's the end: the goodnight, and the paper
    await pressKey('Escape');
    const after = await tv(() => ({ mode: window.__inktv.mode, world: window.__inktv.atlas, offer: window.__inktv.offer, ending: window.__inktv.ending, scene: window.__inktv.scene, strokes: window.__inktv.brush.strokes }));
    assert(after.mode === 'atlas' && /^Until next time\./.test(after.world.about) && !after.offer && !after.ending && after.strokes === 0, JSON.stringify(after));
    assert(JSON.stringify(after.world.things) === '["the night ferry"]' && after.world.card === 'The night ferry', `back in their world, grown: ${JSON.stringify(after.world)}`);
    // where it stands: its place, written from its story as it starts; then they are asked how it
    // should look, before it is painted
    await page.waitForFunction(() => window.__inktv.placeLook, null, { timeout: 10000 });
    const asking = await tv(() => ({ look: window.__inktv.placeLook, actions: window.__inktv.atlas.actions, k: window.__inktv.atlas.k, scene: window.__inktv.placeScene, painted: window.__inktv.placePainted, ask: document.querySelector('#atlas .side .ask').textContent }));
    assert(/^It looks like a soft ink-wash painting, warm and quiet\. How should your world look\?/.test(asking.look.question) && asking.ask === asking.look.question && asking.k === 3, JSON.stringify(asking));
    assert(JSON.stringify(asking.actions) === '["A misty ink landscape","A moonlit ink-wash night","A golden evening in oils","Keep it as it is"]' && !asking.painted && !asked.some((a) => a.path === '/backdrop'), JSON.stringify(asking));
    const firstScene = asked.filter((a) => a.path === '/scene');
    // asked as the story started: shown tonight's story and what they said, as their world's first night
    assert(firstScene.length === 1 && !firstScene[0].brief.look && firstScene[0].brief.nights.length === 1 && firstScene[0].brief.nights[0].title === 'The Low Shore' && /the night ferry/.test(firstScene[0].brief.nights[0].story.join(' ')) && firstScene[0].brief.nights[0].said[0] === 'a long pier, and a boat waiting at the end of it', JSON.stringify(firstScene));
    await shot('tv-6a-how-should-it-look.png');
    // a look chosen: the place written again in it, and painted (it came by itself, so it began on
    // keeping it as it is)
    await pressKey('ArrowDown');
    await pressKey('ArrowDown');
    await pressKey('Enter');
    await page.waitForFunction(() => !window.__inktv.placeLook, null, { timeout: 10000 });
    const chose = asked.filter((a) => a.path === '/scene').at(-1);
    assert(chose.brief.look === 'A moonlit ink-wash night', JSON.stringify(chose.brief));
    const looked = await tv(() => ({ look: window.__inktv.placeScene.look, looks: window.__inktv.placeScene.looks, actions: window.__inktv.atlas.actions, all: window.__inktv.atlas.all, kept: JSON.parse(localStorage.getItem('inkwash.world')).scene }));
    assert(looked.look === 'A moonlit ink-wash night' && !looked.looks.includes(looked.look) && looked.kept.look === looked.look, JSON.stringify(looked));
    assert(JSON.stringify(looked.all) === '["Draw something new","Walk through your world","What’s out there?","How it looks","Say how the night ferry looks","Draw more of the night ferry","Read your book","Forget the night ferry"]' && JSON.stringify(looked.actions) === '["Draw something new","Walk through your world","What’s out there?","More…"]', JSON.stringify(looked));
    await page.waitForFunction(() => window.__inktv.placePainted, null, { timeout: 10000 });
    const paintedAs = asked.filter((a) => a.path === '/backdrop');
    assert(paintedAs.length === 1 && paintedAs[0].scene.look === 'A moonlit ink-wash night', JSON.stringify(paintedAs.map((a) => a.scene && a.scene.look)));
    assert(!after.scene.telling && !after.scene.shot, `the camera still: ${JSON.stringify(after.scene)}`);
    // its first turn, remembering their world, went while they marked it: one turn fewer to wait for after
    assert(JSON.stringify(w.guide.tools) === JSON.stringify(['recall', 'look', 'ask', 'tell', 'remember']) && w.guide.early === 1, JSON.stringify(w.guide));
    // the telling was held to their evidence before it was told, and passed: their words, their answer
    assert(w.guide.checks.length === 1 && w.guide.checks[0].ok && w.guide.checks[0].anchored >= 1, JSON.stringify(w.guide.checks));
    const told = keptNight.told;
    assert(JSON.parse(told.content).reactions.every((r) => r.said === 'yes'), told.content);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inkwash.world')));
    const ferry = saved.entities.find((e) => e.name === 'the night ferry');
    assert(ferry && ferry.status === 'confirmed' && JSON.stringify(ferry.appearances[0].strokes) === '[2]' && ferry.appearances[0].v < -0.3 && ferry.appearances[0].a > 0.3, JSON.stringify(ferry));
    assert(saved.facts.some((f) => f.thread && /end of the pier/.test(f.text)), 'what is unresolved, kept');
    assert(saved.nights[0].said[0] === 'a long pier, and a boat waiting at the end of it', 'their words, kept with the night');
    assert(saved.nights[0].asked[0].answer === 'the night ferry', 'and what they answered');
    const painting = await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('inkwash'); r.onsuccess = () => { const q = r.result.transaction('paintings').objectStore('paintings').get(1); q.onsuccess = () => ok(q.result && { image: q.result.image.slice(0, 23), strokes: q.result.strokes.length }); }; }));
    assert(painting && painting.image === 'data:image/jpeg;base64,' && painting.strokes === 2, `the painting kept for night 1: ${JSON.stringify(painting)}`);
    assert((await tv(() => window.__inktv.keptReal(1))) === 'data:image/jpeg;base64,', 'and the picture it was made into');
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.real === 1, null, { timeout: 8000 });
    assert(!(await tv(() => window.__inktv.real.shown)), 'their world over it; the paper waits clean');
    // and the night itself, kept with the paintings too, where it stays when the world lets it go
    const apart = await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('inkwash'); r.onsuccess = () => { const q = r.result.transaction('nights').objectStore('nights').get(1); q.onsuccess = () => ok(q.result && { n: q.result.n, said: q.result.said, title: q.result.title }); }; }));
    assert(apart && apart.n === 1 && apart.title === saved.nights[0].title && apart.said[0] === saved.nights[0].said[0], `night 1, kept apart: ${JSON.stringify(apart)}`);
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.pictures === 1, null, { timeout: 10000 });
    await shot('tv-6-kept.png');
  });

  await check('OK while it comes back skips to one word instead; Back returns to the paper', async () => {
    await inWorld('Draw something new');
    await stroke(300, 650, 0, 900);
    await pressKey('p');
    await page.waitForFunction(() => window.__inktv.mode === 'replay', null, { timeout: 5000 });
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'feel', null, { timeout: 5000 });
    const f = await tv(() => ({ feel: window.__inktv.feel, ask: document.querySelector('#feel .ask').textContent, marks: document.querySelector('#feel .marks').textContent, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent), on: document.querySelector('#feel .chip.on')?.textContent, stage: document.querySelector('#stage').className }));
    assert(f.ask === 'How did it feel?' && f.chips.length === 7 && f.chips.at(-1) === 'Don’t say', JSON.stringify(f));
    assert(/^Your marks were /.test(f.marks), `the marks said back: ${f.marks}`);
    assert(f.on === f.feel.choice && !/replaying/.test(f.stage), JSON.stringify(f));
    await shot('tv-5e-one-word-instead.png');
    await vegaKey('GoBack', 27);
    assert((await tv(() => window.__inktv.mode)) === 'paint', 'Back returns to the paper');
  });

  await check('Back while the storyteller looks: they paint on, and feel the painting again meanwhile; the storyteller, finishing late, leaves the new line be', async () => {
    const before = errors.length, turns = agentTurns().length;
    let letGo;
    agentHeld = new Promise((ok) => { letGo = ok; });
    try {
      await pressKey('p');
      await page.waitForFunction(() => window.__inktv.mode === 'replay', null, { timeout: 5000 });
      await pressKey('Enter');
      await page.waitForFunction(() => window.__inktv.mode === 'feel', null, { timeout: 5000 });
      await pressKey('Enter');
      // its first turn on the way, and held there
      await until(() => agentTurns().length > turns, 20000);
      await pressKey('Escape');
      assert((await tv(() => window.__inktv.mode)) === 'paint', 'Back while it looks: to the paper');
      await pressKey('p');
      await page.waitForFunction(() => window.__inktv.mode === 'replay', null, { timeout: 5000 });
    } finally { agentHeld = null; letGo(); }
    // the one they left hears its turn back, and stops; the new one, begun as the painting comes
    // back again, waits for how it felt
    await wait(1500);
    const t0 = await tv(() => window.__inktv.line && window.__inktv.line.t);
    await wait(300);
    const s = await tv(() => ({ mode: window.__inktv.mode, line: window.__inktv.line, guide: window.__inktv.guide }));
    assert(s.mode === 'replay' && s.line && s.line.t > t0, `the painting still comes back: ${JSON.stringify(s)}`);
    assert(s.guide.running && s.guide.last && s.guide.last.error, `the storyteller left stopped, and the new one listens: ${JSON.stringify(s.guide)}`);
    assert(errors.length === before, errors.slice(before).join(' | '));
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'feel', null, { timeout: 5000 });
    await vegaKey('GoBack', 27);
    assert((await tv(() => window.__inktv.mode)) === 'paint' && (await brush()).strokes === 1, 'Back returns to the paper, the stroke on it');
  });

  await check('of seven strokes the last six wash out, the seventh has soaked in, and Back twice clears it; on a clean sheet Back returns to their world, Back there to the seals, and Back on the seals to their world again', async () => {
    const toastNow = () => tv(() => ({ strokes: window.__inktv.brush.strokes, toast: document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent, hints: document.querySelector('#hints').textContent }));
    await pressKey('Escape');
    let s = await toastNow();
    assert(s.strokes === 0 && /your world/.test(s.hints), `the one stroke washed out: ${JSON.stringify(s)}`);
    // more strokes than wash out
    for (let i = 0; i < 7; i++) await stroke(260, 120 + i * 110, 0, 400);
    const soak = (await tv(() => window.__inktv.strokes))[0], mid = [Math.round((soak.from[0] + soak.to[0]) / 2), soak.from[1]];
    assert((await inkAt(...mid, 2)) > 0.3, 'the first of seven strokes, on the paper');
    for (let i = 0; i < 6; i++) await pressKey('Escape');
    assert((await brush()).strokes === 1, 'six washed out');
    await pressKey('Escape');
    s = await toastNow();
    assert(s.strokes === 1 && s.toast === 'That one has set: only the last few lines can be undone. Press Back again to start over.', JSON.stringify(s));
    await pressKey('Escape');
    s = await toastNow();
    assert(s.strokes === 0 && s.toast === 'Started over.', JSON.stringify(s));
    assert((await inkAt(...mid, 2)) < 0.08, 'the soaked-in stroke is gone with the sheet');
    assert((await tv(() => window.__inktv.world.nights)) === 1, 'nothing kept from a painting never told');
    await pressKey('Escape');
    assert((await tv(() => window.__inktv.mode)) === 'atlas', 'back to their world');
    await pressKey('Escape');
    const w = await tv(() => ({ mode: window.__inktv.mode, who: window.__inktv.who, title: document.querySelector('#who h2').textContent, tiles: [...document.querySelectorAll('#who .tile')].map((t) => t.textContent) }));
    assert(w.mode === 'who' && w.who.step === 'pick' && w.title === 'Who’s here?', JSON.stringify(w));
    assert(JSON.stringify(w.tiles) === JSON.stringify(['Moon1 chapter', '+Someone new']), JSON.stringify(w.tiles));
    await pressKey('Escape');
    assert((await tv(() => window.__inktv.mode)) === 'atlas', 'and back to their world');
  });

  await check('another night: welcomed back; the guide recognises the ferry, shows night 1\'s mark beside tonight\'s, and asks', async () => {
    await page.reload();
    await page.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });
    // who's painting: the one who painted last, ready
    const who = await tv(() => window.__inktv.who);
    assert(who.step === 'pick' && who.i === 0 && who.painters.length === 1, JSON.stringify(who));
    await pressKey('Enter');
    const hello = await tv(() => window.__inktv.atlas.about);
    // a word of welcome on screen, and no more
    assert(hello === 'Welcome back, Moon. This is chapter 2 of your world.', hello);
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.pictures === 1, null, { timeout: 10000 });
    await shot('tv-7-welcome-back.png');
    // the Worldbuilder: a question about the night ferry, three ways it could go; the one chosen is
    // kept as true of it, and shown on its card
    await inWorld('What’s out there?');
    await page.waitForFunction(() => window.__inktv.atlas && /\?$/.test(document.querySelector('#atlas .side .ask').textContent), null, { timeout: 10000 });
    const q = await tv(() => ({ ask: document.querySelector('#atlas .side .ask').textContent, actions: window.__inktv.atlas.actions, card: window.__inktv.atlas.card, sent: null }));
    assert(q.ask === 'Where does the night ferry go?' && JSON.stringify(q.actions) === '["To an island of lanterns","Under the sea","Up to the moon","Draw my own answer","Not now"]' && q.card === 'The night ferry', JSON.stringify(q));
    const wondered = asked.filter((a) => a.path === '/wonder');
    assert(wondered.length === 1, 'one question asked of the Worldbuilder');
    await shot('tv-7b-the-worldbuilder.png');
    await pressKey('Enter');
    const kept = await tv(() => ({ about: window.__inktv.atlas.about, lore: document.querySelector('#atlas .side .card .lore') && document.querySelector('#atlas .side .card .lore').textContent, actions: window.__inktv.atlas.actions, all: window.__inktv.atlas.all, saved: JSON.parse(localStorage.getItem('inkwash.world')) }));
    assert(/^Kept in your world: The night ferry goes to an island of lanterns\./.test(kept.about) && kept.lore === 'The night ferry goes to an island of lanterns.', JSON.stringify(kept));
    const chosen = kept.saved.facts.find((f) => f.source === 'chosen');
    assert(chosen && chosen.entity === 'e1' && chosen.from === 2 && kept.saved.wonders.length === 1 && kept.saved.wonders[0].chose === chosen.text, JSON.stringify(kept.saved.wonders));
    assert(JSON.stringify(kept.all) === '["Draw something new","Walk through your world","What’s out there?","How it looks","Draw more of the night ferry","Read your book","Forget the night ferry"]' && JSON.stringify(kept.actions) === '["Draw something new","Walk through your world","What’s out there?","More…"]', JSON.stringify(kept));
    await inWorld('Draw something new');
    await page.evaluate(() => new Promise((ok) => { let n = 0; const f = () => (++n >= 20 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    await stroke(300, 650, 0, 1500);
    await pooled(1100, 700, Math.PI);
    const before = agentTurns().length;
    await tv(() => window.__inktv.replayRate(0.5));
    await pressKey('p');
    await page.waitForFunction(() => window.__inktv.line && window.__inktv.line.shown === 1, null, { timeout: 20000 });
    await page.keyboard.down('ArrowDown');
    await dialTo(-0.9, null);
    await page.keyboard.up('ArrowDown');
    await page.waitForFunction(() => window.__inktv.mode === 'ask', null, { timeout: 20000 });
    const a = await tv(() => ({ q: document.querySelector('#feel .ask').textContent, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent), beside: !document.querySelector('#feel .beside').hidden, src: document.querySelector('#feel .beside img').src.slice(0, 23), caption: document.querySelector('#feel .beside .caption').textContent, guide: window.__inktv.guide }));
    assert(a.q === 'Is this the night ferry again?' && JSON.stringify(a.chips) === JSON.stringify(['Yes, the same', 'No, something else', 'Skip']), JSON.stringify(a));
    assert(a.beside && a.src === 'data:image/jpeg;base64,' && a.caption === 'Chapter 1', 'chapter 1\'s mark, beside tonight\'s');
    // chapter 1 as the guide looked at it, and as it stands beside the question: light, as in their world
    const looked = agentTurns().slice(before).flatMap((t) => results(t.messages)).find((b) => Array.isArray(b.content) && b.content.some((c) => c.type === 'text' && /^Night 1's painting/.test(c.text)));
    const pics = [`data:image/jpeg;base64,${looked.content[0].source.data}`, await tv(() => document.querySelector('#feel .beside img').src)];
    const lit = await Promise.all(pics.map(brightness));
    assert(lit.every((x) => x < 0.3), `chapter 1, as light: ${lit.map((x) => x.toFixed(2))}`);
    const brief = section(firstText(agentTurns()[before].messages), 'THEIR WORLD');
    // what night one's answers taught: every line they answered is a lesson
    const keeps = section(firstText(agentTurns()[before].messages), 'WHAT THEY KEEP');
    assert(keeps.lines_answered >= 1 && keeps.kept >= 1, JSON.stringify(keeps));
    // and what night one's marks taught of how their brush carries feeling: read blind, then learned from
    const brushFelt = section(firstText(agentTurns()[before].messages), 'HOW THEY PAINTED IT').feeling;
    assert(brushFelt.learned_from_strokes >= 2 && brushFelt.nights_read === 1 && brushFelt.last_reading.night === 1, JSON.stringify(brushFelt));
    const hint = brief.hints[0];
    assert(brief.night === 2 && brief.things[0].name === 'the night ferry' && hint.stroke === 2 && hint.came_before_as.night === 1, JSON.stringify(brief));
    assert(brief.open.some((x) => /end of the pier/.test(x.text)), 'what was unresolved');
    await wait(400);
    await shot('tv-8-again.png');
  });

  await check('night two: told from its world; "not quite" on a line, and the guide tells it once more before keeping the night; it closes on a question from their world, kept until it is answered or let be', async () => {
    const seen = await tv(() => window.__inktv.guide.running && window.__inktv.guide.last);
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.tell && window.__inktv.tell.i === 0, null, { timeout: 15000 });
    const steps = await tv(() => window.__inktv.guide);
    await pressKey('ArrowDown');
    assert((await tv(() => document.querySelector('#tell .react').textContent)) === 'Not quite');
    await pressKey('Enter');
    const second = await tv(() => window.__inktv.tell);
    assert(/the night ferry came back/.test(second.text), second.text);
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.tell && /once more/.test(window.__inktv.tell.title || '') && window.__inktv.tell.i === 0, null, { timeout: 15000 });
    const again = await tv(() => ({ tell: window.__inktv.tell, title: document.querySelector('#tell .title').textContent }));
    assert(again.tell.n === 1 && /^Again, more quietly/.test(again.tell.text) && again.title === 'The Low Shore, once more', JSON.stringify(again));
    // the picture the first telling bloomed into steps back: told again, over the ink
    await page.waitForFunction(() => !window.__inktv.real.shown, null, { timeout: 3000 });
    await pressKey('ArrowUp');
    await shot('tv-9-once-more.png');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'offer' && !window.__inktv.guide.running, null, { timeout: 8000 });
    // and blooms again as it ends
    await page.waitForFunction(() => window.__inktv.real.shown, null, { timeout: 5000 });
    const w = await tv(() => ({ world: window.__inktv.world, say: document.querySelector('#say .text').textContent, last: window.__inktv.guide.last }));
    assert(w.world.nights === 2 && w.say === 'Back again: the night ferry.', JSON.stringify(w));
    // ◀ from the first choice comes round to the last
    await pressKey('ArrowLeft');
    assert((await tv(() => window.__inktv.offer.choice)) === 'That’s the end');
    await pressKey('Enter');
    assert(/^Until next time\./.test(await tv(() => window.__inktv.atlas && window.__inktv.atlas.about)), 'goodnight, in their world');
    assert(JSON.stringify(w.last.tools) === JSON.stringify(['recall', 'look', 'thing', 'look', 'ask', 'tell', 'tell', 'remember']) && w.last.early === 1, JSON.stringify(w.last));
    assert(w.last.steps.includes("Looking at chapter 1's painting") && w.last.steps.includes('Remembering something from before'), JSON.stringify(w.last.steps));
    assert(w.world.summary.recurring[0].name === 'the night ferry' && w.world.summary.recurring[0].nights === 2, JSON.stringify(w.world.summary));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inkwash.world')));
    assert(/^Again, more quietly/.test(saved.nights[1].lines[0].text) && saved.nights[1].lines[0].reaction === 'yes', 'the line told again, kept in place of the one that was not quite');
    // what it remembered for the chapter: chapter 1 as it was told, and what it looked at and read
    const rem = saved.nights[1].remembered;
    assert(rem && JSON.stringify(rem.recent) === '[1]' && rem.read.includes('the night ferry') && rem.nights.includes(1), JSON.stringify(rem));
    // and the first chapter kept the other way to say its line, the one they heard and kept
    assert(saved.nights[0].lines[1].text === heardOther && saved.nights[0].lines[1].reaction === 'yes', JSON.stringify(saved.nights[0].lines));
    // made real once a night, not again for the line told again: shown the ferry from their world,
    // whose look is kept from now on, so it is the same ferry night after night
    const reals = asked.filter((a) => a.path === '/real' && !paintedAgain.has(a));
    assert(reals.length === 2 && JSON.stringify(reals[1].brief.things.map((t) => [t.name, t.look])) === '[["the night ferry",null]]', JSON.stringify(reals.map((r) => r.brief.things)));
    await page.waitForFunction(() => window.__inktv.looks.length === 1, null, { timeout: 8000 });
    assert(JSON.stringify(await tv(() => window.__inktv.looks)) === '[{"name":"the night ferry","look":"the night ferry, as the stand-in sees it"}]');
    // the night closes on a question from their Worldbuilder, unasked, as they come home
    await page.waitForFunction(() => /\?$/.test(document.querySelector('#atlas .side .ask').textContent), null, { timeout: 10000 });
    const closing = await tv(() => ({ ask: document.querySelector('#atlas .side .ask').textContent, actions: window.__inktv.atlas.actions, card: window.__inktv.atlas.card, waiting: JSON.parse(localStorage.getItem('inkwash.wondering.inkwash.world')) }));
    assert(closing.ask === 'Who rides the night ferry?' && JSON.stringify(closing.actions) === '["A girl with a lantern","A sleepy cat","No one at all","Draw my own answer","Not now"]' && closing.card === 'The night ferry' && closing.waiting.question === 'Who rides the night ferry?', JSON.stringify(closing));
    await shot('tv-9b-the-night-closes-on-a-question.png');
    // let be: asked once, never again, and no longer waiting (still waiting after the TV goes off: below)
    await pressKey('Escape');
    const letBe = await tv(() => ({ mode: window.__inktv.mode, hidden: document.querySelector('#atlas .side .ask').hidden, waiting: localStorage.getItem('inkwash.wondering.inkwash.world'), wonders: JSON.parse(localStorage.getItem('inkwash.world')).wonders }));
    assert(letBe.mode === 'atlas' && letBe.hidden && letBe.waiting === null && letBe.wonders.length === 2 && letBe.wonders[1].question === 'Who rides the night ferry?' && !letBe.wonders[1].chose, JSON.stringify(letBe));
    void seen; void steps;
  });

  await check('their own words for a thing: said on the phone, kept on its card and in their world, and the night ferry made again from the picture it had, as they said, and cut out by the image model; let go, it is made again as it was', async () => {
    await page.waitForFunction(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas && window.__inktv.atlas.made >= 1, null, { timeout: 20000 });
    // the TV was opened again since the phone was paired: paired again, to its new code; and the
    // choice to say how a thing looks comes as it does
    assert(!(await tv(() => window.__inktv.atlas.all)).includes('Say how the night ferry looks'), 'not without a phone');
    await phonePage.goto((await tv(() => window.__inktv.phone)).url);
    await page.waitForFunction(() => window.__inktv.phone.listening && window.__inktv.atlas.all.includes('Say how the night ferry looks'), null, { timeout: 8000 });
    for (let k = 0; k < 8 && (await tv(() => window.__inktv.atlas.card)) !== 'The night ferry'; k++) await pressKey('ArrowLeft');
    const things = () => asked.filter((a) => a.path === '/thing');
    const until = async (f, ms = 15000) => { for (const end = Date.now() + ms; !f(); ) { if (Date.now() > end) throw new Error('timed out'); await wait(100); } };
    const before = things().length;
    await inWorld('Say how the night ferry looks');
    const q = await tv(() => ({ said: window.__inktv.atlas.said, actions: window.__inktv.atlas.actions, k: window.__inktv.atlas.k, hints: document.querySelector('#hints').textContent, ask: document.querySelector('#atlas .side .ask').textContent }));
    assert(q.said && q.said.name === 'the night ferry' && q.ask === 'How does the night ferry look? Say it on your phone.' && JSON.stringify(q.actions) === '["Keep it as it is"]' && q.k === 0 && /or say it on your phone/.test(q.hints), JSON.stringify(q));
    await shot('tv-9b-say-how-it-looks.png');
    // what is painted from here on (counted before their words are sent: it may be made at once)
    const n = painted.length;
    await phonePage.fill('#text', 'The night ferry has a red funnel and one lit window.');
    await phonePage.click('#send');
    await page.waitForFunction(() => window.__inktv.atlas && !window.__inktv.atlas.said && window.__inktv.atlas.rule, null, { timeout: 8000 });
    const kept = await tv(() => ({ rule: window.__inktv.atlas.rule, card: document.querySelector('#atlas .card .said') && document.querySelector('#atlas .card .said').textContent, saved: JSON.parse(localStorage.getItem('inkwash.world')).entities.find((e) => e.name === 'the night ferry').rule }));
    assert(kept.rule === 'The night ferry has a red funnel and one lit window' && kept.card === `In your words: ${kept.rule}` && kept.saved === kept.rule, JSON.stringify(kept));
    // made again, from the picture it had and as they said it looks; cut out by Nova Canvas, so
    // the TV keeps its clear just as it came
    await until(() => things().length > before);
    const asked1 = things().at(-1);
    assert(asked1.name === 'the night ferry' && asked1.rule === kept.rule && asked1.reference === 'data:image/jpeg;base64,', JSON.stringify(asked1));
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.making === 0 && window.__inktv.atlas.inTheirWords === 1, null, { timeout: 15000 });
    assert(JSON.stringify(painted.slice(n)) === '["IMAGE_VARIATION","BACKGROUND_REMOVAL"]', JSON.stringify(painted.slice(n)));
    await wait(900);
    await shot('tv-9c-made-as-they-said.png');
    // let go: the question says what they said, and ▼ lets it go
    await inWorld('Say how the night ferry looks');
    const again = await tv(() => ({ actions: window.__inktv.atlas.actions, ask: document.querySelector('#atlas .side .ask').textContent }));
    assert(again.ask === 'In your words, the night ferry has a red funnel and one lit window. How does the night ferry look? Say it on your phone.' && JSON.stringify(again.actions) === '["Keep it as it is","Let go of your words"]', JSON.stringify(again));
    await pressKey('ArrowDown');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.atlas && !window.__inktv.atlas.said && !window.__inktv.atlas.rule, null, { timeout: 8000 });
    assert(!(await tv(() => document.querySelector('#atlas .card .said'))), 'gone from its card');
    assert(!JSON.parse(await page.evaluate(() => localStorage.getItem('inkwash.world'))).entities.find((e) => e.name === 'the night ferry').rule, 'and from their world');
    await until(() => things().length > before + 1);
    assert(things().at(-1).rule === undefined || things().at(-1).rule === null, JSON.stringify(things().at(-1)));
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.making === 0 && window.__inktv.atlas.inTheirWords === 0, null, { timeout: 15000 });
  });

  await check('a child paints on the same TV: a seal and a dream world of their own, a storyteller told to talk to a child, and a telling that brought in a monster sent back', async () => {
    // from Moon's world, Back: who's painting?
    await pressKey('Escape');
    assert((await tv(() => window.__inktv.mode)) === 'who', 'the picker');
    await pressKey('ArrowRight');
    await pressKey('Enter');
    const seals = await tv(() => [...document.querySelectorAll('#who .tile .name')].map((t) => t.textContent));
    assert(!seals.includes('Moon') && seals.length === 7 && seals[0] === 'Mountain', JSON.stringify(seals));
    await pressKey('ArrowRight');
    await pressKey('ArrowRight');
    await pressKey('Enter');
    await pressKey('ArrowRight');
    const f = await tv(() => ({ on: document.querySelector('#who .chip.on').textContent, sub: document.querySelector('#who .sub').textContent, seal: document.querySelector('#who .tile .name').textContent }));
    assert(f.on === 'A child' && /never adds anything scary/.test(f.sub) && f.seal === 'Star', JSON.stringify(f));
    await shot('tv-10-a-child.png');
    await pressKey('Enter');
    assert(/^Hello, Star\. Nothing in it yet\./.test(await tv(() => window.__inktv.atlas.about)), 'their own world, empty');
    await inWorld('Draw the first thing in it');
    const s = await tv(() => ({ mode: window.__inktv.mode, who: window.__inktv.who, world: window.__inktv.world, say: document.querySelector('#say .text').textContent, strokes: window.__inktv.brush.strokes }));
    assert(s.mode === 'paint' && s.who.painter.name === 'Star' && s.who.painter.young && s.world.nights === 0 && s.strokes === 0, JSON.stringify(s));
    // a child's coaching, in a child's words
    assert(/^Draw something from your world: a place, someone in it, or something that happens\. Press OK to start drawing\./.test(s.say), s.say);
    // their painting, marked darker where it turned: the dial speaks to a child
    await stroke(400, 500, 0, 1500);
    await pooled(1000, 520, Math.PI);
    const before = agentTurns().length;
    await tv(() => window.__inktv.replayRate(0.5));
    await pressKey('p');
    await page.waitForFunction(() => window.__inktv.line && window.__inktv.line.shown === 1, null, { timeout: 20000 });
    const hints = await tv(() => document.querySelector('#hints').textContent);
    assert(/brighter · darker/.test(hints) && /calmer · wilder/.test(hints), hints);
    await page.keyboard.down('ArrowDown');
    await dialTo(-0.9, null);
    await page.keyboard.up('ArrowDown');
    await page.waitForFunction(() => window.__inktv.mode === 'ask', null, { timeout: 20000 });
    const a = await tv(() => ({ q: document.querySelector('#feel .ask').textContent, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent), steps: window.__inktv.steps }));
    assert(a.q === 'What was this?' && JSON.stringify(a.chips) === '["a boat","a big fish","a cloud","Skip"]', JSON.stringify(a));
    assert(JSON.stringify(a.steps) === '["done","done","now",""]', `the schedule, listening: ${JSON.stringify(a.steps)}`);
    // read aloud for a child who can't read yet: the question, and each choice as it is reached
    await pressKey('ArrowRight');
    await pressKey('ArrowLeft');
    await page.waitForFunction(() => window.__inktv.aloud && window.__inktv.aloud.kept >= 3, null, { timeout: 5000 });
    const read = asked.filter((x) => x.path === '/speak').map((x) => x.text);
    assert(['What was this?', 'a big fish', 'a boat'].every((t) => read.includes(t)), `read aloud: ${JSON.stringify(read)}`);
    assert(read.includes('Press up where it felt brighter, and down where it felt darker.'), 'how to mark it, aloud');
    const turns = agentTurns().slice(before);
    assert(turns.length && turns.every((t) => t.young === true), 'every turn says a child is painting');
    assert(!agentTurns().slice(0, before).some((t) => t.young), 'and none of Moon\'s did');
    await shot('tv-11-a-child-asked.png');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.tell && window.__inktv.tell.i === 0, null, { timeout: 15000 });
    const t = await tv(() => window.__inktv.tell);
    assert(t.title === 'The Little Boat', JSON.stringify(t));
    const heardLines = [];
    for (let k = 0; k < t.n; k++) { heardLines.push(await tv(() => window.__inktv.tell && window.__inktv.tell.text)); await pressKey('Enter'); }
    // told: what happens next?
    await page.waitForFunction(() => window.__inktv.mode === 'offer' && !window.__inktv.guide.running, null, { timeout: 15000 });
    const kept = await tv(() => ({ world: window.__inktv.world, say: document.querySelector('#say .text').textContent, last: window.__inktv.guide.last, marks: document.querySelector('#feel .marks').textContent }));
    assert(kept.world.nights === 1 && /^New in your world: a boat/.test(kept.say) && kept.last.young, JSON.stringify(kept));
    // the storyteller's first telling brought in a monster, and brought what they marked darker
    // closer: the TV sent it back, the screen said so, and the child heard it told kindly
    const [sentBack, toldIt] = kept.last.checks;
    assert(sentBack.sent_back && sentBack.blocking.includes('frightening') && sentBack.blocking.includes('made_bigger') && toldIt.ok && !toldIt.sent_back, JSON.stringify(kept.last.checks));
    assert(kept.last.steps.includes('Finding gentler words'), JSON.stringify(kept.last.steps));
    assert(!heardLines.some((l) => /closer|monster/.test(l)) && heardLines.some((l) => /safe on the water/.test(l)), JSON.stringify(heardLines));
    assert(kept.marks === 'You can make it go any way you like.', kept.marks);
    // made real for a child: told it is a child's, in a warm film's look
    const kidReal = asked.filter((a) => a.path === '/real').at(-1);
    assert(kidReal.young === true && kidReal.look === 'film', JSON.stringify({ young: kidReal.young, look: kidReal.look }));
    // no picture came back (the filter turned it down): the painting woke up at night, its own ink lit
    await page.waitForFunction(() => window.__inktv.real.shown && window.__inktv.real.night, null, { timeout: 8000 });
    assert(!(await tv(() => window.__inktv.keptReal(1))), 'and no picture is kept with the night');
    await wait(4800); // as it finishes waking
    await shot('tv-11a-what-happens-next-asked.png');
    await pressKey('Enter');
    const e = await tv(() => ({ mode: window.__inktv.mode, ending: window.__inktv.ending, label: !document.querySelector('#ending').hidden, say: document.querySelector('#say .text').textContent, hints: document.querySelector('#hints').textContent, real: window.__inktv.real.shown }));
    assert(e.mode === 'paint' && e.ending && e.ending.night === 1 && e.ending.from === 2 && e.label && !e.real, `what happens next is painted on the ink: ${JSON.stringify(e)}`);
    assert(/^Draw what happens next\. It can go any way you like\./.test(e.say) && /tell it with what happens next/.test(e.hints) && /that’s the end/.test(e.hints), JSON.stringify(e));
    // what happens next: a sun, high up, in gold; it comes back alone, and they hold ▲: brighter
    for (let k = 0; k < 4 && (await brush()).ink !== 'gold'; k++) await pressKey('.');
    assert((await brush()).ink === 'gold', 'the dream inks come after water');
    await stroke(1300, 220, 0, 900);
    const sun = (await tv(() => window.__inktv.strokes)).at(-1);
    const gold = await tv(([x, y]) => window.__inktv.colorAt(x, y, 2), [Math.round((sun.from[0] + sun.to[0]) / 2), Math.round((sun.from[1] + sun.to[1]) / 2)]);
    assert(sun.ink === 'gold' && gold[0] > gold[2] + 60 && gold[1] > gold[2] + 25, `a gold sun: ${gold}`);
    await wait(300);
    await shot('tv-11b-what-happens-next.png');
    const turnsBefore = agentTurns().length;
    await pressKey('p');
    await page.waitForFunction(() => window.__inktv.mode === 'replay' && window.__inktv.line && window.__inktv.line.shown === 0, null, { timeout: 20000 });
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.__inktv.mode !== 'replay' || (window.__inktv.line && window.__inktv.line.v >= 0.6), null, { timeout: 10000 });
    await page.keyboard.up('ArrowUp');
    await page.waitForFunction(() => window.__inktv.mode === 'ask', null, { timeout: 20000 });
    const a2 = await tv(() => ({ q: document.querySelector('#feel .ask').textContent, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent) }));
    assert(a2.q === 'What happened next?' && JSON.stringify(a2.chips) === '["a boat","the sun","a friend","Skip"]', JSON.stringify(a2));
    const endTurn = agentTurns()[turnsBefore];
    const sent = section(firstText(endTurn.messages), 'WHAT HAPPENS NEXT');
    assert(endTurn.young === true && sent.night === 1 && JSON.stringify(sent.new_strokes) === '[3]' && sent.told.title === 'The Little Boat', JSON.stringify(sent));
    const felt = section(firstText(endTurn.messages), 'FEELING');
    assert(felt.length === 3 && felt[1].weight < -0.5 && felt[2].weight > 0.3, `the night as marked, then what came next: ${JSON.stringify(felt)}`);
    await pressKey('ArrowRight');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.tell && window.__inktv.tell.i === 0, null, { timeout: 15000 });
    const t2 = await tv(() => window.__inktv.tell);
    assert(t2.title === 'The Little Boat, and what happened next', JSON.stringify(t2));
    for (let k = 0; k < t2.n - 1; k++) await pressKey('Enter');
    const lastLine = await tv(() => window.__inktv.tell.text);
    assert(lastLine === 'Then the sun was there, just as you drew it.', lastLine);
    await wait(400);
    await shot('tv-11c-told-with-what-happened-next.png');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'atlas' && !window.__inktv.guide.running, null, { timeout: 15000 });
    const ended = await tv(() => ({ world: window.__inktv.world, ending: window.__inktv.ending, label: !document.querySelector('#ending').hidden, about: window.__inktv.atlas.about, things: window.__inktv.atlas.things, saved: JSON.parse(localStorage.getItem('inkwash.world.p2')) }));
    assert(/^New in your world from what happened next: the sun\. See you next time\./.test(ended.about) && !ended.ending && !ended.label && ended.things.includes('the sun'), `back in Star's world, the sun in it: ${JSON.stringify(ended)}`);
    assert(ended.world.nights === 1 && JSON.stringify(ended.saved.nights[0].ending.strokes) === '[3]' && ended.saved.nights[0].ending.felt.v > 0.3, JSON.stringify(ended.saved.nights[0].ending));
    assert(ended.saved.nights[0].lines.length === 2, 'the dream as it came, kept as it was');
    // their worlds and paintings, kept apart
    const stored = await page.evaluate(async () => {
      const keys = await new Promise((ok, fail) => { const r = indexedDB.open('inkwash'); r.onsuccess = () => { const q = r.result.transaction('paintings').objectStore('paintings').getAllKeys(); q.onsuccess = () => ok(q.result); q.onerror = () => fail(q.error); }; r.onerror = () => fail(r.error); });
      return { moon: JSON.parse(localStorage.getItem('inkwash.world')).nights.length, star: JSON.parse(localStorage.getItem('inkwash.world.p2')).nights.length, keys };
    });
    assert(stored.moon === 2 && stored.star === 1, JSON.stringify(stored));
    // each night's painting, by painter; as night 0, where a world stands, painted (paintings.js
    // PLACE); and below it, each thing made real on its own (e1 as -1)
    const place = (k) => /(^|:)(0|-\d+)$/.test(String(k));
    assert(JSON.stringify(stored.keys.filter((k) => !place(k))) === JSON.stringify([1, 2, 'p2:1']), JSON.stringify(stored.keys));
    assert(stored.keys.includes(0), `the first painter's world, painted, kept with their paintings: ${JSON.stringify(stored.keys)}`);
    // and back to Moon, whose world is as it was: from Star's world, Back
    await placeSettled();
    await pressKey('Escape');
    const tiles = await tv(() => [...document.querySelectorAll('#who .tile')].map((x) => x.querySelector('.name').textContent + ': ' + x.querySelector('.about').textContent));
    assert(JSON.stringify(tiles) === JSON.stringify(['Moon: 2 chapters', 'Star: 1 chapter · a child', 'Someone new: ']), JSON.stringify(tiles));
    await shot('tv-12-whos-painting.png');
    await pressKey('ArrowLeft');
    await pressKey('Enter');
    const back = await tv(() => ({ about: window.__inktv.atlas.about, who: window.__inktv.who }));
    assert(/^Welcome back, Moon\. This is chapter 3 of your world\./.test(back.about) && !back.who.painter.young, JSON.stringify(back));
    await inWorld('Draw something new');
  });

  await check('a remote that repeats keydowns and never sends keyup still holds, then lets go', async () => {
    const x0 = (await brush()).x;
    await page.evaluate(async () => {
      for (let i = 0; i < 15; i++) {
        dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', keyCode: 37, repeat: i > 0, bubbles: true }));
        await new Promise((ok) => setTimeout(ok, 40));
      }
    });
    const x1 = (await brush()).x;
    await wait(500);
    const x2 = (await brush()).x;
    await wait(300);
    const x3 = (await brush()).x;
    assert(x1 < x0 - 60, `held left: ${x0} -> ${x1}`);
    assert(Math.abs(x3 - x2) < 0.5, `still moving after the repeats stopped: ${x2} -> ${x3}`);
  });

  await check('a demo family, labelled: earlier nights drawn by a script, kept apart from the TV\'s own; Moon is welcomed back to night 4, and hears last time\'s story again', async () => {
    const before = await page.evaluate(() => localStorage.getItem('inkwash.family'));
    await page.goto(`${base}?guide=http://localhost:${GUIDE}&pace=fast&demo&idle=8&quiet=0`);
    await page.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });
    const w = await tv(() => ({ demo: window.__inktv.demo, mode: window.__inktv.mode, label: !document.querySelector('#demo').hidden && document.querySelector('#demo').textContent, tiles: [...document.querySelectorAll('#who .tile')].map((x) => `${x.querySelector('.name').textContent}: ${x.querySelector('.about').textContent}`), hints: document.querySelector('#hints').textContent }));
    assert(w.demo && w.mode === 'who' && /^Demo family/.test(w.label) && /drawn by a script/.test(w.label), JSON.stringify(w));
    assert(JSON.stringify(w.tiles) === JSON.stringify(['Moon: 3 chapters', 'Star: 3 chapters · a child', 'Someone new: ']) && /leave the demo/.test(w.hints) && /their book/.test(w.hints), JSON.stringify(w));
    await shot('tv-13-demo-family.png');
    // Star's book of dreams, in a child's words: the title spread, with the dragon friend, first
    // painted in what happened next; then a night to a spread, the first first
    await pressKey('ArrowRight');
    await pressKey(',');
    const j = await tv(() => ({ mode: window.__inktv.mode, journal: window.__inktv.journal }));
    assert(j.mode === 'journal' && j.journal.title === 'Star’s book' && j.journal.i === 0 && j.journal.spreads === 4, JSON.stringify(j));
    assert(/^3 chapters, .+\. Kept on this TV\.$/m.test(j.journal.page.left) && /what keeps coming back/i.test(j.journal.page.right), JSON.stringify(j.journal.page));
    const dragon = j.journal.things.find((t) => t.name === 'the dragon friend');
    assert(dragon && dragon.says === 'First drawn in what happened next, in chapter 2. Came back once since, very bright and very wild.', JSON.stringify(j.journal.things));
    assert(JSON.stringify(j.journal.nights) === JSON.stringify(['The Rocket', 'The Moon Castle', 'Flying with the Dragon']), JSON.stringify(j.journal.nights));
    await shot('tv-14-dream-journal.png');
    // ▶ turns the page over, about the spine: night 1, its painting on the left, its story on the right
    await pressKey('ArrowRight');
    await wait(420);
    assert(await tv(() => window.__inktv.journal.turning), 'the page turning');
    await shot('tv-14a-turning-the-page.png');
    await page.waitForFunction(() => window.__inktv.journal.i === 1 && !window.__inktv.journal.turning && window.__inktv.journal.page.art.every(Boolean), null, { timeout: 8000 });
    const n1 = await tv(() => window.__inktv.journal.page);
    assert(n1.art.length === 1 && /^Chapter 1 · /i.test(n1.left) && /^Chapter 1\s+The Rocket\s/i.test(n1.right) && /Felt very bright and very wild\. In it: the rocket, the moon\./.test(n1.right), JSON.stringify(n1));
    await wait(200);
    await shot('tv-14b-a-night-in-the-book.png');
    // and ◀ back to the start, but no further
    await pressKey('ArrowLeft');
    await page.waitForFunction(() => window.__inktv.journal.i === 0 && !window.__inktv.journal.turning, null, { timeout: 4000 });
    await pressKey('ArrowLeft');
    assert((await tv(() => [window.__inktv.journal.i, window.__inktv.journal.turning].join())) === '0,false', 'the first page');
    await pressKey('Escape');
    assert((await tv(() => window.__inktv.mode)) === 'who', 'back to the seals');
    await pressKey('ArrowLeft');
    await pressKey('Enter');
    await placeSettled();
    const m = await tv(() => ({ world: window.__inktv.world, home: window.__inktv.atlas }));
    assert(m.home.about === 'Welcome back, Moon. This is chapter 4 of your world.' && m.world.nights === 3, JSON.stringify(m));
    // previously in Moon's world: last time's story, two days ago, the first thing offered in it
    // three things to do on screen, and the rest under More…
    assert(JSON.stringify(m.home.all) === '["Hear last time’s story","Draw something new","Walk through your world","What’s out there?","How it looks","Draw more of the night ferry","Send the night ferry to Star’s world","Read your book","Forget the night ferry"]' && JSON.stringify(m.home.actions) === '["Hear last time’s story","Draw something new","Walk through your world","More…"]' && m.home.k === 0, JSON.stringify(m.home));
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.pictures === 4, null, { timeout: 20000 });
    // each thing of Moon's world made real on its own, from its strokes, as it looks, alone on white;
    // the white cut away, it stands in Moon's world in place of its strokes
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.made === 4 && window.__inktv.atlas.making === 0, null, { timeout: 20000 });
    // each sprang up as it came to life, there in Moon's world
    assert((await tv(() => window.__inktv.atlas.came)) === 4, 'each came to life while Moon looked');
    await wait(1200);
    await shot('tv-15-hear-it-again.png');
    const things = asked.filter((a) => a.path === '/thing' && ['the pier', 'the lantern', 'the bridge'].includes(a.name));
    assert(things.length === 3 && things.every((a) => a.young === false && /^data:image\/png;base64,/.test(a.image) && a.width % 16 === 0 && a.height % 16 === 0 && Math.max(a.width, a.height) === 640), JSON.stringify(things));
    // told as night 3 kept it, over its painting, each line lit; no model is asked
    const turns = agentTurns().length;
    await pressKey('Enter');
    // it opens the way a series does: the nights before going by, then the night's title
    await page.waitForFunction(() => window.__inktv.previously, null, { timeout: 5000 });
    const pv = await tv(() => window.__inktv.previously);
    assert(pv.kicker === 'Previously in Moon’s world' && pv.title === 'The Ferry Leaves' && pv.night === 'Chapter 3' && pv.reel.length === 3 && pv.reel[2] === 'Chapter 3 · The Ferry Leaves', JSON.stringify(pv));
    await wait(2800);
    await shot('tv-15b-previously-in-moons-world.png');
    // OK goes straight to the story
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.recap && window.__inktv.recap.i === 0, null, { timeout: 10000 });
    const r = await tv(() => window.__inktv.recap);
    assert(r.title === 'Previously in Moon’s world: The Ferry Leaves' && r.painting && r.lit && r.n === 3, JSON.stringify(r));
    const again = [];
    for (let k = 0; k < r.n; k++) {
      again.push(await tv(() => window.__inktv.recap.text));
      if (k === r.n - 1) await shot('tv-16-previously.png');
      await pressKey('Enter');
    }
    assert(JSON.stringify(again) === JSON.stringify(['The pier, as long as before.', 'The night ferry waited at the end of it, as it always had.', 'Then a bridge was there, all the way out to the ferry, and you walked across.']), JSON.stringify(again));
    // heard to the end, its painting still there: step inside it, or paint tonight's
    const after = await tv(() => ({ mode: window.__inktv.mode, offer: window.__inktv.offer, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent), painting: !document.querySelector('#kept').hidden }));
    assert(after.mode === 'offer' && after.offer.choice === 'Step inside' && JSON.stringify(after.chips) === '["Step inside","Draw something new"]' && after.painting, JSON.stringify(after));
    // and it wakes up in Moon's world's place, as on the night it was told (none of the demo's nights was made real)
    await page.waitForFunction(() => window.__inktv.real.shown && /^blob:/.test(window.__inktv.real.src), null, { timeout: 8000 });
    await wait(4800);
    await shot('tv-16a-woken-again.png');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.inside && window.__inktv.inside.phase === 'open', null, { timeout: 15000 });
    const inMoons = await tv(() => window.__inktv.inside);
    assert(inMoons.pieces.some((p) => p.name === 'the night ferry' && p.made), `Moon's night ferry stands up from night 3's painting, as its own picture: ${JSON.stringify(inMoons.pieces)}`);
    await pressKey('Enter');
    await wait(1800);
    assert(/The night ferry/.test((await tv(() => window.__inktv.inside.caption)) || ''), 'gone to, by name');
    await shot('tv-16b-inside-moons-night.png');
    await pressKey('Escape');
    await page.waitForFunction(() => window.__inktv.mode === 'offer', null, { timeout: 8000 });
    await pressKey('ArrowRight');
    assert((await tv(() => window.__inktv.offer.choice)) === 'Draw something new', 'the other choice');
    await pressKey('Enter');
    const done = await tv(() => ({ mode: window.__inktv.mode, painting: !document.querySelector('#kept').hidden, strokes: window.__inktv.brush.strokes, say: document.querySelector('#say .text').textContent, heard: JSON.parse(localStorage.getItem('inkwash.demo.world.p1')).nights[2].heard }));
    assert(done.mode === 'paint' && !done.painting && done.strokes === 0 && /^Draw something into your world/.test(done.say), JSON.stringify(done));
    assert(done.heard.length === 1 && done.heard[0].heard === 3 && done.heard[0].of === 3 && agentTurns().length === turns, JSON.stringify(done.heard));
    // heard tonight: back in their world, it isn't offered again this evening
    await pressKey('Escape');
    const home = await tv(() => window.__inktv.atlas);
    assert(home && !home.actions.includes('Hear last time’s story'), `not offered twice in an evening: ${JSON.stringify(home)}`);
    // and Moon's book says so, on night 3's page: read from their world, and Back to it
    await inWorld('Read your book');
    await page.waitForFunction(() => window.__inktv.mode === 'journal', null, { timeout: 5000 });
    const told = [];
    for (let k = 1; k <= 3; k++) {
      await pressKey('ArrowRight');
      await page.waitForFunction((k) => window.__inktv.journal.i === k && !window.__inktv.journal.turning, k, { timeout: 4000 });
      told.push(await tv(() => window.__inktv.journal.page.right));
    }
    assert(/Heard again once\.\s*$/.test(told[2]) && told.slice(0, 2).every((t) => !/Heard again/.test(t)), JSON.stringify(told));
    await pressKey('Escape');
    await page.waitForFunction(() => window.__inktv.mode === 'atlas', null, { timeout: 5000 });
    await pressKey('Escape');
    assert((await tv(() => window.__inktv.mode)) === 'who', 'back to the seals');
    // the TV's own family and worlds are as they were; the demo's paintings are there to look back at
    const own = await page.evaluate(async () => {
      const keys = await new Promise((ok, fail) => { const r = indexedDB.open('inkwash'); r.onsuccess = () => { const q = r.result.transaction('paintings').objectStore('paintings').getAllKeys(); q.onsuccess = () => ok(q.result); q.onerror = () => fail(q.error); }; r.onerror = () => fail(r.error); });
      return { family: localStorage.getItem('inkwash.family'), moon: JSON.parse(localStorage.getItem('inkwash.world')).nights.length, keys };
    });
    assert(own.family === before && own.moon === 2, JSON.stringify(own));
    assert(JSON.stringify(own.keys.filter((k) => !/(^|:)(0|-\d+)$/.test(String(k)))) === JSON.stringify([1, 2, 'demo-p1:1', 'demo-p1:2', 'demo-p1:3', 'demo-p2:1', 'demo-p2:2', 'demo-p2:3', 'p2:1']), JSON.stringify(own.keys));
  });

  await check('their world at night, each thing where it first came, in its own light; walked through, OK to each thing in turn, ▶‖ its nights as they were told, Back home; and the TV at rest shows their paintings at night', async () => {
    assert((await tv(() => window.__inktv.mode)) === 'who', 'on the seals');
    await pressKey('ArrowRight');
    await pressKey('.');
    await page.waitForFunction(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas.pictures === 4, null, { timeout: 20000 });
    await placeSettled();
    const at = await tv(() => window.__inktv.atlas);
    assert(at.title === 'Star’s world' && JSON.stringify(at.things) === '["the rocket","the moon","the moon castle","the dragon friend"]' && at.card === 'The rocket', JSON.stringify(at));
    const moon = at.nodes.find((x) => x.name === 'the moon'), rocket = at.nodes.find((x) => x.name === 'the rocket');
    assert(moon.x > rocket.x && moon.y < rocket.y, `where Star painted them: ${JSON.stringify(at.nodes)}`);
    await pressKey('ArrowLeft');
    assert((await tv(() => window.__inktv.atlas.card)) === 'The dragon friend', 'a card at a time');
    // each thing said hello with a hop as their world opened; the one gone to hops again, with a sound of its own
    const hops = await tv(() => window.__inktv.atlas.hops);
    assert(Object.keys(hops).length === 4 && Object.values(hops).every((n) => n >= 1) && Object.values(hops).filter((n) => n >= 2).length === 1, JSON.stringify(hops));
    // left alone a while, the words fade and only their world is left; a button brings them back, and does what it does
    await tv(() => { window.__inktv.quietAfter = 1200; });
    await page.waitForFunction(() => window.__inktv.atlas.quiet, null, { timeout: 5000 });
    await wait(1600);
    await shot('tv-17a-left-alone.png');
    const faded = await tv(() => ({ side: getComputedStyle(document.querySelector('#atlas .side')).opacity, hints: getComputedStyle(document.querySelector('#hints')).opacity }));
    await pressKey('ArrowRight');
    const shownAgain = await tv(() => ({ quiet: window.__inktv.atlas.quiet, card: window.__inktv.atlas.card }));
    await tv(() => { window.__inktv.quietAfter = Infinity; });
    assert(faded.side === '0' && faded.hints === '0' && !shownAgain.quiet && shownAgain.card !== 'The dragon friend', JSON.stringify({ faded, shownAgain }));
    await pressKey('ArrowLeft');
    // and More… shows the rest of what can be done, where it was
    const more = await tv(() => window.__inktv.atlas.actions);
    assert(more.at(-1) === 'More…' && more.length === 4, JSON.stringify(more));
    for (let k = 0; k < 3; k++) await pressKey('ArrowDown');
    await pressKey('Enter');
    const all = await tv(() => ({ actions: window.__inktv.atlas.actions, all: window.__inktv.atlas.all, on: window.__inktv.atlas.actions[window.__inktv.atlas.k] }));
    assert(JSON.stringify(all.actions) === JSON.stringify(all.all) && all.on === all.all[3], JSON.stringify(all));
    for (let k = 0; k < 3; k++) await pressKey('ArrowUp');
    await wait(300);
    // where it stands, written for it once its story started
    await page.waitForFunction(() => window.__inktv.placeScene, null, { timeout: 10000 }).catch(() => {});
    await placeSettled();
    await shot('tv-17-their-world.png');
    // walked through: it starts on the very picture of their world, every thing in it standing where it first came
    const spoken = asked.filter((x) => x.path === '/speak').length;
    await inWorld('Walk through your world');
    await page.waitForFunction(() => window.__inktv.walk && window.__inktv.walk.drawn && window.__inktv.walk.drawn.tags === 4, null, { timeout: 5000 });
    const w0 = await tv(() => ({ walk: window.__inktv.walk, hints: document.querySelector('#hints').textContent, header: getComputedStyle(document.querySelector('#atlas header')).opacity }));
    const e0 = w0.walk.eye, d0 = w0.walk.drawn;
    // where it stands, written for it once its story started (the stand-in Set Designer's meadow),
    // drawn by the TV; Star is a child, and the stand-in image model turns down every child's
    // picture, so the drawing stays (a grown-up's was painted: the keys above). No water, so nothing
    // held upside down
    const sc = await tv(() => window.__inktv.placeScene), painted = await tv(() => window.__inktv.placePainted);
    assert(sc && sc.ground && sc.ground.kind === 'grass' && !painted, `their world's place, written and painted: ${JSON.stringify({ sc, painted, asked: asked.filter((x) => ['/scene', '/backdrop'].includes(x.path)).map((x) => [x.path, x.young]), who: await tv(() => window.__inktv.who.painter) })}`);
    assert(asked.filter((x) => x.path === '/scene').length >= 1 && asked.some((x) => x.path === '/backdrop' && /^data:image\/jpeg;base64,/.test(x.image) && x.scene && x.scene.place === sc.place), 'the scene asked for, and the place painted over its drawing');
    assert(e0.x === 0 && e0.z === 0 && e0.yaw === 0 && e0.lift === 0 && d0.things === 4 && d0.reflections === (sc.ground.shine > 0 ? 4 : 0) && d0.sparks > 40, `from where it begins, as home sees it: ${JSON.stringify(w0.walk)}`);
    assert(w0.walk.caption.kicker === 'Star’s world' && w0.walk.caption.name === 'Walk through it' && ['turn', 'walk', 'the next thing', 'hear the stories it came in', 'walk home'].every((h) => w0.hints.includes(h)), JSON.stringify(w0));
    await shot('tv-17b-walk-through-it.png');
    // OK: to each thing in turn, the nearest first, stood before eye to eye, a ring of light round its foot
    const goTo = async () => { await pressKey('Enter'); await wait(200); await page.waitForFunction(() => window.__inktv.walk && !window.__inktv.walk.moving, null, { timeout: 15000 }); return tv(() => window.__inktv.walk); };
    const castle = await goTo();
    assert(castle.gone === castle.at && castle.caption.name === 'The moon castle' && /^Chapter 2/.test(castle.caption.kicker) && castle.caption.line && castle.drawn.ring === 1 && castle.eye.lift === 0, JSON.stringify(castle));
    await shot('tv-17c-the-moon-castle.png');
    // on to the moon, up in the sky: looked up to from below, the horizon low
    let up = await goTo();
    for (let k = 0; k < 3 && up.caption.name !== 'The moon'; k++) up = await goTo();
    assert(up.caption.name === 'The moon' && up.eye.lift > 200 && up.eye.h < 560, JSON.stringify(up));
    await shot('tv-17d-the-moon-looked-up-to.png');
    // ▶‖: the nights it came in, as they were told, read aloud
    await pressKey('p');
    const heard = await tv(() => window.__inktv.walk);
    assert(heard.hearing && heard.hearing.i === 0 && heard.hearing.n >= 1 && /^Chapter 1/.test(heard.caption.kicker) && /moon/i.test(heard.caption.line), JSON.stringify(heard));
    for (let k = 0; k < 20 && !asked.slice(spoken).some((x) => x.path === '/speak' && x.text === heard.caption.line); k++) await wait(100);
    assert(asked.slice(spoken).some((x) => x.path === '/speak' && x.text === heard.caption.line), `read aloud: ${JSON.stringify(asked.slice(spoken).map((x) => x.text))}`);
    assert((await tv(() => document.querySelector('#hints').textContent)).includes('stop'), '▶‖ again stops it');
    await pressKey('p');
    assert(!(await tv(() => window.__inktv.walk.hearing)), 'stopped');
    // held ◀ turns, and walking on, what was said of it goes
    const yaw = (await tv(() => window.__inktv.walk.eye.yaw));
    await hold('ArrowLeft', 700);
    const turned = await tv(() => window.__inktv.walk);
    assert(turned.eye.yaw < yaw - 0.3 && !turned.caption, `turned: ${yaw} -> ${JSON.stringify(turned)}`);
    // Back: it walks home to the water's edge, and their world is as it was, the last thing gone to the one shown
    await pressKey('Escape');
    await page.waitForFunction(() => !window.__inktv.walk, null, { timeout: 15000 });
    const back = await tv(() => ({ mode: window.__inktv.mode, card: window.__inktv.atlas.card, hints: document.querySelector('#hints').textContent, walking: document.querySelector('#atlas').classList.contains('walking'), names: document.querySelectorAll('#atlas .names').length }));
    assert(back.mode === 'atlas' && back.card === 'The moon' && !back.walking && back.names === 0 && /the seals/.test(back.hints), JSON.stringify(back));
    await pressKey('Escape');
    assert((await tv(() => window.__inktv.mode)) === 'who', 'back to the seals');
    // left on the seals, the TV rests: the family's paintings, one at a time, each in its own
    // world's place (both demo worlds have one by now)
    await page.waitForFunction(() => window.__inktv.mode === 'gallery' && window.__inktv.gallery.shown >= 1 && window.__inktv.gallery.look === 'place' && window.__inktv.gallery.caption, null, { timeout: 30000 });
    const g = await tv(() => window.__inktv.gallery);
    assert(g.n === 6 && /^(Moon|Star)’s world · Chapter \d$/.test(g.caption) && g.title, JSON.stringify(g));
    await wait(1200);
    await shot('tv-18-the-tv-at-rest.png');
    await pressKey('ArrowRight');
    const woke = await tv(() => ({ mode: window.__inktv.mode, i: window.__inktv.who.i }));
    assert(woke.mode === 'who' && woke.i === 1, `any button wakes it, and does nothing else: ${JSON.stringify(woke)}`);
  });

  await check('a TV short of room: every night kept with the paintings, a word for the grown-ups as it fills, and a world too big for its quick memory kept in its larger store, read from there, and back once there is room', async () => {
    // the TV turned off and on: its own family, and Moon's nights kept with the paintings as soon as Moon paints
    await page.goto(`${base}?guide=http://localhost:${GUIDE}&pace=fast&quiet=0`);
    await page.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });
    assert(!(await tv(() => window.__inktv.demo)), "the TV's own family");
    for (let k = 0; k < 4 && (await tv(() => window.__inktv.who.i)) !== 0; k++) await pressKey('ArrowLeft');
    await pressKey('Enter');
    assert((await tv(() => window.__inktv.who.painter.name)) === 'Moon', 'Moon is painting');
    let archived = [];
    for (let k = 0; k < 30 && archived.length < 2; k++) { archived = await tv(() => window.__inktv.archived()); if (archived.length < 2) await wait(100); }
    assert(JSON.stringify(archived) === '[1,2]', `every night of Moon's world, kept apart: ${JSON.stringify(archived)}`);
    // localStorage filling up: the seals say so, calmly
    await tv(() => { let u = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); u += k.length + localStorage.getItem(k).length; } localStorage.setItem('inkwash.e2e.ballast', 'x'.repeat(Math.round(0.86 * 5000000) - u - 30)); });
    await pressKey('Escape');
    let room = await tv(() => ({ mode: window.__inktv.mode, ...window.__inktv.room }));
    assert(room.mode === 'who' && /^The TV’s quick memory for worlds is 8\d% full\. As it fills, older chapters move to its larger store, so nothing is lost\.$/.test(room.note) && !room.alarm, JSON.stringify(room));
    await wait(300);
    await shot('tv-19-short-of-room.png');
    // full to the brim, and Moon's world no longer fits: kept in IndexedDB instead
    await pressKey('Enter');
    await tv(() => {
      localStorage.removeItem('inkwash.e2e.ballast');
      localStorage.removeItem('inkwash.world');
      let lo = 0, hi = 6000000;
      while (hi - lo > 8) { const mid = Math.floor((lo + hi) / 2); try { localStorage.setItem('inkwash.e2e.ballast', 'x'.repeat(mid)); lo = mid; } catch { hi = mid; } }
      localStorage.setItem('inkwash.e2e.ballast', 'x'.repeat(lo));
    });
    const kept = await tv(() => window.__inktv.keep());
    assert(kept.kept === 'apart' && (await tv(() => localStorage.getItem('inkwash.world'))) === null, JSON.stringify(kept));
    await pressKey('Escape');
    room = await tv(() => window.__inktv.room);
    assert(room.note === 'The TV’s quick memory for worlds is full, so one world is kept in its larger store instead. Nothing is lost.' && JSON.stringify(room.apart) === '["inkwash.world"]', JSON.stringify(room));
    // the TV turned off and on, still full: Moon's world is read from the larger store, every night of it
    await page.reload();
    await page.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });
    const again = await tv(() => ({ apart: window.__inktv.room.apart, seals: [...document.querySelectorAll('#who .tile .about')].map((x) => x.textContent) }));
    assert(JSON.stringify(again.apart) === '["inkwash.world"]' && again.seals[0] === '2 chapters', JSON.stringify(again));
    await pressKey('Enter');
    const moon = await tv(() => window.__inktv.world);
    assert(moon.nights === 2 && moon.summary.nights === 2, JSON.stringify(moon));
    // room made: back in localStorage, and nothing more said
    await tv(() => localStorage.removeItem('inkwash.e2e.ballast'));
    const back = await tv(() => window.__inktv.keep());
    const here = await tv(() => ({ apart: window.__inktv.room.apart, nights: JSON.parse(localStorage.getItem('inkwash.world')).nights.length }));
    assert(back.kept === 'here' && !here.apart.length && here.nights === 2, JSON.stringify({ back, here }));
    await pressKey('Escape');
    assert((await tv(() => window.__inktv.room.note)) === null, 'room to spare: nothing said');
  });

  await check('a question their world asked, left as the TV went off, is still waiting as their world opens again; let be, it waits no more', async () => {
    // the TV as it was left: the night's question, unanswered
    const q = { about: 'e1', name: 'the night ferry', question: 'What waits at the end of the pier?', choices: [{ say: 'A lantern', fact: 'A lantern waits at the end of the pier.' }, { say: 'Someone kind', fact: 'Someone kind waits at the end of the pier.' }] };
    await page.evaluate((w) => localStorage.setItem('inkwash.wondering.inkwash.world', JSON.stringify(w)), q);
    await page.reload();
    await page.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });
    for (let k = 0; k < 4 && (await tv(() => window.__inktv.who.i)) !== 0; k++) await pressKey('ArrowLeft');
    await pressKey('Enter');
    await page.waitForFunction(() => document.querySelector('#atlas .side .ask').textContent === 'Still wondering. What waits at the end of the pier?', null, { timeout: 10000 });
    const still = await tv(() => ({ actions: window.__inktv.atlas.actions, card: window.__inktv.atlas.card }));
    assert(JSON.stringify(still.actions) === '["A lantern","Someone kind","Draw my own answer","Not now"]' && still.card === 'The night ferry', JSON.stringify(still));
    await shot('tv-9c-still-wondering.png');
    await pressKey('Escape');
    const gone = await tv(() => ({ mode: window.__inktv.mode, hidden: document.querySelector('#atlas .side .ask').hidden, waiting: localStorage.getItem('inkwash.wondering.inkwash.world'), last: JSON.parse(localStorage.getItem('inkwash.world')).wonders.at(-1) }));
    assert(gone.mode === 'atlas' && gone.hidden && gone.waiting === null && gone.last.question === q.question && !gone.last.chose, JSON.stringify(gone));
    await pressKey('Escape');
    assert((await tv(() => window.__inktv.mode)) === 'who', 'and Back again, the seals');
  });

  await check('forgetting: Moon forgets the night ferry; what goes with it is said first and the choice starts on Keep it; forgotten, nothing of it is left in their world, the chapters kept apart or its drawings, and everything else stays', async () => {
    assert((await tv(() => window.__inktv.mode)) === 'who', 'on the seals');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas, null, { timeout: 20000 });
    await placeSettled();
    assert((await tv(() => window.__inktv.atlas.things)).includes('the night ferry'), JSON.stringify(await tv(() => window.__inktv.atlas.things)));
    for (let k = 0; k < 8 && (await tv(() => window.__inktv.atlas.card)) !== 'The night ferry'; k++) await pressKey('ArrowRight');
    const card = await tv(() => ({ name: document.querySelector('#atlas .side .name').textContent, origin: (document.querySelector('#atlas .side .origin') || {}).textContent }));
    assert(card.name === 'The night ferry' && card.origin === 'You named it.', `where it came from, on its card: ${JSON.stringify(card)}`);
    const was = await tv(() => window.__inktv.memory());
    const ferry = was.world.entities.find((e) => e.name === 'the night ferry');
    await inWorld('Forget the night ferry');
    const asked1 = await tv(() => ({ ask: document.querySelector('#atlas .side .ask').textContent, actions: window.__inktv.atlas.actions, on: window.__inktv.atlas.actions[window.__inktv.atlas.k], hints: document.querySelector('#hints').textContent }));
    assert(/^Forget the night ferry\? It goes from your world, with .+\. Everything else stays as it is\.$/.test(asked1.ask) && JSON.stringify(asked1.actions) === '["Keep it","Forget it"]' && asked1.on === 'Keep it' && /keep it/.test(asked1.hints), JSON.stringify(asked1));
    await wait(400);
    await shot('tv-20-forget-asked.png');
    // a press meant for something else keeps it
    await pressKey('Enter');
    assert((await tv(() => window.__inktv.atlas.things)).includes('the night ferry') && !(await tv(() => window.__inktv.memory())).world.forgotten, 'kept, and nothing written');
    await inWorld('Forget the night ferry');
    await pressKey('ArrowDown');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas && !window.__inktv.atlas.things.includes('the night ferry') && /^Forgotten/.test(document.querySelector('#atlas header p').textContent), null, { timeout: 20000 });
    const now = await tv(() => window.__inktv.memory());
    // nothing of it is left: in the world, in the chapters kept apart, or in a drawing
    for (const where of ['world', 'apart']) assert(!JSON.stringify(now[where]).toLowerCase().includes('ferry'), `no ferry in the ${where}: ${JSON.stringify(now[where]).slice(0, 400)}`);
    assert(now.world.forgotten.length === 1 && now.world.forgotten[0].removed.things === 1 && !JSON.stringify(now.world.forgotten).toLowerCase().includes('ferry'), JSON.stringify(now.world.forgotten));
    const its = new Map(ferry.appearances.map((a) => [a.night, a.strokes]));
    for (const d of now.drawings.filter(Boolean)) assert(!(its.get(d.n) || []).some((n) => d.strokes.includes(n)) && !d.real, `its marks out of chapter ${d.n}'s drawing: ${JSON.stringify(d)}`);
    // and everything else stays exactly as it was
    const others = (w) => JSON.stringify(w.entities.filter((e) => e.id !== ferry.id).map((e) => [e.id, e.name, e.appearances.map((a) => a.strokes)]));
    const lines = (w) => JSON.stringify(w.nights.map((n) => n.lines.filter((l) => !l.forgotten && !(l.entities || []).includes(ferry.id) && !/ferry/i.test(l.text)).map((l) => l.text)));
    assert(others(now.world) === others(was.world) && now.world.nights.length === was.world.nights.length && lines(now.world) === lines(was.world), JSON.stringify({ was: lines(was.world), now: lines(now.world) }));
    await wait(400);
    await shot('tv-20b-forgotten.png');
    await pressKey('Escape');
  });

  await check('the opening, on a TV that has never had Inkwash open: the demo child\'s drawing drawn as light, told back, and woken up as their world; any button goes to the seals, and it is not shown again', async () => {
    // a TV of its own (a new browser context: nothing kept)
    const o = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    o.on('pageerror', (e) => errors.push(`opening: ${e}`));
    o.on('console', (m) => { if (m.type() === 'error') errors.push(`opening: ${m.text()}`); });
    o.on('request', (r) => { if (!/^(http:\/\/localhost:|blob:|data:|file:)/.test(r.url())) outside.push(r.url()); });
    try {
      // a browser driven by tests is never shown it unless it asks (?intro)
      await o.goto(`${base}?guide=http://localhost:${GUIDE}&pace=fast&intro`);
      await o.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });
      const at = await o.evaluate(() => ({ mode: window.__inktv.mode, shown: !document.querySelector('#intro').hidden, opened: localStorage.getItem('inkwash.opened'), hints: document.querySelector('#hints').textContent }));
      assert(at.mode === 'intro' && at.shown && at.opened === '1' && !at.hints, JSON.stringify(at));
      // drawn as light, stroke by stroke, with the line that says what it is
      await o.waitForFunction(() => window.__inktv.opening && window.__inktv.opening.t > 6.5, null, { timeout: 20000 });
      const drawn = await o.evaluate(() => {
        const c = document.querySelector('#intro canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let lit = 0;
        for (let i = 3; i < d.length; i += 64) if (d[i] > 40) lit++;
        return { lit, cap: document.querySelector('#intro .cap').textContent };
      });
      assert(drawn.lit > 400 && drawn.cap === 'Draw what’s in your head, with your remote.', JSON.stringify(drawn));
      await o.screenshot({ path: join(shots, 'tv-00a-opening-drawn.png') });
      // told back, in the storyteller's own lines of that night
      await o.waitForFunction(() => document.querySelector('#intro .line.on') && document.querySelector('#intro .line').textContent, null, { timeout: 15000 });
      const told = await o.evaluate(() => document.querySelector('#intro .line').textContent);
      assert(told.length > 8 && !/claude|anthropic/i.test(told), told);
      // and woken up as their world, chapter by chapter
      await o.waitForFunction(() => document.querySelector('#intro .world.on img') && /Chapter 1/.test(document.querySelector('#intro .chapter').textContent), null, { timeout: 30000 });
      await o.screenshot({ path: join(shots, 'tv-00b-opening-world.png') });
      // any button: the seals, at once
      await o.keyboard.press('ArrowDown');
      await o.waitForFunction(() => window.__inktv.mode === 'who' && document.querySelector('#intro').hidden, null, { timeout: 5000 });
      // seen once, not again; and ?intro=0 never, even on a TV that has not seen it
      await o.goto(`${base}?guide=http://localhost:${GUIDE}&pace=fast`);
      await o.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });
      assert((await o.evaluate(() => window.__inktv.mode)) === 'who', 'not shown again');
      await o.evaluate(() => localStorage.removeItem('inkwash.opened'));
      await o.goto(`${base}?guide=http://localhost:${GUIDE}&pace=fast&intro=0`);
      await o.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 120000 });
      assert((await o.evaluate(() => window.__inktv.mode)) === 'who', '?intro=0: never');
    } finally { await o.close(); }
  });

  await check('worlds that meet: Moon sends the night ferry to visit Star’s world; it stands there with a card saying whose it is, Star’s storyteller brings it into the story and leaves it to Moon’s world, and it goes home', async () => {
    await page.goto(`${base}?guide=http://localhost:${GUIDE}&pace=fast&demo&idle=8&quiet=0`);
    await page.waitForFunction(() => window.__inktv && window.__inktv.mode === 'who', null, { timeout: 15000 });
    await pressKey('Enter');
    await inWorld('Send the night ferry to Star’s world');
    await page.waitForFunction(() => window.__inktv.atlas && /is visiting Star’s world/.test(window.__inktv.atlas.about), null, { timeout: 8000 });
    const sent = await tv(() => ({ a: window.__inktv.atlas, kept: JSON.parse(localStorage.getItem('inkwash.demo.visits')), own: localStorage.getItem('inkwash.visits') }));
    assert(sent.a.card === 'The night ferry' && sent.a.where === 'Visiting Star’s world.' && sent.a.all.includes('Bring the night ferry home') && !sent.a.all.some((x) => /^Send the night ferry to/.test(x)), JSON.stringify(sent.a));
    assert(sent.kept.length === 1 && sent.kept[0].thing === 'e1' && sent.kept[0].from === 'p1' && sent.kept[0].to === 'p2' && JSON.parse(sent.own || '[]').length === 0, `kept with the demo family, apart from the TV's own: ${JSON.stringify(sent)}`);
    // in Star's world: the night ferry stands there among Star's things, lit from Moon's painting
    await pressKey('Escape');
    await pressKey('ArrowRight');
    await pressKey('Enter');
    await placeSettled();
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.visiting.length === 1 && window.__inktv.atlas.pictures === window.__inktv.atlas.things.length, null, { timeout: 20000 });
    for (let k = 0; k < 8 && (await tv(() => window.__inktv.atlas.card)) !== 'The night ferry'; k++) await pressKey('ArrowLeft');
    const v = await tv(() => ({ a: window.__inktv.atlas, origin: document.querySelector('#atlas .card .origin').textContent, standing: window.__inktv.atlas.nodes.find((n) => n.name === 'the night ferry') }));
    assert(v.a.card === 'The night ferry' && v.origin === 'Visiting from Moon’s world.' && v.a.things.at(-1) === 'the night ferry', JSON.stringify(v));
    assert(v.a.all.includes('Send the night ferry home') && !v.a.all.some((x) => /^(Forget|Draw more of) the night ferry/.test(x)), `it is Moon's, not Star's to change: ${JSON.stringify(v.a.all)}`);
    assert(v.standing && v.a.nodes.filter((n) => n !== v.standing && n.name !== 'the night ferry').every((n) => Math.hypot(n.x - v.standing.x, n.y - v.standing.y) >= n.r + v.standing.r), `standing clear of Star's things: ${JSON.stringify(v.a.nodes)}`);
    assert(Object.keys(v.a.hops).some((id) => /^v-p1-e1$/.test(id)), `there in Star's world: ${JSON.stringify(v.a.hops)}`);
    await wait(900);
    await shot('tv-17-visiting.png');
    // tonight, Star's storyteller is told it is visiting, and brings it into the story
    const before = agentTurns().length;
    await inWorld('Draw something new');
    await page.evaluate(() => new Promise((ok) => { let n = 0; const f = () => (++n >= 20 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    await stroke(400, 820, 0, 1200);
    await stroke(1200, 300, Math.PI / 2, 700);
    await tv(() => window.__inktv.replayRate(1));
    await pressKey('p');
    // not marked as it came back: how it felt, in a word (the one it suggests), then the storyteller asks
    await page.waitForFunction(() => window.__inktv.mode === 'feel', null, { timeout: 30000 });
    await wait(1200);
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'ask', null, { timeout: 30000 });
    await wait(1500);
    // asked what it was, with a thing of Star's world among the answers: that one has its picture
    const q = await tv(() => ({ chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent), pictured: window.__inktv.pictured }));
    if (q.chips[0] === 'a boat') {
      await page.waitForFunction(() => window.__inktv.pictured.length === 1, null, { timeout: 8000 });
      const shown = await tv(() => ({ pictured: window.__inktv.pictured, img: document.querySelector('#feel .chip.pictured img').naturalWidth }));
      assert(shown.pictured[0] === q.chips[2] && q.chips[2] !== 'a cloud' && shown.img === 132, JSON.stringify({ q, shown }));
      await shot('tv-17b-a-picture-choice.png');
    }
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.tell && window.__inktv.tell.i === 0, null, { timeout: 15000 });
    const heard = [];
    for (let k = 0, n = await tv(() => window.__inktv.tell.n); k < n; k++) { heard.push(await tv(() => window.__inktv.tell && window.__inktv.tell.text)); await pressKey('Enter'); }
    await page.waitForFunction(() => window.__inktv.mode === 'offer' && !window.__inktv.guide.running, null, { timeout: 15000 });
    const visiting = section(firstText(agentTurns()[before].messages), 'VISITING');
    assert(visiting.length === 1 && visiting[0].name === 'the night ferry' && visiting[0].from === 'Moon’s world' && agentTurns()[before].young === true, JSON.stringify(visiting));
    assert(heard.includes('The night ferry came to visit, and was glad to be there.'), JSON.stringify(heard));
    // picture choices: an answer that names a thing in Star's world shows its picture, its strokes as
    // light; and so does the night ferry, drawn from Moon's world's drawing
    const pics = await tv(async () => ({ castle: await window.__inktv.pictureOf('Up to the moon castle'), ferry: await window.__inktv.pictureOf('The night ferry'), none: await window.__inktv.pictureOf('A friend') }));
    assert(pics.castle && pics.castle.name === 'the moon castle' && pics.castle.src === 'data:image/png;base64,' && pics.ferry && pics.ferry.name === 'the night ferry' && pics.ferry.src === 'data:image/png;base64,' && pics.none === null, JSON.stringify(pics));
    const after = await tv(() => ({ last: window.__inktv.guide.last, star: JSON.parse(localStorage.getItem('inkwash.demo.world.p2')).entities.map((e) => e.name), moon: JSON.parse(localStorage.getItem('inkwash.demo.world.p1')).entities.map((e) => e.name) }));
    assert(after.last.tools.at(-1) === 'remember' && !after.star.includes('the night ferry') && after.moon.includes('the night ferry'), `kept in Moon's world only: ${JSON.stringify(after)}`);
    // and Star sends it home
    await pressKey('ArrowLeft');
    assert((await tv(() => window.__inktv.offer.choice)) === 'That’s the end');
    await pressKey('Enter');
    await page.waitForFunction(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas, null, { timeout: 8000 });
    for (let k = 0; k < 8 && (await tv(() => window.__inktv.atlas.card)) !== 'The night ferry'; k++) await pressKey('ArrowLeft');
    await inWorld('Send the night ferry home');
    await page.waitForFunction(() => window.__inktv.atlas && /went home to Moon’s world/.test(window.__inktv.atlas.about), null, { timeout: 8000 });
    const home = await tv(() => ({ a: window.__inktv.atlas, kept: JSON.parse(localStorage.getItem('inkwash.demo.visits')) }));
    assert(home.a.visiting.length === 0 && !home.a.things.includes('the night ferry') && home.kept.length === 0, JSON.stringify(home));
    await pressKey('Escape');
  });

  await check('no errors in the page, and nothing fetched from outside it', async () => {
    assert(!errors.length, errors.join('\n'));
    assert(!outside.length, outside.join('\n'));
  });
} finally {
  await browser.close();
  server.close();
  guide.close();
}
console.log(`# ${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
