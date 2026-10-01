/* Wix adapter end to end against a mock Wix API: cms mode (site properties, collection probe, slug lookup, insert, update with
   schema, image and status fields, custom field ids), blog mode (posts probe, draft post with Ricos content and SEO tags, update
   plus publish, create with publish), media upload (generate url then PUT) and the 403 / 401 error branches. `node tests/run.mjs wix` */
import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset } from './lib/mock.mjs';
const CMS = await load(['src/cms/12_wix.js']);
const W = CMS.get('wix');
assert(W && W.caps.media === true && W.caps.publishSite === false && W.caps.schema === 'none' && W.hosts.includes('https://www.wixapis.com/*'), 'registered with caps and hosts');
eq(W.base({}), 'https://www.wixapis.com', 'default host'); eq(W.base({ apiBase: 'http://x/' }), 'http://x', 'apiBase override');
const KEY = 'IST.eyJraWQiOiJ.testkey', SITE = 'site-1234', ACCT = 'acct-5678';
const ctx = { log: () => { }, http: CMS.http, mediaHost: null };
const authed = (c, out) => (c.headers.authorization === KEY && c.headers['wix-site-id'] === SITE) ? out : { status: 401, json: { message: 'UNAUTHENTICATED', details: { applicationError: { code: 'UNAUTHENTICATED' } } } };
let items = {}; let seq = 0; let published = {};
const S = await mock([
  { method: 'GET', path: '/site-properties/v4/properties', handler: c => authed(c, { status: 200, json: { properties: { siteDisplayName: 'Test Co Site', businessName: 'Test Co' } } }) },
  { method: 'POST', path: '/wix-data/v2/items/query', handler: c => { const q = c.json.query || {}; const f = q.filter || {}; const fk = Object.keys(f)[0]; const fv = fk ? f[fk].$eq : undefined;
    const rows = Object.entries(items).filter(([id, d]) => !fk || d[fk] === fv).map(([id, d]) => ({ id, dataCollectionId: c.json.dataCollectionId, data: Object.assign({ _id: id }, d) }));
    return authed(c, { status: 200, json: { dataItems: rows.slice(0, (q.paging || {}).limit || 50), pagingMetadata: { count: rows.length, offset: 0, total: Object.keys(items).length } } }); } },
  { method: 'POST', path: '/wix-data/v2/items', handler: c => { const id = 'item-' + (++seq); items[id] = c.json.dataItem.data; return authed(c, { status: 200, json: { dataItem: { id, dataCollectionId: c.json.dataCollectionId, data: Object.assign({ _id: id }, c.json.dataItem.data) } } }); } },
  { method: 'PUT', path: /^\/wix-data\/v2\/items\/[^/]+$/, handler: c => { const id = c.path.split('/').pop(); items[id] = c.json.dataItem.data; return authed(c, { status: 200, json: { dataItem: { id, dataCollectionId: c.json.dataCollectionId, data: c.json.dataItem.data } } }); } },
  { method: 'GET', path: '/blog/v3/posts', handler: c => authed(c, { status: 200, json: { posts: [{ id: 'p-1', slug: 'hello' }], pagingMetadata: { count: 1, offset: 0, total: 3 } } }) },
  { method: 'GET', path: /^\/blog\/v3\/posts\/slugs\/[^/]+$/, handler: c => { const slug = c.path.split('/').pop(); return authed(c, published[slug] ? { status: 200, json: { post: { id: published[slug], slug, url: { base: 'https://www.example.com', path: '/post/' + slug } } } } : { status: 404, json: { message: 'Post not found', details: { applicationError: { code: 'NOT_FOUND' } } } }); } },
  { method: 'POST', path: '/blog/v3/draft-posts/query', handler: c => authed(c, { status: 200, json: { draftPosts: [], pagingMetadata: { count: 0, offset: 0 } } }) },
  { method: 'POST', path: '/blog/v3/draft-posts', handler: c => authed(c, { status: 200, json: { draftPost: Object.assign({}, c.json.draftPost, { id: 'dp-' + (++seq), status: c.json.publish ? 'PUBLISHED' : 'UNPUBLISHED' }) } }) },
  { method: 'PATCH', path: /^\/blog\/v3\/draft-posts\/[^/]+$/, handler: c => authed(c, { status: 200, json: { draftPost: Object.assign({}, c.json.draftPost, { id: c.path.split('/').pop() }) } }) },
  { method: 'POST', path: /^\/blog\/v3\/draft-posts\/[^/]+\/publish$/, handler: c => authed(c, { status: 200, json: { postId: c.path.split('/')[4] } }) },
  { method: 'POST', path: '/site-media/v1/files/generate-upload-url', handler: c => authed(c, { status: 200, json: { uploadUrl: S.url + '/upload/tok123?x=1' } }) },
  { method: 'PUT', path: '/upload/tok123', handler: c => ({ status: 200, json: { file: { id: 'f9a8b7_hero~mv2.webp', url: 'https://static.wixstatic.com/media/f9a8b7_hero~mv2.webp', displayName: c.query.filename, mimeType: c.headers['content-type'], media: { image: { image: { width: 1600, height: 1000 } } } } } }) },
]);

