/* Competitor Watch core (src/08_watch_core.js): roster, observations, scores, importers, exports and link builders.
   Loads the real data, core, kit, firm profile, LINT and LINE_META into a vm context with a minimal DOM stub and an in-memory
   localStorage, then drives WATCH the way module 24 does. `node tests/run.mjs watch` */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { root } from './lib/load.mjs';
import { assert, eq } from './lib/mock.mjs';

const fakeEl = () => { const e = { style: {}, dataset: {}, children: [], className: '', innerHTML: '', textContent: '', classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, setAttribute() { }, getAttribute() { return null; }, appendChild(c) { e.children.push(c); return c; }, remove() { }, addEventListener() { }, removeEventListener() { }, querySelector() { return null; }, querySelectorAll() { return []; } }; return e; };
const mem = new Map();
const localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
const document = { createElement: fakeEl, body: fakeEl(), documentElement: fakeEl(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() { }, removeEventListener() { }, activeElement: null };
const ctx = { addEventListener() { }, removeEventListener() { }, dispatchEvent() { return true; }, matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { }, addListener() { } }), performance: globalThis.performance, ResizeObserver: class { observe() { } unobserve() { } disconnect() { } }, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout, innerWidth: 1400, innerHeight: 900, scrollX: 0, scrollY: 0, getComputedStyle: () => ({ getPropertyValue: () => '' }), console, document, localStorage, navigator: { userAgent: 'node', clipboard: {} }, location: { hash: '' }, history: { replaceState() { } }, setTimeout, clearTimeout, URL, URLSearchParams, Blob, TextEncoder, TextDecoder, Intl, Math, JSON, Date, fetch: globalThis.fetch, scrollTo() { } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
const run = rel => vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
run('data/suite.js');
for (const f of ['src/00_core.js', 'src/01_kit.js', 'src/02_firm.js', 'src/03_lint.js', 'src/08_watch_core.js', 'src/25_m06_lines.js']) run(f);
const g = expr => vm.runInContext(expr, ctx);
const W = g('WATCH'); const FIRM = g('FIRM'); const CI = g('CI'); const ZI = g('ZI');
const events = []; g('BUS').on('watch', e => events.push(e && e.what));
W.setClock('2026-10-01');
eq(W.today(), '2026-10-01', 'test clock');
assert(W.list().length === 0 && W.obs.length === 0, 'roster and ledger start empty: Severance ships no competitor data');

/* ---------- parsers ---------- */
eq(W.domOf('https://www.Example-Law.com/divorce/?x=1'), 'example-law.com', 'domOf strips scheme, www and path');
eq(W.countyByName('Harris County'), '48201', 'county by name with County'); eq(W.countyByName('harris'), '48201', 'county by name'); eq(W.countyByName('48113'), '48113', 'county by FIPS'); eq(W.countyByName('Nowhere'), '', 'unknown county');
eq(W.countiesFrom('Harris; Fort Bend, Montgomery'), ['48201', '48157', '48339'], 'county lists');
eq(W.linesFrom('divorce; custody; protective orders'), ['div_k', 'div_nk', 'sapcr', 'po'], 'line names and aliases');
eq(W.linesFrom(['mod', 'Enforcement', 'Prenups', 'nonsense']), ['mod', 'enf', 'prenup'], 'line keys, names and short names');
const off = W.parseOffice('1200 Main St, Houston, TX 77002'); eq([off.street, off.city, off.zip, off.county], ['1200 Main St', 'Houston', '77002', ZI['77002'].county], 'office parsed with county from the ZIP');
eq(W.parseOffice('Plano').county, W.countyByName('Collin'), 'office city resolves to its county');
eq(W.isoFrom('Started running on Sep 3, 2026'), '2026-09-03', 'Meta date'); eq(W.isoFrom('3 Sept 2026'), '2026-09-03', 'day month year'); eq(W.isoFrom('9/14/2026'), '2026-09-14', 'US numeric');
eq(W.inferLine('Agreed divorce, flat fee'), 'div_nk', 'inferLine uncontested'); eq(W.inferLine('Protect your kids in your divorce'), 'div_k', 'inferLine kids'); eq(W.inferLine('Served with a protective order?'), 'po', 'inferLine po'); eq(W.inferLine('Lost your job? Modify child support'), 'mod', 'inferLine mod');
eq(W.inferOffer('Free consultation today'), 'consult_free', 'free consult'); eq(W.inferOffer('Uncontested divorce, $1,500 flat fee'), 'flat', 'flat fee'); eq(W.inferOffer('No fee unless we win'), 'contingency', 'contingency'); eq(W.priceIn('only $1,500 flat'), 1500, 'priceIn');

