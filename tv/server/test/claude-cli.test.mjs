import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClaudeCli, familyOf, replySchema } from '../claude-cli.mjs';
import { agentRequest, AGENT_SYSTEM, AGENT_TOOLS } from '../agent.mjs';

const JPEG = { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('a painting').toString('base64') };
// claude -p, as a script: records what it was run with, answers with `lines`
function fakeRun(lines) {
  const runs = [];
  const run = async ({ args, input, cwd }) => {
    runs.push({ args, message: JSON.parse(input), system: readFileSync(join(cwd, 'system.txt'), 'utf8') });
    return typeof lines === 'function' ? lines() : lines;
  };
  return { runs, run };
}
const arg = (args, name) => args[args.indexOf(name) + 1];

test('the storyteller through Claude Code: its own system prompt and tools, the conversation as one message with its pictures, and its reply as the Messages API\'s', async () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'TONIGHT\nTwo marks.' }, { type: 'image', source: JPEG }] },
    { role: 'assistant', content: [{ type: 'thinking', thinking: 'hm', signature: 's' }, { type: 'tool_use', id: 'toolu_1', name: 'look', input: { strokes: [2], zoom: true } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: 'Stroke 2, closer.' }, { type: 'image', source: JPEG }] }] },
  ];
  const turn = { content: [{ type: 'text', text: 'A shore.' }, { type: 'tool_use', name: 'ask', input: { question: 'What is this?', choices: ['A boat', 'A rock'], strokes: [2] } }] };
  const { runs, run } = fakeRun([{ type: 'system', subtype: 'init' }, { type: 'result', subtype: 'success', is_error: false, result: JSON.stringify(turn), structured_output: turn, usage: { input_tokens: 10, output_tokens: 40, cache_read_input_tokens: 2000, cache_creation_input_tokens: 300 }, modelUsage: { 'claude-opus-5-5': {} } }]);
  const res = await createClaudeCli({ run }).messages.create(agentRequest(messages, { model: 'anthropic.claude-opus-5-5', effort: 'medium' }));
  const [r] = runs;
  // Opus, no tools of its own, the effort asked for, and the reply in the shape of a turn
  assert.equal(arg(r.args, '--model'), 'opus');
  assert.equal(arg(r.args, '--tools'), '');
  assert.equal(arg(r.args, '--effort'), 'medium');
  const schema = JSON.parse(arg(r.args, '--json-schema'));
  assert.deepEqual(schema.properties.content.items.anyOf.slice(1).map((s) => s.properties.name.const), AGENT_TOOLS.map((t) => t.name));
  assert.deepEqual(schema.properties.content.items.anyOf[2].properties.input, AGENT_TOOLS[1].input_schema);
  // its system prompt, the tools, and how to reply
  assert.ok(r.system.startsWith(AGENT_SYSTEM));
  assert.ok(AGENT_TOOLS.every((t) => r.system.includes(`- ${t.name}: `)) && /You cannot call the tools yourself here/.test(r.system));
  // the conversation: the turns marked, the call and what came back, its pictures in order; no thinking
  const c = r.message.message.content;
  assert.deepEqual(c.map((b) => b.type), ['text', 'image', 'text', 'image', 'text']);
  assert.match(c[0].text, /^\[user\]\nTONIGHT\nTwo marks\.$/);
  assert.equal(c[2].text, '[assistant]\n→ tool_use toolu_1 look {"strokes":[2],"zoom":true}\n[user]\n← tool_result toolu_1\nStroke 2, closer.');
  assert.match(c[4].text, /^\[assistant\]\n\(your turn/);
  assert.ok(!JSON.stringify(c).includes('hm'));
  // back as the Messages API: each call with an id of its own, why it stopped, the model, the tokens
  assert.equal(res.model, 'claude-opus-5-5');
  assert.equal(res.stop_reason, 'tool_use');
  assert.deepEqual(res.content.map((b) => b.type), ['text', 'tool_use']);
  assert.match(res.content[1].id, /^toolu_cli_[0-9a-f]{18}$/);
  assert.deepEqual(res.content[1].input, turn.content[1].input);
  assert.deepEqual(res.usage, { input_tokens: 10, output_tokens: 40, cache_read_input_tokens: 2000, cache_creation_input_tokens: 300 });
});

