// Ink on xuan paper, in WebGL2. What the brush (brush.js) gives each frame is a handful of
// bristle marks; this turns them into ink the way rice paper takes it:
//
// - The paper is made once, from noise and a few thousand drawn fibres: its colour, its tooth
//   (the grain a dry brush catches on), and, at half the screen's resolution, how much water each
//   spot holds and how readily water moves through it (fibres carry it fastest).
// - Each mark lands twice. Its crisp body goes into the stroke's own layer, at full resolution:
//   bristle lines that break up on the grain where the brush can't cover the paper. And its
//   water and some of its ink go into the wet layer, at half resolution.
// - The wet layer runs a few times a frame while anything is wet. Water past what the paper holds
//   spreads into dry paper along the fibres, so edges feather. Ink rides along with it, but more
//   slowly, so a halo of paler ink grows around a wet stroke. The paper drinks and the air dries
//   it, fastest at the edges, so the water inside flows outward and leaves a darker rim. Ink
//   settles into the paper as it dries. Water dropped into wet ink pushes it into a bloom.
// - Wet paper looks a shade darker, and dries back.
//
// - The dream inks (indigo, gold, cinnabar) are colour: each has its own channel in the stroke's
//   layer and the painting's (black in red, indigo in green, gold in blue, cinnabar in alpha), and
//   its own colour when it lands on the paper. Colour wets the paper but stays where it lands.
//
// Undo keeps the paper as it was before each of the last few strokes. Nothing runs while the
// paper is dry and the brush is still, so an idle screen costs nothing.

const UNITS = { W: 1600, H: 1000 };

const QUAD_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return s;
}
float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }`;

// the paper as it looks: rgb, and its tooth in alpha
const PAPER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFib;
uniform vec2 uSize;
uniform float uSeed;
out vec4 o;
${NOISE}
void main() {
  vec2 p = vUv * vec2(${UNITS.W}.0, ${UNITS.H}.0) + uSeed * 37.0;
  float mottle = fbm(p / 170.0);
  float floc = fbm(p / 26.0 + 7.1);
  float fine = hash(floor(vUv * uSize) + uSeed);
  vec4 f = texture(uFib, vUv);
  vec3 base = vec3(0.957, 0.934, 0.882);
  float shade = 1.0 + 0.05 * (mottle - 0.5) + 0.035 * (floc - 0.5) + 0.022 * (fine - 0.5) + 0.05 * f.r - 0.07 * f.g;
  vec3 col = base * shade + vec3(0.0, 0.004, 0.012) * (floc - 0.5);
  float tooth = clamp(0.5 + 0.6 * (fine - 0.5) + 0.45 * (floc - 0.5) + 0.35 * f.r, 0.0, 1.0);
  o = vec4(col, tooth);
}`;

// how the paper takes wet ink, at full resolution: the fibres and the clumps of pulp drink more,
// so a wash or a halo comes out cloudy and fibrous rather than smooth
const DRINK_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFib;
uniform float uSeed;
out vec4 o;
${NOISE}
void main() {
  vec2 p = vUv * vec2(${UNITS.W}.0, ${UNITS.H}.0) + uSeed * 37.0;
  float floc = fbm(p / 26.0 + 7.1);
  float fine = fbm(p / 5.5 + 1.7);
  vec4 f = texture(uFib, vUv);
  float drink = clamp(0.5 + 0.75 * (fine - 0.5) + 0.55 * (floc - 0.5) + 0.5 * f.r + 0.7 * f.b, 0.0, 1.0);
  o = vec4(drink, 0.0, 0.0, 1.0);
}`;

// the paper as water sees it: how much each spot holds (r), how readily water moves (g)
const SIMPAPER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFib;
uniform float uSeed;
out vec4 o;
${NOISE}
void main() {
  vec2 p = vUv * vec2(${UNITS.W}.0, ${UNITS.H}.0) + uSeed * 37.0;
  float mottle = fbm(p / 170.0);
  float floc = fbm(p / 26.0 + 7.1);
  float floc2 = fbm(p / 9.0 + 3.3);
  vec4 f = texture(uFib, vUv);
  float fib = clamp(f.r + f.b * 2.0, 0.0, 1.0);
  float cap = clamp(0.5 + 0.55 * (mottle - 0.5) + 0.6 * (floc - 0.5) + 0.35 * (floc2 - 0.5) - 0.35 * fib, 0.04, 1.0);
  float perm = clamp(0.62 + 0.5 * (floc2 - 0.5) + 0.25 * (floc - 0.5) + 0.6 * fib, 0.15, 1.0);
  o = vec4(cap, perm, 0.0, 1.0);
}`;

// a bristle's mark: a short capsule from a to b, in paper units
const MARK_VS = `#version 300 es
in vec2 aPos;
in vec4 aAB;
in vec4 aInk;   // pigment, cover, water, seed
in vec4 aRD;    // radius, distance travelled at a, body (how much stays crisp), pool + 2 * pigment channel
out vec2 vP;
out vec4 vAB;
out vec4 vInk;
out vec4 vRD;
void main() {
  vP = aPos; vAB = aAB; vInk = aInk; vRD = aRD;
  gl_Position = vec4(aPos.x / ${UNITS.W}.0 * 2.0 - 1.0, 1.0 - aPos.y / ${UNITS.H}.0 * 2.0, 0.0, 1.0);
}`;

