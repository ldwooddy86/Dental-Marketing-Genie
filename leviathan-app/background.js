/* Leviathan · background service worker. Opens the console on install, on the keyboard command (Ctrl+Shift+L, Command+Shift+L
   on a Mac; chrome://extensions/shortcuts changes it) and from the address bar: type "lev", a space, then an atlas or module. */
"use strict";
importScripts('registry.js', 'open.js');
const B = globalThis.browser || globalThis.chrome;
const O = globalThis.LV_OPEN;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

B.runtime.onInstalled.addListener(d => { if (d && d.reason === 'install') O.openRoute('', { newTab: true }); });
if (B.commands && B.commands.onCommand) B.commands.onCommand.addListener(cmd => { if (cmd === 'open-console') O.openRoute(''); });
if (B.omnibox) {
  try { B.omnibox.setDefaultSuggestion({ description: 'Leviathan: open <match>%s</match>' }); } catch (e) { /* ignore */ }
  B.omnibox.onInputChanged.addListener((text, suggest) => {
    try { suggest(O.search(text).slice(0, 6).map(r => ({ content: r.route, description: esc(r.title) + ' <dim>' + esc(r.sub) + '</dim>' }))); }
    catch (e) { suggest([]); }
  });
  B.omnibox.onInputEntered.addListener((text, disposition) => {
    const route = O.resolve(text);
    if (disposition === 'currentTab') O.openRoute(route, { currentTab: true });
    else O.openRoute(route, { newTab: true, background: disposition === 'newBackgroundTab' });
  });
}
