// Their world painted as one (server/scenery.mjs compose): home shows each thing made real on its
// own, set into the painted place; once it has settled, the TV sends that view to be repainted as
// one picture, so the things belong in the place instead of sitting on it, and shows that instead.
// Kept with their paintings (paintings.js COMPOSED) under the sign of what it was painted from:
// the place and each thing's own picture. A new thing, a thing made again or a new look is a new
// sign, and only then is it asked for again; never twice for one sign.

// what the view was made from: the place's sign, and each thing's id and picture, in one order
export function composeSign({ place = null, things = [] } = {}) {
  if (!place) return null;
  const made = things.filter((t) => t && t.id != null && t.sign).map((t) => `${t.id}=${t.sign}`).sort();
  return made.length ? `${place}|${made.join('|')}` : null;
}

// the fewest things there are to compose before it is worth it, and how long home is to have been
// still first (seconds)
export const COMPOSE_AT = { things: 2, still: 2 };

// What to do with home now: 'use' the kept painting (it was made from just this), 'ask' for one,
// 'drop' one showing that no longer fits, or nothing. `painted`: the place is painted; `made`: how
// many things stand there as their own pictures; `making`: whether one is still being made;
// `kept`: the sign of the one kept; `shown`: the sign of the one on screen; `asked`: signs already
// asked for in this sitting.
export function composeDue({ sign = null, painted = false, made = 0, making = false, kept = null, shown = null, asked = new Set() } = {}) {
  if (shown && shown !== sign) return 'drop';
  if (!sign || !painted || made < COMPOSE_AT.things || shown === sign) return null;
  if (kept === sign) return 'use';
  if (making || asked.has(sign)) return null;
  return 'ask';
}
