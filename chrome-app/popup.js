"use strict";
const B = globalThis.browser || globalThis.chrome;
const $ = s => document.querySelector(s);
const fmtH = h => { h = ((h % 24) + 24) % 24; return h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RULE = { heat: 'Repair surge: lift AC repair bids and budgets', air: 'Indoor air quality push', severe: 'Hail line on standby', cold: 'Heating surge rule', flood: 'Hold attic and duct work', wind: 'Watch', other: 'Read the alert' };
const open = hash => { B.tabs.create({ url: B.runtime.getURL('app.html') + (hash || '') }); window.close(); };
async function render() {
  const st = (await B.storage.local.get('tda.ext.state'))['tda.ext.state'] || {}; const s = st.summary; const last = st.last || {};
  $('#err').hidden = !last.error; if (last.error) $('#err').textContent = last.error;
  if (!s) { $('#dNow').textContent = last.error ? 'No weather held yet.' : 'Waiting for the first weather check…'; return; }
  $('#sub').textContent = `${s.city || 'DFW'} · NWS ${s.office} ${s.grid}`;
  $('#tNow').textContent = s.tempNow != null ? s.tempNow + '°' : '—';
  $('#dNow').innerHTML = `<b>feels like ${esc(s.hiNow)}°</b> · ${esc(s.short || '')}<br>${s.peakLabel === 'today' ? 'Today' : 'Next 24 h'} ${esc(s.todayHigh)}° / ${esc(s.todayLow)}°${s.hotWindow ? ` · 95°+ from ${fmtH(s.hotWindow[0])} to ${fmtH(s.hotWindow[1])}` : ''}`;
  $('#kHI').textContent = s.todayMaxHI != null ? s.todayMaxHI + '°' : '—'; $('#kHI').style.color = s.todayMaxHI >= 105 ? 'var(--crit)' : s.todayMaxHI >= 100 ? 'var(--heat)' : '';
  $('#kHIs').textContent = (s.peakLabel || 'today') + ' · ' + (s.todayMaxHI >= 105 ? 'repair surge' : s.todayMaxHI >= 100 ? 'repair lift' : s.todayMaxHI >= 95 ? 'template plus' : 'quiet for repair');
  $('#k95').textContent = s.h95next72 != null ? s.h95next72 : '—';
  $('#kAl').textContent = s.alerts.length; $('#kAl').style.color = s.alerts.length ? 'var(--crit)' : '';
  const hs = s.hours || []; const mx = Math.max(110, ...hs.map(h => h.hi)); const mn = Math.min(60, ...hs.map(h => h.hi));
  $('#bars').innerHTML = hs.map(h => `<i class="${h.hi >= 105 ? 'h105' : h.hi >= 100 ? 'h100' : h.hi >= 95 ? 'h95' : ''} ${h.hr >= 21 || h.hr < 6 ? 'night' : ''}" style="height:${Math.max(4, Math.round(100 * (h.hi - mn) / (mx - mn)))}%" title="${esc(fmtH(h.hr))}: ${esc(h.hi)}° heat index, ${esc(h.tempF)}° air"></i>`).join('');
  if (hs.length) { $('#b0').textContent = fmtH(hs[0].hr); $('#b1').textContent = hs[Math.floor(hs.length / 2)] ? fmtH(hs[Math.floor(hs.length / 2)].hr) + ' (+24h)' : ''; $('#b2').textContent = fmtH(hs[hs.length - 1].hr) + ' (+48h)'; }
  $('#alerts').innerHTML = s.alerts.slice(0, 4).map(a => `<div class="al ${esc(a.kind)}"><b>${esc(a.event)}</b><span class="r">${esc(a.counties.length === 12 ? 'All 12 counties' : a.counties.join(', '))}${a.ends ? ' · to ' + new Date(a.ends).toLocaleString([], { weekday: 'short', hour: 'numeric' }) : ''}</span><div class="r">${esc(RULE[a.kind] || RULE.other)}</div></div>`).join('') + (s.alerts.length > 4 ? `<div class="r" style="font-size:11px;color:var(--ink3)">${s.alerts.length - 4} more in the weather desk</div>` : '');
  $('#upd').textContent = 'Updated ' + new Date(s.fetched).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
$('#open').onclick = () => open(''); $('#weather').onclick = () => open('#weather'); $('#accounts').onclick = () => open('#accounts');
$('#opts').onclick = () => { if (B.runtime.openOptionsPage) B.runtime.openOptionsPage(); else B.tabs.create({ url: B.runtime.getURL('options.html') }); window.close(); };
$('#refresh').onclick = async () => { $('#refresh').textContent = 'Refreshing…'; $('#refresh').disabled = true; try { let ok = true; try { ok = await B.permissions.contains({ origins: ['https://api.weather.gov/*'] }); } catch (e) { } if (!ok) { ok = await B.permissions.request({ origins: ['https://api.weather.gov/*', 'https://www.spc.noaa.gov/*'] }); } await B.runtime.sendMessage({ type: 'tda:refresh' }); } catch (e) { } await render(); $('#refresh').textContent = 'Refresh weather'; $('#refresh').disabled = false; };
B.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch['tda.ext.state']) render(); });
render();
