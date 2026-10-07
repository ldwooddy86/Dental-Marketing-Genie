/* End to end run of the Leviathan browser app in headless Chromium (Playwright).
   1. Loads the unpacked extension, reads its id from the service worker, opens app.html. The console must start inside its
      sandboxed frame (opaque origin, no localStorage) with the bridge ahead of it and build the spine.
   2. Opens the Louisiana Thermal Debt Atlas (hvac: inline payload, "atlas" bridge), then the Dental Divide Atlas (dental: the
      Leviathan-data.js companion, "shell" bridge with nested module documents), then OmegaWeapon (core). Each must register
      with the console over the postMessage bridge inside the console's own 90 second budget.
   3. Theme: the console's Dark button must reach the atlas documents and a Dental Divide module document; the preference must
      land in extension storage and come back after a reload.
   4. Route: the tab's URL must follow the console (hvac.paid) and a hash set on the tab must drive the console.
   5. The popup lists every dashboard, shows the recent atlases and finds the Dental Divide by search.
   6. The Résumé Forge: #resume.on-the-map-marketing draws the agency, its weaknesses and needs and the ranked tracks; a
      draft builds into a plain text résumé with an ATS score; the draft reaches extension storage through the bridge store
      and comes back after a reload; the Agency Field rows link to it; the popup offers the view.
   Screenshots: tests/e2e/console.png and tests/e2e/popup.png. Exits 1 on a failed assertion or a sandbox, CSP or bridge error.
   Run: node tests/e2e/run.mjs   (Playwright from /opt/node22/lib/node_modules/playwright, browsers under /opt/pw-browsers;
   the default headless shell cannot load extensions, the full chromium channel with the new headless mode can). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, 'tests', 'e2e');
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const checks = []; let failed = 0;
const ok = (cond, label, extra) => { checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== undefined ? '  (' + String(extra).replace(/\s+/g, ' ').slice(0, 260) + ')' : ''}`); if (!cond) failed++; return !!cond; };
const note = m => checks.push('NOTE  ' + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout, every) { const t0 = Date.now(); let v; while (Date.now() - t0 < timeout) { try { v = await fn(); } catch (e) { v = undefined; } if (v) return v; await sleep(every || 150); } return v; }

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
const classify = (t, u) => { if (/Failed to load resource|net::ERR_|ERR_BLOCKED|fonts\.g|googletagmanager|facebook\.net/.test(t + ' ' + u) && !/chrome-extension:\/\/[a-p]{32}\/(app|popup|console\/Leviathan|console\/ext)/.test(u)) warnings.push(t + ' ' + u); else errors.push(t + (u ? ' @ ' + u : '')); };
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') classify(m.text(), (m.location() || {}).url || ''); });

const consoleFrame = () => until(() => page.frames().find(f => /console\/Leviathan\.html/.test(f.url())), 20000);
const atlasFrame = (cf, mid) => until(async () => { for (const f of cf.childFrames()) { try { if ((await f.evaluate(() => window.__LV && window.__LV.id)) === mid) return f; } catch (e) { /* frame navigating */ } } return null; }, 30000, 250);
const waitLive = (cf, mid, timeout) => until(() => cf.evaluate(m => { const L = window.__LV_CONSOLE && window.__LV_CONSOLE.live[m]; if (!L || (L.state !== 'ready' && L.state !== 'error')) return null; let cur = null, route = null; try { cur = L.api && L.api.current(); route = L.api && L.api.route(); } catch (e) { /* ignore */ } return { state: L.state, kind: L.api && L.api.kind, cur, route }; }, mid), timeout || 120000, 300);
const tabHash = () => page.evaluate(() => location.hash);

