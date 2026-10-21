import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costOf, memorySpend, dynamoSpend, callerLimits, metered, Spent, VOICE_PER_CHAR, PICTURE } from '../limits.mjs';
import { createHandler } from '../lambda.mjs';
import { handle, MODELS } from '../guide.mjs';
import { privacyPage } from '../privacy.mjs';
import { memorySessions } from '../phone.mjs';
import { memoryCommons } from '../commons-store.mjs';

const IMAGE = `data:image/jpeg;base64,${Buffer.from('not really a jpeg').toString('base64')}`;
const STROKES = [{ n: 1, ink: 'dense', from: [300, 650], to: [520, 650], box: [300, 642, 520, 658], length: 220, turn: 0.1, pressure: 0.5, pools: [] }];
const near = (a, b, msg, within = 1e-9) => assert.ok(Math.abs(a - b) < within, `${msg}: ${a} is not ${b}`);
// the day's spending is kept in millionths of a dollar
const MICRO = 1e-6;

// a stand-in for Claude that answers with usage, as Bedrock does
function claudeWith(usage, text = '{"say": "Hello."}') {
  const asked = [];
  return { asked, messages: { async create(params) { asked.push(params); return { content: [{ type: 'text', text }], usage }; } } };
}

test('each call is priced by its model and its four kinds of tokens, with 10% on top, an unknown model as the dearest', () => {
  // one storyteller turn from the long worlds: mostly the night so far, written to the cache or read from it
  const turn = { input_tokens: 3, cache_creation_input_tokens: 10000, cache_read_input_tokens: 10800, output_tokens: 720 };
  near(costOf('anthropic.claude-opus-5-5', turn), ((3 * 4 + 10000 * 5 + 10800 * 0.2 + 720 * 20) / 1e6) * 1.1, 'Opus 5.5');
  near(costOf('anthropic.claude-haiku-5-5', turn), ((3 * 0.1 + 10000 * 0.125 + 10800 * 0.01 + 720 * 0.5) / 1e6) * 1.1, 'Haiku 5.5');
  near(costOf('anthropic.claude-haiku-4-5', turn), ((3 * 1 + 10000 * 1.25 + 10800 * 0.1 + 720 * 5) / 1e6) * 1.1, 'Haiku 4.5');
  near(costOf('global.anthropic.claude-sonnet-5-5', turn), ((3 * 2 + 10000 * 2.5 + 10800 * 0.2 + 720 * 10) / 1e6) * 1.1, 'Sonnet 5.5, any prefix');
  // Haiku 5.5's dearer rate past 100,000 tokens of prompt
  const long = { input_tokens: 120000, output_tokens: 1000 };
  near(costOf('anthropic.claude-haiku-5-5', long), ((120000 * 0.5 + 1000 * 2.5) / 1e6) * 1.1, 'Haiku 5.5, a long prompt');
  // a model with no price here is counted as the dearest, so the day's count runs high, not low
  near(costOf('deepseek.v4-flash', turn), ((3 * 5 + 10000 * 6.25 + 10800 * 0.5 + 720 * 25) / 1e6) * 1.1, 'unknown');
  assert.equal(costOf('anthropic.claude-opus-5-5', undefined), 0, 'no usage, nothing counted');
  assert.equal(costOf('anthropic.claude-opus-5-5', { input_tokens: -5, output_tokens: 'x' }), 0, 'nonsense usage counts nothing');
});

test('the day’s spending, in memory: counted by UTC day, over once it reaches the most', async () => {
  let t = Date.UTC(2026, 10, 9, 23, 59);
  const s = memorySpend({ perDay: 1, now: () => t });
  assert.equal(await s.over(), false);
  await s.add(0.6);
  assert.equal(await s.over(), false);
  await s.add(0.4);
  assert.equal(await s.over(), true, 'a dollar of a dollar');
  near(await s.today(), 1, 'today');
  t += 2 * 60 * 1000; // past midnight UTC
  assert.equal(await s.over(), false, 'a new day');
  assert.equal(await memorySpend({ perDay: 0 }).over(), true, 'nothing may be spent at 0');
});