/* ---------- cms mode ---------- */
const cfg = { apiBase: S.url, apiKey: KEY, siteId: SITE, accountId: ACCT, mode: 'cms', collectionId: 'Pages', siteUrl: 'https://www.example.com/', dynamicPath: '/pages/{slug}' };
const t1 = await W.test(cfg, ctx);
assert(t1.ok && t1.meta.mode === 'cms' && t1.meta.site === 'Test Co Site' && t1.meta.collection === 'Pages' && t1.meta.items === 0 && !t1.meta.warnings.length, 'cms test meta');
assert(/Test Co Site: collection Pages reachable, 0 items/.test(t1.info) && /fields title, slug, body/.test(t1.info) && /\/pages\/\{slug\}/.test(t1.info), 'cms test info: ' + t1.info);
const q0 = S.find('POST', '/wix-data/v2/items/query');
eq([q0.headers.authorization, q0.headers['wix-site-id'], q0.headers['wix-account-id'], q0.headers['content-type']], [KEY, SITE, ACCT, 'application/json'], 'query headers: key, site id, account id, json');
eq(q0.json, { dataCollectionId: 'Pages', query: { paging: { limit: 1 } }, returnTotalCount: true }, 'probe query body');
eq(S.find('GET', '/site-properties/v4/properties').headers.authorization, KEY, 'site properties read with the key');

/* create */
const u1 = await W.upsertPage(cfg, page(), { publish: false }, ctx);
const q1 = S.all('POST', '/wix-data/v2/items/query')[1]; eq(q1.json, { dataCollectionId: 'Pages', query: { filter: { slug: { $eq: 'divorce-lawyer' } }, paging: { limit: 1 } } }, 'slug lookup body');
const ins = S.find('POST', '/wix-data/v2/items'); assert(ins && ins.headers.authorization === KEY && ins.headers['wix-site-id'] === SITE && ins.headers['content-type'] === 'application/json', 'insert posted with headers');
eq(ins.json.dataCollectionId, 'Pages', 'insert collection id'); const d1 = ins.json.dataItem.data;
eq([d1.title, d1.slug, d1.metaTitle, d1.metaDescription, d1.summary], ['Divorce Lawyer in Plano, TX', 'divorce-lawyer', 'Divorce Lawyer in Plano, TX | Test Co', 'Divorce and custody counsel across Plano.', 'Family law counsel from Test Co.'], 'item fields');
assert(d1.body.startsWith('<h1>') && !d1.body.includes('<style') && !d1.body.includes('<section') && !d1.body.includes('<details') && !d1.body.includes('class=') && d1.body.includes('<img src="https://cdn.example.com/hero.webp" alt="Technician at a condenser"') && d1.body.includes('<h3>How fast?</h3><p>Same day in most cases.</p>') && !d1.body.includes('application/ld+json'), 'body is editorial HTML only: no css, sections, details, classes or JSON-LD: ' + d1.body.slice(0, 200));
assert(!('schema' in d1) && !('status' in d1) && !('hero' in d1) && !('_id' in d1), 'no unmapped fields, no _id on insert');
eq([u1.id, u1.link, u1.status, u1.updated], ['item-1', 'https://www.example.com/pages/divorce-lawyer', 'publish', false], 'create result (items are live)');
assert(/JSON-LD dropped/.test(u1.notes) && /live as soon as they are saved/.test(u1.notes), 'notes: ' + u1.notes); assert(/manage\.wix\.com\/dashboard\/site-1234\/database\/data\/Pages/.test(u1.edit), 'dashboard link');