const MARK_COMMON = `
in vec2 vP;
in vec4 vAB;
in vec4 vInk;
in vec4 vRD;
uniform sampler2D uPaper;   // full-resolution paper: alpha is its tooth
uniform sampler2D uBefore;  // the wet layer as it was when this stroke began
out vec4 o;
${NOISE}
vec2 uvOf(vec2 p) { return vec2(p.x / ${UNITS.W}.0, 1.0 - p.y / ${UNITS.H}.0); }
// distance from the capsule's spine, and how far along the bristle's path this point is
vec2 capsule() {
  vec2 ab = vAB.zw - vAB.xy;
  float l2 = max(dot(ab, ab), 1e-6);
  float t = clamp(dot(vP - vAB.xy, ab) / l2, 0.0, 1.0);
  return vec2(length(vP - (vAB.xy + ab * t)), vRD.y + t * sqrt(l2));
}
// where a brush that can't cover the paper still leaves ink: on the tooth's peaks, in streaks
// that run along the stroke
float catches(float along, float tooth) {
  float n = 0.5 * tooth + 0.5 * n1(vInk.w * 91.7 + along / 9.0);
  float th = (1.0 - vInk.y) * 1.15 - 0.15;
  return smoothstep(th - 0.09, th + 0.09, n);
}
// the edge of a mark isn't a ruled line: it wavers with the hand and wicks into the fibres
float ragged(vec2 p) { return 0.65 * vnoise(p / 2.6) + 0.35 * vnoise(p / 1.1 + 9.0); }
// which pigment: 0 black ink, 1 indigo, 2 gold, 3 cinnabar; and whether the mark is a pool
float chan() { return floor(vRD.w * 0.5 + 0.01); }
bool isPool() { return vRD.w - 2.0 * chan() > 0.5; }
vec4 chanMask() { float c = chan(); return vec4(step(c, 0.5), step(0.5, c) * step(c, 1.5), step(1.5, c) * step(c, 2.5), step(2.5, c)); }
// how much of the ink stays crisp where it lands: thick ink more than watery; less on wet paper,
// where it diffuses (colour much less so: it stays where it lands); none where the brush stands
// still and floods the paper
float crispShare(vec2 uv) {
  float wet = texture(uBefore, uv).r;
  return vRD.z * mix(1.0, chan() > 0.5 ? 0.8 : 0.18, smoothstep(0.04, 0.45, wet)) * (1.0 - smoothstep(1.4, 4.0, vInk.z));
}`;

// the crisp body, into the stroke's own layer, in its pigment's channel (blended with MAX, so a
// lingering brush doesn't bead where its marks overlap). Black ink held still floods the paper and
// leaves no crisp body; colour held still leaves a soft blot that grows with the pool.
const CRISP_FS = `#version 300 es
precision highp float;
${MARK_COMMON}
void main() {
  vec2 c = capsule();
  vec2 uv = uvOf(vP);
  float tooth = texture(uPaper, uv).a;
  float v;
  if (isPool()) {
    if (chan() < 0.5) discard;
    vec2 q = vP - vAB.xy;
    float r = vRD.x;
    float wob = 0.82 + 0.3 * vnoise(q / max(r * 0.3, 1.0) + vInk.w * 13.0) + 0.08 * vnoise(q / 2.0);
    v = vInk.x * 0.82 * (1.0 - smoothstep(r * wob * 0.45, r * wob, c.x)) * (0.85 + 0.3 * tooth);
  } else {
    float r = vRD.x * (0.8 + 0.45 * ragged(vP));
    float body = 1.0 - smoothstep(r * 0.4, r * 1.1, c.x);
    v = vInk.x * body * catches(c.y, tooth) * crispShare(uv) * (0.9 + 0.2 * tooth);
    // colour wicks a little way into the fibres around the line: a faint soft edge
    if (chan() > 0.5) v = max(v, vInk.x * crispShare(uv) * 0.16 * (1.0 - smoothstep(r * 1.0, r * 2.6, c.x)) * (0.6 + 0.8 * ragged(vP * 0.5)));
  }
  o = chanMask() * v;
}`;

// water and the rest of the ink, into the wet layer (added). A pool is one big round mark that
// grows while the brush is held still; its edge is uneven, as the paper takes the water unevenly.
const WET_FS = `#version 300 es
precision highp float;
uniform float uSimPx;     // paper units per wet-layer pixel
uniform float uWater;     // gain
uniform float uConc;      // how much ink the water carries, against the ink's darkness
${MARK_COMMON}
void main() {
  vec2 c = capsule();
  float r = vRD.x;
  float body;
  if (isPool()) {
    // a pool's growing edge: wet the ring between last frame's edge and this one's, and keep
    // the inside topped up a little against the drying
    vec2 q = vP - vAB.xy;
    float wob = 0.82 + 0.3 * vnoise(q / max(r * 0.3, 1.0) + vInk.w * 13.0) + 0.08 * vnoise(q / 2.0);
    float inside = 1.0 - smoothstep(r * wob * 0.9, r * wob, c.x);
    float before = vRD.y > 0.0 ? 1.0 - smoothstep(vRD.y * wob * 0.9, vRD.y * wob, c.x) : 0.0;
    body = max(inside - before, 0.0) * 0.55 + inside * 0.012;
  } else {
    float rw = max(r * 1.4, uSimPx * 1.25);
    body = (1.0 - smoothstep(rw * 0.5, rw, c.x)) * (r * 1.4 / rw);
  }
  vec2 uv = uvOf(vP);
  float tooth = texture(uPaper, uv).a;
  float hit = isPool() ? 1.0 : mix(0.35, 1.0, catches(c.y, tooth));
  float water = vInk.z * uWater * body * hit;
  // the wet layer carries black ink only: colour wets the paper, and stays where it lands
  float ink = chan() > 0.5 ? 0.0 : water * vInk.x * (1.0 - crispShare(uv)) * uConc;
  o = vec4(water, ink, 0.0, 0.0);
}`;

