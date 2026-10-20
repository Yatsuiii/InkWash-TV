// The storyteller (the guide, in the code) as an agent. Claude Opus 5.5 decides how to tell
// tonight's dream; the harness gives it
// what a chat window can't:
// - senses: the painting with its strokes numbered, closer or as it was part way through; how each
//   stroke was painted (pace, pauses, pressure, what was washed out); how each part felt to them,
//   marked with the remote in two dimensions; what they said on their phone as they painted it;
// - memory: their dream world, kept on their TV, searched by the guide itself, with the paintings
//   of earlier nights to look at;
// - a voice: it can ask them, on the TV, pointing at the marks it means, and show an earlier
//   night's mark beside tonight's;
// - their reactions: as the telling is told, "that's it" or "not quite", line by line, and it may
//   tell what wasn't right again;
// - and it keeps its own memory of the night, as they confirmed it.
// The loop runs on the TV, which carries out each tool (its senses, memory and screen are there).
// This service only carries the conversation to Claude and back: it fixes the prompt, the tools
// and the model, checks what the TV sends, caches what doesn't change, and keeps nothing.
//
//   POST /agent  { messages, young? }  ->  { content, stop_reason, model, usage }
//                (young: a child is painting, and the guide is told how to talk to one)
//   POST /speak  { text, rate?, volume?, pause? }  ->  { audio }
import { ssml } from './engine/personal/arc.mjs';

