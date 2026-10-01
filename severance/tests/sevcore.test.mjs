/* Severance core helpers (src/00_core.js) and the statewide module helpers that carry logic: export rounding and file names, the
   control labels, the company and city cleaners, the statewide twelve month figures, the clerk reporting gap, the legend markers of
   layerScale and the metro map view (src/20_m01_index.js). Runs the real data and scripts in a vm context with a stubbed DOM. */
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
for (const f of ['data/suite.js', 'src/00_core.js', 'src/20_m01_index.js']) vm.runInContext(read(f), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);

/* csv: rounding to the column's decimals, fractions as percents, no thousands separators, blanks for null and non finite */
const out = run(`csv([{ a: 'x, y', b: 0.123456, c: 1234567.891, d: null, e: -0.0004, f: Infinity }], [{ l: 'A', k: 'a' }, { l: 'B (%)', k: 'b', d: 1, pct: true }, { l: 'C', k: 'c', d: 0 }, { l: 'D', k: 'd', d: 2 }, { l: 'E', k: 'e', d: 2 }, { l: 'F', k: 'f', d: 1 }, { l: 'G', k: r => r.b * 2, d: 3 }])`);
eq(out, 'A,B (%),C,D,E,F,G\n"x, y",12.3,1234568,,0,,0.247', 'csv rounds, scales percents, quotes and blanks');
eq(run(`csv([{ a: 1.23456 }], [{ l: 'a', k: 'a' }])`), 'a\n1.23456', 'csv without d keeps the value as it was (old callers)');
eq(run(`JSON.stringify(xcols([{ k: 'x', l: 'X', h: 'X header (%)', d: 1, pct: true, fmt: v => v }, { k: 'y', l: 'Y' }]))`), JSON.stringify([{ l: 'X header (%)', k: 'x', d: 1, pct: true }, { l: 'Y', k: 'y' }]), 'xcols maps export headers');
assert(/^severance_paid_google_locations_dallas-fort-worth-arlington_\d{4}-\d{2}-\d{2}\.csv$/.test(run(`expName('paid_google_locations', 'Dallas / Fort Worth / Arlington')`)), 'expName pattern');
assert(/^severance_index_texas_\d{4}-\d{2}-\d{2}\.txt$/.test(run(`expName('index', '', 'txt')`)), 'expName defaults to texas');

/* ctl: the label names its control, by the control's own id or one given to it */
eq(run(`ctl('Map layer', sel('idxLayer', [['a', 'A']], 'a'))`).match(/<label for="([^"]+)">/)[1], 'idxLayer', 'ctl uses the select id');
const gen = run(`ctl('Budget $', '<input type="number" value="$1" min="0">')`);
const gid = gen.match(/<label for="([^"]+)">/)[1]; assert(gen.includes(`<input id="${gid}" type="number" value="$1"`), 'ctl gives an id to a control without one and keeps $1 intact');
eq(run(`ctl('Note', '<span>text</span>')`), '<div class="ctl"><label>Note</label><span>text</span></div>', 'ctl without a control is unchanged');
assert(run(`ctl('Find', '<input type="search" id="q" list="ql"><datalist id="ql"></datalist>')`).includes('<label for="q">'), 'ctl picks the input, not the datalist');

/* company names: the notice month in a WARN company name is dropped, brand spellings kept */
const co = run(`['Raices (April 2025)', 'Spirit Airlines (IAH) May 2026', 'KUEHNE + NAGEL (KN) 2026', 'Congo, LLC (Updated March 2026)', 'Turner Industries (Paris, Texas September 2025)', 'Tom Thumb Store #3579', 'Chick-fil-A - Store', 'Studio 2020 Inc'].map(CO)`);
eq(co, ['Raices', 'Spirit Airlines (IAH)', 'KUEHNE + NAGEL (KN)', 'Congo, LLC', 'Turner Industries (Paris, Texas)', 'Tom Thumb Store #3579', 'Chick-fil-A / Store', 'Studio 2020 Inc'], 'CO strips notice dates');
eq(run(`['Desoto', 'De Soto', 'Mc Dade', 'Mckinney', 'Ft. Worth', 'La Marque'].map(CITYFIX)`), ['DeSoto', 'DeSoto', 'McDade', 'McKinney', 'Fort Worth', 'La Marque'], 'CITYFIX');
assert(run(`ZC.some(z => z.city === 'DeSoto') && !ZC.some(z => /^De ?soto$/i.test(z.city) && z.city !== 'DeSoto')`), 'ZIP cities read DeSoto');

