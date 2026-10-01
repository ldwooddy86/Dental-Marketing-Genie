/* Live Desk: LIVE (src/09_live_core.js) and the extension's background watch (background.js).
   The core runs in a vm context with the real suite data, core, kit and firm profile and a stubbed DOM; the background runs in a second
   vm context with a fake chrome API and fixture fetch responses, through two alarm cycles, a manual refresh and an options change. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assert, eq } from './lib/mock.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------------- the core in a page-like context ---------------- */
function pageContext() {
  const node = () => ({ style: {}, dataset: {}, classList: { add() { }, remove() { }, toggle() { } }, setAttribute() { }, appendChild() { }, addEventListener() { }, querySelector: () => null, querySelectorAll: () => [] });
  const ls = new Map();
  const ctx = { console, URL, URLSearchParams, TextEncoder, TextDecoder, setTimeout, clearTimeout, Intl, Blob, AbortSignal,
    document: { createElement: node, body: node(), documentElement: node(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() { }, removeEventListener() { }, activeElement: null },
    addEventListener() { }, removeEventListener() { }, dispatchEvent() { return true; }, matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { }, addListener() { } }), performance: globalThis.performance, ResizeObserver: class { observe() { } unobserve() { } disconnect() { } }, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout, innerWidth: 1400, innerHeight: 900, scrollX: 0, scrollY: 0, getComputedStyle: () => ({ getPropertyValue: () => '' }), 
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    navigator: { userAgent: 'node' }, location: { hash: '' }, history: { replaceState() { } } };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['data/suite.js', 'src/00_core.js', 'src/01_kit.js', 'src/02_firm.js', 'src/09_live_core.js']) vm.runInContext(read(f), ctx, { filename: f });
  try { vm.runInContext(read('src/25_m06_lines.js'), ctx, { filename: 'src/25_m06_lines.js' }); } catch (e) { console.log('note: LINE_META not loaded (' + e.message + '); LIVE uses its own line names'); }
  return { ctx, run: code => vm.runInContext(code, ctx) };
}
const P = pageContext(); const LIVE = P.run('LIVE'); const CI = P.run('CI'); const ST = P.run('ST');
const TODAY = '2026-10-01';
LIVE.setToday(TODAY);
LIVE.setSettings({ counties: ['48201', '48027'] });   // Harris, Bell
eq(LIVE.scope(), ['48201', '48027'], 'scope from settings');

/* ---------------- WARN parsing: variant field names ---------------- */
const socrata = [
  { notice_date: '2026-09-28T00:00:00.000', job_site_name: 'Acme Logistics, LLC', county_name: 'HARRIS', city_name: 'Houston', total_layoff_number: '600', layoff_date: '2026-11-30T00:00:00.000', wda_name: 'Gulf Coast', reason: 'Closing' },
  { notice_date: '2026-06-10T00:00:00.000', job_site_name: 'Killeen Plant', county_name: 'Bell', city_name: 'Killeen', total_layoff_number: '80', layoff_date: '2026-08-10T00:00:00.000' },
  { notice_date: '2026-09-20T00:00:00.000', job_site_name: 'Dallas Office', county_name: 'DALLAS', city_name: 'Dallas', total_layoff_number: '150' },
  { notice_date: '2026-09-01T00:00:00.000', job_site_name: 'Cuero Mill', county_name: 'DE WITT', total_layoff_number: '1,250' }
];
let p = LIVE.parseWarn(socrata);
eq(p.mapped.date, 'notice_date', 'socrata date'); eq(p.mapped.company, 'job_site_name', 'socrata company'); eq(p.mapped.county, 'county_name', 'socrata county'); eq(p.mapped.workers, 'total_layoff_number', 'socrata workers'); eq(p.mapped.wda, 'wda_name', 'socrata wda');
eq(p.unknown, ['reason'], 'unknown columns kept'); eq(p.missing, [], 'nothing missing');
eq(p.rows[0].date, '2026-09-28', 'date normalized'); eq(p.rows[0].fips, '48201', 'county to fips'); eq(p.rows[0].county, 'Harris', 'county display name'); eq(p.rows[0].workers, 600, 'workers number');
eq(p.rows[0].layoff, '2026-11-30', 'layoff date');
const dw = p.rows.find(r => r.company === 'Cuero Mill'); eq(dw.fips, CI['48123'].fips, 'DE WITT maps to DeWitt'); eq(dw.workers, 1250, 'thousands separator');
const variant = [{ 'Notice Date': '09/28/2026', 'Company Name': 'Acme Logistics, LLC', 'County': 'Harris County', 'Number of Workers': '600', 'Layoff Start Date': '11/30/2026', 'Region': 'Gulf' }];
const pv = LIVE.parseWarn(variant);
eq([pv.mapped.date, pv.mapped.company, pv.mapped.county, pv.mapped.workers, pv.mapped.layoff], ['Notice Date', 'Company Name', 'County', 'Number of Workers', 'Layoff Start Date'], 'variant names mapped');
eq(pv.rows[0].id, p.rows[0].id, 'same notice, same key across field spellings'); eq(pv.unknown, ['Region'], 'variant unknown column');
const fuzzy = LIVE.parseWarn([{ received_notice_date: '2026-09-28', employer_title: 'Acme Logistics, LLC', county_of_site: 'harris', layoffs_total_count: 600 }]);
eq([fuzzy.mapped.date, fuzzy.mapped.county, fuzzy.mapped.workers], ['received_notice_date', 'county_of_site', 'layoffs_total_count'], 'fuzzy mapping'); eq(fuzzy.rows[0].fips, '48201', 'fuzzy county');
const viewsJson = { meta: { view: { columns: [{ fieldName: 'notice_date' }, { fieldName: 'job_site_name' }, { fieldName: 'county_name' }, { fieldName: 'total_layoff_number' }] } }, data: [['2026-09-28T00:00:00', 'Acme Logistics, LLC', 'Harris', '600']] };
eq(LIVE.parseWarn(viewsJson).rows[0].id, p.rows[0].id, 'rows.json meta and data format');
const csvText = 'NOTICE_DATE,JOB_SITE_NAME,COUNTY_NAME,TOTAL_LAYOFF_NUMBER\r\n2026-09-28,"Acme Logistics, LLC",Harris,600\r\n2026-09-02,"He said ""closing""",Bell,40\r\n';
const pc = LIVE.parseWarn(csvText); eq(pc.rows.length, 2, 'csv rows'); eq(pc.rows[0].id, p.rows[0].id, 'csv key'); eq(pc.rows[1].company, 'He said "closing"', 'csv doubled quotes');
eq(LIVE.parseWarn([{ foo: 1, bar: 'x' }]).missing, ['date', 'county', 'workers'], 'missing reported');
let threw = null; try { LIVE.parseWarn({ error: true, message: 'query.soql.no-such-column' }); } catch (e) { threw = e; } assert(threw && /no-such-column/.test(threw.message), 'socrata error surfaces');
eq(LIVE.normDate('6/9/26'), '2026-06-09', 'short US date'); eq(LIVE.normDate('20260609'), '2026-06-09', 'compact date'); eq(LIVE.normDate(''), null, 'empty date');
assert(/\$where=upper\(county_name\)%20in%20\('HARRIS'%2C'BELL'\)/.test(LIVE.warnURL(['Harris', 'Bell'])) || /upper%28county_name%29/.test(LIVE.warnURL(['Harris', 'Bell'])), 'SoQL where clause on county names: ' + LIVE.warnURL(['Harris', 'Bell']));
assert(LIVE.warnURL(["O'Brien"]).includes(encodeURIComponent("'O''BRIEN'")), 'quotes doubled in SoQL');

