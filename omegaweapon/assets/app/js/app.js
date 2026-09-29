/* OmegaWeapon: the Agency Radar, the Horus lens and the Targets wing in one app. Built by omega_platform.py build-app. */
(function () {
/* Core: data indexes, DOM helpers, storage, routing, search, tooltip, chart primitives.
   Every data string enters the page as a text node; links are limited to http(s). */
'use strict';

const D = window.RADAR;
if (!D) { document.body.textContent = 'Agency Radar data did not load.'; throw new Error('RADAR missing'); }
const A = D.agencies;
const BYID = new Map(A.map(a => [a.id, a]));
const HZ = D.horus, ED = HZ.edition, MODEL = HZ.model, FIELD = HZ.field;
const DIMS = D.meta.strat_dims;
const DIM_KEYS = DIMS.map(d => d[0]);
const DIM_LABEL = Object.fromEntries(DIMS);
DIM_LABEL.linkedin = 'LinkedIn advertising'; DIM_LABEL.content = 'Publishing cadence';
const KJ = Object.fromEntries(ED.key_judgments.map(k => [k.id, k]));
const KJ_IDS = ED.key_judgments.map(k => k.id);
const SIG = Object.fromEntries(ED.signals.map(s => [s.id, s]));
const ITEM = Object.fromEntries(ED.items.map(i => [i.id, i]));
const IND = Object.fromEntries(ED.indicators.map(i => [i.id, i]));
const SCEN = Object.fromEntries(ED.scenarios.items.map(s => [s.id, s]));
const SCEN_IDS = ED.scenarios.items.map(s => s.id);
const IMPL = Object.fromEntries(ED.implications.map(p => [p.id, p]));
const IMPL_IDS = ED.implications.map(p => p.id);
const TOPIC = Object.fromEntries(ED.topics.map(t => [t.id, t]));
// bar scale for judgment nets: the 95th percentile of non-zero |net| across the field (larger values fill the half-track)
const KJ_MAX = (() => { const v = A.filter(a => a.horus && a.horus.ok).flatMap(a => Object.values(a.horus.kj).map(x => Math.abs(x.net))).filter(x => x > 0).sort((p, q) => p - q); return Math.max(0.25, v[Math.floor(v.length * 0.95)] || 1); })();
const STAGES = ['Khepri', 'Ra', 'Atum', 'Duat'];
const STAGE_CLS = { Khepri: 'k', Ra: 'r', Atum: 'a', Duat: 'd' };
const STAGE_TIME = { Khepri: 'dawn', Ra: 'noon', Atum: 'dusk', Duat: 'night' };
const BANDS = ['Tailwind', 'Favored', 'Neutral', 'Exposed', 'Headwind'];
const MOVE_STATUS = ['making', 'partial', 'absent', 'unknown', 'na'];
const MOVE_LABEL = { making: 'Making', partial: 'Partial', absent: 'Not seen', unknown: 'No public evidence', na: 'Not applicable' };
const RAIL_IDS = ['R1', 'R2', 'R3', 'L'];
const IS_EXT = location.protocol === 'chrome-extension:';
const FRAMED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const MODE = window.RADAR_MODE || new URLSearchParams(location.search).get('mode') || 'full';
const HAS_CHROME = typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local;

/* ---------- DOM helpers ---------- */
const NS = 'http://www.w3.org/2000/svg';
function safeHref(u) {
  if (typeof u !== 'string') return null;
  const t = u.trim();
  if (t.startsWith('#')) return t;
  try { const p = new URL(t); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : null; } catch (e) { return null; }
}
function build(el, attrs, kids) {
  if (attrs) for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'href') { const s = safeHref(v); if (s) el.setAttribute('href', s); }
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
function h(tag, attrs, ...kids) { return build(document.createElement(tag), attrs, kids); }
function s(tag, attrs, ...kids) { return build(document.createElementNS(NS, tag), attrs, kids); }
function frag(...kids) { const f = document.createDocumentFragment(); for (const k of kids.flat(Infinity)) if (k != null && k !== false) f.appendChild(k instanceof Node ? k : document.createTextNode(String(k))); return f; }
function ext(url, text, cls) {
  const href = safeHref(url);
  if (!href) return h('span', { class: cls || '' }, text || url || '');
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'ext ' + (cls || '') }, text || hostOf(href));
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
function icon(name) {
  const P = {
    search: 'M10.5 3a7.5 7.5 0 015.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z',
    star: 'M12 3.2l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.5l-5.3 2.9 1.2-5.9-4.5-4.1 6-.7z',
    moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
    sun: 'M12 7a5 5 0 110 10 5 5 0 010-10zm0-5v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10l2.1 2.1M4.9 19.1l2.1-2.1m10-10l2.1-2.1',
    auto: 'M12 3a9 9 0 100 18V3z',
    back: 'M15 5l-7 7 7 7',
    copy: 'M8 8h11v13H8zM5 3h11v3H7v11H5z',
    down: 'M12 4v11m0 0l-5-5m5 5l5-5M5 20h14',
    open: 'M14 4h6v6m0-6L10 14M18 14v6H4V6h6',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    panel: 'M4 4h16v16H4zM14 4v16'
  };
  const stroke = ['sun', 'back', 'down', 'open', 'plus', 'x', 'panel'].includes(name);
  return s('svg', { class: 'ic', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: stroke ? 'none' : 'currentColor', stroke: stroke ? 'currentColor' : 'none', 'stroke-width': stroke ? '2' : null, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('path', { d: P[name] || '' }));
}
function starIcon() { return s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M12 3.2l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.5l-5.3 2.9 1.2-5.9-4.5-4.1 6-.7z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linejoin': 'round' })); }
function wedjat(cls) {
  return s('svg', { class: cls || 'wedjat', viewBox: '0 0 128 80', role: 'img', 'aria-label': 'Eye of Horus' },
    s('path', { d: 'M9 17 C 33 4, 86 2, 119 12 L 117 20 C 86 10, 37 12, 12 25 Z', fill: 'currentColor' }),
    s('path', { d: 'M13 38 C 33 20, 82 16, 112 33 C 84 47, 38 51, 13 38 Z', fill: 'none', stroke: 'currentColor', 'stroke-width': '4.5', 'stroke-linejoin': 'round' }),
    s('circle', { class: 'iris', cx: '60', cy: '34', r: '10.5' }),
    s('path', { d: 'M112 33 L 125 30.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '4.5', 'stroke-linecap': 'round' }),
    s('path', { class: 'tear', d: 'M52 48 L 47 74', fill: 'none', 'stroke-width': '5.5', 'stroke-linecap': 'round' }),
    s('path', { d: 'M70 48 C 72 63, 86 71, 97 64.5 C 105 59.5, 99 49.5, 90.5 53.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '4.5', 'stroke-linecap': 'round' }));
}
function brandMark() {
  // the Omega over the radar sweep: the eye of the Radar inside the last letter
  return s('svg', { viewBox: '0 0 48 48', 'aria-hidden': 'true' },
    s('circle', { cx: '24', cy: '24', r: '21', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
    s('path', { d: 'M24 24 L 41.5 12.5 A 21 21 0 0 1 45 24 Z', fill: 'var(--sun-bar)', opacity: '.9' }),
    s('path', { d: 'M15.5 35 H 21.2 C 14.5 31.5, 12.2 24.5, 14.8 18.6 C 17 13.6, 22 11.6, 26.4 12.4 C 33 13.6, 36.6 20.4, 34.3 27 C 33.3 30.4, 30.4 33, 26.8 35 H 32.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '3.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    s('circle', { cx: '24', cy: '23.5', r: '3.6', fill: 'var(--sun-bar)', stroke: 'currentColor', 'stroke-width': '1.2' }),
    s('path', { d: 'M20.5 28 L 18.5 33.5', fill: 'none', stroke: 'var(--moon-bar)', 'stroke-width': '2.2', 'stroke-linecap': 'round' }));
}

/* ---------- formatting ---------- */
const nf = new Intl.NumberFormat('en-US');
function fmt(n) { return n == null || Number.isNaN(n) ? '–' : nf.format(n); }
function peopleStr(e) { if (!e) return null; const s = String(e); return /^[\d.,+\s-]+$/.test(s) || /\d\+?$/.test(s) ? s + ' people' : s; }
function fmt1(n) { return n == null ? '–' : (Math.round(n * 10) / 10).toFixed(1); }
function pct(n, d = 0) { return n == null ? '–' : (100 * n).toFixed(d) + '%'; }
function signed(n, d = 0) { if (n == null) return '–'; const v = Number(n.toFixed(d)); return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function by(fn, dir = -1) { return (x, y) => { const a = fn(x), b = fn(y); if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; return a < b ? -dir : a > b ? dir : 0; }; }
function countBy(arr, fn) { const m = new Map(); for (const x of arr) { const k = fn(x); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); }
function median(xs) { const v = xs.filter(x => x != null).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; }
function mean(xs) { const v = xs.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
function hourStr(h) { if (h == null) return '–'; let hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
function dateKey(d) { if (!d) return ''; return String(d).padEnd(10, d.length === 4 ? '-00-00' : '-00').slice(0, 10); }
function strat(a, k) { return a.strategy ? (a.strategy[k] ?? null) : null; }
function statusPill(st) {
  const map = { active: ['ok', 'Active'], merged: ['off', 'Merged'], 'acquired-rebranded': ['off', 'Acquired'], defunct: ['bad', 'Defunct'], uncertain: ['warn', 'Uncertain'] };
  const [c, t] = map[st] || ['off', st || 'Unknown'];
  return h('span', { class: 'pill ' + c }, t);
}
function bandTag(hz) { return hz && hz.ok ? h('span', { class: 'band ' + hz.band, title: 'Horus Tailwind Index ' + signed(hz.hti) }, hz.band) : h('span', { class: 'band Neutral' }, 'No read'); }
function stageTag(st) { return h('span', { class: 'stage ' + st }, h('i'), st + ' · ' + STAGE_TIME[st]); }
function momTag(m) {
  const map = { 'up strongly': ['up2', '▲▲'], up: ['up', '▲'], flat: ['flat', '▬'], down: ['down', '▼'] };
  const [c, t] = map[m] || ['flat', '·'];
  return h('span', { class: 'mom ' + c, title: 'Nilometer direction: ' + (m || 'n/a') }, t);
}
function gradeTag(g) { return h('span', { class: 'grade g' + String(g || '?')[0] }, g || '?'); }
function probWord(kj) { return kj.likelihood + ' (' + kj.range + ')'; }
function capName(k) { return DIM_LABEL[k] || k; }
const CAP_SHORT = { seo: 'SEO', content_pr: 'Content/PR', ai_search: 'AI search', paid_search: 'Paid search', paid_social: 'Paid social', programmatic_ctv: 'Prog/CTV', retail_media: 'Retail', creator_influencer: 'Creator', cro: 'CRO', web_dev: 'Web', data_measurement: 'Data', email_crm: 'Email', b2b_abm: 'B2B', local: 'Local', ai_automation: 'AI agents' };

/* ---------- storage (per viewer; never load-bearing) ---------- */
const store = {
  data: { watch: [], notes: {}, compare: [], theme: 'system', prefs: {}, queue: [] },
  async load() {
    try {
      if (IS_EXT && HAS_CHROME) {
        const r = await chrome.storage.local.get('radar');
        if (r && r.radar) Object.assign(this.data, r.radar);
      } else {
        const raw = localStorage.getItem('omegaweapon') || localStorage.getItem('agency-radar-horus');
        if (raw) Object.assign(this.data, JSON.parse(raw));
      }
    } catch (e) { /* storage unavailable: run in memory */ }
    this.data.watch = (this.data.watch || []).filter(id => BYID.has(id));
    this.data.compare = (this.data.compare || []).filter(id => BYID.has(id)).slice(0, 4);
    this.data.queue = Array.isArray(this.data.queue) ? this.data.queue : [];
  },
  save() {
    try {
      if (IS_EXT && HAS_CHROME) chrome.storage.local.set({ radar: this.data });
      else localStorage.setItem('omegaweapon', JSON.stringify(this.data));
    } catch (e) { /* ignore */ }
  }
};
function isWatched(id) { return store.data.watch.includes(id); }
function toggleWatch(id) {
  const w = store.data.watch; const i = w.indexOf(id);
  if (i >= 0) w.splice(i, 1); else w.push(id);
  store.save(); toast(i >= 0 ? 'Removed from watchlist' : 'Added to watchlist');
  return i < 0;
}
function starBtn(id) {
  const b = h('button', { class: 'star', type: 'button', 'aria-pressed': String(isWatched(id)), title: 'Watchlist', 'aria-label': 'Toggle watchlist' }, starIcon());
  b.addEventListener('click', e => { e.stopPropagation(); const on = toggleWatch(id); b.setAttribute('aria-pressed', String(on)); });
  return b;
}
function inCompare(id) { return store.data.compare.includes(id); }
function toggleCompare(id) {
  const c = store.data.compare; const i = c.indexOf(id);
  if (i >= 0) { c.splice(i, 1); toast('Removed from compare'); }
  else { if (c.length >= 4) { toast('Compare holds four agencies. Remove one first.'); return false; } c.push(id); toast('Added to compare (' + c.length + ' of 4)'); }
  store.save(); return i < 0;
}

/* ---------- theme ---------- */
function applyTheme() {
  const t = store.data.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  store.data.theme = order[(order.indexOf(store.data.theme) + 1) % 3];
  applyTheme(); store.save(); paintThemeBtn(); toast('Theme: ' + store.data.theme);
  document.querySelectorAll('iframe.omega-frame').forEach(f => { try { f.contentWindow.postMessage({ type: 'omega:theme', theme: store.data.theme }, '*'); } catch (e) { /* ignore */ } });
}
let themeBtn;
function paintThemeBtn() {
  if (!themeBtn) return;
  themeBtn.replaceChildren(icon(store.data.theme === 'dark' ? 'moon' : store.data.theme === 'light' ? 'sun' : 'auto'));
  themeBtn.title = 'Theme: ' + store.data.theme;
}

/* ---------- toast + tooltip ---------- */
let toastEl, toastT;
function toast(msg) {
  if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 2200);
}
const tipEl = h('div', { class: 'tip', role: 'tooltip', hidden: true });
function showTip(x, y, content) {
  tipEl.replaceChildren(content instanceof Node ? content : document.createTextNode(String(content)));
  tipEl.hidden = false;
  const r = tipEl.getBoundingClientRect(); const vw = window.innerWidth, vh = window.innerHeight;
  let left = x + 14, top = y + 14;
  if (left + r.width > vw - 8) left = x - r.width - 14;
  if (top + r.height > vh - 8) top = y - r.height - 14;
  tipEl.style.left = Math.max(8, left) + 'px'; tipEl.style.top = Math.max(8, top) + 'px';
}
function hideTip() { tipEl.hidden = true; }
function tipOn(el, fn) {
  el.addEventListener('pointerenter', e => showTip(e.clientX, e.clientY, fn()));
  el.addEventListener('pointermove', e => showTip(e.clientX, e.clientY, fn()));
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); showTip(r.left + r.width / 2, r.bottom, fn()); });
  el.addEventListener('blur', hideTip);
  return el;
}
function tipBody(value, label, extra) { return frag(h('div', { class: 'tv' }, value), label ? h('div', { class: 'tl2' }, label) : null, extra ? h('div', { class: 'tl2' }, extra) : null); }

/* ---------- copy / download ---------- */
async function copyText(text, what) {
  try { await navigator.clipboard.writeText(text); toast((what || 'Text') + ' copied'); return true; }
  catch (e) {
    const ta = h('textarea', { style: { position: 'fixed', left: '-9999px' } }); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove(); toast(ok ? (what || 'Text') + ' copied' : 'Copy was blocked. Select and copy manually.'); return ok;
  }
}
function canDownload() { return !FRAMED; }
function download(name, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { download: name }); a.href = url; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000); toast('Saved ' + name);
}
function csvCell(v) { if (v == null) return ''; const t = Array.isArray(v) ? v.join('; ') : String(v); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
function toCSV(rows, cols) { return [cols.map(c => csvCell(c.label)).join(','), ...rows.map(r => cols.map(c => csvCell(c.csv(r))).join(','))].join('\r\n'); }
function exportButtons(name, getText, mime) {
  const wrap = h('div', { class: 'row' });
  if (canDownload()) wrap.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => download(name, getText(), mime) }, icon('down'), 'Download ' + name.split('.').pop().toUpperCase()));
  wrap.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => copyText(getText(), name.split('.').pop().toUpperCase()) }, icon('copy'), 'Copy ' + name.split('.').pop().toUpperCase()));
  return wrap;
}

/* ---------- routing ---------- */
const VIEWS = [
  ['pulse', 'Pulse'], ['targets', 'Targets'], ['horus', 'Horus'], ['offshore', 'Offshore'], ['agencies', 'Agencies'], ['matrix', 'Matrix'], ['clients', 'Clients'],
  ['paid', 'Paid & Social'], ['gaps', 'Gaps'], ['compare', 'Compare'], ['watch', 'Watchlist'], ['method', 'Method']
];
const DOSSIER_TABS = [['overview', 'Overview'], ['dossier', 'Dossier'], ['horus', 'Horus'], ['offshore', 'Offshore'], ['omega', 'Omega'], ['strategy', 'Strategy'], ['clients', 'Clients'], ['paid', 'Paid & Social'], ['content', 'Content & AI'], ['moves', 'Moves & News'], ['sources', 'Sources']];
function parseHash() {
  const t = decodeURIComponent((location.hash || '').slice(1));
  if (t.startsWith('a.')) {
    const parts = t.slice(2).split('.');
    const id = parts[0]; const tab = parts[1] && DOSSIER_TABS.some(d => d[0] === parts[1]) ? parts[1] : 'overview';
    if (BYID.has(id)) return { view: 'agency', id, tab };
  }
  if (t.startsWith('h.')) return { view: 'horus', anchor: t.slice(2) };
  if (t.startsWith('t/')) { const parts = t.slice(2).split('/'); const key = parts[0]; const tab = parts[1] && OMEGA_TABS.some(d => d[0] === parts[1]) ? parts[1] : 'brief'; return { view: 'target', key, tab }; }
  if (t === 'queue') return { view: 'targets', anchor: 'queue' };
  return { view: VIEWS.some(v => v[0] === t) ? t : (MODE === 'panel' ? 'panel' : 'pulse') };
}
let lastListView = 'agencies';
function go(token) { if ((location.hash || '').slice(1) === token) render(); else location.hash = token; }
function agencyLink(a, text, tab) {
  const el = h('a', { href: '#a.' + a.id + (tab ? '.' + tab : ''), class: 'alink' }, text || a.name);
  return el;
}

/* ---------- global search ---------- */
const CLIENT_INDEX = (() => {
  const m = new Map();
  for (const a of A) for (const c of (a.clients || [])) {
    const key = String(c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key) continue;
    if (!m.has(key)) m.set(key, { name: c.name, agencies: [] });
    const e = m.get(key);
    if (!e.agencies.some(x => x.id === a.id)) e.agencies.push({ id: a.id, evidence: c.evidence, url: c.url });
  }
  return m;
})();
function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
const SEARCH_ROWS = A.map(a => ({ a, hay: norm([a.name, a.domain, a.id, a.owner, a.segment, a.archetype, a.hq_city, a.hq_country].join(' ')) }));
function searchAll(q) {
  const n = norm(q).trim(); if (!n) return { agencies: [], clients: [], targets: [] };
  const targets = targetsList().filter(t => norm([t.summary.business, t.summary.domain, (t.summary.agency || {}).name].join(' ')).includes(n)).slice(0, 5);
  const agencies = SEARCH_ROWS.filter(r => r.hay.includes(n)).map(r => r.a)
    .sort((x, y) => (norm(y.name).startsWith(n) - norm(x.name).startsWith(n)) || (y.prominence || 0) - (x.prominence || 0)).slice(0, 8);
  const clients = [];
  for (const [k, v] of CLIENT_INDEX) { if (k.includes(n)) clients.push(v); if (clients.length > 40) break; }
  clients.sort((x, y) => y.agencies.length - x.agencies.length);
  return { agencies, clients: clients.slice(0, 6), targets };
}
function mountSearch(host) {
  const input = h('input', { type: 'search', id: 'global-search', placeholder: 'Search targets, agencies, clients', autocomplete: 'off', 'aria-label': 'Search targets, agencies and clients', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'search-results' });
  const box = h('div', { class: 'results', id: 'search-results', role: 'listbox', hidden: true });
  let items = [], sel = -1;
  function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; }
  function choose(i) { const it = items[i]; if (!it) return; close(); input.value = ''; it.go(); }
  function paint() {
    const q = input.value; const r = searchAll(q); items = []; box.replaceChildren();
    if (!q.trim()) { close(); return; }
    if (r.targets.length) {
      box.appendChild(h('div', { class: 'grp' }, 'Targets'));
      for (const t of r.targets) {
        const i = items.length; items.push({ go: () => go('t/' + t.summary.key) });
        box.appendChild(h('button', { type: 'button', role: 'option', onclick: () => choose(i) },
          h('span', { class: 'r-main' }, t.summary.business + '  ', h('span', { class: 'muted' }, t.summary.domain)),
          h('span', { class: 'r-side' }, 'overall ' + (t.summary.overall || 'NA') + ' · ' + (t.summary.run_date || ''))));
      }
    }
    if (r.agencies.length) {
      box.appendChild(h('div', { class: 'grp' }, 'Agencies'));
      for (const a of r.agencies) {
        const i = items.length; items.push({ go: () => go('a.' + a.id) });
        box.appendChild(h('button', { type: 'button', role: 'option', onclick: () => choose(i) },
          h('span', { class: 'r-main' }, a.name + '  ', h('span', { class: 'muted' }, a.domain)),
          h('span', { class: 'r-side' }, (a.horus && a.horus.ok ? a.horus.band + ' ' + signed(a.horus.hti) : a.status))));
      }
    }
    if (r.clients.length) {
      box.appendChild(h('div', { class: 'grp' }, 'Clients'));
      for (const c of r.clients) {
        const i = items.length; items.push({ go: () => { clientQuery = c.name; go('clients'); } });
        box.appendChild(h('button', { type: 'button', role: 'option', onclick: () => choose(i) },
          h('span', { class: 'r-main' }, c.name), h('span', { class: 'r-side' }, c.agencies.length + (c.agencies.length === 1 ? ' agency' : ' agencies'))));
      }
    }
    if (!items.length) box.appendChild(h('div', { class: 'none' }, 'No target, agency or client matches "' + q + '".'));
    box.hidden = false; input.setAttribute('aria-expanded', 'true'); sel = -1;
  }
  input.addEventListener('input', paint);
  input.addEventListener('keydown', e => {
    const opts = [...box.querySelectorAll('button[role="option"]')];
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(opts.length - 1, sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel >= 0 ? sel : 0); return; }
    else if (e.key === 'Escape') { close(); input.blur(); return; }
    else return;
    opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === sel)));
    if (opts[sel]) opts[sel].scrollIntoView({ block: 'nearest' });
  });
  document.addEventListener('click', e => { if (!host.contains(e.target)) close(); });
  host.append(icon('search'), input, h('kbd', null, '/'), box);
  host.querySelector('svg').classList.add('ico');
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); input.focus(); }
  });
}
let clientQuery = '';

/* ---------- chart primitives (HTML bars; SVG only where geometry demands it) ---------- */
function barList(rows, opt = {}) {
  // rows: [{label, value, display?, onClick?, tip?, cls?}]
  const max = opt.max != null ? opt.max : Math.max(1e-9, ...rows.map(r => r.value || 0));
  const wrap = h('div', { class: 'bars' });
  for (const r of rows) {
    const w = clamp(100 * (r.value || 0) / max, 0, 100);
    const fill = h('span', { class: 'fill ' + (r.cls || opt.cls || '') }); fill.style.width = w + '%';
    const track = h('div', { class: 'track base' }, fill);
    if (r.tick != null) { const t = h('span', { class: 'tick' }); t.style.left = clamp(100 * r.tick / max, 0, 100) + '%'; track.appendChild(t); }
    const lbl = r.onClick ? h('button', { class: 'lbl', type: 'button', onclick: r.onClick, title: r.label }, r.label) : h('span', { class: 'lbl', title: r.label }, r.label);
    const row = h('div', { class: 'bar-row' }, lbl, track, h('span', { class: 'v' }, r.display != null ? r.display : fmt(r.value)));
    if (r.tip) tipOn(track, r.tip);
    wrap.appendChild(row);
  }
  return wrap;
}
function stackBar(parts, opt = {}) {
  // parts: [{value, cls, label}]
  const tot = opt.total || parts.reduce((a, p) => a + (p.value || 0), 0) || 1;
  const bar = h('div', { class: 'stackbar' + (opt.tall ? ' tall' : ''), role: 'img', 'aria-label': parts.map(p => p.label + ' ' + (opt.fmt ? opt.fmt(p.value) : p.value)).join(', ') });
  for (const p of parts) {
    if (!p.value) continue;
    const seg = h('span', { class: p.cls }); seg.style.width = (100 * p.value / tot) + '%';
    tipOn(seg, () => tipBody(opt.fmt ? opt.fmt(p.value) : fmt(p.value), p.label, p.extra));
    if (p.onClick) { seg.style.cursor = 'pointer'; seg.addEventListener('click', p.onClick); }
    bar.appendChild(seg);
  }
  return bar;
}
function divBar(v, max, title) {
  const el = h('div', { class: 'div', role: 'img', 'aria-label': title || String(v) });
  const w = clamp(50 * Math.abs(v) / (max || 1), 0, 50);
  const b = h('span', { class: v >= 0 ? 'pos' : 'neg' }); b.style.width = w + '%';
  el.appendChild(b);
  return el;
}
function htiCell(hz) {
  if (!hz || !hz.ok) return h('span', { class: 'muted small' }, 'no read');
  return h('span', { class: 'hti', title: 'Horus Tailwind Index ' + signed(hz.hti) + ' (' + hz.hti_pct + 'th percentile)' }, h('b', null, signed(hz.hti)), divBar(hz.hti, 80));
}
function stageStack(mix, opt = {}) {
  return stackBar(STAGES.map(st => ({ value: mix[st] || 0, cls: STAGE_CLS[st], label: st + ' (' + STAGE_TIME[st] + ')' })), { fmt: v => pct(v), tall: opt.tall, total: 1 });
}
function stageLegend() { return h('div', { class: 'legend' }, STAGES.map(st => h('span', { class: 'key' }, h('i', { class: STAGE_CLS[st] }), st + ' · ' + STAGE_TIME[st]))); }
function meter(label, v, cls, sub) {
  const sp = h('span'); sp.style.width = clamp(v || 0, 0, 100) + '%';
  return h('div', { class: 'meter ' + (cls || '') }, h('div', { class: 'm-h' }, h('span', null, label), h('b', null, v == null ? '–' : Math.round(v))), h('div', { class: 'm-t' }, sp), sub ? h('div', { class: 'note' }, sub) : null);
}
function sectionHead(title, aside, id) { return h('div', { class: 'sec-head', id: id || null }, h('h2', null, title), aside ? h('p', { class: 'aside' }, aside) : null); }
function sortableTable(cols, rows, opt = {}) {
  // cols: [{key,label,num,sort:(r)=>v, render:(r)=>node, cls, first}]
  let sortKey = opt.sortKey || null, dir = opt.dir || -1;
  const tbody = h('tbody');
  const thead = h('thead');
  const table = h('table', { class: 'tbl ' + (opt.cls || '') }, opt.caption ? h('caption', null, opt.caption) : null, thead, tbody);
  const limit = opt.limit || Infinity; let shown = limit;
  const moreWrap = h('div', { class: 'more', hidden: true });
  function paintHead() {
    const tr = h('tr');
    for (const c of cols) {
      const th = h('th', { class: (c.num ? 'num ' : '') + (c.sort ? 'sortable ' : '') + (c.first ? 'first' : ''), scope: 'col', title: c.title || null }, c.label);
      if (c.sort) {
        if (sortKey === c.key) th.setAttribute('aria-sort', dir === -1 ? 'descending' : 'ascending');
        th.tabIndex = 0;
        const act = () => { if (sortKey === c.key) dir = -dir; else { sortKey = c.key; dir = c.num ? -1 : 1; } paint(); if (opt.onSort) opt.onSort(sortKey, dir); };
        th.addEventListener('click', act); th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
      }
      tr.appendChild(th);
    }
    thead.replaceChildren(tr);
  }
  function paint() {
    paintHead();
    let data = rows.slice();
    const col = cols.find(c => c.key === sortKey);
    if (col && col.sort) data.sort(by(col.sort, dir));
    tbody.replaceChildren();
    const frag2 = document.createDocumentFragment();
    data.slice(0, shown).forEach(r => {
      const tr = h('tr', { class: opt.onRow ? 'clickable' : '' });
      for (const c of cols) tr.appendChild(h('td', { class: (c.num ? 'num ' : '') + (c.cls || '') + (c.first ? ' first' : '') }, c.render ? c.render(r) : (r[c.key] ?? '')));
      if (opt.onRow) tr.addEventListener('click', e => { if (e.target.closest('a,button,input,label,select')) return; opt.onRow(r); });
      frag2.appendChild(tr);
    });
    tbody.appendChild(frag2);
    if (data.length > shown) { moreWrap.hidden = false; moreWrap.replaceChildren(h('button', { class: 'btn', type: 'button', onclick: () => { shown += limit; paint(); } }, 'Show ' + Math.min(limit, data.length - shown) + ' more of ' + fmt(data.length - shown))); }
    else moreWrap.hidden = true;
  }
  paint();
  const wrap = h('div', { class: 'stack' }, h('div', { class: 'tbl-wrap' + (opt.tall ? ' tall' : '') }, table), moreWrap);
  wrap.repaint = (newRows) => { if (newRows) rows = newRows; shown = limit; paint(); };
  return wrap;
}
function refChip(ref) {
  // N.., S..., M..., KJ.., I.., metrics:Txx, census:X
  const b = h('button', { class: 'ref', type: 'button' }, ref);
  tipOn(b, () => refTip(ref));
  b.addEventListener('click', e => { e.stopPropagation(); openRef(ref); });
  return b;
}
function refTip(ref) {
  if (SIG[ref]) { const x = SIG[ref]; return frag(h('div', { class: 'tv' }, x.value), h('div', null, x.metric), h('div', { class: 'tl2' }, x.source + ' · ' + x.grade + ' · ' + x.date)); }
  if (ITEM[ref]) { const x = ITEM[ref]; return frag(h('div', null, h('b', null, x.title)), h('div', { class: 'tl2' }, (x.eye === 'sun' ? 'Broadcast' : 'Floor') + ' · ' + x.platform + ' · ' + x.date + ' · ' + x.topic)); }
  if (KJ[ref]) return frag(h('b', null, ref + ' ' + KJ[ref].title), h('div', { class: 'tl2' }, probWord(KJ[ref])));
  if (IND[ref]) return frag(h('b', null, ref + ' ' + IND[ref].indicator), h('div', { class: 'tl2' }, 'Next: ' + IND[ref].next));
  if (ref.startsWith('metrics:')) { const t = TOPIC[ref.slice(8)]; return t ? frag(h('b', null, t.id + ' ' + t.label), h('div', { class: 'tl2' }, 'Broadcast ' + pct(t.sun_share, 1) + ' · floor ' + pct(t.moon_share, 1) + ' · z ' + t.stereo_z)) : 'Edition measurement: ' + ref.slice(8); }
  if (ref.startsWith('census:')) return 'Room census: ' + ref.slice(7);
  return ref;
}
let refHost = null;
function openRef(ref) {
  // Show a detail card in a fixed drawer at the bottom-right: works anywhere without layout jumps
  if (!refHost) { refHost = h('div', { class: 'card', role: 'dialog', 'aria-label': 'Reference', style: { position: 'fixed', right: '16px', bottom: '16px', width: 'min(420px, calc(100vw - 32px))', zIndex: '90', boxShadow: 'var(--shadow)', maxHeight: '60vh', overflow: 'auto' } }); document.body.appendChild(refHost); }
  const close = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', onclick: () => { refHost.hidden = true; } }, icon('x'));
  let body;
  if (SIG[ref]) {
    const x = SIG[ref];
    body = h('div', { class: 'stack' }, h('div', { class: 'row' }, h('b', { class: 'mono' }, ref), gradeTag(x.grade), h('span', { class: 'muted small' }, x.domain + ' · ' + x.date)),
      h('div', null, h('b', null, x.metric)), h('div', { class: 'dim' }, x.value), x.note ? h('p', { class: 'small muted' }, x.note) : null,
      h('div', { class: 'small' }, 'Source: ', ext(x.url, x.source)));
  } else if (ITEM[ref]) {
    const x = ITEM[ref];
    body = h('div', { class: 'stack' }, h('div', { class: 'row' }, h('b', { class: 'mono' }, ref), h('span', { class: 'eye ' + x.eye }, x.eye === 'sun' ? 'Broadcast' : 'Floor'), h('span', { class: 'muted small' }, x.platform + ' · ' + x.date)),
      h('div', null, h('b', null, x.title)), h('div', { class: 'small dim' }, 'Topic ' + x.topic + (TOPIC[x.topic] ? ' ' + TOPIC[x.topic].label : '') + ' · lane ' + x.lane),
      x.url ? h('div', { class: 'small' }, ext(x.url, 'Open the source')) : null);
  } else if (KJ[ref]) {
    body = kjCard(KJ[ref], true);
  } else if (IND[ref]) {
    const x = IND[ref];
    body = h('div', { class: 'stack' }, h('b', null, ref + ' ' + x.indicator), h('p', { class: 'small' }, x.watch), h('p', { class: 'small muted' }, 'Next reading: ' + x.next + ' · bears on ' + x.kj));
  } else if (ref.startsWith('metrics:') && TOPIC[ref.slice(8)]) {
    const t = TOPIC[ref.slice(8)];
    body = h('div', { class: 'stack' }, h('b', null, t.id + ' ' + t.label), h('p', { class: 'small' }, t.def),
      h('div', { class: 'small' }, 'Broadcast share ', h('b', null, pct(t.sun_share, 1)), ' (n ' + t.sun_n + ') · floor share ', h('b', null, pct(t.moon_share, 1)), ' (n ' + t.moon_n + ')'),
      h('div', { class: 'small' }, 'Stereopsis z ', h('b', null, String(t.stereo_z)), ' · ' + t.stereo_class), h('div', { class: 'row' }, stageTag(t.stage), momTag(t.momentum)), h('p', { class: 'small muted' }, t.stage_why));
  } else {
    body = h('p', { class: 'small' }, refTip(ref));
  }
  refHost.replaceChildren(h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, 'Horus reference'), close), body);
  refHost.hidden = false;
}
function kjCard(kj, compact) {
  return h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('b', { class: 'mono' }, kj.id), h('b', null, kj.title)),
    h('div', { class: 'row small' }, h('span', { class: 'pill plain warn' }, kj.likelihood), h('span', { class: 'mono small' }, kj.range), h('span', { class: 'muted' }, 'Confidence ' + kj.confidence + ' · horizon ' + kj.horizon)),
    h('p', { class: 'small' }, kj.judgment),
    compact ? null : h('div', { class: 'small' }, h('h4', null, 'Would change the call'), h('ul', null, kj.falsifiers.map(f => h('li', null, f)))),
    h('div', { class: 'small' }, h('h4', null, 'Evidence'), h('div', { class: 'refs' }, kj.evidence.map(refChip))));
}

