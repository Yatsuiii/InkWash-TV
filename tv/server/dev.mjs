// The guide service on this computer, for trying the TV page against it:
//
//   node server/dev.mjs            Claude on Amazon Bedrock and Amazon Polly, with your AWS
//                                  credentials (AWS_REGION, and a profile or keys, as for the
//                                  AWS CLI); with GUIDE_ANTHROPIC_KEY, Claude through
//                                  Anthropic's API, and with GUIDE_GEMINI_KEY, pictures by Gemini
//   node server/dev.mjs --stand-in no AWS: a stand-in that answers in the right shape
//   node server/dev.mjs --cli       no AWS: Claude through Claude Code (claude -p), on the Claude
//                                  subscription it is signed in with (claude-cli.mjs); no voice,
//                                  and no pictures made real
//
// Then open the TV page with ?guide=http://localhost:5188. A phone on the same network can pair
// with it if the TV page was opened with this computer's address rather than localhost.
import { createServer } from 'node:http';
import { createHandler } from './lambda.mjs';
import { ARC_SYSTEM, READ_SYSTEM, READINGS_SYSTEM, EXTRACT_SYSTEM } from './guide.mjs';
import { AGENT_SYSTEM } from './agent.mjs';
import { standInAgent } from './agent-standin.mjs';
import { WONDER_SYSTEM, standInWonder } from './worldbuilder.mjs';
import { ILLUSTRATE_SYSTEM, standInIllustrator } from './illustrator.mjs';
import { SCENE_SYSTEM, standInScene } from './scenery.mjs';
import { memoryBudget } from './budget.mjs';
import { standInReel } from './reel.mjs';
import { standInMarble } from './marble.mjs';
import { readFileSync } from 'node:fs';
import { memorySessions } from './phone.mjs';
import { memoryCommons } from './commons-store.mjs';
import { createClaudeCli } from './claude-cli.mjs';

const PORT = Number(process.env.PORT) || 5188;
// the stand-in's clip (it comes alive): a small WebM of moving light, as a data URL
export const STANDIN_CLIP = `data:video/webm;base64,${readFileSync(new URL('./standin-clip.webm', import.meta.url)).toString('base64')}`;
const standIn = process.argv.includes('--stand-in');
const cli = process.argv.includes('--cli');

// The stand-in writer tells each part back plainly: how it should feel, what they named, what they
// said, and what from their world it looks like. The reader reads those words back; the archivist
// keeps what they named and said.
export function standInAnswer(params) {
  const asked = typeof params.messages[0].content === 'string' ? params.messages[0].content : params.messages[0].content.find((c) => c.type === 'text')?.text || '';
  // a prompt that shows the painting may have more after it (drawn as light: agent.mjs LIGHT)
  const is = (system) => String(params.system).startsWith(system);
  if (is(ARC_SYSTEM)) {
    const parts = [...asked.matchAll(/^(\d+)\. (?:Marks? [^(]+|The whole painting) \(box [^)]*\): ([^.]+)\.(.*)$/gm)];
    return {
      title: 'A stand-in dream',
      lines: parts.map(([, k, how, rest]) => {
        const named = /They said this was ([^.]+?)(?:, from their earlier dreams)?\./.exec(rest);
        const heard = /As they painted these marks, they said: (.+?)\. Build this line/.exec(rest);
        const known = /is shaped and placed like (.+?), from/.exec(rest);
        return [`Part ${k}: ${how.trim()}`, named && `and ${named[1]}`, heard && `as you said, ${heard[1].replace(/"/g, '')}`, known && !named && `and ${known[1]} again`].filter(Boolean).join(', ') + '.';
      }),
    };
  }
  if (is(READ_SYSTEM)) {
    const ls = asked.split('\n');
    return {
      weight: ls.map((l) => (/very heavy/.test(l) ? -2 : /heavier/.test(l) ? -1 : /very light/.test(l) ? 2 : /lighter/.test(l) ? 1 : 0)),
      stir: ls.map((l) => (/very stirred/.test(l) ? 2 : /stirred/.test(l) ? 1 : /very still/.test(l) ? -2 : /calm/.test(l) ? -1 : 0)),
    };
  }
  if (is(READINGS_SYSTEM)) return { readings: ['a stand-in reading', 'another', 'a third'] };
  if (is(EXTRACT_SYSTEM)) {
    const lines = [...asked.matchAll(/^(\d+)\. (.*)$/gm)].map(([, k, t]) => ({ k: Number(k), t }));
    const known = [...asked.matchAll(/^(e\d+): (.+) \((\w+)\)$/gm)].map(([, id, name]) => ({ id, name }));
    const entities = [], seen = new Set();
    for (const { k, t } of lines) {
      for (const e of known) if (t.toLowerCase().includes(e.name.toLowerCase().replace(/^(the|a|my) /, '')) && !seen.has(e.id)) { seen.add(e.id); entities.push({ id: e.id, lines: [k] }); }
      const m = /, and ((?:the|a|an|my) [a-z ]+?)(?: again)?(?:,|\.)/.exec(t);
      if (m && !known.some((e) => e.name === m[1]) && !seen.has(m[1])) { seen.add(m[1]); entities.push({ new: m[1], kind: 'thing', lines: [k] }); }
    }
    return { entities, facts: [], resolved: [], conflicts: [] };
  }
  return { say: 'This is the stand-in guide. With AWS credentials, the real one looks at your painting.' };
}

