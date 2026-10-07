/* Leviathan · toolbar popup: a launcher. The three console views, the wings with their atlases, the recently opened atlases,
   and a search over atlases and modules. Enter opens the first match. */
"use strict";
(function () {
  const B = globalThis.browser || globalThis.chrome;
  const O = globalThis.LV_OPEN;
  const R = globalThis.LV_REGISTRY || { modules: [], wings: [], views: [] };
  const SETTINGS = 'leviathan.popup.v1', RECENT = 'leviathan.recent.v1';
  const $ = s => document.querySelector(s);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); }
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c == null) continue; el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); }
    return el;
  }
  let newTab = false, recent = [];
  const modOf = id => R.modules.find(m => m.id === id);

  function open(route) { O.openRoute(route, { newTab }).then(() => window.close(), () => window.close()); }
  function row(title, sub, route, wing, key) {
    return h('button', { class: 'row ' + (wing || ''), type: 'button', role: 'listitem', 'data-route': route, onclick: () => open(route) },
      h('i'), h('span', null, h('div', { class: 't', text: title }), sub ? h('div', { class: 's', text: sub }) : null), key ? h('span', { class: 'k', text: key }) : null);
  }
  function renderViews() {
    const box = $('#views'); box.replaceChildren();
    (R.views || []).forEach((v, i) => box.appendChild(h('button', { class: 'v' + (i === 0 ? ' p' : ''), type: 'button', title: v.sub, onclick: () => open(v.route) }, v.title)));
  }
  function renderRecent() {
    const sec = $('#recent'), box = $('#recentChips'); box.replaceChildren();
    const items = recent.filter(r => r && modOf(r.id)).slice(0, 6);
    sec.hidden = !items.length;
    for (const r of items) { const m = modOf(r.id); box.appendChild(h('button', { class: 'chip', type: 'button', title: r.route, onclick: () => open(r.route) }, O.modTitle(m))); }
  }
  function renderList(q) {
    const list = $('#list'); list.replaceChildren();
    if (q.trim()) {
      const res = O.search(q).slice(0, 14);
      if (!res.length) { list.appendChild(h('p', { class: 'empty', text: 'Nothing matches. Try an atlas, a trade or a module name.' })); return; }
      for (const r of res) list.appendChild(row(r.title, r.sub, r.route, r.wing || (r.view ? 'core' : ''), r.key ? r.route.split('.')[0] : null));
      return;
    }
    for (const w of (R.wings || [])) {
      list.appendChild(h('div', { class: 'wing ' + w.id }, h('span', { class: 'eyebrow', text: w.label }), h('span', { class: 'n', text: w.mods.length + (w.id === 'core' ? ' dashboards' : w.mods.length === 1 ? ' atlas' : ' atlases') })));
      for (const id of w.mods) { const m = modOf(id); if (m) list.appendChild(row(O.modTitle(m), O.modSub(m), m.id, m.wing)); }
    }
  }
  async function init() {
    try { const s = await B.storage.local.get([SETTINGS, RECENT]); newTab = !!(s[SETTINGS] && s[SETTINGS].newTab); recent = Array.isArray(s[RECENT]) ? s[RECENT] : []; } catch (e) { /* defaults */ }
    $('#newTab').checked = newTab;
    $('#newTab').addEventListener('change', e => { newTab = !!e.target.checked; try { B.storage.local.set({ [SETTINGS]: { newTab } }); } catch (err) { /* ignore */ } });
    const man = B.runtime.getManifest ? B.runtime.getManifest() : {};
    $('#ver').textContent = ['Console ' + (R.consoleVersion || '?'), 'app ' + (man.version || '?')].join(' · ');
    $('#ver').title = [R.compiled ? 'Console compiled ' + R.compiled : null, R.built ? 'app built ' + R.built : null].filter(Boolean).join(' · ');
    $('#sub').textContent = R.modules.length + ' dashboards · ' + (R.wings || []).filter(w => w.id !== 'core').length + ' wings';
    renderViews(); renderRecent(); renderList('');
    const q = $('#q');
    q.addEventListener('input', () => renderList(q.value));
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') { if (!q.value.trim()) return; const first = $('#list .row'); if (first) { e.preventDefault(); open(first.getAttribute('data-route')); } }
      else if (e.key === 'Escape') { if (q.value) { e.preventDefault(); q.value = ''; renderList(''); } }
      else if (e.key === 'ArrowDown') { const first = $('#list .row'); if (first) { e.preventDefault(); first.focus(); } }
    });
    $('#list').addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const rows = Array.from(document.querySelectorAll('#list .row')); const i = rows.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); const n = rows[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); else if (e.key === 'ArrowUp') q.focus();
    });
    q.focus();
  }
  init();
})();
