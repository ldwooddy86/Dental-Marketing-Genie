/* Duda adapter end to end against a mock Duda API: regions, test() with the site and pages, inject mode (duplicate the template
   page, update title, path and SEO, inject INNERHTML, republish), the exists → update branch, explicit and fallback template pages,
   blog mode (import, patch, publish), media (bytes refused, import from a public url), publishSite, listUrls and the 401 / 404
   error branches. `node tests/run.mjs duda` */
import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset } from './lib/mock.mjs';
const CMS = await load(['src/cms/13_duda.js']);
const D = CMS.get('duda');
assert(D && D.caps.media === false && D.caps.publishSite === true && D.caps.importFromUrl === true && D.caps.urls === true, 'registered with caps');
eq(D.base({ region: 'eu' }), 'https://api.eu.duda.co', 'eu host'); eq(D.base({ region: 'sandbox' }), 'https://api-sandbox.duda.co', 'sandbox host'); eq(D.base({}), 'https://api.duda.co', 'default host'); eq(D.base({ region: 'eu', apiBase: 'http://x/' }), 'http://x', 'apiBase override');
assert(D.hosts.includes('https://api.eu.duda.co/*') && D.hosts.includes('https://api-sandbox.duda.co/*'), 'hosts');
const USER = 'api-user', PASS = 's3cret'; const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const ctx = { log: () => { }, http: CMS.http, mediaHost: null };
const authed = (c, out) => c.headers.authorization === AUTH ? out : { status: 401, json: { error_code: 'UNAUTHORIZED', message: 'Bad credentials' } };
let PAGES = [{ uuid: 'u-tpl', title: 'Forge template', path: 'forge-template', seo: { title: '', description: '', no_index: false } }, { uuid: 'u-about', title: 'About', path: 'about', seo: {} }];
let POSTS = []; let published = 0; let seq = 0;
const S = await mock([
  { method: 'GET', path: '/api/sites/multiscreen/site1', handler: c => authed(c, { status: 200, json: { site_name: 'site1', site_default_domain: 'site1.multiscreensite.com', site_domain: 'www.example.com', publish_status: published ? 'PUBLISHED' : 'NOT_PUBLISHED_YET' } }) },
  { method: 'GET', path: '/api/sites/multiscreen/site1/pages', handler: c => authed(c, { status: 200, json: { results: PAGES } }) },
  { method: 'POST', path: /^\/api\/sites\/multiscreen\/site1\/pages\/[^/]+\/duplicate$/, handler: c => { const src = PAGES.find(p => p.uuid === c.path.split('/')[6]); if (!src) return { status: 404, json: { message: 'page not found' } }; const pg = { uuid: 'u-' + (++seq), title: c.json.title, path: src.path + '-copy', seo: {} }; PAGES.push(pg); return authed(c, { status: 200, json: pg }); } },
  { method: 'PUT', path: /^\/api\/sites\/multiscreen\/site1\/pages\/[^/]+$/, handler: c => { const pg = PAGES.find(p => p.uuid === c.path.split('/').pop()); if (!pg) return { status: 404, json: { message: 'page not found' } }; Object.assign(pg, c.json); return authed(c, { status: 204 }); } },
  { method: 'POST', path: /^\/api\/sites\/multiscreen\/inject-content\/site1\/pages\/[^/]+$/, handler: c => authed(c, { status: 204 }) },
  { method: 'POST', path: '/api/sites/multiscreen/publish/site1', handler: c => { published++; return authed(c, { status: 204 }); } },
  { method: 'GET', path: '/api/sites/multiscreen/site1/blog/posts', handler: c => authed(c, { status: 200, json: { results: POSTS } }) },
  { method: 'POST', path: '/api/sites/multiscreen/site1/blog/posts/import', handler: c => { const p = { id: 'post-' + (++seq), title: c.json.title, path: 'blog/' + c.json.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), status: 'UNPUBLISHED' }; POSTS.push(p); return authed(c, { status: 200, json: p }); } },
  { method: 'PATCH', path: /^\/api\/sites\/multiscreen\/site1\/blog\/posts\/[^/]+$/, handler: c => authed(c, { status: 204 }) },
  { method: 'POST', path: /^\/api\/sites\/multiscreen\/site1\/blog\/posts\/[^/]+\/publish$/, handler: c => authed(c, { status: 204 }) },
  { method: 'POST', path: '/api/sites/multiscreen/resources/site1/upload', handler: c => authed(c, { status: 200, json: { n_failures: 0, uploaded_resources: c.json.map(r => ({ original_url: r.src, new_url: 'https://irp.cdn-website.com/site1/' + r.src.split('/').pop(), status: 'UPLOADED' })) } }) },
]);
const cfg = { apiBase: S.url, apiUser: USER, apiPass: PASS, region: 'us', siteName: 'site1', mode: 'inject', contentKey: 'forge-content' };

