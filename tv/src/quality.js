// Keeps the ink smooth on a slow TV. The wet paper is the costly part of every frame, so while the
// ink is wet this watches how long frames take; when they run long for a while, it asks the paper
// for fewer wet steps a second (the ink spreads a little more slowly, and the brush stays smooth);
// when frames are quick again for longer, it gives them back. A stall (a hidden page, a screenshot)
// says nothing about the TV and is ignored.
//
// "Long" is judged against the TV's own pace: dry frames (nothing to simulate) set how quick a
// frame can be here, so a TV that shows 50 or 25 frames a second isn't taken for a slow one. Each
// time a level proves too slow, it waits twice as long before trying the better level again, so a
// TV on the edge doesn't stutter every few seconds. Pure.
//
// `levels`: the share of wet steps at each level, best first. `slow`/`fast`: frame times, in
// seconds, that count as too slow or quick enough; `settle`/`recover`: how many seconds of either
// before the level changes.
export function createGovernor({ levels = [1, 0.66, 0.44], slow = 1 / 40, fast = 1 / 55, settle = 1.5, recover = 6 } = {}) {
  let level = 0, avg = null, base = null, slowFor = 0, fastFor = 0, strikes = 0;
  return {
    get level() { return level; },
    get scale() { return levels[level]; },
    // one frame of `dt` seconds, with the ink `wet` or not: the new share of wet steps when the
    // level changes, else null
    frame(dt, wet = true) {
      if (!(dt > 0) || dt > 0.5) return null;
      if (!wet) { base = base == null ? dt : base * 0.95 + dt * 0.05; return null; }
      avg = avg == null ? dt : avg * 0.9 + dt * 0.1;
      const tooSlow = Math.max(slow, (base || 0) * 1.35), quick = Math.max(fast, (base || 0) * 1.1);
      if (avg > tooSlow) { slowFor += dt; fastFor = 0; } else if (avg < quick) { fastFor += dt; slowFor = 0; } else { slowFor = 0; fastFor = 0; }
      if (slowFor >= settle && level < levels.length - 1) {
        level++; strikes = Math.min(4, strikes + 1); slowFor = 0; avg = null;
        return levels[level];
      }
      if (fastFor >= recover * 2 ** Math.max(0, strikes - 1) && level > 0) {
        level--; fastFor = 0; avg = null;
        return levels[level];
      }
      return null;
    },
  };
}
