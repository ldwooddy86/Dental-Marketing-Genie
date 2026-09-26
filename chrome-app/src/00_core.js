/* ==== core ==== */
"use strict";
/* ============================ data ============================ */
const DATA = window.__ATLAS_DATA__ || JSON.parse(document.getElementById('atlas-data').textContent);
const META = DATA.meta;
const ZC = DATA.zcols;
const Z = DATA.zrows.map(r => { const o = {}; ZC.forEach((k, i) => o[k] = r[i]); return o; });
const ZI = {}; Z.forEach(z => ZI[z.zip] = z);
const ZR = Z.filter(z => z.occ >= 200 && z.idx != null);     // residential ZIPs scored by the models
const CO = DATA.counties; const COI = {}; CO.forEach(c => COI[c.fips] = c);
const FIPS = CO.map(c => c.fips);
const CNAME = f => (COI[f] || {}).name || '';
Z.forEach(z => { z.fips = z.ci != null ? FIPS[z.ci] : null; z.cty = CNAME(z.fips); });
const CITIES = DATA.cities;
const COMP = DATA.comp;
const BENCH = COMP.find(l => l.tier === 'integrity');

/* ============================ helpers ============================ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const nf = new Intl.NumberFormat('en-US');
const isN = v => v != null && !Number.isNaN(+v) && Number.isFinite(+v);
const N = v => isN(v) ? nf.format(Math.round(v)) : '—';
const D = (v, d = 1) => isN(v) ? (+v).toFixed(d) : '—';
const S = (v, d = 1) => isN(v) ? ((v > 0 ? '+' : '') + (+v).toFixed(d)) : '—';
const P = (v, d = 1) => isN(v) ? (+v).toFixed(d) + '%' : '—';
const M$ = v => isN(v) ? '$' + nf.format(Math.round(v)) : '—';
const MM = v => { if (!isN(v)) return '—'; const a = Math.abs(v); return a >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? '$' + (v / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M' : a >= 1e3 ? '$' + (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K' : '$' + Math.round(v); };
const K = v => { if (!isN(v)) return '—'; const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e4 ? Math.round(v / 1e3) + 'k' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(Math.round(v)); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => { const t = document.documentElement.dataset.theme; if (t === 'dark') return true; if (t === 'light') return false; return matchMedia('(prefers-color-scheme: dark)').matches; };
const G = g => String(g).split('/').map(x => `<span class="g g-${x.trim().toLowerCase()[0]}">${esc(x.trim())}</span>`).join('');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = a => a.reduce((s, x) => s + (isN(x) ? +x : 0), 0);
const mean = a => { const b = a.filter(isN); return b.length ? sum(b) / b.length : null; };
const median = a => { const b = a.filter(isN).map(Number).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const pctRank = (arr, v) => { const b = arr.filter(isN); return b.length ? 100 * b.filter(x => x < v).length / b.length : null; };
const pearson = (xs, ys) => { const p = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => isN(x) && isN(y)); const n = p.length; if (n < 3) return NaN; const mx = sum(p.map(q => q[0])) / n, my = sum(p.map(q => q[1])) / n; let a = 0, b = 0, c = 0; p.forEach(([x, y]) => { a += (x - mx) * (y - my); b += (x - mx) ** 2; c += (y - my) ** 2; }); return a / Math.sqrt(b * c); };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
const el = (tag, attrs, html) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html != null) e.innerHTML = html; return e; };
const svgEl = (tag, attrs, text) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

const BPSU1 = y => sum(FIPS.map(f => DATA.bps.u1[f][DATA.bps.years.indexOf(y)] || 0));
const BOOM1 = [2000, 2001, 2002, 2003, 2004, 2005, 2006].reduce((a, y) => a + BPSU1(y), 0);
const BOOM2 = [2020, 2021, 2022, 2023, 2024].reduce((a, y) => a + BPSU1(y), 0);

/* ============================ copy rules (house style) ============================ */
/* Copy and content that leaves the atlas (ads, pages, posts) carries no hyphen or dash of any kind and no meta notes. */
const DASH_RE = /[‐-―−\-]/;
function houseClean(s) {
  if (s == null) return s;
  return String(s)
    .replace(/\s*[—–―]\s*/g, ', ')
    .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 to $2')
    .replace(/\bR-?(22|410A|454B|32|407C)\b/gi, (m, g) => 'R' + g.toUpperCase())
    .replace(/(\w)-(\w)/g, '$1 $2')
    .replace(/[‐-―−-]/g, ' ')
    .replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}