/* Pulse and the Horus field views */

function viewPulse() {
  const n = A.length;
  const reg = Object.fromEntries(countBy(A, a => a.region));
  const st = Object.fromEntries(countBy(A, a => a.status));
  const read = A.filter(a => a.horus && a.horus.ok);
  const g = D.agg.paid, ai = D.agg.ai;
  const view = h('div', { class: 'view' });

  // hero: the edition's headline on the first screen, with coverage honesty
  view.appendChild(h('section', { class: 'hero' },
    h('div', { class: 'row between' },
      h('span', { class: 'eyebrow' }, 'Agency Radar · ' + n + ' agencies · US and Europe · compiled ' + D.meta.generated),
      h('a', { href: '#horus', class: 'btn' }, 'Open the Horus lens')),
    h('p', { class: 'quote' }, ED.headline),
    h('div', { class: 'by' },
      h('span', { class: 'pill sun plain' }, 'Horus ' + ED.title + ' · edition ' + ED.edition),
      h('span', { class: 'muted small' }, fmt(ED.n.sun_total + ED.n.moon_total) + ' coded items · ' + ED.n.rooms + ' rooms · ' + ED.signals.length + ' Nilometer signals · topic kappa ' + (ED.kappa.topic ? ED.kappa.topic.kappa : '–')),
      h('span', { class: 'muted small' }, 'Per-agency reads for ' + read.length + ' of ' + n + ' (13 lack capability scores).'))
  ));

  // the Targets wing on the first screen
  const tl = targetsList();
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Targets', tl.length ? tl.length + ' domain' + (tl.length === 1 ? '' : 's') + ' audited by the Omega. ' : 'No OmegaWeapon runs hosted yet. ', h('a', { href: '#targets' }, tl.length ? 'Open the wing' : 'Import a run or queue one')),
    tl.length ? h('div', { class: 'tiles' }, tl.slice(0, 4).map(t => { const s = t.summary; const c = h('div', { class: 'tile clickable', role: 'link', tabindex: '0', onclick: () => go('t/' + s.key) }, h('div', { class: 'lbl' }, s.domain + (s.demo ? ' · demo fixture' : '')), h('div', { class: 'val' }, gradeBox(s.overall || 'NA'), h('small', null, s.business)), h('div', { class: 'sub' }, (s.failing || []).length ? 'fails ' + s.failing.join(', ') : 'no pillar at D or F', s.agency && s.agency.name ? ' · agency: ' + s.agency.name.replace(/\s*\(footer credit\)/, '') : '')); c.addEventListener('keydown', e => { if (e.key === 'Enter') go('t/' + s.key); }); return c; })) : null));
  // stat tiles
  view.appendChild(h('div', { class: 'tiles' },
    tile('Agencies tracked', fmt(n), (reg.US || 0) + ' US · ' + (reg.Europe || 0) + ' Europe'),
    D.offshore && D.offshore.field ? tile('Median Monsoon index', String(Math.round(D.offshore.field.index_median)), (D.offshore.field.bands.Landfall || 0) + ' at Landfall · ' + pct(D.offshore.field.shore.south_asia + D.offshore.field.shore.southeast_asia) + ' Asian shore') : null,
    tile('Operating brands', fmt(st.active || 0), (st.merged || 0) + ' merged · ' + (st['acquired-rebranded'] || 0) + ' acquired · ' + (st.uncertain || 0) + ' uncertain'),
    tile('Run their own Google ads', fmt(g.google_active), 'Transparency Center lookups blocked for ' + A.filter(a => a.google && a.google.status === 'blocked').length),
    tile('Run their own LinkedIn ads', fmt(g.li_active), g.li_thought_leader + ' run thought-leader ads'),
    tile('Publish llms.txt', fmt(ai.has_llms_txt), 'while ' + ai.ai_search_invest + ' sell AI search'),
    tile('Median Horus tailwind', signed(FIELD.hti_median), 'on a −100 to +100 scale; ' + (FIELD.bands.Tailwind || 0) + ' agencies in Tailwind')
  ));

  // strategy landscape
  const regionSel = { v: 'All' };
  const landHost = h('div');
  function paintLand() {
    const pool = regionSel.v === 'All' ? A : A.filter(a => a.region === regionSel.v);
    const rows = DIM_KEYS.map(k => {
      const inv = pool.filter(a => (strat(a, k) || 0) >= 2).length;
      const heavy = pool.filter(a => strat(a, k) === 3).length;
      return { k, inv, heavy, n: pool.length };
    }).sort((x, y) => y.inv - x.inv || y.heavy - x.heavy);
    const list = h('div', { class: 'bars' });
    for (const r of rows) {
      const bar = stackBar([
        { value: r.heavy, cls: 'heavy', label: 'Leads with it (score 3)', extra: r.heavy + ' of ' + r.n + ' agencies' },
        { value: r.inv - r.heavy, cls: 'some', label: 'Invests (score 2)', extra: (r.inv - r.heavy) + ' of ' + r.n + ' agencies' }
      ], { total: r.n });
      list.appendChild(h('div', { class: 'bar-row' },
        h('button', { class: 'lbl', type: 'button', onclick: () => { matrixState.sort = r.k; go('matrix'); } }, capName(r.k)),
        bar, h('span', { class: 'v' }, pct(r.inv / r.n) + ' · ' + pct(r.heavy / r.n))));
    }
    landHost.replaceChildren(list);
  }
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Region' });
  for (const v of ['All', 'US', 'Europe']) {
    const b = h('button', { type: 'button', 'aria-pressed': String(v === 'All') }, v);
    b.addEventListener('click', () => { regionSel.v = v; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paintLand(); });
    seg.appendChild(b);
  }
  paintLand();
  view.appendChild(h('section', { class: 'sec' },
    sectionHead('What the field sells', 'Share of all agencies that invest in each capability (score 2 or 3) and the share that lead with it (score 3). Scores are evidence-graded from agency sites, case studies and ad libraries. Click a capability to open the matrix sorted by it.'),
    h('div', { class: 'card stack' }, h('div', { class: 'row between' }, h('div', { class: 'legend' }, h('span', { class: 'key' }, h('i', { class: 'heavy' }), 'Leads with it (3)'), h('span', { class: 'key' }, h('i', { class: 'some' }), 'Invests (2)'), h('span', { class: 'muted' }, 'value: invests · leads')), seg), landHost)));

  // archetypes, segments
  view.appendChild(h('section', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Archetypes'), h('span', { class: 'muted small' }, 'dominant capability family')),
      barList(D.agg.archetypes.map(x => ({ label: x.name, value: x.n, onClick: () => { agencyState.archetype = x.name === 'Unclassified' ? '__none' : x.name; go('agencies'); } })), { cls: 'ink' })),
    h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Segments'), h('span', { class: 'muted small' }, 'how each agency positions itself')),
      barList(D.agg.segments.slice(0, 10).map(x => ({ label: x.name, value: x.n, onClick: () => { agencyState.segment = x.name; go('agencies'); } })), { cls: 'ink' }),
      D.agg.segments.length > 10 ? h('p', { class: 'note' }, D.agg.segments.length - 10 + ' smaller segments: ' + D.agg.segments.slice(10).map(x => x.name + ' ' + x.n).join(', ') + '.') : null)));

  // Horus snapshot + say/do
  const bandsRow = barList(BANDS.map(b => ({ label: b, value: FIELD.bands[b] || 0, cls: b === 'Tailwind' || b === 'Favored' ? 'pos' : b === 'Neutral' ? 'ink' : 'neg', onClick: () => { agencyState.band = b; go('agencies'); } })));
  const fitRow = barList(SCEN_IDS.map(sid => ({ label: sid + ' ' + SCEN[sid].name, value: FIELD.best_fit[sid] || 0, display: fmt(FIELD.best_fit[sid] || 0) + ' · p ' + SCEN[sid].probability + '%', onClick: () => { agencyState.scen = sid; go('agencies'); } })), { cls: 'sun' });
  const hs = FIELD.house;
  view.appendChild(h('section', { class: 'grid-2' },
    h('div', { class: 'card stack' },
      h('div', { class: 'card-h' }, h('h3', null, 'The field through the Horus lens'), h('a', { href: '#horus', class: 'small' }, 'Full lens')),
      h('h4', null, 'Tailwind band (probability-weighted exposure to the edition’s key judgments)'), bandsRow,
      h('h4', null, 'Best-fit scenario (count of agencies)'), fitRow,
      h('h4', null, 'Where the sold mix sits on the Solar Arc (field mean)'), stageStack(FIELD.stage_mean, { tall: true }), stageLegend()),
    h('div', { class: 'card stack' },
      h('div', { class: 'card-h' }, h('h3', null, 'Say and do'), h('a', { href: '#gaps', class: 'small' }, 'All gaps')),
      h('p', { class: 'small dim' }, 'For each line an agency sells, does its own house practise it? ' + fmt(hs.tests) + ' tests across ' + hs.tested_agencies + ' agencies: ' + fmt(hs.corroborated) + ' practised, ' + fmt(hs.contradicted) + ' contradicted.'),
      stackBar([{ value: hs.corroborated, cls: 'cor', label: 'Practised on its own house' }, { value: hs.contradicted, cls: 'con', label: 'Contradicted by its own house' }], { tall: true }),
      h('div', { class: 'legend' }, h('span', { class: 'key' }, h('i', { class: 'pos' }), 'Practised'), h('span', { class: 'key' }, h('i', { class: 'neg' }), 'Contradicted'), h('span', { class: 'muted' }, 'value: contradicted of tested')),
      h('div', { class: 'bars' }, Object.entries(hs.by_cap).sort((x, y) => (y[1].contradicted) - (x[1].contradicted)).map(([cap, v]) => {
        const tot = v.corroborated + v.contradicted;
        return h('div', { class: 'bar-row' }, h('span', { class: 'lbl' }, capName(cap)),
          stackBar([{ value: v.corroborated, cls: 'cor', label: 'Practised' }, { value: v.contradicted, cls: 'con', label: 'Contradicted' }], { total: Math.max(1, tot) }),
          h('span', { class: 'v' }, v.contradicted + ' of ' + tot));
      })),
      (() => {
        const phrase = { cro: 'run no testing tool on their own homepage', ai_search: 'publish no llms.txt or block AI crawlers on their own domain', paid_social: 'run no social ad pixel on their own site', paid_search: 'run no Google ads of their own', linkedin: 'run no LinkedIn ads of their own', content: 'have left their own blog untouched for 12 months', creator_influencer: 'link no short-form channel of their own' };
        const rows = Object.entries(hs.by_cap).map(([k, v]) => ({ k, v, n: v.corroborated + v.contradicted, r: v.contradicted / Math.max(1, v.corroborated + v.contradicted) })).filter(x => x.n >= 10).sort((x, y) => y.r - x.r);
        const say = x => (x.r === 1 ? 'All ' + x.n + ' agencies' : x.v.contradicted + ' of the ' + x.n + ' agencies') + ' tested on ' + capName(x.k) + ' ' + (phrase[x.k] || 'contradict the pitch on their own house') + '.';
        return h('div', { class: 'callout' }, h('b', null, 'Read: '), rows.slice(0, 2).map(say).join(' '));
      })())));

  // prominence + velocity
  view.appendChild(h('section', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Most prominent'), h('span', { class: 'muted small' }, 'prominence index 0 to 1')),
      barList(D.agg.prominence_top.slice(0, 12).map(x => ({ label: x.name, value: x.score, display: x.score.toFixed(2), onClick: () => go('a.' + x.id) })), { max: 1, cls: 'ink' })),
    h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Fastest publishers'), h('span', { class: 'muted small' }, 'sitemap URLs updated in 90 days')),
      barList(D.agg.content_velocity.slice(0, 12).map(x => ({ label: x.name, value: x.c90, onClick: () => go('a.' + x.id + '.content') })), { cls: 'ink' }))));

  // recent moves
  const moves = [];
  for (const a of A) for (const m of (a.moves || [])) moves.push({ a, m });
  moves.sort((x, y) => dateKey(y.m.date).localeCompare(dateKey(x.m.date)));
  view.appendChild(h('section', { class: 'sec' },
    sectionHead('Latest moves', 'Launches, hires, deals, rebrands and awards across all 222, newest first (' + fmt(moves.length) + ' recorded).'),
    h('div', { class: 'card' }, h('div', { class: 'timeline' }, moves.slice(0, 24).map(({ a, m }) =>
      h('div', { class: 'tl' }, h('span', { class: 'd' }, m.date || '–'), h('span', { class: 'ty' }, h('span', { class: 'chip' }, m.type || 'other')),
        h('div', null, agencyLink(a, a.name, 'moves'), ' · ', m.note || '', ' ', m.url ? ext(m.url, 'source') : null)))))));
  return view;
}
function tile(label, value, sub) { return h('div', { class: 'tile' }, h('div', { class: 'lbl' }, label), h('div', { class: 'val' }, value), sub ? h('div', { class: 'sub' }, sub) : null); }

/* ============================ HORUS FIELD VIEW ============================ */
const fieldState = { y: 'integrity', region: 'All', arche: '', watch: false, table: false };

function viewHorus(anchor) {
  const view = h('div', { class: 'view' });
  const covCls = st => /blocked|blind/.test(st) ? 'bad' : /not sampled/.test(st) ? 'off' : /census|reported/.test(st) ? 'warn' : 'ok';
  const cov = ED.channels.map(c => h('span', { class: 'pill ' + covCls(c.status || '') }, (c.name || '') + ': ' + c.status));
  view.appendChild(h('section', { class: 'hero' },
    h('div', { class: 'row', style: { gap: '14px' } }, wedjat('wedjat'),
      h('div', null, h('div', { class: 'eyebrow' }, 'Horus · ' + ED.title + ' · edition ' + ED.edition + ' · run ' + ED.run_date),
        h('h1', null, 'The field through the falcon’s eyes'))),
    h('p', { class: 'quote' }, ED.headline),
    h('details', { class: 'fold' }, h('summary', null, 'Bottom line up front'), h('div', { class: 'fold-body prose' }, ED.bluf.map(p => h('p', null, p)))),
    h('div', { class: 'coverage' }, h('span', { class: 'eyebrow' }, 'Coverage'), cov),
    h('p', { class: 'small muted' }, 'Each agency is read against the edition’s judgments through a published crosswalk and exposure tables (see Method). The edition measures discourse; the per-agency read is derived. Derived is not measured.')));

  view.appendChild(fieldMapSection());
  view.appendChild(kjSection());
  view.appendChild(arcSection());
  view.appendChild(threeEyesSection());
  view.appendChild(scenarioSection());
  view.appendChild(movesSection());
  view.appendChild(railsSection());
  view.appendChild(indicatorSection());
  view.appendChild(nilometerSection());
  view.appendChild(graveSection());
  if (anchor) setTimeout(() => { const el = document.getElementById('h-' + anchor); if (el) el.scrollIntoView({ block: 'start' }); }, 30);
  return view;
}

function yMetric(a, key) {
  const hz = a.horus;
  if (key === 'integrity') return hz.house && hz.house.tested ? hz.house.integrity : null;
  if (key === 'arc') return hz.arc_hour;
  if (key === 'resilience') return hz.resilience;
  if (key === 'prominence') return a.prominence;
  if (key === 'moves') return hz.moves_score && hz.moves_score.applicable ? 100 * (hz.moves_score.making + 0.5 * hz.moves_score.partial) / hz.moves_score.applicable : null;
  return null;
}
const Y_OPTS = {
  integrity: { label: 'Say/do: share of sold lines practised on its own house (%)', dom: [0, 100], fmt: v => Math.round(v) + '%', q: ['Positioned and practising', 'Practising, but exposed', 'Exposed and not practising', 'Positioned, not practising'] },
  arc: { label: 'Solar Arc clock of the sold mix (earlier at top)', dom: [20, 12], fmt: v => hourStr(v), q: ['Early and favored', 'Early but exposed', 'Late and exposed', 'Late but favored'] },
  resilience: { label: 'Scenario resilience (probability-weighted fit, 0 to 100)', dom: [0, 70], fmt: v => Math.round(v), q: ['Favored and resilient', 'Resilient, but exposed', 'Exposed and brittle', 'Favored but brittle'] },
  moves: { label: 'Horus moves made (share of applicable P1 to P8, partial = half)', dom: [0, 100], fmt: v => Math.round(v) + '%', q: ['Favored and moving', 'Moving, but exposed', 'Exposed and standing still', 'Favored, standing still'] },
  prominence: { label: 'Prominence index (0 to 1)', dom: [0, 1], fmt: v => v.toFixed(2), q: ['Favored and prominent', 'Prominent, but exposed', 'Exposed and obscure', 'Favored and obscure'] }
};

function fieldMapSection() {
  const sec = h('section', { class: 'sec', id: 'h-map' });
  const host = h('div', { class: 'stack' });
  const ySel = h('select', { id: 'fm-y', 'aria-label': 'Vertical axis' }, Object.entries(Y_OPTS).map(([k, v]) => h('option', { value: k }, v.label.split(' (')[0])));
  ySel.value = fieldState.y;
  const rSel = h('select', { id: 'fm-region', 'aria-label': 'Region' }, ['All', 'US', 'Europe'].map(v => h('option', { value: v }, v === 'All' ? 'All regions' : v)));
  rSel.value = fieldState.region;
  const arches = countBy(A, a => a.archetype).map(x => x[0]);
  const aSel = h('select', { id: 'fm-arche', 'aria-label': 'Archetype' }, h('option', { value: '' }, 'All archetypes'), arches.map(v => h('option', { value: v }, v)));
  aSel.value = fieldState.arche;
  const wChk = h('input', { type: 'checkbox', id: 'fm-watch' }); wChk.checked = fieldState.watch;
  const tChk = h('input', { type: 'checkbox', id: 'fm-table' }); tChk.checked = fieldState.table;
  const paint = () => {
    fieldState.y = ySel.value; fieldState.region = rSel.value; fieldState.arche = aSel.value; fieldState.watch = wChk.checked; fieldState.table = tChk.checked;
    host.replaceChildren(fieldMap());
  };
  [ySel, rSel, aSel, wChk, tChk].forEach(el => el.addEventListener('change', paint));
  sec.append(sectionHead('The field map', 'Across: the Horus Tailwind Index (the probability-weighted net of the eleven key judgments on each agency’s sold mix, scaled so a pure AI-search or pure measurement shop scores +100). Up: pick the second read. Circles are US agencies, diamonds European. Hairlines mark the field medians.'),
    h('div', { class: 'filters' },
      h('div', { class: 'field grow' }, h('label', { for: 'fm-y' }, 'Vertical axis'), ySel),
      h('div', { class: 'field fx' }, h('label', { for: 'fm-region' }, 'Region'), rSel),
      h('div', { class: 'field fx' }, h('label', { for: 'fm-arche' }, 'Archetype'), aSel),
      h('label', { class: 'check', for: 'fm-watch' }, wChk, 'Highlight my watchlist'),
      h('label', { class: 'check', for: 'fm-table' }, tChk, 'Show as table')),
    host);
  paint();
  return sec;
}

function fieldMap() {
  const key = fieldState.y, Y = Y_OPTS[key];
  const jit = id => { let hsh = 0; for (const ch of id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; return ((hsh % 1000) / 1000 - 0.5); };
  const discrete = key === 'integrity' || key === 'moves';
  const pts = A.filter(a => a.horus && a.horus.ok).map(a => ({ a, x: a.horus.hti, y: yMetric(a, key) })).filter(p => p.y != null)
    .map(p => ({ ...p, yj: discrete ? clamp(p.y + jit(p.a.id) * 6, 0, 100) : p.y }));
  const inScope = p => (fieldState.region === 'All' || p.a.region === fieldState.region) && (!fieldState.arche || p.a.archetype === fieldState.arche);
  const shown = pts.filter(inScope);
  if (fieldState.table) {
    const cols = [
      { key: 'name', label: 'Agency', sort: r => r.a.name.toLowerCase(), render: r => agencyLink(r.a), first: true },
      { key: 'region', label: 'Region', sort: r => r.a.region, render: r => r.a.region },
      { key: 'arch', label: 'Archetype', sort: r => r.a.archetype || '', render: r => r.a.archetype || '–' },
      { key: 'x', label: 'Tailwind', num: true, sort: r => r.x, render: r => signed(r.x) },
      { key: 'y', label: Y.label.split(' (')[0], num: true, sort: r => (key === 'arc' ? -r.y : r.y), render: r => Y.fmt(r.y) },
      { key: 'band', label: 'Band', sort: r => BANDS.indexOf(r.a.horus.band), render: r => bandTag(r.a.horus) }
    ];
    return sortableTable(cols, shown, { sortKey: 'x', dir: -1, limit: 60, onRow: r => go('a.' + r.a.id + '.horus') });
  }
  const W = 920, H = 560, m = { l: 56, r: 22, t: 16, b: 48 };
  const xs = pts.map(p => p.x);
  const xmin = Math.floor(Math.min(-40, ...xs) / 10) * 10, xmax = Math.ceil(Math.max(40, ...xs) / 10) * 10;
  // y ticks inside the data range; the domain is padded so the quadrant labels sit in bands free of points
  let ticks;
  if (key === 'integrity' || key === 'moves') ticks = [0, 20, 40, 60, 80, 100];
  else if (key === 'prominence') ticks = [0, 0.2, 0.4, 0.6, 0.8, 1];
  else if (key === 'arc') { const lo = Math.floor(Math.min(...pts.map(p => p.y)) / 2) * 2, hi = Math.ceil(Math.max(...pts.map(p => p.y)) / 2) * 2; ticks = []; for (let t = lo; t <= hi; t += 2) ticks.push(t); }
  else { const lo = Math.floor(Math.min(...pts.map(p => p.y)) / 10) * 10, hi = Math.ceil(Math.max(...pts.map(p => p.y)) / 10) * 10; ticks = []; for (let t = lo; t <= hi; t += 10) ticks.push(t); }
  const tlo = Math.min(...ticks), thi = Math.max(...ticks), pad = (thi - tlo) * 0.09;
  const [y0, y1] = key === 'arc' ? [thi + pad, tlo - pad] : [tlo - pad, thi + pad];
  const X = v => m.l + (v - xmin) / (xmax - xmin) * (W - m.l - m.r);
  const Yp = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const topBand = (m.t + Yp(key === 'arc' ? tlo : thi)) / 2 + 4, botBand = (H - m.b + Yp(key === 'arc' ? thi : tlo)) / 2 + 4;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Field map: tailwind index across, ' + Y.label + ' up' });
  const grid = s('g', { class: 'grid' });
  for (let v = xmin; v <= xmax; v += 20) { grid.appendChild(s('line', { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b })); svg.appendChild(s('text', { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle' }, signed(v))); }
  for (const v of ticks) { grid.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: Yp(v), y2: Yp(v) })); svg.appendChild(s('text', { x: m.l - 8, y: Yp(v) + 3.5, 'text-anchor': 'end' }, Y.fmt(v))); }
  svg.insertBefore(grid, svg.firstChild);
  svg.appendChild(s('line', { class: 'zero', x1: X(0), x2: X(0), y1: m.t, y2: H - m.b }));
  const mx = median(pts.map(p => p.x)), my = median(pts.map(p => p.y));
  svg.appendChild(s('line', { x1: X(mx), x2: X(mx), y1: m.t, y2: H - m.b, stroke: 'var(--ink-3)', 'stroke-width': '1', opacity: '.55' }));
  svg.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: Yp(my), y2: Yp(my), stroke: 'var(--ink-3)', 'stroke-width': '1', opacity: '.55' }));
  svg.appendChild(s('text', { x: X(mx) + 6, y: topBand }, 'field median ' + signed(mx)));
  svg.appendChild(s('text', { x: m.l + 4, y: Yp(my) - 5 }, 'median ' + Y.fmt(my)));
  const q = s('g', { class: 'quad' });
  q.appendChild(s('text', { x: W - m.r - 4, y: topBand, 'text-anchor': 'end' }, Y.q[0]));
  q.appendChild(s('text', { x: m.l + 6, y: topBand }, Y.q[1]));
  q.appendChild(s('text', { x: m.l + 6, y: botBand }, Y.q[2]));
  q.appendChild(s('text', { x: W - m.r - 4, y: botBand, 'text-anchor': 'end' }, Y.q[3]));
  svg.appendChild(q);
  svg.appendChild(s('text', { x: (m.l + W - m.r) / 2, y: H - 8, 'text-anchor': 'middle' }, 'Horus Tailwind Index  (headwind ← → tailwind)'));
  const gP = s('g');
  const watch = new Set(store.data.watch);
  const order = pts.slice().sort((p1, p2) => (inScope(p1) - inScope(p2)) || (watch.has(p1.a.id) - watch.has(p2.a.id)));
  for (const p of order) {
    const cx = X(p.x), cy = Yp(p.yj);
    const cls = 'pt' + (!inScope(p) ? ' dim' : '') + (fieldState.watch && watch.has(p.a.id) ? ' hi' : '');
    const mark = p.a.region === 'Europe'
      ? s('rect', { class: cls, x: cx - 4.6, y: cy - 4.6, width: 9.2, height: 9.2, transform: `rotate(45 ${cx} ${cy})` })
      : s('circle', { class: cls, cx, cy, r: 5 });
    const hit = s('circle', { class: 'hit', cx, cy, r: 11, tabindex: inScope(p) ? '0' : '-1', role: 'link', 'aria-label': p.a.name + ', tailwind ' + signed(p.x) + ', ' + Y.fmt(p.y) });
    const tip = () => frag(h('div', null, h('b', null, p.a.name)), h('div', { class: 'tv' }, signed(p.x) + ' tailwind · ' + Y.fmt(p.y)), h('div', { class: 'tl2' }, (p.a.archetype || 'Unclassified') + ' · ' + p.a.region + ' · ' + p.a.horus.band));
    tipOn(hit, tip);
    hit.addEventListener('click', () => go('a.' + p.a.id + '.horus'));
    hit.addEventListener('keydown', e => { if (e.key === 'Enter') go('a.' + p.a.id + '.horus'); });
    gP.append(mark, hit);
  }
  svg.appendChild(gP);
  // label the two extremes each way in scope
  const lab = shown.slice().sort((p1, p2) => p2.x - p1.x);
  for (const p of [...lab.slice(0, 2), ...lab.slice(-2)]) {
    const cx = X(p.x), cy = Yp(p.yj), right = cx > W - 160, nearTop = cy < m.t + 70;
    svg.appendChild(s('text', { class: 'lab', x: right ? cx - 9 : cx + 9, y: nearTop ? cy + 17 : cy - 7, 'text-anchor': right ? 'end' : 'start' }, p.a.name));
  }
  const nNo = A.filter(a => a.horus && a.horus.ok).length - pts.length;
  return h('div', { class: 'card stack' },
    h('div', { class: 'legend' }, h('span', { class: 'key' }, h('i', { class: 'dot', style: { background: 'var(--ink-2)' } }), 'US'), h('span', { class: 'key' }, h('i', { style: { background: 'var(--ink-2)', transform: 'rotate(45deg)', width: '8px', height: '8px' } }), 'Europe'),
      fieldState.watch ? h('span', { class: 'key' }, h('i', { class: 'dot', style: { background: 'var(--sun-bar)' } }), 'Watchlist') : null,
      h('span', { class: 'muted' }, shown.length + ' in scope of ' + pts.length + ' plotted' + (nNo > 0 ? '; ' + nNo + ' have no value on this axis' : '') + (discrete ? '; points nudged up to ±3 points vertically so ties stay visible' : ''))),
    h('div', { class: 'chart' }, svg));
}

function kjSection() {
  const sec = h('section', { class: 'sec', id: 'h-kj' });
  const read = A.filter(a => a.horus && a.horus.ok);
  const rows = h('div', { class: 'card' });
  const maxN = read.length;
  for (const id of KJ_IDS) {
    const kj = KJ[id];
    const pos = FIELD.kj_pos[id] || 0, neg = FIELD.kj_neg[id] || 0;
    const dv = h('div', { class: 'div', role: 'img', 'aria-label': pos + ' agencies with tailwind, ' + neg + ' with headwind' });
    const bp = h('span', { class: 'pos' }); bp.style.width = (50 * pos / maxN) + '%';
    const bn = h('span', { class: 'neg' }); bn.style.width = (50 * neg / maxN) + '%';
    dv.append(bp, bn);
    tipOn(dv, () => tipBody(pos + ' tailwind · ' + neg + ' headwind', 'of ' + maxN + ' agencies read', 'mean net ' + (FIELD.kj_mean[id] >= 0 ? '+' : '') + FIELD.kj_mean[id]));
    const detail = h('div', { class: 'kjdetail', hidden: true });
    const btn = h('button', { class: 'x', type: 'button', 'aria-expanded': 'false' }, h('span', { class: 'tt' }, kj.title), h('small', null, probWord(kj) + ' · confidence ' + kj.confidence + ' · ' + kj.horizon));
    btn.addEventListener('click', () => {
      const open = detail.hidden; detail.hidden = !open; btn.setAttribute('aria-expanded', String(open));
      if (open && !detail.childNodes.length) {
        const top = read.slice().sort((x, y) => y.horus.kj[id].net - x.horus.kj[id].net);
        const exp = MODEL.kj_e[id] || {};
        detail.append(
          h('p', null, kj.judgment),
          Object.keys(exp).length ? h('div', null, h('h4', null, 'How it lands on capabilities (this build’s exposure table)'),
            h('div', { class: 'chips' }, Object.entries(exp).map(([cap, v]) => h('span', { class: 'chip', title: v.why }, (v.e > 0 ? '+' : '−') + Math.abs(v.e) + ' ' + capName(cap))))) : h('p', { class: 'muted' }, 'No capability exposure: the judgment says regulation shapes the edges without changing the direction.'),
          Object.keys(exp).length ? h('div', { class: 'grid-2' },
            h('div', null, h('h4', null, 'Most helped'), h('ol', null, top.slice(0, 5).filter(a => a.horus.kj[id].net > 0).map(a => h('li', null, agencyLink(a, null, 'horus'), ' ', h('span', { class: 'mono small muted' }, '+' + a.horus.kj[id].net.toFixed(2)))))),
            h('div', null, h('h4', null, 'Most exposed'), h('ol', null, top.slice(-5).reverse().filter(a => a.horus.kj[id].net < 0).map(a => h('li', null, agencyLink(a, null, 'horus'), ' ', h('span', { class: 'mono small muted' }, a.horus.kj[id].net.toFixed(2))))))) : null,
          h('div', null, h('h4', null, 'Would change the call'), h('ul', null, kj.falsifiers.map(f => h('li', null, f)))),
          h('div', null, h('h4', null, 'Evidence'), h('div', { class: 'refs' }, kj.evidence.map(refChip))));
      }
    });
    rows.appendChild(h('div', { class: 'kjrow' }, h('span', { class: 'id' }, id), h('div', { class: 't' }, btn), h('div', { class: 'dv' }, dv), h('span', { class: 'n' }, pos + ' / ' + neg), detail));
  }
  sec.append(sectionHead('Key judgments across the field', 'Each bar splits the 209 agencies read into those the judgment favors (right) and those it exposes (left). Open a judgment for its text, falsifiers, evidence and the agencies most affected.'),
    h('div', { class: 'legend' }, h('span', { class: 'key' }, h('i', { class: 'pos' }), 'Tailwind'), h('span', { class: 'key' }, h('i', { class: 'neg' }), 'Headwind'), h('span', { class: 'muted' }, 'count: tailwind / headwind')), rows);
  return sec;
}

