/* Build the Leviathan browser app. Node 22, no npm packages.
     node build.mjs --from <dir>   rebuild console/ and registry.js from the Leviathan repository: <dir> is its leviathan/ folder or its root
     node build.mjs --fetch        the same, downloading the console files from GitHub (ldwooddy86/Leviathan, main; --branch <name> for another)
     node build.mjs                validate what is in this folder and run the unit tests
     node build.mjs --zip          also write ../dist/leviathan-extension.zip
     --check  validate only   --no-test  skip the unit tests
   The console is patched, not rewritten: six anchored edits in its frame script (lib/patch.mjs), the bridge script beside it,
   the companion data scripts copied as they are. Validation: the manifest and its sandbox CSP, no inline scripts on the extension
   pages, the patch markers in the built console, the companion payloads the console names, registry.js in step with the console,
   node --check on every script. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EXT_VERSION, MARKERS, patchConsole, extractRegistry, registryScript, writeZip } from './lib/patch.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(ROOT, '..', 'dist', 'leviathan-extension.zip');
const RAW = 'https://raw.githubusercontent.com/ldwooddy86/Leviathan/';
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const problems = []; const bad = m => problems.push(m); const info = m => console.log('  ' + m);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const MB = n => (n / 1024 / 1024).toFixed(1) + ' MB';

/* ---- 1. the console: patch and copy from the Leviathan repository when asked ---- */
async function source() {
  if (flag('--fetch')) {
    const branch = opt('--branch') || 'main';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leviathan-src-'));
    const get = async name => {
      const url = RAW + branch + '/leviathan/' + name; info('fetching ' + url);
      const r = await fetch(url); if (!r.ok) throw new Error(url + ' answered HTTP ' + r.status);
      fs.writeFileSync(path.join(dir, name), Buffer.from(await r.arrayBuffer()));
    };
    await get('Leviathan.html');
    const reg = extractRegistry(fs.readFileSync(path.join(dir, 'Leviathan.html'), 'utf8'));
    for (const x of reg.ext) await get(x.file);
    return dir;
  }
  const from = opt('--from');
  if (!from) return null;
  for (const d of [from, path.join(from, 'leviathan')]) if (fs.existsSync(path.join(d, 'Leviathan.html'))) return path.resolve(d);
  throw new Error(`${from} holds no Leviathan.html (pass the Leviathan repository's leviathan/ folder or its root)`);
}
async function rebuild(src) {
  console.log('console from ' + src);
  const html = fs.readFileSync(path.join(src, 'Leviathan.html'), 'utf8');
  const reg = extractRegistry(html, { version: EXT_VERSION });
  const patched = patchConsole(html, { version: EXT_VERSION });
  fs.mkdirSync(path.join(ROOT, 'console'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'console', 'Leviathan.html'), patched);
  info(`console/Leviathan.html ${MB(Buffer.byteLength(patched))} (console ${reg.consoleVersion}, compiled ${reg.compiled})`);
  for (const x of reg.ext) {
    const p = path.join(src, x.file);
    if (!fs.existsSync(p)) throw new Error(`${x.file} is missing beside Leviathan.html (it carries ${x.ids.join(', ')})`);
    fs.copyFileSync(p, path.join(ROOT, 'console', x.file));
    info(`console/${x.file} ${MB(fs.statSync(p).size)} (${x.ids.join(', ')})`);
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'console'))) {
    if (/^Leviathan-data.*\.js$/.test(f) && !reg.ext.some(x => x.file === f)) { fs.unlinkSync(path.join(ROOT, 'console', f)); info(`removed stale console/${f}`); }
  }
  fs.writeFileSync(path.join(ROOT, 'registry.js'), registryScript(reg));
  info(`registry.js: ${reg.modules.length} dashboards in ${reg.wings.length} wings`);
}