/* ---------------- FRED CSV: both headers ---------------- */
const fredOld = 'DATE,TXICLAIMS\n2026-08-22,14000\n2026-08-29,.\n2026-09-05,15000\n';
const fredNew = 'observation_date,TXICLAIMS\r\n2026-08-22,14000\r\n2026-09-05,15000\r\n';
const f1 = LIVE.parseFred(fredOld), f2 = LIVE.parseFred(fredNew);
eq(f1.id, 'TXICLAIMS', 'series id'); eq(f1.points.length, 2, 'dot is missing'); eq(f1.points, f2.points, 'DATE and observation_date read the same');
threw = null; try { LIVE.parseFred('<html><body>Error</body></html>'); } catch (e) { threw = e; } assert(threw, 'html page rejected');
threw = null; try { LIVE.parseFred('when,value\n2026-01-01,3\n'); } catch (e) { threw = e; } assert(threw && /DATE or observation_date/.test(threw.message), 'missing date column explained');

/* weekly claims fixture: 60 weeks at 14,000 then a 40% jump */
const weeks = []; for (let i = 0; i < 60; i++) weeks.push([LIVE.addD('2025-07-26', 7 * i), 14000]);
const lastWeek = LIVE.addD('2025-07-26', 7 * 60); weeks.push([lastWeek, 19600]);
const fredJump = 'observation_date,TXICLAIMS\n' + weeks.map(w => w.join(',')).join('\n') + '\n';
const ck = LIVE.claimsCheck(LIVE.parseFred(fredJump).points, LIVE.settings());
assert(Math.abs(ck.wowPct - 40) < 1e-9, 'week over week 40%'); assert(ck.flags.wow, 'wow flag'); assert(ck.yoyPct > 9 && ck.yoyPct < 11, 'four weeks vs a year earlier ~10%: ' + ck.yoyPct); assert(!ck.flags.yoy, 'yoy flag off at 15%');

/* ---------------- the snapshot ---------------- */
const snap = LIVE.snapshot();
assert(snap.notices.length > 50 && snap.notices.every(n => n.fips && n.date), 'snapshot notices'); eq(snap.claims.length, ST.claims.weekly.filter(v => v != null).length, 'snapshot claims');
eq(snap.counties.map(c => c.name), ['Harris', 'Bell'], 'snapshot counties in scope');

