// The screen read aloud, for a painter who can't read yet or would rather listen: the guide's
// questions, each choice as they reach it (the way a talker reads its buttons), and what the guide
// says while they paint. Through the guide service's voice (Amazon Polly), each phrase fetched once
// and kept; where there is no service, the browser's own voice, if it has one; else nothing.
// Moving on cuts off what was being read, so it always reads what is in front of them now.
//
// Pure, apart from what it's given: `speak({ text })` resolves { audio } (base64 MP3, ai.js);
// `audio` an <audio> element; `synth`, `Utterance` the browser's speech synthesis, or null.
export function createAloud({ speak = null, audio = null, synth = globalThis.speechSynthesis || null, Utterance = globalThis.SpeechSynthesisUtterance || null } = {}) {
  const kept = new Map(); // phrase -> a promise of its audio (null if the service had none)
  let now = null; // what should be heard; anything older that arrives late is dropped
  let heard = 0;
  function stop() {
    now = null;
    if (audio) { try { audio.pause(); } catch { /* nothing playing */ } }
    if (synth) { try { synth.cancel(); } catch { /* nothing queued */ } }
  }
  async function say(text) {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!t) return false;
    stop();
    now = t;
    if (speak) {
      if (!kept.has(t)) kept.set(t, Promise.resolve().then(() => speak({ text: t })).then((r) => (r && r.audio) || null).catch(() => null));
      const b64 = await kept.get(t);
      if (now !== t) return false; // they moved on while it came
      if (b64 && audio) {
        audio.src = `data:audio/mpeg;base64,${b64}`;
        try { await audio.play(); } catch { /* the TV wouldn't play it */ }
        heard++;
        return true;
      }
    }
    if (synth && Utterance) {
      try { synth.speak(new Utterance(t)); heard++; return true; } catch { return false; }
    }
    return false;
  }
  return { say, stop, get kept() { return kept.size; }, get heard() { return heard; } };
}
