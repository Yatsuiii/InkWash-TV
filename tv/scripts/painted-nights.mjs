// The TV, driven through nights painted by a script, for scripts/kids-dreams.mjs and
// scripts/grown-dreams.mjs: the real page, brush, ink, harness and story server code, pressed the
// way a remote presses it, with a phone in a second tab. The storyteller is a script too (`direct`
// below): it calls the storyteller's tools as Claude would and tells the lines a night gives it, so
// no model is called and nothing costs anything; so is the Worldbuilder, when it is asked. Where a
// night has a `first` telling, that is told first, the way a model might tell it carelessly, to see
// what the TV does with it.
//
// A night: its strokes ({ at: [x, y], heading, ms, ink?, press?: ms ▼ held at the end, ease?,
// steer?: [[key, from ms, to ms]] }); what was said on the phone (after the stroke numbered
// `after`); how it was marked as it came back ({ stroke index: [keys held] }); where it starts
// (`start`: something new, `{ more: name }` of one thing in their world, or `{ wonder }`, the
// Worldbuilder's question about a thing, answered with a choice or with the painting); and the
// storyteller's script, `guide`: what it asks, `first` (told first, as a model might), `lines`, how
// they mark each line as it is told (`react`: { line index: 'no' }) and what is told again of what
// was not quite (`again`), what it keeps (`remember`; an earlier thing by `ref`); `sameAs`: a thing
// from an earlier night the TV should recognise (at stroke `at`). `ending`: what happens next,
// painted, with its own strokes, marks and guide. `recap`: last time's story heard first, if their
// world offers it.
//
// Or the real storyteller and Worldbuilder (openTV's `claude`: a Messages API client, as
// server/claude-cli.mjs's): then nothing is told from here. A night says only what a person does
// (strokes, words on the phone, marks, which line is not quite) and, in `person`, how they answer
// what they are asked: `answer(q)` a chip ({ chip }) or their own words on the phone ({ say }), and
// `same(q)` whether a thing asked about is the one from before. `offer`: what they do as the
// painting wakes: 'end', 'next' (paint what happens next: `ending`) or 'inside' (step inside it).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';
import { createHandler } from '../server/lambda.mjs';
import { AGENT_SYSTEM, AGENT_YOUNG } from '../server/agent.mjs';
import { WONDER_SYSTEM } from '../server/worldbuilder.mjs';
import { memoryCommons } from '../server/commons-store.mjs';
import { memorySessions } from '../server/phone.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'));

export const R = 0, L = Math.PI, UP = -Math.PI / 2, DOWN = Math.PI / 2;
// a wavy line: the brush steered left and right in turn
export const wavy = (ms, every = 650, on = 260) => Array.from({ length: Math.floor((ms - 300) / every) }, (_, i) => [i % 2 ? 'ArrowRight' : 'ArrowLeft', 300 + i * every, 300 + i * every + on]);
export const pad = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------- the scripted storyteller

