/* SEVERANCE core: data, helpers, map, charts, tables */
'use strict';
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
const store = {
  get(k, d) { try { const v = localStorage.getItem('sv.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sv.' + k, JSON.stringify(v)); } catch (e) { } }
};
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
const CO_KEEP = [[/chick\s*-\s*fil\s*-\s*a/ig, 'Chick-fil-A'], [/jeld\s*-\s*wen/ig, 'JELD-WEN'], [/\bt\s*-\s*mobile/ig, 'T-Mobile']];   // brand names keep their own spelling
const CO = s => { let t = String(s || ''); const keep = []; CO_KEEP.forEach(([re, v]) => { t = t.replace(re, () => { keep.push(v); return '\u0001' + (keep.length - 1) + '\u0001'; }); }); t = t.replace(/\b([A-Z])-(Shift)\b/g, '$1 $2').replace(/\s*-\s+|\s+-\s*/g, ' / ').replace(/([A-Za-z0-9.]{2,})-(?=[A-Z])/g, '$1 / ').replace(/\s{2,}/g, ' ').trim(); t = CO_DATED.reduce((x, re) => x.replace(re, ''), t).trim(); return t.replace(/\u0001(\d+)\u0001/g, (m, k) => keep[+k]); };
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
// the width a chart draws at: the container's own width when it is on screen, the caller's W otherwise (a hidden module)
function chartBox(el, o, W0, H0) { const cw = o.fixed ? 0 : Math.round(el.clientWidth || 0); const W = cw >= 120 ? cw : W0; return { W, H: cw >= 120 && H0 ? Math.round(H0 * clamp(cw / W0, 0.85, 1.35)) : H0, live: cw >= 120 }; }
// ---- choropleth
function drawMap(el, o) {
  // o: {W,H, paths:{id:d}, value:id=>num, color:num=>css, label:id=>html, onSelect, selected, counties:{id:d}, outline, cent:{id:[x,y]}, labels:[ids], ramp, legend:{min,max,fmt,title}, noDataLabel,
  //     alt:{test:id=>bool, color, label}: a second empty class with its own swatch, for areas whose value is a true zero rather than missing}
  const svg = [`<svg viewBox="0 0 ${o.W} ${o.H}" role="img" aria-label="${esc(o.title || 'map')}"><g class="areas">`];
  for (const id in o.paths) {
    const v = o.value(id); const c = isN(v) ? o.color(v) : (o.alt && o.alt.test(id) ? o.alt.color : null);
    svg.push(`<path class="area${o.selected === id ? ' sel' : ''}" data-id="${id}" d="${o.paths[id]}" fill="${c || 'var(--nodata)'}"></path>`);
  }
  svg.push('</g>');
  if (o.counties) for (const id in o.counties) svg.push(`<path class="cty" d="${o.counties[id]}"></path>`);
  if (o.outline) svg.push(`<path class="outline" d="${o.outline}"></path>`);
  if (o.labels && o.cent) o.labels.forEach(id => { const p = o.cent[id]; if (p) svg.push(`<text class="lbl" x="${p[0]}" y="${p[1]}" text-anchor="middle">${esc(o.labelText ? o.labelText(id) : id)}</text>`); });
  svg.push('</svg>');
  let leg = '';
  // the legend keeps its pieces together on a phone: the title, then [min ramp max], then each no data swatch with its label
  if (o.legend) leg = `<div class="legend"><span class="lt">${esc(o.legend.title || '')}</span><span class="lr"><span class="num">${esc(o.legend.min)}</span><span class="ramp" style="background:${o.legend.css || rampCSS(o.ramp || 'ember')}"></span><span class="num">${esc(o.legend.max)}</span></span>${o.alt ? `<span class="lnd"><span class="nd" style="background:${o.alt.color}"></span><span>${esc(o.alt.label)}</span></span>` : ''}<span class="lnd"><span class="nd"></span><span>${esc(o.noDataLabel || 'no data')}</span></span></div>`;
  el.innerHTML = svg.join('') + leg;
  const s = el.querySelector('svg');
  s.addEventListener('mousemove', e => { const p = e.target.closest('path.area'); if (!p) { hideTip(); return; } showTip(o.label(p.dataset.id), e.clientX, e.clientY); });
  s.addEventListener('mouseleave', hideTip);
  s.addEventListener('click', e => { const p = e.target.closest('path.area'); if (!p) return; if (o.onSelect) o.onSelect(p.dataset.id); if (tipFromTouch()) hideTip(); });
  el.__mapW = o.W; mapScale(el); sizeWatch(el, { map: true });
  return s;
}
// map labels are in map units; scale them so they read at about 11 px whatever the map's width, and hide them below 600 px
function mapScale(el) { const s = el.querySelector(':scope > svg'); if (!s || !el.__mapW) return; const cw = s.clientWidth || el.clientWidth; if (!cw) return; s.style.setProperty('--u', (el.__mapW / cw).toFixed(3)); el.classList.toggle('nolbl', cw < 600); }
function markSel(el, id) { $$('path.area', el).forEach(p => p.classList.toggle('sel', p.dataset.id === id)); if (id) { const p = el.querySelector(`path.area[data-id="${id}"]`); if (p) p.parentNode.appendChild(p); } }
// ---- charts
function lineChart(el, o) {
  // o: {series:[{name,color,values:[{x,y}]}], W,H, xfmt, yfmt, area, ymin, xTicks:[x...], xTickFmt, yTicks, bands:[{x0,x1,label}], title, fixed}
  // W and H are the design size: the chart draws at the container's width (H follows within 0.85 to 1.35 of the design ratio);
  // fixed:true draws at W exactly, as before.
  const bx = chartBox(el, o, o.W || 720, o.H || 240); const W = bx.W, H = bx.H; sizeWatch(el, { fn: lineChart, o, w: bx.live ? W : 0 });
  const xs = [], ys = []; o.series.forEach(s => s.values.forEach(p => { if (isN(p.y)) { xs.push(p.x); ys.push(p.y); } }));
  if (!xs.length) { el.innerHTML = '<div class="small">no data</div>'; return; }
  const x0 = Math.min(...xs), x1 = Math.max(...xs); let y0 = isN(o.ymin) ? o.ymin : Math.min(0, Math.min(...ys)), y1 = Math.max(...ys); if (y1 === y0) y1 = y0 + 1; if (o.ypad !== false) y1 = y1 + (y1 - y0) * 0.08;
  const yt = o.yTicks || niceTicks(y0, y1, 4); const ylab = yt.map(v => String(o.yfmt ? o.yfmt(v) : K(v)));
  const CW = 6.6;   // about one character of the 11.5 px axis text
  const m = { l: Math.max(46, Math.round(Math.max(...ylab.map(s => s.length)) * CW + 12)), r: 12, t: 14, b: 26 };
  const X = x => m.l + (x - x0) / (x1 - x0 || 1) * (W - m.l - m.r), Y = y => m.t + (1 - (y - y0) / (y1 - y0)) * (H - m.t - m.b);
  const svg = [`<svg viewBox="0 0 ${W} ${H}"${o.title ? ` role="img" aria-label="${esc(o.title)}"` : ''}>`];
  yt.forEach((v, i) => { svg.push(`<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"></line><text class="ax" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(ylab[i])}</text>`); });
  if (o.bands) o.bands.forEach(b => { const bw = Math.max(1, X(b.x1) - X(b.x0)); const fits = String(b.label || '').length * CW < Math.max(bw, 90); svg.push(`<rect x="${X(b.x0)}" y="${m.t}" width="${bw}" height="${H - m.t - m.b}" fill="var(--sunk-2)" opacity=".5"></rect>${fits ? `<text class="ax" x="${X(b.x0) + 3}" y="${m.t + 11}">${esc(b.label || '')}</text>` : ''}`); });
  // x ticks: drop every other one (then more) until the labels no longer collide at this width
  let xt = (o.xTicks || niceTicks(x0, x1, 6)).filter(v => v >= x0 && v <= x1); const xlab = v => String(o.xTickFmt ? o.xTickFmt(v) : v);
  const room = (W - m.l - m.r) / Math.max(1, xt.length - 1); const need = Math.max(...xt.map(v => xlab(v).length), 1) * CW + 8;
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
  const bh = 22, gap = 6, CW = 6.4; const H = rows.length * (bh + gap) + 8;
  const fv = v => String(o.fmt ? o.fmt(v) : N(v)); const vw = Math.max(44, Math.max(0, ...rows.map(r => fv(r.value).length)) * CW + 10);
  const lw = Math.round(Math.min(o.lw || 170, Math.max(96, W * 0.42)));
  const maxc = Math.max(6, Math.floor((lw - 10) / CW)); const cut = s => { s = String(s == null ? '' : s); return s.length > maxc ? s.slice(0, maxc - 1).replace(/[\s,·(]+$/, '') + '…' : s; };
  const mx = o.max || Math.max(...rows.map(r => Math.abs(r.value) || 0), 1e-9); const neg = rows.some(r => r.value < 0);
  const span = Math.max(20, W - lw - vw); const zero = neg ? lw + span / 2 : lw; const scale = span / (neg ? 2 * mx : mx);
  const svg = [`<svg viewBox="0 0 ${W} ${H}"${o.title ? ` role="img" aria-label="${esc(o.title)}"` : ''}>`];
  rows.forEach((r, i) => { const y = 4 + i * (bh + gap); const w = Math.abs(r.value) * scale; const x = r.value < 0 ? zero - w : zero; const lab = cut(r.label); svg.push(`<text class="lbl" x="${lw - 8}" y="${y + bh / 2 + 4}" text-anchor="end">${lab !== String(r.label) ? `<title>${esc(r.label)}</title>` : ''}${esc(lab)}</text><rect x="${x}" y="${y}" width="${Math.max(w, 1)}" height="${bh}" fill="${r.color || 'var(--s1)'}"><title>${esc(r.label)}: ${esc(fv(r.value))}</title></rect><text class="lbl" x="${r.value < 0 ? zero + 5 : x + w + 4}" y="${y + bh / 2 + 4}" text-anchor="start" style="font-variant-numeric:tabular-nums">${esc(fv(r.value))}</text>`); });
  if (neg) svg.push(`<line x1="${zero}" x2="${zero}" y1="0" y2="${H}" class="gridl" style="stroke:var(--line-strong)"></line>`);
  svg.push('</svg>'); el.innerHTML = svg.join('');
}
function spark(vals, w = 120, h = 28, color = 'var(--s1)') { const v = vals.filter(isN); if (v.length < 2) return ''; const mn = Math.min(...v), mx = Math.max(...v); const d = vals.map((y, i) => isN(y) ? (i ? 'L' : 'M') + (i / (vals.length - 1) * w).toFixed(1) + ',' + (h - 2 - (y - mn) / (mx - mn || 1) * (h - 4)).toFixed(1) : '').join(''); return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="vertical-align:middle"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"></path></svg>`; }
function seasBlock(el, idx, color) { const mx = Math.max(...idx), mn = Math.min(...idx); el.innerHTML = `<div class="seas">${idx.map((v, i) => { const t = (v - mn) / (mx - mn || 1); const bg = rampColor(color || 'ember', 0.08 + t * 0.8); return `<div style="background:${bg};color:${inkOn(bg)}"><b>${v.toFixed(0)}</b>${MO[i]}</div>`; }).join('')}</div>`; }
// ---- tables
function table(el, o) {
  // o:{cols:[{k,l,fmt,cls,w,tip, h,d,pct}], rows:[obj], sort:{k,dir}, onRow, selected, limit, caption}
  // h, d and pct describe the column for csv(): export header, decimals, and a fraction written as a percent
  // Sort headers are buttons with aria-sort; rows with onRow are focusable and open with Enter or Space.
  let st = { k: o.sort ? o.sort.k : o.cols[1].k, dir: o.sort ? o.sort.dir : -1 };
  const sorted = () => o.rows.slice().sort((a, b) => { const x = a[st.k], y = b[st.k]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * st.dir; });
  function render() {
    const ae = document.activeElement; const back = ae && el.contains(ae) ? { k: ae.closest('th') ? ae.closest('th').dataset.k : null, id: ae.matches('tr[data-id]') ? ae.dataset.id : null } : null;
    const rows = sorted();
    const lim = o.limit ? rows.slice(0, o.limit) : rows;
    const tab = o.onRow ? ' tabindex="0"' : '';
    el.innerHTML = `<div class="tblbox"><div class="tblwrap"><table class="t">${o.caption ? `<caption class="vh">${esc(o.caption)}</caption>` : ''}<thead><tr>${o.cols.map(c => `<th data-k="${esc(c.k)}" class="${st.k === c.k ? (st.dir < 0 ? 's' : 'sa') : ''} ${c.cls || ''}"${st.k === c.k ? ` aria-sort="${st.dir < 0 ? 'descending' : 'ascending'}"` : ''}><button type="button" class="thb"${c.tip ? ` title="${esc(c.tip)}"` : ''}>${esc(c.l)}</button></th>`).join('')}</tr></thead><tbody>${lim.map(r => { const sel = o.selected && r._id === o.selected; return `<tr data-id="${esc(r._id)}"${tab} class="${sel ? 'sel' : ''}"${sel ? ' aria-current="true"' : ''}>${o.cols.map((c, i) => `<td class="${i === 0 ? 'name' : ''} ${c.cls || ''}">${c.fmt ? c.fmt(r[c.k], r) : esc(r[c.k])}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></div>${o.limit && rows.length > o.limit ? `<div class="small">Showing ${o.limit} of ${rows.length}. Sort or filter to see others.</div>` : ''}`;
    $$('th', el).forEach(th => th.onclick = () => { const k = th.dataset.k; if (st.k === k) st.dir = -st.dir; else { st.k = k; st.dir = -1; } render(); const b = el.querySelector(`th[data-k="${CSS.escape(k)}"] .thb`); if (b) b.focus(); });
    if (o.onRow) { $$('tbody tr', el).forEach(tr => tr.onclick = () => o.onRow(tr.dataset.id)); const tb = el.querySelector('tbody'); if (tb) tb.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) { e.preventDefault(); o.onRow(e.target.dataset.id); } }; }
    if (back) { const f = back.k ? el.querySelector(`th[data-k="${CSS.escape(back.k)}"] .thb`) : back.id != null ? el.querySelector(`tr[data-id="${CSS.escape(back.id)}"]`) : null; if (f) f.focus({ preventScroll: true }); }
    fadeCheck(el.querySelector('.tblwrap'));
  }
  render();
  return { render, setRows(r) { o.rows = r; render(); }, setSel(id) { o.selected = id; render(); }, sorted, sort: () => Object.assign({}, st) };
}
// ---- csv / export
// cols:[{l, k (key or row=>value), d (round to d decimals), pct (a fraction written as a percent)}]; numbers are written without
// thousands separators so a spreadsheet reads them as numbers
function csv(rows, cols) {
  const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const val = (c, r) => { let v = typeof c.k === 'function' ? c.k(r) : r[c.k]; if (typeof v === 'number') { if (!isFinite(v)) return ''; if (c.pct) v *= 100; if (c.d != null) { const f = Math.pow(10, c.d); v = Math.round(v * f) / f; if (Object.is(v, -0)) v = 0; } } return v; };
  return [cols.map(c => q(c.l)).join(',')].concat(rows.map(r => cols.map(c => q(val(c, r))).join(','))).join('\n');
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
  $('#copyBtn').onclick = () => { const ta = $('#exportText'); navigator.clipboard.writeText(ta.value).then(() => { $('#copyBtn').textContent = 'Copied'; }).catch(() => { ta.select(); document.execCommand && document.execCommand('copy'); $('#copyBtn').textContent = 'Selected, press Ctrl or Cmd C'; }); };
  $('#closeBtn').onclick = closeModal;
}
let MODAL_RET = null;
function openModal(html) { let m = $('#modal'); if (!m) { m = document.createElement('div'); m.id = 'modal'; m.className = 'modal'; m.innerHTML = '<div class="box" role="dialog" aria-modal="true" tabindex="-1"></div>'; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) closeModal(); }); m.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); }); } if (!m.classList.contains('on')) MODAL_RET = document.activeElement; const box = m.querySelector('.box'); box.innerHTML = html; const h = box.querySelector('h3'); if (h) { h.id = 'modalTitle'; box.setAttribute('aria-labelledby', 'modalTitle'); } m.classList.add('on'); box.focus(); }
function closeModal() { const m = $('#modal'); if (m && m.classList.contains('on')) { m.classList.remove('on'); if (MODAL_RET && MODAL_RET.focus) try { MODAL_RET.focus(); } catch (e) { } MODAL_RET = null; } }
// ---- shell bits
// the module title is the page's level one heading (one module shows at a time; hidden ones leave the accessibility tree)
function mastHTML(o) { return `<div class="mast"><div class="eyebrow">${esc(o.eyebrow)}</div><h1 class="mh">${esc(o.title)}</h1><div class="dek">${o.dek}</div>${o.ribbon ? `<button type="button" class="ribbon" data-go="${esc(o.ribbon.go)}">${esc(o.ribbon.text)}</button><div style="height:14px"></div>` : '<div class="rule"></div>'}<div class="facts">${(o.facts || []).map(f => `<span><b>${f[0]}</b> ${f[1]}</span>`).join('')}</div></div>`; }
function tile(l, v, s, g) { return `<div class="tile"><div class="l"><span>${esc(l)}</span>${g ? `<span class="grade ${g}" title="Confidence grade ${g}">${g}</span>` : ''}</div><div class="v">${v}</div><div class="s">${s || ''}</div></div>`; }
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
const MODS = []; const MODI = {};
function registerModule(m) { MODS.push(m); MODI[m.key] = m; }
function showModule(key, payload) {
  const m = MODI[key] || MODS[0];
  MODS.forEach(x => { const sec = $('#mod-' + x.key); if (sec) sec.hidden = x !== m; const b = $('#tab-' + x.key); if (b) b.setAttribute('aria-selected', String(x === m)); });
  if (!m.mounted) { m.mounted = true; try { m.mount($('#mod-' + m.key)); } catch (e) { $('#mod-' + m.key).innerHTML = `<div class="callout"><div class="h">Module error</div><p>${esc(e.message)}</p></div>`; console.error(e); } }
  if (payload && m.receive) { try { m.receive(payload); } catch (e) { console.error(e); } }   // goModule('publish', {pages}) hands the payload over
  if (m.onShow) { try { m.onShow(); } catch (e) { console.error(e); } }
  store.set('sev.tab', m.key); try { history.replaceState(null, '', '#' + m.key); } catch (e) { } if (window.onModuleShown) window.onModuleShown(m.key); if (!payload || !payload.keepScroll) window.scrollTo({ top: 0 });
}
