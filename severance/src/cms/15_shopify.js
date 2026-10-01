/* ==== cms/shopify ==== */
"use strict";
/* Shopify Online Store pages and blog articles through the GraphQL Admin API (the REST Admin API is legacy since 2024-10).
   Auth: an Admin API access token from a custom app (Settings > Apps and sales channels > Develop apps), sent as
   X-Shopify-Access-Token (https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin).
   Every call is one POST to /admin/api/{version}/graphql.json (https://shopify.dev/docs/api/admin-graphql#endpoints).
   Pages: pages(query:"handle:...") then pageCreate / pageUpdate; posts: articles(query:"handle:... blog_id:...") then
   articleCreate / articleUpdate. SEO title and description go into the global.title_tag and global.description_tag metafields
   (https://shopify.dev/docs/apps/build/marketing-analytics/optimize-storefront-seo), noindex into seo.hidden; the page css
   and JSON-LD travel inline in the body (Shopify has no head slot per page). Images go through stagedUploadsCreate,
   a multipart POST to the staged target, fileCreate, then a node() poll until the MediaImage is READY. */
(() => {
  /* Newest stable version on 2026-09-27 (released 2026-07-01; 2026-10 is the release candidate). Each version lives 12 months.
     https://shopify.dev/docs/api/usage/versioning  https://shopify.dev/release-notes/2026-07 */
  const API_VERSION = '2026-07';
  const DOCS = 'https://shopify.dev/docs/api/admin-graphql';
  const STAGED_HOST = 'https://shopify-staged-uploads.storage.googleapis.com';   /* where stagedUploadsCreate targets point (manifest host) */
  const POLL = { tries: 10, ms: 1500 };   /* fileCreate is async: poll node(id) until fileStatus READY */
  const LIST = 250;                       /* connection maximum for first: https://shopify.dev/docs/api/usage/pagination-graphql */
  const LOOKUP = 10;                      /* handle lookups fetch a few and match the handle exactly on our side */
  const LIMITS = { title_tag: 255, description_tag: 320 };
  const SHOP = {};                        /* base → {name, myshopifyDomain, primaryDomain, store}, learned from the shop query */

  const H = ctx => (ctx && ctx.http) || CMS.http;
  const val = (cfg, k, d) => { const v = cfg[k]; return v != null && String(v).trim() !== '' ? String(v).trim() : d; };
  const cut = (s, n) => { const t = String(s == null ? '' : s).trim(); return t ? t.slice(0, n) : ''; };
  /* store.myshopify.com from whatever was pasted (a URL, a bare handle) */
  const shopDomain = cfg => { let s = val(cfg, 'shop', '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0]; if (s && !s.includes('.')) s += '.myshopify.com'; return s; };
  const storeHandle = cfg => shopDomain(cfg).replace(/\.myshopify\.com$/, '');
  const version = cfg => { const v = val(cfg, 'apiVersion', API_VERSION); if (!/^(\d{4}-\d{2}|unstable)$/.test(v)) throw CMS.err(`API version "${v}" is not a Shopify version (YYYY-MM)`, { status: 0, hint: 'leave it blank for ' + API_VERSION }); return v; };
  const base = cfg => CMS.trimSlash(cfg.apiBase || ('https://' + shopDomain(cfg)));
  const endpoint = cfg => `${base(cfg)}/admin/api/${version(cfg)}/graphql.json`;
  const numId = gid => String(gid || '').split('/').pop().split('?')[0];
  const blogGid = cfg => { const b = val(cfg, 'blogId', ''); if (!b) return ''; return /^gid:/.test(b) ? b : 'gid://shopify/Blog/' + b.replace(/\D/g, ''); };
  const handleOf = s => String(s || '').toLowerCase().replace(/^\/+|\/+$/g, '').split('/').pop().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 255) || 'page';
  const siteBase = (cfg, primary) => CMS.trimSlash(val(cfg, 'siteUrl', '') || primary || ('https://' + shopDomain(cfg)));
  const editPage = (cfg, gid) => `https://admin.shopify.com/store/${storeHandle(cfg)}/pages/${numId(gid)}`;
  const editArticle = (cfg, gid) => `https://admin.shopify.com/store/${storeHandle(cfg)}/content/articles/${numId(gid)}`;

  /* ---------- errors ---------- */
  function explain(e) {
    if (!(e instanceof CMS.CmsError) || e.hint) return e; const s = e.status;
    if (s === 401) e.hint = 'Shopify rejected the token: paste the Admin API access token (shpat_...) from the custom app; it is shown once, at install';
    else if (s === 402) e.hint = 'The store is frozen or the plan lapsed; reactivate it in Settings > Plan';
    else if (s === 403) e.hint = 'The app is not allowed: give the custom app the write_content and write_files scopes and reinstall it';
    else if (s === 404) e.hint = `Nothing answers at ${e.url || 'the store'}: check the store domain (store.myshopify.com) and the API version (${API_VERSION})`;
    else if (s === 423) e.hint = 'The store is locked; unlock it in the Shopify admin';
    else if (s === 429) e.hint = 'Rate limited; wait a few seconds and deploy again';
    return e;
  }
  const hintFor = errs => {
    const codes = errs.map(x => (x.extensions && x.extensions.code) || '').join(' ');
    if (/ACCESS_DENIED/.test(codes) || /access scope/i.test(errs.map(x => x.message).join(' '))) return 'Missing scope: open the custom app, Configuration, Admin API integration, tick write_content and write_files, save and reinstall, then paste the new token';
    if (/THROTTLED/.test(codes)) return 'Shopify throttled the request twice; wait a moment and deploy again';
    if (/undefinedField|doesn't exist on type|isn't a defined input type/i.test(errs.map(x => x.message).join(' '))) return `The API version ${API_VERSION} does not know a field this adapter sends; try a newer version in the field, or report it`;
    return '';
  };
  const throttleWait = ext => { const c = (ext && ext.cost) || {}; const t = c.throttleStatus || {}; const need = Math.max(0, (+c.requestedQueryCost || 0) - (+t.currentlyAvailable || 0)); const ms = t.restoreRate ? need / t.restoreRate * 1000 : 1000; return Math.min(10000, Math.max(250, ms)); };
  function userErrors(op, payload) {
    const errs = (payload && payload.userErrors) || []; if (!errs.length) return;
    throw CMS.err(`${op}: ` + errs.map(x => ((x.field && x.field.length) ? x.field.join('.') + ': ' : '') + x.message).join('; '), { status: 200, body: errs, hint: /taken|already/i.test(errs.map(x => x.message).join(' ')) ? 'the handle is in use by another page or article; change the slug' : 'Shopify rejected a field; fix the value and deploy again' });
  }

  /* ---------- GraphQL ---------- */
  /* One POST per operation. A throttled reply is HTTP 200 with errors[].extensions.code THROTTLED and the cost in extensions.cost
     (https://shopify.dev/docs/api/usage/limits#rate-limits): wait for the points to restore and retry once. */
  async function gql(cfg, ctx, op, query, variables) {
    const token = val(cfg, 'token', ''); if (!token) throw CMS.err('Paste the Admin API access token first', { status: 0, hint: 'Settings > Apps and sales channels > Develop apps > your app > API credentials' });
    /* the Admin API answers on the myshopify domain only; a custom domain redirects /admin to admin.shopify.com (HTML, not JSON) */
    if (!cfg.apiBase && !/\.myshopify\.com$/.test(shopDomain(cfg))) throw CMS.err(`"${shopDomain(cfg)}" is not a store.myshopify.com domain`, { status: 0, hint: 'Store domain is the myshopify.com domain (Settings > Domains); put the custom domain in "Public site URL"' });
    const headers = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json', Accept: 'application/json' };
    for (let attempt = 0; ; attempt++) {
      let r; try { r = await H(ctx)(endpoint(cfg), { method: 'POST', headers, body: { query, variables: variables || {} }, expect: 'json' }); }
      catch (e) { if (e.status === 429 && attempt < 1) { await CMS.sleep(1000); continue; } throw explain(e); }
      const j = r.json || {}; const errs = Array.isArray(j.errors) ? j.errors : (j.errors ? [{ message: String(j.errors) }] : []);
      if (errs.length) {
        if (attempt < 1 && errs.some(x => x.extensions && x.extensions.code === 'THROTTLED')) { const ms = throttleWait(j.extensions); if (ctx && ctx.log) ctx.log(`Shopify throttled ${op}; retrying in ${Math.round(ms)} ms`); await CMS.sleep(ms); continue; }
        throw CMS.err(`${op}: ` + errs.map(x => x.message).join('; '), { status: r.status, body: j, hint: hintFor(errs) });
      }
      return j.data || {};
    }
  }
  const META_FRAG = 'titleTag: metafield(namespace: "global", key: "title_tag") { id } descriptionTag: metafield(namespace: "global", key: "description_tag") { id } seoHidden: metafield(namespace: "seo", key: "hidden") { id }';
  const Q = {
    shop: 'query ForgeShop { shop { name myshopifyDomain primaryDomain { url host } plan { publicDisplayName partnerDevelopment } } }',
    scopes: 'query ForgeScopes { currentAppInstallation { accessScopes { handle } } }',
    blog: 'query ForgeBlog($id: ID!) { blog(id: $id) { id handle title } }',
    pageByHandle: `query ForgePageByHandle($q: String!) { shop { primaryDomain { url } } pages(first: ${LOOKUP}, query: $q) { nodes { id handle title isPublished ${META_FRAG} } } }`,
    pageCreate: 'mutation ForgePageCreate($page: PageCreateInput!) { pageCreate(page: $page) { page { id handle title isPublished } userErrors { code field message } } }',
    pageUpdate: 'mutation ForgePageUpdate($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { page { id handle title isPublished } userErrors { code field message } } }',
    articleByHandle: `query ForgeArticleByHandle($q: String!) { shop { primaryDomain { url } } articles(first: ${LOOKUP}, query: $q) { nodes { id handle title isPublished blog { id handle } ${META_FRAG} } } }`,
    articleCreate: 'mutation ForgeArticleCreate($article: ArticleCreateInput!) { articleCreate(article: $article) { article { id handle title isPublished blog { id handle } } userErrors { code field message } } }',
    articleUpdate: 'mutation ForgeArticleUpdate($id: ID!, $article: ArticleUpdateInput!) { articleUpdate(id: $id, article: $article) { article { id handle title isPublished blog { id handle } } userErrors { code field message } } }',
    pages: 'query ForgePages($after: String) { pages(first: ' + LIST + ', after: $after) { nodes { handle isPublished } pageInfo { hasNextPage endCursor } } }',
    articles: 'query ForgeArticles($after: String) { articles(first: ' + LIST + ', after: $after) { nodes { handle isPublished blog { handle } } pageInfo { hasNextPage endCursor } } }',
    staged: 'mutation ForgeStagedUploads($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }',
    fileCreate: 'mutation ForgeFileCreate($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id fileStatus alt ... on MediaImage { image { url width height } } } userErrors { code field message } } }',
    fileStatus: 'query ForgeFileStatus($id: ID!) { node(id: $id) { ... on MediaImage { id fileStatus fileErrors { code message } image { url width height } } } }',
  };

  /* ---------- content ---------- */
  /* SEO fields as metafields; on an update the existing metafield ids ride along so Shopify updates instead of duplicating
     (https://shopify.dev/docs/api/admin-graphql/latest/input-objects/MetafieldInput). seo.hidden = 1 adds noindex. */
  function metafields(page, ex) {
    const seo = page.seo || {}; const out = [];
    const put = (namespace, key, type, value, exKey) => { if (value === '' || value == null) return; const m = { namespace, key, type, value: String(value) }; if (ex && ex[exKey] && ex[exKey].id) m.id = ex[exKey].id; out.push(m); };
    put('global', 'title_tag', 'single_line_text_field', cut(seo.title || page.title, LIMITS.title_tag), 'titleTag');
    put('global', 'description_tag', 'single_line_text_field', cut(seo.description || page.meta_description, LIMITS.description_tag), 'descriptionTag');
    const noindex = !!(seo.noindex || page.noindex); if (noindex || (ex && ex.seoHidden)) put('seo', 'hidden', 'number_integer', noindex ? '1' : '0', 'seoHidden');
    return out;
  }
  const brandName = page => (((page.blueprint || {}).site || {}).brand || {}).name || '';
  function notesFor(page, publish, ex) {
    const n = ['SEO title and description in the global title_tag and description_tag metafields', 'css and JSON-LD inline in the body']; const seo = page.seo || {};
    if (seo.canonical || page.canonical) n.push('canonical not sent: Shopify themes print their own canonical tag');
    if (seo.noindex || page.noindex) n.push('noindex through the seo.hidden metafield (themes on Online Store 2.0 honour it)');
    if (ex && ex.isPublished && !publish) n.push('the page was live and is now unpublished (draft)');
    return n.join('; ');
  }

  /* ---------- media ---------- */
  async function uploadMedia(cfg, asset, ctx) {
    const mime = asset.mime || (asset.blob && asset.blob.type) || 'application/octet-stream';
    if (!/^image\//.test(mime)) throw CMS.err(`Shopify uploads here are images only (${mime})`, { status: 0, hint: 'host videos on YouTube or upload them in Content > Files and paste the URL' });
    const file = String(asset.file || ('image.' + CMS.extOf('', mime))).split('/').pop().replace(/[^a-zA-Z0-9._-]+/g, '-');
    const bytes = await CMS.blobBytes(asset.blob); const blob = new Blob([bytes], { type: mime });
    /* 1. staged target: https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate */
    const s = await gql(cfg, ctx, 'stagedUploadsCreate', Q.staged, { input: [{ filename: file, mimeType: mime, resource: 'IMAGE', httpMethod: 'POST', fileSize: String(bytes.length) }] });
    userErrors('stagedUploadsCreate', s.stagedUploadsCreate); const t = ((s.stagedUploadsCreate || {}).stagedTargets || [])[0];
    if (!t || !t.url || !t.resourceUrl) throw CMS.err('Shopify returned no staged upload target', { status: 200, hint: 'the app needs the write_files scope' });
    /* 2. multipart POST to the target: every parameter first, the file last (the docs are explicit about the order) */
    const fd = new FormData(); (t.parameters || []).forEach(p => fd.append(p.name, p.value)); fd.append('file', blob, file);
    try { await H(ctx)(t.url, { method: 'POST', body: fd, expect: 'text' }); } catch (e) { e.hint = e.hint || `The staged upload to ${CMS.originOf(t.url) || STAGED_HOST} failed; the target is valid for a short time, deploy again`; throw e; }
    /* 3. fileCreate from the staged resourceUrl: https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate */
    const c = await gql(cfg, ctx, 'fileCreate', Q.fileCreate, { files: [{ originalSource: t.resourceUrl, contentType: 'IMAGE', alt: asset.alt || '', filename: file }] });
    userErrors('fileCreate', c.fileCreate); let f = ((c.fileCreate || {}).files || [])[0];
    if (!f || !f.id) throw CMS.err('Shopify did not return the file', { status: 200, hint: 'the app needs the write_files scope' });
    /* 4. processing is asynchronous: poll until READY (https://shopify.dev/docs/api/admin-graphql/latest/enums/FileStatus) */
    for (let i = 0; i < POLL.tries && !(f.fileStatus === 'READY' && f.image && f.image.url); i++) {
      if (f.fileStatus === 'FAILED') throw CMS.err('Shopify could not process the image: ' + ((f.fileErrors || []).map(x => x.message).join('; ') || 'FAILED'), { status: 200, hint: 'use a JPEG, PNG, WEBP, GIF or SVG under 20 MB' });
      await CMS.sleep(POLL.ms); const d = await gql(cfg, ctx, 'fileStatus', Q.fileStatus, { id: f.id }); f = Object.assign({}, f, d.node || {});
    }
    if (!(f.image && f.image.url)) throw CMS.err(`The image is still ${f.fileStatus || 'processing'} after ${POLL.tries} checks`, { status: 200, hint: 'the file exists in Content > Files; deploy again in a minute and the page picks it up' });
    return { id: f.id, url: f.image.url, width: f.image.width || asset.width, height: f.image.height || asset.height, mime, reused: false };
  }

  /* ---------- pages and articles ---------- */
  async function upsertPage(cfg, page, opts, ctx) {
    const publish = !!(opts && opts.publish); const slug = handleOf(page.slug); const blog = blogGid(cfg); const asPost = page.post_type === 'post' && !!blog;
    if (page.post_type === 'post' && !blog && ctx && ctx.log) ctx.log(`${slug}: post_type post but no Blog id is set; created as a page`);
    const body = CMS.bodyHtml(page, { css: true, schema: true }); const suffix = val(cfg, 'templateSuffix', '');
    if (asPost) {
      const q = await gql(cfg, ctx, 'articles', Q.articleByHandle, { q: `handle:${slug} blog_id:${numId(blog)}` });
      const ex = ((q.articles || {}).nodes || []).find(n => n.handle === slug && (!n.blog || !n.blog.id || n.blog.id === blog)) || null; const primary = ((q.shop || {}).primaryDomain || {}).url;
      const article = { title: page.h1 || page.title, handle: slug, body, summary: cut(page.summary || page.excerpt, 1000) || null, isPublished: publish, metafields: metafields(page, ex), author: { name: val(cfg, 'author', '') || brandName(page) || (SHOP[base(cfg)] || {}).name || 'Editor' } };
      if (suffix) article.templateSuffix = suffix; if (page.featured_media_url) article.image = { url: page.featured_media_url, altText: (Object.values(page.media || {}).find(m => m && m.url === page.featured_media_url) || {}).alt || '' };
      let d; if (ex) d = await gql(cfg, ctx, 'articleUpdate', Q.articleUpdate, { id: ex.id, article }); else d = await gql(cfg, ctx, 'articleCreate', Q.articleCreate, { article: Object.assign({ blogId: blog }, article) });
      const p = d.articleUpdate || d.articleCreate || {}; userErrors(ex ? 'articleUpdate' : 'articleCreate', p); const got = p.article || {};
      if (!got.id) throw CMS.err('Shopify did not return the article', { status: 200, hint: 'check the Blog id in Test' });
      const bh = (got.blog && got.blog.handle) || 'news';
      return { id: got.id, link: `${siteBase(cfg, primary)}/blogs/${bh}/${got.handle || slug}`, edit: editArticle(cfg, got.id), status: got.isPublished ? 'publish' : 'draft', updated: !!ex, notes: notesFor(page, publish, ex) };
    }
    const q = await gql(cfg, ctx, 'pages', Q.pageByHandle, { q: `handle:${slug}` });
    const ex = ((q.pages || {}).nodes || []).find(n => n.handle === slug) || null; const primary = ((q.shop || {}).primaryDomain || {}).url;
    const input = { title: page.h1 || page.title, handle: slug, body, isPublished: publish, metafields: metafields(page, ex) }; if (suffix) input.templateSuffix = suffix;
    let d; if (ex) d = await gql(cfg, ctx, 'pageUpdate', Q.pageUpdate, { id: ex.id, page: input }); else d = await gql(cfg, ctx, 'pageCreate', Q.pageCreate, { page: input });
    const p = d.pageUpdate || d.pageCreate || {}; userErrors(ex ? 'pageUpdate' : 'pageCreate', p); const got = p.page || {};
    if (!got.id) throw CMS.err('Shopify did not return the page', { status: 200, hint: 'the app needs the write_content scope' });
    return { id: got.id, link: `${siteBase(cfg, primary)}/pages/${got.handle || slug}`, edit: editPage(cfg, got.id), status: got.isPublished ? 'publish' : 'draft', updated: !!ex, notes: notesFor(page, publish, ex) };
  }

  CMS.register({
    id: 'shopify', name: 'Shopify', group: 'Shopify (Online Store pages and blog)', blurb: 'GraphQL Admin API with a custom app token', docs: DOCS,
    setup: [
      'Settings > Apps and sales channels > Develop apps > Create an app. Configuration > Admin API integration: tick write_content (pages, blogs, articles) and write_files (image uploads). Install the app and copy the Admin API access token (shpat_...); it is shown once.',
      'Store domain is the store.myshopify.com domain, not the custom domain. Put the custom domain in "Public site URL" so links point at it.',
      'Pages land unpublished unless you tick publish. Posts need a Blog id (Test lists it when set; the id is the number at the end of the blog URL in the admin).',
      'SEO title and description go into the search engine listing (global metafields); the css and JSON-LD sit inline in the page body. Canonical tags come from the theme.',
      `The API version is pinned to ${API_VERSION}; change it only when Shopify retires that version.`,
    ],
    fields: [
      { k: 'shop', l: 'Store domain', t: 'text', hint: 'store.myshopify.com' },
      { k: 'token', l: 'Admin API access token', t: 'password', secret: true, hint: 'shpat_... from the custom app' },
      { k: 'apiVersion', l: 'API version', t: 'text', def: API_VERSION, optional: true, hint: `blank = ${API_VERSION}` },
      { k: 'blogId', l: 'Blog id (for posts)', t: 'text', optional: true, hint: 'number or gid://shopify/Blog/…; blank sends everything as pages' },
      { k: 'author', l: 'Post author name', t: 'text', optional: true, hint: 'blank uses the brand or store name' },
      { k: 'templateSuffix', l: 'Template suffix', t: 'text', optional: true, hint: 'page.<suffix>.json in the theme, for example forge' },
      { k: 'siteUrl', l: 'Public site URL', t: 'url', optional: true, hint: 'https://www.example.com; blank uses the primary domain' },
    ],
    hosts: ['https://*.myshopify.com/*', STAGED_HOST + '/*'],
    dynamicHost: cfg => { const o = CMS.originOf(base(cfg)); return /\.myshopify\.com$/i.test(o) ? '' : o; },
    caps: { media: true, urls: true, publishSite: false, elementor: false, schema: 'inline', seo: true, postTypes: ['page', 'post'] },
    base, version: () => API_VERSION,
    async test(cfg, ctx) {
      const d = await gql(cfg, ctx, 'shop', Q.shop); const s = d.shop || {}; if (!s.myshopifyDomain) throw CMS.err('Shopify answered without a shop', { status: 200, hint: 'check the store domain and the token' });
      let scopes = []; try { scopes = (((await gql(cfg, ctx, 'scopes', Q.scopes)).currentAppInstallation || {}).accessScopes || []).map(x => x.handle); } catch (e) { if (ctx && ctx.log) ctx.log('scopes not readable: ' + e.message); }
      const missing = scopes.length ? ['write_content', 'write_files'].filter(x => !scopes.includes(x)) : [];
      let blog = null; const bg = blogGid(cfg); if (bg) { const b = await gql(cfg, ctx, 'blog', Q.blog, { id: bg }); blog = b.blog || null; if (!blog) throw CMS.err(`No blog with id ${numId(bg)}`, { status: 404, hint: 'open Content > Blog posts > Manage blogs and copy the number at the end of the blog URL' }); }
      const primary = (s.primaryDomain || {}).url || ''; const plan = (s.plan || {}).publicDisplayName || (s.plan && s.plan.partnerDevelopment ? 'development' : '');
      SHOP[base(cfg)] = { name: s.name, myshopifyDomain: s.myshopifyDomain, primaryDomain: primary, store: storeHandle(cfg) };
      const info = `Shopify ${plan ? plan + ' ' : ''}"${s.name}" (${s.myshopifyDomain}), API ${version(cfg)}, site ${primary || 'no primary domain'}${scopes.length ? (missing.length ? ', missing scopes: ' + missing.join(', ') : ', scopes ok') : ''}${blog ? `, blog "${blog.title}" (/blogs/${blog.handle})` : ''}`;
      return { ok: true, info, meta: { name: s.name, myshopifyDomain: s.myshopifyDomain, primaryDomain: primary, store: storeHandle(cfg), apiVersion: version(cfg), plan, scopes, missing, blog } };
    },
    async listUrls(cfg, ctx) {
      const out = []; const site = siteBase(cfg, (SHOP[base(cfg)] || {}).primaryDomain);
      for (const [op, q, path] of [['pages', Q.pages, n => `${site}/pages/${n.handle}`], ['articles', Q.articles, n => `${site}/blogs/${(n.blog || {}).handle || 'news'}/${n.handle}`]]) {
        let after = null; let guard = 0;
        do { const d = await gql(cfg, ctx, op, q, { after }); const c = d[op] || {}; (c.nodes || []).forEach(n => { if (n.isPublished && n.handle) out.push(path(n)); }); after = c.pageInfo && c.pageInfo.hasNextPage ? c.pageInfo.endCursor : null; } while (after && guard++ < 40);
      }
      return out;
    },
    uploadMedia, upsertPage,
  });
})();
