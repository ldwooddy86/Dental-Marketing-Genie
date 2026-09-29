/* OmegaWeapon app smoke test: opens the standalone page (and, when a folder is given, the unpacked extension) in
   headless Chromium, walks every wing, a sample of dossier tabs and any hosted target, and fails on any page error or
   console error. No network: the page and the extension are read from disk.

   Usage:
     node tests/app_smoke.mjs dist/omegaweapon.html [dist/omegaweapon-chrome] [--shots DIR] [--all-agencies]
   Requires Playwright for Node with Chromium (this container: /opt/node22/lib/node_modules/playwright, /opt/pw-browsers). */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PW = ['/opt/node22/lib/node_modules/playwright/index.mjs', 'playwright'];
let chromium;
for (const p of PW) { try { ({ chromium } = await import(p)); break; } catch (e) { /* next */ } }
if (!chromium) { console.error('Playwright for Node not found'); process.exit(2); }
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

const args = process.argv.slice(2);
const html = args.find(a => a.endsWith('.html'));
const extDir = args.find(a => !a.startsWith('--') && a !== html && fs.existsSync(path.join(a, 'manifest.json')));
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const allAgencies = args.includes('--all-agencies');
if (!html) { console.error('usage: node tests/app_smoke.mjs dist/omegaweapon.html [dist/omegaweapon-chrome] [--shots DIR] [--all-agencies]'); process.exit(2); }
if (shots) fs.mkdirSync(shots, { recursive: true });

const failures = [];
function attach(page, label) {
  page.on('pageerror', e => failures.push(`${label}: pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') failures.push(`${label}: console: ${m.text()}`); });
  page.on('requestfailed', r => { if (!/^(chrome-extension|file|data|blob):/.test(r.url())) failures.push(`${label}: network request: ${r.url()}`); });
  page.on('request', r => { if (/^https?:/.test(r.url())) failures.push(`${label}: network request attempted: ${r.url()}`); });
}
async function settle(page) { await page.waitForFunction(() => document.getElementById('app-root') && document.getElementById('app-root').childElementCount > 0, null, { timeout: 30000 }); await page.waitForTimeout(150); }
async function visit(page, base, hash, label) {
  await page.goto(base + hash, { waitUntil: 'load' });
  await settle(page);
  const empty = await page.evaluate(() => document.getElementById('app-root').innerText.trim().length < 40);
  if (empty) failures.push(`${label}: ${hash} rendered (almost) nothing`);
  if (shots) await page.screenshot({ path: path.join(shots, (label + hash).replace(/[^a-z0-9.#-]+/gi, '_') + '.png'), fullPage: false });
}

async function walk(page, base, label) {
  const views = await page.evaluate(() => Array.from(document.querySelectorAll('nav a[href^="#"], .tabs a[href^="#"]')).map(a => a.getAttribute('href')));
  const wings = ['#pulse', '#targets', '#horus', '#offshore', '#agencies', '#matrix', '#clients', '#paid', '#gaps', '#compare', '#watch', '#method', '#queue'];
  for (const w of wings) await visit(page, base, w, label);
  const ids = await page.evaluate(() => window.RADAR ? window.RADAR.agencies.map(a => a.id) : []);
  const sample = allAgencies ? ids : ids.filter((_, i) => i % 23 === 0).concat(ids.slice(-2));
  const tabs = ['overview', 'dossier', 'horus', 'offshore', 'omega', 'strategy', 'clients', 'paid', 'content', 'moves', 'sources'];
  for (const id of sample) for (const t of tabs) await visit(page, base, `#a.${id}.${t}`, label);
  const targets = await page.evaluate(() => (window.OMEGA_TARGETS && window.OMEGA_TARGETS.targets || []).map(t => t.summary.key));
  for (const k of targets) {
    await visit(page, base, `#t/${k}`, label);
    const rail = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="#t/"]')).map(a => a.getAttribute('href')));
    for (const r of [...new Set(rail)].slice(0, 20)) await visit(page, base, r, label);
  }
  // theme cycle and search must not throw
  await visit(page, base, '#agencies', label);
  await page.evaluate(() => { const b = document.querySelector('button[aria-label*="heme"], button.theme'); if (b) b.click(); });
  await page.evaluate(() => { const i = document.querySelector('input[type="search"]'); if (i) { i.value = 'seo'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
  await page.waitForTimeout(200);
  return { views: views.length, agencies: ids.length, sampled: sample.length, targets: targets.length };
}

const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });
try {
  for (const [w, hgt, tag] of [[1400, 1000, 'desktop'], [390, 844, 'phone']]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, colorScheme: scheme });
      const page = await ctx.newPage();
      const label = `standalone-${tag}-${scheme}`;
      attach(page, label);
      const base = pathToFileURL(path.resolve(html)).href;
      const r = await walk(page, base, label);
      const scrollX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (scrollX) failures.push(`${label}: horizontal page scroll at ${w}px`);
      console.log(`${label}: wings ok, ${r.agencies} agencies (${r.sampled} sampled), ${r.targets} targets`);
      await ctx.close();
    }
  }
} finally { await browser.close(); }

if (extDir) {
  const ext = path.resolve(extDir);
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext, '--no-sandbox'], viewport: { width: 1400, height: 1000 } });
  try {
    let sw = context.serviceWorkers()[0]; if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
    sw.on('console', m => { if (m.type() === 'error') failures.push('extension worker: console: ' + m.text()); });
    const id = new URL(sw.url()).host;
    const page = await context.newPage(); attach(page, 'extension');
    const r = await walk(page, `chrome-extension://${id}/app.html`, 'extension');
    console.log(`extension: wings ok, ${r.agencies} agencies (${r.sampled} sampled), ${r.targets} targets`);
    for (const p of ['popup.html', 'sidepanel.html']) {
      const pg = await context.newPage(); attach(pg, p);
      await pg.goto(`chrome-extension://${id}/${p}`, { waitUntil: 'load' }); await pg.waitForTimeout(600);
      if (shots) await pg.screenshot({ path: path.join(shots, 'extension_' + p + '.png') });
      await pg.close();
    }
  } finally { await context.close(); }
}

const uniq = [...new Set(failures)];
if (uniq.length) { console.error(`FAIL: ${uniq.length} problem(s)`); for (const f of uniq) console.error('  ' + f); process.exit(1); }
console.log('PASS: no page errors, no console errors, no network requests, no sideways scroll');