/* ---------- roster ---------- */
FIRM.set({ name: 'Test Firm', counties: ['48201', '48157', '48339'], lines: ['div_k', 'div_nk', 'sapcr', 'mod'], attorneys: [{ name: 'Pat Lawyer', bar_no: '24000000', tbls: '' }], offices: [{ label: 'Main', city: 'Houston', zip: '77002', primary: true }], reviews: { rating: 4.8, count: 40, source: 'Google' }, consult: { free: false, fee: 150, virtual: true } });
const a = W.add({ name: 'Alpha Family Law, PLLC', domain: 'https://www.alphafamilylaw.example/', counties: 'Harris; Fort Bend', lines: 'divorce; custody', tier: 'direct', offices: ['500 Louisiana St, Houston, TX 77002'], lawyers: 'Ann Alpha (24011111); Bo Beta', meta_page_id: 'id 123456789' });
eq(a.key, 'alphafamilylaw-example', 'key from the domain'); eq(a.domain, 'alphafamilylaw.example', 'domain normalized'); eq(a.counties, ['48201', '48157'], 'counties'); eq(a.lines, ['div_k', 'div_nk', 'sapcr'], 'lines'); eq(a.lawyers, [{ name: 'Ann Alpha', bar_no: '24011111' }, { name: 'Bo Beta', bar_no: '' }], 'lawyers with bar numbers'); eq(a.meta_page_id, '123456789', 'page id digits');
const b = W.add({ name: 'Bravo Divorce Group', counties: ['48339'], lines: ['mod', 'enf'], tier: 'adjacent', offices: 'The Woodlands, TX 77380' });
assert(b.key === 'bravo-divorce-group' && b.offices[0].zip === '77380', 'second competitor');
const dup = W.add({ name: 'Alpha Family Law', domain: 'alphafamilylaw.example', counties: ['48339'] });
assert(dup.key === a.key && W.list().length === 2 && W.get(a.key).counties.includes('48339'), 'same domain merges instead of duplicating');
let threw = null; try { W.add({ name: '  ' }); } catch (e) { threw = e; } assert(threw && /needs a name/.test(threw.message), 'name required');
W.update(b.key, { name: 'Bravo Divorce Group PC', google_advertiser_id: 'ar01234567890' }); eq(W.get(b.key).google_advertiser_id, 'AR01234567890', 'advertiser id normalized');
W.archive(b.key, true); eq(W.list().map(c => c.key), [a.key], 'archived leaves the active list'); eq(W.list({ archived: true }).map(c => c.key), [b.key], 'archived list'); W.archive(b.key, false);
assert(events.includes('roster'), 'roster changes emit BUS watch');

/* ---------- observations ---------- */
const ad1 = W.observe(a.key, { kind: 'ad', platform: 'meta', status: 'active', first: '2026-09-20', last: '2026-10-01', text: "Texas's #1 divorce specialists. We guarantee the best outcome. Free consultation.", url: 'https://alphafamilylaw.example/divorce', ids: { lib: '1111111111' }, counties: 'Harris', zips: '77002 99999' });
eq(ad1.compName, 'Alpha Family Law, PLLC', 'observation carries the name'); eq(ad1.zips, ['77002'], 'invalid ZIPs dropped'); eq(ad1.counties, ['48201'], 'counties by name');
assert(ad1.lint.length >= 2 && ad1.lintBlock >= 1, 'LINT runs on competitor copy: guarantee blocks, superlative and specialist flagged');
assert(!ad1.lint.includes('r702a') && !ad1.lint.includes('house'), 'firm only checks (responsible lawyer footer, house style) are not run on competitor copy');
assert(!['r706', 'free_consult', 'arc_filing', 'tbls_unsupported'].some(id => ad1.lint.includes(id)), 'competitor posture: rules about the firm\'s own profile and conduct are not applied to their copy');
W.observe(a.key, { kind: 'ad', platform: 'google', status: 'active', first: '2026-09-25', text: 'Houston divorce lawyer. Flat fee options.' });
W.observe(a.key, { kind: 'offer', platform: 'site', first: '2026-09-10', offer: { type: 'flat', text: 'Agreed divorce $2,500 flat', price: 2500 }, line: 'div_nk' });
W.observe(a.key, { kind: 'review', platform: 'gbp', first: '2026-06-01', reviews: { count: 100, rating: 4.6 } });
W.observe(a.key, { kind: 'review', platform: 'gbp', first: '2026-09-29', reviews: { count: 160, rating: 4.7 } });
W.observe(a.key, { kind: 'rank', platform: 'organic', first: '2026-09-30', rank: { query: 'divorce lawyer houston', position: 2, where: 'maps', county: 'Harris' } });
W.observe(b.key, { kind: 'ad', platform: 'meta', status: 'inactive', first: '2025-01-01', last: '2025-02-01', text: 'Old ad' });
W.observe(W.FIRM_KEY, { kind: 'review', platform: 'gbp', first: '2026-07-01', reviews: { count: 40, rating: 4.8 } });
W.observe(W.FIRM_KEY, { kind: 'review', platform: 'gbp', first: '2026-09-30', reviews: { count: 52, rating: 4.8 } });
eq(W.forComp(a.key).length, 6, 'six observations for Alpha'); eq(W.activeAds().length, 2, 'two live competitor ads');

