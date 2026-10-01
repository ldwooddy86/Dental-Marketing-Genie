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
console.log('sevcore ok');
