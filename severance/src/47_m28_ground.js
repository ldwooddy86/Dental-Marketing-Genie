'use strict';
/* Module 28: Ground Truth. The family law counterpart of the Thermal Atlas module 06 (Ground Truth) and the data access half of its
   module 11: what someone else counted (court filings, the Census, the labor market, child protection, law offices) kept apart from
   what Severance computed (the hazard model, the indexes, the ZIP allocations, paid efficiency), on the statewide county map and on
   every metro's ZIP map; county detail split into observed and modeled rows with source, vintage, grade and survey error; cities rolled
   up from ZIPs; the urban to exurban gradient; legal deserts and hot spots; every headline figure by area; the filing record; survey
   precision; the Texas family law constants; and the data inventory with its legal gates.
   GROUND holds the logic that carries numbers (pure functions over the data, tested in tests/ground.test.mjs). */
const GROUND = (() => {
  const KM_MI = 0.621371;
  const rate = (n, d, per) => isN(n) && isN(d) && d > 0 ? n / d * per : null;
  /* ---- geometry: every metro map is projected on its own, so a ZIP center goes back to degrees through its metro's bounds (the
     shapes are simplified, so the result is good to about 2 km); county centers use the state map the same way */
  function zipLL(z) { const M = z && GEO.metros[z.msa]; if (!M || !z.cent) return null; const b = M.bounds; return [b[0] + z.cent[0] / M.W * (b[2] - b[0]), b[3] - z.cent[1] / M.H * (b[3] - b[1])]; }
  function ctyLL(f) { const S = GEO.state; const c = S.cent[f]; if (!c) return null; const b = S.bounds; return [b[0] + c[0] / S.W * (b[2] - b[0]), b[3] - c[1] / S.H * (b[3] - b[1])]; }
  function km(a, b) { if (!a || !b) return null; const r = Math.PI / 180; const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2; return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h))); }
  const dist = k => isN(k) ? `${N(k, 1)} km (${N(k * KM_MI, 1)} mi)` : NA;
  /* ---- weighted mean: rows where the value is a number count; the weight is married adults unless given */
  function wmean(rows, v, w) { let a = 0, b = 0; rows.forEach(r => { const x = v(r), y = w(r); if (isN(x) && isN(y) && y > 0) { a += x * y; b += y; } }); return b > 0 ? a / b : null; }
  /* ---- the Census married count: SE = CV x estimate, the 90% margin = 1.645 SE; county grades use the same CV cuts */
  const acsSE = (est, cv) => isN(est) && isN(cv) ? est * cv : null;
  const moe90 = (est, cv) => { const s = acsSE(est, cv); return isN(s) ? 1.645 * s : null; };
  const cvGrade = cv => !isN(cv) ? null : cv < 0.05 ? 'A' : cv < 0.10 ? 'B' : cv < 0.20 ? 'C' : 'D';
  const stepDown = g => ({ A: 'B', B: 'C', C: 'D', D: 'D' })[g] || null;
  /* the rule behind the county grades (module 20): A 500 or more divorce filings, a monthly series and a married CV under 5%; B 100 or
     more and under 10%; C 25 or more and under 20%; D the rest */
  function gradeRule(c) { const n = c.filings.ttm.div || 0, cv = c.acs.married_cv; if (n >= 500 && c.filings.series && cv < 0.05) return 'A'; if (n >= 100 && cv < 0.10) return 'B'; if (n >= 25 && cv < 0.20) return 'C'; return 'D'; }
  /* ---- modeled divorces and the court's capture of them */
  const modeled = o => o && o.risk && isN(o.risk.haz_pred) && isN(o.acs.married) ? o.risk.haz_pred * o.acs.married / 1000 : null;
  const capture = c => { const m = modeled(c); return isN(m) && m > 0 ? (c.filings.ttm.div || 0) / m : null; };
  /* ---- cities: ZIPs grouped by their postal city inside a metro; sums of married adults, allocated filings and law offices, the ZIP
     index and hazard weighted by married adults; a city that spans counties sits in the county holding most of its married adults */
  function cityRollup(zs) {
    const by = new Map();
    (zs || []).forEach(z => {
      const name = z.city || 'No city name'; const key = z.msa + '|' + name; let c = by.get(key);
      if (!c) by.set(key, c = { key, city: name, msa: z.msa, zips: [], married: 0, pop: 0, div: 0, priv: 0, sapcr: 0, offices: 0, wdi: 0, wh: 0, w: 0, wz: 0, cm: {} });
      const m = z.acs.married || 0; c.zips.push(z.zip); c.married += m; c.pop += z.acs.pop || 0; c.div += z.alloc.div || 0; c.priv += z.alloc.priv || 0; c.sapcr += z.alloc.sapcr || 0; c.offices += z.lawoffices || 0;
      if (isN(z.di) && m > 0) { c.wdi += z.di * m; c.w += m; } if (isN(z.risk.haz_pred) && m > 0) { c.wh += z.risk.haz_pred * m; c.wz += m; }
      c.cm[z.county] = (c.cm[z.county] || 0) + m;
    });
    return [...by.values()].map(c => { const counties = Object.keys(c.cm).sort((a, b) => c.cm[b] - c.cm[a] || a.localeCompare(b)); return { key: c.key, city: c.city, msa: c.msa, county: counties[0], counties, zips: c.zips, n: c.zips.length, married: c.married, pop: c.pop, div: c.div, priv: c.priv, sapcr: c.sapcr, offices: c.offices, di: c.w > 0 ? c.wdi / c.w : null, haz: c.wz > 0 ? c.wh / c.wz : null, fpo: c.offices > 0 ? c.priv / c.offices : null, divRate: c.married > 0 ? c.div / c.married * 1000 : null }; });
  }
  /* ---- settlement classes: core metro counties (the largest county of each metro of 1 million or more, and any county there of 1.5
     million or more), the suburban ring (the other counties of those metros), small metros (the rest of the 26), non metro rural */
  const SETTLE = [['core', 'Core metro counties'], ['ring', 'Suburban ring'], ['small', 'Small metros'], ['rural', 'Non metro rural']];
  function settle(c) { if (!c.msa || !MSA[c.msa]) return 'rural'; const m = MSA[c.msa]; if (!(m.pop2025 >= 1e6)) return 'small'; const big = Math.max(...m.counties.map(f => (CI[f] || {}).pop2025 || 0)); return c.pop2025 === big || c.pop2025 >= 1.5e6 ? 'core' : 'ring'; }
  const offices = c => c.rates.lawoffices > 0 ? c.rates.lawoffices : 0;
  function gradient(cs) {
    const W = c => c.acs.married;
    return SETTLE.map(([k, l]) => { const r = (cs || CTY).filter(c => settle(c) === k); return { k, l, n: r.length, names: r.map(c => c.name), pop: sum(r.map(c => c.pop2025)), married: sum(r.map(W)), div: sum(r.map(c => c.filings.ttm.div || 0)), noOffice: r.filter(c => !offices(c)).length,
      rate: wmean(r, c => c.rates.div_per_1k_married, W), sep: wmean(r, c => c.acs.sep_per_1k_married, W), haz: wmean(r, c => c.risk.haz_pred, W), kids: wmean(r, c => c.acs.mc_kids_sh, W), esi: wmean(r, c => c.esi, W),
      off10k: wmean(r, c => rate(offices(c), c.pop2025, 1e4), W), fpo: wmean(r.filter(c => offices(c) > 0), c => c.rates.filings_per_lawoffice, W) }; });
  }
  /* ---- legal deserts: ZIPs with min or more married adults and no law office in ZIP Business Patterns, with the straight line distance
     to the nearest ZIP that has one (ZIP centers, any metro); counties with no law office in County Business Patterns, with the
     distance to the nearest county center that has one */
  function deserts(zs, min) {
    zs = zs || ZC; min = isN(min) ? min : 1500;
    const off = zs.filter(z => z.lawoffices > 0).map(z => ({ z, ll: zipLL(z) })).filter(o => o.ll);
    return zs.filter(z => (z.acs.married || 0) >= min && !(z.lawoffices > 0)).map(z => { const ll = zipLL(z); let best = null, bd = Infinity; if (ll) off.forEach(o => { const d = km(ll, o.ll); if (d < bd) { bd = d; best = o.z; } }); return { z, near: best, km: best ? bd : null }; }).sort((a, b) => b.z.acs.married - a.z.acs.married || a.z.zip.localeCompare(b.z.zip));
  }
  function bareCounties(cs) {
    cs = cs || CTY; const off = cs.filter(c => offices(c) > 0).map(c => ({ c, ll: ctyLL(c.fips) })).filter(o => o.ll);
    return cs.filter(c => !offices(c)).map(c => { const ll = ctyLL(c.fips); let best = null, bd = Infinity; if (ll) off.forEach(o => { const d = km(ll, o.ll); if (d < bd) { bd = d; best = o.c; } }); return { c, near: best, km: best ? bd : null }; }).sort((a, b) => (b.c.acs.married || 0) - (a.c.acs.married || 0));
  }
  /* ---- hot spots: local Moran's I (Anselin 1995) on k nearest neighbors, row standardized, with conditional permutations from a seeded
     generator so the same data always gives the same answer; HH is a high value among high neighbors at p below alpha */
  function rng(seed) { const imul = Math.imul; let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = imul(t ^ (t >>> 15), t | 1); t ^= t + imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function localMoran(items, val, xy, o) {
    o = o || {}; const k = o.k || 6, R = o.perms || 499, alpha = o.alpha || 0.05, rnd = rng(o.seed || 28);
    const pts = (items || []).map(it => ({ it, v: val(it), p: xy(it) })).filter(q => isN(q.v) && q.p && isN(q.p[0]) && isN(q.p[1]));
    const n = pts.length; if (n < Math.max(k + 2, o.min || 12)) return [];
    const mu = sum(pts.map(q => q.v)) / n; const sd = Math.sqrt(sum(pts.map(q => (q.v - mu) ** 2)) / n); if (!(sd > 0)) return [];
    const z = pts.map(q => (q.v - mu) / sd);   // standardized by the population SD, so m2 = 1 and I_i = z_i times the neighbors' mean
    const nb = pts.map((q, i) => { const d = []; for (let j = 0; j < n; j++) if (j !== i) d.push([j, (pts[j].p[0] - q.p[0]) ** 2 + (pts[j].p[1] - q.p[1]) ** 2]); return d.sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, k).map(x => x[0]); });
    const pick = new Int32Array(k);
    return pts.map((q, i) => {
      let lag = 0; for (let a = 0; a < k; a++) lag += z[nb[i][a]]; lag /= k; const I = z[i] * lag; let ext = 0;
      for (let r = 0; r < R; r++) { let s = 0, c = 0; while (c < k) { const j = (rnd() * n) | 0; if (j === i) continue; let dup = false; for (let b = 0; b < c; b++) if (pick[b] === j) { dup = true; break; } if (dup) continue; pick[c++] = j; s += z[j]; } const Ir = z[i] * s / k; if (I >= 0 ? Ir >= I : Ir <= I) ext++; }
      const p = (ext + 1) / (R + 1); const quad = z[i] >= 0 ? (lag >= 0 ? 'HH' : 'HL') : (lag >= 0 ? 'LH' : 'LL');
      return { it: q.it, v: q.v, z: z[i], lag, I, p, quad, sig: p < alpha };
    });
  }
  function hotZips(zs) { const by = {}; (zs || ZC).forEach(z => { (by[z.msa] = by[z.msa] || []).push(z); }); const out = []; Object.keys(by).forEach(m => localMoran(by[m], z => z.di, z => z.cent, { k: 6, perms: 499, seed: 28 }).forEach(r => out.push(r))); return out; }
  function hotCounties(cs) { return localMoran(cs || CTY, c => c.di, c => GEO.state.cent[c.fips], { k: 6, perms: 499, seed: 28 }); }
  /* ---- the filing record: a monthly series from t0 (months since year 0) summed by calendar year, in full and for the same months as
     the last (partial) year; full is null for a year the series does not cover in all twelve months */
  function sameMonths(arr, t0) {
    if (!arr || !arr.length) return null; const T = t0 + arr.length - 1; const y0 = Math.floor(t0 / 12), y1 = Math.floor(T / 12), M = T % 12; const years = [];
    for (let y = y0; y <= y1; y++) { let full = 0, nf = 0, ytd = 0, ny = 0; for (let m = 0; m < 12; m++) { const i = y * 12 + m - t0; if (i < 0 || i >= arr.length || !isN(arr[i])) continue; full += arr[i]; nf++; if (m <= M) { ytd += arr[i]; ny++; } } years.push({ y, full: nf === 12 ? full : null, ytd: ny === M + 1 ? ytd : null }); }
    return { years, last: y1, month: M, through: T };
  }
  /* the monthly series of an area: 'tx' (the state), 'msa:<code>' (the sum of its counties) or 'cty:<fips>' (a county with a series) */
  const SKEYS = ['div', 'div_k', 'sapcr', 'po', 'mod', 'enf', 'ivd', 'priv', 'd_div'];
  function areaSeries(area) {
    const [t, id] = String(area || 'tx').split(':');
    if (t === 'tx') { const s = { t0: ST.monthly.t0 }; SKEYS.forEach(k => { s[k] = (ST.monthly[k] || []).slice(); }); return s; }
    const cs = t === 'msa' && MSA[id] ? MSA[id].counties.map(f => CI[f]) : t === 'cty' && CI[id] ? [CI[id]] : [];
    const w = cs.filter(c => c && c.filings.series); if (!w.length || w.length < cs.length) return null;
    const t0 = Math.max(...w.map(c => c.filings.series.t0)); const n = Math.min(...w.map(c => c.filings.series.div.length - (t0 - c.filings.series.t0)));
    const s = { t0 }; SKEYS.forEach(k => { s[k] = []; for (let i = 0; i < n; i++) s[k][i] = sum(w.map(c => { const a = c.filings.series[k]; return a ? a[i + t0 - c.filings.series.t0] : 0; })); }); return s;
  }
  /* the year so far against the same months of the year before and of 2019, by case type */
  function yearStands(s, base) {
    if (!s) return []; base = base || 2019; const out = [];
    SKEYS.forEach(k => { const r = sameMonths(s[k], s.t0); if (!r) return; const Y = y => (r.years.find(x => x.y === y) || {}).ytd; const now = Y(r.last), prev = Y(r.last - 1), b = Y(base); out.push({ k, now, prev, base: b, vsPrev: isN(now) && prev > 0 ? (now / prev - 1) * 100 : null, vsBase: isN(now) && b > 0 ? (now / b - 1) * 100 : null }); });
    return out;
  }
  /* highest and lowest month of a series, leaving out the trailing provisional months */
  function extremes(arr, t0, skip) { const a = (arr || []).slice(0, Math.max(0, (arr || []).length - (skip == null ? 2 : skip))); let hi = -1, lo = -1; a.forEach((v, i) => { if (!isN(v)) return; if (hi < 0 || v > a[hi]) hi = i; if (lo < 0 || v < a[lo]) lo = i; }); return hi < 0 ? null : { hi: { t: t0 + hi, v: a[hi] }, lo: { t: t0 + lo, v: a[lo] } }; }
  /* ---- areas: 'tx', 'msa:<code>', 'cty:<fips>' */
  function areaCounties(area) { const [t, id] = String(area || 'tx').split(':'); if (t === 'msa' && MSA[id]) return MSA[id].counties.map(f => CI[f]).filter(Boolean); if (t === 'cty' && CI[id]) return [CI[id]]; return CTY; }
  function areaName(area) { const [t, id] = String(area || 'tx').split(':'); if (t === 'msa' && MSA[id]) return MNAME(MSA[id].title); if (t === 'cty' && CI[id]) return CI[id].name + ' County'; return 'Texas'; }
  /* every figure Severance states for an area: [figure, value, format, source, vintage, grade]; rows without a value are dropped */
  function headline(area) {
    const [t, id] = String(area || 'tx').split(':'); const cs = areaCounties(area); const one = t === 'cty' ? cs[0] : null; const m = t === 'msa' ? MSA[id] : null;
    const S = k => sum(cs.map(c => c.filings.ttm[k] || 0)), Sp = k => sum(cs.map(c => (c.filings.ttm_prev || {})[k] || 0));
    const tx = t === 'tx'; const tt = k => tx ? stTTM(k) : S(k);
    const div = tt('div'), priv = tt('priv'), prevDiv = tx ? sum(ST.monthly.div.slice(-24, -12)) : Sp('div');
    const d19 = tx ? (ST.annual['2019'] || {}).f_div : sum(cs.map(c => (c.filings.hist['2019'] || {}).div || 0));
    const married = tx ? ST.acs.married : sum(cs.map(c => c.acs.married || 0)); const sep = tx ? ST.acs.separated : sum(cs.map(c => c.acs.separated || 0)); const divd = tx ? ST.acs.divorced : sum(cs.map(c => c.acs.divorced || 0));
    const mod = sum(cs.map(c => modeled(c) || 0)); const offs = sum(cs.map(offices));
    const ttmV = one ? one.filings.ttm_label : (tx || cs.every(c => c.filings.series)) ? ttmSpan() : 'trailing 12 months where monthly, calendar 2025 elsewhere';
    const oca = 'Office of Court Administration, Court Activity Reporting';
    const removals = cs.map(c => c.dfps && c.dfps.removals ? c.dfps.removals['2025'] : null); const nRem = removals.filter(isN).length;
    const ur = one ? (one.laus || {}).ur : m ? m.ur : ST.laus.ur[ST.laus.ur.length - 1];
    const rows = [
      ['Population, 2025', sum(cs.map(c => c.pop2025 || 0)), v => N(v), 'Census Bureau population estimates', META.popest, 'A'],
      ['Divorces filed, trailing 12 months', div, v => N(v), oca, ttmV, 'A'],
      ['Divorces filed with children', tt('div_k'), v => N(v), oca, ttmV, 'A'],
      ['Custody suits (SAPCR) filed', tt('sapcr'), v => N(v), oca, ttmV, 'A'],
      ['Protective order applications', tt('po'), v => N(v), oca, ttmV, 'A'],
      ['Modifications and enforcements filed', tt('mod') + tt('enf'), v => N(v), oca, ttmV, 'A'],
      ['Private family law filings (IV-D excluded)', priv, v => N(v), oca, ttmV, 'A'],
      ['Divorces filed per 1,000 married adults', rate(div, married, 1000), v => N(v, 1), oca + '; ACS married adults', ttmV, 'A'],
      ['Divorces filed, change on the prior 12 months', prevDiv > 0 ? (div / prevDiv - 1) * 100 : null, v => sgn(v), oca, ttmV, 'A'],
      ['Divorces filed, change on 2019', d19 > 0 ? (div / d19 - 1) * 100 : null, v => sgn(v), oca, ttmV + ' against 2019', 'A'],
      ['Married adults', married, v => N(v), 'American Community Survey', META.acs, one ? cvGrade(one.acs.married_cv) || 'A' : 'A'],
      ['Separated adults', sep, v => N(v), 'American Community Survey', META.acs, one ? stepDown(cvGrade(one.acs.married_cv)) || 'B' : 'A'],
      ['Separated per 1,000 married', rate(sep, married, 1000), v => N(v, 1), 'American Community Survey', META.acs, one ? stepDown(cvGrade(one.acs.married_cv)) || 'B' : 'A'],
      ['Divorced adults', divd, v => N(v), 'American Community Survey', META.acs, 'A'],
      ['Divorce hazard observed in the Texas microdata, per 1,000 married a year', tx ? D.pums.groups.all.haz : null, v => N(v, 1) + ' (SE ' + N(D.pums.groups.all.se, 2) + ')', 'ACS public use microdata', META.pums, 'A'],
      ['Composition hazard, per 1,000 married a year', one ? one.risk.haz_pred : wmean(cs, c => c.risk.haz_pred, c => c.acs.married), v => N(v, 1), 'Severance hazard model on the microdata, married weighted', META.pums, 'B'],
      ['Modeled divorces a year (hazard times married adults)', mod, v => N(v), 'Severance hazard model', META.pums, 'B'],
      ['Court capture: divorces filed per modeled divorce', mod > 0 ? div / mod : null, v => N(v, 2), 'Observed filings over the model', ttmV, 'B'],
      ['Dissolution Index', one ? one.di : m ? m.di : null, v => N(v, 0), one ? `Severance, rank ${one.di_rank} of 254` : 'Severance, population weighted county average', 'module 01', one ? one.grade : 'B'],
      ['Economic Shock Index', one ? one.esi : m ? m.esi : null, v => N(v, 0), one ? 'Severance, percentile of 254 counties' : 'Severance, population weighted county average', 'module 05', 'B'],
      ['Unemployment rate', ur, v => P1(v), 'BLS LAUS via Texas Workforce Commission', fmtDate(META.laus_through), 'A'],
      ['Initial unemployment claims, last 13 weeks', sum(cs.map(c => (c.ui || {}).w13 || 0)), v => N(v), 'Texas Workforce Commission', 'weeks to ' + fmtDate(META.ui_through), 'A'],
      ['Initial claims, same 13 weeks of 2019', sum(cs.map(c => (c.ui || {}).w13_2019 || 0)), v => N(v), 'Texas Workforce Commission', '2019', 'A'],
      ['WARN workers, last 12 months', m ? m.warn12 : sum(cs.map(c => ((c.warn || {}).last12 || {}).workers || 0)), v => N(v), 'Texas Workforce Commission WARN notices', 'notices to ' + fmtDate(META.warn_through), 'B'],
      ['CPS removals, FY2025', nRem ? sum(removals.filter(isN)) : null, v => N(v) + (nRem < cs.length ? ` (${cs.length - nRem} count${cs.length - nRem > 1 ? 'ies' : 'y'} not reported)` : ''), 'DFPS Data Book', 'FY2025', 'A'],
      ['Law offices', offs, v => N(v), 'Census Business Patterns, NAICS 541110', '2023', 'B'],
      ['Private family filings per law office', offs > 0 ? priv / offs : null, v => N(v, 1), oca + '; Business Patterns', ttmV, 'B']
    ];
    return rows.filter(r => isN(r[1]));
  }
  /* ---- map layers: observed (someone else counted it), modeled (Severance computed it), and the two against each other. c is the county
     value, z the ZIP value; a layer with no z paints its county value on every ZIP (labeled county values); a layer with no c is a ZIP
     layer only. */
  const ttmNote = 'Trailing 12 months for the 86 metro counties with monthly reports, calendar 2025 elsewhere; counted in the county of the court.';
  const LAYERS = [
    { k: 'div', grp: 'obs', l: 'Divorces filed per 1,000 married adults', ramp: 'forest', c: c => c.rates.div_per_1k_married, f: v => N(v, 1), src: 'Office of Court Administration; ACS married adults', vint: ttmSpan(), g: 'A', note: ttmNote },
    { k: 'divk', grp: 'obs', l: 'Divorces with children per 1,000 married couple families with children', ramp: 'forest', c: c => rate(c.filings.ttm.div_k, c.acs.mc_fam_kids, 1000), f: v => N(v, 1), src: 'Office of Court Administration; ACS families', vint: ttmSpan(), g: 'A', note: ttmNote },
    { k: 'sapcr', grp: 'obs', l: 'Custody suits (SAPCR) per 1,000 children', ramp: 'forest', c: c => rate(c.filings.ttm.sapcr, c.acs.children, 1000), f: v => N(v, 2), src: 'Office of Court Administration; ACS children', vint: ttmSpan(), g: 'A', note: ttmNote },
    { k: 'po', grp: 'obs', l: 'Protective order applications per 1,000 adults', ramp: 'forest', c: c => rate(c.filings.ttm.po, c.acs.pop_18p, 1000), f: v => N(v, 2), src: 'Office of Court Administration; ACS adults', vint: ttmSpan(), g: 'A', note: ttmNote },
    { k: 'modenf', grp: 'obs', l: 'Modifications and enforcements per 1,000 children', ramp: 'forest', c: c => rate((c.filings.ttm.mod || 0) + (c.filings.ttm.enf || 0), c.acs.children, 1000), f: v => N(v, 2), src: 'Office of Court Administration; ACS children', vint: ttmSpan(), g: 'A', note: ttmNote },
    { k: 'sep', grp: 'obs', l: 'Separated adults per 1,000 married (ACS)', ramp: 'sage', c: c => c.acs.sep_per_1k_married, z: z => z.acs.sep_per_1k_married, f: v => N(v, 1), src: 'American Community Survey', vint: META.acs, g: 'A', gz: 'B', note: 'A survey estimate; ZIP figures carry wide margins (see survey precision).' },
    { k: 'divorced', grp: 'obs', l: 'Divorced adults, share of people 15 and over (ACS)', ramp: 'sage', c: c => c.acs.divorced_sh15, z: z => z.acs.divorced_sh15, f: v => P(v, 1), src: 'American Community Survey', vint: META.acs, g: 'A', gz: 'B', note: 'The stock of divorced people, not new divorces.' },
    { k: 'ur', grp: 'obs', l: 'Unemployment rate, ' + fmtDate(META.laus_through), ramp: 'leaf', c: c => c.laus ? c.laus.ur : null, f: v => P1(v), src: 'BLS LAUS via Texas Workforce Commission', vint: fmtDate(META.laus_through), g: 'A', note: 'Not seasonally adjusted.' },
    { k: 'claims', grp: 'obs', l: 'Initial unemployment claims, last 13 weeks, per 1,000 in the labor force', ramp: 'leaf', c: c => c.econ.claims_per_1k_lf_13w, f: v => N(v, 1), src: 'Texas Workforce Commission; LAUS labor force', vint: 'weeks to ' + fmtDate(META.ui_through), g: 'A', note: 'Claims by the county of the claimant.' },
    { k: 'warn', grp: 'obs', l: 'WARN workers, last 12 months, per 1,000 payroll jobs', ramp: 'leaf', c: c => c.econ.warn_per_1k, f: v => N(v, 2), src: 'TWC WARN notices; BLS QCEW jobs', vint: 'notices to ' + fmtDate(META.warn_through), g: 'B', note: 'Most counties had no notice; the open data portal lags the TWC listing.' },
    { k: 'removals', grp: 'obs', l: 'CPS removals, FY2025, per 1,000 children', ramp: 'sage', c: c => rate(c.dfps && c.dfps.removals ? c.dfps.removals['2025'] : null, c.acs.children, 1000), f: v => N(v, 2), src: 'DFPS Data Book; ACS children', vint: 'FY2025', g: 'A', note: 'Counties DFPS did not report are gray.' },
    { k: 'fv', grp: 'obs', l: 'Abuse investigations with family violence, FY2025, per 1,000 children', ramp: 'sage', c: c => rate(c.dfps && c.dfps.inv_fv ? c.dfps.inv_fv['2025'] : null, c.acs.children, 1000), f: v => N(v, 2), src: 'DFPS Data Book; ACS children', vint: 'FY2025', g: 'A', note: 'Investigations where DFPS recorded the family violence indicator.' },
    { k: 'offices', grp: 'obs', l: 'Law offices per 10,000 residents', ramp: 'teal', c: c => rate(offices(c), c.pop2025, 1e4), z: z => rate(z.lawoffices || 0, z.acs.pop, 1e4), f: v => N(v, 2), src: 'Census County and ZIP Business Patterns, NAICS 541110', vint: '2023', g: 'B', note: 'Establishments with paid employees only: a lawyer practicing alone without staff is not counted.' },
    { k: 'haz', grp: 'mod', l: 'Composition hazard: modeled divorces per 1,000 married a year', ramp: 'forest', c: c => c.risk.haz_pred, z: z => z.risk.haz_pred, f: v => N(v, 1), src: 'Severance hazard model on ACS PUMS', vint: META.pums, g: 'B', note: 'Hazards learned from Texas microdata applied to the local married population.' },
    { k: 'moddiv', grp: 'mod', l: 'Modeled divorces a year (hazard times married adults)', ramp: 'forest', log: true, c: modeled, z: modeled, f: v => N(v, 0), src: 'Severance hazard model', vint: META.pums, g: 'B', note: 'What the married population would produce at the modeled hazard.' },
    { k: 'esi', grp: 'mod', l: 'Economic Shock Index (percentile)', ramp: 'leaf', q: false, c: c => c.esi, f: v => N(v, 0), src: 'Severance, module 05', vint: 'claims to ' + fmtDate(META.ui_through), g: 'B', note: 'Six labor measures, each shrunk by county size, ranked across 254 counties.' },
    { k: 'di', grp: 'mod', l: 'Dissolution Index (percentile)', ramp: 'forest', q: false, c: c => c.di, z: z => z.di, f: v => N(v, 0), src: 'Severance, module 01', vint: ttmSpan(), g: 'B', note: 'The county index has seven components with filings at 30%; the ZIP index has six and no filings.' },
    { k: 'alloc', grp: 'mod', l: 'Allocated divorce filings a year', ramp: 'forest', log: true, z: z => z.alloc.div, f: v => N(v, 0), src: 'County filings spread to ZIPs by married adults times hazard', vint: ttmSpan(), g: 'C', note: 'An allocation, not a count: no court reports filings by ZIP.' },
    { k: 'allocrate', grp: 'mod', l: 'Allocated divorce filings per 1,000 married', ramp: 'forest', z: z => z.exp_div_per_1k_married, f: v => N(v, 1), src: 'ZIP allocation', vint: ttmSpan(), g: 'C', note: 'An allocation, not a count.' },
    { k: 'eff', grp: 'mod', l: 'Paid efficiency percentile (allocated filings per competing law office)', ramp: 'forest', q: false, z: z => z.paid.eff_pct, f: v => N(v, 0), src: 'Severance, module 07', vint: ttmSpan(), g: 'C', note: 'A ZIP with no office scores high because its families use offices nearby.' },
    { k: 'capture', grp: 'cmp', l: 'Court capture: divorces filed per modeled divorce', ramp: 'slate', c: capture, f: v => N(v, 2), src: 'Observed filings over the hazard model', vint: ttmSpan(), g: 'B', note: 'Below 1: separations that never file, filing in another county, the cost of filing, the military. Above 1: filings drawn from outside, or a population built differently from its survey area.' }
  ];
  const GRP = [['obs', 'Observed'], ['mod', 'Modeled'], ['cmp', 'Observed against modeled']];
  return { KM_MI, rate, zipLL, ctyLL, km, dist, wmean, acsSE, moe90, cvGrade, stepDown, gradeRule, modeled, capture, cityRollup, SETTLE, settle, gradient, deserts, bareCounties, rng, localMoran, hotZips, hotCounties, sameMonths, SKEYS, areaSeries, yearStands, extremes, areaCounties, areaName, headline, LAYERS, GRP, offices };
})();