test('the day’s spending, in the commons table: one item a day, added to atomically, read consistently, expiring', async () => {
  const items = new Map(), sent = [];
  class GetItemCommand { constructor(input) { this.input = input; } }
  class UpdateItemCommand { constructor(input) { this.input = input; } }
  const client = { async send(cmd) {
    sent.push(cmd);
    const k = cmd.input.Key.pk.S + '|' + cmd.input.Key.sk.S;
    if (cmd instanceof GetItemCommand) return { Item: items.get(k) };
    assert.equal(cmd.input.UpdateExpression, 'SET expires = :expires ADD micro :m');
    const it = items.get(k) || { micro: { N: '0' } };
    items.set(k, { micro: { N: String(Number(it.micro.N) + Number(cmd.input.ExpressionAttributeValues[':m'].N)) }, expires: cmd.input.ExpressionAttributeValues[':expires'] });
    return {};
  } };
  const t = Date.UTC(2026, 10, 12, 8);
  const s = dynamoSpend({ client, table: 'commons', commands: { GetItemCommand, UpdateItemCommand }, perDay: 2, now: () => t });
  assert.equal(await s.over(), false, 'nothing yet');
  await s.add(1.25);
  await s.add(0);
  assert.equal(sent.filter((c) => c instanceof UpdateItemCommand).length, 1, 'nothing written for nothing');
  await s.add(0.75);
  assert.equal(await s.over(), true);
  near(await s.today(), 2, 'today');
  const get = sent.find((c) => c instanceof GetItemCommand).input;
  assert.deepEqual([get.Key.pk.S, get.Key.sk.S, get.ConsistentRead], ['spend#2026-11-12', 'usd', true]);
  assert.ok(Number(items.get('spend#2026-11-12|usd').expires.N) > t / 1000 + 30 * 86400, 'kept a month or so, then gone');
});

test('each caller may make so many calls in ten minutes: paid ones, and all of them', () => {
  let t = 0;
  const c = callerLimits({ paid: 2, any: 4, windowMs: 1000, now: () => t });
  assert.deepEqual([c.allow('a', true), c.allow('a', true), c.allow('a', true)], [true, true, false], 'two paid calls');
  assert.deepEqual([c.allow('a', false), c.allow('a', false), c.allow('a', false)], [true, true, false], 'four in all');
  assert.equal(c.allow('b', true), true, 'another caller has their own');
  t = 1000;
  assert.equal(c.allow('a', true), true, 'a new ten minutes');
  // the callers kept stay few: old windows go once there are many
  const many = callerLimits({ most: 3, windowMs: 1000, now: () => t });
  for (const who of ['p', 'q', 'r']) many.allow(who, false);
  t = 2000;
  for (const who of ['s', 't']) many.allow(who, false);
  assert.equal(many.allow('p', false), true);
});

test('metered: each call checked against the day first and counted after; once the day is spent, nothing is asked', async () => {
  const spend = memorySpend({ perDay: 0.01 });
  const usage = { input_tokens: 1000, output_tokens: 100 };
  const claude = claudeWith(usage);
  const spoken = [], painted = [], logs = [];
  const m = metered({ claude, speak: async (t) => { spoken.push(t); return 'QUJD'; }, paint: async (b) => { painted.push(b); return 'iVBOR'; } }, { spend, log: (x) => logs.push(x) });
  await m.claude.messages.create({ model: 'anthropic.claude-haiku-4-5', messages: [] });
  near(await spend.today(), costOf('anthropic.claude-haiku-4-5', usage), 'the call is counted', MICRO);
  assert.equal(await m.speak('Hello there.', { ssml: '<speak>Hello there.</speak>' }), 'QUJD');
  near(await spend.today(), costOf('anthropic.claude-haiku-4-5', usage) + '<speak>Hello there.</speak>'.length * VOICE_PER_CHAR, 'the voice by its characters', MICRO);
  assert.equal(await m.paint({}), 'iVBOR');
  assert.ok(await spend.over(), 'a picture spends the rest');
  near(PICTURE, 0.088, 'a picture at the dearer size, plus 10%');
  await assert.rejects(m.claude.messages.create({ model: 'x', messages: [] }), (err) => err instanceof Spent && err.spent === true);
  await assert.rejects(m.speak('again'), Spent);
  await assert.rejects(m.paint({}), Spent);
  assert.deepEqual([claude.asked.length, spoken.length, painted.length], [1, 1, 1], 'nothing asked once the day is spent');
  assert.match(logs[0], /told enough for today: \$0\.01 spent/);
  // a call that fails costs nothing; a count that fails is logged and the answer still comes back
  const failing = metered({ claude: { messages: { async create() { throw new Error('throttled'); } } } }, { spend: memorySpend() });
  await assert.rejects(failing.claude.messages.create({ model: 'x' }), /throttled/);
  const lost = [];
  const unsaved = metered({ claude: claudeWith(usage) }, { spend: { perDay: 5, over: async () => false, add: async () => { throw new Error('table gone'); } }, log: (x) => lost.push(x) });
  assert.ok(await unsaved.claude.messages.create({ model: 'x' }));
  assert.match(lost[0], /spending not counted: table gone/);
  // no voice or pictures set up: none metered
  assert.equal(metered({ claude, speak: null, paint: null }, { spend }).paint, null);
  // pictures from elsewhere, at their own price
  const dear = memorySpend({ perDay: 1 });
  await metered({ claude, paint: async () => 'iVBOR' }, { spend: dear, picture: 0.15 }).paint({});
  near(await dear.today(), 0.15, 'a picture at the price it was given', MICRO);
});