/* ---------- scores ---------- */
const sa = W.scoreDetail(a.key), sb = W.scoreDetail(b.key);
assert(sa.score > sb.score && sa.score > 20 && sa.score <= 100, `activity score ranks the active competitor higher (${sa.score} vs ${sb.score})`);
eq(sb.score, 0, 'an ad over a year old adds nothing'); eq(sa.platforms.sort(), ['google', 'meta'], 'platforms with ads in 120 days');
const old = W.observe(b.key, { kind: 'ad', platform: 'meta', status: 'inactive', first: '2026-09-01', last: '2026-09-01', text: 'Recent ad' }); const s1 = W.score(b.key);
W.obsUpdate(old.id, { first: '2026-06-01', last: '2026-06-01' }); const s2 = W.score(b.key); assert(s1 > s2 && s2 > 0, `recency weighting (${s1} then ${s2})`); W.obsRemove(old.id);
const rv = W.reviews(a.key); eq(rv.latest.count, 160, 'latest snapshot'); assert(Math.abs(rv.velocity - 60 / 120 * 30) < 0.01, 'review velocity per 30 days: ' + rv.velocity);
const rf = W.reviews(W.FIRM_KEY); assert(Math.abs(rf.velocity - 12 / 91 * 30) < 0.01, 'firm velocity from its own snapshots');
const cov = W.coverage(W.get(a.key)); assert(Math.abs(cov.share - 1) < 1e-9 && cov.covered.length === 3, 'Alpha covers all three firm counties after the merge');
const covB = W.coverage(W.get(b.key)); assert(Math.abs(covB.share - 1 / 3) < 1e-9, 'Bravo covers one of three'); assert(covB.filingShare > 0 && covB.filingShare < 1, 'filing weighted coverage');
eq(W.lineOverlap(W.get(b.key)).both, ['mod'], 'line overlap with the firm');
const cmp = W.compare([a.key, b.key]); eq(cmp.cols.map(c => c.key), [W.FIRM_KEY, a.key, b.key], 'compare puts the firm first'); assert(cmp.rows.length >= 15 && cmp.rows.every(r => r.values.length === 3), 'compare rows');
assert(cmp.rows.find(r => r.label === 'Free consultation').values.join('|') === 'no|yes|not on record', 'free consultation side by side (from the ad copy)');
assert(cmp.rows.every(r => r.values.every(v => !/[–—]/.test(String(v)))), 'compare values carry no dashes');
const cl = W.claims(); assert(cl.length >= 2 && cl[0].sev === 'block' && cl[0].position && cl[0].comps.includes('Alpha Family Law, PLLC'), 'claims summary with positioning, blocks first');
assert(cl.every(c => !/grievance|complaint/i.test(c.position)), 'positioning never suggests a grievance');

