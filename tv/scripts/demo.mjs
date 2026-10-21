// Makes the demo family (src/demo-family.js): two painters and their earlier nights, painted in the
// TV page itself, with the real brush, ink and harness, driven by scripted remote presses, the way
// the browser test drives it. The guide for these earlier nights is a script too (`direct` below):
// it calls the guide's tools as the guide would, and tells lines written here. What the TV kept
// (the painters, their dream worlds, each night's painting) is written out for the app's demo mode,
// which shows that the earlier nights were scripted. No model is called, unless --real.
//
//   node scripts/demo.mjs [--shots] [--real]
//     --shots: a screenshot of each night, in test-shots/demo-*
//     --real:  each night made real, as the story server makes it: the Illustrator through Claude
//              Code (`claude -p`, on the subscription it is signed in with), and the picture by
//              Google's Gemini with the key in GEMINI_API_KEY (counted at PICTURE_PRICE, 0.15 if
//              unset), or without one, by Amazon Nova Canvas with this computer's AWS credentials
//              (NOVA_REGION, or AWS_REGION; us-east-1 if neither; AWS retired it on 30 September
//              2026), behind a ledger (.pictures-ledger.json) that refuses any picture past
//              PICTURES_CAP dollars (4.50 if unset). Only each night's own picture: their world's
//              place and its things are made by the story server, in the look the person chooses.
//              PICTURES_STAND_IN=1 tries it with the stand-in picture instead, at no cost; with
//              DEMO_OUT=<file>, it is written there instead of src/demo-family.js.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { createHandler } from '../server/lambda.mjs';
import { AGENT_SYSTEM, AGENT_YOUNG } from '../server/agent.mjs';
import { memoryCommons } from '../server/commons-store.mjs';
import { memorySessions } from '../server/phone.mjs';
import { ILLUSTRATE_SYSTEM } from '../server/illustrator.mjs';
import { createClaudeCli } from '../server/claude-cli.mjs';
import { ledgered } from './ledger.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SHOTS = process.argv.includes('--shots');
if (SHOTS) mkdirSync(here('../test-shots/'), { recursive: true });
const REAL = process.argv.includes('--real');
const CAP = Number(process.env.PICTURES_CAP) || 4.5;
let nova = null, illustrator = null;
if (REAL) {
  const { standInPaint } = await import('../server/illustrator.mjs');
  const ledger = { file: here('../.pictures-ledger.json'), cap: CAP };
  if (process.env.PICTURES_STAND_IN) nova = Object.assign(standInPaint, { spent: () => 0 });
  else if (process.env.GEMINI_API_KEY) {
    const { geminiPaint } = await import('../server/gemini.mjs');
    nova = ledgered(geminiPaint({ key: process.env.GEMINI_API_KEY, log: (m) => console.log(`  ${m}`) }), { ...ledger, price: Number(process.env.PICTURE_PRICE) || 0.15 });
  } else {
    const { BedrockRuntimeClient, InvokeModelCommand } = createRequire(here('../server/package.json'))('@aws-sdk/client-bedrock-runtime');
    const canvas = new BedrockRuntimeClient({ region: process.env.NOVA_REGION || process.env.AWS_REGION || 'us-east-1' });
    nova = ledgered(async (body) => {
      const out = await canvas.send(new InvokeModelCommand({ modelId: 'amazon.nova-canvas-v1:0', contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }));
      const json = JSON.parse(new TextDecoder().decode(out.body));
      if (json.error) throw new Error(json.error);
      return json.images && json.images[0];
    }, ledger);
  }
  illustrator = createClaudeCli({ onCall: (c) => console.log(`  the Illustrator: ${c.family}, ${c.seconds.toFixed(1)} s`) });
  console.log(`making the nights real: $${nova.spent().toFixed(2)} of $${CAP.toFixed(2)} spent so far`);
}

// ---------------------------------------------------------------- the nights

