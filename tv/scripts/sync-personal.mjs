#!/usr/bin/env node
// Copies the Inkwash engine (inkwash/engine: its core, the personal layer and dream worlds) into the
// TV app, folder for folder, so the relative imports hold:
// - server/engine, for the guide service, which is deployed on its own;
// - src/engine, for the TV page, which runs the engine itself: each person's dream world lives on
//   their TV, and only the slice a night needs is sent.
// The model gateway, the eval and the simulation stay in the engine; the TV doesn't need them.
//
//   node scripts/sync-personal.mjs          copy
//   node scripts/sync-personal.mjs --check  exit 1 if a copy differs from the engine's
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tv = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.join(tv, '..', 'engine');
const CORE = ['index.mjs', 'world.mjs', 'compile.mjs', 'impact.mjs', 'resolve.mjs', 'names.mjs', 'text.mjs', 'time.mjs', 'lexicon.mjs', 'checks.mjs'];
const files = () => [
  ...CORE,
  ...fs.readdirSync(path.join(engine, 'personal')).filter((f) => f.endsWith('.mjs') && f !== 'test.mjs').map((f) => `personal/${f}`),
  ...fs.readdirSync(path.join(engine, 'dreams')).filter((f) => f.endsWith('.mjs') && f !== 'test.mjs' && f !== 'sim.mjs').map((f) => `dreams/${f}`),
];
const DEST = [path.join(tv, 'server', 'engine'), path.join(tv, 'src', 'engine')];
const header = (f) => `// Copied from inkwash/engine/${f} by scripts/sync-personal.mjs. Edit it there, then sync.\n`;
const copyOf = (f) => header(f) + fs.readFileSync(path.join(engine, f), 'utf8');

export function differences() {
  if (!fs.existsSync(path.join(engine, 'dreams'))) return null; // outside the monorepo: nothing to compare with
  const out = [];
  for (const to of DEST) for (const f of files()) {
    const dest = path.join(to, f);
    if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== copyOf(f)) out.push(path.relative(tv, dest));
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const d = differences();
    if (d && d.length) { console.error(`out of date: ${d.join(', ')}; run node scripts/sync-personal.mjs`); process.exit(1); }
    console.log(d ? 'the copies match the engine' : 'no engine here to compare with');
  } else {
    for (const to of DEST) {
      fs.rmSync(to, { recursive: true, force: true });
      for (const f of files()) {
        fs.mkdirSync(path.dirname(path.join(to, f)), { recursive: true });
        fs.writeFileSync(path.join(to, f), copyOf(f));
      }
    }
    console.log(`copied ${files().length} files into server/engine and src/engine`);
  }
}