/* ---------------- live data through refresh with a fixture fetch ---------------- */
const calls = [];
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'string' ? JSON.parse(body) : body), text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
let mode = 'ok';
const fake = async url => { calls.push(url); if (url.startsWith(LIVE.SOCRATA)) { if (mode === 'down') throw new TypeError('Failed to fetch'); if (mode === '400' && url.includes('$where')) return resp(400, { message: 'No such column: county_name' }); return resp(200, socrata); } if (url.includes('TXICLAIMS')) return resp(200, fredJump); if (url.includes('TXCCLAIMS')) return resp(200, 'DATE,TXCCLAIMS\n2026-09-05,120000\n'); return resp(404, 'nope'); };
await LIVE.refresh({ force: true, fetch: fake });
let s = LIVE.state.sources;
eq([s.warn.mode, s.icl.mode, s.ccl.mode], ['live', 'live', 'live'], 'all three live'); eq(s.warn.n, 2, 'scope filter keeps Harris and Bell rows (Dallas, DeWitt out)');
assert(calls[0].includes('$where') && calls[0].includes('HARRIS') && calls[0].includes('BELL'), 'county query sent');
mode = '400'; calls.length = 0; await LIVE.refresh({ force: true, fetch: fake }); s = LIVE.state.sources;
assert(s.warn.mode === 'live' && s.warn.fallback && calls.some(u => /\$limit=2000$/.test(u)), '400 falls back to the plain endpoint'); eq(s.warn.n, 2, 'fallback filtered here');
mode = 'down'; await LIVE.refresh({ force: true, fetch: fake }); s = LIVE.state.sources;
eq(s.warn.mode, 'cached', 'network failure keeps the last good answer'); assert(/data\.texas\.gov could not be reached/.test(s.warn.error), 'failure explained: ' + s.warn.error);
mode = 'ok'; await LIVE.refresh({ force: true, fetch: fake });

/* ---------------- triggers from the fixtures ---------------- */
const trs = LIVE.triggers();
const acme = trs.find(t => t.kind === 'warn' && /Acme/.test(t.title));
assert(acme, 'live WARN notice becomes a trigger'); eq([acme.start, acme.end, acme.status, acme.fips], ['2026-12-27', '2027-09-28', 'upcoming', '48201'], 'window day 90 to day 365');
eq(acme.effects[0].lines, ['mod', 'enf'], 'modification and enforcement'); assert(/Protective orders unaffected/.test(acme.action), 'protective orders unaffected');
const killeen = trs.find(t => t.kind === 'warn' && /Killeen/.test(t.title)); eq([killeen.status, killeen.start], ['active', '2026-09-08'], 'Bell notice active');
const cl = trs.find(t => t.kind === 'claims' && t.level === 'state'); assert(cl && cl.live && cl.date === lastWeek, 'FRED jump becomes a statewide claims trigger');
assert(trs.some(t => t.kind === 'calendar' && /Thanksgiving/.test(t.title)), 'Thanksgiving window is upcoming within 45 days');
assert(!trs.some(t => t.kind === 'calendar' && /Military moving/.test(t.title)), 'moving season not due in October');
const dallas = LIVE.triggers({ counties: ['48113'] }); assert(dallas.some(t => t.kind === 'warn' && t.fips === '48113') && !dallas.some(t => t.fips === '48201'), 'explicit county list (Dallas, from the snapshot)');
const noSmall = (() => { const o = LIVE.settings().warnMin; LIVE.setSettings({ warnMin: 100 }); const r = LIVE.triggers().some(t => /Killeen/.test(t.title)); LIVE.setSettings({ warnMin: o }); return !r; })(); assert(noSmall, 'notices under the minimum are ignored');
eq(LIVE.warnStep(0.5), 5, 'step above 0'); eq(LIVE.warnStep(1), 10, 'step at 1 per 1,000'); eq(LIVE.warnStep(3.2), 20, 'step at 3'); eq(LIVE.warnStep(12), 30, 'step at 10');