test('a question with no tools goes as it is, and its answer comes back as text', async () => {
  const { runs, run } = fakeRun([{ type: 'result', subtype: 'success', is_error: false, result: '{"say":"Two marks, low."}', usage: { input_tokens: 5, output_tokens: 9 }, modelUsage: { 'claude-haiku-5-5': {} } }]);
  const res = await createClaudeCli({ run }).messages.create({ model: 'anthropic.claude-haiku-4-5', max_tokens: 300, system: 'You are the remark.', messages: [{ role: 'user', content: [{ type: 'image', source: JPEG }, { type: 'text', text: 'Say something.' }] }] });
  const [r] = runs;
  assert.equal(arg(r.args, '--model'), 'haiku');
  assert.ok(!r.args.includes('--json-schema') && !r.args.includes('--effort'));
  assert.equal(r.system, 'You are the remark.');
  assert.deepEqual(r.message.message.content, [{ type: 'image', source: JPEG }, { type: 'text', text: 'Say something.' }]);
  assert.deepEqual(res.content, [{ type: 'text', text: '{"say":"Two marks, low."}' }]);
  assert.equal(res.stop_reason, 'end_turn');
});

test('what goes wrong comes back as the API\'s errors, and at most so many run at once', async () => {
  const limited = fakeRun([{ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'Claude usage limit reached' }]);
  await assert.rejects(createClaudeCli({ run: limited.run }).messages.create({ model: 'opus', messages: [{ role: 'user', content: 'hi' }] }), (e) => e.status === 529);
  const empty = fakeRun([{ type: 'system', subtype: 'init' }]);
  await assert.rejects(createClaudeCli({ run: empty.run }).messages.create({ model: 'opus', messages: [{ role: 'user', content: 'hi' }] }), (e) => e.status === 502);
  // a turn with no blocks isn't a turn
  const blank = fakeRun([{ type: 'result', is_error: false, result: '{}', structured_output: { content: [] } }]);
  await assert.rejects(createClaudeCli({ run: blank.run }).messages.create({ model: 'opus', tools: AGENT_TOOLS, messages: [{ role: 'user', content: 'hi' }] }), (e) => e.status === 502);
  // a call that hangs, or ends with nothing, is made once more; a limit reached is not
  let n = 0;
  const heard = [];
  const flaky = async () => { if (++n === 1) throw Object.assign(new Error('claude -p took over 120s'), { status: 504 }); return [{ type: 'result', is_error: false, result: 'at last' }]; };
  const again = await createClaudeCli({ run: flaky, onCall: (c) => heard.push(c) }).messages.create({ model: 'opus', messages: [{ role: 'user', content: 'hi' }] });
  assert.deepEqual([n, again.content[0].text, heard.map((c) => !!c.again)], [2, 'at last', [true, false]]);
  assert.equal(limited.runs.length, 1, 'a usage limit is not tried again');
  assert.equal(empty.runs.length, 2, 'nothing said: tried again, then given up');
  let now = 0, most = 0;
  const run = async () => { now++; most = Math.max(most, now); await new Promise((ok) => setTimeout(ok, 20)); now--; return [{ type: 'result', is_error: false, result: 'ok' }]; };
  const cli = createClaudeCli({ run, atMost: 2 });
  await Promise.all(Array.from({ length: 6 }, () => cli.messages.create({ model: 'haiku', messages: [{ role: 'user', content: 'hi' }] })));
  assert.equal(most, 2);
  assert.deepEqual(['anthropic.claude-opus-5-5', 'claude-sonnet-5-5', 'anthropic.claude-haiku-4-5', 'something else'].map(familyOf), ['opus', 'sonnet', 'haiku', 'sonnet']);
  assert.deepEqual(replySchema([]).properties.content.items.properties.type, { const: 'text' });
});
