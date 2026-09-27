/* WordPress adapters (wp_elementor, wp_headless) end to end against mock WordPress sites: with and without the FORGE bridge,
   the plain wp/v2 route (create and update), media reuse and raw upload, live url pagination, headless canonicals, configure(),
   the 401 / bridge missing / 429 error branches and url normalisation. `node tests/run.mjs wordpress` */
import { load } from './lib/load.mjs';
import { mock, assert, eq, page, asset } from './lib/mock.mjs';
const CMS = await load(['src/cms/10_wordpress.js']);
const WPE = CMS.get('wp_elementor'), WPH = CMS.get('wp_headless');
assert(WPE && WPH, 'both adapters registered');
assert(WPE.caps.bridge && WPE.caps.elementor && WPE.caps.schema === 'head' && WPH.caps.headlessKit, 'caps');
const USER = 'admin', PASS = 'abcd efgh ijkl mnop qrst uvwx';
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const ctx = { log: () => { }, http: CMS.http, mediaHost: null };
const authed = (c, out) => c.headers.authorization === AUTH ? out : { status: 401, json: { code: 'rest_forbidden', message: 'bad auth', data: { status: 401 } } };

/* ---------- a site with the bridge ---------- */
let SET = { revalidate_url: '', revalidate_secret: '', cors_origins: ['https://staging.example.com/'], lead_email: 'a@b.c', indexnow_key: 'k1', llms_intro: '' };
const STATUS = { forge: '1.1.0', wp: '6.8.2', php: '8.3.1', elementor: '3.30.1', elementor_pro: null, containers: true, theme: 'Hello Elementor', permalinks: '/%postname%/', seo_plugin: 'yoast', forms: {}, wpgraphql: true, upload_max: 67108864, unfiltered_html: true, user: USER, cors_origins: SET.cors_origins };
const B = await mock([
  { method: 'GET', path: '/wp-json/', handler: c => ({ status: 200, json: { name: 'Bridge Site', url: B.url, home: B.url + '/', namespaces: ['wp/v2', 'forge/v1', 'elementor/v1'] } }) },
  { method: 'GET', path: '/wp-json/forge/v1/status', handler: c => authed(c, { status: 200, json: Object.assign({}, STATUS, { home: B.url + '/', settings: SET }) }) },
  { method: 'POST', path: '/wp-json/forge/v1/import', handler: c => authed(c, { status: 200, json: { id: 42, slug: c.json.slug, status: c.json.status, link: B.url + '/' + c.json.slug + '/', edit: B.url + '/wp-admin/post.php?post=42&action=edit', updated: c.json.slug === 'again' } }) },
  { method: 'GET', path: '/wp-json/forge/v1/media/find', handler: c => authed(c, { status: 200, json: /hero/.test(c.query.q) ? [{ id: 4, title: 'hero banner', url: B.url + '/wp-content/uploads/2026/09/hero-banner.webp', mime: 'image/webp', alt: '', width: 1200, height: 600, file: '2026/09/hero-banner.webp' }, { id: 3, title: 'hero', url: B.url + '/wp-content/uploads/2026/09/hero-1.webp', mime: 'image/webp', alt: 'Old alt', width: 1600, height: 1000, file: '2026/09/hero-1.webp' }] : [] }) },
  { method: 'GET', path: '/wp-json/forge/v1/urls', handler: c => authed(c, { status: 200, json: { count: 3, urls: [B.url + '/', B.url + '/ac-repair/', B.url + '/blog/hello/'] } }) },
  { method: 'GET', path: '/wp-json/forge/v1/settings', handler: c => authed(c, { status: 200, json: SET }) },
  { method: 'POST', path: '/wp-json/forge/v1/settings', handler: c => { SET = Object.assign({}, SET, c.json); return authed(c, { status: 200, json: SET }); } },
  { method: 'POST', path: '/wp-json/forge/v1/template', handler: c => authed(c, { status: 200, json: { id: 77, edit: B.url + '/wp-admin/post.php?post=77&action=edit' } }) },
  { method: 'POST', path: '/wp-json/forge/v1/indexnow', handler: c => authed(c, { status: 200, json: { sent: (c.json.urls || []).length, code: 200 } }) },
  { method: 'POST', path: '/wp-json/wp/v2/media', handler: c => authed(c, { status: 201, json: { id: 9, source_url: B.url + '/wp-content/uploads/2026/09/condenser.webp', mime_type: 'image/webp', media_details: { width: 1600, height: 1000 } } }) },
  { method: 'POST', path: '/wp-json/wp/v2/media/9', handler: c => authed(c, { status: 200, json: { id: 9, alt_text: c.json.alt_text } }) },
]);
const cfgB = { url: B.url, user: USER, appPass: PASS };