test('the day spent mid-telling: the agent doesn’t fall back to the fast model, and the TV hears 429', async () => {
  const spend = memorySpend({ perDay: 0.001 });
  const claude = claudeWith({ input_tokens: 20000, output_tokens: 2000 }, 'Once upon a time.');
  const m = metered({ claude }, { spend });
  const messages = [{ role: 'user', content: 'Tell it.' }];
  const first = await handle('/agent', { messages }, { claude: m.claude, models: MODELS });
  assert.equal(first.status, 200, 'the first turn is told, and spends the day');
  const second = await handle('/agent', { messages }, { claude: m.claude, models: MODELS, log: () => {} });
  assert.deepEqual([second.status, second.json.today], [429, true]);
  assert.equal(claude.asked.length, 1, 'no second model tried');
  // /tell: the same, through its own fallback
  const told = await handle('/tell', { image: IMAGE, strokes: STROKES }, { claude: m.claude, models: MODELS, commons: memoryCommons(), log: () => {} });
  assert.equal(told.status, 429);
  assert.equal(claude.asked.length, 1);
});

const post = (h, path, body, { ip = '203.0.113.7', headers = {} } = {}) => h({ rawPath: path, headers, requestContext: { http: { method: 'POST', sourceIp: ip } }, body: JSON.stringify(body) });

test('the Lambda handler: a spent day and a busy caller hear 429 before anything is asked; the phone still pairs', async () => {
  const spend = memorySpend({ perDay: 1 });
  await spend.add(1);
  const claude = claudeWith({ input_tokens: 10, output_tokens: 10 });
  const sessions = memorySessions();
  const h = createHandler({ claude, speak: async () => null, commons: memoryCommons(), sessions, spend, callers: callerLimits({ paid: 2, any: 6 }) });
  const logged = [], was = console.log;
  console.log = (m) => logged.push(m);
  try {
    for (const path of ['/remark', '/agent', '/tell', '/wonder', '/real', '/speak', '/readings']) {
      const r = await post(h, path, { image: IMAGE, strokes: STROKES }, { ip: `198.51.100.${path.length}` });
      assert.equal(r.statusCode, 429, path);
      assert.equal(JSON.parse(r.body).today, true);
    }
  } finally { console.log = was; }
  assert.equal(claude.asked.length, 0);
  assert.ok(logged.length === 7 && logged.every((m) => /told enough for today: \$1 spent/.test(m)), 'each one logged, for the alarm');
  // what costs nothing goes on: pairing a phone, saying and listening
  const paired = await post(h, '/pair', {}, { ip: '192.0.2.1' });
  assert.equal(paired.statusCode, 200);
  const { code } = JSON.parse(paired.body);
  assert.equal((await post(h, '/words', { code, text: 'the lamp' }, { ip: '192.0.2.2' })).statusCode, 200);
  // one caller, many calls: paid ones stop at two, all of them at six
  const open = createHandler({ claude, speak: async () => null, commons: memoryCommons(), sessions, spend: memorySpend(), callers: callerLimits({ paid: 2, any: 6 }) });
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await post(open, '/remark', { image: IMAGE, strokes: STROKES })).statusCode);
  assert.deepEqual(codes, [200, 200, 429]);
  assert.match(JSON.parse((await post(open, '/remark', { image: IMAGE, strokes: STROKES })).body).error, /too many calls/);
  // the two paid calls it was let make count among the six; the ones turned away don't
  for (let i = 0; i < 4; i++) assert.equal((await post(open, '/asked', { code })).statusCode, 200);
  assert.equal((await post(open, '/asked', { code })).statusCode, 429, 'guessing codes stops too');
  assert.equal((await post(open, '/asked', { code }, { ip: '203.0.113.8' })).statusCode, 200, 'another caller goes on');
});

