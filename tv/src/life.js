// The telling, alive. As each line is told, the part of the painting it is about lifts off the
// paper and moves the way its shape moves (cutout.js motionOf): a rocket or a tower rises, a moon
// glows, a dragon or a wave swims, a shore drifts, a star twinkles, a pool of ink breathes. It
// eases in as the line begins and settles back into the paper as the next one comes, so the
// painting is never other than the one they painted.
//
// Drawn inside the sheet, over the painting: what stays where the part was, then the part itself,
// multiplied onto it as ink is (and, for what glows, a soft light between). Only CSS transforms and
// opacity change each frame; nothing is redrawn. Told in their world, a part is light, and nothing
// stays where it was (`still` is null): `changed` hears which parts are out, so the light they
// lifted out of can be hidden under them (inkgl.js setHoles).
//   changed(cuts): each time a part comes or goes, the cuts of every part out now
import { poseOf } from './cutout.js';

const EASE_IN = 0.9, EASE_OUT = 0.8; // seconds
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// `host`: the element over the painting, inside the sheet; `px`: sheet pixels per paper unit
export function createLife(host, { px = 0.98, changed = null } = {}) {
  const parts = [];
  const told = () => { if (changed) changed(parts.map((p) => p.cut)); };
  const make = (tag, cls, style = {}) => { const e = document.createElement(tag); e.className = cls; Object.assign(e.style, style); return e; };

  // `cut`: from cutOut(); `motion`: how it moves. The parts already alive settle back.
  function show(cut, motion, now) {
    rest(now);
    if (!cut) return null;
    const [x0, y0, x1, y1] = cut.box;
    const W = (x1 - x0) * px, H = (y1 - y0) * px;
    const box = make('div', 'part', { left: `${x0 * px}px`, top: `${y0 * px}px`, width: `${W}px`, height: `${H}px` });
    const fill = { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' };
    if (cut.still) {
      cut.still.className = 'still';
      Object.assign(cut.still.style, fill);
      box.append(cut.still);
    }
    let glow = null;
    if (motion === 'glow' || motion === 'twinkle') {
      const r = Math.max(W, H) * (motion === 'glow' ? 0.95 : 0.8);
      glow = make('div', 'glow', { left: `${W / 2 - r}px`, top: `${H / 2 - r}px`, width: `${2 * r}px`, height: `${2 * r}px`, opacity: '0' });
      box.append(glow);
    }
    const mover = make('div', cut.light ? 'mover light' : 'mover', fill);
    cut.ink.className = 'inkcut';
    Object.assign(cut.ink.style, fill);
    mover.append(cut.ink);
    box.append(mover);
    host.append(box);
    const part = { box, glow, mover, motion, W, H, born: now, rest: null, cut };
    parts.push(part);
    told();
    return part;
  }
  // everything alive settles back into the paper
  function rest(now) { for (const p of parts) if (p.rest == null) p.rest = now; }
  function clear() { const had = parts.length; for (const p of parts.splice(0)) p.box.remove(); if (had) told(); }
  function frame(now) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const k = smooth((now - p.born) / EASE_IN) * (p.rest == null ? 1 : 1 - smooth((now - p.rest) / EASE_OUT));
      if (p.rest != null && now - p.rest >= EASE_OUT) { p.box.remove(); parts.splice(i, 1); told(); continue; }
      const q = poseOf(p.motion, now - p.born, k, { size: [p.W, p.H] });
      p.mover.style.transform = `translate(${q.dx.toFixed(2)}px, ${q.dy.toFixed(2)}px) rotate(${q.rot.toFixed(3)}deg) skewY(${q.skew.toFixed(3)}deg) scale(${q.scale.toFixed(4)})`;
      if (p.glow) p.glow.style.opacity = q.glow.toFixed(3);
    }
  }
  return {
    show, rest, clear, frame,
    // what is alive now, for the tests: its motion, and how far in it is
    get alive() { const p = parts.find((x) => x.rest == null); return p ? { motion: p.motion } : null; },
    get count() { return parts.length; },
  };
}