const textOf = (c) => (typeof c === 'string' ? c : (c || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
const section = (text, name) => { const m = new RegExp(`^${name}\\b[^\\n]*\\n(.+)$`, 'm').exec(text); try { return m ? JSON.parse(m[1]) : null; } catch { return null; } };
function callsIn(messages) {
  const out = [];
  messages.forEach((m, i) => {
    if (m.role !== 'assistant') return;
    for (const b of m.content.filter((x) => x.type === 'tool_use')) {
      const r = (messages[i + 1]?.content || []).find((x) => x.type === 'tool_result' && x.tool_use_id === b.id);
      let result = null;
      try { result = r ? JSON.parse(textOf(r.content)) : null; } catch { result = textOf(r && r.content); }
      out.push({ name: b.name, input: b.input, result, error: !!(r && r.is_error) });
    }
  });
  return out;
}
let script = null; // what is being told now, and the log of what the TV did with it
let wondering = null; // the Worldbuilder's question, when it is asked
function direct(params) {
  const messages = params.messages, first = textOf(messages[0].content);
  const world = section(first, 'THEIR DREAM WORLD') || {};
  const S = script, log = S.log;
  log.young = (params.system || []).some((b) => b.text === AGENT_YOUNG);
  log.hints = (world.hints || []).map((h) => ({ name: h.name, stroke: h.stroke, from: h.came_before_as && h.came_before_as.night }));
  const chosen = section(first, 'WHAT THEY CHOSE TO PAINT');
  if (chosen) log.chosen = chosen;
  const calls = callsIn(messages), did = (n, f = () => true) => calls.some((c) => c.name === n && f(c));
  let k = 0;
  const use = (name, input) => ({ content: [{ type: 'tool_use', id: `toolu_nights_${messages.length}_${k++}`, name, input }], stop_reason: 'tool_use' });
  const ending = section(first, 'WHAT HAPPENS NEXT');
  const fresh = ending ? ending.new_strokes : null;
  if (!did('look')) return use('look', { strokes: fresh || [S.at || (S.asks[0] && S.asks[0].strokes[0]) || 1], zoom: true });
  // a thing from an earlier night, if the TV sees it in tonight's marks; asked about, as Claude would
  const hint = S.sameAs && (world.hints || []).find((h) => h.name === S.sameAs);
  log.recognised = S.sameAs ? !!hint : null;
  const asked = calls.filter((c) => c.name === 'ask').length;
  if (hint) {
    if (!did('thing')) return use('thing', { id: hint.looks_like });
    if (!did('look', (c) => c.input.night)) return use('look', { night: hint.came_before_as.night, strokes: hint.came_before_as.strokes, zoom: true });
    if (!did('ask')) return use('ask', { question: `Is this ${/^[A-Z]/.test(S.sameAs) ? S.sameAs : S.sameAs.toLowerCase()} again?`, choices: ['Yes, the same', 'No, something else'], strokes: [hint.stroke], show: { night: hint.came_before_as.night, strokes: hint.came_before_as.strokes } });
  } else if (asked < S.asks.length) {
    // at most two questions, about the painting
    const q = S.asks[asked];
    return use('ask', { question: q.question, choices: q.choices, strokes: fresh || q.strokes });
  }
  const told = calls.filter((c) => c.name === 'tell');
  log.tellings = told.map((c) => ({ lines: c.input.lines.map((l) => l.text), sentBack: c.error ? String(typeof c.result === 'string' ? c.result : JSON.stringify(c.result)).slice(0, 600) : null, held: c.result && c.result.held_back ? c.result.held_back : undefined, alts: c.result && c.result.told_the_alt ? c.result.told_the_alt : undefined }));
  const ok = told.filter((c) => !c.error);
  if (!ok.length) {
    if (told.length >= 3) throw new Error(`"${S.title}": sent back three times: ${JSON.stringify(log.tellings)}`);
    // first as a model might carelessly tell it, if the night has that; then as it should be
    return use('tell', { title: S.title, lines: !told.length && S.first ? S.first : S.lines });
  }
  // what they said was not quite, told again, as the night gives it
  const notQuite = ((ok[0].result && ok[0].result.reactions) || []).filter((r) => r.said === 'no').map((r) => r.line);
  if (notQuite.length) log.notQuite = notQuite;
  if (notQuite.length && S.again && ok.length < 2) return use('tell', { title: S.title, lines: S.again });
  const remembers = calls.filter((c) => c.name === 'remember');
  if (!remembers.some((c) => !c.error) && remembers.length < 2) {
    const R_ = S.remember;
    // earlier things by the ids the brief gives; sent back, as a model would, by the hints' too
    const idOf = (name) => (world.things || []).find((t) => t.name === name)?.id || (remembers.length ? (world.hints || []).find((h) => h.name === name)?.looks_like : undefined);
    const things = R_.things.map(({ ref, ...t }) => (ref ? { id: idOf(ref), ...t } : t));
    if (!remembers.length) log.unknownRefs = R_.things.filter((t) => t.ref && !idOf(t.ref)).map((t) => t.ref);
    const resolved = R_.settles ? (world.open || []).filter((o) => o.text === R_.settles).map((o) => o.id) : [];
    return use('remember', { things, facts: R_.facts || [], resolved });
  }
  log.remembered = remembers.map((c) => (c.error ? `sent back: ${String(c.result).slice(0, 400)}` : `kept: ${JSON.stringify(c.result && c.result.kept)}`));
  return { content: [{ type: 'text', text: log.young ? 'Sleep tight.' : 'Sleep well.' }], stop_reason: 'end_turn' };
}
// The Worldbuilder: the night's question, about the thing it names
function wonderScript(params) {
  const W = wondering, text = String(params.messages[params.messages.length - 1].content);
  let brief = null;
  try { brief = JSON.parse(text.replace(/^THEIR WORLD\n/, '').split('\n\n')[0]); } catch { /* none */ }
  const things = (brief && brief.things) || [];
  const about = (things.find((t) => t.name === W.about) || {}).id;
  W.log.shown = things.map((t) => t.name);
  W.log.found = !!about;
  return { content: [{ type: 'text', text: JSON.stringify({ about, question: W.question, choices: W.choices }) }] };
}
function claude(params) {
  const system = Array.isArray(params.system) ? params.system[0].text : String(params.system || '');
  if (system === AGENT_SYSTEM) return { model: params.model, usage: { input_tokens: 0, output_tokens: 0 }, ...direct(params) };
  if (wondering && system.startsWith(WONDER_SYSTEM)) return wonderScript(params);
  // the remarks while painting, and the Illustrator: nothing (no picture is made: each painting
  // wakes up at night instead)
  return { content: [{ type: 'text', text: '{}' }] };
}

// ---------------------------------------------------------------- the TV, driven

// `claude`: the real storyteller's client (else the script above); `patience`: how many times longer
// to wait for what a model does
// tellShots: each line of a night's first telling held a few seconds and shot (`NN-t1.png`…), to see
// each part of the dream wake as its line is told
// `profile`: a folder the browser keeps its storage in, so that a TV can be opened again as it was
// left, another day (start({ clean: false })); without it, every TV is new.
// `pictures`: an image model stood in for (Nova Canvas's request body in, a picture's base64 out),
// so that things come to life; without it, no pictures are made.
export async function openTV({ out, port = 5193, guidePort = 5194, claude: real = null, patience = 1, tellShots = false, profile = null, pictures = null, clock = false }) {
  let at = '00';
  mkdirSync(out, { recursive: true });
  const server = await serve(port);
  const handler = createHandler({ claude: real || { messages: { async create(p) { return claude(p); } } }, speak: async () => null, paint: pictures, commons: memoryCommons(), sessions: memorySessions() });
  const slow = (ms) => ms * patience;
  const guide = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      const r = await handler({ rawPath: new URL(req.url, 'http://x').pathname, headers: req.headers, body, requestContext: { http: { method: req.method } } });
      res.writeHead(r.statusCode, r.headers);
      res.end(r.body);
    });
  });
  await new Promise((ok) => guide.listen(guidePort, ok));
  const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const kept = profile ? await chromium.launchPersistentContext(profile, { args, viewport: { width: 1920, height: 1080 } }) : null;
  const browser = kept ? null : await chromium.launch({ args });
  const page = kept ? kept.pages()[0] || (await kept.newPage()) : await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const phone = kept ? await kept.newPage() : await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (kept) await phone.setViewportSize({ width: 390, height: 844 });
  // `clock`: the TV's own clock can be put forward to a later day (`day`), so nights painted an
  // hour apart here are days apart to the TV, as a person's are. How far forward is kept in the
  // TV's storage, so a TV opened again on another run is on the day it was left at
  if (clock) {
    const SHIFT = () => {
      const Real = Date, k = '__testClock';
      let off = 0;
      try { off = Number(localStorage.getItem(k)) || 0; } catch {}
      class Shifted extends Real {
        constructor(...a) { if (a.length) super(...a); else super(Real.now() + off); }
        static now() { return Real.now() + off; }
      }
      window.Date = Shifted;
      window.__clock = { set(t) { off = t - Real.now(); try { localStorage.setItem(k, String(off)); } catch {} return off; }, now: () => Real.now() + off };
    };
    if (kept) await kept.addInitScript(SHIFT);
    else { await page.addInitScript(SHIFT); await phone.addInitScript(SHIFT); }
  }
  const errors = [], outside = [], failed = {};
  page.on('pageerror', (e) => errors.push(String(e)));
  // a page that crashes is closed, so that nothing waits on it for ever
  page.on('crash', () => { errors.push('the TV page crashed'); page.close().catch(() => {}); });
  // the page's own last words, for when a night stops
  const said = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 502/.test(m.text())) errors.push(m.text()); said.push(`${new Date().toISOString().slice(11, 19)} ${m.type()}: ${m.text().slice(0, 300)}`); if (said.length > 120) said.shift(); });
  page.on('request', (r) => { if (!/^(http:\/\/localhost:|blob:|data:|file:)/.test(r.url())) outside.push(r.url()); });
  // what the guide service answered with an error: the scripted storyteller says nothing while
  // they paint, and the Illustrator makes no pictures, so those come back empty, as when the
  // service is down
  page.on('response', (r) => { if (r.status() >= 400) { const k = `${r.status()} ${new URL(r.url()).pathname}`; failed[k] = (failed[k] || 0) + 1; } });

  const tv = (fn, arg) => page.evaluate(fn, arg);
  const settle = () => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  const MEDIA = { MediaFastForward: 228, MediaRewind: 227, MediaPlayPause: 179 };
  const key = async (k) => {
    if (MEDIA[k]) await page.evaluate(([name, keyCode]) => { dispatchEvent(new KeyboardEvent('keydown', { key: name, keyCode, bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { key: name, keyCode, bubbles: true })); }, [k, MEDIA[k]]);
    else await page.keyboard.press(k);
    await settle();
  };
  const wait = (ms) => page.waitForTimeout(ms);
  const until = (fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
  const shot = (name) => page.screenshot({ path: join(out, name) });
  const INK = ['dense', 'light', 'water', 'indigo', 'gold', 'cinnabar'];
  let paired = false;

  async function chooseInk(want) {
    for (let i = 0; i < INK.length && (await tv(() => window.__inktv.brush.ink)) !== want; i++) {
      const at = INK.indexOf(await tv(() => window.__inktv.brush.ink));
      await key(INK.indexOf(want) > at ? 'MediaFastForward' : 'MediaRewind');
    }
  }
  async function paint(s) {
    await until(() => !window.__inktv.wet, null, 20000).catch(() => {});
    if (s.ink) await chooseInk(s.ink);
    await tv(([x, y, h]) => window.__inktv.place(x, y, h), [s.at[0], s.at[1], s.heading]);
    await key('Enter');
    const t0 = Date.now();
    if (s.ease) await page.keyboard.down('ArrowUp');
    for (const [k, from, to] of s.steer || []) {
      await wait(Math.max(0, from - (Date.now() - t0)));
      await page.keyboard.down(k);
      await wait(Math.max(0, to - (Date.now() - t0)));
      await page.keyboard.up(k);
    }
    await wait(Math.max(0, s.ms - (Date.now() - t0)));
    if (s.ease) await page.keyboard.up('ArrowUp');
    if (s.press) { await page.keyboard.down('ArrowDown'); await wait(s.press); await page.keyboard.up('ArrowDown'); }
    await key('Enter');
    await until(() => !window.__inktv.brush.touching, null, 8000);
    await wait(500);
  }
  async function speak(text) {
    await phone.bringToFront();
    await phone.fill('#text', text);
    await phone.click('#send');
    await page.bringToFront();
    await until((t) => window.__inktv.words.some((w) => w.text === t), text, 10000);
  }
  // said on the phone while a question is asked: it answers it
  async function sayAnswer(text) {
    await phone.bringToFront();
    await phone.fill('#text', text);
    await phone.click('#send');
    await page.bringToFront();
  }
  async function feel(marks) {
    await tv(() => window.__inktv.replayRate(0.5));
    await key('MediaPlayPause');
    await until(() => window.__inktv.mode === 'replay');
    let shown = -1;
    while ((await tv(() => window.__inktv.mode)) === 'replay') {
      const now = await tv(() => window.__inktv.line && window.__inktv.line.shown);
      if (now !== shown && now != null && now >= 0) {
        shown = now;
        const held = (marks[now] || []).filter((k) => typeof k === 'string');
        for (const k of held) await page.keyboard.down(k);
        if (held.length) {
          await until((n) => !window.__inktv.line || window.__inktv.line.shown !== n || window.__inktv.mode !== 'replay', now, 20000);
          for (const k of held) await page.keyboard.up(k);
        }
      }
      await wait(50);
    }
  }
  // Each question answered: "Yes, the same" if it asks whether it is something from before, else
  // the night's answer to it. Each telling heard line by line: ▲ "that's it", or ▼ "not quite"
  // where the night's `react` says so (the first telling only); a telling told again is heard too.
  async function guided(asks, log, react = {}, person = null) {
    log.asked = [];
    log.heard = [];
    for (let told = 0; ;) {
      await until(() => ['ask', 'tell', 'feel'].includes(window.__inktv.mode) || (!window.__inktv.guide.running && ['paint', 'offer', 'atlas'].includes(window.__inktv.mode)), null, slow(60000));
      const mode = await tv(() => window.__inktv.mode);
      if (mode === 'feel') {
        // nothing marked as it came back: how did it feel, in a word (the one the TV lights from
        // how they painted, unless the person would say another)
        const offered = (await tv(() => window.__inktv.feel)).choice;
        const plain = (t) => String(t).replace(/’/g, "'").toLowerCase();
        const want = person && person.feel ? (await tv(() => [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent))).find((c) => plain(c) === plain(person.feel)) : null;
        for (let k = 0; want && k < 9 && (await tv(() => window.__inktv.feel.choice)) !== want; k++) await key('ArrowRight');
        log.felt = { offered, chose: (await tv(() => window.__inktv.feel)).choice };
        await key('Enter');
        await until(() => window.__inktv.mode !== 'feel', null, slow(10000));
        continue;
      }
      if (mode === 'ask') {
        const q = await tv(() => ({ question: document.querySelector('#feel .ask') ? document.querySelector('#feel .ask').textContent : null, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent) }));
        const known = asks.find((a) => a.choices.every((c) => q.chips.includes(c)));
        let want = known ? known.answer : null, said = null;
        // the same as on an earlier night? Yes, unless the person says it isn't
        if (q.chips.includes('Yes, the same')) want = !person || person.same(q) ? 'Yes, the same' : q.chips.find((c) => /^No\b/.test(c)) || 'Yes, the same';
        else if (!known && person) ({ chip: want = null, say: said = null } = person.answer(q) || {});
        log.asked.push({ ...q, answered: want, ...(said ? { said } : {}) });
        if (said) {
          await sayAnswer(said);
          // their words come back as the first answer on the TV, lit, and are taken; OK if it waits
          const taken = await until((t) => window.__inktv.mode !== 'ask' || (document.querySelector('#feel .ask') || {}).textContent !== t, q.question, slow(3000)).then(() => true, () => false);
          if (!taken) await key('Enter');
        } else {
          const i = q.chips.indexOf(want);
          if (i < 0) throw new Error(`no answer for ${JSON.stringify(q)}`);
          for (let k = 0; k < i; k++) await key('ArrowRight');
          await key('Enter');
        }
        await until((t) => window.__inktv.mode !== 'ask' || (document.querySelector('#feel .ask') || {}).textContent !== t, q.question, slow(30000));
        continue;
      }
      if (mode !== 'tell') break;
      // a telling, followed by its title: the next one (told again, with no model to wait for
      // here) can begin the moment this one ends
      await until(() => window.__inktv.tell && window.__inktv.tell.i >= 0, null, slow(30000));
      const title = await tv(() => window.__inktv.tell.title);
      const heard = [];
      for (;;) {
        const t = await tv(() => window.__inktv.tell && { i: window.__inktv.tell.i, text: window.__inktv.tell.text, title: window.__inktv.tell.title });
        if (!t || t.title !== title) break;
        heard[t.i] = t.text;
        if (tellShots && told === 0) { await wait(3200); await shot(`${at}-t${t.i + 1}.png`); }
        await key(told === 0 && react[t.i] === 'no' ? 'ArrowDown' : 'ArrowUp');
        await wait(250);
        await key('Enter');
        await until(([i, ti]) => !window.__inktv.tell || window.__inktv.tell.title !== ti || window.__inktv.tell.i !== i, [t.i, title], 15000);
      }
      log.heard.push({ title, lines: heard.filter((x) => x != null) });
      told++;
    }
    await until(() => !window.__inktv.guide.running && ['paint', 'offer', 'atlas'].includes(window.__inktv.mode), null, slow(30000));
    // the TV's checks on each telling: anchored lines, free lines, what was sent back or held back;
    // and, if the storyteller couldn't be reached, why (the TV then tells their line plainly)
    log.checks = await tv(() => ((window.__inktv.guide.last || {}).checks || []));
    const last = await tv(() => window.__inktv.guide.last || {});
    log.tools = (last.tools || []).map((t) => (typeof t === 'string' ? t : t.name || t.tool || JSON.stringify(t).slice(0, 40)));
    log.painted = (last.painted || []).map((p) => (typeof p === 'string' ? p : p.detail || JSON.stringify(p)).slice(0, 160));
    if (last.error) log.guideError = last.error;
  }
  // in their world: choose what to do (an action named exactly, or the first beginning `prefix`)
  async function act(text, { prefix = false } = {}) {
    await until(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas, null, 10000);
    const is = (a) => (prefix ? a.startsWith(text) : a === text);
    // the first few on screen, the rest under More…
    for (let k = 0; k < 10; k++) {
      const a = await tv(() => window.__inktv.atlas.actions[window.__inktv.atlas.k]);
      if (is(a)) break;
      if (a === 'More…' && !(await tv(() => window.__inktv.atlas.actions)).some(is)) await key('Enter');
      else await key('ArrowDown');
    }
    const a = await tv(() => window.__inktv.atlas.actions[window.__inktv.atlas.k]);
    if (!(prefix ? a.startsWith(text) : a === text)) throw new Error(`no "${text}" in their world: ${JSON.stringify(await tv(() => window.__inktv.atlas.actions))}`);
    await key('Enter');
  }
  // a thing in their world, shown (◀ ▶)
  async function showThing(name) {
    const things = await tv(() => window.__inktv.atlas.things);
    // the real storyteller names things itself: a word of the name will do, or the first thing
    // a thing called just that ("the sea", not "the town by the sea"), else one whose name has it
    const exact = things.find((t) => t.toLowerCase().replace(/^(the|a|an|my) /, '') === String(name).toLowerCase());
    const want = things.includes(name) ? name : real ? exact || things.find((t) => t.toLowerCase().includes(String(name).toLowerCase())) || things[0] : null;
    if (!want) throw new Error(`no ${name} in their world: ${JSON.stringify(things)}`);
    for (let k = 0; k < things.length && (await tv(() => window.__inktv.atlas.things[window.__inktv.atlas.i])) !== want; k++) await key('ArrowRight');
    return want;
  }
  // Their world's place, written as its story started: they are asked how it should look, and the
  // first look offered is chosen, so the place is written again in it
  async function settleLook(log) {
    await until(() => !window.__inktv.placeAsking, null, slow(60000));
    const L = await tv(() => window.__inktv.placeLook);
    if (!L || L.waiting) return;
    log.look = { question: L.question, options: L.options, was: await tv(() => window.__inktv.placeScene && window.__inktv.placeScene.look) };
    await shot(`${log.shots}-0-how-should-it-look.png`);
    if (!L.options.length) { await key('Escape'); return; }
    await key('Enter');
    await until(() => !window.__inktv.placeLook, null, slow(60000));
    log.look.now = await tv(() => window.__inktv.placeScene && window.__inktv.placeScene.look);
  }
  // To the paper: something new; more of one thing in their world; or the Worldbuilder's question
  // about a thing, answered (a choice kept, then something new) or painted as their own answer
  async function toPaper(start, log) {
    await until(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas, null, 10000);
    await settleLook(log);
    if (start && start.more) {
      await act(`Draw more of ${await showThing(start.more)}`);
    } else if (start && start.wonder) {
      const W = start.wonder;
      log.wonder = {};
      if (!real) wondering = { ...W, log: log.wonder };
      log.wonder.about = await showThing(W.about);
      await act('What’s out there?');
      await until(() => !window.__inktv.atlas.actions.includes('Wondering…'), null, slow(20000));
      log.wonder.actions = await tv(() => window.__inktv.atlas.actions);
      log.wonder.ask = await tv(() => (document.querySelector('#atlas .side .ask') || {}).textContent || null);
      await shot(`${log.shots}-0-what-is-out-there.png`);
      wondering = null;
      const choices = log.wonder.actions.filter((a) => !['Draw my own answer', 'Not now'].includes(a));
      const want = W.choose === 'own' ? 'Draw my own answer' : real ? choices[W.choose || 0] : W.choices[W.choose].say;
      if (!log.wonder.actions.includes(want)) throw new Error(`the Worldbuilder's question isn't there: ${JSON.stringify(log.wonder.actions)}`);
      for (let k = 0; k < 6 && (await tv(() => window.__inktv.atlas.actions[window.__inktv.atlas.k])) !== want; k++) await key('ArrowDown');
      await key('Enter');
      if (W.choose !== 'own') {
        await until(() => window.__inktv.mode === 'atlas' && !window.__inktv.atlas.actions.includes('Not now'), null, 10000);
        log.wonder.kept = await tv(() => window.__inktv.atlas.about);
        await act('Draw something new');
      }
    } else await act((await tv(() => window.__inktv.atlas.all)).includes('Draw something new') ? 'Draw something new' : 'Draw the first thing in it');
    await until(() => window.__inktv.mode === 'paint', null, 10000);
  }

  // a new TV, opened clean; or, `clean: false`, as it was left
  async function start({ clean = true } = {}) {
    await page.goto(`http://localhost:${port}/?guide=http://localhost:${guidePort}&pace=fast&idle=999&quiet=0`);
    await until(() => window.__inktv && window.__inktv.ready, null, 120000);
    if (clean) {
      await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('inkwash'); });
      await page.reload();
      await until(() => window.__inktv && window.__inktv.ready, null, 120000);
    }
    await until(() => window.__inktv.mode === 'who');
  }
  // the TV opened again, as it was left (a later day, say)
  async function reopen() {
    await page.reload();
    await until(() => window.__inktv && window.__inktv.ready, null, 120000);
    paired = false;
  }
  // The TV's clock put forward to `t` (ms), and the TV turned on again, as on a later day; or
  // what time it is on the TV
  async function day(t) {
    await tv((x) => window.__clock.set(x), t);
    await reopen();
    await until(() => window.__inktv.mode === 'who', null, 30000);
  }
  const now = () => tv(() => (window.__clock ? window.__clock.now() : Date.now()));
  // Last time's story, if their world offers it: the Previously card, and each line as it is heard
  // again, then home
  async function hearRecap() {
    const all = await tv(() => window.__inktv.atlas.all);
    if (!all.includes('Hear last time’s story')) return { offered: false };
    await act('Hear last time’s story');
    await until(() => window.__inktv.previously, null, 8000).catch(() => {});
    const r = { offered: true, previously: await tv(() => window.__inktv.previously) };
    await wait(2800);
    await shot(`${at}-0-previously.png`);
    await key('Enter');
    await until(() => window.__inktv.recap && window.__inktv.recap.i === 0, null, 10000);
    const x = await tv(() => window.__inktv.recap);
    r.title = x.title;
    r.lines = [];
    for (let k = 0; k < x.n; k++) {
      r.lines.push(await tv(() => window.__inktv.recap && window.__inktv.recap.text));
      await wait(1200);
      await key('Enter');
    }
    await until(() => window.__inktv.mode === 'offer' || window.__inktv.mode === 'atlas', null, 15000).catch(() => {});
    r.offer = await tv(() => ({ mode: window.__inktv.mode, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent) }));
    if ((await tv(() => window.__inktv.mode)) === 'offer') await key('Escape');
    await until(() => window.__inktv.mode === 'atlas', null, 15000);
    await wait(1500);
    return r;
  }
  // From their world to the seals
  async function seals() {
    for (let k = 0; k < 3 && (await tv(() => window.__inktv.mode)) !== 'who'; k++) { await key('Escape'); await wait(300); }
    await until(() => window.__inktv.mode === 'who', null, 10000);
  }
  const onTile = () => tv(() => (document.querySelector('#who .tile.on .name') || {}).textContent);
  // A new painter on this TV: a seal, a grown-up's or a child's, and their own world
  async function newPainter({ seal, young = false }) {
    await until(() => window.__inktv.mode === 'who');
    if ((await tv(() => window.__inktv.who.step)) === 'pick') {
      for (let k = 0; k < 9 && (await onTile()) !== 'Someone new'; k++) await key('ArrowRight');
      await key('Enter');
    }
    for (let k = 0; k < 9 && (await onTile()) !== seal; k++) await key('ArrowRight');
    if ((await onTile()) !== seal) throw new Error(`no ${seal} seal free`);
    await key('Enter');
    if (young) await key('ArrowRight');
    await key('Enter');
    await until(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas, null, 10000);
    return tv(() => window.__inktv.who.painter);
  }
  // A painter already on this TV, by their seal, to their world
  async function pick(seal) {
    await until(() => window.__inktv.mode === 'who');
    for (let k = 0; k < 9 && (await onTile()) !== seal; k++) await key('ArrowRight');
    if ((await onTile()) !== seal) throw new Error(`no painter with the ${seal} seal`);
    await key('Enter');
    await until(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas, null, 10000);
    return tv(() => ({ painter: window.__inktv.who.painter, home: window.__inktv.atlas }));
  }

  // A night, from their world back to it: painted, marked as it comes back, asked, told, woken up
  // at night, and what happens next painted or not. Its log, and screenshots `NN-…`.
  async function night(N, n) {
    const log = { night: n, title: N.title, dream: N.dream, who: N.who || null, main: {}, ending: null, shots: pad(n) };
    at = pad(n);
    const t0 = Date.now();
    log.home = await tv(() => window.__inktv.atlas && window.__inktv.atlas.about);
    log.actions = await tv(() => window.__inktv.atlas && window.__inktv.atlas.all);
    if (clock) log.clock = new Date(await now()).toISOString();
    if (N.recap) log.recap = await hearRecap();
    await toPaper(N.start, log);
    if (N.words.length && !paired) {
      await until(() => window.__inktv.phone && window.__inktv.phone.url, null, 10000);
      await phone.goto(await tv(() => window.__inktv.phone.url));
      await page.bringToFront();
      paired = true;
    }
    await wait(600);
    for (const [k, s] of N.strokes.entries()) {
      await paint(s);
      for (const w of N.words.filter((x) => x.after === k + 1)) await speak(w.text);
    }
    log.strokes = await tv(() => window.__inktv.strokes.map((s) => ({ ink: s.ink, box: s.box, length: s.length })));
    await shot(`${pad(n)}-a-painted.png`);
    if (!real) script = { title: N.title, ...N.guide, log: log.main };
    await feel(N.marks);
    await guided(N.guide ? N.guide.asks : [], log.main, N.react || (N.guide && N.guide.react) || {}, N.person || null);
    // the painting wakes up at night, as the story ends (no picture is made)
    await until(() => window.__inktv.real && window.__inktv.real.shown && /^blob:/.test(window.__inktv.real.src), null, 20000).catch(() => { log.woke = false; });
    if (log.woke !== false) { log.woke = true; await wait(4800); await shot(`${pad(n)}-b-woken.png`); }
    log.offer = await tv(() => ({ mode: window.__inktv.mode, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent) }));
    const offer = N.offer || (N.ending ? 'next' : 'end');
    // stepped inside it first, if they want to: the first thing in it gone to, and back
    if (log.offer.mode === 'offer' && (offer === 'inside' || N.inside) && log.offer.chips.includes('Step inside')) {
      for (let k = 0; k < 4 && (await tv(() => window.__inktv.offer && window.__inktv.offer.choice)) !== 'Step inside'; k++) await key('ArrowRight');
      await key('Enter');
      await until(() => window.__inktv.inside && window.__inktv.inside.phase === 'open', null, 20000).catch(() => {});
      await wait(1200);
      await key('Enter');
      await wait(2200);
      log.inside = await tv(() => window.__inktv.inside && { caption: window.__inktv.inside.caption, pieces: (window.__inktv.inside.pieces || []).map((p) => p.name) });
      await shot(`${pad(n)}-e-inside.png`);
      await key('Escape');
      await until(() => window.__inktv.mode === 'offer', null, 15000).catch(() => {});
      await wait(1500);
    }
    if ((await tv(() => window.__inktv.mode)) === 'offer') {
      if (offer !== 'next' || !N.ending) await key('Escape');
      else {
        log.ending = {};
        for (let k = 0; k < 4 && (await tv(() => window.__inktv.offer && window.__inktv.offer.choice)) !== 'Draw what happens next'; k++) await key('ArrowLeft');
        await key('Enter');
        await until(() => window.__inktv.mode === 'paint', null, 10000);
        for (const [k, s] of N.ending.strokes.entries()) {
          await paint(s);
          for (const w of (N.ending.words || []).filter((x) => x.after === k + 1)) await speak(w.text);
        }
        await shot(`${pad(n)}-c-what-happens-next.png`);
        if (!real) script = { title: N.title, ...N.ending.guide, log: log.ending };
        await feel(N.ending.marks);
        await guided(N.ending.guide ? N.ending.guide.asks : [], log.ending, N.ending.react || (N.ending.guide && N.ending.guide.react) || {}, N.person || null);
        await until(() => window.__inktv.real && window.__inktv.real.shown && /^blob:/.test(window.__inktv.real.src), null, 20000).catch(() => {});
        await wait(4800);
        await shot(`${pad(n)}-d-woken-again.png`);
        if ((await tv(() => window.__inktv.mode)) === 'offer') await key('Escape');
      }
    }
    await until(() => window.__inktv.mode === 'atlas', null, slow(15000));
    await wait(2500);
    log.cards = await tv(() => window.__inktv.collected.last);
    log.world = await tv(() => ({ nights: window.__inktv.world.nights, things: window.__inktv.atlas.things }));
    // what the page holds after a night: does it grow, night after night?
    log.memory = await tv(() => ({ heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, nodes: document.getElementsByTagName('*').length, canvases: document.querySelectorAll('canvas').length, images: document.images.length, woken: document.querySelectorAll('#woken > *').length }));
    log.seconds = Math.round((Date.now() - t0) / 1000);
    return log;
  }

  // Their world, as it stands: its home, shot; and, if asked, walked through to every thing lit in
  // it, ▶‖ on the last, and home again
  async function visit({ prefix, walk = false, most = Infinity }) {
    await until(() => window.__inktv.mode === 'atlas', null, 10000);
    await page.waitForFunction(() => window.__inktv.atlas && window.__inktv.atlas.pictures >= Math.min(14, window.__inktv.atlas.things.length) - 2, null, { timeout: 60000 }).catch(() => {});
    await wait(2500);
    const home = await tv(() => ({ atlas: window.__inktv.atlas, lit: document.querySelectorAll('#atlas .thing').length, labels: [...document.querySelectorAll('#atlas .thing .label')].map((l) => l.textContent) }));
    await shot(`${prefix}-world.png`);
    if (!walk) return { home };
    await act('Walk through your world');
    await until(() => !!window.__inktv.walk, null, 10000);
    await wait(800);
    const start_ = await tv(() => window.__inktv.walk);
    await shot(`${prefix}-walk-start.png`);
    const walked = [];
    for (let k = 0; k < Math.min(home.lit, most); k++) {
      await key('Enter');
      await wait(300);
      await until(() => window.__inktv.walk && !window.__inktv.walk.moving, null, 20000);
      await wait(300);
      const w = await tv(() => window.__inktv.walk);
      walked.push({ caption: w.caption, eye: w.eye, drawn: w.drawn });
      await shot(`${prefix}-walk-${pad(k + 1)}.png`);
    }
    // ▶‖ on the last thing gone to: the nights it came in
    await key('p');
    await wait(600);
    const hearing = await tv(() => window.__inktv.walk);
    await shot(`${prefix}-walk-hearing.png`);
    await key('p');
    await key('Escape');
    await until(() => !window.__inktv.walk, null, 30000);
    return { home, start: start_.caption, walked, hearing };
  }
  // A painter's book, from the seals («): its title page, then a page turned to its first night
  async function journal(seal, name) {
    await until(() => window.__inktv.mode === 'who');
    for (let k = 0; k < 9 && (await onTile()) !== seal; k++) await key('ArrowRight');
    await key(',');
    await until(() => window.__inktv.mode === 'journal', null, 10000);
    await wait(800);
    const j = await tv(() => window.__inktv.journal);
    await shot(name);
    if (j.spreads > 1) {
      await key('ArrowRight');
      await until(() => window.__inktv.journal.i === 1 && !window.__inktv.journal.turning, null, 10000);
      await wait(800);
      j.first = await tv(() => window.__inktv.journal.page);
      await shot(name.replace(/\.png$/, '-night-1.png'));
    }
    await key('Escape');
    await until(() => window.__inktv.mode === 'who', null, 10000);
    return j;
  }
  async function close() {
    await (kept || browser).close();
    server.close();
    guide.close();
  }
  return { page, tv, key, wait, until, shot, start, reopen, day, now, seals, newPainter, pick, night, visit, act, journal, close, errors, outside, failed, said };
}
