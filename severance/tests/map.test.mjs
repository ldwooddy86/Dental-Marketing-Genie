/* The interactive map's logic and the place finder (src/00_core.js): area boxes and the area under a point, the fit frame and the pan
   limits, pins in map units from degrees, ZIP centers and the firm's offices, findPlace for ZIPs, counties, cities (a prefix ranked by
   married adults), courts and scopes, and the find box suggestions. Runs the real data and scripts in a vm context with a stubbed DOM. */
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
  document: { createElement: node, body: node(), head: node(), documentElement: node(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() { }, removeEventListener() { }, activeElement: null },
  addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false, addEventListener() { } }), performance: globalThis.performance, ResizeObserver: class { observe() { } unobserve() { } disconnect() { } }, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout,
  localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
  navigator: { userAgent: 'node' }, location: { hash: '' }, history: { replaceState() { } } };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data/suite.js', 'src/00_core.js', 'src/01_kit.js', 'src/02_firm.js']) vm.runInContext(read(f), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);

/* area boxes and the area under a point */
const bb = run(`mapBBox(GEO.state.county, '48201')`); assert(bb && bb[0] < bb[2] && bb[1] < bb[3], 'Harris box ' + JSON.stringify(bb));
eq(run(`mapBBox(GEO.state.county, 'nope')`), null, 'no path, no box');
eq(run(`mapAreaAt(GEO.state.county, GEO.state.cent['48201'][0], GEO.state.cent['48201'][1])`), '48201', 'the Harris center is in Harris');
eq(run(`mapAreaAt(GEO.state.county, GEO.state.cent['48113'][0], GEO.state.cent['48113'][1])`), '48113', 'the Dallas center is in Dallas');
eq(run(`mapAreaAt(GEO.state.county, -50, -50)`), null, 'off the map');
{ const M = run(`(() => { const M = GEO.metros['19100']; return Object.keys(M.zcent).filter(z => mapAreaAt(M.zcta, M.zcent[z][0], M.zcent[z][1]) === z).length / Object.keys(M.zcent).length; })()`); assert(M > 0.9, 'most DFW ZIP centers fall in their own ZIP: ' + M); }

/* the fit frame: the home view's shape, padded around the areas, no closer than the zoom limit, inside the pan bounds */
const mz = `({ paths: GEO.state.county, home: [0, 0, GEO.state.W, GEO.state.H], home0: [0, 0, GEO.state.W, GEO.state.H], v: [0, 0, GEO.state.W, GEO.state.H], W: GEO.state.W, H: GEO.state.H, max: 16, o: { cent: GEO.state.cent } })`;
const fit = run(`mapFitBox(${mz}, MSA['19100'].counties)`); const G = run('GEO.state');
assert(Math.abs(fit[2] / fit[3] - G.W / G.H) < 1e-6, 'fit keeps the map shape');
{ const ids = run(`MSA['19100'].counties`); for (const f of ids) { const b = run(`mapBBox(GEO.state.county, '${f}')`); assert(b[0] >= fit[0] - 1e-6 && b[2] <= fit[0] + fit[2] + 1e-6 && b[1] >= fit[1] - 1e-6 && b[3] <= fit[1] + fit[3] + 1e-6, 'fit holds ' + f); } }
const one = run(`mapFitBox(${mz}, ['48397'])`); assert(Math.abs(one[2] - G.W / 16) < 1e-6, 'a small county stops at the zoom limit (Rockwall): ' + one[2]);
const boxFit = run(`mapFitBox(${mz}, [100, 100, 50, 50])`); assert(boxFit[0] <= 100 && boxFit[0] + boxFit[2] >= 150, 'a box fits');
eq(run(`mapFitBox(${mz}, ['nope'])`), null, 'nothing to fit');
eq(run(`mapClamp(${mz}, [-500, -500, 100, 100])`), [0, 0, 100, 100], 'a view stays over the map');
eq(run(`mapClamp(${mz}, [5000, 5000, 100, 100])`).map(v => Math.round(v * 10) / 10), [G.W - 100, G.H - 100, 100, 100].map(v => Math.round(v * 10) / 10), 'a view stays over the map (far side)');
eq(run(`mapCanPan(${mz})`), false, 'the whole state at home cannot pan');
eq(run(`(() => { const m = ${mz}; m.v = [100, 100, 300, 280]; return mapCanPan(m); })()`), true, 'a zoomed view can pan');
// a metro home view (the index's metro filter) pans across the state at the same scale
eq(run(`(() => { const m = ${mz}; m.home = mapFitBox(m, MSA['26420'].counties); m.v = m.home.slice(); return mapCanPan(m); })()`), true, 'a metro home view can pan');

