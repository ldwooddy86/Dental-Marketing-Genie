/* ==== cms/drupal ==== */
"use strict";
/* Drupal 10 / 11 through the core JSON:API module (https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module).
   Auth: Basic (core basic_auth module) or a bearer token (simple_oauth). Every request carries the JSON:API media type.
   A page becomes one node of the chosen bundle; the slug becomes the path alias; JSON-LD and the scoped css go inline in the body
   (Drupal has no per node head slot without a contrib module); the SEO fields go into a Metatag field when one is named.
   Images upload through the per field JSON:API file endpoint, then become media entities so they stay permanent. */
(() => {
  const JSONAPI_VERSION = '1.0';          /* GET /jsonapi answers jsonapi.version 1.0 (core since 8.7; unchanged in 10 and 11) */
  const PAGE_LIMIT = 50;                  /* JSON:API caps page[limit] at 50: https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/pagination */
  const MT = 'application/vnd.api+json';  /* required Accept and Content-Type: https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/creating-new-resources-post */
  const FILE_ONLY = 'none';               /* media bundle value that means "upload straight into the node's image field" */
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;   /* every JSON:API resource id is an entity UUID */
  const DOCS = 'https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module';
  const base = cfg => CMS.trimSlash(cfg.apiBase || cfg.url);
  const H = ctx => (ctx && ctx.http) || CMS.http;
  const val = (cfg, k, d) => { const v = cfg[k]; return v != null && String(v).trim() !== '' ? String(v).trim() : d; };
  const bundle = cfg => val(cfg, 'bundle', 'page');
  const type = cfg => 'node--' + bundle(cfg);
  const mediaBundle = cfg => { const m = val(cfg, 'mediaBundle', 'image'); return m.toLowerCase() === FILE_ONLY ? '' : m; };
  const mediaField = cfg => val(cfg, 'mediaField', 'field_media_image');
  const abs = (cfg, u) => { if (!u) return ''; try { return new URL(u, base(cfg) + '/').href; } catch (e) { return u; } };
  const enc = encodeURIComponent;
  function auth(cfg) {
    if (cfg.authMode === 'bearer') { const t = val(cfg, 'token', ''); if (!t) throw CMS.err('Enter the bearer token', { status: 0, hint: 'simple_oauth issues it (Configuration > People > Simple OAuth); or set Auth to Basic' }); return 'Bearer ' + t.replace(/^Bearer\s+/i, ''); }
    if (!val(cfg, 'user', '') || !cfg.pass) throw CMS.err('Enter the Drupal username and password', { status: 0, hint: 'the HTTP Basic Authentication core module must be on (Extend)' });
    return CMS.basicAuth(val(cfg, 'user', ''), cfg.pass);
  }
  const headers = (cfg, extra) => Object.assign({ Accept: MT, 'Content-Type': MT, Authorization: auth(cfg) }, extra || {});
  const details = body => { const errs = body && Array.isArray(body.errors) ? body.errors : []; return errs.map(x => [x.detail || x.title, x.source && x.source.pointer].filter(Boolean).join(' at ')).join('; ') || 'no detail given'; };
  /* turn a JSON:API failure into something the user can act on; the message already carries errors[].detail from CMS.http */
  function explain(e, cfg) {
    if (!(e instanceof CMS.CmsError) || e.hint) return e; const s = e.status; const b = bundle(cfg); const bearer = cfg.authMode === 'bearer';
    if (s === 401) e.hint = bearer ? 'The token was rejected or has expired; issue a new one in simple_oauth' : 'Username or password rejected; the account must be active and able to log in';
    else if (s === 403) e.hint = bearer ? `The token's user lacks the permission named in the error (create and edit ${b} content, create url aliases, create media) or the token scope is too narrow` : `Drupal treated the request as anonymous or the account lacks a permission: turn on the HTTP Basic Authentication module (Extend), check the username and password, then grant "create ${b} content", "edit any ${b} content", "create url aliases" and "create media" on /admin/people/permissions`;
    else if (s === 404) e.hint = `Nothing at that path: turn on the JSON:API module (Extend) and check the content type machine name "${b}" and the field names in the settings`;
    else if (s === 405) e.hint = 'Writes are off: choose "Accept all JSON:API create, read, update, and delete operations" on /admin/config/services/jsonapi';
    else if (s === 415) e.hint = 'Drupal rejected the request format: JSON:API needs Accept and Content-Type application/vnd.api+json (a proxy, CDN or security module may be rewriting headers)';
    else if (s === 400) e.hint = 'Drupal rejected the request: the message names the bad filter, field or header; check the field names in the settings (slug field, media field, image field) and that nothing rewrites the JSON:API headers';
    else if (s === 422) e.hint = 'Field validation failed: ' + details(e.body) + '. Check the text format name, the field names in the settings, and that the alias is free';
    return e;
  }
  async function api(cfg, ctx, method, path, body, extra) {
    const o = Object.assign({}, extra || {}); o.method = method; o.headers = headers(cfg, o.headers); if (body != null) o.body = body;
    try { return await H(ctx)(/^https?:\/\//.test(path) ? path : base(cfg) + path, o); } catch (e) { throw explain(e, cfg); }
  }
  const heroAlt = page => { const m = page.media || {}; const hit = (m.hero && m.hero.alt) ? m.hero : Object.values(m).find(x => x && x.url && x.url === page.featured_media_url); return String((hit && hit.alt) || page.h1 || page.title || '').slice(0, 512); };
  /* who is the request running as: core route user.login_status.http answers "1" (authenticated) or "0" (Drupal fell back to anonymous) */
  async function whoami(cfg, ctx) {
    const b = base(cfg); const out = { label: 'user unverified', name: '', uid: '' }; const plain = { Authorization: auth(cfg), Accept: 'application/json' };
    const st = await H(ctx)(b + '/user/login_status?_format=json', { headers: plain, tolerate: true });
    if (st.status === 200 && String(st.text).trim() === '0') throw CMS.err('Drupal accepted the request but as anonymous: the credentials were rejected', { status: 401, hint: cfg.authMode === 'bearer' ? 'the token is expired or belongs to no user' : 'check the username and password and that the HTTP Basic Authentication module is on (Extend)' });
    if (cfg.authMode !== 'bearer') {
      const r = await api(cfg, ctx, 'GET', `/jsonapi/user/user?filter[name]=${enc(val(cfg, 'user', ''))}&fields[user--user]=name,drupal_internal__uid`); const j = r.json || {}; const u = (j.data || [])[0];
      if (u) { out.name = (u.attributes || {}).name || ''; out.uid = (u.attributes || {}).drupal_internal__uid; out.label = `user ${out.name} (uid ${out.uid})`; }
      else out.label = j.meta && j.meta.omitted ? 'user hidden (grant "View user information" to see it)' : 'user not listed';
    } else {
      /* simple_oauth DebugController: /oauth/debug?_format=json → {id, roles, permissions}; skipped quietly when the site does not have it */
      const d = await H(ctx)(b + '/oauth/debug?_format=json', { headers: plain, tolerate: true }); const j = d.status === 200 && d.json && typeof d.json === 'object' ? d.json : null;
      if (j && j.id != null && String(j.id) !== '0') { out.uid = j.id; out.label = `token user uid ${j.id}${Array.isArray(j.roles) && j.roles.length ? ' (' + j.roles.join(', ') + ')' : ''}`; } else out.label = 'token accepted';
    }
    return out;
  }
  /* path.alias cannot be filtered (computed field: https://www.drupal.org/project/drupal/issues/3264307), so the lookup filters on the title
     and matches the alias in the result: the exact alias, an alias a Pathauto pattern prefixed (/services/ac-repair), or the only hit when
     it has no alias at all. A title hit with a different alias is another page and is left alone (two locations can share an H1).
     A plain text slug field (cfg.slugField) gives an exact filter when the site has one. */
  const aliasOf = n => (((n && n.attributes) || {}).path || {}).alias || '';
  async function findNode(cfg, ctx, page) {
    const b = bundle(cfg); const t = type(cfg); const alias = '/' + page.slug; const f = `fields[${t}]=title,path,status,drupal_internal__nid`; const sf = val(cfg, 'slugField', '');
    if (sf) { const r = await api(cfg, ctx, 'GET', `/jsonapi/node/${b}?filter[${sf}]=${enc(page.slug)}&${f}&page[limit]=2`); const d = (r.json || {}).data || []; if (d[0]) return d[0]; }
    const r = await api(cfg, ctx, 'GET', `/jsonapi/node/${b}?filter[title][value]=${enc(page.h1 || page.title)}&${f}&page[limit]=${PAGE_LIMIT}`); const d = (r.json || {}).data || [];
    return d.find(n => aliasOf(n) === alias) || d.find(n => aliasOf(n).endsWith(alias)) || (d.length === 1 && !aliasOf(d[0]) ? d[0] : null);
  }
  /* media lookup by name (media entities keep the file name as their name); returns [{id, url, alt, width, height, mime, name}] */
  async function findMedia(cfg, query, kind, ctx) {
    const mb = mediaBundle(cfg); if (!mb || !query) return []; const fld = mediaField(cfg);
    const r = await api(cfg, ctx, 'GET', `/jsonapi/media/${mb}?filter[name][operator]=CONTAINS&filter[name][value]=${enc(query)}&include=${fld}&fields[media--${mb}]=name,${fld}&fields[file--file]=uri,filename,filemime&page[limit]=5`);
    const j = r.json || {}; const files = {}; (j.included || []).forEach(i => { if (i.type === 'file--file') files[i.id] = i; });
    return (j.data || []).map(m => { const rel = ((m.relationships || {})[fld] || {}).data || {}; const f = files[rel.id] || {}; const fa = f.attributes || {}; const meta = rel.meta || {}; return { id: m.id, fileId: rel.id || '', url: abs(cfg, (fa.uri || {}).url || ''), alt: meta.alt || '', width: meta.width, height: meta.height, mime: fa.filemime || '', name: (m.attributes || {}).name || '' }; }).filter(m => m.url);
  }
  CMS.register({
    id: 'drupal', name: 'Drupal', group: 'Drupal 10 / 11', blurb: 'JSON:API core module, Basic auth or bearer token', docs: DOCS,
    setup: [
      'Extend (/admin/modules): turn on JSON:API and HTTP Basic Authentication (or Simple OAuth when you prefer a token).',
      'Configuration > Web services > JSON:API (/admin/config/services/jsonapi): choose "Accept all JSON:API create, read, update, and delete operations".',
      'People > Permissions (/admin/people/permissions): the account needs Create and Edit for the content type, Create URL aliases (the slug), Create media, and View user information for the connection test.',
      'Structure > Content types (/admin/structure/types): note the machine name (page) and the machine names of the image or media field and the Metatag field.',
      'Optional: install Metatag and add a Meta tags field to the content type so the SEO title, description, canonical and robots land in the head.',
      'Optional: Pathauto users set "Pathauto installed" to Yes so the pattern does not overwrite the page alias.',
    ],
    fields: [
      { k: 'url', l: 'Site URL', t: 'url', hint: 'https://www.example.com; the adapter adds /jsonapi' },
      { k: 'authMode', l: 'Auth', t: 'select', opts: [{ v: 'basic', l: 'Basic auth (basic_auth module)' }, { v: 'bearer', l: 'Bearer token (simple_oauth)' }], def: 'basic' },
      { k: 'user', l: 'Username', t: 'text', optional: true, hint: 'Basic auth' },
      { k: 'pass', l: 'Password', t: 'password', secret: true, optional: true, hint: 'Basic auth' },
      { k: 'token', l: 'Bearer token', t: 'password', secret: true, optional: true, hint: 'Bearer auth' },
      { k: 'bundle', l: 'Content type', t: 'text', def: 'page', hint: 'machine name from /admin/structure/types' },
      { k: 'textFormat', l: 'Text format', t: 'text', def: 'full_html', hint: 'must allow style and script tags or the css and JSON-LD are stripped' },
      { k: 'langcode', l: 'Language code', t: 'text', optional: true, hint: 'blank uses the page language (en); must be a language the site has enabled' },
      { k: 'metatagField', l: 'Metatag field', t: 'text', optional: true, hint: 'e.g. field_metatags (Metatag module): SEO title, description, canonical, robots' },
      { k: 'imageField', l: 'Image field', t: 'text', optional: true, hint: 'e.g. field_image: a media reference when a media bundle is set, an image field when the bundle is "none"' },
      { k: 'mediaBundle', l: 'Media bundle', t: 'text', def: 'image', optional: true, hint: 'image is the standard profile default; type none to upload files straight into the image field' },
      { k: 'mediaField', l: 'Media file field', t: 'text', def: 'field_media_image', optional: true, hint: 'the file field on the media bundle' },
      { k: 'pathauto', l: 'Pathauto installed', t: 'select', opts: [{ v: 'no', l: 'No' }, { v: 'yes', l: 'Yes, keep my alias' }], def: 'no', optional: true, hint: 'Yes sends pathauto: 0 so the pattern leaves the alias alone; Drupal answers 422 when the module is absent' },
      { k: 'slugField', l: 'Slug field', t: 'text', optional: true, hint: 'optional plain text field that stores the slug for exact lookups (aliases cannot be filtered)' },
    ],
    dynamicHost: cfg => cfg.url,
    caps: { media: true, urls: true, publishSite: false, elementor: false, schema: 'inline', seo: true, postTypes: ['page', 'post'] },
    base,
    async test(cfg, ctx) {
      const b = bundle(cfg); const t = type(cfg);
      const root = await api(cfg, ctx, 'GET', '/jsonapi'); const j = root.json || {}; const ver = (j.jsonapi && j.jsonapi.version) || '';
      if (!ver) throw CMS.err('That URL did not answer as JSON:API', { status: root.status, hint: 'turn on the JSON:API module (Extend) and enter the site root, such as https://www.example.com' });
      const types = Object.keys(j.links || {}); const nodes = types.filter(x => x.startsWith('node--')).map(x => x.slice(6));
      if (!types.includes(t)) throw CMS.err(`Content type "${b}" is not exposed (found: ${nodes.join(', ') || 'no node types'})`, { status: 404, hint: 'use the machine name from /admin/structure/types' });
      const gen = (root.headers && root.headers.get && root.headers.get('x-generator')) || ''; const drupal = (gen.match(/Drupal\s+([\d.]+)/i) || [])[1] || '';
      const who = await whoami(cfg, ctx);
      const one = await api(cfg, ctx, 'GET', `/jsonapi/node/${b}?page[limit]=1&fields[${t}]=title`);
      const mb = mediaBundle(cfg); if (mb && !types.includes('media--' + mb)) throw CMS.err(`Media bundle "${mb}" is not exposed (found: ${types.filter(x => x.startsWith('media--')).map(x => x.slice(7)).join(', ') || 'no media bundles; turn on the Media module or set the bundle to none'})`, { status: 404, hint: 'Structure > Media types shows the machine names' });
      const info = `${drupal ? 'Drupal ' + drupal + ', ' : ''}JSON:API ${ver}, node ${b}, ${who.label}`;
      return { ok: true, info, meta: { drupal, jsonapi: ver, expected: JSONAPI_VERSION, bundle: b, types: nodes, mediaBundle: mb, user: who.name, uid: who.uid, sample: ((one.json || {}).data || []).length } };
    },
    async listUrls(cfg, ctx) {
      const b = bundle(cfg); const t = type(cfg); const out = []; let url = `/jsonapi/node/${b}?filter[status]=1&fields[${t}]=path,title,drupal_internal__nid&page[limit]=${PAGE_LIMIT}`; let guard = 0;
      while (url && guard++ < 400) { const r = await api(cfg, ctx, 'GET', url); const j = r.json || {}; (j.data || []).forEach(n => { const a = n.attributes || {}; const p = (a.path || {}).alias || (a.drupal_internal__nid ? '/node/' + a.drupal_internal__nid : ''); if (p) out.push(base(cfg) + p); }); url = j.links && j.links.next && j.links.next.href ? j.links.next.href : ''; }
      return out;
    },
    findMedia,
    /* asset {blob, file, mime, alt, width, height} → file--file through the field upload endpoint, then a media entity that references it.
       https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/file-uploads : POST /jsonapi/{entity}/{bundle}/{field},
       Content-Type application/octet-stream, Content-Disposition file; filename="x.webp". A file no entity references stays temporary and
       is garbage collected, which is why the media bundle path is the default. */
    async uploadMedia(cfg, asset, ctx) {
      const b = bundle(cfg); const mb = mediaBundle(cfg); const fld = mediaField(cfg); const imageField = val(cfg, 'imageField', '');
      /* the name travels in a header, so it must stay printable ASCII without quotes or path separators */
      const file = String(asset.file || ('image.' + CMS.extOf('', asset.mime))).replace(/[^\x20-\x7e]/g, '').replace(/["\\/]/g, '').trim() || ('image.' + CMS.extOf('', asset.mime)); const stem = file.replace(/\.[^.]+$/, '');
      if (mb) { const hit = (await findMedia(cfg, stem, 'image', ctx)).find(m => m.name === file || m.name === stem || (m.url || '').split('/').pop() === file); if (hit) return Object.assign({ reused: true, mime: hit.mime || asset.mime, width: hit.width || asset.width, height: hit.height || asset.height }, hit); }
      const path = mb ? `/jsonapi/media/${mb}/${fld}` : (imageField ? `/jsonapi/node/${b}/${imageField}` : '');
      if (!path) throw CMS.err('No upload target: set a media bundle (recommended) or an image field', { status: 0, hint: 'media bundle "image" with field_media_image is the standard profile default; set the bundle to none plus an image field to skip media entities' });
      const bytes = await CMS.blobBytes(asset.blob);
      const up = await api(cfg, ctx, 'POST', path, bytes, { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `file; filename="${file}"` } });
      const f = (up.json || {}).data || {}; const fa = f.attributes || {}; const url = abs(cfg, (fa.uri || {}).url || '');
      if (!f.id || !url) throw CMS.err('Drupal did not return the file entity', { status: up.status, hint: 'check that the field allows the extension and the file size (/admin/structure/media or the content type field settings)' });
      const common = { fileId: f.id, url, width: asset.width, height: asset.height, mime: fa.filemime || asset.mime, reused: false };
      if (!mb) return Object.assign({ id: f.id, note: 'file stays temporary until the node references it through the image field' }, common);
      const m = await api(cfg, ctx, 'POST', `/jsonapi/media/${mb}`, { data: { type: `media--${mb}`, attributes: { name: file }, relationships: { [fld]: { data: { type: 'file--file', id: f.id, meta: { alt: asset.alt || stem, title: asset.alt || '', width: asset.width, height: asset.height } } } } } });
      return Object.assign({ id: ((m.json || {}).data || {}).id || f.id }, common);
    },
    /* POST /jsonapi/node/{bundle} or PATCH /jsonapi/node/{bundle}/{uuid} (PATCH bodies must repeat the id):
       https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/updating-existing-resources-patch */
    async upsertPage(cfg, page, opts, ctx) {
      const b = bundle(cfg); const t = type(cfg); const publish = !!(opts && opts.publish); const notes = []; const seo = page.seo || {}; const alias = '/' + page.slug;
      const ex = await findNode(cfg, ctx, page);
      /* body carries only value and format: a summary property fails with 422 on bundles whose body field is plain text_long */
      const attributes = { title: page.h1 || page.title, status: publish, langcode: val(cfg, 'langcode', '') || String(page.language || 'en').split(/[-_]/)[0].toLowerCase() || 'en', promote: false, body: { value: CMS.bodyHtml(page, { css: true, schema: true }), format: val(cfg, 'textFormat', 'full_html') }, path: cfg.pathauto === 'yes' ? { alias, pathauto: 0 } : { alias } };
      const sf = val(cfg, 'slugField', ''); if (sf) attributes[sf] = page.slug;
      const mf = val(cfg, 'metatagField', '');
      if (mf) { /* Metatag field write shape {value: {tag: content}}: https://www.drupal.org/project/json_api/issues/3373740 */
        const m = {}; if (seo.title || page.title) m.title = seo.title || page.title; if (seo.description || page.meta_description) m.description = seo.description || page.meta_description; if (seo.canonical || page.canonical) m.canonical_url = seo.canonical || page.canonical; if (seo.noindex || page.noindex) m.robots = 'noindex, follow'; if (seo.og_image) m.og_image = seo.og_image; attributes[mf] = { value: m }; }
      else notes.push('no Metatag field named: the SEO title, description, canonical and robots were not sent (JSON-LD is inline in the body)');
      if (page.post_type === 'post' && b !== 'article') notes.push(`post type "post" went into the ${b} bundle (one content type per connection)`);
      const relationships = {}; const imageField = val(cfg, 'imageField', ''); const mb = mediaBundle(cfg);
      /* only an id this adapter produced (a Drupal UUID) goes into the relationship; ids from another media host are not Drupal entities */
      if (imageField && UUID.test(String(page.featured_media_id || ''))) relationships[imageField] = { data: mb ? { type: `media--${mb}`, id: page.featured_media_id } : { type: 'file--file', id: page.featured_media_id, meta: { alt: heroAlt(page) } } };
      else if (imageField && page.featured_media_url) notes.push('featured image is not a Drupal upload (remote URL or another media host), so the image field was left alone');
      const data = { type: t, attributes }; if (Object.keys(relationships).length) data.relationships = relationships;
      let r; if (ex) { data.id = ex.id; r = await api(cfg, ctx, 'PATCH', `/jsonapi/node/${b}/${ex.id}`, { data }); } else r = await api(cfg, ctx, 'POST', `/jsonapi/node/${b}`, { data });
      const n = (r.json || {}).data || {}; const at = n.attributes || {}; const nid = at.drupal_internal__nid; const got = (at.path || {}).alias || '';
      if (got && got !== alias) notes.push(`Drupal kept the alias ${got} (a Pathauto pattern or an alias clash)`);
      return { id: n.id, nid, link: base(cfg) + (got || alias), edit: nid ? `${base(cfg)}/node/${nid}/edit` : '', status: publish ? 'publish' : 'draft', updated: !!ex, notes: notes.join('; ') };
    },
  });
})();