/* ---------------- timing multipliers ---------------- */
const tModH = LIVE.timing('mod', '2027-01-15', '48201');
const warnPart = tModH.parts.find(x => x.kind === 'warn'); assert(warnPart && warnPart.f > 1 && warnPart.level === 'county', 'WARN lifts modification in Harris in January');
const claimsPart = tModH.parts.find(x => x.kind === 'claims'); assert(claimsPart && Math.abs(claimsPart.f - 1.1) < 1e-9, 'statewide claims lift +10% from day 90');
assert(Math.abs(tModH.mult - tModH.campaign * tModH.county) < 1e-9, 'combined is campaign times county');
const tPo = LIVE.timing('po', '2027-01-15', '48201'); assert(!tPo.parts.some(x => ['warn', 'claims', 'unemp'].includes(x.kind)), 'protective orders never moved by an economic trigger');
const tDiv = LIVE.timing('div_k', LIVE.addD(lastWeek, 10)); const dip = tDiv.parts.find(x => x.kind === 'claims'); assert(dip && Math.abs(dip.f - 0.9) < 1e-9, 'divorce dips the month claims surge');
const tReb = LIVE.timing('div_nk', LIVE.addD(lastWeek, 350)); assert(tReb.parts.some(x => x.kind === 'claims' && Math.abs(x.f - 1.1) < 1e-9), 'divorce rebound at twelve months');
const tCamp = LIVE.timing('mod', '2027-01-15'); assert(!tCamp.parts.some(x => x.level === 'county'), 'campaign level has no county factors');
for (const t of [tModH, tPo, tDiv, tReb, tCamp]) { assert(t.adj % 5 === 0 && t.adj >= -50 && t.adj <= 90, 'adj rounded and held: ' + t.adj); eq(t.adj, Math.max(-50, Math.min(90, Math.round((t.mult - 1) * 100 / 5) * 5)), 'adj formula'); }
const sf = LIVE.seasonFactor('div_k', '2027-02-14'); const S = ST.seas.div_k; assert(sf.m === 2 && sf.idx >= Math.min(S[1], S[2]) && sf.idx <= Math.max(S[2], S[3]), 'season read a month ahead and interpolated: ' + JSON.stringify(sf));
eq(LIVE.seasonFactor('po', '2027-02-14').m, 1, 'protective orders read the same month'); eq(LIVE.seasonFactor('adopt', '2027-02-14'), null, 'no season for adoption');
const thx = LIVE.timing('enf', '2026-11-20'); assert(thx.parts.some(x => x.kind === 'calendar' && /Thanksgiving/.test(x.label) && Math.abs(x.f - 1.1) < 1e-9), 'Thanksgiving lifts enforcement 10%');
const xmas = LIVE.timing('enf', '2026-12-20'); assert(xmas.parts.some(x => /Christmas/.test(x.label)), 'calendar windows beyond 45 days still apply by date');
const april = LIVE.timing('sapcr', '2027-03-15'); assert(april.parts.some(x => /April 1/.test(x.label) && Math.abs(x.f - 1.1) < 1e-9), 'April 1 window lifts custody in March');
const pcsBell = LIVE.timing('mil', '2027-06-15', '48027'), pcsCamp = LIVE.timing('mil', '2027-06-15'), pcsHarris = LIVE.timing('mil', '2027-06-15', '48201');
assert(pcsBell.parts.some(x => /Military moving/.test(x.label) && Math.abs(x.f - 1.2) < 1e-9), 'moving season lifts military divorce in Bell'); assert(!pcsCamp.parts.some(x => /Military moving/.test(x.label)) && !pcsHarris.parts.some(x => /Military moving/.test(x.label)), 'not at campaign level or in Harris');
const big = LIVE.timing('mod', '2027-01-15', '48201', {}); assert(big.reasons.length === big.parts.filter(x => Math.abs(x.f - 1) >= 0.005).length, 'reasons listed');
const ser = LIVE.series('enf', '48201', TODAY, 90); eq(ser.length, 90, '90 days'); eq(ser[89].date, LIVE.addD(TODAY, 89), 'last day');
const win = LIVE.windows('div_k', null, TODAY, 90); assert(win.every(w => (w.kind === 'up' ? w.avg >= 15 : w.avg <= -15) && w.start <= w.end && w.why.length), 'windows');

/* the account's own pattern (module 23): weekday share of leads and the observed hour blocks */
eq(LIVE.observedDow('mod'), null, 'no ACCT, no observed factor'); eq(LIVE.hourGrid(), null, 'no ACCT, no hour grid');
P.run(`globalThis.ACCT = { _s: { useObserved: false }, settings() { return this._s; }, async setSettings(p) { Object.assign(this._s, p); },
  rowsAll(kind) { if (kind !== 'lead') return [{ kind: 'ads', date: LIVE.addD('${TODAY}', -3), leads: 5, hour: 9 }]; const out = []; for (let i = 1; i <= 84; i++) { const d = LIVE.addD('${TODAY}', -i); const dw = new Date(d + 'T00:00:00Z').getUTCDay(); const n = dw === 1 ? 6 : dw === 0 || dw === 6 ? 0 : 1; for (let j = 0; j < n; j++) out.push({ kind: 'lead', date: d, line: 'mod' }); } return out; },
  observedGrid() { return [0, 1, 2, 3, 4, 5, 6].map(() => [-40, -10, 20, 15, 5, -30]); } };`);
eq(LIVE.observedDow('mod'), null, 'switch off');
await LIVE.setUseObserved(true); const ob = LIVE.observedDow('mod');
assert(ob && ob.scope === 'this line' && ob.n === 12 * 6 + 12 * 4 && ob.f[1] > 1.5 && ob.f[0] < 1 && ob.f[6] < 1, 'Mondays carry the leads: ' + JSON.stringify(ob));
const tObs = LIVE.timing('mod', '2026-10-05'); assert(tObs.parts.some(x => x.kind === 'observed' && x.f > 1.5 && /Mondays/.test(x.label)), 'observed weekday factor in timing');
const edObs = LIVE.editorCSV({ lines: ['mod'] }).trim().split('\n'); const blocks = edObs.filter(l => /\)\[\d\d:00-\d\d:00\]/.test(l));
eq(blocks.length, 42, 'six hour blocks a day for seven days'); assert(blocks.some(l => l.includes('(Monday)[00:00-06:00]')) && blocks.some(l => l.includes('[21:00-24:00]')), 'blocks cover the day');
await LIVE.setUseObserved(false); eq(LIVE.editorCSV({ lines: ['mod'] }).split('\n').filter(l => /\[00:00-24:00\]/.test(l)).length, 7, 'whole days again with the switch off');
P.run('delete globalThis.ACCT'); LIVE.invalidate();

