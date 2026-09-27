/* Webflow adapter end to end against a mock Data API v2: test() (token introspect, site, collection fields with warnings), create a
   staged item with cleaned RichText and the mapped fields, unmapped fields skipped with notes, the exists → update branch with
   publish items (429 then retry) and publish site (custom domain ids), staging only publish, the two step asset upload with the
   S3 form fields in order, and the 401 / missing scopes / 429 error branches. `node tests/run.mjs webflow` */
import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset, parseMultipart } from './lib/mock.mjs';
const CMS = await load(['src/cms/14_webflow.js']);
const WF = CMS.get('webflow');
assert(WF && WF.caps.media === true && WF.caps.publishSite === true && WF.caps.schema === 'none' && WF.hosts.includes('https://webflow-prod-assets.s3.amazonaws.com/*'), 'registered with caps and hosts');
eq(WF.base({}), 'https://api.webflow.com', 'default host'); eq(WF.base({ apiBase: 'http://x/' }), 'http://x', 'apiBase override');
const TOKEN = 'wf-token-abc'; const AUTH = 'Bearer ' + TOKEN;
const ctx = { log: () => { }, http: CMS.http, mediaHost: null };
const authed = (c, out) => c.headers.authorization === AUTH ? out : { status: 401, json: { message: 'Request not authorized', code: 'not_authorized' } };
const FIELDS = [{ id: 'f1', isRequired: true, type: 'PlainText', slug: 'name', displayName: 'Name' }, { id: 'f2', isRequired: true, type: 'PlainText', slug: 'slug' }, { id: 'f3', isRequired: false, type: 'RichText', slug: 'post-body' }, { id: 'f4', type: 'PlainText', slug: 'summary' }, { id: 'f5', type: 'PlainText', slug: 'meta-title' }, { id: 'f6', type: 'PlainText', slug: 'meta-description' }, { id: 'f7', type: 'PlainText', slug: 'schema' }, { id: 'f8', type: 'Image', slug: 'main-image' }, { id: 'f9', type: 'PlainText', slug: 'city', isRequired: true }];
let ITEMS = {}; let seq = 0; let rate = 0;
const S = await mock([
  { method: 'GET', path: '/v2/token/introspect', handler: c => authed(c, { status: 200, json: { authorization: { id: 'a1', grantType: 'authorization_code', scope: 'cms:read cms:write sites:read sites:write assets:read assets:write', authorizedTo: { siteIds: ['s1'] }, rateLimit: 60 } } }) },
  { method: 'GET', path: '/v2/sites/s1', handler: c => authed(c, { status: 200, json: { id: 's1', displayName: 'Test Co', shortName: 'test-co', lastPublished: '2026-09-01T10:00:00Z', customDomains: [{ id: 'd1', url: 'www.example.com' }, { id: 'd2', url: 'example.com' }] } }) },
  { method: 'POST', path: '/v2/sites/s1/publish', handler: c => authed(c, { status: 202, json: { customDomains: c.json.customDomains || [], publishToWebflowSubdomain: !!c.json.publishToWebflowSubdomain } }) },
  { method: 'GET', path: '/v2/collections/c1', handler: c => authed(c, { status: 200, json: { id: 'c1', displayName: 'Pages', singularName: 'Page', slug: 'pages', fields: FIELDS } }) },
  { method: 'GET', path: '/v2/collections/c1/items', handler: c => authed(c, { status: 200, json: { items: Object.values(ITEMS).filter(i => !c.query.slug || i.fieldData.slug === c.query.slug), pagination: { limit: 100, offset: 0, total: Object.keys(ITEMS).length } } }) },
  { method: 'POST', path: '/v2/collections/c1/items', handler: c => { const id = 'i' + (++seq); ITEMS[id] = { id, cmsLocaleId: null, isArchived: c.json.isArchived, isDraft: c.json.isDraft, fieldData: c.json.fieldData }; return authed(c, { status: 202, json: ITEMS[id] }); } },
  { method: 'PATCH', path: /^\/v2\/collections\/c1\/items\/[^/]+$/, handler: c => { const id = c.path.split('/').pop(); if (!ITEMS[id]) return { status: 404, json: { message: 'Item not found', code: 'resource_not_found' } }; Object.assign(ITEMS[id], { isDraft: c.json.isDraft, isArchived: c.json.isArchived }); Object.assign(ITEMS[id].fieldData, c.json.fieldData); return authed(c, { status: 200, json: ITEMS[id] }); } },
  { method: 'POST', path: '/v2/collections/c1/items/publish', handler: c => { if (rate > 0) { rate--; return { status: 429, headers: { 'Retry-After': '0' }, json: { message: 'Too Many Requests', code: 'too_many_requests' } }; } return authed(c, { status: 202, json: { publishedItemIds: c.json.itemIds, errors: [] } }); } },
  { method: 'POST', path: '/v2/sites/s1/assets', handler: c => authed(c, { status: 202, json: { id: 'a1', uploadUrl: S.url + '/s3', uploadDetails: { acl: 'public-read', bucket: 'webflow-prod-assets', 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': 'AKIA/20260927/us-east-1/s3/aws4_request', 'X-Amz-Date': '20260927T000000Z', key: 's1/' + c.json.fileHash + '_' + c.json.fileName, Policy: 'eyJ', 'X-Amz-Signature': 'sig', success_action_status: '201', 'content-type': 'image/webp', 'Cache-Control': 'max-age=31536000, must-revalidate' }, contentType: 'image/webp', originalFileName: c.json.fileName, hostedUrl: 'https://cdn.prod.website-files.com/s1/' + c.json.fileHash + '_' + c.json.fileName, assetUrl: '/s1/' + c.json.fileName } }) },
  { method: 'POST', path: '/s3', handler: () => ({ status: 201, text: '<?xml version="1.0"?><PostResponse><Location>x</Location></PostResponse>' }) },
]);
const cfg = { apiBase: S.url, token: TOKEN, siteId: 's1', collectionId: 'c1', schemaField: 'schema', imageField: 'main-image', siteUrl: 'https://www.example.com/' };

/* test() */
const t1 = await WF.test(cfg, ctx);
assert(t1.ok && t1.meta.site === 'Test Co' && t1.meta.shortName === 'test-co' && t1.meta.collectionSlug === 'pages' && t1.meta.fields.body.type === 'RichText' && t1.meta.scopes.includes('cms:write') && t1.meta.rateLimit === 60, 'test meta');
assert(/^Test Co: token ok \(cms:read cms:write/.test(t1.info) && /collection Pages \(\/pages\)/.test(t1.info) && /body post-body RichText/.test(t1.info) && /www\.example\.com, example\.com/.test(t1.info) && /last published 2026-09-01/.test(t1.info), 'test info: ' + t1.info);
assert(t1.meta.warnings.length === 1 && /Required collection fields not mapped: city/.test(t1.meta.warnings[0]), 'unmapped required field warned: ' + t1.meta.warnings.join(' | '));
const ti = S.find('GET', '/v2/token/introspect'); eq([ti.headers.authorization, ti.headers.accept], [AUTH, 'application/json'], 'bearer and accept on introspect'); assert(S.find('GET', '/v2/sites/s1') && S.find('GET', '/v2/collections/c1'), 'site and collection read');
const t2 = await WF.test(Object.assign({}, cfg, { bodyField: 'summary', schemaField: '', imageField: '' }), ctx); assert(t2.meta.warnings.some(w => /summary is PlainText, not RichText/.test(w)), 'non RichText body warned');
const t3 = await WF.test(Object.assign({}, cfg, { bodyField: 'content' }), ctx); assert(t3.meta.warnings.some(w => /No field content on the collection \(body\)/.test(w)) && /body content missing/.test(t3.info), 'missing body field warned');

/* create a staged draft */
const u1 = await WF.upsertPage(cfg, page(), { publish: false }, ctx);
const look = S.find('GET', '/v2/collections/c1/items'); eq([look.query.slug, look.query.limit], ['ac-repair', '1'], 'slug filter'); eq(look.headers.authorization, AUTH, 'lookup auth');
const cr = S.find('POST', '/v2/collections/c1/items'); assert(cr && cr.headers.authorization === AUTH && cr.headers['content-type'] === 'application/json', 'create posted'); eq([cr.json.isArchived, cr.json.isDraft], [false, true], 'draft flags');
const fd = cr.json.fieldData; eq([fd.name, fd.slug, fd.summary, fd['meta-title'], fd['meta-description']], ['AC Repair in Mesquite, TX', 'ac-repair', 'AC repair from Test Co.', 'AC Repair in Mesquite, TX | Test Co', 'Same day AC repair across Mesquite.'], 'field slugs');
eq(JSON.parse(fd.schema)['@graph'][0]['@type'], 'WebPage', 'schema field is the JSON-LD string'); eq(fd['main-image'], { url: 'https://cdn.example.com/hero.webp', alt: 'Technician at a condenser' }, 'image field from the hero');
const rt = fd['post-body'];
assert(!/<(section|div|details|summary|style|script)\b/i.test(rt) && !/class=/.test(rt) && !/ id=/.test(rt), 'wrappers, classes and ids removed: ' + rt);
assert(rt.includes('<h1>AC Repair in Mesquite, TX</h1>') && rt.includes('<p>Written prices first.</p>') && rt.includes('<p><a href="#contact">Book service</a></p>') && rt.includes('<img src="https://cdn.example.com/hero.webp" alt="Technician at a condenser" width="1600" height="1000">') && rt.includes('<h2>Frequently asked questions</h2><h3>How fast?</h3><p>Same day in most cases.</p>'), 'rich text keeps the content: ' + rt);
assert(!rt.includes('application/ld+json'), 'no JSON-LD in the rich text');
eq([u1.id, u1.link, u1.edit, u1.status, u1.updated, u1.notes], ['i1', 'https://www.example.com/pages/ac-repair', 'https://webflow.com/dashboard/sites/test-co', 'draft', false, ''], 'create result');

/* forms, videos, pictures, dl and spans in the rich text; unmapped fields skipped with a note */
const html2 = '<section><div><h2>Facts</h2><dl class="forge-facts"><div><dt>24/7</dt><dd>Emergency service</dd></div></dl><form class="forge-form"><label>Name</label><input type="text"><button>Send</button></form><div class="forge-video"><iframe src="https://www.youtube.com/embed/x"></iframe></div><picture><source srcset="a.avif"><img src="https://cdn.example.com/b.webp" alt="b"></picture><p class="x" onclick="evil()">Text <span class="y">span</span> <strong>bold</strong></p><p></p><ol><li>One</li></ol></div></section>';
const cfg2 = Object.assign({}, cfg, { summaryField: 'excerpt', schemaField: '', imageField: '' });
const u2 = await WF.upsertPage(cfg2, page({ slug: 'plano', html: html2 }), {}, ctx);
const cr2 = S.all('POST', '/v2/collections/c1/items').pop();
eq(cr2.json.fieldData['post-body'], '<h2>Facts</h2><p><strong>24/7</strong></p><p>Emergency service</p><img src="https://cdn.example.com/b.webp" alt="b"><p>Text span <strong>bold</strong></p><ol><li>One</li></ol>', 'rich text cleanup');
assert(/summary skipped: no field excerpt/.test(u2.notes) && /JSON-LD dropped/.test(u2.notes), 'notes for skipped fields: ' + u2.notes); assert(!('excerpt' in cr2.json.fieldData) && !('schema' in cr2.json.fieldData) && !('main-image' in cr2.json.fieldData), 'unknown or unmapped fields not sent');
eq(WF.richText('<p>x</p>'), '<p>x</p>', 'richText exported');
/* remapped name and slug fields: the built in name and slug are still sent (the lookup keys on fieldData.slug); an image url into a plain text field is a string */
const u2b = await WF.upsertPage(Object.assign({}, cfg, { nameField: 'title', slugField: 'path', summaryField: 'excerpt', imageField: 'summary', schemaField: '' }), page({ slug: 'frisco' }), {}, ctx);
const cr2b = S.all('POST', '/v2/collections/c1/items').pop(); eq([cr2b.json.fieldData.name, cr2b.json.fieldData.slug, cr2b.json.fieldData.summary], ['AC Repair in Mesquite, TX', 'frisco', 'https://cdn.example.com/hero.webp'], 'built in name and slug always sent; url string into a PlainText image field');
assert(!('title' in cr2b.json.fieldData) && !('path' in cr2b.json.fieldData) && /mapped name skipped: no field title/.test(u2b.notes) && /mapped slug skipped: no field path/.test(u2b.notes), 'mapped name and slug skipped with notes when the collection lacks them: ' + u2b.notes);
const u2c = await WF.upsertPage(cfg, page({ slug: 'frisco' }), {}, ctx); assert(u2c.updated && S.all('PATCH', /\/items\/i3$/).length === 1, 'the remapped item is found again by fieldData.slug');


/* the item exists: update, publish items (429 then retry) and publish the site with its custom domain ids */
const cfg3 = Object.assign({}, cfg, { publishItems: true, publishSite: true }); rate = 1;
const u3 = await WF.upsertPage(cfg3, page(), { publish: true }, ctx);
const pt = S.find('PATCH', '/v2/collections/c1/items/i1'); assert(pt && pt.headers.authorization === AUTH, 'existing item patched'); eq([pt.json.isDraft, pt.json.isArchived, pt.json.fieldData.slug, pt.json.fieldData.name], [false, false, 'ac-repair', 'AC Repair in Mesquite, TX'], 'patch body'); eq(S.all('POST', '/v2/collections/c1/items').length, 3, 'no fourth create');
const pubs = S.all('POST', '/v2/collections/c1/items/publish'); eq(pubs.length, 2, '429 then one retry'); eq(pubs[1].json, { itemIds: ['i1'] }, 'publish items body'); eq(pubs[1].headers.authorization, AUTH, 'publish items auth');
const sp = S.find('POST', '/v2/sites/s1/publish'); eq(sp.json, { publishToWebflowSubdomain: true, customDomains: ['d1', 'd2'] }, 'site publish body with the domain ids'); eq(sp.headers.authorization, AUTH, 'site publish auth');
eq([u3.id, u3.status, u3.updated], ['i1', 'publish', true], 'publish result'); assert(/published to test-co\.webflow\.io and www\.example\.com, example\.com/.test(u3.notes), 'publish note: ' + u3.notes);
const u4 = await WF.upsertPage(cfg, page(), { publish: true }, ctx); assert(u4.status === 'draft' && /next site publish/.test(u4.notes) && u4.updated, 'staged live without the publish options'); eq(S.all('POST', '/v2/collections/c1/items/publish').length, 2, 'no item publish without the option');

/* publishSite alone, staging only */
const ps = await WF.publishSite(Object.assign({}, cfg, { stagingOnly: true }), ctx); eq(S.all('POST', '/v2/sites/s1/publish').pop().json, { publishToWebflowSubdomain: true }, 'subdomain only body'); assert(ps.ok && /Test Co published to test-co\.webflow\.io$/.test(ps.info), 'publishSite info: ' + ps.info);

/* media: register the file, then the S3 form POST */
const m1 = await WF.uploadMedia(cfg, asset(), ctx);
const hash = CMS.md5(new Uint8Array(await asset().blob.arrayBuffer()));
const reg = S.find('POST', '/v2/sites/s1/assets'); eq(reg.json, { fileName: 'hero.webp', fileHash: hash }, 'asset registered with the md5'); eq(reg.headers.authorization, AUTH, 'asset auth');
const s3 = S.find('POST', '/s3'); assert(s3 && /^multipart\/form-data/.test(s3.headers['content-type']) && !s3.headers.authorization, 'multipart POST to the upload url without the token');
const parts = parseMultipart(s3); const names = parts.map(p => p.name);
eq(names.slice(0, -1), ['acl', 'bucket', 'X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'key', 'Policy', 'X-Amz-Signature', 'success_action_status', 'content-type', 'Cache-Control'], 'every uploadDetails field, in order, before the file'); eq(names[names.length - 1], 'file', 'file part last');
const fp = parts[parts.length - 1]; eq([fp.filename, fp.type], ['hero.webp', 'image/webp'], 'file part name and type'); eq(Array.from(fp.data), Array.from(new Uint8Array(await asset().blob.arrayBuffer())), 'file bytes'); eq(parts.find(p => p.name === 'Policy').data.toString(), 'eyJ', 'policy value as returned');
eq([m1.id, m1.url, m1.reused, m1.mime, m1.width], ['a1', 'https://cdn.prod.website-files.com/s1/' + hash + '_hero.webp', false, 'image/webp', 1600], 'upload result');

/* error branches */
let threw = null; try { await WF.test(Object.assign({}, cfg, { token: 'bad' }), ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 401 && /Request not authorized/.test(threw.message) && /API token/.test(threw.hint) && threw.adapter === 'webflow', '401 surfaces the message and a hint: ' + (threw && threw.message));
const E = await mock([{ method: 'GET', path: '/v2/token/introspect', reply: { authorization: { scope: 'cms:read' } } }, { method: 'GET', path: '/v2/sites/s1', handler: () => ({ status: 403, json: { message: 'You are missing the following scopes: sites:read', code: 'missing_scopes' } }) }]);
threw = null; try { await WF.test(Object.assign({}, cfg, { apiBase: E.url }), ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 403 && threw.code === 'missing_scopes' && /missing the following scopes/.test(threw.message) && /sites:write/.test(threw.hint), 'missing scopes hint: ' + (threw && threw.hint));
const R = await mock([{ method: 'GET', path: '/v2/collections/c9', handler: () => ({ status: 429, headers: { 'Retry-After': '0' }, json: { message: 'Too Many Requests', code: 'too_many_requests' } }) }]);
threw = null; try { await WF.upsertPage(Object.assign({}, cfg, { apiBase: R.url, collectionId: 'c9' }), page(), {}, ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 429 && /Rate limit/.test(threw.hint) && R.all('GET', '/v2/collections/c9').length === 2, 'a second 429 surfaces after one retry');

await Promise.all([S, E, R].map(s => s.close()));
console.log('webflow ok');
