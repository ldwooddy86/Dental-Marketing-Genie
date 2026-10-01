'use strict';
/* ============================ the shared paid and service line model ============================
   SEV_MODEL  one store of the paid and service line assumptions ('sev.model'), read by Paid Acquisition (07), Service Lines (06) and
              the Campaign Desk. A value is the user's own input, else the Accounts actuals the user applied (ACCT.applied()), else the
              build default; the newer of a user input and an Apply wins. Every default is grade D until actuals replace it (grade B).
              SEV_MODEL.set(patch) and reset() persist and emit BUS 'model'; BUS 'actuals' and 'watch' re-emit it.
                SEV_MODEL.get('cpc') · SEV_MODEL.info('g'|'line'|'rate', id, key) → {v, src: 'you'|'actuals'|'default', g, def}
                SEV_MODEL.line(id) → {fee, realization, cvr, show, close, retain, cpcMult, pipe, contested, flat, lsaCpl, metaCpl, src:{}}
                SEV_MODEL.rate(key) · SEV_MODEL.set({cpc, budget, alpha, share, lines:{id:{key: v|null}}, rates:{key: v|null}})
   FLM        per ZIP, per line economics for the ZIPs of one metro (never embedded; computed on demand and cached by model version):
                FLM.compute(metro) → {code, rows (one per ZIP: payer weight, fee value index, competition, click cost index, matter mass,
                fee pool, opportunity, efficiency, quadrant, tier, bid, angles, levers), by:{zip: row}, cells:{zip:{line: cell}},
                lines:{line: {agg}}, med, km}. A cell: matters, payable, value, contribution (pipeline credit included), pressure
                percentile (law office density within the radius times the rivals logged in Competitor Watch), cost, priority
                percentile, one of six bid bands, quiet auction.
                Also econ(line, rel, fvi), blended(line, rel), cplByPlatform(line, rel), allocate(metro, budget, month, zips, alpha),
                season(line), grid(line, observed), hourlyPlan(line, from, days), and the export writers.
   FL_ANGLES  the angles each ZIP triggers from its own data (children at home, unmarried parents, high asset, gray, military, job loss
              modification, stepparent adoption, new marriages, agreed flat fee, protective order and single parent orders). */
