/* SEVERANCE kit: the shared helpers the build 2 modules use (Site Forge, Publish, Accounts, Competitor Watch, Signal Desk, the Campaign
   Desk bulk files and the Compliance Screen engine). Loaded after 00_core.js; every name here is unique across the classic scripts. */
'use strict';
/* ---- where the atlas is running: the browser extension (chrome or firefox), the claude.ai viewer, or a file or web page */
const RT = (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime && globalThis.browser.runtime.id) ? globalThis.browser : (typeof globalThis.chrome !== 'undefined' && globalThis.chrome.runtime && globalThis.chrome.runtime.id) ? globalThis.chrome : null;
const inViewer = () => !!(window.claude && typeof window.claude.use === 'function');
const ENV = RT ? ((typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime && globalThis.browser.runtime.id && navigator.userAgent.includes('Firefox')) ? 'firefox' : 'chrome') : inViewer() ? 'viewer' : 'file';
const ENV_LABEL = { chrome: 'the Severance browser extension', firefox: 'the Severance add-on for Firefox', viewer: 'the hosted viewer', file: 'a page opened from disk or the web' }[ENV];

/* ---- small utilities */
const slug = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const el = (tag, attrs, html) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html != null) e.innerHTML = html; return e; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const phoneFmt = p => { const d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7)}`; if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`; return String(p || ''); };
const pctRank = (arr, v) => { const b = arr.filter(isN); return b.length && isN(v) ? 100 * b.filter(x => x < v).length / b.length : null; };

/* ---- events between modules: BUS.on('firm', f), BUS.emit('firm', firm). Events: firm, theme, actuals, plan, forge, watch, signals */
const BUS = { h: {}, on(e, f) { (this.h[e] = this.h[e] || []).push(f); }, emit(e, d) { (this.h[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(err); } }); } };

/* ---- toast */
const TOAST = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(TOAST);
let toastT; function toast(msg) { TOAST.textContent = msg; TOAST.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => TOAST.classList.remove('on'), 2800); }

/* ---- files. saveFile downloads (the viewer's downloads capability when hosted); text that may not download also opens the copy box */
async function saveFile(filename, data, o) {
  o = o || {};
  if (inViewer()) {
    let dl = null; try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
    if (dl) { try { await dl.save({ filename, data }); toast('Saved ' + filename); } catch (e) { const c = e && e.code; toast(c === 'declined' ? 'Download canceled' : c === 'rate_limited' ? 'A save prompt is already open' : 'Could not save ' + filename + (c ? ' (' + c + ')' : '')); } return; }
    if (typeof data === 'string') { exportText(filename, data, mimeOf(filename)); return; }
    toast('Downloads are not enabled in this view'); return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeOf(filename) });
  try { const u = URL.createObjectURL(blob); const a = el('a', { href: u, download: filename }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2500); toast('Downloaded ' + filename); }
  catch (e) { if (typeof data === 'string') exportText(filename, data, mimeOf(filename)); else toast('Could not download ' + filename); }
  if (o.show && typeof data === 'string') exportText(filename, data, mimeOf(filename));
}
const mimeOf = f => /\.csv$/i.test(f) ? 'text/csv;charset=utf-8' : /\.tsv$/i.test(f) ? 'text/tab-separated-values;charset=utf-8' : /\.json$/i.test(f) ? 'application/json' : /\.html?$/i.test(f) ? 'text/html;charset=utf-8' : /\.php$/i.test(f) ? 'text/plain;charset=utf-8' : /\.zip$/i.test(f) ? 'application/zip' : /\.md$/i.test(f) ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
const csvQ = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/* toCSV(['a','b'], [[1,2],{a:1,b:2}], 'note line') — note lines are written as # comments above the header */
function toCSV(header, rows, note) { return (note ? note.split('\n').map(l => '# ' + l).join('\n') + '\n' : '') + header.map(csvQ).join(',') + '\n' + rows.map(r => (Array.isArray(r) ? r : header.map(h => r[h])).map(csvQ).join(',')).join('\n') + '\n'; }
const tsvQ = v => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ');
function toTSV(header, rows) { return header.map(tsvQ).join('\t') + '\n' + rows.map(r => (Array.isArray(r) ? r : header.map(h => r[h])).map(tsvQ).join('\t')).join('\n') + '\n'; }
/* parse CSV text into rows of strings (quotes, doubled quotes, CRLF, BOM, # comment lines before the header skipped) */
function parseCSV(text, delim) {
  text = String(text || '').replace(/^﻿/, ''); const d = delim || (text.split('\n', 1)[0].split('\t').length > text.split('\n', 1)[0].split(',').length ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"') q = true; else if (c === d) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== '') && !/^#/.test(String(r[0] || '')));
}
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
/* zipBlob([{name, data: string | Uint8Array}]) → a stored (uncompressed) zip Blob */
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
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) { const ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (_) { toast('Select the text and copy it'); } ta.remove(); }
}
/* read a picked or dropped file as text or as a data URL */
const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => rej(r.error || new Error('Could not read ' + f.name)); r.readAsText(f); });
const readDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => rej(r.error || new Error('Could not read ' + f.name)); r.readAsDataURL(f); });
/* open a file picker; resolves with the chosen File objects */
function pickFiles(accept, multiple) { return new Promise(res => { const i = el('input', { type: 'file', accept: accept || '', style: 'display:none' }); if (multiple) i.multiple = true; i.onchange = () => { res(Array.from(i.files || [])); i.remove(); }; document.body.appendChild(i); i.click(); }); }

