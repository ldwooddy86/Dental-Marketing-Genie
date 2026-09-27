/* ==== nws_core ==== */
"use strict";
/* ============================ NATIONAL WEATHER SERVICE: fetch, cache, derive (module 14; shell facts; desk pacing hints) ============================ */
/* Sources: api.weather.gov (points, gridpoints forecast, hourly, raw grid, alerts, station observations, forecast discussion) and
   spc.noaa.gov convective outlooks. No key is required. The Claude viewer blocks page network calls, so there the desk shows the
   snapshot baked at build time; opened as a file or inside the browser app it refreshes live and caches for thirty minutes. */
const NWSX = (() => {
  const SNAP = (() => { try { return JSON.parse(document.getElementById('nws-snapshot').textContent); } catch (e) { return (window.__NWS_SNAPSHOT__ || null); } })();
  const KEY = 'tda.nws.v2', TTL = 30 * 60 * 1000;
  const COUNTIES = ['Collin', 'Dallas', 'Denton', 'Ellis', 'Hood', 'Hunt', 'Johnson', 'Kaufman', 'Parker', 'Rockwall', 'Tarrant', 'Wise'];
  const ZONES = SNAP ? SNAP.zones.forecast : {}, CNTY = SNAP ? SNAP.zones.county : {};
  const STN = SNAP ? SNAP.stationList : {}, LL = SNAP ? SNAP.stationLL : {};
  const CENT = { Collin: [33.19, -96.57], Dallas: [32.77, -96.78], Denton: [33.20, -97.12], Ellis: [32.35, -96.79], Hood: [32.43, -97.83], Hunt: [33.12, -96.08], Johnson: [32.38, -97.37], Kaufman: [32.60, -96.29], Parker: [32.78, -97.80], Rockwall: [32.90, -96.41], Tarrant: [32.77, -97.29], Wise: [33.22, -97.65] };
  const CAT_ORDER = ['TSTM', 'MRGL', 'SLGT', 'ENH', 'MDT', 'HIGH'];
  const c2f = c => c == null ? null : Math.round((c * 9 / 5 + 32) * 10) / 10, kmh = k => k == null ? null : Math.round(k * 0.621371 * 10) / 10;
  const canFetch = () => !inViewer();
  let state = { data: SNAP, live: false, fetched: SNAP ? SNAP.fetched : null, error: null, loading: false };
  try { const c = store.get(KEY, null); if (c && c.data && c.fetched && Date.now() - Date.parse(c.fetched) < 7 * 864e5 && (!SNAP || Date.parse(c.fetched) > Date.parse(SNAP.fetched))) state = { data: c.data, live: true, fetched: c.fetched, error: null, loading: false }; } catch (e) { }
  /* ---------- heat index (NWS Rothfusz) ---------- */
  function heatIndex(T, RH) { if (!isN(T) || !isN(RH)) return isN(T) ? T : null; if (T < 80) return Math.round(T * 10) / 10; let HI = -42.379 + 2.04901523 * T + 10.14333127 * RH - .22475541 * T * RH - .00683783 * T * T - .05481717 * RH * RH + .00122874 * T * T * RH + .00085282 * T * RH * RH - .00000199 * T * T * RH * RH; if (RH < 13 && T >= 80 && T <= 112) HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17); else if (RH > 85 && T >= 80 && T <= 87) HI += ((RH - 85) / 10) * ((87 - T) / 5); return Math.round(HI * 10) / 10; }
  /* ---------- live fetch (same shape as the snapshot) ---------- */
  const parseValid = v => { const [t, dur] = v.split('/'); const m = dur.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/); const h = m ? (+(m[1] || 0)) * 24 + (+(m[2] || 0)) + (+(m[3] || 0)) / 60 : 0; return [t, h]; };
  const gj = async (u) => { const r = await fetch(u, { headers: { Accept: 'application/geo+json' }, signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(20000) : undefined }); if (!r.ok) throw new Error(`${u.split('/')[2]} ${r.status}`); return r.json(); };
  const ser = (gr, key, conv) => ((gr[key] || {}).values || []).map(v => { const [t, h] = parseValid(v.validTime); return { t, h, v: v.value == null ? null : (conv || c2f)(v.value) }; });
  const gridAt = (s, iso) => { const t0 = Date.parse(iso); for (const x of s) { const st = Date.parse(x.t); if (t0 >= st && t0 < st + x.h * 36e5) return x.v; } return null; };
  function pip(pt, ring) { const x = pt[1], y = pt[0]; let inside = false; for (let i = 0, n = ring.length; i < n; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n]; if (((y1 > y) !== (y2 > y)) && (x < (x2 - x1) * (y - y1) / ((y2 - y1) || 1e-12) + x1)) inside = !inside; } return inside; }
  function inFeature(pt, g) { if (!g) return false; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; return polys.some(p => pip(pt, p[0]) && !p.slice(1).some(h => pip(pt, h))); }
  function spcEval(g, kind) { if (!g || !g.features) return null; const f0 = g.features[0] && g.features[0].properties || {}; const out = { valid: f0.VALID, expire: f0.EXPIRE, issue: f0.ISSUE, counties: {} }; Object.entries(CENT).forEach(([c, pt]) => { let best = null; g.features.forEach(f => { const lab = f.properties.LABEL; if (inFeature(pt, f.geometry)) { if (kind === 'cat') best = best == null || CAT_ORDER.indexOf(lab) > CAT_ORDER.indexOf(best) ? lab : best; else { const v = isN(+lab) ? +lab : (lab === 'SIGN' ? 0.1 : 0); best = Math.max(best || 0, v); } } }); if (best != null) out.counties[c] = best; }); return out; }
  async function fetchLive(opts) {
    opts = opts || {}; const lat = opts.lat || (SNAP ? SNAP.point.lat : 32.8063), lon = opts.lon || (SNAP ? SNAP.point.lon : -96.6609);
    const P = (await gj(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`)).properties;
    const point = { lat, lon, office: P.gridId, gridX: P.gridX, gridY: P.gridY, zone: P.forecastZone.split('/').pop(), county: P.county.split('/').pop(), radar: P.radarStation, city: opts.city || (SNAP ? SNAP.point.city : '') };
    const base = `https://api.weather.gov/gridpoints/${P.gridId}/${P.gridX},${P.gridY}`;
    const [fc, hr, gr, al] = await Promise.all([gj(base + '/forecast'), gj(base + '/forecast/hourly'), gj(base), gj('https://api.weather.gov/alerts/active?area=TX')]);
    const fp = fc.properties; const forecast = { updated: fp.updateTime, generated: fp.generatedAt, periods: fp.periods.map(p => ({ name: p.name, start: p.startTime, end: p.endTime, isDay: p.isDaytime, tempF: p.temperature, short: p.shortForecast, detail: p.detailedForecast, pop: (p.probabilityOfPrecipitation || {}).value, wind: p.windSpeed, windDir: p.windDirection })) };
    const g = gr.properties; const grid = { updated: g.updateTime, heatIndex: ser(g, 'heatIndex'), apparentTemperature: ser(g, 'apparentTemperature'), maxTemperature: ser(g, 'maxTemperature'), minTemperature: ser(g, 'minTemperature'), probabilityOfThunder: ser(g, 'probabilityOfThunder', x => x), probabilityOfPrecipitation: ser(g, 'probabilityOfPrecipitation', x => x), skyCover: ser(g, 'skyCover', x => x), windGust: ser(g, 'windGust', kmh), heatRisk: ser(g, 'heatRisk', x => x), relativeHumidity: ser(g, 'relativeHumidity', x => x), hazards: ((g.hazards || {}).values || []).map(v => { const [t, h] = parseValid(v.validTime); return { t, h, v: v.value }; }) };
    const hourly = hr.properties.periods.map(p => { const T = p.temperature, RH = (p.relativeHumidity || {}).value; let hi = gridAt(grid.heatIndex, p.startTime); if (hi == null) hi = heatIndex(T, RH); return { t: p.startTime, tempF: T, rh: RH, pop: (p.probabilityOfPrecipitation || {}).value, hi, wind: p.windSpeed, short: p.shortForecast, isDay: p.isDaytime }; });
    const alerts = (al.features || []).map(f => f.properties).map(pr => { const ugc = ((pr.geocode || {}).UGC) || []; const hit = COUNTIES.filter(c => ugc.includes(ZONES[c]) || ugc.includes(CNTY[c])); return hit.length ? { id: pr.id, event: pr.event, severity: pr.severity, urgency: pr.urgency, certainty: pr.certainty, headline: pr.headline, description: String(pr.description || '').slice(0, 1600), instruction: String(pr.instruction || '').slice(0, 600), onset: pr.onset, ends: pr.ends, expires: pr.expires, sender: pr.senderName, areas: pr.areaDesc, counties: hit, sent: pr.sent } : null; }).filter(Boolean);
    const stations = []; await Promise.all(Object.keys(STN).map(async sid => { try { const o = await gj(`https://api.weather.gov/stations/${sid}/observations/latest`); const p = o.properties; const T = c2f((p.temperature || {}).value), RH = (p.relativeHumidity || {}).value; let hi = c2f((p.heatIndex || {}).value); if (hi == null && isN(T) && isN(RH)) hi = heatIndex(T, RH); stations.push({ id: sid, name: STN[sid], lat: (LL[sid] || [])[0], lon: (LL[sid] || [])[1], time: p.timestamp, tempF: T, hiF: hi, rh: RH == null ? null : Math.round(RH), windMph: kmh((p.windSpeed || {}).value), text: p.textDescription }); } catch (e) { } }));
    stations.sort((a, b) => Object.keys(STN).indexOf(a.id) - Object.keys(STN).indexOf(b.id));
    const history = {}; await Promise.all(['KDFW', 'KHQZ'].map(async sid => { try { const o = await gj(`https://api.weather.gov/stations/${sid}/observations?limit=300`); const rows = (o.features || []).map(f => f.properties).map(p => { const T = c2f((p.temperature || {}).value), RH = (p.relativeHumidity || {}).value; return isN(T) ? { t: p.timestamp.slice(0, 16), tempF: T, rh: RH == null ? null : Math.round(RH), hiF: RH == null ? T : heatIndex(T, RH) } : null; }).filter(Boolean).sort((a, b) => a.t.localeCompare(b.t)); history[sid] = rows.slice(-72); } catch (e) { } }));
    let spc = null; try { const [c1, h1, w1, t1, c2, h2, c3] = await Promise.all(['day1otlk_cat', 'day1otlk_hail', 'day1otlk_wind', 'day1otlk_torn', 'day2otlk_cat', 'day2otlk_hail', 'day3otlk_cat'].map(n => fetch(`https://www.spc.noaa.gov/products/outlook/${n}.lyr.geojson`).then(r => r.ok ? r.json() : null).catch(() => null))); spc = { day1: { cat: spcEval(c1, 'cat'), hail: spcEval(h1, 'p'), wind: spcEval(w1, 'p'), torn: spcEval(t1, 'p') }, day2: { cat: spcEval(c2, 'cat'), hail: spcEval(h2, 'p') }, day3: { cat: spcEval(c3, 'cat') } }; } catch (e) { spc = SNAP ? SNAP.spc : null; }
    let afd = SNAP ? SNAP.afd : null; try { const list = await fetch(`https://api.weather.gov/products/types/AFD/locations/${P.gridId}`, { headers: { Accept: 'application/ld+json' } }).then(r => r.json()); const id = list['@graph'] && list['@graph'][0] && list['@graph'][0]['@id']; if (id) { const prod = await fetch(id, { headers: { Accept: 'application/ld+json' } }).then(r => r.json()); const txt = prod.productText || ''; const sec = n => { const m = txt.match(new RegExp('\\.' + n + '\\.\\.\\.([\\s\\S]*?)(?:\\n&&|\\n\\.[A-Z ]+\\.\\.\\.)')); return m ? m[1].replace(/\n(?!\n)/g, ' ').trim() : ''; }; const km = sec('KEY MESSAGES'); afd = { issued: prod.issuanceTime, keyMessages: km.split(/\n?\s*-\s+/).map(k => k.replace(/\s+/g, ' ').trim()).filter(Boolean), shortTerm: sec('SHORT TERM').slice(0, 2500), longTerm: sec('LONG TERM').slice(0, 2500), office: 'NWS ' + (P.gridId === 'FWD' ? 'Fort Worth TX' : P.gridId) }; } } catch (e) { }
    return { fetched: new Date().toISOString(), source: `api.weather.gov (NWS ${P.gridId}, grid ${P.gridX},${P.gridY}), spc.noaa.gov outlooks, station observations`, point, zones: { forecast: ZONES, county: CNTY }, stationList: STN, stationLL: LL, forecast, hourly, grid, alerts, obs: { stations, history }, spc, afd };
  }
  async function refresh(force) {
    if (!canFetch()) { state.error = 'viewer'; BUS.emit('nws'); return state; }
    if (!force && state.live && state.fetched && Date.now() - Date.parse(state.fetched) < TTL) return state;
    state.loading = true; BUS.emit('nws');
    try { const data = await fetchLive(); state = { data, live: true, fetched: data.fetched, error: null, loading: false }; store.set(KEY, { fetched: data.fetched, data }); }
    catch (e) { state.loading = false; state.error = e && e.message ? e.message : String(e); }
    BUS.emit('nws'); return state;
  }
  /* ---------- derived ---------- */
  const D0 = () => state.data;
  const localDate = iso => String(iso).slice(0, 10);
  const hourOf = iso => +String(iso).slice(11, 13);
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowOf = iso => new Date(iso).getDay();
  function days() {
    const d = D0(); if (!d) return []; const by = {}; d.hourly.forEach(h => { (by[localDate(h.t)] = by[localDate(h.t)] || []).push(h); });
    const maxT = {}; d.grid.maxTemperature.forEach(m => { maxT[localDate(m.t)] = m.v; }); const minT = {}; d.grid.minTemperature.forEach(m => { minT[localDate(m.t)] = m.v; });
    const thunder = t => { const v = gridAt(d.grid.probabilityOfThunder, t); return v == null ? 0 : v; };
    return Object.entries(by).map(([date, hs]) => { const his = hs.map(h => h.hi).filter(isN), ts = hs.map(h => h.tempF).filter(isN); const per = d.forecast.periods.filter(p => localDate(p.start) === date); const day = per.find(p => p.isDay) || per[0]; return { date, dow: DOW[dowOf(hs[0].t)], hours: hs, high: maxT[date] != null ? maxT[date] : (ts.length ? Math.max(...ts) : null), low: minT[date] != null ? minT[date] : (ts.length ? Math.min(...ts) : null), maxHI: his.length ? Math.max(...his) : null, h95: his.filter(x => x >= 95).length, h100: his.filter(x => x >= 100).length, h105: his.filter(x => x >= 105).length, pop: Math.max(0, ...hs.map(h => h.pop || 0)), thunder: Math.max(0, ...hs.map(h => thunder(h.t))), short: day ? day.short : (hs[0].short || ''), detail: day ? day.detail : '', partial: hs.length < 20 }; }).slice(0, 8);
  }
  function seasonStatus() { const Y = DATA.climate.ytd; const d100 = Y.d100, norm = Y.norm_d100; const rank = DATA.climate.rank100; const rec = rank[0]; const ahead = rank.filter(r => r[0] > d100).length + 1; const fc = days(); const nxt100 = fc.find(x => x.high >= 100); const run = (() => { let n = 0; for (const x of fc) { if (x.high >= 100) n++; else break; } return n; })(); return { d100, norm, through: Y.through, record: rec, rank: ahead, next100: nxt100 ? nxt100.date : null, forecastRun: run, cdd: Y.cdd, normCdd: Y.norm_cdd }; }
  function alertsNow() { const d = D0(); if (!d) return []; const now = Date.now(); return d.alerts.filter(a => !a.expires || Date.parse(a.expires) > now - 36e5).sort((a, b) => sevRank(b) - sevRank(a)); }
  const sevRank = a => ({ Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 }[a.severity] || 0);
  const ALERT_ACTIONS = [
    [/Excessive Heat Warning|Extreme Heat Warning/i, 'repair', 'Emergency repair at maximum: lift search and LSA budgets 40 to 60%, all evening dayparts on, Spanish ad sets live; maintenance paused', 'surge'],
    [/Heat Advisory/i, 'repair', 'Repair surge: lift search bids 25%, LSA weekly budget 30%, evenings +30%', 'surge'],
    [/Air Quality/i, 'iaq', 'Indoor air push: ozone action day creative on Meta and Nextdoor, filtration and purification search on', 'push'],
    [/Severe Thunderstorm (Watch|Warning)|Tornado (Watch|Warning)/i, 'hail', 'Hail line on standby: creative staged; launch inside the storm swath within 72 hours of 1.75 inch reports', 'standby'],
    [/Winter Storm|Ice Storm|Blizzard/i, 'heat', 'Heating emergency: LSA uncapped, no heat creative live, furnace safety copy; replacement quotes convert fastest after', 'surge'],
    [/Hard Freeze|Extreme Cold|Cold Weather Advisory|Freeze Warning|Wind Chill/i, 'heat', 'Heating repair surge: overnight and morning dayparts on, heat pump defrost and strip heat copy', 'surge'],
    [/Flood|Flash Flood/i, 'repair', 'Hold new spend during the warning window; outdoor units and crawlspace flooding calls follow within 48 hours', 'hold'],
    [/Wind Advisory|High Wind/i, 'repair', 'Power outage follow up: no cooling after the outage creative; capacitor and board failures spike', 'watch'],
  ];
  function alertActions() { return alertsNow().map(a => { const m = ALERT_ACTIONS.find(x => x[0].test(a.event)) || [null, '', 'Read the alert text; no standing rule for this event', 'watch']; return { alert: a, line: m[1], action: m[2], kind: m[3] }; }); }
  function spcNow() { const d = D0(); if (!d || !d.spc) return null; const pick = (o) => { if (!o || !o.counties) return { max: null, counties: {} }; const v = Object.values(o.counties); return { max: v.length ? (typeof v[0] === 'string' ? v.sort((a, b) => CAT_ORDER.indexOf(b) - CAT_ORDER.indexOf(a))[0] : Math.max(...v)) : null, counties: o.counties, valid: o.valid, expire: o.expire }; }; return { day1: { cat: pick(d.spc.day1.cat), hail: pick(d.spc.day1.hail), wind: pick(d.spc.day1.wind), torn: pick(d.spc.day1.torn) }, day2: { cat: pick(d.spc.day2.cat), hail: pick(d.spc.day2.hail) }, day3: { cat: pick(d.spc.day3.cat) } }; }
  /* ---------- hour by hour ad plan ---------- */
  function weatherFactor(lineId, h, ctx) {
    const HI = isN(h.hi) ? h.hi : h.tempF, T = h.tempF; const c = v => clamp(v, 0, 1);
    switch (lineId) {
      case 'repair': return 1 + 0.5 * c((HI - 85) / 15) + (HI >= 100 ? 0.25 : 0) + (HI >= 105 ? 0.15 : 0) + (ctx.heatAlert ? 0.2 : 0);
      case 'heat': return 1 + 0.6 * c((45 - T) / 20) + (T <= 25 ? 0.3 : 0) + (ctx.coldAlert ? 0.25 : 0);
      case 'furnace': return 1 + 0.35 * c((50 - T) / 25) + (ctx.coldAlert ? 0.15 : 0);
      case 'replace': case 'firstwave': case 'r22': case 'heatpump': return 1 + 0.25 * c((HI - 90) / 15) + 0.15 * c((40 - T) / 20);
      case 'maint': return (HI >= 98 ? 0.85 : 1) + ((T >= 62 && T <= 88 && (h.pop || 0) < 40) ? 0.2 : 0);
      case 'iaq': return 1 + (ctx.aqAlert ? 0.4 : 0) + 0.3 * ((SLM.LI.iaq.months[new Date(h.t).getMonth()] / 100) - 1) + ((h.pop || 0) >= 50 ? 0.05 : 0);
      case 'hail': return ctx.hailWatch ? 1.6 : (ctx.thunder(h.t) >= 40 ? 1.2 : 0.6);
      case 'duct': case 'ductless': case 'commercial': case 'landlord': return 1 + 0.1 * c((HI - 90) / 15);
      default: return 1;
    }
  }
  function plan(lineId) {
    const d = D0(); const line = SLM.LI[lineId] || SLM.LI.repair; if (!d) return { days: [], line };
    let tpl = SLM.DAYPARTS[line.dayparts]; let observed = false; try { if (typeof ACCT !== 'undefined' && ACCT.settings().useObserved) { const g = ACCT.observedGrid(); if (g) { tpl = g; observed = true; } } } catch (e) { } const blockOf = hr => hr < 6 ? 0 : hr < 9 ? 1 : hr < 12 ? 2 : hr < 17 ? 3 : hr < 21 ? 4 : 5;
    const al = alertsNow(); const ctx = { heatAlert: al.some(a => /Heat/i.test(a.event)), coldAlert: al.some(a => /Freeze|Cold|Winter|Ice|Wind Chill/i.test(a.event)), aqAlert: al.some(a => /Air Quality/i.test(a.event)), hailWatch: al.some(a => /Severe Thunderstorm|Tornado/i.test(a.event)) || (() => { const s = spcNow(); return !!(s && s.day1.hail.max >= 0.15); })(), thunder: t => { const v = gridAt(d.grid.probabilityOfThunder, t); return v == null ? 0 : v; } };
    const out = days().slice(0, 7).map(day => { const rows = day.hours.map(h => { const hr = hourOf(h.t), dow = dowOf(h.t); const ti = dow === 0 ? 6 : dow - 1; const base = 1 + (tpl[ti][blockOf(hr)] || 0) / 100; const w = weatherFactor(lineId, h, ctx); const m = base * w; const adj = clamp(Math.round((m - 1) * 100 / 5) * 5, -50, 90); return { t: h.t, hr, hi: h.hi, tempF: h.tempF, pop: h.pop, base, w, m, adj }; }); return { date: day.date, dow: day.dow, high: day.high, maxHI: day.maxHI, rows, partial: day.partial }; });
    return { days: out, line, ctx, observed };
  }
  function windows(lineId) { const p = plan(lineId); const out = []; p.days.forEach(day => { let cur = null; day.rows.forEach(r => { const on = r.adj >= 15 ? 'up' : r.adj <= -25 ? 'down' : null; if (on && cur && cur.kind === on && cur.end === r.hr) { cur.end = r.hr + 1; cur.adj = Math.max(cur.adj, r.adj) * (on === 'up' ? 1 : 1); cur.peak = Math.max(cur.peak, r.hi || r.tempF); cur.n++; cur.sum += r.adj; } else { if (cur) out.push(cur); cur = on ? { date: day.date, dow: day.dow, start: r.hr, end: r.hr + 1, kind: on, adj: r.adj, peak: r.hi || r.tempF, n: 1, sum: r.adj } : null; } }); if (cur) out.push(cur); }); return out.map(w => ({ ...w, avg: Math.round(w.sum / w.n / 5) * 5 })); }
  const hh = h => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
  function narrative() {
    const d = D0(); if (!d) return []; const al = alertsNow(); const s = spcNow(); const out = [];
    days().slice(0, 7).forEach(day => { const rep = plan('repair').days.find(x => x.date === day.date); const hot = day.hours.filter(h => (h.hi || h.tempF) >= 95).map(h => hourOf(h.t)); const parts = []; parts.push(`high ${D(day.high, 0)}°${day.maxHI && day.maxHI >= 95 ? `, heat index ${D(day.maxHI, 0)}` : ''}`); if (hot.length) parts.push(`heat index 95 or more ${hh(Math.min(...hot))} to ${hh(Math.max(...hot) + 1)}`); if (rep) { const up = rep.rows.filter(r => r.adj >= 20); if (up.length) parts.push(`repair bids +${Math.max(...up.map(r => r.adj))}% peak, ${hh(Math.min(...up.map(r => r.hr)))} to ${hh(Math.max(...up.map(r => r.hr)) + 1)}`); } if (day.thunder >= 30) parts.push(`thunder chance ${D(day.thunder, 0)}%: hail line on watch`); if (day.pop >= 50) parts.push(`rain ${D(day.pop, 0)}%: maintenance and duct visits slip`); if (day.high <= 45) parts.push('heating repair dayparts on overnight'); out.push({ date: day.date, dow: day.dow, text: parts.join('; ') }); });
    if (s && s.day1.cat.max) out.unshift({ date: 'SPC', dow: 'Day 1', text: `Storm Prediction Center: ${s.day1.cat.max} risk over ${Object.keys(s.day1.cat.counties).length} of 12 counties${s.day1.hail.max ? `, hail probability ${Math.round(s.day1.hail.max * 100)}%` : ''}${s.day2.cat.max ? `; day 2 ${s.day2.cat.max}` : ''}${s.day3.cat.max ? `; day 3 ${s.day3.cat.max}` : ''}.` });
    al.forEach(a => out.unshift({ date: 'Alert', dow: a.event, text: `${a.headline || a.event}: ${a.counties.length === 12 ? 'all 12 counties' : a.counties.join(', ')}.` }));
    return out;
  }
  /* ---------- exports ---------- */
  function scheduleCSV(lineId) { const w = windows(lineId); const l = SLM.LI[lineId]; const H = ['campaign', 'date', 'day', 'start_hour', 'end_hour', 'bid_adjustment_pct', 'peak_heat_index_f', 'reason']; return toCSV(H, w.map(x => [`DFW_${lineId.toUpperCase()}_SEARCH`, x.date, x.dow, `${String(x.start).padStart(2, '0')}:00`, `${String(x.end).padStart(2, '0')}:00`, x.avg, x.peak, x.kind === 'up' ? `${l.short}: daypart template times forecast heat index` : `${l.short}: low demand window`]), `Ad schedule windows for ${l.name}, built ${new Date().toISOString().slice(0, 16)} from the NWS forecast fetched ${state.fetched}. Google Ads: enter as ad schedule bid adjustments (minus 90% to plus 900% allowed). Meta: dayparting needs a lifetime budget.`); }
  function hourlyCSV(lineId) { const p = plan(lineId); const H = ['date', 'day', 'hour', 'temp_f', 'heat_index_f', 'precip_pct', 'template_multiplier', 'weather_multiplier', 'combined', 'bid_adjustment_pct']; const rows = []; p.days.forEach(d => d.rows.forEach(r => rows.push([d.date, d.dow, r.hr, r.tempF, r.hi, r.pop, +r.base.toFixed(2), +r.w.toFixed(2), +r.m.toFixed(2), r.adj]))); return toCSV(H, rows, `Hour by hour plan for ${p.line.name}. Forecast ${state.fetched}${state.live ? ' (live)' : ' (build snapshot)'}.`); }
  return { get state() { return state; }, get data() { return state.data; }, canFetch, refresh, heatIndex, days, seasonStatus, alertsNow, alertActions, spcNow, plan, windows, narrative, scheduleCSV, hourlyCSV, COUNTIES, CAT_ORDER, hh, DOW, snapshotJSON: () => JSON.stringify(state.data) };
})();
