import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// The story server as it is deployed today: Claude through Anthropic's own API (AnthropicKey) and
// pictures by Gemini (GeminiKey), through the real Anthropic SDK and gemini.mjs, with only the two
// APIs stood in for, at the network. Each stand-in turns away what its API would (a Bedrock model
// ID, a setting a model doesn't take, a seed Gemini's image models may not, a picture sent as the
// wrong type), and answers in its API's own shape. No call leaves this machine.
process.env.GUIDE_ANTHROPIC_KEY = 'test-anthropic-key';
process.env.GUIDE_GEMINI_KEY = 'test-gemini-key';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_EC2_METADATA_DISABLED = 'true'; // Polly finds no credentials at once, and stays quiet
for (const k of ['GUIDE_KEY', 'GUIDE_COMMONS_TABLE', 'GUIDE_REAL', 'GUIDE_ALIVE_BUCKET', 'GUIDE_WORLDLABS_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_PROFILE']) delete process.env[k];

const { AGENT_SYSTEM } = await import('../agent.mjs');
const { standInAgent } = await import('../agent-standin.mjs');
const { WONDER_SYSTEM, standInWonder } = await import('../worldbuilder.mjs');
const { ILLUSTRATE_SYSTEM, standInIllustrator } = await import('../illustrator.mjs');
const { SCENE_SYSTEM, standInScene } = await import('../scenery.mjs');
const { WIDE } = await import('../wide.mjs');
const { GEMINI } = await import('../gemini.mjs');
const { standInAnswer } = await import('../dev.mjs');