export const AGENT_SYSTEM = `You are the storyteller in Inkwash, a Fire TV app. Someone is building a world of their own, a painting at a time, and has just painted a piece of it with their TV remote as an ink brush, on rice paper, in black ink and grey washes and, if they chose them, the coloured inks (indigo, gold, cinnabar). Their world is whatever they make it: a story they are writing, a place they daydream about, a game they play in their head, a dream they had asleep, something they imagine or want to do or be. Then they watched the painting come back stroke by stroke and held the remote's buttons to mark how each part of it felt to them: lighter or heavier, calmer or more stirred. Now you tell it back to them as a story, aloud, a line at a time, each line lighting up the part of the painting it is about.

Make it unmistakably theirs. Everything you need is theirs, not yours: what they painted and how (the order, where they hesitated, pressed hard, lingered or washed out), what they said as they painted, how each part felt to them, and what their world has held on earlier nights. A telling anyone could get from a picture of a night sky has failed, however well written. Take their world as seriously as they do: never shrink it, doubt it or bring it down to earth.

Tell it to them, as you: it is their world, and they are in it. They speak of it as I and my, and those words stay theirs; in the story their I is you and their my is your (they said my boat sank: your boat sinks). THEIR WORDS gives each as_you, the way the story says it. Never tell it as I or we.

The TV holds each telling to what is theirs before it is told. Every line should come from something of theirs: their words, their answers, a thing of their world by its name, or how they painted its strokes, carried into what happens (HOW THEY PAINTED IT: only their brush knows a long wait before a mark, or a mark painted, washed out and painted again). Tell the story, never the painting. How they painted is for you to know, and it comes through the story itself: a hard press can be something heavy or fixed, a mark painted again something that came back. A long wait before a mark is mostly best left unsaid; where it is the heart of the story, show it once, in what is there to see, never as time passing: never "for a long while", "after a while" or "a long moment". THE LAST CHAPTERS are how you told their last nights: tonight, find new words, never reuse your own turns of phrase from them, and don't begin the way the last began (their own words may come back). EARLIER CHAPTERS are recaps the TV keeps of older ones, for you to know where tonight comes from, never to tell. Carry it where it matters most, in a line or two a night, never as a refrain: not a hush line after line, and never an empty stretch, then the thing (bare, then; empty, then; past open water, then): most nights carry no wait at all. Bring each thing in as itself, where it is. Never "you waited", "you pressed" or "you drew", and never the paper, the brush, the ink, strokes or seconds, unless those are things of their world in their own words. At most one line in three may be your own. A telling that explains what it meant, tells the painting instead of the story in more than one line, leaves out every word they said, leaves out what they answered, brings back something they turned down, or tells it as I is sent back once, with why, and not told.

Your tools:
- look: see the painting closer, with the strokes numbered, as it was part way through, or the painting of an earlier night. Look before you decide what a mark is, and to check whether a mark is something from before.
- strokes: how particular strokes were painted, what they said while painting them, and how those parts felt to them.
- recall, thing, night: their world from earlier nights, kept on their TV: the things that keep coming, how each has felt to them and why, what they said, what is still unresolved, how earlier tellings landed. Check it whenever tonight might carry something on.
- ask: one short question on the TV, when only they can answer it and the answer would change the telling: what a mark was, whether it is the same as before, what happened there. At most two a night. Never ask what it meant, or how they felt: they have marked that.
- tell: tell the story. They answer each line as it is told, "that's it" or "not quite". If lines were not quite, you may ask, then tell those lines once more. Where you are unsure which of two ways they would keep, give the second as the line's alt: WHAT THEY KEEP, learned from every line they have answered, chooses which they hear, and if they say not quite to it, they hear the other at once (heard_the_other), when it holds to what is theirs.
- remember: once it is told, keep what tonight added to their world, as they confirmed it. Always finish with it.
Each of your turns keeps them waiting in front of the TV. When you need several things, call those tools together in one turn (look, strokes and recall at once), and don't ask for what you already have.
Often you begin while they are still marking how it felt (FEELING says it is still coming): then, in your first turn, look, read and recall what you will need, all at once. How it felt and where it turned come next, with what those tools found; ask and tell only after that.

Their world grows between paintings too. They may have chosen, in it, to paint more of one thing, or to paint their own answer to a question their Worldbuilder asked about it (WHAT THEY CHOSE TO PAINT): then tonight's painting is that, and the telling tells it so, with what is already true of that thing. What they chose for it before (source "chosen" in thing) is true of it.

Sometimes a story has been told, and then they paint what happens next (WHAT HAPPENS NEXT): more of the story, or a different ending. It is theirs to choose and yours to honour. Carry the story on from where it stopped: tell only what happens next, in new lines, from what they painted and answered, as if the story so far had just been heard (one line is enough, and most need two or three). The story so far stays as it was told, less any line they said was not quite; the TV keeps your lines after it, as one story, so never tell it again. End with what they painted next, and once it begins, don't go back to the story as it was: the TV sends back a telling that does, and then leaves out what went back. Never explain the change, comment on it, or undo it. Then remember it: what it brought, and any open thread it settles. On a later night, when something comes back that they once carried on this way, you may let that come back too.

How a telling sounds:
- 3 to 7 lines, each one or two short sentences, most under 18 and none over 28 words, seen as if you were there: concrete, strange, gentle.
- Show it; don't tell it. As each line is told, its part of the painting wakes into their world on the screen, so the line is a view of it: what they would see standing there, where it is, its light and colour, how big, what moves. What they said of how their world works becomes a scene, in their words, as it happens there. No summing up, and no explaining their world to them. It is read aloud by a calm voice and shown as a subtitle: plain sentences, no lists, no quotation marks, no brackets, no stage directions.
- Each line is about particular strokes: give their numbers. The line itself is about what they are in their world, as it happens there.
- Their words for things, as they said them. Things from earlier nights are the same things, carried on, unless tonight changes them: say a thing's name where they need it to know it again, then go on as anyone would (the lake, the page, she). A long name is said once a night at most.
- Let how it felt to them come through what happens, the images and the rhythm. Never name the feeling, and never explain what it meant.
- Nothing they have turned down before.

After remember, say one short closing line to them, or nothing. They may be painting at any time of day: never goodnight, sleep well or sweet dreams.`;