/* test() */
const t1 = await D.test(cfg, ctx);
assert(t1.ok && t1.meta.domain === 'www.example.com' && t1.meta.customDomain === 'www.example.com' && t1.meta.publishStatus === 'NOT_PUBLISHED_YET' && t1.meta.pages === 2 && t1.meta.template === 'forge-template' && !t1.meta.warnings.length, 'test meta');
assert(/site1: www\.example\.com · NOT_PUBLISHED_YET · 2 pages/.test(t1.info) && /data-inject="forge-content" on \/forge-template/.test(t1.info) && /· us$/.test(t1.info), 'test info: ' + t1.info);
eq(S.find('GET', '/api/sites/multiscreen/site1').headers.authorization, AUTH, 'basic auth on the site call'); eq(S.find('GET', '/api/sites/multiscreen/site1/pages').headers.authorization, AUTH, 'pages listed with auth');
const t1b = await D.test(Object.assign({}, cfg, { templatePageUuid: 'nope' }), ctx); assert(t1b.meta.warnings.length === 1 && /No page with uuid nope/.test(t1b.info), 'missing template uuid warned');

/* inject: create (duplicate the template page, update it, inject) */
const u1 = await D.upsertPage(cfg, page(), { publish: false }, ctx);
const dup = S.find('POST', /\/duplicate$/); assert(dup && dup.path === '/api/sites/multiscreen/site1/pages/u-tpl/duplicate', 'template page duplicated'); eq(dup.json, { title: 'Divorce Lawyer in Plano, TX' }, 'duplicate body'); eq(dup.headers.authorization, AUTH, 'duplicate auth');
const put = S.find('PUT', '/api/sites/multiscreen/site1/pages/u-1'); assert(put && put.headers.authorization === AUTH, 'copy updated');
eq(put.json, { title: 'Divorce Lawyer in Plano, TX', path: 'divorce-lawyer', seo: { title: 'Divorce Lawyer in Plano, TX | Test Co', description: 'Divorce and custody counsel across Plano.', no_index: false } }, 'page update body');
const inj = S.find('POST', '/api/sites/multiscreen/inject-content/site1/pages/divorce-lawyer'); assert(inj && inj.headers.authorization === AUTH, 'inject by page path'); eq(inj.headers['content-type'], 'application/json', 'inject json');
assert(Array.isArray(inj.json) && inj.json.length === 1, 'one injection'); eq([inj.json[0].type, inj.json[0].key], ['INNERHTML', 'forge-content'], 'inject type and key');
assert(inj.json[0].value.startsWith('<style>') && inj.json[0].value.includes('<section id="hero"') && inj.json[0].value.includes('application/ld+json'), 'inject value carries the css, the sections and the JSON-LD');
assert(!S.find('POST', '/api/sites/multiscreen/publish/site1'), 'no publish on a draft');
eq([u1.id, u1.link, u1.status, u1.updated], ['u-1', 'https://www.example.com/divorce-lawyer', 'draft', false], 'create result'); assert(/after the next publish/.test(u1.notes) && /my\.duda\.co\/home\/site\/site1/.test(u1.edit), 'notes and editor link');