const R = 0, L = Math.PI, UP = -Math.PI / 2;
// a key tapped briefly every `every` ms from `from` to `to`: a gentle, even turn
const pulses = (k, from, to, on = 120, every = 400) => Array.from({ length: Math.floor((to - from) / every) }, (_, i) => [k, from + i * every, from + i * every + on]);
// Shapes for a stroke to follow (a `path`, in the sheet's units, 1600 by 1000): the brush is steered
// along one as a careful hand steers it with ◀ and ▶ (follow, below), so a curve can't be tighter
// than the brush turns at cruising speed (a radius of about 65 units). Corners are separate strokes.
const arc = (cx, cy, r, from, to, step = 0.12) => { const n = Math.max(2, Math.ceil(Math.abs(to - from) / step)); return Array.from({ length: n + 1 }, (_, i) => { const a = from + ((to - from) * i) / n; return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]; }); };
const wave = (x0, x1, y, amp, len, phase = 0) => { const n = Math.ceil(Math.abs(x1 - x0) / 12); return Array.from({ length: n + 1 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / n; return [Math.round(x), Math.round(y + amp * Math.sin(phase + (2 * Math.PI * (x - x0)) / len))]; }); };
const along = (...parts) => parts.flat().filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
const dot = (x, y, ms = 450, ink) => ({ at: [x, y], heading: R, ms: 100, press: ms, ...(ink ? { ink } : {}) });
// the demo's shapes, used again where a thing comes back, so the TV can tell it's the same one
const ROCKET = along([[630, 880], [630, 560]], arc(700, 560, 70, Math.PI, 2 * Math.PI), [[770, 560], [770, 880]]);
const DRAGON = wave(1250, 650, 360, 40, 320);
const WING_A = arc(1015, 350, 75, 0, -Math.PI);
const WING_B = arc(860, 350, 70, 0, -Math.PI);
const HULL = arc(1080, 620, 95, 0.15, Math.PI - 0.15);
const MAST = [[1080, 630], [1080, 485]];
const SAIL = [[1092, 500], [1172, 605]];
// the ferry as it leaves: further out, still near enough to be known again
const HULL_OUT = arc(1260, 620, 95, 0.15, Math.PI - 0.15);
const MAST_OUT = [[1260, 630], [1260, 485]];