/* ---------------- calendar dates ---------------- */
eq(LIVE.thanksgiving(2026), '2026-11-26', 'Thanksgiving 2026'); eq(LIVE.thanksgiving(2027), '2027-11-25', 'Thanksgiving 2027'); eq(LIVE.thanksgiving(2030), '2030-11-28', 'Thanksgiving 2030');
const y27 = LIVE.calendarYear(2027), y26 = LIVE.calendarYear(2026), y28 = LIVE.calendarYear(2028);
const k = (arr, key) => arr.find(i => i.key === key);
eq([k(y27, 'summer-notice').date, k(y27, 'summer-notice').start, k(y27, 'summer-notice').end], ['2027-04-01', '2027-03-01', '2027-04-01'], 'April 1 notice');
assert(/153\.312\(b\)/.test(k(y27, 'summer-notice').source) && /July 1 to July 31/.test(k(y27, 'summer-notice').action) && /June 15 to July 27/.test(k(y27, 'summer-notice').action) && /30 days within 100 miles, 42 days over 100 miles/.test(k(y27, 'summer-notice').action), 'April 1 facts');
eq(k(y27, 'summer-counter').date, '2027-04-15', 'April 15 counter notice');
assert(/managing conservator in 2026/.test(k(y26, 'thanksgiving').title) && /possessory conservator in 2027/.test(k(y27, 'thanksgiving').title), 'Thanksgiving alternates: managing conservator in even years');
assert(/possessory conservator has the first half in 2026/.test(k(y26, 'christmas').title) && /managing conservator has the first half in 2027/.test(k(y27, 'christmas').title), 'Christmas first half: possessory conservator in even years');
assert(/noon December 28/.test(k(y26, 'christmas').action) && /153\.314/.test(k(y26, 'christmas').source), 'Christmas split and source');
eq([k(y26, 'christmas').start, k(y26, 'christmas').end], ['2026-12-01', '2027-01-03'], 'Christmas window crosses the year');
assert(/Within 100 miles the possessory conservator has spring vacation in 2028/.test(k(y28, 'spring-break').action) && /Within 100 miles the managing conservator has spring vacation in 2027/.test(k(y27, 'spring-break').action), 'spring break: possessory conservator in even years');
eq(k(y27, 'legislature').date, '2027-01-12', 'regular session second Tuesday of January 2027'); eq(k(y27, 'laws-effective').date, '2027-09-01', 'September 1'); assert(!k(y26, 'legislature') && !k(y28, 'legislature'), 'sessions in odd years only');
eq(k(y27, 'pcs-season').counties, ['48027', '48099', '48141', '48029'], 'Bell, Coryell, El Paso, Bexar'); assert(/Fort Hood/.test(k(y27, 'pcs-season').title) && /Fort Bliss/.test(k(y27, 'pcs-season').title), 'bases named');
eq([k(y27, 'tax-refunds').start, k(y27, 'tax-refunds').end], ['2027-02-01', '2027-03-31'], 'tax refund season February to March');
assert(/index 117/.test(k(y27, 'march-peak').title) && Object.keys(k(y27, 'march-peak').lift).length === 0, 'March peak from the season index, no double lift');
const cal = LIVE.calendar(TODAY, 365); assert(cal.every(i => i.end >= TODAY && i.start <= LIVE.addD(TODAY, 364)), 'calendar window'); assert(cal.some(i => i.key === 'pcs-season'), 'moving season shown for a scope with Bell');
assert(!LIVE.calendar(TODAY, 365, { counties: ['48201'] }).some(i => i.key === 'pcs-season'), 'moving season hidden for Harris only');
for (let i = 1; i < cal.length; i++) assert(cal[i - 1].start <= cal[i].start, 'calendar sorted');
/* house style: no hyphens or dashes in the prose */
const dash = /[‐-―]|\s-\s|[A-Za-z]-[A-Za-z]/;
for (const y of [2026, 2027]) for (const it of LIVE.calendarYear(y)) { assert(!dash.test(it.title) && !dash.test(it.action), 'house style in calendar: ' + it.key); }
for (const t of trs) assert(!dash.test(t.action.replace(t.notice ? t.notice.company : '\u0000', '')), 'house style in trigger rule: ' + t.id);