// a real PNG, w by h, so the TV-side shape of what Gemini sends back is a real one
function png(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = ~0; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = Buffer.alloc((w * 3 + 1) * h, 200);
  for (let y = 0; y < h; y++) rows[y * (w * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
const RATIOS = { '1:1': [120, 120], '3:2': [150, 100], '16:9': [160, 90], '21:9': [210, 90], '4:3': [120, 90], '5:4': [125, 100], '9:16': [90, 160] };

const said = { anthropic: [], gemini: [] };
// Opus's thinking is bound to the conversation that made it (preserved thinking, enforced for new
// accounts): its signature here is a hash of what came before it, as the API compares it (cache
// markers and key order aside; a string the same as one text block), and a later turn whose history
// has changed under it is refused
const plain = (v) => Array.isArray(v) ? v.map(plain) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).filter((k) => k !== 'cache_control').sort().map((k) => [k, plain(v[k])])) : v;
const asBlocks = (m) => ({ role: m.role, content: typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content });
const prefixOf = (p, upTo) => createHash('sha256').update(JSON.stringify(plain({ system: p.system, tools: p.tools, messages: p.messages.slice(0, upTo).map(asBlocks) }))).digest('hex').slice(0, 16);
const refuse = (status, type, message) => new Response(JSON.stringify({ type: 'error', error: { type, message } }), { status, headers: { 'content-type': 'application/json' } });
async function anthropic(init) {
  const h = new Headers(init.headers), p = JSON.parse(init.body);
  said.anthropic.push(p);
  if (h.get('x-api-key') !== 'test-anthropic-key' || !h.get('anthropic-version')) return refuse(401, 'authentication_error', 'invalid x-api-key');
  if (!/^claude-(opus-5-5|haiku-4-5)$/.test(p.model)) return refuse(404, 'not_found_error', `model: ${p.model}`);
  const opus = p.model === 'claude-opus-5-5';
  if (p.thinking) return refuse(400, 'invalid_request_error', 'thinking is not set by this server');
  if (p.output_config && !opus) return refuse(400, 'invalid_request_error', `output_config.effort is not supported on ${p.model}`);
  if (p.output_config && !['low', 'medium', 'high', 'xhigh', 'max'].includes(p.output_config.effort)) return refuse(400, 'invalid_request_error', 'output_config.effort');
  if (!(p.max_tokens > 0) || p.max_tokens > (opus ? 128000 : 64000)) return refuse(400, 'invalid_request_error', 'max_tokens');
  if (!Array.isArray(p.messages) || !p.messages.length || p.messages.at(-1).role !== 'user') return refuse(400, 'invalid_request_error', 'the last message must be the user\'s (no prefill)');
  if (p.messages.some((m, i) => m.role !== (i % 2 ? 'assistant' : 'user'))) return refuse(400, 'invalid_request_error', 'roles must alternate');
  for (const m of p.messages) for (const b of Array.isArray(m.content) ? m.content : []) {
    if (b.type === 'image' && !(b.source && b.source.type === 'base64' && ['image/jpeg', 'image/png'].includes(b.source.media_type))) return refuse(400, 'invalid_request_error', 'image source');
  }
  for (const [i, m] of p.messages.entries()) {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const b of m.content) if (b.type === 'thinking' && b.signature !== `sig-${prefixOf(p, i)}`) return refuse(400, 'invalid_request_error', `messages.${i}: thinking block does not match the conversation that produced it (prefix_binding_mismatch)`);
  }
  const system = Array.isArray(p.system) ? p.system[0].text : String(p.system || '');
  const out = system === AGENT_SYSTEM ? standInAgent(p) : system.startsWith(WONDER_SYSTEM) ? standInWonder(p)
    : system.startsWith(ILLUSTRATE_SYSTEM) ? standInIllustrator(p) : system.startsWith(SCENE_SYSTEM) ? standInScene(p)
      : { content: [{ type: 'text', text: JSON.stringify(standInAnswer(p)) }] };
  const answer = await out;
  // as Opus answers: a thinking block (its text omitted), then what it says and does
  if (opus) answer.content = [{ type: 'thinking', thinking: '', signature: `sig-${prefixOf(p, p.messages.length)}` }, ...answer.content];
  const msg = { id: `msg_${said.anthropic.length}`, type: 'message', role: 'assistant', model: p.model, stop_reason: answer.content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn', stop_sequence: null, usage: { input_tokens: 100, output_tokens: 20 }, ...answer };
  return new Response(JSON.stringify(msg), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_1' } });
}
function gemini(url, init) {
  const h = new Headers(init.headers), b = JSON.parse(init.body), model = /models\/([^:]+):generateContent$/.exec(url)[1];
  said.gemini.push({ model, body: b });
  const no = (status, message) => new Response(JSON.stringify({ error: { code: status, message, status: 'INVALID_ARGUMENT' } }), { status, headers: { 'content-type': 'application/json' } });
  if (h.get('x-goog-api-key') !== 'test-gemini-key' || /key=/.test(url)) return no(403, 'API key not valid');
  if (!GEMINI.models.includes(model)) return no(404, `models/${model} is not found`);
  const parts = b.contents && b.contents[0] && b.contents[0].parts;
  if (!Array.isArray(parts) || typeof parts[0].text !== 'string' || !parts[0].text.trim()) return no(400, 'contents[0].parts[0].text');
  for (const p of parts.slice(1)) {
    const d = p.inlineData;
    if (!d || !/^[A-Za-z0-9+/=]+$/.test(d.data)) return no(400, 'inline data must be base64');
    if (d.mimeType !== (d.data.startsWith('/9j/') ? 'image/jpeg' : 'image/png')) return no(400, `inline data is not ${d.mimeType}`);
  }
  const g = b.generationConfig || {};
  if (Object.keys(g).some((k) => !['responseModalities', 'imageConfig'].includes(k))) return no(400, `generationConfig: ${Object.keys(g)}`);
  if (g.imageConfig && !GEMINI.ratios.includes(g.imageConfig.aspectRatio)) return no(400, 'imageConfig.aspectRatio');
  const [w, hgt] = RATIOS[(g.imageConfig && g.imageConfig.aspectRatio) || '1:1'];
  return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'Here it is.' }, { inlineData: { mimeType: 'image/png', data: png(w, hgt) } }] }, finishReason: 'STOP' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
}
const real = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input && input.url ? input.url : input);
  if (url.startsWith('https://api.anthropic.com/v1/messages')) return anthropic(init);
  if (url.startsWith(`${GEMINI.base}/models/`)) return gemini(url, init);
  throw new Error(`a call that would have left this machine: ${url}`);
};

const { handler } = await import('../lambda.mjs');
const call = async (path, body, method = 'POST') => {
  const r = await handler({ rawPath: path, headers: {}, body: body == null ? '' : JSON.stringify(body), requestContext: { http: { method, sourceIp: '203.0.113.9' } } });
  let json = null;
  try { json = JSON.parse(r.body); } catch { json = null; }
  return { status: r.statusCode, json, body: r.body };
};
const IMAGE = `data:image/png;base64,${png(160, 100)}`;
const STROKES = [{ n: 1, ink: 'dense', from: [300, 650], to: [520, 650], box: [300, 642, 520, 658], length: 220, turn: 0.1, pressure: 0.5, pools: [] }];
const shape = (b64) => { const x = Buffer.from(b64, 'base64'); return [x.readUInt32BE(16), x.readUInt32BE(20)]; };

test('deployed: the privacy page says the story goes to Anthropic and the pictures to Google', async () => {
  const r = await call('/privacy', null, 'GET');
  assert.equal(r.status, 200);
  assert.match(r.body, /Anthropic’s API/);
  assert.match(r.body, /Google’s Gemini API/);
  assert.doesNotMatch(r.body, /Bedrock|Nova/);
});