/* test() with the bridge */
const t1 = await WPE.test(cfgB, ctx);
assert(t1.ok && t1.meta.bridge === true && t1.meta.bridgeVersion === '1.1.0' && t1.meta.wpgraphql === true && t1.meta.seo === 'yoast' && t1.meta.unfilteredHtml === true, 'bridge test meta');
assert(/bridge 1\.1\.0/.test(t1.info) && /WP 6\.8\.2/.test(t1.info) && /PHP 8\.3\.1/.test(t1.info) && /Elementor 3\.30\.1 \(containers\)/.test(t1.info) && /SEO yoast/.test(t1.info) && /unfiltered_html yes/.test(t1.info) && /admin/.test(t1.info), 'bridge test info: ' + t1.info);
assert(B.find('GET', '/wp-json/') && B.find('GET', '/wp-json/forge/v1/status').headers.authorization === AUTH, 'discovery then status with Basic auth');
assert(!B.find('GET', '/wp-json/wp/v2/users/me'), 'no users/me when the bridge is there');

/* upsert through the bridge: the import bundle */
const pg = page({ media: { hero: { url: 'https://cdn.example.com/hero.webp', id: 5, alt: 'Technician at a condenser', kind: 'image', width: 1600, height: 1000, mime: 'image/webp', asset: { blob: new Blob([1]) } } }, featured_media_id: 5 });
const u1 = await WPE.upsertPage(cfgB, pg, { publish: false }, ctx);
const imp = B.find('POST', '/wp-json/forge/v1/import'); assert(imp && imp.headers.authorization === AUTH && imp.headers['content-type'] === 'application/json', 'import posted with auth and json');
const b1 = imp.json;
eq(b1.slug, 'ac-repair', 'bundle slug'); eq(b1.title, pg.title, 'bundle title'); eq(b1.post_title, pg.h1, 'bundle post_title is the h1'); eq(b1.status, 'draft', 'draft by default'); eq(b1.post_type, 'page', 'post_type'); eq(b1.template, 'default', 'template from page_settings');
assert(Array.isArray(b1.elementor_data) && b1.elementor_data[0].elType === 'container', 'elementor_data'); eq(b1.page_settings, pg.page_settings, 'page_settings');
assert(b1.content_html.includes('<section id="hero"') && !b1.content_html.includes('application/ld+json') && b1.content_html.startsWith('<style>'), 'content_html carries the forge css inline and no JSON-LD (the bridge prints the JSON-LD in the head, nothing prints the css)');
eq(b1.seo, pg.seo, 'seo'); eq(b1.schema, pg.schema, 'schema'); eq(b1.summary, pg.summary, 'summary'); eq(b1.featured_media, 5, 'featured_media from featured_media_id');
eq(b1.blueprint.media_resolved, { hero: { id: 5, url: 'https://cdn.example.com/hero.webp', alt: 'Technician at a condenser', kind: 'image', width: 1600, height: 1000, mime: 'image/webp' } }, 'blueprint.media_resolved from page.media without blobs');
eq(b1.blueprint.forge, '1.1', 'blueprint kept');
eq([u1.id, u1.link, u1.status, u1.updated, u1.route], [42, B.url + '/ac-repair/', 'draft', false, 'bridge'], 'bridge upsert result'); assert(/post=42&action=edit/.test(u1.edit), 'edit link');
const u2 = await WPE.upsertPage(cfgB, page({ slug: 'again', post_type: 'post' }), { publish: true }, ctx);
const imp2 = B.all('POST', '/wp-json/forge/v1/import')[1]; eq(imp2.json.status, 'publish', 'opts.publish publishes'); eq(imp2.json.post_type, 'post', 'post type honoured'); eq(imp2.json.featured_media, 0, 'no featured media'); assert(u2.updated === true && u2.status === 'publish', 'bridge reports updated');
eq(B.all('GET', '/wp-json/').length, 1, 'discovery cached across upserts');

