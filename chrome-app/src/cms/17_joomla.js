/* ==== cms/joomla ==== */
"use strict";
/* Joomla 4.1+ / 5 / 6 through the core Web Services API (https://manual.joomla.org/docs/general-concepts/webservices/).
   Auth: the user's API token (Users > Manage > user > Joomla API Token) sent as X-Joomla-Token, and once more as a Bearer header for
   hosts that pass Authorization through; the API Authentication - Web Services Joomla Token plugin reads either
   (https://docs.joomla.org/J4.x:Joomla_Core_APIs). A page becomes one article in one category; the slug becomes the alias;
   JSON-LD and the scoped css go inline in articletext (Joomla has no per article head slot; the user group's text filter must let
   style and script through). Images upload through the media web service into images/<folder>. */
(() => {
  const API = '/api/index.php/v1';   /* API root: https://docs.joomla.org/J4.x:Joomla_Core_APIs */
  const PAGE = 100;                  /* page[limit] for listings; page[offset] paginates */
  const ADAPTER = 'local-images';    /* media adapter for the images/ folder: https://github.com/joomla/joomla-cms/pull/35788 */
  const METADESC_MAX = 160;          /* the article form's own limit on metadesc */
  const DOCS = 'https://manual.joomla.org/docs/general-concepts/webservices/';
  const base = cfg => CMS.trimSlash(cfg.apiBase || cfg.url);
  const H = ctx => (ctx && ctx.http) || CMS.http;
  const val = (cfg, k, d) => { const v = cfg[k]; return v != null && String(v).trim() !== '' ? String(v).trim() : d; };
  const tok = cfg => val(cfg, 'token', '').replace(/^Bearer\s+/i, '').trim();
  const catId = cfg => parseInt(val(cfg, 'categoryId', '2'), 10) || 2;
  const folderOf = cfg => val(cfg, 'folder', 'forge').replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_\-/]/g, '') || 'forge';
  const artUrl = (b, id, catid) => `${b}/index.php?option=com_content&view=article&id=${id}${catid ? '&catid=' + catid : ''}`;
  const imgUrl = (b, folder, file) => `${b}/images/${folder}/${file}`;
  const safeName = f => String(f || '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+/, '') || 'image.webp';
  function headers(cfg) { const t = tok(cfg); if (!t) throw CMS.err('Enter the API token', { status: 0, hint: 'Users > Manage > open the user > tab Joomla API Token > Enabled, Save, then copy it' }); return { 'X-Joomla-Token': t, Authorization: 'Bearer ' + t, Accept: 'application/vnd.api+json', 'Content-Type': 'application/json' }; }
  function explain(e, cfg) {
    if (!(e instanceof CMS.CmsError) || e.hint) return e; const s = e.status;
    if (s === 401) e.hint = 'Token rejected: enable it on the user (Joomla API Token tab), enable the plugin "API Authentication - Web Services Joomla Token", and check the user is not blocked';
    else if (s === 403) e.hint = `The user's group lacks a permission: Web Services (core.login.api) in Global Configuration > Permissions, Create and Edit in Articles, Create in Media, and access to category ${catId(cfg)}`;
    else if (s === 404) e.hint = 'Nothing at /api: the site must be Joomla 4.1 or newer with the Web Services - Content and Web Services - Media plugins enabled (System > Plugins), and /api must not be blocked by the server';
    else if (s === 400 || s === 422) e.hint = 'Joomla refused the save: the message names the field; a duplicate alias in the same category, a missing category, or a text filter change are the usual causes';
    else if (s === 500) e.hint = 'Joomla threw an error; an editor plugin or a third party content plugin often breaks API saves (System > Plugins)';
    return e;
  }
  async function api(cfg, ctx, method, path, body, extra) {
    const o = Object.assign({}, extra || {}); o.method = method; o.headers = Object.assign(headers(cfg), o.headers || {}); if (body != null) o.body = body;
    try { return await H(ctx)(/^https?:\/\//.test(path) ? path : base(cfg) + API + path, o); } catch (e) { throw explain(e, cfg); }
  }
  /* nothing in the API reports the version; the core manifest is world readable on most sites, so read it quietly */
  async function version(cfg, ctx) { try { const r = await H(ctx)(base(cfg) + '/administrator/manifests/files/joomla.xml', { tolerate: true, expect: 'text', timeout: 15000 }); const m = r.status === 200 && String(r.text).match(/<version>([^<]+)<\/version>/); return m ? m[1].trim() : ''; } catch (e) { return ''; } }
  /* filter[search] matches title, alias and note (administrator ArticlesModel) and filter[category] narrows to the category the alias is
     unique in (api ArticlesController::displayList maps author, category, search, state, language onto the model state); the alias is
     matched exactly in the result. */
  async function findArticle(cfg, ctx, page) {
    const r = await api(cfg, ctx, 'GET', `/content/articles?filter[search]=${encodeURIComponent(page.slug)}&filter[category]=${catId(cfg)}&page[limit]=50`); const d = (r.json || {}).data || [];
    return d.find(a => (a.attributes || {}).alias === page.slug) || null;
  }
  CMS.register({
    id: 'joomla', name: 'Joomla', group: 'Joomla 4.1+ / 5', blurb: 'Web Services API with a user API token', docs: DOCS,
    setup: [
      'Users > Manage (/administrator/index.php?option=com_users&view=users): open the user, tab Joomla API Token, tick Enabled, Save, copy the token.',
      'System > Plugins (/administrator/index.php?option=com_plugins&view=plugins): API Authentication - Web Services Joomla Token, Web Services - Content and Web Services - Media must be enabled.',
      'System > Global Configuration > Permissions: the user group needs Web Services, plus Create and Edit in Content and Create in Media.',
      'Content > Categories (/administrator/index.php?option=com_categories&extension=com_content): note the category id; Uncategorised is 2.',
      'System > Global Configuration > Text Filters: give the user group No Filtering, or the css and JSON-LD are stripped from the article.',
      'Front end URLs follow the menu: link a menu item to the category (or use Content > Menu > Category Blog) so articles get SEF URLs.',
    ],
    fields: [
      { k: 'url', l: 'Site URL', t: 'url', hint: 'https://www.example.com; the adapter adds /api/index.php/v1' },
      { k: 'token', l: 'API token', t: 'password', secret: true, hint: 'from the user\'s Joomla API Token tab' },
      { k: 'categoryId', l: 'Category id', t: 'text', def: '2', hint: 'catid; Uncategorised is 2' },
      { k: 'language', l: 'Language', t: 'text', def: '*', optional: true, hint: '* for all, or a tag such as en-GB' },
      { k: 'access', l: 'Access level', t: 'text', def: '1', optional: true, hint: '1 Public, 2 Registered, 3 Special' },
      { k: 'folder', l: 'Media folder', t: 'text', def: 'forge', optional: true, hint: 'under images/' },
    ],
    dynamicHost: cfg => cfg.url,
    caps: { media: true, urls: true, publishSite: false, elementor: false, schema: 'inline', seo: true, postTypes: ['page', 'post'] },
    base,
    async test(cfg, ctx) {
      const r = await api(cfg, ctx, 'GET', '/content/categories?page[limit]=5'); const cats = ((r.json || {}).data || []).map(c => ({ id: parseInt(c.id, 10), title: (c.attributes || {}).title || '' }));
      const ver = await version(cfg, ctx); const want = catId(cfg); const has = cats.some(c => c.id === want);
      const info = `Joomla ${ver || '4.1+'}, API v1, categories: ${cats.map(c => `${c.title} (${c.id})`).join(', ') || 'none visible'}${has ? '' : `; category ${want} is not among the first ${cats.length}`}`;
      return { ok: true, info, meta: { version: ver, api: 'v1', categories: cats, categoryId: want, categoryListed: has } };
    },
    async listUrls(cfg, ctx) {
      const b = base(cfg); const out = []; let offset = 0; let guard = 0;
      while (guard++ < 200) { const r = await api(cfg, ctx, 'GET', `/content/articles?filter[state]=1&page[limit]=${PAGE}&page[offset]=${offset}`); const d = (r.json || {}).data || []; d.forEach(a => out.push(artUrl(b, a.id, (a.attributes || {}).catid))); if (d.length < PAGE) break; offset += d.length; }
      return out;
    },
    /* POST /media/files {path: 'local-images:/<folder>/<file>', content: <base64>}; a POST with a path and no content creates a folder.
       ?url=true asks for the url attribute on the file object. Verified against the media web service pull request
       (https://github.com/joomla/joomla-cms/pull/35788). The folder listing is GET /media/files/<folder>/ with the trailing slash: the
       media plugin routes v1/media/files/:path/ to displayList (the folder's files, data is an array) and v1/media/files/:path without it
       to displayItem (one object). It is used only to reuse a file that is already there and to notice a missing folder; both are tolerated. */
    async uploadMedia(cfg, asset, ctx) {
      const b = base(cfg); const folder = folderOf(cfg); const file = safeName(asset.file || ('image.' + CMS.extOf('', asset.mime)));
      const list = await H(ctx)(`${b}${API}/media/files/${folder}/?url=true`, { headers: headers(cfg), tolerate: true });
      if (list.status === 200) { const rows = (list.json || {}).data; const hit = (Array.isArray(rows) ? rows : []).find(x => (x.attributes || {}).name === file); if (hit) { const a = hit.attributes || {}; return { id: hit.id || a.path || `${folder}/${file}`, url: a.url || imgUrl(b, folder, file), width: a.width || asset.width, height: a.height || asset.height, mime: a.mime_type || asset.mime, reused: true }; } }
      else if (list.status === 404) await H(ctx)(`${b}${API}/media/files`, { method: 'POST', headers: headers(cfg), body: { path: `${ADAPTER}:/${folder}` }, tolerate: true });
      const bytes = await CMS.blobBytes(asset.blob);
      const r = await api(cfg, ctx, 'POST', '/media/files?url=true', { path: `${ADAPTER}:/${folder}/${file}`, content: CMS.b64(bytes) });
      const d = (r.json || {}).data || {}; const a = d.attributes || {};
      return { id: d.id || a.path || `${folder}/${file}`, url: a.url || imgUrl(b, folder, file), width: a.width || asset.width, height: a.height || asset.height, mime: a.mime_type || asset.mime, reused: false };
    },
    /* POST /content/articles or PATCH /content/articles/{id}. Required on create: title, alias, articletext, catid, language, metadesc, metakey
       (https://magazine.joomla.org/all-issues/april-2023/playing-with-the-joomla-api-part-2); state, access and featured are sent so the
       article does not inherit defaults. images and urls are not sent: the model fills them and the community examples work without them. */
    async upsertPage(cfg, page, opts, ctx) {
      const b = base(cfg); const publish = !!(opts && opts.publish); const notes = []; const seo = page.seo || {};
      const ex = await findArticle(cfg, ctx, page);
      const desc = String(seo.description || page.meta_description || ''); if (desc.length > METADESC_MAX) notes.push(`meta description cut to ${METADESC_MAX} characters (Joomla's limit)`);
      const body = { title: page.h1 || page.title, alias: page.slug, articletext: CMS.bodyHtml(page, { css: true, schema: true }), catid: catId(cfg), language: val(cfg, 'language', '*'), state: publish ? 1 : 0, access: parseInt(val(cfg, 'access', '1'), 10) || 1, featured: 0, metadesc: desc.slice(0, METADESC_MAX), metakey: '' };
      if (seo.noindex || page.noindex) body.metadata = { robots: 'noindex, follow', author: '', rights: '' };
      if (seo.canonical || page.canonical) notes.push('Joomla has no per article canonical field; the canonical was not sent');
      const r = ex ? await api(cfg, ctx, 'PATCH', `/content/articles/${ex.id}`, body) : await api(cfg, ctx, 'POST', '/content/articles', body);
      const d = (r.json || {}).data || {}; const id = d.id || (ex && ex.id); const a = d.attributes || {};
      if (!id) throw CMS.err('Joomla did not return the article id', { status: r.status, hint: 'the Web Services - Content plugin must be enabled' });
      if (a.alias && a.alias !== page.slug) notes.push(`Joomla changed the alias to ${a.alias}`);
      notes.push('the link is the non SEF form; the SEF URL depends on the menu item that covers the category');
      return { id, link: artUrl(b, id, a.catid || body.catid), edit: `${b}/administrator/index.php?option=com_content&task=article.edit&id=${id}`, status: publish ? 'publish' : 'draft', updated: !!ex, notes: notes.join('; ') };
    },
  });
})();
