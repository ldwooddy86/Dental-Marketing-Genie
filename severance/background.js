/* Severance · browser extension background: the live watch.
   Runs as a service worker in Chrome, Edge and Brave and as an event page (background scripts) in Firefox 128 and later. On a timer
   (every 6 hours unless Options says otherwise) it reads the Texas Workforce Commission's WARN notices for the watched counties from
   data.texas.gov and Texas weekly initial claims from FRED, compares the notices with the ones it has already seen, notifies on new ones
   with the campaign rule each triggers (and on a weekly claims jump past the thresholds), and keeps the toolbar badge at the number of
   new notices in the last 14 days. The Live Desk (module 25) sends the firm's counties and thresholds here through storage.local
   ('sev.ext.options'); the popup and the Options page read the state this writes ('sev.ext.state').
   The parsers and the layoff rule repeat src/09_live_core.js (a service worker cannot load the atlas data); tests/live.test.mjs checks
   that both give the same answers. */
'use strict';
const SB = globalThis.browser || globalThis.chrome;
const SEV_OPT = 'sev.ext.options', SEV_ST = 'sev.ext.state', SEV_ALARM = 'sev-live';
const SEV_SOCRATA = 'https://data.texas.gov/resource/8w53-c4f6.json';
const SEV_FRED = id => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + id;
const SEV_DEF = { interval: 360, counties: [], notify: true, notifyKinds: ['warn', 'claims'], badge: true, warnMin: 25, lagFrom: 90, lagTo: 365, wow: 20, yoy: 15 };
const SEV_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------- dates (calendar days in UTC, as the desk counts them) ---------- */
const dU = s => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
const isoOf = d => d.toISOString().slice(0, 10);
const addD = (s, n) => { const d = dU(s); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
const diffD = (a, b) => Math.round((dU(b) - dU(a)) / 864e5);
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const localToday = () => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
const fmtD = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${SEV_MON[+m[2] - 1]} ${+m[3]}, ${m[1]}` : String(s || ''); };
function normDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) return v > 1e11 ? isoOf(new Date(v)) : null;
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/))) return ymd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return ymd(+m[1], +m[2], +m[3]);
  const t = Date.parse(s); return isFinite(t) ? isoOf(new Date(t)) : null;
}
const normInt = v => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, '')); return isFinite(n) ? Math.round(n) : null; };
const ckey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
const nkCounty = s => String(s || '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z]/g, '');
const warnKey = (county, date, company) => `${nkCounty(county)}|${date || ''}|${ckey(company)}`;

/* ---------- CSV and the two parsers (same rules as LIVE.parseWarn and LIVE.parseFred) ---------- */
function csvRows(text) {
  text = String(text || '').replace(/^﻿/, ''); const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
const csvObjects = text => { const r = csvRows(text); if (!r.length) return []; const h = r[0].map(x => x.trim()); return r.slice(1).map(x => { const o = {}; h.forEach((k, i) => { o[k] = x[i] == null ? '' : x[i]; }); return o; }); };
const WARN_FIELDS = {
  date: ['notice_date', 'date_of_notice', 'notice_received_date', 'received_date', 'date_received', 'noticedate', 'warn_date', 'date'],
  company: ['job_site_name', 'company_name', 'company', 'employer', 'employer_name', 'business_name', 'job_site', 'name'],
  county: ['county_name', 'county', 'job_site_county', 'countyname', 'county_s'],
  city: ['city_name', 'city', 'job_site_city', 'location_city', 'cityname'],
  workers: ['total_layoff_number', 'number_of_workers', 'total_layoffs', 'layoff_number', 'workers_affected', 'employees_affected', 'number_affected', 'no_of_employees', 'total_layoff', 'workers'],
  layoff: ['layoff_date', 'layoff_start_date', 'effective_date', 'date_of_layoff', 'layoff_begin_date', 'separation_date'],
  wda: ['wda_name', 'wdaname', 'workforce_development_area', 'wda']
};
const FUZZY = {
  date: k => /notice/.test(k) && /date|received/.test(k), company: k => /(company|employer|job_?site|business)/.test(k) && !/county|city|date|number/.test(k), county: k => /county/.test(k),
  city: k => /city/.test(k), workers: k => /(layoff|worker|employee|affected)/.test(k) && /(number|total|count|affected|workers|employees)/.test(k) && !/date/.test(k), layoff: k => /(layoff|separation|effective)/.test(k) && /date/.test(k), wda: k => /wda|workforce/.test(k)
};
const nkey = k => String(k).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
function warnRecords(input) {
  if (typeof input === 'string') { const t = input.trim(); if (/^[[{]/.test(t)) return warnRecords(JSON.parse(t)); return csvObjects(t); }
  if (Array.isArray(input)) return input.filter(r => r && typeof r === 'object');
  if (input && input.meta && input.meta.view && Array.isArray(input.data)) { const cols = (input.meta.view.columns || []).map(c => c.fieldName || c.name); return input.data.map(r => { const o = {}; cols.forEach((c, i) => { o[c] = Array.isArray(r) ? r[i] : r[c]; }); return o; }); }
  if (input && Array.isArray(input.data)) return input.data; if (input && Array.isArray(input.rows)) return input.rows;
  if (input && input.error) throw new Error('Socrata: ' + (input.message || input.error));
  throw new Error('No rows in the WARN response');
}
/* counties: [{fips, name}] watched; a county outside the list keeps its own name, title cased */
function parseWarn(input, counties) {
  const recs = warnRecords(input); const idx = {}; (counties || []).forEach(c => { idx[nkCounty(c.name)] = c; });
  const columns = []; recs.slice(0, 400).forEach(r => Object.keys(r).forEach(k => { if (!columns.includes(k) && !/^[:@]/.test(k)) columns.push(k); }));
  const byN = {}; columns.forEach(k => { byN[nkey(k)] = byN[nkey(k)] || k; });
  const mapped = {}, used = new Set();
  Object.keys(WARN_FIELDS).forEach(f => { const hit = WARN_FIELDS[f].find(c => byN[c] && !used.has(byN[c])); if (hit) { mapped[f] = byN[hit]; used.add(byN[hit]); } });
  Object.keys(WARN_FIELDS).forEach(f => { if (mapped[f]) return; const k = columns.find(c => !used.has(c) && FUZZY[f](nkey(c))); if (k) { mapped[f] = k; used.add(k); } });
  const rows = recs.map(r => {
    const g = f => mapped[f] ? r[mapped[f]] : null; const date = normDate(g('date')); const raw = String(g('county') || '').trim(); const hit = idx[nkCounty(raw)];
    const county = hit ? hit.name : raw.replace(/\s+county$/i, '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()); const company = String(g('company') || '').trim();
    return { id: warnKey(county, date, company), date, company, county, fips: hit ? hit.fips : null, city: String(g('city') || '').trim(), workers: normInt(g('workers')), layoff: normDate(g('layoff')) };
  }).filter(r => r.date || r.company);
  rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return { rows, mapped, columns, unknown: columns.filter(c => !used.has(c)), missing: ['date', 'county', 'workers'].filter(f => !mapped[f]) };
}
function parseFred(text) {
  const rows = csvRows(text); if (!rows.length) throw new Error('The FRED CSV is empty');
  if (/^\s*</.test(String(text))) throw new Error('FRED returned a web page, not a CSV');
  const h = rows[0].map(x => String(x).trim()); const di = h.findIndex(x => /^(date|observation_date)$/i.test(x));
  if (di < 0) throw new Error('No DATE or observation_date column in the FRED CSV (header: ' + h.join(', ') + ')');
  const vi = h.findIndex((x, i) => i !== di); if (vi < 0) throw new Error('No value column in the FRED CSV');
  const points = rows.slice(1).map(r => { const v = String(r[vi] == null ? '' : r[vi]).trim(); return { date: normDate(r[di]), value: v === '' || v === '.' ? null : Number(v) }; }).filter(p => p.date && p.value != null && isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
  return { id: h[vi], points };
}
function claimsCheck(pts, s) {
  if (!pts || pts.length < 2) return null; const n = pts.length, last = pts[n - 1], prev = pts[n - 2];
  const near = d => { let best = null; for (const p of pts) { const k = Math.abs(diffD(p.date, d)); if (k <= 3 && (!best || k < best.k)) best = { p, k }; } return best ? best.p : null; };
  const wowPct = prev.value ? (last.value / prev.value - 1) * 100 : null;
  const w4 = pts.slice(-4); const w4y = w4.map(p => near(addD(p.date, -364)));
  const sum4 = w4.length === 4 ? w4.reduce((a, p) => a + p.value, 0) : null, sum4y = w4y.every(Boolean) ? w4y.reduce((a, p) => a + p.value, 0) : null;
  const yoyPct = sum4 != null && sum4y ? (sum4 / sum4y - 1) * 100 : null; const yago = near(addD(last.date, -364));
  return { last, prev, wowPct, w4: sum4, w4yago: sum4y, yoyPct, yago, flags: { wow: wowPct != null && wowPct >= s.wow, yoy: yoyPct != null && yoyPct >= s.yoy } };
}

/* ---------- the rules (the desk's layoff and claims rules) ---------- */
function warnRule(n, o, today) {
  const start = addD(n.date, o.lagFrom), end = addD(n.date, o.lagTo);
  return { id: 'warn:' + n.id, kind: 'warn', county: n.county, date: n.date, start, end, status: today < start ? 'upcoming' : today > end ? 'past' : 'active', workers: n.workers, company: n.company,
    title: `${n.company || 'Employer'}: ${n.workers != null ? n.workers.toLocaleString('en-US') : 'an unstated number of'} workers, ${n.county} County`,
    rule: `Lift modification and enforcement in ${n.county} County from ${fmtD(start)} to ${fmtD(end)}. Protective orders unaffected.` };
}
function claimsRule(ck, o, today) {
  const wk = ck.last.date, start = addD(wk, o.lagFrom), end = addD(wk, o.lagTo);
  const why = [ck.flags.wow ? `up ${Math.round(ck.wowPct)}% on the week before` : '', ck.flags.yoy ? `four weeks up ${Math.round(ck.yoyPct)}% on a year earlier` : ''].filter(Boolean).join(', ');
  return { id: 'claims:' + wk, kind: 'claims', county: 'Texas', date: wk, start: wk, end, status: today > end ? 'past' : 'active', title: `Texas initial claims ${Math.round(ck.last.value).toLocaleString('en-US')}, week ending ${fmtD(wk)} (${why})`,
    rule: `Lift modification and enforcement from ${fmtD(start)} to ${fmtD(end)}; trim divorce lines 10% for 30 days and lift them 10% at the twelve month mark. Protective orders unaffected.` };
}
function buildTriggers(notices, ck, o, today) {
  const out = (notices || []).filter(n => n.date && (n.workers == null || n.workers >= o.warnMin) && diffD(n.date, today) <= o.lagTo).map(n => warnRule(n, o, today)).filter(t => t.status !== 'past');
  if (ck && (ck.flags.wow || ck.flags.yoy)) out.push(claimsRule(ck, o, today));
  const SO = { active: 0, upcoming: 1, past: 2 };
  return out.sort((a, b) => SO[a.status] - SO[b.status] || String(b.date).localeCompare(String(a.date))).slice(0, 20);
}

/* ---------- storage, fetch, badge ---------- */
const sget = async (k, d) => { try { const r = await SB.storage.local.get(k); return r && r[k] !== undefined ? r[k] : d; } catch (e) { return d; } };
const sset = (k, v) => SB.storage.local.set({ [k]: v });
const opts = async () => Object.assign({}, SEV_DEF, await sget(SEV_OPT, {}));
const msgOf = e => (e && e.status ? 'HTTP ' + e.status : e && e.name === 'TimeoutError' ? 'no answer within 20 seconds' : (e && e.message) || String(e));
async function getRes(url, kind) {
  const sig = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(20000) : undefined;
  const r = await fetch(url, { headers: { Accept: kind === 'json' ? 'application/json' : 'text/csv,text/plain,*/*' }, signal: sig });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return kind === 'json' ? r.json() : r.text();
}
function warnURL(names) { const q = [`$order=${encodeURIComponent('notice_date DESC')}`, '$limit=500']; if (names.length) q.push(`$where=${encodeURIComponent(`upper(county_name) in (${names.map(n => `'${String(n).toUpperCase().replace(/'/g, "''")}'`).join(',')})`)}`); return SEV_SOCRATA + '?' + q.join('&'); }
async function fetchWarn(counties) {
  let json, fallback = false;
  try { json = await getRes(warnURL(counties.map(c => c.name)), 'json'); }
  catch (e) { if (!e.status || e.status >= 500) throw e; fallback = true; json = await getRes(SEV_SOCRATA + '?$limit=2000', 'json'); }
  const p = parseWarn(json, counties); const keep = new Set(counties.map(c => nkCounty(c.name)));
  if (counties.length) p.rows = p.rows.filter(r => keep.has(nkCounty(r.county))); p.fallback = fallback; return p;
}
async function hasHosts() { try { return await SB.permissions.contains({ origins: ['https://data.texas.gov/*'] }); } catch (e) { return true; } }
const ACT = SB.action || SB.browserAction;
async function badge(text, color, title) { if (!ACT) return; try { await ACT.setBadgeText({ text: String(text || '') }); if (color) await ACT.setBadgeBackgroundColor({ color }); if (ACT.setBadgeTextColor) { try { await ACT.setBadgeTextColor({ color: '#ffffff' }); } catch (e) { } } if (title) await ACT.setTitle({ title }); } catch (e) { } }
const shortId = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
async function notify(id, title, message) { if (!SB.notifications) return; try { await SB.notifications.create('sev-' + shortId(id), { type: 'basic', iconUrl: 'icons/icon128.png', title: String(title).slice(0, 120), message: String(message).slice(0, 400), priority: 1 }); } catch (e) { } }

/* ---------- one check ---------- */
let running = null;
async function tick(reason) { if (running) return running; running = check(reason).finally(() => { running = null; }); return running; }
async function check(reason) {
  const o = await opts(); const st = await sget(SEV_ST, {}); const today = localToday(); const out = { at: new Date().toISOString(), reason, errors: [] };
  if (!(await hasHosts())) { out.error = 'Site access to data.texas.gov is not granted yet: open Options and click Grant site access.'; out.errors.push(out.error); await sset(SEV_ST, Object.assign({}, st, { last: out })); await badge('!', '#c0392b', 'Severance live watch: ' + out.error); return out; }
  const counties = (o.counties || []).filter(c => c && c.name); const kinds = o.notifyKinds || [];
  let warn = null, fred = null;
  try { warn = await fetchWarn(counties); } catch (e) { out.errors.push('WARN notices: ' + msgOf(e)); }
  try { fred = parseFred(await getRes(SEV_FRED('TXICLAIMS'), 'csv')); } catch (e) { out.errors.push('FRED TXICLAIMS: ' + msgOf(e)); }
  const next = Object.assign({}, st, { last: out });
  if (warn) {
    const first = !Array.isArray(st.seen); const seen = new Set(st.seen || []);
    const fresh = warn.rows.filter(r => !seen.has(r.id) && r.date && diffD(r.date, today) <= 60 && (r.workers == null || r.workers >= o.warnMin));
    if (!first && o.notify && kinds.includes('warn')) {
      for (const r of fresh.slice(0, 3)) { const t = warnRule(r, o, today); await notify(t.id, `WARN notice: ${r.workers != null ? r.workers.toLocaleString('en-US') + ' workers' : 'layoff'}, ${r.county} County`, `${r.company || 'An employer'}, noticed ${fmtD(r.date)}. ${t.rule}`); }
      if (fresh.length > 3) await notify('more-' + out.at, `${fresh.length - 3} more WARN notices`, 'Open the Live Desk for the full list and the windows they open.');
    }
    next.seen = [...new Set(warn.rows.map(r => r.id).concat(st.seen || []))].slice(0, 3000);
    next.notices = warn.rows.slice(0, 80); next.mapped = warn.mapped; next.unknown = warn.unknown; next.fallback = warn.fallback; next.noticesAt = out.at; out.fresh = first ? 0 : fresh.length;
  }
  let ck = null;
  if (fred) {
    ck = claimsCheck(fred.points, o); const week = ck ? ck.last.date : null;
    if (ck && (ck.flags.wow || ck.flags.yoy) && st.claimsWeek && st.claimsWeek !== week && o.notify && kinds.includes('claims')) { const t = claimsRule(ck, o, today); await notify(t.id, `Texas weekly claims jump: ${Math.round(ck.last.value).toLocaleString('en-US')}`, `${t.title}. ${t.rule}`); }
    next.claimsWeek = week || st.claimsWeek; next.claims = ck ? { last: ck.last, prev: ck.prev, wowPct: ck.wowPct, yoyPct: ck.yoyPct, flags: ck.flags, at: out.at } : null;
  } else if (st.claims) { ck = st.claims.last ? st.claims : null; }
  const notices = next.notices || [];
  const recent = notices.filter(n => n.date && diffD(n.date, today) >= 0 && diffD(n.date, today) <= 14);
  next.summary = { fetched: out.at, scope: counties.map(c => c.name), new14: recent.length, workers14: recent.reduce((a, n) => a + (n.workers || 0), 0), notices: notices.slice(0, 30), triggers: buildTriggers(notices, ck && ck.flags ? ck : null, o, today), claims: next.claims || null,
    sources: { warn: warn ? { ok: true, n: warn.rows.length, fallback: warn.fallback } : { ok: false, error: out.errors.find(e => /^WARN/.test(e)) || '' }, fred: fred ? { ok: true, n: fred.points.length } : { ok: false, error: out.errors.find(e => /^FRED/.test(e)) || '' } } };
  await sset(SEV_ST, next);
  const s = next.summary; const tip = `Severance live watch · ${counties.length ? counties.map(c => c.name).slice(0, 4).join(', ') + (counties.length > 4 ? ' and more' : '') : 'all of Texas'}\n${s.new14} new WARN notice${s.new14 === 1 ? '' : 's'} in 14 days${s.workers14 ? ', ' + s.workers14.toLocaleString('en-US') + ' workers' : ''}\n${s.claims && s.claims.last ? 'Texas claims ' + Math.round(s.claims.last.value).toLocaleString('en-US') + ', week ending ' + fmtD(s.claims.last.date) : 'Claims not read'}${out.errors.length ? '\n' + out.errors.join('\n') : ''}\nChecked ${new Date(out.at).toLocaleTimeString()}`;
  if (!warn && !fred) await badge('?', '#647a6e', tip);
  else if (o.badge === false) await badge('', null, tip);
  else await badge(s.new14 ? String(s.new14) : '', '#1b4332', tip);
  return out;
}
async function schedule() { const o = await opts(); try { await SB.alarms.clear(SEV_ALARM); } catch (e) { } await SB.alarms.create(SEV_ALARM, { periodInMinutes: Math.max(30, +o.interval || 360), delayInMinutes: 0.5 }); }
const watchSig = o => JSON.stringify([(o.counties || []).map(c => c.name), o.warnMin, o.lagFrom, o.lagTo, o.wow, o.yoy]);

/* ---------- listeners (registered synchronously at the top level, as a service worker needs) ---------- */
SB.runtime.onInstalled.addListener(() => { schedule(); });
SB.runtime.onStartup.addListener(() => { schedule(); });
SB.alarms.onAlarm.addListener(a => { if (a && a.name === SEV_ALARM) tick('alarm'); });
SB.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local' || !ch[SEV_OPT]) return; const a = Object.assign({}, SEV_DEF, ch[SEV_OPT].oldValue || {}), b = Object.assign({}, SEV_DEF, ch[SEV_OPT].newValue || {});
  if (+a.interval !== +b.interval) schedule(); if (watchSig(a) !== watchSig(b)) tick('options'); else if (a.badge !== b.badge) tick('badge');
});
SB.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg && msg.type === 'sev:refresh') { tick('manual').then(r => respond({ ok: true, at: r && r.at, errors: r ? r.errors : [] }), e => respond({ ok: false, error: String(e && e.message || e) })); return true; }
  if (msg && msg.type === 'sev:open') { SB.tabs.create({ url: SB.runtime.getURL('app.html') + (msg.hash || '#live') }); respond({ ok: true }); return false; }
  return false;
});
if (SB.notifications && SB.notifications.onClicked) SB.notifications.onClicked.addListener(id => { SB.tabs.create({ url: SB.runtime.getURL('app.html') + '#live' }); try { SB.notifications.clear(id); } catch (e) { } });
