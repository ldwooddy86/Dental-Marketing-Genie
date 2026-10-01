/* The shared paid and service line model (src/14_model_core.js): SEV_MODEL's store (defaults graded D, user inputs, applied Accounts
   actuals and which one wins, clamping, 0 accepted, reset, the 'model' event), FLM.compute on the real data (matters that add up to the
   county counts, lenses kept out of the mass, the payer weight and the fee value index by hand, the click cost index range, the
   quadrant and tier rules, the six bid bands, quiet auctions, the pipeline credit, the fee paying shares, Competitor Watch pressure),
   the unit economics by hand, the portfolio, the dayparts and the hourly plan, the angle triggers, the exports (no comment lines in
   import files) and LINE_META's build 2 fields (src/25_m06_lines.js) in the house style. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assert, eq } from './lib/mock.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const node = () => ({ style: { setProperty() { } }, dataset: {}, classList: { add() { }, remove() { }, toggle() { }, contains: () => false }, setAttribute() { }, removeAttribute() { }, appendChild() { }, addEventListener() { }, querySelector: () => null, querySelectorAll: () => [] });
const ls = new Map();
const ctx = { console, URL, URLSearchParams, TextEncoder, TextDecoder, setTimeout, clearTimeout, Intl, Blob,
  document: { createElement: node, createElementNS: node, body: node(), documentElement: node(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() { }, removeEventListener() { }, activeElement: null },
  addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false, addEventListener() { } }), performance: globalThis.performance, ResizeObserver: class { observe() { } unobserve() { } disconnect() { } }, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout, innerWidth: 1400, innerHeight: 900, scrollX: 0, scrollY: 0, getComputedStyle: () => ({ getPropertyValue: () => '' }),
  localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
  navigator: { userAgent: 'node' }, location: { hash: '' }, history: { replaceState() { }, pushState() { } } };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data/suite.js', 'src/00_core.js', 'src/01_kit.js', 'src/02_firm.js', 'src/03_lint.js', 'src/10_desk_platforms.js', 'src/13_stats_core.js', 'src/14_model_core.js', 'src/25_m06_lines.js']) vm.runInContext(read(f), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);
const near = (a, b, tol, msg) => assert(typeof a === 'number' && Math.abs(a - b) <= tol, `${msg}: expected ${b} ± ${tol}, got ${a}`);
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } };
run(`globalThis.__ev = []; BUS.on('model', d => __ev.push(d && d.what));`);

t('defaults are graded D and read module 06', () => {
  eq(run(`SEV_MODEL.get('cpc')`), 9.87, 'default CPC');
  eq(run(`SEV_MODEL.info('g', null, 'cpc').src`), 'default', 'source'); eq(run(`SEV_MODEL.info('g', null, 'cpc').g`), 'D', 'grade D');
  eq(run(`SEV_MODEL.line('div_k').fee`), run(`LINE_META.div_k.fee`), 'fee from LINE_META');
  eq(run(`SEV_MODEL.line('div_k').retain`), 22, 'show 55% times retained 40% is the desk\'s 22% lead to retained');
  eq(run(`SEV_MODEL.line('sapcr').pipe`), 10, 'custody pipeline default'); eq(run(`SEV_MODEL.line('div_nk').pipe`), 0, 'no pipeline for divorce without children');
  eq(run(`SEV_MODEL.rate('poRespondentShare')`), 45, 'respondent share'); eq(run(`SEV_MODEL.rate('ivdPrivShare')`), 10, 'IV-D private share'); eq(run(`SEV_MODEL.rate('cpsNonIndigentShare')`), 25, 'CPS share');
  eq(run(`SEV_MODEL.IDS.length`), 13, 'thirteen lines');
});

t('set, clamp, 0, clear, persist, event', () => {
  const v0 = run(`SEV_MODEL.version`);
  run(`SEV_MODEL.set({ cpc: 0, lines: { div_k: { cvr: 150, fee: 12000 } }, rates: { radiusKm: 0.2 } })`);
  eq(run(`SEV_MODEL.get('cpc')`), 0, '0 is accepted (the Thermal Atlas "+v || old" bug)'); eq(run(`SEV_MODEL.info('g', null, 'cpc').src`), 'you', 'user source');
  eq(run(`SEV_MODEL.line('div_k').cvr`), 100, 'clamped to 100'); eq(run(`SEV_MODEL.rate('radiusKm')`), 1, 'radius clamped to 1');
  assert(run(`SEV_MODEL.version`) > v0, 'version moves'); assert(run(`__ev.includes('set')`), "BUS 'model' emitted");
  const saved = JSON.parse(ls.get('sv.sev.model')); eq(saved.g.cpc, 0, 'stored under sv.sev.model'); eq(saved.lines.div_k.fee, 12000, 'line value stored');
  run(`SEV_MODEL.set({ cpc: null, lines: { div_k: { cvr: '' } } })`); eq(run(`SEV_MODEL.get('cpc')`), 9.87, 'null clears to the default'); eq(run(`SEV_MODEL.line('div_k').cvr`), 5.55, 'blank clears');
  run(`SEV_MODEL.set({ cpc: 'abc', budget: NaN })`); eq(run(`SEV_MODEL.get('cpc')`), 9.87, 'non numbers are ignored');
  run(`SEV_MODEL.reset('div_k')`); eq(run(`SEV_MODEL.line('div_k').fee`), 9500, 'line reset'); run(`SEV_MODEL.reset()`); eq(run(`JSON.stringify(SEV_MODEL.user().g)`), '{}', 'full reset');
});

t('applied Accounts actuals replace defaults; the newer of an input and an Apply wins', () => {
  run(`SEV_MODEL.set({ lines: { mod: { fee: 5000 } } })`);   // a user value made before the Apply
  run(`{ const t0 = Date.now(); while (Date.now() <= t0 + 2); } globalThis.ACCT = { S: { settings: { applied: { at: new Date().toISOString(), since: '2026-06-01', patch: {} } } }, applied: () => ({ cpc: 4.1, cvr: 7, retain: 33, lines: { div_k: { cvr: 8, retain: 30, fee: 7000, cpc: 6.15, n: 40, since: '2026-06-01' }, mod: { fee: 6200 } } }) }; BUS.emit('actuals', {});`);
  eq(run(`SEV_MODEL.get('cpc')`), 4.1, 'account CPC from the actuals'); eq(run(`SEV_MODEL.info('g', null, 'cpc').g`), 'B', 'actuals graded B');
  const L = run(`JSON.stringify(SEV_MODEL.line('div_k'))`); const o = JSON.parse(L);
  eq(o.cvr, 8, 'line conversion'); eq(o.fee, 7000, 'realized fee'); near(o.close, 30 / 55 * 100, 1e-9, 'retained rate is lead to retained over the show rate'); near(o.retain, 30, 1e-9, 'lead to retained reproduced'); near(o.cpcMult, 1.5, 1e-9, 'line CPC over the account CPC');
  eq(run(`SEV_MODEL.line('sapcr').cvr`), 7, 'overall conversion where the line has none');
  eq(run(`SEV_MODEL.line('mod').fee`), 6200, 'an Apply after the input wins');
  run(`{ const t0 = Date.now(); while (Date.now() <= t0 + 2); } SEV_MODEL.set({ lines: { mod: { fee: 5500 } } })`); eq(run(`SEV_MODEL.line('mod').fee`), 5500, 'an input after the Apply wins');
  assert(/actuals/.test(run(`JSON.stringify(SEV_MODEL.snapshot().lines.div_k.fee)`)), 'snapshot names the source');
  run(`delete globalThis.ACCT; SEV_MODEL.reset();`);
});

t('matters add up to the county counts; lenses stay out of the mass', () => {
  const r = JSON.parse(run(`(() => { const C = FLM.compute('19100'); const cs = MSA['19100'].counties; const tot = id => sum(cs.map(f => { const l = CI[f].lines[id]; return l ? (id === 'prenup' ? l.est : l.n) || 0 : 0; })); return JSON.stringify({ k: [C.lines.div_k.matters, tot('div_k')], cps: [C.lines.cps.matters, tot('cps')], adopt: [C.lines.adopt.matters, tot('adopt')], prenup: [C.lines.prenup.matters, tot('prenup')], high: [C.lines.high.matters, tot('high')], gray: [C.lines.gray.matters, tot('gray')], div: [C.lines.div_k.matters + C.lines.div_nk.matters, sum(C.rows.map(r => r.z.alloc.div || 0))], mass: sum(C.rows.map(r => r.mass)), massAdd: sum(FLM.ADD.map(id => C.lines[id].mass)), n: C.rows.length, zc: ZC.filter(z => z.msa === '19100').length }); })()`));
  for (const k of ['k', 'cps', 'adopt', 'prenup', 'high', 'gray']) near(r[k][0], r[k][1], 1, `${k} sums to the county total`);
  near(r.div[0], r.div[1], 0.5, 'divorce with and without children make all divorce'); near(r.mass, r.massAdd, 1e-6, 'mass is the ten additive lines'); eq(r.n, r.zc, 'every metro ZIP');
  eq(run(`FLM.ADD.length + '/' + FLM.LENS.join(',')`), '10/high,mil,gray', 'ten additive lines, three lenses');
});

t('payer weight, fee value index, click cost index, payable shares', () => {
  const r = JSON.parse(run(`(() => { const C = FLM.compute('19100'); const r = C.by['75201']; const z = r.z; return JSON.stringify({ w: r.w, lo: z.acs.inc_lt35k_sh, l35: z.risk.inc_lt35k, l60: z.risk.inc_lt60k, fvi: r.fvi, inc: z.acs.med_hh_inc, med: C.med.inc, rels: C.rows.map(x => x.cpc_rel), po: [C.cells['75201'].po.payable, C.cells['75201'].po.matters], ivd: [C.cells['75201'].ivd.payable, C.cells['75201'].ivd.matters] }); })()`));
  const mid = Math.min(Math.max(r.l60 - r.l35, 0), 1 - r.lo);
  near(r.w, 0.35 * r.lo + 0.7 * mid + (1 - r.lo - mid), 1e-12, 'payer weight by hand');
  near(r.fvi, Math.min(1.6, Math.max(0.7, Math.sqrt(r.inc / r.med))), 1e-12, 'fee value index by hand');
  assert(Math.min(...r.rels) >= 0.55 - 1e-9 && Math.max(...r.rels) <= 2.10 + 1e-9, 'click cost index within 0.55 to 2.10');
  near(r.po[0], r.po[1] * 0.45, 1e-9, 'protective orders keep the respondent share'); near(r.ivd[0], r.ivd[1] * 0.10, 1e-9, 'IV-D keeps the private share');
});

t('quadrants, tiers, bid bands, quiet auctions, percentiles', () => {
  const bad = run(`(() => { const C = FLM.compute('26420'); const out = []; C.rows.forEach(r => { const q = r.oppb >= 65 ? (r.comp_pct >= 60 ? 0 : 1) : (r.comp_pct >= 60 ? 3 : 2); if (q !== r.quad) out.push('quad ' + r.zip); const i = FLM.TIERS.indexOf(r.tier); if (FLM.TIER_BID[i] !== r.bid) out.push('tier bid ' + r.zip); if (!(r.effb >= FLM.TIER_CUT[i] && (i === 0 || r.effb < FLM.TIER_CUT[i - 1]))) out.push('tier band ' + r.zip); ['effb', 'oppb', 'comp_pct'].forEach(k => { if (!(r[k] >= 0 && r[k] <= 100)) out.push(k + ' ' + r.zip); }); FLM.ALL.forEach(id => { const c = C.cells[r.zip][id]; const b = c.pri >= 90 ? 45 : c.pri >= 75 ? 30 : c.pri >= 55 ? 15 : c.pri >= 35 ? 0 : c.pri >= 15 ? -20 : -40; if (b !== c.bid) out.push('band ' + id + r.zip); if (c.quiet !== (c.contrib > 0 && c.presspct <= 45 && c.contribpct >= 60)) out.push('quiet ' + id + r.zip); if (c.contrib <= 0 && c.pri !== 0) out.push('zero pri ' + id); }); }); return out.slice(0, 5).join('; '); })()`);
  eq(bad, '', 'every ZIP follows the rules');
  eq(run(`JSON.stringify([FLM.bandOf(95), FLM.bandOf(80), FLM.bandOf(60), FLM.bandOf(40), FLM.bandOf(20), FLM.bandOf(3)])`), '[45,30,15,0,-20,-40]', 'six bid bands');
  eq(run(`JSON.stringify([FLM.quadOf(70, 70), FLM.quadOf(70, 10), FLM.quadOf(10, 10), FLM.quadOf(10, 70)])`), '[0,1,2,3]', 'Anchor, Whitespace, Niche, Avoid');
  eq(run(`FLM.ranker([1, 2, 3, 4])(3)`), 50, 'percentile is the share strictly below');
});

t('pipeline credit and the contested split', () => {
  const a = JSON.parse(run(`(() => { const c = FLM.compute('19100').cells['75034'].sapcr; return JSON.stringify({ pipe: c.pipe, contrib: c.contrib, direct: c.direct, mass: c.mass, fvi: FLM.compute('19100').by['75034'].fvi }); })()`));
  const modV = run(`FLM.valueAt('mod', ${a.fvi})`);
  near(a.pipe, a.mass * 0.10 * modV, 1e-6, 'custody pipeline credit is 10% of the mass at the modification value'); near(a.contrib, a.direct + a.pipe, 1e-6, 'contribution adds the credit');
  run(`SEV_MODEL.set({ lines: { sapcr: { pipe: 0 } } })`); near(run(`FLM.compute('19100').cells['75034'].sapcr.pipe`), 0, 1e-12, 'pipe 0 turns it off');
  run(`SEV_MODEL.set({ lines: { div_k: { contested: 50, flat: 3000, realization: 100 } } })`); near(run(`FLM.valueAt('div_k', 1.2)`), 0.5 * 9500 * 1.2 + 0.5 * 3000, 1e-9, 'contested share at the indexed fee, the rest flat');
  run(`SEV_MODEL.reset()`); near(run(`FLM.valueAt('div_k', 1)`), 9500 * 0.9, 1e-9, 'default: the fee times 90% collected');
});

t('Competitor Watch raises pressure where rivals are logged', () => {
  const f = run(`MSA['19100'].counties[1]`);
  const before = JSON.parse(run(`(() => { const C = FLM.compute('19100'); const r = C.rows.find(r => r.z.county === '${f}' && r.dens > 0); return JSON.stringify({ zip: r.zip, raw: C.cells[r.zip].div_k.press, logged: C.logged }); })()`));
  run(`globalThis.WATCH = { activity: () => ({ '${f}': { _all: 3, div_k: 2 } }) }; BUS.emit('watch', {});`);
  const after = JSON.parse(run(`(() => { const C = FLM.compute('19100'); return JSON.stringify({ raw: C.cells['${before.zip}'].div_k.press, raw2: C.cells['${before.zip}'].po.press, logged: C.logged }); })()`));
  near(after.raw, before.raw * (1 + Math.min(2, 0.6 * (2 + 0.3 * 3))), 1e-9, 'line pressure factor 1 + min(cap, step x (line ads + 0.3 all ads))');
  near(after.raw2, before.raw * (1 + Math.min(2, 0.6 * 0.9)), 1e-9, 'other lines take 0.3 of all ads'); eq(after.logged, true, 'logged flag'); eq(before.logged, false, 'nothing logged before');
  run(`delete globalThis.WATCH; BUS.emit('watch', {});`);
});

t('unit economics by hand', () => {
  const u = JSON.parse(run(`JSON.stringify(FLM.econ('po', 1.2, 1, 0.5))`));
  const search = 9.87 * 1 * 1.2 / 0.0555, ms = search * 6.6 / 9.87, yelp = 8 / 0.06;
  const cpl = (9 * search + 9 * 140 + 4 * ms + 1 * yelp) / 23;   // po fit: google 3, lsa 3, microsoft 2, yelp 1, meta 0
  near(u.cpl, cpl, 1e-6, 'blended cost per lead by fit squared'); near(u.rpl, 0.22, 1e-12, 'retained per lead');
  const perRet = 3000 * 0.9 + 0.10 * (0.5 * 9500 * 0.9 + 0.5 * 4500 * 0.9); near(u.perRet, perRet, 1e-6, 'value per retained with the divorce pipeline credit');
  near(u.cpr, cpl / 0.22, 1e-6, 'cost per retained'); near(u.beCpl, perRet * 0.22, 1e-6, 'break even cost per lead');
});

t('portfolio, season, dayparts, hourly plan', () => {
  const a = JSON.parse(run(`JSON.stringify(FLM.allocate('19100', 10000, 2).map(r => [r.id, r.budget]))`));
  eq(a.length, 10, 'additive lines only'); near(a.reduce((s, x) => s + x[1], 0), 10000, 1e-6, 'the budget is spent');
  assert(!a.some(x => ['high', 'mil', 'gray'].includes(x[0])), 'no lens in the portfolio');
  const s = JSON.parse(run(`JSON.stringify(FLM.season('div_k'))`)); near(s.months.reduce((x, y) => x + y, 0) / 12, 100, 1e-9, 'season mean 100'); eq(run(`FLM.season('adopt').flat`), true, 'adoption has no series');
  eq(run(`FLM.grid('po').key`), 'urgent', 'protective orders urgent'); assert(run(`FLM.grid('cps').grid.every(d => d.every(v => v >= 0))`), 'urgent never below 0');
  eq(run(`FLM.grid('ivd').key + FLM.grid('adopt').key + FLM.grid('enf').key`), 'businessbusinessbusiness', 'IV-D, adoption, enforcement business hours');
  eq(run(`FLM.grid('div_k').key + FLM.grid('sapcr').key`), 'consideredconsidered', 'divorce and custody considered');
  const h = JSON.parse(run(`JSON.stringify(FLM.hourlyPlan('div_k', '2026-10-05', 7))`)); eq(h.length, 168, '7 days by 24 hours'); eq(h[0].day, 'Monday', '2026-10-05 is a Monday'); eq(h[17].bid, 20, 'Monday 5 pm takes the evening block');
});

t('angles', () => {
  eq(run(`FL_ANGLES.find(a => a.id === 'high').trig({ acs: { inc_150k_sh: 0.25, med_value: 300000 } })`), true, 'high asset by income');
  eq(run(`FL_ANGLES.find(a => a.id === 'gray').trig({ acs: { mar_55p_sh: 0.39 } })`), false, 'gray below 40%');
  eq(run(`FL_ANGLES.find(a => a.id === 'mil').trig({ acs: {}, risk: { mil_active: 0 }, county: '48027' })`), true, 'Bell County is an installation county');
  assert(run(`FL_ANGLES.every(a => a.id && a.short && LINE_META[a.line] && !/[\\u2013\\u2014]|[a-z]-[a-z]/i.test(a.why.replace(/IV-D/g, '')))`), 'every angle names a line, house style');
});

t('exports: import files carry no comment lines', () => {
  const g = run(`FLM.googleLocations('19100', 'div_k', null, 10, 'DFW_DIV_K_SEARCH')`);
  eq(g.split('\n')[0], 'Campaign,Location,ID,Bid Modifier,Criterion Type,Status', 'Google header'); assert(!/^#/m.test(g), 'no # lines'); eq(g.split('\n').length, 11, 'ten rows');
  assert(/,[+-]?\d+%,Location,Enabled$/m.test(g), 'bid modifiers');
  const m = run(`FLM.metaZips('19100', 'po', null, 5)`); assert(!/^#/m.test(m) && /^Zip,/.test(m) && /\nUS:\d{5},/.test(m), 'Meta ZIP keys, no # lines');
  const l = run(`FLM.matrixLong('19100', ['75201'])`); eq(l.split('\n').filter(x => !x.startsWith('#')).length, 14, 'thirteen lines for one ZIP plus the header');
  eq(run(`FLM.hourlyCSV('po', '2026-10-05', 1)`).split('\n').filter(x => !x.startsWith('#')).length, 25, 'hourly plan rows');
});

t('LINE_META build 2 fields', () => {
  const bad = run(`(() => { const out = []; const P = FLM.PLATS; Object.keys(LINE_META).forEach(k => { const L = LINE_META[k]; if (!['base', 'lens'].includes(L.kind)) out.push(k + ' kind'); if (!P.every(p => [0, 1, 2, 3].includes(L.fit[p]))) out.push(k + ' fit'); if (!FLM.DAYPARTS[L.dayparts]) out.push(k + ' dayparts'); if (!(L.mobile > 0 && L.mobile < 100)) out.push(k + ' mobile'); ['hooks', 'negs', 'triggers'].forEach(f => { if (!Array.isArray(L[f]) || !L[f].length) out.push(k + ' ' + f); }); [L.intent].concat(L.hooks, L.triggers).forEach(s => { if (/[\\u2013\\u2014]/.test(s) || /[A-Za-z]-[A-Za-z]/.test(String(s).replace(/IV-D/g, ''))) out.push(k + ' house style: ' + s); }); }); return out.join('; '); })()`);
  eq(bad, '', 'every line complete and hyphen free');
  eq(run(`Object.keys(LINE_META).filter(k => LINE_META[k].kind === 'lens').join(',')`), 'high,mil,gray', 'the lenses');
  eq(run(`LINE_META.po.fit.meta + LINE_META.po.fit.nextdoor`), 0, 'protective orders: no Meta, no Nextdoor');
});

console.log(`model: ${n} groups passed`);
