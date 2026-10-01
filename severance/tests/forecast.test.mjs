/* Filings Forecast: SEV_HAZ (src/12_hazard_core.js) and FC_SUPPORT (src/45_m26_forecast.js).
   The real suite data, core and kit run in a vm context with a stubbed DOM; a synthetic hazard checks the arithmetic exactly. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assert, eq } from './lib/mock.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function pageContext() {
  const node = () => ({ style: {}, dataset: {}, classList: { add() { }, remove() { }, toggle() { } }, setAttribute() { }, appendChild() { }, addEventListener() { }, querySelector: () => null, querySelectorAll: () => [] });
  const ls = new Map();
  const ctx = { console, URL, URLSearchParams, TextEncoder, TextDecoder, setTimeout, clearTimeout, Intl, Blob,
    document: { createElement: node, body: node(), documentElement: node(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() { }, removeEventListener() { }, activeElement: null },
    addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { }, addListener() { } }), performance: globalThis.performance, ResizeObserver: class { observe() { } unobserve() { } disconnect() { } }, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout, innerWidth: 1400, innerHeight: 900, scrollX: 0, scrollY: 0, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    navigator: { userAgent: 'node' }, location: { hash: '' }, history: { replaceState() { }, pushState() { } } };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['data/suite.js', 'src/00_core.js', 'src/01_kit.js', 'src/12_hazard_core.js', 'src/45_m26_forecast.js']) vm.runInContext(read(f), ctx, { filename: f });
  return { ctx, run: code => vm.runInContext(code, ctx) };
}
const P = pageContext();
const H = P.run('SEV_HAZ'), D = P.run('D'), S = P.run('FC_SUPPORT'), MODI = P.run('MODI'), CTY = P.run('CTY');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: expected ${b} ± ${tol}, got ${a}`);
const sum = a => a.reduce((x, y) => x + y, 0);
let n = 0; const ok = () => { n++; };

/* ---------------- the curve from the data ---------------- */
const cv = H.curve(); const raw = D.pums.curve.slice().sort((a, b) => a.dur - b.dur); const G = D.pums.groups;
eq(cv.length, 42, 'durations 0 to 40 plus the open bucket'); eq(H.MAXD, 41, 'open bucket index');
raw.forEach(r => { near(cv[r.dur].raw, r.haz_per_1000, 1e-9, 'raw hazard kept at ' + r.dur); near(cv[r.dur].rawSe, r.se, 1e-9, 'raw se kept at ' + r.dur); eq(cv[r.dur].n, r.n, 'sample count at ' + r.dur); });
// three year centered average and the standard error of a mean
near(cv[10].h, (raw[9].haz_per_1000 + raw[10].haz_per_1000 + raw[11].haz_per_1000) / 3, 1e-9, 'smoothing in the middle');
near(cv[0].h, (raw[0].haz_per_1000 + raw[1].haz_per_1000) / 2, 1e-9, 'smoothing at the start uses the years that exist');
near(cv[10].se, Math.sqrt(raw[9].se ** 2 + raw[10].se ** 2 + raw[11].se ** 2) / 3, 1e-9, 'standard error of the smoothed value');
// the open bucket with the published single years reproduces the 30 plus group (sample weighted)
const n30 = sum(raw.filter(r => r.dur >= 30).map(r => r.n)); const tot30 = sum(raw.filter(r => r.dur >= 30).map(r => r.n * r.haz_per_1000)) + cv[41].n * cv[41].h;
near(tot30 / (n30 + cv[41].n), G['dur_30+'].haz, 1e-6, 'open bucket closes the 30 plus group'); eq(cv[41].n, G['dur_30+'].n - n30, 'open bucket sample');
assert(cv[41].h > 0 && cv[41].h < G['dur_30+'].haz, 'open bucket hazard below the 30 plus average'); ok();
// hazard, next 12 months, survival
near(H.hazard(7), cv[7].h, 1e-12, 'hazard at 7'); near(H.hazard(60), cv[41].h, 1e-12, 'beyond 41 uses the open bucket'); near(H.hazard(7, 0.5), cv[7].h / 2, 1e-12, 'multiplier');
near(H.hazardNext12(5), cv[5].h / 1000, 1e-12, 'next 12 months is the hazard over 1,000');
eq(H.survival(0), 1, 'survival at the wedding'); let s = 1; for (let d = 0; d < 10; d++) s *= 1 - cv[d].h / 1000; near(H.survival(10), s, 1e-12, 'survival to 10 years');
near(H.survival(12, 5), H.survival(12) / H.survival(5), 1e-12, 'conditional survival');
for (let d = 1; d < 60; d++) assert(H.survival(d) < H.survival(d - 1), 'survival falls at ' + d); ok();
// the stock shape: sums to one, reproduces the published average hazard and the median duration module 03 states (17.6 years)
const sh = H.shape(); near(sum(sh), 1, 1e-9, 'shape sums to one');
near(sum(sh.map((x, d) => x * H.hazard(d))), G.all.haz, 0.3, 'shape times curve is the published average hazard');
const med = H.medianDuration(); assert(med > 15 && med < 20, 'median years married near 17.6: ' + med);
const mtd = H.medianToDivorce(); assert(mtd > 40 && mtd < 120, 'half of a cohort divorced only after 40 years at these hazards: ' + mtd);
// group weights become the shape: years 5 to 9 carry the dur_5-9 weight share
near(sum(sh.slice(5, 10)), G['dur_5-9'].w / sum(['dur_0-1', 'dur_2-4', 'dur_5-9', 'dur_10-14', 'dur_15-19', 'dur_20-29', 'dur_30+'].map(k => G[k].w)), 1e-9, 'group weight share'); ok();
// an area's stock: sums to married, respects its buckets
const harris = CTY.find(c => c.fips === '48201'); const stk = H.stock(harris.acs.married, harris.risk);
near(sum(stk), harris.acs.married, 1e-6, 'stock sums to married');
const bt = harris.risk.dur_lt5 + harris.risk.dur_5_9 + harris.risk.dur_10_19 + harris.risk.dur_20p;
near(sum(stk.slice(0, 5)) / harris.acs.married, harris.risk.dur_lt5 / bt, 1e-9, 'under 5 bucket'); near(sum(stk.slice(20)) / harris.acs.married, harris.risk.dur_20p / bt, 1e-9, '20 plus bucket');
near(sum(H.stock(1000, null).map((x, d) => x - 1000 * sh[d])), 0, 1e-9, 'no buckets gives the statewide shape'); eq(sum(H.stock(0, harris.risk)), 0, 'empty stock'); ok();

