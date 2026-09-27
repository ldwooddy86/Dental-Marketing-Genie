/* Build the extension zip. Node 22, no npm packages.
     node build.mjs            validate, run the unit tests, write ../dist/thermal-atlas-extension.zip
     node build.mjs --no-test  skip the unit tests
     node build.mjs --check    validate only
   Validation: manifest.json parses and every file it names exists; app.html loads every script under src/ exactly once in the
   right order (data, shared layers, the CMS contract, adapters, the headless kit, modules 01 to 16, the shell last); no inline
   scripts or inline handlers in the html pages; no duplicate top level const/let/var/function/class across the classic scripts
   (they share one global scope); every fixed API host an adapter or connector calls is in host_permissions; node --check on every
   script. The zip leaves out tests/, docs/_*.md, build.mjs, node_modules and editor files. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(ROOT, '..', 'dist', 'thermal-atlas-extension.zip');
const args = new Set(process.argv.slice(2));
const problems = []; const bad = m => problems.push(m); const info = m => console.log('  ' + m);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));

/* ---- 1. manifest ---- */
console.log('manifest');
let man = null;
try { man = JSON.parse(read('manifest.json')); } catch (e) { bad('manifest.json does not parse: ' + e.message); }
if (man) {
  if (man.manifest_version !== 3) bad('manifest_version must be 3');
  if (!/^\d+(\.\d+){1,3}$/.test(String(man.version || ''))) bad('version must be 1 to 4 dot separated integers');
  const files = [...Object.values(man.icons || {}), ...Object.values((man.action || {}).default_icon || {}), (man.action || {}).default_popup, (man.options_ui || {}).page, (man.background || {}).service_worker, ...((man.background || {}).scripts || [])].filter(Boolean);
  for (const f of new Set(files)) if (!exists(f)) bad(`manifest names a missing file: ${f}`);
  for (const p of (man.host_permissions || [])) if (!/^(https?|\*):\/\/[^/]+\/\*$/.test(p)) bad(`odd host permission pattern: ${p}`);
  if (!(man.content_security_policy || {}).extension_pages || !/script-src 'self'/.test(man.content_security_policy.extension_pages)) bad('extension_pages CSP must carry script-src self');
  info(`${man.name} ${man.version}, ${(man.host_permissions || []).length} host permissions`);
}

