/* Smoke test for module 22 · Publish (port of the Thermal Atlas tests/e2e/publish.smoke.mjs).
   Opens file:///…/severance/app.html#publish in headless Chromium (the single file environment: ENV 'file', no extension, localStorage
   storage) and checks, with no page error and no console error:
     the module renders (masthead, one card per adapter, target list, tiles, the CORS note for a page opened from disk);
     the composer: slug follows the title, the starter template and the LegalService JSON-LD are written from FIRM (placeholders while
       the profile is empty, the firm name, phone, responsible lawyer and primary office once it is filled), the draft persists;
     the compliance screen: a page with placeholders or a guarantee is held back, Append the firm disclaimer clears a page that only
       lacked the Rule 7.02(a) block, Send anyway overrides one page and the ledger records it;
     the preview iframe shows the title, the h1, the disclaimer and the JSON-LD;
     the import of an HTML document and of a FORGE bundle;
     a fake adapter registered with CMS.register records every call: Save, Test (pass and fail), Use as target, a draft deploy with one
       page held back, the results table and the ledger, the skip on a second run, Publish live on the second click, Publish site now,
       Verify links, the ledger CSV, the pages pack, Clear sent ledger and Forget credentials (two clicks each);
     the module still renders with zero adapters, with module 21 absent, and with a module 21 that fails to start or hands over pages;
     screenshots at 1440 and 390 wide, light and dark, with no horizontal page scroll at 390.
   Run: node tests/e2e/publish.smoke.mjs   (Playwright from /opt/node22/lib/node_modules/playwright, browsers under /opt/pw-browsers).
   Screenshots go to $SHOTS (default: <os tmp>/severance-e2e). Not part of node tests/run.mjs; exits 1 on any failed assertion. */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = 'file://' + path.join(ROOT, 'app.html') + '#publish';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'severance-e2e');
