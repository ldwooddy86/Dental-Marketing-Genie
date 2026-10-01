/* Module 28 Ground Truth (src/47_m28_ground.js): the logic that carries numbers. Distances from the projected ZIP and county centers,
   the weighted mean, survey margins and grades, the county grade rule, modeled divorces and court capture, the city rollup, the
   settlement classes and the gradient, legal deserts, local Moran hot spots, the same months filing record, where the year stands,
   headline figures by area, the layer table and the reference tables. Runs the real data and scripts in a vm context with a stubbed DOM. */
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
  addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false, addEventListener() { } }), performance: globalThis.performance, ResizeObserver: class { observe() { } unobserve() { } disconnect() { } }, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout, innerWidth: 1400, innerHeight: 900, scrollX: 0, scrollY: 0, getComputedStyle: () => ({ getPropertyValue: () => '' }),
  localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
  navigator: { userAgent: 'node' }, location: { hash: '' }, history: { replaceState() { } } };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data/suite.js', 'src/00_core.js', 'src/47_m28_ground.js']) vm.runInContext(read(f), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);
const J = code => JSON.parse(run(`JSON.stringify(${code})`));
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tolerance ${tol})`);

/* the module registers under its key and number */
assert(run(`MODI.ground && MODI.ground.num === '28' && typeof MODI.ground.mount === 'function'`), 'module 28 registered');

/* distances: haversine on known points; ZIP and county centers go back to degrees inside Texas */
near(run(`GROUND.km([-97.7431, 30.2672], [-96.7970, 32.7767])`), 293, 4, 'Austin to Dallas, km');
eq(run(`GROUND.km(null, [0, 0])`), null, 'no point, no distance');
const ll = J(`GROUND.zipLL(ZI['75201'])`); assert(ll[0] > -96.85 && ll[0] < -96.75 && ll[1] > 32.75 && ll[1] < 32.82, 'downtown Dallas ZIP center ' + ll);
const hll = J(`GROUND.ctyLL('48201')`); assert(hll[0] > -95.7 && hll[0] < -95.0 && hll[1] > 29.6 && hll[1] < 30.1, 'Harris County center ' + hll);
// the same county drawn on the state map and on its metro map lands within a few km either way
near(run(`GROUND.km(GROUND.ctyLL('48113'), (() => { const M = GEO.metros['19100']; const c = M.ccent['48113']; const b = M.bounds; return [b[0] + c[0] / M.W * (b[2] - b[0]), b[3] - c[1] / M.H * (b[3] - b[1])]; })())`), 0, 8, 'state and metro projections agree on Dallas County');
eq(run(`GROUND.dist(10)`), '10.0 km (6.2 mi)', 'distance label in km and miles');
eq(run(`GROUND.dist(null)`), 'n/a', 'no distance reads n/a');

/* weighted mean: skips missing values and zero weights */
near(run(`GROUND.wmean([{v: 10, w: 1}, {v: 20, w: 3}, {v: null, w: 5}, {v: 99, w: 0}], r => r.v, r => r.w)`), 17.5, 1e-9, 'weighted mean');
eq(run(`GROUND.wmean([], r => r.v, r => r.w)`), null, 'empty weighted mean');
// the married weighted mean of a rate is the ratio of the sums
const core = J(`GROUND.gradient().find(r => r.k === 'core')`);
near(core.rate, run(`(() => { const cs = CTY.filter(c => GROUND.settle(c) === 'core'); return sum(cs.map(c => c.rates.div_per_1k_married * c.acs.married)) / sum(cs.map(c => c.acs.married)); })()`), 1e-9, 'core filing rate');

/* survey margins: SE = CV x estimate, MOE = 1.645 SE; grades by CV; separated rows one step below */
near(run(`GROUND.moe90(10000, 0.05)`), 822.5, 1e-9, 'MOE at 90%');
eq(run(`GROUND.acsSE(100, null)`), null, 'no CV, no SE');
eq(J(`[0.01, 0.05, 0.099, 0.15, 0.3, null].map(GROUND.cvGrade)`), ['A', 'B', 'B', 'C', 'D', null], 'CV grades');
eq(J(`['A', 'B', 'C', 'D', null].map(GROUND.stepDown)`), ['B', 'C', 'D', 'D', null], 'one step down');

/* the county grade rule (module 20) reproduces every grade in the data */
eq(run(`CTY.filter(c => GROUND.gradeRule(c) === c.grade).length`), 254, 'grade rule reproduces 254 grades');

/* modeled divorces and capture */
const and = J(`[GROUND.modeled(CI['48001']), GROUND.capture(CI['48001']), CI['48001'].risk.haz_pred * CI['48001'].acs.married / 1000 / 2, CI['48001'].filings.ttm.div]`);
near(and[0], and[2], 1e-9, 'modeled divorces = hazard x married / 1000 / 2 (two spouses per divorce)'); near(and[1], and[3] / and[2], 1e-9, 'capture = filed / modeled');
eq(run(`GROUND.capture({ filings: { ttm: { div: 5 } }, risk: { haz_pred: null }, acs: { married: 100 } })`), null, 'no hazard, no capture');

/* city rollup: sums and married weighted means on a synthetic set, then on the data */
const roll = J(`GROUND.cityRollup([
  { zip: '1', msa: 'M', county: 'A', city: 'Town', acs: { married: 100, pop: 300 }, alloc: { div: 2, priv: 4, sapcr: 1 }, lawoffices: 1, di: 40, risk: { haz_pred: 10 } },
  { zip: '2', msa: 'M', county: 'B', city: 'Town', acs: { married: 300, pop: 700 }, alloc: { div: 6, priv: 8, sapcr: 0 }, lawoffices: 0, di: 80, risk: { haz_pred: 20 } },
  { zip: '3', msa: 'N', county: 'C', city: 'Town', acs: { married: 50, pop: 90 }, alloc: { div: 1, priv: 1, sapcr: 0 }, lawoffices: 0, di: null, risk: { haz_pred: null } },
  { zip: '4', msa: 'M', county: 'A', city: null, acs: { married: 0, pop: 10 }, alloc: { div: 0, priv: 0, sapcr: 0 }, lawoffices: 0, di: 50, risk: { haz_pred: 5 } }])`);
eq(roll.length, 3, 'same name in two metros is two cities; no name is its own group');
const town = roll.find(c => c.key === 'M|Town');
eq([town.n, town.married, town.div, town.priv, town.offices, town.county, town.counties], [2, 400, 8, 12, 1, 'B', ['B', 'A']], 'city sums and primary county');
near(town.di, 70, 1e-9, 'index weighted by married adults'); near(town.haz, 17.5, 1e-9, 'hazard weighted by married adults'); near(town.fpo, 12, 1e-9, 'private filings per office'); near(town.divRate, 20, 1e-9, 'allocated divorces per 1,000 married');
eq(roll.find(c => c.key === 'N|Town').di, null, 'no weight, no index');
eq(roll.find(c => c.key === 'M|No city name').di, null, 'zero married adults carry no weight');
const cities = J(`(() => { const r = GROUND.cityRollup(ZC); return { n: r.length, zips: sum(r.map(c => c.n)), married: sum(r.map(c => c.married)), offices: sum(r.map(c => c.offices)), div: sum(r.map(c => c.div)), hou: r.find(c => c.key === '26420|Houston') }; })()`);
eq(cities.zips, run('ZC.length'), 'every ZIP lands in one city');
eq(cities.married, run('sum(ZC.map(z => z.acs.married))'), 'married adults add up'); eq(cities.offices, run('sum(ZC.map(z => z.lawoffices || 0))'), 'law offices add up');
near(cities.div, run('sum(ZC.map(z => z.alloc.div || 0))'), 1e-6, 'allocated divorces add up');
assert(cities.hou && cities.hou.county === '48201' && cities.hou.n > 50, 'Houston sits in Harris County');

/* settlement classes and the gradient */
eq(J(`CTY.filter(c => GROUND.settle(c) === 'core').map(c => c.name).sort()`), ['Bexar', 'Dallas', 'Harris', 'Tarrant', 'Travis'], 'core counties');
eq(run(`GROUND.settle(CI['48085'])`), 'ring', 'Collin is suburban ring'); eq(run(`GROUND.settle(CI['48001'])`), 'rural', 'Anderson is non metro'); eq(run(`GROUND.settle(CI['48441'])`), 'small', 'Taylor (Abilene) is a small metro');
const gr = J(`GROUND.gradient()`);
eq(gr.map(r => r.k), ['core', 'ring', 'small', 'rural'], 'gradient classes in order'); eq(gr.reduce((a, r) => a + r.n, 0), 254, 'every county in a class');
eq(gr.reduce((a, r) => a + r.noOffice, 0), run(`CTY.filter(c => !(c.rates.lawoffices > 0)).length`), 'counties with no office add up');
assert(gr.every(r => ['rate', 'sep', 'haz', 'kids', 'esi', 'off10k', 'fpo'].every(k => typeof r[k] === 'number' && isFinite(r[k]))), 'every gradient measure is a number');

/* legal deserts: married 1,500 or more and no office; nearest office ZIP is the true minimum */
const des = J(`GROUND.deserts(ZC, 1500).map(d => ({ zip: d.z.zip, m: d.z.acs.married, off: d.z.lawoffices, near: d.near && d.near.zip, km: d.km }))`);
eq(des.length, run(`ZC.filter(z => z.acs.married >= 1500 && !(z.lawoffices > 0)).length`), 'desert count');
assert(des.every(d => d.m >= 1500 && !(d.off > 0) && d.near && d.km > 0), 'every desert has a nearest office ZIP');
assert(des.every((d, i) => i === 0 || des[i - 1].m >= d.m), 'largest first');
const d0 = des[0]; near(d0.km, run(`Math.min(...ZC.filter(z => z.lawoffices > 0).map(z => GROUND.km(GROUND.zipLL(ZI['${d0.zip}']), GROUND.zipLL(z))))`), 1e-9, 'nearest is the minimum distance');
eq(run(`GROUND.deserts(ZC, 1e9).length`), 0, 'a higher floor finds none');
const bare = J(`GROUND.bareCounties().map(d => [d.c.fips, d.near && d.near.fips, d.km])`);
eq(bare.length, run(`CTY.filter(c => !(c.rates.lawoffices > 0)).length`), 'counties with no office'); assert(bare.every(b => b[1] && run(`CI['${b[1]}'].rates.lawoffices > 0`) && b[2] > 0 && b[2] < 400), 'nearest county with an office');

/* local Moran: a planted cluster is found, the result is repeatable, and too few points return nothing */
const grid = []; for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) grid.push({ id: x + ',' + y, x, y, v: (x < 3 && y < 3) ? 100 : ((x * 7 + y * 13) % 5) });
ctx.__grid = grid;
const lm = J(`GROUND.localMoran(__grid, g => g.v, g => [g.x, g.y], { k: 6, perms: 199, seed: 7 }).filter(r => r.sig && r.quad === 'HH').map(r => r.it.id).sort()`);
assert(lm.includes('1,1') && lm.every(id => { const [x, y] = id.split(',').map(Number); return x < 4 && y < 4; }), 'planted high cluster found ' + lm);
eq(J(`GROUND.localMoran(__grid, g => g.v, g => [g.x, g.y], { perms: 99, seed: 3 }).map(r => r.p)`), J(`GROUND.localMoran(__grid, g => g.v, g => [g.x, g.y], { perms: 99, seed: 3 }).map(r => r.p)`), 'seeded permutations repeat');
eq(run(`GROUND.localMoran(__grid.slice(0, 5), g => g.v, g => [g.x, g.y]).length`), 0, 'too few points');
eq(run(`GROUND.localMoran(__grid.map(g => ({ x: g.x, y: g.y, v: 3 })), g => g.v, g => [g.x, g.y]).length`), 0, 'no variance, no test');
const ps = J(`GROUND.hotCounties().map(r => r.p)`); assert(ps.length === 254 && ps.every(p => p > 0 && p <= 1), 'county p values in (0, 1]');

/* the same months filing record */
const sm = J(`GROUND.sameMonths([1,1,1,1,1,1,1,1,1,1,1,1, 2,2,2,2,2,2,2,2,2,2,2,2, 3,3,3], 2019 * 12)`);
eq(sm.years, [{ y: 2019, full: 12, ytd: 3 }, { y: 2020, full: 24, ytd: 6 }, { y: 2021, full: null, ytd: 9 }], 'full years and the same three months'); eq([sm.last, sm.month], [2021, 2], 'last year and month');
const smOff = J(`GROUND.sameMonths([5, 5, 5, 5], 2019 * 12 + 10)`); eq(smOff.years, [{ y: 2019, full: null, ytd: null }, { y: 2020, full: null, ytd: 10 }], 'a series that starts mid year');
const tx = J(`GROUND.sameMonths(ST.monthly.div, ST.monthly.t0)`);
eq(tx.years.find(y => y.y === 2025).full, run(`ST.annual['2025'].f_div`), 'Texas 2025 full year matches the annual table');
eq(tx.years.find(y => y.y === 2026).ytd, run(`ST.annual['2026'].f_div`), 'Texas 2026 to date matches the annual table');
eq(tx.month, run(`+META.oca_through.slice(5, 7) - 1`), 'the record runs to the last month of court data');
const dfw = J(`(() => { const s = GROUND.areaSeries('msa:19100'); return GROUND.sameMonths(s.div, s.t0).years.filter(y => y.full != null).map(y => [String(y.y), y.full]); })()`);
eq(Object.fromEntries(dfw), J(`MSA['19100'].hist`), 'Dallas Fort Worth full years match the metro history');
eq(run(`GROUND.areaSeries('cty:48001')`), null, 'a county without a monthly series has no record');
assert(run(`GROUND.areaSeries('cty:48201').div.length`) === run(`CI['48201'].filings.series.div.length`), 'a county with a series');

/* where the year stands */
const ys = J(`GROUND.yearStands(GROUND.areaSeries('tx'))`);
eq(ys.map(x => x.k), J('GROUND.SKEYS'), 'every case type');
const ysd = ys.find(x => x.k === 'div'); near(ysd.vsPrev, (ysd.now / ysd.prev - 1) * 100, 1e-9, 'change on the year before'); eq(ysd.base, tx.years.find(y => y.y === 2019).ytd, '2019 same months');
const ex = J(`GROUND.extremes([5, 9, 1, 7, 100, 0], 2019 * 12, 2)`); eq(ex, { hi: { t: 2019 * 12 + 1, v: 9 }, lo: { t: 2019 * 12 + 2, v: 1 } }, 'extremes leave out the provisional months');

/* headline figures */
const hl = J(`GROUND.headline('tx').map(r => [r[0], r[1], r[5]])`); const hv = l => (hl.find(r => r[0] === l) || [])[1];
eq(hv('Divorces filed, trailing 12 months'), run(`stTTM('div')`), 'Texas divorces filed'); eq(hv('Married adults'), run('ST.acs.married'), 'Texas married adults');
near(hv('Court capture: divorces filed per modeled divorce'), run(`stTTM('div') / sum(CTY.map(c => GROUND.modeled(c) || 0))`), 1e-9, 'Texas capture');
assert(hl.every(r => typeof r[1] === 'number' && isFinite(r[1]) && /^[ABCD]$/.test(r[2])), 'every headline row has a number and a grade');
const hm = J(`GROUND.headline('msa:19100').map(r => [r[0], r[1]])`); const mv = l => (hm.find(r => r[0] === l) || [])[1];
eq(mv('Divorces filed, trailing 12 months'), run(`MSA['19100'].ttm.div`), 'metro divorces filed match the metro table'); eq(mv('Law offices'), run(`MSA['19100'].lawoffices`), 'metro law offices');
const hc = J(`GROUND.headline('cty:48201').map(r => [r[0], r[1], r[5]])`); const cv = l => (hc.find(r => r[0] === l) || []);
eq(cv('Divorces filed, trailing 12 months')[1], run(`CI['48201'].filings.ttm.div`), 'county divorces filed'); eq(cv('Dissolution Index')[2], run(`CI['48201'].grade`), 'county index carries the county grade');
eq(J(`GROUND.headline('cty:99999').length`) > 20, true, 'an unknown area falls back to Texas');
eq(run(`GROUND.areaName('msa:19100')`), 'Dallas / Fort Worth / Arlington', 'metro name'); eq(run(`GROUND.areaName('cty:48201')`), 'Harris County', 'county name');

/* layers: each is observed, modeled or the comparison; each has a county or a ZIP value; ZIP only layers are modeled */
const lay = J(`GROUND.LAYERS.map(L => ({ k: L.k, grp: L.grp, c: !!L.c, z: !!L.z, g: L.g, n: L.c ? CTY.filter(c => isN(L.c(c))).length : ZC.filter(z => isN(L.z(z))).length, txt: [L.l, L.note, L.src, L.vint].join(' ') }))`);
assert(lay.every(L => ['obs', 'mod', 'cmp'].includes(L.grp) && (L.c || L.z) && /^[ABCD]$/.test(L.g) && L.n > 100), 'layer table');
assert(lay.filter(L => !L.c).every(L => L.grp === 'mod'), 'ZIP only layers are modeled allocations or scores');
eq(lay.filter(L => L.grp === 'obs').map(L => L.k), ['div', 'divk', 'sapcr', 'po', 'modenf', 'sep', 'divorced', 'ur', 'claims', 'warn', 'removals', 'fv', 'offices'], 'observed layers');
const HY = /[A-Za-z]\s?[-–—]\s?[A-Za-z]/;
lay.forEach(L => assert(!HY.test(L.txt.replace(/IV-D/g, '')), 'house style in layer ' + L.k + ': ' + L.txt));

/* reference tables: house style, citations, verify marks only where unchecked */
const refs = J(`[GT_CONST.map(r => [r.k, r.v, r.cite].join(' ')), GT_INV.map(r => r.slice(1, 8).join(' ')), GT_GATES.map(g => g.join(' ')), GT_GAPS.map(g => g.join(' '))]`);
refs.flat().forEach(t => assert(!HY.test(t.replace(/IV-D|re:SearchTX|8w53-c4f6/g, '')), 'house style: ' + t));
eq(J(`GT_CONST.map(r => r.cite)`).filter(c => /6\.301|6\.702|154\.125|156\.401|8\.055|8\.054|153\.312|153\.317|85\.025\(a-2\)|ch\. 85/.test(c)).length >= 10, true, 'the constants cite the sections the brief names');
assert(run(`GT_CONST.find(r => /cap/i.test(r.k)).v.includes('$11,700') && GT_CONST.find(r => /cap/i.test(r.k)).eff === '2025-09-01'`), 'the $11,700 cap since September 1, 2025');
assert(run(`/552\\.003\\(1\\)\\(B\\)/.test(GT_GATES[0][1]) && GT_GATES.some(g => /76a/.test(g[1])) && GT_GATES.some(g => /261\\.201/.test(g[1])) && GT_GATES.some(g => /13 U\\.S\\.C\\. § 9/.test(g[1]))`), 'the gates the brief names');
assert(run(`GT_INV.every(r => r.length === 9 && /^(Used|Not used)/.test(r[7]))`), 'inventory rows say used or not used');
eq(J(`[...new Set(GT_INV.map(r => r[5]))].sort()`), ['Confidential', 'Paid', 'Public', 'Restricted', 'Varies'], 'access classes');
console.log('ground ok');
