import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset } from './lib/mock.mjs';
const CMS = await load(['src/cms/17_joomla.js']);
const A = CMS.get('joomla'); assert(A && A.id === 'joomla' && A.caps.schema === 'inline', 'registered');
const ctx = { http: CMS.http, log: () => { } };
const V1 = '/api/index.php/v1';
const ART = (id, over) => ({ type: 'articles', id: String(id), attributes: Object.assign({ id, title: 'AC Repair in Mesquite, TX', alias: 'ac-repair', catid: 2, state: 0, language: '*', access: 1 }, over || {}) });
let exists = false; let folderExists = false; let dupAlias = false;
const srv = await mock([
  { method: 'GET', path: V1 + '/content/categories', reply: { links: { self: 'x' }, data: [{ type: 'categories', id: '2', attributes: { id: 2, title: 'Uncategorised' } }, { type: 'categories', id: '8', attributes: { id: 8, title: 'Services' } }], meta: { 'total-pages': 1 } } },
  { method: 'GET', path: '/administrator/manifests/files/joomla.xml', handler: () => ({ status: 200, text: '<?xml version="1.0" encoding="UTF-8"?><extension type="file" method="upgrade"><name>files_joomla</name><version>5.3.2</version></extension>', headers: { 'Content-Type': 'application/xml' } }) },
  { method: 'GET', path: V1 + '/content/articles', handler: c => {
    if (c.query['filter[search]'] != null) return { status: 200, json: { data: exists ? [ART(42), ART(43, { alias: 'ac-repair-2' })] : [] } };
    if (c.query['filter[state]'] === '1') { const off = parseInt(c.query['page[offset]'] || '0', 10); const rows = off === 0 ? Array.from({ length: 100 }, (_, i) => ART(i + 1)) : Array.from({ length: 5 }, (_, i) => ART(101 + i, { catid: 8 })); return { status: 200, json: { data: rows, links: off === 0 ? { next: srv.url + V1 + '/content/articles?filter[state]=1&page[limit]=100&page[offset]=100' } : {} } }; }
    return { status: 200, json: { data: [] } }; } },
  { method: 'POST', path: V1 + '/content/articles', handler: c => dupAlias ? { status: 400, json: { errors: [{ title: 'Save failed with the following error: Another Article from this category has the same alias (remember it may be a trashed item).', code: 400 }] } } : { status: 200, json: { links: { self: srv.url + V1 + '/content/articles/42' }, data: ART(42, { title: c.json.title, alias: c.json.alias, catid: c.json.catid, state: c.json.state }) } } },
  { method: 'PATCH', path: V1 + '/content/articles/42', handler: c => ({ status: 200, json: { data: ART(42, { state: c.json.state, alias: c.json.alias }) } }) },
  /* v1/media/files/:path without the slash is displayItem (one object), with it displayList (the folder's files) */
  { method: 'GET', path: V1 + '/media/files/forge', handler: () => ({ status: 200, json: { data: { type: 'media', id: 'local-images:/forge', attributes: { type: 'dir', name: 'forge', path: 'local-images:/forge' } } } }) },
  { method: 'GET', path: V1 + '/media/files/forge/', handler: () => folderExists ? { status: 200, json: { data: [{ type: 'media', id: 'local-images:/forge/old.webp', attributes: { type: 'file', name: 'old.webp', path: 'local-images:/forge/old.webp', extension: 'webp', mime_type: 'image/webp', width: 640, height: 480, url: srv.url + '/images/forge/old.webp' } }] } } : { status: 404, json: { errors: [{ title: 'File not found', code: 404 }] } } },
  { method: 'POST', path: V1 + '/media/files', handler: c => c.json.content ? { status: 200, json: { data: { type: 'media', id: 'local-images:/forge/hero.webp', attributes: { type: 'file', name: 'hero.webp', path: 'local-images:/forge/hero.webp', extension: 'webp', size: 16, mime_type: 'image/webp', width: 1600, height: 1000, url: srv.url + '/images/forge/hero.webp', adapter: 'local-images' } } } } : { status: 200, json: { data: { type: 'media', id: 'local-images:/forge', attributes: { type: 'dir', name: 'forge', path: 'local-images:/forge' } } } } },
]);
const cfg = { url: srv.url, apiBase: srv.url, token: 'Bearer c2hh256OjE6YWJj', categoryId: '2', language: '*', access: '1', folder: 'forge' };
const TOK = 'c2hh256OjE6YWJj';
/* test(): categories and the version from the core manifest */
const t = await A.test(cfg, ctx);
assert(t.ok && /Joomla 5\.3\.2/.test(t.info) && /Uncategorised \(2\), Services \(8\)/.test(t.info), 'test info: ' + t.info); eq(t.meta.categoryId, 2, 'category id'); eq(t.meta.categoryListed, true, 'category listed');
const cat = srv.find('GET', V1 + '/content/categories'); eq(cat.query['page[limit]'], '5', 'category limit'); eq(cat.headers['x-joomla-token'], TOK, 'X-Joomla-Token without the Bearer prefix'); eq(cat.headers.authorization, 'Bearer ' + TOK, 'Bearer too'); eq(cat.headers.accept, 'application/vnd.api+json', 'accept');
assert(srv.find('GET', '/administrator/manifests/files/joomla.xml'), 'manifest read');
/* upsert: create draft */
const r1 = await A.upsertPage(cfg, page({ canonical: '', seo: Object.assign({}, page().seo, { canonical: '' }) }), { publish: false }, ctx);
const look = srv.find('GET', V1 + '/content/articles'); eq(look.query['filter[search]'], 'ac-repair', 'search by alias'); eq(look.query['filter[category]'], '2', 'within the category'); eq(look.query['page[limit]'], '50', 'search limit');
const cr = srv.find('POST', V1 + '/content/articles'); assert(cr, 'POST article'); eq(cr.headers['content-type'], 'application/json', 'json body'); eq(cr.headers['x-joomla-token'], TOK, 'token on write');
const b = cr.json; eq(b.title, 'AC Repair in Mesquite, TX', 'title is h1'); eq(b.alias, 'ac-repair', 'alias'); eq(b.catid, 2, 'catid'); eq(b.language, '*', 'language'); eq(b.state, 0, 'unpublished'); eq(b.access, 1, 'access'); eq(b.featured, 0, 'featured'); eq(b.metakey, '', 'metakey'); eq(b.metadesc, 'Same day AC repair across Mesquite.', 'metadesc');
assert(b.articletext.startsWith('<style>') && b.articletext.includes('application/ld+json') && b.articletext.includes('<h1>AC Repair in Mesquite, TX</h1>'), 'articletext carries css, markup and JSON-LD'); assert(b.metadata === undefined && b.images === undefined, 'no metadata when indexable, no images field');
eq(r1.id, '42', 'id'); eq(r1.link, srv.url + '/index.php?option=com_content&view=article&id=42&catid=2', 'link'); eq(r1.edit, srv.url + '/administrator/index.php?option=com_content&task=article.edit&id=42', 'edit'); eq(r1.status, 'draft', 'status'); eq(r1.updated, false, 'created'); assert(/non SEF/.test(r1.notes), 'sef note');
/* upsert: exists (matched on alias among search hits) → PATCH, publish, noindex, long meta description */
exists = true; const long = 'x'.repeat(200);
const r2 = await A.upsertPage(cfg, page({ noindex: true, meta_description: long, seo: Object.assign({}, page().seo, { noindex: true, description: long }) }), { publish: true }, ctx);
const up = srv.find('PATCH', V1 + '/content/articles/42'); assert(up, 'PATCH sent'); eq(up.json.state, 1, 'published'); eq(up.json.metadata, { robots: 'noindex, follow', author: '', rights: '' }, 'robots'); eq(up.json.metadesc.length, 160, 'metadesc cut'); eq(up.json.alias, 'ac-repair', 'alias kept');
eq(r2.updated, true, 'updated'); eq(r2.status, 'publish', 'publish status'); assert(/160/.test(r2.notes) && /canonical/.test(r2.notes), 'notes: ' + r2.notes);
/* uploadMedia: missing folder → create it, then upload base64 */
const m1 = await A.uploadMedia(cfg, asset(), ctx);
const ls = srv.find('GET', V1 + '/media/files/forge/'); assert(ls && ls.query.url === 'true', 'folder listing (trailing slash) asks for urls'); assert(!srv.find('GET', V1 + '/media/files/forge'), 'the single item route is not used');
const posts = srv.all('POST', V1 + '/media/files'); eq(posts.length, 2, 'folder create then file'); eq(posts[0].json, { path: 'local-images:/forge' }, 'folder body'); eq(posts[1].json.path, 'local-images:/forge/hero.webp', 'file path'); eq(posts[1].json.content, Buffer.from([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c]).toString('base64'), 'base64 content'); eq(posts[1].query.url, 'true', 'url asked'); eq(posts[1].headers['x-joomla-token'], TOK, 'token on upload');
eq(m1, { id: 'local-images:/forge/hero.webp', url: srv.url + '/images/forge/hero.webp', width: 1600, height: 1000, mime: 'image/webp', reused: false }, 'upload result');
folderExists = true; const m2 = await A.uploadMedia(cfg, Object.assign(asset(), { file: 'old.webp' }), ctx); assert(m2.reused && m2.url === srv.url + '/images/forge/old.webp' && m2.width === 640, 'reused file from the folder listing'); eq(srv.all('POST', V1 + '/media/files').length, 2, 'no upload when reused');
/* listUrls paginates by offset */
const urls = await A.listUrls(cfg, ctx); eq(urls.length, 105, 'all articles'); eq(urls[0], srv.url + '/index.php?option=com_content&view=article&id=1&catid=2', 'first url'); eq(urls[104], srv.url + '/index.php?option=com_content&view=article&id=105&catid=8', 'last url');
const pages = srv.all('GET', V1 + '/content/articles').filter(c => c.query['filter[state]'] === '1'); eq(pages.map(c => c.query['page[offset]']), ['0', '100'], 'offsets'); eq(pages[0].query['page[limit]'], '100', 'limit');
/* errors: duplicate alias 400, missing token */
exists = false; dupAlias = true; let e = null; try { await A.upsertPage(cfg, page(), {}, ctx); } catch (x) { e = x; } assert(e && e.status === 400 && /same alias/.test(e.message) && /duplicate alias/.test(e.hint), '400 surfaces the save error: ' + (e && e.message));
e = null; try { await A.test(Object.assign({}, cfg, { token: '' }), ctx); } catch (x) { e = x; } assert(e && e.status === 0 && /API token/.test(e.message), 'missing token');
await srv.close();
console.log('joomla ok');
