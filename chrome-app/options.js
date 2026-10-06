"use strict";
const B = globalThis.browser || globalThis.chrome;
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const OPT_KEY = 'tda.ext.options', ST_KEY = 'tda.ext.state';
const DEF = { lat: 32.8063, lon: -96.6609, label: 'Mesquite HQ', interval: 30, notify: true, notifyKinds: ['heat', 'cold', 'air', 'severe', 'flood'], badge: 'heatindex', heatBadgeFrom: 90 };
const ORIGINS = ['https://api.weather.gov/*', 'https://www.spc.noaa.gov/*', 'https://forecast.weather.gov/*', 'https://accounts.google.com/*', 'https://oauth2.googleapis.com/*', 'https://googleads.googleapis.com/*', 'https://localservices.googleapis.com/*', 'https://youtubeanalytics.googleapis.com/*', 'https://www.googleapis.com/*', 'https://businessprofileperformance.googleapis.com/*', 'https://graph.facebook.com/*', 'https://www.facebook.com/*', 'https://business-api.tiktok.com/*', 'https://ads.tiktok.com/*', 'https://api.linkedin.com/*', 'https://www.linkedin.com/*', 'https://login.microsoftonline.com/*', 'https://*.api.bingads.microsoft.com/*', 'https://www.wixapis.com/*', 'https://*.wixmp.com/*', 'https://api.duda.co/*', 'https://api-eu.duda.co/*', 'https://api-sandbox.duda.co/*', 'https://api.webflow.com/*', 'https://webflow-prod-assets.s3.amazonaws.com/*', 'https://*.myshopify.com/*', 'https://shopify-staged-uploads.storage.googleapis.com/*', 'https://api.hubapi.com/*', 'https://api.hubspot.com/*'];
async function load() {
  const o = Object.assign({}, DEF, (await B.storage.local.get(OPT_KEY))[OPT_KEY] || {});
  $('#label').value = o.label; $('#lat').value = o.lat; $('#lon').value = o.lon; $('#interval').value = String(o.interval); $('#notify').checked = !!o.notify; $$('input[data-kind]').forEach(c => c.checked = (o.notifyKinds || []).includes(c.dataset.kind)); $('#badge').value = o.badge; $('#heatBadgeFrom').value = o.heatBadgeFrom;
  try { $('#redirect').textContent = B.identity && B.identity.getRedirectURL ? B.identity.getRedirectURL() : 'identity API not available'; } catch (e) { $('#redirect').textContent = 'identity API not available'; }
  $('#extid').textContent = B.runtime.id;
  const isFx = navigator.userAgent.includes('Firefox'); $('#grant').hidden = !isFx; if (isFx) { try { const ok = await B.permissions.contains({ origins: ORIGINS }); $('#grantMsg').textContent = ok ? 'All sites granted.' : 'Not all sites granted yet.'; } catch (e) { } }
  const st = (await B.storage.local.get(ST_KEY))[ST_KEY] || {}; const s = st.summary, l = st.last;
  $('#last').textContent = l ? `${new Date(l.at).toLocaleString()} (${l.reason})${l.error ? '\nError: ' + l.error : ''}${s ? `\n${s.city} · NWS ${s.office} grid ${s.grid}\nNow ${s.tempNow}° feels ${s.hiNow}° · ${s.short}\nToday ${s.todayHigh}° / ${s.todayLow}° · peak heat index ${s.todayMaxHI}°\n${s.alerts.length} alert(s): ${s.alerts.map(a => a.event).join(', ') || 'none'}` : ''}` : 'No check yet.';
}
async function save() {
  const o = { label: $('#label').value.trim() || 'Custom point', lat: +$('#lat').value || DEF.lat, lon: +$('#lon').value || DEF.lon, interval: +$('#interval').value || 30, notify: $('#notify').checked, notifyKinds: $$('input[data-kind]').filter(c => c.checked).map(c => c.dataset.kind), badge: $('#badge').value, heatBadgeFrom: +$('#heatBadgeFrom').value || 90 };
  const st = (await B.storage.local.get(ST_KEY))[ST_KEY] || {}; if (st.point && (st.point.lat !== o.lat || st.point.lon !== o.lon)) { delete st.point; await B.storage.local.set({ [ST_KEY]: st }); }
  await B.storage.local.set({ [OPT_KEY]: o }); $('#msg').textContent = 'Saved. The next check uses these settings.'; setTimeout(() => $('#msg').textContent = '', 3000); setTimeout(load, 4000);
}
$('#save').onclick = save;
$('#reset').onclick = async () => { await B.storage.local.set({ [OPT_KEY]: Object.assign({}, DEF) }); load(); };
$('#grant').onclick = async () => { try { const ok = await B.permissions.request({ origins: ORIGINS }); $('#grantMsg').textContent = ok ? 'All sites granted.' : 'Not granted.'; } catch (e) { $('#grantMsg').textContent = e.message; } };
$('#refresh').onclick = async () => { $('#refresh').textContent = 'Checking…'; try { await B.runtime.sendMessage({ type: 'tda:refresh' }); } catch (e) { } setTimeout(() => { $('#refresh').textContent = 'Check now'; load(); }, 1500); };
B.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[ST_KEY]) load(); });
load();
