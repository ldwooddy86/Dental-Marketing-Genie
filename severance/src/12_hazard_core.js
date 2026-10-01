/* SEV_HAZ: the Texas divorce hazard by years married and the stock model that ages married Texans through it.
   Built from Severance's own data only: D.pums.curve (divorces in the past year per 1,000 married adults by completed years since the
   wedding, ACS 2020 to 2024 PUMS, with replicate weight standard errors), D.pums.groups (the same measure by group, with weights),
   D.state.nchs (NCHS Texas marriage and divorce rates) and D.panel (county panel of monthly filings on unemployment claims).
   Module 26 (Filings Forecast) uses it; any module may read it.

   Units. A hazard is divorces in the past year per 1,000 married adults at that duration, the PUMS measure. Both spouses of a marriage
   sit in the denominator and both report the divorce, so a marriage's chance of ending in divorce within a year is the same number
   divided by 1,000, and the marriages ending in a year are the married adults times the hazard, divided by 1,000 and by 2.
   Durations are completed years since the wedding, 0 to 40, plus one open bucket (index 41) for 41 years or more.

   API (every function is pure; numbers come from the data or from the parameters passed in)
     SEV_HAZ.MAXD                       41, the open bucket
     SEV_HAZ.curve()                    [{dur, h, se, raw, rawSe, n}]: h and se after the stated smoothing; raw as published
     SEV_HAZ.hazard(d, mult)            hazard per 1,000 at duration d (mult scales it; default 1)
     SEV_HAZ.hazardNext12(d, mult)      chance (a fraction) that a marriage at d completed years ends in divorce in the next 12 months
     SEV_HAZ.survival(d, from)          chance that a marriage at `from` years (default 0) is not ended by divorce by d years
     SEV_HAZ.medianDuration()           median years married of today's married stock, interpolated inside the single year
     SEV_HAZ.medianToDivorce()          years at which half of a wedding cohort would have divorced at these hazards (other exits
                                        ignored), or null within 120 years
     SEV_HAZ.shape()                    statewide share of married adults by duration (42 entries, sums to 1)
     SEV_HAZ.stock(married, buckets)    married adults by duration for an area: buckets {dur_lt5, dur_5_9, dur_10_19, dur_20p} (a
                                        county's or ZIP's PUMS shares), split into single years by the statewide shape; no buckets
                                        gives the statewide shape
     SEV_HAZ.expected(stock, years, scenario, opts)
                                        ages a stock: [{year, married, persons, divorces}] for the base year and each year after;
                                        persons = married adults reporting a divorce, divorces = marriages ending (persons / 2)
     SEV_HAZ.SCENARIOS                  {fit, decline, recession}: {key, label, short, grade, hazMult(year, p), fileMult(line, year, p), desc(p)}
     SEV_HAZ.PARAMS                     the default scenario parameters (base year, trend window, claims surge)
     SEV_HAZ.declineRate(from, to)      log linear annual change of the NCHS Texas divorce rate over the window (a fraction)
     SEV_HAZ.recession(line, p)         {year: multiplier} on a line's filings from a claims surge through the panel lag coefficients
     SEV_HAZ.forecast(area, opts)       the calibrated forecast of every line for one area (see the comment on the function)
     SEV_HAZ.band(grad, z)              [{lo, hi}] half widths from a summed gradient (the delta method on the curve's standard errors)
     SEV_HAZ.make(pums, nchs, panel, o) builds another instance from other data (tests) */