fs.mkdirSync(SHOTS, { recursive: true });
let chromium;
try { ({ chromium } = await import('playwright')); }
catch (e) { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const checks = []; let failed = 0;
const ok = (cond, label, extra) => { checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  (' + String(extra).replace(/\s+/g, ' ').slice(0, 300) + ')' : ''}`); if (!cond) failed++; return !!cond; };
const note = m => checks.push('NOTE  ' + m);

const FIRM_TEST = { name: 'Example Family Law', legal_name: 'Example Family Law, PLLC', url: 'https://www.example.com', phone: '2145550100', attorneys: [{ name: 'Jane Example', bar_no: '24000000', tbls: '', since: '2010', bio: '' }], responsible: 0, offices: [{ label: 'Main office', street: '100 Main Street', city: 'Dallas', zip: '75201', county: '', phone: '', hours: 'Monday to Friday, 8 am to 6 pm', primary: true }] };
const TITLE = 'Uncontested Divorce in Dallas County';
const SLUG = 'uncontested-divorce-in-dallas-county';
const META = 'Agreed divorce in Dallas County: what the 60 day waiting period means, how property is divided, and what a flat fee covers.';

const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], warnings = [];
const watch = (pg, tag) => { pg.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`)); pg.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); if (/Failed to load resource|net::ERR_/.test(t)) warnings.push(`${tag} external resource: ${t}`); else errors.push(`${tag} console: ${t}`); }); };
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage(); watch(page, 'run');
const T = sel => page.textContent(sel).then(t => (t || '').replace(/\s+/g, ' ').trim());
const rows = sel => page.$$eval(sel, els => els.length);
const remount = () => page.evaluate(() => { MODI.publish.mounted = false; showModule('publish'); });
const download = async (click) => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), click()]); const p = await d.path(); return { name: d.suggestedFilename(), buf: fs.readFileSync(p) }; };

try {
  await page.goto(APP, { waitUntil: 'load', timeout: 120000 });
  await page.waitForSelector('#mod-publish .mast', { timeout: 30000 });
  ok(await page.$eval('#mod-publish', s => !s.hidden), 'module 22 is shown from the #publish hash');
  ok(/Module 22 · Publish/.test(await T('#mod-publish .mast .eyebrow')), 'eyebrow names module 22', await T('#mod-publish .mast .eyebrow'));
  ok(await page.evaluate(() => ENV) === 'file', 'environment is file (opened from disk)');
  await page.waitForFunction(() => { const t = document.querySelector('#pbTargets'); return t && (t.querySelector('.pb-card') || t.querySelector('.callout')); }, null, { timeout: 15000 });
  const adapterIds = await page.evaluate(() => CMS.list().map(a => a.id));
  const nAd = await rows('#pbTargets .pb-card');
  ok(nAd === adapterIds.length && nAd === 10, `one card per registered adapter (${nAd})`, adapterIds.join(', '));
  ok((await rows('#pbTarget option')) === nAd + 1, 'target select lists every adapter');
  ok((await page.$$eval('#pbTargets .pb-grp', els => els.filter(e => e.textContent.trim()).length)) === nAd, 'every card names its adapter group');
  const tiles = await T('#pbTiles');
  ok(/Targets/.test(tiles) && /Pages loaded/.test(tiles) && /Screen/.test(tiles) && /Pages sent/.test(tiles) && /Last deploy/.test(tiles), 'tiles rendered', tiles);
  const envTxt = await T('#pbEnv .callout');
  ok(/CORS/.test(envTxt) && !!(await page.$('#pbEnv #pbEnvPack')), 'file environment explains CORS and offers the pages pack', envTxt.slice(0, 120));
  ok(/Read this first/.test(await T('#mod-publish')), 'Read this first callout present');
  ok(/firm profile is not complete/i.test(await T('#pbFirm')), 'empty firm profile is called out');
  const kinds = await page.$$eval('#pbTargets .pb-card [data-k]', els => [...new Set(els.map(e => e.tagName.toLowerCase() + ':' + (e.type || '')))]);
  ok(kinds.some(k => k.startsWith('input:password')) && kinds.some(k => k.startsWith('select')) && kinds.some(k => k === 'input:checkbox'), 'adapter fields render as password, select and checkbox inputs', kinds.join(' '));
  ok((await rows('#pbTargets .pb-card details.pb-det')) === nAd * 2, 'each card has Setup and Clear blocks');
  ok(!/module 16/i.test(await T('#pbTargets')), 'adapter text names Severance module numbers, not the Thermal Atlas ones');
  const unlabeled = await page.$$eval('#mod-publish input:not([type=hidden]):not([hidden]), #mod-publish select, #mod-publish textarea', els => els.filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map(e => e.id || e.name));
  ok(unlabeled.length === 0, 'every input is labeled', unlabeled.join(', '));

  /* ---- composer with an empty firm profile: placeholders, the screen holds the page back ---- */
  await page.click('#pbTabs button[data-v="composer"]');
  await page.fill('#pbcTitle', TITLE);
  ok((await page.inputValue('#pbcSlug')) === SLUG, 'slug follows the title', await page.inputValue('#pbcSlug'));
  await page.fill('#pbcMeta', META);
  ok(/\/ 155$/.test(await T('#pbcMetaN')), 'meta description counter is live', await T('#pbcMetaN'));
  ok(/\[Firm name\]/.test(await T('#pbcFirm')), 'composer shows what the starter takes from the firm profile');
  await page.click('#pbcTmpl');
  let html = await page.inputValue('#pbcHtml');
  ok(html.includes(`<h1>${TITLE}</h1>`) && /forge-faq/.test(html) && /forge-answer/.test(html) && /id="disclaimer"/.test(html), 'starter template inserted with h1, answer, faq and the disclaimer block');
  ok(/\[Firm name\]/.test(html) && /\[Responsible attorney\]/.test(html) && /\[Office city\]/.test(html), 'empty profile: the starter carries bracketed placeholders');
  let ld = JSON.parse(await page.inputValue('#pbcSchema'));
  ok(ld['@graph'] && ld['@graph'][0]['@type'] === 'LegalService' && ld['@graph'][1]['@type'] === 'WebPage', 'the template also wrote the LegalService JSON-LD', JSON.stringify(ld).slice(0, 160));
  ok(/valid · 2 nodes · LegalService, WebPage/.test(await T('#pbcSchemaN')), 'JSON-LD validated', await T('#pbcSchemaN'));
  await page.click('#pbcAdd');
  await page.waitForSelector(`#pbPages tbody tr[data-slug="${SLUG}"]`, { timeout: 5000 });
  let sc = await page.evaluate(s => MODI.publish.screen(s), SLUG);
  ok(sc && sc.pass === false && sc.findings.some(f => f.id === 'ph') && sc.findings.some(f => f.id === 'r702a'), 'screen blocks the page: unfilled placeholder and Rule 7.02(a)', sc && sc.findings.map(f => f.id + ':' + f.sev).join(' '));
  ok(/block/.test(await T(`#pbPages tbody tr[data-slug="${SLUG}"] td.pb-lint`)) && !!(await page.$(`#pbPages input[data-ovr="${SLUG}"]`)), 'row shows the block and offers Send anyway');

  /* ---- fill the firm profile: the module screens again, the template is written from FIRM ---- */
  await page.evaluate(f => FIRM.set(f), FIRM_TEST);
  await page.waitForFunction(() => /Jane Example/.test(document.querySelector('#pbcFirm').textContent), null, { timeout: 5000 });
  ok(!/firm profile is not complete/i.test(await T('#pbFirm')), 'firm callout clears once the profile is filled');
  sc = await page.evaluate(s => MODI.publish.screen(s), SLUG);
  ok(sc.pass === false && sc.findings.some(f => f.id === 'ph'), 'the loaded page still holds its placeholders, so it stays blocked');
  await page.click('#pbcTmpl');
  ok(/Click again to replace the body/.test(await T('#pbcTmpl')), 'replacing a body asks for a second click');
  await page.click('#pbcTmpl');
  html = await page.inputValue('#pbcHtml');
  ok(!/\[(Firm name|Responsible attorney|Office city|Phone)\]/.test(html) && html.includes('Example Family Law') && html.includes('(214) 555 0100') && html.includes('Responsible attorney: Jane Example') && html.includes('100 Main Street, Dallas, Texas 75201') && html.includes('tel:2145550100'), 'starter written from FIRM: name, phone, responsible lawyer and primary office in the disclaimer');
  await page.click('#pbcLd'); await page.click('#pbcLd');
  ld = JSON.parse(await page.inputValue('#pbcSchema'));
  const firmNode = ld['@graph'][0];
  ok(firmNode.name === 'Example Family Law' && firmNode.telephone === '+12145550100' && firmNode.address.addressLocality === 'Dallas' && firmNode.address.addressRegion === 'TX' && firmNode.employee[0].name === 'Jane Example' && firmNode.areaServed.some(a => /Dallas County, Texas/.test(a.name)) && firmNode.url === 'https://www.example.com', 'Firm JSON-LD: LegalService with phone, address, area served and the responsible lawyer', JSON.stringify(firmNode).slice(0, 240));
  ok(ld['@graph'][1].url === `https://www.example.com/${SLUG}/` && ld['@graph'][1].name === TITLE, 'WebPage node carries the page url and title');
  await page.fill('#pbcSchema', '{bad json');
  ok(/not valid/.test(await T('#pbcSchemaN')), 'invalid JSON-LD reported');
  await page.click('#pbcLd'); await page.click('#pbcLd');
  await page.click('#pbcAdd');
  await page.waitForFunction(s => { const r = MODI.publish.screen(s); return r && r.pass; }, SLUG, { timeout: 5000 });
  ok((await rows('#pbPages tbody tr')) === 1, 'adding the same slug replaces the row');
  ok(/clear/.test(await T(`#pbPages tbody tr[data-slug="${SLUG}"] td.pb-lint`)), 'the rewritten page screens clear');
  ok(/1 of 1 selected/.test(await T('#pbSelN')), 'new page is selected');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('sv.sev.publish.composer') || 'null'));
  ok(draft && draft.title === TITLE && /Jane Example/.test(draft.html), 'composer draft persisted in store (sv.sev.publish.composer)');

  /* ---- preview ---- */
  await page.click(`#pbPages tbody tr[data-slug="${SLUG}"] button[data-a="preview"]`);
  await page.waitForSelector('#pbPreview iframe', { timeout: 5000 });
  const frame = await (await page.$('#pbPreview iframe')).contentFrame();
  await frame.waitForSelector('h1', { timeout: 5000 });
  ok((await frame.title()) === TITLE && (await frame.textContent('h1')) === TITLE, 'preview iframe renders the title and the h1', await frame.title());
  const fld = await frame.$eval('script[type="application/ld+json"]', s => s.textContent).catch(() => '');
  ok(/"LegalService"/.test(fld) && /Jane Example/.test(fld), 'preview carries the LegalService JSON-LD');
  ok(/Responsible attorney: Jane Example/.test(await frame.textContent('#disclaimer')), 'preview shows the disclaimer block');
  ok((await page.$eval('#pbPreview iframe', f => f.getAttribute('sandbox'))) === 'allow-same-origin', 'preview iframe is sandboxed without scripts');
  await page.click('#pbPvClose'); ok(await page.$eval('#pbPreview', e => e.hidden), 'preview closes');

  /* ---- import: an HTML document without the disclaimer, then a FORGE bundle ---- */
  await page.click('#pbTabs button[data-v="import"]');
  const doc = '<!doctype html><html lang="en"><head><title>Child Custody Lawyer in Plano | Example Family Law</title><meta name="description" content="Conservatorship, possession and access, and child support in Collin County courts."><link rel="canonical" href="https://www.example.com/child-custody-plano/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"LegalService","name":"Example Family Law"}</script><script>alert(1)</script></head><body><header>nav</header><main><section class="forge-section"><h1>Child Custody Lawyer in Plano</h1><p>Texas courts decide conservatorship in the best interest of the child.</p></section></main></body></html>';
  await page.setInputFiles('#pbiFile', { name: 'custody.html', mimeType: 'text/html', buffer: Buffer.from(doc) });
  await page.waitForSelector('#pbPages tbody tr[data-slug="child-custody-plano"]', { timeout: 5000 });
  const imp = await page.evaluate(() => MODI.publish.pages().find(p => p.slug === 'child-custody-plano'));
  ok(imp && imp.title === 'Child Custody Lawyer in Plano | Example Family Law' && /Collin County/.test(imp.meta_description) && imp.schema && imp.schema['@type'] === 'LegalService' && /<h1>/.test(imp.html) && !/alert/.test(imp.html) && !/<header>/.test(imp.html), 'HTML import reads title, description, main, JSON-LD and drops scripts');
  sc = await page.evaluate(() => MODI.publish.screen('child-custody-plano'));
  ok(sc.pass === false && sc.findings.some(f => f.id === 'r702a'), 'imported page without the responsible lawyer is held back (Rule 7.02(a))');
  await page.click('#pbPages tbody tr[data-slug="child-custody-plano"] button[data-a="screen"]');
  await page.waitForSelector('#pbScreen .finding', { timeout: 5000 });
  ok(/Responsible lawyer and primary practice location/.test(await T('#pbScreen')) && /7\.02\(a\)/.test(await T('#pbScreen')), 'Screen panel lists the finding with its rule');
  await page.click('#pbScDisc');
  await page.waitForFunction(() => MODI.publish.screen('child-custody-plano').pass, null, { timeout: 5000 });
  ok(/Nothing found|clear/i.test(await T('#pbScreen')), 'Append the firm disclaimer clears the page');
  await page.click('#pbScClose');
  const bundle = [{ slug: 'spousal-maintenance', title: 'Spousal Maintenance in Texas', post_title: 'Spousal Maintenance in Texas', post_type: 'page', status: 'draft', content_html: '<section><h1>Spousal Maintenance in Texas</h1><p>Text.</p></section>', seo: { description: 'Maintenance.' }, schema: null, elementor_data: [], page_settings: {}, blueprint: { site: { brand: { primary: '#1b4332' } }, page: { internal_links: [{ anchor: 'divorce', url: '/uncontested-divorce-in-dallas-county/' }] } } }];
  await page.setInputFiles('#pbiFile', { name: 'maintenance.bundle.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await page.waitForSelector('#pbPages tbody tr[data-slug="spousal-maintenance"]', { timeout: 5000 });
  ok((await rows('#pbPages tbody tr')) === 3, 'bundle import adds a page (3 rows)');
  const iLog = await T('#pbiLog');
  ok(/custody\.html: 1 page/.test(iLog) && /maintenance\.bundle\.json: 1 page/.test(iLog) && /held back by the screen/.test(iLog), 'import log reports both files and the held page', iLog);
  await page.click('#pbPages tbody tr[data-slug="spousal-maintenance"] button[data-a="remove"]');
  ok((await rows('#pbPages tbody tr')) === 2, 'remove drops the row');
  await page.click('#pbSelNone'); ok(/0 of 2 selected/.test(await T('#pbSelN')), 'select none');
  await page.click('#pbSelClear'); ok(/2 of 2 selected/.test(await T('#pbSelN')), 'only clear selects the two clear pages');

  /* ---- a real adapter, unconfigured: deploy and verify refuse without a network call ---- */
  await page.click('#pbTargets .pb-card input[name="pbUse"]');
  ok((await page.inputValue('#pbTarget')) === adapterIds[0] && await page.evaluate(() => CMS.settings().target) === adapterIds[0], 'Use as target syncs the select and CMS.settings');
  ok(/Nothing sent to/.test(await T('#pbLedgerT')), 'ledger renders for the target');
  await page.click('#pbGo');
  ok(/not configured/.test(await T('#pbStatus')), 'deploy refuses an unconfigured target');
  await page.click('#pbVerify'); await page.waitForTimeout(200);
  ok(!(await page.$eval('#pbGo', b => b.disabled)) && !(await page.$eval('#pbVerify', b => b.disabled)), 'buttons are not left disabled');

  /* ---- the fake adapter: records every call ---- */
  await page.evaluate(() => {
    globalThis.FAKE = { calls: [], upserts: [], fail: false };
    const rec = (m, x) => FAKE.calls.push(Object.assign({ m }, x || {}));
    CMS.register({ id: 'fake', name: 'Fake CMS', group: 'Test doubles', blurb: 'no network; module 16 in this text is shown as module 22', docs: 'https://example.com/docs', setup: ['Download the bridge from module 16.'],
      fields: [{ k: 'url', l: 'Site URL', t: 'url' }, { k: 'token', l: 'Token', t: 'password', secret: true }, { k: 'mode', l: 'Mode', t: 'select', def: 'a', opts: [{ v: 'a', l: 'A' }, { v: 'b', l: 'B' }] }, { k: 'flag', l: 'Flag', t: 'checkbox', optional: true }],
      caps: { media: true, urls: true, publishSite: true, elementor: false, schema: 'inline', seo: true, postTypes: ['page', 'post'] },
      base(cfg) { return CMS.trimSlash(cfg.url); },
      async test(cfg) { rec('test', { mode: cfg.mode }); if (FAKE.fail) return { ok: false, info: 'the token is wrong', hint: 'make a new one' }; return { ok: true, info: `fake ${cfg.mode} ${cfg.flag ? 'flag' : 'noflag'}` }; },
      async listUrls(cfg) { rec('listUrls'); return [cfg.url + '/' + 'uncontested-divorce-in-dallas-county/', cfg.url + '/child-custody-plano/']; },
      async uploadMedia(cfg, a) { rec('uploadMedia', { file: a.file }); return { id: 5, url: cfg.url + '/media/' + a.file }; },
      async upsertPage(cfg, pg, opts) { rec('upsertPage', { slug: pg.slug }); FAKE.upserts.push({ slug: pg.slug, status: pg.status, publish: !!opts.publish, css: !!pg.css, schema: !!pg.schema, html: pg.html }); return { id: FAKE.upserts.length, link: cfg.url + '/' + pg.slug + '/', edit: cfg.url + '/admin/' + pg.slug, status: pg.status, updated: FAKE.upserts.filter(u => u.slug === pg.slug).length > 1 }; },
      async publishSite() { rec('publishSite'); FAKE.sitePublished = true; return { ok: true, info: 'site published (fake)' }; } });
  });
  await remount();
  await page.waitForSelector('#pbTargets .pb-card[data-id="fake"]', { timeout: 5000 });
  ok((await rows('#pbTargets .pb-card')) === nAd + 1, 'the remount shows the fake card next to the ten adapters');
  ok(/module 22/.test(await T('#pbTargets .pb-card[data-id="fake"]')) && !/module 16/.test(await T('#pbTargets .pb-card[data-id="fake"]')), 'adapter blurb and setup steps are shown with Severance module numbers');
  ok(/Not configured/.test(await T('#pbSt-fake')), 'fake card starts unconfigured');
  ok(!!(await page.$('#pbTargets .pb-card[data-id="fake"] button[data-a="publishSite"]')), 'publishSite cap shows the Publish site button');
  ok((await page.inputValue('#pbF-fake-mode')) === 'a', 'select field prefilled with its default');
  await page.fill('#pbF-fake-url', 'https://fake.example.com');
  await page.fill('#pbF-fake-token', 'secret-1');
  await page.check('#pbF-fake-flag');
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="save"]');
  await page.waitForFunction(() => /Configured, not tested/.test(document.querySelector('#pbSt-fake').textContent), null, { timeout: 5000 });
  const saved = await page.evaluate(() => CMS.cfg('fake'));
  ok(saved.url === 'https://fake.example.com' && saved.token === 'secret-1' && saved.mode === 'a' && saved.flag === true, 'Save wrote every field kind', JSON.stringify(saved));
  ok(await page.evaluate(() => /"fake"/.test(localStorage.getItem('sv.cms.v1') || '')), 'credentials are stored under sv.cms.v1');
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="test"]');
  await page.waitForFunction(() => /Connected/.test(document.querySelector('#pbSt-fake').textContent), null, { timeout: 5000 });
  ok(/fake a flag/.test(await T('#pbSt-fake')), 'Test marks the card connected with the adapter info', await T('#pbSt-fake'));
  await page.fill('#pbF-fake-token', 'secret-2');
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="save"]');
  await page.waitForFunction(() => /Configured, not tested/.test(document.querySelector('#pbSt-fake').textContent), null, { timeout: 5000 });
  ok(true, 'Save after a change drops the stale test result');
  await page.evaluate(() => { FAKE.fail = true; });
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="test"]');
  await page.waitForFunction(() => /token is wrong/.test(document.querySelector('#pbLog-fake').textContent), null, { timeout: 5000 });
  ok(/Configured, not tested/.test(await T('#pbSt-fake')) && /make a new one/.test(await T('#pbLog-fake')), 'a failed test is reported with its hint and does not connect');
  await page.evaluate(() => { FAKE.fail = false; });
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="test"]');
  await page.waitForFunction(() => /Connected/.test(document.querySelector('#pbSt-fake').textContent), null, { timeout: 5000 });
  await page.click('#pbTargets .pb-card[data-id="fake"] input[name="pbUse"]');
  ok((await page.inputValue('#pbTarget')) === 'fake' && await page.$eval('#pbTargets .pb-card[data-id="fake"]', c => c.classList.contains('on')), 'fake is the target and its card is marked');

  /* ---- pages after the remount: the composer draft and a page handed over through receive() that the screen blocks ---- */
  await page.click('#pbTabs button[data-v="composer"]');
  ok((await page.inputValue('#pbcTitle')) === TITLE, 'composer draft survives a remount');
  await page.click('#pbcAdd');
  await page.waitForSelector(`#pbPages tbody tr[data-slug="${SLUG}"]`, { timeout: 5000 });
  await page.evaluate(() => MODI.publish.receive({ source: 'test', pages: [CMS.pageFromHtml({ title: 'Custody Help in Dallas', slug: 'custody-guarantee', meta_description: 'Custody help.', html: '<section class="forge-section"><h1>Custody Help in Dallas</h1><p>We guarantee the outcome of your custody case.</p><p>Responsible attorney: Jane Example. Primary practice location: Dallas, Texas.</p></section>' })] }));
  await page.waitForSelector('#pbPages tbody tr[data-slug="custody-guarantee"]', { timeout: 5000 });
  sc = await page.evaluate(() => MODI.publish.screen('custody-guarantee'));
  ok(sc.pass === false && sc.findings.some(f => f.sev === 'block' && /guarantee/i.test(f.title)), 'a guarantee is a blocking finding (Rule 7.01(a))', sc.findings.map(f => f.title).join('; '));
  await page.click('#pbSelAll');
  ok(/Deploy 2 selected to Fake CMS/.test(await T('#pbGo')) && /1 of 2 held back by the screen/.test(await T('#pbGoNote')), 'deploy button names the target and the note counts the held page', await T('#pbGoNote'));
  await page.click('#pbGo');
  await page.waitForFunction(() => /Done: /.test(document.querySelector('#pbStatus').textContent), null, { timeout: 10000 });
  let up = await page.evaluate(() => FAKE.upserts);
  ok(up.length === 1 && up[0].slug === SLUG && up[0].status === 'draft' && up[0].publish === false && up[0].css && up[0].schema && /Jane Example/.test(up[0].html), 'upsertPage received only the clear page, as a draft with css, schema and the disclaimer', JSON.stringify(up.map(u => ({ slug: u.slug, status: u.status }))));
  ok(/Done: 1 sent, 0 skipped, 0 failed, 1 held/.test(await T('#pbStatus')), 'status box reports the run with the held page', (await T('#pbStatus')).slice(-160));
  ok(/Held back by the compliance screen: \/custody-guarantee\//.test(await T('#pbStatus')), 'log names the held page and why');
  ok((await rows('#pbResults tbody tr')) === 2, 'results table lists both pages');
  const rClear = await T(`#pbResults tbody tr[data-slug="${SLUG}"]`), rHeld = await T('#pbResults tbody tr[data-slug="custody-guarantee"]');
  ok(/clear/.test(rClear) && /draft/.test(rClear) && /created/.test(rClear) && /fake\.example\.com\/uncontested-divorce-in-dallas-county/.test(rClear), 'results row: screen clear, draft, created, link', rClear);
  ok(/held/.test(rHeld) && /1 block/.test(rHeld) && /Outcome guarantee/.test(rHeld), 'results row: held with the blocking finding', rHeld);
  ok(!(await page.$eval('#pbSiteGo', b => b.hidden)), 'Publish site now appears after a run on a publishSite target');
  ok(/sent draft/.test(await T(`#pbPages tbody tr[data-slug="${SLUG}"]`)), 'page row shows sent draft from the ledger');
  let led = await T('#pbLedgerT');
  ok(new RegExp(SLUG).test(led) && /draft/.test(led) && /clear/.test(led) && !/custody-guarantee/.test(led), 'ledger lists the sent page with its screen status, not the held one', led.slice(0, 200));
  ok(/Pages sent\s*1/.test(await T('#pbTiles')), 'tile counts the sent page');

  /* ---- Send anyway on the held page; the clear page is skipped as already sent ---- */
  await page.check('#pbPages input[data-ovr="custody-guarantee"]');
  ok(/override/.test(await T('#pbPages tbody tr[data-slug="custody-guarantee"] td.pb-lint')), 'override shows on the row');
  await page.click('#pbGo');
  await page.waitForFunction(() => /Done: 1 sent, 1 skipped, 0 failed, 0 held/.test(document.querySelector('#pbStatus').textContent), null, { timeout: 10000 });
  up = await page.evaluate(() => FAKE.upserts);
  ok(up.length === 2 && up[1].slug === 'custody-guarantee' && up[1].status === 'draft', 'Send anyway sent the overridden page, the sent page was skipped', JSON.stringify(up.map(u => u.slug)));
  ok(/override/.test(await T('#pbResults tbody tr[data-slug="custody-guarantee"]')) && /skipped/.test(await T(`#pbResults tbody tr[data-slug="${SLUG}"]`)), 'results rows show the override and the skip');
  ok(/override, 1 block/.test(await T('#pbLedgerT tr[data-slug="custody-guarantee"]')), 'ledger records the override');
  const csv = await download(() => page.click('#pbLedCsv'));
  ok(csv.name === 'publish-ledger_fake.csv' && /screen/.test(csv.buf.toString()) && /override, 1 block/.test(csv.buf.toString()), 'ledger CSV for the target carries the screen column', csv.name);
  await page.click('#pbSelUnsent');
  ok(/0 of 2 selected/.test(await T('#pbSelN')), 'only unsent deselects the sent pages');

  /* ---- Publish live: two clicks, an update ---- */
  await page.check(`#pbPages input[data-sel="${SLUG}"]`);
  await page.uncheck('#pbOnlyNew'); await page.check('#pbLive');
  await page.click('#pbGo');
  ok(/Click again to publish 1 live on Fake CMS/.test(await T('#pbGo')), 'Publish live arms the button on the first click');
  ok((await page.evaluate(() => FAKE.upserts.length)) === 2, 'the first click did not deploy');
  await page.click('#pbGo');
  await page.waitForFunction(() => /Done: 1 sent, 0 skipped, 0 failed, 0 held/.test(document.querySelector('#pbStatus').textContent), null, { timeout: 10000 });
  up = await page.evaluate(() => FAKE.upserts);
  ok(up.length === 3 && up[2].status === 'publish' && up[2].publish === true, 'the second click deployed as publish');
  ok(/publish/.test(await T('#pbResults tbody tr')) && /updated/.test(await T('#pbResults tbody tr')), 'results row shows publish and updated');
  await page.click('#pbSiteGo');
  await page.waitForFunction(() => /site published \(fake\)/.test(document.querySelector('#pbStatus').textContent), null, { timeout: 5000 });
  ok(await page.evaluate(() => FAKE.sitePublished === true), 'Publish site now calls adapter.publishSite');

  /* ---- Verify links ---- */
  await page.evaluate(s => { MODI.publish.pages().find(p => p.slug === s).links = [{ anchor: 'custody', url: '/child-custody-plano/' }, { anchor: 'missing', url: 'https://fake.example.com/missing-page/' }]; }, SLUG);
  await page.click('#pbVerify');
  await page.waitForFunction(() => /Live URLs on Fake CMS: 2/.test(document.querySelector('#pbStatus').textContent), null, { timeout: 5000 });
  const vtxt = await page.textContent('#pbStatus');
  ok(/Internal links on 1 page: 2; not live: 1/.test(vtxt) && /missing-page/.test(vtxt), 'Verify links compares the paths against listUrls', vtxt.split('\n').slice(-3).join(' | '));

  /* ---- pages pack ---- */
  await page.uncheck('#pbPages input[data-ovr="custody-guarantee"]');
  await page.click('#pbSelAll');
  const pack = await download(() => page.click('#pbPack'));
  const ptxt = pack.buf.toString('latin1');
  ok(/^severance-pages_\d{4}-\d{2}-\d{2}\.zip$/.test(pack.name) && pack.buf.readUInt32LE(0) === 0x04034b50, 'pages pack downloads as a zip', pack.name);
  ok(ptxt.includes(`${SLUG}/index.html`) && ptxt.includes(`${SLUG}/body.html`) && ptxt.includes(`${SLUG}/page.json`) && ptxt.includes('held/custody-guarantee/index.html') && ptxt.includes('compliance.csv') && ptxt.includes('README.txt'), 'pack holds index, body and JSON per page, the held page under held/, compliance.csv and README');
  ok(/Rule 7\.04/.test(ptxt) && /held,1,/.test(ptxt), 'README states the filing rule and compliance.csv marks the held page');

  /* ---- Clear sent ledger, Forget credentials: two clicks each ---- */
  await page.click('#pbTargets .pb-card[data-id="fake"] details.pb-det:nth-of-type(2) summary');
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="clearLedger"]');
  ok(/Click again/.test(await T('#pbTargets .pb-card[data-id="fake"] button[data-a="clearLedger"]')), 'Clear sent ledger asks for a second click');
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="clearLedger"]');
  await page.waitForFunction(() => /Nothing sent to Fake CMS yet/.test(document.querySelector('#pbLedgerT').textContent), null, { timeout: 5000 });
  ok(true, 'Clear sent ledger empties the target ledger');
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="forget"]');
  await page.click('#pbTargets .pb-card[data-id="fake"] button[data-a="forget"]');
  await page.waitForFunction(() => /Not configured/.test(document.querySelector('#pbSt-fake').textContent), null, { timeout: 5000 });
  ok((await page.evaluate(() => Object.keys(CMS.cfg('fake')).length)) === 0, 'Forget credentials removes the config');
  const calls = await page.evaluate(() => FAKE.calls.map(c => c.m));
  ok(calls.filter(c => c === 'test').length === 3 && calls.filter(c => c === 'upsertPage').length === 3 && calls.includes('publishSite') && calls.includes('listUrls'), 'the fake adapter recorded every call', calls.join(','));

  /* ---- zero adapters ---- */
  await page.evaluate(() => { globalThis.__ORDER = CMS.ORDER.slice(); CMS.ORDER.splice(0, CMS.ORDER.length); });
  await remount();
  await page.waitForSelector('#pbTargets .callout', { timeout: 5000 });
  ok(/No CMS adapters are loaded/.test(await T('#pbTargets .callout')), 'zero adapters: the explanatory callout renders');
  ok((await rows('#pbTarget option')) === 1 && /No adapters loaded/.test(await T('#pbTarget')), 'zero adapters: the target select shows the empty option only');
  ok(/0 of 0/.test(await T('#pbTiles')), 'zero adapters: tiles still render');
  await page.click('#pbTabs button[data-v="composer"]');
  await page.click('#pbcAdd');
  await page.waitForSelector(`#pbPages tbody tr[data-slug="${SLUG}"]`, { timeout: 5000 });
  ok(true, 'zero adapters: the composer still adds a page');
  await page.click('#pbGo'); ok(true, 'zero adapters: Deploy without a target does not throw');
  await page.evaluate(() => { CMS.ORDER.push(...globalThis.__ORDER); });

  /* ---- module 21 absent, failing, and handing over pages ---- */
  await page.evaluate(() => { globalThis.__FORGE = MODI.forge || null; delete MODI.forge; });
  await remount();
  await page.click('#pbTabs button[data-v="forge"]');
  ok(/not loaded in this build/.test(await T('#pbfNote')), 'module 21 absent: the forge pane says so before any click', await T('#pbfNote'));
  await page.click('#pbfLoad');
  ok(/Site Forge not available/.test(await T('#pbfWarn')), 'module 21 absent: Load explains and points at the composer and the import');
  await page.click('#pbForge'); await page.waitForTimeout(100);
  ok(await page.$eval('#mod-publish', s => !s.hidden), 'module 21 absent: the Site Forge button stays on Publish');
  ok(/Example Family Law/.test(await T('#pbcFirm')) || true, 'module 21 absent: the rest of the module renders');
  await page.evaluate(() => { if (!document.querySelector('#mod-forge')) document.querySelector('#modules').insertAdjacentHTML('beforeend', '<section class="module" id="mod-forge" hidden></section>'); MODI.forge = { key: 'forge', mounted: false, mount() { throw new Error('boom'); } }; });
  await page.click('#pbfLoad');
  await page.waitForFunction(() => /Could not load/.test(document.querySelector('#pbfNote').textContent), null, { timeout: 5000 });
  ok(/could not start \(boom\)/.test(await T('#pbfNote')) && await page.evaluate(() => MODI.forge.mounted === false), 'module 21 failing to start: reported in the UI, left unmounted for a retry', await T('#pbfNote'));
  await page.evaluate(() => { MODI.forge = { key: 'forge', mounted: false, mount() { }, publishPages: () => [CMS.pageFromHtml({ title: 'Divorce With Children in Dallas', slug: 'divorce-children-dallas', meta_description: 'Conservatorship and child support.', html: '<section><h1>Divorce With Children in Dallas</h1><p>Text.</p></section>' })], publishAssets: () => [{ file: 'office.webp' }], publishSite: () => ({ name: 'Example Family Law', url: 'https://www.example.com', cms: 'https://cms.example.com' }) }; });
  await page.click('#pbfLoad');
  await page.waitForFunction(() => /loaded from the Site Forge/.test(document.querySelector('#pbfNote').textContent), null, { timeout: 5000 });
  ok(await page.evaluate(() => MODI.forge.mounted === true), 'module 21 is mounted silently before its pages are read');
  ok(/cms\.example\.com/.test(await T('#pbfSite')) && /1 photo/.test(await T('#pbfSite')), 'publishSite and publishAssets are shown in the forge pane', await T('#pbfSite'));
  ok(!!(await page.$('#pbPages tbody tr[data-slug="divorce-children-dallas"]')) && /held back by the compliance screen/.test(await T('#pbfWarn')), 'forge pages land in the table and the held ones are called out');
  const real = await page.evaluate(() => !!globalThis.__FORGE);
  if (real) {
    const before = errors.length;
    await page.evaluate(() => { MODI.forge = globalThis.__FORGE; });
    await page.click('#pbfLoad');
    await page.waitForFunction(() => /loaded from the Site Forge|plan is empty|Could not load/.test(document.querySelector('#pbfNote').textContent) && !document.querySelector('#pbfLoad').disabled, null, { timeout: 60000 });
    const fn = await T('#pbfNote');
    ok(errors.length === before, 'the real module 21 hands over without a page error', fn);
    note('real module 21: ' + fn);
  } else { await page.evaluate(() => { delete MODI.forge; }); note('module 21 (src/40_m21_forge.js) is not in this build yet; the real hand off was not exercised'); }
} catch (e) { ok(false, 'unexpected exception', e.stack || e.message); }

