/* End to end run of the unpacked extension in headless Chromium (Playwright).
   1. Loads the extension, finds its id from the service worker, opens app.html.
   2. Clicks every rail tab (01 to 16) and waits for each module's masthead; page errors and console errors are collected per module.
   3. Module 16 · Publish: the ten adapter cards render, the composer adds a page, the preview renders it, Webflow is configured
      with cfg.apiBase pointing at a mock Data API on 127.0.0.1 (Webflow has fixed hosts, so no permission prompt is needed),
      Test connects, a draft deploy creates the item, a live deploy updates and publishes it, Publish site now republishes the site.
      The mock records every request and the test asserts the method, path, query, headers and body shapes.
   4. Module 15 · Accounts: the seven provider cards render.
   Screenshots: tests/e2e/publish.png and tests/e2e/accounts.png.
   Run: node tests/e2e/run.mjs   (Playwright from /opt/node22/lib/node_modules/playwright, browsers under /opt/pw-browsers).
   Not part of `node tests/run.mjs`; exits 1 on any failed assertion.
   What cannot run headless: the optional host permission prompt for a user domain adapter (WordPress, Drupal, Joomla, Ghost) and
   the OAuth sign in of module 15; both are reported in the output, not asserted. */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mock } from '../lib/mock.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, 'tests', 'e2e');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch (e) { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const checks = []; let failed = 0;
