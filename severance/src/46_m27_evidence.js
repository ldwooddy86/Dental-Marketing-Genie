'use strict';
/* Module 27: Evidence. The Thermal Atlas module 04 (Demand Drivers) rebuilt for a Texas family law firm: what moves family law filings,
   measured rather than asserted. Divorce filings against unemployment claims month by month, the claims panel elasticities by lag and
   case type, how long Texas marriages last, the hazard model's odds ratios, a county cross section with standardized coefficients and
   Shapley shares, the income gradient, Moran's I and LISA clusters, the thirty signals and the studies behind them, readings for a
   marketer, a data integrity log, method, sources and grades. The statistics live in SEV_STATS (src/13_stats_core.js) and run in this
   browser; every number comes from the embedded data or from that code. */

/* the thirty risk signals of module 04 (SIGNALS), classified for the evidence matrix: category, the direction the signal is expected to
   push demand, the index component it feeds (the formulas in module 20), the Texas estimate behind it (a hazard model term, or the claims
   panel) and the studies in D.lit it rests on. Tiers follow from these at run time (see EV_TIER). */
const EV_SIG = {
  sep: { cat: 'Pipeline', dir: 'Raises divorce filings', idx: 'Separation', tier: 'C' },
  dur59: { cat: 'Marriage composition', dir: 'Raises divorce filings', idx: 'Composition hazard', or: 'durb_5-9' },
  dur01: { cat: 'Marriage composition', dir: 'Raises divorce and premarital work', idx: 'Composition hazard', or: 'durb_0-1' },
  rem: { cat: 'Marriage composition', dir: 'Raises divorce, stepparent and modification work', idx: 'Composition hazard', or: 'timesb_2' },
  young: { cat: 'Marriage composition', dir: 'Raises divorce filings', idx: 'Composition hazard', or: 'young_mar' },
  a2544: { cat: 'Marriage composition', dir: 'Raises divorce with children', idx: 'Family structure', or: 'ageb_65+' },
  hs: { cat: 'Marriage composition', dir: 'Raises divorce filings', idx: 'Composition hazard', or: 'edu_bachelors' },
  unemp: { cat: 'Job loss and the economy', dir: 'Raises a couple\'s divorce risk', idx: 'None (exposure)', lit: ['killewald2016', 'banzhaf2018'] },
  husb: { cat: 'Job loss and the economy', dir: 'Raises a couple\'s divorce risk', idx: 'None (exposure)', lit: ['banzhaf2018', 'charles2004'] },
  wife: { cat: 'Context', dir: 'Weak or absent after 1975', idx: 'None (context)', lit: ['killewald2016'], tier: 'D' },
  dual: { cat: 'Job loss and the economy', dir: 'Makes a filing affordable', idx: 'None (context)', tier: 'C' },
  commute: { cat: 'Context', dir: 'Raises separation (measured after the fact)', idx: 'None (context)', tier: 'D' },
  mil: { cat: 'Marriage composition', dir: 'Raises divorce, military divorce work', idx: 'Composition hazard', or: 'mil_own' },
  vet: { cat: 'Marriage composition', dir: 'Raises divorce, retirement division work', idx: 'Composition hazard', or: 'veteran' },
  cohab: { cat: 'Family structure and custody pools', dir: 'Raises custody, paternity and support suits', idx: 'Family structure', tier: 'C' },
  unmar: { cat: 'Family structure and custody pools', dir: 'Raises paternity, Title IV-D and SAPCR suits later', idx: 'Family structure', tier: 'C' },
  single: { cat: 'Family structure and custody pools', dir: 'Raises modification and enforcement', idx: 'Family structure', tier: 'C' },
  gp: { cat: 'Family structure and custody pools', dir: 'Raises nonparent conservatorship suits', idx: 'Family structure', tier: 'C' },
  rent: { cat: 'Financial strain', dir: 'Mixed: provokes conflict, blocks a filing', idx: 'Financial strain', tier: 'C' },
  mort: { cat: 'Financial strain', dir: 'Raises contested property work', idx: 'Financial strain', tier: 'C' },
  snap: { cat: 'Financial strain', dir: 'Shifts cases toward Title IV-D, fee sensitive', idx: 'Financial strain', tier: 'C' },
  pov: { cat: 'Financial strain', dir: 'Strain on families with children', idx: 'Financial strain', tier: 'C' },
  renter: { cat: 'Context', dir: 'Mixed cause and effect', idx: 'None (context)', tier: 'D' },
  moved: { cat: 'Context', dir: 'Churn: newcomers without a lawyer', idx: 'None (context)', tier: 'D' },
  flfp: { cat: 'Job loss and the economy', dir: 'Lowers the barrier to filing', idx: 'None (context)', tier: 'C' },
  fv: { cat: 'Protection and child welfare', dir: 'Raises protective order demand', idx: 'None (pool)', tier: 'C' },
  cps: { cat: 'Protection and child welfare', dir: 'Raises CPS defense and termination work', idx: 'None (pool)', tier: 'C' },
  ur: { cat: 'Job loss and the economy', dir: 'Lowers filings now, raises them a year later', idx: 'Economic shock', panel: 'ldiv|ur_0_12' },
  urchg: { cat: 'Job loss and the economy', dir: 'Lowers filings now, raises them a year later', idx: 'Economic shock', panel: 'ldiv|ur_0_12' },
  gap: { cat: 'Marriage composition', dir: 'None detected in the Texas fit', idx: 'None (context)', tier: 'D' }
};
/* the studies in D.lit: what they found for this page, and the Severance measure (a county value) that carries the same mechanism */
const EV_LIT = {
  killewald2016: { cat: 'Job loss and the economy', dir: 'Raises a couple\'s divorce risk', tier: 'B', sig: 'unemp', meas: 'Unemployment in the marriage (PUMS couples), module 04' },
  banzhaf2018: { cat: 'Job loss and the economy', dir: 'Raises a couple\'s divorce risk', tier: 'B', sig: 'husb', meas: 'Husband unemployed with children at home (ACS B23007), module 04' },
  charles2004: { cat: 'Job loss and the economy', dir: 'Layoffs raise divorce risk; plant closings do not', tier: 'B', v: c => c.econ.warn_per_1k, meas: 'WARN layoff notices, workers per 1,000 jobs, module 05' },
  schaller2013: { cat: 'Job loss and the economy', dir: 'Higher unemployment defers divorce', tier: 'B', panel: 'ldiv|ur_0_12', meas: 'The county panel on the unemployment rate (this page, other specifications)' },
  wordstream2026: { cat: 'Advertising benchmarks', dir: 'Cost and conversion benchmark', tier: 'C', meas: null },
  localiq2023: { cat: 'Advertising benchmarks', dir: 'Cost and conversion benchmark', tier: 'C', meas: null },
  nchs: { cat: 'Vital statistics', dir: 'Statewide divorce rate trend', tier: 'B', meas: 'The NCHS Texas series, embedded (module 03)' }
};
const EV_TIER = { A: 'A · Texas estimate (hazard model or claims panel, p < 0.05)', B: 'B · Peer reviewed study or official statistics', C: 'C · Pool or exposure measure, or a vendor benchmark', D: 'D · Context, not significant, or as much effect as cause' };
const EV_MEAS = {
  di: { l: 'Dissolution Index', v: c => c.di, f: v => N(v, 0) },
  filing: { l: 'Divorce filings per 1,000 married', v: c => c.rates.div_per_1k_married, f: v => N(v, 1) },
  sep: { l: 'Separated per 1,000 married (index component)', v: c => c.comp_sep, f: v => N(v, 1) },
  haz: { l: 'Composition hazard per 1,000 married', v: c => c.risk.haz_pred, f: v => N(v, 1) },
  esi: { l: 'Economic Shock Index', v: c => c.esi, f: v => N(v, 0) },
  fpo: { l: 'Private family filings per law office', v: c => c.rates.filings_per_lawoffice, f: v => N(v, 1) }
};
const EV_COMP = [['comp_haz', 'Composition hazard'], ['comp_sep', 'Separation'], ['comp_econ', 'Economic shock'], ['comp_struct', 'Family structure'], ['comp_strain', 'Financial strain'], ['comp_supply', 'Supply gap (filings per office)']];

/* two panels on one month axis: a line above (filings), bars below (claims). o: {labels: [t], top: {name, values, color, fmt},
   bot: {name, values, color, fmt, src: i => label}, clip: i => true for months left out of the bar scale, bands: [{i0, i1, label}],
   marks: [{i, label}], title, W, H}. Draws at the container's width and redraws through the shared ResizeObserver. */
function evDualChart(el, o) {
  const bx = chartBox(el, o, o.W || 900, o.H || 400); const W = bx.W, H = bx.H; sizeWatch(el, { fn: evDualChart, o, w: bx.live ? W : 0 });
  const n = o.labels.length, AX = 11.5; const tv = o.top.values, bv = o.bot.values;
  const tMax = Math.max(...tv.filter(isN)); const tTicks = niceTicks(0, tMax * 1.06, 4); const top0 = Math.max(tTicks[tTicks.length - 1], tMax);
  const full = Math.max(...bv.filter(isN)); let bMax = full;
  if (o.clip) { const keep = bv.filter((v, i) => isN(v) && !o.clip(i)); if (keep.length) bMax = Math.min(full, Math.max(...keep) * 1.1); }
  const bTicks = niceTicks(0, bMax, 3).filter(v => v <= bMax); const bot0 = bMax;
  const lt = tTicks.map(o.top.fmt), lb = bTicks.map(o.bot.fmt);
  const m = { l: Math.max(44, Math.round(Math.max(...lt.concat(lb).map(s => textW(s, AX))) + 12)), r: 12, t: 24, b: 24 }; const gap = 36;
  const ph = H - m.t - m.b - gap; const h1 = Math.round(ph * 0.56), h2 = ph - h1; const y1b = m.t + h1, y2t = y1b + gap, y2b = y2t + h2;
  const pw = W - m.l - m.r; const X = i => m.l + (i + 0.5) / n * pw; const bw = Math.max(1, pw / n - (pw / n > 4 ? 1.2 : 0.3));
  const Y1 = v => y1b - v / top0 * h1, Y2 = v => y2b - Math.min(v, bot0) / bot0 * h2;
  const s = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'chart')}">`];
  (o.bands || []).forEach(b => { const x0 = m.l + b.i0 / n * pw, x1 = m.l + (b.i1 + 1) / n * pw; s.push(`<rect x="${x0.toFixed(1)}" y="${m.t}" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${y2b - m.t}" fill="var(--sunk-2)" opacity=".6"></rect>`); if (b.label && textW(b.label, AX) < Math.max(x1 - x0, 0) + (b.room || 0)) s.push(`<text class="ax" x="${(x0 + 3).toFixed(1)}" y="${m.t + 11}">${esc(b.label)}</text>`); });
  o.labels.forEach((t, i) => { if (t % 12 === 0) s.push(`<line class="gridl" x1="${(m.l + i / n * pw).toFixed(1)}" x2="${(m.l + i / n * pw).toFixed(1)}" y1="${m.t}" y2="${y2b}"></line>`); });
  tTicks.forEach((v, i) => s.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y1(v).toFixed(1)}" y2="${Y1(v).toFixed(1)}"></line><text class="ax" x="${m.l - 6}" y="${(Y1(v) + 4).toFixed(1)}" text-anchor="end">${esc(lt[i])}</text>`));
  bTicks.forEach((v, i) => s.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y2(v).toFixed(1)}" y2="${Y2(v).toFixed(1)}"></line><text class="ax" x="${m.l - 6}" y="${(Y2(v) + 4).toFixed(1)}" text-anchor="end">${esc(lb[i])}</text>`));
  let offMax = -1; bv.forEach((v, i) => { if (isN(v) && v > bot0 * 1.0001 && (offMax < 0 || v > bv[offMax])) offMax = i; });
  const offTxt = offMax >= 0 && o.bot.offLabel ? o.bot.offLabel(offMax) : ''; const botTitle = o.bot.name + (offTxt && textW(o.bot.name + ' · ' + offTxt, 12) < pw ? ' · ' + offTxt : '');
  s.push(`<text class="lbl ev-ph" x="${m.l}" y="${m.t - 9}">${esc(o.top.name)}</text><text class="lbl ev-ph" x="${m.l}" y="${y2t - 9}">${esc(botTitle)}</text>`);
  // the line breaks where the series has no value
  const segs = []; let cur = []; tv.forEach((v, i) => { if (isN(v)) cur.push([X(i), Y1(v)]); else if (cur.length) { segs.push(cur); cur = []; } }); if (cur.length) segs.push(cur);
  segs.forEach(sg => { const d = sg.map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(''); s.push(`<path class="ar" d="${d}L${sg[sg.length - 1][0].toFixed(1)},${y1b}L${sg[0][0].toFixed(1)},${y1b}Z" fill="${o.top.color}"></path><path class="ln" d="${d}" stroke="${o.top.color}"></path>`); });
  s.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${y1b}" y2="${y1b}" style="stroke:var(--line-strong)"></line><line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${y2b}" y2="${y2b}" style="stroke:var(--line-strong)"></line>`);
  bv.forEach((v, i) => { if (!isN(v)) return; const y = Y2(v); s.push(`<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, y2b - y).toFixed(1)}" fill="${o.bot.color}"></rect>`); if (v > bot0 * 1.0001) s.push(`<line x1="${(X(i) - bw / 2 - 1).toFixed(1)}" x2="${(X(i) + bw / 2 + 1).toFixed(1)}" y1="${(y2t + 6).toFixed(1)}" y2="${(y2t + 3).toFixed(1)}" style="stroke:var(--card);stroke-width:2"></line>`); });
  (o.marks || []).forEach(mk => { if (!isN(tv[mk.i])) return; const x = X(mk.i), y = Y1(tv[mk.i]); const right = x + 8 + textW(mk.label, 12) < W - m.r; s.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${o.top.color}" stroke="var(--card)" stroke-width="1.5"></circle><text class="lbl" x="${(right ? x + 8 : x - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}">${esc(mk.label)}</text>`); });
  // x labels: years, thinned until they fit
  let yrs = o.labels.map((t, i) => (t % 12 === 0 ? i : null)).filter(v => v != null); const room = pw / Math.max(1, yrs.length); if (room < 40) { const k = Math.ceil(40 / room); yrs = yrs.filter((v, j) => j % k === 0); }
  yrs.forEach(i => s.push(`<text class="ax" x="${(m.l + (i + 6) / n * pw).toFixed(1)}" y="${H - 6}" text-anchor="middle">${Math.floor(o.labels[i] / 12)}</text>`));
  s.push(`<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${y2b}"></line><rect class="ev-hit" x="${m.l}" y="${m.t}" width="${pw}" height="${y2b - m.t}" fill="transparent"></rect></svg>`);
  el.innerHTML = s.join('');
  const svg = el.querySelector('svg'), xh = svg.querySelector('.xh');
  svg.addEventListener('mousemove', e => { const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; if (px < m.l || px > W - m.r) { hideTip(); xh.style.display = 'none'; return; } const i = clamp(Math.floor((px - m.l) / pw * n), 0, n - 1); xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.style.display = 'block'; showTip(`<b>${esc(tLabel(o.labels[i]))}</b><div class="row"><span>${esc(o.top.name)}</span><span>${esc(isN(tv[i]) ? o.top.fmtTip(tv[i]) : 'not yet reported')}</span></div><div class="row"><span>${esc(o.bot.src ? o.bot.src(i) : o.bot.name)}</span><span>${esc(isN(bv[i]) ? o.bot.fmtTip(bv[i]) : 'n/a')}</span></div>`, e.clientX, e.clientY); });
  svg.addEventListener('mouseleave', () => { hideTip(); xh.style.display = 'none'; });
}
/* survival curves with bands. o: {series: [{name, color, pts: [{t, s, lo, hi}]}], band, title, W, H} */
function evSurvChart(el, o) {
  const bx = chartBox(el, o, o.W || 640, o.H || 300); const W = bx.W, H = bx.H; sizeWatch(el, { fn: evSurvChart, o, w: bx.live ? W : 0 });
  const AX = 11.5; const all = o.series.flatMap(sr => sr.pts.map(p => (o.band ? p.lo : p.s))); const lo = Math.max(0, Math.floor(Math.min(...all) * 10 - 0.5) / 10);
  const yt = niceTicks(lo, 1, 5).filter(v => v >= lo - 1e-9 && v <= 1 + 1e-9); const yl = yt.map(v => P(v, 0));
  const m = { l: Math.max(40, Math.round(Math.max(...yl.map(t => textW(t, AX))) + 12)), r: 14, t: 12, b: 40 };
  const tmax = Math.max(...o.series.flatMap(sr => sr.pts.map(p => p.t))); const X = t => m.l + t / tmax * (W - m.l - m.r), Y = v => m.t + (1 - (v - lo) / (1 - lo)) * (H - m.t - m.b);
  const s = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'survival curves')}">`];
  yt.forEach((v, i) => s.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"></line><text class="ax" x="${m.l - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(yl[i])}</text>`));
  let xt = niceTicks(0, tmax, 8).filter(v => v <= tmax); if ((W - m.l - m.r) / xt.length < 34) xt = xt.filter((v, i) => i % 2 === 0);
  xt.forEach(v => s.push(`<text class="ax" x="${X(v).toFixed(1)}" y="${H - 22}" text-anchor="middle">${v}</text>`));
  s.push(`<text class="ax" x="${(m.l + (W - m.l - m.r) / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">Years since the wedding</text>`);
  if (lo < 0.5) s.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0.5).toFixed(1)}" y2="${Y(0.5).toFixed(1)}" style="stroke:var(--ink-3);stroke-dasharray:3 4"></line>`);
  if (o.band) o.series.forEach(sr => { const up = sr.pts.map(p => X(p.t).toFixed(1) + ',' + Y(p.hi).toFixed(1)); const dn = sr.pts.slice().reverse().map(p => X(p.t).toFixed(1) + ',' + Y(p.lo).toFixed(1)); s.push(`<path d="M${up.join('L')}L${dn.join('L')}Z" fill="${sr.color}" opacity=".16"></path>`); });
  o.series.forEach(sr => { const d = sr.pts.map((p, j) => (j ? 'L' : 'M') + X(p.t).toFixed(1) + ',' + Y(p.s).toFixed(1)).join(''); s.push(`<path class="ln" d="${d}" stroke="${sr.color}"${sr.dash ? ' stroke-dasharray="5 4"' : ''}></path>`); });
  s.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(lo).toFixed(1)}" y2="${Y(lo).toFixed(1)}" style="stroke:var(--line-strong)"></line><line class="xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}"></line></svg>`);
  el.innerHTML = s.join('') + (o.series.length > 1 ? `<div class="legendc">${o.series.map(sr => `<span><i style="background:${sr.color}"></i>${esc(sr.name)}</span>`).join('')}</div>` : '');
  const svg = el.querySelector('svg'), xh = svg.querySelector('.xh');
  svg.addEventListener('mousemove', e => { const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; if (px < m.l || px > W - m.r) { hideTip(); xh.style.display = 'none'; return; } const t = clamp(Math.round((px - m.l) / (W - m.l - m.r) * tmax), 0, tmax); xh.setAttribute('x1', X(t)); xh.setAttribute('x2', X(t)); xh.style.display = 'block'; showTip(`<b>${t} year${t === 1 ? '' : 's'} after the wedding</b>${o.series.map(sr => { const p = sr.pts.find(q => q.t === t); return p ? `<div class="row"><span><i style="display:inline-block;width:8px;height:8px;background:${sr.color};margin-right:6px"></i>${esc(sr.name)}</span><span>${P(p.s, 1)} still married</span></div>` : ''; }).join('')}${o.band ? '<div class="small">Band: 95% interval from the survey standard errors</div>' : ''}`, e.clientX, e.clientY); });
  svg.addEventListener('mouseleave', () => { hideTip(); xh.style.display = 'none'; });
}