const fake = {
  claude: {
    messages: {
      async create(params) {
        // the guide's agent is a script here; every other question gets a stand-in answer
        if (Array.isArray(params.system) && params.system[0].text === AGENT_SYSTEM) return standInAgent(params);
        if (String(params.system).startsWith(WONDER_SYSTEM)) return standInWonder(params);
        if (String(params.system).startsWith(ILLUSTRATE_SYSTEM)) return standInIllustrator(params);
        if (String(params.system).startsWith(SCENE_SYSTEM)) return standInScene(params);
        return { content: [{ type: 'text', text: JSON.stringify(standInAnswer(params)) }] };
      },
    },
  },
  speak: async () => null,
  // no pictures without AWS: a told painting wakes up in its world's place as the TV draws it (or at
  // night, until it has one), on the TV (night.js). The
  // tests stand in for the picture too (standInPaint).
  paint: null,
  budget: memoryBudget({ perDay: 1000 }),
  // it comes alive: a few seconds of moving light, ready on the third look
  reel: standInReel({ clip: STANDIN_CLIP }),
  clips: memoryBudget({ perDay: 1000 }),
  // walk inside: a small valley under a starry sky, built on the second look
  marble: standInMarble(),
  worlds: memoryBudget({ perDay: 1000 }),
  commons: memoryCommons(),
  sessions: memorySessions(),
};

// Claude Code on the subscription: each call logged with its model, how long it took and its tokens
export const onSubscription = (log = console.log) => ({
  claude: createClaudeCli({ onCall: (c) => log(`${c.family} ${c.seconds.toFixed(1)}s ${c.calls.join(', ') || 'text'} (${c.usage.input_tokens + c.usage.cache_read_input_tokens + c.usage.cache_creation_input_tokens} in, ${c.usage.output_tokens} out)`) }),
  speak: async () => null, paint: null, budget: memoryBudget({ perDay: 1000 }), commons: memoryCommons(), sessions: memorySessions(),
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const handler = createHandler(standIn ? fake : cli ? onSubscription() : null);
  createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4_000_000) req.destroy(); });
    req.on('end', async () => {
      const out = await handler({ rawPath: new URL(req.url, 'http://x').pathname, headers: req.headers, body, requestContext: { http: { method: req.method } } });
      res.writeHead(out.statusCode, out.headers);
      res.end(out.body);
    });
  }).listen(PORT, () => console.log(`guide service${standIn ? ' (stand-in)' : cli ? ' (Claude Code, on the subscription)' : ''} on http://localhost:${PORT}`));
}