const phoneFmt = p => { const d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7)}`; if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`; return String(p || ''); };

/* ============================ color ============================ */
const RAMPS = {
  ember: { l: ['#fdeee3', '#fad7bf', '#f5b791', '#ee9463', '#e0703d', '#c65223', '#9c3a14', '#6b270c'], d: ['#2b1b13', '#472611', '#683212', '#8f4214', '#bb5719', '#e0712c', '#f39c61', '#fcd0ab'] },
  blue: { l: ['#e3edf9', '#cde2fb', '#b0d0f5', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'], d: ['#152638', '#1b3450', '#22456b', '#2c5a8c', '#3e79b4', '#649ad4', '#96c0ef', '#d7e8fb'] },
  teal: { l: ['#e1f2f0', '#c3e6e2', '#9dd6cf', '#6fc1b8', '#3ea79d', '#178a80', '#0b6f6d', '#064847'], d: ['#10272a', '#123638', '#15484a', '#185d5d', '#1f7775', '#2f9690', '#56b8b1', '#a3ddd8'] },
  div: { l: ['#1c5cab', '#3e7fcf', '#79a7e2', '#b6cfee', '#efeeec', '#f3c0b4', '#e8887a', '#d35645', '#a8302b'], d: ['#9bc4f0', '#6a9fdc', '#3f78b8', '#27507f', '#393a38', '#7e3a33', '#b44e45', '#dd7466', '#f2ab9f'] }
};
const ramp = name => RAMPS[name][isDark() ? 'd' : 'l'];
const CAT = () => [1, 2, 3, 4, 5, 6, 7, 8].map(i => cssv('--s' + i));
function textOn(hex) { if (!hex || hex[0] !== '#') return cssv('--ink'); const h = hex.slice(1); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#10191f' : '#ffffff'; }
/* quantile scale into n classes; dir 1 = high values dark (need), -1 = inverted; returns fn + breaks */
function qScale(vals, rampName, dir) {
  const R = ramp(rampName), n = R.length; const v = vals.filter(isN).map(Number).sort((a, b) => a - b);
  if (!v.length) return { f: () => null, breaks: [], R };
  const uniq = [...new Set(v)];
  const breaks = R.map((_, i) => v[Math.min(v.length - 1, Math.ceil(v.length * (i + 1) / n) - 1)]);
  const f = x => { if (!isN(x)) return null; let i = 0; if (uniq.length <= n) { i = Math.round(uniq.indexOf(+x) * (n - 1) / Math.max(1, uniq.length - 1)); if (i < 0) i = 0; } else { while (i < n - 1 && x > breaks[i]) i++; } return dir === -1 ? R[n - 1 - i] : R[i]; };
  return { f, breaks, R: dir === -1 ? [...R].reverse() : R, lo: v[0], hi: v[v.length - 1] };
}
function divScale(vals, center) {
  const R = ramp('div'); const v = vals.filter(isN).map(Number); if (!v.length) return { f: () => null, R };
  const dev = Math.max(...v.map(x => Math.abs(x - center))) || 1; const h = (R.length - 1) / 2;
  const f = x => { if (!isN(x)) return null; const t = clamp((x - center) / dev, -1, 1); return R[Math.round(h + t * h)]; };
  return { f, R, lo: center - dev, hi: center + dev };
}
function catScale(keys, colors) { const m = {}; keys.forEach((k, i) => m[k] = colors[i % colors.length]); return x => m[x] || null; }

/* ============================ tooltip / toast ============================ */
const TIP = el('div', { id: 'tip', role: 'tooltip' }); document.body.appendChild(TIP);
function showTip(html, e) { TIP.innerHTML = html; TIP.classList.add('on'); const r = TIP.getBoundingClientRect(); let x = e.clientX + 16, y = e.clientY + 16; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 16; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 16; TIP.style.left = Math.max(8, x) + 'px'; TIP.style.top = Math.max(8, y) + 'px'; }
function hideTip() { TIP.classList.remove('on'); }
const tipRow = (l, v) => `<div class="tr"><span>${l}</span><b>${v}</b></div>`;
const TOAST = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(TOAST);
let toastT; function toast(msg) { TOAST.textContent = msg; TOAST.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => TOAST.classList.remove('on'), 2600); }

/* ============================ files ============================ */
const inViewer = () => !!(window.claude && typeof window.claude.use === 'function');
async function saveFile(filename, data) {
  if (inViewer()) {
    let dl = null; try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
    if (dl) { try { await dl.save({ filename, data }); toast('Saved ' + filename); } catch (e) { const c = e && e.code; toast(c === 'declined' ? 'Download canceled' : c === 'rate_limited' ? 'A save prompt is already open' : 'Could not save ' + filename + (c ? ' (' + c + ')' : '')); } return; }
    toast('Downloads are not enabled in this view'); return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/.test(filename) ? 'text/csv;charset=utf-8' : /\.json$/.test(filename) ? 'application/json' : /\.html?$/.test(filename) ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' });
  const u = URL.createObjectURL(blob); const a = el('a', { href: u, download: filename }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2500); toast('Downloaded ' + filename);
}
const csvQ = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function toCSV(header, rows, note) { return (note ? note.split('\n').map(l => '# ' + l).join('\n') + '\n' : '') + header.map(csvQ).join(',') + '\n' + rows.map(r => (Array.isArray(r) ? r : header.map(h => r[h])).map(csvQ).join(',')).join('\n') + '\n'; }
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipBlob(files) {
  const enc = new TextEncoder(); const parts = [], central = []; let offset = 0; const now = new Date();
  const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  for (const f of files) {
    const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data; const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name); offset += 30 + name.length + data.length;
  }
  const cd = central.reduce((t, x) => t + x.length, 0); const eo = new DataView(new ArrayBuffer(22)); eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, files.length, true); eo.setUint16(10, files.length, true); eo.setUint32(12, cd, true); eo.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(eo.buffer)], { type: 'application/zip' });
}
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) { const ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (_) { toast('Select the text and copy it'); } ta.remove(); }
}

