/* Smoke test for module 16 · Publish. Loads the unpacked extension into headless Chromium with Playwright, opens
   app.html#publish, and checks: the module renders without page errors or console errors, the composer adds a page row,
   the preview iframe renders the page title, a target can be picked, and the module still renders with zero adapters.
   Saves tests/e2e/publish.png. Run: node tests/e2e/publish.smoke.mjs   (Playwright global install, chromium under /opt/pw-browsers).
   Not part of `node tests/run.mjs` (it needs a browser); it exits 1 on any failed assertion. */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT = path.join(ROOT, 'tests', 'e2e', 'publish.png');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch (e) { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const checks = []; let failed = 0;
const ok = (cond, label, extra) => { checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  (' + extra + ')' : ''}`); if (!cond) failed++; };

/* the default headless shell cannot load extensions; the full chromium channel with the new headless mode can (see launch.mjs) */
async function launch() {
  const base = { headless: true, args: ['--headless=new', '--disable-extensions-except=' + ROOT, '--load-extension=' + ROOT, '--no-sandbox'], viewport: { width: 1400, height: 1000 } };
  try { return await chromium.launchPersistentContext('', Object.assign({ channel: 'chromium' }, base)); }
  catch (e) { console.log('channel chromium failed, retrying with the default build: ' + e.message.split('\n')[0]); return chromium.launchPersistentContext('', base); }
}
const context = await launch();
let sw = context.serviceWorkers()[0]; if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
const id = new URL(sw.url()).host;
const page = await context.newPage();
const errors = [], warnings = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); const u = (m.location() || {}).url || ''; if (/Failed to load resource|net::ERR_/.test(t) && !/chrome-extension:/.test(u)) warnings.push('external resource: ' + t + ' ' + u); else errors.push('console: ' + t + (u ? ' @ ' + u : '')); });

