/* Leviathan browser app · the console side of the bridge.
   Why this file exists. Manifest V3 forbids inline scripts on extension pages, and the console and its sixteen atlases are
   built from inline scripts that unpack more inline documents at run time. So the console runs as a sandboxed extension page
   (manifest "sandbox"), where inline scripts are allowed. A sandboxed document and every frame inside it get their own opaque
   origins, which turns the direct calls the atlases make into window.parent.__LEVIATHAN into security errors. This script,
   loaded before the console's own frame script, does three things:
     1. wrapAtlas(html, id): puts a shim at the top of every atlas document before it is framed. The shim stands in for
        window.parent (a replaceable property), carries the host answers the atlas reads at start (theme, rail, initial route)
        and speaks postMessage both ways. It also relays theme and chrome tweaks to the module documents a shell atlas nests,
        which the shell used to reach through contentDocument.
     2. answers those messages here and registers a proxy api with the console, so the console's own code runs unchanged.
     3. carries the console's preferences and route to the wrapper page (app.html), which keeps them in extension storage;
        a sandboxed page has no localStorage of its own.
   No atlas payload is modified; the console frame carries six one line patches (see lib/patch.mjs). */
(function () {
  'use strict';
  const VERSION = (document.querySelector('meta[name="lv-ext"]') || {}).content || '';
  let PARENT = null;
  try { PARENT = window.parent && window.parent !== window ? window.parent : null; } catch (e) { PARENT = null; }
  const live = () => (window.__LV_CONSOLE && window.__LV_CONSOLE.live) || {};
  const host = () => window.__LEVIATHAN || null;

  /* ---------- shim for the module documents a shell atlas nests (Dental Divide, Ocular Health, Termination Exposure) ---------- */
  const INNER_SRC = `(function () {
  var P = null; try { P = window.parent; } catch (e) { P = null; }
  if (!P || P === window) return;
  function btn() { return document.getElementById('themeBtn'); }
  function themed() { return document.documentElement.hasAttribute('data-theme') || !!btn(); }
  function apply(t) {
    var de = document.documentElement;
    if (!themed()) return;
    if (btn() && !document.getElementById('lv-ext-tweaks')) {
      try { var st = document.createElement('style'); st.id = 'lv-ext-tweaks'; st.textContent = '.masthead{display:none!important}#themeBtn{display:none!important}header{top:0}'; (document.head || de).appendChild(st); } catch (e) {}
    }
    var want = t === 'dark' ? 'dark' : 'light';
    if ((de.getAttribute('data-theme') || 'light') !== want) {
      de.setAttribute('data-theme', want);
      try { document.dispatchEvent(new Event('themechange')); } catch (e) {}
    }
  }
  window.addEventListener('message', function (ev) {
    var m = ev.data; if (!m || m.lv !== 'inner' || m.kind !== 'theme' || ev.source !== P) return;
    apply(m.t);
  });
  function ready() { try { P.postMessage({ lv: 'inner', kind: 'ready' }, '*'); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();`;

  /* ---------- shim for an atlas document: stands in for window.parent and speaks postMessage ---------- */
  const ATLAS_SRC = `(function () {
  var SEED = __SEED__;
  var INNER = __INNER__;
  var real = null; try { real = window.parent; } catch (e) { real = null; }
  if (!real || real === window) return;
  var S = { theme: SEED.theme || null, railHidden: !!SEED.railHidden, initialRoute: SEED.initialRoute || null };
  var api = null;
  function post(kind, extra) {
    var m = { lv: 'atlas', id: SEED.id, kind: kind };
    if (extra) for (var k in extra) m[k] = extra[k];
    try { real.postMessage(m, '*'); } catch (e) {}
  }
  function snap() {
    var o = { current: null, route: null };
    if (!api) return o;
    try { o.current = typeof api.current === 'function' ? api.current() : null; } catch (e) { o.current = null; }
    try { o.route = typeof api.route === 'function' ? api.route() : o.current; } catch (e) { o.route = o.current; }
    if (o.current === undefined) o.current = null;
    if (o.route === undefined) o.route = null;
    return o;
  }
  var host = {
    theme: function () { return S.theme === 'light' || S.theme === 'dark' ? S.theme : null; },
    framed: function () { return false; },
    canSave: function () { return false; },
    save: function (name, data) { post('save', { name: String(name || 'download'), data: data }); return Promise.resolve(false); },
    railHidden: function () { return S.railHidden; },
    initialRoute: function () { return S.initialRoute; },
    register: function (id, a) {
      api = a || null;
      var o = snap(), mods = null, kind = null;
      try { mods = api && typeof api.mods === 'function' ? api.mods() : null; } catch (e) { mods = null; }
      try { kind = (api && api.kind) || null; } catch (e) { kind = null; }
      post('register', { current: o.current, route: o.route, mods: mods, kindOf: kind });
    },
    moduleChanged: function (id, key) { var o = snap(); post('moduleChanged', { key: key == null ? null : key, current: o.current, route: o.route }); },
    moduleTheme: function (id, t) { post('moduleTheme', { t: t == null ? null : t }); },
    navigate: function (tok) { post('navigate', { tok: String(tok == null ? '' : tok) }); }
  };
  var fake = {
    __LEVIATHAN: host,
    postMessage: function (m, target, transfer) { try { return transfer ? real.postMessage(m, '*', transfer) : real.postMessage(m, '*'); } catch (e) {} }
  };
  var shadowed = false;
  try { Object.defineProperty(window, 'parent', { value: fake, configurable: true, writable: true }); shadowed = window.parent === fake; } catch (e) { shadowed = false; }
  if (!shadowed) { try { window.parent = fake; shadowed = window.parent === fake; } catch (e) { shadowed = false; } }
  if (!shadowed) return;
  window.addEventListener('message', function (ev) {
    var m = ev.data; if (!m || m.lv !== 'host' || ev.source !== real) return;
    try {
      if (m.kind === 'setTheme') { S.theme = m.t; if (api && typeof api.setTheme === 'function') api.setTheme(m.t); }
      else if (m.kind === 'rail') { S.railHidden = !m.on; if (api && typeof api.rail === 'function') api.rail(!!m.on); }
      else if (m.kind === 'go') { if (api && typeof api.go === 'function') api.go(m.key, m.payload); }
      else if (m.kind === 'brand') { if (api && typeof api.brand === 'function') api.brand(); }
    } catch (e) {}
    if (api) post('state', snap());
  });
  /* module documents nested in this atlas: give them the theme and the chrome tweaks the atlas used to apply through contentDocument */
  function inject(html) {
    var m = /<meta charset="utf-8">/i.exec(html) || /<head[^>]*>/i.exec(html);
    if (!m) return INNER + html;
    var at = m.index + m[0].length;
    return html.slice(0, at) + INNER + html.slice(at);
  }
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
    if (d && d.get && d.set) Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { var s = String(v); try { s = inject(s); } catch (e) {} return d.set.call(this, s); }
    });
  } catch (e) {}
  function themeNow() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function tell(w) { try { w.postMessage({ lv: 'inner', kind: 'theme', t: themeNow() }, '*'); } catch (e) {} }
  function broadcast() { var fs = document.querySelectorAll('iframe[srcdoc]'); for (var i = 0; i < fs.length; i++) if (fs[i].contentWindow) tell(fs[i].contentWindow); }
  try { new MutationObserver(broadcast).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', broadcast); } catch (e) {}
  window.addEventListener('message', function (ev) {
    var m = ev.data; if (!m || m.lv !== 'inner' || m.kind !== 'ready' || !ev.source) return;
    tell(ev.source);
  });
})();`;

  const INNER_TAG = '<script>' + INNER_SRC + '</script>';
  /* a JS literal safe inside an HTML script block: no '<' (so no premature </script>), no line separators */
  const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
  const jsLiteral = v => JSON.stringify(v).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
  function injectAfterHead(html, snippet) {
    const m = /<meta charset="utf-8">/i.exec(html) || /<head[^>]*>/i.exec(html);
    if (!m) return snippet + html;
    const at = m.index + m[0].length;
    return html.slice(0, at) + snippet + html.slice(at);
  }
  function seedFor(id) {
    const h = host(); let theme = null, railHidden = false, initialRoute = null;
    try { theme = h ? h.theme() : null; } catch (e) { theme = null; }
    try { railHidden = h ? !!h.railHidden(id) : false; } catch (e) { railHidden = false; }
    try { initialRoute = h ? (h.initialRoute(id) || null) : null; } catch (e) { initialRoute = null; }
    return { id: String(id), theme: theme === 'light' || theme === 'dark' ? theme : null, railHidden, initialRoute: initialRoute == null ? null : String(initialRoute) };
  }
  const atlasShim = seed => ATLAS_SRC.replace('__SEED__', () => jsLiteral(seed)).replace('__INNER__', () => jsLiteral(INNER_TAG));
  const wrapAtlas = (html, id) => injectAfterHead(String(html), '<script>' + atlasShim(seedFor(id)) + '</script>');

  /* ---------- the console end: one proxy api per live atlas ---------- */
  const cache = Object.create(null);
  function proxyFor(id, L) {
    const S = cache[id];
    const send = (kind, extra) => { try { L.frame.contentWindow.postMessage(Object.assign({ lv: 'host', kind }, extra || {}), '*'); } catch (e) { /* the frame is gone */ } };
    return {
      kind: S.kindOf || 'atlas',
      mods: () => (Array.isArray(S.mods) ? S.mods : []),
      current: () => (S.current == null ? null : S.current),
      route: () => (S.route == null ? null : S.route),
      theme: () => S.theme || 'system',
      setTheme: t => { S.theme = t; send('setTheme', { t }); },
      rail: on => send('rail', { on: !!on }),
      go: (key, payload) => send('go', { key: key == null ? null : key, payload: payload == null ? null : payload }),
      hasZip: () => false,
      brand: () => { send('brand'); return true; },
    };
  }
  window.addEventListener('message', ev => {
    const m = ev.data; if (!m || typeof m !== 'object') return;
    if (m.lv === 'wrapper') {
      if (!PARENT || ev.source !== PARENT) return;
      if (m.kind === 'go' && typeof m.hash === 'string') {
        try {
          const tok = decodeURIComponent(m.hash.replace(/^#/, '')) || 'command';
          if (window.__LV_CONSOLE) window.__LV_CONSOLE.go(tok); else location.hash = tok;
        } catch (e) { /* malformed hash */ }
      }
      return;
    }
    if (m.lv !== 'atlas' || typeof m.id !== 'string') return;
    const L = live()[m.id]; if (!L || !L.frame || ev.source !== L.frame.contentWindow) return;
    const h = host(); if (!h) return;
    const S = cache[m.id] || (cache[m.id] = {});
    try {
      if (m.kind === 'register') { S.current = m.current; S.route = m.route; S.mods = m.mods; S.kindOf = m.kindOf; h.register(m.id, proxyFor(m.id, L)); }
      else if (m.kind === 'state') { if ('current' in m) S.current = m.current; if ('route' in m) S.route = m.route; }
      else if (m.kind === 'moduleChanged') { S.current = 'current' in m ? m.current : m.key; S.route = 'route' in m ? m.route : m.key; h.moduleChanged(m.id, m.key); }
      else if (m.kind === 'moduleTheme') h.moduleTheme(m.id, m.t);
      else if (m.kind === 'navigate') h.navigate(m.tok);
      else if (m.kind === 'save') h.save(m.name, m.data);
    } catch (e) { /* the console keeps running */ }
  });

  /* ---------- preferences and route, to and from the wrapper page ---------- */
  function loadPrefs(d) {
    let p = null;
    try { const q = new URLSearchParams(location.search).get('lvp'); if (q) p = JSON.parse(q); } catch (e) { p = null; }
    if (p && typeof p === 'object') for (const k of Object.keys(p)) if (typeof p[k] === 'string') d[k] = p[k];
    return d;
  }
  function savePrefs(p) {
    if (!PARENT) return;
    try { PARENT.postMessage({ lv: 'prefs', prefs: JSON.parse(JSON.stringify(p)) }, '*'); } catch (e) { /* ignore */ }
  }
  let lastHash = null;
  function relayRoute(ready) {
    if (!PARENT) return;
    const hash = location.hash;
    if (!ready && hash === lastHash) return;
    lastHash = hash;
    try { PARENT.postMessage({ lv: 'route', hash, ready: !!ready }, '*'); } catch (e) { /* ignore */ }
  }
  window.addEventListener('hashchange', () => relayRoute(false));
  for (const k of ['replaceState', 'pushState']) {
    const orig = history[k];
    if (typeof orig === 'function') history[k] = function () { const r = orig.apply(this, arguments); try { relayRoute(false); } catch (e) { /* ignore */ } return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => relayRoute(true)); else relayRoute(true);

  /* ---------- the store: one snapshot of the wrapper's extension storage, for the scripts beside the console (the Résumé Forge) ----------
     The wrapper answers the bridge's ready signal with the whole snapshot; reads are then synchronous from the cache and every write
     updates the cache and posts the key to the wrapper, which merges and persists it. Until the snapshot has arrived no write leaves
     the page (it is kept and posted once the snapshot is in), so a slow wrapper can never have its draft overwritten by a blank one.
     If the snapshot is late, it is merged under the local writes and announced to the listeners (store.onSnapshot), so a view can
     re-read it. Outside the wrapper, localStorage stands in. */
  const storeCache = Object.create(null);
  const pending = new Set();
  const snapshotListeners = [];
  let storeReadyFn = null, storeReadyDone = false, snapshotSeen = false;
  const storeReady = new Promise(res => { storeReadyFn = res; });
  function settleStore(data, fromWrapper) {
    if (fromWrapper) {
      if (snapshotSeen) return;
      snapshotSeen = true;
      if (data && typeof data === 'object') for (const k of Object.keys(data)) if (!pending.has(k)) storeCache[k] = data[k];
    }
    const first = !storeReadyDone;
    if (first) { storeReadyDone = true; storeReadyFn(storeCache); }
    if (fromWrapper) {
      if (!first) snapshotListeners.forEach(f => { try { f(data && typeof data === 'object' ? data : {}); } catch (e) { /* a listener's problem */ } });
      for (const k of pending) postKey(k);
      pending.clear();
    }
  }
  function postKey(k) { try { PARENT.postMessage({ lv: 'store', key: String(k), value: storeCache[k] === undefined ? null : storeCache[k] }, '*'); return true; } catch (e) { return false; } }
  window.addEventListener('message', ev => {
    const m = ev.data; if (!m || typeof m !== 'object' || m.lv !== 'wrapper' || m.kind !== 'store' || !PARENT || ev.source !== PARENT) return;
    settleStore(m.data && typeof m.data === 'object' ? m.data : {}, true);
  });
  const LS_KEY = 'leviathan.store.v1';
  function localRead() { try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : {}; } catch (e) { return {}; } }
  function localWrite() { try { localStorage.setItem(LS_KEY, JSON.stringify(storeCache)); } catch (e) { /* storage off: memory only */ } }
  function localSettle() { if (!PARENT && !storeReadyDone) { const d = localRead(); for (const k of Object.keys(d)) storeCache[k] = d[k]; settleStore(null, false); } }
  const store = {
    available: () => !!PARENT,
    settled: () => (PARENT ? snapshotSeen : true),
    ready: () => { localSettle(); return storeReady; },
    onSnapshot: f => { if (typeof f === 'function') snapshotListeners.push(f); },
    get: key => { localSettle(); const v = storeCache[key]; return v === undefined || v === null ? undefined : v; },
    all: () => Object.assign({}, storeCache),
    set: (key, value) => {
      let v = null; try { v = value === undefined ? null : JSON.parse(JSON.stringify(value)); } catch (e) { return false; }
      storeCache[key] = v;
      if (!PARENT) { localWrite(); return true; }
      if (!snapshotSeen) { pending.add(String(key)); return true; }
      return postKey(key);
    },
  };
  if (PARENT) setTimeout(() => { if (!storeReadyDone) settleStore(null, false); }, 4000);

  window.__LV_EXT = { version: VERSION, loadPrefs, savePrefs, store, wrapAtlas, injectAfterHead, seedFor, atlasShim, INNER_SRC, ATLAS_SRC };
})();