test('the Lambda handler: whatever goes wrong, the caller hears only that it did', async () => {
  const logged = [];
  const was = console.log;
  console.log = (m) => logged.push(m);
  try {
    const h = createHandler({ claude: claudeWith({}), speak: async () => null, callers: { allow() { throw new Error('secret detail at /var/task/x.mjs:12'); } } });
    const r = await post(h, '/remark', { image: IMAGE, strokes: STROKES });
    assert.equal(r.statusCode, 502);
    assert.deepEqual(JSON.parse(r.body), { error: 'the guide could not be reached' });
    assert.ok(!r.body.includes('secret') && !r.body.includes('/var/task'), 'no detail, no stack');
    assert.match(logged.join('\n'), /guide error: Error: secret detail/, 'the detail goes to the log');
    // a stroke that isn't one is the TV's mistake (400), not the guide's
    const bad = await post(createHandler({ claude: claudeWith({}), speak: async () => null }), '/remark', { image: IMAGE, strokes: [null] });
    assert.equal(bad.statusCode, 400);
    assert.match(JSON.parse(bad.body).error, /each stroke must be an object/);
  } finally { console.log = was; }
});

test('the Lambda handler: the key compared whatever its length; the privacy page; nothing else served', async () => {
  const h = createHandler({ claude: claudeWith({ input_tokens: 1, output_tokens: 1 }), speak: async () => null });
  process.env.GUIDE_KEY = 'a-long-enough-key-1';
  process.env.GUIDE_CONTACT = 'Ask <the> maker';
  try {
    for (const k of [undefined, '', 'a', 'a-long-enough-key-2', 'a-long-enough-key-1x']) {
      assert.equal((await post(h, '/remark', { image: IMAGE, strokes: STROKES }, { headers: k === undefined ? {} : { 'x-inkwash-key': k } })).statusCode, 403, String(k));
    }
    assert.equal((await post(h, '/remark', { image: IMAGE, strokes: STROKES }, { headers: { 'x-inkwash-key': 'a-long-enough-key-1' } })).statusCode, 200);
    const page = await h({ rawPath: '/privacy', requestContext: { http: { method: 'GET' } } });
    assert.equal(page.statusCode, 200, 'the privacy page needs no key');
    assert.match(page.headers['content-type'], /text\/html/);
    assert.match(page.headers['content-security-policy'], /default-src 'none'/);
    assert.ok(page.body.includes('Ask &lt;the&gt; maker') && !page.body.includes('<the>'), 'the contact, escaped');
    const other = await h({ rawPath: '/', requestContext: { http: { method: 'GET' } } });
    assert.equal(other.statusCode, 404);
    assert.match(other.body, /Nothing here/);
    assert.ok(!/error|stack|lambda/i.test(other.body));
  } finally { delete process.env.GUIDE_KEY; delete process.env.GUIDE_CONTACT; }
});