function arcSection() {
  const sec = h('section', { class: 'sec', id: 'h-arc' });
  const cols = h('div', { class: 'grid-4' });
  for (const st of STAGES) {
    const ts = ED.topics.filter(t => t.stage === st);
    cols.appendChild(h('div', { class: 'card stack' },
      h('div', { class: 'card-h' }, stageTag(st), h('span', { class: 'muted small' }, ts.length + ' topics')),
      h('div', { class: 'stack' }, ts.map(t => {
        const b = h('button', { class: 'tchip', type: 'button' }, h('span', { class: 'tl-l' }, t.id + ' ' + t.short), momTag(t.momentum));
        tipOn(b, () => frag(h('b', null, t.label), h('div', { class: 'tl2' }, t.stage_why), h('div', { class: 'tl2' }, 'Broadcast ' + pct(t.sun_share, 1) + ' · floor ' + pct(t.moon_share, 1) + ' · ' + t.stereo_class)));
        b.addEventListener('click', () => openRef('metrics:' + t.id));
        return b;
      }))));
  }
  const read = A.filter(a => a.horus && a.horus.ok);
  const dawn = read.slice().sort((x, y) => (y.horus.stage_mix.Khepri + y.horus.stage_mix.Ra) - (x.horus.stage_mix.Khepri + x.horus.stage_mix.Ra)).slice(0, 8);
  const night = read.slice().sort((x, y) => y.horus.stage_mix.Duat - x.horus.stage_mix.Duat).slice(0, 8);
  const lb = (list, f) => h('div', { class: 'bars' }, list.map(a => h('div', { class: 'bar-row' }, h('button', { class: 'lbl', type: 'button', onclick: () => go('a.' + a.id + '.horus') }, a.name), stageStack(a.horus.stage_mix), h('span', { class: 'v' }, f(a)))));
  sec.append(sectionHead('The Solar Arc', 'The edition’s stage of record for each topic, dawn to night, with the Nilometer’s direction (▲ rising, ▬ flat, ▼ falling). Each agency’s sold mix is spread across these stages through the crosswalk, which gives it a clock time on the arc.'),
    stageLegend(), cols,
    h('div', { class: 'grid-2' },
      h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Selling dawn and noon'), h('span', { class: 'muted small' }, 'Khepri + Ra share')), lb(dawn, a => pct(a.horus.stage_mix.Khepri + a.horus.stage_mix.Ra))),
      h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Working the night'), h('span', { class: 'muted small' }, 'Duat share')), lb(night, a => pct(a.horus.stage_mix.Duat)))));
  return sec;
}

function threeEyesSection() {
  const sec = h('section', { class: 'sec', id: 'h-eyes' });
  const V = FIELD.voice;
  const rows = V.topics.slice().filter(t => t.voice_n + t.sun_n + t.moon_n > 0).sort((x, y) => y.voice_share - x.voice_share);
  const max = Math.max(...rows.map(t => Math.max(t.voice_share, t.sun_share, t.moon_share)));
  const top = Math.ceil(max * 10) / 10;
  const grid = h('div', { class: 'dots' });
  for (const t of rows) {
    const lane = h('div', { class: 'lane', role: 'img', 'aria-label': `${t.id}: agencies ${pct(t.voice_share, 1)}, broadcast ${pct(t.sun_share, 1)}, floor ${pct(t.moon_share, 1)}` });
    for (const [cls, v] of [['sun', t.sun_share], ['moon', t.moon_share], ['agency', t.voice_share]]) { const i = h('i', { class: cls }); i.style.left = (100 * v / top) + '%'; lane.appendChild(i); }
    tipOn(lane, () => frag(h('b', null, t.id + ' ' + (TOPIC[t.id] ? TOPIC[t.id].label : '')),
      h('div', null, 'Agency voice ' + pct(t.voice_share, 1) + ' (' + t.voice_n + ' lines)'), h('div', null, 'Broadcast ' + pct(t.sun_share, 1) + ' (' + t.sun_n + ') · floor ' + pct(t.moon_share, 1) + ' (' + t.moon_n + ')'),
      h('div', { class: 'tl2' }, 'Agencies vs broadcast z ' + t.z_vs_sun + ' · vs floor z ' + t.z_vs_moon)));
    const zc = t.z_vs_sun >= 1.96 ? 'agencies lead' : t.z_vs_sun <= -1.96 ? 'press leads' : '';
    grid.append(h('span', { class: 'lbl', title: TOPIC[t.id] ? TOPIC[t.id].label : t.id }, t.id + ' ' + (TOPIC[t.id] ? TOPIC[t.id].short : '')), lane, h('span', { class: 'v' }, 'z ' + (t.z_vs_sun > 0 ? '+' : '') + t.z_vs_sun.toFixed(1) + (zc ? ' · ' + zc : '')));
  }
  const tv = V.topics.find(t => t.id === 'T02');
  sec.append(sectionHead('Three eyes: press, floor and the agencies themselves', 'The edition reads two eyes, the broadcast (trade press, platform voices) and the practitioner floor. This view adds a third: what the 222 agencies say about themselves in positioning, ads, moves, news and case studies, keyword-coded with the Horus prefilter. z compares agency voice with the broadcast (±1.96 is unlikely to be noise).'),
    h('div', { class: 'card stack' },
      h('div', { class: 'legend' }, h('span', { class: 'key' }, h('i', { class: 'dot sun' }), 'Broadcast (Sun eye, hand-coded)'), h('span', { class: 'key' }, h('i', { class: 'dot moon' }), 'Floor (Moon eye, hand-coded)'), h('span', { class: 'key' }, h('i', { class: 'agency', style: { transform: 'rotate(45deg)', width: '8px', height: '8px' } }), 'Agencies (keyword-coded)'), h('span', { class: 'muted' }, 'share of coded items, axis 0 to ' + pct(top))),
      grid,
      h('p', { class: 'small dim' }, fmt(V.n_voice) + ' agency lines from ' + V.agencies_with_voice + ' agencies; ' + V.n_sun + ' broadcast and ' + V.n_moon + ' floor items. Strategy, budgets, agency economics and off-taxonomy items are left out of all three eyes here, because their keyword lists (brand, strategy, client, agency) match nearly every line of agency self-description.'),
      tv ? h('div', { class: 'callout sun' }, h('b', null, 'Read: '), 'GEO and AI visibility is ' + pct(tv.voice_share) + ' of what agencies say about themselves, against ' + pct(tv.sun_share, 1) + ' of the trade press and ' + pct(tv.moon_share) + ' of the practitioner floor (z ' + tv.z_vs_sun + ' against the press). The agencies are louder on AI visibility than the broadcast that hypes it, while the floor has not operationalised it: the edition stages it at Ra, loud and contested.') : null));
  return sec;
}

function scenarioSection() {
  const sec = h('section', { class: 'sec', id: 'h-scen' });
  const axes = ED.scenarios.axes;
  const read = A.filter(a => a.horus && a.horus.ok);
  const card = sid => {
    const sc = SCEN[sid];
    const best = read.filter(a => a.horus.scen_best === sid).sort((x, y) => y.horus.scen_fit[sid] - x.horus.scen_fit[sid]);
    return h('div', { class: 'scen' },
      h('div', { class: 'row between' }, h('b', null, sid + ' ' + sc.name), h('span', { class: 'p' }, sc.probability + '%', h('small', null, 'probability'))),
      h('div', { class: 'muted small' }, sc.x + ' discovery · ' + sc.y + ' open-web value'),
      h('p', { class: 'small' }, sc.narrative),
      h('div', { class: 'small' }, h('h4', null, 'Signposts'), h('ul', null, sc.signposts.map(x => h('li', null, x)))),
      h('div', { class: 'small' }, h('h4', null, 'Best fit here: ' + best.length + ' agencies'), h('div', { class: 'chips' }, best.slice(0, 6).map(a => h('a', { href: '#a.' + a.id + '.horus', class: 'chip' }, a.name + ' ' + Math.round(a.horus.scen_fit[sid])))),
        best.length > 6 ? h('button', { class: 'ref', type: 'button', onclick: () => { agencyState.scen = sid; go('agencies'); } }, 'All ' + best.length) : null),
      h('p', { class: 'note' }, 'Who wins here: ' + MODEL.scen_why[sid]));
  };
  // Restored on top: S3 (Concentrated, Restored), S4 (Fragmented, Restored); Eroded below: S1, S2
  sec.append(sectionHead('Scenarios', 'The edition’s square: ' + axes.x.label + ' across, ' + axes.y.label + ' up. Probabilities are the analyst’s. Fit scores are this build’s: how much of each agency’s sold mix thrives in each quadrant.'),
    h('div', { class: 'scen-square' },
      h('span'), h('span', { class: 'xlab' }, axes.x.low + ' ← ' + axes.x.label + ' → ' + axes.x.high),
      h('span', { class: 'ylab' }, axes.y.low + ' ← ' + axes.y.label + ' → ' + axes.y.high),
      card('S3'), card('S4'), card('S1'), card('S2')),
    h('p', { class: 'note' }, ED.scenarios.note));
  return sec;
}

function movesSection() {
  const sec = h('section', { class: 'sec', id: 'h-moves' });
  const rows = h('div', { class: 'bars' });
  const clsOf = { making: 'mk', partial: 'pt', absent: 'ab', unknown: 'un', na: 'na' };
  for (const pid of IMPL_IDS) {
    const m = FIELD.moves[pid]; const p = IMPL[pid];
    const bar = stackBar(MOVE_STATUS.map(st => ({ value: m[st] || 0, cls: clsOf[st], label: MOVE_LABEL[st], extra: p.move, onClick: () => { agencyState.move = pid + ':' + st; go('agencies'); } })), { total: A.filter(a => a.horus && a.horus.ok).length });
    rows.appendChild(h('div', { class: 'bar-row' }, h('span', { class: 'lbl', title: p.detail }, pid + ' ' + p.move), bar, h('span', { class: 'v' }, (m.making || 0) + ' making')));
  }
  sec.append(sectionHead('The moves: who is already making them', 'The edition’s eight moves for operators (P1 to P8), detected on each agency’s own record from service lines, products, ad copy, pricing and moves. Every detection carries its quoted evidence on the agency page. Click a segment to list those agencies.'),
    h('div', { class: 'card stack' }, h('div', { class: 'legend' }, h('span', { class: 'key' }, h('i', { class: 'pos' }), 'Making'), h('span', { class: 'key' }, h('i', { class: 'pt' }), 'Partial'), h('span', { class: 'key' }, h('i', { class: 'ab' }), 'Not seen'), h('span', { class: 'key' }, h('i', { class: 'un' }), 'No public evidence'), h('span', { class: 'key' }, h('i', { class: 'na' }), 'Not applicable')), rows));
  return sec;
}

function railsSection() {
  const sec = h('section', { class: 'sec', id: 'h-rails' });
  const read = A.filter(a => a.horus && a.horus.ok);
  const cards = RAIL_IDS.map(rid => {
    const R = MODEL.rails[rid];
    const top = read.slice().sort((x, y) => y.horus.rails[rid].score - x.horus.rails[rid].score).slice(0, 6);
    return h('div', { class: 'card stack' },
      meter(R.label, FIELD.rails_mean[rid], rid === 'L' ? 'neg' : 'pos', 'field mean; weights: ' + Object.entries(R.w).map(([k, w]) => capName(k) + ' ' + w).join(', ')),
      h('div', { class: 'bars' }, top.map(a => h('div', { class: 'bar-row' }, h('button', { class: 'lbl', type: 'button', onclick: () => go('a.' + a.id + '.horus') }, a.name),
        (() => { const f = h('span', { class: 'fill ' + (rid === 'L' ? 'neg' : 'pos') }); f.style.width = a.horus.rails[rid].score + '%'; return h('div', { class: 'track base' }, f); })(),
        h('span', { class: 'v' }, Math.round(a.horus.rails[rid].score))))));
  });
  sec.append(sectionHead('Where the money goes next', 'The edition’s bottom line names three rails the money follows over 24 months and a losing side. Scores (0 to 100) are capability-weighted, plus 10 points for each rail signal evidenced on the agency’s own record.'), h('div', { class: 'grid-2' }, cards));
  return sec;
}

function indicatorSection() {
  const sec = h('section', { class: 'sec', id: 'h-watch' });
  const read = A.filter(a => a.horus && a.horus.ok);
  const cols = [
    { key: 'id', label: 'Indicator', sort: r => Number(r.id.slice(1)), render: r => h('div', null, h('b', { class: 'mono' }, r.id), ' ', r.indicator), first: true },
    { key: 'watch', label: 'What would move the call', render: r => h('span', { class: 'small' }, r.watch) },
    { key: 'next', label: 'Next reading', sort: r => r.next, render: r => h('span', { class: 'small nowrap' }, r.next) },
    { key: 'kj', label: 'Judgment', sort: r => Number(r.kj.slice(2)), render: r => refChip(r.kj) },
    { key: 'n', label: 'Agencies watching', num: true, sort: r => read.filter(a => a.horus.watch.some(w => w.id === r.id)).length, render: r => fmt(read.filter(a => a.horus.watch.some(w => w.id === r.id)).length), title: 'Agencies whose top judgment exposures include this indicator' }
  ];
  const cal = ED.watch_calendar.slice().sort((a, b) => a.date.localeCompare(b.date));
  sec.append(sectionHead('Indicators and the watch calendar', 'What to watch, what reading would move which judgment, and when the next reading lands. Each agency page lists the indicators tied to its own largest exposures.'),
    sortableTable(cols, ED.indicators, { sortKey: 'id', dir: 1 }),
    h('div', { class: 'card' }, h('div', { class: 'timeline' }, cal.map(c => h('div', { class: 'tl' }, h('span', { class: 'd' }, c.date + (c.date_approx ? ' ≈' : '')), h('span', { class: 'ty' }, refChip(c.indicator)), h('div', null, c.label, ' ', h('span', { class: 'muted small' }, TOPIC[c.topic] ? '(' + TOPIC[c.topic].short + ')' : '')))))));
  return sec;
}

function nilometerSection() {
  const sec = h('section', { class: 'sec', id: 'h-nilo' });
  const q = h('input', { type: 'search', id: 'nilo-q', placeholder: 'Filter signals', 'aria-label': 'Filter Nilometer signals' });
  const doms = [...new Set(ED.signals.map(x => x.domain))];
  const dSel = h('select', { id: 'nilo-d', 'aria-label': 'Domain' }, h('option', { value: '' }, 'All domains'), doms.map(d => h('option', { value: d }, d)));
  const cols = [
    { key: 'id', label: 'ID', sort: r => Number(r.id.slice(1)), render: r => h('b', { class: 'mono' }, r.id), first: true },
    { key: 'metric', label: 'Reading', render: r => h('div', null, h('b', null, r.metric), h('div', { class: 'small dim' }, r.value)) },
    { key: 'grade', label: 'Grade', sort: r => r.grade, render: r => gradeTag(r.grade) },
    { key: 'date', label: 'Date', sort: r => r.date, render: r => h('span', { class: 'mono small nowrap' }, r.date) },
    { key: 'src', label: 'Source', render: r => ext(r.url, r.source) }
  ];
  const tbl = sortableTable(cols, ED.signals, { sortKey: 'id', dir: 1, limit: 15 });
  const paint = () => { const t = norm(q.value); tbl.repaint(ED.signals.filter(x => (!dSel.value || x.domain === dSel.value) && (!t || norm(x.metric + ' ' + x.value + ' ' + x.source + ' ' + x.note).includes(t)))); };
  q.addEventListener('input', paint); dSel.addEventListener('change', paint);
  sec.append(sectionHead('The Nilometer', 'The hard signals the discourse is weighed against: earnings, forecasts, surveys, randomised experiments, rulings. Admiralty grades: source reliability A to F, information credibility 1 to 6.'),
    h('div', { class: 'filters' }, h('div', { class: 'field grow' }, h('label', { for: 'nilo-q' }, 'Search'), q), h('div', { class: 'field fx' }, h('label', { for: 'nilo-d' }, 'Domain'), dSel)), tbl);
  return sec;
}

function graveSection() {
  const sec = h('section', { class: 'sec', id: 'h-grave' });
  const flagged = A.filter(a => a.horus && a.horus.graveyard && a.horus.graveyard.length);
  sec.append(sectionHead('The graveyard and the 64th part', 'Failed prophecies used as base rates, the prophecies of today that share their shape, and what this edition cannot measure.'),
    h('div', { class: 'grid-3' }, ED.graveyard.map(g => h('div', { class: 'card stack' }, h('b', null, g.prophecy), h('span', { class: 'muted small' }, g.when), h('p', { class: 'small' }, g.outcome), h('p', { class: 'small' }, h('b', null, 'Lesson: '), g.lesson), h('div', { class: 'refs' }, refChip(g.ref))))),
    h('div', { class: 'callout sun' }, h('b', null, 'Graveyard test: '), ED.graveyard_test),
    h('div', { class: 'card stack' }, h('h3', null, 'Agencies whose own pitch leans on the graveyard-shaped prophecy'),
      h('p', { class: 'small dim' }, 'Positioning, AI posture, services or ad copy that sells agentic checkout or agentic commerce. The edition deserves the most skepticism on timing here; the flag is about timing risk, not the idea.'),
      flagged.length ? h('div', { class: 'stack' }, flagged.map(a => h('div', { class: 'small' }, agencyLink(a, null, 'horus'), ' · ', h('span', { class: 'dim' }, '“' + a.horus.graveyard[0].t + '”')))) : h('p', { class: 'muted' }, 'None flagged.')),
    h('div', { class: 'grid-3' }, ED.unknowns.map(u => h('div', { class: 'card stack' }, h('b', null, u.id + ' ' + u.unknown), h('p', { class: 'small dim' }, u.why)))),
    h('details', { class: 'fold' }, h('summary', null, 'Edition limitations'), h('div', { class: 'fold-body' }, h('ul', { class: 'small' }, ED.limitations.map(l => h('li', null, l))))));
  return sec;
}

/* Directory, matrix, clients, paid and social, gaps, compare, watchlist, method */

const agencyState = { q: '', region: '', segment: '', archetype: '', ownership: '', status: '', icp: '', band: '', scen: '', cap: '', capMin: '2', move: '', saydo: false, watch: false, sortKey: 'prom', dir: -1 };
const matrixState = { q: '', region: '', archetype: '', sort: '' };

function filteredAgencies(st) {
  const q = norm(st.q).trim();
  return A.filter(a => {
    const hz = a.horus || {};
    if (q && !norm([a.name, a.domain, a.owner, a.hq_city, a.hq_country, a.segment, a.archetype, (a.services || []).join(' '), (a.verticals || []).join(' ')].join(' ')).includes(q)) return false;
    if (st.region && a.region !== st.region) return false;
    if (st.segment && a.segment !== st.segment) return false;
    if (st.archetype === '__none' ? a.archetype : (st.archetype && a.archetype !== st.archetype)) return false;
    if (st.ownership && a.ownership !== st.ownership) return false;
    if (st.status && a.status !== st.status) return false;
    if (st.icp && a.icp !== st.icp) return false;
    if (st.band && (!hz.ok || hz.band !== st.band)) return false;
    if (st.scen && (!hz.ok || hz.scen_best !== st.scen)) return false;
    if (st.cap && !((strat(a, st.cap) || 0) >= Number(st.capMin || 1))) return false;
    if (st.move) { const [pid, ms] = st.move.split(':'); if (!hz.ok || !hz.moves[pid] || hz.moves[pid].s !== ms) return false; }
    if (st.saydo && !(hz.ok && hz.house && hz.house.contradicted > 0)) return false;
    if (st.watch && !isWatched(a.id)) return false;
    return true;
  });
}

const AGENCY_COLS = [
  { key: 'star', label: '', render: a => starBtn(a.id), csvSkip: true },
  { key: 'name', label: 'Agency', first: true, sort: a => a.name.toLowerCase(), render: a => h('div', null, h('a', { href: '#a.' + a.id }, h('b', null, a.name)), h('span', { class: 'd' }, a.domain)), csv: a => a.name },
  { key: 'domain', label: 'Domain', hide: true, csv: a => a.domain },
  { key: 'region', label: 'HQ', sort: a => a.region + (a.hq_country || ''), render: a => h('span', { class: 'small' }, [a.hq_city, a.hq_country || a.region].filter(Boolean).join(', ') || a.region), csv: a => [a.hq_city, a.hq_country, a.region].filter(Boolean).join(', ') },
  { key: 'segment', label: 'Segment', sort: a => a.segment || '', render: a => h('span', { class: 'small' }, a.segment || '–'), csv: a => a.segment },
  { key: 'archetype', label: 'Archetype', sort: a => a.archetype || '', render: a => h('span', { class: 'small' }, a.archetype || '–'), csv: a => a.archetype },
  { key: 'status', label: 'Status', sort: a => a.status, render: a => statusPill(a.status), csv: a => a.status },
  { key: 'prom', label: 'Prominence', num: true, sort: a => a.prominence, render: a => a.prominence != null ? a.prominence.toFixed(2) : '–', csv: a => a.prominence },
  { key: 'hti', label: 'Tailwind', num: true, sort: a => a.horus && a.horus.ok ? a.horus.hti : null, render: a => htiCell(a.horus), csv: a => a.horus && a.horus.ok ? a.horus.hti : '', title: 'Horus Tailwind Index' },
  { key: 'band', label: 'Band', sort: a => a.horus && a.horus.ok ? BANDS.indexOf(a.horus.band) : 9, render: a => bandTag(a.horus), csv: a => a.horus && a.horus.ok ? a.horus.band : '' },
  { key: 'arc', label: 'Arc', num: true, sort: a => a.horus && a.horus.ok ? -a.horus.arc_hour : null, render: a => a.horus && a.horus.ok ? a.horus.arc_clock : '–', csv: a => a.horus && a.horus.ok ? a.horus.arc_clock : '', title: 'Solar Arc clock of the sold mix' },
  { key: 'fit', label: 'Best fit', sort: a => a.horus && a.horus.ok ? a.horus.scen_best : 'Z', render: a => a.horus && a.horus.ok ? h('span', { class: 'small nowrap', title: SCEN[a.horus.scen_best].name }, a.horus.scen_best + ' ' + SCEN[a.horus.scen_best].name.replace(/^The /, '')) : '–', csv: a => a.horus && a.horus.ok ? a.horus.scen_best + ' ' + SCEN[a.horus.scen_best].name : '' },
  { key: 'saydo', label: 'Say/do', num: true, sort: a => a.horus && a.horus.ok && a.horus.house.tested ? a.horus.house.integrity : null, render: a => a.horus && a.horus.ok && a.horus.house.tested ? h('span', { class: a.horus.house.contradicted ? 'nowrap' : 'nowrap muted' }, a.horus.house.corroborated + '/' + a.horus.house.tested) : '–', csv: a => a.horus && a.horus.ok ? a.horus.house.corroborated + '/' + a.horus.house.tested : '', title: 'Sold lines practised on its own house / lines tested' },
  { key: 'moves', label: 'Moves', num: true, sort: a => a.horus && a.horus.ok ? a.horus.moves_score.making + a.horus.moves_score.partial / 2 : null, render: a => a.horus && a.horus.ok ? a.horus.moves_score.making + '/' + a.horus.moves_score.applicable : '–', csv: a => a.horus && a.horus.ok ? a.horus.moves_score.making + '/' + a.horus.moves_score.applicable : '', title: 'Horus moves being made / applicable' },
  { key: 'g30', label: 'Google 30d', num: true, sort: a => a.google ? a.google.count_30d : null, render: a => a.google && a.google.status === 'active' ? fmt(a.google.count_30d) : h('span', { class: 'muted' }, a.google ? a.google.status : '–'), csv: a => a.google ? (a.google.status === 'active' ? a.google.count_30d : a.google.status) : '' },
  { key: 'li', label: 'LinkedIn', num: true, sort: a => a.linkedin ? a.linkedin.company_ads : null, render: a => a.linkedin && a.linkedin.status === 'active' ? fmt(a.linkedin.company_ads) + (a.li_thought_leader ? ' +' + a.li_thought_leader : '') : h('span', { class: 'muted' }, a.linkedin ? a.linkedin.status : '–'), csv: a => a.linkedin ? (a.linkedin.status === 'active' ? a.linkedin.company_ads : a.linkedin.status) : '' },
  { key: 'c90', label: 'Posts 90d', num: true, sort: a => a.content_90d, render: a => fmt(a.content_90d), csv: a => a.content_90d },
  { key: 'clients', label: 'Clients', num: true, sort: a => (a.clients || []).length, render: a => fmt((a.clients || []).length), csv: a => (a.clients || []).length }
];

function viewAgencies() {
  lastListView = 'agencies';
  const st = agencyState;
  const view = h('div', { class: 'view' });
  const opts = (vals, all) => [h('option', { value: '' }, all), ...vals.map(([v, n]) => h('option', { value: v }, (v || 'Unclassified') + ' (' + n + ')'))];
  const sel = (id, label, values, key, all) => { const el = h('select', { id, 'aria-label': label }, opts(values, all)); el.value = st[key] || ''; el.addEventListener('change', () => { st[key] = el.value; paint(); }); return h('div', { class: 'field fx' }, h('label', { for: id }, label), el); };
  const q = h('input', { type: 'search', id: 'ag-q', placeholder: 'Name, domain, service, vertical', value: st.q });
  q.addEventListener('input', () => { st.q = q.value; paint(); });
  const archVals = countBy(A, a => a.archetype || '__none').map(([v, n]) => [v, n]);
  const capSel = h('select', { id: 'ag-cap', 'aria-label': 'Capability' }, h('option', { value: '' }, 'Any capability'), DIMS.map(([k, l]) => h('option', { value: k }, l)));
  capSel.value = st.cap; capSel.addEventListener('change', () => { st.cap = capSel.value; paint(); });
  const capMin = h('select', { id: 'ag-capmin', 'aria-label': 'Minimum score' }, ['1', '2', '3'].map(v => h('option', { value: v }, 'score ' + v + '+')));
  capMin.value = st.capMin; capMin.addEventListener('change', () => { st.capMin = capMin.value; paint(); });
  const moveSel = h('select', { id: 'ag-move', 'aria-label': 'Horus move' }, h('option', { value: '' }, 'Any move status'),
    IMPL_IDS.map(pid => h('optgroup', { label: pid + ' ' + IMPL[pid].move }, MOVE_STATUS.map(ms => h('option', { value: pid + ':' + ms }, pid + ' ' + MOVE_LABEL[ms])))));
  moveSel.value = st.move; moveSel.addEventListener('change', () => { st.move = moveSel.value; paint(); });
  const chk = (id, label, key) => { const c = h('input', { type: 'checkbox', id }); c.checked = st[key]; c.addEventListener('change', () => { st[key] = c.checked; paint(); }); return h('label', { class: 'check', for: id }, c, label); };
  const reset = h('button', { class: 'btn', type: 'button', onclick: () => { Object.assign(st, { q: '', region: '', segment: '', archetype: '', ownership: '', status: '', icp: '', band: '', scen: '', cap: '', capMin: '2', move: '', saydo: false, watch: false }); render(); } }, 'Reset');
  const archSel = h('select', { id: 'ag-arch', 'aria-label': 'Archetype' }, h('option', { value: '' }, 'All archetypes'), archVals.map(([v, n]) => h('option', { value: v }, (v === '__none' ? 'Unclassified' : v) + ' (' + n + ')')));
  archSel.value = st.archetype; archSel.addEventListener('change', () => { st.archetype = archSel.value; paint(); });
  const count = h('span', { class: 'muted small' });
  const tableHost = h('div');
  const cols = AGENCY_COLS.filter(c => !c.hide);
  let table = null;
  function paint() {
    const rows = filteredAgencies(st);
    count.textContent = 'Showing ' + rows.length + ' of ' + A.length;
    if (!table) { table = sortableTable(cols, rows, { sortKey: st.sortKey, dir: st.dir, limit: 80, tall: true, onRow: a => go('a.' + a.id), onSort: (k, d) => { st.sortKey = k; st.dir = d; } }); tableHost.replaceChildren(table); }
    else table.repaint(rows);
  }
  view.appendChild(h('section', { class: 'sec' },
    sectionHead('Agencies', 'Every agency with its Horus read. Filters combine. Click a row to open the dossier; the star adds it to your watchlist.'),
    h('div', { class: 'filters' },
      h('div', { class: 'field grow' }, h('label', { for: 'ag-q' }, 'Search'), q),
      sel('ag-region', 'Region', countBy(A, a => a.region), 'region', 'All regions'),
      sel('ag-seg', 'Segment', countBy(A, a => a.segment), 'segment', 'All segments'),
      h('div', { class: 'field fx' }, h('label', { for: 'ag-arch' }, 'Archetype'), archSel),
      sel('ag-own', 'Ownership', countBy(A, a => a.ownership), 'ownership', 'Any ownership'),
      sel('ag-status', 'Status', countBy(A, a => a.status), 'status', 'Any status'),
      sel('ag-icp', 'Client size', countBy(A, a => a.icp), 'icp', 'Any client size'),
      sel('ag-band', 'Horus band', BANDS.map(b => [b, FIELD.bands[b] || 0]), 'band', 'Any band'),
      sel('ag-scen', 'Best-fit scenario', SCEN_IDS.map(sid => [sid, FIELD.best_fit[sid] || 0]), 'scen', 'Any scenario'),
      h('div', { class: 'field fx' }, h('label', { for: 'ag-cap' }, 'Capability'), capSel),
      h('div', { class: 'field', style: { flex: '0 1 110px' } }, h('label', { for: 'ag-capmin' }, 'Minimum'), capMin),
      h('div', { class: 'field fx', style: { flex: '1 1 220px' } }, h('label', { for: 'ag-move' }, 'Horus move'), moveSel),
      chk('ag-saydo', 'Say/do contradiction', 'saydo'), chk('ag-watch', 'Watchlist only', 'watch'), reset),
    h('div', { class: 'row between' }, count, exportButtons('agency_radar_horus.csv', () => toCSV(filteredAgencies(st), AGENCY_COLS.filter(c => !c.csvSkip).map(c => ({ label: c.label || c.key, csv: c.csv || (a => a[c.key]) })).concat(exportExtraCols())), 'text/csv;charset=utf-8')),
    tableHost));
  paint();
  // hand a filter that came from another view back into its control
  return view;
}
function exportExtraCols() {
  const hz = a => a.horus && a.horus.ok ? a.horus : null;
  const cols = [
    { label: 'Solar Arc Khepri', csv: a => hz(a) ? a.horus.stage_mix.Khepri : '' }, { label: 'Solar Arc Ra', csv: a => hz(a) ? a.horus.stage_mix.Ra : '' },
    { label: 'Solar Arc Atum', csv: a => hz(a) ? a.horus.stage_mix.Atum : '' }, { label: 'Solar Arc Duat', csv: a => hz(a) ? a.horus.stage_mix.Duat : '' },
    { label: 'Resilience', csv: a => hz(a) ? a.horus.resilience : '' }
  ];
  for (const sid of SCEN_IDS) cols.push({ label: 'Fit ' + sid, csv: a => hz(a) ? a.horus.scen_fit[sid] : '' });
  for (const rid of RAIL_IDS) cols.push({ label: MODEL.rails[rid].label, csv: a => hz(a) ? a.horus.rails[rid].score : '' });
  for (const pid of IMPL_IDS) cols.push({ label: pid + ' ' + IMPL[pid].move, csv: a => hz(a) ? a.horus.moves[pid].s : '' });
  for (const k of KJ_IDS) cols.push({ label: k + ' net', csv: a => hz(a) ? a.horus.kj[k].net : '' });
  for (const [k, l] of DIMS) cols.push({ label: l, csv: a => strat(a, k) });
  cols.push({ label: 'Horus verdict', csv: a => hz(a) ? a.horus.verdict : (a.horus && a.horus.reason) || '' });
  return cols;
}

/* ---------- matrix ---------- */
function viewMatrix() {
  lastListView = 'matrix';
  const st = matrixState;
  const view = h('div', { class: 'view' });
  const q = h('input', { type: 'search', id: 'mx-q', placeholder: 'Filter agencies', value: st.q });
  const rSel = h('select', { id: 'mx-r', 'aria-label': 'Region' }, h('option', { value: '' }, 'All regions'), countBy(A, a => a.region).map(([v, n]) => h('option', { value: v }, v + ' (' + n + ')')));
  rSel.value = st.region;
  const aSel = h('select', { id: 'mx-a', 'aria-label': 'Archetype' }, h('option', { value: '' }, 'All archetypes'), countBy(A, a => a.archetype).map(([v, n]) => h('option', { value: v }, v + ' (' + n + ')')));
  aSel.value = st.archetype;
  const host = h('div');
  function paint() {
    st.q = q.value; st.region = rSel.value; st.archetype = aSel.value;
    const t = norm(st.q);
    let rows = A.filter(a => a.strategy && (!t || norm(a.name + ' ' + a.domain).includes(t)) && (!st.region || a.region === st.region) && (!st.archetype || a.archetype === st.archetype));
    if (st.sort === 'hti') rows.sort(by(a => a.horus && a.horus.ok ? a.horus.hti : null));
    else if (st.sort) rows.sort((x, y) => (y.strategy[st.sort] || 0) - (x.strategy[st.sort] || 0) || (y.prominence || 0) - (x.prominence || 0));
    else rows.sort((x, y) => x.name.localeCompare(y.name));
    const thead = h('thead', null, h('tr', null, h('th', { class: 'first', scope: 'col' }, 'Agency · ' + rows.length),
      DIMS.map(([k, l]) => { const th = h('th', { class: 'cap', scope: 'col', title: 'Sort by ' + l, 'aria-sort': st.sort === k ? 'descending' : null, tabindex: '0' }, l); const act = () => { st.sort = st.sort === k ? '' : k; paint(); }; th.addEventListener('click', act); th.addEventListener('keydown', e => { if (e.key === 'Enter') act(); }); return th; }),
      (() => { const th = h('th', { class: 'cap', scope: 'col', 'aria-sort': st.sort === 'hti' ? 'descending' : null, tabindex: '0', title: 'Sort by Horus Tailwind Index' }, 'Horus tailwind'); th.addEventListener('click', () => { st.sort = st.sort === 'hti' ? '' : 'hti'; paint(); }); return th; })()));
    const tbody = h('tbody');
    for (const a of rows) {
      const tr = h('tr', null, h('td', { class: 'first name' }, h('a', { href: '#a.' + a.id + '.strategy' }, a.name), h('span', { class: 'd' }, a.region + ' · ' + (a.archetype || '–'))));
      for (const [k, l] of DIMS) {
        const v = a.strategy[k];
        const td = h('td', { class: 'c v' + (v ?? 'nd'), tabindex: '0', 'aria-label': a.name + ' ' + l + ' ' + v }, v == null ? '·' : String(v));
        const ev = (a.strategy_evidence || {})[k];
        tipOn(td, () => frag(h('div', { class: 'tv' }, l + ': ' + v + ' of 3'), h('div', null, a.name), ev ? h('div', { class: 'tl2' }, ev.note) : h('div', { class: 'tl2' }, v ? 'Scored from services and case studies' : 'No evidence of this capability')));
        td.addEventListener('click', () => go('a.' + a.id + '.strategy'));
        tr.appendChild(td);
      }
      tr.appendChild(h('td', { class: 'num' }, htiCell(a.horus)));
      tbody.appendChild(tr);
    }
    const foot = h('tfoot', null, h('tr', null, h('td', { class: 'first' }, 'Mean · share at 2+'), DIMS.map(([k]) => { const vs = rows.map(a => a.strategy[k]).filter(v => v != null); return h('td', null, (mean(vs) || 0).toFixed(1), h('br'), pct(vs.filter(v => v >= 2).length / Math.max(1, vs.length))); }), h('td', null, signed(mean(rows.map(a => a.horus && a.horus.ok ? a.horus.hti : null)) || 0))));
    host.replaceChildren(h('div', { class: 'tbl-wrap tall' }, h('table', { class: 'tbl heat' }, thead, tbody, foot)));
  }
  [q, rSel, aSel].forEach(el => el.addEventListener(el === q ? 'input' : 'change', paint));
  view.appendChild(h('section', { class: 'sec' },
    sectionHead('Strategy matrix', '15 capabilities scored 0 to 3 from each agency’s own evidence. Hover a cell for the evidence note; click to open that agency’s strategy tab. Click a column to sort by it.'),
    h('div', { class: 'filters' }, h('div', { class: 'field grow' }, h('label', { for: 'mx-q' }, 'Search'), q), h('div', { class: 'field fx' }, h('label', { for: 'mx-r' }, 'Region'), rSel), h('div', { class: 'field fx' }, h('label', { for: 'mx-a' }, 'Archetype'), aSel),
      h('div', { class: 'legend' }, h('span', { class: 'key' }, h('i', { class: 'h1' }), '1'), h('span', { class: 'key' }, h('i', { class: 'h2' }), '2'), h('span', { class: 'key' }, h('i', { class: 'h3' }), '3'), h('span', { class: 'muted' }, 'blank = 0'))),
    host));
  paint();
  return view;
}

/* ---------- clients ---------- */
function viewClients() {
  const view = h('div', { class: 'view' });
  const c = D.agg.clients;
  const q = h('input', { type: 'search', id: 'cl-q', placeholder: 'Search 2,000+ clients', value: clientQuery });
  const onlyShared = h('input', { type: 'checkbox', id: 'cl-shared' });
  const host = h('div');
  const all = [...CLIENT_INDEX.values()].sort((x, y) => y.agencies.length - x.agencies.length || x.name.localeCompare(y.name));
  let limit = 60;
  function paint() {
    clientQuery = q.value;
    const t = norm(q.value).trim();
    const rows = all.filter(x => (!t || norm(x.name).includes(t)) && (!onlyShared.checked || x.agencies.length > 1));
    const list = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Client'), h('th', null, 'Agencies that show it'), h('th', { class: 'num' }, 'n'))),
      h('tbody', null, rows.slice(0, limit).map(x => h('tr', null, h('td', { class: 'name' }, h('b', null, x.name)),
        h('td', null, h('div', { class: 'chips' }, x.agencies.map(e => { const a = BYID.get(e.id); return h('span', { class: 'chip' }, h('a', { href: '#a.' + a.id + '.clients' }, a.name), e.url ? ext(e.url, e.evidence || 'source') : h('span', { class: 'cn' }, e.evidence || '')); }))),
        h('td', { class: 'num' }, String(x.agencies.length)))))));
    host.replaceChildren(h('p', { class: 'muted small' }, fmt(rows.length) + ' clients match'), list,
      rows.length > limit ? h('div', { class: 'more' }, h('button', { class: 'btn', type: 'button', onclick: () => { limit += 120; paint(); } }, 'Show more')) : null);
  }
  q.addEventListener('input', () => { limit = 60; paint(); }); onlyShared.addEventListener('change', () => { limit = 60; paint(); });
  view.append(h('div', { class: 'tiles' }, tile('Client mentions', fmt(c.total_mentions), 'case studies, logo walls, press'), tile('Unique clients', fmt(c.unique), 'after name matching'), tile('Agencies with a client list', fmt(c.with_clients), 'of ' + A.length), tile('Clients shown by 2+ agencies', fmt(all.filter(x => x.agencies.length > 1).length), 'overlap and churn signals')),
    h('section', { class: 'grid-2' },
      h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Most shared clients')), barList(c.shared.slice(0, 14).map(x => ({ label: x.name, value: x.n, onClick: () => { q.value = x.name; limit = 60; paint(); } })), { cls: 'ink' })),
      h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Verticals claimed')), barList(D.agg.verticals.slice(0, 14).map(x => ({ label: x.name, value: x.n })), { cls: 'ink' }))),
    h('section', { class: 'sec' }, sectionHead('Client finder', 'Who shows which client, with the evidence type and a link to the case study or logo wall. A client shown by several agencies often marks a roster change or a split brief.'),
      h('div', { class: 'filters' }, h('div', { class: 'field grow' }, h('label', { for: 'cl-q' }, 'Client'), q), h('label', { class: 'check', for: 'cl-shared' }, onlyShared, 'Only clients shown by 2+ agencies')), host));
  paint();
  return view;
}

/* ---------- paid & social ---------- */
function viewPaid() {
  const view = h('div', { class: 'view' });
  const p = D.agg.paid;
  const gs = Object.fromEntries(countBy(A, a => a.google ? a.google.status : 'n/a'));
  const ls = Object.fromEntries(countBy(A, a => a.linkedin ? a.linkedin.status : 'n/a'));
  view.append(h('div', { class: 'tiles' },
    tile('Google advertisers', fmt(p.google_active), (gs.none || 0) + ' none · ' + (gs.blocked || 0) + ' blocked · ' + (gs.not_found || 0) + ' not found'),
    tile('LinkedIn advertisers', fmt(p.li_active), (ls.none || 0) + ' none · ' + (ls.not_found || 0) + ' not found'),
    tile('Thought-leader ads', fmt(p.li_thought_leader), 'agencies promoting named employees'),
    tile('Meta and TikTok', 'Not captured', 'both ad libraries were unreachable in the sweep')));
  const vs = A.filter(a => a.google_video_share != null && a.google && a.google.status === 'active' && (a.google.count || 0) >= 10).sort((x, y) => y.google_video_share - x.google_video_share).slice(0, 12);
  view.append(h('section', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Most active on Google, last 30 days'), h('span', { class: 'muted small' }, 'ads shown (floor)')),
      barList(p.google_top_30d.slice(0, 15).map(x => ({ label: x.name, value: x.count_30d, display: fmt(x.count_30d) + ' / ' + fmt(x.total), onClick: () => go('a.' + x.id + '.paid') })), { cls: 'ink' })),
    (() => {
      const act = A.filter(a => a.linkedin && a.linkedin.status === 'active');
      const bands = [['1 to 5', 1, 5], ['6 to 11', 6, 11], ['12 to 23', 12, 23], ['24, the capture cap', 24, 1e9]];
      const capped = act.filter(a => (a.linkedin.company_ads || 0) >= 24).sort((x, y) => (y.prominence || 0) - (x.prominence || 0));
      return h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'LinkedIn company ads per agency'), h('span', { class: 'muted small' }, 'first results page only, so every count is a floor')),
        barList(bands.map(([l, lo, hi]) => ({ label: l, value: act.filter(a => (a.linkedin.company_ads || 0) >= lo && (a.linkedin.company_ads || 0) <= hi).length })), { cls: 'ink' }),
        h('h4', null, 'At the cap: ' + capped.length + ' agencies running 24 or more'),
        h('div', { class: 'chips' }, capped.map(a => h('a', { class: 'chip', href: '#a.' + a.id + '.paid' }, a.name))));
    })()),
    h('section', { class: 'grid-2' },
      h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Google ad formats'), h('span', { class: 'muted small' }, 'all agency ads in the library')),
        barList(p.google_formats.map(x => ({ label: x.name, value: x.n })), { cls: 'ink' }),
        h('h4', null, 'Video-heaviest Google advertisers (10+ ads)'), barList(vs.map(a => ({ label: a.name, value: a.google_video_share, display: pct(a.google_video_share), onClick: () => go('a.' + a.id + '.paid') })), { max: 1, cls: 'ink' })),
      h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Thought-leader ads'), h('span', { class: 'muted small' }, 'named people as the ad voice')),
        barList(p.li_tl_top.slice(0, 14).map(x => ({ label: x.name, value: x.tl, onClick: () => go('a.' + x.id + '.paid') })), { cls: 'ink' }),
        h('h4', null, 'LinkedIn formats'), barList(p.li_formats.slice(0, 8).map(x => ({ label: x.name, value: x.n })), { cls: 'ink' }))));
  // ad copy explorer
  const samples = [];
  for (const a of A) {
    for (const t of (a.google && a.google.samples) || []) samples.push({ a, p: 'Google', t, u: a.google.query_url });
    for (const t of (a.linkedin && a.linkedin.samples) || []) samples.push({ a, p: 'LinkedIn', t, u: a.linkedin.query_url });
  }
  const q = h('input', { type: 'search', id: 'ad-q', placeholder: 'Search ad copy, e.g. GEO, ChatGPT, AI Mode, audit' });
  const pSel = h('select', { id: 'ad-p', 'aria-label': 'Platform' }, ['All', 'Google', 'LinkedIn'].map(v => h('option', { value: v }, v)));
  const host = h('div', { class: 'grid-3' });
  const cnt = h('span', { class: 'muted small' });
  function paint() {
    const t = norm(q.value).trim();
    const rows = samples.filter(x => (pSel.value === 'All' || x.p === pSel.value) && (!t || norm(x.t + ' ' + x.a.name).includes(t)));
    cnt.textContent = fmt(rows.length) + ' of ' + fmt(samples.length) + ' captured ad samples';
    host.replaceChildren(...rows.slice(0, 60).map(x => h('div', { class: 'ad' }, h('div', { class: 'src' }, x.p + ' · ', h('a', { href: '#a.' + x.a.id + '.paid' }, x.a.name)), h('div', null, x.t), x.u ? h('div', { class: 'small', style: { marginTop: '6px' } }, ext(x.u, 'Open the ad library')) : null)));
  }
  q.addEventListener('input', paint); pSel.addEventListener('change', paint);
  view.append(h('section', { class: 'sec' }, sectionHead('Ad copy explorer', 'Every captured ad sample from the Google Ads Transparency Center and the LinkedIn Ad Library, searchable. Counts are floors from first-page captures.'),
    h('div', { class: 'filters' }, h('div', { class: 'field grow' }, h('label', { for: 'ad-q' }, 'Search'), q), h('div', { class: 'field fx' }, h('label', { for: 'ad-p' }, 'Platform'), pSel)), cnt, host));
  paint();
  return view;
}