// one step of the wet layer. r: water, g: ink carried in it, b: ink settled into the paper
const FLOW_FS = `#version 300 es
precision highp float;
uniform sampler2D uS;
uniform sampler2D uSimPaper;
uniform vec2 uTexel;
uniform float uK;        // how fast water moves, per step (at most 0.24)
uniform float uCarry;    // how much of the ink moves with the water through wet paper
uniform float uFront;    // ...and into dry paper, where the fibres hold it back
uniform float uEvap;     // water lost per step
uniform float uEdgeEvap; // how much faster an edge dries
uniform float uSettle;   // ink settling per step, while wet
out vec4 o;
const float WET = 0.003;
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec4 c = texture(uS, fc * uTexel);
  vec2 pp = texture(uSimPaper, fc * uTexel).rg;
  float cap = 0.2 + 0.6 * pp.r;
  float phi = c.r - cap;
  float conc = c.g / max(c.r, 1e-4);
  float dw = 0.0, ds = 0.0, dry = 0.0;
  vec2 D[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
  for (int i = 0; i < 4; i++) {
    vec2 uvn = (fc + D[i]) * uTexel;
    vec4 n = texture(uS, uvn);
    vec2 pn = texture(uSimPaper, uvn).rg;
    float phin = n.r - (0.2 + 0.6 * pn.r);
    float k = uK * min(pp.g, pn.g);
    // between wet spots water evens out; into dry paper only what's past full goes
    bool bothWet = c.r > WET && n.r > WET;
    float q = bothWet ? k * (phin - phi) : k * (max(phin, 0.0) - max(phi, 0.0));
    dw += q;
    // ink travels with standing water; paper that's only damp holds it in its fibres
    float capn = 0.2 + 0.6 * pn.r;
    float wsrc = q > 0.0 ? n.r : c.r, capsrc = q > 0.0 ? capn : cap;
    float carry = bothWet ? mix(uFront, uCarry, smoothstep(capsrc, capsrc * 2.2, wsrc)) : uFront;
    ds += q * (q > 0.0 ? n.g / max(n.r, 1e-4) : conc) * carry;
    dry += n.r > WET ? 0.0 : 1.0;
  }
  float w = max(c.r + dw, 0.0);
  float s = max(c.g + ds, 0.0);
  // the paper drinks and the air dries; an edge, with dry paper beside it, dries fastest
  float edge = c.r > WET ? dry : 0.0;
  // a thin film, spread over paper that isn't full, soaks in faster still
  float thin = 1.0 - smoothstep(0.0, cap, w);
  float wl = max(w - uEvap * (1.0 + uEdgeEvap * edge) * (1.0 + 1.5 * thin), 0.0);
  float settle = s * clamp(uSettle * (1.0 + 4.0 * (1.0 - smoothstep(0.0, 0.25, wl))), 0.0, 1.0);
  if (wl <= WET) { settle = s; wl = 0.0; }
  o = vec4(wl, s - settle, c.b + settle, 0.0);
}`;

