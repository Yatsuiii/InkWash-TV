// Light, on the GPU. At night their ink is light (night.js): each pixel of ink a light of its
// colour, as strong as the ink was dark, with a glow round it. Made with canvas blurs, a TV stick
// spent seconds on it and stuttered drawing it; here it is a few shader passes, and a whole world
// of it is one canvas, redrawn each frame from a few dozen quads, added up as light adds up.
//
// One WebGL2 context for the page (the ink has its own), on one canvas that is lent to whichever
// view shows the night (their world, or stepping inside), and used out of sight to make a painting
// at night as a picture. Its textures keep the convention of a canvas: the first row is the top.
import { LIGHTS } from './night.js';

const VS_PASS = `#version 300 es
layout(location=0) in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// ink to light: `ink` is white where there is none (or a painting, divided by its `paper`); only
// where `mask` is (in the source's rectangle), or where it is not (`invert`)
const FS_LIGHT = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D ink, paper, mask;
uniform int divide, masked, invert;
uniform vec4 rect, src;
uniform float up;
uniform vec3 moonC, moonG, goldC, goldG, indigoC, indigoG, redC, redG;
layout(location=0) out vec4 core;
layout(location=1) out vec4 glow;
void main() {
  core = vec4(0.0); glow = vec4(0.0);
  vec2 q = (uv - rect.xy) / (rect.zw - rect.xy);
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return;
  vec2 s = mix(src.xy, src.zw, q);
  vec3 t = texture(ink, s).rgb;
  if (divide == 1) t = t / max(texture(paper, s).rgb, vec3(0.02));
  t = min(vec3(1.0), t * up);
  if (masked == 1) { float m = texture(mask, q).r; t = mix(vec3(1.0), t, invert == 1 ? 1.0 - m : m); }
  float amount = 1.0 - (t.r + t.g + t.b) / 3.0;
  if (amount < 0.035) return;
  float spread = max(max(t.r, t.g), t.b) - min(min(t.r, t.g), t.b);
  vec3 c, g; float a;
  if (spread < 0.12) { c = moonC; g = moonG; a = clamp(0.88 * pow(amount * 1.2, 0.9), 0.0, 0.88); }
  else {
    a = clamp(amount * 1.8, 0.0, 1.0);
    if (t.b > t.r && t.b > t.g) { c = indigoC; g = indigoG; }
    else if (t.r > t.g * 1.35 && t.r > t.b * 1.35) { c = redC; g = redG; }
    else { c = goldC; g = goldG; }
  }
  core = vec4(c * a, a);
  float ga = min(1.0, a * 1.6);
  glow = vec4(g * ga, ga);
}`;