/* ---------- gaps ---------- */
function viewGaps() {
  const view = h('div', { class: 'view' });
  const rSel = h('select', { id: 'gp-r', 'aria-label': 'Region' }, h('option', { value: '' }, 'All regions'), ['US', 'Europe'].map(v => h('option', { value: v }, v)));
  const host = h('div', { class: 'stack' });
  function group(title, sub, list, note) {
    const rows = list.filter(x => !rSel.value || x.a.region === rSel.value);
    const csv = () => toCSV(rows, [{ label: 'Agency', csv: x => x.a.name }, { label: 'Domain', csv: x => x.a.domain }, { label: 'Region', csv: x => x.a.region }, { label: 'Segment', csv: x => x.a.segment }, { label: 'Note', csv: x => x.note || '' }]);
    return h('details', { class: 'fold' }, h('summary', null, h('span', null, title + ' ', h('span', { class: 'muted mono small' }, '· ' + rows.length))),
      h('div', { class: 'fold-body' }, sub ? h('p', { class: 'small dim' }, sub) : null, note,
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => copyText(csv(), 'CSV') }, icon('copy'), 'Copy list as CSV')),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Agency'), h('th', null, 'Where'), h('th', null, 'Horus'), h('th', null, 'Note'))),
          h('tbody', null, rows.map(x => h('tr', null, h('td', { class: 'name' }, h('a', { href: '#a.' + x.a.id + (x.tab ? '.' + x.tab : '') }, h('b', null, x.a.name)), h('span', { class: 'd' }, x.a.domain)), h('td', { class: 'small' }, x.a.region + ' · ' + (x.a.segment || '')), h('td', { class: 'nowrap' }, bandTag(x.a.horus), ' ', x.a.horus && x.a.horus.ok ? h('span', { class: 'mono small' }, signed(x.a.horus.hti)) : null), h('td', { class: 'small dim' }, x.note || ''))))))));
  }
  function paint() {
    const byCode = new Map();
    const codeCap = { ai_no_llms: 'ai_search', ai_blocks_bots: 'ai_search', search_no_ads: 'paid_search', social_no_pixel: 'paid_social', no_linkedin_ads: 'linkedin', cro_no_testing: 'cro', content_stalled: 'content' };
    const codeTab = { ai_no_llms: 'content', ai_blocks_bots: 'content', search_no_ads: 'paid', social_no_pixel: 'paid', no_linkedin_ads: 'paid', cro_no_testing: 'paid', content_stalled: 'content' };
    for (const a of A) for (const g of (a.gaps || [])) {
      if (!byCode.has(g.label)) byCode.set(g.label, []);
      const t = a.horus && a.horus.house ? a.horus.house.tests.find(x => x.cap === codeCap[g.code]) : null;
      const extra = [];
      if (g.code.startsWith('ai_') && a.ai_urls) extra.push(a.ai_urls + ' AI-topic URLs in its own sitemap');
      if (g.code === 'search_no_ads' || g.code === 'no_linkedin_ads') extra.push('sells it at score ' + (strat(a, g.code === 'search_no_ads' ? 'paid_search' : 'paid_social') ?? '–') + ' of 3');
      byCode.get(g.label).push({ a, note: extra.join('; '), tab: codeTab[g.code] || 'overview' });
    }
    const moveGroups = [
      ['P1', 'partial', 'Sells AI search with no audited AI-visibility product', 'No tracking, scorecard or citation-share product shows in the record. The edition’s move P1: sell AI visibility as an audited product.'],
      ['P8', 'absent', 'Sells paid search, no sign of testing ads inside AI assistants', 'The edition’s move P8: put ChatGPT and AI Mode ads in test budgets now, with holdouts.'],
      ['P4', 'partial', 'Runs paid media without supplying the inputs automation runs on', 'No first-party data, creative-volume or measurement depth in the record (move P4).'],
      ['P3', 'partial', 'Sells local at depth with no Local Services Ads work', 'The edition’s KJ7: local discovery is being enclosed by pay-per-lead units (move P3).'],
      ['P2', 'absent', 'No feeds, schema or entity service line', 'The machine-readable layer answer engines consume (move P2).']
    ];
    const read = A.filter(a => a.horus && a.horus.ok);
    host.replaceChildren(
      h('h3', null, 'Say and do: sold on the site, missing from the house'),
      ...[...byCode.entries()].sort((x, y) => y[1].length - x[1].length).map(([label, list]) => group(label, 'From the radar’s own gap scan of each agency’s site, ad libraries and sitemap.', list)),
      h('h3', { style: { marginTop: '14px' } }, 'Horus move gaps'),
      ...moveGroups.map(([pid, stt, title, sub]) => group(title, sub, read.filter(a => a.horus.moves[pid].s === stt).map(a => ({ a, note: a.horus.moves[pid].why, tab: 'horus' })))),
      group('Leans on the graveyard-shaped prophecy (agentic checkout)', ED.graveyard_test, read.filter(a => a.horus.graveyard.length).map(a => ({ a, note: '“' + a.horus.graveyard[0].t + '”', tab: 'horus' }))));
  }
  rSel.addEventListener('change', paint);
  view.append(h('section', { class: 'sec' }, sectionHead('Gaps', 'Where an agency’s pitch and its own house disagree, and which of the edition’s moves each agency has not made. Each list is a prospecting or poaching sheet.'),
    h('div', { class: 'filters' }, h('div', { class: 'field fx' }, h('label', { for: 'gp-r' }, 'Region'), rSel)), host));
  paint();
  return view;
}

/* ---------- compare ---------- */
function viewCompare() {
  const view = h('div', { class: 'view' });
  const ids = store.data.compare.slice();
  const pickHost = h('div', { class: 'search', style: { maxWidth: '420px' } });
  const inp = h('input', { type: 'search', id: 'cmp-q', placeholder: 'Add an agency to compare', autocomplete: 'off' });
  const box = h('div', { class: 'results', hidden: true });
  inp.addEventListener('input', () => {
    const r = searchAll(inp.value).agencies.filter(a => !ids.includes(a.id));
    box.replaceChildren(...r.map(a => h('button', { type: 'button', onclick: () => { toggleCompare(a.id); render(); } }, h('span', { class: 'r-main' }, a.name), h('span', { class: 'r-side' }, a.domain))));
    box.hidden = !inp.value.trim() || !r.length;
  });
  pickHost.append(icon('search'), inp, box); pickHost.querySelector('svg').classList.add('ico');
  const chips = h('div', { class: 'chips' }, ids.map(id => { const a = BYID.get(id); return h('span', { class: 'chip lead' }, a.name, h('button', { class: 'ref', type: 'button', 'aria-label': 'Remove ' + a.name, onclick: () => { toggleCompare(id); render(); } }, '×')); }));
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Compare', 'Up to four agencies side by side, Horus read first. Add from here, from any dossier, or with the compare button on a dossier.'), h('div', { class: 'row' }, pickHost, chips)));
  if (!ids.length) {
    const sugg = ['webfx', 'seer-interactive', 'ignite-visibility', 'brainlabs'].filter(id => BYID.has(id));
    view.appendChild(h('div', { class: 'empty stack' }, h('p', null, 'Nothing to compare yet.'), h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn wrap', type: 'button', onclick: () => { store.data.compare = sugg.slice(); store.save(); render(); } }, 'Load an example: ' + sugg.map(id => BYID.get(id).name).join(', ')))));
    return view;
  }
  const as = ids.map(id => BYID.get(id));
  const row = (label, fn, cls) => h('tr', null, h('th', { scope: 'row', class: 'first' }, label), as.map(a => h('td', { class: cls || '' }, fn(a))));
  const hz = a => a.horus && a.horus.ok ? a.horus : null;
  const bar3 = v => { const f = h('span', { class: 'fill' }); f.style.width = (100 * (v || 0) / 3) + '%'; return h('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } }, h('div', { class: 'track base', style: { width: '90px' } }, f), h('span', { class: 'mono small' }, v == null ? '–' : String(v))); };
  const tbody = h('tbody', null,
    row('Band · tailwind', a => hz(a) ? h('div', { class: 'row' }, bandTag(a.horus), h('span', { class: 'mono' }, signed(a.horus.hti))) : h('span', { class: 'muted' }, 'no read')),
    row('Solar Arc', a => hz(a) ? h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'mono' }, a.horus.arc_clock + ' · ' + a.horus.arc_word), stageStack(a.horus.stage_mix)) : '–'),
    row('Best fit · resilience', a => hz(a) ? a.horus.scen_best + ' ' + SCEN[a.horus.scen_best].name + ' · ' + Math.round(a.horus.resilience) : '–'),
    ...RAIL_IDS.map(rid => row(MODEL.rails[rid].label, a => hz(a) ? meter('', a.horus.rails[rid].score, rid === 'L' ? 'neg' : 'pos') : '–')),
    row('Moves making', a => hz(a) ? h('div', { class: 'chips' }, IMPL_IDS.map(pid => h('span', { class: 'stc st-' + a.horus.moves[pid].s, title: IMPL[pid].move + ': ' + MOVE_LABEL[a.horus.moves[pid].s] }, pid))) : '–'),
    row('Say/do', a => hz(a) && a.horus.house.tested ? a.horus.house.corroborated + ' of ' + a.horus.house.tested + ' practised' : '–'),
    ...KJ_IDS.filter(k => Object.keys(MODEL.kj_e[k] || {}).length).map(k => row(k + ' ' + KJ[k].title, a => hz(a) ? h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, divBar(a.horus.kj[k].net, KJ_MAX), h('span', { class: 'mono small' }, (a.horus.kj[k].net >= 0 ? '+' : '') + a.horus.kj[k].net.toFixed(2))) : '–')),
    ...DIMS.map(([k, l]) => row(l, a => bar3(strat(a, k)))),
    row('Region · HQ', a => [a.region, a.hq_city, a.hq_country].filter(Boolean).join(' · ')),
    row('Segment · archetype', a => (a.segment || '–') + ' · ' + (a.archetype || '–')),
    row('Ownership', a => (a.ownership || '–') + (a.owner ? ' · ' + a.owner : '')),
    row('Employees', a => a.employees && a.employees.value ? a.employees.value : '–'),
    row('Prominence', a => a.prominence != null ? a.prominence.toFixed(2) : '–', 'num'),
    row('Google ads (30d / all)', a => a.google && a.google.status === 'active' ? fmt(a.google.count_30d) + ' / ' + fmt(a.google.count) : (a.google ? a.google.status : '–')),
    row('LinkedIn ads', a => a.linkedin && a.linkedin.status === 'active' ? fmt(a.linkedin.company_ads) + ' company · ' + fmt(a.li_thought_leader || 0) + ' thought leader' : (a.linkedin ? a.linkedin.status : '–')),
    row('Publishing (90d / 365d)', a => fmt(a.content_90d) + ' / ' + fmt(a.content_365d)),
    row('AI URLs · llms.txt', a => fmt(a.ai_urls) + ' · ' + (a.llms_txt === true ? 'yes' : a.llms_txt === false ? 'no' : 'not checked')),
    row('Clients shown', a => fmt((a.clients || []).length)),
    row('Latest move', a => { const m = (a.moves || []).slice().sort((x, y) => dateKey(y.date).localeCompare(dateKey(x.date)))[0]; return m ? h('span', { class: 'small' }, m.date + ' · ' + m.note) : '–'; }));
  view.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { class: 'first' }, ''), as.map(a => h('th', null, h('a', { href: '#a.' + a.id + '.horus' }, a.name))))), tbody)));
  return view;
}

/* ---------- watchlist ---------- */
function viewWatch() {
  const view = h('div', { class: 'view' });
  const ids = store.data.watch.slice();
  const note = IS_EXT ? 'Saved in this browser profile by the extension.' : FRAMED ? 'Saved in this browser only, where the page allows storage.' : 'Saved in this browser only.';
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Watchlist', 'Agencies you are tracking, with private notes. ' + note)));
  if (!ids.length) { view.appendChild(h('div', { class: 'empty' }, 'No agencies on your watchlist yet. Use the star on any row or dossier.')); return view; }
  const csv = () => toCSV(ids.map(id => BYID.get(id)), [{ label: 'Agency', csv: a => a.name }, { label: 'Domain', csv: a => a.domain }, { label: 'Band', csv: a => a.horus && a.horus.ok ? a.horus.band : '' }, { label: 'Tailwind', csv: a => a.horus && a.horus.ok ? a.horus.hti : '' }, { label: 'Best fit', csv: a => a.horus && a.horus.ok ? a.horus.scen_best : '' }, { label: 'Notes', csv: a => store.data.notes[a.id] || '' }]);
  view.appendChild(exportButtons('watchlist.csv', csv, 'text/csv;charset=utf-8'));
  const grid = h('div', { class: 'grid-3' });
  for (const id of ids) {
    const a = BYID.get(id); const hz = a.horus;
    const ta = h('textarea', { id: 'note-' + id, placeholder: 'Notes: pitch angle, contacts, next step', 'aria-label': 'Notes for ' + a.name });
    ta.value = store.data.notes[id] || '';
    let t; ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { store.data.notes[id] = ta.value; store.save(); }, 400); });
    const m = (a.moves || []).slice().sort((x, y) => dateKey(y.date).localeCompare(dateKey(x.date)))[0];
    grid.appendChild(h('div', { class: 'card stack' },
      h('div', { class: 'row between' }, h('a', { href: '#a.' + id + '.horus' }, h('b', null, a.name)), starBtn(id)),
      h('div', { class: 'row' }, bandTag(hz), hz && hz.ok ? h('span', { class: 'mono small' }, signed(hz.hti) + ' · ' + hz.arc_clock + ' · ' + hz.scen_best) : null),
      hz && hz.ok ? h('p', { class: 'small dim' }, hz.verdict) : h('p', { class: 'small muted' }, hz ? hz.reason : ''),
      m ? h('p', { class: 'small' }, h('b', null, 'Latest: '), m.date + ' · ' + m.note) : null, ta));
  }
  view.appendChild(grid);
  return view;
}