/* ---- 2. validation ---- */
function validate() {
  console.log('manifest');
  let man = null;
  try { man = JSON.parse(read('manifest.json')); } catch (e) { bad('manifest.json does not parse: ' + e.message); }
  if (man) {
    if (man.manifest_version !== 3) bad('manifest_version must be 3');
    if (!/^\d+(\.\d+){1,3}$/.test(String(man.version || ''))) bad('version must be 1 to 4 dot separated integers');
    if (man.version !== EXT_VERSION) bad(`manifest version ${man.version} differs from EXT_VERSION ${EXT_VERSION} in lib/patch.mjs`);
    const files = [...Object.values(man.icons || {}), ...Object.values((man.action || {}).default_icon || {}), (man.action || {}).default_popup, (man.options_ui || {}).page, (man.background || {}).service_worker, ...((man.sandbox || {}).pages || [])].filter(Boolean);
    for (const f of new Set(files)) if (!exists(f)) bad(`manifest names a missing file: ${f}`);
    const csp = man.content_security_policy || {};
    if (!/script-src 'self'/.test(csp.extension_pages || '')) bad("extension_pages CSP must carry script-src 'self'");
    if (/unsafe-inline|unsafe-eval/.test(csp.extension_pages || '')) bad('extension_pages CSP must not allow inline scripts or eval');
    const sb = csp.sandbox || '';
    if (!/^sandbox\b/.test(sb)) bad('the sandbox CSP must start with the sandbox directive');
    for (const t of ['allow-scripts', 'allow-forms', 'allow-popups', 'allow-modals', 'allow-downloads']) if (!sb.includes(t)) bad(`the sandbox CSP lacks ${t}`);
    if (/allow-same-origin/.test(sb)) bad('the sandbox CSP must not carry allow-same-origin (Chrome rejects it)');
    if (!/script-src[^;]*'unsafe-inline'/.test(sb)) bad('the sandbox CSP must allow inline scripts: the console and the atlases are inline');
    if (!((man.sandbox || {}).pages || []).includes('console/Leviathan.html')) bad('console/Leviathan.html must be listed as a sandboxed page');
    if ((man.permissions || []).some(p => /^(tabs|history|<all_urls>)$/.test(p))) bad('no browsing history permissions: the app needs only storage');
    info(`${man.name} ${man.version}, permissions: ${(man.permissions || []).join(', ') || 'none'}`);
  }
  console.log('pages');
  for (const f of ['popup.html', 'app.html']) {
    const h = read(f);
    if (/<script\b(?![^>]*\bsrc=)/i.test(h)) bad(`${f} has an inline script (the extension CSP forbids it)`);
    if (/\son[a-z]+\s*=\s*["']/i.test(h)) bad(`${f} has an inline event handler`);
    for (const s of [...h.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1])) if (!exists(s)) bad(`${f} loads a missing script: ${s}`);
  }
  console.log('console');
  if (!exists('console/Leviathan.html')) bad('console/Leviathan.html is missing: run node build.mjs --from <Leviathan repository> (or --fetch)');
  else {
    const c = read('console/Leviathan.html');
    for (const m of MARKERS) { const n = c.split(m).length - 1; if (n !== 1) bad(`console marker "${m}" occurs ${n} times, expected once`); }
    if (!exists('console/ext/host-bridge.js')) bad('console/ext/host-bridge.js is missing');
    let reg = null;
    try { reg = extractRegistry(c); } catch (e) { bad('console registry: ' + e.message); }
    if (reg) {
      for (const x of reg.ext) {
        if (!exists('console/' + x.file)) { bad(`console/${x.file} is missing (it holds ${x.ids.join(', ')})`); continue; }
        const d = read('console/' + x.file);
        for (const id of x.ids) if (!d.includes(`window.__LVP["${id}"]=`)) bad(`console/${x.file} lacks the ${id} payload`);
      }
      if (!exists('registry.js')) bad('registry.js is missing');
      else {
        const m = /globalThis\.LV_REGISTRY = ([\s\S]*);\s*$/.exec(read('registry.js')); let R = null;
        try { R = JSON.parse(m[1]); } catch (e) { bad('registry.js does not parse'); }
        if (R && R.modules.map(x => x.id).join() !== reg.modules.map(x => x.id).join()) bad('registry.js is out of step with console/Leviathan.html: rebuild');
      }
      const total = ['console/Leviathan.html', ...reg.ext.map(x => 'console/' + x.file)].filter(exists).reduce((a, f) => a + fs.statSync(path.join(ROOT, f)).size, 0);
      info(`${reg.modules.length} dashboards, console ${reg.consoleVersion}, compiled ${reg.compiled}, ${MB(total)} of console files`);
    }
  }
  console.log('syntax');
  const js = ['background.js', 'popup.js', 'app.js', 'open.js', 'registry.js', 'console/ext/host-bridge.js'].filter(exists);
  for (const f of js) { const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' }); if (r.status !== 0) bad(`node --check ${f}: ${(r.stderr || '').split('\n').slice(0, 3).join(' ')}`); }
  info(`${js.length} files checked`);
}

/* ---- 3. zip ---- */
function zip() {
  console.log('zip');
  const skip = rel => /^(tests|lib|tools|node_modules|dist)(\/|$)/.test(rel) || rel === 'build.mjs' || /(^|\/)(\.DS_Store|Thumbs\.db|\.git.*|.*\.swp|.*~)$/.test(rel);
  const walk = (d, acc) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const rel = d ? d + '/' + e.name : e.name; if (skip(rel)) continue; if (e.isDirectory()) walk(rel, acc); else if (e.isFile()) acc.push(rel); } return acc; };
  const entries = walk('', []).map(rel => ({ name: rel, data: fs.readFileSync(path.join(ROOT, rel)) }));
  const buf = writeZip(entries);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  info(`${entries.length} files, ${MB(entries.reduce((a, e) => a + e.data.length, 0))} raw, ${MB(buf.length)} zipped`);
  console.log(`\nwrote ${OUT}`);
}

/* ---- main ---- */
try {
  const src = await source();
  if (src) await rebuild(src);
} catch (e) { console.log('\nBUILD FAILED\n  ' + e.message); process.exit(1); }
validate();
if (problems.length) { console.log('\nPROBLEMS\n  ' + problems.join('\n  ')); process.exit(1); }
if (flag('--check')) { console.log('\nvalidation ok'); process.exit(0); }
if (!flag('--no-test')) {
  console.log('unit tests');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests', 'run.mjs')], { encoding: 'utf8', timeout: 600000 });
  process.stdout.write((r.stdout || '').split('\n').map(l => l ? '  ' + l : l).join('\n'));
  if (r.status !== 0) { console.log('\nunit tests failed' + (flag('--zip') ? '; no zip written' : '')); process.exit(1); }
}
if (flag('--zip')) zip(); else console.log('\nok');