// ink standing in a place in daylight (scene.js materialOf): their own ink as it lies on the paper
// (`keep`: black as black, a wash a thin veil of it, a coloured ink its own colour, dry streaks and
// pools as they are); or else each ink one solid colour. And how much of it there is, to blur into
// its height and its shadow
const FS_PIGMENT = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D ink, paper, mask;
uniform int divide, masked, invert, keep;
uniform vec4 rect, src;
uniform float up;
uniform vec3 base, gold, indigo, red;
layout(location=0) out vec4 core;
layout(location=1) out vec4 amount;
void main() {
  core = vec4(0.0); amount = vec4(0.0);
  vec2 q = (uv - rect.xy) / (rect.zw - rect.xy);
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return;
  vec2 s = mix(src.xy, src.zw, q);
  vec3 t = texture(ink, s).rgb;
  if (divide == 1) t = t / max(texture(paper, s).rgb, vec3(0.02));
  t = min(vec3(1.0), t * up);
  if (masked == 1) { float m = texture(mask, q).r; t = mix(vec3(1.0), t, invert == 1 ? 1.0 - m : m); }
  float k = 1.0 - (t.r + t.g + t.b) / 3.0;
  if (k < 0.035) return;
  float spread = max(max(t.r, t.g), t.b) - min(min(t.r, t.g), t.b);
  vec3 c = base;
  float a = clamp(k * 2.4, 0.0, 1.0);
  if (keep == 1) {
    if (spread < 0.12) { c = vec3(0.055, 0.055, 0.07); a = clamp(k * 1.55, 0.0, 1.0); }
    else { c = clamp(t / max(max(t.r, t.g), max(t.b, 0.001)) * 0.82, 0.0, 1.0); a = clamp(k * 2.2, 0.0, 1.0); }
  } else if (spread >= 0.12) {
    if (t.b > t.r && t.b > t.g) c = indigo;
    else if (t.r > t.g * 1.35 && t.r > t.b * 1.35) c = red;
    else c = gold;
  }
  core = vec4(c * a, a);
  amount = vec4(a);
}`;

// the toy lit: its height the blurred amount of it, so a stroke is rounded like clay; lit by the
// sun with a shine and a rim, and darker at its edges, as a drawn toy is
const FS_TOY = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D c0, c1;
uniform vec2 texel;
uniform vec3 sun, sunC;
uniform float ambient, gloss, rim, outline, bump;
out vec4 o;
void main() {
  vec4 c = texture(c0, uv);
  if (c.a < 0.004) { o = vec4(0.0); return; }
  vec3 base = c.rgb / c.a;
  float h = texture(c1, uv).a;
  float hx = texture(c1, uv + vec2(texel.x, 0.0)).a - texture(c1, uv - vec2(texel.x, 0.0)).a;
  float hy = texture(c1, uv + vec2(0.0, texel.y)).a - texture(c1, uv - vec2(0.0, texel.y)).a;
  vec3 n = normalize(vec3(-hx * bump, -hy * bump, 1.0));
  float diff = max(dot(n, sun), 0.0);
  vec3 hv = normalize(sun + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 36.0) * gloss;
  float edge = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0) * rim;
  float inner = smoothstep(0.06, 0.45, h);
  vec3 col = base * (ambient + diff * sunC * (1.0 - ambient * 0.45)) * mix(1.0 - outline, 1.0, inner) + spec * sunC + edge * sunC;
  o = vec4(min(col, vec3(1.0)) * c.a, c.a);
}`;

// its shadow: the wide blur of it, in the ground's shadow colour
const FS_SHADOW = `#version 300 es
precision mediump float;
in vec2 uv; uniform sampler2D c0; uniform vec3 shade; uniform float k; out vec4 o;
void main() { float a = min(1.0, texture(c0, uv).a * k); o = vec4(shade * a, a); }`;

// half the size: each pixel the mean of four
const FS_COPY = `#version 300 es
precision mediump float;
in vec2 uv; uniform sampler2D src; out vec4 o;
void main() { o = texture(src, uv); }`;

// a gaussian, one way
const FS_BLUR = `#version 300 es
precision mediump float;
in vec2 uv; uniform sampler2D src; uniform vec2 dir; uniform float w[13]; uniform int r; out vec4 o;
void main() {
  vec4 c = texture(src, uv) * w[0];
  for (int i = 1; i < 13; i++) {
    if (i > r) break;
    vec2 d = dir * float(i);
    c += (texture(src, uv + d) + texture(src, uv - d)) * w[i];
  }
  o = c;
}`;

// a light's three layers added up, once: what is drawn
const FS_SUM = `#version 300 es
precision mediump float;
in vec2 uv; uniform sampler2D c0, c1, c2; uniform vec3 k; out vec4 o;
void main() { o = texture(c0, uv) * k.x + texture(c1, uv) * k.y + texture(c2, uv) * k.z; }`;