const SEV_MODEL = (() => {
  const KEY = 'sev.model';
  const IDS = ['div_k', 'div_nk', 'sapcr', 'mod', 'enf', 'po', 'ivd', 'adopt', 'cps', 'prenup', 'high', 'mil', 'gray'];
  /* the account and portfolio inputs */
  const GF = {
    cpc: { l: 'Account average CPC ($)', def: 9.87, min: 0, max: 1000, step: 0.05, src: 'median legal services CPC on Google search, Apr 2025 to Mar 2026 (WordStream), a national benchmark used as a default' },
    budget: { l: 'Monthly media ($)', def: 10000, min: 0, max: 1e8, step: 500, src: 'a planning default' },
    alpha: { l: 'Concentration', def: 1, min: 0.5, max: 2.5, step: 0.1, src: '1 spends in proportion to value; below 1 spreads the buy, above 1 concentrates it' },
    share: { l: 'Click share wanted (%)', def: 15, min: 0, max: 100, step: 1, src: 'a planning default' }
  };
  /* per line (fee comes from module 06, LINE_META.fee) */
  const LF = {
    fee: { l: 'Value per retained matter ($)', min: 0, max: 1e7, step: 250, src: 'module 06 default for the line, a placeholder for the firm\'s fee history' },
    realization: { l: 'Fee collected (%)', def: 90, min: 0, max: 100, step: 1, src: 'an assumption: the share of the billed fee the firm collects' },
    cvr: { l: 'Search click to lead (%)', def: 5.55, min: 0, max: 100, step: 0.05, src: 'median legal conversion rate (WordStream); family law converted at 8.52% in the 2023 LocaliQ cut' },
    show: { l: 'Consultations that show (%)', def: 55, min: 0, max: 100, step: 1, src: 'an assumption; with 40% retained it reproduces the 22% lead to retained default of the desk' },
    close: { l: 'Consultations retained (%)', def: 40, min: 0, max: 100, step: 1, src: 'an assumption; Accounts replaces it with the observed lead to retained rate divided by the show rate' },
    cpcMult: { l: 'CPC multiple of the account average', def: 1, min: 0, max: 10, step: 0.05, src: 'no line level benchmark in this build; every line starts at the account average' },
    pipe: { l: 'Matters that lead to a follow on matter (%)', def: 0, min: 0, max: 100, step: 1, src: 'an assumption; custody suits lead to modifications, protective order respondents to divorce, divorces with children to enforcement' },
    contested: { l: 'Retained matters that are contested (%)', def: 100, min: 0, max: 100, step: 1, src: 'at 100 every matter is valued at the fee above; lower it to value part of the matters at the flat fee' },
    flat: { l: 'Flat fee for an agreed matter ($)', def: null, min: 0, max: 1e7, step: 250, src: 'blank means the same as the value per matter; a flat fee does not vary by ZIP' },
    lsaCpl: { l: 'Local Services cost per lead ($)', def: 140, min: 0, max: 1e5, step: 5, src: 'the Campaign Desk benchmark, near the $131.63 median legal cost per lead (WordStream)' },
    metaCpl: { l: 'Meta cost per lead ($)', def: 35, min: 0, max: 1e5, step: 5, src: 'the Campaign Desk Meta benchmark: $14 CPM, 1% click through and 4% conversion' }
  };
  const PIPE0 = { sapcr: 10, po: 10, div_k: 5 };
  /* shares and weights the economics need (percent unless noted) */
  const RF = {
    poRespondentShare: { l: 'Protective order matters on the respondent side (%)', def: 45, min: 0, max: 100, step: 1, src: 'an assumption: applicants pay no filing or service fee (Fam. Code § 81.002) and prosecutors can apply for them (§ 82.002), so the paying market is mostly respondents' },
    ivdPrivShare: { l: 'IV-D matters with a privately paying parent (%)', def: 10, min: 0, max: 100, step: 1, src: 'an assumption: the Attorney General is the Title IV-D agency (ch. 231) and its lawyers represent the state' },
    cpsNonIndigentShare: { l: 'CPS parents who are not indigent (%)', def: 25, min: 0, max: 100, step: 1, src: 'an assumption: indigent parents in DFPS suits receive appointed counsel (§ 107.013)' },
    payLow: { l: 'Payer weight, households under $35,000', def: 0.35, min: 0, max: 1, step: 0.05, src: 'an assumption: ability to pay is weighted, not excluded' },
    payMid: { l: 'Payer weight, households $35,000 to $60,000', def: 0.7, min: 0, max: 1, step: 0.05, src: 'an assumption' },
    radiusKm: { l: 'Neighborhood radius (km)', def: 8, min: 1, max: 40, step: 1, src: 'about 5 miles, the radius a local search campaign buys' },
    pressStep: { l: 'Pressure added per logged live rival ad (times)', def: 0.6, min: 0, max: 5, step: 0.1, src: 'an assumption; the Thermal Atlas weight' },
    pressCap: { l: 'Most pressure logged ads can add (times)', def: 2, min: 0, max: 10, step: 0.5, src: 'an assumption' },
    searchPerFiling: { l: 'Searches a month per private family filing a year', def: 2, min: 0, max: 1000, step: 0.5, src: 'an order of magnitude only; replace it with the metro total from Keyword Planner' }
  };
  const FIELDS = { g: GF, line: LF, rate: RF };
  const isNum = v => typeof v === 'number' && isFinite(v);
  const pathOf = (sc, id, k) => sc === 'line' ? `lines.${id}.${k}` : sc === 'rate' ? `rates.${k}` : k;
  /* the user's own values: {g:{}, lines:{id:{}}, rates:{}, at:{path: ms}} */
  function clean(s) {
    const o = { g: {}, lines: {}, rates: {}, at: {} }; if (!s || typeof s !== 'object') return o;
    const num = (F, v) => v === null ? null : (v === '' || v == null || !isFinite(+v)) ? undefined : clamp(+v, F.min, F.max);
    Object.keys(GF).forEach(k => { const v = num(GF[k], (s.g || {})[k]); if (v != null) o.g[k] = v; });
    Object.keys(RF).forEach(k => { const v = num(RF[k], (s.rates || {})[k]); if (v != null) o.rates[k] = v; });
    IDS.forEach(id => { const L = (s.lines || {})[id]; if (!L || typeof L !== 'object') return; Object.keys(LF).forEach(k => { const v = num(LF[k], L[k]); if (v != null) (o.lines[id] = o.lines[id] || {})[k] = v; }); });
    if (s.at && typeof s.at === 'object') Object.keys(s.at).forEach(p => { if (isNum(+s.at[p])) o.at[p] = +s.at[p]; });
    return o;
  }
  let U = clean(store.get(KEY, null)); let ver = 1;
  const save = () => store.set(KEY, U);
  const emit = what => { ver++; if (typeof BUS !== 'undefined' && BUS) BUS.emit('model', { what }); };
  /* Accounts: what the user applied (ACCT.applied(): {cpc, cvr, retain, fee, lines:{id:{cpc, cvr, retain, fee, n, since}}}) */
  const hasACCT = () => typeof ACCT !== 'undefined' && ACCT && typeof ACCT.applied === 'function';
  const applied = () => { if (!hasACCT()) return null; try { return ACCT.applied() || null; } catch (e) { return null; } };
  const appliedMeta = () => { try { const a = ACCT.S && ACCT.S.settings && ACCT.S.settings.applied; return a || null; } catch (e) { return null; } };
  const appliedAt = () => { const a = appliedMeta(); const t = a ? Date.parse(a.at) : NaN; return isNum(t) ? t : 0; };
  const pos = v => { v = v == null || v === '' ? NaN : +v; return isNum(v) && v > 0 ? v : null; };
  const defOf = (sc, id, k) => { if (sc === 'line') { if (k === 'fee') { const L = typeof LINE_META !== 'undefined' ? LINE_META[id] : null; return L && isNum(L.fee) ? L.fee : null; } if (k === 'pipe') return PIPE0[id] || 0; return LF[k].def; } return FIELDS[sc][k].def; };
  const userOf = (sc, id, k) => { const v = sc === 'line' ? (U.lines[id] || {})[k] : sc === 'rate' ? U.rates[k] : U.g[k]; return isNum(v) ? v : null; };
  function actualOf(sc, id, k) {
    const a = applied(); if (!a) return null;
    if (sc === 'g') return k === 'cpc' ? pos(a.cpc) : null;
    if (sc !== 'line') return null; const L = (a.lines || {})[id] || {};
    if (k === 'cvr') return pos(L.cvr) != null ? pos(L.cvr) : pos(a.cvr);
    if (k === 'fee') return pos(L.fee);
    if (k === 'close') { const r = pos(L.retain) != null ? pos(L.retain) : pos(a.retain); if (r == null) return null; const sh = info('line', id, 'show').v; return sh > 0 ? clamp(r / sh * 100, 0, 100) : null; }
    if (k === 'cpcMult') { const c = pos(L.cpc); const g = info('g', null, 'cpc').v; return c != null && g > 0 ? clamp(c / g, 0, 10) : null; }
    return null;
  }
  /* the value in force and where it came from: the user's input or the applied actuals, whichever is newer; else the default */
  function info(sc, id, k) {
    const F = FIELDS[sc] && FIELDS[sc][k]; if (!F) return { v: null, src: 'default', g: 'D', def: null };
    const def = defOf(sc, id, k); const uv = userOf(sc, id, k); const av = actualOf(sc, id, k); const p = pathOf(sc, id, k);
    if (av != null && (uv == null || (U.at[p] || 0) < appliedAt())) { const m = appliedMeta(); const L = sc === 'line' && m && m.patch && m.patch.lines ? m.patch.lines[id] : null; return { v: av, src: 'actuals', g: 'B', def, since: (L && L.since) || (m && m.since) || '', user: uv }; }
    if (uv != null) return { v: uv, src: 'you', g: null, def };
    return { v: def, src: 'default', g: 'D', def };
  }
  /* the values in force, cached until the next set, reset or Accounts change (each bumps the version) */
  let C = { ver: 0, g: {}, rate: {}, line: {} };
  const cache = () => { if (C.ver !== ver) C = { ver, g: {}, rate: {}, line: {} }; return C; };
  const get = k => { const c = cache().g; return k in c ? c[k] : (c[k] = info('g', null, k).v); };
  const rate = k => { const c = cache().rate; return k in c ? c[k] : (c[k] = info('rate', null, k).v); };
  function line(id) {
    const c = cache().line; if (c[id]) return c[id];
    const o = { id, src: {} }; Object.keys(LF).forEach(k => { const x = info('line', id, k); o[k] = x.v; o.src[k] = x.src; });
    o.retain = isNum(o.show) && isNum(o.close) ? o.show * o.close / 100 : null;   // lead to retained (%)
    return (c[id] = o);
  }
  function set(patch) {
    if (!patch || typeof patch !== 'object') return; const now = Date.now(); let n = 0;
    const put = (sc, id, k, v) => { const F = FIELDS[sc][k]; if (!F) return; const p = pathOf(sc, id, k); const box = sc === 'line' ? (U.lines[id] = U.lines[id] || {}) : sc === 'rate' ? U.rates : U.g;
      if (v === null || v === '') { if (k in box) { delete box[k]; delete U.at[p]; n++; } return; }
      v = +v; if (!isNum(v)) return; box[k] = clamp(v, F.min, F.max); U.at[p] = now; n++; };
    Object.keys(GF).forEach(k => { if (k in patch) put('g', null, k, patch[k]); });
    if (patch.rates) Object.keys(patch.rates).forEach(k => put('rate', null, k, patch.rates[k]));
    if (patch.lines) Object.keys(patch.lines).forEach(id => { if (IDS.includes(id) && patch.lines[id]) Object.keys(patch.lines[id]).forEach(k => put('line', id, k, patch.lines[id][k])); });
    Object.keys(U.lines).forEach(id => { if (!Object.keys(U.lines[id]).length) delete U.lines[id]; });
    if (n) { save(); emit('set'); }
  }
  function reset(id) { if (id && IDS.includes(id)) { delete U.lines[id]; Object.keys(U.at).forEach(p => { if (p.startsWith(`lines.${id}.`)) delete U.at[p]; }); } else U = clean(null); save(); emit('reset'); }
  /* everything in force, for the assumptions files */
  function snapshot() {
    const pick = (sc, id, k) => { const x = info(sc, id, k); return { value: x.v, source: x.src === 'you' ? 'your input' : x.src === 'actuals' ? 'Accounts actuals' + (x.since ? ' since ' + x.since : '') : 'default (grade D)' }; };
    return { store: KEY, saved: todayISOm(), account: Object.fromEntries(Object.keys(GF).map(k => [k, pick('g', null, k)])), rates: Object.fromEntries(Object.keys(RF).map(k => [k, pick('rate', null, k)])), lines: Object.fromEntries(IDS.map(id => [id, Object.fromEntries(Object.keys(LF).map(k => [k, pick('line', id, k)]))])) };
  }
  const todayISOm = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  if (typeof BUS !== 'undefined' && BUS) { BUS.on('actuals', () => emit('actuals')); BUS.on('watch', () => emit('watch')); }
  return { KEY, IDS, GF, LF, RF, PIPE0, get version() { return ver; }, info, get, rate, line, set, reset, snapshot, user: () => JSON.parse(JSON.stringify(U)), applied, appliedAt, touch: what => emit(what || 'touch') };
})();