try {
  await page.goto(`chrome-extension://${id}/app.html#publish`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mod-publish .mast', { timeout: 30000 });
  ok(true, 'module 16 mast rendered');
  const eyebrow = await page.textContent('#mod-publish .mast .eyebrow');
  ok(/Module 16 · Publish/.test(eyebrow || ''), 'eyebrow names module 16', eyebrow);
  await page.waitForFunction(() => { const t = document.querySelector('#p16Targets'); return t && (t.querySelector('.conn') || t.querySelector('.callout')); }, null, { timeout: 15000 });
  const nAd = await page.$$eval('#p16Targets .conn', els => els.length);
  const adapterIds = await page.evaluate(() => CMS.list().map(a => a.id));
  ok(nAd === adapterIds.length, `one card per registered adapter (${nAd})`, adapterIds.join(', ') || 'none registered');
  const groups = await page.$$eval('#p16Targets .pb-group .dsec', els => els.map(e => e.textContent.trim()));
  ok(nAd === 0 || groups.length > 0, 'cards are grouped by adapter.group', groups.join(' | '));
  const nOpt = await page.$$eval('#p16Target option', els => els.length);
  ok(nOpt === nAd + 1, 'target select lists every adapter');
  const kpi = await page.textContent('#p16Kpis');
  ok(/Targets/.test(kpi) && /Pages loaded/.test(kpi) && /Pages sent/.test(kpi) && /Last deploy/.test(kpi), 'KPIs rendered');
  ok(await page.$eval('#p16Env .callout', e => e.textContent.length > 40), 'environment callout rendered');
  /* select-type, checkbox-type and password fields are generated from adapter.fields */
  if (nAd) {
    const kinds = await page.$$eval('#p16Targets .conn [data-k]', els => [...new Set(els.map(e => e.tagName.toLowerCase() + ':' + (e.type || '')))]);
    ok(kinds.some(k => k.startsWith('input:password')), 'secret fields render as password inputs', kinds.join(' '));
    ok(kinds.some(k => k.startsWith('select')), 'select fields render as selects');
    ok(kinds.some(k => k === 'input:checkbox'), 'checkbox fields render as checkboxes');
    const stepsN = await page.$$eval('#p16Targets .conn details.cdet', els => els.length);
    ok(stepsN === nAd * 2, 'each card has Setup and Clear details blocks');
  }

  /* composer: title → slug, starter template, add → row */
  await page.click('#p16Tabs button[data-v="composer"]');
  await page.fill('#p16cTitle', 'AC Repair in Mesquite');
  const slugV = await page.inputValue('#p16cSlug');
  ok(slugV === 'ac-repair-in-mesquite', 'slug follows the title', slugV);
  await page.fill('#p16cMeta', 'Same day AC repair across Mesquite and Dallas Fort Worth with written prices before the work starts and licensed technicians.');
  const metaN = await page.textContent('#p16cMetaN');
  ok(/\/ 155$/.test((metaN || '').trim()), 'meta description counter is live', metaN);
  await page.click('#p16cTmpl');
  const htmlV = await page.inputValue('#p16cHtml');
  ok(/<h1>AC Repair in Mesquite<\/h1>/.test(htmlV) && /forge-faq/.test(htmlV) && /forge-answer/.test(htmlV), 'starter template inserted with h1, lede, answer, faq');
  await page.fill('#p16cSchema', '{"@context":"https://schema.org","@type":"WebPage","name":"AC Repair in Mesquite"}');
  const schemaN = await page.textContent('#p16cSchemaN');
  ok(/valid/.test(schemaN || '') && !/not valid/.test(schemaN || ''), 'JSON-LD validated', schemaN);
  await page.fill('#p16cSchema', '{bad json');
  ok(/not valid/.test(await page.textContent('#p16cSchemaN')), 'invalid JSON-LD reported');
  await page.fill('#p16cSchema', '{"@context":"https://schema.org","@type":"WebPage","name":"AC Repair in Mesquite"}');
  await page.click('#p16cAdd');
  await page.waitForSelector('#p16Pages tbody tr[data-slug="ac-repair-in-mesquite"]', { timeout: 5000 });
  const rows = await page.$$eval('#p16Pages tbody tr', els => els.length);
  ok(rows === 1, 'composer created one page row');
  const rowTxt = await page.textContent('#p16Pages tbody tr');
  ok(/AC Repair in Mesquite/.test(rowTxt) && /ac-repair-in-mesquite/.test(rowTxt), 'row shows title and slug');
  ok(/1 of 1 selected/.test(await page.textContent('#p16SelN')), 'new page is selected');
  ok(/Pages loaded\s*1/.test((await page.textContent('#p16Kpis')).replace(/\s+/g, ' ')), 'KPI counts the loaded page');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('tda.publish.composer') || 'null'));
  ok(draft && draft.title === 'AC Repair in Mesquite', 'composer draft persisted in store');

  /* preview iframe */
  await page.click('#p16Pages tbody tr button[data-a="preview"]');
  await page.waitForSelector('#p16Preview iframe', { timeout: 5000 });
  const fh = await page.$('#p16Preview iframe'); const frame = await fh.contentFrame();
  await frame.waitForSelector('h1', { timeout: 5000 });
  const fTitle = await frame.title(); const fH1 = await frame.textContent('h1');
  ok(/AC Repair in Mesquite/.test(fTitle), 'preview iframe renders the title', fTitle);
  ok(/AC Repair in Mesquite/.test(fH1 || ''), 'preview iframe renders the h1');
  ok(await frame.$('script[type="application/ld+json"]') != null, 'preview carries the JSON-LD');
  ok(await frame.$eval('main', m => !!m.querySelector('.forge-faq')), 'preview carries the forge sections');

  /* target selection and ledger */
  if (nAd) {
    await page.click('#p16Targets .conn input[name="p16Use"]');
    const tv = await page.inputValue('#p16Target');
    ok(tv === adapterIds[0], 'Use as target syncs the target select', tv);
    ok(await page.evaluate(() => CMS.settings().target) === adapterIds[0], 'target persisted in CMS.settings');
    ok(/Nothing sent to/.test(await page.textContent('#p16LedgerT')), 'ledger renders for the target');
    ok(/Deploy 1 selected to/.test(await page.textContent('#p16Go')), 'deploy button names the target and count');
    await page.click('#p16Go');
    const note = await page.textContent('#p16Status');
    ok(/Nothing sent yet/.test(note) || /not configured/.test(note), 'deploy refuses an unconfigured target without throwing');
    ok(!(await page.$eval('#p16Go', b => b.disabled)), 'deploy button is not left disabled');
    await page.click('#p16Verify');
    await page.waitForTimeout(300);
    ok(/not configured/.test(await page.textContent('#p16Status')), 'verify links refuses an unconfigured target without a network call');
    ok(!(await page.$eval('#p16Verify', b => b.disabled)), 'verify links button is not left disabled');
  }

  /* select buttons and remove */
  await page.click('#p16SelNone'); ok(/0 of 1 selected/.test(await page.textContent('#p16SelN')), 'select none');
  await page.click('#p16SelAll'); ok(/1 of 1 selected/.test(await page.textContent('#p16SelN')), 'select all');
  await page.click('#p16SelUnsent'); ok(/1 of 1 selected/.test(await page.textContent('#p16SelN')), 'only unsent keeps an unsent page');

  /* import: an HTML document */
  await page.click('#p16Tabs button[data-v="import"]');
  const html = '<!doctype html><html lang="en"><head><title>Furnace Repair in Plano | Test Co</title><meta name="description" content="Furnace repair in Plano with written prices."><link rel="canonical" href="https://www.example.com/furnace-repair-plano/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Furnace Repair in Plano"}</script><script>alert(1)</script></head><body><header>nav</header><main><section class="forge-section"><h1>Furnace Repair in Plano</h1><p>Body text here.</p></section></main></body></html>';
  await page.setInputFiles('#p16iFile', { name: 'furnace.html', mimeType: 'text/html', buffer: Buffer.from(html) });
  await page.waitForSelector('#p16Pages tbody tr[data-slug="furnace-repair-plano"]', { timeout: 5000 });
  const imp = await page.evaluate(() => MODI.publish.pages().find(p => p.slug === 'furnace-repair-plano'));
  ok(imp && imp.title === 'Furnace Repair in Plano | Test Co' && imp.meta_description === 'Furnace repair in Plano with written prices.' && imp.schema && imp.schema['@type'] === 'WebPage' && /<h1>/.test(imp.html) && !/alert/.test(imp.html) && !/<header>/.test(imp.html), 'HTML import reads title, description, main, JSON-LD and drops scripts');
  /* import: a JSON array with a bundle */
  const bundle = [{ slug: 'ac-tune-up', title: 'AC Tune Up', post_title: 'AC Tune Up', post_type: 'page', status: 'draft', content_html: '<section><h1>AC Tune Up</h1><p>Text</p></section>', seo: { description: 'Tune up.' }, schema: null, elementor_data: [], page_settings: {}, blueprint: { site: { brand: { primary: '#173a69' } }, page: { internal_links: [{ anchor: 'repair', url: '/ac-repair/' }] } } }];
  await page.setInputFiles('#p16iFile', { name: 'ac.bundle.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await page.waitForSelector('#p16Pages tbody tr[data-slug="ac-tune-up"]', { timeout: 5000 });
  ok((await page.$$eval('#p16Pages tbody tr', els => els.length)) === 3, 'bundle import adds a page (3 rows)');
  const impLog = await page.textContent('#p16iLog');
  ok(/furnace\.html: 1 page/.test(impLog) && /ac\.bundle\.json: 1 page/.test(impLog), 'import log reports both files', impLog.replace(/\n/g, ' | '));
  await page.click('#p16Pages tbody tr[data-slug="ac-tune-up"] button[data-a="remove"]');
  ok((await page.$$eval('#p16Pages tbody tr', els => els.length)) === 2, 'remove drops the row');

  /* Site Forge hand off: mounts module 09 silently and loads its plan */
  await page.click('#p16Tabs button[data-v="forge"]');
  await page.click('#p16fLoad');
  await page.waitForFunction(() => /loaded from the Site Forge|plan is empty|Could not load/.test(document.querySelector('#p16fNote').textContent), null, { timeout: 60000 });
  const fNote = await page.textContent('#p16fNote');
  ok(/loaded from the Site Forge/.test(fNote), 'Site Forge pages loaded', fNote);
  const nRows = await page.$$eval('#p16Pages tbody tr', els => els.length);
  ok(nRows > 2, `page table grew with the forge pages (${nRows})`);
  const forgeRow = await page.$eval('#p16Pages tbody tr[data-slug]:not([data-slug="ac-repair-in-mesquite"]):not([data-slug="furnace-repair-plano"])', tr => tr.textContent);
  ok(/block|warn|clean/.test(forgeRow), 'forge rows show their checks', forgeRow.replace(/\s+/g, ' ').slice(0, 140));

  await page.screenshot({ path: SHOT, fullPage: true });
  ok(fs.existsSync(SHOT), 'screenshot saved', SHOT);

  /* zero adapters: unregister everything and remount */
  await page.evaluate(() => { CMS.ORDER.splice(0, CMS.ORDER.length); MODI.publish.mounted = false; showModule('publish'); });
  await page.waitForSelector('#p16Targets .callout', { timeout: 5000 });
  ok(/No CMS adapters are loaded/.test(await page.textContent('#p16Targets .callout')), 'zero adapters renders the explanatory callout');
  ok((await page.$$eval('#p16Target option', els => els.length)) === 1, 'zero adapters: target select shows the empty option only');
  await page.click('#p16Tabs button[data-v="composer"]');
  ok((await page.inputValue('#p16cTitle')) === 'AC Repair in Mesquite', 'composer draft survives a remount');

  /* a deploy end to end without a network: a fake adapter registered in the page (the same shape core.test.mjs uses) */
  await page.evaluate(() => {
    globalThis.FAKE = { upserts: [], tests: 0, fail: false };
    CMS.register({ id: 'fake', name: 'Fake CMS', group: 'Test doubles', blurb: 'no network', docs: 'https://example.com/docs', setup: ['none'],
      fields: [{ k: 'url', l: 'Site URL', t: 'url' }, { k: 'token', l: 'Token', t: 'password', secret: true }, { k: 'mode', l: 'Mode', t: 'select', def: 'a', opts: [{ v: 'a', l: 'A' }, { v: 'b', l: 'B' }] }, { k: 'flag', l: 'Flag', t: 'checkbox', optional: true }],
      caps: { media: true, urls: true, publishSite: true, elementor: false, schema: 'inline', seo: true, postTypes: ['page', 'post'] },
      base(cfg) { return CMS.trimSlash(cfg.apiBase || cfg.url); },
      async test(cfg) { FAKE.tests++; if (FAKE.fail) return { ok: false, info: 'the token is wrong', hint: 'make a new one' }; return { ok: true, info: `fake ${cfg.mode} ${cfg.flag ? 'flag' : 'noflag'}` }; },
      async listUrls(cfg) { return [cfg.url + '/ac-repair-in-mesquite/', cfg.url + '/ac-repair/']; },
      async uploadMedia(cfg, a) { return { id: 5, url: cfg.url + '/media/' + a.file }; },
      async upsertPage(cfg, pg, opts) { FAKE.upserts.push({ slug: pg.slug, status: pg.status, publish: !!opts.publish, css: !!pg.css, schema: !!pg.schema }); return { id: FAKE.upserts.length, link: cfg.url + '/' + pg.slug + '/', edit: cfg.url + '/admin/' + pg.slug, status: pg.status, updated: FAKE.upserts.filter(u => u.slug === pg.slug).length > 1 }; },
      async publishSite() { FAKE.sitePublished = true; return { ok: true, info: 'site published (fake)' }; } });
    MODI.publish.mounted = false; showModule('publish');
  });
  await page.waitForSelector('#p16Targets .conn[data-id="fake"]', { timeout: 5000 });
  ok(/Not configured/.test(await page.textContent('#p16St-fake')), 'fake card starts unconfigured');
  ok(await page.$('#p16Targets .conn[data-id="fake"] button[data-a="publishSite"]') != null, 'publishSite cap shows the Publish site button');
  ok((await page.inputValue('#p16F-fake-mode')) === 'a', 'select field pre-filled with def');
  await page.fill('#p16F-fake-url', 'https://fake.example.com');
  await page.fill('#p16F-fake-token', 'secret-1');
  await page.check('#p16F-fake-flag');
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="save"]');
  await page.waitForFunction(() => /Configured, not tested/.test(document.querySelector('#p16St-fake').textContent), null, { timeout: 5000 });
  const savedCfg = await page.evaluate(() => CMS.cfg('fake'));
  ok(savedCfg.url === 'https://fake.example.com' && savedCfg.token === 'secret-1' && savedCfg.mode === 'a' && savedCfg.flag === true, 'save wrote every field kind (text, password, select, checkbox)', JSON.stringify(savedCfg));
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="test"]');
  await page.waitForFunction(() => /Connected/.test(document.querySelector('#p16St-fake').textContent), null, { timeout: 5000 });
  ok(/fake a flag/.test(await page.textContent('#p16St-fake')), 'test marks the card connected with the adapter info', await page.textContent('#p16St-fake'));
  /* editing a field and saving drops the stale test result */
  await page.fill('#p16F-fake-token', 'secret-2');
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="save"]');
  await page.waitForFunction(() => /Configured, not tested/.test(document.querySelector('#p16St-fake').textContent), null, { timeout: 5000 });
  ok(true, 'save after a change clears the connected state');
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="save"]');
  await page.waitForTimeout(200);
  ok(/Configured, not tested/.test(await page.textContent('#p16St-fake')), 'save without a change keeps the state');
  /* a failing test is reported and does not leave the card connected */
  await page.evaluate(() => { FAKE.fail = true; });
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="test"]');
  await page.waitForFunction(() => /token is wrong/.test(document.querySelector('#p16Log-fake').textContent), null, { timeout: 5000 });
  ok(/Configured, not tested/.test(await page.textContent('#p16St-fake')), 'a failed test leaves the card configured, not connected');
  ok(/make a new one/.test(await page.textContent('#p16Log-fake')), 'the failed test shows the adapter hint');
  await page.evaluate(() => { FAKE.fail = false; });
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="test"]');
  await page.waitForFunction(() => /Connected/.test(document.querySelector('#p16St-fake').textContent), null, { timeout: 5000 });
  /* target, deploy as drafts */
  await page.click('#p16Targets .conn[data-id="fake"] input[name="p16Use"]');
  ok((await page.inputValue('#p16Target')) === 'fake', 'fake is the target');
  await page.click('#p16Tabs button[data-v="composer"]');
  await page.click('#p16cAdd');
  await page.waitForSelector('#p16Pages tbody tr[data-slug="ac-repair-in-mesquite"]', { timeout: 5000 });
  await page.click('#p16SelAll');
  ok(/Deploy 1 selected to Fake CMS/.test(await page.textContent('#p16Go')), 'deploy button names the fake target');
  await page.click('#p16Go');
  await page.waitForSelector('#p16Results tbody tr', { timeout: 10000 });
  const up = await page.evaluate(() => FAKE.upserts);
  ok(up.length === 1 && up[0].slug === 'ac-repair-in-mesquite' && up[0].status === 'draft' && up[0].publish === false && up[0].css && up[0].schema, 'upsertPage received the page as a draft with css and schema', JSON.stringify(up));
  const resRow = await page.textContent('#p16Results tbody tr');
  ok(/draft/.test(resRow) && /created/.test(resRow) && /fake\.example\.com\/ac-repair-in-mesquite/.test(resRow), 'results row shows draft, created and the link', resRow.replace(/\s+/g, ' '));
  ok(/Done: 1 sent, 0 skipped, 0 failed/.test(await page.textContent('#p16Status')), 'status box reports the run');
  ok(!(await page.$eval('#p16SiteGo', b => b.hidden)), 'Publish site now appears after a run on a publishSite target');
  ok(/sent draft/.test(await page.textContent('#p16Pages tbody tr[data-slug="ac-repair-in-mesquite"]')), 'page row shows sent draft from the ledger');
  ok(/ac-repair-in-mesquite/.test(await page.textContent('#p16LedgerT')) && /draft/.test(await page.textContent('#p16LedgerT')), 'ledger table lists the page');
  ok(/Pages sent\s*1/.test((await page.textContent('#p16Kpis')).replace(/\s+/g, ' ')), 'KPI counts the sent page');
  /* second run: skipped because it was already sent */
  await page.click('#p16Go');
  await page.waitForFunction(() => /Done: 0 sent, 1 skipped/.test(document.querySelector('#p16Status').textContent), null, { timeout: 10000 });
  ok((await page.evaluate(() => FAKE.upserts.length)) === 1, 'already sent page is skipped, no second upsert');
  await page.click('#p16SelUnsent');
  ok(/0 of 1 selected/.test(await page.textContent('#p16SelN')), 'only unsent deselects the sent page');
  /* publish live: untick skip, two clicks */
  await page.click('#p16SelAll');
  await page.uncheck('#p16OnlyNew');
  await page.check('#p16Live');
  await page.click('#p16Go');
  ok(/Click again to publish 1 live/.test(await page.textContent('#p16Go')), 'publish live arms the button on the first click');
  ok((await page.evaluate(() => FAKE.upserts.length)) === 1, 'the first click did not deploy');
  await page.click('#p16Go');
  await page.waitForFunction(() => /Done: 1 sent, 0 skipped, 0 failed/.test(document.querySelector('#p16Status').textContent), null, { timeout: 10000 });
  const up2 = await page.evaluate(() => FAKE.upserts);
  ok(up2.length === 2 && up2[1].status === 'publish' && up2[1].publish === true, 'second click deployed as publish', JSON.stringify(up2[1]));
  ok(/updated/.test(await page.textContent('#p16Results tbody tr')) && /publish/.test(await page.textContent('#p16Results tbody tr')), 'results row shows publish and updated');
  /* publish site now, verify links */
  await page.click('#p16SiteGo');
  await page.waitForFunction(() => /site published \(fake\)/.test(document.querySelector('#p16Status').textContent), null, { timeout: 5000 });
  ok(await page.evaluate(() => FAKE.sitePublished === true), 'Publish site now calls adapter.publishSite');
  await page.evaluate(() => { MODI.publish.pages()[0].links = [{ anchor: 'a', url: '/ac-repair/' }, { anchor: 'b', url: 'https://fake.example.com/missing-page/' }]; });
  await page.click('#p16Verify');
  await page.waitForFunction(() => /Live URLs on Fake CMS: 2/.test(document.querySelector('#p16Status').textContent), null, { timeout: 5000 });
  const vtxt = await page.textContent('#p16Status');
  ok(/Internal links on 1 page: 2; not live: 1/.test(vtxt) && /missing-page/.test(vtxt), 'verify links compares paths against listUrls', vtxt.split('\n').slice(-3).join(' | '));
  /* clear the ledger, forget credentials (two clicks each) */
  await page.click('#p16Targets .conn[data-id="fake"] details.cdet:nth-of-type(2) summary');
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="clearLedger"]');
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="clearLedger"]');
  await page.waitForFunction(() => /Nothing sent to Fake CMS yet/.test(document.querySelector('#p16LedgerT').textContent), null, { timeout: 5000 });
  ok(true, 'clear ledger empties the target ledger after the second click');
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="forget"]');
  await page.click('#p16Targets .conn[data-id="fake"] button[data-a="forget"]');
  await page.waitForFunction(() => /Not configured/.test(document.querySelector('#p16St-fake').textContent), null, { timeout: 5000 });
  ok((await page.evaluate(() => Object.keys(CMS.cfg('fake')).length)) === 0, 'forget credentials removes the config');
} catch (e) { ok(false, 'unexpected exception', e.message); console.error(e); }

ok(errors.length === 0, 'no page errors or console errors', errors.join(' || ').slice(0, 800));
console.log(checks.join('\n'));
if (warnings.length) console.log('warnings (external resources, not counted):\n  ' + warnings.slice(0, 5).join('\n  '));
console.log(`\n${checks.length - failed} passed, ${failed} failed`);
await context.close();
process.exit(failed ? 1 : 0);