/* media: reuse through the bridge finder, then a raw upload */
const m1 = await WPE.uploadMedia(cfgB, asset(), ctx);
assert(m1.reused === true && m1.id === 3 && /hero-1\.webp$/.test(m1.url) && m1.width === 1600, 'existing attachment reused (the -1 rename matches, hero-banner is another image)');
assert(B.find('GET', '/wp-json/forge/v1/media/find').query.q === 'hero' && !B.find('POST', '/wp-json/wp/v2/media'), 'find before upload, no upload on reuse');
const a2 = Object.assign(asset(), { file: 'condenser.webp', alt: 'Condenser coil' });
const m2 = await WPE.uploadMedia(cfgB, a2, ctx);
const up = B.find('POST', '/wp-json/wp/v2/media'); assert(up, 'raw upload posted');
eq(up.headers['content-type'], 'image/webp', 'upload Content-Type is the mime'); eq(up.headers['content-disposition'], 'attachment; filename="condenser.webp"', 'upload Content-Disposition'); eq(up.headers.authorization, AUTH, 'upload auth');
eq(Array.from(up.body), Array.from(new Uint8Array(await asset().blob.arrayBuffer())), 'raw bytes in the body');
const alt = B.find('POST', '/wp-json/wp/v2/media/9'); eq(alt.json, { alt_text: 'Condenser coil', title: 'condenser' }, 'alt text and title set on the attachment');
eq([m2.id, m2.url, m2.width, m2.height, m2.mime, m2.alt, m2.reused], [9, B.url + '/wp-content/uploads/2026/09/condenser.webp', 1600, 1000, 'image/webp', 'Condenser coil', false], 'upload result');

/* live urls, template, indexnow, settings through the bridge */
eq(await WPE.listUrls(cfgB, ctx), [B.url + '/', B.url + '/ac-repair/', B.url + '/blog/hello/'], 'bridge urls');
const tp = await WPE.importTemplate(cfgB, { title: 'Service page', content: pg.elementor_data, page_settings: pg.page_settings, type: 'page' }, ctx);
eq(B.find('POST', '/wp-json/forge/v1/template').json, { title: 'Service page', content: pg.elementor_data, page_settings: pg.page_settings, type: 'page' }, 'template body'); eq(tp.id, 77, 'template id');
const ix = await WPE.indexNow(cfgB, [B.url + '/ac-repair/', '', B.url + '/blog/hello/'], ctx);
eq(B.find('POST', '/wp-json/forge/v1/indexnow').json, { urls: [B.url + '/ac-repair/', B.url + '/blog/hello/'] }, 'indexnow body'); eq(ix, { sent: 2, code: 200 }, 'indexnow result');
eq((await WPE.getSettings(cfgB, ctx)).indexnow_key, 'k1', 'get settings');
const ss = await WPE.setSettings(cfgB, { indexnow_key: 'k2' }, ctx); eq(ss.indexnow_key, 'k2', 'set settings'); eq(B.find('POST', '/wp-json/forge/v1/settings').json, { indexnow_key: 'k2' }, 'settings patch only');

