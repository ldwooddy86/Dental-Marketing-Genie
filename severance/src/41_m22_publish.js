'use strict';
/* Module 22: Publish. A port of the Thermal Atlas module 16 for one Texas family law firm.
   Codes only against the CMS contract in src/cms/00_cms_core.js: every registered adapter gets a card built from its fields; the pages
   come from the Site Forge (module 21, mounted silently when needed), the composer or an imported file; CMS.deploy does the work and keeps
   the ledger (sv.cms.v1). Severance adds the compliance screen: before a deploy every page goes through LINT.screen(html, {kind:'page',
   html:true}) and a page with a blocking finding is held back unless the user ticks Send anyway for that page; the results table and the
   ledger carry the screen status. The composer prefills from FIRM (name, phone, responsible lawyer, primary office in a disclaimer block,
   a LegalService JSON-LD). Renders with zero adapters, with module 21 absent or failing, and in every environment (extension, file, viewer).
   Public hooks on MODI.publish: receive({pages, source, target}), onShow(), pages(), screen(slug), sent(target, slug), arc(). Nothing runs
   at load time beyond registerModule; every id carries the pb prefix.
   Law firm gates on top of the Thermal Atlas flow:
     Publish live needs the box "Reviewed and approved by <FIRM.responsible().name>" ticked; the name and the time go into the ledger record
       of every page published live (approvedBy, approvedAt, approvals[]), with firstLiveAt kept across updates. The box clears after each run.
     The homepage and campaign landing pages are flagged for the Advertising Review Committee (Rule 7.04: within ten days of first
       dissemination, unless exempt under Rule 7.05). Every live publish of a new version writes a row into the Compliance Screen's filing
       log (store 'sev.comp.arc', the module 11 row shape {id, what, where, pub, filed, no, status, note}) and emits BUS 'arc'; the index of
       what was logged is 'sev.publish.arc'; severance-arc-filing.csv lists it.
     The exact page each adapter received (after media and placeholder rewriting) is kept as a standalone HTML document per send, in
       IndexedDB 'sev-publish-sent' (metadata in 'sev.publish.sent'), and downloads per ledger row for the firm's advertising records.
     Credentials: each card has "Remember credentials on this computer". Off (the default when the page is opened from disk or in the
       viewer) keeps the card's settings out of sv.cms.v1: in memory and in this tab's sessionStorage, with the non secret fields (site
       address, user name) remembered in 'sev.publish.keep'. In a page opened from disk each card says which routes can be called from there. */