/* ---------- method ---------- */
function viewMethod() {
  const view = h('div', { class: 'view' });
  const cw = MODEL.crosswalk;
  const tset = [...new Set(Object.values(cw).flatMap(o => Object.keys(o)))].sort();
  const cwTable = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl matrix-tbl' },
    h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Capability'), tset.map(t => h('th', { title: TOPIC[t] ? TOPIC[t].label : t }, t)), h('th', null, 'Why'))),
    h('tbody', null, DIMS.map(([k, l]) => h('tr', null, h('th', { scope: 'row', class: 'first' }, l), tset.map(t => { const v = cw[k][t]; return h('td', { class: 'e ' + (v ? (v >= 0.5 ? 'p2' : 'p1') : 'z') }, v ? v.toFixed(2) : '·'); }), h('td', { class: 'small dim' }, MODEL.crosswalk_why[k]))))));
  const kjTable = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl matrix-tbl' },
    h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Judgment · p'), DIMS.map(([k, l]) => h('th', { title: l }, CAP_SHORT[k] || l)))),
    h('tbody', null, KJ_IDS.map(kid => h('tr', null, h('th', { scope: 'row', class: 'first' }, h('span', { title: KJ[kid].title }, kid + ' · ' + MODEL.kj_p[kid].p)),
      DIMS.map(([k]) => { const c = (MODEL.kj_e[kid] || {})[k]; const td = h('td', { class: 'e ' + (!c ? 'z' : c.e >= 2 ? 'p2' : c.e > 0 ? 'p1' : c.e <= -2 ? 'n2' : 'n1') }, c ? (c.e > 0 ? '+' : '−') + Math.abs(c.e) : '·'); if (c) tipOn(td, () => frag(h('b', null, kid + ' × ' + capName(k)), h('div', { class: 'tl2' }, c.why))); return td; }))))));
  const sfTable = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl matrix-tbl' },
    h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Scenario · p'), DIMS.map(([k, l]) => h('th', { title: l }, CAP_SHORT[k] || l)))),
    h('tbody', null, SCEN_IDS.map(sid => h('tr', null, h('th', { scope: 'row', class: 'first' }, sid + ' ' + SCEN[sid].name + ' · ' + SCEN[sid].probability + '%'), DIMS.map(([k]) => { const v = (MODEL.scen_f[sid] || {})[k] || 0; return h('td', { class: 'e ' + (v >= 2 ? 'p2' : v ? 'p1' : 'z') }, v ? String(v) : '·'); }))))));
  const defs = [
    ['Capability scores', '0 to 3 per capability, from the agency’s own services, case studies, ads and job posts, each with an evidence note and link (hover the matrix). 3 means the agency leads with it.'],
    ['Horus Tailwind Index', 'For each key judgment KJ: p(KJ) × Σ over capabilities of (capability share of the sold mix × exposure), clamped to ±2 per judgment, summed, then scaled so the most favored single-capability profile (pure AI search or pure measurement, ' + MODEL.pure_net.ai_search + ') equals +100. p is the midpoint of the ICD 203 range for the claim that bears on agencies. KJ6 adds structural terms: holdco ownership −1, outcome or productised pricing +0.5, hourly rates −0.5, a visible junior-to-agent-operator pipeline +0.5. Bands: 35 and up Tailwind, 10 to 35 Favored, −10 to 10 Neutral, −35 to −10 Exposed, below −35 Headwind.'],
    ['Solar Arc clock', 'The sold mix is spread over the edition’s topics through the crosswalk; each topic carries its stage of record (Khepri dawn 06:00, Ra noon 12:00, Atum dusk 18:00, Duat night 24:00). The clock is the weighted mean hour.'],
    ['Nilometer tilt', 'The same topic mix weighted by the edition’s directional momentum (up strongly +2, up +1, flat 0, down −1). Positive means the mix sits on topics the hard signals read as rising.'],
    ['Portfolio Stereopsis', 'The same topic mix weighted by the edition’s Stereopsis z per topic. Negative means the agency sells what the broadcast talks about; positive means it sells what the practitioner floor works on.'],
    ['Scenario fit and resilience', 'Fit = capability share × the scenario fit table (0 to 2), scaled to 100. Resilience = the fits weighted by the edition’s scenario probabilities (40, 30, 15, 15).'],
    ['Money rails', 'Capability-weighted scores for the three rails the edition says the money follows (placement inside AI answers and agents; machine-readable data; human-provenance content) and the losing side, plus 10 points per rail signal evidenced in the agency’s own record.'],
    ['Moves P1 to P8', 'Detected from the agency’s own text: positioning, AI posture, services, proprietary products, capability evidence, ad samples, pricing signals, moves and news. Each detection shows the quoted snippet and its source. Absence of evidence is labelled “not seen”, or “no public evidence” for pricing, which most agencies never publish.'],
    ['Say and do', 'For each sold line with a house test: AI search against llms.txt and AI-crawler blocking; paid search against its own Google ads; paid social against social pixels on its own site; LinkedIn-led selling against its own LinkedIn ads; CRO against testing tools; content and SEO against its own publishing cadence; creators against its own short-form channels. Contradictions follow the radar’s gap scan so both views agree.'],
    ['Agency voice', 'Positioning, AI posture, ad samples, moves, news and case-study titles, coded to the Horus taxonomy with the prefilter’s keyword matchers. These are suggestions, not the hand codes of record; strategy, budgets, agency economics and off-taxonomy topics are excluded.'],
    ['Graveyard flag', 'The agency’s own pitch (positioning, AI posture, services, ads) sells agentic checkout or agentic commerce, the prophecy the edition says shares the cookieless shape.'],
    ['Monsoon index', 'Offshore delivery exposure on a three-year horizon, 0 to 100: the sold mix through a published offshorability table (0 to 3 per capability, weighted by labor intensity), plus structural terms from the agency’s own record (ownership, scale, listed offices and jobs in hub economies, its words on delivery and pricing, client type). Two mechanisms are scored beside it, migration and displacement, and the shore split says where the work would go. Tables, signals and limits are on the Offshore view.']
  ];
  view.append(
    h('section', { class: 'sec' }, sectionHead('Sources and coverage', D.meta.note),
      h('div', { class: 'grid-2' },
        h('div', { class: 'card stack' }, h('h3', null, 'Agency Radar'), h('dl', { class: 'kv' },
          h('dt', null, 'Compiled'), h('dd', null, D.meta.generated), h('dt', null, 'Agencies'), h('dd', null, A.length + ' (' + D.meta.n_deep + ' with deep crawls: case studies, newsroom, blog dates)'),
          h('dt', null, 'Google ads'), h('dd', null, 'Transparency Center; ' + A.filter(a => a.google && a.google.status === 'blocked').length + ' lookups blocked'), h('dt', null, 'LinkedIn ads'), h('dd', null, 'LinkedIn Ad Library; counts are first-page floors'),
          h('dt', null, 'Meta and TikTok'), h('dd', null, 'Not captured: both libraries were unreachable'), h('dt', null, 'Confidence'), h('dd', null, countBy(A, a => a.confidence).map(([k, v]) => k + ' ' + v).join(' · ')))),
        h('div', { class: 'card stack' }, h('h3', null, 'Horus edition'), h('dl', { class: 'kv' },
          h('dt', null, 'Edition'), h('dd', null, ED.stem + ' (' + ED.edition + ')'), h('dt', null, 'Run'), h('dd', null, ED.run_date + ' · ' + ED.collection_mode),
          h('dt', null, 'Windows'), h('dd', null, 'Broadcast ' + ED.window.sun + '; floor ' + ED.window.moon_floor + '; rooms ' + ED.window.rooms),
          h('dt', null, 'Ledger'), h('dd', null, ED.n.sun_counted + ' broadcast and ' + ED.n.moon_counted + ' floor items counted; ' + ED.n.set_flagged + ' Set-filtered; ' + ED.n.rooms + ' rooms'),
          h('dt', null, 'Reliability'), h('dd', null, 'Topic kappa ' + (ED.kappa.topic || {}).kappa + ', intent kappa ' + (ED.kappa.intent || {}).kappa + ' (blind second coder)'),
          h('dt', null, 'Signals'), h('dd', null, ED.signals.length + ' Nilometer readings with Admiralty grades')))),
      h('div', { class: 'callout plain small' }, 'The edition measures what the press and the floor talk about and judges where the industry goes. The per-agency read in this app maps those judgments onto each agency’s evidence-graded capabilities through the published tables below. The tables are analytic judgments; everything after them is arithmetic. Change a table and every read changes with it.')),
    h('section', { class: 'sec' }, sectionHead('Definitions'), h('div', { class: 'card' }, h('dl', { class: 'kv' }, defs.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])))),
    h('section', { class: 'sec' }, sectionHead('Crosswalk: capability to Horus topic', 'Weights sum to 1 per capability. Hover a topic id for its name.'), cwTable),
    h('section', { class: 'sec' }, sectionHead('Key-judgment exposure table', 'Sign and strength (−2 to +2) of each judgment on each capability. Hover a cell for the reasoning.'), kjTable,
      h('div', { class: 'card small' }, h('h4', null, 'Structural terms'), h('ul', null, Object.entries(MODEL.kj_struct_why).map(([k, v]) => h('li', null, v))))),
    h('section', { class: 'sec' }, sectionHead('Scenario fit table', 'How well each capability does in each quadrant (0 to 2).'), sfTable, h('ul', { class: 'small' }, SCEN_IDS.map(sid => h('li', null, h('b', null, sid + ': '), MODEL.scen_why[sid])))),
    h('section', { class: 'sec' }, sectionHead('Detection patterns', 'The exact expressions run over each agency’s own record. A match is shown with its snippet on the dossier.'),
      h('details', { class: 'fold' }, h('summary', null, 'Show the patterns'), h('div', { class: 'fold-body' }, h('dl', { class: 'kv' }, Object.entries(MODEL.patterns).map(([k, v]) => [h('dt', null, k), h('dd', { class: 'mono small' }, v)]))))),
    h('section', { class: 'sec' }, sectionHead('Limits of this layer'),
      h('ul', { class: 'card small', style: { paddingLeft: '32px' } },
        h('li', null, 'Exposure is read from what an agency sells, not from its revenue mix, which no agency here discloses. A small service line and a core line with the same score count the same.'),
        h('li', null, 'Absence of evidence is not evidence of absence. A move marked “not seen” may exist off the public site.'),
        h('li', null, 'Agency voice is keyword-coded and thin for most agencies (median two coded lines); read it per agency as evidence, not as a share.'),
        h('li', null, 'The edition’s own limits carry through: a search-heavy broadcast frame, a small floor sample, Reddit blocked, Discord content unseen.'),
        h('li', null, 'Meta and TikTok ad libraries were not captured, so paid-social say/do rests on pixels, not ads.'),
        h('li', null, 'Stages, probabilities and scenarios are the edition analyst’s judgments. When the next edition scores them, rebuild this layer.'))),
    h('section', { class: 'sec' }, sectionHead('The Targets wing', 'OmegaWeapon runs, hosted whole.'), h('div', { class: 'card small stack' },
      h('p', null, 'A target is one domain read by the OmegaWeapon skill: python3 scripts/omega_run.py <domain> --archetype <id> builds a run manifest and a self-contained dashboard. This app hosts that dashboard unchanged, in an isolated frame running the same engine (assets/omega_dashboard.js) that wrote the standalone page, so the numbers here are the numbers on the page the client sees.'),
      h('p', null, 'The loop: queue domains here (or from the popup and the right-click menu), export the queue, run python3 scripts/omega_platform.py queue --file omega-queue.json --run, then python3 scripts/omega_platform.py pack --cache omega_cache --latest and build-app --pack omega-pack.json to bake the results into a new build; or import a page or a pack straight into this view. Imported targets persist in this browser profile only.'),
      h('p', null, 'The agency of record on every run (footer credit, RDAP registrant, shared tag stack) is matched against the Radar by domain, then by exact name. A match attaches the Radar dossier and the Horus read to the run as observed context and lists the target on the agency\u2019s Omega tab, where the findings tagged inherited are counted across its audited book. The Radar never grades a target and a target never moves a Radar score; the two are joined by identity, not by arithmetic.'))),
    h('section', { class: 'sec' }, sectionHead('Rebuild'), h('div', { class: 'card small stack' },
      h('p', null, 'The Horus layer on each agency is computed by scripts/radar_horus.py from the registry (assets/radar/radar.json) and the edition through the tables above; python3 scripts/radar_horus.py check reports how closely a recompute reproduces the shipped layer (the arithmetic reproduces exactly; the text detections are matched to within a few agencies). Agency voice is coded with horus_prefilter.py\u2019s matchers.'),
      h('p', null, 'On a new Horus edition, a Radar refresh (python3 scripts/omega_platform.py radar-upsert) or new packed targets, run python3 scripts/omega_platform.py build-app and reinstall the extension folder, or reopen the HTML file.'))));
  return view;
}

/* The company dossier */

function viewAgency(id, tab) {
  const a = BYID.get(id);
  const hz = a.horus || {};
  const view = h('div', { class: 'view', style: { gap: '22px' } });
  const back = h('button', { class: 'back', type: 'button', onclick: () => { if (trail.length > 1) history.back(); else go(lastListView); } }, icon('back'), 'Back');
  const cmp = h('button', { class: 'btn', type: 'button' }, icon('plus'), inCompare(id) ? 'In compare' : 'Compare');
  cmp.addEventListener('click', () => { const on = toggleCompare(id); cmp.replaceChildren(icon('plus'), on || inCompare(id) ? 'In compare' : 'Compare'); });
  const acts = h('div', { class: 'acts' }, starBtn(id), cmp,
    h('a', { class: 'btn', href: 'https://' + a.domain + '/', target: '_blank', rel: 'noopener noreferrer' }, icon('open'), 'Visit site'),
    MODE === 'panel' && IS_EXT ? h('button', { class: 'btn', type: 'button', onclick: () => openFull('#a.' + id + '.' + tab) }, 'Open full view') : null,
    MODE === 'panel' ? null : exportButtons(a.id + '.json', () => JSON.stringify(a, null, 1), 'application/json'));
  const emp = a.employees && a.employees.value ? a.employees.value : null;
  view.appendChild(h('div', { class: 'stack' }, MODE === 'panel' ? null : back,
    h('div', { class: 'dossier-head' },
      h('div', null,
        h('div', { class: 'title' }, h('h1', null, a.name), statusPill(a.status), bandTag(hz)),
        h('div', { class: 'meta' },
          h('span', null, ext('https://' + a.domain + '/', a.domain)),
          h('span', null, h('b', null, [a.hq_city, a.hq_country].filter(Boolean).join(', ') || a.region)),
          h('span', null, a.segment || ''), h('span', null, a.archetype || 'Unclassified'),
          h('span', null, (!a.ownership || a.ownership === 'unknown' ? 'Ownership not disclosed' : a.ownership) + (a.owner ? ' · ' + a.owner : '')),
          a.founded ? h('span', null, 'Founded ' + a.founded) : null, emp ? h('span', null, peopleStr(emp)) : null,
          a.icp ? h('span', null, 'Clients: ' + a.icp) : null,
          h('span', null, 'Record confidence: ' + (a.confidence || '–')))),
      acts)));
  const sub = h('nav', { class: 'subrail', 'aria-label': 'Dossier sections' },
    DOSSIER_TABS.map(([k, l]) => h('a', { class: 'tab' + (k === 'horus' ? ' horus' : ''), href: '#a.' + id + (k === 'overview' ? '' : '.' + k), 'aria-current': k === tab ? 'page' : null }, k === 'horus' ? h('span', { class: 'eye-dot' }) : null, l)));
  view.appendChild(sub);
  const body = { overview: dOverview, dossier: dDossier, horus: dHorus, offshore: dOffshore, omega: dOmega, strategy: dStrategy, clients: dClients, paid: dPaid, content: dContent, moves: dMoves, sources: dSources }[tab] || dOverview;
  view.appendChild(body(a));
  return view;
}

function dOverview(a) {
  const hz = a.horus || {};
  const out = h('div', { class: 'stack', style: { gap: '18px' } });
  if (a.status_note) out.appendChild(h('div', { class: 'callout ' + (a.status === 'active' ? 'plain' : 'sun') }, h('b', null, 'Status: '), a.status_note, a.successor ? h('span', null, ' Successor: ' + a.successor + '.') : null));
  if (a.dossier && a.dossier.text) out.appendChild(h('div', { class: 'callout plain' }, h('div', { class: 'eyebrow' }, 'The weighing (Anubis dossier, written ' + a.dossier.text.written + ')'), h('p', { class: 'lede' }, a.dossier.text.bluf), h('p', { class: 'small' }, h('a', { href: '#a.' + a.id + '.dossier' }, 'Open the full dossier'))));
  out.appendChild(horusSummary(a));
  if (a.offshore && a.offshore.ok && typeof monSummary === 'function') out.appendChild(monSummary(a));
  out.appendChild(h('div', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('h3', null, 'Positioning'), h('p', null, a.positioning || '–'), a.headline_claim ? h('p', { class: 'small dim' }, h('b', null, 'Headline claim: '), a.headline_claim) : null,
      h('div', null, h('h4', null, 'Leads with'), h('div', { class: 'chips' }, (a.lead || []).map(k => h('span', { class: 'chip lead' }, capName(k))), (a.core || []).filter(k => !(a.lead || []).includes(k)).map(k => h('span', { class: 'chip' }, capName(k))))),
      a.ai_posture ? h('div', null, h('h4', null, 'AI posture'), h('p', { class: 'small' }, a.ai_posture)) : null,
      a.pricing_signals ? h('div', null, h('h4', null, 'Pricing signals'), h('p', { class: 'small' }, a.pricing_signals)) : null),
    h('div', { class: 'card stack' }, h('h3', null, 'Capability families'),
      barList(Object.entries(a.family_scores || {}).sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ label: k, value: v, display: v.toFixed(2) })), { max: 4, cls: 'ink' }),
      h('p', { class: 'note' }, 'Family scores combine the 0 to 3 capability scores into nine families; the highest names the archetype.'))));
  out.appendChild(h('div', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('h3', null, 'Services'), h('div', { class: 'chips' }, (a.services || []).map(x => h('span', { class: 'chip' }, x))),
      (a.proprietary || []).length ? h('div', null, h('h4', null, 'Proprietary products'), h('ul', { class: 'small' }, a.proprietary.map(x => h('li', null, x)))) : null),
    h('div', { class: 'card stack' }, h('h3', null, 'Markets'),
      h('div', null, h('h4', null, 'Verticals'), h('div', { class: 'chips' }, (a.verticals || []).map(x => h('span', { class: 'chip' }, x)))),
      (a.offices || []).length ? h('div', null, h('h4', null, 'Offices'), h('p', { class: 'small' }, a.offices.join(', '))) : null,
      (a.partners || []).length ? h('div', null, h('h4', null, 'Partners'), h('div', { class: 'chips' }, a.partners.map(x => h('span', { class: 'chip' }, x)))) : null)));
  if ((a.gaps || []).length) out.appendChild(h('div', { class: 'callout' }, h('b', null, 'Gaps on its own house: '), a.gaps.map(g => g.label).join('; ') + '.'));
  return out;
}

function horusSummary(a) {
  const hz = a.horus || {};
  if (!hz.ok) return h('div', { class: 'verdict' }, wedjat('w'), h('div', { class: 'stack' }, h('span', { class: 'eyebrow' }, 'Horus read'), h('p', null, hz.reason || 'No read.'), hz.status_note ? h('p', { class: 'small dim' }, hz.status_note) : null));
  return h('div', { class: 'verdict' }, wedjat('w'),
    h('div', { class: 'stack', style: { gap: '8px' } },
      h('div', { class: 'row' }, h('span', { class: 'eyebrow' }, 'Horus read · edition ' + ED.edition), bandTag(hz), h('span', { class: 'mono small' }, signed(hz.hti) + ' · ' + hz.hti_pct + 'th percentile')),
      h('p', null, hz.verdict),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#a.' + a.id + '.horus' }, 'Open the full Horus read'))));
}

function htiHist(v) {
  const vals = A.filter(a => a.horus && a.horus.ok).map(a => a.horus.hti);
  const lo = -100, hi = 100, step = 10, bins = [];
  for (let x = lo; x < hi; x += step) bins.push({ x, n: vals.filter(q => q >= x && q < x + step).length });
  const max = Math.max(...bins.map(b => b.n));
  const wrap = h('div', { class: 'hist', role: 'img', 'aria-label': 'Distribution of the tailwind index across 209 agencies' });
  for (const b of bins) { const sp = h('span', { class: v >= b.x && v < b.x + step ? 'me' : '' }); sp.style.height = Math.max(2, 100 * b.n / max) + '%'; tipOn(sp, () => tipBody(b.n + ' agencies', signed(b.x) + ' to ' + signed(b.x + step))); wrap.appendChild(sp); }
  return wrap;
}

function arcGauge(hz) {
  // Semicircle sun path: dawn (left) → noon (top) → dusk (right) → night (below the horizon, drawn as the right-hand descent)
  const W = 300, Hh = 172, cx = 150, cy = 146, r = 118;
  const ang = hr => Math.PI * (1 - clamp((hr - 6) / 18, 0, 1)); // 06:00 → 180°, 24:00 → 0°
  const pt = (hr, rr) => [cx + (rr || r) * Math.cos(ang(hr)), cy - (rr || r) * Math.sin(ang(hr))];
  const svg = s('svg', { viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': 'Solar Arc clock ' + hz.arc_clock });
  const segs = [['Khepri', 6, 9, '--st-k'], ['Ra', 9, 15, '--st-r'], ['Atum', 15, 21, '--st-a'], ['Duat', 21, 24, '--st-d']];
  for (const [st, h0, h1, v] of segs) {
    const [x0, y0] = pt(h0), [x1, y1] = pt(h1);
    svg.appendChild(s('path', { d: `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`, fill: 'none', stroke: `var(${v})`, 'stroke-width': '10', 'stroke-linecap': 'butt' }));
  }
  svg.appendChild(s('line', { x1: cx - r - 14, x2: cx + r + 14, y1: cy, y2: cy, stroke: 'var(--rule)', 'stroke-width': '1' }));
  for (const [lbl, hr] of [['06', 6], ['12', 12], ['18', 18], ['24', 24]]) { const [x, y] = pt(hr, r + 18); svg.appendChild(s('text', { x, y: y + 4, 'text-anchor': 'middle' }, lbl)); }
  const [sx, sy] = pt(hz.arc_hour);
  svg.appendChild(s('line', { x1: cx, y1: cy, x2: sx, y2: sy, stroke: 'var(--ink-3)', 'stroke-width': '1' }));
  svg.appendChild(s('circle', { cx: sx, cy: sy, r: '11', fill: 'var(--sun-bar)', stroke: 'var(--surface)', 'stroke-width': '3' }));
  svg.appendChild(s('circle', { cx: sx, cy: sy, r: '4', fill: 'var(--ink)' }));
  const fm = FIELD.arc_mean; const [fx0, fy0] = pt(fm, r + 6), [fx1, fy1] = pt(fm, r - 6);
  svg.appendChild(s('line', { x1: fx0, y1: fy0, x2: fx1, y2: fy1, stroke: 'var(--ink)', 'stroke-width': '2' }));
  return svg;
}

function dHorus(a) {
  const hz = a.horus || {};
  const out = h('div', { class: 'stack', style: { gap: '22px' } });
  out.appendChild(horusSummary(a));
  if (!hz.ok) {
    if (hz.ledger_items && hz.ledger_items.length || hz.nilometer && hz.nilometer.length) out.appendChild(edLinks(hz));
    return out;
  }
  // gauges
  const pctPos = v => (clamp((v + 100) / 200, 0, 1) * 100) + '%';
  const me = h('span', { class: 'me' }); me.style.left = pctPos(hz.hti);
  const med = h('span', { class: 'med' }); med.style.left = pctPos(FIELD.hti_median);
  tipOn(me, () => tipBody(signed(hz.hti), 'Horus Tailwind Index', hz.hti_pct + 'th percentile of 209'));
  out.appendChild(h('div', { class: 'gauge-row' },
    h('div', { class: 'gauge' }, h('h4', null, 'Tailwind index'), h('div', { class: 'big' }, signed(hz.hti), h('small', null, hz.band + ' · ' + hz.hti_pct + 'th pct')),
      h('div', { class: 'htitrack' }, h('span', { class: 'ax' }), med, me), h('div', { class: 'htiscale' }, h('span', null, '−100'), h('span', null, 'field median ' + signed(FIELD.hti_median)), h('span', null, '+100')),
      htiHist(hz.hti),
      h('p', { class: 'note' }, 'Net of the eleven key judgments on this sold mix, probability-weighted. Bars: the 209 agencies read, in bins of 10; dark bar holds this agency.')),
    h('div', { class: 'gauge' }, h('h4', null, 'Solar Arc clock'), h('div', { class: 'arc-wrap' }, arcGauge(hz), h('div', { class: 'clock' }, hz.arc_clock, h('small', null, hz.arc_word)), h('div', { class: 'note' }, 'Tick on the arc: field mean ' + hourStr(FIELD.arc_mean))),
      stageStack(hz.stage_mix), stageLegend()),
    h('div', { class: 'gauge' }, h('h4', null, 'Scenario fit'), h('div', { class: 'big' }, Math.round(hz.resilience), h('small', null, 'resilience')),
      barList(SCEN_IDS.map(sid => ({ label: sid + ' ' + SCEN[sid].name.replace(/^The /, ''), value: hz.scen_fit[sid], display: Math.round(hz.scen_fit[sid]) + ' · p' + SCEN[sid].probability, cls: sid === hz.scen_best ? 'sun' : 'ink' })), { max: 100 }),
      h('p', { class: 'note' }, 'Best fit ' + SCEN[hz.scen_best].name + '; weakest ' + SCEN[hz.scen_worst].name + '.'))));

  // key judgments
  const kjCard2 = h('div', { class: 'card' });
  const maxNet = KJ_MAX;
  const rows = KJ_IDS.map(k => ({ k, v: hz.kj[k] })).sort((x, y) => Math.abs(y.v.net) - Math.abs(x.v.net));
  for (const { k, v } of rows) {
    const kj = KJ[k];
    const detail = h('div', { class: 'kjdetail', hidden: true });
    const btn = h('button', { class: 'x', type: 'button', 'aria-expanded': 'false' }, h('span', { class: 'tt' }, kj.title), h('small', null, probWord(kj) + ' · ' + kj.horizon));
    btn.addEventListener('click', () => {
      const open = detail.hidden; detail.hidden = !open; btn.setAttribute('aria-expanded', String(open));
      if (open && !detail.childNodes.length) {
        const drv = (v.d || []).map(([cap, e, c]) => h('li', null, capName(cap) + ' ', h('span', { class: 'mono small' }, '(' + (e > 0 ? '+' : '−') + Math.abs(e) + ' × share ' + (strat(a, cap) != null ? pct(c / e) : '–') + ' = ' + (c >= 0 ? '+' : '') + c.toFixed(2) + ')'), ' ', h('span', { class: 'dim small' }, ((MODEL.kj_e[k] || {})[cap] || {}).why || '')));
        const st = (v.s || []).map(([key, c]) => h('li', null, (c > 0 ? '+' : '−') + Math.abs(c) + ' ', h('span', { class: 'dim small' }, MODEL.kj_struct_why[key] || key)));
        detail.append(h('p', null, kj.judgment),
          drv.length || st.length ? h('div', null, h('h4', null, 'How it lands here'), h('ul', { class: 'small' }, drv, st), h('p', { class: 'note' }, 'Raw ' + v.raw.toFixed(2) + ' × p ' + MODEL.kj_p[k].p + ' = net ' + v.net.toFixed(2) + '.')) : h('p', { class: 'muted small' }, 'No capability of this agency is exposed to this judgment.'),
          h('div', null, h('h4', null, 'Would change the call'), h('ul', { class: 'small' }, kj.falsifiers.map(f => h('li', null, f)))),
          h('div', null, h('h4', null, 'Evidence'), h('div', { class: 'refs' }, kj.evidence.map(refChip))));
      }
    });
    kjCard2.appendChild(h('div', { class: 'kjrow' }, h('span', { class: 'id' }, k), h('div', { class: 't' }, btn), h('div', { class: 'dv' }, divBar(v.net, maxNet, k + ' net ' + v.net)), h('span', { class: 'n' }, (v.net > 0 ? '+' : '') + v.net.toFixed(2)), detail));
  }
  out.appendChild(h('section', { class: 'sec' }, sectionHead('Exposure to the key judgments', 'Right is tailwind, left is headwind; the number is the probability-weighted net. Open a judgment to see which capabilities drive it and what would change the call.'),
    h('div', { class: 'legend' }, h('span', { class: 'key' }, h('i', { class: 'pos' }), 'Tailwind'), h('span', { class: 'key' }, h('i', { class: 'neg' }), 'Headwind')), kjCard2));

  // moves
  const mvWrap = h('div', { class: 'moves' });
  for (const pid of IMPL_IDS) {
    const m = hz.moves[pid]; const p = IMPL[pid];
    mvWrap.appendChild(h('div', { class: 'mv' }, h('span', { class: 'pid' }, pid),
      h('div', null, h('div', { class: 'mt' }, p.move), h('div', { class: 'why' }, m.why),
        m.ev && m.ev.length ? h('div', { class: 'ev' }, m.ev.map(e => h('div', null, h('b', null, MODEL.field_name[e.f] || e.f), '“' + e.t + '” ', e.u ? ext(e.u, 'source') : null))) : null,
        h('div', { class: 'note', style: { marginTop: '4px' } }, 'Edition: ' + p.detail + ' Justified by ', p.kj.map((k, i) => [i ? ', ' : '', refChip(k)]))),
      h('span', { class: 'stc st-' + m.s }, MOVE_LABEL[m.s])));
  }
  out.appendChild(h('section', { class: 'sec' }, sectionHead('The moves', hz.moves_score.making + ' of ' + hz.moves_score.applicable + ' applicable moves being made, ' + hz.moves_score.partial + ' partial. Each status quotes the evidence found on the agency’s own record.'), mvWrap));

  // say / do + rails
  const sd = h('div', { class: 'saydo' });
  if (hz.house.tests.length) for (const t of hz.house.tests) sd.appendChild(h('div', { class: 'sd' }, h('span', { class: 'ic ' + t.do, 'aria-label': t.do }, t.do === 'corroborated' ? '✓' : t.do === 'contradicted' ? '✕' : '?'), h('span', null, h('b', null, capName(t.cap))), h('span', { class: 'nt small dim' }, t.note)));
  else sd.appendChild(h('p', { class: 'muted small' }, 'No sold line at depth has a house test.'));
  out.appendChild(h('div', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Say and do'), h('span', { class: 'muted small' }, hz.house.tested ? hz.house.corroborated + ' of ' + hz.house.tested + ' practised' : 'not tested')),
      h('p', { class: 'small dim' }, 'Sun eye: what it sells. Moon eye: what its own house does.'), sd),
    h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Money rails'), h('span', { class: 'muted small' }, 'field mean in brackets')),
      RAIL_IDS.map(rid => meter(MODEL.rails[rid].label + ' (' + Math.round(FIELD.rails_mean[rid]) + ')', hz.rails[rid].score, rid === 'L' ? 'neg' : 'pos', hz.rails[rid].ev.length ? 'Evidence: ' + hz.rails[rid].ev.join(', ').replace(/_/g, ' ') : null)))));

  // portfolio on the Horus map
  const tm = Object.entries(hz.topic_mix).slice(0, 10);
  out.appendChild(h('section', { class: 'sec' }, sectionHead('Where the sold mix sits on the Horus map', 'Nilometer tilt ' + (hz.tilt >= 0 ? '+' : '') + hz.tilt.toFixed(2) + ' (field ' + (FIELD.tilt_mean >= 0 ? '+' : '') + FIELD.tilt_mean + '): ' + (hz.tilt > FIELD.tilt_mean ? 'more of the mix sits on topics the hard signals read as rising than the field average.' : 'less of the mix sits on rising topics than the field average.') + ' Portfolio Stereopsis ' + (hz.stereo >= 0 ? '+' : '') + hz.stereo.toFixed(2) + ': ' + (hz.stereo < -0.3 ? 'sells what the broadcast talks about more than what the floor works on.' : hz.stereo > 0.3 ? 'sells what the practitioner floor works on more than what the broadcast talks about.' : 'balanced between the broadcast agenda and the floor.')),
    sortableTable([
      { key: 't', label: 'Topic', first: true, render: r => h('button', { class: 'ref body', type: 'button', onclick: () => openRef('metrics:' + r[0]) }, r[0] + ' ' + (TOPIC[r[0]] ? TOPIC[r[0]].label : '')) },
      { key: 'w', label: 'Share of mix', num: true, sort: r => r[1], render: r => pct(r[1]) },
      { key: 'st', label: 'Stage', render: r => TOPIC[r[0]] ? stageTag(TOPIC[r[0]].stage) : '' },
      { key: 'm', label: 'Nilometer', render: r => TOPIC[r[0]] ? momTag(TOPIC[r[0]].momentum) : '' },
      { key: 'z', label: 'Stereopsis', render: r => TOPIC[r[0]] ? h('span', { class: 'small' }, TOPIC[r[0]].stereo_class + ' (z ' + TOPIC[r[0]].stereo_z + ')') : '' }
    ], tm, { sortKey: 'w', dir: -1 })));

  // voice
  const v = hz.voice || {};
  if (v.n) {
    const top = Object.entries(v.counts).slice(0, 6);
    out.appendChild(h('section', { class: 'sec' }, sectionHead('What it says about itself', v.n + ' lines from its positioning, ads, moves, news and case studies, keyword-coded to the Horus taxonomy (suggestions, not hand codes).' + (v.n < 8 ? ' Too few lines for a share; read them as evidence.' : '')),
      h('div', { class: 'card stack' },
        v.n >= 8 ? h('div', { class: 'chips' }, top.map(([t, c]) => h('span', { class: 'chip' }, t + ' ' + (TOPIC[t] ? TOPIC[t].short : ''), h('span', { class: 'cn' }, ' ' + pct(c / v.n) + ' vs press ' + pct((TOPIC[t] || {}).sun_share || 0))))) : null,
        h('div', { class: 'voice' }, v.lines.map(l => h('div', { class: 'vl' }, h('button', { class: 'ref', type: 'button', onclick: () => openRef('metrics:' + l.topic), title: TOPIC[l.topic] ? TOPIC[l.topic].label : '' }, l.topic), h('span', null, h('span', { class: 'muted small' }, (MODEL.field_name[l.f] || l.f) + (l.d ? ' · ' + l.d : '') + ' · '), l.t, ' ', l.u ? ext(l.u, 'source') : null)))))));
  }

  // watch, graveyard, edition links
  const w = hz.watch || [];
  out.appendChild(h('div', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('h3', null, 'What to watch for this agency'),
      w.length ? h('div', { class: 'timeline' }, w.map(x => { const ind = IND[x.id]; return h('div', { class: 'tl watch' }, h('span', { class: 'd' }, ind.next), h('span', { class: 'ty' }, refChip(x.id)), h('div', { class: 'small' }, h('b', null, ind.indicator + '. '), ind.watch, ' ', h('span', { class: 'muted' }, '(' + x.kj + ')'))); })) : h('p', { class: 'muted small' }, 'No indicator tied to its exposures.')),
    h('div', { class: 'stack' },
      hz.graveyard && hz.graveyard.length ? h('div', { class: 'callout sun' }, h('b', null, 'Graveyard flag. '), 'Its own pitch sells agentic commerce: “' + hz.graveyard[0].t + '”. ', ED.graveyard_test) : null,
      edLinks(hz),
      h('div', { class: 'card small stack' }, h('h4', null, 'Confidence in this read'),
        h('p', null, 'Radar record confidence: ' + (a.confidence || '–') + (a.is_deep ? '; deep crawl (case studies, newsroom, blog dates).' : '; standard crawl.') + ' The read is derived from capability scores through the published tables (Method), so it inherits their judgment calls.'),
        hz.status_note ? h('p', { class: 'dim' }, hz.status_note) : null))));
  return out;
}

function edLinks(hz) {
  const items = hz.ledger_items || [], nil = hz.nilometer || [];
  if (!items.length && !nil.length) return h('div', { class: 'card small stack' }, h('h4', null, 'In the Horus edition'), h('p', { class: 'muted' }, 'Not named in the edition’s ledger or Nilometer.'));
  return h('div', { class: 'card stack' }, h('h4', null, 'In the Horus edition'),
    items.length ? h('div', { class: 'small' }, h('p', { class: 'dim' }, 'Ledger items from its own domain or about its parent (the agency as a broadcast source):'), h('ul', null, items.map(i => ITEM[i] ? h('li', null, refChip(i), ' ', ITEM[i].title, ' ', h('span', { class: 'muted' }, '(' + ITEM[i].date + ', ' + ITEM[i].topic + ')')) : null))) : null,
    nil.length ? h('div', { class: 'small' }, h('p', { class: 'dim' }, 'Nilometer readings about it or its parent:'), h('ul', null, nil.map(n => SIG[n] ? h('li', null, refChip(n), ' ', SIG[n].metric + ': ' + SIG[n].value) : null))) : null);
}

function dStrategy(a) {
  const out = h('div', { class: 'stack', style: { gap: '18px' } });
  if (!a.strategy) { out.appendChild(h('div', { class: 'empty' }, 'No capability scores in the record for this brand.')); return out; }
  const means = Object.fromEntries(DIM_KEYS.map(k => [k, mean(A.filter(x => x.strategy).map(x => x.strategy[k]))]));
  const rows = DIMS.map(([k, l]) => ({ k, l, v: a.strategy[k], ev: (a.strategy_evidence || {})[k] })).sort((x, y) => (y.v || 0) - (x.v || 0));
  out.appendChild(h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Capabilities'), h('span', { class: 'muted small' }, 'bar = score 0 to 3 · tick = field mean')),
    h('div', { class: 'stack', style: { gap: '12px' } }, rows.map(r => {
      const f = h('span', { class: 'fill' }); f.style.width = (100 * (r.v || 0) / 3) + '%';
      const t = h('span', { class: 'tick' }); t.style.left = (100 * means[r.k] / 3) + '%';
      return h('div', { class: 'stack', style: { gap: '4px' } },
        h('div', { class: 'bar-row' }, h('span', { class: 'lbl' }, h('b', null, r.l)), h('div', { class: 'track base' }, f, t), h('span', { class: 'v' }, (r.v ?? '–') + ' / 3')),
        r.ev ? h('p', { class: 'small dim' }, r.ev.note, ' ', r.ev.url ? ext(r.ev.url, 'evidence') : null) : null);
    }))));
  out.appendChild(h('div', { class: 'card small' }, h('b', null, 'Breadth ' + (a.breadth ?? '–') + ' of 15'), ' capabilities at score 2 or more. Core: ', (a.core || []).map(capName).join(', ') || '–', '.'));
  return out;
}

