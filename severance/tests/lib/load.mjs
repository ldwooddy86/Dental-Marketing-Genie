/* Loads the extension's classic scripts into this Node process (Node 22+, global fetch, WebCrypto, Blob, FormData).
   Usage: import { load, CMS } from './lib/load.mjs'; await load(['src/cms/12_wix.js']);   // core is always loaded first */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const loaded = new Set();
export function runFile(rel) {
  const p = path.join(ROOT, rel); if (loaded.has(p)) return; loaded.add(p);
  const code = fs.readFileSync(p, 'utf8');
  vm.runInThisContext(code, { filename: p });
}
export async function load(files) {
  runFile('src/cms/00_cms_core.js');
  for (const f of files || []) runFile(f);
  await globalThis.CMS.ready();
  return globalThis.CMS;
}
export const root = ROOT;
export const CMS = () => globalThis.CMS;