/* ---------------- expected(): the ageing arithmetic ---------------- */
const one = new Array(42).fill(0); one[0] = 1000;
let e = H.expected(one, 3, 'fit', { H: new Array(42).fill(0) }); eq(e.map(r => Math.round(r.married)), [1000, 1000, 1000, 1000], 'no hazard, no exits: the stock holds'); eq(e[3].persons, 0, 'no divorces');
const flat = new Array(42).fill(10);
e = H.expected(one, 2, 'fit', { H: flat }); near(e[0].persons, 10, 1e-9, 'divorcing adults'); near(e[0].divorces, 5, 1e-9, 'marriages ending are adults over two'); near(e[1].married, 990, 1e-9, 'survivors move up'); near(e[2].married, 980.1, 1e-9, 'second year');
e = H.expected(one, 2, 'fit', { H: flat, exits: 0.01, inflow: 100, growth: 0.1 }); near(e[1].married, 1000 * 0.99 * 0.99 + 110, 1e-9, 'exits and inflow with growth'); near(e[2].married, (1000 * 0.99 * 0.99 + 110) * 0.99 * 0.99 + 121, 1e-9, 'inflow compounds');
// the scenario's hazard multiplier applies after the base year
const sc = { hazMult: y => y === 2026 ? 0.5 : 1, fileMult: () => 1 };
e = H.expected(one, 1, sc, { H: flat, base: 2025 }); near(e[0].persons, 10, 1e-9, 'base year at the fitted hazard'); near(e[1].persons, 990 * 0.005, 1e-9, 'next year at half'); ok();

