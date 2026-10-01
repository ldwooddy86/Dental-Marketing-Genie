/* ==== cms_webflow ==== */
"use strict";
/* ============================ Webflow: CMS collection items ============================
   Webflow has no endpoint that creates a static page from HTML. Pages come from a CMS collection instead: one item per
   page; a collection template page built once in the designer renders the RichText body, and the mapped fields feed
   the page SEO settings. Items stay staged until published; the site publishes separately.
   RichText takes a limited HTML set (headings, paragraphs, lists, links, images, quotes), so the section wrappers are
   unwrapped, classes dropped, forms and videos removed. The JSON-LD goes into an optional plain text field.
   Auth: a site API token (Webflow: Site settings, Apps & integrations, API access) as a Bearer token with cms:read,
   cms:write, sites:read, sites:write (publish) and assets:write. No DOM, no app helpers. */
(() => {
  const HOST = 'https://api.webflow.com'; const V = 'v2';
  /* Auth and scopes: https://developers.webflow.com/data/reference/authentication · token info (needs no scope): https://developers.webflow.com/data/reference/token/introspect
     Site: https://developers.webflow.com/data/reference/sites/get (displayName, shortName, customDomains[{id,url}], lastPublished)
     Publish site (publishToWebflowSubdomain, customDomains ids; one publish a minute): https://developers.webflow.com/data/reference/sites/publish
     Collection: https://developers.webflow.com/data/reference/cms/collections/get (slug, fields[{slug, type: RichText | PlainText | Image ...}])
     Items: list with ?slug= https://developers.webflow.com/data/reference/cms/collection-items/staged-items/list-items ·
       create https://developers.webflow.com/data/reference/cms/collection-items/staged-items/create-items · update (PATCH /items/{item_id})
       https://developers.webflow.com/data/reference/cms/collection-items/staged-items/update-items · publish {itemIds} https://developers.webflow.com/data/reference/cms/collection-items/staged-items/publish-item
     Assets (fileName, md5 fileHash → uploadUrl, uploadDetails for an S3 form POST, hostedUrl): https://developers.webflow.com/data/reference/assets/assets/create
     Field values (RichText is HTML, Image takes a public URL, 4 MB): https://developers.webflow.com/data/reference/field-types-item-values
     Rate limit 60 a minute, 429 with Retry-After: https://developers.webflow.com/data/reference/rate-limits */
  const API = `Webflow Data API ${V} · site token (Bearer) · staged items, publish items, publish site, assets`;
  const DOCS = 'https://developers.webflow.com/data/reference/authentication';
  const RETRY_MAX_MS = 65000; const COLL_TTL = 5 * 60 * 1000; const COLL = new Map(); const SITES = new Map();   /* base+cid → {at, coll} · base+sid → {at, site} */
  const SCOPES = ['cms:read', 'cms:write', 'sites:read', 'sites:write', 'assets:write'];
  const KEEP = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'a', 'strong', 'b', 'em', 'i', 'blockquote', 'img', 'figure', 'figcaption', 'br', 'hr', 'sup', 'sub', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
  const DROP = ['script', 'style', 'iframe', 'video', 'audio', 'source', 'form', 'input', 'button', 'select', 'textarea', 'label', 'svg', 'noscript', 'object', 'embed', 'canvas', 'template'];
  const ATTRS = { a: ['href', 'target', 'rel', 'title'], img: ['src', 'alt', 'width', 'height', 'title'] };

  /* ---------- url, auth, small helpers ---------- */
  const val = (cfg, k, d) => { const v = cfg[k] == null ? '' : String(cfg[k]).trim(); return v || d || ''; };
  const base = cfg => CMS.trimSlash(cfg.apiBase || HOST);
  const enc = encodeURIComponent;
  const sid = cfg => val(cfg, 'siteId'); const cid = cfg => val(cfg, 'collectionId');
  const auth = cfg => ({ Authorization: 'Bearer ' + val(cfg, 'token'), Accept: 'application/json' });
  const fieldsOf = cfg => ({ name: val(cfg, 'nameField', 'name'), slug: val(cfg, 'slugField', 'slug'), body: val(cfg, 'bodyField', 'post-body'), summary: val(cfg, 'summaryField', 'summary'), metaTitle: val(cfg, 'metaTitleField', 'meta-title'), metaDesc: val(cfg, 'metaDescField', 'meta-description'), schema: val(cfg, 'schemaField'), image: val(cfg, 'imageField') });
  const cleanSlug = s => String(s || '').replace(/^\/+|\/+$/g, '');
  const safeName = f => (String(f || '').split('/').pop().split('?')[0].replace(/[^\w.\-]+/g, '-').replace(/^-+/, '')).slice(-99) || 'upload.bin';
  const headline = page => String(page.h1 || page.title || '');
  const statusOf = (page, opts) => ((opts && opts.publish) || (page && page.status === 'publish')) ? 'publish' : 'draft';

  /* ---------- error hints ---------- */
  function hintFor(e) {
    const code = String(e.code || (e.body && typeof e.body === 'object' && e.body.code) || '');
    if (e.status === 401) return 'Check the site API token (Webflow: Site settings, Apps & integrations, API access). Generating a new token replaces the old one.';
    if (e.status === 403 || code === 'missing_scopes') return 'The token lacks a scope. Generate it with cms:read, cms:write, sites:read, sites:write and assets:write.';
    if (e.status === 404) return 'Check the site ID (Site settings, General) and the collection ID (CMS, collection settings).';
    if (e.status === 409) return 'Conflict: another item already uses that slug or name, or the site was never published (publish it once from the designer before publishing items).';
    if (e.status === 400) return 'Webflow rejected a field value (validation_error). Check the field slugs and types in the collection settings: RichText takes HTML, Image takes a public URL.';
    if (e.status === 429) return 'Rate limit (60 calls a minute); the adapter already waited once. Try again in a minute.';
    if (e.status === 0) return 'Could not reach api.webflow.com; check the network.';
    return '';
  }
  function fail(r, url) {
    const j = r.json && typeof r.json === 'object' ? r.json : null; const msg = (j && (j.message || j.msg || j.err || (Array.isArray(j.details) && j.details.map(d => d.description || d.param || JSON.stringify(d)).join('; ')) || j.code)) || (r.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) || ('HTTP ' + r.status);
    const e = CMS.err(`${r.status} ${msg}`, { status: r.status, body: j || r.text, url, adapter: 'webflow', code: j ? j.code : '' }); e.hint = hintFor(e); return e;
  }
  /* One request against {base}/v2/{path}. A 429 waits for Retry-After (capped) and retries once; other non 2xx throw with a hint. */
  async function req(cfg, method, path, body, o, again) {
    o = o || {}; const url = `${base(cfg)}/${V}/${String(path).replace(/^\//, '')}`; let r;
    try { r = await CMS.http(url, { method, headers: Object.assign(auth(cfg), o.headers || {}), body, raw: !!o.raw, expect: o.expect || 'auto', timeout: o.timeout, tolerate: true }); }
    catch (e) { if (!e.hint) e.hint = hintFor(e); e.adapter = 'webflow'; throw e; }
    if (r.status === 429 && !again) { const ra = parseInt((r.headers && r.headers.get && r.headers.get('retry-after')) || '60', 10); const ms = Math.min(RETRY_MAX_MS, Math.max(0, (isNaN(ra) ? 60 : ra) * 1000)); if (o.ctx && o.ctx.log) o.ctx.log(`webflow: rate limited, waiting ${Math.round(ms / 1000)} s`); await CMS.sleep(ms); return req(cfg, method, path, body, o, true); }
    if (!r.ok && !o.tolerate) throw fail(r, url); return r;
  }
  async function collection(cfg, ctx, fresh) {
    const k = base(cfg) + '|' + cid(cfg); const c = COLL.get(k); if (!fresh && c && Date.now() - c.at < COLL_TTL) return c.coll;
    const coll = (await req(cfg, 'GET', `collections/${enc(cid(cfg))}`, undefined, { ctx })).json || {}; COLL.set(k, { at: Date.now(), coll }); return coll;
  }
  async function siteInfo(cfg, ctx, fresh) {
    const k = base(cfg) + '|' + sid(cfg); const c = SITES.get(k); if (!fresh && c && Date.now() - c.at < COLL_TTL) return c.site;
    const site = (await req(cfg, 'GET', `sites/${enc(sid(cfg))}`, undefined, { ctx })).json || {}; SITES.set(k, { at: Date.now(), site }); return site;
  }
  /* site dashboard deep link (not API; best effort): https://webflow.com/dashboard/sites/<shortName> */
  const dashboard = s => s && s.shortName ? `https://webflow.com/dashboard/sites/${enc(s.shortName)}` : '';

  /* ---------- RichText: the subset of HTML the field keeps ---------- */
  function richText(html) {
    let h = CMS.stripScripts(String(html || '')).replace(/<style[\s\S]*?<\/style>/gi, '');
    for (const t of DROP) h = h.replace(new RegExp(`<${t}\\b[^>]*>[\\s\\S]*?<\\/${t}>`, 'gi'), '').replace(new RegExp(`<${t}\\b[^>]*\\/?>`, 'gi'), '');
    h = h.replace(/<dt\b[^>]*>([\s\S]*?)<\/dt>/gi, '<p><strong>$1</strong></p>').replace(/<dd\b[^>]*>([\s\S]*?)<\/dd>/gi, '<p>$1</p>').replace(/<!--[\s\S]*?-->/g, '');
    h = h.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (m, tag, attrs) => { tag = tag.toLowerCase(); if (!KEEP.has(tag)) return ''; if (m[1] === '/') return `</${tag}>`;
      const out = []; for (const k of (ATTRS[tag] || [])) { const v = (attrs.match(new RegExp(`(?:^|\\s)${k}="([^"]*)"`, 'i')) || [])[1]; if (v != null) out.push(`${k}="${v}"`); } return `<${tag}${out.length ? ' ' + out.join(' ') : ''}>`; });
    return h.replace(/<p>\s*<\/p>/gi, '').replace(/[ \t]*\n[ \t\n]*/g, '\n').trim();
  }
  const heroAlt = page => { const m = Object.values(page.media || {}).find(x => x && x.url && x.url === page.featured_media_url); return (m && m.alt) || ''; };
  /* an Image field takes {url, alt} (fileId when the hero was uploaded to this site); a Link or PlainText field takes the url */
  const imageValue = (page, type) => { if (type && type !== 'Image' && type !== 'MultiImage') return page.featured_media_url; const v = { url: page.featured_media_url, alt: heroAlt(page) }; if (typeof page.featured_media_id === 'string' && /^[0-9a-f]{24}$/i.test(page.featured_media_id)) v.fileId = page.featured_media_id; return type === 'MultiImage' ? [v] : v; };
  /* fieldData: the built in name and slug always (every collection has them and the slug lookup keys on fieldData.slug), the mapped
     name, slug and body, then the optional mappings only when the collection has that field */
  function fieldData(cfg, page, coll, notes) {
    const F = fieldsOf(cfg); const seo = page.seo || {}; const fields = coll && Array.isArray(coll.fields) ? coll.fields.filter(Boolean) : null; const have = fields ? new Set(fields.map(f => f.slug)) : null; const ok = k => !!k && (!have || have.has(k)); const typeOf = k => ((fields || []).find(f => f.slug === k) || {}).type || '';
    const slug = cleanSlug(page.slug); const d = { name: headline(page), slug, [F.body]: richText(page.html) };
    const put = (k, v, what) => { if (!k || v == null || v === '') return; if (ok(k)) d[k] = v; else notes.push(`${what} skipped: no field ${k} on the collection`); };
    if (F.name !== 'name') put(F.name, headline(page), 'mapped name'); if (F.slug !== 'slug') put(F.slug, slug, 'mapped slug');
    put(F.summary, page.summary || page.excerpt || '', 'summary'); put(F.metaTitle, seo.title || page.title || '', 'meta title'); put(F.metaDesc, seo.description || page.meta_description || '', 'meta description');
    if (page.schema) { if (F.schema) put(F.schema, JSON.stringify(page.schema), 'JSON-LD'); else notes.push('JSON-LD dropped: set a schema field (plain text) and print it from an embed on the template page'); }
    if (page.featured_media_url) put(F.image, imageValue(page, typeOf(F.image)), 'hero image');
    return d;
  }
  /* the slug filter narrows the list; only an exact fieldData.slug match counts (never a random first item) */
  async function findItem(cfg, slug, ctx) {
    const j = (await req(cfg, 'GET', `collections/${enc(cid(cfg))}/items?slug=${enc(slug)}&limit=1`, undefined, { ctx })).json || {}; const items = Array.isArray(j.items) ? j.items : [];
    return items.find(i => i && i.fieldData && i.fieldData.slug === slug) || null;
  }
  async function publishSite(cfg, ctx) {
    const s = await siteInfo(cfg, ctx, true); const all = Array.isArray(s.customDomains) ? s.customDomains.filter(d => d && d.id) : []; const domains = cfg.stagingOnly ? [] : all.map(d => d.id);
    const body = { publishToWebflowSubdomain: true }; if (domains.length) body.customDomains = domains;
    await req(cfg, 'POST', `sites/${enc(sid(cfg))}/publish`, body, { ctx });
    const info = `${s.displayName || sid(cfg)} published to ${s.shortName ? s.shortName + '.webflow.io' : 'the webflow.io subdomain'}${domains.length ? ' and ' + all.map(d => d.url).filter(Boolean).join(', ') : ''}`;
    if (ctx && ctx.log) ctx.log('webflow: ' + info); return { ok: true, info };
  }
  /* two steps: register the file (md5 of the bytes), then an S3 form POST with every uploadDetails field before the file */
  async function uploadMedia(cfg, asset, ctx) {
    const mime = asset.mime || (asset.blob && asset.blob.type) || 'application/octet-stream'; const file = safeName(asset.file || ('upload.' + CMS.extOf('', mime))); const hash = CMS.md5(await CMS.blobBytes(asset.blob));
    const j = (await req(cfg, 'POST', `sites/${enc(sid(cfg))}/assets`, { fileName: file, fileHash: hash }, { ctx })).json || {};
    const out = { id: j.id || '', url: j.hostedUrl || j.assetUrl || '', width: asset.width || 0, height: asset.height || 0, mime, alt: asset.alt || '', reused: false };
    if (!j.uploadUrl || !j.uploadDetails || typeof j.uploadDetails !== 'object') { if (out.url) { out.reused = true; return out; } throw CMS.err('Webflow returned no upload URL for the asset', { adapter: 'webflow', hint: 'The token needs the assets:write scope.', body: j }); }
    const fd = new FormData(); for (const [k, v] of Object.entries(j.uploadDetails)) fd.append(k, String(v)); fd.append('file', asset.blob, file);
    try { await CMS.http(j.uploadUrl, { method: 'POST', body: fd, expect: 'text', timeout: 120000 }); }
    catch (e) { e.adapter = 'webflow'; if (!e.hint) e.hint = 'The S3 form fields must be sent exactly as returned and before the file; the upload URL expires after a few minutes.'; throw e; }
    if (ctx && ctx.log) ctx.log(`webflow media: uploaded ${file} → ${out.url}`); return out;
  }

  CMS.register({
    id: 'webflow', name: 'Webflow', group: 'Webflow (CMS collection)', docs: DOCS,
    blurb: 'Site API token; every page is a CMS collection item rendered by a collection template page. Webflow has no page from HTML endpoint.',
    setup: [
      'Webflow: Site settings, Apps & integrations, API access, Generate API token with cms:read, cms:write, sites:read, sites:write and assets:write. Copy the token once.',
      'Create a collection (for example Pages) with a RichText field for the body plus plain text fields for the summary, meta title and meta description (and optional schema and image fields). The collection ID is in its settings; the site ID under Site settings, General.',
      'Design the collection template page: bind a Rich Text element to the body field and the page SEO settings to the meta fields. A code embed can print the schema field inside a script tag.',
      'Pages arrive as staged drafts. Tick Publish items to push them live, Publish site to republish the whole site (custom domains included unless Subdomain only is ticked).',
      'Fill the site URL to get working links in the ledger.',
    ],
    fields: [
      { k: 'token', l: 'Site API token', t: 'password', secret: true, hint: 'Site settings, Apps & integrations, API access' },
      { k: 'siteId', l: 'Site ID', t: 'text', hint: 'Site settings, General' },
      { k: 'collectionId', l: 'Collection ID', t: 'text', hint: 'CMS, collection settings' },
      { k: 'nameField', l: 'Name field', t: 'text', def: 'name', optional: true }, { k: 'slugField', l: 'Slug field', t: 'text', def: 'slug', optional: true },
      { k: 'bodyField', l: 'Body field (RichText)', t: 'text', def: 'post-body', optional: true, hint: 'Field slug of the RichText field' },
      { k: 'summaryField', l: 'Summary field', t: 'text', def: 'summary', optional: true }, { k: 'metaTitleField', l: 'Meta title field', t: 'text', def: 'meta-title', optional: true },
      { k: 'metaDescField', l: 'Meta description field', t: 'text', def: 'meta-description', optional: true },
      { k: 'schemaField', l: 'Schema field', t: 'text', optional: true, hint: 'Optional plain text field for the JSON-LD string' },
      { k: 'imageField', l: 'Image field', t: 'text', optional: true, hint: 'Optional image field for the hero image' },
      { k: 'publishItems', l: 'Publish items when publishing', t: 'checkbox', optional: true },
      { k: 'publishSite', l: 'Publish the site after each published page', t: 'checkbox', optional: true },
      { k: 'stagingOnly', l: 'Site publish: webflow.io subdomain only', t: 'checkbox', optional: true },
      { k: 'siteUrl', l: 'Site URL', t: 'url', optional: true, hint: 'https://www.example.com, used to build links' },
    ],
    hosts: ['https://api.webflow.com/*', 'https://webflow-prod-assets.s3.amazonaws.com/*'],
    caps: { media: true, urls: false, publishSite: true, elementor: false, schema: 'none', seo: true, postTypes: ['page', 'post'] },
    base,
    async test(cfg, ctx) {
      const m = { api: API, warnings: [] }; const F = fieldsOf(cfg);
      const t = (await req(cfg, 'GET', 'token/introspect', undefined, { ctx })).json || {}; const a = t.authorization || {}; m.scopes = String(a.scope || '').split(/[\s,]+/).filter(Boolean); m.rateLimit = a.rateLimit || 0;
      const missing = SCOPES.filter(s => m.scopes.length && !m.scopes.includes(s)); if (missing.length) m.warnings.push(`Token lacks ${missing.join(', ')}.`);
      const s = await siteInfo(cfg, ctx, true); m.site = s.displayName || s.shortName || sid(cfg); m.shortName = s.shortName || ''; m.customDomains = (Array.isArray(s.customDomains) ? s.customDomains : []).map(d => d && d.url).filter(Boolean); m.lastPublished = s.lastPublished || '';
      const c = await collection(cfg, ctx, true); const fields = Array.isArray(c.fields) ? c.fields : []; m.collection = c.displayName || cid(cfg); m.collectionSlug = c.slug || ''; const typeOf = k => (fields.find(f => f && f.slug === k) || {}).type || ''; m.fields = {};
      for (const [what, k] of Object.entries(F)) { if (!k) continue; const ty = typeOf(k); m.fields[what] = { slug: k, type: ty || 'missing' }; if (!ty && ['name', 'slug', 'body'].includes(what)) m.warnings.push(`No field ${k} on the collection (${what}).`); else if (!ty) m.warnings.push(`Field ${k} (${what}) is not on the collection; that value is skipped.`); }
      const bt = typeOf(F.body); if (bt && bt !== 'RichText') m.warnings.push(`Field ${F.body} is ${bt}, not RichText: the page HTML will not render.`);
      const mapped = Object.values(F); const need = fields.filter(f => f && f.isRequired && !mapped.includes(f.slug)).map(f => f.slug); if (need.length) m.warnings.push(`Required collection fields not mapped: ${need.join(', ')}; Webflow may refuse items without them.`);
      let info = `${m.site}: token ok${m.scopes.length ? ' (' + m.scopes.join(' ') + ')' : ''} · collection ${m.collection} (/${m.collectionSlug || '?'}) · body ${F.body} ${bt || 'missing'} · ${m.customDomains.length ? m.customDomains.join(', ') : (m.shortName ? m.shortName + '.webflow.io' : 'no domain')} · last published ${m.lastPublished ? String(m.lastPublished).slice(0, 10) : 'never'}`;
      if (m.warnings.length) info += ' · ' + m.warnings.join(' ');
      return { ok: true, info, meta: m };
    },
    async upsertPage(cfg, page, opts, ctx) {
      opts = opts || {}; const publish = statusOf(page, opts) === 'publish'; const notes = []; const c = await collection(cfg, ctx); const slug = cleanSlug(page.slug); const ex = await findItem(cfg, slug, ctx);
      const body = { isArchived: false, isDraft: !publish, fieldData: fieldData(cfg, page, c, notes) };
      const j = (await req(cfg, ex ? 'PATCH' : 'POST', ex ? `collections/${enc(cid(cfg))}/items/${enc(ex.id)}` : `collections/${enc(cid(cfg))}/items`, body, { ctx })).json || {}; const id = j.id || (ex && ex.id) || '';
      let status = 'draft';
      if (publish && id) {
        if (cfg.publishItems) { const p = (await req(cfg, 'POST', `collections/${enc(cid(cfg))}/items/publish`, { itemIds: [id] }, { ctx })).json || {}; const errs = Array.isArray(p.errors) ? p.errors : []; if (errs.length) notes.push('publish items: ' + errs.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('; ')); else status = 'publish'; }
        else notes.push('item staged live (isDraft false); it goes out with the next site publish');
        if (cfg.publishSite) { const s = await publishSite(cfg, ctx); notes.push(s.info); status = 'publish'; }
      }
      const link = cfg.siteUrl ? `${CMS.trimSlash(cfg.siteUrl)}/${c.slug || cid(cfg)}/${slug}` : id; const cached = SITES.get(base(cfg) + '|' + sid(cfg));
      if (ctx && ctx.log) ctx.log(`webflow: ${ex ? 'updated' : 'created'} item ${id} (${status})`);
      return { id, link, edit: dashboard(cached ? cached.site : (await siteInfo(cfg, ctx))), status, updated: !!ex, notes: notes.join('; ') };
    },
    uploadMedia, publishSite, richText,
  });
})();
