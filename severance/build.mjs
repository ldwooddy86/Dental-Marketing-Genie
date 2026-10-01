/* Build Severance. Node 22, no npm packages.
     node build.mjs            validate, run the unit tests, write ../dist/severance-extension.zip and ../dist/Severance_2.html
     node build.mjs --check    validate only
     node build.mjs --no-test  skip the unit tests
     node build.mjs --single   validate and write the single file only (no tests, no zip)
   Validation: manifest.json parses and every file it names exists; app.html loads every script under src/ exactly once, in name
   order within each group (data, shared layers, the CMS contract, adapters, modules, the boot last); no inline scripts or inline
   handlers in the extension pages; no duplicate top level const/let/class across the classic scripts (they share one global scope);
   every fixed API host an adapter or connector calls is in host_permissions; node --check on every script; the CMS adapters match
   the Thermal Atlas copies they were taken from.
   The single file inlines app.css, every script and the data (as JSON script tags, the format of the original Severance file) into
   one HTML page that opens from disk in any browser. The zip leaves out tests/, tools/, docs/_*.md, build.mjs and editor files. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ROOT, '..', 'dist');
const OUT_ZIP = path.join(DIST, 'severance-extension.zip');
const OUT_HTML = path.join(DIST, 'Severance_2.html');
const args = new Set(process.argv.slice(2));
const problems = [], warnings = []; const bad = m => problems.push(m); const warn = m => warnings.push(m); const info = m => console.log('  ' + m);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));

/* ---- 1. manifest ---- */
console.log('manifest');
let man = null;
if (exists('manifest.json')) {
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
} else warn('no manifest.json yet; the extension zip is skipped');

