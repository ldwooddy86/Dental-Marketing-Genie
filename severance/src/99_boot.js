'use strict';
/* boot */
(function () {
  const th = store.get('sev.theme', null); if (th) document.documentElement.setAttribute('data-theme', th);
  // the statewide twelve months come from the statewide monthly series; the shock count is a real threshold (unemployment up half a
  // point or more on a year earlier, BLS LAUS), not the top fifth of a percentile, so it moves with the economy
  const ttmDivAll = stTTM('div');
  const shocked = CTY.filter(c => c.econ && isN(c.econ.ur_chg_yoy) && c.econ.ur_chg_yoy >= 0.5).length;
  $('#shellFacts').innerHTML = `<span><b>${K(ttmDivAll)}</b> Texas divorce filings in 12 months</span><span><b>${K(ST.acs.married)}</b> married Texans</span><span><b>${shocked}</b> counties with unemployment up half a point or more on a year ago</span><span>Filings through <b>${esc(fmtDate(META.oca_through))}</b></span>`;
  const order = ['index', 'ledger', 'market', 'signals', 'econ', 'lines', 'paid', 'supply', 'timing', 'desk', 'compliance', 'dfw', 'atlas', 'hou', 'sat', 'aus', 'elp', 'rgv', 'others', 'forecast', 'evidence', 'ground', 'forge', 'publish', 'accounts', 'watch', 'live', 'method'];
  const MODELS = ['forecast', 'evidence', 'ground'];
  const LAUNCH = ['forge', 'publish', 'accounts', 'watch', 'live'];
  MODS.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const groups = [['Statewide', MODS.filter(m => !m.metro && m.key !== 'method' && !LAUNCH.includes(m.key) && !MODELS.includes(m.key))], ['Metro areas', MODS.filter(m => m.metro)], ['Models', MODS.filter(m => MODELS.includes(m.key))], ['Launch', MODS.filter(m => LAUNCH.includes(m.key))]].filter(g => g[1].length);
  const btn = m => `<button type="button" id="tab-${m.key}" role="tab" aria-selected="false" aria-controls="mod-${m.key}" title="${esc(m.desc)}"><span class="n">${m.num}</span><span class="t">${esc(m.title)}</span></button>`;
  $('#rail .in').innerHTML = groups.map(g => `<div class="grp"><div class="glabel">${g[0]}</div><div class="row" role="tablist" aria-label="${g[0]}">${g[1].map(btn).join('')}</div></div>`).join('');
  // method has no rail tab; its panel is named by the top bar button that opens it
  $('#modules').innerHTML = MODS.map(m => `<section class="module" id="mod-${m.key}" ${$('#tab-' + m.key) ? `role="tabpanel" aria-labelledby="tab-${m.key}"` : `role="region" aria-labelledby="${m.key === 'method' ? 'methodTop' : 'tab-' + m.key}"`} tabindex="-1" hidden></section>`).join('');
  MODS.forEach(m => { const t = $('#tab-' + m.key); if (t) t.onclick = () => showModule(m.key); });
  // each rail group is one tab stop (the selected tab, or the group's first); the arrow keys, Home and End move along the group
  const railStops = () => $$('#rail [role=tablist]').forEach(g => { const tabs = $$('[role=tab]', g); const on = tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]; tabs.forEach(t => t.tabIndex = t === on ? 0 : -1); });
  $('#rail').addEventListener('keydown', e => { const t = e.target.closest && e.target.closest('[role=tab]'); if (!t) return; const tabs = $$('[role=tab]', t.parentElement); const i = tabs.indexOf(t); const j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1; if (j < 0) return; e.preventDefault(); tabs.forEach(x => x.tabIndex = -1); tabs[j].tabIndex = 0; tabs[j].focus(); });
  window.onModuleShown = key => { railStops(); const c = $('#methodTop'); if (c) { c.classList.toggle('on', key === 'method'); c.setAttribute('aria-pressed', String(key === 'method')); } const mm = MODI[key]; document.title = 'Severance · ' + (mm ? mm.title : 'Texas family law market intelligence'); const b = $('#tab-' + key); const row = b && b.parentElement; if (row && row.scrollWidth > row.clientWidth + 2) row.scrollLeft = Math.max(0, b.offsetLeft - row.offsetLeft - 16); };
  const hash = (location.hash || '').replace('#', ''); const start = MODI[hash] ? hash : store.get('sev.tab', 'index');
  showModule(MODI[start] ? start : 'index');
  // the theme button says which theme is on; the browser bar color follows the utility bar of the theme in use
  const meta = document.querySelector('meta[name="theme-color"]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
  const syncTheme = () => { const r = document.documentElement; const dark = r.getAttribute('data-theme') ? r.getAttribute('data-theme') === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); const b = $('#themeTop'); if (b) { b.setAttribute('aria-pressed', String(dark)); b.setAttribute('aria-label', 'Dark theme'); b.title = dark ? 'Dark theme is on. Switch to light.' : 'Light theme is on. Switch to dark.'; } meta.content = (getComputedStyle(r).getPropertyValue('--util-bg') || '').trim() || (dark ? '#0d2519' : '#e1f4e8'); };
  syncTheme(); try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme); } catch (e) { }
  $('#themeTop').onclick = () => { toggleTheme(); syncTheme(); BUS.emit('theme'); };
  // a skip link past the header and the rail to the module on screen
  const skip = document.createElement('a'); skip.className = 'skip'; skip.href = '#modules'; skip.textContent = 'Skip to module'; document.body.insertBefore(skip, document.body.firstChild);
  skip.onclick = e => { e.preventDefault(); const s = $$('#modules > .module').find(x => !x.hidden); if (!s) return; const h = s.querySelector('h1'); const t = h || s; if (h && !h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); t.focus(); s.scrollIntoView({ block: 'start' }); };
  $('#firmTop').onclick = () => FIRM.panel(); FIRM.applyShell();
  $('#methodTop').onclick = () => showModule('method');
  $('#backupTop').onclick = () => WORKSPACE.panel();
  // back and forward between modules, and links that carry only a hash
  window.addEventListener('hashchange', () => { const k = (location.hash || '').slice(1).split('?')[0]; if (MODI[k] && $('#mod-' + k) && $('#mod-' + k).hidden) showModule(k); });
})();