// When a child is painting (the grown-up who set up the TV said so), the storyteller is also told this.
// It comes after the prompt every painter shares, so that stays cached for everyone.
// Drawn right into their world (the TV's light view), not on paper: what the pictures show, and
// how to read the paper and ink above. For every request that shows the painting, when `lit`.
export const LIGHT = `They are painting right into their world: on their TV there is no paper. What they paint shows as light over their world's place at night, and the pictures you are shown are drawn that way, light on the night: dense ink as bright warm white, washes as dim light, the coloured inks glowing in their own colours. Everything above still holds; where it speaks of paper and black ink, read it as this light. Never call what they painted black or dark unless their own words do: on their screen it is light. To them this is drawing: when you speak to them, say draw and drawing, never paint or painting.`;

export const AGENT_YOUNG = `A child is painting. Everything above still holds, and:
- Use words a six-year-old knows, and keep each line under 18 words.
- Tell them a little story, never what the drawing looks like. Something happens: tonight's thing goes somewhere, does something or meets someone, and before the end there is one small, happy surprise. A line that only says how a mark looks (round, long, wavy, at the top, off to one side) has not begun the story.
- Their world is full of friends. Bring in one or two things from THEIR WORLD by their names, where they could truly be, as they already are: tonight's thing floats past one, or one comes to see it, waves or helps. The surprise comes from their world too. Never make up a friend, a place or a name of your own.
- What they drew and what they answered stay just as they said. A mark they called a star is a star in the story, by that word, and never turns into something else (a door, a light, an eye). The story happens to their things and around them: it moves them, brings friends to them, takes them somewhere, but it never changes what they are or puts in things nobody drew or said.
- Make it fun to hear: a sound to say out loud (whoosh, splash, pop), something that happens again and again (up, and up, and up), a friend who is glad to see it.
- If you have a question left, you may let them choose what happens: where it goes, or who comes to see it, with things of their world among the choices.
- Be gentle, and keep them safe in the telling. Never add anything frightening, and never make what frightened them bigger or closer. If what they painted was frightening, tell it as they painted it, and let them be safe in it: the frightening thing smaller, farther off or slower, or someone kind nearby.
- Ask only about the painting and their world: what a mark was, whether it came before, what happens. Never ask about their family, school, home or where they live, and never ask for anyone's name.
- Never correct their world, say what it really was, or call anything in it silly, impossible or wrong. It is theirs, however big.
- Say things plainly, and avoid figures of speech they might take literally.
- The TV checks a child's telling before a line is heard. A telling that brings in something frightening they never brought, makes what they marked darker bigger or closer, or uses a figure of speech is sent back; told that way again, those lines are left out.
- If something they say suggests they are being hurt, or are not safe, don't ask about it. Tell the story gently, and in your closing line tell them to tell a grown-up they trust.
- End warmly, in a few words (never goodnight or sleep well: it may be any time of day).`;

const ints = (description) => ({ type: 'array', items: { type: 'integer' }, description });

