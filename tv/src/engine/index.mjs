// Copied from inkwash/engine/index.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// Engine v1: the world-state engine around an interchangeable model.
//
//   const engine = createEngine({ chapters, entities, facts, passages });
//   engine.workingSet({ type: 'check', passage: 'p12' }, { budget: 2000 })
//   engine.impact({ fact: 'f9', after: 'Mara is no longer a member of the Order.' })
//
// The model never sees the world, only what `workingSet` compiles for one operation, with a
// manifest saying why each fact is there and what the budget left out.
import { buildWorld } from './world.mjs';
import { compile, WEIGHTS, lineOf, tokensOf } from './compile.mjs';
import { impact, IMPACT } from './impact.mjs';
import { resolve } from './resolve.mjs';

export { WEIGHTS, IMPACT, lineOf, tokensOf };

export function createEngine(data, { weights = WEIGHTS, impactWeights = IMPACT, offerAll = false } = {}) {
  const W = buildWorld(data);
  return {
    world: W,
    resolve: (text, ctx) => resolve(W, text, ctx),
    workingSet: (op, opts = {}) => compile(W, op, { weights, ...opts }),
    impact: (edit, opts = {}) => impact(W, edit, { weights: impactWeights, offerAll, ...opts }),
    line: (fid) => lineOf(W, fid),
  };
}

// For the eval: the engine as its system B5. The eval's operations are the engine's.
export function evalSystem(world, opts = {}) {
  const E = createEngine(world, opts);
  return {
    name: 'B5 engine',
    timed: true,
    build(op) {
      if (op.type === 'impact') {
        const r = E.impact(op.add ? { add: op.add } : { fact: op.fact, after: op.after, ...('from' in op ? { from: op.from } : {}), ...('to' in op ? { to: op.to } : {}) });
        return { facts: r.facts, passages: r.passages };
      }
      return { facts: E.workingSet(op).facts };
    },
  };
}