/* ---- 2. script order in app.html ---- */
console.log('script order');
const html = read('app.html');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m => ({ attrs: m[1], body: m[2] }));
const srcs = scripts.map(s => (s.attrs.match(/\bsrc="([^"]+)"/) || [])[1]).filter(Boolean);
for (const s of scripts) if (!/\bsrc=/.test(s.attrs) || s.body.trim()) bad('app.html has an inline script (extension CSP forbids it)');
for (const f of ['popup.html', 'options.html', 'app.html'].filter(exists)) { const h = read(f); if (/<script\b(?![^>]*\bsrc=)/i.test(h)) bad(`${f} has an inline script`); if (/\son[a-z]+\s*=\s*["']/i.test(h)) bad(`${f} has an inline event handler`); }
const listDir = d => exists(d) ? fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).sort().map(f => d + '/' + f) : [];
const DATA_EAGER = ['data/suite.js', ...listDir('data').filter(f => /^data\/(live|watch)[-_]/.test(f))];
const onDisk = [...listDir('src'), ...listDir('src/cms')];
for (const f of onDisk) { const n = srcs.filter(s => s === f).length; if (n === 0) bad(`app.html does not load ${f}`); if (n > 1) bad(`app.html loads ${f} ${n} times`); }
for (const f of DATA_EAGER) if (!srcs.includes(f)) bad(`app.html does not load ${f}`);
for (const s of srcs) if (!exists(s)) bad(`app.html loads a missing file: ${s}`);
for (const s of srcs) if (/^data\/atlas-/.test(s)) bad(`app.html loads ${s}; the Metro Atlas files load on first use`);
const kind = f => /^data\//.test(f) ? 0 : /^src\/(0\d|1\d)_/.test(f) ? 1 : /^src\/cms\/00_/.test(f) ? 2 : /^src\/cms\/[1-9]\d_/.test(f) ? 3 : /^src\/[2-8]\d_m\d+_/.test(f) ? 4 : /^src\/99_boot/.test(f) ? 5 : -1;
let prev = -1, prevName = '';
for (const s of srcs) {
  const k = kind(s); if (k < 0) { bad(`unexpected script in app.html: ${s}`); continue; }
  if (k < prev) bad(`${s} is loaded after ${prevName}; order is data, shared layers, cms core, adapters, modules, boot`);
  if (k === prev && s < prevName && k !== 0) bad(`${s} is loaded after ${prevName}; keep files in name order within a group`);
  prev = k; prevName = s;
}
if (srcs[srcs.length - 1] !== 'src/99_boot.js') bad('src/99_boot.js must be the last script');
info(`${srcs.length} scripts: ${srcs.filter(s => kind(s) === 4).length} module files, ${srcs.filter(s => kind(s) === 3).length} adapter files`);

/* ---- 3. duplicate top level names across the classic scripts ---- */
console.log('global scope');
/* Every file shares one global scope, so a const, let or class declared twice throws "Identifier has already been declared" and the
   second file never runs. V8 checks a script's declarations before it runs any statement, so running the files in app.html order in a
   bare vm context reproduces it: each file stops at its first DOM call (ignored) with its top level names already bound. */
{
  const ctx = vm.createContext({ console: { log() { }, warn() { }, error() { }, info() { }, debug() { } }, TextEncoder, TextDecoder, URL, URLSearchParams, crypto: globalThis.crypto, Intl, Math, JSON, Date });
  for (const f of srcs.filter(s => kind(s) > 0)) {
    try { vm.runInContext(read(f), ctx, { filename: f }); }
    catch (e) { if (e instanceof SyntaxError || /already been declared/.test(e.message)) bad(`${f}: ${e.message} (one global scope across the classic scripts)`); }
  }
  info(`${srcs.filter(s => kind(s) > 0).length} scripts instantiated in one scope, ${problems.filter(p => /already been declared/.test(p)).length} collisions`);
}

/* ---- 4. fixed API hosts vs host_permissions ---- */
console.log('host permissions');
if (man) {
  const perms = new Set(man.host_permissions || []);
  const need = new Map();
  try {
    const { load } = await import('./tests/lib/load.mjs');
    const CMS = await load(listDir('src/cms').filter(f => /\/[1-9]\d_/.test(f)));
    for (const a of CMS.list()) for (const h of (a.hosts || [])) need.set(h, a.id);
  } catch (e) { bad('could not load the adapters to read their hosts: ' + e.message); }
  for (const f of listDir('src')) { const m = read(f).match(/HOST_ORIGINS = \[([^\]]+)\]/); if (m) for (const h of m[1].match(/'https:\/\/[^']+'/g) || []) need.set(h.slice(1, -1), f); }
  for (const [h, who] of need) if (!perms.has(h)) bad(`host_permissions lacks ${h} (used by ${who})`);
  info(`${need.size} fixed hosts required${problems.some(p => /host_permissions lacks/.test(p)) ? '; missing ones listed below' : ', all present'}`);
}

/* ---- 5. node --check and drift of the shared CMS adapters ---- */
console.log('syntax');
const allJs = [...['background.js', 'popup.js', 'options.js'].filter(exists), ...onDisk];
for (const f of allJs) { const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' }); if (r.status !== 0) bad(`node --check ${f}: ${(r.stderr || '').split('\n').slice(0, 3).join(' ')}`); }
info(`${allJs.length} files checked`);
{
  const TA = path.resolve(ROOT, '..', 'chrome-app', 'src', 'cms'); let same = 0, diff = [];
  for (const f of listDir('src/cms').filter(f => /\/(1\d)_/.test(f))) { const theirs = path.join(TA, path.basename(f)); if (!fs.existsSync(theirs)) continue; if (fs.readFileSync(theirs, 'utf8') === read(f)) same++; else diff.push(path.basename(f)); }
  if (diff.length) warn(`CMS adapters differ from chrome-app/src/cms: ${diff.join(', ')} (intended only where the file says why)`);
  info(`${same} CMS adapters identical to the Thermal Atlas copies`);
}

for (const w of warnings) console.log('  note: ' + w);
if (problems.length) { console.log('\nPROBLEMS\n  ' + problems.join('\n  ')); process.exit(1); }
if (args.has('--check')) { console.log('\nvalidation ok'); process.exit(0); }

/* ---- 6. unit tests ---- */
if (!args.has('--no-test') && !args.has('--single') && exists('tests/run.mjs')) {
  console.log('unit tests');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests', 'run.mjs')], { encoding: 'utf8', timeout: 900000 });
  process.stdout.write((r.stdout || '').split('\n').map(l => l ? '  ' + l : l).join('\n'));
  if (r.status !== 0) { console.log('\nunit tests failed; nothing written'); process.exit(1); }
}

/* ---- 7. the single file ---- */
console.log('single file');
/* data/*.js hold `JSON.parse("<json as a string literal>")`; the literal is recovered and embedded as a JSON script tag. */
const dataJson = rel => { const t = read(rel); const a = t.indexOf('JSON.parse(') + 11, b = t.lastIndexOf(');'); return JSON.parse(t.slice(a, b)); };
const scriptSafe = (js, f) => {
  if (/<!--/.test(js)) bad(`${f} contains "<!--", which changes how an inline script is parsed; write it as '<' + '!--'`);
  return js.replace(/<\/(script)/gi, '<\\/$1');
};
const jsonSafe = j => j.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\u0021--');
let single = html;
single = single.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, f) => `<style>\n${read(f).replace(/<\/style/gi, '<\\/style')}</style>`);
single = single.replace(/<script src="([^"]+)"><\/script>/g, (m, f) => {
  if (f === 'data/suite.js') return `<script type="application/json" id="suite-data">${jsonSafe(dataJson(f))}</script>`;
  if (/^data\//.test(f)) { const id = path.basename(f, '.js'); return `<script type="application/json" id="${id}">${jsonSafe(dataJson(f))}</script>`; }
  return `<script>\n${scriptSafe(read(f), f)}\n</script>`;
});
const atlasTags = listDir('data').filter(f => /^data\/atlas-/.test(f)).map(f => `<script type="application/json" id="${path.basename(f, '.js')}">${jsonSafe(dataJson(f))}</script>`).join('\n');
single = single.replace('<script type="application/json" id="suite-data">', atlasTags + '\n<script type="application/json" id="suite-data">');
single = single.replace(/<!-- [^>]*-->\n?/g, '');
if (problems.length) { console.log('\nPROBLEMS\n  ' + problems.join('\n  ')); process.exit(1); }
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT_HTML, single);
info(`${path.relative(path.resolve(ROOT, '..'), OUT_HTML)}, ${(single.length / 1024 / 1024).toFixed(2)} MB`);
if (args.has('--single')) process.exit(0);

/* ---- 8. zip (local file headers, central directory, deflate or stored) ---- */
if (!man) { console.log('\nno manifest.json; zip skipped'); process.exit(0); }
console.log('zip');
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const skip = rel => /^(tests|tools|node_modules|dist)(\/|$)/.test(rel) || rel === 'build.mjs' || /^docs\/_[^/]*\.md$/.test(rel) || /(^|\/)(\.DS_Store|Thumbs\.db|\.git.*|.*\.swp|.*~)$/.test(rel);
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
fs.writeFileSync(OUT_ZIP, Buffer.concat([...parts, cd, eo]));
info(`${entries.length} files, ${(rawTotal / 1024 / 1024).toFixed(2)} MB raw, ${(fs.statSync(OUT_ZIP).size / 1024 / 1024).toFixed(2)} MB zipped`);
console.log(`\nwrote ${OUT_ZIP}`);
