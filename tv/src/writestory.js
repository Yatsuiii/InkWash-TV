// A story from words alone, for someone who would rather write than draw. They say what they want
// on their phone (the TV shows a QR), or choose a starting idea with the remote. The storyteller
// reads the feeling in the words and tells it back (server/writer.mjs), and one picture is painted
// from the words: no strokes, no painting. Then the story is told line by line in Polly's voice
// over the picture.
//
// Pure apart from what it is given: `ai.write(body)` is the guide service (ai.js), `say(text)` reads
// a line aloud (aloud.js), `el` is the section the TV shows it in, `qr(url)` makes the phone's QR
// as an SVG string, `phone` gives the pairing ({ code, url, listening }) or null.

// ideas to start from, for the remote alone: each one a few words a person might have written
export const IDEAS = [
  { label: 'A lighthouse that talks to the sea', text: 'A lighthouse keeper who talks to the sea every night, and one night the sea answers.' },
  { label: 'A dragon who is afraid of the dark', text: 'A small dragon who is afraid of the dark, and a firefly who offers to light the way home.' },
  { label: 'A train that runs through the clouds', text: 'A little night train that rides above the clouds, carrying everyone’s dreams to the morning.' },
  { label: 'The last day of summer', text: 'The last evening of summer by a quiet lake, when everyone has gone home and the lanterns are still on.' },
  { label: 'A house that remembers me', text: 'The old house I grew up in, empty now, still keeping the light on in the kitchen for me.' },
];

// how each feeling tints the page while the picture is painted (and when there is none)
export const TINTS = {
  peaceful: ['#223a4a', '#6d8ea3'], joyful: ['#7a4a1c', '#e8b05a'], strange: ['#2a1f4d', '#7a5aa6'],
  longing: ['#2c2a45', '#c79a5e'], uneasy: ['#1a2230', '#566579'], sad: ['#1d2633', '#61758c'],
};

