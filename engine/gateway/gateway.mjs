// The model gateway: every model call the product (and the eval) makes goes through here.
//
// - Routes: each operation has an ordered list of model routes. The first is tried; if its answer
//   fails verification, or says it is unsure, the next is tried (escalation).
// - Caps: before a call, its worst-case cost (input at list price plus `maxTokens` of output) must
//   fit the call cap and what is left of the user's day and month. A route whose price is unknown
//   isn't run while caps are set.
// - Verification: the answer must parse as JSON when the operation expects it, pass the
//   operation's own `check`, and cite only what it was shown. Items citing anything else are
//   dropped and counted.
// - Telemetry: one row per call: who (hashed), what operation and route,
//   tokens (uncached, cache read, cache write, output, reasoning), time, cost from the dated price
//   table, world and working-set size, what was cut, outcome, verification, escalation. No prompt
//   or reply text is stored.
// - Privacy: the gateway is given the compiled working set, never the world. `redact` runs on
//   everything that leaves; the row records how many facts and passages left, not what they said.
import { parseJSON } from './verify.mjs';

const MS = 1000;

export function priceTable(json) {
  const rows = json.models || [];
  return {
    // the row in force at `when` for this provider and model (and window, for peak pricing)
    find(provider, model, { when = new Date(), window = null } = {}) {
      const day = when.toISOString().slice(0, 10);
      const c = rows.filter((r) => r.provider === provider && r.model === model && (!window || !r.window || r.window === window) && (!r.effective || r.effective <= day) && (!r.until || day <= r.until));
      return c.sort((a, b) => String(b.effective).localeCompare(String(a.effective)))[0] || null;
    },
  };
}

export function costOf(price, usage) {
  if (!price || price.input == null || price.output == null) return null;
  const p = (x, rate) => (x || 0) * (rate ?? price.input) / 1e6;
  return p(usage.input, price.input) + p(usage.cacheRead, price.cacheRead ?? price.input) + p(usage.cacheWrite, price.cacheWrite ?? price.input) + p((usage.output || 0) + (usage.reasoning || 0), price.output);
}

const estTokens = (s) => Math.ceil(String(s || '').length / 4);

