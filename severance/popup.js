/* Severance · toolbar popup. Reads only extension storage:
     'sev.ext.state'  written by the background watch (background.js): WARN notices for the watched counties, Texas weekly claims, triggers
     'sev.ext.plan'   written by the Live Desk when it runs inside the extension (LIVE.pushPlan): the lead line's daily bid multiplier for the
                      next 42 days, the next calendar deadline and any weather hold
   KPIs: new WARN notices in the watched (firm) counties in the last 30 days with their workers, Texas initial claims last week with week on
   week and year on year (four weeks), active triggers; a 28 day strip of the lead line's daily bid adjustment; the next deadline; buttons
   into the atlas. No inline script or handler (the extension CSP is script-src 'self'). */
'use strict';
const PB = globalThis.browser || globalThis.chrome;
const q1 = s => document.querySelector(s);
const escP = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONP = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtP = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${MONP[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''; };
const shortP = s => fmtP(s).replace(/, \d{4}$/, '');
const ymdP = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayP = () => ymdP(new Date());
const daysP = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const pctP = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) + '%';
const numP = v => Math.round(v).toLocaleString('en-US');
const openTab = hash => { PB.tabs.create({ url: PB.runtime.getURL('app.html' + (hash || '')) }); window.close(); };
/* the two possession deadlines under a standard possession order, for when the Live Desk has not written its plan yet */
function fallbackDeadline(t) {
  const y = +t.slice(0, 4); const c = [];
  for (const yy of [y, y + 1]) c.push({ date: `${yy}-04-01`, title: 'April 1: written notice designating extended summer possession', source: 'Tex. Fam. Code § 153.312(b)' }, { date: `${yy}-04-15`, title: 'April 15: the managing conservator\'s summer notice', source: 'Tex. Fam. Code § 153.313' });
  return c.find(x => x.date >= t) || null;
}
function strip(plan, t) {
  const host = q1('#strip'); const note = q1('#stripN');
  if (!plan || !Array.isArray(plan.days) || !plan.days.length) { host.innerHTML = ''; host.classList.add('empty'); q1('#stripA').textContent = ''; q1('#stripB').textContent = ''; note.textContent = 'Open the Live Desk once in this extension and the lead line\'s next 28 days appear here.'; return; }
  host.classList.remove('empty');
  let days = plan.days.filter(d => d.date >= t).slice(0, 28); const stale = !days.length || plan.today < t && daysP(plan.today, t) > 14;
  if (!days.length) days = plan.days.slice(-28);
  const W = 352, H = 64, mid = 40, gap = 1, bw = (W - gap * (days.length - 1)) / days.length; const sc = v => Math.min(36, Math.abs(v) * 0.4 + (v ? 2 : 0));
  const bars = days.map((d, i) => { const h = sc(d.adj); const up = d.adj >= 0; const cls = d.hold ? 'hold' : d.adj >= 15 ? 'up' : d.adj <= -15 ? 'dn' : up ? 'upl' : 'dnl'; const y = d.hold ? mid : up ? mid - h : mid; const hh = d.hold ? 18 : Math.max(1.5, h);
    return `<rect class="${cls}" x="${(i * (bw + gap)).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}"><title>${escP(fmtP(d.date))}: ${escP(d.hold ? 'weather hold, minus 50%' : pctP(d.adj))}${d.why ? '. ' + escP(d.why) : ''}</title></rect>`; }).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" aria-hidden="true"><line class="base" x1="0" x2="${W}" y1="${mid}" y2="${mid}"></line>${bars}</svg>`;
  q1('#stripA').textContent = shortP(days[0].date); q1('#stripB').textContent = shortP(days[days.length - 1].date);
  q1('#stripH').textContent = `Next 28 days · ${plan.lineName || plan.line}`;
  const up = days.filter(d => d.adj >= 15).length, dn = days.filter(d => d.adj <= -15).length, held = days.filter(d => d.hold).length; const peak = days.slice().sort((a, b) => b.adj - a.adj)[0];
  note.textContent = `Daily bid adjustment at campaign level${plan.scope && plan.scope.length ? ' for ' + plan.scope.slice(0, 3).join(', ') + (plan.scope.length > 3 ? ' and more' : '') : ''}: ${up} day${up === 1 ? '' : 's'} at plus 15% or more, ${dn} at minus 15% or less${held ? `, ${held} held by a weather warning` : ''}${peak && peak.adj > 0 ? `; the peak ${pctP(peak.adj)} on ${shortP(peak.date)}` : ''}.${stale ? ` Computed ${fmtP(plan.today)}: open the Live Desk to bring it up to date.` : ''}`;
}
async function render() {
  let st = {}, plan = null; try { const r = await PB.storage.local.get(['sev.ext.state', 'sev.ext.plan']); st = r['sev.ext.state'] || {}; plan = r['sev.ext.plan'] || null; } catch (e) { st = {}; }
  const s = st.summary, last = st.last || {}; const t = todayP();
  const errs = (last.errors || []).concat(last.error && !(last.errors || []).includes(last.error) ? [last.error] : []);
  q1('#err').hidden = !errs.length; q1('#err').textContent = errs.join('\n');
  strip(plan, t);
  const dl = plan && plan.deadline && plan.deadline.date >= t ? plan.deadline : fallbackDeadline(t);
  q1('#dl').innerHTML = dl ? `<b>${escP(fmtP(dl.date))}</b> <span class="in">in ${daysP(t, dl.date)} day${daysP(t, dl.date) === 1 ? '' : 's'}</span><div>${escP(dl.title)}</div><div class="small">${escP(dl.source || '')}</div>` : 'n/a';
  const holds = plan && Array.isArray(plan.holds) ? plan.holds.filter(h => h.until >= t) : [];
  if (!s) { q1('#trig').innerHTML = `<p class="small">${errs.length ? 'No answer yet from the sources.' : 'Waiting for the first check. It runs a few seconds after install and then on the timer set in Options.'}</p>`; q1('#kTr').textContent = holds.length ? String(holds.length) : 'n/a'; return; }
  q1('#sub').textContent = s.scope && s.scope.length ? 'Watching ' + s.scope.slice(0, 3).join(', ') + (s.scope.length > 3 ? ' and ' + (s.scope.length - 3) + ' more' : '') : 'Watching all of Texas';
  /* new WARN notices in the watched counties, last 30 days, with their workers (the watch keeps the 80 newest) */
  const ns = (st.notices || s.notices || []).filter(n => n && n.date && n.date <= t && daysP(n.date, t) <= 30); const workers = ns.reduce((a, n) => a + (+n.workers || 0), 0);
  q1('#kNew').textContent = String(ns.length); q1('#kNewS').textContent = ns.length ? `${numP(workers)} worker${workers === 1 ? '' : 's'}, 30 days` : 'none in 30 days';
  const c = s.claims; q1('#kCl').textContent = c && c.last ? numP(c.last.value) : 'n/a';
  q1('#kClS').textContent = c && c.last ? `week to ${shortP(c.last.date)}: ${c.wowPct != null ? pctP(c.wowPct) + ' on the week' : 'no prior week'}${c.yoyPct != null ? ', ' + pctP(c.yoyPct) + ' on a year (4 wks)' : ''}` : 'not read';
  const tr = s.triggers || []; const act = tr.filter(x => x.status === 'active');
  q1('#kTr').textContent = String(act.length + holds.length); q1('#kTrS').textContent = `active${holds.length ? `, ${holds.length} weather hold${holds.length === 1 ? '' : 's'}` : ''}${tr.length > act.length ? `, ${tr.length - act.length} due` : ''}`;
  const hl = holds.map(h => `<div class="tr hold"><span class="pill hold">Hold</span> <span class="pill on">until ${escP(shortP(h.until))}</span><b>${escP(h.event)}: ${escP((h.counties || []).join(', '))}</b><div class="r">Hold new spend on every line except protective orders while the courts are closed.</div></div>`).join('');
  const top = tr.slice(0, 4);
  q1('#trig').innerHTML = hl + (top.length ? top.map(x => `<div class="tr ${escP(x.kind)}"><span class="pill ${escP(x.kind)}">${x.kind === 'warn' ? 'WARN' : 'Claims'}</span> <span class="pill ${x.status === 'active' ? 'on' : ''}">${x.status === 'active' ? 'active' : 'from ' + escP(shortP(x.start))}</span><b>${escP(x.title)}</b><div class="r">${escP(x.rule)}</div></div>`).join('') + (tr.length > 4 ? `<p class="small">${tr.length - 4} more in the Live Desk.</p>` : '')
    : (hl ? '' : '<p class="small">No layoff window is open or due for the watched counties, and weekly claims are inside the thresholds.</p>'));
  q1('#upd').textContent = 'Checked ' + new Date(s.fetched).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
q1('#open').addEventListener('click', () => openTab(''));
q1('#goLive').addEventListener('click', () => openTab('#live'));
q1('#goDesk').addEventListener('click', () => openTab('#desk'));
q1('#goComp').addEventListener('click', () => openTab('#compliance'));
q1('#opts').addEventListener('click', () => { if (PB.runtime.openOptionsPage) PB.runtime.openOptionsPage(); else PB.tabs.create({ url: PB.runtime.getURL('options.html') }); window.close(); });
q1('#refresh').addEventListener('click', async () => {
  const b = q1('#refresh'); b.textContent = 'Checking'; b.disabled = true;
  /* request first, inside the click: Firefox only shows the prompt from a user action; granted hosts resolve at once */
  let asked = Promise.resolve(true); try { asked = PB.permissions.request({ origins: ['https://data.texas.gov/*', 'https://fred.stlouisfed.org/*'] }); } catch (e) { }
  try { await asked; await PB.runtime.sendMessage({ type: 'sev:refresh' }); } catch (e) { }
  await render(); b.textContent = 'Refresh'; b.disabled = false;
});
PB.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch['sev.ext.state'] || ch['sev.ext.plan'])) render(); });
render();
