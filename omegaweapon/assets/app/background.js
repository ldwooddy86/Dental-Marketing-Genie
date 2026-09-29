/* OmegaWeapon service worker.
   Read-only and offline: no network calls, no content scripts, no page access.
   Address bar keyword, right-click lookups and queueing, keyboard shortcuts, and an opt-in badge on tracked sites. */
importScripts('js/index.js');
const IDX = self.RADAR_INDEX || [];
const TIDX = self.OMEGA_INDEX || [];
const APP = chrome.runtime.getURL('app.html');

function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
function hostOf(url) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } }
function matchUrl(url) {
  const host = hostOf(url); if (!host) return null;
  let best = null;
  for (const a of IDX) { const d = a.domain; if (d && (host === d || host.endsWith('.' + d))) { if (!best || d.length > best.domain.length) best = a; } }
  return best;
}
function matchTarget(url) {
  const host = hostOf(url); if (!host) return null;
  let best = null;
  for (const t of TIDX) { const d = t.key; if (d && (host === d || host.endsWith('.' + d))) { if (!best || d.length > best.key.length) best = t; } }
  return best;
}
function search(q) {
  const n = norm(q); if (!n) return { agencies: [], targets: [] };
  const targets = TIDX.filter(t => norm(t.business + ' ' + t.domain).includes(n)).slice(0, 3);
  const agencies = IDX.filter(a => norm(a.name + ' ' + a.domain).includes(n))
    .sort((x, y) => (norm(y.name).startsWith(n) - norm(x.name).startsWith(n)) || (y.prominence || 0) - (x.prominence || 0));
  return { agencies, targets };
}
function signed(v) { return v == null ? '' : (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(Math.round(v)); }
function xml(t) { return String(t).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); }
function openApp(hash, where) {
  const url = APP + (hash || '#pulse');
  if (where === 'current') chrome.tabs.update({ url }); else chrome.tabs.create({ url });
}
async function queueSite(url, title) {
  const host = hostOf(url); if (!host) return;
  const r = await chrome.storage.local.get('radar');
  const d = r.radar || { watch: [], notes: {}, compare: [], theme: 'system', prefs: {}, queue: [] };
  d.queue = d.queue || [];
  if (d.queue.some(q => q.domain === host)) return;
  const dt = new Date(); const added = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  d.queue.push({ domain: host, business: title ? String(title).slice(0, 80) : '', archetype: 'local-service', note: '', url, added });
  await chrome.storage.local.set({ radar: d });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'omega-selection', title: 'Look up “%s” in OmegaWeapon', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'omega-link', title: 'Look up this link’s site in OmegaWeapon', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'omega-page', title: 'Look up this site in OmegaWeapon', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'omega-queue', title: 'Queue this site for the Omega', contexts: ['page'] });
  });
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  if (reason === 'install') openApp('#pulse');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'omega-queue') { queueSite(info.pageUrl || (tab && tab.url) || '', tab && tab.title); return; }
  let url = '';
  if (info.menuItemId === 'omega-selection') url = 'https://' + String(info.selectionText || '').trim();
  else if (info.menuItemId === 'omega-link') url = info.linkUrl || '';
  else if (info.menuItemId === 'omega-page') url = info.pageUrl || '';
  const t = matchTarget(url);
  if (t) { openApp('#t/' + t.key); return; }
  let hit = matchUrl(url);
  if (!hit && info.menuItemId === 'omega-selection') { const s = search(info.selectionText); if (s.targets[0]) { openApp('#t/' + s.targets[0].key); return; } hit = s.agencies[0]; }
  openApp(hit ? '#a.' + hit.id + '.horus' : '#agencies');
});

chrome.omnibox.setDefaultSuggestion({ description: 'Search OmegaWeapon: a target, an agency name or a domain' });
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const s = search(text);
  suggest(s.targets.map(t => ({
    content: 't/' + t.key,
    description: '<match>' + xml(t.business) + '</match> <dim>' + xml(t.domain) + '</dim> <url>' + xml('target · overall ' + (t.overall || 'NA') + ' · ' + (t.run_date || '')) + '</url>'
  })).concat(s.agencies.slice(0, 6 - s.targets.length).map(a => ({
    content: 'a.' + a.id,
    description: '<match>' + xml(a.name) + '</match> <dim>' + xml(a.domain) + '</dim> <url>' + xml(a.ok ? a.band + ' ' + signed(a.hti) + ' · ' + a.arc + ' · ' + a.best : a.status) + '</url>'
  }))));
});
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  let hash = '#agencies';
  if (/^a\.[a-z0-9-]+$/.test(text) || /^t\/[a-z0-9.-]+$/.test(text)) hash = '#' + text;
  else { const s = search(text); if (s.targets[0]) hash = '#t/' + s.targets[0].key; else if (s.agencies[0]) hash = '#a.' + s.agencies[0].id; }
  openApp(hash, disposition === 'currentTab' ? 'current' : 'new');
});

chrome.commands.onCommand.addListener((cmd) => { if (cmd === 'open-dashboard') openApp('#pulse'); else if (cmd === 'open-targets') openApp('#targets'); });

// Opt-in badge: works only after the user grants the optional "tabs" permission from the popup.
function paintBadge(tabId, url) {
  const t = url ? matchTarget(url) : null;
  const a = url ? matchUrl(url) : null;
  if (t) {
    const g = String(t.overall || 'NA');
    chrome.action.setBadgeText({ tabId, text: g });
    chrome.action.setBadgeBackgroundColor({ tabId, color: g === 'A' || g === 'B' ? '#00859B' : g === 'C' ? '#8E5A0A' : g === 'D' || g === 'F' ? '#C24F38' : '#66727A' });
    chrome.action.setTitle({ tabId, title: 'OmegaWeapon target: ' + t.business + ' · overall ' + g });
  } else if (a && a.ok) {
    chrome.action.setBadgeText({ tabId, text: signed(a.hti).replace('±', '0') });
    chrome.action.setBadgeBackgroundColor({ tabId, color: a.hti >= 10 ? '#00859B' : a.hti <= -10 ? '#C24F38' : '#66727A' });
    chrome.action.setTitle({ tabId, title: 'Agency Radar: ' + a.name + ' · ' + a.band + ' ' + signed(a.hti) });
  } else if (a) {
    chrome.action.setBadgeText({ tabId, text: '•' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#66727A' });
    chrome.action.setTitle({ tabId, title: 'Agency Radar: ' + a.name + ' (no Horus read)' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
    chrome.action.setTitle({ tabId, title: 'OmegaWeapon' });
  }
}
chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if ((info.url || info.status === 'complete') && tab && tab.url) paintBadge(tabId, tab.url); });
chrome.tabs.onActivated.addListener(({ tabId }) => { chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t && t.url) paintBadge(tabId, t.url); }); });
chrome.permissions.onRemoved.addListener(() => {
  chrome.tabs.query({}, tabs => { for (const t of tabs || []) chrome.action.setBadgeText({ tabId: t.id, text: '' }); });
});
