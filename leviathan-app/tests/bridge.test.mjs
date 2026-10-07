/* console/ext/host-bridge.js, run in a vm with a fake window: the preference loader, the atlas wrapper, and the two shims it
   plants in the atlas and module documents, driven through fake postMessage traffic. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'console', 'ext', 'host-bridge.js'), 'utf8');
let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 220) + ')' : ''}`); if (!c) fails++; };

/* ---- the console window ---- */
function consoleWindow(search, hostOverrides) {
  const listeners = {};
  const win = {
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    location: { search: search || '', hash: '#command' },
    history: { replaceState() { }, pushState() { } },
    document: { readyState: 'complete', querySelector: () => ({ content: '1.0.0' }), addEventListener() { } },
    __LEVIATHAN: Object.assign({ theme: () => 'dark', railHidden: id => id !== 'core', initialRoute: id => (id === 'hvac' ? 'paid' : null) }, hostOverrides || {}),
    URLSearchParams, console, listeners,
  };
  win.window = win; win.self = win; win.parent = win;
  vm.createContext(win);
  vm.runInContext(src, win, { filename: 'host-bridge.js' });
  return win;
}
const W = consoleWindow('?lvp=' + encodeURIComponent(JSON.stringify({ theme: 'dark', rail: 'native', junk: 1 })));
const X = W.__LV_EXT;
ok(X && X.version === '1.0.0', 'window.__LV_EXT carries the app version from the head marker');
const d = X.loadPrefs({ theme: 'system', rail: 'console', spine: 'open' });
ok(d.theme === 'dark' && d.rail === 'native' && d.spine === 'open' && !('junk' in d), 'loadPrefs merges the string preferences from the query string', JSON.stringify(d));
ok(consoleWindow('?lvp=%7Bnot-json').__LV_EXT.loadPrefs({ theme: 'system' }).theme === 'system', 'loadPrefs ignores a malformed query');
ok(consoleWindow('').__LV_EXT.loadPrefs({ theme: 'system' }).theme === 'system', 'loadPrefs without a query keeps the defaults');

/* ---- wrapAtlas ---- */
const META = '<meta charset="utf-8">', HOSTLINK = '<script>/* Leviathan host link */</script>';
const A = `<!doctype html>\n<html lang="en">\n<head>\n${META}\n${HOSTLINK}\n</head><body></body></html>`;
const wrapped = X.wrapAtlas(A, 'hvac');
const at = wrapped.indexOf('<script>(function () {');
ok(at === A.indexOf(META) + META.length, 'the shim is inserted right after the charset meta, ahead of the host link', at);
ok(wrapped.indexOf(HOSTLINK) > at, 'the host link now follows the shim');
ok(wrapped.includes('"id":"hvac"') && wrapped.includes('"theme":"dark"') && wrapped.includes('"railHidden":true') && wrapped.includes('"initialRoute":"paid"'), 'the seed carries id, theme, rail and initial route');
ok(X.wrapAtlas(A, 'core').includes('"railHidden":false') && X.wrapAtlas(A, 'core').includes('"initialRoute":null'), 'the core keeps its rail and has no pending route');
ok(wrapped.split('</script>').length - A.split('</script>').length === 1, 'the shim adds exactly one closing script tag');
ok(wrapped.includes('\\u003cscript>') && wrapped.includes('\\u003c/script>'), 'the inner shim rides inside the atlas shim as an escaped literal');
ok(X.wrapAtlas('<html><head><title>x</title></head>', 'x').indexOf('<script>') === '<html><head>'.length, 'without a charset meta the shim follows <head>');
ok(X.wrapAtlas('plain text', 'x').startsWith('<script>'), 'without a head the shim leads the document');
const body = wrapped.slice(at + '<script>'.length, wrapped.indexOf('</script>', at));
{ let p = true; try { new vm.Script(body); } catch (e) { p = false; console.log('   ' + e.message); } ok(p, 'the atlas shim compiles'); }
{ let p = true; try { new vm.Script(X.INNER_SRC); } catch (e) { p = false; console.log('   ' + e.message); } ok(p, 'the inner shim compiles'); }