/* ---------- a plain site: wp/v2 only ---------- */
let exists = false;
const P = await mock([
  { method: 'GET', path: '/wp-json/', handler: () => ({ status: 200, json: { name: 'Plain Site', url: P.url, home: P.url + '/', namespaces: ['wp/v2'] } }) },
  { method: 'GET', path: '/wp-json/wp/v2/users/me', handler: c => authed(c, { status: 200, json: { id: 1, slug: 'editor', roles: ['administrator'], capabilities: { edit_pages: true, unfiltered_html: true } } }) },
  { method: 'GET', path: '/wp-json/wp/v2/pages', handler: c => { if (c.query.slug) return authed(c, { status: 200, json: exists ? [{ id: 12 }] : [] }); const p = +c.query.page || 1; return authed(c, { status: 200, headers: { 'X-WP-Total': '3', 'X-WP-TotalPages': '2' }, json: p === 1 ? [{ link: P.url + '/a/' }, { link: P.url + '/b/' }] : [{ link: P.url + '/c/' }] }); } },
  { method: 'POST', path: '/wp-json/wp/v2/pages', handler: c => authed(c, { status: 201, json: { id: 12, link: P.url + '/' + c.json.slug + '/', status: c.json.status } }) },
  { method: 'POST', path: '/wp-json/wp/v2/pages/12', handler: c => authed(c, { status: 200, json: { id: 12, link: P.url + '/' + c.json.slug + '/', status: c.json.status } }) },
  { method: 'GET', path: '/wp-json/wp/v2/posts', handler: c => authed(c, { status: 200, json: [{ link: P.url + '/blog/post-1/' }] }) },
  { method: 'GET', path: '/wp-json/wp/v2/media', handler: c => authed(c, { status: 200, json: /hero/.test(c.query.search) ? [{ id: 21, source_url: P.url + '/wp-content/uploads/hero.webp', mime_type: 'image/webp', alt_text: 'Alt', media_details: { width: 800, height: 600 } }] : [] }) },
]);
const cfgP = { url: P.url, user: USER, appPass: PASS };

/* test() without the bridge */
const t2 = await WPE.test(cfgP, ctx);
assert(t2.ok && t2.meta.bridge === false && t2.meta.user === 'editor' && t2.meta.canEdit === true, 'plain test meta');
assert(/no FORGE bridge/.test(t2.info) && /HTML route only/.test(t2.info) && /editor/.test(t2.info), 'plain test info: ' + t2.info);
const me = P.find('GET', '/wp-json/wp/v2/users/me'); eq(me.query.context, 'edit', 'users/me?context=edit'); eq(me.headers.authorization, AUTH, 'users/me auth');

/* upsert without the bridge: create, then update */
const u3 = await WPE.upsertPage(cfgP, page(), { publish: false }, ctx);
const look = P.find('GET', '/wp-json/wp/v2/pages'); eq([look.query.slug, look.query.status, look.query._fields], ['ac-repair', 'any', 'id'], 'slug lookup query');
const cr = P.find('POST', '/wp-json/wp/v2/pages'); assert(cr && cr.headers.authorization === AUTH, 'create posted with auth');
eq([cr.json.slug, cr.json.title, cr.json.status, cr.json.excerpt], ['ac-repair', 'AC Repair in Mesquite, TX', 'draft', 'AC repair from Test Co.'], 'create body fields');
assert(cr.json.content.includes('<section id="hero"') && cr.json.content.includes('application/ld+json') && cr.json.content.startsWith('<style>'), 'content carries the forge css and the JSON-LD inline'); eq(cr.json.meta, {}, 'meta {}'); assert(!('featured_media' in cr.json), 'no featured_media without an id');
eq([u3.id, u3.link, u3.edit, u3.status, u3.updated, u3.route], [12, P.url + '/ac-repair/', P.url + '/wp-admin/post.php?post=12&action=edit', 'draft', false, 'rest'], 'create result');
exists = true;
const u4 = await WPE.upsertPage(cfgP, page({ featured_media_id: 21 }), { publish: true }, ctx);
const upd = P.find('POST', '/wp-json/wp/v2/pages/12'); assert(upd, 'update posts to the id'); eq([upd.json.status, upd.json.featured_media], ['publish', 21], 'update publishes with featured media');
assert(u4.updated === true && u4.status === 'publish' && u4.id === 12, 'update result');