// Each night: who paints it, its strokes, what they say on the phone (after the stroke numbered
// `after`, so it is kept with that stroke), how they mark it as it comes back, and the guide's
// script. A stroke: { at: [x, y], heading, ms, ink?, press?: ms held ▼, ease?: ▲ held, steer?:
// [[key, from ms, to ms]] }, or { path: [[x, y], ...], ink?, press? } to follow a shape. marks: { stroke index: [key held while it comes back, or [key, ms
// held]] }.
const NIGHTS = [
  // Moon, a grown-up: a low shore, a pier on its posts, and the night ferry waiting at the end of it
  {
    who: 'moon', title: 'The Low Shore',
    strokes: [
      { path: wave(170, 1490, 420, 14, 700), ink: 'light' },
      { path: [[300, 700], [950, 700]], ink: 'dense' },
      { path: [[400, 700], [400, 780]], ink: 'dense' },
      { path: [[600, 700], [600, 780]], ink: 'dense' },
      { path: [[800, 700], [800, 780]], ink: 'dense' },
      { path: HULL, ink: 'dense' },
      { path: MAST, ink: 'dense' },
      { path: SAIL, ink: 'light' },
    ],
    words: [{ after: 6, text: 'a long pier, and a boat waiting at the end of it' }],
    marks: { 5: ['ArrowDown', 'ArrowRight'] },
    guide: {
      ask: { question: 'What was waiting at the end of the pier?', choices: ['the night ferry', 'a rowing boat', 'someone'], answer: 'the night ferry', strokes: [6] },
      lines: [
        { text: 'The shore ran low and pale, as far as you could paint it.', strokes: [1] },
        { text: 'A long pier went out over the water.', strokes: [2, 3, 4, 5] },
        { text: 'At the end of it the night ferry waited, and would not come in.', strokes: [6, 7, 8] },
      ],
      remember: { things: [{ name: 'the night ferry', kind: 'thing', aliases: ['ferry'], strokes: [6, 7, 8], why: 'it would not come in' }, { name: 'the pier', kind: 'place', strokes: [2, 3, 4, 5] }], facts: [{ about: 'the night ferry', text: 'It waited at the end of the pier.', open: true }] },
    },
    offer: 'That’s the end',
  },
  {
    who: 'moon', title: 'The Lantern',
    strokes: [
      { path: wave(200, 1490, 430, 14, 700), ink: 'light' },
      { path: HULL, ink: 'dense' },
      { path: MAST, ink: 'dense' },
      dot(1095, 535, 1300, 'gold'),
    ],
    words: [{ after: 4, text: 'the ferry again, with a lantern on it' }],
    marks: { 1: ['ArrowDown'], 3: ['ArrowUp'] },
    guide: {
      sameAs: 'the night ferry', at: 2,
      lines: [
        { text: 'The shore again, low and still.', strokes: [1] },
        { text: 'The night ferry came back, and waited where it waited before.', strokes: [2, 3] },
        { text: 'Someone had hung a lantern on it, small and pale.', strokes: [4] },
      ],
      remember: { things: [{ ref: 'the night ferry', strokes: [2, 3] }, { name: 'the lantern', kind: 'thing', strokes: [4], why: 'it was the only light' }], facts: [{ about: 'the lantern', text: 'It hung on the night ferry.' }] },
    },
  },
  {
    who: 'moon', title: 'The Ferry Leaves',
    strokes: [
      { path: [[300, 700], [950, 700]], ink: 'dense' },
      { path: [[500, 700], [500, 780]], ink: 'dense' },
      { path: [[750, 700], [750, 780]], ink: 'dense' },
      // the ferry further out, leaving, and the water it has crossed
      { path: HULL_OUT, ink: 'dense' },
      { path: MAST_OUT, ink: 'dense' },
      { path: [[1370, 655], [1560, 635]], ink: 'light' },
    ],
    words: [{ after: 6, text: 'it left without me' }],
    marks: { 0: ['ArrowDown'], 3: ['ArrowDown', 'ArrowRight'] },
    guide: {
      sameAs: 'the night ferry', at: 4,
      lines: [
        { text: 'The pier, as long as before.', strokes: [1, 2, 3] },
        { text: 'The night ferry waited at the end of it, as it always had.', strokes: [4, 5] },
        { text: 'Then it left without you, faster than you could paint.', strokes: [6] },
      ],
      remember: { things: [{ ref: 'the night ferry', strokes: [4, 5, 6], why: 'it left without me' }], facts: [] },
    },
    offer: 'Draw what happens next',
    ending: {
      strokes: [
        // a bridge from the end of the pier, over the water, to the ferry's side
        { path: arc(1058, 700, 108, Math.PI, 1.85 * Math.PI), ink: 'dense' },
        // and the night around it, untold: a lighthouse at the start of the pier and its light,
        // the moon, stars, two birds
        { path: [[300, 700], [300, 480]], ink: 'dense' },
        dot(300, 470, 900, 'gold'),
        { path: arc(1300, 150, 80, Math.PI, 3 * Math.PI), ink: 'gold' },
        dot(620, 90, 450, 'gold'), dot(880, 160, 450, 'gold'), dot(180, 120, 450, 'gold'),
        { path: arc(880, 330, 66, -2.5, -0.65), ink: 'indigo' },
        { path: arc(1010, 290, 66, -2.5, -0.65), ink: 'indigo' },
      ],
      marks: { 0: ['ArrowUp'] },
      guide: {
        ask: { question: 'What happens next?', choices: ['a bridge', 'a lantern', 'someone kind'], answer: 'a bridge' },
        lines: [
          { text: 'The pier, as long as before.', strokes: [1, 2, 3] },
          { text: 'The night ferry waited at the end of it, as it always had.', strokes: [4, 5] },
          { text: 'Then a bridge was there, all the way out to the ferry, and you walked across.', strokes: [7] },
        ],
        remember: { things: [{ name: 'the bridge', kind: 'place', strokes: [7], why: 'it reached the ferry' }], settles: 'It waited at the end of the pier.' },
      },
    },
  },
  // Star, a child: a rocket that is going to the moon; a castle on the moon, and a dragon who flies
  // out of it, painted as what happens next; and the dragon, back again, to fly on
  {
    who: 'star', title: 'The Rocket',
    strokes: [
      { path: ROCKET, ink: 'dense' },
      { path: [[620, 880], [780, 880]], ink: 'dense' },
      dot(700, 640, 1400, 'indigo'),
      { path: [[630, 790], [560, 900]], ink: 'cinnabar' },
      { path: [[770, 790], [840, 900]], ink: 'cinnabar' },
      { path: [[675, 895], [690, 975]], ink: 'gold' },
      { path: [[725, 895], [710, 975]], ink: 'gold' },
      { path: arc(1250, 230, 110, Math.PI, 3 * Math.PI), ink: 'dense' },
      dot(1215, 200, 500, 'light'), dot(1290, 265, 400, 'light'),
      // the stars, untold
      dot(300, 170, 450, 'gold'), dot(520, 100, 450, 'gold'), dot(960, 130, 450, 'gold'),
    ],
    words: [],
    marks: { 0: ['ArrowUp', 'ArrowRight'], 7: ['ArrowUp'], 5: ['ArrowRight'] },
    guide: {
      ask: { question: 'What was this?', choices: ['a rocket', 'a tower', 'a tall tree'], answer: 'a rocket', strokes: [1] },
      lines: [
        { text: 'You built a rocket, tall and shining, with a round blue window.', strokes: [1, 2, 3, 4, 5] },
        { text: 'High above, the moon was waiting.', strokes: [8, 9, 10] },
        { text: 'Golden light glowed under the rocket, and it was ready to go.', strokes: [6, 7] },
      ],
      remember: { things: [{ name: 'the rocket', kind: 'thing', aliases: ['rocket'], strokes: [1, 2, 3, 4, 5, 6, 7], why: 'it was going to the moon' }, { name: 'the moon', kind: 'place', strokes: [8, 9, 10] }], facts: [{ about: 'the rocket', text: 'It was going to the moon.', open: true }] },
    },
    offer: 'That’s the end',
  },
  {
    who: 'star', title: 'The Moon Castle',
    strokes: [
      { path: ROCKET, ink: 'dense' },
      { path: [[620, 880], [780, 880]], ink: 'dense' },
      dot(700, 640, 1400, 'indigo'),
      { path: wave(100, 1500, 910, 10, 600), ink: 'light' },
      { path: [[1060, 880], [1060, 560]], ink: 'dense' },
      { path: [[1340, 880], [1340, 560]], ink: 'dense' },
      { path: [[1060, 700], [1340, 700]], ink: 'dense' },
      { path: [[1020, 565], [1060, 470]], ink: 'cinnabar' },
      { path: [[1060, 470], [1100, 565]], ink: 'cinnabar' },
      { path: [[1300, 565], [1340, 470]], ink: 'cinnabar' },
      { path: [[1340, 470], [1380, 565]], ink: 'cinnabar' },
      { path: arc(1200, 880, 70, Math.PI, 2 * Math.PI), ink: 'dense' },
      dot(1060, 450, 500, 'gold'), dot(1340, 450, 500, 'gold'),
    ],
    words: [],
    marks: { 0: ['ArrowUp'], 3: [['ArrowUp', 500]], 4: ['ArrowUp'], 5: ['ArrowUp'], 11: ['ArrowUp'] },
    guide: {
      sameAs: 'the rocket', at: 1,
      lines: [
        { text: 'Your rocket landed on the moon.', strokes: [1, 2, 3] },
        { text: 'The ground of the moon was soft and silver.', strokes: [4] },
        { text: 'A castle stood there, its towers reaching up to the stars.', strokes: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
      ],
      remember: { things: [{ ref: 'the rocket', strokes: [1, 2, 3], why: 'it landed on the moon' }, { ref: 'the moon', strokes: [4] }, { name: 'the moon castle', kind: 'place', aliases: ['castle'], strokes: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14] }], settles: 'It was going to the moon.' },
    },
    offer: 'Draw what happens next',
    ending: {
      strokes: [
        { path: DRAGON, ink: 'dense' },
        { path: WING_A, ink: 'light' },
        { path: WING_B, ink: 'light' },
        dot(650, 360, 700, 'dense'),
        dot(640, 350, 350, 'gold'),
      ],
      marks: { 0: ['ArrowUp', 'ArrowRight'] },
      guide: {
        ask: { question: 'What happened next?', choices: ['a dragon friend', 'a shooting star', 'a bird'], answer: 'a dragon friend' },
        lines: [
          { text: 'Your rocket landed on the moon.', strokes: [1, 2, 3] },
          { text: 'The ground of the moon was soft and silver.', strokes: [4] },
          { text: 'A castle stood there, its towers reaching up to the stars.', strokes: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
          { text: 'Then a dragon flew out of the castle, and it was your friend.', strokes: [15, 16, 17, 18, 19] },
        ],
        remember: { things: [{ name: 'the dragon friend', kind: 'creature', aliases: ['dragon'], strokes: [15, 16, 17, 18, 19], why: 'it flew out of the castle to be their friend' }] },
      },
    },
  },
  {
    who: 'star', title: 'Flying with the Dragon',
    strokes: [
      { path: DRAGON, ink: 'dense' },
      { path: WING_A, ink: 'light' },
      { path: WING_B, ink: 'light' },
      dot(650, 360, 700, 'dense'),
      dot(640, 350, 350, 'gold'),
      { path: wave(180, 1400, 660, 45, 360), ink: 'light' },
      { path: [[1380, 900], [1380, 770]], ink: 'dense' },
      { path: [[1350, 775], [1380, 710]], ink: 'cinnabar' },
      { path: [[1380, 710], [1410, 775]], ink: 'cinnabar' },
      // the night they flew through, untold: the moon, stars, a shooting star
      { path: arc(1460, 140, 70, Math.PI, 3 * Math.PI), ink: 'dense' },
      dot(140, 120, 450, 'gold'), dot(520, 90, 450, 'gold'), dot(900, 110, 450, 'gold'), dot(1180, 780, 450, 'gold'),
      { path: [[760, 170], [640, 215]], ink: 'gold' },
    ],
    words: [],
    marks: { 0: ['ArrowUp', 'ArrowRight'], 5: [['ArrowUp', 500]], 6: ['ArrowUp'] },
    guide: {
      sameAs: 'the dragon friend', at: 1,
      lines: [
        { text: 'Your dragon friend came back, its wings wide open.', strokes: [1, 2, 3, 4, 5] },
        { text: 'You climbed on its back and flew high over the clouds.', strokes: [6] },
        { text: 'Far below, the moon castle was shining.', strokes: [7, 8, 9] },
      ],
      remember: { things: [{ ref: 'the dragon friend', strokes: [1, 2, 3, 4, 5], why: 'they flew on its back' }, { ref: 'the moon castle', strokes: [7, 8, 9] }] },
    },
    offer: 'That’s the end',
  },
];

// ---------------------------------------------------------------- the scripted guide

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
let script = null; // the guide's script for what is being told now
function direct(params) {
  const messages = params.messages, first = textOf(messages[0].content);
  const world = section(first, 'THEIR WORLD') || {};
  const S = script;
  const calls = callsIn(messages), did = (n, f = () => true) => calls.some((c) => c.name === n && f(c));
  let k = 0;
  const use = (name, input) => ({ content: [{ type: 'tool_use', id: `toolu_demo_${messages.length}_${k++}`, name, input }], stop_reason: 'tool_use' });
  const idOf = (name) => (world.things || []).find((t) => t.name === name)?.id;
  const ending = section(first, 'WHAT HAPPENS NEXT');
  const fresh = ending ? ending.new_strokes : null;
  if (!did('look')) return use('look', { strokes: fresh || [S.ask ? S.ask.strokes[0] : S.at], zoom: true });
  if (S.sameAs) {
    const hint = (world.hints || []).find((h) => h.name === S.sameAs);
    if (!hint) throw new Error(`the TV did not recognise ${S.sameAs}: ${JSON.stringify(world.hints)}`);
    if (!did('thing')) return use('thing', { id: hint.looks_like });
    if (!did('look', (c) => c.input.night)) return use('look', { night: hint.came_before_as.night, strokes: hint.came_before_as.strokes, zoom: true });
    if (!did('ask')) return use('ask', { question: `Is this ${S.sameAs} again?`, choices: ['Yes, the same', 'No, something else'], strokes: [hint.stroke], show: { night: hint.came_before_as.night, strokes: hint.came_before_as.strokes } });
  } else if (!did('ask')) return use('ask', { ...S.ask, strokes: fresh || S.ask.strokes, answer: undefined });
  const told = calls.filter((c) => c.name === 'tell');
  if (!told.some((c) => !c.error)) {
    if (told.length) throw new Error(`the telling was sent back: ${told.at(-1).result}`);
    return use('tell', { title: S.title, lines: S.lines });
  }
  if (!did('remember')) {
    const R = S.remember;
    const things = R.things.map(({ ref, ...t }) => (ref ? { id: idOf(ref), ...t } : t));
    const resolved = R.settles ? (world.open || []).filter((o) => o.text === R.settles).map((o) => o.id) : [];
    return use('remember', { things, facts: R.facts || [], resolved });
  }
  return { content: [{ type: 'text', text: (params.system || []).some((b) => b.text === AGENT_YOUNG) ? 'Sleep tight.' : 'Sleep well.' }], stop_reason: 'end_turn' };
}
function claude(params) {
  if (Array.isArray(params.system) && params.system[0].text === AGENT_SYSTEM) return { model: params.model, usage: { input_tokens: 0, output_tokens: 0 }, ...direct(params) };
  if (illustrator && String(params.system).startsWith(ILLUSTRATE_SYSTEM)) return illustrator.messages.create(params);
  // the remarks while painting: the scripted guide says nothing
  return { content: [{ type: 'text', text: '{}' }] };
}

// ---------------------------------------------------------------- the TV, driven

const PORT = 5191, GUIDE = 5192;
const server = await serve(PORT);
const handler = createHandler({ claude: { messages: { async create(p) { return claude(p); } } }, speak: async () => null, commons: memoryCommons(), sessions: memorySessions(), paint: nova });
const guide = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    const path = new URL(req.url, 'http://x').pathname;
    // with --real, only the nights' own pictures: their world's place and its things wait for the story server
    if (REAL && req.method === 'POST' && (path === '/thing' || path === '/backdrop')) { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ off: true })); return; }
    const out = await handler({ rawPath: path, headers: req.headers, body, requestContext: { http: { method: req.method } } });
    res.writeHead(out.statusCode, out.headers);
    res.end(out.body);
  });
});
await new Promise((ok) => guide.listen(GUIDE, ok));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
if (REAL) page.on('console', (m) => { if (/dream it real|Illustrator/i.test(m.text())) console.log(`  the TV: ${m.text().slice(0, 200)}`); });

