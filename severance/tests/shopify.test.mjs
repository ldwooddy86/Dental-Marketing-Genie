import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset, parseMultipart } from './lib/mock.mjs';
const CMS = await load(['src/cms/15_shopify.js']);
const A = CMS.get('shopify'); assert(A && A.id === 'shopify' && A.caps.schema === 'inline' && A.caps.postTypes.includes('post'), 'registered');
eq(A.version(), '2026-07', 'pinned API version');
const logs = []; const ctx = { http: CMS.http, log: m => logs.push(m) };
const GQL = /^\/admin\/api\/(\d{4}-\d{2}|unstable)\/graphql\.json$/;
const opOf = q => (String(q).match(/^\s*(?:query|mutation)\s+(\w+)/) || [])[1];
const PAGE_ID = 'gid://shopify/Page/602767277', ART_ID = 'gid://shopify/Article/8814', FILE_ID = 'gid://shopify/MediaImage/42', CDN = 'https://cdn.shopify.com/s/files/1/0000/files/hero.webp', RES = 'https://shopify-staged-uploads.storage.googleapis.com/tmp/1/files/hero.webp';
let exists = false, aExists = false, throttleOnce = false, failCreate = false, unauth = false, uploadedFirst = false, polls = 0;
const srv = await mock([
  { method: 'POST', path: '/staged', handler: () => ({ status: 201, text: '' }) },
  { method: 'POST', path: GQL, handler: c => {
    if (unauth) return { status: 401, json: { errors: '[API] Invalid API key or access token (unrecognized login or wrong password)' } };
    if (throttleOnce) { throttleOnce = false; return { status: 200, json: { errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED', documentation: 'https://shopify.dev/api/usage/rate-limits' } }], extensions: { cost: { requestedQueryCost: 10, actualQueryCost: null, throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 0, restoreRate: 100 } } } } }; }
    const op = opOf(c.json.query); const v = c.json.variables || {};
    switch (op) {
      case 'ForgeShop': return { json: { data: { shop: { name: 'Test Co', myshopifyDomain: 'teststore.myshopify.com', primaryDomain: { url: 'https://www.test.co', host: 'www.test.co' }, plan: { publicDisplayName: 'Basic', partnerDevelopment: false } } } } };
      case 'ForgeScopes': return { json: { data: { currentAppInstallation: { accessScopes: [{ handle: 'write_content' }, { handle: 'read_content' }, { handle: 'write_files' }] } } } };
      case 'ForgeBlog': return { json: { data: { blog: v.id === 'gid://shopify/Blog/123' ? { id: v.id, handle: 'news', title: 'News' } : null } } };
      case 'ForgePageByHandle': return { json: { data: { shop: { primaryDomain: { url: 'https://www.test.co' } }, pages: { nodes: exists && v.q === 'handle:ac-repair' ? [{ id: PAGE_ID, handle: 'ac-repair', title: 'Old', isPublished: true, titleTag: { id: 'gid://shopify/Metafield/1' }, descriptionTag: { id: 'gid://shopify/Metafield/2' }, seoHidden: null }] : [] } } } };
      case 'ForgePageCreate': if (failCreate) return { json: { data: { pageCreate: { page: null, userErrors: [{ code: 'TAKEN', field: ['page', 'handle'], message: 'has already been taken' }] } } } }; return { json: { data: { pageCreate: { page: { id: PAGE_ID, handle: v.page.handle, title: v.page.title, isPublished: v.page.isPublished }, userErrors: [] } } } };
      case 'ForgePageUpdate': return { json: { data: { pageUpdate: { page: { id: v.id, handle: v.page.handle, title: v.page.title, isPublished: v.page.isPublished }, userErrors: [] } } } };
      case 'ForgeArticleByHandle': return { json: { data: { shop: { primaryDomain: { url: 'https://www.test.co' } }, articles: { nodes: aExists ? [{ id: ART_ID, handle: 'ac-repair', title: 'Old', isPublished: false, blog: { id: 'gid://shopify/Blog/123', handle: 'news' }, titleTag: null, descriptionTag: null, seoHidden: null }] : [] } } } };
      case 'ForgeArticleCreate': return { json: { data: { articleCreate: { article: { id: ART_ID, handle: v.article.handle, title: v.article.title, isPublished: v.article.isPublished, blog: { id: v.article.blogId, handle: 'news' } }, userErrors: [] } } } };
      case 'ForgeArticleUpdate': return { json: { data: { articleUpdate: { article: { id: v.id, handle: v.article.handle, title: v.article.title, isPublished: v.article.isPublished, blog: { id: 'gid://shopify/Blog/123', handle: 'news' } }, userErrors: [] } } } };
      case 'ForgePages': return v.after ? { json: { data: { pages: { nodes: [{ handle: 'c', isPublished: true }], pageInfo: { hasNextPage: false, endCursor: null } } } } } : { json: { data: { pages: { nodes: [{ handle: 'a', isPublished: true }, { handle: 'b', isPublished: false }], pageInfo: { hasNextPage: true, endCursor: 'cur1' } } } } };
      case 'ForgeArticles': return { json: { data: { articles: { nodes: [{ handle: 'post-1', isPublished: true, blog: { handle: 'news' } }, { handle: 'post-2', isPublished: false, blog: { handle: 'news' } }], pageInfo: { hasNextPage: false, endCursor: null } } } } };
      case 'ForgeStagedUploads': return { json: { data: { stagedUploadsCreate: { stagedTargets: [{ url: srv.url + '/staged', resourceUrl: RES, parameters: [{ name: 'key', value: 'tmp/1/files/hero.webp' }, { name: 'policy', value: 'abc' }, { name: 'x-goog-signature', value: 'sig' }] }], userErrors: [] } } } };
      case 'ForgeFileCreate': return { json: { data: { fileCreate: { files: [uploadedFirst ? { id: FILE_ID, fileStatus: 'UPLOADED', alt: v.files[0].alt, image: null } : { id: FILE_ID, fileStatus: 'READY', alt: v.files[0].alt, image: { url: CDN, width: 1600, height: 1000 } }], userErrors: [] } } } };
      case 'ForgeFileStatus': polls++; return { json: { data: { node: { id: v.id, fileStatus: 'READY', fileErrors: [], image: { url: CDN, width: 1600, height: 1000 } } } } };
    }
    return { status: 400, json: { errors: [{ message: 'unknown op ' + op }] } };
  } },
]);
const cfg = { shop: 'teststore.myshopify.com', token: 'shpat_test', apiBase: srv.url };
const gcalls = () => srv.all('POST', GQL); const ops = () => gcalls().map(c => opOf(c.json.query));
/* base and hosts: any pasted form of the store domain, myshopify hosts are fixed, other hosts ask for permission */
eq(A.base({ shop: 'https://TestStore.myshopify.com/admin' }), 'https://teststore.myshopify.com', 'base from a url'); eq(A.base({ shop: 'teststore' }), 'https://teststore.myshopify.com', 'base from a handle');
eq(A.dynamicHost({ shop: 'teststore' }), '', 'myshopify host needs no prompt'); eq(A.dynamicHost({ shop: 'x', apiBase: 'https://cms.example.com' }), 'https://cms.example.com', 'apiBase host asks');
/* test(): shop query, scopes query, token header, pinned version in the path */
const t = await A.test(cfg, ctx);
assert(t.ok && /^Shopify Basic "Test Co" \(teststore\.myshopify\.com\), API 2026-07, site https:\/\/www\.test\.co, scopes ok$/.test(t.info), 'test info: ' + t.info);
eq(t.meta.store, 'teststore', 'store handle'); eq(t.meta.primaryDomain, 'https://www.test.co', 'primary domain'); eq(t.meta.missing, [], 'no missing scopes');
const c0 = gcalls()[0]; eq(c0.path, '/admin/api/2026-07/graphql.json', 'endpoint'); eq(c0.headers['x-shopify-access-token'], 'shpat_test', 'token header'); eq(c0.headers['content-type'], 'application/json', 'json body');
assert(/shop \{ name myshopifyDomain primaryDomain \{ url host \} plan \{ publicDisplayName/.test(c0.json.query) && c0.json.variables && typeof c0.json.variables === 'object', 'shop query'); eq(ops(), ['ForgeShop', 'ForgeScopes'], 'test ops');
/* blog id validated in test(); version override changes the path */
const tb = await A.test(Object.assign({}, cfg, { blogId: '123', apiVersion: '2026-10' }), ctx); assert(/API 2026-10/.test(tb.info) && /blog "News" \(\/blogs\/news\)/.test(tb.info), 'blog in info: ' + tb.info);
const bq = gcalls().find(c => opOf(c.json.query) === 'ForgeBlog'); eq(bq.path, '/admin/api/2026-10/graphql.json', 'version override'); eq(bq.json.variables, { id: 'gid://shopify/Blog/123' }, 'blog gid from a number');
let e = null; try { await A.test(Object.assign({}, cfg, { blogId: '999' }), ctx); } catch (x) { e = x; } assert(e && e.status === 404 && /No blog with id 999/.test(e.message), 'unknown blog: ' + (e && e.message));
e = null; try { await A.test(Object.assign({}, cfg, { apiVersion: 'v1' }), ctx); } catch (x) { e = x; } assert(e && /not a Shopify version/.test(e.message), 'bad version');
e = null; try { await A.test({ shop: 'teststore', apiBase: srv.url }, ctx); } catch (x) { e = x; } assert(e && e.status === 0 && /token/.test(e.message), 'missing token');
/* a custom domain is refused before any request: the Admin API lives on the myshopify domain */
let nBefore = srv.calls.length; e = null; try { await A.test({ shop: 'https://www.example.com', token: 'shpat_test' }, ctx); } catch (x) { e = x; } assert(e && e.status === 0 && /not a store\.myshopify\.com domain/.test(e.message) && /Public site URL/.test(e.hint) && srv.calls.length === nBefore, 'custom domain refused: ' + (e && e.message));
/* upsert page: lookup by handle, then pageCreate as a draft with the SEO metafields */
let n0 = gcalls().length; const p = page();
const r1 = await A.upsertPage(cfg, p, { publish: false }, ctx);
eq(ops().slice(n0), ['ForgePageByHandle', 'ForgePageCreate'], 'create ops');
const look = gcalls()[n0]; eq(look.json.variables, { q: 'handle:ac-repair' }, 'handle filter'); assert(/pages\(first: 10, query: \$q\)/.test(look.json.query) && /metafield\(namespace: "global", key: "title_tag"\)/.test(look.json.query) && /primaryDomain \{ url \}/.test(look.json.query), 'lookup query');
const cr = gcalls()[n0 + 1]; assert(/pageCreate\(page: \$page\)/.test(cr.json.query) && /userErrors \{ code field message \}/.test(cr.json.query), 'create mutation'); const pi = cr.json.variables.page;
eq(pi.title, 'AC Repair in Mesquite, TX', 'title is h1'); eq(pi.handle, 'ac-repair', 'handle'); eq(pi.isPublished, false, 'draft'); assert(!('templateSuffix' in pi) && !('id' in cr.json.variables), 'no suffix, no id on create');
assert(pi.body.startsWith('<style>') && pi.body.includes('<h1>AC Repair in Mesquite, TX</h1>') && pi.body.includes('application/ld+json'), 'body with css, markup, JSON-LD inline');
eq(pi.metafields, [{ namespace: 'global', key: 'title_tag', type: 'single_line_text_field', value: 'AC Repair in Mesquite, TX | Test Co' }, { namespace: 'global', key: 'description_tag', type: 'single_line_text_field', value: 'Same day AC repair across Mesquite.' }], 'SEO metafields');
eq(r1.id, PAGE_ID, 'id'); eq(r1.link, 'https://www.test.co/pages/ac-repair', 'link from the primary domain'); eq(r1.edit, 'https://admin.shopify.com/store/teststore/pages/602767277', 'edit'); eq(r1.status, 'draft', 'status'); eq(r1.updated, false, 'created'); assert(/canonical not sent/.test(r1.notes), 'canonical note');
/* siteUrl and templateSuffix */
n0 = gcalls().length; const r1b = await A.upsertPage(Object.assign({}, cfg, { siteUrl: 'https://www.example.com/', templateSuffix: 'forge' }), p, {}, ctx);
eq(gcalls()[n0 + 1].json.variables.page.templateSuffix, 'forge', 'template suffix'); eq(r1b.link, 'https://www.example.com/pages/ac-repair', 'link from siteUrl');
/* exists → pageUpdate with the id, metafield ids, publish, noindex through seo.hidden */
exists = true; n0 = gcalls().length;
const r2 = await A.upsertPage(cfg, page({ noindex: true, seo: Object.assign({}, page().seo, { noindex: true }) }), { publish: true }, ctx);
eq(ops().slice(n0), ['ForgePageByHandle', 'ForgePageUpdate'], 'update ops'); const up = gcalls()[n0 + 1]; assert(/pageUpdate\(id: \$id, page: \$page\)/.test(up.json.query), 'update mutation');
eq(up.json.variables.id, PAGE_ID, 'update id'); eq(up.json.variables.page.isPublished, true, 'published'); eq(up.json.variables.page.handle, 'ac-repair', 'handle kept');
eq(up.json.variables.page.metafields, [{ namespace: 'global', key: 'title_tag', type: 'single_line_text_field', value: 'AC Repair in Mesquite, TX | Test Co', id: 'gid://shopify/Metafield/1' }, { namespace: 'global', key: 'description_tag', type: 'single_line_text_field', value: 'Same day AC repair across Mesquite.', id: 'gid://shopify/Metafield/2' }, { namespace: 'seo', key: 'hidden', type: 'number_integer', value: '1' }], 'metafields with ids and seo.hidden');
eq(r2.updated, true, 'updated'); eq(r2.status, 'publish', 'publish status'); assert(/noindex/.test(r2.notes), 'noindex note');
const r2b = await A.upsertPage(cfg, page(), { publish: false }, ctx); assert(/unpublished/.test(r2b.notes) && r2b.status === 'draft', 'draft on a live page is noted');
/* posts: blog id → articles lookup, articleCreate with blogId, summary, author, image; then articleUpdate */
exists = false; const bcfg = Object.assign({}, cfg, { blogId: '123' }); n0 = gcalls().length;
const r3 = await A.upsertPage(bcfg, page({ post_type: 'post' }), {}, ctx);
eq(ops().slice(n0), ['ForgeArticleByHandle', 'ForgeArticleCreate'], 'article ops'); eq(gcalls()[n0].json.variables, { q: 'handle:ac-repair blog_id:123' }, 'article filter'); assert(/articles\(first: 10, query: \$q\)/.test(gcalls()[n0].json.query), 'articles query');
const ai = gcalls()[n0 + 1].json.variables.article; assert(/articleCreate\(article: \$article\)/.test(gcalls()[n0 + 1].json.query), 'articleCreate mutation');
eq(ai.blogId, 'gid://shopify/Blog/123', 'blogId'); eq(ai.title, 'AC Repair in Mesquite, TX', 'article title'); eq(ai.handle, 'ac-repair', 'article handle'); eq(ai.summary, 'AC repair from Test Co.', 'summary'); eq(ai.isPublished, false, 'article draft'); eq(ai.author, { name: 'Test Co' }, 'author from the brand'); eq(ai.image, { url: 'https://cdn.example.com/hero.webp', altText: 'Technician at a condenser' }, 'article image'); eq(ai.metafields.length, 2, 'article SEO metafields'); assert(ai.body.includes('<h1>'), 'article body');
eq(r3.id, ART_ID, 'article id'); eq(r3.link, 'https://www.test.co/blogs/news/ac-repair', 'article link'); eq(r3.edit, 'https://admin.shopify.com/store/teststore/content/articles/8814', 'article edit'); eq(r3.status, 'draft', 'article status');
aExists = true; n0 = gcalls().length; const r4 = await A.upsertPage(Object.assign({}, bcfg, { author: 'Dale' }), page({ post_type: 'post' }), { publish: true }, ctx);
eq(ops().slice(n0), ['ForgeArticleByHandle', 'ForgeArticleUpdate'], 'article update ops'); const au = gcalls()[n0 + 1].json.variables; eq(au.id, ART_ID, 'article update id'); assert(!('blogId' in au.article) && au.article.isPublished === true && au.article.author.name === 'Dale', 'update input'); eq(r4.updated, true, 'article updated'); eq(r4.status, 'publish', 'article published');
n0 = gcalls().length; await A.upsertPage(cfg, page({ post_type: 'post' }), {}, ctx); eq(ops()[n0], 'ForgePageByHandle', 'post without a blog id goes to pages'); assert(logs.some(m => /no Blog id/.test(m)), 'logged');
/* uploadMedia: stagedUploadsCreate, multipart POST with the parameters then the file, fileCreate, READY at once */
n0 = gcalls().length; const m = await A.uploadMedia(cfg, asset(), ctx);
eq(ops().slice(n0), ['ForgeStagedUploads', 'ForgeFileCreate'], 'upload ops'); eq(gcalls()[n0].json.variables, { input: [{ filename: 'hero.webp', mimeType: 'image/webp', resource: 'IMAGE', httpMethod: 'POST', fileSize: '16' }] }, 'staged input'); assert(/stagedTargets \{ url resourceUrl parameters \{ name value \} \}/.test(gcalls()[n0].json.query), 'staged query');
const st = srv.find('POST', '/staged'); assert(st && /^multipart\/form-data; boundary=/.test(st.headers['content-type']) && !st.headers['x-shopify-access-token'], 'multipart to the target without the token');
const parts = parseMultipart(st); eq(parts.map(x => x.name), ['key', 'policy', 'x-goog-signature', 'file'], 'parameters first, file last'); eq(parts[0].data.toString(), 'tmp/1/files/hero.webp', 'key value');
const fp = parts[3]; assert(fp.filename === 'hero.webp' && fp.type === 'image/webp' && fp.data.length === 16, 'file part');
eq(gcalls()[n0 + 1].json.variables, { files: [{ originalSource: RES, contentType: 'IMAGE', alt: 'Technician at a condenser', filename: 'hero.webp' }] }, 'fileCreate input'); assert(/\.\.\. on MediaImage \{ image \{ url width height \} \}/.test(gcalls()[n0 + 1].json.query), 'fileCreate query');
eq(m, { id: FILE_ID, url: CDN, width: 1600, height: 1000, mime: 'image/webp', reused: false }, 'upload result'); eq(polls, 0, 'no poll when READY at once');
uploadedFirst = true; n0 = gcalls().length; const m2 = await A.uploadMedia(cfg, asset(), ctx); eq(ops().slice(n0), ['ForgeStagedUploads', 'ForgeFileCreate', 'ForgeFileStatus'], 'polls node(id) until READY'); eq(gcalls()[n0 + 2].json.variables, { id: FILE_ID }, 'poll id'); eq(m2.url, CDN, 'poll result'); eq(polls, 1, 'one poll'); uploadedFirst = false;
e = null; try { await A.uploadMedia(cfg, Object.assign(asset(), { mime: 'video/mp4', file: 'clip.mp4' }), ctx); } catch (x) { e = x; } assert(e && /images only/.test(e.message), 'video refused');
/* throttled: HTTP 200 with extensions.code THROTTLED → wait and retry once */
throttleOnce = true; n0 = gcalls().length; exists = false; const r5 = await A.upsertPage(cfg, page(), {}, ctx);
eq(ops().slice(n0), ['ForgePageByHandle', 'ForgePageByHandle', 'ForgePageCreate'], 'retried after the throttle'); assert(r5.id === PAGE_ID && logs.some(l => /throttled/.test(l)), 'throttle logged');
/* listUrls: published pages and articles, cursor pagination */
const urls = await A.listUrls(cfg, ctx); eq(urls, ['https://www.test.co/pages/a', 'https://www.test.co/pages/c', 'https://www.test.co/blogs/news/post-1'], 'urls');
const lp = gcalls().filter(c => opOf(c.json.query) === 'ForgePages'); eq(lp.map(c => c.json.variables.after), [null, 'cur1'], 'cursor'); assert(/pages\(first: 250, after: \$after\)/.test(lp[0].json.query), 'first 250');
/* errors: userErrors, 401 */
failCreate = true; e = null; try { await A.upsertPage(cfg, page(), {}, ctx); } catch (x) { e = x; } assert(e && e.status === 200 && /pageCreate: page\.handle: has already been taken/.test(e.message) && /slug/.test(e.hint), 'userErrors: ' + (e && e.message)); failCreate = false;
unauth = true; e = null; try { await A.test(cfg, ctx); } catch (x) { e = x; } assert(e && e.status === 401 && /shpat_/.test(e.hint), '401: ' + (e && e.hint)); unauth = false;
await srv.close();
console.log('shopify ok');
