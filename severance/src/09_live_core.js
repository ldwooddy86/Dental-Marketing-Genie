/* SEVERANCE live core: LIVE, the signal layer of the Live Desk (module 25) and the model the browser extension's background watch
   repeats on a timer (background.js carries its own copy of the parsers and the WARN rule; tests/live.test.mjs checks they agree).
   The Thermal Atlas Weather Desk turned forecasts and alerts into hour by hour ad timing; this turns layoffs, unemployment claims and the
   legal and family calendar into day by day timing per family law service line.
     LIVE.snapshot()                 the embedded picture: WARN notices per county, weekly claims, county unemployment, the season index
     LIVE.refresh({force, fetch})    live sources where reachable: TWC WARN notices (data.texas.gov, Socrata 8w53-c4f6) and FRED TXICLAIMS,
                                     TXCCLAIMS; failures fall back to the snapshot and say why (LIVE.state.sources). Two optional sources:
                                     county unemployment from the BLS API (series LAUCN<fips>0000000003, monthly, cached a day) and the
                                     National Weather Service active alerts for Texas (api.weather.gov/alerts/active?area=TX), whose
                                     hurricane, flood and winter storm warnings set the hold rule
     LIVE.holds(o)                   the warnings in force over the scope counties: courts close, so new spend holds on every line except
                                     protective orders for the warning window (a trigger of kind 'hold'; timing() floors the day at minus 50)
     LIVE.outlook(o)                 per county shock outlook: divorce filings expected now, at 3 and at 12 months (the county econ fields),
                                     enforcement and modification from the D.panel lag model, the rebound landing now from last year's claims,
                                     and a category (dip, rebound, enf, quiet) with a plain sentence
     LIVE.narrative(o)               the next fourteen days in plain words: any hold, then one sentence per week with its reason and source
     LIVE.pushPlan()                 the lead line's daily multiplier for the next 42 days and the next deadline, for the toolbar popup
     LIVE.loadFile(text, name)       a downloaded WARN JSON or CSV, or a FRED CSV, used as live data (for pages where FRED blocks calls)
     LIVE.calendar(from, days, o)    the legal and family calendar: [{id, title, start, end, lines, lift, counties, action, source}]
     LIVE.triggers(o)                active and upcoming triggers for the scope counties: WARN notices, claims jumps, unemployment, calendar
     LIVE.timing(line, date, fips)   {mult, adj, parts, reasons}: the day's bid multiplier for a line (campaign level, or a county's combined)
     LIVE.series / windows           a run of days and the windows worth a bid adjustment
     LIVE.editorCSV / dailyCSV / windowsCSV / calendarCSV / ics / noticesCSV / snapshotJSON   exports
     LIVE.settings() / setSettings(patch)   counties, thresholds, campaign names (sev.live.settings); written to the extension's watch
   Pure helpers (also used by the tests): parseWarn, parseFred, csvRows, claimsCheck, normDate, warnKey, calendarYear, thanksgiving. */
'use strict';
const LIVE_HOST_ORIGINS = ['https://data.texas.gov/*', 'https://fred.stlouisfed.org/*'];   // build.mjs checks these against host_permissions
/* the optional sources' hosts: api.weather.gov answers browser pages (CORS), api.bls.gov needs the extension's host permission; both belong
   in manifest.json host_permissions (and then in LIVE_HOST_ORIGINS above) so the extension reaches them without a prompt */
