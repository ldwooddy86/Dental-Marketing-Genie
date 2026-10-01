import { load } from './lib/load.mjs';
import { mock, assert, eq, page } from './lib/mock.mjs';
const CMS = await load([]);
/* utilities */
eq(CMS.md5(''), 'd41d8cd98f00b204e9800998ecf8427e', 'md5 empty');
eq(CMS.md5('The quick brown fox jumps over the lazy dog'), '9e107d9d372bb6826bd81d3542a419d6', 'md5 fox');
eq(CMS.slug('Héllo Wörld / Divorce Lawyer'), 'hello-world-divorce-lawyer', 'slug');
assert(CMS.stripTags('<p>a &amp; b</p>') === 'a & b', 'stripTags');
assert(CMS.stripScripts('<p>x</p><script>1</script><a onclick="y">z</a>') === '<p>x</p><a>z</a>', 'stripScripts');
const jwt = await CMS.jwtHS256({ alg: 'HS256', typ: 'JWT', kid: 'k' }, { iat: 1, exp: 2, aud: '/admin/' }, CMS.fromHex('00ff'));
assert(jwt.split('.').length === 3, 'jwt');
/* html helpers */
const p = page();
const full = CMS.fullHtml(p);
assert(full.startsWith('<!DOCTYPE html>') && full.includes('<title>Divorce Lawyer in Plano, TX | Test Co</title>') && full.includes('application/ld+json') && full.includes('rel="canonical"'), 'fullHtml');
const body = CMS.bodyHtml(p, { css: true, schema: true, mediaMap: { 'https://cdn.example.com/hero.webp': 'https://host/x.webp' } });
assert(body.includes('<style>') && body.includes('https://host/x.webp') && !body.includes('cdn.example.com'), 'bodyHtml rewrite');
const blocks = CMS.htmlToBlocks(p.html);
assert(blocks.some(b => b.type === 'heading' && b.level === 1) && blocks.some(b => b.type === 'image'), 'htmlToBlocks');
/* http */
const srv = await mock([{ method: 'POST', path: '/j', handler: c => ({ status: 201, json: { got: c.json, ct: c.headers['content-type'] } }) }, { method: 'GET', path: '/bad', handler: () => ({ status: 422, json: { message: 'nope' } }) }, { method: 'GET', path: '/html', handler: () => ({ status: 500, text: '<html>Server exploded</html>' }) }]);
const r = await CMS.http(srv.url + '/j', { body: { a: 1 } });
eq(r.status, 201, 'status'); eq(r.json.got, { a: 1 }, 'json body'); assert(r.json.ct === 'application/json', 'content-type set');
let threw = null; try { await CMS.http(srv.url + '/bad'); } catch (e) { threw = e; } assert(threw && threw.status === 422 && /nope/.test(threw.message), 'error surfaces message');
threw = null; try { await CMS.http(srv.url + '/html'); } catch (e) { threw = e; } assert(threw && threw.status === 500 && /Server exploded/.test(threw.message), 'html error text');
threw = null; try { await CMS.http('http://127.0.0.1:1/x', { timeout: 2000 }); } catch (e) { threw = e; } assert(threw && threw.network, 'network error flagged');
/* adapter registry and deploy driver */
const calls = [];
CMS.register({ id: 'fake', name: 'Fake', fields: [{ k: 'url', l: 'URL' }], caps: { media: true }, async test() { return { ok: true, info: 'fine' }; }, async uploadMedia(c, a) { calls.push(['upload', a.file]); return { id: 7, url: 'https://fake/' + a.file }; }, async upsertPage(c, pg, o) { calls.push(['upsert', pg.slug, pg.status, pg.media.hero.url]); return { id: 1, link: 'https://fake/' + pg.slug + '/', status: pg.status, updated: false }; } });
await CMS.setCfg('fake', { url: 'https://fake' });
const pg = page({ media: { hero: { url: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA==', alt: 'x', kind: 'image' } }, featured_media_url: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA==' });
const res = await CMS.deploy('fake', [pg], { publish: true, log: () => { } });
assert(res[0].ok, 'deploy ok'); eq(calls[0], ['upload', 'hero.webp'], 'uploaded data url asset'); eq(calls[1], ['upsert', 'divorce-lawyer', 'publish', 'https://fake/hero.webp'], 'media rewritten before upsert');
assert(CMS.deployedFor('fake')['divorce-lawyer'].ok, 'marked deployed');
const res2 = await CMS.deploy('fake', [pg], { onlyNew: true, log: () => { } }); assert(res2[0].skipped, 'onlyNew skips');
const t = await CMS.test('fake'); assert(t.ok && CMS.status('fake').state === 'connected', 'test marks connected');
await srv.close();
console.log('core ok');
