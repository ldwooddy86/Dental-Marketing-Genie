/* ==== m16_publish ==== */
"use strict";
/* ============================ Module 16: Publish ============================ */
/* Codes only against the CMS contract in src/cms/00_cms_core.js. Every registered adapter gets a card generated from its
   fields; the pages come from the Site Forge (module 09), the composer or an imported file; CMS.deploy does the work and
   keeps the ledger. Renders with zero adapters loaded (a callout) and with any subset. No DOM access at load time beyond
   registerModule; everything happens in mount(). */
registerModule({
  key: 'publish', num: '16', title: 'Publish', desc: 'Send the pages the Site Forge built, or your own, to WordPress (Elementor or headless), Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla or Ghost',
  mount(root) {
    const st = { pages: [], selected: new Set(), target: '', previewSlug: null, confirm: {}, ctl: null, results: [], log: [], running: false, tab: 'forge' };
    const ENV = CMS.RT ? (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime && globalThis.browser.runtime.id && navigator.userAgent.includes('Firefox') ? 'firefox' : 'chrome') : (typeof inViewer === 'function' && inViewer()) ? 'viewer' : 'file';
    const ENVN = { chrome: 'the Chrome browser app', firefox: 'the Firefox browser app', viewer: 'the Claude viewer', file: 'a downloaded file' };
    const A = () => CMS.list();
    const T = () => (st.target && CMS.get(st.target)) || null;
    const hhmm = () => new Date().toLocaleTimeString();
    const when = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleString(); };
    const shortUrl = u => { try { const x = new URL(u); return x.host + (x.pathname.length > 1 ? x.pathname : '') + (x.search || ''); } catch (e) { return String(u || ''); } };
    const pathOf = u => { try { return new URL(u, 'https://x.invalid').pathname.replace(/\/?$/, '/').toLowerCase(); } catch (e) { return String(u || ''); } };
    const wordsOf = p => isN(p.words) ? +p.words : CMS.words(p.html);
    const mediaOf = p => { const slots = Object.values(p.media || {}).filter(Boolean); return { n: slots.length, bad: slots.filter(m => !m.url && !m.asset && (m.library || m.missing)).length }; };
    const hasLocal = p => Object.values(p.media || {}).some(m => m && (m.asset || /^data:(?!image\/svg\+xml)/.test(m.url || '')));
    const errText = e => (e && (e.message || String(e))) + (e && e.hint ? ' · ' + e.hint : '');

    root.innerHTML = mastHTML({ eyebrow: 'Module 16 · Publish · every CMS the site can live on', title: 'Publish', dek: 'The Site Forge writes the pages; this module sends them. One portable page goes out to whichever platform the site lives on: WordPress with Elementor or as a headless CMS behind the Next.js kit, Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla or Ghost. Each target is a card generated from what that platform needs, every page lands as a draft unless you say otherwise, photos are uploaded through the target or a media host, and a ledger remembers what went where so a second run updates instead of duplicating.',
      meta: [`<b>Runs in</b> ${ENVN[ENV] || ENV}`, `<b>Targets loaded</b> ${A().length}`, '<b>Storage</b> credentials and the ledger stay in this browser', '<b>Default</b> drafts; publishing live is a separate choice'],
      bar: 'Publish', barsub: 'Targets, pages, deploy, ledger', actions: [{ id: 'p16Bridge', label: '↓ Bridge plugin', title: 'forge-bridge.zip: the WordPress plugin that writes Elementor data, SEO fields and JSON-LD' }, { id: 'p16Kit', label: '↓ Next.js kit', title: 'The Next.js front end for headless WordPress' }, { id: 'p16Ledger', label: '↓ Ledger CSV', title: 'Everything sent, every target' }, { id: 'p16Forge', label: 'Site Forge ↗' }] }) +
      `<div class="wrap">
      <div id="p16Env"></div>
      <div class="kpis" id="p16Kpis"></div>

      <div class="card mt"><div class="card-h pb-head"><div><h3>Where to publish</h3><p>One card per platform, built from what that platform needs. Save keeps the fields in this browser, Test reads the site and reports what it found, Use as target picks where the pages go. Credentials never leave this machine.</p></div>
        <div class="ctl"><label class="fl" for="p16Target">Target</label><select id="p16Target"></select></div>
        <div class="ctl"><label class="fl" for="p16Media">Media host</label><select id="p16Media"></select><span class="hint">Where local photos are uploaded. Duda and the Wix blog cannot host uploads: pick WordPress, Shopify, Webflow, Ghost or HubSpot for them.</span></div></div>
        <div class="card-b" id="p16Targets"></div></div>

      <div class="card mt"><div class="card-h"><h3>What to publish</h3><p>Pages come from the Site Forge, from the composer below, or from a file. Each one is a portable page: title, slug, meta description, section markup with its css, JSON-LD, media slots. Tick the ones to send.</p></div><div class="card-b">
        <div class="ptabs" id="p16Tabs"><button type="button" data-v="forge" aria-pressed="true">Site Forge</button><button type="button" data-v="composer" aria-pressed="false">Composer</button><button type="button" data-v="import" aria-pressed="false">Import</button></div>
        <div class="pb-pane" id="p16PaneForge">
          <div class="cact"><button class="btn" id="p16fLoad">Load pages from the Site Forge</button><span class="mini" id="p16fNote">Module 09 plans and writes the pages; this reads its current plan with the photos assigned there.</span></div>
          <div id="p16fWarn"></div></div>
        <div class="pb-pane" id="p16PaneComposer" hidden>
          <div class="plan">
            <div class="f"><label class="fl" for="p16cTitle">Title <span class="mini pb-count" id="p16cTitleN"></span></label><input type="text" id="p16cTitle" autocomplete="off"></div>
            <div class="f"><label class="fl" for="p16cSlug">Slug</label><input type="text" id="p16cSlug" autocomplete="off" spellcheck="false"><span class="hint">Follows the title until you edit it.</span></div>
            <div class="f wide"><label class="fl" for="p16cMeta">Meta description <span class="mini pb-count" id="p16cMetaN"></span></label><input type="text" id="p16cMeta" autocomplete="off"><span class="hint">70 to 155 characters reads well in search results.</span></div>
            <div class="f"><label class="fl" for="p16cLang">Language</label><select id="p16cLang"><option value="en-US">English (en-US)</option><option value="es-US">Spanish (es-US)</option><option value="es-MX">Spanish (es-MX)</option><option value="en-GB">English (en-GB)</option><option value="fr-CA">French (fr-CA)</option></select></div>
            <div class="f"><label class="fl" for="p16cType">Post type</label><select id="p16cType"><option value="page">Page</option><option value="post">Post</option></select></div>
            <div class="f"><span class="fl">Options</span><label class="chk"><input type="checkbox" id="p16cNoindex"> noindex</label><label class="chk"><input type="checkbox" id="p16cClean" checked> House style on title and description (no dashes)</label></div>
            <div class="f wide"><label class="fl" for="p16cHtml">HTML body <span class="mini" id="p16cHtmlN"></span></label><textarea id="p16cHtml" class="code" spellcheck="false" placeholder="Section markup only: no html, head or body wrapper. The starter template gives you the forge skeleton."></textarea><span class="hint">Scripts and inline event handlers are dropped. The forge css classes (forge-section, forge-inner, forge-lede, forge-answer, forge-faq) are styled on every target.</span></div>
            <div class="f wide"><label class="fl" for="p16cSchema">JSON-LD <span class="mini">optional</span> <span class="mini" id="p16cSchemaN"></span></label><textarea id="p16cSchema" class="code" style="min-height:120px" spellcheck="false" placeholder='{"@context":"https://schema.org","@type":"WebPage","name":"..."}'></textarea></div>
          </div>
          <div class="cact mt"><button class="btn" id="p16cAdd">Add to the list</button><button class="btn sec" id="p16cTmpl">Insert the starter template</button><button class="btn ghost" id="p16cClear">Clear the draft</button><span class="mini">The draft is kept in this browser until you clear it.</span></div></div>
        <div class="pb-pane" id="p16PaneImport" hidden>
          <div class="drop" id="p16iDrop" tabindex="0" role="button">Drop .json or .html files here or click to choose</div><input type="file" id="p16iFile" multiple accept=".json,.html,.htm,application/json,text/html" hidden>
          <p class="mini" style="margin-top:8px">Accepted: a Site Forge bundle (.bundle.json), a blueprint (.blueprint.json, compiled here), a JSON array of either, or a complete HTML document (the title, the meta description, the main or body markup and any JSON-LD are read).</p>
          <div class="status" id="p16iLog" hidden></div></div>
        <div class="dsec" style="margin-top:18px">Pages loaded</div>
        <div class="cact"><button class="btn sm sec" id="p16SelAll">Select all</button><button class="btn sm sec" id="p16SelNone">None</button><button class="btn sm sec" id="p16SelUnsent">Only unsent</button><span class="mini" id="p16SelN"></span><span class="spacer"></span><button class="btn sm ghost" id="p16ClearPages">Remove all</button></div>
        <div class="tscroll mt" id="p16Pages"></div>
        <div id="p16Preview" class="mt" hidden></div></div></div>

      <div class="card mt"><div class="card-h"><h3>Publish</h3><p>Sends the ticked pages to the target. Drafts unless you tick Publish live, which asks for a second click. A page already in the target's ledger is updated in place (the adapter looks the slug up first). Media is resolved before each page: local photos are uploaded through the target or the media host, library lookups are searched, and an unresolved slot is dropped so nothing ships with a placeholder.</p></div><div class="card-b">
        <div class="chips"><label class="chk"><input type="checkbox" id="p16Live"> Publish live (otherwise drafts)</label><label class="chk"><input type="checkbox" id="p16OnlyNew" checked> Skip pages already sent to this target</label><label class="chk"><input type="checkbox" id="p16ReqMedia"> Require every image (stop when a slot is unresolved)</label></div>
        <div class="cact mt"><button class="btn" id="p16Go">Deploy</button><button class="btn sec" id="p16Stop" disabled>Stop</button><button class="btn sec" id="p16Verify">Verify links</button><button class="btn sec" id="p16SiteGo" hidden>Publish site now</button><span class="mini" id="p16GoNote"></span></div>
        <div class="status mt pb-log" id="p16Status">Nothing sent yet.</div>
        <div class="xscroll mt" id="p16Results"></div></div></div>

      <div class="card mt"><div class="card-h pb-head"><div><h3>Sent so far</h3><p>The ledger for the selected target: what was sent, as what, where it lives, and what went wrong. It is what Skip pages already sent reads.</p></div><div class="cact"><button class="btn sm sec" id="p16LedCsv">↓ CSV for this target</button></div></div>
        <div class="card-b"><div class="tscroll short" id="p16LedgerT"></div></div></div>

      ${card('How it works', '', '<ol class="meth" id="p16Meth"></ol>', 'mt')}
      <div class="split">${card('Judgment calls', '', '<div id="p16Judg"></div>')}${card('Source register', '', '<div id="p16Src"></div>')}</div>
      <div class="foot">DFW Thermal Debt Atlas, module 16. The Site Forge writes; this module sends. Nothing goes live without a second click, and every credential stays in this browser.</div></div>`;

    /* ---------- environment ---------- */
    function env() {
      const host = $('#p16Env', root);
      if (ENV === 'viewer') { host.innerHTML = callout('judg', 'Inside the Claude viewer: nothing can be sent from here', 'The viewer blocks every outbound call, so Test and Deploy fail in this view. Load the pages, write and preview them, export the ledger and the plugin; install the browser app to publish.'); return; }
      if (ENV === 'file') { host.innerHTML = callout('note', 'Opened as a file', 'A file has no site permissions, so each CMS must allow this origin in its own CORS settings (the FORGE bridge has an allowed origins list; the hosted platforms do not). The browser app has no such limit; install it to publish anywhere.'); return; }
      host.innerHTML = callout('note', `Running as ${ENVN[ENV]}`, `Deploy runs from this page with the credentials in the cards below. The extension asks once for access to each site you publish to, on the first Test or Deploy against it; the hosted platforms (Wix, Duda, Webflow, Shopify, HubSpot) are already permitted. Credentials and the ledger stay in extension storage on this machine.`);
    }
    /* ---------- KPIs ---------- */
    function kpis() {
      const list = A(); const conf = list.filter(a => CMS.status(a.id).state !== 'unconfigured').length; const conn = list.filter(a => CMS.status(a.id).state === 'connected').length;
      let sent = 0, last = ''; list.forEach(a => Object.values(CMS.deployedFor(a.id)).forEach(r => { if (r && r.ok !== false) sent++; if (r && r.at && r.at > last) last = r.at; }));
      const t = T();
      $('#p16Kpis', root).innerHTML = kpiHTML([
        { l: 'Targets', v: `${conf} of ${list.length}`, d: list.length ? `${conn} tested and connected` : 'no adapters loaded' },
        { l: 'Pages loaded', v: N(st.pages.length), d: `${st.selected.size} selected` },
        { l: 'Pages sent', v: N(sent), d: 'across every target, from the ledger' },
        { l: 'Last deploy', v: last ? new Date(last).toLocaleDateString() : '—', d: last ? new Date(last).toLocaleTimeString() : 'nothing sent yet' },
        { l: 'Target', v: t ? esc(t.name) : '—', d: t ? esc(CMS.status(t.id).label) : 'choose one in the cards' },
      ]);
    }
    /* ---------- target cards ---------- */
    function optList(f) { return (f.options || f.opts || []).map(o => (o && typeof o === 'object') ? { v: o.v != null ? o.v : o.value, l: o.l != null ? o.l : (o.label != null ? o.label : o.v) } : { v: o, l: o }); }
    function fieldHTML(a, f, c) {
      const id = `p16F-${a.id}-${f.k}`; const has = c[f.k] != null && c[f.k] !== ''; const v = has ? c[f.k] : (f.def != null ? f.def : '');
      const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''; const lab = `${esc(f.l || f.k)}${f.optional ? ' <span class="mini">optional</span>' : ''}`;
      if (f.t === 'checkbox') return `<div class="f"><span class="fl">&nbsp;</span><label class="chk" for="${id}"><input type="checkbox" id="${id}" data-k="${esc(f.k)}" data-t="checkbox" ${v === true || v === 'true' || v === 1 || v === '1' ? 'checked' : ''}> ${lab}</label>${hint}</div>`;
      if (f.t === 'select') return `<div class="f"><label class="fl" for="${id}">${lab}</label><select id="${id}" data-k="${esc(f.k)}" data-t="select">${optList(f).map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>${hint}</div>`;
      if (f.t === 'textarea') return `<div class="f wide"><label class="fl" for="${id}">${lab}</label><textarea id="${id}" data-k="${esc(f.k)}" data-t="textarea" spellcheck="false">${esc(v)}</textarea>${hint}</div>`;
      const type = (f.secret || f.t === 'password') ? 'password' : f.t === 'number' ? 'number' : 'text';
      return `<div class="f${f.wide ? ' wide' : ''}"><label class="fl" for="${id}">${lab}</label><input type="${type}" id="${id}" data-k="${esc(f.k)}" data-t="${type}" value="${esc(v)}" autocomplete="off" spellcheck="false" placeholder="${esc(f.placeholder || (f.t === 'url' ? 'https://' : ''))}">${hint}</div>`;
    }
    function capsLine(a) {
      const c = a.caps || {}; const items = [['media', 'uploads'], ['urls', 'live urls'], ['publishSite', 'site publish'], ['elementor', 'elementor'], ['seo', 'seo fields']].map(([k, l]) => `<span class="${c[k] ? 'on' : ''}">${l}</span>`);
      items.push(`<span class="on">json-ld ${esc(c.schema || 'inline')}</span>`); if (c.postTypes) items.push(`<span class="on">${esc(c.postTypes.join(', '))}</span>`);
      return `<div class="pb-caps">${items.join('')}</div>`;
    }
    function targetCard(a) {
      const c = CMS.cfg(a.id); const caps = a.caps || {}; const wp = /^wp_/.test(a.id) || !!caps.bridge;
      return `<div class="conn${st.target === a.id ? ' pb-on' : ''}" data-id="${esc(a.id)}"><div class="ch"><b>${esc(a.name)}</b> <span class="pill" id="p16St-${esc(a.id)}"></span><label class="chk pb-use"><input type="radio" name="p16Use" value="${esc(a.id)}" ${st.target === a.id ? 'checked' : ''}> Use as target</label></div>
        <p class="mini">${esc(a.blurb || '')}</p>${capsLine(a)}
        <div class="plan">${(a.fields || []).map(f => fieldHTML(a, f, c)).join('')}</div>
        <div class="cact"><button class="btn sm sec" data-a="save">Save</button><button class="btn sm" data-a="test">Test</button>${caps.publishSite && typeof a.publishSite === 'function' ? '<button class="btn sm sec" data-a="publishSite">Publish site</button>' : ''}${typeof a.configure === 'function' ? `<button class="btn sm sec" data-a="configure">${a.id === 'wp_headless' ? 'Configure bridge for headless' : 'Configure'}</button>` : ''}${caps.headlessKit ? '<button class="btn sm ghost" data-a="kit">↓ Next.js kit</button>' : ''}${wp ? '<button class="btn sm ghost" data-a="bridge">↓ Bridge plugin</button>' : ''}</div>
        <details class="cdet"><summary>Setup</summary>${(a.setup || []).length ? `<ol class="steps" style="margin-top:8px">${a.setup.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="mini" style="margin:8px 0">No steps listed by this adapter.</p>'}${a.docs ? `<p class="mini">Docs: <a href="${esc(a.docs)}" target="_blank" rel="noopener">${esc(a.docs)}</a></p>` : ''}</details>
        <details class="cdet"><summary>Clear</summary><div class="cact" style="margin-top:8px"><button class="btn sm ghost" data-a="forget">Forget credentials</button><button class="btn sm ghost" data-a="clearLedger">Clear sent ledger</button></div></details>
        <div class="status" id="p16Log-${esc(a.id)}" hidden></div></div>`;
    }
    function renderTargets() {
      const host = $('#p16Targets', root); const list = A();
      if (!list.length) { host.innerHTML = callout('judg', 'No CMS adapters are loaded', 'The platform adapters live in <code class="mono">src/cms/1x_*.js</code> and app.html loads them before this module. None registered, so there is nowhere to send a page yet. The composer, the import and the preview still work; reload the app once the adapter files are in place.'); fillSelects(); return; }
      const groups = []; list.forEach(a => { const g = a.group || a.name; let grp = groups.find(x => x.name === g); if (!grp) { grp = { name: g, items: [] }; groups.push(grp); } grp.items.push(a); });
      host.innerHTML = groups.map(g => `<div class="pb-group"><div class="dsec">${esc(g.name)}</div><div class="conns">${g.items.map(targetCard).join('')}</div></div>`).join('');
      $$('.conn', host).forEach(cardEl => { const id = cardEl.dataset.id; $$('button[data-a]', cardEl).forEach(b => b.onclick = () => act(id, b.dataset.a, cardEl)); const r = $('input[name="p16Use"]', cardEl); if (r) r.onchange = () => { if (r.checked) setTarget(id); }; });
      fillSelects(); pills();
    }
    function pills() { A().forEach(a => { const s = CMS.status(a.id); const pill = $(`#p16St-${a.id}`, root); if (pill) { pill.textContent = s.label; pill.className = 'pill st-' + s.state; pill.title = s.label; } }); }
    function fillSelects() {
      const list = A(); const ts = $('#p16Target', root); const ms = $('#p16Media', root); const S = CMS.settings();
      ts.innerHTML = `<option value="">${list.length ? 'Choose a target' : 'No adapters loaded'}</option>` + list.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join(''); ts.value = list.some(a => a.id === st.target) ? st.target : '';
      const hosts = list.filter(a => (a.caps || {}).media && typeof a.uploadMedia === 'function');
      ms.innerHTML = '<option value="">Same as the target</option>' + hosts.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join(''); ms.value = hosts.some(a => a.id === S.mediaHost) ? S.mediaHost : '';
    }
    const log = (id, msg, isErr) => { const h = $(`#p16Log-${id}`, root); if (!h) return; h.hidden = false; h.style.color = isErr ? 'var(--critical)' : ''; h.textContent = `${hhmm()} ${msg}`; };
    const readFields = cardEl => { const patch = {}; $$('[data-k]', cardEl).forEach(i => { patch[i.dataset.k] = i.type === 'checkbox' ? i.checked : String(i.value || '').trim(); }); return patch; };
    const ctxFor = () => ({ http: CMS.http, log: m => slog(m), mediaHost: null, signal: st.ctl ? st.ctl.signal : undefined });
    /* before any call into an adapter: the required fields are filled, and the user's own site is permitted (asked once) */
    async function grant(ad) {
      if (!ad) return; if (!CMS.fieldsOk(ad, CMS.cfg(ad.id))) throw CMS.err(`${ad.name} is not configured`, { status: 0, hint: 'fill in the required fields on its card and Save' });
      if (typeof ad.dynamicHost === 'function') { const o = ad.dynamicHost(CMS.cfg(ad.id)); if (o) { const p = await CMS.ensureOrigin(o); if (!p.granted) throw CMS.err(`Site access to ${p.origin} was not granted; the browser asks once per site.`, { status: 0, hint: 'click again and accept the prompt' }); } }
      /* fixed API hosts come from the manifest; when one is missing there (a region host, a renamed host) ask for it once: optional_host_permissions covers every https host */
      const pats = (Array.isArray(ad.hosts) ? ad.hosts : []).filter(h => /^https?:\/\//.test(String(h))); if (!pats.length || !CMS.RT || !CMS.RT.permissions) return;
      let has = false; try { has = await CMS.RT.permissions.contains({ origins: pats }); } catch (e) { has = false; }
      if (has) return; let ok = false; try { ok = await CMS.RT.permissions.request({ origins: pats }); } catch (e) { ok = false; }
      if (!ok) throw CMS.err(`Access to the ${ad.name} API hosts was not granted`, { status: 0, hint: `accept the prompt for ${pats.join(', ')}` });
    }
    /* two clicks for anything destructive: the first arms the button for four seconds */
    function armed(btn, key, label) { if (st.confirm[key]) { st.confirm[key] = false; if (btn) btn.textContent = label; return true; } st.confirm[key] = true; if (btn) btn.textContent = 'Click again to confirm'; setTimeout(() => { st.confirm[key] = false; if (btn && btn.isConnected) btn.textContent = label; }, 4000); return false; }
    async function act(id, a, cardEl) {
      const ad = CMS.get(id); if (!ad) return; const btn = $(`button[data-a="${a}"]`, cardEl); const busy = on => { if (btn) btn.disabled = on; };
      try {
        if (a === 'save') { const patch = readFields(cardEl); const old = CMS.cfg(id); const norm = v => (v === true ? 'true' : (v == null || v === false) ? '' : String(v)); const changed = Object.keys(patch).some(k => norm(old[k]) !== norm(patch[k])); if (changed && old._tested) patch._tested = null; await CMS.setCfg(id, patch); log(id, changed && old._tested ? 'Saved. The settings changed, so Test again.' : 'Saved in this browser.'); toast(`${ad.name} settings saved`); }
        if (a === 'test') { busy(true); await CMS.setCfg(id, readFields(cardEl)); await grant(ad); log(id, 'Testing…'); const r = await CMS.test(id); if (r && r.ok === false) { await CMS.setCfg(id, { _tested: null }); log(id, (r.info || 'The test did not pass') + (r.hint ? ' · ' + r.hint : ''), true); toast(`${ad.name}: test did not pass`); } else { log(id, (r && r.info) || 'Connected.'); toast(`${ad.name}: connected`); } }
        if (a === 'publishSite') { busy(true); await CMS.setCfg(id, readFields(cardEl)); await grant(ad); log(id, 'Publishing the site…'); const r = await ad.publishSite(CMS.cfg(id), ctxFor()); log(id, (r && r.info) || 'Site published.'); toast(`${ad.name}: site published`); }
        if (a === 'configure') { busy(true); await CMS.setCfg(id, readFields(cardEl)); await grant(ad); log(id, 'Configuring…'); const r = await ad.configure(CMS.cfg(id), ctxFor()); log(id, (r && r.info) || 'Configured.'); toast(`${ad.name}: configured`); }
        if (a === 'kit') kitZip();
        if (a === 'bridge') bridgeZip();
        if (a === 'forget') { if (!armed(btn, id + ':forget', 'Forget credentials')) return; await CMS.clearCfg(id); if (CMS.settings().mediaHost === id) await CMS.setSettings({ mediaHost: '' }); renderTargets(); toast(`${ad.name}: credentials removed`); }
        if (a === 'clearLedger') { if (!armed(btn, id + ':ledger', 'Clear sent ledger')) return; await CMS.clearDeployed(id); log(id, 'Ledger cleared for this target.'); renderPages(); renderLedger(); }
      } catch (e) { log(id, errText(e), true); toast(`${ad.name}: ${e.message || e}`); }
      finally { busy(false); pills(); kpis(); }
    }
    function setTarget(id) {
      st.target = id && CMS.get(id) ? id : ''; CMS.setSettings({ target: st.target });
      $('#p16Target', root).value = st.target; $$('input[name="p16Use"]', root).forEach(r => r.checked = r.value === st.target); $$('#p16Targets .conn', root).forEach(c => c.classList.toggle('pb-on', c.dataset.id === st.target));
      $('#p16SiteGo', root).hidden = true; renderPages(); renderLedger(); updateGo(); kpis();
    }
    function mediaHostFor(ad, notes) {
      const mh = CMS.settings().mediaHost; if (!mh || mh === ad.id) return ''; const h = CMS.get(mh);
      if (!h || !(h.caps || {}).media || typeof h.uploadMedia !== 'function') return '';
      if (CMS.status(mh).state === 'unconfigured') { (notes || []).push(`Media host ${h.name} is not configured; uploads go through ${ad.name} instead.`); return ''; }
      return mh;
    }
    /* ---------- downloads ---------- */
    function bridgeZip() { if (typeof FORGE_BRIDGE_PHP === 'undefined') { toast('The bridge plugin source is not loaded (src/07_forge_bridge_raw.js)'); return; } saveFile('forge-bridge.zip', zipBlob([{ name: 'forge-bridge/forge-bridge.php', data: FORGE_BRIDGE_PHP }])); }
    function kitZip() {
      const K = globalThis.HEADLESS_KIT; if (!K || typeof K.zipEntries !== 'function') { toast('The Next.js kit is not loaded (src/cms/19_headless_kit.js)'); return; }
      const c = CMS.cfg('wp_headless'); let wpUrl = CMS.trimSlash(c.url || ''), siteUrl = CMS.trimSlash(c.siteUrl || '');
      if (!wpUrl || !siteUrl) { const cardEl = $('.conn[data-id="wp_headless"]', root); if (cardEl) { const f = $(`[data-k="${!wpUrl ? 'url' : 'siteUrl'}"]`, cardEl); cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (f) f.focus(); } toast('Fill in the WordPress URL and the front end URL on the WordPress · Headless card, Save, then download the kit'); return; }
      const col = BRAND.colors || {}; const brand = { name: BRAND.name, primary: col.primary, accent: col.accent, dark: col.dark };
      try { const entries = K.zipEntries({ wpUrl, siteUrl, brand, siteName: BRAND.name, cta: { url: '/contact/', label: 'Book service' } }); saveFile('forge-headless-kit.zip', zipBlob(entries)); }
      catch (e) { toast('Kit: ' + e.message); }
    }
    /* ---------- pages ---------- */
    function persistLoaded() { store.set('tda.publish.loaded', { at: new Date().toISOString(), slugs: st.pages.map(p => p.slug) }); }
    function addPages(list, source) {
      let n = 0; (list || []).forEach(p => { if (!p || !p.slug) return; p = Object.assign({}, p); if (!p.source) p.source = source || 'import'; if (!p.checks && Array.isArray(p.lint) && p.lint.length) p.checks = checksFromLint(p.lint); const i = st.pages.findIndex(x => x.slug === p.slug); if (i >= 0) st.pages[i] = p; else st.pages.push(p); st.selected.add(p.slug); n++; });
      persistLoaded(); renderPages(); kpis(); updateGo(); return n;
    }
    function removePage(slug) { st.pages = st.pages.filter(p => p.slug !== slug); st.selected.delete(slug); if (st.previewSlug === slug) closePreview(); persistLoaded(); renderPages(); kpis(); updateGo(); }
    const checksFromLint = lint => { const block = lint.filter(l => /^BLOCK/.test(l)).length; const warn = lint.filter(l => !/^BLOCK/.test(l)).length; return { block, warn, note: 0, issues: lint.map(l => ({ sev: /^BLOCK/.test(l) ? 'block' : 'warn', id: 'lint', msg: l })) }; };
    const checksCell = ch => { const parts = []; if (ch.block) parts.push(`<span class="pb-red">${N(ch.block)} block</span>`); if (ch.warn) parts.push(`<span class="pb-warn">${N(ch.warn)} warn</span>`); return parts.length ? parts.join(' ') : '<span class="pb-ok">clean</span>'; };
    function statusCell(d) {
      if (!d) return '<span class="mini">not sent</span>';
      if (d.ok === false) return `<span class="pill st-expired">error</span> <span class="mini" title="${esc(d.error || '')}">${esc(String(d.error || '').slice(0, 80))}</span>`;
      const link = d.link ? ` <a href="${esc(d.link)}" target="_blank" rel="noopener" title="${esc(d.link)}">open</a>` : ''; const edit = d.edit ? ` <a href="${esc(d.edit)}" target="_blank" rel="noopener">edit</a>` : '';
      return `<span class="pill ${d.status === 'publish' ? 'st-connected' : 'st-configured'}">sent ${esc(d.status || 'draft')}</span>${link}${edit}<div class="mini">${esc(when(d.at))}</div>`;
    }
    function rowHTML(p, led) {
      const m = mediaOf(p); const sel = st.selected.has(p.slug); const d = led[p.slug];
      return `<tr class="${sel ? 'pb-sel' : ''}${st.previewSlug === p.slug ? ' pb-cur' : ''}" data-slug="${esc(p.slug)}"><td><input type="checkbox" data-sel="${esc(p.slug)}" ${sel ? 'checked' : ''} aria-label="Select ${esc(p.title)}"></td><td class="l">${esc(p.kind || p.post_type || 'page')}${p.label ? `<div class="mini">${esc(p.label)}</div>` : ''}</td><td class="l pb-wrap" style="max-width:320px">${esc(p.title)}${p.noindex ? ' <span class="mini">noindex</span>' : ''}</td><td class="l"><code class="mono">/${esc(p.slug)}/</code></td><td>${N(wordsOf(p))}</td><td>${p.checks ? checksCell(p.checks) : '—'}</td><td>${m.n ? `${m.n}${m.bad ? ` <span class="pb-red">${m.bad} unresolved</span>` : ''}` : '—'}</td><td class="l">${statusCell(d)}</td><td class="l"><div class="cact"><button class="btn sm sec" data-a="preview">Preview</button><button class="btn sm ghost" data-a="remove">Remove</button></div></td></tr>`;
    }
    function renderPages() {
      const host = $('#p16Pages', root); const t = T(); const led = t ? CMS.deployedFor(t.id) : {};
      st.selected.forEach(s => { if (!st.pages.some(p => p.slug === s)) st.selected.delete(s); });
      if (!st.pages.length) { const rec = store.get('tda.publish.loaded', null); host.innerHTML = `<p class="mini pb-empty">No pages loaded. Load them from the Site Forge, write one in the composer, or import a file.${rec && rec.slugs && rec.slugs.length ? ` Last time ${rec.slugs.length} page${rec.slugs.length === 1 ? ' was' : 's were'} loaded (${esc(rec.slugs.slice(0, 6).join(', '))}${rec.slugs.length > 6 ? ', …' : ''}); pages hold photos, so they are not saved between sessions.` : ''}</p>`; selN(); return; }
      host.innerHTML = `<table><thead><tr><th><input type="checkbox" id="p16SelHead" aria-label="Select every page" ${st.pages.length && st.pages.every(p => st.selected.has(p.slug)) ? 'checked' : ''}></th><th class="l">Kind</th><th class="l">Title</th><th class="l">Slug</th><th>Words</th><th>Checks</th><th>Media</th><th class="l">On ${t ? esc(t.name) : 'the target'}</th><th class="l">Actions</th></tr></thead><tbody>${st.pages.map(p => rowHTML(p, led)).join('')}</tbody></table>`;
      $$('input[data-sel]', host).forEach(cb => cb.onchange = () => { if (cb.checked) st.selected.add(cb.dataset.sel); else st.selected.delete(cb.dataset.sel); cb.closest('tr').classList.toggle('pb-sel', cb.checked); selN(); kpis(); updateGo(); });
      $('#p16SelHead', host).onchange = e => { st.pages.forEach(p => { if (e.target.checked) st.selected.add(p.slug); else st.selected.delete(p.slug); }); renderPages(); kpis(); updateGo(); };
      $$('tr[data-slug]', host).forEach(tr => { const slug = tr.dataset.slug; $('button[data-a="preview"]', tr).onclick = () => preview(slug); $('button[data-a="remove"]', tr).onclick = () => removePage(slug); });
      selN();
    }
    function selN() { const el2 = $('#p16SelN', root); if (el2) el2.textContent = st.pages.length ? `${st.selected.size} of ${st.pages.length} selected` : ''; }
    function selectWhere(fn) { st.pages.forEach(p => { if (fn(p)) st.selected.add(p.slug); else st.selected.delete(p.slug); }); renderPages(); kpis(); updateGo(); }
    function preview(slug) {
      const p = st.pages.find(x => x.slug === slug); const host = $('#p16Preview', root); if (!p) { closePreview(); return; }
      st.previewSlug = slug; host.hidden = false;
      const doc = CMS.fullHtml(Object.assign({}, p, { html: CMS.stripScripts(p.html) }));
      host.innerHTML = `<div class="card"><div class="card-h pb-head"><div><h3>Preview · ${esc(p.title)}</h3><p>/${esc(p.slug)}/ · ${N(wordsOf(p))} words · ${p.post_type || 'page'} · ${esc(p.language || 'en-US')}. Rendered from the portable page the target receives: its css, markup and JSON-LD. The platform's own header, footer and theme wrap it after publishing.</p></div><div class="cact"><button class="btn sm sec" id="p16PvHtml">↓ HTML</button><button class="btn sm ghost" id="p16PvClose">Close</button></div></div><div class="card-b"><iframe class="prev pb-prev" sandbox="allow-same-origin" title="Page preview"></iframe></div></div>`;
      $('iframe', host).srcdoc = doc;
      $('#p16PvHtml', host).onclick = () => saveFile(p.slug + '.html', doc);
      $('#p16PvClose', host).onclick = closePreview;
      $$('#p16Pages tr[data-slug]', root).forEach(tr => tr.classList.toggle('pb-cur', tr.dataset.slug === slug));
      try { host.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
    }
    function closePreview() { const host = $('#p16Preview', root); host.hidden = true; host.innerHTML = ''; st.previewSlug = null; $$('#p16Pages tr.pb-cur', root).forEach(tr => tr.classList.remove('pb-cur')); }
    /* ---------- Site Forge ---------- */
    function loadForge() {
      const f = MODI.forge; const note = $('#p16fNote', root); const b = $('#p16fLoad', root);
      if (!f) { toast('The Site Forge module is not loaded'); note.textContent = 'Module 09 is not loaded in this build.'; return; }
      b.disabled = true;
      try {
        if (!f.mounted) { f.mounted = true; f.mount($('#mod-forge')); }
        if (typeof f.publishPages !== 'function') throw new Error('this build of the Site Forge has no hand off (publishPages)');
        const pages = f.publishPages() || [];
        if (!pages.length) { note.textContent = 'The Site Forge plan is empty. Open module 09, choose markets and page types, then load again.'; $('#p16fWarn', root).innerHTML = ''; toast('No pages in the Site Forge plan'); return; }
        const n = addPages(pages, 'forge'); forgeWarn(pages); note.textContent = `${n} page${n === 1 ? '' : 's'} loaded from the Site Forge at ${hhmm()}. Load again after editing the plan.`; toast(`${n} page${n === 1 ? '' : 's'} loaded`);
      } catch (e) { console.error(e); toast('Site Forge: ' + e.message); note.textContent = 'Could not load: ' + e.message; }
      finally { b.disabled = false; }
    }
    function forgeWarn(pages) {
      const host = $('#p16fWarn', root); let bad = 0, pgs = 0, lib = 0, miss = 0, blocks = 0;
      pages.forEach(p => { const slots = Object.values(p.media || {}).filter(Boolean); const b = slots.filter(m => !m.url && !m.asset && (m.library || m.missing)); if (b.length) { pgs++; bad += b.length; lib += b.filter(m => m.library).length; miss += b.filter(m => m.missing).length; } if (p.checks && p.checks.block) blocks++; });
      const parts = [];
      if (bad) parts.push(callout('judg', `${bad} media slot${bad === 1 ? '' : 's'} on ${pgs} page${pgs === 1 ? '' : 's'} have no photo`, `${lib ? `${lib} will be searched in the target's media library at deploy (a matching file name or title wins). ` : ''}${miss ? `${miss} point at assets that are not loaded in this session (photos are not saved with the plan; drop them again in Site Forge step 7). ` : ''}A slot that stays unresolved is dropped so the page never ships with a placeholder; tick Require every image below to stop instead.`));
      if (blocks) parts.push(callout('', `${blocks} page${blocks === 1 ? '' : 's'} carry a blocking check`, 'The deploy driver refuses a page whose lint has a BLOCK line. Fix it in the Site Forge studio (module 09, step 6) and load again.'));
      host.innerHTML = parts.join('');
    }
    /* ---------- composer ---------- */
    const CK = 'tda.publish.composer';
    const cd = Object.assign({ title: '', slug: '', slugManual: false, meta: '', lang: 'en-US', type: 'page', html: '', schema: '', noindex: false, clean: true }, store.get(CK, {}) || {});
    const cEl = k => $('#p16c' + k, root);
    const cSave = debounce(() => store.set(CK, cd), 300);
    function cWrite() { cEl('Title').value = cd.title; cEl('Slug').value = cd.slug; cEl('Meta').value = cd.meta; cEl('Lang').value = cd.lang; cEl('Type').value = cd.type; cEl('Html').value = cd.html; cEl('Schema').value = cd.schema; cEl('Noindex').checked = !!cd.noindex; cEl('Clean').checked = cd.clean !== false; cCount(); }
    function cRead() { cd.title = cEl('Title').value; cd.slug = cEl('Slug').value; cd.meta = cEl('Meta').value; cd.lang = cEl('Lang').value; cd.type = cEl('Type').value; cd.html = cEl('Html').value; cd.schema = cEl('Schema').value; cd.noindex = cEl('Noindex').checked; cd.clean = cEl('Clean').checked; }
    function cCount() {
      const t = cEl('Title').value.length; const tn = cEl('TitleN'); tn.textContent = `${t} / 60`; tn.className = 'mini pb-count' + (t > 60 ? ' over' : '');
      const m = cEl('Meta').value.length; const mn = cEl('MetaN'); mn.textContent = `${m} / 155`; mn.className = 'mini pb-count' + (m > 160 ? ' over' : m && m < 70 ? ' short' : '');
      const h = cEl('Html').value; cEl('HtmlN').textContent = h.trim() ? `${N(CMS.words(h))} words · ${(h.match(/<h1\b/gi) || []).length} h1 · ${(h.match(/<h2\b/gi) || []).length} h2 · ${(h.match(/<img\b/gi) || []).length} img` : '';
      const s = cEl('Schema').value.trim(); const sn = cEl('SchemaN'); if (!s) { sn.textContent = ''; sn.className = 'mini'; } else { try { const j = JSON.parse(s); const n = Array.isArray(j) ? j.length : (j['@graph'] ? j['@graph'].length : 1); sn.textContent = `valid · ${n} node${n === 1 ? '' : 's'}`; sn.className = 'mini pb-ok'; } catch (e) { sn.textContent = 'not valid JSON: ' + e.message.replace(/^JSON\.parse:?\s*/i, ''); sn.className = 'mini pb-red'; } }
    }
    const starter = t => { const ph = (BRAND.phone || '').replace(/[^\d+]/g, ''); return [
      `<section id="hero" class="forge-section forge-sec-hero forge-light"><div class="forge-inner"><p class="forge-eyebrow">${esc(BRAND.short || BRAND.name || 'Brand')}</p><h1>${esc(t || 'Page title')}</h1><p class="forge-lede">One sentence that says who this page is for and what happens next.</p><p class="forge-ctas"><a class="forge-btn forge-btn-primary" href="tel:${esc(ph)}">Call ${esc(BRAND.phone || '')}</a> <a class="forge-btn forge-btn-secondary" href="#contact">Book service</a></p></div></section>`,
      `<section id="answer" class="forge-section forge-tint"><div class="forge-inner forge-narrow"><h2>The short answer</h2><p class="forge-answer">Two or three sentences that answer the question this page exists for, in plain words, with a number where you have one.</p></div></section>`,
      `<section id="detail" class="forge-section"><div class="forge-inner forge-narrow"><h2>What to expect</h2><p>Say what happens on the visit, what it costs, and how long it takes.</p><ul><li>First point.</li><li>Second point.</li><li>Third point.</li></ul></div></section>`,
      `<section id="faq" class="forge-section forge-tint"><div class="forge-inner forge-narrow"><h2>Frequently asked questions</h2><details class="forge-faq"><summary><h3>First question?</h3></summary><p>The answer.</p></details><details class="forge-faq"><summary><h3>Second question?</h3></summary><p>The answer.</p></details></div></section>`,
      `<section id="contact" class="forge-section forge-brand"><div class="forge-inner forge-narrow"><h2>Talk to ${esc(BRAND.short || BRAND.name || 'us')}</h2><p>Call ${esc(BRAND.phone || '')} or send the form and we call back the same day.</p></div></section>`].join('\n'); };
    const linksOf = html => { const out = []; const re = /<a\b[^>]*href=(["'])([^"'#][^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi; let m; const dom = String(BRAND.domain || '').toLowerCase(); while ((m = re.exec(html))) { const u = m[2]; if (/^\//.test(u) || (dom && u.toLowerCase().includes(dom))) out.push({ anchor: CMS.stripTags(m[3]), url: u }); } return out; };
    function composerChecks(p) {
      const issues = []; const push = (sev, id, msg) => issues.push({ sev, id, msg, where: 'composer' });
      if (!/<h1\b/i.test(p.html)) push('warn', 'h1', 'No h1 in the body'); if ((p.html.match(/<h1\b/gi) || []).length > 1) push('warn', 'h1', 'More than one h1');
      if (!p.meta_description) push('warn', 'meta', 'No meta description'); else if (p.meta_description.length > 160) push('warn', 'meta', 'Meta description over 160 characters'); else if (p.meta_description.length < 70) push('warn', 'meta', 'Meta description under 70 characters');
      if (p.title.length > 60) push('warn', 'title', 'Title over 60 characters'); if (CMS.words(p.html) < 120) push('warn', 'thin', 'Under 120 words');
      if (/<(iframe|object|embed)\b/i.test(p.html)) push('warn', 'embed', 'Embeds are stripped by some platforms (Webflow, Wix)');
      return { block: issues.filter(i => i.sev === 'block').length, warn: issues.filter(i => i.sev === 'warn').length, note: 0, issues };
    }
    function cAdd() {
      cRead(); const clean = cd.clean !== false && typeof houseClean === 'function' ? houseClean : s => s;
      const title = clean(cd.title.trim()); if (!title) { toast('Give the page a title'); cEl('Title').focus(); return; }
      if (!cd.html.trim()) { toast('The HTML body is empty; insert the starter template or paste your markup'); cEl('Html').focus(); return; }
      let schema = null; if (cd.schema.trim()) { try { schema = JSON.parse(cd.schema); } catch (e) { toast('The JSON-LD is not valid JSON: ' + e.message); cEl('Schema').focus(); return; } }
      const html = CMS.stripScripts(cd.html.trim()); const h1m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      const page = CMS.pageFromHtml({ title, h1: h1m ? CMS.stripTags(h1m[1]) : title, slug: cd.slug.trim() || title, meta_description: clean(cd.meta.trim()), summary: clean(cd.meta.trim()), language: cd.lang, post_type: cd.type, html, schema, noindex: cd.noindex, brand: BRAND.colors, links: linksOf(html) });
      page.kind = 'composer'; page.label = 'Composer'; page.checks = composerChecks(page); page.words = CMS.words(html);
      addPages([page], 'composer'); toast(`Added /${page.slug}/ to the list`); store.set(CK, cd);
    }
    cWrite();
    ['Title', 'Slug', 'Meta', 'Html', 'Schema'].forEach(k => cEl(k).addEventListener('input', () => { if (k === 'Title' && !cd.slugManual) cEl('Slug').value = CMS.slug(cEl('Title').value); if (k === 'Slug') cd.slugManual = !!cEl('Slug').value.trim(); cRead(); cCount(); cSave(); }));
    ['Lang', 'Type', 'Noindex', 'Clean'].forEach(k => cEl(k).addEventListener('change', () => { cRead(); cSave(); }));
    cEl('Add').onclick = cAdd;
    cEl('Tmpl').onclick = () => { const ta = cEl('Html'); const t = starter(cEl('Title').value.trim()); ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '\n') + t : t; cRead(); cCount(); cSave(); toast('Starter template inserted'); ta.focus(); };
    cEl('Clear').onclick = () => { if (!armed(cEl('Clear'), 'composer:clear', 'Clear the draft')) return; Object.assign(cd, { title: '', slug: '', slugManual: false, meta: '', html: '', schema: '', noindex: false }); cWrite(); store.set(CK, cd); toast('Draft cleared'); };
    /* ---------- import ---------- */
    function mediaFromBp(bp) { const out = {}; for (const [k, spec] of Object.entries((bp && bp.media) || {})) { if (!spec) continue; const src = spec.source || ''; const base = { id: 0, url: '', alt: spec.alt || '', kind: spec.kind || 'image' }; if (/^https?:/.test(src)) out[k] = Object.assign(base, { url: src }); else if (src.startsWith('library:')) out[k] = Object.assign(base, { library: src.slice(8) }); else if (src.startsWith('assets/')) out[k] = Object.assign(base, { missing: src }); else if (spec.url) out[k] = Object.assign(base, { url: spec.url }); } return out; }
    function fromJson(o, name, depth) {
      depth = depth || 0; if (depth > 3) return []; if (Array.isArray(o)) return o.flatMap(x => fromJson(x, name, depth + 1)); if (!o || typeof o !== 'object') return [];
      if (o.content_html != null || (o.elementor_data && o.slug)) { const p = CMS.pageFromBundle(o); p.kind = 'bundle'; p.label = name; p.links = (((o.blueprint || {}).page || {}).internal_links) || []; p.words = CMS.words(p.html); return [p]; }
      if (o.page && Array.isArray(o.sections)) { if (typeof FORGE_COMPILE === 'undefined') throw new Error('the blueprint compiler is not loaded'); const r = FORGE_COMPILE.compile(o, {}); const p = CMS.pageFromForge(o, r, mediaFromBp(o), { label: name, kind: 'blueprint' }); p.checks = checksFromLint(r.lint || []); p.words = CMS.words(p.html); return [p]; }
      if (Array.isArray(o.pages)) return fromJson(o.pages, name, depth + 1); if (o.bundle && typeof o.bundle === 'object') return fromJson(o.bundle, name, depth + 1); if (o.blueprint && o.blueprint.page && Array.isArray(o.blueprint.sections)) return fromJson(o.blueprint, name, depth + 1);
      return [];
    }
    function fromHtmlDoc(text, name) {
      const doc = new DOMParser().parseFromString(text, 'text/html'); const stem = String(name || 'page').replace(/\.[^.]+$/, '');
      const title = ((doc.querySelector('title') || {}).textContent || '').trim() || stem; const meta = doc.querySelector('meta[name="description"]'); const desc = meta ? (meta.getAttribute('content') || '').trim() : '';
      const robots = doc.querySelector('meta[name="robots"]'); const noindex = !!(robots && /noindex/i.test(robots.getAttribute('content') || '')); const canon = doc.querySelector('link[rel="canonical"]'); const canonical = canon ? canon.getAttribute('href') || '' : ''; const lang = doc.documentElement.getAttribute('lang') || 'en-US';
      const ld = []; doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => { try { ld.push(JSON.parse(s.textContent)); } catch (e) { } });
      const css = [...doc.head.querySelectorAll('style')].map(s => s.textContent).join('\n').trim();
      doc.querySelectorAll('script,noscript').forEach(s => s.remove());
      const main = doc.querySelector('main') || doc.body; const html = (main ? main.innerHTML : '').trim(); if (!html) throw new Error('no body markup found');
      const h1 = main && main.querySelector('h1') ? main.querySelector('h1').textContent.trim() : title;
      const seg = canonical ? pathOf(canonical).split('/').filter(Boolean).pop() : ''; const schema = ld.length === 1 ? ld[0] : ld.length > 1 ? { '@context': 'https://schema.org', '@graph': ld.flatMap(x => Array.isArray(x['@graph']) ? x['@graph'] : [x]) } : null;
      const p = CMS.pageFromHtml({ title, h1, slug: seg || stem, meta_description: desc, summary: desc, language: lang, html, css: css || undefined, schema, noindex, canonical, links: linksOf(html) });
      p.kind = 'html'; p.label = name; p.words = CMS.words(html); return p;
    }
    async function importFiles(files) {
      const logEl = $('#p16iLog', root); const lines = []; let added = 0;
      for (const f of Array.from(files || [])) {
        try { const text = await f.text(); const name = f.name || 'file'; let pages;
          if (/\.json$/i.test(name) || /^\s*[\[{]/.test(text)) pages = fromJson(JSON.parse(text), name); else pages = [fromHtmlDoc(text, name)];
          pages = pages.filter(Boolean); if (!pages.length) throw new Error('nothing recognisable: expected a Site Forge bundle, a blueprint, an array of either, or an HTML document');
          added += addPages(pages, 'import'); lines.push(`${name}: ${pages.length} page${pages.length === 1 ? '' : 's'} (${pages.map(p => '/' + p.slug + '/').join(', ')})`); }
        catch (e) { lines.push(`${f.name}: ${e.message}`); }
      }
      st.ilog = (lines.length ? lines.map(l => `${hhmm()} ${l}`) : [`${hhmm()} no files`]).concat(st.ilog || []).slice(0, 12);
      logEl.hidden = false; logEl.textContent = st.ilog.join('\n'); toast(added ? `${added} page${added === 1 ? '' : 's'} imported` : 'Nothing imported');
    }
    const drop = $('#p16iDrop', root), file = $('#p16iFile', root);
    drop.onclick = () => file.click(); drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } };
    drop.ondragover = e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; }; drop.ondragleave = () => { drop.style.borderColor = ''; };
    drop.ondrop = e => { e.preventDefault(); drop.style.borderColor = ''; importFiles(e.dataTransfer.files); };
    file.onchange = e => { importFiles(e.target.files); e.target.value = ''; };
    /* ---------- deploy ---------- */
    function slog(msg, reset) { const line = `${hhmm()}  ${msg}`; st.log = reset ? [line] : st.log.concat(line).slice(-400); const h = $('#p16Status', root); h.textContent = st.log.join('\n'); h.scrollTop = h.scrollHeight; }
    function updateGo() { const b = $('#p16Go', root); const t = T(); const n = st.selected.size; if (st.running) return; if (!st.confirm.live) b.textContent = t ? `Deploy ${n} selected to ${t.name}` : 'Deploy'; const note = $('#p16GoNote', root); note.textContent = !t ? 'Choose a target first.' : !n ? 'Tick at least one page.' : $('#p16Live', root).checked ? 'Live: the button asks for a second click.' : 'As drafts.'; }
    async function deploy() {
      const ad = T(); if (!ad) { toast('Choose a target first'); return; }
      const pages = st.pages.filter(p => st.selected.has(p.slug)); if (!pages.length) { toast('Tick at least one page'); return; }
      if (CMS.status(ad.id).state === 'unconfigured') { toast(`${ad.name} is not configured: fill in its card and Save`); return; }
      const cardEl = $(`.conn[data-id="${ad.id}"]`, root); if (cardEl) await CMS.setCfg(ad.id, readFields(cardEl));   /* unsaved edits on the target card count */
      const live = $('#p16Live', root).checked; const b = $('#p16Go', root);
      if (live && !st.confirm.live) { st.confirm.live = true; b.textContent = `Click again to publish ${pages.length} live on ${ad.name}`; setTimeout(() => { if (st.confirm.live) { st.confirm.live = false; updateGo(); } }, 6000); return; }
      st.confirm.live = false;
      const notes = []; const mh = mediaHostFor(ad, notes); const onlyNew = $('#p16OnlyNew', root).checked, requireMedia = $('#p16ReqMedia', root).checked;
      st.ctl = new AbortController(); st.running = true; b.disabled = true; b.textContent = 'Deploying…'; $('#p16Stop', root).disabled = false; $('#p16SiteGo', root).hidden = true; st.results = []; renderResults();
      slog(`Deploying ${pages.length} page${pages.length === 1 ? '' : 's'} to ${ad.name} as ${live ? 'published' : 'drafts'}${onlyNew ? ', skipping pages already sent' : ''}${requireMedia ? ', every image required' : ''}${mh ? `, media through ${CMS.get(mh).name}` : ''}.`, true);
      notes.forEach(m => slog(m));
      if (!(ad.caps || {}).media && !mh && pages.some(hasLocal)) slog(`${ad.name} cannot host uploads and no media host is set: local photos will be reported as unresolved. Pick a media host above.`);
      try {
        await grant(ad); if (mh) await grant(CMS.get(mh));
        const res = await CMS.deploy(ad.id, pages, { publish: live, onlyNew, requireMedia, mediaHost: mh || undefined, log: m => slog(m), signal: st.ctl.signal });
        st.results = res; const ok = res.filter(r => r.ok && !r.skipped).length, sk = res.filter(r => r.skipped).length, bad = res.filter(r => !r.ok).length; const stopped = st.ctl.signal.aborted;
        slog(`Done: ${ok} sent, ${sk} skipped, ${bad} failed${stopped ? ' (stopped early)' : ''}.`); toast(`${ad.name}: ${ok} sent, ${bad} failed`);
        if ((ad.caps || {}).publishSite && typeof ad.publishSite === 'function' && ok) { $('#p16SiteGo', root).hidden = false; slog(`${ad.name} publishes at site level: click Publish site now when the pages look right.`); }
      } catch (e) { slog('ERROR ' + errText(e)); toast(e.message || String(e)); }
      finally { st.running = false; st.ctl = null; b.disabled = false; $('#p16Stop', root).disabled = true; renderResults(); renderPages(); renderLedger(); kpis(); pills(); updateGo(); }
    }
    function renderResults() {
      const host = $('#p16Results', root); if (!st.results.length) { host.innerHTML = ''; return; }
      host.innerHTML = `<table><thead><tr><th class="l">Page</th><th class="l">Status</th><th class="l">Link</th><th class="l">Edit</th><th class="l">Notes</th></tr></thead><tbody>${st.results.map(r => { const res = r.res || {}; const status = r.skipped ? 'skipped' : r.ok ? (res.status || 'sent') : 'error'; const cls = r.skipped ? 'st-unconfigured' : !r.ok ? 'st-expired' : status === 'publish' ? 'st-connected' : 'st-configured'; const notes = [r.error ? errText(r.error) : '', res.notes || '', ...(r.notes || [])].filter(Boolean).join(' · ');
        return `<tr><td class="l">${esc(r.page.title)}<div class="mini">/${esc(r.page.slug)}/</div></td><td class="l"><span class="pill ${cls}">${esc(status)}</span>${r.ok && !r.skipped ? `<div class="mini">${res.updated ? 'updated' : 'created'}</div>` : ''}</td><td class="l">${res.link ? `<a href="${esc(res.link)}" target="_blank" rel="noopener" title="${esc(res.link)}">${esc(shortUrl(res.link))}</a>` : '—'}</td><td class="l">${res.edit ? `<a href="${esc(res.edit)}" target="_blank" rel="noopener">edit</a>` : '—'}</td><td class="l pb-wrap mini" style="max-width:420px">${esc(notes) || '—'}</td></tr>`; }).join('')}</tbody></table>`;
    }
    async function publishSiteNow() {
      const ad = T(); const b = $('#p16SiteGo', root); if (!ad || typeof ad.publishSite !== 'function') { toast('The target has no site level publish'); return; }
      if (CMS.status(ad.id).state === 'unconfigured') { toast(`${ad.name} is not configured`); return; }
      b.disabled = true; try { await grant(ad); slog(`Publishing the site on ${ad.name}…`); const r = await ad.publishSite(CMS.cfg(ad.id), ctxFor()); slog((r && r.info) || 'Site published.'); toast(`${ad.name}: site published`); } catch (e) { slog('Site publish failed: ' + errText(e)); toast(e.message || String(e)); } finally { b.disabled = false; }
    }
    async function verifyLinks() {
      const ad = T(); if (!ad) { toast('Choose a target first'); return; } const b = $('#p16Verify', root);
      if (typeof ad.listUrls !== 'function') { slog(`${ad.name} cannot list its live URLs (no listUrls in the adapter); check the internal links by hand.`); return; }
      if (CMS.status(ad.id).state === 'unconfigured') { slog(`${ad.name} is not configured: fill in its card and Save before checking links.`); toast(`${ad.name} is not configured`); return; }
      const sel = st.pages.filter(p => st.selected.has(p.slug)); const use = sel.length ? sel : st.pages; if (!use.length) { toast('Load some pages first'); return; }
      b.disabled = true;
      try { await grant(ad); slog(`Reading the live URLs on ${ad.name}…`); const urls = await ad.listUrls(CMS.cfg(ad.id), ctxFor()); const live = new Set((urls || []).map(pathOf)); let tot = 0, bad = 0; const missing = [];
        use.forEach(p => (p.links || []).forEach(l => { if (!l || !l.url) return; tot++; if (!live.has(pathOf(l.url))) { bad++; if (missing.length < 15) missing.push(`/${p.slug}/ → ${l.url}`); } }));
        slog(`Live URLs on ${ad.name}: ${live.size}. Internal links on ${use.length} page${use.length === 1 ? '' : 's'}: ${tot}; not live: ${bad}.${missing.length ? '\n  ' + missing.join('\n  ') + (bad > missing.length ? `\n  … and ${bad - missing.length} more` : '') : ''}${bad ? '\nPublish the missing pages first, or refresh the live list in the Site Forge and rebuild so the links only point at live pages.' : ''}`);
        toast(bad ? `${bad} link${bad === 1 ? '' : 's'} not live` : 'Every internal link is live'); }
      catch (e) { slog('Link check failed: ' + errText(e)); toast(e.message || String(e)); } finally { b.disabled = false; }
    }
    /* ---------- ledger ---------- */
    const ledgerRows = id => Object.entries(CMS.deployedFor(id)).map(([slug, r]) => Object.assign({ slug }, r || {})).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    function renderLedger() {
      const host = $('#p16LedgerT', root); const t = T(); if (!t) { host.innerHTML = '<p class="mini pb-empty">Choose a target to see what was sent to it.</p>'; return; }
      const rows = ledgerRows(t.id); if (!rows.length) { host.innerHTML = `<p class="mini pb-empty">Nothing sent to ${esc(t.name)} yet.</p>`; return; }
      host.innerHTML = `<table><thead><tr><th class="l">Slug</th><th class="l">Title</th><th class="l">Status</th><th class="l">Link</th><th class="l">Time</th><th class="l">Notes</th></tr></thead><tbody>${rows.map(r => `<tr><td class="l"><code class="mono">/${esc(r.slug)}/</code></td><td class="l pb-wrap" style="max-width:280px">${esc(r.title || '')}</td><td class="l"><span class="pill ${r.ok === false ? 'st-expired' : r.status === 'publish' ? 'st-connected' : 'st-configured'}">${esc(r.ok === false ? 'error' : (r.status || 'draft'))}</span>${r.updated ? '<div class="mini">updated</div>' : ''}</td><td class="l">${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener" title="${esc(r.link)}">${esc(shortUrl(r.link))}</a>` : '—'}${r.edit ? ` · <a href="${esc(r.edit)}" target="_blank" rel="noopener">edit</a>` : ''}</td><td class="l mini">${esc(when(r.at))}</td><td class="l pb-wrap mini" style="max-width:360px">${esc([r.error || '', r.notes || ''].filter(Boolean).join(' · ')) || '—'}</td></tr>`).join('')}</tbody></table>`;
    }
    function ledgerCSV(ids) { const header = ['target', 'slug', 'title', 'status', 'ok', 'link', 'edit', 'id', 'time', 'notes', 'error']; const rows = []; ids.forEach(id => ledgerRows(id).forEach(r => rows.push([CMS.get(id) ? CMS.get(id).name : id, r.slug, r.title || '', r.ok === false ? 'error' : (r.status || ''), r.ok === false ? 'no' : 'yes', r.link || '', r.edit || '', r.id == null ? '' : r.id, r.at || '', r.notes || '', r.error || '']))); return toCSV(header, rows, `Publish ledger, ${ids.length} target${ids.length === 1 ? '' : 's'}, exported ${new Date().toISOString()}`); }
    /* ---------- method, judgment, sources ---------- */
    $('#p16Meth', root).innerHTML = [
      '<b>One portable page.</b> Whatever wrote it, a page arrives here as title, slug, meta description, language, section markup with a scoped forge stylesheet, a JSON-LD graph, media slots and internal links. The Site Forge hands its pages over with the photos assigned in step 7; the composer and the import build the same shape.',
      '<b>One adapter per platform.</b> WordPress gets the compiled Elementor JSON through the FORGE bridge (and SEO fields, JSON-LD in the head); the headless route stores the blueprint on the same site and points the canonical at the Next.js front end. Everyone else receives HTML with the scoped css inline, JSON-LD in the head where the platform has a head slot (WordPress, Ghost, HubSpot) and inline in the body otherwise (Drupal, Joomla, Shopify, Duda); Wix and Webflow keep it in a text field of the item when one is configured.',
      '<b>Slug first.</b> Before writing, every adapter looks the slug up in its own model (WordPress slug, Drupal path alias, Shopify handle, Webflow item slug, Ghost slug, Joomla alias, HubSpot slug, Wix item field, Duda page path) and updates what it finds; otherwise it creates. The ledger records id, link, edit link and status per target so a second run is an update, and Skip pages already sent reads it.',
      '<b>Media before markup.</b> A local photo (a file dropped in the Site Forge, or a data URL) is uploaded through the target, or through the media host when the target cannot hold files (Duda, the Wix blog). A library slot is searched by name on the target. The URLs are rewritten in the markup, the JSON-LD and the og:image; a slot that stays unresolved is dropped, or stops the run when Require every image is on.',
      '<b>Drafts by default.</b> Nothing goes live unless Publish live is ticked and confirmed with a second click. Site builders that publish at site level (Duda, Webflow) get a separate Publish site now step after the run.',
      '<b>Site access.</b> Inside the browser app the extension asks once for permission to reach each of your own sites (WordPress, Drupal, Joomla, Ghost) on the first Test or Deploy; the hosted platform APIs are permitted in the manifest. Credentials live in extension storage and never leave this machine.',
    ].map(x => `<li>${x}</li>`).join('');
    $('#p16Judg', root).innerHTML = judgList([
      ['Site builders take content, not pages', 'Wix, Webflow and Duda have no endpoint that takes an arbitrary HTML page. Wix data items feed a dynamic page you design once; Webflow items render through a collection template page; Duda injects the markup into a template page you build with a data-inject element. That is where the platform keeps its own header, footer and navigation, so the pages look native.'],
      ['Wix and Webflow strip scripts', 'Rich text fields keep headings, paragraphs, lists, links and images and drop scripts and embeds. The JSON-LD goes into a plain text field when the collection has one, otherwise it is left out and the result says so.'],
      ['Duda content injection is marked deprecated', 'Duda\'s developer docs now steer new work to the snippets API, connected data and the content library while keeping content injection available. The adapter uses injection because it is the only route that takes a whole page; watch the result notes and switch modes if Duda removes it.'],
      ['Shopify pages are Online Store pages', 'The adapter creates Online Store pages (or blog articles when a blog id is set); a page renders inside the theme\'s page template, so a template suffix is the way to give these pages their own layout.'],
      ['HubSpot blog posts are the reliable route', 'Site pages on HubSpot depend on a template the account owns; blog posts take HTML and metadata directly, so the adapter defaults to posts and offers pages as an option.'],
      ['Credentials in extension storage', 'Application passwords, API keys and tokens are stored in this browser profile so the next session can publish without retyping. Forget credentials on each card removes them; anyone with this profile can read them until then.'],
      ['Publishing live is your call', 'The atlas can lint, preview and send, but it cannot read the site\'s navigation, redirects or launch calendar. Drafts are the default; the second click on Publish live is the point where a person takes over.'],
      ['Pages are not saved between sessions', 'A loaded page carries photo blobs and can be large, so the module keeps only the slugs it saw. Load again from the Site Forge or the file; the ledger, the credentials and the composer draft do persist.'],
    ]);
    /* the version the Shopify adapter pins (it exposes version()); the literal is the fallback when the adapter is not loaded */
    const shopifyVersion = () => { const a = CMS.get('shopify'); try { return (a && typeof a.version === 'function' && a.version()) || '2026-07'; } catch (e) { return '2026-07'; } };
    const SRC = [
      ['WordPress REST API, authentication', 'Application Passwords over Basic auth (WordPress 5.6+)', 'A', 'wp/v2', 'https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/'],
      ['Elementor developers, library import', 'The template JSON format the FORGE bridge writes', 'B', '', 'https://developers.elementor.com/docs/cli/library-import'],
      ['Drupal JSON:API module', 'Creating resources (POST), core in Drupal 10 and 11', 'A', 'JSON:API 1.0', 'https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/creating-new-resources-post'],
      ['Wix REST, Data Items API', 'Insert and save data items in a CMS collection', 'A', 'v2', 'https://dev.wix.com/docs/rest/business-solutions/cms/data-items/insert-data-item'],
      ['Duda API, content injection', 'Inject innerHTML into a data-inject element (marked deprecated in favour of snippets)', 'B', '', 'https://developer.duda.co/docs/content-injection-1'],
      ['Webflow Data API, collection items', 'Create staged items; drafts by default since December 2024', 'A', 'v2', 'https://developers.webflow.com/data/reference/cms/collection-items/staged-items/create-items'],
      ['Shopify GraphQL Admin API', 'pageCreate and pageUpdate; write_content or write_online_store_pages', 'A', shopifyVersion(), 'https://shopify.dev/docs/api/admin-graphql/latest/mutations/pageCreate'],
      ['HubSpot CMS API, blog posts', 'Create, update and publish posts with a private app token', 'A', 'v3', 'https://developers.hubspot.com/docs/api-reference/cms-posts-v3/basic/get-cms-v3-blogs-posts'],
      ['Joomla Web Services', 'api/index.php/v1/content/articles with a user API token', 'A', 'v1', 'https://manual.joomla.org/docs/general-concepts/webservices/'],
      ['Ghost Admin API', 'Pages and posts with a short lived JWT signed from the integration key', 'A', 'v5', 'https://docs.ghost.org/admin-api'],
      ['Chrome extensions, permissions API', 'optional_host_permissions and permissions.request at runtime', 'A', 'MV3', 'https://developer.chrome.com/docs/extensions/reference/api/permissions'],
    ];
    function renderSources() { const extra = A().filter(a => a.docs && !SRC.some(s => s[4] === a.docs)).map(a => [`${a.name} adapter docs`, a.blurb || '', 'A', '', a.docs]); $('#p16Src', root).innerHTML = srcRows(SRC.concat(extra)); }
    /* ---------- wiring ---------- */
    wireSeg($('#p16Tabs', root), v => { st.tab = v; ['Forge', 'Composer', 'Import'].forEach(k => { $('#p16Pane' + k, root).hidden = k.toLowerCase() !== v; }); });
    $('#p16fLoad', root).onclick = loadForge;
    $('#p16SelAll', root).onclick = () => selectWhere(() => true);
    $('#p16SelNone', root).onclick = () => selectWhere(() => false);
    $('#p16SelUnsent', root).onclick = () => { const led = T() ? CMS.deployedFor(T().id) : {}; selectWhere(p => !(led[p.slug] && led[p.slug].ok !== false && led[p.slug].id)); };
    $('#p16ClearPages', root).onclick = () => { if (!st.pages.length) return; if (!armed($('#p16ClearPages', root), 'pages:clear', 'Remove all')) return; st.pages = []; st.selected.clear(); closePreview(); persistLoaded(); renderPages(); kpis(); updateGo(); toast('List cleared'); };
    $('#p16Target', root).onchange = e => setTarget(e.target.value);
    $('#p16Media', root).onchange = e => { CMS.setSettings({ mediaHost: e.target.value }); toast(e.target.value ? `Media host: ${CMS.get(e.target.value).name}` : 'Media host: the target itself'); };
    $('#p16Go', root).onclick = deploy;
    $('#p16Stop', root).onclick = () => { if (st.ctl) { st.ctl.abort(); slog('Stop requested; the page in flight finishes, the rest are left.'); $('#p16Stop', root).disabled = true; } };
    $('#p16Verify', root).onclick = verifyLinks;
    $('#p16SiteGo', root).onclick = publishSiteNow;
    $('#p16Live', root).onchange = () => { st.confirm.live = false; updateGo(); };
    $('#p16LedCsv', root).onclick = () => { const t = T(); if (!t) { toast('Choose a target first'); return; } saveFile(`publish-ledger_${t.id}.csv`, ledgerCSV([t.id])); };
    $('#p16Bridge', root).onclick = bridgeZip;
    $('#p16Kit', root).onclick = kitZip;
    $('#p16Ledger', root).onclick = () => { const ids = A().map(a => a.id).filter(id => Object.keys(CMS.deployedFor(id)).length); if (!ids.length) { toast('Nothing in the ledger yet'); return; } saveFile('publish-ledger.csv', ledgerCSV(ids)); };
    $('#p16Forge', root).onclick = () => goModule('forge');
    /* ---------- hooks ---------- */
    this.receive = p => { if (!p) return; if (Array.isArray(p.pages) && p.pages.length) { const n = addPages(p.pages, p.source || 'handoff'); toast(`${n} page${n === 1 ? '' : 's'} received`); } if (p.target && CMS.get(p.target)) setTarget(p.target); };
    this.onShow = () => { pills(); kpis(); };
    this.pages = () => st.pages.slice();
    /* ---------- boot ---------- */
    function renderAll() { env(); renderTargets(); renderPages(); renderLedger(); renderSources(); kpis(); updateGo(); cCount(); }
    renderAll();
    CMS.ready().then(() => { const S = CMS.settings(); st.target = S.target && CMS.get(S.target) ? S.target : ''; renderAll(); }).catch(e => { console.error(e); toast('CMS storage did not load: ' + e.message); });
  }
});