/* ---------------- exports ---------------- */
const ics = LIVE.ics('2027-01-01', 365);
const lines = ics.split('\r\n'); assert(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics), 'CRLF only');
eq(lines[0], 'BEGIN:VCALENDAR', 'calendar begins'); assert(lines.includes('VERSION:2.0') && lines.includes('END:VCALENDAR'), 'calendar ends');
assert(lines.every(l => Buffer.byteLength(l, 'utf8') <= 75), 'lines folded at 75 octets');
const unfolded = ics.replace(/\r\n /g, '');
const evs = unfolded.split('BEGIN:VEVENT').length - 1; eq(evs, LIVE.calendar('2027-01-01', 365).length, 'one event per item');
assert(unfolded.includes('UID:summer-counter-2027@severance.live\r\n') && /DTSTART;VALUE=DATE:20270415\r\nDTEND;VALUE=DATE:20270416/.test(unfolded), 'one day event, exclusive end');
assert(/DTSTART;VALUE=DATE:20270301\r\nDTEND;VALUE=DATE:20270402\r\nSUMMARY:April 1: written notice designating extended summer possession/.test(unfolded), 'April 1 window');
assert(/DESCRIPTION:Under a standard possession order\\, the possessory conservator/.test(unfolded), 'commas escaped'); assert(/\\n/.test(unfolded) && !/DESCRIPTION:[^\r]*\n[^ ]/.test(unfolded.replace(/\r\n/g, '\u0001')), 'newlines escaped');
const uids = unfolded.match(/UID:[^\r]+/g); eq(new Set(uids).size, uids.length, 'unique UIDs');
const ccsv = LIVE.calendarCSV('2027-01-01', 365); assert(/^# /.test(ccsv) && ccsv.includes('start_date,end_date,key_date,title,lines,bid_lift,counties,ad_action,source'), 'calendar CSV header');
assert(ccsv.includes('2027-03-01,2027-04-01,2027-04-01,April 1: written notice designating extended summer possession'), 'calendar CSV row');
const ed = LIVE.editorCSV({ lines: ['mod', 'po'] }); const er = ed.trim().split('\n');
eq(er[0], 'Campaign,Ad Schedule,Location,ID,Bid Modifier,Criterion Type,Status', 'Editor header');
const sched = er.filter(l => /\)\[00:00-24:00\]/.test(l)); eq(sched.length, 14, 'seven ad schedule rows per line');
eq(new Set(sched.filter(l => l.startsWith('SEV_MOD_SEARCH')).map(l => l.match(/\((\w+)\)/)[1])).size, 7, 'all seven days covered');
const locs = er.filter(l => /,Location,Enabled$/.test(l)); eq(locs.length, 4, 'one location row per county per line'); assert(locs.some(l => l.includes('Harris County, Texas, United States')), 'county location name');
assert(er.slice(1).every(l => /,([+-][1-9]\d*|0)%,/.test(l)), 'bid modifier format');
const zipEd = LIVE.editorCSV({ lines: ['mod'], geo: 'zip' }); assert(/\d{5}, Texas, United States/.test(zipEd), 'ZIP location rows');
LIVE.setSettings({ campaign: '{GEO} · {LINE}' }); assert(LIVE.editorCSV({ lines: ['mod'] }).includes('"Harris, Bell · Modification"') || LIVE.editorCSV({ lines: ['mod'] }).includes('Harris, Bell · Modification'), 'campaign pattern'); LIVE.setSettings({ campaign: 'SEV_{KEY}_SEARCH' });
const dcsv = LIVE.dailyCSV('mod', '48201'); assert(dcsv.split('\n').filter(l => /^\d{4}-\d{2}-\d{2},/.test(l)).length === 90, 'daily plan has 90 days');
const wcsv = LIVE.windowsCSV('div_k', null); assert(wcsv.includes('campaign,county,start_date,end_date,days,bid_adjustment_pct,peak_pct,direction,reasons'), 'windows CSV');
const ncsv = LIVE.noticesCSV(); assert(ncsv.includes('Acme Logistics') && ncsv.includes(',2026-12-27,2027-09-28,live'), 'notices CSV with windows'); assert(ncsv.split('\n')[1].includes('reason'), 'raw unknown columns in the CSV');
const js = JSON.parse(LIVE.snapshotJSON()); assert(js.severance_live === 1 && js.triggers.length && js.calendar.length && js.live.warn.rows.length === 2, 'live JSON');

/* ---------------- a downloaded file ---------------- */
LIVE.clearLive(); eq(LIVE.state.sources.warn.mode, 'snapshot', 'forget live data');
let r = LIVE.loadFile(fredNew, 'fredgraph.csv'); eq([r.kind, r.n], ['icl', 2], 'FRED file'); r = LIVE.loadFile('observation_date,TXCCLAIMS\n2026-09-05,120000\n', 'x.csv'); eq(r.kind, 'ccl', 'continued claims file');
r = LIVE.loadFile(JSON.stringify(socrata), 'warn.json'); eq([r.kind, r.n], ['warn', 4], 'WARN file');
threw = null; try { LIVE.loadFile('a,b\n1,2\n', 'odd.csv'); } catch (e) { threw = e; } assert(threw && /no notice date or county column/.test(threw.message), 'odd file explained');
console.log('core ok');