/* ---------- the angles a ZIP triggers from its own data (statewide thresholds over every metro ZIP) ---------- */
const FL_ANGLES = (() => {
  let Q = null; const MED = {};
  const qt = (a, p) => { const v = a.filter(x => typeof x === 'number' && isFinite(x)).sort((x, y) => x - y); if (!v.length) return null; const h = (v.length - 1) * p, l = Math.floor(h); return v[l] + (v[Math.min(v.length - 1, l + 1)] - v[l]) * (h - l); };
  const q = () => Q || (Q = { kids: qt(ZC.map(z => z.acs.mc_kids_sh), 0.5), cohab: qt(ZC.map(z => z.acs.cohab_kids_sh), 0.5), births: qt(ZC.map(z => z.acs.births_unmar_sh), 0.5), renter: qt(ZC.map(z => z.acs.renter_sh), 0.5), sp: qt(ZC.map(z => z.acs.sp_kids_sh), 0.5), remar: qt(ZC.map(z => z.risk && z.risk.remarried), 0.75), marly: qt(ZC.map(z => z.risk && z.risk.mar_ly), 0.75), po: qt(ZC.map(z => ((CI[z.county] || {}).rates || {}).po_per_10k), 0.75) });
  const medInc = code => MED[code] != null ? MED[code] : (MED[code] = qt(ZC.filter(z => z.msa === code).map(z => z.acs.med_hh_inc), 0.5));
  const gt = (v, t) => typeof v === 'number' && t != null && v > t;
  const MIL_FIPS = ['48027', '48099', '48141', '48029'];   // Bell, Coryell (Fort Hood), El Paso (Fort Bliss), Bexar (Joint Base San Antonio)
  return [
    { id: 'kids', short: 'Children at home', line: 'div_k', why: 'Married couple families with children above the statewide ZIP median: conservatorship, possession and support creative.', trig: z => gt(z.acs.mc_kids_sh, q().kids) },
    { id: 'unmarried', short: 'Unmarried parents', line: 'sapcr', why: 'Cohabiting couples with children or births to unmarried mothers above the statewide ZIP median: paternity and custody (SAPCR) creative.', trig: z => gt(z.acs.cohab_kids_sh, q().cohab) || gt(z.acs.births_unmar_sh, q().births) },
    { id: 'high', short: 'High asset', line: 'high', why: 'Households over $150,000 at 20% or more, or a median home value of $500,000 or more: separate property and business interest creative.', trig: z => (z.acs.inc_150k_sh || 0) >= 0.2 || (z.acs.med_value || 0) >= 500000 },
    { id: 'gray', short: 'Gray divorce', line: 'gray', why: 'Married adults 55 and over at 40% or more of the married: retirement division and maintenance creative.', trig: z => (z.acs.mar_55p_sh || 0) >= 0.4 },
    { id: 'mil', short: 'Military', line: 'mil', why: 'Active duty exposure among the married at 3% or more, or a county with a major installation (Bell, Coryell, El Paso, Bexar): residency and deployment creative.', trig: z => ((z.risk && z.risk.mil_active) || 0) >= 0.03 || MIL_FIPS.includes(z.county) },
    { id: 'jobloss', short: 'Job loss modification', line: 'mod', why: 'County Economic Shock Index at 75 or above, or county unemployment claims 10% or more above a year earlier: support modification creative.', trig: z => (z.county_esi || 0) >= 75 || (((CI[z.county] || {}).econ || {}).claims_vs_yago || 0) >= 1.1 },
    { id: 'stepparent', short: 'Stepparent adoption', line: 'adopt', why: 'Remarried share of the married in the top quarter of metro ZIPs statewide: stepparent adoption creative.', trig: z => gt(z.risk && z.risk.remarried, q().remar) },
    { id: 'newlywed', short: 'New marriages', line: 'prenup', why: 'Married in the past year in the top quarter of metro ZIPs statewide: premarital and partition agreement creative.', trig: z => gt(z.risk && z.risk.mar_ly, q().marly) },
    { id: 'flat', short: 'Agreed, flat fee', line: 'div_nk', why: 'Renters above the statewide ZIP median and household income below the metro median: agreed divorce and flat fee creative, with the fee exactly as the firm profile states it.', trig: z => gt(z.acs.renter_sh, q().renter) && typeof z.acs.med_hh_inc === 'number' && z.acs.med_hh_inc < medInc(z.msa) },
    { id: 'po', short: 'Protective orders', line: 'po', why: 'The county\'s protective order filings per 10,000 residents are in the top quarter of metro ZIPs statewide: respondent and applicant pages, around the clock.', trig: z => gt(((CI[z.county] || {}).rates || {}).po_per_10k, q().po) },
    { id: 'orders', short: 'Existing orders', line: 'enf', why: 'Single parent families with children above the statewide ZIP median: enforcement and modification of existing orders.', trig: z => gt(z.acs.sp_kids_sh, q().sp) }
  ];
})();

