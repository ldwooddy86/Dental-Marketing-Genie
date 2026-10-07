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
];

export function patchConsole(html, opts = {}) {
  const version = opts.version || EXT_VERSION;
  if (html.includes(`<meta name="${MARK}"`)) throw new Error('this console already carries the browser app patch; start from the file in the Leviathan repository');
  let out = html;
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
