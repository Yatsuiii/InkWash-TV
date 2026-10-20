// The Messages API, answered by Claude Code on the Claude subscription it is signed in with: to run
// the story server without AWS (node server/dev.mjs --cli). The guide's own prompts, tools and
// checks are used as they are; only the way a request reaches Claude changes. Each call runs
// `claude -p` once, with no tools of its own: the request's system prompt as its system prompt; the
// conversation so far as one message, its pictures as pictures; and, when the request has tools,
// the reply asked for as JSON in the shape of the assistant's turn, each tool a shape a block of it
// may take, with that tool's own input. Opus, Sonnet or Haiku, by the family the request names.
//
// No voice (Polly) and no pictures made real (Nova Canvas): those are on AWS.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export const familyOf = (model) => (/opus/i.test(model) ? 'opus' : /haiku/i.test(model) ? 'haiku' : 'sonnet');

const textOf = (system) => (Array.isArray(system) ? system.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n\n') : String(system || ''));

// The shape of the reply: the assistant's turn, its blocks text or a call of one of the tools
export function replySchema(tools = []) {
  const text = { type: 'object', properties: { type: { const: 'text' }, text: { type: 'string' } }, required: ['type', 'text'], additionalProperties: false };
  const calls = tools.map((t) => ({ type: 'object', properties: { type: { const: 'tool_use' }, name: { const: t.name }, input: t.input_schema || { type: 'object' } }, required: ['type', 'name', 'input'], additionalProperties: false }));
  return { type: 'object', properties: { content: { type: 'array', minItems: 1, items: calls.length ? { anyOf: [text, ...calls] } : text } }, required: ['content'], additionalProperties: false };
}

// What the system prompt gains: how the conversation reaches Claude here, the tools, and the reply
export function systemFor(params) {
  const tools = params.tools || [];
  if (!tools.length) return textOf(params.system);
  const choice = params.tool_choice || { type: 'auto' };
  const must = choice.type === 'tool' ? `You must call ${choice.name}.` : choice.type === 'any' ? 'You must call one of the tools.' : choice.type === 'none' ? 'Do not call a tool.' : '';
  return `${textOf(params.system)}

---
This conversation reaches you as a Messages API call. The conversation so far is the message below, each turn marked [user] or [assistant]; a tool call in it is marked "→ tool_use <id> <name> <input>", and what came back "← tool_result <id>", with any picture it returned after it.
You cannot call the tools yourself here: you have no tools of your own. Reply with the assistant's next turn, as the JSON your output asks for: its content, in order, as text blocks and tool_use blocks ({"type": "tool_use", "name": ..., "input": ...}), exactly as you would answer in the Messages API.${must ? ` ${must}` : ''}

The tools:
${tools.map((t) => `- ${t.name}: ${t.description || ''}\n  input: ${JSON.stringify(t.input_schema || {})}`).join('\n')}`;
}

// The conversation as one message: the turns as text, the pictures as they came (a single
// question, with no tools, as it is)
export function messageFor(params) {
  const out = [], tools = params.tools || [], messages = params.messages || [];
  const marked = tools.length > 0 || messages.length > 1;
  const say = (text) => { const last = out[out.length - 1]; if (last && last.type === 'text') last.text += `\n${text}`; else out.push({ type: 'text', text }); };
  const picture = (b) => out.push({ type: 'image', source: b.source });
  const blocks = (content) => (typeof content === 'string' ? [{ type: 'text', text: content }] : content || []);
  for (const m of messages) {
    if (marked) say(`[${m.role}]`);
    for (const b of blocks(m.content)) {
      if (b.type === 'text') say(b.text);
      else if (b.type === 'image') picture(b);
      else if (b.type === 'tool_use') say(`→ tool_use ${b.id} ${b.name} ${JSON.stringify(b.input)}`);
      else if (b.type === 'tool_result') {
        say(`← tool_result ${b.tool_use_id}${b.is_error ? ' (an error)' : ''}`);
        for (const r of blocks(b.content)) { if (r.type === 'text') say(r.text); else if (r.type === 'image') picture(r); }
      }
      // thinking is Claude's own, and isn't passed on
    }
  }
  if (tools.length) say('[assistant]\n(your turn: reply with this turn as JSON)');
  return { type: 'user', message: { role: 'user', content: out } };
}

// Claude Code's answer, as the Messages API's
export function responseFrom(lines, params) {
  const result = lines.find((l) => l.type === 'result');
  if (!result) throw Object.assign(new Error('claude -p gave no result'), { status: 502 });
  if (result.is_error) throw Object.assign(new Error(`claude -p: ${String(result.result || result.subtype || 'error').slice(0, 300)}`), { status: /rate|limit|overload/i.test(String(result.result)) ? 529 : 502 });
  const model = Object.keys(result.modelUsage || {})[0] || params.model;
  const u = result.usage || {};
  const usage = { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0, cache_read_input_tokens: u.cache_read_input_tokens || 0, cache_creation_input_tokens: u.cache_creation_input_tokens || 0 };
  let content;
  if ((params.tools || []).length) {
    const s = result.structured_output || (() => { try { return JSON.parse(result.result); } catch { return null; } })();
    if (!s || !Array.isArray(s.content) || !s.content.length) throw Object.assign(new Error('claude -p: no turn in its reply'), { status: 502 });
    content = s.content.map((b) => (b.type === 'tool_use' ? { type: 'tool_use', id: `toolu_cli_${randomBytes(9).toString('hex')}`, name: b.name, input: b.input || {} } : { type: 'text', text: String(b.text || '') }));
  } else content = [{ type: 'text', text: String(result.result || '') }];
  return { id: `msg_cli_${randomBytes(9).toString('hex')}`, type: 'message', role: 'assistant', model, content, stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn', usage };
}

// `claude -p`, run once: `args`, `input` on stdin; resolves its stdout's JSON lines
function runClaude({ bin, args, input, cwd, timeout }) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Object.assign(new Error(`claude -p took over ${timeout / 1000}s`), { status: 504 })); }, timeout);
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const lines = out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      if (!lines.length) return reject(Object.assign(new Error(`claude -p exited ${code}: ${err.slice(0, 300)}`), { status: 502 }));
      resolve(lines);
    });
    child.stdin.end(input);
  });
}

