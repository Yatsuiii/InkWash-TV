// Their own words, by phone. While they paint with the remote, they can talk to the guide on their
// phone: the TV shows a code (a QR to scan), the phone opens a small page from this service, and
// what they say there reaches the TV, which keeps each thing with the stroke they were painting.
// The guide's questions go the other way, so the phone shows what it asked.
//
// The service holds their words only until the TV picks them up: the TV says which it has
// (`since`), and those are deleted. A pairing ends when the TV says so, or after 30 minutes.
//
// - memorySessions: in this process (the stand-in, the tests, one process);
// - dynamoSessions: in the guide's DynamoDB table, shared by every copy of the guide; items carry
//   `expires` (epoch seconds) for the table's time to live, as a backstop.
import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const CODE = /^[A-HJ-KMNP-Z2-9]{6}$/;
export const pairCode = (bytes = randomBytes(6)) => [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
const TTL = 30 * 60 * 1000, MAX_WORDS = 80, PHONE_FRESH = 15000;

export function memorySessions({ now = () => Date.now(), ttlMs = TTL, maxWords = MAX_WORDS, maxLive = 5000 } = {}) {
  const S = new Map();
  const live = (code) => {
    const s = S.get(code);
    if (s && s.expires <= now()) { S.delete(code); return null; }
    return s || null;
  };
  return {
    async create() {
      // pairings no one came back to are let go as new ones are made, and at most `maxLive` are
      // held (the oldest first to go: in a Map, the first made)
      for (const [c, s] of S) if (s.expires <= now()) S.delete(c);
      while (S.size >= maxLive) S.delete(S.keys().next().value);
      let code;
      do code = pairCode(); while (live(code));
      const s = { code, expires: now() + ttlMs, n: 0, words: [], ask: null, phoneAt: 0 };
      S.set(code, s);
      return { code, expires: s.expires };
    },
    // the phone: one thing they said. Its number, or null if the pairing is gone (or full).
    async say(code, text) {
      const s = live(code);
      if (!s || s.n >= maxWords) return null;
      s.n += 1;
      s.words.push({ i: s.n, text });
      s.phoneAt = now();
      return s.n;
    },
    // the phone: what the guide asked last
    async asked(code) {
      const s = live(code);
      if (!s) return null;
      s.phoneAt = now();
      return { ask: s.ask };
    },
    // the TV: what they said after `since` (what it has is forgotten here), and, if it gives one,
    // the guide's question for the phone
    async heard(code, since = 0, ask = undefined) {
      const s = live(code);
      if (!s) return null;
      if (ask !== undefined) s.ask = ask;
      s.words = s.words.filter((w) => w.i > since);
      return { words: s.words.map((w) => ({ i: w.i, text: w.text })), next: Math.max(since, ...s.words.map((w) => w.i)), phone: now() - s.phoneAt < PHONE_FRESH };
    },
    async end(code) { S.delete(code); },
    get size() { return S.size; },
  };
}

const pk = (code) => ({ S: `session#${code}` });
const wordKey = (i) => `w#${String(i).padStart(4, '0')}`;

export function dynamoSessions({ client, table, commands, now = () => Date.now(), ttlMs = TTL, maxWords = MAX_WORDS }) {
  const { GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand, DeleteItemCommand } = commands;
  const secs = () => Math.floor(now() / 1000);
  const failed = (err, name) => err && (err.name === name || err.__type?.endsWith(name));
  const items = async (code, prefix) => {
    const out = [];
    let start;
    do {
      const r = await client.send(new QueryCommand({
        TableName: table, ConsistentRead: true, ExclusiveStartKey: start,
        KeyConditionExpression: prefix ? 'pk = :pk AND begins_with(sk, :p)' : 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk(code), ...(prefix ? { ':p': { S: prefix } } : {}) },
      }));
      out.push(...(r.Items || []));
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  };
  const session = async (code) => {
    const r = await client.send(new GetItemCommand({ TableName: table, Key: { pk: pk(code), sk: { S: '#' } }, ConsistentRead: true }));
    const it = r.Item;
    return it && Number(it.expires.N) > secs() ? it : null;
  };
  return {
    async create() {
      for (let tries = 0; tries < 5; tries++) {
        const code = pairCode(), expires = Math.floor((now() + ttlMs) / 1000);
        try {
          await client.send(new PutItemCommand({
            TableName: table, Item: { pk: pk(code), sk: { S: '#' }, expires: { N: String(expires) }, n: { N: '0' }, phoneAt: { N: '0' } },
            ConditionExpression: 'attribute_not_exists(pk)',
          }));
          return { code, expires: expires * 1000 };
        } catch (err) { if (!failed(err, 'ConditionalCheckFailedException')) throw err; }
      }
      throw new Error('no free pairing code');
    },
    async say(code, text) {
      let n;
      try {
        const r = await client.send(new UpdateItemCommand({
          TableName: table, Key: { pk: pk(code), sk: { S: '#' } },
          UpdateExpression: 'SET phoneAt = :now ADD n :one',
          ConditionExpression: 'attribute_exists(pk) AND expires > :s AND n < :max',
          ExpressionAttributeValues: { ':now': { N: String(now()) }, ':one': { N: '1' }, ':s': { N: String(secs()) }, ':max': { N: String(maxWords) } },
          ReturnValues: 'ALL_NEW',
        }));
        n = Number(r.Attributes.n.N);
        await client.send(new PutItemCommand({ TableName: table, Item: { pk: pk(code), sk: { S: wordKey(n) }, text: { S: text }, expires: r.Attributes.expires } }));
      } catch (err) {
        if (failed(err, 'ConditionalCheckFailedException')) return null;
        throw err;
      }
      return n;
    },
    async asked(code) {
      try {
        const r = await client.send(new UpdateItemCommand({
          TableName: table, Key: { pk: pk(code), sk: { S: '#' } },
          UpdateExpression: 'SET phoneAt = :now', ConditionExpression: 'attribute_exists(pk) AND expires > :s',
          ExpressionAttributeValues: { ':now': { N: String(now()) }, ':s': { N: String(secs()) } }, ReturnValues: 'ALL_NEW',
        }));
        return { ask: r.Attributes.ask ? r.Attributes.ask.S : null };
      } catch (err) {
        if (failed(err, 'ConditionalCheckFailedException')) return null;
        throw err;
      }
    },
    async heard(code, since = 0, ask = undefined) {
      const s = await session(code);
      if (!s) return null;
      if (ask !== undefined) {
        await client.send(new UpdateItemCommand({
          TableName: table, Key: { pk: pk(code), sk: { S: '#' } },
          ...(ask ? { UpdateExpression: 'SET ask = :a', ExpressionAttributeValues: { ':a': { S: ask } } } : { UpdateExpression: 'REMOVE ask' }),
        }));
      }
      const words = (await items(code, 'w#')).map((it) => ({ i: Number(it.sk.S.slice(2)), text: it.text.S })).sort((a, b) => a.i - b.i);
      await Promise.all(words.filter((w) => w.i <= since).map((w) => client.send(new DeleteItemCommand({ TableName: table, Key: { pk: pk(code), sk: { S: wordKey(w.i) } } }))));
      const fresh = words.filter((w) => w.i > since);
      return { words: fresh, next: Math.max(since, ...fresh.map((w) => w.i)), phone: now() - Number(s.phoneAt?.N || 0) < PHONE_FRESH };
    },
    async end(code) {
      await Promise.all((await items(code)).map((it) => client.send(new DeleteItemCommand({ TableName: table, Key: { pk: it.pk, sk: it.sk } }))));
    },
  };
}

// The page the phone opens: /phone?c=CODE. Everything it needs is in it; it talks only to this
// service. The code is read from the address on the phone, never written into the page.
export const PHONE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

export const PHONE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Tell the storyteller</title>
<style>
:root { --paper: #f4efe4; --ink: #1d1b18; --wash: #6f6a61; --line: #d9d1c1; --accent: #8a2f1f; }
@media (prefers-color-scheme: dark) { :root { --paper: #171614; --ink: #ece6d8; --wash: #a59f93; --line: #34312c; --accent: #d9826c; } }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--paper); color: var(--ink); }
body { font: 17px/1.45 Georgia, "Times New Roman", serif; padding: max(20px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom)); }
main { max-width: 34rem; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.who { font: 13px/1.3 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--wash); margin: 0; }
#ask { font-size: 22px; line-height: 1.35; margin: 0 0 4px; min-height: 2.7em; }
textarea { width: 100%; min-height: 6.5em; resize: vertical; font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
textarea:focus { outline: 2px solid var(--wash); outline-offset: 1px; }
.row { display: flex; gap: 10px; }
button { flex: 1; font: 600 16px/1 system-ui, sans-serif; padding: 15px 12px; border-radius: 10px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); }
button.quiet { background: transparent; color: var(--ink); }
button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
button:disabled { opacity: .45; }
#heard { color: var(--wash); font-style: italic; min-height: 1.4em; margin: 0; }
#status { font: 14px/1.4 system-ui, sans-serif; color: var(--wash); margin: 0; }
ol { margin: 0; padding-left: 1.3em; color: var(--wash); }
ol li { margin: 4px 0; }
.small { font: 13px/1.45 system-ui, sans-serif; color: var(--wash); margin: 8px 0 0; }
</style>
</head>
<body>
<main>
  <p class="who">Inkwash · the storyteller</p>
  <p id="ask">Tell me about your world while you draw it: what each thing is, who is there, what happens.</p>
  <textarea id="text" maxlength="300" placeholder="Type, or tap the microphone on your keyboard and speak." aria-label="What you want to tell the storyteller"></textarea>
  <div class="row">
    <button id="talk" class="quiet" type="button" hidden>Talk</button>
    <button id="send" type="button">Send to the TV</button>
  </div>
  <p id="heard" aria-live="polite"></p>
  <p id="status" role="status">Connecting to your TV…</p>
  <ol id="sent" aria-label="Sent to your TV"></ol>
  <p class="small">What you send goes to your TV for this drawing's story, and is kept there. The story server holds it only until your TV picks it up. <span id="speechnote" hidden>Talk turns speech into text with your phone's browser, which may use its maker's online service.</span></p>
</main>
<script>
(() => {
  const code = new URLSearchParams(location.search).get('c') || '';
  const $ = (id) => document.getElementById(id);
  const text = $('text'), send = $('send'), talk = $('talk'), status = $('status'), heard = $('heard');
  let alive = /^[A-HJ-KMNP-Z2-9]{6}$/.test(code);
  const post = async (path, body) => {
    const r = await fetch(new URL(path, location.href), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, ...body }) });
    if (r.status === 404) { ended(); return null; }
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  function ended() {
    alive = false;
    status.textContent = 'This pairing has ended. To talk to the storyteller again, scan the code on your TV.';
    send.disabled = true; talk.disabled = true; stop();
  }
  async function say(t) {
    t = String(t || '').replace(/\\s+/g, ' ').trim().slice(0, 300);
    if (!t || !alive) return;
    try {
      const r = await post('words', { text: t });
      if (!r) return;
      const li = document.createElement('li');
      li.textContent = t;
      $('sent').prepend(li);
      status.textContent = 'Sent. Your TV has it.';
    } catch { status.textContent = 'That did not reach the TV. Try again in a moment.'; }
  }
  send.addEventListener('click', async () => { const t = text.value; text.value = ''; await say(t); text.focus(); });
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send.click(); } });
  // the guide's question, as the TV last asked it
  async function poll() {
    if (!alive) return;
    try {
      const r = await post('asked', {});
      if (r) { if (r.ask) $('ask').textContent = r.ask; if (/Connecting|reach/.test(status.textContent)) status.textContent = 'Connected to your TV.'; }
    } catch { status.textContent = 'Trying to reach your TV…'; }
    if (alive) setTimeout(poll, 2000);
  }
  if (!alive) ended(); else poll();
  // talking, where the browser can turn speech into text
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false;
  function stop() { listening = false; talk.classList.remove('on'); talk.textContent = 'Talk'; heard.textContent = ''; try { rec && rec.stop(); } catch {} }
  if (SR) {
    talk.hidden = false; $('speechnote').hidden = false;
    talk.addEventListener('click', () => {
      if (listening) return stop();
      rec = new SR();
      rec.lang = navigator.language || 'en-US'; rec.continuous = true; rec.interimResults = true;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) say(r[0].transcript); else interim += r[0].transcript;
        }
        heard.textContent = interim;
      };
      rec.onend = () => { if (listening) { try { rec.start(); } catch { stop(); } } };
      rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stop(); status.textContent = 'The microphone is off for this page. You can still type, or use your keyboard\\'s microphone.'; } };
      listening = true; talk.classList.add('on'); talk.textContent = 'Listening… tap to stop';
      try { rec.start(); } catch { stop(); }
    });
  }
})();
</script>
</body>
</html>
`;
