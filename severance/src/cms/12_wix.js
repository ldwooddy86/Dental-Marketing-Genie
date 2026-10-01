/* ==== cms_wix ==== */
"use strict";
/* ============================ Wix: CMS collection items (dynamic page) or Blog draft posts ============================
   Wix has no endpoint that creates a site page from HTML, so this adapter feeds one of the two content models the
   platform does expose over REST:
     cms  · one data item per page in a CMS collection. A Rich Text field holds editorial HTML only (headings, paragraphs, lists, links, images; css, sections and forms dropped, no
            scripts); a dynamic page built once in the editor renders every item at the collection's dynamic path.
     blog · one draft post per page. The HTML becomes Ricos rich content, the only body format the Blog accepts; the
            JSON-LD is not representable there and is dropped (the SEO title, description, canonical and noindex are kept).
   Auth: an account API key (Wix: Settings, API Keys) sent as Authorization plus wix-site-id (and wix-account-id).
   No DOM, no app helpers: the same file runs inside the extension page and inside the Node test harness. */
(() => {
  const HOST = 'https://www.wixapis.com';
  /* Data Items v2. Query: https://dev.wix.com/docs/rest/business-solutions/cms/data-items/query-data-items
     Insert: https://dev.wix.com/docs/rest/business-solutions/cms/data-items/insert-data-item
     Update (PUT /items/{dataItem.id}, replaces data): https://dev.wix.com/docs/rest/api-reference/wix-data/data-items/update-data-item */
  const DATA = 'wix-data/v2';
  /* Blog v3. Create draft (publish flag): https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/create-draft-post
     Publish draft: https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/publish-draft-post
     Query drafts: https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/query-draft-posts
     Post by slug: https://dev.wix.com/docs/api-reference/business-solutions/blog/posts-stats/get-post-by-slug */
  const BLOG = 'blog/v3';
  /* Media Manager: https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/generate-file-upload-url
     then PUT the bytes to uploadUrl?filename=: https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/upload-api */
  const MEDIA = 'site-media/v1';
  /* Site Properties (preview API; the site name): https://dev.wix.com/docs/rest/api-reference/business-tools/site-properties/properties/get-site-properties */
  const PROPS = 'site-properties/v4';
  /* Headers: https://dev.wix.com/docs/rest/articles/get-started/api-keys (Authorization: <key>, wix-site-id for site calls, wix-account-id) */
  const DOCS = 'https://dev.wix.com/docs/rest/articles/get-started/api-keys';
  const API = `Wix REST · ${DATA} · ${BLOG} · ${MEDIA} · ${PROPS} · API key`;
  const TITLE_MAX = 200, EXCERPT_MAX = 500;                     /* Blog validation limits on draftPost.title and draftPost.excerpt */
  const DYN_PATH = '/pages/{slug}', BLOG_PATH = '/post/{slug}';  /* dynamic page path; Wix Blog posts live under /post/ by default */

  /* ---------- url, auth, small helpers ---------- */
  const base = cfg => CMS.trimSlash(cfg.apiBase || HOST);
  const val = (cfg, k, d) => { const v = cfg[k] == null ? '' : String(cfg[k]).trim(); return v || d || ''; };
  const mode = cfg => val(cfg, 'mode', 'cms') === 'blog' ? 'blog' : 'cms';
  const coll = cfg => val(cfg, 'collectionId', 'Pages');
  const fieldsOf = cfg => ({ title: val(cfg, 'titleField', 'title'), slug: val(cfg, 'slugField', 'slug'), body: val(cfg, 'bodyField', 'body'), metaTitle: val(cfg, 'metaTitleField', 'metaTitle'), metaDesc: val(cfg, 'metaDescField', 'metaDescription'), summary: val(cfg, 'summaryField', 'summary'), image: val(cfg, 'imageField'), schema: val(cfg, 'schemaField'), status: val(cfg, 'statusField') });
  const auth = cfg => { const h = { Authorization: val(cfg, 'apiKey'), 'wix-site-id': val(cfg, 'siteId') }; const a = val(cfg, 'accountId'); if (a) h['wix-account-id'] = a; return h; };
  const enc = encodeURIComponent;
  const cleanSlug = s => String(s || '').replace(/^\/+|\/+$/g, '');
  const safeName = f => (String(f || '').split('/').pop().split('?')[0].replace(/[^\w.\-]+/g, '-').replace(/^-+/, '')) || 'upload.bin';
  const headline = page => String(page.h1 || page.title || '').slice(0, TITLE_MAX);
  const excerpt = page => String(page.summary || page.excerpt || page.meta_description || '').slice(0, EXCERPT_MAX);
  const statusOf = (page, opts) => ((opts && opts.publish) || (page && page.status === 'publish')) ? 'publish' : 'draft';
  /* the media id inside a static.wixstatic.com/media/<id> url (what the Blog cover and Ricos images take) */
  const wixId = u => (String(u || '').match(/static\.wixstatic\.com\/media\/([^/?#]+)/) || [])[1] || '';
  const linkAt = (siteUrl, pattern, slug) => siteUrl ? CMS.trimSlash(siteUrl) + String(pattern || '').replace('{slug}', slug) : '';
  /* dashboard deep links (not API; best effort) */
  const dashCms = cfg => `https://manage.wix.com/dashboard/${enc(val(cfg, 'siteId'))}/database/data/${enc(coll(cfg))}`;
  const dashBlog = (cfg, id) => `https://manage.wix.com/dashboard/${enc(val(cfg, 'siteId'))}/blog/${id ? enc(id) + '/edit' : 'posts'}`;

  /* ---------- error hints ---------- */
  function hintFor(e) {
    const app = e.body && typeof e.body === 'object' && e.body.details && e.body.details.applicationError ? e.body.details.applicationError : null; const code = app ? String(app.code || '') : '';
    if (e.status === 401) return 'Check the API key (Wix: Settings, API Keys) and the site ID (the dashboard URL reads manage.wix.com/dashboard/<site id>/). Site calls need a key from the site owner account.';
    if (e.status === 403) return 'The key lacks a permission for this call. Edit it under Settings, API Keys and add Wix Data (Manage Data Items), Blog (Manage Blog) and Media Manager (Manage Media).';
    if (e.status === 404 || /NOT_FOUND|WDE0025/i.test(code)) return 'Not found. Check the collection ID (CMS, collection settings) or the post id, and the site ID.';
    if (e.status === 400) return 'Wix rejected the request. Check the field ids (CMS, collection settings, Manage Fields) and that the body field is Rich Text.';
    if (e.status === 429) return 'Wix rate limit reached; wait a minute and try again.';
    if (e.status === 0) return 'Could not reach www.wixapis.com; check the network.';
    return '';
  }
  /* One request against {base}/{path}. Never swallows a non 2xx unless o.tolerate: the error gains a hint and is rethrown. */
  async function req(cfg, method, path, body, o) {
    o = o || {}; const headers = Object.assign(auth(cfg), o.headers || {});
    try { return await CMS.http(base(cfg) + '/' + String(path).replace(/^\//, ''), { method, headers, body, raw: !!o.raw, expect: o.expect || 'auto', timeout: o.timeout, tolerate: !!o.tolerate }); }
    catch (e) { if (!e.hint) e.hint = hintFor(e); if (!e.adapter) e.adapter = 'wix'; throw e; }
  }
  async function siteName(cfg) { const r = await req(cfg, 'GET', `${PROPS}/properties`, undefined, { tolerate: true }); const p = r.ok && r.json && typeof r.json === 'object' ? (r.json.properties || r.json) : null; return { ok: r.ok, status: r.status, name: p ? (p.siteDisplayName || p.businessName || '') : '' }; }

  /* ============================ cms mode: one data item per page ============================ */
  async function findItem(cfg, slug) {
    const F = fieldsOf(cfg); const j = (await req(cfg, 'POST', `${DATA}/items/query`, { dataCollectionId: coll(cfg), query: { filter: { [F.slug]: { $eq: slug } }, paging: { limit: 1 } } })).json || {};
    const it = (Array.isArray(j.dataItems) ? j.dataItems : [])[0]; return it && it.id ? it : null;
  }
  function itemData(cfg, page, status) {
    const F = fieldsOf(cfg); const seo = page.seo || {}; const d = { [F.title]: headline(page), [F.slug]: cleanSlug(page.slug), [F.body]: CMS.richText(CMS.rewriteMedia(page.html, page.mediaMap || {})) };   /* a Wix Rich Text field keeps editorial HTML only (headings, paragraphs, lists, links, images); css, sections, forms and scripts are dropped, the dynamic page styles it */
    if (F.metaTitle) d[F.metaTitle] = seo.title || page.title || ''; if (F.metaDesc) d[F.metaDesc] = seo.description || page.meta_description || ''; if (F.summary) d[F.summary] = page.summary || page.excerpt || '';
    if (F.image && page.featured_media_url) d[F.image] = page.featured_media_url; if (F.schema && page.schema) d[F.schema] = JSON.stringify(page.schema); if (F.status) d[F.status] = status;
    return d;
  }
  async function upsertItem(cfg, page, opts, ctx) {
    const slug = cleanSlug(page.slug); const status = statusOf(page, opts); const F = fieldsOf(cfg); const ex = await findItem(cfg, slug); const data = itemData(cfg, page, status); let j;
    if (ex) j = (await req(cfg, 'PUT', `${DATA}/items/${enc(ex.id)}`, { dataCollectionId: coll(cfg), dataItem: { id: ex.id, data: Object.assign({ _id: ex.id }, data) } })).json || {};
    else j = (await req(cfg, 'POST', `${DATA}/items`, { dataCollectionId: coll(cfg), dataItem: { data } })).json || {};
    const id = (j.dataItem && j.dataItem.id) || (ex && ex.id) || ''; const link = linkAt(cfg.siteUrl, val(cfg, 'dynamicPath', DYN_PATH), slug);
    const notes = [F.schema && page.schema ? `JSON-LD in field ${F.schema} (print it from a page level embed)` : 'JSON-LD dropped: set a schema field to keep it', F.status ? `status ${status} written to ${F.status}` : 'data items are live as soon as they are saved (set a status field to filter drafts on the dynamic page)'];
    if (ctx && ctx.log) ctx.log(`wix cms: ${ex ? 'updated' : 'inserted'} ${coll(cfg)} item ${id}`);
    return { id, link: link || id, edit: dashCms(cfg), status: F.status ? status : 'publish', updated: !!ex, notes: notes.join('; ') };
  }

  /* ============================ blog mode: one draft post per page, Ricos content ============================ */
  /* Ricos document: https://dev.wix.com/docs/api-reference/articles/work-with-wix-apis/platform/about-rich-content
     TEXT nodes sit inside PARAGRAPH or HEADING (headingData.level); lists are BULLETED_LIST > LIST_ITEM > PARAGRAPH; IMAGE carries
     imageData.image.src ({id} for a Media Manager file, {url} otherwise) and altText. Decorations: BOLD (fontWeightValue), ITALIC (italicData), LINK (linkData.link.url). */
  const rid = () => Math.random().toString(36).slice(2, 10);
  function textNodes(html) {
    return CMS.inlineRuns(html).map(r => { const d = []; if (r.bold) d.push({ type: 'BOLD', fontWeightValue: 700 }); if (r.italic) d.push({ type: 'ITALIC', italicData: true });
      if (r.link) d.push({ type: 'LINK', linkData: { link: { url: r.link, target: /^https?:\/\//i.test(r.link) ? 'BLANK' : 'SELF' } } }); return { type: 'TEXT', id: rid(), nodes: [], textData: { text: r.text, decorations: d } }; });
  }
  const para = html => ({ type: 'PARAGRAPH', id: rid(), nodes: textNodes(html), paragraphData: {} });
  const imageSrc = u => { const id = wixId(u); return id ? { id } : { url: u }; };
  function ricos(html) {
    const src = String(html || '').replace(/<\/?(details|summary)\b[^>]*>/gi, ''); const nodes = []; let list = null;
    for (const b of CMS.htmlToBlocks(src)) {
      if (b.type === 'li') { if (!list) { list = { type: 'BULLETED_LIST', id: rid(), nodes: [] }; nodes.push(list); } list.nodes.push({ type: 'LIST_ITEM', id: rid(), nodes: [para(b.text)] }); continue; }
      list = null;
      if (b.type === 'heading') nodes.push({ type: 'HEADING', id: rid(), nodes: textNodes(b.text), headingData: { level: Math.min(6, Math.max(1, b.level || 2)) } });
      else if (b.type === 'quote') nodes.push({ type: 'BLOCKQUOTE', id: rid(), nodes: [para(b.text)] });
      else if (b.type === 'image') nodes.push({ type: 'IMAGE', id: rid(), nodes: [], imageData: { containerData: { width: { size: 'CONTENT' }, alignment: 'CENTER' }, image: { src: imageSrc(b.src) }, altText: b.alt || '' } });
      else nodes.push(para(b.text));
    }
    return { nodes };
  }
  /* seoData.tags: the SEO tags schema Wix objects share (title tag with children, meta and link tags with props) */
  function seoTags(page) {
    const seo = page.seo || {}; const tags = [{ type: 'title', children: seo.title || page.title || headline(page) }]; const d = seo.description || page.meta_description || '';
    if (d) tags.push({ type: 'meta', props: { name: 'description', content: d } }); if (seo.noindex || page.noindex) tags.push({ type: 'meta', props: { name: 'robots', content: 'noindex' } });
    const c = seo.canonical || page.canonical || ''; if (c) tags.push({ type: 'link', props: { rel: 'canonical', href: c } }); return { tags };
  }
  function draftBody(page) {
    const d = { title: headline(page), slug: cleanSlug(page.slug), excerpt: excerpt(page), richContent: ricos(page.html), seoData: seoTags(page) };
    const cover = (typeof page.featured_media_id === 'string' && page.featured_media_id) || wixId(page.featured_media_url); if (cover) d.media = { wixMedia: { image: { id: cover } }, displayed: true, custom: true };
    return d;
  }
  /* published post by slug first (posts and their drafts share an id); then an unpublished draft by title (title takes $eq, slug does not) */
  async function findPost(cfg, page) {
    const slug = cleanSlug(page.slug); let r = null;
    try { r = await req(cfg, 'GET', `${BLOG}/posts/slugs/${enc(slug)}`); } catch (e) { if (e.status !== 404) throw e; }   /* 404 = no published post with that slug; anything else surfaces */
    if (r && r.json && r.json.post && r.json.post.id) { const u = r.json.post.url || {}; return { id: r.json.post.id, published: true, url: u.base ? String(u.base) + String(u.path || '') : '' }; }
    const j = (await req(cfg, 'POST', `${BLOG}/draft-posts/query`, { query: { filter: { title: { $eq: headline(page) } }, paging: { limit: 1 } } })).json || {};
    const d = (Array.isArray(j.draftPosts) ? j.draftPosts : [])[0]; return d && d.id ? { id: d.id, published: d.status === 'PUBLISHED', url: '' } : null;
  }
  async function upsertPost(cfg, page, opts, ctx) {
    const publish = statusOf(page, opts) === 'publish'; const ex = await findPost(cfg, page); const draftPost = draftBody(page); let j, id;
    if (ex) { j = (await req(cfg, 'PATCH', `${BLOG}/draft-posts/${enc(ex.id)}`, { draftPost: Object.assign({ id: ex.id }, draftPost) })).json || {}; id = (j.draftPost && j.draftPost.id) || ex.id; if (publish) await req(cfg, 'POST', `${BLOG}/draft-posts/${enc(id)}/publish`); }
    else { j = (await req(cfg, 'POST', `${BLOG}/draft-posts`, { draftPost, publish })).json || {}; id = (j.draftPost && j.draftPost.id) || ''; }
    const slug = cleanSlug(page.slug); const link = (ex && ex.url) || linkAt(cfg.siteUrl, val(cfg, 'blogPath', BLOG_PATH), slug);
    const notes = ['Ricos content: headings, paragraphs, lists (all bulleted), links and images kept; forms, videos, tables and JSON-LD dropped', draftPost.media ? 'cover image set' : (page.featured_media_url ? 'cover image skipped: upload media through Wix to set it' : ''), (ex && ex.published && !publish) ? 'the live post keeps its old content until this draft is published' : ''].filter(Boolean);
    if (ctx && ctx.log) ctx.log(`wix blog: ${ex ? 'updated' : 'created'} draft post ${id}${publish ? ', published' : ''}`);
    return { id, link: link || id, edit: dashBlog(cfg, id), status: publish ? 'publish' : 'draft', updated: !!ex, notes: notes.join('; ') };
  }

  /* ============================ media: generate an upload url, PUT the bytes ============================ */
  async function uploadMedia(cfg, asset, ctx) {
    const mime = asset.mime || (asset.blob && asset.blob.type) || 'application/octet-stream'; const file = safeName(asset.file || ('upload.' + CMS.extOf('', mime)));
    const g = (await req(cfg, 'POST', `${MEDIA}/files/generate-upload-url`, { mimeType: mime, fileName: file })).json || {};
    if (!g.uploadUrl) throw CMS.err('Wix returned no upload URL', { adapter: 'wix', hint: 'The key needs the Media Manager (Manage Media) permission.', body: g });
    const url = g.uploadUrl + (g.uploadUrl.includes('?') ? '&' : '?') + 'filename=' + enc(file); let r;
    try { r = await CMS.http(url, { method: 'PUT', headers: { 'Content-Type': mime }, body: asset.blob, raw: true, expect: 'auto', timeout: 120000 }); }
    catch (e) { if (!e.hint) e.hint = 'The upload URL is single use and expires; run the deploy again.'; e.adapter = 'wix'; throw e; }
    const f = (r.json && typeof r.json === 'object' && (r.json.file || r.json)) || {}; const img = ((f.media || {}).image || {}).image || {};
    if (ctx && ctx.log) ctx.log(`wix media: uploaded ${file} → ${f.url || f.id || '?'}`);
    return { id: f.id || '', url: f.url || '', width: img.width || asset.width || 0, height: img.height || asset.height || 0, mime: f.mimeType || mime, alt: asset.alt || '', reused: false };
  }

  CMS.register({
    id: 'wix', name: 'Wix', group: 'Wix (CMS collections and Blog)', docs: DOCS,
    blurb: 'API key; pages land as CMS collection items behind a dynamic page, or as Blog draft posts. Wix has no page from HTML endpoint.',
    setup: [
      'Wix: Settings (account level), API Keys, Generate API key. Give it Wix Data, Blog and Media Manager permissions. Copy the key and the account ID.',
      'The site ID is in the dashboard URL: manage.wix.com/dashboard/<site id>/. Paste it below.',
      'CMS mode: create a collection (default id Pages) with the fields title, slug, body (Rich Text), metaTitle, metaDescription, summary (and optional schema, image, status). Build one dynamic page on it and set its SEO title and description from the item fields; note the dynamic page path (/pages/{slug} by default).',
      'Blog mode: no setup. Pages arrive as draft posts under /post/<slug>; the JSON-LD cannot be carried and is dropped.',
      'Fill the site URL to get working links in the ledger.',
    ],
    fields: [
      { k: 'apiKey', l: 'API key', t: 'password', secret: true, hint: 'Settings, API Keys (account level). Sent as the Authorization header.' },
      { k: 'siteId', l: 'Site ID', t: 'text', hint: 'From the dashboard URL manage.wix.com/dashboard/<site id>/ (the wix-site-id header)' },
      { k: 'accountId', l: 'Account ID', t: 'text', optional: true, hint: 'Shown next to the key under API Keys (the wix-account-id header)' },
      { k: 'mode', l: 'Content model', t: 'select', def: 'cms', opts: [{ v: 'cms', l: 'CMS collection item (dynamic page)' }, { v: 'blog', l: 'Blog draft post' }] },
      { k: 'collectionId', l: 'Collection ID', t: 'text', def: 'Pages', optional: true, hint: 'CMS mode: the collection id from its settings' },
      { k: 'titleField', l: 'Title field', t: 'text', def: 'title', optional: true }, { k: 'slugField', l: 'Slug field', t: 'text', def: 'slug', optional: true },
      { k: 'bodyField', l: 'Body field (Rich Text)', t: 'text', def: 'body', optional: true, hint: 'Receives the page copy as editorial HTML (headings, paragraphs, lists, links, images); the dynamic page styles it' },
      { k: 'metaTitleField', l: 'Meta title field', t: 'text', def: 'metaTitle', optional: true }, { k: 'metaDescField', l: 'Meta description field', t: 'text', def: 'metaDescription', optional: true },
      { k: 'summaryField', l: 'Summary field', t: 'text', def: 'summary', optional: true },
      { k: 'schemaField', l: 'Schema field', t: 'text', optional: true, hint: 'Optional text field for the JSON-LD string' },
      { k: 'imageField', l: 'Image field', t: 'text', optional: true, hint: 'Optional image or URL field for the hero image' },
      { k: 'statusField', l: 'Status field', t: 'text', optional: true, hint: 'Optional text field that receives draft or publish' },
      { k: 'siteUrl', l: 'Site URL', t: 'url', optional: true, hint: 'https://www.example.com, used to build links' },
      { k: 'dynamicPath', l: 'Dynamic page path', t: 'text', def: DYN_PATH, optional: true, hint: '{slug} is replaced by the page slug' },
      { k: 'blogPath', l: 'Blog post path', t: 'text', def: BLOG_PATH, optional: true },
    ],
    hosts: ['https://www.wixapis.com/*', 'https://*.wixmp.com/*'],
    caps: { media: true, urls: false, publishSite: false, elementor: false, schema: 'none', seo: true, postTypes: ['page', 'post'], modes: ['cms', 'blog'] },
    base,
    async test(cfg, ctx) {
      const md = mode(cfg); const s = await siteName(cfg); const m = { api: API, mode: md, site: s.name, warnings: [] };
      if (!s.ok) m.warnings.push(`Site properties not readable (HTTP ${s.status}); the key may lack the Site Properties permission.`);
      let info;
      if (md === 'cms') {
        const F = fieldsOf(cfg); const j = (await req(cfg, 'POST', `${DATA}/items/query`, { dataCollectionId: coll(cfg), query: { paging: { limit: 1 } }, returnTotalCount: true })).json || {};
        const pm = j.pagingMetadata || {}; const items = Array.isArray(j.dataItems) ? j.dataItems : []; m.collection = coll(cfg); m.items = pm.total != null ? pm.total : items.length; m.fields = F;
        const it = items[0]; if (it && it.data) for (const k of [F.title, F.slug, F.body]) if (!(k in it.data)) m.warnings.push(`Field ${k} is missing on the sampled item; check the field ids (CMS, collection settings).`);
        info = `${s.name || 'Wix site'}: collection ${m.collection} reachable, ${m.items} item${m.items === 1 ? '' : 's'} · fields ${F.title}, ${F.slug}, ${F.body} · items render on the dynamic page ${val(cfg, 'dynamicPath', DYN_PATH)}`;
      } else {
        const j = (await req(cfg, 'GET', `${BLOG}/posts?paging.limit=1`)).json || {}; const pm = j.pagingMetadata || {}; m.posts = pm.total != null ? pm.total : (Array.isArray(j.posts) ? j.posts.length : 0);
        info = `${s.name || 'Wix site'}: Blog reachable, ${m.posts} published post${m.posts === 1 ? '' : 's'} · pages land as draft posts (Ricos content) under ${val(cfg, 'blogPath', BLOG_PATH)}`;
      }
      if (m.warnings.length) info += ' · ' + m.warnings.join(' ');
      return { ok: true, info, meta: m };
    },
    async upsertPage(cfg, page, opts, ctx) { return mode(cfg) === 'blog' ? upsertPost(cfg, page, opts || {}, ctx) : upsertItem(cfg, page, opts || {}, ctx); },
    uploadMedia, ricos,
  });
})();