test('the privacy page says what the code does', () => {
  const p = privacyPage();
  for (const said of [
    /no accounts, no ads,\s+no analytics and no tracking/,
    /Amazon Bedrock/, /Amazon Polly/, /Amazon Nova Canvas/,
    /the brush strokes you painted it\s+with, in black on white/, // things.js conditionOf, illustrator.mjs thing
    /Only when you choose to walk inside a picture/, /World Labs/, // marble.mjs: only when they ask
    /at least ten different tellings/, // commons-store.mjs: k = 10
    /A pairing ends after 30\s+minutes/, // phone.mjs: TTL
    /Error logs<\/strong>, for 14 days/, // template.yaml: the log group's retention
    /for ten minutes, in its memory only/, // limits.mjs: callerLimits
    /holds what it made, with a fingerprint of what was asked, for ten minutes, in its memory\s+only/, // once.mjs: ONCE.ttl
    /this one hasn’t yet/,
    /Write to whoever gave you the app/,
  ]) assert.match(p, said);
  assert.match(privacyPage({ optedOut: true }), /has opted out of AWS using that text to improve Polly/);
  // pictures from Google's Gemini: said so, and Nova Canvas named nowhere
  const g = privacyPage({ pictures: 'gemini', clips: false });
  assert.match(g, /Google’s Gemini API|Google's Gemini API/);
  assert.match(g, /Amazon Bedrock/);
  assert.doesNotMatch(g, /Nova Canvas|Nova Reel/);
  assert.match(g, /the brush\s+strokes you painted it\s+with, in black on white/);
  assert.doesNotMatch(privacyPage({ clips: false }), /A clip, for a day|Nova Reel/, 'no clips made, none said');
  // Claude through Anthropic's own API: said so, with Polly still on AWS, and Bedrock named nowhere
  const a = privacyPage({ models: 'anthropic', pictures: 'gemini', clips: false });
  assert.match(a, /Anthropic’s API<\/strong>, where Anthropic’s AI models\s+\(Claude\) look at the painting/);
  assert.match(a, /doesn’t train models on\s+what it is sent/);
  assert.match(a, /<strong>Amazon Polly<\/strong>, on Amazon Web Services/);
  assert.match(a, /Google’s Gemini API/);
  assert.doesNotMatch(a, /Bedrock|Nova/);
  assert.doesNotMatch(privacyPage({ models: 'anthropic', pictures: 'off', clips: false }), /Gemini|Bedrock|Nova/, 'no pictures made, none said');
  assert.match(privacyPage(), /A clip, for a day/);
});

test('the template holds to the code: alarms on the lines the guide logs, its log kept as long as the privacy page says', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const template = read('template.yaml');
  assert.match(template, /RetentionInDays: 14\n/);
  assert.match(privacyPage(), /for 14 days/);
  // what the alarms look for, and where the guide says it
  assert.match(template, /FilterPattern: '"guide error"'/);
  assert.match(read('guide.mjs'), /log\(`guide error: /);
  assert.match(read('lambda.mjs'), /console\.log\(`guide error: /);
  assert.match(template, /FilterPattern: '"told enough for today"'/);
  assert.match(read('limits.mjs'), /log\(`the guide has told enough for today: /);
  assert.match(read('lambda.mjs'), /console\.log\(`the guide has told enough for today: /);
  // what the function is given, and what the code reads
  for (const v of ['GUIDE_KEY', 'GUIDE_SPEND_PER_DAY', 'GUIDE_CONTACT', 'GUIDE_AI_OPT_OUT', 'GUIDE_COMMONS_TABLE']) {
    assert.match(template, new RegExp(`${v}: !Ref`), v);
    assert.match(read('lambda.mjs'), new RegExp(`process\\.env\\.${v}`), v);
  }
  // the key may not be left out, and the budget's action takes away only what costs money
  assert.match(template, /GuideKey:\n    Type: String\n    NoEcho: true\n    MinLength: 16\n/);
  assert.match(template, /Effect: Deny\n            Action: \[bedrock-mantle:CreateInference, bedrock:InvokeModel, bedrock:StartAsyncInvoke, polly:SynthesizeSpeech\]/);
});

test('Claude through Anthropic\'s own API: Bedrock\'s model IDs asked for by Anthropic\'s names, the rest as it was', async () => {
  const { bareModel, withBareModels } = await import('../lambda.mjs');
  assert.deepEqual(['anthropic.claude-opus-5-5', 'us.anthropic.claude-haiku-4-5', 'global.anthropic.claude-haiku-4-5', 'claude-opus-5-5'].map(bareModel),
    ['claude-opus-5-5', 'claude-haiku-4-5', 'claude-haiku-4-5', 'claude-opus-5-5']);
  const asked = [];
  const client = withBareModels({ messages: { async create(p, o) { asked.push([p, o]); return { content: [], usage: {} }; } } });
  const params = { model: 'anthropic.claude-opus-5-5', max_tokens: 10, system: [{ type: 'text', text: 'x', cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: 'Hi' }] };
  await client.messages.create(params, { timeout: 5 });
  assert.deepEqual(asked[0], [{ ...params, model: 'claude-opus-5-5' }, { timeout: 5 }]);
  assert.equal(params.model, 'anthropic.claude-opus-5-5', 'what was asked is left as it was');
  // counted at the same price either way
  const usage = { input_tokens: 1000, output_tokens: 100 };
  assert.equal(costOf('claude-opus-5-5', usage), costOf('anthropic.claude-opus-5-5', usage));
});
