/* Rewrite the script list in app.html from the files on disk: data, shared layers (src/0x, src/1x), the CMS layer, modules (src/2x to
   src/8x), the boot. Run after adding or renaming a source file: node tools/order.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ls = d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).sort().map(f => d + '/' + f);
const src = ls('src'); const cms = ls('src/cms');
const data = ['data/suite.js', ...ls('data').filter(f => /^data\/(live|watch)[-_]/.test(f))];
const shared = src.filter(f => /^src\/[01]\d_/.test(f)); const mods = src.filter(f => /^src\/[2-8]\d_/.test(f)); const boot = src.filter(f => /^src\/99_/.test(f));
const tag = f => `<script src="${f}"></script>`;
const block = [
  '<!-- data: the suite; the six Metro Atlas files load on first use -->', ...data.map(tag),
  '<!-- shared layers: core, kit, firm profile, compliance engine, forge, accounts, watch and signal cores -->', ...shared.map(tag),
  '<!-- CMS publish layer (shared with the Thermal Atlas): the contract, one adapter per platform, the headless kit -->', ...cms.map(tag),
  '<!-- modules, in file order; the boot sorts the rail -->', ...mods.map(tag),
  '<!-- boot: builds the rail and shows the module in the hash -->', ...boot.map(tag)].join('\n');
const p = path.join(ROOT, 'app.html'); let html = fs.readFileSync(p, 'utf8');
const css = fs.existsSync(path.join(ROOT, 'css')) ? fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css')).sort().map(f => 'css/' + f) : [];
html = html.replace(/(<link rel="stylesheet" href="[^"]+">\n?)+/, ['app.css', ...css].map(f => `<link rel="stylesheet" href="${f}">`).join('\n') + '\n');
const a = html.indexOf('<!-- data:'), b = html.lastIndexOf('</body>');
html = html.slice(0, a) + block + '\n' + html.slice(b);
fs.writeFileSync(p, html);
console.log(`app.html: ${css.length + 1} stylesheets, ${data.length} data, ${shared.length} shared, ${cms.length} cms, ${mods.length} modules, ${boot.length} boot`);