export const HOLD = 30000; // the most the first line waits for its picture (ms)
export const PAUSE = 2200; // after the last words arrive, before the story is written (ms)
export const lineTime = (text) => 3200 + String(text || '').length * 55; // how long a line stays before the next (ms)

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createWriter({ ai, el, say = () => {}, stop = () => {}, qr = null, phone = () => null, young = () => false, seed = () => 0, style = () => null, onClose = () => {}, now = () => performance.now() }) {
  let step = 'closed', pending = false, began = 0, k = 0, said = [], asked = null, story = null, at = 0, shown = 0, token = 0, error = '';
  const set = (html) => { el.innerHTML = html; };

  function paintAsk() {
    const p = phone();
    const code = p && p.code ? p.code.split('').join(' ') : null;
    set(`<div class="wr-ask"><h2>Write your story</h2>
      <p class="sub">${p && p.url ? 'Say what you want on your phone: a place, someone in it, what happens.' : 'Choose an idea.'}</p>
      ${p && p.url && qr ? `<div class="wr-qr">${qr(p.url)}<p class="code">${esc(code)}</p><p class="small">${p.listening ? 'Your phone is here. Say it.' : 'Scan with your phone’s camera.'}</p></div>` : ''}
      <p class="or">${p && p.url ? 'or choose one' : ''}</p>
      <ul class="wr-ideas">${IDEAS.map((x, i) => `<li class="${i === k ? 'on' : ''}">${esc(x.label)}</li>`).join('')}</ul></div>`);
  }
  function paintWriting() {
    set(`<div class="wr-wait"><p>The storyteller is writing…</p><p class="small">${esc(said.join(' ').slice(0, 160))}</p></div>`);
  }
  function paintStory() {
    const s = story, tint = TINTS[s.feeling] || TINTS.strange;
    const done = shown >= s.lines.length;
    set(`<div class="wr-story" style="--a:${tint[0]};--b:${tint[1]}">${s.image ? `<img class="pic" alt="" src="${s.image}">` : '<div class="pic plain"></div>'}
      <div class="veil"></div>
      <div class="caption"><p class="name">${esc(s.title)}</p>${done ? '<p class="line end">The end.</p>' : `<p class="line">${esc(s.lines[shown])}</p><p class="count">${shown + 1} of ${s.lines.length}</p>`}</div></div>`);
  }
  // the picture arrives while a line is on screen: it replaces the plain backdrop without redrawing the words
  function fadeIn(src) {
    const old = el.querySelector('.pic');
    if (!old) return;
    const img = new Image();
    img.className = 'pic late'; img.alt = ''; img.src = src;
    old.after(img);
    setTimeout(() => { if (old.parentNode) old.remove(); }, 1600);
  }
  function paintError() {
    set(`<div class="wr-wait"><p>${esc(error || 'The storyteller couldn’t be reached.')}</p><p class="small">Press OK to try again, or Back to leave.</p></div>`);
  }

  function show() {
    if (step === 'ask') paintAsk(); else if (step === 'writing') paintWriting(); else if (step === 'story') paintStory(); else if (step === 'error') paintError();
  }
  function line() { const s = story; if (s && shown < s.lines.length) { say(s.lines[shown]); at = now(); } }

  async function begin(text) {
    if (step === 'writing') return;
    step = 'writing'; said = [text]; const mine = ++token; paintWriting(); stop();
    try {
      const r = await ai.write({ text, young: young(), seed: seed(text), want: 'story' });
      if (mine !== token || step !== 'writing') return;
      if (!r || !Array.isArray(r.lines) || !r.lines.length) throw new Error('empty');
      story = { title: r.title || 'A story', feeling: r.feeling || 'strange', lines: r.lines.map(String), image: r.image || null };
      step = 'story'; shown = 0; paintStory(); line(); began = now(); pending = !story.image && !!r.picture;
      // the telling has begun; the picture is painted meanwhile and fades in when it comes
      if (!story.image && r.picture) {
        ai.write({ want: 'picture', picture: r.picture, feeling: story.feeling, young: young(), seed: seed(text), ...(style() ? { style: style() } : {}) })
          .then((p) => { if (mine === token && step === 'story' && p && p.image) { story.image = p.image; fadeIn(p.image); } })
          .catch(() => {})
          .finally(() => { if (mine === token) { pending = false; at = now(); } });
      }
    } catch (err) {
      if (mine !== token || step !== 'writing') return;
      error = 'The storyteller couldn’t tell that one just now.'; step = 'error'; paintError();
    }
  }

  return {
    get step() { return step; },
    get story() { return story; },
    get shown() { return shown; },
    open() { step = 'ask'; k = 0; said = []; asked = null; story = null; error = ''; token++; el.hidden = false; show(); },
    close() { token++; step = 'closed'; el.hidden = true; el.innerHTML = ''; stop(); },
    // what they said on their phone: gathered for a moment, then written
    words(text) {
      if (step !== 'ask') return;
      said.push(String(text).slice(0, 300));
      asked = now();
      paintWriting();
    },
    // once a frame: the words gathered long enough begin the story; a told line gives way to the next
    tick() {
      const t = now();
      if (step === 'ask' && said.length && asked !== null && t - asked > PAUSE) { const text = said.join(' '); asked = null; begin(text); return; }
      if (step === 'story' && story && shown < story.lines.length && !(shown === 0 && pending && t - began < HOLD) && t - at > lineTime(story.lines[shown])) { shown++; paintStory(); line(); }
    },
    // a button: true when it was used. Back always leaves (to where it was opened from).
    press(button) {
      if (button === 'back') { if (step === 'story' && shown > 0 && shown < story.lines.length) { shown--; paintStory(); line(); return true; } this.close(); onClose(); return true; }
      if (step === 'ask') {
        if (button === 'left' || button === 'up') { k = (k + IDEAS.length - 1) % IDEAS.length; paintAsk(); return true; }
        if (button === 'right' || button === 'down') { k = (k + 1) % IDEAS.length; paintAsk(); return true; }
        if (button === 'select' || button === 'playpause') { begin(IDEAS[k].text); return true; }
      } else if (step === 'story') {
        if (button === 'select' || button === 'right' || button === 'playpause') {
          if (shown >= story.lines.length) { story = null; step = 'ask'; said = []; asked = null; paintAsk(); stop(); return true; }
          shown++; paintStory(); line(); return true;
        }
        if (button === 'left') { if (shown > 0) { shown--; paintStory(); line(); } return true; }
      } else if (step === 'error') {
        if (button === 'select') { step = 'ask'; said = []; asked = null; paintAsk(); return true; }
      }
      return true;
    },
  };
}