/* update with schema, image and status fields */
const cfg2 = Object.assign({}, cfg, { schemaField: 'schema', imageField: 'hero', statusField: 'status' });
const u2 = await W.upsertPage(cfg2, page(), { publish: true }, ctx);
const upd = S.find('PUT', '/wix-data/v2/items/item-1'); assert(upd && upd.headers.authorization === KEY, 'update PUTs to the item id'); eq(upd.json.dataCollectionId, 'Pages', 'update collection id'); eq(upd.json.dataItem.id, 'item-1', 'dataItem.id');
const d2 = upd.json.dataItem.data; eq(d2._id, 'item-1', 'data._id'); eq(d2.status, 'publish', 'status field'); eq(d2.hero, 'https://cdn.example.com/hero.webp', 'image field'); eq(JSON.parse(d2.schema)['@graph'][0]['@type'], 'WebPage', 'schema field is the JSON-LD string');
eq([u2.id, u2.status, u2.updated], ['item-1', 'publish', true], 'update result'); eq(S.all('POST', '/wix-data/v2/items').length, 1, 'no second insert'); assert(/JSON-LD in field schema/.test(u2.notes), 'schema note');
const u2b = await W.upsertPage(cfg2, page(), { publish: false }, ctx); eq([u2b.status, S.all('PUT', '/wix-data/v2/items/item-1')[1].json.dataItem.data.status], ['draft', 'draft'], 'draft status through the status field');

/* custom field ids, blank account id, no site url */
const u3 = await W.upsertPage({ apiBase: S.url, apiKey: KEY, siteId: SITE, collectionId: 'Cities', titleField: 'pageTitle', slugField: 'path', bodyField: 'html' }, page({ slug: 'plano' }), {}, ctx);
const q3 = S.all('POST', '/wix-data/v2/items/query').pop(); eq(q3.json, { dataCollectionId: 'Cities', query: { filter: { path: { $eq: 'plano' } }, paging: { limit: 1 } } }, 'lookup uses the slug field id'); assert(!('wix-account-id' in q3.headers), 'account id header omitted when blank');
const ins3 = S.all('POST', '/wix-data/v2/items').pop(); eq(Object.keys(ins3.json.dataItem.data).sort(), ['html', 'metaDescription', 'metaTitle', 'pageTitle', 'path', 'summary'], 'custom field ids'); eq(u3.link, u3.id, 'link falls back to the id');

/* ---------- blog mode ---------- */
const cfgB = { apiBase: S.url, apiKey: KEY, siteId: SITE, accountId: ACCT, mode: 'blog', siteUrl: 'https://www.example.com' };
const t2 = await W.test(cfgB, ctx);
assert(t2.ok && t2.meta.mode === 'blog' && t2.meta.posts === 3 && /Blog reachable, 3 published posts/.test(t2.info) && /\/post\/\{slug\}/.test(t2.info), 'blog test: ' + t2.info);
const lp = S.find('GET', '/blog/v3/posts'); eq(lp.query['paging.limit'], '1', 'posts probe limit'); eq(lp.headers.authorization, KEY, 'posts auth');

