/* ==== cms_core ==== */
"use strict";
/* ============================ CMS publish layer: the contract every adapter implements ============================
   Loaded before the modules. Self-contained: no DOM at load time, so the same file runs inside the extension page and
   inside the Node test harness (tests/lib/load.mjs). Adapters register themselves with CMS.register(adapter).

   PortablePage (what every adapter receives; built by CMS.pageFrom* helpers):
     { id, slug, title, h1, meta_description, summary, excerpt, language, noindex, canonical, post_type ('page'|'post'),
       template, status ('draft'|'publish'), html (section markup, no <html> wrapper), css (scoped forge css), schema (JSON-LD object),
       seo {title, description, canonical, noindex, og_image}, elementor_data, page_settings, blueprint,
       media { slot: {url, id, alt, kind, width, height, mime, asset?} }, featured_media_url, dates {published, modified},
       links [{anchor, url}] }

   Adapter:
     { id, name, group, blurb, fields:[{k,l,t,hint,secret,def}], hosts:[patterns] | dynamicHost(cfg)->origin, setup:[steps], docs:url,
       caps:{media, urls, publishSite, elementor, schema:'head'|'inline'|'none', seo, postTypes:['page','post']},
       base(cfg)->url, test(cfg,ctx)->{ok,info,meta}, listUrls(cfg,ctx)->[url], uploadMedia(cfg,asset,ctx)->{id,url,width,height,mime},
       upsertPage(cfg,page,opts,ctx)->{id,link,edit,status,updated}, publishSite?(cfg,ctx)->{ok,info}, remove?(cfg,id,ctx) }
   ctx: { log(msg), http, mediaHost:{adapter,cfg}|null, signal }
   Errors: throw CMS.CmsError(message, {status, body, adapter, hint}). Never swallow a non-2xx; the Publish module reports it. */
