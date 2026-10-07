/* Runs every tests/*.test.mjs in its own process and reports. `node tests/run.mjs [filter]` */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).sort();
let fail = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 180000 });
  const ok = r.status === 0;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}  (${Date.now() - t0} ms)`);
  if (!ok) { console.log((r.stdout || '').split('\n').slice(-40).join('\n')); console.log(r.stderr || ''); }
  else if (process.env.VERBOSE) console.log(r.stdout);
}
console.log(`\n${files.length - fail} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