/* media search and live urls without the bridge */
const fm = await WPE.findMedia(cfgP, 'hero', 'image', ctx);
const ms = P.find('GET', '/wp-json/wp/v2/media'); eq([ms.query.search, ms.query.per_page, ms.query.media_type, ms.query._fields], ['hero', '5', 'image', 'id,source_url,mime_type,alt_text,media_details'], 'media search query');
eq(fm, [{ id: 21, url: P.url + '/wp-content/uploads/hero.webp', alt: 'Alt', width: 800, height: 600, mime: 'image/webp' }], 'media rows mapped');
const urls = await WPE.listUrls(cfgP, ctx);
eq(urls, [P.url + '/', P.url + '/a/', P.url + '/b/', P.url + '/c/', P.url + '/blog/post-1/'], 'home plus paginated pages and posts');
const pgs = P.all('GET', '/wp-json/wp/v2/pages').filter(c => c.query._fields === 'link'); eq(pgs.map(c => [c.query.page, c.query.per_page]), [['1', '100'], ['2', '100']], 'pages paginated by X-WP-TotalPages'); eq(P.all('GET', '/wp-json/wp/v2/posts').length, 1, 'posts one page (no X-WP-TotalPages header: a short page ends the walk)');

/* headless needs the bridge: test() says so instead of throwing */
const th = await WPH.test(Object.assign({ siteUrl: 'https://www.example.com' }, cfgP), ctx);
assert(th.ok === false && /Headless needs it/.test(th.info) && /forge-bridge\.zip/.test(th.info) && th.meta.bridge === false && th.hint, 'headless without bridge: ' + th.info);
let threw = null; try { await WPH.upsertPage(Object.assign({ siteUrl: 'https://www.example.com' }, cfgP), page(), {}, ctx); } catch (e) { threw = e; }
assert(threw && threw.code === 'forge_no_bridge' && /bridge/.test(threw.hint), 'headless upsert without bridge throws with a hint');

/* ---------- headless: bridge site plus a front end ---------- */
const F = await mock([{ method: 'GET', path: '/', handler: () => ({ status: 200, text: '<!doctype html><title>Front</title>' }) }]);
const cfgH = { url: B.url, user: USER, appPass: PASS, siteUrl: F.url + '/', revalidateSecret: 's3cret' };
const t3 = await WPH.test(cfgH, ctx);
assert(t3.ok && t3.meta.bridge && t3.meta.wpgraphql === true && t3.meta.frontStatus === 200 && t3.meta.frontOk === true && t3.meta.configured === false, 'headless test meta');
assert(/WPGraphQL on/.test(t3.info) && /front end up/.test(t3.info) && /revalidate not configured/.test(t3.info) && /run Configure/.test(t3.info), 'headless test info: ' + t3.info);
assert(F.find('GET', '/'), 'front end probed'); eq(t3.meta.revalidateUrl, F.url + '/api/revalidate', 'default revalidate url');

/* configure(): revalidate url, secret and the front end as a CORS origin (merged with the existing ones) */
const cf = await WPH.configure(cfgH, ctx);
const sp = B.all('POST', '/wp-json/forge/v1/settings').pop();
eq(sp.json, { revalidate_url: F.url + '/api/revalidate', cors_origins: ['https://staging.example.com', F.url], revalidate_secret: 's3cret' }, 'configure body'); eq(sp.headers.authorization, AUTH, 'configure auth');
assert(cf.ok && /api\/revalidate/.test(cf.info) && cf.settings.revalidate_secret === 's3cret', 'configure result');
const t4 = await WPH.test(cfgH, ctx); assert(t4.meta.configured === true && /revalidate configured/.test(t4.info), 'configured after configure');
const cf2 = await WPH.configure(Object.assign({}, cfgH, { revalidateSecret: '', revalidateUrl: 'https://hooks.example.com/reval' }), ctx);
const sp2 = B.all('POST', '/wp-json/forge/v1/settings').pop(); assert(!('revalidate_secret' in sp2.json) && sp2.json.revalidate_url === 'https://hooks.example.com/reval', 'empty secret left alone, custom revalidate url'); assert(cf2.ok, 'configure again ok');

