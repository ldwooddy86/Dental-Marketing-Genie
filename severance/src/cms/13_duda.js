/* ==== cms_duda ==== */
"use strict";
/* ============================ Duda: inject HTML into a duplicated template page, or import a blog post ============================
   Duda has no endpoint that creates a page from HTML. Two supported routes:
     inject · the site has one template page with an HTML element carrying data-inject="<content key>". Per slug the adapter
              duplicates that page (Pages v2), sets title, path and SEO, then writes the section HTML (css and JSON-LD inline)
              into the element with the content injection API (INNERHTML). The live site shows it after a republish.
              Duda lists content injection as deprecated in favour of connected data; it still works and needs no collection.
     blog   · imports a blog post (title, description, author, date, HTML content) and publishes it when asked.
   Media: Duda pulls images from a public URL only (resources upload), so module 16 needs a media host for local files.
   Auth: Basic from the API user and password (Duda: Settings, API or Business Tools, API Access). No DOM, no app helpers. */
(() => {
  /* Regional hosts from the official client (Duda.Envs.direct, eu, sandbox): https://github.com/DudaDev/partner-api */
  const HOSTS = { us: 'https://api.duda.co', eu: 'https://api.eu.duda.co', sandbox: 'https://api-sandbox.duda.co' };
  /* Basic auth, every route under /api: https://developer.duda.co/docs/authentication */
  const ROOT = 'api'; const MS = 'sites/multiscreen';
  /* Site: https://developer.duda.co/reference/sites-get-site (site_default_domain, site_domain, publish_status)
     Pages v2: https://developer.duda.co/reference/pages-v2-list-pages · https://developer.duda.co/reference/pages-v2-duplicate-page ·
       https://developer.duda.co/reference/pages-v2-update-page (Page Object v2: uuid, title, path, seo{title, description, no_index, og_image})
     Inject (single page): https://developer.duda.co/reference/site-content-create-injected-content-single-page ([{type:'INNERHTML', key, value}])
     Blog: https://developer.duda.co/reference/blog-import-blog-post · https://developer.duda.co/reference/blog-list-blog-posts ·
       https://developer.duda.co/reference/blog-update-blog-post (PATCH) · https://developer.duda.co/reference/blog-publish-blog-post
     Publish: https://developer.duda.co/reference/sites-publish-site · Resources: https://developer.duda.co/reference/site-content-upload-resources */
  const API = 'Duda API · pages v2 · content injection · blog · resources · Basic auth';
  const DOCS = 'https://developer.duda.co/docs/authentication';
  const SITE_TTL = 5 * 60 * 1000; const SITES = new Map();   /* base+site → {at, site} */
  const TEMPLATE_PATH = 'forge-template';                    /* the page duplicated when no template uuid is set */
  const NO_BYTES = 'Duda uploads from a public URL; choose a media host in module 16 (WordPress, Shopify, Webflow, Ghost, HubSpot host files)';

  /* ---------- url, auth, small helpers ---------- */
  const val = (cfg, k, d) => { const v = cfg[k] == null ? '' : String(cfg[k]).trim(); return v || d || ''; };
  const region = cfg => { const r = val(cfg, 'region', 'us').toLowerCase(); return HOSTS[r] ? r : 'us'; };
  const base = cfg => CMS.trimSlash(cfg.apiBase || HOSTS[region(cfg)]);
  const enc = encodeURIComponent;
  const site = cfg => val(cfg, 'siteName');
  const sp = cfg => `${MS}/${enc(site(cfg))}`;
  const mode = cfg => val(cfg, 'mode', 'inject') === 'blog' ? 'blog' : 'inject';
  const key = cfg => val(cfg, 'contentKey', 'forge-content');
  const auth = cfg => ({ Authorization: CMS.basicAuth(val(cfg, 'apiUser'), val(cfg, 'apiPass')) });
  const rows = j => Array.isArray(j) ? j : (j && typeof j === 'object' ? (j.results || j.pages || j.posts || []) : []);
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const cleanSlug = s => String(s || '').replace(/^\/+|\/+$/g, '');
  const headline = page => String(page.h1 || page.title || '');
  const statusOf = (page, opts) => ((opts && opts.publish) || (page && page.status === 'publish')) ? 'publish' : 'draft';
  /* the address visitors use: the custom domain (site_domain) when one is connected, else the Duda default domain */
  const domainOf = s => String((s && (s.site_domain || s.site_default_domain)) || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const linkTo = (s, path) => { const d = domainOf(s); return d ? 'https://' + d + '/' + cleanSlug(path) : ''; };
  const editor = cfg => `https://my.duda.co/home/site/${enc(site(cfg))}`;   /* editor deep link, best effort */
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------- error hints ---------- */
  function hintFor(e) {
    if (e.status === 401) return 'Check the API user and password (Duda: Settings, API or Business Tools, API Access) and the region: US, EU and sandbox credentials differ.';
    if (e.status === 403) return 'This API user cannot act on that site: it belongs to another account, or the plan lacks API access for this feature.';
    if (e.status === 404) return 'Not found. The site name is the id in the editor URL (my.duda.co/home/site/<site name>); check it and the page or post id.';
    if (e.status === 400) return 'Duda rejected the request body. Check the page path (letters, digits, dashes) and the fields.';
    if (e.status === 429) return 'Duda rate limit reached; wait a minute and try again.';
    if (e.status === 0) return 'Could not reach the Duda API host; check the region.';
    return '';
  }
  /* One request against {base}/api/{path}. Never swallows a non 2xx unless o.tolerate: the error gains a hint and is rethrown. */
  async function req(cfg, method, path, body, o) {
    o = o || {}; const headers = Object.assign(auth(cfg), o.headers || {});
    try { return await CMS.http(`${base(cfg)}/${ROOT}/${String(path).replace(/^\//, '')}`, { method, headers, body, raw: !!o.raw, expect: o.expect || 'auto', timeout: o.timeout, tolerate: !!o.tolerate }); }
    catch (e) { if (!e.hint) e.hint = hintFor(e); if (!e.adapter) e.adapter = 'duda'; throw e; }
  }
  async function siteInfo(cfg, ctx, fresh) {
    const k = base(cfg) + '|' + site(cfg); const c = SITES.get(k); if (!fresh && c && Date.now() - c.at < SITE_TTL) return c.site;
    const s = (await req(cfg, 'GET', sp(cfg))).json || {}; SITES.set(k, { at: Date.now(), site: s }); if (ctx && ctx.log) ctx.log(`duda: ${site(cfg)} at ${domainOf(s) || 'no domain'} (${s.publish_status || 'status unknown'})`); return s;
  }
  const pages = async cfg => rows((await req(cfg, 'GET', `${sp(cfg)}/pages`)).json);
  async function publishSite(cfg, ctx) {
    await req(cfg, 'POST', `${MS}/publish/${enc(site(cfg))}`); const s = await siteInfo(cfg, ctx, true); const info = `${site(cfg)} published at https://${domainOf(s) || '?'}`;
    if (ctx && ctx.log) ctx.log('duda: ' + info); return { ok: true, info };
  }

  /* ============================ inject mode ============================ */
  async function upsertInject(cfg, page, opts, ctx) {
    const s = await siteInfo(cfg, ctx); const slug = cleanSlug(page.slug); const seo = page.seo || {}; const status = statusOf(page, opts); const k = key(cfg);
    const list = await pages(cfg); let pg = list.find(p => p && cleanSlug(p.path) === slug) || null; const existed = !!pg;
    if (!pg) {
      const tpl = val(cfg, 'templatePageUuid') || ((list.find(p => p && cleanSlug(p.path) === TEMPLATE_PATH) || list[0] || {}).uuid) || '';
      if (!tpl) throw CMS.err(`No page to duplicate on ${site(cfg)}`, { adapter: 'duda', hint: `Build one page in the editor with an HTML element that has data-inject="${k}", give it the path ${TEMPLATE_PATH} or paste its uuid in the template page field.` });
      const d = (await req(cfg, 'POST', `${sp(cfg)}/pages/${enc(tpl)}/duplicate`, { title: headline(page) })).json || {}; pg = { uuid: d.uuid || d.page_uuid || '', path: d.path || '' };
      if (!pg.uuid) throw CMS.err('Duda duplicated the page but returned no uuid', { adapter: 'duda', hint: 'Open the site in the editor, remove the copy and run the deploy again.', body: d });
      if (ctx && ctx.log) ctx.log(`duda: duplicated page ${tpl} → ${pg.uuid}`);
    }
    await req(cfg, 'PUT', `${sp(cfg)}/pages/${enc(pg.uuid)}`, { title: headline(page), path: slug, seo: { title: seo.title || page.title || '', description: seo.description || page.meta_description || '', no_index: !!(seo.noindex || page.noindex) } });
    await req(cfg, 'POST', `${MS}/inject-content/${enc(site(cfg))}/pages/${enc(slug)}`, [{ type: 'INNERHTML', key: k, value: CMS.bodyHtml(page, { css: true, schema: true, stripScripts: true }) }]);
    let published = false; if (status === 'publish' && cfg.publishAfter) { await publishSite(cfg, ctx); published = true; }
    if (ctx && ctx.log) ctx.log(`duda: ${existed ? 'updated' : 'created'} /${slug} (${pg.uuid})`);
    return { id: pg.uuid, link: linkTo(s, slug), edit: editor(cfg), status: published ? 'publish' : 'draft', updated: existed, notes: published ? 'content injected and the site republished' : 'content injected; the live site shows it after the next publish (tick Republish after publishing, or use Publish site)' };
  }

  /* ============================ blog mode ============================ */
  /* the import body: title, description, author, publish_date (yyyy-mm-dd), meta_title, main_image, thumbnail, no_index and the HTML content as one string */
  function postBody(cfg, page) {
    const seo = page.seo || {}; const b = { title: headline(page), description: page.meta_description || seo.description || page.summary || '', publish_date: (page.dates && page.dates.published) ? String(page.dates.published).slice(0, 10) : today(), meta_title: seo.title || page.title || '', content: CMS.bodyHtml(page, { css: false, schema: false, stripScripts: true }) };
    const author = val(cfg, 'author'); if (author) b.author = author; if (seo.noindex || page.noindex) b.no_index = true;
    if (/^https:\/\//i.test(page.featured_media_url || '')) { b.main_image = page.featured_media_url; b.thumbnail = page.featured_media_url; } return b;
  }
  /* List Blog Posts pages with limit and offset (max 100 a call, https://developer.duda.co/reference/blog-list-blog-posts); stops when a page is short or repeats. */
  async function allPosts(cfg) { const out = []; const seen = new Set(); for (let off = 0, i = 0; i < 20; i++, off += 100) { const page = rows((await req(cfg, 'GET', `${sp(cfg)}/blog/posts?limit=100&offset=${off}`)).json); let fresh = 0; for (const p of page) { const k = p && (p.id || p.path || p.title); if (k && seen.has(k)) continue; if (k) seen.add(k); out.push(p); fresh++; } if (page.length < 100 || !fresh) break; } return out; }
  async function upsertBlog(cfg, page, opts, ctx) {
    const s = await siteInfo(cfg, ctx); const slug = cleanSlug(page.slug); const title = headline(page); const publish = statusOf(page, opts) === 'publish';
    const list = await allPosts(cfg); const hit = list.find(p => p && (norm(p.title) === norm(title) || cleanSlug(p.path).split('/').pop() === slug)) || null;
    const body = postBody(cfg, page); let j;
    if (hit) j = (await req(cfg, 'PATCH', `${sp(cfg)}/blog/posts/${enc(hit.id)}`, body)).json || {}; else j = (await req(cfg, 'POST', `${sp(cfg)}/blog/posts/import`, body)).json || {};
    const id = j.id || (hit && hit.id) || ''; let status = 'draft'; const notes = ['blog post: HTML content, meta title and description kept; JSON-LD dropped (Duda blog posts print their own schema)'];
    if (publish && id) { await req(cfg, 'POST', `${sp(cfg)}/blog/posts/${enc(id)}/publish`); status = 'publish'; if (cfg.publishAfter) await publishSite(cfg, ctx); }
    else if (publish) notes.push('Duda returned no post id, so the post was not published; run the deploy again to publish it'); else notes.push('imported as a draft, publish it from the editor or tick Publish');
    const path = j.path || (hit && hit.path) || ''; if (ctx && ctx.log) ctx.log(`duda blog: ${hit ? 'updated' : 'imported'} post ${id}${status === 'publish' ? ', published' : ''}`);
    return { id, link: path ? linkTo(s, path) : linkTo(s, 'blog'), edit: editor(cfg), status, updated: !!hit, notes: notes.join('; ') };
  }

  /* ============================ media: import from a public url ============================ */
  async function importFromUrl(cfg, url, ctx) {
    const j = (await req(cfg, 'POST', `${MS}/resources/${enc(site(cfg))}/upload`, [{ src: url, resource_type: 'IMAGE' }])).json || {}; const up = (Array.isArray(j.uploaded_resources) ? j.uploaded_resources : [])[0] || {};
    if (!up.new_url) throw CMS.err(`Duda could not import ${url}${j.n_failures ? ` (${j.n_failures} failed)` : ''}`, { adapter: 'duda', hint: 'The URL must be public https and an image (jpg, png, gif, webp).', body: j });
    if (ctx && ctx.log) ctx.log(`duda media: imported ${url} → ${up.new_url}`); return { id: up.new_url, url: up.new_url, original: up.original_url || url, reused: false };
  }
  async function uploadMedia(cfg, asset, ctx) {
    const src = asset && asset.url; if (!/^https:\/\//i.test(String(src || ''))) throw CMS.err(NO_BYTES, { status: 0, adapter: 'duda', hint: 'Module 16, media host: pick a platform that stores files; Duda then imports the hosted URL.' });
    const r = await importFromUrl(cfg, src, ctx); return Object.assign(r, { width: asset.width || 0, height: asset.height || 0, mime: asset.mime || '', alt: asset.alt || '' });
  }
  async function listUrls(cfg, ctx) { const s = await siteInfo(cfg, ctx); const list = await pages(cfg); return [...new Set(list.filter(p => p && p.path != null).map(p => linkTo(s, p.path)).filter(Boolean))]; }

  CMS.register({
    id: 'duda', name: 'Duda', group: 'Duda (agency sites)', docs: DOCS,
    blurb: 'Basic auth from the API user; pages are duplicated from a template page and filled by content injection, or imported as blog posts. Images come from a media host.',
    setup: [
      'Duda: Settings, API (or Business Tools, API Access). Copy the API user and password; note the region of the account (US, EU, sandbox).',
      'The site name is the id in the editor URL: my.duda.co/home/site/<site name>.',
      'Inject mode: build one page in the editor with an HTML widget whose markup is <div data-inject="forge-content"></div> (the content key below), set its path to forge-template or paste its uuid in the template page field. Each page is a copy of it.',
      'Blog mode: add the Blog to the site once. Posts import as drafts; tick Publish to publish them.',
      'Duda only imports images from a public URL: choose a media host in module 16 (WordPress, Shopify, Webflow, Ghost or HubSpot) for local files.',
    ],
    fields: [
      { k: 'apiUser', l: 'API user', t: 'text', hint: 'Settings, API' },
      { k: 'apiPass', l: 'API password', t: 'password', secret: true },
      { k: 'region', l: 'Region', t: 'select', def: 'us', opts: [{ v: 'us', l: 'US (api.duda.co)' }, { v: 'eu', l: 'EU (api.eu.duda.co)' }, { v: 'sandbox', l: 'Sandbox (api-sandbox.duda.co)' }] },
      { k: 'siteName', l: 'Site name', t: 'text', hint: 'The id in the editor URL, for example 3f2a9c1e' },
      { k: 'mode', l: 'Content model', t: 'select', def: 'inject', opts: [{ v: 'inject', l: 'Inject into a duplicated template page' }, { v: 'blog', l: 'Blog post' }] },
      { k: 'contentKey', l: 'Content key', t: 'text', def: 'forge-content', optional: true, hint: 'The data-inject value on the template page element' },
      { k: 'templatePageUuid', l: 'Template page uuid', t: 'text', optional: true, hint: 'Blank: the page at /forge-template, else the first page' },
      { k: 'author', l: 'Blog author', t: 'text', optional: true, hint: 'Blog mode: the author name on imported posts' },
      { k: 'publishAfter', l: 'Republish the site after publishing a page', t: 'checkbox', optional: true },
    ],
    hosts: ['https://api.duda.co/*', 'https://api.eu.duda.co/*', 'https://api-sandbox.duda.co/*'],
    caps: { media: false, urls: true, publishSite: true, elementor: false, schema: 'inline', seo: true, postTypes: ['page', 'post'], modes: ['inject', 'blog'], importFromUrl: true },
    base,
    async test(cfg, ctx) {
      const s = await siteInfo(cfg, ctx, true); const list = await pages(cfg); const md = mode(cfg);
      const m = { api: API, region: region(cfg), host: base(cfg), site: site(cfg), domain: domainOf(s), customDomain: s.site_domain || '', publishStatus: s.publish_status || '', pages: list.length, mode: md, template: '', warnings: [] };
      if (md === 'inject') { const tpl = val(cfg, 'templatePageUuid'); const hit = tpl ? list.find(p => p && p.uuid === tpl) : list.find(p => p && cleanSlug(p.path) === TEMPLATE_PATH); m.template = hit ? (hit.path || hit.uuid) : '';
        if (!hit) m.warnings.push(tpl ? `No page with uuid ${tpl}; the first page (${(list[0] || {}).path || 'none'}) would be duplicated.` : `No page at /${TEMPLATE_PATH}; the first page (${(list[0] || {}).path || 'none'}) would be duplicated. Build a template page with data-inject="${key(cfg)}".`); }
      else { const r = await req(cfg, 'GET', `${sp(cfg)}/blog/posts`, undefined, { tolerate: true }); m.posts = r.ok ? rows(r.json).length : -1; if (!r.ok) m.warnings.push(`Blog posts not readable (HTTP ${r.status}); add the Blog to the site in the editor first.`); }
      let info = `${m.site}: ${m.domain || 'no domain yet'} · ${m.publishStatus || 'status unknown'} · ${m.pages} page${m.pages === 1 ? '' : 's'} · ${md === 'inject' ? `inject into data-inject="${key(cfg)}"${m.template ? ' on /' + m.template : ''}` : `blog posts (${m.posts < 0 ? 'blog not reachable' : m.posts + ' listed'})`} · ${m.region}`;
      if (m.warnings.length) info += ' · ' + m.warnings.join(' ');
      return { ok: true, info, meta: m };
    },
    async upsertPage(cfg, page, opts, ctx) { return mode(cfg) === 'blog' ? upsertBlog(cfg, page, opts || {}, ctx) : upsertInject(cfg, page, opts || {}, ctx); },
    uploadMedia, importFromUrl, listUrls, publishSite,
  });
})();
