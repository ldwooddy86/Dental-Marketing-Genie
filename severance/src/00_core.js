/* SEVERANCE core: data, helpers, map, charts, tables */
'use strict';
// the stored theme goes on before the data is parsed, so the page does not flash in the other theme first
(function () { try { const t = JSON.parse(localStorage.getItem('sv.sev.theme')); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (e) { } })();
const D = window.__SEV_SUITE__ || JSON.parse(document.getElementById('suite-data').textContent);   // the extension loads data/suite.js; the single file carries a JSON script tag
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isN = v => typeof v === 'number' && isFinite(v);
const MINUS = s => String(s).replace(/^-/, '\u2212');
const NA = 'n/a';
const N = (v, d = 0) => isN(v) ? MINUS(v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })) : NA;
const P = (v, d = 1) => isN(v) ? MINUS((v * 100).toFixed(d)) + '%' : NA;
const P1 = (v, d = 1) => isN(v) ? MINUS(v.toFixed(d)) + '%' : NA;
const K = v => !isN(v) ? NA : MINUS(Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(Math.abs(v) >= 1e5 ? 0 : 1) + 'k' : N(v));
const $$$ = (v, d = 0) => isN(v) ? (v < 0 ? '\u2212$' + N(-v, d) : '$' + N(v, d)) : NA;
const updown = (v, d = 1) => !isN(v) ? NA : (v >= 0 ? 'up ' : 'down ') + N(Math.abs(v), d) + '%';
const sgn = (v, d = 1, suf = '%') => !isN(v) ? NA : (v > 0 ? '+' : '') + MINUS(v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })) + suf;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = a => a.reduce((x, y) => x + (y || 0), 0);
const mean = a => { const v = a.filter(isN); return v.length ? sum(v) / v.length : null; };
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MOL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const tLabel = t => MO[t % 12] + ' ' + Math.floor(t / 12);
// dates without hyphens: '2026-09-12' -> 'Sep 12, 2026'; '2026-08' -> 'Aug 2026'; '2026Q1' -> 'Q1 2026'
const fmtDate = iso => { if (!iso) return NA; const m = String(iso).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); if (!m) return String(iso); return m[3] ? `${MO[+m[2] - 1]} ${+m[3]}, ${m[1]}` : `${MO[+m[2] - 1]} ${m[1]}`; };
const fmtDateL = iso => { if (!iso) return NA; const m = String(iso).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); if (!m) return String(iso); return m[3] ? `${MOL[+m[2] - 1]} ${+m[3]}, ${m[1]}` : `${MOL[+m[2] - 1]} ${m[1]}`; };
const fmtQ = q => { const m = String(q || '').match(/^(\d{4})Q(\d)$/); return m ? `Q${m[2]} ${m[1]}` : (q || NA); };
const dateOf = d => `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
// metro names without hyphens: 'Dallas-Fort Worth-Arlington, TX' -> 'Dallas / Fort Worth / Arlington'
const dLocal = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso); };
const wkYearTicks = (week0, n) => { const w0 = dLocal(week0); const out = []; for (let y = w0.getFullYear(); y <= w0.getFullYear() + 15; y++) { const i = Math.round((new Date(y, 0, 15) - w0) / 6048e5); if (i >= 0 && i < n) out.push(i); } return out; };
const MNAME = t => String(t || '').replace(/, TX(-AR)?$/, '').replace(/-/g, ' / ');
// store.set returns true once saved and false when the browser refuses (storage full, or blocked); a full storage says so once a session
let STORE_FULL = false;
const store = {
  get(k, d) { try { const v = localStorage.getItem('sv.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) {
    try { localStorage.setItem('sv.' + k, JSON.stringify(v)); return true; }
    catch (e) { const full = !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message || ''))); if (full && !STORE_FULL) { STORE_FULL = true; try { if (typeof toast === 'function') toast('Browser storage is full; back up with Backup and clear old actuals'); } catch (_) { } } return false; }
  }
};
// confidence grades, defined once (the footer prints them; tiles, legends and CSV notes use them)
const GRADE_DEF = { A: 'primary and direct', B: 'primary with a caveat or a model on primary data', C: 'proxy or allocation', D: 'assumption' };
const gradeLegend = () => 'Grades: ' + Object.keys(GRADE_DEF).map(g => g + ' ' + GRADE_DEF[g]).join('; ');
function gradeChip(g) { const k = String(g || '').trim().toUpperCase()[0]; if (!GRADE_DEF[k]) return ''; return `<span class="grade ${k}" title="Confidence grade ${esc(String(g).trim())}: ${esc(GRADE_DEF[k])}">${esc(String(g).trim())}</span>`; }
// counties and ZIPs ship columnar ({__packed, cols, rows}, written by tools/extract.mjs); unpack them before anything reads them
(function unpackSuite() { const MISS = '\u0000'; const un = p => { const paths = p.cols.map(c => c.split('.')); return p.rows.map(r => { const o = {}; for (let i = 0; i < paths.length; i++) { const v = r[i]; if (v === MISS) continue; const ks = paths[i]; let t = o; for (let j = 0; j < ks.length - 1; j++) t = t[ks[j]] || (t[ks[j]] = {}); t[ks[ks.length - 1]] = v; } return o; }); }; ['zctas', 'counties'].forEach(k => { if (D[k] && D[k].__packed) D[k] = un(D[k]); }); })();
// ---- data indices
const CTY = D.counties; const CI = {}; CTY.forEach(c => CI[c.fips] = c);
const ZC = D.zctas; const ZI = {}; ZC.forEach(z => ZI[z.zip] = z);
const MSA = D.msas; const GEO = D.geo; const ST = D.state; const META = D.meta;
const YR = s => (typeof s !== 'string' || /^\d{4}-\d{2}(-\d{2})?$/.test(s)) ? s : s.replace(/ACS (\d{4})-(\d{4}) 5-year PUMS/g, 'ACS five year PUMS $1 to $2').replace(/ACS (\d{4})-(\d{4}) 5-year/g, 'ACS five year estimates, $1 to $2').replace(/FY(\d{4})-(\d{4})/g, 'FY$1 to FY$2').replace(/\b(1[89]\d\d|20\d\d)-(1[89]\d\d|20\d\d)\b/g, '$1 to $2');
Object.keys(META).forEach(k => { META[k] = YR(META[k]); }); (D.lit || []).forEach(l => { l.cite = YR(l.cite).replace(/: (\d+)-(\d+)/g, ': $1 to $2'); });
const CITYFIX = s => typeof s !== 'string' ? s : s.replace(/\bMc ([A-Z])/g, 'Mc$1').replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase()).replace(/\bDe ?[Ss]oto\b/g, 'DeSoto').replace(/\bJbsa\b/g, 'JBSA').replace(/\bFt\.? /g, 'Fort ');   // Mc Dade, Mckinney, Desoto and De Soto as the towns spell themselves
(D.zctas || []).forEach(z => { if (z.city) z.city = CITYFIX(z.city); }); (D.counties || []).forEach(c => ((c.warn || {}).recent || []).forEach(r => { if (r.city) r.city = CITYFIX(r.city); }));
// ---- data hygiene, once, before any module reads the data. DATA_FIX says what changed (the method module and the tests read it).
const DATA_FIX = { sentinels: 0, sentinelFields: {}, moved: [] };
// 1. The Census writes 'not available' as a code, not a number: -666666666 (cannot be computed), -999999999, -888888888, -555555555,
//    -333333333 and -222222222. Each becomes null, so it prints n/a, maps as no data and stays out of sums, sorts and scales.
(function acsSentinels() {
  const walk = (o, at) => { if (!o || typeof o !== 'object') return; const arr = Array.isArray(o); for (const k in o) { const v = o[k]; if (typeof v === 'number') { if (v <= -1e8) { o[k] = null; DATA_FIX.sentinels++; const p = at + (arr ? '[]' : k); DATA_FIX.sentinelFields[p] = (DATA_FIX.sentinelFields[p] || 0) + 1; } } else if (v && typeof v === 'object') walk(v, at + (arr ? '[]' : k) + '.'); } };
  (D.counties || []).forEach(c => walk(c, 'county.')); (D.zctas || []).forEach(z => walk(z, 'zip.')); Object.values(D.msas || {}).forEach(m => walk(m, 'metro.')); if (D.state) walk(D.state.acs, 'state.acs.');
})();
// 2. ZIP to county. The source gave each ZIP to the county holding most of its land, which hands some city ZIPs to the rural county next
//    door (79601 Abilene to Jones, 79705 Midland to Martin, 76310 Wichita Falls to Archer). A ZIP now belongs to the county holding most
//    of its residents wherever the data shows it:
//    - in the six Metro Atlas metros, from the block group populations: ZC_POP_COUNTY lists the ZIPs with a clear majority (60% or more
//      of the ZIP's block group residents) in a county other than the land county (tests/sevcore.test.mjs recomputes it from data/atlas-*.js);
//    - everywhere, the land county is kept unless its own population rules it out: its residents outside the ZIPs lying wholly inside it
//      are fewer than half the ZIP's, and then the ZIP goes to the county it touches, in the same metro, that has room for them.
//    Close calls stay with the land county; a move never leaves the ZIP's metro. The two counties' filings are then spread over their new
//    sets of ZIPs exactly as the source spreads them (married adults times the modeled hazard), so every county still sums to its clerk
//    count; the efficiency, opportunity and ZIP index percentiles are ranked again across all ZIPs.
//    z.county_raw keeps the source's land county.
const ZC_POP_COUNTY = { '78015': '48029', '78130': '48091', '78154': '48187', '78641': '48491' };
(function zipCounties() {
  const all = (GEO && GEO.zc_county_all) || {}; const solo = {};
  ZC.forEach(z => { z.county_raw = z.county; const a = all[z.zip]; if (!a || !a.length) return; const top = a.reduce((p, q) => q[1] > p[1] ? q : p); if (top[1] >= 0.99) solo[top[0]] = (solo[top[0]] || 0) + ((z.acs && z.acs.pop) || 0); });
  const room = f => CI[f] && CI[f].acs && isN(CI[f].acs.pop) ? CI[f].acs.pop - (solo[f] || 0) : Infinity;
  ZC.forEach(z => {
    let to = null, how = ''; const pin = ZC_POP_COUNTY[z.zip]; const pop = (z.acs && z.acs.pop) || 0;
    if (pin) { if (pin !== z.county) { to = pin; how = 'block group residents'; } }
    else if (pop && room(z.county) < pop / 2) { const ok = (all[z.zip] || []).filter(x => x[0] !== z.county && x[1] >= 0.005 && room(x[0]) >= pop / 2).sort((p, q) => q[1] - p[1]); if (ok.length) { to = ok[0][0]; how = 'county population'; } }
    if (to && CI[to] && CI[to].msa === z.msa) DATA_FIX.moved.push({ zip: z.zip, city: z.city, from: z.county, to, how, pop });
  });
  if (!DATA_FIX.moved.length) return;
  const touched = new Set();
  DATA_FIX.moved.forEach(m => { touched.add(m.from); touched.add(m.to); const z = ZI[m.zip], c = CI[m.to]; z.county = m.to; z.county_name = c.name; z.county_esi = c.esi; z.county_di = c.di; z.county_grade = c.grade; if (c.econ && c.econ.expected) z.county_econ = Object.assign({}, c.econ.expected); if (z.comp) z.comp.econ = c.comp_econ; });
  // the source's weight is married adults times the modeled hazard (it reproduces every ZIP's share exactly); the expected rate per
  // 1,000 married is the allocated count over married adults
  const w = z => ((z.acs && z.acs.married) || 0) * ((z.risk && z.risk.haz_pred) || 0);
  touched.forEach(f => {
    const c = CI[f]; const zs = ZC.filter(z => z.county === f); if (!c || !zs.length) return; const t = (c.filings && c.filings.ttm) || {}; const tot = sum(zs.map(w));
    zs.forEach(z => { const s = tot > 0 ? w(z) / tot : 0; z.alloc_share = s; if (z.alloc) Object.keys(z.alloc).forEach(k => { if (isN(t[k])) z.alloc[k] = Math.round(t[k] * s * 10) / 10; }); const mar = (z.acs && z.acs.married) || 0; if (z.alloc && isN(z.alloc.div)) z.exp_div_per_1k_married = mar > 0 ? z.alloc.div / mar * 1000 : null; if (z.paid && z.alloc && isN(z.alloc.priv)) { z.paid.opp = z.alloc.priv; z.paid.opp_per_office = z.paid.opp / ((z.paid.comp || 0) + 1); } if (z.comp && z.alloc && isN(z.alloc.priv)) z.comp.supply = Math.log((z.alloc.priv + 1) / ((z.lawoffices || 0) + 1)); });
  });
  // average rank percentiles across all ZIPs, as the source ranks them
  const rank = (get, set) => { const idx = ZC.map((z, i) => [get(z), i]).filter(p => isN(p[0])).sort((a, b) => a[0] - b[0]); const n = idx.length; for (let i = 0; i < n;) { let j = i; while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++; const r = 100 * ((i + j) / 2 + 1) / n; for (let k = i; k <= j; k++) set(ZC[idx[k][1]], r); i = j + 1; } };
  rank(z => z.paid && z.paid.opp, (z, r) => { z.paid.opp_pct = r; }); rank(z => z.paid && z.paid.opp_per_office, (z, r) => { z.paid.eff_pct = r; });
  rank(z => z.comp && z.comp.econ, (z, r) => { z.pct.econ = r; }); rank(z => z.comp && z.comp.supply, (z, r) => { z.pct.supply = r; });
  const W = D.zweights || {}; ZC.forEach(z => { if (!z.pct) return; let s = 0, d = 0; Object.keys(W).forEach(k => { if (isN(z.pct[k])) { s += W[k] * z.pct[k]; d += W[k]; } }); if (d) z.di = s / d; });
})();
const CO_KEEP = [[/chick\s*-\s*fil\s*-\s*a/ig, 'Chick-fil-A'], [/jeld\s*-\s*wen/ig, 'JELD-WEN'], [/\bt\s*-\s*mobile/ig, 'T-Mobile']];   // brand names keep their own spelling
const CO = s => { let t = String(s || ''); const keep = []; CO_KEEP.forEach(([re, v]) => { t = t.replace(re, () => { keep.push(v); return '\u0001' + (keep.length - 1) + '\u0001'; }); }); t = t.replace(/\b([A-Z])-(Shift)\b/g, '$1 $2').replace(/\s*-\s+|\s+-\s*/g, ' / ').replace(/([A-Za-z0-9.]{2,})-(?=[A-Z])/g, '$1 / ').replace(/\s{2,}/g, ' ').trim(); t = CO_DATED.reduce((x, re) => x.replace(re, ''), t).trim(); if ((t.match(/\(/g) || []).length > (t.match(/\)/g) || []).length) t = t.replace(/[\s,]+$/, '') + '…)'; return t.replace(/\u0001(\d+)\u0001/g, (m, k) => keep[+k]); };   // a name the filer's form cut off mid parenthesis is closed with an ellipsis
// WARN filers sometimes put the notice month in the company name ('Spirit Airlines (IAH) May 2026', 'Congo, LLC (Updated March 2026)'); the date has its own column
const CO_MON = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const CO_DATED = [new RegExp(`\\s*\\((?:updated\\s+)?(?:${CO_MON}\\s+)?(?:19|20)\\d{2}\\)\\s*$`, 'i'), new RegExp(`,?\\s+(?:updated\\s+)?${CO_MON}\\s+(?:19|20)\\d{2}(?=\\))`, 'i'), new RegExp(`\\s+(?:updated\\s+)?${CO_MON}\\s+(?:19|20)\\d{2}\\s*$`, 'i'), /(?<=\))\s+(?:19|20)\d{2}\s*$/];
const METRO_TABS = [
  { key: 'dfw', code: '19100', title: 'Dallas Fort Worth', num: '12' },
  { key: 'hou', code: '26420', title: 'Houston', num: '14' },
  { key: 'sat', code: '41700', title: 'San Antonio', num: '15' },
  { key: 'aus', code: '12420', title: 'Austin', num: '16' },
  { key: 'elp', code: '21340', title: 'El Paso', num: '17' },
  { key: 'rgv', code: ['32580', '15180'], title: 'Rio Grande Valley', num: '18' }
];
const OTHER_MSAS = Object.keys(MSA).filter(k => !['19100', '26420', '41700', '12420', '21340', '32580', '15180'].includes(k)).sort((a, b) => MSA[b].pop2025 - MSA[a].pop2025);
const cname = f => (CI[f] ? CI[f].name : f);
// statewide trailing twelve months from the monthly series, and its label ('Sep 2025 to Aug 2026'), both from the data
const stTTM = k => sum((ST.monthly[k] || []).slice(-12));
const ttmSpan = () => { const m = String(META.oca_through || '').match(/^(\d{4})-(\d{2})/); if (!m) return 'the last 12 months'; const t = +m[1] * 12 + (+m[2] - 1); return `${MO[(t - 11) % 12]} ${Math.floor((t - 11) / 12)} to ${MO[t % 12]} ${Math.floor(t / 12)}`; };
// the span of the monthly court series, 'January 2019 to August 2026'
const seriesSpan = () => { const t0 = ST.monthly.t0; return `${MOL[t0 % 12]} ${Math.floor(t0 / 12)} to ${fmtDateL(META.oca_through)}`; };
const qcewQ = q => fmtQ(q || META.qcew_through);   // 'Q1 2026'
const qcewPrev = () => { const m = String(META.qcew_through || '').match(/^(\d{4})Q(\d)$/); return m ? `Q${m[2]} ${+m[1] - 1}` : 'a year earlier'; };
// a clerk reporting gap: three or more trailing months of zero divorce filings after a year averaging three or more a month
function repGap(c) { const s = c && c.filings && c.filings.series; if (!s || !s.div) return null; const a = s.div; let n = 0; for (let i = a.length - 1; i >= 0 && a[i] === 0; i--) n++; if (n < 3) return null; const pr = a.slice(Math.max(0, a.length - n - 12), a.length - n).filter(isN); const avg = pr.length ? sum(pr) / pr.length : 0; return avg >= 3 ? { months: n, avg } : null; }
// ---- color ramps: single hue, light to dark in the light theme and dark to light in the dark theme, built in OKLCH on the green palette. forest = dissolution (ends on the dark green), leaf = economic shock, sage = family structure and strain, teal = supply, slate = population. Diverging layers run slate (down) to leaf (up) through a neutral gray. Old ramp names stay as aliases so module code reads the same.
const RAMP_NAMES = ['forest', 'leaf', 'sage', 'teal', 'slate']; const RALIAS = { ember: 'forest', steel: 'leaf', amber: 'sage', moss: 'teal' };
const RAMPS = {}; RAMP_NAMES.forEach(n => { RAMPS[n] = [0, 1, 2, 3, 4, 5, 6, 7].map(i => `var(--rp-${n}-${i})`); }); Object.keys(RALIAS).forEach(a => { RAMPS[a] = RAMPS[RALIAS[a]]; });
// ramp colors are CSS variables so maps and tiles follow the theme without a redraw; light and dark values live in app.css
function inkOn(hex) { if (/^var\(--rp-/.test(String(hex))) return String(hex).replace(/\)$/, '-ink)'); const h = String(hex || '').replace('#', ''); if (h.length !== 6) return 'var(--ink)'; const c = [0, 2, 4].map(i => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0652 ? '#ffffff' : '#11261b'; }
function rampColor(name, t) { const r = RAMPS[name] || RAMPS.ember; if (!isN(t)) return null; const i = clamp(Math.floor(t * r.length), 0, r.length - 1); return r[i]; }
function divergeColor(t) { // t in [-1,1]; slate negative, leaf positive, neutral gray midpoint
  if (!isN(t)) return null; const a = clamp(Math.abs(t), 0, 1); const steps = t < 0 ? RAMPS.slate : RAMPS.leaf; if (a < 0.08) return 'var(--rp-mid)'; return steps[clamp(Math.floor(a * 7) + 1, 1, 7)];
}
function rampCSS(name) { return 'linear-gradient(90deg,' + RAMPS[name].join(',') + ')'; }
function quantScale(vals) { const v = vals.filter(isN).sort((a, b) => a - b); if (!v.length) return () => null; const q = p => v[clamp(Math.floor(p * (v.length - 1)), 0, v.length - 1)]; const lo = q(0.02), hi = q(0.98); return x => !isN(x) ? null : hi === lo ? 0.5 : clamp((x - lo) / (hi - lo), 0, 1); }
function pctScale(vals) { const v = vals.filter(isN).sort((a, b) => a - b); return x => { if (!isN(x) || !v.length) return null; let lo = 0, hi = v.length; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x) lo = m + 1; else hi = m; } return v.length > 1 ? lo / (v.length - 1) : 0.5; }; }
// ---- tooltip: placed beside the pointer and clamped inside the viewport on every side. On a touch screen a tap shows it briefly
// (the browser sends a mouse move after the tap), a map tap hides it at once because the side panel shows the selection, and any new
// touch or a scroll hides it.
const tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl);
let TIP_TOUCH = -1e9, TIP_T = 0;
const tipFromTouch = () => performance.now() - TIP_TOUCH < 900;
function showTip(html, x, y) {
  tipEl.innerHTML = html; tipEl.style.display = 'block';
  const vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let L = x + 14, T = y + 14; if (L + w > vw - 8) L = x - w - 14; if (T + h > vh - 8) T = y - h - 14;
  L = clamp(L, 8, Math.max(8, vw - w - 8)); T = clamp(T, 8, Math.max(8, vh - h - 8));
  tipEl.style.left = L + window.scrollX + 'px'; tipEl.style.top = T + window.scrollY + 'px';
  clearTimeout(TIP_T); if (tipFromTouch()) TIP_T = setTimeout(hideTip, 2600);
}
function hideTip() { clearTimeout(TIP_T); tipEl.style.display = 'none'; }
tipEl.style.position = 'absolute';
document.addEventListener('touchstart', () => { TIP_TOUCH = performance.now(); hideTip(); }, { passive: true, capture: true });
document.addEventListener('touchend', () => { TIP_TOUCH = performance.now(); }, { passive: true, capture: true });
window.addEventListener('scroll', () => { if (tipFromTouch()) hideTip(); }, { passive: true });
// ---- sizes: charts draw at their container's real width so the text stays 11 to 13 px from a phone to a wide screen. One shared
// ResizeObserver redraws them (and rescales map labels) when the width changes; elements that left the page are dropped.
const SIZE_EL = new Set(); let SIZE_Q = new Set(), SIZE_RAF = 0;
const SIZE_RO = typeof ResizeObserver === 'function' ? new ResizeObserver(es => { es.forEach(e => SIZE_Q.add(e.target)); if (!SIZE_RAF) SIZE_RAF = requestAnimationFrame(sizeFlush); }) : null;
function sizeFlush() {
  SIZE_RAF = 0; const q = SIZE_Q; SIZE_Q = new Set();
  q.forEach(el => { const d = el.__sev; if (!d || !el.isConnected) { sizeForget(el); return; } const w = Math.round(el.clientWidth); if (!w) return; if (d.map) { mapScale(el); return; } if (Math.abs(w - d.w) >= (d.w ? 24 : 1)) { try { d.fn(el, d.o); } catch (e) { console.error(e); } } });
}
function sizeForget(el) { if (SIZE_RO) SIZE_RO.unobserve(el); SIZE_EL.delete(el); }
function sizeWatch(el, d) { el.__sev = d; if (!SIZE_RO) return; SIZE_EL.forEach(x => { if (!x.isConnected) sizeForget(x); }); if (!SIZE_EL.has(el)) { SIZE_EL.add(el); SIZE_RO.observe(el); } }
if (!SIZE_RO) window.addEventListener('resize', debounceCore(() => { SIZE_EL.forEach(el => SIZE_Q.add(el)); sizeFlush(); }, 150));
function debounceCore(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
// text width in px for chart layout, measured in the chart font (an estimate where canvas text is not available)
const TXW = {}; let TXC = null;
function textW(t, px) { t = String(t == null ? '' : t); const k = px + '|' + t; if (TXW[k] != null) return TXW[k]; let w = null; try { if (TXC === null) { const c = document.createElement('canvas'); TXC = (c && c.getContext && c.getContext('2d')) || false; } if (TXC) { TXC.font = `${px}px Roboto, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`; w = TXC.measureText(t).width; } } catch (e) { w = null; } if (!isN(w) || w <= 0) w = t.length * px * 0.55; return (TXW[k] = w); }
// the width a chart draws at: the container's own width when it is on screen, the caller's W otherwise (a hidden module)
function chartBox(el, o, W0, H0) { const cw = o.fixed ? 0 : Math.round(el.clientWidth || 0); const W = cw >= 120 ? cw : W0; return { W, H: cw >= 120 && H0 ? Math.round(H0 * clamp(cw / W0, 0.85, 1.35)) : H0, live: cw >= 120 }; }
// ---- choropleth
// drawMap(el, o) draws an SVG choropleth into el (a .mapwrap) and returns the svg element, which also carries the map handle's
// methods (see mapHandle). o:
//   {W, H, paths:{id:d}, value:id=>num, color:num=>css, label:id=>html, onSelect, selected, counties:{id:d}, outline, cent:{id:[x,y]},
//    labels:[ids], labelText:id=>text, ramp, legend:{title, min, max, css, grade}, noDataLabel, title,
//    alt:{test:id=>bool, color, label}   a second empty class with its own swatch, for areas whose value is a true zero rather than missing,
//    view:[x,y,w,h]                      draw only that part of the map (a metro), in map units (the home view),
//    zoom                                false turns zoom and pan off (on by default): drag to pan once zoomed in, pinch, Ctrl or Cmd and the
//                                        wheel (a plain wheel scrolls the page and shows a hint), double click (Shift zooms out), the + − ⌂
//                                        buttons, and with the map focused + and −, the arrow keys, 0 or Home, Enter selects the area in the middle,
//    maxZoom                             16 by default (the home view's width over the narrowest view),
//    fit:[ids] (or fitTo)                frame those areas (or a box [x,y,w,h]) when drawn; applied again only when the list changes,
//    dim:Set|[ids]|null                  areas outside the set are faded (the scope); kept across redraws until a call passes dim again,
//    pins:[{x, y, shape:'circle'|'diamond'|'square', r, fill, label, title, tip, cls}] marks in map units, drawn at a constant screen size
//                                        (r in px, 6 by default); kept across redraws until a call passes pins again,
//    onPin:(pin, i)=>{}                  a click on a pin (without it a click passes to the area under the pin),
//    reset:true                          forget the zoom kept from the last draw}
// The zoom, dim and pins survive a redraw of the same geometry and home view (a layer change); a new view or geometry starts at home.
const MAP_BB = new WeakMap();
// an area's bounding box in map units, parsed once per geometry (every path is absolute 'M x,y x,y ... Z' rings)
function mapBBox(paths, id) {
  if (!paths) return null; let c = MAP_BB.get(paths); if (!c) { c = {}; MAP_BB.set(paths, c); } if (id in c) return c[id];
  const n = String(paths[id] || '').match(/-?\d+(?:\.\d+)?/g) || []; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) { const x = +n[i], y = +n[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return (c[id] = isFinite(x0) ? [x0, y0, x1, y1] : null);
}
// the area that holds a point (map units): bounding boxes first, then an even odd ray test on the rings
function mapAreaAt(paths, x, y) {
  let hit = null;
  for (const id in paths) {
    const b = mapBBox(paths, id); if (!b || x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    let inside = false; String(paths[id]).split(/[Mm]/).forEach(ring => { const n = ring.match(/-?\d+(?:\.\d+)?/g) || []; for (let i = 0, j = n.length - 2; i + 1 < n.length; j = i, i += 2) { const xi = +n[i], yi = +n[i + 1], xj = +n[j], yj = +n[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi) inside = !inside; } });
    if (inside) { hit = id; break; }
  }
  return hit;
}
const MAP_HELP = '. Hold Ctrl or Cmd and scroll, pinch, or double click to zoom; drag to move once zoomed in. With the map focused, plus and minus zoom, the arrow keys move it, 0 goes back and Enter selects the area in the middle.';
function mapPinsSVG(list) {
  return (list || []).map((p, i) => {
    if (!p || !isN(p.x) || !isN(p.y)) return '';
    const r = isN(p.r) ? p.r : 6, f = p.fill || 'var(--ink)', sh = p.shape || 'circle', q = (r * 1.35).toFixed(2);
    const mark = sh === 'diamond' ? `<path d="M0 -${q}L${q} 0L0 ${q}L-${q} 0Z" fill="${esc(f)}"></path>` : sh === 'square' ? `<rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" fill="${esc(f)}"></rect>` : `<circle r="${r}" fill="${esc(f)}"></circle>`;
    return `<g class="pin${p.cls ? ' ' + esc(p.cls) : ''}" data-pin="${i}" style="transform:translate(${(+p.x).toFixed(2)}px,${(+p.y).toFixed(2)}px) scale(var(--u,1))">${mark}${p.label ? `<text class="pinl" x="${(sh === 'circle' ? r : r * 1.35) + 3}" y="4">${esc(p.label)}</text>` : ''}</g>`;
  }).join('');
}
function drawMap(el, o) {
  const vb = o.view ? o.view.map(v => +(+v).toFixed(1)) : [0, 0, o.W, o.H];
  const zoom = o.zoom !== false; const prev = el.__mz;
  const keep = !!prev && !o.reset && prev.paths === o.paths && prev.home0.join(' ') === vb.join(' ');
  const mz = keep ? prev : { paths: o.paths, home0: vb.slice(), home: vb.slice(), v: vb.slice(), pins: null, dim: null, fitKey: '', set: '' };
  if (!keep && prev && prev.paths === o.paths) { mz.pins = prev.pins; mz.dim = prev.dim; }   // a new home view on the same geometry keeps the marks
  mz.W = o.W; mz.H = o.H; mz.max = isN(o.maxZoom) && o.maxZoom >= 1 ? o.maxZoom : 16; mz.o = o; el.__mz = mz;
  if (o.pins !== undefined) mz.pins = o.pins || null;
  if (o.dim !== undefined) mz.dim = o.dim ? (o.dim instanceof Set ? o.dim : new Set(o.dim)) : null;
  const fitIds = o.fit || o.fitTo; if (fitIds) { const k = [].concat(fitIds).join(','); if (k !== mz.fitKey) { mz.fitKey = k; const b = mapFitBox(mz, fitIds); if (b) mz.v = b; } } else mz.fitKey = '';
  const vbs = mz.v.map(n => +(+n).toFixed(2)).join(' '); mz.set = vbs;
  const ttl = o.title || 'map';
  const svg = [`<svg viewBox="${vbs}" ${zoom ? `role="application" aria-roledescription="map" tabindex="0" aria-label="${esc(ttl + MAP_HELP)}"` : `role="img" aria-label="${esc(ttl)}"`}><g class="areas">`];
  for (const id in o.paths) {
    const v = o.value(id); const c = isN(v) ? o.color(v) : (o.alt && o.alt.test(id) ? o.alt.color : null);
    svg.push(`<path class="area${o.selected === id ? ' sel' : ''}${mz.dim && !mz.dim.has(id) ? ' dim' : ''}" data-id="${id}" d="${o.paths[id]}" fill="${c || 'var(--nodata)'}"></path>`);
  }
  svg.push('</g>');
  if (o.counties) for (const id in o.counties) svg.push(`<path class="cty" d="${o.counties[id]}"></path>`);
  if (o.outline) svg.push(`<path class="outline" d="${o.outline}"></path>`);
  if (o.labels && o.cent) o.labels.forEach(id => { const p = o.cent[id]; if (p) svg.push(`<text class="lbl" x="${p[0]}" y="${p[1]}" text-anchor="middle">${esc(o.labelText ? o.labelText(id) : id)}</text>`); });
  svg.push(`<g class="pins">${mapPinsSVG(mz.pins)}</g></svg>`);
  // the zoom buttons and the scroll hint sit over the map; the cross marks the area Enter selects while the map has keyboard focus
  const ctl = zoom ? `<div class="zoomctl mzc"><button type="button" data-mz="in" aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg></button><button type="button" data-mz="out" aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg></button><button type="button" data-mz="home" aria-label="Back to the whole map" title="Back to the whole map"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8.5L8 3l5.5 5.5M4.5 7v6h7V7"/></svg></button></div><div class="maphint" aria-hidden="true">Hold Ctrl or Cmd and scroll to zoom</div><div class="mzx" aria-hidden="true"></div>` : '';
  let leg = '';
  // the legend keeps its pieces together on a phone: the title, then [min ramp max], then each no data swatch with its label
  if (o.legend) leg = `<div class="legend"><span class="lt">${esc(o.legend.title || '')}${o.legend.grade ? ' ' + gradeChip(o.legend.grade) : ''}</span><span class="lr"><span class="num">${esc(o.legend.min)}</span><span class="ramp" style="background:${o.legend.css || rampCSS(o.ramp || 'ember')}"></span><span class="num">${esc(o.legend.max)}</span></span>${o.alt ? `<span class="lnd"><span class="nd" style="background:${o.alt.color}"></span><span>${esc(o.alt.label)}</span></span>` : ''}<span class="lnd"><span class="nd"></span><span>${esc(o.noDataLabel || 'no data')}</span></span></div>`;
  el.innerHTML = svg.join('') + ctl + leg;
  el.classList.toggle('mz', zoom);
  const s = el.querySelector(':scope > svg');
  s.addEventListener('mousemove', e => {
    const pg = e.target.closest && e.target.closest('g.pin'); if (pg) { const p = (mz.pins || [])[+pg.dataset.pin]; if (p && (p.tip || p.title || p.label)) showTip(p.tip || `<b>${esc(p.title || p.label)}</b>`, e.clientX, e.clientY); else hideTip(); return; }
    const p = e.target.closest('path.area'); if (!p) { hideTip(); return; } showTip(o.label(p.dataset.id), e.clientX, e.clientY);
  });
  s.addEventListener('mouseleave', hideTip);
  s.addEventListener('click', e => {
    const pg = e.target.closest && e.target.closest('g.pin');
    if (pg) { const i = +pg.dataset.pin, p = (mz.pins || [])[i]; if (p && o.onPin) { o.onPin(p, i); return; } const a = p ? mapAreaAt(o.paths, p.x, p.y) : null; if (a && o.onSelect) o.onSelect(a); return; }
    const p = e.target.closest('path.area'); if (!p) return; if (o.onSelect) o.onSelect(p.dataset.id); if (tipFromTouch()) hideTip();
  });
  if (zoom) mapWire(el, s, mz);
  el.__mapW = vb[2]; mapScale(el); sizeWatch(el, { map: true });
  const h = mapHandle(el); ['fit', 'dim', 'pins', 'select', 'reset', 'zoomBy'].forEach(k => { s[k] = h[k]; });
  return s;
}
// the frame for a list of area ids (or a box [x,y,w,h]) at the home view's shape, padded, no closer than the zoom limit
function mapFitBox(mz, ids, pad) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const add = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
  const list = [].concat(ids || []);
  if (list.length === 4 && list.every(isN)) add(list[0], list[1], list[0] + list[2], list[1] + list[3]);
  else list.forEach(id => { const b = mapBBox(mz.paths, id); if (b) add(b[0], b[1], b[2], b[3]); else { const c = mz.o && mz.o.cent && mz.o.cent[id]; if (c) add(c[0], c[1], c[0], c[1]); } });
  if (!isFinite(x0)) return null;
  const asp = mz.home[2] / mz.home[3]; let w = x1 - x0, h = y1 - y0; const m = Math.max(w, h) * (isN(pad) ? pad : 0.12) + 2; w += 2 * m; h += 2 * m;
  if (w / h < asp) w = h * asp; else h = w / asp;
  const minW = mz.home[2] / mz.max; if (w < minW) { w = minW; h = w / asp; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; return mapClamp(mz, [cx - w / 2, cy - h / 2, w, h]);
}
// a view stays over the map: the pan bounds are the whole geometry and the home view; a view wider than them is centered
function mapClamp(mz, v) {
  const h0 = mz.home; const bx0 = Math.min(0, h0[0]), by0 = Math.min(0, h0[1]), bx1 = Math.max(mz.W || h0[2], h0[0] + h0[2]), by1 = Math.max(mz.H || h0[3], h0[1] + h0[3]);
  let [x, y, w, h] = v; const bw = bx1 - bx0, bh = by1 - by0;
  x = w >= bw ? bx0 + (bw - w) / 2 : clamp(x, bx0, bx1 - w); y = h >= bh ? by0 + (bh - h) / 2 : clamp(y, by0, by1 - h);
  return [x, y, w, h];
}
const mapCanPan = mz => { const b = mapClamp(mz, [-1e9, -1e9, mz.v[2], mz.v[3]]), c = mapClamp(mz, [1e9, 1e9, mz.v[2], mz.v[3]]); return Math.abs(c[0] - b[0]) > 0.5 || Math.abs(c[1] - b[1]) > 0.5; };
// a module may set the svg's viewBox itself after drawing (the Site Forge frames its counties): that frame becomes home
function mapAdopt(el, s, mz) { const cur = s.getAttribute('viewBox'); if (cur && cur !== mz.set) { const a = cur.split(/[\s,]+/).map(Number); if (a.length === 4 && a.every(isN) && a[2] > 0 && a[3] > 0) { mz.v = a; mz.home = a.slice(); mz.set = cur; } } }
function mapApply(el, s, mz) { hideTip(); const vbs = mz.v.map(n => +n.toFixed(2)).join(' '); s.setAttribute('viewBox', vbs); mz.set = vbs; el.classList.toggle('zoomed', mz.home[2] / mz.v[2] > 1.01); mapScale(el); }
// zoom by f (below 1 zooms in) about a screen point, or about the middle of the view without one
function mapZoomAt(el, s, mz, cx, cy, f) {
  mapAdopt(el, s, mz); const v = mz.v; let p = null;
  if (isN(cx)) { const m = s.getScreenCTM && s.getScreenCTM(); if (m && m.a) { const q = s.createSVGPoint(); q.x = cx; q.y = cy; const r = q.matrixTransform(m.inverse()); p = [r.x, r.y]; } }
  if (!p) p = [v[0] + v[2] / 2, v[1] + v[3] / 2];
  const asp = v[2] / v[3]; const h0 = mz.home; const bw = Math.max(mz.W || 0, h0[0] + h0[2]) - Math.min(0, h0[0]), bh = Math.max(mz.H || 0, h0[1] + h0[3]) - Math.min(0, h0[1]);
  const nw = clamp(v[2] * f, h0[2] / mz.max, Math.max(h0[2], bw, bh * asp)); const r = nw / v[2];
  mz.v = mapClamp(mz, [p[0] - (p[0] - v[0]) * r, p[1] - (p[1] - v[1]) * r, nw, v[3] * r]); mapApply(el, s, mz);
}
// the middle of the svg in the map element's own box (an svg has no offsetTop)
function mapMid(el, s) { const a = el.getBoundingClientRect(), b = s.getBoundingClientRect(); return [b.left - a.left + b.width / 2, b.top - a.top + b.height / 2]; }
function mapHint(el, s) { const h = el.querySelector(':scope > .maphint'); if (!h) return; h.style.top = mapMid(el, s)[1] + 'px'; h.classList.add('on'); clearTimeout(el.__mzHint); el.__mzHint = setTimeout(() => h.classList.remove('on'), 1300); }
function mapWire(el, s, mz) {
  const ptrs = new Map(); let drag = null, pinch = null; mz.dragged = false;
  s.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; mapAdopt(el, s, mz);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); mz.dragged = false;
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, v: mz.v.slice(), on: false };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, v: mz.v.slice(), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; drag = null; }
  });
  s.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1; mz.dragged = true; hideTip(); mz.v = pinch.v.slice(); mapZoomAt(el, s, mz, pinch.mx, pinch.my, pinch.d / d); return; }
    if (!drag || ptrs.size !== 1) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) { if (Math.abs(dx) + Math.abs(dy) < 5 || !mapCanPan(mz)) return; drag.on = true; mz.dragged = true; try { s.setPointerCapture(e.pointerId); } catch (_) { } el.classList.add('mdrag'); hideTip(); }
    const m = s.getScreenCTM && s.getScreenCTM(); if (!m || !m.a) return;
    mz.v = mapClamp(mz, [drag.v[0] - dx / m.a, drag.v[1] - dy / m.d, drag.v[2], drag.v[3]]); mapApply(el, s, mz);
  });
  const end = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { drag = null; el.classList.remove('mdrag'); } };
  s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end); s.addEventListener('lostpointercapture', end);
  // the click that ends a drag or a pinch is not a selection (a capture listener on the svg runs before the selection listener)
  s.addEventListener('click', e => { if (mz.dragged) { mz.dragged = false; e.stopImmediatePropagation(); } }, true);
  // a plain wheel scrolls the page and shows the hint; Ctrl or Cmd (and a trackpad pinch, which arrives as a Ctrl wheel) zooms
  s.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) { mapHint(el, s); return; } e.preventDefault(); mapZoomAt(el, s, mz, e.clientX, e.clientY, Math.exp(clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1), -120, 120) * 0.0022)); }, { passive: false });
  s.addEventListener('dblclick', e => { e.preventDefault(); mapZoomAt(el, s, mz, e.clientX, e.clientY, e.shiftKey ? 2 : 0.5); });
  s.addEventListener('focus', () => { const x = el.querySelector(':scope > .mzx'); if (x) { const m = mapMid(el, s); x.style.left = m[0] + 'px'; x.style.top = m[1] + 'px'; } });
  s.addEventListener('keydown', e => {
    const k = e.key; if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (k === '+' || k === '=' || k === '-' || k === '_') { e.preventDefault(); mapZoomAt(el, s, mz, null, null, k === '+' || k === '=' ? 0.6 : 1 / 0.6); return; }
    if (k === '0' || k === 'Home') { e.preventDefault(); mapAdopt(el, s, mz); mz.v = mz.home.slice(); mapApply(el, s, mz); return; }
    if (/^Arrow/.test(k) && mapCanPan(mz)) { e.preventDefault(); const st = mz.v[2] * 0.12, sy = mz.v[3] * 0.12; mz.v = mapClamp(mz, [mz.v[0] + (k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0), mz.v[1] + (k === 'ArrowUp' ? -sy : k === 'ArrowDown' ? sy : 0), mz.v[2], mz.v[3]]); mapApply(el, s, mz); return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); const id = mapAreaAt(mz.paths, mz.v[0] + mz.v[2] / 2, mz.v[1] + mz.v[3] / 2); if (id && mz.o.onSelect) mz.o.onSelect(id); }
  });
  $$(':scope > .mzc button', el).forEach(b => b.onclick = () => { const z = b.dataset.mz; if (z === 'home') { mapAdopt(el, s, mz); mz.v = mz.home.slice(); mapApply(el, s, mz); } else mapZoomAt(el, s, mz, null, null, z === 'in' ? 0.6 : 1 / 0.6); });
  el.classList.toggle('zoomed', mz.home[2] / mz.v[2] > 1.01);
}
// mapHandle(el): one handle per map element that survives redraws: fit(ids, pad), dim(set|null), pins(list|null), select(id),
// reset(), zoomBy(f) (below 1 zooms in), view() → [x,y,w,h], level() → home width over view width. Each returns the handle.
function mapHandle(el) {
  if (el.__map) return el.__map;
  const S = () => el.querySelector(':scope > svg'); const Z = () => el.__mz;
  const h = {
    fit(ids, pad) { const s = S(), mz = Z(); if (!s || !mz) return h; mapAdopt(el, s, mz); const b = mapFitBox(mz, ids, pad); if (b) { mz.v = b; mapApply(el, s, mz); } return h; },
    dim(set) { const s = S(), mz = Z(); if (!mz) return h; mz.dim = set ? (set instanceof Set ? set : new Set(set)) : null; if (s) $$('path.area', s).forEach(p => p.classList.toggle('dim', !!mz.dim && !mz.dim.has(p.dataset.id))); return h; },
    pins(list) { const s = S(), mz = Z(); if (!mz) return h; mz.pins = list || null; const g = s && s.querySelector('g.pins'); if (g) g.innerHTML = mapPinsSVG(mz.pins); return h; },
    select(id) { const mz = Z(); if (mz && mz.o) mz.o.selected = id; markSel(el, id); return h; },
    reset() { const s = S(), mz = Z(); if (!s || !mz) return h; mapAdopt(el, s, mz); mz.v = mz.home.slice(); mapApply(el, s, mz); return h; },
    zoomBy(f) { const s = S(), mz = Z(); if (s && mz && isN(f) && f > 0) mapZoomAt(el, s, mz, null, null, f); return h; },
    view() { const mz = Z(); return mz ? mz.v.slice() : null; },
    level() { const mz = Z(); return mz ? mz.home[2] / mz.v[2] : 1; }
  };
  return (el.__map = h);
}
// map labels and pins are in map units; scale them so they read at about 11 px whatever the map's width and zoom, and hide the
// labels below 600 px until the map is zoomed in
function mapScale(el) {
  const s = el.querySelector(':scope > svg'); if (!s) return; const vb = String(s.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const vw = vb.length === 4 && vb[2] > 0 ? vb[2] : el.__mapW; if (!vw) return; const cw = s.clientWidth || el.clientWidth; if (!cw) return;
  const ch = s.clientHeight; let u = vw / cw; if (vb.length === 4 && vb[3] > 0 && ch) u = Math.max(u, vb[3] / ch);
  s.style.setProperty('--u', u.toFixed(4)); const mz = el.__mz; el.classList.toggle('nolbl', cw < 600 && !(mz && mz.home[2] / vw >= 1.8));
}
function markSel(el, id) { $$('path.area', el).forEach(p => p.classList.toggle('sel', p.dataset.id === id)); if (id) { const p = el.querySelector(`path.area[data-id="${id}"]`); if (p) p.parentNode.appendChild(p); } }
// pins: map units from degrees on any map ('state' or a metro code; the maps are linear in their bounds, good to about 2 km), a ZIP's
// center on a map, the firm's offices as diamonds, and the courthouses of every Metro Atlas file already loaded
function mapXY(geo, lon, lat) { const M = !geo || geo === 'state' ? GEO.state : GEO.metros[geo]; if (!M || !M.bounds || !isN(lon) || !isN(lat)) return null; const b = M.bounds; return [(lon - b[0]) / (b[2] - b[0]) * M.W, (b[3] - lat) / (b[3] - b[1]) * M.H]; }
function zipXY(geo, zip) {
  const z = ZI[String(zip || '').trim()]; if (!z) return null; const M = GEO.metros[z.msa];
  if (geo && geo !== 'state') { const G = GEO.metros[geo]; return G && G.zcent && G.zcent[z.zip] ? G.zcent[z.zip].slice() : null; }
  if (!M || !z.cent || !M.bounds) return GEO.state.cent[z.county] ? GEO.state.cent[z.county].slice() : null; const b = M.bounds;
  return mapXY('state', b[0] + z.cent[0] / M.W * (b[2] - b[0]), b[3] - z.cent[1] / M.H * (b[3] - b[1]));
}
function firmPins(geo) {
  if (typeof FIRM === 'undefined' || !FIRM.get) return []; const F = FIRM.get();
  return (F.offices || []).map(of => { const zip = String(of.zip || '').trim(); const fips = of.county || (ZI[zip] || {}).county || ''; let xy = zipXY(geo, zip);
    if (!xy && (!geo || geo === 'state') && GEO.state.cent[fips]) xy = GEO.state.cent[fips].slice(); if (!xy && geo && geo !== 'state' && GEO.metros[geo] && GEO.metros[geo].ccent[fips]) xy = GEO.metros[geo].ccent[fips].slice(); if (!xy) return null;
    const where = [of.street, of.city, zip].filter(Boolean).join(', ');
    return { x: xy[0], y: xy[1], shape: 'diamond', r: 6, fill: 'var(--firm-accent, var(--s2))', cls: 'firmpin', label: of.label || of.city || '', tip: `<b>${esc(F.name || 'Firm office')}${of.label ? ' · ' + esc(of.label) : ''}</b>${where ? `<div class="small">${esc(where)}</div>` : ''}${of.primary ? '<div class="small">Primary practice location</div>' : ''}` }; }).filter(Boolean);
}
// courthouses from the Metro Atlas files already loaded (they load on first use): {fips, name, addr, city, lat, lon, metro}
function loadedCourts() {
  const out = []; const seen = new Set(); const pools = [window.__SEV_ATLAS__ || {}, typeof AT_CACHE !== 'undefined' ? AT_CACHE : {}];
  pools.forEach(P => Object.keys(P).forEach(k => { const A = P[k]; ((A && A.courts) || []).forEach(c => { const fips = '48' + String(c.f || '').padStart(3, '0'); const key = fips + '|' + c.n; if (seen.has(key)) return; seen.add(key); out.push({ fips, name: c.n, addr: c.a || '', city: String(c.a || '').split(', ').pop(), lat: c.lat, lon: c.lon, metro: k }); }); }));
  return out;
}
function courtPins(geo) { return loadedCourts().map(c => { const xy = mapXY(geo, c.lon, c.lat); return xy ? { x: xy[0], y: xy[1], shape: 'square', r: 4.5, fill: 'var(--title)', cls: 'courtpin', label: '', tip: `<b>${esc(c.name)}</b><div class="small">${esc(c.addr)}</div><div class="small">${esc(cname(c.fips))} County district courts, family cases</div>` } : null; }).filter(Boolean); }
// ---- charts
function lineChart(el, o) {
  // o: {series:[{name,color,values:[{x,y}]}], W,H, xfmt, yfmt, area, ymin, xTicks:[x...], xTickFmt, yTicks, bands:[{x0,x1,label}], title, fixed,
  //     hlines:[{y, label, color}] reference lines across (the y range stretches to show them), vlines:[{x, label, color}] marks down (drawn when inside the x range)}
  // W and H are the design size: the chart draws at the container's width (H follows within 0.85 to 1.35 of the design ratio);
  // fixed:true draws at W exactly, as before.
  const bx = chartBox(el, o, o.W || 720, o.H || 240); const W = bx.W, H = bx.H; sizeWatch(el, { fn: lineChart, o, w: bx.live ? W : 0 });
  const xs = [], ys = []; o.series.forEach(s => s.values.forEach(p => { if (isN(p.y)) { xs.push(p.x); ys.push(p.y); } }));
  if (!xs.length) { el.innerHTML = '<div class="small">no data</div>'; return; }
  const hl = (o.hlines || []).filter(h => h && isN(h.y)); hl.forEach(h => ys.push(h.y));
  const x0 = Math.min(...xs), x1 = Math.max(...xs); let y0 = isN(o.ymin) ? o.ymin : Math.min(0, Math.min(...ys)), y1 = Math.max(...ys); if (y1 === y0) y1 = y0 + 1; if (o.ypad !== false) y1 = y1 + (y1 - y0) * 0.08;
  const yt = o.yTicks || niceTicks(y0, y1, 4); const ylab = yt.map(v => String(o.yfmt ? o.yfmt(v) : K(v)));
  const AX = 11.5;   // the axis text size in px (app.css .chart .ax)
  const m = { l: Math.max(40, Math.round(Math.max(...ylab.map(s => textW(s, AX))) + 12)), r: 12, t: 14, b: 26 };
  const X = x => m.l + (x - x0) / (x1 - x0 || 1) * (W - m.l - m.r), Y = y => m.t + (1 - (y - y0) / (y1 - y0)) * (H - m.t - m.b);
  // the marks down (vlines) get label rows above the plot: each label takes the first of three rows where it clears the one before it,
  // and the plot starts below the rows in use (a label that fits no row is left to the tooltip-free line alone)
  const vl = (o.vlines || []).filter(v => v && isN(v.x) && v.x >= x0 && v.x <= x1).sort((a, b) => a.x - b.x).map(v => ({ v, x: X(v.x) })); const rowR = [];
  vl.forEach(q => { if (!q.v.label) return; const tw = textW(q.v.label, AX); q.end = q.x + 4 + tw > W - m.r; const L = q.end ? q.x - 4 - tw : q.x + 4; let r = rowR.findIndex(R => L > R + 8); if (r < 0 && rowR.length < 3) { rowR.push(-Infinity); r = rowR.length - 1; } if (r < 0) return; rowR[r] = L + tw; q.row = r; });
  if (rowR.length) m.t += rowR.length * 13;
  const svg = [`<svg viewBox="0 0 ${W} ${H}"${o.title ? ` role="img" aria-label="${esc(o.title)}"` : ''}>`];
  yt.forEach((v, i) => { svg.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"></line><text class="ax" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(ylab[i])}</text>`); });
  if (o.bands) o.bands.forEach(b => { const bw = Math.max(1, X(b.x1) - X(b.x0)); const fits = textW(b.label || '', AX) < Math.max(bw, 90); svg.push(`<rect x="${X(b.x0)}" y="${m.t}" width="${bw}" height="${H - m.t - m.b}" fill="var(--sunk-2)" opacity=".5"></rect>${fits ? `<text class="ax" x="${X(b.x0) + 3}" y="${m.t + 11}">${esc(b.label || '')}</text>` : ''}`); });
  // reference lines: across at a value (the state rate), down at a moment (the 2020 closures, a large WARN notice); labels keep clear of each other
  hl.forEach(h => { const y = Y(h.y); if (y < m.t - 0.5 || y > H - m.b + 0.5) return; const c = h.color || 'var(--ink-3)'; const below = y - 4 < m.t + 9; svg.push(`<line class="refl" x1="${m.l}" x2="${W - m.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" style="stroke:${c}"></line>${h.label ? `<text class="ax refl-l" x="${W - m.r - 4}" y="${(below ? y + 13 : y - 4).toFixed(1)}" text-anchor="end">${esc(h.label)}</text>` : ''}`); });
  vl.forEach(q => { const c = q.v.color || 'var(--ink-3)'; svg.push(`<line class="refl" x1="${q.x.toFixed(1)}" x2="${q.x.toFixed(1)}" y1="${m.t - (q.row != null ? 13 * (rowR.length - q.row) : 0)}" y2="${H - m.b}" style="stroke:${c}"></line>`); if (q.row != null) svg.push(`<text class="ax refl-l" x="${(q.end ? q.x - 4 : q.x + 4).toFixed(1)}" y="${m.t - 13 * (rowR.length - q.row) + 9}" text-anchor="${q.end ? 'end' : 'start'}">${esc(q.v.label)}</text>`); });
  // x ticks: drop every other one (then more) until the labels no longer collide at this width
  let xt = (o.xTicks || niceTicks(x0, x1, 6)).filter(v => v >= x0 && v <= x1); const xlab = v => String(o.xTickFmt ? o.xTickFmt(v) : v);
  const room = (W - m.l - m.r) / Math.max(1, xt.length - 1); const need = Math.max(...xt.map(v => textW(xlab(v), AX)), 6) + 10;
  if (xt.length > 2 && room < need) { const k = Math.ceil(need / room); xt = xt.filter((v, i) => i % k === 0); }
  xt.forEach(v => { svg.push(`<text class="ax" x="${X(v)}" y="${H - 8}" text-anchor="middle">${esc(xlab(v))}</text>`); });
  svg.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(y0)}" y2="${Y(y0)}" style="stroke:var(--line-strong)"></line>`);
  o.series.forEach((s, i) => {
    const pts = s.values.filter(p => isN(p.y)); if (!pts.length) return;
    const segs = [[]]; if (o.gapBreak) { const dx = pts.slice(1).map((p, j) => p.x - pts[j].x).sort((a, b) => a - b); const step = dx.length ? dx[Math.floor(dx.length / 2)] : 1; pts.forEach((p, j) => { if (j && p.x - pts[j - 1].x > step * o.gapBreak) segs.push([]); segs[segs.length - 1].push(p); }); } else segs[0] = pts;
    segs.forEach(sg => { const d = sg.map((p, j) => (j ? 'L' : 'M') + X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join('');
    if (o.area) svg.push(`<path class="ar" d="${d}L${X(sg[sg.length - 1].x).toFixed(1)},${Y(y0)}L${X(sg[0].x).toFixed(1)},${Y(y0)}Z" fill="${s.color}"></path>`);
    svg.push(`<path class="ln" d="${d}" stroke="${s.color}" ${s.dash ? 'stroke-dasharray="4 3"' : ''}></path>`); });
    const last = pts[pts.length - 1]; svg.push(`<circle cx="${X(last.x)}" cy="${Y(last.y)}" r="3.5" fill="${s.color}" stroke="var(--card)" stroke-width="1.5"></circle>`);
  });
  svg.push(`<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}"></line></svg>`);
  const legS = o.series.filter(s => !s.nolegend); el.innerHTML = svg.join('') + (legS.length > 1 ? `<div class="legendc">${legS.map(s => `<span><i style="background:${s.color}"></i>${esc(s.lname || s.name)}</span>`).join('')}</div>` : '');
  const s = el.querySelector('svg'), xh = s.querySelector('.xh');
  s.addEventListener('mousemove', e => {
    const r = s.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; if (px < m.l || px > W - m.r) { hideTip(); xh.style.display = 'none'; return; }
    const xv = x0 + (px - m.l) / (W - m.l - m.r) * (x1 - x0);
    let rows = '', xl = null;
    o.series.forEach(sr => { let best = null; sr.values.forEach(p => { if (isN(p.y) && (best == null || Math.abs(p.x - xv) < Math.abs(best.x - xv))) best = p; }); if (best) { rows += `<div class="row"><span><i style="display:inline-block;width:8px;height:8px;background:${sr.color};margin-right:6px"></i>${esc(sr.name)}</span><span>${esc(o.yfmt ? o.yfmt(best.y) : N(best.y, 1))}</span></div>`; xl = best.x; } });
    if (xl == null) return; xh.setAttribute('x1', X(xl)); xh.setAttribute('x2', X(xl)); xh.style.display = 'block';
    showTip(`<b>${esc(o.xfmt ? o.xfmt(xl) : xl)}</b>${rows}`, e.clientX, e.clientY);
  });
  s.addEventListener('mouseleave', () => { hideTip(); xh.style.display = 'none'; });
}
function niceTicks(a, b, n) { const span = b - a || 1; const step0 = span / n; const p = Math.pow(10, Math.floor(Math.log10(step0))); const f = step0 / p; const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10)); return out; }
function barChart(el, o) {
  // horizontal bars: o:{rows:[{label,value,color,sub}], fmt, W, lw, max, fixed}. Draws at the container's width; the label column
  // narrows on a phone and long labels are shortened (the full label stays in the bar's tooltip).
  const rows = o.rows; const bx = chartBox(el, o, o.W || 600, 0); const W = bx.W; sizeWatch(el, { fn: barChart, o, w: bx.live ? W : 0 });
  const bh = 22, gap = 6, LB = 12; const H = rows.length * (bh + gap) + 8;   // LB: the bar label size in px (app.css .chart .lbl)
  const fv = v => String(o.fmt ? o.fmt(v) : N(v)); const vw = Math.max(40, Math.max(0, ...rows.map(r => textW(fv(r.value), LB))) + 12);
  const lw = Math.round(Math.max(Math.min(96, W * 0.4), Math.min(o.lw || 170, W - vw - Math.max(60, W * 0.3))));   // bars keep at least 30% of the width
  const cut = s => { s = String(s == null ? '' : s); if (textW(s, LB) <= lw - 10) return s; let n = s.length; while (n > 4 && textW(s.slice(0, n) + '…', LB) > lw - 10) n--; return s.slice(0, n).replace(/[\s,·(]+$/, '') + '…'; };
  const mx = o.max || Math.max(...rows.map(r => Math.abs(r.value) || 0), 1e-9); const neg = rows.some(r => r.value < 0);
  const span = Math.max(20, W - lw - vw); const zero = neg ? lw + span / 2 : lw; const scale = span / (neg ? 2 * mx : mx);
  const svg = [`<svg viewBox="0 0 ${W} ${H}"${o.title ? ` role="img" aria-label="${esc(o.title)}"` : ''}>`];
  rows.forEach((r, i) => { const y = 4 + i * (bh + gap); const w = Math.abs(r.value) * scale; const x = r.value < 0 ? zero - w : zero; const lab = cut(r.label); svg.push(`<text class="lbl" x="${lw - 8}" y="${y + bh / 2 + 4}" text-anchor="end">${lab !== String(r.label) ? `<title>${esc(r.label)}</title>` : ''}${esc(lab)}</text><rect x="${x}" y="${y}" width="${Math.max(w, 1)}" height="${bh}" fill="${r.color || 'var(--s1)'}"><title>${esc(r.label)}: ${esc(fv(r.value))}</title></rect><text class="lbl" x="${r.value < 0 ? zero + 5 : x + w + 4}" y="${y + bh / 2 + 4}" text-anchor="start" style="font-variant-numeric:tabular-nums">${esc(fv(r.value))}</text>`); });
  if (neg) svg.push(`<line x1="${zero}" x2="${zero}" y1="0" y2="${H}" class="gridl" style="stroke:var(--line-strong)"></line>`);
  svg.push('</svg>'); el.innerHTML = svg.join('');
}
// colBars: vertical bars by category, stacked or side by side (filings by case type by year, intake by hour).
// o:{cats:[label], series:[{name, color, values:[num by category]}], stacked, fmt (values in the tooltip), yfmt (axis), title, W, H, fixed,
//    hlines:[{y, label, color}], tip:i=>html added to a category's tooltip, onBar:i=>{} (a click on a category), sel:i (a category drawn
//    in full while the others fade)}. Draws at the container's width like lineChart; positive values stack up and negative ones down.
function colBars(el, o) {
  const bx = chartBox(el, o, o.W || 640, o.H || 260); const W = bx.W, H = bx.H; sizeWatch(el, { fn: colBars, o, w: bx.live ? W : 0 });
  const cats = o.cats || [], ser = (o.series || []).filter(s => s && Array.isArray(s.values)); const n = cats.length; const stacked = !!o.stacked;
  if (!n || !ser.some(s => s.values.some(isN))) { el.innerHTML = '<div class="small">no data</div>'; return; }
  const AX = 11.5; let hi = 0, lo = 0;
  cats.forEach((c, i) => { if (stacked) { let p = 0, q = 0; ser.forEach(s => { const v = s.values[i]; if (isN(v)) { if (v >= 0) p += v; else q += v; } }); hi = Math.max(hi, p); lo = Math.min(lo, q); } else ser.forEach(s => { const v = s.values[i]; if (isN(v)) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }); });
  const hl = (o.hlines || []).filter(h => h && isN(h.y)); hl.forEach(h => { hi = Math.max(hi, h.y); lo = Math.min(lo, h.y); });
  if (hi === lo) hi = lo + 1; hi += (hi - lo) * 0.06;
  const yt = niceTicks(lo, hi, 4); const y0 = Math.min(lo, yt[0]), y1 = Math.max(hi, yt[yt.length - 1]); const ylab = yt.map(v => String(o.yfmt ? o.yfmt(v) : K(v)));
  const m = { l: Math.max(40, Math.round(Math.max(...ylab.map(s => textW(s, AX))) + 12)), r: 12, t: 14, b: 26 };
  const Y = v => m.t + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - m.t - m.b); const bw = (W - m.l - m.r) / n; const X = i => m.l + i * bw;
  const pad = Math.min(10, bw * 0.16); const gw = Math.max(1, (bw - pad * 2) / (stacked ? 1 : ser.length)); const fv = v => String(o.fmt ? o.fmt(v) : N(v));
  const svg = [`<svg viewBox="0 0 ${W} ${H}"${o.title ? ` role="img" aria-label="${esc(o.title)}"` : ''}>`];
  yt.forEach((v, i) => svg.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"></line><text class="ax" x="${m.l - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(ylab[i])}</text>`));
  cats.forEach((c, i) => {
    let up = 0, dn = 0; const fade = isN(o.sel) && o.sel !== i ? ' fade' : '';
    ser.forEach((s, j) => {
      const v = s.values[i]; if (!isN(v) || v === 0) return; let a, b;
      if (stacked) { if (v >= 0) { a = up; b = up + v; up = b; } else { a = dn; b = dn + v; dn = b; } } else { a = 0; b = v; }
      const yA = Y(Math.max(a, b)), yB = Y(Math.min(a, b)); const x = stacked ? X(i) + pad : X(i) + pad + j * gw; const w = Math.max(1, (stacked ? bw - pad * 2 : gw - (ser.length > 1 ? 1 : 0)));
      svg.push(`<rect class="cb${fade}" x="${x.toFixed(1)}" y="${yA.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0.5, yB - yA - (stacked ? 0.75 : 0)).toFixed(1)}" fill="${s.color || 'var(--s1)'}"></rect>`);
    });
  });
  // category labels: every k-th one, so they never collide at this width
  const cl = i => String(o.catFmt ? o.catFmt(cats[i], i) : cats[i]); const need = Math.max(...cats.map((c, i) => textW(cl(i), AX))) + 8; const k = Math.max(1, Math.ceil(need / bw));
  cats.forEach((c, i) => { if (i % k === 0 || (k > 1 && i === n - 1 && (n - 1) % k >= Math.ceil(k / 2))) svg.push(`<text class="ax" x="${(X(i) + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(cl(i))}</text>`); });
  svg.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" style="stroke:var(--line-strong)"></line>`);
  hl.forEach(h => { const y = Y(h.y); const below = y - 4 < m.t + 9; svg.push(`<line class="refl" x1="${m.l}" x2="${W - m.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" style="stroke:${h.color || 'var(--ink-3)'}"></line>${h.label ? `<text class="ax refl-l" x="${W - m.r - 4}" y="${(below ? y + 13 : y - 4).toFixed(1)}" text-anchor="end">${esc(h.label)}</text>` : ''}`); });
  cats.forEach((c, i) => svg.push(`<rect class="cbhit" data-i="${i}" x="${X(i).toFixed(1)}" y="${m.t}" width="${bw.toFixed(1)}" height="${H - m.t - m.b}"></rect>`));
  svg.push('</svg>');
  const legS = ser.filter(s => !s.nolegend); el.innerHTML = svg.join('') + (legS.length > 1 ? `<div class="legendc">${legS.map(s => `<span><i style="background:${s.color || 'var(--s1)'}"></i>${esc(s.lname || s.name)}</span>`).join('')}</div>` : '');
  const s = el.querySelector('svg');
  s.addEventListener('mousemove', e => { const r = e.target.closest('rect.cbhit'); if (!r) { hideTip(); return; } const i = +r.dataset.i; const vals = ser.map(q => q.values[i]); const tot = stacked ? sum(vals.filter(isN)) : null;
    showTip(`<b>${esc(cl(i))}</b>${ser.slice().reverse().map(q => isN(q.values[i]) ? `<div class="row"><span><i style="display:inline-block;width:8px;height:8px;background:${q.color || 'var(--s1)'};margin-right:6px"></i>${esc(q.name)}</span><span>${esc(fv(q.values[i]))}</span></div>` : '').join('')}${stacked && ser.length > 1 ? `<div class="row"><span>Total</span><span>${esc(fv(tot))}</span></div>` : ''}${o.tip ? o.tip(i) : ''}`, e.clientX, e.clientY); });
  s.addEventListener('mouseleave', hideTip);
  if (o.onBar) s.addEventListener('click', e => { const r = e.target.closest('rect.cbhit'); if (r) o.onBar(+r.dataset.i); if (tipFromTouch()) hideTip(); });
}
// corrMatrix(el, {keys, labels, matrix, caption, corner, fmt, legend}): a correlation table colored on the diverging ramp (slate for
// negative, leaf for positive) with CSS variables, so a theme switch needs no redraw. labels: {key: text} or [text by key order];
// matrix: {a: {b: r}} or [[r]] in key order (null prints n/a). Writes into el when given and returns the html.
function corrMatrix(el, o) {
  o = o || {}; const ks = o.keys || []; const lab = k => String((o.labels && (Array.isArray(o.labels) ? o.labels[ks.indexOf(k)] : o.labels[k])) || k);
  const get = (a, b, i, j) => { const M = o.matrix; if (!M) return null; const v = Array.isArray(M) ? (M[i] || [])[j] : (M[a] || {})[b]; return isN(v) ? v : null; };
  const fmt = o.fmt || (v => MINUS(v.toFixed(2)));
  const cell = (a, b, i, j) => { if (i === j) return `<td style="background:var(--sunk);color:var(--ink-3)">${esc(fmt(1))}</td>`; const v = get(a, b, i, j); if (!isN(v)) return `<td style="color:var(--ink-3)">${NA}</td>`; const bg = divergeColor(clamp(v, -1, 1)); return `<td style="background:${bg};color:${inkOn(bg)}" title="${esc(lab(a))} and ${esc(lab(b))}: r = ${esc(fmt(v))}">${esc(fmt(v))}</td>`; };
  const leg = o.legend === false ? '' : `<div class="legend"><span class="lr"><span class="num">${MINUS('-1')}</span><span class="ramp" style="background:linear-gradient(90deg,${RAMPS.slate.slice(1).reverse().join(',')},var(--rp-mid),${RAMPS.leaf.slice(1).join(',')})"></span><span class="num">+1</span></span><span class="small">Pearson r: slate where two measures move in opposite directions, leaf where they move together</span></div>`;
  const html = `<div class="tblbox"><div class="tblwrap"><table class="t corr"><caption class="vh">${esc(o.caption || o.title || 'Correlation matrix')}</caption><thead><tr><th scope="col">${esc(o.corner || '')}</th>${ks.map(k => `<th scope="col">${esc(lab(k))}</th>`).join('')}</tr></thead><tbody>${ks.map((a, i) => `<tr><th scope="row">${esc(lab(a))}</th>${ks.map((b, j) => cell(a, b, i, j)).join('')}</tr>`).join('')}</tbody></table></div></div>${leg}`;
  if (el) el.innerHTML = html; return html;
}
// scatter: o:{points:[{x, y, r, id, label, color}], xfmt, yfmt, xlab, ylab, ylog, W, H, title, onPoint, selected, tip(p)}. Draws at the
// container's width like lineChart; ylog plots y on a log axis (y must be above 0); a click on a point calls onPoint(id).
function scatter(el, o) {
  const bx = chartBox(el, o, o.W || 640, o.H || 300); const W = bx.W, H = bx.H; sizeWatch(el, { fn: scatter, o, w: bx.live ? W : 0 });
  const pts = (o.points || []).filter(p => isN(p.x) && isN(p.y) && (!o.ylog || p.y > 0)); if (pts.length < 2) { el.innerHTML = '<div class="small">Too few counties with data to plot.</div>'; return; }
  const fy = v => o.ylog ? Math.log(v) : v; const AX = 11.5;
  const xs = pts.map(p => p.x), ys = pts.map(p => fy(p.y)); let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); const px = (x1 - x0) * 0.04 || 1, py = (y1 - y0) * 0.06 || 1; x0 -= px; x1 += px; y0 -= py; y1 += py;
  let yt = o.ylog ? [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 500].filter(v => Math.log(v) >= y0 && Math.log(v) <= y1) : niceTicks(y0, y1, 4); if (o.ylog) while (yt.length > 6) yt = yt.filter((v, i) => i % 2 === 0); const yl = yt.map(v => String(o.yfmt ? o.yfmt(v) : N(v)));
  const m = { l: Math.max(40, Math.round(Math.max(0, ...yl.map(s => textW(s, AX))) + 14)), r: 14, t: 12, b: o.xlab ? 40 : 26 };
  const X = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r), Y = y => m.t + (1 - (fy(y) - y0) / (y1 - y0)) * (H - m.t - m.b), Yr = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  let xt = niceTicks(x0, x1, 5).filter(v => v >= x0 && v <= x1); const xl = v => String(o.xfmt ? o.xfmt(v) : N(v)); const room = (W - m.l - m.r) / Math.max(1, xt.length - 1); const need = Math.max(...xt.map(v => textW(xl(v), AX)), 6) + 10; if (xt.length > 2 && room < need) { const k = Math.ceil(need / room); xt = xt.filter((v, i) => i % k === 0); }
  const rmax = Math.max(...pts.map(p => p.r || 1)); const R = p => 2.5 + 7.5 * Math.sqrt((p.r || 1) / rmax);
  const svg = [`<svg viewBox="0 0 ${W} ${H}"${o.title ? ` role="img" aria-label="${esc(o.title)}"` : ''}>`];
  yt.forEach((v, i) => { const yy = o.ylog ? Yr(Math.log(v)) : Yr(v); svg.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"></line><text class="ax" x="${m.l - 6}" y="${yy + 4}" text-anchor="end">${esc(yl[i])}</text>`); });
  xt.forEach(v => svg.push(`<text class="ax" x="${X(v)}" y="${H - (o.xlab ? 22 : 8)}" text-anchor="middle">${esc(xl(v))}</text>`));
  if (o.xlab) svg.push(`<text class="ax" x="${m.l + (W - m.l - m.r) / 2}" y="${H - 4}" text-anchor="middle">${esc(o.xlab)}</text>`);
  if (o.ylab) svg.push(`<text class="ax" x="${m.l + 4}" y="${m.t + 10}">${esc(o.ylab)}</text>`);
  pts.slice().sort((a, b) => (b.r || 1) - (a.r || 1)).forEach(p => svg.push(`<circle class="pt${o.selected === p.id ? ' sel' : ''}" data-id="${esc(p.id)}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${R(p).toFixed(1)}" fill="${p.color || 'var(--s1)'}"></circle>`));
  const sp = pts.find(p => p.id === o.selected); if (sp) svg.push(`<circle class="ptsel" cx="${X(sp.x).toFixed(1)}" cy="${Y(sp.y).toFixed(1)}" r="${(R(sp) + 3).toFixed(1)}"></circle>`);
  svg.push('</svg>'); el.innerHTML = svg.join('');
  const s = el.querySelector('svg'); const byId = {}; pts.forEach(p => { byId[p.id] = p; });
  s.addEventListener('mousemove', e => { const c = e.target.closest('circle.pt'); if (!c) { hideTip(); return; } const p = byId[c.dataset.id]; showTip(o.tip ? o.tip(p) : `<b>${esc(p.label || p.id)}</b><div class="row"><span>x</span><span>${esc(xl(p.x))}</span></div><div class="row"><span>y</span><span>${esc(o.yfmt ? o.yfmt(p.y) : N(p.y))}</span></div>`, e.clientX, e.clientY); });
  s.addEventListener('mouseleave', hideTip);
  s.addEventListener('click', e => { const c = e.target.closest('circle.pt'); if (c && o.onPoint) o.onPoint(c.dataset.id); if (tipFromTouch()) hideTip(); });
}
// coefPlot: estimates with intervals on one axis, o:{rows:[{label, est, lo, hi, color}], ref, log, fmt, W, title}. With log the axis is
// logarithmic (odds ratios); ref draws the no effect line (1 for odds ratios).
function coefPlot(el, o) {
  const rows = (o.rows || []).filter(r => isN(r.est)); const bx = chartBox(el, o, o.W || 560, 0); const W = bx.W; sizeWatch(el, { fn: coefPlot, o, w: bx.live ? W : 0 });
  if (!rows.length) { el.innerHTML = '<div class="small">no data</div>'; return; }
  const LB = 12, AX = 11.5, rh = 24; const f = v => o.log ? Math.log(v) : v; const fmt = v => String(o.fmt ? o.fmt(v) : N(v, 2));
  const lw = Math.round(Math.min(o.lw || 190, Math.max(96, Math.max(...rows.map(r => textW(r.label, LB))) + 14), W * 0.45));
  const all = rows.flatMap(r => [r.lo, r.hi, r.est]).filter(v => isN(v) && (!o.log || v > 0)).map(f).concat(isN(o.ref) ? [f(o.ref)] : []);
  let a = Math.min(...all), b = Math.max(...all); const pad = (b - a) * 0.06 || 0.1; a -= pad; b += pad;
  const H = rows.length * rh + 34, m = { l: lw, r: 16, t: 6 }; const X = v => m.l + (f(v) - a) / (b - a) * (W - m.l - m.r);
  const ticks = o.log ? [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4].filter(v => Math.log(v) >= a && Math.log(v) <= b) : niceTicks(a, b, 5);
  const svg = [`<svg viewBox="0 0 ${W} ${H}"${o.title ? ` role="img" aria-label="${esc(o.title)}"` : ''}>`];
  ticks.forEach(v => svg.push(`<line class="gridl" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - 24}"></line><text class="ax" x="${X(v)}" y="${H - 8}" text-anchor="middle">${esc(fmt(v))}</text>`));
  if (isN(o.ref)) svg.push(`<line x1="${X(o.ref)}" x2="${X(o.ref)}" y1="${m.t}" y2="${H - 24}" style="stroke:var(--line-strong);stroke-width:1.5"></line>`);
  rows.forEach((r, i) => { const y = m.t + i * rh + rh / 2; const lab = textW(r.label, LB) > lw - 10 ? r.label.slice(0, Math.max(4, Math.floor(r.label.length * (lw - 14) / textW(r.label, LB)))) + '…' : r.label; svg.push(`<text class="lbl" x="${lw - 10}" y="${y + 4}" text-anchor="end">${esc(lab)}</text>${isN(r.lo) && isN(r.hi) ? `<line x1="${X(r.lo)}" x2="${X(r.hi)}" y1="${y}" y2="${y}" style="stroke:${r.color || 'var(--s1)'};stroke-width:2"></line>` : ''}<circle cx="${X(r.est)}" cy="${y}" r="4.5" fill="${r.color || 'var(--s1)'}"><title>${esc(r.label)}: ${esc(fmt(r.est))}${isN(r.lo) ? ` (${esc(fmt(r.lo))} to ${esc(fmt(r.hi))})` : ''}</title></circle>`); });
  svg.push('</svg>'); el.innerHTML = svg.join('');
}
function spark(vals, w = 120, h = 28, color = 'var(--s1)') { const v = vals.filter(isN); if (v.length < 2) return ''; const mn = Math.min(...v), mx = Math.max(...v); const d = vals.map((y, i) => isN(y) ? (i ? 'L' : 'M') + (i / (vals.length - 1) * w).toFixed(1) + ',' + (h - 2 - (y - mn) / (mx - mn || 1) * (h - 4)).toFixed(1) : '').join(''); return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="vertical-align:middle"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"></path></svg>`; }
function seasBlock(el, idx, color) { const mx = Math.max(...idx), mn = Math.min(...idx); el.innerHTML = `<div class="seas">${idx.map((v, i) => { const t = (v - mn) / (mx - mn || 1); const bg = rampColor(color || 'ember', 0.08 + t * 0.8); return `<div style="background:${bg};color:${inkOn(bg)}"><b>${v.toFixed(0)}</b>${MO[i]}</div>`; }).join('')}</div>`; }
// the firm's markets as ids: its counties (FIPS) and its office ZIPs; null when no firm profile is set
function firmIds() { if (typeof FIRM === 'undefined' || !FIRM.get) return null; try { const F = FIRM.get(); const ids = new Set(FIRM.counties()); (F.offices || []).forEach(of => { const z = String(of.zip || '').trim(); if (ZI[z]) ids.add(z); }); return ids.size ? ids : null; } catch (e) { return null; } }
// ---- tables
function table(el, o) {
  // o:{cols:[{k,l,fmt,cls,w,tip, h,d,pct}], rows:[obj], sort:{k,dir}, onRow, selected, limit, caption, rowClass, firm}
  // rowClass: a class string, or row=>class; firm (on unless false): rows whose _id is one of the firm's counties (FIPS) or office ZIPs
  // carry the class 'firm' and are marked (the firm's own markets read as the benchmark rows)
  // h, d and pct describe the column for csv(): export header, decimals, and a fraction written as a percent
  // Sort headers are buttons with aria-sort; rows with onRow are focusable and open with Enter or Space.
  let st = { k: o.sort ? o.sort.k : o.cols[1].k, dir: o.sort ? o.sort.dir : -1 };
  // numbers sort as numbers; anything else (text, a list such as a city's counties) sorts as its text, so a column never sorts as NaN
  const sk = v => Array.isArray(v) ? v.join(', ') : String(v);
  const sorted = () => o.rows.slice().sort((a, b) => { const x = a[st.k], y = b[st.k]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : sk(x).localeCompare(sk(y))) * st.dir; });
  function render() {
    const ae = document.activeElement; const back = ae && el.contains(ae) ? { k: ae.closest('th') ? ae.closest('th').dataset.k : null, id: ae.matches('tr[data-id]') ? ae.dataset.id : null } : null;
    const rows = sorted();
    const lim = o.limit ? rows.slice(0, o.limit) : rows;
    const tab = o.onRow ? ' tabindex="0"' : ''; const fs = o.firm === false ? null : firmIds();
    const ow = el.querySelector('.tblwrap'); const keep = ow ? [ow.scrollTop, ow.scrollLeft] : null;
    el.innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t">${o.caption ? `<caption class="vh">${esc(o.caption)}</caption>` : ''}<thead><tr>${o.cols.map(c => `<th data-k="${esc(c.k)}" class="${st.k === c.k ? (st.dir < 0 ? 's' : 'sa') : ''} ${c.cls || ''}"${st.k === c.k ? ` aria-sort="${st.dir < 0 ? 'descending' : 'ascending'}"` : ''}><button type="button" class="thb"${c.tip ? ` title="${esc(c.tip)}"` : ''}>${esc(c.l)}</button></th>`).join('')}</tr></thead><tbody>${lim.map(r => { const sel = o.selected && r._id === o.selected; const fm = fs && r._id != null && fs.has(String(r._id)); const rc = typeof o.rowClass === 'function' ? o.rowClass(r) : o.rowClass; const cl = [sel ? 'sel' : '', fm ? 'firm' : '', rc || ''].filter(Boolean).join(' '); return `<tr data-id="${esc(r._id)}"${tab} class="${esc(cl)}"${sel ? ' aria-current="true"' : ''}${fm ? ' aria-description="the firm\'s market"' : ''}>${o.cols.map((c, i) => `<td class="${i === 0 ? 'name' : ''} ${c.cls || ''}">${c.fmt ? c.fmt(r[c.k], r) : esc(r[c.k])}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></div>${o.limit && rows.length > o.limit ? `<div class="small">Showing ${o.limit} of ${rows.length}. Sort or filter to see others.</div>` : ''}`;
    $$('th', el).forEach(th => th.onclick = () => { const k = th.dataset.k; if (st.k === k) st.dir = -st.dir; else { st.k = k; st.dir = -1; } render(); const b = el.querySelector(`th[data-k="${CSS.escape(k)}"] .thb`); if (b) b.focus(); });
    if (o.onRow) { $$('tbody tr', el).forEach(tr => tr.onclick = () => o.onRow(tr.dataset.id)); const tb = el.querySelector('tbody'); if (tb) tb.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) { e.preventDefault(); o.onRow(e.target.dataset.id); } }; }
    const nw = el.querySelector('.tblwrap'); if (keep && nw) { nw.scrollTop = keep[0]; nw.scrollLeft = keep[1]; }
    if (back) { const f = back.k ? el.querySelector(`th[data-k="${CSS.escape(back.k)}"] .thb`) : back.id != null ? el.querySelector(`tr[data-id="${CSS.escape(back.id)}"]`) : null; if (f) f.focus({ preventScroll: true }); }
    fadeCheck(nw);
  }
  // scroll the wrapper (never the page) so a row sits below the sticky header
  function reveal(id) { const w = el.querySelector('.tblwrap'); const tr = id != null && w ? w.querySelector(`tr[data-id="${CSS.escape(String(id))}"]`) : null; if (!tr || !w.clientHeight) return; const hh = (w.querySelector('thead') || {}).offsetHeight || 0; const top = tr.offsetTop - hh, bot = tr.offsetTop + tr.offsetHeight - w.clientHeight; if (w.scrollTop > top) w.scrollTop = Math.max(0, top - 4); else if (w.scrollTop < bot) w.scrollTop = bot + 4; }
  function setSel(id, quiet) { o.selected = id; const rows = $$('tbody tr', el); if (!rows.length) { render(); return; } let found = false; rows.forEach(tr => { const on = id != null && tr.dataset.id === String(id); if (on) found = true; tr.classList.toggle('sel', on); if (on) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current'); }); if (found && !quiet && !el.contains(document.activeElement)) reveal(id); }
  render();
  return { render, setRows(r) { o.rows = r; render(); }, setSel, reveal, sorted, sort: () => Object.assign({}, st) };
}
// ---- csv / export
// cols:[{l, k (key or row=>value), d (round to d decimals), pct (a fraction written as a percent)}]; numbers are written without
// thousands separators so a spreadsheet reads them as numbers. opts: {note, guard, platform}
//   note      provenance lines written above the header as '# ' comments (csvNote(module) builds the standard set)
//   guard     on by default: a text cell starting with =, +, -, @, a tab or a carriage return gets a leading apostrophe so a spreadsheet
//             cannot run it as a formula (a plain number such as -12.5 or +3% is left alone)
//   platform  true for a file a platform imports (Google Ads Editor, Microsoft Advertising, Meta): no guard and no note
const CSV_NUM = /^[+-]?(?:\d[\d,]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?%?$/;
const csvSafe = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) && !CSV_NUM.test(v.trim())) ? "'" + v : v;
const csvNoteLines = note => note == null || note === '' ? '' : (Array.isArray(note) ? note : String(note).split('\n')).map(l => /^#/.test(l) ? l : '# ' + l).join('\n') + '\n';
function csv(rows, cols, opts) {
  opts = opts || {}; const guard = !opts.platform && opts.guard !== false;
  const q = v => { if (guard) v = csvSafe(v); const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const val = (c, r) => { let v = typeof c.k === 'function' ? c.k(r) : r[c.k]; if (typeof v === 'number') { if (!isFinite(v)) return ''; if (c.pct) v *= 100; if (c.d != null) { const f = Math.pow(10, c.d); v = Math.round(v * f) / f; if (Object.is(v, -0)) v = 0; } } return v; };
  return (opts.platform ? '' : csvNoteLines(opts.note)) + [cols.map(c => q(c.l)).join(',')].concat(rows.map(r => cols.map(c => q(val(c, r))).join(','))).join('\n');
}
// csvNote(module, extra): the provenance lines for a human sheet: the module, the export and compile dates, each source's
// through date (court filings, unemployment, weekly claims, WARN notices, the ACS window) and the grade legend; extra adds lines
// (a string with new lines, or an array). Every line starts '# '. Keep it off platform import files.
function csvNote(mod, extra) {
  const m = typeof MODI !== 'undefined' && MODI[mod]; const what = m ? `module ${m.num} ${m.title}` : (mod ? String(mod) : 'Severance');
  const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const acs = (String(META.acs || '').match(/(\d{4})\D+(\d{4})/) || []); const lines = [
    `Severance, ${what}. Exported ${fmtDateL(today)}; data compiled ${fmtDateL(META.compiled)}.`,
    `Data through: court filings (Texas Office of Court Administration) ${fmtDateL(META.oca_through)}; unemployment (BLS LAUS) ${fmtDateL(META.laus_through)}; weekly unemployment claims ${fmtDateL(META.ui_through)}; WARN notices ${fmtDateL(META.warn_through)}; Census ACS ${acs[1] ? acs[1] + ' to ' + acs[2] : ''} five year estimates.`,
    gradeLegend() + '.'].concat(extra == null || extra === '' ? [] : Array.isArray(extra) ? extra : String(extra).split('\n'));
  return lines.map(l => '# ' + String(l).replace(/^#\s?/, '')).join('\n');
}
// export columns from table columns: the export header (h) when given, else the on screen label
const xcols = cols => cols.map(c => ({ l: c.h || c.l, k: c.k, d: c.d, pct: c.pct }));
// file names: severance_<module>_<geography>_<yyyy-mm-dd>.<ext>
function expName(mod, geo, ext) { const g = String(geo == null ? '' : geo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'texas'; const d = new Date(); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return `severance_${mod}_${g}_${iso}.${ext || 'csv'}`; }
// ---- scroll edge fades on wide tables and on the rail rows that scroll sideways on a phone
function fadeCheck(w) { if (!w || !w.isConnected) return; const more = w.scrollWidth - w.clientWidth - w.scrollLeft > 2; w.classList.toggle('fr', more); if (w.classList.contains('row')) w.classList.toggle('fl', w.scrollLeft > 2); else if (more) { const sb = w.offsetWidth - w.clientWidth - (parseFloat(getComputedStyle(w).borderLeftWidth) || 0) * 2; w.style.setProperty('--sbw', Math.max(0, sb) + 'px'); } }
let FADE_RAF = 0;
function fadeAll() { if (FADE_RAF) return; FADE_RAF = requestAnimationFrame(() => { FADE_RAF = 0; $$('.module:not([hidden]) .tblwrap, .rail .row').forEach(fadeCheck); }); }
document.addEventListener('scroll', e => { const t = e.target; if (t && t.classList && (t.classList.contains('tblwrap') || (t.classList.contains('row') && t.closest && t.closest('.rail')))) fadeCheck(t); }, { passive: true, capture: true });
window.addEventListener('resize', fadeAll, { passive: true });
if (typeof MutationObserver === 'function') { const mo = new MutationObserver(fadeAll); ['modules', 'rail'].forEach(id => { const n = document.getElementById(id); if (n) mo.observe(n, { childList: true, subtree: true }); }); }
// ---- keyboard: cards and other non button elements marked data-kbd open with Enter or Space like a button
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[data-kbd]')) { e.preventDefault(); e.target.click(); } });
function exportText(name, text, mime = 'text/csv') {
  /* the extension downloads and confirms with a toast; the hosted viewer uses its downloads capability; a page opened from disk or the
     web downloads where the browser allows and also opens the copy box, because sandboxed frames drop downloads silently */
  if (typeof ENV !== 'undefined' && ENV === 'viewer') { saveFile(name, text); return; }
  let downloaded = false;
  try { const b = new Blob([text], { type: mime }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); downloaded = true; } catch (e) { }
  if (downloaded && typeof ENV !== 'undefined' && (ENV === 'chrome' || ENV === 'firefox')) { toast('Downloaded ' + name); return; }
  exportModal(name, text, downloaded);
}
function exportModal(name, text, downloaded) {
  openModal(`<h3 style="font-family:var(--display);font-size:22px">${esc(name)}</h3><p class="small">${downloaded ? 'A download was started where the viewer allows it. ' : ''}If no file appeared, copy the text below and paste it into a file.</p><textarea class="copy" id="exportText" aria-label="${esc(name)}">${esc(text)}</textarea><div style="display:flex;gap:8px;margin-top:8px"><button class="btn primary" id="copyBtn">Copy to clipboard</button><button class="btn" id="closeBtn">Close</button></div>`);
  $('#copyBtn').onclick = () => { const ta = $('#exportText'); const fall = () => { ta.focus(); ta.select(); let ok = false; try { ok = !!(document.execCommand && document.execCommand('copy')); } catch (e) { ok = false; } $('#copyBtn').textContent = ok ? 'Copied' : 'Selected, press Ctrl or Cmd C'; }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(() => { $('#copyBtn').textContent = 'Copied'; }).catch(fall); else fall(); };
  $('#closeBtn').onclick = closeModal;
}
let MODAL_RET = null;
function openModal(html) { let m = $('#modal'); if (!m) { m = document.createElement('div'); m.id = 'modal'; m.className = 'modal'; m.innerHTML = '<div class="box" role="dialog" aria-modal="true" tabindex="-1"></div>'; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) closeModal(); }); m.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); else if (e.key === 'Tab') { const f = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', m.querySelector('.box')).filter(x => !x.disabled && x.offsetParent !== null); if (!f.length) { e.preventDefault(); return; } const a = f[0], z = f[f.length - 1]; if (e.shiftKey && (document.activeElement === a || document.activeElement === m.querySelector('.box'))) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } }); } if (!m.classList.contains('on')) MODAL_RET = document.activeElement; const box = m.querySelector('.box'); box.innerHTML = html; const h = box.querySelector('h3'); if (h) { h.id = 'modalTitle'; box.setAttribute('aria-labelledby', 'modalTitle'); } m.classList.add('on'); document.documentElement.classList.add('modal-open'); box.focus(); }
function closeModal() { const m = $('#modal'); if (m && m.classList.contains('on')) { m.classList.remove('on'); document.documentElement.classList.remove('modal-open'); if (MODAL_RET && MODAL_RET.focus) try { MODAL_RET.focus(); } catch (e) { } MODAL_RET = null; } }
// ---- shell bits
// the module title is the page's level one heading (one module shows at a time; hidden ones leave the accessibility tree)
function mastHTML(o) { return `<div class="mast"><div class="eyebrow">${esc(o.eyebrow)}</div><h1 class="mh">${esc(o.title)}</h1><div class="dek">${o.dek}</div>${o.ribbon ? `<button type="button" class="ribbon" data-go="${esc(o.ribbon.go)}">${esc(o.ribbon.text)}</button><div style="height:14px"></div>` : '<div class="rule"></div>'}<div class="facts">${(o.facts || []).map(f => `<span><b>${f[0]}</b> ${f[1]}</span>`).join('')}</div></div>`; }
// a module's sources, judgment calls and caveats, at its foot: items are [label, html] pairs (html already escaped)
function srcFoot(items) { return `<div class="panel srcfoot" style="margin-top:14px"><h3>Sources, judgment calls and caveats</h3><ul class="srcs">${items.map(i => `<li><b>${esc(i[0])}.</b> ${i[1]}</li>`).join('')}</ul></div>`; }
function tile(l, v, s, g) { return `<div class="tile"><div class="l"><span>${esc(l)}</span>${g ? (gradeChip(g) || `<span class="grade ${esc(g)}">${esc(g)}</span>`) : ''}</div><div class="v">${v}</div><div class="s">${s || ''}</div></div>`; }
// ctl(label, inner): the label names the first select, input or textarea in inner (its id, or one given to it here)
let CTL_N = 0;
function ctl(label, inner) {
  let s = String(inner == null ? '' : inner); let id = null;
  const tag = s.match(/<(select|input|textarea)\b[^>]*>/i);
  if (tag && !/\btype=["']?hidden/i.test(tag[0])) { const m = tag[0].match(/\bid=(["'])([^"']+)\1/i); if (m) id = m[2]; else { id = 'ctl_' + (++CTL_N); const nt = tag[0].replace(/^<(select|input|textarea)\b/i, (m0, t) => `<${t} id="${id}"`); s = s.replace(tag[0], () => nt); } }
  return `<div class="ctl">${id ? `<label for="${esc(id)}">` : '<label>'}${esc(label)}</label>${s}</div>`;
}
function sel(id, opts, val) { return `<select id="${id}">${opts.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`; }
function gradeOf(c) { return c.grade || (c.county_grade) || NA; }
// ---- shared computed helpers
function countyRows(filter) { return CTY.filter(filter || (() => true)); }
function ttmDiv(c) { return c.filings.ttm.div; }
function metroCodes(tab) { return Array.isArray(tab.code) ? tab.code : [tab.code]; }
function metroCounties(codes) { const out = []; codes.forEach(code => MSA[code].counties.forEach(f => out.push(f))); return out; }
function metroZctas(codes) { return ZC.filter(z => codes.includes(z.msa)); }
// ---- find a place: findPlace(q, scope) → {kind:'zip'|'county'|'city'|'court', fips, zip, msa, city, label, zips?, court?} or null
// q: a 5 digit ZIP ('77002', '77002 Houston'), a county name or FIPS ('Harris', 'harris co', '48201', '201'), a city (exact, then a
// prefix ranked by married adults: 'Pla' finds Plano), or a courthouse or district court named with its county ('Harris County Family
// Law Center', 'Tarrant County district court'; the Metro Atlas courthouse list is searched for every atlas already loaded).
// scope: null for all of Texas; an MSA code or a list of codes; or {msa, counties:[fips], prefer:'county'|'city'} (prefer settles a
// name that is both, such as Dallas; county by default). A place outside the scope is a miss.
function placeScope(scope) {
  if (!scope) return { msa: null, cty: null, prefer: 'county' };
  if (typeof scope === 'string' || Array.isArray(scope)) return { msa: new Set([].concat(scope)), cty: null, prefer: 'county' };
  return { msa: scope.msa ? new Set([].concat(scope.msa)) : null, cty: scope.counties ? new Set([].concat(scope.counties)) : null, prefer: scope.prefer === 'city' ? 'city' : 'county' };
}
const placeInC = (S, f) => !!CI[f] && (!S.cty || S.cty.has(f)) && (!S.msa || S.msa.has(CI[f].msa));
const placeInZ = (S, z) => !!z && (!S.cty || S.cty.has(z.county)) && (!S.msa || S.msa.has(z.msa));
function placeCities(S) {
  const by = new Map();
  ZC.forEach(z => { if (!z.city || !placeInZ(S, z)) return; const k = z.city.toLowerCase(); let c = by.get(k); if (!c) by.set(k, c = { city: z.city, married: 0, zips: [], top: null, tm: -1 }); const m = (z.acs && z.acs.married) || 0; c.married += m; c.zips.push(z.zip); if (m > c.tm) { c.top = z; c.tm = m; } });
  return by;
}
const placeOfZip = z => ({ kind: 'zip', zip: z.zip, fips: z.county, msa: z.msa || null, city: z.city || null, label: z.zip + (z.city ? ' ' + z.city : '') });
const placeOfCounty = c => ({ kind: 'county', fips: c.fips, zip: null, msa: c.msa || null, city: null, label: c.name + ' County' });
const placeOfCity = c => ({ kind: 'city', city: c.city, zip: c.top.zip, fips: c.top.county, msa: c.top.msa || null, zips: c.zips.slice(), married: c.married, label: c.city });
function findPlace(q, scope) {
  const S = placeScope(scope); const raw = String(q == null ? '' : q).trim(); if (!raw) return null;
  let t = raw.toLowerCase().replace(/[.,;]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\s+(texas|tx)$/, '').replace(/\bft /g, 'fort ').replace(/\bmc (?=[a-z])/g, 'mc').trim();
  // numbers: a ZIP (alone or ahead of its city), a five digit county FIPS, or a three digit county code
  const d5 = t.match(/^(\d{5})(?:\s|$)/);
  if (d5) { const z = ZI[d5[1]]; if (z) return placeInZ(S, z) ? placeOfZip(z) : null; if (CI[d5[1]]) return placeInC(S, d5[1]) ? placeOfCounty(CI[d5[1]]) : null; return null; }
  if (/^\d{3}$/.test(t)) { const f = '48' + t; return placeInC(S, f) ? placeOfCounty(CI[f]) : null; }
  if (/^\d+$/.test(t)) return null;
  const big = (arr, w) => arr.sort((a, b) => w(b) - w(a))[0] || null; const cm = c => (c.acs && c.acs.married) || 0;
  const ctys = CTY.filter(c => placeInC(S, c.fips));
  // courts: the loaded courthouse list first, then any court words around a county name
  const courtWords = /\b(court|courts|courthouse|justice center|family law center|law center|judicial center|district clerk|county clerk|courthouse annex|\d+(st|nd|rd|th) district)\b/;
  const courts = loadedCourts().filter(c => placeInC(S, c.fips)); const cn = c => c.name.toLowerCase();
  const isCourt = courtWords.test(t);
  const court = courts.find(c => cn(c) === t) || (isCourt ? courts.find(c => cn(c).startsWith(t)) || courts.find(c => cn(c).includes(t)) || courts.find(c => t.includes(cn(c))) : null);
  if (court) return { kind: 'court', fips: court.fips, zip: null, msa: CI[court.fips] ? CI[court.fips].msa || null : null, city: court.city || null, court: court.name, label: court.name };
  const hadCounty = /\b(county|cnty|co)\b/.test(t);
  let name = t; if (isCourt) name = name.replace(courtWords, ' ').replace(/\b(district|family|law|center|annex|the|of|and|judicial)\b/g, ' ');
  name = name.replace(/\b(county|cnty|co)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (isCourt) { const c = ctys.find(x => x.name.toLowerCase() === name) || (name.length >= 3 ? big(ctys.filter(x => x.name.toLowerCase().startsWith(name)), cm) : null); return c ? { kind: 'court', fips: c.fips, zip: null, msa: c.msa || null, city: null, court: raw, label: raw + ' (' + c.name + ' County)' } : null; }
  if (!name) return null;
  const cities = placeCities(S); const exactC = ctys.find(c => c.name.toLowerCase() === name); const exactT = cities.get(name);
  if (exactC && (hadCounty || !exactT || S.prefer === 'county')) return placeOfCounty(exactC);
  if (exactT && !hadCounty) return placeOfCity(exactT);
  if (exactC) return placeOfCounty(exactC);
  const cityList = [...cities.values()];
  if (!hadCounty) { const c = big(cityList.filter(c => c.city.toLowerCase().startsWith(name)), c => c.married); if (c) return placeOfCity(c); }
  { const c = big(ctys.filter(c => c.name.toLowerCase().startsWith(name)), cm); if (c) return placeOfCounty(c); }
  if (name.length >= 3) {
    if (!hadCounty) { const c = big(cityList.filter(c => c.city.toLowerCase().includes(name)), c => c.married); if (c) return placeOfCity(c); }
    const c = big(ctys.filter(c => c.name.toLowerCase().includes(name)), cm); if (c) return placeOfCounty(c);
  }
  return null;
}
// the suggestions a find box offers inside a scope: counties, cities by married adults, ZIPs and the loaded courthouses
function findOptions(scope) {
  const S = placeScope(scope); const out = [];
  CTY.filter(c => placeInC(S, c.fips)).sort((a, b) => a.name.localeCompare(b.name)).forEach(c => out.push([c.name + ' County', 'County']));
  [...placeCities(S).values()].sort((a, b) => b.married - a.married).forEach(c => out.push([c.city, 'City · ' + cname(c.top.county) + ' County']));
  loadedCourts().filter(c => placeInC(S, c.fips)).forEach(c => out.push([c.name, 'Courthouse · ' + cname(c.fips) + ' County']));
  ZC.filter(z => placeInZ(S, z)).sort((a, b) => a.zip.localeCompare(b.zip)).forEach(z => out.push([z.zip, 'ZIP · ' + (z.city || cname(z.county))]));
  return out;
}
// findBox(el, onPick, opts): a labeled search field with suggestions inside el. Enter (or picking a suggestion) runs findPlace in the
// scope and hands the place to onPick; a miss marks the field and says so in a toast. opts: {scope (or a function returning it),
// label, placeholder, where (the scope's name for the miss message), id}. Returns {input, run(q), refresh()}.
let FB_N = 0;
function findBox(el, onPick, opts) {
  opts = opts || {}; const id = opts.id || ('fbx' + (++FB_N)); const scopeOf = () => typeof opts.scope === 'function' ? opts.scope() : opts.scope;
  el.innerHTML = `<div class="ctl findbox"><label for="${esc(id)}">${esc(opts.label || 'Find a county, city, ZIP or court')}</label><input type="search" id="${esc(id)}" list="${esc(id)}_l" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="${esc(opts.placeholder || 'Harris, Plano, 77002 or a courthouse')}"><datalist id="${esc(id)}_l"></datalist></div>`;
  const inp = el.querySelector('input'), dl = el.querySelector('datalist'); let filled = null, last = '', lastT = 0;
  const fill = () => { const key = JSON.stringify(scopeOf() || null) + '|' + loadedCourts().length; if (key === filled) return; filled = key; dl.innerHTML = findOptions(scopeOf()).map(o => `<option value="${esc(o[0])}" label="${esc(o[1])}"></option>`).join(''); };
  const run = v => {
    const q = String(v == null ? inp.value : v).trim(); if (!q) { inp.removeAttribute('aria-invalid'); return null; }
    if (q === last && performance.now() - lastT < 500) return null; last = q; lastT = performance.now();   // Enter and a pick can both fire: run once
    const hit = findPlace(q, scopeOf()); inp.setAttribute('aria-invalid', String(!hit));
    if (!hit) { if (typeof toast === 'function') toast(`No county, city, ZIP or courthouse ${opts.where ? 'in ' + opts.where + ' ' : ''}matches "${q}"`); return null; }
    if (onPick) { try { onPick(hit); } catch (e) { console.error(e); } } return hit;
  };
  inp.addEventListener('focus', fill);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fill(); run(); } });
  inp.addEventListener('input', e => { inp.removeAttribute('aria-invalid'); if (e.inputType && e.inputType !== 'insertReplacementText') return; const q = inp.value.trim().toLowerCase(); if (q && $$('option', dl).some(o => o.value.toLowerCase() === q)) run(); });   // a picked suggestion commits at once
  return { input: inp, run, refresh() { filled = null; fill(); } };
}
const MODS = []; const MODI = {};
function registerModule(m) { MODS.push(m); MODI[m.key] = m; }
function showModule(key, payload) {
  const m = MODI[key] || MODS[0];
  MODS.forEach(x => { const sec = $('#mod-' + x.key); if (sec) sec.hidden = x !== m; const b = $('#tab-' + x.key); if (b) b.setAttribute('aria-selected', String(x === m)); });
  if (!m.mounted) { m.mounted = true; try { m.mount($('#mod-' + m.key)); } catch (e) { $('#mod-' + m.key).innerHTML = `<div class="callout"><div class="h">Module error</div><p>${esc(e.message)}</p></div>`; console.error(e); } }
  if (payload && m.receive) { try { m.receive(payload); } catch (e) { console.error(e); } }   // goModule('publish', {pages}) hands the payload over
  if (m.onShow) { try { m.onShow(); } catch (e) { console.error(e); } }
  // a history step per module, so Back and Forward move between them (the boot listens for hashchange)
  store.set('sev.tab', m.key); try { const h = '#' + m.key; const cur = (location.hash || '').slice(1).split(/[/?]/)[0]; if (cur !== m.key) { if (MODI[cur]) history.pushState(null, '', h); else history.replaceState(null, '', h); } } catch (e) { }   // #atlas/hou keeps its argument
  if (window.onModuleShown) window.onModuleShown(m.key); if (!payload || !payload.keepScroll) window.scrollTo({ top: 0 });
}