'use strict';
const SEV_HAZ = (function () {
  const LINES_OBS = ['div', 'div_k', 'div_nk', 'sapcr', 'po', 'mod', 'enf', 'adopt', 'cps', 'ivd'];
  // which panel model moves which line under a claims surge (D.panel keys); lines without one are held
  const PANEL_OF = { div: 'ldiv', div_k: 'ldiv', div_nk: 'ldiv', mod: 'lmod', enf: 'lenf', po: 'lpo', sapcr: 'lsapcr', priv: 'lpriv' };
  const PARAMS = { base: 2025, from: 2000, to: 2019, surge: 1, start: 2027, months: 12, panel: 'full', window: 5 };
  const sumA = a => a.reduce((x, y) => x + (y || 0), 0);
  const fin = v => typeof v === 'number' && isFinite(v);

  function make(pums, nchs, panel, o) {
    o = Object.assign({ smooth: 3 }, o || {});
    const raw = (pums && pums.curve ? pums.curve : []).slice().sort((a, b) => a.dur - b.dur);
    const G = (pums && pums.groups) || {};
    const MAXD = 41;
    // single years 0 to 40 from the curve; a duration missing from the curve takes the nearest published one
    const rh = [], rse = [], rn = [];
    for (let d = 0; d <= 40; d++) { const c = raw.find(x => x.dur === d) || raw.reduce((b, x) => (!b || Math.abs(x.dur - d) < Math.abs(b.dur - d) ? x : b), null) || { haz_per_1000: 0, se: 0, n: 0 }; rh.push(+c.haz_per_1000 || 0); rse.push(+c.se || 0); rn.push(+c.n || 0); }
    // the stated smoothing: a centered moving average of `smooth` single years (module 03 draws the same three year average);
    // the standard error of a mean of k independent estimates is the root of the summed variances over k
    const k = Math.max(1, Math.round(o.smooth)); const half = Math.floor(k / 2);
    const H = [], SE = [];
    for (let d = 0; d <= 40; d++) { const w = []; for (let j = d - half; j <= d + half; j++) if (j >= 0 && j <= 40) w.push(j); H.push(sumA(w.map(j => rh[j])) / w.length); SE.push(Math.sqrt(sumA(w.map(j => rse[j] * rse[j]))) / w.length); }
    // the open bucket, 41 years or more: the 30 plus group's pooled hazard less the published single years 30 to 40, weighted by
    // sample counts; its standard error scales the group's by the square root of the sample share
    const g30 = G['dur_30+'];
    const n3040 = sumA(rn.slice(30, 41));
    let h41 = g30 ? g30.haz : rh[40], se41 = g30 ? g30.se : rse[40];
    if (g30 && g30.n > n3040 + 100) { const v = (g30.n * g30.haz - sumA(rn.slice(30, 41).map((x, i) => x * rh[30 + i]))) / (g30.n - n3040); if (fin(v) && v > 0) { h41 = v; se41 = g30.se * Math.sqrt(g30.n / (g30.n - n3040)); } }
    H.push(h41); SE.push(se41);
    // statewide shape of the married stock: each PUMS duration group's weighted count, split into single years by the sample counts
    // of the curve (the weights by single year are not published); the open bucket takes what the 30 plus group has beyond 40
    const GROUPS = [['dur_0-1', 0, 1], ['dur_2-4', 2, 4], ['dur_5-9', 5, 9], ['dur_10-14', 10, 14], ['dur_15-19', 15, 19], ['dur_20-29', 20, 29], ['dur_30+', 30, 41]];
    const sh = new Array(MAXD + 1).fill(0);
    if (GROUPS.every(g => G[g[0]])) {
      GROUPS.forEach(([key, a, b]) => { const ns = []; for (let d = a; d <= b; d++) ns.push(d <= 40 ? rn[d] : Math.max(0, (g30 ? g30.n : 0) - n3040)); const t = sumA(ns) || 1; ns.forEach((x, i) => { sh[a + i] += G[key].w * x / t; }); });
    } else { for (let d = 0; d <= 40; d++) sh[d] = rn[d]; }
    const tot = sumA(sh) || 1; const SHAPE = sh.map(x => x / tot);
    const BUCKETS = [['dur_lt5', 0, 4], ['dur_5_9', 5, 9], ['dur_10_19', 10, 19], ['dur_20p', 20, 41]];

    const hazard = (d, mult) => H[Math.max(0, Math.min(MAXD, Math.floor(d)))] * (fin(mult) ? mult : 1);
    const hazardNext12 = (d, mult) => Math.min(1, hazard(d, mult) / 1000);
    function survival(d, from) { from = Math.max(0, Math.floor(from || 0)); let s = 1; for (let j = from; j < d; j++) s *= 1 - hazard(j) / 1000; return s; }
    function medianDuration() { let c = 0; for (let d = 0; d <= MAXD; d++) { if (c + SHAPE[d] >= 0.5) return d + (0.5 - c) / (SHAPE[d] || 1); c += SHAPE[d]; } return null; }
    function medianToDivorce() { let s = 1; for (let d = 0; d < 120; d++) { const s2 = s * (1 - hazard(d) / 1000); if (s2 <= 0.5) return d + (s - 0.5) / (s - s2); s = s2; } return null; }
    function stock(married, b) {
      const out = new Array(MAXD + 1).fill(0); if (!fin(married) || married <= 0) return out;
      if (!b || !BUCKETS.every(x => fin(b[x[0]]))) { SHAPE.forEach((s, d) => { out[d] = married * s; }); return out; }
      const bt = sumA(BUCKETS.map(x => Math.max(0, b[x[0]]))) || 1;
      BUCKETS.forEach(([key, a, z]) => { const inb = SHAPE.slice(a, z + 1); const t = sumA(inb) || 1; inb.forEach((s, i) => { out[a + i] = married * Math.max(0, b[key]) / bt * s / t; }); });
      return out;
    }

    // ---- scenarios
    const ny = nchs && nchs.divorce ? Object.keys(nchs.divorce).map(Number).filter(y => fin(nchs.divorce[y]) && nchs.divorce[y] > 0).sort((a, b) => a - b) : [];
    function declineRate(from, to) {
      const ys = ny.filter(y => y >= from && y <= to); if (ys.length < 3) return 0;
      const Y = ys.map(y => Math.log(nchs.divorce[y])); const mx = sumA(ys) / ys.length, my = sumA(Y) / Y.length;
      const b = sumA(ys.map((x, i) => (x - mx) * (Y[i] - my))) / (sumA(ys.map(x => (x - mx) * (x - mx))) || 1);
      return Math.exp(b) - 1;
    }
    function panelModel(line, variant) { const k = PANEL_OF[line]; if (!k || !panel) return null; return (variant === 'post2022' && panel[k + '|claims_0_12|post2022']) || panel[k + '|claims_0_12'] || null; }
    // the claims surge: log claims up by ln(1 + surge) for `months` months from January of `start`; the effect on log filings in month m
    // is the sum of the lag coefficients whose lag still falls inside the surge; a year's multiplier is the mean of exp(effect) over
    // its twelve months. Years outside the surge and its lags read 1.
    const REC_MEMO = new Map();
    function recession(line, p) {
      p = Object.assign({}, PARAMS, p || {}); const key = [line, p.panel, p.surge, p.start, p.months].join('|'); if (REC_MEMO.has(key)) return Object.assign({}, REC_MEMO.get(key));
      const out = {}; const mdl = panelModel(line, p.panel); if (!mdl || !(p.surge > -1)) { REC_MEMO.set(key, out); return {}; }
      const lags = Object.entries(mdl.coefs || {}).map(([name, c]) => { const m = name.match(/_l(\d+)$/); return { lag: m ? +m[1] : 0, b: +c.coef || 0 }; });
      const dl = Math.log(1 + p.surge); const months = Math.max(1, Math.round(p.months)); const maxLag = Math.max(0, ...lags.map(l => l.lag));
      const span = months + maxLag; const nYears = Math.ceil(span / 12);
      for (let yi = 0; yi < nYears; yi++) { let s = 0; for (let mm = 0; mm < 12; mm++) { const m = yi * 12 + mm; let e = 0; lags.forEach(l => { const since = m - l.lag; if (since >= 0 && since < months) e += l.b * dl; }); s += Math.exp(e); } out[p.start + yi] = s / 12; }
      if (REC_MEMO.size > 200) REC_MEMO.clear(); REC_MEMO.set(key, out); return Object.assign({}, out);
    }
    const SCENARIOS = {
      fit: { key: 'fit', label: 'As fitted, 2020 to 2024', short: 'As fitted', grade: 'B', hazMult: () => 1, fileMult: () => 1,
        desc: () => 'The hazard by years married stays at its 2020 to 2024 level. Filings move only because the married stock ages, new marriages arrive and the stock grows with the population.' },
      decline: { key: 'decline', label: 'Secular decline continues', short: 'Decline', grade: 'C',
        hazMult: (y, p) => { p = Object.assign({}, PARAMS, p || {}); return Math.pow(1 + declineRate(p.from, p.to), Math.max(0, y - p.base)); }, fileMult: () => 1,
        desc: p => { p = Object.assign({}, PARAMS, p || {}); const r = declineRate(p.from, p.to); return `The hazard falls ${Math.abs(r * 100).toFixed(1)}% a year, the log linear trend of the NCHS Texas divorce rate per 1,000 residents from ${p.from} to ${p.to}. With the married stock growing with the population, divorces per resident then follow that trend.`; } },
      recession: { key: 'recession', label: `Recession in ${PARAMS.start}`, short: 'Recession', grade: 'C', hazMult: () => 1,
        fileMult: (line, y, p) => { const m = recession(line, p)[y]; return fin(m) ? m : 1; },
        desc: p => { p = Object.assign({}, PARAMS, p || {}); return `Unemployment claims run ${Math.round(p.surge * 100)}% above normal for ${Math.round(p.months)} months from January ${p.start}. The county panel's lag coefficients (lags 0, 3, 6, 9 and 12 months${p.panel === 'post2022' ? ', fitted on 2022 onward' : ', full sample'}) carry the surge into divorce, modification, enforcement, custody and protective order filings.`; } }
    };

    /* expected(stock, years, scenario, opts): age a stock of married adults by duration one year at a time from the base year.
       opts: {base (year of the stock, default 2025), params, inflow (married adults entering at duration 0 in the base year, default 0),
       growth (annual growth of the inflow), exits (other exits a year, a fraction: widowhood and net moves), H (hazards per 1,000 by
       duration, to override the curve)}. The scenario's hazard multiplier applies from the year after the base. */
    function expected(stk, years, scenario, opts) {
      opts = opts || {}; const p = Object.assign({}, PARAMS, opts.params || {}); const base = fin(opts.base) ? opts.base : p.base;
      const sc = typeof scenario === 'string' ? (SCENARIOS[scenario] || SCENARIOS.fit) : (scenario || SCENARIOS.fit);
      const HH = opts.H || H; const x = fin(opts.exits) ? opts.exits : 0; const inflow = fin(opts.inflow) ? opts.inflow : 0; const g = fin(opts.growth) ? opts.growth : 0;
      let S = stk.slice(0, MAXD + 1); while (S.length < MAXD + 1) S.push(0);
      const out = [];
      for (let t = 0; t <= years; t++) {
        const y = base + t; const m = t === 0 ? 1 : sc.hazMult(y, p);
        let persons = 0; const N = new Array(MAXD + 1).fill(0);
        for (let d = 0; d <= MAXD; d++) { const q = Math.min(1, HH[d] * m / 1000); persons += S[d] * q; N[Math.min(MAXD, d + 1)] += S[d] * (1 - q) * (1 - x); }
        out.push({ year: y, married: sumA(S), persons, divorces: persons / 2 });
        N[0] += inflow * Math.pow(1 + g, t + 1); S = N;
      }
      return out;
    }

    /* forecast(area, opts): every line for one area, calibrated to its observed base year filings.
       area: {married, buckets (PUMS duration shares) or stock (by duration), marLy (share of married adults who married in the past
         year), growth (annual population growth), obs: {div, div_k, sapcr, po, mod, enf, adopt, cps, ivd} filed in the base year,
         hist: {year: {div_k, sapcr}} observed new orders involving children (years before the base)}
       opts: {scenario, params, newMarriages (default true), years (default 10), capture (a fallback ratio when the area filed no
         divorces), grad (true: also return the gradient of each line by duration, for the band), H (hazard override)}
       Returns {years, capture, captureSource, x, g, modeled, lines: {line: [value by year]}, K: {year: orders}, modsDue, grad}.
       Year index 0 is the base year (its divorce line equals the observed count); 1 to `years` are the forecast. */
    function forecast(area, opts) {
      opts = opts || {}; const p = Object.assign({}, PARAMS, opts.params || {}); const base = p.base; const years = fin(opts.years) ? opts.years : 10;
      const sc = typeof opts.scenario === 'string' ? (SCENARIOS[opts.scenario] || SCENARIOS.fit) : (opts.scenario || SCENARIOS.fit);
      const HH = opts.H || H; const obs = area.obs || {};
      const stk = area.stock || stock(area.married, area.buckets);
      const S0 = sumA(stk); const g = Math.max(-0.05, Math.min(0.08, fin(area.growth) ? area.growth : 0));
      const inflow0 = (fin(area.marLy) ? area.marLy : 0) * S0;
      // other exits (widowhood and net moves), solved so the stock would grow with the population at the fitted hazard:
      // (S0 - divorcing adults)(1 - x) + inflow = S0 (1 + g)
      const divp0 = sumA(stk.map((v, d) => v * Math.min(1, HH[d] / 1000)));
      let x = S0 - divp0 > 0 ? 1 - (S0 * (1 + g) - inflow0 * (1 + g)) / (S0 - divp0) : 0; x = Math.max(-0.1, Math.min(0.2, fin(x) ? x : 0));
      const run = (Hh, scen) => expected(stk, years, scen, { base, params: p, inflow: opts.newMarriages === false ? 0 : inflow0, growth: g, exits: x, H: Hh });
      const fitPath = run(HH, SCENARIOS.fit); const m0 = fitPath[0].divorces;
      const obsDiv = fin(obs.div) ? obs.div : 0;
      let capture, captureSource; if (obsDiv > 0 && m0 > 0) { capture = obsDiv / m0; captureSource = 'area'; } else { capture = fin(opts.capture) ? opts.capture : 0; captureSource = 'fallback'; }
      const hist = area.hist || {}; const kShare = obsDiv > 0 && fin(obs.div_k) ? obs.div_k / obsDiv : (fin(opts.kShare) ? opts.kShare : 0);
      const lines = function (path, cap) {
        const Y = path.map(r => r.year); const L = {};
        L.div = path.map((r, t) => t === 0 ? obsDiv : r.divorces * cap * sc.fileMult('div', r.year, p));
        L.div_k = L.div.map(v => v * kShare); L.div_nk = L.div.map((v, t) => v - L.div_k[t]);
        ['sapcr', 'po', 'adopt', 'cps', 'ivd'].forEach(k => { const o = fin(obs[k]) ? obs[k] : 0; L[k] = Y.map((y, t) => t === 0 ? o : o * sc.fileMult(k, y, p)); });
        // new orders involving children: observed before the base, expected from the base on (the base year is observed)
        const K = {}; Object.keys(hist).forEach(y => { if (+y < base) K[y] = (fin(hist[y].div_k) ? hist[y].div_k : 0) + (fin(hist[y].sapcr) ? hist[y].sapcr : 0); });
        Y.forEach((y, t) => { K[y] = L.div_k[t] + L.sapcr[t]; });
        const win = Math.max(1, Math.round(p.window)); const pipe = y => { let s = 0; for (let j = y - win; j < y; j++) s += K[j] || 0; return s; };
        const P0 = pipe(base);
        ['mod', 'enf'].forEach(k => { const o = fin(obs[k]) ? obs[k] : 0; L[k] = Y.map((y, t) => t === 0 ? o : o * (P0 > 0 ? pipe(y) / P0 : 1) * sc.fileMult(k, y, p)); });
        let due = 0; for (let y = 2023; y <= 2027; y++) due += K[y] || 0;   // orders reaching three years in 2026 to 2030
        return { L, K, due };
      };
      const path = run(HH, sc); const c = lines(path, capture);
      const res = { years: path.map(r => r.year), capture, captureSource, x, g, inflow: inflow0, kShare, modeled: path.map(r => r.divorces), married: path.map(r => r.married), lines: c.L, K: c.K, modsDue: c.due };
      if (opts.grad) {
        // the gradient of every line by the hazard at each duration, numerically (the capture is refitted each time, as the calibration
        // would be); the band then combines it with the curve's standard errors
        const grad = {}; Object.keys(c.L).forEach(k => { grad[k] = c.L[k].map(() => new Array(MAXD + 1).fill(0)); }); grad.modsDue = [new Array(MAXD + 1).fill(0)];
        for (let d = 0; d <= MAXD; d++) {
          const eps = Math.max(1e-3, HH[d] * 1e-3); const Hp = HH.slice(); Hp[d] += eps;
          const fp = run(Hp, SCENARIOS.fit)[0].divorces; const capP = captureSource === 'area' && fp > 0 ? obsDiv / fp : capture;
          const cp = lines(run(Hp, sc), capP);
          Object.keys(c.L).forEach(k => { c.L[k].forEach((v, t) => { grad[k][t][d] = (cp.L[k][t] - v) / eps; }); });
          grad.modsDue[0][d] = (cp.due - c.due) / eps;
        }
        res.grad = grad;
      }
      return res;
    }
    // band(grad, z): grad is [year][duration] (summed across areas if needed); returns [{lo, hi}] as half widths below and above
    function band(grad, z) { z = fin(z) ? z : 1.645; return grad.map(row => { let v = 0; row.forEach((gd, d) => { v += (gd * SE[d]) * (gd * SE[d]); }); const h = z * Math.sqrt(v); return { lo: h, hi: h }; }); }

    return {
      MAXD, LINES: LINES_OBS, PARAMS: Object.assign({}, PARAMS), SCENARIOS, PANEL_OF,
      curve: () => H.map((h, d) => ({ dur: d, h, se: SE[d], raw: d <= 40 ? rh[d] : h41, rawSe: d <= 40 ? rse[d] : se41, n: d <= 40 ? rn[d] : Math.max(0, (g30 ? g30.n : 0) - n3040) })),
      hazard, hazardNext12, survival, medianDuration, medianToDivorce, shape: () => SHAPE.slice(), stock, expected, declineRate, recession, forecast, band,
      se: () => SE.slice(), smooth: k, panelModel, make
    };
  }
  const data = typeof D !== 'undefined' && D ? D : {};
  return make(data.pums, data.state && data.state.nchs, data.panel);
})();