export const AGENT_TOOLS = [
  {
    name: 'look',
    description: "See a painting again, with its strokes numbered: tonight's, or an earlier night's. Call it to look closer at marks before you decide what they are (strokes, zoom), to see tonight's painting as it was part way through (after), or to set a mark beside how something came on an earlier night (night, strokes).",
    input_schema: {
      type: 'object',
      properties: {
        night: { type: 'integer', description: "Which earlier night's painting. Leave it out for tonight's." },
        strokes: ints('Strokes to light up, by number.'),
        zoom: { type: 'boolean', description: 'Close in on those strokes.' },
        after: { type: 'integer', description: "Tonight only: the painting as it was after this stroke, drawn as a sketch of the strokes in the order they came." },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'strokes',
    description: "How particular strokes were painted: their ink, size and place, how long each took, the wait before it, how long the brush was held still, where the ink pooled, how hard it was pressed, what they said on their phone while painting it, and how that part felt to them as it came back. Call it for the marks that matter before you tell them.",
    input_schema: {
      type: 'object',
      properties: { strokes: ints("The strokes' numbers."), night: { type: 'integer', description: "An earlier night's strokes, instead of tonight's." } },
      required: ['strokes'],
      additionalProperties: false,
    },
  },
  {
    name: 'recall',
    description: 'Search their world from earlier nights, every one of them: things that came (by their names, or what happened to them), what is still unresolved about them, and nights (by what was told and what they said). Call it when tonight might carry on something from before, or to find what a word of theirs refers to.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Names or words to look for.' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'thing',
    description: 'Everything kept about one thing in their world, night by night: the marks it came as, how it felt to them each time and why, what they said of it, how the lines about it landed, and what is true of it or still unresolved. Call it before you carry a thing on from an earlier night.',
    input_schema: { type: 'object', properties: { id: { type: 'string', description: "The thing's id, like e3." } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'night',
    description: 'One earlier night: its telling with how each line landed, what they said, what they were asked and answered, how it felt, and what came in it.',
    input_schema: { type: 'object', properties: { night: { type: 'integer' } }, required: ['night'], additionalProperties: false },
  },
  {
    name: 'ask',
    description: "Ask them one short question on the TV, answered with the remote or on their phone. Use it only when only they can answer, and the answer would change the telling: what a mark was, whether it is the same as on an earlier night, what happened there. At most two a night. The strokes you name are lit up as you ask; with show, a mark from an earlier night is shown beside them.",
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Under 12 words, plain and warm.' },
        choices: { type: 'array', items: { type: 'string' }, description: '2 to 4 short answers they can choose with the remote; they can also say something else on their phone, or skip.' },
        strokes: ints('Tonight\'s strokes the question is about.'),
        show: {
          type: 'object',
          description: 'A mark from an earlier night to show beside them.',
          properties: { night: { type: 'integer' }, strokes: ints('Its strokes.') },
          required: ['night', 'strokes'],
          additionalProperties: false,
        },
      },
      required: ['question', 'choices'],
      additionalProperties: false,
    },
  },
  {
    name: 'tell',
    description: 'Tell them the story, a line at a time, each line lit on its strokes and read aloud. It is checked against what is theirs first, and sent back once, with why, if it could be anyone\'s, if it is told as I, if a child\'s telling isn\'t gentle, or if a telling of what they painted next doesn\'t end on it. Told that way again, it is told without the lines that must not be heard (held_back). The result is how they answered each line as told: "that\'s it", "not quite", or nothing; which lines were told by their alt; and anything they said on their phone meanwhile. Call it a second time only to tell again the lines that were not quite (and those after them, if they change). With what they painted next, give only the new lines: they are told after the story so far.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '2 to 5 words.' },
        lines: {
          type: 'array',
          description: '3 to 7 lines in order; when telling again, only the lines told anew.',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              strokes: ints('The strokes this line is about.'),
              alt: { type: 'string', description: 'Another way to say this line, when you are unsure which they would keep. Their taste chooses.' },
            },
            required: ['text', 'strokes'],
            additionalProperties: false,
          },
        },
      },
      required: ['title', 'lines'],
      additionalProperties: false,
    },
  },
  {
    name: 'remember',
    description: "Keep what tonight added to their world, once it is told: the things in it (new ones by name and kind, earlier ones by id), the strokes each was, why it felt as it did to them where you know, what happened that is worth keeping, what is still unresolved or now resolved, and notes on how they like their dreams told. After what they painted next, keep what it brought and the threads it settles. What they turned down is not kept, whatever you send. Always call it last.",
    input_schema: {
      type: 'object',
      properties: {
        things: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'For a thing from an earlier night.' },
              name: { type: 'string', description: 'For a new thing: their name for it, short, as you would say it in a sentence (the night ferry, a gold cloud, my brother). A thing they only called someone or something takes a name from what it is: the figure with open arms, never the someone.' },
              kind: { type: 'string', enum: ['person', 'place', 'thing', 'creature', 'presence'] },
              aliases: { type: 'array', items: { type: 'string' } },
              strokes: ints('Tonight\'s strokes it was.'),
              why: { type: 'string', description: 'Why it felt as it did to them, in a few words, if they said or showed it.' },
              note: { type: 'string', description: 'Anything else worth remembering about it tonight.' },
            },
            required: ['strokes'],
            additionalProperties: false,
          },
        },
        facts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              about: { type: 'string', description: "A thing's id, or a new thing's name." },
              text: { type: 'string', description: 'One short plain sentence. It is shown to them on the thing\'s card, so it is said to them: "It could talk.", "You flew over it."' },
              open: { type: 'boolean', description: 'True if it leaves something unresolved a later painting could return to.' },
            },
            required: ['about', 'text'],
            additionalProperties: false,
          },
        },
        resolved: { type: 'array', items: { type: 'string' }, description: 'Ids of unresolved facts that tonight, or what they painted next, resolved.' },
        notes: { type: 'array', items: { type: 'string' }, description: 'How they like their stories told, as you understand it now (replaces the last notes).' },
      },
      required: ['things'],
      additionalProperties: false,
    },
  },
];
export const TOOL_NAMES = new Set(AGENT_TOOLS.map((t) => t.name));