export function createGateway({
  providers, routes, prices, caps = null, sink = null, hash = (s) => s, redact = (s) => s,
  now = () => new Date(), timeoutMs = 60 * MS, routeVersion = 'v1',
}) {
  const spent = new Map(); // `${user}|day|2026-10-05` or `${user}|month|2026-10` -> USD
  const add = (k, usd) => spent.set(k, (spent.get(k) || 0) + usd);
  const keys = (user, when) => [`${user}|day|${when.toISOString().slice(0, 10)}`, `${user}|month|${when.toISOString().slice(0, 7)}`];

  function capCheck(user, worst) {
    if (!caps) return null;
    if (worst == null) return 'no price for this route, and caps are set';
    if (caps.perCallUsd != null && worst > caps.perCallUsd) return `worst case $${worst.toFixed(4)} is over the per-call cap`;
    const [d, m] = keys(user, now());
    if (caps.perDayUsd != null && (spent.get(d) || 0) + worst > caps.perDayUsd) return 'the daily cap would be passed';
    if (caps.perMonthUsd != null && (spent.get(m) || 0) + worst > caps.perMonthUsd) return 'the monthly cap would be passed';
    return null;
  }

  // run({ op, user, world, template, system, prompt, context: { lines, manifest, worldFacts, worldTokens },
  //       expect: 'json'|'text', check(data) -> [errors], cites(data) -> [refs], allowed: Set, unsure(data) -> bool,
  //       drop(data, badRefs) -> data })
  async function run(req) {
    const list = routes[req.op];
    if (!list || !list.length) throw new Error(`no route for ${req.op}`);
    const userH = hash(req.user || 'anon'), worldH = hash(req.world || 'none');
    const system = redact(req.system || '');
    const prompt = redact(req.prompt || '');
    const attempts = [];
    let last = null;
    for (let i = 0; i < list.length; i++) {
      const route = list[i];
      const provider = providers[route.provider];
      const price = prices.find(route.provider, route.model, { when: now(), window: route.window || null });
      const inTok = estTokens(system) + estTokens(prompt);
      const worst = costOf(price, { input: inTok, output: route.maxTokens });
      const row = {
        ts: now().toISOString(), op: req.op, routeVersion, template: req.template || null, attempt: i + 1,
        user: userH, world: worldH, provider: route.provider, model: route.model, effort: route.effort || null,
        tokens: null, ms: null, costUsd: null, priceEffective: price?.effective ?? null,
        worldFacts: req.context?.worldFacts ?? null, worldTokens: req.context?.worldTokens ?? null,
        contextFacts: req.context?.lines?.length ?? null, contextTokens: inTok,
        cutFacts: req.context?.manifest?.cut?.dropped ?? null,
        outcome: null, verification: null, escalatedTo: null,
      };
      const refused = !provider ? `no provider ${route.provider}` : capCheck(userH, worst);
      if (refused) {
        row.outcome = 'cap';
        row.verification = { reason: refused };
        attempts.push(row); sink?.write(row);
        continue;
      }
      const t0 = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), route.timeoutMs || timeoutMs);
      let res = null;
      try {
        res = await Promise.race([
          provider.call({ model: route.model, system, messages: [{ role: 'user', content: prompt }], maxTokens: route.maxTokens, effort: route.effort, signal: ctrl.signal }),
          new Promise((_, rej) => ctrl.signal.addEventListener('abort', () => rej(Object.assign(new Error('timeout'), { code: 'timeout' })))),
        ]);
      } catch (e) {
        row.outcome = e.code === 'timeout' ? 'timeout' : 'error';
        row.verification = { reason: String(e.message || e).slice(0, 200) };
      } finally { clearTimeout(timer); }
      row.ms = Date.now() - t0;
      if (res) {
        row.tokens = res.usage;
        row.costUsd = costOf(price, res.usage);
        if (row.costUsd != null) for (const k of keys(userH, now())) add(k, row.costUsd);
        if (res.stopReason === 'refusal') row.outcome = 'refusal';
        else {
          const v = verifyAnswer(res.text, req);
          row.outcome = v.ok ? 'ok' : 'schema';
          row.verification = { errors: v.errors.slice(0, 5), dropped: v.dropped, unsure: v.unsure };
          last = { ...v, text: res.text, route, row };
          if (v.ok && !v.unsure) { attempts.push(row); sink?.write(row); return { ok: true, data: v.data, text: res.text, attempts, costUsd: sum(attempts) }; }
        }
      }
      if (i + 1 < list.length) row.escalatedTo = `${list[i + 1].provider}:${list[i + 1].model}`;
      attempts.push(row); sink?.write(row);
    }
    // nothing passed: the last parsed answer, marked, if there was one
    return { ok: false, data: last?.ok ? last.data : null, unsure: !!last?.unsure, text: last?.text ?? null, attempts, costUsd: sum(attempts) };
  }
  return { run, spent: (user) => { const [d, m] = keys(hash(user), now()); return { day: spent.get(d) || 0, month: spent.get(m) || 0 }; } };
}

const sum = (rows) => rows.reduce((a, r) => a + (r.costUsd || 0), 0);

export function verifyAnswer(text, req) {
  if (req.expect !== 'json') return { ok: true, data: text, errors: [], dropped: 0, unsure: false };
  let data;
  try { data = parseJSON(text); } catch (e) { return { ok: false, data: null, errors: [`not JSON: ${e.message}`], dropped: 0, unsure: false }; }
  const errors = req.check ? req.check(data) : [];
  let dropped = 0;
  if (req.cites && req.allowed) {
    const bad = req.cites(data).filter((r) => !req.allowed.has(r));
    if (bad.length) { dropped = bad.length; if (req.drop) data = req.drop(data, new Set(bad)); else errors.push(`cites what it wasn't shown: ${bad.slice(0, 3).join(', ')}`); }
  }
  return { ok: errors.length === 0, data, errors, dropped, unsure: !!(req.unsure && req.unsure(data)) };
}
