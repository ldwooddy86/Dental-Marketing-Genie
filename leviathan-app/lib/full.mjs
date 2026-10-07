/* The single file edition: the Leviathan repository's Leviathan-full.html (every payload inline) with the browser app's
   patches applied and the four ext scripts written inline in place of their <script src> tags, so the file needs nothing
   beside it: it opens from disk, from any static host and inside the extension alike. The payloads are scrubbed of the
   withheld rows like every other build. */
import fs from 'node:fs';
import path from 'node:path';
import { patchConsole, MARKERS } from './patch.mjs';
import { scrubPayloads } from './scrub.mjs';

export const EXT_FILES = ['host-bridge.js', 'resume-findings.js', 'resume-engine.js', 'resume-forge.js'];

/* a script's text made safe inside an HTML script block: a closing tag inside a string or comment is escaped */
export const inlineSafe = js => js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

/* replaces each <script src="ext/<name>"></script> with the file's text inline; throws when a tag or a file is missing */
export function inlineExt(html, extDir) {
  let out = html;
  for (const name of EXT_FILES) {
    const tag = `<script src="ext/${name}"></script>`;
    if (out.split(tag).length !== 2) throw new Error(`the console carries ${out.split(tag).length - 1} tags for ext/${name}, expected one`);
    const file = path.join(extDir, name);
    if (!fs.existsSync(file)) throw new Error(`ext/${name} is missing beside the console (${file})`);
    out = out.replace(tag, () => `<script>/* ext/${name} (inline) */\n${inlineSafe(fs.readFileSync(file, 'utf8'))}\n</script>`);
  }
  return out;
}

/* the heads of the inline blocks, and the edition with those blocks cut out (the patch markers are counted on that, since
   the Forge script itself repeats some of them) */
export const INLINE_HEADS = EXT_FILES.map(f => `<script>/* ext/${f} (inline) */`);
export const withoutInline = html => html.replace(/<script>\/\* ext\/[a-z-]+\.js \(inline\) \*\/[\s\S]*?\n<\/script>/g, '');

/* checks a single file edition: every patch marker once outside the inline blocks, each inline block once, no <script src> */
export function checkFull(html) {
  const problems = [];
  const bare = withoutInline(html);
  for (const m of MARKERS) { if (/^<script src=/.test(m)) continue; const n = bare.split(m).length - 1; if (n !== 1) problems.push(`marker "${m.slice(0, 60)}" occurs ${n} times, expected once`); }
  for (const h of INLINE_HEADS) { const n = html.split(h).length - 1; if (n !== 1) problems.push(`inline block "${h}" occurs ${n} times, expected once`); }
  if (/<script[^>]*\bsrc=/.test(html)) problems.push('a <script src> remains');
  return problems;
}

/* builds the single file edition from the repository's Leviathan-full.html: {html, changes} */
export function fullEdition(fullHtml, { extDir, version }) {
  const sc = scrubPayloads(patchConsole(fullHtml, { version }));
  const html = inlineExt(sc.text, extDir);
  const problems = checkFull(html);
  if (problems.length) throw new Error('single file edition: ' + problems.join('; '));
  return { html, changes: sc.changes };
}