/* create a draft: Ricos content */
const html = page().html + '<section id="why"><div class="forge-inner"><h2>Why us</h2><ul><li><strong>Licensed</strong> technicians</li><li>Written <em>prices</em> first, see <a href="https://www.example.com/pricing/">pricing</a></li></ul><blockquote>Great service.</blockquote></div></section>';
const pgB = page({ html, featured_media_url: 'https://static.wixstatic.com/media/f9a8b7_hero~mv2.webp', featured_media_id: 'f9a8b7_hero~mv2.webp' });
const b1 = await W.upsertPage(cfgB, pgB, { publish: false }, ctx);
const bySlug = S.find('GET', '/blog/v3/posts/slugs/divorce-lawyer'); assert(bySlug && bySlug.headers.authorization === KEY, 'published post looked up by slug');
const dq = S.find('POST', '/blog/v3/draft-posts/query'); eq(dq.json, { query: { filter: { title: { $eq: 'Divorce Lawyer in Plano, TX' } }, paging: { limit: 1 } } }, 'draft lookup by title');
const cr = S.find('POST', '/blog/v3/draft-posts'); assert(cr && cr.headers.authorization === KEY && cr.headers['wix-site-id'] === SITE && cr.headers['wix-account-id'] === ACCT, 'create draft with headers'); eq(cr.json.publish, false, 'publish false on a draft');
const dp = cr.json.draftPost; eq([dp.title, dp.slug, dp.excerpt], ['Divorce Lawyer in Plano, TX', 'divorce-lawyer', 'Family law counsel from Test Co.'], 'draft fields'); assert(!('id' in dp), 'no id on create');
eq(dp.seoData.tags[0], { type: 'title', children: 'Divorce Lawyer in Plano, TX | Test Co' }, 'seo title tag'); eq(dp.seoData.tags[1], { type: 'meta', props: { name: 'description', content: 'Divorce and custody counsel across Plano.' } }, 'seo description tag');
assert(dp.seoData.tags.some(t => t.type === 'link' && t.props.rel === 'canonical' && t.props.href === 'https://www.example.com/divorce-lawyer/'), 'canonical tag'); assert(!dp.seoData.tags.some(t => t.type === 'meta' && t.props.name === 'robots'), 'no robots tag when indexable');
eq(dp.media, { wixMedia: { image: { id: 'f9a8b7_hero~mv2.webp' } }, displayed: true, custom: true }, 'cover from the uploaded media id');
const nodes = dp.richContent.nodes; const types = nodes.map(n => n.type);
eq(types[0], 'HEADING', 'first node is the h1'); eq(nodes[0].headingData, { level: 1 }, 'heading level'); eq(nodes[0].nodes[0].type, 'TEXT', 'text node in the heading'); eq(nodes[0].nodes[0].textData.text, 'Divorce Lawyer in Plano, TX', 'heading text');
assert(nodes.every(n => typeof n.id === 'string' && n.id) && nodes.filter(n => n.type === 'PARAGRAPH').every(n => n.nodes.every(t => t.type === 'TEXT' && Array.isArray(t.nodes))), 'ids everywhere, TEXT only inside PARAGRAPH');
const ctas = nodes.find(n => n.type === 'PARAGRAPH' && n.nodes.some(t => t.textData.decorations.some(d => d.type === 'LINK'))); assert(ctas, 'link decoration present'); eq(ctas.nodes[0].textData.decorations[0].linkData.link, { url: '#contact', target: 'SELF' }, 'internal link');
const img = nodes.find(n => n.type === 'IMAGE'); eq(img.imageData.image.src, { url: 'https://cdn.example.com/hero.webp' }, 'external image src url'); eq(img.imageData.altText, 'Technician at a condenser', 'image alt'); eq(img.imageData.containerData.alignment, 'CENTER', 'container data');
const list = nodes.find(n => n.type === 'BULLETED_LIST'); assert(list, 'bulleted list'); eq(list.nodes.length, 2, 'two list items'); eq(list.nodes[0].type, 'LIST_ITEM', 'list item'); eq(list.nodes[0].nodes[0].type, 'PARAGRAPH', 'paragraph in the item');
const bold = list.nodes[0].nodes[0].nodes[0]; eq(bold.textData.text, 'Licensed', 'bold text'); eq(bold.textData.decorations, [{ type: 'BOLD', fontWeightValue: 700 }], 'bold decoration');
const runs = list.nodes[1].nodes[0].nodes; assert(runs.some(r => r.textData.decorations.some(d => d.type === 'ITALIC' && d.italicData === true)), 'italic decoration');
const ext = runs.find(r => r.textData.decorations.some(d => d.type === 'LINK')); eq(ext.textData.decorations[0].linkData.link, { url: 'https://www.example.com/pricing/', target: 'BLANK' }, 'external link opens blank');
assert(types.includes('BLOCKQUOTE') && nodes.find(n => n.type === 'BLOCKQUOTE').nodes[0].type === 'PARAGRAPH', 'quote wraps a paragraph');
assert(nodes.some(n => n.type === 'HEADING' && n.headingData.level === 3 && n.nodes[0].textData.text === 'How fast?'), 'faq summary heading kept as h3');
const rc = JSON.stringify(dp.richContent); assert(!rc.includes('schema.org') && !rc.includes('<') && !rc.includes('<style'), 'no JSON-LD, no raw html, no css in the Ricos document');
eq([b1.id, b1.link, b1.status, b1.updated], ['dp-3', 'https://www.example.com/post/divorce-lawyer', 'draft', false], 'draft result'); assert(/cover image set/.test(b1.notes), 'cover note');

