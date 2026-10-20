# Inkwash engine v1

A world-state engine around an interchangeable model.
- **It keeps the bookkeeping:** who is who, what is true when, what each passage relied on.
- **It hands a model only what one operation needs,** with a manifest of why.
- **It works out without a model** what an edit breaks, and the contradictions that story time
  alone can catch.

No dependencies. The model SDKs are imported only when a model is first called.

```js
import { createEngine } from './index.mjs';

const engine = createEngine({ chapters, entities, facts, passages });

engine.workingSet({ type: 'check', passage: 'p12' }, { budget: 2000 });
// { facts, lines, manifest: { entities: [{ name, how: ['relation'] }], unsure, cut: { dropped, nextDropped } } }

engine.impact({ fact: 'f9', after: 'Tomas Vell rules Salt Reach.', to: 30 });
// { facts: [the next reign], passages: [the passages past chapter 30 that name him as ruler] }
```

The data is the studio's: entities (with aliases and pronouns), facts with story time (`from`,
`to`, `secretUntil`, in chapter ordinals) and, if the author says, who in the story knows them
(`knownBy: [{ who, from }]`), and passages with a cast and a ledger of the facts they relied on.

## What it does

| | File | What |
| --- | --- | --- |
| Names | `names.mjs` | **Full names** match in any case. **Aliases, first names and surnames** match only as written ("the Hand" is a faction; "his left hand" isn't). The **longest name** wins. An **ambiguous name** keeps every candidate. |
| The world model | `world.mjs` | Worked out once, when facts and passages are written. **For each fact:** what it names. **Family:** from facts with a kin word, and more weakly from surnames. **Who holds what over time:** reigns and possessions as runs of terms, found by a word or by story time alone (one term ending as the next begins). **Deaths.** **Each passage:** who it is about and how it names them. |
| Resolving | `resolve.mjs` | **Pronouns**, by salience. **Relations** ("Alaed's brother", "her sister"): the right kin. **Titles** ("the lord of Salt Reach"): whoever rules it *in that chapter*. **Unsure resolutions** are reported, not hidden. |
| Working sets | `compile.mjs` | From an operation (check, draft, question, a chapter's changes) to ranked facts, cut to a budget. **Ranked by:** who is in play and how; facts tying two things in play together; the laws of places in play; who holds what then; shared words (BM25); the ledger; story time. Drafts put what isn't true *then* last. **Secrets in drafts:** a secret stays out until its reveal chapter, because a model told a secret and asked to keep it hints at it. In its place go the author's **hints** for it (a habit, a tell, a limit), and the check still sees the secret. **Point of view:** a draft told through someone's eyes (`pov`) leaves out what they don't know yet. A fact that says who knows it says so on its line. **The manifest** says why each fact is in, what was kept back, and what the budget cut. |
| Change impact | `impact.mjs` | **Facts that depend on an edit:** the same things together, or the neighbouring term when a term's bounds move. **Passages:** those the ledger ties to it; those naming its holder by title; those recalling it in its words. When story time moves, only those on the wrong side of the new bound. **A new death** reaches the dead one's holdings and every later passage they are in. |
| Checks | `checks.mjs` | Contradictions bookkeeping can catch: the dead acting (not remembered), an event recalled before it happens, a secret out before its chapter, a former ruler acting as ruler, **someone acting on what they don't know yet** (a sentence led by them, with the fact's other people and its words; "had no idea" is not). The sentence is taken to be about whoever it names first, so a line someone speaks that names another person first is missed; the model's check, told who knows each fact, reads dialogue. Everything else is the model's. |
| What a chapter changed | `changes.mjs` | A model reads a chapter and says what it changed: **new facts**, true from that chapter, and **facts that end**, true through it. **Checked against the world:** the chapter's own words must show it; a new fact's subject is in the chapter, or new and named in it; what the canon already says (secrets included) isn't new; an ended fact was true when the chapter began, and isn't a death, a dated event, a fact whose end the author set, or a secret before its reveal. **Who learned what:** a fact that says who knows it gains someone in the chapter, from that chapter, unless they know it already or the author has them learn it elsewhere. **Kept** with a log entry per change; **undo** refuses a change edited since. **What it reaches:** later passages that relied on what ended (`impact.mjs`). |
| Operations | `ops.mjs` | A continuity check end to end: the engine's flags, then the model's on the compiled working set. A flag citing anything the model wasn't shown is dropped. A check never writes canon. What a chapter changed (`runChanges`) is the one answer that does, and only what the world allows, each change logged and undoable. |
| The gateway | `gateway/` | **Routes:** cheap first, escalating on a failed or unsure answer. **Caps:** worst-case cost checked before each call; a route with no known price isn't run while caps are set. **Telemetry:** one row per call with tokens, cache, time, cost from `prices.json` (dated, with sources), world and working-set size, outcome and escalation. No prompt or reply text, and ids hashed. **Redaction** runs on what leaves. **Providers:** the Claude API and Claude in Amazon Bedrock (Anthropic SDK); OpenAI-compatible endpoints for other models; a stand-in for tests. |
| The studio's worlds | `adapters/studio.mjs` | A studio backup in the engine's shape: chapters in order, cast from each scene's threads, the ledger, scene and chapter notes. Pronouns are guessed from a character's own facts and marked as guesses. |
| Personal stories | `personal/` | So the same theme doesn't give everyone the same story. **The feeling line** (`arc.mjs`): the person marks how each part of their dream felt, lighter or heavier, as their painting comes back stroke by stroke. From it come where the feeling turned, the dream's shape, and the parts of the telling, cut where *their* feeling changed. **Written part by part:** one line each, with its marks and how it should feel, and anything they named. **Checked:** a reader who doesn't know the line rates each written line; a telling that doesn't rise and fall with it, turn where they turned and end where they ended is rewritten once. **Voiced:** slower and softer where it was heavier (Polly SSML). **Around it:** what everyone's tellings use (a commons of counts, salted hashes until an image is common) and the person's own history (kept on their device). The earlier way (one feeling word, angles from a bank, three candidates, the best chosen) is kept for comparison. |
| Dream worlds | `dreams/` | A person's dream world, kept on their TV and run on this engine: nights are chapters, the people, places and things in their dreams are entities, what happened is canon with story time, and open threads stay open until a later night closes them. **Around it:** how each thing felt to them every time it came (their own marks, heavier or lighter and calm or stirred) and why; recognising a thing when it comes back, from their words or a mark shaped and placed like before; the engine's working set for tonight; taking in a night's additions only as far as they kept them ("that's it" or "not quite"); and what their reactions teach. **For tonight's telling** (`dreams/brief.mjs`): their words and their world's things given to the parts of the telling they belong to, their world written out for the writer, and the checks after (was it made from what they said; does it call what they named by their name; what to change if not). **Learning them** (`dreams/gesture.mjs`, `taste.mjs`, `ground.mjs`): how tonight was painted, read against a running picture of how they usually paint (the wait before a stroke, pressure, a brush held until it pooled, a mark washed out and painted again); their taste, a Bayesian model of which kinds of line they keep, learned from every line they answer; and each telling held to their evidence: a line must come from their words, their answers, a thing of theirs or how they painted, and the line or its alternative is chosen by their taste. **Feelings from the brush** (`dreams/affect.mjs`): a model each person teaches by marking the dial. Every marked stroke pairs how it was painted (pace, pressure and its shake, the wait before it, holding still, a wavering line, rising or falling, height, size, ink, painted again; against their usual hand) and what they said as they painted it with how it felt; Bayesian linear regression per dial dimension, starting from what lines are known to express, reads a painting they didn't mark, with how sure. Each marked night it reads blind first and is scored, so its learning is measured. **What happens next** (`newEnding`): after a dream is told, they may paint more of it, or a different ending; the night keeps both the dream as it came and what they painted next, what that brings is kept as of that night (apart from how things came in their dreams, though its marks are recognised later), and the threads it settles close. The guide's brief carries the last of them, and the evidence check counts the lines they already kept tonight as theirs. **Previously in their world** (`recap`, `recapped`): when they come back on a later day, the last night's story is offered again as it was last told, never twice in an evening; each time it is heard is kept with the night. **A long memory** (`dreams/tools.mjs`): a world holds its last 120 nights, and every thing, feeling and fact from all of them; the TV keeps every night apart, and the guide's tools (`recall`, `thingDetail`, `nightDetail`) read the older nights there (`older`), so the guide can still read night 1's story in year three. Where room is short, the TV lets more of them go from the world once they are kept apart (`trimNights`). The brief carries at most eight open threads (those about what is in tonight's painting, then the latest) and says how many more `recall` finds; `recall` returns the unresolved threads it finds. **What is never heard** (`dreams/gentle.mjs`): a child's telling is held, line by line, to nothing frightening they never brought, nothing they marked darker made bigger or closer, and no figure of speech; a dream told with what they painted next must tell it, end on it, and not slide back. `withhold` is the guarantee: past its send-backs, a telling is told without those lines, and one that never tells what they painted next ends in their own words for it. `dreams/sim.mjs` tests the learning on simulated dreamers and painters, with no model calls. |
| Word lists | `lexicon.mjs` | Kin, rule, title, possession, death and memory words. A stand-in for what a model would extract when a fact is written. Not edited after looking at held-out results. |

## How well it does

Measured on synthetic worlds with known answers, against tuned simple retrieval and the
harness it replaced, with no model calls, to a plan written before the engine existed. The eval
and its worlds are kept out of this repository so that the held-out ones stay unseen.

## What it doesn't do yet

- **Read prose for meaning.**
  - It doesn't know "swam out to the wreck" contradicts "cannot swim". That is the model's job,
    on the working set.
  - Nor does it know that a passage relied on a trait it never names, unless the ledger says
    so.
- **Extract relations from facts.**
  - Relation types come from small word lists. They're brittle: a ruler written as "Salt Reach
    answers to Oren" is found only if the reign has more than one term.
  - What a chapter changed is read by a model now (`changes.mjs`), but a fact's relation type
    still comes from the word lists. How often a real model gets a chapter's changes right
    hasn't been measured: the tests use a stand-in.
- **Own the canon.** The writing studio it was built for (not in this repository) still does. `applyChanges` returns new data and a log;
  the caller keeps them.
- **Run against a live model.** The providers are written to the SDKs' documented shapes and
  tested with stand-ins. No paid call has been made.

## Tests

```sh
node --test engine/test.mjs            # the engine, the checks, the gateway, a check and a chapter's changes end to end
node --test engine/personal/test.mjs   # the feeling line, marks, motifs, commons, history, angles, choosing
node --test engine/dreams/test.mjs     # a dream world over several nights
node engine/dreams/sim.mjs            # does the taste model learn simulated dreamers?
node engine/dreams/sim.mjs feelings 300 8 0.4   # does the brush model learn simulated painters?
```