/* pins: the markup is in map units and scales with --u; shapes; non numbers dropped */
const pins = run(`mapPinsSVG([{ x: 10, y: 20, shape: 'diamond', label: 'A & B' }, { x: 1, y: 2, shape: 'square', r: 4 }, { x: 'x', y: 2 }, null, { x: 3, y: 4 }])`);
assert(/translate\(10\.00px,20\.00px\) scale\(var\(--u,1\)\)/.test(pins) && /<path d="M0 -8\.10L8\.10 0/.test(pins) && /<rect x="-4"/.test(pins) && /<circle r="6"/.test(pins) && /A &amp; B/.test(pins), 'pin markup ' + pins);
eq((pins.match(/<g class="pin/g) || []).length, 3, 'two bad pins skipped');
assert(/data-pin="4"/.test(pins), 'pins keep their index for onPin');

/* degrees to map units (linear in the bounds): the Harris County Family Law Center lands in Harris and in 77002's neighborhood */
const hc = run(`mapXY('state', -95.35965, 29.76168)`); eq(run(`mapAreaAt(GEO.state.county, ${hc[0]}, ${hc[1]})`), '48201', 'courthouse in Harris on the state map');
const hm = run(`mapXY('26420', -95.35965, 29.76168)`); const z2 = run(`GEO.metros['26420'].zcent['77002']`); assert(Math.hypot(hm[0] - z2[0], hm[1] - z2[1]) < 15, 'courthouse near 77002 on the Houston map');
eq(run(`mapXY('99999', 1, 2)`), null, 'no such map');
const zs = run(`zipXY('state', '75024')`); eq(run(`mapAreaAt(GEO.state.county, ${zs[0]}, ${zs[1]})`), '48085', '75024 (Plano) on the state map is in Collin');
eq(run(`zipXY('19100', '75024')`), run(`GEO.metros['19100'].zcent['75024']`), 'a ZIP on its own metro map is its center');
eq(run(`zipXY('26420', '75024')`), null, 'a ZIP is not on another metro map');

/* firm pins and firm ids */
eq(run(`firmPins('state')`), [], 'no firm, no pins');
eq(run(`firmIds()`), null, 'no firm, no ids');
run(`FIRM.set({ name: 'Example Family Law', offices: [{ label: 'Plano office', street: '1 Main St', city: 'Plano', zip: '75024', county: '', phone: '', hours: '', primary: true }, { label: 'No ZIP', city: 'Nowhere', zip: '', county: '', primary: false }] })`);
const fp = run(`firmPins('state')`); eq(fp.length, 1, 'one office with a place'); eq(fp[0].shape, 'diamond', 'offices are diamonds'); assert(/Primary practice location/.test(fp[0].tip) && /Example Family Law/.test(fp[0].tip), 'office tip');
eq(run(`firmPins('19100')[0].x`), run(`GEO.metros['19100'].zcent['75024'][0]`), 'office on the metro map at its ZIP center');
eq(run(`[...firmIds()].sort()`), ['48085', '75024'], 'firm ids: the office county and ZIP');

/* findPlace */
const fpl = q => run(`JSON.stringify(findPlace(${JSON.stringify(q)}))`);
const P = (q, sc) => JSON.parse(run(`JSON.stringify(findPlace(${JSON.stringify(q)}${sc !== undefined ? ', ' + JSON.stringify(sc) : ''}))`));
eq(P('77002').kind, 'zip', 'ZIP'); eq(P('77002').fips, '48201', 'ZIP county'); eq(P('77002').msa, '26420', 'ZIP metro'); eq(P('77002 Houston').zip, '77002', 'ZIP with its city');
for (const q of ['Harris', 'harris county', 'Harris Co.', 'HARRIS COUNTY, TX', '48201', '201']) eq(P(q).fips, '48201', 'county: ' + q);
eq(P('Harris').kind, 'county', 'county kind');
eq(P('Plano').kind, 'city', 'city'); eq(P('Plano').fips, '48085', 'Plano is in Collin by its biggest ZIP');
assert(P('Plano').zips.length >= 5 && P('Plano').married > 100000, 'a city carries its ZIPs and married adults');
eq(P('Pla').city, 'Plano', 'a prefix ranks cities by married adults (Plano over Plainview and Pleasanton)');
eq(P('Ft Worth').city, 'Fort Worth', 'Ft is Fort'); eq(P('mckinney').city, 'McKinney', 'McKinney');
eq(P('Dallas').kind, 'county', 'a name that is both is the county by default'); eq(P('Dallas', { prefer: 'city' }).kind, 'city', 'unless the scope prefers cities');
eq(P('Dallas County').kind, 'county', 'county words win');
eq(P('Tarrant County district court').kind, 'court', 'a court named with its county'); eq(P('Tarrant County district court').fips, '48439', 'mapped to Tarrant');
eq(P('Harris County Family Law Center').fips, '48201', 'a courthouse by its county');
eq(fpl('308th District Court'), 'null', 'a numbered court without a county is a miss');
for (const q of ['', '   ', 'xyzzy', '00000', '99999', '12', '1234567']) eq(fpl(q), 'null', 'miss: ' + JSON.stringify(q));
// scopes: a metro code, a list, counties
eq(P('Harris', '19100'), null, 'Harris is outside DFW'); eq(P('77002', '19100'), null, 'a Houston ZIP is outside DFW');
eq(P('Plano', '19100').city, 'Plano', 'Plano inside DFW'); eq(P('Harris', ['19100', '26420']).fips, '48201', 'a list of metros');
eq(P('Plano', { counties: ['48113'] }), null, 'Plano is outside Dallas County'); eq(P('Garland', { counties: ['48113'] }).city, 'Garland', 'Garland is in Dallas County');
eq(P('Fort', '19100').city, 'Fort Worth', 'a prefix inside a metro');
// loaded atlas courts are searched by name
run(`window.__SEV_ATLAS__ = { hou: { courts: [{ f: '201', n: 'Harris County Family Law Center', a: '1115 Congress Ave, Houston', lat: 29.76168, lon: -95.35965 }, { f: '157', n: 'Fort Bend County Justice Center', a: '1422 Eugene Heimann Cir, Richmond', lat: 29.5767, lon: -95.75441 }] } }`);
eq(run(`loadedCourts().length`), 2, 'loaded courts'); eq(run(`loadedCourts()[0].fips`), '48201', 'court county FIPS');
eq(P('Fort Bend County Justice Center').court, 'Fort Bend County Justice Center', 'a loaded courthouse by name'); eq(P('Fort Bend County Justice Center').city, 'Richmond', 'its city');
eq(P('Harris').kind, 'county', 'a county prefix is not taken for a courthouse');
eq(run(`courtPins('state').length`), 2, 'court pins'); eq(run(`courtPins('26420')[0].shape`), 'square', 'courts are squares');

/* the find box suggestions */
const opts = run(`findOptions('19100')`); assert(opts.some(o => o[0] === 'Dallas County') && opts.some(o => o[0] === 'Plano') && opts.some(o => o[0] === '75024') && !opts.some(o => o[0] === 'Harris County'), 'DFW suggestions');
assert(run(`findOptions(null).filter(o => /County$/.test(o[0])).length`) === 254, 'all 254 counties statewide');
console.log('map ok');