/* the post exists: update, then publish through the publish endpoint */
published['divorce-lawyer'] = 'dp-3';
const b2 = await W.upsertPage(cfgB, pgB, { publish: true }, ctx);
const pt = S.find('PATCH', '/blog/v3/draft-posts/dp-3'); assert(pt && pt.headers.authorization === KEY, 'update patches the draft'); eq(pt.json.draftPost.id, 'dp-3', 'draftPost.id in the patch'); eq(pt.json.draftPost.title, 'Divorce Lawyer in Plano, TX', 'patched title'); assert(!('publish' in pt.json), 'no publish flag on the patch');
assert(S.find('POST', '/blog/v3/draft-posts/dp-3/publish'), 'publish endpoint called'); eq(S.all('POST', '/blog/v3/draft-posts').length, 1, 'no second create'); eq(S.all('POST', '/blog/v3/draft-posts/query').length, 1, 'no draft query when the post is published');
eq([b2.id, b2.link, b2.status, b2.updated], ['dp-3', 'https://www.example.com/post/divorce-lawyer', 'publish', true], 'update result uses the post url');

/* create and publish in one call; noindex tag; no cover without a wix media id */
const b3 = await W.upsertPage(cfgB, page({ slug: 'plano', h1: 'Divorce Lawyer in Frisco', noindex: true }), { publish: true }, ctx);
const cr3 = S.all('POST', '/blog/v3/draft-posts').pop(); eq(cr3.json.publish, true, 'create carries publish true'); assert(cr3.json.draftPost.seoData.tags.some(t => t.type === 'meta' && t.props.name === 'robots' && t.props.content === 'noindex'), 'robots noindex tag');
assert(!cr3.json.draftPost.media && /cover image skipped/.test(b3.notes), 'no cover without a wix media id'); eq([b3.status, b3.updated, b3.link], ['publish', false, 'https://www.example.com/post/plano'], 'create and publish result');

/* ---------- media ---------- */
const m1 = await W.uploadMedia(cfgB, asset(), ctx);
const gen = S.find('POST', '/site-media/v1/files/generate-upload-url'); eq(gen.json, { mimeType: 'image/webp', fileName: 'hero.webp' }, 'generate upload url body'); eq(gen.headers.authorization, KEY, 'generate with the key');
const put = S.find('PUT', '/upload/tok123'); assert(put, 'PUT to the upload url'); eq(put.query, { x: '1', filename: 'hero.webp' }, 'filename appended to the upload url'); eq(put.headers['content-type'], 'image/webp', 'upload content type'); assert(!put.headers.authorization && !put.headers['wix-site-id'], 'no api key on the upload url');
eq(Array.from(put.body), Array.from(new Uint8Array(await asset().blob.arrayBuffer())), 'raw bytes in the body');
eq([m1.id, m1.url, m1.width, m1.height, m1.mime, m1.reused], ['f9a8b7_hero~mv2.webp', 'https://static.wixstatic.com/media/f9a8b7_hero~mv2.webp', 1600, 1000, 'image/webp', false], 'upload result');

/* ---------- error branches ---------- */
const E = await mock([
  { method: 'GET', path: '/site-properties/v4/properties', handler: () => ({ status: 403, json: { message: 'Permission denied' } }) },
  { method: 'POST', path: '/wix-data/v2/items/query', handler: () => ({ status: 403, json: { message: 'Forbidden: missing permission WIX_DATA.READ', details: { applicationError: { code: 'PERMISSION_DENIED' } } } }) },
]);
let threw = null; try { await W.test(Object.assign({}, cfg, { apiBase: E.url }), ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 403 && /missing permission/.test(threw.message) && /Manage Data Items/.test(threw.hint) && threw.adapter === 'wix', '403 surfaces the message and a permission hint: ' + (threw && threw.message));
threw = null; try { await W.test({ apiBase: S.url, apiKey: 'bad', siteId: SITE, mode: 'blog' }, ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 401 && /UNAUTHENTICATED/.test(threw.message) && /API key/.test(threw.hint), '401 hint: ' + (threw && threw.hint));
threw = null; try { await W.upsertPage(Object.assign({}, cfg, { collectionId: 'Missing', apiBase: E.url }), page(), {}, ctx); } catch (e) { threw = e; } assert(threw && threw.status === 403, 'upsert error not swallowed');

await Promise.all([S, E].map(s => s.close()));
console.log('wix ok');
