/* The built console in console/: the patch markers, the bridge script, the companion payloads and registry.js in step. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ANCHORS, MARKERS, extractRegistry, patchConsole, EXT_VERSION } from '../lib/patch.mjs';
import { scrubPayloads } from '../lib/scrub.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 220) + ')' : ''}`); if (!c) fails++; };

if (!exists('console/Leviathan.html')) { console.log('console/Leviathan.html is not built; run node build.mjs --from <Leviathan repository>. Skipping.'); process.exit(0); }
const c = read('console/Leviathan.html');
for (const m of MARKERS) ok(c.split(m).length - 1 === 1, `marker once: ${m}`);
ok(!c.includes(ANCHORS.srcdoc), 'no unpatched srcdoc assignment remains');
ok(c.indexOf('<script src="ext/host-bridge.js"></script>') < c.indexOf(ANCHORS.frameStart), 'the bridge script loads before the frame script');
ok(exists('console/ext/host-bridge.js'), 'console/ext/host-bridge.js is present');
for (const f of ['console/ext/resume-findings.js', 'console/ext/resume-engine.js', 'console/ext/resume-forge.js']) {
  ok(exists(f), `${f} is present`);
  if (exists(f)) { let p = true; try { new vm.Script(read(f)); } catch (e) { p = false; console.log('   ' + e.message); } ok(p, `${f} parses`); }
}
ok(c.indexOf('<script src="ext/resume-forge.js"></script>') < c.indexOf(ANCHORS.frameStart), 'the Forge scripts load before the frame script');
{
  const a = c.indexOf(ANCHORS.frameStart) + '<script>'.length, b = c.indexOf('</script>', a);
  let p = true; try { new vm.Script(c.slice(a, b)); } catch (e) { p = false; console.log('   ' + e.message); }
  ok(p, 'the patched frame script parses', `${b - a} bytes`);
}
const reg = extractRegistry(c);
ok(reg.modules.length >= 16 && reg.consoleVersion, 'the console registry reads', `${reg.modules.length} dashboards, console ${reg.consoleVersion}, compiled ${reg.compiled}`);
/* the console this copy was built from: LV_CONSOLE_SRC when build.mjs ran us with --from or --fetch, else ../leviathan beside this folder */
const SIB = process.env.LV_CONSOLE_SRC || path.resolve(ROOT, '..', 'leviathan');
const SIBN = process.env.LV_CONSOLE_SRC ? SIB : '../leviathan';
if (fs.existsSync(path.join(SIB, 'Leviathan.html'))) {
  ok(scrubPayloads(patchConsole(fs.readFileSync(path.join(SIB, 'Leviathan.html'), 'utf8'), { version: EXT_VERSION })).text === c, `console/Leviathan.html is ${SIBN}/Leviathan.html plus the patch and the scrub, byte for byte`);
  for (const x of reg.ext) if (fs.existsSync(path.join(SIB, x.file)) && exists('console/' + x.file)) ok(scrubPayloads(fs.readFileSync(path.join(SIB, x.file), 'utf8')).text === read('console/' + x.file), `console/${x.file} is ${SIBN}/${x.file} (scrubbed), byte for byte`);
} else console.log(`   (no console source at ${SIBN}; the byte for byte comparison is skipped)`);
for (const x of reg.ext) {
  ok(exists('console/' + x.file), `companion present: console/${x.file}`);
  if (exists('console/' + x.file)) { const d = read('console/' + x.file); for (const id of x.ids) ok(d.includes(`window.__LVP["${id}"]=`), `${x.file} carries ${id}`); }
}
const inline = [...c.matchAll(/<script type="text\/plain" id="lvp-([^"]+)">/g)].map(m => m[1]);
const extIds = reg.ext.flatMap(x => x.ids);
for (const m of reg.modules) ok(inline.includes(m.id) || extIds.includes(m.id), `payload for ${m.id} is inline or in a companion`);
ok(exists('registry.js'), 'registry.js is present');
if (exists('registry.js')) {
  const ctx = vm.createContext({}); vm.runInContext(read('registry.js'), ctx); const R = ctx.LV_REGISTRY;
  ok(R.modules.map(x => x.id).join() === reg.modules.map(x => x.id).join(), 'registry.js lists the same dashboards as the console');
  ok(R.consoleVersion === reg.consoleVersion && R.compiled === reg.compiled, 'registry.js carries the console version and compile date');
}
if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