const ok = (cond, label, extra) => { checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  (' + String(extra).replace(/\s+/g, ' ').slice(0, 300) + ')' : ''}`); if (!cond) failed++; return !!cond; };
const note = m => checks.push('NOTE  ' + m);

/* ---- mock Webflow Data API v2 with CORS (the extension has no host permission for 127.0.0.1, so the browser preflights) ---- */
const TOKEN = 'wf-e2e-token'; const AUTH = 'Bearer ' + TOKEN;
const cors = c => ({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': c.headers['access-control-request-headers'] || 'authorization,content-type,accept', 'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Expose-Headers': '*', 'Access-Control-Max-Age': '600' });
const authed = (c, out) => c.headers.authorization === AUTH ? out : { status: 401, json: { message: 'Request not authorized', code: 'not_authorized' } };
const FIELDS = [{ id: 'f1', isRequired: true, type: 'PlainText', slug: 'name', displayName: 'Name' }, { id: 'f2', isRequired: true, type: 'PlainText', slug: 'slug' }, { id: 'f3', type: 'RichText', slug: 'post-body' }, { id: 'f4', type: 'PlainText', slug: 'summary' }, { id: 'f5', type: 'PlainText', slug: 'meta-title' }, { id: 'f6', type: 'PlainText', slug: 'meta-description' }, { id: 'f7', type: 'PlainText', slug: 'schema' }];
const ITEMS = {}; let seq = 0; let sitePublishes = 0;
const srv = await mock([
  { method: 'OPTIONS', path: /.*/, handler: c => ({ status: 204, headers: cors(c) }) },
  { method: 'GET', path: '/v2/token/introspect', handler: c => authed(c, { status: 200, json: { authorization: { id: 'a1', grantType: 'authorization_code', scope: 'cms:read cms:write sites:read sites:write assets:read assets:write', authorizedTo: { siteIds: ['s1'] }, rateLimit: 60 } } }) },
  { method: 'GET', path: '/v2/sites/s1', handler: c => authed(c, { status: 200, json: { id: 's1', displayName: 'E2E Site', shortName: 'e2e-site', lastPublished: '2026-09-01T10:00:00Z', customDomains: [{ id: 'd1', url: 'www.example.com' }] } }) },
  { method: 'POST', path: '/v2/sites/s1/publish', handler: c => { sitePublishes++; return authed(c, { status: 202, json: { customDomains: c.json.customDomains || [], publishToWebflowSubdomain: !!c.json.publishToWebflowSubdomain } }); } },
  { method: 'GET', path: '/v2/collections/c1', handler: c => authed(c, { status: 200, json: { id: 'c1', displayName: 'Pages', singularName: 'Page', slug: 'pages', fields: FIELDS } }) },
  { method: 'GET', path: '/v2/collections/c1/items', handler: c => authed(c, { status: 200, json: { items: Object.values(ITEMS).filter(i => !c.query.slug || i.fieldData.slug === c.query.slug), pagination: { limit: 100, offset: 0, total: Object.keys(ITEMS).length } } }) },
  { method: 'POST', path: '/v2/collections/c1/items', handler: c => { const id = 'i' + (++seq); ITEMS[id] = { id, cmsLocaleId: null, isArchived: c.json.isArchived, isDraft: c.json.isDraft, fieldData: c.json.fieldData }; return authed(c, { status: 202, json: ITEMS[id] }); } },
  { method: 'PATCH', path: /^\/v2\/collections\/c1\/items\/[^/]+$/, handler: c => { const id = c.path.split('/').pop(); if (!ITEMS[id]) return { status: 404, json: { message: 'Item not found', code: 'resource_not_found' } }; Object.assign(ITEMS[id], { isDraft: c.json.isDraft, isArchived: c.json.isArchived }); Object.assign(ITEMS[id].fieldData, c.json.fieldData || {}); return authed(c, { status: 200, json: ITEMS[id] }); } },
  { method: 'POST', path: '/v2/collections/c1/items/publish', handler: c => authed(c, { status: 202, json: { publishedItemIds: c.json.itemIds, errors: [] } }) },
].map(r => r.method === 'OPTIONS' ? r : Object.assign({}, r, { handler: c => { const out = r.handler(c); out.headers = Object.assign({}, out.headers || {}, cors(c)); return out; } })));
const reqs = () => srv.calls.filter(c => c.method !== 'OPTIONS');

/* ---- launch: the default headless shell cannot load extensions; the full chromium channel with the new headless mode can ---- */
async function launch() {
  const base = { headless: true, args: ['--headless=new', '--disable-extensions-except=' + ROOT, '--load-extension=' + ROOT, '--no-sandbox'], viewport: { width: 1400, height: 1000 } };
  try { return await chromium.launchPersistentContext('', Object.assign({ channel: 'chromium' }, base)); }
  catch (e) { console.log('channel chromium failed, retrying with the default build: ' + e.message.split('\n')[0]); return chromium.launchPersistentContext('', base); }
}
const context = await launch();
let sw = context.serviceWorkers()[0]; if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
const id = new URL(sw.url()).host;
ok(/^[a-p]{32}$/.test(id), 'extension id from the service worker', id);
const page = await context.newPage();
const errors = [], warnings = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); const u = (m.location() || {}).url || ''; if (/Failed to load resource|net::ERR_/.test(t) && !/chrome-extension:/.test(u)) warnings.push('external resource: ' + t + ' ' + u); else errors.push('console: ' + t + (u ? ' @ ' + u : '')); });

const EXPECT_MODS = ['index', 'replace', 'rules', 'drivers', 'paid', 'ground', 'supply', 'desk', 'forge', 'satchel', 'dfw', 'lines', 'watch', 'weather', 'accounts', 'publish'];
const ADAPTERS = ['wp_elementor', 'wp_headless', 'drupal', 'wix', 'duda', 'webflow', 'shopify', 'hubspot', 'joomla', 'ghost'];
const PROVIDERS = ['google', 'lsa', 'youtube', 'meta', 'tiktok', 'microsoft', 'linkedin'];

