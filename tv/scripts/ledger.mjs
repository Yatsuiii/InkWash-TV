// What a picture from Amazon Nova Canvas costs, and a ledger that refuses any picture that would
// take the spend past a cap. It is a file, so the cap holds across runs; each picture is counted
// before it is asked for, so one that fails after being billed is still counted. Estimated from
// Nova Canvas's on-demand prices: standard quality, both sides up to 1024, $0.04; larger, $0.06.
// Premium quality and more than one picture a call are never asked for.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export function priceOf(body) {
  const c = (body && body.imageGenerationConfig) || {};
  if (c.quality && c.quality !== 'standard') throw new Error('only standard quality is allowed');
  if ((c.numberOfImages || 1) !== 1) throw new Error('one picture a call');
  return (c.width || 1024) <= 1024 && (c.height || 1024) <= 1024 ? 0.04 : 0.06;
}

// `paint(body)` behind the ledger in `file`; `cap` in dollars
export function ledgered(paint, { file, cap }) {
  const read = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { spent: 0, calls: [] });
  const fn = async (body, note = '') => {
    const l = read(), cost = priceOf(body);
    if (l.spent + cost > cap + 1e-9) throw new Error(`the cap is reached: $${l.spent.toFixed(2)} of $${cap.toFixed(2)} spent`);
    l.spent = Math.round((l.spent + cost) * 100) / 100;
    const c = body.imageGenerationConfig || {};
    l.calls.push({ at: new Date().toISOString(), cost, width: c.width || null, height: c.height || null, note: String(note).slice(0, 80) });
    writeFileSync(file, JSON.stringify(l, null, 1));
    return paint(body);
  };
  fn.spent = () => read().spent;
  return fn;
}