/* ============================ UI builders ============================ */
function kpiHTML(items) { return items.map(k => `<div class="kpi"><div class="kl"><span>${k.l}</span>${k.g ? G(k.g) : ''}</div><div class="kv">${k.v}</div><div class="kd">${k.d || ''}</div></div>`).join(''); }
function mastHTML(o) {
  return `<div class="mast"><div class="in"><div class="eyebrow">${o.eyebrow}</div><h1>${o.title}</h1><p class="dek">${o.dek}</p><div class="rule"></div><div class="meta">${(o.meta || []).map(m => `<span>${m}</span>`).join('')}</div></div></div>
  <div class="mbar"><div class="in"><span class="ttl">${o.bar}</span><span class="sub">${o.barsub || ''}</span><span class="spacer"></span>${(o.actions || []).map(a => `<button class="ibtn" id="${a.id}" title="${esc(a.title || '')}">${a.label}</button>`).join('')}<button class="ibtn" data-theme-toggle title="Switch light and dark">◐ Theme</button></div></div>`;
}
function callout(kind, title, html) { return `<div class="callout ${kind || ''}"><span class="ct">${title}</span>${html}</div>`; }
function card(title, sub, body, cls) { return `<div class="card ${cls || ''}"><div class="card-h"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div><div class="card-b">${body}</div></div>`; }
function srcRows(rows) { return `<div class="srcs">${rows.map(([l, s, g, v, u]) => `<div><span class="sl">${l}</span><span class="sr">${u ? `<a href="${u}" target="_blank" rel="noopener">${s}</a>` : s} ${g ? G(g) : ''} <span class="mini">${v || ''}</span></span></div>`).join('')}</div>`; }
function judgList(items) { return `<dl class="dl">${items.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`; }
function proseTable(rows, head) { return `<div class="xscroll"><table class="prose">${head ? `<thead><tr>${head.map(h => `<th class="l">${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
/* sortable data table */
function dataTable(host, cols, rows, opts) {
  opts = opts || {}; const st = host._st || { k: opts.sortKey || cols[0].k, dir: opts.sortDir || -1 }; host._st = st;
  const get = (r, c) => c.v ? c.v(r) : r[c.k];
  const sorted = rows.slice().sort((a, b) => { const c = cols.find(x => x.k === st.k) || cols[0]; const va = get(a, c), vb = get(b, c); if (typeof va === 'string' || typeof vb === 'string') return st.dir * String(va || '').localeCompare(String(vb || '')); if (!isN(va) && !isN(vb)) return 0; if (!isN(va)) return 1; if (!isN(vb)) return -1; return st.dir * (va - vb); });
  const lim = opts.limit ? sorted.slice(0, opts.limit) : sorted;
  host.innerHTML = `<table><thead><tr>${cols.map(c => `<th class="sort ${c.l ? 'l' : ''}" data-k="${c.k}" title="${esc(c.t || '')}">${c.h}${st.k === c.k ? (st.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead><tbody>${lim.map(r => `<tr class="${opts.rowClass ? opts.rowClass(r) : ''}${opts.onClick ? ' click' : ''}" data-id="${esc(opts.id ? opts.id(r) : '')}">${cols.map(c => `<td class="${c.l ? 'l' : ''} ${c.cls || ''}">${c.f ? c.f(get(c.raw ? { ...r } : r, c), r) : esc(get(r, c) ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $$('th.sort', host).forEach(th => th.onclick = () => { const k = th.dataset.k; st.dir = st.k === k ? -st.dir : (cols.find(c => c.k === k).l ? 1 : -1); st.k = k; dataTable(host, cols, rows, opts); });
  if (opts.onClick) $$('tbody tr', host).forEach(tr => tr.onclick = () => opts.onClick(tr.dataset.id));
}
function wireSeg(host, cb) { $$('button', host).forEach(b => b.onclick = () => { $$('button', host).forEach(x => x.setAttribute('aria-pressed', String(x === b))); cb(b.dataset.v); }); }

/* ============================ theme & router ============================ */
const BUS = { h: {}, on(e, f) { (this.h[e] = this.h[e] || []).push(f); }, emit(e, d) { (this.h[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(err); } }); } };
function toggleTheme() { document.documentElement.dataset.theme = isDark() ? 'light' : 'dark'; store.set('tda.theme', document.documentElement.dataset.theme); BUS.emit('theme'); }
document.addEventListener('click', e => { const t = e.target.closest('[data-theme-toggle]'); if (t) toggleTheme(); });
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && g.dataset.go) { e.preventDefault(); showModule(g.dataset.go); } });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.dataset.theme) BUS.emit('theme'); });
const MODS = []; const MODI = {};
function registerModule(m) { MODS.push(m); MODI[m.key] = m; }
function showModule(key, payload) {
  const m = MODI[key] || MODS[0];
  MODS.forEach(x => { const sec = $('#mod-' + x.key); if (sec) sec.hidden = x !== m; const b = $('#tab-' + x.key); if (b) b.setAttribute('aria-selected', String(x === m)); });
  const tb = $('#tab-' + m.key); if (tb && tb.parentElement && tb.parentElement.scrollWidth > tb.parentElement.clientWidth + 4) tb.parentElement.scrollLeft = Math.max(0, tb.offsetLeft - 16);
  if (!m.mounted) { m.mounted = true; try { m.mount($('#mod-' + m.key)); } catch (err) { console.error('mount ' + m.key, err); $('#mod-' + m.key).insertAdjacentHTML('afterbegin', `<div class="wrap"><div class="callout"><span class="ct">This module failed to load</span>${esc(err.message)}</div></div>`); } }
  if (payload && m.receive) { try { m.receive(payload); } catch (err) { console.error(err); } }
  if (m.onShow) { try { m.onShow(); } catch (err) { console.error(err); } }
  try { if (location.hash.slice(1) !== m.key) history.replaceState(null, '', '#' + m.key); } catch (e) { }
  window.scrollTo({ top: 0 });
}
function goModule(key, payload) { showModule(key, payload); }