// the finished stroke joins the painting, each pigment in its channel: layer = layer + stroke * (1 - layer)
const COMMIT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uStroke;
out vec4 o;
void main() { o = texture(uStroke, vUv); }`;

// what you see. uView 0: the painting; 1: the paper alone, as it looks under the ink; 2: the ink
// alone, as the share of the light it lets through (the painting is the paper times this), so a
// stroke can be cut out of the painting and laid on other paper; 3: the ink as light, with no paper,
// for drawing straight into their world: where ink is, light of its own colour (black ink a soft
// white, the dream inks their own), and where none is, nothing, so the world shows through
// The glow round the ink laid down, drawn as light: each ink's own colour, from the ink on two rings
// about each point; made small (a quarter of the canvas each way) and only when the ink laid down
// changes, so a frame pays one look at it
const HALO_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLayer;
uniform float uInk;
uniform float uGlow; // its reach, in canvas pixels
uniform vec2 uSize;  // the canvas
out vec4 o;
const vec3 INDIGO = vec3(2.06, 1.46, 0.65);
const vec3 GOLD = vec3(0.16, 0.5, 2.06);
const vec3 CINNABAR = vec3(0.29, 1.93, 2.39);
const vec2 RING[6] = vec2[6](vec2(1.0, 0.0), vec2(0.5, 0.866), vec2(-0.5, 0.866), vec2(-1.0, 0.0), vec2(-0.5, -0.866), vec2(0.5, -0.866));
vec4 litAt(vec2 uv) {
  vec4 c = texture(uLayer, uv);
  vec3 t = clamp(exp(-(uInk * c.r * vec3(1.0, 0.955, 0.86) + c.g * INDIGO + c.b * GOLD + c.a * CINNABAR)), 0.0, 1.0);
  float hi = max(t.r, max(t.g, t.b)), lo = min(t.r, min(t.g, t.b));
  float chroma = clamp((hi - lo) / (hi + 0.05) * 1.25, 0.0, 1.0);
  return vec4(mix(vec3(1.0, 0.98, 0.94), t / max(hi, 0.001), chroma), clamp((1.0 - lo) * 1.08, 0.0, 1.0));
}
void main() {
  vec3 gc = vec3(0.0);
  float gw = 0.0;
  vec4 n = litAt(vUv);
  gc += n.rgb * n.a; gw += n.a;
  for (int i = 0; i < 6; i++) {
    vec2 d = RING[i] * uGlow / uSize;
    n = litAt(vUv + d);
    gc += n.rgb * n.a; gw += n.a;
    n = litAt(vUv + vec2(d.x * 0.866 - d.y * 0.5, d.x * 0.5 + d.y * 0.866) * 2.2);
    gc += n.rgb * n.a * 0.55; gw += n.a * 0.55;
  }
  float h = clamp(gw / 10.3, 0.0, 1.0);
  o = vec4(gw > 0.001 ? gc / gw * h : vec3(0.0), h);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPaper;
uniform sampler2D uLayer;
uniform sampler2D uStroke;
uniform sampler2D uS;
uniform sampler2D uDrink;
uniform float uInk;      // how dark a unit of ink is
uniform float uWetInk;   // the wet layer's ink, against the crisp layer's
uniform int uView;
uniform vec2 uSize;
uniform sampler2D uHole; // as light, where it is hidden: a part lifted out of it, moving on its own
uniform int uHoled;
uniform vec4 uFocus;  // the marks a question or a line is about, in the canvas's 0..1 (see setFocus)
uniform float uFocusK;
uniform sampler2D uGlowT; // as light, the glow round the ink laid down (HALO_FS), premultiplied
out vec4 o;
${NOISE}
// how much of each colour a unit of each dream ink takes from the light (its optical density)
const vec3 INDIGO = vec3(2.06, 1.46, 0.65);
const vec3 GOLD = vec3(0.16, 0.5, 2.06);
const vec3 CINNABAR = vec3(0.29, 1.93, 2.39);
// ink as light: the colour it lets through, made bright (black ink a warm near-white), and how much
// of the light it stops
vec4 lit(vec3 t) {
  t = clamp(t, 0.0, 1.0);
  float hi = max(t.r, max(t.g, t.b)), lo = min(t.r, min(t.g, t.b));
  float chroma = clamp((hi - lo) / (hi + 0.05) * 1.25, 0.0, 1.0);
  return vec4(mix(vec3(1.0, 0.98, 0.94), t / max(hi, 0.001), chroma), clamp((1.0 - lo) * 1.08, 0.0, 1.0));
}
void main() {
  vec4 paper = texture(uPaper, vUv);
  vec4 layer = texture(uLayer, vUv);
  vec4 stroke = texture(uStroke, vUv);
  vec4 crisp = layer + stroke * (1.0 - layer);
  vec4 s = texture(uS, vUv);
  // wet ink goes where the paper drinks it: cloudy, fibrous; and settles in its hollows
  float drink = texture(uDrink, vUv).r;
  float wet = (s.b + s.g) * uWetInk * mix(1.18, 0.82, paper.a) * mix(0.5, 1.4, drink);
  float dens = crisp.r + wet;
  // cool pine-soot ink: dilute it greys toward blue, dense it's a deep blue-black; the dream inks
  // over and under it, each its own colour
  vec3 od = uInk * dens * vec3(1.0, 0.955, 0.86) + crisp.g * INDIGO + crisp.b * GOLD + crisp.a * CINNABAR;
  vec3 through = exp(-od);
  // gold catches the light: fine bright flecks where it lies thick
  float fleck = smoothstep(0.82, 0.97, hash(floor(vUv * uSize / 2.0) + 3.7)) * smoothstep(0.25, 0.7, crisp.b);
  through = mix(through, vec3(1.08, 0.97, 0.7), 0.55 * fleck);
  if (uView == 2) { o = vec4(min(through, vec3(1.0)), 1.0); return; }
  if (uView == 3) {
    vec4 L = lit(through);
    vec3 hue = L.rgb;
    float a = L.a;
    a *= 1.0 - 0.25 * smoothstep(0.02, 0.6, s.r) * (1.0 - a);
    // light glows: a soft halo of each ink's own colour round it (a line of it is a streak of light,
    // not a hard-edged thing with a point)
    vec4 G = texture(uGlowT, vUv);
    float h = G.a;
    float ha = smoothstep(0.0, 0.75, h) * 0.58 * (1.0 - a);
    vec3 gh = h > 0.001 ? G.rgb / h : hue;
    if (uHoled == 1) { float k = 1.0 - texture(uHole, vUv).a; a *= k; ha *= k; }
    // the rest dims a little round what is asked about or told (the paper had its spotlight)
    if (uFocusK > 0.0) {
      vec2 d = max(max(uFocus.xy - vUv, vUv - uFocus.zw), 0.0) * vec2(uSize.x / uSize.y, 1.0);
      float k = 1.0 - uFocusK * smoothstep(0.0, 0.09, length(d));
      a *= k; ha *= k;
    }
    // no edge to their world: light reaching the sheet's side fades there, not cut off square
    float e = smoothstep(0.0, 0.03, vUv.x) * smoothstep(0.0, 0.03, 1.0 - vUv.x) * smoothstep(0.0, 0.045, vUv.y) * smoothstep(0.0, 0.045, 1.0 - vUv.y);
    a *= e; ha *= e;
    o = vec4(hue * a + gh * ha, a + ha);
    return;
  }
  vec3 col = uView == 1 ? paper.rgb : paper.rgb * through;
  col *= 1.0 - 0.075 * smoothstep(0.02, 0.6, s.r);
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.07 * dot(q, q) * 2.0;
  o = vec4(col, 1.0);
}`;

export const INK_TUNING = {
  simScale: 0.5, // wet layer resolution, against the screen's
  simHz: 180, // wet-layer steps per second
  k: 0.22, carry: 0.85, front: 0.22, evap: 0.16, edgeEvap: 1.4, settle: 0.004,
  water: 1.5, conc: 0.7,
  ink: 3.2, wetInk: 1.0,
  undo: 6, // strokes that can be washed out
  wetFor: 12, // seconds after the last mark that the wet layer keeps running
  margin: 56, // units around fresh marks where water may still be moving
};

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
  return sh;
}
function program(gl, vs, fs, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program: ${gl.getProgramInfoLog(p)}`);
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

// A seeded generator, so the paper is the same sheet every time.
// A canvas as a JPEG data URL, made away from the page's thread where the browser can (toBlob)
function jpegOf(c, quality) {
  if (!c.toBlob) return Promise.resolve(c.toDataURL('image/jpeg', quality));
  return new Promise((ok, no) => c.toBlob((b) => {
    if (!b) return ok(c.toDataURL('image/jpeg', quality));
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => no(r.error);
    r.readAsDataURL(b);
  }, 'image/jpeg', quality));
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The fibres, drawn once on a 2D canvas: pale ones in red, dark flecks of bark in green, and the
// long fibres that carry water fastest in blue.
function drawFibres(w, h, seed) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  const rand = rng(seed);
  const k = w / 1664;
  const fibre = (color, alpha, lenMin, lenMax, width) => {
    const x = rand() * w, y = rand() * h, a = rand() * Math.PI * 2;
    const len = (lenMin + rand() * (lenMax - lenMin)) * k;
    const bend = (rand() - 0.5) * len * 0.5;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    const mx = (x + x2) / 2 - Math.sin(a) * bend, my = (y + y2) / 2 + Math.cos(a) * bend;
    g.strokeStyle = `rgba(${color},${alpha})`;
    g.lineWidth = width * k;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, x2, y2); g.stroke();
  };
  for (let i = 0; i < 2600; i++) fibre('255,0,0', 0.12 + rand() * 0.3, 14, 80, 0.6 + rand() * 0.9);
  for (let i = 0; i < 380; i++) fibre('0,0,255', 0.25 + rand() * 0.35, 60, 190, 0.8 + rand() * 1.2);
  for (let i = 0; i < 220; i++) fibre('0,255,0', 0.2 + rand() * 0.4, 3, 16, 0.6 + rand() * 0.9);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(0,255,0,${0.3 + rand() * 0.4})`;
    g.beginPath(); g.arc(rand() * w, rand() * h, (0.5 + rand() * 1.1) * k, 0, Math.PI * 2); g.fill();
  }
  return c;
}

