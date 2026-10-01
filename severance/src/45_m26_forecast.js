'use strict';
/* Module 26: Filings Forecast. The family law counterpart of the Thermal Atlas Replacement Wave (chrome-app module 02): the married stock
   by years married, aged through the PUMS divorce hazard (SEV_HAZ, src/12_hazard_core.js), calibrated to the court filings, under three
   scenarios, turned into a fee pool at stated fees, with cohort waves, the case mix, a contested and complex case signal and the
   child support modification check. Ids and classes carry the fc prefix; settings persist under sev.forecast.settings. */
const FC_FEE_LINES = ['div_k', 'div_nk', 'sapcr', 'mod', 'enf', 'po', 'adopt', 'cps', 'ivd'];
const FC_TRENDS = [[2000, 2019], [2010, 2019], [1990, 2019], [2000, 2023], [2010, 2023]];
const FC_SIG = [
  { k: 'kids', l: 'Children at home', d: 'married couple families with children under 18 (ACS)', v: o => o.acs.mc_kids_sh },
  { k: 'inc', l: 'High income', d: 'households over $150,000 (ACS)', v: o => o.acs.inc_150k_sh },
  { k: 'self', l: 'Self employed', d: 'married adults who are self employed (PUMS)', v: o => o.risk.selfemp },
  { k: 'mil', l: 'Military', d: 'married adults with active duty in the household (PUMS)', v: o => o.risk.mil_active },
  { k: 'rem', l: 'Remarried', d: 'married adults on a second or later marriage (PUMS)', v: o => o.risk.remarried }];
const FC_DEF = { area: 'tx', scn: 'fit', layer: 'rate', year: 2026, level: 'zip', stock: 'grow', fees: {}, inc: { div_k: true, div_nk: true, sapcr: true, mod: true, enf: true, po: true, adopt: true, cps: false, ivd: false }, contested: 50, cmult: 1, incAdj: false, incEl: 0.5, w: { kids: 30, inc: 25, self: 15, mil: 10, rem: 20 }, from: 2000, to: 2019, surge: 100, months: 12, panel: 'full' };

/* FC_SUPPORT: the 'Modify or leave it' check. Guideline child support under Tex. Fam. Code § 154.125 on the net resources up to the cap
   in effect on a date, and the § 156.401(a)(2) test. The multiple household percentages (§§ 154.128 and 154.129) are not computed: the
   statute's table could not be verified against the statute text for this build, so an obligor with other children gets no verdict. */
const FC_SUPPORT = (function () {
  // the monthly net resources cap and the date it took effect (§ 154.125(a), adjusted every six years under (a-1))
  const CAPS = [['2025-09-01', 11700], ['2019-09-01', 9200], ['2013-09-01', 8550], ['2007-09-01', 7500]];
  const STD = [20, 25, 30, 35, 40], LOW = [15, 20, 25, 30, 35];   // § 154.125(b) and the low income schedule of § 154.125(c)
  const LOW_FROM = '2021-09-01', LOW_UNDER = 1000;
  const iso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s)) ? String(s) : null;
  function capOn(d) { d = iso(d); if (!d) return null; for (const [from, cap] of CAPS) if (d >= from) return { cap, from }; return null; }
  function addYears(d, n) { const [y, m, dd] = d.split('-').map(Number); const t = new Date(Date.UTC(y + n, m - 1, dd)); if (t.getUTCMonth() !== m - 1) t.setUTCDate(0); return t.toISOString().slice(0, 10); }
  function guideline(net, kids, date) {
    const c = capOn(date); if (!c) return { ok: false, why: 'The cap in effect before September 1, 2007 is not in this tool.' };
    if (!(typeof net === 'number' && isFinite(net) && net >= 0)) return { ok: false, why: 'Enter monthly net resources.' };
    const n = Math.max(1, Math.round(kids)); const i = Math.min(5, n) - 1; const low = net < LOW_UNDER;
    if (low && date < LOW_FROM) return { ok: false, why: 'Net resources under $1,000 on a date before September 1, 2021 fall under rules this tool does not compute.' };
    const pct = (low ? LOW : STD)[i]; const applied = Math.min(net, c.cap);
    return { ok: true, amount: Math.round(applied * pct) / 100, pct, cap: c.cap, capFrom: c.from, applied, low, atLeast: n >= 6, above: net > c.cap };
  }
  /* check({orderDate, kids, other, netThen, netNow, ordered, agreed, today}) → {status: input | not_computed | agreed | met | not_yet | below, ...} */
  function check(o) {
    const today = iso(o.today); const od = iso(o.orderDate); const out = { notes: [] };
    if (!today) return { status: 'input', why: 'No date for today.' };
    if (!od) return { status: 'input', why: 'Enter the date the order was rendered or last modified.' };
    if (od > today) return { status: 'input', why: 'The order date is after today.' };
    const kids = Math.round(+o.kids); if (!(kids >= 1 && kids <= 20)) return { status: 'input', why: 'Enter the number of children before the court (1 or more).' };
    const other = Math.round(+o.other || 0); if (!(other >= 0 && other <= 20)) return { status: 'input', why: 'Enter the other children the obligor supports (0 or more).' };
    const num = v => (v === '' || v == null) ? null : +v;
    const nThen = num(o.netThen), nNow = num(o.netNow), ord = num(o.ordered);
    out.kids = kids; out.other = other; out.orderDate = od; out.today = today;
    out.then = guideline(nThen, kids, od); out.now = guideline(nNow, kids, today);
    out.current = ord != null && isFinite(ord) && ord > 0 ? { amount: ord, source: 'entered' } : (out.then.ok ? { amount: out.then.amount, source: 'guideline' } : null);
    out.threeYears = addYears(od, 3); out.timeOk = today >= out.threeYears; out.years = (Date.parse(today) - Date.parse(od)) / (365.2425 * 864e5);
    if (other > 0) { out.status = 'not_computed'; out.why = 'The obligor supports other children, so the guideline is the multiple household percentage of §§ 154.128 and 154.129, which this tool does not compute.'; return out; }
    if (!out.now.ok) { out.status = 'not_computed'; out.why = out.now.why; return out; }
    if (!out.current) { out.status = 'not_computed'; out.why = (out.then.why ? out.then.why + ' ' : '') + 'Enter the amount the order sets to compare.'; return out; }
    out.diff = out.now.amount - out.current.amount; out.diffPct = out.current.amount > 0 ? out.diff / out.current.amount : null;
    out.big = Math.abs(out.diff) >= 100 || (out.diffPct != null && Math.abs(out.diffPct) >= 0.2);
    out.status = o.agreed ? 'agreed' : out.big && out.timeOk ? 'met' : out.big ? 'not_yet' : 'below';
    return out;
  }
  return { CAPS, STD, LOW, LOW_FROM, LOW_UNDER, capOn, guideline, addYears, check };
})();

