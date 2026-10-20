// Packs the TV page into one self-contained HTML file, dist/inkwash-tv.html: the page's modules
// (bundled by esbuild), the walk inside a world (three.js and Spark, kept as text until it is
// wanted) and the fonts, all inline. A Vega app loads its page from
// file:///pkg/assets/, where Chromium refuses module scripts and font files; a single file
// sidesteps both.
//
// INKWASH_GUIDE_URL, if set, is where the packaged app finds the guide service (server/), and
// INKWASH_GUIDE_KEY the key it sends, if the service was deployed with one.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');
const out = await build({ entryPoints: [here('../src/main.js')], bundle: true, format: 'iife', target: 'chrome120', write: false, minify: false, legalComments: 'inline' });
const app = out.outputFiles[0].text;
// walking inside a world (src/realwalk.js, with three.js and Spark): bundled apart, and kept in the
// page as text, read only once someone walks inside (main.js realWalkLib), so the TV doesn't parse
// three megabytes it may not need as it starts
const walk = (await build({ entryPoints: [here('../src/realwalk.js')], bundle: true, format: 'iife', globalName: 'InkwashRealWalk', target: 'chrome120', write: false, minify: true, legalComments: 'none' })).outputFiles[0].text;
const fontsCss = readFileSync(here('../fonts/fonts.css'), 'utf8').replace(/url\(\.\/([^)]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(here(`../fonts/${f}`)).toString('base64')})`);
const guide = process.env.INKWASH_GUIDE_URL || '';
const key = process.env.INKWASH_GUIDE_KEY || '';
if (guide && !/^https:\/\//.test(guide)) throw new Error('INKWASH_GUIDE_URL must be an https:// address');

let html = readFileSync(here('../index.html'), 'utf8');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`index.html no longer contains: ${from}`);
  html = html.replace(from, () => to);
};
swap('<link rel="stylesheet" href="./fonts/fonts.css">', `<style>\n${fontsCss}</style>`);
const config = guide ? `<script>window.INKWASH_GUIDE_URL = ${JSON.stringify(guide)};${key ? ` window.INKWASH_GUIDE_KEY = ${JSON.stringify(key)};` : ''}</script>\n` : '';
swap(html.slice(html.indexOf('<!-- for walking inside a world'), html.indexOf('<script type="module" src="./src/main.js"></script>')), '');
swap('<script type="module" src="./src/main.js"></script>', `${config}<script type="text/plain" id="realwalk-lib">${safe(walk)}</script>\n<script>\n${safe(app)}\n</script>`);

mkdirSync(here('../dist'), { recursive: true });
writeFileSync(here('../dist/inkwash-tv.html'), html);
console.log(`dist/inkwash-tv.html: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB${guide ? `, guide at ${guide}` : ', no guide service'}`);
