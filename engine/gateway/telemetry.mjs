// Where telemetry rows go, and what they add up to.
//
// One row per model call (gateway.mjs). Rows hold hashed user and world ids, counts, times and
// costs, never prompt or reply text. `rollup` gives the nightly numbers worth watching: per user
// per month, cost per operation, and the cost per user at p50, p90 and p99.
import fs from 'node:fs';
import crypto from 'node:crypto';

export function memorySink() {
  const rows = [];
  return { rows, write: (r) => rows.push(r) };
}

export function jsonlSink(file) {
  return { write: (r) => fs.appendFileSync(file, JSON.stringify(r) + '\n') };
}

// A salted hash, so telemetry can count users and worlds without naming them.
export function hasher(salt) {
  if (!salt) throw new Error('a salt is needed, so the hashes cannot be reversed by guessing ids');
  return (s) => crypto.createHash('sha256').update(`${salt}:${s}`).digest('hex').slice(0, 16);
}

const pct = (xs, p) => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };

export function rollup(rows) {
  const byUserMonth = new Map(), byOp = new Map();
  for (const r of rows) {
    const k = `${r.user}|${r.ts.slice(0, 7)}`;
    const u = byUserMonth.get(k) || { user: r.user, month: r.ts.slice(0, 7), calls: 0, ops: new Set(), tokensIn: 0, tokensOut: 0, usd: 0 };
    u.calls++;
    u.tokensIn += (r.tokens?.input || 0) + (r.tokens?.cacheRead || 0) + (r.tokens?.cacheWrite || 0);
    u.tokensOut += (r.tokens?.output || 0) + (r.tokens?.reasoning || 0);
    u.usd += r.costUsd || 0;
    byUserMonth.set(k, u);
    const o = byOp.get(r.op) || { op: r.op, calls: 0, usd: 0, ms: [], outcomes: {} };
    o.calls++; o.usd += r.costUsd || 0; if (r.ms != null) o.ms.push(r.ms);
    o.outcomes[r.outcome] = (o.outcomes[r.outcome] || 0) + 1;
    byOp.set(r.op, o);
  }
  const users = [...byUserMonth.values()].map((u) => ({ ...u, ops: undefined }));
  const usd = users.map((u) => u.usd);
  return {
    users,
    perUser: { p50: pct(usd, 50), p90: pct(usd, 90), p99: pct(usd, 99) },
    ops: [...byOp.values()].map((o) => ({ op: o.op, calls: o.calls, usd: o.usd, usdPerCall: o.usd / o.calls, msP50: pct(o.ms, 50), msP95: pct(o.ms, 95), outcomes: o.outcomes })),
  };
}
