/* ==== cms/ghost ==== */
"use strict";
/* Ghost 5 / 6 through the Admin API (https://docs.ghost.org/admin-api). Auth: an Admin API key (Settings > Integrations > custom
   integration) is id:secret; every request carries a short lived HS256 JWT (kid = id, aud /admin/, 5 minutes) as
   "Authorization: Ghost <jwt>" (https://docs.ghost.org/admin-api#token-authentication). Accept-Version tells Ghost the lowest
   major the client can work with (https://docs.ghost.org/faq/api-versioning/); the adapter reads the site's version once and sends
   v<major>.0 so a Ghost 6 site is not asked for v5 behaviour. The page markup and css travel inside one HTML card so the Lexical
   conversion keeps them; JSON-LD and robots go in the page's own code injection head; SEO fields go in the meta fields. */
(() => {
  const ADMIN = '/ghost/api/admin';       /* https://docs.ghost.org/admin-api#url */
  const ACCEPT_FALLBACK = 'v5.0';         /* only when /site/ cannot be read; the value the docs use in every example */
  const PAGE = 100;                       /* Ghost 6 dropped limit=all and caps browse requests at 100: https://docs.ghost.org/changes */
  const TTL = 300;                        /* token life in seconds; the docs say 5 minutes */
  const LIMITS = { title: 255, meta_title: 300, meta_description: 500, custom_excerpt: 300, feature_image_alt: 125, canonical_url: 2000 };   /* Ghost's post validations (isLength max) */
  const DOCS = 'https://docs.ghost.org/admin-api';
  const SITE = {};                        /* base → {version, title, url, accept}, learned from GET /site/ */
  const base = cfg => CMS.trimSlash(cfg.apiBase || cfg.url);
  const H = ctx => (ctx && ctx.http) || CMS.http;
  const val = (cfg, k, d) => { const v = cfg[k]; return v != null && String(v).trim() !== '' ? String(v).trim() : d; };
  const cut = (s, n) => { const t = String(s == null ? '' : s).trim(); return t ? t.slice(0, n) : null; };
  function key(cfg) {
    const raw = val(cfg, 'adminKey', ''); const i = raw.indexOf(':'); const id = i > 0 ? raw.slice(0, i).trim() : ''; const secret = i > 0 ? raw.slice(i + 1).trim() : '';
    if (!id || !secret || !/^[0-9a-f]+$/i.test(secret) || secret.length % 2) throw CMS.err('The Admin API key must look like id:secret (both hex)', { status: 0, hint: 'copy the Admin API key from Settings > Advanced > Integrations > your custom integration; the Content API key does not work here' });
    return { id, secret };
  }
  async function token(cfg) { const k = key(cfg); const iat = Math.floor(Date.now() / 1000); return CMS.jwtHS256({ alg: 'HS256', typ: 'JWT', kid: k.id }, { iat, exp: iat + TTL, aud: '/admin/' }, CMS.fromHex(k.secret)); }
  /* GET /site/ needs no auth; it gives the version the Accept-Version header is derived from */
  async function site(cfg, ctx) {
    const b = base(cfg); if (SITE[b]) return SITE[b];
    const t = cfg._tested && cfg._tested.meta && cfg._tested.meta.version ? cfg._tested.meta : null;
    const r = await H(ctx)(b + ADMIN + '/site/', { headers: { Accept: 'application/json' }, tolerate: true }); const s = r.status === 200 && r.json && r.json.site ? r.json.site : (t || {});
    const major = parseInt(String(s.version || ''), 10);
    if (r.status !== 200 && !t) return { version: '', title: '', url: '', accept: ACCEPT_FALLBACK, status: r.status };
    return (SITE[b] = { version: s.version || '', title: s.title || '', url: s.url || '', accept: major ? `v${major}.0` : ACCEPT_FALLBACK });
  }
  async function headers(cfg, ctx) { const accept = val(cfg, 'acceptVersion', '') || (await site(cfg, ctx)).accept; return { Authorization: 'Ghost ' + (await token(cfg)), 'Accept-Version': accept, Accept: 'application/json' }; }
  const context = body => { const errs = body && Array.isArray(body.errors) ? body.errors : []; return errs.map(x => x.context || x.message).filter(Boolean).join('; '); };
  function explain(e) {
    if (!(e instanceof CMS.CmsError) || e.hint) return e; const s = e.status;
    if (s === 401) e.hint = 'Ghost rejected the token: check the Admin API key (the integration may have been deleted) and the computer clock, the token is valid for 5 minutes';
    else if (s === 403) e.hint = 'The integration is not allowed to do this; custom integrations can write posts, pages and images, check that it still exists';
    else if (s === 404) e.hint = 'Not found: the Site URL must be the admin URL (yourname.ghost.io for Ghost(Pro) sites with a custom domain) and the record may have been deleted';
    else if (s === 406) e.hint = 'Ghost refused the Accept-Version; set "Accept version" to the site major, for example v6.0';
    else if (s === 422) e.hint = 'Validation failed: ' + (context(e.body) || 'a field is too long or the slug is taken');
    else if (s === 415) e.hint = 'Ghost wants JSON for records and multipart form data for images';
    return e;
  }
  async function api(cfg, ctx, method, path, body, extra) {
    const o = Object.assign({}, extra || {}); o.method = method; o.headers = Object.assign(await headers(cfg, ctx), o.headers || {}); if (body != null) o.body = body;
    try { return await H(ctx)(/^https?:\/\//.test(path) ? path : base(cfg) + ADMIN + path, o); } catch (e) { throw explain(e); }
  }
  const kind = (cfg, page) => { const p = val(cfg, 'postType', 'page'); const k = p === 'auto' ? (page && page.post_type) || 'page' : p; return k === 'post' ? 'posts' : 'pages'; };
  const heroAlt = page => { const m = page.media || {}; const hit = (m.hero && m.hero.alt) ? m.hero : Object.values(m).find(x => x && x.url && x.url === page.featured_media_url); return (hit && hit.alt) || ''; };
  CMS.register({
    id: 'ghost', name: 'Ghost', group: 'Ghost 5', blurb: 'Admin API with an integration key', docs: DOCS,
    setup: [
      'Settings > Advanced > Integrations (/ghost/#/settings/integrations): Add custom integration, name it, copy the Admin API key (id:secret).',
      'Site URL is the admin URL: the site domain for self hosted sites, the yourname.ghost.io domain for Ghost(Pro) sites with a custom domain.',
      'Pages land as drafts unless you tick publish; open them at /ghost/#/editor/page/<id>.',
      'The page markup and css sit in one HTML card; JSON-LD and robots sit in the page\'s code injection head (page settings > Code injection).',
      'Ghost shows the feature image above the content in most themes; clear it in the page settings when the hero already carries the photo.',
    ],
    fields: [
      { k: 'url', l: 'Admin URL', t: 'url', hint: 'https://yourname.ghost.io or your self hosted domain' },
      { k: 'adminKey', l: 'Admin API key', t: 'password', secret: true, hint: 'id:secret from the custom integration' },
      { k: 'postType', l: 'Create as', t: 'select', opts: [{ v: 'page', l: 'Pages' }, { v: 'post', l: 'Posts' }, { v: 'auto', l: 'Follow each page\'s type' }], def: 'page' },
      { k: 'acceptVersion', l: 'Accept version', t: 'text', optional: true, hint: 'blank reads it from the site (v5.0, v6.0)' },
    ],
    dynamicHost: cfg => cfg.url,
    caps: { media: true, urls: true, publishSite: false, elementor: false, schema: 'head', seo: true, postTypes: ['page', 'post'] },
    base,
    async test(cfg, ctx) {
      const s = await site(cfg, ctx);
      if (!s.version) throw CMS.err(`No Ghost site at ${base(cfg)}${ADMIN}/site/ (${s.status || 'no answer'})`, { status: s.status || 0, hint: 'enter the admin URL without /ghost; Ghost(Pro) custom domains answer the API on the yourname.ghost.io domain' });
      const me = await api(cfg, ctx, 'GET', '/users/me/?include=roles'); const u = ((me.json || {}).users || [])[0] || {}; const roles = (u.roles || []).map(r => r.name).join(', ');
      const info = `Ghost ${s.version} "${s.title}", Accept-Version ${s.accept}, ${u.name || u.email || 'user'}${roles ? ' (' + roles + ')' : ''}`;
      return { ok: true, info, meta: { version: s.version, accept: s.accept, title: s.title, url: s.url, user: u.email || u.name || '', roles } };
    },
    async listUrls(cfg, ctx) {
      const out = [];
      for (const t of ['pages', 'posts']) { let pg = 1; let guard = 0; while (pg && guard++ < 200) { const r = await api(cfg, ctx, 'GET', `/${t}/?limit=${PAGE}&page=${pg}&fields=url,slug&filter=status:published`); const j = r.json || {}; (j[t] || []).forEach(x => { if (x.url) out.push(x.url); }); pg = j.meta && j.meta.pagination ? j.meta.pagination.next : null; } }
      return out;
    },
    /* POST /images/upload/ multipart: file, purpose (image), ref: https://docs.ghost.org/admin-api/images/uploading-an-image */
    async uploadMedia(cfg, asset, ctx) {
      const file = String(asset.file || ('image.' + CMS.extOf('', asset.mime))).replace(/[^a-zA-Z0-9._-]/g, '-');
      const blob = asset.blob && asset.blob.type ? asset.blob : new Blob([await CMS.blobBytes(asset.blob)], { type: asset.mime || 'application/octet-stream' });
      const fd = new FormData(); fd.append('file', blob, file); fd.append('purpose', 'image'); fd.append('ref', file);
      const r = await api(cfg, ctx, 'POST', '/images/upload/', fd); const img = ((r.json || {}).images || [])[0] || {};
      if (!img.url) throw CMS.err('Ghost did not return the image URL', { status: r.status, hint: 'Ghost accepts WEBP, JPEG, GIF, PNG and SVG' });
      return { id: img.url, url: img.url, width: asset.width, height: asset.height, mime: asset.mime, reused: false };
    },
    /* GET /{pages|posts}/slug/{slug}/ then POST /{type}/?source=html or PUT /{type}/{id}/?source=html with the record's updated_at
       (Ghost refuses a PUT without it): https://docs.ghost.org/admin-api/pages https://docs.ghost.org/admin-api/posts/creating-a-post
       The HTML card comments keep the markup lossless through the Lexical conversion. */
    async upsertPage(cfg, page, opts, ctx) {
      const t = kind(cfg, page); const one = t === 'pages' ? 'page' : 'post'; const publish = !!(opts && opts.publish); const notes = []; const seo = page.seo || {};
      let ex = null; try { const r = await api(cfg, ctx, 'GET', `/${t}/slug/${encodeURIComponent(page.slug)}/`); ex = ((r.json || {})[t] || [])[0] || null; } catch (e) { if (e.status !== 404) throw e; }
      const head = [CMS.schemaTag(page.schema), (seo.noindex || page.noindex) ? '<meta name="robots" content="noindex,follow">' : ''].filter(Boolean).join('\n');
      const doc = { title: cut(page.h1 || page.title, LIMITS.title) || page.slug, slug: page.slug, html: `<!--kg-card-begin: html-->\n${CMS.bodyHtml(page, { css: true, schema: false })}\n<!--kg-card-end: html-->`, status: publish ? 'published' : 'draft', visibility: 'public',
        meta_title: cut(seo.title || page.title, LIMITS.meta_title), meta_description: cut(seo.description || page.meta_description, LIMITS.meta_description), canonical_url: cut(seo.canonical || page.canonical, LIMITS.canonical_url), codeinjection_head: head || null,
        custom_excerpt: cut(page.summary || page.excerpt, LIMITS.custom_excerpt), feature_image: page.featured_media_url || null, feature_image_alt: cut(heroAlt(page), LIMITS.feature_image_alt), og_image: seo.og_image || null };
      if (String(page.summary || page.excerpt || '').length > LIMITS.custom_excerpt) notes.push('excerpt cut to 300 characters');
      if (doc.feature_image) notes.push('feature image set; themes show it above the content');
      let r; if (ex) r = await api(cfg, ctx, 'PUT', `/${t}/${ex.id}/?source=html`, { [t]: [Object.assign({}, doc, { updated_at: ex.updated_at })] }); else r = await api(cfg, ctx, 'POST', `/${t}/?source=html`, { [t]: [doc] });
      const got = ((r.json || {})[t] || [])[0] || {};
      if (!got.id) throw CMS.err('Ghost did not return the ' + one, { status: r.status, hint: 'the response had no record; check the integration' });
      return { id: got.id, link: got.url || `${base(cfg)}/${page.slug}/`, edit: `${base(cfg)}/ghost/#/editor/${one}/${got.id}`, status: got.status === 'published' ? 'publish' : 'draft', updated: !!ex, notes: notes.join('; ') };
    },
  });
})();
