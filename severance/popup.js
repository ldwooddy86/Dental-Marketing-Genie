/* Severance · toolbar popup: the latest triggers from the background watch, and the way into the atlas */
'use strict';
const PB = globalThis.browser || globalThis.chrome;
const q1 = s => document.querySelector(s);
const escP = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONP = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtP = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${MONP[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''; };
const openTab = hash => { PB.tabs.create({ url: PB.runtime.getURL('app.html' + (hash || '#live')) }); window.close(); };
async function render() {
  let st = {}; try { st = (await PB.storage.local.get('sev.ext.state'))['sev.ext.state'] || {}; } catch (e) { st = {}; }
  const s = st.summary, last = st.last || {};
  const errs = (last.errors || []).concat(last.error && !(last.errors || []).includes(last.error) ? [last.error] : []);
  q1('#err').hidden = !errs.length; q1('#err').textContent = errs.join(' ');
  if (!s) { q1('#trig').innerHTML = `<p class="small">${errs.length ? 'No answer yet from the sources.' : 'Waiting for the first check. It runs a few seconds after install and then on the timer set in Options.'}</p>`; return; }
  q1('#sub').textContent = s.scope && s.scope.length ? 'Watching ' + s.scope.slice(0, 3).join(', ') + (s.scope.length > 3 ? ' and ' + (s.scope.length - 3) + ' more' : '') : 'Watching all of Texas';
  q1('#kNew').textContent = s.new14 != null ? s.new14 : 'n/a';
  q1('#kWork').textContent = s.workers14 != null ? s.workers14.toLocaleString('en-US') : 'n/a';
  const c = s.claims; q1('#kCl').textContent = c && c.last ? Math.round(c.last.value).toLocaleString('en-US') : 'n/a';
  q1('#kClS').textContent = c && c.last ? `week ending ${fmtP(c.last.date).replace(/, \d{4}$/, '')}${c.wowPct != null ? ', ' + (c.wowPct >= 0 ? '+' : '−') + Math.abs(Math.round(c.wowPct)) + '% on the week' : ''}` : 'not read';
  const tr = (s.triggers || []).slice(0, 5);
  q1('#trig').innerHTML = tr.length ? tr.map(t => `<div class="tr ${escP(t.kind)}"><span class="pill ${escP(t.kind)}">${t.kind === 'warn' ? 'WARN' : 'Claims'}</span> <span class="pill ${t.status === 'active' ? 'on' : ''}">${t.status === 'active' ? 'active' : 'from ' + escP(fmtP(t.start))}</span><b>${escP(t.title)}</b><div class="r">${escP(t.rule)}</div></div>`).join('') + ((s.triggers || []).length > 5 ? `<p class="small">${(s.triggers || []).length - 5} more in the Live Desk.</p>` : '')
    : '<p class="small">No layoff window is open or due for the watched counties, and weekly claims are inside the thresholds.</p>';
  q1('#upd').textContent = 'Checked ' + new Date(s.fetched).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
q1('#open').addEventListener('click', () => openTab('#live'));
q1('#opts').addEventListener('click', () => { if (PB.runtime.openOptionsPage) PB.runtime.openOptionsPage(); else PB.tabs.create({ url: PB.runtime.getURL('options.html') }); window.close(); });
q1('#refresh').addEventListener('click', async () => {
  const b = q1('#refresh'); b.textContent = 'Checking'; b.disabled = true;
  /* request first, inside the click: Firefox only shows the prompt from a user action; granted hosts resolve at once */
  let asked = Promise.resolve(true); try { asked = PB.permissions.request({ origins: ['https://data.texas.gov/*', 'https://fred.stlouisfed.org/*'] }); } catch (e) { }
  try { await asked; await PB.runtime.sendMessage({ type: 'sev:refresh' }); } catch (e) { }
  await render(); b.textContent = 'Check now'; b.disabled = false;
});
PB.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch['sev.ext.state']) render(); });
render();
