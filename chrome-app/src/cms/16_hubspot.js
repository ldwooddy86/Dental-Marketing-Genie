/* ==== cms/hubspot ==== */
"use strict";
/* HubSpot Content Hub through the CMS v3 APIs with a private app access token sent as "Authorization: Bearer"
   (https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes; the app needs the content and files scopes).
   Blog mode (recommended): GET /cms/v3/blogs/posts filtered by slug, then POST /cms/v3/blogs/posts or PATCH
   /cms/v3/blogs/posts/{id}; a draft is published with POST /cms/v3/blogs/posts/schedule {id, publishDate}
   (https://developers.hubspot.com/docs/api-reference/cms-posts-v3/basic/post-cms-v3-blogs-posts-schedule).
   Page mode: the same shape on /cms/v3/pages/site-pages with the body inside one rich text module of the template's
   drag and drop area (https://developers.hubspot.com/docs/api-reference/latest/cms/pages/guide) and
   POST /cms/v3/pages/site-pages/schedule to publish (https://developers.hubspot.com/docs/api-reference/cms-pages-v3/site-pages/post-cms-v3-pages-site-pages-schedule).
   JSON-LD and robots go in headHtml, SEO title and description in htmlTitle and metaDescription, the canonical in
   linkRelCanonicalUrl. Images upload to the File Manager (POST /files/v3/files, multipart). */
