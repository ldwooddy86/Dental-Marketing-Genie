'use strict';
/* boot */
(function () {
  const th = store.get('sev.theme', null); if (th) document.documentElement.setAttribute('data-theme', th);
  const ttmDivAll = sum(CTY.map(c => c.filings.ttm.div || 0));
  const shocked = CTY.filter(c => (c.esi || 0) >= 80).length;
  $('#shellFacts').innerHTML = `<span><b>${K(ttmDivAll)}</b> Texas divorce filings in 12 months</span><span><b>${K(ST.acs.married)}</b> married Texans</span><span><b>${shocked}</b> counties in economic shock</span><span>Filings through <b>${esc(fmtDate(META.oca_through))}</b></span>`;
  const order = ['index', 'ledger', 'market', 'signals', 'econ', 'lines', 'paid', 'supply', 'timing', 'desk', 'compliance', 'dfw', 'atlas', 'hou', 'sat', 'aus', 'elp', 'rgv', 'others', 'forge', 'publish', 'accounts', 'watch', 'live', 'method'];
  const LAUNCH = ['forge', 'publish', 'accounts', 'watch', 'live'];
  MODS.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const groups = [['Statewide', MODS.filter(m => !m.metro && m.key !== 'method' && !LAUNCH.includes(m.key))], ['Metro areas', MODS.filter(m => m.metro)], ['Launch', MODS.filter(m => LAUNCH.includes(m.key))]].filter(g => g[1].length);
  const btn = m => `<button type="button" id="tab-${m.key}" role="tab" aria-selected="false" aria-controls="mod-${m.key}" title="${esc(m.desc)}"><span class="n">${m.num}</span><span class="t">${esc(m.title)}</span></button>`;
  $('#rail .in').innerHTML = groups.map(g => `<div class="grp"><div class="glabel">${g[0]}</div><div class="row" role="tablist" aria-label="${g[0]}">${g[1].map(btn).join('')}</div></div>`).join('');
  $('#modules').innerHTML = MODS.map(m => `<section class="module" id="mod-${m.key}" role="tabpanel" aria-labelledby="tab-${m.key}" hidden></section>`).join('');
  MODS.forEach(m => { const t = $('#tab-' + m.key); if (t) t.onclick = () => showModule(m.key); });
  window.onModuleShown = key => { const c = $('#methodTop'); if (c) c.classList.toggle('on', key === 'method'); const b = $('#tab-' + key); const row = b && b.parentElement; if (row && row.scrollWidth > row.clientWidth + 2) row.scrollLeft = Math.max(0, b.offsetLeft - row.offsetLeft - 16); };
  const hash = (location.hash || '').replace('#', ''); const start = MODI[hash] ? hash : store.get('sev.tab', 'index');
  showModule(MODI[start] ? start : 'index');
  $('#themeTop').onclick = () => { toggleTheme(); BUS.emit('theme'); };
  $('#firmTop').onclick = () => FIRM.panel(); FIRM.applyShell();
  $('#methodTop').onclick = () => showModule('method');
  $('#backupTop').onclick = () => WORKSPACE.panel();
  // back and forward between modules, and links that carry only a hash
  window.addEventListener('hashchange', () => { const k = (location.hash || '').slice(1).split('?')[0]; if (MODI[k] && $('#mod-' + k) && $('#mod-' + k).hidden) showModule(k); });
})();