function dClients(a) {
  const out = h('div', { class: 'stack', style: { gap: '14px' } });
  const cl = a.clients || [];
  if (!cl.length) { out.appendChild(h('div', { class: 'empty' }, 'No published clients found on its site.')); return out; }
  const shared = cl.map(c => { const e = CLIENT_INDEX.get(String(c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()); return { c, others: e ? e.agencies.filter(x => x.id !== a.id) : [] }; });
  out.appendChild(sortableTable([
    { key: 'n', label: 'Client', first: true, sort: r => r.c.name.toLowerCase(), render: r => h('b', null, r.c.name) },
    { key: 'e', label: 'Evidence', sort: r => r.c.evidence || '', render: r => r.c.url ? ext(r.c.url, r.c.evidence || 'source') : (r.c.evidence || '–') },
    { key: 'o', label: 'Also shown by', sort: r => r.others.length, render: r => h('div', { class: 'chips' }, r.others.map(x => h('a', { class: 'chip', href: '#a.' + x.id + '.clients' }, BYID.get(x.id).name))) }
  ], shared, { sortKey: 'o', dir: -1 }));
  const dp = a.deep || {};
  if ((dp.case_studies || []).length) out.appendChild(h('details', { class: 'fold' }, h('summary', null, 'Case studies (' + (dp.case_study_count || dp.case_studies.length) + ')'),
    h('div', { class: 'fold-body' }, h('ul', { class: 'small' }, dp.case_studies.map(c => h('li', null, ext(c.url, c.title), c.lastmod ? h('span', { class: 'muted' }, ' · ' + c.lastmod) : null))))));
  return out;
}

function dPaid(a) {
  const out = h('div', { class: 'grid-2' });
  const g = a.google || {}, l = a.linkedin || {};
  out.appendChild(h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'Google Ads'), statusPillPaid(g.status)),
    h('dl', { class: 'kv' },
      h('dt', null, 'Ads in library'), h('dd', null, fmt(g.count) + (g.own_count != null ? ' (' + fmt(g.own_count) + ' its own)' : '')),
      h('dt', null, 'Last 30 days'), h('dd', null, fmt(g.count_30d)),
      h('dt', null, 'Formats'), h('dd', null, g.format_counts ? Object.entries(g.format_counts).map(([k, v]) => k + ' ' + v).join(' · ') : '–'),
      h('dt', null, 'Video share'), h('dd', null, a.google_video_share != null ? pct(a.google_video_share) : '–'),
      h('dt', null, 'Advertiser names'), h('dd', null, (g.advertisers || []).join('; ') || '–'),
      h('dt', null, 'Date range'), h('dd', null, g.date_range || '–'), h('dt', null, 'Last shown'), h('dd', null, g.last_shown || '–')),
    (g.samples || []).map(t => h('div', { class: 'ad' }, t)), g.query_url ? ext(g.query_url, 'Open the Transparency Center') : null));
  out.appendChild(h('div', { class: 'card stack' }, h('div', { class: 'card-h' }, h('h3', null, 'LinkedIn Ads'), statusPillPaid(l.status)),
    h('dl', { class: 'kv' },
      h('dt', null, 'Company ads'), h('dd', null, fmt(l.company_ads)), h('dt', null, 'Thought-leader ads'), h('dd', null, fmt(l.thought_leader_ads)),
      h('dt', null, 'Formats'), h('dd', null, l.format_counts ? Object.entries(l.format_counts).map(([k, v]) => k + ' ' + v).join(' · ') : '–'),
      h('dt', null, 'Count note'), h('dd', { class: 'small' }, l.count_note || '–')),
    (l.samples || []).map(t => h('div', { class: 'ad' }, t)), l.query_url ? ext(l.query_url, 'Open the LinkedIn Ad Library') : null));
  const sl = a.social_links || {};
  out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Owned social'), h('dl', { class: 'kv' }, Object.entries(sl).map(([k, v]) => [h('dt', null, k), h('dd', null, (v || []).slice(0, 2).map((u, i) => [i ? ' · ' : '', ext(u, shortUrl(u))]))])),
    h('p', { class: 'note' }, 'Meta and TikTok ad libraries were unreachable in the sweep, so paid social on those platforms is not captured.')));
  out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Tracking on its own site'),
    h('dl', { class: 'kv' },
      h('dt', null, 'Social ad pixels'), h('dd', null, (a.pixels_social || []).join(', ') || 'none detected'),
      h('dt', null, 'ABM stack'), h('dd', null, (a.abm_stack || []).join(', ') || 'none detected'),
      h('dt', null, 'Testing tools'), h('dd', null, (a.test_tools || []).join(', ') || 'none detected'),
      h('dt', null, 'All tags'), h('dd', null, h('div', { class: 'chips' }, (a.tags || []).map(t => h('span', { class: 'chip' }, t)))))));
  return out;
}
function shortUrl(u) { try { const p = new URL(u); return p.hostname.replace(/^www\./, '') + p.pathname.replace(/\/$/, ''); } catch (e) { return String(u); } }
function statusPillPaid(st) { const m = { active: 'ok', none: 'bad', blocked: 'warn', not_found: 'off' }; return h('span', { class: 'pill ' + (m[st] || 'off') }, st || 'not run'); }

function dContent(a) {
  const out = h('div', { class: 'grid-2' });
  const dp = a.deep || {};
  out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Publishing and AI readiness'), h('dl', { class: 'kv' },
    h('dt', null, 'Sitemap URLs'), h('dd', null, fmt(a.sitemap_urls)),
    h('dt', null, 'Updated in 90 days'), h('dd', null, fmt(a.content_90d)), h('dt', null, 'Updated in 365 days'), h('dd', null, fmt(a.content_365d)),
    h('dt', null, 'AI-topic URLs'), h('dd', null, fmt(a.ai_urls)),
    h('dt', null, 'llms.txt'), h('dd', null, a.llms_txt === true ? 'Published' : a.llms_txt === false ? 'Not published' : 'Not checked'),
    h('dt', null, 'AI crawlers blocked'), h('dd', null, (a.ai_bots_blocked || []).join(', ') || 'none'),
    h('dt', null, 'CMS'), h('dd', null, (a.cms || []).join(', ') || '–')),
    a.ai_posture ? h('p', { class: 'small' }, h('b', null, 'AI posture: '), a.ai_posture) : null));
  const blog = (dp.blog_recent_dates || []);
  out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Recent blog and resource URLs'),
    blog.length ? h('div', { class: 'timeline' }, blog.slice(0, 30).map(b => h('div', { class: 'tl', style: { gridTemplateColumns: '90px minmax(0,1fr)' } }, h('span', { class: 'd' }, b[1]), h('span', { class: 'small', style: { overflowWrap: 'anywhere' } }, b[0])))) : h('p', { class: 'muted small' }, a.is_deep ? 'No dated blog URLs in the sitemap.' : 'Blog dates are captured for the 40 deep-crawled agencies only.')));
  return out;
}

function dMoves(a) {
  const out = h('div', { class: 'stack', style: { gap: '16px' } });
  const mv = (a.moves || []).slice().sort((x, y) => dateKey(y.date).localeCompare(dateKey(x.date)));
  out.appendChild(h('div', { class: 'card' }, h('h3', null, 'Moves'), mv.length ? h('div', { class: 'timeline' }, mv.map(m => h('div', { class: 'tl' }, h('span', { class: 'd' }, m.date || '–'), h('span', { class: 'ty' }, h('span', { class: 'chip' }, m.type || 'other')), h('div', null, m.note, ' ', m.url ? ext(m.url, 'source') : null)))) : h('p', { class: 'muted' }, 'No moves recorded.')));
  const dp = a.deep || {};
  if ((dp.news || []).length) out.appendChild(h('div', { class: 'card' }, h('h3', null, 'Newsroom'), h('div', { class: 'timeline' }, dp.news.map(n => h('div', { class: 'tl', style: { gridTemplateColumns: '90px minmax(0,1fr)' } }, h('span', { class: 'd' }, n.date || '–'), h('div', null, ext(n.url, n.title), n.excerpt ? h('p', { class: 'small dim' }, n.excerpt.slice(0, 240) + (n.excerpt.length > 240 ? '…' : '')) : null))))));
  if ((dp.jobs || []).length) out.appendChild(h('div', { class: 'card' }, h('h3', null, 'Open roles (' + dp.jobs_count + ')'), h('ul', { class: 'small' }, dp.jobs.map(j => h('li', null, typeof j === 'string' ? j : [j.title, j.location].filter(Boolean).join(' · '))))));
  return out;
}

function dSources(a) {
  const out = h('div', { class: 'grid-2' });
  out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Sources'), h('ul', { class: 'small' }, (a.sources || []).map(u => h('li', null, ext(u, u))))));
  out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Prominence signals'), h('p', { class: 'small' }, 'Index ' + (a.prominence != null ? a.prominence.toFixed(2) : '–') + ' of 1.'),
    h('ul', { class: 'small' }, (a.prominence_signals || []).map(p => h('li', null, p.note, ' ', p.url ? ext(p.url, 'source') : null)))));
  return out;
}

/* Shell, render loop, extension hooks */

const trail = [];
/* ========== Anubis: the deep dossier on every agency ==========
   The spine is computed by scripts/radar_dossier.py from the registry; the narrative is written from the spine alone
   (references/anubis.md) and validated against the record before it is merged. Both live in the registry. */
const NEED_TAX = (D.needs && D.needs.taxonomy) || {};
function needChip(code) { const t = NEED_TAX[code] || {}; return h('span', { class: 'chip' + (code === 'N0' ? '' : ' lead'), title: t.why || code }, t.short || code); }
function paras(text) { return String(text || '').split(/\n\s*\n/).filter(x => x.trim()).map(x => h('p', null, x.trim())); }
function dossierMarkdown(a) {
  const sp = (a.dossier || {}).spine || {}, tx = (a.dossier || {}).text || null, id = sp.identity || {};
  const L = [];
  L.push('# ' + a.name + ': the weighing', '', [id.domain, id.hq || id.region, id.segment, id.archetype, id.ownership && id.ownership !== 'unknown' ? id.ownership + (id.owner ? ' (' + id.owner + ')' : '') : 'ownership not disclosed', id.founded ? 'founded ' + id.founded : null, id.employees ? peopleStr(id.employees) : null, 'clients: ' + (id.icp || 'n/a')].filter(Boolean).join(' · '), '');
  if (sp.horus) L.push('Horus: ' + sp.horus.band + ' ' + signed(sp.horus.hti) + ' · ' + (sp.monsoon ? 'Monsoon: ' + sp.monsoon.band + ' ' + Math.round(sp.monsoon.index) : '') + ' · compiled ' + sp.compiled, '');
  if (tx) {
    const st = tx.stale && tx.stale.kind === 'counts' ? tx.stale.now || {} : null;
    L.push('_Narrative written ' + tx.written + (tx.model ? ' by ' + modelName(tx.model) : '') + (tx.revised ? '; ' + (tx.revised.sections || []).join(', ') + ' revised ' + tx.revised.date + ' by ' + modelName(tx.revised.model) : '') + '._', '');
    L.push('## The weighing', '', tx.bluf, '', '## What it is doing and focusing on', '', tx.doing, '', '## Its clients and their needs', '', st ? '> Counts superseded: the client evidence was re-read after this weighing was written. The record now holds ' + st.n + ' clients, ' + st.observed + ' with an observed need and ' + st.named_only + ' names only; the table below is the figure of record.' : null, st ? '' : null, tx.clients, '');
  }
  const cl = (sp.needs || {}).clients || [];
  if (cl.length) { L.push('| Client | Evidence | Need read | Signal |', '|---|---|---|---|'); for (const c of cl) L.push('| [' + c.name + '](' + c.url + ') | ' + c.evidence + ' | ' + c.needs.map(n => (NEED_TAX[n] || {}).short || n).join(', ') + ' | ' + String(c.signal || '').replace(/\|/g, '/').slice(0, 90) + ' |'); L.push(''); }
  if (tx) L.push('## Its own house', '', tx.house, '', '## The market read', '', tx.market, '', '## Where it can be beaten', '', tx.openings, '');
  if ((sp.openings || []).length) { L.push('Computed openings:', ''); for (const o of sp.openings) L.push('- ' + o.text + ' (' + o.class + ')'); L.push(''); }
  if (tx && tx.watch) { L.push('## Watch', ''); for (const w of tx.watch) L.push('- ' + w); L.push(''); }
  if ((sp.moves || []).length) { L.push('## Moves on the record', ''); for (const m of sp.moves.slice(0, 12)) L.push('- ' + (m.date || 'undated') + ': ' + m.note + (m.url ? ' (' + m.url + ')' : '')); L.push(''); }
  if ((sp.evidence || []).length) { L.push('## Evidence', ''); for (const e of sp.evidence.slice(0, 40)) L.push('- ' + e.label + ': ' + e.url); L.push(''); }
  L.push('Written ' + (tx ? tx.written : 'not yet') + ' from the Agency Radar record compiled ' + sp.compiled + '. Public sources only; inferred lines say so. Nothing here is a guarantee of any outcome.');
  return L.filter(x => x !== null && x !== undefined).join('\n');
}
const MODEL_NAMES = { 'claude-fable-5-1': 'Fable 5.1', 'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-mythos-5-1': 'Mythos 5.1' };
function modelName(m) { return MODEL_NAMES[m] || m || ''; }

function staleNote(tx) {
  const st = tx && tx.stale;
  if (!st || st.kind !== 'counts') return null;
  const now = st.now || {};
  return h('div', { class: 'callout sun' }, h('div', { class: 'eyebrow' }, 'Counts superseded'),
    h('p', { class: 'small' }, 'The client evidence was re-read after this weighing was written. The record now holds ' + now.n + ' clients, ' + now.observed + ' with an observed need and ' + now.named_only + ' names only; the tables on this tab are the figures of record, and the paragraphs below are queued for a refresh.'));
}

function dDossier(a) {
  const sp = (a.dossier || {}).spine || null, tx = (a.dossier || {}).text || null;
  const out = h('div', { class: 'stack', style: { gap: '20px' } });
  if (!sp) { out.appendChild(h('div', { class: 'empty' }, 'No dossier spine in this build. Run python3 scripts/radar_dossier.py spine --write and build the app again.')); return out; }
  const id = sp.identity || {}, nd = sp.needs || {}, hz = sp.horus, mo = sp.monsoon;
  const acts = h('div', { class: 'row' }, exportButtons(a.id + '-dossier.md', () => dossierMarkdown(a), 'text/markdown'), h('span', { class: 'small dim' }, (tx ? 'Narrative written ' + tx.written + (tx.model ? ' by ' + modelName(tx.model) : '') + (tx.revised ? '; ' + (tx.revised.sections || []).join(', ') + ' revised ' + tx.revised.date + ' by ' + modelName(tx.revised.model) : '') : 'Narrative not yet written: the spine below is computed; run the Anubis pass (references/anubis.md) to add the written weighing') + ' · spine from the Radar compiled ' + sp.compiled));
  out.appendChild(acts);
  if (tx) out.appendChild(h('div', { class: 'verdict' }, wedjat('w'), h('div', { class: 'stack', style: { gap: '8px' } }, h('span', { class: 'eyebrow' }, 'The weighing'), h('p', { class: 'lede' }, tx.bluf))));
  // identity strip
  out.appendChild(h('div', { class: 'card' }, h('dl', { class: 'kv' },
    h('dt', null, 'Standing'), h('dd', null, [id.segment, id.archetype, id.status, id.confidence ? 'record confidence ' + id.confidence : null].filter(Boolean).join(' · ')),
    h('dt', null, 'Ownership'), h('dd', null, (id.ownership && id.ownership !== 'unknown' ? id.ownership : 'not disclosed') + (id.owner ? ' · ' + id.owner : '') + (id.founded ? ' · founded ' + id.founded : '') + (id.employees ? ' · ' + peopleStr(id.employees) : '')),
    h('dt', null, 'Markets'), h('dd', null, [id.hq || id.region, (id.offices || []).length ? (id.offices.length + ' office locations listed') : 'no offices listed', 'clients: ' + (id.icp || 'n/a')].join(' · ')),
    h('dt', null, 'Leads with'), h('dd', null, (sp.lead || []).join(', ') || '–', h('span', { class: 'dim' }, (sp.core || []).length ? ' · core: ' + sp.core.join(', ') : '')),
    id.partners && id.partners.length ? [h('dt', null, 'Partners'), h('dd', null, id.partners.join(', '))] : null,
    (sp.positioning || {}).proprietary && sp.positioning.proprietary.length ? [h('dt', null, 'Proprietary'), h('dd', null, sp.positioning.proprietary.join('; '))] : null,
    id.prominence_signals && id.prominence_signals.length ? [h('dt', null, 'Prominence'), h('dd', null, id.prominence_signals.slice(0, 3).map((p, i) => h('span', null, i ? ' · ' : '', p.note, ' ', ext(p.url, 'source'))))] : null)));
  const section = (title, aside, body) => h('section', { class: 'sec' }, sectionHead(title, aside), body);
  // doing
  const focusTbl = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Capability'), h('th', { class: 'num' }, 'Score'), h('th', null, 'Evidence'), h('th', null, 'Source'))),
    h('tbody', null, (sp.focus || []).filter(f => f.score).map(f => h('tr', null, h('td', { class: 'first' }, f.label, f.lead ? h('span', { class: 'chip lead', style: { marginLeft: '6px' } }, 'leads') : null), h('td', { class: 'num' }, String(f.score)), h('td', { class: 'wrap small' }, f.note || h('span', { class: 'dim' }, 'no evidence note')), h('td', null, f.url ? ext(f.url, hostOf(f.url)) : ''))))));
  out.appendChild(section('What it is doing and focusing on', (sp.positioning || {}).positioning || null, h('div', { class: 'stack' }, tx ? h('div', { class: 'card dprose' }, paras(tx.doing)) : null,
    h('div', { class: 'card stack' }, h('h4', null, 'The sold mix with its evidence'), focusTbl),
    (sp.moves || []).length ? h('div', { class: 'card stack' }, h('h4', null, 'Moves on the record'), h('div', { class: 'timeline' }, sp.moves.slice(0, 12).map(m => h('div', { class: 'tl' }, h('span', { class: 'd' }, m.date || 'undated'), h('span', { class: 'ty' }, h('span', { class: 'chip' }, m.type || 'move')), h('span', { class: 'note' }, m.note, ' ', m.url ? ext(m.url, 'source') : null))))) : null,
    (sp.case_studies || []).length ? h('div', { class: 'card stack' }, h('h4', null, 'Case studies the sitemap dates'), h('ul', { class: 'small' }, sp.case_studies.slice(0, 15).map(c => h('li', null, ext(c.url, c.title || c.url), c.lastmod ? h('span', { class: 'dim' }, ' · ' + c.lastmod) : null)))) : null)));
  // clients and needs
  const clientsTbl = (nd.clients || []).length ? sortableTable([
    { key: 'name', label: 'Client', first: true, sort: r => r.name, render: r => ext(r.url, r.name) },
    { key: 'ev', label: 'Evidence', sort: r => r.evidence, render: r => r.evidence },
    { key: 'need', label: 'Need read', render: r => h('div', { class: 'chips' }, r.needs.map(needChip)) },
    { key: 'sig', label: 'Signal', cls: 'wrap small', render: r => r.signal || h('span', { class: 'dim' }, 'name only') },
    { key: 'shared', label: 'Also with', cls: 'wrap small', render: r => { const s = (nd.shared || []).find(x => x.name === r.name); return s ? h('span', null, s.agencies.map((g, i) => [i ? ', ' : '', BYID.has(g) ? h('a', { href: '#a.' + g + '.dossier' }, BYID.get(g).name) : g])) : ''; } }
  ], nd.clients, { sortKey: 'ev', dir: 1, limit: 25 }) : h('div', { class: 'empty' }, 'No clients on the record.');
  out.appendChild(section('Its clients and their needs', (nd.n || 0) + ' clients on record · ' + (nd.observed || 0) + ' with engagement evidence · ' + (nd.named_only || 0) + ' names only', h('div', { class: 'stack' }, staleNote(tx), tx ? h('div', { class: 'card dprose' }, paras(tx.clients)) : null,
    h('div', { class: 'grid-2' },
      h('div', { class: 'card stack' }, h('h4', null, 'What the book buys (evidence weighted)'), (nd.mix || []).length ? barList(nd.mix.map(m => ({ label: m.label, value: m.share, display: pct(m.share) + ' · ' + m.n, cls: 'moon' })), { max: 1 }) : h('p', { class: 'small dim' }, 'No engagement evidence: the need is inferred from the sold mix (' + (sp.lead || []).join(', ') + ').'), h('p', { class: 'note' }, 'Need codes read from case study titles, URL slugs and press releases with the taxonomy in assets/radar/needs.json; a name with no described work is N0 and counts for nothing here.')),
      h('div', { class: 'card stack' }, h('h4', null, 'Clients that shop'), (nd.shared || []).length ? h('div', { class: 'chips' }, nd.shared.slice(0, 15).map(s => h('span', { class: 'chip', title: 'also with ' + s.agencies.join(', ') }, s.name + ' (' + s.agencies.length + ')'))) : h('p', { class: 'small dim' }, 'No client on this book appears on another tracked agency’s book.'), h('h4', null, 'Verticals'), h('div', { class: 'chips' }, (sp.verticals || []).map(v => h('span', { class: 'chip' }, v))))),
    clientsTbl)));
  // house
  const hs = sp.house || {};
  out.appendChild(section('Its own house', null, h('div', { class: 'stack' }, tx ? h('div', { class: 'card dprose' }, paras(tx.house)) : null,
    h('div', { class: 'grid-2' },
      h('div', { class: 'card stack' }, h('h4', null, 'Say and do'), (hs.tests || []).length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', null, hs.tests.map(t => h('tr', null, h('td', { class: 'first' }, t.cap), h('td', null, h('span', { class: 'pill ' + (t.result === 'corroborated' ? 'ok' : t.result === 'contradicted' ? 'bad' : 'off') }, t.result)), h('td', { class: 'wrap small' }, t.note)))))) : h('p', { class: 'small dim' }, 'No testable line in the sold mix.'), (hs.gaps || []).length ? h('div', { class: 'callout' }, h('b', null, 'Gaps: '), hs.gaps.join('; ') + '.') : null),
      h('div', { class: 'card stack' }, h('h4', null, 'The record'), h('dl', { class: 'kv' },
        h('dt', null, 'Sitemap'), h('dd', null, (hs.sitemap_urls != null ? fmt(hs.sitemap_urls) + ' URLs' : 'not read') + (hs.content_90d != null ? ' · ' + fmt(hs.content_90d) + ' updated in 90 days · ' + fmt(hs.content_365d || 0) + ' in 365' : '') + (hs.ai_urls != null ? ' · ' + fmt(hs.ai_urls) + ' AI topic URLs' : '')),
        h('dt', null, 'AI posture'), h('dd', null, (hs.llms_txt === true ? 'publishes llms.txt' : hs.llms_txt === false ? 'no llms.txt' : 'llms.txt not checked') + ((hs.ai_bots_blocked || []).length ? ' · blocks ' + hs.ai_bots_blocked.join(', ') : ' · no AI crawlers blocked')),
        h('dt', null, 'Google ads'), h('dd', null, hs.google && hs.google.status ? hs.google.status + (hs.google.count != null ? ' · ' + fmt(hs.google.count) + ' in the Transparency Center, ' + fmt(hs.google.count_30d || 0) + ' in the last 30 days' : '') : 'not read'),
        h('dt', null, 'LinkedIn ads'), h('dd', null, hs.linkedin && hs.linkedin.status ? hs.linkedin.status + (hs.linkedin.count ? ' · ' + hs.linkedin.count + ' (' + (hs.linkedin.company_ads || 0) + ' company page, ' + (hs.linkedin.thought_leader_ads || 0) + ' thought leader)' : '') : 'not read'),
        h('dt', null, 'Stack'), h('dd', null, [(hs.cms || []).join(', '), (hs.tags || []).join(', '), (hs.pixels_social || []).length ? 'pixels: ' + hs.pixels_social.join(', ') : 'no social pixel', (hs.test_tools || []).length ? 'testing: ' + hs.test_tools.join(', ') : null].filter(Boolean).join(' · '))),
        (hs.google && hs.google.samples || []).length ? h('div', null, h('h4', null, 'Ad copy on record'), h('ul', { class: 'small' }, hs.google.samples.slice(0, 3).map(x => h('li', null, '“' + x + '”')))) : null,
        (hs.linkedin && hs.linkedin.samples || []).length ? h('ul', { class: 'small' }, hs.linkedin.samples.slice(0, 3).map(x => h('li', null, '“' + x + '”'))) : null)))));
  // market
  out.appendChild(section('The market read', hz ? 'Horus ' + hz.band + ' ' + signed(hz.hti) + (mo ? ' · Monsoon ' + mo.band + ' ' + Math.round(mo.index) : '') : 'no Horus read', h('div', { class: 'stack' }, tx ? h('div', { class: 'card dprose' }, paras(tx.market)) : null,
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '#a.' + a.id + '.horus' }, 'Open the Horus read'), h('a', { class: 'btn', href: '#a.' + a.id + '.offshore' }, 'Open the Monsoon read'), h('a', { class: 'btn', href: '#a.' + a.id + '.omega' }, 'Omega tab')))));
  // openings + watch
  out.appendChild(section('Where it can be beaten', (sp.openings || []).length + ' computed openings', h('div', { class: 'stack' }, tx ? h('div', { class: 'card dprose' }, paras(tx.openings)) : null,
    h('div', { class: 'card stack' }, h('h4', null, 'Computed from the record'), (sp.openings || []).length ? h('ul', { class: 'small' }, sp.openings.map(o => h('li', null, o.text, ' ', h('span', { class: 'pill ' + (o.class === 'observed' ? 'ok' : 'off') }, o.class)))) : h('p', { class: 'small dim' }, 'No opening rule fired on this record.')))));
  const watch = tx && tx.watch && tx.watch.length ? tx.watch : (sp.watch || []).map(w => (w.indicator || '') + (w.watch ? ': ' + w.watch : '') + (w.next ? ' (next reading ' + w.next + ')' : ''));
  out.appendChild(section('Watch', null, h('div', { class: 'card' }, h('ul', { class: 'small' }, watch.map(w => h('li', null, w))))));
  if ((sp.evidence || []).length) out.appendChild(section('Evidence', sp.evidence.length + ' sources on the record', h('div', { class: 'card small' }, h('div', { class: 'chips' }, sp.evidence.slice(0, 40).map(e => ext(e.url, e.label.slice(0, 48), 'chip'))))));
  return out;
}

/* ========== The Monsoon read: offshore delivery exposure per agency ==========
   Computed by scripts/radar_offshore.py from assets/radar/offshore_model.json (published tables) and each agency's own
   record. Every line carries its evidence class; the field view shows where the work would go and which lines move. */
const MO = D.offshore || null;
const MO_MODEL = MO ? MO.model : null;
const MO_FIELD = MO ? MO.field : null;
const SHORE_IDS = ['south_asia', 'southeast_asia', 'eastern_europe', 'latin_america', 'africa'];
const SHORE_CLS = { south_asia: 'sh-sa', southeast_asia: 'sh-sea', eastern_europe: 'sh-ee', latin_america: 'sh-la', africa: 'sh-af' };
function shoreLabel(rid) { return MO_MODEL && MO_MODEL.shores.regions[rid] ? MO_MODEL.shores.regions[rid].label : rid; }
function monBand(mo) {
  if (!mo || !mo.ok) return h('span', { class: 'band Neutral' }, 'No read');
  const cls = mo.band === 'Landfall' ? 'Headwind' : mo.band === 'Onshore wind' ? 'Exposed' : mo.band === 'Breeze' ? 'Neutral' : 'Favored';
  return h('span', { class: 'band ' + cls, title: 'Monsoon index ' + mo.index }, mo.band);
}
function monHist(v) {
  const vals = A.filter(a => a.offshore && a.offshore.ok).map(a => a.offshore.index);
  const step = 5, bins = [];
  for (let x = 0; x < 100; x += step) bins.push({ x, n: vals.filter(q => q >= x && q < x + step || (x === 95 && q === 100)).length });
  const max = Math.max(1, ...bins.map(b => b.n));
  const wrap = h('div', { class: 'hist', role: 'img', 'aria-label': 'Distribution of the Monsoon index across ' + vals.length + ' agencies' });
  for (const b of bins) { const sp = h('span', { class: v != null && v >= b.x && v < b.x + step ? 'me' : '' }); sp.style.height = Math.max(2, 100 * b.n / max) + '%'; tipOn(sp, () => tipBody(b.n + ' agencies', b.x + ' to ' + (b.x + step))); wrap.appendChild(sp); }
  return wrap;
}
function shoreBar(shore, opt = {}) {
  return h('div', { class: 'stack', style: { gap: '6px' } },
    stackBar(SHORE_IDS.map(rid => ({ value: shore[rid] || 0, cls: SHORE_CLS[rid], label: shoreLabel(rid) })), { total: 1, tall: opt.tall, fmt: v => pct(v) }),
    h('div', { class: 'legend' }, SHORE_IDS.map(rid => h('span', { class: 'key' }, h('i', { class: SHORE_CLS[rid] }), shoreLabel(rid) + ' ' + pct(shore[rid] || 0)))));
}
function monSummary(a) {
  const mo = a.offshore || {};
  if (!mo.ok) return h('div', { class: 'verdict mon' }, h('div', { class: 'stack' }, h('span', { class: 'eyebrow' }, 'Monsoon read'), h('p', null, mo.reason || 'No read.')));
  return h('div', { class: 'verdict mon' },
    h('div', { class: 'stack', style: { gap: '8px' } },
      h('div', { class: 'row' }, h('span', { class: 'eyebrow' }, 'Monsoon read · offshore delivery exposure, three-year horizon'), monBand(mo), h('span', { class: 'mono small' }, Math.round(mo.index) + ' · ' + mo.index_pct + 'th percentile · ' + mo.evidence_class)),
      h('p', null, mo.verdict),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#a.' + a.id + '.offshore' }, 'Open the full read'))));
}
function termRow(t) {
  const m = MO_MODEL.structure;
  const lbl = { holdco: 'Holding-company ownership', consultancy_owned: 'Consultancy ownership', public: 'Listed company', pe_backed: 'Private-equity ownership', large: 'Scale', hub_office: 'Office in a hub economy', hub_jobs: 'Hiring in a hub economy', delivery_language: 'Global delivery in its own words', destination: 'Is itself the nearshore', icp_smb: 'Small-business clients', icp_local: 'Local-market clients', icp_mid: 'Mid-market clients', icp_mixed: 'Mixed client book', icp_enterprise: 'Enterprise clients', segment_scaled: 'Price-led, high-volume model', hourly: 'Publishes hourly rates', outcome: 'Outcome or productised pricing', white_label: 'White-label language' }[t.term] || t.term;
  return h('tr', null, h('td', { class: 'first' }, lbl), h('td', { class: 'num' }, signed(t.pts)), h('td', null, h('span', { class: 'pill ' + (t.class === 'observed' ? 'ok' : 'off') }, t.class)),
    h('td', { class: 'wrap' }, t.why, (t.ev || []).length ? h('div', { class: 'small dim', style: { marginTop: '4px' } }, t.ev.slice(0, 2).map(e => h('div', null, '“' + e.t + '” ', ext(e.u, e.f.replace(/_/g, ' '))))) : null));
}
function dOffshore(a) {
  const mo = a.offshore || {};
  const out = h('div', { class: 'stack', style: { gap: '22px' } });
  out.appendChild(monSummary(a));
  if (!mo.ok || !MO_MODEL) return out;
  const idxTrack = (() => { const me = h('span', { class: 'me' }); me.style.left = clamp(mo.index, 0, 100) + '%'; const med = h('span', { class: 'med' }); med.style.left = clamp(MO_FIELD.index_median, 0, 100) + '%'; tipOn(me, () => tipBody(String(mo.index), 'Monsoon index', mo.index_pct + 'th percentile of ' + MO_FIELD.n_read)); return h('div', { class: 'htitrack mon' }, h('span', { class: 'ax' }), med, me); })();
  out.appendChild(h('div', { class: 'gauge-row' },
    h('div', { class: 'gauge' }, h('h4', null, 'Monsoon index'), h('div', { class: 'big' }, Math.round(mo.index), h('small', null, mo.band + ' · ' + mo.index_pct + 'th pct')),
      idxTrack, h('div', { class: 'htiscale' }, h('span', null, '0'), h('span', null, 'field median ' + Math.round(MO_FIELD.index_median)), h('span', null, '100')),
      monHist(mo.index),
      h('p', { class: 'note' }, 'Sold mix through the offshorability table, weighted by labor intensity: ' + Math.round(mo.base) + ' points before structure. Bars: the ' + MO_FIELD.n_read + ' agencies read, in bins of 5; dark bar holds this agency.')),
    h('div', { class: 'gauge' }, h('h4', null, 'Two mechanisms'),
      meter('Migration: it moves its own delivery offshore', mo.migration, mo.migration >= 55 ? 'neg' : 'pos', null),
      meter('Displacement: an offshore-delivered rival takes the client', mo.displacement, mo.displacement >= 55 ? 'neg' : 'pos', null),
      h('p', { class: 'note' }, 'Each starts from the sold-mix base and adds its own structural terms; the index is their mean. Automation overlaps ' + pct(mo.overlap) + ' of the movable hours (paid search and paid social), where the platforms absorb the work before a hub does.')),
    h('div', { class: 'gauge' }, h('h4', null, 'Where the work would go'), h('div', { class: 'big' }, pct(mo.asia), h('small', null, 'South and Southeast Asia')),
      shoreBar(mo.shore), h('p', { class: 'note' }, 'Home market: ' + mo.language_label + '.' + ((mo.observed_regions || []).length ? ' Tilted toward the observed footprint in ' + mo.observed_regions.map(shoreLabel).join(', ') + '.' : '')))));
  // capability contributions
  out.appendChild(h('div', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('h3', null, 'Which sold lines can move'),
      barList(mo.contrib.map(c => ({ label: c.label, value: c.pts, display: c.pts.toFixed(1) + ' · off ' + c.off + ' · labor ' + Math.round(c.labor * 100) + '%', cls: c.off >= 3 ? 'neg' : c.off === 2 ? 'sun' : 'ink', tip: () => tipBody(c.pts.toFixed(1) + ' points', c.label, 'share of the sold mix ' + pct(c.share) + ' × offshorability ' + c.off + '/3 × labor intensity ' + c.labor + ' × 100. ' + MO_MODEL.offshorability[c.cap].why) })), { max: Math.max(20, ...mo.contrib.map(c => c.pts)) }),
      h('p', { class: 'note' }, 'Points sum to the base (' + Math.round(mo.base) + '). Hover a bar for the reasoning behind the offshorability score.')),
    h('div', { class: 'card stack' }, h('h3', null, 'What the record shows'),
      (mo.hub_offices || []).length ? h('div', null, h('h4', null, 'Offices listed in hub economies'), h('div', { class: 'chips' }, mo.hub_offices.map(o => h('span', { class: 'chip' }, o.place + ' · ' + shoreLabel(o.region))))) : h('p', { class: 'small dim' }, 'No office listed in a hub economy on the public record the Radar read.'),
      (mo.hub_jobs || []).length ? h('div', null, h('h4', null, 'Jobs posted in hub economies'), h('ul', { class: 'small' }, mo.hub_jobs.map(j => h('li', null, j.title + ' · ' + j.location)))) : null,
      (mo.onshore_claims || []).length ? h('div', null, h('h4', null, 'Claims onshore delivery (its own words, unverified)'), h('ul', { class: 'small' }, mo.onshore_claims.slice(0, 4).map(c => h('li', null, '“' + c.t + '” ', ext(c.u, c.f.replace(/_/g, ' ')))))) : null,
      h('p', { class: 'small dim' }, 'Evidence class of this read: ' + mo.evidence_class + '. Absence of evidence is not evidence: nothing found means nothing listed.'))));
  // structural terms
  const terms = (mo.terms.migration || []).concat(mo.terms.displacement || []);
  out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Structural terms'),
    terms.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Term'), h('th', { class: 'num' }, 'Points'), h('th', null, 'Evidence'), h('th', null, 'Why'))), h('tbody', null, terms.map(termRow)))) : h('p', { class: 'small dim' }, 'No structural term fired; the read is the sold mix alone.'),
    h('p', { class: 'note' }, 'Migration terms: ' + (mo.terms.migration || []).map(t => t.term + ' ' + signed(t.pts)).join(', ') + ' (' + Math.round(mo.migration) + '). Displacement terms: ' + (mo.terms.displacement || []).map(t => t.term + ' ' + signed(t.pts)).join(', ') + ' (' + Math.round(mo.displacement) + ').')));
  out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'What would prove this read wrong'), h('ul', { class: 'small' }, (mo.falsifiers || []).map(f => h('li', null, f))),
    h('p', { class: 'small dim' }, 'A score on a three-year horizon, not a probability. The hub economies’ own figures and the model tables are on the Offshore view.')));
  return out;
}