/* ---------- context from Severance data ---------- */
const ctxR = W.context(); eq(ctxR.counties, ['48201', '48157', '48339'], 'context uses the firm counties'); assert(ctxR.offices === ['48201', '48157', '48339'].reduce((s, f) => s + (CI[f].rates.lawoffices || 0), 0), 'law offices summed from CBP');
assert(ctxR.tracked === 2 && Math.abs(ctxR.fpo - ctxR.filings / ctxR.offices) < 1e-9, 'tracked competitors and filings per office');
eq(ctxR.rows.find(r => r.fips === '48201').named, 2, 'observations naming Harris (the live ad and the ranking check)');
assert(W.uncontested().every(c => c.fips !== '48201'), 'a county named by a live ad is not uncontested');
const act = W.activity(); assert(act['48201'] && act['48201']._all === 2 && act['48157']._all === 1 && act['48339']._all === 1, 'activity: live ads placed in the counties they name (Harris), else the counties the competitor serves (all three)');
const st = W.stats(); assert(st.live === 2 && st.byPlat.meta === 1 && st.byPlat.google === 1 && st.prices.some(p => p.price === 2500), 'stats');
assert(W.weekly(26).reduce((s, w) => s + w.meta + w.google + w.other, 0) === 2, 'weekly counts the two ads first seen in the last 26 weeks');
const dg = W.digest(); assert(dg.length >= 4 && dg.every(s => !/[–—]/.test(s)), 'digest sentences, no dashes');