/* inject: the page exists → update, publish with publishAfter */
const u2 = await D.upsertPage(Object.assign({}, cfg, { publishAfter: true }), page({ noindex: true, seo: Object.assign({}, page().seo, { noindex: true }) }), { publish: true }, ctx);
eq(S.all('POST', /\/duplicate$/).length, 1, 'no second duplicate'); const put2 = S.all('PUT', '/api/sites/multiscreen/site1/pages/u-1')[1]; eq(put2.json.seo.no_index, true, 'noindex mapped'); eq(S.all('POST', '/api/sites/multiscreen/inject-content/site1/pages/divorce-lawyer').length, 2, 'injected again');
const pub = S.find('POST', '/api/sites/multiscreen/publish/site1'); assert(pub && pub.headers.authorization === AUTH, 'site published after the page'); eq([u2.id, u2.status, u2.updated], ['u-1', 'publish', true], 'update result'); assert(/republished/.test(u2.notes), 'republish note');
const u2b = await D.upsertPage(cfg, page(), { publish: true }, ctx); eq([u2b.status, S.all('POST', '/api/sites/multiscreen/publish/site1').length], ['draft', 1], 'publish without publishAfter stays staged');

/* explicit template uuid, then the first page as fallback */
await D.upsertPage(Object.assign({}, cfg, { templatePageUuid: 'u-about' }), page({ slug: 'plano' }), {}, ctx); assert(S.find('POST', '/api/sites/multiscreen/site1/pages/u-about/duplicate'), 'explicit template used');
PAGES = PAGES.filter(p => p.path !== 'forge-template');
const u4 = await D.upsertPage(cfg, page({ slug: 'frisco' }), {}, ctx); assert(S.all('POST', /\/duplicate$/).pop().path === '/api/sites/multiscreen/site1/pages/' + PAGES[0].uuid + '/duplicate' && u4.link.endsWith('/frisco'), 'falls back to the first page');
const saved = PAGES; PAGES = [];
let threw = null; try { await D.upsertPage(cfg, page({ slug: 'allen' }), {}, ctx); } catch (e) { threw = e; } assert(threw && /No page to duplicate/.test(threw.message) && /data-inject="forge-content"/.test(threw.hint), 'no pages at all: clear error'); PAGES = saved;

/* blog mode: import, then patch and publish */
const cfgB = Object.assign({}, cfg, { mode: 'blog', author: 'Dale' });
const tB = await D.test(cfgB, ctx); assert(tB.ok && tB.meta.posts === 0 && /blog posts \(0 listed\)/.test(tB.info) && !tB.meta.warnings.length, 'blog test probes the posts: ' + tB.info);
const NB = await mock([{ method: 'GET', path: '/api/sites/multiscreen/site1', reply: { site_name: 'site1', site_default_domain: 'site1.multiscreensite.com' } }, { method: 'GET', path: '/api/sites/multiscreen/site1/pages', reply: { results: [] } }, { method: 'GET', path: '/api/sites/multiscreen/site1/blog/posts', handler: () => ({ status: 404, json: { message: 'blog not found' } }) }]);
const tNB = await D.test(Object.assign({}, cfgB, { apiBase: NB.url }), ctx); assert(tNB.meta.posts === -1 && /add the Blog to the site/.test(tNB.info) && tNB.meta.domain === 'site1.multiscreensite.com', 'missing blog warned, default domain without a custom one: ' + tNB.info);
const b1 = await D.upsertPage(cfgB, page(), { publish: false }, ctx);
assert(S.find('GET', '/api/sites/multiscreen/site1/blog/posts'), 'posts listed'); const imp = S.find('POST', '/api/sites/multiscreen/site1/blog/posts/import'); assert(imp && imp.headers.authorization === AUTH && imp.headers['content-type'] === 'application/json', 'import posted');
eq([imp.json.title, imp.json.description, imp.json.author, imp.json.publish_date, imp.json.meta_title, imp.json.main_image, imp.json.thumbnail], ['Divorce Lawyer in Plano, TX', page().meta_description, 'Dale', '2026-09-26', 'Divorce Lawyer in Plano, TX | Test Co', 'https://cdn.example.com/hero.webp', 'https://cdn.example.com/hero.webp'], 'import fields');
assert(typeof imp.json.content === 'string' && imp.json.content.includes('<section id="hero"') && !imp.json.content.includes('<style>') && !imp.json.content.includes('application/ld+json'), 'content is the section html'); assert(!('no_index' in imp.json), 'no no_index when indexable');
eq([b1.id, b1.link, b1.status, b1.updated], [POSTS[0].id, 'https://www.example.com/blog/divorce-lawyer-in-plano-tx', 'draft', false], 'import result'); assert(/imported as a draft/.test(b1.notes), 'draft note');
const b2 = await D.upsertPage(cfgB, page(), { publish: true }, ctx);
const pt = S.find('PATCH', '/api/sites/multiscreen/site1/blog/posts/' + POSTS[0].id); assert(pt && pt.json.title === 'Divorce Lawyer in Plano, TX' && typeof pt.json.content === 'string', 'existing post patched'); assert(S.find('POST', `/api/sites/multiscreen/site1/blog/posts/${POSTS[0].id}/publish`), 'post published');
eq(S.all('POST', '/api/sites/multiscreen/site1/blog/posts/import').length, 1, 'no second import'); eq([b2.id, b2.status, b2.updated, b2.link], [POSTS[0].id, 'publish', true, 'https://www.example.com/blog/divorce-lawyer-in-plano-tx'], 'blog update result');