(() => {
  const API = 'https://api.hubapi.com';   /* https://developers.hubspot.com/docs/api-reference (every CMS v3 route hangs off this host) */
  const P = {
    posts: '/cms/v3/blogs/posts',                 /* https://developers.hubspot.com/docs/api-reference/cms-posts-v3/basic/get-cms-v3-blogs-posts */
    blogs: '/cms/v3/blog-settings/settings',      /* https://developers.hubspot.com/docs/api-reference/cms-blog-settings-v3/blogs/get-cms-v3-blog-settings-settings */
    authors: '/cms/v3/blogs/authors',             /* https://developers.hubspot.com/docs/guides/cms-api/blog-authors */
    pages: '/cms/v3/pages/site-pages',            /* https://developers.hubspot.com/docs/api-reference/cms-pages-v3/site-pages/get-cms-v3-pages-site-pages
                                                     (the "latest" Pages guide also shows a date versioned form, /cms/pages/2026-09/site-pages; v3 stays documented) */
    files: '/files/v3/files',                     /* https://developers.hubspot.com/docs/api-reference/files-files-v3/files/post-files-v3-files */
    account: '/account-info/v3/details',          /* https://developers.hubspot.com/docs/api-reference/legacy/account/account-information/guide (portalId) */
  };
  const LIMIT = 100; const MAX_PAGES = 50; const FOLDER = '/forge'; const LIMITS = { htmlTitle: 255, metaDescription: 320, postSummary: 5000 };
  const DOCS = 'https://developers.hubspot.com/docs/api-reference/latest/cms/pages/guide';
  const UI_HOST = 'app.hubspot.com';      /* editor links; EU portals answer with uiDomain app-eu1.hubspot.com in /account-info/v3/details */
  const RETRY = { tries: 2, ms: 1500 };   /* 429: private apps get 100 (Free, Starter) or 190 (Pro, Enterprise) requests per rolling 10 s
                                             https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines */
  const SCHEDULE_AHEAD = 60000;           /* when the schedule call refuses the current time, ask for one minute out */
  const CACHE = {};                       /* base → {portalId, uiDomain, roots: {blogId: slug}, authorId} */

  const H = ctx => (ctx && ctx.http) || CMS.http;
  const val = (cfg, k, d) => { const v = cfg[k]; return v != null && String(v).trim() !== '' ? String(v).trim() : d; };
  const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const base = cfg => CMS.trimSlash(cfg.apiBase || API);
  const cache = cfg => (CACHE[base(cfg)] = CACHE[base(cfg)] || { roots: {} });
  const mode = cfg => val(cfg, 'mode', 'blog') === 'page' ? 'page' : 'blog';
  const cleanSlug = s => String(s || '').trim().replace(/^\/+|\/+$/g, '');
  const isLive = x => !!x && /^PUBLISHED/.test(String(x.currentState || x.state || ''));
  const qs = o => { const u = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v != null && v !== '') u.set(k, String(v)); }); const s = u.toString(); return s ? '?' + s : ''; };

  /* ---------- errors ---------- */
  function explain(e) {
    if (!(e instanceof CMS.CmsError) || e.hint) return e; const s = e.status; const b = e.body && typeof e.body === 'object' ? e.body : {}; const cat = String(b.category || ''); const sub = String(b.subCategory || '');
    if (s === 401) e.hint = 'HubSpot rejected the token: paste the private app access token (Settings > Integrations > Private apps > your app > Auth)';
    else if (s === 403 || cat === 'MISSING_SCOPES') e.hint = 'The private app is missing a scope: content (blog posts, site pages) and files (uploads). Edit the app scopes; the token stays the same';
    else if (s === 404) e.hint = 'Not found: check the id (Blog id, page id) and that the account has Content Hub';
    else if (s === 429) e.hint = 'Rate limited (100 requests per 10 seconds per private app); wait and deploy again';
    else if (/PARENT_BLOG_DOES_NOT_EXIST/i.test(sub + ' ' + (b.message || ''))) e.hint = 'The Blog id is wrong: Test lists the blogs with their ids';
    else if (s === 400 && /templatePath|template/i.test(b.message || '')) e.hint = 'The template path must be a page template in the active theme, for example @hubspot/growth/templates/blank.html';
    else if (s === 400 && /slug/i.test(b.message || '')) e.hint = 'The slug is taken or invalid on this domain; change the page slug';
    return e;
  }
  async function api(cfg, ctx, method, path, body, extra) {
    const token = val(cfg, 'token', ''); if (!token) throw CMS.err('Paste the private app access token first', { status: 0, hint: 'Settings > Integrations > Private apps' });
    for (let attempt = 0; ; attempt++) {
      const o = Object.assign({ method }, extra || {}); o.headers = Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' }, o.headers || {}); if (body != null) o.body = body;
      try { return await H(ctx)(base(cfg) + path, o); }
      catch (e) { if (e.status === 429 && attempt < RETRY.tries) { if (ctx && ctx.log) ctx.log(`HubSpot rate limit on ${method} ${path}; retrying in ${RETRY.ms} ms`); await CMS.sleep(RETRY.ms); continue; } throw explain(e); }
    }
  }
  /* cursor pagination: {results, paging: {next: {after}}} */
  async function list(cfg, ctx, path, params, max) {
    const out = []; let after = ''; let guard = 0;
    do { const r = await api(cfg, ctx, 'GET', path + qs(Object.assign({}, params, { limit: LIMIT, after: after || undefined }))); const j = r.json || {}; out.push(...(j.results || [])); after = j.paging && j.paging.next && j.paging.next.after ? j.paging.next.after : ''; } while (after && ++guard < (max || MAX_PAGES));
    return out;
  }
  /* slug lookup: the slug__icontains filter (the case sensitive contains is refused for slug), exact match on our side; when the
     filter itself is refused, list and match. A blog post's slug carries the blog root (blog/ac-repair): the exact full slug wins,
     then, inside the configured blog only, the bare slug or a trailing segment (the root can differ from the settings slug on
     multi language blogs). Site pages match the exact slug only: about/contact is another page than contact. */
  async function findBySlug(cfg, ctx, path, slug, fullSlug, groupId) {
    const inGroup = x => !!groupId && String(x.contentGroupId || '') === String(groupId);
    const exact = x => cleanSlug(x.slug) === fullSlug && (!groupId || !x.contentGroupId || inGroup(x));
    const loose = x => { const s = cleanSlug(x.slug); return inGroup(x) && (s === slug || s.endsWith('/' + slug)); };
    let rows; try { rows = ((await api(cfg, ctx, 'GET', path + qs({ slug__icontains: slug, limit: LIMIT }))).json || {}).results || []; }
    catch (e) { if (e.status !== 400) throw e; if (ctx && ctx.log) ctx.log('slug filter refused (' + e.message + '); listing instead'); rows = await list(cfg, ctx, path, {}, 20); }
    return rows.find(exact) || rows.find(loose) || null;
  }
  /* portal id and ui host from /account-info/v3/details (cached; Test stores them in meta) */
  async function account(cfg, ctx) {
    const c = cache(cfg); const t = (cfg._tested && cfg._tested.meta) || {};
    if (!c.portalId && t.portalId) { c.portalId = t.portalId; c.uiDomain = t.uiDomain || c.uiDomain; }
    if (!c.portalId) { try { const r = await api(cfg, ctx, 'GET', P.account); const j = r.json || {}; if (j.portalId) { c.portalId = j.portalId; c.uiDomain = j.uiDomain || ''; } } catch (e) { if (ctx && ctx.log) ctx.log('portal id not readable: ' + e.message); } }
    return { portalId: c.portalId || '', uiDomain: String(c.uiDomain || UI_HOST).replace(/^https?:\/\//, '').replace(/\/.*$/, '') || UI_HOST };
  }
  const rootOf = b => { b = b || {}; if (b.slug != null && String(b.slug).trim() !== '') return cleanSlug(b.slug); try { return cleanSlug(new URL(b.absoluteUrl).pathname); } catch (e) { return ''; } };
  async function blogRoot(cfg, ctx, id) {
    const c = cache(cfg); if (c.roots[id] != null) return c.roots[id];
    try { const r = await api(cfg, ctx, 'GET', `${P.blogs}/${encodeURIComponent(id)}`); return (c.roots[id] = rootOf(r.json)); } catch (e) { throw Object.assign(e, { hint: e.hint || 'The Blog id is wrong: Test lists the blogs with their ids' }); }
  }
  /* publish a draft: POST {path}/schedule {id, publishDate}. The current time publishes at once; when HubSpot insists on a
     future date the call is repeated one minute out and the result says so. */
  async function publishNow(cfg, ctx, path, id, notes) {
    try { await api(cfg, ctx, 'POST', `${path}/schedule`, { id: String(id), publishDate: new Date().toISOString() }); return; }
    catch (e) { if (e.status !== 400 || !/date|past|future|schedul/i.test(e.message)) throw e; if (ctx && ctx.log) ctx.log(`schedule refused the current time (${e.message}); scheduling ${SCHEDULE_AHEAD / 1000} s out`); }
    await api(cfg, ctx, 'POST', `${path}/schedule`, { id: String(id), publishDate: new Date(Date.now() + SCHEDULE_AHEAD).toISOString() });
    notes.push(`HubSpot refused the current time as the publish date; the page goes live in ${SCHEDULE_AHEAD / 1000} s`);
  }
  async function authorId(cfg, ctx) {
    const set = val(cfg, 'authorId', ''); if (set) return set; const c = cache(cfg); if (c.authorId) return c.authorId;
    try { const r = await api(cfg, ctx, 'GET', P.authors + qs({ limit: 1 })); const a = ((r.json || {}).results || [])[0]; if (a && a.id) return (c.authorId = String(a.id)); } catch (e) { if (ctx && ctx.log) ctx.log('no blog author readable: ' + e.message); }
    return '';
  }

  /* ---------- content ---------- */
  const heroAlt = page => { const m = page.media || {}; const hit = Object.values(m).find(x => x && x.url && x.url === page.featured_media_url); return (hit && hit.alt) || (m.hero && m.hero.alt) || ''; };
  const head = page => { const seo = page.seo || {}; return [CMS.schemaTag(page.schema), (seo.noindex || page.noindex) ? '<meta name="robots" content="noindex,follow">' : ''].filter(Boolean).join('\n'); };
  function common(page, slug) {
    const seo = page.seo || {}; const b = { name: page.h1 || page.title, slug, htmlTitle: cut(seo.title || page.title, LIMITS.htmlTitle), metaDescription: cut(seo.description || page.meta_description, LIMITS.metaDescription), headHtml: head(page) };
    const canon = seo.canonical || page.canonical; if (canon) b.linkRelCanonicalUrl = canon;
    const fm = page.featured_media_url || ''; b.useFeaturedImage = !!fm; if (fm) { b.featuredImage = fm; b.featuredImageAltText = heroAlt(page); }
    return b;
  }
  function postBody(cfg, page, slug, author) {
    const b = Object.assign(common(page, slug), { contentGroupId: val(cfg, 'contentGroupId', ''), postBody: CMS.bodyHtml(page, { css: true, schema: false }), postSummary: cut(page.summary || page.excerpt, LIMITS.postSummary) });
    if (author) b.blogAuthorId = String(author); return b;
  }
  /* One drag and drop section holding one column holding one default rich text module (@hubspot/rich_text, params.html):
     the shape the Pages API returns for a page built in the editor; forceFullWidthSection lets the forge sections span the page. */
  function section(dnd, html) {
    const mod = { cells: [], cssClass: '', cssId: '', cssStyle: '', label: 'FORGE page', name: dnd + '-module-1', params: { child_css: {}, css: {}, css_class: 'dnd-module', html, path: '@hubspot/rich_text', schema_version: 2, smart_objects: [], smart_type: 'NOT_SMART', wrapping_html: '' }, rowMetaData: [], rows: [], type: 'custom_widget', w: 12, x: 0 };
    const col = { cells: [], cssClass: '', cssId: '', cssStyle: '', name: dnd + '-column-1', params: { css_class: 'dnd-column' }, rowMetaData: [{ cssClass: 'dnd-row' }], rows: [{ 0: mod }], type: 'cell', w: 12, x: 0 };
    return { cells: [], cssClass: '', cssId: '', cssStyle: '', label: 'Main section', name: dnd, params: {}, rowMetaData: [{ cssClass: 'dnd-section', styles: { forceFullWidthSection: true } }], rows: [{ 0: col }], type: 'cell', w: 12, x: 0 };
  }
  function pageBody(cfg, page, slug) {
    const tpl = val(cfg, 'templatePath', ''); if (!tpl) throw CMS.err('Set the template path for page mode', { status: 0, hint: 'a page template of the active theme, for example @hubspot/growth/templates/blank.html (Design Manager shows the path)' });
    const dnd = val(cfg, 'dndArea', 'dnd_area'); const b = Object.assign(common(page, slug), { templatePath: tpl, layoutSections: { [dnd]: section(dnd, CMS.bodyHtml(page, { css: true, schema: false })) } });
    const dom = val(cfg, 'domain', ''); if (dom) b.domain = dom.replace(/^https?:\/\//, '').replace(/\/.*$/, ''); return b;
  }

  /* ---------- upsert ---------- */
  async function upsertPage(cfg, page, opts, ctx) {
    const publish = !!(opts && opts.publish); const m = mode(cfg); const path = m === 'page' ? P.pages : P.posts; const slug = cleanSlug(page.slug); const notes = ['SEO title and description in htmlTitle and metaDescription', 'JSON-LD in headHtml', 'css inline in the body'];
    let fullSlug = slug; let author = ''; let group = '';
    if (m === 'blog') { group = val(cfg, 'contentGroupId', ''); if (!group) throw CMS.err('Set the Blog id first', { status: 0, hint: 'Test lists the blogs with their ids; paste the id of the blog the posts belong to' }); const root = await blogRoot(cfg, ctx, group); fullSlug = root ? root + '/' + slug : slug; author = await authorId(cfg, ctx); }
    const ex = await findBySlug(cfg, ctx, path, slug, fullSlug, group); const live = isLive(ex);
    const body = m === 'page' ? pageBody(cfg, page, fullSlug) : postBody(cfg, page, fullSlug, author);
    let got;
    if (!ex) { body.state = 'DRAFT'; got = (await api(cfg, ctx, 'POST', path, body)).json || {}; }
    else if (live && !publish) { got = (await api(cfg, ctx, 'PATCH', `${path}/${ex.id}/draft`, body)).json || {}; notes.push('the live page is unchanged; the new content waits in its draft (push it live from the editor)'); }
    else got = (await api(cfg, ctx, 'PATCH', `${path}/${ex.id}`, body)).json || {};
    const id = got.id || (ex && ex.id); if (!id) throw CMS.err('HubSpot did not return the ' + (m === 'page' ? 'page' : 'post'), { status: 200, hint: 'the response had no id; check the app scopes' });
    let status = live ? (publish ? 'publish' : 'draft') : 'draft';
    if (publish && !live) { await publishNow(cfg, ctx, path, id, notes); status = 'publish'; }
    if ((page.seo || {}).noindex || page.noindex) notes.push('noindex as a robots meta in headHtml');
    const acct = await account(cfg, ctx); const edit = acct.portalId ? `https://${acct.uiDomain}/${m === 'page' ? 'pages' : 'blog'}/${acct.portalId}/editor/${id}/content` : '';
    return { id, link: got.url || (ex && ex.url) || '', edit, status, updated: !!ex, notes: notes.join('; ') };
  }

  CMS.register({
    id: 'hubspot', name: 'HubSpot', group: 'HubSpot CMS (blog posts and site pages)', blurb: 'CMS v3 APIs with a private app token', docs: DOCS,
    setup: [
      'Settings > Integrations > Private apps > Create a private app. Scopes: content (blog posts and site pages) and files (image uploads). Copy the access token (pat-...).',
      'Blog mode (recommended) posts into one blog: run Test to see the blogs and paste the Blog id. Page mode needs a page template path from the active theme and the name of its drag and drop area (dnd_area on the HubSpot themes).',
      'Everything lands as a draft unless you tick publish; a live page that is deployed as a draft keeps its live version and gets the new content in its draft.',
      'SEO title and description go in the page settings, the JSON-LD in the head HTML, the css inline in the body. Set a Blog author when the account has more than one.',
    ],
    fields: [
      { k: 'token', l: 'Private app access token', t: 'password', secret: true, hint: 'pat-na1-... from the private app' },
      { k: 'mode', l: 'Create as', t: 'select', opts: [{ v: 'blog', l: 'Blog posts (recommended)' }, { v: 'page', l: 'Site pages' }], def: 'blog' },
      { k: 'contentGroupId', l: 'Blog id', t: 'text', optional: true, hint: 'for blog mode; Test lists the ids' },
      { k: 'authorId', l: 'Blog author id', t: 'text', optional: true, hint: 'blank uses the first author' },
      { k: 'templatePath', l: 'Page template path', t: 'text', optional: true, hint: 'for page mode, for example @hubspot/growth/templates/blank.html' },
      { k: 'dndArea', l: 'Drag and drop area', t: 'text', def: 'dnd_area', optional: true, hint: 'the dnd_area name in that template' },
      { k: 'domain', l: 'Domain', t: 'text', optional: true, hint: 'www.example.com; blank uses the primary domain' },
    ],
    hosts: [API + '/*'],
    /* the fixed host is in the manifest; a regional or mock apiBase asks for its origin once */
    dynamicHost: cfg => { const o = CMS.originOf(base(cfg)); return o && o !== API ? o : ''; },
    caps: { media: true, urls: true, publishSite: false, elementor: false, schema: 'head', seo: true, postTypes: ['page', 'post'] },
    base,
    async test(cfg, ctx) {
      const m = mode(cfg); const posts = (await api(cfg, ctx, 'GET', P.posts + qs({ limit: 1 }))).json || {};
      const blogs = (((await api(cfg, ctx, 'GET', P.blogs + qs({ limit: 10 }))).json || {}).results || []).map(b => ({ id: String(b.id), name: b.name || '', slug: rootOf(b), url: b.absoluteUrl || '' }));
      let pages = null; if (m === 'page') pages = (await api(cfg, ctx, 'GET', P.pages + qs({ limit: 1 }))).json || {};
      const acct = await account(cfg, ctx); const portal = acct.portalId; const group = val(cfg, 'contentGroupId', ''); const c = cache(cfg); blogs.forEach(b => { c.roots[b.id] = b.slug; });
      const parts = [`HubSpot${portal ? ' portal ' + portal : ''}`, `${posts.total != null ? posts.total : '?'} blog posts`, blogs.length ? 'blogs: ' + blogs.map(b => `${b.name} (${b.id}, /${b.slug})`).join(', ') : 'no blogs', pages ? `${pages.total != null ? pages.total : '?'} site pages` : '', m === 'page' ? 'page mode' : 'blog mode'];
      if (group && blogs.length && !blogs.some(b => b.id === group)) parts.push(`Blog id ${group} is not in the list`);
      return { ok: true, info: parts.filter(Boolean).join(', '), meta: { portalId: portal, uiDomain: acct.uiDomain, posts: posts.total, pages: pages ? pages.total : null, blogs, mode: m } };
    },
    async listUrls(cfg, ctx) {
      const out = [];
      (await list(cfg, ctx, P.posts, { state__eq: 'PUBLISHED' })).forEach(x => { if (x.url) out.push(x.url); });
      (await list(cfg, ctx, P.pages, { state__in: 'PUBLISHED_OR_SCHEDULED' })).forEach(x => { if (x.url && !/SCHEDULED|DRAFT/.test(String(x.currentState || x.state || ''))) out.push(x.url); });
      return out;
    },
    /* POST /files/v3/files multipart: file, fileName, folderPath, options (a JSON string) → {id, url, width, height} */
    async uploadMedia(cfg, asset, ctx) {
      const mime = asset.mime || (asset.blob && asset.blob.type) || 'application/octet-stream'; const file = String(asset.file || ('upload.' + CMS.extOf('', mime))).split('/').pop().replace(/[^a-zA-Z0-9._-]+/g, '-');
      const blob = asset.blob && asset.blob.type ? asset.blob : new Blob([await CMS.blobBytes(asset.blob)], { type: mime });
      const fd = new FormData(); fd.append('file', blob, file); fd.append('fileName', file); fd.append('folderPath', FOLDER); fd.append('options', JSON.stringify({ access: 'PUBLIC_INDEXABLE', overwrite: true, duplicateValidationStrategy: 'NONE', duplicateValidationScope: 'EXACT_FOLDER' }));
      const r = await api(cfg, ctx, 'POST', P.files, fd); const j = r.json || {};
      if (!j.url) throw CMS.err('HubSpot did not return the file URL', { status: r.status, hint: 'the private app needs the files scope' });
      return { id: String(j.id || ''), url: j.url, width: j.width || asset.width, height: j.height || asset.height, mime, reused: false };
    },
    upsertPage,
  });
})();