/* ---- the atlas shim, in a fake atlas window whose parent is cross origin ---- */
function atlasWindow(code) {
  const sent = [], listeners = {}, srcdocs = [], attrs = {};
  const real = { postMessage(m) { sent.push(m); } };
  const de = { getAttribute: k => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, hasAttribute: k => k in attrs, classList: { add() { }, toggle() { }, contains: () => false } };
  function HTMLIFrameElement() { }
  Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', { configurable: true, enumerable: true, get() { return this._s; }, set(v) { this._s = v; srcdocs.push(v); } });
  class MutationObserver { observe() { } }
  const win = {
    parent: real, addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    document: { documentElement: de, querySelectorAll: () => [], readyState: 'complete', addEventListener() { }, getElementById: () => null },
    HTMLIFrameElement, MutationObserver, matchMedia: () => ({ matches: false, addEventListener() { } }), console, sent, listeners, real, srcdocs, attrs,
  };
  win.window = win; win.self = win;
  vm.createContext(win);
  vm.runInContext(code, win, { filename: 'atlas-shim.js' });
  return win;
}
const AW = atlasWindow(body);
ok(AW.parent !== AW.real && AW.parent && AW.parent.__LEVIATHAN, 'the shim shadows window.parent with the host stand in');
const H = AW.parent.__LEVIATHAN;
ok(H.theme() === 'dark' && H.railHidden('hvac') === true && H.initialRoute('hvac') === 'paid' && H.framed() === false && H.canSave() === false, 'the stand in answers the start up questions from the seed');
let cur = 'index'; const calls = [];
const api = { kind: 'atlas', mods: () => [{ key: 'index', num: '01', title: 'Index' }], current: () => cur, route: () => cur, go: k => { calls.push('go:' + k); cur = k; }, setTheme: t => calls.push('theme:' + t), rail: on => calls.push('rail:' + on) };
H.register('hvac', api);
const reg = AW.sent.find(m => m.kind === 'register');
ok(reg && reg.lv === 'atlas' && reg.id === 'hvac' && reg.current === 'index' && reg.route === 'index' && reg.kindOf === 'atlas' && reg.mods.length === 1, 'register posts a snapshot to the console', JSON.stringify(reg));
const deliver = (m, source) => { for (const f of (AW.listeners.message || [])) f({ data: m, source: source === undefined ? AW.real : source }); };
deliver({ lv: 'host', kind: 'setTheme', t: 'light' });
ok(calls.includes('theme:light') && AW.sent.some(m => m.kind === 'state'), 'a host setTheme reaches the atlas api and a state snapshot goes back');
deliver({ lv: 'host', kind: 'go', key: 'paid' });
ok(calls.includes('go:paid') && AW.sent.filter(m => m.kind === 'state').pop().current === 'paid', 'a host go reaches the atlas and the new module key is reported');
deliver({ lv: 'host', kind: 'rail', on: false });
ok(calls.includes('rail:false') && H.railHidden() === true, 'a host rail message reaches the api and updates the stand in');
{ const n = calls.length; deliver({ lv: 'host', kind: 'setTheme', t: 'dark' }, {}); ok(calls.length === n, 'messages from another window are ignored'); }
H.moduleChanged('hvac', 'paid');
{ const mc = AW.sent.filter(m => m.kind === 'moduleChanged').pop(); ok(mc && mc.key === 'paid' && mc.current === 'paid', 'moduleChanged carries the key and the snapshot', JSON.stringify(mc)); }
H.moduleTheme('hvac', 'light'); H.navigate('convergence.75001');
ok(AW.sent.some(m => m.kind === 'moduleTheme' && m.t === 'light') && AW.sent.some(m => m.kind === 'navigate' && m.tok === 'convergence.75001'), 'moduleTheme and navigate are forwarded');
AW.parent.postMessage({ atlas: 'ping' }, '*');
ok(AW.sent.some(m => m.atlas === 'ping'), 'the stand in forwards plain postMessage traffic to the real parent');
{
  const fr = new AW.HTMLIFrameElement(); fr.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>m</title></head></html>';
  ok(AW.srcdocs.length === 1 && AW.srcdocs[0].indexOf('<script>') === '<!DOCTYPE html><html><head><meta charset="utf-8">'.length && AW.srcdocs[0].includes('lv-ext-tweaks'), 'nested module documents get the inner shim after their charset meta');
}

/* ---- the inner shim, in a fake module document window ---- */
function innerWindow() {
  const sent = [], listeners = {}, kids = [], events = [], attrs = { 'data-theme': 'light' };
  const P = { postMessage(m) { sent.push(m); } };
  const btn = { id: 'themeBtn' };
  const de = { getAttribute: k => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, hasAttribute: k => k in attrs, appendChild: k => kids.push(k) };
  const win = {
    parent: P, addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    document: { documentElement: de, head: de, readyState: 'complete', addEventListener() { }, getElementById: id => (id === 'themeBtn' ? btn : id === 'lv-ext-tweaks' ? (kids.find(k => k.id === 'lv-ext-tweaks') || null) : null), createElement: tag => ({ tag }), dispatchEvent: e => events.push(e.type) },
    Event: class { constructor(t) { this.type = t; } }, console, sent, listeners, attrs, kids, events, P,
  };
  win.window = win; win.self = win;
  vm.createContext(win);
  vm.runInContext(X.INNER_SRC, win, { filename: 'inner-shim.js' });
  return win;
}
const IW = innerWindow();
ok(IW.sent.some(m => m.lv === 'inner' && m.kind === 'ready'), 'the inner shim announces itself to the atlas');
for (const f of IW.listeners.message) f({ data: { lv: 'inner', kind: 'theme', t: 'dark' }, source: IW.P });
ok(IW.attrs['data-theme'] === 'dark' && IW.kids.some(k => k.id === 'lv-ext-tweaks') && IW.events.includes('themechange'), 'a theme message sets data-theme, adds the chrome tweaks and dispatches themechange', JSON.stringify(IW.attrs));
for (const f of IW.listeners.message) f({ data: { lv: 'inner', kind: 'theme', t: 'light' }, source: {} });
ok(IW.attrs['data-theme'] === 'dark', 'a theme message from another window is ignored');
ok(IW.kids.filter(k => k.id === 'lv-ext-tweaks').length === 1, 'the tweaks style is added once');