function viewOffshore(anchor) {
  const view = h('div', { class: 'view' });
  if (!MO || !MO_FIELD) { view.appendChild(h('div', { class: 'empty' }, 'The Monsoon layer is not in this build. Run python3 scripts/radar_offshore.py rebuild --write and build the app again.')); return view; }
  const F = MO_FIELD, M = MO_MODEL;
  const read = A.filter(a => a.offshore && a.offshore.ok);
  const bands = F.bands || {};
  view.appendChild(h('section', { class: 'hero' },
    h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, 'Offshore · the Monsoon read · ' + F.n_read + ' agencies · doctrine ' + M.doctrine_date), h('a', { href: '#offshore', class: 'btn', onclick: e => { e.preventDefault(); const q = document.getElementById('mon-method'); if (q) q.scrollIntoView({ behavior: 'smooth' }); } }, 'How it is computed')),
    h('p', { class: 'quote' }, 'How much of each agency’s sold work can be delivered from an offshore hub over three years, and where it would go: South and Southeast Asia first, Eastern Europe, Latin America and the francophone shore beside them.'),
    h('div', { class: 'by' }, h('span', { class: 'pill sun plain' }, 'Median index ' + Math.round(F.index_median) + ' · Landfall ' + (bands.Landfall || 0) + ' · Onshore wind ' + (bands['Onshore wind'] || 0) + ' · Breeze ' + (bands.Breeze || 0) + ' · Doldrums ' + (bands.Doldrums || 0)),
      h('span', { class: 'muted small' }, 'Read from the sold mix and each agency’s public record. Observed evidence (a hub office, a hub job, its own words on delivery or pricing) on ' + F.observed.any + ' of ' + F.n_read + '; the rest is inferred from structure and says so.'))));
  view.appendChild(h('div', { class: 'tiles' },
    tile('Median Monsoon index', String(Math.round(F.index_median)), 'mean ' + F.index_mean + ' · 0 to 100'),
    tile('Landfall', fmt(bands.Landfall || 0), 'index 70 and up: delivery present or unavoidable'),
    tile('Asian shore share', pct(F.shore.south_asia + F.shore.southeast_asia), 'of the field’s exposure, index-weighted'),
    tile('Delivery footprint observed', fmt(F.footprint_ids.length), F.observed.hub_office + ' with a hub office · ' + F.observed.hub_jobs + ' hiring in a hub'),
    tile('Claims onshore delivery', fmt(F.observed.onshore_claim), 'in-house, US- or UK-based, in their own words'),
    tile('Automation overlap', pct(F.overlap_mean), 'of movable hours the platforms also absorb')));
  // where the work goes + which lines move
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Where the work would go', 'The field’s exposure by shore, each agency’s split weighted by its index.'),
    h('div', { class: 'grid-2' },
      h('div', { class: 'card stack' }, shoreBar(F.shore, { tall: true }),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Shore'), h('th', { class: 'num' }, 'Share'), h('th', { class: 'num' }, 'Hub offices'), h('th', null, 'Hub economies'))),
          h('tbody', null, SHORE_IDS.map(rid => h('tr', null, h('td', { class: 'first' }, h('span', { class: 'key' }, h('i', { class: SHORE_CLS[rid] }), shoreLabel(rid))), h('td', { class: 'num' }, pct(F.shore[rid])), h('td', { class: 'num' }, String((F.hub_offices_by_region || {})[rid] || 0)), h('td', { class: 'wrap small' }, M.shores.regions[rid].hubs.join(', '))))))),
        h('p', { class: 'note' }, M.shores._why)),
      h('div', { class: 'card stack' }, h('h3', null, 'Which sold lines move'),
        barList(F.capabilities.map(c => ({ label: c.label, value: c.mean_pts, display: c.mean_pts.toFixed(1) + ' · off ' + c.off, cls: c.off >= 3 ? 'neg' : c.off === 2 ? 'sun' : 'ink', onClick: () => go('matrix'), tip: () => tipBody(c.mean_pts.toFixed(1) + ' points', c.label, M.offshorability[c.cap].why) })), { max: Math.max(5, ...F.capabilities.map(c => c.mean_pts)) }),
        h('p', { class: 'note' }, 'Mean points per agency: share of the sold mix × offshorability (0 to 3) ÷ 3 × labor intensity × 100. Hover for the reasoning; click to open the capability matrix.')))));
  // distribution + groups
  const grp = (rows, label) => sortableTable([
    { key: 'name', label, first: true, sort: r => r.name, render: r => r.name },
    { key: 'n', label: 'Agencies', num: true, sort: r => r.n, render: r => String(r.n) },
    { key: 'index', label: 'Index', num: true, sort: r => r.index, render: r => r.index == null ? '–' : String(Math.round(r.index)) },
    { key: 'mig', label: 'Migration', num: true, sort: r => r.migration, render: r => r.migration == null ? '–' : String(Math.round(r.migration)) },
    { key: 'disp', label: 'Displacement', num: true, sort: r => r.displacement, render: r => r.displacement == null ? '–' : String(Math.round(r.displacement)) },
    { key: 'asia', label: 'Asian shore', num: true, sort: r => r.asia, render: r => pct(r.asia) },
    { key: 'obs', label: 'Observed', num: true, sort: r => r.observed, render: r => String(r.observed) }
  ], rows, { sortKey: 'index', dir: -1 });
  view.appendChild(h('section', { class: 'sec' }, sectionHead('The field', 'Distribution of the index, then the read by region, segment, archetype, client type and ownership.'),
    h('div', { class: 'card stack' }, monHist(null), h('div', { class: 'hist-ax' }, h('span', null, '0 Doldrums'), h('span', null, '40 Breeze'), h('span', null, '55 Onshore wind'), h('span', null, '70 Landfall'), h('span', null, '100'))),
    h('div', { class: 'grid-2' }, h('div', { class: 'card stack' }, h('h3', null, 'By region'), grp(F.by_region, 'Region'), h('h3', null, 'By client type'), grp(F.by_icp, 'Clients')), h('div', { class: 'card stack' }, h('h3', null, 'By ownership'), grp(F.by_ownership, 'Ownership'))),
    h('div', { class: 'card stack' }, h('h3', null, 'By segment'), grp(F.by_segment, 'Segment')),
    h('div', { class: 'card stack' }, h('h3', null, 'By archetype'), grp(F.by_archetype, 'Archetype'))));
  // leaderboards
  const sorted = read.slice().sort((x, y) => y.offshore.index - x.offshore.index);
  const board = rows => sortableTable([
    { key: 'name', label: 'Agency', first: true, sort: r => r.name, render: r => h('span', null, agencyLink(r, null, 'offshore'), h('span', { class: 'dim small' }, ' · ' + (r.segment || '') + ' · ' + (r.icp || 'clients n/a'))) },
    { key: 'index', label: 'Index', num: true, sort: r => r.offshore.index, render: r => h('span', null, h('b', null, String(Math.round(r.offshore.index))), ' ', monBand(r.offshore)) },
    { key: 'mig', label: 'Migration', num: true, sort: r => r.offshore.migration, render: r => String(Math.round(r.offshore.migration)) },
    { key: 'disp', label: 'Displacement', num: true, sort: r => r.offshore.displacement, render: r => String(Math.round(r.offshore.displacement)) },
    { key: 'asia', label: 'Asian shore', num: true, sort: r => r.offshore.asia, render: r => pct(r.offshore.asia) },
    { key: 'ev', label: 'Evidence', sort: r => r.offshore.evidence_class, render: r => h('span', { class: 'pill ' + (r.offshore.evidence_class === 'observed' ? 'ok' : 'off') }, r.offshore.evidence_class) },
    { key: 'lines', label: 'Movable lines', cls: 'wrap', render: r => r.offshore.contrib.slice(0, 3).map(c => c.label + ' ' + Math.round(c.pts)).join(' · ') }
  ], rows, { sortKey: 'index', dir: -1 });
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Most exposed', 'The twenty highest indices.'), board(sorted.slice(0, 20))));
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Least exposed', 'The twelve lowest: relationship-, creative- and enterprise-bound work.'), board(sorted.slice(-12).reverse())));
  // observed footprints and onshore claims
  const foot = read.filter(a => a.offshore.hub_offices.length || a.offshore.hub_jobs.length).sort((x, y) => y.offshore.index - x.offshore.index);
  const claims = read.filter(a => a.offshore.onshore_claims.length).sort((x, y) => y.offshore.index - x.offshore.index);
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Already there: delivery footprints on the record', foot.length + ' agencies list an office or a job in a hub economy. A listed office can be a sales office; the country is named so you can judge.'),
    sortableTable([
      { key: 'name', label: 'Agency', first: true, sort: r => r.name, render: r => agencyLink(r, null, 'offshore') },
      { key: 'index', label: 'Index', num: true, sort: r => r.offshore.index, render: r => String(Math.round(r.offshore.index)) },
      { key: 'own', label: 'Ownership', sort: r => r.ownership || '', render: r => (r.ownership && r.ownership !== 'unknown' ? r.ownership : 'not disclosed') + (r.owner ? ' · ' + r.owner : '') },
      { key: 'where', label: 'Hub footprint', cls: 'wrap', render: r => h('div', { class: 'chips' }, r.offshore.hub_offices.map(o => h('span', { class: 'chip' }, o.place)), r.offshore.hub_jobs.map(j => h('span', { class: 'chip lead' }, 'hiring: ' + j.location))) }
    ], foot, { sortKey: 'index', dir: -1 })));
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Says it stays home', claims.length + ' agencies claim in-house or onshore delivery in their own words. Recorded as claims (the Sun eye); they move nothing, and they tell you the pressure exists in that segment.'),
    sortableTable([
      { key: 'name', label: 'Agency', first: true, sort: r => r.name, render: r => agencyLink(r, null, 'offshore') },
      { key: 'index', label: 'Index', num: true, sort: r => r.offshore.index, render: r => String(Math.round(r.offshore.index)) },
      { key: 'claim', label: 'The claim', cls: 'wrap', render: r => h('span', null, '“' + r.offshore.onshore_claims[0].t + '” ', ext(r.offshore.onshore_claims[0].u, r.offshore.onshore_claims[0].f.replace(/_/g, ' '))) }
    ], claims, { sortKey: 'index', dir: -1, limit: 20 })));
  // every agency
  const q = h('input', { type: 'search', placeholder: 'Filter agencies', 'aria-label': 'Filter agencies', autocomplete: 'off' });
  const all = board(sorted);
  q.addEventListener('input', () => { const n = norm(q.value).trim(); all.repaint(n ? sorted.filter(a => norm([a.name, a.domain, a.segment, a.icp, a.hq_country].join(' ')).includes(n)) : sorted); });
  view.appendChild(h('section', { class: 'sec' }, sectionHead('Every agency read', F.n_read + ' with a capability mix; ' + F.n_no_read + ' without scores have no read.'), h('div', { class: 'filters' }, q), all));
  // the Nilometer for this layer
  view.appendChild(h('section', { class: 'sec' }, sectionHead('The hub economies, in hard numbers', 'Graded signals behind the shore tables (Admiralty grades: source reliability A to F, information credibility 1 to 6).'),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Signal'), h('th', null, 'Reading'), h('th', null, 'Date'), h('th', null, 'Source'), h('th', null, 'Grade'), h('th', null, 'Read'))),
      h('tbody', null, M.signals.map(sg => h('tr', null, h('td', { class: 'first' }, h('b', null, sg.id), h('div', { class: 'small dim' }, sg.metric)), h('td', { class: 'wrap' }, sg.value), h('td', { class: 'nowrap small' }, sg.date), h('td', { class: 'wrap small' }, sg.url ? ext(sg.url, sg.source) : sg.source), h('td', { class: 'mono' }, sg.grade), h('td', { class: 'wrap small' }, sg.read))))))));
  // method
  const offRows = DIMS.map(([k, l]) => ({ k, l, o: M.offshorability[k] }));
  view.appendChild(h('section', { class: 'sec', id: 'mon-method' }, sectionHead('How the read is made', 'The tables are analytic judgments, published; everything after them is arithmetic.'),
    h('div', { class: 'card stack' }, h('h3', null, 'Offshorability by capability'), h('p', { class: 'small' }, M.offshorability._why),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Capability'), h('th', { class: 'num' }, 'Offshorability'), h('th', { class: 'num' }, 'Labor intensity'), h('th', null, 'Why'))),
        h('tbody', null, offRows.map(r => h('tr', null, h('td', { class: 'first' }, r.l), h('td', { class: 'num' }, String(r.o.off)), h('td', { class: 'num' }, pct(r.o.labor)), h('td', { class: 'wrap small' }, r.o.why))))))),
    h('div', { class: 'card stack' }, h('h3', null, 'The shore by home market'), h('p', { class: 'small' }, M.shores._why),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { class: 'first' }, 'Home market'), SHORE_IDS.map(rid => h('th', { class: 'num' }, shoreLabel(rid))), h('th', null, 'Why'))),
        h('tbody', null, Object.entries(M.shores.by_language).map(([k, v]) => h('tr', null, h('td', { class: 'first' }, v.label), SHORE_IDS.map(rid => h('td', { class: 'num' }, pct(v[rid] || 0))), h('td', { class: 'wrap small' }, v.why)))))),
      h('p', { class: 'note' }, 'An observed footprint in a shore adds 15 points to that shore before the split is renormalised.')),
    h('div', { class: 'grid-2' },
      h('div', { class: 'card stack' }, h('h3', null, 'Migration terms'), h('p', { class: 'small' }, 'Added to the base when the agency itself is built to move delivery offshore.'), h('dl', { class: 'kv' }, Object.entries(M.structure.migration).map(([k, v]) => [h('dt', null, k.replace(/_/g, ' ') + ' ' + signed(v.pts)), h('dd', null, v.why)]))),
      h('div', { class: 'card stack' }, h('h3', null, 'Displacement terms'), h('p', { class: 'small' }, 'Added to the base when an offshore-delivered competitor can take the client on price.'), h('dl', { class: 'kv' }, Object.entries(M.structure.displacement).map(([k, v]) => [h('dt', null, k.replace(/_/g, ' ') + ' ' + signed(v.pts)), h('dd', null, v.why)])), h('p', { class: 'note' }, M.structure.onshore_claim.why))),
    h('div', { class: 'card stack' }, h('h3', null, 'Bands, the automation overlap and the limits'),
      h('ul', { class: 'small' }, M.bands.map(b => h('li', null, h('b', null, b[1] + ' (' + b[0] + ' and up): '), b[2]))),
      h('p', { class: 'small' }, M.automation_overlap._why),
      h('ul', { class: 'small' }, M.limitations.map(x => h('li', null, x))),
      h('p', { class: 'note' }, 'Rebuild: python3 scripts/radar_offshore.py rebuild --write, then python3 scripts/omega_platform.py build-app. The model file is assets/radar/offshore_model.json; change a table and every read changes with it.'))));
  return view;
}

/* ========== OmegaWeapon: the Targets wing ==========
   Every OmegaWeapon run (one domain, one dashboard) lives here: baked into the build by omega_platform.py build-app,
   or imported at runtime from an omega-<domain>.html page or an omega-pack.json. The dashboard itself is hosted whole,
   in an isolated frame running the same engine that built the standalone page; this wing wraps it with the target's
   facts, its agency of record's Radar dossier, momentum, and the queue that feeds the next run. */
const OT = window.OMEGA_TARGETS || { meta: {}, targets: [] };
const ARCHETYPES = [['local-service', 'Local service business'], ['multi-location', 'Multi-location / franchise'], ['ecommerce-dtc', 'National e-commerce / DTC'], ['b2b-saas', 'B2B / SaaS'], ['marketplace-leadgen', 'Marketplace / directory / lead-gen'], ['publisher-media', 'Publisher / media / creator'], ['healthcare', 'Healthcare / wellness'], ['legal', 'Legal'], ['financial', 'Financial services / fintech / lending'], ['real-estate', 'Real estate / housing / mortgage'], ['automotive', 'Automotive'], ['education', 'Education'], ['nonprofit-political', 'Nonprofit / political / religious'], ['app-first', 'App-first / consumer app'], ['agency', 'Agency / martech / review platform'], ['regulated-other', 'Other regulated or specialty vertical']];
const ARCH_LABEL = Object.fromEntries(ARCHETYPES);
const OMEGA_TABS = [['brief', 'Brief'], ['site', 'Site and crawl'], ['content', 'Content'], ['local', 'Local'], ['authority', 'Authority'], ['competitors', 'Competitors'], ['paid', 'Paid'], ['social', 'Social'], ['ai', 'AI visibility'], ['apps', 'Apps'], ['exposure', 'Exposure'], ['agency', 'Agency lens'], ['market', 'Market'], ['forecast', 'Forecast'], ['playbook', 'Playbook'], ['ledger', 'Ledger'], ['method', 'Method']];
const TARGETS = new Map();
function hostKey(d) { let t = String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]; return t.replace(/^www\./, ''); }
function pad2(n) { return String(n).padStart(2, '0'); }
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

/* ---------- imported targets persist in IndexedDB (works in the extension and in the standalone page) ---------- */
const tdb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res) => {
      let req;
      try { req = indexedDB.open('omegaweapon', 1); } catch (e) { res(null); return; }
      req.onupgradeneeded = () => { req.result.createObjectStore('targets', { keyPath: 'key' }); };
      req.onsuccess = () => { this.db = req.result; res(this.db); };
      req.onerror = () => res(null); req.onblocked = () => res(null);
    });
  },
  async all() { const db = await this.open(); if (!db) return []; return new Promise(res => { const r = db.transaction('targets').objectStore('targets').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); }); },
  async put(rec) { const db = await this.open(); if (!db) return false; return new Promise(res => { const tx = db.transaction('targets', 'readwrite'); tx.objectStore('targets').put(rec); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); },
  async del(key) { const db = await this.open(); if (!db) return false; return new Promise(res => { const tx = db.transaction('targets', 'readwrite'); tx.objectStore('targets').delete(key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); }
};

function runKey(s) { return String(s.run_date || '') + ' ' + String(s.run_id || ''); }
function addTarget(rec) {
  const cur = TARGETS.get(rec.summary.key);
  if (cur && runKey(cur.summary) === runKey(rec.summary)) { rec.older = cur.older || []; TARGETS.set(rec.summary.key, rec); return rec; }
  if (cur && runKey(cur.summary) > runKey(rec.summary)) { cur.older = cur.older || []; if (!cur.older.some(o => runKey(o.summary) === runKey(rec.summary))) cur.older.push({ summary: rec.summary, payload: rec.payload, source: rec.source }); return cur; }
  if (cur) { rec.older = (cur.older || []).concat([{ summary: cur.summary, payload: cur.payload, source: cur.source }]); }
  TARGETS.set(rec.summary.key, rec);
  return rec;
}
async function loadTargets() {
  for (const t of (OT.targets || [])) if (t && t.summary && t.payload) addTarget({ summary: t.summary, payload: t.payload, source: 'built-in' });
  for (const t of await tdb.all()) if (t && t.summary && t.payload) addTarget({ summary: t.summary, payload: t.payload, source: 'imported', imported_at: t.imported_at });
}
function targetsList() { return [...TARGETS.values()].sort((x, y) => runKey(y.summary).localeCompare(runKey(x.summary)) || x.summary.key.localeCompare(y.summary.key)); }
function targetsForAgency(id) {
  const all = targetsList();
  return { own: all.find(t => t.summary.radar_id === id) || null, clients: all.filter(t => t.summary.agency && t.summary.agency.radar_id === id && t.summary.radar_id !== id) };
}
function matchTargetHost(url) {
  let host = ''; try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return null; }
  let best = null;
  for (const t of TARGETS.values()) { const d = t.summary.key; if (host === d || host.endsWith('.' + d)) { if (!best || d.length > best.summary.key.length) best = t; } }
  return best;
}

/* the Radar block a run manifest carries about its agency of record (mirrors omega_platform.radar_block) */
function radarBlock(a) {
  const hz = a.horus || {};
  const label = Object.assign({ linkedin: 'LinkedIn advertising', content: 'Publishing cadence' }, DIM_LABEL);
  const b = { id: a.id, name: a.name, domain: a.domain, region: a.region, hq: [a.hq_city, a.hq_country].filter(Boolean).join(', ') || null, archetype: a.archetype, segment: a.segment,
    ownership: a.ownership && a.ownership !== 'unknown' ? a.ownership : null, owner: a.owner, status: a.status, leads: (a.lead || []).map(k => label[k] || k),
    gaps: (a.gaps || []).map(g => g.label).filter(Boolean), house: ((hz.house || {}).tests || []).map(t => ({ cap: label[t.cap] || t.cap, result: t.do, note: t.note })),
    compiled: D.meta.generated, edition: ED.edition, ok: !!hz.ok };
  if (hz.ok) Object.assign(b, { band: hz.band, hti: hz.hti, arc_clock: hz.arc_clock, arc_word: hz.arc_word, best_fit: hz.scen_best + ' ' + (SCEN[hz.scen_best] ? SCEN[hz.scen_best].name : ''), saydo: hz.house && hz.house.tested ? hz.house.corroborated + '/' + hz.house.tested : null, verdict: hz.verdict });
  else b.verdict = hz.reason || 'Tracked in the Radar with no Horus read.';
  return b;
}
function agencyByName(name) { const n = norm(String(name || '').replace(/\(.*?\)/g, '')).replace(/[^a-z0-9]+/g, ' ').trim(); if (!n) return null; return A.find(a => norm(a.name).replace(/[^a-z0-9]+/g, ' ').trim() === n) || null; }

/* the summary row (mirrors omega_platform.summarize); used for runtime imports */
function summarizeTarget(p) {
  const T = p.target || {}, R = p.run || {}, M = p.metrics || {}, AN = p.analysis || {}, meta = p.meta || {};
  const of = (((p.modules || {}).agency || {}).of_record) || {};
  const sc = {}; for (const [k, v] of Object.entries(M.scorecard || {})) sc[k] = v && v.grade;
  const hc = M.honest_count || {}, fd = M.findings || {}, cov = M.coverage || {};
  let hit = of.radar && of.radar.id ? BYID.get(of.radar.id) : null;
  if (!hit && of.domain) hit = matchHost('https://' + hostKey(of.domain) + '/');
  if (!hit && of.name) hit = agencyByName(of.name);
  if (hit && !(of.radar && of.radar.id)) { of.radar = radarBlock(hit); ((p.modules || {}).agency || {}).of_record = of; }
  const self = T.radar_id ? BYID.get(T.radar_id) : matchHost('https://' + hostKey(T.domain) + '/');
  const fit = (M.scorecard || {})['Agency Fit'] || {};
  return {
    key: hostKey(T.domain), domain: T.domain, homepage: T.homepage, business: T.business_name || T.domain, recipient: T.recipient, archetype: T.archetype,
    archetype_label: meta.archetype_label || ARCH_LABEL[T.archetype] || T.archetype, vertical: T.vertical, geography: (T.geography || {}).label, posture: T.posture, question: T.question,
    run_id: R.id, run_date: R.run_date, tier: R.tier, previous_run: meta.previous_run, presence: (R.presence || {}).mode,
    overall: (M.overall || {}).grade, pillars_graded: (M.overall || {}).pillars_graded, pillars_total: (M.overall || {}).pillars_total, scorecard: sc,
    failing: Object.entries(sc).filter(([k, g]) => g === 'D' || g === 'F').map(([k]) => k),
    honest: { n: hc.n || 0, confirmed: hc.confirmed || 0, candidate: hc.candidate || 0, cleared: hc.cleared || 0, routable: hc.routable || 0, sentence: hc.sentence },
    findings: { n: fd.n || 0, by_severity: fd.by_severity || {} },
    coverage: { run: cov.run, partial: cov.partial, not: cov.not, blocked: (cov.blocked || []).length, modules: (cov.modules || []).map(r => ({ module: r.module, status: r.status })) },
    agency: { name: of.name, domain: of.domain, confidence: of.confidence, radar_id: hit ? hit.id : null, radar_band: hit && hit.horus && hit.horus.ok ? hit.horus.band : null, radar_hti: hit && hit.horus && hit.horus.ok ? hit.horus.hti : null, inherited_share: fit.inherited_share },
    radar_id: self ? self.id : null, headline: AN.headline, one_exposure: AN.one_exposure, momentum: M.momentum && typeof M.momentum === 'object' ? M.momentum : null,
    judgment_calls: (R.judgment_calls || []).length, demo: (R.judgment_calls || []).some(x => /DEMO FIXTURE/.test(String(x))), tasks: (p.tasks || []).length, verify: (p.verify_queue || []).length,
    built_at: meta.built_at, doctrine_date: meta.doctrine_date
  };
}

/* ---------- import: an omega-<domain>.html page, an omega-pack.json, or one payload ---------- */
function payloadFromHtml(text) {
  const m = text.match(/<script type="application\/json" id="omega-data">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No OmegaWeapon payload found in this page.');
  return JSON.parse(m[1]);
}
async function importText(text, name) {
  let recs = [];
  const t = text.trim();
  if (/^\s*</.test(t)) recs.push({ payload: payloadFromHtml(t) });
  else {
    const j = JSON.parse(t);
    if (j && j.omega_pack) recs = (j.targets || []).map(x => ({ payload: x.payload, summary: x.summary }));
    else if (j && j.meta && j.metrics && j.target) recs.push({ payload: j });
    else if (j && j.omega && j.target && !j.metrics) throw new Error('This is a run manifest, not a built payload. Build it first: python3 scripts/omega_platform.py pack --manifest ' + (name || 'run.json'));
    else throw new Error('Unrecognised file. Expected omega-<domain>.html or omega-pack.json.');
  }
  let n = 0;
  for (const r of recs) {
    if (!r.payload || !r.payload.target) continue;
    const summary = summarizeTarget(r.payload);
    const rec = { key: summary.key, summary, payload: r.payload, source: 'imported', imported_at: new Date().toISOString() };
    await tdb.put(rec);
    addTarget(rec);
    n++;
  }
  return n;
}
function importBox(onDone) {
  const input = h('input', { type: 'file', accept: '.html,.json,text/html,application/json', multiple: true, style: { display: 'none' } });
  const btn = h('button', { class: 'btn primary', type: 'button', onclick: () => input.click() }, icon('plus'), 'Import a run');
  const drop = h('div', { class: 'drop', tabindex: '0' }, btn, h('span', { class: 'small dim' }, 'omega-<domain>.html or omega-pack.json. Drop files here.'));
  async function handle(files) {
    let total = 0; const errs = [];
    for (const f of files) { try { total += await importText(await f.text(), f.name); } catch (e) { errs.push(f.name + ': ' + (e.message || e)); } }
    if (total) toast(total + (total === 1 ? ' target imported' : ' targets imported'));
    if (errs.length) toast(errs.join(' | '));
    if (onDone) onDone(total);
  }
  input.addEventListener('change', () => { handle([...input.files]); input.value = ''; });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); handle([...e.dataTransfer.files]); });
  drop.appendChild(input);
  return drop;
}
function packOf(list) { return JSON.stringify({ omega_pack: 2, generated: new Date().toISOString(), edition: ED.edition, radar_compiled: D.meta.generated, n: list.length, targets: list.map(t => ({ summary: t.summary, payload: t.payload })) }); }

