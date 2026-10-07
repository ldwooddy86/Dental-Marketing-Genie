/* Build time helpers for the Leviathan browser app. Node 22, no npm packages.
   patchConsole: the anchored edits that turn leviathan/Leviathan.html (the Leviathan repository) into console/Leviathan.html.
   Each anchor must occur exactly once, so a change upstream fails the build loudly instead of shipping a half patched console.
   extractRegistry: the compact module registry the popup, the omnibox and the tests read, taken from the page's lv-data block.
   writeZip: a store or deflate zip without a dependency. */
import zlib from 'node:zlib';

export const EXT_VERSION = '1.1.0';
export const MARK = 'lv-ext';

export function replaceOnce(text, oldStr, newStr, label) {
  const n = text.split(oldStr).length - 1;
  if (n !== 1) throw new Error(`${label}: the anchor occurs ${n} times in the console, expected exactly once`);
  return text.replace(oldStr, () => newStr);
}

/* The exact text in the console's frame script that each patch replaces. */
export const ANCHORS = {
  title: '<title>Leviathan</title>',
  frameStart: '<script>\n/* Leviathan console: spine, router, module host, cross industry views. */',
  srcdoc: '    f.srcdoc = html;\n',
  isFramed: 'function isFramed() { try { return window.self !== window.top; } catch (e) { return true; } }',
  prefsLoad: "  try { return Object.assign(d, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { return d; }",
  prefsSave: 'function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* storage off: keep in memory */ } }',
  /* the Résumé Forge: a console view beside the Agency Field (console/ext/resume-*.js) */
  spine: "navItem('agencies', 'Agency Field', 'Core agencies selling into each vertical')",
  parse: "  if (head === 'agencies') return { kind: 'view', view: 'agencies', filter: parts[1] || null, tok: t };",
  dispatch: "r.view === 'agencies' ? viewAgencies(r.filter) : viewCommand();",
  crumbs: "  else if (head === 'agencies') parts.push(crumb('Across industries'), sep(), crumb('Agency Field', true));",
  palette: "  items.push({ g: 'Console', t: 'Agency Field', s: 'Core agencies by vertical', r: 'agencies' });",
  paletteHead: '/* ---------------- command palette ---------------- */',
  agencyRow: "h('a', { class: 'agname', href: '#core.a.' + a.id, title: 'Open the dossier in the Core' }, a.name),",
  /* fixes to the frame script, carried the same way (each anchor exactly once) */
  fixParse: "  const t = decodeURIComponent(String(hash || '').replace(/^#/, '')) || 'command';",
  fixGo: "function go(tok) { if (decodeURIComponent(location.hash.slice(1)) === tok) route(); else location.hash = tok; }",
  fixSync: "  if (decodeURIComponent(location.hash.slice(1)) !== tok) { try { history.replaceState(null, '', '#' + tok); } catch (e) { /* ignore */ } }",
  fixCoreGo: "          if (id === 'core') { if (decodeURIComponent(L.api.route() || '') !== key) L.api.go(key); }",
  fixRegister: "      else if (p.key && id !== 'core' && api.current() !== p.key) api.go(p.key);",
  fixRetry: "      h('button', { class: 'btn pri', type: 'button', onclick: () => { unload(L.id); openModule(L.id, null); } }, 'Try again'),",
  fixErrorOpen: "    } else if (L.state === 'loading') {\n      L.pending = { key: key || (L.pending && L.pending.key) || null, payload: payload || null };\n    }",
  fixBoot: "route();\nwindow.__LV_CONSOLE = { live, open: openModule, go, prefs, version: '1.2.0' };",
  fixZipLink: "        meta.push(h('a', { href: '#' + V.mod + (MOD[V.mod].scope === 'national' ? '.paid' : '.index'), onclick: ev => { ev.preventDefault(); const pl = { zip: CV.sel }; if (MOD[V.mod].scope === 'national') pl.st = C.st[ZIDX.get(CV.sel)]; openModule(V.mod, MOD[V.mod].scope === 'national' ? 'paid' : 'index', pl); } }, 'Open in ' + MOD[V.mod].short));",
  fixSort: "    S = scoreAll(CV.st, keys, CV.minPop);\n    S.keys = keys;",
};