/* ---------------- forecast(): calibration, lines, pipeline ---------------- */
const area = { married: 100000, buckets: { dur_lt5: 0.2, dur_5_9: 0.15, dur_10_19: 0.25, dur_20p: 0.4 }, marLy: 0.04, growth: 0.02, obs: { div: 1000, div_k: 400, sapcr: 100, po: 50, mod: 200, enf: 60, adopt: 20, cps: 10, ivd: 80 }, hist: { 2019: { div_k: 380, sapcr: 90 }, 2020: { div_k: 380, sapcr: 90 }, 2021: { div_k: 390, sapcr: 95 }, 2022: { div_k: 395, sapcr: 95 }, 2023: { div_k: 400, sapcr: 100 }, 2024: { div_k: 400, sapcr: 100 }, 2025: { div_k: 400, sapcr: 100 } } };
const f = H.forecast(area, { scenario: 'fit' });
eq(f.years, [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035], 'years'); eq(f.lines.div[0], 1000, 'base year is the observed count');
near(f.capture, 1000 / f.modeled[0], 1e-9, 'capture is filed over modeled'); near(f.lines.div[3], f.modeled[3] * f.capture, 1e-9, 'forecast is modeled times capture');
near(f.married[1], 100000 * 1.02, 1e-6, 'exits solved so the stock grows with the population');
near(f.lines.div_k[5] / f.lines.div[5], 0.4, 1e-12, 'share with children held'); near(f.lines.div_nk[5] + f.lines.div_k[5], f.lines.div[5], 1e-9, 'with and without children add up');
eq(f.lines.sapcr, new Array(11).fill(100), 'custody held as fitted'); eq(f.lines.ivd[7], 80, 'IV-D held');
const K = y => y < 2025 ? area.hist[y].div_k + area.hist[y].sapcr : f.lines.div_k[y - 2025] + f.lines.sapcr[y - 2025];
const pipe = y => sum([1, 2, 3, 4, 5].map(j => K(y - j)));
near(f.lines.mod[0], 200, 1e-9, 'modification base'); near(f.lines.mod[1], 200 * pipe(2026) / pipe(2025), 1e-9, 'modification follows the five year order pipeline'); near(f.lines.enf[6], 60 * pipe(2031) / pipe(2025), 1e-9, 'enforcement too');
near(f.modsDue, sum([2023, 2024, 2025, 2026, 2027].map(K)), 1e-9, 'orders reaching three years in 2026 to 2030');
// held stock and no new marriages
const fh = H.forecast(Object.assign({}, area, { growth: 0 }), { scenario: 'fit' }); near(fh.married[1], 100000, 1e-6, 'stock held at today\'s size');
const fc = H.forecast(Object.assign({}, area, { growth: 0 }), { scenario: 'fit', newMarriages: false }); assert(fc.married[10] < fc.married[0] * 0.8 && fc.lines.div[10] < fc.lines.div[1], 'today\'s marriages only falls');
// an area that filed nothing takes the fallback ratio; its base year stays the observed zero
const fz = H.forecast(Object.assign({}, area, { obs: { div: 0 } }), { scenario: 'fit', capture: 1.5 }); eq(fz.captureSource, 'fallback', 'fallback source'); eq(fz.lines.div[0], 0, 'observed zero kept'); near(fz.lines.div[1], fz.modeled[1] * 1.5, 1e-9, 'fallback ratio after the base'); ok();

/* ---------------- scenarios ---------------- */
eq(Object.keys(H.SCENARIOS), ['fit', 'decline', 'recession'], 'three scenarios'); eq(['fit', 'decline', 'recession'].map(k => H.SCENARIOS[k].grade), ['B', 'C', 'C'], 'scenario grades');
// the NCHS trend: ordinary least squares on log rates
const nd = D.state.nchs.divorce; const ys = Object.keys(nd).map(Number).filter(y => y >= 2000 && y <= 2019); const lx = ys.map(y => Math.log(nd[y]));
const mx = sum(ys) / ys.length, my = sum(lx) / lx.length; const b = sum(ys.map((x, i) => (x - mx) * (lx[i] - my))) / sum(ys.map(x => (x - mx) ** 2));
near(H.declineRate(2000, 2019), Math.exp(b) - 1, 1e-12, 'decline rate is the log linear slope'); assert(H.declineRate(2000, 2019) < 0, 'Texas divorce rate fell 2000 to 2019'); eq(H.declineRate(2030, 2040), 0, 'no data, no trend');
near(H.SCENARIOS.decline.hazMult(2025, {}), 1, 1e-12, 'decline starts after the base'); near(H.SCENARIOS.decline.hazMult(2027, {}), (1 + H.declineRate(2000, 2019)) ** 2, 1e-12, 'decline compounds');
const fd = H.forecast(area, { scenario: 'decline', params: { from: 2000, to: 2019 } }); assert(fd.lines.div[10] < f.lines.div[10], 'decline lowers 2035'); eq(fd.lines.div[0], 1000, 'decline shares the base');
// the recession: lag coefficients summed while the surge is inside each lag, averaged as exp over the months
const m = D.panel['ldiv|claims_0_12'].coefs; const lag = Object.entries(m).map(([k, c]) => ({ l: k === 'lclaims' ? 0 : +k.split('_l')[1], b: c.coef }));
const yr = yi => { let t = 0; for (let mm = 0; mm < 12; mm++) { const mo = yi * 12 + mm; let ef = 0; lag.forEach(x => { const s2 = mo - x.l; if (s2 >= 0 && s2 < 12) ef += x.b * Math.log(2); }); t += Math.exp(ef); } return t / 12; };
const rd = H.recession('div', { surge: 1, months: 12, start: 2027 }); near(rd[2027], yr(0), 1e-12, 'recession 2027'); near(rd[2028], yr(1), 1e-12, 'recession 2028 through the 12 month lag'); eq(rd[2029], undefined, 'no effect after the lags');
assert(rd[2027] < 1, 'the panel says divorce filings dip in the surge year'); eq(H.recession('adopt', {}), {}, 'no panel model, no effect');
const r0 = H.recession('div', { surge: 0 }); Object.values(r0).forEach(v => near(v, 1, 1e-12, 'zero surge'));
assert(H.recession('div', { panel: 'post2022' })[2027] !== rd[2027], 'the post 2022 fit differs'); assert(Object.keys(H.recession('mod', {})).length && Object.keys(H.recession('enf', {})).length, 'modification and enforcement have panel models');
const fr = H.forecast(area, { scenario: 'recession' }); near(fr.lines.div[2], f.lines.div[2] * rd[2027], 1e-9, 'recession multiplies 2027 divorce filings'); near(fr.lines.po[2], 50 * H.recession('po', {})[2027], 1e-9, 'and protective orders'); near(fr.lines.div[1], f.lines.div[1], 1e-9, '2026 untouched'); near(fr.married[5], f.married[5], 1e-6, 'the stock is not changed'); ok();

