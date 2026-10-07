/* Leviathan · the wrapper page. Hosts the sandboxed console in one frame, keeps the console's preferences in extension
   storage (a sandboxed page has none of its own), mirrors the console's route into this tab's URL so links and bookmarks
   work, and answers the popup, the omnibox and the keyboard command when they look for an open console tab. */
"use strict";
(async function () {
  const B = globalThis.browser || globalThis.chrome;
  const PREFS = 'leviathan.prefs.v1', RECENT = 'leviathan.recent.v1';
  const frame = document.getElementById('console');
  const get = async (k, d) => { try { const r = await B.storage.local.get(k); return r && r[k] !== undefined ? r[k] : d; } catch (e) { return d; } };
  const set = async (k, v) => { try { await B.storage.local.set({ [k]: v }); } catch (e) { /* storage off */ } };
  const post = m => { try { frame.contentWindow.postMessage(m, '*'); } catch (e) { /* frame not ready */ } };

  /* the console reads its preferences from the query string and its first route from the hash */
  const prefs = await get(PREFS, null);
  const q = prefs && typeof prefs === 'object' ? '?lvp=' + encodeURIComponent(JSON.stringify(prefs)) : '';
  frame.src = 'console/Leviathan.html' + q + location.hash;

  let tabId = null, windowId = null;
  try { const t = await B.tabs.getCurrent(); if (t) { tabId = t.id; windowId = t.windowId; } } catch (e) { /* not in a tab */ }

  const REG = () => globalThis.LV_REGISTRY || { modules: [] };
  async function recordRecent(hash) {
    const tok = decodeURIComponent(String(hash || '').replace(/^#/, ''));
    const id = tok.split('.')[0];
    if (!id || !REG().modules.some(m => m.id === id)) return;
    const list = (await get(RECENT, [])).filter(r => r && r.id !== id);
    list.unshift({ id, route: tok, at: Date.now() });
    await set(RECENT, list.slice(0, 8));
  }

  window.addEventListener('message', ev => {
    if (ev.source !== frame.contentWindow) return;
    const m = ev.data; if (!m || typeof m !== 'object') return;
    if (m.lv === 'prefs' && m.prefs && typeof m.prefs === 'object') set(PREFS, m.prefs);
    else if (m.lv === 'route' && typeof m.hash === 'string') {
      const hash = m.hash || '#command';
      if (location.hash !== hash) { try { history.replaceState(null, '', location.pathname + hash); } catch (e) { /* ignore */ } }
      recordRecent(hash);
    }
  });
  /* the tab's hash changed from outside (typed, a bookmark, the popup): hand it to the console */
  window.addEventListener('hashchange', () => post({ lv: 'wrapper', kind: 'go', hash: location.hash }));

  B.runtime.onMessage.addListener((m, sender, respond) => {
    if (!m || typeof m !== 'object') return false;
    if (m.lv === 'where') { respond({ tabId, windowId }); return false; }
    if (m.lv === 'go' && m.tabId === tabId && typeof m.route === 'string') {
      const h = '#' + m.route;
      if (location.hash === h) post({ lv: 'wrapper', kind: 'go', hash: h }); else location.hash = h;
      respond({ ok: true }); return false;
    }
    return false;
  });
})();
