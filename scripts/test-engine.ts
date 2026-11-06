/**
 * Try the comparison engine from the terminal, without the website or Supabase.
 *
 *   npm run test:engine -- <reference.srt> <your.srt> [accuracy|effort]
 *
 * reference = the QA version (accuracy) or the AI template (effort).
 * Needs Node 22.18 or newer (it runs TypeScript directly).
 */
import { readFileSync } from 'node:fs';
import { compare, type Mode } from '../src/lib/compare/engine.ts';

const [refPath, hypPath, modeArg = 'accuracy'] = process.argv.slice(2);
if (!refPath || !hypPath) {
  console.log('Usage: npm run test:engine -- <reference.srt> <your.srt> [accuracy|effort]');
  process.exit(1);
}
const mode = (modeArg === 'effort' ? 'effort' : 'accuracy') as Mode;
const r = compare(readFileSync(refPath, 'utf8'), readFileSync(hypPath, 'utf8'), mode);

console.log(`\n${mode.toUpperCase()}  ${hypPath}  vs  ${refPath}`);
if (r.transcriber) console.log(`Transcriber: ${r.transcriber}`);
if (mode === 'accuracy') console.log(`Accuracy: ${(r.accuracy * 100).toFixed(1)}%  (${r.totalErrors} errors / ${r.refWords} QA words)`);
else console.log(`Changes: ${r.totalChanges}  (${(r.changedShare * 100).toFixed(1)}% of ${r.refWords} AI words)`);
console.log('Counts:', r.counts);
for (const side of ['qa', 'you'] as const) {
  const xs = r.skipped.filter((x) => x.side === side);
  if (xs.length) console.log(`Skipped (${side === 'qa' ? 'voiceover in QA' : 'cut from video'}): ${xs.length} subtitles, first: ${xs.slice(0, 12).map((x) => x.n).join(', ')}`);
}
console.log(`\nFirst 15 of ${r.items.length} changes:`);
for (const it of r.items.slice(0, 15)) {
  const fmt = (ps: typeof it.ref) => ps.map((p) => (p.changed ? `[${p.text}]` : p.text)).join('');
  console.log(`  line ${it.line ?? '-'} (${it.kinds.join(', ')})\n    ref: ${fmt(it.ref)}\n    you: ${fmt(it.hyp)}`);
}