/* ---- reference tables: Texas family law constants, the data inventory, the legal and access gates, the gaps. Wording follows the
   compliance engine (LINT rule whys and the changes register, src/03_lint.js) and LINE_META .law (module 06) where they exist. */
const GT_FC = ch => `https://statutes.capitol.texas.gov/Docs/FA/htm/FA.${ch}.htm`;
const GT_CONST = [
  { k: 'Residency to file for divorce', v: 'Either spouse domiciled in Texas for the 6 months before filing and a resident of the filing county for the 90 days before filing. Military stationing in Texas counts (§§ 6.303 to 6.304).', cite: 'Tex. Fam. Code § 6.301', url: GT_FC(6), eff: 'standing law', g: 'A' },
  { k: 'Waiting period', v: '60 days from filing before a divorce can be granted; a minimum, not a delivery time. No wait when the respondent has a family violence conviction or deferred adjudication against the petitioner or a household member, or the petitioner holds an active protective order or magistrate\'s order of emergency protection against the respondent for family violence during the marriage (§ 6.702(c)).', cite: 'Tex. Fam. Code § 6.702', url: GT_FC(6), eff: 'standing law', lint: 'sixty_days', g: 'A' },
  { k: 'Guideline child support', v: '20%, 25%, 30%, 35% and 40% of monthly net resources for 1 to 5 children before the court, and no less than the 5 child amount for 6 or more. Below $1,000 a month in net resources: 15%, 20%, 25%, 30% and 35%.', cite: 'Tex. Fam. Code § 154.125', url: GT_FC(154), eff: 'standing law', g: 'A' },
  { k: 'Net resources cap', v: '$11,700 a month in net resources since September 1, 2025 ($2,340 a month for one child at the cap); the cap was $9,200. Adjusted for inflation every six years; next on September 1, 2031. Support above the cap only on the child\'s proven needs (§ 154.126).', cite: 'Tex. Fam. Code § 154.125(a-1); Attorney General adjustment', url: GT_FC(154), eff: '2025-09-01', lint: 'stale_cap', change: 'Child support cap rises to $11,700', g: 'A' },
  { k: 'Modifying child support', v: 'A material and substantial change since the order, or 3 years since the order and a guideline amount that differs from it by 20% or $100. A change reaches back only to service or appearance on the motion.', cite: 'Tex. Fam. Code § 156.401', url: GT_FC(156), eff: 'standing law', lm: 'mod', g: 'A' },
  { k: 'Modifying conservatorship', v: 'A material and substantial change, a child of 12 or older stating a preference, or the conservator giving up primary care for 6 months (§ 156.101). Since 2025 three possession contempt findings are a material change (§ 156.107).', cite: 'Tex. Fam. Code §§ 156.101, 156.107', url: GT_FC(156), eff: '2025-09-01', change: 'Three possession contempt findings are a material change', g: 'A' },
  { k: 'Spousal maintenance cap', v: 'The lesser of $5,000 a month or 20% of the paying spouse\'s average monthly gross income. Maintenance is presumed unwarranted and gated: family violence, a marriage of 10 years or more with an inability to earn enough, or a disability (§ 8.051).', cite: 'Tex. Fam. Code § 8.055', url: GT_FC(8), eff: 'standing law', lint: 'alimony_myth', g: 'A' },
  { k: 'Spousal maintenance duration', v: 'Up to 5 years for a marriage under 10 years on the family violence gate, or of 10 to 20 years; 7 years for 20 to 30 years; 10 years for 30 years or more; as long as eligibility lasts on the disability grounds. The court sets the shortest reasonable period.', cite: 'Tex. Fam. Code § 8.054', url: GT_FC(8), eff: 'standing law', g: 'A' },
  { k: 'Standard possession order', v: 'Parents 100 miles apart or less: the 1st, 3rd and 5th weekends from 6 p.m. Friday to 6 p.m. Sunday, Thursday evenings in the school term, alternating holidays and 30 days in the summer (designated by notice by April 1). More than 100 miles apart: § 153.313 (a weekend a month option, 42 summer days, every spring break).', cite: 'Tex. Fam. Code §§ 153.312, 153.313', url: GT_FC(153), eff: 'standing law', g: 'A' },
  { k: 'Expanded standard possession order', v: 'Elections under § 153.317 run weekends and Thursdays from school dismissal to school resumption. Within 50 miles the expanded times are the default since September 1, 2021, unless the possessory conservator declines them, family violence restricts possession, or the court finds them not in the child\'s best interest. Not a 2025 change; joint managing conservatorship does not mean equal time.', cite: 'Tex. Fam. Code §§ 153.317, 153.3171', url: GT_FC(153), eff: '2021-09-01', lint: 'espo_2025', change: 'Expanded standard possession order is the default within 50 miles', lm: 'div_k', g: 'A' },
  { k: 'Protective order: the finding', v: 'The court finds that family violence occurred. Since 2023 the applicant no longer proves that it is likely to occur again. A temporary restraining order is not a protective order.', cite: 'Tex. Fam. Code ch. 85', url: GT_FC(85), eff: '2023', lint: 'po_future', change: 'Protective orders: violence occurred, not that it will recur', g: 'A' },
  { k: 'Protective order: duration', v: 'The period the order states, up to 2 years by default, and longer, up to life, on the § 85.025(a-1) findings. Since September 1, 2025 an order against a party to a pending divorce with the applicant runs until the second anniversary of the final decree, and one tied to a pending SAPCR until the second anniversary of the final order. A protective order prevails over a conflicting divorce or SAPCR order (§ 81.012).', cite: 'Tex. Fam. Code § 85.025(a-2) and (a-3); SB 1120 (2025)', url: GT_FC(85), eff: '2025-09-01', lint: 'po_duration', change: 'Protective orders tied to a pending divorce or SAPCR', lm: 'po', g: 'A' },
  { k: 'Property division', v: 'Community property is divided in a manner the court deems just and right; equal division is not required, and separate property is never divided. Separate property is proved by clear and convincing evidence (§ 3.003).', cite: 'Tex. Fam. Code § 7.001', url: GT_FC(7), eff: 'standing law', lint: 'property_5050', g: 'A' },
  { k: 'Child support arrears', v: '6% simple interest a year; arrears do not expire. Support and possession are independent obligations (§ 105.006(e)).', cite: 'Tex. Fam. Code § 157.265', url: GT_FC(157), eff: 'standing law', lint: 'stale_arrears', change: 'Arrears interest change dies; the rate stays 6%', g: 'A' },
  { k: 'A child\'s preference', v: 'On request the judge interviews a child of 12 or older in chambers about conservatorship and the primary residence; the preference never controls.', cite: 'Tex. Fam. Code § 153.009', url: GT_FC(153), eff: 'standing law', lint: 'child_chooses', g: 'A' }
];
const GT_INV = [
  ['C1', 'Courts · filings', 'Office of Court Administration, Court Activity Reporting and Directory System (card.txcourts.gov)', 'New cases filed, disposed and pending by family case type, district courts and county courts at law', 'County; monthly from January 2019 for the 86 metro counties, annual elsewhere', 'Public', 'Public, web reports', 'Used: every court figure. The last two months are provisional.', 'oca'],
  ['C2', 'Courts · case documents', 're:SearchTX, the statewide court records portal of the Office of Court Administration', 'Case indexes and electronically filed documents', 'Statewide, the e filing era', 'Restricted', 'Attorneys sign in with eFileTexas credentials; registered public users see index data and public documents only; family case types and documents marked as sensitive data are withheld from them', 'Not used: case records are not market data, and outreach built from filings is solicitation (Rule 7.03).', 'live'],
  ['C3', 'Courts · local indexes', 'The district clerks of the 254 counties', 'Case indexes, dockets, party names and filing dates', 'County', 'Varies', 'Varies by county: online search, terminals at the clerk\'s office, copy fees', 'Not used: no statewide feed, and party names are never used for marketing (Rule 7.03; Penal Code § 38.12).', 'live'],
  ['C4', 'Courts · administrative records', 'Courts and judicial agencies', 'Budgets, policies, contracts and correspondence that are not part of a case', 'Court', 'Restricted', 'A request under Rule 12 of the Rules of Judicial Administration', 'Not used: Rule 12 reaches a court\'s administrative records only; a record filed in a case is not a judicial record (Rule 12.2(d)).', ''],
  ['V1', 'Vital records · Texas', 'Department of State Health Services, Center for Health Statistics, Vital Statistics annual reports', 'Marriages and divorces reported by county and district clerks', 'County, annual', 'Public', 'Public, web tables', 'Not used: the county marriage and divorce tables end with the 2016 annual report.', '2016'],
  ['V2', 'Vital records · national', 'CDC, National Center for Health Statistics, National Vital Statistics System', 'Marriage and divorce rates per 1,000 residents by state', 'State, 1990 to 2023 (provisional)', 'Public', 'Public, web tables', 'Used: the long run Texas rates (module 03).', '2023'],
  ['S1', 'Census · survey', 'American Community Survey five year estimates, summary file', 'Marital status, separated and divorced adults, family structure, income, housing; the coefficient of variation of married adults', 'State, county, metro, ZCTA', 'Public', 'Public, bulk file', 'Used: married, separated and divorced adults and family structure, with the married CV.', 'acs'],
  ['S2', 'Census · microdata', 'ACS Public Use Microdata Sample, Texas', 'Person and household records with marital history', 'PUMA (about 100,000 people)', 'Public', 'Public, bulk file', 'Used: the composition hazard model.', 'pums'],
  ['S3', 'Census · population', 'Census Bureau population estimates', 'Resident population', 'County', 'Public', 'Public, bulk file', 'Used: population and per resident rates.', 'popest'],
  ['S4', 'Census · establishments', 'County Business Patterns and ZIP Business Patterns, NAICS 541110 offices of lawyers', 'Establishments with paid employees, employment, size classes', 'County, ZIP', 'Public', 'Public, bulk file', 'Used: law offices. Lawyers with no employees are not in it.', '2023'],
  ['S5', 'Census · nonemployers', 'Nonemployer Statistics, legal services', 'Businesses with no paid employees, where most solo practices sit', 'County (verify the industry detail published)', 'Public', 'Public, bulk file', 'Not used: would fill the solo practitioner gap in the office counts; not loaded in this build.', 'annual'],
  ['S6', 'Census · geography', 'TIGER/Line and cartographic boundary files', 'County and ZCTA shapes', 'Counties 2023, ZCTAs 2020', 'Public', 'Public, bulk file', 'Used: the maps and the ZIP distances.', '2023'],
  ['L1', 'Labor · unemployment', 'Texas Workforce Commission LMI, Local Area Unemployment Statistics (BLS)', 'Labor force, unemployed, unemployment rate, not seasonally adjusted', 'County, monthly from January 2010', 'Public', 'Public, web', 'Used: unemployment and the shock index. October 2025 is missing (no household survey during the federal shutdown).', 'laus'],
  ['L2', 'Labor · claims', 'Texas Workforce Commission, weekly initial claims by county', 'Initial unemployment insurance claims', 'County, weekly from January 5, 2019', 'Public', 'Public, web download', 'Used: claims and the shock index.', 'ui'],
  ['L3', 'Labor · layoffs', 'Texas Workforce Commission WARN notices on the Texas Open Data Portal (8w53-c4f6)', 'Employer, city, workers affected, notice and layoff dates', 'Notice, 2019 on', 'Public', 'Public, API', 'Used: WARN workers. The portal lags the TWC listing.', 'warn'],
  ['L4', 'Labor · payrolls', 'BLS Quarterly Census of Employment and Wages', 'Payroll jobs, wages, establishments', 'County, quarterly', 'Public', 'Public, bulk file', 'Used: payroll change and WARN workers per 1,000 jobs.', 'qcew'],
  ['L5', 'Labor · claimant records', 'Texas Workforce Commission unemployment files', 'Individual claims and employer reports', 'Person', 'Confidential', 'Confidential (Labor Code §§ 301.081, 301.085)', 'Not used: only the published county counts are used.', ''],
  ['W1', 'Child welfare · data book', 'DFPS Data Book on the Texas Open Data Portal', 'CPS removals; abuse and neglect investigations with the family violence indicator', 'County, FY2016 to FY2025', 'Public', 'Public, API', 'Used: removals and investigations.', 'FY2025'],
  ['W2', 'Child welfare · case records', 'DFPS case files', 'Reports of abuse or neglect, the reporter, investigation files', 'Case', 'Confidential', 'Confidential (Fam. Code § 261.201)', 'Not used.', ''],
  ['O1', 'Child support · IV-D', 'Office of the Attorney General, Child Support Division', 'Caseload, collections and IV-D court activity', 'Statewide reports (verify county detail)', 'Public', 'Public, web reports; case records confidential (verify: Fam. Code § 231.108)', 'Not used: IV-D filings come from the court counts and are floors (module 20).', ''],
  ['B1', 'Bar · membership', 'State Bar of Texas, Department of Research and Analysis, Attorney Statistical Profiles', 'Attorneys by practice area, firm size and demographics', 'Statewide and the largest counties (verify the current year)', 'Public', 'Public, web reports', 'Not used: a count of family lawyers by county would sharpen supply; not loaded in this build.', ''],
  ['B2', 'Bar · certification', 'Texas Board of Legal Specialization', 'Board certified lawyers in Family Law and in Child Welfare Law', 'Lawyer', 'Public', 'Public, web search only', 'Not used: no bulk file. The only specialty wording copy may carry (Rule 7.02(b)).', 'live'],
  ['B3', 'Bar · directory', 'State Bar of Texas, Find a Lawyer', 'Licensed lawyers, status, practice areas members report', 'Lawyer', 'Public', 'Public, web search under its terms of use', 'Not used: rivals go into Competitor Watch by hand (module 24).', 'live'],
  ['A1', 'Advertising · geo targets', 'Google Ads geotargets file', 'Location criterion IDs for ZIPs and counties', 'United States', 'Public', 'Public, bulk file', 'Used: criterion IDs in the ZIP tables and the Campaign Desk.', 'Aug 12, 2026'],
  ['A2', 'Advertising · keywords', 'Google Keyword Planner or a paid keyword tool', 'Search volumes and bids by keyword and place', 'ZIP to metro', 'Paid', 'An ad account or a paid subscription', 'Not used: keyword volumes are stated assumptions; a pull needs the firm\'s approval.', ''],
  ['P1', 'Property · appraisal', 'County appraisal districts', 'Parcel values and ownership', 'Parcel', 'Varies', 'Public, bulk exports with terms of use', 'Not used: owner names are personal data; aggregate home values come from the ACS.', '']
];
const GT_GATES = [
  ['The Public Information Act stops at the courthouse', 'Gov\'t Code § 552.003(1)(B); § 552.0035', 'The judiciary is not a governmental body under the Act. Access to information held for the judiciary is governed by rules of the Supreme Court of Texas and other law.'],
  ['Court administrative records', 'Rules of Judicial Administration, Rule 12', 'A court\'s administrative records are requested under Rule 12. A record filed in or created for a case is not a judicial record (Rule 12.2(d)); case records come from the clerk under the common law right of access, subject to sealing and confidentiality law.'],
  ['Sealing', 'Tex. R. Civ. P. 76a', 'Rule 76a sets the notice and hearing needed to seal court records, but its definition of court records leaves out documents filed in an action originally arising under the Family Code (Rule 76a(2)(a)(3)), so family files are sealed by order without that procedure.'],
  ['Sensitive data in filings', 'Tex. R. Civ. P. 21c', 'Identity and account numbers, and the birth date, home address and name of anyone who was a minor when the suit was filed, are redacted from filed documents; re:SearchTX withholds documents marked as containing sensitive data from public users.'],
  ['Confidential abuse reports', 'Tex. Fam. Code § 261.201', 'Reports of abuse or neglect, the reporter\'s identity and the investigation files are confidential and not subject to release under the Public Information Act. The DFPS Data Book publishes counts only.'],
  ['Protected addresses', 'Tex. Fam. Code §§ 82.011, 85.007', 'A protective order applicant\'s address is kept confidential on request (mandatory since September 1, 2025).'],
  ['Unemployment records', 'Labor Code §§ 301.081, 301.085', 'Claim and employer records are confidential and are not public information under the Act. Severance uses only the county counts TWC publishes.'],
  ['Census confidentiality', '13 U.S.C. § 9', 'The Census Bureau publishes tables and public use microdata only; nothing identifies a person or a business. ACS margins of error travel with the estimates.'],
  ['Outreach built from court filings', 'Tex. Disciplinary R. Prof\'l Conduct 7.03; Penal Code § 38.12', 'Contacting people because a case was filed is solicitation: Rule 7.03 limits it and sets its labels, and barratry is a crime. Severance maps demand by area, never by person.'],
  ['Calls and texts', '47 U.S.C. § 227; Bus. & Com. Code ch. 302', 'Calling or texting people found in any of these datasets needs consent or a registration; none of the data carries consent.'],
  ['Platform data and targeting', 'Google and Meta terms and personalized advertising policies', 'No scraping; ads may not be targeted on personal hardship or sensitive attributes (module 11).'],
  ['Paid data', 'Vendor terms', 'Keyword tools charge by the pull; the firm approves each one.']
];
const GT_GAPS = [
  ['Case outcomes and duration', 'Severance carries cases filed and disposed by type; how a case ended and how long it took are in the case files.'],
  ['Contested or agreed', 'Court counts do not say whether a divorce was contested at filing or settled later.'],
  ['Attorney of record', 'Clerk indexes name counsel case by case; there is no statewide file, and re:SearchTX withholds family cases from public users.'],
  ['Fees paid', 'No public record says what anyone paid a lawyer; the matter values in modules 07 and 10 are inputs.'],
  ['Who filed', 'Which spouse filed, and whether either had a lawyer, is in the case file only.'],
  ['Sealed and confidential matters', 'Sealed files, abuse reports and protected addresses are outside every dataset, by design.'],
  ['Mediation', 'Mediated settlements are not reported anywhere.'],
  ['Residence of the parties', 'Filings are counted in the county of the court; a couple who files in the other spouse\'s county, or under the military residency rules, is counted there.'],
  ['Separations that never file', 'The ACS separated count shows the pool; no record shows how many of them file, or when.'],
  ['Solo practitioners', 'Business Patterns count establishments with paid employees; a lawyer practicing alone without staff is not in them, so a legal desert is a gap in the count, not proof that no lawyer serves the ZIP.'],
  ['Which firm got the case', 'Retention is private; only the firm\'s own intake and ad data (module 23) show it.']
];
const GT_SVY_KIND = [['cty', 'Counties: ACS married and separated adults'], ['zip', 'ZIPs: ACS married and separated adults'], ['pums', 'PUMS divorce hazard by group'], ['panel', 'Panel model coefficients']];

