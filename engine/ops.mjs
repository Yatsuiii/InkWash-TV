// Operations end to end: the engine compiles what the model sees, the gateway calls the model,
// and the answer is checked against what it was shown before anyone acts on it.
//
//   user action -> resolve who is in play -> working set (budgeted, with a manifest) -> prompt
//   -> model (through the gateway: route, caps, telemetry) -> structured answer -> verification
//   -> flags the author decides on
//
// A check never writes canon: its flags go to the author. What a chapter changed is the one
// answer that does (changes.mjs): only what the world allows, each change logged, each undoable.
import { check as deterministic } from './checks.mjs';
import { changesPrompt, checkChanges, changeReach, refOf, CHANGES_TEMPLATE } from './changes.mjs';

export const CHECK_TEMPLATE = 'check-v1';

// The continuity check's prompt: the passage, and the working set as numbered canon lines. The
// model may cite only those numbers.
export function checkPrompt(engine, passageId, { budget = 2000 } = {}) {
  const W = engine.world;
  const p = W.passage.get(passageId);
  const ws = engine.workingSet({ type: 'check', passage: passageId }, { budget });
  const keys = new Map(ws.facts.map((fid, i) => [`F${i + 1}`, fid]));
  const canon = ws.facts.map((fid, i) => `[F${i + 1}] ${ws.lines[i]}`).join('\n');
  const system = 'You check a passage of a novel against its canon. The canon is the author\'s; you never change it. '
    + 'Flag only what the passage states or shows that the canon rules out at this point in the story. '
    + 'Lies, rumours, memories and flashbacks are not contradictions. If you are not sure, say so.';
  const prompt = `CANON, as of chapter ${p.chapter} (each line says when it holds, if not always)\n${canon || '(none)'}\n\n`
    + `PASSAGE (chapter ${p.chapter})\n"""\n${p.text}\n"""\n\n`
    + (ws.facts.some((fid) => Array.isArray(W.fact.get(fid).knownBy)) ? 'Someone speaking of or acting on a fact before they know it is a contradiction too: a line that says who knows a fact names everyone who does.\n\n' : '')
    + 'Reply with only JSON: {"flags": [{"ref": "F3", "quote": "the words in the passage", "why": "one short sentence", "sure": true}], "unsure": false}. '
    + 'Use "ref" only from the canon above. An empty list is a good answer when nothing is wrong.';
  return { system, prompt, keys, ws };
}

// A continuity check: deterministic flags first (free), then the model's, verified.
export async function runCheck(engine, gateway, passageId, { user, worldId, budget = 2000 } = {}) {
  const W = engine.world;
  const p = W.passage.get(passageId);
  const sure = deterministic(W, p).map((f) => ({ ...f, source: 'engine' }));
  const { system, prompt, keys, ws } = checkPrompt(engine, passageId, { budget });
  const r = await gateway.run({
    op: 'check', user, world: worldId, template: CHECK_TEMPLATE, system, prompt,
    context: { lines: ws.lines, manifest: ws.manifest, worldFacts: W.fact.size },
    expect: 'json',
    check: (d) => (Array.isArray(d.flags) ? [] : ['"flags" must be a list']),
    cites: (d) => d.flags.map((f) => f.ref),
    allowed: new Set(keys.keys()),
    drop: (d, bad) => ({ ...d, flags: d.flags.filter((f) => !bad.has(f.ref)) }),
    unsure: (d) => d.unsure === true || d.flags.some((f) => f.sure === false),
  });
  const model = (r.data?.flags || []).map((f) => ({ kind: 'model', fact: keys.get(f.ref), quote: f.quote, why: f.why, sure: f.sure !== false, source: 'model' }));
  // one flag per fact: the engine's, when both found it
  const seen = new Set(sure.map((f) => f.fact));
  return {
    flags: [...sure, ...model.filter((f) => !seen.has(f.fact))],
    ok: r.ok, unsure: !!r.unsure, costUsd: r.costUsd, attempts: r.attempts.length,
    manifest: ws.manifest,
  };
}

// What a chapter changed: the model's answer, checked against the world, and what the changes
// reach. Keeping them is `applyChanges` (changes.mjs), with the log this returns them for.
export async function runChanges(engine, gateway, chapter, { user, worldId, budget = 2500 } = {}) {
  const W = engine.world;
  const { system, prompt, keys, ws, text } = changesPrompt(engine, chapter, { budget });
  const none = { new: [], ended: [], learned: [], dropped: [] };
  if (!text.trim()) return { ok: true, changes: none, reaches: [], costUsd: 0, attempts: 0, manifest: ws.manifest };
  const list = (d, k) => (d[k] == null || Array.isArray(d[k]) ? [] : [`"${k}" must be a list`]);
  const r = await gateway.run({
    op: 'changes', user, world: worldId, template: CHANGES_TEMPLATE, system, prompt,
    context: { lines: ws.lines, manifest: ws.manifest, worldFacts: W.fact.size },
    expect: 'json',
    check: (d) => [...list(d, 'new'), ...list(d, 'ended'), ...list(d, 'learned')],
    cites: (d) => [...(d.ended || []), ...(d.learned || [])].map(refOf),
    allowed: new Set(keys.keys()),
    drop: (d, bad) => ({ ...d, ...(d.ended ? { ended: d.ended.filter((x) => !bad.has(refOf(x))) } : {}), ...(d.learned ? { learned: d.learned.filter((x) => !bad.has(refOf(x))) } : {}) }),
  });
  const changes = r.data ? checkChanges(engine, chapter, r.data, { keys, text }) : none;
  return { ok: r.ok, changes, reaches: changeReach(engine, changes, chapter), costUsd: r.costUsd, attempts: r.attempts.length, manifest: ws.manifest };
}