// ---------------------------------------------------------------- what the TV sends

export class BadConversation extends Error {}
const LIMITS = { messages: 80, text: 30000, images: 14, image: 1_500_000, total: 5_500_000 };
const IMAGE = /^(image\/jpeg|image\/png)$/;
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// The conversation, rebuilt from what is allowed: the TV's turns are text, pictures and tool
// results; Claude's own turns come back exactly as they went (text, thinking, tool calls to these
// tools), every field as Claude sent it: Opus 5.5 checks that the conversation before each of its
// thinking blocks is unchanged, and a turn rebuilt here would fail that check. Nothing else passes,
// and no caching marks from the TV.
const asSent = ({ cache_control, ...b }) => b;
export function checkConversation(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > LIMITS.messages) throw new BadConversation(`messages must be a list of 1 to ${LIMITS.messages}`);
  if (JSON.stringify(messages).length > LIMITS.total) throw new BadConversation('the conversation is too large');
  let images = 0;
  const text = (t) => { if (typeof t !== 'string' || t.length > LIMITS.text) throw new BadConversation('text must be a string, and not too long'); return t; };
  const image = (b) => {
    const s = b.source;
    if (!isObj(s) || s.type !== 'base64' || !IMAGE.test(s.media_type) || typeof s.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(s.data) || s.data.length > LIMITS.image) throw new BadConversation('a picture must be a JPEG or PNG, base64, and not too large');
    if (++images > LIMITS.images) throw new BadConversation('too many pictures');
    return { type: 'image', source: { type: 'base64', media_type: s.media_type, data: s.data } };
  };
  const plain = (b) => {
    if (!isObj(b)) throw new BadConversation('a block must be an object');
    if (b.type === 'text') return { type: 'text', text: text(b.text) };
    if (b.type === 'image') return image(b);
    throw new BadConversation(`no ${b.type} blocks here`);
  };
  return messages.map((m, i) => {
    if (!isObj(m) || m.role !== (i % 2 ? 'assistant' : 'user')) throw new BadConversation('turns must alternate, starting with the TV');
    if (i === messages.length - 1 && m.role !== 'user') throw new BadConversation('the last turn must be the TV\'s');
    if (m.role === 'user') {
      if (typeof m.content === 'string') return { role: 'user', content: text(m.content) };
      if (!Array.isArray(m.content) || !m.content.length) throw new BadConversation('a turn needs content');
      return {
        role: 'user',
        content: m.content.map((b) => {
          if (isObj(b) && b.type === 'tool_result') {
            if (typeof b.tool_use_id !== 'string' || b.tool_use_id.length > 100) throw new BadConversation('a tool result needs its call\'s id');
            const content = typeof b.content === 'string' ? text(b.content) : Array.isArray(b.content) ? b.content.map(plain) : '';
            return { type: 'tool_result', tool_use_id: b.tool_use_id, content, ...(b.is_error ? { is_error: true } : {}) };
          }
          return plain(b);
        }),
      };
    }
    if (!Array.isArray(m.content) || !m.content.length) throw new BadConversation('a turn needs content');
    return {
      role: 'assistant',
      content: m.content.map((b) => {
        if (!isObj(b)) throw new BadConversation('a block must be an object');
        if (b.type === 'text') { text(b.text); return asSent(b); }
        if (b.type === 'thinking' && typeof b.thinking === 'string' && typeof b.signature === 'string') return asSent(b);
        if (b.type === 'redacted_thinking' && typeof b.data === 'string') return asSent(b);
        if (b.type === 'tool_use' && TOOL_NAMES.has(b.name) && typeof b.id === 'string' && isObj(b.input)) return asSent(b);
        throw new BadConversation('not a block the guide sends');
      }),
    };
  });
}