/* ---------- per ZIP, per line economics for one metro ---------- */
const FLM = (() => {
  const M = SEV_MODEL;
  const ADD = ['div_k', 'div_nk', 'sapcr', 'mod', 'enf', 'po', 'ivd', 'adopt', 'cps', 'prenup'];   // additive: every matter once
  const LENS = ['high', 'mil', 'gray'];   // lenses inside the divorce counts: they rank ZIPs, they are never added
  const ALL = ADD.concat(LENS);
  const PAYER = { po: 'poRespondentShare', ivd: 'ivdPrivShare', cps: 'cpsNonIndigentShare' };
  const PIPE_TO = { sapcr: 'mod', po: 'div', div_k: 'enf' };
  const QUICK = ['mod', 'enf', 'po'];   // quick turn: modification, enforcement, the protective order respondent
  const QN = ['Anchor', 'Whitespace', 'Niche', 'Avoid'];
  const QD = ['Opportunity at the 65th percentile or above, competition at the 60th or above: dear because valuable', 'High opportunity, competition below the 60th percentile: buy first', 'Lower opportunity, competition below the 60th percentile: small and cheap, often profitable', 'Lower opportunity, crowded: spend elsewhere'];
  const TIERS = ['A+', 'A', 'B', 'C', 'D', 'E']; const TIER_CUT = [95, 85, 70, 50, 30, -1]; const TIER_BID = [45, 30, 15, 0, -20, -40];
  const BANDS = [[90, 45], [75, 30], [55, 15], [35, 0], [15, -20], [-1, -40]];   // priority percentile → starting bid modifier (%)
  const isNum = v => typeof v === 'number' && isFinite(v);
  const nz = v => isNum(v) && v > 0 ? v : 0;
  const LM = id => (typeof LINE_META !== 'undefined' && LINE_META[id]) || null;
  const qt = (a, p) => { const v = a.filter(isNum).sort((x, y) => x - y); if (!v.length) return null; const h = (v.length - 1) * p, l = Math.floor(h); return v[l] + (v[Math.min(v.length - 1, l + 1)] - v[l]) * (h - l); };
  const med = a => qt(a, 0.5);
  /* percentile of v among a (share strictly below, 0 to 100), with a sorted copy and binary search */
  const ranker = a => { const s = a.filter(isNum).sort((x, y) => x - y); return v => { if (!isNum(v) || !s.length) return null; let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < v) lo = m + 1; else hi = m; } return 100 * lo / s.length; }; };
  const tierOf = e => { const i = TIER_CUT.findIndex(c => isNum(e) && e >= c); return i < 0 ? 5 : i; };
  const bandOf = p => (BANDS.find(b => isNum(p) && p >= b[0]) || BANDS[5])[1];
  const quadOf = (o, c) => o >= 65 ? (c >= 60 ? 0 : 1) : (c >= 60 ? 3 : 2);
  /* ---- the metro projection: km per map unit from the metro's bounds (an equirectangular fit, about 1% at metro scale) */
  function kmPer(code) { const G = GEO.metros && GEO.metros[code]; if (!G || !G.bounds) return null; const [x0, y0, x1, y1] = G.bounds; const lat = (y0 + y1) / 2 * Math.PI / 180; return Math.max((x1 - x0) * Math.cos(lat) * 111.32 / G.W, (y1 - y0) * 110.57 / G.H); }
  const distKm = (code, a, b) => { const k = kmPer(code); return k && a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) * k : null; };
  /* the view box around some ZIPs of a metro map (drawMap's view), padded and at the metro map's shape so the map keeps its size */
  function box(code, zips) {
    const G = GEO.metros && GEO.metros[code]; if (!G || !zips || !zips.length) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    zips.forEach(z => { const n = (G.zcta[z] || '').match(/-?\d+(?:\.\d+)?/g) || []; for (let i = 0; i + 1 < n.length; i += 2) { const x = +n[i], y = +n[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
    if (!isFinite(x0)) return null; let w = x1 - x0, h = y1 - y0; const pad = Math.max(w, h) * 0.08 + 4; x0 -= pad; y0 -= pad; w += 2 * pad; h += 2 * pad;
    const asp = G.W / G.H; if (w / h < asp) { const nw = h * asp; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / asp; y0 -= (nh - h) / 2; h = nh; }
    return [x0, y0, w, h];
  }
  /* ---- matters a year by line in a ZIP: the court allocation where the courts report the line; the county count spread by a
     composition weight for the lines without one */
  const marr = z => (z.acs && z.acs.married) || 0;
  const W_OF = { high: z => marr(z) * ((z.risk && z.risk.inc_150k) || 0), mil: z => marr(z) * ((z.risk && z.risk.mil_active) || 0), gray: z => marr(z) * ((z.acs && z.acs.mar_55p_sh) || 0), prenup: z => marr(z) * ((z.risk && z.risk.mar_ly) || 0) };
  const CW = {};
  const cw = (f, id) => { const k = f + '|' + id; if (CW[k] == null) CW[k] = sum(ZC.filter(z => z.county === f).map(W_OF[id])); return CW[k]; };
  function matters(z, id) {
    const al = z.alloc || {}; const c = CI[z.county]; const cl = c && c.lines ? c.lines[id] : null;
    switch (id) {
      case 'div_k': return nz(al.div_k); case 'div_nk': return Math.max(0, nz(al.div) - nz(al.div_k));
      case 'sapcr': case 'mod': case 'enf': case 'po': case 'ivd': return nz(al[id]);
      case 'adopt': case 'cps': return nz(cl && +cl.n) * (z.alloc_share || 0);
      default: { const n = nz(cl && +(id === 'prenup' ? cl.est : cl.n)); const t = cw(z.county, id); return t > 0 ? n * W_OF[id](z) / t : 0; }
    }
  }
  const SRC = { div_k: 'county filings allocated to the ZIP (A to B)', div_nk: 'divorce less divorce with children, allocated (A to B)', sapcr: 'allocated filings', mod: 'allocated filings', enf: 'allocated filings', po: 'allocated filings', ivd: 'allocated filings (a floor)', adopt: 'county filings times the ZIP share of the county (D)', cps: 'county removals times the ZIP share (D)', prenup: 'county estimate spread by married adults who married in the past year (D)', high: 'county estimate spread by married adults in households over $150,000 (C)', mil: 'county estimate spread by active duty exposure (C)', gray: 'county estimate spread by married adults 55 and over (C)' };
  const payShare = id => PAYER[id] ? M.rate(PAYER[id]) / 100 : 1;
  /* ability to pay from household income bands: under $35,000 (ACS households), $35,000 to $60,000 (the married adults' households of
     the composition model, the only ZIP source for that band), the rest at 1 */
  function payer(z) {
    const a = z.acs || {}, r = z.risk || {}; const c = CI[z.county] || {}; let lo = isNum(a.inc_lt35k_sh) ? a.inc_lt35k_sh : (c.acs && isNum(c.acs.inc_lt35k_sh) ? c.acs.inc_lt35k_sh : null);
    if (lo == null) return 1; lo = clamp(lo, 0, 1); const mid = isNum(r.inc_lt60k) && isNum(r.inc_lt35k) ? clamp(r.inc_lt60k - r.inc_lt35k, 0, 1 - lo) : 0;
    return M.rate('payLow') * lo + M.rate('payMid') * mid + (1 - lo - mid);
  }
  /* value of a retained matter (collected): the contested share at the fee times the ZIP's fee value index, the rest at the flat fee */
  function valueAt(id, fvi) { const L = M.line(id); const fee = L.fee || 0; const flat = isNum(L.flat) ? L.flat : fee; const c = (L.contested == null ? 100 : L.contested) / 100; return (c * fee * (fvi || 1) + (1 - c) * flat) * (L.realization || 0) / 100; }
  function pipeValue(id, fvi, divMix) { const t = PIPE_TO[id]; if (!t) return 0; const p = (M.line(id).pipe || 0) / 100; if (!p) return 0; const v = t === 'div' ? divMix * valueAt('div_k', fvi) + (1 - divMix) * valueAt('div_nk', fvi) : valueAt(t, fvi); return p * v; }
  /* Competitor Watch: live rival ads logged in the last 120 days by county and line ({fips: {_all, line: n}}) */
  const activity = () => { try { return typeof WATCH !== 'undefined' && WATCH && typeof WATCH.activity === 'function' ? (WATCH.activity() || {}) : {}; } catch (e) { return {}; } };
  const pFactor = (a, id) => { if (!a) return 1; const n = id ? (a[id] || 0) + 0.3 * (a._all || 0) : (a._all || 0); return 1 + Math.min(M.rate('pressCap'), M.rate('pressStep') * n); };
  /* ---- the computation, cached per metro and model version */
  const CACHE = {};
  function compute(code) {
    if (!MSA[code]) return null; const key = M.version; if (CACHE[code] && CACHE[code].key === key) return CACHE[code];
    const zs = ZC.filter(z => z.msa === code && z.cent); const km = kmPer(code) || 0.25; const R = M.rate('radiusKm');
    const near = {}; zs.forEach(a => { near[a.zip] = zs.filter(b => Math.hypot(a.cent[0] - b.cent[0], a.cent[1] - b.cent[1]) * km <= R); });
    const act = activity(); const logged = Object.keys(act).some(f => zs.some(z => z.county === f));
    const medInc = med(zs.map(z => z.acs.med_hh_inc));
    const rows = zs.map(z => {
      const w = payer(z); const inc = z.acs.med_hh_inc; const fvi = isNum(inc) && medInc > 0 ? clamp(Math.sqrt(inc / medInc), 0.7, 1.6) : 1;
      const nb = near[z.zip]; const off8 = sum(nb.map(b => b.lawoffices || 0)), mar8 = sum(nb.map(marr)); const dens = mar8 > 0 ? off8 / (mar8 / 1000) : null;
      const al = z.alloc || {}; const divMix = nz(al.div) > 0 ? clamp(nz(al.div_k) / nz(al.div), 0, 1) : 0.5;
      return { z, zip: z.zip, w, fvi, inc, dens, off8, mar8, divMix, act: act[z.county] || null, near: nb };
    });
    const by = {}; rows.forEach(r => by[r.zip] = r);
    /* competition, value and click cost */
    const rDens = ranker(rows.map(r => r.dens != null ? r.dens * pFactor(r.act, null) : null)); const rVal = ranker(rows.map(r => r.fvi));
    rows.forEach(r => { r.comp_raw = r.dens != null ? r.dens * pFactor(r.act, null) : null; r.comp_pct = r.comp_raw != null ? rDens(r.comp_raw) : 0; r.val_pct = rVal(r.fvi); r.cpc_rel = 0.55 + 1.55 * (0.6 * r.comp_pct / 100 + 0.4 * r.val_pct / 100); });
    /* lines */
    const cells = {}; rows.forEach(r => cells[r.zip] = {}); const lines = {};
    ALL.forEach(id => {
      const L = M.line(id); const ps = payShare(id);
      const cs = rows.map(r => { const n = matters(r.z, id); const pay = n * ps; const value = valueAt(id, r.fvi); const pv = pipeValue(id, r.fvi, r.divMix); const direct = pay * r.w * value, pipe = pay * r.w * pv; const press = r.dens != null ? r.dens * pFactor(r.act, id) : 0; return { r, z: r.z, id, matters: n, payable: pay, mass: pay * r.w, value, direct, pipe, contrib: direct + pipe, press }; });
      const rp = ranker(cs.map(c => c.press)); const rc = ranker(cs.map(c => c.contrib));
      cs.forEach(c => { c.presspct = rp(c.press); c.contribpct = rc(c.contrib); c.cost = c.r.cpc_rel * (L.cpcMult || 0); c.eff = c.contrib > 0 && c.cost > 0 ? c.contrib / (c.cost * (0.55 + 0.9 * c.presspct / 100)) : 0; });
      const re = ranker(cs.map(c => c.eff)); cs.forEach(c => { c.pri = c.contrib > 0 ? re(c.eff) : 0; c.bid = bandOf(c.pri); c.quiet = c.contrib > 0 && c.presspct <= 45 && c.contribpct >= 60; cells[c.z.zip][id] = c; });
      lines[id] = { id, lens: LENS.includes(id), matters: sum(cs.map(c => c.matters)), payable: sum(cs.map(c => c.payable)), mass: sum(cs.map(c => c.mass)), contrib: sum(cs.map(c => c.contrib)), direct: sum(cs.map(c => c.direct)), pipe: sum(cs.map(c => c.pipe)), quiet: cs.filter(c => c.quiet).length, contested: cs.filter(c => c.presspct >= 60 && c.contribpct >= 60).length, medPress: med(cs.map(c => c.press)) };
    });
    /* the ZIP's paid reading: matter mass and the fee pool over the additive lines only */
    rows.forEach(r => { const c = cells[r.zip]; r.massBy = {}; ADD.forEach(id => r.massBy[id] = c[id].mass); r.matters = sum(ADD.map(id => c[id].matters)); r.mass = sum(ADD.map(id => c[id].mass)); r.quick = sum(QUICK.map(id => c[id].mass)); r.opp = sum(ADD.map(id => c[id].contrib)); r.eff = r.cpc_rel > 0 ? r.opp / r.cpc_rel : 0; });
    rows.forEach(r => { r.opp8 = sum(r.near.map(b => by[b.zip].opp)); r.eff8 = sum(r.near.map(b => by[b.zip].eff)); });
    const ro = ranker(rows.map(r => r.opp)), ro8 = ranker(rows.map(r => r.opp8)), rf = ranker(rows.map(r => r.eff)), rf8 = ranker(rows.map(r => r.eff8));
    rows.forEach(r => { r.oppb = 0.65 * ro(r.opp) + 0.35 * ro8(r.opp8); r.effb = 0.65 * rf(r.eff) + 0.35 * rf8(r.eff8); r.quad = quadOf(r.oppb, r.comp_pct); const t = tierOf(r.effb); r.tier = TIERS[t]; r.bid = TIER_BID[t];
      const c = cells[r.zip]; const top = ADD.slice().sort((a, b) => c[b].contrib - c[a].contrib); r.top = c[top[0]].contrib > 0 ? top[0] : null; r.top2 = c[top[1]].contrib > 0 ? top[1] : null; const best = ALL.slice().sort((a, b) => c[b].pri - c[a].pri)[0]; r.best = c[best].pri > 0 ? best : null; r.quiet = ADD.filter(id => c[id].quiet).length;
      r.angles = FL_ANGLES.filter(a => { try { return a.trig(r.z); } catch (e) { return false; } }).map(a => a.id); });
    levers(rows);
    const out = { code, key, km, radius: R, rows, by, cells, lines, logged, med: { inc: medInc, cpc_rel: med(rows.map(r => r.cpc_rel)) }, ADD, LENS, ALL };
    CACHE[code] = out; return out;
  }
  /* ---- audience and creative levers: percentiles within the metro; the dominant lever picks the creative and the call to action,
     never who is reached. No ZIP language data ships (ACS C16002), so Spanish follows the firm profile. */
  const LEVERS = [
    ['pay', 'Payment led', 'The divorce with children fee against household income, with the renter share: lead with the firm\'s flat fees and payment terms as the firm profile states them (never a contingent fee in a family matter).'],
    ['premium', 'Premium and complex property', 'Households over $150,000 and home values: separate property tracing, business interests, stock plans.'],
    ['gray', 'Married 55 and over', 'Married adults 55 and over: retirement division, QDROs, maintenance; phone first, Facebook over short video.'],
    ['movers', 'Recent movers', 'Moved in the past year: residency facts in the copy (six months in Texas and 90 days in the county, § 6.301).'],
    ['renters', 'Renters', 'Renter households: who keeps the residence, temporary orders and moving out.'],
    ['kids', 'Children at home', 'Married couple families with children: conservatorship, the possession schedule and support.'],
    ['unmarried', 'Unmarried parents', 'Cohabiting parents and births to unmarried mothers: paternity, custody and support (SAPCR).'],
    ['shock', 'Economic shock', 'The county Economic Shock Index, ranked within the metro: job loss modification and payment led creative.'],
    ['mil', 'Military', 'Active duty exposure among the married: residency for the stationed, deployment, retirement division.'],
    ['gap', 'Few law offices nearby', 'Law offices per 1,000 married within the radius in the bottom quarter: the drive to the office and virtual consultations in the copy.']
  ];
  function levers(rows) {
    const rk = f => { const k = ranker(rows.map(f)); return r => { const v = f(r); return isNum(v) ? k(v) : null; }; };
    const fee = (M.line('div_k').fee || 0);
    const P = { ratio: rk(r => isNum(r.inc) && r.inc > 0 ? fee / r.inc : null), rent: rk(r => r.z.acs.renter_sh), i150: rk(r => r.z.acs.inc_150k_sh), val: rk(r => r.z.acs.med_value), m55: rk(r => r.z.acs.mar_55p_sh), moved: rk(r => r.z.acs.moved_sh), kids: rk(r => r.z.acs.mc_kids_sh), cohab: rk(r => r.z.acs.cohab_kids_sh), births: rk(r => r.z.acs.births_unmar_sh), mil: rk(r => r.z.risk && r.z.risk.mil_active), dens: rk(r => r.dens), esi: rk(r => r.z.county_esi) };
    const avg = a => { const v = a.filter(isNum); return v.length ? sum(v) / v.length : null; };
    rows.forEach(r => {
      const s = { pay: avg([P.ratio(r), P.rent(r)]), premium: avg([P.i150(r), P.val(r)]), gray: P.m55(r), movers: P.moved(r), renters: P.rent(r), kids: P.kids(r), unmarried: avg([P.cohab(r), P.births(r)]), shock: P.esi(r), mil: P.mil(r), gap: isNum(P.dens(r)) ? 100 - P.dens(r) : null };
      Object.keys(s).forEach(k => { if (isNum(s[k])) s[k] = Math.round(s[k]); });
      const milOk = ((r.z.risk && r.z.risk.mil_active) || 0) >= 0.03;
      const tags = LEVERS.filter(([k]) => isNum(s[k]) && s[k] >= 75 && (k !== 'mil' || milOk)).map(([k]) => k);
      const dom = LEVERS.map(([k]) => k).filter(k => isNum(s[k]) && (k !== 'mil' || milOk)).sort((a, b) => s[b] - s[a])[0] || null;
      r.lev = { s, tags, dom };
    });
  }
  /* ---- unit economics */
  const ASM = () => (typeof DESKX !== 'undefined' && DESKX && DESKX.ASM0) || null;
  const PLATS = ['google', 'lsa', 'dg', 'meta', 'microsoft', 'linkedin', 'yelp', 'nextdoor', 'tiktok'];
  const PLAB = { google: 'Google Search', lsa: 'Local Services Ads', dg: 'YouTube and Demand Gen', meta: 'Meta', microsoft: 'Microsoft', linkedin: 'LinkedIn', yelp: 'Yelp', nextdoor: 'Nextdoor', tiktok: 'TikTok' };
  function cplByPlatform(id, rel) {
    const L = M.line(id); const cpc = M.get('cpc'); rel = isNum(rel) ? rel : 1; const A = ASM();
    const search = L.cvr > 0 ? cpc * (L.cpcMult || 0) * rel / (L.cvr / 100) : null;
    const cpm = p => { const a = A && A[p]; return a && a.cost > 0 && a.ctr > 0 && a.cvr > 0 ? a.cost / (1000 * a.ctr / 100 * a.cvr / 100) : null; };
    const cpcP = p => { const a = A && A[p]; return a && a.cost > 0 && a.cvr > 0 ? a.cost / (a.cvr / 100) : null; };
    const msR = A && A.microsoft && A.google && A.google.cost > 0 ? A.microsoft.cost / A.google.cost : 2 / 3;
    return { google: search, microsoft: search != null ? search * msR : null, lsa: L.lsaCpl, meta: L.metaCpl, dg: cpm('dg'), nextdoor: cpm('nextdoor'), tiktok: cpm('tiktok'), yelp: cpcP('yelp'), linkedin: null };
  }
  function blended(id, rel) {
    const c = cplByPlatform(id, rel); const fit = (LM(id) || {}).fit || { google: 3 }; let w = 0, s = 0; const parts = [];
    PLATS.forEach(p => { const f = fit[p] || 0; if (!f || !isNum(c[p]) || c[p] <= 0) return; const wt = f * f; w += wt; s += wt * c[p]; parts.push({ p, fit: f, wt, cpl: c[p] }); });
    parts.forEach(x => x.share = x.wt / (w || 1)); return { cpl: w ? s / w : null, parts, byPlat: c };
  }
  function econ(id, rel, fvi, divMix) {
    const L = M.line(id); const b = blended(id, rel); const value = valueAt(id, fvi || 1); const pv = pipeValue(id, fvi || 1, divMix == null ? 0.5 : divMix);
    const perRet = value + pv; const rpl = (L.show || 0) * (L.close || 0) / 1e4;   // retained per lead
    const cpr = b.cpl != null && rpl > 0 ? b.cpl / rpl : null; const be = perRet * rpl;
    return { L, cpl: b.cpl, parts: b.parts, byPlat: b.byPlat, value, pipe: pv, perRet, rpl, cpr, beCpl: be, roas: cpr ? perRet / cpr : null, consults: (L.show || 0) / 100 };
  }
  /* ---- season: the statewide monthly index of the line's court series (module 06, LINE_META.seas), mean 100; flat where none */
  function season(id) { const L = LM(id); const s = L && L.seas && typeof ST !== 'undefined' && ST.seas && ST.seas[L.seas]; if (!s) return { months: Array(12).fill(100), flat: true, src: 'No monthly court series for this line: flat' }; const m = sum(s) / 12 || 100; return { months: s.map(v => v / m * 100), flat: false, src: L.seas === id ? `Statewide monthly ${L.lc || id} filings, index (2022 to 2025 average = 100)` : 'Statewide monthly divorce filings, the proxy (no separate series for this line)' }; }
  /* ---- the portfolio: one budget split over the additive lines in a month (or the year) */
  function allocate(code, budget, month, zips, alpha) {
    const C = compute(code); if (!C) return []; const set = zips && zips.length ? new Set(zips) : null; const rs = C.rows.filter(r => !set || set.has(r.zip)); alpha = isNum(alpha) ? alpha : M.get('alpha');
    const rel = med(rs.map(r => r.cpc_rel)) || 1; const fv = sum(rs.map(r => r.fvi * r.mass)) / Math.max(1e-9, sum(rs.map(r => r.mass))) || 1;
    const rows = ADD.map(id => { const contrib = sum(rs.map(r => C.cells[r.zip][id].contrib)); const pay = sum(rs.map(r => C.cells[r.zip][id].mass)); const s = month == null ? 100 : season(id).months[month]; const u = econ(id, rel, fv, 0.5); const lev = u.roas || 0.01; return { id, contrib, pay, season: s, u, w: Math.pow(Math.max(1, contrib * s / 100 * lev), alpha) }; });
    const W = sum(rows.map(r => r.w)) || 1;
    rows.forEach(r => { r.budget = budget * r.w / W; r.leads = r.u.cpl ? r.budget / r.u.cpl : 0; r.consults = r.leads * (r.u.L.show || 0) / 100; r.retained = r.leads * r.u.rpl; r.revenue = r.retained * r.u.perRet; const monthPay = r.pay * (month == null ? 1 / 12 : r.season / 100 / 12); r.share = monthPay > 0 ? r.retained / monthPay : null; });
    return rows.sort((a, b) => b.budget - a.budget);
  }
  /* ---- dayparts: 7 days by 6 blocks, bid adjustments in percent (grade C templates until the account's hours replace them) */
  const BLOCKS = ['12a to 6a', '6a to 9a', '9a to 12p', '12p to 5p', '5p to 9p', '9p to 12a']; const BH = [[0, 6], [6, 9], [9, 12], [12, 17], [17, 21], [21, 24]];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; const DAYL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dp = (wk, sat, sun) => [wk, wk, wk, wk, wk, sat, sun];
  const DAYPARTS = {
    urgent: { l: 'Urgent', g: 'C', note: 'Protective orders and CPS defense: around the clock, every day, never below 0. A removal or a family violence night does not wait for office hours; calls beat forms.', grid: dp([0, 5, 10, 10, 15, 10], [5, 5, 10, 10, 15, 10], [5, 5, 10, 10, 15, 10]) },
    considered: { l: 'Considered', g: 'C', note: 'Divorce and custody: researched on weekday evenings and on Sundays, often on a phone first and a desktop later. Consultation forms matter as much as calls; overnight hours are cheap and thin.', grid: dp([-40, -10, 0, 0, 20, 10], [-40, -20, -10, -10, -10, -20], [-35, -10, 10, 15, 20, 10]) },
    business: { l: 'Business hours', g: 'C', note: 'IV-D, adoption and enforcement: weekday business hours, when the office and the dockets are open. Nights and weekends are thin.', grid: dp([-60, -10, 20, 20, -20, -50], [-60, -40, -30, -30, -40, -60], [-60, -50, -40, -40, -40, -60]) },
    referral: { l: 'Referral (LinkedIn)', g: 'C', note: 'LinkedIn referral partner and recruiting campaigns: weekday working hours only.', grid: dp([-80, -10, 20, 20, -30, -80], [-90, -90, -90, -90, -90, -90], [-90, -90, -90, -90, -90, -90]) }
  };
  const observed = () => { try { return typeof ACCT !== 'undefined' && ACCT && typeof ACCT.observedGrid === 'function' ? ACCT.observedGrid() : null; } catch (e) { return null; } };
  function grid(id, useObs) { const L = LM(id) || {}; const t = DAYPARTS[L.dayparts] ? L.dayparts : 'considered'; const o = useObs ? observed() : null; return o ? { grid: o, key: t, src: 'observed', g: 'B', l: 'Observed in Accounts (90 days)' } : { grid: DAYPARTS[t].grid, key: t, src: 'template', g: DAYPARTS[t].g, l: DAYPARTS[t].l }; }
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function hourlyPlan(id, from, days, useObs) {
    const g = grid(id, useObs); const d0 = from ? new Date(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10)) : new Date(); const out = [];
    for (let i = 0; i < (days || 7); i++) { const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i); const wd = (d.getDay() + 6) % 7; for (let h = 0; h < 24; h++) { const b = BH.findIndex(x => h >= x[0] && h < x[1]); out.push({ date: ymd(d), day: DAYL[wd], hour: h, start: String(h).padStart(2, '0') + ':00', end: String(h + 1).padStart(2, '0') + ':00', block: BLOCKS[b], bid: g.grid[wd][b], template: g.l, grade: g.g, line: id }); } }
    return out;
  }
  /* ---- exports (csv() from core: no comment lines, so the import files open in Ads Editor and Ads Manager as they are) */
  const lname = id => (LM(id) || {}).short || id;
  function matrixLong(code, zips) {
    const C = compute(code); const set = zips && zips.length ? new Set(zips) : null; const out = [];
    C.rows.filter(r => !set || set.has(r.zip)).forEach(r => ALL.forEach(id => { const c = C.cells[r.zip][id]; out.push({ zip: r.zip, city: r.z.city, county: r.z.county_name, line: id, kind: LENS.includes(id) ? 'lens' : 'additive', matters: c.matters, payable: c.payable, mass: c.mass, value: c.value, direct: c.direct, pipe: c.pipe, contrib: c.contrib, press: c.presspct, cost: c.cost, pri: c.pri, bid: c.bid, quiet: c.quiet ? 1 : 0, fvi: r.fvi, w: r.w, lev: r.lev.tags.join('; '), angles: r.angles.join('; '), gt: r.z.gt || '' }); }));
    return csv(out, [{ l: 'ZIP', k: 'zip' }, { l: 'City', k: 'city' }, { l: 'County', k: 'county' }, { l: 'Line', k: 'line' }, { l: 'Line kind', k: 'kind' }, { l: 'Matters a year', k: 'matters', d: 2 }, { l: 'Fee paying matters a year', k: 'payable', d: 2 }, { l: 'Payer weighted matters a year', k: 'mass', d: 2 }, { l: 'Collected value per retained matter ($)', k: 'value', d: 0 }, { l: 'Direct fee pool ($ a year)', k: 'direct', d: 0 }, { l: 'Pipeline credit ($ a year)', k: 'pipe', d: 0 }, { l: 'Contribution ($ a year)', k: 'contrib', d: 0 }, { l: 'Pressure percentile', k: 'press', d: 1 }, { l: 'Cost index', k: 'cost', d: 3 }, { l: 'Priority percentile', k: 'pri', d: 1 }, { l: 'Bid modifier (%)', k: 'bid', d: 0 }, { l: 'Quiet auction', k: 'quiet' }, { l: 'Fee value index', k: 'fvi', d: 3 }, { l: 'Payer weight', k: 'w', d: 3 }, { l: 'Levers', k: 'lev' }, { l: 'Angles', k: 'angles' }, { l: 'Google criterion ID', k: 'gt' }]);
  }
  function matrixWide(code, zips) {
    const C = compute(code); const set = zips && zips.length ? new Set(zips) : null;
    return csv(C.rows.filter(r => !set || set.has(r.zip)).map(r => { const o = { zip: r.zip, city: r.z.city, county: r.z.county_name, hh: r.z.acs.hh, top: r.top ? lname(r.top) : '', top2: r.top2 ? lname(r.top2) : '', best: r.best ? lname(r.best) : '', quiet: r.quiet, dom: r.lev.dom ? (LEVERS.find(x => x[0] === r.lev.dom) || [])[1] : '', lev: r.lev.tags.map(k => (LEVERS.find(x => x[0] === k) || [])[1]).join('; ') }; ALL.forEach(id => o['pri_' + id] = C.cells[r.zip][id].pri); return o; }), [{ l: 'ZIP', k: 'zip' }, { l: 'City', k: 'city' }, { l: 'County', k: 'county' }, { l: 'Households', k: 'hh', d: 0 }, { l: 'Top line by contribution', k: 'top' }, { l: 'Second line', k: 'top2' }, { l: 'Best ranked line', k: 'best' }, { l: 'Quiet lines', k: 'quiet' }, { l: 'Dominant lever', k: 'dom' }, { l: 'Levers', k: 'lev' }].concat(ALL.map(id => ({ l: 'Priority: ' + lname(id), k: 'pri_' + id, d: 0 }))));
  }
  const ranked = (code, id, zips, n) => { const C = compute(code); const set = zips && zips.length ? new Set(zips) : null; return C.rows.filter(r => !set || set.has(r.zip)).map(r => C.cells[r.zip][id]).filter(c => c.contrib > 0).sort((a, b) => b.pri - a.pri || a.z.zip.localeCompare(b.z.zip)).slice(0, n || 40); };
  const bidTxt = b => (b > 0 ? '+' : '') + b + '%';
  function googleLocations(code, id, zips, n, camp) { return csv(ranked(code, id, zips, n).map(c => ({ c: camp, loc: c.z.zip + ', Texas, United States', id: c.z.gt || '', bid: bidTxt(c.bid), t: 'Location', s: 'Enabled' })), [{ l: 'Campaign', k: 'c' }, { l: 'Location', k: 'loc' }, { l: 'ID', k: 'id' }, { l: 'Bid Modifier', k: 'bid' }, { l: 'Criterion Type', k: 't' }, { l: 'Status', k: 's' }], { platform: true }); }
  function metaZips(code, id, zips, n) { const C = compute(code); return csv(ranked(code, id, zips, n).map(c => ({ k: 'US:' + c.z.zip, zip: c.z.zip, city: c.z.city, county: c.z.county_name, pri: c.pri, lev: C.by[c.z.zip].lev.tags.map(t => (LEVERS.find(x => x[0] === t) || [])[1]).join('; ') })), [{ l: 'Zip', k: 'k' }, { l: 'zip', k: 'zip' }, { l: 'city', k: 'city' }, { l: 'county', k: 'county' }, { l: 'priority_pct', k: 'pri', d: 0 }, { l: 'levers', k: 'lev' }], { platform: true }); }
  function calendarCSV(code, budget, zips, alpha) {
    const a = csv(ALL.map(id => { const s = season(id); const o = { line: lname(id), kind: LENS.includes(id) ? 'lens' : 'additive', src: s.src, trig: ((LM(id) || {}).triggers || []).join(' | ') }; MO.forEach((m, i) => o[m] = s.months[i]); return o; }), [{ l: 'Line', k: 'line' }, { l: 'Kind', k: 'kind' }].concat(MO.map(m => ({ l: m + ' index', k: m, d: 0 }))).concat([{ l: 'Season source', k: 'src' }, { l: 'Triggers', k: 'trig' }]));
    const al = MO.map((_, m) => allocate(code, budget, m, zips, alpha));
    const b = csv(ADD.map(id => { const o = { line: lname(id) }; MO.forEach((m, i) => o[m] = (al[i].find(r => r.id === id) || {}).budget || 0); return o; }), [{ l: 'Line', k: 'line' }].concat(MO.map(m => ({ l: m + ' media ($)', k: m, d: 0 }))));
    return a + '\n\n' + b;
  }
  function hourlyCSV(id, from, days, useObs) { return csv(hourlyPlan(id, from, days, useObs), [{ l: 'Date', k: 'date' }, { l: 'Day', k: 'day' }, { l: 'Hour', k: 'hour' }, { l: 'Start', k: 'start' }, { l: 'End', k: 'end' }, { l: 'Block', k: 'block' }, { l: 'Bid adjustment (%)', k: 'bid' }, { l: 'Template', k: 'template' }, { l: 'Grade', k: 'grade' }, { l: 'Line', k: 'line' }]); }
  return { ADD, LENS, ALL, PAYER, PIPE_TO, QUICK, QN, QD, TIERS, TIER_CUT, TIER_BID, BANDS, LEVERS, PLATS, PLAB, DAYPARTS, BLOCKS, BH, DAYS, DAYL, SRC,
    compute, matters, payer, valueAt, pipeValue, kmPer, distKm, box, ranker, bandOf, tierOf, quadOf, cplByPlatform, blended, econ, season, allocate, grid, hourlyPlan,
    matrixLong, matrixWide, ranked, googleLocations, metaZips, calendarCSV, hourlyCSV, lname, observed, activity, clear: () => { Object.keys(CACHE).forEach(k => delete CACHE[k]); } };
})();
