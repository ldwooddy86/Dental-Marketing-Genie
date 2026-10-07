/* lib/patch.mjs: the anchored console patches, the registry extraction and the zip writer, on a synthetic console. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { ANCHORS, MARKERS, patchConsole, replaceOnce, extractRegistry, registryScript, writeZip, crc32, EXT_VERSION } from '../lib/patch.mjs';
let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 220) + ')' : ''}`); if (!c) fails++; };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

const LV = {
  compiled: '2026-10-06',
  modules: [
    { id: 'core', wing: 'core', vertical: 'Agency intelligence', short: 'OmegaWeapon', mods: [{ key: 'pulse', num: '01', title: 'Pulse' }] },
    { id: 'employment', wing: 'legal', vertical: 'Employment law', short: 'Termination Exposure', scopeLabel: 'Every buyable US ZIP', mods: [] },
    { id: 'hvac', wing: 'home', vertical: 'HVAC', short: 'Thermal Debt', name: 'Louisiana Thermal Debt Atlas', navTitle: 'HVAC · Louisiana', facts: ['1.50M central systems'], mods: [{ key: 'index', num: '01', title: 'Thermal Debt Index', desc: 'Where' }, { key: 'paid', num: '05', title: 'Paid Acquisition' }] },
    { id: 'dental', wing: 'health', vertical: 'Dental', short: 'Dental Divide', scope: 'national', mods: [] },
  ],
  verts: [{ key: 'hvac', mod: 'hvac', states: ['LA'] }, { key: 'emp', mod: 'employment', states: ['TX', 'LA'] }],
  wings: [], ext: [{ file: 'Leviathan-data.js', ids: ['dental'] }],
};
const MINI = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Leviathan</title>\n</head>\n<body>\n` +
  `<script type="application/json" id="lv-data">${JSON.stringify(LV)}</script>\n<script type="text/plain" id="lvp-core">H4sI</script>\n` +
  `${ANCHORS.frameStart}\n(function () {\n${ANCHORS.isFramed}\nconst PREF_KEY = 'leviathan.prefs.v1';\nconst prefs = (() => {\n  const d = { theme: 'system', rail: 'console', spine: 'open' };\n${ANCHORS.prefsLoad}\n})();\n${ANCHORS.prefsSave}\n` +
  `async function loadInto(L) {\n    const f = h('iframe');\n${ANCHORS.srcdoc}    L.frame = f;\n}\nwindow.__LV_CONSOLE = { live, open: openModule, go, prefs, version: '1.2.0' };\n})();\n</script>\n</body>\n</html>\n`;

/* replaceOnce */
ok(replaceOnce('a b c', 'b', 'x', 't') === 'a x c', 'replaceOnce replaces a single occurrence');
ok(throws(() => replaceOnce('a b b', 'b', 'x', 'dup'), /dup: the anchor occurs 2 times/), 'replaceOnce refuses two occurrences');
ok(throws(() => replaceOnce('a', 'b', 'x', 'none'), /none: the anchor occurs 0 times/), 'replaceOnce refuses a missing anchor');
ok(replaceOnce('a b', 'b', '$&$1', 't') === 'a $&$1', 'replaceOnce keeps dollar signs literal');

/* patchConsole */
const out = patchConsole(MINI);
for (const m of MARKERS) ok(out.split(m).length - 1 === 1, `marker once: ${m}`);
ok(!out.includes(ANCHORS.srcdoc), 'the plain srcdoc assignment is gone');
ok(out.indexOf('<script src="ext/host-bridge.js"></script>') < out.indexOf(ANCHORS.frameStart), 'the bridge script precedes the frame script');
ok(out.includes(`<meta name="lv-ext" content="${EXT_VERSION}">`), 'the head carries the app version marker');
ok(patchConsole(MINI, { version: '9.9.9' }).includes('content="9.9.9"'), 'the marker takes the version passed in');
ok(throws(() => patchConsole(out), /already carries/), 'a patched console is not patched twice');
ok(throws(() => patchConsole(MINI + ANCHORS.isFramed), /isFramed: the anchor occurs 2 times/), 'a duplicated anchor fails the build by name');
ok(throws(() => patchConsole(MINI.replace(ANCHORS.prefsSave, '')), /prefs save: the anchor occurs 0 times/), 'a missing anchor fails the build by name');
{
  const a = out.indexOf(ANCHORS.frameStart) + '<script>'.length, b = out.indexOf('</script>', a);
  let parses = true; try { new vm.Script(out.slice(a, b)); } catch (e) { parses = false; console.log('   ' + e.message); }
  ok(parses, 'the patched frame script still parses');
}

/* extractRegistry */
const reg = extractRegistry(MINI, { version: '1.0.0', built: '2026-10-07' });
ok(reg.consoleVersion === '1.2.0' && reg.compiled === '2026-10-06' && reg.version === '1.0.0' && reg.built === '2026-10-07', 'registry header: console version, compiled date, app version, build date', JSON.stringify([reg.consoleVersion, reg.compiled, reg.version, reg.built]));
ok(reg.wings.map(w => w.id).join() === 'core,legal,home,health' && reg.wings[2].label === 'Home services' && reg.wings[2].mods.join() === 'hvac', 'wings in console order with labels and atlas lists', JSON.stringify(reg.wings));
const by = Object.fromEntries(reg.modules.map(m => [m.id, m]));
ok(by.hvac.scope === 'Louisiana' && by.employment.scope === 'Every buyable US ZIP' && by.dental.scope === 'National' && by.core.scope === '', 'scope labels: states from the verticals, scopeLabel, national', JSON.stringify([by.hvac.scope, by.employment.scope, by.dental.scope, by.core.scope]));
ok(by.hvac.navTitle === 'HVAC · Louisiana' && by.hvac.mods.length === 2 && by.hvac.mods[1].key === 'paid' && by.hvac.facts[0] === '1.50M central systems', 'module fields carry over', JSON.stringify(by.hvac));
ok(reg.ext.length === 1 && reg.ext[0].file === 'Leviathan-data.js' && reg.views.length === 3 && reg.views[0].route === 'command', 'companion files and console views are listed');
ok(throws(() => extractRegistry('<html></html>'), /lv-data block is missing/), 'a console without the registry block is refused');
{
  const ctx = vm.createContext({}); vm.runInContext(registryScript(reg), ctx);
  const R = vm.runInContext('globalThis.LV_REGISTRY', ctx);
  ok(R && R.modules.length === 4 && R.wings.length === 4, 'registry.js evaluates to the same registry');
}

/* zip */
ok(crc32(Buffer.from('')) === 0 && crc32(Buffer.from('a')) === 0xE8B7BE43, 'crc32 reference values');
{
  const entries = [{ name: 'manifest.json', data: Buffer.from('{"a":1}') }, { name: 'console/big.txt', data: Buffer.alloc(5000, 'x') }];
  const buf = writeZip(entries, new Date(2026, 9, 7, 12, 0, 0));
  const eocd = buf.readUInt32LE(buf.length - 22) === 0x06054b50, n = buf.readUInt16LE(buf.length - 12);
  ok(eocd && n === 2, 'zip has an end of central directory record with both entries', n);
  ok(buf.length < 5000, 'the repeated file is deflated', buf.length);
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lv-zip-')), 't.zip'); fs.writeFileSync(tmp, buf);
  const r = spawnSync('unzip', ['-t', tmp], { encoding: 'utf8' });
  if (r.error) console.log('   (unzip not installed; skipped the external check)'); else ok(r.status === 0 && /No errors detected/.test(r.stdout), 'unzip -t accepts the archive', r.stdout.trim().split('\n').pop());
}
if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