registerModule({
  key: 'publish', num: '22', title: 'Publish',
  desc: 'Send the pages the Site Forge wrote, or your own, to WordPress (Elementor or headless), Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla or Ghost, screened against the Texas advertising rules first',
  mount(root) {
    const self = this;
    if (typeof CMS === 'undefined') {
      root.innerHTML = mastHTML({ eyebrow: 'Module 22 · Publish · every CMS the firm site can live on', title: 'Publish', dek: 'The CMS layer did not load, so there is nothing to publish with.', facts: [] }) + callout('judg', 'The CMS layer is not loaded', 'src/cms/00_cms_core.js and the adapters load before this module in app.html. Reload the app; if this stays, run node tools/order.mjs and node build.mjs --check.');
      return;
    }
    const st = { pages: [], selected: new Set(), override: new Set(), scr: new Map(), target: '', previewSlug: null, screenSlug: null, confirm: {}, ctl: null, results: [], log: [], running: false, tab: 'forge', ilog: [] };
    const A = () => CMS.list();
    const T = () => (st.target && CMS.get(st.target)) || null;
    const hhmm = () => new Date().toLocaleTimeString();
    const when = iso => { if (!iso) return 'n/a'; const d = new Date(iso); return isNaN(d) ? String(iso) : `${dateOf(d)}, ${d.toLocaleTimeString()}`; };
    const shortUrl = u => { try { const x = new URL(u); return x.host + (x.pathname.length > 1 ? x.pathname : '') + (x.search || ''); } catch (e) { return String(u || ''); } };
    const pathOf = u => { try { return new URL(u, 'https://x.invalid').pathname.replace(/\/?$/, '/').toLowerCase(); } catch (e) { return String(u || ''); } };
    const wordsOf = p => isN(p.words) ? +p.words : CMS.words(p.html);
    const mediaOf = p => { const slots = Object.values(p.media || {}).filter(Boolean); return { n: slots.length, bad: slots.filter(m => !m.url && !m.asset && (m.library || m.missing)).length }; };
    const hasLocal = p => Object.values(p.media || {}).some(m => m && (m.asset || /^data:(?!image\/svg\+xml)/.test(m.url || '')));
    const plural = (n, w, ws) => `${N(n)} ${n === 1 ? w : (ws || w + 's')}`;
    /* the shared CMS adapters were written for the Thermal Atlas and name its module numbers in their steps and hints */
    const modFix = s => String(s == null ? '' : s).replace(/\b([Mm])odule 16\b/g, '$1odule 22').replace(/\b([Mm])odule 09\b/g, '$1odule 21');
    const blockedEnv = ENV === 'file' || ENV === 'viewer';
    const errText = e => { let s = (e && (e.message || String(e))) + (e && e.hint ? ' · ' + e.hint : ''); if (e && e.network && blockedEnv) s += ENV === 'viewer' ? ' · the hosted viewer blocks calls to other sites; download the pages pack or use the Severance extension' : ' · the browser blocked the call: a page opened from disk only reaches a CMS that allows this origin (CORS); use the Severance extension, or download the pages pack'; return modFix(s); };
    const isHome = p => /^(home|homepage|index|inicio)$/.test(String(p.slug || '')) || /^home/i.test(String(p.kind || ''));
    const isLanding = p => /^landing/i.test(String(p.kind || '')) || /^lp-/.test(String(p.slug || '')) || /^(spanish )?landing\b/i.test(String(p.label || ''));
    const arcKind = p => isHome(p) ? 'home' : isLanding(p) ? 'landing' : 'page';
    const ARC_DAYS = () => (typeof LINT !== 'undefined' && LINT.FILING && LINT.FILING.days) || 10;
    const ymdOf = d => isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const localDay = iso => ymdOf(iso ? new Date(iso) : new Date());
    const plusDays = (ymd, n) => { const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? ymdOf(new Date(+m[1], +m[2] - 1, +m[3] + n)) : ''; };
    const respName = () => { try { return String((FIRM.responsible() || {}).name || '').trim(); } catch (e) { return ''; } };

    /* ---------- the firm, as the starter, the disclaimer and the JSON-LD use it ---------- */
    function firmInfo() {
      const f = FIRM.get(), r = FIRM.responsible(), p = FIRM.primary();
      return { name: f.name || '[Firm name]', phone: FIRM.phone() || '[Phone]', tel: String(f.phone || p.phone || '').replace(/[^\d+]/g, ''), atty: r.name || '[Responsible attorney]', bar: r.bar_no || '', city: p.city || '[Office city]', street: p.street || '', zip: p.zip || '', url: String(f.url || '').trim().replace(/\/+$/, ''), virtual: !!(f.consult || {}).virtual, certs: FIRM.certs(), missing: FIRM.missing().filter(x => x !== 'website'), raw: f, office: p, lawyer: r };
    }
    const addrOf = F => [F.street, F.city].filter(Boolean).join(', ') + ', Texas' + (F.zip ? ' ' + F.zip : '');
    function disclaimerHtml(lang) {
      const F = firmInfo(); const e = esc; const es = /^es/i.test(lang || '');
      const body = es
        ? `${e(F.name)} ofrece esta página como información general sobre el derecho de familia en Texas. No es asesoría legal para ninguna situación en particular, y leerla no crea una relación entre abogado y cliente. Abogado responsable: ${e(F.atty)}${F.bar ? `, Colegio de Abogados de Texas (State Bar of Texas) n.º ${e(F.bar)}` : ''}. Oficina principal: ${e(addrOf(F))}. Teléfono: ${e(F.phone)}.`
        : `${e(F.name)} provides this page as general information about Texas family law. It is not legal advice for any particular situation, and reading it does not create an attorney client relationship. Responsible attorney: ${e(F.atty)}${F.bar ? `, State Bar of Texas No. ${e(F.bar)}` : ''}. Primary practice location: ${e(addrOf(F))}. Phone: ${e(F.phone)}.`;
      return `<section id="disclaimer" class="forge-section forge-disclaimer"><div class="forge-inner forge-narrow"><p><small>${body}</small></p>${F.certs.length ? `<p><small>${F.certs.map(e).join('<br>')}</small></p>` : ''}</div></section>`;
    }
    function starter(title, lang) {
      const F = firmInfo(); const e = esc; const es = /^es/i.test(lang || ''); const t = title || (es ? 'Título de la página' : 'Page title');
      const call = `<a class="forge-btn forge-btn-primary" href="${F.tel ? 'tel:' + e(F.tel) : '#contact'}">${es ? 'Llame al' : 'Call'} ${e(F.phone)}</a> <a class="forge-btn forge-btn-secondary" href="#contact">${es ? 'Programe una consulta' : 'Schedule a consultation'}</a>`;
      const S = es ? {
        lede: 'Diga en una oración para quién es esta página y qué cubre la primera consulta.', ans: 'La respuesta corta', ansT: 'Responda en dos o tres oraciones sencillas la pregunta que motiva esta página. Cite la sección del Código de Familia de Texas cuando corresponda.',
        det: 'Qué esperar', detT: 'Explique qué pasa en la primera reunión, qué documentos traer y cómo cobra la firma por este tipo de asunto.', pts: ['Primer punto.', 'Segundo punto.', 'Tercer punto.'],
        faq: 'Preguntas frecuentes', q: ['¿Primera pregunta?', '¿Segunda pregunta?'], a: 'La respuesta.', talk: 'Hable con', callT: `Llame al ${e(F.phone)} para programar una consulta${F.virtual ? ', en persona o por video' : ''}. La oficina está en ${e(F.city)}, Texas.`
      } : {
        lede: 'Say in one sentence who this page is for and what the first consultation covers.', ans: 'The short answer', ansT: 'Answer the question this page exists for in two or three plain sentences. Cite the Texas Family Code section when one applies.',
        det: 'What to expect', detT: 'Say what happens at the first meeting, what to bring, and how the firm bills for this kind of matter.', pts: ['First point.', 'Second point.', 'Third point.'],
        faq: 'Frequently asked questions', q: ['First question?', 'Second question?'], a: 'The answer.', talk: 'Talk to', callT: `Call ${e(F.phone)} to schedule a consultation${F.virtual ? ', in person or by video' : ''}. The office is in ${e(F.city)}, Texas.`
      };
      return [
        `<section id="hero" class="forge-section forge-sec-hero forge-light"><div class="forge-inner"><p class="forge-eyebrow">${e(F.name)}</p><h1>${e(t)}</h1><p class="forge-lede">${S.lede}</p><p class="forge-ctas">${call}</p></div></section>`,
        `<section id="answer" class="forge-section forge-tint"><div class="forge-inner forge-narrow"><h2>${S.ans}</h2><p class="forge-answer">${S.ansT}</p></div></section>`,
        `<section id="detail" class="forge-section"><div class="forge-inner forge-narrow"><h2>${S.det}</h2><p>${S.detT}</p><ul>${S.pts.map(x => `<li>${x}</li>`).join('')}</ul></div></section>`,
        `<section id="faq" class="forge-section forge-tint"><div class="forge-inner forge-narrow"><h2>${S.faq}</h2>${S.q.map(q => `<details class="forge-faq"><summary><h3>${q}</h3></summary><p>${S.a}</p></details>`).join('')}</div></section>`,
        `<section id="contact" class="forge-section forge-brand"><div class="forge-inner forge-narrow"><h2>${S.talk} ${e(F.name)}</h2><p>${S.callT}</p></div></section>`,
        disclaimerHtml(lang)].join('\n');
    }
    /* LegalService for the firm (with the responsible lawyer as an employee) and the WebPage that is about it */
    function firmSchema(title, meta, lang, pageSlug) {
      const F = firmInfo(); const f = F.raw; const id = (F.url ? F.url + '/' : '') + '#firm';
      const d10 = F.tel.replace(/\D/g, ''); const tel = d10.length === 10 ? '+1' + d10 : d10.length === 11 && d10[0] === '1' ? '+' + d10 : (F.tel || undefined);
      const lines = (typeof LINE_META !== 'undefined' ? FIRM.lines().map(k => LINE_META[k] && LINE_META[k].name).filter(Boolean) : []);
      const social = Object.values(f.social || {}).map(s => String(s || '').trim()).filter(s => /^https?:\/\//.test(s));
      const firm = { '@type': 'LegalService', '@id': id, name: F.name, legalName: f.legal_name || undefined, url: F.url || undefined, telephone: tel,
        address: { '@type': 'PostalAddress', streetAddress: F.street || undefined, addressLocality: F.city, postalCode: F.zip || undefined, addressRegion: 'TX', addressCountry: 'US' },
        areaServed: FIRM.counties().map(fp => ({ '@type': 'AdministrativeArea', name: `${cname(fp)} County, Texas` })), knowsAbout: lines.length ? lines : undefined, sameAs: social.length ? social : undefined,
        employee: F.lawyer.name ? [{ '@type': 'Person', name: F.lawyer.name, jobTitle: 'Attorney', worksFor: { '@id': id } }] : undefined };
      const page = { '@type': 'WebPage', name: title || undefined, description: meta || undefined, inLanguage: lang || 'en-US', url: F.url && pageSlug ? `${F.url}/${pageSlug}/` : undefined, about: { '@id': id }, publisher: { '@id': id } };
      return JSON.parse(JSON.stringify({ '@context': 'https://schema.org', '@graph': [firm, page] }));
    }

    /* ---------- the compliance screen ---------- */
    const screenHtml = p => `<h1>${esc(p.title || '')}</h1><p>${esc(p.meta_description || '')}</p>\n` + String(p.html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    const failScreen = (id, title, why) => ({ findings: [{ id, sev: 'block', title, rule: 'Publish', why, hit: '', at: -1, fix: null }], counts: { block: 1, fix: 0, warn: 0, info: 0 }, pass: false });
    function screenPage(p) {
      let r;
      if (typeof LINT === 'undefined' || typeof LINT.screen !== 'function') r = failScreen('nolint', 'Compliance engine not loaded', 'src/03_lint.js did not load, so the page could not be screened. It is held back until the engine loads, or until you tick Send anyway.');
      else { try { r = LINT.screen(screenHtml(p), { kind: 'page', html: true, homepage: isHome(p), lang: /^es/i.test(p.language || '') ? 'es' : 'en' }); } catch (e) { r = failScreen('linterr', 'The screen failed on this page', e.message); } }
      r = Object.assign({ at: new Date().toISOString() }, r); r.findings = r.findings || []; r.counts = Object.assign({ block: 0, fix: 0, warn: 0, info: 0 }, r.counts || {}); r.pass = !r.counts.block;
      st.scr.set(p.slug, r); return r;
    }
    const scrOf = p => st.scr.get(p.slug) || screenPage(p);
    const heldBy = p => !scrOf(p).pass && !st.override.has(p.slug);
    const extraOf = c => [c.fix ? `${c.fix} fix` : '', c.warn ? `${c.warn} review` : '', c.info ? `${c.info} note` : ''].filter(Boolean).join(', ');
    const lintLabel = (r, ovr) => !r ? 'not screened' : r.counts.block ? (ovr ? `override, ${r.counts.block} block` : `held, ${r.counts.block} block`) : extraOf({ fix: r.counts.fix, warn: r.counts.warn }) ? `clear, ${extraOf({ fix: r.counts.fix, warn: r.counts.warn })}` : 'clear';
    const lintPill = (r, ovr) => !r ? pill('not screened') : r.counts.block ? pill(ovr ? 'override' : `${r.counts.block} block`, ovr ? 'p-fix' : 'p-block') : pill('clear', 'p-ok');

    root.innerHTML = mastHTML({
      eyebrow: 'Module 22 · Publish · every CMS the firm site can live on', title: 'Publish',
      dek: 'The Site Forge writes the pages; this module sends them. One portable page goes to whichever platform the firm\'s site lives on: WordPress with Elementor or as a headless CMS behind the Next.js kit, Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla or Ghost. Each target is a card built from what that platform needs. Every page is screened against the Texas advertising rules before it leaves, lands as a draft unless you say otherwise, and is written into a ledger so a second run updates instead of duplicating.',
      facts: [[N(A().length), 'publishing targets loaded'], ['Drafts', 'by default; live takes the responsible lawyer\'s approval and a second click'], ['Rule 7.02(a)', 'every page names the responsible lawyer and the primary office'], ['sv.cms.v1', 'credentials and the ledger stay in this browser']]
    }) + toolbarHTML('Publish', 'Targets, pages, screen, deploy, ledger', [
      { id: 'pbPack', label: '↓ Pages pack', title: 'Every page as a standalone HTML file, the paste in body, the portable JSON and the screen results, in one zip' },
      { id: 'pbBridge', label: '↓ Bridge plugin', title: 'forge-bridge.zip: the WordPress plugin that writes Elementor data, SEO fields and JSON-LD' },
      { id: 'pbKit', label: '↓ Next.js kit', title: 'The Next.js front end for headless WordPress' },
      { id: 'pbLedger', label: '↓ Ledger CSV', title: 'Everything sent, every target' },
      { id: 'pbForge', label: 'Site Forge ↗', primary: true }]) + `
    <div id="pbEnv"></div>
    <div class="callout"><div class="h">Read this first: what Publish does and does not do</div><p>It sends the pages you approve to the CMS the firm's site runs on, as drafts unless you choose otherwise, after screening each one with the compliance engine (the same rule set as module 11: Texas Disciplinary Rules of Professional Conduct 7.01 to 7.06, the family law myths, stale numbers, unfilled placeholders and the house style). A page with a blocking finding stays here unless you tick <b>Send anyway</b> for that page, and the ledger records the override.</p><p>Nothing goes live until the box <b>Reviewed and approved by</b> the responsible lawyer named in the firm profile is ticked; the name and the time are written into the ledger with each page. The homepage and campaign landing pages are flagged for the Advertising Review Committee with the due date (Rule 7.04: within ten days of first dissemination, unless exempt under Rule 7.05), every live page is written into the Compliance Screen's filing log, and the exact HTML each platform received is kept for the firm's advertising records.</p><p>It does not write the pages (module 21 and the composer do), cannot judge whether a statement is true for this firm, does not file anything with the Committee itself, and does not touch the site's navigation, redirects or theme.</p></div>
    <div id="pbFirm"></div>
    <div class="tiles pb-tiles" id="pbTiles"></div>

    <div class="panel pb-panel"><h3>Where to publish</h3><div class="sub">One card per platform, built from what that platform needs. Save keeps the fields in this browser, Test reads the site and reports what it found, Use as target picks where the pages go. Credentials never leave this machine.</div>
      <div class="controls pb-ctls"><div class="ctl"><label for="pbTarget">Target</label><select id="pbTarget"></select></div><div class="ctl pb-mh"><label for="pbMedia">Media host</label><select id="pbMedia"></select><span class="hint">Where local photos are uploaded. Duda and the Wix blog cannot host uploads: pick WordPress, Shopify, Webflow, Ghost or HubSpot for them.</span></div></div>
      <div id="pbTargets"></div></div>

    <div class="panel pb-panel"><h3>What to publish</h3><div class="sub">Pages come from the Site Forge, from the composer below, or from a file. Each one is a portable page: title, slug, meta description, section markup with its css, JSON-LD, media slots. Tick the ones to send; each is screened the moment it lands here and again before a deploy.</div>
      ${segHTML('pbTabs', [['forge', 'Site Forge'], ['composer', 'Composer'], ['import', 'Import']], 'forge')}
      <div class="pb-pane" id="pbPaneForge">
        <div class="btnrow"><button type="button" class="btn accent" id="pbfLoad">Load pages from the Site Forge</button><span class="small" id="pbfNote"></span></div>
        <div class="small" id="pbfSite"></div><div id="pbfWarn"></div></div>
      <div class="pb-pane" id="pbPaneComposer" hidden>
        <div class="pb-firmline" id="pbcFirm"></div>
        <div class="formgrid pb-comp">
          <div class="ctl"><label for="pbcTitle">Title <span class="pb-count" id="pbcTitleN"></span></label><input type="text" id="pbcTitle" autocomplete="off"></div>
          <div class="ctl"><label for="pbcSlug">Slug</label><input type="text" id="pbcSlug" autocomplete="off" spellcheck="false"><span class="hint">Follows the title until you edit it.</span></div>
          <div class="ctl"><label for="pbcLang">Language</label><select id="pbcLang"><option value="en-US">English (en-US)</option><option value="es-US">Spanish (es-US)</option><option value="es-MX">Spanish (es-MX)</option></select><span class="hint">The starter template follows it.</span></div>
          <div class="ctl"><label for="pbcType">Post type</label><select id="pbcType"><option value="page">Page</option><option value="post">Post</option></select></div>
          <div class="ctl wide"><label for="pbcMeta">Meta description <span class="pb-count" id="pbcMetaN"></span></label><input type="text" id="pbcMeta" autocomplete="off"><span class="hint">70 to 155 characters reads well in search results.</span></div>
          <div class="pb-opts"><span class="pb-lab">Options</span><label class="chk"><input type="checkbox" id="pbcNoindex"> noindex</label><label class="chk"><input type="checkbox" id="pbcClean" checked> House style on the title and description (no dashes)</label></div>
          <div class="ctl wide"><label for="pbcHtml">HTML body <span class="pb-count" id="pbcHtmlN"></span></label><textarea id="pbcHtml" class="pb-code" spellcheck="false" placeholder="Section markup only: no html, head or body wrapper. The starter template gives you the forge skeleton with the firm's disclaimer block."></textarea><span class="hint">Scripts and inline event handlers are dropped. The forge css classes (<code>forge-section</code>, <code>forge-inner</code>, <code>forge-lede</code>, <code>forge-answer</code>, <code>forge-faq</code>) are styled on every target. Rule 7.02(a): keep the disclaimer block with the responsible lawyer and the primary office.</span></div>
          <div class="ctl wide"><label for="pbcSchema">JSON-LD <span class="pb-opt">optional</span> <span class="pb-count" id="pbcSchemaN"></span></label><textarea id="pbcSchema" class="pb-code pb-code-s" spellcheck="false" placeholder='{"@context":"https://schema.org","@type":"LegalService","name":"..."}'></textarea></div>
        </div>
        <div class="btnrow"><button type="button" class="btn primary" id="pbcAdd">Add to the list</button><button type="button" class="btn" id="pbcTmpl">Insert the starter template</button><button type="button" class="btn" id="pbcLd">Firm JSON-LD</button><button type="button" class="btn" id="pbcDisc">Append the firm disclaimer</button><button type="button" class="btn danger" id="pbcClear">Clear the draft</button><span class="small">The draft is kept in this browser until you clear it.</span></div></div>
      <div class="pb-pane" id="pbPaneImport" hidden>
        <div class="dropzone pb-drop" id="pbiDrop"><button type="button" class="btn" id="pbiPick">Choose files</button> <span>or drop .json or .html files here</span><input type="file" id="pbiFile" multiple accept=".json,.html,.htm,application/json,text/html" hidden aria-label="Files to import"></div>
        <p class="small pb-gap">Accepted: a Site Forge bundle (.bundle.json), a blueprint (.blueprint.json, compiled here), a JSON array of either, or a complete HTML document (the title, the meta description, the main or body markup and any JSON-LD are read).</p>
        <div class="logbox" id="pbiLog" hidden></div></div>
      <h4 class="fh">Pages loaded</h4>
      <div class="btnrow"><button type="button" class="btn sm" id="pbSelAll">Select all</button><button type="button" class="btn sm" id="pbSelNone">None</button><button type="button" class="btn sm" id="pbSelUnsent">Only unsent</button><button type="button" class="btn sm" id="pbSelClear">Only clear</button><span class="small" id="pbSelN"></span><span class="pb-sp"></span><button type="button" class="btn sm danger" id="pbClearPages">Remove all</button></div>
      <div id="pbPages"></div>
      <div id="pbScreen" class="pb-sub" hidden></div>
      <div id="pbPreview" class="pb-sub" hidden></div></div>

    <div class="panel pb-panel"><h3>Publish</h3><div class="sub">Sends the ticked pages to the target. Every page is screened first; a page with a blocking finding is held back unless Send anyway is ticked on its row. Drafts unless you tick Publish live, which asks for a second click. A page already in the target's ledger is updated in place (the adapter looks the slug up first). Media is resolved before each page: local photos are uploaded through the target or the media host, library lookups are searched, and an unresolved slot is dropped so nothing ships with a placeholder.</div>
      <div class="btnrow"><label class="chk"><input type="checkbox" id="pbLive"> Publish live (otherwise drafts)</label><label class="chk"><input type="checkbox" id="pbOnlyNew" checked> Skip pages already sent to this target</label><label class="chk"><input type="checkbox" id="pbReqMedia"> Require every image (stop when a slot is unresolved)</label></div>
      <div class="pb-approve" id="pbApproveBox" hidden></div>
      <div class="btnrow"><button type="button" class="btn primary" id="pbGo">Deploy</button><button type="button" class="btn" id="pbStop" disabled>Stop</button><button type="button" class="btn" id="pbVerify">Verify links</button><button type="button" class="btn accent" id="pbSiteGo" hidden>Publish site now</button><span class="small" id="pbGoNote"></span></div>
      <div class="logbox pb-log" id="pbStatus" role="log" aria-live="polite">Nothing sent yet.</div>
      <div id="pbResults" class="pb-gap"></div></div>

    <div class="panel pb-panel"><div class="pb-head"><div><h3>Sent so far</h3><div class="sub">The ledger for the selected target: what was sent, as what, where it lives, how it screened, who approved it for publication, and what went wrong. It is what Skip pages already sent reads. Sent HTML downloads the exact page the platform received, for the firm's advertising records.</div></div><button type="button" class="btn sm" id="pbLedCsv">↓ CSV for this target</button></div>
      <div id="pbLedgerT"></div></div>

    <div class="panel pb-panel" id="pbArcP"><div class="pb-head"><div><h3>Advertising Review Committee filing</h3><div class="sub">Rule 7.04: a non exempt advertisement is filed with the Advertising Review Committee, State Bar of Texas, within ten days of first dissemination. Rule 7.05 exempts website content other than the homepage, so the homepage is filed and other pages are logged as exempt; a campaign landing page is flagged too, because it is the page an ad sends people to: file it, or record the exemption, as the responsible lawyer decides. Every page published live lands here and in the Compliance Screen's filing log (module 11), where the filing date and the ARC number are recorded.</div></div><div class="btnrow"><button type="button" class="btn sm" id="pbArcCsv">↓ ARC filing CSV</button><button type="button" class="btn sm" id="pbArcComp">Compliance Screen ↗</button></div></div>
      <div class="tiles pb-arct" id="pbArcTiles"></div><div id="pbArcT"></div></div>

    <div class="grid2"><div class="panel"><h3>How it works</h3><ol class="steps pb-meth" id="pbMeth"></ol></div><div class="panel"><h3>Judgment calls</h3><div id="pbJudg" class="pb-judg"></div></div></div>
    <div class="panel pb-panel"><h3>Source register</h3><div class="sub">The platform documentation each adapter follows, and the rules the screen applies.</div><ul class="srcs" id="pbSrc"></ul></div>
    <p class="small pb-foot">Severance, module 22. The Site Forge writes; this module screens and sends. Nothing goes live without a second click, no page with a blocking finding leaves without an explicit override, and every credential stays in this browser.</p>`;

    /* ---------- environment ---------- */
    function env() {
      const host = $('#pbEnv', root); const packBtn = '<div class="btnrow"><button type="button" class="btn" id="pbEnvPack">↓ Pages pack</button></div>';
      if (ENV === 'viewer') host.innerHTML = callout('judg', 'Inside the hosted viewer: the CMS calls are blocked here', `<p>The viewer blocks every call to another site, so Test, Deploy, Verify links and Publish site fail in this view. Everything else works: load, write, screen and preview the pages, export the ledger, the bridge plugin and the kit. To publish, download the pages pack (every page as a standalone HTML file, the paste in body and its JSON, with the screen results) and paste or upload it, or install the Severance extension, which has no such limit.</p>${packBtn}`);
      else if (ENV === 'file') host.innerHTML = callout('note', 'Opened from disk or the web: most CMS calls are blocked by CORS', `<p>A page opened from disk has no site permissions, so the browser lets a call through only when the CMS answers with CORS headers for this origin. The FORGE bridge has an allowed origins list for WordPress; the hosted platforms (Wix, Duda, Webflow, Shopify, HubSpot) and most Drupal, Joomla and Ghost installs do not, so Test and Deploy usually fail here with Could not reach. The Severance extension has no such limit. Here you can still write, screen and preview, and download the pages pack to paste or upload by hand.</p>${packBtn}`);
      else host.innerHTML = callout('note', `Running as ${ENV_LABEL}`, `Deploy runs from this page with the credentials in the cards below. The extension asks once for access to each site you publish to (WordPress, Drupal, Joomla, Ghost) on the first Test or Deploy against it; the hosted platforms (Wix, Duda, Webflow, Shopify, HubSpot) are already permitted in the manifest.${ENV === 'firefox' ? ' Firefox treats host permissions as optional: grant site access in Options if a call is refused.' : ''} Credentials and the ledger stay in extension storage on this machine (sv.cms.v1).`);
      const b = $('#pbEnvPack', root); if (b) b.onclick = pagesPack;
    }
    function renderFirmCallout() {
      const host = $('#pbFirm', root); const F = firmInfo();
      if (!F.missing.length) { host.innerHTML = ''; return; }
      host.innerHTML = callout('', 'The firm profile is not complete', `<p>Missing: <b>${esc(F.missing.join(', '))}</b>. Rule 7.02(a) needs the name of a responsible lawyer and the primary practice location on every page, so the screen holds back every page until both are filled, and the starter template carries bracketed placeholders that the screen also blocks.</p><div class="btnrow"><button type="button" class="btn" id="pbFirmBtn">Set up the firm</button></div>`);
      $('#pbFirmBtn', root).onclick = () => FIRM.panel();
    }
    /* ---------- tiles ---------- */
    function tiles() {
      const list = A(); const conf = list.filter(a => CMS.status(a.id).state !== 'unconfigured').length; const conn = list.filter(a => CMS.status(a.id).state === 'connected').length;
      let sent = 0, last = ''; list.forEach(a => Object.values(CMS.deployedFor(a.id)).forEach(r => { if (r && r.ok !== false) sent++; if (r && r.at && r.at > last) last = r.at; }));
      const t = T(); const sel = st.pages.filter(p => st.selected.has(p.slug)); const held = sel.filter(heldBy).length; const ovr = sel.filter(p => !scrOf(p).pass && st.override.has(p.slug)).length;
      const ld = last ? new Date(last) : null;
      $('#pbTiles', root).innerHTML =
        tile('Targets', `${N(conf)} of ${N(list.length)}`, list.length ? `${N(conn)} tested and connected` : 'no adapters loaded') +
        tile('Pages loaded', N(st.pages.length), `${N(st.selected.size)} selected`) +
        tile('Screen', !sel.length ? 'n/a' : held ? `${N(held)} held` : 'clear', !sel.length ? 'tick pages to see how they screen' : `${plural(sel.length, 'selected page')} screened${ovr ? `, ${N(ovr)} overridden` : ''}`) +
        tile('Pages sent', N(sent), 'across every target, from the ledger') +
        tile('Last deploy', ld ? `<span class="pb-tv">${esc(dateOf(ld))}</span>` : 'n/a', ld ? ld.toLocaleTimeString() : 'nothing sent yet') +
        tile('Target', t ? `<span class="pb-tv">${esc(t.name)}</span>` : 'none', t ? esc(CMS.status(t.id).label) : 'choose one in the cards');
    }
    /* ---------- target cards ---------- */
    function optList(f) { return (f.options || f.opts || []).map(o => (o && typeof o === 'object') ? { v: o.v != null ? o.v : o.value, l: o.l != null ? o.l : (o.label != null ? o.label : o.v) } : { v: o, l: o }); }
    function cmsField(a, f, c) {
      const id = `pbF-${a.id}-${f.k}`; const has = c[f.k] != null && c[f.k] !== ''; const v = has ? c[f.k] : (f.def != null ? f.def : '');
      const hint = f.hint ? `<span class="hint">${esc(modFix(f.hint))}</span>` : ''; const lab = `${esc(f.l || f.k)}${f.optional ? ' <span class="pb-opt">optional</span>' : ''}`;
      if (f.t === 'checkbox') return `<div class="pb-chkf"><label class="chk" for="${id}"><input type="checkbox" id="${id}" data-k="${esc(f.k)}" ${v === true || v === 'true' || v === 1 || v === '1' ? 'checked' : ''}> ${lab}</label>${hint}</div>`;
      if (f.t === 'select') return `<div class="ctl"><label for="${id}">${lab}</label><select id="${id}" data-k="${esc(f.k)}">${optList(f).map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>${hint}</div>`;
      if (f.t === 'textarea') return `<div class="ctl wide"><label for="${id}">${lab}</label><textarea id="${id}" data-k="${esc(f.k)}" spellcheck="false">${esc(v)}</textarea>${hint}</div>`;
      const type = (f.secret || f.t === 'password') ? 'password' : f.t === 'number' ? 'number' : 'text';
      return `<div class="ctl${f.wide ? ' wide' : ''}"><label for="${id}">${lab}</label><input type="${type}" id="${id}" data-k="${esc(f.k)}" value="${esc(v)}" autocomplete="off" spellcheck="false" placeholder="${esc(f.placeholder || (f.t === 'url' ? 'https://' : ''))}"${f.t === 'url' ? ' inputmode="url"' : ''}>${hint}</div>`;
    }
    function capsLine(a) {
      const c = a.caps || {}; const items = [['media', 'uploads'], ['urls', 'live urls'], ['publishSite', 'site publish'], ['elementor', 'elementor'], ['seo', 'seo fields']].map(([k, l]) => `<span class="${c[k] ? 'on' : ''}" title="${c[k] ? 'supported' : 'not supported'}">${l}</span>`);
      items.push(`<span class="on">json-ld ${esc(c.schema || 'inline')}</span>`); if (c.postTypes) items.push(`<span class="on">${esc(c.postTypes.join(', '))}</span>`);
      return `<div class="pb-caps">${items.join('')}</div>`;
    }
    function targetCard(a) {
      const c = CMS.cfg(a.id); const caps = a.caps || {}; const wp = /^wp_/.test(a.id) || !!caps.bridge; const on = st.target === a.id; const id = esc(a.id);
      return `<div class="ccard pb-card${on ? ' on' : ''}" data-id="${id}">
        <div class="pb-grp">${esc(a.group || '')}</div>
        <div class="pb-ch"><h4>${esc(a.name)}</h4><label class="chk pb-use"><input type="radio" name="pbUse" value="${id}" ${on ? 'checked' : ''}> Use as target</label></div>
        <div class="st"><span class="pill" id="pbSt-${id}"></span></div>
        <div class="meta">${esc(modFix(a.blurb || ''))}</div>${capsLine(a)}
        <div class="pb-fields">${(a.fields || []).map(f => cmsField(a, f, c)).join('')}</div>
        <div class="btnrow"><button type="button" class="btn sm" data-a="save">Save</button><button type="button" class="btn sm accent" data-a="test">Test</button>${caps.publishSite && typeof a.publishSite === 'function' ? '<button type="button" class="btn sm" data-a="publishSite">Publish site</button>' : ''}${typeof a.configure === 'function' ? `<button type="button" class="btn sm" data-a="configure">${a.id === 'wp_headless' ? 'Configure bridge for headless' : 'Configure'}</button>` : ''}${caps.headlessKit ? '<button type="button" class="btn sm" data-a="kit">↓ Next.js kit</button>' : ''}${wp ? '<button type="button" class="btn sm" data-a="bridge">↓ Bridge plugin</button>' : ''}</div>
        <details class="pb-det"><summary>Setup</summary>${(a.setup || []).length ? `<ol class="steps">${a.setup.map(s => `<li>${esc(modFix(s))}</li>`).join('')}</ol>` : '<p class="small">No steps listed by this adapter.</p>'}${a.docs ? `<p class="small">Docs: <a href="${esc(a.docs)}" target="_blank" rel="noopener">${esc(a.docs)}</a></p>` : ''}</details>
        <details class="pb-det"><summary>Clear</summary><div class="btnrow"><button type="button" class="btn sm danger" data-a="forget">Forget credentials</button><button type="button" class="btn sm danger" data-a="clearLedger">Clear sent ledger</button></div></details>
        <div class="logbox pb-clog" id="pbLog-${id}" hidden></div></div>`;
    }
    function renderTargets() {
      const host = $('#pbTargets', root); const list = A();
      if (!list.length) { host.innerHTML = callout('judg', 'No CMS adapters are loaded', 'The platform adapters live in <code>src/cms/1x_*.js</code> and app.html loads them before this module. None registered, so there is nowhere to send a page yet. The composer, the import, the screen, the preview and the pages pack still work; reload once the adapter files are in place.'); fillSelects(); return; }
      host.innerHTML = `<div class="pb-cards">${list.map(targetCard).join('')}</div>`;
      $$('.pb-card', host).forEach(cardEl => { const id = cardEl.dataset.id; $$('button[data-a]', cardEl).forEach(b => b.onclick = () => act(id, b.dataset.a, cardEl)); const r = $('input[name="pbUse"]', cardEl); if (r) r.onchange = () => { if (r.checked) setTarget(id); }; });
      fillSelects(); pills();
    }
    function pills() { A().forEach(a => { const s = CMS.status(a.id); const p = $(`#pbSt-${a.id}`, root); if (p) { p.textContent = s.label; p.className = 'pill' + ({ connected: ' good', configured: ' info' }[s.state] || ''); p.title = s.label; } }); }
    function fillSelects() {
      const list = A(); const ts = $('#pbTarget', root); const ms = $('#pbMedia', root); const S = CMS.settings();
      ts.innerHTML = `<option value="">${list.length ? 'Choose a target' : 'No adapters loaded'}</option>` + list.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join(''); ts.value = list.some(a => a.id === st.target) ? st.target : '';
      const hosts = list.filter(a => (a.caps || {}).media && typeof a.uploadMedia === 'function');
      ms.innerHTML = '<option value="">Same as the target</option>' + hosts.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join(''); ms.value = hosts.some(a => a.id === S.mediaHost) ? S.mediaHost : '';
    }
    const log = (id, msg, isErr) => { const h = $(`#pbLog-${id}`, root); if (!h) return; h.hidden = false; h.classList.toggle('pb-err', !!isErr); h.textContent = `${hhmm()} ${modFix(msg)}`; };
    const readFields = cardEl => { const patch = {}; $$('[data-k]', cardEl).forEach(i => { patch[i.dataset.k] = i.type === 'checkbox' ? i.checked : String(i.value || '').trim(); }); return patch; };
    const ctxFor = () => ({ http: CMS.http, log: m => slog(m), mediaHost: null, signal: st.ctl ? st.ctl.signal : undefined });
    /* before any call into an adapter: the required fields are filled, and the firm's own site is permitted (asked once) */
    async function grant(ad) {
      if (!ad) return; if (!CMS.fieldsOk(ad, CMS.cfg(ad.id))) throw CMS.err(`${ad.name} is not configured`, { status: 0, hint: 'fill in the required fields on its card and Save' });
      if (typeof ad.dynamicHost === 'function') { const o = ad.dynamicHost(CMS.cfg(ad.id)); if (o) { const p = await CMS.ensureOrigin(o); if (!p.granted) throw CMS.err(`Site access to ${p.origin} was not granted; the browser asks once per site.`, { status: 0, hint: 'click again and accept the prompt' }); } }
      /* fixed API hosts come from the manifest; when one is missing there (a region host, a renamed host) ask for it once */
      const pats = (Array.isArray(ad.hosts) ? ad.hosts : []).filter(h => /^https?:\/\//.test(String(h))); if (!pats.length || !CMS.RT || !CMS.RT.permissions) return;
      let has = false; try { has = await CMS.RT.permissions.contains({ origins: pats }); } catch (e) { has = false; }
      if (has) return; let ok = false; try { ok = await CMS.RT.permissions.request({ origins: pats }); } catch (e) { ok = false; }
      if (!ok) throw CMS.err(`Access to the ${ad.name} API hosts was not granted`, { status: 0, hint: `accept the prompt for ${pats.join(', ')}` });
    }
    /* two clicks for anything destructive: the first arms the button for four seconds */
    function armed(btn, key, label, ask) { if (st.confirm[key]) { st.confirm[key] = false; if (btn) btn.textContent = label; return true; } st.confirm[key] = true; if (btn) btn.textContent = ask || 'Click again to confirm'; setTimeout(() => { st.confirm[key] = false; if (btn && btn.isConnected) btn.textContent = label; }, 4000); return false; }
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
      } catch (e) { log(id, errText(e), true); toast(`${ad.name}: ${modFix(e.message || e)}`); }
      finally { busy(false); pills(); tiles(); }
    }
    function setTarget(id) {
      st.target = id && CMS.get(id) ? id : ''; CMS.setSettings({ target: st.target });
      $('#pbTarget', root).value = st.target; $$('input[name="pbUse"]', root).forEach(r => r.checked = r.value === st.target); $$('#pbTargets .pb-card', root).forEach(c => c.classList.toggle('on', c.dataset.id === st.target));
      $('#pbSiteGo', root).hidden = true; renderPages(); renderLedger(); updateGo(); tiles();
    }
    function mediaHostFor(ad, notes) {
      const mh = CMS.settings().mediaHost; if (!mh || mh === ad.id) return ''; const h = CMS.get(mh);
      if (!h || !(h.caps || {}).media || typeof h.uploadMedia !== 'function') return '';
      if (CMS.status(mh).state === 'unconfigured') { (notes || []).push(`Media host ${h.name} is not configured; uploads go through ${ad.name} instead.`); return ''; }
      return mh;
    }
    /* ---------- downloads ---------- */
    function bridgeZip() { if (typeof FORGE_BRIDGE_PHP === 'undefined') { toast('The bridge plugin source is not loaded (src/05_forge_bridge_raw.js)'); return; } saveFile('forge-bridge.zip', zipBlob([{ name: 'forge-bridge/forge-bridge.php', data: FORGE_BRIDGE_PHP }])); }
    function kitZip() {
      const K = globalThis.HEADLESS_KIT; if (!K || typeof K.zipEntries !== 'function') { toast('The Next.js kit is not loaded (src/cms/19_headless_kit.js)'); return; }
      const c = CMS.cfg('wp_headless'); const wpUrl = CMS.trimSlash(c.url || ''), siteUrl = CMS.trimSlash(c.siteUrl || '');
      if (!wpUrl || !siteUrl) { const cardEl = $('.pb-card[data-id="wp_headless"]', root); if (cardEl) { const f = $(`[data-k="${!wpUrl ? 'url' : 'siteUrl'}"]`, cardEl); try { cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } if (f) f.focus(); } toast('Fill in the WordPress URL and the front end URL on the WordPress · Headless card, Save, then download the kit'); return; }
      const F = firmInfo(); if (F.missing.length) { toast(`Fill the firm profile first (${F.missing.join(', ')}): the kit prints the firm name and the responsible lawyer line on every page`); return; }
      const col = F.raw.colors || {};
      try { const entries = K.zipEntries({ wpUrl, siteUrl, brand: { name: F.name, primary: col.primary, accent: col.accent, dark: col.dark }, siteName: F.name, cta: { url: '/contact/', label: 'Schedule a consultation' }, footerLine: FIRM.adFooter() }); saveFile('forge-headless-kit.zip', zipBlob(entries)); }
      catch (e) { toast('Kit: ' + e.message); }
    }
    /* the pages pack: what a person pastes or uploads by hand where the browser cannot reach the CMS */
    async function pagesPack() {
      const list = st.selected.size ? st.pages.filter(p => st.selected.has(p.slug)) : st.pages.slice();
      if (!list.length) { toast('Load or write a page first: the pack holds the pages in the list'); return; }
      const files = []; const rows = []; let held = 0;
      try {
        for (const p of list) {
          const r = screenPage(p); const ovr = st.override.has(p.slug); const isHeld = !r.pass && !ovr; if (isHeld) held++;
          const dir = (isHeld ? 'held/' : '') + p.slug + '/'; const map = {}; const media = {};
          for (const [k, m] of Object.entries(p.media || {})) {
            if (!m) continue; media[k] = { url: m.url || '', alt: m.alt || '', kind: m.kind || 'image', width: m.width, height: m.height, library: m.library, missing: m.missing };
            let blob = null, mime = m.mime || '';
            try { if (m.asset && m.asset.blob) { blob = m.asset.blob; mime = mime || m.asset.mime || blob.type; } else if (/^data:/.test(m.url || '') && !CMS.isPlaceholder(m.url)) { blob = CMS.dataUrlToBlob(m.url); mime = mime || (blob && blob.type) || ''; } } catch (e) { blob = null; }
            if (!blob) continue;
            const fileName = (m.asset && m.asset.file) || k; const fn = 'media/' + (CMS.slug(String(fileName).replace(/\.[a-z0-9]{2,5}$/i, '')) || k) + '.' + CMS.extOf(fileName, mime);
            files.push({ name: dir + fn, data: await CMS.blobBytes(blob) }); media[k].url = fn; if (m.url) map[m.url] = fn;
          }
          const pg = Object.assign({}, p, { html: CMS.stripPlaceholders(CMS.rewriteMedia(p.html || '', map)), media });
          if (pg.seo && map[pg.seo.og_image]) pg.seo = Object.assign({}, pg.seo, { og_image: map[pg.seo.og_image] }); if (map[pg.featured_media_url]) pg.featured_media_url = map[pg.featured_media_url];
          files.push({ name: dir + 'index.html', data: CMS.fullHtml(pg) });
          files.push({ name: dir + 'body.html', data: CMS.bodyHtml(pg, { css: true, schema: true }) });
          let json; try { json = JSON.stringify(Object.assign({ severance_page: 1, exported: new Date().toISOString(), screen: { pass: r.pass, override: ovr, counts: r.counts, findings: r.findings.map(f => ({ id: f.id, sev: f.sev, title: f.title, rule: f.rule, hit: f.hit })) } }, pg), null, 2); } catch (e) { json = JSON.stringify({ slug: pg.slug, title: pg.title, error: e.message }); }
          files.push({ name: dir + 'page.json', data: json });
          rows.push([dir, p.slug, p.title, p.language || 'en-US', isHeld ? 'held' : ovr && !r.pass ? 'override' : 'clear', r.counts.block, r.counts.fix, r.counts.warn, r.counts.info, r.findings.map(f => `${f.sev}: ${f.title} (${f.rule})`).join('; ')]);
        }
        files.push({ name: 'compliance.csv', data: toCSV(['folder', 'slug', 'title', 'language', 'screen', 'block', 'fix', 'review', 'note', 'findings'], rows, `Severance pages pack, screened ${new Date().toISOString()} against the compliance engine (kind page)`) });
        files.push({ name: 'README.txt', data: packReadme(list.length, held) });
        saveFile(`severance-pages_${todayISO()}.zip`, zipBlob(files));
        if (held) toast(`${plural(held, 'page')} went into held/ because the screen blocks them`);
      } catch (e) { toast('Pages pack: ' + e.message); }
    }
    function packReadme(n, held) {
      const F = firmInfo();
      return [`Severance pages pack, written ${fmtDateL(todayISO())}${F.missing.length ? '' : ' for ' + F.name}.`, `${plural(n, 'page')}${held ? `, ${N(held)} of them held back under held/` : ''}.`, '',
        'Each folder holds one page:', '  index.html   the page as a standalone document (title, meta description, canonical, robots, css and JSON-LD in the head)', '  body.html    the section markup with its css and JSON-LD inline, for a CMS field or block that takes HTML', '  page.json    the portable page (title, slug, meta description, language, SEO fields, schema, media slots, Elementor data when the Site Forge wrote it) and the screen result', '  media/       photos that were local to this browser; the markup points at them by relative path, so upload them and replace the paths', '',
        'Folders under held/ carry blocking findings from the compliance screen (compliance.csv lists them). Fix them, or have the responsible lawyer decide, before they go anywhere.', '',
        'By hand, per platform:', '  WordPress: a Custom HTML block (or the code editor) with body.html; the FORGE bridge through the Severance extension writes Elementor data and the SEO fields instead.', '  Drupal: the body field in a text format that keeps style and script tags (Full HTML).', '  Wix and Webflow: a CMS collection item (title, slug, rich text body, meta fields) behind a dynamic or template page; the css and scripts do not survive a rich text field.', '  Duda: an HTML widget on a page built from the template page.', '  Shopify, HubSpot, Joomla, Ghost: the page or post body editor in HTML mode (Ghost: an HTML card; the JSON-LD goes in the code injection head).', '',
        'Texas rules: every page names the responsible lawyer and the primary practice location (Rule 7.02(a)) when the screen is clear. The homepage is not exempt from filing: file it with the Advertising Review Committee within ten days of first dissemination (Rule 7.04); other website pages are exempt (Rule 7.05).', ''].join('\n');
    }
    /* ---------- pages ---------- */
    function persistLoaded() { store.set('sev.publish.loaded', { at: new Date().toISOString(), slugs: st.pages.map(p => p.slug) }); }
    function addPages(list, source) {
      let n = 0; (list || []).forEach(p => { if (!p || !p.slug) return; p = Object.assign({}, p); if (!p.source) p.source = source || 'import'; if (!p.checks && Array.isArray(p.lint) && p.lint.length) p.checks = checksFromLint(p.lint); const i = st.pages.findIndex(x => x.slug === p.slug); if (i >= 0) st.pages[i] = p; else st.pages.push(p); st.selected.add(p.slug); st.override.delete(p.slug); screenPage(p); n++; });
      persistLoaded(); renderPages(); tiles(); updateGo(); if (st.screenSlug && list.some(p => p && p.slug === st.screenSlug)) showScreen(st.screenSlug, true); return n;
    }
    function removePage(s) { st.pages = st.pages.filter(p => p.slug !== s); st.selected.delete(s); st.override.delete(s); st.scr.delete(s); if (st.previewSlug === s) closePreview(); if (st.screenSlug === s) closeScreen(); persistLoaded(); renderPages(); tiles(); updateGo(); }
    const checksFromLint = lint => { const block = lint.filter(l => /^BLOCK/.test(l)).length; const warn = lint.filter(l => !/^BLOCK/.test(l)).length; return { block, warn, note: 0, issues: lint.map(l => ({ sev: /^BLOCK/.test(l) ? 'block' : 'warn', id: 'lint', msg: l })) }; };
    const checksCell = ch => { const parts = []; if (ch.block) parts.push(`<span class="pb-red">${N(ch.block)} block</span>`); if (ch.warn) parts.push(`<span class="pb-warn">${N(ch.warn)} warn</span>`); const tip = (ch.issues || []).map(i => i.msg).join('\n'); return `<span title="${esc(tip)}">${parts.length ? parts.join(' ') : '<span class="pb-ok">clean</span>'}</span>`; };
    function statusCell(d) {
      if (!d) return '<span class="small">not sent</span>';
      if (d.ok === false) return `${pill('error', 'bad')} <span class="small" title="${esc(d.error || '')}">${esc(modFix(String(d.error || '').slice(0, 80)))}</span>`;
      const link = d.link ? ` <a href="${esc(d.link)}" target="_blank" rel="noopener" title="${esc(d.link)}">open</a>` : ''; const edit = d.edit ? ` <a href="${esc(d.edit)}" target="_blank" rel="noopener">edit</a>` : '';
      return `${pill('sent ' + (d.status || 'draft'), d.status === 'publish' ? 'good' : 'info')}${link}${edit}<div class="small">${esc(when(d.at))}</div>`;
    }
    function lintCell(p) {
      const r = scrOf(p); const c = r.counts; const ovr = st.override.has(p.slug); const extra = extraOf(c);
      return `${lintPill(r, ovr)}${extra ? `<div class="small">${extra}</div>` : ''}${c.block ? `<label class="chk pb-ovr"><input type="checkbox" data-ovr="${esc(p.slug)}" ${ovr ? 'checked' : ''}> Send anyway</label>` : ''}`;
    }
    function rowHTML(p, led) {
      const m = mediaOf(p); const sel = st.selected.has(p.slug); const d = led[p.slug];
      return `<tr class="${sel ? 'pb-sel' : ''}${st.previewSlug === p.slug || st.screenSlug === p.slug ? ' pb-cur' : ''}" data-slug="${esc(p.slug)}"><td><input type="checkbox" data-sel="${esc(p.slug)}" ${sel ? 'checked' : ''} aria-label="Select ${esc(p.title)}"></td><td class="l">${esc(p.kind || p.post_type || 'page')}${p.label ? `<div class="small">${esc(p.label)}</div>` : ''}</td><td class="l pb-wrap">${esc(p.title)}${p.noindex ? ' <span class="small">noindex</span>' : ''}${isHome(p) ? ' <span class="small">homepage</span>' : ''}</td><td class="l"><code>/${esc(p.slug)}/</code></td><td>${N(wordsOf(p))}</td><td>${p.checks ? checksCell(p.checks) : '<span class="small">n/a</span>'}</td><td class="l pb-lint">${lintCell(p)}</td><td>${m.n ? `${N(m.n)}${m.bad ? ` <span class="pb-red">${N(m.bad)} unresolved</span>` : ''}` : '<span class="small">none</span>'}</td><td class="l">${statusCell(d)}</td><td class="l"><div class="pb-acts"><button type="button" class="btn sm" data-a="preview">Preview</button><button type="button" class="btn sm" data-a="screen">Screen</button><button type="button" class="btn sm danger" data-a="remove">Remove</button></div></td></tr>`;
    }
    function renderPages() {
      const host = $('#pbPages', root); const t = T(); const led = t ? CMS.deployedFor(t.id) : {};
      st.selected.forEach(s => { if (!st.pages.some(p => p.slug === s)) st.selected.delete(s); });
      if (!st.pages.length) { const rec = store.get('sev.publish.loaded', null); host.innerHTML = `<p class="small pb-empty">No pages loaded. Load them from the Site Forge, write one in the composer, or import a file.${rec && rec.slugs && rec.slugs.length ? ` Last time ${plural(rec.slugs.length, 'page was', 'pages were')} loaded (${esc(rec.slugs.slice(0, 6).join(', '))}${rec.slugs.length > 6 ? ', and more' : ''}); pages hold photos, so they are not saved between sessions.` : ''}</p>`; selN(); return; }
      host.innerHTML = `<div class="tblwrap pb-tbl"><table class="t"><thead><tr><th><input type="checkbox" id="pbSelHead" aria-label="Select every page" ${st.pages.every(p => st.selected.has(p.slug)) ? 'checked' : ''}></th><th class="l">Kind</th><th class="l">Title</th><th class="l">Slug</th><th>Words</th><th>Checks</th><th class="l">Screen</th><th>Media</th><th class="l">On ${t ? esc(t.name) : 'the target'}</th><th class="l">Actions</th></tr></thead><tbody>${st.pages.map(p => rowHTML(p, led)).join('')}</tbody></table></div>`;
      $$('input[data-sel]', host).forEach(cb => cb.onchange = () => { if (cb.checked) st.selected.add(cb.dataset.sel); else st.selected.delete(cb.dataset.sel); cb.closest('tr').classList.toggle('pb-sel', cb.checked); selN(); tiles(); updateGo(); });
      $$('input[data-ovr]', host).forEach(cb => cb.onchange = () => setOverride(cb.dataset.ovr, cb.checked));
      $('#pbSelHead', host).onchange = e => { st.pages.forEach(p => { if (e.target.checked) st.selected.add(p.slug); else st.selected.delete(p.slug); }); renderPages(); tiles(); updateGo(); };
      $$('tr[data-slug]', host).forEach(tr => { const s = tr.dataset.slug; $('button[data-a="preview"]', tr).onclick = () => preview(s); $('button[data-a="screen"]', tr).onclick = () => showScreen(s); $('button[data-a="remove"]', tr).onclick = () => removePage(s); });
      selN();
    }
    function setOverride(s, on) {
      const p = st.pages.find(x => x.slug === s); if (!p) return;
      if (on) { st.override.add(s); toast(`Send anyway is on for /${s}/: it goes out with ${plural(scrOf(p).counts.block, 'blocking finding')}, recorded in the ledger`); } else { st.override.delete(s); toast(`/${s}/ is held back again`); }
      renderPages(); tiles(); updateGo(); if (st.screenSlug === s) showScreen(s, true);
    }
    function selN() { const e2 = $('#pbSelN', root); if (e2) e2.textContent = st.pages.length ? `${N(st.selected.size)} of ${N(st.pages.length)} selected` : ''; }
    function selectWhere(fn) { st.pages.forEach(p => { if (fn(p)) st.selected.add(p.slug); else st.selected.delete(p.slug); }); renderPages(); tiles(); updateGo(); }
    function markCur() { $$('#pbPages tr[data-slug]', root).forEach(tr => tr.classList.toggle('pb-cur', tr.dataset.slug === st.previewSlug || tr.dataset.slug === st.screenSlug)); }
    function preview(s) {
      const p = st.pages.find(x => x.slug === s); const host = $('#pbPreview', root); if (!p) { closePreview(); return; }
      st.previewSlug = s; host.hidden = false;
      const doc = CMS.fullHtml(Object.assign({}, p, { html: CMS.stripScripts(p.html) }));
      host.innerHTML = `<div class="pb-head"><div><h4 class="pb-subh">Preview · ${esc(p.title)}</h4><div class="small">/${esc(p.slug)}/ · ${N(wordsOf(p))} words · ${esc(p.post_type || 'page')} · ${esc(p.language || 'en-US')}. Rendered from the portable page the target receives: its css, markup and JSON-LD. The platform's own header, footer and theme wrap it after publishing.</div></div><div class="btnrow"><button type="button" class="btn sm" id="pbPvHtml">↓ HTML</button><button type="button" class="btn sm" id="pbPvClose">Close</button></div></div><iframe class="preview pb-prev" sandbox="allow-same-origin" title="Preview of ${esc(p.title)}"></iframe>`;
      $('iframe', host).srcdoc = doc;
      $('#pbPvHtml', host).onclick = () => saveFile(p.slug + '.html', doc);
      $('#pbPvClose', host).onclick = closePreview;
      markCur(); try { host.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
    }
    function closePreview() { const host = $('#pbPreview', root); host.hidden = true; host.innerHTML = ''; st.previewSlug = null; markCur(); }
    function showScreen(s, quiet) {
      const p = st.pages.find(x => x.slug === s); const host = $('#pbScreen', root); if (!p) { closeScreen(); return; }
      st.screenSlug = s; const r = screenPage(p); const c = r.counts; const ovr = st.override.has(s); host.hidden = false;
      const can702 = r.findings.some(f => f.id === 'r702a') && !firmInfo().missing.length;
      const cls = f => f.sev === 'block' ? 'crit' : f.sev === 'info' ? 'info' : '';
      const items = r.findings.length ? r.findings.map(f => `<div class="finding ${cls(f)}"><b>${esc(f.title)}</b><div class="rule">${sevPill(f.sev)} ${esc(f.rule)}</div><p>${esc(f.why)}</p>${f.hit ? `<div class="small">Matched: “${esc(String(f.hit).slice(0, 160))}”</div>` : ''}</div>`).join('') : '<div class="finding ok"><b>Nothing found</b><p>The compliance engine found no pattern on this page. It is a floor, not a review: the responsible lawyer still reads the page before it goes live.</p></div>';
      host.innerHTML = `<div class="pb-head"><div><h4 class="pb-subh">Screen · ${esc(p.title)}</h4><div class="small">${lintPill(r, ovr)} ${N(c.block)} block, ${N(c.fix)} fix, ${N(c.warn)} review, ${N(c.info)} note. Screened ${esc(when(r.at))} with the compliance engine (kind page, ${/^es/i.test(p.language || '') ? 'Spanish' : 'English'}): the title, the meta description and the body text.</div></div><div class="btnrow">${c.block ? `<label class="chk pb-ovr"><input type="checkbox" id="pbScOvr" ${ovr ? 'checked' : ''}> Send anyway (the responsible lawyer reviewed it)</label>` : ''}${can702 ? '<button type="button" class="btn sm" id="pbScDisc">Append the firm disclaimer</button>' : ''}<button type="button" class="btn sm" id="pbScClose">Close</button></div></div><div class="pb-finds">${items}</div>`;
      if ($('#pbScOvr', host)) $('#pbScOvr', host).onchange = e => setOverride(s, e.target.checked);
      if ($('#pbScDisc', host)) $('#pbScDisc', host).onclick = () => { p.html = String(p.html || '').replace(/\s*$/, '\n') + disclaimerHtml(p.language); p.words = CMS.words(p.html); if (p.kind === 'composer') p.checks = composerChecks(p); screenPage(p); renderPages(); tiles(); updateGo(); showScreen(s, true); toast(p.source === 'forge' ? 'Disclaimer appended here only; the Site Forge plan is unchanged' : 'Disclaimer appended'); };
      $('#pbScClose', host).onclick = closeScreen;
      markCur(); if (!quiet) { try { host.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } }
    }
    function closeScreen() { const host = $('#pbScreen', root); host.hidden = true; host.innerHTML = ''; st.screenSlug = null; markCur(); }
    /* ---------- Site Forge (module 21) ---------- */
    function forgeState() { const f = MODI.forge; return !f ? 'Module 21, the Site Forge, is not loaded in this build; the composer and the import work without it.' : f.mounted ? 'Module 21 is running; this reads its current plan with the photos assigned there.' : 'Module 21 plans and writes the pages; it starts silently in the background when you load them here.'; }
    async function loadForge() {
      const f = MODI.forge; const note = $('#pbfNote', root); const b = $('#pbfLoad', root); const warnHost = $('#pbfWarn', root);
      if (!f) { note.textContent = 'Module 21 is not loaded in this build.'; warnHost.innerHTML = callout('judg', 'Site Forge not available', 'Module 21 (src/40_m21_forge.js) did not register, so there is no plan to read. Write the page in the composer, or import a FORGE bundle, a blueprint or an HTML document; everything else here works without it.'); toast('The Site Forge module is not loaded'); return; }
      b.disabled = true; note.textContent = 'Reading the Site Forge plan…';
      try {
        if (!f.mounted) {
          const host = $('#mod-forge'); if (!host) throw new Error('its section is missing from the page');
          f.mounted = true; try { f.mount(host); } catch (e) { f.mounted = false; throw new Error('it could not start (' + (e && e.message || e) + ')'); }
        }
        if (typeof f.publishPages !== 'function') throw new Error('this build of the Site Forge has no hand off (publishPages)');
        const pages = (await f.publishPages()) || [];
        let assets = [], site = null; try { assets = typeof f.publishAssets === 'function' ? ((await f.publishAssets()) || []) : []; } catch (e) { assets = []; } try { site = typeof f.publishSite === 'function' ? await f.publishSite() : null; } catch (e) { site = null; }
        renderForgeSite(site, assets);
        if (!Array.isArray(pages) || !pages.length) { note.textContent = 'The Site Forge plan is empty. Open module 21, choose the pages to write, then load again.'; warnHost.innerHTML = ''; toast('No pages in the Site Forge plan'); return; }
        const n = addPages(pages, 'forge'); forgeWarn(pages); note.textContent = `${plural(n, 'page')} loaded from the Site Forge at ${hhmm()}. Load again after editing the plan.`; toast(`${plural(n, 'page')} loaded`);
      } catch (e) { note.textContent = 'Could not load: ' + (e && e.message || e); warnHost.innerHTML = callout('judg', 'The Site Forge did not hand over its pages', `${esc(e && e.message || e)}. Open module 21 to see what it says; the composer and the import still work.`); toast('Site Forge: ' + (e && e.message || e)); }
      finally { b.disabled = false; }
    }
    function renderForgeSite(site, assets) {
      const host = $('#pbfSite', root); const s = site && typeof site === 'object' ? site : {}; const str = v => typeof v === 'string' ? v.trim() : '';
      const nm = str(s.name) || str(s.brand) || str(s.firm) || (s.brand && typeof s.brand === 'object' ? str(s.brand.name) : ''); const url = str(s.url); const cms = str(s.cms);
      const nA = Array.isArray(assets) ? assets.length : 0;
      host.innerHTML = (nm || url || cms || nA) ? `Site Forge site: ${[nm && `<b>${esc(nm)}</b>`, url && esc(url), cms && `CMS ${esc(cms)}`].filter(Boolean).join(' · ')}${nA ? ` · ${plural(nA, 'photo')} in the forge library, uploaded through the target or the media host at deploy` : ''}${cms && /^https?:\/\//.test(cms) ? ' <button type="button" class="btn sm" id="pbfUseCms">Use this CMS URL on the WordPress cards</button>' : ''}` : '';
      const ub = $('#pbfUseCms', host); if (ub) ub.onclick = () => { let k = 0; ['wp_elementor', 'wp_headless'].forEach(id => { const i = $(`#pbF-${id}-url`, root); if (i && !i.value.trim()) { i.value = cms; k++; } }); toast(k ? `Filled on ${plural(k, 'card')}; Save each card to keep it` : 'The WordPress cards already carry a URL'); };
    }
    function forgeWarn(pages) {
      const host = $('#pbfWarn', root); let bad = 0, pgs = 0, lib = 0, miss = 0, blocks = 0, held = 0;
      pages.forEach(p => { const slots = Object.values(p.media || {}).filter(Boolean); const b = slots.filter(m => !m.url && !m.asset && (m.library || m.missing)); if (b.length) { pgs++; bad += b.length; lib += b.filter(m => m.library).length; miss += b.filter(m => m.missing).length; } if ((p.checks && p.checks.block) || (p.lint || []).some(l => /^BLOCK/.test(l))) blocks++; if (!scrOf(p).pass) held++; });
      const parts = [];
      if (held) parts.push(callout('', `${plural(held, 'page')} held back by the compliance screen`, `Each carries at least one blocking finding (open Screen on its row to see which rule and why). They stay here at deploy unless you tick Send anyway on the row. The usual causes: the firm profile is incomplete, so the responsible lawyer or the primary office is missing (Rule 7.02(a)), or a claim the rules forbid.`));
      if (bad) parts.push(callout('judg', `${plural(bad, 'media slot')} on ${plural(pgs, 'page')} have no photo`, `${lib ? `${N(lib)} will be searched in the target's media library at deploy (a matching file name or title wins). ` : ''}${miss ? `${N(miss)} point at assets that are not loaded in this session (photos are not saved with the plan; add them again in module 21). ` : ''}A slot that stays unresolved is dropped so the page never ships with a placeholder; tick Require every image below to stop instead.`));
      if (blocks) parts.push(callout('', `${plural(blocks, 'page')} carry a blocking forge check`, 'The deploy driver refuses a page whose forge lint has a BLOCK line, whatever the screen says. Fix it in the Site Forge (module 21) and load again.'));
      host.innerHTML = parts.join('');
    }
    /* ---------- composer ---------- */
    const CK = 'sev.publish.composer';
    const LANGS = ['en-US', 'es-US', 'es-MX'];
    const cd = Object.assign({ title: '', slug: '', slugManual: false, meta: '', lang: 'en-US', type: 'page', html: '', schema: '', noindex: false, clean: true }, store.get(CK, {}) || {});
    if (!LANGS.includes(cd.lang)) cd.lang = 'en-US';
    const cEl = k => $('#pbc' + k, root);
    const cSave = debounce(() => store.set(CK, cd), 300);
    function cWrite() { cEl('Title').value = cd.title; cEl('Slug').value = cd.slug; cEl('Meta').value = cd.meta; cEl('Lang').value = cd.lang; cEl('Type').value = cd.type; cEl('Html').value = cd.html; cEl('Schema').value = cd.schema; cEl('Noindex').checked = !!cd.noindex; cEl('Clean').checked = cd.clean !== false; cCount(); }
    function cRead() { cd.title = cEl('Title').value; cd.slug = cEl('Slug').value; cd.meta = cEl('Meta').value; cd.lang = cEl('Lang').value; cd.type = cEl('Type').value; cd.html = cEl('Html').value; cd.schema = cEl('Schema').value; cd.noindex = cEl('Noindex').checked; cd.clean = cEl('Clean').checked; }
    function cCount() {
      const t = cEl('Title').value.length; const tn = cEl('TitleN'); tn.textContent = `${t} / 60`; tn.className = 'pb-count' + (t > 60 ? ' over' : '');
      const m = cEl('Meta').value.length; const mn = cEl('MetaN'); mn.textContent = `${m} / 155`; mn.className = 'pb-count' + (m > 160 ? ' over' : m && m < 70 ? ' short' : '');
      const h = cEl('Html').value; cEl('HtmlN').textContent = h.trim() ? `${N(CMS.words(h))} words · ${(h.match(/<h1\b/gi) || []).length} h1 · ${(h.match(/<h2\b/gi) || []).length} h2 · ${(h.match(/<img\b/gi) || []).length} img${/id="disclaimer"/.test(h) ? ' · disclaimer block' : ''}` : '';
      const s = cEl('Schema').value.trim(); const sn = cEl('SchemaN'); if (!s) { sn.textContent = ''; sn.className = 'pb-count'; } else { try { const j = JSON.parse(s); const n = Array.isArray(j) ? j.length : (j['@graph'] ? j['@graph'].length : 1); const types = (Array.isArray(j) ? j : j['@graph'] || [j]).map(x => x && x['@type']).filter(Boolean).join(', '); sn.textContent = `valid · ${n} node${n === 1 ? '' : 's'}${types ? ' · ' + types : ''}`; sn.className = 'pb-count pb-ok'; } catch (e) { sn.textContent = 'not valid JSON: ' + e.message.replace(/^JSON\.parse:?\s*/i, ''); sn.className = 'pb-count pb-red'; } }
    }
    function renderFirmLine() {
      const F = firmInfo(); const host = cEl('Firm'); if (!host) return;
      host.innerHTML = `<span class="pb-lab">From the firm profile</span> ${[`<b>${esc(F.name)}</b>`, esc(F.phone), `Responsible attorney <b>${esc(F.atty)}</b>`, `Primary office <b>${esc(F.city)}</b>`].join(' · ')}${F.missing.length ? ` <span class="pb-red">Missing: ${esc(F.missing.join(', '))}</span> <button type="button" class="btn sm" id="pbcFirmBtn">Set up the firm</button>` : ''}<div class="small">The starter template, the disclaimer block and the firm JSON-LD are written from these. A page is screened against them, so change the profile first, then insert the template.</div>`;
      const b = $('#pbcFirmBtn', host); if (b) b.onclick = () => FIRM.panel();
    }
    const linksOf = html => { const out = []; const re = /<a\b[^>]*href=(["'])([^"'#][^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi; let m; let dom = ''; try { dom = new URL(FIRM.get().url).host.toLowerCase(); } catch (e) { dom = ''; } while ((m = re.exec(html))) { const u = m[2]; if (/^\/(?!\/)/.test(u) || (dom && u.toLowerCase().includes(dom))) out.push({ anchor: CMS.stripTags(m[3]), url: u }); } return out; };
    function composerChecks(p) {
      const issues = []; const push = (sev, id, msg) => issues.push({ sev, id, msg, where: 'composer' });
      if (!/<h1\b/i.test(p.html)) push('warn', 'h1', 'No h1 in the body'); if ((p.html.match(/<h1\b/gi) || []).length > 1) push('warn', 'h1', 'More than one h1');
      if (!p.meta_description) push('warn', 'meta', 'No meta description'); else if (p.meta_description.length > 160) push('warn', 'meta', 'Meta description over 160 characters'); else if (p.meta_description.length < 70) push('warn', 'meta', 'Meta description under 70 characters');
      if (p.title.length > 60) push('warn', 'title', 'Title over 60 characters'); if (CMS.words(p.html) < 120) push('warn', 'thin', 'Under 120 words');
      if (/<(iframe|object|embed)\b/i.test(p.html)) push('warn', 'embed', 'Embeds are stripped by some platforms (Webflow, Wix)');
      if (!/id="disclaimer"/.test(p.html)) push('warn', 'disclaimer', 'No disclaimer block (the screen still checks for the responsible lawyer and the primary office)');
      return { block: issues.filter(i => i.sev === 'block').length, warn: issues.filter(i => i.sev === 'warn').length, note: 0, issues };
    }
    function cAdd() {
      cRead(); const clean = cd.clean !== false && typeof LINT !== 'undefined' && typeof LINT.house === 'function' ? s => LINT.house(s) : s => s;
      const title = clean(cd.title.trim()); if (!title) { toast('Give the page a title'); cEl('Title').focus(); return; }
      if (!cd.html.trim()) { toast('The HTML body is empty; insert the starter template or paste your markup'); cEl('Html').focus(); return; }
      let schema = null; if (cd.schema.trim()) { try { schema = JSON.parse(cd.schema); } catch (e) { toast('The JSON-LD is not valid JSON: ' + e.message); cEl('Schema').focus(); return; } }
      const html = CMS.stripScripts(cd.html.trim()); const h1m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      const page = CMS.pageFromHtml({ title, h1: h1m ? CMS.stripTags(h1m[1]) : title, slug: cd.slug.trim() || title, meta_description: clean(cd.meta.trim()), summary: clean(cd.meta.trim()), language: cd.lang, post_type: cd.type, html, schema, noindex: cd.noindex, brand: FIRM.get().colors, links: linksOf(html) });
      page.kind = 'composer'; page.label = 'Composer'; page.checks = composerChecks(page); page.words = CMS.words(html);
      addPages([page], 'composer'); const r = scrOf(page); store.set(CK, cd);
      toast(r.pass ? `Added /${page.slug}/ to the list; the screen is clear` : `Added /${page.slug}/; the screen holds it back (${plural(r.counts.block, 'blocking finding')})`);
    }
    cWrite(); renderFirmLine();
    ['Title', 'Slug', 'Meta', 'Html', 'Schema'].forEach(k => cEl(k).addEventListener('input', () => { if (k === 'Title' && !cd.slugManual) cEl('Slug').value = CMS.slug(cEl('Title').value); if (k === 'Slug') cd.slugManual = !!cEl('Slug').value.trim(); cRead(); cCount(); cSave(); }));
    ['Lang', 'Type', 'Noindex', 'Clean'].forEach(k => cEl(k).addEventListener('change', () => { cRead(); cSave(); }));
    cEl('Add').onclick = cAdd;
    cEl('Tmpl').onclick = () => {
      const ta = cEl('Html'); const b = cEl('Tmpl');
      if (ta.value.trim() && !armed(b, 'composer:tmpl', 'Insert the starter template', 'Click again to replace the body')) return;
      cRead(); ta.value = starter(cEl('Title').value.trim(), cEl('Lang').value);
      const sc = cEl('Schema'); if (!sc.value.trim()) sc.value = JSON.stringify(firmSchema(cEl('Title').value.trim(), cEl('Meta').value.trim(), cEl('Lang').value, cEl('Slug').value.trim()), null, 2);
      cRead(); cCount(); cSave(); toast('Starter template inserted, written from the firm profile'); ta.focus();
    };
    cEl('Ld').onclick = () => {
      const sc = cEl('Schema'); const next = JSON.stringify(firmSchema(cEl('Title').value.trim(), cEl('Meta').value.trim(), cEl('Lang').value, cEl('Slug').value.trim()), null, 2);
      if (sc.value.trim() && sc.value.trim() !== next && !armed(cEl('Ld'), 'composer:ld', 'Firm JSON-LD', 'Click again to replace the JSON-LD')) return;
      sc.value = next; cRead(); cCount(); cSave(); toast('LegalService JSON-LD written from the firm profile');
    };
    cEl('Disc').onclick = () => { const ta = cEl('Html'); if (/id="disclaimer"/.test(ta.value)) { toast('The body already has a disclaimer block; edit it there'); return; } ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '\n') + disclaimerHtml(cEl('Lang').value) : disclaimerHtml(cEl('Lang').value); cRead(); cCount(); cSave(); toast('Disclaimer block appended'); };
    cEl('Clear').onclick = () => { if (!armed(cEl('Clear'), 'composer:clear', 'Clear the draft')) return; Object.assign(cd, { title: '', slug: '', slugManual: false, meta: '', html: '', schema: '', noindex: false }); cWrite(); store.set(CK, cd); toast('Draft cleared'); };
    /* ---------- import ---------- */
    function mediaFromBp(bp) { const out = {}; for (const [k, spec] of Object.entries((bp && bp.media) || {})) { if (!spec) continue; const src = spec.source || ''; const base = { id: 0, url: '', alt: spec.alt || '', kind: spec.kind || 'image' }; if (/^https?:/.test(src)) out[k] = Object.assign(base, { url: src }); else if (src.startsWith('library:')) out[k] = Object.assign(base, { library: src.slice(8) }); else if (src.startsWith('assets/')) out[k] = Object.assign(base, { missing: src }); else if (spec.url) out[k] = Object.assign(base, { url: spec.url }); } return out; }
    function fromJson(o, name, depth) {
      depth = depth || 0; if (depth > 3) return []; if (Array.isArray(o)) return o.flatMap(x => fromJson(x, name, depth + 1)); if (!o || typeof o !== 'object') return [];
      if (o.content_html != null || (o.elementor_data && o.slug)) { const p = CMS.pageFromBundle(o); p.kind = 'bundle'; p.label = name; p.links = (((o.blueprint || {}).page || {}).internal_links) || []; p.words = CMS.words(p.html); return [p]; }
      if (o.page && Array.isArray(o.sections)) { if (typeof FORGE_COMPILE === 'undefined') throw new Error('the blueprint compiler is not loaded'); const r = FORGE_COMPILE.compile(o, {}); const p = (FORGE_COMPILE.pageFor || CMS.pageFromForge)(FORGE_COMPILE.pageFor ? o : (r.portable || o), r, mediaFromBp(o), { label: name, kind: 'blueprint' }); p.checks = checksFromLint(r.lint || []); p.words = CMS.words(p.html); return [p]; }
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
      const main = doc.querySelector('main') || doc.body; const html = CMS.stripScripts((main ? main.innerHTML : '').trim()); if (!html) throw new Error('no body markup found');
      const h1 = main && main.querySelector('h1') ? main.querySelector('h1').textContent.trim() : title;
      const seg = canonical ? pathOf(canonical).split('/').filter(Boolean).pop() : ''; const schema = ld.length === 1 ? ld[0] : ld.length > 1 ? { '@context': 'https://schema.org', '@graph': ld.flatMap(x => Array.isArray(x['@graph']) ? x['@graph'] : [x]) } : null;
      const p = CMS.pageFromHtml({ title, h1, slug: seg || stem, meta_description: desc, summary: desc, language: lang, html, css: css || undefined, schema, noindex, canonical, links: linksOf(html) });
      p.kind = 'html'; p.label = name; p.words = CMS.words(html); return p;
    }
    async function importFiles(files) {
      const logEl = $('#pbiLog', root); const lines = []; let added = 0;
      for (const f of Array.from(files || [])) {
        try {
          const text = await readText(f); const name = f.name || 'file'; let pages;
          if (/\.json$/i.test(name) || /^\s*[\[{]/.test(text)) pages = fromJson(JSON.parse(text), name); else pages = [fromHtmlDoc(text, name)];
          pages = pages.filter(Boolean); if (!pages.length) throw new Error('nothing recognisable: expected a Site Forge bundle, a blueprint, an array of either, or an HTML document');
          added += addPages(pages, 'import'); const held = pages.filter(p => !scrOf(p).pass).length;
          lines.push(`${name}: ${plural(pages.length, 'page')} (${pages.map(p => '/' + p.slug + '/').join(', ')})${held ? `, ${N(held)} held back by the screen` : ''}`);
        } catch (e) { lines.push(`${f.name}: ${e.message}`); }
      }
      st.ilog = (lines.length ? lines.map(l => `${hhmm()} ${l}`) : [`${hhmm()} no files`]).concat(st.ilog || []).slice(0, 12);
      logEl.hidden = false; logEl.textContent = st.ilog.join('\n'); toast(added ? `${plural(added, 'page')} imported` : 'Nothing imported');
    }
    const drop = $('#pbiDrop', root), file = $('#pbiFile', root);
    $('#pbiPick', root).onclick = () => file.click();
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); importFiles(e.dataTransfer.files); };
    file.onchange = e => { importFiles(e.target.files); e.target.value = ''; };
    /* ---------- deploy ---------- */
    function slog(msg, reset) { const line = `${hhmm()}  ${modFix(msg)}`; st.log = reset ? [line] : st.log.concat(line).slice(-400); const h = $('#pbStatus', root); h.textContent = st.log.join('\n'); h.scrollTop = h.scrollHeight; }
    function updateGo() {
      const b = $('#pbGo', root); const t = T(); const sel = st.pages.filter(p => st.selected.has(p.slug)); const n = sel.length; const held = sel.filter(heldBy).length; if (st.running) return;
      if (!st.confirm.live) b.textContent = t ? `Deploy ${N(n)} selected to ${t.name}` : 'Deploy';
      const note = $('#pbGoNote', root);
      note.textContent = !t ? 'Choose a target first.' : !n ? 'Tick at least one page.' : [held ? `${N(held)} of ${N(n)} held back by the screen.` : '', $('#pbLive', root).checked ? 'Live: the button asks for a second click.' : 'As drafts.'].filter(Boolean).join(' ');
    }
    async function deploy() {
      const ad = T(); if (!ad) { toast('Choose a target first'); slog('Choose a target first: tick Use as target on a card or pick one in the Target list.'); return; }
      const pages = st.pages.filter(p => st.selected.has(p.slug)); if (!pages.length) { toast('Tick at least one page'); return; }
      if (CMS.status(ad.id).state === 'unconfigured') { toast(`${ad.name} is not configured: fill in its card and Save`); slog(`${ad.name} is not configured: fill in its card and Save before deploying.`); return; }
      const cardEl = $(`.pb-card[data-id="${ad.id}"]`, root); if (cardEl) await CMS.setCfg(ad.id, readFields(cardEl));   /* unsaved edits on the target card count */
      pages.forEach(screenPage);   /* screened again: the firm profile or the copy may have changed since the page landed */
      const held = pages.filter(heldBy); const send = pages.filter(p => !heldBy(p)); const heldSet = new Set(held.map(p => p.slug));
      const live = $('#pbLive', root).checked; const b = $('#pbGo', root);
      if (!send.length) {
        st.confirm.live = false; st.results = held.map(p => ({ page: p, ok: false, held: true })); renderResults(); renderPages(); tiles(); updateGo();
        slog(`Nothing sent: ${plural(held.length, 'selected page is', 'selected pages are')} held back by the compliance screen. Open Screen on a row to see the findings; fix the copy or the firm profile, or tick Send anyway on the row.`, true);
        toast('Every selected page is held back by the screen'); return;
      }
      if (live && !st.confirm.live) { st.confirm.live = true; b.textContent = `Click again to publish ${N(send.length)} live on ${ad.name}${held.length ? ` (${N(held.length)} held)` : ''}`; setTimeout(() => { if (st.confirm.live) { st.confirm.live = false; updateGo(); } }, 6000); return; }
      st.confirm.live = false;
      const notes = []; const mh = mediaHostFor(ad, notes); const onlyNew = $('#pbOnlyNew', root).checked, requireMedia = $('#pbReqMedia', root).checked;
      st.ctl = new AbortController(); st.running = true; b.disabled = true; b.textContent = 'Deploying…'; $('#pbStop', root).disabled = false; $('#pbSiteGo', root).hidden = true; st.results = []; renderResults();
      slog(`Deploying ${plural(send.length, 'page')} to ${ad.name} as ${live ? 'published' : 'drafts'}${onlyNew ? ', skipping pages already sent' : ''}${requireMedia ? ', every image required' : ''}${mh ? `, media through ${CMS.get(mh).name}` : ''}.`, true);
      if (held.length) slog(`Held back by the compliance screen: ${held.map(p => `/${p.slug}/ (${scrOf(p).findings.filter(f => f.sev === 'block').map(f => f.title).join('; ')})`).join(', ')}.`);
      send.filter(p => !scrOf(p).pass).forEach(p => slog(`/${p.slug}/ goes out on Send anyway with ${plural(scrOf(p).counts.block, 'blocking finding')}; the ledger records the override.`));
      notes.forEach(m => slog(m));
      if (!(ad.caps || {}).media && !mh && send.some(hasLocal)) slog(`${ad.name} cannot host uploads and no media host is set: local photos will be reported as unresolved. Pick a media host above.`);
      let res = [];
      try {
        await grant(ad); if (mh) await grant(CMS.get(mh));
        res = await CMS.deploy(ad.id, send, { publish: live, onlyNew, requireMedia, mediaHost: mh || undefined, log: m => slog(m), signal: st.ctl.signal });
        for (const r of res) { if (r.skipped) continue; const rec = CMS.deployedFor(ad.id)[r.page.slug]; if (rec) await CMS.markDeployed(ad.id, r.page.slug, Object.assign({}, rec, { lint: lintLabel(scrOf(r.page), st.override.has(r.page.slug)) })); }
        const ok = res.filter(r => r.ok && !r.skipped).length, sk = res.filter(r => r.skipped).length, bad = res.filter(r => !r.ok).length; const stopped = st.ctl.signal.aborted;
        slog(`Done: ${N(ok)} sent, ${N(sk)} skipped, ${N(bad)} failed, ${N(held.length)} held${stopped ? ' (stopped early)' : ''}.`); toast(`${ad.name}: ${N(ok)} sent, ${N(bad)} failed${held.length ? `, ${N(held.length)} held` : ''}`);
        if (live && res.some(r => r.ok && !r.skipped && isHome(r.page))) slog('The homepage went live: file it with the State Bar Advertising Review Committee within ten days of first dissemination (Rule 7.04). Other website pages are exempt from filing (Rule 7.05).');
        if ((ad.caps || {}).publishSite && typeof ad.publishSite === 'function' && ok) { $('#pbSiteGo', root).hidden = false; slog(`${ad.name} publishes at site level: click Publish site now when the pages look right.`); }
      } catch (e) { slog('ERROR ' + errText(e)); toast(modFix(e.message || String(e))); }
      finally {
        st.results = pages.map(p => heldSet.has(p.slug) ? { page: p, ok: false, held: true } : res.find(r => r.page.slug === p.slug)).filter(Boolean);
        st.running = false; st.ctl = null; b.disabled = false; $('#pbStop', root).disabled = true; renderResults(); renderPages(); renderLedger(); tiles(); pills(); updateGo();
      }
    }
    function renderResults() {
      const host = $('#pbResults', root); if (!st.results.length) { host.innerHTML = ''; return; }
      const none = '<span class="small">none</span>';
      host.innerHTML = `<div class="tblwrap pb-tbl"><table class="t"><thead><tr><th class="l">Page</th><th class="l">Screen</th><th class="l">Status</th><th class="l">Link</th><th class="l">Edit</th><th class="l">Notes</th></tr></thead><tbody>${st.results.map(r => {
        const res = r.res || {}; const sc = scrOf(r.page); const ovr = st.override.has(r.page.slug);
        const status = r.held ? 'held' : r.skipped ? 'skipped' : r.ok ? (res.status || 'sent') : 'error'; const cls = r.held || !r.ok ? 'bad' : r.skipped ? '' : status === 'publish' ? 'good' : 'info';
        const notes = r.held ? `Held back by the compliance screen: ${sc.findings.filter(f => f.sev === 'block').map(f => `${f.title} (${f.rule})`).join('; ')}. Fix it, or tick Send anyway on the page row.` : [r.error ? errText(r.error) : '', res.notes || '', ...(r.notes || [])].filter(Boolean).map(modFix).join(' · ');
        return `<tr data-slug="${esc(r.page.slug)}"><td class="l pb-wrap">${esc(r.page.title)}<div class="small">/${esc(r.page.slug)}/</div></td><td class="l">${lintPill(sc, ovr)}${extraOf(sc.counts) ? `<div class="small">${esc(extraOf(sc.counts))}</div>` : ''}</td><td class="l">${pill(status, cls)}${r.ok && !r.skipped ? `<div class="small">${res.updated ? 'updated' : 'created'}</div>` : ''}</td><td class="l">${res.link ? `<a href="${esc(res.link)}" target="_blank" rel="noopener" title="${esc(res.link)}">${esc(shortUrl(res.link))}</a>` : none}</td><td class="l">${res.edit ? `<a href="${esc(res.edit)}" target="_blank" rel="noopener">edit</a>` : none}</td><td class="l pb-wrap small">${esc(notes) || 'none'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    }
    async function publishSiteNow() {
      const ad = T(); const b = $('#pbSiteGo', root); if (!ad || typeof ad.publishSite !== 'function') { toast('The target has no site level publish'); return; }
      if (CMS.status(ad.id).state === 'unconfigured') { toast(`${ad.name} is not configured`); return; }
      b.disabled = true; try { await grant(ad); slog(`Publishing the site on ${ad.name}…`); const r = await ad.publishSite(CMS.cfg(ad.id), ctxFor()); slog((r && r.info) || 'Site published.'); toast(`${ad.name}: site published`); } catch (e) { slog('Site publish failed: ' + errText(e)); toast(modFix(e.message || String(e))); } finally { b.disabled = false; }
    }
    async function verifyLinks() {
      const ad = T(); if (!ad) { toast('Choose a target first'); return; } const b = $('#pbVerify', root);
      if (typeof ad.listUrls !== 'function') { slog(`${ad.name} cannot list its live URLs (no listUrls in the adapter); check the internal links by hand.`); return; }
      if (CMS.status(ad.id).state === 'unconfigured') { slog(`${ad.name} is not configured: fill in its card and Save before checking links.`); toast(`${ad.name} is not configured`); return; }
      const sel = st.pages.filter(p => st.selected.has(p.slug)); const use = sel.length ? sel : st.pages; if (!use.length) { toast('Load some pages first'); return; }
      b.disabled = true;
      try {
        await grant(ad); slog(`Reading the live URLs on ${ad.name}…`); const urls = await ad.listUrls(CMS.cfg(ad.id), ctxFor()); const live = new Set((urls || []).map(pathOf)); let tot = 0, bad = 0; const missing = [];
        use.forEach(p => (p.links || []).forEach(l => { if (!l || !l.url) return; tot++; if (!live.has(pathOf(l.url))) { bad++; if (missing.length < 15) missing.push(`/${p.slug}/ → ${l.url}`); } }));
        slog(`Live URLs on ${ad.name}: ${N(live.size)}. Internal links on ${plural(use.length, 'page')}: ${N(tot)}; not live: ${N(bad)}.${missing.length ? '\n  ' + missing.join('\n  ') + (bad > missing.length ? `\n  and ${N(bad - missing.length)} more` : '') : ''}${bad ? '\nPublish the missing pages first, or refresh the live list in the Site Forge and rebuild so the links only point at live pages.' : ''}`);
        toast(bad ? `${plural(bad, 'link')} not live` : 'Every internal link is live');
      } catch (e) { slog('Link check failed: ' + errText(e)); toast(modFix(e.message || String(e))); } finally { b.disabled = false; }
    }
    /* ---------- ledger ---------- */
    const ledgerRows = id => Object.entries(CMS.deployedFor(id)).map(([s, r]) => Object.assign({ slug: s }, r || {})).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    function renderLedger() {
      const host = $('#pbLedgerT', root); const t = T(); if (!t) { host.innerHTML = '<p class="small pb-empty">Choose a target to see what was sent to it.</p>'; return; }
      const rows = ledgerRows(t.id); if (!rows.length) { host.innerHTML = `<p class="small pb-empty">Nothing sent to ${esc(t.name)} yet.</p>`; return; }
      const none = '<span class="small">none</span>';
      host.innerHTML = `<div class="tblwrap pb-tbl pb-short"><table class="t"><thead><tr><th class="l">Slug</th><th class="l">Title</th><th class="l">Status</th><th class="l">Screen</th><th class="l">Link</th><th class="l">Time</th><th class="l">Notes</th></tr></thead><tbody>${rows.map(r => `<tr data-slug="${esc(r.slug)}"><td class="l"><code>/${esc(r.slug)}/</code></td><td class="l pb-wrap">${esc(r.title || '')}</td><td class="l">${pill(r.ok === false ? 'error' : (r.status || 'draft'), r.ok === false ? 'bad' : r.status === 'publish' ? 'good' : 'info')}${r.updated ? '<div class="small">updated</div>' : ''}</td><td class="l small">${esc(r.lint || 'n/a')}</td><td class="l">${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener" title="${esc(r.link)}">${esc(shortUrl(r.link))}</a>` : none}${r.edit ? ` · <a href="${esc(r.edit)}" target="_blank" rel="noopener">edit</a>` : ''}</td><td class="l small">${esc(when(r.at))}</td><td class="l pb-wrap small">${esc(modFix([r.error || '', r.notes || ''].filter(Boolean).join(' · '))) || 'none'}</td></tr>`).join('')}</tbody></table></div>`;
    }
    function ledgerCSV(ids) { const header = ['target', 'slug', 'title', 'status', 'ok', 'screen', 'link', 'edit', 'id', 'time', 'notes', 'error']; const rows = []; ids.forEach(id => ledgerRows(id).forEach(r => rows.push([CMS.get(id) ? CMS.get(id).name : id, r.slug, r.title || '', r.ok === false ? 'error' : (r.status || ''), r.ok === false ? 'no' : 'yes', r.lint || '', r.link || '', r.edit || '', r.id == null ? '' : r.id, r.at || '', r.notes || '', r.error || '']))); return toCSV(header, rows, `Severance publish ledger (sv.cms.v1), ${plural(ids.length, 'target')}, exported ${new Date().toISOString()}`); }
    /* ---------- method, judgment calls, sources ---------- */
    $('#pbMeth', root).innerHTML = [
      '<b>One portable page.</b> Whatever wrote it, a page arrives here as title, slug, meta description, language, section markup with a scoped forge stylesheet, a JSON-LD graph, media slots and internal links. The Site Forge hands its pages over with the photos assigned there; the composer and the import build the same shape.',
      '<b>Screened before it leaves.</b> The title, the meta description and the body text go through the compliance engine as a page (LINT.screen with kind page): outcome guarantees, special competence claims outside the Texas Board of Legal Specialization form, contingent fees in a family matter, past results, the family law myths, stale numbers, unfilled placeholders, the house style, and the Rule 7.02(a) check that the responsible lawyer and the primary practice location appear on the page. A blocking finding holds the page back; Send anyway on its row is the explicit override, and the ledger records it.',
      '<b>One adapter per platform.</b> WordPress gets the compiled Elementor JSON through the FORGE bridge (with SEO fields and JSON-LD in the head); the headless route stores the blueprint on the same site and points the canonical at the Next.js front end. Everyone else receives HTML with the scoped css inline, JSON-LD in the head where the platform has a head slot (WordPress, Ghost, HubSpot) and inline in the body otherwise (Drupal, Joomla, Shopify, Duda); Wix and Webflow keep it in a text field of the item when one is configured.',
      '<b>Slug first.</b> Before writing, every adapter looks the slug up in its own model (WordPress slug, Drupal path alias, Shopify handle, Webflow item slug, Ghost slug, Joomla alias, HubSpot slug, Wix item field, Duda page path) and updates what it finds; otherwise it creates. The ledger records id, link, edit link, status and screen result per target so a second run is an update, and Skip pages already sent reads it.',
      '<b>Media before markup.</b> A local photo (a file added in the Site Forge, or a data URL) is uploaded through the target, or through the media host when the target cannot hold files (Duda, the Wix blog). A library slot is searched by name on the target. The URLs are rewritten in the markup, the JSON-LD and the og:image; a slot that stays unresolved is dropped, or stops the run when Require every image is on.',
      '<b>Drafts by default.</b> Nothing goes live unless Publish live is ticked and confirmed with a second click. Site builders that publish at site level (Duda, Webflow) get a separate Publish site now step after the run.',
      '<b>Site access.</b> Inside the Severance extension the browser asks once for permission to reach each of the firm\'s own sites (WordPress, Drupal, Joomla, Ghost) on the first Test or Deploy; the hosted platform APIs are permitted in the manifest. Opened from disk or inside the viewer, the browser blocks most of these calls (CORS), so the pages pack carries everything to paste or upload by hand. Credentials live in this browser (sv.cms.v1) and never leave this machine.',
    ].map(x => `<li>${x}</li>`).join('');
    $('#pbJudg', root).innerHTML = [
      ['The screen is a floor, not a review', 'The compliance engine matches patterns. It catches a guarantee, a specialist claim, a contingent fee offer, a myth or a missing responsible lawyer; it cannot tell whether a true sounding statement is true for this firm, whether a result is typical, or whether a testimonial was paid. The responsible lawyer reads every page before it goes live.'],
      ['Send anyway is per page and on the record', 'An override is ticked on one page at a time, is not saved between sessions, is cleared when the page is loaded again, and is written into the ledger next to the deploy. It exists for the finding that is wrong about this page (a quoted statute, a name that trips a rule), not for copy that needs fixing.'],
      ['The homepage is the one page to file', 'Website content other than the homepage is exempt from filing (Rule 7.05). The homepage is not: file it with the Advertising Review Committee within ten days of first dissemination, or seek pre approval thirty days ahead (Rule 7.04). The log says so when a page named home goes live.'],
      ['Site builders take content, not pages', 'Wix, Webflow and Duda have no endpoint that takes an arbitrary HTML page. Wix data items feed a dynamic page you design once; Webflow items render through a collection template page; Duda injects the markup into a template page you build with a data inject element. That is where the platform keeps its own header, footer and navigation, so the pages look native, and where the disclaimer block must survive: check it on the template.'],
      ['Wix and Webflow strip scripts', 'Rich text fields keep headings, paragraphs, lists, links and images and drop scripts and embeds. The JSON-LD goes into a plain text field when the collection has one, otherwise it is left out and the result says so.'],
      ['Duda content injection is marked deprecated', 'Duda\'s developer docs steer new work to the snippets API, connected data and the content library while keeping content injection available. The adapter uses injection because it is the only route that takes a whole page; watch the result notes and switch modes if Duda removes it.'],
      ['Shopify and HubSpot', 'Shopify pages are Online Store pages that render inside the theme\'s page template (a template suffix gives them their own layout). On HubSpot, site pages depend on a template the account owns; blog posts take HTML and metadata directly, so the adapter defaults to posts and offers pages as an option.'],
      ['Credentials in this browser', 'Application passwords, API keys and tokens are stored in this browser profile (extension storage, or localStorage outside it, under sv.cms.v1) so the next session can publish without retyping. Forget credentials on each card removes them; anyone with this profile can read them until then.'],
      ['Publishing live is the lawyer\'s call', 'The atlas can screen, preview and send, but it cannot read the site\'s navigation, redirects or launch calendar. Drafts are the default; the second click on Publish live is the point where a person takes over.'],
      ['Pages are not saved between sessions', 'A loaded page carries photo blobs and can be large, so the module keeps only the slugs it saw. Load again from the Site Forge or the file; the ledger, the credentials and the composer draft do persist.'],
    ].map(([t, x]) => `<div><b>${esc(t)}</b><p>${esc(x)}</p></div>`).join('');
    const shopifyVersion = () => { const a = CMS.get('shopify'); try { return (a && typeof a.version === 'function' && a.version()) || '2026-07'; } catch (e) { return '2026-07'; } };
    const SRC = [
      ['Texas Disciplinary Rules of Professional Conduct, Part VII', 'Rules 7.01 to 7.06: misleading communications, the responsible lawyer and primary practice location, specialization, filing with the Advertising Review Committee and the exemptions', 'A', 'State Bar of Texas', 'https://www.texasbar.com/'],
      ['schema.org LegalService', 'The type the firm JSON-LD uses, with the lawyer as an employee and the WebPage about it', 'A', '', 'https://schema.org/LegalService'],
      ['WordPress REST API, authentication', 'Application Passwords over Basic auth (WordPress 5.6+)', 'A', 'wp/v2', 'https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/'],
      ['Elementor developers, library import', 'The template JSON format the FORGE bridge writes', 'B', '', 'https://developers.elementor.com/docs/cli/library-import'],
      ['Drupal JSON:API module', 'Creating resources (POST), core in Drupal 10 and 11', 'A', 'JSON:API 1.0', 'https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/creating-new-resources-post'],
      ['Wix REST, Data Items API', 'Insert and save data items in a CMS collection', 'A', 'v2', 'https://dev.wix.com/docs/rest/business-solutions/cms/data-items/insert-data-item'],
      ['Duda API, content injection', 'Inject innerHTML into a data inject element (marked deprecated in favour of snippets)', 'B', '', 'https://developer.duda.co/docs/content-injection-1'],
      ['Webflow Data API, collection items', 'Create staged items; drafts by default since December 2024', 'A', 'v2', 'https://developers.webflow.com/data/reference/cms/collection-items/staged-items/create-items'],
      ['Shopify GraphQL Admin API', 'pageCreate and pageUpdate; write_content or write_online_store_pages', 'A', shopifyVersion(), 'https://shopify.dev/docs/api/admin-graphql/latest/mutations/pageCreate'],
      ['HubSpot CMS API, blog posts', 'Create, update and publish posts with a private app token', 'A', 'v3', 'https://developers.hubspot.com/docs/api-reference/cms-posts-v3/basic/get-cms-v3-blogs-posts'],
      ['Joomla Web Services', 'api/index.php/v1/content/articles with a user API token', 'A', 'v1', 'https://manual.joomla.org/docs/general-concepts/webservices/'],
      ['Ghost Admin API', 'Pages and posts with a short lived JWT signed from the integration key', 'A', 'v5', 'https://docs.ghost.org/admin-api'],
      ['Chrome extensions, permissions API', 'optional_host_permissions and permissions.request at runtime', 'A', 'MV3', 'https://developer.chrome.com/docs/extensions/reference/api/permissions'],
    ];
    function renderSources() {
      const extra = A().filter(a => a.docs && !SRC.some(s => s[4] === a.docs)).map(a => [`${a.name} adapter docs`, modFix(a.blurb || ''), 'A', '', a.docs]);
      $('#pbSrc', root).innerHTML = SRC.concat(extra).map(([t, d, g, v, u]) => `<li><b>${esc(t)}</b>${v ? ` <span class="small">${esc(v)}</span>` : ''} <span class="grade ${esc(g)}">${esc(g)}</span><br><span class="small">${esc(d)}.</span> <a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https:\/\//, ''))}</a></li>`).join('');
    }
    /* ---------- wiring ---------- */
    wireSeg($('#pbTabs', root), v => { st.tab = v; ['Forge', 'Composer', 'Import'].forEach(k => { $('#pbPane' + k, root).hidden = k.toLowerCase() !== v; }); if (v === 'composer') renderFirmLine(); });
    $('#pbfLoad', root).onclick = loadForge;
    $('#pbSelAll', root).onclick = () => selectWhere(() => true);
    $('#pbSelNone', root).onclick = () => selectWhere(() => false);
    $('#pbSelUnsent', root).onclick = () => { const led = T() ? CMS.deployedFor(T().id) : {}; selectWhere(p => !(led[p.slug] && led[p.slug].ok !== false && led[p.slug].id)); };
    $('#pbSelClear', root).onclick = () => selectWhere(p => scrOf(p).pass);
    $('#pbClearPages', root).onclick = () => { if (!st.pages.length) return; if (!armed($('#pbClearPages', root), 'pages:clear', 'Remove all')) return; st.pages = []; st.selected.clear(); st.override.clear(); st.scr.clear(); closePreview(); closeScreen(); persistLoaded(); renderPages(); tiles(); updateGo(); toast('List cleared'); };
    $('#pbTarget', root).onchange = e => setTarget(e.target.value);
    $('#pbMedia', root).onchange = e => { CMS.setSettings({ mediaHost: e.target.value }); toast(e.target.value ? `Media host: ${CMS.get(e.target.value).name}` : 'Media host: the target itself'); };
    $('#pbGo', root).onclick = deploy;
    $('#pbStop', root).onclick = () => { if (st.ctl) { st.ctl.abort(); slog('Stop requested; the page in flight finishes, the rest are left.'); $('#pbStop', root).disabled = true; } };
    $('#pbVerify', root).onclick = verifyLinks;
    $('#pbSiteGo', root).onclick = publishSiteNow;
    $('#pbLive', root).onchange = () => { st.confirm.live = false; updateGo(); };
    $('#pbLedCsv', root).onclick = () => { const t = T(); if (!t) { toast('Choose a target first'); return; } saveFile(`publish-ledger_${t.id}.csv`, ledgerCSV([t.id])); };
    $('#pbPack', root).onclick = pagesPack;
    $('#pbBridge', root).onclick = bridgeZip;
    $('#pbKit', root).onclick = kitZip;
    $('#pbLedger', root).onclick = () => { const ids = A().map(a => a.id).filter(id => Object.keys(CMS.deployedFor(id)).length); if (!ids.length) { toast('Nothing in the ledger yet'); return; } saveFile('publish-ledger.csv', ledgerCSV(ids)); };
    $('#pbForge', root).onclick = () => { if (!MODI.forge) { toast('Module 21, the Site Forge, is not loaded in this build'); return; } goModule('forge'); };
    /* ---------- hooks ---------- */
    this.receive = p => { if (!p) return; if (Array.isArray(p.pages) && p.pages.length) { const n = addPages(p.pages, p.source || 'handoff'); toast(`${plural(n, 'page')} received`); } if (p.target && CMS.get(p.target)) setTarget(p.target); };
    this.onShow = () => { pills(); tiles(); renderFirmLine(); renderFirmCallout(); $('#pbfNote', root).textContent = $('#pbfNote', root).textContent || forgeState(); };
    this.pages = () => st.pages.slice();
    this.screen = s => { const p = st.pages.find(x => x.slug === s); return p ? scrOf(p) : null; };
    /* the firm profile changes what every page screens as: screen again. One BUS listener for the life of the page; each mount swaps the handler */
    self._pbFirm = () => { st.pages.forEach(screenPage); renderPages(); tiles(); updateGo(); renderFirmLine(); renderFirmCallout(); if (st.screenSlug) showScreen(st.screenSlug, true); if (st.results.length) renderResults(); };
    if (!self._pbBus) { self._pbBus = true; BUS.on('firm', d => { if (typeof self._pbFirm === 'function') self._pbFirm(d); }); }
    /* ---------- boot ---------- */
    function renderAll() { env(); renderFirmCallout(); renderTargets(); renderPages(); renderLedger(); renderSources(); tiles(); updateGo(); cCount(); }
    $('#pbfNote', root).textContent = forgeState();
    renderAll();
    CMS.ready().then(() => { const S = CMS.settings(); st.target = S.target && CMS.get(S.target) ? S.target : ''; renderAll(); }).catch(e => { toast('CMS storage did not load: ' + e.message); });
  }
});
