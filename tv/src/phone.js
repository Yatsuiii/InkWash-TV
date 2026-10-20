// Talking to the guide by phone, from the TV's side. The remote has no microphone the app can use,
// so a phone lends one: the TV pairs with the guide service (a six-letter code), shows the address
// the phone opens as a QR on the felt, and then, every second and a half, collects what they said
// there and passes on what the guide asked. Each thing they say is kept with the stroke they were
// painting as they said it.
//
// Pure apart from the calls it's given: `ai` is the guide service (ai.js), with pair() and heard().
import qrcode from './vendor/qrcode.mjs';

export function createPhone({ ai, every = 1.5 }) {
  if (!ai || !ai.pair) return null;
  let code = null, url = null, since = 0, busy = false, last = -1e9, listening = false, ask, ended = false;
  return {
    get code() { return code; },
    get url() { return url; },
    // whether a phone has opened the page lately
    get listening() { return listening; },
    async pair() {
      const r = await ai.pair();
      if (!r || typeof r.code !== 'string') throw new Error('no pairing code');
      code = r.code;
      url = `${ai.endpoint}/phone?c=${encodeURIComponent(code)}`;
      return { code, url };
    },
    // the guide's question, shown on the phone at the next poll
    ask(text) { ask = text ? String(text).slice(0, 200) : null; },
    // once a frame: every `every` seconds, what they said since last time (to `onWords`)
    tick(t, onWords) {
      if (!code || ended || busy || t - last < every) return;
      busy = true;
      last = t;
      const asking = ask;
      const body = { code, since, ...(asking !== undefined ? { ask: asking } : {}) };
      ask = undefined;
      ai.heard(body)
        .then((r) => {
          if (!r) return;
          listening = !!r.phone;
          since = Math.max(since, Number(r.next) || 0);
          const words = (Array.isArray(r.words) ? r.words : []).map((w) => String(w.text || '').trim()).filter(Boolean);
          if (words.length) onWords(words);
        })
        .catch((err) => {
          if (/404/.test(String(err && err.message))) ended = true;
          // the question didn't get there: it goes again at the next poll, unless there's a newer one
          else if (ask === undefined) ask = asking;
        })
        .finally(() => { busy = false; });
    },
    // the pairing is over: what's left on the service is deleted
    end() {
      if (!code || ended) return;
      ended = true;
      ai.heard({ code, end: true }).catch(() => {});
    },
  };
}

// The QR for an address, as an SVG: dark modules on the paper colour, with a quiet zone.
export function qrSvg(text, { size = 220, dark = '#1c1e24', light = '#f4eee0' } = {}) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), quiet = 3, total = n + quiet * 2;
  let path = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  return `<svg viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${total}" height="${total}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
