import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset, parseMultipart } from './lib/mock.mjs';
const CMS = await load(['src/cms/18_ghost.js']);
const A = CMS.get('ghost'); assert(A && A.id === 'ghost' && A.caps.schema === 'head', 'registered');
const ctx = { http: CMS.http, log: () => { } };
const ADM = '/ghost/api/admin';
const ID = '64f1a2b3c4d5e6f708192a3b', SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const b64u = s => Buffer.from(s, 'base64url').toString('utf8');
async function checkJwt(header) {
  assert(header && header.startsWith('Ghost '), 'Authorization: Ghost <jwt>'); const [h, p, s] = header.slice(6).split('.'); const hj = JSON.parse(b64u(h)), pj = JSON.parse(b64u(p));
  eq(hj, { alg: 'HS256', typ: 'JWT', kid: ID }, 'jwt header'); eq(pj.aud, '/admin/', 'aud'); eq(pj.exp - pj.iat, 300, 'five minutes'); assert(Math.abs(pj.iat - Date.now() / 1000) < 30, 'iat is now');
  const sig = CMS.b64url(await CMS.hmacSha256(CMS.fromHex(SECRET), h + '.' + p)); eq(s, sig, 'signature with the hex secret');
}
let exists = false; let fail422 = false; let version = '5.115.1';
const PAGE = (over) => Object.assign({ id: 'p-1', uuid: 'u', title: 'AC Repair in Mesquite, TX', slug: 'ac-repair', status: 'draft', url: srv.url + '/ac-repair/', updated_at: '2026-09-26T10:00:00.000Z' }, over || {});
const srv = await mock([
  { method: 'GET', path: ADM + '/site/', handler: () => ({ status: 200, json: { site: { title: 'Test Blog', description: 'x', logo: null, version, url: srv.url + '/' } } }) },
  { method: 'GET', path: ADM + '/users/me/', reply: { users: [{ id: '1', name: 'Owner One', email: 'owner@example.com', roles: [{ name: 'Owner' }] }] } },
  { method: 'GET', path: ADM + '/pages/slug/ac-repair/', handler: () => exists ? { status: 200, json: { pages: [PAGE()] } } : { status: 404, json: { errors: [{ message: 'Resource not found error, cannot read page.', type: 'NotFoundError' }] } } },
  { method: 'POST', path: ADM + '/pages/', handler: c => fail422 ? { status: 422, json: { errors: [{ message: 'Validation error, cannot save page.', context: 'Value in [pages.meta_title] exceeds maximum length of 300 characters.', type: 'ValidationError' }] } } : { status: 201, json: { pages: [PAGE({ status: c.json.pages[0].status })] } } },
  { method: 'PUT', path: ADM + '/pages/p-1/', handler: c => ({ status: 200, json: { pages: [PAGE({ status: c.json.pages[0].status })] } }) },
  { method: 'GET', path: ADM + '/posts/slug/ac-repair/', handler: () => ({ status: 404, json: { errors: [{ message: 'Resource not found error, cannot read post.', type: 'NotFoundError' }] } }) },
  { method: 'POST', path: ADM + '/posts/', handler: () => ({ status: 201, json: { posts: [PAGE({ id: 'po-1', url: srv.url + '/ac-repair/' })] } }) },
  { method: 'POST', path: ADM + '/images/upload/', reply: { images: [{ url: 'https://blog.example.com/content/images/2026/09/hero.webp', ref: 'hero.webp' }] } },
  { method: 'GET', path: ADM + '/pages/', handler: c => { const pg = parseInt(c.query.page || '1', 10); return { status: 200, json: { pages: pg === 1 ? [{ url: srv.url + '/a/', slug: 'a' }, { url: srv.url + '/b/', slug: 'b' }] : [{ url: srv.url + '/c/', slug: 'c' }], meta: { pagination: { page: pg, limit: 100, pages: 2, total: 3, next: pg === 1 ? 2 : null, prev: pg === 2 ? 1 : null } } } }; } },
  { method: 'GET', path: ADM + '/posts/', reply: { posts: [{ url: 'https://blog.example.com/post-1/', slug: 'post-1' }], meta: { pagination: { page: 1, limit: 100, pages: 1, total: 1, next: null, prev: null } } } },
]);
const cfg = { url: srv.url, apiBase: srv.url, adminKey: `${ID}:${SECRET}`, postType: 'page' };
/* test(): site (no auth) then users/me (auth, Accept-Version from the site version) */
const t = await A.test(cfg, ctx);
assert(t.ok && /Ghost 5\.115\.1 "Test Blog"/.test(t.info) && /Accept-Version v5\.0/.test(t.info) && /Owner One \(Owner\)/.test(t.info), 'test info: ' + t.info); eq(t.meta.accept, 'v5.0', 'accept meta');
const st = srv.find('GET', ADM + '/site/'); assert(st && !st.headers.authorization, 'site read without a token');
const me = srv.find('GET', ADM + '/users/me/'); await checkJwt(me.headers.authorization); eq(me.headers['accept-version'], 'v5.0', 'accept version'); eq(me.query.include, 'roles', 'roles included');
/* upsert: create draft page */
const p = page({ summary: 's'.repeat(320), featured_media_url: 'https://blog.example.com/content/images/2026/09/hero.webp' });
const r1 = await A.upsertPage(cfg, p, { publish: false }, ctx);
const look = srv.find('GET', ADM + '/pages/slug/ac-repair/'); assert(look, 'slug lookup'); await checkJwt(look.headers.authorization);
const cr = srv.find('POST', ADM + '/pages/'); assert(cr, 'POST page'); eq(cr.query.source, 'html', 'source=html'); eq(cr.headers['content-type'], 'application/json', 'json body'); eq(cr.headers['accept-version'], 'v5.0', 'accept version on write');
const d = cr.json.pages[0]; eq(d.title, 'AC Repair in Mesquite, TX', 'title is h1'); eq(d.slug, 'ac-repair', 'slug'); eq(d.status, 'draft', 'draft'); eq(d.visibility, 'public', 'visibility');
assert(d.html.startsWith('<!--kg-card-begin: html-->\n<style>') && d.html.trim().endsWith('<!--kg-card-end: html-->') && d.html.includes('<h1>AC Repair in Mesquite, TX</h1>') && !d.html.includes('ld+json'), 'html card with css, markup, no schema in body');
assert(d.codeinjection_head.startsWith('<script type="application/ld+json">') && !d.codeinjection_head.includes('robots'), 'JSON-LD in the head, no robots when indexable');
eq(d.meta_title, 'AC Repair in Mesquite, TX | Test Co', 'meta title'); eq(d.meta_description, 'Same day AC repair across Mesquite.', 'meta description'); eq(d.canonical_url, 'https://www.example.com/ac-repair/', 'canonical'); eq(d.custom_excerpt.length, 300, 'excerpt cut to 300');
eq(d.feature_image, 'https://blog.example.com/content/images/2026/09/hero.webp', 'feature image'); eq(d.feature_image_alt, 'Technician at a condenser', 'feature alt'); eq(d.og_image, 'https://cdn.example.com/hero.webp', 'og image'); assert(d.updated_at === undefined, 'no updated_at on create');
eq(r1.id, 'p-1', 'id'); eq(r1.link, srv.url + '/ac-repair/', 'link from response'); eq(r1.edit, srv.url + '/ghost/#/editor/page/p-1', 'edit'); eq(r1.status, 'draft', 'status'); eq(r1.updated, false, 'created'); assert(/300/.test(r1.notes), 'excerpt note');
/* upsert: exists → PUT with updated_at, publish, noindex */
exists = true;
const r2 = await A.upsertPage(cfg, page({ noindex: true, seo: Object.assign({}, page().seo, { noindex: true }) }), { publish: true }, ctx);
const up = srv.find('PUT', ADM + '/pages/p-1/'); assert(up, 'PUT sent'); eq(up.query.source, 'html', 'source=html on update'); eq(up.json.pages[0].updated_at, '2026-09-26T10:00:00.000Z', 'updated_at from the existing record'); eq(up.json.pages[0].status, 'published', 'published');
assert(up.json.pages[0].codeinjection_head.includes('<meta name="robots" content="noindex,follow">') && up.json.pages[0].codeinjection_head.includes('ld+json'), 'robots and JSON-LD in the head');
eq(r2.updated, true, 'updated'); eq(r2.status, 'publish', 'publish status'); assert(srv.all('POST', ADM + '/pages/').length === 1, 'no second POST');
/* posts when the page says so and postType is auto */
const r3 = await A.upsertPage(Object.assign({}, cfg, { postType: 'auto' }), page({ post_type: 'post' }), {}, ctx); assert(srv.find('GET', ADM + '/posts/slug/ac-repair/') && srv.find('POST', ADM + '/posts/'), 'posts branch'); eq(r3.edit, srv.url + '/ghost/#/editor/post/po-1', 'post edit link');
/* Ghost validates title at 255 characters */
await A.upsertPage(cfg, page({ h1: 'T'.repeat(400) }), {}, ctx); eq(srv.all('PUT', ADM + '/pages/p-1/').pop().json.pages[0].title.length, 255, 'title cut to 255');
/* uploadMedia: multipart file, purpose, ref */
const m = await A.uploadMedia(cfg, asset(), ctx);
const upl = srv.find('POST', ADM + '/images/upload/'); assert(upl && /^multipart\/form-data; boundary=/.test(upl.headers['content-type']), 'multipart'); await checkJwt(upl.headers.authorization);
const parts = parseMultipart(upl); const f = parts.find(x => x.name === 'file'); assert(f && f.filename === 'hero.webp' && f.type === 'image/webp' && f.data.length === 16, 'file part'); eq(parts.find(x => x.name === 'purpose').data.toString(), 'image', 'purpose'); eq(parts.find(x => x.name === 'ref').data.toString(), 'hero.webp', 'ref');
eq(m, { id: 'https://blog.example.com/content/images/2026/09/hero.webp', url: 'https://blog.example.com/content/images/2026/09/hero.webp', width: 1600, height: 1000, mime: 'image/webp', reused: false }, 'upload result');
/* listUrls: pages paginate at 100, then posts */
const urls = await A.listUrls(cfg, ctx); eq(urls, [srv.url + '/a/', srv.url + '/b/', srv.url + '/c/', 'https://blog.example.com/post-1/'], 'urls');
const lp = srv.all('GET', ADM + '/pages/'); eq(lp.map(c => c.query.page), ['1', '2'], 'page numbers'); eq(lp[0].query.limit, '100', 'limit 100'); eq(lp[0].query.filter, 'status:published', 'published only'); eq(lp[0].query.fields, 'url,slug', 'fields');
/* Ghost 6 → Accept-Version v6.0; explicit override wins */
version = '6.2.0'; const srv2 = await mock([{ method: 'GET', path: ADM + '/site/', reply: { site: { title: 'Six', version: '6.2.0', url: 'https://six.example.com/' } } }, { method: 'GET', path: ADM + '/users/me/', reply: { users: [{ name: 'Six', roles: [] }] } }]);
const t6 = await A.test({ url: srv2.url, apiBase: srv2.url, adminKey: cfg.adminKey }, ctx); assert(/Accept-Version v6\.0/.test(t6.info), 'v6 info: ' + t6.info); eq(srv2.find('GET', ADM + '/users/me/').headers['accept-version'], 'v6.0', 'v6 header');
await A.test({ url: srv2.url, apiBase: srv2.url, adminKey: cfg.adminKey, acceptVersion: 'v6.1' }, ctx); eq(srv2.all('GET', ADM + '/users/me/')[1].headers['accept-version'], 'v6.1', 'override');
await srv2.close();
/* errors: 422 with context, bad key */
exists = false; fail422 = true; let e = null; try { await A.upsertPage(cfg, page(), {}, ctx); } catch (x) { e = x; } assert(e && e.status === 422 && /cannot save page/.test(e.message) && /meta_title/.test(e.hint), '422 surfaces context: ' + (e && e.hint));
e = null; try { await A.test(Object.assign({}, cfg, { adminKey: 'not-a-key' }), ctx); } catch (x) { e = x; } assert(e && e.status === 0 && /id:secret/.test(e.message), 'bad key: ' + (e && e.message));
await srv.close();
console.log('ghost ok');