/* the view hook the frame script gains: the Forge draws with the console's own helpers, handed over as a context */
export const VIEW_HOOK = `/* ---------------- view: Résumé Forge (browser app, console/ext/resume-forge.js) ---------------- */
function viewResume(agency) {
  const X = window.__LV_RESUME;
  if (!X || typeof X.view !== 'function') return h('div', { class: 'wrap' }, h('p', { class: 'err', text: 'The Résumé Forge did not load (ext/resume-forge.js).' }));
  const setRoute = tok => { currentRoute = String(tok || 'resume'); try { history.replaceState(null, '', '#' + currentRoute); } catch (e) { /* ignore */ } paintSpine(); paintBar(); };
  return X.view(agency, { h, fill, add, icon, $, $$, N, D1, K, isN, toast, showTip, hideTip, tipRows, saveFile, go, setRoute, LV, AG, CORE, MOD, WING, WINGS, AVERT, SPECIFIC, dShort, dLong });
}

`;

export const PATCHES = [
  /* a marker in the head, so a patched console is never patched twice and the tests can read the app version */
  ['title', ANCHORS.title, v => `${ANCHORS.title}\n<meta name="${MARK}" content="${v}">`],
  /* the console side of the bridge loads before the frame script */
  ['frame start', ANCHORS.frameStart, () => `<script src="ext/host-bridge.js"></script>\n<script src="ext/resume-findings.js"></script>\n<script src="ext/resume-engine.js"></script>\n<script src="ext/resume-forge.js"></script>\n${ANCHORS.frameStart}`],
  /* every atlas document gets the shim that stands in for window.parent */
  ['srcdoc', ANCHORS.srcdoc, () => '    f.srcdoc = window.__LV_EXT ? window.__LV_EXT.wrapAtlas(html, L.id) : html;\n'],
  /* the console sits in the app's wrapper frame, which is not a viewer: downloads stay on */
  ['isFramed', ANCHORS.isFramed, () => 'function isFramed() { if (window.__LV_EXT) return false; try { return window.self !== window.top; } catch (e) { return true; } }'],
  /* preferences come from the wrapper (extension storage), since a sandboxed page has no localStorage */
  ['prefs load', ANCHORS.prefsLoad, () => `  if (window.__LV_EXT) return window.__LV_EXT.loadPrefs(d);\n${ANCHORS.prefsLoad}`],
  ['prefs save', ANCHORS.prefsSave, () => 'function savePrefs() { if (window.__LV_EXT) window.__LV_EXT.savePrefs(prefs); try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* storage off: keep in memory */ } }'],
  /* the Résumé Forge: a spine entry, a route, its crumbs, a palette entry, a link on every Agency Field row, and the view hook */
  ['spine', ANCHORS.spine, () => `${ANCHORS.spine}, navItem('resume', 'Résumé Forge', 'A résumé aimed at an agency’s weaknesses')`],
  ['route parse', ANCHORS.parse, () => `${ANCHORS.parse}\n  if (head === 'resume') return { kind: 'view', view: 'resume', agency: parts[1] || null, tok: t };`],
  ['route dispatch', ANCHORS.dispatch, () => "r.view === 'agencies' ? viewAgencies(r.filter) : r.view === 'resume' ? viewResume(r.agency) : viewCommand();"],
  ['crumbs', ANCHORS.crumbs, () => `${ANCHORS.crumbs}\n  else if (head === 'resume') { const ra = (LV.agencyIndex || []).find(x => x.id === currentRoute.split('.')[1]); parts.push(crumb('Across industries'), sep(), crumb('Résumé Forge', !ra)); if (ra) parts.push(sep(), crumb(ra.name, true)); }`],
  ['palette', ANCHORS.palette, () => `${ANCHORS.palette}\n  items.push({ g: 'Console', t: 'Résumé Forge', s: 'Resume builder aimed at an agency’s weaknesses and needs', r: 'resume' });`],
  ['agency row', ANCHORS.agencyRow, () => `${ANCHORS.agencyRow} h('a', { class: 'hbtag', href: '#resume.' + a.id, title: 'Build a résumé aimed at this agency' }, 'Résumé'),`],
  ['view hook', ANCHORS.paletteHead, () => VIEW_HOOK + ANCHORS.paletteHead],
  /* fixes: a malformed percent sequence in the hash no longer throws out of the router, the boot or a module sync */
  ['fix: safe decode in parseRoute', ANCHORS.fixParse, () => "  const t = lvDecode(String(hash || '').replace(/^#/, '')) || 'command';"],
  ['fix: safe decode in go', ANCHORS.fixGo, () => "function lvDecode(s) { try { return decodeURIComponent(s); } catch (e) { return String(s == null ? '' : s); } }\nfunction go(tok) { if (lvDecode(location.hash.slice(1)) === tok) route(); else location.hash = tok; }"],
  ['fix: safe decode in syncRouteFromModule', ANCHORS.fixSync, () => "  if (lvDecode(location.hash.slice(1)) !== tok) { try { history.replaceState(null, '', '#' + tok); } catch (e) { /* ignore */ } }"],
  ['fix: safe decode for a core route', ANCHORS.fixCoreGo, () => "          if (id === 'core') { if (lvDecode(L.api.route() || '') !== key) L.api.go(key); }"],
  /* fix: a core route chosen while OmegaWeapon boots is applied when it registers, like any other atlas */
  ['fix: a pending core route', ANCHORS.fixRegister, () => "      else if (p.key && (id === 'core' ? lvDecode(api.route() || '') !== p.key : api.current() !== p.key)) api.go(p.key);"],
  /* fix: Try again, and a route to an atlas that failed, reopen it on the route that was asked for */
  ['fix: Try again keeps the route', ANCHORS.fixRetry, () => "      h('button', { class: 'btn pri', type: 'button', onclick: () => { const p = L.pending; unload(L.id); openModule(L.id, p && p.key, p && p.payload); } }, 'Try again'),"],
  ['fix: a failed atlas retries on navigation', ANCHORS.fixErrorOpen, () => ANCHORS.fixErrorOpen + " else if (L.state === 'error') { const p = L.pending; unload(id); openModule(id, key || (p && p.key) || null, payload || (p && p.payload) || null); return; }"],
  /* fix: the console object exists even when the first route throws, so the bridge can still register atlases */
  ['fix: boot survives a bad first route', ANCHORS.fixBoot, () => "window.__LV_CONSOLE = { live, open: openModule, go, prefs, version: '1.2.0' };\ntry { route(); } catch (e) { console.error(e); }"],
  /* fix: Convergence hands the ZIP to a module that takes it (the Probable Cause index modules ignore a ZIP; their paid modules select it) */
  ['fix: Convergence ZIP link', ANCHORS.fixZipLink, () => "        meta.push(h('a', { href: '#' + V.mod + '.' + ((MOD[V.mod].scope === 'national' || /^criminal(_la)?$/.test(V.mod)) ? 'paid' : 'index'), onclick: ev => { ev.preventDefault(); const pl = { zip: CV.sel }; if (MOD[V.mod].scope === 'national') pl.st = C.st[ZIDX.get(CV.sel)]; openModule(V.mod, (MOD[V.mod].scope === 'national' || /^criminal(_la)?$/.test(V.mod)) ? 'paid' : 'index', pl); } }, 'Open in ' + MOD[V.mod].short));"],
  /* fix: a sort column that left the lens falls back to the score, instead of a silent sort by residents */
  ['fix: sort column follows the lens', ANCHORS.fixSort, () => ANCHORS.fixSort + "\n    if (!['rank', 'zip', 'city', 'pop', 'score', 'hot'].includes(CV.sort.k) && !keys.includes(CV.sort.k)) CV.sort = { k: 'score', dir: -1 };"],
];

