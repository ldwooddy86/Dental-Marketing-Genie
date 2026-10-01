/* Severance · Options: the live watch (interval, counties, thresholds), notifications and badge, the OAuth redirect address module 23
   needs, and site access (Firefox treats host permissions as optional; the firm's own site is an optional host everywhere) */
'use strict';
const OB = globalThis.browser || globalThis.chrome;
const qo = s => document.querySelector(s), qa = s => Array.from(document.querySelectorAll(s));
const O_KEY = 'sev.ext.options', S_KEY = 'sev.ext.state';
const O_DEF = { interval: 360, counties: [], notify: true, notifyKinds: ['warn', 'claims'], badge: true, warnMin: 25, lagFrom: 90, lagTo: 365, wow: 20, yoy: 15 };
/* the 254 Texas counties, FIPS 48xxx: 'xxx:Name' */
const TX_COUNTIES = '001:Anderson|003:Andrews|005:Angelina|007:Aransas|009:Archer|011:Armstrong|013:Atascosa|015:Austin|017:Bailey|019:Bandera|021:Bastrop|023:Baylor|025:Bee|027:Bell|029:Bexar|031:Blanco|033:Borden|035:Bosque|037:Bowie|039:Brazoria|041:Brazos|043:Brewster|045:Briscoe|047:Brooks|049:Brown|051:Burleson|053:Burnet|055:Caldwell|057:Calhoun|059:Callahan|061:Cameron|063:Camp|065:Carson|067:Cass|069:Castro|071:Chambers|073:Cherokee|075:Childress|077:Clay|079:Cochran|081:Coke|083:Coleman|085:Collin|087:Collingsworth|089:Colorado|091:Comal|093:Comanche|095:Concho|097:Cooke|099:Coryell|101:Cottle|103:Crane|105:Crockett|107:Crosby|109:Culberson|111:Dallam|113:Dallas|115:Dawson|117:Deaf Smith|119:Delta|121:Denton|123:DeWitt|125:Dickens|127:Dimmit|129:Donley|131:Duval|133:Eastland|135:Ector|137:Edwards|141:El Paso|139:Ellis|143:Erath|145:Falls|147:Fannin|149:Fayette|151:Fisher|153:Floyd|155:Foard|157:Fort Bend|159:Franklin|161:Freestone|163:Frio|165:Gaines|167:Galveston|169:Garza|171:Gillespie|173:Glasscock|175:Goliad|177:Gonzales|179:Gray|181:Grayson|183:Gregg|185:Grimes|187:Guadalupe|189:Hale|191:Hall|193:Hamilton|195:Hansford|197:Hardeman|199:Hardin|201:Harris|203:Harrison|205:Hartley|207:Haskell|209:Hays|211:Hemphill|213:Henderson|215:Hidalgo|217:Hill|219:Hockley|221:Hood|223:Hopkins|225:Houston|227:Howard|229:Hudspeth|231:Hunt|233:Hutchinson|235:Irion|237:Jack|239:Jackson|241:Jasper|243:Jeff Davis|245:Jefferson|247:Jim Hogg|249:Jim Wells|251:Johnson|253:Jones|255:Karnes|257:Kaufman|259:Kendall|261:Kenedy|263:Kent|265:Kerr|267:Kimble|269:King|271:Kinney|273:Kleberg|275:Knox|283:La Salle|277:Lamar|279:Lamb|281:Lampasas|285:Lavaca|287:Lee|289:Leon|291:Liberty|293:Limestone|295:Lipscomb|297:Live Oak|299:Llano|301:Loving|303:Lubbock|305:Lynn|313:Madison|315:Marion|317:Martin|319:Mason|321:Matagorda|323:Maverick|307:McCulloch|309:McLennan|311:McMullen|325:Medina|327:Menard|329:Midland|331:Milam|333:Mills|335:Mitchell|337:Montague|339:Montgomery|341:Moore|343:Morris|345:Motley|347:Nacogdoches|349:Navarro|351:Newton|353:Nolan|355:Nueces|357:Ochiltree|359:Oldham|361:Orange|363:Palo Pinto|365:Panola|367:Parker|369:Parmer|371:Pecos|373:Polk|375:Potter|377:Presidio|379:Rains|381:Randall|383:Reagan|385:Real|387:Red River|389:Reeves|391:Refugio|393:Roberts|395:Robertson|397:Rockwall|399:Runnels|401:Rusk|403:Sabine|405:San Augustine|407:San Jacinto|409:San Patricio|411:San Saba|413:Schleicher|415:Scurry|417:Shackelford|419:Shelby|421:Sherman|423:Smith|425:Somervell|427:Starr|429:Stephens|431:Sterling|433:Stonewall|435:Sutton|437:Swisher|439:Tarrant|441:Taylor|443:Terrell|445:Terry|447:Throckmorton|449:Titus|451:Tom Green|453:Travis|455:Trinity|457:Tyler|459:Upshur|461:Upton|463:Uvalde|465:Val Verde|467:Van Zandt|469:Victoria|471:Walker|473:Waller|475:Ward|477:Washington|479:Webb|481:Wharton|483:Wheeler|485:Wichita|487:Wilbarger|489:Willacy|491:Williamson|493:Wilson|495:Winkler|497:Wise|499:Wood|501:Yoakum|503:Young|505:Zapata|507:Zavala'.split('|').map(s => { const [f, n] = s.split(':'); return { fips: '48' + f, name: n }; });
const isFx = () => /Firefox\//.test(navigator.userAgent);
async function load() {
  const o = Object.assign({}, O_DEF, (await OB.storage.local.get(O_KEY))[O_KEY] || {});
  qo('#interval').value = String(o.interval); ['warnMin', 'lagFrom', 'lagTo', 'wow', 'yoy'].forEach(k => { qo('#' + k).value = o[k]; });
  qo('#notify').checked = !!o.notify; qa('input[data-kind]').forEach(c => { c.checked = (o.notifyKinds || []).includes(c.dataset.kind); }); qo('#badge').checked = o.badge !== false;
  const sel = new Set((o.counties || []).map(c => c.fips || c.name));
  qo('#counties').innerHTML = TX_COUNTIES.map(c => `<option value="${c.fips}"${sel.has(c.fips) || sel.has(c.name) ? ' selected' : ''}>${c.name} County</option>`).join('');
  picked(); filter();
  try { qo('#redirect').textContent = OB.identity && OB.identity.getRedirectURL ? OB.identity.getRedirectURL() : 'The identity API is not available in this browser'; } catch (e) { qo('#redirect').textContent = 'The identity API is not available in this browser'; }
  qo('#extid').textContent = OB.runtime.id;
  await hosts(); await last();
}
function picked() { const s = Array.from(qo('#counties').selectedOptions).map(o => o.textContent.replace(/ County$/, '')); qo('#picked').textContent = s.length ? `Watching ${s.length} count${s.length === 1 ? 'y' : 'ies'}: ${s.join(', ')}.` : 'No county picked: the watch reads the newest notices for all of Texas.'; }
function filter() { const q = qo('#find').value.trim().toLowerCase(); Array.from(qo('#counties').options).forEach(o => { o.hidden = !!q && !o.selected && !o.textContent.toLowerCase().includes(q); }); }
async function hosts() {
  const fixed = (OB.runtime.getManifest().host_permissions || []);
  try { const ok = await OB.permissions.contains({ origins: fixed }); qo('#grantMsg').textContent = ok ? 'All of the atlas\'s API hosts are granted.' : 'Not all granted yet' + (isFx() ? ' (Firefox asks once).' : '.'); } catch (e) { qo('#grantMsg').textContent = ''; }
  try { const all = await OB.permissions.getAll(); const extra = (all.origins || []).filter(x => !fixed.includes(x)); qo('#granted').innerHTML = extra.length ? extra.map(x => `<li><code>${x.replace(/[<>&"]/g, '')}</code> <button type="button" data-rm="${x.replace(/[<>&"]/g, '')}">Remove</button></li>`).join('') : '<li>No other site granted.</li>'; qa('#granted [data-rm]').forEach(b => b.addEventListener('click', async () => { try { await OB.permissions.remove({ origins: [b.dataset.rm] }); } catch (e) { } hosts(); })); } catch (e) { }
}
async function last() {
  const st = (await OB.storage.local.get(S_KEY))[S_KEY] || {}; const s = st.summary, l = st.last;
  qo('#last').textContent = l ? `${new Date(l.at).toLocaleString()} (${l.reason})${(l.errors || []).length ? '\n' + l.errors.join('\n') : ''}${s ? `\nWatching: ${s.scope && s.scope.length ? s.scope.join(', ') : 'all of Texas'}\nNotices held: ${(s.notices || []).length}; new in 14 days: ${s.new14} (${(s.workers14 || 0).toLocaleString('en-US')} workers)\n${s.claims && s.claims.last ? `Texas initial claims ${Math.round(s.claims.last.value).toLocaleString('en-US')}, week ending ${s.claims.last.date}` : 'Claims not read'}\nTriggers: ${(s.triggers || []).length}${st.mapped ? '\nWARN columns: ' + Object.keys(st.mapped).map(k => k + ' = ' + st.mapped[k]).join(', ') : ''}` : ''}` : 'No check yet.';
}
async function save() {
  const n = id => { const v = qo('#' + id).value; return v === '' ? O_DEF[id] : +v; };
  const o = { interval: +qo('#interval').value || 360, warnMin: n('warnMin'), lagFrom: n('lagFrom'), lagTo: n('lagTo'), wow: n('wow'), yoy: n('yoy'), notify: qo('#notify').checked, notifyKinds: qa('input[data-kind]').filter(c => c.checked).map(c => c.dataset.kind), badge: qo('#badge').checked,
    counties: Array.from(qo('#counties').selectedOptions).map(x => ({ fips: x.value, name: x.textContent.replace(/ County$/, '') })) };
  if (o.lagTo <= o.lagFrom) { qo('#msg').textContent = 'The window must close after it opens.'; return; }
  const cur = (await OB.storage.local.get(O_KEY))[O_KEY] || {};
  await OB.storage.local.set({ [O_KEY]: Object.assign({}, cur, o, { from: 'options' }) }); qo('#msg').textContent = 'Saved. The watch uses these settings from the next check.'; setTimeout(() => { qo('#msg').textContent = ''; }, 3500);
}
qo('#save').addEventListener('click', save);
qo('#reset').addEventListener('click', async () => { await OB.storage.local.set({ [O_KEY]: Object.assign({}, O_DEF, { from: 'options' }) }); await load(); qo('#msg').textContent = 'Defaults restored.'; });
qo('#find').addEventListener('input', filter);
qo('#counties').addEventListener('change', picked);
qo('#copyR').addEventListener('click', async () => { try { await navigator.clipboard.writeText(qo('#redirect').textContent); qo('#copyR').textContent = 'Copied'; } catch (e) { qo('#copyR').textContent = 'Select and copy'; } });
/* permissions.request runs first inside the click: Firefox shows its prompt only from a user action */
qo('#grantAll').addEventListener('click', () => { const req = OB.permissions.request({ origins: OB.runtime.getManifest().host_permissions || [] }); Promise.resolve(req).then(ok => { qo('#grantMsg').textContent = ok ? 'Granted.' : 'Not granted.'; hosts(); }, e => { qo('#grantMsg').textContent = e.message; }); });
qo('#grantSite').addEventListener('click', () => {
  let origin = ''; try { const u = new URL(qo('#site').value.trim()); if (!/^https?:$/.test(u.protocol)) throw new Error('Use an http or https address'); origin = u.protocol + '//' + u.hostname + '/*'; } catch (e) { qo('#siteMsg').textContent = 'Enter the full address, such as https://www.example.com'; return; }
  const req = OB.permissions.request({ origins: [origin] }); Promise.resolve(req).then(ok => { qo('#siteMsg').textContent = ok ? 'Granted for ' + origin : 'Not granted.'; hosts(); }, e => { qo('#siteMsg').textContent = e.message; });
});
qo('#refresh').addEventListener('click', async () => { qo('#refresh').textContent = 'Checking'; qo('#refresh').disabled = true; try { await OB.runtime.sendMessage({ type: 'sev:refresh' }); } catch (e) { } qo('#refresh').textContent = 'Check now'; qo('#refresh').disabled = false; last(); });
qo('#openDesk').addEventListener('click', () => { OB.tabs.create({ url: OB.runtime.getURL('app.html#live') }); });
OB.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[S_KEY]) last(); });
load();