// Returns the ink, or null when this screen can't run it (then the page falls back to 2D).
export function createInkGL(canvas, { seed = 3, tuning = {}, clock = () => performance.now() / 1000, lazy = false } = {}) {
  const T = { ...INK_TUNING, ...tuning };
  // wet steps a second: fewer on a TV that can't keep up (quality.js)
  let hz = T.simHz;
  // its own alpha, so that drawn as light (view 3) the world behind it shows through; drawn as a
  // painting it is opaque
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;

  const W = canvas.width, H = canvas.height;
  const SW = Math.round(W * T.simScale), SH = Math.round(H * T.simScale);
  const simPx = UNITS.W / SW;
  const toPx = W / UNITS.W, toSim = SW / UNITS.W;

  let progs;
  try {
    progs = {
      paper: program(gl, QUAD_VS, PAPER_FS, ['aPos']),
      drink: program(gl, QUAD_VS, DRINK_FS, ['aPos']),
      simPaper: program(gl, QUAD_VS, SIMPAPER_FS, ['aPos']),
      crisp: program(gl, MARK_VS, CRISP_FS, ['aPos', 'aAB', 'aInk', 'aRD']),
      wet: program(gl, MARK_VS, WET_FS, ['aPos', 'aAB', 'aInk', 'aRD']),
      flow: program(gl, QUAD_VS, FLOW_FS, ['aPos']),
      commit: program(gl, QUAD_VS, COMMIT_FS, ['aPos']),
      composite: program(gl, QUAD_VS, COMPOSITE_FS, ['aPos']),
      halo: program(gl, QUAD_VS, HALO_FS, ['aPos']),
    };
  } catch (err) {
    console.warn(`WebGL ink unavailable: ${err.message}`);
    return null;
  }

  // ---------------------------------------------------------------- textures and targets
  // whether a target of a size and format can be drawn into: asked once each, since asking waits
  // for the GPU to finish all it has been given (the paper before a stroke is kept in new targets
  // as the first strokes begin, and a TV stick would stop for it as the brush touches)
  const complete = new Map();
  function texture(w, h, internal, format, type, filter = gl.LINEAR) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const kind = `${w}x${h} ${internal}`;
    if (!complete.has(kind)) complete.set(kind, gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE);
    const ok = complete.get(kind);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t, fb, w, h, ok };
  }
  const full = (internal, format, type) => texture(W, H, internal, format, type);
  const sim = () => texture(SW, SH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);

  const paper = full(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  const drink = full(gl.R8, gl.RED, gl.UNSIGNED_BYTE);
  const simPaper = texture(SW, SH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  // a channel for each pigment: black ink, indigo, gold, cinnabar
  const layer = full(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  const stroke = full(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  const S = [sim(), sim()];
  let cur = 0; // S[cur] holds the wet layer now
  // the glow round the ink laid down, drawn as light (HALO_FS); made again when that ink changes
  const glowT = texture(Math.ceil(W / 4), Math.ceil(H / 4), gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  let glowStale = true;
  if (![paper, drink, simPaper, layer, stroke, glowT, ...S].every((x) => x.ok)) return null;
  const snaps = []; // { layer, S }, the paper before each of the last few strokes
  const spare = [];

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const FLOATS = 14; // per vertex: pos 2, ab 4, ink 4, rd 4
  const markBuf = gl.createBuffer();
  const markVao = gl.createVertexArray();
  gl.bindVertexArray(markVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, markBuf);
  [[0, 2, 0], [1, 4, 2], [2, 4, 6], [3, 4, 10]].forEach(([loc, size, off]) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, FLOATS * 4, off * 4);
  });
  gl.bindVertexArray(null);
  let markData = new Float32Array(64 * 6 * FLOATS);

  function target(tg, rect) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, tg ? tg.fb : null);
    gl.viewport(0, 0, tg ? tg.w : W, tg ? tg.h : H);
    if (rect) { gl.enable(gl.SCISSOR_TEST); gl.scissor(rect[0], rect[1], rect[2], rect[3]); } else gl.disable(gl.SCISSOR_TEST);
  }
  function bindTex(prog, name, unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex.t || tex);
    gl.uniform1i(prog.u[name], unit);
  }
  function drawQuad() { gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  function clear(tg) { target(tg); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  function copy(from, to) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to.fb);
    gl.disable(gl.SCISSOR_TEST);
    gl.blitFramebuffer(0, 0, from.w, from.h, 0, 0, to.w, to.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  // ---------------------------------------------------------------- the paper, once
  const fibTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, fibTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, drawFibres(W, H, seed));
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.disable(gl.BLEND);
  target(paper);
  gl.useProgram(progs.paper.p);
  bindTex(progs.paper, 'uFib', 0, fibTex);
  gl.uniform2f(progs.paper.u.uSize, W, H);
  gl.uniform1f(progs.paper.u.uSeed, seed);
  drawQuad();
  target(drink);
  gl.useProgram(progs.drink.p);
  bindTex(progs.drink, 'uFib', 0, fibTex);
  gl.uniform1f(progs.drink.u.uSeed, seed);
  drawQuad();
  target(simPaper);
  gl.useProgram(progs.simPaper.p);
  bindTex(progs.simPaper, 'uFib', 0, fibTex);
  gl.uniform1f(progs.simPaper.u.uSeed, seed);
  drawQuad();
  gl.deleteTexture(fibTex);
  [layer, stroke, ...S].forEach(clear);

  // ---------------------------------------------------------------- where things are changing
  // Areas (in paper units) with fresh marks, each with when it was last marked. The wet layer
  // runs over these, grown by how far water may yet move, until they have had time to dry.
  let areas = [];
  let open = null; // the area of the stroke being painted
  let dirty = null; // screen area to redraw this frame, in paper units
  let redrawAll = true;
  let simDebt = 0;
  const now = clock;
  const grow = (a, x0, y0, x1, y1) => {
    a.x0 = Math.min(a.x0, x0); a.y0 = Math.min(a.y0, y0); a.x1 = Math.max(a.x1, x1); a.y1 = Math.max(a.y1, y1);
  };
  const markDirty = (x0, y0, x1, y1) => { if (!dirty) dirty = { x0, y0, x1, y1 }; else grow(dirty, x0, y0, x1, y1); };
  function activeBox(t) {
    let box = null;
    const before = areas.length;
    areas = areas.filter((a) => a === open || t - a.t < T.wetFor);
    // an area has dried and drops out: from here on only part of the wet layer is stepped, so
    // both halves must agree on the rest
    if (areas.length < before) copy(S[cur], S[1 - cur]);
    for (const a of areas) {
      const m = T.margin;
      if (!box) box = { x0: a.x0 - m, y0: a.y0 - m, x1: a.x1 + m, y1: a.y1 + m };
      else grow(box, a.x0 - m, a.y0 - m, a.x1 + m, a.y1 + m);
    }
    return box;
  }
  // a box in paper units as a scissor rectangle in a target's pixels (y up)
  function rectOf(box, scale, w, h) {
    const x0 = Math.max(0, Math.floor(box.x0 * scale) - 1), x1 = Math.min(w, Math.ceil(box.x1 * scale) + 1);
    const y0 = Math.max(0, Math.floor((UNITS.H - box.y1) * scale) - 1), y1 = Math.min(h, Math.ceil((UNITS.H - box.y0) * scale) + 1);
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  }
  let sleeping = true;
  // the painting pulled apart (layers()), until anything on the paper changes; and the paper alone,
  // made once it is dry: dry, it is the same sheet every night. Each is read back from the GPU,
  // which a TV stick takes a while to do.
  let made = null, dryPaper = null;

  // ---------------------------------------------------------------- marks
  function upload(segs) {
    const need = segs.length * 6 * FLOATS;
    if (markData.length < need) markData = new Float32Array(need * 2);
    let k = 0;
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const s of segs) {
      // colour's soft edge reaches further than the line
      const pad = (s.pool ? s.r * 1.25 : Math.max(s.r * (s.ch ? 3.4 : 1.6), simPx * 1.25)) + 1.5;
      let dx = s.x1 - s.x0, dy = s.y1 - s.y0;
      const len = Math.hypot(dx, dy);
      if (len < 1e-4) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
      const nx = -dy, ny = dx;
      const ax = s.x0 - dx * pad, ay = s.y0 - dy * pad, bx = s.x1 + dx * pad, by = s.y1 + dy * pad;
      const corners = [[ax + nx * pad, ay + ny * pad], [bx + nx * pad, by + ny * pad], [ax - nx * pad, ay - ny * pad], [ax - nx * pad, ay - ny * pad], [bx + nx * pad, by + ny * pad], [bx - nx * pad, by - ny * pad]];
      for (const [px, py] of corners) {
        markData.set([px, py, s.x0, s.y0, s.x1, s.y1, s.pig, s.cover, s.wat, s.seed, s.r, s.d0 || 0, s.body ?? 0.8, (s.pool ? 1 : 0) + 2 * (s.ch || 0)], k);
        k += FLOATS;
      }
      grow(box, Math.min(s.x0, s.x1) - pad, Math.min(s.y0, s.y1) - pad, Math.max(s.x0, s.x1) + pad, Math.max(s.y0, s.y1) + pad);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, markBuf);
    gl.bufferData(gl.ARRAY_BUFFER, markData.subarray(0, k), gl.DYNAMIC_DRAW);
    return box;
  }
  function useMarkProgram(prog) {
    gl.useProgram(prog.p);
    bindTex(prog, 'uPaper', 0, paper);
    bindTex(prog, 'uBefore', 1, snaps.length ? snaps[snaps.length - 1].S : S[cur]);
  }

  // ---------------------------------------------------------------- the wet layer
  function flowSteps(n, box) {
    const rect = rectOf(box, toSim, SW, SH);
    if (!rect) return;
    const pr = progs.flow;
    gl.useProgram(pr.p);
    gl.disable(gl.BLEND);
    gl.uniform2f(pr.u.uTexel, 1 / SW, 1 / SH);
    gl.uniform1f(pr.u.uK, T.k);
    gl.uniform1f(pr.u.uCarry, T.carry);
    gl.uniform1f(pr.u.uFront, T.front);
    gl.uniform1f(pr.u.uEvap, T.evap / hz); // the same drying a second, however many steps
    gl.uniform1f(pr.u.uEdgeEvap, T.edgeEvap);
    gl.uniform1f(pr.u.uSettle, T.settle);
    bindTex(pr, 'uSimPaper', 1, simPaper);
    for (let i = 0; i < n; i++) {
      target(S[1 - cur], rect);
      bindTex(pr, 'uS', 0, S[cur]);
      drawQuad();
      cur = 1 - cur;
    }
  }

  // what the screen shows: the painting (0), or the ink as light (3)
  let shown = 0;
  function halo() {
    const pr = progs.halo;
    gl.useProgram(pr.p);
    gl.disable(gl.BLEND);
    target(glowT);
    bindTex(pr, 'uLayer', 0, layer);
    gl.uniform1f(pr.u.uInk, T.ink);
    gl.uniform1f(pr.u.uGlow, 7 * toPx);
    gl.uniform2f(pr.u.uSize, W, H);
    drawQuad();
    glowStale = false;
  }
  function composite(box, view = shown) {
    // as light, once the ink laid down has changed: its glow again, and everything it reaches
    if (view === 3 && glowStale) { halo(); box = null; }
    const rect = box ? rectOf(box, toPx, W, H) : null;
    if (box && !rect) return;
    const pr = progs.composite;
    gl.useProgram(pr.p);
    gl.disable(gl.BLEND);
    target(null, rect);
    bindTex(pr, 'uPaper', 0, paper);
    bindTex(pr, 'uLayer', 1, layer);
    bindTex(pr, 'uStroke', 2, stroke);
    bindTex(pr, 'uS', 3, S[cur]);
    bindTex(pr, 'uDrink', 4, drink);
    gl.uniform1f(pr.u.uInk, T.ink);
    gl.uniform1f(pr.u.uWetInk, T.wetInk);
    gl.uniform1i(pr.u.uView, view);
    gl.uniform2f(pr.u.uSize, W, H);
    bindTex(pr, 'uHole', 5, holeTex || paper);
    gl.uniform1i(pr.u.uHoled, holeTex ? 1 : 0);
    bindTex(pr, 'uGlowT', 6, glowT);
    gl.uniform4f(pr.u.uFocus, focus[0], focus[1], focus[2], focus[3]);
    gl.uniform1f(pr.u.uFocusK, focusK);
    drawQuad();
  }
  // what a question or a line is about (setFocus): [u0, v0, u1, v1], and how much the rest dims
  let focus = [0, 0, 1, 1], focusK = 0;
  // where the light is hidden (see setHoles)
  let holeTex = null;
  // `read` given the painting itself, whatever the screen shows; then the screen as it was
  function asPainting(read) {
    if (!shown) return read();
    composite(null, 0);
    try { return read(); } finally { composite(null); }
  }
  // `read` given the ink as light, as it is drawn into their world (the light view), whatever the
  // screen shows; then the screen as it was
  function asLight(read) {
    if (shown === 3 && !focusK) return read();
    const k = focusK;
    focusK = 0;
    composite(null, 3);
    try { return read(); } finally { focusK = k; composite(null); }
  }
  // a copy of the screen as it is now, on a 2D canvas
  function grab() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }

  // the screen's canvas drawn `width` wide on a 2D canvas, over `night` if given
  function sized(width, night) {
    const c = document.createElement('canvas');
    c.width = width; c.height = Math.round((width * H) / W);
    const g = c.getContext('2d');
    if (night) { g.fillStyle = night; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(canvas, 0, 0, c.width, c.height);
    return c;
  }

  function takeSnap() {
    const s = spare.pop() || { layer: full(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE), S: sim() };
    copy(layer, s.layer);
    copy(S[cur], s.S);
    snaps.push(s);
    while (snaps.length > T.undo) spare.push(snaps.shift());
  }

  const stats = { steps: 0, frames: 0, ms: 0 };

  const api = {
    kind: 'webgl2',
    get wet() { return !sleeping; },
    stats,
    // the share of the wet-paper steps to take, 0.25 to 1
    setQuality(share) { hz = T.simHz * Math.max(0.25, Math.min(1, Number(share) || 1)); },
    get quality() { return hz / T.simHz; },
    // a stroke begins: keep the paper as it is, for undo
    begin() {
      made = null;
      takeSnap();
      clear(stroke);
      open = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, t: now() };
      areas.push(open);
    },
    // this frame's bristle marks
    marks(segs) {
      if (!segs.length) return;
      made = null;
      if (!open) api.begin();
      const box = upload(segs);
      grow(open, box.x0, box.y0, box.x1, box.y1);
      open.t = now();
      if (sleeping) { sleeping = false; }
      gl.bindVertexArray(markVao);
      gl.enable(gl.BLEND);
      // crisp, into the stroke's layer
      target(stroke);
      gl.blendEquation(gl.MAX);
      gl.blendFunc(gl.ONE, gl.ONE);
      useMarkProgram(progs.crisp);
      gl.drawArrays(gl.TRIANGLES, 0, segs.length * 6);
      // water and ink, into the wet layer
      target(S[cur]);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      useMarkProgram(progs.wet);
      gl.uniform1f(progs.wet.u.uSimPx, simPx);
      gl.uniform1f(progs.wet.u.uWater, T.water);
      gl.uniform1f(progs.wet.u.uConc, T.conc);
      gl.drawArrays(gl.TRIANGLES, 0, segs.length * 6);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
      markDirty(box.x0, box.y0, box.x1, box.y1);
    },
    // the stroke is finished: it joins the painting
    end() {
      if (!open) return;
      made = null;
      const pr = progs.commit;
      gl.useProgram(pr.p);
      target(layer);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE);
      bindTex(pr, 'uStroke', 0, stroke);
      drawQuad();
      gl.disable(gl.BLEND);
      clear(stroke);
      open = null;
      glowStale = true;
      if (shown === 3) markDirty(0, 0, 1, 1); // so it glows as soon as it is laid down
    },
    // wash out the last stroke; false if it's too far back to wash out
    undo() {
      if (open) api.end();
      const s = snaps.pop();
      if (!s) return false;
      made = null;
      copy(s.layer, layer);
      copy(s.S, S[cur]);
      copy(s.S, S[1 - cur]);
      spare.push(s);
      redrawAll = true; glowStale = true;
      return true;
    },
    clear() {
      made = null;
      [layer, stroke, ...S].forEach(clear);
      spare.push(...snaps.splice(0));
      areas = []; open = null; redrawAll = true; sleeping = true; glowStale = true;
    },
    // advance the wet layer and redraw what changed; call once a frame
    frame(dt) {
      const t0 = performance.now();
      const t = now();
      const box = activeBox(t);
      if (box) {
        sleeping = false;
        made = null;
        simDebt = Math.min(simDebt + dt * hz, 4);
        const n = Math.floor(simDebt);
        simDebt -= n;
        if (n) { flowSteps(n, box); stats.steps += n; }
        markDirty(box.x0, box.y0, box.x1, box.y1);
      } else if (!sleeping) {
        // dry at last: make both halves of the wet layer agree, and rest
        copy(S[cur], S[1 - cur]);
        sleeping = true;
        made = null;
      }
      if (lazy) { /* the caller redraws */ }
      else if (redrawAll) { composite(null); redrawAll = false; dirty = null; }
      else if (dirty) { composite(dirty); dirty = null; }
      stats.frames++;
      stats.ms = stats.ms * 0.95 + (performance.now() - t0) * 0.05;
    },
    // draw everything now
    redraw() { composite(null); redrawAll = false; dirty = null; },
    // The painting pulled apart, at the screen's size: the `painting`; the `paper` alone, as it
    // looks under the ink; the `ink` alone, as the share of the light it lets through. The painting
    // is the paper times the ink, so a stroke cut out of `ink` and multiplied onto paper is that
    // stroke (cutout.js).
    // The same picture each time, until the paper changes: whoever is given it only reads it.
    layers() {
      if (made) return made;
      composite(null, 1);
      const paperOnly = grab();
      composite(null, 2);
      const inkOnly = grab();
      composite(null, 0);
      const painting = grab();
      if (shown) composite(null);
      redrawAll = false; dirty = null;
      return (made = { painting, paper: paperOnly, ink: inkOnly });
    },
    // the paper alone, as in layers(), without the rest
    paper() {
      if (sleeping && dryPaper) return dryPaper;
      composite(null, 1);
      const c = grab();
      composite(null);
      redrawAll = false; dirty = null;
      if (sleeping) dryPaper = c;
      return c;
    },
    // the painting as a JPEG, `width` pixels wide, for the guide to look at; or, given `night` (a
    // colour), the ink as light on that night, as they see it drawn into their world
    snapshot(width = 768, quality = 0.82, { night = null } = {}) {
      return (night ? asLight : asPainting)(() => sized(width, night).toDataURL('image/jpeg', quality));
    },
    // the same, taken now and made a JPEG away from the page's thread: a promise
    snapshotLater(width = 768, quality = 0.82, { night = null } = {}) {
      return jpegOf((night ? asLight : asPainting)(() => sized(width, night)), quality);
    },
    // what the screen shows: the ink as light, with no paper (drawing straight into their world), or
    // the painting
    setLight(on) {
      const v = on ? 3 : 0;
      if (v === shown) return;
      shown = v;
      composite(null);
      redrawAll = false; dirty = null;
    },
    get light() { return shown === 3; },
    // In the light view, dim the rest a little round `box` (paper units, 1600 by 1000, y down), the
    // marks a question or a line is about; null for all of it alike.
    setFocus(box) {
      const k = box ? 0.62 : 0;
      const pad = 40, f = box ? [(box[0] - pad) / 1600, 1 - (box[3] + pad) / 1000, (box[2] + pad) / 1600, 1 - (box[1] - pad) / 1000] : [0, 0, 1, 1];
      if (k === focusK && f.every((v, i) => Math.abs(v - focus[i]) < 1e-4)) return;
      focus = f; focusK = k;
      if (shown === 3) { composite(null); redrawAll = false; dirty = null; }
    },
    get focused() { return focusK > 0 ? focus.slice() : null; },
    // Hide the light where parts of it have lifted out to move on their own (a telling): `mask`, a
    // canvas the shape of the sheet, opaque where hidden; null shows all of it again.
    setHoles(mask) {
      if (!mask) {
        if (!holeTex) return;
        gl.deleteTexture(holeTex.t); holeTex = null;
      } else {
        if (!holeTex) {
          const t = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          holeTex = { t };
        }
        gl.bindTexture(gl.TEXTURE_2D, holeTex.t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      }
      if (shown === 3) composite(null);
    },
    // the wet layer at a point: [water, ink carried, ink settled], for tuning
    peek(x, y) {
      const out = new Float32Array(4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, S[cur].fb);
      gl.readPixels(Math.floor(x * toSim), Math.floor(SH - y * toSim), 1, 1, gl.RGBA, gl.FLOAT, out);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return [...out.slice(0, 3)].map((v) => Math.round(v * 1000) / 1000);
    },
    peekPaper(x, y) {
      const out = new Uint8Array(4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, simPaper.fb);
      gl.readPixels(Math.floor(x * toSim), Math.floor(SH - y * toSim), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return [out[0] / 255, out[1] / 255];
    },
    // the painting's colour here, [r, g, b] 0 to 255, for tests: averaged over a small square
    colorAt(x, y, r = 2) {
      composite(null, 0);
      const px = Math.round(x * toPx), py = Math.round(H - y * toPx), n = Math.max(1, Math.round(r * toPx));
      const out = new Uint8Array(4 * (2 * n + 1) * (2 * n + 1));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(px - n, py - n, 2 * n + 1, 2 * n + 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      const sum = [0, 0, 0];
      for (let i = 0; i < out.length; i += 4) { sum[0] += out[i]; sum[1] += out[i + 1]; sum[2] += out[i + 2]; }
      if (shown) composite(null);
      return sum.map((v) => Math.round(v / (out.length / 4)));
    },
    // how much ink is on the paper here (0 to about 1.5), for tests: averaged over a small square
    inkAt(x, y, r = 2) {
      composite(null, 0);
      const px = Math.round(x * toPx), py = Math.round(H - y * toPx), n = Math.max(1, Math.round(r * toPx));
      const out = new Uint8Array(4 * (2 * n + 1) * (2 * n + 1));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(px - n, py - n, 2 * n + 1, 2 * n + 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      let sum = 0;
      for (let i = 0; i < out.length; i += 4) sum += out[i];
      if (shown) composite(null);
      return 1 - sum / (out.length / 4) / 255 / 0.957;
    },
  };
  composite(null);
  return api;
}
