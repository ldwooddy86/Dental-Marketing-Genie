/* Shared by the popup and the background: the registry search, and finding or opening the console tab.
   Classic script: popup.html loads it with a script tag, background.js with importScripts. Needs registry.js first. */
"use strict";
(function () {
  const B = globalThis.browser || globalThis.chrome;
  const REG = () => globalThis.LV_REGISTRY || { modules: [], wings: [], views: [] };
  const APP = 'app.html';
  const appUrl = route => B.runtime.getURL(APP) + (route ? '#' + route : '');
  const norm = s => String(s == null ? '' : s).toLowerCase();

  /* titles the way the console's spine shows them */
  function modTitle(m) { return m.id === 'core' ? 'OmegaWeapon' : m.wing === 'core' ? m.short : (m.navTitle || m.vertical || m.short); }
  function modSub(m) {
    if (m.id === 'core') return 'Agency Radar · Horus · Offshore · Targets';
    if (m.wing === 'core') return [m.name, (m.facts || [])[0]].filter(Boolean).join(' · ');
    return [m.short, m.scope].filter(Boolean).join(' · ');
  }
  /* everything that can be opened: the console views, the atlases, their modules */
  function entries() {
    const R = REG(); const out = [];
    for (const v of (R.views || [])) out.push({ route: v.route, title: v.title, sub: v.sub, view: true, text: norm(v.title + ' ' + v.sub) });
    for (const m of (R.modules || [])) {
      const title = modTitle(m), sub = modSub(m);
      out.push({ route: m.id, title, sub, id: m.id, wing: m.wing, text: norm([m.short, m.name, m.title, m.vertical, m.navTitle, m.wingLabel, m.scope, m.sub].join(' ')) });
      for (const x of (m.mods || [])) out.push({ route: m.id + '.' + x.key, title: x.title, sub: title + (x.num ? ' · module ' + x.num : ''), id: m.id, key: x.key, wing: m.wing, text: norm([x.title, x.desc, m.short, m.vertical].join(' ')) });
    }
    return out;
  }
  function search(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return entries().map(e => {
      let s = 0; const t = norm(e.title);
      for (const w of words) { if (!e.text.includes(w)) return null; s += t.startsWith(w) ? 3 : t.includes(w) ? 2 : 1; }
      if (!e.key) s += 1;
      return Object.assign({ score: s }, e);
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }
  function resolve(text) {
    const t = String(text || '').trim();
    if (!t) return 'command';
    if (entries().some(e => e.route === t)) return t;
    const r = search(t); return r.length ? r[0].route : 'command';
  }

  /* an open wrapper tab answers {tabId, windowId}; none answers within 400 ms means there is none */
  function whereIsConsole() {
    return new Promise(res => {
      let done = false;
      const finish = v => { if (!done) { done = true; clearTimeout(t); res(v); } };
      const t = setTimeout(() => finish(null), 400);
      try { B.runtime.sendMessage({ lv: 'where' }, r => { void (B.runtime.lastError); finish(r && typeof r.tabId === 'number' ? r : null); }); }
      catch (e) { finish(null); }
    });
  }
  /* open a route: in the console tab that is already open (it keeps its live atlases), else in a new tab */
  async function openRoute(route, opts) {
    opts = opts || {}; route = route || '';
    if (!opts.newTab) {
      const w = await whereIsConsole();
      if (w) {
        try {
          await B.tabs.update(w.tabId, { active: true });
          if (typeof w.windowId === 'number') { try { await B.windows.update(w.windowId, { focused: true }); } catch (e) { /* ignore */ } }
          await new Promise(res => { try { B.runtime.sendMessage({ lv: 'go', route, tabId: w.tabId }, () => { void (B.runtime.lastError); res(); }); } catch (e) { res(); } });
          return 'reused';
        } catch (e) { /* that tab is gone: fall through */ }
      }
    }
    if (opts.currentTab) { try { await B.tabs.update({ url: appUrl(route) }); return 'current'; } catch (e) { /* fall through */ } }
    await B.tabs.create({ url: appUrl(route) });
    return 'new';
  }
  globalThis.LV_OPEN = { appUrl, modTitle, modSub, entries, search, resolve, whereIsConsole, openRoute };
})();