// a painting at night: its sky, its light upside down in the water below, softer, rippling, and
// its light
const FS_PAINTING = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D sky, lit;
uniform vec4 at;
uniform vec2 size;
uniform float horizon, seed, shine;
out vec4 o;
vec4 light(vec2 px, float soft) {
  vec2 q = (px - at.xy) / at.zw;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0);
  return texture(lit, q, soft);
}
void main() {
  vec2 px = uv * size;
  vec3 c = texture(sky, uv).rgb;
  if (shine > 0.0 && px.y > horizon) {
    float depth = (px.y - horizon) / max(1.0, size.y - horizon);
    vec2 m = vec2(px.x + sin(px.y * 0.13 + seed) * (1.0 + depth * 6.0), 2.0 * horizon - px.y);
    c += shine * (1.0 - depth) * light(m, 1.5).rgb;
  }
  c += light(px, 0.0).rgb;
  o = vec4(min(c, vec3(1.0)), 1.0);
}`;

// a painting in its world's place, what is in it solid (FS_TOY): its shadow thrown behind it, away
// from the light; held upside down below the horizon as much as the ground shines; and itself, laid
// over what is behind it
const FS_PAINTING_TOY = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D sky, lit, shade;
uniform vec4 at;
uniform vec2 size, drop;
uniform float horizon, seed, shine;
out vec4 o;
vec4 part(sampler2D t, vec2 px, float soft) {
  vec2 q = (px - at.xy) / at.zw;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0);
  return texture(t, q, soft);
}
void main() {
  vec2 px = uv * size;
  vec3 c = texture(sky, uv).rgb;
  vec4 s = part(shade, px - drop, 0.0) * 0.6;
  c = c * (1.0 - s.a) + s.rgb;
  if (shine > 0.0 && px.y > horizon) {
    float depth = (px.y - horizon) / max(1.0, size.y - horizon);
    vec2 m = vec2(px.x + sin(px.y * 0.13 + seed) * (1.0 + depth * 6.0), 2.0 * horizon - px.y);
    vec4 r = part(lit, m, 1.5) * shine * (1.0 - depth);
    c = c * (1.0 - r.a) + r.rgb;
  }
  vec4 t = part(lit, px, 0.0);
  c = c * (1.0 - t.a) + t.rgb;
  o = vec4(min(c, vec3(1.0)), 1.0);
}`;

// a quad of light, its corners where the view puts them (perspective in w); softer (a reflection,
// read from smaller copies of it), and if a reflection in still water, only near the water,
// fading away from it
const VS_QUAD = `#version 300 es
layout(location=0) in vec3 p;
layout(location=1) in vec2 t;
layout(location=2) in vec2 af;
out vec2 uv; out vec2 vaf;
void main() { gl_Position = vec4(p.xy, 0.0, p.z); uv = t; vaf = af; }`;
const FS_QUAD = `#version 300 es
precision mediump float;
in vec2 uv; in vec2 vaf;
uniform sampler2D c0; uniform float reach;
out vec4 o;
void main() {
  vec4 c = vaf.y > 0.5 ? texture(c0, uv, 1.5) : texture(c0, uv);
  float f = vaf.y > 0.5 && vaf.y < 1.5 ? smoothstep(1.0 - reach, 1.0, uv.y) : 1.0;
  o = c * vaf.x * f;
}`;

// how much of a reflection shows, from where it meets the water
export const REFLECT = 0.5;

// How finely a view is drawn: all of it while frames keep up; three quarters of it, then half,
// once they have run slower than 30 a second for a while. `frame(dt)` gives the scale to draw at.
export function createPace({ levels = [1, 0.75, 0.5], slow = 1 / 30, settle = 2 } = {}) {
  let i = 0, avg = null, slowFor = 0;
  return {
    get scale() { return levels[i]; },
    frame(dt) {
      if (dt > 0 && dt < 0.5) {
        avg = avg == null ? dt : avg * 0.9 + dt * 0.1;
        slowFor = avg > slow ? slowFor + dt : 0;
        if (slowFor > settle && i < levels.length - 1) { i++; slowFor = 0; avg = null; }
      }
      return levels[i];
    },
  };
}

// the gaussian's weights, for a spread of `sigma` texels: [w0..w12] and how far it reaches
function gaussian(sigma) {
  const r = Math.min(12, Math.max(1, Math.ceil(sigma * 3))), w = new Float32Array(13);
  let sum = 0;
  for (let i = 0; i <= r; i++) { w[i] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += i ? 2 * w[i] : w[i]; }
  for (let i = 0; i <= r; i++) w[i] /= sum;
  return { w, r };
}

// How a light is made, in source pixels: how far its glow reaches (`glow`, the spread of the
// widest), the margin round it for that (`pad`), and how many times each glow is halved before it
// is blurred, so a blur is a few texels wide whatever the size. `px`: source pixels a paper unit.
export function lightPlan(px) {
  const glow = Math.max(8, 34 * px), pad = Math.ceil(glow * 3.2 + 8);
  const level = (sigma) => Math.max(0, Math.min(4, Math.round(Math.log2(sigma / 3))));
  const wide = level(glow), tight = level(glow * 0.28);
  return { glow, pad, wide: { level: wide, sigma: glow / 2 ** wide }, tight: { level: tight, sigma: (glow * 0.28) / 2 ** tight } };
}

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`glow shader: ${gl.getShaderInfoLog(s)}`);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`glow program: ${gl.getProgramInfoLog(p)}`);
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