const CMS = (() => {
  const RT = (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime && globalThis.browser.runtime.id) ? globalThis.browser : (typeof globalThis.chrome !== 'undefined' && globalThis.chrome.runtime && globalThis.chrome.runtime.id) ? globalThis.chrome : null;
  const ADAPTERS = {}; const ORDER = [];
  class CmsError extends Error { constructor(msg, o) { super(msg); this.name = 'CmsError'; Object.assign(this, o || {}); } }
  const err = (msg, o) => new CmsError(msg, o);
  function register(a) { if (!a || !a.id) throw new Error('adapter needs an id'); if (!ADAPTERS[a.id]) ORDER.push(a.id); ADAPTERS[a.id] = a; return a; }
  const get = id => ADAPTERS[id] || null; const list = () => ORDER.map(id => ADAPTERS[id]);

  /* ---------- small utilities ---------- */
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  const slug = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'page';
  const trimSlash = u => String(u || '').trim().replace(/\/+$/, '');
  const originOf = u => { try { return new URL(u).origin; } catch (e) { return ''; } };
  const b64 = bytes => { let s = ''; const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const b64url = bytes => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const utf8 = s => new TextEncoder().encode(String(s));
  const b64text = s => b64(utf8(s));
  const hex = bytes => Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  const fromHex = h => { const s = String(h).replace(/[^0-9a-f]/gi, ''); const out = new Uint8Array(s.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16); return out; };
  const stripTags = h => String(h || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
  const stripScripts = h => String(h || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son[a-z]+="[^"]*"/gi, '');
  const words = h => (stripTags(h).match(/\S+/g) || []).length;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function sha256(data) { const buf = typeof data === 'string' ? utf8(data) : data; return new Uint8Array(await crypto.subtle.digest('SHA-256', buf)); }
  async function hmacSha256(keyBytes, data) { const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', key, typeof data === 'string' ? utf8(data) : data)); }
  /* Ghost Admin API needs an HS256 JWT signed with the hex secret; kid = key id. */
  async function jwtHS256(header, payload, secretBytes) { const h = b64url(utf8(JSON.stringify(header))), p = b64url(utf8(JSON.stringify(payload))); const sig = b64url(await hmacSha256(secretBytes, h + '.' + p)); return `${h}.${p}.${sig}`; }
  /* MD5 (Webflow asset uploads hash the file). Public-domain algorithm, arrays of 32-bit words. */
  function md5(input) {
    const bytes = typeof input === 'string' ? utf8(input) : (input instanceof Uint8Array ? input : new Uint8Array(input));
    const K = []; for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    const len = bytes.length; const nBlocks = ((len + 8) >> 6) + 1; const M = new Uint32Array(nBlocks * 16);
    for (let i = 0; i < len; i++) M[i >> 2] |= bytes[i] << ((i % 4) * 8);
    M[len >> 2] |= 0x80 << ((len % 4) * 8); M[nBlocks * 16 - 2] = (len * 8) >>> 0; M[nBlocks * 16 - 1] = Math.floor(len * 8 / 4294967296) >>> 0;
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const rotl = (x, c) => (x << c) | (x >>> (32 - c));
    for (let blk = 0; blk < nBlocks; blk++) {
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g; if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; } else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        const tmp = D; D = C; C = B; B = (B + rotl((A + F + K[i] + M[blk * 16 + g]) >>> 0, S[i])) >>> 0; A = tmp;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16); [a0, b0, c0, d0].forEach((v, i) => { out[i * 4] = v & 255; out[i * 4 + 1] = (v >>> 8) & 255; out[i * 4 + 2] = (v >>> 16) & 255; out[i * 4 + 3] = (v >>> 24) & 255; }); return hex(out);
  }
  const blobBytes = async blob => new Uint8Array(await (blob.arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer()));
  const dataUrlToBlob = u => { const m = String(u).match(/^data:([^;,]+)?(;base64)?,(.*)$/s); if (!m) return null; const mime = m[1] || 'application/octet-stream'; const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]); const b = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) b[i] = raw.charCodeAt(i); return new Blob([b], { type: mime }); };
  const extOf = (name, mime) => { const m = String(name || '').match(/\.([a-z0-9]{2,5})$/i); if (m) return m[1].toLowerCase(); return ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm' })[mime] || 'bin'; };

  /* ---------- HTTP ---------- */
  /* http(url, {method, headers, body(json object|string|Blob|FormData|Uint8Array), raw:true (send body as is), timeout, expect:'json'|'text'|'blob'|'auto'})
     Resolves {status, ok, headers, json, text, blob}; rejects CmsError on non-2xx (unless opts.tolerate) with the parsed body attached. */
  async function http(url, opts) {
    opts = opts || {}; const h = Object.assign({}, opts.headers || {}); let body = opts.body;
    if (body != null && !opts.raw && !(body instanceof Blob) && !(typeof FormData !== 'undefined' && body instanceof FormData) && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer) && typeof body !== 'string' && !(typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)) { body = JSON.stringify(body); if (!Object.keys(h).some(k => k.toLowerCase() === 'content-type')) h['Content-Type'] = 'application/json'; }
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const t = ctl ? setTimeout(() => ctl.abort(), opts.timeout || 60000) : null;
    let r; try { r = await fetch(url, { method: opts.method || (body != null ? 'POST' : 'GET'), headers: h, body, mode: 'cors', credentials: 'omit', signal: ctl ? ctl.signal : undefined, redirect: opts.redirect || 'follow' }); }
    catch (e) { clearTimeout(t); throw err(`Could not reach ${originOf(url) || url}: ${e && e.name === 'AbortError' ? 'timed out' : (e.message || e)}`, { status: 0, network: true, url }); }
    clearTimeout(t);
    const ctype = (r.headers.get('content-type') || '').toLowerCase(); const out = { status: r.status, ok: r.ok, headers: r.headers, url: r.url, json: null, text: '', blob: null };
    const expect = opts.expect || 'auto';
    if (expect === 'blob') out.blob = await r.blob();
    else { out.text = await r.text(); if (expect === 'json' || (expect === 'auto' && (ctype.includes('json') || /^\s*[\[{]/.test(out.text)))) { try { out.json = JSON.parse(out.text); } catch (e) { if (expect === 'json') { if (r.ok) throw err(`${originOf(url)} returned ${r.status} but the body is not JSON (${out.text.slice(0, 120).replace(/\s+/g, ' ')})`, { status: r.status, body: out.text, url }); } } } }
    if (!r.ok && !opts.tolerate) { const j = out.json; const msg = j && (j.message || j.error_description || (j.error && (j.error.message || j.error.error_description || (typeof j.error === 'string' ? j.error : ''))) || (Array.isArray(j.errors) && j.errors.map(e => e.message || e.detail || e.title || JSON.stringify(e)).join('; ')) || (j.errors && j.errors[0] && (j.errors[0].message || j.errors[0].detail)) || j.detail || j.error_message || (j.data && j.data.message) || j.code) || (out.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) || r.statusText; throw err(`${r.status} ${msg}`, { status: r.status, body: j || out.text, url }); }
    return out;
  }
  const basicAuth = (u, p) => 'Basic ' + b64text(`${u}:${p}`);

  /* ---------- host permissions (the reason a browser extension can talk to any site without CORS) ---------- */
  async function ensureOrigin(urlOrOrigin) {
    const o = originOf(urlOrOrigin) || originOf('https://' + String(urlOrOrigin).replace(/^https?:\/\//, '')); if (!o) throw err('Enter a full site URL, such as https://www.example.com', { status: 0 });
    if (!RT || !RT.permissions) return { granted: true, origin: o, note: 'no permission API (file or viewer)' };
    const pat = o + '/*'; try { if (await RT.permissions.contains({ origins: [pat] })) return { granted: true, origin: o }; } catch (e) { }
    try { const ok = await RT.permissions.request({ origins: [pat] }); return { granted: !!ok, origin: o }; } catch (e) { return { granted: false, origin: o, note: e.message }; }
  }
  async function hasOrigin(urlOrOrigin) { const o = originOf(urlOrOrigin); if (!o) return false; if (!RT || !RT.permissions) return true; try { return await RT.permissions.contains({ origins: [o + '/*'] }); } catch (e) { return false; } }

  /* ---------- storage ---------- */
  const KEY = 'sv.cms.v1';   // Severance keeps its own ledger; the Thermal Atlas uses tda.cms.v1
  let S = { cfg: {}, deployed: {}, log: [], settings: { mediaHost: '', target: '' } }; let ready = false;
  const kv = { async get(k, d) { if (RT && RT.storage) { try { const r = await RT.storage.local.get(k); return r && r[k] !== undefined ? r[k] : d; } catch (e) { return d; } } try { const v = globalThis.localStorage && localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    async set(k, v) { if (RT && RT.storage) { try { await RT.storage.local.set({ [k]: v }); return; } catch (e) { } } try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const readyP = kv.get(KEY, null).then(v => { if (v && typeof v === 'object') { S = Object.assign(S, v); S.cfg = S.cfg || {}; S.deployed = S.deployed || {}; S.log = S.log || []; S.settings = Object.assign({ mediaHost: '', target: '' }, S.settings || {}); } ready = true; });
  const save = () => kv.set(KEY, S);
  const cfg = id => S.cfg[id] || {};
  async function setCfg(id, patch) { S.cfg[id] = Object.assign({}, cfg(id), patch); await save(); }
  async function setSettings(patch) { Object.assign(S.settings, patch); await save(); }
  function deployedFor(id) { return S.deployed[id] || {}; }
  async function markDeployed(id, slug, rec) { S.deployed[id] = S.deployed[id] || {}; S.deployed[id][slug] = Object.assign({ at: new Date().toISOString() }, rec); await save(); }
  async function clearDeployed(id) { if (id) delete S.deployed[id]; else S.deployed = {}; await save(); }
  async function clearCfg(id) { if (id) delete S.cfg[id]; else S.cfg = {}; await save(); }
  function fieldsOk(a, c) { return (a.fields || []).filter(f => f.required !== false && !f.optional).every(f => c[f.k] != null && String(c[f.k]).trim() !== '' || f.def != null); }
  function status(id) { const a = get(id); if (!a) return { state: 'unknown', label: 'Unknown adapter' }; const c = cfg(id); const n = Object.keys(deployedFor(id)).length; if (!fieldsOk(a, c)) return { state: 'unconfigured', label: 'Not configured' }; if (c._tested) return { state: 'connected', label: `Connected · ${c._tested.info || ''}${n ? ` · ${n} page${n > 1 ? 's' : ''} sent` : ''}`.trim() }; return { state: 'configured', label: 'Configured, not tested' }; }

  /* ---------- portable pages ---------- */
  const FORGE_CSS_DEFAULT = '.forge-section{padding:56px 20px}.forge-inner{max-width:1140px;margin:0 auto}.forge-narrow{max-width:820px}.forge-tint{background:var(--forge-t,#eef2f6)}.forge-brand{background:var(--forge-p,#13243a);color:#fff}.forge-brand h2{color:#fff}.forge-dark{background:var(--forge-d,#111110);color:#fff}.forge-split{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:center}.forge-split img,.forge-video iframe,.forge-section video{width:100%;height:auto;border-radius:14px}.forge-video{position:relative;aspect-ratio:16/9}.forge-video iframe{position:absolute;inset:0;height:100%}.forge-eyebrow{color:var(--forge-a,#0b6f6d);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px}.forge-lede{font-size:19px}.forge-btn{display:inline-block;padding:14px 22px;border-radius:8px;font-weight:700;text-decoration:none;margin:6px 8px 6px 0}.forge-btn-primary{background:var(--forge-p,#13243a);color:#fff}.forge-btn-secondary{background:var(--forge-a,#0b6f6d);color:#fff}.forge-trust{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px 18px;font-size:14px}.forge-answer{font-size:20px;border-left:4px solid var(--forge-p,#13243a);padding-left:16px}.forge-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.forge-facts div{background:#fff;border-radius:12px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.forge-facts dt{font-size:34px;font-weight:800;color:var(--forge-p,#13243a)}.forge-brand .forge-facts div{background:rgba(255,255,255,.08)}.forge-brand .forge-facts dt{color:#fff}.forge-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}.forge-card{background:#fff;border-radius:12px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin:0}.forge-steps li{margin-bottom:14px}.forge-faq{border-bottom:1px solid #e3e1da;padding:10px 0}.forge-faq summary{cursor:pointer;font-weight:700}.forge-faq summary h3{display:inline;font-size:18px}.forge-form label{display:block;margin:10px 0 4px;font-weight:600}.forge-form input,.forge-form textarea{width:100%;padding:12px;border:1px solid #cfcdc5;border-radius:8px;font:inherit}.forge-form textarea{min-height:110px}.forge-consent{font-weight:400!important;font-size:14px}.forge-table{width:100%;border-collapse:collapse}.forge-table th,.forge-table td{text-align:left;padding:10px;border-bottom:1px solid #e3e1da}.forge-tablewrap{overflow-x:auto}.forge-ctas{margin-top:18px}.forge-sticky{display:none}@media(max-width:767px){.forge-split{grid-template-columns:1fr}.forge-sticky{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:9999;gap:8px;padding:10px 12px;background:#fff;box-shadow:0 -4px 16px rgba(0,0,0,.14)}.forge-sticky a{flex:1;text-align:center;padding:12px;border-radius:8px;font-weight:700;text-decoration:none}.forge-sticky-call{background:var(--forge-a,#0b6f6d);color:#fff}.forge-sticky-cta{background:var(--forge-p,#13243a);color:#fff}body{padding-bottom:70px}}';
  function brandCss(brand) { brand = brand || {}; const p = brand.primary || '#13243a', a = brand.accent || '#0b6f6d', d = brand.dark || '#111110'; const t = hexmix(p, 0.9); return `:root{--forge-p:${p};--forge-a:${a};--forge-d:${d};--forge-t:${t}}` + FORGE_CSS_DEFAULT; }
  function hexmix(c, white) { white = white == null ? 0.9 : white; c = String(c || '#13243a').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); const f = v => Math.round(v + (255 - v) * white); return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }
  /* from a Site Forge build: bp = blueprint, r = FORGE_COMPILE.compile result, media = resolved media map */
  function pageFromForge(bp, r, media, extra) {
    const pg = bp.page || {}; const brand = (bp.site || {}).brand || {}; const hero = (bp.sections || []).find(s => s.type === 'hero' && s.media); const hm = hero && media && media[hero.media];
    return Object.assign({ id: pg.slug, slug: pg.slug, title: pg.title || pg.h1, h1: pg.h1 || pg.title, meta_description: pg.meta_description || '', summary: pg.summary || '', excerpt: pg.summary || '', language: pg.language || 'en-US', noindex: !!pg.noindex, canonical: (r.seo || {}).canonical || pg.canonical || '', post_type: pg.post_type || 'page', template: (r.page_settings || {}).template || pg.template || 'default', status: 'draft',
      html: r.html, css: brandCss(brand), schema: r.schema, seo: r.seo, elementor_data: r.elementor_data, page_settings: r.page_settings, blueprint: bp, media: media || {}, featured_media_url: hm ? hm.url : '', featured_media_id: hm ? hm.id : 0, dates: pg.dates || {}, links: pg.internal_links || [], lint: r.lint || [] }, extra || {});
  }
  /* from plain inputs (the composer, a pasted HTML file, an imported bundle) */
  function pageFromHtml(o) { o = o || {}; const s = slug(o.slug || o.title); return { id: o.id || s, slug: s, title: o.title || o.h1 || s, h1: o.h1 || o.title || s, meta_description: o.meta_description || o.description || '', summary: o.summary || '', excerpt: o.excerpt || o.summary || '', language: o.language || 'en-US', noindex: !!o.noindex, canonical: o.canonical || '', post_type: o.post_type || 'page', template: o.template || 'default', status: o.status || 'draft', html: o.html || '', css: o.css == null ? brandCss(o.brand) : o.css, schema: o.schema || null, seo: Object.assign({ title: o.title || '', description: o.meta_description || '', canonical: o.canonical || '', noindex: !!o.noindex, og_image: o.featured_media_url || '' }, o.seo || {}), elementor_data: o.elementor_data || null, page_settings: o.page_settings || null, blueprint: o.blueprint || null, media: o.media || {}, featured_media_url: o.featured_media_url || '', featured_media_id: o.featured_media_id || 0, dates: o.dates || {}, links: o.links || [], lint: [] }; }
  function pageFromBundle(b) { return pageFromHtml({ id: b.slug, slug: b.slug, title: b.title, h1: b.post_title, meta_description: (b.seo || {}).description, summary: b.summary, post_type: b.post_type, template: b.template, status: b.status, html: b.content_html, schema: b.schema, seo: b.seo, elementor_data: b.elementor_data, page_settings: b.page_settings, blueprint: b.blueprint, media: (b.blueprint || {}).media_resolved || {}, brand: ((b.blueprint || {}).site || {}).brand, noindex: !!(b.seo || {}).noindex, canonical: (b.seo || {}).canonical }); }

  /* ---------- rendering helpers shared by adapters ---------- */
  const schemaTag = schema => schema ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>` : '';
  const styleTag = css => css ? `<style>${css}</style>` : '';
  /* Body markup for CMSs that take an HTML field: optional inline css and JSON-LD, media URLs rewritten. */
  function bodyHtml(page, o) { o = o || {}; let html = String(page.html || ''); if (o.mediaMap) html = rewriteMedia(html, o.mediaMap); if (o.stripScripts) html = stripScripts(html); return (o.css ? styleTag(page.css) : '') + html + (o.schema ? '\n' + schemaTag(page.schema) : ''); }
  /* A complete standalone document (static hosts, previews, Duda injection into a blank page). */
  function fullHtml(page, o) { o = o || {}; const lang = String(page.language || 'en-US').slice(0, 2); const seo = page.seo || {}; const head = [`<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width,initial-scale=1">`, `<title>${esc(seo.title || page.title)}</title>`, seo.description ? `<meta name="description" content="${esc(seo.description)}">` : '', (seo.noindex || page.noindex) ? '<meta name="robots" content="noindex,follow">' : '', seo.canonical ? `<link rel="canonical" href="${esc(seo.canonical)}">` : '', seo.og_image ? `<meta property="og:image" content="${esc(seo.og_image)}">` : '', styleTag(page.css), schemaTag(page.schema), o.headExtra || ''].filter(Boolean).join('\n'); return `<!DOCTYPE html><html lang="${esc(lang)}"><head>${head}</head><body><main>${o.mediaMap ? rewriteMedia(page.html, o.mediaMap) : page.html}</main>${o.bodyExtra || ''}</body></html>`; }
  const isPlaceholder = u => /^data:image\/svg\+xml/.test(String(u || '')) && /resolved(%20| )at(%20| )deploy/i.test(String(u));
  /* drop the compiler's "resolved at deploy" placeholders (img tags and background urls) so no page ships with one */
  function stripPlaceholders(html) { return String(html || '').replace(/<img\b[^>]*src="data:image\/svg\+xml[^"]*resolved(?:%20| )at(?:%20| )deploy[^"]*"[^>]*>/gi, '').replace(/url\((?:'|")?data:image\/svg\+xml[^)]*resolved(?:%20| )at(?:%20| )deploy[^)]*\)/gi, 'none'); }
  function rewriteMedia(html, map) { let h = String(html || ''); for (const [from, to] of Object.entries(map || {})) { if (from && to && from !== to) h = h.split(from).join(to); } return h; }
  /* Resolve the page's media slots onto the target: upload local assets (blobs) through the adapter or the media host, return {slot: {url,id}} and the url rewrite map. */
  async function resolveMedia(adapter, c, page, ctx) {
    const out = {}; const map = {}; const media = page.media || {}; const notes = [];
    for (const [k, m] of Object.entries(media)) { if (!m) continue;
      if (m.library && !m.url && !m.asset) { const finder = (adapter.findMedia ? { adapter, cfg: c } : (ctx && ctx.mediaHost && ctx.mediaHost.adapter && ctx.mediaHost.adapter.findMedia ? ctx.mediaHost : null));
        if (finder) { try { const hit = (await finder.adapter.findMedia(finder.cfg, m.library, m.kind || 'image', ctx) || [])[0]; if (hit && hit.url) { out[k] = Object.assign({}, m, hit, { library: undefined }); if (ctx && ctx.log) ctx.log(`media ${k}: library match "${m.library}" → ${hit.url}`); continue; } } catch (e) { notes.push(`${k}: library search failed, ${e.message}`); } }
        notes.push(`${k}: no image for "${m.library}"; assign an asset in Site Forge step 7 (the placeholder is dropped)`); out[k] = Object.assign({}, m, { unresolved: true }); continue; }
      if (m.missing && !m.url) { notes.push(`${k}: asset ${m.missing} is not loaded (photos are not saved with the plan)`); out[k] = Object.assign({}, m, { unresolved: true }); continue; }
      const asset = m.asset || null; const isData = /^data:/.test(m.url || '') && !isPlaceholder(m.url); const local = asset || (isData ? { blob: dataUrlToBlob(m.url), file: (k + '.' + extOf('', (m.url.match(/^data:([^;,]+)/) || [])[1])), mime: (m.url.match(/^data:([^;,]+)/) || [])[1] } : null);
      if (!local) { out[k] = m; continue; }
      const host = (ctx && ctx.mediaHost && ctx.mediaHost.adapter && ctx.mediaHost.adapter.uploadMedia) ? ctx.mediaHost : (adapter.uploadMedia ? { adapter, cfg: c } : null);
      if (!host) { notes.push(`${k}: ${adapter.name} cannot host uploads; choose a media host`); out[k] = m; continue; }
      try { const up = await host.adapter.uploadMedia(host.cfg, { blob: local.blob, file: local.file || (k + '.' + extOf('', local.mime)), mime: local.mime || (local.blob && local.blob.type) || 'application/octet-stream', alt: m.alt || '', width: m.width, height: m.height }, ctx); out[k] = Object.assign({}, m, up, { asset: undefined }); if (m.url) map[m.url] = up.url; if (ctx && ctx.log) ctx.log(`media ${k}: ${up.reused ? 'reused' : 'uploaded'} → ${up.url}`); }
      catch (e) { notes.push(`${k}: upload failed, ${e.message}`); out[k] = m; }
    }
    return { media: out, map, notes };
  }
  /* Minimal HTML → block model, for CMSs whose content field is structured (Wix Ricos, Duda blog blocks). Keeps headings, paragraphs, lists, links, images, blockquotes. */
  function htmlToBlocks(html) {
    const out = []; const s = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const re = /<(h[1-6]|p|li|blockquote|img|dt|dd|summary)\b([^>]*)>([\s\S]*?)<\/\1>|<img\b([^>]*?)\/?>/gi; let m;
    const inline = t => String(t).replace(/<br\s*\/?>/gi, '\n').replace(/<(?!\/?(a|strong|b|em|i)\b)[^>]+>/gi, '').trim();
    while ((m = re.exec(s))) { if (m[4] != null || m[1] === 'img') { const at = m[4] || m[2] || ''; const src = (at.match(/src="([^"]+)"/i) || [])[1]; const alt = (at.match(/alt="([^"]*)"/i) || [])[1] || ''; if (src && !/^data:/.test(src)) out.push({ type: 'image', src, alt }); continue; }
      const tag = m[1].toLowerCase(); const text = inline(m[3]); if (!text) continue;
      if (/^h[1-6]$/.test(tag)) out.push({ type: 'heading', level: +tag[1], text }); else if (tag === 'li') out.push({ type: 'li', text }); else if (tag === 'blockquote') out.push({ type: 'quote', text }); else if (tag === 'dt') out.push({ type: 'heading', level: 3, text }); else out.push({ type: 'p', text }); }
    return out;
  }
  /* Rich text subset for CMS fields that keep only editorial HTML (Wix Rich Text, Webflow RichText, HubSpot rich text modules):
     drops style, script, form, details/summary wrappers, sticky bars and every attribute except href/src/alt/width/height; unwraps sections and divs;
     turns definition lists into paragraphs. Options: {keep:Set of tags, attrs:{tag:[attr]}} override the defaults. */
  const RT_KEEP = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'img', 'blockquote', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'video', 'source', 'iframe', 'small', 'sup', 'sub', 'code', 'pre']);
  const RT_ATTRS = { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'], video: ['src', 'poster', 'controls'], source: ['src', 'type'], iframe: ['src', 'title', 'allow', 'allowfullscreen'], th: ['scope'] };
  const RT_DROP = ['style', 'script', 'form', 'button', 'input', 'select', 'textarea', 'label', 'nav', 'noscript', 'svg', 'template'];
  function richText(html, o) {
    o = o || {}; const keep = o.keep || RT_KEEP, attrs = o.attrs || RT_ATTRS;
    let h = String(html || '');
    for (const t of RT_DROP) h = h.replace(new RegExp('<' + t + '\\b[^>]*>[\\s\\S]*?</' + t + '>', 'gi'), '').replace(new RegExp('<' + t + '\\b[^>]*/?>', 'gi'), '');
    h = h.replace(/<div\b[^>]*class="[^"]*forge-sticky[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    h = h.replace(/<details\b[^>]*>([\s\S]*?)<\/details>/gi, '$1').replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi, (m, inner) => /<h[1-6]/i.test(inner) ? inner : '<p><strong>' + inner + '</strong></p>');
    h = h.replace(/<dt\b[^>]*>([\s\S]*?)<\/dt>/gi, '<p><strong>$1</strong></p>').replace(/<dd\b[^>]*>([\s\S]*?)<\/dd>/gi, '<p>$1</p>');
    h = h.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (m, tag, at) => { tag = tag.toLowerCase(); if (!keep.has(tag)) return ''; if (m[1] === '/') return '</' + tag + '>'; const out = []; for (const k of (attrs[tag] || [])) { const v = (at.match(new RegExp('(?:^|\\s)' + k + '="([^"]*)"', 'i')) || [])[1]; if (v != null) out.push(k + '="' + v + '"'); else if (/^(controls|allowfullscreen)$/.test(k) && new RegExp('(?:^|\\s)' + k + '(?=\\s|$)', 'i').test(at)) out.push(k); } return '<' + tag + (out.length ? ' ' + out.join(' ') : '') + '>'; });
    return h.replace(/<p>\s*<\/p>/gi, '').replace(/[ \t]*\n[ \t\n]*/g, '\n').trim();
  }
  /* inline html (a, strong, em, br) → runs [{text, bold, italic, link}] */
  function inlineRuns(html) { const runs = []; const re = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>|<(strong|b)>([\s\S]*?)<\/\3>|<(em|i)>([\s\S]*?)<\/\5>|([^<]+)|<[^>]+>/gi; let m; const dec = t => stripTags(t); while ((m = re.exec(html))) { if (m[1] != null) runs.push({ text: dec(m[2]), link: m[1] }); else if (m[3]) runs.push({ text: dec(m[4]), bold: true }); else if (m[5]) runs.push({ text: dec(m[6]), italic: true }); else if (m[7] != null) { const t = m[7].replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'"); if (t) runs.push({ text: t }); } } return runs; }

  /* ---------- deploy driver ---------- */
  /* deploy(adapterId, pages, {publish, onlyNew, log, mediaHost}) → [{page, ok, res|error}] ; the adapter decides how a slug maps onto its content model. */
  async function deploy(id, pages, opts) {
    const a = get(id); if (!a) throw err('Unknown adapter ' + id); const c = cfg(id); opts = opts || {}; const log = opts.log || (() => { }); const results = [];
    const mediaHost = opts.mediaHost ? { adapter: get(opts.mediaHost), cfg: cfg(opts.mediaHost) } : null;
    const ctx = { log, http, mediaHost, signal: opts.signal };
    if (a.dynamicHost) { const o = a.dynamicHost(c); if (o) { const p = await ensureOrigin(o); if (!p.granted) throw err(`Site access to ${p.origin} was not granted; the browser asks once per site.`, { status: 0 }); } }
    for (const page of pages) {
      if (opts.signal && opts.signal.aborted) break;
      const prior = deployedFor(id)[page.slug]; if (opts.onlyNew && prior && prior.id && prior.ok !== false) { results.push({ page, ok: true, skipped: true, res: prior }); continue; }
      try {
        if ((page.lint || []).some(l => /^BLOCK/.test(l))) throw err('blocked: ' + page.lint.find(l => /^BLOCK/.test(l)));
        const rm = await resolveMedia(a, c, page, ctx); const p2 = Object.assign({}, page, { media: rm.media, mediaMap: rm.map, mediaNotes: rm.notes, status: opts.publish ? 'publish' : 'draft' });
        if (Object.values(rm.media).some(m => m && m.unresolved)) { if (opts.requireMedia) throw err('media unresolved: ' + rm.notes.join('; '), { hint: 'assign assets in Site Forge step 7 or untick "Require every image"' }); p2.html = stripPlaceholders(p2.html); if (p2.seo && isPlaceholder(p2.seo.og_image)) p2.seo = Object.assign({}, p2.seo, { og_image: '' }); if (isPlaceholder(p2.featured_media_url)) p2.featured_media_url = ''; }
        else p2.html = stripPlaceholders(p2.html);
        if (rm.map && Object.keys(rm.map).length) { p2.html = rewriteMedia(p2.html, rm.map); if (p2.seo && rm.map[p2.seo.og_image]) p2.seo = Object.assign({}, p2.seo, { og_image: rm.map[p2.seo.og_image] }); if (p2.schema) p2.schema = JSON.parse(rewriteMedia(JSON.stringify(p2.schema), rm.map)); }
        if (p2.featured_media_url && rm.map[p2.featured_media_url]) p2.featured_media_url = rm.map[p2.featured_media_url];
        const hero = Object.values(rm.media).find(m => m && m.id && m.url === p2.featured_media_url); if (hero) p2.featured_media_id = hero.id;
        const res = await a.upsertPage(c, p2, { publish: !!opts.publish }, ctx);
        await markDeployed(id, page.slug, Object.assign({ ok: true, title: page.title, notes: rm.notes.join('; ') }, res));
        results.push({ page, ok: true, res, notes: rm.notes });
        log(`${page.slug}: ${res.updated ? 'updated' : 'created'} ${res.status || ''} ${res.link || res.id || ''}`.replace(/\s+/g, ' ').trim());
      } catch (e) { await markDeployed(id, page.slug, { ok: false, title: page.title, error: e.message, status: 'error' }); results.push({ page, ok: false, error: e }); log(`${page.slug}: ERROR ${e.message}${e.hint ? ' · ' + e.hint : ''}`); }
    }
    return results;
  }
  async function test(id) { const a = get(id); const c = cfg(id); if (!a) throw err('Unknown adapter'); if (!fieldsOk(a, c)) throw err('Fill in the required fields first'); if (a.dynamicHost) { const o = a.dynamicHost(c); if (o) { const p = await ensureOrigin(o); if (!p.granted) throw err(`Site access to ${p.origin} was not granted`, { status: 0 }); } } const r = await a.test(c, { http, log: () => { } }); S.cfg[id] = Object.assign({}, c, { _tested: { at: new Date().toISOString(), info: r.info || 'ok', meta: r.meta || null } }); await save(); return r; }

  return { RT, CmsError, err, register, get, list, ADAPTERS, ORDER, esc, slug, trimSlash, originOf, b64, b64url, b64text, utf8, hex, fromHex, stripTags, stripScripts, words, sleep, sha256, hmacSha256, jwtHS256, md5, blobBytes, dataUrlToBlob, extOf, http, basicAuth, ensureOrigin, hasOrigin, ready: () => readyP, isReady: () => ready, get S() { return S; }, cfg, setCfg, setSettings, settings: () => S.settings, deployedFor, markDeployed, clearDeployed, clearCfg, status, fieldsOk, pageFromForge, pageFromHtml, pageFromBundle, brandCss, hexmix, FORGE_CSS_DEFAULT, schemaTag, styleTag, bodyHtml, fullHtml, rewriteMedia, resolveMedia, isPlaceholder, stripPlaceholders, richText, htmlToBlocks, inlineRuns, deploy, test };
})();
globalThis.CMS = CMS;