/* Text the tests expect in the built console, each exactly once. */
export const MARKERS = [
  `<meta name="${MARK}"`,
  '<script src="ext/host-bridge.js"></script>',
  'window.__LV_EXT.wrapAtlas(html, L.id)',
  'if (window.__LV_EXT) return false;',
  'window.__LV_EXT.loadPrefs(d)',
  'window.__LV_EXT.savePrefs(prefs)',
  '<script src="ext/resume-findings.js"></script>',
  '<script src="ext/resume-engine.js"></script>',
  '<script src="ext/resume-forge.js"></script>',
  "navItem('resume', 'Résumé Forge'",
  "view: 'resume'",
  'viewResume(r.agency)',
  "crumb('Résumé Forge', !ra)",
  "t: 'Résumé Forge'",
  "href: '#resume.' + a.id",
  'function viewResume(agency)',
  'function lvDecode(',
  'openModule(L.id, p && p.key, p && p.payload)',
  'try { route(); } catch (e) { console.error(e); }',
];

/* the inline blocks the single file edition carries in place of the four script tags (lib/full.mjs writes them) */
const INLINE_BLOCK = /<script>\/\* ext\/[a-z-]+\.js \(inline\) \*\/[\s\S]*?\n<\/script>\n?/g;
export const stripInline = html => html.replace(INLINE_BLOCK, '');
/* the app version a patched console carries, or null */
export function patchedVersion(html) { const m = new RegExp(`<meta name="${MARK}" content="([^"]*)">`).exec(html); return m ? m[1] : null; }

