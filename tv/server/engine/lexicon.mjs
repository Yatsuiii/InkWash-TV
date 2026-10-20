// Copied from inkwash/engine/lexicon.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// The few words the engine reads for meaning: what makes a fact about family, about who rules
// a place, about who has a thing, about a death; and what makes a sentence a memory.
//
// These lists stand in for what a model would extract when a fact is written (the strategy's
// "references computed at write time"). They are general English, written once, before the
// engine was run on any case. Under the preregistration they must not be edited after looking
// at held-out results; a word missing here is a finding, not a bug to patch.

// kin words, and the pronoun of whoever they name (null: either)
export const KIN = {
  brother: 'he', sister: 'she', sibling: null, siblings: null, twin: null,
  mother: 'she', father: 'he', parent: null, parents: null, mum: 'she', mom: 'she', dad: 'he',
  son: 'he', daughter: 'she', child: null, children: null,
  cousin: null, aunt: 'she', uncle: 'he', niece: 'she', nephew: 'he',
  husband: 'he', wife: 'she', spouse: null, grandmother: 'she', grandfather: 'he', grandson: 'he', granddaughter: 'she',
  kin: null, kinsman: 'he', kinswoman: 'she', family: null,
};
// the kin a "brother" or "sister" could be: siblings first
export const SIBLING_WORDS = new Set(['brother', 'sister', 'sibling', 'siblings', 'twin']);

// ruling a place or leading a group
export const RULE = new Set([
  'rule', 'rules', 'ruled', 'ruling', 'ruler', 'rulers', 'reign', 'reigns', 'reigned', 'govern', 'governs', 'governed',
  'governor', 'lord', 'lady', 'lordship', 'ladyship', 'sovereign', 'monarch', 'king', 'queen', 'prince',
  'princess', 'duke', 'duchess', 'earl', 'countess', 'baron', 'baroness', 'chief', 'chieftain', 'regent', 'steward',
  'overlord', 'throne', 'enthroned', 'crowned', 'presides', 'mayor', 'commands',
]);

// titles for whoever is in charge of a place, as in "the lord of Salt Reach". Any other
// "the <noun> of <place>" still counts, weakly (resolve.mjs).
//
// Written knowing that the held-out bank calls rulers "master" and "mistress" (the same author
// wrote it), so those two are left out on purpose. The held result for titles therefore tests
// the weak path for them. A blind bank is the real test.
export const TITLE = new Set([
  'lord', 'lady', 'ruler', 'king', 'queen', 'prince', 'princess', 'duke', 'duchess', 'earl', 'count', 'countess',
  'baron', 'baroness', 'governor', 'mayor', 'chief', 'chieftain', 'steward', 'regent', 'sovereign', 'laird', 'thane',
  'margrave', 'archon', 'provost', 'reeve', 'sheriff', 'magistrate', 'elder', 'headman', 'overlord', 'monarch',
]);

// having a thing
export const POSSESS = new Set([
  'carries', 'carried', 'carry', 'has', 'have', 'had', 'holds', 'held', 'owns', 'owned', 'keeps', 'kept',
  'bears', 'bore', 'wields', 'wielded', 'possesses', 'possessed', 'guards', 'guarded',
]);

// a death: the subject dies (intransitive), or "was killed" and the like
export const DEATH = new Set(['died', 'dies', 'drowned', 'perished', 'dead', 'death']);
export const DEATH_PASSIVE = new Set(['killed', 'slain', 'murdered', 'hanged', 'executed', 'poisoned', 'drowned', 'lost']);

// a sentence about the past or about someone absent: memory, mourning, report
export const MEMORY = new Set([
  'remembered', 'remember', 'remembers', 'memory', 'memories', 'recalled', 'recalls', 'thought', 'thinking', 'mourned',
  'mourns', 'missed', 'misses', 'grave', 'buried', 'ghost', 'used', 'once', 'dead', 'ground', 'late', 'dreamed', 'dreamt',
]);

export const PRONOUNS = {
  she: 'she', her: 'she', hers: 'she', herself: 'she',
  he: 'he', him: 'he', his: 'he', himself: 'he',
};
export const POSSESSIVE_PRONOUNS = new Set(['her', 'his', 'their']);