/* ---------------- the band ---------------- */
const fg = H.forecast(area, { scenario: 'fit', grad: true }); const bnd = H.band(fg.grad.div);
eq(bnd.length, 11, 'band per year'); near(bnd[0].hi, 0, 1e-6, 'no band in the calibration year'); assert(bnd[10].hi > 0 && bnd[10].hi < 0.05 * fg.lines.div[10], 'a narrow positive band by 2035: ' + bnd[10].hi);
const se = H.se(); const manual = 1.645 * Math.sqrt(sum(fg.grad.div[10].map((g, d) => (g * se[d]) ** 2))); near(bnd[10].hi, manual, 1e-9, 'band is 1.645 times the delta method sd');
eq(H.band([new Array(42).fill(0)])[0].hi, 0, 'zero gradient, zero band'); near(H.band([new Array(42).fill(1)], 1)[0].hi, Math.sqrt(sum(se.map(x => x * x))), 1e-9, 'z of one'); ok();

/* ---------------- a synthetic instance ---------------- */
const curve = Array.from({ length: 41 }, (_, d) => ({ dur: d, haz_per_1000: 10, se: 1, n: 100 }));
const groups = { 'dur_0-1': { w: 2, haz: 10, se: 1, n: 200 }, 'dur_2-4': { w: 3, haz: 10, se: 1, n: 300 }, 'dur_5-9': { w: 5, haz: 10, se: 1, n: 500 }, 'dur_10-14': { w: 5, haz: 10, se: 1, n: 500 }, 'dur_15-19': { w: 5, haz: 10, se: 1, n: 500 }, 'dur_20-29': { w: 10, haz: 10, se: 1, n: 1000 }, 'dur_30+': { w: 20, haz: 10, se: 1, n: 2100 } };
const Hs = H.make({ curve, groups }, { divorce: { 2000: 4, 2001: 4 * 0.98, 2002: 4 * 0.98 ** 2, 2003: 4 * 0.98 ** 3 } }, null);
near(Hs.hazard(3), 10, 1e-12, 'flat curve'); near(Hs.hazard(41), 10, 1e-9, 'flat open bucket'); near(Hs.survival(20), 0.99 ** 20, 1e-12, 'survival of a flat hazard');
near(Hs.medianToDivorce(), 68 + (0.99 ** 68 - 0.5) / (0.99 ** 68 - 0.99 ** 69), 1e-9, 'median to divorce interpolated'); near(Hs.declineRate(2000, 2003), -0.02, 1e-12, 'a 2% decline recovered');
near(sum(Hs.shape()), 1, 1e-12, 'synthetic shape'); near(Hs.shape()[41], 20 / 50 * 1000 / 2100, 1e-12, 'open bucket weight from the 30 plus remainder'); eq(Hs.recession('div', {}), {}, 'no panel data, no recession'); ok();