registerModule({
  key: 'forecast', num: '26', title: 'Filings Forecast', desc: 'Expected divorce, modification and enforcement filings 2026 to 2035 from the married stock, three scenarios, the fee pool by ZIP, county and metro',
  mount(root) {
    const HZ = SEV_HAZ; const BASE = HZ.PARAMS.base; const YRS = Array.from({ length: 11 }, (_, i) => BASE + i); const FY = YRS.slice(1);
    // ---------- settings (saved in this browser)
    const clean = o => {
      const d = JSON.parse(JSON.stringify(FC_DEF)); o = o && typeof o === 'object' ? o : {};
      const areaOk = a => a === 'tx' || (/^msa:/.test(a) && MSA[a.slice(4)]) || (/^cty:/.test(a) && CI[a.slice(4)]);
      if (areaOk(o.area)) d.area = o.area; if (HZ.SCENARIOS[o.scn]) d.scn = o.scn; if (typeof o.layer === 'string') d.layer = o.layer;
      if (FY.includes(+o.year)) d.year = +o.year; if (['zip', 'cty'].includes(o.level)) d.level = o.level; if (['grow', 'hold', 'closed'].includes(o.stock)) d.stock = o.stock;
      if (o.fees && typeof o.fees === 'object') FC_FEE_LINES.forEach(k => { const v = o.fees[k]; if (v != null && isFinite(+v) && +v >= 0) d.fees[k] = +v; });
      if (o.inc && typeof o.inc === 'object') FC_FEE_LINES.forEach(k => { if (typeof o.inc[k] === 'boolean') d.inc[k] = o.inc[k]; });
      const nm = (v, a, b, def) => (v != null && v !== '' && isFinite(+v)) ? clamp(+v, a, b) : def;
      d.contested = nm(o.contested, 0, 100, d.contested); d.cmult = nm(o.cmult, 0.5, 5, d.cmult); d.incAdj = o.incAdj === true; d.incEl = nm(o.incEl, 0, 2, d.incEl);
      if (o.w && typeof o.w === 'object') FC_SIG.forEach(s => { d.w[s.k] = nm(o.w[s.k], 0, 100, d.w[s.k]); });
      if (FC_TRENDS.some(t => t[0] === +o.from && t[1] === +o.to)) { d.from = +o.from; d.to = +o.to; }
      d.surge = nm(o.surge, 0, 500, d.surge); d.months = Math.round(nm(o.months, 1, 24, d.months)); d.panel = o.panel === 'post2022' ? 'post2022' : 'full';
      return d;
    };
    let st = clean(store.get('sev.forecast.settings', null)); st.sel = null;
    const save = () => { const o = Object.assign({}, st); delete o.sel; store.set('sev.forecast.settings', o); };
    const PRM = () => ({ base: BASE, from: st.from, to: st.to, surge: st.surge / 100, months: st.months, panel: st.panel, start: HZ.PARAMS.start });
    const ti = () => st.year - BASE;   // the year index of the map, table and pools
    const fcM = v => !isN(v) ? NA : Math.abs(v) >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : '$' + K(v);
    const SCN_COLOR = { fit: 'var(--s1)', decline: 'var(--s3)', recession: 'var(--s2)' };
    const LM = k => (typeof LINE_META !== 'undefined' && LINE_META[k]) || { name: k, short: k, fee: null };

    // ---------- inputs per county: the PUMS stock, new marriages, growth, calendar 2025 filings and the order history
    const growthOf = c => isN(c.pop2020) && c.pop2020 > 0 && isN(c.pop2025) ? Math.pow(c.pop2025 / c.pop2020, 1 / 5) - 1 : 0;
    const CA = {}; CTY.forEach(c => { const h = (c.filings && c.filings.hist) || {}; const o = Object.assign({}, h[String(BASE)] || {}); o.div_nk = (o.div || 0) - (o.div_k || 0); CA[c.fips] = { married: c.acs.married, buckets: c.risk, marLy: c.risk.mar_ly, growth: growthOf(c), obs: o, hist: h }; });
    // the statewide ratio of filed to modeled, for a county that reported no divorce filings in the base year
    const capS = (() => { let f = 0, m = 0; CTY.forEach(c => { const a = CA[c.fips]; if (!(a.obs.div > 0)) return; const r = HZ.forecast(a, { scenario: 'fit', years: 0, params: PRM() }); f += a.obs.div; m += r.modeled[0]; }); return m > 0 ? f / m : 1; })();
    const kShareS = (() => { let k = 0, d = 0; CTY.forEach(c => { k += CA[c.fips].obs.div_k || 0; d += CA[c.fips].obs.div || 0; }); return d > 0 ? k / d : 0; })();
    // the married stock setting: grows with the county population (default), held at today's size, or today's marriages only
    const growOn = () => st.stock === 'grow'; const newOn = () => st.stock !== 'closed';
    const areaIn = f => growOn() ? CA[f] : Object.assign({}, CA[f], { growth: 0 });
    const STOCK_NOTE = { grow: 'New marriages enter at each area\'s 2020 to 2024 rate and the married stock grows with the county\'s 2020 to 2025 population pace.', hold: 'New marriages enter at each area\'s 2020 to 2024 rate and the married stock is held at today\'s size.', closed: 'No new marriages: the forecast follows today\'s marriages only, so it falls as they age.' };
    let FCC = null, FZ = null, BANDS = new Map(), SIGC = null, SIGZ = null;
    function computeCounties() {
      FCC = {}; FZ = {}; BANDS = new Map();
      Object.keys(HZ.SCENARIOS).forEach(s => { FCC[s] = {}; CTY.forEach(c => { FCC[s][c.fips] = HZ.forecast(areaIn(c.fips), { scenario: s, params: PRM(), newMarriages: newOn(), capture: capS, kShare: kShareS }); }); });
    }
    const zero = () => YRS.map(() => 0);
    function zipRes(s, z) {
      FZ[s] = FZ[s] || {}; if (FZ[s][z.zip]) return FZ[s][z.zip];
      const cr = FCC[s][z.county]; const ca = CA[z.county]; let a = z.alloc || {};
      // a county whose clerk reported no divorce filings in the last twelve months (a reporting gap) left its ZIPs an allocation of
      // zero; they are allocated again from the county's calendar year count by the same rule (married adults times the hazard)
      const ct = CI[z.county] && CI[z.county].filings.ttm; const gap = !!(ct && !(ct.div > 0) && ca && ca.obs.div > 0);
      if (gap && !(a.div > 0) && cr && cr.modeled[0] > 0) { const m0 = HZ.forecast({ married: z.acs.married, buckets: z.risk, marLy: z.risk.mar_ly, growth: 0, obs: { div: 0 } }, { years: 0, params: PRM() }).modeled[0]; const share = m0 / cr.modeled[0]; a = { _re: true }; ['div', 'div_k', 'sapcr', 'po', 'mod', 'enf', 'ivd'].forEach(k => { a[k] = share * (ca.obs[k] || 0); }); }
      const f = HZ.forecast({ married: z.acs.married, buckets: z.risk, marLy: z.risk.mar_ly, growth: ca && growOn() ? ca.growth : 0, obs: { div: a.div || 0, div_k: a.div_k || 0 } }, { scenario: s, params: PRM(), newMarriages: newOn(), capture: 0 });
      const idx = k => cr ? cr.lines[k].map(v => cr.lines[k][0] > 0 ? v / cr.lines[k][0] : 1) : YRS.map(() => 1);
      const L = { div: f.lines.div, div_k: f.lines.div_k, div_nk: f.lines.div_nk, adopt: zero(), cps: zero() };
      ['sapcr', 'po', 'mod', 'enf', 'ivd'].forEach(k => { const ix = idx(k); L[k] = ix.map(v => v * (a[k] || 0)); });
      const den = a._re ? (ca.obs.div_k || 0) + (ca.obs.sapcr || 0) : ct ? (ct.div_k || 0) + (ct.sapcr || 0) : 0;
      return (FZ[s][z.zip] = { lines: L, alloc: a, modsDue: cr && den > 0 ? ((a.div_k || 0) + (a.sapcr || 0)) / den * cr.modsDue : 0, capture: f.capture, f });
    }
    // ---------- areas
    const areaKind = () => st.area === 'tx' ? 'tx' : st.area.slice(0, 3);
    const areaId = () => st.area.slice(4);
    const areaFips = () => areaKind() === 'tx' ? CTY.map(c => c.fips) : areaKind() === 'msa' ? MSA[areaId()].counties.filter(f => CI[f]) : [areaId()];
    const areaTitle = (a) => { a = a || st.area; return a === 'tx' ? 'Texas' : a.startsWith('msa:') ? MNAME(MSA[a.slice(4)].title) + ' metro' : CI[a.slice(4)].name + ' County'; };
    const areaGeo = () => areaKind() === 'tx' ? 'texas' : areaKind() === 'msa' ? MNAME(MSA[areaId()].title).split(' / ')[0] + ' metro' : CI[areaId()].name + ' county';
    const areaMetro = () => areaKind() === 'msa' ? areaId() : areaKind() === 'cty' ? (CI[areaId()].msa || null) : null;
    const zipOk = () => { const m = areaMetro(); return !!(m && GEO.metros && GEO.metros[m]); };
    const level = () => (st.level === 'zip' && zipOk()) ? 'zip' : 'cty';
    function agg(s, fips) {
      fips = fips || areaFips(); const L = {}; ['div', 'div_k', 'div_nk', 'sapcr', 'po', 'mod', 'enf', 'adopt', 'cps', 'ivd'].forEach(k => { L[k] = zero(); });
      let due = 0; const modeled = zero(), married = zero();
      fips.forEach(f => { const r = FCC[s][f]; Object.keys(L).forEach(k => r.lines[k].forEach((v, t) => { L[k][t] += v; })); due += r.modsDue; r.modeled.forEach((v, t) => { modeled[t] += v; }); r.married.forEach((v, t) => { married[t] += v; }); });
      return { lines: L, modsDue: due, modeled, married, capture: modeled[0] > 0 ? L.div[0] / modeled[0] : null };
    }
    // the approximate 90% band of the area's lines from the curve's standard errors (gradients summed over the area's counties)
    function areaBand(s, fips, tag) {
      fips = fips || areaFips(); const key = [s, tag || st.area, st.stock, JSON.stringify(PRM())].join('|'); if (BANDS.has(key)) return BANDS.get(key);
      const G = {}; fips.forEach(f => { const r = HZ.forecast(areaIn(f), { scenario: s, params: PRM(), newMarriages: newOn(), capture: capS, kShare: kShareS, grad: true }); Object.keys(r.grad).forEach(k => { if (!G[k]) G[k] = r.grad[k].map(row => row.slice()); else r.grad[k].forEach((row, t) => row.forEach((v, d) => { G[k][t][d] += v; })); }); });
      const out = { grad: G }; Object.keys(G).forEach(k => { out[k] = HZ.band(G[k]); }); if (BANDS.size > 40) BANDS.clear(); BANDS.set(key, out); return out;
    }
    // ---------- economics
    const firmFee = k => { try { const f = (FIRM.get() || {}).fees || {}; const v = f[k]; return v != null && v !== '' && isFinite(+v) && +v > 0 ? +v : null; } catch (e) { return null; } };
    const feeOf = k => isN(st.fees[k]) ? st.fees[k] : (firmFee(k) != null ? firmFee(k) : (LM(k).fee || 0));
    const feeSrc = k => isN(st.fees[k]) ? 'your entry' : firmFee(k) != null ? 'firm profile (advertised fee)' : 'Severance model average (module 06)';
    const incAdj = inc => st.incAdj && isN(inc) && inc > 0 && isN(ST.acs.med_hh_inc) ? Math.pow(inc / ST.acs.med_hh_inc, st.incEl) : 1;
    const cAdj = k => (k === 'div_k' || k === 'div_nk') ? (1 - st.contested / 100) + st.contested / 100 * st.cmult : 1;
    const poolOf = (L, t, inc) => { let s = 0; FC_FEE_LINES.forEach(k => { if (st.inc[k] && L[k]) s += (L[k][t] || 0) * feeOf(k) * cAdj(k) * incAdj(inc); }); return s; };
    const areaPool = (s, t, fips) => sum((fips || areaFips()).map(f => poolOf(FCC[s][f].lines, t, CI[f].acs.med_hh_inc)));
    // ---------- the contested and complex case signal: a stated percentile blend, ranked within counties or within ZIPs
    function sigMap(objs, idOf) {
      const W = sum(FC_SIG.map(s => st.w[s.k] || 0)); const sorted = {}; FC_SIG.forEach(s => { sorted[s.k] = objs.map(s.v).filter(isN).sort((a, b) => a - b); });
      const pr = (arr, v) => { if (!isN(v) || !arr.length) return null; let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return 100 * lo / arr.length; };
      const out = {}; objs.forEach(o => { let a = 0, w = 0; FC_SIG.forEach(s => { const p = pr(sorted[s.k], s.v(o)); const ww = st.w[s.k] || 0; if (p != null && ww > 0) { a += p * ww; w += ww; } }); out[idOf(o)] = W > 0 && w > 0 ? a / w : null; });
      return out;
    }
    const sigC = () => SIGC || (SIGC = sigMap(CTY, c => c.fips));
    const sigZ = () => SIGZ || (SIGZ = sigMap(ZC, z => z.zip));
    // area composition tags: top tenth within the same kind (counties among counties, ZIPs among ZIPs)
    const TAGS = [['In the hazard peak', o => (o.risk.dur_lt5 || 0) + (o.risk.dur_5_9 || 0)], ['Remarried', o => o.risk.remarried], ['Gray pool', o => o.acs.mar_55p_sh], ['Military', o => o.risk.mil_active], ['Custody heavy', o => o.acs.mc_kids_sh], ['High income', o => o.acs.inc_150k_sh], ['Separated, not yet filed', o => o.acs.sep_per_1k_married], ['Renters', o => o.acs.renter_sh]];
    const P90 = {}; const p90 = (kind, i) => { const k = kind + i; if (P90[k] != null) return P90[k]; const v = (kind === 'zip' ? ZC : CTY).map(TAGS[i][1]).filter(isN).sort((a, b) => a - b); return (P90[k] = v.length ? v[Math.floor(v.length * 0.9)] : Infinity); };
    const tagsOf = (o, kind) => TAGS.map((t, i) => isN(t[1](o)) && t[1](o) >= p90(kind, i) ? t[0] : null).filter(Boolean);
    // ---------- units (counties or ZIPs) in the area, with the values the map, table and exports read
    function units() {
      const s = st.scn, t = ti();
      if (level() === 'zip') {
        const m = areaMetro(); let zs = ZC.filter(z => z.msa === m); if (areaKind() === 'cty') zs = zs.filter(z => z.county === areaId());
        const sg = sigZ();
        return zs.map(z => { const r = zipRes(s, z); const mar = z.acs.married, mc = z.acs.mc_fam; const pool = poolOf(r.lines, t, z.acs.med_hh_inc);
          return { _id: z.zip, kind: 'zip', obj: z, name: z.zip + ' ' + (z.city || ''), county: z.county_name, married: mar, mcfam: mc, div: r.lines.div[t], rate: mar >= 200 ? r.lines.div[t] / mar * 1000 : null, pool, poolhh: mc >= 100 ? pool / mc : null, due: r.modsDue, signal: sg[z.zip], sep: z.acs.sep_per_1k_married, capture: null, inc: z.acs.med_hh_inc, res: r }; });
      }
      const sg = sigC(); const fs = areaKind() === 'tx' ? CTY.map(c => c.fips) : areaKind() === 'msa' ? areaFips() : [areaId()];
      return fs.map(f => { const c = CI[f]; const r = FCC[s][f]; const mar = c.acs.married, mc = c.acs.mc_fam; const pool = poolOf(r.lines, t, c.acs.med_hh_inc);
        return { _id: f, kind: 'cty', obj: c, name: c.name, county: c.name, married: mar, mcfam: mc, div: r.lines.div[t], rate: mar >= 200 ? r.lines.div[t] / mar * 1000 : null, pool, poolhh: mc >= 100 ? pool / mc : null, due: r.modsDue, signal: sg[f], sep: c.acs.sep_per_1k_married, capture: r.captureSource === 'area' ? r.capture : null, inc: c.acs.med_hh_inc, res: r }; });
    }
    const LAYERS = () => ({
      rate: { l: `Expected divorce filings per 1,000 married adults, ${st.year}`, ramp: 'forest', g: 'B', v: u => u.rate, f: v => N(v, 1) },
      div: { l: `Expected divorce filings, ${st.year}`, ramp: 'forest', g: 'B', v: u => u.div, f: v => N(v, 0), log: true },
      pool: { l: `Fee pool, ${st.year}, at the stated fees ($)`, ramp: 'teal', g: 'D', v: u => u.pool, f: v => fcM(v), log: true },
      poolhh: { l: `Fee pool per married couple family, ${st.year} ($)`, ramp: 'teal', g: 'D', v: u => u.poolhh, f: v => $$$(v) },
      due: { l: 'Modifications due 2026 to 2030: orders with children reaching three years', ramp: 'sage', g: 'C', v: u => u.due, f: v => N(v, 0), log: true },
      signal: { l: 'Contested and complex case signal (percentile blend)', ramp: 'sage', g: 'C', v: u => u.signal, f: v => N(v, 0) },
      sep: { l: 'Separated adults per 1,000 married (ACS)', ramp: 'forest', g: 'A', v: u => u.sep, f: v => N(v, 1) },
      capture: { l: 'Filed against modeled, 2025 (counties only)', ramp: 'slate', g: 'B', v: u => u.capture, f: v => N(v, 2) }
    });

    // ---------- the page
    const metroOpts = Object.keys(MSA).sort((a, b) => MSA[b].pop2025 - MSA[a].pop2025);
    const areaSel = `<select id="fcArea"><option value="tx">Texas, all 254 counties</option><optgroup label="Metros">${metroOpts.map(k => `<option value="msa:${k}">${esc(MNAME(MSA[k].title))}</option>`).join('')}</optgroup><optgroup label="Counties">${CTY.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="cty:${c.fips}">${esc(c.name)} County</option>`).join('')}</optgroup></select>`;
    const G0 = D.pums.groups;
    root.innerHTML = mastHTML({ eyebrow: 'Module 26 · Filings Forecast · divorce, modification and enforcement filings, 2026 to 2035', title: 'Filings Forecast', dek: `Texas has ${K(ST.acs.married)} married adults, and a marriage's chance of ending in divorce depends first on how long it has lasted: ${N(G0['dur_5-9'].haz, 1)} per 1,000 a year in years five to nine against ${N(G0['dur_30+'].haz, 1)} after thirty (ACS microdata, 2020 to 2024). This module ages every county's married stock one year at a time through that curve, adds the new marriages, calibrates the level to the divorce filings each county actually reported in ${BASE}, and carries the result to ${BASE + 10} under three scenarios. Modification and enforcement follow the orders with children those filings create. Stated fees turn the counts into a fee pool by ZIP, county and metro, and a support calculator turns the modification rule into numbers.`, facts: [[N(sum(CTY.map(c => CA[c.fips].obs.div || 0))), `Texas divorce filings in ${BASE} (court reports)`], [N(capS, 2), 'filings per modeled divorce, statewide (the capture ratio)'], [N(HZ.medianDuration(), 1) + ' yrs', 'median years married of married Texans (PUMS)'], ['3', 'scenarios: as fitted, secular decline, recession in 2027']] }) +
      `${toolbarHTML('Filings Forecast', 'Ten year forecast, fee pool, modification check', [{ id: 'fcCsv', label: '↓ Forecast CSV' }, { id: 'fcZipCsv', label: '↓ Fee pool by ZIP' }, { id: 'fcDesk', label: 'Campaign Desk ↗' }, { id: 'fcForge', label: 'Site Forge ↗' }, { id: 'fcReset', label: 'Reset assumptions' }])}
      ${callout('note', 'Read this first: what this forecast is and is not', `<p>An <b>expected filing</b> here is the number of divorce petitions an area's married adults would produce in a year if the 2020 to 2024 hazard by years married held, scaled to the filings the area's courts reported in ${BASE}. It is built from three things Severance measures: the married stock (American Community Survey), its split by years married (the Texas microdata), and the hazard curve with its standard errors; the court filings fix the level. It ages <b>marriages</b>, not people: it cannot see a particular couple, a firm's share, or a neighborhood that is unusually unhappy, and nothing here says anything about any person's marriage. Scenarios are stated what ifs, graded C. The fee pool is the fees every expected matter would pay at the fees you state, if every party retained counsel at those fees; it is the size of a market, not a firm's revenue. ZIP figures are county filings allocated to ZIPs (module 07), aged by each ZIP's own mix. The calculator at the end is an illustration of Tex. Fam. Code § 156.401, not legal advice.</p>`)}
      <div class="panel" style="margin-bottom:14px">
        <div class="controls">
          ${ctl('Area', areaSel)}
          <div class="ctl"><label id="fcScnL">Scenario</label>${segHTML('fcScn', Object.values(HZ.SCENARIOS).map(s => [s.key, s.label]), st.scn).replace('role="group"', 'role="group" aria-labelledby="fcScnL"')}</div>
          <div class="ctl"><label id="fcNewL">Married stock</label>${segHTML('fcNew', [['grow', 'Grows with the population'], ['hold', 'Held at today\'s size'], ['closed', 'Today\'s marriages only']], st.stock).replace('role="group"', 'role="group" aria-labelledby="fcNewL"')}</div>
        </div>
        <div class="controls fc-scn" id="fcDecl"${st.scn === 'decline' ? '' : ' hidden'}>${ctl('NCHS trend window', `<select id="fcTrend">${FC_TRENDS.map(t => `<option value="${t[0]}-${t[1]}">${t[0]} to ${t[1]}</option>`).join('')}</select>`)}<span class="small fc-hint" id="fcDeclN"></span></div>
        <div class="controls fc-scn" id="fcRec"${st.scn === 'recession' ? '' : ' hidden'}>${ctl('Claims above normal (%)', '<input type="number" id="fcSurge" min="0" max="500" step="10" inputmode="numeric" style="width:90px">')}${ctl('For how many months', '<input type="number" id="fcMonths" min="1" max="24" step="1" inputmode="numeric" style="width:80px">')}${ctl('Panel fit', sel('fcPanel', [['full', 'Full sample, 2019 to 2026'], ['post2022', 'Since 2022']], st.panel))}<span class="small fc-hint" id="fcRecN"></span></div>
        <p class="small" id="fcScnNote" style="margin:0"></p>
      </div>
      <div class="tiles" id="fcKpis"></div>
      <div class="panel" style="margin-bottom:14px">
        <div class="controls">${ctl('Map layer', '<select id="fcLayer"></select>')}${ctl('Year', sel('fcYear', FY.map(y => [y, String(y)]), st.year))}<div class="ctl"><label id="fcLevL">Map level</label>${segHTML('fcLevel', [['zip', 'ZIP codes'], ['cty', 'Counties']], level()).replace('role="group"', 'role="group" aria-labelledby="fcLevL"')}</div></div>
        <div class="split"><div><div class="mapwrap" id="fcMap"></div><p class="small" id="fcMapNote" style="margin-top:6px"></p></div><div id="fcSide"></div></div>
      </div>
      <div class="gridA">
        <div class="panel"><h3>The next ten years of divorce filings</h3><div class="sub" id="fcChartSub"></div><div class="chart" id="fcChart"></div><p class="small" id="fcChartNote"></p></div>
        <div class="panel"><h3>The long tail: modification and enforcement</h3><div class="sub">Modification and enforcement filings move with the orders involving children filed in the five years before (divorces with children plus custody suits), observed through ${BASE} and expected after. The recession scenario adds the panel's own effect on each line.</div><div class="chart" id="fcChart2"></div><p class="small" id="fcChart2Note"></p></div>
      </div>
      <div class="gridA">
        <div class="panel"><h3>Cohort waves: Texas weddings by year</h3><div class="sub">Marriages per 1,000 Texas residents by year (NCHS), with the share of each year's marriages still intact in ${BASE + 1} at the fitted hazard (divorce alone; widowhood and moves are not in it). Highlighted: the cohorts in their fifth to ninth year now, the peak of the curve.</div><div class="chart" id="fcCoh"></div><p class="small" id="fcCohNote"></p></div>
        <div class="panel"><h3>What gets filed</h3><div class="sub" id="fcMixSub"></div><div class="chart" id="fcMix"></div><h4 class="fc-h4">Who pays</h4><div class="chart" id="fcPay"></div><p class="small" id="fcMixNote"></p></div>
      </div>
      <div class="panel" style="margin-bottom:14px"><h3>Firm economics: the fee pool</h3><div class="sub">Fees per matter by line. Defaults come from the firm profile when the firm entered an advertised fee, otherwise from the Severance model default for the line, a model average (module 06). Every number is yours to change; the map, table, tiles and exports follow. Saved in this browser.</div>
        <div class="fc-econ"><div><div class="tblbox"><div class="tblwrap"><table class="t fc-fees"><caption class="vh">Fees per matter by line</caption><thead><tr><th class="l">Line and source of the fee</th><th>In pool</th><th>Fee per matter $</th></tr></thead><tbody id="fcFees"></tbody></table></div></div>
          <div class="controls" style="margin-top:12px">${ctl('Contested share of divorces (%)', '<input type="number" id="fcCont" min="0" max="100" step="5" inputmode="numeric" style="width:90px">')}${ctl('Contested matters bill at (×)', '<input type="number" id="fcCmult" min="0.5" max="5" step="0.1" inputmode="decimal" style="width:90px">')}<label class="chk"><input type="checkbox" id="fcInc"> Scale fees by local median household income</label>${ctl('Income elasticity', '<input type="number" id="fcIncEl" min="0" max="2" step="0.1" inputmode="decimal" style="width:80px">')}</div>
          <p class="small" id="fcEconNote"></p></div>
          <div><h4 class="fc-h4" id="fcPoolH"></h4><div class="chart" id="fcPoolLines"></div></div></div>
      </div>
      <div class="panel" style="margin-bottom:14px"><h3>Contested and complex case signal</h3><div class="sub">Where a divorce is more likely to turn on custody, a business, a military retirement or a blended family. A percentile blend of five observable shares; the weights are stated and yours to change.</div>
        <div class="controls">${FC_SIG.map(s => ctl(s.l + ' weight', `<input type="number" id="fcW_${s.k}" min="0" max="100" step="5" inputmode="numeric" style="width:80px">`)).join('')}</div>
        <div class="fc-facts" id="fcFacts"></div><div id="fcTop"></div>
        ${callout('judg', 'Judgment call: the signal is a blend, not a measurement', `<p>No Texas dataset records which divorces are contested or complex by county or ZIP. The signal ranks each area on the share of married couple families with children, households over $150,000, self employed married adults, active duty households and remarried adults, and averages the five percentile ranks with the weights above. The defaults (30, 25, 15, 10 and 20) encode where custody, business valuation, military retirement and blended family issues are known to arise; they are stated so you can reweight.</p>`)}
      </div>
      <div class="panel" style="margin-bottom:14px"><h3 id="fcTblH">Ranked areas</h3><div class="sub" id="fcTblSub"></div><div id="fcTbl"></div></div>
      <div class="panel" style="margin-bottom:14px"><h3>Modify or leave it: the child support check</h3><div class="sub">The conversation at intake, with numbers. Enter the order and the obligor's monthly net resources then and now; the check applies the guideline percentages of Tex. Fam. Code § 154.125 to net resources up to the cap in effect on each date, and the three year test of § 156.401(a)(2). An illustration, not legal advice.</div>
        <div class="formgrid" id="fcCalcIn">
          ${fieldHTML({ k: 'date', id: 'fcOd', l: 'Order rendered or last modified', t: 'date' }, '2022-05-02')}
          ${fieldHTML({ k: 'kids', id: 'fcKids', l: 'Children before the court', t: 'number', min: 1, max: 20, step: 1 }, 2)}
          ${fieldHTML({ k: 'other', id: 'fcOther', l: 'Other children the obligor supports', t: 'number', min: 0, max: 20, step: 1 }, 0)}
          ${fieldHTML({ k: 'then', id: 'fcThen', l: 'Obligor net resources then, $ a month', t: 'number', min: 0, step: 50 }, 6000)}
          ${fieldHTML({ k: 'now', id: 'fcNow', l: 'Obligor net resources now, $ a month', t: 'number', min: 0, step: 50 }, 8500)}
          ${fieldHTML({ k: 'ord', id: 'fcOrd', l: 'Amount the order sets, $ a month (optional)', t: 'number', min: 0, step: 10, hint: 'Blank: the guideline amount on the order date.' }, '')}
          ${fieldHTML({ k: 'agreed', id: 'fcAgreed', l: 'The order was an agreed amount that differs from the guidelines', t: 'checkbox' }, false)}
        </div><div id="fcCalcOut" aria-live="polite"></div>
      </div>
      <div class="gridA">
        <div class="panel"><h3>How the forecast is built</h3><div class="sub">The arithmetic in order. Every step names its source and grade.</div><ol class="fc-meth" id="fcMeth"></ol></div>
        <div class="panel"><h3>Does the model match the data?</h3><div class="sub">Three checks against what was observed.</div><div id="fcFit"></div></div>
      </div>
      <div class="gridA">
        <div class="panel"><h3>Judgment calls</h3><div class="sub">Places where the model had to choose. Each is reversible from a control above or stated so you can disagree with one number.</div><div id="fcJudg"></div></div>
        <div class="panel"><h3>Caveats</h3><div id="fcCav"></div></div>
      </div>
      <div class="panel" style="margin-bottom:14px"><h3>Sources</h3><ul class="srcs" id="fcSrc"></ul></div>
      <p class="small">Severance, module 26. Expected filings are expectations from a calibrated model of the married stock, not forecasts of any firm's caseload and not statements about any marriage. Dollar figures multiply those counts by fees you state.</p>`;
    const $r = s => $(s, root);

    // ---------- scenario controls
    function syncControls() {
      $r('#fcArea').value = st.area; $$('#fcScn button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.scn)));
      $$('#fcNew button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.stock)));
      $r('#fcDecl').hidden = st.scn !== 'decline'; $r('#fcRec').hidden = st.scn !== 'recession';
      $r('#fcTrend').value = st.from + '-' + st.to; $r('#fcSurge').value = st.surge; $r('#fcMonths').value = st.months; $r('#fcPanel').value = st.panel;
      $r('#fcYear').value = String(st.year); $r('#fcCont').value = st.contested; $r('#fcCmult').value = st.cmult; $r('#fcInc').checked = st.incAdj; $r('#fcIncEl').value = st.incEl; $r('#fcIncEl').disabled = !st.incAdj;
      FC_SIG.forEach(s => { $r('#fcW_' + s.k).value = st.w[s.k]; });
      const zb = $r('#fcLevel button[data-v="zip"]'); zb.disabled = !zipOk(); zb.title = zipOk() ? '' : 'ZIP geometry exists inside the 26 metros only; pick a metro or a metro county';
      $$('#fcLevel button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === level())));
    }
    function scnNote() {
      const s = HZ.SCENARIOS[st.scn]; const p = PRM();
      $r('#fcScnNote').innerHTML = `<b>${esc(s.label)}</b> ${gradeTag(s.grade)} ${esc(s.desc(p))} ${esc(STOCK_NOTE[st.stock])}`;
      const r = HZ.declineRate(st.from, st.to); const r10 = Math.pow(1 + r, 10) - 1; $r('#fcDeclN').textContent = `${sgn(r * 100, 1)} a year, so the hazard in ${BASE + 10} is ${r10 < 0 ? 'down' : 'up'} ${P(Math.abs(r10), 0)} on ${BASE}.`;
      const rd = HZ.recession('div', p), rm = HZ.recession('mod', p), re = HZ.recession('enf', p); const ys = Object.keys(rd).map(Number).sort();
      $r('#fcRecN').textContent = ys.length ? ys.map(y => `${y}: divorce ${sgn((rd[y] - 1) * 100, 1)}, modification ${sgn(((rm[y] || 1) - 1) * 100, 1)}, enforcement ${sgn(((re[y] || 1) - 1) * 100, 1)}`).join('; ') : 'No effect at a zero surge.';
    }
    const gradeTag = g => `<span class="grade ${g[0]}" title="Confidence grade ${g}">${g}</span>`;

    // ---------- KPIs
    function ytd() {
      const fs = areaFips().map(f => CI[f]).filter(c => c.filings && c.filings.ytd26 && c.filings.ytd25);
      const thr = fmtDate(META.oca_through); const mo = String(META.oca_through || '').match(/-(\d{2})$/); const mon = mo ? MO[+mo[1] - 1] : '';
      if (areaKind() !== 'tx' && fs.length) { const a = sum(fs.map(c => c.filings.ytd26.f_div || 0)), b = sum(fs.map(c => c.filings.ytd25.f_div || 0)); const all = areaFips().length; return { a, b, sub: `${N(a)} divorce filings January to ${mon} 2026 against ${N(b)} a year earlier${fs.length < all ? `, the ${fs.length} of ${all} counties that report monthly` : ''}`, g: 'A' }; }
      const m = ST.monthly; const L = m.div.length - 1; const tEnd = m.t0 + L; const Y = Math.floor(tEnd / 12), M = tEnd % 12; let a = 0, b = 0;
      for (let k = 0; k <= M; k++) { const i26 = Y * 12 + k - m.t0, i25 = (Y - 1) * 12 + k - m.t0; a += m.div[i26] || 0; b += m.div[i25] || 0; }
      return { a, b, sub: `${areaKind() === 'tx' ? '' : 'Statewide series (no monthly county reports here): '}${N(a)} Texas divorce filings January to ${MO[M]} ${Y} against ${N(b)} a year earlier, through ${thr}`, g: 'A' };
    }
    function kpis() {
      const A = agg(st.scn); const B = areaBand(st.scn); const d26 = A.lines.div[1]; const pool26 = areaPool(st.scn, 1); const cont = (A.lines.div_k[1] + A.lines.div_nk[1]) * st.contested / 100;
      const pk = FY[A.lines.div.slice(1).indexOf(Math.max(...A.lines.div.slice(1)))]; const y = ytd(); const s = HZ.SCENARIOS[st.scn];
      $r('#fcKpis').innerHTML = [
        tile('Expected filings 2026', N(d26, 0), `divorce petitions, ${esc(s.short.toLowerCase())}, ${esc(areaTitle())}; 90% band ±${N(B.div[1].hi, 0)} (approximate)`, 'B'),
        tile('Fee pool 2026', fcM(pool26), `every expected matter at the stated fees, ${FC_FEE_LINES.filter(k => st.inc[k]).length} lines${st.inc.ivd ? '' : ', IV-D excluded'}`, 'D'),
        tile('Contested matters 2026', N(cont, 0), `divorces at a ${N(st.contested, 0)}% contested share`, 'D'),
        tile('Modifications due', N(A.modsDue, 0), 'orders with children reaching three years in 2026 to 2030 (the § 156.401(a)(2) clock)', 'C'),
        tile('Peak of the decade', String(pk), `${N(A.lines.div[pk - BASE], 0)} expected divorce filings that year, ${esc(s.short.toLowerCase())}`, 'C'),
        tile('Filed against modeled', N(A.capture, 2), `${N(A.lines.div[0])} filings in ${BASE} on ${N(A.modeled[0], 0)} modeled divorces`, 'B'),
        tile('Observed 2026 so far', isN(y.a) && y.b > 0 ? sgn((y.a / y.b - 1) * 100, 1) : NA, y.sub, y.g)
      ].join('');
    }

    // ---------- map, side ledger, table
    let tbl = null, UNITS = [];
    function layerSel() { const Ls = LAYERS(); const keys = Object.keys(Ls).filter(k => k !== 'capture' || level() === 'cty'); if (!keys.includes(st.layer)) st.layer = 'rate'; $r('#fcLayer').innerHTML = keys.map(k => `<option value="${k}"${k === st.layer ? ' selected' : ''}>${esc(Ls[k].l)}</option>`).join(''); }
    function bboxOf(paths, W, H, padF) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      Object.values(paths).forEach(d => { const n = String(d).match(/-?\d+(?:\.\d+)?/g) || []; for (let i = 0; i + 1 < n.length; i += 2) { const x = +n[i], y = +n[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
      if (!isFinite(x0)) return null; let w = x1 - x0, h = y1 - y0; const pad = Math.max(w, h) * (padF || 0.08) + 4; x0 -= pad; y0 -= pad; w += 2 * pad; h += 2 * pad;
      const asp = W / H; if (w / h < asp) { const nw = h * asp; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / asp; y0 -= (nh - h) / 2; h = nh; }
      return [x0, y0, w, h];
    }
    const tipOf = (u, L) => `<b>${esc(u.kind === 'zip' ? u._id + ' · ' + (u.obj.city || '') : u.name + ' County')}</b>${u.kind === 'zip' ? `<div class="row"><span>${esc(u.county)} County</span><span></span></div>` : ''}<div class="row"><span>${esc(L.l)}</span><span>${esc(L.f(L.v(u)))}</span></div><div class="row"><span>Expected divorce filings ${st.year}</span><span>${N(u.div, 0)}</span></div><div class="row"><span>Fee pool ${st.year}</span><span>${fcM(u.pool)}</span></div><div class="row"><span>Modifications due 2026 to 2030</span><span>${N(u.due, 0)}</span></div><div class="row"><span>Married adults</span><span>${N(u.married)}</span></div>`;
    function drawFcMap() {
      const L = LAYERS()[st.layer]; const el = $r('#fcMap'); const ui = {}; UNITS.forEach(u => { ui[u._id] = u; }); const sc = layerScale(L, UNITS);
      const onSelect = id => { if (!ui[id]) return; st.sel = st.sel === id ? null : id; markSel(el, st.sel); side(); if (tbl) tbl.setSel(st.sel); };
      if (level() === 'zip') {
        const m = areaMetro(); const M = GEO.metros[m]; let paths = M.zcta, view = null;
        if (areaKind() === 'cty') { paths = {}; Object.keys(M.zcta).forEach(id => { if ((M.zc_county || {})[id] === areaId()) paths[id] = M.zcta[id]; }); view = bboxOf(paths, M.W, M.H, 0.06); if (!Object.keys(paths).length) paths = M.zcta; }
        drawMap(el, { title: `${areaTitle()} ZIP codes, ${L.l}`, W: M.W, H: M.H, paths, value: id => ui[id] ? L.v(ui[id]) : null, color: sc.color, label: id => ui[id] ? tipOf(ui[id], L) : `<b>${esc(id)}</b><div class="small">no ZIP data here</div>`, onSelect, selected: st.sel, counties: M.county, cent: M.ccent, labels: Object.keys(M.county), labelText: id => CI[id] ? CI[id].name : id, legend: Object.assign({ title: L.l }, sc.legend), noDataLabel: 'no data or outside the area', view });
        $r('#fcMapNote').innerHTML = `${UNITS.length} ZIP codes. ZIP filings are the county's last twelve months allocated by married adults times the hazard (module 07), aged here by each ZIP's own years married mix; where a county clerk reported nothing for twelve months, its ${BASE} count is allocated the same way. ${gradeTag(L.g)} ${esc(L.l)}.`;
      } else {
        const GS = GEO.state; const fs = new Set(UNITS.map(u => u._id)); let view = null;
        if (areaKind() !== 'tx') { const ps = {}; fs.forEach(f => { if (GS.county[f]) ps[f] = GS.county[f]; }); view = bboxOf(ps, GS.W, GS.H, areaKind() === 'cty' ? 0.9 : 0.08); }
        drawMap(el, { title: `${areaTitle()} counties, ${L.l}`, W: GS.W, H: GS.H, paths: GS.county, value: id => fs.has(id) && ui[id] ? L.v(ui[id]) : null, color: sc.color, label: id => ui[id] ? tipOf(ui[id], L) : `<b>${esc(CI[id] ? CI[id].name + ' County' : id)}</b><div class="small">outside ${esc(areaTitle())}</div>`, onSelect, selected: st.sel || (areaKind() === 'cty' ? areaId() : null), outline: GS.outline, legend: Object.assign({ title: L.l }, sc.legend), noDataLabel: areaKind() === 'tx' ? 'no data' : 'outside the area', view });
        $r('#fcMapNote').innerHTML = `${UNITS.length} ${UNITS.length === 1 ? 'county' : 'counties'}. ${gradeTag(L.g)} ${esc(L.l)}.${zipOk() ? '' : ' ZIP maps exist inside the 26 metros only.'}`;
      }
    }
    const hb = (l, v, t, c) => `<div class="fc-hb"><span>${esc(l)}</span><b>${N(v, 0)} · ${P(v / Math.max(1, t), 0)}</b></div><div class="fc-bar"><i style="width:${clamp(v / Math.max(1, t) * 100, 0, 100)}%;background:${c}"></i></div>`;
    function side() {
      const u = UNITS.find(x => x._id === st.sel) || null; const el = $r('#fcSide');
      if (!u) {
        const A = agg(st.scn); const B = areaBand(st.scn); const L = A.lines; const t = ti(); const tot = L.div[t];
        el.innerHTML = `<h3 class="fc-sh">${esc(areaTitle())}</h3><div class="small">Area ledger · ${esc(HZ.SCENARIOS[st.scn].label)} · click a ${level() === 'zip' ? 'ZIP' : 'county'} for its own</div>
          <div class="fc-big">${N(tot, 0)}</div><div class="small">expected divorce filings in ${st.year}, approximate 90% band ${N(tot - B.div[t].lo, 0)} to ${N(tot + B.div[t].hi, 0)}</div><div class="chart" id="fcMini"></div>
          <h4 class="fc-h4">By case type, ${st.year}</h4>${hb('Divorce with children', L.div_k[t], tot, 'var(--s1)')}${hb('Divorce without children', L.div_nk[t], tot, 'var(--s3)')}
          <dl class="kv" style="margin-top:8px"><dt>Modifications expected ${st.year}</dt><dd>${N(L.mod[t], 0)}</dd><dt>Enforcements expected ${st.year}</dt><dd>${N(L.enf[t], 0)}</dd><dt>Modifications due 2026 to 2030</dt><dd>${N(A.modsDue, 0)}</dd><dt>Fee pool ${st.year}</dt><dd>${fcM(areaPool(st.scn, t))}</dd><dt>Married adults (ACS)</dt><dd>${N(A.married[0])}</dd><dt>Married adults modeled in ${BASE + 10}</dt><dd>${N(A.married[10])}</dd><dt>Filed against modeled, ${BASE}</dt><dd>${N(A.capture, 2)}</dd></dl>`;
        miniChart(A.lines.div, B.div); return;
      }
      const o = u.obj; const r = u.res; const t = ti(); const tot = r.lines.div[t];
      const b = u.kind === 'cty' ? areaBand(st.scn, [u._id], 'cty:' + u._id).div : HZ.band(HZ.forecast({ married: o.acs.married, buckets: o.risk, marLy: o.risk.mar_ly, growth: CA[o.county] && growOn() ? CA[o.county].growth : 0, obs: { div: (r.alloc || {}).div || 0, div_k: (r.alloc || {}).div_k || 0 } }, { scenario: st.scn, params: PRM(), newMarriages: newOn(), grad: true }).grad.div);
      const tags = tagsOf(o, u.kind);
      el.innerHTML = `<h3 class="fc-sh">${esc(u.kind === 'zip' ? u._id + ' · ' + (o.city || '') : u.name + ' County')}</h3><div class="small">${u.kind === 'zip' ? esc(o.county_name) + ' County · ' : ''}${N(u.married)} married adults · ${esc(HZ.SCENARIOS[st.scn].short)}</div>
        <div class="fc-big">${N(tot, 0)}</div><div class="small">expected divorce filings in ${st.year} · ${N(u.rate, 1)} per 1,000 married · band ±${N(b[t].hi, b[t].hi < 10 ? 1 : 0)}</div><div class="chart" id="fcMini"></div>
        <h4 class="fc-h4">By case type, ${st.year}</h4>${hb('Divorce with children', r.lines.div_k[t], tot, 'var(--s1)')}${hb('Divorce without children', r.lines.div_nk[t], tot, 'var(--s3)')}
        <h4 class="fc-h4">Years married (PUMS)</h4><div class="fc-dur">${[['dur_lt5', 'under 5'], ['dur_5_9', '5 to 9'], ['dur_10_19', '10 to 19'], ['dur_20p', '20 and over']].map(([k, l], i) => `<i style="flex:${Math.max(0.001, o.risk[k] || 0)};background:${['var(--s2)', 'var(--hl)', 'var(--s1)', 'var(--line-strong)'][i]}" title="${l} years: ${P(o.risk[k], 0)}"></i>`).join('')}</div><div class="fc-durl"><span>under 5: ${P(o.risk.dur_lt5, 0)}</span><span>5 to 9: ${P(o.risk.dur_5_9, 0)}</span><span>10 to 19: ${P(o.risk.dur_10_19, 0)}</span><span>20 and over: ${P(o.risk.dur_20p, 0)}</span></div>
        <dl class="kv" style="margin-top:8px"><dt>Modifications expected ${st.year}</dt><dd>${N(r.lines.mod[t], 0)}</dd><dt>Modifications due 2026 to 2030</dt><dd>${N(u.due, 0)}</dd><dt>Fee pool ${st.year}</dt><dd>${fcM(u.pool)}</dd><dt>Per married couple family</dt><dd>${$$$(u.poolhh)}</dd><dt>Contested and complex signal</dt><dd>${N(u.signal, 0)}</dd><dt>Separated per 1,000 married</dt><dd>${N(u.sep, 1)}</dd>${u.kind === 'cty' ? `<dt>Filed against modeled, ${BASE}</dt><dd>${r.captureSource === 'area' ? N(r.capture, 2) : 'statewide ratio (no filings reported)'}</dd>` : `<dt>Allocated divorce filings a year${r.alloc && r.alloc._re ? ' (from 2025, a clerk reporting gap)' : ''}</dt><dd>${N((r.alloc || o.alloc || {}).div, 1)}</dd>`}</dl>
        <div class="fc-tags">${tags.length ? tags.map(x => `<span class="pill">${esc(x)}</span>`).join(' ') : '<span class="small">No composition tag in the top tenth</span>'}</div>
        <p class="small" style="margin-top:6px">Tags mark the top tenth of ${u.kind === 'zip' ? 'ZIPs' : 'counties'} on each share; they describe the area's married population, not any household in it.</p>`;
      miniChart(r.lines.div, b);
    }
    function miniChart(arr, b) {
      const c = $r('#fcMini'); if (!c) return; const mn = Math.min(...arr.map((v, i) => v - b[i].lo));
      lineChart(c, { title: 'Ten year forecast for the selection', W: 420, H: 150, ymin: Math.max(0, mn * 0.9), xTicks: [2025, 2027, 2029, 2031, 2033, 2035], xfmt: v => String(v), yfmt: v => N(v, 0), series: [{ name: 'Band, upper', lname: '90% band', color: 'var(--line-strong)', dash: true, values: YRS.map((y, i) => ({ x: y, y: arr[i] + b[i].hi })) }, { name: 'Expected divorce filings', color: SCN_COLOR[st.scn], values: YRS.map((y, i) => ({ x: y, y: arr[i] })) }, { name: 'Band, lower', nolegend: true, color: 'var(--line-strong)', dash: true, values: YRS.map((y, i) => ({ x: y, y: Math.max(0, arr[i] - b[i].lo) })) }] });
    }
    function drawTable() {
      const z = level() === 'zip'; const y = st.year;
      const cols = [{ k: 'name', l: z ? 'ZIP' : 'County', fmt: (v, r) => esc(z ? r._id + ' ' + (r.obj.city || '') : v), h: z ? 'ZIP and city' : 'County' }].concat(z ? [{ k: 'county', l: 'County', fmt: v => esc(v), cls: 'l' }] : []).concat([
        { k: 'married', l: 'Married', fmt: v => N(v), h: 'Married adults (ACS)', d: 0 }, { k: 'div', l: `Filings ${y}`, fmt: v => N(v, 0), h: `Expected divorce filings ${y}`, d: 1 }, { k: 'rate', l: 'Per 1k married', tip: 'Expected divorce filings per 1,000 married adults', fmt: v => N(v, 1), h: 'Expected divorce filings per 1,000 married', d: 2 },
        { k: 'pool', l: `Fee pool ${y}`, fmt: v => fcM(v), h: `Fee pool ${y} ($)`, d: 0 }, { k: 'poolhh', l: 'Per family', tip: 'Fee pool per married couple family', fmt: v => $$$(v), h: 'Fee pool per married couple family ($)', d: 0 }, { k: 'due', l: 'Mods due', tip: 'Modifications due 2026 to 2030: orders with children reaching three years', fmt: v => N(v, 0), h: 'Orders with children reaching three years 2026 to 2030', d: 1 },
        { k: 'signal', l: 'Signal', tip: 'Contested and complex case signal, a percentile blend', fmt: v => N(v, 0), h: 'Contested and complex case signal', d: 0 }, { k: 'sep', l: 'Sep. /1k', tip: 'Separated adults per 1,000 married (ACS)', fmt: v => N(v, 1), h: 'Separated per 1,000 married', d: 1 }]).concat(z ? [] : [{ k: 'capture', l: 'Filed / modeled', tip: 'Divorce filings in 2025 against modeled divorces', fmt: v => N(v, 2), h: 'Filed against modeled 2025', d: 3 }]);
      $r('#fcTblH').textContent = z ? `Ranked ZIP codes, ${areaTitle()}` : `Ranked counties, ${areaTitle()}`;
      $r('#fcTblSub').textContent = `${UNITS.length} ${z ? 'ZIP codes' : UNITS.length === 1 ? 'county' : 'counties'} · ${HZ.SCENARIOS[st.scn].label} · ${y}. Sort any column; click a row to select it on the map.`;
      const prev = tbl ? tbl.sort() : { k: 'pool', dir: -1 };
      tbl = table($r('#fcTbl'), { caption: 'Ranked areas by expected filings and fee pool', cols, rows: UNITS, sort: cols.some(c => c.k === prev.k) ? prev : { k: 'pool', dir: -1 }, limit: 300, selected: st.sel, onRow: id => { st.sel = st.sel === id ? null : id; markSel($r('#fcMap'), st.sel); side(); tbl.setSel(st.sel); } });
    }

    // ---------- charts
    function charts() {
      const fs = areaFips(); const S = {}; Object.keys(HZ.SCENARIOS).forEach(k => { S[k] = agg(k, fs); }); const B = areaBand(st.scn);
      const cur = S[st.scn].lines.div; const all = Object.values(S).flatMap(a => a.lines.div); const mn = Math.min(...all.concat(cur.map((v, i) => v - B.div[i].lo)));
      $r('#fcChartSub').innerHTML = `Expected divorce filings a year, ${esc(areaTitle())}, ${BASE} observed and ${BASE + 1} to ${BASE + 10} expected. The chosen scenario is solid, the others dashed; the gray dashes are its approximate 90% band. ${gradeTag('B')} The axis starts near the lowest line, not at zero.`;
      const ser = Object.values(HZ.SCENARIOS).map(s => ({ name: s.label, color: SCN_COLOR[s.key], dash: s.key !== st.scn, values: YRS.map((y, i) => ({ x: y, y: S[s.key].lines.div[i] })) }));
      ser.push({ name: '90% band, upper', lname: '90% band (approximate)', color: 'var(--line-strong)', dash: true, values: YRS.map((y, i) => ({ x: y, y: cur[i] + B.div[i].hi })) }, { name: '90% band, lower', nolegend: true, color: 'var(--line-strong)', dash: true, values: YRS.map((y, i) => ({ x: y, y: cur[i] - B.div[i].lo })) });
      lineChart($r('#fcChart'), { title: 'Expected divorce filings by year under three scenarios', series: ser, W: 640, H: 260, ymin: Math.max(0, mn * 0.85), xTicks: YRS, xfmt: v => String(v) + (v === BASE ? ' (observed)' : ''), yfmt: v => N(v, 0), bands: Object.keys(HZ.recession('div', PRM())).length ? [{ x0: HZ.PARAMS.start, x1: HZ.PARAMS.start + 1, label: 'Claims surge' }] : null });
      const f = S.fit.lines.div, dcl = S.decline.lines.div, rec = S.recession.lines.div; const gap = Math.sqrt(Math.max(1, cur[0]));
      $r('#fcChartNote').innerHTML = `${esc(areaTitle())} filed ${N(cur[0])} divorces in ${BASE}. As fitted, the married stock ages and grows with the population and filings reach ${N(f[10], 0)} by ${BASE + 10} (${sgn((f[10] / f[0] - 1) * 100, 1)}). If the secular decline continues (${st.from} to ${st.to} trend) the ${BASE + 10} figure is ${N(dcl[10], 0)}; a recession in ${HZ.PARAMS.start} moves ${HZ.PARAMS.start} to ${N(rec[HZ.PARAMS.start - BASE], 0)} and ${HZ.PARAMS.start + 1} to ${N(rec[HZ.PARAMS.start + 1 - BASE], 0)}. The band (±${N(B.div[10].hi, 0)} by ${BASE + 10}) is narrow because the court count fixes the level: it carries the curve's sampling error only. Chance alone moves a count of ${N(cur[0])} by about ±${N(gap, 0)} a year (the square root of the count)${gap > B.div[10].hi ? ', more than the band' : ''}.`;
      const A = S[st.scn]; const s2 = [{ name: 'Modification', color: 'var(--s3)', values: YRS.map((y, i) => ({ x: y, y: A.lines.mod[i] })) }, { name: 'Enforcement', color: 'var(--s4)', values: YRS.map((y, i) => ({ x: y, y: A.lines.enf[i] })) }];
      if (st.scn !== 'fit') s2.push({ name: 'Modification, as fitted', color: 'var(--s3)', dash: true, values: YRS.map((y, i) => ({ x: y, y: S.fit.lines.mod[i] })) }, { name: 'Enforcement, as fitted', color: 'var(--s4)', dash: true, values: YRS.map((y, i) => ({ x: y, y: S.fit.lines.enf[i] })) });
      lineChart($r('#fcChart2'), { title: 'Expected modification and enforcement filings', series: s2, W: 640, H: 240, ymin: 0, xTicks: YRS, xfmt: v => String(v), yfmt: v => N(v, 0) });
      $r('#fcChart2Note').innerHTML = `${N(A.lines.mod[0])} modifications and ${N(A.lines.enf[0])} enforcements were filed in ${BASE}; under ${esc(HZ.SCENARIOS[st.scn].short.toLowerCase())} they run ${N(A.lines.mod[10], 0)} and ${N(A.lines.enf[10], 0)} in ${BASE + 10}. ${N(A.modsDue, 0)} orders involving children reach their three year mark in 2026 to 2030, when a support order becomes reviewable under § 156.401(a)(2) without proof of a material change. ${gradeTag('C')}`;
      cohorts(); mix(); econ(); signalPanel();
    }
    function fcColumns(el, o) {
      const bx = chartBox(el, o, o.W || 640, o.H || 230); const W = bx.W, H = bx.H; sizeWatch(el, { fn: fcColumns, o, w: bx.live ? W : 0 });
      const n = o.values.length; const mx = Math.max(...o.values.filter(isN), 1e-9); const yt = niceTicks(0, mx * 1.08, 4); const AX = 11.5;
      const m = { l: Math.max(34, Math.round(Math.max(...yt.map(v => textW(o.yfmt(v), AX))) + 12)), r: 8, t: 10, b: 26 }; const iw = W - m.l - m.r, ih = H - m.t - m.b; const bw = iw / n; const top = yt[yt.length - 1] || mx;
      const Y = v => m.t + ih - v / top * ih; const need = Math.max(...o.cats.map(c => textW(c, AX))) + 8; const every = Math.max(1, Math.ceil(need / bw)); let lastX = -Infinity;
      const svg = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'chart')}">`];
      yt.forEach(v => svg.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"></line><text class="ax" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(o.yfmt(v))}</text>`));
      o.values.forEach((v, i) => { if (!isN(v)) return; const x = m.l + i * bw; svg.push(`<rect class="fc-col" data-i="${i}" x="${(x + bw * 0.12).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${Math.max(1, bw * 0.76).toFixed(1)}" height="${Math.max(0, m.t + ih - Y(v)).toFixed(1)}" fill="${o.colors[i]}"></rect>`); if (o.label(i, every) && x + bw / 2 - lastX >= need) { lastX = x + bw / 2; svg.push(`<text class="ax" x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(o.cats[i])}</text>`); } });
      svg.push('</svg>'); el.innerHTML = svg.join('');
      const s = el.querySelector('svg'); s.addEventListener('mousemove', e => { const r = e.target.closest('rect.fc-col'); if (!r) { hideTip(); return; } showTip(o.tip(+r.dataset.i), e.clientX, e.clientY); }); s.addEventListener('mouseleave', hideTip);
    }
    function cohorts() {
      const ys = Object.keys(ST.nchs.marriage).map(Number).sort((a, b) => a - b); const now = BASE + 1; const peak = y => now - y >= 5 && now - y <= 9;
      fcColumns($r('#fcCoh'), { title: 'Texas marriages per 1,000 residents by year', cats: ys.map(String), label: (i, every) => ys[i] % (every > 3 ? 10 : 5) === 0, values: ys.map(y => ST.nchs.marriage[y]), colors: ys.map(y => peak(y) ? 'var(--hl)' : 'var(--s1)'), yfmt: v => N(v, 0), W: 640, H: 230,
        tip: i => { const y = ys[i]; const d = now - y; return `<b>${y} weddings</b><div class="row"><span>Marriages per 1,000 residents</span><span>${N(ST.nchs.marriage[y], 1)}</span></div><div class="row"><span>Years married in ${now}</span><span>${d}</span></div><div class="row"><span>Still intact in ${now} (divorce alone)</span><span>${P(HZ.survival(d), 0)}</span></div><div class="row"><span>Divorce chance in the next 12 months</span><span>${P(HZ.hazardNext12(d), 1)}</span></div>${peak(y) ? '<div class="small">In the five to nine year peak now</div>' : ''}`; } });
      const pk = ys.filter(peak); const pre = ys.filter(y => y >= 2010 && y <= 2016); const avg = a => mean(a.map(y => ST.nchs.marriage[y]));
      $r('#fcCohNote').innerHTML = `<span class="legendc" style="margin:0 0 6px"><span><i style="background:var(--s1)"></i>Marriages per 1,000 residents</span><span><i style="background:var(--hl)"></i>In years five to nine in ${now}</span></span>Weddings of ${pk[0]} to ${pk[pk.length - 1]} are in years five to nine in ${now}, where the hazard runs ${N(G0['dur_5-9'].haz, 1)} per 1,000 a year. Those cohorts married at ${N(avg(pk), 1)} per 1,000 residents against ${N(avg(pre), 1)} in 2010 to 2016: the dip of ${pk.includes(2019) ? '2019 (' + N(ST.nchs.marriage[2019], 1) + ') and ' : ''}the pandemic year is moving through the peak now. At the fitted hazard ${P(HZ.survival(now - 2016), 0)} of 2016 marriages are still intact and ${P(HZ.survival(now - 2000), 0)} of 2000 marriages. NCHS counts marriages where the license is recorded; the rates are per 1,000 residents, not per couple. Hover a bar for any year. ${gradeTag('B')}`;
    }
    function mix() {
      const fs = areaFips(); const h = k => sum(fs.map(f => (((CI[f].filings || {}).hist || {})[String(BASE)] || {})[k] || 0));
      const div = h('div'), divk = h('div_k'), sapcr = h('sapcr'), po = h('po'), mod = h('mod'), enf = h('enf'), adopt = h('adopt'), priv = h('priv'), ivd = h('ivd'), cps = h('cps'), tpr = h('tpr');
      const other = Math.max(0, priv - div - sapcr - po - mod - enf - adopt);
      $r('#fcMixSub').textContent = `New family cases filed in ${BASE}, ${areaTitle()}, by case type (Office of Court Administration).`;
      barChart($r('#fcMix'), { title: 'Family cases filed by type', W: 560, lw: 200, fmt: v => N(v), rows: [{ label: 'Divorce with children', value: divk, color: 'var(--s1)' }, { label: 'Divorce without children', value: div - divk, color: 'var(--s1)' }, { label: 'Custody and SAPCR', value: sapcr, color: 'var(--s5)' }, { label: 'Modification', value: mod, color: 'var(--s3)' }, { label: 'Enforcement', value: enf, color: 'var(--s4)' }, { label: 'Protective orders', value: po, color: 'var(--s2)' }, { label: 'Adoption', value: adopt, color: 'var(--s6)' }, { label: 'Other private family', value: other, color: 'var(--line-strong)' }, { label: 'Title IV-D support and paternity', value: ivd, color: 'var(--s7)' }, { label: 'CPS and termination', value: cps + tpr, color: 'var(--s8)' }] });
      const tot = priv + ivd + cps + tpr;
      barChart($r('#fcPay'), { title: 'Family cases by who brings them', W: 560, lw: 200, fmt: v => N(v) + ' · ' + P(v / Math.max(1, tot), 0), rows: [{ label: 'Private cases', value: priv, color: 'var(--s1)' }, { label: 'Attorney General (IV-D)', value: ivd, color: 'var(--s7)' }, { label: 'State (CPS)', value: cps + tpr, color: 'var(--s8)' }] });
      const A = ST.annual[String(BASE)] || {};
      $r('#fcMixNote').innerHTML = `Divorce with children is ${P(divk / Math.max(1, div), 0)} of divorces here; every one of them creates an order a parent can later modify or enforce, which is why those two lines are the long tail of a divorce practice. Private cases are the parties' own suits, with retained counsel or self represented; Title IV-D cases are run by the Attorney General under Title IV-D of the Social Security Act (Tex. Fam. Code ch. 231), and the parents may still hire their own lawyers; CPS cases are brought by the state. ${areaKind() === 'tx' && A.f_ivd_pat ? `Statewide in ${BASE} the IV-D docket split ${N(A.f_ivd_pat)} paternity, ${N(A.f_ivd_sup)} support, ${N(A.f_ivd_uifsa)} interstate (UIFSA) and ${N(A.f_pj_ivd)} post judgment filings; modifications split ${N(A.f_mod_cust)} custody and ${N(A.f_mod_other)} other.` : ''} IV-D counts are floors (module 20). ${gradeTag('A')}`;
    }
    function econ() {
      FC_FEE_LINES.forEach(k => { const cb = $r('#fcIn_' + k), inp = $r('#fcFee_' + k); cb.checked = !!st.inc[k]; if (document.activeElement !== inp) inp.value = feeOf(k); $r('#fcSrc_' + k).textContent = feeSrc(k); });
      const t = ti(); const A = agg(st.scn); const fs = areaFips();
      const rows = FC_FEE_LINES.filter(k => st.inc[k]).map(k => ({ label: LM(k).name, value: sum(fs.map(f => { const L = FCC[st.scn][f].lines; return (L[k][t] || 0) * feeOf(k) * cAdj(k) * incAdj(CI[f].acs.med_hh_inc); })), color: k.startsWith('div') ? 'var(--s1)' : k === 'mod' || k === 'enf' ? 'var(--s3)' : 'var(--s5)' }));
      $r('#fcPoolH').textContent = `Fee pool ${st.year} by line, ${areaTitle()}: ${fcM(sum(rows.map(r => r.value)))}`;
      if (rows.length) barChart($r('#fcPoolLines'), { title: 'Fee pool by line', W: 520, lw: 190, fmt: v => fcM(v), rows }); else $r('#fcPoolLines').innerHTML = '<p class="small">No line is in the pool. Tick a line to include it.</p>';
      $r('#fcEconNote').innerHTML = `The pool counts each expected matter once at its line's fee${st.contested > 0 && st.cmult !== 1 ? `, with ${N(st.contested, 0)}% of divorces billed at ${N(st.cmult, 1)}× as contested` : ''}${st.incAdj ? `, scaled by local median household income against the Texas median (${$$$(ST.acs.med_hh_inc)}) to the power ${N(st.incEl, 1)}` : ''}. The contested share defaults to 50% from module 06's note that about half of divorces without children are agreed (a practice estimate, grade D); a contested multiplier of 1 means the fee is already a blend. Title IV-D cases are excluded by default because the Attorney General brings them; CPS cases by default because in a termination or conservatorship suit the state brings, the court appoints counsel for an indigent parent who opposes it (§ 107.013). ${N(A.lines.adopt[t] + A.lines.cps[t], 0)} adoption and CPS matters have no ZIP allocation, so ZIP pools leave them out. The overlays of module 06 (premarital agreements, high asset, military and gray divorce) are inside these lines and are not added again. ${gradeTag('D')}`;
    }
    function signalPanel() {
      const fs = areaFips().map(f => CI[f]); const z = level() === 'zip';
      const m55 = sum(fs.map(c => (c.acs.mar_55_64 || 0) + (c.acs.mar_65p || 0))); const mil = sum(fs.map(c => (c.pools || {}).mil_active_w || 0)); const divk = sum(fs.map(c => CA[c.fips].obs.div_k || 0)); const rem = sum(fs.map(c => (c.risk.remarried || 0) * c.acs.married)) / Math.max(1, sum(fs.map(c => c.acs.married)));
      $r('#fcFacts').innerHTML = [[N(divk), `divorces with children filed in ${BASE}`], [N(m55), 'married adults aged 55 and over (ACS)'], [N(mil), 'active duty service members (PUMS, weighted), the military divorce pool of module 06'], [P(rem, 0), 'of married adults on a second or later marriage (PUMS)']].map(f => `<div class="fc-fact"><b>${f[0]}</b><span>${esc(f[1])}</span></div>`).join('');
      const top = UNITS.filter(u => isN(u.signal) && (u.married || 0) >= 200).sort((a, b) => b.signal - a.signal).slice(0, 8);
      $r('#fcTop').innerHTML = `<h4 class="fc-h4">Strongest signal${UNITS.length > 1 ? ' in ' + esc(areaTitle()) : ''}</h4><div class="tblbox"><div class="tblwrap"><table class="t"><caption class="vh">Strongest contested and complex signal</caption><thead><tr><th>${z ? 'ZIP' : 'County'}</th><th>Signal</th>${FC_SIG.map(s => `<th>${esc(s.l)}</th>`).join('')}</tr></thead><tbody>${top.map(u => `<tr data-id="${esc(u._id)}" tabindex="0" class="${u._id === st.sel ? 'sel' : ''}"><td class="name">${esc(z ? u._id + ' ' + (u.obj.city || '') : u.name)}</td><td>${N(u.signal, 0)}</td>${FC_SIG.map(s => `<td>${P(s.v(u.obj), s.k === 'mil' ? 1 : 0)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
      $$('#fcTop tr[data-id]', root).forEach(tr => { const go = () => { st.sel = tr.dataset.id; markSel($r('#fcMap'), st.sel); side(); if (tbl) { tbl.setSel(st.sel); } $r('#fcMap').scrollIntoView({ block: 'nearest' }); }; tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    }

    // ---------- the support check
    function calc() {
      const v = id => $r(id).value; const r = FC_SUPPORT.check({ orderDate: v('#fcOd'), kids: v('#fcKids'), other: v('#fcOther'), netThen: v('#fcThen'), netNow: v('#fcNow'), ordered: v('#fcOrd'), agreed: $r('#fcAgreed').checked, today: todayISO() });
      const out = $r('#fcCalcOut');
      if (r.status === 'input') { out.innerHTML = callout('', 'Check the inputs', esc(r.why)); return; }
      const g = (x, when) => x && x.ok ? `${$$$(x.amount)}${x.atLeast ? ' at least' : ''}` : 'not computed';
      const gs = (x, when) => x && x.ok ? `${x.pct}% of ${$$$(x.applied)}${x.above ? ` (net resources above the ${$$$(x.cap)} cap in effect ${fmtDate(x.capFrom)} onward)` : ` (cap ${$$$(x.cap)} from ${fmtDate(x.capFrom)})`}${x.low ? ', the low income schedule' : ''}` : esc((x && x.why) || '');
      const boxes = `<div class="fc-qbox">
        <div class="fc-qb"><div class="qt">${r.other > 0 ? 'Single household percentage, order date' : 'Guideline on the order date'}</div><div class="qv">${g(r.then)}</div><div class="qd">${gs(r.then)}</div></div>
        <div class="fc-qb"><div class="qt">${r.other > 0 ? 'Single household percentage, today' : 'Guideline today'}</div><div class="qv">${g(r.now)}</div><div class="qd">${gs(r.now)}</div></div>
        <div class="fc-qb"><div class="qt">Difference</div><div class="qv">${isN(r.diff) ? (r.diff >= 0 ? '+' : '−') + $$$(Math.abs(r.diff)) : 'not computed'}</div><div class="qd">${isN(r.diffPct) ? `${sgn(r.diffPct * 100, 1)} against ${r.current.source === 'entered' ? 'the amount entered' : 'the guideline on the order date'}; the rule asks for 20% or $100` : 'needs both amounts'}</div></div>
        <div class="fc-qb"><div class="qt">Three years</div><div class="qv">${fmtDate(r.threeYears)}</div><div class="qd">${N(r.years, 1)} years since the order${r.timeOk ? ', past the three year mark' : ', before the three year mark'}</div></div></div>`;
      const verdict = { met: ['', 'Reading: the three year test is met on these numbers', `It has been at least three years and the guideline amount today differs from the order by ${$$$(Math.abs(r.diff))} (${P(Math.abs(r.diffPct || 0), 0)}), so § 156.401(a)(2) allows a modification without proving a material and substantial change. A change reaches back only to the date the other parent is served or appears (§ 156.401(b)): the filing date matters.`],
        not_yet: ['judg', 'Reading: not yet on the three year route', `The guideline amount moved enough (${$$$(Math.abs(r.diff))}, ${P(Math.abs(r.diffPct || 0), 0)}), but the three year mark is ${fmtDate(r.threeYears)}. Before then the route is a material and substantial change in circumstances (§ 156.401(a)(1)), which a change in income can be.`],
        below: ['judg', 'Reading: leave it, on the three year route', `The guideline amount today differs from the order by ${$$$(Math.abs(r.diff))} (${P(Math.abs(r.diffPct || 0), 0)}), under both 20% and $100, so the § 156.401(a)(2) test is not met. A material and substantial change (§ 156.401(a)(1)) remains the other route.`],
        agreed: ['judg', 'Reading: the three year route does not apply', 'When the parties agreed to an amount that differs from the guidelines, the order can be modified only on a material and substantial change in circumstances (§ 156.401(a-1)). The amounts above are shown for the conversation, not as a test.'],
        not_computed: ['', 'Reading: not computed here', esc(r.why) + ' No verdict is printed for numbers the tool cannot source.'] }[r.status];
      const notes = [r.other > 0 ? 'The two amounts above use the single household percentages of § 154.125 and are shown only for the conversation: with other children to support, the multiple household percentage applies, which is lower and which this tool does not compute.' : '', r.now && r.now.atLeast ? 'Six or more children: the guideline is not less than the amount for five, so the amounts shown are floors.' : '', r.now && r.now.above ? 'Above the cap the court may add support only on proven needs of the child (§ 154.126).' : ''].filter(Boolean).join(' ');
      out.innerHTML = boxes + callout(verdict[0], verdict[1], `<p>${verdict[2]}${notes ? ' ' + notes : ''}</p><p class="small" style="margin-top:6px">Illustration, not legal advice. Net resources are defined by § 154.062 (the Attorney General's tax charts convert gross income to net). The cap is $11,700 a month from September 1, 2025 ($9,200 from September 1, 2019, $8,550 from September 1, 2013, $7,500 from September 1, 2007); the low income schedule applies below $1,000 a month from September 1, 2021. The guidelines are rebuttably presumed to be in the child's best interest and the court may deviate (§ 154.123). Medical and dental support are additional.</p>`);
    }

    // ---------- method, fit, judgment calls, caveats, sources
    function staticPanels() {
      const cv = HZ.curve(); const sh = HZ.shape();
      $r('#fcMeth').innerHTML = [
        `<b>Married stock by years married ${gradeTag('A')}/${gradeTag('B')}</b>. Married adults with a spouse present come from the ACS 2020 to 2024 tables for every county (A). Each county's split into four duration bands (under 5, 5 to 9, 10 to 19 and 20 or more years) comes from the Texas microdata by PUMA (B), and each band is split into single years by the statewide shape: the weighted count of each PUMS duration group spread by the sample counts of the single years inside it. The statewide stock this gives has a median of ${N(HZ.medianDuration(), 1)} years married and an average hazard of ${N(sum(sh.map((s, d) => s * HZ.hazard(d))), 2)} per 1,000, against the microdata's own ${N(G0.all.haz, 2)}.`,
        `<b>Hazard by years married ${gradeTag('B')}</b>. Divorces in the past year per 1,000 married adults at each completed year since the wedding, 0 to 40, from ${N(D.pums.n)} microdata records with replicate weight standard errors, smoothed by a three year centered average (the curve module 03 draws). Marriages of 41 years or more share one bucket at ${N(cv[41].h, 1)} per 1,000: the 30 plus group's pooled hazard less the published years 30 to 40.`,
        `<b>Aging ${gradeTag('C')}</b>. Each year every duration's married adults lose the hazard's share to divorce and the rest move up a year. New marriages enter at duration zero at each area's 2020 to 2024 rate (the share of married adults who married in the past year), growing with the county's population. Widowhood and net moves are one exit rate per county, solved so the married stock would grow with the county's population from 2020 to 2025 (Texas: ${P(sum(CTY.map(c => HZ.forecast(CA[c.fips], { years: 0, params: PRM() }).x * c.acs.married)) / sum(CTY.map(c => c.acs.married)), 2)} a year, married weighted), or stay at today's size when the stock is held. The ACS stock is treated as the stock entering ${BASE}.`,
        `<b>Capture calibration ${gradeTag('B')}</b>. The hazard counts adults; a filing is a marriage, so modeled divorces are the divorcing adults divided by two. Each county's ${BASE} divorce filings divided by its modeled divorces is its capture ratio (Texas ${N(capS, 2)}); the forecast is modeled divorces times that ratio, so ${BASE} reproduces the court count exactly. A county that reported no divorce filings in ${BASE} takes the statewide ratio.`,
        `<b>Scenarios ${gradeTag('C')}</b>. As fitted holds the 2020 to 2024 hazard. Secular decline lowers it each year at the NCHS trend you choose. Recession in ${HZ.PARAMS.start} applies a claims surge you state through the county panel's lag coefficients (module 20) to divorce, modification, enforcement, custody and protective order filings; the stock is not changed by it.`,
        `<b>The other lines ${gradeTag('C')}</b>. Divorces with children keep each county's ${BASE} share. Modification and enforcement scale with the orders involving children filed in the five years before (the court history starts in 2019, which sets the window). Custody, protective order, adoption, CPS and IV-D filings are held at ${BASE}, moved only by the recession scenario where the panel has a model.`,
        `<b>Fees ${gradeTag('D')}</b>. Expected matters times the fee per matter you state, by line, with the contested share and multiplier on divorces and the optional income scaling. ZIP pools use the ZIP's allocated filings (module 07) aged by its own mix.`,
        `<b>Band ${gradeTag('C')}</b>. An approximate 90% interval (±1.645 standard deviations) by the delta method: the change in each year's expected filings for a small change in the hazard at each duration, refitting the capture ratio each time, combined with that duration's standard error, durations taken as independent. It is the curve's sampling error and nothing else.`
      ].map(x => `<li>${x}</li>`).join('');
      // fit: duration groups, county deciles, capture in the largest counties
      const grp = [['dur_0-1', 0, 1, '0 to 1 years'], ['dur_2-4', 2, 4, '2 to 4'], ['dur_5-9', 5, 9, '5 to 9'], ['dur_10-14', 10, 14, '10 to 14'], ['dur_15-19', 15, 19, '15 to 19'], ['dur_20-29', 20, 29, '20 to 29'], ['dur_30+', 30, 41, '30 or more']];
      const fitRows = grp.map(([k, a, b, l]) => { let mw = 0, rw = 0, w = 0; for (let d = a; d <= b; d++) { const n = cv[d].n || 0; mw += cv[d].h * n; rw += cv[d].raw * n; w += n; } const o = G0[k]; return { l, obs: o.haz, se: o.se, raw: rw / w, mdl: mw / w, z: (mw / w - o.haz) / o.se }; });
      const byH = CTY.filter(c => isN(c.risk.haz_pred) && isN(c.risk.haz_obs)).sort((a, b) => a.risk.haz_pred - b.risk.haz_pred); const dec = [];
      for (let i = 0; i < 10; i++) { const part = byH.slice(Math.floor(i * byH.length / 10), Math.floor((i + 1) * byH.length / 10)); const w = sum(part.map(c => c.acs.married)); dec.push({ i: i + 1, n: part.length, obs: sum(part.map(c => c.risk.haz_obs * c.acs.married)) / w, pred: sum(part.map(c => c.risk.haz_pred * c.acs.married)) / w }); }
      const big = CTY.slice().sort((a, b) => b.acs.married - a.acs.married).slice(0, 10);
      $r('#fcFit').innerHTML = `<h4 class="fc-h4">Observed hazard by duration group against the model's curve</h4><div class="tblbox"><div class="tblwrap"><table class="t"><caption class="vh">Observed hazard by duration group against the model</caption><thead><tr><th>Years married</th><th>Observed</th><th>SE</th><th>Single years, raw</th><th>Model curve</th><th>Gap in SE</th></tr></thead><tbody>${fitRows.map(r => `<tr><td>${r.l}</td><td>${N(r.obs, 1)}</td><td>${N(r.se, 2)}</td><td>${N(r.raw, 1)}</td><td>${N(r.mdl, 1)}</td><td>${N(r.z, 1)}</td></tr>`).join('')}</tbody></table></div></div>
        <p class="small">Per 1,000 married adults a year. The group figures are weighted; the single years are averaged by sample count, which is why the raw column can differ slightly. The largest gap between the smoothed curve and a group is ${N(Math.max(...fitRows.map(r => Math.abs(r.z))), 1)} standard errors.</p>
        <h4 class="fc-h4">Counties by decile of the composition model: observed against predicted</h4><div class="tblbox"><div class="tblwrap"><table class="t"><caption class="vh">County deciles of observed against predicted hazard</caption><thead><tr><th>Decile</th><th>Counties</th><th>Observed (haz_obs)</th><th>Predicted (haz_pred)</th></tr></thead><tbody>${dec.map(r => `<tr><td>${r.i}</td><td>${r.n}</td><td>${N(r.obs, 1)}</td><td>${N(r.pred, 1)}</td></tr>`).join('')}</tbody></table></div></div>
        <p class="small">Counties sorted by the PUMS logistic model's prediction for their composition, ten groups, married weighted means per 1,000. Rising observed values across the deciles say the composition model ranks counties; small counties share PUMAs, so neighbors carry the same values.</p>
        <h4 class="fc-h4">Filed against modeled, ${BASE}, the ten largest counties</h4><div class="tblbox"><div class="tblwrap"><table class="t"><caption class="vh">Capture ratio in the largest counties</caption><thead><tr><th>County</th><th>Married</th><th>Modeled divorces</th><th>Filed</th><th>Ratio</th></tr></thead><tbody>${big.map(c => { const r = FCC.fit[c.fips]; return `<tr><td>${esc(c.name)}</td><td>${N(c.acs.married)}</td><td>${N(r.modeled[0], 0)}</td><td>${N(CA[c.fips].obs.div)}</td><td>${N(r.capture, 2)}</td></tr>`; }).join('')}</tbody></table></div></div>
        <p class="small">A ratio above one says the courts take more petitions than the survey counts divorces: a filing is not a decree (some are dismissed or nonsuited), a spouse who lives outside Texas is not in the Texas survey, and a divorce may be filed where either spouse lives (§ 6.301), so a court's county and the couple's homes need not match. The ratio varies by county and is applied county by county.</p>`;
      $r('#fcJudg').innerHTML = `<dl class="fc-dl">${[
        ['The stock enters in ' + BASE, `The ACS 2020 to 2024 married stock and its duration mix are treated as the stock entering ${BASE}. Aging it from the survey years would shift durations by about three years.`],
        ['Hazard held at 2020 to 2024', 'The as fitted scenario keeps the curve; the decline scenario is the stated alternative.'],
        ['Married stock grows with the population', 'Widowhood and net moves are not measured here, so one exit rate per county makes the married stock grow at the county\'s 2020 to 2025 population pace, kept for ten years. Fast growing counties compound, so the Texas stock grows faster than the state\'s own rate; hold the stock at today\'s size to remove growth.'],
        ['New marriages at the 2020 to 2024 rate', 'Switch the married stock to today\'s marriages only to see the stock without them (the Thermal Atlas convention for existing equipment); its exit rate is the one that would hold the stock at today\'s size.'],
        ['Two adults per marriage', 'Modeled divorces are divorcing adults divided by two. The capture ratio absorbs any difference.'],
        ['Statewide ratio where no filings were reported', 'A county with no divorce filings in ' + BASE + ' would otherwise forecast zero.'],
        ['Share with children held', `Each county keeps its ${BASE} share of divorces with children.`],
        ['A five year order window', 'Modification and enforcement follow the orders with children filed in the five years before; the court history starts in 2019.'],
        ['The recession', 'Claims double for twelve months by default; change the size, the length and the panel sample. The scenario moves filings, not the stock.'],
        ['Fees are yours', 'Firm fees when the firm profile has them, the model default otherwise; IV-D and CPS out of the pool by default; contested share 50%.'],
        ['The signal weights', 'Stated defaults; reweight above.']
      ].map(j => `<dt>${esc(j[0])}</dt><dd>${esc(j[1])}</dd>`).join('')}</dl>`;
      $r('#fcCav').innerHTML = `<dl class="fc-dl">${[
        ['Expectations, not predictions', 'An expected filing is an average over an area\'s married adults. It says nothing about any marriage, and outreach built on it is still bound by Rule 7.03 on solicitation.'],
        ['Courts count where the case is filed', 'Filings are counted by the county of the court, not the residence of the parties.'],
        ['The band is narrow on purpose', 'It carries the hazard curve\'s sampling error only. Year to year noise in the calibration count (about the square root of the count), the scenario inputs and the panel coefficients are not in it.'],
        ['ZIPs are allocations', 'ZIP filings are county filings spread by married adults times the modeled hazard (module 07); a ZIP forecast is that allocation aged by the ZIP\'s mix.'],
        ['NCHS counts', 'Texas divorce counts reached NCHS through clerk reports and undercount in 2019 to 2021 (module 03); the trend windows ending in 2023 include those years.'],
        ['The panel is an association', 'The lag coefficients come from monthly filings and claims in 43 large counties, 2019 to 2026, with fixed effects. They describe what followed claims changes in that period.'],
        ['Fees are not revenue', 'Some parties file without a lawyer and some fees are discounted or unpaid; the pool is the market at your stated fees, not a firm\'s take.']
      ].map(j => `<dt>${esc(j[0])}</dt><dd>${esc(j[1])}</dd>`).join('')}</dl>`;
      $r('#fcSrc').innerHTML = [
        `<li><b>Married stock.</b> American Community Survey 2020 to 2024 five year estimates, married adults with a spouse present, every county and ZCTA (A). <a href="https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/" target="_blank" rel="noopener">census.gov</a></li>`,
        `<li><b>Hazard by years married, duration mix, new marriages.</b> ACS 2020 to 2024 Public Use Microdata Sample for Texas, divorced in the past twelve months and married in the past twelve months, replicate weights (B). <a href="https://www2.census.gov/programs-surveys/acs/data/pums/2024/5-Year/" target="_blank" rel="noopener">census.gov PUMS</a></li>`,
        `<li><b>Court filings.</b> Texas Office of Court Administration, Court Activity Reporting and Directory System, family cases filed by type, ${esc(seriesSpan())} (A). <a href="https://card.txcourts.gov/" target="_blank" rel="noopener">card.txcourts.gov</a></li>`,
        `<li><b>Marriage and divorce rates.</b> NCHS National Vital Statistics System, state rates 1990 to 2023 (B). <a href="https://www.cdc.gov/nchs/nvss/marriage-divorce.htm" target="_blank" rel="noopener">cdc.gov/nchs</a></li>`,
        `<li><b>Population growth.</b> Census Bureau county estimates, 2020 and Vintage 2025 (A).</li>`,
        `<li><b>Claims and the panel model.</b> Texas Workforce Commission weekly initial claims by county and the Severance county panel of monthly filings (module 20) (B). <a href="https://texaslmi.com/Home/PopularDownloads" target="_blank" rel="noopener">texaslmi.com</a></li>`,
        `<li><b>Child support rules.</b> Tex. Fam. Code §§ 154.062, 154.123, 154.125, 154.126, 154.128, 154.129 and 156.401; the Attorney General's adjustment of the net resources cap to $11,700 effective September 1, 2025. <a href="https://statutes.capitol.texas.gov/Docs/FA/htm/FA.154.htm" target="_blank" rel="noopener">statutes.capitol.texas.gov</a></li>`,
        `<li><b>Fees.</b> The firm profile, or the Severance model defaults of module 06 (D).</li>`].join('');
    }

    // ---------- render
    function render(full) {
      if (full) computeCounties();
      syncControls(); scnNote(); layerSel(); UNITS = units(); if (st.sel && !UNITS.some(u => u._id === st.sel)) st.sel = null;
      kpis(); drawFcMap(); side(); drawTable(); charts(); save();
    }
    // the fee table is built once; render() only updates its values and sources (an empty fee box returns the line to its default)
    $r('#fcFees').innerHTML = FC_FEE_LINES.map(k => `<tr><td class="l"><span class="fc-ln">${esc(LM(k).name)}</span><span class="fc-src" id="fcSrc_${k}"></span></td><td><input type="checkbox" id="fcIn_${k}" aria-label="Include ${esc(LM(k).name)} in the fee pool"></td><td><input type="number" class="fc-fee" id="fcFee_${k}" min="0" step="250" inputmode="numeric" aria-label="Fee per matter, ${esc(LM(k).name)}"></td></tr>`).join('');
    FC_FEE_LINES.forEach(k => {
      const cb = $r('#fcIn_' + k), inp = $r('#fcFee_' + k);
      cb.onchange = () => { st.inc[k] = cb.checked; rerender(false); };
      inp.addEventListener('input', debounce(() => { const v = inp.value === '' ? null : +inp.value; if (v == null) delete st.fees[k]; else if (isFinite(v) && v >= 0) st.fees[k] = v; else return; rerender(false); }, 400));
      inp.addEventListener('blur', () => { if (inp.value === '') inp.value = feeOf(k); });
    });
    const rerender = full => render(full);

    // ---------- exports and handoffs
    function exportForecast() {
      // one gradient run per county and scenario: the county bands come from it directly, the area band from its sum
      const fs = areaFips(); const head = [], tail = []; const LN = ['div', 'div_k', 'div_nk', 'mod', 'enf', 'sapcr', 'po', 'fee_pool'];
      const poolBand = G => st.incAdj ? null : HZ.band(G.div.map((row, t) => row.map((_, d) => FC_FEE_LINES.reduce((acc, k) => acc + (st.inc[k] && G[k] ? G[k][t][d] * feeOf(k) * cAdj(k) : 0), 0))));
      const push = (out, name, label, L, G, pool) => { const B = {}; Object.keys(G).forEach(k => { B[k] = HZ.band(G[k]); }); const pb = poolBand(G);
        LN.forEach(line => YRS.forEach((y, t) => { const v = line === 'fee_pool' ? pool[t] : L[line][t]; const b = line === 'fee_pool' ? (pb ? pb[t] : null) : B[line] ? B[line][t] : null; out.push({ area: name, scenario: label, line, year: y, expected: v, lo: b ? v - b.lo : null, hi: b ? v + b.hi : null }); })); };
      Object.values(HZ.SCENARIOS).forEach(sc => {
        const G = {};
        fs.forEach(f => { const r = HZ.forecast(areaIn(f), { scenario: sc.key, params: PRM(), newMarriages: newOn(), capture: capS, kShare: kShareS, grad: true });
          Object.keys(r.grad).forEach(k => { if (!G[k]) G[k] = r.grad[k].map(row => row.slice()); else r.grad[k].forEach((row, t) => row.forEach((v, d) => { G[k][t][d] += v; })); });
          if (fs.length > 1) push(tail, CI[f].name + ' County', sc.label, r.lines, r.grad, YRS.map((y, t) => poolOf(r.lines, t, CI[f].acs.med_hh_inc))); });
        push(head, areaTitle(), sc.label, agg(sc.key, fs).lines, G, YRS.map((y, t) => areaPool(sc.key, t, fs)));
      });
      const rows = head.concat(tail);
      const note = [`Severance module 26, Filings Forecast. Compiled ${META.compiled}; court filings through ${META.oca_through}.`, `Expected filings ${BASE + 1} to ${BASE + 10}; ${BASE} is the observed calendar year count the model is calibrated to (capture ratio, filed against modeled, per county; Texas ${capS.toFixed(3)}).`, `Bands: approximate 90% interval from the PUMS duration curve's standard errors only (delta method); blank where a line has no hazard dependence or the fee pool is income scaled.`, `Married stock: ${STOCK_NOTE[st.stock]} Decline trend: NCHS Texas divorce rate ${st.from} to ${st.to}, ${(HZ.declineRate(st.from, st.to) * 100).toFixed(2)}% a year. Recession: claims +${st.surge}% for ${st.months} months from January ${HZ.PARAMS.start}, panel ${st.panel === 'post2022' ? 'since 2022' : 'full sample'}.`, `Lines: div divorce, div_k with children, div_nk without, mod modification, enf enforcement, sapcr custody, po protective orders, fee_pool dollars at the stated fees (${FC_FEE_LINES.filter(k => st.inc[k]).map(k => k + ' $' + feeOf(k)).join(', ')}; contested ${st.contested}% at ${st.cmult}x${st.incAdj ? '; income scaled, elasticity ' + st.incEl : ''}).`];
      const text = note.map(l => '# ' + l).join('\n') + '\n' + csv(rows, [{ l: 'area', k: 'area' }, { l: 'scenario', k: 'scenario' }, { l: 'line', k: 'line' }, { l: 'year', k: 'year' }, { l: 'expected', k: 'expected', d: 1 }, { l: 'band_low', k: 'lo', d: 1 }, { l: 'band_high', k: 'hi', d: 1 }]) + '\n';
      exportText(expName('forecast', areaGeo()), text);
    }
    function zipsOfArea() { const k = areaKind(); return k === 'tx' ? ZC : k === 'msa' ? ZC.filter(z => z.msa === areaId()) : ZC.filter(z => z.county === areaId()); }
    function exportZips() {
      const zs = zipsOfArea(); if (!zs.length) { toast('No ZIP allocations in ' + areaTitle() + ': ZIP filings exist inside the 26 metros only'); return; }
      const sg = sigZ(); const rows = zs.map(z => { const r = zipRes(st.scn, z); const o = { zip: z.zip, city: z.city, county: z.county_name, metro: z.msa && MSA[z.msa] ? MNAME(MSA[z.msa].title) : '', married: z.acs.married, mcfam: z.acs.mc_fam, inc: z.acs.med_hh_inc, div: r.lines.div[1], due: r.modsDue, signal: sg[z.zip] }; FY.forEach((y, i) => { o['p' + y] = poolOf(r.lines, i + 1, z.acs.med_hh_inc); }); o.hh = z.acs.mc_fam >= 100 ? o['p' + (BASE + 1)] / z.acs.mc_fam : null; return o; });
      const note = [`Severance module 26, Filings Forecast: fee pool by ZIP, ${areaTitle()}. Compiled ${META.compiled}; court filings through ${META.oca_through}.`, `Scenario: ${HZ.SCENARIOS[st.scn].label}. Married stock: ${STOCK_NOTE[st.stock]}`, `Fee pool = expected matters a year x fee per matter, lines in the pool: ${FC_FEE_LINES.filter(k => st.inc[k]).map(k => `${LM(k).name} $${feeOf(k)} (${feeSrc(k)})`).join('; ')}.`, `Excluded: ${FC_FEE_LINES.filter(k => !st.inc[k]).map(k => LM(k).name).join(', ') || 'none'}. Adoption and CPS have no ZIP allocation and are not in ZIP pools.`, `Contested share of divorces ${st.contested}% billed at ${st.cmult}x. Income adjustment: ${st.incAdj ? `fee x (ZIP median household income / Texas ${ST.acs.med_hh_inc}) ^ ${st.incEl}` : 'off'}.`, `ZIP filings are county filings allocated by married adults x modeled hazard (module 07), aged by the ZIP's own years married mix. Grades: counts B, fees D, signal C.`];
      const cols = [{ l: 'zip', k: 'zip' }, { l: 'city', k: 'city' }, { l: 'county', k: 'county' }, { l: 'metro', k: 'metro' }, { l: 'married_adults', k: 'married', d: 0 }, { l: 'married_couple_families', k: 'mcfam', d: 0 }, { l: 'median_household_income', k: 'inc', d: 0 }, { l: `expected_divorce_filings_${BASE + 1}`, k: 'div', d: 1 }].concat(FY.map(y => ({ l: `fee_pool_${y}`, k: 'p' + y, d: 0 }))).concat([{ l: `fee_pool_per_married_family_${BASE + 1}`, k: 'hh', d: 0 }, { l: 'modifications_due_2026_2030', k: 'due', d: 1 }, { l: 'contested_complex_signal', k: 'signal', d: 0 }]);
      exportText(expName('forecast_fee_pool_by_zip', areaGeo()), note.map(l => '# ' + l).join('\n') + '\n' + csv(rows, cols) + '\n');
    }
    function toDesk() {
      const t = ti(); let geo = null, zips = [];
      const sel = st.sel && ZI[st.sel] ? ZI[st.sel] : null;
      if (sel) { zips = [sel.zip]; geo = sel.msa && MSA[sel.msa] ? 'msa:' + sel.msa : 'cty:' + sel.county; }
      else {
        const zs = zipsOfArea().map(z => ({ z, p: poolOf(zipRes(st.scn, z).lines, t, z.acs.med_hh_inc) })).sort((a, b) => b.p - a.p);
        if (areaKind() === 'tx' && zs.length) { const m = zs[0].z.msa; zips = zs.filter(x => x.z.msa === m).slice(0, 25).map(x => x.z.zip); geo = 'msa:' + m; }
        else if (areaKind() === 'msa') { zips = zs.slice(0, 25).map(x => x.z.zip); geo = st.area; }
        else { zips = zs.slice(0, 25).map(x => x.z.zip); geo = st.area; }
      }
      const payload = { geo }; if (zips.length) payload.zips = zips; if (!zips.length && areaKind() === 'cty') payload.counties = [areaId()];
      goModule('desk', payload);
    }
    function toForge() {
      const t = ti(); let counties;
      if (st.sel && CI[st.sel]) counties = [st.sel]; else if (st.sel && ZI[st.sel]) counties = [ZI[st.sel].county];
      else counties = areaFips().slice().sort((a, b) => poolOf(FCC[st.scn][b].lines, t, CI[b].acs.med_hh_inc) - poolOf(FCC[st.scn][a].lines, t, CI[a].acs.med_hh_inc)).slice(0, 10);
      goModule('forge', { counties });
    }

    // ---------- wiring
    $r('#fcArea').onchange = e => { st.area = e.target.value; st.sel = null; rerender(false); };
    wireSeg($r('#fcScn'), v => { st.scn = v; rerender(false); });
    wireSeg($r('#fcNew'), v => { st.stock = v; rerender(true); });
    wireSeg($r('#fcLevel'), v => { if (v === 'zip' && !zipOk()) return; st.level = v; st.sel = null; rerender(false); });
    $r('#fcLayer').onchange = e => { st.layer = e.target.value; drawFcMap(); save(); };
    $r('#fcYear').onchange = e => { st.year = +e.target.value; rerender(false); };
    $r('#fcTrend').onchange = e => { const [a, b] = e.target.value.split('-').map(Number); st.from = a; st.to = b; rerender(true); };
    $r('#fcSurge').addEventListener('input', debounce(e => { const v = +e.target.value; if (e.target.value === '' || !isFinite(v)) return; st.surge = clamp(v, 0, 500); rerender(true); }, 400));
    $r('#fcMonths').addEventListener('input', debounce(e => { const v = +e.target.value; if (e.target.value === '' || !isFinite(v)) return; st.months = clamp(Math.round(v), 1, 24); rerender(true); }, 400));
    $r('#fcPanel').onchange = e => { st.panel = e.target.value; rerender(true); };
    $r('#fcCont').addEventListener('input', debounce(e => { const v = +e.target.value; if (e.target.value === '' || !isFinite(v)) return; st.contested = clamp(v, 0, 100); rerender(false); }, 400));
    $r('#fcCmult').addEventListener('input', debounce(e => { const v = +e.target.value; if (e.target.value === '' || !isFinite(v)) return; st.cmult = clamp(v, 0.5, 5); rerender(false); }, 400));
    $r('#fcInc').onchange = e => { st.incAdj = e.target.checked; rerender(false); };
    $r('#fcIncEl').addEventListener('input', debounce(e => { const v = +e.target.value; if (e.target.value === '' || !isFinite(v)) return; st.incEl = clamp(v, 0, 2); rerender(false); }, 400));
    FC_SIG.forEach(s => $r('#fcW_' + s.k).addEventListener('input', debounce(e => { const v = +e.target.value; if (e.target.value === '' || !isFinite(v)) return; st.w[s.k] = clamp(v, 0, 100); SIGC = null; SIGZ = null; rerender(false); }, 400)));
    $$('#fcCalcIn input', root).forEach(i => i.addEventListener('input', calc)); $r('#fcAgreed').addEventListener('change', calc);
    $r('#fcCsv').onclick = exportForecast; $r('#fcZipCsv').onclick = exportZips; $r('#fcDesk').onclick = toDesk; $r('#fcForge').onclick = toForge;
    $r('#fcReset').onclick = () => { const keep = { area: st.area, scn: st.scn, layer: st.layer, year: st.year, level: st.level }; st = Object.assign(clean(keep), { sel: st.sel }); SIGC = null; SIGZ = null; rerender(true); toast('Assumptions reset to the defaults'); };
    let dirty = false; BUS.on('firm', () => { if (!root.isConnected || !FCC) return; if (root.hidden) dirty = true; else rerender(false); });
    this.receive = p => {
      if (!p || typeof p !== 'object') return; let ch = false;
      if (p.zip && ZI[p.zip]) { const z = ZI[p.zip]; st.area = z.msa && MSA[z.msa] ? 'msa:' + z.msa : 'cty:' + z.county; st.level = 'zip'; st.sel = z.zip; ch = true; }
      else if (p.county && CI[p.county]) { st.area = 'cty:' + p.county; st.sel = null; ch = true; }
      else if ((p.metro || p.msa) && MSA[p.metro || p.msa]) { st.area = 'msa:' + (p.metro || p.msa); st.sel = null; ch = true; }
      if (p.scenario && HZ.SCENARIOS[p.scenario]) { st.scn = p.scenario; ch = true; }
      if (ch) rerender(false);
    };
    this.onShow = () => { if (dirty && FCC) { dirty = false; rerender(false); } };
    computeCounties(); staticPanels(); render(false); calc();
  }
});