try {
  /* ---- 1. the console starts sandboxed ---- */
  await page.goto(`chrome-extension://${id}/app.html`, { waitUntil: 'domcontentloaded' });
  let cf = await consoleFrame();
  if (!ok(!!cf, 'the console frame loads from console/Leviathan.html')) throw new Error('no console frame');
  await cf.waitForSelector('#lv-nav a.ni', { timeout: 60000 });
  const boot = await cf.evaluate(() => ({ ext: !!window.__LV_EXT, ver: window.__LV_CONSOLE && window.__LV_CONSOLE.version, origin: window.origin, storage: (() => { try { localStorage.getItem('x'); return 'available'; } catch (e) { return e.name; } })(), nav: document.querySelectorAll('#lv-nav a.ni').length, ground: getComputedStyle(document.body).backgroundColor }));
  ok(boot.ext, 'the bridge script is loaded ahead of the console');
  ok(boot.origin === 'null' && boot.storage === 'SecurityError', 'the console runs sandboxed: opaque origin, no localStorage', `${boot.origin} ${boot.storage}`);
  ok(boot.nav >= 16, 'the spine lists the dashboards', boot.nav + ' entries');
  note(`console ${boot.ver}, body ${boot.ground}`);
  ok((await tabHash()) === '#command' || (await until(() => tabHash().then(h => h === '#command' ? h : null), 5000)), 'the tab URL carries the console route at start', await tabHash());

  /* ---- 2a. hvac: an atlas with an inline payload ---- */
  await page.evaluate(() => { location.hash = '#hvac'; });
  const hv = await waitLive(cf, 'hvac');
  ok(hv && hv.state === 'ready', 'Thermal Debt (hvac) registers through the bridge', JSON.stringify(hv));
  ok(hv && hv.kind === 'atlas' && typeof hv.cur === 'string', 'the hvac proxy api reports its kind and current module', JSON.stringify(hv));
  const hf = await atlasFrame(cf, 'hvac');
  ok(!!hf, 'the hvac document is reachable');
  if (hf) {
    const st = await hf.evaluate(() => ({ host: !!(window.__LV && window.__LV.host), embed: document.documentElement.classList.contains('lv-embed'), railOff: document.documentElement.classList.contains('lv-rail-off'), origin: window.origin, parentShadowed: !!(window.parent && window.parent.__LEVIATHAN) }));
    ok(st.host && st.embed && st.parentShadowed, 'hvac found the host through the shim (lv-embed set)', JSON.stringify(st));
    ok(st.railOff, 'hvac hides its own rail while the spine is shown', JSON.stringify(st));
  }
  ok(!!(await until(() => tabHash().then(h => h.startsWith('#hvac') ? h : null), 10000)), 'the tab URL follows the console into the atlas', await tabHash());

  /* ---- 4. a sub module through the console, mirrored to the tab ---- */
  await cf.evaluate(() => window.__LV_CONSOLE.go('hvac.paid'));
  ok(!!(await until(() => cf.evaluate(() => { const L = window.__LV_CONSOLE.live.hvac; return L && L.api && L.api.current() === 'paid'; }), 20000)), 'go(hvac.paid) reaches the atlas and the cached module key follows');
  ok(!!(await until(() => tabHash().then(h => h === '#hvac.paid' ? h : null), 10000)), 'the tab URL shows hvac.paid', await tabHash());
  if (hf) ok(await hf.evaluate(() => { const s = document.getElementById('mod-paid'); return !!(s && !s.hidden); }), 'the atlas shows its paid module');

  /* ---- 3. theme over the bridge and into storage ---- */
  await cf.evaluate(() => document.querySelector('#lv-theme button[data-t="dark"]').click());
  ok(!!(await until(() => cf.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'), 5000)), 'the console turns dark');
  if (hf) ok(!!(await until(() => hf.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'), 10000)), 'hvac follows the theme over the bridge', await hf.evaluate(() => document.documentElement.getAttribute('data-theme')));
  ok(!!(await until(() => page.evaluate(() => new Promise(r => chrome.storage.local.get('leviathan.prefs.v1', v => r(v && v['leviathan.prefs.v1'] && v['leviathan.prefs.v1'].theme === 'dark')))), 5000)), 'the theme preference is written to extension storage');

  /* ---- 2b. dental: a shell atlas from the companion script ---- */
  await page.evaluate(() => { location.hash = '#dental'; });
  const dn = await waitLive(cf, 'dental', 180000);
  ok(dn && dn.state === 'ready', 'Dental Divide (companion script, shell) registers', JSON.stringify(dn));
  ok(dn && dn.kind === 'shell', 'the dental proxy api reports the shell kind', dn && dn.kind);
  const df = await atlasFrame(cf, 'dental');
  ok(!!df, 'the dental document is reachable');
  if (df) {
    ok(!!(await until(() => df.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'), 10000)), 'the dental shell is dark');
    const inner = await until(async () => { for (const f of df.childFrames()) { try { const v = await f.evaluate(() => ({ ready: document.readyState, theme: document.documentElement.getAttribute('data-theme'), tweaks: !!document.getElementById('lv-ext-tweaks'), themed: document.documentElement.hasAttribute('data-theme') })); if (v.ready === 'complete' && v.themed && v.theme === 'dark' && v.tweaks) return v; } catch (e) { /* ignore */ } } return null; }, 40000, 400);
    ok(!!inner, 'a dental module document receives the theme and the chrome tweaks through the inner shim', JSON.stringify(inner));
  }

  /* ---- 2c. core: OmegaWeapon ---- */
  await page.evaluate(() => { location.hash = '#core'; });
  const co = await waitLive(cf, 'core', 120000);
  ok(co && co.state === 'ready', 'OmegaWeapon (core) registers', JSON.stringify(co));
  const liveN = await cf.evaluate(() => Object.keys(window.__LV_CONSOLE.live).length);
  ok(liveN === 3, 'three atlases stay live at once', liveN);

  /* screenshot on the hvac paid module */
  await page.evaluate(() => { location.hash = '#hvac.paid'; });
  await until(() => cf.evaluate(() => { const L = window.__LV_CONSOLE.live.hvac; return L && L.api && L.api.current() === 'paid' && !L.wrap.classList.contains('off'); }), 10000);
  await sleep(800);
  await page.screenshot({ path: path.join(DIR, 'console.png') });

  /* ---- 3b. the preference and the route come back after a reload ---- */
  await page.goto('about:blank');
  await page.goto(`chrome-extension://${id}/app.html#hvac.paid`, { waitUntil: 'domcontentloaded' });
  cf = await consoleFrame(); await cf.waitForSelector('#lv-nav a.ni', { timeout: 60000 });
  const pf = await cf.evaluate(() => ({ theme: window.__LV_CONSOLE.prefs.theme, attr: document.documentElement.getAttribute('data-theme') }));
  ok(pf.theme === 'dark' && pf.attr === 'dark', 'the theme preference survives a reload', JSON.stringify(pf));
  const hv2 = await waitLive(cf, 'hvac');
  ok(hv2 && hv2.state === 'ready' && hv2.cur === 'paid', 'the route in the URL reopens hvac on the paid module', JSON.stringify(hv2));

  /* ---- 3c. dfw: the atlas whose payload the build rewrites (a withheld row dropped, the gzip re-encoded) ---- */
  await page.evaluate(() => { location.hash = '#dfw'; });
  const dw = await waitLive(cf, 'dfw', 120000);
  ok(dw && dw.state === 'ready', 'the Dallas Fort Worth atlas (dfw: a payload the build rewrites) registers through the bridge', JSON.stringify(dw));
  const wf = await atlasFrame(cf, 'dfw');
  ok(!!wf && await wf.evaluate(() => typeof window.__ATLAS_DATA__ === 'object' && window.__ATLAS_DATA__ !== null && Object.keys(window.__ATLAS_DATA__).length > 10), 'the rewritten dfw payload inflates in the console and its data parses');

  /* ---- 6. the Résumé Forge ---- */
  await page.evaluate(() => { location.hash = '#resume.on-the-map-marketing'; });
  await cf.waitForSelector('#rf-read .rf-item', { timeout: 30000 });
  const rf = await cf.evaluate(() => ({
    title: document.querySelector('#lv-view h1') && document.querySelector('#lv-view h1').textContent,
    agency: document.querySelector('.rf-ag h3') && document.querySelector('.rf-ag h3').textContent,
    items: document.querySelectorAll('#rf-read .rf-item').length,
    gaps: document.querySelectorAll('#rf-read .rf-badge.s3').length,
    tracks: document.querySelectorAll('#rf-read .rf-track').length,
    checked: document.querySelectorAll('#rf-read .rf-track[aria-checked="true"]').length,
    chips: document.querySelectorAll('#rf-draft .rf-chip').length,
    crumb: Array.from(document.querySelectorAll('#lv-crumbs .c')).map(e => e.textContent).join(' / '),
    spine: !!document.querySelector('#lv-nav [data-route="resume"][aria-current="page"]'),
    engine: !!window.__LV_RESUME_ENGINE, findings: typeof window.LV_FINDINGS_RAW === 'string',
    out: (document.getElementById('rf-out') || {}).textContent || '',
  }));
  ok(rf.title === 'Résumé Forge' && /On The Map Marketing/.test(rf.agency || '') && rf.engine && rf.findings, 'the Forge opens on the agency named in the route with the engine and the findings loaded', JSON.stringify({ title: rf.title, agency: rf.agency }));
  ok(rf.items >= 8 && rf.gaps >= 1 && rf.tracks === 3 && rf.checked === 1 && rf.chips >= 20, 'it draws the findings, the gaps, three track cards with one chosen, and the vocabulary chips', JSON.stringify({ items: rf.items, gaps: rf.gaps, tracks: rf.tracks, checked: rf.checked, chips: rf.chips }));
  ok(/On The Map Marketing/.test(rf.crumb) && /Résumé Forge/.test(rf.crumb) && rf.spine, 'the crumbs name the agency and the spine follows the Forge route', rf.crumb);
  ok(/\nSUMMARY\n/.test(rf.out) && /YOUR NAME/.test(rf.out), 'the preview builds live before anything is typed', rf.out.slice(0, 60));
  ok(!!(await until(() => tabHash().then(h => h === '#resume.on-the-map-marketing' ? h : null), 5000)), 'the tab URL carries the Forge route', await tabHash());
  await cf.fill('#rf-name', 'Jordan Rivera');
  await cf.fill('#rf-contact', 'Miami, FL · jordan@example.com · (555) 555-5555');
  await cf.fill('#rf-years', '7 years');
  await cf.fill('#rf-skills', 'Google Ads, Local Services Ads, Local SEO, GA4');
  await cf.evaluate(() => { const t = document.querySelector('#rf-draft .rf-exp textarea'); t.value = 'Managed $180k a month across Google Ads for 24 law firm accounts, cutting cost per signed case 31%'; t.dispatchEvent(new Event('input', { bubbles: true })); const d = document.querySelectorAll('#rf-draft .rf-exp input')[2]; d.value = 'Jan 2021 – Present'; d.dispatchEvent(new Event('input', { bubbles: true })); });
  await cf.click('#rf-build');
  const built = await until(() => cf.evaluate(() => { const o = document.getElementById('rf-out'), s = document.getElementById('rf-score'); return o && s && /JORDAN RIVERA/.test(o.textContent) ? { score: Number(s.textContent), text: o.textContent.slice(0, 600) } : null; }), 10000);
  ok(built && built.score > 0 && /\nSUMMARY\n/.test(built.text) && /Paid Search Manager|Local SEO Manager|Senior/.test(built.text.split('\n')[1]) && /\nSKILLS\n/.test(built.text), 'the résumé carries the name, a posted title in the headline, the summary and the skills, with an ATS score', JSON.stringify(built));
  /* a chip adds the agency's term to the front of the skills block */
  await cf.evaluate(() => { const b = Array.from(document.querySelectorAll('#rf-draft .rf-chip')).find(x => /Law firm SEO/i.test(x.textContent)); if (b) b.click(); });
  ok(!!(await until(() => cf.evaluate(() => /\nSKILLS\nLaw firm SEO,/.test(document.getElementById('rf-out').textContent)), 5000)), 'a vocabulary chip puts the agency’s term first in the skills block');
  /* exports: copy, download and print, each stubbed inside the console document */
  await cf.evaluate(() => { window.__rf = { copied: null, printed: 0, blobs: [] }; navigator.clipboard.writeText = t => { window.__rf.copied = t; return Promise.resolve(); }; window.print = () => { window.__rf.printed++; }; const orig = URL.createObjectURL; URL.createObjectURL = b => { window.__rf.blobs.push(b); return orig.call(URL, b); }; });
  await cf.click('#rf-check .btn.pri');
  await cf.click('#rf-dl-txt');
  await cf.click('#rf-print-btn');
  const ex = await until(() => cf.evaluate(async () => { const r = window.__rf; if (!r.copied || !r.blobs.length || !r.printed) return null; const t = await r.blobs[0].text(); return { copied: /JORDAN RIVERA/.test(r.copied), blob: /JORDAN RIVERA/.test(t), printed: r.printed, printDoc: !!document.getElementById('rf-print') && /Jordan Rivera/.test(document.getElementById('rf-print').textContent) }; }), 8000);
  ok(ex && ex.copied && ex.blob && ex.printed === 1 && ex.printDoc, 'copy, the .txt download and print each carry the résumé', JSON.stringify(ex));
  const stored = await until(() => page.evaluate(() => new Promise(r => chrome.storage.local.get('leviathan.store.v1', v => { const d = v && v['leviathan.store.v1'] && v['leviathan.store.v1'].resume; r(d && d.candidate && d.candidate.name === 'Jordan Rivera' ? d : null); }))), 8000);
  ok(!!stored && stored.last && stored.last.agency === 'on-the-map-marketing' && stored.tailor && stored.tailor['on-the-map-marketing'] && stored.tailor['on-the-map-marketing'].track, 'the draft reaches extension storage through the bridge store, with the tailoring kept per agency', stored && JSON.stringify({ name: stored.candidate.name, last: stored.last, track: stored.tailor['on-the-map-marketing'].track }));
  await page.goto('about:blank');
  await page.goto(`chrome-extension://${id}/app.html#resume`, { waitUntil: 'domcontentloaded' });
  cf = await consoleFrame(); await cf.waitForSelector('#rf-read .rf-row', { timeout: 60000 });
  const back = await until(() => cf.evaluate(() => { const n = document.getElementById('rf-name'); const cont = Array.from(document.querySelectorAll('#rf-read .btn.pri')).find(b => /Continue with On The Map Marketing/.test(b.textContent)); return n && n.value === 'Jordan Rivera' && cont ? { name: n.value, cont: true } : null; }), 10000);
  ok(!!back, 'the draft comes back after a reload and the picker offers the remembered agency', JSON.stringify(back));
  await cf.evaluate(() => { Array.from(document.querySelectorAll('#rf-read .btn.pri')).find(b => /Continue with/.test(b.textContent)).click(); });
  ok(!!(await until(() => tabHash().then(h => h === '#resume.on-the-map-marketing' ? h : null), 5000)) && !!(await until(() => cf.evaluate(() => /Law firm SEO,/.test(document.getElementById('rf-out').textContent)), 5000)), 'Continue reopens the agency without a reload and its tailoring is back', await tabHash());
  await page.evaluate(() => { location.hash = '#agencies'; });
  await cf.waitForSelector('.tbl.ag a[href^="#resume."]', { timeout: 20000 });
  ok(true, 'every Agency Field row links to the Forge');
  await page.evaluate(() => { location.hash = '#resume.on-the-map-marketing'; });
  await cf.waitForSelector('#rf-read .rf-item', { timeout: 20000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(DIR, 'forge.png') }).catch(() => { });

  /* ---- 5. the popup ---- */
  const pop = await context.newPage();
  pop.on('pageerror', e => errors.push('popup pageerror: ' + e.message));
  await pop.goto(`chrome-extension://${id}/popup.html`, { waitUntil: 'domcontentloaded' });
  await pop.waitForSelector('#list .row', { timeout: 15000 });
  const rows = await pop.$$eval('#list .row', els => els.map(e => e.getAttribute('data-route')));
  ok(rows.length >= 16 && rows.includes('dental') && rows.includes('core') && rows.includes('hvac'), 'the popup lists every dashboard', rows.length + ' rows');
  const views = await pop.$$eval('#views .v', els => els.map(e => e.textContent));
  ok(views.length === 4 && views.includes('Résumé Forge'), 'the popup offers the Résumé Forge view', views.join(', '));
  const recent = await pop.$$eval('#recentChips .chip', els => els.map(e => e.textContent));
  ok(recent.length >= 1, 'the popup shows the recently opened atlases', recent.join(', '));
  const ver = await pop.$eval('#ver', e => e.textContent);
  ok(/Console 1\.\d+\.\d+ · app \d+\.\d+\.\d+/.test(ver), 'the popup footer names the console and app versions', ver);
  await pop.screenshot({ path: path.join(DIR, 'popup.png') });
  await pop.fill('#q', 'dental divide');
  const found = await until(() => pop.$$eval('#list .row', els => els.map(e => e.getAttribute('data-route'))).then(r => r.length && r[0] === 'dental' ? r : null), 5000);
  ok(!!found, 'search finds the Dental Divide first', found && found.slice(0, 3).join(', '));

  /* ---- errors ---- */
  const hard = errors.filter(e => /SecurityError|Content Security Policy|Blocked a frame|Refused to|did not finish starting|could not open|is not defined|Cannot read/i.test(e));
  ok(hard.length === 0, 'no sandbox, CSP or bridge errors', hard.slice(0, 3).join(' | '));
  if (errors.length) note(`${errors.length} console error(s): ` + errors.slice(0, 6).map(e => e.slice(0, 180)).join(' | '));
  if (warnings.length) note(`${warnings.length} external resource warning(s): fonts or pixels the atlases reference`);
} catch (e) { ok(false, 'the run completed', (e && e.stack) || e); }
finally { await context.close(); }
console.log(checks.join('\n'));
console.log(`\n${checks.filter(c => c.startsWith('PASS')).length} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
