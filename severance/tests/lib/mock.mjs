/* A tiny HTTP mock server for adapter tests. Routes are matched in order; each handler receives a parsed request and returns
   {status, json|text|body, headers}. Every request is recorded so tests can assert on method, path, headers and bodies.
   Usage:
     const srv = await mock([
       { method: 'GET', path: '/wp-json/', reply: { name: 'Site', namespaces: ['wp/v2', 'forge/v1'] } },
       { method: 'POST', path: /^\/wp-json\/wp\/v2\/pages$/, handler: req => ({ status: 201, json: { id: 12, link: srv.url + '/x/' } }) },
     ]);
     ... await srv.close(); srv.calls → [{method, path, url, query, headers, body, json, text}] */
import http from 'node:http';
export async function mock(routes, opts) {
  const calls = [];
  const server = http.createServer((req, res) => {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const buf = Buffer.concat(chunks); const u = new URL(req.url, 'http://localhost'); const text = buf.toString('utf8'); let json = null; try { json = JSON.parse(text); } catch (e) { }
      const call = { method: req.method, path: u.pathname, url: req.url, query: Object.fromEntries(u.searchParams.entries()), headers: req.headers, body: buf, text, json }; calls.push(call);
      const r = (routes || []).find(rt => (!rt.method || rt.method === req.method) && (rt.path instanceof RegExp ? rt.path.test(u.pathname) : rt.path === u.pathname));
      let out; if (!r) out = { status: 404, json: { error: 'no mock route for ' + req.method + ' ' + u.pathname } }; else if (r.handler) { try { out = r.handler(call, u); } catch (e) { out = { status: 500, json: { error: e.message } }; } } else out = { status: r.status || 200, json: r.reply };
      Promise.resolve(out).then(o => { o = o || { status: 204 }; const headers = Object.assign({ 'Access-Control-Allow-Origin': '*' }, o.headers || {}); let body = ''; if (o.json !== undefined) { headers['Content-Type'] = headers['Content-Type'] || 'application/json'; body = JSON.stringify(o.json); } else if (o.text !== undefined) { headers['Content-Type'] = headers['Content-Type'] || 'text/plain'; body = o.text; } else if (o.body !== undefined) body = o.body; res.writeHead(o.status || 200, headers); res.end(body); });
    });
  });
  await new Promise(r => server.listen((opts && opts.port) || 0, '127.0.0.1', r));
  const port = server.address().port; const url = `http://127.0.0.1:${port}`;
  return { url, port, calls, server, find: (method, re) => calls.find(c => c.method === method && (re instanceof RegExp ? re.test(c.path) : c.path === re)), all: (method, re) => calls.filter(c => c.method === method && (re instanceof RegExp ? re.test(c.path) : c.path === re)), close: () => new Promise(r => server.close(r)) };
}
export function assert(cond, msg) { if (!cond) { const e = new Error('ASSERT: ' + msg); e.assert = true; throw e; } }
export function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`ASSERT ${msg || ''}: expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
/* multipart/form-data parser for upload assertions: returns [{name, filename, type, data(Buffer)}] */
export function parseMultipart(call) {
  const ct = call.headers['content-type'] || ''; const m = ct.match(/boundary=("?)([^";]+)\1/); if (!m) return null; const b = Buffer.from('--' + m[2]); const parts = []; let i = call.body.indexOf(b);
  while (i >= 0) { const j = call.body.indexOf(b, i + b.length); if (j < 0) break; const seg = call.body.subarray(i + b.length + 2, j - 2); const hi = seg.indexOf('\r\n\r\n'); if (hi >= 0) { const head = seg.subarray(0, hi).toString(); const data = seg.subarray(hi + 4); const name = (head.match(/name="([^"]*)"/) || [])[1]; const filename = (head.match(/filename="([^"]*)"/) || [])[1]; const type = (head.match(/Content-Type:\s*([^\r\n]+)/i) || [])[1]; parts.push({ name, filename, type, data }); } i = j; }
  return parts;
}
export const page = (over) => Object.assign({ id: 'ac-repair', slug: 'ac-repair', title: 'AC Repair in Mesquite, TX | Test Co', h1: 'AC Repair in Mesquite, TX', meta_description: 'Same day AC repair across Mesquite and Dallas Fort Worth with written prices before work starts. TDLR licensed technicians, seven days a week.', summary: 'AC repair from Test Co.', excerpt: 'AC repair from Test Co.', language: 'en-US', noindex: false, canonical: 'https://www.example.com/ac-repair/', post_type: 'page', template: 'default', status: 'draft', html: '<section id="hero" class="forge-section forge-sec-hero forge-light"><div class="forge-inner"><h1>AC Repair in Mesquite, TX</h1><p class="forge-lede">Written prices first.</p><p class="forge-ctas"><a class="forge-btn forge-btn-primary" href="#contact">Book service</a></p><img src="https://cdn.example.com/hero.webp" alt="Technician at a condenser" width="1600" height="1000"></div></section><section id="faq" class="forge-section forge-sec-faq forge-light"><div class="forge-inner forge-narrow"><h2>Frequently asked questions</h2><details class="forge-faq"><summary><h3>How fast?</h3></summary><p>Same day in most cases.</p></details></div></section>', css: ':root{--forge-p:#13243a}.forge-section{padding:56px 20px}', schema: { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', name: 'AC Repair in Mesquite, TX' }] }, seo: { title: 'AC Repair in Mesquite, TX | Test Co', description: 'Same day AC repair across Mesquite.', canonical: 'https://www.example.com/ac-repair/', noindex: false, og_image: 'https://cdn.example.com/hero.webp' }, elementor_data: [{ id: 'a1b2c3d', elType: 'container', settings: {}, elements: [], isInner: false }], page_settings: { hide_title: 'yes', template: 'default' }, blueprint: { forge: '1.1', site: { url: 'https://www.example.com', brand: { name: 'Test Co', primary: '#13243a', accent: '#0b6f6d' } }, page: { slug: 'ac-repair' }, sections: [] }, media: { hero: { url: 'https://cdn.example.com/hero.webp', id: 0, alt: 'Technician at a condenser', kind: 'image', width: 1600, height: 1000 } }, featured_media_url: 'https://cdn.example.com/hero.webp', featured_media_id: 0, dates: { published: '2026-09-26', modified: '2026-09-26' }, links: [], lint: [] }, over || {});
export const asset = () => ({ blob: new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c])], { type: 'image/webp' }), file: 'hero.webp', mime: 'image/webp', alt: 'Technician at a condenser', width: 1600, height: 1000 });