test('deployed: a remark and a turn of the storyteller, through Anthropic\'s API as it takes them', async () => {
  const remark = await call('/remark', { image: IMAGE, strokes: STROKES, said: ['A pier at dusk.'] });
  assert.equal(remark.status, 200, JSON.stringify(remark.json));
  assert.ok(remark.json.say);
  // the TV's loop: each turn sent back as it came, the tool results after it, three rounds; Opus
  // answers every one (a changed history would be refused, and the guide would fall back to Haiku)
  const messages = [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: IMAGE.split(',')[1] } }, { type: 'text', text: 'TONIGHT\n{"night":1}\nTell it.' }] }];
  for (let round = 0; round < 3; round++) {
    const agent = await call('/agent', { messages: JSON.parse(JSON.stringify(messages)) });
    assert.equal(agent.status, 200, JSON.stringify(agent.json));
    assert.equal(agent.json.model, 'claude-opus-5-5', `round ${round}: Opus answered, no fall back to Haiku`);
    assert.equal(agent.json.content[0].type, 'thinking', 'its thinking sent to the TV, to be sent back');
    messages.push({ role: 'assistant', content: agent.json.content });
    const calls = agent.json.content.filter((b) => b.type === 'tool_use');
    if (!calls.length) { messages.push({ role: 'user', content: 'Go on.' }); continue; }
    messages.push({ role: 'user', content: calls.map((c) => ({ type: 'tool_result', tool_use_id: c.id, content: `done: ${c.name}` })) });
  }
  // and a history changed under a turn is refused: the guide goes on with Haiku
  const edited = JSON.parse(JSON.stringify(messages));
  edited[0].content[1].text = 'TONIGHT\n{"night":1}\nTell it again.';
  const fallen = await call('/agent', { messages: edited });
  assert.equal(fallen.status, 200);
  assert.equal(fallen.json.model, 'claude-haiku-4-5', 'refused, so Haiku told it');
  const asked = said.anthropic.map((p) => p.model);
  assert.ok(asked.includes('claude-opus-5-5') && asked.includes('claude-haiku-4-5'), asked.join(', '));
  assert.ok(said.anthropic.every((p) => !/^anthropic\./.test(p.model)), 'never a Bedrock model ID');
});

test('deployed: the night made real, its place, a thing on white, a panorama, all by Gemini, each the shape the TV wants', async () => {
  const brief = { title: 'The Low Shore', lines: [{ text: 'A long pier ran out into the dark water.' }], things: [] };
  const made = await call('/real', { image: IMAGE, brief, seed: 7 });
  assert.equal(made.status, 200, JSON.stringify(made.json));
  assert.match(made.json.image, /^data:image\/png;base64,/);
  assert.deepEqual(shape(made.json.image.split(',')[1]), [150, 100], 'at 3:2, for the TV to fit to its 16:10 paper');
  const scene = (await call('/scene', { brief: { world: 'Leaf', nights: [{ n: 1, title: 'The Low Shore', story: ['A pier.'] }], things: [] } })).json.scene;
  assert.ok(scene, 'the Set Designer wrote where it stands');
  const place = await call('/backdrop', { scene, image: `data:image/jpeg;base64,${Buffer.from('the drawn place').toString('base64')}`, seed: 2 });
  assert.equal(place.status, 200, JSON.stringify(place.json));
  assert.deepEqual(shape(place.json.image.split(',')[1]), [160, 90], '16:9, as the TV drew it');
  const thing = await call('/thing', { image: IMAGE, name: 'the night ferry', look: 'a small red wooden ferry', width: 400, height: 320 });
  assert.equal(thing.status, 200, JSON.stringify(thing.json));
  assert.equal(thing.json.cut, undefined, 'Gemini can\'t cut it out: the TV does');
  assert.deepEqual(shape(thing.json.image.split(',')[1]), [125, 100], '5:4, as its strokes are');
  const again = await call('/thing', { image: IMAGE, name: 'the night ferry', rule: 'it is blue now', reference: IMAGE, width: 400, height: 320 });
  assert.equal(again.status, 200, JSON.stringify(again.json));
  const sheet = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, WIDE.height >> 8, WIDE.height & 255, WIDE.width >> 8, WIDE.width & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]), Buffer.alloc(80)]).toString('base64')}`;
  const ihdr = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b.toString('base64'); };
  const all = await call('/wide', { image: sheet, mask: `data:image/png;base64,${ihdr(WIDE.width, WIDE.height)}`, scene: 'A lake.' });
  assert.equal(all.status, 200, JSON.stringify(all.json));
  assert.deepEqual(shape(all.json.image.split(',')[1]), [210, 90], 'at Gemini\'s widest, 21:9');
  // every picture asked of the model this key has, with its key in a header, and never a seed
  assert.ok(said.gemini.length >= 5);
  assert.ok(said.gemini.every((g) => g.model === GEMINI.models[0] && !('seed' in (g.body.generationConfig || {}))));
});

test('deployed: nothing left this machine', () => {
  assert.equal(typeof real, 'function');
  assert.ok(said.anthropic.length > 0 && said.gemini.length > 0);
});