/* Removes the browser app patch from a console that carries it, so the console can be patched again (a single file
   edition fed back into a console build, or the app's own console rebuilt in place). The version-bound meta, the script
   tags or inline blocks and the view hook are removed by shape; every other patch by its exact text. A patch this build
   does not know (an older or newer app wrote it) leaves its marker behind and the unpatch fails loudly. */
export function unpatchConsole(html) {
  let out = stripInline(html);
  out = out.replace(new RegExp(`\\n<meta name="${MARK}" content="[^"]*">`), '');
  out = out.replace(/(?:<script src="ext\/[a-z-]+\.js"><\/script>\n)+(?=<script>\n\/\* Leviathan console: )/, '');
  out = out.replace(/\/\* -{16} view: Résumé Forge[\s\S]*?(?=\/\* -{16} command palette -{16} \*\/)/, '');
  for (const [, anchor, repl] of PATCHES) { const r = repl(EXT_VERSION); if (r !== anchor && out.includes(r)) out = out.replace(r, () => anchor); }
  for (const m of MARKERS) if (out.includes(m)) throw new Error(`unpatch: "${m}" remains: the console carries a patch this build cannot remove; start from the file in the Leviathan repository`);
  return out;
}

/* applies the patch; a console that already carries one (any edition) is unpatched first, so patching is idempotent */
export function patchConsole(html, opts = {}) {
  const version = opts.version || EXT_VERSION;
  let out = html.includes(`<meta name="${MARK}"`) ? unpatchConsole(html) : html;
  for (const [label, anchor, repl] of PATCHES) out = replaceOnce(out, anchor, repl(version), label);
  return out;
}

const WING_LABEL = { core: 'Core', legal: 'Legal', home: 'Home services', health: 'Healthcare' };
const ST_NAME = { TX: 'Texas', LA: 'Louisiana' };
export const VIEWS = [
  { route: 'command', title: 'Command Deck', sub: 'The console home: every wing and atlas at a glance' },
  { route: 'convergence', title: 'Convergence', sub: 'Every vertical read together on one ZIP map' },
  { route: 'agencies', title: 'Agency Field', sub: 'The agencies across the atlases' },
  { route: 'resume', title: 'Résumé Forge', sub: 'Resume builder aimed at an agency’s weaknesses and needs' },
];