// `{ messages: { create(params) } }`, as the Anthropic SDK's client. `at most` calls run at once;
// `run` stands in for claude -p in tests; `onCall` hears each call (its model, seconds, usage). A
// call that hangs past `timeout`, or ends with nothing to say, is made again, `tries` in all: a turn
// takes seconds, and one stuck `claude -p` would otherwise stop a night.
export function createClaudeCli({ bin = 'claude', atMost = 3, timeout = 120000, tries = 2, run = runClaude, onCall = () => {} } = {}) {
  let running = 0;
  const waiting = [];
  const slot = () => (running < atMost ? (running++, Promise.resolve()) : new Promise((ok) => waiting.push(ok)));
  const free = () => { const next = waiting.shift(); if (next) next(); else running--; };
  return {
    messages: {
      async create(params) {
        await slot();
        const dir = mkdtempSync(join(tmpdir(), 'inkwash-cli-'));
        const t0 = Date.now();
        try {
          writeFileSync(join(dir, 'system.txt'), systemFor(params));
          const tools = params.tools || [];
          const effort = params.output_config && params.output_config.effort;
          const args = ['-p', '--model', familyOf(params.model), '--tools', '', '--no-session-persistence', '--setting-sources', '', '--system-prompt-file', join(dir, 'system.txt'),
            '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
            ...(tools.length ? ['--json-schema', JSON.stringify(replySchema(tools))] : []), ...(effort ? ['--effort', effort] : [])];
          let res;
          for (let k = 1; !res; k++) {
            try {
              res = responseFrom(await run({ bin, args, input: `${JSON.stringify(messageFor(params))}\n`, cwd: dir, timeout }), params);
            } catch (err) {
              if (k >= tries || ![502, 504].includes(err.status)) throw err;
              onCall({ model: params.model, family: familyOf(params.model), seconds: (Date.now() - t0) / 1000, again: err.message, calls: [] });
            }
          }
          onCall({ model: res.model, family: familyOf(params.model), seconds: (Date.now() - t0) / 1000, usage: res.usage, tools: tools.length, calls: res.content.filter((b) => b.type === 'tool_use').map((b) => b.name) });
          return res;
        } finally {
          rmSync(dir, { recursive: true, force: true });
          free();
        }
      },
    },
  };
}