registerModule({
  key: 'ground', num: '28', title: 'Ground Truth', desc: 'Counties, cities and ZIPs as observed and as modeled: every figure with its source, vintage, grade and survey error, the filing record, legal deserts, the Texas constants and the data inventory',
  mount(root) {
    const G = GROUND, self = this;
    const R = s => $(s, root);
    const gb = g => g ? `<span class="grade ${esc(g)}" title="Confidence grade ${esc(g)}">${esc(g)}</span>` : '';
    const metroOpts = Object.keys(MSA).sort((a, b) => MSA[b].pop2025 - MSA[a].pop2025);
    const SV = store.get('sev.ground', null) || {};
    const st = { view: SV.view === 'zip' ? 'zip' : 'cty', metro: MSA[SV.metro] ? SV.metro : '19100', layer: G.LAYERS.some(L => L.k === SV.layer) ? SV.layer : 'div', sel: CI[store.get('sev.county', '')] ? store.get('sev.county', '') : '48201', zip: null, pick: null, box: null,
      cityCty: CI[SV.cityCty] ? SV.cityCty : '', cityMetro: MSA[SV.cityMetro] ? SV.cityMetro : '', head: SV.head || 'tx', rec: SV.rec && (SV.rec === 'tx' || MSA[String(SV.rec).slice(4)]) ? SV.rec : 'tx', svy: GT_SVY_KIND.some(k => k[0] === SV.svy) ? SV.svy : 'cty', svyMetro: MSA[SV.svyMetro] ? SV.svyMetro : '', svyFlag: !!SV.svyFlag, dom: SV.dom || '', acc: SV.acc || '', deskMin: 1500 };
    if (!(st.head === 'tx' || (st.head.startsWith('msa:') && MSA[st.head.slice(4)]) || (st.head.startsWith('cty:') && CI[st.head.slice(4)]))) st.head = 'tx';
    const save = () => store.set('sev.ground', { view: st.view, metro: st.metro, layer: st.layer, cityCty: st.cityCty, cityMetro: st.cityMetro, head: st.head, rec: st.rec, svy: st.svy, svyMetro: st.svyMetro, svyFlag: st.svyFlag, dom: st.dom, acc: st.acc });
    const LY = k => G.LAYERS.find(L => L.k === k) || G.LAYERS[0];
    const ttmS = stTTM('div'); const modTX = sum(CTY.map(c => G.modeled(c) || 0));
    const des = G.deserts(ZC, 1500); const bare = G.bareCounties(CTY);
    const cities = G.cityRollup(ZC);
    const flagZ = ZC.filter(z => z.acs.married_cv > 0.3).length; const flagC = CTY.filter(c => c.acs.married_cv > 0.3).length;
    const nOff = sum(CTY.map(G.offices)); const nOffZ = ZC.filter(z => z.lawoffices > 0).length;

    root.innerHTML = mastHTML({ eyebrow: 'Module 28 · Ground Truth · counties, cities and ZIPs as observed and as modeled', title: 'Ground Truth', dek: `The atlas before any model touches it: the cases the district clerks reported to the Office of Court Administration, the married, separated and divorced Texans the Census Bureau surveyed, the unemployment, claims and layoffs the Texas Workforce Commission recorded, the removals DFPS made and the law offices the Census counted. Then Severance's own arithmetic on top, labeled as modeled: the hazard model, the indexes, the ZIP allocations and paid efficiency. Every figure carries its source, its vintage and a grade, survey figures carry their sampling error, and the last panels say what data exists for Texas family law, who holds it and what it takes to get it.`, facts: [[N(ttmS), 'divorces filed statewide, ' + ttmSpan()], [N(modTX), 'divorces a year the hazard model expects'], [N(nOff), 'law offices in County Business Patterns 2023'], [N(des.length), 'ZIPs with 1,500 or more married adults and no law office']] }) +
      toolbarHTML('Ground Truth', 'Observed first, modeled second', [{ id: 'gtCoX', label: '↓ Counties', title: 'Counties CSV: observed columns first, then modeled' }, { id: 'gtCiX', label: '↓ Cities', title: 'Cities CSV (the current filter)' }, { id: 'gtHlX', label: '↓ Headlines', title: 'Headline figures CSV: Texas, every metro, every county' }, { id: 'gtSvyX', label: '↓ Survey precision', title: 'Survey precision CSV' }, { id: 'gtInvX', label: '↓ Inventory', title: 'Data inventory, gates and gaps CSV' }, { id: 'gtDesX', label: '↓ Deserts', title: 'Legal deserts CSV' }, { id: 'gtDesk', label: 'Campaign Desk ↗', title: 'The selected county\'s top 30 ZIPs by paid efficiency' }, { id: 'gtForge', label: 'Site Forge ↗', title: 'The selected county and its top 30 ZIPs' }]) +
      callout('', 'Read this first: what is counted and what is computed', `<p>The <b>observed</b> layers are what someone else measured: divorce, custody, protective order, modification and enforcement filings reported monthly by the clerks (counted in the county of the court, not where the family lives); married, separated and divorced adults from the American Community Survey, a sample with margins of error; unemployment, claims and WARN layoffs; DFPS removals; and law offices from County Business Patterns, which counts offices with employees and misses a lawyer practicing alone. The <b>modeled</b> layers are Severance's arithmetic: the composition hazard (hazards learned from the Census microdata applied to each married population), the indexes, the ZIP allocations of county filings and paid efficiency. No court reports filings by ZIP, so every ZIP filing figure here is an allocation and is labeled modeled. The module does <b>not</b> predict any marriage, identify any person or case, or say which firm got a case; it maps where demand is measured and where it is inferred, so a buy rests on the first and is checked against the second.</p>`) +
      `<div class="tiles" id="gtTiles"></div>
      <div class="panel gt-mp" id="gtMapPanel"><div class="controls">
        <div class="ctl"><label id="gtViewL">Map</label>${segHTML('gtView', [['cty', 'Texas counties'], ['zip', 'Metro ZIPs']], st.view).replace('role="group"', 'role="group" aria-labelledby="gtViewL"')}</div>
        ${ctl('Metro', sel('gtMetro', metroOpts.map(k => [k, MNAME(MSA[k].title)]), st.metro))}
        <div class="ctl gt-lay"><label for="gtLayer">Layer</label><select id="gtLayer"></select></div>
        <div class="ctl"><label class="vh" for="gtReset">Reset</label><button type="button" class="btn sm" id="gtReset">Reset view</button></div></div>
        <div class="split"><div><div class="mapwrap gt-map" id="gtMap"></div><p class="small gt-legnote" id="gtLegNote"></p></div><div class="gt-side" id="gtSide" aria-live="polite"></div></div></div>
      <div class="panel gt-gap"><h3 id="gtDetT">County detail</h3><div class="sub" id="gtDetS"></div><div id="gtDet"></div></div>
      <div class="panel gt-gap"><h3>Counties</h3><div class="sub">All 254 counties. Observed columns first, then modeled ones (marked <span class="gt-mtag">model</span>). Click a row to open the county; on the ZIP map a metro county's ZIPs are picked out.</div><div id="gtCoT"></div></div>
      <div class="panel gt-gap"><h3>Cities</h3><div class="sub">ZIPs rolled up by their postal city inside each metro: married adults, allocated divorce filings and law offices summed, the ZIP index and hazard weighted by married adults. A city that spans counties is listed under the county holding most of its married adults. Click a city to pick out its ZIPs on the metro map.</div>
        <div class="controls">${ctl('Metro', sel('gtCiMetro', [['', 'All metros']].concat(metroOpts.map(k => [k, MNAME(MSA[k].title)])), st.cityMetro))}${ctl('County', `<select id="gtCiCty"></select>`)}<span class="small" id="gtCiN" role="status" aria-live="polite"></span></div><div id="gtCiT"></div></div>
      <div class="panel gt-gap"><h3>The urban to exurban gradient</h3><div class="sub">Means weighted by married adults across four settlement classes. Core metro counties: the largest county of each metro of a million or more residents, and any county there of 1.5 million or more (${esc(CTY.filter(c => G.settle(c) === 'core').map(c => c.name).join(', '))}); suburban ring: the other counties of those four metros; small metros: the other 22; non metro rural: the ${N(CTY.filter(c => !c.msa).length)} counties outside any metro.</div><div id="gtGrad"></div></div>
      <div class="gt-two">
        <div class="panel"><h3>Hot spots</h3><div class="sub">Where the Dissolution Index clusters: local Moran's I on the 6 nearest neighbors (county centers statewide, ZIP centers within each metro), 499 permutations, p below 0.05, a high value among high neighbors. The county index includes filings; the ZIP index does not.</div><div id="gtHot"></div></div>
        <div class="panel"><h3>Legal deserts</h3><div class="sub">ZIPs with 1,500 or more married adults and no law office, and counties with none, in the Census Business Patterns count.</div><div id="gtDes"></div></div></div>
      <div class="panel gt-gap"><h3>Headline figures</h3><div class="sub">Every figure Severance states for an area, with its source, vintage and grade. The CSV in the toolbar carries Texas, every metro and every county.</div>
        <div class="controls">${ctl('Area', `<select id="gtHead"><option value="tx">Texas</option><optgroup label="Metros">${metroOpts.map(k => `<option value="msa:${k}">${esc(MNAME(MSA[k].title))}</option>`).join('')}</optgroup><optgroup label="Counties">${CTY.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="cty:${c.fips}">${esc(c.name)} County</option>`).join('')}</optgroup></select>`)}</div><div id="gtHl"></div></div>
      <div class="grid2 gt-g2">
        <div class="panel"><h3>The filing record</h3><div class="sub" id="gtRecS"></div><div class="controls">${ctl('Area', `<select id="gtRec"><option value="tx">Texas</option><optgroup label="Metros">${metroOpts.map(k => `<option value="msa:${k}">${esc(MNAME(MSA[k].title))}</option>`).join('')}</optgroup></select>`)}</div><div id="gtRecC"></div><p class="gt-say" id="gtRecN"></p></div>
        <div class="panel"><h3>Where the year stands</h3><div class="sub" id="gtYtdS"></div><div id="gtYtd"></div></div></div>
      <div class="panel gt-gap"><h3>Survey precision</h3><div class="sub">Every survey and model estimate with its standard error, its 90% margin (1.645 standard errors) and its coefficient of variation (standard error over the estimate). Rows with a CV above 30% are flagged: where the interval is that wide, the bound is the finding.</div>
        <div class="controls">${ctl('Estimates', sel('gtSvy', GT_SVY_KIND, st.svy))}${ctl('Metro (ZIPs)', sel('gtSvyM', [['', 'All metros']].concat(metroOpts.map(k => [k, MNAME(MSA[k].title)])), st.svyMetro))}<label class="chk"><input type="checkbox" id="gtSvyF"${st.svyFlag ? ' checked' : ''}> Only rows with a CV above 30%</label><span class="small" id="gtSvyN" role="status" aria-live="polite"></span></div><div id="gtSvyT"></div><div id="gtRule"></div></div>
      <div class="panel gt-gap"><h3>Texas family law constants</h3><div class="sub">The statutory numbers the atlas and its copy rely on, each with its citation, effective date and grade, checked against the Family Code as amended through the 89th Legislature (2025). Re check after September 1, 2027, when the 90th Legislature's bills take effect. Not legal advice.</div><div id="gtConst"></div></div>
      <div class="panel gt-gap"><h3>Texas family law data inventory</h3><div class="sub">What exists, who holds it, what it contains, what it takes to get it, and whether Severance uses it.</div>
        <div class="controls">${ctl('Domain', '<select id="gtDom"></select>')}${ctl('Access', '<select id="gtAcc"></select>')}<span class="small" id="gtInvN" role="status" aria-live="polite"></span></div><div id="gtInv"></div></div>
      <div class="grid2 gt-g2">
        <div class="panel"><h3>Legal and access gates</h3><div class="sub">The rules that decide what leaves each custodian. Citations marked verify were not checked against the live text.</div><div id="gtGates"></div></div>
        <div class="panel"><h3>Gaps no public dataset fills</h3><div class="sub">Where the inventory ends, and why.</div><div id="gtGaps"></div></div></div>
      <div class="grid2 gt-g2">
        <div class="panel"><h3>How to read this module</h3><div class="prose gt-prose" id="gtHow"></div></div>
        <div class="panel"><h3>Sources</h3><div id="gtSrc"></div></div></div>`;

    /* ---------- tiles ---------- */
    const capTX = modTX > 0 ? ttmS / modTX : null;
    R('#gtTiles').innerHTML = tile('Divorces filed', N(ttmS), `${ttmSpan()} · ${N(ttmS / ST.acs.married * 1000, 1)} per 1,000 married · observed`, 'A') +
      tile('Divorces modeled', N(modTX), `a year at each county's composition hazard · ${N(capTX, 2)} filed per modeled divorce`, 'B') +
      tile('Separated adults', N(ST.acs.separated), `${N(ST.acs.sep_per_1k_married, 1)} per 1,000 married · ACS, observed`, 'A') +
      tile('Law offices', N(nOff), `${N(bare.length)} counties with none · ${N(nOffZ)} of ${N(ZC.length)} metro ZIPs with one`, 'B') +
      tile('Legal deserts', N(des.length), 'ZIPs with 1,500 or more married adults and no law office', 'B') +
      tile('Wide survey margins', N(flagZ), `ZIPs whose married count has a CV above 30% (${N(flagC)} counties)`, 'A');

    /* ---------- the map ---------- */
    const mapEl = R('#gtMap');
    const zipsOf = code => ZC.filter(z => z.msa === code);
    const layerVal = (L, z) => L.z ? L.z(z) : (L.c && CI[z.county] ? L.c(CI[z.county]) : null);
    const countyVals = L => st.view === 'zip' && !L.z;
    function layerOptions() {
      const s = R('#gtLayer'); s.innerHTML = G.GRP.map(([g, gl]) => `<optgroup label="${esc(gl)}">${G.LAYERS.filter(L => L.grp === g).map(L => { const off = st.view === 'cty' && !L.c; return `<option value="${L.k}"${off ? ' disabled' : ''}>${esc(L.l + (off ? ' (ZIP map only)' : st.view === 'zip' && !L.z ? ' (county values)' : ''))}</option>`; }).join('')}</optgroup>`).join('');
      if (st.view === 'cty' && !LY(st.layer).c) st.layer = 'div'; s.value = st.layer;
    }
    function legendNote(L) { const zg = st.view === 'zip' && L.z && L.gz ? L.gz : L.g; return `<b>${L.grp === 'obs' ? 'Observed' : L.grp === 'mod' ? 'Modeled' : 'Observed against modeled'}.</b> ${esc(L.src)} · ${esc(L.vint)} · grade ${gb(zg)}${countyVals(L) ? ' · <b>county values</b> painted on every ZIP of the county' : ''}. ${esc(L.note || '')}${st.view === 'zip' ? ' ZIP figures for metro ZIPs only; gray ZIPs have fewer than 200 residents.' : ''}`; }
    const tipRow = (a, b) => `<div class="row"><span>${a}</span><span>${b}</span></div>`;
    function ctyTip(c, L) { const v = L.c ? L.c(c) : null; return `<b>${esc(c.name)} County</b>${tipRow(esc(L.l), esc(L.f(v)))}${tipRow('Divorces filed, 12 mo', N(c.filings.ttm.div))}${tipRow('Married adults', N(c.acs.married))}${tipRow('Grade', esc(c.grade))}`; }
    function zipTip(z, L) { const v = layerVal(L, z); return `<b>${esc(z.zip)} · ${esc(z.city || '')}</b>${tipRow(esc(z.county_name) + ' County', '')}${tipRow(esc(L.l) + (countyVals(L) ? ' (county value)' : ''), esc(L.f(v)))}${tipRow('Married adults', N(z.acs.married))}${tipRow('Law offices', N(z.lawoffices || 0))}`; }
    // the part of a metro map that holds a set of ZIPs, padded, at the map's own shape
    function boxOf(code, zips) {
      const M = GEO.metros[code]; if (!M || !zips || !zips.length) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      zips.forEach(id => { const n = (M.zcta[id] || '').match(/-?\d+(?:\.\d+)?/g) || []; for (let i = 0; i + 1 < n.length; i += 2) { const x = +n[i], y = +n[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
      if (!isFinite(x0)) return null; let w = x1 - x0, h = y1 - y0; const minW = M.W * 0.22; const pad = Math.max(w, h) * 0.18 + 6; x0 -= pad; y0 -= pad; w += 2 * pad; h += 2 * pad;
      if (w < minW) { x0 -= (minW - w) / 2; w = minW; } const asp = M.W / M.H; if (w / h < asp) { const nw = h * asp; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / asp; y0 -= (nh - h) / 2; h = nh; }
      if (w >= M.W) return null; return [x0, y0, w, h];
    }
    function draw() {
      hideTip(); const L = LY(st.layer); R('#gtMetro').disabled = st.view !== 'zip'; R('#gtMetro').closest('.ctl').classList.toggle('gt-off', st.view !== 'zip');
      if (st.view === 'cty') {
        const sc = layerScale({ ramp: L.ramp, v: c => L.c(c), f: L.f, log: L.log, q: L.q }, CTY);
        const big = CTY.slice().sort((a, b) => b.pop2025 - a.pop2025).slice(0, 14).map(c => c.fips);
        drawMap(mapEl, { W: GEO.state.W, H: GEO.state.H, paths: GEO.state.county, value: id => CI[id] ? L.c(CI[id]) : null, color: sc.color, label: id => CI[id] ? ctyTip(CI[id], L) : esc(id), onSelect: id => selectCounty(id, { from: 'map' }), selected: st.sel, outline: GEO.state.outline, cent: GEO.state.cent, labels: big, labelText: id => CI[id].name, legend: Object.assign({ title: L.l }, sc.legend), title: 'Texas counties, ' + L.l, noDataLabel: 'not reported' });
      } else {
        const M = GEO.metros[st.metro]; const zs = zipsOf(st.metro); const zi = {}; zs.forEach(z => { zi[z.zip] = z; });
        const sc = layerScale({ ramp: L.ramp, v: z => layerVal(L, z), f: L.f, log: L.log, q: L.q }, zs);
        drawMap(mapEl, { W: M.W, H: M.H, paths: M.zcta, value: id => zi[id] ? layerVal(L, zi[id]) : null, color: sc.color, label: id => zi[id] ? zipTip(zi[id], L) : `<b>${esc(id)}</b><div class="small">fewer than 200 residents, no data</div>`, onSelect: id => { if (zi[id]) selectZip(id); }, selected: st.zip, counties: M.county, cent: M.ccent, labels: Object.keys(M.county), labelText: id => CI[id] ? CI[id].name : id, legend: Object.assign({ title: L.l + (countyVals(L) ? ', county values' : '') }, sc.legend), title: MNAME(MSA[st.metro].title) + ' ZIPs, ' + L.l, noDataLabel: 'fewer than 200 residents', view: st.box });
        if (st.pick) { const on = new Set(st.pick.zips); $$('path.area', mapEl).forEach(p => { const y = on.has(p.dataset.id); p.classList.toggle('gt-pick', y); p.classList.toggle('gt-dim', !y); if (y) p.parentNode.appendChild(p); }); }
        if (st.zip) markSel(mapEl, st.zip);
      }
      R('#gtLegNote').innerHTML = legendNote(L);
    }
    /* ---------- selection ---------- */
    function selectCounty(f, o) {
      o = o || {}; if (!CI[f]) return; st.sel = f; st.zip = null; store.set('sev.county', f);
      const c = CI[f];
      if (o.from === 'map') { st.pick = null; if (st.view === 'cty') markSel(mapEl, f); else draw(); }
      else if (st.view === 'zip' && c.msa && GEO.metros[c.msa]) { st.metro = c.msa; R('#gtMetro').value = st.metro; const zs = ZC.filter(z => z.county === f).map(z => z.zip); st.pick = zs.length ? { kind: 'county', key: f, label: c.name + ' County', zips: zs } : null; st.box = st.pick ? boxOf(st.metro, zs) : null; draw(); }
      else { st.view = 'cty'; st.pick = null; st.box = null; syncView(); draw(); }
      detail(); side(); if (coT) coT.setSel(f, true); save();
      if (o.scroll) R('#gtMapPanel').scrollIntoView({ block: 'start' });
    }
    function selectZip(id) { const z = ZI[id]; if (!z) return; st.zip = id; st.sel = z.county; store.set('sev.county', z.county); markSel(mapEl, id); detail(); side(); if (coT) coT.setSel(z.county, true); }
    function selectCity(key, o) {
      const c = cities.find(x => x.key === key); if (!c || !GEO.metros[c.msa]) return;
      st.view = 'zip'; st.metro = c.msa; st.pick = { kind: 'city', key, label: c.city, zips: c.zips.slice(), city: c }; st.box = boxOf(c.msa, c.zips); st.zip = null; st.sel = c.county; store.set('sev.county', c.county);
      syncView(); draw(); detail(); side(); if (coT) coT.setSel(c.county, true); if (ciT) ciT.setSel(key, true); save();
      if (!o || o.scroll !== false) R('#gtMapPanel').scrollIntoView({ block: 'start' });
    }
    function syncView() { $$('#gtView button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.view))); R('#gtMetro').value = st.metro; layerOptions(); }
    const rowl = (l, v, g) => `<dt>${l}</dt><dd>${v}${g ? ' ' + gb(g) : ''}</dd>`;
    function side() {
      const c = CI[st.sel]; const z = st.zip ? ZI[st.zip] : null; let h = '';
      if (z) { const cv = z.acs.married_cv; h += `<h4 class="gt-h4">${esc(z.zip)} · ${esc(z.city || '')}</h4><p class="small">${esc(z.county_name)} County · ${esc(MNAME((MSA[z.msa] || {}).title || ''))} · criterion ${esc(z.gt || NA)}</p><dl class="kv">
        ${rowl('Married adults (ACS)', `${N(z.acs.married)}${isN(cv) ? ` ± ${N(G.moe90(z.acs.married, cv))}` : ''}`, G.cvGrade(cv))}${rowl('Separated per 1,000 married (ACS)', N(z.acs.sep_per_1k_married, 1), G.stepDown(G.cvGrade(cv)))}${rowl('Divorced, share of 15 and over (ACS)', P(z.acs.divorced_sh15, 1), 'B')}${rowl('Law offices (ZIP Business Patterns)', N(z.lawoffices || 0), 'B')}
        ${rowl('Hazard per 1,000 married (model)', N(z.risk.haz_pred, 1), 'B')}${rowl('Allocated divorce filings a year (model)', N(z.alloc.div, 1), 'C')}${rowl('Allocated private family filings (model)', N(z.alloc.priv, 1), 'C')}${rowl('ZIP index (model)', N(z.di, 0), 'B')}${rowl('Paid efficiency percentile (model)', N(z.paid.eff_pct, 0), 'C')}</dl>`; }
      if (st.pick && st.pick.kind === 'city') { const x = st.pick.city; h += `<h4 class="gt-h4">${esc(x.city)}</h4><p class="small">${N(x.n)} ZIP${x.n > 1 ? 's' : ''} picked out on the map · ${esc(x.counties.map(f => cname(f)).join(', '))} ${x.counties.length > 1 ? 'counties' : 'County'}</p><dl class="kv">${rowl('Married adults', N(x.married), 'B')}${rowl('Allocated divorce filings a year (model)', N(x.div, 0), 'C')}${rowl('Law offices', N(x.offices), 'B')}${rowl('ZIP index, married weighted (model)', N(x.di, 0), 'B')}</dl><div class="btnrow"><button type="button" class="btn sm" id="gtCityDesk">Campaign Desk ↗ (this city's ZIPs)</button></div>`; }
      if (c) h += `<h4 class="gt-h4">${esc(c.name)} County ${gb(c.grade)}</h4><p class="small">${esc(c.msa_title ? MNAME(c.msa_title) : 'non metro')} · ${esc(G.SETTLE.find(s => s[0] === G.settle(c))[1].toLowerCase())}</p><dl class="kv">${rowl('Divorces filed, ' + esc(c.filings.ttm_label), N(c.filings.ttm.div), 'A')}${rowl('Modeled divorces a year', N(G.modeled(c), 0), 'B')}${rowl('Filed per modeled divorce', N(G.capture(c), 2), 'B')}${rowl('Law offices', G.offices(c) ? N(G.offices(c)) : 'none recorded', 'B')}</dl><div class="btnrow"><button type="button" class="btn sm" id="gtSideDesk">Campaign Desk ↗</button><button type="button" class="btn sm" id="gtSideForge">Site Forge ↗</button>${st.pick || st.zip || st.box ? '<button type="button" class="btn sm" id="gtSideClr">Clear selection</button>' : ''}</div>`;
      h += `<p class="small gt-hint">${st.view === 'cty' ? 'Click a county for its detail below. Metro ZIPs shows the layers that exist by ZIP and paints county only layers as county values.' : 'Click a ZIP for its ledger, a city in the cities table to pick out its ZIPs, or a county row to pick out the county\'s ZIPs.'}</p>`;
      R('#gtSide').innerHTML = h;
      const b = (id, fn) => { const e = R('#' + id); if (e) e.onclick = fn; };
      b('gtCityDesk', () => { const x = st.pick && st.pick.city; if (x) goModule('desk', { zips: x.zips.slice(), geo: 'msa:' + x.msa }); });
      b('gtSideDesk', toDesk); b('gtSideForge', toForge); b('gtSideClr', () => { st.pick = null; st.box = null; st.zip = null; draw(); side(); if (ciT) ciT.setSel(null, true); });
    }
    /* ---------- county detail: observed rows, then modeled rows ---------- */
    function detail() {
      const c = CI[st.sel]; if (!c) return; const a = c.acs, f = c.filings.ttm, cv = a.married_cv; const g = G.cvGrade(cv), gs = G.stepDown(g);
      const oca = 'OCA court activity', vt = c.filings.ttm_label; const acs = 'Census Bureau', va = META.acs;
      const la = c.laus || {}, ui = c.ui || {}, w = c.warn || {}, q = c.qcew || {}, df = c.dfps || {}; const gap = repGap(c);
      const rm = df.removals ? df.removals['2025'] : null, fv = df.inv_fv ? df.inv_fv['2025'] : null;
      const obs = [
        ['Population, 2025', N(c.pop2025), '', 'Census population estimates', META.popest, 'A'],
        ['Divorces filed', N(f.div), '', oca, vt, 'A'], ['Divorces filed with children', N(f.div_k), '', oca, vt, 'A'], ['Custody suits (SAPCR)', N(f.sapcr), '', oca, vt, 'A'], ['Protective order applications', N(f.po), '', oca, vt, 'A'], ['Modifications', N(f.mod), '', oca, vt, 'A'], ['Enforcements', N(f.enf), '', oca, vt, 'A'], ['Title IV-D support and paternity', N(f.ivd), '', oca, vt, 'A'], ['Private family filings', N(f.priv), '', oca, vt, 'A'], ['Divorces disposed', N(f.d_div), '', oca, vt, 'A'],
        ['Divorces filed per 1,000 married', N(c.rates.div_per_1k_married, 1), '', oca + '; ' + acs, vt, 'A'], ['Divorces filed, change on the prior year', sgn(c.rates.div_yoy), '', oca, vt, 'A'], ['Divorces filed, change on 2019', sgn(c.rates.div_vs_2019), '', oca, vt + ' against 2019', 'A'],
        ['Married adults', N(a.married), isN(cv) ? `± ${N(G.moe90(a.married, cv))} · CV ${P(cv, 1)}` : NA, acs, va, g],
        ['Separated adults', N(a.separated), 'not carried', acs, va, gs], ['Separated per 1,000 married', N(a.sep_per_1k_married, 1), 'not carried', acs, va, gs], ['Divorced adults', N(a.divorced), 'not carried', acs, va, gs],
        ['Married couple families with children', N(a.mc_fam_kids), 'not carried', acs, va, gs], ['Children', N(a.children), 'not carried', acs, va, gs],
        ['Unemployment rate', P1(la.ur), `year earlier ${P1(la.ur_yago)}`, 'BLS LAUS via TWC', fmtDate(la.last || META.laus_through), 'A'],
        ['Initial claims, last 13 weeks', N(ui.w13), `2019 ${N(ui.w13_2019)} · year earlier ${N(ui.w13_yago)}`, 'TWC', 'weeks to ' + fmtDate(ui.last_week || META.ui_through), 'A'],
        ['WARN workers, last 12 months', N((w.last12 || {}).workers || 0), `${N((w.last12 || {}).notices || 0)} notices`, 'TWC WARN notices', 'to ' + fmtDate(META.warn_through), 'B'],
        ['Payroll jobs', N(q.emp), `${sgn(q.emp_pct)} on a year earlier`, 'BLS QCEW', fmtQ(q.last), 'A'],
        ['CPS removals', isN(rm) ? N(rm) : 'not reported', '', 'DFPS Data Book', 'FY2025', 'A'], ['Abuse investigations with family violence', isN(fv) ? N(fv) : 'not reported', '', 'DFPS Data Book', 'FY2025', 'A'],
        ['Law offices', G.offices(c) ? N(G.offices(c)) : 'none recorded', isN(c.rates.legal_emp) ? `${N(c.rates.legal_emp)} legal services jobs` : '', 'County Business Patterns, NAICS 541110', '2023', 'B'],
        ['Private family filings per law office', G.offices(c) ? N(c.rates.filings_per_lawoffice, 1) : 'no office', '', oca + '; CBP', vt, 'B']
      ];
      const zs = ZC.filter(z => z.county === c.fips); const top = zs.slice().sort((x, y) => (y.paid.eff_pct || 0) - (x.paid.eff_pct || 0))[0]; const L = c.lines || {};
      const mod = [
        ['Composition hazard, per 1,000 married a year', N(c.risk.haz_pred, 1), `survey area observed ${N(c.risk.haz_obs, 1)}`, 'Hazard model on ACS PUMS', META.pums, 'B'],
        ['Modeled divorces a year', N(G.modeled(c), 0), 'hazard times married adults', 'Hazard model', META.pums, 'B'],
        ['Court capture: filed per modeled divorce', N(G.capture(c), 2), 'observed over modeled', 'Filings over the model', vt, 'B'],
        ['Dissolution Index', N(c.di, 0), `rank ${c.di_rank} of 254`, 'Severance, module 01', vt, c.grade],
        ['Economic Shock Index', N(c.esi, 0), 'percentile of 254', 'Severance, module 05', 'claims to ' + fmtDate(META.ui_through), 'B'],
        ['Expected filings lift at 12 months', sgn(c.econ.expected.m12_pct), 'panel elasticities on the change in claims', 'Severance panel model', 'claims to ' + fmtDate(META.ui_through), 'C'],
        ['Married adults with an unemployed spouse in the home', N(c.econ.married_exposed, 0), 'microdata exposure times married adults', 'ACS PUMS exposure', META.pums, 'C'],
        ['High asset divorces a year', N((L.high || {}).n), 'divorces scaled by the over $150,000 share', 'Module 06 estimate', vt, 'C'], ['Gray divorces a year (50 and over)', N((L.gray || {}).n), 'divorces scaled by age hazards', 'Module 06 estimate', vt, 'C'], ['Military divorces a year', N((L.mil || {}).n), 'active duty exposure times 1.46', 'Module 06 estimate', vt, 'C'], ['Premarital agreements a year', N((L.prenup || {}).est), '6% of new marriages, an assumption', 'Module 06 estimate', META.acs, 'D'],
        ['ZIPs with data', zs.length ? N(zs.length) : 'none (non metro)', zs.length ? `${N(sum(zs.map(z => z.alloc.div || 0)), 0)} divorce filings allocated to them` : '', 'ZIP allocation', vt, 'C'],
        ['Most efficient ZIP for paid search', top ? `${esc(top.zip)} ${esc(top.city || '')}` : 'no ZIP data', top ? `percentile ${N(top.paid.eff_pct, 0)}` : '', 'Severance, module 07', vt, 'C']
      ];
      const tab = (rows, cap) => `<div class="tblbox"><div class="tblwrap gt-dt"><table class="t"><caption class="vh">${esc(cap)}</caption><thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col" class="l">Margin or note</th><th scope="col" class="l">Source and vintage</th><th scope="col">Grade</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td><b>${r[1]}</b></td><td class="l gt-w">${esc(r[2])}</td><td class="l gt-w">${esc(r[3])}<span class="gt-vin">${esc(r[4])}</span></td><td>${gb(r[5])}</td></tr>`).join('')}</tbody></table></div></div>`;
      const cs = cities.filter(x => x.county === c.fips).sort((x, y) => y.married - x.married).slice(0, 16);
      R('#gtDetT').textContent = c.name + ' County';
      R('#gtDetS').innerHTML = `${esc(c.msa_title ? MNAME(c.msa_title) : 'Non metro')} · county grade ${gb(c.grade)} (the rule: ${G.gradeRule(c) === c.grade ? 'reproduced' : 'differs'}) · ACS margins are at 90% confidence; the Census carries a margin for married adults only, so other ACS rows are graded one step below it.`;
      R('#gtDet').innerHTML = (gap ? `<p class="small gt-warn"><b>Possible clerk reporting gap:</b> no divorce filings reported in the last ${gap.months} months after about ${N(gap.avg, 0)} a month the year before. Read the counts as incomplete.</p>` : '') +
        `<div class="gt-blocks"><div><h4 class="gt-h4 gt-obs">Observed</h4>${tab(obs, c.name + ' County, observed')}</div><div><h4 class="gt-h4 gt-modh">Modeled</h4>${tab(mod, c.name + ' County, modeled')}</div></div>` +
        (cs.length ? `<h4 class="gt-h4">Cities by married adults</h4><div class="gt-tags">${cs.map(x => `<button type="button" class="gt-tag" data-city="${esc(x.key)}">${esc(x.city)} <span>${K(x.married)}</span></button>`).join('')}</div>` : '<p class="small">A non metro county: Severance carries no ZIP data here, so the cities, ZIP allocations and paid efficiency are blank.</p>');
      $$('.gt-tag[data-city]', R('#gtDet')).forEach(b => b.onclick = () => selectCity(b.dataset.city));
    }
    /* ---------- counties table: observed columns, then modeled ---------- */
    const mt = s => s + ' (model)';
    const coCols = [
      { k: 'name', l: 'County', fmt: v => esc(v) }, { k: 'metro', l: 'Metro', fmt: v => esc(v), cls: 'l wrap' },
      { k: 'pop', l: 'Pop 2025', fmt: v => N(v) }, { k: 'married', l: 'Married', fmt: v => N(v) }, { k: 'cv', l: 'Married CV', fmt: v => P(v, 1) },
      { k: 'div', l: 'Divorces filed', fmt: v => N(v) }, { k: 'rate', l: 'per 1k married', fmt: v => N(v, 1) }, { k: 'divk', l: 'with kids', fmt: v => N(v) }, { k: 'sapcr', l: 'SAPCR', fmt: v => N(v) }, { k: 'po', l: 'PO', fmt: v => N(v) }, { k: 'me', l: 'Mod+Enf', fmt: v => N(v) },
      { k: 'sep', l: 'Separated /1k', fmt: v => N(v, 1) }, { k: 'divd', l: 'Divorced %', fmt: v => P(v, 1) }, { k: 'ur', l: 'Unemp', fmt: v => P1(v) }, { k: 'claims', l: 'Claims /1k LF', fmt: v => N(v, 1) }, { k: 'warn', l: 'WARN 12 mo', fmt: v => N(v) }, { k: 'rem', l: 'Removals FY25', fmt: v => isN(v) ? N(v) : 'n/r' }, { k: 'off', l: 'Law offices', fmt: v => v ? N(v) : 'none' }, { k: 'fpo', l: 'Filings / office', fmt: (v, r) => r.off ? N(v, 1) : 'no office' },
      { k: 'haz', l: mt('Hazard'), fmt: v => N(v, 1), cls: 'gt-m' }, { k: 'moddiv', l: mt('Modeled divorces'), fmt: v => N(v, 0), cls: 'gt-m' }, { k: 'cap', l: mt('Filed / modeled'), fmt: v => N(v, 2), cls: 'gt-m' }, { k: 'di', l: mt('Index'), fmt: v => N(v, 0), cls: 'gt-m' }, { k: 'esi', l: mt('Shock'), fmt: v => N(v, 0), cls: 'gt-m' }, { k: 'grade', l: 'Grade', fmt: v => gb(v) }
    ];
    const coRows = CTY.map(c => ({ _id: c.fips, fips: c.fips, name: c.name, metro: c.msa_title ? MNAME(c.msa_title) : 'non metro', pop: c.pop2025, married: c.acs.married, cv: c.acs.married_cv, div: c.filings.ttm.div, rate: c.rates.div_per_1k_married, divk: c.filings.ttm.div_k, sapcr: c.filings.ttm.sapcr, po: c.filings.ttm.po, me: (c.filings.ttm.mod || 0) + (c.filings.ttm.enf || 0), sep: c.acs.sep_per_1k_married, divd: c.acs.divorced_sh15, ur: c.laus ? c.laus.ur : null, claims: c.econ.claims_per_1k_lf_13w, warn: ((c.warn || {}).last12 || {}).workers || 0, rem: c.dfps && c.dfps.removals ? c.dfps.removals['2025'] : null, off: G.offices(c), fpo: c.rates.filings_per_lawoffice, haz: c.risk.haz_pred, moddiv: G.modeled(c), cap: G.capture(c), di: c.di, esi: c.esi, grade: c.grade, settle: G.settle(c), ttm: c.filings.ttm_label }));
    const coT = table(R('#gtCoT'), { cols: coCols, rows: coRows, sort: { k: 'div', dir: -1 }, onRow: id => selectCounty(id, { scroll: true }), selected: st.sel, caption: 'Texas counties, observed then modeled' });
    /* ---------- cities ---------- */
    let ciT = null;
    function ciCountyOpts() { const cs = CTY.filter(c => ZC.some(z => z.county === c.fips) && (!st.cityMetro || c.msa === st.cityMetro)).sort((a, b) => a.name.localeCompare(b.name)); if (st.cityCty && !cs.some(c => c.fips === st.cityCty)) st.cityCty = ''; R('#gtCiCty').innerHTML = [['', 'All counties']].concat(cs.map(c => [c.fips, c.name])).map(o => `<option value="${o[0]}"${o[0] === st.cityCty ? ' selected' : ''}>${esc(o[1])}</option>`).join(''); }
    const ciCols = [{ k: 'city', l: 'City', fmt: v => esc(v) }, { k: 'countyName', l: 'County', fmt: v => esc(v), cls: 'l' }, { k: 'metro', l: 'Metro', fmt: v => esc(v), cls: 'l wrap' }, { k: 'n', l: 'ZIPs', fmt: v => N(v) }, { k: 'married', l: 'Married', fmt: v => N(v) }, { k: 'div', l: mt('Allocated divorces'), fmt: v => N(v, 0), cls: 'gt-m' }, { k: 'divRate', l: mt('per 1k married'), fmt: v => N(v, 1), cls: 'gt-m' }, { k: 'priv', l: mt('Allocated private'), fmt: v => N(v, 0), cls: 'gt-m' }, { k: 'offices', l: 'Law offices', fmt: v => v ? N(v) : 'none' }, { k: 'fpo', l: mt('Private / office'), fmt: (v, r) => r.offices ? N(v, 1) : 'no office', cls: 'gt-m' }, { k: 'di', l: mt('Index'), fmt: v => N(v, 0), cls: 'gt-m' }, { k: 'haz', l: mt('Hazard'), fmt: v => N(v, 1), cls: 'gt-m' }];
    const ciRows = () => cities.filter(c => (!st.cityMetro || c.msa === st.cityMetro) && (!st.cityCty || c.county === st.cityCty)).map(c => Object.assign({ _id: c.key, metro: MNAME(MSA[c.msa].title), countyName: cname(c.county) }, c));
    function renderCities() { const rows = ciRows(); R('#gtCiN').textContent = `${N(rows.length)} cit${rows.length === 1 ? 'y' : 'ies'}, ${N(sum(rows.map(r => r.n)))} ZIPs`; if (!ciT) ciT = table(R('#gtCiT'), { cols: ciCols, rows, sort: { k: 'married', dir: -1 }, onRow: id => selectCity(id), selected: st.pick && st.pick.kind === 'city' ? st.pick.key : null, caption: 'Cities rolled up from ZIPs' }); else ciT.setRows(rows); }
    /* ---------- gradient ---------- */
    function renderGradient() {
      const gr = G.gradient(CTY);
      R('#gtGrad').innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t"><caption class="vh">Settlement gradient, married weighted means</caption><thead><tr><th scope="col">Class</th><th scope="col">Counties</th><th scope="col">Married adults</th><th scope="col">Divorces /1k married</th><th scope="col">Separated /1k</th><th scope="col">Hazard</th><th scope="col">Married couple families with kids</th><th scope="col">Shock index</th><th scope="col">Offices /10k residents</th><th scope="col">Filings / office</th><th scope="col">Counties with no office</th></tr></thead><tbody>${gr.map(r => `<tr><td>${esc(r.l)}</td><td>${N(r.n)}</td><td>${N(r.married)}</td><td>${N(r.rate, 1)}</td><td>${N(r.sep, 1)}</td><td>${N(r.haz, 1)}</td><td>${P(r.kids, 1)}</td><td>${N(r.esi, 0)}</td><td>${N(r.off10k, 2)}</td><td>${N(r.fpo, 1)}</td><td>${N(r.noOffice)}</td></tr>`).join('')}</tbody></table></div></div>`;
      const core = gr[0], rur = gr[3];
      R('#gtGrad').insertAdjacentHTML('beforeend', `<p class="small gt-say">Divorces per 1,000 married, separated per 1,000, married couple families with kids, offices and filings per office are observed (filings per office over the counties that have an office); hazard and the shock index are modeled. The core files ${N(core.rate, 1)} divorces per 1,000 married against ${N(rur.rate, 1)} in non metro rural counties, and carries ${N(core.off10k, 2)} law offices per 10,000 residents against ${N(rur.off10k, 2)}: ${N(rur.noOffice)} of the ${N(rur.n)} rural counties have no office in the Census count.</p>`);
    }
    /* ---------- hot spots and deserts ---------- */
    let hz = null, hc = null;
    const distCell = k => isN(k) ? `${N(k, 1)} km<span class="gt-vin">${N(k * G.KM_MI, 1)} mi</span>` : NA;
    function renderHot() {
      hz = hz || G.hotZips(ZC); hc = hc || G.hotCounties(CTY);
      const hhZ = hz.filter(r => r.sig && r.quad === 'HH').sort((a, b) => b.v - a.v); const hhC = hc.filter(r => r.sig && r.quad === 'HH').sort((a, b) => b.v - a.v);
      const byM = {}; hhZ.forEach(r => { (byM[r.it.msa] = byM[r.it.msa] || []).push(r.it); });
      const desRows = des.slice(0, 25);
      R('#gtHot').innerHTML = `<h4 class="gt-h4">Dissolution hot spots</h4><p class="small">${N(hhC.length)} counties and ${N(hhZ.length)} ZIPs sit in a high cluster: a high index among high neighbors at p below 0.05. Buy a radius around a cluster rather than a single ZIP.</p>
        <div class="gt-tags">${hhC.slice(0, 24).map(r => `<button type="button" class="gt-tag" data-cty="${r.it.fips}">${esc(r.it.name)} <span>${N(r.v, 0)}</span></button>`).join('') || '<span class="small">No county cluster at this threshold.</span>'}</div>
        <div class="gt-hz">${Object.keys(byM).sort((a, b) => byM[b].length - byM[a].length).slice(0, 6).map(m => `<div><b>${esc(MNAME(MSA[m].title))}</b> <span class="small">${N(byM[m].length)} ZIPs</span><div class="gt-tags">${byM[m].slice(0, 12).map(z => `<button type="button" class="gt-tag" data-zip="${z.zip}" title="${esc(z.city || '')}">${z.zip} <span>${esc(z.city || '')}</span></button>`).join('')}</div></div>`).join('') || '<p class="small">No ZIP cluster at this threshold.</p>'}</div>
`;
      R('#gtDes').innerHTML = `<h4 class="gt-h4">${N(des.length)} ZIPs</h4><p class="small">ZIPs with 1,500 or more married adults and no law office in ZIP Business Patterns 2023, largest first, with the straight line distance between ZIP centers to the nearest ZIP that has one, in kilometers and miles. Only the ${N(ZC.length)} metro ZIPs carry data, so an office just outside a metro is missed and the distance is an upper bound.</p>
        <div class="tblbox"><div class="tblwrap gt-short"><table class="t"><caption class="vh">Legal deserts</caption><thead><tr><th scope="col">ZIP</th><th scope="col" class="l">City</th><th scope="col">Married</th><th scope="col">Allocated divorces</th><th scope="col">Nearest office ZIP</th><th scope="col">Distance</th></tr></thead><tbody>${desRows.map(d => `<tr><td><button type="button" class="linkbtn" data-zip="${d.z.zip}">${d.z.zip}</button></td><td class="l">${esc(d.z.city || '')}</td><td>${N(d.z.acs.married)}</td><td>${N(d.z.alloc.div, 0)}</td><td>${d.near ? esc(d.near.zip + ' ' + (d.near.city || '')) : NA}</td><td>${distCell(d.km)}</td></tr>`).join('')}</tbody></table></div></div>${des.length > desRows.length ? `<p class="small">Showing ${desRows.length} of ${N(des.length)}; the Deserts CSV carries all of them.</p>` : ''}
        <h4 class="gt-h4">${N(bare.length)} counties with no law office</h4><p class="small">No offices of lawyers in County Business Patterns 2023. Distance is between county centers to the nearest county with one.</p>
        <div class="tblbox"><div class="tblwrap gt-short"><table class="t"><caption class="vh">Counties with no law office</caption><thead><tr><th scope="col">County</th><th scope="col">Married</th><th scope="col">Divorces filed</th><th scope="col">Nearest county with an office</th><th scope="col">Distance</th></tr></thead><tbody>${bare.map(d => `<tr><td><button type="button" class="linkbtn" data-cty="${d.c.fips}">${esc(d.c.name)}</button></td><td>${N(d.c.acs.married)}</td><td>${N(d.c.filings.ttm.div)}</td><td>${d.near ? esc(d.near.name) : NA}</td><td>${distCell(d.km)}</td></tr>`).join('')}</tbody></table></div></div>
        <p class="small gt-say"><b>Caveat.</b> Business Patterns count establishments with paid employees. A lawyer practicing alone without staff is not in them, so a desert is a gap in the Census count, not proof that no lawyer serves the area. Check the State Bar directory before siting an office.</p>`;
      $$('#gtHot [data-cty], #gtDes [data-cty]', root).forEach(b => b.onclick = () => selectCounty(b.dataset.cty, { scroll: true }));
      $$('#gtHot [data-zip], #gtDes [data-zip]', root).forEach(b => b.onclick = () => { const z = ZI[b.dataset.zip]; if (!z) return; st.view = 'zip'; st.metro = z.msa; st.pick = null; st.box = null; syncView(); draw(); selectZip(z.zip); R('#gtMapPanel').scrollIntoView({ block: 'start' }); });
    }
    /* ---------- headlines ---------- */
    function renderHead() {
      R('#gtHead').value = st.head; const rows = G.headline(st.head);
      R('#gtHl').innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t"><caption class="vh">Headline figures, ${esc(G.areaName(st.head))}</caption><thead><tr><th scope="col">Figure</th><th scope="col">${esc(G.areaName(st.head))}</th><th scope="col" class="l">Source</th><th scope="col" class="l">Vintage</th><th scope="col">Grade</th></tr></thead><tbody>${rows.map(r => `<tr><td class="wrap">${esc(r[0])}</td><td><b>${esc(r[2](r[1]))}</b></td><td class="l wrap">${esc(r[3])}</td><td class="l">${esc(r[4])}</td><td>${gb(r[5])}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    /* ---------- the filing record and where the year stands ---------- */
    const SNAME = { div: 'Divorce', div_k: 'Divorce with children', sapcr: 'Custody (SAPCR)', po: 'Protective orders', mod: 'Modification', enf: 'Enforcement', ivd: 'Title IV-D', priv: 'Private family law', d_div: 'Divorces disposed' };
    const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
    function renderRecord() {
      R('#gtRec').value = st.rec; const s = G.areaSeries(st.rec); const nm = G.areaName(st.rec);
      if (!s) { R('#gtRecC').innerHTML = '<p class="small">No monthly series for this area.</p>'; R('#gtRecN').textContent = ''; R('#gtYtd').innerHTML = ''; return; }
      const r = G.sameMonths(s.div, s.t0); const M = r.month; const span = M === 11 ? 'the full year' : `January to ${MOL[M]}`; const cur = r.years.find(y => y.y === r.last);
      const mx = Math.max(...r.years.map(y => Math.max(y.full || 0, y.ytd || 0)), 1);
      R('#gtRecS').innerHTML = `Divorces filed in ${esc(nm)} by calendar year, ${r.years[0].y} to ${r.last}. The light bar is the full year; the dark bar is ${esc(span)} of every year, so ${r.last} compares on the same months. The dashed line marks ${r.years[0].y} on that basis. Office of Court Administration ${gb('A')}`;
      const y19 = r.years.find(y => y.y === 2019) || r.years[0];
      R('#gtRecC').innerHTML = `<div class="gt-bars" role="table" aria-label="Divorces filed by year, ${esc(nm)}"><div class="gt-br gt-bh" role="row"><span role="columnheader">Year</span><span role="columnheader">Full year and same months</span><span role="columnheader">${esc(span)}</span></div>${r.years.map(y => `<div class="gt-br${y.y === r.last ? ' gt-cur' : ''}" role="row"><span role="cell">${y.y}</span><span class="gt-trk" role="cell"><span class="gt-full" style="width:${(100 * (y.full || 0) / mx).toFixed(2)}%"></span><span class="gt-ytd" style="width:${(100 * (y.ytd || 0) / mx).toFixed(2)}%"></span><span class="gt-base" style="left:${(100 * (y19.ytd || 0) / mx).toFixed(2)}%"></span><span class="vh">full year ${isN(y.full) ? N(y.full) : 'not complete'}</span></span><span role="cell"><b>${N(y.ytd)}</b><span class="small">${isN(y.full) ? ' of ' + N(y.full) : ' so far'}</span></span></div>`).join('')}</div>`;
      const ranked = r.years.filter(y => isN(y.ytd)).slice().sort((a, b) => b.ytd - a.ytd); const rank = ranked.findIndex(y => y.y === r.last) + 1; const prev = r.years.find(y => y.y === r.last - 1);
      const share = prev && prev.full > 0 ? prev.ytd / prev.full : null; const pace = share ? cur.ytd / share : null; const fulls = r.years.filter(y => isN(y.full)).map(y => y.full); const paceRank = isN(pace) ? fulls.filter(v => v > pace).length + 1 : null;
      const prov = M >= 1 ? `${MOL[M - 1]} and ${MOL[M]}` : `${MOL[11]} and ${MOL[M]}`;
      R('#gtRecN').innerHTML = `Through ${esc(MOL[M])}, ${esc(nm)} had <b>${N(cur.ytd)}</b> divorce filings in ${r.last}, <b>${rank === 1 ? 'the highest' : rank === ranked.length ? 'the lowest' : 'the ' + ord(rank) + ' highest'}</b> of the ${ranked.length} years on the same months basis: ${esc(updown(prev && prev.ytd ? (cur.ytd / prev.ytd - 1) * 100 : null))} on ${r.last - 1} and ${esc(updown(y19.ytd ? (cur.ytd / y19.ytd - 1) * 100 : null))} on ${y19.y}. The highest for these months is ${ranked[0].y} (${N(ranked[0].ytd)}).${isN(pace) ? ` If the rest of ${r.last} follows ${r.last - 1}'s seasonal shape (${esc(span)} held ${P(share, 1)} of ${r.last - 1}), the year ends near ${N(Math.round(pace / 10) * 10)}, which would be the ${ord(paceRank)} highest of the ${fulls.length + 1} full years; a projection, grade ${gb('C')}.` : ''} ${esc(prov)} are provisional and rise as late clerk reports arrive.`;
      // where the year stands, by case type
      const ys = G.yearStands(s, 2019); const ex = G.extremes(s.div, s.t0, 2);
      R('#gtYtdS').innerHTML = `${esc(nm)}, ${esc(span)} ${r.last} against the same months of ${r.last - 1} and of 2019, by case type. Office of Court Administration ${gb('A')}`;
      R('#gtYtd').innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t"><caption class="vh">Year to date by case type</caption><thead><tr><th scope="col">Case type</th><th scope="col">${r.last}</th><th scope="col">${r.last - 1}</th><th scope="col">Change</th><th scope="col">2019</th><th scope="col">Change</th></tr></thead><tbody>${ys.map(x => `<tr><td>${esc(SNAME[x.k] || x.k)}</td><td><b>${N(x.now)}</b></td><td>${N(x.prev)}</td><td>${sgn(x.vsPrev)}</td><td>${N(x.base)}</td><td>${sgn(x.vsBase)}</td></tr>`).join('')}</tbody></table></div></div>` +
        (ex ? `<p class="small gt-say">The highest month of divorce filings on record here is ${esc(tLabel(ex.hi.t))} (${N(ex.hi.v)}) and the lowest ${esc(tLabel(ex.lo.t))} (${N(ex.lo.v)}), leaving out the two provisional months. Title IV-D counts changed with Attorney General reporting after 2019 and are floors.</p>` : '');
    }
    /* ---------- survey precision ---------- */
    const GL = k => { const m = String(k).match(/^(age|dur)_(\d+)(?:-(\d+)|(\+))$/); if (m) return (m[1] === 'age' ? 'Age ' : 'Married ') + m[2] + (m[4] ? ' and over' : ' to ' + m[3]) + (m[1] === 'dur' ? ' years' : ''); const T = { all: 'All married Texans', times_1: 'First marriage', times_2: 'Second marriage', 'times_3+': 'Third or later marriage', edu_lt_hs: 'Less than high school', edu_hs: 'High school', edu_some_college: 'Some college', edu_bachelors: 'Bachelor\'s degree', edu_graduate: 'Graduate degree', emp_employed: 'Employed', emp_unemployed: 'Unemployed', emp_nilf: 'Not in the labor force', emp_armed: 'Armed forces', spemp_employed: 'Spouse employed', spemp_unemployed: 'Spouse unemployed', spemp_nilf: 'Spouse not in the labor force', spemp_armed: 'Spouse in the armed forces', any_unemp: 'Self or spouse unemployed', no_unemp: 'Neither unemployed', kids: 'Children at home', nokids: 'No children at home', renter: 'Renters', owner: 'Owners', wife_more: 'Wife earns more', husband_more: 'Husband earns more', mil_active: 'Active duty in the household', veteran: 'Veteran', civilian: 'Civilian', long_commute: 'Commute of 45 minutes or more', short_commute: 'Shorter commute', selfemp: 'Self employed', young_mar: 'Married before 23', mar_23plus: 'Married at 23 or later', agegap8: 'Spouses 8 or more years apart', inc_lt35k: 'Household income under $35,000', inc_35_60k: 'Household income $35,000 to $60,000', inc_60_100k: 'Household income $60,000 to $100,000', inc_100_150k: 'Household income $100,000 to $150,000', 'inc_150k+': 'Household income $150,000 or more', female: 'Women', male: 'Men' }; return T[k] || k; };
    const PL = k => k.replace('ldiv', 'Divorce').replace('lpriv', 'Private family').replace('lmod', 'Modification').replace('lenf', 'Enforcement').replace('lpo', 'Protective orders').replace('lsapcr', 'SAPCR').replace('|claims_0_12', ', claims, lags 0 to 12').replace('|claims_0_18', ', claims, lags 0 to 18').replace('|ur_0_12', ', unemployment rate, lags 0 to 12').replace('|post2022', ', 2022 on');
    const TL = x => x === 'cum' ? 'cumulative' : x.replace(/^(lclaims|ur)(?:_l(\d+))?$/, (m, a, l) => 'lag ' + (l || '0'));
    let svyAll = null;
    function svyRows() {
      if (svyAll) return svyAll; const out = []; const metro = z => MSA[z.msa] ? MNAME(MSA[z.msa].title) : '';
      const acsRow = (kind, id, area, msa, est, cv, meas) => { const se = G.acsSE(est, cv); out.push({ _id: kind + ':' + id + ':' + meas, kind, area, msa, measure: meas, est, se, moe: isN(se) ? 1.645 * se : null, cv, n: 'ACS', flag: isN(cv) && cv > 0.3 }); };
      CTY.forEach(c => { acsRow('cty', c.fips, c.name + ' County', c.msa || '', c.acs.married, c.acs.married_cv, 'Married adults'); acsRow('cty', c.fips, c.name + ' County', c.msa || '', c.acs.separated, null, 'Separated adults'); });
      ZC.forEach(z => { const a = z.zip + ' ' + (z.city || ''); acsRow('zip', z.zip, a, z.msa, z.acs.married, z.acs.married_cv, 'Married adults'); acsRow('zip', z.zip, a, z.msa, z.acs.separated, null, 'Separated adults'); });
      Object.keys(D.pums.groups).forEach(k => { const g = D.pums.groups[k]; const cv = g.haz > 0 && isN(g.se) ? g.se / g.haz : null; out.push({ _id: 'pums:' + k, kind: 'pums', area: 'Texas, ' + GL(k), msa: '', measure: 'Divorces per 1,000 married a year', est: g.haz, se: g.se, moe: isN(g.se) ? 1.645 * g.se : null, cv, n: g.n, flag: isN(cv) && cv > 0.3 }); });
      Object.keys(D.panel).filter(k => D.panel[k] && D.panel[k].coefs).forEach(k => { const p = D.panel[k]; Object.keys(p.coefs).forEach(x => { const c = p.coefs[x]; const cv = c.coef ? Math.abs(c.se / c.coef) : null; out.push({ _id: 'panel:' + k + ':' + x, kind: 'panel', area: PL(k), msa: '', measure: 'Elasticity, ' + TL(x), est: c.coef, se: c.se, moe: 1.645 * c.se, cv, n: p.n, p: c.p, flag: isN(cv) && cv > 0.3 }); }); if (isN(p.cum)) { const cv = p.cum ? Math.abs(p.cum_se / p.cum) : null; out.push({ _id: 'panel:' + k + ':cum', kind: 'panel', area: PL(k), msa: '', measure: 'Elasticity, cumulative', est: p.cum, se: p.cum_se, moe: 1.645 * p.cum_se, cv, n: p.n, flag: isN(cv) && cv > 0.3 }); } });
      out.forEach(r => { r.metro = r.msa && MSA[r.msa] ? MNAME(MSA[r.msa].title) : ''; }); return (svyAll = out);
    }
    let svT = null;
    const dec = r => r.kind === 'panel' ? 3 : r.kind === 'pums' ? 2 : 0;
    const svCols = [{ k: 'area', l: 'Area or group', fmt: v => esc(v), cls: 'l' }, { k: 'measure', l: 'Measure', fmt: v => esc(v), cls: 'l wrap' }, { k: 'est', l: 'Estimate', fmt: (v, r) => `<b>${N(v, dec(r))}</b>` }, { k: 'se', l: 'SE', fmt: (v, r) => isN(v) ? N(v, dec(r) + 1) : 'not carried' }, { k: 'moe', l: '± 90%', fmt: (v, r) => isN(v) ? N(v, dec(r) + 1) : 'not carried' }, { k: 'cv', l: 'CV', fmt: v => isN(v) ? P(v, 1) : NA }, { k: 'n', l: 'n or source', fmt: v => esc(isN(v) ? N(v) : v) }, { k: 'flag', l: 'Flag', fmt: v => v ? '<span class="pill p-warn">CV over 30%</span>' : '' }];
    function renderSvy() {
      R('#gtSvy').value = st.svy; R('#gtSvyM').value = st.svyMetro; R('#gtSvyM').disabled = st.svy !== 'zip'; R('#gtSvyM').closest('.ctl').classList.toggle('gt-off', st.svy !== 'zip'); R('#gtSvyF').checked = st.svyFlag;
      const rows = svyRows().filter(r => r.kind === st.svy && (st.svy !== 'zip' || !st.svyMetro || r.msa === st.svyMetro) && (!st.svyFlag || r.flag));
      R('#gtSvyN').textContent = `${N(rows.length)} rows, ${N(rows.filter(r => r.flag).length)} flagged`;
      const o = { cols: svCols, rows, sort: { k: st.svy === 'pums' || st.svy === 'panel' ? 'cv' : 'est', dir: -1 }, limit: 250, caption: 'Survey precision' };
      if (!svT) svT = table(R('#gtSvyT'), o); else svT.setRows(rows);
      const byG = {}; CTY.forEach(c => { byG[c.grade] = (byG[c.grade] || 0) + 1; }); const same = CTY.filter(c => G.gradeRule(c) === c.grade).length;
      R('#gtRule').innerHTML = `<div class="gt-rule"><h4 class="gt-h4">The rule behind the county grades</h4><ul class="gt-list"><li>${gb('A')} 500 or more divorce filings in the year, a monthly court series and a married count CV under 5% (${N(byG.A || 0)} counties)</li><li>${gb('B')} 100 or more filings and a CV under 10% (${N(byG.B || 0)})</li><li>${gb('C')} 25 or more filings and a CV under 20% (${N(byG.C || 0)})</li><li>${gb('D')} the rest (${N(byG.D || 0)})</li></ul><p class="small">Applied to the data in this page, the rule reproduces ${N(same)} of ${N(CTY.length)} county grades. The Census publishes the separated count without a margin in the tables Severance carries, so separated rows read not carried; the PUMS hazards and panel coefficients carry robust and clustered standard errors as fitted (module 20). A coefficient whose CV is above 30% has an interval that may cross zero.</p></div>`;
    }
    /* ---------- constants ---------- */
    function renderConst() {
      const hasL = typeof LINT !== 'undefined' && LINT && typeof LINT.rule === 'function'; const hasM = typeof LINE_META !== 'undefined' && LINE_META;
      const ch = t => hasL && Array.isArray(LINT.CHANGES) ? LINT.CHANGES.find(x => x.title === t) : null;
      R('#gtConst').innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t gt-ct"><caption class="vh">Texas family law constants</caption><thead><tr><th scope="col">Constant</th><th scope="col" class="l">Rule</th><th scope="col" class="l">Citation</th><th scope="col" class="l">Effective</th><th scope="col" class="l">In Severance</th><th scope="col">Grade</th></tr></thead><tbody>${GT_CONST.map(r => { const rl = r.lint && hasL ? LINT.rule(r.lint) : null; const cg = r.change ? ch(r.change) : null; const lm = r.lm && hasM && LINE_META[r.lm] ? LINE_META[r.lm] : null; const ins = [rl ? `compliance rule <b>${esc(rl.id)}</b>` : '', cg ? `changes register, ${esc(/^\d{4}-\d{2}/.test(cg.date) ? fmtDate(cg.date) : cg.date)}` : '', lm ? `${esc(lm.name)} line: ${esc(lm.law)}` : ''].filter(Boolean).join('; ');
        return `<tr><td class="wrap"><b>${esc(r.k)}</b></td><td class="l wrap">${esc(r.v)}${rl && rl.why ? `<span class="gt-why">Screen note: ${esc(rl.why)}</span>` : ''}</td><td class="l wrap"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.cite)}</a></td><td class="l">${esc(/^\d{4}-\d{2}-\d{2}$/.test(r.eff) ? fmtDate(r.eff) : r.eff)}</td><td class="l wrap">${ins || 'not yet in the rule book'}</td><td>${gb(r.g)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    }
    /* ---------- inventory, gates, gaps ---------- */
    const VINT = { oca: 'through ' + fmtDate(META.oca_through), acs: META.acs, pums: META.pums, popest: META.popest, laus: fmtDate(META.laus_through), ui: 'weeks to ' + fmtDate(META.ui_through), warn: 'notices to ' + fmtDate(META.warn_through), qcew: fmtQ(META.qcew_through), live: 'live', '': NA };
    const vint = r => VINT[r[8]] != null ? VINT[r[8]] : r[8];
    const verify = s => esc(s).replace(/\(verify([^)]*)\)/g, '<span class="pill p-warn">verify$1</span>');
    function renderInv() {
      const doms = [...new Set(GT_INV.map(r => r[1].split(' · ')[0]))], accs = [...new Set(GT_INV.map(r => r[5]))];
      const sd = R('#gtDom'), sa = R('#gtAcc'); if (!sd.options.length) { sd.innerHTML = [['', 'All domains']].concat(doms.map(d => [d, d])).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(''); sa.innerHTML = [['', 'All access']].concat(accs.map(d => [d, d])).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(''); }
      if (!doms.includes(st.dom)) st.dom = ''; if (!accs.includes(st.acc)) st.acc = ''; sd.value = st.dom; sa.value = st.acc;
      const rows = GT_INV.filter(r => (!st.dom || r[1].split(' · ')[0] === st.dom) && (!st.acc || r[5] === st.acc)); R('#gtInvN').textContent = `${rows.length} of ${GT_INV.length} sources`;
      R('#gtInv').innerHTML = rows.length ? `<div class="tblbox"><div class="tblwrap"><table class="t gt-inv"><caption class="vh">Texas family law data inventory</caption><thead><tr><th scope="col">ID</th><th scope="col" class="l">Domain</th><th scope="col" class="l">Source and custodian</th><th scope="col" class="l">What it contains</th><th scope="col" class="l">Geography and years</th><th scope="col" class="l">Access</th><th scope="col" class="l">In Severance</th><th scope="col" class="l">Vintage</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r[0])}</b></td><td class="l wrap">${esc(r[1])}</td><td class="l wrap">${verify(r[2])}</td><td class="l wrap">${esc(r[3])}</td><td class="l wrap">${verify(r[4])}</td><td class="l wrap">${pill(r[5], r[5] === 'Public' ? 'p-ok' : r[5] === 'Confidential' ? 'p-block' : 'p-warn')} ${verify(r[6])}</td><td class="l wrap">${esc(r[7])}</td><td class="l">${esc(vint(r))}</td></tr>`).join('')}</tbody></table></div></div>` : '<p class="small">No source matches both filters.</p>';
    }
    R('#gtGates').innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t gt-inv"><caption class="vh">Legal and access gates</caption><thead><tr><th scope="col">Gate</th><th scope="col" class="l">Authority</th><th scope="col" class="l">What it means here</th></tr></thead><tbody>${GT_GATES.map(g => `<tr><td class="wrap"><b>${esc(g[0])}</b></td><td class="l wrap">${verify(g[1])}</td><td class="l wrap">${esc(g[2])}</td></tr>`).join('')}</tbody></table></div></div>`;
    R('#gtGaps').innerHTML = `<ul class="gt-list">${GT_GAPS.map(g => `<li><b>${esc(g[0])}.</b> ${esc(g[1])}</li>`).join('')}</ul>`;
    R('#gtHow').innerHTML = `<p><b>Observed ${gb('A')} to ${gb('B')}.</b> Court counts are the clerks' monthly reports to the Office of Court Administration (${esc(seriesSpan())} for the ${N(CTY.filter(c => c.filings.series).length)} metro counties, annual elsewhere), counted where the case was filed. Census figures are ${esc(META.acs)}; the married count carries its coefficient of variation, and the other survey figures are graded one step below it. Labor figures are TWC and BLS; removals are the DFPS Data Book; offices are County and ZIP Business Patterns 2023.</p><p><b>Modeled ${gb('B')} to ${gb('D')}.</b> The composition hazard applies hazards fitted on ${N(D.pums.n)} married Texans in the microdata to each married population; modeled divorces are that hazard times married adults; the indexes come from modules 01 and 05; ZIP filings are county filings spread by married adults times hazard, so they add up to the clerk count and are never a count themselves; paid efficiency is module 07.</p><p><b>Observed against modeled.</b> Court capture divides divorces filed by modeled divorces. Statewide it is ${N(capTX, 2)}. A county well below 1 has married couples built to divorce who are not filing there; well above 1, filings from outside or a population unlike its survey area.</p><p><b>Distances</b> are straight lines between ZIP centers (or county centers) in kilometers and miles, converted from the map coordinates, good to about 2 km.</p>`;
    R('#gtSrc').innerHTML = `<ul class="srcs">${[['Court filings', 'Office of Court Administration, Court Activity Reporting and Directory System', 'A', 'through ' + fmtDate(META.oca_through), 'https://card.txcourts.gov/'], ['Married, separated, divorced', 'American Community Survey five year estimates', 'A', META.acs, 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/'], ['Hazard model', 'ACS Public Use Microdata Sample, Texas', 'B', META.pums, 'https://www2.census.gov/programs-surveys/acs/data/pums/2024/5-Year/'], ['Unemployment', 'BLS LAUS via Texas Workforce Commission LMI', 'A', fmtDate(META.laus_through), 'https://texaslmi.com/LMIbyCategory/LAUS'], ['Claims', 'Texas Workforce Commission, initial claims by county', 'A', fmtDate(META.ui_through), 'https://texaslmi.com/Home/PopularDownloads'], ['Layoffs', 'TWC WARN notices, Texas Open Data Portal 8w53-c4f6', 'B', fmtDate(META.warn_through), 'https://data.texas.gov/dataset/Worker-Adjustment-and-Retraining-Notification-WARN/8w53-c4f6'], ['Child protection', 'DFPS Data Book, Texas Open Data Portal', 'A', 'FY2016 to FY2025', 'https://data.texas.gov/'], ['Law offices', 'Census County and ZIP Business Patterns, NAICS 541110', 'B', '2023', 'https://www.census.gov/programs-surveys/cbp.html'], ['Population', 'Census Bureau population estimates', 'A', META.popest, 'https://www.census.gov/programs-surveys/popest.html'], ['Statutes', 'Texas Family Code', 'A', 'through the 89th Legislature (2025)', 'https://statutes.capitol.texas.gov/']].map(s => `<li><b>${esc(s[0])}.</b> ${esc(s[1])} ${gb(s[2])} <span class="small">${esc(s[3])}</span> <a href="${esc(s[4])}" target="_blank" rel="noopener">source</a></li>`).join('')}</ul>`;

    /* ---------- exports ---------- */
    R('#gtCoX').onclick = () => {
      const H = [['fips', 'FIPS'], ['name', 'County'], ['metro', 'Metro'], ['settle', 'Settlement class'], ['ttm', 'Court window']].map(x => ({ k: x[0], h: x[1] }))
        .concat([['pop', 'Population 2025 (Census estimates)'], ['married', 'Married adults (ACS)'], ['cv', 'Married adults CV (ACS)'], ['div', 'Divorces filed (OCA)'], ['rate', 'Divorces filed per 1,000 married (OCA, ACS)'], ['divk', 'Divorces filed with children (OCA)'], ['sapcr', 'SAPCR filed (OCA)'], ['po', 'Protective order applications (OCA)'], ['me', 'Modifications and enforcements (OCA)'], ['sep', 'Separated per 1,000 married (ACS)'], ['divd', 'Divorced share of 15 and over (ACS)'], ['ur', 'Unemployment rate % (LAUS)'], ['claims', 'Initial claims last 13 weeks per 1,000 labor force (TWC)'], ['warn', 'WARN workers last 12 months (TWC)'], ['rem', 'CPS removals FY2025 (DFPS)'], ['off', 'Law offices (CBP 2023)'], ['fpo', 'Private family filings per law office (OCA, CBP)']].map(x => ({ k: x[0], h: 'observed: ' + x[1] })))
        .concat([['haz', 'Composition hazard per 1,000 married (PUMS model)'], ['moddiv', 'Modeled divorces a year'], ['cap', 'Divorces filed per modeled divorce'], ['di', 'Dissolution Index'], ['esi', 'Economic Shock Index']].map(x => ({ k: x[0], h: 'modeled: ' + x[1] }))).concat([{ k: 'grade', h: 'Confidence grade' }]);
      const rows = coT.sorted().map(r => H.map(c => { const v = r[c.k]; return isN(v) ? +v.toFixed(c.k === 'cv' ? 4 : 3) : v == null ? '' : v; }));
      saveFile(expName('ground_counties', 'texas'), toCSV(H.map(c => c.h), rows, `Severance, module 28 Ground Truth, compiled ${META.compiled}. Columns headed observed: are counts and surveys (OCA court activity through ${META.oca_through}, ${META.acs}, LAUS, TWC claims and WARN, DFPS, CBP 2023); modeled: are Severance's arithmetic (hazard model on ${META.pums}, indexes).\nCourt window: trailing 12 months for the metro counties, calendar 2025 elsewhere; counted in the county of the court. Grades A to D: module 20.`));
    };
    R('#gtCiX').onclick = () => { const rows = ciT ? ciT.sorted() : ciRows(); const H = ['City', 'Metro', 'Primary county', 'Counties', 'ZIPs', 'ZIP list', 'observed: Married adults (ACS)', 'observed: Law offices (ZBP 2023)', 'modeled: Allocated divorce filings a year', 'modeled: Allocated divorces per 1,000 married', 'modeled: Allocated private family filings a year', 'modeled: Allocated private filings per law office', 'modeled: ZIP index, married weighted', 'modeled: Hazard per 1,000 married, married weighted'];
      saveFile(expName('ground_cities', st.cityCty ? cname(st.cityCty) : st.cityMetro ? MNAME(MSA[st.cityMetro].title) : 'texas'), toCSV(H, rows.map(c => [c.city, MNAME(MSA[c.msa].title), cname(c.county), c.counties.map(cname).join('; '), c.n, c.zips.join(' '), c.married, c.offices, +c.div.toFixed(1), isN(c.divRate) ? +c.divRate.toFixed(2) : '', +c.priv.toFixed(1), isN(c.fpo) ? +c.fpo.toFixed(2) : '', isN(c.di) ? +c.di.toFixed(1) : '', isN(c.haz) ? +c.haz.toFixed(2) : '']), `Severance, module 28 Ground Truth, compiled ${META.compiled}. ZIPs rolled up by postal city inside each metro; a city is listed under the county holding most of its married adults. ZIP filings are allocations of county filings, not counts.`)); };
    R('#gtHlX').onclick = () => { const areas = ['tx'].concat(metroOpts.map(k => 'msa:' + k), CTY.map(c => 'cty:' + c.fips)); const rows = []; areas.forEach(a => G.headline(a).forEach(r => rows.push([G.areaName(a), a, r[0], isN(r[1]) ? +r[1].toFixed(4) : r[1], r[3], r[4], r[5]])));
      saveFile(expName('ground_headlines', 'texas'), toCSV(['Area', 'Area key', 'Figure', 'Value', 'Source', 'Vintage', 'Grade'], rows, `Severance, module 28 Ground Truth, compiled ${META.compiled}. Every figure Severance states for Texas, each metro and each county.`)); };
    R('#gtSvyX').onclick = () => { const rows = svyRows(); saveFile(expName('ground_survey_precision', 'texas'), toCSV(['Kind', 'Area or group', 'Metro', 'Measure', 'Estimate', 'SE', 'MOE 90%', 'CV', 'n or source', 'p', 'CV over 30%'], rows.map(r => [r.kind, r.area, r.metro, r.measure, isN(r.est) ? +r.est.toFixed(4) : '', isN(r.se) ? +r.se.toFixed(5) : '', isN(r.moe) ? +r.moe.toFixed(5) : '', isN(r.cv) ? +r.cv.toFixed(4) : '', r.n, isN(r.p) ? +r.p.toPrecision(3) : '', r.flag ? 'yes' : '']), `Severance, module 28 Ground Truth, compiled ${META.compiled}. ACS: SE = CV x estimate, MOE = 1.645 SE; separated adults carry no margin in the tables Severance holds. PUMS: weighted hazard per 1,000 married with robust SE. Panel: elasticities with SEs clustered by county (module 20).`)); };
    R('#gtInvX').onclick = () => saveFile(expName('ground_data_inventory', 'texas'), toCSV(['ID', 'Domain', 'Source and custodian', 'What it contains', 'Geography and years', 'Access', 'Access detail', 'In Severance', 'Vintage'], GT_INV.map(r => r.slice(0, 8).concat([vint(r)])).concat(GT_GATES.map((g, i) => ['G' + (i + 1), 'Gate', g[0], g[2], '', '', g[1], '', ''])).concat(GT_GAPS.map((g, i) => ['X' + (i + 1), 'Gap', g[0], g[1], '', '', '', 'no public dataset', ''])), `Severance, module 28 Ground Truth, compiled ${META.compiled}. Texas family law data inventory, the legal and access gates (G) and the gaps (X). Citations marked verify were not checked against the live text.`));
    R('#gtDesX').onclick = () => saveFile(expName('ground_legal_deserts', 'texas'), toCSV(['Kind', 'ZIP or FIPS', 'Place', 'County', 'Metro', 'Married adults', 'Law offices', 'Nearest with an office', 'Distance km', 'Distance mi'], des.map(d => ['ZIP', d.z.zip, d.z.city || '', d.z.county_name, MNAME((MSA[d.z.msa] || {}).title || ''), d.z.acs.married, 0, d.near ? d.near.zip : '', isN(d.km) ? +d.km.toFixed(1) : '', isN(d.km) ? +(d.km * G.KM_MI).toFixed(1) : '']).concat(bare.map(d => ['County', d.c.fips, d.c.name + ' County', d.c.name, d.c.msa_title ? MNAME(d.c.msa_title) : 'non metro', d.c.acs.married, 0, d.near ? d.near.name + ' County' : '', isN(d.km) ? +d.km.toFixed(1) : '', isN(d.km) ? +(d.km * G.KM_MI).toFixed(1) : ''])), `Severance, module 28 Ground Truth, compiled ${META.compiled}. ZIPs with 1,500 or more married adults and no law office in ZIP Business Patterns 2023, and counties with none in County Business Patterns 2023. Straight line distances between ZIP (or county) centers; only metro ZIPs carry data, so ZIP distances are an upper bound. Business Patterns miss lawyers with no employees.`));
    /* ---------- handoffs: the selected county's top 30 ZIPs by paid efficiency ---------- */
    function topZips(f) { return ZC.filter(z => z.county === f && isN(z.paid.eff_pct)).sort((a, b) => b.paid.eff_pct - a.paid.eff_pct || a.zip.localeCompare(b.zip)).slice(0, 30).map(z => z.zip); }
    function toDesk() { const f = st.sel; const zips = topZips(f); if (!zips.length) toast(`${cname(f)} County has no ZIP data; the desk receives the county alone`); goModule('desk', zips.length ? { zips, geo: 'cty:' + f } : { geo: 'cty:' + f, counties: [f] }); }
    function toForge() { const f = st.sel; goModule('forge', { counties: [f], zips: topZips(f) }); }
    R('#gtDesk').onclick = toDesk; R('#gtForge').onclick = toForge;

    /* ---------- wiring ---------- */
    wireSeg(R('#gtView'), v => { st.view = v; st.zip = null; if (v === 'zip') { const c = CI[st.sel]; if (c && c.msa && GEO.metros[c.msa] && c.msa !== st.metro) { st.metro = c.msa; st.pick = null; st.box = null; } } else { st.pick = null; st.box = null; } syncView(); draw(); side(); save(); });
    R('#gtMetro').onchange = e => { st.metro = e.target.value; st.pick = null; st.box = null; st.zip = null; draw(); side(); save(); };
    R('#gtLayer').onchange = e => { st.layer = e.target.value; draw(); save(); };
    R('#gtReset').onclick = () => { st.pick = null; st.box = null; st.zip = null; draw(); side(); if (ciT) ciT.setSel(null, true); };
    R('#gtCiMetro').onchange = e => { st.cityMetro = e.target.value; ciCountyOpts(); renderCities(); save(); };
    R('#gtCiCty').onchange = e => { st.cityCty = e.target.value; renderCities(); save(); };
    R('#gtHead').onchange = e => { st.head = e.target.value; renderHead(); save(); };
    R('#gtRec').onchange = e => { st.rec = e.target.value; renderRecord(); save(); };
    R('#gtSvy').onchange = e => { st.svy = e.target.value; renderSvy(); save(); };
    R('#gtSvyM').onchange = e => { st.svyMetro = e.target.value; renderSvy(); save(); };
    R('#gtSvyF').onchange = e => { st.svyFlag = e.target.checked; renderSvy(); save(); };
    R('#gtDom').onchange = e => { st.dom = e.target.value; renderInv(); save(); };
    R('#gtAcc').onchange = e => { st.acc = e.target.value; renderInv(); save(); };

    syncView(); draw(); detail(); side(); ciCountyOpts(); renderCities(); renderGradient(); renderHot(); renderHead(); renderRecord(); renderSvy(); renderConst(); renderInv();
    /* another module hands over a county, a ZIP, a city or a metro: goModule('ground', {county}) or {zip} or {city: 'msa|City'} or {metro} */
    self.receive = p => { if (!p || typeof p !== 'object') return; if (p.zip && ZI[p.zip]) { const z = ZI[p.zip]; st.view = 'zip'; st.metro = z.msa; st.pick = null; st.box = null; syncView(); draw(); selectZip(z.zip); return; } if (p.city && cities.some(c => c.key === p.city)) { selectCity(p.city, { scroll: false }); return; } if (p.metro && MSA[p.metro] && GEO.metros[p.metro]) { st.view = 'zip'; st.metro = p.metro; st.pick = null; st.box = null; syncView(); draw(); side(); } if (p.county && CI[p.county]) selectCounty(p.county, {}); };
    self.sync = () => { const f = store.get('sev.county', st.sel); if (CI[f] && f !== st.sel) selectCounty(f, { from: st.view === 'cty' ? 'map' : 'sync' }); };
  },
  onShow() { if (this.sync) this.sync(); }
});