/* headless upsert: canonical rewritten onto the front end, link on the front end host */
const pgH = page({ schema: { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', '@id': 'https://www.example.com/ac-repair/#webpage', url: 'https://www.example.com/ac-repair/' }] } });
const u5 = await WPH.upsertPage(cfgH, pgH, { publish: true }, ctx);
const impH = B.all('POST', '/wp-json/forge/v1/import').pop();
eq(impH.json.seo.canonical, F.url + '/ac-repair/', 'seo.canonical on the front end'); eq(impH.json.seo.title, pgH.seo.title, 'other seo fields kept');
eq(impH.json.schema['@graph'][0].url, F.url + '/ac-repair/', 'schema urls follow the canonical'); eq(impH.json.schema['@graph'][0]['@id'], F.url + '/ac-repair/#webpage', 'schema ids follow the canonical');
eq(impH.json.status, 'publish', 'headless publish'); assert(impH.json.blueprint && impH.json.elementor_data, 'same bundle as the Elementor route');
eq([u5.id, u5.link, u5.wpLink, u5.status, u5.updated], [42, F.url + '/ac-repair/', B.url + '/ac-repair/', 'publish', false], 'headless result links to the front end');
eq(await WPH.listUrls(cfgH, ctx), [F.url + '/', F.url + '/ac-repair/', F.url + '/blog/hello/'], 'headless live urls on the front end host');

/* ---------- error branches ---------- */
const E = await mock([{ method: 'GET', path: '/wp-json/', handler: () => ({ status: 401, json: { code: 'invalid_password', message: 'The provided password is an invalid application password.', data: { status: 401 } } }) }]);
threw = null; try { await WPE.test({ url: E.url, user: USER, appPass: 'wrong' }, ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 401 && /invalid application password/.test(threw.message) && /Application Password/.test(threw.hint) && threw.adapter === 'wordpress', '401 surfaces the message and a hint: ' + (threw && threw.message));
const R = await mock([
  { method: 'GET', path: '/wp-json/', handler: () => ({ status: 200, json: { name: 'Half', namespaces: ['wp/v2', 'forge/v1'] } }) },
  { method: 'GET', path: '/wp-json/forge/v1/status', handler: () => ({ status: 404, json: { code: 'rest_no_route', message: 'No route was found matching the URL and request method.', data: { status: 404 } } }) },
]);
threw = null; try { await WPE.test({ url: R.url, user: USER, appPass: PASS }, ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 404 && /FORGE bridge is not active/.test(threw.hint) && /Post name/.test(threw.hint), 'bridge 404 hint');
const X = await mock([
  { method: 'GET', path: '/wp-json/', handler: () => ({ status: 200, json: { name: 'Caps', namespaces: ['wp/v2', 'forge/v1'] } }) },
  { method: 'POST', path: '/wp-json/forge/v1/import', handler: () => ({ status: 403, json: { code: 'forge_caps', message: 'Importing Elementor data requires the unfiltered_html capability (an administrator on single-site).', data: { status: 403 } } }) },
]);
threw = null; try { await WPE.upsertPage({ url: X.url, user: USER, appPass: PASS }, page(), {}, ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 403 && /unfiltered_html/.test(threw.message) && /administrator/.test(threw.hint), 'forge_caps 403 hint');
const L = await mock([{ method: 'GET', path: '/wp-json/', handler: () => ({ status: 429, json: { code: 'rate_limited', message: 'Too many requests', data: { status: 429 } } }) }]);
threw = null; try { await WPE.test({ url: L.url, user: USER, appPass: PASS }, ctx); } catch (e) { threw = e; }
assert(threw && threw.status === 429 && /rate limited/.test(threw.hint), '429 hint');
/* a host pasted without a scheme is https, and the permission origin follows */
eq(WPE.base({ url: 'www.example.com/' }), 'https://www.example.com', 'scheme added to a bare host'); eq(WPE.dynamicHost({ url: 'www.example.com/' }), 'https://www.example.com', 'dynamicHost is the origin'); eq(WPE.base({ url: 'http://cms.local' }), 'http://cms.local', 'explicit http kept');
const H = await mock([{ method: 'GET', path: '/wp-json/', handler: () => ({ status: 200, text: '<html><body>Not WordPress</body></html>' }) }]);
threw = null; try { await WPE.test({ url: H.url, user: USER, appPass: PASS }, ctx); } catch (e) { threw = e; }
assert(threw && /No WordPress REST API/.test(threw.message) && /install URL/.test(threw.hint), 'non WordPress site detected');

await Promise.all([B, P, F, E, R, X, L, H].map(s => s.close()));
console.log('wordpress ok');
