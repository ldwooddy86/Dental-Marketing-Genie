/* OmegaWeapon popup: the current site's read (a tracked agency's Horus read, or an audited target's grades),
   quick search across targets and agencies, the queue, the side panel, opt-in auto-detect. */
'use strict';
(function () {
  const IDX = window.RADAR_INDEX || [];
  const TIDX = window.OMEGA_INDEX || [];
  const META = window.RADAR_INDEX_META || {};
  const APP = chrome.runtime.getURL('app.html');
  const ARCHETYPES = [['local-service', 'Local service business'], ['multi-location', 'Multi-location / franchise'], ['ecommerce-dtc', 'National e-commerce / DTC'], ['b2b-saas', 'B2B / SaaS'], ['marketplace-leadgen', 'Marketplace / directory / lead-gen'], ['publisher-media', 'Publisher / media / creator'], ['healthcare', 'Healthcare / wellness'], ['legal', 'Legal'], ['financial', 'Financial services / fintech / lending'], ['real-estate', 'Real estate / housing / mortgage'], ['automotive', 'Automotive'], ['education', 'Education'], ['nonprofit-political', 'Nonprofit / political / religious'], ['app-first', 'App-first / consumer app'], ['agency', 'Agency / martech / review platform'], ['regulated-other', 'Other regulated or specialty vertical']];
  const $ = s => document.querySelector(s);
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function signed(v) { return v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(Math.round(v)); }
  function hostOf(url) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } }
  function match(url) {
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
  function openApp(hash) { chrome.tabs.create({ url: APP + (hash || '#pulse') }); window.close(); }
  let current = null;

  async function getStore() { const r = await chrome.storage.local.get('radar'); return r.radar || { watch: [], notes: {}, compare: [], theme: 'system', prefs: {}, queue: [] }; }
  async function setStore(d) { await chrome.storage.local.set({ radar: d }); }
  async function theme() {
    const d = await getStore();
    if (d.theme === 'light' || d.theme === 'dark') document.documentElement.setAttribute('data-theme', d.theme);
  }
  function grade(g) { return el('span', { class: 'grade g' + String(g || '?')[0] }, g || 'NA'); }

  function agencyCard(a, watched) {
    const band = el('span', { class: 'band ' + (a.ok ? a.band : 'Neutral') }, a.ok ? a.band : 'No read');
    const star = el('button', { class: 'btn', type: 'button', 'aria-pressed': String(watched) }, watched ? 'Watching' : 'Watch');
    star.addEventListener('click', async () => {
      const d = await getStore(); d.watch = d.watch || []; const i = d.watch.indexOf(a.id);
      if (i >= 0) d.watch.splice(i, 1); else d.watch.push(a.id);
      await setStore(d); star.textContent = i >= 0 ? 'Watch' : 'Watching'; star.setAttribute('aria-pressed', String(i < 0));
    });
    const panel = el('button', { class: 'btn', type: 'button' }, 'Side panel');
    panel.addEventListener('click', () => {
      try { chrome.sidePanel.open({ tabId: current && current.id }); } catch (e) { /* older Chrome */ }
      chrome.storage.session.set({ panelAgency: a.id }).finally(() => setTimeout(() => window.close(), 150));
    });
    const own = TIDX.find(t => t.self_radar_id === a.id);
    const book = TIDX.filter(t => t.radar_id === a.id);
    return el('section', { class: 'card stack' },
      el('div', { class: 'row between' }, el('div', null, el('div', { class: 'eyebrow' }, 'This site is a tracked agency'), el('h2', null, a.name), el('div', { class: 'muted small' }, a.domain + ' · ' + (a.archetype || 'Unclassified') + ' · ' + a.region)), band),
      a.ok ? el('div', { class: 'kpis' },
        el('div', null, el('b', null, signed(a.hti)), el('span', null, 'tailwind')),
        el('div', null, el('b', null, a.arc), el('span', null, 'Solar Arc')),
        el('div', null, el('b', null, a.best), el('span', null, a.bestName)),
        el('div', null, el('b', null, a.saydo), el('span', null, 'say/do'))) : null,
      el('p', { class: 'small' }, a.ok ? a.verdict : (a.reason || 'No Horus read.')),
      a.mon != null ? el('p', { class: 'small' }, el('b', null, 'Offshore: '), a.mband + ' ' + Math.round(a.mon) + ' · ' + Math.round((a.asia || 0) * 100) + '% of it toward South and Southeast Asia') : null,
      own || book.length ? el('p', { class: 'small' }, own ? el('span', null, 'Its own house, by the Omega: ', grade(own.overall), ' ') : null, book.length ? el('span', null, book.length + ' audited client site' + (book.length === 1 ? '' : 's') + ' in its book.') : null) : null,
      el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'button', onclick: () => openApp('#a.' + a.id + '.horus') }, 'Open the Horus read'), el('button', { class: 'btn', type: 'button', onclick: () => openApp('#a.' + a.id + '.omega') }, 'Omega tab'), panel, star));
  }

  function targetCard(t) {
    const panel = el('button', { class: 'btn', type: 'button' }, 'Side panel');
    panel.addEventListener('click', () => {
      try { chrome.sidePanel.open({ tabId: current && current.id }); } catch (e) { /* older Chrome */ }
      chrome.storage.session.set({ panelTarget: t.key }).finally(() => setTimeout(() => window.close(), 150));
    });
    const ag = t.radar_id ? IDX.find(a => a.id === t.radar_id) : null;
    return el('section', { class: 'card stack' },
      el('div', { class: 'row between' }, el('div', null, el('div', { class: 'eyebrow' }, 'This site is an Omega target' + (t.demo ? ' (demo fixture)' : '')), el('h2', null, t.business), el('div', { class: 'muted small' }, t.domain + ' · ' + (t.archetype_label || t.archetype || '') + ' · run ' + (t.run_date || ''))), grade(t.overall)),
      el('div', { class: 'kpis' },
        el('div', null, el('b', null, String(t.confirmed)), el('span', null, 'CONFIRMED')),
        el('div', null, el('b', null, String(t.findings)), el('span', null, 'findings')),
        el('div', null, el('b', null, String((t.failing || []).length)), el('span', null, 'pillars at D or F')),
        el('div', null, el('b', null, 'Tier ' + (t.tier == null ? 0 : t.tier)), el('span', null, 'access'))),
      el('p', { class: 'small' }, t.agency ? el('span', null, 'Agency of record: ' + t.agency.replace(/\s*\(footer credit\)/, ''), ag ? el('span', null, ' · in the Radar: ' + (ag.ok ? ag.band + ' ' + signed(ag.hti) : 'no read')) : null) : 'No agency of record identified.'),
      el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'button', onclick: () => openApp('#t/' + t.key) }, 'Open the dashboard'), el('button', { class: 'btn', type: 'button', onclick: () => openApp('#t/' + t.key + '/exposure') }, 'Exposure'), ag ? el('button', { class: 'btn', type: 'button', onclick: () => openApp('#a.' + ag.id + '.omega') }, 'Its agency') : null, panel));
  }

  function queueCard(url) {
    const host = hostOf(url);
    const sel = el('select', { 'aria-label': 'Archetype' }, ARCHETYPES.map(([k, l]) => el('option', { value: k }, l)));
    const note = el('input', { type: 'text', placeholder: 'the question to answer (optional)', 'aria-label': 'Question' });
    const status = el('p', { class: 'tiny muted' }, '');
    const btn = el('button', { class: 'btn primary', type: 'button' }, 'Queue ' + host + ' for the Omega');
    btn.addEventListener('click', async () => {
      const d = await getStore(); d.queue = d.queue || [];
      if (d.queue.some(q => q.domain === host)) { status.textContent = host + ' is already queued.'; return; }
      const dt = new Date(); const added = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      d.queue.push({ domain: host, business: current && current.title ? String(current.title).slice(0, 80) : '', archetype: sel.value, note: note.value, url: url, added });
      await setStore(d); status.textContent = 'Queued. Export the queue from the Targets wing and hand it to the skill.'; btn.disabled = true;
    });
    return el('section', { class: 'card stack' },
      el('div', { class: 'eyebrow' }, 'Not tracked, not audited yet'), el('h2', null, host),
      el('p', { class: 'small' }, 'Queue this domain and the skill runs the Omega on it: python3 scripts/omega_run.py ' + host + ' --archetype <id>. The dashboard lands in the Targets wing.'),
      el('div', { class: 'stack' }, sel, note, btn, status));
  }

  function results(q) {
    const n = norm(q); const host = $('#results'); host.replaceChildren();
    if (!n) { host.hidden = true; return; }
    const tl = TIDX.filter(t => norm(t.business + ' ' + t.domain + ' ' + (t.agency || '')).includes(n)).slice(0, 4);
    const al = IDX.filter(a => norm(a.name + ' ' + a.domain).includes(n)).sort((x, y) => (norm(y.name).startsWith(n) - norm(x.name).startsWith(n)) || (y.prominence || 0) - (x.prominence || 0)).slice(0, 8 - tl.length);
    if (!tl.length && !al.length) host.appendChild(el('div', { class: 'muted small' }, 'No target or agency matches.'));
    for (const t of tl) host.appendChild(el('button', { type: 'button', class: 'res', onclick: () => openApp('#t/' + t.key) }, el('span', null, t.business, ' ', el('span', { class: 'muted' }, t.domain)), el('span', { class: 'mono small muted' }, 'target · ' + (t.overall || 'NA'))));
    for (const a of al) host.appendChild(el('button', { type: 'button', class: 'res', onclick: () => openApp('#a.' + a.id) }, el('span', null, a.name, ' ', el('span', { class: 'muted' }, a.domain)), el('span', { class: 'mono small muted' }, a.ok ? a.band + ' ' + signed(a.hti) : a.status)));
    host.hidden = false;
  }

  async function autodetectRow() {
    const has = await chrome.permissions.contains({ permissions: ['tabs'] });
    const chk = el('input', { type: 'checkbox', id: 'auto' }); chk.checked = has;
    chk.addEventListener('change', async () => {
      if (chk.checked) { const ok = await chrome.permissions.request({ permissions: ['tabs'] }); chk.checked = ok; }
      else { await chrome.permissions.remove({ permissions: ['tabs'] }); }
      $('#auto-note').textContent = chk.checked ? 'On: the icon shows a tracked agency’s tailwind or a target’s grade, and the side panel follows the active tab.' : 'Off: the extension reads the current site only when you open this popup.';
    });
    return el('label', { class: 'check', for: 'auto' }, chk, 'Auto-detect tracked sites');
  }

  async function init() {
    await theme();
    $('#count').textContent = IDX.length + ' agencies · ' + TIDX.length + (TIDX.length === 1 ? ' target' : ' targets') + ' · Horus ' + (META.edition || '');
    $('#q').addEventListener('input', e => results(e.target.value));
    $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('#results .res'); if (b) b.click(); else openApp('#agencies'); } });
    $('#open').addEventListener('click', () => openApp('#pulse'));
    $('#targets').addEventListener('click', () => openApp('#targets'));
    $('#horus').addEventListener('click', () => openApp('#horus'));
    $('#auto-host').appendChild(await autodetectRow());
    const has = await chrome.permissions.contains({ permissions: ['tabs'] });
    $('#auto-note').textContent = has ? 'On: the icon shows a tracked agency’s tailwind or a target’s grade, and the side panel follows the active tab.' : 'Off: the extension reads the current site only when you open this popup.';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      current = tab || null;
      const url = tab && tab.url ? tab.url : '';
      const t = url ? matchTarget(url) : null;
      const hit = url ? match(url) : null;
      const d = await getStore();
      if (t) $('#site').replaceChildren(targetCard(t));
      else if (hit) $('#site').replaceChildren(agencyCard(hit, (d.watch || []).includes(hit.id)));
      else if (/^https?:/.test(url)) $('#site').replaceChildren(queueCard(url));
      else $('#site').replaceChildren(el('p', { class: 'muted small' }, 'Open a website to read it here: a tracked agency, an audited target, or a domain to queue.'));
    } catch (e) { $('#site').replaceChildren(el('p', { class: 'muted small' }, 'Could not read the current tab.')); }
    $('#q').focus();
  }
  init();
})();