/* ---------- link builders ---------- */
const L = W.LINKS;
eq(L.metaKw('Alpha Family Law'), 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=Alpha%20Family%20Law&search_type=keyword_unordered&media_type=all', 'Meta keyword search');
eq(L.metaPage('123'), 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&view_all_page_id=123&search_type=page&media_type=all', 'Meta page');
eq(L.googleDomain('https://www.alphafamilylaw.example/x'), 'https://adstransparency.google.com/?region=US&domain=alphafamilylaw.example', 'Transparency by domain');
eq(L.googleAdv('AR123'), 'https://adstransparency.google.com/advertiser/AR123?region=US', 'Transparency advertiser');
assert(L.barForm().startsWith('https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer'), 'State Bar form'); eq(L.barSearch('Ann Alpha'), 'https://www.google.com/search?q=site%3Atexasbar.com%20%22Ann%20Alpha%22', 'State Bar site search');
eq(L.tblsForm(), 'https://www.tbls.org/findlawyer', 'TBLS search'); eq(L.gMaps('Alpha', 'Houston TX'), 'https://www.google.com/maps/search/?api=1&query=Alpha%20Houston%20TX', 'Maps');
eq(L.gCounty('Harris'), 'https://www.google.com/search?q=family%20law%20attorney%20Harris%20County%20TX', 'county search'); eq(L.gReviews('Alpha'), 'https://www.google.com/search?q=Alpha%20reviews', 'reviews search');
eq(L.sitemap('alphafamilylaw.example'), 'https://www.alphafamilylaw.example/sitemap.xml', 'sitemap'); eq(L.site('alphafamilylaw.example'), 'https://www.alphafamilylaw.example', 'site');
const links = W.compLinks(W.get(a.key)); assert(links.some(l => /view_all_page_id=123456789/.test(l.url)) && links.some(l => /Ann%20Alpha/.test(l.url)) && links.some(l => /Fort%20Bend%20County/.test(l.url)) && links.some(l => /sitemap\.xml/.test(l.url)), 'competitor link set');
const api = new URL(W.metaApiUrl({ token: 'tok', terms: 'divorce lawyer Houston', status: 'ALL', since: '2026-01-01' }));
assert(api.origin === 'https://graph.facebook.com' && api.pathname.endsWith('/ads_archive') && api.searchParams.get('search_terms') === 'divorce lawyer Houston' && api.searchParams.get('ad_reached_countries') === '["US"]' && api.searchParams.get('ad_delivery_date_min') === '2026-01-01', 'Meta Ad Library API request');

/* ---------- paste parsing ---------- */
const metaCopy = `Active\nLibrary ID: 987654321012345\nStarted running on Sep 3, 2026\nPlatforms\nSee ad details\nAlpha Family Law, PLLC\nSponsored\nGoing through a divorce with kids? Free consultation this week. Flat fee from $2,500.\nALPHAFAMILYLAW.EXAMPLE\nDivorce help in Houston\nLearn more`;
const d1 = W.parseAdText(metaCopy);
eq([d1.platform, d1.status, d1.first, d1.ids.lib, d1.comp, d1.cta, d1.line], ['meta', 'active', '2026-09-03', '987654321012345', a.key, 'Learn more', 'div_k'], 'Meta ad text parsed');
assert(d1.offer.type === 'consult_free' && d1.offer.price === 2500 && /Going through a divorce/.test(d1.text) && !/Library ID|Sponsored/.test(d1.text), 'offer and copy');
const googleCopy = `Sponsored\nBravo Divorce Group PC\nhttps://www.bravodivorce.example › modification\nModify Child Support After Job Loss\nCall today. Payment plans available.`;
const d2 = W.parseAdText(googleCopy); eq([d2.platform, d2.compName, d2.line, d2.offer.type, d2.format], ['google', 'Bravo Divorce Group PC', 'mod', 'payplan', 'text'], 'Google ad text parsed');
const r1 = W.importText(metaCopy, ''); assert(r1.draft && r1.draft.ids.lib === '987654321012345' && /library ID/.test(r1.note), 'importText routes ad text to a draft');
const r2 = W.importText('https://www.facebook.com/ads/library/?id=5555555555 https://adstransparency.google.com/advertiser/AR999/creative/CR111?region=US https://www.facebook.com/ads/library/?view_all_page_id=4444', b.key);
assert(r2.obs.length === 2 && r2.meta.pageId === '4444' && r2.obs[1].ids.cr === 'CR111', 'library links parsed');
const api2 = W.importText(JSON.stringify({ data: [{ id: '777', page_id: '123456789', page_name: 'Alpha Family Law', ad_delivery_start_time: '2026-08-01', ad_creative_bodies: ['Free consultation for Harris County parents'], ad_creative_link_captions: ['alphafamilylaw.example'], publisher_platforms: ['facebook', 'instagram'] }, { id: '778', page_name: 'Unknown Page', ad_creative_bodies: ['x'] }] }));
assert(api2.obs.length === 2 && api2.obs[0].comp === a.key && api2.obs[0].offer.type === 'consult_free' && api2.obs[1].comp === '', 'Meta API JSON matched by page id and domain');
const nObs = W.obs.length; W.obsAddMany(api2.obs); eq(W.obs.length, nObs + 2, 'imported entries added'); assert(W.obs.some(o => o.compName === 'Unknown Page' && !o.comp), 'unmatched page kept');

/* ---------- roster bulk paste and CSV ---------- */
const rp = W.parseRosterText('Charlie Law | charlielaw.example | Harris County | divorce; custody | 700 Main St, Houston, TX 77002\nDelta Legal Aid | legal aid | Fort Bend\n# comment line\n| nothing.example |');
eq(rp.skipped, ['| nothing.example |'], 'a line with no name is reported, not added');
eq(rp.comps.map(c => [c.name, c.domain, c.tier, c.counties.join(' ')]), [['Charlie Law', 'charlielaw.example', 'direct', '48201'], ['Delta Legal Aid', '', 'legalaid', '48157']], 'bulk lines parsed by shape');
eq(rp.comps[0].lines, ['div_k', 'div_nk', 'sapcr'], 'bulk lines'); eq(rp.comps[0].offices[0].zip, '77002', 'bulk office');
const added = W.addMany(rp.comps); eq([added.added.length, added.merged.length], [2, 0], 'addMany');
const rosterCsv = W.rosterCSV(); assert(rosterCsv.startsWith('# Competitor Watch roster') && rosterCsv.includes('Charlie Law'), 'roster CSV');
const rp2 = W.parseRosterText(rosterCsv); eq(rp2.comps.length, W.state.comps.length, 'roster CSV parses back'); const ch = rp2.comps.find(c => c.name === 'Charlie Law'); eq([ch.domain, ch.counties, ch.lines, ch.offices[0].zip, ch.offices[0].street], ['charlielaw.example', ['48201'], ['div_k', 'div_nk', 'sapcr'], '77002', '700 Main St'], 'roster CSV round trip keeps the fields');
const al = rp2.comps.find(c => c.name === 'Alpha Family Law, PLLC'); eq(al.lawyers, W.get(a.key).lawyers, 'lawyers round trip');
const tpl = W.parseRosterText(W.rosterTemplate()); eq(tpl.comps.length, 0, 'template has a header and no rows');

/* ---------- ledger CSV and JSON round trips ---------- */
const ledger = W.csv(); const before = JSON.parse(JSON.stringify(W.obs));
const back = W.importText(ledger); eq(back.obs.length, before.length, 'ledger CSV parses every row');
const byId = Object.fromEntries(before.map(o => [o.id, o]));
const rowA = back.obs.find(o => o.text && /#1 divorce/.test(o.text)); assert(rowA && rowA.comp === a.key && rowA.ids.lib === '1111111111' && rowA.counties.join() === '48201', 'ledger CSV keeps competitor, ids and counties');
const revRow = back.obs.find(o => o.reviews && o.reviews.count === 160); assert(revRow && revRow.reviews.rating === '4.7' || (revRow && +revRow.reviews.rating === 4.7), 'review snapshot survives CSV');
const rankRow = back.obs.find(o => o.rank); assert(rankRow && rankRow.rank.query === 'divorce lawyer houston' && +rankRow.rank.position === 2 && rankRow.rank.where === 'maps', 'rank check survives CSV');
assert(back.obs.some(o => o.comp === W.FIRM_KEY), 'firm snapshots keep the firm key');
const js = W.json(); const parsed = JSON.parse(js); assert(parsed.severance_watch === 1 && parsed.comps.length === W.state.comps.length && parsed.obs.length === W.obs.length && parsed.settings.token === '', 'JSON backup, token stripped');
W.setSettings({ token: 'secret', keepToken: false }); assert(!mem.get('sv.sev.watch').includes('secret'), 'token not stored unless kept'); assert(JSON.parse(W.json()).settings.token === '', 'token never exported');
const snap = { comps: W.state.comps.length, obs: W.obs.length, score: W.score(a.key) };
const cleared = W.clear(); eq([cleared.comps, cleared.obs], [snap.comps, snap.obs], 'clear reports what it removed'); eq([W.list().length, W.obs.length], [0, 0], 'cleared');
const imp = W.importText(js); assert(imp.backup, 'backup recognized'); W.importBackup(imp.backup, 'replace');
eq([W.state.comps.length, W.obs.length, W.score(a.key)], [snap.comps, snap.obs, snap.score], 'JSON round trip restores roster, ledger and scores');
const m2 = W.importBackup(JSON.parse(js), 'merge'); eq([m2.comps, m2.obs], [0, 0], 'merging the same backup adds nothing');
const fromLedger = W.importText(ledger); W.clear(); W.importBackup({ comps: parsed.comps, obs: [] }, 'replace'); W.obsAddMany(fromLedger.obs);
eq(W.obs.length, snap.obs, 'ledger CSV restores every observation onto a restored roster'); eq(W.score(a.key), snap.score, 'scores identical after the CSV round trip');
const stored = JSON.parse(mem.get('sv.sev.watch')); assert(Array.isArray(stored.comps) && stored.comps.length === snap.comps, 'persisted under sv.sev.watch');
W.reload(); eq(W.state.comps.length, snap.comps, 'reload from storage keeps the roster');
W.remove(b.key); assert(!W.get(b.key) && !W.obs.some(o => o.comp === b.key), 'remove deletes the competitor and its observations');
const sw = W.sweepCSV(); assert(sw.split('\n').filter(l => l && !l.startsWith('#')).length === W.list().length + 1, 'sweep checklist rows');
const cc = W.compareCSV([a.key]); assert(/^# Competitor comparison/.test(cc) && cc.includes('Test Firm'), 'compare CSV');

/* ---------- safety: links, duplicates, the CSV formula guard ---------- */
eq(W.safeUrl('javascript:alert(1)'), '', 'javascript: is never a link'); eq(W.safeUrl('data:text/html,<b>x</b>'), '', 'data: is never a link'); eq(W.safeUrl('file:///etc/passwd'), '', 'file: is never a link');
eq(W.safeUrl('example.com/divorce'), 'https://example.com/divorce', 'a bare domain becomes https'); eq(W.safeUrl('http://example.com'), 'http://example.com/', 'http kept'); eq(W.safeUrl('  '), '', 'blank'); eq(W.safeUrl('not a url'), '', 'text is not a link');
const evil = W.observe(a.key, { kind: 'ad', platform: 'meta', text: 'Free consultation', snapshot: 'javascript:alert(1)', url: 'javascript:alert(2)' }); eq(evil.snapshot, '', 'an unsafe snapshot is dropped when the observation is stored'); W.obsRemove(evil.id);
const n0 = W.obs.length;
const batch = [{ comp: a.key, kind: 'ad', platform: 'meta', ids: { lib: '9090909090' }, first: '2026-09-01', last: '2026-09-10', status: 'active', text: 'Alpha ad' }, { comp: a.key, kind: 'ad', platform: 'meta', ids: { lib: '9090909090' }, first: '2026-09-01', last: '2026-09-20', status: 'active', text: 'Alpha ad, a later capture' }, { comp: a.key, kind: 'ad', platform: 'google', ids: { adv: 'AR77', cr: 'CR88' }, first: '2026-09-02', text: 'Bravo ad' }, { comp: a.key, kind: 'ad', platform: 'google', ids: { adv: 'ar77', cr: 'cr88' }, first: '2026-09-02', text: 'same creative, ids in lower case' }, { comp: a.key, kind: 'offer', platform: 'site', first: '2026-09-03', text: 'Flat fee divorce $1,999' }, { comp: a.key, kind: 'offer', platform: 'site', first: '2026-09-03', text: 'Flat  fee divorce $1,999' }];
const added1 = W.obsAddMany(batch); eq([added1.length, added1.skipped, added1.extended], [3, 3, 1], 'duplicates inside a batch: library id, advertiser plus creative, text hash plus first seen');
eq(W.obs.find(o => o.ids.lib === '9090909090').last, '2026-09-20', 'a duplicate moves the last seen date forward');
const added2 = W.obsAddMany(batch); eq([added2.length, added2.skipped], [0, 6], 'importing the same batch again adds nothing'); eq(W.obs.length, n0 + 3, 'ledger grew by three');
eq(W.obsKey({ comp: 'x', platform: 'meta', kind: 'rank', rank: { query: 'divorce lawyer', where: 'maps' }, first: '2026-09-01' }) !== W.obsKey({ comp: 'x', platform: 'meta', kind: 'rank', rank: { query: 'custody lawyer', where: 'maps' }, first: '2026-09-01' }), true, 'two rank checks on one day are two observations');
const bk = JSON.parse(W.json()); bk.obs.forEach(o => { o.id = o.id + '-copy'; }); const mg = W.importBackup(bk, 'merge'); eq([mg.obs, mg.skipped], [0, bk.obs.length], 'merging a backup with new ids still skips every duplicate');
const formula = W.observe(a.key, { kind: 'note', platform: 'other', text: '=HYPERLINK("http://evil.example","click")', notes: '+1 214 555 0100', first: '2026-09-05' });
const gcsv = W.csv(); assert(gcsv.includes(`"'=HYPERLINK(""http://evil.example"",""click"")"`) && gcsv.includes("'+1 214 555 0100"), 'ledger CSV: formula cells start with an apostrophe');
assert(!/(^|,)=HYPERLINK/m.test(gcsv), 'no cell starts with = in the ledger CSV');
const back2 = W.importText(gcsv); const fr = back2.obs.find(o => /HYPERLINK/.test(o.text)); assert(fr && fr.text === '=HYPERLINK("http://evil.example","click")' && fr.notes === '+1 214 555 0100', 'the importer takes the apostrophe off again');
W.obsRemove(formula.id);
W.update(a.key, { notes: '@mention and -minus' }); const rcsv = W.rosterCSV(); assert(rcsv.includes("'@mention and -minus"), 'roster CSV guarded'); eq(W.parseRosterText(rcsv).comps.find(c => c.key === a.key || c.name === W.get(a.key).name).notes, '@mention and -minus', 'roster CSV round trip unguards');
const swc = W.sweepCSV(); assert(/^competitor,competitor_key,domain/m.test(swc) && swc.includes(',' + a.key + ','), 'sweep rows carry the competitor key');
const adv = W.advertisersIn({ county: '48201' }); assert(adv.length && adv[0].key === a.key && adv[0].live >= 1 && adv[0].platforms.includes('meta'), 'advertisers observed in Harris County: ' + JSON.stringify(adv[0]));
eq(W.advertisersIn({ county: '99999' }), [], 'an unknown county has no advertisers'); assert(W.tracked({ county: '48201' }).some(c => c.key === a.key), 'tracked firms serving Harris County');
eq(W.csvGuard(-5), -5, 'numbers are left alone'); eq(W.csvGuard('-5'), "'-5", 'a text cell starting with a minus is guarded'); eq(W.unguard("'=1+1"), '=1+1', 'unguard');
console.log('watch ok');