const tv = (fn, arg) => page.evaluate(fn, arg);
const settle = () => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
// the media keys as Vega's WebView sends them; the rest as a keyboard does
const MEDIA = { MediaFastForward: 228, MediaRewind: 227, MediaPlayPause: 179 };
const key = async (k) => {
  if (MEDIA[k]) await page.evaluate(([key, keyCode]) => { dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { key, keyCode, bubbles: true })); }, [k, MEDIA[k]]);
  else await page.keyboard.press(k);
  await settle();
};
const wait = (ms) => page.waitForTimeout(ms);
const until = (fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
const INK = ['dense', 'light', 'water', 'indigo', 'gold', 'cinnabar'];

async function chooseInk(want) {
  for (let i = 0; i < INK.length && (await tv(() => window.__inktv.brush.ink)) !== want; i++) {
    const at = INK.indexOf(await tv(() => window.__inktv.brush.ink));
    await key(INK.indexOf(want) > at ? 'MediaFastForward' : 'MediaRewind');
  }
}
// A stroke along a shape: in the page, each frame, the brush is steered with ◀ or ▶ (the keys the
// remote sends) toward a point a little way ahead on the shape, allowing for how a turn eases in,
// and lifted (OK) at its end. Only the buttons a person has are pressed.
async function follow(s) {
  const path = s.path;
  const h0 = Math.atan2(path[1][1] - path[0][1], path[1][0] - path[0][0]);
  await tv(([x, y, h]) => window.__inktv.place(x, y, h), [path[0][0], path[0][1], h0]);
  await key('Enter');
  const ok = await page.evaluate(({ path, lead, tol }) => new Promise((done) => {
    const send = (type, key) => dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    let held = null, i = 1, last = null;
    const t0 = performance.now();
    const hold = (k) => { if (held === k) return; if (held) send('keyup', held); held = k; if (k) send('keydown', k); };
    const end = (v) => { hold(null); send('keydown', 'Enter'); send('keyup', 'Enter'); done(v); };
    const tick = (now) => {
      const b = window.__inktv.brush;
      if (!b || !b.touching) { hold(null); return done(false); }
      while (i < path.length - 1 && Math.hypot(path[i][0] - b.x, path[i][1] - b.y) < lead) i++;
      const [tx, ty] = path[i];
      if (i === path.length - 1 && Math.hypot(tx - b.x, ty - b.y) < tol) return end(true);
      if (now - t0 > 30000) return end(false);
      // the turn it is already making, so it lets go before it overshoots
      const omega = last ? wrap(b.heading - last.h) / Math.max(1, now - last.t) * 1000 : 0;
      last = { h: b.heading, t: now };
      const err = wrap(Math.atan2(ty - b.y, tx - b.x) - b.heading) - omega * 0.12;
      hold(err > 0.05 ? 'ArrowRight' : err < -0.05 ? 'ArrowLeft' : null);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { path, lead: s.lead || 34, tol: 16 });
  if (!ok) throw new Error(`a stroke didn't follow its shape from ${JSON.stringify(path[0])}`);
  await until(() => !window.__inktv.brush.touching, null, 8000);
  await wait(500);
}
async function paint(s) {
  // on paper that has settled: while wet ink is still spreading, a headless browser draws slowly,
  // and the brush, which moves by the frame, would paint a shorter stroke than the script says
  await until(() => !window.__inktv.wet, null, 20000).catch(() => {});
  if (s.ink) await chooseInk(s.ink);
  if (s.path) return follow(s);
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
  if (s.press) {
    await page.keyboard.down('ArrowDown');
    await wait(s.press);
    await page.keyboard.up('ArrowDown');
  }
  await key('Enter');
  await until(() => !window.__inktv.brush.touching, null, 8000);
  await wait(500);
}
// said on the phone between strokes (a page in front is the only one that paints, so the TV comes
// back to the front before the brush moves again)
async function speak(text) {
  await phone.bringToFront();
  await phone.fill('#text', text);
  await phone.click('#send');
  await page.bringToFront();
  await until((t) => window.__inktv.words.some((w) => w.text === t), text, 10000);
}
// the painting comes back; the keys held as each stroke comes back
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
      // a nudge first: held a moment, then let go, and the dial stays where it was left
      for (const [k, ms] of (marks[now] || []).filter((k) => Array.isArray(k))) { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); }
      for (const k of held) await page.keyboard.down(k);
      if (held.length) {
        await until((n) => !window.__inktv.line || window.__inktv.line.shown !== n || window.__inktv.mode !== 'replay', now, 20000);
        for (const k of held) await page.keyboard.up(k);
      }
    }
    await wait(50);
  }
}
// the guide asks, tells (each line answered "that's it"), remembers
async function guided(answer) {
  await until(() => window.__inktv.mode === 'ask' || window.__inktv.mode === 'tell', null, 30000);
  if ((await tv(() => window.__inktv.mode)) === 'ask') {
    const chips = await tv(() => [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent));
    const i = chips.indexOf(answer);
    if (i < 0) throw new Error(`no "${answer}" among ${JSON.stringify(chips)}`);
    for (let k = 0; k < i; k++) await key('ArrowRight');
    await key('Enter');
  }
  await until(() => window.__inktv.tell && window.__inktv.tell.i === 0, null, 30000);
  const n = await tv(() => window.__inktv.tell.n);
  for (let k = 0; k < n; k++) { await key('ArrowUp'); await wait(250); await key('Enter'); }
  await until(() => !window.__inktv.guide.running && ['paint', 'offer', 'atlas'].includes(window.__inktv.mode), null, 30000);
}
// in their world: to the paper, to paint something new into it
async function paintNew() {
  // their world opens once its night is drawn, which takes a headless browser a while for a full painting
  await until(() => window.__inktv.mode === 'atlas' && window.__inktv.atlas, null, 60000).catch(async (err) => { throw new Error(`their world didn't open (mode ${await tv(() => window.__inktv.mode)}): ${err.message}`); });
  for (let k = 0; k < 6 && !/^Draw (something new|the first thing)/.test(await tv(() => window.__inktv.atlas.actions[window.__inktv.atlas.k])); k++) await key('ArrowDown');
  await key('Enter');
  await until(() => window.__inktv.mode === 'paint', null, 10000);
}
async function choosePainter(seal, young) {
  await until(() => window.__inktv.mode === 'who');
  const w = await tv(() => window.__inktv.who);
  const named = w.painters.findIndex((p) => p.seal === seal);
  if (named >= 0) {
    while ((await tv(() => window.__inktv.who.i)) !== named) await key('ArrowRight');
    await key('Enter');
    return paintNew();
  }
  if (w.step === 'pick') { while ((await tv(() => window.__inktv.who.i)) !== w.painters.length) await key('ArrowRight'); await key('Enter'); }
  while ((await tv(() => document.querySelector('#who .tile.on .name').textContent.toLowerCase())) !== seal) await key('ArrowRight');
  await key('Enter');
  if (young) await key('ArrowRight');
  await key('Enter');
  return paintNew();
}


