/* Module 01 and the metro tabs (src/20_m01_index.js, src/31_m12_metros.js): the composite and its equal weight and no filing variants,
   the σ bars, the callout thresholds and their wording, the paid quadrant, the validation statistics (recomputed here from the data
   with SEV_STATS), the three way count of divorces, the layer catalogs (every layer reads every county and ZIP without throwing, with
   a group, a grade and a note) and the metro married margin (the Census approximation for a sum). Real data, stubbed DOM. */
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
  document: { createElement: node, body: node(), documentElement: node(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() { }, removeEventListener() { }, activeElement: null },
  addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false, addEventListener() { } }), performance: globalThis.performance, ResizeObserver: class { observe() { } unobserve() { } disconnect() { } }, MutationObserver: class { observe() { } disconnect() { } }, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout, innerWidth: 1400, innerHeight: 900, scrollX: 0, scrollY: 0, getComputedStyle: () => ({ getPropertyValue: () => '' }),
  localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
  navigator: { userAgent: 'node' }, location: { hash: '' }, history: { replaceState() { } } };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data/suite.js', 'src/00_core.js', 'src/13_stats_core.js', 'src/20_m01_index.js', 'src/26_m07_paid.js', 'src/31_m12_metros.js']) {
  try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e) { if (f === 'src/26_m07_paid.js') { /* the paid module needs more of the page; only its ZIP helpers matter here */ } else throw e; }
}
const run = code => vm.runInContext(code, ctx);
const near = (a, b, tol, msg) => assert(typeof a === 'number' && Math.abs(a - b) <= tol, `${msg}: expected ${b} ± ${tol}, got ${a}`);
let n = 0; const t = (name, fn) => { fn(); n++; };

t('the composite reproduces the shipped index', () => {
  near(run('Math.max(...CTY.map(c => Math.abs(idxComposite(c, D.weights) - c.di)))'), 0, 1e-9, 'idxComposite with D.weights is c.di for every county');
  // a missing component drops its weight: a county without a law office is the mean of the other six
  const f = run("CTY.find(c => !isN(c.pct.supply)).fips");
  near(run(`(() => { const c = CI['${f}']; let s = 0, d = 0; ['filing','haz','sep','econ','struct','strain'].forEach(k => { s += D.weights[k] * c.pct[k]; d += D.weights[k]; }); return s / d - idxComposite(c, D.weights); })()`), 0, 1e-9, 'missing supply drops out');
  near(run(`(() => { const c = CI['48201']; const ks = Object.keys(c.pct).filter(k => isN(c.pct[k])); return idxEqual(c) - ks.reduce((a, k) => a + c.pct[k], 0) / ks.length; })()`), 0, 1e-9, 'equal weights is the plain mean of the percentiles');
  near(run(`(() => { const c = CI['48201']; const w = D.weights; let s = 0, d = 0; Object.keys(w).forEach(k => { if (k !== 'filing' && isN(c.pct[k])) { s += w[k] * c.pct[k]; d += w[k]; } }); return s / d - idxComposite(c, w, 'filing'); })()`), 0, 1e-9, 'the no filing composite reweights the rest');
  eq(run('idxComposite({ pct: {} }, D.weights)'), null, 'no component, no composite');
});

t('σ bars standardize each raw component', () => {
  const zs = JSON.parse(run('JSON.stringify(idxZStats(CTY))'));
  eq(Object.keys(zs).length, 7, 'seven components'); eq(zs.supply.n, run('CTY.filter(c => isN(c.comp_supply)).length'), 'supply over the counties with a law office');
  near(run('SEV_STATS.mean(CTY.map(c => idxZ(c, "haz", idxZStats(CTY))))'), 0, 1e-9, 'z scores center on zero');
  near(run('SEV_STATS.sd(CTY.map(c => idxZ(c, "sep", idxZStats(CTY))))'), 1, 1e-9, 'and have unit spread');
  // every component points the way its percentile does
  run("['filing','haz','sep','econ','struct','strain','supply']").forEach(k => assert(run(`SEV_STATS.spearman(CTY.map(c => idxZ(c, '${k}', idxZStats(CTY))), CTY.map(c => c.pct['${k}'])).rho`) > 0.99, k + ' z follows its percentile'));
  eq(run('idxZ({ comp_haz: null }, "haz", idxZStats(CTY))'), null, 'missing value, no bar');
  const bar = run('idxZbar("Separation 15%", "56 per 1k", 0.6)'); assert(/left:50\.0%/.test(bar) && /class="ix-zf up"/.test(bar) && /\+0\.6σ/.test(bar), 'a positive bar starts at the center');
  const neg = run('idxZbar("Supply gap 5%", "10 per office", -1.6)'); assert(/class="ix-zf dn"/.test(neg) && /−1\.6σ/.test(neg), 'a negative bar reads with a minus sign');
  assert(/n\/a/.test(run('idxZbar("x", "y", null)')), 'no data reads n/a');
});

