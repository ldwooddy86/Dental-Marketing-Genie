/* lib/full.mjs: the single file edition inlines the four ext scripts in place of their tags, escapes a closing tag inside
   them, keeps every marker once and carries no <script src>. Run on a synthetic console and, when it is present, on the
   built edition in ../dist. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlineSafe, inlineExt, checkFull, withoutInline, INLINE_HEADS, EXT_FILES } from '../lib/full.mjs';
import { MARKERS } from '../lib/patch.mjs';
import { findInText } from '../lib/scrub.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 220) + ')' : ''}`); if (!c) fails++; };

ok(inlineSafe("a = '</script>'; b = '</SCRIPT>'; c = '<!-- x'") === "a = '<\\/script>'; b = '<\\/SCRIPT>'; c = '<\\!-- x'" && inlineSafe('plain') === 'plain', 'a closing tag or a comment opener inside a script is escaped');
ok(INLINE_HEADS.length === 4 && MARKERS.filter(m => /^<script src=/.test(m)).length === 4, 'four inline heads stand in for the four script tag markers');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-full-'));
for (const f of EXT_FILES) fs.writeFileSync(path.join(tmp, f), `/* ${f} */ var x_${f.replace(/[^a-z]/g, '_')} = "</script>";`);
const tags = EXT_FILES.map(f => `<script src="ext/${f}"></script>`).join('\n');
const html = `<html><head>\n${tags}\n<script>/* frame */</script></head></html>`;
const out = inlineExt(html, tmp);
ok(!/<script src=/.test(out) && EXT_FILES.every(f => out.includes(`<script>/* ext/${f} (inline) */`)) && out.includes('"<\\/script>"') && out.endsWith('<script>/* frame */</script></head></html>'), 'the four tags become inline blocks with the file text, escaped', out.slice(0, 160));
ok(withoutInline(out).replace(/\n+/g, '\n') === html.replace(tags, '').replace(/\n+/g, '\n') && withoutInline(out).includes('/* frame */'), 'withoutInline cuts exactly the inline blocks');
let threw = null; try { inlineExt(html.replace(tags, tags + '\n' + tags), tmp); } catch (e) { threw = e.message; }
ok(threw && /expected one/.test(threw), 'a duplicated tag fails loudly', threw);
threw = null; try { inlineExt(html, path.join(tmp, 'nowhere')); } catch (e) { threw = e.message; }
ok(threw && /is missing/.test(threw), 'a missing ext file fails loudly', threw);
fs.rmSync(tmp, { recursive: true, force: true });

/* the built edition: in place beside the console in the Leviathan repository, else under ../dist */
const built = [path.join(ROOT, '..', 'leviathan', 'Leviathan-full.html'), path.join(ROOT, '..', 'dist', 'Leviathan-full.html')].find(f => fs.existsSync(f) && /<meta name="lv-ext"/.test(fs.readFileSync(f, 'latin1').slice(0, 4000)));
if (built) {
  const t0 = Date.now();
  const h = fs.readFileSync(built, 'utf8');
  ok(h.length > 60 * 1024 * 1024, 'the built single file edition is over 60 MB', (h.length / 1048576).toFixed(1) + ' MB');
  const problems = checkFull(h);
  ok(problems.length === 0, 'every marker once outside the inline blocks, each inline block once, no external script', problems.join('; '));
  const inline = [...h.matchAll(/<script type="text\/plain" id="lvp-([^"]+)">/g)].map(m => m[1]);
  ok(inline.length === 16 && inline.includes('family') && inline.includes('employment'), 'all sixteen payloads are inline', inline.join(','));
  ok(EXT_FILES.every(f => h.includes(`<script>/* ext/${f} (inline) */\n` + inlineSafe(fs.readFileSync(path.join(ROOT, 'console', 'ext', f), 'utf8').slice(0, 400)))), 'each inline block opens with its file\'s own text');
  ok(findInText(h).length === 0, 'nothing withheld in the built edition', `${Date.now() - t0} ms`);
} else console.log('   (no built single file edition beside this folder; its checks are skipped)');

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