/* ---------------- the child support check ---------------- */
eq(S.capOn('2025-09-01').cap, 11700, 'cap from Sep 1, 2025'); eq(S.capOn('2025-08-31').cap, 9200, 'the day before'); eq(S.capOn('2019-09-01').cap, 9200, '2019 cap'); eq(S.capOn('2013-09-01').cap, 8550, '2013 cap'); eq(S.capOn('2007-09-01').cap, 7500, '2007 cap'); eq(S.capOn('2007-08-31'), null, 'no cap before 2007 in this tool');
// the maximum guideline at the cap for one to five children
eq([1, 2, 3, 4, 5].map(k => S.guideline(20000, k, '2026-01-01').amount), [2340, 2925, 3510, 4095, 4680], 'maximum guideline support at the $11,700 cap');
const g6 = S.guideline(20000, 6, '2026-01-01'); eq([g6.amount, g6.atLeast, g6.above], [4680, true, true], 'six or more: not less than five');
eq(S.guideline(5000, 1, '2026-01-01').amount, 1000, 'one child 20%'); eq(S.guideline(6000, 2, '2022-05-02').amount, 1500, 'two children 25%');
const low = S.guideline(900, 1, '2026-01-01'); eq([low.pct, low.amount, low.low], [15, 135, true], 'low income schedule below $1,000');
eq(S.guideline(900, 1, '2020-01-01').ok, false, 'low income before Sep 1, 2021 not computed'); eq(S.guideline(1000, 1, '2020-01-01').amount, 200, '$1,000 is not low income');
eq(S.guideline(10000, 2, '2020-01-01').amount, 2300, 'the $9,200 cap applies in 2020'); eq(S.addYears('2024-02-29', 3), '2027-02-28', 'leap day');
const base = { orderDate: '2022-05-02', kids: 2, other: 0, netThen: 6000, netNow: 8500, ordered: '', agreed: false, today: '2026-10-01' };
let c = S.check(base); eq([c.status, c.then.amount, c.now.amount, c.diff, c.threeYears, c.timeOk], ['met', 1500, 2125, 625, '2025-05-02', true], 'three year test met');
eq(S.check(Object.assign({}, base, { orderDate: '2024-01-10' })).status, 'not_yet', 'under three years'); eq(S.check(Object.assign({}, base, { orderDate: '2023-10-01' })).status, 'met', 'exactly three years');
eq(S.check(Object.assign({}, base, { orderDate: '2023-10-02' })).status, 'not_yet', 'a day short');
eq(S.check(Object.assign({}, base, { netNow: 6200 })).status, 'below', '$50 and 3% is below both');
c = S.check(Object.assign({}, base, { ordered: 1000, netNow: 4600 })); eq([c.diff, c.status], [150, 'met'], '$150 is at least $100 though only 15%');
c = S.check(Object.assign({}, base, { ordered: 400, netNow: 1960 })); eq([Math.round(c.diff), c.big, c.status], [90, true, 'met'], 'under $100 but at least 20%');
c = S.check(Object.assign({}, base, { ordered: 300, netNow: 1400 })); eq([c.diff, c.big, c.status], [50, false, 'below'], '$50 and 17% is below both');
eq(S.check(Object.assign({}, base, { agreed: true })).status, 'agreed', 'agreed amount: material change route only');
c = S.check(Object.assign({}, base, { other: 1 })); eq(c.status, 'not_computed', 'multiple households not computed'); assert(/154\.129/.test(c.why), 'says which section');
eq(S.check(Object.assign({}, base, { orderDate: '' })).status, 'input', 'no date'); eq(S.check(Object.assign({}, base, { orderDate: '2027-01-01' })).status, 'input', 'future date'); eq(S.check(Object.assign({}, base, { kids: 0 })).status, 'input', 'no children');
eq(S.check(Object.assign({}, base, { orderDate: '2005-06-01' })).status, 'not_computed', 'before 2007 with no amount'); eq(S.check(Object.assign({}, base, { orderDate: '2005-06-01', ordered: 900 })).status, 'met', 'before 2007 with the amount entered'); ok();

/* ---------------- the module registers ---------------- */
assert(MODI.forecast && MODI.forecast.num === '26' && MODI.forecast.title === 'Filings Forecast' && typeof MODI.forecast.mount === 'function', 'module 26 registered'); ok();
console.log(`forecast: ${n} groups of checks passed`);
