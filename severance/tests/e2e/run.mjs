/* End to end: every module in the single file and in the unpacked extension, light and dark, desktop and phone.
     node tests/e2e/run.mjs            the single file (../dist/Severance_2.html, built first with node build.mjs --single) and the extension
     node tests/e2e/run.mjs --file     the single file only
     node tests/e2e/run.mjs --ext      the extension only
   Checks for each module: it mounts without a module error, no page error or console error, no NaN, undefined, Infinity or
   [object Object] in the visible text, no horizontal scroll at 390 px; the extension's service worker, popup and options pages load.
   Screenshots land in tests/e2e/shots/. Exit code 1 on any failure. */
import fs from 'node:fs';
import path from 'node:path';
import { launchExtension, openFile, EXT } from './launch.mjs';
const args = new Set(process.argv.slice(2));
const SHOTS = path.join(EXT, 'tests', 'e2e', 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const SINGLE = path.resolve(EXT, '..', 'dist', 'Severance_2.html');
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
const BAD = /\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]/;
async function sweep(page, errors, label) {
  const keys = await page.$$eval('#rail button[role=tab]', bs => bs.map(b => b.id.slice(4)));
  ok(keys.length >= 24, `${label}: rail has ${keys.length} modules`);
  for (const k of keys.concat(['method'])) {
    const before = errors.length; const t0 = Date.now();
    await page.evaluate(key => showModule(key), k); await page.waitForTimeout(350);
    const r = await page.evaluate(key => { const s = document.querySelector('#mod-' + key); const txt = s ? s.innerText : ''; return { mounted: !!s && !s.hidden, err: /Module error|failed to load/i.test(txt.slice(0, 600)), bad: (txt.match(/.{0,40}(\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]).{0,40}/) || [''])[0], len: txt.length }; }, k);
    ok(r.mounted && !r.err, `${label} #${k}: did not mount cleanly`);
    ok(!r.bad, `${label} #${k}: bad text "${r.bad}"`);
    ok(r.len > 200, `${label} #${k}: almost empty (${r.len} chars)`);
    errors.slice(before).forEach(e => fails.push(`${label} #${k}: ${e}`));
    if (Date.now() - t0 > 4000) fails.push(`${label} #${k}: took ${Date.now() - t0} ms`);
  }
  return keys;
}
async function phone(page, errors, label, keys) {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    for (const k of keys) {
      await page.evaluate(key => showModule(key), k); await page.waitForTimeout(200);
      const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, culprit: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.tblwrap,.mapwrap,.xscroll,.row,pre,textarea')).slice(0, 2).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) }));
      ok(w.sw <= w.iw + 1, `${label} #${k} ${theme} 390px: page scrolls sideways (${w.sw} > ${w.iw}) ${w.culprit.join(' ')}`);
      if (['index', 'desk', 'forge', 'publish', 'accounts', 'watch', 'live', 'compliance'].includes(k)) await page.screenshot({ path: path.join(SHOTS, `${label}_${k}_390_${theme}.png`) });
    }
  }
  await page.setViewportSize({ width: 1400, height: 1000 });
}
if (!args.has('--ext')) {
  if (!fs.existsSync(SINGLE)) { console.log('build the single file first: node build.mjs --single'); process.exit(1); }
  const { page, errors, close } = await openFile(SINGLE);
  await page.waitForTimeout(1500);
  const keys = await sweep(page, errors, 'file');
  for (const k of ['index', 'desk', 'forge', 'publish', 'accounts', 'watch', 'live', 'compliance']) if (keys.includes(k)) { await page.evaluate(key => showModule(key), k); await page.waitForTimeout(300); await page.screenshot({ path: path.join(SHOTS, `file_${k}_1400.png`) }); }
  await phone(page, errors, 'file', keys);
  console.log(`file: ${keys.length} modules swept`);
  await close();
}
if (!args.has('--file')) {
  const { context, id, page, errors, close } = await launchExtension();
  await page.goto(`chrome-extension://${id}/app.html#index`); await page.waitForTimeout(2000);
  const keys = await sweep(page, errors, 'ext');
  await page.evaluate(() => showModule('atlas')); await page.waitForTimeout(2500);
  ok(await page.evaluate(() => !!document.querySelector('#mod-atlas svg')), 'ext #atlas: the Metro Atlas did not load its data file');
  for (const p of ['popup.html', 'options.html']) {
    const pg = await context.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/net::ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await pg.goto(`chrome-extension://${id}/${p}`); await pg.waitForTimeout(1200);
    ok(!errs.length, `ext ${p}: ${errs.join(' | ')}`); ok((await pg.evaluate(() => document.body.innerText.length)) > 40, `ext ${p}: empty`);
    await pg.screenshot({ path: path.join(SHOTS, `ext_${p.replace('.html', '')}.png`) }); await pg.close();
  }
  console.log(`extension ${id}: ${keys.length} modules swept`);
  await close();
}
if (fails.length) { console.log('\nFAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\ne2e ok');