registerModule({
  key: 'evidence', num: '27', title: 'Evidence', desc: 'What moves Texas family law filings, measured: claims and filings by lag, marriage survival, the hazard model, county regressions, the income gradient, clusters and the signal matrix',
  mount(root) {
    const SS = SEV_STATS; const PR = D.panel; const P12 = PR['ldiv|claims_0_12'], PP = PR['ldiv|claims_0_12|post2022']; const OR = D.pums.coefs, G = D.pums.groups;
    const ui0 = store.get('sev.evidence.ui', {}) || {};
    const st = Object.assign({ lag: 0, clip: true, units: 'dbl', samp: 'both', elOut: 'ldiv', grp: 'all', band: true, regY: 'log', regS: 'all', regFE: 'msa', regSE: 'HC3', regW: 'none', regX: EV_COMP.map(c => c[0]), cm: 'pearson', incY: 'cap', incS: 'abc', incSel: null, lm: 'di', lw: 'queen', la: '0.05', lSel: store.get('sev.county', '48201'), mxQ: '', mxCat: '', mxStr: '', mxTier: '', mxKind: '', mxMeas: false }, ui0);
    // a saved setting that no longer names an option falls back to the default
    const OK = { lag: [0, 3, 6, 12], units: ['dbl', 'el'], samp: ['both', 'full', 'post'], elOut: ['ldiv', 'lpriv', 'lpo', 'lsapcr', 'lmod', 'lenf'], grp: ['all', 'order', 'edu', 'agemar'], regY: ['log', 'lvl'], regS: ['all', 'abc', 'ab'], regFE: ['msa', 'metro', 'none'], regSE: ['HC3', 'classic'], regW: ['none', 'sqrt'], cm: ['pearson', 'spearman'], incY: ['cap', 'sep'], incS: ['all', 'abc', 'ab'], lm: Object.keys(EV_MEAS), lw: ['queen', 'knn'], la: ['0.05', '0.01'], mxStr: ['', 'Strong', 'Moderate', 'Weak', 'n/a'], mxTier: ['', 'A', 'B', 'C', 'D'], mxKind: ['', 'signal', 'study'] };
    const DEF = { lag: 0, units: 'dbl', samp: 'both', elOut: 'ldiv', grp: 'all', regY: 'log', regS: 'all', regFE: 'msa', regSE: 'HC3', regW: 'none', cm: 'pearson', incY: 'cap', incS: 'abc', lm: 'di', lw: 'queen', la: '0.05', mxStr: '', mxTier: '', mxKind: '' };
    Object.keys(OK).forEach(k => { if (!OK[k].includes(st[k])) st[k] = DEF[k]; });
    st.regX = Array.isArray(st.regX) ? st.regX.filter(k => EV_COMP.some(c => c[0] === k)) : EV_COMP.map(c => c[0]); st.clip = st.clip !== false; st.band = st.band !== false; st.mxMeas = !!st.mxMeas; if (typeof st.mxCat !== 'string') st.mxCat = ''; if (!CI[st.lSel]) st.lSel = '48201';
    const save = () => store.set('sev.evidence.ui', { lag: st.lag, clip: st.clip, units: st.units, samp: st.samp, elOut: st.elOut, grp: st.grp, band: st.band, regY: st.regY, regS: st.regS, regFE: st.regFE, regSE: st.regSE, regW: st.regW, regX: st.regX, cm: st.cm, incY: st.incY, incS: st.incS, lm: st.lm, lw: st.lw, la: st.la, mxCat: st.mxCat, mxStr: st.mxStr, mxTier: st.mxTier, mxKind: st.mxKind, mxMeas: st.mxMeas });
    // formatting: p values, the effect of a doubling of claims, significance marks, a number with its sign
    const fp = p => !isN(p) ? NA : p < 0.001 ? '< 0.001' : N(p, 3);
    const dbl = b => (Math.pow(2, b) - 1) * 100; const dblSE = (b, se) => Math.LN2 * Math.pow(2, b) * se * 100; const pct1 = b => (Math.exp(b) - 1) * 100;
    const star = p => (isN(p) && p < 0.01 ? '**' : isN(p) && p < 0.05 ? '*' : '');
    const sg = (v, d) => (isN(v) ? (v > 0 ? '+' : '') + MINUS(v.toFixed(d)) : NA);
    const gradeP = p => (isN(p) && p < 0.01 ? 'B' : isN(p) && p < 0.05 ? 'C' : 'D');
    const lnk = (url, text) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);

    /* ---- the monthly pair: statewide divorce filings and Texas initial claims, averaged per week within each month */
    const MS = ST.monthly; const t0 = MS.t0; const nF = MS.div.length; const tLast = t0 + nF - 1;
    const wk = ST.claims.weekly; const w0 = dLocal(ST.claims.week0); const cm = {};
    wk.forEach((v, i) => { const d = new Date(w0.getFullYear(), w0.getMonth(), w0.getDate() + i * 7); const t = d.getFullYear() * 12 + d.getMonth(); (cm[t] = cm[t] || []).push(v); });
    const cT = Object.keys(cm).map(Number).sort((a, b) => a - b); const cFirst = cT[0], cLast = cT[cT.length - 1];
    const claimsM = t => (cm[t] ? sum(cm[t]) / cm[t].length : null); const claimsW = t => (cm[t] ? cm[t].length : 0);
    const filingsM = t => (t >= t0 && t <= tLast ? MS.div[t - t0] : null);
    const iTrough = MS.div.slice(0, 24).reduce((b, v, i, a) => (v < a[b] ? i : b), 0); const tTrough = t0 + iTrough; const tSame19 = tTrough - 12;
    const trough = { t: tTrough, v: filingsM(tTrough), ago: filingsM(tSame19) };
    const seas = ST.seas.div; const seasOrd = seas.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const xc = PR.xcorr_state || {}; const xcBest = Object.keys(xc).reduce((a, b) => (xc[b] > xc[a] ? b : a), '0');
    const peakM = Math.max(...cT.map(claimsM)); const tPeakC = cT.find(t => claimsM(t) === peakM);
    const covid = t => Math.floor(t / 12) === 2020 && t % 12 >= 2;   // March to December 2020 sit outside the claims scale when clipped
    const covidBand = { from: 2020 * 12 + 2, to: 2020 * 12 + 4 };     // March to May 2020, the emergency orders on in person proceedings

    /* ---- median duration of current marriages from the weighted duration bands of the microdata */
    const DB = [['dur_0-1', 0, 2], ['dur_2-4', 2, 5], ['dur_5-9', 5, 10], ['dur_10-14', 10, 15], ['dur_15-19', 15, 20], ['dur_20-29', 20, 30], ['dur_30+', 30, null]].filter(b => G[b[0]]);
    const medDur = SS.medianBands(DB.map(b => ({ lo: b[1], hi: b[2], w: G[b[0]].w })));
    const medIn = (() => { const tot = sum(DB.map(b => G[b[0]].w)); let a = 0; for (const b of DB) { if (a + G[b[0]].w >= tot / 2) return b; a += G[b[0]].w; } return null; })();
    const curve = D.pums.curve.slice().sort((a, b) => a.dur - b.dur); const survAll = SS.survival(curve.map(c => c.haz_per_1000), curve.map(c => c.se));
    const survAt = t => (survAll[t] ? survAll[t].s : null); const medSurv = SS.medianSurvival(survAll); const tEnd = survAll[survAll.length - 1].t;

    root.innerHTML = mastHTML({ eyebrow: 'Module 27 · Evidence · what moves Texas family law filings, measured', title: 'Evidence',
      dek: `What actually moves family law work in Texas, measured rather than asserted: how divorce filings answer a wave of unemployment claims month by month and case type by case type, how long Texas marriages last and who divorces, which forming conditions explain a county's filing rate, how filings and separation track income, where demand clusters across the 254 counties, and how each of the thirty risk signals and the studies behind them hold up. Every statistic here is read from the embedded data or computed in this browser when the page opens.`,
      facts: [[N(stTTM('div')), 'divorce filings statewide, ' + ttmSpan()], [N(P12.n), 'county months in the claims panel'], [N(D.pums.n), 'married Texans in the hazard model'], [String(CTY.length), 'counties in the cluster tests']] }) + `
    ${toolbarHTML('Evidence', 'Time series, elasticities, survival, coefficients, income, clusters, the signal matrix', [{ id: 'evCsvTs', label: '↓ Monthly series CSV' }, { id: 'evCsvEl', label: '↓ Elasticities CSV' }, { id: 'evCsvReg', label: '↓ Regression CSV' }, { id: 'evCsvLisa', label: '↓ Clusters CSV' }, { id: 'evCsvMx', label: '↓ Evidence matrix CSV' }, { id: 'evGoEcon', label: 'Economic Shock ↗' }, { id: 'evGoMkt', label: 'Marriage Market ↗' }, { id: 'evGoSig', label: 'Risk Signals ↗' }])}
    ${callout('', 'Read this first: what this module measures and what it cannot tell you', `<p>It <b>does</b> measure, in public data, the associations a family law marketer leans on: how statewide and county filings move after unemployment claims jump (a county panel with county, month and year fixed effects, the most causal estimate on the page), how long Texas marriages last (a synthetic cohort built from the 2020 to 2024 divorce hazards), who divorces (the Texas hazard model), what explains a county's filing rate (a cross section, descriptive), how filings and separation track income, and whether high and low values cluster in space (Moran's I and local clusters with permutation tests). Each figure carries a grade from A to D, defined in the grades panel at the foot of the page.</p><p>It does <b>not</b> predict whether any couple will divorce, identify a person or a household, or prove cause from a cross section. Every number describes a county, a court, a survey group or a statewide month. The readings for a marketer are ecological: they say where and when to spend, never whom to target.</p>`)}
    <div class="tiles" id="evKpis"></div>
    <div class="panel ev-sec" id="evSecTs"><h3>Divorce filings and unemployment claims, month by month</h3><div class="sub">Statewide divorce filings a month (Office of Court Administration, ${esc(seriesSpan())}) above Texas initial unemployment claims, the average per week in each month (Texas Workforce Commission, weeks ending ${esc(fmtDate(ST.claims.week0))} to ${esc(fmtDate(META.ui_through))}). Same months on both axes; shift the claims forward to line them up with the filings they precede.</div>
      <div class="controls">${ctl('Align claims to filings', sel('evLag', [['0', 'Same month'], ['3', 'Claims 3 months earlier'], ['6', 'Claims 6 months earlier'], ['12', 'Claims 12 months earlier']], String(st.lag)))}<label class="chk"><input type="checkbox" id="evClip"${st.clip ? ' checked' : ''}> Keep the 2020 claims spike off the scale so the rest is readable</label></div>
      <div class="chart" id="evTs"></div><p class="small ev-note" id="evTsN"></p></div>
    <div class="panel ev-sec" id="evSecEl"><h3>How each kind of case answers a claims surge, by lag</h3><div class="sub">Log of monthly filings on log initial claims per 1,000 in the labor force at lags 0, 3, 6, 9 and 12 months, county, calendar month and year fixed effects and a 2020 dummy, 43 counties over 100,000 residents, standard errors clustered by county (D.panel). Full period 2019 to 2026 and the 2022 on sample. * p &lt; 0.05, ** p &lt; 0.01.</div>
      <div class="controls">${ctl('Units', sel('evUnits', [['dbl', 'Percent per doubling of claims'], ['el', 'Elasticity (coefficient)']], st.units))}${ctl('Sample', sel('evSamp', [['both', 'Both samples'], ['full', '2019 to 2026'], ['post', '2022 on']], st.samp))}${ctl('Chart the lags for', sel('evElOut', [['ldiv', 'Divorce'], ['lpriv', 'Private family filings'], ['lpo', 'Protective orders'], ['lsapcr', 'Custody (SAPCR)'], ['lmod', 'Modification'], ['lenf', 'Enforcement']], st.elOut))}</div>
      <div id="evEl"></div><div class="grid2 ev-g"><div><div class="chart" id="evElPlot"></div><p class="small" id="evElPlotN"></p></div><div id="evElCave"></div></div><h4 class="ev-h4">Longer lags and the unemployment rate</h4><div id="evEl2"></div></div>
    <div class="grid2 ev-g"><div class="panel ev-sec" id="evSecSurv"><h3>How long Texas marriages last</h3><div class="sub">Share of marriages not yet ended by divorce, by years since the wedding, if the 2020 to 2024 hazards held for a new marriage (the hazard by single year of marriage from the Texas microdata, D.pums.curve). Widowhood is not counted. The band is the 95% interval from the survey's replicate standard errors.</div>
      <div class="controls">${ctl('Compare', sel('evGrp', [['all', 'All marriages'], ['order', 'By number of marriages'], ['edu', 'By education'], ['agemar', 'By age at marriage']], st.grp))}<label class="chk"><input type="checkbox" id="evBand"${st.band ? ' checked' : ''}> Show the 95% band</label></div>
      <div class="chart" id="evSurv"></div><p class="small ev-note" id="evSurvN"></p></div>
      <div class="panel ev-sec" id="evSecOR"><h3>Who divorces: the Texas hazard model</h3><div class="sub">Odds ratios on a log scale with 95% intervals, weighted logistic regression of divorce in the past year on ${N(D.pums.n)} married Texans (ACS PUMS 2020 to 2024). Reference: age 40 to 44, married 10 to 14 years, first marriage, high school, male, civilian, married at 23 or later. Right of the line raises the odds.</div>
      <div class="chart" id="evOR"></div><div class="legendc" id="evORLeg"></div><details class="ev-det"><summary>The odds ratios as a table</summary><div id="evORT"></div></details></div></div>
    <div class="panel ev-sec" id="evSecReg"><h3>What explains a county's filing rate</h3><div class="sub">A cross section, computed here: the divorce filing rate of each county regressed on the six forming components of the Dissolution Index, with metro fixed effects where a metro has two or more counties in the sample. Standardized coefficients (standard deviations of the outcome per standard deviation of the component) with 95% intervals, and each component's Shapley share of the variation explained beyond the fixed effects.</div>
      <div class="controls">${ctl('Outcome', sel('evRegY', [['log', 'Log of filings per 1,000 married'], ['lvl', 'Filings per 1,000 married']], st.regY))}${ctl('Counties', sel('evRegS', [['all', 'All with complete data'], ['abc', 'Grades A to C'], ['ab', 'Grades A and B']], st.regS))}${ctl('Fixed effects', sel('evRegFE', [['msa', 'Each metro'], ['metro', 'Metro or not'], ['none', 'None']], st.regFE))}${ctl('Standard errors', sel('evRegSE', [['HC3', 'Robust (HC3)'], ['classic', 'Classic']], st.regSE))}${ctl('Weights', sel('evRegW', [['none', 'None'], ['sqrt', 'Square root of population']], st.regW))}</div>
      <fieldset class="ev-fs"><legend>Components in the model</legend>${EV_COMP.map(c => `<label class="chk"><input type="checkbox" data-comp="${c[0]}" id="evRegX_${c[0]}"${st.regX.includes(c[0]) ? ' checked' : ''}> ${esc(c[1])}</label>`).join('')}</fieldset>
      <p class="small" id="evRegSum" role="status" aria-live="polite"></p><div class="chart ev-regplot" id="evRegPlot"></div><div id="evRegTbl"></div>
      <h4 class="ev-h4">How the components move together</h4><div class="controls">${ctl('Correlation', sel('evCm', [['pearson', 'Pearson r'], ['spearman', 'Spearman rank']], st.cm))}</div><div id="evCorr"></div><p class="small" id="evCorrN"></p></div>
    <div class="panel ev-sec" id="evSecInc"><h3>The docket against income</h3><div class="sub">Each dot is a county, sized by married adults and colored by metro. Income is the ACS 2020 to 2024 median household income. Court capture is divorce filings in the trailing year over the divorces the composition model expects (modeled hazard per 1,000 married times married adults over 1,000); separation is separated adults per 1,000 married (ACS). Log scale on the vertical axis; r and the elasticity are on logs.</div>
      <div class="controls">${ctl('Plot', sel('evIncY', [['cap', 'Court capture (filed over modeled)'], ['sep', 'Separated per 1,000 married']], st.incY))}${ctl('Counties', sel('evIncS', [['all', 'All with filings'], ['abc', 'Grades A to C'], ['ab', 'Grades A and B']], st.incS))}</div>
      <div class="chart" id="evInc"></div><div class="catleg" id="evIncLeg"></div><p class="small" id="evIncSel" role="status" aria-live="polite"></p><p class="small ev-note" id="evIncN"></p></div>
    <div class="panel ev-sec" id="evSecLisa"><h3>Clusters, not counties</h3><div class="sub">Global Moran's I with 999 permutations and local clusters (LISA) with 499 conditional permutations, computed here with a fixed seed so every run gives the same answer. Weights: counties that share a border (taken from the map outlines), or each county's six nearest county centers.</div>
      <div class="controls">${ctl('Measure', sel('evLm', Object.keys(EV_MEAS).map(k => [k, EV_MEAS[k].l]), st.lm))}${ctl('Neighbors', sel('evLw', [['queen', 'Shared border'], ['knn', 'Six nearest counties']], st.lw))}${ctl('Significance', sel('evLa', [['0.05', 'p ≤ 0.05'], ['0.01', 'p ≤ 0.01']], st.la))}</div>
      <p class="small" id="evLisaStat" role="status" aria-live="polite"></p>
      <div class="split"><div><div class="mapwrap" id="evLisaMap"></div><div class="catleg" id="evLisaLeg"></div></div><div><div id="evLisaSel" class="small"></div></div></div>
      <h4 class="ev-h4">Moran's I for the six measures</h4><div id="evMoran"></div><p class="small" id="evMoranN"></p></div>
    <div class="panel ev-sec" id="evSecMx"><h3>The evidence matrix</h3><div class="sub">The thirty risk signals of module 04 and the studies in the embedded literature, with the category, the direction each is expected to push demand, its strength and evidence tier, the citation, the Texas note, whether Severance measures it, and its correlation with the divorce filing rate computed here (weighted by the square root of population across the counties graded A or B, the same r the signal cards show).</div>
      <div class="controls"><div class="ctl ev-q"><label for="evMxQ">Search</label><input type="search" id="evMxQ" placeholder="separation, layoff, custody" value="${esc(st.mxQ)}"></div>${ctl('Category', sel('evMxCat', [['', 'All']], ''))}${ctl('Strength', sel('evMxStr', [['', 'Any'], ['Strong', 'Strong'], ['Moderate', 'Moderate'], ['Weak', 'Weak'], ['n/a', 'Not measured as r']], st.mxStr))}${ctl('Tier', sel('evMxTier', [['', 'Any'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']], st.mxTier))}${ctl('Kind', sel('evMxKind', [['', 'Signals and studies'], ['signal', 'Signals'], ['study', 'Studies']], st.mxKind))}<label class="chk"><input type="checkbox" id="evMxMeas"${st.mxMeas ? ' checked' : ''}> measured in Severance</label></div>
      <p class="small" id="evMxN" role="status" aria-live="polite"></p><div id="evMx"></div></div>
    <div class="grid2 ev-g"><div class="panel ev-sec"><h3>What this means for a family law marketer</h3><div class="sub">Each reading cites the number behind it. All of them are about places and months, never about a person.</div><ol class="ev-read" id="evRead"></ol></div>
      <div class="panel ev-sec"><h3>Data integrity log</h3><div class="sub">Problems found in the public files and how each was handled, counted from the data where the data can count them.</div><div id="evInt"></div></div></div>
    <div class="grid2 ev-g"><div class="panel ev-sec"><h3>Method</h3><div class="prose ev-prose" id="evMeth"></div></div><div class="panel ev-sec"><h3>Judgment calls</h3><div class="prose ev-prose" id="evJudg"></div></div></div>
    <div class="grid2 ev-g"><div class="panel ev-sec"><h3>Sources</h3><div id="evSrc"></div></div><div class="panel ev-sec"><h3>Grades</h3><div id="evGrades"></div></div></div>
    <p class="small ev-foot">Severance, module 27. Associations in observational data. The panel elasticities come from within county changes over time and are the closest thing to cause on this page; the cross sections describe where filings are high, not why.</p>`;

    /* ---- KPI tiles */
    const L3 = P12.coefs.lclaims_l3, L12 = P12.coefs.lclaims_l12, L0 = P12.coefs.lclaims;
    $('#evKpis', root).innerHTML = tile('Filings 3 months after a claims surge', sgn(dbl(L3.coef), 1), `divorce filings per doubling of weekly claims, 2019 to 2026 (SE ${N(dblSE(L3.coef, L3.se), 1)} points, p ${fp(L3.p)})`, gradeP(L3.p))
      + tile('Filings 12 months after', sgn(dbl(L12.coef), 1), `per doubling of claims; the same month ${sgn(dbl(L0.coef), 1)} (p ${fp(L0.p)})`, gradeP(L12.p))
      + tile('Peak filing month', MOL[seasOrd[0][1]], `seasonal index ${N(seasOrd[0][0], 1)} against ${N(seasOrd[11][0], 1)} in ${MOL[seasOrd[11][1]]} (2022 to 2025 average = 100)`, 'A')
      + tile('Median marriage duration', isN(medDur) ? N(medDur, 1) + ' yrs' : NA, `current Texas marriages, survey weighted, interpolated within the ${medIn ? medIn[1] + ' to ' + (medIn[2] - 1) : ''} year band`, 'B')
      + tile('COVID trough', fmtDate(`${Math.floor(trough.t / 12)}-${String(trough.t % 12 + 1).padStart(2, '0')}`), `${N(trough.v)} divorce filings, ${sgn((trough.v / trough.ago - 1) * 100, 0)} against ${MO[tSame19 % 12]} ${Math.floor(tSame19 / 12)}`, 'A')
      + tile('Claims lead filings by', xcBest + ' months', `statewide cross correlation peaks there (r ${N(xc[xcBest], 2)}, 2020 excluded)`, 'B');

    /* ---- 1. the aligned pair */
    function drawTs() {
      const L = +st.lag; const tEndX = Math.max(tLast, cLast + L); const labels = []; for (let t = t0; t <= tEndX; t++) labels.push(t);
      const ag = t => (L ? ` (${MO[(t - L) % 12]} ${Math.floor((t - L) / 12)})` : '');
      const o = { title: 'Texas divorce filings a month above initial claims, average per week', labels,
        top: { name: 'Divorce filings a month', values: labels.map(filingsM), color: 'var(--s1)', fmt: v => K(v), fmtTip: v => N(v) },
        bot: { name: L ? `Initial claims a week, ${L} months earlier` : 'Initial claims, average a week', values: labels.map(t => claimsM(t - L)), color: 'var(--s3)', fmt: v => K(v), fmtTip: v => N(v, 0) + ' a week', src: i => 'Claims' + ag(labels[i]), offLabel: i => `${MO[(labels[i] - L) % 12]} ${Math.floor((labels[i] - L) / 12)} off scale at ${K(claimsM(labels[i] - L))} a week` },
        clip: st.clip ? (i => covid(labels[i] - L)) : null,
        bands: [{ i0: covidBand.from - t0, i1: covidBand.to - t0, label: 'COVID orders', room: 60 }].concat(L && tEndX > tLast ? [{ i0: tLast - t0 + 1, i1: tEndX - t0, label: 'claims in, filings to come', room: 120 }] : []),
        marks: [{ i: trough.t - t0, label: `${MO[trough.t % 12]} ${Math.floor(trough.t / 12)}: ${N(trough.v)}` }] };
      evDualChart($('#evTs', root), o);
      const r = xc[String(L)]; const peakAt = `${MO[tPeakC % 12]} ${Math.floor(tPeakC / 12)}`;
      $('#evTsN', root).innerHTML = `Filings fell to ${N(trough.v)} in ${MOL[trough.t % 12]} ${Math.floor(trough.t / 12)}, ${sgn((trough.v / trough.ago - 1) * 100, 0)} on the same month a year earlier, while claims peaked at ${N(peakM, 0)} a week in ${peakAt} against ${N(mean(cT.filter(t => Math.floor(t / 12) === 2019).map(claimsM)), 0)} in the average month of 2019. ${L ? `Shifted ${L} months, ` : 'In the same month, '}the statewide correlation between claims and filings is ${isN(r) ? 'r = ' + N(r, 2) : 'not available'} (2020 excluded); it peaks at a ${xcBest} month lag (r = ${N(xc[xcBest], 2)}). ${L && tEndX > tLast ? `The shaded months at the right hold claims already filed whose ${L} month echo in the courts has not been reported yet. ` : ''}The claims bar for ${MO[cLast % 12]} ${Math.floor(cLast / 12)} averages the ${claimsW(cLast)} weeks reported so far. Filings for the last two months are provisional.`;
    }
    $('#evLag', root).onchange = e => { st.lag = +e.target.value; save(); drawTs(); };
    $('#evClip', root).onchange = e => { st.clip = e.target.checked; save(); drawTs(); };
    drawTs();

    /* ---- 2. elasticity tables */
    const EL_OUT = [['ldiv', 'Divorce'], ['lpriv', 'Private family filings'], ['lpo', 'Protective orders'], ['lsapcr', 'Custody (SAPCR)'], ['lmod', 'Modification'], ['lenf', 'Enforcement']];
    const LAGS = [['lclaims', 'Same month'], ['lclaims_l3', '3 months'], ['lclaims_l6', '6 months'], ['lclaims_l9', '9 months'], ['lclaims_l12', '12 months']];
    const rowGrade = r => { const c = r.coefs; const ks = Object.keys(c); const k3 = ks.find(k => /_l3$/.test(k)), k12 = ks.find(k => /_l12$/.test(k)); if ((k3 && c[k3].p < 0.01) || (k12 && c[k12].p < 0.01)) return 'B'; if (ks.some(k => c[k].p < 0.05)) return 'C'; return 'D'; };
    const isUR = key => /\|ur_/.test(key);
    const cell = (c, key) => { if (!c) return `<td>${NA}</td>`; const ur = isUR(key); const v = st.units === 'dbl' ? (ur ? pct1(c.coef) : dbl(c.coef)) : c.coef; const se = st.units === 'dbl' ? (ur ? Math.exp(c.coef) * c.se * 100 : dblSE(c.coef, c.se)) : c.se; const d = st.units === 'dbl' ? 1 : 3; return `<td class="${c.p < 0.05 ? (c.coef > 0 ? 'ev-up' : 'ev-dn') : ''}"><b>${sg(v, d)}${star(c.p)}</b><span class="ev-se">SE ${N(se, d)} · p ${fp(c.p)}</span></td>`; };
    const cumCell = (r, key) => { const ur = isUR(key); const v = st.units === 'dbl' ? (ur ? pct1(r.cum) : dbl(r.cum)) : r.cum; const se = st.units === 'dbl' ? (ur ? Math.exp(r.cum) * r.cum_se * 100 : dblSE(r.cum, r.cum_se)) : r.cum_se; const p = SS.pZ(r.cum / r.cum_se); const d = st.units === 'dbl' ? 1 : 3; return `<td class="${p < 0.05 ? (r.cum > 0 ? 'ev-up' : 'ev-dn') : ''}"><b>${sg(v, d)}${star(p)}</b><span class="ev-se">SE ${N(se, d)} · p ${fp(p)}</span></td>`; };
    const sampLab = k => (/post2022/.test(k) ? '2022 on' : '2019 to 2026');
    function drawEl() {
      const keys = []; EL_OUT.forEach(([o]) => { if (st.samp !== 'post' && PR[o + '|claims_0_12']) keys.push(o + '|claims_0_12'); if (st.samp !== 'full' && PR[o + '|claims_0_12|post2022']) keys.push(o + '|claims_0_12|post2022'); });
      const unit = st.units === 'dbl' ? '% per doubling' : 'elasticity';
      $('#evEl', root).innerHTML = `<div class="tblbox"><div class="tblwrap ev-tw"><table class="t ev-t"><caption class="vh">Filing response to claims by lag, ${unit}</caption><thead><tr><th scope="col">Case type · sample</th><th scope="col">Grade</th>${LAGS.map(l => `<th scope="col">${l[1]}</th>`).join('')}<th scope="col">Cumulative 0 to 12</th><th scope="col">n</th><th scope="col">R²</th></tr></thead><tbody>${keys.map(k => { const r = PR[k]; const o = EL_OUT.find(x => k.startsWith(x[0] + '|')); const g = rowGrade(r); return `<tr><td class="name">${esc(o[1])}<span class="ev-se">${sampLab(k)}</span></td><td><span class="grade ${g}">${g}</span></td>${LAGS.map(l => cell(r.coefs[l[0]], k)).join('')}${cumCell(r, k)}<td>${N(r.n)}</td><td>${N(r.r2, 2)}</td></tr>`; }).join('')}${st.samp !== 'full' && !PR['lpriv|claims_0_12|post2022'] ? `<tr><td class="name" colspan="10">Private family filings carry no 2022 on estimate in the data.</td></tr>` : ''}</tbody></table></div></div>`;
      const other = ['ldiv|claims_0_18', 'lpriv|claims_0_18', 'ldiv|ur_0_12', 'ldiv|ur_0_12|post2022'].filter(k => PR[k] && (st.samp === 'both' || (st.samp === 'post') === /post2022/.test(k)));
      const lagCols = [...new Set(other.flatMap(k => Object.keys(PR[k].coefs).map(c => +((c.match(/_l(\d+)$/) || [0, 0])[1]))))].sort((a, b) => a - b);
      const colKey = (k, L) => Object.keys(PR[k].coefs).find(c => +((c.match(/_l(\d+)$/) || [0, 0])[1]) === L);
      $('#evEl2', root).innerHTML = other.length ? `<div class="tblbox"><div class="tblwrap ev-tw"><table class="t ev-t"><caption class="vh">Longer lags and the unemployment rate</caption><thead><tr><th scope="col">Specification</th><th scope="col">Grade</th>${lagCols.map(L => `<th scope="col">${L ? L + ' months' : 'Same month'}</th>`).join('')}<th scope="col">Cumulative</th><th scope="col">n</th></tr></thead><tbody>${other.map(k => { const r = PR[k]; const lab = (k.startsWith('lpriv') ? 'Private family' : 'Divorce') + (isUR(k) ? ' on the unemployment rate (per point)' : ' on claims, lags to 18 months'); const g = rowGrade(r); return `<tr><td class="name">${esc(lab)}<span class="ev-se">${sampLab(k)}</span></td><td><span class="grade ${g}">${g}</span></td>${lagCols.map(L => { const ck = colKey(k, L); return ck ? cell(r.coefs[ck], k) : `<td>${NA}</td>`; }).join('')}${cumCell(r, k)}<td>${N(r.n)}</td></tr>`; }).join('')}</tbody></table></div></div><p class="small">The unemployment rate rows are in percent per percentage point of unemployment, not per doubling. The 18 month rows end their sample earlier (n ${N((PR['ldiv|claims_0_18'] || {}).n)}), which is why their early lags differ from the 12 month model.</p>` : `<p class="small">No other specification for this sample.</p>`;
      // the lag profile of one case type, both samples
      const o = st.elOut; const rows = []; [['|claims_0_12', 'full', 'var(--s1)'], ['|claims_0_12|post2022', '2022 on', 'var(--s4)']].forEach(([suf, lab, col]) => { const r = PR[o + suf]; if (!r) return; LAGS.forEach(l => { const c = r.coefs[l[0]]; if (!c) return; const f = st.units === 'dbl' ? dbl : (v => v); rows.push({ label: `Lag ${(l[0].match(/_l(\d+)$/) || [0, 0])[1]} · ${lab}`, est: f(c.coef), lo: f(c.coef - 1.959964 * c.se), hi: f(c.coef + 1.959964 * c.se), color: col }); }); });
      coefPlot($('#evElPlot', root), { title: 'Lag coefficients with 95% intervals', rows, ref: 0, fmt: v => sg(v, st.units === 'dbl' ? 0 : 2), lw: 120 });
      $('#evElPlotN', root).textContent = `${EL_OUT.find(x => x[0] === o)[1]}: each lag (months after the claims) with its 95% interval, ${st.units === 'dbl' ? 'percent per doubling of claims' : 'as an elasticity'}; green the full period (2019 to 2026), amber 2022 on. An interval that crosses zero is not distinguishable from no effect.`;
    }
    const share = P12.n ? PP.n / P12.n : null;
    $('#evElCave', root).innerHTML = callout('judg', 'Fixed effects: what they buy and what they do not', `<p>County effects absorb everything fixed about a county (size, courts, local habits); calendar month effects absorb the season; year effects absorb statewide shocks such as the 2020 orders and the long decline in divorce. What is left is how a county's filings move when its own claims move against its usual level, which is closer to cause than any cross section but not proof: a local shock that raises claims and changes filings through another channel would load here too. Errors are clustered by county with about 43 clusters, so the p values are approximate. Outcomes are the log of filings plus one, so the small monthly counts of protective orders, modifications and enforcement add noise. The 2022 on rows use ${isN(share) ? P(share, 0) : NA} of the county months; where the two samples differ the intervals usually overlap, so read the difference as a question for the firm's own intake data.</p>`);
    ['evUnits', 'evSamp', 'evElOut'].forEach(id => { $('#' + id, root).onchange = e => { st[{ evUnits: 'units', evSamp: 'samp', evElOut: 'elOut' }[id]] = e.target.value; save(); drawEl(); }; });
    drawEl();

    /* ---- 3. survival */
    const GRP = { all: [['all', 'All marriages', null]], order: [['times_1', 'First marriage', 1], ['times_2', 'Second marriage', 'timesb_2'], ['times_3+', 'Third or later', 'timesb_3+']], edu: [['edu_lt_hs', 'Less than high school', 'edu_lt_hs'], ['edu_hs', 'High school', 1], ['edu_some_college', 'Some college', 'edu_some_college'], ['edu_bachelors', 'Bachelor\'s degree', 'edu_bachelors'], ['edu_graduate', 'Graduate degree', 'edu_graduate']], agemar: [['young_mar', 'Married before 23', 'young_mar'], ['mar_23plus', 'Married at 23 or later', 1]] };
    const GCOL = ['var(--s1)', 'var(--s3)', 'var(--s2)', 'var(--s4)', 'var(--s5)'];
    function drawSurv() {
      const defs = (GRP[st.grp] || GRP.all).filter(d => G[d[0]] && (d[2] == null || d[2] === 1 || OR[d[2]]));
      const orOf = d => (d[2] == null || d[2] === 1 ? 1 : OR[d[2]].or); const wsum = sum(defs.map(d => G[d[0]].w)); const k = wsum / sum(defs.map(d => G[d[0]].w * orOf(d)));
      const series = defs.map((d, i) => { const f = d[2] == null ? 1 : orOf(d) * k; return { name: d[1], color: GCOL[i % GCOL.length], pts: SS.survival(curve.map(c => c.haz_per_1000 * f), curve.map(c => c.se * f)), f, d }; });
      evSurvChart($('#evSurv', root), { title: 'Texas marriages still intact by years since the wedding', series, band: st.band });
      const s10 = survAt(10), s20 = survAt(20), sEnd = survAt(tEnd);
      const base = `Under the 2020 to 2024 hazards, ${P(1 - s10, 1)} of new Texas marriages would end in divorce within 10 years, ${P(1 - s20, 1)} within 20 and ${P(1 - sEnd, 1)} within ${tEnd} years; ${isN(medSurv) ? `half would be gone by year ${N(medSurv, 1)}` : `the curve never reaches one half, so a median survival time does not exist here (widowhood, the other way a marriage ends, is not counted)`}. The median current marriage is ${N(medDur, 1)} years old. The hazard runs highest in years ${curve.slice().sort((a, b) => b.haz_per_1000 - a.haz_per_1000).slice(0, 3).map(c => c.dur).sort((a, b) => a - b).join(', ')} (${N(Math.max(...curve.map(c => c.haz_per_1000)), 1)} per 1,000 at the top) and falls below ${N(Math.ceil(curve.filter(c => c.dur >= 30).reduce((a, c) => Math.max(a, c.haz_per_1000), 0)), 0)} per 1,000 after year 30.`;
      const grpNote = st.grp === 'all' ? '' : ` Groups shift the statewide curve by the model's adjusted odds ratio, rescaled so the groups average back to the statewide curve: ${series.map(s => `${s.name} ${N(s.f, 2)}× (crude hazard ${N(G[s.d[0]].haz, 1)} per 1,000; ${P(1 - s.pts[Math.min(20, s.pts.length - 1)].s, 0)} divorced by year 20)`).join('; ')}. This assumes each group's hazard keeps the statewide shape across the years of marriage (graded C); where the crude and adjusted figures disagree, the crude one mixes in age and marriage length.`;
      $('#evSurvN', root).textContent = base + grpNote;
    }
    $('#evGrp', root).onchange = e => { st.grp = e.target.value; save(); drawSurv(); };
    $('#evBand', root).onchange = e => { st.band = e.target.checked; save(); drawSurv(); };
    drawSurv();

    /* ---- 4a. hazard model odds ratios */
    const TERMS = (typeof PUMS_TERMS !== 'undefined' ? PUMS_TERMS : Object.keys(OR).filter(k => k !== 'const').map(k => [k, k])).filter(t => OR[t[0]]);
    const grpOf = k => (/^ageb/.test(k) ? ['Age', 'var(--s1)'] : /^durb/.test(k) ? ['Years married', 'var(--s5)'] : /^timesb/.test(k) ? ['Number of marriages', 'var(--s2)'] : /^edu/.test(k) ? ['Education', 'var(--s3)'] : k === 'young_mar' ? ['Age at marriage', 'var(--s4)'] : ['Sex and service', 'var(--s6)']);
    coefPlot($('#evOR', root), { title: 'Hazard model odds ratios with 95% intervals', log: true, ref: 1, fmt: v => N(v, 2), lw: 190, rows: TERMS.map(([k, label]) => { const c = OR[k]; const z = 1.959964 * (c.se || 0); return { label, est: c.or, lo: c.or * Math.exp(-z), hi: c.or * Math.exp(z), color: grpOf(k)[1] }; }) });
    $('#evORLeg', root).innerHTML = [...new Map(TERMS.map(t => grpOf(t[0]))).entries()].map(([l, c]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('');
    $('#evORT', root).innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t"><caption class="vh">Hazard model odds ratios</caption><thead><tr><th scope="col">Term</th><th scope="col">Odds ratio</th><th scope="col">95% interval</th><th scope="col">SE (log)</th><th scope="col">p</th></tr></thead><tbody>${TERMS.map(([k, label]) => { const c = OR[k]; const z = 1.959964 * c.se; return `<tr><td>${esc(label)}</td><td>${N(c.or, 2)}</td><td>${N(c.or * Math.exp(-z), 2)} to ${N(c.or * Math.exp(z), 2)}</td><td>${N(c.se, 3)}</td><td>${fp(c.p)}</td></tr>`; }).join('')}</tbody></table></div></div>`;

    /* ---- 4b. the county cross section */
    const metroOf = c => c.msa || null;
    function regData(cfg) {
      const xs = cfg.x; const keep = c => (cfg.s === 'ab' ? 'AB' : cfg.s === 'abc' ? 'ABC' : 'ABCD').includes(c.grade) && c.rates.div_per_1k_married > 0 && xs.every(k => isN(c[k]));
      const cs = CTY.filter(keep); const y = cs.map(c => (cfg.y === 'log' ? Math.log(c.rates.div_per_1k_married) : c.rates.div_per_1k_married)); const X = cs.map(c => xs.map(k => c[k]));
      let fe = null; if (cfg.fe === 'metro') fe = cs.map(c => (metroOf(c) ? 'metro' : 'non metro')); else if (cfg.fe === 'msa') { const cnt = {}; cs.forEach(c => { const m = metroOf(c); if (m) cnt[m] = (cnt[m] || 0) + 1; }); fe = cs.map(c => { const m = metroOf(c); return m && cnt[m] >= 2 ? m : 'other'; }); }
      const w = cfg.w === 'sqrt' ? cs.map(c => Math.sqrt(c.pop2025)) : null; return { cs, y, X, fe, w };
    }
    function regFit(cfg) {
      const d = regData(cfg); const names = cfg.x.map(k => EV_COMP.find(c => c[0] === k)[1]); const o = { names, fe: d.fe, w: d.w, se: cfg.se };
      const std = SS.ols(d.y, d.X, Object.assign({ std: true }, o)); const raw = SS.ols(d.y, d.X, o); const sh = SS.shapley(d.y, d.X, { names, fe: d.fe, w: d.w });
      const feN = d.fe ? new Set(d.fe).size : 0; return { d, std, raw, sh, names, feN };
    }
    const regCfg = () => ({ y: st.regY, s: st.regS, fe: st.regFE, se: st.regSE, w: st.regW, x: EV_COMP.map(c => c[0]).filter(k => st.regX.includes(k)) });
    const REF = (() => { try { return regFit({ y: 'log', s: 'all', fe: 'msa', se: 'HC3', w: 'none', x: EV_COMP.map(c => c[0]) }); } catch (e) { return null; } })();   // the reference model the readings cite
    let REG = null;
    function drawReg() {
      const cfg = regCfg(); REG = null;
      if (!cfg.x.length) { $('#evRegSum', root).textContent = 'Pick at least one component.'; $('#evRegPlot', root).innerHTML = ''; $('#evRegTbl', root).innerHTML = ''; drawCorr(); return; }
      try { REG = regFit(cfg); } catch (e) { $('#evRegSum', root).textContent = 'This model cannot be fit: ' + e.message; $('#evRegPlot', root).innerHTML = ''; $('#evRegTbl', root).innerHTML = ''; drawCorr(); return; }
      const { std, raw, sh, d } = REG; const feTxt = cfg.fe === 'none' ? 'no fixed effects' : cfg.fe === 'metro' ? 'a metro or not effect' : `${std.fe ? std.fe.dummies.length : 0} metro effects (metros with one county in the sample join the non metro reference)`;
      $('#evRegSum', root).textContent = `${N(std.n)} counties, ${feTxt}, ${cfg.se === 'HC3' ? 'robust HC3' : 'classic'} errors${cfg.w === 'sqrt' ? ', weighted by the square root of population' : ''}. R² ${N(std.r2, 3)} (adjusted ${N(std.adjR2, 3)}); fixed effects alone ${N(std.r2fe || 0, 3)}; the components add ${N(sh.gain, 3)}.${cfg.x.includes('comp_supply') ? ' Supply exists only for counties with a law office, which limits the sample.' : ''}`;
      coefPlot($('#evRegPlot', root), { title: 'Standardized coefficients with 95% intervals', ref: 0, fmt: v => sg(v, 2), lw: 170, rows: std.coef.map(c => ({ label: c.name, est: c.b, lo: c.lo, hi: c.hi, color: c.p < 0.05 ? (c.b > 0 ? 'var(--rp-leaf-5)' : 'var(--rp-slate-5)') : 'var(--ink-3)' })) });
      const mx = Math.max(...sh.phi.map(f => Math.abs(f.share || 0)), 0.01);
      $('#evRegTbl', root).innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t ev-t"><caption class="vh">Cross section coefficients and Shapley shares</caption><thead><tr><th scope="col">Component</th><th scope="col">Std. β</th><th scope="col">95% interval</th><th scope="col">p</th><th scope="col">Raw b (SE)</th><th scope="col">Shapley share</th></tr></thead><tbody>${std.coef.map((c, i) => { const r = raw.coef[i], f = sh.phi[i]; return `<tr><td class="name">${esc(c.name)}</td><td><b>${sg(c.b, 2)}${star(c.p)}</b></td><td>${sg(c.lo, 2)} to ${sg(c.hi, 2)}</td><td>${fp(c.p)}</td><td>${N(r.b, 4)} <span class="ev-se">(${N(r.se, 4)})</span></td><td class="ev-shap"><span class="ev-barw"><span class="ev-bar" style="width:${Math.max(0, (f.share || 0) / mx * 100).toFixed(0)}%"></span></span><span>${isN(f.share) ? P(f.share, 0) : NA}</span></td></tr>`; }).join('')}</tbody></table></div></div><p class="small">Shapley shares split the R² the components add beyond the fixed effects (${N(sh.gain, 3)}) by averaging each component's gain over every order of entry; they sum to 100% and do not depend on which component comes first. Raw b is in the outcome's units per unit of the component.</p>`;
      drawCorr();
    }
    function drawCorr() {
      const cfg = regCfg(); const xs = EV_COMP.map(c => c[0]); const d = regData(Object.assign({}, cfg, { x: cfg.x.length ? cfg.x : xs }));
      const keys = ['y'].concat(xs); const lab = { y: cfg.y === 'log' ? 'Filing rate (log)' : 'Filing rate' }; EV_COMP.forEach(c => { lab[c[0]] = c[1].replace(/ \(.*\)$/, ''); });
      const cols = { y: d.y }; xs.forEach(k => { cols[k] = d.cs.map(c => c[k]); }); const M = SS.corr(cols, keys, st.cm);
      const cell = v => { if (!isN(v)) return `<td>${NA}</td>`; const a = Math.abs(v); const i = Math.min(7, Math.round(a * 8)); const ramp = v >= 0 ? 'leaf' : 'slate'; return a < 0.1 ? `<td>${MINUS(v.toFixed(2))}</td>` : `<td style="background:var(--rp-${ramp}-${i});color:var(--rp-${ramp}-${i}-ink)">${MINUS(v.toFixed(2))}</td>`; };
      $('#evCorr', root).innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t ev-cm"><caption class="vh">Correlation of the filing rate and the components</caption><thead><tr><th scope="col"></th>${keys.map(k => `<th scope="col">${esc(lab[k])}</th>`).join('')}</tr></thead><tbody>${keys.map(a => `<tr><th scope="row">${esc(lab[a])}</th>${keys.map(b => (a === b ? '<td class="ev-diag">1</td>' : cell(M[a][b]))).join('')}</tr>`).join('')}</tbody></table></div></div>`;
      $('#evCorrN', root).textContent = `${st.cm === 'pearson' ? 'Pearson' : 'Spearman rank'} correlations over the ${N(d.cs.length)} counties in the model's sample (pairwise). Leaf is positive, slate negative, deeper is stronger. Components that move together share credit in the regression, which is why the Shapley split matters more than any single coefficient.`;
    }
    [['evRegY', 'regY'], ['evRegS', 'regS'], ['evRegFE', 'regFE'], ['evRegSE', 'regSE'], ['evRegW', 'regW']].forEach(([id, k]) => { $('#' + id, root).onchange = e => { st[k] = e.target.value; save(); drawReg(); }; });
    $$('[data-comp]', root).forEach(b => { b.onchange = () => { st.regX = $$('[data-comp]', root).filter(x => x.checked).map(x => x.dataset.comp); save(); drawReg(); }; });
    $('#evCm', root).onchange = e => { st.cm = e.target.value; save(); drawCorr(); };
    drawReg();

    /* ---- 5. income */
    const MG = [['19100', 'Dallas Fort Worth', 'var(--s1)'], ['26420', 'Houston', 'var(--s2)'], ['41700', 'San Antonio', 'var(--s3)'], ['12420', 'Austin', 'var(--s4)'], ['21340', 'El Paso', 'var(--s5)'], ['32580|15180', 'Rio Grande Valley', 'var(--s6)'], ['other', 'Other metros', 'var(--s7)'], ['non', 'Non metro', 'var(--rp-slate-4)']];
    const mgOf = c => MG.find(g => c.msa && g[0].split('|').includes(c.msa)) || (c.msa ? MG[6] : MG[7]);
    const modeled = c => c.risk.haz_pred * c.acs.married / 1000; const capOf = c => (modeled(c) > 0 && c.filings.ttm.div > 0 ? c.filings.ttm.div / modeled(c) : null);
    const incSample = s => CTY.filter(c => (s === 'ab' ? 'AB' : s === 'abc' ? 'ABC' : 'ABCD').includes(c.grade) && isN(c.acs.med_hh_inc));
    const gradient = (s, yk) => { const cs = incSample(s); const yv = c => (yk === 'sep' ? c.acs.sep_per_1k_married : capOf(c)); const ok = cs.filter(c => isN(yv(c)) && yv(c) > 0); const lx = ok.map(c => Math.log(c.acs.med_hh_inc)), ly = ok.map(c => Math.log(yv(c))); const r = SS.pearson(lx, ly), rho = SS.spearman(lx, ly); let el = null; try { el = SS.ols(ly, lx.map(v => [v]), { se: 'HC3' }).coef[0]; } catch (e) { el = null; } return { ok, r, rho, el, yv }; };
    const GR = { cap: gradient('abc', 'cap'), sep: gradient('abc', 'sep'), capAll: gradient('all', 'cap') };
    const capState = sum(CTY.map(c => c.filings.ttm.div)) / sum(CTY.map(modeled));
    function drawInc() {
      const g = gradient(st.incS, st.incY); const isCap = st.incY === 'cap';
      scatter($('#evInc', root), { title: (isCap ? 'Court capture' : 'Separation') + ' against median household income by county', W: 900, H: 340, ylog: true, xlab: 'Median household income ($ thousands)', xfmt: v => '$' + N(v, 0) + 'k', yfmt: v => (isCap ? N(v, 0) + '%' : N(v, 0)), ylab: isCap ? 'Filed as % of modeled' : 'Separated per 1,000 married', selected: st.incSel,
        points: g.ok.map(c => ({ id: c.fips, label: c.name, x: c.acs.med_hh_inc / 1000, y: isCap ? g.yv(c) * 100 : g.yv(c), r: c.acs.married, color: mgOf(c)[2] })), onPoint: id => { st.incSel = id; incSel(); drawInc(); },
        tip: p => { const c = CI[p.id]; return `<b>${esc(c.name)} County</b><div class="row"><span>Metro</span><span>${esc(mgOf(c)[1])}</span></div><div class="row"><span>Median household income</span><span>${$$$(c.acs.med_hh_inc)}</span></div><div class="row"><span>Divorce filings, trailing year</span><span>${N(c.filings.ttm.div)}</span></div><div class="row"><span>Modeled divorces a year</span><span>${N(modeled(c), 0)}</span></div><div class="row"><span>Court capture</span><span>${isN(capOf(c)) ? P(capOf(c), 0) : NA}</span></div><div class="row"><span>Separated per 1,000 married</span><span>${N(c.acs.sep_per_1k_married, 1)}</span></div>`; } });
      $('#evIncLeg', root).innerHTML = MG.map(m => `<span><i style="background:${m[2]}"></i>${esc(m[1])}</span>`).join('');
      const e = g.el; const c = GR.cap, sp = GR.sep;
      $('#evIncN', root).innerHTML = `${isCap ? 'Court capture' : 'Separation'} against income across ${N(g.ok.length)} counties: r = ${N(g.r.r, 2)} on logs (p ${fp(g.r.p)}), Spearman ρ = ${N(g.rho.rho, 2)}, elasticity ${e ? sg(e.b, 2) + ' (robust SE ' + N(e.se, 2) + ', p ' + fp(e.p) + ')' : NA}. Statewide the courts receive ${P(capState, 0)} of the divorces the composition model expects. <b>The reading.</b> ${c.r.r < 0 ? `Capture does not rise with income; among counties graded A to C it falls slightly (r ${N(c.r.r, 2)}, elasticity ${c.el ? sg(c.el.b, 2) : NA}), so affluent counties file fewer divorces than their composition predicts. The model leaves income out by design, so part of this may be lower divorce risk at high incomes that it cannot see.` : `Capture rises with income among counties graded A to C (r ${N(c.r.r, 2)}): affluent counties file more of the divorces their composition predicts.`} ${sp.r.r < 0 ? `What climbs as income falls is separation without a decree: separated adults per 1,000 married against income, r = ${N(sp.r.r, 2)} (p ${fp(sp.r.p)}). Lower income counties separate without filing. The offers that fit them are a flat fee, a payment plan and a consult that starts with the cost of the case, with a referral to legal aid when the firm cannot take the matter.` : `Separation does not fall with income here (r ${N(sp.r.r, 2)}).`} Small counties swing on a handful of cases; switch to grades A and B to see the steadier ones.`;
      incSel();
    }
    function incSel() { const c = CI[st.incSel]; $('#evIncSel', root).innerHTML = c ? `<b>${esc(c.name)} County</b>: ${N(c.filings.ttm.div)} divorce filings against ${N(modeled(c), 0)} modeled, capture ${isN(capOf(c)) ? P(capOf(c), 0) : NA}; median household income ${$$$(c.acs.med_hh_inc)}; ${N(c.acs.sep_per_1k_married, 1)} separated per 1,000 married.` : 'Click a dot to read a county.'; }
    $('#evIncY', root).onchange = e => { st.incY = e.target.value; save(); drawInc(); };
    $('#evIncS', root).onchange = e => { st.incS = e.target.value; save(); drawInc(); };
    drawInc();

    /* ---- 6. clusters: weights built once, Moran's I and LISA computed in chunks and cached by weights and measure */
    const WB = {}; const LC = {}; let lisaTok = 0;
    const weightsOf = k => { if (!WB[k]) WB[k] = k === 'knn' ? SS.knn(CTY.map(c => GEO.state.cent[c.fips] || c.cent || null), 6) : SS.contiguity(CTY.map(c => GEO.state.county[c.fips] || ''), 1); return WB[k]; };
    const CLS = { HH: ['High among high', 'var(--s2)', 1], LL: ['Low among low', 'var(--s3)', 2], HL: ['High among low', 'color-mix(in srgb, var(--s2) 42%, var(--card))', 3], LH: ['Low among high', 'color-mix(in srgb, var(--s3) 42%, var(--card))', 4], ns: ['Not significant', 'var(--rp-sage-1)', 0] };
    const CLV = { 1: 'HH', 2: 'LL', 3: 'HL', 4: 'LH', 0: 'ns' };
    async function lisaFor(wk, mk, progress) {
      const key = wk + '|' + mk; if (LC[key]) return LC[key];
      const W = weightsOf(wk); const vals = CTY.map(c => EV_MEAS[mk].v(c)); const keep = vals.map(isN); const Ws = SS.subsetW(W, keep); const x = Ws.idx.map(i => vals[i]);
      const seed = SS.hashSeed('evidence|' + key); const glob = SS.moran(x, Ws, { perms: 999, seed });
      const loc = await SS.localMoranAsync(x, Ws, { perms: 499, seed: SS.hashSeed('evidence|local|' + key), alpha: 0.05, chunk: 48 }, progress);
      const byF = {}; Ws.idx.forEach((ci, j) => { byF[CTY[ci].fips] = { j, I: loc.Is[j], p: loc.p[j], q: loc.q[j], nb: Ws.nb[j].map(t => CTY[Ws.idx[t]].fips), v: x[j], lag: Ws.nb[j].length ? mean(Ws.nb[j].map(t => x[t])) : null }; });
      const islands = Ws.islands.map(i => CTY[i].fips); const missing = CTY.filter((c, i) => !keep[i]).map(c => c.fips);
      return (LC[key] = { key, wk, mk, glob, loc, byF, islands, missing, n: x.length });
    }
    const clsAt = (r, f, a) => { const o = r.byF[f]; if (!o) return null; return o.p <= a ? o.q : 'ns'; };
    const counts = (r, a) => { const k = { HH: 0, LL: 0, HL: 0, LH: 0, ns: 0 }; Object.keys(r.byF).forEach(f => { k[clsAt(r, f, a)]++; }); return k; };
    const mapEl = $('#evLisaMap', root);
    function drawLisaMap(r) {
      const a = +st.la; const m = EV_MEAS[st.lm]; const cnt = counts(r, a); const noOff = st.lm === 'fpo';
      drawMap(mapEl, { title: 'Texas counties, local clusters of ' + m.l, W: GEO.state.W, H: GEO.state.H, paths: GEO.state.county, outline: GEO.state.outline, selected: st.lSel,
        value: id => { const c = clsAt(r, id, a); return c ? CLS[c][2] : null; }, color: v => CLS[CLV[v]][1],
        alt: noOff ? { test: id => r.missing.includes(id), color: 'var(--alt-fill)', label: 'no law office recorded' } : null,
        label: id => { const c = CI[id]; const o = r.byF[id]; return `<b>${esc(c.name)} County</b><div class="row"><span>${esc(m.l)}</span><span>${esc(m.f(m.v(c)))}</span></div>${o ? `<div class="row"><span>Cluster</span><span>${esc(CLS[clsAt(r, id, a)][0])}</span></div><div class="row"><span>Neighbors' average</span><span>${esc(m.f(o.lag))}</span></div><div class="row"><span>Local I · pseudo p</span><span>${N(o.I, 2)} · ${fp(o.p)}</span></div>` : `<div class="row"><span>Cluster</span><span>${r.islands.includes(id) ? 'no neighbor with data' : 'no data'}</span></div>`}`; },
        onSelect: id => { st.lSel = id; store.set('sev.county', id); markSel(mapEl, id); lisaSide(r); } });
      $('#evLisaLeg', root).innerHTML = ['HH', 'LL', 'HL', 'LH', 'ns'].map(k => `<span><i style="background:${CLS[k][1]}"></i>${CLS[k][0]} (${cnt[k]})</span>`).join('') + (noOff ? `<span><i style="background:var(--alt-fill)"></i>No law office recorded (${r.missing.length})</span>` : '') + (r.islands.length ? `<span><i style="background:var(--nodata)"></i>No neighbor with data (${r.islands.length})</span>` : '');
      lisaSide(r);
    }
    function lisaSide(r) {
      const c = CI[st.lSel]; const m = EV_MEAS[st.lm]; if (!c) { $('#evLisaSel', root).textContent = 'Click a county on the map.'; return; } const o = r.byF[c.fips]; const a = +st.la;
      $('#evLisaSel', root).innerHTML = `<h4 class="ev-h4" style="margin-top:0">${esc(c.name)} County</h4>${o ? `<dl class="kv"><dt>${esc(m.l)}</dt><dd>${esc(m.f(o.v))}</dd><dt>Neighbors' average</dt><dd>${esc(m.f(o.lag))}</dd><dt>Cluster at p ≤ ${st.la}</dt><dd>${esc(CLS[clsAt(r, c.fips, a)][0])}</dd><dt>Quadrant (before the test)</dt><dd>${esc(CLS[o.q][0])}</dd><dt>Local Moran's I</dt><dd>${N(o.I, 3)}</dd><dt>Pseudo p (499 draws)</dt><dd>${fp(o.p)}</dd><dt>Neighbors</dt><dd>${o.nb.length}</dd></dl><p class="small" style="margin-top:6px">${o.nb.map(f => esc(cname(f))).join(', ')}</p>` : `<p class="small">${r.missing.includes(c.fips) ? 'No value for this measure (for supply: no law office recorded in County Business Patterns 2023).' : 'Every neighbor lacks data, so the county is left out of the test.'}</p>`}<p class="small">High among high: the county and its neighbors both run above the state mean, and the pairing is unlikely under random placement. Outliers (high among low, low among high) are counties that break from their surroundings.</p>`;
    }
    function moranTable() {
      const a = +st.la; const rows = Object.keys(EV_MEAS).map(k => { const r = LC[st.lw + '|' + k]; if (!r) return `<tr><td class="name">${esc(EV_MEAS[k].l)}</td><td colspan="9" class="ev-wait">computing</td></tr>`; const g = r.glob; const cn = counts(r, a); return `<tr${k === st.lm ? ' class="sel"' : ''}><td class="name">${esc(EV_MEAS[k].l)}</td><td>${N(r.n)}</td><td><b>${N(g.I, 3)}</b></td><td>${N(g.EI, 3)}</td><td>${N(g.z_rand, 1)}</td><td>${fp(g.p_sim)}</td><td>${cn.HH}</td><td>${cn.LL}</td><td>${cn.HL}</td><td>${cn.LH}</td></tr>`; });
      $('#evMoran', root).innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t ev-t"><caption class="vh">Moran's I by measure</caption><thead><tr><th scope="col">Measure</th><th scope="col">Counties</th><th scope="col">Moran's I</th><th scope="col">Expected</th><th scope="col">z (randomization)</th><th scope="col">Pseudo p (999)</th><th scope="col">High among high</th><th scope="col">Low among low</th><th scope="col">High among low</th><th scope="col">Low among high</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
      const done = Object.keys(EV_MEAS).map(k => LC[st.lw + '|' + k]).filter(Boolean);
      if (done.length === Object.keys(EV_MEAS).length) { const s = done.slice().sort((x, y) => y.glob.I - x.glob.I); const fpo = LC[st.lw + '|fpo']; $('#evMoranN', root).innerHTML = `Expected I with no spatial pattern is about ${N(done[0].glob.EI, 3)}. ${esc(EV_MEAS[s[0].mk].l)} clusters hardest (I = ${N(s[0].glob.I, 2)}), largely because the hazard model works at the level of survey areas that span several counties, so neighbors share it by construction; ${esc(EV_MEAS[s[s.length - 1].mk].l.toLowerCase())} clusters least (I = ${N(s[s.length - 1].glob.I, 2)}, pseudo p ${fp(s[s.length - 1].glob.p_sim)}). ${fpo ? `Supply covers the ${N(fpo.n)} counties with a law office${fpo.islands.length ? ` that have a neighbor with one (${fpo.islands.length} more stand alone)` : ''}. ` : ''}With ${N(done[0].n)} local tests at p ≤ ${st.la}, about ${N(done[0].n * a, 0)} counties would show a cluster by chance alone, so read single counties with care and clusters of several as the signal.`; }
      else $('#evMoranN', root).textContent = '';
    }
    async function runLisa() {
      const tok = ++lisaTok; const wk = st.lw; const order = [st.lm].concat(Object.keys(EV_MEAS).filter(k => k !== st.lm)); const t1 = performance.now();
      moranTable(); let shown = false;
      for (let i = 0; i < order.length; i++) {
        const mk = order[i]; if (tok !== lisaTok) return;
        if (!LC[wk + '|' + mk]) $('#evLisaStat', root).textContent = `Computing ${EV_MEAS[mk].l.toLowerCase()} (${i + 1} of ${order.length}): 999 global and 499 local permutations…`;
        const r = await lisaFor(wk, mk, (d, n) => { if (tok === lisaTok) $('#evLisaStat', root).textContent = `Computing ${EV_MEAS[mk].l.toLowerCase()} (${i + 1} of ${order.length}): local tests ${d} of ${n}…`; });
        if (!r || tok !== lisaTok) return;
        if (mk === st.lm && !shown) { drawLisaMap(r); shown = true; }
        moranTable();
      }
      $('#evLisaStat', root).textContent = `Computed in this browser in ${N((performance.now() - t1) / 1000, 1)} s (cached for this visit). Neighbors: ${wk === 'knn' ? 'the six nearest county centers' : 'counties sharing a border, read from the map outlines'}.`;
      readings();
    }
    $('#evLm', root).onchange = e => { st.lm = e.target.value; save(); const r = LC[st.lw + '|' + st.lm]; if (r) { drawLisaMap(r); moranTable(); } else runLisa(); };
    $('#evLw', root).onchange = e => { st.lw = e.target.value; save(); runLisa(); };
    $('#evLa', root).onchange = e => { st.la = e.target.value; save(); const r = LC[st.lw + '|' + st.lm]; if (r) drawLisaMap(r); moranTable(); };

    /* ---- 7. the evidence matrix */
    const good = CTY.filter(c => c.grade === 'A' || c.grade === 'B'); const ys = good.map(c => Math.log(c.rates.div_per_1k_married || 1)); const ws = good.map(c => Math.sqrt(c.pop2025));
    const ysAll = CTY.map(c => (c.rates.div_per_1k_married > 0 ? Math.log(c.rates.div_per_1k_married) : null));
    const strengthOf = r => (!isN(r) ? 'n/a' : Math.abs(r) >= 0.4 ? 'Strong' : Math.abs(r) >= 0.2 ? 'Moderate' : 'Weak');
    const srcUrl = src => { const m = String(src || '').match(/^ACS (B\d{5})/); if (m) return 'https://data.census.gov/table/ACSDT5Y2024.' + m[1]; if (/^PUMS/.test(src)) return 'https://www2.census.gov/programs-surveys/acs/data/pums/2024/5-Year/'; if (/^DFPS/.test(src)) return 'https://data.texas.gov/'; if (/LAUS/.test(src)) return 'https://texaslmi.com/LMIbyCategory/LAUS'; return ''; };
    const litBy = {}; D.lit.forEach(l => { litBy[l.key] = l; });
    const sigR = {}; const sigs = typeof SIGNALS !== 'undefined' ? SIGNALS : [];
    sigs.forEach(s => { const r = SS.pearson(good.map(s.v), ys, ws); const rho = SS.spearman(CTY.map(s.v), ysAll); sigR[s.k] = { r: r.r, n: r.n, rho: rho.rho }; });
    const MX = [];
    sigs.forEach(s => {
      const m = EV_SIG[s.k] || { cat: 'Context', dir: 'n/a', idx: 'n/a', tier: 'D' }; let tier = m.tier || 'C'; let est = '';
      if (m.or && OR[m.or]) { const c = OR[m.or]; tier = c.p < 0.05 ? 'A' : 'D'; est = `Texas model: odds ${N(c.or, 2)}× (p ${fp(c.p)})`; if (s.k === 'rem' && OR['timesb_3+']) est += `; third or later ${N(OR['timesb_3+'].or, 2)}×`; if (s.k === 'a2544') est = `Texas model: age 65 and over ${N(c.or, 2)}× the odds of 40 to 44 (p ${fp(c.p)})`; }
      if (m.panel && PR[m.panel]) { const c = PR[m.panel].coefs.ur_l12; tier = c && c.p < 0.05 ? 'A' : 'C'; est = c ? `Texas panel: ${sg(pct1(c.coef), 1)}% filings per point of unemployment 12 months later (p ${fp(c.p)})` : ''; }
      if (m.lit) tier = m.tier || 'B';
      const cites = [{ t: s.src, u: srcUrl(s.src) }].concat((m.lit || []).filter(k => litBy[k]).map(k => ({ t: litBy[k].cite.split('.')[0] + ' (' + (litBy[k].cite.match(/\((\d{4})\)/) || ['', ''])[1] + ')', u: litBy[k].url })));
      const R = sigR[s.k] || {};
      MX.push({ _id: 's_' + s.k, kind: 'signal', name: s.n, cat: m.cat, dir: m.dir, idx: m.idx, str: strengthOf(R.r), tier, est, cites, note: s.d + (est ? ' ' + est + '.' : ''), meas: true, measTxt: 'Yes (module 04)', r: R.r, rho: R.rho, n: R.n });
    });
    D.lit.forEach(l => {
      const m = EV_LIT[l.key] || { cat: 'Literature', dir: 'n/a', tier: 'B', meas: null }; let r = null, rho = null, n = null, note = l.finding;
      if (m.sig && sigR[m.sig]) { r = sigR[m.sig].r; rho = sigR[m.sig].rho; n = sigR[m.sig].n; }
      if (m.v) { const rr = SS.pearson(good.map(m.v), ys, ws); r = rr.r; n = rr.n; rho = SS.spearman(CTY.map(m.v), ysAll).rho; }
      if (m.panel && PR[m.panel]) { const c = PR[m.panel].coefs.ur; note += ` Texas panel, same month: ${sg(pct1(c.coef), 1)}% divorce filings per point of unemployment (p ${fp(c.p)}).`; }
      if (l.key === 'nchs' && ST.nchs && ST.nchs.divorce) { const ks = Object.keys(ST.nchs.divorce).sort(); note += ` Embedded series: ${N(ST.nchs.divorce[ks[0]], 1)} in ${ks[0]}, ${N(ST.nchs.divorce[ks[ks.length - 1]], 1)} in ${ks[ks.length - 1]} per 1,000 residents.`; }
      MX.push({ _id: 'l_' + l.key, kind: 'study', name: l.cite.split('.')[0] + (l.cite.match(/\((\d{4})\)/) ? ' (' + l.cite.match(/\((\d{4})\)/)[1] + ')' : ''), cat: m.cat, dir: m.dir, idx: 'n/a', str: strengthOf(r), tier: m.tier, est: '', cites: [{ t: l.cite, u: l.url }], note, meas: !!m.meas, measTxt: m.meas || 'No: a benchmark the firm\'s own account data replaces (module 23)', r, rho, n });
    });
    const cats = [...new Set(MX.map(x => x.cat))].sort();
    $('#evMxCat', root).innerHTML = [['', 'All']].concat(cats.map(c => [c, c])).map(o => `<option value="${esc(o[0])}"${o[0] === st.mxCat ? ' selected' : ''}>${esc(o[1])}</option>`).join('');
    const mxCols = [
      { k: 'name', l: 'Signal or study', fmt: (v, r) => `<b>${esc(v)}</b><span class="ev-se">${r.kind === 'signal' ? 'Signal' : 'Study'}</span>`, cls: 'wrap' },
      { k: 'cat', l: 'Category', fmt: v => esc(v), cls: 'l wrap' },
      { k: 'dir', l: 'Expected direction', fmt: v => esc(v), cls: 'l wrap' },
      { k: 'str', l: 'Strength', fmt: v => esc(v), cls: 'l', tip: 'From |r| with the filing rate: Strong 0.40 or more, Moderate 0.20 to 0.40, Weak under 0.20' },
      { k: 'tier', l: 'Tier', fmt: v => `<span class="grade ${v}" title="${esc(EV_TIER[v])}">${v}</span>`, cls: 'l' },
      { k: 'r', l: 'r with filing rate', fmt: v => (isN(v) ? MINUS(v.toFixed(2)) : NA), tip: 'Weighted by the square root of population, counties graded A or B, log filings per 1,000 married' },
      { k: 'rho', l: 'Spearman, all counties', fmt: v => (isN(v) ? MINUS(v.toFixed(2)) : NA) },
      { k: 'idx', l: 'Index component', fmt: v => esc(v), cls: 'l wrap' },
      { k: 'measTxt', l: 'Measured in Severance', fmt: v => esc(v), cls: 'l wrap' },
      { k: 'cites', l: 'Citation', fmt: v => v.map(c => lnk(c.u, c.t)).join('<br>'), cls: 'l wrap ev-cite' },
      { k: 'note', l: 'Texas note', fmt: v => esc(v), cls: 'l wrap ev-notecol' }];
    let mxT = null;
    function mxRows() { const q = st.mxQ.trim().toLowerCase(); return MX.filter(x => (!q || (x.name + ' ' + x.note + ' ' + x.dir + ' ' + x.cat + ' ' + x.cites.map(c => c.t).join(' ')).toLowerCase().includes(q)) && (!st.mxCat || x.cat === st.mxCat) && (!st.mxStr || x.str === st.mxStr) && (!st.mxTier || x.tier === st.mxTier) && (!st.mxKind || x.kind === st.mxKind) && (!st.mxMeas || x.meas)); }
    function drawMx() { const rows = mxRows(); $('#evMxN', root).textContent = `${rows.length} of ${MX.length} rows (${MX.filter(x => x.kind === 'signal').length} signals, ${MX.filter(x => x.kind === 'study').length} studies).`; if (mxT) mxT.setRows(rows); else mxT = table($('#evMx', root), { caption: 'Evidence matrix', cols: mxCols, rows, sort: { k: 'r', dir: -1 } }); }
    $('#evMxQ', root).addEventListener('input', debounce(e => { st.mxQ = e.target.value; drawMx(); }, 150));
    [['evMxCat', 'mxCat'], ['evMxStr', 'mxStr'], ['evMxTier', 'mxTier'], ['evMxKind', 'mxKind']].forEach(([id, k]) => { $('#' + id, root).onchange = e => { st[k] = e.target.value; save(); drawMx(); }; });
    $('#evMxMeas', root).onchange = e => { st.mxMeas = e.target.checked; save(); drawMx(); };
    drawMx();

    /* ---- 8. readings */
    function readings() {
      const top3 = seasOrd.slice(0, 3).map(x => `${MOL[x[1]]} (${N(x[0], 1)})`); const low2 = seasOrd.slice(-2).reverse().map(x => `${MOL[x[1]]} (${N(x[0], 1)})`);
      const pp0 = PP.coefs.lclaims, pp3 = PP.coefs.lclaims_l3, pp12 = PP.coefs.lclaims_l12; const sigTxt = c => (c.p < 0.05 ? `p ${fp(c.p)}` : `not significant, p ${fp(c.p)}`);
      const enf = PR['lenf|claims_0_12|post2022'], po = PR['lpo|claims_0_12'];
      const refSep = REF ? REF.std.coef.find(c => c.name === 'Separation') : null; const refSepSh = REF ? REF.sh.phi.find(f => f.name === 'Separation') : null;
      const sepQ = SS.quantile(CTY.map(c => c.acs.sep_per_1k_married), 0.8); const sepTop = CTY.filter(c => c.acs.sep_per_1k_married >= sepQ && c.grade !== 'D').sort((a, b) => b.acs.separated - a.acs.separated);
      const m55 = SS.quantile(CTY.map(c => c.acs.mar_55p_sh), 0.8); const grayTop = CTY.filter(c => c.acs.mar_55p_sh >= m55).sort((a, b) => ((b.acs.mar_55_64 || 0) + (b.acs.mar_65p || 0)) - ((a.acs.mar_55_64 || 0) + (a.acs.mar_65p || 0)));
      const hz = k => (G[k] ? N(G[k].haz, 1) : NA);
      const qD = LC[st.lw + '|di'], qH = LC[st.lw + '|haz'];
      const hh = qD ? Object.keys(qD.byF).filter(f => clsAt(qD, f, 0.05) === 'HH').map(f => CI[f]).sort((a, b) => b.pop2025 - a.pop2025) : [];
      const pol = ['google_hardship', 'meta_attr'].map(id => (typeof LINT !== 'undefined' && LINT.rule ? LINT.rule(id) : null)).filter(Boolean); const srcOf = r => (LINT.SOURCES && LINT.SOURCES[r.src]) || null;
      const items = [
        `<b>Pace the year to the filing season.</b> Divorce filings peak in ${top3[0]} and stay high in ${top3[1]} and ${top3[2]}; they run lowest in ${low2[0]} and ${low2[1]} (seasonal index, 2022 to 2025 average = 100). Weight the divorce budget toward late winter and spring, keep a second push for late summer, and cut back in November and December.`,
        `<b>Budget 3 and 12 months after a claims surge, carefully.</b> In the 43 large counties a doubling of weekly claims is followed by ${sgn(dbl(L0.coef), 1)} divorce filings the same month, ${sgn(dbl(L3.coef), 1)} three months later and ${sgn(dbl(L12.coef), 1)} twelve months later (2019 to 2026; ${[L0, L3, L12].every(c => c.p < 0.001) ? 'each p < 0.001' : `p ${fp(L0.p)}, ${fp(L3.p)} and ${fp(L12.p)}`}). Since 2022 the same month dip holds (${sgn(dbl(pp0.coef), 1)}, ${sigTxt(pp0)}) but the rebounds are smaller (${sgn(dbl(pp3.coef), 1)} at 3 months, ${sigTxt(pp3)}; ${sgn(dbl(pp12.coef), 1)} at 12, ${sigTxt(pp12)}). Treat a claims jump as a reason to hold divorce spend that month and to plan, not commit, a lift 3 and 12 months out; ${enf ? `enforcement since 2022 is the clearest 3 month responder (${sgn(dbl(enf.coefs.lclaims_l3.coef), 1)}, ${sigTxt(enf.coefs.lclaims_l3)})` : 'watch modification and enforcement'}, and protective orders rebound at 12 months (${sgn(dbl(po.coefs.lclaims_l12.coef), 1)}, ${sigTxt(po.coefs.lclaims_l12)}).`,
        `<b>Lead with a consult where couples have separated but not filed.</b> ${refSep && refSepSh ? `Separation carries ${P(refSepSh.share, 0)} of the county variation the components explain (standardized β ${sg(refSep.b, 2)}, p ${fp(refSep.p)}, default model)` : 'Separation is a component of the index'}, and it rises as income falls (r ${N(GR.sep.r.r, 2)} against median income). In the top fifth of counties on separation (${N(sepQ, 0)} or more per 1,000 married${sepTop.length ? `; the largest graded A to C: ${sepTop.slice(0, 4).map(c => c.name).join(', ')}` : ''}), offer a first consult that explains the process and the cost, then a flat fee or a payment plan, and name legal aid for the cases the firm cannot take.`,
        `<b>Build gray divorce pages where the married population is older.</b> ${P(ST.acs.mar_55p_sh, 0)} of married Texans are 55 or over. Their yearly hazard is lower (${hz('age_55-59')} per 1,000 at 55 to 59, ${hz('age_60-64')} at 60 to 64, ${hz('age_65+')} at 65 and over, against ${hz('age_40-44')} at 40 to 44), but the pool is large. In the top fifth of counties by 55 and over share (${P(m55, 0)} or more of the married), the biggest pools are ${grayTop.slice(0, 4).map(c => c.name).join(', ')}. Pages on retirement division and late life property questions belong there (module 06, gray divorce).`,
        `<b>Remarriage is a service line, not only a risk.</b> A second marriage carries ${N(OR.timesb_2.or, 2)}× the odds of divorce and a third or later ${N(OR['timesb_3+'].or, 2)}× (both p ${fp(Math.max(OR.timesb_2.p, OR['timesb_3+'].p))}). Counties with many remarried couples are the audience for blended family questions, stepparent adoption and modification of existing orders.`,
        `<b>Buy clusters, not single counties.</b> ${qD ? `The index clusters in space (Moran's I ${N(qD.glob.I, 2)}, pseudo p ${fp(qD.glob.p_sim)}) and the composition hazard more so (${qH ? N(qH.glob.I, 2) : NA}). ${hh.length ? `The index's high among high cluster at p ≤ 0.05 includes ${hh.slice(0, 6).map(c => c.name).join(', ')}${hh.length > 6 ? ` and ${hh.length - 6} more` : ''}.` : ''} Neighboring counties share their scores, so a radius or a county group drawn around a cluster follows the way demand is laid out better than a list of scattered counties.` : 'The cluster tests are still computing; this reading fills in when they finish.'}`,
        `<b>The docket is not a demand map on its own.</b> Courts receive ${P(capState, 0)} of the divorces the composition model expects statewide, and capture varies widely by county (court capture against income, r ${N(GR.cap.r.r, 2)} in counties graded A to C). Use filings to size a county and the separation and hazard layers to find the places where couples have separated but not filed; never use a filing list to find people.`,
        `<b>Never target a person.</b> Every figure here describes a county, a court, a survey group or a month. ${pol.map(r => { const so = srcOf(r); return `${esc(r.t)}: ${esc(r.why.split('. ')[0].replace(/\.$/, ''))} (${so ? lnk(so.url, r.rule) : esc(r.rule)}).`; }).join(' ')} Target by keyword, geography and time; write in the third person; screen every ad in module 11 before it runs.`
      ];
      $('#evRead', root).innerHTML = items.map(x => `<li>${x}</li>`).join('');
    }
    readings();

    /* ---- 9. data integrity */
    const noMonthly = CTY.filter(c => !c.filings.monthly); const imp = ST.imputed || {}; const impN = Object.values(imp).reduce((a, b) => a + b.length, 0);
    const gaps = CTY.map(c => ({ c, g: repGap(c) })).filter(x => x.g);
    const warnYears = Object.keys(ST.warn_monthly || {}).reduce((o, m) => { const y = m.slice(0, 4); o[y] = (o[y] || 0) + ST.warn_monthly[m]; return o; }, {}); const warnMatch = Object.keys(warnYears).every(y => sum(CTY.map(c => ((c.warn || {})['y' + y] || {}).workers || 0)) === warnYears[y]);
    const lausGap = (() => { const u = ST.laus.ur; const i = u.findIndex(v => v == null); return i >= 0 ? ST.laus.t0 + i : null; })();
    const cv10 = CTY.filter(c => c.acs.married_cv > 0.1).length, cv20 = CTY.filter(c => c.acs.married_cv > 0.2).length; const noOff = CTY.filter(c => !c.rates.lawoffices).length;
    const zeroF = CTY.filter(c => !(c.rates.div_per_1k_married > 0)); const capHi = CTY.filter(c => isN(capOf(c)) && capOf(c) > 1);
    const a19 = ST.annual['2019'], a21 = ST.annual['2021']; const ivd = a => (a.f_ivd_pat || 0) + (a.f_ivd_sup || 0) + (a.f_ivd_uifsa || 0);
    const INT = [
      ['Counties without monthly court data', `${noMonthly.length} of ${CTY.length} counties report only annual totals; their trailing year is "${esc(noMonthly[0] ? noMonthly[0].filings.ttm_label : 'calendar 2025')}" while the ${CTY.length - noMonthly.length} metro counties use ${esc(ttmSpan())}. The claims panel uses monthly series only.`, 'Handled'],
      ['Imputed county months', `${impN} county months in ${Object.keys(imp).length} counties had no clerk report where the county normally files 30 or more cases: ${Object.keys(imp).map(f => `${esc(cname(f))} (${imp[f].map(t => tLabel(t)).join(', ')})`).join('; ')}. Each was filled with the same month of the adjacent year.`, 'Flagged'],
      ['Clerk reporting gaps', gaps.length ? `${gaps.length} ${gaps.length === 1 ? 'county reports' : 'counties report'} no divorce filings for three months or more after a normal year: ${gaps.map(x => `${esc(x.c.name)} (${x.g.months} months, about ${N(x.g.avg, 0)} a month before)`).join('; ')}. Their recent counts are incomplete.` : 'No county shows a run of three or more empty months after a normal year.', gaps.length ? 'Flagged' : 'Handled'],
      ['The 2020 court orders', `Statewide filings fell to ${N(trough.v)} in ${MOL[trough.t % 12]} ${Math.floor(trough.t / 12)} (${sgn((trough.v / trough.ago - 1) * 100, 0)} on a year earlier) under the emergency orders on in person proceedings. The panel carries a 2020 dummy and the cross correlations leave 2020 out.`, 'Handled'],
      ['Provisional months', `Filings for the last two months (through ${esc(fmtDateL(META.oca_through))}) rise as late clerk reports arrive.`, 'Documented'],
      ['Title IV-D reporting changed', `Statewide IV-D filings read ${N(ivd(a19))} in 2019 and ${N(ivd(a21))} in 2021; the Attorney General's reporting changed after 2019 and again in 2025, so IV-D counts are floors and stay out of private family totals.`, 'Documented'],
      ['Microdata geography is the PUMA', `The hazard model and the county composition come from Public Use Microdata Areas of about 100,000 people mapped to counties by 2020 tract population, so small counties share a region's composition. This is why the composition hazard clusters so strongly in space.`, 'Documented'],
      ['Survey margins', `${cv10} counties have a coefficient of variation over 10% on the married count and ${cv20} over 20%; they are graded C or D.`, 'Documented'],
      ['Zero divorce filings', `${zeroF.length} ${zeroF.length === 1 ? 'county files' : 'counties file'} no divorce in the trailing year (${zeroF.map(c => esc(c.name)).join(', ')}); they drop out of every log model on this page.`, 'Handled'],
      ['Capture over 100%', `${capHi.length} counties file more divorces than their composition predicts (${capHi.map(c => `${esc(c.name)} ${P(capOf(c), 0)}`).join(', ')}): small counties where a few cases swing the ratio, or where the modeled hazard runs low.`, 'Documented'],
      ['ZCTAs are not USPS ZIPs', `The ${N(ZC.length)} ZIP areas are Census ZIP Code Tabulation Areas from 2020; delivery ZIPs, PO box ZIPs and later changes do not match them exactly.`, 'Documented'],
      ['WARN notices without a county', `${warnMatch ? 'The statewide WARN series equals the sum of the county series in every year, so a notice listed without a county is in neither.' : 'The statewide WARN series and the county sums differ in some years; the difference is notices without a county.'} The live query in module 25 filters by county name and would miss one too. The portal also lags the TWC listing (snapshot through ${esc(fmtDateL(META.warn_through))}).`, 'Flagged'],
      ['Law offices cover all practice areas', `County Business Patterns 2023 counts offices of lawyers (NAICS 541110) of every kind, one vintage only; ${noOff} counties record none, so supply and filings per office are missing there.`, 'Documented'],
      ['DFPS fiscal years', 'Removals and family violence investigations follow the state fiscal year (September to August), not the calendar year of the court counts.', 'Documented'],
      ['A missing unemployment month', lausGap != null ? `${esc(tLabel(lausGap))} is missing from the unemployment series for every county (no household survey during the federal shutdown); charts leave the gap.` : 'No month is missing from the unemployment series.', 'Handled'],
      ['NCHS Texas counts', 'The national vital statistics divorce rate for Texas rests on district clerk reports and is known to be incomplete in some years; it is shown for the trend only.', 'Documented']
    ];
    $('#evInt', root).innerHTML = `<div class="tblbox"><div class="tblwrap ev-tw"><table class="t ev-int"><caption class="vh">Data integrity log</caption><thead><tr><th scope="col">Issue</th><th scope="col">What the data shows and what was done</th><th scope="col">Status</th></tr></thead><tbody>${INT.map(r => `<tr><td class="name">${esc(r[0])}</td><td>${r[1]}</td><td>${pill(r[2], r[2] === 'Flagged' ? 'up' : '')}</td></tr>`).join('')}</tbody></table></div></div>`;

    /* ---- 10. method, judgment calls, sources, grades */
    $('#evMeth', root).innerHTML = `<ul>
      <li><b>Monthly pair.</b> Statewide divorce filings by month from the Court Activity database; weekly initial claims grouped by the month of each week's end date and averaged per week, so four and five week months compare.</li>
      <li><b>Panel.</b> Read from the data (D.panel): log(filings + 1) on log claims per 1,000 labor force at lags 0, 3, 6, 9 and 12 with county, calendar month and year effects and a 2020 dummy, OLS clustered by county. A doubling of claims moves filings by 2^b − 1; its standard error is ln 2 × 2^b × SE. Cumulative p values use the normal approximation.</li>
      <li><b>Survival.</b> S(t) is the product of (1 − h/1,000) over the years before t, with h the hazard at each year of marriage; the band is the delta method on log S with the replicate standard errors. Group curves multiply the hazard by the group's odds ratio times a constant that makes the survey weighted groups average to 1.</li>
      <li><b>Median marriage duration.</b> The survey weighted median of years married across the duration bands, linear within the band that holds the middle.</li>
      <li><b>Cross section.</b> Ordinary least squares on the counties with every chosen component and a filing rate above zero; standardized coefficients from z scored variables; HC3 errors by default; 95% intervals on the t distribution; Shapley R² exact over every subset of the components on the same rows.</li>
      <li><b>Income gradient.</b> Pearson r and the elasticity (the slope of log capture or log separation on log median income, HC3 errors) on counties with both values; Spearman ρ as a check.</li>
      <li><b>Clusters.</b> Global Moran's I with the randomization variance and 999 permutations; local Moran I<sub>i</sub> = (n − 1) z<sub>i</sub> lag<sub>i</sub> / Σz² with 499 conditional permutations and a folded pseudo p; seeds fixed by measure and weights. Row standardized weights.</li>
      <li><b>Evidence matrix.</b> r is the weighted Pearson correlation with log filings per 1,000 married across the counties graded A or B (weights: square root of population), as in module 04; Spearman ρ across all counties as a check.</li></ul>`;
    $('#evJudg', root).innerHTML = `<ul>
      <li><b>A surge is a doubling.</b> Effects are shown per doubling of weekly claims (the coefficient times ln 2, exponentiated) because a doubling is the size of shock a county sees in a bad quarter; the elasticity view shows the raw coefficient.</li>
      <li><b>Groups keep the statewide shape.</b> The microdata give the duration curve only for all marriages, so group curves assume proportional hazards and use the adjusted odds ratios; graded C.</li>
      <li><b>Separation uses the index component.</b> The cluster test uses the separation rate as the index uses it, pulled toward the state by its survey error, so tiny counties do not dominate.</li>
      <li><b>Metro effects only where a metro has two counties in the sample.</b> A single county metro would get a dummy that fits it exactly and adds nothing; those join the non metro reference.</li>
      <li><b>Supply is mechanically related to filings.</b> Filings per law office has private family filings in its numerator, so part of its coefficient restates the outcome; untick it to see the model without it (the sample grows from the ${REF ? N(REF.std.n) : NA} counties with an office).</li>
      <li><b>Capture uses the composition hazard.</b> That hazard leaves income out by design, so the income gradient in capture mixes how often people file with how often they divorce.</li>
      <li><b>Contiguity from the map.</b> Counties are neighbors when their simplified outlines come within one map unit (under a mile) of each other; corners count. Six nearest centers is the alternative.</li>
      <li><b>No correction for many local tests.</b> With ${CTY.length} local tests some clusters appear by chance; the page says how many to expect and shows the stricter 0.01 level on request.</li>
      <li><b>Strength and tiers.</b> Strength is the size of r with the filing rate (Strong 0.40 or more, Moderate 0.20 to 0.40, Weak under 0.20); tiers grade the kind of evidence behind each signal (${esc(EV_TIER.A)}; ${esc(EV_TIER.B)}; ${esc(EV_TIER.C)}; ${esc(EV_TIER.D)}).</li></ul>`;
    const SRC = [
      ['Court filings', 'Texas Office of Court Administration, Court Activity Reporting and Directory System, district and county court family sections', 'A', 'monthly ' + seriesSpan(), 'https://card.txcourts.gov/'],
      ['Initial claims', 'Texas Workforce Commission, weekly unemployment insurance initial claims, state and county', 'A', 'weeks ending ' + fmtDate(ST.claims.week0) + ' to ' + fmtDate(META.ui_through), 'https://texaslmi.com/Home/PopularDownloads'],
      ['Claims panel', 'Severance panel model on the county series above (D.panel), 43 counties over 100,000 residents', 'B', '2019 to 2026', ''],
      ['Hazard model and duration curve', 'ACS 2020 to 2024 Public Use Microdata Sample, Texas, with replicate weights', 'A', YR(META.pums), 'https://www2.census.gov/programs-surveys/acs/data/pums/2024/5-Year/'],
      ['County composition, separation, income', 'American Community Survey five year estimates', 'A', YR(META.acs), 'https://data.census.gov/'],
      ['Unemployment', 'BLS Local Area Unemployment Statistics via Texas LMI', 'A', 'through ' + fmtDate(META.laus_through), 'https://texaslmi.com/LMIbyCategory/LAUS'],
      ['Layoff notices', 'Texas Workforce Commission WARN notices, Texas Open Data Portal', 'B', 'through ' + fmtDate(META.warn_through), 'https://data.texas.gov/dataset/Worker-Adjustment-and-Retraining-Notification-WARN/8w53-c4f6'],
      ['Law offices', 'Census County Business Patterns, NAICS 541110', 'B', '2023', 'https://www.census.gov/programs-surveys/cbp.html'],
      ['Child protection', 'DFPS Data Book, Texas Open Data Portal', 'B', YR(META.dfps), 'https://data.texas.gov/'],
      ['Boundaries', 'Census cartographic boundary files', 'A', YR(META.geo), 'https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html']
    ].concat(D.lit.map(l => [EV_LIT[l.key] ? EV_LIT[l.key].cat : 'Literature', l.cite, EV_LIT[l.key] ? EV_LIT[l.key].tier : 'B', '', l.url]));
    $('#evSrc', root).innerHTML = `<div class="ev-srcs">${SRC.map(s => `<div class="ev-src"><span class="grade ${s[2]}">${s[2]}</span><b>${esc(s[0])}</b><span class="tx">${s[4] ? lnk(s[4], s[1]) : esc(s[1])}${s[3] ? ' · ' + esc(s[3]) : ''}</span></div>`).join('')}</div>`;
    $('#evGrades', root).innerHTML = `<dl class="ev-gr"><dt><span class="grade A">A</span></dt><dd>Direct counts (court filings, claims, the survey's own tables) and Texas microdata estimates significant at 5%. The peak month, the trough and the hazard model's terms.</dd><dt><span class="grade B">B</span></dt><dd>Estimates from changes within counties over time significant at 1% (the panel), the synthetic cohort survival curve and its median, and the permutation tests on the map.</dd><dt><span class="grade C">C</span></dt><dd>Descriptive cross sections (the county regression and the income gradient), group survival curves under proportional hazards, panel estimates significant only at 5%, and pool measures in the matrix.</dd><dt><span class="grade D">D</span></dt><dd>Not distinguishable from zero, or context. Shown so the page is complete, not to act on.</dd></dl><p class="small">The readings are judgment built on these grades. Each one names its number so a reader can check the grade of what it rests on.</p>`;

    /* ---- exports */
    $('#evCsvTs', root).onclick = () => { const rows = []; for (let t = Math.min(t0, cFirst); t <= Math.max(tLast, cLast); t++) { const y = Math.floor(t / 12), mo = t % 12 + 1; const i = t - t0; rows.push({ month: `${y}-${String(mo).padStart(2, '0')}`, div: filingsM(t), div_k: i >= 0 && i < nF ? MS.div_k[i] : null, priv: i >= 0 && i < nF ? MS.priv[i] : null, po: i >= 0 && i < nF ? MS.po[i] : null, claims: claimsM(t), weeks: claimsW(t), seas: seas[t % 12] }); } exportText(expName('evidence_monthly', 'texas'), csv(rows, [{ l: 'Month', k: 'month' }, { l: 'Divorce filings', k: 'div', d: 0 }, { l: 'Divorce filings with children', k: 'div_k', d: 0 }, { l: 'Private family filings', k: 'priv', d: 0 }, { l: 'Protective order filings', k: 'po', d: 0 }, { l: 'Initial claims, average per week', k: 'claims', d: 0 }, { l: 'Weeks of claims in the month', k: 'weeks', d: 0 }, { l: 'Divorce seasonal index (2022 to 2025 = 100)', k: 'seas', d: 1 }])); };
    $('#evCsvEl', root).onclick = () => { const rows = []; Object.keys(PR).filter(k => PR[k] && PR[k].coefs).forEach(k => { const r = PR[k]; const ur = isUR(k); Object.keys(r.coefs).forEach(c => { const v = r.coefs[c]; rows.push({ spec: k, outcome: k.split('|')[0], driver: ur ? 'unemployment rate (points)' : 'log claims', sample: sampLab(k), lag: +((c.match(/_l(\d+)$/) || [0, 0])[1]), coef: v.coef, se: v.se, p: v.p, eff: ur ? pct1(v.coef) : dbl(v.coef), n: r.n, r2: r.r2, cum: r.cum, cum_se: r.cum_se, grade: rowGrade(r) }); }); }); exportText(expName('evidence_elasticities', 'texas'), csv(rows, [{ l: 'Specification', k: 'spec' }, { l: 'Outcome', k: 'outcome' }, { l: 'Driver', k: 'driver' }, { l: 'Sample', k: 'sample' }, { l: 'Lag (months)', k: 'lag', d: 0 }, { l: 'Coefficient', k: 'coef', d: 5 }, { l: 'Standard error', k: 'se', d: 5 }, { l: 'p', k: 'p', d: 6 }, { l: 'Percent per doubling (claims) or per point (unemployment)', k: 'eff', d: 2 }, { l: 'n (county months)', k: 'n', d: 0 }, { l: 'R squared', k: 'r2', d: 4 }, { l: 'Cumulative 0 to 12', k: 'cum', d: 5 }, { l: 'Cumulative SE', k: 'cum_se', d: 5 }, { l: 'Grade', k: 'grade' }])); };
    $('#evCsvReg', root).onclick = () => { if (!REG) { toast('No model to export: pick at least one component'); return; } const cfg = regCfg(); const rows = REG.std.coef.map((c, i) => ({ comp: c.name, b_std: c.b, se_std: c.se, lo: c.lo, hi: c.hi, p: c.p, b_raw: REG.raw.coef[i].b, se_raw: REG.raw.coef[i].se, shap: REG.sh.phi[i].share, n: REG.std.n, r2: REG.std.r2, r2fe: REG.std.r2fe, spec: `outcome ${cfg.y === 'log' ? 'log rate' : 'rate'}; counties ${cfg.s}; fixed effects ${cfg.fe}; errors ${cfg.se}; weights ${cfg.w}` })); exportText(expName('evidence_regression', 'texas'), csv(rows, [{ l: 'Component', k: 'comp' }, { l: 'Standardized coefficient', k: 'b_std', d: 4 }, { l: 'Standardized SE', k: 'se_std', d: 4 }, { l: '95% low', k: 'lo', d: 4 }, { l: '95% high', k: 'hi', d: 4 }, { l: 'p', k: 'p', d: 5 }, { l: 'Raw coefficient', k: 'b_raw', d: 6 }, { l: 'Raw SE', k: 'se_raw', d: 6 }, { l: 'Shapley share (%)', k: 'shap', d: 1, pct: true }, { l: 'Counties', k: 'n', d: 0 }, { l: 'R squared', k: 'r2', d: 4 }, { l: 'R squared, fixed effects alone', k: 'r2fe', d: 4 }, { l: 'Specification', k: 'spec' }])); };
    $('#evCsvLisa', root).onclick = () => { const ks = Object.keys(EV_MEAS).filter(k => LC[st.lw + '|' + k]); if (!ks.length) { toast('The cluster tests are still computing'); return; } const a = +st.la; const rows = CTY.slice().sort((x, y) => x.name.localeCompare(y.name)).map(c => { const o = { county: c.name, fips: c.fips }; ks.forEach(k => { const r = LC[st.lw + '|' + k]; const b = r.byF[c.fips]; o[k + '_v'] = EV_MEAS[k].v(c); o[k + '_c'] = b ? CLS[clsAt(r, c.fips, a)][0] : 'not tested'; o[k + '_i'] = b ? b.I : null; o[k + '_p'] = b ? b.p : null; }); return o; }); exportText(expName('evidence_clusters', st.lw === 'knn' ? 'texas-six-nearest' : 'texas-shared-border'), csv(rows, [{ l: 'County', k: 'county' }, { l: 'FIPS', k: 'fips' }].concat(ks.flatMap(k => [{ l: EV_MEAS[k].l, k: k + '_v', d: 2 }, { l: EV_MEAS[k].l + ': cluster at p ' + st.la, k: k + '_c' }, { l: EV_MEAS[k].l + ': local I', k: k + '_i', d: 4 }, { l: EV_MEAS[k].l + ': pseudo p', k: k + '_p', d: 3 }])))); };
    $('#evCsvMx', root).onclick = () => exportText(expName('evidence_matrix', 'texas'), csv(MX, [{ l: 'Kind', k: 'kind' }, { l: 'Signal or study', k: 'name' }, { l: 'Category', k: 'cat' }, { l: 'Expected direction', k: 'dir' }, { l: 'Strength', k: 'str' }, { l: 'Evidence tier', k: 'tier' }, { l: 'r with log filing rate (A and B counties, weighted)', k: 'r', d: 3 }, { l: 'Spearman with filing rate (all counties)', k: 'rho', d: 3 }, { l: 'Counties in r', k: 'n', d: 0 }, { l: 'Index component', k: 'idx' }, { l: 'Measured in Severance', k: 'measTxt' }, { l: 'Citation', k: r => r.cites.map(c => c.t).join('; ') }, { l: 'Links', k: r => r.cites.map(c => c.u).filter(Boolean).join(' ') }, { l: 'Texas note', k: 'note' }]));
    $('#evGoEcon', root).onclick = () => showModule('econ'); $('#evGoMkt', root).onclick = () => showModule('market'); $('#evGoSig', root).onclick = () => showModule('signals');

    runLisa();
    this.sync = () => { const f = store.get('sev.county', st.lSel); if (CI[f] && f !== st.lSel) { st.lSel = f; markSel(mapEl, f); const r = LC[st.lw + '|' + st.lm]; if (r) lisaSide(r); } };
  },
  onShow() { if (this.sync) this.sync(); }
});
