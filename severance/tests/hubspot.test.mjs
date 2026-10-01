import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset, parseMultipart } from './lib/mock.mjs';
const CMS = await load(['src/cms/16_hubspot.js']);
const A = CMS.get('hubspot'); assert(A && A.id === 'hubspot' && A.caps.schema === 'head' && A.hosts[0] === 'https://api.hubapi.com/*', 'registered');
eq(A.base({}), 'https://api.hubapi.com', 'fixed host'); eq(A.base({ apiBase: 'http://x/' }), 'http://x', 'apiBase override');
eq(A.dynamicHost({}), '', 'fixed host needs no prompt'); eq(A.dynamicHost({ apiBase: 'https://api-eu1.hubapi.com/' }), 'https://api-eu1.hubapi.com', 'regional apiBase asks for its origin');
const logs = []; const ctx = { http: CMS.http, log: m => logs.push(m) };
const POSTS = '/cms/v3/blogs/posts', BLOGS = '/cms/v3/blog-settings/settings', PAGES = '/cms/v3/pages/site-pages';
const CDN = 'https://12345.fs1.hubspotusercontent-na1.net/hubfs/12345/forge/hero.webp';
let exists = false, live = false, pageExists = false, pageLive = false, filterFail = false, unauth = false, pageNested = false, rateLimitOnce = false, scheduleStrict = 0;
const LIMITED = { status: 429, json: { status: 'error', message: 'You have reached your ten secondly limit.', errorType: 'RATE_LIMIT', correlationId: 'y', category: 'RATE_LIMITS' } };
const POST = (over) => Object.assign({ id: '101', slug: 'blog/divorce-lawyer', contentGroupId: '987', name: 'Old', url: srv.url + '/blog/divorce-lawyer', state: live ? 'PUBLISHED' : 'DRAFT', currentState: live ? 'PUBLISHED' : 'DRAFT' }, over || {});
const PAGE = (over) => Object.assign({ id: '202', slug: 'divorce-lawyer', name: 'Old', url: srv.url + '/divorce-lawyer', state: pageLive ? 'PUBLISHED' : 'DRAFT', currentState: pageLive ? 'PUBLISHED' : 'DRAFT' }, over || {});
const AUTH = { status: 401, json: { status: 'error', message: 'Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details at https://developers.hubspot.com/docs/methods/auth/oauth-overview', correlationId: 'x', category: 'INVALID_AUTHENTICATION' } };
const srv = await mock([
  { method: 'GET', path: POSTS, handler: c => { if (unauth) return AUTH; if (rateLimitOnce) { rateLimitOnce = false; return LIMITED; }
    if (c.query.slug__icontains != null) return filterFail ? { status: 400, json: { status: 'error', message: "Filter violation: Filtering by 'slug contains' is not allowed", category: 'VALIDATION_ERROR' } } : { status: 200, json: { results: exists && c.query.slug__icontains === 'divorce-lawyer' ? [POST(), POST({ id: '999', slug: 'blog/divorce-lawyer-2' })] : [], total: exists ? 2 : 0 } };
    if (c.query.state__eq === 'PUBLISHED') return c.query.after ? { status: 200, json: { results: [{ id: '3', url: srv.url + '/blog/c' }], paging: {} } } : { status: 200, json: { results: [{ id: '1', url: srv.url + '/blog/a' }, { id: '2', url: srv.url + '/blog/b' }], paging: { next: { after: 'cur1', link: '' } } } };
    if (c.query.limit === '1') return { status: 200, json: { results: [POST()], total: 12 } };
    return { status: 200, json: { results: exists ? [POST({ slug: 'blog/other' }), POST({ slug: 'news/tips/divorce-lawyer', contentGroupId: '555', url: srv.url + '/news/tips/divorce-lawyer' })] : [], total: exists ? 2 : 0 } }; } },
  { method: 'GET', path: BLOGS, reply: { results: [{ id: 987, name: 'News', slug: 'blog', absoluteUrl: 'https://www.test.co/blog', htmlTitle: 'News' }], total: 1 } },
  { method: 'GET', path: BLOGS + '/987', reply: { id: 987, name: 'News', slug: 'blog', absoluteUrl: 'https://www.test.co/blog' } },
  { method: 'GET', path: BLOGS + '/555', reply: { id: 555, name: 'Other', slug: 'news/tips' } },
  { method: 'GET', path: '/cms/v3/blogs/authors', reply: { results: [{ id: '55', displayName: 'Editor', slug: 'editor' }], total: 1 } },
  { method: 'GET', path: '/account-info/v3/details', reply: { portalId: 12345, accountType: 'STANDARD', timeZone: 'Europe/Dublin', companyCurrency: 'EUR', uiDomain: 'app-eu1.hubspot.com', dataHostingLocation: 'eu1' } },
  { method: 'POST', path: POSTS, handler: c => ({ status: 201, json: POST({ id: '101', slug: c.json.slug, url: srv.url + '/' + c.json.slug, state: 'DRAFT', currentState: 'DRAFT' }) }) },
  { method: 'PATCH', path: POSTS + '/101', handler: c => ({ status: 200, json: POST({ slug: c.json.slug, url: srv.url + '/' + c.json.slug }) }) },
  { method: 'PATCH', path: POSTS + '/101/draft', handler: c => ({ status: 200, json: POST({ slug: c.json.slug, url: srv.url + '/' + c.json.slug }) }) },
  { method: 'POST', path: POSTS + '/schedule', handler: c => { if (scheduleStrict && Date.parse(c.json.publishDate) < Date.now() + 30000) { scheduleStrict++; return { status: 400, json: { status: 'error', message: 'Publish date must be in the future', category: 'VALIDATION_ERROR' } }; } return { status: 204 }; } },
  { method: 'GET', path: PAGES, handler: c => { if (c.query.slug__icontains != null) return { status: 200, json: { results: pageNested ? [PAGE({ id: '303', slug: 'about/divorce-lawyer', url: srv.url + '/about/divorce-lawyer' })] : pageExists ? [PAGE()] : [], total: pageExists || pageNested ? 1 : 0 } };
    if (c.query.state__in === 'PUBLISHED_OR_SCHEDULED') return { status: 200, json: { results: [{ id: '7', url: srv.url + '/p1', state: 'PUBLISHED', currentState: 'PUBLISHED' }, { id: '8', url: srv.url + '/p2', state: 'SCHEDULED', currentState: 'SCHEDULED' }], paging: {} } };
    return { status: 200, json: { results: [PAGE()], total: 34 } }; } },
  { method: 'POST', path: PAGES, handler: c => ({ status: 201, json: PAGE({ id: '202', slug: c.json.slug, url: srv.url + '/' + c.json.slug, state: 'DRAFT', currentState: 'DRAFT' }) }) },
  { method: 'PATCH', path: PAGES + '/202', handler: c => ({ status: 200, json: PAGE({ slug: c.json.slug }) }) },
  { method: 'PATCH', path: PAGES + '/202/draft', handler: c => ({ status: 200, json: PAGE({ slug: c.json.slug }) }) },
  { method: 'POST', path: PAGES + '/schedule', handler: () => ({ status: 204 }) },
  { method: 'POST', path: '/files/v3/files', handler: () => ({ status: 201, json: { id: '77', createdAt: '2026-09-27T00:00:00Z', archived: false, parentFolderId: '5', name: 'hero', path: '/forge/hero.webp', size: 16, url: CDN, defaultHostingUrl: CDN, extension: 'webp', type: 'IMG', width: 1600, height: 1000, access: 'PUBLIC_INDEXABLE' } }) },
]);
const cfg = { token: 'pat-na1-test', apiBase: srv.url, mode: 'blog', contentGroupId: '987' };
/* test(): posts count, blog list, portal id, Bearer header */
const t = await A.test(cfg, ctx);
assert(t.ok && t.info === 'HubSpot portal 12345, 12 blog posts, blogs: News (987, /blog), blog mode', 'test info: ' + t.info); eq(t.meta.portalId, 12345, 'portal'); eq(t.meta.uiDomain, 'app-eu1.hubspot.com', 'ui host from the account'); eq(t.meta.blogs, [{ id: '987', name: 'News', slug: 'blog', url: 'https://www.test.co/blog' }], 'blogs meta');
const c0 = srv.calls[0]; eq(c0.method, 'GET', 'first call'); eq(c0.path, POSTS, 'posts path'); eq(c0.query, { limit: '1' }, 'limit 1'); eq(c0.headers.authorization, 'Bearer pat-na1-test', 'bearer'); eq(c0.headers.accept, 'application/json', 'accept');
eq(srv.calls[1].path, BLOGS, 'blog list'); eq(srv.calls[1].query, { limit: '10' }, 'blog limit'); eq(srv.calls[2].path, '/account-info/v3/details', 'portal id'); assert(!srv.find('GET', PAGES), 'no pages call in blog mode');
const tp = await A.test(Object.assign({}, cfg, { mode: 'page', contentGroupId: '1' }), ctx); assert(/34 site pages, page mode, Blog id 1 is not in the list$/.test(tp.info), 'page mode info: ' + tp.info); eq(srv.find('GET', PAGES).query, { limit: '1' }, 'pages limit 1');
/* upsert blog post: blog root + author + slug lookup, then POST as a draft with the SEO fields, JSON-LD in headHtml */
let n0 = srv.calls.length; const r1 = await A.upsertPage(cfg, page(), { publish: false }, ctx);
const seq = srv.calls.slice(n0).map(c => c.method + ' ' + c.path); eq(seq, ['GET /cms/v3/blogs/authors', 'GET ' + POSTS, 'POST ' + POSTS], 'create sequence (blog root cached by test)');
eq(srv.calls[n0].query, { limit: '1' }, 'first author'); eq(srv.calls[n0 + 1].query, { slug__icontains: 'divorce-lawyer', limit: '100' }, 'slug filter');
const cr = srv.calls[n0 + 2]; eq(cr.headers['content-type'], 'application/json', 'json body'); const b = cr.json;
eq(b.name, 'Divorce Lawyer in Plano, TX', 'name is h1'); eq(b.slug, 'blog/divorce-lawyer', 'slug under the blog root'); eq(b.contentGroupId, '987', 'blog id'); eq(b.blogAuthorId, '55', 'author from the account'); eq(b.state, 'DRAFT', 'draft');
assert(b.postBody.startsWith('<style>') && b.postBody.includes('<h1>Divorce Lawyer in Plano, TX</h1>') && !b.postBody.includes('ld+json'), 'postBody with css, no schema'); eq(b.postSummary, 'Family law counsel from Test Co.', 'summary');
eq(b.htmlTitle, 'Divorce Lawyer in Plano, TX | Test Co', 'htmlTitle'); eq(b.metaDescription, 'Divorce and custody counsel across Plano.', 'metaDescription'); eq(b.linkRelCanonicalUrl, 'https://www.example.com/divorce-lawyer/', 'canonical');
assert(b.headHtml.startsWith('<script type="application/ld+json">') && !b.headHtml.includes('robots'), 'JSON-LD in headHtml, no robots when indexable');
eq(b.useFeaturedImage, true, 'featured on'); eq(b.featuredImage, 'https://cdn.example.com/hero.webp', 'featured image'); eq(b.featuredImageAltText, 'Technician at a condenser', 'featured alt');
eq(r1, { id: '101', link: srv.url + '/blog/divorce-lawyer', edit: 'https://app-eu1.hubspot.com/blog/12345/editor/101/content', status: 'draft', updated: false, notes: 'SEO title and description in htmlTitle and metaDescription; JSON-LD in headHtml; css inline in the body' }, 'create result (editor on the account ui host)');
assert(!srv.find('POST', POSTS + '/schedule'), 'no schedule on a draft');
/* publish a new post: POST then schedule now; the blog root and author come from the cache */
n0 = srv.calls.length; const before = Date.now(); const r2 = await A.upsertPage(cfg, page(), { publish: true }, ctx);
eq(srv.calls.slice(n0).map(c => c.method + ' ' + c.path), ['GET ' + POSTS, 'POST ' + POSTS, 'POST ' + POSTS + '/schedule'], 'publish sequence');
const sch = srv.calls[n0 + 2]; eq(sch.json.id, '101', 'schedule id'); const when = Date.parse(sch.json.publishDate); assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(sch.json.publishDate) && when >= before - 1000 && when <= Date.now() + 1000, 'publishDate is now (ISO)');
eq(r2.status, 'publish', 'published'); eq(r2.updated, false, 'created'); assert(!/refused the current time/.test(r2.notes), 'no schedule note when now is accepted');
/* the schedule call refuses the current time → repeated one minute out, said in the notes */
scheduleStrict = 1; n0 = srv.calls.length; const r2b = await A.upsertPage(cfg, page(), { publish: true }, ctx);
const sc = srv.calls.slice(n0).filter(c => c.path === POSTS + '/schedule'); eq(sc.length, 2, 'schedule repeated once'); assert(Date.parse(sc[1].json.publishDate) >= Date.now() + 30000 && Date.parse(sc[1].json.publishDate) <= Date.now() + 90000, 'second publishDate about a minute out');
assert(r2b.status === 'publish' && /goes live in 60 s/.test(r2b.notes) && logs.some(l => /schedule refused/.test(l)), 'schedule fallback noted: ' + r2b.notes); scheduleStrict = 0;
/* 429 once → wait and repeat the same request */
rateLimitOnce = true; n0 = srv.calls.length; const r2c = await A.upsertPage(cfg, page(), { publish: false }, ctx);
eq(srv.calls.slice(n0, n0 + 2).map(c => c.method + ' ' + c.path + ' ' + (c.query.slug__icontains || '')), ['GET ' + POSTS + ' divorce-lawyer', 'GET ' + POSTS + ' divorce-lawyer'], 'rate limited request repeated'); assert(r2c.id === '101' && logs.some(l => /rate limit/.test(l)), 'retry logged');
/* exists as a draft → PATCH the post (no state), then schedule when publishing; the exact slug wins over the icontains neighbours */
exists = true; n0 = srv.calls.length; const r3 = await A.upsertPage(cfg, page(), { publish: true }, ctx);
eq(srv.calls.slice(n0).map(c => c.method + ' ' + c.path), ['GET ' + POSTS, 'PATCH ' + POSTS + '/101', 'POST ' + POSTS + '/schedule'], 'update + publish sequence');
assert(!('state' in srv.calls[n0 + 1].json) && srv.calls[n0 + 1].json.slug === 'blog/divorce-lawyer', 'PATCH without state'); eq(r3.updated, true, 'updated'); eq(r3.status, 'publish', 'published');
/* exists and live: draft goes to the draft buffer, publish patches the live post, neither schedules */
live = true; n0 = srv.calls.length; const r4 = await A.upsertPage(cfg, page(), { publish: false }, ctx);
eq(srv.calls.slice(n0).map(c => c.method + ' ' + c.path), ['GET ' + POSTS, 'PATCH ' + POSTS + '/101/draft'], 'draft of a live post'); eq(r4.status, 'draft', 'draft status'); assert(/live page is unchanged/.test(r4.notes), 'draft note');
n0 = srv.calls.length; const r5 = await A.upsertPage(cfg, page({ noindex: true, seo: Object.assign({}, page().seo, { noindex: true }) }), { publish: true }, ctx);
eq(srv.calls.slice(n0).map(c => c.method + ' ' + c.path), ['GET ' + POSTS, 'PATCH ' + POSTS + '/101'], 'publish on a live post patches it'); eq(r5.status, 'publish', 'live status');
assert(srv.calls[n0 + 1].json.headHtml.includes('<meta name="robots" content="noindex,follow">') && srv.calls[n0 + 1].json.headHtml.includes('ld+json'), 'robots and JSON-LD in headHtml'); assert(/noindex/.test(r5.notes), 'noindex note');
/* the slug filter refused → list and match; a configured author skips the authors call; another blog root */
filterFail = true; live = false; n0 = srv.calls.length; const r6 = await A.upsertPage(Object.assign({}, cfg, { authorId: '9', contentGroupId: '555' }), page(), {}, ctx);
const s6 = srv.calls.slice(n0); eq(s6.map(c => c.method + ' ' + c.path), ['GET ' + BLOGS + '/555', 'GET ' + POSTS, 'GET ' + POSTS, 'PATCH ' + POSTS + '/101'], 'fallback listing'); eq(s6[2].query, { limit: '100' }, 'plain list'); eq(s6[3].json.slug, 'news/tips/divorce-lawyer', 'nested blog root'); eq(s6[3].json.blogAuthorId, '9', 'configured author'); eq(s6[3].json.contentGroupId, '555', 'group');
assert(r6.updated && logs.some(l => /slug filter refused/.test(l)), 'fallback logged'); filterFail = false;
let e = null; try { await A.upsertPage({ token: 't', apiBase: srv.url, mode: 'blog' }, page(), {}, ctx); } catch (x) { e = x; } assert(e && e.status === 0 && /Blog id/.test(e.message), 'blog id required');
/* page mode: one rich text module inside the dnd area, template path, domain, schedule to publish */
const pcfg = Object.assign({}, cfg, { mode: 'page', templatePath: '@hubspot/growth/templates/blank.html', domain: 'https://www.test.co/' });
n0 = srv.calls.length; const r7 = await A.upsertPage(pcfg, page(), { publish: true }, ctx);
eq(srv.calls.slice(n0).map(c => c.method + ' ' + c.path), ['GET ' + PAGES, 'POST ' + PAGES, 'POST ' + PAGES + '/schedule'], 'page sequence'); eq(srv.calls[n0].query, { slug__icontains: 'divorce-lawyer', limit: '100' }, 'page slug filter');
const pb = srv.calls[n0 + 1].json; eq(pb.name, 'Divorce Lawyer in Plano, TX', 'page name'); eq(pb.slug, 'divorce-lawyer', 'page slug'); eq(pb.templatePath, '@hubspot/growth/templates/blank.html', 'template'); eq(pb.domain, 'www.test.co', 'domain'); eq(pb.state, 'DRAFT', 'page draft'); eq(pb.htmlTitle, 'Divorce Lawyer in Plano, TX | Test Co', 'page htmlTitle');
assert(!('postBody' in pb) && !('contentGroupId' in pb), 'no post fields'); const sec = pb.layoutSections.dnd_area; assert(sec && sec.type === 'cell' && sec.name === 'dnd_area' && sec.w === 12 && sec.rowMetaData[0].cssClass === 'dnd-section', 'section');
const col = sec.rows[0]['0']; assert(col.type === 'cell' && col.params.css_class === 'dnd-column', 'column'); const mod = col.rows[0]['0'];
eq(mod.type, 'custom_widget', 'module type'); eq(mod.params.path, '@hubspot/rich_text', 'rich text module'); assert(mod.params.html.startsWith('<style>') && mod.params.html.includes('<h1>Divorce Lawyer in Plano, TX</h1>') && !mod.params.html.includes('ld+json'), 'module html'); eq(mod.w, 12, 'full width');
eq(srv.calls[n0 + 2].json.id, '202', 'page schedule id'); eq(r7.id, '202'); eq(r7.link, srv.url + '/divorce-lawyer', 'page link'); eq(r7.edit, 'https://app-eu1.hubspot.com/pages/12345/editor/202/content', 'page edit'); eq(r7.status, 'publish');
/* a page whose slug only ends with ours (about/divorce-lawyer) is another page: create, do not overwrite it */
pageNested = true; n0 = srv.calls.length; const r7b = await A.upsertPage(pcfg, page(), {}, ctx);
eq(srv.calls.slice(n0).map(c => c.method + ' ' + c.path), ['GET ' + PAGES, 'POST ' + PAGES], 'nested slug is not a match in page mode'); eq(r7b.updated, false, 'created'); pageNested = false;
pageExists = true; pageLive = true; n0 = srv.calls.length; const r8 = await A.upsertPage(Object.assign({}, pcfg, { dndArea: 'main' }), page(), {}, ctx);
eq(srv.calls.slice(n0).map(c => c.method + ' ' + c.path), ['GET ' + PAGES, 'PATCH ' + PAGES + '/202/draft'], 'live page, draft'); assert(srv.calls[n0 + 1].json.layoutSections.main && !srv.calls[n0 + 1].json.layoutSections.dnd_area, 'custom dnd area name'); eq(r8.updated, true);
e = null; try { await A.upsertPage(Object.assign({}, cfg, { mode: 'page' }), page(), {}, ctx); } catch (x) { e = x; } assert(e && /template path/.test(e.message) && /blank\.html/.test(e.hint), 'template path required');
/* uploadMedia: multipart file, fileName, folderPath, options JSON */
const m = await A.uploadMedia(cfg, asset(), ctx);
const upl = srv.find('POST', '/files/v3/files'); assert(upl && /^multipart\/form-data; boundary=/.test(upl.headers['content-type']), 'multipart'); eq(upl.headers.authorization, 'Bearer pat-na1-test', 'bearer on upload');
const parts = parseMultipart(upl); const f = parts.find(x => x.name === 'file'); assert(f && f.filename === 'hero.webp' && f.type === 'image/webp' && f.data.length === 16, 'file part');
eq(parts.find(x => x.name === 'fileName').data.toString(), 'hero.webp', 'fileName'); eq(parts.find(x => x.name === 'folderPath').data.toString(), '/forge', 'folderPath');
eq(JSON.parse(parts.find(x => x.name === 'options').data.toString()), { access: 'PUBLIC_INDEXABLE', overwrite: true, duplicateValidationStrategy: 'NONE', duplicateValidationScope: 'EXACT_FOLDER' }, 'options');
eq(m, { id: '77', url: CDN, width: 1600, height: 1000, mime: 'image/webp', reused: false }, 'upload result');
/* listUrls: published posts (paginated with after) and published site pages */
const urls = await A.listUrls(cfg, ctx); eq(urls, [srv.url + '/blog/a', srv.url + '/blog/b', srv.url + '/blog/c', srv.url + '/p1'], 'urls');
const lp = srv.all('GET', POSTS).filter(c => c.query.state__eq === 'PUBLISHED'); eq(lp.map(c => c.query.after || null), [null, 'cur1'], 'after cursor'); eq(lp[0].query.limit, '100', 'limit 100'); eq(srv.all('GET', PAGES).find(c => c.query.state__in).query.state__in, 'PUBLISHED_OR_SCHEDULED', 'page state filter');
/* errors: 401 */
unauth = true; e = null; try { await A.test(cfg, ctx); } catch (x) { e = x; } assert(e && e.status === 401 && /Authentication credentials not found/.test(e.message) && /Private apps/.test(e.hint), '401: ' + (e && e.hint)); unauth = false;
e = null; try { await A.test({ apiBase: srv.url }, ctx); } catch (x) { e = x; } assert(e && e.status === 0 && /token/.test(e.message), 'missing token');
await srv.close();
console.log('hubspot ok');
