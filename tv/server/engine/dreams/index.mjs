// Copied from inkwash/engine/dreams/index.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// Dreams: a person's dream world, kept on their TV and run on the engine. What their dreams have
// held night after night, how each thing felt to them, why, what is unresolved, and what their
// reactions have taught.
export { createDreamWorld, checkDiff, KINDS, KEEP } from './world.mjs';
export { planForget, applyForget, scrubNight, keysOf } from './forget.mjs';
export { AFFECTS, affectName, weightWord, stirWord, describe, WHY, whySays, feltOver } from './emotion.mjs';
export { preferences, lineTraits, knownLesson } from './learn.mjs';
export { attachTonight, worldBrief, wordsBrief, keyWords, wordsUsed, retellNote, needsRetelling, tellingScore } from './brief.mjs';
export { agentBrief, recall, thingDetail, nightDetail, memoryOf, tokensOf, OPEN, MEMORY } from './tools.mjs';
export { readHand, learnHand, emptyHand, GESTURE_CUES } from './gesture.mjs';
export { TRAITS, PRIOR, SAYS, traitsOf, keyTerms, fitTaste, emptyTaste, keepChance, tasteNotes } from './taste.mjs';
export { checkGrounded, composeTelling, paintingIn, firstPersonIn, toSecondPerson, heldAgainst } from './ground.mjs';
export { checkGentle, checkEnding, frightIn, withhold } from './gentle.mjs';
export { wonderBrief, checkWonder, WONDER } from './wonder.mjs';
export { illustrateBrief, checkIllustration, whereOn, ILLUSTRATE } from './illustrate.mjs';
export { checkScene, sceneBrief, toneOf as sceneTone, lightness, SHAPES, GROUND_KINDS, AIR_KINDS, LIGHT_KINDS, STYLES as SCENE_STYLES } from './scene.mjs';
export { BRUSH, SAID, FEATURES, AFFECT_PRIOR, strokeFeatures, fitAffect, readFeelings, lessonsOf, scoreReading, affectNotes } from './affect.mjs';