/* media: bytes are refused, public urls are imported */
threw = null; try { await D.uploadMedia(cfg, asset(), ctx); } catch (e) { threw = e; }
assert(threw && threw.message === 'Duda uploads from a public URL; choose a media host in module 16 (WordPress, Shopify, Webflow, Ghost, HubSpot host files)' && threw.adapter === 'duda' && /media host/.test(threw.hint), 'bytes refused with the media host message');
assert(!S.find('POST', '/api/sites/multiscreen/resources/site1/upload'), 'no upload call for bytes');
const m1 = await D.uploadMedia(cfg, Object.assign(asset(), { url: 'https://cdn.example.com/hero.webp' }), ctx);
const up = S.find('POST', '/api/sites/multiscreen/resources/site1/upload'); eq(up.json, [{ src: 'https://cdn.example.com/hero.webp', resource_type: 'IMAGE' }], 'upload body'); eq(up.headers.authorization, AUTH, 'upload auth');
eq([m1.url, m1.id, m1.reused, m1.width, m1.alt], ['https://irp.cdn-website.com/site1/hero.webp', 'https://irp.cdn-website.com/site1/hero.webp', false, 1600, 'Technician at a condenser'], 'import result');
const m2 = await D.importFromUrl(cfg, 'https://cdn.example.com/x.png', ctx); eq([m2.url, m2.original], ['https://irp.cdn-website.com/site1/x.png', 'https://cdn.example.com/x.png'], 'importFromUrl');
const F = await mock([{ method: 'POST', path: '/api/sites/multiscreen/resources/site1/upload', reply: { n_failures: 1, uploaded_resources: [{ original_url: 'https://cdn.example.com/bad.webp', status: 'FAILED' }] } }]);
threw = null; try { await D.importFromUrl(Object.assign({}, cfg, { apiBase: F.url }), 'https://cdn.example.com/bad.webp', ctx); } catch (e) { threw = e; } assert(threw && /could not import/.test(threw.message) && /1 failed/.test(threw.message), 'failed import reported');

/* publishSite and listUrls */
const ps = await D.publishSite(cfg, ctx); assert(ps.ok && ps.info === 'site1 published at https://www.example.com', 'publishSite: ' + ps.info); eq(S.all('POST', '/api/sites/multiscreen/publish/site1').length, 2, 'publish posted');
const urls = await D.listUrls(cfg, ctx); assert(urls.includes('https://www.example.com/about') && urls.includes('https://www.example.com/divorce-lawyer') && urls.includes('https://www.example.com/frisco'), 'urls from the pages: ' + urls.join(' '));

/* error branches */
threw = null; try { await D.test({ apiBase: S.url, apiUser: USER, apiPass: 'wrong', siteName: 'site1' }, ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 401 && /Bad credentials/.test(threw.message) && /API user and password/.test(threw.hint) && threw.adapter === 'duda', '401 surfaces the message and a hint: ' + (threw && threw.message));
threw = null; try { await D.test(Object.assign({}, cfg, { siteName: 'nope' }), ctx); } catch (e) { threw = e; } assert(threw && threw.status === 404 && /site name/.test(threw.hint), '404 hint');

await Promise.all([S, F, NB].map(s => s.close()));
console.log('duda ok');