/* statewide twelve months come from the statewide series, and the label from the data */
eq(run(`stTTM('div')`), run(`sum(ST.monthly.div.slice(-12))`), 'stTTM');
eq(run(`ttmSpan()`), 'Sep 2025 to Aug 2026', 'ttmSpan from META.oca_through');
eq(run(`seriesSpan()`), 'January 2019 to August 2026', 'seriesSpan');

/* clerk reporting gaps: San Jacinto reports nothing for twelve months after about nine a month */
const sj = run(`JSON.stringify(repGap(CTY.find(c => c.name === 'San Jacinto')))`); assert(/"months":12/.test(sj), 'San Jacinto gap ' + sj);
eq(run(`repGap(CI['48201'])`), null, 'no gap for Harris');
eq(run(`repGap(CTY.find(c => !c.filings.series))`), null, 'no series, no gap');

/* layerScale: legend ends that are the 2nd and 98th percentile stops read as bounds; percentile layers are not clamped */
const sig = run(`JSON.stringify(layerScale({ ramp: 'ember', v: c => c.rates.filings_per_lawoffice, f: v => N(v, 1) }, CTY).legend)`);
assert(/"min":"≤ /.test(sig) && /"max":"≥ /.test(sig), 'clamped ends marked ' + sig);
const di = run(`JSON.stringify(layerScale(LAYERS_CTY.di, CTY).legend)`); assert(/"min":"0"/.test(di) && /"max":"100"/.test(di), 'percentile layer unmarked ' + di);
const dv = run(`JSON.stringify(layerScale(LAYERS_CTY.yoy, CTY).legend)`); assert(/≥ \+/.test(dv) || /"max":"\+/.test(dv), 'diverging legend ' + dv);
eq(run(`layerScale({ ramp: 'slate', v: c => c.rates.lawoffices || 0, f: v => N(v), log: true }, CTY).color(0)`), 'var(--rp-slate-0)', 'a true zero on a log layer takes the lowest color, not no data');

/* metro map view: inside the state map, at the state map's shape */
const box = run(`metroBox('26420')`); const G = run('GEO.state');
assert(box && box[2] > 0 && box[2] < G.W && Math.abs(box[2] / box[3] - G.W / G.H) < 1e-6, 'metro box keeps the map shape');
/* Census 'not available' codes become null once, in the core: no -666666666 income prints or maps */
eq(run(`[...ZC, ...CTY].filter(o => Object.values(o.acs || {}).some(v => typeof v === 'number' && v <= -1e8)).length`), 0, 'no ACS sentinel left in ZIPs or counties');
eq(run(`ZI['76203'].acs.med_hh_inc`), null, '76203 Denton income is not available, not negative');
assert(run(`DATA_FIX.sentinels`) > 300 && run(`DATA_FIX.sentinelFields['zip.acs.med_hh_inc']`) === 38, 'sentinels counted ' + run(`JSON.stringify(DATA_FIX.sentinelFields)`));

/* ZIP to county by residents: the Metro Atlas block groups give the same overrides the core ships, and every county still sums to its clerk count */
{
  const atl = {}; const actx = { window: {} }; vm.createContext(actx);
  for (const k of ['dfw', 'hou', 'sat', 'aus', 'elp', 'rgv']) { vm.runInContext(read(`data/atlas-${k}.js`), actx, { filename: k }); atl[k] = actx.window.__SEV_ATLAS__[k]; }
  const ZCr = JSON.parse(run(`JSON.stringify(ZC.map(z => ({ zip: z.zip, raw: z.county_raw, pop: z.acs.pop })))`)); const RAW = {}; ZCr.forEach(z => { RAW[z.zip] = z; });
  const ALL = run('GEO.zc_county_all'); const want = {};
  for (const k of Object.keys(atl)) { const A = atl[k], B = A.bg; const inA = new Set(A.meta.cty.map(x => '48' + x)); const by = {};
    for (let i = 0; i < B.id.length; i++) { const zip = B.zip[i]; if (!zip) continue; const f = B.id[i].slice(0, 5); (by[zip] = by[zip] || {})[f] = (by[zip][f] || 0) + (B.v.pop[i] || 0); }
    for (const zip in by) { const z = RAW[zip]; if (!z) continue; const o = by[zip]; const tot = Object.values(o).reduce((a, b) => a + b, 0); if (!tot) continue; const best = Object.keys(o).sort((a, b) => o[b] - o[a])[0]; const cov = tot / (z.pop || 1); const touch = (ALL[zip] || []).filter(x => x[1] >= 0.005).map(x => x[0]);
      if (best !== z.raw && o[best] / tot >= 0.6 && cov >= 0.8 && cov <= 1.25 && touch.every(f => inA.has(f))) want[zip] = best; } }
  eq(JSON.stringify(Object.keys(want).sort().reduce((o, k) => (o[k] = want[k], o), {})), run(`JSON.stringify(Object.keys(ZC_POP_COUNTY).sort().reduce((o, k) => (o[k] = ZC_POP_COUNTY[k], o), {}))`), 'ZC_POP_COUNTY matches the atlas block groups');
}
eq(run(`ZI['79601'].county + ' ' + ZI['79601'].county_raw + ' ' + ZI['79601'].county_name`), '48441 48253 Taylor', '79601 Abilene goes to Taylor, keeps Jones as county_raw');
eq(run(`ZI['79705'].county_name`), 'Midland', '79705 Midland goes to Midland County');
eq(run(`DATA_FIX.moved.filter(m => CI[m.to].msa !== ZI[m.zip].msa).length`), 0, 'a move never leaves the metro');
eq(run(`(() => { const by = {}; ZC.forEach(z => { by[z.county] = (by[z.county] || 0) + z.alloc.div; }); return Object.keys(by).filter(f => Math.abs(by[f] - CI[f].filings.ttm.div) > 0.05 * Math.max(1, ZC.filter(z => z.county === f).length)).length; })()`), 0, 'ZIP filings sum to each county clerk count');
eq(run(`ZC.filter(z => !isN(z.paid.eff_pct) || z.paid.eff_pct <= 0 || z.paid.eff_pct > 100).length`), 0, 'efficiency percentiles ranked again');
eq(run(`Math.abs(ZI['79601'].paid.opp - ZI['79601'].alloc.priv) < 1e-9 && Math.abs(ZI['79601'].exp_div_per_1k_married - ZI['79601'].alloc.div / ZI['79601'].acs.married * 1000) < 1e-9`), true, 'moved ZIP derived fields follow the new allocation');

/* table sorts lists and text as text, numbers as numbers (never NaN) */
eq(run(`(() => { const t = table(document.createElement('div'), { cols: [{ k: 'n', l: 'n' }, { k: 'cty', l: 'c' }], rows: [{ _id: 'a', n: 'A', cty: ['Dallas', 'Collin'] }, { _id: 'b', n: 'B', cty: ['Collin'] }, { _id: 'c', n: 'C', cty: ['Wise'] }], sort: { k: 'cty', dir: 1 } }); return t.sorted().map(r => r._id).join(''); })()`), 'bac', 'list columns sort by their text');

/* diverging legends keep the layer's unit; WARN names cut off mid parenthesis are closed */
assert(/ pts$/.test(run(`layerScale({ ramp: 'div', v: c => c.econ.ur_chg_yoy, f: v => sgn(v, 1, ' pts') }, CTY).legend.max`)), 'points legend');
eq(run(`CO('Remington Lodging and Hospitality, LLC (Hilton Houston NASA ')`), 'Remington Lodging and Hospitality, LLC (Hilton Houston NASA…)', 'truncated company name closed');
console.log('sevcore ok');