/* ---- 2. script order in app.html ---- */
console.log('script order');
const html = read('app.html');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m => ({ attrs: m[1], body: m[2] }));
const srcs = scripts.map(s => (s.attrs.match(/\bsrc="([^"]+)"/) || [])[1]).filter(Boolean);
for (const s of scripts) if (!/\bsrc=/.test(s.attrs) || s.body.trim()) bad('app.html has an inline script (extension CSP forbids it)');
for (const f of ['popup.html', 'options.html', 'app.html']) { const h = read(f); if (/<script\b(?![^>]*\bsrc=)/i.test(h)) bad(`${f} has an inline script`); if (/\son[a-z]+\s*=\s*["']/i.test(h)) bad(`${f} has an inline event handler`); }
const listDir = d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).sort().map(f => d + '/' + f);
const onDisk = ['atlas-data.js', 'nws-snapshot.js', ...listDir('src'), ...listDir('src/cms')];
for (const f of onDisk) { const n = srcs.filter(s => s === f).length; if (n === 0) bad(`app.html does not load ${f}`); if (n > 1) bad(`app.html loads ${f} ${n} times`); }
for (const s of srcs) if (!exists(s)) bad(`app.html loads a missing file: ${s}`);
const kind = f => /^atlas-data|^nws-snapshot/.test(f) ? 0 : /^src\/(0\d|1[0-2])_/.test(f) ? 1 : /^src\/cms\/00_/.test(f) ? 2 : /^src\/cms\/1\d_/.test(f) ? 3 : /^src\/\d+_m\d+_/.test(f) ? 4 : /^src\/99_shell/.test(f) ? 5 : -1;
let prev = -1, prevName = '';
for (const s of srcs) {
  const k = kind(s); if (k < 0) { bad(`unexpected script in app.html: ${s}`); continue; }
  if (k < prev) bad(`${s} is loaded after ${prevName}; order is data, shared layers, cms core, adapters, modules, shell`);
  if (k === prev && s < prevName) bad(`${s} is loaded after ${prevName}; keep files in name order within a group`);
  prev = k; prevName = s;
}
const mods = srcs.filter(s => kind(s) === 4); const i16 = mods.findIndex(s => /30_m16_publish/.test(s)); const iShell = srcs.findIndex(s => /99_shell/.test(s));
if (i16 < 0) bad('src/30_m16_publish.js is not loaded'); if (iShell !== srcs.length - 1) bad('src/99_shell.js must be the last script');
const order = srcs.filter(s => s.startsWith('src/')).join('\n') + '\n';
if (exists('src/ORDER.txt') && read('src/ORDER.txt') !== order) { fs.writeFileSync(path.join(ROOT, 'src/ORDER.txt'), order); info('src/ORDER.txt regenerated from app.html'); }
info(`${srcs.length} scripts: ${mods.length} modules, ${srcs.filter(s => kind(s) === 3).length} adapter files`);

/* ---- 3. duplicate top level names across the classic scripts ---- */
console.log('global scope');
/* The page loads every file into one global scope, so a const, let, class or function declared twice throws
   "Identifier has already been declared" and the second file never runs. V8 makes that check when it instantiates a script's
   declarations, before any statement runs, so running the files in app.html order inside a bare vm context reproduces it
   exactly: each file stops at its first DOM or extension API call (a ReferenceError, ignored here) but its top level names are
   already bound, and the next file that repeats one throws the SyntaxError. A var or function that repeats another var or function
   overwrites silently, in the browser as here, and is not caught. */
{
  const ctx = vm.createContext({ console: { log() { }, warn() { }, error() { }, info() { }, debug() { } }, TextEncoder, TextDecoder, URL, URLSearchParams, crypto: globalThis.crypto, Intl, Math, JSON, Date });
  for (const f of srcs.filter(s => /\.js$/.test(s))) {
    try { vm.runInContext(read(f), ctx, { filename: f }); }
    catch (e) { if (e instanceof SyntaxError || /already been declared/.test(e.message)) bad(`${f}: ${e.message} (one global scope across the classic scripts)`); }
  }
  info(`${srcs.length} scripts instantiated in one scope, ${problems.filter(p => /already been declared/.test(p)).length} collisions`);
}

/* ---- 4. fixed API hosts vs host_permissions ---- */
console.log('host permissions');
if (man) {
  const perms = new Set(man.host_permissions || []);
  const need = new Map();
  try {
    const { load } = await import('./tests/lib/load.mjs');
    const CMS = await load(listDir('src/cms').filter(f => /\/1\d_/.test(f)));
    for (const a of CMS.list()) for (const h of (a.hosts || [])) need.set(h, a.id);
  } catch (e) { bad('could not load the adapters to read their hosts: ' + e.message); }
  const acct = read('src/12_accounts_core.js'); const m = acct.match(/origins = \[([^\]]+)\]/);
  if (m) for (const h of m[1].match(/'https:\/\/[^']+'/g) || []) need.set(h.slice(1, -1), 'connectors');
  for (const [h, who] of need) if (!perms.has(h)) bad(`host_permissions lacks ${h} (used by ${who})`);
  info(`${need.size} fixed hosts required, all present${problems.some(p => /host_permissions lacks/.test(p)) ? ' except the ones listed' : ''}`);
}

/* ---- 5. node --check ---- */
console.log('syntax');
const allJs = ['background.js', 'popup.js', 'options.js', ...onDisk];
for (const f of allJs) { const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' }); if (r.status !== 0) bad(`node --check ${f}: ${(r.stderr || '').split('\n').slice(0, 3).join(' ')}`); }
info(`${allJs.length} files checked`);

if (problems.length) { console.log('\nPROBLEMS\n  ' + problems.join('\n  ')); process.exit(1); }
if (args.has('--check')) { console.log('\nvalidation ok'); process.exit(0); }

/* ---- 6. unit tests ---- */
if (!args.has('--no-test')) {
  console.log('unit tests');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests', 'run.mjs')], { encoding: 'utf8', timeout: 600000 });
  process.stdout.write((r.stdout || '').split('\n').map(l => l ? '  ' + l : l).join('\n'));
  if (r.status !== 0) { console.log('\nunit tests failed; no zip written'); process.exit(1); }
}

/* ---- 7. zip (local file headers, central directory, deflate or stored) ---- */
console.log('zip');
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const skip = rel => /^(tests|node_modules|dist)(\/|$)/.test(rel) || rel === 'build.mjs' || /^docs\/_[^/]*\.md$/.test(rel) || /(^|\/)(\.DS_Store|Thumbs\.db|\.git.*|.*\.swp|.*~)$/.test(rel);
const walk = (d, acc) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const rel = d ? d + '/' + e.name : e.name; if (skip(rel)) continue; if (e.isDirectory()) walk(rel, acc); else if (e.isFile()) acc.push(rel); } return acc; };
const entries = walk('', []);
const now = new Date(); const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
const parts = [], central = []; let offset = 0, rawTotal = 0;
for (const rel of entries) {
  const data = fs.readFileSync(path.join(ROOT, rel)); rawTotal += data.length;
  const name = Buffer.from(rel, 'utf8'); const crc = crc32(data);
  let method = 0, body = data; if (data.length > 64) { const z = zlib.deflateRawSync(data, { level: 9 }); if (z.length < data.length) { method = 8; body = z; } }
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8); lh.writeUInt16LE(dt, 10); lh.writeUInt16LE(dd, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
  parts.push(lh, name, body);
  const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10); ch.writeUInt16LE(dt, 12); ch.writeUInt16LE(dd, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
  central.push(ch, name); offset += 30 + name.length + body.length;
}
const cd = Buffer.concat(central); const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(0, 4); eo.writeUInt16LE(0, 6); eo.writeUInt16LE(entries.length, 8); eo.writeUInt16LE(entries.length, 10); eo.writeUInt32LE(cd.length, 12); eo.writeUInt32LE(offset, 16); eo.writeUInt16LE(0, 20);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([...parts, cd, eo]));
info(`${entries.length} files, ${(rawTotal / 1024 / 1024).toFixed(2)} MB raw, ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB zipped`);
console.log(`\nwrote ${OUT}`);