export function extractRegistry(html, opts = {}) {
  const m = /<script type="application\/json" id="lv-data">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('the lv-data block is missing from the console');
  const lv = JSON.parse(m[1]);
  const cv = /__LV_CONSOLE = \{[^}]*version: '([^']+)'/.exec(html);
  const vertOf = {}; for (const v of (lv.verts || [])) vertOf[v.mod] = v;
  const statesLabel = sts => sts.length === 2 ? 'Texas and Louisiana' : sts.map(s => ST_NAME[s] || s).join('');
  const scopeOf = mod => mod.scopeLabel ? mod.scopeLabel : mod.scope === 'national' ? 'National' : statesLabel((((vertOf[mod.id] || {}).states) || []).filter(s => s === 'TX' || s === 'LA'));
  const wingLabel = Object.assign({}, WING_LABEL);
  for (const w of (lv.wings || [])) if (w && typeof w === 'object' && typeof w.id === 'string' && typeof w.label === 'string') wingLabel[w.id] = w.label;
  const modules = (lv.modules || []).map(mod => ({
    id: mod.id, wing: mod.wing, wingLabel: wingLabel[mod.wing] || mod.wing, vertical: mod.vertical || '', short: mod.short || mod.id,
    name: mod.name || null, title: mod.title || null, sub: mod.sub || '', navTitle: mod.navTitle || null, scope: scopeOf(mod),
    facts: (mod.facts || []).slice(0, 3), raw: mod.raw || 0,
    mods: (mod.mods || []).map(x => ({ key: x.key, num: x.num || '', title: x.title || x.key, desc: x.desc || null })),
  }));
  const order = ['core', 'legal', 'home', 'health'];
  const wingIds = order.filter(w => modules.some(x => x.wing === w)).concat([...new Set(modules.map(x => x.wing))].filter(w => !order.includes(w)));
  const wings = wingIds.map(w => ({ id: w, label: wingLabel[w] || w, mods: modules.filter(x => x.wing === w).map(x => x.id) }));
  return {
    version: opts.version || EXT_VERSION, consoleVersion: cv ? cv[1] : null, compiled: lv.compiled || null,
    built: opts.built || new Date().toISOString().slice(0, 10), wings, modules, ext: Array.isArray(lv.ext) ? lv.ext : (lv.ext ? [lv.ext] : []), views: VIEWS,
  };
}

export function registryScript(reg) {
  return '/* Generated by build.mjs from the Leviathan console registry. Do not edit; rebuild instead. */\n' +
    'globalThis.LV_REGISTRY = ' + JSON.stringify(reg, null, 1) + ';\n';
}

/* ---- zip: local file headers, central directory, deflate or stored ---- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
export const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function writeZip(entries, when) {
  const now = when || new Date();
  const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  const parts = [], central = []; let offset = 0;
  for (const { name: rel, data } of entries) {
    const name = Buffer.from(rel, 'utf8'); const crc = crc32(data);
    let method = 0, body = data;
    if (data.length > 64) { const z = zlib.deflateRawSync(data, { level: 9 }); if (z.length < data.length) { method = 8; body = z; } }
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8); lh.writeUInt16LE(dt, 10); lh.writeUInt16LE(dd, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, body);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10); ch.writeUInt16LE(dt, 12); ch.writeUInt16LE(dd, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, name); offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(0, 4); eo.writeUInt16LE(0, 6); eo.writeUInt16LE(entries.length, 8); eo.writeUInt16LE(entries.length, 10); eo.writeUInt32LE(cd.length, 12); eo.writeUInt32LE(offset, 16); eo.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, eo]);
}
