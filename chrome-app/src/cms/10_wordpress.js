/* ==== cms_wordpress ==== */
"use strict";
/* ============================ WordPress adapters: Elementor (FORGE bridge) and Headless (Next.js) ============================
   Two adapters share one set of helpers inside this IIFE. Both talk to the WordPress REST API with Basic auth and an
   Application Password (WordPress 5.6+, HTTPS or a local environment) and use the FORGE bridge plugin (forge/v1) when the
   site has it. wp_elementor imports through the bridge (Elementor data, SEO fields, JSON-LD printed in the head) and falls
   back to the plain wp/v2 route without it. wp_headless imports through the bridge only, points canonicals and links at the
   Next.js front end and registers the front end with the bridge (configure). No DOM, no app helpers: this file runs inside
   the extension page and inside the Node test harness. */
(() => {
  /* Core REST namespace. Verified: https://developer.wordpress.org/rest-api/reference/ (pages, posts, media, users) */
  const WP_NS = 'wp/v2';
  /* The FORGE bridge namespace (src/07_forge_bridge_raw.js, Forge_Bridge::NS). Routes: status, import, template, settings, media/find, urls, indexnow. */
  const FORGE_NS = 'forge/v1';
  const BRIDGE_VER = '1.1.0';          /* Forge_Bridge::VER these adapters were written against */
  const WP_MIN = '5.6';                /* Application Passwords: https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/ */
  const API = `WordPress REST ${WP_NS} · FORGE bridge ${FORGE_NS} (${BRIDGE_VER}) · Application Passwords (WP ${WP_MIN}+)`;
  const PER_PAGE = 100;                /* the collection maximum: https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/ */
  const MAX_PAGES = 50;                /* 5000 links per post type, the same ceiling as the bridge's urls route */
  const BRIDGE_TTL = 5 * 60 * 1000;    /* discovery cache: one GET /wp-json/ per site per deploy, test() always refreshes */
  const DOCS = 'https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/';
  const BRIDGE = new Map();            /* base url → {at, bridge, root, name, ns} */

  /* ---------- url, auth, small helpers ---------- */
  /* a pasted host without a scheme (www.example.com) is treated as https; every request and the host permission use the same origin */
  const withScheme = u => { u = String(u || '').trim(); return u && !/^https?:\/\//i.test(u) ? 'https://' + u : u; };
  const site = cfg => CMS.trimSlash(withScheme(cfg.url));
  const base = cfg => CMS.trimSlash(withScheme(cfg.apiBase || cfg.url));
  const rest = (cfg, path) => base(cfg) + '/wp-json/' + String(path || '').replace(/^\//, '');
  /* Spaces in a pasted Application Password are fine: WordPress strips non alphanumerics before checking it. */
  const auth = cfg => ({ Authorization: CMS.basicAuth(String(cfg.user || '').trim(), String(cfg.appPass || '').trim()) });
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const stemOf = f => String(f || '').split('/').pop().split('?')[0].replace(/\.[^.]+$/, '');
  const safeName = f => (String(f || '').split('/').pop().split('?')[0].replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '')) || 'upload.bin';
  const typeOf = (cfg, page) => ((page && page.post_type) || cfg.postType || 'page') === 'post' ? 'post' : 'page';
  const editLink = (cfg, id) => base(cfg) + '/wp-admin/post.php?post=' + id + '&action=edit';
  const statusOf = (page, opts) => ((opts && opts.publish) || (page && page.status === 'publish')) ? 'publish' : 'draft';
  const cleanSlug = s => String(s || '').replace(/^\/+|\/+$/g, '');

  /* ---------- error hints (the message already carries the provider's text; the hint says what to change) ---------- */
  function hintFor(e, path) {
    const code = e.body && typeof e.body === 'object' ? String(e.body.code || '') : ''; const onBridge = String(path || '').startsWith(FORGE_NS);
    if (e.status === 401) return 'Check the username and the Application Password (Users, Profile, Application Passwords; the site needs HTTPS). A security plugin or the host can block Basic auth on the REST API.';
    if (e.status === 403 && code === 'forge_caps') return 'Elementor data needs an administrator (the unfiltered_html capability). Sign in with an administrator account.';
    if (e.status === 403) return 'This user cannot edit pages here. Use an Editor or Administrator account and check that a security plugin is not blocking the REST API.';
    if (e.status === 404 && onBridge) return 'The FORGE bridge is not active on this site, or permalinks are set to Plain. Activate forge-bridge.zip (module 16 downloads it) and set Settings, Permalinks to Post name.';
    if (e.status === 404 && code === 'rest_no_route') return 'No REST route. Set Settings, Permalinks to Post name and check that nothing disables the REST API.';
    if (e.status === 404) return 'Not found. Enter the WordPress install URL (not the front end) and make sure permalinks are not Plain.';
    if (e.status === 413) return 'The file is larger than the upload limit (upload_max_filesize on the host).';
    if (e.status === 429) return 'The host or a security plugin rate limited the request (WordPress core does not). Wait a minute and deploy again.';
    if (e.status === 0) return 'Check the site URL and grant site access when the browser asks.';
    return '';
  }
  /* One JSON request against {base}/wp-json/{path}. Never swallows a non 2xx: the error gains a hint and is rethrown. */
  async function req(cfg, method, path, body, o) {
    o = o || {}; const headers = Object.assign(auth(cfg), o.headers || {});
    try { return await CMS.http(rest(cfg, path), { method, headers, body, raw: !!o.raw, expect: o.expect || 'json', timeout: o.timeout, tolerate: !!o.tolerate }); }
    catch (e) { if (!e.hint) e.hint = hintFor(e, path); if (!e.adapter) e.adapter = 'wordpress'; throw e; }
  }

  /* ---------- discovery: GET /wp-json/ (name, namespaces) and the bridge status ---------- */
  async function discover(cfg, ctx, fresh) {
    const key = base(cfg); const c = BRIDGE.get(key); if (!fresh && c && Date.now() - c.at < BRIDGE_TTL) return c;
    const r = await req(cfg, 'GET', '', undefined, { expect: 'auto' }); const root = r.json && typeof r.json === 'object' ? r.json : null;
    if (!root || !Array.isArray(root.namespaces)) throw CMS.err(`No WordPress REST API at ${rest(cfg, '')}`, { status: r.status, hint: 'Enter the WordPress install URL (the CMS, not the front end) and set Settings, Permalinks to Post name.' });
    const rec = { at: Date.now(), bridge: root.namespaces.includes(FORGE_NS), root, name: root.name || '', ns: root.namespaces };
    BRIDGE.set(key, rec); if (ctx && ctx.log) ctx.log(`${rec.name || key}: REST reachable, bridge ${rec.bridge ? 'on' : 'off'}`); return rec;
  }
  const bridgeStatus = async cfg => (await req(cfg, 'GET', FORGE_NS + '/status')).json || {};
  async function needBridge(cfg, ctx, what) { const d = await discover(cfg, ctx); if (!d.bridge) throw CMS.err(`${what} needs the FORGE bridge on ${d.name || base(cfg)}`, { code: 'forge_no_bridge', hint: 'Install and activate forge-bridge.zip (module 16 downloads it), then test the connection again.' }); return d; }
  const yn = v => v ? 'yes' : 'no';
  /* shared test body: discovery, then the bridge status or wp/v2/users/me; returns the meta block both adapters report */
  async function probe(cfg, ctx) {
    const d = await discover(cfg, ctx, true); const meta = { api: API, site: d.name, bridge: d.bridge, namespaces: d.ns.filter(n => /^(wp\/v2|forge|elementor|graphql)/.test(n)), warnings: [] };
    if (d.bridge) { const s = await bridgeStatus(cfg);
      Object.assign(meta, { bridgeVersion: s.forge || '', wp: s.wp || '', php: s.php || '', elementor: s.elementor || null, elementorPro: s.elementor_pro || null, containers: !!s.containers, theme: s.theme || '', permalinks: s.permalinks == null ? null : s.permalinks, seo: s.seo_plugin || 'none', forms: s.forms || {}, wpgraphql: !!s.wpgraphql, unfilteredHtml: !!s.unfiltered_html, user: s.user || '', home: s.home || '', uploadMax: s.upload_max || 0, corsOrigins: Array.isArray(s.cors_origins) ? s.cors_origins : [], settings: s.settings || null });
      if (!meta.unfilteredHtml) meta.warnings.push('This user lacks unfiltered_html: Elementor data cannot be written. Use an administrator.');
      if (meta.permalinks === '') meta.warnings.push('Permalinks are Plain: set Settings, Permalinks to Post name.');
      if (!meta.elementor) meta.warnings.push('Elementor is not installed: pages land as HTML sections without Elementor data.');
      if (meta.bridgeVersion && meta.bridgeVersion !== BRIDGE_VER) meta.warnings.push(`Bridge ${meta.bridgeVersion} on the site, this app ships ${BRIDGE_VER}: download the current forge-bridge.zip from module 16.`); }
    else { const me = (await req(cfg, 'GET', WP_NS + '/users/me?context=edit')).json || {}; const caps = me.capabilities || {};
      Object.assign(meta, { user: me.slug || me.username || me.name || '', roles: me.roles || [], canEdit: !!caps.edit_pages, unfilteredHtml: !!caps.unfiltered_html });
      if (!meta.canEdit && me.roles) meta.warnings.push('This user cannot edit pages: use an Editor or Administrator.'); }
    return meta;
  }

  /* ---------- the bridge bundle (what forge/v1/import reads; same shape as FORGE_COMPILE.bundle) ---------- */
  const mediaResolved = media => { const out = {}; for (const [k, m] of Object.entries(media || {})) { if (!m) continue; const o = {}; for (const kk of ['id', 'url', 'alt', 'kind', 'width', 'height', 'mime']) if (m[kk] !== undefined) o[kk] = m[kk]; out[k] = o; } return out; };
  function bundleFor(cfg, page, status) {
    const ps = page.page_settings && typeof page.page_settings === 'object' ? page.page_settings : null;
    return { slug: cleanSlug(page.slug), title: page.title || page.h1 || '', post_title: page.h1 || page.title || '', status, post_type: typeOf(cfg, page), template: (ps && ps.template) || page.template || 'default',
      elementor_data: page.elementor_data || null, page_settings: ps, content_html: CMS.bodyHtml(page, { css: true, schema: false }), seo: page.seo || null, schema: page.schema || null,
      blueprint: page.blueprint ? Object.assign({}, page.blueprint, { media_resolved: mediaResolved(page.media) }) : null, summary: page.summary || '', excerpt: page.excerpt || page.summary || '', featured_media: page.featured_media_id || 0 };
  }
  async function importBundle(cfg, page, status, ctx) {
    const j = (await req(cfg, 'POST', FORGE_NS + '/import', bundleFor(cfg, page, status))).json || {};
    return { id: j.id, link: j.link, edit: j.edit || editLink(cfg, j.id), status: j.status || status, updated: !!j.updated, route: 'bridge', notes: 'Elementor data, SEO fields and JSON-LD written through the bridge; the HTML fallback carries the forge css inline' };
  }
  /* the plain wp/v2 route: slug lookup (status=any needs edit_posts), then create or update. The forge css and the JSON-LD go inline in the content
     (the bridge prints only the JSON-LD and the meta tags in the head; nothing on the site registers the forge classes), SEO fields are not set. */
  async function upsertRest(cfg, page, status, ctx) {
    const coll = typeOf(cfg, page) === 'post' ? 'posts' : 'pages'; const slug = cleanSlug(page.slug);
    const ex = (await req(cfg, 'GET', `${WP_NS}/${coll}?slug=${encodeURIComponent(slug)}&status=any&_fields=id`)).json; const id = Array.isArray(ex) && ex[0] && ex[0].id ? ex[0].id : 0;
    const body = { slug, title: page.h1 || page.title || '', status, content: CMS.bodyHtml(page, { css: true, schema: true }), excerpt: page.excerpt || page.summary || '', meta: {} };
    if (page.featured_media_id) body.featured_media = page.featured_media_id;
    const j = (await req(cfg, 'POST', id ? `${WP_NS}/${coll}/${id}` : `${WP_NS}/${coll}`, body)).json || {};
    return { id: j.id, link: j.link, edit: editLink(cfg, j.id), status: j.status || status, updated: !!id, route: 'rest', notes: 'no bridge: css and JSON-LD inline in the content (needs unfiltered_html), no Elementor data, SEO title, description and canonical not set' };
  }

  /* ---------- media ---------- */
  async function findMedia(cfg, query, kind, ctx) {
    const d = await discover(cfg, ctx); const q = encodeURIComponent(query || ''); const want = kind === 'video' ? 'video' : (kind ? 'image' : '');
    if (d.bridge) { const rows = (await req(cfg, 'GET', `${FORGE_NS}/media/find?q=${q}&per_page=5`)).json; return (Array.isArray(rows) ? rows : []).filter(r => !want || !r.mime || String(r.mime).startsWith(want)).map(r => ({ id: r.id, url: r.url, alt: r.alt || '', width: r.width || 0, height: r.height || 0, mime: r.mime || '' })); }
    /* media_type filter and _fields: https://developer.wordpress.org/rest-api/reference/media/ and /rest-api/using-the-rest-api/global-parameters/ */
    const rows = (await req(cfg, 'GET', `${WP_NS}/media?search=${q}&per_page=5${want ? '&media_type=' + want : ''}&_fields=id,source_url,mime_type,alt_text,media_details`)).json;
    return (Array.isArray(rows) ? rows : []).map(r => ({ id: r.id, url: r.source_url, alt: r.alt_text || '', width: (r.media_details || {}).width || 0, height: (r.media_details || {}).height || 0, mime: r.mime_type || '' }));
  }
  /* an attachment counts as the same file when its stem is the asset's stem plus what WordPress itself appends: -1, -2 (wp_unique_filename), -scaled and -rotated (big images), -WxH (sizes) */
  const sameStem = (stem, url) => new RegExp('^' + norm(stem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(-(\\d+|scaled|rotated|\\d+x\\d+))*$').test(norm(stemOf(url)));
  /* raw upload: https://developer.wordpress.org/rest-api/reference/media/#create-a-media-item (Content-Type + Content-Disposition attachment; filename=) then alt text and title on the attachment */
  async function uploadMedia(cfg, asset, ctx) {
    const mime = asset.mime || (asset.blob && asset.blob.type) || 'application/octet-stream'; const file = safeName(asset.file || ('upload.' + CMS.extOf('', mime))); const stem = stemOf(file); const kind = /^video\//.test(mime) ? 'video' : 'image';
    const hit = (await findMedia(cfg, stem, kind, ctx)).find(m => m.url && sameStem(stem, m.url) && (!m.mime || String(m.mime).startsWith(kind)));
    if (hit) { if (ctx && ctx.log) ctx.log(`media: reusing attachment ${hit.id} for ${file}`); return Object.assign({}, hit, { reused: true }); }
    const j = (await req(cfg, 'POST', WP_NS + '/media', asset.blob, { raw: true, headers: { 'Content-Type': mime, 'Content-Disposition': `attachment; filename="${file}"` } })).json || {};
    const alt = asset.alt || ''; await req(cfg, 'POST', `${WP_NS}/media/${j.id}`, { alt_text: alt, title: stem.replace(/[-_]+/g, ' ') });
    const det = j.media_details || {};
    return { id: j.id, url: j.source_url, width: det.width || asset.width || 0, height: det.height || asset.height || 0, mime: j.mime_type || mime, alt, reused: false };
  }

  /* ---------- live urls ---------- */
  async function listUrls(cfg, ctx) {
    const d = await discover(cfg, ctx);
    if (d.bridge) { const j = (await req(cfg, 'GET', FORGE_NS + '/urls')).json || {}; return Array.isArray(j.urls) ? j.urls : []; }
    const urls = []; const home = d.root.home || d.root.url || site(cfg); if (home) urls.push(CMS.trimSlash(home) + '/');
    for (const coll of ['pages', 'posts']) {
      for (let p = 1, total = 1; p <= total && p <= MAX_PAGES; p++) {
        const r = await req(cfg, 'GET', `${WP_NS}/${coll}?per_page=${PER_PAGE}&page=${p}&_fields=link`); const rows = Array.isArray(r.json) ? r.json : [];
        /* X-WP-TotalPages: https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/ ; a proxy that strips it falls back to "a full page means there may be more" */
        total = parseInt((r.headers && r.headers.get && r.headers.get('x-wp-totalpages')) || '', 10) || (rows.length >= PER_PAGE ? p + 1 : p);
        rows.forEach(row => { if (row && row.link) urls.push(row.link); });
      }
    }
    return [...new Set(urls)];
  }

  /* ---------- bridge extras (module 16 and module 09 use them) ---------- */
  async function importTemplate(cfg, t, ctx) { t = t || {}; await needBridge(cfg, ctx, 'Importing an Elementor template'); const j = (await req(cfg, 'POST', FORGE_NS + '/template', { title: t.title || '', content: t.content || null, page_settings: t.page_settings || null, type: t.type || 'page' })).json || {}; return { id: j.id, edit: j.edit, title: t.title || '' }; }
  async function indexNow(cfg, urls, ctx) { await needBridge(cfg, ctx, 'IndexNow'); const j = (await req(cfg, 'POST', FORGE_NS + '/indexnow', { urls: (urls || []).filter(Boolean) })).json || {}; return { sent: j.sent || 0, code: j.code }; }
  async function getSettings(cfg, ctx) { await needBridge(cfg, ctx, 'Reading the bridge settings'); return (await req(cfg, 'GET', FORGE_NS + '/settings')).json || {}; }
  async function setSettings(cfg, patch, ctx) { await needBridge(cfg, ctx, 'Writing the bridge settings'); return (await req(cfg, 'POST', FORGE_NS + '/settings', patch || {})).json || {}; }

  const FIELDS = [
    { k: 'url', l: 'WordPress URL', t: 'url', hint: 'The WordPress install, for example https://www.example.com or https://cms.example.com' },
    { k: 'user', l: 'Username', t: 'text', hint: 'The WordPress login the Application Password belongs to' },
    { k: 'appPass', l: 'Application Password', t: 'password', secret: true, hint: 'Users, Profile, Application Passwords. Paste it with or without spaces.' },
    { k: 'postType', l: 'Post type', t: 'text', def: 'page', optional: true, hint: 'page or post; a page built with a post type keeps its own' },
  ];
  const SETUP = [
    'In WordPress open Users, Profile, Application Passwords, name it Thermal Atlas and add it. Copy the password once; the site needs HTTPS.',
    'Install the FORGE bridge: module 16 downloads forge-bridge.zip. Plugins, Add New, Upload, Activate. Without it only the HTML route works.',
    'Use an Administrator account when pages carry Elementor data (the unfiltered_html capability).',
    'Set Settings, Permalinks to Post name. Plain permalinks hide /wp-json/.',
  ];
  const COMMON = { docs: DOCS, dynamicHost: cfg => CMS.originOf(site(cfg)) || site(cfg), base, findMedia, uploadMedia, importTemplate, indexNow, getSettings, setSettings, bridgeStatus: async (cfg, ctx) => { await needBridge(cfg, ctx, 'The bridge status'); return bridgeStatus(cfg); } };

  /* ============================ (1) WordPress · Elementor ============================ */
  CMS.register(Object.assign({}, COMMON, {
    id: 'wp_elementor', name: 'WordPress · Elementor', group: 'WordPress', blurb: 'Application Password over REST; the FORGE bridge writes Elementor data, SEO fields and JSON-LD',
    fields: FIELDS, setup: SETUP,
    caps: { media: true, urls: true, publishSite: false, elementor: true, schema: 'head', seo: true, postTypes: ['page', 'post'], bridge: true },
    async test(cfg, ctx) {
      const m = await probe(cfg, ctx); let info;
      if (m.bridge) info = `${m.site || base(cfg)}: bridge ${m.bridgeVersion} · WP ${m.wp} · PHP ${m.php} · Elementor ${m.elementor || 'not installed'}${m.elementor && m.containers ? ' (containers)' : ''} · SEO ${m.seo} · unfiltered_html ${yn(m.unfilteredHtml)} · ${m.user}`;
      else info = `${m.site || base(cfg)}: REST only, no FORGE bridge. Signed in as ${m.user}. HTML route only: no Elementor data, JSON-LD inline, no SEO fields.`;
      if (m.warnings.length) info += ' · ' + m.warnings.join(' ');
      return { ok: true, info, meta: m };
    },
    async upsertPage(cfg, page, opts, ctx) { const status = statusOf(page, opts); const d = await discover(cfg, ctx); return d.bridge ? importBundle(cfg, page, status, ctx) : upsertRest(cfg, page, status, ctx); },
    listUrls,
  }));

  /* ============================ (2) WordPress · Headless (Next.js) ============================ */
  const front = cfg => CMS.trimSlash(cfg.siteUrl || '');
  const frontOrigin = cfg => CMS.originOf(front(cfg)) || front(cfg);
  const revalidateUrl = cfg => CMS.trimSlash(cfg.revalidateUrl || '') || (front(cfg) + '/api/revalidate');
  /* a WordPress permalink moved onto the front end host (pretty paths only; ?p= and ?page_id= links stay on WordPress) */
  const onFront = (cfg, u) => { try { const x = new URL(u); return x.search ? u : front(cfg) + x.pathname; } catch (e) { return u; } };
  function withCanonical(page, canonical) {
    const old = page.canonical || (page.seo || {}).canonical || ''; const swap = s => old && old !== canonical ? String(s).split(old).join(canonical) : String(s);
    return Object.assign({}, page, { canonical, seo: Object.assign({}, page.seo || {}, { canonical }), schema: page.schema ? JSON.parse(swap(JSON.stringify(page.schema))) : page.schema });
  }
  async function frontCheck(cfg) {
    const url = front(cfg) + '/'; if (!front(cfg)) return { url, status: 0, ok: false, error: 'no front end URL' };
    try { const p = await CMS.ensureOrigin(url); if (p && p.granted === false) return { url, status: 0, ok: false, error: 'site access to ' + p.origin + ' was not granted' }; } catch (e) { }
    try { const r = await CMS.http(url, { method: 'GET', expect: 'text', timeout: 15000, tolerate: true }); return { url, status: r.status, ok: !!r.ok }; }
    catch (e) { return { url, status: 0, ok: false, error: e.message }; }
  }
  CMS.register(Object.assign({}, COMMON, {
    id: 'wp_headless', name: 'WordPress · Headless (Next.js)', group: 'WordPress', blurb: 'WordPress as the CMS, a Next.js front end reads the blueprint through the FORGE bridge; canonicals point at the front end',
    fields: FIELDS.concat([
      { k: 'siteUrl', l: 'Front end URL', t: 'url', hint: 'The public origin the Next.js kit serves, for example https://www.example.com' },
      { k: 'revalidateSecret', l: 'Revalidate secret', t: 'password', secret: true, optional: true, hint: 'REVALIDATE_SECRET of the front end; Configure sends it to the bridge' },
      { k: 'revalidateUrl', l: 'Revalidate URL', t: 'url', optional: true, hint: 'Defaults to the front end URL plus /api/revalidate' },
    ]),
    setup: SETUP.concat([
      'Download the Next.js kit from module 16, set WP_URL, NEXT_PUBLIC_SITE_URL and REVALIDATE_SECRET, deploy it and point the public domain at it.',
      'Test, then Configure: the bridge gets the revalidate URL, the secret and the front end as a CORS origin. Every publish then refreshes the page on the front end.',
      'WPGraphQL is optional; the kit reads REST (the forge field on pages and posts).',
    ]),
    caps: { media: true, urls: true, publishSite: false, elementor: false, schema: 'head', seo: true, postTypes: ['page', 'post'], bridge: true, headlessKit: true },
    async test(cfg, ctx) {
      const m = await probe(cfg, ctx); m.front = front(cfg); m.revalidateUrl = revalidateUrl(cfg);
      if (!m.bridge) return { ok: false, info: `${m.site || base(cfg)}: no FORGE bridge. Headless needs it: the bridge exposes the blueprint on the REST forge field the Next.js kit reads. Install forge-bridge.zip from module 16 and test again.`, hint: 'Plugins, Add New, Upload forge-bridge.zip, Activate.', meta: m };
      const fe = await frontCheck(cfg); m.frontStatus = fe.status; m.frontOk = fe.ok; if (fe.error) m.frontError = fe.error;
      const s = m.settings || null; m.configured = !!(s && s.revalidate_url === m.revalidateUrl && (s.cors_origins || []).map(CMS.trimSlash).includes(frontOrigin(cfg)));
      if (!fe.ok) m.warnings.push(fe.status ? `The front end answered HTTP ${fe.status}.` : `The front end at ${fe.url} is not reachable (${fe.error || 'no response'}).`);
      if (s && !m.configured) m.warnings.push('The bridge does not point at this front end yet: run Configure.');
      if (!s) m.warnings.push('Bridge settings are hidden for this user (not an administrator): Configure needs manage_options.');
      let info = `${m.site || base(cfg)}: bridge ${m.bridgeVersion} · WP ${m.wp} · PHP ${m.php} · WPGraphQL ${m.wpgraphql ? 'on' : 'off'} · front end ${fe.ok ? 'up' : (fe.status ? 'HTTP ' + fe.status : 'unreachable')} · revalidate ${m.configured ? 'configured' : 'not configured'} · ${m.user}`;
      if (m.warnings.length) info += ' · ' + m.warnings.join(' ');
      return { ok: true, info, meta: m };
    },
    /* register the front end with the bridge: revalidate URL, secret, CORS origin (merged with the origins already there) */
    async configure(cfg, ctx) {
      if (!front(cfg)) throw CMS.err('Enter the front end URL first', { hint: 'The public origin the Next.js kit serves, for example https://www.example.com' });
      const cur = await getSettings(cfg, ctx); const origin = frontOrigin(cfg);
      const patch = { revalidate_url: revalidateUrl(cfg), cors_origins: [...new Set((Array.isArray(cur.cors_origins) ? cur.cors_origins : []).map(CMS.trimSlash).filter(Boolean).concat([origin]))] };
      if (cfg.revalidateSecret) patch.revalidate_secret = String(cfg.revalidateSecret).trim();
      const s = await setSettings(cfg, patch, ctx);
      return { ok: true, info: `Bridge points at ${s.revalidate_url || patch.revalidate_url}; CORS origins: ${(s.cors_origins || patch.cors_origins).join(', ')}${cfg.revalidateSecret ? '; secret set' : '; secret unchanged'}`, settings: s };
    },
    async upsertPage(cfg, page, opts, ctx) {
      await needBridge(cfg, ctx, 'Headless publishing');
      const status = statusOf(page, opts); const canonical = front(cfg) + '/' + cleanSlug(page.slug) + '/';
      const r = await importBundle(cfg, withCanonical(page, canonical), status, ctx);
      return Object.assign(r, { link: canonical, wpLink: r.link, notes: `canonical ${canonical}; the front end shows it once published and revalidated` });
    },
    async listUrls(cfg, ctx) { return (await listUrls(cfg, ctx)).map(u => onFront(cfg, u)); },
  }));
})();