try {
  await page.goto(`chrome-extension://${id}/app.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#rail button', { timeout: 30000 });
  const keys = await page.$$eval('#rail button', els => els.map(b => b.id.slice(4)));
  ok(keys.length === 16 && keys.join(',') === EXPECT_MODS.join(','), 'rail lists the 16 modules in order', keys.join(','));
  const nums = await page.$$eval('#rail button .n', els => els.map(b => b.textContent.trim()));
  ok(nums.join(',') === EXPECT_MODS.map((_, i) => String(i + 1).padStart(2, '0')).join(','), 'rail numbers run 01 to 16', nums.join(','));

  /* every module: click the tab, wait for the mast, count the errors that appeared while it mounted */
  for (const k of keys) {
    const before = errors.length; const t0 = Date.now();
    await page.click('#tab-' + k);
    let mast = false; try { await page.waitForSelector(`#mod-${k} .mast`, { timeout: 60000 }); mast = true; } catch (e) { }
    const shown = mast && await page.$eval('#mod-' + k, s => !s.hidden);
    const eyebrow = mast ? await page.$eval(`#mod-${k} .mast`, m => (m.querySelector('.eyebrow') || m).textContent.trim().slice(0, 60)) : '';
    ok(mast && shown, `module ${k} renders its masthead`, `${Date.now() - t0} ms ${eyebrow}`);
    const fresh = errors.slice(before);
    ok(fresh.length === 0, `module ${k} mounts without page or console errors`, fresh.join(' || '));
  }

  /* ---- module 16 · Publish ---- */
  await page.click('#tab-publish');
  await page.waitForFunction(() => { const t = document.querySelector('#p16Targets'); return t && t.querySelector('.conn'); }, null, { timeout: 15000 });
  const cardIds = await page.$$eval('#p16Targets .conn[data-id]', els => els.map(e => e.dataset.id));
  ok(ADAPTERS.every(a => cardIds.includes(a)), 'adapter cards render for all ten platform ids', cardIds.join(','));
  ok(cardIds.length === ADAPTERS.length, 'no extra adapter cards', cardIds.length);
  for (const a of ADAPTERS) {
    const info = await page.$eval(`#p16Targets .conn[data-id="${a}"]`, c => ({ fields: c.querySelectorAll('[data-k]').length, save: !!c.querySelector('button[data-a="save"]'), test: !!c.querySelector('button[data-a="test"]'), use: !!c.querySelector('input[name="p16Use"]'), setup: c.querySelectorAll('details.cdet').length, st: (c.querySelector('.pill') || {}).textContent || '' }));
    ok(info.fields > 0 && info.save && info.test && info.use && info.setup === 2, `card ${a}: fields, Save, Test, Use as target, Setup and Clear`, JSON.stringify(info));
  }
  ok((await page.$$eval('#p16Target option', els => els.length)) === ADAPTERS.length + 1, 'target select lists every adapter');
  ok(await page.$('#p16Targets .conn[data-id="wp_headless"] button[data-a="configure"]') != null, 'wp_headless card shows Configure bridge');
  ok(await page.$('#p16Targets .conn[data-id="duda"] button[data-a="publishSite"]') != null, 'duda card shows Publish site');

  /* composer → page → preview */
  await page.click('#p16Tabs button[data-v="composer"]');
  await page.fill('#p16cTitle', 'AC Repair in Mesquite');
  ok((await page.inputValue('#p16cSlug')) === 'ac-repair-in-mesquite', 'slug follows the title');
  await page.fill('#p16cMeta', 'Same day AC repair across Mesquite and Dallas Fort Worth with written prices before the work starts and licensed technicians.');
  await page.click('#p16cTmpl');
  ok(/<h1>AC Repair in Mesquite<\/h1>/.test(await page.inputValue('#p16cHtml')), 'starter template inserted');
  await page.fill('#p16cSchema', '{"@context":"https://schema.org","@type":"WebPage","name":"AC Repair in Mesquite"}');
  ok(/valid/.test(await page.textContent('#p16cSchemaN')) && !/not valid/.test(await page.textContent('#p16cSchemaN')), 'JSON-LD validated');
  await page.click('#p16cAdd');
  await page.waitForSelector('#p16Pages tbody tr[data-slug="ac-repair-in-mesquite"]', { timeout: 5000 });
  ok((await page.$$eval('#p16Pages tbody tr', els => els.length)) === 1, 'composer added one page row');
  ok(/1 of 1 selected/.test(await page.textContent('#p16SelN')), 'new page is selected');
  await page.click('#p16Pages tbody tr button[data-a="preview"]');
  await page.waitForSelector('#p16Preview iframe', { timeout: 5000 });
  const frame = await (await page.$('#p16Preview iframe')).contentFrame();
  await frame.waitForSelector('h1', { timeout: 5000 });
  ok(/AC Repair in Mesquite/.test(await frame.textContent('h1')) && /AC Repair in Mesquite/.test(await frame.title()), 'preview renders the h1 and title');
  ok(await frame.$('script[type="application/ld+json"]') != null, 'preview carries the JSON-LD');

  /* configure Webflow against the mock: fill the card, Save, then point apiBase at the mock */
  await page.fill('#p16F-webflow-token', TOKEN);
  await page.fill('#p16F-webflow-siteId', 's1');
  await page.fill('#p16F-webflow-collectionId', 'c1');
  await page.fill('#p16F-webflow-schemaField', 'schema');
  await page.fill('#p16F-webflow-siteUrl', 'https://www.example.com');
  await page.check('#p16F-webflow-publishItems');
  await page.click('#p16Targets .conn[data-id="webflow"] button[data-a="save"]');
  await page.waitForFunction(() => /Configured, not tested/.test(document.querySelector('#p16St-webflow').textContent), null, { timeout: 5000 });
  const saved = await page.evaluate(() => CMS.cfg('webflow'));
  ok(saved.token === TOKEN && saved.siteId === 's1' && saved.collectionId === 'c1' && saved.publishItems === true, 'Save wrote the Webflow fields', JSON.stringify(Object.assign({}, saved, { token: '***' })));
  await page.evaluate(u => CMS.setCfg('webflow', { apiBase: u }), srv.url);
  ok((await page.evaluate(() => CMS.get('webflow').base(CMS.cfg('webflow')))) === srv.url, 'cfg.apiBase points the adapter at the mock', srv.url);
  await page.click('#p16Targets .conn[data-id="webflow"] button[data-a="test"]');
  await page.waitForFunction(() => /Connected|did not pass|ERROR|Could not/.test(document.querySelector('#p16St-webflow').textContent + document.querySelector('#p16Log-webflow').textContent), null, { timeout: 20000 });
  const stTxt = await page.textContent('#p16St-webflow'); const logTxt = await page.textContent('#p16Log-webflow');
  ok(/Connected/.test(stTxt), 'Test connects to the mock through cfg.apiBase', stTxt + ' | ' + logTxt);
  const intro = srv.find('GET', '/v2/token/introspect');
  ok(intro && intro.headers.authorization === AUTH && /json/.test(intro.headers.accept || ''), 'mock received the token introspect with the Bearer header', intro ? JSON.stringify({ auth: intro.headers.authorization, accept: intro.headers.accept, origin: intro.headers.origin }) : 'no request');
  ok(!!srv.find('GET', '/v2/sites/s1') && !!srv.find('GET', '/v2/collections/c1'), 'Test read the site and the collection');
  ok(/E2E Site/.test(logTxt) && /collection Pages/.test(logTxt), 'card log shows the adapter info', logTxt);

  /* target and draft deploy */
  await page.click('#p16Targets .conn[data-id="webflow"] input[name="p16Use"]');
  ok((await page.inputValue('#p16Target')) === 'webflow', 'Webflow is the target');
  ok(/Deploy 1 selected to Webflow/.test(await page.textContent('#p16Go')), 'deploy button names the target');
  const n0 = reqs().length;
  await page.click('#p16Go');
  await page.waitForFunction(() => /Done: \d+ sent|ERROR/.test(document.querySelector('#p16Status').textContent), null, { timeout: 30000 });
  const st1 = await page.textContent('#p16Status');
  ok(/Done: 1 sent, 0 skipped, 0 failed/.test(st1), 'draft deploy reports 1 sent', st1.split('\n').slice(-3).join(' | '));
  const look = reqs().slice(n0).find(c => c.method === 'GET' && c.path === '/v2/collections/c1/items');
  ok(look && look.query.slug === 'ac-repair-in-mesquite' && look.query.limit === '1' && look.headers.authorization === AUTH, 'slug lookup: GET items?slug=&limit=1 with auth', look ? look.url : 'none');
  const cr = reqs().slice(n0).find(c => c.method === 'POST' && c.path === '/v2/collections/c1/items');
  ok(cr && cr.headers['content-type'] === 'application/json' && cr.json.isDraft === true && cr.json.isArchived === false, 'create: POST items as a draft with JSON body', cr ? JSON.stringify({ isDraft: cr.json.isDraft, isArchived: cr.json.isArchived }) : 'none');
  const fd = cr ? cr.json.fieldData : {};
  ok(fd.name === 'AC Repair in Mesquite' && fd.slug === 'ac-repair-in-mesquite' && /<h1>AC Repair in Mesquite<\/h1>/.test(fd['post-body'] || '') && typeof fd['meta-description'] === 'string' && fd['meta-description'].length > 50 && /schema\.org/.test(fd.schema || ''), 'fieldData carries name, slug, rich text body, meta description and the JSON-LD string', JSON.stringify(Object.keys(fd)));
  ok(!/<(section|style|script)\b/i.test(fd['post-body'] || ''), 'rich text body has no section, style or script tags');
  const row = await page.textContent('#p16Results tbody tr');
  ok(/draft/.test(row) && /created/.test(row) && /example\.com\/pages\/ac-repair-in-mesquite/.test(row), 'results row: draft, created, link', row);
  ok(/sent draft/.test(await page.textContent('#p16Pages tbody tr[data-slug="ac-repair-in-mesquite"]')), 'page row shows sent draft from the ledger');
  ok(!(await page.$eval('#p16SiteGo', b => b.hidden)), 'Publish site now appears (Webflow publishes at site level)');

  /* second run skips the sent page; then live: two clicks, PATCH and items/publish */
  await page.click('#p16Go');
  await page.waitForFunction(() => /Done: 0 sent, 1 skipped/.test(document.querySelector('#p16Status').textContent), null, { timeout: 15000 });
  ok(reqs().filter(c => c.method === 'POST' && c.path === '/v2/collections/c1/items').length === 1, 'already sent page is skipped without a second create');
  await page.uncheck('#p16OnlyNew'); await page.check('#p16Live');
  await page.click('#p16Go');
  ok(/Click again to publish 1 live/.test(await page.textContent('#p16Go')), 'publish live arms the button first');
  const n1 = reqs().length;
  await page.click('#p16Go');
  await page.waitForFunction(() => /Done: 1 sent, 0 skipped, 0 failed/.test(document.querySelector('#p16Status').textContent), null, { timeout: 30000 });
  const upd = reqs().slice(n1).find(c => c.method === 'PATCH' && /^\/v2\/collections\/c1\/items\/i1$/.test(c.path));
  ok(upd && upd.json.isDraft === false && upd.json.fieldData.slug === 'ac-repair-in-mesquite', 'live deploy: PATCH items/i1 with isDraft false', upd ? JSON.stringify({ isDraft: upd.json.isDraft }) : 'none');
  const pub = reqs().slice(n1).find(c => c.method === 'POST' && c.path === '/v2/collections/c1/items/publish');
  ok(pub && Array.isArray(pub.json.itemIds) && pub.json.itemIds[0] === 'i1', 'live deploy: POST items/publish {itemIds}', pub ? JSON.stringify(pub.json) : 'none');
  const row2 = await page.textContent('#p16Results tbody tr');
  ok(/publish/.test(row2) && /updated/.test(row2), 'results row: publish, updated', row2);
  await page.click('#p16SiteGo');
  for (const t0 = Date.now(); sitePublishes < 1 && Date.now() - t0 < 15000;) await new Promise(r => setTimeout(r, 100));
  await page.waitForFunction(() => !document.querySelector('#p16SiteGo').disabled, null, { timeout: 15000 });
  const stSite = (await page.textContent('#p16Status')).split('\n').slice(-2).join(' | ');
  ok(/Publishing the site on Webflow/.test(await page.textContent('#p16Status')) && !/Site publish failed/.test(stSite), 'Publish site now ran without an error', stSite);
  const sp = srv.find('POST', '/v2/sites/s1/publish');
  ok(sitePublishes === 1 && sp && sp.json.publishToWebflowSubdomain === true && Array.isArray(sp.json.customDomains) && sp.json.customDomains[0] === 'd1', 'Publish site now: POST sites/s1/publish with the custom domain ids', sp ? JSON.stringify(sp.json) : 'none');
  const ledger = await page.textContent('#p16LedgerT');
  ok(/ac-repair-in-mesquite/.test(ledger) && /publish/.test(ledger), 'ledger lists the page as published');
  ok(/Pages sent\s*1/.test((await page.textContent('#p16Kpis')).replace(/\s+/g, ' ')), 'KPI counts the sent page');
  const bad = reqs().filter(c => !c.headers.authorization);
  ok(bad.length === 0, 'every API request carried the Authorization header', bad.map(c => c.method + ' ' + c.path).join(', '));
  note('Not run headless: the optional host permission prompt for user domain adapters (WordPress, Drupal, Joomla, Ghost) and OAuth sign in in module 15; the mock deploy used Webflow with cfg.apiBase because its hosts are fixed in the manifest.');
  await page.screenshot({ path: path.join(DIR, 'publish.png'), fullPage: true });
  ok(fs.existsSync(path.join(DIR, 'publish.png')), 'screenshot tests/e2e/publish.png saved');

  /* ---- module 15 · Accounts ---- */
  await page.click('#tab-accounts');
  await page.waitForSelector('#a15Conn .conn', { timeout: 15000 });
  const provs = await page.$$eval('#a15Conn .conn[data-p]', els => els.map(e => e.dataset.p));
  ok(provs.join(',') === PROVIDERS.join(','), 'seven provider cards render in order', provs.join(','));
  for (const p of PROVIDERS) {
    const info = await page.$eval(`#a15Conn .conn[data-p="${p}"]`, c => ({ name: (c.querySelector('.ch b') || {}).textContent || '', pill: (c.querySelector('.pill') || {}).textContent || '', buttons: c.querySelectorAll('button[data-a]').length, fields: c.querySelectorAll('input,select').length }));
    ok(info.name.length > 2 && info.buttons > 0, `provider card ${p}: ${info.name}`, JSON.stringify(info));
  }
  const redirect = await page.evaluate(() => ACCT.redirectUrl());
  ok(/^https:\/\/[a-p]{32}\.chromiumapp\.org\/$/.test(redirect), 'redirect URL comes from chrome.identity', redirect);
  await page.screenshot({ path: path.join(DIR, 'accounts.png'), fullPage: true });
  ok(fs.existsSync(path.join(DIR, 'accounts.png')), 'screenshot tests/e2e/accounts.png saved');

  /* hash routing still works after the tour */
  await page.evaluate(() => { location.hash = '#weather'; });
  await page.waitForFunction(() => !document.querySelector('#mod-weather').hidden, null, { timeout: 5000 });
  ok(true, 'hash routing shows a module');
} catch (e) { ok(false, 'unexpected exception', e.stack || e.message); }

ok(errors.length === 0, 'no page errors or console errors during the whole run', errors.join(' || '));
console.log(checks.join('\n'));
if (warnings.length) console.log('warnings (external resources, not counted):\n  ' + [...new Set(warnings)].slice(0, 6).join('\n  '));
console.log(`\n${checks.filter(c => c.startsWith('PASS')).length} passed, ${failed} failed`);
await context.close(); await srv.close();
process.exit(failed ? 1 : 0);