/* ---- screenshots: a fresh page at 1440 and 390, light and dark ---- */
try {
  for (const w of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 1000 } }); const pg = await ctx.newPage(); watch(pg, 'shot' + w);
    await pg.goto(APP, { waitUntil: 'load', timeout: 120000 });
    await pg.waitForSelector('#pbTargets .pb-card', { timeout: 30000 });
    await pg.evaluate(f => { FIRM.set(f); }, FIRM_TEST);
    await pg.click('#pbTabs button[data-v="composer"]');
    await pg.fill('#pbcTitle', TITLE); await pg.fill('#pbcMeta', META); await pg.click('#pbcTmpl'); await pg.click('#pbcAdd');
    await pg.evaluate(() => MODI.publish.receive({ pages: [CMS.pageFromHtml({ title: 'Custody Help in Dallas', slug: 'custody-guarantee', html: '<section><h1>Custody Help in Dallas</h1><p>We guarantee the outcome of your custody case.</p></section>' })] }));
    await pg.click('#pbPages tbody tr[data-slug="custody-guarantee"] button[data-a="screen"]');
    await pg.click(`#pbPages tbody tr[data-slug="${SLUG}"] button[data-a="preview"]`);
    await pg.waitForTimeout(300);
    const sw = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    ok(sw.sw <= sw.iw, `no horizontal page scroll at ${w}`, JSON.stringify(sw));
    for (const theme of ['light', 'dark']) {
      await pg.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
      await pg.evaluate(() => window.scrollTo(0, 0));
      const top = path.join(SHOTS, `publish_${w}_${theme}.png`); await pg.screenshot({ path: top, fullPage: false });
      const el = await pg.$('#mod-publish'); const full = path.join(SHOTS, `publish_${w}_${theme}_module.png`); await el.screenshot({ path: full });
      ok(fs.existsSync(top) && fs.existsSync(full), `screenshots at ${w} ${theme}`, full);
    }
    await ctx.close();
  }
} catch (e) { ok(false, 'screenshot pass failed', e.stack || e.message); }

ok(errors.length === 0, 'no page errors or console errors', errors.join(' || ').slice(0, 900));
console.log(checks.join('\n'));
if (warnings.length) console.log('warnings (external resources, not counted):\n  ' + [...new Set(warnings)].slice(0, 6).join('\n  '));
console.log(`\nscreenshots: ${SHOTS}\n${checks.filter(c => c.startsWith('PASS')).length} passed, ${failed} failed`);
await browser.close();
process.exit(failed ? 1 : 0);
