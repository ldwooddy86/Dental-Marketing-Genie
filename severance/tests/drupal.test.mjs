import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset } from './lib/mock.mjs';
const CMS = await load(['src/cms/11_drupal.js']);
const A = CMS.get('drupal'); assert(A && A.id === 'drupal' && A.caps.schema === 'inline', 'registered');
const ctx = { http: CMS.http, log: () => { } };
const NODE = (over) => Object.assign({ type: 'node--page', id: 'n-uuid-1', attributes: { title: 'Divorce Lawyer in Plano, TX', status: false, drupal_internal__nid: 12, path: { alias: '/divorce-lawyer', pid: 3, langcode: 'en' } } }, over || {});
let exists = false; let loginStatus = '1'; let fail422 = false; let titleAlias = '/divorce-lawyer';
const srv = await mock([
  { method: 'GET', path: '/jsonapi', handler: () => ({ status: 200, headers: { 'X-Generator': 'Drupal 11 (https://www.drupal.org)' }, json: { jsonapi: { version: '1.0', meta: { links: { self: { href: 'http://jsonapi.org/format/1.0/' } } } }, data: [], links: { self: { href: srv.url + '/jsonapi' }, 'node--page': { href: srv.url + '/jsonapi/node/page' }, 'node--article': { href: srv.url + '/jsonapi/node/article' }, 'media--image': { href: srv.url + '/jsonapi/media/image' }, 'user--user': { href: srv.url + '/jsonapi/user/user' } } } }) },
  { method: 'GET', path: '/user/login_status', handler: () => ({ status: 200, text: loginStatus, headers: { 'Content-Type': 'application/json' } }) },
  { method: 'GET', path: '/oauth/debug', handler: () => ({ status: 200, json: { token: 'x', id: 5, roles: ['editor', 'authenticated'], permissions: {} } }) },
  { method: 'GET', path: '/jsonapi/user/user', handler: c => ({ status: 200, json: { data: c.query['filter[name]'] === 'admin' ? [{ type: 'user--user', id: 'u-1', attributes: { name: 'admin', drupal_internal__uid: 1 } }] : [], meta: c.query['filter[name]'] === 'admin' ? {} : { omitted: { detail: 'Some resources have been omitted because of insufficient authorization.' } } } }) },
  { method: 'GET', path: '/jsonapi/node/page', handler: c => {
    if (c.query['filter[title][value]'] != null) return { status: 200, json: { data: exists ? [NODE({ attributes: Object.assign({}, NODE().attributes, { path: { alias: titleAlias } }) })] : [] } };
    if (c.query['filter[field_forge_slug]'] != null) return { status: 200, json: { data: c.query['filter[field_forge_slug]'] === 'divorce-lawyer' && exists ? [NODE()] : [] } };
    if (c.query['filter[status]'] === '1') { const pg = c.query['page[offset]'] ? 2 : 1; return { status: 200, json: { data: pg === 1 ? [NODE({ id: 'a', attributes: { title: 'A', path: { alias: '/a' }, drupal_internal__nid: 1 } }), NODE({ id: 'b', attributes: { title: 'B', path: { alias: '' }, drupal_internal__nid: 2 } })] : [NODE({ id: 'c', attributes: { title: 'C', path: { alias: '/c' }, drupal_internal__nid: 3 } })], links: pg === 1 ? { next: { href: srv.url + '/jsonapi/node/page?filter[status]=1&page[limit]=50&page[offset]=50' } } : {} } }; }
    return { status: 200, json: { data: [NODE()] } }; } },
  { method: 'POST', path: '/jsonapi/node/page', handler: c => fail422 ? { status: 422, json: { jsonapi: { version: '1.0' }, errors: [{ title: 'Unprocessable Entity', status: '422', detail: 'body.0.format: The value you selected is not a valid choice.', source: { pointer: '/data/attributes/body/format' } }] } } : { status: 201, json: { data: NODE({ attributes: Object.assign({}, NODE().attributes, { status: c.json.data.attributes.status, path: { alias: c.json.data.attributes.path.alias } }) }) } } },
  { method: 'PATCH', path: '/jsonapi/node/page/n-uuid-1', handler: c => ({ status: 200, json: { data: NODE({ attributes: Object.assign({}, NODE().attributes, { status: c.json.data.attributes.status }) }) } }) },
  { method: 'GET', path: '/jsonapi/media/image', handler: c => ({ status: 200, json: c.query['filter[name][value]'] === 'reuse-me' ? { data: [{ type: 'media--image', id: 'a1b2c3d4-0000-4000-8000-000000000004', attributes: { name: 'reuse-me.webp' }, relationships: { field_media_image: { data: { type: 'file--file', id: 'a1b2c3d4-0000-4000-8000-000000000005', meta: { alt: 'old alt', width: 800, height: 600 } } } } }], included: [{ type: 'file--file', id: 'a1b2c3d4-0000-4000-8000-000000000005', attributes: { uri: { url: '/sites/default/files/reuse-me.webp' }, filename: 'reuse-me.webp', filemime: 'image/webp' } }] } : { data: [] } }) },
  { method: 'POST', path: '/jsonapi/media/image/field_media_image', handler: () => ({ status: 201, json: { data: { type: 'file--file', id: 'a1b2c3d4-0000-4000-8000-000000000002', attributes: { filename: 'hero.webp', uri: { value: 'public://hero.webp', url: '/sites/default/files/hero.webp' }, filemime: 'image/webp', status: false } } } }) },
  { method: 'POST', path: '/jsonapi/media/image', handler: () => ({ status: 201, json: { data: { type: 'media--image', id: 'a1b2c3d4-0000-4000-8000-000000000001', attributes: { name: 'hero.webp' } } } }) },
  { method: 'POST', path: '/jsonapi/node/page/field_image', handler: () => ({ status: 201, json: { data: { type: 'file--file', id: 'a1b2c3d4-0000-4000-8000-000000000003', attributes: { filename: 'hero.webp', uri: { url: '/sites/default/files/hero.webp' }, filemime: 'image/webp' } } } }) },
]);
const cfg = { url: srv.url, apiBase: srv.url, authMode: 'basic', user: 'admin', pass: 'pw', bundle: 'page', textFormat: 'full_html', metatagField: 'field_metatags', imageField: 'field_image', mediaBundle: 'image', mediaField: 'field_media_image', pathauto: 'no' };
const AUTH = 'Basic ' + Buffer.from('admin:pw').toString('base64');
/* test(): index, login status, user, one node */
const t = await A.test(cfg, ctx);
assert(t.ok && /Drupal 11/.test(t.info) && /JSON:API 1\.0/.test(t.info) && /user admin \(uid 1\)/.test(t.info), 'test info: ' + t.info);
eq(t.meta.bundle, 'page', 'meta bundle'); eq(t.meta.types, ['page', 'article'], 'meta types');
const idx = srv.find('GET', '/jsonapi'); assert(idx.headers.accept === 'application/vnd.api+json' && idx.headers.authorization === AUTH, 'index headers');
const ls = srv.find('GET', '/user/login_status'); assert(ls && ls.query._format === 'json' && ls.headers.authorization === AUTH, 'login status probed with auth');
const usr = srv.find('GET', '/jsonapi/user/user'); eq(usr.query['filter[name]'], 'admin', 'user filter'); assert(/fields\[user--user\]=name,drupal_internal__uid/.test(usr.url), 'user sparse fieldset');
const one = srv.all('GET', '/jsonapi/node/page').find(c => c.query['page[limit]'] === '1'); assert(one, 'one node probe');
/* upsert: create as draft */
const p = page({ featured_media_id: 'a1b2c3d4-0000-4000-8000-000000000001' });
const r1 = await A.upsertPage(cfg, p, { publish: false }, ctx);
const look = srv.all('GET', '/jsonapi/node/page').find(c => c.query['filter[title][value]'] != null); eq(look.query['filter[title][value]'], 'Divorce Lawyer in Plano, TX', 'lookup by title'); assert(/fields\[node--page\]=title,path,status,drupal_internal__nid/.test(look.url), 'lookup fieldset');
const cr = srv.find('POST', '/jsonapi/node/page'); assert(cr.headers['content-type'] === 'application/vnd.api+json' && cr.headers.accept === 'application/vnd.api+json' && cr.headers.authorization === AUTH, 'create headers');
const d = cr.json.data; eq(d.type, 'node--page', 'type'); eq(d.attributes.title, 'Divorce Lawyer in Plano, TX', 'title is h1'); eq(d.attributes.status, false, 'draft'); eq(d.attributes.langcode, 'en', 'langcode'); eq(d.attributes.promote, false, 'promote');
eq(d.attributes.body.format, 'full_html', 'format'); assert(d.attributes.body.value.startsWith('<style>') && d.attributes.body.value.includes('application/ld+json') && d.attributes.body.value.includes('<h1>Divorce Lawyer in Plano, TX</h1>'), 'body carries css, markup and JSON-LD');
eq(d.attributes.path, { alias: '/divorce-lawyer' }, 'alias without pathauto'); eq(d.attributes.field_metatags, { value: { title: 'Divorce Lawyer in Plano, TX | Test Co', description: 'Divorce and custody counsel across Plano.', canonical_url: 'https://www.example.com/divorce-lawyer/', og_image: 'https://cdn.example.com/hero.webp' } }, 'metatag field');
eq(d.relationships.field_image.data, { type: 'media--image', id: 'a1b2c3d4-0000-4000-8000-000000000001' }, 'media reference'); assert(d.id === undefined, 'no id on POST');
eq(r1.id, 'n-uuid-1', 'id'); eq(r1.nid, 12, 'nid'); eq(r1.link, srv.url + '/divorce-lawyer', 'link'); eq(r1.edit, srv.url + '/node/12/edit', 'edit'); eq(r1.status, 'draft', 'status'); eq(r1.updated, false, 'created');
/* upsert: exists → PATCH, publish, noindex, pathauto yes, file only mode */
exists = true; const cfg2 = Object.assign({}, cfg, { pathauto: 'yes', mediaBundle: 'none', slugField: 'field_forge_slug' });
const r2 = await A.upsertPage(cfg2, page({ noindex: true, seo: Object.assign({}, page().seo, { noindex: true }), featured_media_id: 'a1b2c3d4-0000-4000-8000-000000000003', language: 'en-GB' }), { publish: true }, ctx);
const sl = srv.all('GET', '/jsonapi/node/page').find(c => c.query['filter[field_forge_slug]'] != null); eq(sl.query['filter[field_forge_slug]'], 'divorce-lawyer', 'slug field lookup');
const up = srv.find('PATCH', /\/jsonapi\/node\/page\/n-uuid-1$/); assert(up, 'PATCH sent'); eq(up.json.data.id, 'n-uuid-1', 'PATCH repeats the id'); eq(up.json.data.attributes.status, true, 'published'); eq(up.json.data.attributes.path, { alias: '/divorce-lawyer', pathauto: 0 }, 'pathauto 0');
eq(up.json.data.attributes.field_metatags.value.robots, 'noindex, follow', 'robots'); eq(up.json.data.attributes.field_forge_slug, 'divorce-lawyer', 'slug field written'); eq(up.json.data.relationships.field_image.data, { type: 'file--file', id: 'a1b2c3d4-0000-4000-8000-000000000003', meta: { alt: 'Technician at a condenser' } }, 'file reference with alt');
eq(r2.updated, true, 'updated'); eq(r2.status, 'publish', 'publish status');
/* the same H1 with another alias is another page: no PATCH, a fresh POST; a Pathauto prefixed alias still counts as ours */
exists = true; titleAlias = '/plano/divorce-lawyer-frisco'; const nPatch = srv.all('PATCH', /n-uuid-1$/).length; const nPost = srv.all('POST', '/jsonapi/node/page').length;
const r2b = await A.upsertPage(cfg, page(), {}, ctx); eq(r2b.updated, false, 'different alias is not updated'); eq(srv.all('PATCH', /n-uuid-1$/).length, nPatch, 'no PATCH on a different alias'); eq(srv.all('POST', '/jsonapi/node/page').length, nPost + 1, 'created instead');
titleAlias = '/services/divorce-lawyer'; const r2c = await A.upsertPage(cfg, page(), {}, ctx); eq(r2c.updated, true, 'prefixed alias matched'); titleAlias = '/divorce-lawyer';
/* an id from another media host (a WordPress number) must not become a Drupal relationship */
exists = false; const r3 = await A.upsertPage(cfg, page({ featured_media_id: 77 }), {}, ctx); const cr3 = srv.all('POST', '/jsonapi/node/page').pop(); assert(cr3.json.data.relationships === undefined && /not a Drupal upload/.test(r3.notes) && cr3.json.data.attributes.body.summary === undefined, 'foreign media id skipped, no body summary');
/* uploadMedia: file endpoint then media entity */
const m1 = await A.uploadMedia(cfg, asset(), ctx);
const fu = srv.find('POST', '/jsonapi/media/image/field_media_image'); assert(fu, 'file upload'); eq(fu.headers['content-type'], 'application/octet-stream', 'octet stream'); eq(fu.headers['content-disposition'], 'file; filename="hero.webp"', 'disposition'); eq(fu.headers.accept, 'application/vnd.api+json', 'upload accept'); eq(fu.body.length, 16, 'raw bytes'); eq(fu.body[0], 0x52, 'bytes as is');
const me = srv.find('POST', '/jsonapi/media/image'); assert(me, 'media entity'); eq(me.json.data.type, 'media--image', 'media type'); eq(me.json.data.attributes.name, 'hero.webp', 'media name'); eq(me.json.data.relationships.field_media_image.data, { type: 'file--file', id: 'a1b2c3d4-0000-4000-8000-000000000002', meta: { alt: 'Technician at a condenser', title: 'Technician at a condenser', width: 1600, height: 1000 } }, 'media relationship');
eq(m1, { id: 'a1b2c3d4-0000-4000-8000-000000000001', fileId: 'a1b2c3d4-0000-4000-8000-000000000002', url: srv.url + '/sites/default/files/hero.webp', width: 1600, height: 1000, mime: 'image/webp', reused: false }, 'upload result');
const m2 = await A.uploadMedia(cfg, Object.assign(asset(), { file: 'reuse-me.webp' }), ctx); assert(m2.reused && m2.id === 'a1b2c3d4-0000-4000-8000-000000000004' && m2.url === srv.url + '/sites/default/files/reuse-me.webp', 'reused media by name');
await A.uploadMedia(cfg, Object.assign(asset(), { file: 'héro "1"/x.webp' }), ctx); eq(srv.all('POST', '/jsonapi/media/image/field_media_image').pop().headers['content-disposition'], 'file; filename="hro 1x.webp"', 'header safe file name');
const m3 = await A.uploadMedia(cfg2, asset(), ctx); assert(srv.find('POST', '/jsonapi/node/page/field_image'), 'file only mode uploads into the node field'); eq(m3.id, 'a1b2c3d4-0000-4000-8000-000000000003', 'file id'); assert(/temporary/.test(m3.note), 'temporary note');
/* listUrls follows links.next */
const urls = await A.listUrls(cfg, ctx); eq(urls, [srv.url + '/a', srv.url + '/node/2', srv.url + '/c'], 'urls'); assert(srv.all('GET', '/jsonapi/node/page').filter(c => c.query['filter[status]'] === '1').length === 2, 'two pages fetched');
/* bearer mode */
const t2 = await A.test(Object.assign({}, cfg, { authMode: 'bearer', token: 'Bearer abc.def' }), ctx); assert(/token user uid 5 \(editor, authenticated\)/.test(t2.info), 'bearer info: ' + t2.info); assert(srv.find('GET', '/oauth/debug').headers.authorization === 'Bearer abc.def', 'bearer header');
/* errors: anonymous fallback, 422 with detail */
loginStatus = '0'; let e = null; try { await A.test(cfg, ctx); } catch (x) { e = x; } assert(e && e.status === 401 && /anonymous/.test(e.message) && /Basic Authentication/.test(e.hint), 'anonymous detected: ' + (e && e.message)); loginStatus = '1';
exists = false; fail422 = true; e = null; try { await A.upsertPage(cfg, page(), {}, ctx); } catch (x) { e = x; } assert(e && e.status === 422 && /not a valid choice/.test(e.message) && /body\/format/.test(e.hint), '422 surfaces detail: ' + (e && e.hint));
e = null; try { await A.test(Object.assign({}, cfg, { bundle: 'landing' }), ctx); } catch (x) { e = x; } assert(e && e.status === 404 && /landing/.test(e.message) && /page, article/.test(e.message), 'unknown bundle: ' + (e && e.message));
fail422 = false; const rp = await A.upsertPage(cfg, page({ post_type: 'post' }), {}, ctx); assert(/post type "post" went into the page bundle/.test(rp.notes), 'post type note: ' + rp.notes);
await srv.close();
console.log('drupal ok');
