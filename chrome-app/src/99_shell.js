/* ==== shell ==== */
(function boot() {
  const t = store.get('tda.theme', null); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  BRANDX.apply();
  const rail = document.querySelector('#rail .in');
  rail.innerHTML = MODS.map(m => `<button type="button" id="tab-${m.key}" role="tab" aria-selected="false" aria-controls="mod-${m.key}"><span class="n">${m.num}</span><span class="t">${esc(m.title)}</span><span class="d">${esc(m.desc)}</span></button>`).join('');
  document.getElementById('modules').innerHTML = MODS.map(m => `<section class="module" id="mod-${m.key}" role="tabpanel" aria-labelledby="tab-${m.key}" hidden></section>`).join('');
  $$('#rail button').forEach(b => b.addEventListener('click', () => showModule(b.id.slice(4))));
  const Y = DATA.climate.ytd;
  document.getElementById('shellFacts').insertAdjacentHTML('afterend', '<button class="tbtn" id="brandBtn" title="Brand settings">⚙ Brand</button>'); document.getElementById('brandBtn').onclick = () => BRANDX.panel();
  document.getElementById('shellFacts').innerHTML = `<span><b>${K(META.sys)}</b> central systems</span><span><b>${K(META.ge15)}</b> aged 15 or older</span><span><b>${K(META.rep)}</b> replacements a year</span><span><b>${SLM.LINES.length}</b> service lines</span><span><b>${WATCH.COMPANIES.length - 1}</b> competitors watched</span><span><b>${Y.d100}</b> days at 100°F in ${String(Y.through).slice(0, 4)}</span>`;
  const h = (location.hash || '').slice(1); showModule(MODI[h] ? h : 'index');
  window.addEventListener('hashchange', () => { const k = (location.hash || '').slice(1); if (MODI[k] && $('#mod-' + k).hidden) showModule(k); });
})();