t('thresholds and callouts', () => {
  const T = JSON.parse(run('JSON.stringify(idxThresholds(CTY))'));
  eq(T.n, run('CTY.filter(c => c.acs.married >= IDX_FLOOR).length'), 'cut points use the counties at or above the floor');
  near(T.sep, run('SEV_STATS.quantile(CTY.filter(c => c.acs.married >= IDX_FLOOR).map(c => c.acs.sep_per_1k_married), 0.9)'), 1e-9, '90th percentile of separation');
  // the wording: county level only, house style (no hyphen or dash between words), every county
  const all = run('CTY.map(c => idxNotes(c, idxThresholds(CTY)).map(x => x.title + " " + x.html).join(" ")).join(" ")');
  assert(all.length > 1000, 'notes are produced');
  assert(!/[–—]/.test(all) && !/[a-z]-[a-z]/i.test(all.replace(/<[^>]+>/g, '')), 'no hyphen or dash in the callouts');
  assert(!/\byour (spouse|marriage|husband|wife)\b|\byou are (married|separated|divorcing)\b|\bthis couple\b|\bthese couples\b/i.test(all), 'no callout speaks about a person or a couple');
  const small = run('idxNotes(CTY.find(c => c.acs.married < IDX_FLOOR), idxThresholds(CTY)).map(x => x.title)');
  assert(small.includes('A small married population') && !small.includes('Separated, not yet divorced'), 'a county under the floor gets the small population note and no threshold callouts');
  const imp = run('Object.keys(ST.imputed)[0]'); assert(run(`idxNotes(CI['${imp}'], idxThresholds(CTY)).some(x => x.title === 'Imputed filing months')`), 'imputed months are flagged');
});

t('the paid quadrant', () => {
  const q = run(`(() => { const op = pctScale(CTY.map(c => c.filings.ttm.priv)); const out = {}; CTY.forEach(c => { const r = idxQuad(c, op).q; out[r] = (out[r] || 0) + 1; }); return out; })()`);
  eq(q['No law office counted'], run('CTY.filter(c => !isN(c.pct.supply)).length'), 'no office, no quadrant');
  assert(['Prime', 'Niche', 'Contested', 'Thin'].every(k => q[k] > 0), 'all four quadrants occur');
  eq(run(`idxQuad({ pct: { supply: 60 }, filings: { ttm: { priv: 1 } } }, () => 0.7).q`), 'Prime', 'both at 50 or above');
  eq(run(`idxQuad({ pct: { supply: 60 }, filings: { ttm: { priv: 1 } } }, () => 0.2).q`), 'Niche', 'room only');
  eq(run(`idxQuad({ pct: { supply: 20 }, filings: { ttm: { priv: 1 } } }, () => 0.7).q`), 'Contested', 'opportunity only');
});

t('validation statistics', () => {
  const V = JSON.parse(run('JSON.stringify(idxValidate(CTY))'));
  const S = (x, y) => JSON.parse(run(`JSON.stringify(SEV_STATS.pearson(${x}, ${y}))`));
  near(V.eq.r, S('CTY.map(c => c.di)', 'CTY.map(idxEqual)').r, 1e-12, 'equal weights r'); eq(V.eq.n, 254, 'all counties');
  assert(V.eq.r > 0.9 && V.v.eq === 'holds', 'the ranking barely depends on the weights');
  eq(V.ab.length, run("CTY.filter(c => c.grade === 'A' || c.grade === 'B').length"), 'grade A and B counties');
  near(V.filing.r, S("CTY.filter(c => c.grade === 'A' || c.grade === 'B').map(c => idxComposite(c, D.weights, 'filing'))", "CTY.filter(c => c.grade === 'A' || c.grade === 'B').map(c => c.rates.div_per_1k_married)").r, 1e-12, 'held out filing r');
  assert(V.filing.r > 0.4 && V.filing.p < 0.001, 'the composite without filings tracks the filing rate: ' + V.filing.r);
  assert(V.diFiling.r > V.filing.r, 'the full index (which contains filings) correlates more, as it must');
  // the out of time sample: monthly reports, no gap, 50 or more filings in the base months
  eq(V.ytd.fips.length, run('CTY.filter(c => c.filings.ytd26 && c.filings.ytd25 && c.filings.ytd25.f_div >= 50 && !repGap(c)).length'), 'out of time sample');
  near(V.ytd.ch[0], run(`(() => { const c = CI['${V.ytd.fips[0]}']; return c.filings.ytd26.f_div / c.filings.ytd25.f_div - 1; })()`), 1e-12, 'year to date change');
  assert(Math.abs(V.ytd.di.r) < 0.3 && V.v.ytdDi === 'fails', 'the out of time test fails, and the module says so: r ' + V.ytd.di.r);
  assert(V.movers.length === 5 && V.movers.every(m => isFinite(m.from) && isFinite(m.to)), 'the five counties that move most under equal weights');
});