try {
  await page.goto(`http://localhost:${PORT}/?guide=http://localhost:${GUIDE}&pace=fast&quiet=0`);
  await until(() => window.__inktv && window.__inktv.ready, null, 120000);
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('inkwash'); });
  await page.reload();
  await until(() => window.__inktv && window.__inktv.ready, null, 120000);
  let current = null;
  for (const [i, night] of NIGHTS.entries()) {
    if (current !== night.who) {
      // a night ends in their world; Back there is the seals
      if (current) { await until(() => window.__inktv.mode === 'atlas', null, 10000); await key('Escape'); }
      await choosePainter(night.who, night.who === 'star');
      current = night.who;
      if (night.words.length) {
        await until(() => window.__inktv.phone && window.__inktv.phone.url, null, 10000);
        await phone.goto(await tv(() => window.__inktv.phone.url));
        await page.bringToFront();
      }
    } else await paintNew();
    await wait(600);
    for (const [k, s] of night.strokes.entries()) {
      await paint(s);
      for (const w of night.words.filter((x) => x.after === k + 1)) await speak(w.text);
    }
    if (SHOTS) await page.screenshot({ path: here(`../test-shots/demo-${i + 1}-painted.png`) });
    script = { title: night.title, ...night.guide };
    await feel(night.marks);
    await guided(night.guide.sameAs ? 'Yes, the same' : night.guide.ask.answer);
    if ((await tv(() => window.__inktv.mode)) === 'offer') {
      if (night.offer !== 'Draw what happens next') { await key('Escape'); }
      else {
        await key('Enter');
        for (const s of night.ending.strokes) await paint(s);
        if (SHOTS) await page.screenshot({ path: here(`../test-shots/demo-${i + 1}-new-ending.png`) });
        script = { title: night.title, ...night.ending.guide };
        await feel(night.ending.marks);
        await guided(night.ending.guide.ask.answer);
      }
    } else if (night.ending) throw new Error(`night ${i + 1}: no new ending was offered`);
    const kept = await tv(() => window.__inktv.world);
    if (REAL) {
      // its picture, kept with the night, before the next is painted
      let made = false;
      for (let t = 0; t < 120 && !made; t++) {
        const m = await tv(() => window.__inktv.memory());
        const last = m.world.nights[m.world.nights.length - 1];
        made = !!(last && m.drawings.find((d) => d && d.n === last.n && d.real));
        if (!made) await wait(2000);
      }
      console.log(made ? `  made real: $${nova.spent().toFixed(2)} of $${CAP.toFixed(2)} spent` : '  not made real (what the TV said is above)');
    }
    console.log(`${night.who}, night ${kept.nights}: ${night.title}`);
  }
  // what the TV kept
  const kept = await page.evaluate(async () => {
    const family = JSON.parse(localStorage.getItem('inkwash.family'));
    const worlds = Object.fromEntries(family.painters.map((p) => [p.id, JSON.parse(localStorage.getItem(p.first ? 'inkwash.world' : `inkwash.world.${p.id}`))]));
    const db = await new Promise((ok, fail) => { const r = indexedDB.open('inkwash'); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
    const all = (what) => new Promise((ok, fail) => { const q = db.transaction('paintings').objectStore('paintings')[what](); q.onsuccess = () => ok(q.result); q.onerror = () => fail(q.error); });
    const [keys, values] = [await all('getAllKeys'), await all('getAll')];
    const paintings = {};
    keys.forEach((k, i) => {
      const [who, n] = typeof k === 'number' ? [family.painters.find((p) => p.first).id, k] : String(k).split(':');
      (paintings[who] ||= {})[Number(n)] = values[i];
    });
    return { painters: family.painters.map(({ added, ...p }) => p), worlds, paintings };
  });
  if (errors.length) throw new Error(errors.join('\n'));
  const out = process.env.DEMO_OUT || here('../src/demo-family.js');
  writeFileSync(out, `// The demo family: what the TV kept after the earlier nights in scripts/demo.mjs were painted with\n// the real brush, ink and harness, driven by scripted remote presses, and told by a scripted guide.\n// Made by \`node scripts/demo.mjs\`; don't edit it by hand.\nexport default ${JSON.stringify(kept)};\n`);
  console.log(`wrote ${out}: ${Object.values(kept.worlds).map((w) => w.nights.length).join(' and ')} nights, ${Math.round(JSON.stringify(kept).length / 1024)} KB`);
} finally {
  await browser.close();
  server.close();
  guide.close();
}