const LIVE_OPT_ORIGINS = ['https://api.weather.gov/*', 'https://api.bls.gov/*'];
const LIVE = (() => {
  const SOCRATA = 'https://data.texas.gov/resource/8w53-c4f6.json';
  const WARN_PAGE = 'https://data.texas.gov/d/8w53-c4f6';
  const FRED_CSV = id => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + id;
  const FRED_PAGE = id => 'https://fred.stlouisfed.org/series/' + id;
  const NWS_ALERTS = 'https://api.weather.gov/alerts/active?area=TX', NWS_PAGE = 'https://www.weather.gov/documentation/services-web-api';
  const BLS_API = 'https://api.bls.gov/publicAPI/v2/timeseries/data/', BLS_PAGE = 'https://www.bls.gov/lau/';
  const lausId = f => 'LAUCN' + f + '0000000003';   /* LAU + CN + the five digit county FIPS + eight zeros + measure 03, the unemployment rate */
  /* the warnings that close courts: hurricane, flood and winter storm (ice storm and blizzard are winter storm warnings in NWS terms) */
  const HOLD_EVENTS = /^(hurricane warning|flood warning|flash flood warning|winter storm warning|ice storm warning|blizzard warning)$/i;
  const SET_KEY = 'sev.live.settings', CACHE_KEY = 'sev.live.cache', EXT_OPT = 'sev.ext.options', EXT_ST = 'sev.ext.state';
  const DEF = { counties: [], warnMin: 25, lagFrom: 90, lagTo: 365, wow: 20, yoy: 15, ctyYoy: 25, ctyMin: 50, urPts: 0.5, campaign: 'SEV_{KEY}_SEARCH', geo: 'county', ttl: 6, fredInPage: false, interval: 360, notifyKinds: ['warn', 'claims'], autoRefresh: true, nws: true, nwsHold: true, bls: true, blsInPage: false, blsKey: '' };
  const DIV_LINES = ['div_k', 'div_nk', 'high', 'gray'], ORDER_LINES = ['mod', 'enf'];
  const MIL = ['48027', '48099', '48141', '48029'];   // Bell, Coryell (Fort Hood), El Paso (Fort Bliss), Bexar (Joint Base San Antonio)
  const SEAS_KEY = { div_k: 'div_k', div_nk: 'div', sapcr: 'sapcr', mod: 'mod', enf: 'enf', po: 'po', ivd: 'ivd', high: 'div', mil: 'div', gray: 'div' };
  const LINE_FALLBACK = { div_k: 'Divorce with children', div_nk: 'Divorce without children', sapcr: 'Custody and SAPCR', mod: 'Modification', enf: 'Enforcement', po: 'Protective orders', ivd: 'Child support and paternity (IV-D)', adopt: 'Adoption', cps: 'CPS and termination defense', prenup: 'Premarital agreements', high: 'High asset divorce', mil: 'Military divorce', gray: 'Gray divorce (50 and over)' };
  const DOWN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- dates (UTC calendar days, no time zone drift) ---------- */
  const dU = s => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
  const isoOf = d => d.toISOString().slice(0, 10);
  const addD = (s, n) => { const d = dU(s); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
  const diffD = (a, b) => Math.round((dU(b) - dU(a)) / 864e5);
  const dowOf = s => dU(s).getUTCDay();
  const fmtD = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${MON[+m[2] - 1]} ${+m[3]}, ${m[1]}` : String(s || ''); };
  const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let NOW = null;
  const localToday = () => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const today = () => NOW || localToday();
  /* '2026-06-09T00:00:00.000', '2026-06-09', '06/09/2026', '6/9/26', '20260609', epoch ms → '2026-06-09' */
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
  const coName = s => { let t = typeof CO === 'function' ? CO(s) : String(s || ''); t = t.trim().replace(/[,(]\s*$/, '').trim(); const o = (t.match(/\(/g) || []).length, c = (t.match(/\)/g) || []).length; return o > c ? t + '\u2026)' : t; };
  const lineName = k => (typeof LINE_META !== 'undefined' && LINE_META[k] ? LINE_META[k].name : LINE_FALLBACK[k] || k);
  const lineShort = k => (typeof LINE_META !== 'undefined' && LINE_META[k] ? LINE_META[k].short : LINE_FALLBACK[k] || k);
  const lineKeys = () => (typeof LINE_META !== 'undefined' ? Object.keys(LINE_META) : Object.keys(LINE_FALLBACK));
  const round5 = v => Math.round(v / 5) * 5;
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const pctTxt = v => (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(Math.round(v)) + '%';

  /* ---------- CSV (quotes, doubled quotes, CRLF, BOM) ---------- */
  function csvRows(text) {
    text = String(text || '').replace(/^\uFEFF/, ''); const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
      if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
  }
  const csvObjects = text => { const r = csvRows(text); if (!r.length) return []; const h = r[0].map(x => x.trim()); return r.slice(1).map(x => { const o = {}; h.forEach((k, i) => { o[k] = x[i] == null ? '' : x[i]; }); return o; }); };

  /* ---------- WARN notices: tolerant field mapping ---------- */
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
    if (typeof input === 'string') { const t = input.trim(); if (/^[[{]/.test(t)) { try { return warnRecords(JSON.parse(t)); } catch (e) { throw new Error('The WARN file is not valid JSON: ' + e.message); } } return csvObjects(t); }
    if (Array.isArray(input)) return input.filter(r => r && typeof r === 'object');
    if (input && input.meta && input.meta.view && Array.isArray(input.data)) { const cols = (input.meta.view.columns || []).map(c => c.fieldName || c.name); return input.data.map(r => { const o = {}; cols.forEach((c, i) => { o[c] = Array.isArray(r) ? r[i] : r[c]; }); return o; }); }
    if (input && Array.isArray(input.data)) return input.data; if (input && Array.isArray(input.rows)) return input.rows;
    if (input && input.error) throw new Error('Socrata: ' + (input.message || input.error));
    throw new Error('No rows in the WARN response');
  }
  /* parseWarn(json | csv text) → {rows:[{id, date, company, county, fips, city, workers, layoff, wda, raw}], mapped, columns, unknown, missing} */
  function parseWarn(input, o) {
    o = o || {}; const recs = warnRecords(input);
    const columns = []; recs.slice(0, 400).forEach(r => Object.keys(r).forEach(k => { if (!columns.includes(k) && !/^[:@]/.test(k)) columns.push(k); }));
    const byN = {}; columns.forEach(k => { byN[nkey(k)] = byN[nkey(k)] || k; });
    const mapped = {}, used = new Set();
    Object.keys(WARN_FIELDS).forEach(f => { const hit = WARN_FIELDS[f].find(c => byN[c] && !used.has(byN[c])); if (hit) { mapped[f] = byN[hit]; used.add(byN[hit]); } });
    Object.keys(WARN_FIELDS).forEach(f => { if (mapped[f]) return; const k = columns.find(c => !used.has(c) && FUZZY[f](nkey(c))); if (k) { mapped[f] = k; used.add(k); } });
    const cidx = o.countyIndex || countyIndex();
    const rows = recs.map(r => {
      const g = f => mapped[f] ? r[mapped[f]] : null;
      const date = normDate(g('date')), countyRaw = String(g('county') || '').trim(), fips = cidx[nkCounty(countyRaw)] || null;
      const county = fips && typeof CI !== 'undefined' && CI[fips] ? CI[fips].name : countyRaw.replace(/\s+county$/i, '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
      const company = String(g('company') || '').trim();
      return { id: warnKey(county, date, company), date, company, county, fips, city: String(g('city') || '').trim(), workers: normInt(g('workers')), layoff: normDate(g('layoff')), wda: String(g('wda') || '').trim(), raw: r, src: o.src || 'live' };
    }).filter(r => r.date || r.company);
    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return { rows, mapped, columns, unknown: columns.filter(c => !used.has(c)), missing: ['date', 'county', 'workers'].filter(f => !mapped[f]) };
  }
  let CIDX = null;
  function countyIndex() { if (CIDX) return CIDX; CIDX = {}; if (typeof CTY !== 'undefined') CTY.forEach(c => { CIDX[nkCounty(c.name)] = c.fips; }); return CIDX; }

  /* ---------- FRED CSV: DATE or observation_date, then the series column; '.' is a missing value ---------- */
  function parseFred(text) {
    const rows = csvRows(text); if (!rows.length) throw new Error('The FRED CSV is empty');
    if (/^\s*</.test(String(text))) throw new Error('FRED returned a web page, not a CSV');
    const h = rows[0].map(x => String(x).trim()); const di = h.findIndex(x => /^(date|observation_date)$/i.test(x));
    if (di < 0) throw new Error('No DATE or observation_date column in the FRED CSV (header: ' + h.join(', ') + ')');
    const vi = h.findIndex((x, i) => i !== di); if (vi < 0) throw new Error('No value column in the FRED CSV');
    const points = rows.slice(1).map(r => { const v = String(r[vi] == null ? '' : r[vi]).trim(); return { date: normDate(r[di]), value: v === '' || v === '.' ? null : Number(v) }; }).filter(p => p.date && p.value != null && isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
    return { id: h[vi], points };
  }
  /* claimsCheck(points, {wow, yoy}) → week over week and four weeks against the same four weeks a year earlier */
  function claimsCheck(pts, s) {
    s = s || DEF; if (!pts || pts.length < 2) return null; const n = pts.length, last = pts[n - 1], prev = pts[n - 2];
    const near = d => { let best = null; for (const p of pts) { const k = Math.abs(diffD(p.date, d)); if (k <= 3 && (!best || k < best.k)) best = { p, k }; } return best ? best.p : null; };
    const wowPct = prev.value ? (last.value / prev.value - 1) * 100 : null;
    const w4 = pts.slice(-4); const w4y = w4.map(p => near(addD(p.date, -364)));
    const sum4 = w4.length === 4 ? w4.reduce((a, p) => a + p.value, 0) : null, sum4y = w4y.every(Boolean) ? w4y.reduce((a, p) => a + p.value, 0) : null;
    const yoyPct = sum4 != null && sum4y ? (sum4 / sum4y - 1) * 100 : null; const yago = near(addD(last.date, -364));
    return { last, prev, wowPct, w4: sum4, w4yago: sum4y, yoyPct, yago, flags: { wow: wowPct != null && wowPct >= s.wow, yoy: yoyPct != null && yoyPct >= s.yoy } };
  }

  /* ---------- settings ---------- */
  const sget = (k, d) => (typeof store !== 'undefined' ? store.get(k, d) : d), sset = (k, v) => { if (typeof store !== 'undefined') store.set(k, v); };
  let SET = Object.assign({}, DEF, sget(SET_KEY, {}));
  let VER = 0;
  const settings = () => SET;
  function setSettings(patch) { const prevInt = SET.interval; SET = Object.assign({}, SET, patch || {}); sset(SET_KEY, SET); VER++; pushExt({ force: true, interval: SET.interval !== prevInt }); emit(); return SET; }
  function resetSettings() { SET = Object.assign({}, DEF); sset(SET_KEY, SET); VER++; pushExt({ force: true }); emit(); return SET; }
  const emit = () => { if (typeof BUS !== 'undefined') BUS.emit('live', state); };
  const hasCty = f => typeof CI !== 'undefined' && !!CI[f];
  function scopeInfo() {
    const own = (SET.counties || []).filter(hasCty); if (own.length) return { fips: own, from: 'settings' };
    let firm = []; try { firm = typeof FIRM !== 'undefined' ? FIRM.counties().filter(hasCty) : []; } catch (e) { firm = []; }
    if (firm.length) return { fips: firm, from: 'firm' };
    const one = sget('sev.county', '48201'); return { fips: [hasCty(one) ? one : '48201'].filter(hasCty), from: 'default' };
  }
  const scope = () => scopeInfo().fips;

  /* ---------- live state, cache, refresh ---------- */
  const SRC = { warn: 'TWC WARN notices, data.texas.gov', icl: 'Texas initial claims, FRED TXICLAIMS', ccl: 'Texas continued claims, FRED TXCCLAIMS', laus: 'County unemployment, BLS LAUS API', nws: 'Weather warnings, National Weather Service' };
  const blank = () => ({ live: { warn: null, icl: null, ccl: null, laus: null, nws: null }, sources: { warn: { mode: 'snapshot' }, icl: { mode: 'snapshot' }, ccl: { mode: 'snapshot' }, laus: { mode: 'snapshot' }, nws: { mode: 'none' } }, fetched: null, loading: false, error: null });
  let state = blank();
  try { const c = sget(CACHE_KEY, null); if (c && c.fetched && Date.now() - Date.parse(c.fetched) < 30 * 864e5) { state.live = Object.assign(state.live, c.live || {}); state.sources = Object.assign(state.sources, c.sources || {}); state.fetched = c.fetched; } } catch (e) { }
  const env = () => (typeof ENV !== 'undefined' ? ENV : 'file');
  const canFetch = () => !(typeof inViewer === 'function' && inViewer());
  const inPage = () => env() !== 'chrome' && env() !== 'firefox';
  const fresh = () => state.fetched && Date.now() - Date.parse(state.fetched) < (SET.ttl || 6) * 36e5;
  const errText = (e, host) => { if (e && e.status) return `${host} answered HTTP ${e.status}${e.body ? ': ' + String(e.body).slice(0, 160) : ''}`; const m = e && e.message ? e.message : String(e); if (e && e.name === 'TimeoutError') return host + ' did not answer within 20 seconds'; return /fetch|network|load failed|cors/i.test(m) ? `${host} could not be reached from this ${inPage() ? 'page (blocked by the network or by CORS)' : 'extension (network)'}: ${m}` : m; };
  async function getRes(f, url, kind) {
    const sig = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(20000) : undefined;
    const r = await f(url, { headers: { Accept: kind === 'json' ? 'application/json' : 'text/csv,text/plain,*/*' }, signal: sig });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; try { e.body = await r.text(); } catch (_) { } throw e; }
    return kind === 'json' ? r.json() : r.text();
  }
  /* the Socrata query: newest first, the scope counties by name (upper case on both sides), 500 rows; a 400 (a column renamed) falls
     back to the plain endpoint and the counties are filtered here */
  function warnURL(names, limit) { const q = [`$order=${encodeURIComponent('notice_date DESC')}`, `$limit=${limit || 500}`]; if (names && names.length) q.push(`$where=${encodeURIComponent(`upper(county_name) in (${names.map(n => `'${String(n).toUpperCase().replace(/'/g, "''")}'`).join(',')})`)}`); return SOCRATA + '?' + q.join('&'); }
  async function fetchWarn(f, fipsList) {
    const names = fipsList.map(x => CI[x].name); let json, url = warnURL(names), fallback = false;
    try { json = await getRes(f, url, 'json'); }
    catch (e) { if (!e.status || e.status >= 500) throw e; fallback = true; url = SOCRATA + '?$limit=2000'; json = await getRes(f, url, 'json'); }
    const p = parseWarn(json, { src: 'live' }); const keep = new Set(fipsList);
    p.rows = p.rows.filter(r => !fipsList.length || (r.fips && keep.has(r.fips))); p.url = url; p.fallback = fallback; return p;
  }
  async function fetchFred(f, id) { const url = FRED_CSV(id); const p = parseFred(await getRes(f, url, 'csv')); p.url = url; return p; }
  /* the National Weather Service active alerts for Texas, kept only when one of the hold events covers a county (geocode.SAME '048113',
     or a county UGC 'TXC113'); dates are Central calendar days */
  const ctDay = iso => { if (!iso) return null; const d = new Date(iso); if (!isFinite(d.getTime())) return normDate(iso); try { const o = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).forEach(x => { o[x.type] = x.value; }); return `${o.year}-${o.month}-${o.day}`; } catch (e) { return String(iso).slice(0, 10); } };
  function parseNws(json) {
    if (!json || !Array.isArray(json.features)) throw new Error('The answer is not a GeoJSON list of alerts');
    const alerts = []; let seen = 0;
    json.features.forEach(ft => { const p = (ft && ft.properties) || {}; seen++; const ev = String(p.event || '').trim(); if (!HOLD_EVENTS.test(ev)) return; if (p.status && p.status !== 'Actual') return; if (p.messageType === 'Cancel') return;
      const g = p.geocode || {}; const fs = new Set(); (g.SAME || []).forEach(c => { const m = String(c).match(/^0?(48\d{3})$/); if (m) fs.add(m[1]); }); (g.UGC || []).forEach(c => { const m = String(c).match(/^TXC(\d{3})$/); if (m) fs.add('48' + m[1]); });
      const counties = [...fs].filter(hasCty).sort(); if (!counties.length) return; const start = p.onset || p.effective || p.sent || null, end = p.ends || p.expires || null;
      alerts.push({ id: String(p.id || (ft && ft.id) || ev + ':' + start), event: ev, headline: String(p.headline || ev).slice(0, 300), severity: p.severity || '', start, end, startDay: ctDay(start) || today(), endDay: ctDay(end || start) || today(), counties, area: String(p.areaDesc || '').slice(0, 300), sender: p.senderName || '' }); });
    return { alerts, seen };
  }
  async function fetchNws(f) { const p = parseNws(await getRes(f, NWS_ALERTS, 'json')); p.url = NWS_ALERTS; return p; }
  /* BLS LAUS county unemployment rates: one POST for up to 50 series (registration key optional), the latest month and the same month a
     year earlier; preliminary months are marked */
  function parseBls(j) {
    if (!j || typeof j !== 'object') throw new Error('The BLS answer is not JSON');
    if (j.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS: ' + ((j.message || []).join(' ') || j.status || 'request not processed'));
    const counties = {};
    ((j.Results || {}).series || []).forEach(sr => { const m = String(sr.seriesID || '').match(/^LAUCN(48\d{3})0{8}03$/); if (!m) return;
      const pts = (sr.data || []).filter(d => /^M(0[1-9]|1[0-2])$/.test(d.period) && isFinite(parseFloat(d.value))).map(d => ({ month: `${d.year}-${String(d.period).slice(1)}`, value: parseFloat(d.value), prelim: (d.footnotes || []).some(x => x && (x.code === 'P' || /prelim/i.test(x.text || ''))) })).sort((a, b) => a.month.localeCompare(b.month));
      if (!pts.length) return; const last = pts[pts.length - 1]; const ya = `${+last.month.slice(0, 4) - 1}-${last.month.slice(5)}`; const yago = pts.find(x => x.month === ya);
      counties[m[1]] = { last: last.month, ur: last.value, ur_yago: yago ? yago.value : null, prelim: last.prelim, points: pts.slice(-25) }; });
    return { counties, message: (j.message || []).filter(Boolean) };
  }
  async function fetchLaus(f, fipsList) {
    const ids = fipsList.slice(0, 50).map(lausId); const y = +today().slice(0, 4); const body = { seriesid: ids, startyear: String(y - 2), endyear: String(y) }; if (SET.blsKey) body.registrationkey = String(SET.blsKey).trim();
    const sig = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(20000) : undefined;
    const r = await f(BLS_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: sig });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; try { e.body = await r.text(); } catch (_) { } throw e; }
    const p = parseBls(await r.json()); p.url = BLS_API + ' (' + ids.length + ' series)'; p.scopeKey = fipsList.join(','); return p;
  }
  /* the latest county unemployment: the live BLS answer when it is as new as the snapshot or newer, else the snapshot */
  function lausOf(f) { const c = typeof CI !== 'undefined' ? CI[f] : null; const snapL = (c && c.laus) || {}; const L = state.live.laus && state.live.laus.counties ? state.live.laus.counties[f] : null; if (L && L.ur != null && (!snapL.last || String(L.last) >= String(snapL.last).slice(0, 7))) return Object.assign({}, snapL, { ur: L.ur, ur_yago: L.ur_yago != null ? L.ur_yago : snapL.ur_yago, last: L.last, prelim: L.prelim, live: true }); return Object.assign({ live: false }, snapL); }
  async function refresh(o) {
    o = o || {}; const f = o.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!canFetch()) { state.error = 'viewer'; Object.keys(SRC).forEach(k => { state.sources[k] = Object.assign({}, state.sources[k], { mode: state.live[k] ? 'cached' : (k === 'nws' ? 'none' : 'snapshot'), error: 'The hosted viewer blocks page network calls; the snapshot is shown.' }); }); emit(); return state; }
    if (!f) { state.error = 'This environment has no fetch.'; emit(); return state; }
    if (!o.force && fresh()) return state;
    state.loading = true; state.error = null; emit();
    const sc = scope(); const at = new Date().toISOString(); const page = inPage() && !o.fetch; const skip = why => Promise.reject(Object.assign(new Error('skipped'), { skipped: true, why }));
    const skipFred = page && !SET.fredInPage;
    const L = state.live.laus; const lausDue = !L || L.scopeKey !== sc.join(',') || Date.now() - Date.parse(L.at || 0) > (o.force ? 36e5 : 864e5);
    const jobs = { warn: fetchWarn(f, sc), icl: skipFred ? skip('cors') : fetchFred(f, 'TXICLAIMS'), ccl: skipFred ? skip('cors') : fetchFred(f, 'TXCCLAIMS'),
      laus: SET.bls === false ? skip('off') : (page && !SET.blsInPage) ? skip('cors') : !lausDue ? skip('fresh') : fetchLaus(f, sc),
      nws: SET.nws === false ? skip('off') : fetchNws(f) };
    const keys = Object.keys(jobs); const res = await Promise.allSettled(keys.map(k => jobs[k]));
    const HOST = { warn: 'data.texas.gov', icl: 'fred.stlouisfed.org', ccl: 'fred.stlouisfed.org', laus: 'api.bls.gov', nws: 'api.weather.gov' };
    res.forEach((r, i) => {
      const k = keys[i], host = HOST[k];
      if (r.status === 'fulfilled') { const v = r.value; state.live[k] = Object.assign({ at, scope: k === 'warn' || k === 'laus' ? sc : null }, v); const n = k === 'warn' ? v.rows.length : k === 'laus' ? Object.keys(v.counties).length : k === 'nws' ? v.alerts.length : v.points.length; state.sources[k] = { mode: 'live', at, n, url: v.url, fallback: !!v.fallback, unknown: v.unknown || [], missing: v.missing || [], seen: v.seen, message: v.message && v.message.length ? v.message.join(' ') : '', error: null }; }
      else { const e = r.reason; if (e && e.skipped && e.why === 'fresh') return; state.sources[k] = Object.assign({}, state.sources[k], { mode: state.live[k] ? 'cached' : (k === 'nws' ? 'none' : 'snapshot'), error: e && e.skipped ? (e.why === 'off' ? 'off' : 'skipped') : errText(e, host), tried: at }); }
    });
    state.loading = false; state.fetched = at; state.error = ['warn', 'icl', 'ccl'].every(k => res[keys.indexOf(k)].status === 'rejected') ? 'No live source answered; the snapshot is shown.' : null;
    sset(CACHE_KEY, { fetched: state.fetched, live: liveForCache(), sources: state.sources }); VER++; emit(); pushPlan(); return state;
  }
  const liveForCache = () => ({ warn: state.live.warn ? Object.assign({}, state.live.warn, { rows: state.live.warn.rows.slice(0, 600).map(r => Object.assign({}, r, { raw: r.raw })) }) : null, icl: state.live.icl, ccl: state.live.ccl, laus: state.live.laus, nws: state.live.nws });
  /* a file the user downloaded: a WARN export (JSON or CSV) or a FRED CSV */
  function loadFile(text, name) {
    const t = String(text || ''); const at = new Date().toISOString(); const head = t.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
    if (/^\s*"?(DATE|observation_date)"?\s*,/i.test(head)) {
      const p = parseFred(t); const k = /CCLAIMS/i.test(p.id) || /cclaims/i.test(name || '') ? 'ccl' : 'icl'; p.url = 'file: ' + (name || 'FRED CSV');
      state.live[k] = Object.assign({ at }, p); state.sources[k] = { mode: 'live', at, n: p.points.length, url: p.url, file: true, error: null };
      sset(CACHE_KEY, { fetched: state.fetched || at, live: liveForCache(), sources: state.sources }); VER++; emit(); return { kind: k, n: p.points.length, id: p.id };
    }
    const p = parseWarn(t, { src: 'file' }); if (p.missing.includes('date') || p.missing.includes('county')) throw new Error('This file has no notice date or county column; mapped: ' + (Object.keys(p.mapped).join(', ') || 'none') + '. Columns: ' + p.columns.join(', '));
    p.url = 'file: ' + (name || 'WARN export'); state.live.warn = Object.assign({ at, scope: null }, p); state.sources.warn = { mode: 'live', at, n: p.rows.length, url: p.url, file: true, unknown: p.unknown, missing: p.missing, error: null };
    state.fetched = state.fetched || at; sset(CACHE_KEY, { fetched: state.fetched, live: liveForCache(), sources: state.sources }); VER++; emit(); return { kind: 'warn', n: p.rows.length };
  }
  function clearLive() { state = blank(); sset(CACHE_KEY, null); VER++; emit(); }

  /* ---------- snapshot: the embedded data ---------- */
  const lfOf = c => (c && c.laus && c.laus.lf) || (c && c.pools && c.pools.lf_w) || null;
  const weekly = (week0, arr) => (arr || []).map((v, i) => ({ date: addD(week0, 7 * i), value: v })).filter(p => p.value != null && isFinite(p.value));
  let SNAPN = null;
  function snapNotices() {
    if (SNAPN) return SNAPN; SNAPN = [];
    if (typeof CTY === 'undefined') return SNAPN;
    CTY.forEach(c => ((c.warn || {}).recent || []).forEach(r => { SNAPN.push({ id: warnKey(c.name, r.notice, r.co), date: r.notice, company: r.co, county: c.name, fips: c.fips, city: r.city || '', workers: normInt(r.n), layoff: r.layoff || null, src: 'snapshot' }); }));
    SNAPN.sort((a, b) => b.date.localeCompare(a.date)); return SNAPN;
  }
  function snapshot() {
    const m = typeof META !== 'undefined' ? META : {};
    return { compiled: m.compiled, warn_through: m.warn_through, ui_through: m.ui_through, laus_through: m.laus_through, notices: snapNotices(), claims: typeof ST !== 'undefined' ? weekly(ST.claims.week0, ST.claims.weekly) : [], seas: typeof ST !== 'undefined' ? ST.seas : {},
      counties: scope().map(f => { const c = CI[f]; const la = c.laus || {}, ui = c.ui || {}; return { fips: f, name: c.name, lf: lfOf(c), ur: la.ur, ur_yago: la.ur_yago, laus_last: la.last, warn12: (c.warn || {}).last12, w4: ui.w4, w13: ui.w13, w13_yago: ui.w13_yago, ui_last: ui.last_week, esi: c.esi }; }) };
  }
  /* notices: the snapshot and the live rows, one per notice (live wins), newest first */
  function notices(o) {
    o = o || {}; const by = new Map(); snapNotices().forEach(n => by.set(n.id, n));
    const lw = state.live.warn; if (lw && lw.rows) lw.rows.forEach(n => { const old = by.get(n.id); by.set(n.id, old ? Object.assign({}, old, n, { src: n.src, county: old.county, fips: old.fips || n.fips }) : n); });
    let rows = [...by.values()]; if (o.counties) { const k = new Set(o.counties); rows = rows.filter(r => r.fips && k.has(r.fips)); }
    return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
  function claimsSeries() {
    const l = state.live.icl; if (l && l.points && l.points.length > 8) return { points: l.points, src: 'FRED TXICLAIMS', live: true, at: l.at };
    return { points: typeof ST !== 'undefined' ? weekly(ST.claims.week0, ST.claims.weekly) : [], src: 'TWC weekly initial claims (snapshot)', live: false };
  }

  /* ---------- the legal and family calendar ---------- */
  const thanksgiving = y => { const d1 = dowOf(ymd(y, 11, 1)); return ymd(y, 11, 1 + ((4 - d1 + 7) % 7) + 21); };
  const secondTuesdayJan = y => { const d1 = dowOf(ymd(y, 1, 1)); return ymd(y, 1, 1 + ((2 - d1 + 7) % 7) + 7); };
  const seasIdx = (k, m) => (typeof ST !== 'undefined' && ST.seas && ST.seas[k] ? ST.seas[k][m] : null);
  const ixs = (k, m) => { const v = seasIdx(k, m); return v == null ? 'n/a' : String(Math.round(v)); };
  function calendarYear(y) {
    const even = y % 2 === 0, par = even ? 'even' : 'odd', tg = thanksgiving(y);
    const PC = 'the possessory conservator', MC = 'the managing conservator';
    const items = [
      { key: 'summer-notice', short: 'April 1 notice', kind: 'deadline', date: ymd(y, 4, 1), start: ymd(y, 3, 1), end: ymd(y, 4, 1), title: 'April 1: written notice designating extended summer possession', lines: ['sapcr', 'enf', 'div_k', 'mod'], lift: { sapcr: 10, enf: 5, div_k: 5 },
        action: `Under a standard possession order, ${PC} designates the extended summer period by written notice to ${MC} by April 1 (30 days within 100 miles, 42 days over 100 miles). Without the notice the order's default applies: July 1 to July 31 within 100 miles, June 15 to July 27 over 100 miles. Run summer schedule explainers and custody and enforcement consult ads through March.`, source: 'Tex. Fam. Code § 153.312(b), § 153.313' },
      { key: 'summer-counter', short: 'April 15', kind: 'deadline', date: ymd(y, 4, 15), start: ymd(y, 4, 15), end: ymd(y, 4, 15), title: 'April 15: the managing conservator\'s summer notice', lines: ['sapcr', 'enf'], lift: {},
        action: `${MC[0].toUpperCase() + MC.slice(1)} may claim summer weekends by written notice by April 15. Keep the possession FAQ and the March creative live until mid April.`, source: 'Tex. Fam. Code § 153.312(b), § 153.313' },
      { key: 'spring-break', short: 'Spring break', kind: 'window', date: ymd(y, 3, 1), start: ymd(y, 3, 1), end: ymd(y, 3, 22), title: `Spring break possession (${y} is an ${par} year)`, lines: ['enf', 'sapcr'], lift: { enf: 5 },
        action: `Within 100 miles ${even ? PC : MC} has spring vacation in ${y} (${PC} in even numbered years); over 100 miles ${PC} has it every year. School calendars set the week, usually in March. Enforcement ads on for the week after.`, source: 'Tex. Fam. Code § 153.312(b), § 153.313' },
      { key: 'school-out', short: 'School out', kind: 'window', date: ymd(y, 5, 20), start: ymd(y, 5, 20), end: ymd(y, 6, 14), title: 'School lets out: summer possession begins', lines: ['enf', 'sapcr'], lift: { enf: 5 },
        action: 'Designated summer periods start the day after school is dismissed for summer (late May to early June; dates vary by district). Exchange disputes and denied periods follow: enforcement and possession pages forward.', source: 'Tex. Fam. Code § 153.312(b); district calendars' },
      { key: 'summer-default', short: 'Summer periods', kind: 'window', date: ymd(y, 6, 15), start: ymd(y, 6, 15), end: ymd(y, 7, 31), title: 'Default summer possession: June 15 to July 27 and July 1 to July 31', lines: ['enf', 'sapcr'], lift: { enf: 10, sapcr: 5 },
        action: 'Where no April 1 notice was given the default periods run (June 15 to July 27 over 100 miles, July 1 to July 31 within 100 miles). A denied summer period is an enforcement matter: enforcement ads and the possession FAQ at full weight.', source: 'Tex. Fam. Code § 153.312(b), § 153.313; ch. 157 (enforcement)' },
      { key: 'school-start', short: 'School start', kind: 'window', date: ymd(y, 8, 1), start: ymd(y, 7, 15), end: ymd(y, 8, 31), title: 'School starts in August: modification and relocation questions', lines: ['mod', 'sapcr', 'div_k'], lift: { mod: 5, sapcr: 5 },
        action: `Primary residence, relocation and geographic restriction questions come before the school year. The season index already lifts modifications (August index ${ixs('mod', 7)}) and custody suits (${ixs('sapcr', 7)}); the calendar adds the creative: relocation and school district pages, modification consult ads.`, source: 'Statewide season index (OCA monthly filings, 2022 to 2025); Tex. Fam. Code § 156.101, § 153.134' },
      { key: 'thanksgiving', short: 'Thanksgiving', kind: 'holiday', date: tg, start: addD(tg, -21), end: addD(tg, 3), title: `Thanksgiving possession: ${even ? MC : PC} in ${y}`, lines: ['enf', 'sapcr'], lift: { enf: 10, sapcr: 5 },
        action: `Under a standard possession order ${PC} has Thanksgiving in odd numbered years and ${MC} in even numbered years, from school dismissal to the Sunday. In ${y} (${par}) it is ${even ? MC : PC}. Exchange questions run in the three weeks before: possession and enforcement ads on.`, source: 'Tex. Fam. Code § 153.314' },
      { key: 'christmas', short: 'Christmas', kind: 'holiday', date: ymd(y, 12, 28), start: ymd(y, 12, 1), end: ymd(y + 1, 1, 3), title: `Christmas vacation possession: ${even ? PC : MC} has the first half in ${y}`, lines: ['enf', 'sapcr'], lift: { enf: 10, sapcr: 5 },
        action: `The Christmas school vacation splits at noon December 28. In even numbered years ${PC} has the first half (school dismissal to noon December 28) and ${MC} the second; odd years reverse it. In ${y} (${par}) the first half is ${even ? PC : MC}'s. Enforcement ads on through the exchange; divorce consult creative staged for January.`, source: 'Tex. Fam. Code § 153.314' },
      { key: 'january-rise', short: 'January rise', kind: 'season', date: ymd(y, 1, 2), start: ymd(y, 1, 2), end: ymd(y, 1, 31), title: 'After the holidays: divorce filings climb from the December trough', lines: DIV_LINES.slice(), lift: {},
        action: `Divorce filings move from index ${ixs('div', 11)} in December to ${ixs('div', 0)} in January and keep climbing to March. Consults come four to eight weeks before a petition, so divorce search budgets step up in January. Applied through the season index, not added again.`, source: 'Statewide season index (OCA monthly filings, 2022 to 2025)' },
      { key: 'tax-refunds', short: 'Tax refunds', kind: 'window', date: ymd(y, 2, 1), start: ymd(y, 2, 1), end: ymd(y, 3, 31), title: 'Tax refund season: retainers get funded', lines: ['div_nk', 'div_k'], lift: { div_nk: 10, div_k: 5 },
        action: 'The IRS filing season opens in late January and refunds that claim the earned income or additional child tax credit cannot be issued before mid February. Refunds pay retainers: lead with the firm\'s flat fee and payment plan terms exactly as set in the firm profile (Rule 7.02 applies to any fee stated).', source: 'IRS filing season and PATH Act refund timing; Texas Disciplinary Rules 7.02' },
      { key: 'march-peak', short: 'March peak', kind: 'season', date: ymd(y, 3, 1), start: ymd(y, 3, 1), end: ymd(y, 3, 31), title: `March: the peak divorce filing month (index ${ixs('div', 2)})`, lines: DIV_LINES.slice(), lift: {},
        action: `March filings run at index ${ixs('div', 2)} against an average month of 100; with the consult lead the search peak sits in February and March. Applied through the season index.`, source: 'Statewide season index (OCA monthly filings, 2022 to 2025)' },
      { key: 'pcs-season', short: 'Moving season', kind: 'window', date: ymd(y, 5, 1), start: ymd(y, 5, 1), end: ymd(y, 8, 31), counties: MIL.slice(), title: 'Military moving season: Fort Hood, Fort Bliss, Joint Base San Antonio', lines: ['mil', 'mod', 'sapcr'], lift: { mil: 20, mod: 10, sapcr: 5 },
        action: 'Summer is the peak season for military permanent change of station moves. Orders bring military divorce, relocation and modification questions in Bell and Coryell (Fort Hood, named Fort Cavazos from 2023 to 2025), El Paso (Fort Bliss) and Bexar (Joint Base San Antonio). Texas residency for divorce counts military stationing.', source: 'Department of Defense PCS peak season (Military OneSource); Tex. Fam. Code §§ 6.303 to 6.304' }
    ];
    if (!even) {
      const conv = secondTuesdayJan(y);
      items.push({ key: 'legislature', short: 'Session opens', kind: 'law', date: conv, start: conv, end: conv, title: `The ${y} regular session of the Texas Legislature convenes`, lines: [], lift: {}, action: 'Family law bills are filed and heard through May. Track the ones that would change what the firm\'s pages and ads say.', source: 'Tex. Gov\'t Code § 301.001' });
      items.push({ key: 'laws-effective', short: 'New laws', kind: 'law', date: ymd(y, 9, 1), start: ymd(y, 9, 1), end: ymd(y, 9, 1), title: 'September 1: most new Texas statutes take effect', lines: [], lift: {}, action: 'Most bills from the spring session take effect September 1. Update page copy, FAQs and ad claims that cite changed sections before that date, and rescreen them in the Compliance Screen.', source: 'Tex. Const. art. III, § 39; bill effective date clauses' });
    }
    return items.map(it => Object.assign({ id: it.key + '-' + y, year: y, counties: null }, it));
  }
  /* calendar(from, days, {counties, all}) → items that overlap [from, from + days − 1], sorted by start */
  function calendar(from, days, o) {
    o = o || {}; from = from || today(); days = days || 365; const to = addD(from, days - 1); const y0 = +from.slice(0, 4) - 1, y1 = +to.slice(0, 4);
    const sc = o.counties || scope(); let out = [];
    for (let y = y0; y <= y1; y++) out = out.concat(calendarYear(y));
    return out.filter(it => it.end >= from && it.start <= to && (o.all || !it.counties || it.counties.some(f => sc.includes(f)))).sort((a, b) => a.start.localeCompare(b.start) || a.date.localeCompare(b.date));
  }

  /* ---------- triggers ---------- */
  const warnStep = per1k => per1k >= 10 ? 30 : per1k >= 3 ? 20 : per1k >= 1 ? 10 : per1k > 0 ? 5 : 0;
  const statusOf = (start, end, d) => d < start ? 'upcoming' : d > end ? 'past' : 'active';
  function warnTrigger(n, d) {
    const c = CI[n.fips]; const lf = lfOf(c); const per1k = lf && n.workers ? n.workers / lf * 1000 : null; const step = warnStep(per1k || 0);
    const start = addD(n.date, SET.lagFrom), end = addD(n.date, SET.lagTo);
    return { id: 'warn:' + n.id, kind: 'warn', level: 'county', fips: n.fips, county: c.name, date: n.date, start, end, status: statusOf(start, end, d), live: n.src !== 'snapshot', notice: n,
      title: `${coName(n.company) || 'Employer'}: ${n.workers != null ? n.workers.toLocaleString('en-US') : 'an unstated number of'} workers, WARN notice`, detail: `${n.city ? n.city + '. ' : ''}Noticed ${fmtD(n.date)}${n.layoff ? ', layoff ' + fmtD(n.layoff) : ''}. ${per1k != null ? (Math.round(per1k * 100) / 100) + ' per 1,000 in the county labor force.' : ''}`,
      effects: [{ lines: ORDER_LINES.slice(), start, end, pct: step }], step, per1k,
      action: `Lift modification and enforcement in ${c.name} County from ${fmtD(start)} to ${fmtD(end)} (+${step}% for this notice; notices active together are sized on their combined workers). Support and possession orders come under strain 3 to 12 months after a layoff. Protective orders unaffected.`,
      source: n.src === 'snapshot' ? `Texas Workforce Commission WARN notices (snapshot through ${fmtD(typeof META !== 'undefined' ? META.warn_through : '')})` : n.src === 'file' ? 'Texas Workforce Commission WARN notices (a downloaded export loaded here)' : 'Texas Workforce Commission WARN notices, data.texas.gov (live)', grade: 'C' };
  }
  function claimsEffects(d, lift) {
    return [{ lines: ORDER_LINES.slice(), start: addD(d, SET.lagFrom), end: addD(d, SET.lagTo), pct: lift }, { lines: DIV_LINES.slice(), start: d, end: addD(d, 30), pct: -10 }, { lines: DIV_LINES.slice(), start: addD(d, 335), end: addD(d, 395), pct: 10 }];
  }
  function buildTriggers(d, sc) {
    const out = [];
    /* WARN notices in the scope counties, a year back plus the lag */
    const keep = new Set(sc); notices().filter(n => n.fips && keep.has(n.fips) && n.date && (n.workers == null || n.workers >= SET.warnMin) && diffD(n.date, d) <= SET.lagTo).forEach(n => out.push(warnTrigger(n, d)));
    /* statewide claims: FRED when live, else the snapshot */
    const cs = claimsSeries(); const ck = claimsCheck(cs.points, SET);
    if (ck && (ck.flags.wow || ck.flags.yoy)) {
      const wk = ck.last.date; const ef = claimsEffects(wk, 10); const why = [ck.flags.wow ? `up ${Math.round(ck.wowPct)}% on the week before` : '', ck.flags.yoy ? `the last four weeks up ${Math.round(ck.yoyPct)}% on a year earlier` : ''].filter(Boolean).join(' and ');
      out.push({ id: 'claims:TX:' + wk, kind: 'claims', level: 'state', fips: null, county: 'Texas', date: wk, start: wk, end: ef[0].end, status: statusOf(wk, ef[0].end, d), live: cs.live, effects: ef, step: 10,
        title: `Texas initial claims jump: ${Math.round(ck.last.value).toLocaleString('en-US')} in the week ending ${fmtD(wk)}`, detail: `Statewide weekly initial claims ${why} (${cs.src}).`,
        action: `Lift modification and enforcement statewide from ${fmtD(ef[0].start)} to ${fmtD(ef[0].end)} (+10%); trim divorce lines 10% for 30 days (filings dip the month claims surge) and lift them 10% from ${fmtD(ef[2].start)} to ${fmtD(ef[2].end)}, when the twelve month rebound lands. Protective orders unaffected.`, source: cs.src, grade: 'C' });
    }
    sc.forEach(f => {
      const c = CI[f]; const ui = c.ui;
      if (ui && ui.weekly && ui.week0) { const k = claimsCheck(weekly(ui.week0, ui.weekly), { wow: 1e9, yoy: SET.ctyYoy }); if (k && k.flags.yoy && k.w4 >= SET.ctyMin) { const wk = k.last.date; const ef = claimsEffects(wk, 15);
        out.push({ id: 'claims:' + f + ':' + wk, kind: 'claims', level: 'county', fips: f, county: c.name, date: wk, start: wk, end: ef[0].end, status: statusOf(wk, ef[0].end, d), live: false, effects: ef, step: 15,
          title: `${c.name} County claims up ${Math.round(k.yoyPct)}% on a year earlier`, detail: `${Math.round(k.w4).toLocaleString('en-US')} initial claims in the four weeks to ${fmtD(wk)} against ${Math.round(k.w4yago).toLocaleString('en-US')} a year earlier (TWC county claims, snapshot).`,
          action: `Lift modification and enforcement in ${c.name} County from ${fmtD(ef[0].start)} to ${fmtD(ef[0].end)} (+15%); trim divorce lines 10% for 30 days, lift them 10% at the twelve month mark. Protective orders unaffected.`, source: 'Texas Workforce Commission weekly claims by county (snapshot through ' + fmtD(ui.last_week) + ')', grade: 'C' }); } }
      const la = c.laus; if (la && la.ur != null && la.ur_yago != null && la.ur - la.ur_yago >= SET.urPts && la.last) { const m = la.last.match(/^(\d{4})-(\d{2})/); const md = m ? addD(+m[2] === 12 ? ymd(+m[1] + 1, 1, 1) : ymd(+m[1], +m[2] + 1, 1), -1) : d; const start = addD(md, 30), end = addD(md, 210);
        out.push({ id: 'unemp:' + f + ':' + la.last, kind: 'unemp', level: 'county', fips: f, county: c.name, date: md, start, end, status: statusOf(start, end, d), live: false, effects: [{ lines: ['mod'], start, end, pct: 5 }], step: 5,
          title: `${c.name} County unemployment ${la.ur}%, up ${(Math.round((la.ur - la.ur_yago) * 10) / 10)} points on a year earlier`, detail: `BLS LAUS, ${MONL[+la.last.slice(5, 7) - 1]} ${la.last.slice(0, 4)}: ${la.ur}% against ${la.ur_yago}% a year earlier.`,
          action: `Lift modification in ${c.name} County 5% from ${fmtD(start)} to ${fmtD(end)}: a drop in income is the usual ground for a support modification (material and substantial change, § 156.401). Lead with job loss language.`, source: 'BLS Local Area Unemployment Statistics (snapshot)', grade: 'C' }); }
    });
    /* calendar windows that are on now or start within 45 days */
    calendar(addD(d, -60), 120, { counties: sc }).forEach(it => { const st = statusOf(it.start, it.end, d); if (st === 'past' || (st === 'upcoming' && diffD(d, it.start) > 45)) return;
      const lifts = Object.keys(it.lift || {}); out.push({ id: 'cal:' + it.id, kind: 'calendar', level: it.counties ? 'county' : 'state', fips: it.counties ? it.counties.filter(f => sc.includes(f)) : null, county: it.counties ? it.counties.filter(f => sc.includes(f)).map(f => CI[f].name).join(', ') : 'Statewide', date: it.date, start: it.start, end: it.end, status: st, live: false, item: it,
        effects: lifts.length ? [{ lines: lifts, start: it.start, end: it.end, pct: null, lift: it.lift }] : [], step: lifts.length ? Math.max(...lifts.map(k => it.lift[k])) : 0, title: it.title, detail: `${fmtD(it.start)}${it.end !== it.start ? ' to ' + fmtD(it.end) : ''}.`, action: it.action, source: it.source, grade: it.kind === 'season' ? 'A' : 'B' }); });
    /* active first (statewide claims, then layoffs newest first, unemployment, the calendar), then upcoming soonest first */
    const KO = { claims: 0, warn: 1, unemp: 2, calendar: 3 }, SO = { active: 0, upcoming: 1, past: 2 };
    return out.sort((a, b) => SO[a.status] - SO[b.status] || (a.status === 'upcoming' ? a.start.localeCompare(b.start) || KO[a.kind] - KO[b.kind] : KO[a.kind] - KO[b.kind] || (a.level === 'state' ? -1 : 0) - (b.level === 'state' ? -1 : 0) || String(b.date).localeCompare(String(a.date))));
  }
  let TMEMO = { k: null, v: null };
  function trig(d, sc) { sc = sc || scope(); const k = [d, VER, sc.join(',')].join('|'); if (TMEMO.k !== k) TMEMO = { k, v: buildTriggers(d, sc) }; return TMEMO.v; }
  /* triggers({date, counties, past}) → active and upcoming (past ones only when asked) */
  function triggers(o) { o = o || {}; const d = o.date || today(); const sc = o.counties || scope(); const t = o.counties ? buildTriggers(d, sc) : trig(d, sc); return o.past ? t : t.filter(x => x.status !== 'past'); }

  /* ---------- day by day timing ---------- */
  function seasonFactor(line, date) {
    const k = (typeof LINE_META !== 'undefined' && LINE_META[line] ? LINE_META[line].seas : SEAS_KEY[line]) || null; if (!k || typeof ST === 'undefined' || !ST.seas || !ST.seas[k]) return null;
    const lead = line === 'po' ? 0 : 30; const t = addD(date, lead); const m = +t.slice(5, 7) - 1, day = +t.slice(8, 10); const dim = new Date(Date.UTC(+t.slice(0, 4), m + 1, 0)).getUTCDate();
    const pos = m + (day - 0.5) / dim - 0.5; const i0 = Math.floor(pos), fr = pos - i0; const a = ST.seas[k][(i0 + 12) % 12], b = ST.seas[k][(i0 + 13) % 12];
    return { idx: a + (b - a) * fr, m, lead, key: k };
  }
  /* the account's own pattern (module 23): one switch, ACCT.settings().useObserved, as the Thermal Atlas weather desk read it */
  const hasAcct = () => typeof ACCT !== 'undefined' && !!ACCT && typeof ACCT.settings === 'function';
  const useObserved = () => { try { return hasAcct() && !!ACCT.settings().useObserved; } catch (e) { return false; } };
  async function setUseObserved(v) { if (!hasAcct() || typeof ACCT.setSettings !== 'function') return false; try { await ACCT.setSettings({ useObserved: !!v }); } catch (e) { return false; } VER++; emit(); return true; }
  let OBS = { k: null, v: null };
  function observedDow(line) {
    if (!useObserved() || typeof ACCT.rowsAll !== 'function') return null;
    const k = VER + '|' + line + '|' + today(); if (OBS.k === k) return OBS.v;
    let leads = [], ads = []; try { leads = ACCT.rowsAll('lead') || []; ads = (ACCT.rowsAll('ads') || []).filter(r => r && r.hour == null); } catch (e) { leads = []; ads = []; }
    const from = addD(today(), -90);
    const cnt = (rs, val) => { const acc = [0, 0, 0, 0, 0, 0, 0]; let n = 0; rs.forEach(r => { const dd = r && normDate(r.date); if (!dd || dd < from) return; const v = val(r); if (!v) return; acc[dowOf(dd)] += v; n += v; }); return { acc, n }; };
    const adsVal = r => ((+r.leads || 0) + (+r.calls || 0)) || (+r.conv || 0);
    let v = null;
    for (const [L, A, txt] of [[leads.filter(r => r.line === line), ads.filter(r => r.line === line), 'this line'], [leads, ads, 'all lines']]) {
      let c = cnt(L, () => 1); if (c.n < 30) c = cnt(A, adsVal);
      if (c.n >= 30) { const w = c.n / (c.n + 60); v = { n: c.n, scope: txt, f: c.acc.map(x => 1 + w * (x / c.n * 7 - 1)) }; break; }
    }
    OBS = { k, v }; return v;
  }
  /* the observed hour blocks (ACCT.observedGrid: 7 days, Monday first, by 6 blocks, % adjustments) for the Editor ad schedule */
  const BLOCKS = [[0, 6], [6, 9], [9, 12], [12, 17], [17, 21], [21, 24]];
  function hourGrid() { if (!useObserved() || typeof ACCT.observedGrid !== 'function') return null; try { const g = ACCT.observedGrid(); return Array.isArray(g) && g.length === 7 && g.every(r => Array.isArray(r) && r.length === 6) ? g : null; } catch (e) { return null; } }
  let CALM = { k: null, v: null };
  function calIndex(asOf, sc) { const k = asOf + '|' + sc.join(','); if (CALM.k !== k) CALM = { k, v: calendar(addD(asOf, -60), 800, { counties: sc }).filter(it => Object.keys(it.lift || {}).length) }; return CALM.v; }
  const effectPct = (e, line) => e.lift ? (e.lift[line] || 0) : (e.lines.includes(line) ? e.pct : 0);
  /* timing(line, date, fips) → campaign level when fips is empty; with a county, the campaign factors times the county's own */
  function timing(line, date, fips, o) {
    o = o || {}; date = date || today(); const asOf = o.asOf || today(); const sc = o.counties || scope(); const T = trig(asOf, sc); const parts = [];
    const s = seasonFactor(line, date);
    if (s) parts.push({ kind: 'season', level: 'state', f: s.idx / 100, label: `Season: ${lineName(line)} filings ${s.lead ? 'a month ahead' : 'this month'} (${MONL[s.m]}) run at index ${Math.round(s.idx)}`, src: 'Statewide season index, OCA monthly filings 2022 to 2025' });
    const ob = observedDow(line); if (ob) { const f = ob.f[dowOf(date)]; parts.push({ kind: 'observed', level: 'state', f, label: `${DOWN[dowOf(date)]}s carry ${Math.round(f * 100)}% of an average day's leads (${ob.n} leads, ${ob.scope}, connected accounts)`, src: 'Accounts, module 23' }); }
    const take = t => t.effects.forEach(e => { const p = effectPct(e, line); if (!p || date < e.start || date > e.end) return; parts.push({ kind: t.kind, level: t.level, f: 1 + p / 100, label: `${t.kind === 'claims' ? 'Claims' : t.kind === 'unemp' ? 'Unemployment' : 'WARN'}: ${t.title} (${pctTxt(p)})`, src: t.source, id: t.id }); });
    /* calendar windows apply by their own dates (the trigger list only carries the ones due soon) */
    calIndex(asOf, sc).forEach(it => { const p = (it.lift || {})[line]; if (!p || date < it.start || date > it.end) return; if (it.counties && !(fips && it.counties.includes(fips))) return; parts.push({ kind: 'calendar', level: it.counties ? 'county' : 'state', f: 1 + p / 100, label: `Calendar: ${it.title} (${pctTxt(p)})`, src: it.source, id: 'cal:' + it.id }); });
    T.filter(t => t.level === 'state' && t.kind !== 'warn' && t.kind !== 'calendar').forEach(take);
    if (fips) {
      T.filter(t => t.level === 'county' && t.kind !== 'warn' && t.kind !== 'calendar' && t.fips === fips).forEach(take);
      if (ORDER_LINES.includes(line)) { const act = T.filter(t => t.kind === 'warn' && t.fips === fips && date >= t.start && date <= t.end); if (act.length) { const w = act.reduce((a, t) => a + (t.notice.workers || 0), 0); const lf = lfOf(CI[fips]); const per1k = lf ? w / lf * 1000 : 0; const step = warnStep(per1k || (w ? 0.01 : 0)); if (step) parts.push({ kind: 'warn', level: 'county', f: 1 + step / 100, label: `WARN: ${w.toLocaleString('en-US')} workers on ${act.length} notice${act.length > 1 ? 's' : ''} inside the 3 to 12 month window in ${CI[fips].name} County, ${Math.round(per1k * 100) / 100} per 1,000 in the labor force (+${step}%)`, src: 'Texas Workforce Commission WARN notices', ids: act.map(t => t.id) }); } }
    }
    let m = 1; parts.forEach(p => { m *= p.f; });
    const adj = clampN(round5((m - 1) * 100), -50, 90);
    const camp = parts.filter(p => p.level === 'state').reduce((a, p) => a * p.f, 1), cty = parts.filter(p => p.level === 'county').reduce((a, p) => a * p.f, 1);
    return { line, date, dow: DOWN[dowOf(date)], fips: fips || null, mult: m, adj, campaign: camp, county: cty, countyAdj: clampN(round5((cty - 1) * 100), -50, 90), parts, reasons: parts.filter(p => Math.abs(p.f - 1) >= 0.005).map(p => p.label) };
  }
  function series(line, fips, from, days, o) { from = from || today(); const out = []; for (let i = 0; i < (days || 90); i++) out.push(timing(line, addD(from, i), fips, o)); return out; }
  /* contiguous days at +15% or more, or −15% or less: the windows worth a bid adjustment */
  function windows(line, fips, from, days, o) {
    const s = series(line, fips, from, days || 90, o); const out = []; let cur = null;
    const note = (w, t) => t.parts.forEach(p => { if (p.kind === 'season') { const i = Math.round(p.f * 100); w.smin = Math.min(w.smin, i); w.smax = Math.max(w.smax, i); } else if (Math.abs(p.f - 1) >= 0.005) w.why.add(p.label.replace(/ \([+\u2212]?\d+%\)$/, '')); });
    s.forEach(t => { const k = t.adj >= 15 ? 'up' : t.adj <= -15 ? 'down' : null; if (k && cur && cur.kind === k) { cur.end = t.date; cur.n++; cur.sum += t.adj; cur.peak = k === 'up' ? Math.max(cur.peak, t.adj) : Math.min(cur.peak, t.adj); note(cur, t); } else { if (cur) out.push(cur); cur = k ? { kind: k, start: t.date, end: t.date, n: 1, sum: t.adj, peak: t.adj, why: new Set(), smin: Infinity, smax: -Infinity } : null; if (cur) note(cur, t); } });
    if (cur) out.push(cur);
    return out.map(w => Object.assign(w, { avg: round5(w.sum / w.n), why: (isFinite(w.smin) ? [`Season index ${w.smin === w.smax ? w.smin : w.smin + ' to ' + w.smax} for ${lineName(line)}`] : []).concat([...w.why]) }));
  }

  /* ---------- exports ---------- */
  const campName = (line, geo) => String(SET.campaign || DEF.campaign).replace(/\{KEY\}/g, line.toUpperCase()).replace(/\{LINE\}/g, lineShort(line)).replace(/\{GEO\}/g, geo || '');
  const geoTitle = sc => sc.length === 1 ? CI[sc[0]].name + ' County' : sc.length <= 3 ? sc.map(f => CI[f].name).join(', ') : sc.length + ' counties';
  const bidTxt = v => (v > 0 ? '+' : '') + v + '%';
  const firmLines = () => { let l = []; try { l = typeof FIRM !== 'undefined' ? FIRM.lines() : []; } catch (e) { l = []; } l = l.filter(k => lineKeys().includes(k)); return l.length ? l : ['div_k', 'div_nk', 'sapcr', 'mod', 'enf', 'po']; };
  const tocsv = (h, rows, note) => (note ? note.split('\n').map(l => '# ' + l).join('\n') + '\n' : '') + h.map(q).join(',') + '\n' + rows.map(r => r.map(q).join(',') + '\n').join('');
  const q = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  /* Google Ads Editor: one ad schedule row per day of the coming week (all seven, so the schedule never stops serving) and one location
     row per county (or per ZIP) with that county's own bid modifier, averaged over the same week. Re-import weekly. */
  function editorRows(o) {
    o = o || {}; const from = o.from || today(); const sc = o.counties || scope(); const lines = o.lines || firmLines(); const geo = o.geo || SET.geo || 'county'; const rows = [];
    lines.forEach(line => {
      const camp = campName(line, geoTitle(sc));
      const grid = o.hours === false ? null : hourGrid(); const hh = h => String(h).padStart(2, '0') + ':00';
      for (let i = 0; i < 7; i++) { const d = addD(from, i); const t = timing(line, d, null, { counties: sc }); const dw = dowOf(d); const why = t.parts.filter(p => p.level === 'state' && Math.abs(p.f - 1) >= 0.005).map(p => p.label);
        if (grid) BLOCKS.forEach(([a, b], j) => { const g = +grid[dw === 0 ? 6 : dw - 1][j] || 0; rows.push({ Campaign: camp, 'Ad Schedule': `(${DOWN[dw]})[${hh(a)}-${hh(b)}]`, Location: '', ID: '', 'Bid Modifier': bidTxt(clampN(round5((t.campaign * (1 + g / 100) - 1) * 100), -50, 90)), 'Criterion Type': '', Status: 'Enabled', _date: d, _reasons: why.concat(g ? [`Observed hours ${hh(a)} to ${hh(b)} (${pctTxt(g)})`] : []) }); });
        else rows.push({ Campaign: camp, 'Ad Schedule': `(${DOWN[dw]})[00:00-24:00]`, Location: '', ID: '', 'Bid Modifier': bidTxt(clampN(round5((t.campaign - 1) * 100), -50, 90)), 'Criterion Type': '', Status: 'Enabled', _date: d, _reasons: why }); }
      sc.forEach(f => { let acc = 0; for (let i = 0; i < 7; i++) acc += timing(line, addD(from, i), f, { counties: sc }).county; const adj = clampN(round5((acc / 7 - 1) * 100), -50, 90);
        const locs = geo === 'zip' && typeof ZC !== 'undefined' ? ZC.filter(z => z.county === f).map(z => `${z.zip}, Texas, United States`) : [`${CI[f].name} County, Texas, United States`];
        locs.forEach(loc => rows.push({ Campaign: camp, 'Ad Schedule': '', Location: loc, ID: '', 'Bid Modifier': bidTxt(adj), 'Criterion Type': 'Location', Status: 'Enabled', _county: CI[f].name })); });
    });
    return rows;
  }
  const EDITOR_H = ['Campaign', 'Ad Schedule', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status'];
  function editorCSV(o) { return tocsv(EDITOR_H, editorRows(o).map(r => EDITOR_H.map(h => r[h]))); }
  function dailyCSV(line, fips, o) {
    o = o || {}; const from = o.from || today(), days = o.days || 90; const s = series(line, fips, from, days, o);
    const H = ['date', 'day', 'campaign', 'county', 'season_factor', 'calendar_factor', 'trigger_factor', 'observed_day_factor', 'combined', 'bid_adjustment_pct', 'location_bid_modifier_pct', 'reasons'];
    const fx = (t, ks) => +t.parts.filter(p => ks.includes(p.kind)).reduce((a, p) => a * p.f, 1).toFixed(3);
    return tocsv(H, s.map(t => [t.date, t.dow, campName(line, geoTitle(o.counties || scope())), fips ? CI[fips].name : 'campaign level', fx(t, ['season']), fx(t, ['calendar']), fx(t, ['warn', 'claims', 'unemp']), fx(t, ['observed']), +t.mult.toFixed(3), t.adj, fips ? t.countyAdj : '', t.reasons.join(' | ')]),
      `Day by day plan for ${lineName(line)}${fips ? ', ' + CI[fips].name + ' County' : ', campaign level'}, ${fmtD(from)} to ${fmtD(addD(from, days - 1))}. Built ${new Date().toISOString().slice(0, 16)} from ${sourceLine()}.\nCombined = season x calendar x triggers x observed day of week; the bid adjustment is rounded to 5% and held between minus 50 and plus 90.`);
  }
  function windowsCSV(line, fips, o) {
    o = o || {}; const w = windows(line, fips, o.from, o.days || 90, o); const H = ['campaign', 'county', 'start_date', 'end_date', 'days', 'bid_adjustment_pct', 'peak_pct', 'direction', 'reasons'];
    return tocsv(H, w.map(x => [campName(line, geoTitle(o.counties || scope())), fips ? CI[fips].name : 'campaign level', x.start, x.end, x.n, x.avg, x.peak, x.kind === 'up' ? 'bid up' : 'bid down', x.why.join(' | ')]),
      `Bid windows for ${lineName(line)}: runs of days at plus 15% or more, or minus 15% or less. Google Ads: campaign bid adjustments by date need a script or a manual change on the start date; the Editor file carries the coming week as an ad schedule. ${sourceLine()}.`);
  }
  function calendarCSV(from, days, o) {
    const items = calendar(from || today(), days || 365, o); const H = ['start_date', 'end_date', 'key_date', 'title', 'lines', 'bid_lift', 'counties', 'ad_action', 'source'];
    return tocsv(H, items.map(it => [it.start, it.end, it.date, it.title, it.lines.map(lineShort).join('; '), Object.keys(it.lift || {}).map(k => lineShort(k) + ' ' + pctTxt(it.lift[k])).join('; ') || (it.kind === 'season' ? 'through the season index' : ''), it.counties ? it.counties.map(f => (CI[f] || {}).name || f).join('; ') : 'statewide', it.action, it.source]),
      'Severance legal and family calendar. Dates of school events vary by district; possession rules are the standard possession order defaults (Tex. Fam. Code ch. 153, subch. F) and an order can differ. Informational, not legal advice.');
  }
  /* RFC 5545: CRLF, all day events with an exclusive DTEND, text escaped, lines folded at 75 octets */
  function icsEsc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) { const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null; const len = s => enc ? enc.encode(s).length : s.length; if (len(line) <= 75) return line; const out = []; let cur = ''; for (const ch of line) { if (len(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ''; } cur += ch; } if (cur) out.push(cur); return out.join('\r\n '); }
  function ics(from, days, o) {
    const items = calendar(from || today(), days || 365, o); const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); const dt = s => s.replace(/-/g, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Severance//Live Desk//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc('Severance legal and family calendar')];
    items.forEach(it => { const desc = `${it.action}\nLines: ${it.lines.map(lineName).join(', ') || 'all'}.${Object.keys(it.lift || {}).length ? '\nBid lift: ' + Object.keys(it.lift).map(k => lineShort(k) + ' ' + pctTxt(it.lift[k])).join(', ') + '.' : ''}${it.counties ? '\nCounties: ' + it.counties.map(f => (CI[f] || {}).name || f).join(', ') + '.' : ''}\nSource: ${it.source}.`;
      L.push('BEGIN:VEVENT', 'UID:' + it.id + '@severance.live', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + dt(it.start), 'DTEND;VALUE=DATE:' + dt(addD(it.end, 1)), 'SUMMARY:' + icsEsc(it.title), 'DESCRIPTION:' + icsEsc(desc), 'CATEGORIES:' + icsEsc(it.kind), 'TRANSP:TRANSPARENT', 'END:VEVENT'); });
    L.push('END:VCALENDAR'); return L.map(icsFold).join('\r\n') + '\r\n';
  }
  function noticesCSV(o) {
    o = o || {}; const rows = notices({ counties: o.counties || scope() }); const lw = state.live.warn; const extra = lw && lw.unknown ? lw.unknown : [];
    const H = ['county', 'notice_date', 'company', 'city', 'workers', 'layoff_date', 'lift_from', 'lift_to', 'source'].concat(extra);
    return tocsv(H, rows.map(r => [r.county, r.date, r.company, r.city, r.workers, r.layoff, r.date ? addD(r.date, SET.lagFrom) : '', r.date ? addD(r.date, SET.lagTo) : '', r.src].concat(extra.map(k => r.raw ? r.raw[k] : ''))), `WARN notices for ${geoTitle(o.counties || scope())}. ${sourceLine()}.`);
  }
  function sourceLine() { const s = state.sources; return ['warn', 'icl'].map(k => `${SRC[k]}: ${s[k].mode === 'live' ? 'live ' + fmtD(s[k].at) : s[k].mode === 'cached' ? 'cached ' + fmtD((state.live[k] || {}).at) : 'snapshot'}`).join('; '); }
  function snapshotJSON() { return JSON.stringify({ severance_live: 1, built: new Date().toISOString(), scope: scope(), settings: SET, sources: state.sources, live: { warn: state.live.warn ? { at: state.live.warn.at, url: state.live.warn.url, mapped: state.live.warn.mapped, columns: state.live.warn.columns, rows: state.live.warn.rows.map(r => Object.assign({}, r, { raw: undefined })) } : null, icl: state.live.icl, ccl: state.live.ccl }, triggers: triggers().map(t => Object.assign({}, t, { notice: undefined, item: undefined })), calendar: calendar(today(), 365) }, null, 2); }

  /* ---------- the browser extension: watch settings out, background state in ---------- */
  const rt = () => (typeof RT !== 'undefined' && RT && RT.storage && RT.storage.local ? RT : null);
  /* pushExt({force, interval}): the desk's counties and thresholds go to the watch when they change here (or on force); the interval only
     when it was changed here, so a choice made on the Options page holds */
  async function pushExt(o) {
    o = o || {}; const R = rt(); if (!R) return false;
    try {
      const si = scopeInfo(); const want = { warnMin: SET.warnMin, lagFrom: SET.lagFrom, lagTo: SET.lagTo, wow: SET.wow, yoy: SET.yoy };
      if (si.from !== 'default') want.counties = si.fips.map(f => ({ fips: f, name: CI[f].name }));   // a placeholder county is never sent to the watch
      const sig = JSON.stringify(want); if (!o.force && !o.interval && sget('sev.live.pushed', '') === sig) return true;
      const cur = (await R.storage.local.get(EXT_OPT))[EXT_OPT] || {}; if (o.interval || !cur.interval) want.interval = SET.interval || 360;
      if (Object.keys(want).every(k => JSON.stringify(cur[k]) === JSON.stringify(want[k]))) { sset('sev.live.pushed', sig); return true; }
      await R.storage.local.set({ [EXT_OPT]: Object.assign({}, cur, want, { from: 'live-desk' }) }); sset('sev.live.pushed', sig); return true;
    } catch (e) { return false; }
  }
  /* the Options page owns the interval once set there */
  function adoptExt(opt) { if (opt && opt.interval && +opt.interval !== +SET.interval) { SET = Object.assign({}, SET, { interval: +opt.interval }); sset(SET_KEY, SET); } }
  async function extState() { const R = rt(); if (!R) return null; try { const r = await R.storage.local.get([EXT_OPT, EXT_ST]); return { options: r[EXT_OPT] || null, state: r[EXT_ST] || null }; } catch (e) { return null; } }
  async function extCheck() { const R = rt(); if (!R || !R.runtime || !R.runtime.sendMessage) return false; try { await R.runtime.sendMessage({ type: 'sev:refresh' }); return true; } catch (e) { return false; } }

  return {
    get state() { return state; }, get version() { return VER; }, settings, setSettings, resetSettings, scope, scopeInfo, canFetch, inPage, fresh, refresh, loadFile, clearLive, snapshot, notices, claimsSeries,
    calendar, calendarYear, triggers, timing, series, windows, seasonFactor, observedDow, hourGrid, useObserved, setUseObserved, hasAcct, editorRows, editorCSV, dailyCSV, windowsCSV, calendarCSV, ics, noticesCSV, snapshotJSON, pushExt, adoptExt, extState, extCheck,
    invalidate() { VER++; emit(); }, coName,
    parseWarn, parseFred, csvRows, claimsCheck, normDate, warnKey, warnURL, warnStep, thanksgiving, campName, lineName, lineShort, firmLines, addD, diffD, fmtD, today,
    setToday(d) { NOW = d || null; VER++; }, SOCRATA, WARN_PAGE, FRED_CSV, FRED_PAGE, DEF, MIL, SRC, EXT_OPT, EXT_ST, DOWN
  };
})();