t('three counts of divorces', () => {
  const S = JSON.parse(run('JSON.stringify(idxSanity(CTY, true))'));
  eq(S.yr, run('Object.keys(ST.nchs.divorce).sort().pop()'), 'the latest NCHS year'); eq(S.oca.f, run(`ST.annual['${S.yr}'].f_div`), 'OCA filings that year');
  eq(S.persons, run('D.pums.div_ly_w'), 'survey persons'); near(S.pums, S.persons / 2, 1e-9, 'two spouses per divorce');
  near(S.nchs, run(`ST.nchs.divorce['${S.yr}'] * ST.acs.pop / 1000`), 1e-6, 'NCHS rate times the ACS population');
  assert(run(`ST.annual['${S.last}'].months`) === 12, 'the latest full calendar year');
  assert(S.oca.f > S.pums && S.pums > S.nchs, 'statewide, filings exceed the survey, which exceeds vital statistics');
  const M = JSON.parse(run(`JSON.stringify(idxSanity(MSA['26420'].counties.map(f => CI[f]), false))`));
  eq(M.oca.f, run(`sum(MSA['26420'].counties.map(f => (CI[f].filings.hist['${S.yr}'] || {}).div || 0))`), 'a metro adds its counties');
  near(M.persons, run(`sum(MSA['26420'].counties.map(f => CI[f].pools.div_ly_all_w || 0))`), 1e-9, 'and their survey pools');
});

t('the county layer catalog', () => {
  const keys = run('Object.keys(LAYERS_CTY)'); assert(keys.includes('di') && keys.includes('yoy') && keys.includes('di_eq') && keys.includes('di_nf'), 'the index, its variants and the change layers');
  run('Object.keys(LAYERS_CTY)').forEach(k => { const ok = run(`(() => { const L = LAYERS_CTY['${k}']; return IDX_GROUPS.includes(L.grp) && /^[ABCD]$/.test(L.g) && L.note.length > 10 && !/[–—]/.test(L.note + L.l) && CTY.every(c => { const v = L.v(c); return v == null || isN(v); }) && typeof L.f(1) === 'string'; })()`); assert(ok, 'layer ' + k + ' is complete and reads every county'); });
  const opts = run('idxLayerOptions(Object.keys(LAYERS_CTY), "di")'); eq((opts.match(/<optgroup/g) || []).length, run('new Set(Object.values(LAYERS_CTY).map(L => L.grp)).size'), 'one option group per group'); assert(/value="di" selected/.test(opts), 'the current layer is selected');
  assert(/right end of the ramp/.test(run('idxLegendNote(LAYERS_CTY.di)')) && /green end/.test(run('idxLegendNote(LAYERS_CTY.yoy)')), 'legend notes give the direction');
  const di = JSON.parse(run('JSON.stringify(layerScale(LAYERS_CTY.di_eq, CTY).legend)')); eq([di.min, di.max], ['0', '100'], 'the equal weight index is a percentile layer');
});

t('the metro layer catalog and the metro summary', () => {
  run('Object.keys(MT_LAYERS)').forEach(k => { const ok = run(`(() => { const L = MT_LAYERS['${k}']; return MT_GROUPS.includes(L.grp) && /^[ABCD]$/.test(L.g) && /^[ABCD]$/.test(L.cg) && typeof L.c === 'function' && L.note && !/[–—]/.test(L.note + L.l) && CTY.every(c => { const v = L.c(c); return v == null || isN(v); }) && (!L.z || ZC.every(z => { const v = L.z(z); return v == null || isN(v); })); })()`); assert(ok, 'metro layer ' + k + ' is complete'); });
  assert(run("['yoy','esi','urchg','c19','fv'].every(k => !MT_LAYERS[k].z)"), 'county only layers have no ZIP reader');
  assert(run("Object.values(MT_LAYERS).filter(L => L.z && /alloc/.test(String(L.z))).every(L => L.g === 'C')"), 'ZIP allocations are grade C');
  const S = run(`(() => { const s = metroSummary(['19100']); return { moe: s.marriedMoe, m: s.married, n: s.cs.length }; })()`);
  near(S.moe, run(`Math.sqrt(sum(MSA['19100'].counties.map(f => { const c = CI[f]; return (1.645 * c.acs.married_cv * c.acs.married) ** 2; })))`), 1e-6, 'the metro margin is the root of the summed squared county margins');
  assert(S.moe > 0 && S.moe < S.m * 0.05, 'and small against the total');
});

t('map helpers', () => {
  const b = run(`ixBox([GEO.state.county['48201']], GEO.state.W, GEO.state.H)`); near(b[2] / b[3], run('GEO.state.W / GEO.state.H'), 1e-9, 'the box keeps the map shape');
  const p = run(`ixPlace('state')('', '48201')`); eq(p.map(v => +v.toFixed(3)), run(`GEO.state.cent['48201']`).map(v => +v.toFixed(3)), 'a county office sits at the county center on the state map');
  const mz = run(`ixPlace('19100')('75024', '')`); assert(Array.isArray(mz) && mz.length === 2, 'a ZIP office sits on its metro map');
  eq(run(`ixPlace('19100')('77002', '48201')`), null, 'an office outside the metro is not placed');
  eq(run('ixFirmPins(ixPlace("state")).length'), 0, 'no firm profile and no roster, no pins');
});

console.log(`index tests: ${n} groups passed`);