/* ---------- the queue: targets picked while browsing, exported for the skill ---------- */
function queueItems() { return store.data.queue || []; }
function queueAdd(item) {
  store.data.queue = store.data.queue || [];
  const key = hostKey(item.domain); if (!key) return false;
  if (store.data.queue.some(q => q.domain === key)) { toast(key + ' is already queued'); return false; }
  store.data.queue.push({ domain: key, business: item.business || '', archetype: item.archetype || 'local-service', note: item.note || '', url: item.url || ('https://' + key + '/'), added: todayISO() });
  store.save(); toast(key + ' queued for the Omega'); return true;
}
function queueRemove(domain) { store.data.queue = (store.data.queue || []).filter(q => q.domain !== domain); store.save(); }
function omegaCommand(q) {
  const parts = ['python3 scripts/omega_run.py', q.domain, '--archetype', q.archetype || 'local-service'];
  if (q.business) parts.push('--business', JSON.stringify(q.business));
  if (q.note) parts.push('--question', JSON.stringify(q.note));
  parts.push('--follow-links', '--budget', '60', '--ua', '"$OW_USER_AGENT"', '--tokens', '"<operator tokens>"', '--out', 'omega-' + q.domain + '.html');
  return parts.join(' ');
}
function queueExport() { return JSON.stringify({ omega_queue: 1, exported: new Date().toISOString(), items: queueItems() }, null, 1); }
function queueSection() {
  const wrap = h('section', { class: 'sec', id: 'queue' });
  function paint() {
    const q = queueItems();
    const dom = h('input', { type: 'text', placeholder: 'domain, e.g. example.com', 'aria-label': 'Domain to queue', autocomplete: 'off' });
    const biz = h('input', { type: 'text', placeholder: 'business name (optional)', 'aria-label': 'Business name' });
    const arch = h('select', { 'aria-label': 'Archetype' }, ARCHETYPES.map(([k, l]) => h('option', { value: k }, l)));
    const note = h('input', { type: 'text', placeholder: 'the question to answer (optional)', 'aria-label': 'Question' });
    const add = h('button', { class: 'btn primary', type: 'button', onclick: () => { if (queueAdd({ domain: dom.value, business: biz.value, archetype: arch.value, note: note.value })) paint(); } }, icon('plus'), 'Queue');
    const form = h('div', { class: 'qform' }, dom, biz, arch, note, add);
    dom.addEventListener('keydown', e => { if (e.key === 'Enter') add.click(); });
    const rows = q.length ? sortableTable([
      { key: 'domain', label: 'Domain', first: true, sort: r => r.domain, render: r => h('span', null, h('b', null, r.domain), r.business ? h('span', { class: 'dim' }, ' · ' + r.business) : null) },
      { key: 'archetype', label: 'Archetype', sort: r => r.archetype, render: r => ARCH_LABEL[r.archetype] || r.archetype },
      { key: 'note', label: 'Question', cls: 'wrap', render: r => r.note || '' },
      { key: 'added', label: 'Queued', sort: r => r.added, render: r => r.added },
      { key: 'act', label: '', render: r => h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => copyText(omegaCommand(r), 'Command') }, icon('copy'), 'Command'), h('button', { class: 'btn', type: 'button', onclick: () => { queueRemove(r.domain); paint(); } }, 'Remove')) }
    ], q, { sortKey: 'added', dir: -1 }) : h('div', { class: 'empty' }, 'Nothing queued. Add a domain here, or queue the site you are on from the popup or the right-click menu.');
    const acts = q.length ? h('div', { class: 'row' }, exportButtons('omega-queue.json', queueExport, 'application/json'), h('button', { class: 'btn', type: 'button', onclick: () => copyText(q.map(omegaCommand).join('\n'), 'Commands') }, icon('copy'), 'Copy all commands'), h('button', { class: 'btn', type: 'button', onclick: () => { store.data.queue = []; store.save(); paint(); } }, 'Clear queue')) : null;
    wrap.replaceChildren(sectionHead('The queue', q.length ? q.length + ' queued. Export the queue and hand it to the skill: python3 scripts/omega_platform.py queue --file omega-queue.json --run' : 'Pick the next targets here; the skill runs them and the pack comes back into this wing.'),
      h('div', { class: 'card stack' }, form, rows, acts));
  }
  paint();
  return wrap;
}

/* ---------- views ---------- */
function gradeBox(g) { return h('span', { class: 'grade g' + String(g || '?')[0] + (g === 'NA' || g === '?' ? ' dim' : ''), title: g === 'NA' ? 'module did not run' : g === '?' ? 'partial read, nothing graded' : 'grade ' + g }, g || '?'); }
function honestLine(s) { const hc = s.honest || {}; return hc.n ? hc.n + ' obs · ' + hc.confirmed + ' CONFIRMED · ' + hc.candidate + ' CANDIDATE · ' + hc.cleared + ' CLEARED' : 'no compliance rows'; }
function agencyCell(s) {
  const ag = s.agency || {};
  if (!ag.name) return h('span', { class: 'dim' }, 'none identified');
  const a = ag.radar_id ? BYID.get(ag.radar_id) : null;
  return h('span', null, a ? h('a', { href: '#a.' + a.id + '.omega' }, a.name) : ag.name.replace(/\s*\(footer credit\)/, ''), ag.confidence ? h('span', { class: 'dim small' }, ' · ' + ag.confidence) : null, a && a.horus && a.horus.ok ? h('span', null, ' ', bandTag(a.horus)) : null);
}
function momentumText(s) {
  const m = s.momentum; if (!m) return s.previous_run ? 'vs ' + s.previous_run : 'first run';
  const gd = m.grade_delta || {}; let up = 0, down = 0;
  for (const v of Object.values(gd)) { if (v && v.delta > 0) up++; else if (v && v.delta < 0) down++; }
  return 'vs ' + (m.previous_run || 'previous') + ': ' + up + ' pillar' + (up === 1 ? '' : 's') + ' up, ' + down + ' down, ' + ((m.resolved || []).length) + ' resolved, ' + ((m.new || []).length) + ' new';
}
function targetCols() {
  return [
    { key: 'business', label: 'Target', first: true, sort: r => r.summary.business, render: r => h('span', null, h('a', { href: '#t/' + r.summary.key }, r.summary.business), h('span', { class: 'dim' }, ' · ' + r.summary.domain), r.summary.demo ? h('span', { class: 'pill warn', style: { marginLeft: '6px' } }, 'demo fixture') : null, r.source === 'imported' ? h('span', { class: 'pill off', style: { marginLeft: '6px' } }, 'imported') : null) },
    { key: 'arch', label: 'Archetype', sort: r => r.summary.archetype_label || '', render: r => r.summary.archetype_label || r.summary.archetype || '' },
    { key: 'overall', label: 'Overall', sort: r => 'ABCDF?N'.indexOf(String(r.summary.overall || 'N')[0]), render: r => h('span', null, gradeBox(r.summary.overall || 'NA'), h('span', { class: 'dim small' }, ' ' + (r.summary.pillars_graded || 0) + '/' + (r.summary.pillars_total || 0))) },
    { key: 'failing', label: 'Failing pillars', cls: 'wrap', render: r => (r.summary.failing || []).length ? h('div', { class: 'chips' }, r.summary.failing.map(p => h('span', { class: 'chip' }, p))) : h('span', { class: 'dim' }, 'none at D or F') },
    { key: 'confirmed', label: 'CONFIRMED', num: true, sort: r => (r.summary.honest || {}).confirmed || 0, render: r => String((r.summary.honest || {}).confirmed || 0) },
    { key: 'findings', label: 'Findings', num: true, sort: r => (r.summary.findings || {}).n || 0, render: r => String((r.summary.findings || {}).n || 0) },
    { key: 'agency', label: 'Agency of record', render: r => agencyCell(r.summary) },
    { key: 'run', label: 'Run', sort: r => runKey(r.summary), render: r => h('span', null, r.summary.run_date || '', h('span', { class: 'dim small' }, ' · tier ' + (r.summary.tier == null ? 0 : r.summary.tier)), r.older && r.older.length ? h('span', { class: 'dim small' }, ' · ' + (r.older.length + 1) + ' runs') : null) }
  ];
}
function viewTargets() {
  const view = h('div', { class: 'view' });
  const list = targetsList();
  const withAgency = list.filter(t => t.summary.agency && t.summary.agency.name);
  const inRadar = list.filter(t => t.summary.agency && t.summary.agency.radar_id);
  const confirmed = list.reduce((a, t) => a + ((t.summary.honest || {}).confirmed || 0), 0);
  const gradesN = list.filter(t => t.summary.overall && !['NA', '?'].includes(t.summary.overall));
  const gradeMix = countBy(gradesN, t => t.summary.overall).map(([g, n]) => g + ' ' + n).join(' · ');
  view.appendChild(h('section', { class: 'hero' },
    h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, 'Targets · ' + list.length + (list.length === 1 ? ' domain' : ' domains') + ' · one dashboard per run' + (OT.meta && OT.meta.pack_generated ? ' · pack ' + String(OT.meta.pack_generated).slice(0, 10) : '')),
      h('a', { href: '#queue', class: 'btn', onclick: e => { e.preventDefault(); const q = document.getElementById('queue'); if (q) q.scrollIntoView({ behavior: 'smooth' }); } }, 'Queue the next run')),
    h('p', { class: 'quote' }, list.length ? 'Point the Omega at a domain and the dashboard lands here, with the agency that built the site read against the Radar.' : 'No targets yet. Run the Omega on a domain, then import the page or the pack here; or queue domains below and hand the queue to the skill.'),
    h('div', { class: 'by' }, h('span', { class: 'pill sun plain' }, 'OmegaWeapon ' + (OT.meta && OT.meta.version ? OT.meta.version : '2.0')), h('span', { class: 'muted small' }, 'Every number on a target page is computed from its run manifest; hosted here whole, never re-rendered.'))));
  view.appendChild(h('div', { class: 'tiles' },
    tile('Targets', fmt(list.length), list.filter(t => t.source === 'imported').length + ' imported · ' + list.filter(t => t.source === 'built-in').length + ' built in'),
    tile('Overall grades', gradesN.length ? gradeMix : '–', gradesN.length ? gradesN.length + ' graded' : 'no graded runs'),
    tile('CONFIRMED exposure', fmt(confirmed), 'across every target'),
    tile('Agency of record found', fmt(withAgency.length), inRadar.length + ' matched to the Radar'),
    tile('Runs with a previous run', fmt(list.filter(t => t.summary.momentum).length), 'momentum measured')));
  const importSec = h('section', { class: 'sec' }, sectionHead('Bring a run in', 'A built dashboard page or a pack from python3 scripts/omega_platform.py pack.'),
    h('div', { class: 'card stack' }, importBox(n => { if (n) render(); }), list.length ? h('div', { class: 'row' }, exportButtons('omega-pack.json', () => packOf(list), 'application/json'), exportButtons('omega-targets.csv', () => toCSV(list, [
      { label: 'domain', csv: r => r.summary.domain }, { label: 'business', csv: r => r.summary.business }, { label: 'archetype', csv: r => r.summary.archetype }, { label: 'run_id', csv: r => r.summary.run_id }, { label: 'run_date', csv: r => r.summary.run_date }, { label: 'tier', csv: r => r.summary.tier },
      { label: 'overall', csv: r => r.summary.overall }, { label: 'failing_pillars', csv: r => (r.summary.failing || []).join('; ') }, { label: 'confirmed', csv: r => (r.summary.honest || {}).confirmed }, { label: 'candidate', csv: r => (r.summary.honest || {}).candidate }, { label: 'cleared', csv: r => (r.summary.honest || {}).cleared },
      { label: 'findings', csv: r => (r.summary.findings || {}).n }, { label: 'agency_of_record', csv: r => (r.summary.agency || {}).name }, { label: 'agency_radar_id', csv: r => (r.summary.agency || {}).radar_id }, { label: 'inherited_share', csv: r => (r.summary.agency || {}).inherited_share }, { label: 'headline', csv: r => r.summary.headline }
    ]), 'text/csv')) : null));
  view.appendChild(importSec);
  if (list.length) {
    const q = h('input', { type: 'search', placeholder: 'Filter targets', 'aria-label': 'Filter targets', autocomplete: 'off' });
    const tbl = sortableTable(targetCols(), list, { sortKey: 'run', dir: -1, onRow: r => go('t/' + r.summary.key) });
    q.addEventListener('input', () => { const n = norm(q.value).trim(); tbl.repaint(n ? list.filter(t => norm([t.summary.business, t.summary.domain, t.summary.archetype_label, (t.summary.agency || {}).name].join(' ')).includes(n)) : list); });
    view.appendChild(h('section', { class: 'sec' }, sectionHead('Every target', 'Click a row to open the dashboard.'), h('div', { class: 'filters' }, q), tbl));
  }
  view.appendChild(queueSection());
  return view;
}

function frameSrcdoc() {
  const get = id => { const e = document.getElementById(id); return e ? e.textContent : ''; };
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Target dashboard</title><style>' + get('fonts-css') + '\n' + get('omega-frame-css') + '</style></head><body>' + get('omega-frame-html') + '<script>' + get('omega-engine') + '<\/script></body></html>';
}
let frameListener = null;
function omegaFrame(t, tab) {
  const iframe = h('iframe', { class: 'omega-frame', title: t.summary.business + ': dashboard' });
  const host = h('div', { class: 'omega-host' }, iframe);
  if (frameListener) window.removeEventListener('message', frameListener);
  frameListener = (ev) => {
    if (ev.source !== iframe.contentWindow) return;
    const m = ev.data || {};
    if (m.type === 'omega:ready') { iframe.contentWindow.postMessage({ type: 'omega:theme', theme: store.data.theme }, '*'); iframe.contentWindow.postMessage({ type: 'omega:data', data: t.payload }, '*'); if (tab) setTimeout(() => iframe.contentWindow.postMessage({ type: 'omega:select', tab }, '*'), 60); }
    else if (m.type === 'omega:nav' && typeof m.hash === 'string') go(m.hash.replace(/^#/, ''));
    else if (m.type === 'omega:tab' && m.tab) { const tok = 't/' + t.summary.key + (m.tab === 'brief' ? '' : '/' + m.tab); if ((location.hash || '').slice(1) !== tok) history.replaceState(null, '', '#' + tok); }
  };
  window.addEventListener('message', frameListener);
  if (IS_EXT) iframe.src = 'omega-frame.html'; else iframe.srcdoc = frameSrcdoc();
  return host;
}
function targetHead(t) {
  const s = t.summary;
  const a = s.agency && s.agency.radar_id ? BYID.get(s.agency.radar_id) : null;
  const self = s.radar_id ? BYID.get(s.radar_id) : null;
  const facts = h('div', { class: 'meta' },
    h('span', null, ext(s.homepage || ('https://' + s.domain + '/'), s.domain)),
    h('span', null, s.archetype_label || s.archetype || ''), s.geography ? h('span', null, s.geography) : null,
    h('span', null, 'Run ' + (s.run_date || '') + ' ' + (s.run_id || '')), h('span', null, 'Tier ' + (s.tier == null ? 0 : s.tier)), s.posture ? h('span', null, s.posture) : null,
    s.presence ? h('span', null, 'Presence: ' + (s.presence === 'honest' ? 'declared' : s.presence)) : null,
    s.recipient ? h('span', null, 'Prepared for ' + s.recipient) : null);
  const pills = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } }, Object.entries(s.scorecard || {}).map(([k, g]) => h('span', { class: 'pchip', title: k }, gradeBox(g || 'NA'), ' ', h('span', { class: 'small' }, k))));
  const agencyCard = h('div', { class: 'card stack' }, h('h4', null, 'Agency of record'),
    s.agency && s.agency.name ? h('div', { class: 'stack' }, h('div', null, h('b', null, s.agency.name.replace(/\s*\(footer credit\)/, '')), s.agency.confidence ? h('span', { class: 'dim small' }, ' · ' + s.agency.confidence) : null),
      a ? h('div', { class: 'row' }, bandTag(a.horus), h('a', { href: '#a.' + a.id + '.horus' }, 'Radar dossier'), h('a', { href: '#a.' + a.id + '.omega' }, 'its audited book')) : h('span', { class: 'dim small' }, 'not one of the ' + A.length + ' tracked agencies'),
      s.agency.inherited_share != null ? h('span', { class: 'small' }, 'Inherited share of High and Medium findings: ' + pct(s.agency.inherited_share)) : null) : h('span', { class: 'dim' }, 'None identified from the footer credit, RDAP or the shared tag stack.'),
    self ? h('div', { class: 'small' }, 'This target is itself a tracked agency: ', h('a', { href: '#a.' + self.id }, self.name)) : null);
  const acts = h('div', { class: 'acts' },
    MODE === 'panel' && IS_EXT ? h('button', { class: 'btn', type: 'button', onclick: () => openFull('#t/' + s.key) }, 'Open full view') : null,
    MODE === 'panel' ? null : h('button', { class: 'btn', type: 'button', onclick: () => document.body.classList.toggle('focus') }, icon('open'), 'Focus'),
    MODE === 'panel' ? null : exportButtons('omega-' + s.key + '.json', () => JSON.stringify(t.payload), 'application/json'),
    t.source === 'imported' ? h('button', { class: 'btn', type: 'button', onclick: async () => { await tdb.del(s.key); TARGETS.delete(s.key); toast('Removed ' + s.key); go('targets'); } }, 'Remove') : null);
  return h('div', { class: 'stack' },
    h('div', { class: 'dossier-head' }, h('div', null, h('div', { class: 'title' }, h('h1', null, s.business), gradeBox(s.overall || 'NA'), s.demo ? h('span', { class: 'pill warn' }, 'demo fixture') : null), facts), acts),
    h('div', { class: 'grid-2' }, h('div', { class: 'card stack' }, h('h4', null, 'Where it stands'), pills, h('p', { class: 'small' }, honestLine(s)), h('p', { class: 'small dim' }, momentumText(s)), s.headline ? h('p', { class: 'small' }, h('b', null, 'Headline: '), s.headline) : null), agencyCard));
}
function viewTarget(key, tab) {
  const t = TARGETS.get(key);
  if (!t) return h('div', { class: 'empty' }, 'No target for ' + key + '. Import its dashboard on the Targets view.');
  const view = h('div', { class: 'view', style: { gap: '18px' } });
  const back = h('button', { class: 'back', type: 'button', onclick: () => { if (trail.length > 1) history.back(); else go('targets'); } }, icon('back'), 'Back');
  view.appendChild(MODE === 'panel' ? h('div') : back);
  view.appendChild(targetHead(t));
  if (MODE === 'panel') {
    view.appendChild(h('div', { class: 'card stack' }, h('h4', null, 'Sections'), h('div', { class: 'chips' }, OMEGA_TABS.map(([k, l]) => h('button', { class: 'btn', type: 'button', onclick: () => openFull('#t/' + key + '/' + k) }, l)))));
    return view;
  }
  const rail = h('nav', { class: 'subrail', 'aria-label': 'Dashboard sections' }, OMEGA_TABS.map(([k, l]) => h('a', { class: 'tab', href: '#t/' + key + (k === 'brief' ? '' : '/' + k), 'aria-current': (tab || 'brief') === k ? 'page' : null }, l)));
  view.appendChild(rail);
  view.appendChild(omegaFrame(t, tab || 'brief'));
  if (t.older && t.older.length) view.appendChild(h('div', { class: 'card small' }, h('b', null, 'Earlier runs held: '), t.older.map(o => o.summary.run_id + ' (' + o.summary.run_date + ', overall ' + (o.summary.overall || 'NA') + ')').join(' · '), '. The page above measures momentum against the run the builder found in the cache.'));
  return view;
}

/* the Omega tab on a Radar dossier: the agency's own run and the client sites it shipped, as the Omega read them */
function dOmega(a) {
  const { own, clients } = targetsForAgency(a.id);
  const out = h('div', { class: 'stack', style: { gap: '18px' } });
  out.appendChild(h('div', { class: 'grid-2' },
    h('div', { class: 'card stack' }, h('h3', null, 'Its own house, run by the Omega'),
      own ? h('div', { class: 'stack' }, h('div', { class: 'row' }, gradeBox(own.summary.overall || 'NA'), h('a', { href: '#t/' + own.summary.key }, own.summary.business), h('span', { class: 'dim small' }, own.summary.run_date)), h('p', { class: 'small' }, honestLine(own.summary)), (own.summary.failing || []).length ? h('div', { class: 'chips' }, own.summary.failing.map(p => h('span', { class: 'chip' }, p + ' fails'))) : h('p', { class: 'small dim' }, 'No pillar at D or F.'))
        : h('div', { class: 'stack' }, h('p', { class: 'small dim' }, 'No OmegaWeapon run on ' + a.domain + ' yet.'), h('button', { class: 'btn', type: 'button', onclick: () => queueAdd({ domain: a.domain, business: a.name, archetype: 'agency', note: 'Self-side read of a tracked agency: what it sells against what it ships on its own house', url: 'https://' + a.domain + '/' }) }, icon('plus'), 'Queue ' + a.name + ' for the Omega'))),
    h('div', { class: 'card stack' }, h('h3', null, 'Client sites it built, audited'),
      clients.length ? h('p', { class: 'small' }, clients.length + (clients.length === 1 ? ' target names ' : ' targets name ') + a.name + ' as the agency of record. Mean inherited share of High and Medium findings: ' + (function () { const v = clients.map(t => (t.summary.agency || {}).inherited_share).filter(x => x != null); return v.length ? pct(mean(v)) : '–'; })() + '.')
        : h('p', { class: 'small dim' }, 'No audited target names ' + a.name + ' as its agency of record yet. A footer credit, an RDAP registrant or a shared tag stack on a target ties it here.'))));
  if (clients.length) {
    out.appendChild(sortableTable([
      { key: 'business', label: 'Target', first: true, sort: r => r.summary.business, render: r => h('a', { href: '#t/' + r.summary.key }, r.summary.business + ' · ' + r.summary.domain) },
      { key: 'overall', label: 'Overall', sort: r => 'ABCDF?N'.indexOf(String(r.summary.overall || 'N')[0]), render: r => gradeBox(r.summary.overall || 'NA') },
      { key: 'fit', label: 'Agency Fit', sort: r => 'ABCDF?N'.indexOf(String((r.summary.scorecard || {})['Agency Fit'] || 'N')[0]), render: r => gradeBox((r.summary.scorecard || {})['Agency Fit'] || 'NA') },
      { key: 'inh', label: 'Inherited share', num: true, sort: r => (r.summary.agency || {}).inherited_share, render: r => (r.summary.agency || {}).inherited_share == null ? '–' : pct((r.summary.agency || {}).inherited_share) },
      { key: 'confirmed', label: 'CONFIRMED', num: true, sort: r => (r.summary.honest || {}).confirmed || 0, render: r => String((r.summary.honest || {}).confirmed || 0) },
      { key: 'run', label: 'Run', sort: r => runKey(r.summary), render: r => r.summary.run_date || '' }
    ], clients, { sortKey: 'inh', dir: -1 }));
    // the inherited pattern across the book: the findings tagged inherited, counted by title
    const counts = new Map();
    for (const t of clients) {
      const byId = new Map((t.payload.findings || []).map(f => [f.id, f]));
      for (const r of (((t.payload.modules || {}).agency || {}).inherited_vs_owned || [])) {
        if (r.side !== 'inherited') continue;
        const f = byId.get(r.finding_id); const title = f ? f.title : r.why; if (!title) continue;
        const e = counts.get(title) || { title, n: 0, sev: f ? f.severity : '', targets: [] }; e.n++; e.targets.push(t.summary.domain); counts.set(title, e);
      }
    }
    const rows = [...counts.values()].sort((x, y) => y.n - x.n);
    out.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'The inherited pattern across its book'),
      rows.length ? h('div', null, h('p', { class: 'small dim' }, 'Findings the Omega tagged as inherited from the agency’s template, stack or process, counted across the audited targets. A pattern at two or more sites is a template fix, and the reverse Justice run is the offer.'),
        sortableTable([{ key: 'title', label: 'Finding', first: true, cls: 'wrap', render: r => r.title }, { key: 'sev', label: 'Severity', render: r => r.sev ? h('span', { class: 'pill ' + (r.sev === 'High' ? 'bad' : r.sev === 'Medium' ? 'warn' : 'off') }, r.sev) : '' }, { key: 'n', label: 'Sites', num: true, sort: r => r.n, render: r => String(r.n) }, { key: 't', label: 'Where', cls: 'wrap', render: r => r.targets.join(', ') }], rows, { sortKey: 'n', dir: -1 }))
        : h('p', { class: 'small dim' }, 'No inherited findings recorded on these targets.')));
  }
  return out;
}

/* ---------- shell ---------- */
let mainEl, railEl;

function openFull(hash) {
  if (IS_EXT && chrome.tabs && chrome.runtime) chrome.tabs.create({ url: chrome.runtime.getURL('app.html') + (hash || '') });
  else window.open((hash || ''), '_blank');
}

function shell() {
  document.title = 'Agency Radar';
  if (MODE === 'panel') document.body.classList.add('panel');
  const searchHost = h('div', { class: 'search' });
  themeBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Change theme', onclick: cycleTheme });
  paintThemeBtn();
  const tools = h('div', { class: 'tools' }, themeBtn,
    MODE === 'panel' ? h('button', { class: 'iconbtn', type: 'button', onclick: () => openFull(location.hash), title: 'Open the full dashboard' }, icon('open'), h('span', { class: 'wide' }, 'Full view')) : null);
  const mast = h('header', { class: 'mast' }, h('div', { class: 'wrap mast-in' },
    h('a', { class: 'brand', href: '#pulse', 'aria-label': 'OmegaWeapon home' }, brandMark(), h('span', null, h('span', { class: 'wm' }, 'OmegaWeapon'), h('span', { class: 'sub' }, 'Agency Radar · Horus ' + ED.edition + ' · ' + TARGETS.size + (TARGETS.size === 1 ? ' target' : ' targets')))),
    searchHost, tools));
  mountSearch(searchHost);
  railEl = h('nav', { class: 'rail', 'aria-label': 'Views' }, h('div', { class: 'wrap tabs' },
    VIEWS.map(([k, l]) => h('a', { class: 'tab' + (k === 'horus' ? ' horus' : ''), href: '#' + k, dataset: { v: k } }, k === 'horus' ? h('span', { class: 'eye-dot' }) : null, l,
      k === 'watch' ? h('span', { class: 'n', id: 'watch-n' }) : k === 'compare' ? h('span', { class: 'n', id: 'cmp-n' }) : null))));
  mainEl = h('main', { class: 'wrap', id: 'main', tabindex: '-1' });
  const foot = h('footer', { class: 'wrap foot' },
    h('span', null, 'OmegaWeapon ' + (OT.meta && OT.meta.version ? OT.meta.version : '2.0') + ' · Agency Radar: ' + A.length + ' agencies, compiled ' + D.meta.generated + ' · Horus ' + ED.stem + ' · ' + TARGETS.size + ' target' + (TARGETS.size === 1 ? '' : 's')),
    h('span', null, 'Public sources only. Derived reads are labelled as derived. ', h('a', { href: '#method' }, 'Method')));
  let root = document.getElementById('app-root');
  if (!root) { root = h('div', { id: 'app-root' }); document.body.appendChild(root); }
  root.replaceChildren(mast, railEl, mainEl, foot);
  const bootMsg = document.getElementById('boot-msg'); if (bootMsg) bootMsg.remove();
  document.body.appendChild(tipEl);
}

function paintCounts() {
  const w = document.getElementById('watch-n'); if (w) w.textContent = store.data.watch.length ? String(store.data.watch.length) : '';
  const c = document.getElementById('cmp-n'); if (c) c.textContent = store.data.compare.length ? String(store.data.compare.length) : '';
}

function render() {
  hideTip();
  const r = parseHash();
  const token = (location.hash || '').slice(1) || r.view;
  if (trail[trail.length - 1] !== token) trail.push(token);
  const active = r.view === 'agency' ? lastListView : r.view === 'target' ? 'targets' : r.view;
  railEl.querySelectorAll('.tab').forEach(t => { if (t.dataset.v === active) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  let v;
  try {
    if (r.view === 'agency') { v = viewAgency(r.id, r.tab); document.title = BYID.get(r.id).name + ' · OmegaWeapon'; }
    else if (r.view === 'target') { v = viewTarget(r.key, r.tab); const tt = TARGETS.get(r.key); document.title = (tt ? tt.summary.business : r.key) + ' · OmegaWeapon'; lastListView = 'targets'; }
    else if (r.view === 'panel') v = viewPanelHome();
    else {
      const fn = { pulse: viewPulse, targets: viewTargets, horus: viewHorus, offshore: viewOffshore, agencies: viewAgencies, matrix: viewMatrix, clients: viewClients, paid: viewPaid, gaps: viewGaps, compare: viewCompare, watch: viewWatch, method: viewMethod }[r.view] || viewPulse;
      if (['agencies', 'matrix', 'clients', 'paid', 'gaps', 'compare', 'watch', 'horus', 'offshore', 'pulse', 'targets'].includes(r.view)) lastListView = r.view;
      v = fn(r.anchor);
      document.title = (VIEWS.find(x => x[0] === r.view) || ['', 'Pulse'])[1] + ' · OmegaWeapon';
    }
  } catch (err) {
    console.error(err);
    v = h('div', { class: 'empty' }, 'This view failed to draw: ' + (err && err.message ? err.message : err));
  }
  mainEl.replaceChildren(v);
  paintCounts();
  if (r.view !== 'target') document.body.classList.remove('focus');
  if (!r.anchor) window.scrollTo({ top: 0 });
  else { const el = document.getElementById(r.anchor); if (el) el.scrollIntoView(); }
}

function viewPanelHome() {
  // side panel landing: the current site if it is tracked, else search and the watchlist
  const view = h('div', { class: 'view', style: { gap: '18px' } });
  view.appendChild(h('div', { class: 'stack' }, h('h2', null, 'OmegaWeapon'), h('p', { class: 'small dim' }, 'Open a tracked agency\u2019s site or an audited target and this panel shows its read. Or search above.')));
  const tl = targetsList();
  if (tl.length) view.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Targets'), h('div', { class: 'stack' }, tl.slice(0, 6).map(t => h('div', { class: 'row between' }, h('a', { href: '#t/' + t.summary.key }, t.summary.business), gradeBox(t.summary.overall || 'NA'))))));
  if (store.data.watch.length) view.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Watchlist'), h('div', { class: 'stack' }, store.data.watch.map(id => { const a = BYID.get(id); return h('div', { class: 'row between' }, h('a', { href: '#a.' + id + '.horus' }, a.name), bandTag(a.horus)); }))));
  view.appendChild(h('div', { class: 'card stack' }, h('h3', null, 'Strongest tailwind'), barList(A.filter(a => a.horus && a.horus.ok).sort((x, y) => y.horus.hti - x.horus.hti).slice(0, 8).map(a => ({ label: a.name, value: a.horus.hti, display: signed(a.horus.hti), cls: 'pos', onClick: () => go('a.' + a.id + '.horus') })), { max: 80 })));
  return view;
}

function matchHost(url) {
  let host = ''; try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return null; }
  let best = null;
  for (const a of A) { const d = (a.domain || '').toLowerCase(); if (d && (host === d || host.endsWith('.' + d))) { if (!best || d.length > best.domain.length) best = a; } }
  return best;
}

async function boot() {
  await store.load();
  await loadTargets();
  applyTheme();
  shell();
  window.addEventListener('hashchange', render);
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (store.data.theme === 'system') render(); });
  // extension: the side panel follows a requested agency (from the popup) or the active tab when auto-detect is on
  if (IS_EXT && MODE === 'panel' && chrome.storage && chrome.storage.session) {
    try {
      const r = await chrome.storage.session.get('panelAgency');
      if (r && r.panelAgency && BYID.has(r.panelAgency) && !location.hash) location.hash = 'a.' + r.panelAgency + '.horus';
      if (r && r.panelTarget && TARGETS.has(r.panelTarget) && !location.hash) location.hash = 't/' + r.panelTarget;
      chrome.storage.onChanged.addListener((ch, area) => { if (area === 'session' && ch.panelTarget && ch.panelTarget.newValue && TARGETS.has(ch.panelTarget.newValue)) go('t/' + ch.panelTarget.newValue); });
      chrome.storage.onChanged.addListener((ch, area) => { if (area === 'session' && ch.panelAgency && ch.panelAgency.newValue && BYID.has(ch.panelAgency.newValue)) go('a.' + ch.panelAgency.newValue + '.horus'); });
    } catch (e) { /* ignore */ }
  }
  if (IS_EXT && MODE === 'panel' && chrome.permissions && chrome.tabs) {
    try {
      const has = await chrome.permissions.contains({ permissions: ['tabs'] });
      if (has) {
        const follow = async () => {
          try {
            const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            const hit = t && t.url ? matchHost(t.url) : null;
            const th = t && t.url ? matchTargetHost(t.url) : null;
            const cur = parseHash();
            if (th && !(cur.view === 'target' && cur.key === th.summary.key)) go('t/' + th.summary.key);
            else if (hit && !(cur.view === 'agency' && cur.id === hit.id)) go('a.' + hit.id + '.horus');
          } catch (e) { /* ignore */ }
        };
        chrome.tabs.onActivated.addListener(follow);
        chrome.tabs.onUpdated.addListener((tid, info) => { if (info.url) follow(); });
        if (!location.hash) follow();
      }
    } catch (e) { /* ignore */ }
  }
  if (IS_EXT && chrome.storage) chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.radar && ch.radar.newValue) { Object.assign(store.data, ch.radar.newValue); paintCounts(); } });
  render();
}
boot();

})();