/* ---- the store: the wrapper hands the bridge a snapshot on the ready signal; reads are synchronous; writes wait for the snapshot ---- */
{
  const sent = [], listeners = {};
  const parent = { postMessage(m) { sent.push(m); } };
  const win = {
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    location: { search: '', hash: '#resume' }, history: { replaceState() { }, pushState() { } },
    document: { readyState: 'complete', querySelector: () => ({ content: '1.1.0' }), addEventListener() { } },
    __LEVIATHAN: { theme: () => null, railHidden: () => false, initialRoute: () => null },
    URLSearchParams, console, setTimeout, clearTimeout, JSON, Promise,
  };
  win.window = win; win.self = win; win.parent = parent;
  vm.createContext(win);
  vm.runInContext(src, win, { filename: 'host-bridge.js' });
  const ST = win.__LV_EXT.store;
  ok(ST && ST.available() === true && ST.settled() === false && typeof ST.get === 'function' && typeof ST.set === 'function' && typeof ST.ready === 'function' && typeof ST.onSnapshot === 'function', 'the bridge exposes a store when a wrapper frames the console');
  ok(sent.some(m => m.lv === 'route' && m.ready === true), 'the bridge announces readiness to the wrapper on load');
  ok(ST.set('early', { n: 1 }) === true && ST.get('early').n === 1 && !sent.some(m => m.lv === 'store'), 'a write before the snapshot is cached and held, not posted');
  const deliver = (m, source) => { for (const f of (listeners.message || [])) f({ data: m, source: source === undefined ? parent : source }); };
  let settled = false; const ready = ST.ready().then(() => { settled = true; });
  deliver({ lv: 'wrapper', kind: 'store', data: { resume: { candidate: { name: 'Pat' } } } }, {});
  ok(!settled && ST.get('resume') === undefined && ST.settled() === false, 'a snapshot from another window is ignored');
  deliver({ lv: 'wrapper', kind: 'store', data: { resume: { candidate: { name: 'Pat' } }, early: { n: 0 } } });
  await ready;
  ok(settled && ST.settled() && ST.get('resume') && ST.get('resume').candidate.name === 'Pat' && ST.get('nothing') === undefined, 'the wrapper’s snapshot settles the store and get reads it synchronously', JSON.stringify(ST.get('resume')));
  ok(ST.get('early').n === 1 && sent.filter(m => m.lv === 'store').length === 1 && sent.find(m => m.lv === 'store').key === 'early' && sent.find(m => m.lv === 'store').value.n === 1, 'the held write wins over the snapshot for its key and is posted once the snapshot is in', JSON.stringify(sent.filter(m => m.lv === 'store')));
  ok(ST.set('resume', { candidate: { name: 'Sam', exp: [] } }) === true && ST.get('resume').candidate.name === 'Sam', 'set after the snapshot updates the cache at once');
  const setMsg = sent.filter(m => m.lv === 'store' && m.key === 'resume').pop();
  ok(setMsg && setMsg.value.candidate.name === 'Sam' && Array.isArray(setMsg.value.candidate.exp), 'and posts the key and a JSON clone of the value to the wrapper', JSON.stringify(setMsg));
  ok(ST.set('x', undefined) === true && ST.get('x') === undefined && Object.keys(ST.all()).includes('x'), 'an undefined value is stored as null and read back as undefined');
  const seen = []; ST.onSnapshot(d => seen.push(d));
  deliver({ lv: 'wrapper', kind: 'store', data: { resume: { candidate: { name: 'Again' } } } });
  ok(seen.length === 1 && ST.get('resume').candidate.name === 'Again', 'a later snapshot (another tab wrote) updates the cache and reaches the listeners', JSON.stringify(seen[0]));
  const alone = consoleWindow('');
  ok(alone.__LV_EXT.store.available() === false && alone.__LV_EXT.store.settled() === true, 'without a wrapper the store says so and counts as settled');
  await alone.__LV_EXT.store.ready().then(() => ok(true, 'and ready resolves at once from the local fallback'));
}

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