/* ---- UI builders in the Severance idiom (panels, callouts, tiles) */
function panel(title, sub, body, o) { o = o || {}; return `<div class="panel${o.cls ? ' ' + o.cls : ''}"${o.id ? ` id="${o.id}"` : ''} style="margin-bottom:14px">${title ? `<h3>${title}</h3>` : ''}${sub ? `<div class="sub">${sub}</div>` : ''}${body || ''}</div>`; }
function callout(kind, title, html) { return `<div class="callout ${kind || ''}"><div class="h">${esc(title)}</div>${/^\s*<(p|ul|ol|div|dl|table)\b/.test(html) ? html : `<p>${html}</p>`}</div>`; }
function toolbarHTML(title, sub, actions) { return `<div class="toolbar"><span class="ttl">${esc(title)}</span><span class="sub">${esc(sub || '')}</span><span class="sp"></span>${(actions || []).map(a => `<button type="button" class="btn${a.primary ? ' primary' : ''}${a.cls ? ' ' + a.cls : ''}" id="${a.id}"${a.title ? ` title="${esc(a.title)}"` : ''}>${esc(a.label)}</button>`).join('')}</div>`; }
function fieldHTML(f, val) {
  /* f: {k, l, t: text|url|email|tel|number|password|textarea|select|checkbox|date|color, hint, opts:[[v,l]], ph, step, min, max, wide} */
  const id = f.id || ('f_' + f.k); const v = val == null ? (f.def == null ? '' : f.def) : val; const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
  let inner;
  if (f.t === 'textarea') inner = `<textarea id="${id}" data-k="${esc(f.k)}" rows="${f.rows || 4}"${ph}>${esc(v)}</textarea>`;
  else if (f.t === 'select') inner = `<select id="${id}" data-k="${esc(f.k)}">${(f.opts || []).map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(v) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  else if (f.t === 'checkbox') return `<label class="chk"${f.hint ? ` title="${esc(f.hint)}"` : ''}><input type="checkbox" id="${id}" data-k="${esc(f.k)}"${v === true || v === 'true' ? ' checked' : ''}> ${esc(f.l)}</label>`;
  else inner = `<input type="${f.t === 'password' ? 'password' : f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : f.t === 'color' ? 'color' : 'text'}" id="${id}" data-k="${esc(f.k)}" value="${esc(v)}"${ph}${f.step ? ` step="${f.step}"` : ''}${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}${f.t === 'password' ? ' autocomplete="off"' : ''}${f.t === 'url' ? ' inputmode="url"' : f.t === 'email' ? ' inputmode="email"' : f.t === 'tel' ? ' inputmode="tel"' : ''}>`;
  return `<div class="ctl${f.wide ? ' wide' : ''}"><label for="${id}">${esc(f.l)}</label>${inner}${f.hint ? `<span class="hint">${f.hint}</span>` : ''}</div>`;
}
function readFieldsIn(root) { const o = {}; $$('[data-k]', root).forEach(i => { o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? (i.value === '' ? null : +i.value) : i.value; }); return o; }
/* segmented control: segHTML('id', [[v,label]], cur) then wireSeg($('#id'), v => ...) */
function segHTML(id, opts, cur) { return `<div class="seg" id="${id}" role="group">${opts.map(o => `<button type="button" data-v="${esc(o[0])}" aria-pressed="${String(o[0]) === String(cur)}">${esc(o[1])}</button>`).join('')}</div>`; }
function wireSeg(host, cb) { $$('button', host).forEach(b => b.onclick = () => { $$('button', host).forEach(x => x.setAttribute('aria-pressed', String(x === b))); cb(b.dataset.v); }); }
const pill = (txt, kind) => `<span class="pill ${kind || ''}">${esc(txt)}</span>`;
const sevPill = s => pill(s === 'block' ? 'Blocks' : s === 'fix' ? 'Fix' : s === 'warn' ? 'Review' : s === 'ok' ? 'Clear' : s, 'p-' + s);

/* ---- payload routing: goModule('publish', {pages}) mounts the module if needed and hands it the payload through m.receive */
function goModule(key, payload) { showModule(key, payload); }
