// The sky around the paper. While a dream is painted, the paper lies on the felt; once it is felt,
// told or remembered, the room goes and the paper floats in their world's place (`place`: drawn by
// whoever shows it), or, until their world has one, in a night sky. The sky feels what they mark:
// brighter, and dawn rises gold from below; darker, and it deepens to indigo; wilder, and the stars
// flicker fast and shoot across it (at night); calmer, and they barely glimmer. During the telling,
// each line's sky is how that part felt to them.
//
// Cheap on a TV: the night is drawn once, on one canvas the size of the stage, and never moves.
// What moves is small: a couple of dozen stars that glimmer (a CSS animation each), the odd
// shooting star, and dawn and depth, two gradients whose opacity changes only when the feeling does.

// A seeded generator, so the sky is the same sky every night
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The night: deep blue, lighter toward the horizon; a soft band of stars across it; faint stars
// everywhere, and a few bright ones with a halo
function drawNight(c, rand) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const base = g.createRadialGradient(W / 2, H * 1.15, 0, W / 2, H * 1.15, W * 0.75);
  base.addColorStop(0, '#2a3c70'); base.addColorStop(0.42, '#141f42'); base.addColorStop(0.78, '#080c1c'); base.addColorStop(1, '#05070f');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const band = g.createLinearGradient(0, H, W, 0);
  band.addColorStop(0.32, 'rgba(120,140,200,0)'); band.addColorStop(0.5, 'rgba(150,165,220,0.1)'); band.addColorStop(0.68, 'rgba(120,140,200,0)');
  g.fillStyle = band; g.fillRect(0, 0, W, H);
  const tints = ['255,255,255', '210,225,255', '255,236,210', '190,205,255'];
  for (let i = 0; i < 1300; i++) {
    let x = rand() * W, y = rand() * H;
    // a third of them gather along the band
    if (i % 3 === 0) { const t = rand(), off = (rand() + rand() + rand() - 1.5) * W * 0.07; x = t * W + off; y = H - t * H + off * 0.6; }
    const r = 0.45 + rand() * rand() * 1.2, a = 0.22 + rand() * 0.6;
    g.fillStyle = `rgba(${tints[Math.floor(rand() * tints.length)]},${a.toFixed(2)})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = rand() * W, y = rand() * H, r = 1.3 + rand() * 1.4;
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 5);
    halo.addColorStop(0, 'rgba(255,250,235,0.9)'); halo.addColorStop(0.25, 'rgba(230,236,255,0.3)'); halo.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 5, 0, Math.PI * 2); g.fill();
  }
}

const ease = (from, to, dt, tau) => from + (to - from) * Math.min(1, dt / tau);

export function createSky(el, { seed = 23, random = Math.random, glints = 24 } = {}) {
  const rand = rng(seed);
  drawNight(el.querySelector('canvas'), rand);
  const warm = el.querySelector('.warm'), deep = el.querySelector('.deep'), falling = el.querySelector('.falling');
  // the stars that glimmer, each at its own pace
  el.classList.add('gone'); // hidden until shown, its stars at rest
  el.querySelector('.glints').innerHTML = Array.from({ length: glints }, () => `<i style="left:${(rand() * 100).toFixed(2)}%;top:${(rand() * 100).toFixed(2)}%;--d:${(1.8 + rand() * 2.6).toFixed(2)}s;--w:${(-rand() * 4).toFixed(2)}s"></i>`).join('');
  let on = false, v = 0, a = 0, tv = 0, ta = 0, nextFall = 0, shown = { v: null, a: null, pace: '' }, gone = null, drawn = 'night';
  const fall = () => {
    const s = document.createElement('i');
    const x = 200 + random() * 1500, y = 40 + random() * 380, ang = 18 + random() * 22, len = 380 + random() * 260;
    s.className = 'shoot';
    s.style.left = `${x}px`; s.style.top = `${y}px`;
    s.style.setProperty('--a', `${ang}deg`);
    s.style.setProperty('--dx', `${(len * Math.cos((ang * Math.PI) / 180)).toFixed(0)}px`);
    s.style.setProperty('--dy', `${(len * Math.sin((ang * Math.PI) / 180)).toFixed(0)}px`);
    falling.append(s);
    setTimeout(() => s.remove(), 1400);
  };
  return {
    get on() { return on; },
    get mood() { return { v: Math.round(v * 100) / 100, a: Math.round(a * 100) / 100 }; },
    // shown or hidden; once it has faded out (700 ms), its stars rest until it is shown again
    show(yes) {
      if (yes === on) return;
      on = yes;
      el.classList.toggle('on', on);
      clearTimeout(gone);
      if (on) el.classList.remove('gone');
      else { tv = 0; ta = 0; gone = setTimeout(() => el.classList.add('gone'), 700); }
    },
    // their world's place round the paper: `key` says which (it is drawn again only when it
    // changes), `draw(g, W, H)` draws it, `day` if it is light there (no stars); or, with no key,
    // the night again
    place(key = null, draw = null, { day = false } = {}) {
      const want = key && draw ? String(key) : 'night';
      if (want === drawn) return;
      drawn = want;
      const c = el.querySelector('canvas');
      if (want === 'night') drawNight(c, rng(seed));
      else { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); draw(g, c.width, c.height); }
      el.classList.toggle('placed', want !== 'night');
      el.classList.toggle('day', want !== 'night' && day);
    },
    // how it feels: lighter (1) to heavier (-1), calmer (-1) to more stirred (1)
    feel(fv, fa = 0) { tv = Math.max(-1, Math.min(1, Number(fv) || 0)); ta = Math.max(-1, Math.min(1, Number(fa) || 0)); },
    frame(dt, now) {
      if (!on) { v = tv = 0; a = ta = 0; return; }
      v = ease(v, tv, dt, 0.9); a = ease(a, ta, dt, 0.9);
      // dawn and depth: written only when they have changed enough to see
      if (shown.v == null || Math.abs(v - shown.v) > 0.015) {
        shown.v = v;
        warm.style.opacity = (Math.max(0, v) * 0.95).toFixed(3);
        deep.style.opacity = (Math.max(0, -v) * 0.9).toFixed(3);
      }
      const pace = a > 0.35 ? 'wild' : a < -0.35 ? 'still' : '';
      if (pace !== shown.pace) { el.classList.remove('wild', 'still'); if (pace) el.classList.add(pace); shown.pace = pace; }
      // shooting stars, at night: often when it is wild, now and then otherwise
      if (el.classList.contains('day')) return;
      if (!nextFall) nextFall = now + 6;
      else if (now > nextFall) { fall(); nextFall = now + (a > 0.35 ? 0.5 + random() * 1.4 : 9 + random() * 14); }
    },
  };
}