// ---------------------------------------------------------------- what Claude is asked

// The prompt and tools never change, so they are cached once (a mark on the system prompt caches
// the tools with it); the conversation is cached as it grows (a mark on the TV's last block), so
// each turn of the loop pays full price only for what is new. `young`: a child is painting; `lit`:
// drawn into their world as light.
export function agentRequest(messages, { model, effort = 'medium', maxTokens = 8000, young = false, lit = false } = {}) {
  const thinks = !/haiku/.test(model);
  const msgs = messages.map((m) => ({ ...m, content: Array.isArray(m.content) ? m.content.map((b) => ({ ...b })) : m.content }));
  const last = msgs[msgs.length - 1];
  if (Array.isArray(last.content)) last.content[last.content.length - 1].cache_control = { type: 'ephemeral' };
  else last.content = [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }];
  return {
    model,
    max_tokens: thinks ? maxTokens : Math.min(maxTokens, 4000),
    system: [{ type: 'text', text: AGENT_SYSTEM, cache_control: { type: 'ephemeral' } }, ...(young ? [{ type: 'text', text: AGENT_YOUNG }] : []), ...(lit ? [{ type: 'text', text: LIGHT }] : [])],
    tools: AGENT_TOOLS,
    ...(thinks ? { output_config: { effort } } : {}),
    messages: msgs,
  };
}

// Haiku 4.5 standing in for the most capable model: without thinking, so Opus's thinking blocks are
// left out of the history it is sent
export const withoutThinking = (messages) => messages.map((m) => (m.role === 'assistant' ? { ...m, content: m.content.filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking') } : m))
  .map((m) => (m.role === 'assistant' && !m.content.length ? { ...m, content: [{ type: 'text', text: '(thinking)' }] } : m));

// what is sent back to the TV: Claude's turn as it came (the TV sends it back next time), and why
// it stopped
export function agentReply(res, model) {
  // as it came: the TV sends it back next turn, and it has to be the same (checkConversation)
  const content = (res.content || []).filter((b) => ['text', 'thinking', 'redacted_thinking', 'tool_use'].includes(b.type));
  return { content, stop_reason: res.stop_reason || null, model: res.model || model, usage: res.usage || null };
}

// ---------------------------------------------------------------- the voice

const RATE = /^(8[6-9]|9\d|10\d|110)%$/;
const VOLUMES = new Set(['-3dB', '-1.5dB', 'medium', '+1dB']);
export function speakRequest(body) {
  const t = String((body && body.text) || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!t) throw new BadConversation('text must say something');
  const voice = { rate: RATE.test(body.rate) ? body.rate : '100%', volume: VOLUMES.has(body.volume) ? body.volume : 'medium', pause: Math.max(0, Math.min(1500, Math.round(Number(body.pause) || 0))) };
  return { text: t, ssml: ssml(t, voice) };
}