let only = null;
// The page's one: null where there is no WebGL2 (the night is then left out)
export function getGlow() {
  if (only !== null) return only || null;
  try { only = createGlow(); } catch (err) { console.log(`glow: ${err.message}`); only = false; }
  return only || null;
}

export function createGlow() {
  const canvas = document.createElement('canvas');
  canvas.className = 'glow';
  canvas.width = 1920; canvas.height = 1080;
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('no WebGL2');
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  const P = {
    light: compile(gl, VS_PASS, FS_LIGHT), copy: compile(gl, VS_PASS, FS_COPY), blur: compile(gl, VS_PASS, FS_BLUR),
    sum: compile(gl, VS_PASS, FS_SUM), painting: compile(gl, VS_PASS, FS_PAINTING), paintingToy: compile(gl, VS_PASS, FS_PAINTING_TOY), quad: compile(gl, VS_QUAD, FS_QUAD),
    pigment: compile(gl, VS_PASS, FS_PIGMENT), toy: compile(gl, VS_PASS, FS_TOY), shadow: compile(gl, VS_PASS, FS_SHADOW),
  };
  // the full-target triangle strip for passes, and the quads' buffer
  const passBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, passBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const passVao = gl.createVertexArray();
  gl.bindVertexArray(passVao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const quadBuf = gl.createBuffer(), quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  const STRIDE = 7 * 4;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 20);
  gl.bindVertexArray(null);
  const fbo = gl.createFramebuffer();

  const texture = (w, h, data = null) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return { tex: t, w, h };
  };
  const none = texture(1, 1, new Uint8Array(4));
  // a picture (canvas, image) as a texture, premultiplied, its first row on top
  // (`repeat`: across, it goes on round, as a sky does)
  function upload(src, { repeat = false } = {}) {
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    const T = texture(1, 1);
    gl.bindTexture(gl.TEXTURE_2D, T.tex);
    if (repeat) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    return { tex: T.tex, w, h };
  }
  const free = (...ts) => { for (const t of ts) if (t && t.tex && t !== none) gl.deleteTexture(t.tex); };
  // pictures used again and again (a kept painting, the paper), kept a while
  const kept = new Map();
  const forget = (key) => { const t = kept.get(key); if (t) { kept.delete(key); free(t); } };
  function cached(src, key) {
    if (!key) return { T: upload(src), own: true };
    if (!kept.has(key)) {
      kept.set(key, upload(src));
      while (kept.size > 8) { const [k, t] = kept.entries().next().value; kept.delete(k); free(t); }
    }
    return { T: kept.get(key), own: false };
  }

  // draw a pass into `to` (one texture, or two at once), sized as it is
  function pass(prog, to, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const outs = Array.isArray(to) ? to : [to];
    outs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.tex, 0));
    gl.drawBuffers(outs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    gl.viewport(0, 0, outs[0].w, outs[0].h);
    gl.disable(gl.BLEND);
    gl.useProgram(prog.p);
    setup(prog.u);
    gl.bindVertexArray(passVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    outs.forEach((_, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, null, 0));
  }
  const bind = (unit, T, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, (T || none).tex); gl.uniform1i(loc, unit); };
  // halve `src` `times` times; then blur it both ways, `sigma` texels
  function glowOf(src, { level, sigma }) {
    let cur = src;
    for (let i = 0; i < level; i++) {
      const next = texture(Math.max(1, cur.w >> 1), Math.max(1, cur.h >> 1));
      pass(P.copy, next, (u) => bind(0, cur, u.src));
      if (cur !== src) free(cur);
      cur = next;
    }
    const { w, r } = gaussian(Math.max(0.5, sigma));
    const half = texture(cur.w, cur.h), out = texture(cur.w, cur.h);
    pass(P.blur, half, (u) => { bind(0, cur, u.src); gl.uniform2f(u.dir, 1 / cur.w, 0); gl.uniform1fv(u.w, w); gl.uniform1i(u.r, r); });
    pass(P.blur, out, (u) => { bind(0, half, u.src); gl.uniform2f(u.dir, 0, 1 / cur.h); gl.uniform1fv(u.w, w); gl.uniform1i(u.r, r); });
    free(half);
    if (cur !== src) free(cur);
    return out;
  }

  // Ink turned to light. `ink`: ink on white (a canvas); or `painting` and its `paper` (the ink
  // is the one divided by the other); `key`s keep them uploaded. `rect`: [x, y, w, h], the part
  // to light, in source pixels (all of it if not given); `mask`: a canvas over that part, white
  // where the light is (or, `invert`, where it is not). `px`: source pixels a paper unit, for how
  // far the glow reaches. Returns the light, `all`: one texture over the part and a margin round
  // it, `pad` source pixels wide; its core, a tight glow and a wide one added up, with smaller
  // copies of itself for drawing it softer.
  function light({ ink = null, painting = null, paper = null, key = null, paperKey = null, rect = null, mask = null, invert = false, px = 0.5, floor = 14, material = null } = {}) {
    if (material && material.toy) return toy({ ink, painting, paper, key, paperKey, rect, mask, invert, px, floor, material });
    const src = ink || painting;
    const S = cached(src, key), Pp = paper ? cached(paper, paperKey) : null, M = mask ? upload(mask) : null;
    const W = S.T.w, H = S.T.h, [x, y, w, h] = rect || [0, 0, W, H];
    const plan = lightPlan(px), pad = plan.pad;
    const tw = Math.max(1, Math.round(w + 2 * pad)), th = Math.max(1, Math.round(h + 2 * pad));
    const core = texture(tw, th), source = texture(tw, th);
    pass(P.light, [core, source], (u) => {
      bind(0, S.T, u.ink); bind(1, Pp && Pp.T, u.paper); bind(2, M, u.mask);
      gl.uniform1i(u.divide, painting && paper ? 1 : 0);
      gl.uniform1i(u.masked, M ? 1 : 0);
      gl.uniform1i(u.invert, invert ? 1 : 0);
      gl.uniform4f(u.rect, pad / tw, pad / th, (pad + w) / tw, (pad + h) / th);
      gl.uniform4f(u.src, x / W, y / H, (x + w) / W, (y + h) / H);
      gl.uniform1f(u.up, 255 / (255 - floor));
      const L = (name) => LIGHTS[name], c = (v) => v.map((n) => n / 255);
      gl.uniform3fv(u.moonC, c(L('moon').core)); gl.uniform3fv(u.moonG, c(L('moon').glow));
      gl.uniform3fv(u.goldC, c(L('gold').core)); gl.uniform3fv(u.goldG, c(L('gold').glow));
      gl.uniform3fv(u.indigoC, c(L('indigo').core)); gl.uniform3fv(u.indigoG, c(L('indigo').glow));
      gl.uniform3fv(u.redC, c(L('cinnabar').core)); gl.uniform3fv(u.redG, c(L('cinnabar').glow));
    });
    const tight = glowOf(source, plan.tight), wide = glowOf(source, plan.wide);
    const all = texture(tw, th);
    pass(P.sum, all, (u) => { bind(0, core, u.c0); bind(1, tight, u.c1); bind(2, wide, u.c2); gl.uniform3f(u.k, 0.95, 0.55, 0.75); });
    gl.bindTexture(gl.TEXTURE_2D, all.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    free(source, M, core, tight, wide);
    if (S.own) free(S.T);
    if (Pp && Pp.own) free(Pp.T);
    return { all, w: tw, h: th, pad, rect: [x, y, w, h] };
  }
  const freeLight = (L) => { if (L) free(L.all, L.shadow); };

  // Ink as a toy (FS_PIGMENT, FS_TOY): as `light` is given, and the `material` (setting.js
  // materialOf). Returns the same, `all` drawn over what is there (not added to it, as light is),
  // and its `shadow`, the same size.
  function toy({ ink, painting, paper, key, paperKey, rect, mask, invert, px, floor, material: m }) {
    const src = ink || painting;
    const S = cached(src, key), Pp = paper ? cached(paper, paperKey) : null, M = mask ? upload(mask) : null;
    const W = S.T.w, H = S.T.h, [x, y, w, h] = rect || [0, 0, W, H];
    const plan = lightPlan(px), pad = plan.pad;
    const tw = Math.max(1, Math.round(w + 2 * pad)), th = Math.max(1, Math.round(h + 2 * pad));
    const core = texture(tw, th), amount = texture(tw, th);
    pass(P.pigment, [core, amount], (u) => {
      bind(0, S.T, u.ink); bind(1, Pp && Pp.T, u.paper); bind(2, M, u.mask);
      gl.uniform1i(u.divide, painting && paper ? 1 : 0);
      gl.uniform1i(u.masked, M ? 1 : 0);
      gl.uniform1i(u.invert, invert ? 1 : 0);
      gl.uniform4f(u.rect, pad / tw, pad / th, (pad + w) / tw, (pad + h) / th);
      gl.uniform4f(u.src, x / W, y / H, (x + w) / W, (y + h) / H);
      gl.uniform1f(u.up, 255 / (255 - floor));
      gl.uniform3fv(u.base, m.base); gl.uniform3fv(u.gold, m.gold); gl.uniform3fv(u.indigo, m.indigo); gl.uniform3fv(u.red, m.cinnabar);
      gl.uniform1i(u.keep, m.keep ? 1 : 0);
    });
    const height = glowOf(amount, plan.tight), spread = glowOf(amount, plan.wide);
    const all = texture(tw, th), shadow = texture(tw, th);
    pass(P.toy, all, (u) => {
      bind(0, core, u.c0); bind(1, height, u.c1);
      gl.uniform2f(u.texel, 1 / height.w, 1 / height.h);
      gl.uniform3fv(u.sun, m.sun); gl.uniform3fv(u.sunC, m.sunC);
      gl.uniform1f(u.ambient, m.ambient); gl.uniform1f(u.gloss, m.gloss); gl.uniform1f(u.rim, m.rim); gl.uniform1f(u.outline, m.outline);
      gl.uniform1f(u.bump, 1.25 * plan.tight.sigma * (m.relief ?? 1));
    });
    pass(P.shadow, shadow, (u) => { bind(0, spread, u.c0); gl.uniform3fv(u.shade, m.shadow); gl.uniform1f(u.k, 0.85); });
    for (const T of [all, shadow]) {
      gl.bindTexture(gl.TEXTURE_2D, T.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    free(amount, M, core, height, spread);
    if (S.own) free(S.T);
    if (Pp && Pp.own) free(Pp.T);
    return { all, shadow, w: tw, h: th, pad, rect: [x, y, w, h], toy: true };
  }

  // A picture with its own clear parts (a thing made real on its own, cut out: things.js), to stand
  // as a solid thing does: drawn over what is behind it, with its shadow, the shape of its clear
  // parts blurred, in `shade`. `pad`: its pixels below the foot of what it stands for; `px`: its
  // pixels a paper unit. Returns what `toy` does.
  function sprite(src, { pad = 0, px = 0.5, shade = [0.11, 0.14, 0.21] } = {}) {
    // its shadow blurred no further than the white round it in its region (a light's wide glow
    // would run off the edge of the picture and end in a straight line)
    const T = upload(src), plan = lightPlan(px);
    const spread = glowOf(T, plan.tight), shadow = texture(T.w, T.h);
    pass(P.shadow, shadow, (u) => { bind(0, spread, u.c0); gl.uniform3fv(u.shade, shade); gl.uniform1f(u.k, 0.85); });
    for (const X of [T, shadow]) {
      gl.bindTexture(gl.TEXTURE_2D, X.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    free(spread);
    return { all: T, shadow, w: T.w, h: T.h, pad, rect: [0, 0, T.w, T.h], toy: true, sprite: true };
  }

  // ---------------------------------------------------------------- drawing a view

  let view = null;
  // Lend the canvas to `host` (before `before`, if given), drawn at `scale` of the stage
  function attach(host, { before = null, scale = 1, W = 1920, H = 1080 } = {}) {
    if (canvas.parentNode !== host || (before && canvas.nextSibling !== before)) host.insertBefore(canvas, before);
    const w = Math.round(W * scale), h = Math.round(H * scale);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  // A frame of a view of `W` x `H` stage pixels: quads given in stage pixels, each corner with how
  // far away it is (`w`, for perspective; 1 if flat)
  function begin({ W = 1920, H = 1080 } = {}) {
    view = { W, H, data: [], draws: [] };
  }
  // `T`: a light (or any texture); `at`: its four corners [x, y, w] in the order top left, top
  // right, bottom left, bottom right; `alpha`; `soft`: drawn softer; `reflect`: a reflection in
  // still water, softer and shown only near the water; `opaque`: laid over all that is there (a
  // sky), where light is added to it; `over`: laid over what is there, as a solid thing is (a toy,
  // a shadow), where light is added; `uv`: the part of it shown [u0, v0, u1, v1]. One after
  // another with the same picture, quads are drawn together.
  function quad(T, at, { alpha = 1, soft = false, reflect = false, opaque = false, over = false, uv = [0, 0, 1, 1] } = {}) {
    if (!view || alpha <= 0.002) return;
    const [u0, v0, u1, v1] = uv, tc = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]], flag = reflect ? 1 : soft ? 2 : 0;
    const vertex = (i) => { const [x, y, w = 1] = at[i]; view.data.push(((x / view.W) * 2 - 1) * w, (1 - (y / view.H) * 2) * w, w, tc[i][0], tc[i][1], alpha, flag); };
    // two triangles
    for (const i of [0, 1, 2, 2, 1, 3]) vertex(i);
    const tex = T.all || T, last = view.draws[view.draws.length - 1], mode = opaque ? 'opaque' : over ? 'over' : 'add';
    if (last && last.T === tex && last.mode === mode) last.n += 6;
    else view.draws.push({ T: tex, start: view.data.length / 7 - 6, n: 6, mode });
  }
  function end({ clear = [0, 0, 0, 0] } = {}) {
    if (!view || lost) { view = null; return; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(...clear);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(view.data), gl.STREAM_DRAW);
    gl.useProgram(P.quad.p);
    gl.uniform1f(P.quad.u.reach, REFLECT);
    let mode = null;
    for (const d of view.draws) {
      if (mode !== d.mode) {
        mode = d.mode;
        if (mode === 'opaque') gl.disable(gl.BLEND);
        else { gl.enable(gl.BLEND); if (mode === 'over') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.ONE, gl.ONE); }
      }
      bind(0, d.T, P.quad.u.c0);
      gl.drawArrays(gl.TRIANGLES, d.start, d.n);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    const n = view.draws.length;
    view = null;
    return n;
  }

  // ---------------------------------------------------------------- a painting at night, as a picture

  // `sky`: its night, or its place (a canvas W x H); `L`: its light (or a toy: `light` given a
  // material), laid at `at` [x, y, w, h] (pixels of the picture; the light's margin included); the
  // ground below `horizon`, holding it upside down as much as it `shine`s; a solid thing's shadow thrown
  // `drop` [x, y] pixels. Returns a canvas.
  function picture({ sky, L, at, horizon, seed = 5, shine = 0.34, drop = [0, 0] }) {
    const W = sky.width, H = sky.height, S = upload(sky), out = texture(W, H), solid = !!L.toy;
    pass(solid ? P.paintingToy : P.painting, out, (u) => {
      bind(0, S, u.sky); bind(1, L.all, u.lit);
      if (solid) { bind(2, L.shadow, u.shade); gl.uniform2f(u.drop, drop[0], drop[1]); }
      gl.uniform4f(u.at, ...at);
      gl.uniform2f(u.size, W, H);
      gl.uniform1f(u.horizon, horizon);
      gl.uniform1f(u.seed, seed % 6.283);
      gl.uniform1f(u.shine, shine);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out.tex, 0);
    const px = new Uint8ClampedArray(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    free(S, out);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').putImageData(new ImageData(px, W, H), 0, 0);
    return c;
  }

  // for the tests: a pixel of a texture
  function read(T, x, y) {
    const px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.tex, 0);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return [...px];
  }

  return {
    canvas, upload, free, forget, light, freeLight, sprite, attach, begin, quad, end, picture, read,
    get lost() { return lost || gl.isContextLost(); },
  };
}
