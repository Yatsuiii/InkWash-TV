// What the guide may spend in a day, and how often one caller may call: so no one, the TV's key in
// hand or not, can run up the bill.
//
// - Money. Every model call, line voiced and picture made is priced as it is used and added to the
//   day's total (UTC), in memory or in the commons table (pk "spend#YYYY-MM-DD"), shared by every
//   copy of the guide. Once the day's total reaches GUIDE_SPEND_PER_DAY dollars, nothing more is
//   asked of Bedrock or Polly that day, and the TV tells its stories offline. The prices are the
//   list prices with 10% on top (what a regional endpoint costs), a model not listed priced as the
//   dearest, so the count runs high rather than low. A call already under way when the day runs out
//   is finished and counted, so a day can end a little over.
// - Callers. Each address may make so many calls in ten minutes: so many of the paid ones, and so
//   many in all (a TV and a phone each listen every two seconds while paired), so one caller can't
//   spend the day alone or try pairing codes until one fits. Counted in memory, by each copy of the
//   guide; nothing about a caller is stored.
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);

// dollars per million tokens: input, output, cache writes (five minutes) and cache reads; `long`,
// a dearer rate for a prompt over 100,000 tokens
export const PRICES = [
  [/opus-5-5/, { in: 4, out: 20, write: 5, read: 0.2 }],
  [/sonnet-5-5/, { in: 2, out: 10, write: 2.5, read: 0.2 }],
  [/haiku-5-5/, { in: 0.1, out: 0.5, write: 0.125, read: 0.01, long: { in: 0.5, out: 2.5, write: 0.625, read: 0.05 } }],
  [/haiku-4-5/, { in: 1, out: 5, write: 1.25, read: 0.1 }],
];
const DEAREST = { in: 5, out: 25, write: 6.25, read: 0.5 };
const REGIONAL = 1.1;
// Amazon Polly's neural voices, per character; Amazon Nova Canvas, per picture (its dearer size)
export const VOICE_PER_CHAR = 16e-6 * REGIONAL;
export const PICTURE = 0.08 * REGIONAL;
// Amazon Nova Reel, per second of video made, and a clip of it (six seconds)
export const CLIP = 6 * 0.08 * REGIONAL;
// a World Labs world (Marble's quick one, from a picture), at the most it costs
export const WORLD = 0.2;

export function costOf(model, usage) {
  const u = usage || {};
  const n = (k) => Math.max(0, Number(u[k]) || 0);
  const fresh = n('input_tokens'), write = n('cache_creation_input_tokens'), read = n('cache_read_input_tokens'), out = n('output_tokens');
  const found = PRICES.find(([re]) => re.test(String(model || '')));
  let p = found ? found[1] : DEAREST;
  if (p.long && fresh + write + read > 100000) p = p.long;
  return ((fresh * p.in + write * p.write + read * p.read + out * p.out) / 1e6) * REGIONAL;
}

export class Spent extends Error {
  constructor() { super('the guide has spent all it may today'); this.spent = true; }
}

// The day's spending, in memory (one copy of the guide) or in the commons table (every copy),
// counted in millionths of a dollar
const micro = (usd) => Math.max(0, Math.round(usd * 1e6));
export function memorySpend({ perDay = 10, now = () => Date.now() } = {}) {
  const days = new Map();
  return {
    perDay,
    async today() { return (days.get(dayOf(now())) || 0) / 1e6; },
    async over() { return (days.get(dayOf(now())) || 0) >= micro(perDay); },
    async add(usd) { const d = dayOf(now()); days.set(d, (days.get(d) || 0) + micro(usd)); },
  };
}

export function dynamoSpend({ client, table, commands: { GetItemCommand, UpdateItemCommand }, perDay = 10, now = () => Date.now() }) {
  const key = () => ({ pk: { S: `spend#${dayOf(now())}` }, sk: { S: 'usd' } });
  const today = async () => {
    const r = await client.send(new GetItemCommand({ TableName: table, Key: key(), ConsistentRead: true }));
    return r.Item && r.Item.micro ? Number(r.Item.micro.N) : 0;
  };
  return {
    perDay,
    async today() { return (await today()) / 1e6; },
    async over() { return (await today()) >= micro(perDay); },
    async add(usd) {
      const m = micro(usd);
      if (!m) return;
      await client.send(new UpdateItemCommand({
        TableName: table, Key: key(),
        UpdateExpression: 'SET expires = :expires ADD micro :m',
        ExpressionAttributeValues: { ':m': { N: String(m) }, ':expires': { N: String(Math.floor(now() / 1000) + 40 * 86400) } },
      }));
    },
  };
}

// Each caller's calls in the last ten minutes, in memory
export function callerLimits({ paid = 150, any = 2000, windowMs = 10 * 60 * 1000, now = () => Date.now(), most = 50000 } = {}) {
  const callers = new Map();
  return {
    allow(who, isPaid) {
      const t = now(), w = Math.floor(t / windowMs);
      let c = callers.get(who);
      if (!c || c.w !== w) {
        if (callers.size >= most) for (const [k, v] of callers) if (v.w !== w) callers.delete(k);
        c = { w, any: 0, paid: 0 };
        callers.set(who, c);
      }
      if (c.any >= any || (isPaid && c.paid >= paid)) return false;
      c.any += 1;
      if (isPaid) c.paid += 1;
      return true;
    },
  };
}

// The guide's clients, each call checked against the day's spending first and counted after
export function metered({ claude, speak = null, paint = null, reel = null, marble = null }, { spend, log = () => {}, picture = PICTURE }) {
  const guard = async () => {
    if (await spend.over()) { log(`the guide has told enough for today: $${spend.perDay} spent`); throw new Spent(); }
  };
  const count = (usd) => spend.add(usd).catch((err) => log(`spending not counted: ${err.message}`));
  return {
    claude: {
      messages: {
        async create(params) {
          await guard();
          const res = await claude.messages.create(params);
          await count(costOf(params && params.model, res && res.usage));
          return res;
        },
      },
    },
    speak: speak && (async (text, opts = {}) => {
      await guard();
      const audio = await speak(text, opts);
      await count(String((opts && opts.ssml) || text || '').length * VOICE_PER_CHAR);
      return audio;
    }),
    paint: paint && (async (body) => {
      await guard();
      const made = await paint(body);
      await count(picture);
      return made;
    }),
    // a clip is counted as it is asked for: it is made, and billed, after this call returns
    reel: reel && {
      type: reel.type,
      async start(input) {
        await guard();
        const r = await reel.start(input);
        await count(CLIP);
        return r;
      },
      check: (job) => reel.check(job),
    },
    // and a world as it is asked for: it is built, and billed, after this call returns
    marble: marble && {
      async start(body) {
        await guard();
        const op = await marble.start(body);
        await count(WORLD);
        return op;
      },
      poll: (id) => marble.poll(id),
      world: (id) => marble.world(id),
      fetch: (url) => marble.fetch(url),
    },
  };
}