/* ---------------- the background watch in a fake chrome ---------------- */
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const T0 = today(); const ago = n => LIVE.addD(T0, -n);
const bgWarn = [
  { notice_date: ago(3) + 'T00:00:00.000', job_site_name: 'Harbor Freight Center', county_name: 'HARRIS', city_name: 'Houston', total_layoff_number: '210' },
  { notice_date: ago(10) + 'T00:00:00.000', job_site_name: 'Temple Assembly', county_name: 'BELL', city_name: 'Temple', total_layoff_number: '95' },
  { notice_date: ago(40) + 'T00:00:00.000', job_site_name: 'Old Notice Inc', county_name: 'HARRIS', total_layoff_number: '70' },
  { notice_date: ago(200) + 'T00:00:00.000', job_site_name: 'Older Plant', county_name: 'HARRIS', total_layoff_number: '400' }
];
const dallasRow = { notice_date: ago(2) + 'T00:00:00.000', job_site_name: 'Dallas Office', county_name: 'DALLAS', total_layoff_number: '500' };
let bgFred = 'DATE,TXICLAIMS\n' + [...Array(60)].map((_, i) => `${LIVE.addD(ago(7 * 60), 7 * i)},14000`).join('\n') + '\n';
let bgMode = 'ok'; const bgCalls = [];
const bgFetch = async url => { bgCalls.push(url); if (url.startsWith('https://data.texas.gov/')) { if (bgMode === '400' && url.includes('$where')) return resp(400, { message: 'bad column' }); return resp(200, bgMode === '400' ? bgWarn.concat([dallasRow]) : bgWarn); } if (url.includes('TXICLAIMS')) return resp(200, bgFred); return resp(404, ''); };
const store = {}; const L = { installed: [], startup: [], alarm: [], changed: [], message: [], clicked: [] }; const alarms = []; const notes = []; const badgeLog = []; const tabs = [];
const ev = k => ({ addListener: f => L[k].push(f) });
const chromeFake = {
  runtime: { id: 'testid', onInstalled: ev('installed'), onStartup: ev('startup'), onMessage: ev('message'), getURL: p => 'chrome-extension://testid/' + p },
  storage: { local: { async get(k) { const ks = Array.isArray(k) ? k : [k]; const o = {}; ks.forEach(x => { if (store[x] !== undefined) o[x] = JSON.parse(JSON.stringify(store[x])); }); return o; }, async set(o) { const ch = {}; for (const x in o) { ch[x] = { oldValue: store[x], newValue: o[x] }; store[x] = JSON.parse(JSON.stringify(o[x])); } L.changed.forEach(f => f(ch, 'local')); } }, onChanged: ev('changed') },
  alarms: { async clear() { return true; }, async create(name, info) { alarms.push([name, info]); }, onAlarm: ev('alarm') },
  notifications: { async create(id, o) { notes.push(Object.assign({ id }, o)); return id; }, clear() { }, onClicked: ev('clicked') },
  action: { async setBadgeText(o) { badgeLog.push(['text', o.text]); }, async setBadgeBackgroundColor(o) { badgeLog.push(['color', o.color]); }, async setBadgeTextColor() { }, async setTitle(o) { badgeLog.push(['title', o.title]); } },
  permissions: { async contains() { return true; } },
  tabs: { create(o) { tabs.push(o.url); } }
};
store['sev.ext.options'] = { counties: [{ fips: '48201', name: 'Harris' }, { fips: '48027', name: 'Bell' }], interval: 180 };
const bg = { chrome: chromeFake, fetch: bgFetch, console, setTimeout, clearTimeout, URL, URLSearchParams, Intl, AbortSignal };
vm.createContext(bg); vm.runInContext(read('background.js'), bg, { filename: 'background.js' });
eq([L.installed.length, L.startup.length, L.alarm.length, L.changed.length, L.message.length, L.clicked.length], [1, 1, 1, 1, 1, 1], 'listeners registered at the top level');
const settle = async (cond, ms = 4000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timed out waiting'); await new Promise(r => setTimeout(r, 10)); } };
L.installed[0]({ reason: 'install' }); await settle(() => alarms.length === 1);
eq(alarms[0], ['sev-live', { periodInMinutes: 180, delayInMinutes: 0.5 }], 'alarm from the options interval');
/* cycle 1: seeds what has been seen, no notification, badge = notices in the last 14 days */
L.alarm[0]({ name: 'sev-live' }); await settle(() => store['sev.ext.state'] && store['sev.ext.state'].last);
let stt = store['sev.ext.state']; eq(stt.last.errors, [], 'no errors'); eq(notes.length, 0, 'first cycle does not notify');
eq(stt.summary.new14, 2, 'two notices in 14 days'); eq(stt.summary.workers14, 305, 'workers in 14 days'); eq(stt.summary.scope, ['Harris', 'Bell'], 'scope');
assert(badgeLog.some(b => b[0] === 'text' && b[1] === '2'), 'badge shows 2'); assert(badgeLog.some(b => b[0] === 'color' && b[1] === '#1b4332'), 'badge color');
assert(bgCalls[0].includes('$where') && decodeURIComponent(bgCalls[0]).includes("upper(county_name) in ('HARRIS','BELL')"), 'county query: ' + decodeURIComponent(bgCalls[0]));
eq(stt.seen.length, 4, 'seen ids'); const trg = stt.summary.triggers; assert(trg.some(t => t.kind === 'warn' && t.status === 'active' && /Older Plant/.test(t.title)), 'a 200 day old notice has an active window');
assert(trg.some(t => t.status === 'upcoming' && /Harbor Freight/.test(t.title) && t.start === LIVE.addD(ago(3), 90)), 'new notice upcoming from day 90');
/* parity with the desk: same keys and the same windows */
const coreRows = LIVE.parseWarn(bgWarn).rows, bgRows = bg.parseWarn(bgWarn, store['sev.ext.options'].counties).rows;
eq(bgRows.map(x => [x.id, x.date, x.workers, x.county]), coreRows.map(x => [x.id, x.date, x.workers, x.county]), 'background and desk parse the same');
eq(JSON.stringify(bg.parseFred(fredOld).points), JSON.stringify(LIVE.parseFred(fredOld).points), 'FRED parse parity'); eq(JSON.stringify(bg.claimsCheck(LIVE.parseFred(fredJump).points, { wow: 20, yoy: 15 }).flags), JSON.stringify(ck.flags), 'claims rule parity');
LIVE.setToday(T0); LIVE.clearLive(); LIVE.loadFile(JSON.stringify(bgWarn), 'bg.json');
const deskT = LIVE.triggers({ counties: ['48201', '48027'], past: true }).find(t => /Harbor Freight/.test(t.title)); const bgT = trg.find(t => /Harbor Freight/.test(t.title));
eq([bgT.start, bgT.end, bgT.status], [deskT.start, deskT.end, deskT.status], 'background and desk open the same window');
/* cycle 2: a new notice and a claims jump week */
bgWarn.unshift({ notice_date: ago(1) + 'T00:00:00.000', job_site_name: 'New Layoff Co', county_name: 'HARRIS', city_name: 'Pasadena', total_layoff_number: '300' });
bgFred += `${LIVE.addD(ago(7 * 60), 7 * 60)},20000\n`;
const before = store['sev.ext.state'].last.at; L.alarm[0]({ name: 'sev-live' }); await settle(() => store['sev.ext.state'].last.at !== before);
stt = store['sev.ext.state'];
const wn = notes.find(n => /WARN notice: 300 workers, Harris County/.test(n.title)); assert(wn, 'new notice notified: ' + JSON.stringify(notes));
assert(/New Layoff Co, noticed/.test(wn.message) && /Lift modification and enforcement in Harris County from/.test(wn.message) && /Protective orders unaffected/.test(wn.message), 'notification carries the rule');
eq([wn.type, wn.iconUrl], ['basic', 'icons/icon128.png'], 'notification shape');
assert(notes.some(n => /Texas weekly claims jump/.test(n.title) && /Lift modification and enforcement/.test(n.message)), 'claims jump notified');
eq(notes.length, 2, 'only the new notice and the claims jump'); eq(stt.summary.new14, 3, 'badge count after'); assert(badgeLog.filter(b => b[0] === 'text').pop()[1] === '3', 'badge now 3');
assert(stt.summary.triggers.some(t => t.kind === 'claims'), 'claims trigger in the summary');
/* a manual refresh through a runtime message, with the county query refused (400) */
bgMode = '400'; let answer = null; const keep = L.message[0]({ type: 'sev:refresh' }, {}, a => { answer = a; }); eq(keep, true, 'async response kept open'); await settle(() => answer);
assert(answer.ok, 'manual refresh answered'); stt = store['sev.ext.state']; assert(stt.fallback && !stt.notices.some(n => n.county === 'Dallas'), 'fallback filters to the watched counties'); eq(stt.last.reason, 'manual', 'reason');
eq(notes.length, 2, 'nothing new to notify');
/* an options change: interval only reschedules, counties also re-check */
const fetchesBefore = bgCalls.length; await chromeFake.storage.local.set({ 'sev.ext.options': Object.assign({}, store['sev.ext.options'], { interval: 720 }) }); await settle(() => alarms.length === 2);
eq(alarms[1][1].periodInMinutes, 720, 'rescheduled'); await new Promise(r => setTimeout(r, 50)); eq(bgCalls.length, fetchesBefore, 'interval change alone does not fetch');
bgMode = 'ok'; const at3 = store['sev.ext.state'].last.at; await chromeFake.storage.local.set({ 'sev.ext.options': Object.assign({}, store['sev.ext.options'], { counties: [{ fips: '48027', name: 'Bell' }] }) }); await settle(() => store['sev.ext.state'].last.at !== at3);
eq(store['sev.ext.state'].last.reason, 'options', 'county change re-checks'); eq(store['sev.ext.state'].summary.scope, ['Bell'], 'new scope');
/* badge off, errors and the notification click */
await chromeFake.storage.local.set({ 'sev.ext.options': Object.assign({}, store['sev.ext.options'], { badge: false }) }); await settle(() => store['sev.ext.state'].last.reason === 'badge'); assert(badgeLog.filter(b => b[0] === 'text').pop()[1] === '', 'badge off');
bg.fetch = async () => { throw new TypeError('Failed to fetch'); }; const at4 = store['sev.ext.state'].last.at; L.alarm[0]({ name: 'sev-live' }); await settle(() => store['sev.ext.state'].last.at !== at4);
stt = store['sev.ext.state']; eq(stt.last.errors.length, 2, 'both sources failed'); assert(/^WARN notices: Failed to fetch/.test(stt.last.errors[0]), 'error text'); assert(badgeLog.filter(b => b[0] === 'text').pop()[1] === '?', 'badge question mark'); assert(stt.summary.notices.length > 0, 'last notices kept');
L.clicked[0]('sev-x'); eq(tabs.pop(), 'chrome-extension://testid/app.html#live', 'notification opens the Live Desk');
L.message[0]({ type: 'sev:open', hash: '#live' }, {}, () => { }); eq(tabs.pop(), 'chrome-extension://testid/app.html#live', 'open message');
chromeFake.permissions.contains = async () => false; const at5 = stt.last.at; L.alarm[0]({ name: 'sev-live' }); await settle(() => store['sev.ext.state'].last.at !== at5); assert(/Grant site access/.test(store['sev.ext.state'].last.error), 'missing site access explained');
console.log('background ok');
