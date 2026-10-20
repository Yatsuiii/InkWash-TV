// Model providers behind one call shape:
//   call({ model, system, messages, maxTokens, effort, signal })
//     -> { text, stopReason, model, usage: { input, cacheRead, cacheWrite, output, reasoning } }
// `usage.input` is uncached input only, so cost is input + cacheRead + cacheWrite + output, each
// at its own price.
//
// - Claude goes through the Anthropic SDK: the Claude API (`anthropicProvider`) or Claude in
//   Amazon Bedrock (`bedrockProvider`, the SDK's AnthropicBedrockMantle client). Credentials
//   come from the environment, as the SDKs resolve them; nothing here reads or stores a key.
// - Other model families go through an OpenAI-compatible chat endpoint (`openAICompatible`).
//   Written to the common shape of those APIs and not yet run against a live endpoint; check
//   the first rows of telemetry when one is first used.
// - `fakeProvider` answers from a function, for tests and dry runs. No network.
// The SDKs are imported only when a provider is first used, so the engine has no dependencies.

const textOf = (content) => (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');

function claudeShape(res) {
  const u = res.usage || {};
  return {
    text: textOf(res.content),
    stopReason: res.stop_reason,
    model: res.model,
    usage: { input: u.input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, output: u.output_tokens || 0, reasoning: 0 },
  };
}
function claudeRequest({ model, system, messages, maxTokens, effort }) {
  // Claude Opus 5.5 always thinks; `effort` sets how much. Send it only where a route asks.
  return { model, max_tokens: maxTokens, ...(system ? { system } : {}), messages, ...(effort ? { output_config: { effort } } : {}) };
}

export function anthropicProvider({ client = null } = {}) {
  let c = client;
  return {
    name: 'anthropic',
    async call(req) {
      if (!c) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); c = new Anthropic(); }
      return claudeShape(await c.messages.create(claudeRequest(req), { signal: req.signal }));
    },
  };
}

export function bedrockProvider({ client = null, awsRegion = process.env.AWS_REGION } = {}) {
  let c = client;
  return {
    name: 'bedrock',
    async call(req) {
      if (!c) { const { AnthropicBedrockMantle } = await import('@anthropic-ai/bedrock-sdk'); c = new AnthropicBedrockMantle({ awsRegion }); }
      return claudeShape(await c.messages.create(claudeRequest(req), { signal: req.signal }));
    },
  };
}

// For non-Claude models. `apiKeyEnv` names the environment variable that holds the key.
export function openAICompatible({ name, baseURL, apiKeyEnv, fetchImpl = globalThis.fetch }) {
  return {
    name,
    async call({ model, system, messages, maxTokens, signal }) {
      const key = process.env[apiKeyEnv];
      if (!key) throw Object.assign(new Error(`${apiKeyEnv} is not set`), { code: 'config' });
      const r = await fetchImpl(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages] }),
        signal,
      });
      if (!r.ok) throw Object.assign(new Error(`${name} answered ${r.status}`), { status: r.status });
      const j = await r.json();
      const u = j.usage || {};
      const cached = u.prompt_tokens_details?.cached_tokens ?? u.prompt_cache_hit_tokens ?? 0;
      return {
        text: j.choices?.[0]?.message?.content || '',
        stopReason: j.choices?.[0]?.finish_reason || null,
        model: j.model || model,
        usage: { input: Math.max(0, (u.prompt_tokens || 0) - cached), cacheRead: cached, cacheWrite: 0, output: u.completion_tokens || 0, reasoning: u.completion_tokens_details?.reasoning_tokens || 0 },
      };
    },
  };
}

// answer(req) -> { text, usage?, stopReason? } (or throws, or never resolves, to test timeouts)
export function fakeProvider(answer, name = 'fake') {
  return {
    name,
    async call(req) {
      const a = await answer(req);
      const chars = (req.system || '').length + req.messages.reduce((n, m) => n + String(m.content).length, 0);
      return { text: a.text, stopReason: a.stopReason || 'end_turn', model: req.model, usage: { input: Math.ceil(chars / 4), cacheRead: 0, cacheWrite: 0, output: Math.ceil(a.text.length / 4), reasoning: 0, ...(a.usage || {}) } };
    },
  };
}
