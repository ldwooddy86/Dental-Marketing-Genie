/* Campaign Desk platform writers (src/10_desk_platforms.js): header rows and sample rows of every bulk file, CSV quoting, the 15 headline
   and 4 description limits, character limits, paused status, criterion ID columns, needs review export, and the pacing anchored to the
   flight start. Loads DESKX into a vm context with a stub compliance engine; a second pass loads the real src/03_lint.js (when it loads)
   and checks that a filled firm profile yields no block findings. `node tests/run.mjs desk` */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { root } from './lib/load.mjs';
import { assert, eq } from './lib/mock.mjs';
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

/* a stub LINT: the platform limits, the house style, placeholders block, and the Rule 7.02(a) check against a stub firm */
const LIMITS = { google: { headline: 30, description: 90, path: 15, sitelink: 25, sitelink_desc: 35, callout: 25, snippet: 25 }, microsoft: { headline: 30, description: 90, path: 15, sitelink: 25, callout: 25 }, meta: { primary: 125, headline: 40, description: 30 }, demandgen: { headline: 40, description: 90, business: 25 }, tiktok: { text: 100, display_name: 40 }, linkedin: { intro: 150, headline: 70, description: 100 }, lsa: { bio: 1000 }, yelp: { headline: 50, body: 500 }, nextdoor: { headline: 90, body: 400 } };
function stubLint(firm) {
  const house = s => String(s).replace(/(\w)-(\w)/g, '$1 $2').replace(/\s*[—–]\s*/g, ', ');
  const screen = (t, o) => { const f = []; const ph = String(t).match(/\[(Firm name|Responsible attorney|Office city|Phone)\]/); if (ph) f.push({ id: 'ph', sev: 'block', title: 'Unfilled placeholder', rule: 'Rule 7.01(a)', hit: ph[0] }); if (o && o.kind && !(firm.atty && t.includes(firm.atty) && firm.city && t.includes(firm.city))) f.push({ id: 'r702a', sev: 'warn', title: 'Responsible lawyer and primary practice location', rule: 'Rule 7.02(a)' }); if (/\w-\w/.test(t)) f.push({ id: 'house', sev: 'fix', title: 'Hyphen', rule: 'House style' }); return { findings: f, pass: !f.some(x => x.sev === 'block') }; };
  const checkAd = (ad, o) => { const lim = LIMITS[ad.platform] || {}; const out = []; Object.keys(ad.fields).forEach(k => { const max = lim[k] || lim[k.replace(/\d+$/, '')]; const v = String(ad.fields[k] || ''); if (max && v.length > max) out.push({ id: 'len_' + k, sev: 'block', title: `${k} is ${v.length} characters`, rule: `${ad.platform} limit ${max}` }); }); return out.concat(screen(Object.values(ad.fields).join(' \n'), Object.assign({ kind: 'ad' }, o)).findings); };
  return { LIMITS, house, screen, checkAd, fix: t => ({ text: t, applied: [] }) };
}
function loadDesk(ctxExtra) {
  const ctx = vm.createContext(Object.assign({ console }, ctxExtra));
  vm.runInContext(read('src/10_desk_platforms.js') + '\n;globalThis.DESKX = DESKX;', ctx, { filename: 'src/10_desk_platforms.js' });
  return ctx;
}
/* a plan model like the one module 10 builds */
const LINES = { div_k: { name: 'Divorce with children', short: 'Divorce, kids', kw: ['divorce lawyer', 'divorce attorney', 'child custody lawyer'] }, po: { name: 'Protective orders', short: 'Protective orders', kw: ['protective order lawyer', 'family violence attorney'] }, mod: { name: 'Modification', short: 'Modification', kw: ['modify child support Texas', 'custody modification lawyer'] } };
const FIRM_FULL = { name: 'Smith Family Law', atty: 'Jane Smith', city: 'Plano', phone: '(972) 555 0100', url: 'https://www.example-firm.com', street: '100 Main St', zip: '75024', hours: 'Monday to Friday, 8 am to 6 pm', offices: [{ street: '100 Main St', city: 'Plano', zip: '75024' }], lawyers: [{ name: 'Jane Smith', bar_no: '24000000' }], consult: { free: false, fee: 150, virtual: true }, fees: {}, payment: 'Credit cards and payment plans' };
function model(X, o) {
  o = o || {};
  const markets = [{ zip: '75024', city: 'Plano', county: '48085', county_name: 'Collin', gt: '9026883', bid: 20 }, { zip: '75034', city: 'Frisco', county: '48085', county_name: 'Collin', gt: '9026890', bid: 10 }, { zip: '75201', city: 'Dallas', county: '48113', county_name: 'Dallas', gt: '', bid: 0 }];
  const lines = Object.keys(LINES).map((k, i) => ({ key: k, name: LINES[k].name, short: LINES[k].short, share: [0.5, 0.3, 0.2][i], cpc: 9.87, cpcMs: 6.6, n: 100, fee: 5000, budget: 1000, leads: 10, ret: 2, rev: 10000, cvr: 6, retain: 22 }));
  const plat = {}; X.PLATS.forEach(p => plat[p] = { spend: 1000 });
  return Object.assign({ plan: { sched: 'extended', metaGeo: 'zips', radius: 15, li: 'both', pay: '' }, geo: { code: 'DFW', title: 'Dallas Fort Worth', county: 'Collin', fips0: '48085' }, scope: 'top', markets, counties: [{ fips: '48085', name: 'Collin', gt: '9059489', bid: 0 }], countyZips: ['75024', '75034'], lines, lineInfo: LINES, plat, langs: ['en', 'es'], esShare: 0.25, firm: FIRM_FULL, start: '2026-10-15', end: X.endDate('2026-10-15', 13), geoMods: ['Plano', 'Frisco', 'Collin County'], serve: ['Collin', 'Dallas'] }, o);
}
const parse = text => { const rows = []; let row = [], cur = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; } if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; } if (cur || row.length) { row.push(cur); rows.push(row); } return rows; };

