// What the brush sounds like, made on the spot with Web Audio: no sound files. The hiss of hair
// on paper, louder the faster and harder it goes, and scratchier when it runs dry; a soft tap as
// it lands; a drip when it's dipped; a swish when a stroke is washed out; a thump for the seal;
// and, while the painting comes back, a low hum that rises and falls with the feeling line, and
// beats faster and brighter where they mark it stirred.
// Browsers start audio only after a key, so it wakes on the first press.

export function createSound() {
  let ctx = null, hiss = null, hissGain = null, scratchGain = null, master = null, hum = null, humGain = null, humTone = null;
  let level = 0, scratch = 0, hushed = false;

  function noiseBuffer(seconds, color = 'pink') {
    const n = Math.round(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') { d[i] = w * 0.5; continue; }
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    }
    return buf;
  }

  function wake() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    // the hiss: pink noise through a band around the rustle of hair on paper
    hiss = ctx.createBufferSource(); hiss.buffer = noiseBuffer(2.5); hiss.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 2400; band.Q.value = 0.7;
    hissGain = ctx.createGain(); hissGain.gain.value = 0;
    hiss.connect(band).connect(hissGain).connect(master);
    // the scratch of a dry brush: white noise, high and grainy
    const grit = ctx.createBufferSource(); grit.buffer = noiseBuffer(1.7, 'white'); grit.loop = true;
    const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 3800;
    scratchGain = ctx.createGain(); scratchGain.gain.value = 0;
    grit.connect(high).connect(scratchGain).connect(master);
    hiss.start(); grit.start();
    // the hum: two soft sines a fifth apart, silent until the line is being marked
    hum = [ctx.createOscillator(), ctx.createOscillator()];
    humGain = ctx.createGain(); humGain.gain.value = 0;
    const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 900;
    humTone = soft;
    hum.forEach((o, i) => { o.type = 'sine'; o.frequency.value = i ? 294 : 196; o.connect(soft); o.start(); });
    soft.connect(humGain).connect(master);
  }

  function burst({ seconds, from, to, type = 'lowpass', q = 0.8, gain = 0.4, color = 'pink' }) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(seconds, color);
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + seconds);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + seconds + 0.02);
  }
  function tone({ seconds, from, to, gain = 0.2, type = 'sine' }) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + seconds);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    o.connect(g).connect(master); o.start(t); o.stop(t + seconds + 0.02);
  }

  return {
    wake,
    get on() { return !!ctx; },
    // every frame: how fast (units/s) and how hard the brush is moving on the paper, and how
    // much of the paper its marks cover (low: dry)
    brush(touching, speed, pressure, cover) {
      if (!ctx) return;
      const target = touching ? Math.min(1, speed / 260) * (0.35 + 0.65 * pressure) : 0;
      level += (target - level) * 0.25;
      scratch += ((touching ? Math.max(0, 0.8 - cover) * Math.min(1, speed / 200) : 0) - scratch) * 0.25;
      // quiet, and staying so: once told, the audio needs nothing more each frame
      if (!touching && level < 0.001 && scratch < 0.001) { if (hushed) return; hushed = true; level = scratch = 0; } else hushed = false;
      const t = ctx.currentTime;
      hissGain.gain.setTargetAtTime(level * 0.55, t, 0.03);
      scratchGain.gain.setTargetAtTime(scratch * 0.18, t, 0.03);
    },
    // while the painting comes back: a hum whose pitch follows the line (lighter: higher), a
    // little louder while a button is held; stirred, its fifth drifts out of tune and beats, and
    // it brightens; calm, it is pure and soft
    dial(on, v = 0, active = false, a = 0) {
      if (!ctx || !hum) return;
      const t = ctx.currentTime, f = 196 * 2 ** (v * 0.5), stir = Math.max(0, a);
      hum[0].frequency.setTargetAtTime(f, t, 0.08);
      hum[1].frequency.setTargetAtTime(f * 1.5 * (1 + 0.03 * stir), t, 0.08);
      humTone.frequency.setTargetAtTime(900 * 2 ** a, t, 0.1);
      humGain.gain.setTargetAtTime(on ? (active ? 0.07 : 0.035) : 0, t, on ? 0.15 : 0.3);
    },
    touch() { burst({ seconds: 0.12, from: 900, to: 300, gain: 0.5 }); },
    dip(water) { tone({ seconds: 0.16, from: water ? 1200 : 820, to: water ? 520 : 380, gain: 0.16 }); burst({ seconds: 0.18, from: 2200, to: 700, type: 'bandpass', q: 2, gain: 0.12 }); },
    wash() { burst({ seconds: 0.55, from: 600, to: 3200, type: 'bandpass', q: 0.9, gain: 0.32 }); },
    seal() { tone({ seconds: 0.25, from: 140, to: 60, gain: 0.5, type: 'triangle' }); burst({ seconds: 0.08, from: 500, to: 200, gain: 0.4 }); },
    // a thing of theirs, greeted: a little sound of its own, by how it moves (cutout.js motionOf):
    // what rises whooshes up, what glows rings, what swims warbles, what twinkles sparkles, what is
    // built knocks, what drifts breathes, and the rest pops
    greet(motion) {
      if (!ctx) return;
      const at = (ms, f) => setTimeout(f, ms);
      switch (motion) {
        case 'rise': tone({ seconds: 0.32, from: 320, to: 980, gain: 0.08 }); burst({ seconds: 0.35, from: 500, to: 2600, type: 'bandpass', q: 1.1, gain: 0.08 }); break;
        case 'glow': tone({ seconds: 0.9, from: 1046.5, to: 1046.5, gain: 0.06 }); at(110, () => tone({ seconds: 0.7, from: 1568, to: 1568, gain: 0.04 })); break;
        case 'swim': tone({ seconds: 0.14, from: 520, to: 660, gain: 0.08 }); at(140, () => tone({ seconds: 0.16, from: 660, to: 500, gain: 0.08 })); break;
        case 'twinkle': [1760, 2349, 2794].forEach((f, i) => at(i * 70, () => tone({ seconds: 0.22, from: f, to: f, gain: 0.04 }))); break;
        case 'settle': tone({ seconds: 0.16, from: 200, to: 120, gain: 0.28, type: 'triangle' }); at(120, () => tone({ seconds: 0.12, from: 180, to: 110, gain: 0.2, type: 'triangle' })); break;
        case 'drift': burst({ seconds: 0.6, from: 400, to: 1400, type: 'bandpass', q: 0.7, gain: 0.12 }); break;
        default: tone({ seconds: 0.18, from: 680, to: 420, gain: 0.09 });
      }
    },
    // a thing landing from its hop: a soft, low tap
    land() {
      if (!ctx) return;
      tone({ seconds: 0.09, from: 260, to: 140, gain: 0.14, type: 'triangle' });
      burst({ seconds: 0.06, from: 900, to: 300, gain: 0.08 });
    },
    // a thing of their world come to life: a quick sparkle, two notes leaping up, and a shimmer
    alive() {
      [880, 1318.5, 1760].forEach((f, i) => setTimeout(() => tone({ seconds: 0.5 + i * 0.25, from: f * 0.94, to: f, gain: 0.07 }), i * 90));
      burst({ seconds: 0.7, from: 3000, to: 7000, type: 'bandpass', q: 1.4, gain: 0.05 });
    },
    // a painting made real: a soft chime, rising, and a breath
    bloom() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => tone({ seconds: 2.4, from: f, to: f, gain: 0.06 }), i * 150));
      burst({ seconds: 1.6, from: 700, to: 3600, type: 'bandpass', q: 0.7, gain: 0.07 });
    },
  };
}
