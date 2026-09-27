/* DFW Thermal Debt Atlas · browser app background
   Runs as a service worker in Chrome and as an event page in Firefox. Every thirty minutes (options can change it) it reads the
   National Weather Service: active alerts touching the twelve counties and the hourly forecast for the headquarters grid.
   New heat, cold, air quality or severe storm products become a notification; the toolbar badge carries today's peak heat index. */
"use strict";
const B = globalThis.browser || globalThis.chrome;
const OPT_KEY = 'tda.ext.options', ST_KEY = 'tda.ext.state';
const DEF_OPT = { lat: 32.8063, lon: -96.6609, label: 'Mesquite HQ', interval: 30, notify: true, notifyKinds: ['heat', 'cold', 'air', 'severe', 'flood'], badge: 'heatindex', heatBadgeFrom: 90 };
const ZONES = new Set(['TXZ104', 'TXZ119', 'TXZ103', 'TXZ134', 'TXZ131', 'TXZ105', 'TXZ133', 'TXZ121', 'TXZ117', 'TXZ120', 'TXZ118', 'TXZ102', 'TXC085', 'TXC113', 'TXC121', 'TXC139', 'TXC221', 'TXC231', 'TXC251', 'TXC257', 'TXC367', 'TXC397', 'TXC439', 'TXC497']);
const COUNTY_OF = { TXZ104: 'Collin', TXZ119: 'Dallas', TXZ103: 'Denton', TXZ134: 'Ellis', TXZ131: 'Hood', TXZ105: 'Hunt', TXZ133: 'Johnson', TXZ121: 'Kaufman', TXZ117: 'Parker', TXZ120: 'Rockwall', TXZ118: 'Tarrant', TXZ102: 'Wise', TXC085: 'Collin', TXC113: 'Dallas', TXC121: 'Denton', TXC139: 'Ellis', TXC221: 'Hood', TXC231: 'Hunt', TXC251: 'Johnson', TXC257: 'Kaufman', TXC367: 'Parker', TXC397: 'Rockwall', TXC439: 'Tarrant', TXC497: 'Wise' };
const KIND = [[/Excessive Heat|Extreme Heat|Heat Advisory|Heat Watch/i, 'heat'], [/Air Quality|Ozone/i, 'air'], [/Severe Thunderstorm|Tornado|Hail/i, 'severe'], [/Winter|Ice|Freeze|Hard Freeze|Cold|Wind Chill|Frost/i, 'cold'], [/Flood/i, 'flood'], [/Wind|Dust|Fire|Red Flag/i, 'wind']];
const CT = iso => { const d = new Date(iso); const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }).formatToParts(d); const g = t => (parts.find(p => p.type === t) || {}).value; return { day: `${g('year')}-${g('month')}-${g('day')}`, hr: (+g('hour')) % 24 }; };
const kindOf = ev => (KIND.find(([re]) => re.test(ev)) || [null, 'other'])[1];
const get = async (k, d) => { try { const r = await B.storage.local.get(k); return r && r[k] !== undefined ? r[k] : d; } catch (e) { return d; } };
const set = (k, v) => B.storage.local.set({ [k]: v });
const opts = async () => Object.assign({}, DEF_OPT, await get(OPT_KEY, {}));
const hdr = { headers: { Accept: 'application/geo+json' } };
const gj = async u => { const r = await fetch(u, hdr); if (!r.ok) throw new Error(`${u.split('/')[2]} ${r.status}`); return r.json(); };
function heatIndex(T, RH) { if (T == null || RH == null) return T; if (T < 80) return T; let HI = -42.379 + 2.04901523 * T + 10.14333127 * RH - .22475541 * T * RH - .00683783 * T * T - .05481717 * RH * RH + .00122874 * T * T * RH + .00085282 * T * RH * RH - .00000199 * T * T * RH * RH; if (RH < 13 && T >= 80 && T <= 112) HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17); if (RH > 85 && T >= 80 && T <= 87) HI += ((RH - 85) / 10) * ((87 - T) / 5); return Math.round(HI); }
async function hasHosts() { try { return await B.permissions.contains({ origins: ['https://api.weather.gov/*'] }); } catch (e) { return true; } }
async function point(o) {
  const st = await get(ST_KEY, {}); if (st.point && st.point.lat === o.lat && st.point.lon === o.lon) return st.point;
  const p = await gj(`https://api.weather.gov/points/${o.lat.toFixed(4)},${o.lon.toFixed(4)}`); const pr = p.properties;
  const pt = { lat: o.lat, lon: o.lon, hourly: pr.forecastHourly, forecast: pr.forecast, office: pr.gridId, gridX: pr.gridX, gridY: pr.gridY, city: pr.relativeLocation && pr.relativeLocation.properties ? `${pr.relativeLocation.properties.city}, ${pr.relativeLocation.properties.state}` : '' };
  await set(ST_KEY, Object.assign(st, { point: pt })); return pt;
}
async function tick(reason) {
  const o = await opts(); const st = await get(ST_KEY, {}); const out = { at: new Date().toISOString(), reason, error: null };
  if (!(await hasHosts())) { out.error = 'Site access not granted yet: open the atlas, module 15, Grant site access.'; await set(ST_KEY, Object.assign(st, { last: out })); await badge('!', '#b01f2a', out.error); return; }
  try {
    const pt = await point(o); out.point = pt;
    const [al, hr] = await Promise.all([gj('https://api.weather.gov/alerts/active?area=TX'), gj(pt.hourly)]);
    const raw = (al.features || []).map(f => f.properties).filter(p => ((p.geocode || {}).UGC || []).some(u => ZONES.has(u))).map(p => ({ id: p.id, event: p.event, severity: p.severity, headline: p.headline, ends: p.ends, expires: p.expires, onset: p.onset, kind: kindOf(p.event || ''), counties: [...new Set(((p.geocode || {}).UGC || []).filter(u => ZONES.has(u)).map(u => COUNTY_OF[u]))] }));
    const alerts = []; raw.forEach(a => { const g = alerts.find(x => x.event === a.event); if (g) { g.ids.push(a.id); g.counties = [...new Set(g.counties.concat(a.counties))]; if (a.ends && (!g.ends || a.ends > g.ends)) g.ends = a.ends; } else alerts.push(Object.assign({}, a, { ids: [a.id] })); });
    const periods = (hr.properties && hr.properties.periods) || []; const now = new Date(); const today = CT(now).day;
    const hours = periods.slice(0, 72).map(p => { const T = p.temperature, RH = (p.relativeHumidity || {}).value; const hi = heatIndex(T, RH); const c = CT(p.startTime); return { t: p.startTime, hr: c.hr, day: c.day, tempF: T, hi, pop: (p.probabilityOfPrecipitation || {}).value || 0, short: p.shortForecast }; });
    const todayH = hours.filter(h => h.day === today); const src = todayH.length >= 4 ? todayH : hours.slice(0, 24); const peakLabel = todayH.length >= 4 ? 'today' : 'next 24 hours';
    const nowH = hours[0] || {}; const maxHI = Math.max(...src.map(h => h.hi)), maxT = Math.max(...src.map(h => h.tempF)), minT = Math.min(...src.map(h => h.tempF));
    const hot = src.filter(h => h.hi >= 95).map(h => h.hr); const h95 = hours.filter(h => h.hi >= 95).length;
    const summary = { fetched: out.at, peakLabel, city: pt.city, office: pt.office, grid: `${pt.gridX},${pt.gridY}`, tempNow: nowH.tempF, hiNow: nowH.hi, short: nowH.short, todayMaxHI: maxHI, todayHigh: maxT, todayLow: minT, hotWindow: hot.length ? [Math.min(...hot), Math.max(...hot) + 1] : null, h95next72: h95, alerts, hours: hours.slice(0, 48) };
    /* notifications on new products */
    const seen = new Set(st.seen || []); const fresh = alerts.filter(a => a.ids.some(i => !seen.has(i)) && (o.notifyKinds || []).includes(a.kind));
    if (o.notify && st.seen && fresh.length && B.notifications) { for (const a of fresh.slice(0, 3)) { try { await B.notifications.create('tda-' + a.id.slice(-12), { type: 'basic', iconUrl: 'icons/icon128.png', title: `${a.event} · ${a.counties.length === 12 ? 'all 12 counties' : a.counties.slice(0, 4).join(', ') + (a.counties.length > 4 ? ' and more' : '')}`, message: (a.headline || '') + (a.kind === 'heat' ? ' · Repair surge rule: lift AC repair bids and budgets.' : a.kind === 'air' ? ' · Indoor air quality push.' : a.kind === 'severe' ? ' · Hail line on standby.' : a.kind === 'cold' ? ' · Heating surge rule.' : ''), priority: 1 }); } catch (e) { } } }
    /* first heat day notification: forecast peak crosses 100 for the first time this week */
    if (o.notify && (o.notifyKinds || []).includes('heat') && maxHI >= 105 && st.lastHeatPing !== today && B.notifications) { try { await B.notifications.create('tda-heat-' + today, { type: 'basic', iconUrl: 'icons/icon128.png', title: `Heat index to ${maxHI}° today`, message: `${pt.city}: heat index 95 or more ${summary.hotWindow ? fmtH(summary.hotWindow[0]) + ' to ' + fmtH(summary.hotWindow[1]) : 'this afternoon'}. Repair bids run at the weather desk plan.` }); st.lastHeatPing = today; } catch (e) { } }
    await set(ST_KEY, Object.assign(st, { last: out, summary, seen: raw.map(a => a.id) }));
    await badgeFor(o, summary);
  } catch (e) { out.error = e && e.message ? e.message : String(e); await set(ST_KEY, Object.assign(st, { last: out })); await badge('?', '#6b7280', 'Weather refresh failed: ' + out.error); }
}
const fmtH = h => { h = ((h % 24) + 24) % 24; return h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'; };
async function badge(text, color, title) { try { await B.action.setBadgeText({ text: String(text || '') }); if (color) await B.action.setBadgeBackgroundColor({ color }); if (B.action.setBadgeTextColor) { try { await B.action.setBadgeTextColor({ color: '#ffffff' }); } catch (e) { } } if (title) await B.action.setTitle({ title }); } catch (e) { } }
async function badgeFor(o, s) {
  const al = s.alerts.length; const hi = s.todayMaxHI;
  const title = `Thermal Debt Atlas · ${s.city}\nNow ${s.tempNow}° (feels ${s.hiNow}°), ${s.short}\nToday ${s.todayHigh}° / ${s.todayLow}°, peak heat index ${hi}°${s.hotWindow ? ', 95+ from ' + fmtH(s.hotWindow[0]) + ' to ' + fmtH(s.hotWindow[1]) : ''}\n${al ? al + ' active alert' + (al > 1 ? 's' : '') + ': ' + s.alerts.map(a => a.event).join(', ') : 'No active alerts in the twelve counties'}\nUpdated ${new Date(s.fetched).toLocaleTimeString()}`;
  if (o.badge === 'none') return badge('', null, title);
  if (o.badge === 'alerts') return badge(al ? String(al) : '', al ? '#b01f2a' : null, title);
  if (hi >= (o.heatBadgeFrom || 90)) return badge(String(hi), hi >= 105 ? '#b01f2a' : hi >= 100 ? '#c4561f' : '#b8860b', title);
  if (s.todayLow <= 32) return badge(String(s.todayLow), '#1a6fd3', title);
  return badge(al ? String(al) : '', al ? '#b01f2a' : null, title);
}
async function schedule() { const o = await opts(); try { await B.alarms.clear('tda-nws'); } catch (e) { } await B.alarms.create('tda-nws', { periodInMinutes: Math.max(15, +o.interval || 30), delayInMinutes: 0.2 }); }
B.runtime.onInstalled.addListener(() => { schedule(); });
B.runtime.onStartup.addListener(() => { schedule(); });
B.alarms.onAlarm.addListener(a => { if (a.name === 'tda-nws') tick('alarm'); });
B.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[OPT_KEY]) { schedule(); tick('options'); } });
B.runtime.onMessage.addListener((msg, sender, respond) => { if (msg && msg.type === 'tda:refresh') { tick('manual').then(() => respond({ ok: true })); return true; } if (msg && msg.type === 'tda:open') { B.tabs.create({ url: B.runtime.getURL('app.html') + (msg.hash || '') }); respond({ ok: true }); return false; } return false; });
if (B.notifications && B.notifications.onClicked) B.notifications.onClicked.addListener(id => { B.tabs.create({ url: B.runtime.getURL('app.html') + '#weather' }); try { B.notifications.clear(id); } catch (e) { } });