const firm = { atty: 'Jane Smith', city: 'Plano' };
const C = loadDesk({ LINT: stubLint(firm) }); const X = C.DESKX;
const M = model(X);

/* ---- CSV quoting */
eq(X.csv(['a', 'b'], [['x,y', 'he said "hi"'], ['line\nbreak', ' lead']]), 'a,b\n"x,y","he said ""hi"""\n"line\nbreak"," lead"\n', 'csv quotes commas, quotes, line breaks and edge spaces');
eq(X.csvQ('plain'), 'plain', 'plain field is not quoted'); eq(X.csvQ(null), '', 'null is empty');
const rt = parse(X.csv(['h'], [['a,"b"\nc']])); eq(rt[1][0], 'a,"b"\nc', 'quoted field round trips');

/* ---- every platform file: header row, paused status, review columns */
const EXPECT_HEAD = {
  google: ['Campaign', 'Campaign Type', 'Networks', 'Budget', 'Budget type', 'Languages', 'Bid Strategy Type', 'Start Date', 'End Date', 'Campaign Status', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status', 'Ad Group', 'Ad Group Type', 'Max CPC', 'Ad Group Status', 'Keyword', 'Ad type'],
  meta: ['Campaign Name', 'Campaign Status', 'Campaign Objective', 'Special Ad Categories', 'Ad Set Name', 'Ad Set Run Status', 'Ad Set Daily Budget', 'Ad Set Time Start', 'Ad Set Time Stop', 'Zip', 'Radius', 'Age Min', 'Ad Name', 'Ad Status', 'Title', 'Body', 'Description', 'Link', 'Call to Action', 'Review status', 'Review notes'],
  lsa: ['Field', 'Value', 'Notes'],
  linkedin: ['Campaign Group', 'Campaign', 'Objective', 'Locations', 'Job titles', 'Daily budget', 'Start date', 'End date', 'Intro text', 'Headline', 'Status', 'Review status', 'Review notes']
};
const files = {}; X.PLATS.forEach(p => { files[p] = X[p](M); });
X.PLATS.forEach(p => {
  const f = files[p]; assert(f && f.name && f.text && Array.isArray(f.header) && f.rows.length, p + ': writer returns name, header, rows, text');
  const lines = parse(f.text); eq(lines[0], f.header, p + ': first CSV line is the header row'); eq(lines.length, f.rows.length + 1, p + ': one CSV record per row');
  eq(f.header, X.HEAD[p], p + ': header matches DESKX.HEAD');
  lines.slice(1).forEach((r, i) => eq(r.length, f.header.length, `${p}: row ${i + 1} has every column`));
  assert(/\.csv$/.test(f.name) && f.name.includes('2026-10-15'), p + ': file name carries the start date');
});
Object.keys(EXPECT_HEAD).forEach(p => eq(files[p].header.slice(0, EXPECT_HEAD[p].length), EXPECT_HEAD[p], p + ': documented header columns'));
/* the Google header keeps the HVAC Editor layout and appends schedule, labels, pinning and review */
const GH = X.HEAD.google; eq(GH.filter(h => /^Headline \d+$/.test(h)).length, 15, 'Google: exactly 15 headline columns'); eq(GH.filter(h => /^Description \d+$/.test(h)).length, 4, 'Google: exactly 4 description columns');
['Path 1', 'Path 2', 'Final URL', 'Callout text', 'Sitelink text', 'Description line 1', 'Description line 2', 'Sitelink final URL', 'Header', 'Snippet values', 'Phone number', 'Country code', 'Ad Schedule', 'Labels', 'Description 1 position', 'Review status', 'Review notes'].forEach(h => assert(GH.includes(h), 'Google header has ' + h));
eq(X.HEAD.microsoft, GH, 'Microsoft imports the Google Ads Editor format');

/* ---- Google: sample rows */
const G = files.google; const col = h => G.header.indexOf(h); const rows = G.rows; const v = (r, h) => r[col(h)];
const camps = rows.filter(r => v(r, 'Campaign Type') === 'Search');
eq(camps.length, 6, 'Google: one Search campaign per line and language (3 lines x 2)');
camps.forEach(r => { eq(v(r, 'Campaign Status'), 'Paused', 'campaign paused'); eq(v(r, 'Budget type'), 'Daily', 'daily budget'); assert(/^\d+\.\d{2}$/.test(v(r, 'Budget')), 'budget has cents'); eq(v(r, 'Start Date'), '2026-10-15', 'start date'); eq(v(r, 'End Date'), '2027-01-13', 'end date is the last day of 13 weeks'); assert(/^\(Monday\[06:00-23:00\]\)/.test(v(r, 'Ad Schedule')), 'ad schedule'); assert(/^DFW_(DIV_K|PO|MOD)_GOOGLE_(EN|ES)_20261015$/.test(v(r, 'Campaign')), 'campaign name carries geo, line key, platform, language and start: ' + v(r, 'Campaign')); });
eq(camps.find(r => v(r, 'Campaign') === 'DFW_DIV_K_GOOGLE_EN_20261015')[col('Budget')], (1000 * 0.5 * 0.75 / 30.4).toFixed(2), 'English budget = platform spend x line share x (1 - Spanish share) / 30.4');
eq(camps.find(r => v(r, 'Campaign') === 'DFW_DIV_K_GOOGLE_ES_20261015')[col('Languages')], 'Spanish', 'Spanish campaign');
const locs = rows.filter(r => v(r, 'Location'));
eq(locs.length, 3 * 6, 'every campaign targets every market');
const plano = locs.find(r => v(r, 'Location') === '75024, Texas, United States'); eq(v(plano, 'ID'), '9026883', 'ZIP criterion ID in the ID column'); eq(v(plano, 'Bid Modifier'), '+20%', 'bid step'); eq(v(plano, 'Criterion Type'), 'Location', 'location criterion');
eq(v(locs.find(r => v(r, 'Location').startsWith('75201')), 'ID'), '', 'a ZIP without a criterion ID resolves by name');
const kw = rows.filter(r => v(r, 'Keyword') && v(r, 'Ad Group'));
assert(kw.some(r => v(r, 'Keyword') === 'divorce lawyer' && v(r, 'Criterion Type') === 'Exact') && kw.some(r => v(r, 'Keyword') === 'divorce lawyer' && v(r, 'Criterion Type') === 'Phrase'), 'core seeds in exact and phrase');
assert(kw.some(r => v(r, 'Keyword') === 'divorce lawyer plano' && v(r, 'Criterion Type') === 'Exact' && /Local$/.test(v(r, 'Ad Group'))), 'local modifier keywords in exact');
assert(kw.some(r => v(r, 'Ad Group').endsWith('Questions') && v(r, 'Criterion Type') === 'Phrase'), 'question keywords in phrase');
assert(rows.some(r => v(r, 'Keyword') === 'pro bono' && v(r, 'Criterion Type') === 'Negative Phrase' && !v(r, 'Ad Group')), 'campaign negatives');
assert(rows.some(r => v(r, 'Keyword') === 'gratis' && v(r, 'Campaign').includes('_ES_')), 'Spanish negatives on Spanish campaigns');
const sl = rows.filter(r => v(r, 'Sitelink text')); assert(sl.length >= 6, 'sitelinks'); sl.forEach(r => { assert(v(r, 'Sitelink text').length <= 25 && v(r, 'Description line 1').length <= 35 && v(r, 'Description line 2').length <= 35, 'sitelink limits'); assert(/^https:\/\/www\.example-firm\.com\//.test(v(r, 'Sitelink final URL')), 'sitelink URL'); });
rows.filter(r => v(r, 'Callout text')).forEach(r => assert(v(r, 'Callout text').length <= 25, 'callout limit: ' + v(r, 'Callout text')));
assert(rows.some(r => v(r, 'Header') === 'Neighborhoods' && v(r, 'Snippet values') === 'Plano;Frisco;Dallas'), 'structured snippet of the market cities');
assert(rows.some(r => v(r, 'Phone number') === '(972) 555 0100' && v(r, 'Country code') === 'US'), 'call asset');
const ads = rows.filter(r => v(r, 'Ad type') === 'Responsive search ad');
eq(ads.length, 3 * 3 + 3 * 2, 'one RSA per ad group (Core, Questions, Local in English; Core and Local in Spanish)');
ads.forEach(r => {
  eq(v(r, 'Status'), 'Paused', 'RSA paused');
  const hs = [...Array(15)].map((_, i) => v(r, 'Headline ' + (i + 1))).filter(Boolean), ds = [...Array(4)].map((_, i) => v(r, 'Description ' + (i + 1))).filter(Boolean);
  assert(hs.length >= 3 && hs.length <= 15, 'RSA has 3 to 15 headlines: ' + hs.length); assert(ds.length >= 2 && ds.length <= 4, 'RSA has 2 to 4 descriptions');
  hs.forEach(h => assert(h.length <= 30, 'headline over 30: ' + h)); ds.forEach(d => assert(d.length <= 90, 'description over 90: ' + d));
  assert(v(r, 'Path 1').length <= 15 && v(r, 'Path 2').length <= 15, 'paths up to 15');
  eq(new Set(hs.map(h => h.toLowerCase())).size, hs.length, 'no duplicate headlines');
  assert(hs.concat(ds).every(t => !/\w-\w|[—–]/.test(t)), 'house style: no hyphens or dashes in ad text');
  eq(v(r, 'Description 1 position'), '1', 'the Rule 7.02(a) line is pinned to position 1');
  assert(v(r, 'Description 1').includes('Jane Smith') && v(r, 'Description 1').includes('Plano'), 'description 1 names the responsible lawyer and the primary office');
  eq(v(r, 'Review status'), 'ready', 'a filled firm makes the ad ready'); eq(v(r, 'Labels'), '', 'no needs review label');
  assert(/^https:\/\/www\.example-firm\.com\/[a-z-]+\?utm_source=google&utm_medium=cpc&utm_campaign=DFW_/.test(v(r, 'Final URL')), 'final URL with UTM');
});
assert(ads.some(r => v(r, 'Headline 1') === 'Orden de Protección'), 'Spanish creative in Spanish campaigns');
assert(!ads.some(r => [...Array(15)].map((_, i) => v(r, 'Headline ' + (i + 1))).some(h => /^Office in (Frisco|Dallas)/.test(h))), 'market cities never appear as an office');

/* ---- keywords: the modifiers shown are the ones used; crossings well formed; base seeds only near the base; DIY seeds left out */
{ const MK = model(X, { geoMods: ['Plano', 'Frisco', 'McKinney', 'Allen', 'Collin County', 'Dallas County', 'Extra'], lineInfo: { mil: { kw: ['military divorce lawyer', 'Fort Hood divorce attorney', 'Fort Bliss divorce lawyer', 'USFSPA retirement division'] }, mod: { kw: ['modify child support Texas', 'custody modification lawyer', 'how long does a modification take', 'child support calculator Texas'] } } });
  const mods = X.kwMods(MK, 'en'); eq(mods, ['Plano', 'Frisco', 'McKinney', 'Allen', 'Collin County', 'Dallas County'], 'six modifiers, cities then counties');
  const loc = X.keywords(MK, 'mod', 'en').filter(k => k.group === 'Local'); const used = new Set(); loc.forEach(k => mods.forEach(m => { if (k.kw.includes(m.toLowerCase())) used.add(m); }));
  eq([...used].sort(), mods.slice().sort(), 'every modifier shown is used, and the county modifiers appear'); assert(!loc.some(k => /extra/.test(k.kw)), 'a modifier not shown is not used');
  assert(!loc.some(k => /\btexas\b/.test(k.kw)), 'no "texas" left inside a city crossing: ' + loc.filter(k => /texas/.test(k.kw)).map(k => k.kw).join(', '));
  assert(loc.some(k => k.kw === 'custody modification lawyer plano') && loc.some(k => k.kw === 'plano custody modification lawyer'), 'lawyer seed crossed both ways');
  const mk = X.keywords(MK, 'mil', 'en'); assert(!mk.some(k => /fort (hood|bliss)/.test(k.kw)), 'no Fort Hood or Fort Bliss keywords in a Collin County plan');
  const bell = X.keywords(model(X, { counties: [{ fips: '48027', name: 'Bell', gt: '' }], markets: [{ zip: '76542', city: 'Killeen', county: '48027', county_name: 'Bell', gt: '', bid: 0 }], geoMods: ['Killeen', 'Bell County'], lineInfo: MK.lineInfo }), 'mil', 'en');
  assert(bell.some(k => k.kw === 'fort hood divorce attorney' && k.group === 'Core') && !bell.some(k => /fort bliss/.test(k.kw)) && !bell.some(k => k.group === 'Local' && /fort hood/.test(k.kw)), 'Bell County: Fort Hood seed kept in Core, never crossed with a city, Fort Bliss left out');
  const sp = X.seedPlan(MK, 'mod', 'en'); assert(sp.left.some(x => /calculator/.test(x.kw)) && sp.questions.includes('how long does a modification take') && !sp.core.some(k => /calculator|^how/.test(k)), 'DIY seeds left out, question seeds go to Questions');
  assert(X.keywords(MK, 'mod', 'en').some(k => k.group === 'Questions' && k.kw === 'how long does a modification take' && k.match === 'Phrase'), 'question seed in phrase');
  const es = X.kwMods(MK, 'es'); assert(es.includes('condado de Collin') && !es.some(m => / County$/.test(m)), 'Spanish modifiers say condado de');
  const freeM = model(X, { firm: Object.assign({}, FIRM_FULL, { consult: { free: true, fee: 0, virtual: true } }) }); assert(!X.negsFor(freeM, 'div_k', 'en').includes('free') && !X.negsFor(freeM, 'div_k', 'es').includes('gratis') && !X.negText(freeM).split('\n').includes('free'), 'a firm with free consultations does not block "free"');
  assert(X.negsFor(M, 'div_k', 'en').includes('free'), 'otherwise "free" is a negative');
  const ov = model(X, { lines: M.lines.concat([{ key: 'mil', name: 'Military divorce', short: 'Military', share: 0.1 }]) }); assert(X.negsFor(ov, 'div_k', 'en').includes('military') && !X.negsFor(ov, 'mil', 'en').includes('military') && !X.negsFor(M, 'div_k', 'en').includes('military'), 'divorce campaigns carry the overlay terms as negatives only when that line runs');
  const gx = X.google(ov); assert(gx.rows.some(r => /_DIV_K_GOOGLE_EN_/.test(r[0]) && r[gx.header.indexOf('Keyword')] === 'military' && r[gx.header.indexOf('Criterion Type')] === 'Negative Phrase'), 'cross campaign negative in the Editor file'); }

/* ---- military bases by county: Bell and Coryell carry Fort Hood (renamed from Fort Cavazos in 2025) */
const bell = X.rsa(M, 'mil', { zip: '76542', city: 'Killeen', county: '48027', county_name: 'Bell', gt: '' }, 'en');
assert(bell.h.includes('Military Divorce, Fort Hood') && !bell.h.some(h => /Cavazos/.test(h)), 'Bell County military headline names Fort Hood');
assert(X.rsa(M, 'mil', { zip: '79936', city: 'El Paso', county: '48141', county_name: 'El Paso', gt: '' }, 'en').h.includes('Military Divorce, Fort Bliss'), 'El Paso names Fort Bliss');
assert(!X.rsa(M, 'mil', M.markets[0], 'en').h.some(h => /Fort|JBSA/.test(h)), 'no base headline away from a base county');
/* ---- the 15 and 4 caps hold even with a long candidate list */
const many = X.rsa(model(X, { firm: Object.assign({}, FIRM_FULL, { consult: { free: true, fee: 0, virtual: true } }), langs: ['en', 'es'] }), 'div_k', M.markets[0], 'en');
assert(many.h.length === 15, 'RSA caps at 15 headlines when more are available'); assert(many.d.length === 4, 'RSA caps at 4 descriptions');

/* ---- prices in ads come only from the firm profile's fees (Rule 7.02(d)); the model's value per matter never appears */
{ const noFee = X.rsa(M, 'div_nk', M.markets[0], 'en'); assert(!noFee.h.some(h => /From \$|\$5,000/.test(h)) && noFee.h.filter(h => /\$/.test(h)).every(h => h === 'Consultation Fee $150'), 'no line fee in the profile: no price headline; only the profile consultation fee (value per matter is 5000 in the model and must not appear)');
  const withFee = X.rsa(model(X, { firm: Object.assign({}, FIRM_FULL, { fees: { div_nk: 3900 } }) }), 'div_nk', M.markets[0], 'en'); assert(withFee.h.includes('Agreed Divorce From $3,900'), 'the profile fee is the advertised price');
  const all2 = X.creative(M).map(a => Object.values(a.fields).join(' ')).join(' '); assert(!/\$5,000/.test(all2), 'value per matter never printed'); }
/* ---- the Rule 7.02(a) line names the primary office from the firm, never the market city */
assert(X.rsa(M, 'div_k', M.markets[2], 'en').d[0] === 'Responsible attorney: Jane Smith. Primary office: Plano, Texas.' && !X.rsa(M, 'div_k', M.markets[2], 'en').d[0].includes('Dallas'), 'the 7.02(a) line uses the primary office, not the market city (Dallas)');

/* ---- Microsoft: same rows, no Google criterion IDs */
const MS = files.microsoft; const mcol = h => MS.header.indexOf(h);
assert(MS.rows.filter(r => r[mcol('Location')]).every(r => r[mcol('ID')] === ''), 'Microsoft rows leave the Google criterion ID empty');
assert(MS.rows.filter(r => r[mcol('Campaign Type')] === 'Search').every(r => /_MICROSOFT_/.test(r[mcol('Campaign')]) && r[mcol('Campaign Status')] === 'Paused'), 'Microsoft campaigns named and paused');

/* ---- county scope: county criterion IDs */
const MC = model(X, { scope: 'counties' }); const gc = X.google(MC); const gcc = h => gc.header.indexOf(h);
const cl = gc.rows.filter(r => r[gcc('Location')]); assert(cl.length && cl.every(r => r[gcc('Location')] === 'Collin County, Texas, United States' && r[gcc('ID')] === '9059489'), 'county targets carry the county criterion ID');
/* the ZIP targets file is in the Editor layout: every location row names a Google search campaign and carries a status */
const zc = X.zipCSV(MC); eq(zc.header, ['Campaign', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status', 'Location type', 'City', 'County', 'Monthly allocation'], 'ZIP target header (Editor layout)'); eq(zc.rows[0].slice(0, 7), ['DFW_DIV_K_GOOGLE_EN_20261015', 'Collin County, Texas, United States', '9059489', '+0%', 'Location', 'Enabled', 'County'], 'county target row');
eq(zc.rows.length, 3 * 2, 'one location row per Google campaign (3 lines x 2 languages) per county');
{ const zz = X.zipCSV(M); const gc0 = new Set(X.google(M).rows.filter(r => r[0] && r[1] === 'Search').map(r => r[0])); eq(zz.rows.length, 3 * 2 * 3, 'ZIP rows: campaigns x ZIPs'); assert(zz.rows.every(r => gc0.has(r[0]) && r[4] === 'Location' && r[5] === 'Enabled'), 'every ZIP row names a campaign of the Editor file and carries a status'); eq(zz.rows[0].slice(1, 4), ['75024, Texas, United States', '9026883', '+20%'], 'ZIP row'); }

/* ---- Meta */
const MT = files.meta; const mc = h => MT.header.indexOf(h);
MT.rows.forEach(r => { ['Campaign Status', 'Ad Set Run Status', 'Ad Status'].forEach(h => eq(r[mc(h)], 'PAUSED', 'Meta ' + h)); eq(r[mc('Special Ad Categories')], '', 'legal ads run without a special ad category'); assert(r[mc('Body')].length <= 125 && r[mc('Title')].length <= 40 && r[mc('Description')].length <= 30, 'Meta limits'); eq(r[mc('Zip')], 'US:75024, US:75034, US:75201', 'Meta ZIP keys'); eq(String(r[mc('Age Min')]), '18', 'adults'); });
assert(MT.rows.some(r => r[mc('Body')].includes('Jane Smith')), 'Meta body carries the responsible lawyer where it fits');
const MR = X.meta(model(X, { plan: { metaGeo: 'radius', radius: 12, li: 'both' } })); const mrc = h => MR.header.indexOf(h);
eq(MR.rows[0][mrc('Radius')], '100 Main St, Plano, TX, 75024 (+12 mi)', 'Meta radius around the office'); eq(MR.rows[0][mrc('Zip')], '', 'no ZIPs with a radius');

/* ---- LSA, Demand Gen, LinkedIn, Yelp, Nextdoor, TikTok */
const L = files.lsa; const lv = k => (L.rows.find(r => r[0] === k) || [])[1];
eq(lv('Category'), 'Family law', 'LSA category'); assert(/Divorce/.test(lv('Case types to turn on')) && /Domestic violence/.test(lv('Case types to turn on')), 'LSA case types from the lines'); eq(lv('Service area'), '75024 75034 75201', 'LSA service area ZIPs'); eq(String(lv('Weekly budget')), String(Math.round(1000 / 4.345)), 'LSA weekly budget'); eq(lv('Status'), 'Paused', 'LSA paused'); eq(lv('Hours'), 'Monday to Friday, 8 am to 6 pm', 'LSA hours from the office');
assert(L.rows.filter(r => /^Google Screened checklist/.test(r[0])).length >= 5, 'LSA Google Screened checklist'); assert(lv('Bio').length <= 1000 && lv('Bio').includes('Jane Smith'), 'LSA bio within 1000 and carries Rule 7.02(a)');
const DG = files.dg; const dc = h => DG.header.indexOf(h); DG.rows.forEach(r => { eq(r[dc('Campaign Status')], 'Paused', 'DG paused'); eq(r[dc('Status')], 'Paused', 'DG ad paused'); [1, 2, 3, 4, 5].forEach(i => { assert(r[dc('Headline ' + i)].length <= 40, 'DG headline 40'); assert(r[dc('Description ' + i)].length <= 90, 'DG description 90'); }); assert(r[dc('Business name')].length <= 25, 'DG business name 25'); eq(r[dc('Location IDs')], '9026883; 9026890; ', 'DG location IDs'); });
const LI = files.linkedin; eq(LI.rows.length, 2, 'LinkedIn: recruiting and referral partner campaigns'); LI.rows.forEach(r => { eq(r[10], 'Paused', 'LinkedIn paused'); assert(r[8].length <= 150 && r[9].length <= 70, 'LinkedIn limits'); }); assert(/Paralegal/.test(LI.rows[0][4]) && /Accountant/.test(LI.rows[1][4]), 'LinkedIn job titles');
[['yelp', 'Headline', 50, 'Body', 500], ['nextdoor', 'Headline', 90, 'Body', 400]].forEach(([p, h, hm, b, bm]) => { const F = files[p]; F.rows.forEach(r => { eq(r[F.header.indexOf('Status')], 'Paused', p + ' paused'); assert(r[F.header.indexOf(h)].length <= hm && r[F.header.indexOf(b)].length <= bm, p + ' limits'); }); });
const TT = files.tiktok; TT.rows.forEach(r => { eq(r[TT.header.indexOf('Status')], 'Paused', 'TikTok paused'); assert(r[TT.header.indexOf('Ad text')].length <= 100 && r[TT.header.indexOf('Display name')].length <= 40, 'TikTok limits'); });

/* ---- the creative screen and needs review */
const all = X.creative(M); assert(all.length >= 3 * 2 * 5, 'creative covers every platform, line and language'); assert(all.every(a => !a.review.block), 'filled firm: no block findings with the stub engine');
const empty = Object.assign({}, FIRM_FULL, { name: '', atty: '', city: '', url: '' }); const ME = model(X, { firm: empty });
const ge = X.google(ME); const gec = h => ge.header.indexOf(h); const eads = ge.rows.filter(r => r[gec('Ad type')] === 'Responsive search ad');
assert(eads.length && eads.every(r => r[gec('Review status')] === 'needs review' && r[gec('Labels')] === 'needs review' && /BLOCK: Unfilled placeholder/.test(r[gec('Review notes')]) && /No landing page URL/.test(r[gec('Review notes')]) && r[gec('Status')] === 'Paused'), 'placeholders and a missing URL export as needs review, still paused, findings in the notes');
assert(eads[0][gec('Description 1')].includes('[Responsible attorney]'), 'empty firm leaves a visible placeholder');
const me = X.meta(ME); assert(me.rows.every(r => r[me.header.indexOf('Review status')] === 'needs review'), 'Meta needs review with an empty firm');
/* a description that cannot fit the 7.02(a) line notes the landing page */
const longFirm = Object.assign({}, FIRM_FULL, { atty: 'Alexandra Montgomery Whitfield Castellanos', city: 'North Richland Hills' }); const tk = X.social(model(X, { firm: longFirm }), 'tiktok', 'cps', 'en', M.markets[0]);
assert(tk.fields.text.length <= 100, 'TikTok text stays within 100'); const tks = X.screen('tiktok', tk.fields, 'en', tk.lp ? [{ id: 'r702a_lp', sev: 'info', note: true, title: 'landing page carries it', rule: 'Rule 7.02(a)' }] : []); assert(!tk.lp || /NOTE: landing page/.test(tks.notes), 'landing page note when the footer does not fit');
/* length blocks */
const over = X.screen('google', { headline1: 'x'.repeat(31), description1: 'ok' }, 'en'); assert(over.block && over.status === 'needs review' && /headline1 is 31 characters/.test(over.notes), 'a headline over 30 blocks');

/* ---- pacing: the flight and the month plan start at the flight start */
const seas = [100, 99, 117, 106, 103, 100, 100, 106, 102, 103, 84, 81];
const fl = X.flightMonths({ start: '2026-10-15', weeks: 13, budget: 12000, lines: [{ key: 'div_k', share: 0.6, seas, shift: 1 }, { key: 'po', share: 0.4, seas, shift: 0 }] });
eq(fl.map(x => x.label), ['Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027'], 'flight months from the start date'); eq(fl[0].days, 17, 'first month counts from the 15th'); eq(fl.reduce((a, x) => a + x.days, 0), 91, '13 weeks = 91 days');
assert(Math.abs(fl.reduce((a, x) => a + x.spend, 0) - 12000 * 13 / 4.345) < 0.01, 'the flight spends budget x weeks / 4.345');
assert(fl[1].spend / fl[1].days < fl[2].spend / fl[2].days, 'November (season 84 a month ahead) spends less a day than December (100)');
const fl2 = X.flightMonths({ start: '2026-10-15', weeks: 13, budget: 12000, lines: [{ key: 'div_k', share: 1, seas, shift: 1 }], timing: (line, d, iso) => ({ mult: iso >= '2026-12-01' && iso <= '2026-12-10' ? 2 : 1, reasons: iso >= '2026-12-01' && iso <= '2026-12-10' ? ['Calendar: holiday possession'] : [] }) });
const fl1 = X.flightMonths({ start: '2026-10-15', weeks: 13, budget: 12000, lines: [{ key: 'div_k', share: 1, seas, shift: 1 }] });
assert(fl2[2].spend > fl1[2].spend && fl2[1].spend < fl1[1].spend && fl2[2].mult > 1 && fl2[2].reasons[0].text === 'Calendar: holiday possession' && fl2[2].reasons[0].days === 10, 'live timing weights the days and keeps the reasons');
assert(Math.abs(fl2.reduce((a, x) => a + x.spend, 0) - 12000 * 13 / 4.345) < 0.01, 'live timing moves money between days without changing the flight total');
const mp = X.monthPlan({ start: '2026-10-15', lines: [{ budget: 1000, seas, shift: 1 }] });
eq(mp.length, 12, 'twelve months'); eq(mp[0].label, 'Oct 2026', 'the month plan starts in the flight start month'); eq(mp[11].label, 'Sep 2027', 'and runs a year');
assert(Math.abs(mp.reduce((a, x) => a + x.spend, 0) - 12000) < 0.01, 'the month plan spends twelve monthly budgets');
eq(X.monthPlan({ start: '2027-03-01', lines: [] })[0].label, 'Mar 2027', 'another start month');
eq(X.endDate('2026-10-01', 13), '2026-12-30', 'end date is inclusive');
const fc = X.flightCSV(M, fl); eq(fc.header, ['month', 'days', 'season_index', 'live_multiplier', 'media_usd', 'live_reasons'], 'flight CSV header'); eq(fc.rows[0][0], 'Oct 2026', 'flight CSV starts at the flight start');

/* ---- the build 1 exports, kept */
{ const kc = X.kwCSV(M); eq(kc.header, ['Campaign', 'Ad Group', 'Keyword', 'Criterion Type', 'Status'], 'keywords CSV in the Editor layout'); assert(kc.rows.every(r => /_GOOGLE_(EN|ES)_20261015$/.test(r[0]) && r[4] === 'Enabled' && ['Exact', 'Phrase', 'Negative Phrase'].includes(r[3])), 'every keyword row names its campaign, a criterion type and a status'); assert(kc.rows.some(r => r[3] === 'Negative Phrase' && r[2] === 'pro bono' && r[1] === ''), 'campaign negatives in the keyword file'); }
assert(X.negText(M).split('\n').includes('pro bono') && X.negText(M).split('\n').includes('gratis'), 'negatives text');
eq(X.planCSV(M).header.slice(0, 9), ['geography', 'line', 'expected_matters', 'value_per_matter', 'share_pct', 'budget_month', 'leads_month', 'retained_month', 'matter_value_month'], 'plan CSV header (build 1 columns first; value retained, not cash)');
{ const MO = model(X, { lines: [{ key: 'div_k', name: 'Divorce with children', short: 'Divorce, kids', share: 0.5, n: 1000, nNet: 800, fee: 9500, budget: 600 }, { key: 'high', name: 'High asset', short: 'High asset', share: 0.5, n: 250, nNet: 200, overlay: true, pinned: true, fee: 35000, budget: 600 }], nTotal: 1000 });
  const pc = X.planCSV(MO); const H = pc.header; const tot = pc.rows[pc.rows.length - 1];
  eq(tot[H.indexOf('expected_matters')], 1000, 'plan total counts each matter once (not 1000 + 250)'); eq(pc.rows[1][H.indexOf('overlay_of')], 'divorce with and without children', 'overlay line marked'); eq(pc.rows[1][H.indexOf('share_set_by')], 'user', 'a share the user set is marked'); eq(pc.rows[0][H.indexOf('matters_counted')], 800, 'matters counted once per line'); }
{ const MS2 = model(X, { lines: M.lines.map(l => Object.assign({}, l, { seas, shift: 1 })) }); const pc = X.planCSV(MS2); const mi = pc.header.indexOf('Oct 2026 usd');
  assert(mi > 0 && pc.header[mi + 11] === 'Sep 2027 usd', 'plan CSV carries the twelve month plan from the flight start month');
  const tot = pc.rows[pc.rows.length - 1]; eq(tot[1], 'Total', 'plan CSV total row'); assert(Math.abs(+tot[mi] - pc.rows.slice(0, -1).reduce((a, r) => a + +r[mi], 0)) <= 2, 'total row sums the lines for the month');
  assert(Math.abs(pc.rows.slice(0, -1).reduce((a, r) => a + pc.header.slice(mi, mi + 12).reduce((b, h) => b + +r[pc.header.indexOf(h)], 0), 0) - 3 * 1000 * 12) < 12, 'each line plans twelve monthly budgets'); }
/* export names: severance_desk_<geo slug>_<start>_<what>.<ext> */
eq(files.google.name, 'severance_desk_dallas-fort-worth_2026-10-15_google-ads-editor.csv', 'Google file name'); eq(X.fname(model(X, { geo: { code: 'HARRISCO', title: 'Harris County' } }), 'plan', 'json'), 'severance_desk_harris-county_2026-10-15_plan.json', 'plan file name');
X.PLATS.forEach(p => assert(/^severance_desk_dallas-fort-worth_2026-10-15_[a-z-]+\.csv$/.test(files[p].name), p + ' file name pattern: ' + files[p].name));
/* a CPC of 0 leaves Max CPC empty instead of inventing one */
{ const z = X.google(model(X, { lines: M.lines.map(l => Object.assign({}, l, { cpc: 0, cpcMs: 0 })) })); const zc2 = h => z.header.indexOf(h); assert(z.rows.filter(r => r[zc2('Ad Group Type')] === 'Standard').every(r => r[zc2('Max CPC')] === ''), 'CPC 0: Max CPC blank'); }
eq(X.creativeCSV(M).header, ['platform', 'line', 'language', 'ad', 'field', 'text', 'chars', 'limit', 'review status', 'review notes'], 'creative library header');

/* ---- the line mix */
const mix = X.lineMix([{ key: 'po', share: 1 }]); eq(mix.lsa, 26, 'protective order mix'); const mix2 = X.lineMix([{ key: 'po', share: 0.5 }, { key: 'div_k', share: 0.5 }]); eq(mix2.google, Math.round((52 + 46) / 2), 'budget weighted blend');

/* ---- module 10's model helpers (src/29_m10_desk.js): each matter counted once, shares held exactly, no silent $0 plan */
{ const LM = { div_k: { cnt: c => c.lines.div_k.n, pool: c => c.lines.div_k.pool }, div_nk: { cnt: c => c.lines.div_nk.n, pool: c => c.lines.div_nk.pool }, sapcr: { cnt: c => c.lines.sapcr.n, pool: c => c.lines.sapcr.pool }, adopt: { cnt: c => c.lines.adopt.n, pool: () => null }, prenup: { cnt: c => c.lines.prenup.est, pool: c => c.lines.prenup.pool }, high: { cnt: c => c.lines.high.n, pool: c => c.lines.high.pool }, mil: { cnt: c => c.lines.mil.n, pool: c => c.lines.mil.pool }, gray: { cnt: c => c.lines.gray.n, pool: c => c.lines.gray.pool } };
  const cty = (fips, pop, f, lines) => ({ fips, pop2025: pop, filings: { ttm: f }, lines });
  const L1 = { div_k: { n: 400, pool: 10000 }, div_nk: { n: 600, pool: 20000 }, sapcr: { n: 200, pool: 5000 }, adopt: { n: 50 }, prenup: { est: 30, pool: 900 }, high: { n: 200, pool: 4000 }, mil: { n: 10, pool: 300 }, gray: { n: 250, pool: 6000 } };
  const L0 = { div_k: { n: 0, pool: 1000 }, div_nk: { n: 0, pool: 2000 }, sapcr: { n: 0, pool: 500 }, adopt: { n: 0 }, prenup: { est: 3, pool: 90 }, high: { n: 0, pool: 400 }, mil: { n: 0, pool: 0 }, gray: { n: 0, pool: 600 } };
  const CTY = [cty('48001', 100000, { div: 1000, sapcr: 200 }, L1), cty('48407', 10000, { div: 0, sapcr: 0, po: 0 }, L0)];
  const dctx = vm.createContext({ console, LINE_META: LM, CTY, registerModule: () => {}, FIRM: { get: () => ({}), lines: () => [] }, isFinite, Math });
  vm.runInContext(read('src/29_m10_desk.js') + '\n;globalThis.T = { dkCountOnce, dkShares, dkCount, dkReports };', dctx, { filename: 'src/29_m10_desk.js' }); const T = dctx.T;
  const rows = ['div_k', 'div_nk', 'high', 'gray', 'mil'].map(k => ({ key: k, n: L1[k].n }));
  const r = T.dkCountOnce(rows, 1000); const by = Object.fromEntries(rows.map(x => [x.key, x]));
  const U = 1000 * (1 - (1 - 0.2) * (1 - 0.25) * (1 - 0.01)); assert(Math.abs(r.U - U) < 1e-9, 'overlay union assumes random overlap: ' + r.U);
  assert(Math.abs(r.total - 1000) < 1e-9, 'with both divorce lines, the counted total is the divorce count: ' + r.total);
  assert(by.high.overlay && !by.div_k.overlay && Math.abs(by.div_k.nNet - 400 * (1 - U / 1000)) < 1e-9 && Math.abs(by.high.nNet + by.gray.nNet + by.mil.nNet - U) < 1e-9, 'overlays carved out of the divorce lines');
  const r2 = T.dkCountOnce([{ key: 'div_k', n: 400 }, { key: 'high', n: 200 }], 1000); assert(Math.abs(r2.total - (400 + 200 * 600 / 1000)) < 1e-9, 'with one divorce line, the overlay counts only its part outside it: ' + r2.total);
  const r3 = T.dkCountOnce([{ key: 'high', n: 200 }, { key: 'gray', n: 250 }], 1000); assert(Math.abs(r3.total - 1000 * (1 - 0.8 * 0.75)) < 1e-9, 'two overlays alone: their union, not their sum');
  const sh = rows => rows.map(x => +(x.share * 100).toFixed(6));
  const a = [{ key: 'div_k', w: 600 }, { key: 'div_nk', w: 300 }, { key: 'sapcr', w: 100 }]; let n = T.dkShares(a, null); eq(sh(a), [60, 30, 10], 'model shares follow the weights'); eq(n.unalloc, 0, 'nothing unallocated');
  n = T.dkShares(a, { div_k: 20 }); eq(sh(a), [20, 60, 20], 'a typed share stays exactly; the others split the rest by weight');
  n = T.dkShares(a, { div_k: 20, div_nk: 30 }); eq(sh(a), [20, 30, 50], 'two typed shares both stay');
  n = T.dkShares(a, { div_k: 20, div_nk: 30, sapcr: 10 }); eq(sh(a), [20, 30, 10], 'every line typed: held as typed'); assert(Math.abs(n.unalloc - 0.4) < 1e-9, 'and the remainder is reported unallocated');
  n = T.dkShares(a, { div_k: 80, div_nk: 40 }); assert(n.over === 120 && a[2].share === 0 && Math.abs(a[0].share - 80 / 120) < 1e-9, 'over 100: pins scaled to fit and reported');
  n = T.dkShares([{ key: 'x', w: 0 }, { key: 'y', w: 0 }], null); assert(n.equal && a.length && Math.abs(n.sum - 1) < 1e-9, 'no matters at all: an equal split, reported');
  assert(!T.dkReports(CTY[1]) && T.dkReports(CTY[0]), 'a county with no family filings is not reporting');
  const e = T.dkCount('div_k', CTY[1]); assert(e.est && Math.abs(e.n - 1000 * 400 / 10000) < 1e-9, 'a county that reports nothing is estimated from the statewide rate per pool: ' + e.n);
  const ea = T.dkCount('adopt', CTY[1]); assert(ea.est && Math.abs(ea.n - 10000 * 50 / 100000) < 1e-9, 'a line with no pool is estimated per resident');
  eq(T.dkCount('prenup', CTY[1]), { n: 3, est: false }, 'prenups keep their own estimate'); eq(T.dkCount('div_k', CTY[0]), { n: 400, est: false }, 'a reporting county keeps its filings'); }

/* ---- the real compliance engine, when it loads: a filled firm profile yields no block findings */
let real = null;
try {
  const ctx2 = vm.createContext({ console, FIRM: { responsible: () => ({ name: 'Jane Smith', tbls: '' }), primary: () => ({ city: 'Plano' }), get: () => ({ name: 'Smith Family Law', attorneys: [{ name: 'Jane Smith', tbls: '' }], consult: { fee: 150, free: false }, fees: {} }), certs: () => [], name: () => 'Smith Family Law' } });
  vm.runInContext(read('src/03_lint.js') + '\n;globalThis.LINT = LINT;', ctx2, { filename: 'src/03_lint.js' });
  vm.runInContext(read('src/10_desk_platforms.js') + '\n;globalThis.DESKX = DESKX;', ctx2, { filename: 'src/10_desk_platforms.js' });
  real = ctx2;
} catch (e) { console.log('real LINT skipped: ' + e.message); }
if (real) {
  const RX = real.DESKX; const keys = Object.keys(RX.LIB); const lineInfo = {}; keys.forEach(k => lineInfo[k] = { kw: ['divorce lawyer'] });
  const RM = model(RX, { lines: keys.map(k => ({ key: k, name: k, short: k, share: 1 / keys.length, cpc: 9.87, cpcMs: 6.6 })), lineInfo });
  const blocks = RX.creative(RM).filter(a => a.review.block);
  assert(!blocks.length, 'real LINT: every generated ad passes with a filled firm profile; blocked: ' + blocks.map(a => a.label + ' ' + a.lang + ': ' + a.review.notes).join(' || '));
  const files2 = RX.PLATS.map(p => RX[p](RM)); assert(files2.every(f => f.rows.length), 'real LINT: every writer runs');
  console.log(`real LINT: ${RX.creative(RM).length} ads across ${keys.length} lines and 2 languages, no block findings`);
}
console.log('desk ok');
