// The Fire TV remote, as the page sees it. Vega's WebView passes the remote's buttons to a web
// page as keyboard events: the arrows, Enter (the select button), GoBack, MediaPlayPause,
// MediaRewind and MediaFastForward ("Supported remote key events" in Amazon's Vega WebView docs).
// A desktop keyboard gives the same names for the arrows and Enter, and stand-ins for the rest.
//
// Holding a button can arrive two ways: one keydown and, at the end, a keyup; or a stream of
// repeated keydowns. Both count as held. A button that has repeated and then gone quiet for a
// moment is let go, in case its keyup never comes. Pure: no DOM.

export const BUTTONS = ['up', 'down', 'left', 'right', 'select', 'back', 'playpause', 'rewind', 'fastforward'];
export const ARROWS = ['up', 'down', 'left', 'right'];

const BY_KEY = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'select',
  GoBack: 'back', BrowserBack: 'back', Escape: 'back', Backspace: 'back',
  MediaPlayPause: 'playpause', MediaPlay: 'playpause', MediaPause: 'playpause', p: 'playpause', P: 'playpause',
  MediaRewind: 'rewind', MediaTrackPrevious: 'rewind', ',': 'rewind', '[': 'rewind',
  MediaFastForward: 'fastforward', MediaTrackNext: 'fastforward', '.': 'fastforward', ']': 'fastforward',
};
// the key codes in Vega's table, for events whose key name is missing or unexpected
const BY_CODE = { 38: 'up', 40: 'down', 37: 'left', 39: 'right', 13: 'select', 27: 'back', 179: 'playpause', 227: 'rewind', 228: 'fastforward' };

export function buttonOf(e) {
  if (!e) return null;
  if (e.key && Object.prototype.hasOwnProperty.call(BY_KEY, e.key)) return BY_KEY[e.key];
  return BY_CODE[e.keyCode] || null;
}

export function createRemote({ now = () => Date.now(), repeatGap = 260 } = {}) {
  const held = new Map(); // button -> { since, last, count }
  const presses = [];
  return {
    // a keydown, or one of a held button's repeats
    down(button, t = now()) {
      if (!BUTTONS.includes(button)) return false;
      const h = held.get(button);
      if (h) { h.last = t; h.count++; return false; }
      held.set(button, { since: t, last: t, count: 1 });
      presses.push(button);
      return true;
    },
    up(button) { held.delete(button); },
    // the buttons held now
    held(t = now()) {
      for (const [b, h] of held) if (h.count > 1 && t - h.last > repeatGap) held.delete(b);
      return new Set(held.keys());
    },
    // the arrow pressed most recently among those still held: a remote's ring gives one at a
    // time, but a keyboard can give two
    arrow(t = now()) {
      let best = null, since = -Infinity;
      for (const b of this.held(t)) if (ARROWS.includes(b) && held.get(b).since > since) { best = b; since = held.get(b).since; }
      return best;
    },
    heldFor(button, t = now()) { const h = held.get(button); return h ? t - h.since : 0; },
    // the presses since the last call, in order
    takePresses() { return presses.splice(0); },
    clear() { held.clear(); presses.length = 0; },
  };
}
