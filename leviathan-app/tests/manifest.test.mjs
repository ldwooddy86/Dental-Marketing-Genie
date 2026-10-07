/* manifest.json, the extension pages and open.js (search, routes) against registry.js. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { EXT_VERSION } from '../lib/patch.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 220) + ')' : ''}`); if (!c) fails++; };

const man = JSON.parse(read('manifest.json'));
ok(man.manifest_version === 3 && man.version === EXT_VERSION, 'manifest v3 with the app version', man.version);
ok((man.sandbox || {}).pages.includes('console/Leviathan.html'), 'the console is a sandboxed page');
const sb = man.content_security_policy.sandbox;
ok(/^sandbox allow-scripts/.test(sb) && !/allow-same-origin/.test(sb) && /allow-downloads/.test(sb) && /allow-popups/.test(sb), 'sandbox flags: scripts, popups, downloads, no same origin', sb);
ok(/script-src 'self' 'unsafe-inline' 'unsafe-eval'/.test(sb), 'the sandbox allows the inline scripts of the console and the atlases');
ok(!/frame-src|child-src/.test(sb), 'the sandbox CSP leaves frames unrestricted (the atlases nest srcdoc documents)');
ok(/^script-src 'self'; object-src 'self'$/.test(man.content_security_policy.extension_pages), 'extension pages keep the strict default CSP', man.content_security_policy.extension_pages);
ok(JSON.stringify(man.permissions) === '["storage"]', 'the only permission is storage', JSON.stringify(man.permissions));
ok(!man.host_permissions && !man.optional_host_permissions, 'no host permissions');
for (const f of [...new Set([...Object.values(man.icons), man.action.default_popup, man.background.service_worker, ...man.sandbox.pages])]) ok(exists(f), `manifest file exists: ${f}`);
ok(man.omnibox && man.omnibox.keyword === 'lev', 'omnibox keyword lev');
ok(man.commands && man.commands['open-console'], 'the open-console command is declared');

for (const f of ['popup.html', 'app.html']) {
  const h = read(f);
  ok(!/<script\b(?![^>]*\bsrc=)/i.test(h), `${f} has no inline script`);
  ok(!/\son[a-z]+\s*=\s*["']/i.test(h), `${f} has no inline event handler`);
  for (const s of [...h.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1])) ok(exists(s), `${f} loads ${s}`);
}
ok(/<iframe id="console"/.test(read('app.html')) && /console\/Leviathan\.html/.test(read('app.js')), 'the wrapper frames console/Leviathan.html');
ok(/importScripts\('registry\.js', 'open\.js'\)/.test(read('background.js')), 'the background imports the registry and the open helper');

/* open.js against the generated registry */
if (!exists('registry.js')) console.log('   registry.js not built yet: skipping the search checks');
else {
  const ctx = { chrome: { runtime: { getURL: p => 'chrome-extension://abc/' + p, sendMessage() { }, lastError: null }, tabs: {}, windows: {} }, console, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(read('registry.js'), ctx); vm.runInContext(read('open.js'), ctx);
  const R = ctx.LV_REGISTRY, O = ctx.LV_OPEN;
  ok(R && Array.isArray(R.modules) && R.modules.length >= 1 && R.wings.some(w => w.id === 'legal'), 'registry.js lists dashboards and wings', `${R.modules.length} dashboards, ${R.wings.length} wings`);
  ok(O.appUrl('hvac.paid') === 'chrome-extension://abc/app.html#hvac.paid' && O.appUrl('') === 'chrome-extension://abc/app.html', 'appUrl builds the wrapper url with the route in the hash');
  const core = R.modules.find(m => m.id === 'core');
  ok(!core || O.modTitle(core) === 'OmegaWeapon', 'the core is titled OmegaWeapon like the spine');
  const dental = R.modules.find(m => m.id === 'dental');
  if (dental) { const r = O.search('dental'); ok(r.length && r[0].route === 'dental', 'search("dental") puts the Dental Divide first', r.slice(0, 3).map(x => x.route).join(', ')); }
  const hvac = R.modules.find(m => m.id === 'hvac');
  if (hvac && hvac.mods.some(x => x.key === 'paid')) ok(O.resolve('hvac.paid') === 'hvac.paid', 'resolve keeps an exact route');
  ok(O.resolve('zzzz qqqq') === 'command' && O.resolve('') === 'command', 'resolve falls back to the Command Deck');
  ok(O.search('convergence')[0].route === 'convergence', 'the console views are searchable');
  const every = O.entries(); ok(every.length > R.modules.length, 'entries include the modules inside the atlases', every.length);
}
if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
